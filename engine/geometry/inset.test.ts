import { describe, expect, it } from 'vitest';
import { floatRingArea, insetRing, isSimpleFloatRing, pointInFloatRing } from './inset.ts';

describe('insetRing', () => {
  it('moves each edge inwards by its own distance', () => {
    const out = insetRing(
      [
        [0, 0],
        [100, 0],
        [100, 50],
        [0, 50],
      ],
      [5, 10, 5, 10],
    );
    expect(out).toEqual([
      [10, 5],
      [90, 5],
      [90, 45],
      [10, 45],
    ]);
  });

  it('merges straight runs with the same distance', () => {
    const out = insetRing(
      [
        [0, 0],
        [50, 0],
        [100, 0],
        [100, 100],
        [0, 100],
      ],
      [5, 5, 5, 5, 5],
    );
    expect(out).toHaveLength(4);
  });

  it('steps across where a straight run changes distance', () => {
    const out = insetRing(
      [
        [0, 0],
        [50, 0],
        [100, 0],
        [100, 100],
        [0, 100],
      ],
      [5, 2, 5, 5, 5],
    );
    expect(out).toEqual([
      [5, 5],
      [50, 5],
      [50, 2],
      [95, 2],
      [95, 95],
      [5, 95],
    ]);
  });

  it('handles reflex corners of an L shape', () => {
    const out = insetRing(
      [
        [0, 0],
        [20, 0],
        [20, 10],
        [10, 10],
        [10, 20],
        [0, 20],
      ],
      [1, 1, 1, 1, 1, 1],
    );
    expect(out).toEqual([
      [1, 1],
      [19, 1],
      [19, 9],
      [9, 9],
      [9, 19],
      [1, 19],
    ]);
  });

  it('grows a clockwise ring outwards (hole around a duct)', () => {
    const out = insetRing(
      [
        [0, 0],
        [0, 10],
        [10, 10],
        [10, 0],
      ],
      [1, 1, 1, 1],
    );
    expect(floatRingArea(out!)).toBe(-144);
  });

  it('refuses when walls are thicker than the room', () => {
    // A square shrunk past its centre flips both ways and keeps a positive area,
    // so edge direction, not area, is what catches it.
    expect(
      insetRing(
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ],
        [6, 6, 6, 6],
      ),
    ).toBeNull();
    expect(
      insetRing(
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ],
        [5, 5, 5, 5],
      ),
    ).toBeNull();
    expect(
      insetRing(
        [
          [0, 0],
          [100, 0],
          [100, 10],
          [0, 10],
        ],
        [6, 1, 6, 1],
      ),
    ).toBeNull();
  });
});

describe('float ring helpers', () => {
  it('tests containment and simplicity', () => {
    const sq: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    expect(pointInFloatRing([5, 5], sq)).toBe(true);
    expect(pointInFloatRing([11, 5], sq)).toBe(false);
    expect(isSimpleFloatRing(sq)).toBe(true);
    expect(
      isSimpleFloatRing([
        [0, 0],
        [10, 10],
        [10, 0],
        [0, 10],
      ]),
    ).toBe(false);
  });
});
