import { z } from 'zod';
import { values } from '../schema/collections.ts';
import {
  HatchPattern,
  WallType,
  type Dimension,
  type Level,
  type Line,
  type Opening,
  type Plan,
  type Room,
  type Wall,
} from '../schema/plan.ts';
import { Cm, Id, Point, Polygon, PositiveCm, roundCm } from '../schema/primitives.ts';
import { RoomType, roomTypeLabel } from '../schema/room-types.ts';
import {
  OK,
  defineCommand,
  levelOf,
  no,
  withLevel,
  type AnyCommand,
  type Enabled,
} from './define.ts';
import {
  JOIN_CM,
  LevelParam,
  dropRoomCaches,
  enabledFor,
  keptOffset,
  kindOf,
  moveObjects,
  newIdOk,
  noLevel,
  type ObjectKind,
  without,
} from './plan-commands.ts';

// The commands behind the P2.5 toolset: drawing (line / polyline, rectangle, room box,
// separator, stair, dimension, note, hatch) and modifying (copy, rotate, mirror, offset, trim,
// extend, set length). Each is pure and deterministic (A2 M2): a command that creates objects
// gets one new id in its params and names everything it makes from it (`<id>.1`, `<id>.w2`…).

type Pt = readonly [number, number];
const sub = (a: Pt, b: Pt): [number, number] => [a[0] - b[0], a[1] - b[1]];
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
const cross = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0];
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const onGrid = (p: Pt): Point => [roundCm(p[0]), roundCm(p[1])];
const lerp = (a: Pt, b: Pt, t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];
const unit = (a: Pt, b: Pt): [number, number] => {
  const l = dist(a, b) || 1;
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
};
const left = (u: Pt): [number, number] => [-u[1], u[0]];
const deg = (r: number) => ((r % 360) + 360) % 360;
const EPS = 1e-6;

function distToSegment(p: Pt, a: Pt, b: Pt) {
  const ab = sub(b, a);
  const len2 = dot(ab, ab);
  const t = len2 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / len2)) : 0;
  return dist(p, lerp(a, b, t));
}

/** Where lines a→b and c→d cross: params along each (t on a→b, u on c→d); null if parallel. */
function crossing(a: Pt, b: Pt, c: Pt, d: Pt): { t: number; u: number } | null {
  const r = sub(b, a);
  const s = sub(d, c);
  const den = cross(r, s);
  if (Math.abs(den) < 1e-9 * (Math.hypot(...r) * Math.hypot(...s) || 1)) return null;
  const ac = sub(c, a);
  return { t: cross(ac, s) / den, u: cross(ac, r) / den };
}

const rect = (a: Pt, b: Pt): Point[] => [
  onGrid([Math.min(a[0], b[0]), Math.min(a[1], b[1])]),
  onGrid([Math.max(a[0], b[0]), Math.min(a[1], b[1])]),
  onGrid([Math.max(a[0], b[0]), Math.max(a[1], b[1])]),
  onGrid([Math.min(a[0], b[0]), Math.max(a[1], b[1])]),
];
const rectOk = (a: Pt, b: Pt, what: string): Enabled =>
  Math.abs(a[0] - b[0]) < 1 || Math.abs(a[1] - b[1]) < 1
    ? no(`A ${what} needs two opposite corners at least 1 cm apart both ways.`)
    : OK;

/** The straight pieces other objects can be cut against or extended to: walls, separators, lines. */
function cutters(level: Level, except: string): [Pt, Pt][] {
  const out: [Pt, Pt][] = [];
  for (const w of values(level.walls)) if (w.id !== except) out.push([w.start, w.end]);
  for (const s of values(level.separators)) if (s.id !== except) out.push([s.start, s.end]);
  for (const l of values(level.lines)) {
    if (l.id === except) continue;
    const pts = l.closed ? [...l.points, l.points[0]!] : l.points;
    for (let i = 1; i < pts.length; i++) out.push([pts[i - 1]!, pts[i]!]);
  }
  return out;
}

/** A wall, separator or straight (two-point) line, as a segment; null for anything else. */
function segmentOf(level: Level, id: string): { kind: ObjectKind; a: Point; b: Point } | null {
  const kind = kindOf(level, id);
  if (kind === 'walls' || kind === 'separators') {
    const s = level[kind][id]!;
    return { kind, a: s.start, b: s.end };
  }
  if (kind === 'lines') {
    const l = level.lines[id]!;
    if (l.points.length === 2 && !l.closed) return { kind, a: l.points[0]!, b: l.points[1]! };
  }
  return null;
}
const notSegment = (id: string) =>
  no(`${id} isn't a wall, a separator or a straight line, so it can't be cut or extended.`);

