import type {
  CommandRequest,
  DerivedRoom,
  HatchPattern,
  Level,
  Pick,
  Point,
  RoomTypeId,
  WallType,
} from '@plancraft/engine';
import { parseLength, typedPoint } from '@plancraft/engine';

// The drawing and modifying tools (P2.5). Each tool turns clicks (or typed values, A2 M5) into
// engine commands; every command is one undo step. This module is pure: the editor gives it the
// tool's state, a click or text, and context, and gets back the next state, an optional command
// to run, and what to tell the user. What a tool shows while you work comes from `toolPreview`:
// simple shapes for drawing tools, or a command the editor previews through the engine (move,
// copy, rotate, mirror, offset, door, dimension), so the preview is exactly what you'll get.

export type ToolId =
  | 'select'
  | 'wall'
  | 'room'
  | 'label'
  | 'door'
  | 'window'
  | 'stair'
  | 'separator'
  | 'line'
  | 'rectangle'
  | 'dimension'
  | 'text'
  | 'hatch'
  | 'move'
  | 'copy'
  | 'rotate'
  | 'mirror'
  | 'offset'
  | 'trim'
  | 'extend'
  | 'delete';

export interface ToolInfo {
  id: ToolId;
  label: string;
  /** The key that picks it (single key; `shift` adds Shift). */
  key: string;
  shift?: boolean;
  group: 'select' | 'build' | 'draw' | 'modify';
}

/** The toolbar, in order. Keys follow AutoCAD where they can (M move, C copy, O offset, E erase). */
export const TOOL_LIST: ToolInfo[] = [
  { id: 'select', label: 'Select', key: 'V', group: 'select' },
  { id: 'wall', label: 'Wall', key: 'W', group: 'build' },
  { id: 'room', label: 'Room', key: 'R', group: 'build' },
  { id: 'label', label: 'Room label', key: 'A', group: 'build' },
  { id: 'door', label: 'Door', key: 'D', group: 'build' },
  { id: 'window', label: 'Window', key: 'N', group: 'build' },
  { id: 'stair', label: 'Stair', key: 'S', group: 'build' },
  { id: 'separator', label: 'Room separator', key: 'P', group: 'build' },
  { id: 'line', label: 'Line / polyline', key: 'L', group: 'draw' },
  { id: 'rectangle', label: 'Rectangle', key: 'B', group: 'draw' },
  { id: 'dimension', label: 'Dimension', key: 'D', shift: true, group: 'draw' },
  { id: 'text', label: 'Note', key: 'T', group: 'draw' },
  { id: 'hatch', label: 'Hatch', key: 'H', group: 'draw' },
  { id: 'move', label: 'Move', key: 'M', group: 'modify' },
  { id: 'copy', label: 'Copy', key: 'C', group: 'modify' },
  { id: 'rotate', label: 'Rotate', key: 'Q', group: 'modify' },
  { id: 'mirror', label: 'Mirror', key: 'I', group: 'modify' },
  { id: 'offset', label: 'Offset', key: 'O', group: 'modify' },
  { id: 'trim', label: 'Trim', key: 'X', group: 'modify' },
  { id: 'extend', label: 'Extend', key: 'X', shift: true, group: 'modify' },
  { id: 'delete', label: 'Delete', key: 'E', group: 'modify' },
];
export const keyLabel = (t: ToolInfo) => (t.shift ? `⇧${t.key}` : t.key);
export const toolInfo = (id: ToolId) => TOOL_LIST.find((t) => t.id === id)!;

export interface ToolOptions {
  wallType: WallType;
  roomType: RoomTypeId;
  hatch: HatchPattern;
}
export const DEFAULT_OPTIONS: ToolOptions = {
  wallType: 'internal',
  roomType: 'bedroom',
  hatch: 'diagonal',
};

export interface ToolState {
  /** Points placed so far in this operation. */
  points: Point[];
  /** The object a modify tool works on. */
  target: Pick | null;
  /** The note tool waits for its text. */
  asking?: 'text';
}
export const IDLE: ToolState = { points: [], target: null };

