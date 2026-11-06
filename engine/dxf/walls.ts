import type { Bounds, Xy } from './drawing.ts';

// Wall detection (P1.2 task 3): drafted walls are two parallel face lines. Faces on the same
// line are merged, then paired with the nearest parallel face whose distance is a plausible
// wall thickness (thinnest pairs first, each stretch of a face used once). Pieces of one wall
// are rejoined across T-junctions (one face runs through), crossings (another wall runs
// through) and openings (both faces break; a door/window symbol or a short plain gap). Finally
// wall ends are extended to meet the walls they run into, so corners and T-junctions close.
// All lengths in cm.

export interface FaceLine {
  a: Xy;
  b: Xy;
  /** Where the line came from (its layer); carried through to the walls it forms. */
  tag?: string;
}

export type OpeningKind = 'door' | 'window' | 'ventilator' | 'opening';

export interface OpeningEvidence {
  kind: OpeningKind;
  bounds: Bounds;
  /** What it is, for the report, e.g. `block "DOOR-900"`. */
  source: string;
}

export interface WallOptions {
  minThickness: number;
  maxThickness: number;
  maxOpeningWithSymbol: number;
  maxPlainOpening: number;
}

export interface DetectedOpening {
  kind: OpeningKind;
  /** From the wall's start to the opening's near edge. */
  offset: number;
  width: number;
  evidence: string | null;
}

export interface DetectedWall {
  start: Xy;
  end: Xy;
  thickness: number;
  openings: DetectedOpening[];
  /** Tags of the face lines that formed the wall. */
  tags: string[];
}

export interface WallDetection {
  walls: DetectedWall[];
  /** Total length of face lines that found no partner. */
  unpairedLength: number;
  pairedLength: number;
}

const ANGLE_TOL = (0.5 * Math.PI) / 180;
const LINE_TOL = 0.2;
const JOIN_TOL = 0.5;
const MIN_OVERLAP = 2;

interface Face {
  line: number;
  t0: number;
  t1: number;
  tags: Set<string>;
}

interface Cluster {
  u: Xy;
  n: Xy;
  lines: { c: number; faces: Face[] }[];
}

interface Piece {
  cluster: number;
  c: number;
  d: number;
  t0: number;
  t1: number;
  lineA: number;
  lineB: number;
  openings: { kind: OpeningKind; t0: number; t1: number; evidence: string | null }[];
  tags: Set<string>;
}

const dot = (p: Xy, q: Xy) => p[0] * q[0] + p[1] * q[1];

function clusterFaces(lines: FaceLine[]): Cluster[] {
  const items = lines
    .map((f) => {
      const dx = f.b[0] - f.a[0];
      const dy = f.b[1] - f.a[1];
      let th = Math.atan2(dy, dx);
      if (th < 0) th += Math.PI;
      if (th >= Math.PI - ANGLE_TOL) th -= Math.PI;
      return { f, th, len: Math.hypot(dx, dy) };
    })
    .filter((x) => x.len > 0.05)
    .sort((p, q) => p.th - q.th);

  const groups: (typeof items)[] = [];
  for (const it of items) {
    const g = groups[groups.length - 1];
    if (g && it.th - g[g.length - 1]!.th <= ANGLE_TOL) g.push(it);
    else groups.push([it]);
  }

  return groups.map((g) => {
    const total = g.reduce((s, x) => s + x.len, 0);
    const th = g.reduce((s, x) => s + x.th * x.len, 0) / total;
    const u: Xy = [Math.cos(th), Math.sin(th)];
    const n: Xy = [-u[1], u[0]];
    const raw = g
      .map((x) => {
        const ta = dot(u, x.f.a);
        const tb = dot(u, x.f.b);
        return {
          c: (dot(n, x.f.a) + dot(n, x.f.b)) / 2,
          t0: Math.min(ta, tb),
          t1: Math.max(ta, tb),
          len: x.len,
          tag: x.f.tag,
        };
      })
      .sort((p, q) => p.c - q.c);
    const byLine: (typeof raw)[] = [];
    for (const r of raw) {
      const l = byLine[byLine.length - 1];
      if (l && r.c - l[l.length - 1]!.c <= LINE_TOL) l.push(r);
      else byLine.push([r]);
    }
    const clusterLines = byLine.map((l, li) => {
      const c = l.reduce((s, x) => s + x.c * x.len, 0) / l.reduce((s, x) => s + x.len, 0);
      const sorted = [...l].sort((p, q) => p.t0 - q.t0);
      const faces: Face[] = [];
      for (const s of sorted) {
        const last = faces[faces.length - 1];
        if (last && s.t0 <= last.t1 + LINE_TOL) {
          last.t1 = Math.max(last.t1, s.t1);
          if (s.tag) last.tags.add(s.tag);
        } else {
          faces.push({ line: li, t0: s.t0, t1: s.t1, tags: new Set(s.tag ? [s.tag] : []) });
        }
      }
      return { c, faces };
    });
    return { u, n, lines: clusterLines };
  });
}