/** The level with one straight object's ends changed (and its openings kept in place). */
function withEnds(level: Level, id: string, a: Point, b: Point): Level {
  const seg = segmentOf(level, id)!;
  if (seg.kind === 'lines') {
    const l = level.lines[id]!;
    return { ...level, lines: { ...level.lines, [id]: { ...l, points: [a, b] } } };
  }
  if (seg.kind === 'separators') {
    const s = level.separators[id]!;
    return {
      ...level,
      separators: { ...level.separators, [id]: { ...s, start: a, end: b } },
      rooms: dropRoomCaches(level.rooms),
    };
  }
  const w = level.walls[id]!;
  const after: Wall = { ...w, start: a, end: b };
  const openings = { ...level.openings };
  for (const o of values(level.openings))
    if (o.wall === id) openings[o.id] = { ...o, offset: keptOffset(o, w, after) };
  return {
    ...level,
    walls: { ...level.walls, [id]: after },
    openings,
    rooms: dropRoomCaches(level.rooms),
  };
}

// --- Point transforms (copy, rotate, mirror) ------------------------------------------------------

interface Transform {
  point(p: Pt): Point;
  /** New direction of something that faced `r` degrees. */
  turn(r: number): number;
  /** A mirror swaps left and right: door swings and dimension sides flip. */
  flip: boolean;
}
const translate = (d: Pt): Transform => ({
  point: (p) => onGrid([p[0] + d[0], p[1] + d[1]]),
  turn: (r) => r,
  flip: false,
});
function rotation(c: Pt, angle: number): Transform {
  const r = (angle * Math.PI) / 180;
  const [cos, sin] = [Math.cos(r), Math.sin(r)];
  return {
    point: (p) =>
      onGrid([
        c[0] + (p[0] - c[0]) * cos - (p[1] - c[1]) * sin,
        c[1] + (p[0] - c[0]) * sin + (p[1] - c[1]) * cos,
      ]),
    turn: (q) => deg(q + angle),
    flip: false,
  };
}
function mirroring(a: Pt, b: Pt): Transform {
  const u = unit(a, b);
  const axis = (Math.atan2(u[1], u[0]) * 180) / Math.PI;
  return {
    point: (p) => {
      const v = sub(p, a);
      const along = dot(v, u);
      return onGrid([a[0] + 2 * along * u[0] - v[0], a[1] + 2 * along * u[1] - v[1]]);
    },
    turn: (q) => deg(2 * axis - q),
    flip: true,
  };
}
const FLIP_SWING = {
  'in-left': 'out-left',
  'in-right': 'out-right',
  'out-left': 'in-left',
  'out-right': 'in-right',
} as const;

/** One object after a transform. Openings ride on their wall; a mirror flips their swing. */
function transformed(level: Level, kind: ObjectKind, id: string, t: Transform): object {
  switch (kind) {
    case 'walls':
    case 'separators': {
      const s = level[kind][id]!;
      return { ...s, start: t.point(s.start), end: t.point(s.end) };
    }
    case 'rooms': {
      const r = level.rooms[id]!;
      return { ...r, seed: t.point(r.seed) };
    }
    case 'openings': {
      const o = level.openings[id]!;
      return t.flip && o.kind === 'door' ? { ...o, swing: FLIP_SWING[o.swing] } : o;
    }
    case 'stairs': {
      const s = level.stairs[id]!;
      return { ...s, polygon: s.polygon.map(t.point) };
    }
    case 'columns':
    case 'fixtures': {
      const c = level[kind][id]!;
      return { ...c, at: t.point(c.at), rotation_deg: t.turn(c.rotation_deg) };
    }
    case 'lines': {
      const l = level.lines[id]!;
      return { ...l, points: l.points.map(t.point) };
    }
    case 'dimensions': {
      const m = level.dimensions[id]!;
      return {
        ...m,
        start: t.point(m.start),
        end: t.point(m.end),
        offset: t.flip ? -m.offset : m.offset,
      };
    }
    case 'texts': {
      const x = level.texts[id]!;
      return { ...x, at: t.point(x.at), rotation_deg: t.turn(x.rotation_deg) };
    }
    case 'hatches': {
      const h = level.hatches[id]!;
      return { ...h, polygon: h.polygon.map(t.point) };
    }
  }
}

const touchesLines = (kinds: Iterable<ObjectKind>) =>
  [...kinds].some((k) => k === 'walls' || k === 'separators');

/** Transforms objects where they are; openings whose wall isn't included stay as they are. */
function transformInPlace(level: Level, ids: readonly string[], t: Transform): Level {
  const next: Record<ObjectKind, Record<string, object>> = Object.fromEntries(
    (Object.keys(level) as (keyof Level)[])
      .filter((k) => typeof level[k] === 'object')
      .map((k) => [k, { ...(level[k] as object) }]),
  ) as Record<ObjectKind, Record<string, object>>;
  const chosen = new Set(ids);
  const kinds = new Set<ObjectKind>();
  for (const id of ids) {
    const kind = kindOf(level, id)!;
    if (kind === 'openings' && !chosen.has(level.openings[id]!.wall)) continue;
    next[kind][id] = transformed(level, kind, id, t);
    kinds.add(kind);
  }
  // A mirrored wall's openings flip their swing with it.
  if (t.flip)
    for (const o of values(level.openings))
      if (chosen.has(o.wall) && !chosen.has(o.id))
        next.openings[o.id] = transformed(level, 'openings', o.id, t);
  const out = { ...level, ...next } as Level;
  return touchesLines(kinds) ? { ...out, rooms: dropRoomCaches(out.rooms) } : out;
}

