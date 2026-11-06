import { wallOutlinesCm } from '../geometry/wall-outlines.ts';
import type { DerivedRoom } from '../rooms/derive.ts';
import { firstLevel, values } from '../schema/collections.ts';
import type {
  Column,
  Dimension,
  Hatch,
  Level,
  Opening,
  Plan,
  Stair,
  TextNote,
  Wall,
} from '../schema/plan.ts';
import type { Point } from '../schema/primitives.ts';
import { boxAround, type Box } from '../spatial/rtree.ts';

// Drawing geometry for hosts (P2.3: "the canvas draws what the engine returns"): what a plan
// view shows, in cm with y pointing north, so every editor draws a plan the same way. Opening
// symbols match the DXF export's blocks (D-19): a door is its leaf open at 90° plus the swing
// arc, hinged on the wall centreline; a window is three lines, a ventilator two, a plain
// opening one. Hosts flip y for the screen and pick the styles.

/** A circular arc, anticlockwise from `start` to `end` (degrees from +x, plan axes). */
export interface Arc {
  center: Point;
  radius: number;
  start: number;
  end: number;
}

export interface OpeningSymbol {
  id: string;
  kind: Opening['kind'];
  wall: string;
  /** The opening's gap in the wall (four corners), for hit-testing and highlighting. */
  frame: Point[];
  lines: [Point, Point][];
  arcs: Arc[];
}

export interface StairSymbol {
  id: string;
  outline: Point[];
  /** Tread lines across the longer side, as in the DXF export. */
  treads: [Point, Point][];
  label: 'UP' | 'DN';
  labelAt: Point;
}

export interface RoomShape {
  id: string;
  name: string;
  /** Clear floor outline; empty when walls don't enclose the room. */
  outer: Point[];
  holes: Point[][];
  /** Where the label goes (the room's seed point). */
  labelAt: Point;
  area_m2?: number;
}

/** A dimension as drawn: extension lines, the dimension line, 45° ticks and the text spot. */
export interface DimensionSymbol {
  id: string;
  /** What it measures, cm (hosts format it in their units). */
  length: number;
  line: [Point, Point];
  extensions: [Point, Point][];
  ticks: [Point, Point][];
  /** Centre of the text, on the outer side of the line. */
  textAt: Point;
  /** Text direction in degrees, turned so it never reads upside down. */
  angle: number;
  /** Text height, cm. */
  size: number;
}

/** A note as drawn: its text centred on `at`, and the box it takes (for picking). */
export interface TextSymbol {
  id: string;
  at: Point;
  text: string;
  size: number;
  angle: number;
  box: Point[];
}

export interface PlanDrawing {
  /** Everything drawn, so a view can fit it. */
  bounds: Box;
  plot: Point[];
  /** All walls as joined outlines with openings cut out (`wallOutlinesCm`). */
  walls: Point[][];
  /** Each wall on its own (centreline and band), for selection and highlighting. */
  wallShapes: { id: string; centreline: [Point, Point]; band: Point[] }[];
  openings: OpeningSymbol[];
  columns: { id: string; outline: Point[] }[];
  stairs: StairSymbol[];
  separators: { id: string; line: [Point, Point] }[];
  rooms: RoomShape[];
  /** Annotations (P2.5): drafting lines, dimensions, notes and hatched areas. */
  lines: { id: string; points: Point[]; closed: boolean }[];
  dimensions: DimensionSymbol[];
  texts: TextSymbol[];
  hatches: { id: string; polygon: Point[]; pattern: Hatch['pattern'] }[];
}

/** A wall's frame: unit direction, left normal and a point at distance `d` along it. */
export function wallFrame(w: Pick<Wall, 'start' | 'end'>) {
  const len = Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]);
  const u: Point = [(w.end[0] - w.start[0]) / len, (w.end[1] - w.start[1]) / len];
  const n: Point = [-u[1], u[0]];
  const at = (d: number, side = 0): Point => [
    w.start[0] + u[0] * d + n[0] * side,
    w.start[1] + u[1] * d + n[1] * side,
  ];
  return { len, u, n, at };
}

/** The band a wall (or a stretch of it, from `a` to `b` along it) covers. */
export function wallBand(w: Pick<Wall, 'start' | 'end' | 'thickness'>, a = 0, b?: number): Point[] {
  const { len, at } = wallFrame(w);
  const h = w.thickness / 2;
  const e = b ?? len;
  return [at(a, -h), at(e, -h), at(e, h), at(a, h)];
}

/** Direction of v in degrees, 0 to under 360. */
const deg = (v: Point) => ((((Math.atan2(v[1], v[0]) * 180) / Math.PI) % 360) + 360) % 360;

