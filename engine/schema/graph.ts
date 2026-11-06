import { z } from 'zod';
import { Compass, Id, Point, ProvenanceMap } from './primitives.ts';
import { RoomType } from './room-types.ts';
import { PlotZone } from './rule.ts';

// The Plan Graph (PRD §4.2, P3.3): rooms and how they connect, derived from the plan and never
// edited by hand. Layout (P5), plan adaptation (P6.3) and the model's training target (P8) read
// it; the editor draws it as an overlay. Not stored in plans: it is recomputed from them.

/** How deep in the building a room lies, seen from the road: the first, middle or last third. */
export const DepthZone = z.enum(['front', 'middle', 'rear']);
export type DepthZone = z.infer<typeof DepthZone>;

export const GraphNode = z.strictObject({
  /** The room's id. */
  id: Id,
  level: Id,
  type: RoomType,
  name: z.string(),
  /** Clear floor area inside the walls. */
  area_m2: z.number().nonnegative(),
  /** A point inside the room for drawing the graph: its centroid, or its seed for odd shapes. */
  at: Point,
  zone: DepthZone,
  /** Has a stretch of external wall. */
  exterior: z.boolean(),
  /** Which way its external walls face, in compass order. */
  exterior_sides: z.array(Compass),
  /** A door in an external wall opens into it. */
  entrance: z.boolean(),
  /** Its ninth of the plot (3 × 3 grid, north up), as the Vastu checks use. */
  vastu_zone: PlotZone,
});
export type GraphNode = z.infer<typeof GraphNode>;

/**
 * How two rooms relate, strongest first: `open` (an opening without a door, an unbuilt boundary
 * or one shared space), `door`, `wall` (a shared wall, no way through), `adjacent` (they only
 * touch at a corner or come within a wall's thickness).
 */
export const GraphEdgeKind = z.enum(['open', 'door', 'wall', 'adjacent']);
export type GraphEdgeKind = z.infer<typeof GraphEdgeKind>;

export const GraphEdge = z.strictObject({
  /** Room ids, in plan order. */
  a: Id,
  b: Id,
  kind: GraphEdgeKind,
  /** What joins them: the doors or openings for `door` / `open`, the walls for `wall`, the separators of an open boundary; empty for `adjacent` and a shared space. */
  via: z.array(Id),
});
export type GraphEdge = z.infer<typeof GraphEdge>;

export const PlanGraph = z.strictObject({
  nodes: z.array(GraphNode),
  edges: z.array(GraphEdge),
  /** How the derived fields were obtained (`zone` follows the plan's facing, `vastu_zone` assumes north up). */
  provenance: ProvenanceMap,
});
export type PlanGraph = z.infer<typeof PlanGraph>;