/**
 * Transformed copies with new ids `<base>.1`, `<base>.2`… in the order given; a copied wall
 * brings its openings, and references (an opening's wall, a loft's wall) point at the copies.
 */
function copies(level: Level, ids: readonly string[], base: string, t: Transform): Level {
  const order = [...ids];
  const chosen = new Set(ids);
  for (const o of values(level.openings))
    if (chosen.has(o.wall) && !chosen.has(o.id)) order.push(o.id);
  const fresh = new Map(order.map((id, i) => [id, `${base}.${i + 1}`]));
  const next = { ...level } as Record<string, unknown>;
  const kinds = new Set<ObjectKind>();
  for (const id of order) {
    const kind = kindOf(level, id)!;
    if (kind === 'openings' && !fresh.has(level.openings[id]!.wall)) continue;
    let copy = { ...transformed(level, kind, id, t), id: fresh.get(id)! } as Record<
      string,
      unknown
    >;
    if (kind === 'openings') copy = { ...copy, wall: fresh.get((copy as Opening).wall)! };
    if (kind === 'rooms') {
      const r = copy as unknown as Room;
      if (r.loft) {
        const wall = fresh.get(r.loft.wall);
        const { loft, ...rest } = r;
        copy = (wall ? { ...rest, loft: { ...loft, wall } } : rest) as Record<string, unknown>;
      }
      delete copy.polygon;
    }
    next[kind] = { ...(next[kind] as object), [fresh.get(id)!]: copy };
    kinds.add(kind);
  }
  const out = next as unknown as Level;
  return touchesLines(kinds) ? { ...out, rooms: dropRoomCaches(out.rooms) } : out;
}

const freshIdsOk = (plan: Plan, level: Level, ids: readonly string[], base: string): Enabled => {
  const used = newIdOk(plan, `${base}.1`);
  if (!used.ok) return used;
  return enabledFor(plan, ids, level.id);
};

// --- Drawing commands ---------------------------------------------------------------------------

const AddLineParams = z.strictObject({
  id: Id,
  points: z.array(Point).min(2),
  closed: z.boolean().optional(),
  level: LevelParam,
});
export const ADD_LINE = defineCommand<z.infer<typeof AddLineParams>>({
  id: 'ADD_LINE',
  label: 'Line or polyline',
  aliases: ['L', 'LINE', 'PL', 'PLINE'],
  description:
    'Draws a drafting line through two or more points (cm); closed=true joins the last point to the first.',
  params: AddLineParams,
  text: [{ name: 'points', kind: 'points' }],
  enabled(plan, p) {
    if (!levelOf(plan, p.level)) return noLevel(p.level);
    if (p.points.some((q, i) => i > 0 && dist(q, p.points[i - 1]!) < 0.1))
      return no('Two points in a row are the same; every segment needs a length.');
    return newIdOk(plan, p.id);
  },
  run(plan, p) {
    const level = levelOf(plan, p.level)!;
    const line: Line = { id: p.id, points: p.points, closed: p.closed ?? false };
    return withLevel(plan, { ...level, lines: { ...level.lines, [p.id]: line } });
  },
});

const CornersParams = z.strictObject({ id: Id, corner: Point, opposite: Point, level: LevelParam });
export const RECTANGLE = defineCommand<z.infer<typeof CornersParams>>({
  id: 'RECTANGLE',
  label: 'Rectangle',
  aliases: ['REC', 'RECT', 'RECTANG'],
  description: 'Draws a closed rectangular drafting line from two opposite corners.',
  params: CornersParams,
  text: [
    { name: 'corner', kind: 'point' },
    { name: 'opposite', kind: 'point' },
  ],
  enabled(plan, p) {
    if (!levelOf(plan, p.level)) return noLevel(p.level);
    const r = rectOk(p.corner, p.opposite, 'rectangle');
    return r.ok ? newIdOk(plan, p.id) : r;
  },
  run(plan, p) {
    const level = levelOf(plan, p.level)!;
    const line: Line = { id: p.id, points: rect(p.corner, p.opposite), closed: true };
    return withLevel(plan, { ...level, lines: { ...level.lines, [p.id]: line } });
  },
});

