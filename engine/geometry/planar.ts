// Planar arrangement of straight segments on an integer-millimetre grid, and its faces.
//
// Exact by construction: coordinates are integers (cm × 10) bounded by MAX_COORD_CM, so every
// orientation test is computed exactly in doubles. Only proper crossings of two diagonal
// segments create a new vertex, which is rounded to the nearest mm.
// Face tracing is the textbook half-edge walk (ADR 0001, idea I-level; no CADCraft code).

/** Integer-mm point. */
export type Vec = readonly [number, number];

export function cmToMm(cm: number): number {
  return Math.round(cm * 10);
}

export function vecFromCm(p: readonly [number, number]): Vec {
  return [cmToMm(p[0]), cmToMm(p[1])];
}

/** Twice the signed area of triangle abc: > 0 when c is left of a→b. */
export function orient(a: Vec, b: Vec, c: Vec): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function sameVec(a: Vec, b: Vec): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function key(p: Vec): string {
  return `${p[0]},${p[1]}`;
}

/** True when p lies on the closed segment ab. */
export function onSegment(p: Vec, a: Vec, b: Vec): boolean {
  return (
    orient(a, b, p) === 0 &&
    Math.min(a[0], b[0]) <= p[0] &&
    p[0] <= Math.max(a[0], b[0]) &&
    Math.min(a[1], b[1]) <= p[1] &&
    p[1] <= Math.max(a[1], b[1])
  );
}

/** Points where closed segments ab and cd meet (0, 1 or, when collinear, up to 4 shared endpoints). */
export function segmentContacts(a: Vec, b: Vec, c: Vec, d: Vec): Vec[] {
  const d1 = Math.sign(orient(c, d, a));
  const d2 = Math.sign(orient(c, d, b));
  const d3 = Math.sign(orient(a, b, c));
  const d4 = Math.sign(orient(a, b, d));

  if (d1 === 0 && d2 === 0 && d3 === 0 && d4 === 0) {
    return [a, b, c, d].filter((p, i) => (i < 2 ? onSegment(p, c, d) : onSegment(p, a, b)));
  }
  if (d1 * d2 > 0 || d3 * d4 > 0) return [];
  if (d1 === 0) return [a];
  if (d2 === 0) return [b];
  if (d3 === 0) return [c];
  if (d4 === 0) return [d];
  const oa = orient(c, d, a);
  const t = oa / (oa - orient(c, d, b));
  return [[Math.round(a[0] + t * (b[0] - a[0])), Math.round(a[1] + t * (b[1] - a[1]))]];
}

export interface InputSegment<T> {
  a: Vec;
  b: Vec;
  data: T;
}

export interface Edge<T> {
  u: number;
  v: number;
  /** Data of every input segment that covers this edge (collinear overlaps merge). */
  data: T[];
}

export interface Arrangement<T> {
  vertices: Vec[];
  edges: Edge<T>[];
}

/** Distance from p to the closed segment ab, and the nearest point on it. */
function nearestOnSegment(p: Vec, a: Vec, b: Vec): { d: number; q: [number, number] } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = Math.min(
    1,
    Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)),
  );
  const q: [number, number] = [a[0] + t * dx, a[1] + t * dy];
  return { d: Math.hypot(p[0] - q[0], p[1] - q[1]), q };
}

const boxesTouch = (a: Vec, b: Vec, c: Vec, d: Vec, margin: number) =>
  Math.max(a[0], b[0]) + margin >= Math.min(c[0], d[0]) &&
  Math.max(c[0], d[0]) + margin >= Math.min(a[0], b[0]) &&
  Math.max(a[1], b[1]) + margin >= Math.min(c[1], d[1]) &&
  Math.max(c[1], d[1]) + margin >= Math.min(a[1], b[1]);

/** Rounded crossings can sit up to half a grid cell's diagonal off the lines they lie on. */
const HOT_PIXEL = 0.75;

/**
 * Splits every segment where it meets another and merges duplicate pieces (P1.1b, A2 M4):
 * 1. Gap closing: with `snapMm` > 0, a free end (touching nothing) within that distance of
 *    another segment moves onto it (the nearest point, on the grid), so hairline gaps close.
 * 2. Exact contacts: crossings, T-junctions and collinear overlaps, by integer orientation tests.
 * 3. Snap rounding: a crossing rounded to the grid also splits any other segment passing within
 *    a hair of it, so rounding never silently breaks a junction.
 * O(n²) pair tests: fine for a house plan's few hundred walls.
 */
