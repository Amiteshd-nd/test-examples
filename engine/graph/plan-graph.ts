import { deriveRooms, type DerivedRoom } from '../rooms/derive.ts';
import {
  centroid,
  compassOf,
  compassVector,
  insideRing,
  plotBox,
  plotZone,
} from '../rules/zones.ts';
import { levelsInOrder, values } from '../schema/collections.ts';
import type { DepthZone, GraphEdge, GraphEdgeKind, GraphNode, PlanGraph } from '../schema/graph.ts';
import type { Level, Plan } from '../schema/plan.ts';
import { Compass, roundCm, type Point } from '../schema/primitives.ts';
import { roomTypeLabel } from '../schema/room-types.ts';

// The Plan Graph (PRD §4.2, P3.3), derived from the plan, never edited by hand: one node per
// room (area, depth zone from the road, outside walls, entrance, Vastu zone) and one edge per
// pair of rooms that relate: an opening or unbuilt boundary between them (`open`), a door
// (`door`), a shared wall with no way through (`wall`), or only a corner (`adjacent`).
// Rooms on different levels are not linked yet (stairs come with multi-level work).

type Pt = readonly [number, number];
const sub = (a: Pt, b: Pt): Point => [a[0] - b[0], a[1] - b[1]];
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];

/** A floor edge this close (cm) to a wall's face lies along it. */
const ALONG_CM = 1.5;
/** Two rooms share a wall when their floors run along it, on its two sides, for this long (cm). */
const SHARED_CM = 10;
/** Rooms whose floors come this close (cm) without sharing a wall are `adjacent` (a corner). */
const NEAR_CM = 30;

const STRENGTH: Record<GraphEdgeKind, number> = { open: 0, door: 1, wall: 2, adjacent: 3 };

/** Where a room's floor runs along one of its walls or separators: from / to along it (cm), and which side. */
interface Contact {
  room: string;
  line: string;
  wall: boolean;
  side: number;
  from: number;
  to: number;
}

function contacts(level: Level, shape: DerivedRoom): Contact[] {
  const c = centroid(shape.outer);
  const lines = [
    ...shape.wall_ids.flatMap((id) => {
      const w = level.walls[id];
      return w ? [{ id, start: w.start, end: w.end, half: w.thickness / 2, wall: true }] : [];
    }),
    ...shape.separator_ids.flatMap((id) => {
      const s = level.separators[id];
      return s ? [{ id, start: s.start, end: s.end, half: 0, wall: false }] : [];
    }),
  ];
  const out: Contact[] = [];
  for (const l of lines) {
    const len = Math.hypot(l.end[0] - l.start[0], l.end[1] - l.start[1]);
    if (len < 1e-6) continue;
    const u: Point = [(l.end[0] - l.start[0]) / len, (l.end[1] - l.start[1]) / len];
    const n: Point = [-u[1], u[0]];
    const off = (p: Pt) => dot(sub(p, l.start), n);
    const at = (p: Pt) => dot(sub(p, l.start), u);
    // The floor's outline and the outlines of wall blocks inside it (a duct, a column box).
    for (const ring of [shape.outer, ...shape.holes])
      ring.forEach((p, i) => {
        const q = ring[(i + 1) % ring.length]!;
        const [dp, dq] = [off(p), off(q)];
        if (
          Math.abs(Math.abs(dp) - l.half) > ALONG_CM ||
          Math.abs(Math.abs(dq) - l.half) > ALONG_CM
        )
          return;
        if (l.half > 0 && Math.sign(dp) !== Math.sign(dq)) return;
        const from = Math.max(0, Math.min(at(p), at(q)));
        const to = Math.min(len, Math.max(at(p), at(q)));
        if (to - from < 1) return;
        const side = l.half > 0 ? Math.sign(dp) : Math.sign(off(c)) || 1;
        out.push({ room: shape.room_id, line: l.id, wall: l.wall, side, from, to });
      });
  }
  return out;
}