const RoomBoxParams = z.strictObject({
  id: Id,
  corner: Point,
  opposite: Point,
  type: RoomType,
  name: z.string().optional(),
  /** Wall type of the new walls; internal by default. */
  wall_type: WallType.optional(),
  thickness: PositiveCm.optional(),
  level: LevelParam,
});
export const ROOM = defineCommand<z.infer<typeof RoomBoxParams>>({
  id: 'ROOM',
  label: 'Room',
  aliases: ['BOX'],
  description:
    'Draws a rectangular room: walls on the four sides (centrelines through the corners; a side that already has a wall gets no second one) and the room named inside.',
  params: RoomBoxParams,
  text: [
    { name: 'corner', kind: 'point' },
    { name: 'opposite', kind: 'point' },
    { name: 'type', kind: 'word' },
    { name: 'name', kind: 'text', optional: true },
  ],
  enabled(plan, p) {
    if (!levelOf(plan, p.level)) return noLevel(p.level);
    const r = rectOk(p.corner, p.opposite, 'room');
    return r.ok ? newIdOk(plan, p.id) : r;
  },
  run(plan, p) {
    const level = levelOf(plan, p.level)!;
    const c = rect(p.corner, p.opposite);
    const type = p.wall_type ?? 'internal';
    const thickness = p.thickness ?? (type === 'external' || type === 'compound' ? 23 : 11.5);
    const walls = { ...level.walls };
    c.forEach((a, i) => {
      const b = c[(i + 1) % 4]!;
      const covered = values(level.walls).some(
        (w) => distToSegment(a, w.start, w.end) <= 1 && distToSegment(b, w.start, w.end) <= 1,
      );
      if (!covered)
        walls[`${p.id}.w${i + 1}`] = { id: `${p.id}.w${i + 1}`, start: a, end: b, thickness, type };
    });
    const room: Room = {
      id: p.id,
      type: p.type,
      name: p.name ?? roomTypeLabel(p.type),
      seed: onGrid([(c[0]![0] + c[2]![0]) / 2, (c[0]![1] + c[2]![1]) / 2]),
      behavior: 'fixed',
      locked: false,
    };
    return withLevel(plan, {
      ...level,
      walls,
      rooms: { ...dropRoomCaches(level.rooms), [p.id]: room },
    });
  },
});

const TwoPointParams = z.strictObject({ id: Id, start: Point, end: Point, level: LevelParam });
export const ADD_SEPARATOR = defineCommand<z.infer<typeof TwoPointParams>>({
  id: 'ADD_SEPARATOR',
  label: 'Room separator',
  aliases: ['SEP', 'SEPARATOR'],
  description:
    'Draws a room separator: a boundary that splits an open space into rooms (living / dining) without a wall.',
  params: TwoPointParams,
  text: [
    { name: 'start', kind: 'point' },
    { name: 'end', kind: 'point' },
  ],
  enabled(plan, p) {
    if (!levelOf(plan, p.level)) return noLevel(p.level);
    if (dist(p.start, p.end) < 0.1) return no('A separator needs two different points.');
    return newIdOk(plan, p.id);
  },
  run(plan, p) {
    const level = levelOf(plan, p.level)!;
    return withLevel(plan, {
      ...level,
      separators: { ...level.separators, [p.id]: { id: p.id, start: p.start, end: p.end } },
      rooms: dropRoomCaches(level.rooms),
    });
  },
});

const StairParams = z.strictObject({
  id: Id,
  corner: Point,
  opposite: Point,
  direction: z.enum(['up', 'down']).optional(),
  steps: z.number().int().positive().optional(),
  level: LevelParam,
});
export const ADD_STAIR = defineCommand<z.infer<typeof StairParams>>({
  id: 'ADD_STAIR',
  label: 'Stair',
  aliases: ['STAIR'],
  description:
    'Draws a straight stair in a rectangle; treads run across the longer side, every 25 cm unless steps= is given.',
  params: StairParams,
  text: [
    { name: 'corner', kind: 'point' },
    { name: 'opposite', kind: 'point' },
    { name: 'direction', kind: 'word', optional: true },
  ],
  enabled(plan, p) {
    if (!levelOf(plan, p.level)) return noLevel(p.level);
    const r = rectOk(p.corner, p.opposite, 'stair');
    return r.ok ? newIdOk(plan, p.id) : r;
  },
  run(plan, p) {
    const level = levelOf(plan, p.level)!;
    const stair = {
      id: p.id,
      polygon: rect(p.corner, p.opposite),
      direction: p.direction ?? 'up',
      ...(p.steps !== undefined ? { steps: p.steps } : {}),
    };
    return withLevel(plan, { ...level, stairs: { ...level.stairs, [p.id]: stair } });
  },
});

const DimensionParams = z.strictObject({
  id: Id,
  start: Point,
  end: Point,
  /** Distance of the dimension line from the measured points, to the left of start → end. */
  offset: Cm.optional(),
  level: LevelParam,
});
export const ADD_DIMENSION = defineCommand<z.infer<typeof DimensionParams>>({
  id: 'ADD_DIMENSION',
  label: 'Dimension',
  aliases: ['DIM', 'DLI', 'DIMLINEAR'],
  description:
    'Adds a dimension between two points, drawn offset= cm to their left (60 cm unless given; negative for the right).',
  params: DimensionParams,
  text: [
    { name: 'start', kind: 'point' },
    { name: 'end', kind: 'point' },
    { name: 'offset', kind: 'number', optional: true },
  ],
  enabled(plan, p) {
    if (!levelOf(plan, p.level)) return noLevel(p.level);
    if (dist(p.start, p.end) < 0.1) return no('A dimension needs two different points.');
    return newIdOk(plan, p.id);
  },
  run(plan, p) {
    const level = levelOf(plan, p.level)!;
    const dim: Dimension = { id: p.id, start: p.start, end: p.end, offset: p.offset ?? 60 };
    return withLevel(plan, { ...level, dimensions: { ...level.dimensions, [p.id]: dim } });
  },
});

