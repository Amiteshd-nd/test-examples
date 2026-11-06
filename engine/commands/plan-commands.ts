import { z } from 'zod';
import { JOIN_TOLERANCE_MM, deriveRooms, type DerivedRoom } from '../rooms/derive.ts';
import { levelsInOrder, values } from '../schema/collections.ts';
import {
  Column,
  Dimension,
  DoorSwing,
  Fixture,
  Hatch,
  Line,
  Opening,
  Room,
  Separator,
  Stair,
  TextNote,
  Wall,
  WallType,
  type Level,
  type Plan,
} from '../schema/plan.ts';
import { Id, NonNegativeCm, Point, PositiveCm, roundCm } from '../schema/primitives.ts';
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

// The plan's smart objects as commands (P2.4): walls, separators, rooms, openings, stairs,
// columns and fixtures move, appear, disappear and change only through these. Walls keep their
// joins when one moves (the walls ending on it stretch with it), openings stay on their wall,
// and room labels stay on their side of a wall that moves past them, so rooms re-derive as the
// architect expects. Annotations (lines, dimensions, notes, hatches; P2.5) move and delete the
// same way; a dimension whose end sits on a moved wall's end goes with it.

export const OBJECT_KINDS = [
  'walls',
  'separators',
  'rooms',
  'openings',
  'stairs',
  'columns',
  'fixtures',
  'lines',
  'dimensions',
  'texts',
  'hatches',
] as const;
export type ObjectKind = (typeof OBJECT_KINDS)[number];

const SCHEMAS = {
  walls: Wall,
  separators: Separator,
  rooms: Room,
  openings: Opening,
  stairs: Stair,
  columns: Column,
  fixtures: Fixture,
  lines: Line,
  dimensions: Dimension,
  texts: TextNote,
  hatches: Hatch,
} as const;

const KIND_WORD: Record<ObjectKind, string> = {
  walls: 'wall',
  separators: 'separator',
  rooms: 'room',
  openings: 'opening',
  stairs: 'stair',
  columns: 'column',
  fixtures: 'fixture',
  lines: 'line',
  dimensions: 'dimension',
  texts: 'note',
  hatches: 'hatch',
};

/** Which map of the level holds `id`. */
export function kindOf(level: Level, id: string): ObjectKind | undefined {
  return OBJECT_KINDS.find((k) => Object.prototype.hasOwnProperty.call(level[k], id));
}

export const idInUse = (plan: Plan, id: string) =>
  id in plan.levels || levelsInOrder(plan).some((l) => kindOf(l, id) !== undefined);

export const LevelParam = Id.optional().describe('Level id; the first level when left out');
export const noLevel = (id?: string) => no(`There is no level ${id} in this plan.`);

// --- Geometry helpers (cm) ----------------------------------------------------------------------

type Pt = readonly [number, number];
const sub = (a: Pt, b: Pt): [number, number] => [a[0] - b[0], a[1] - b[1]];
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
const cross = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0];
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const onGrid = (p: Pt): Point => [roundCm(p[0]), roundCm(p[1])];
const shift = (p: Pt, d: Pt): Point => onGrid([p[0] + d[0], p[1] + d[1]]);
export const JOIN_CM = JOIN_TOLERANCE_MM / 10;

function distToSegment(p: Pt, a: Pt, b: Pt) {
  const ab = sub(b, a);
  const len2 = dot(ab, ab);
  const t = len2 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / len2)) : 0;
  return dist(p, [a[0] + ab[0] * t, a[1] + ab[1] * t]);
}

/** Where the line through p and q meets the line through a and b; null when parallel. */
function meet(p: Pt, q: Pt, a: Pt, b: Pt): [number, number] | null {
  const r = sub(q, p);
  const s = sub(b, a);
  const den = cross(r, s);
  if (Math.abs(den) < 1e-9 * Math.hypot(...r) * Math.hypot(...s)) return null;
  const t = cross(sub(a, p), s) / den;
  return [p[0] + r[0] * t, p[1] + r[1] * t];
}

