import { orient, type Vec } from './planar.ts';

// Moves each edge of a ring to its left by its own distance and re-joins the corners (mitre).
// Used to turn a room's wall-centreline face into the room's clear floor outline.

export type FloatVec = [number, number];

/**
 * @param ring integer-mm ring; the region to keep is on the left of each edge
 * @param offsets distance in mm for edge i (from ring[i] to ring[i+1])
 * @returns float-mm ring in the same vertex order, or `null` when an edge would vanish or turn
 *   back on itself (the walls are thicker than the space between them)
 */
export function insetRing(ring: readonly Vec[], offsets: readonly number[]): FloatVec[] | null {
  // Merge straight-through corners whose two edges move by the same distance.
  const pts: Vec[] = [];
  const offs: number[] = [];
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const prev = ring[(i - 1 + n) % n]!;
    const cur = ring[i]!;
    const nextPt = ring[(i + 1) % n]!;
    const straight =
      orient(prev, cur, nextPt) === 0 &&
      (cur[0] - prev[0]) * (nextPt[0] - cur[0]) + (cur[1] - prev[1]) * (nextPt[1] - cur[1]) > 0;
    if (straight && offsets[(i - 1 + n) % n] === offsets[i]) continue;
    pts.push(cur);
    offs.push(offsets[i]!);
  }
  // offs[k] currently belongs to the edge leaving pts[k] in the original ring; after merging,
  // that edge still leaves pts[k], so the pairing holds.

  const m = pts.length;
  const dirs = pts.map((p, i) => {
    const q = pts[(i + 1) % m]!;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    return [(q[0] - p[0]) / len, (q[1] - p[1]) / len] as FloatVec;
  });
  const shifted = (i: number, p: Vec): FloatVec => {
    const d = dirs[i]!;
    const o = offs[i]!;
    return [p[0] - d[1] * o, p[1] + d[0] * o];
  };

  const out: FloatVec[] = [];
  // first[i] / last[i]: index in `out` of the first / last point made at corner i.
  const first: number[] = [];
  const last: number[] = [];
  for (let i = 0; i < m; i++) {
    first.push(out.length);
    const pi = (i - 1 + m) % m;
    const corner = pts[i]!;
    const d1 = dirs[pi]!;
    const d2 = dirs[i]!;
    const cross = d1[0] * d2[1] - d1[1] * d2[0];
    const a = shifted(pi, corner);
    const b = shifted(i, corner);
    if (Math.abs(cross) < 1e-12) {
      // Straight-through corner where the wall thickness changes: step across.
      out.push(a, b);
    } else {
      const t = ((b[0] - a[0]) * d2[1] - (b[1] - a[1]) * d2[0]) / cross;
      out.push([a[0] + t * d1[0], a[1] + t * d1[1]]);
    }
    last.push(out.length - 1);
  }

  // Edge i now runs from the last point of corner i to the first point of corner i+1;
  // it must still point the same way as before.
  for (let i = 0; i < m; i++) {
    const p = out[last[i]!]!;
    const q = out[first[(i + 1) % m]!]!;
    const d = dirs[i]!;
    if ((q[0] - p[0]) * d[0] + (q[1] - p[1]) * d[1] <= 1e-9) return null;
  }
  return out;
}

export function floatRingArea(ring: readonly FloatVec[]): number {
  const [ox, oy] = ring[0]!;
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    sum += (p[0] - ox) * (q[1] - oy) - (q[0] - ox) * (p[1] - oy);
  }
  return sum / 2;
}

export function pointInFloatRing(p: FloatVec, ring: readonly FloatVec[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a[1] > p[1] !== b[1] > p[1]) {
      const x = a[0] + ((p[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
      if (p[0] < x) inside = !inside;
    }
  }
  return inside;
}

/** True when no two non-adjacent edges cross or overlap (tolerance in the ring's units). */
export function isSimpleFloatRing(ring: readonly FloatVec[], tol = 1e-6): boolean {
  const n = ring.length;
  const side = (a: FloatVec, b: FloatVec, c: FloatVec) => {
    const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const scale = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return Math.abs(v) <= tol * scale ? 0 : Math.sign(v);
  };
  for (let i = 0; i < n; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % n]!;
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const c = ring[j]!;
      const d = ring[(j + 1) % n]!;
      const s1 = side(c, d, a);
      const s2 = side(c, d, b);
      const s3 = side(a, b, c);
      const s4 = side(a, b, d);
      if (s1 * s2 < 0 && s3 * s4 < 0) return false;
      if (s1 === 0 && s2 === 0 && s3 === 0 && s4 === 0) {
        const overlap = (lo1: number, hi1: number, lo2: number, hi2: number) =>
          Math.max(lo1, lo2) <= Math.min(hi1, hi2) + tol;
        if (
          overlap(
            Math.min(a[0], b[0]),
            Math.max(a[0], b[0]),
            Math.min(c[0], d[0]),
            Math.max(c[0], d[0]),
          ) &&
          overlap(
            Math.min(a[1], b[1]),
            Math.max(a[1], b[1]),
            Math.min(c[1], d[1]),
            Math.max(c[1], d[1]),
          )
        ) {
          return false;
        }
      }
    }
  }
  return true;
}