export interface ToolContext {
  level: Level;
  /** Rooms with their outlines, for hatching a room. */
  rooms: readonly DerivedRoom[];
  selected: Pick | null;
  options: ToolOptions;
  /** A new object id (from the host's IdSource, A2 M2). */
  newId(): string;
}

/** What a click, a typed value or Enter did. */
export interface ToolStep {
  state: ToolState;
  request?: CommandRequest;
  /** Select this object (a modify tool picked its target). */
  select?: Pick;
  /** Something to tell the user (why nothing happened). */
  message?: string;
  /** The operation is over: go back to the Select tool. */
  done?: boolean;
}

export interface ToolInput {
  point: Point;
  /** What is under the cursor (null for a typed point). */
  pick: Pick | null;
  /** Shift: keep straight / snap angles to 15°. */
  shift?: boolean;
}

const run = (id: string, params: unknown): CommandRequest => ({ op: 'execute', id, params });
const same = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.5;
const mm = (n: number) => Math.round(n * 10) / 10;
const LINES = new Set<Pick['kind']>(['wall', 'separator', 'line']);
const PICKABLE_TARGET = new Set<Pick['kind']>([
  'wall',
  'separator',
  'room',
  'opening',
  'column',
  'stair',
  'line',
  'dimension',
  'text',
  'hatch',
]);

/** With Shift, the point lines up horizontally or vertically with `from`. */
export function straighten(from: Point, p: Point): Point {
  return Math.abs(p[0] - from[0]) >= Math.abs(p[1] - from[1]) ? [p[0], from[1]] : [from[0], p[1]];
}

/** Degrees from east to `p` around `c`; with Shift, to the nearest 15°. */
function angleTo(c: Point, p: Point, shift = false) {
  const a = (Math.atan2(p[1] - c[1], p[0] - c[0]) * 180) / Math.PI;
  return shift ? Math.round(a / 15) * 15 : Math.round(a * 10) / 10;
}

/** The two ends of a wall, separator or line (its first segment for a polyline). */
function endsOf(level: Level, pick: Pick): [Point, Point] | null {
  if (pick.kind === 'wall') {
    const w = level.walls[pick.id];
    return w ? [w.start, w.end] : null;
  }
  if (pick.kind === 'separator') {
    const s = level.separators[pick.id];
    return s ? [s.start, s.end] : null;
  }
  if (pick.kind === 'line') {
    const l = level.lines[pick.id];
    return l ? [l.points[0]!, l.points[1]!] : null;
  }
  return null;
}

/** Signed distance of `p` from the line through a and b (positive on the left). */
function side(a: Point, b: Point, p: Point) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / len;
}

/** For tools that need an object: the selection, or what was clicked. */
function needTarget(tool: ToolId, input: ToolInput | null, ctx: ToolContext, lines = false) {
  const ok = (p: Pick | null): p is Pick =>
    !!p && (lines ? LINES.has(p.kind) : PICKABLE_TARGET.has(p.kind));
  if (ok(ctx.selected)) return ctx.selected;
  if (input && ok(input.pick)) return input.pick;
  return null;
}

