import { z } from 'zod';
import {
  Cm,
  Compass,
  Id,
  NonNegativeCm,
  Point,
  Polygon,
  PositiveCm,
  ProvenanceMap,
} from './primitives.ts';
import { RoomType } from './room-types.ts';
import { CURRENT_SCHEMA_VERSION } from './version.ts';

// The Plan document (PRD §4.1). Single source of truth; all lengths in cm.

/** `parapet`: terrace/roof edge wall. `compound`: the plot's boundary wall. */
export const WallType = z.enum(['external', 'internal', 'parapet', 'compound']);
export type WallType = z.infer<typeof WallType>;

/** A wall is its centreline plus a thickness. Rooms are derived from walls, never stored as shapes. */
export const Wall = z.strictObject({
  id: Id,
  start: Point,
  end: Point,
  thickness: PositiveCm,
  type: WallType,
  height: PositiveCm.optional(),
  provenance: ProvenanceMap.optional(),
});
export type Wall = z.infer<typeof Wall>;

/** Storage shelf above part of a room, running along one of its walls. */
export const Loft = z.strictObject({
  wall: Id,
  /** How far the loft projects into the room from the wall face. */
  depth: PositiveCm,
  /** Height of the loft slab's underside above the floor. */
  height_above_floor: PositiveCm,
});
export type Loft = z.infer<typeof Loft>;

export const RoomBehavior = z.enum(['fill', 'fixed', 'range']);

export const SizeRange = z.strictObject({
  min_w: PositiveCm.optional(),
  max_w: PositiveCm.optional(),
  min_d: PositiveCm.optional(),
  max_d: PositiveCm.optional(),
  min_area_m2: z.number().positive().optional(),
  max_area_m2: z.number().positive().optional(),
});
export type SizeRange = z.infer<typeof SizeRange>;

/**
 * A room stores identity and intent. Its shape is computed from the walls around `seed`
 * (see `rooms/derive.ts`); `polygon` is an optional cache for readers and is never authoritative.
 */
export const Room = z.strictObject({
  id: Id,
  type: RoomType,
  name: z.string(),
  seed: Point,
  behavior: RoomBehavior,
  locked: z.boolean(),
  size_range: SizeRange.optional(),
  loft: Loft.optional(),
  polygon: Polygon.optional(),
  provenance: ProvenanceMap.optional(),
});
export type Room = z.infer<typeof Room>;

/** Sunshade projecting outside over an opening. */
export const Chajja = z.strictObject({
  /** Projection from the outer wall face. */
  depth: PositiveCm,
  /** Extra length beyond each side of the opening. */
  overhang: NonNegativeCm,
});
export type Chajja = z.infer<typeof Chajja>;

const openingBase = {
  id: Id,
  /** Host wall id; the opening moves with its wall. */
  wall: Id,
  /** Distance along the wall centreline from the wall's `start` to the opening's near edge. */
  offset: NonNegativeCm,
  width: PositiveCm,
  height: PositiveCm.optional(),
  chajja: Chajja.optional(),
  provenance: ProvenanceMap.optional(),
};

export const DoorSwing = z.enum(['in-left', 'in-right', 'out-left', 'out-right']);

export const Opening = z.discriminatedUnion('kind', [
  z.strictObject({ ...openingBase, kind: z.literal('door'), swing: DoorSwing }),
  z.strictObject({ ...openingBase, kind: z.literal('window'), sill: NonNegativeCm }),
  z.strictObject({ ...openingBase, kind: z.literal('ventilator'), sill: NonNegativeCm }),
  /** A gap in the wall with no door or frame (arch, pass-through). */
  z.strictObject({ ...openingBase, kind: z.literal('opening') }),
]);
export type Opening = z.infer<typeof Opening>;

export const Stair = z.strictObject({
  id: Id,
  polygon: Polygon,
  direction: z.enum(['up', 'down']),
  to_level: Id.optional(),
  steps: z.number().int().positive().optional(),
  provenance: ProvenanceMap.optional(),
});
export type Stair = z.infer<typeof Stair>;

/** A structural column: `size` is [width along x, depth along y] before rotation. */
export const Column = z.strictObject({
  id: Id,
  at: Point,
  size: z.tuple([PositiveCm, PositiveCm]),
  rotation_deg: z.number().min(0).lt(360),
  provenance: ProvenanceMap.optional(),
});
export type Column = z.infer<typeof Column>;

/**
 * A room boundary that is not built (A2, M3): splits an open plan (living / dining), marks a
 * balcony or OTS edge. Bounds rooms like a wall of zero thickness.
 */