export function buildArrangement<T>(
  segments: readonly InputSegment<T>[],
  snapMm = 0,
): Arrangement<T> {
  const live = segments.filter((s) => !sameVec(s.a, s.b)).map((s) => ({ ...s }));
  const splits: Vec[][] = [];

  // Gap closing, decided on the original positions so the order of the segments never matters.
  const forced: { j: number; q: Vec }[] = [];
  if (snapMm > 0) {
    const original = live.map((s) => ({ a: s.a, b: s.b }));
    const segKey = (k: number) => [key(original[k]!.a), key(original[k]!.b)].sort().join('|');
    const moves: { i: number; end: 'a' | 'b'; q: Vec }[] = [];
    for (let i = 0; i < original.length; i++) {
      for (const end of ['a', 'b'] as const) {
        const p = original[i]![end];
        if (original.some((s, j) => j !== i && onSegment(p, s.a, s.b))) continue;
        let best: { d: number; q: [number, number]; j: number } | null = null;
        for (let j = 0; j < original.length; j++) {
          if (j === i || !boxesTouch(p, p, original[j]!.a, original[j]!.b, snapMm)) continue;
          const near = nearestOnSegment(p, original[j]!.a, original[j]!.b);
          const better =
            !best || near.d < best.d || (near.d === best.d && segKey(j) < segKey(best.j));
          if (near.d <= snapMm && better) best = { ...near, j };
        }
        if (!best) continue;
        const q: Vec = [Math.round(best.q[0]), Math.round(best.q[1])];
        const other = end === 'a' ? original[i]!.b : original[i]!.a;
        if (sameVec(q, other)) continue;
        moves.push({ i, end, q });
        forced.push({ j: best.j, q });
      }
    }
    for (const m of moves) live[m.i]![m.end] = m.q;
  }

  live.forEach((s) => splits.push([s.a, s.b]));
  for (const { j, q } of forced) splits[j]!.push(q); // a joined end always touches its wall
  for (let i = 0; i < live.length; i++) {
    const si = live[i]!;
    for (let j = i + 1; j < live.length; j++) {
      const sj = live[j]!;
      if (!boxesTouch(si.a, si.b, sj.a, sj.b, 0)) continue;
      for (const p of segmentContacts(si.a, si.b, sj.a, sj.b)) {
        splits[i]!.push(p);
        splits[j]!.push(p);
      }
    }
  }

  const hot = new Map<string, Vec>();
  for (const list of splits) for (const p of list) hot.set(key(p), p);
  live.forEach((s, i) => {
    for (const p of hot.values()) {
      if (!boxesTouch(s.a, s.b, p, p, HOT_PIXEL)) continue;
      if (nearestOnSegment(p, s.a, s.b).d <= HOT_PIXEL) splits[i]!.push(p);
    }
  });

  const vertexIndex = new Map<string, number>();
  const vertices: Vec[] = [];
  const vertexOf = (p: Vec): number => {
    const k = key(p);
    let idx = vertexIndex.get(k);
    if (idx === undefined) {
      idx = vertices.length;
      vertices.push(p);
      vertexIndex.set(k, idx);
    }
    return idx;
  };

  const edgeIndex = new Map<string, Edge<T>>();
  live.forEach((s, i) => {
    const dx = s.b[0] - s.a[0];
    const dy = s.b[1] - s.a[1];
    const along = (p: Vec) => (p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dy;
    const points = [...splits[i]!].sort((p, q) => along(p) - along(q));
    for (let k = 0; k + 1 < points.length; k++) {
      const u = vertexOf(points[k]!);
      const v = vertexOf(points[k + 1]!);
      if (u === v) continue;
      const ek = u < v ? `${u}-${v}` : `${v}-${u}`;
      const existing = edgeIndex.get(ek);
      if (existing) existing.data.push(s.data);
      else edgeIndex.set(ek, { u, v, data: [s.data] });
    }
  });

  return { vertices, edges: [...edgeIndex.values()] };
}

/** Repeatedly removes edges with a free end; they cannot bound a face. */
export function pruneDangling<T>(arr: Arrangement<T>): Arrangement<T> {
  let edges = arr.edges;
  for (;;) {
    const degree = new Map<number, number>();
    for (const e of edges) {
      degree.set(e.u, (degree.get(e.u) ?? 0) + 1);
      degree.set(e.v, (degree.get(e.v) ?? 0) + 1);
    }
    const kept = edges.filter((e) => degree.get(e.u)! > 1 && degree.get(e.v)! > 1);
    if (kept.length === edges.length) return { vertices: arr.vertices, edges };
    edges = kept;
  }
}

export interface FaceEdge {
  edge: number;
  /** True when the face walks the edge from `u` to `v`. */
  forward: boolean;
}

export interface Face {
  vertices: Vec[];
  edges: FaceEdge[];
  /** Twice the signed area in mm²: > 0 for a bounded face, < 0 for a component's outer boundary. */
  area2: number;
  /** Connected component the face boundary belongs to. */
  component: number;
}

/** Orders directions counter-clockwise starting from +x. */
function compareDirections(p: Vec, q: Vec): number {
  const half = (d: Vec) => (d[1] > 0 || (d[1] === 0 && d[0] > 0) ? 0 : 1);
  const hp = half(p);
  const hq = half(q);
  if (hp !== hq) return hp - hq;
  return -Math.sign(p[0] * q[1] - p[1] * q[0]);
}

export function ringArea2(ring: readonly Vec[]): number {
  const [ox, oy] = ring[0]!;
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    sum += (p[0] - ox) * (q[1] - oy) - (q[0] - ox) * (p[1] - oy);
  }
  return sum;
}