/** What the prompt line says: what the tool wants next. */
export function toolPrompt(tool: ToolId, s: ToolState): string {
  const n = s.points.length;
  switch (tool) {
    case 'select':
      return '';
    case 'wall':
      return n === 0
        ? 'Click where the wall starts, or type x,y'
        : 'Click the next point, or type a length (450, 4.5m) or @dx,dy · Enter to stop';
    case 'line':
      return n === 0
        ? 'Click the first point, or type x,y'
        : 'Click the next point or type a length · click the first point to close · Enter to finish';
    case 'separator':
      return n === 0 ? 'Click where the separator starts' : 'Click its end, or type a length';
    case 'rectangle':
    case 'room':
    case 'stair':
      return n === 0
        ? 'Click one corner, or type x,y'
        : 'Click the opposite corner, or type @width,depth';
    case 'label':
      return 'Click inside walls to name that space as a room';
    case 'door':
    case 'window':
      return `Click on a wall to put the ${tool} there`;
    case 'dimension':
      return n === 0
        ? 'Click the first point to measure from'
        : n === 1
          ? 'Click the second point, or type a length'
          : 'Click where the dimension line goes, or type its distance';
    case 'text':
      return s.asking ? 'Type the note and press Enter' : 'Click where the note goes';
    case 'hatch':
      return 'Click inside a room (or a closed rectangle) to hatch it';
    case 'move':
    case 'copy':
      return !s.target
        ? `Click the object to ${tool}`
        : n === 0
          ? 'Click the base point'
          : `Click where it goes, or type a length or @dx,dy${tool === 'copy' ? ' · Esc to stop' : ''}`;
    case 'rotate':
      return !s.target
        ? 'Click the object to rotate'
        : n === 0
          ? 'Click the point to turn it about'
          : 'Click to set the angle, or type degrees (90, -45) · Shift for 15° steps';
    case 'mirror':
      return !s.target
        ? 'Click the object to mirror'
        : n === 0
          ? 'Click the first point of the mirror line'
          : 'Click the second point of the mirror line';
    case 'offset':
      return !s.target
        ? 'Click the wall, separator or line to offset'
        : 'Click the side to put the copy on, or type its distance';
    case 'trim':
      return 'Click the part of a wall or line to cut away';
    case 'extend':
      return 'Click near the end of a wall or line to extend it';
    case 'delete':
      return 'Click an object to delete it';
  }
}

/** A click on the canvas (or a typed point) while `tool` is active. */
export function toolClick(
  tool: ToolId,
  s: ToolState,
  input: ToolInput,
  ctx: ToolContext,
): ToolStep {
  const last = s.points.at(-1);
  const p = input.shift && last ? straighten(last, input.point) : input.point;
  const { options: o } = ctx;
  const twoPoint = (make: (a: Point, b: Point) => CommandRequest): ToolStep =>
    !last
      ? { state: { ...s, points: [p] } }
      : same(last, p)
        ? { state: s }
        : { state: IDLE, request: make(last, p) };

  switch (tool) {
    case 'select':
      return { state: s };
    case 'wall': {
      if (!last) return { state: { ...s, points: [p] } };
      if (same(last, p)) return { state: s };
      const request = run('ADD_WALL', { id: ctx.newId(), start: last, end: p, type: o.wallType });
      // Clicking where the chain started closes it.
      return same(s.points[0]!, p) && s.points.length > 1
        ? { state: IDLE, request }
        : { state: { ...s, points: [...s.points, p] }, request };
    }
    case 'line': {
      if (last && same(last, p)) return { state: s };
      if (s.points.length >= 3 && same(s.points[0]!, p))
        return {
          state: IDLE,
          request: run('ADD_LINE', { id: ctx.newId(), points: s.points, closed: true }),
        };
      return { state: { ...s, points: [...s.points, p] } };
    }
    case 'separator':
      return twoPoint((a, b) => run('ADD_SEPARATOR', { id: ctx.newId(), start: a, end: b }));
    case 'rectangle':
      return twoPoint((a, b) => run('RECTANGLE', { id: ctx.newId(), corner: a, opposite: b }));
    case 'room':
      return twoPoint((a, b) =>
        run('ROOM', { id: ctx.newId(), corner: a, opposite: b, type: o.roomType }),
      );
    case 'stair':
      return twoPoint((a, b) => run('ADD_STAIR', { id: ctx.newId(), corner: a, opposite: b }));
    case 'label':
      return {
        state: IDLE,
        request: run('ADD_ROOM', { id: ctx.newId(), seed: p, type: o.roomType }),
      };
    case 'door':
    case 'window': {
      const r = openingAt(tool, input, ctx);
      return 'message' in r
        ? { state: IDLE, message: r.message }
        : { state: IDLE, request: r.request };
    }
    case 'dimension': {
      if (s.points.length < 2) {
        if (last && same(last, p)) return { state: s };
        return { state: { ...s, points: [...s.points, p] } };
      }
      const [a, b] = s.points as [Point, Point];
      return {
        state: IDLE,
        request: run('ADD_DIMENSION', {
          id: ctx.newId(),
          start: a,
          end: b,
          offset: mm(side(a, b, input.point)),
        }),
      };
    }
    case 'text':
      return { state: { ...IDLE, points: [p], asking: 'text' } };
    case 'hatch': {
      const polygon = hatchArea(input, ctx);
      return polygon
        ? { state: IDLE, request: run('ADD_HATCH', { id: ctx.newId(), polygon, pattern: o.hatch }) }
        : { state: IDLE, message: 'Click inside a room or a closed rectangle to hatch it.' };
    }
    case 'trim':
    case 'extend':
    case 'delete': {
      const pick = input.pick;
      if (!pick || (tool !== 'delete' && !LINES.has(pick.kind)))
        return {
          state: IDLE,
          message:
            tool === 'delete'
              ? 'Click an object to delete it.'
              : 'Click a wall, a separator or a line.',
        };
      if (tool === 'delete') return { state: IDLE, request: run('DELETE', { ids: [pick.id] }) };
      if (tool === 'trim')
        return {
          state: IDLE,
          request: run('TRIM', { target: pick.id, at: input.point, id: ctx.newId() }),
        };
      const ends = endsOf(ctx.level, pick);
      if (!ends) return { state: IDLE, message: 'Click a wall, a separator or a straight line.' };
      const end =
        Math.hypot(...sub(input.point, ends[0])) < Math.hypot(...sub(input.point, ends[1]))
          ? 'start'
          : 'end';
      return { state: IDLE, request: run('EXTEND', { target: pick.id, end }) };
    }
    case 'move':
    case 'copy':
    case 'rotate':
    case 'mirror':
    case 'offset':
      return modifyClick(tool, s, { ...input, point: p }, ctx);
  }
}

