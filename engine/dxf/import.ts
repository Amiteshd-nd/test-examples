import {
  buildArrangement,
  pointInRing,
  pruneDangling,
  traceFaces,
  vecFromCm,
} from '../geometry/planar.ts';
import { deriveRooms, JOIN_TOLERANCE_MM, type DerivedRoom } from '../rooms/derive.ts';
import { orderBetween, toMap } from '../schema/collections.ts';
import type { Column, Level, Opening, Plan, Room, Separator, Stair, Wall } from '../schema/plan.ts';
import { RoomType } from '../schema/room-types.ts';
import { setbackSides, type Side } from '../schema/sides.ts';
import {
  roundCm,
  type Point,
  type ProvenanceKind,
  type ProvenanceMap,
} from '../schema/primitives.ts';
import type { Issue } from '../schema/rule.ts';
import { CURRENT_SCHEMA_VERSION } from '../schema/version.ts';
import { validatePlan } from '../validate/validate.ts';
import { boundsOf, readDrawing, type Bounds, type Drawing, type Xy } from './drawing.ts';
import {
  DEFAULT_IMPORT_MAPPING,
  layerRole,
  matchesAny,
  matchRoomLabel,
  normalizeLabel,
  type ImportMapping,
  type LayerRole,
} from './mapping.ts';
import { dxfErrorMessage, parseAsciiText, parseDxf } from './tags.ts';
import { detectWalls, type FaceLine, type OpeningEvidence, type WallDetection } from './walls.ts';

// DXF import (P1.2): one importer for browser uploads and the bulk runner (`tools/bulk-import`).
// It reads what it can, says what it guessed (with provenance) and what failed, and never
// invents data silently. The founder's sample drawings will tune the mapping (P1.2 🛑).

export type UnitName = 'mm' | 'cm' | 'm' | 'in' | 'ft';
const UNIT_TO_CM: Record<UnitName, number> = { mm: 0.1, cm: 1, m: 100, in: 2.54, ft: 30.48 };
const INSUNITS: Record<number, UnitName> = { 1: 'in', 2: 'ft', 4: 'mm', 5: 'cm', 6: 'm' };
const UNIT_NAMES: Record<UnitName, string> = {
  mm: 'millimetres',
  cm: 'centimetres',
  m: 'metres',
  in: 'inches',
  ft: 'feet',
};

export interface ImportOptions {
  /** Plan name, usually the file name. */
  name?: string;
  mapping?: ImportMapping;
  /** Drawing units when known; otherwise read from the file or inferred. */
  units?: UnitName;
  maxTags?: number;
}

export type ReportOutcome = 'found' | 'guessed' | 'failed' | 'note';
export type ReportTopic =
  'file' | 'units' | 'walls' | 'openings' | 'rooms' | 'stairs' | 'columns' | 'plot' | 'plan';

export interface ReportItem {
  outcome: ReportOutcome;
  topic: ReportTopic;
  message: string;
  object_ids?: string[];
}

export interface ConversionReport {
  name: string;
  /** success: imported cleanly; partial: imported with failures or check errors; failed: no plan. */
  status: 'success' | 'partial' | 'failed';
  units: { unit: UnitName; provenance: ProvenanceKind; reason: string } | null;
  counts: Record<
    'walls' | 'doors' | 'windows' | 'ventilators' | 'openings' | 'rooms' | 'stairs' | 'columns',
    number
  >;
  items: ReportItem[];
  /** Plan check issues of the imported plan (`validatePlan`). */
  issues: Issue[];
}

export interface ImportResult {
  plan: Plan | null;
  report: ConversionReport;
  /** Derived room outlines of the imported plan. */
  rooms: DerivedRoom[];
  /** The drawing's own lines in plan coordinates (cm), for a comparison preview. */
  underlay: [Point, Point][];
}

const BLOCK_KINDS = [
  ['doors', 'door'],
  ['windows', 'window'],
  ['ventilators', 'ventilator'],
  ['openings', 'opening'],
] as const;

const EMPTY_COUNTS: ConversionReport['counts'] = {
  walls: 0,
  doors: 0,
  windows: 0,
  ventilators: 0,
  openings: 0,
  rooms: 0,
  stairs: 0,
  columns: 0,
};