/** Convex hull (counter-clockwise) of a few points. */
function hull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = (list: Pt[]) => {
    const h: Pt[] = [];
    for (const p of list) {
      while (h.length >= 2 && cross(sub(h.at(-1)!, h.at(-2)!), sub(p, h.at(-2)!)) <= 0) h.pop();
      h.push(p);
    }
    return h.slice(0, -1);
  };
  return [...half(pts), ...half([...pts].reverse())];
}
const inConvex = (p: Pt, poly: Pt[]) =>
  poly.length >= 3 &&
  poly.every((a, i) => cross(sub(poly[(i + 1) % poly.length]!, a), sub(p, a)) >= -1e-9);

/** The corners of a line's band, `half` either side of it. */
function band(a: Pt, b: Pt, half: number): Pt[] {
  const len = dist(a, b) || 1;
  const n: Pt = [((a[1] - b[1]) / len) * half, ((b[0] - a[0]) / len) * half];
  return [
    [a[0] + n[0], a[1] + n[1]],
    [b[0] + n[0], b[1] + n[1]],
    [b[0] - n[0], b[1] - n[1]],
    [a[0] - n[0], a[1] - n[1]],
  ];
}

/** Anything with two ends: a wall or a separator. */
export type Segment = Pick<Wall, 'start' | 'end'>;
export const lineLength = (l: Segment) => dist(l.start, l.end);

/**
 * An opening's offset after its wall changed from `before` to `after`: it keeps its place in the
 * plan when the wall was stretched, and is kept within the wall.
 */
export function keptOffset(o: Opening, before: Segment, after: Segment): number {
  const lb = lineLength(before) || 1;
  const la = lineLength(after) || 1;
  const near: Pt = [
    before.start[0] + ((before.end[0] - before.start[0]) / lb) * o.offset,
    before.start[1] + ((before.end[1] - before.start[1]) / lb) * o.offset,
  ];
  const u: Pt = [(after.end[0] - after.start[0]) / la, (after.end[1] - after.start[1]) / la];
  const along = dot(sub(near, after.start), u);
  return roundCm(Math.max(0, Math.min(Math.max(0, la - o.width), along)));
}

/** A copy of an object without one of its fields. */
export function without<T extends object, K extends keyof T>(o: T, key: K): Omit<T, K> {
  const copy = { ...o };
  delete copy[key];
  return copy;
}

/** Room outlines cached on rooms go stale when the walls change; readers re-derive them. */
export function dropRoomCaches(rooms: Level['rooms']): Level['rooms'] {
  if (!values(rooms).some((r) => r.polygon)) return rooms;
  return Object.fromEntries(
    Object.entries(rooms).map(([k, r]) => [k, r.polygon ? without(r, 'polygon') : r]),
  );
}

// --- MOVE ---------------------------------------------------------------------------------------

const MoveParams = z.strictObject({
  ids: z.array(Id).min(1),
  from: Point,
  to: Point,
  level: LevelParam,
});
type MoveParams = z.infer<typeof MoveParams>;

export function enabledFor(plan: Plan, ids: readonly string[], level?: string): Enabled {
  const l = levelOf(plan, level);
  if (!l) return noLevel(level);
  const missing = ids.filter((id) => !kindOf(l, id));
  if (missing.length)
    return no(
      `Nothing called ${missing.join(', ')} on level ${l.name || l.id}. Select objects on this level.`,
    );
  return OK;
}