const sub = (a: Point, b: Point): [number, number] => [a[0] - b[0], a[1] - b[1]];

function modifyClick(
  tool: 'move' | 'copy' | 'rotate' | 'mirror' | 'offset',
  s: ToolState,
  input: ToolInput,
  ctx: ToolContext,
): ToolStep {
  if (!s.target) {
    const target = needTarget(tool, input, ctx, tool === 'offset');
    if (!target)
      return {
        state: s,
        message:
          tool === 'offset'
            ? 'Click a wall, a separator or a line to offset.'
            : `Click the object to ${tool}.`,
      };
    // A click that picked the object only chooses it; a selected object goes straight on.
    if (target === ctx.selected) return modifyClick(tool, { ...s, target }, input, ctx);
    return { state: { ...s, target }, select: target };
  }
  const id = s.target.id;
  const p = input.point;
  const last = s.points.at(-1);
  if (tool === 'offset') {
    const ends = endsOf(ctx.level, s.target);
    if (!ends) return { state: IDLE, message: 'Offset works on walls, separators and lines.' };
    const distance = mm(side(ends[0], ends[1], p));
    if (!distance) return { state: s };
    return {
      state: IDLE,
      request: run('OFFSET', { source: id, distance, id: ctx.newId() }),
      done: true,
    };
  }
  if (!last) return { state: { ...s, points: [p] } };
  if (same(last, p)) return { state: s };
  switch (tool) {
    case 'move':
      return { state: IDLE, request: run('MOVE', { ids: [id], from: last, to: p }), done: true };
    case 'copy':
      // Copy keeps going from the same base point until Esc.
      return { state: s, request: run('COPY', { ids: [id], from: last, to: p, id: ctx.newId() }) };
    case 'rotate': {
      const angle = angleTo(last, p, input.shift);
      return angle
        ? { state: IDLE, request: run('ROTATE', { ids: [id], center: last, angle }), done: true }
        : { state: s };
    }
    case 'mirror':
      return {
        state: IDLE,
        request: run('MIRROR', { ids: [id], a: last, b: p, id: ctx.newId() }),
        done: true,
      };
  }
}