export function openingSymbol(o: Opening, w: Wall): OpeningSymbol {
  const { u, n, at } = wallFrame(w);
  const t = w.thickness;
  const frame = wallBand(w, o.offset, o.offset + o.width);
  const along = (side: number): [Point, Point] => [
    at(o.offset, side),
    at(o.offset + o.width, side),
  ];
  const base = { id: o.id, kind: o.kind, wall: w.id, frame };
  switch (o.kind) {
    case 'door': {
      // Hinge at the opening's start for "-left", at its end for "-right"; "in" swings to the
      // left of the wall's direction, "out" to the right.
      const right = o.swing.endsWith('right');
      const side = o.swing.startsWith('in') ? 1 : -1;
      const hinge = at(right ? o.offset + o.width : o.offset);
      const closed: Point = right ? [-u[0], -u[1]] : u;
      const open: Point = [n[0] * side, n[1] * side];
      const tip: Point = [hinge[0] + open[0] * o.width, hinge[1] + open[1] * o.width];
      // The swing turns anticlockwise from closed to open when the two make a right-handed pair.
      const ccw = closed[0] * open[1] - closed[1] * open[0] > 0;
      const [start, end] = ccw ? [deg(closed), deg(open)] : [deg(open), deg(closed)];
      return {
        ...base,
        lines: [[hinge, tip]],
        arcs: [{ center: hinge, radius: o.width, start, end }],
      };
    }
    case 'window':
      return { ...base, lines: [along(-t / 4), along(0), along(t / 4)], arcs: [] };
    case 'ventilator':
      return { ...base, lines: [along(-t / 5), along(t / 5)], arcs: [] };
    case 'opening':
      return { ...base, lines: [along(0)], arcs: [] };
  }
}

/** A column's corners, rotated about its centre. */
export function columnCorners(c: Column): Point[] {
  const r = (c.rotation_deg * Math.PI) / 180;
  return (
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const
  ).map(([sx, sy]): Point => {
    const dx = (sx * c.size[0]) / 2;
    const dy = (sy * c.size[1]) / 2;
    return [
      c.at[0] + dx * Math.cos(r) - dy * Math.sin(r),
      c.at[1] + dx * Math.sin(r) + dy * Math.cos(r),
    ];
  });
}