/** Translates objects; walls joined to a moved wall stretch so they stay joined. */
export function moveObjects(level: Level, ids: readonly string[], d: Pt): Level {
  const moving = new Set(ids);
  const movedLines: { a: Pt; b: Pt; a2: Pt; b2: Pt; half: number }[] = [];
  const next = {
    ...level,
    walls: { ...level.walls },
    separators: { ...level.separators },
    rooms: { ...level.rooms },
    openings: { ...level.openings },
    stairs: { ...level.stairs },
    columns: { ...level.columns },
    fixtures: { ...level.fixtures },
    lines: { ...level.lines },
    dimensions: { ...level.dimensions },
    texts: { ...level.texts },
    hatches: { ...level.hatches },
  };

  for (const id of moving) {
    const kind = kindOf(level, id);
    if (kind === 'walls' || kind === 'separators') {
      const line = level[kind][id]!;
      const moved = { ...line, start: shift(line.start, d), end: shift(line.end, d) };
      (next[kind] as Record<string, Segment>)[id] = moved;
      const half = kind === 'walls' ? (line as Wall).thickness / 2 : 0;
      movedLines.push({ a: line.start, b: line.end, a2: moved.start, b2: moved.end, half });
    } else if (kind === 'rooms') {
      const r = level.rooms[id]!;
      next.rooms[id] = { ...r, seed: shift(r.seed, d) };
    } else if (kind === 'stairs') {
      const s = level.stairs[id]!;
      next.stairs[id] = { ...s, polygon: s.polygon.map((p) => shift(p, d)) };
    } else if (kind === 'columns') {
      const c = level.columns[id]!;
      next.columns[id] = { ...c, at: shift(c.at, d) };
    } else if (kind === 'fixtures') {
      const f = level.fixtures[id]!;
      next.fixtures[id] = { ...f, at: shift(f.at, d) };
    } else if (kind === 'lines') {
      const l = level.lines[id]!;
      next.lines[id] = { ...l, points: l.points.map((p) => shift(p, d)) };
    } else if (kind === 'dimensions') {
      const m = level.dimensions[id]!;
      next.dimensions[id] = { ...m, start: shift(m.start, d), end: shift(m.end, d) };
    } else if (kind === 'texts') {
      const t = level.texts[id]!;
      next.texts[id] = { ...t, at: shift(t.at, d) };
    } else if (kind === 'hatches') {
      const h = level.hatches[id]!;
      next.hatches[id] = { ...h, polygon: h.polygon.map((p) => shift(p, d)) };
    }
  }

  // Ends of other walls and separators that touch a moved line follow it: an end on a moved
  // end moves with it (L joins); an end on the middle of a moved line slides along its own
  // line to meet the moved line again (T joins). Crossings (X) need nothing.
  const stretched = new Map<string, { before: Segment; after: Segment }>();
  const follow = (p: Pt, other: Pt): Point | null => {
    for (const m of movedLines)
      if (dist(p, m.a) <= JOIN_CM || dist(p, m.b) <= JOIN_CM) return shift(p, d);
    for (const m of movedLines) {
      if (distToSegment(p, m.a, m.b) > JOIN_CM) continue;
      const at = meet(other, p, m.a2, m.b2);
      return at ? onGrid(at) : shift(p, d);
    }
    return null;
  };
  for (const kind of ['walls', 'separators'] as const) {
    for (const line of values(level[kind])) {
      if (moving.has(line.id)) continue;
      const start = follow(line.start, line.end);
      const end = follow(line.end, line.start);
      if (!start && !end) continue;
      const after = { ...line, start: start ?? line.start, end: end ?? line.end };
      (next[kind] as Record<string, Segment>)[line.id] = after;
      if (kind === 'walls') stretched.set(line.id, { before: line, after });
    }
  }

  for (const o of values(level.openings)) {
    const s = stretched.get(o.wall);
    if (s && !moving.has(o.id))
      next.openings[o.id] = { ...o, offset: keptOffset(o, s.before, s.after) };
    else if (moving.has(o.id) && !moving.has(o.wall)) {
      // An opening moves along its wall by the part of the move that runs along the wall.
      const w = next.walls[o.wall];
      if (!w) continue;
      const len = lineLength(w) || 1;
      const u: Pt = [(w.end[0] - w.start[0]) / len, (w.end[1] - w.start[1]) / len];
      const offset = Math.max(0, Math.min(Math.max(0, len - o.width), o.offset + dot(d, u)));
      next.openings[o.id] = { ...o, offset: roundCm(offset) };
    }
  }

  // A dimension measuring from a moved wall's end keeps measuring it.
  for (const m of values(level.dimensions)) {
    if (moving.has(m.id)) continue;
    const on = (p: Pt) =>
      movedLines.some((l) => dist(p, l.a) <= JOIN_CM || dist(p, l.b) <= JOIN_CM);
    if (on(m.start) || on(m.end))
      next.dimensions[m.id] = {
        ...m,
        start: on(m.start) ? shift(m.start, d) : m.start,
        end: on(m.end) ? shift(m.end, d) : m.end,
      };
  }

  // A room label in the path of a moving wall would end up in the room behind it. It moves
  // across the wall's path to the middle of what is left of its room (from the room's outline
  // before the move), so the room keeps its name and shrinks as the architect expects.
  let before: DerivedRoom[] | null = null;
  for (const r of values(level.rooms)) {
    if (moving.has(r.id)) continue;
    const m = movedLines.find((m) =>
      inConvex(r.seed, hull([...band(m.a, m.b, m.half), ...band(m.a2, m.b2, m.half)])),
    );
    if (!m) continue;
    const len = dist(m.a, m.b) || 1;
    let n: Pt = [(m.a[1] - m.b[1]) / len, (m.b[0] - m.a[0]) / len];
    if (dot(d, n) < 0) n = [-n[0], -n[1]];
    const dn = dot(d, n);
    if (dn < 1e-6) continue; // sliding along its own line: nothing is crossed
    before ??= deriveRooms(level).rooms;
    const outline = before.find((x) => x.room_id === r.id)?.outer ?? [];
    const far = Math.max(-Infinity, ...outline.map((v) => dot(sub(v, m.a), n)));
    const face = dn + m.half;
    const target = far > face ? (face + far) / 2 : face + 10;
    const s = dot(sub(r.seed, m.a), n);
    next.rooms[r.id] = {
      ...next.rooms[r.id]!,
      seed: shift(r.seed, [n[0] * (target - s), n[1] * (target - s)]),
    };
  }
  if (movedLines.length || stretched.size) next.rooms = dropRoomCaches(next.rooms);
  return next;
}

