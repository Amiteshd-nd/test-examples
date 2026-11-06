import { describe, expect, it } from 'vitest';
import a from '../samples/1.2.0/a-one-room.plan.json' with { type: 'json' };
import b from '../samples/1.2.0/b-1bhk-t-junctions.plan.json' with { type: 'json' };
import c from '../samples/1.2.0/c-l-hall-duct.plan.json' with { type: 'json' };
import d from '../samples/1.2.0/d-open-plan-separator.plan.json' with { type: 'json' };
import { firstLevel } from '../schema/collections.ts';
import { Plan } from '../schema/plan.ts';
import { deriveRooms } from './derive.ts';

// PRD P1.1 acceptance: room derivation correct on 3 hand-made plans.
// Expected values are worked out by hand in engine/samples/1.2.0/README.md.

const level = (doc: unknown) => firstLevel(Plan.parse(doc));
const byId = (doc: unknown) => {
  const { rooms, issues } = deriveRooms(level(doc));
  expect(issues).toEqual([]);
  return Object.fromEntries(rooms.map((r) => [r.room_id, r]));
};

describe('room derivation on hand-made plans', () => {
  it('A: one room, 23 cm walls', () => {
    const { R1 } = byId(a);
    expect(R1!.outer).toEqual([
      [11.5, 11.5],
      [388.5, 11.5],
      [388.5, 288.5],
      [11.5, 288.5],
    ]);
    expect(R1!.area_m2).toBe(10.44);
    expect(R1!.wall_ids).toEqual(['W1', 'W2', 'W3', 'W4']);
  });

  it('B: 1BHK with T-junctions and 11.5 cm internal walls', () => {
    const rooms = byId(b);
    expect(rooms.R1!.area_m2).toBe(10.66);
    expect(rooms.R2!.area_m2).toBe(6.58);
    expect(rooms.R3!.area_m2).toBe(3.75);
    // The bedroom's right side is one straight run of W5 although W6 joins it from the other side.
    expect(rooms.R1!.outer).toHaveLength(4);
    expect(rooms.R2!.wall_ids).toEqual(['W1', 'W2', 'W5', 'W6']);
  });

  it('C: L-shaped hall with a thickness change, a free-standing duct and a stub', () => {
    const { R1, R2 } = byId(c);
    expect(R1!.outer).toEqual([
      [11.5, 11.5],
      [500, 11.5],
      [500, 7.5],
      [788.5, 7.5],
      [788.5, 288.5],
      [388.5, 288.5],
      [388.5, 588.5],
      [11.5, 588.5],
    ]);
    expect(R1!.holes).toEqual([
      [
        [95, 395],
        [95, 465],
        [165, 465],
        [165, 395],
      ],
    ]);
    expect(R1!.area_m2).toBe(32.46);
    expect(R1!.wall_ids).not.toContain('STUB');
    expect(R2!.area_m2).toBe(0.25);
  });

  it('D: separators split an open plan into rooms with their own areas (A2, M3)', () => {
    // Living 11.5…250 × 11.5…388.5; dining 250…494.25; kitchen 505.75…788.5.
    const rooms = byId(d);
    expect([rooms.R1!.area_m2, rooms.R2!.area_m2, rooms.R3!.area_m2]).toEqual([8.99, 9.21, 10.66]);
    expect(rooms.R1!.separator_ids).toEqual(['SP1']);
    expect(rooms.R1!.wall_ids).toEqual(['W1', 'W3', 'W4']);
    // Without the separator, living and dining are one area again.
    const open = Plan.parse(d);
    firstLevel(open).separators = {};
    expect(deriveRooms(firstLevel(open)).issues.map((i) => i.rule_id)).toEqual([
      'geometry.rooms_share_area',
    ]);
  });

  it('moves room outlines when a wall moves', () => {
    const doc = Plan.parse(b);
    const lvl = firstLevel(doc);
    const w5 = lvl.walls.W5!;
    w5.start = [320, 0];
    w5.end = [320, 400];
    lvl.walls.W6!.start = [320, 250];
    const rooms = Object.fromEntries(deriveRooms(lvl).rooms.map((r) => [r.room_id, r]));
    expect(rooms.R1!.area_m2).toBe(11.41); // (314.25 − 11.5) × 377 cm
  });
});
