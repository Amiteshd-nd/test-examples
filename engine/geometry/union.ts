import { buildArrangement, halfEdges, onSegment, type Vec } from './planar.ts';

// Union of polygons on an integer grid, as merged outlines without seams: the edges of all the
// polygons are cut where they meet, every piece of the plane between them is marked inside or
// outside, and the outline follows the edges with inside on the left and outside on the right.
// Used to draw walls as one joined shape (P1.3).

/** Even-odd test at a point that is not on any edge. */
function insideAny(p: [number, number], polygons: readonly Vec[][]): boolean {
  return polygons.some((poly) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i]!;
      const b = poly[j]!;
      if (
        a[1] > p[1] !== b[1] > p[1] &&
        p[0] < a[0] + ((p[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1])
      ) {
        inside = !inside;
      }
    }
    return inside;
  });
}

/**
 * Outlines of the union of `polygons`: outer outlines counter-clockwise, holes clockwise.
 * Straight-through corners are removed.
 */
export function unionOutlines(polygons: readonly Vec[][]): Vec[][] {
  const segments = polygons.flatMap((poly) =>
    poly.map((a, i) => ({ a, b: poly[(i + 1) % poly.length]!, data: null })),
  );
  const arr = buildArrangement(segments);
  const he = halfEdges(arr);

  // Face of each half-edge, and whether that face lies inside the union.
  const face = new Int32Array(he.count).fill(-1);
  const inside: boolean[] = [];
  for (let start = 0; start < he.count; start++) {
    if (face[start] !== -1) continue;
    const id = inside.length;
    let h = start;
    do {
      face[h] = id;
      h = he.next(h);
    } while (h !== start);
    // Sample just left of the middle of the first edge: inside this face, off every edge.
    const a = arr.vertices[he.origin(start)]!;
    const b = arr.vertices[he.dest(start)]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const eps = 1e-3;
    inside.push(
      insideAny(
        [
          (a[0] + b[0]) / 2 - ((b[1] - a[1]) / len) * eps,
          (a[1] + b[1]) / 2 + ((b[0] - a[0]) / len) * eps,
        ],
        polygons,
      ),
    );
  }

  const boundary = (h: number) => inside[face[h]!]! && !inside[face[h ^ 1]!]!;
  const used = new Uint8Array(he.count);
  const loops: Vec[][] = [];
  for (let start = 0; start < he.count; start++) {
    if (used[start] || !boundary(start)) continue;
    const loop: Vec[] = [];
    let h = start;
    do {
      used[h] = 1;
      loop.push(arr.vertices[he.origin(h)]!);
      // Continue around the far vertex, through inside faces, to the next outline edge.
      let g = he.next(h);
      while (!boundary(g)) g = he.next(g ^ 1);
      h = g;
    } while (h !== start);
    loops.push(simplify(loop));
  }
  return loops.filter((l) => l.length >= 3);
}

/** Drops corners where the outline runs straight on. */
function simplify(loop: Vec[]): Vec[] {
  let pts = loop;
  for (let changed = true; changed && pts.length > 3;) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[(i - 1 + pts.length) % pts.length]!;
      const next = pts[(i + 1) % pts.length]!;
      if (onSegment(pts[i]!, prev, next)) {
        pts = pts.filter((_, k) => k !== i);
        changed = true;
        break;
      }
    }
  }
  return pts;
}
