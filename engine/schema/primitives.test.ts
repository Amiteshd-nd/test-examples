import { describe, expect, it } from 'vitest';
import { Cm, Id, MAX_COORD_CM, PositiveCm, isOnMmGrid, roundCm, roundM2 } from './primitives.ts';

describe('units', () => {
  it('accepts values on the 0.1 cm grid only', () => {
    expect(isOnMmGrid(11.5)).toBe(true);
    expect(isOnMmGrid(0.3)).toBe(true);
    expect(isOnMmGrid(-914.4)).toBe(true);
    expect(isOnMmGrid(11.55)).toBe(false);
    expect(Cm.safeParse(11.55).success).toBe(false);
    expect(Cm.safeParse(MAX_COORD_CM + 1).success).toBe(false);
    expect(Cm.safeParse(Number.NaN).success).toBe(false);
  });

  it('requires positive lengths where a length must exist', () => {
    expect(PositiveCm.safeParse(0).success).toBe(false);
    expect(PositiveCm.safeParse(0.1).success).toBe(true);
  });

  it('rounds to 1 mm and 0.01 m²', () => {
    expect(roundCm(294.25)).toBe(294.3);
    expect(roundCm(-0.04)).toBe(-0);
    expect(roundM2(10.659675)).toBe(10.66);
  });

  it('accepts stable ids and rejects odd ones', () => {
    for (const ok of ['W1', 'R-12', 'level_0', 'D1.a']) expect(Id.safeParse(ok).success).toBe(true);
    for (const bad of ['', ' W1', '-W1', 'W 1', 'x'.repeat(65)]) {
      expect(Id.safeParse(bad).success).toBe(false);
    }
  });
});
