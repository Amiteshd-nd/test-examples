import type {
  Compass,
  DepthZone,
  GraphEdgeKind,
  Level,
  PlanGraph,
  PlotZone,
  Point,
} from '@plancraft/engine';

// How the editor shows the Plan Graph (P3.3): words for its fields, a room's neighbours for
// Properties, and the shapes of the canvas overlay. Pure, so it is tested without a browser.

export const DEPTH_WORD: Record<DepthZone, string> = {
  front: 'Front third (road side)',
  middle: 'Middle third',
  rear: 'Rear third',
};
export const KIND_WORD: Record<GraphEdgeKind, string> = {
  open: 'open',
  door: 'door',
  wall: 'wall',
  adjacent: 'corner',
};
const SHORT: Record<PlotZone, string> = {
  north: 'N',
  north_east: 'NE',
  east: 'E',
  south_east: 'SE',
  south: 'S',
  south_west: 'SW',
  west: 'W',
  north_west: 'NW',
  centre: 'C',
};
/** "North-east", "Centre". */
export const zoneWord = (z: PlotZone | Compass) => {
  const w = z.replace('_', '-');
  return w[0]!.toUpperCase() + w.slice(1);
};

export interface Neighbour {
  id: string;
  name: string;
  kind: GraphEdgeKind;
  via: string[];
}
const STRENGTH: Record<GraphEdgeKind, number> = { open: 0, door: 1, wall: 2, adjacent: 3 };

/** The rooms a room relates to, strongest link first, then in plan order. */
export function neighbours(graph: PlanGraph, id: string): Neighbour[] {
  const name = new Map(graph.nodes.map((n) => [n.id, n.name]));
  return graph.edges
    .filter((e) => e.a === id || e.b === id)
    .map((e, i) => ({ e, i, other: e.a === id ? e.b : e.a }))
    .sort((x, y) => STRENGTH[x.e.kind] - STRENGTH[y.e.kind] || x.i - y.i)
    .map(({ e, other }) => ({
      id: other,
      name: name.get(other) ?? other,
      kind: e.kind,
      via: e.via,
    }));
}

export interface GraphShapes {
  nodes: { id: string; at: Point; entrance: boolean; tag: string }[];
  /** Door and open links pass through the middle of their doorway. */
  edges: { a: string; b: string; kind: GraphEdgeKind; points: Point[] }[];
}

/** What the overlay draws for one level, in plan cm. */
export function graphShapes(graph: PlanGraph, level: Level): GraphShapes {
  const nodes = graph.nodes.filter((n) => n.level === level.id);
  const at = new Map(nodes.map((n) => [n.id, n.at]));
  const doorway = (id: string): Point[] => {
    const o = level.openings[id];
    const w = o && level.walls[o.wall];
    if (!o || !w) return [];
    const len = Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]) || 1;
    const t = (o.offset + o.width / 2) / len;
    return [[w.start[0] + t * (w.end[0] - w.start[0]), w.start[1] + t * (w.end[1] - w.start[1])]];
  };
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      at: n.at,
      entrance: n.entrance,
      tag: `${n.zone} · ${SHORT[n.vastu_zone]}`,
    })),
    edges: graph.edges.flatMap((e) => {
      const [a, b] = [at.get(e.a), at.get(e.b)];
      if (!a || !b) return [];
      const through =
        e.kind === 'door' || e.kind === 'open' ? (e.via.flatMap(doorway)[0] ?? null) : null;
      return [{ a: e.a, b: e.b, kind: e.kind, points: through ? [a, through, b] : [a, b] }];
    }),
  };
}
