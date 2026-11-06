import { z } from 'zod';
import { WALL_GRID as GRID, wallOutlines } from '../geometry/wall-outlines.ts';
import { deriveRooms } from '../rooms/derive.ts';
import { firstLevel, values } from '../schema/collections.ts';
import type { Plan, Wall } from '../schema/plan.ts';
import type { Point } from '../schema/primitives.ts';
import { roomTypeLabel } from '../schema/room-types.ts';
import { setbackSides } from '../schema/sides.ts';
import layersFile from './export-layers.default.json' with { type: 'json' };
import { importDxf } from './import.ts';
import { R2000_TEMPLATE } from './r2000-template.ts';
import { columnCorners, stairSymbol } from '../view/drawing.ts';
import { parseAsciiText, tagString, writeDxfAscii, type DxfTag, type DxfValue } from './tags.ts';

// DXF export (P1.3): a layered AutoCAD 2000 drawing in millimetres. The file is the ezdxf-made
// template (header, tables, layouts, opening symbols) with our layers and drawing added. Walls
// are joined outlines per wall layer (no seams at corners, gaps at openings). Every export is
// read back with our own importer and refused if anything went missing (P1.3 task 3).

const LINEWEIGHTS = [
  0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106, 120, 140, 158, 200,
  211,
];

const LayerStyle = z.strictObject({
  name: z.string().min(1),
  colour: z.number().int().min(1).max(255),
  lineweight: z.number().refine((v) => LINEWEIGHTS.includes(v), 'not a DXF lineweight'),
  linetype: z.enum(['Continuous', 'DASHED']),
});
export type LayerStyle = z.infer<typeof LayerStyle>;

const KINDS = [
  'wall_external',
  'wall_internal',
  'wall_parapet',
  'wall_compound',
  'door',
  'window',
  'stair',
  'column',
  'room_label',
  'separator',
  'dimension',
  'text',
  'plot',
  'setback',
] as const;
export type LayerKind = (typeof KINDS)[number];

export const ExportLayers = z.strictObject({
  version: z.literal(1),
  about: z.string().optional(),
  layers: z.strictObject(
    Object.fromEntries(KINDS.map((k) => [k, LayerStyle])) as Record<LayerKind, typeof LayerStyle>,
  ),
});
export type ExportLayers = z.infer<typeof ExportLayers>;
export const DEFAULT_EXPORT_LAYERS: ExportLayers = ExportLayers.parse(layersFile);

export interface ExportOptions {
  layers?: ExportLayers;
}

export interface ExportCheck {
  /** Plain-language differences between the plan and the file read back; empty when it matches. */
  mismatches: string[];
}

export interface ExportResult {
  /** False when the file lost data: don't offer it for download. */
  ok: boolean;
  dxf: string;
  check: ExportCheck;
}

const MM = 10; // DXF units (mm) per cm

const t = (code: number, value: DxfValue): DxfTag => ({ code, value });

// --- Template surgery -------------------------------------------------------------------------

function sectionRange(tags: DxfTag[], name: string): [number, number] {
  for (let i = 0; i + 1 < tags.length; i++) {
    if (
      tags[i]!.code === 0 &&
      tagString(tags[i]!) === 'SECTION' &&
      tagString(tags[i + 1]!) === name
    ) {
      let j = i + 2;
      while (!(tags[j]!.code === 0 && tagString(tags[j]!) === 'ENDSEC')) j++;
      return [i + 2, j];
    }
  }
  throw new Error(`template has no ${name} section`);
}

function tableRange(tags: DxfTag[], name: string): [number, number] {
  for (let i = 0; i + 1 < tags.length; i++) {
    if (
      tags[i]!.code === 0 &&
      tagString(tags[i]!) === 'TABLE' &&
      tagString(tags[i + 1]!) === name
    ) {
      let j = i + 2;
      while (!(tags[j]!.code === 0 && tagString(tags[j]!) === 'ENDTAB')) j++;
      return [i, j];
    }
  }
  throw new Error(`template has no ${name} table`);
}