const TextParams = z.strictObject({
  id: Id,
  at: Point,
  text: z.string().min(1).max(500),
  size: PositiveCm.optional(),
  rotation_deg: z.number().min(0).lt(360).optional(),
  level: LevelParam,
});
export const ADD_TEXT = defineCommand<z.infer<typeof TextParams>>({
  id: 'ADD_TEXT',
  label: 'Note',
  aliases: ['TEXT', 'DT', 'MTEXT', 'NOTE'],
  description: 'Writes a note on the drawing; size= is the text height in cm (25 unless given).',
  params: TextParams,
  text: [
    { name: 'at', kind: 'point' },
    { name: 'text', kind: 'text' },
  ],
  enabled(plan, p) {
    if (!levelOf(plan, p.level)) return noLevel(p.level);
    return newIdOk(plan, p.id);
  },
  run(plan, p) {
    const level = levelOf(plan, p.level)!;
    const note = {
      id: p.id,
      at: p.at,
      text: p.text,
      size: p.size ?? 25,
      rotation_deg: p.rotation_deg ?? 0,
    };
    return withLevel(plan, { ...level, texts: { ...level.texts, [p.id]: note } });
  },
});

const HatchParams = z.strictObject({
  id: Id,
  polygon: Polygon,
  pattern: HatchPattern.optional(),
  level: LevelParam,
});
export const ADD_HATCH = defineCommand<z.infer<typeof HatchParams>>({
  id: 'ADD_HATCH',
  label: 'Hatch',
  aliases: ['H', 'HATCH'],
  description:
    'Hatches an area given by its corners (pattern= diagonal, cross, dots or solid), e.g. a wet floor.',
  params: HatchParams,
  text: [{ name: 'polygon', kind: 'points' }],
  enabled(plan, p) {
    if (!levelOf(plan, p.level)) return noLevel(p.level);
    return newIdOk(plan, p.id);
  },
  run(plan, p) {
    const level = levelOf(plan, p.level)!;
    const hatch = { id: p.id, polygon: p.polygon, pattern: p.pattern ?? 'diagonal' };
    return withLevel(plan, { ...level, hatches: { ...level.hatches, [p.id]: hatch } });
  },
});

// --- Modifying commands -------------------------------------------------------------------------

const CopyParams = z.strictObject({
  ids: z.array(Id).min(1),
  from: Point,
  to: Point,
  /** The copies are named `<id>.1`, `<id>.2`… */
  id: Id,
  level: LevelParam,
});
export const COPY = defineCommand<z.infer<typeof CopyParams>>({
  id: 'COPY',
  label: 'Copy',
  aliases: ['CO', 'CP'],
  description:
    'Copies objects by the distance from one point to another; a copied wall brings its doors and windows.',
  params: CopyParams,
  text: [
    { name: 'ids', kind: 'ids' },
    { name: 'from', kind: 'point' },
    { name: 'to', kind: 'point' },
  ],
  enabled(plan, p) {
    const level = levelOf(plan, p.level);
    return level ? freshIdsOk(plan, level, p.ids, p.id) : noLevel(p.level);
  },
  run(plan, p) {
    const level = levelOf(plan, p.level)!;
    return withLevel(plan, copies(level, p.ids, p.id, translate(sub(p.to, p.from))));
  },
});

const RotateParams = z.strictObject({
  ids: z.array(Id).min(1),
  center: Point,
  /** Degrees, anticlockwise. */
  angle: z.number().gt(-360).lt(360),
  level: LevelParam,
});
export const ROTATE = defineCommand<z.infer<typeof RotateParams>>({
  id: 'ROTATE',
  label: 'Rotate',
  aliases: ['RO'],
  description:
    'Turns objects about a point by an angle in degrees (anticlockwise; negative for clockwise).',
  params: RotateParams,
  text: [
    { name: 'ids', kind: 'ids' },
    { name: 'center', kind: 'point' },
    { name: 'angle', kind: 'number' },
  ],
  enabled: (plan, p) => enabledFor(plan, p.ids, p.level),
  run(plan, p) {
    if (!p.angle) return plan;
    const level = levelOf(plan, p.level)!;
    return withLevel(plan, transformInPlace(level, p.ids, rotation(p.center, p.angle)));
  },
});

const MirrorParams = z.strictObject({
  ids: z.array(Id).min(1),
  /** Two points on the mirror line. */
  a: Point,
  b: Point,
  /** Keep the originals and add mirrored copies (true, as in AutoCAD), or flip in place. */
  keep: z.boolean().optional(),
  /** The copies are named `<id>.1`, `<id>.2`… */
  id: Id,
  level: LevelParam,
});
export const MIRROR = defineCommand<z.infer<typeof MirrorParams>>({
  id: 'MIRROR',
  label: 'Mirror',
  aliases: ['MI'],
  description:
    'Mirrors objects across the line through two points: adds mirrored copies, or flips them in place with keep=false. Door swings flip too.',
  params: MirrorParams,
  text: [
    { name: 'ids', kind: 'ids' },
    { name: 'a', kind: 'point' },
    { name: 'b', kind: 'point' },
  ],
  enabled(plan, p) {
    const level = levelOf(plan, p.level);
    if (!level) return noLevel(p.level);
    if (dist(p.a, p.b) < 0.1) return no('The mirror line needs two different points.');
    return p.keep === false
      ? enabledFor(plan, p.ids, p.level)
      : freshIdsOk(plan, level, p.ids, p.id);
  },
  run(plan, p) {
    const level = levelOf(plan, p.level)!;
    const t = mirroring(p.a, p.b);
    return withLevel(
      plan,
      p.keep === false ? transformInPlace(level, p.ids, t) : copies(level, p.ids, p.id, t),
    );
  },
});

