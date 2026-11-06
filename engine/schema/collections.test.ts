import { describe, expect, it } from 'vitest';
import { orderBetween } from './collections.ts';

describe('orderBetween (fractional index)', () => {
  it('always lands strictly between its neighbours', () => {
    expect(orderBetween()).toBe('i');
    expect(orderBetween('i', null) > 'i').toBe(true);
    expect(orderBetween(null, 'i') < 'i').toBe(true);
    const mid = orderBetween('i', 'j');
    expect(mid > 'i' && mid < 'j').toBe(true);
  });

  it('keeps inserting between two keys without running out', () => {
    let lo = 'i';
    const hi = 'j';
    for (let n = 0; n < 200; n++) {
      const k = orderBetween(lo, hi);
      expect(k > lo && k < hi && !k.endsWith('0')).toBe(true);
      lo = k;
    }
  });

  it('refuses neighbours in the wrong order', () => {
    expect(() => orderBetween('j', 'i')).toThrow();
  });
});
