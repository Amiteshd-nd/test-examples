import { pointInFloatRing } from '../geometry/inset.ts';
import { values } from '../schema/collections.ts';
import type { Level } from '../schema/plan.ts';
import { roundCm, type Point } from '../schema/primitives.ts';
import { RTree, boxAround } from '../spatial/rtree.ts';
import { wallFrame, type PlanDrawing } from './drawing.ts';

// Hit-testing and snapping for hosts (P2.3, A2 M6): what is under the cursor, and where the
// cursor should land. Both search R-trees, so the cost stays small as plans grow. Lengths in cm;
// hosts turn their pixel tolerance into cm (pixels ÷ pixels-per-cm).

export type PickKind =
  | 'opening'
  | 'column'
  | 'wall'
  | 'separator'
  | 'stair'
  | 'room'
  | 'line'
  | 'dimension'
  | 'text'
  | 'hatch';

export interface Pick {
  kind: PickKind;
  id: string;
}

/** Smaller objects sit on top of larger ones: a door wins over its wall, a wall over a room. */
const RANK: Record<PickKind, number> = {
  opening: 1,
  column: 2,
  text: 2,
  wall: 3,
  separator: 4,
  line: 4,
  dimension: 4,
  stair: 5,
  room: 6,
  // A hatch usually fills a room: a click inside picks the room, a second click the hatch.
  hatch: 7,
};

interface Pickable extends Pick {
  ring: Point[];
  holes: Point[][];
  /** A line, not an area (separators). */
  line: boolean;
  area: number;
}

export type SnapKind = 'endpoint' | 'midpoint' | 'perpendicular' | 'grid';

export interface Snap {
  /** Where the cursor lands, on the 0.1 cm grid. */
  point: Point;
  kind: SnapKind | 'none';
  /** The object snapped to, when there is one. */
  ref?: string;
}

interface SnapPoint {
  at: Point;
  kind: 'endpoint' | 'midpoint';
  ref?: string;
}

interface SnapSegment {
  a: Point;
  b: Point;
  ref?: string;
}

export interface PlanIndex {
  picks: RTree<Pickable>;
  points: RTree<SnapPoint>;
  segments: RTree<SnapSegment>;
}

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Closest point to p on segment ab, and how far along it is (0–1). */
function project(p: Point, a: Point, b: Point): { at: Point; t: number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  return { at: [a[0] + t * dx, a[1] + t * dy], t };
}

function distToSegment(p: Point, a: Point, b: Point) {
  const { t } = project(p, a, b);
  const s = Math.max(0, Math.min(1, t));
  return dist(p, [a[0] + s * (b[0] - a[0]), a[1] + s * (b[1] - a[1])]);
}

function distToRing(p: Point, ring: readonly Point[]) {
  let d = Infinity;
  for (let i = 0; i < ring.length; i++)
    d = Math.min(d, distToSegment(p, ring[i]!, ring[(i + 1) % ring.length]!));
  return d;
}

function ringArea(ring: readonly Point[]) {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i]!;
    const [x1, y1] = ring[(i + 1) % ring.length]!;
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a / 2);
}

const edges = (ring: readonly Point[]): [Point, Point][] =>
  ring.map((p, i) => [p, ring[(i + 1) % ring.length]!]);
const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** Indexes what can be picked and snapped to on one level, from its drawing (`planDrawing`). */
export function buildPlanIndex(level: Level, drawing: PlanDrawing): PlanIndex {
  const picks = new RTree<Pickable>();
  const add = (kind: PickKind, id: string, ring: Point[], holes: Point[][] = [], line = false) => {
    if (ring.length < 2) return;
    picks.insert(boxAround(ring), { kind, id, ring, holes, line, area: line ? 0 : ringArea(ring) });
  };
  for (const w of drawing.wallShapes) add('wall', w.id, w.band);
  for (const o of drawing.openings) add('opening', o.id, o.frame);
  for (const c of drawing.columns) add('column', c.id, c.outline);
  for (const s of drawing.separators) add('separator', s.id, [...s.line], [], true);
  for (const s of drawing.stairs) add('stair', s.id, s.outline);
  for (const r of drawing.rooms) add('room', r.id, r.outer, r.holes);
  for (const l of drawing.lines) {
    const pts = l.closed ? [...l.points, l.points[0]!] : l.points;
    for (let i = 1; i < pts.length; i++) add('line', l.id, [pts[i - 1]!, pts[i]!], [], true);
  }
  for (const m of drawing.dimensions) add('dimension', m.id, [...m.line], [], true);
  for (const t of drawing.texts) add('text', t.id, t.box);
  for (const h of drawing.hatches) add('hatch', h.id, h.polygon);

  // Snap targets, de-duplicated on the 0.1 cm grid.
  const points = new RTree<SnapPoint>();
  const seen = new Set<string>();
  const point = (at: Point, kind: SnapPoint['kind'], ref?: string) => {
    const key = `${kind}:${roundCm(at[0])},${roundCm(at[1])}`;
    if (seen.has(key)) return;
    seen.add(key);
    points.insert(boxAround([at]), { at, kind, ...(ref ? { ref } : {}) });
  };
  const segments = new RTree<SnapSegment>();
  const segment = (a: Point, b: Point, ref?: string) => {
    segments.insert(boxAround([a, b]), { a, b, ...(ref ? { ref } : {}) });
    point(a, 'endpoint', ref);
    point(b, 'endpoint', ref);
    point(mid(a, b), 'midpoint', ref);
  };
  for (const w of drawing.wallShapes) segment(w.centreline[0], w.centreline[1], w.id);
  for (const ring of drawing.walls) for (const [a, b] of edges(ring)) segment(a, b);
  for (const s of drawing.separators) segment(s.line[0], s.line[1], s.id);
  for (const c of drawing.columns) for (const [a, b] of edges(c.outline)) segment(a, b, c.id);
  for (const s of drawing.stairs) for (const [a, b] of edges(s.outline)) segment(a, b, s.id);
  for (const l of drawing.lines) {
    const pts = l.closed ? [...l.points, l.points[0]!] : l.points;
    for (let i = 1; i < pts.length; i++) segment(pts[i - 1]!, pts[i]!, l.id);
  }
  for (const h of drawing.hatches) for (const [a, b] of edges(h.polygon)) segment(a, b, h.id);
  for (const o of values(level.openings)) {
    const w = level.walls[o.wall];
    if (w) point(wallFrame(w).at(o.offset + o.width / 2), 'midpoint', o.id);
  }
  return { picks, points, segments };
}