/** Stair outline, treads every 25 cm (or `steps`) across the longer side, and UP / DN. */
export function stairSymbol(s: Stair): StairSymbol {
  const xs = s.polygon.map((q) => q[0]);
  const ys = s.polygon.map((q) => q[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const alongX = x1 - x0 > y1 - y0;
  const run = alongX ? x1 - x0 : y1 - y0;
  const steps = s.steps ?? Math.max(1, Math.floor(run / 25));
  const treads: [Point, Point][] = [];
  for (let i = 1; i < steps; i++) {
    const d = (run * i) / steps;
    treads.push(
      alongX
        ? [
            [x0 + d, y0],
            [x0 + d, y1],
          ]
        : [
            [x0, y0 + d],
            [x1, y0 + d],
          ],
    );
  }
  return {
    id: s.id,
    outline: s.polygon,
    treads,
    label: s.direction === 'up' ? 'UP' : 'DN',
    labelAt: [(x0 + x1) / 2, (y0 + y1) / 2],
  };
}

/** Dimension text height and the gaps around it, cm (2 mm text at 1:100). */
const DIM_TEXT = 20;
const DIM_GAP = 5;
const DIM_OVER = 10;
const TICK = 12;
/** Readable text direction: within −90° … 90°. */
const readable = (a: number) => {
  const r = ((a % 360) + 360) % 360;
  return r > 90 && r <= 270 ? r - 180 : r > 270 ? r - 360 : r;
};

export function dimensionSymbol(m: Dimension): DimensionSymbol {
  const length = Math.hypot(m.end[0] - m.start[0], m.end[1] - m.start[1]);
  const u: Point = length
    ? [(m.end[0] - m.start[0]) / length, (m.end[1] - m.start[1]) / length]
    : [1, 0];
  const n: Point = [-u[1], u[0]];
  const side = m.offset < 0 ? -1 : 1;
  const at = (p: Point, d: number): Point => [p[0] + n[0] * d, p[1] + n[1] * d];
  const p1 = at(m.start, m.offset);
  const p2 = at(m.end, m.offset);
  const gap = Math.min(DIM_GAP, Math.abs(m.offset)) * side;
  const t: Point = [
    ((u[0] + n[0]) * TICK) / 2 / Math.SQRT2,
    ((u[1] + n[1]) * TICK) / 2 / Math.SQRT2,
  ];
  const tick = (p: Point): [Point, Point] => [
    [p[0] - t[0], p[1] - t[1]],
    [p[0] + t[0], p[1] + t[1]],
  ];
  const mid: Point = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
  return {
    id: m.id,
    length,
    line: [p1, p2],
    extensions: [
      [at(m.start, gap), at(m.start, m.offset + DIM_OVER * side)],
      [at(m.end, gap), at(m.end, m.offset + DIM_OVER * side)],
    ],
    ticks: [tick(p1), tick(p2)],
    textAt: at(mid, DIM_TEXT * 0.75 * side),
    angle: readable((Math.atan2(u[1], u[0]) * 180) / Math.PI),
    size: DIM_TEXT,
  };
}

/** A note's box: about 0.6 × size per character wide, size high, centred on `at`, turned. */
export function textSymbol(t: TextNote): TextSymbol {
  const w = Math.max(1, t.text.length) * t.size * 0.6;
  const h = t.size;
  const r = (t.rotation_deg * Math.PI) / 180;
  const [c, s] = [Math.cos(r), Math.sin(r)];
  const corner = (x: number, y: number): Point => [
    t.at[0] + x * c - y * s,
    t.at[1] + x * s + y * c,
  ];
  return {
    id: t.id,
    at: t.at,
    text: t.text,
    size: t.size,
    angle: t.rotation_deg,
    box: [
      corner(-w / 2, -h / 2),
      corner(w / 2, -h / 2),
      corner(w / 2, h / 2),
      corner(-w / 2, h / 2),
    ],
  };
}

/**
 * Everything a plan view draws for one level (the first by default), given the rooms derived
 * from it (`validatePlan(plan).rooms` or `deriveRooms(level).rooms`).
 */
export function planDrawing(plan: Plan, rooms: readonly DerivedRoom[], level?: Level): PlanDrawing {
  const lvl = level ?? firstLevel(plan);
  const walls = wallOutlinesCm(lvl);
  const openings = values(lvl.openings).flatMap((o) => {
    const w = lvl.walls[o.wall];
    return w ? [openingSymbol(o, w)] : [];
  });
  const columns = values(lvl.columns).map((c) => ({ id: c.id, outline: columnCorners(c) }));
  const stairs = values(lvl.stairs).map(stairSymbol);
  const derived = new Map(rooms.map((r) => [r.room_id, r]));
  const roomShapes = values(lvl.rooms).map((room): RoomShape => {
    const d = derived.get(room.id);
    return {
      id: room.id,
      name: room.name,
      outer: d?.outer ?? [],
      holes: d?.holes ?? [],
      labelAt: room.seed,
      ...(d ? { area_m2: d.area_m2 } : {}),
    };
  });
  // Door swings can reach past the walls; a quarter circle lies inside the square on its ends.
  const swings = openings.flatMap((o) =>
    o.arcs.flatMap(({ center: [cx, cy], radius: r, start, end }): Point[] => {
      const [a, b] = [start, end].map((d): Point => [
        Math.cos((d * Math.PI) / 180) * r,
        Math.sin((d * Math.PI) / 180) * r,
      ]) as [Point, Point];
      return [
        [cx + a[0], cy + a[1]],
        [cx + b[0], cy + b[1]],
        [cx + a[0] + b[0], cy + a[1] + b[1]],
      ];
    }),
  );
  const lines = values(lvl.lines).map((l) => ({ id: l.id, points: l.points, closed: l.closed }));
  const dimensions = values(lvl.dimensions).map(dimensionSymbol);
  const texts = values(lvl.texts).map(textSymbol);
  const hatches = values(lvl.hatches).map((h) => ({
    id: h.id,
    polygon: h.polygon,
    pattern: h.pattern,
  }));
  const pts: Point[] = [
    ...plan.plot.polygon,
    ...walls.flat(),
    ...stairs.flatMap((s) => s.outline),
    ...columns.flatMap((c) => c.outline),
    ...swings,
    ...lines.flatMap((l) => l.points),
    ...dimensions.flatMap((d) => d.extensions.flat()),
    ...texts.flatMap((t) => t.box),
    ...hatches.flatMap((h) => h.polygon),
  ];
  return {
    bounds: pts.length ? boxAround(pts) : { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    plot: plan.plot.polygon,
    walls,
    wallShapes: values(lvl.walls).map((w) => ({
      id: w.id,
      centreline: [w.start, w.end],
      band: wallBand(w),
    })),
    openings,
    columns,
    stairs,
    separators: values(lvl.separators).map((s) => ({ id: s.id, line: [s.start, s.end] })),
    rooms: roomShapes,
    lines,
    dimensions,
    texts,
    hatches,
  };
}
