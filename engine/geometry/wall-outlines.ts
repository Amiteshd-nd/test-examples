import type { Level, Wall } from '../schema/plan.ts';
import { values } from '../schema/collections.ts';
import type { Point } from '../schema/primitives.ts';
import type { Vec } from './planar.ts';
import { unionOutlines } from './union.ts';

// Walls as drawn shapes: each wall a band of its thickness around its centreline, ends reaching
// into walls of the same group they meet at an angle (so corners fill) and stopping at the face
// of walls of another group; then merged per group without seams (used by DXF export and tags).

/** Grid units per cm: 0.5 mm, so half of any 0.1 cm thickness is a whole number. */
export const WALL_GRID = 20;

/** Distance from p to segment ab. */
function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const s =
    len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - a[0] - s * dx, p[1] - a[1] - s * dy);
}

/**
 * How far a wall end reaches beyond its centreline end: into walls of its own layer it meets
 * at an angle (so corners fill), and back to the face of a wall on another layer (so internal
 * walls stop at the external wall's face instead of overlapping it).
 */
function endReach(
  w: Wall,
  end: Point,
  walls: readonly Wall[],
  groupOf: (w: Wall) => string,
): number {
  const ux = (w.end[0] - w.start[0]) / Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]);
  const uy = (w.end[1] - w.start[1]) / Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]);
  let same = 0;
  let other = 0;
  for (const v of walls) {
    if (v === w || distToSegment(end, v.start, v.end) > 0.05) continue;
    const vl = Math.hypot(v.end[0] - v.start[0], v.end[1] - v.start[1]);
    const sin = Math.abs((ux * (v.end[1] - v.start[1])) / vl - (uy * (v.end[0] - v.start[0])) / vl);
    if (sin < 1e-6) continue; // straight continuation: the ends meet exactly
    const reach = v.thickness / 2 / sin;
    if (groupOf(v) === groupOf(w)) same = Math.max(same, reach);
    else other = Math.max(other, reach);
  }
  return other > 0 ? -other : same;
}

/**
 * Joined wall outlines per group (e.g. per drawing layer), in grid units (`WALL_GRID` per cm),
 * openings cut out unless `solid`. Outer outlines run counter-clockwise, holes clockwise.
 */
export function wallOutlines<G extends string>(
  level: Level,
  groupOf: (w: Wall) => G,
  options: { solid?: boolean } = {},
): Map<G, Vec[][]> {
  const pieces = new Map<G, Vec[][]>();
  const walls = values(level.walls);
  for (const w of walls) {
    const len = Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]);
    const u: Point = [(w.end[0] - w.start[0]) / len, (w.end[1] - w.start[1]) / len];
    const n: Point = [-u[1], u[0]];
    const h = w.thickness / 2;
    let spans: [number, number][] = [
      [-endReach(w, w.start, walls, groupOf), len + endReach(w, w.end, walls, groupOf)],
    ];
    for (const o of options.solid ? [] : values(level.openings).filter((x) => x.wall === w.id)) {
      spans = spans.flatMap(([a, b]): [number, number][] => {
        const s = o.offset;
        const e = o.offset + o.width;
        if (e <= a || s >= b) return [[a, b]];
        return [
          ...(s > a ? [[a, s] as [number, number]] : []),
          ...(e < b ? [[e, b] as [number, number]] : []),
        ];
      });
    }
    const at = (d: number, side: number): Vec => [
      Math.round((w.start[0] + u[0] * d + n[0] * side) * WALL_GRID),
      Math.round((w.start[1] + u[1] * d + n[1] * side) * WALL_GRID),
    ];
    const group = groupOf(w);
    for (const [a, b] of spans) {
      if (b - a < 0.05) continue;
      pieces.set(group, [...(pieces.get(group) ?? []), [at(a, -h), at(b, -h), at(b, h), at(a, h)]]);
    }
  }
  return new Map([...pieces].map(([group, polys]) => [group, unionOutlines(polys)]));
}

/**
 * Every wall of a level as joined outlines in cm, for drawing: one group, so corners and
 * T-junctions fill without seams. Openings are cut out unless `solid`. Outer outlines run
 * counter-clockwise, holes clockwise (fill with even-odd or non-zero).
 */
export function wallOutlinesCm(level: Level, options: { solid?: boolean } = {}): Point[][] {
  const loops = wallOutlines(level, () => 'all', options).get('all') ?? [];
  return loops.map((loop) => loop.map(([x, y]): Point => [x / WALL_GRID, y / WALL_GRID]));
}
