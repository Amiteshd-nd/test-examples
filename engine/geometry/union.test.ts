import { describe, expect, it } from 'vitest';
import { ringArea2, type Vec } from './planar.ts';
import { unionOutlines } from './union.ts';

const rect = (x0: number, y0: number, x1: number, y1: number): Vec[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];
const area = (loops: Vec[][]) => loops.reduce((s, l) => s + ringArea2(l) / 2, 0);

describe('unionOutlines', () => {
  it('joins an L corner into one outline with six corners', () => {
    const loops = unionOutlines([rect(-10, -10, 400, 10), rect(-10, -10, 10, 300)]);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toHaveLength(6);
    expect(area(loops)).toBe(410 * 20 + 20 * 290);
  });

  it('keeps a ring of walls as an outer outline and a hole', () => {
    const loops = unionOutlines([
      rect(-10, -10, 410, 10),
      rect(390, -10, 410, 310),
      rect(-10, 290, 410, 310),
      rect(-10, -10, 10, 310),
    ]);
    expect(loops).toHaveLength(2);
    expect(loops.map((l) => Math.sign(ringArea2(l))).sort()).toEqual([-1, 1]);
    expect(area(loops)).toBe(420 * 320 - 380 * 280);
  });

  it('merges overlapping and touching shapes, and keeps separate ones apart', () => {
    expect(unionOutlines([rect(0, 0, 10, 10), rect(5, 0, 20, 10)])).toEqual([
      [
        [0, 0],
        [20, 0],
        [20, 10],
        [0, 10],
      ],
    ]);
    expect(unionOutlines([rect(0, 0, 10, 10), rect(10, 0, 20, 10)])).toHaveLength(1);
    expect(unionOutlines([rect(0, 0, 10, 10), rect(30, 0, 40, 10)])).toHaveLength(2);
  });
});