const OffsetParams = z.strictObject({
  source: Id,
  /** cm, to the left of the source's direction (negative: to the right). */
  distance: Cm,
  id: Id,
  level: LevelParam,
});

/** A polyline moved sideways by `d`, its corners mitred. */
function offsetPoints(points: readonly Pt[], closed: boolean, d: number): Point[] {
  const n = points.length;
  const segs: [Pt, Pt][] = [];
  for (let i = 0; i < n - (closed ? 0 : 1); i++) {
    const a = points[i]!;
    const b = points[(i + 1) % n]!;
    const s = left(unit(a, b));
    segs.push([
      [a[0] + s[0] * d, a[1] + s[1] * d],
      [b[0] + s[0] * d, b[1] + s[1] * d],
    ]);
  }
  return points.map((_, i) => {
    const before = closed ? segs[(i - 1 + segs.length) % segs.length] : segs[i - 1];
    const after = segs[i] ?? (closed ? segs[0] : undefined);
    if (!before) return onGrid(after![0]);
    if (!after || (!closed && i === n - 1)) return onGrid(before[1]);
    const x = crossing(before[0], before[1], after[0], after[1]);
    return onGrid(x ? lerp(before[0], before[1], x.t) : after[0]);
  });
}

export const OFFSET = defineCommand<z.infer<typeof OffsetParams>>({
  id: 'OFFSET',
  label: 'Offset',
  aliases: ['O'],
  description:
    'Adds a parallel copy of a wall, separator or line at a distance (cm, to the left of its direction; negative to the right).',
  params: OffsetParams,
  text: [
    { name: 'source', kind: 'id' },
    { name: 'distance', kind: 'number' },
  ],
  enabled(plan, p) {
    const level = levelOf(plan, p.level);
    if (!level) return noLevel(p.level);
    const kind = kindOf(level, p.source);
    if (kind !== 'walls' && kind !== 'separators' && kind !== 'lines')
      return no(`${p.source} isn't a wall, a separator or a line, so it can't be offset.`);
    if (!p.distance) return no('Give a distance other than 0.');
    return newIdOk(plan, p.id);
  },
  run(plan, p) {
    const level = levelOf(plan, p.level)!;
    const kind = kindOf(level, p.source)!;
    if (kind === 'lines') {
      const l = level.lines[p.source]!;
      const copy = { ...l, id: p.id, points: offsetPoints(l.points, l.closed, p.distance) };
      return withLevel(plan, { ...level, lines: { ...level.lines, [p.id]: copy } });
    }
    const s = (kind === 'walls' ? level.walls : level.separators)[p.source]!;
    const n = left(unit(s.start, s.end));
    const move = (q: Pt) => onGrid([q[0] + n[0] * p.distance, q[1] + n[1] * p.distance]);
    const copy = { ...without(s, 'provenance'), id: p.id, start: move(s.start), end: move(s.end) };
    return withLevel(plan, {
      ...level,
      [kind]: { ...level[kind], [p.id]: copy },
      rooms: dropRoomCaches(level.rooms),
    });
  },
});

/** Where other walls, separators and lines cross a segment, as params along it (0…1, sorted). */
function cuts(level: Level, id: string, a: Pt, b: Pt): number[] {
  const len = dist(a, b) || 1;
  const tol = JOIN_CM / len;
  const ts = cutters(level, id).flatMap(([c, d]) => {
    const x = crossing(a, b, c, d);
    const ulen = JOIN_CM / (dist(c, d) || 1);
    return x && x.t > tol && x.t < 1 - tol && x.u >= -ulen && x.u <= 1 + ulen ? [x.t] : [];
  });
  return [...new Set(ts.map((t) => Math.round(t * 1e9) / 1e9))].sort((x, y) => x - y);
}

