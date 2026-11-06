import { describe, expect, it } from 'vitest';
import { Id } from './schema/primitives.ts';
import { formatUlid, sequentialIds, steppingClock } from './ids.ts';

describe('ids and clocks', () => {
  it('formats ULIDs that sort by time and are valid ids', () => {
    const zeros = new Array(10).fill(0);
    const ones = new Array(10).fill(255);
    expect(formatUlid(0, zeros)).toBe('00000000000000000000000000');
    expect(formatUlid(2 ** 48 - 1, ones)).toBe('7ZZZZZZZZZZZZZZZZZZZZZZZZZ');
    // The ULID spec's example time.
    expect(formatUlid(1469918176385, zeros).slice(0, 10)).toBe('01ARYZ6S41');
    const a = formatUlid(1_800_000_000_000, ones);
    const b = formatUlid(1_800_000_000_001, zeros);
    expect(a < b).toBe(true);
    expect(Id.safeParse(a).success).toBe(true);
    expect(() => formatUlid(-1, zeros)).toThrow();
    expect(() => formatUlid(1, [1, 2, 3])).toThrow();
  });

  it('gives repeatable ids and times for tests', () => {
    const ids = sequentialIds('f');
    expect([ids.next(), ids.next()]).toEqual(['f-0001', 'f-0002']);
    const clock = steppingClock('2026-11-06T10:00:00.000Z', 60_000);
    expect([clock.now(), clock.now()]).toEqual([
      '2026-11-06T10:00:00.000Z',
      '2026-11-06T10:01:00.000Z',
    ]);
  });
});
