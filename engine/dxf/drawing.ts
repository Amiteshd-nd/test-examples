import {
  dxfRecords,
  dxfSections,
  tagInt,
  tagNumber,
  tagString,
  type DxfRecord,
  type DxfTag,
} from './tags.ts';

// Turns DXF tags into flat, world-coordinate drawing primitives: line segments, text and block
// references. Blocks are exploded (their geometry is placed where they are inserted); arcs and
// polyline bulges become short segments marked `curved`. Paper space, hidden layers and entity
// types we don't read are left out and counted. Units are the drawing's own (see `insunits`).

export type Xy = [number, number];
/** 2D affine map: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Affine = [number, number, number, number, number, number];

const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

export function applyAffine(m: Affine, [x, y]: Xy): Xy {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** `m` after `n`. */
function compose(m: Affine, n: Affine): Affine {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

const MIRROR_X: Affine = [-1, 0, 0, 1, 0, 0];

export interface Bounds {
  min: Xy;
  max: Xy;
}

export function boundsOf(points: Iterable<Xy>): Bounds | null {
  let b: Bounds | null = null;
  for (const [x, y] of points) {
    if (!b) b = { min: [x, y], max: [x, y] };
    else {
      b.min = [Math.min(b.min[0], x), Math.min(b.min[1], y)];
      b.max = [Math.max(b.max[0], x), Math.max(b.max[1], y)];
    }
  }
  return b;
}

export interface Segment {
  layer: string;
  a: Xy;
  b: Xy;
  /** Part of a flattened arc, circle or polyline bulge. */
  curved: boolean;
}

export interface TextItem {
  layer: string;
  /** Plain text: formatting codes removed, lines joined with "\n". */
  text: string;
  /** Estimated centre of the text. */
  at: Xy;
  height: number;
  /** `key=value` strings stored by PlanCraft as extended data (application "PLANCRAFT"). */
  data?: Record<string, string>;
}

export interface InsertItem {
  layer: string;
  block: string;
  at: Xy;
  /** Bounds of the block's geometry as placed. */
  bounds: Bounds | null;
}

export interface ClosedShape {
  layer: string;
  points: Xy[];
}

export interface Drawing {
  /** `$INSUNITS` (0 unitless, 1 in, 2 ft, 4 mm, 5 cm, 6 m), or null when absent. */
  insunits: number | null;
  layers: string[];
  segments: Segment[];
  texts: TextItem[];
  inserts: InsertItem[];
  /** Closed polylines and circles (as polygons), for columns and plot outlines. */
  shapes: ClosedShape[];
  /** Entity types we don't read → count. */
  ignored: Record<string, number>;
  /** Entities skipped because their layer is off or frozen. */
  hidden: number;
  warnings: string[];
}

const MAX_BLOCK_DEPTH = 16;
const ARC_STEP = Math.PI / 18; // 10° per flattened piece

interface Block {
  base: Xy;
  records: DxfRecord[];
}

const first = (tags: DxfTag[], code: number) => tags.find((t) => t.code === code);
const num = (tags: DxfTag[], code: number, fallback = 0) => {
  const t = first(tags, code);
  return t ? tagNumber(t) : fallback;
};
const str = (tags: DxfTag[], code: number, fallback = '') => {
  const t = first(tags, code);
  return t ? tagString(t) : fallback;
};

/** Removes MTEXT formatting and TEXT control codes; `\P` becomes a line break. */
export function plainText(raw: string): string {
  return raw
    .replace(/\\P/g, '\n')
    .replace(/\\[ACFHQTWfhcpqtw][^;]*;/g, '')
    .replace(/\\S([^;]*);/g, (_, s: string) => s.replace(/[#^]/g, '/'))
    .replace(/\\[LlOoKkNn]/g, '')
    .replace(/\\~/g, ' ')
    .replace(/\\([\\{}])/g, '$1')
    .replace(/(?<!\\)[{}]/g, '')
    .replace(/%%[cC]/g, 'Ø')
    .replace(/%%[dD]/g, '°')
    .replace(/%%[pP]/g, '±')
    .replace(/%%[uUoOkK]/g, '')
    .replace(/%%%/g, '%')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l !== '')
    .join('\n');
}

function arcPoints(c: Xy, r: number, a0: number, sweep: number): Xy[] {
  const n = Math.max(1, Math.ceil(Math.abs(sweep) / ARC_STEP));
  const pts: Xy[] = [];
  for (let k = 0; k <= n; k++) {
    const a = a0 + (sweep * k) / n;
    pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
  }
  return pts;
}

/** Points along a polyline piece from p to q with bulge b (tan of a quarter of the arc angle). */
function bulgePoints(p: Xy, q: Xy, b: number): Xy[] {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const c = Math.hypot(dx, dy);
  if (Math.abs(b) < 1e-9 || c === 0) return [p, q];
  const sweep = 4 * Math.atan(b);
  const d = ((c / 2) * (1 - b * b)) / (2 * b);
  const center: Xy = [(p[0] + q[0]) / 2 - (dy / c) * d, (p[1] + q[1]) / 2 + (dx / c) * d];
  const r = Math.hypot(p[0] - center[0], p[1] - center[1]);
  const pts = arcPoints(center, r, Math.atan2(p[1] - center[1], p[0] - center[0]), sweep);
  pts[0] = p;
  pts[pts.length - 1] = q;
  return pts;
}

export function readDrawing(tags: DxfTag[]): Drawing {
  const sections = new Map(dxfSections(tags).map((s) => [s.name.toUpperCase(), s.tags]));
  const drawing: Drawing = {
    insunits: null,
    layers: [],
    segments: [],
    texts: [],
    inserts: [],
    shapes: [],
    ignored: {},
    hidden: 0,
    warnings: [],
  };

  const header = sections.get('HEADER') ?? [];
  for (let i = 0; i < header.length; i++) {
    const t = header[i]!;
    if (t.code === 9 && tagString(t).trim() === '$INSUNITS' && header[i + 1]) {
      drawing.insunits = tagInt(header[i + 1]!);
    }
  }

  const hiddenLayers = new Set<string>();
  for (const rec of dxfRecords(sections.get('TABLES') ?? [])) {
    if (rec.type.trim() !== 'LAYER') continue;
    const name = str(rec.tags, 2);
    if (!name) continue;
    drawing.layers.push(name);
    if (num(rec.tags, 62, 7) < 0 || (num(rec.tags, 70) & 1) === 1)
      hiddenLayers.add(name.toUpperCase());
  }

  const blocks = new Map<string, Block>();
  let current: { name: string; block: Block } | null = null;
  for (const rec of dxfRecords(sections.get('BLOCKS') ?? [])) {
    const type = rec.type.trim();
    if (type === 'BLOCK') {
      current = {
        name: str(rec.tags, 2),
        block: { base: [num(rec.tags, 10), num(rec.tags, 20)], records: [] },
      };
    } else if (type === 'ENDBLK') {
      if (current) blocks.set(current.name.toUpperCase(), current.block);
      current = null;
    } else if (current) {
      current.block.records.push(rec);
    }
  }

  const ignore = (type: string) => (drawing.ignored[type] = (drawing.ignored[type] ?? 0) + 1);
  const stack: string[] = [];

  const emit = (records: DxfRecord[], m: Affine, parentLayer: string | null, topLevel: boolean) => {
    for (let i = 0; i < records.length; i++) {
      const rec = records[i]!;
      const type = rec.type.trim();
      const t = rec.tags;
      if (type === 'SEQEND' || type === 'VERTEX' || type === 'ATTRIB') continue; // read with their owner
      if (topLevel && num(t, 67) === 1) continue; // paper space
      const own = str(t, 8, '0');
      const layer = own === '0' && parentLayer !== null ? parentLayer : own;
      if (hiddenLayers.has(layer.toUpperCase())) {
        drawing.hidden++;
        continue;
      }
      // Entities defined in an object coordinate system with a downward extrusion are mirrored.
      const ocs = num(t, 230, 1) < 0 ? compose(m, MIRROR_X) : m;
      const seg = (a: Xy, b: Xy, curved: boolean, map: Affine) =>
        drawing.segments.push({ layer, a: applyAffine(map, a), b: applyAffine(map, b), curved });
      const chain = (pts: Xy[], curved: boolean, map: Affine) => {
        for (let k = 0; k + 1 < pts.length; k++) seg(pts[k]!, pts[k + 1]!, curved, map);
      };
      const polyline = (verts: { p: Xy; bulge: number }[], closed: boolean) => {
        const pts: Xy[] = [];
        const n = verts.length;
        for (let k = 0; k < (closed ? n : n - 1); k++) {
          const v = verts[k]!;
          const w = verts[(k + 1) % n]!;
          const piece = bulgePoints(v.p, w.p, v.bulge);
          chain(piece, Math.abs(v.bulge) > 1e-9, ocs);
          pts.push(...piece.slice(0, -1));
        }
        if (closed && n >= 3)
          drawing.shapes.push({ layer, points: pts.map((p) => applyAffine(ocs, p)) });
      };

      switch (type) {
        case 'LINE':
          seg([num(t, 10), num(t, 20)], [num(t, 11), num(t, 21)], false, m);
          break;
        case 'LWPOLYLINE': {
          const verts: { p: Xy; bulge: number }[] = [];
          for (const tag of t) {
            if (tag.code === 10) verts.push({ p: [tagNumber(tag), 0], bulge: 0 });
            else if (tag.code === 20 && verts.length)
              verts[verts.length - 1]!.p[1] = tagNumber(tag);
            else if (tag.code === 42 && verts.length)
              verts[verts.length - 1]!.bulge = tagNumber(tag);
          }
          polyline(verts, (num(t, 70) & 1) === 1);
          break;
        }
        case 'POLYLINE': {
          const flags = num(t, 70);
          const verts: { p: Xy; bulge: number }[] = [];
          let j = i + 1;
          for (; j < records.length && records[j]!.type.trim() === 'VERTEX'; j++) {
            const v = records[j]!.tags;
            verts.push({ p: [num(v, 10), num(v, 20)], bulge: num(v, 42) });
          }
          i = j - 1;
          if (flags & (8 | 16 | 64)) ignore('POLYLINE (3D/mesh)');
          else polyline(verts, (flags & 1) === 1);
          break;
        }
        case 'ARC': {
          const a0 = (num(t, 50) * Math.PI) / 180;
          let sweep = (num(t, 51) * Math.PI) / 180 - a0;
          while (sweep <= 0) sweep += 2 * Math.PI;
          chain(arcPoints([num(t, 10), num(t, 20)], num(t, 40), a0, sweep), true, ocs);
          break;
        }
        case 'CIRCLE': {
          const pts = arcPoints([num(t, 10), num(t, 20)], num(t, 40), 0, 2 * Math.PI);
          chain(pts, true, ocs);
          drawing.shapes.push({ layer, points: pts.slice(0, -1).map((p) => applyAffine(ocs, p)) });
          break;
        }
        case 'ATTDEF':
          break; // attribute definitions are templates, not drawn text
        case 'TEXT':
          addText(t, ocs, false, layer);
          break;
        case 'MTEXT':
          addText(t, m, true, layer);
          break;
        case 'INSERT': {
          const name = str(t, 2);
          const block = blocks.get(name.toUpperCase());
          // Attributes follow the INSERT; they are placed already, outside the block's space.
          let j = i + 1;
          for (
            ;
            j < records.length && ['ATTRIB', 'SEQEND'].includes(records[j]!.type.trim());
            j++
          ) {
            const r = records[j]!;
            if (r.type.trim() === 'ATTRIB') {
              const aLayer = str(r.tags, 8, '0');
              addText(
                r.tags,
                num(r.tags, 230, 1) < 0 ? compose(m, MIRROR_X) : m,
                false,
                aLayer === '0' ? layer : aLayer,
              );
            }
            if (r.type.trim() === 'SEQEND') {
              j++;
              break;
            }
          }
          i = j - 1;
          if (!block) {
            drawing.warnings.push(`Block "${name}" is used but not defined; it was skipped.`);
            break;
          }
          if (stack.length >= MAX_BLOCK_DEPTH || stack.includes(name.toUpperCase())) {
            drawing.warnings.push(
              `Block "${name}" is nested too deeply or contains itself; it was skipped.`,
            );
            break;
          }
          if (num(t, 70, 1) > 1 || num(t, 71, 1) > 1) {
            drawing.warnings.push(`Block array "${name}" was read as a single copy.`);
          }
          const rot = (num(t, 50) * Math.PI) / 180;
          const sx = num(t, 41, 1) || 1;
          const sy = num(t, 42, 1) || 1;
          const at: Xy = [num(t, 10), num(t, 20)];
          const cos = Math.cos(rot);
          const sin = Math.sin(rot);
          const local: Affine = [
            cos * sx,
            sin * sx,
            -sin * sy,
            cos * sy,
            at[0] - (cos * sx * block.base[0] - sin * sy * block.base[1]),
            at[1] - (sin * sx * block.base[0] + cos * sy * block.base[1]),
          ];
          const placed = compose(ocs, local);
          const segStart = drawing.segments.length;
          const textStart = drawing.texts.length;
          stack.push(name.toUpperCase());
          emit(block.records, placed, layer, false);
          stack.pop();
          drawing.inserts.push({
            layer,
            block: name,
            at: applyAffine(ocs, at),
            bounds: boundsOf([
              ...drawing.segments.slice(segStart).flatMap((s) => [s.a, s.b]),
              ...drawing.texts.slice(textStart).map((x) => x.at),
            ]),
          });
          break;
        }
        default:
          ignore(type);
      }
    }
  };

  function addText(t: DxfTag[], m: Affine, mtext: boolean, layer: string) {
    const raw = mtext
      ? t
          .filter((x) => x.code === 3)
          .map(tagString)
          .join('') + str(t, 1)
      : str(t, 1);
    const text = plainText(raw);
    if (!text) return;
    const h = num(t, 40, 1) || 1;
    const lines = text.split('\n');
    const w = Math.max(...lines.map((l) => l.length)) * h * 0.6;
    const blockH = lines.length * h * 1.4;
    let rot = (num(t, 50) * Math.PI) / 180;
    let anchor: Xy = [num(t, 10), num(t, 20)];
    let dx = w / 2;
    let dy = h / 2;
    if (mtext) {
      if (first(t, 11)) rot = Math.atan2(num(t, 21), num(t, 11));
      const att = num(t, 71, 1);
      const col = (att - 1) % 3; // 0 left, 1 centre, 2 right
      const row = Math.floor((att - 1) / 3); // 0 top, 1 middle, 2 bottom
      dx = [w / 2, 0, -w / 2][col] ?? 0;
      dy = [-blockH / 2, 0, blockH / 2][row] ?? 0;
    } else {
      const h72 = num(t, 72);
      const v73 = num(t, 73);
      if (h72 !== 0 || v73 !== 0) {
        const second: Xy = [num(t, 11), num(t, 21)];
        if (h72 === 3 || h72 === 5) {
          anchor = [(anchor[0] + second[0]) / 2, (anchor[1] + second[1]) / 2];
          dx = 0;
        } else {
          anchor = second;
          dx = h72 === 1 || h72 === 4 ? 0 : h72 === 2 ? -w / 2 : w / 2;
        }
        dy = h72 === 4 || v73 === 2 ? 0 : v73 === 3 ? -h / 2 : h / 2;
      }
    }
    const center: Xy = [
      anchor[0] + dx * Math.cos(rot) - dy * Math.sin(rot),
      anchor[1] + dx * Math.sin(rot) + dy * Math.cos(rot),
    ];
    const scale = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
    const item: TextItem = { layer, text, at: applyAffine(m, center), height: h * scale };
    const app = t.findIndex(
      (x) => x.code === 1001 && tagString(x).trim().toUpperCase() === 'PLANCRAFT',
    );
    if (app >= 0) {
      const data: Record<string, string> = {};
      for (const x of t.slice(app + 1)) {
        if (x.code === 1001) break;
        const kv = /^([a-z_]+)=(.*)$/.exec(tagString(x));
        if (x.code === 1000 && kv) data[kv[1]!] = kv[2]!;
      }
      item.data = data;
    }
    drawing.texts.push(item);
  }

  emit(dxfRecords(sections.get('ENTITIES') ?? []), IDENTITY, null, true);
  return drawing;
}