/** The object under `p` (within `tolerance` cm of its edge), smallest kind first; null if none. */
export function hitTest(index: PlanIndex, p: Point, tolerance: number): Pick | null {
  return hitTestAll(index, p, tolerance)[0] ?? null;
}

/**
 * Every object under `p`, the one `hitTest` picks first, each once: clicking the same spot
 * again can step through objects lying on top of each other (a hatch under a room).
 */
export function hitTestAll(index: PlanIndex, p: Point, tolerance: number): Pick[] {
  const hits = index.picks.search(boxAround([p], tolerance)).filter((o) => {
    if (o.line) return distToSegment(p, o.ring[0]!, o.ring[1]!) <= tolerance;
    const inside = pointInFloatRing(p, o.ring) && !o.holes.some((h) => pointInFloatRing(p, h));
    // Rooms are picked from inside only, so a click near a wall picks the wall.
    return inside || (o.kind !== 'room' && distToRing(p, o.ring) <= tolerance);
  });
  hits.sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.area - b.area || (a.id < b.id ? -1 : 1));
  const seen = new Set<string>();
  return hits.flatMap((h) => {
    const key = `${h.kind}:${h.id}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ kind: h.kind, id: h.id }];
  });
}

export interface SnapOptions {
  /** How far the cursor may be from a target, in cm. */
  tolerance: number;
  /** The snaps that are switched on. */
  snaps: Iterable<SnapKind>;
  /** Grid spacing in cm (for `grid`). */
  grid?: number;
  /** The point a line is being drawn from (needed for `perpendicular`). */
  from?: Point;
}

const PRIORITY: Record<SnapKind, number> = { endpoint: 0, midpoint: 1, perpendicular: 2, grid: 3 };

/**
 * Where the cursor at `p` lands: the nearest endpoint, midpoint or perpendicular foot (from
 * `from`) within the tolerance — the earlier kind wins a tie — else the grid, else `p` itself.
 */
export function snapPoint(index: PlanIndex, p: Point, options: SnapOptions): Snap {
  const on = new Set(options.snaps);
  const tol = options.tolerance;
  const near = boxAround([p], tol);
  let best: { at: Point; kind: SnapKind; ref?: string; d: number } | null = null;
  const consider = (at: Point, kind: SnapKind, ref?: string) => {
    const d = dist(at, p);
    if (d > tol) return;
    if (
      !best ||
      d < best.d - 1e-9 ||
      (Math.abs(d - best.d) <= 1e-9 && PRIORITY[kind] < PRIORITY[best.kind])
    )
      best = { at, kind, d, ...(ref ? { ref } : {}) };
  };
  for (const s of index.points.search(near)) if (on.has(s.kind)) consider(s.at, s.kind, s.ref);
  const from = options.from;
  if (on.has('perpendicular') && from) {
    for (const s of index.segments.search(near)) {
      const { at, t } = project(from, s.a, s.b);
      if (t >= 0 && t <= 1 && dist(from, at) > 1e-6) consider(at, 'perpendicular', s.ref);
    }
  }
  const round = ([x, y]: Point): Point => [roundCm(x), roundCm(y)];
  const found = best as { at: Point; kind: SnapKind; ref?: string } | null;
  if (found)
    return { point: round(found.at), kind: found.kind, ...(found.ref ? { ref: found.ref } : {}) };
  const g = options.grid;
  if (on.has('grid') && g && g > 0)
    return { point: round([Math.round(p[0] / g) * g, Math.round(p[1] / g) * g]), kind: 'grid' };
  return { point: round(p), kind: 'none' };
}