/** A door or window placed where the wall was clicked, centred on the click. */
function openingAt(
  kind: 'door' | 'window',
  input: ToolInput,
  ctx: ToolContext,
): { request: CommandRequest } | { message: string } {
  const pick = input.pick;
  const w = pick?.kind === 'wall' ? ctx.level.walls[pick.id] : undefined;
  if (!w) return { message: `Click on a wall to put the ${kind} in.` };
  const width = kind === 'door' ? 90 : 120;
  const len = Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]);
  if (len < width) return { message: `Wall ${w.id} is too short for a ${width} cm ${kind}.` };
  const along =
    ((input.point[0] - w.start[0]) * (w.end[0] - w.start[0]) +
      (input.point[1] - w.start[1]) * (w.end[1] - w.start[1])) /
    len;
  const offset = mm(Math.max(0, Math.min(len - width, along - width / 2)));
  return { request: run('ADD_OPENING', { id: ctx.newId(), kind, wall: w.id, offset }) };
}

function inside(p: Point, ring: readonly Point[]) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** The outline a hatch click means: the room around it, or a closed line around it. */
function hatchArea(input: ToolInput, ctx: ToolContext): Point[] | null {
  const room = ctx.rooms.find((r) => r.outer.length >= 3 && inside(input.point, r.outer));
  const round = (q: Point): Point => [mm(q[0]), mm(q[1])];
  if (room) return room.outer.map(round);
  for (const l of Object.values(ctx.level.lines))
    if (l.closed && l.points.length >= 3 && inside(input.point, l.points)) return l.points;
  return null;
}

/** Enter: finishes a polyline or ends a wall chain. Esc does the same, then leaves the tool. */
export function toolFinish(tool: ToolId, s: ToolState, ctx: ToolContext): ToolStep {
  if (tool === 'line' && s.points.length >= 2)
    return { state: IDLE, request: run('ADD_LINE', { id: ctx.newId(), points: s.points }) };
  return { state: IDLE };
}

/** A typed entry (A2 M5): a point, length or angle for the current step, or a note's text. */
export function toolTyped(
  tool: ToolId,
  s: ToolState,
  text: string,
  cursor: Point | null,
  ctx: ToolContext,
): ToolStep {
  if (tool === 'text' && s.asking) {
    const note = text.trim();
    if (!note) return { state: s, message: 'Type the note first.' };
    return {
      state: IDLE,
      request: run('ADD_TEXT', { id: ctx.newId(), at: s.points[0]!, text: note }),
    };
  }
  const last = s.points.at(-1) ?? null;
  if (tool === 'rotate' && s.target && last) {
    const angle = Number(text.replace('°', ''));
    if (!Number.isFinite(angle) || !angle)
      return { state: s, message: `"${text}" is not an angle; type degrees, e.g. 90 or -45.` };
    return {
      state: IDLE,
      request: run('ROTATE', { ids: [s.target.id], center: last, angle }),
      done: true,
    };
  }
  if ((tool === 'offset' && s.target) || (tool === 'dimension' && s.points.length === 2)) {
    const len = parseLength(text);
    if (len === null)
      return { state: s, message: `"${text}" is not a distance; type e.g. 60 or 1.2m.` };
    const [a, b] = tool === 'offset' ? endsOf(ctx.level, s.target!)! : (s.points as [Point, Point]);
    const sign = cursor && side(a, b, cursor) < 0 ? -1 : 1;
    const at: Point = [
      a[0] + ((a[1] - b[1]) / Math.hypot(...sub(b, a))) * len * sign,
      a[1] + ((b[0] - a[0]) / Math.hypot(...sub(b, a))) * len * sign,
    ];
    return toolClick(tool, s, { point: at, pick: null }, ctx);
  }
  const typed = typedPoint(text, { last, toward: cursor });
  if (!typed.ok) return { state: s, message: typed.message };
  return toolClick(tool, s, { point: typed.point, pick: null }, ctx);
}