function subtract(range: [number, number], taken: [number, number][]): [number, number][] {
  let parts: [number, number][] = [range];
  for (const [s, e] of taken) {
    parts = parts.flatMap(([a, b]): [number, number][] => {
      if (e <= a || s >= b) return [[a, b]];
      const out: [number, number][] = [];
      if (s > a) out.push([a, s]);
      if (e < b) out.push([e, b]);
      return out;
    });
  }
  return parts;
}

function pairFaces(
  clusters: Cluster[],
  opts: WallOptions,
): { pieces: Piece[]; paired: number; unpaired: number } {
  const pieces: Piece[] = [];
  let paired = 0;
  let total = 0;
  clusters.forEach((cl, k) => {
    const candidates: { f: Face; g: Face; d: number; o0: number; o1: number }[] = [];
    for (let i = 0; i < cl.lines.length; i++) {
      for (const f of cl.lines[i]!.faces) total += f.t1 - f.t0;
      for (let j = i + 1; j < cl.lines.length; j++) {
        const d = cl.lines[j]!.c - cl.lines[i]!.c;
        if (d > opts.maxThickness + LINE_TOL) break;
        if (d < opts.minThickness - LINE_TOL) continue;
        for (const f of cl.lines[i]!.faces) {
          for (const g of cl.lines[j]!.faces) {
            const o0 = Math.max(f.t0, g.t0);
            const o1 = Math.min(f.t1, g.t1);
            if (o1 - o0 >= MIN_OVERLAP) candidates.push({ f, g, d, o0, o1 });
          }
        }
      }
    }
    candidates.sort((p, q) => p.d - q.d || q.o1 - q.o0 - (p.o1 - p.o0));
    const claimed = new Map<Face, [number, number][]>();
    for (const { f, g, d, o0, o1 } of candidates) {
      const taken = [...(claimed.get(f) ?? []), ...(claimed.get(g) ?? [])];
      for (const [s, e] of subtract([o0, o1], taken)) {
        // A stretch shorter than its thickness is not a wall: usually the jamb lines on either
        // side of a narrow opening, or a jamb facing another wall's face.
        if (e - s < Math.max(MIN_OVERLAP, d)) continue;
        const cA = cl.lines[f.line]!.c;
        pieces.push({
          cluster: k,
          c: cA + d / 2,
          d,
          t0: s,
          t1: e,
          lineA: f.line,
          lineB: g.line,
          openings: [],
          tags: new Set([...f.tags, ...g.tags]),
        });
        claimed.set(f, [...(claimed.get(f) ?? []), [s, e]]);
        claimed.set(g, [...(claimed.get(g) ?? []), [s, e]]);
        paired += 2 * (e - s);
      }
    }
  });
  return { pieces, paired, unpaired: Math.max(0, total - paired) };
}

/** Point on a piece's centreline at parameter t. */
const pointAt = (cl: Cluster, c: number, t: number): Xy => [
  cl.u[0] * t + cl.n[0] * c,
  cl.u[1] * t + cl.n[1] * c,
];

/** Where line (cluster a, offset ca) meets line (cluster b, offset cb): parameters on each. */
function crossing(
  a: Cluster,
  ca: number,
  b: Cluster,
  cb: number,
): { ta: number; tb: number; sin: number } | null {
  const denom = dot(b.n, a.u);
  if (Math.abs(denom) < 1e-9) return null;
  const ta = (cb - ca * dot(b.n, a.n)) / denom;
  return { ta, tb: dot(b.u, pointAt(a, ca, ta)), sin: Math.abs(denom) };
}

function boundsOverlap(a: Bounds, b: Bounds): boolean {
  return (
    a.min[0] <= b.max[0] && b.min[0] <= a.max[0] && a.min[1] <= b.max[1] && b.min[1] <= a.max[1]
  );
}