/** Code-5 handle of the record of `type` named `name` within [from, to). */
function recordHandle(
  tags: DxfTag[],
  from: number,
  to: number,
  type: string,
  name: string,
): string {
  for (let i = from; i < to; i++) {
    if (tags[i]!.code !== 0 || tagString(tags[i]!) !== type) continue;
    let j = i + 1;
    let handle = '';
    let found = false;
    for (; j < to && tags[j]!.code !== 0; j++) {
      if (tags[j]!.code === 5) handle = tagString(tags[j]!);
      if (tags[j]!.code === 2 && tagString(tags[j]!).toUpperCase() === name.toUpperCase())
        found = true;
    }
    if (found) return handle;
  }
  throw new Error(`template has no ${type} ${name}`);
}

/** Splits tags into records, each starting at a code-0 tag. */
function records(tags: DxfTag[]): DxfTag[][] {
  const out: DxfTag[][] = [];
  for (const x of tags) {
    if (x.code === 0) out.push([x]);
    else out[out.length - 1]?.push(x);
  }
  return out;
}

function setHeader(tags: DxfTag[], name: string, values: DxfTag[]) {
  const i = tags.findIndex((x) => x.code === 9 && tagString(x) === name);
  if (i < 0) throw new Error(`template has no ${name}`);
  let j = i + 1;
  while (j < tags.length && tags[j]!.code !== 9 && tags[j]!.code !== 0) j++;
  tags.splice(i + 1, j - i - 1, ...values);
}

// --- Geometry ---------------------------------------------------------------------------------

const WALL_LAYER: Record<Wall['type'], LayerKind> = {
  external: 'wall_external',
  internal: 'wall_internal',
  parapet: 'wall_parapet',
  compound: 'wall_compound',
};

// --- Counting, for the read-back check ---------------------------------------------------------

function tally(plan: Plan) {
  const level = firstLevel(plan);
  const count = <T>(items: T[], key: (x: T) => string) =>
    items.reduce<Record<string, number>>(
      (acc, x) => ((acc[key(x)] = (acc[key(x)] ?? 0) + 1), acc),
      {},
    );
  const wallLength: Record<string, number> = {};
  for (const w of values(level.walls)) {
    wallLength[w.type] =
      (wallLength[w.type] ?? 0) + Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]);
  }
  return {
    wallLength,
    openings: count(values(level.openings), (o) => o.kind),
    rooms: count(values(level.rooms), (r) => r.type),
    stairs: values(level.stairs).length,
    columns: values(level.columns).length,
    separatorLength: values(level.separators).reduce(
      (sum, x) => sum + Math.hypot(x.end[0] - x.start[0], x.end[1] - x.start[1]),
      0,
    ),
  };
}

function compare(plan: Plan, back: Plan | null): string[] {
  if (!back) return ['The exported file could not be read back.'];
  const a = tally(plan);
  const b = tally(back);
  const out: string[] = [];
  for (const type of new Set([...Object.keys(a.wallLength), ...Object.keys(b.wallLength)])) {
    const x = a.wallLength[type] ?? 0;
    const y = b.wallLength[type] ?? 0;
    if (Math.abs(x - y) > Math.max(5, x * 0.005)) {
      out.push(
        `${type} walls: ${(x / 100).toFixed(2)} m in the plan, ${(y / 100).toFixed(2)} m in the file.`,
      );
    }
  }
  for (const [what, xa, xb] of [
    ['openings', a.openings, b.openings],
    ['rooms', a.rooms, b.rooms],
  ] as const) {
    for (const key of new Set([...Object.keys(xa), ...Object.keys(xb)])) {
      if ((xa[key] ?? 0) !== (xb[key] ?? 0)) {
        out.push(
          `${key.replace(/_/g, ' ')} ${what === 'rooms' ? 'rooms' : 'openings'}: ${xa[key] ?? 0} in the plan, ${xb[key] ?? 0} in the file.`,
        );
      }
    }
  }
  if (Math.abs(a.separatorLength - b.separatorLength) > Math.max(5, a.separatorLength * 0.005)) {
    out.push(
      `Room separators: ${(a.separatorLength / 100).toFixed(2)} m in the plan, ${(b.separatorLength / 100).toFixed(2)} m in the file.`,
    );
  }
  if (a.stairs !== b.stairs) out.push(`Stairs: ${a.stairs} in the plan, ${b.stairs} in the file.`);
  if (a.columns !== b.columns)
    out.push(`Columns: ${a.columns} in the plan, ${b.columns} in the file.`);
  return out;
}