export const MOVE = defineCommand<MoveParams>({
  id: 'MOVE',
  label: 'Move',
  aliases: ['M'],
  description:
    'Moves objects by the distance from one point to another. Walls joined to a moved wall stretch to stay joined; doors and windows stay on their wall.',
  params: MoveParams,
  text: [
    { name: 'ids', kind: 'ids' },
    { name: 'from', kind: 'point' },
    { name: 'to', kind: 'point' },
  ],
  enabled: (plan, p) => enabledFor(plan, p.ids, p.level),
  run(plan, p) {
    const level = levelOf(plan, p.level)!;
    const d: Pt = [p.to[0] - p.from[0], p.to[1] - p.from[1]];
    if (!d[0] && !d[1]) return plan;
    return withLevel(plan, moveObjects(level, p.ids, d));
  },
});

// --- DELETE -------------------------------------------------------------------------------------

const DeleteParams = z.strictObject({ ids: z.array(Id).min(1), level: LevelParam });
type DeleteParams = z.infer<typeof DeleteParams>;

export const DELETE = defineCommand<DeleteParams>({
  id: 'DELETE',
  label: 'Delete',
  aliases: ['E', 'ERASE', 'DEL'],
  description:
    'Deletes objects. Deleting a wall also deletes the doors and windows in it, and any loft along it.',
  params: DeleteParams,
  text: [{ name: 'ids', kind: 'ids' }],
  enabled: (plan, p) => enabledFor(plan, p.ids, p.level),
  run(plan, p) {
    const level = levelOf(plan, p.level)!;
    const gone = new Set(p.ids);
    const walls = new Set(p.ids.filter((id) => kindOf(level, id) === 'walls'));
    const keep = <T extends { id: string }>(map: Record<string, T>, also?: (x: T) => boolean) =>
      Object.fromEntries(
        Object.entries(map).filter(([, x]) => !gone.has(x.id) && !(also?.(x) ?? false)),
      );
    const linesChanged = walls.size > 0 || p.ids.some((id) => kindOf(level, id) === 'separators');
    let rooms = keep(level.rooms);
    if (walls.size)
      rooms = Object.fromEntries(
        Object.entries(rooms).map(([k, r]) => [
          k,
          r.loft && walls.has(r.loft.wall) ? without(r, 'loft') : r,
        ]),
      );
    return withLevel(plan, {
      ...level,
      walls: keep(level.walls),
      separators: keep(level.separators),
      rooms: linesChanged ? dropRoomCaches(rooms) : rooms,
      openings: keep(level.openings, (o) => walls.has(o.wall)),
      stairs: keep(level.stairs),
      columns: keep(level.columns),
      fixtures: keep(level.fixtures),
      lines: keep(level.lines),
      dimensions: keep(level.dimensions),
      texts: keep(level.texts),
      hatches: keep(level.hatches),
    });
  },
});

// --- ADD_WALL -----------------------------------------------------------------------------------

