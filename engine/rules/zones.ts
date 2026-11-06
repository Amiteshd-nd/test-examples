import type { Plan } from '../schema/plan.ts';
import type { Compass, Point } from '../schema/primitives.ts';
import type { PlotZone } from '../schema/rule.ts';

// Shared by the reference checks and the Plan Graph (P3.3), so a room's Vastu zone is the same
// in both: the plot as a 3 × 3 grid with north up (+y), compass directions of vectors, and the
// centroid of a floor outline.

type Pt = readonly [number, number];

/** The plot's bounding box, north up. */
export interface PlotBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
export function plotBox(plan: Plan): PlotBox {
  const xs = plan.plot.polygon.map((p) => p[0]);
  const ys = plan.plot.polygon.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

/** Which ninth of the plot a point is in (north up). */
export function plotZone({ x0, x1, y0, y1 }: PlotBox, [x, y]: Pt): PlotZone {
  const col = x < x0 + (x1 - x0) / 3 ? 'west' : x > x1 - (x1 - x0) / 3 ? 'east' : '';
  const row = y < y0 + (y1 - y0) / 3 ? 'south' : y > y1 - (y1 - y0) / 3 ? 'north' : '';
  return (row && col ? `${row}_${col}` : row || col || 'centre') as PlotZone;
}

/** Counter-clockwise from east, 45° apart. */
export const COMPASS: Compass[] = [
  'east',
  'north_east',
  'north',
  'north_west',
  'west',
  'south_west',
  'south',
  'south_east',
];

/** The compass direction a vector points (north = +y). */
export function compassOf(v: Pt): Compass {
  const deg = ((((Math.atan2(v[1], v[0]) * 180) / Math.PI) % 360) + 360) % 360;
  return COMPASS[Math.round(deg / 45) % 8]!;
}

/** The unit vector of a compass direction. */
export function compassVector(c: Compass): Point {
  const a = (COMPASS.indexOf(c) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
}

/** The centroid of a ring (its first point when it has no area). */
export function centroid(ring: readonly Pt[]): Point {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    const c = p[0] * q[1] - p[1] * q[0];
    a += c;
    cx += (p[0] + q[0]) * c;
    cy += (p[1] + q[1]) * c;
  }
  if (Math.abs(a) < 1e-9) return [ring[0]![0], ring[0]![1]];
  return [cx / (3 * a), cy / (3 * a)];
}

/** Whether a point lies inside a ring (even-odd). */
export function insideRing([x, y]: Pt, ring: readonly Pt[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