const TrimParams = z.strictObject({
  target: Id,
  /** A point on the part to cut away. */
  at: Point,
  /** When the cut splits the target in two, the far part gets this id. */
  id: Id,
  level: LevelParam,
});
function trimSpan(level: Level, p: { target: string; at: Pt }) {
  const seg = segmentOf(level, p.target)!;
  const ab = sub(seg.b, seg.a);
  const tp = Math.max(0, Math.min(1, dot(sub(p.at, seg.a), ab) / (dot(ab, ab) || 1)));
  const ts = cuts(level, p.target, seg.a, seg.b);
  return { seg, t0: ts.filter((t) => t < tp).at(-1) ?? 0, t1: ts.find((t) => t > tp) ?? 1 };
}
export const TRIM = defineCommand<z.infer<typeof TrimParams>>({
  id: 'TRIM',
  label: 'Trim',
  aliases: ['TR'],
  description:
    'Cuts away the part of a wall, separator or straight line between the walls or lines that cross it, around a point you give. Doors and windows in the cut part go too.',
  params: TrimParams,
  text: [
    { name: 'target', kind: 'id' },
    { name: 'at', kind: 'point' },
  ],
  enabled(plan, p) {
    const level = levelOf(plan, p.level);
    if (!level) return noLevel(p.level);
    if (!kindOf(level, p.target)) return enabledFor(plan, [p.target], p.level);
    if (!segmentOf(level, p.target)) return notSegment(p.target);
    const { t0, t1 } = trimSpan(level, p);
    if (t0 === 0 && t1 === 1)
      return no(`Nothing crosses ${p.target} to cut against; use Delete to remove all of it.`);
    return t0 > 0 && t1 < 1 ? newIdOk(plan, p.id) : OK;
  },
  run(plan, p) {
    const level = levelOf(plan, p.level)!;
    const { seg, t0, t1 } = trimSpan(level, p);
    const A = onGrid(lerp(seg.a, seg.b, t0));
    const B = onGrid(lerp(seg.a, seg.b, t1));
    if (t0 === 0) return withLevel(plan, withEnds(level, p.target, B, seg.b));
    if (t1 === 1) return withLevel(plan, withEnds(level, p.target, seg.a, A));
    // A cut in the middle: the target keeps the near part, a new piece takes the far part.
    const len = dist(seg.a, seg.b);
    let next = withEnds(level, p.target, seg.a, A);
    if (seg.kind === 'walls') {
      const w = level.walls[p.target]!;
      const openings = { ...next.openings };
      for (const o of values(level.openings)) {
        if (o.wall !== p.target) continue;
        if (o.offset + o.width <= t0 * len + EPS) openings[o.id] = { ...o };
        else if (o.offset >= t1 * len - EPS)
          openings[o.id] = { ...o, wall: p.id, offset: roundCm(o.offset - t1 * len) };
        else delete openings[o.id];
      }
      next = {
        ...next,
        walls: { ...next.walls, [p.id]: { ...w, id: p.id, start: B, end: seg.b } },
        openings,
      };
    } else if (seg.kind === 'separators')
      next = {
        ...next,
        separators: { ...next.separators, [p.id]: { id: p.id, start: B, end: seg.b } },
      };
    else
      next = {
        ...next,
        lines: {
          ...next.lines,
          [p.id]: { ...level.lines[p.target]!, id: p.id, points: [B, seg.b] },
        },
      };
    return withLevel(plan, next);
  },
});

const ExtendParams = z.strictObject({
  target: Id,
  end: z.enum(['start', 'end']),
  level: LevelParam,
});
/** How far the chosen end can reach along its own line to meet the nearest other object. */
function reach(level: Level, p: { target: string; end: 'start' | 'end' }): Point | null {
  const seg = segmentOf(level, p.target)!;
  const [from, to] = p.end === 'end' ? [seg.a, seg.b] : [seg.b, seg.a];
  const len = dist(from, to) || 1;
  let best: number | null = null;
  for (const [c, d] of cutters(level, p.target)) {
    const x = crossing(from, to, c, d);
    const ulen = 0.1 / (dist(c, d) || 1);
    if (
      x &&
      x.t > 1 + 0.1 / len &&
      x.u >= -ulen &&
      x.u <= 1 + ulen &&
      (best === null || x.t < best)
    )
      best = x.t;
  }
  return best === null ? null : onGrid(lerp(from, to, best));
}
export const EXTEND = defineCommand<z.infer<typeof ExtendParams>>({
  id: 'EXTEND',
  label: 'Extend',
  aliases: ['EX'],
  description:
    'Lengthens a wall, separator or straight line from one end (start or end) until it meets the next wall or line in its way.',
  params: ExtendParams,
  text: [
    { name: 'target', kind: 'id' },
    { name: 'end', kind: 'word' },
  ],
  enabled(plan, p) {
    const level = levelOf(plan, p.level);
    if (!level) return noLevel(p.level);
    if (!kindOf(level, p.target)) return enabledFor(plan, [p.target], p.level);
    if (!segmentOf(level, p.target)) return notSegment(p.target);
    return reach(level, p)
      ? OK
      : no(`Nothing lies ahead of the ${p.end} of ${p.target} to extend it to.`);
  },
  run(plan, p) {
    const level = levelOf(plan, p.level)!;
    const seg = segmentOf(level, p.target)!;
    const to = reach(level, p)!;
    return withLevel(
      plan,
      p.end === 'end' ? withEnds(level, p.target, seg.a, to) : withEnds(level, p.target, to, seg.b),
    );
  },
});