function mergePieces(
  clusters: Cluster[],
  pieces: Piece[],
  evidence: OpeningEvidence[],
  opts: WallOptions,
): Piece[] {
  const groups = new Map<string, Piece[]>();
  // Pieces of one wall share a cluster, a centreline and a thickness.
  const sorted = [...pieces].sort((p, q) => p.cluster - q.cluster || p.c - q.c || p.d - q.d);
  let key = '';
  let prev: Piece | null = null;
  for (const p of sorted) {
    if (
      !prev ||
      prev.cluster !== p.cluster ||
      Math.abs(prev.c - p.c) > 0.3 ||
      Math.abs(prev.d - p.d) > 0.6
    ) {
      key = `${p.cluster}:${p.c}:${p.d}`;
    }
    groups.set(key, [...(groups.get(key) ?? []), p]);
    prev = p;
  }

  const faceCovers = (cl: Cluster, line: number, s: number, e: number) =>
    cl.lines[line]!.faces.some((f) => f.t0 <= s + LINE_TOL && f.t1 >= e - LINE_TOL);

  const crossedAt = (p: Piece, s: number, e: number) =>
    pieces.some((q) => {
      if (q.cluster === p.cluster) return false;
      const x = crossing(clusters[p.cluster]!, p.c, clusters[q.cluster]!, q.c);
      if (!x || x.ta < s - JOIN_TOL || x.ta > e + JOIN_TOL) return false;
      const reach = p.d / 2 / x.sin + 1;
      return x.tb >= q.t0 - reach && x.tb <= q.t1 + reach;
    });

  const merged: Piece[] = [];
  for (const group of groups.values()) {
    group.sort((p, q) => p.t0 - q.t0);
    let cur: Piece = { ...group[0]!, openings: [], tags: new Set(group[0]!.tags) };
    for (const next of group.slice(1)) {
      const cl = clusters[cur.cluster]!;
      const s = cur.t1;
      const e = next.t0;
      let join = e <= s + JOIN_TOL;
      let opening: Piece['openings'][number] | null = null;
      if (
        !join &&
        (faceCovers(cl, cur.lineA, s, e) || faceCovers(cl, cur.lineB, s, e) || crossedAt(cur, s, e))
      ) {
        join = true;
      }
      if (!join && e - s <= opts.maxOpeningWithSymbol) {
        const half = cur.d / 2 + 5;
        const corners = [
          pointAt(cl, cur.c - half, s),
          pointAt(cl, cur.c + half, s),
          pointAt(cl, cur.c - half, e),
          pointAt(cl, cur.c + half, e),
        ];
        const gap: Bounds = {
          min: [Math.min(...corners.map((p) => p[0])), Math.min(...corners.map((p) => p[1]))],
          max: [Math.max(...corners.map((p) => p[0])), Math.max(...corners.map((p) => p[1]))],
        };
        let best: { ev: OpeningEvidence; share: number } | null = null;
        for (const ev of evidence) {
          if (!boundsOverlap(ev.bounds, gap)) continue;
          const ts = [
            ev.bounds.min,
            ev.bounds.max,
            [ev.bounds.min[0], ev.bounds.max[1]] as Xy,
            [ev.bounds.max[0], ev.bounds.min[1]] as Xy,
          ].map((p) => dot(cl.u, p));
          const share = (Math.min(e, Math.max(...ts)) - Math.max(s, Math.min(...ts))) / (e - s);
          if (share >= 0.5 && (!best || share > best.share)) best = { ev, share };
        }
        if (best) {
          join = true;
          opening = { kind: best.ev.kind, t0: s, t1: e, evidence: best.ev.source };
        } else if (e - s <= opts.maxPlainOpening) {
          join = true;
          opening = { kind: 'opening', t0: s, t1: e, evidence: null };
        }
      }
      if (join) {
        const len = cur.t1 - cur.t0 + next.t1 - next.t0;
        cur = {
          ...cur,
          d: (cur.d * (cur.t1 - cur.t0) + next.d * (next.t1 - next.t0)) / len,
          t1: Math.max(cur.t1, next.t1),
          openings: opening ? [...cur.openings, opening] : cur.openings,
          tags: new Set([...cur.tags, ...next.tags]),
        };
      } else {
        merged.push(cur);
        cur = { ...next, openings: [], tags: new Set(next.tags) };
      }
    }
    merged.push(cur);
  }
  return merged;
}

/** Extends (or trims) each wall end to the centreline of the wall it runs into. */
function joinEnds(clusters: Cluster[], walls: Piece[]): Piece[] {
  const ends = walls.map((w) => ({ t0: w.t0, t1: w.t1 }));
  walls.forEach((w, i) => {
    for (const side of ['t0', 't1'] as const) {
      const tEnd = w[side];
      const sign = side === 't0' ? -1 : 1;
      let best: { t: number; s: number } | null = null;
      for (const v of walls) {
        if (v === w || v.cluster === w.cluster) continue;
        const x = crossing(clusters[w.cluster]!, w.c, clusters[v.cluster]!, v.c);
        if (!x) continue;
        const s = sign * (x.ta - tEnd);
        const reachW = v.d / 2 / x.sin + 3;
        const reachV = w.d / 2 / x.sin + 3;
        if (s < -reachW || s > reachW) continue;
        if (x.tb < v.t0 - reachV || x.tb > v.t1 + reachV) continue;
        if (!best || Math.abs(s) < Math.abs(best.s)) best = { t: x.ta, s };
      }
      if (best) ends[i]![side] = best.t;
    }
  });
  return walls.map((w, i) => ({ ...w, ...ends[i]! }));
}

export function detectWalls(
  lines: FaceLine[],
  evidence: OpeningEvidence[],
  opts: WallOptions,
): WallDetection {
  const clusters = clusterFaces(lines);
  const { pieces, paired, unpaired } = pairFaces(clusters, opts);
  const walls = joinEnds(clusters, mergePieces(clusters, pieces, evidence, opts));
  return {
    walls: walls
      .filter((w) => w.t1 - w.t0 > 0.5)
      .map((w) => {
        const cl = clusters[w.cluster]!;
        return {
          start: pointAt(cl, w.c, w.t0),
          end: pointAt(cl, w.c, w.t1),
          thickness: w.d,
          openings: w.openings.map((o) => ({
            kind: o.kind,
            offset: o.t0 - w.t0,
            width: o.t1 - o.t0,
            evidence: o.evidence,
          })),
          tags: [...w.tags].sort(),
        };
      }),
    pairedLength: paired,
    unpairedLength: unpaired,
  };
}