// --- Export -----------------------------------------------------------------------------------

export function exportDxf(plan: Plan, options: ExportOptions = {}): ExportResult {
  const styles = (options.layers ?? DEFAULT_EXPORT_LAYERS).layers;
  const level = firstLevel(plan);
  const tags = parseAsciiText(R2000_TEMPLATE);
  if (!tags.ok) throw new Error('DXF template is unreadable');
  const all = tags.tags;

  let nextHandle = parseInt(
    tagString(all[all.findIndex((x) => x.code === 9 && tagString(x) === '$HANDSEED') + 1]!),
    16,
  );
  const handle = () => (nextHandle++).toString(16).toUpperCase();

  const [brStart, brEnd] = tableRange(all, 'BLOCK_RECORD');
  const modelSpace = recordHandle(all, brStart, brEnd, 'BLOCK_RECORD', '*Model_Space');
  const [layStart, layEnd] = tableRange(all, 'LAYER');
  const layerTable = tagString(all.slice(layStart).find((x) => x.code === 5)!);
  // New layers share layer 0's plot style.
  const plotStyle = records(all.slice(layStart + 1, layEnd))
    .find((r) => r.some((x) => x.code === 2 && tagString(x) === '0'))
    ?.find((x) => x.code === 390);

  // Layers
  const layerName = (k: LayerKind) => styles[k].name;
  const seen = new Set<string>();
  const layerRecords: DxfTag[] = [];
  for (const k of KINDS) {
    const s = styles[k];
    if (seen.has(s.name.toUpperCase())) continue;
    seen.add(s.name.toUpperCase());
    layerRecords.push(
      t(0, 'LAYER'),
      t(5, handle()),
      t(330, layerTable),
      t(100, 'AcDbSymbolTableRecord'),
      t(100, 'AcDbLayerTableRecord'),
      t(2, s.name),
      t(70, 0),
      t(62, s.colour),
      t(6, s.linetype),
      t(290, true),
      t(370, s.lineweight),
      ...(plotStyle ? [t(390, tagString(plotStyle))] : []),
    );
  }

  // Entities (coordinates in mm)
  const ents: DxfTag[] = [];
  const base = (type: string, layer: string) => [
    t(0, type),
    t(5, handle()),
    t(330, modelSpace),
    t(100, 'AcDbEntity'),
    t(8, layer),
  ];
  const mm = (p: Point): [number, number] => [
    Math.round(p[0] * MM * 100) / 100,
    Math.round(p[1] * MM * 100) / 100,
  ];
  const polyline = (layer: string, pts: [number, number][], closed: boolean) =>
    ents.push(
      ...base('LWPOLYLINE', layer),
      t(100, 'AcDbPolyline'),
      t(90, pts.length),
      t(70, closed ? 1 : 0),
      ...pts.flatMap(([x, y]) => [t(10, x), t(20, y)]),
    );
  const line = (layer: string, a: [number, number], b: [number, number]) =>
    ents.push(
      ...base('LINE', layer),
      t(100, 'AcDbLine'),
      t(10, a[0]),
      t(20, a[1]),
      t(30, 0),
      t(11, b[0]),
      t(21, b[1]),
      t(31, 0),
    );
  const text = (
    layer: string,
    at: [number, number],
    height: number,
    s: string,
    data?: Record<string, string>,
  ) =>
    ents.push(
      ...base('TEXT', layer),
      t(100, 'AcDbText'),
      t(10, at[0]),
      t(20, at[1]),
      t(30, 0),
      t(40, height),
      t(1, s),
      t(72, 1),
      t(11, at[0]),
      t(21, at[1]),
      t(31, 0),
      t(100, 'AcDbText'),
      t(73, 2),
      ...(data
        ? [t(1001, 'PLANCRAFT'), ...Object.entries(data).map(([k, v]) => t(1000, `${k}=${v}`))]
        : []),
    );
  const insert = (
    layer: string,
    block: string,
    at: [number, number],
    rotation: number,
    sx: number,
    sy: number,
  ) =>
    ents.push(
      ...base('INSERT', layer),
      t(100, 'AcDbBlockReference'),
      t(2, block),
      t(10, at[0]),
      t(20, at[1]),
      t(30, 0),
      t(41, sx),
      t(42, sy),
      t(43, 1),
      t(50, rotation),
    );

  // Plot and setbacks
  polyline(layerName('plot'), plan.plot.polygon.map(mm), true);
  const sides = setbackSides(plan.meta.facing);
  const p = plan.plot.polygon;
  const axisRect =
    p.length === 4 && p.every((q, i) => q[0] === p[(i + 1) % 4]![0] || q[1] === p[(i + 1) % 4]![1]);
  if (sides && axisRect) {
    const xs = p.map((q) => q[0]);
    const ys = p.map((q) => q[1]);
    const inset: Record<string, number> = {};
    for (const key of ['front', 'rear', 'left', 'right'] as const)
      inset[sides[key]] = plan.setbacks[key];
    const x0 = Math.min(...xs) + inset.west!;
    const x1 = Math.max(...xs) - inset.east!;
    const y0 = Math.min(...ys) + inset.south!;
    const y1 = Math.max(...ys) - inset.north!;
    if (x1 > x0 && y1 > y0)
      polyline(
        layerName('setback'),
        [mm([x0, y0]), mm([x1, y0]), mm([x1, y1]), mm([x0, y1])],
        true,
      );
  }

  // Walls, as joined outlines per wall layer
  for (const [kind, loops] of wallOutlines(level, (w) => WALL_LAYER[w.type])) {
    for (const loop of loops)
      polyline(
        layerName(kind),
        loop.map(([x, y]) => mm([x / GRID, y / GRID])),
        true,
      );
  }

  // Openings: unit symbols, scaled to the opening (and the wall thickness for windows)
  for (const o of values(level.openings)) {
    const w = level.walls[o.wall];
    if (!w) continue;
    const len = Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]);
    const u: Point = [(w.end[0] - w.start[0]) / len, (w.end[1] - w.start[1]) / len];
    const along = (d: number): Point => [w.start[0] + u[0] * d, w.start[1] + u[1] * d];
    const angle = (Math.atan2(u[1], u[0]) * 180) / Math.PI;
    const width = o.width * MM;
    if (o.kind === 'door') {
      // Hinge at the opening's start for "-left", at its end for "-right"; "in" swings to the
      // left of the wall's direction, "out" to the right.
      const right = o.swing.endsWith('right');
      const sign = o.swing.startsWith('in') ? 1 : -1;
      insert(
        layerName('door'),
        'DOOR',
        mm(along(right ? o.offset + o.width : o.offset)),
        angle,
        right ? -width : width,
        sign * width,
      );
    } else if (o.kind === 'opening') {
      insert(layerName('door'), 'OPENING', mm(along(o.offset)), angle, width, width);
    } else {
      insert(
        layerName('window'),
        o.kind === 'window' ? 'WINDOW' : 'VENTILATOR',
        mm(along(o.offset)),
        angle,
        width,
        w.thickness * MM,
      );
    }
  }

  // Stairs: outline, treads every 25 cm across the longer side, and the direction
  for (const s of values(level.stairs)) {
    const symbol = stairSymbol(s);
    polyline(layerName('stair'), s.polygon.map(mm), true);
    for (const [a, b] of symbol.treads) line(layerName('stair'), mm(a), mm(b));
    text(layerName('stair'), mm(symbol.labelAt), 150, symbol.label);
  }

  // Columns
  for (const c of values(level.columns))
    polyline(layerName('column'), columnCorners(c).map(mm), true);

  // Room separators: unbuilt room boundaries, dashed
  for (const sep of values(level.separators))
    line(layerName('separator'), mm(sep.start), mm(sep.end));

  // Room names and areas; the type rides along as PlanCraft data so a re-import keeps it
  const areas = new Map(deriveRooms(level).rooms.map((r) => [r.room_id, r.area_m2]));
  for (const room of values(level.rooms)) {
    const name = room.name || roomTypeLabel(room.type);
    text(layerName('room_label'), mm(room.seed), 150, name, { type: room.type, name, id: room.id });
    const area = areas.get(room.id);
    if (area !== undefined)
      text(
        layerName('room_label'),
        mm([room.seed[0], room.seed[1] - 25]),
        100,
        `${area.toFixed(2)} m²`,
      );
  }

  const plotXs = p.map((q) => q[0]);
  const plotYs = p.map((q) => q[1]);
  const ext = {
    min: mm([Math.min(...plotXs), Math.min(...plotYs)]),
    max: mm([Math.max(...plotXs), Math.max(...plotYs)]),
  };
  text(
    layerName('text'),
    [(ext.min[0] + ext.max[0]) / 2, ext.min[1] - 600],
    250,
    plan.meta.name || 'Plan',
  );

  // Assemble: layers into the LAYER table, entities into ENTITIES, then the header
  const out = [...all];
  const [entStart, entEnd] = sectionRange(out, 'ENTITIES');
  out.splice(entStart, entEnd - entStart, ...ents);
  const [, layerEnd] = tableRange(out, 'LAYER');
  out.splice(layerEnd, 0, ...layerRecords);
  const [tableStart] = tableRange(out, 'LAYER');
  const countAt = tableStart + out.slice(tableStart).findIndex((x) => x.code === 70);
  out[countAt] = t(70, Number(out[countAt]!.value) + seen.size);
  const height = Math.max(ext.max[1] - ext.min[1], (ext.max[0] - ext.min[0]) * 0.6) * 1.2;
  const vport = out.findIndex((x) => x.code === 2 && tagString(x).toUpperCase() === '*ACTIVE');
  if (vport >= 0) {
    for (let i = vport; i < out.length && out[i]!.code !== 0; i++) {
      if (out[i]!.code === 12) out[i] = t(12, (ext.min[0] + ext.max[0]) / 2);
      if (out[i]!.code === 22) out[i] = t(22, (ext.min[1] + ext.max[1]) / 2);
      if (out[i]!.code === 40) out[i] = t(40, height);
    }
  }
  setHeader(out, '$EXTMIN', [t(10, ext.min[0]), t(20, ext.min[1]), t(30, 0)]);
  setHeader(out, '$EXTMAX', [t(10, ext.max[0]), t(20, ext.max[1]), t(30, 0)]);
  setHeader(out, '$HANDSEED', [t(5, nextHandle.toString(16).toUpperCase())]);

  const dxf = writeDxfAscii(out);
  const back = importDxf(dxf, { units: 'mm', name: plan.meta.name });
  const mismatches = compare(plan, back.plan);
  return { ok: mismatches.length === 0, dxf, check: { mismatches } };
}