const scaleXy = (p: Xy, s: number): Xy => [p[0] * s, p[1] * s];
const scaleBounds = (b: Bounds, s: number): Bounds => ({
  min: scaleXy(b.min, s),
  max: scaleXy(b.max, s),
});
const inBounds = (p: Xy, b: Bounds, margin = 0) =>
  p[0] >= b.min[0] - margin &&
  p[0] <= b.max[0] + margin &&
  p[1] >= b.min[1] - margin &&
  p[1] <= b.max[1] + margin;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function segmentDistance(a: Xy, b: Xy, c: Xy, d: Xy): number {
  const toSeg = (p: Xy, s: Xy, e: Xy) => {
    const dx = e[0] - s[0];
    const dy = e[1] - s[1];
    const len2 = dx * dx + dy * dy;
    const t =
      len2 === 0 ? 0 : Math.min(1, Math.max(0, ((p[0] - s[0]) * dx + (p[1] - s[1]) * dy) / len2));
    return Math.hypot(p[0] - s[0] - t * dx, p[1] - s[1] - t * dy);
  };
  const cross = (o: Xy, p: Xy, q: Xy) =>
    (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
  return Math.min(toSeg(a, c, d), toSeg(b, c, d), toSeg(c, a, b), toSeg(d, a, b));
}

/** Groups items whose bounds touch (within `margin`). */
function clusterBounds<T>(items: T[], boundsOf_: (t: T) => Bounds, margin: number): T[][] {
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const bs = items.map(boundsOf_);
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = bs[i]!;
      const b = bs[j]!;
      if (
        a.min[0] - margin <= b.max[0] &&
        b.min[0] - margin <= a.max[0] &&
        a.min[1] - margin <= b.max[1] &&
        b.min[1] - margin <= a.max[1]
      ) {
        parent[find(i)] = find(j);
      }
    }
  }
  const groups = new Map<number, T[]>();
  items.forEach((it, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), it]));
  return [...groups.values()];
}

function polygonArea(points: Xy[]): number {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const q = points[(i + 1) % points.length]!;
    s += p[0] * q[1] - q[0] * p[1];
  }
  return s / 2;
}

function failed(name: string, message: string, items: ReportItem[] = []): ImportResult {
  return {
    plan: null,
    rooms: [],
    underlay: [],
    report: {
      name,
      status: 'failed',
      units: null,
      counts: { ...EMPTY_COUNTS },
      items: [...items, { outcome: 'failed', topic: 'file', message }],
      issues: [],
    },
  };
}

interface WallSetup {
  layer: string | null;
  unit: UnitName;
  detection: WallDetection;
}