const AddWallParams = z.strictObject({
  id: Id,
  start: Point,
  end: Point,
  /** Defaults to an internal wall. */
  type: WallType.optional(),
  /** Defaults to 23 cm for external and compound walls, 11.5 cm for others. */
  thickness: PositiveCm.optional(),
  level: LevelParam,
});
type AddWallParams = z.infer<typeof AddWallParams>;

export const newIdOk = (plan: Plan, id: string): Enabled =>
  idInUse(plan, id) ? no(`The id ${id} is already used; give the new object its own id.`) : OK;

export const ADD_WALL = defineCommand<AddWallParams>({
  id: 'ADD_WALL',
  label: 'Add wall',
  aliases: ['WALL'],
  description:
    'Adds a straight wall between two points (its centreline), with a type and thickness.',
  params: AddWallParams,
  text: [
    { name: 'start', kind: 'point' },
    { name: 'end', kind: 'point' },
    { name: 'thickness', kind: 'number', optional: true },
  ],
  enabled(plan, p) {
    if (!levelOf(plan, p.level)) return noLevel(p.level);
    if (dist(p.start, p.end) < 0.1) return no('A wall needs two different points.');
    return newIdOk(plan, p.id);
  },
  run(plan, p) {
    const level = levelOf(plan, p.level)!;
    const type = p.type ?? 'internal';
    const thickness = p.thickness ?? (type === 'external' || type === 'compound' ? 23 : 11.5);
    const wall: Wall = { id: p.id, start: p.start, end: p.end, thickness, type };
    return withLevel(plan, {
      ...level,
      walls: { ...level.walls, [p.id]: wall },
      rooms: dropRoomCaches(level.rooms),
    });
  },
});

// --- ADD_ROOM -----------------------------------------------------------------------------------

const AddRoomParams = z.strictObject({
  id: Id,
  /** A point inside the walls that enclose the room; also where its label sits. */
  seed: Point,
  type: RoomType,
  name: z.string().optional(),
  level: LevelParam,
});
type AddRoomParams = z.infer<typeof AddRoomParams>;

export const ADD_ROOM = defineCommand<AddRoomParams>({
  id: 'ADD_ROOM',
  label: 'Room label',
  aliases: ['LABEL'],
  description:
    'Names the space enclosed by walls around a point as a room of a type (bedroom, kitchen…). Its outline and area come from the walls.',
  params: AddRoomParams,
  text: [
    { name: 'seed', kind: 'point' },
    { name: 'type', kind: 'word' },
    { name: 'name', kind: 'text', optional: true },
  ],
  enabled(plan, p) {
    if (!levelOf(plan, p.level)) return noLevel(p.level);
    return newIdOk(plan, p.id);
  },
  run(plan, p) {
    const level = levelOf(plan, p.level)!;
    const room: Room = {
      id: p.id,
      type: p.type,
      name: p.name ?? roomTypeLabel(p.type),
      seed: p.seed,
      behavior: 'fixed',
      locked: false,
    };
    return withLevel(plan, { ...level, rooms: { ...level.rooms, [p.id]: room } });
  },
});

// --- ADD_OPENING --------------------------------------------------------------------------------

const AddOpeningParams = z.strictObject({
  id: Id,
  kind: z.enum(['door', 'window', 'ventilator', 'opening']),
  wall: Id,
  /** Distance along the wall from its start to the opening's near edge. */
  offset: NonNegativeCm,
  width: PositiveCm.optional(),
  swing: DoorSwing.optional(),
  sill: NonNegativeCm.optional(),
  height: PositiveCm.optional(),
  level: LevelParam,
});
type AddOpeningParams = z.infer<typeof AddOpeningParams>;

const DEFAULT_WIDTH = { door: 90, window: 120, ventilator: 60, opening: 90 } as const;
const DEFAULT_SILL = { window: 90, ventilator: 180 } as const;