/** Half-edge h runs along edge h >> 1: even h from `u` to `v`, odd h back; `h ^ 1` is its twin. */
export interface HalfEdges {
  count: number;
  origin(h: number): number;
  dest(h: number): number;
  /** The next half-edge around the face on h's left. */
  next(h: number): number;
}

export function halfEdges<T>(arr: Arrangement<T>): HalfEdges {
  const { vertices, edges } = arr;
  const origin = (h: number) => (h % 2 === 0 ? edges[h >> 1]!.u : edges[h >> 1]!.v);
  const dest = (h: number) => (h % 2 === 0 ? edges[h >> 1]!.v : edges[h >> 1]!.u);

  const outgoing = new Map<number, number[]>();
  for (let h = 0; h < edges.length * 2; h++) {
    const list = outgoing.get(origin(h)) ?? [];
    list.push(h);
    outgoing.set(origin(h), list);
  }
  const position = new Array<number>(edges.length * 2);
  for (const [v, list] of outgoing) {
    const from = vertices[v]!;
    const dir = (h: number): Vec => {
      const to = vertices[dest(h)]!;
      return [to[0] - from[0], to[1] - from[1]];
    };
    list.sort((h1, h2) => compareDirections(dir(h1), dir(h2)));
    list.forEach((h, i) => (position[h] = i));
  }
  // At the far end, the edge just clockwise of the way back keeps the face on the left.
  const next = (h: number) => {
    const list = outgoing.get(dest(h))!;
    return list[(position[h ^ 1]! - 1 + list.length) % list.length]!;
  };
  return { count: edges.length * 2, origin, dest, next };
}

/** Traces every face; each face keeps the region on its left. Expects `pruneDangling` output. */
export function traceFaces<T>(arr: Arrangement<T>): Face[] {
  const { vertices, edges } = arr;
  const { origin, next } = halfEdges(arr);

  const parent = vertices.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]!]!;
    return i;
  };
  for (const e of edges) parent[find(e.u)] = find(e.v);

  const faces: Face[] = [];
  const visited = new Array<boolean>(edges.length * 2).fill(false);
  for (let start = 0; start < edges.length * 2; start++) {
    if (visited[start]) continue;
    const ring: Vec[] = [];
    const faceEdges: FaceEdge[] = [];
    let h = start;
    do {
      visited[h] = true;
      ring.push(vertices[origin(h)]!);
      faceEdges.push({ edge: h >> 1, forward: h % 2 === 0 });
      h = next(h);
    } while (h !== start);
    faces.push({
      vertices: ring,
      edges: faceEdges,
      area2: ringArea2(ring),
      component: find(origin(start)),
    });
  }
  return faces;
}

export type RingPosition = 'inside' | 'outside' | 'boundary';

/** Exact point-in-ring test for integer points. */
export function pointInRing(p: Vec, ring: readonly Vec[]): RingPosition {
  let inside = false;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    if (onSegment(p, a, b)) return 'boundary';
    if (a[1] > p[1] !== b[1] > p[1]) {
      const o = orient(a, b, p);
      if (b[1] > a[1] ? o > 0 : o < 0) inside = !inside;
    }
  }
  return inside ? 'inside' : 'outside';
}

/**
 * True when the ring is a simple polygon: no edge touches a non-adjacent edge and no two
 * neighbouring edges fold back over each other. Expects consecutive duplicates removed.
 */
export function isSimpleRing(ring: readonly Vec[]): boolean {
  const n = ring.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % n]!;
    const c = ring[(i + 2) % n]!;
    // Neighbouring edges ab, bc fold back when collinear and pointing opposite ways.
    if (
      orient(a, b, c) === 0 &&
      (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) < 0
    ) {
      return false;
    }
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // first and last edges share a corner
      const p = ring[j]!;
      const q = ring[(j + 1) % n]!;
      if (segmentContacts(a, b, p, q).length > 0) return false;
    }
  }
  return true;
}