const SetLengthParams = z.strictObject({
  /** A wall, separator or straight line; or a dimension (the wall it measures changes). */
  target: Id,
  length: PositiveCm,
  /** Which end stays where it is. */
  keep: z.enum(['start', 'end']).optional(),
  level: LevelParam,
});
/** The wall a dimension measures: one whose ends sit on the dimension's ends. */
function measuredWall(level: Level, m: Dimension): { id: string; keep: 'start' | 'end' } | null {
  for (const w of values(level.walls)) {
    if (dist(w.start, m.start) <= JOIN_CM && dist(w.end, m.end) <= JOIN_CM)
      return { id: w.id, keep: 'start' };
    if (dist(w.end, m.start) <= JOIN_CM && dist(w.start, m.end) <= JOIN_CM)
      return { id: w.id, keep: 'end' };
  }
  return null;
}
export const SET_LENGTH = defineCommand<z.infer<typeof SetLengthParams>>({
  id: 'SET_LENGTH',
  label: 'Set length',
  aliases: ['LEN', 'LENGTHEN'],
  description:
    'Makes a wall, separator or straight line a given length (cm) by moving one end along it; walls joined at that end follow. Given a dimension, changes the wall it measures.',
  params: SetLengthParams,
  text: [
    { name: 'target', kind: 'id' },
    { name: 'length', kind: 'number' },
  ],
  enabled(plan, p) {
    const level = levelOf(plan, p.level);
    if (!level) return noLevel(p.level);
    if (!kindOf(level, p.target)) return enabledFor(plan, [p.target], p.level);
    if (kindOf(level, p.target) === 'dimensions') return OK;
    return segmentOf(level, p.target) ? OK : notSegment(p.target);
  },
  run(plan, p) {
    const level = levelOf(plan, p.level)!;
    if (kindOf(level, p.target) !== 'dimensions')
      return withLevel(plan, setLength(level, p.target, p.length, (p.keep ?? 'start') === 'start'));
    const m = level.dimensions[p.target]!;
    const wall = measuredWall(level, m);
    if (wall) return withLevel(plan, setLength(level, wall.id, p.length, wall.keep === 'start'));
    const end = onGrid(lerp(m.start, m.end, p.length / (dist(m.start, m.end) || 1)));
    return withLevel(plan, {
      ...level,
      dimensions: { ...level.dimensions, [m.id]: { ...m, end } },
    });
  },
});

/**
 * A straight object made `length` long by moving one end. A wall that meets that end across it
 * (a corner) moves over as a whole, dragging its own joins, as when a room is made wider;
 * anything else joined at that end only has its end moved.
 */
function setLength(level: Level, target: string, length: number, keepStart: boolean): Level {
  const seg = segmentOf(level, target)!;
  const [fixed, moving] = keepStart ? [seg.a, seg.b] : [seg.b, seg.a];
  const moved = onGrid(lerp(fixed, moving, length / (dist(fixed, moving) || 1)));
  const d = sub(moved, moving);
  const u = unit(seg.a, seg.b);
  const across = values(level.walls).filter(
    (w) =>
      w.id !== target &&
      (dist(w.start, moving) <= JOIN_CM || dist(w.end, moving) <= JOIN_CM) &&
      Math.abs(cross(u, unit(w.start, w.end))) > 0.1,
  );
  if (across.length && seg.kind !== 'lines')
    return moveObjects(
      level,
      across.map((w) => w.id),
      d,
    );
  const next = keepStart
    ? withEnds(level, target, seg.a, moved)
    : withEnds(level, target, moved, seg.b);
  // Walls, separators and dimensions joined at the moved end go with it.
  const follow = (q: Point): Point =>
    dist(q, moving) <= JOIN_CM ? onGrid([q[0] + d[0], q[1] + d[1]]) : q;
  const walls = { ...next.walls };
  const openings = { ...next.openings };
  for (const w of values(next.walls)) {
    if (w.id === target) continue;
    const [s, e] = [follow(w.start), follow(w.end)];
    if (s === w.start && e === w.end) continue;
    const after = { ...w, start: s, end: e };
    walls[w.id] = after;
    for (const o of values(next.openings))
      if (o.wall === w.id) openings[o.id] = { ...o, offset: keptOffset(o, w, after) };
  }
  const separators = Object.fromEntries(
    Object.entries(next.separators).map(([k, s]) => [
      k,
      k === target ? s : { ...s, start: follow(s.start), end: follow(s.end) },
    ]),
  );
  const dimensions = Object.fromEntries(
    Object.entries(next.dimensions).map(([k, m]) => [
      k,
      { ...m, start: follow(m.start), end: follow(m.end) },
    ]),
  );
  return { ...next, walls, openings, separators, dimensions, rooms: dropRoomCaches(next.rooms) };
}

/** The toolset's commands, by id. */
export const TOOL_COMMANDS: Record<string, AnyCommand> = Object.fromEntries(
  [
    ADD_LINE,
    RECTANGLE,
    ROOM,
    ADD_SEPARATOR,
    ADD_STAIR,
    ADD_DIMENSION,
    ADD_TEXT,
    ADD_HATCH,
    COPY,
    ROTATE,
    MIRROR,
    OFFSET,
    TRIM,
    EXTEND,
    SET_LENGTH,
  ].map((c) => [c.id, c]),
);