/** `input` is the file's bytes, or its text when already decoded. */
export function importDxf(input: Uint8Array | string, options: ImportOptions = {}): ImportResult {
  const name = options.name ?? 'Imported plan';
  const mapping = options.mapping ?? DEFAULT_IMPORT_MAPPING;
  const items: ReportItem[] = [];
  const add = (
    outcome: ReportOutcome,
    topic: ReportTopic,
    message: string,
    object_ids?: string[],
  ) =>
    items.push(object_ids ? { outcome, topic, message, object_ids } : { outcome, topic, message });

  const limits = options.maxTags === undefined ? {} : { maxTags: options.maxTags };
  const parsed =
    typeof input === 'string' ? parseAsciiText(input, limits) : parseDxf(input, limits);
  if (!parsed.ok) return failed(name, dxfErrorMessage(parsed.error));
  for (const w of parsed.warnings) add('guessed', 'file', w);

  const drawing = readDrawing(parsed.tags);
  for (const w of drawing.warnings) add('note', 'file', w);
  const ignoredTypes = Object.entries(drawing.ignored).sort((a, b) => b[1] - a[1]);
  if (ignoredTypes.length) {
    add(
      'note',
      'file',
      `Not read (PlanCraft redraws these): ${ignoredTypes.map(([t, n]) => `${n} ${t}`).join(', ')}.`,
    );
  }
  if (drawing.hidden)
    add('note', 'file', `${plural(drawing.hidden, 'object')} on hidden or frozen layers left out.`);

  const roles = new Map<string, LayerRole | null>();
  const roleOf = (layer: string) => {
    if (!roles.has(layer)) roles.set(layer, layerRole(mapping, layer));
    return roles.get(layer)!;
  };

  // --- Units and walls -------------------------------------------------------------------
  const evidenceIn = (d: Drawing): OpeningEvidence[] => {
    const ev: OpeningEvidence[] = [];
    for (const ins of d.inserts) {
      if (!ins.bounds) continue;
      const byBlock = BLOCK_KINDS.find(([k]) => matchesAny(mapping.blocks[k], ins.block))?.[1];
      const role = roleOf(ins.layer);
      const byLayer =
        role === 'doors'
          ? 'door'
          : role === 'windows'
            ? 'window'
            : role === 'ventilators'
              ? 'ventilator'
              : null;
      const kind = byBlock ?? byLayer;
      if (kind) ev.push({ kind, bounds: ins.bounds, source: `block "${ins.block}"` });
    }
    const loose = d.segments.filter((s) =>
      ['doors', 'windows', 'ventilators'].includes(roleOf(s.layer) ?? ''),
    );
    for (const group of clusterBounds(loose, (s) => boundsOf([s.a, s.b])!, 2)) {
      const role = roleOf(group[0]!.layer)!;
      ev.push({
        kind: role === 'doors' ? 'door' : role === 'windows' ? 'window' : 'ventilator',
        bounds: boundsOf(group.flatMap((s) => [s.a, s.b]))!,
        source: `lines on layer "${group[0]!.layer}"`,
      });
    }
    return ev;
  };
  const evidenceRaw = evidenceIn(drawing);

  const straight = (layerTest: (l: string) => boolean) =>
    drawing.segments
      .filter((s) => !s.curved && layerTest(s.layer))
      .map((s): FaceLine => ({ a: s.a, b: s.b, tag: s.layer }));
  const detectAt = (faces: FaceLine[], unit: UnitName) => {
    const s = UNIT_TO_CM[unit];
    return detectWalls(
      faces.map((f) => ({ ...f, a: scaleXy(f.a, s), b: scaleXy(f.b, s) })),
      evidenceRaw.map((e) => ({ ...e, bounds: scaleBounds(e.bounds, s) })),
      {
        minThickness: mapping.wall_thickness_cm.min,
        maxThickness: mapping.wall_thickness_cm.max,
        maxOpeningWithSymbol: mapping.max_opening_with_symbol_cm,
        maxPlainOpening: mapping.max_plain_opening_cm,
      },
    );
  };
  const plausibleUnits = (faces: FaceLine[]): UnitName[] => {
    if (options.units) return [options.units];
    const b = boundsOf(faces.flatMap((f) => [f.a, f.b]));
    if (!b) return [];
    const extent = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1]);
    return (Object.keys(UNIT_TO_CM) as UnitName[]).filter((u) => {
      const cm = extent * UNIT_TO_CM[u];
      return cm >= 200 && cm <= 20000;
    });
  };
  const bestFor = (faces: FaceLine[], layer: string | null): WallSetup | null => {
    let best: WallSetup | null = null;
    const header = drawing.insunits !== null ? INSUNITS[drawing.insunits] : undefined;
    for (const unit of plausibleUnits(faces)) {
      const detection = detectAt(faces, unit);
      if (detection.walls.length === 0) continue;
      // The file's own unit wins unless another reading pairs far more of the lines.
      const score = (detection.pairedLength / UNIT_TO_CM[unit]) * (unit === header ? 1.5 : 1);
      const bestScore = best
        ? (best.detection.pairedLength / UNIT_TO_CM[best.unit]) * (best.unit === header ? 1.5 : 1)
        : -1;
      if (score > bestScore) best = { layer, unit, detection };
    }
    return best;
  };

  const curvedWalls = drawing.segments.filter(
    (s) => s.curved && roleOf(s.layer) === 'walls',
  ).length;
  if (curvedWalls)
    add(
      'note',
      'walls',
      `${plural(curvedWalls, 'curved wall piece')} skipped: curved walls are not supported yet.`,
    );

  let setup = bestFor(
    straight((l) => roleOf(l) === 'walls'),
    null,
  );
  if (!setup) {
    // No wall layer recognised: try each unclaimed layer and keep the one with most wall-like pairs.
    const candidates = [...new Set(drawing.segments.map((s) => s.layer))].filter(
      (l) => roleOf(l) === null,
    );
    for (const layer of candidates) {
      const faces = straight((l) => l === layer);
      if (faces.length < 4) continue;
      const found = bestFor(faces, layer);
      if (
        found &&
        (!setup ||
          found.detection.pairedLength / UNIT_TO_CM[found.unit] >
            setup.detection.pairedLength / UNIT_TO_CM[setup.unit])
      ) {
        setup = found;
      }
    }
    if (!setup) {
      const layers = [...new Set(drawing.segments.map((s) => s.layer))].sort();
      return failed(
        name,
        `No walls found. Walls are read as pairs of parallel lines ${mapping.wall_thickness_cm.min}–${mapping.wall_thickness_cm.max} cm apart on a wall layer. Layers in this file: ${layers.join(', ') || 'none'}. Add the wall layer to the import mapping.`,
        items,
      );
    }
    add(
      'guessed',
      'walls',
      `No layer is named as a wall layer in the mapping; walls were taken from layer "${setup.layer}", which has the most parallel line pairs.`,
    );
  }

  const unit = setup.unit;
  const headerUnit = drawing.insunits !== null ? INSUNITS[drawing.insunits] : undefined;
  const units: ConversionReport['units'] = options.units
    ? { unit, provenance: 'measured', reason: 'Set when importing.' }
    : unit === headerUnit
      ? { unit, provenance: 'measured', reason: 'From the drawing header ($INSUNITS).' }
      : {
          unit,
          provenance: 'inferred',
          reason: headerUnit
            ? `The header says ${UNIT_NAMES[headerUnit]}, but ${UNIT_NAMES[unit]} give realistic wall thicknesses.`
            : `No unit in the header; ${UNIT_NAMES[unit]} give realistic wall thicknesses and plan size.`,
        };
  add(
    units.provenance === 'measured' ? 'found' : 'guessed',
    'units',
    `Drawing units: ${UNIT_NAMES[unit]}. ${units.reason}`,
  );
  const k = UNIT_TO_CM[unit];
  const detection = setup.detection;
  if (detection.unpairedLength > 100) {
    add(
      'note',
      'walls',
      `${(detection.unpairedLength / 100).toFixed(1)} m of wall lines found no parallel partner (wall ends, jambs, single-line or very thick walls).`,
    );
  }

  // --- Main building: the largest group of connected walls --------------------------------
  const dw = detection.walls;
  const parent = dw.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  for (let i = 0; i < dw.length; i++) {
    for (let j = i + 1; j < dw.length; j++) {
      if (segmentDistance(dw[i]!.start, dw[i]!.end, dw[j]!.start, dw[j]!.end) <= 1)
        parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, number[]>();
  dw.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]));
  const length = (i: number) =>
    Math.hypot(dw[i]!.end[0] - dw[i]!.start[0], dw[i]!.end[1] - dw[i]!.start[1]);
  const ranked = [...groups.values()].sort(
    (a, b) => b.reduce((s, i) => s + length(i), 0) - a.reduce((s, i) => s + length(i), 0),
  );
  const boundsOfGroup = (g: number[]) => boundsOf(g.flatMap((i) => [dw[i]!.start, dw[i]!.end]))!;
  const largest = boundsOfGroup(ranked[0]!);

  // --- Plot: the plot outline around the largest drawing; wall groups inside it belong to it ---
  const centre: Xy = [(largest.min[0] + largest.max[0]) / 2, (largest.min[1] + largest.max[1]) / 2];
  const plotShape = drawing.shapes
    .filter((s) => roleOf(s.layer) === 'plot')
    .map((s) => s.points.map((p) => scaleXy(p, k)))
    .filter((pts) => pointInRing(vecFromCm(centre), pts.map(vecFromCm)) === 'inside')
    .sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)))[0];
  const plotBox = plotShape ? boundsOf(plotShape)! : null;
  const included = plotBox
    ? ranked.filter(
        (g, n) =>
          n === 0 ||
          (inBounds(boundsOfGroup(g).min, plotBox, 50) &&
            inBounds(boundsOfGroup(g).max, plotBox, 50)),
      )
    : [ranked[0]!];
  const main = included.flat().map((i) => dw[i]!);
  const others = ranked.filter(
    (g) => !included.includes(g) && g.reduce((s, i) => s + length(i), 0) > 100,
  );
  if (others.length) {
    add(
      'guessed',
      'plan',
      `Imported the ${plotBox ? 'walls inside the plot' : 'largest connected drawing'} (${plural(main.length, 'wall')}); left out ${plural(others.length, 'other wall group')} (other floors, sections or a site plan?).`,
    );
  }
  const building = boundsOf(main.flatMap((w) => [w.start, w.end]))!;
  const plotBounds = plotBox ?? building;
  const origin = plotBounds.min;
  const at = (p: Xy): Point => [roundCm(p[0] - origin[0]), roundCm(p[1] - origin[1])];

  // --- Walls and openings ------------------------------------------------------------------
  const walls: Wall[] = [];
  const wallTags = new Map<Wall, string[]>();
  const openings: Opening[] = [];
  const counter = { D: 0, N: 0, V: 0, O: 0 };
  const evidenceSources = new Map<string, number>();
  for (const w of main) {
    const start = at(w.start);
    const end = at(w.end);
    const len = Math.hypot(end[0] - start[0], end[1] - start[1]);
    if (len < 0.1) continue;
    const id = `W${walls.length + 1}`;
    const wall: Wall = {
      id,
      start,
      end,
      thickness: Math.max(0.1, roundCm(w.thickness)),
      type: 'internal',
    };
    walls.push(wall);
    wallTags.set(wall, w.tags);
    for (const o of w.openings) {
      const offset = Math.max(0, roundCm(o.offset));
      const width = roundCm(Math.min(o.width, len - offset));
      if (width <= 0) continue;
      const base = { wall: id, offset, width };
      if (o.evidence) evidenceSources.set(o.evidence, (evidenceSources.get(o.evidence) ?? 0) + 1);
      if (o.kind === 'door') {
        openings.push({
          id: `D${++counter.D}`,
          kind: 'door',
          ...base,
          swing: mapping.defaults.door_swing,
          provenance: {
            swing: { provenance: 'assumed', reason: 'Door swing is not read from drawings yet.' },
          },
        });
      } else if (o.kind === 'window') {
        openings.push({
          id: `N${++counter.N}`,
          kind: 'window',
          ...base,
          sill: mapping.defaults.window_sill_cm,
          provenance: { sill: { provenance: 'assumed', reason: 'Default sill height.' } },
        });
      } else if (o.kind === 'ventilator') {
        openings.push({
          id: `V${++counter.V}`,
          kind: 'ventilator',
          ...base,
          sill: mapping.defaults.ventilator_sill_cm,
          provenance: { sill: { provenance: 'assumed', reason: 'Default sill height.' } },
        });
      } else {
        openings.push({
          id: `O${++counter.O}`,
          kind: 'opening',
          ...base,
          provenance: {
            kind: {
              provenance: 'inferred',
              reason: 'Gap in the wall with no door or window symbol.',
            },
          },
        });
      }
    }
  }

  // Wall types named by layer (e.g. A-WALL-INT, compound, parapet) win; the rest go by position.
  const layerType = new Map<Wall, Wall['type'] | null>();
  for (const w of walls) {
    const types = new Set(
      wallTags
        .get(w)!
        .map(
          (layer) =>
            (['internal', 'parapet', 'compound'] as const).find((ty) =>
              matchesAny(mapping.wall_types[ty], layer),
            ) ?? null,
        ),
    );
    const [only] = [...types];
    layerType.set(w, types.size === 1 && only ? only : null);
  }
  // External walls lie on the outer outline of a group of walls that doesn't stand inside
  // another group's room (a free-standing duct is internal). Compound and parapet walls don't
  // enclose the building for this purpose.
  const enclosing = walls.filter(
    (w) => layerType.get(w) !== 'compound' && layerType.get(w) !== 'parapet',
  );
  const arrangement = pruneDangling(
    buildArrangement(
      enclosing.map((w) => ({ a: vecFromCm(w.start), b: vecFromCm(w.end), data: w })),
      JOIN_TOLERANCE_MM,
    ),
  );
  const faces = traceFaces(arrangement);
  const boundedFaces = faces.filter((f) => f.area2 > 0);
  for (const outline of faces.filter((f) => f.area2 < 0)) {
    const nested = boundedFaces.some(
      (f) =>
        f.component !== outline.component &&
        pointInRing(outline.vertices[0]!, f.vertices) === 'inside',
    );
    if (nested) continue;
    for (const e of outline.edges)
      for (const w of arrangement.edges[e.edge]!.data) w.type = 'external';
  }
  for (const w of walls) {
    const typed = layerType.get(w);
    if (typed) {
      w.type = typed;
      w.provenance = {
        type: {
          provenance: 'measured',
          reason: `From its layer (${wallTags.get(w)!.join(', ')}).`,
        },
      };
    } else {
      w.provenance = {
        type: {
          provenance: 'inferred',
          reason:
            w.type === 'external'
              ? 'On the outer outline of the building.'
              : 'Inside the building outline.',
        },
      };
    }
  }
  const ext = walls.filter((w) => w.type === 'external').length;
  add(
    'found',
    'walls',
    `${plural(walls.length, 'wall')} (${ext} external, ${walls.length - ext} internal), thickness ${[...new Set(walls.map((w) => w.thickness))].sort((a, b) => a - b).join(' / ')} cm.`,
  );
  for (const kind of ['door', 'window', 'ventilator'] as const) {
    const n = openings.filter((o) => o.kind === kind).length;
    if (n) add('found', 'openings', `${plural(n, kind)}.`);
  }
  if (evidenceSources.size) {
    add(
      'note',
      'openings',
      `Opening symbols: ${[...evidenceSources].map(([s, n]) => `${n} × ${s}`).join(', ')}.`,
    );
  }
  const plain = openings.filter((o) => o.kind === 'opening');
  if (plain.length) {
    add(
      'guessed',
      'openings',
      `${plural(plain.length, 'gap')} in walls without a door or window symbol read as plain openings (up to ${mapping.max_plain_opening_cm} cm wide).`,
      plain.map((o) => o.id),
    );
  }
  add('guessed', 'openings', 'Door swings and sill heights are defaults (marked "assumed").');

  // --- Rooms ---------------------------------------------------------------------------------
  const rooms: Room[] = [];
  for (const t of drawing.texts) {
    const role = roleOf(t.layer);
    if (role === 'ignore') continue;
    const p = scaleXy(t.at, k);
    if (!inBounds(p, building, 10)) continue;
    if (normalizeLabel(t.text) === '' && !t.data?.type) continue; // sizes, numbers, symbols
    // A label PlanCraft wrote carries the room's type; others are matched by name.
    const stored = RoomType.safeParse(t.data?.type);
    const match = stored.success
      ? { type: stored.data, phrase: '' }
      : matchRoomLabel(mapping, t.text);
    if (!match) {
      if (role === 'room_labels')
        add(
          'failed',
          'rooms',
          `Room label "${t.text.replace(/\n/g, ' ')}" is not in the mapping, so its room was not imported.`,
        );
      continue;
    }
    const nameLine =
      t.data?.name ?? t.text.split('\n').find((l) => normalizeLabel(l) !== '') ?? t.text;
    rooms.push({
      id: `R${rooms.length + 1}`,
      type: match.type,
      name: nameLine,
      seed: at(p),
      behavior: 'fixed',
      locked: false,
      ...(stored.success
        ? {}
        : {
            provenance: {
              type: {
                provenance: 'inferred' as const,
                reason: `Label "${nameLine}" matched "${match.phrase}".`,
              },
            },
          }),
    });
  }

  // --- Stairs and columns --------------------------------------------------------------------
  const stairSegs = drawing.segments
    .filter((s) => roleOf(s.layer) === 'stairs')
    .map((s) => ({ a: scaleXy(s.a, k), b: scaleXy(s.b, k) }))
    .filter((s) => inBounds(s.a, building, 50));
  const stairs: Stair[] = [];
  for (const group of clusterBounds(stairSegs, (s) => boundsOf([s.a, s.b])!, 10)) {
    const b = boundsOf(group.flatMap((s) => [s.a, s.b]))!;
    if ((b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) < 5000) continue;
    const words = drawing.texts
      .filter((t) => inBounds(scaleXy(t.at, k), b, 20))
      .map((t) => normalizeLabel(t.text));
    const down = words.some((w) => /\b(DN|DOWN)\b/.test(w));
    const up = words.some((w) => /\bUP\b/.test(w));
    stairs.push({
      id: `S${stairs.length + 1}`,
      polygon: [at(b.min), at([b.max[0], b.min[1]]), at(b.max), at([b.min[0], b.max[1]])],
      direction: down && !up ? 'down' : 'up',
      provenance: {
        polygon: { provenance: 'inferred', reason: 'Outline around the stair lines.' },
        direction:
          up || down
            ? { provenance: 'inferred', reason: 'From an UP/DN label.' }
            : { provenance: 'assumed', reason: 'No UP/DN label.' },
      },
    });
  }
  if (stairs.length)
    add(
      'found',
      'stairs',
      `${plural(stairs.length, 'stair')} (outline around the stair lines).`,
      stairs.map((s) => s.id),
    );

  const columns: Column[] = [];
  for (const shape of drawing.shapes.filter((s) => roleOf(s.layer) === 'columns')) {
    const b = boundsOf(shape.points.map((p) => scaleXy(p, k)))!;
    const w = roundCm(b.max[0] - b.min[0]);
    const h = roundCm(b.max[1] - b.min[1]);
    if (w < 5 || h < 5 || w > 200 || h > 200) continue;
    columns.push({
      id: `C${columns.length + 1}`,
      at: at([(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2]),
      size: [w, h],
      rotation_deg: 0,
    });
  }
  if (columns.length)
    add('found', 'columns', `${plural(columns.length, 'column')} (as axis-aligned boxes).`);

  // --- Assemble, then drop rooms whose label doesn't sit in a closed room -------------------
  // Room separators: unbuilt boundaries drawn on a separator layer (A2, M3).
  const separators: Separator[] = drawing.segments
    .filter((s) => !s.curved && roleOf(s.layer) === 'separators')
    .map((s) => ({ a: at(scaleXy(s.a, k)), b: at(scaleXy(s.b, k)) }))
    .filter((s) => s.a[0] !== s.b[0] || s.a[1] !== s.b[1])
    .map((s, i) => ({ id: `SP${i + 1}`, start: s.a, end: s.b }));
  if (separators.length)
    add('found', 'rooms', `${plural(separators.length, 'room separator line')}.`);

  const level: Level = {
    id: 'L0',
    name: 'Ground',
    order: orderBetween(),
    elevation: 0,
    height: mapping.defaults.level_height_cm,
    walls: toMap(walls),
    separators: toMap(separators),
    rooms: toMap(rooms),
    openings: toMap(openings),
    stairs: toMap(stairs),
    columns: toMap(columns),
    fixtures: {},
    lines: {},
    dimensions: {},
    texts: {},
    hatches: {},
  };
  const firstPass = deriveRooms(level);
  const badRooms = new Set(
    firstPass.issues
      .filter((i) =>
        [
          'geometry.room_seed_not_enclosed',
          'geometry.room_seed_in_wall',
          'geometry.room_too_small_for_walls',
        ].includes(i.rule_id),
      )
      .flatMap((i) => i.object_ids),
  );
  for (const r of rooms.filter((x) => badRooms.has(x.id))) {
    const why = firstPass.issues.find((i) => i.object_ids.includes(r.id))!;
    add('failed', 'rooms', `Room "${r.name}" was not imported: ${why.message}`, [r.id]);
  }
  const keptRooms = rooms.filter((r) => !badRooms.has(r.id));
  level.rooms = toMap(keptRooms);
  if (keptRooms.length) {
    add(
      'found',
      'rooms',
      `${plural(keptRooms.length, 'room')} from labels: ${keptRooms.map((r) => `"${r.name}"`).join(', ')}.`,
    );
  }

  const ONE_M2_AREA2 = 2 * 1_000_000; // face areas are doubled, in mm²
  const unlabelled = faces.filter(
    (f) =>
      f.area2 > ONE_M2_AREA2 &&
      !keptRooms.some((r) => pointInRing(vecFromCm(r.seed), f.vertices) === 'inside'),
  );
  if (unlabelled.length) {
    add(
      'failed',
      'rooms',
      `${plural(unlabelled.length, 'enclosed area')} of 1 m² or more ${unlabelled.length === 1 ? 'has' : 'have'} no room name, so ${unlabelled.length === 1 ? 'it was' : 'they were'} not imported as rooms.`,
    );
  }

  const bedroomLabels = keptRooms.filter(
    (r) => r.type === 'bedroom' || r.type === 'master_bedroom',
  ).length;
  // The plan format counts up to 20 bedrooms (BHK); a drawing of several flats can have more.
  const bedrooms = Math.min(bedroomLabels, 20);
  if (bedroomLabels > bedrooms)
    add(
      'note',
      'rooms',
      `${bedroomLabels} bedroom labels found; BHK is recorded as 20, the most a plan can hold.`,
    );
  const assumed = (reason: string) => ({ provenance: 'assumed' as const, reason });
  const plotPolygon: Point[] = plotShape
    ? plotShape.map(at)
    : [
        at(building.min),
        at([building.max[0], building.min[1]]),
        at(building.max),
        at([building.min[0], building.max[1]]),
      ];
  add(
    plotShape ? 'found' : 'guessed',
    'plot',
    plotShape
      ? 'Plot boundary from the plot layer.'
      : 'No plot boundary found; the plot is set to the building outline.',
  );

  const setbackProv: ProvenanceMap = {};
  for (const side of ['front', 'rear', 'left', 'right']) {
    setbackProv[side] = assumed(
      plotShape
        ? 'Measured from the plot boundary assuming the road is on the north side.'
        : 'No plot boundary in the drawing.',
    );
  }
  // Facing is assumed north (below), so the front is the north side of the plot.
  const sides = setbackSides('north')!;
  const gaps: Record<Side, number> = {
    north: plotBounds.max[1] - building.max[1],
    south: building.min[1] - plotBounds.min[1],
    east: plotBounds.max[0] - building.max[0],
    west: building.min[0] - plotBounds.min[0],
  };
  const gap = (side: Side) => Math.max(0, roundCm(gaps[side]));
  const plan: Plan = {
    schema_version: CURRENT_SCHEMA_VERSION,
    meta: {
      name,
      bhk: bedrooms,
      floors: 1,
      facing: 'north',
      vastu: false,
      city: mapping.defaults.city,
      display_units: 'm',
      source: 'library',
      provenance: {
        bhk: { provenance: 'inferred', reason: 'Count of bedroom labels.' },
        floors: assumed('One floor read per drawing.'),
        facing: assumed('Facing is not read from drawings yet.'),
        vastu: assumed('Not stated in the drawing.'),
        city: assumed('Default city.'),
      },
    },
    plot: {
      polygon: plotPolygon,
      road_sides: [],
      provenance: plotShape
        ? { road_sides: assumed('Not read from drawings yet.') }
        : {
            polygon: assumed('No plot boundary in the drawing.'),
            road_sides: assumed('Not read from drawings yet.'),
          },
    },
    setbacks: {
      front: gap(sides.front),
      rear: gap(sides.rear),
      left: gap(sides.left),
      right: gap(sides.right),
      provenance: setbackProv,
    },
    levels: { [level.id]: level },
    rule_pack_ids: [],
  };
  add(
    'guessed',
    'plan',
    'Facing, floors and Vastu are not read from drawings yet (marked "assumed"); check them in the tag review.',
  );

  const checked = validatePlan(plan);
  const counts: ConversionReport['counts'] = {
    walls: walls.length,
    doors: counter.D,
    windows: counter.N,
    ventilators: counter.V,
    openings: counter.O,
    rooms: keptRooms.length,
    stairs: stairs.length,
    columns: columns.length,
  };
  const status = !checked.ok || items.some((i) => i.outcome === 'failed') ? 'partial' : 'success';
  const underlay = drawing.segments
    .filter((s) => roleOf(s.layer) !== 'ignore')
    .slice(0, 50_000)
    .map((s): [Point, Point] => [at(scaleXy(s.a, k)), at(scaleXy(s.b, k))]);
  return {
    plan: checked.plan ?? plan,
    rooms: checked.rooms,
    underlay,
    report: { name, status, units, counts, items, issues: checked.issues },
  };
}