/** Nearest distance between two rings (cm). */
function gap(a: readonly Pt[], b: readonly Pt[]): number {
  const toSeg = (p: Pt, s: Pt, e: Pt) => {
    const d = sub(e, s);
    const l2 = dot(d, d);
    const t = l2 ? Math.max(0, Math.min(1, dot(sub(p, s), d) / l2)) : 0;
    return Math.hypot(p[0] - s[0] - t * d[0], p[1] - s[1] - t * d[1]);
  };
  let best = Infinity;
  for (const [ring, other] of [
    [a, b],
    [b, a],
  ] as const)
    for (const p of ring)
      for (let i = 0; i < other.length; i++)
        best = Math.min(best, toSeg(p, other[i]!, other[(i + 1) % other.length]!));
  return best;
}

export interface PlanGraphOptions {
  /** Rooms already derived (`validatePlan(plan).rooms`), to save deriving them again. */
  rooms?: readonly DerivedRoom[];
}

/** The Plan Graph of every level: nodes in plan order, edges by their first room. */
export function planGraph(plan: Plan, options: PlanGraphOptions = {}): PlanGraph {
  const derived = options.rooms ?? levelsInOrder(plan).flatMap((l) => deriveRooms(l).rooms);
  const shapeOf = new Map(
    derived.filter((r) => r.outer.length >= 3).map((r) => [r.room_id, r] as const),
  );
  const plot = plotBox(plan);
  const front = compassVector(plan.meta.facing);
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const level of levelsInOrder(plan)) {
    const rooms = values(level.rooms);
    const touching = rooms.flatMap((r) => {
      const s = shapeOf.get(r.id);
      return s ? contacts(level, s) : [];
    });
    // Depth from the road: thirds of the level's floor, measured along the facing direction.
    const depths = rooms.flatMap((r) => shapeOf.get(r.id)?.outer ?? []).map((p) => dot(p, front));
    const [near, far] = [Math.max(...depths), Math.min(...depths)];
    const zoneAt = (p: Pt): DepthZone => {
      const t = near - far > 1 ? (near - dot(p, front)) / (near - far) : 0.5;
      return t < 1 / 3 ? 'front' : t > 2 / 3 ? 'rear' : 'middle';
    };
    const doorsOut = values(level.openings).filter(
      (o) => o.kind === 'door' && level.walls[o.wall]?.type === 'external',
    );
    const overlapsDoor = (c: Contact, o: { offset: number; width: number }) =>
      Math.min(c.to, o.offset + o.width) - Math.max(c.from, o.offset) >= o.width / 2;

    for (const r of rooms) {
      const shape = shapeOf.get(r.id);
      const c = shape ? centroid(shape.outer) : r.seed;
      const at = shape && insideRing(c, shape.outer) ? c : r.seed;
      const outside = touching.filter(
        (t) => t.room === r.id && level.walls[t.line]?.type === 'external',
      );
      const sides = new Set(
        outside.map((t) => {
          const w = level.walls[t.line]!;
          const len = Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]);
          // Away from the room: the wall's normal on the side the room isn't.
          return compassOf([
            (t.side * (w.end[1] - w.start[1])) / len,
            (-t.side * (w.end[0] - w.start[0])) / len,
          ]);
        }),
      );
      nodes.push({
        id: r.id,
        level: level.id,
        type: r.type,
        name: r.name || roomTypeLabel(r.type),
        area_m2: shape?.area_m2 ?? 0,
        at: [roundCm(at[0]), roundCm(at[1])],
        zone: zoneAt(at),
        exterior: outside.length > 0,
        exterior_sides: Compass.options.filter((d) => sides.has(d)),
        entrance: doorsOut.some((o) =>
          outside.some((t) => t.line === o.wall && overlapsDoor(t, o)),
        ),
        vastu_zone: plotZone(plot, at),
      });
    }

    // Pairs along the same wall or separator, on its two sides, sharing at least SHARED_CM.
    const found = new Map<string, { kind: GraphEdgeKind; via: Set<string> }>();
    const order = new Map(rooms.map((r, i) => [r.id, i]));
    const link = (x: string, y: string, kind: GraphEdgeKind, via: string[]) => {
      const [a, b] = order.get(x)! < order.get(y)! ? [x, y] : [y, x];
      const key = `${a}\u0000${b}`;
      const had = found.get(key);
      if (!had || STRENGTH[kind] < STRENGTH[had.kind]) found.set(key, { kind, via: new Set(via) });
      else if (had.kind === kind) for (const v of via) had.via.add(v);
    };
    for (let i = 0; i < touching.length; i++)
      for (let j = i + 1; j < touching.length; j++) {
        const [p, q] = [touching[i]!, touching[j]!];
        if (p.line !== q.line || p.room === q.room || p.side === q.side) continue;
        const from = Math.max(p.from, q.from);
        const to = Math.min(p.to, q.to);
        if (to - from < SHARED_CM) continue;
        if (!p.wall) {
          link(p.room, q.room, 'open', [p.line]);
          continue;
        }
        const through = values(level.openings).filter(
          (o) =>
            o.wall === p.line &&
            (o.kind === 'door' || o.kind === 'opening') &&
            overlapsDoor({ ...p, from, to }, o),
        );
        const arches = through.filter((o) => o.kind === 'opening').map((o) => o.id);
        const doors = through.filter((o) => o.kind === 'door').map((o) => o.id);
        if (arches.length) link(p.room, q.room, 'open', arches);
        if (doors.length) link(p.room, q.room, 'door', doors);
        link(p.room, q.room, 'wall', [p.line]);
      }
    // One space holding several rooms (open plan without a separator).
    for (const r of rooms)
      for (const other of shapeOf.get(r.id)?.shared_with ?? [])
        if (order.has(other)) link(r.id, other, 'open', []);
    // Rooms that only meet at a corner.
    const boxes = rooms.flatMap((r) => {
      const s = shapeOf.get(r.id);
      if (!s) return [];
      const xs = s.outer.map((p) => p[0]);
      const ys = s.outer.map((p) => p[1]);
      return [
        {
          id: r.id,
          ring: s.outer,
          x0: Math.min(...xs),
          x1: Math.max(...xs),
          y0: Math.min(...ys),
          y1: Math.max(...ys),
        },
      ];
    });
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const [p, q] = [boxes[i]!, boxes[j]!];
        if (
          p.x0 > q.x1 + NEAR_CM ||
          q.x0 > p.x1 + NEAR_CM ||
          p.y0 > q.y1 + NEAR_CM ||
          q.y0 > p.y1 + NEAR_CM
        )
          continue;
        if (gap(p.ring, q.ring) <= NEAR_CM) link(p.id, q.id, 'adjacent', []);
      }
    edges.push(
      ...[...found.entries()]
        .map(([key, e]) => {
          const [a, b] = key.split('\u0000') as [string, string];
          return { a, b, kind: e.kind, via: [...e.via].sort() };
        })
        .sort((x, y) => order.get(x.a)! - order.get(y.a)! || order.get(x.b)! - order.get(y.b)!),
    );
  }

  const facing = plan.meta.provenance?.facing?.provenance === 'assumed' ? 'assumed' : 'inferred';
  return {
    nodes,
    edges,
    provenance: {
      area_m2: { provenance: 'inferred', reason: 'Clear floor inside the walls.' },
      zone: {
        provenance: facing,
        reason: `Thirds of the floor's depth from the road side (facing ${plan.meta.facing.replace('_', '-')}).`,
      },
      exterior_sides: { provenance: 'assumed', reason: 'Assumes north points up in the drawing.' },
      vastu_zone: { provenance: 'assumed', reason: 'Assumes north points up in the drawing.' },
    },
  };
}