export const ADD_OPENING = defineCommand<AddOpeningParams>({
  id: 'ADD_OPENING',
  label: 'Add door or window',
  description:
    'Puts a door, window, ventilator or plain opening in a wall, at a distance from the wall’s start. It moves with the wall.',
  params: AddOpeningParams,
  text: [
    { name: 'kind', kind: 'word' },
    { name: 'wall', kind: 'id' },
    { name: 'offset', kind: 'number' },
    { name: 'width', kind: 'number', optional: true },
  ],
  enabled(plan, p) {
    const level = levelOf(plan, p.level);
    if (!level) return noLevel(p.level);
    const wall = level.walls[p.wall];
    if (!wall) return no(`There is no wall ${p.wall} on this level to put the ${p.kind} in.`);
    const width = p.width ?? DEFAULT_WIDTH[p.kind];
    const len = lineLength(wall);
    if (p.offset + width > len + 1e-6)
      return no(
        `The ${p.kind} needs ${((p.offset + width) / 100).toFixed(2)} m of wall ${p.wall}, which is ${(len / 100).toFixed(2)} m long. Move it along or make it narrower.`,
      );
    const clash = values(level.openings).find(
      (o) => o.wall === p.wall && p.offset < o.offset + o.width && o.offset < p.offset + width,
    );
    if (clash) return no(`It would overlap ${clash.kind} ${clash.id} on wall ${p.wall}.`);
    return newIdOk(plan, p.id);
  },
  run(plan, p) {
    const level = levelOf(plan, p.level)!;
    const base = {
      id: p.id,
      wall: p.wall,
      offset: p.offset,
      width: p.width ?? DEFAULT_WIDTH[p.kind],
      ...(p.height !== undefined ? { height: p.height } : {}),
    };
    const opening: Opening =
      p.kind === 'door'
        ? { ...base, kind: 'door', swing: p.swing ?? 'in-left' }
        : p.kind === 'opening'
          ? { ...base, kind: 'opening' }
          : { ...base, kind: p.kind, sill: p.sill ?? DEFAULT_SILL[p.kind] };
    return withLevel(plan, { ...level, openings: { ...level.openings, [p.id]: opening } });
  },
});

// --- SET ----------------------------------------------------------------------------------------

const SetParams = z.strictObject({
  id: Id,
  /** Fields to change; `null` removes an optional field. `id` and `kind` can't change. */
  props: z.record(z.string(), z.unknown()),
  level: LevelParam,
});
type SetParams = z.infer<typeof SetParams>;

function setResult(level: Level, p: SetParams): { kind: ObjectKind; value: unknown } | string {
  const kind = kindOf(level, p.id);
  if (!kind) return `Nothing called ${p.id} on level ${level.name || level.id}.`;
  const fixed = ['id', 'kind'].filter((k) => k in p.props);
  if (fixed.length) return `The ${fixed.join(' and ')} of ${p.id} can't be changed.`;
  const merged: Record<string, unknown> = { ...level[kind][p.id] };
  for (const [k, v] of Object.entries(p.props)) {
    if (v === null) delete merged[k];
    else merged[k] = v;
  }
  const parsed = SCHEMAS[kind].safeParse(merged);
  if (!parsed.success) {
    const e = parsed.error.issues[0]!;
    return `${KIND_WORD[kind]} ${p.id}: ${e.path.join('.') || 'value'} ${e.message.toLowerCase()}.`;
  }
  return { kind, value: parsed.data };
}

export const SET = defineCommand<SetParams>({
  id: 'SET',
  label: 'Change properties',
  description:
    'Changes properties of one object, e.g. a wall’s thickness or type, a room’s name or type, a door’s width or swing.',
  params: SetParams,
  text: [{ name: 'id', kind: 'id' }],
  textProps: 'props',
  enabled(plan, p) {
    const level = levelOf(plan, p.level);
    if (!level) return noLevel(p.level);
    const r = setResult(level, p);
    return typeof r === 'string' ? no(r) : OK;
  },
  run(plan, p) {
    const level = levelOf(plan, p.level)!;
    const r = setResult(level, p);
    if (typeof r === 'string') throw new Error(r);
    const lines = r.kind === 'walls' || r.kind === 'separators';
    const next: Level = { ...level, [r.kind]: { ...level[r.kind], [p.id]: r.value } };
    return withLevel(plan, lines ? { ...next, rooms: dropRoomCaches(next.rooms) } : next);
  },
});

/** The P2.4 commands, by id (the whole set is `PLAN_COMMANDS` in `registry.ts`). */
export const BASIC_COMMANDS: Record<string, AnyCommand> = Object.fromEntries(
  [MOVE, DELETE, ADD_WALL, ADD_ROOM, ADD_OPENING, SET].map((c) => [c.id, c]),
);
