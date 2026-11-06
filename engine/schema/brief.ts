import { z } from 'zod';
import { Compass, Id, NonNegativeCm, PositiveCm } from './primitives.ts';
import { RoomType } from './room-types.ts';

// Brief (PRD §4.6): input to generation and the model's training target.

export const BriefRoom = z.strictObject({
  id: Id,
  type: RoomType,
  target_m2: z.number().positive(),
});

export const Adjacency = z.strictObject({
  a: Id,
  b: Id,
  rel: z.enum(['door', 'open', 'wall', 'adjacent']),
  strength: z.enum(['must', 'should', 'avoid']),
});

export const Brief = z.strictObject({
  plot: z.strictObject({
    width_cm: PositiveCm,
    depth_cm: PositiveCm,
    road_facing: Compass,
  }),
  setbacks_cm: z.strictObject({
    front: NonNegativeCm,
    rear: NonNegativeCm,
    left: NonNegativeCm,
    right: NonNegativeCm,
  }),
  bhk: z.number().int().min(0).max(20),
  floors: z.number().int().min(1).max(10),
  vastu: z.boolean(),
  parking: z.number().int().min(0),
  rooms: z.array(BriefRoom),
  adjacency: z.array(Adjacency),
  locked_room_ids: z.array(Id),
});
export type Brief = z.infer<typeof Brief>;
