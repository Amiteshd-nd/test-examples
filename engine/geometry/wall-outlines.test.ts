import { describe, expect, it } from 'vitest';
import { firstLevel } from '../schema/collections.ts';
import { Plan } from '../schema/plan.ts';
import sample from '../samples/1.2.0/a-one-room.plan.json' with { type: 'json' };
import { ringArea2 } from './planar.ts';
import { wallOutlinesCm } from './wall-outlines.ts';

const level = firstLevel(Plan.parse(sample));
const area = (loops: [number, number][][]) => loops.reduce((s, l) => s + ringArea2(l) / 2, 0);

describe('wallOutlinesCm', () => {
  it('draws a room of four walls as one outline with a hole, corners filled', () => {
    const house = {
      ...level,
      walls: { W1: level.walls.W1!, W2: level.walls.W2!, W3: level.walls.W3!, W4: level.walls.W4! },
    };
    const loops = wallOutlinesCm(house, { solid: true });
    expect(loops).toHaveLength(2);
    // 423 × 323 outside, 377 × 277 inside (23 cm walls on a 400 × 300 centreline box).
    expect(area(loops)).toBeCloseTo(423 * 323 - 377 * 277, 6);
    expect(
      loops.flat().every(([x, y]) => x >= -11.5 && x <= 411.5 && y >= -11.5 && y <= 311.5),
    ).toBe(true);
  });

  it('cuts openings out unless solid', () => {
    const solid = area(wallOutlinesCm(level, { solid: true }));
    const cut = area(wallOutlinesCm(level));
    // Door D1 (90 cm) and window N1 (120 cm) in 23 cm walls.
    expect(solid - cut).toBeCloseTo((90 + 120) * 23, 6);
  });
});