export const Separator = z.strictObject({
  id: Id,
  start: Point,
  end: Point,
  provenance: ProvenanceMap.optional(),
});
export type Separator = z.infer<typeof Separator>;

// Annotations (P2.5, format 1.2.0): drafting lines, dimensions, notes and hatches. They are
// drawn and exported with the plan but take no part in rooms, areas or checks.

/** A drafting line or polyline (2 or more points); `closed` joins the last point to the first. */
export const Line = z.strictObject({
  id: Id,
  points: z.array(Point).min(2),
  closed: z.boolean(),
  provenance: ProvenanceMap.optional(),
});
export type Line = z.infer<typeof Line>;

/**
 * A linear dimension measuring from `start` to `end`. Its dimension line runs parallel to them,
 * `offset` cm to the left of the direction start → end (negative: to the right).
 */
export const Dimension = z.strictObject({
  id: Id,
  start: Point,
  end: Point,
  offset: Cm,
  provenance: ProvenanceMap.optional(),
});
export type Dimension = z.infer<typeof Dimension>;

/** A note on the drawing: `size` is the text height in plan cm (25 cm prints 2.5 mm at 1:100). */
export const TextNote = z.strictObject({
  id: Id,
  at: Point,
  text: z.string().min(1).max(500),
  size: PositiveCm,
  rotation_deg: z.number().min(0).lt(360),
  provenance: ProvenanceMap.optional(),
});
export type TextNote = z.infer<typeof TextNote>;

export const HatchPattern = z.enum(['diagonal', 'cross', 'dots', 'solid']);
export type HatchPattern = z.infer<typeof HatchPattern>;
/** A hatched area, e.g. a wet floor or a sunken slab. */
export const Hatch = z.strictObject({
  id: Id,
  polygon: Polygon,
  pattern: HatchPattern,
  provenance: ProvenanceMap.optional(),
});
export type Hatch = z.infer<typeof Hatch>;

/** Fractional index (see `orderBetween`): orders items that need an order, e.g. levels. */
export const OrderKey = z
  .string()
  .regex(/^[0-9a-z]*[1-9a-z]$/, 'a fractional index (0–9, a–z, not ending in 0)');

/** Objects of one kind, keyed by their id (A2, M1). The key must equal the object's `id`. */
const byId = <T extends z.ZodType>(item: T) => z.record(Id, item);

/** Placeholder for furniture and sanitary fittings; detailed in a later prompt. */
export const Fixture = z.strictObject({
  id: Id,
  kind: z.string().min(1),
  at: Point,
  rotation_deg: z.number().min(0).lt(360),
  provenance: ProvenanceMap.optional(),
});
export type Fixture = z.infer<typeof Fixture>;

export const Level = z.strictObject({
  id: Id,
  name: z.string(),
  /** Position among the levels, lowest first (fractional index). */
  order: OrderKey,
  elevation: Cm,
  height: PositiveCm,
  walls: byId(Wall),
  separators: byId(Separator),
  rooms: byId(Room),
  openings: byId(Opening),
  stairs: byId(Stair),
  columns: byId(Column),
  fixtures: byId(Fixture),
  lines: byId(Line),
  dimensions: byId(Dimension),
  texts: byId(TextNote),
  hatches: byId(Hatch),
});
export type Level = z.infer<typeof Level>;

export const PlanMeta = z.strictObject({
  name: z.string(),
  bhk: z.number().int().min(0).max(20),
  floors: z.number().int().min(1).max(10),
  facing: Compass,
  vastu: z.boolean(),
  /** Rule-pack city key, e.g. "bengaluru". */
  city: z.string(),
  display_units: z.enum(['m', 'ft_in']),
  source: z.enum(['library', 'generated', 'manual']),
  provenance: ProvenanceMap.optional(),
});
export type PlanMeta = z.infer<typeof PlanMeta>;

export const Plot = z.strictObject({
  polygon: Polygon,
  road_sides: z.array(Compass),
  provenance: ProvenanceMap.optional(),
});
export type Plot = z.infer<typeof Plot>;

export const Setbacks = z.strictObject({
  front: NonNegativeCm,
  rear: NonNegativeCm,
  left: NonNegativeCm,
  right: NonNegativeCm,
  provenance: ProvenanceMap.optional(),
});
export type Setbacks = z.infer<typeof Setbacks>;

export const Plan = z.strictObject({
  schema_version: z.literal(CURRENT_SCHEMA_VERSION),
  meta: PlanMeta,
  plot: Plot,
  setbacks: Setbacks,
  levels: byId(Level).refine((m) => Object.keys(m).length > 0, 'a plan needs at least one level'),
  rule_pack_ids: z.array(Id),
});
export type Plan = z.infer<typeof Plan>;