/** What the canvas shows while a tool works, besides the snap marker. */
export type PreviewShape =
  | { kind: 'band'; a: Point; b: Point; thickness: number }
  | { kind: 'path'; points: Point[]; closed?: boolean }
  | { kind: 'dot'; at: Point };

export interface ToolPreview {
  shapes: PreviewShape[];
  /** A command whose result the editor previews through the engine. */
  request?: CommandRequest;
}

export function toolPreview(
  tool: ToolId,
  s: ToolState,
  cursor: Point | null,
  ctx: ToolContext,
  shift = false,
): ToolPreview {
  const last = s.points.at(-1);
  const at = cursor && last && shift ? straighten(last, cursor) : cursor;
  const dots = s.points.map((p): PreviewShape => ({ kind: 'dot', at: p }));
  if (!at) return { shapes: dots };
  const rectFrom = (a: Point): PreviewShape => ({
    kind: 'path',
    points: [a, [at[0], a[1]], at, [a[0], at[1]]],
    closed: true,
  });
  switch (tool) {
    case 'wall':
      return last
        ? {
            shapes: [
              ...dots,
              {
                kind: 'band',
                a: last,
                b: at,
                thickness:
                  ctx.options.wallType === 'internal' || ctx.options.wallType === 'parapet'
                    ? 11.5
                    : 23,
              },
            ],
          }
        : { shapes: dots };
    case 'line':
    case 'separator':
      return {
        shapes: s.points.length ? [{ kind: 'path', points: [...s.points, at] }, ...dots] : dots,
      };
    case 'rectangle':
    case 'room':
    case 'stair':
      return { shapes: last ? [rectFrom(last), ...dots] : dots };
    case 'dimension': {
      if (s.points.length < 2)
        return { shapes: last ? [{ kind: 'path', points: [last, at] }, ...dots] : dots };
      const [a, b] = s.points as [Point, Point];
      return {
        shapes: dots,
        request: run('ADD_DIMENSION', {
          id: 'preview',
          start: a,
          end: b,
          offset: mm(side(a, b, at)) || 1,
        }),
      };
    }
    case 'door':
    case 'window':
      return { shapes: [] };
    default:
      break;
  }
  if (!s.target) return { shapes: dots };
  const id = s.target.id;
  if (tool === 'offset') {
    const ends = endsOf(ctx.level, s.target);
    const distance = ends ? mm(side(ends[0], ends[1], at)) : 0;
    return distance
      ? { shapes: [], request: run('OFFSET', { source: id, distance, id: 'preview' }) }
      : { shapes: [] };
  }
  if (!last) return { shapes: dots };
  const guide: PreviewShape = { kind: 'path', points: [last, at] };
  switch (tool) {
    case 'move':
      return { shapes: [guide], request: run('MOVE', { ids: [id], from: last, to: at }) };
    case 'copy':
      return {
        shapes: [guide],
        request: run('COPY', { ids: [id], from: last, to: at, id: 'preview' }),
      };
    case 'rotate': {
      const angle = angleTo(last, cursor!, shift);
      return {
        shapes: [guide, ...dots],
        ...(angle ? { request: run('ROTATE', { ids: [id], center: last, angle }) } : {}),
      };
    }
    case 'mirror':
      return same(last, at)
        ? { shapes: dots }
        : {
            shapes: [guide, ...dots],
            request: run('MIRROR', { ids: [id], a: last, b: at, id: 'preview' }),
          };
    default:
      return { shapes: dots };
  }
}

/** Where a click goes: the point to snap from (perpendicular snaps), when the tool has one. */
export const snapFrom = (s: ToolState): Point | undefined => s.points.at(-1);
