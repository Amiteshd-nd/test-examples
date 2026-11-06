import { describe, expect, it } from 'vitest';
import { RTree, boxAround, type Box } from './rtree.ts';

// Deterministic random numbers, so a failure always reproduces.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}
const touches = (a: Box, b: Box) =>
  a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;

describe('RTree', () => {
  it('finds what it holds and forgets what is removed', () => {
    const tree = new RTree<string>();
    tree.insert({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, 'a');
    tree.insert({ minX: 20, minY: 0, maxX: 30, maxY: 10 }, 'b');
    expect(tree.search({ minX: 5, minY: 5, maxX: 6, maxY: 6 })).toEqual(['a']);
    expect(tree.search({ minX: 10, minY: 0, maxX: 20, maxY: 0 }).sort()).toEqual(['a', 'b']);
    expect(tree.remove({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, 'a')).toBe(true);
    expect(tree.remove({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, 'a')).toBe(false);
    expect(tree.all()).toEqual(['b']);
    expect(tree.size).toBe(1);
  });

  it('matches a brute-force search through 2,000 inserts, 1,200 removals and 300 queries', () => {
    const rand = rng(7);
    const tree = new RTree<number>();
    const live = new Map<number, Box>();
    const randomBox = (): Box => {
      const x = rand() * 2000;
      const y = rand() * 1500;
      return { minX: x, minY: y, maxX: x + rand() * 60, maxY: y + rand() * 60 };
    };
    for (let i = 0; i < 2000; i++) {
      const b = randomBox();
      tree.insert(b, i);
      live.set(i, b);
      if (i % 5 === 4) {
        // Remove a few, including recently added ones, so nodes underflow and re-insert.
        for (const id of [i - 2, Math.floor(rand() * i)]) {
          const box = live.get(id);
          expect(tree.remove(box ?? randomBox(), id)).toBe(box !== undefined);
          live.delete(id);
        }
      }
    }
    expect(tree.size).toBe(live.size);
    expect(tree.check()).toBeGreaterThan(2);
    for (let q = 0; q < 300; q++) {
      const box = randomBox();
      const expected = [...live].filter(([, b]) => touches(b, box)).map(([id]) => id);
      expect(tree.search(box).sort((a, b) => a - b)).toEqual(expected.sort((a, b) => a - b));
    }
    for (const [id, box] of live) expect(tree.remove(box, id)).toBe(true);
    expect(tree.size).toBe(0);
    expect(tree.search({ minX: -1e9, minY: -1e9, maxX: 1e9, maxY: 1e9 })).toEqual([]);
    tree.check();
  });

  it('builds boxes around points', () => {
    expect(
      boxAround(
        [
          [1, 2],
          [5, -3],
        ],
        1,
      ),
    ).toEqual({ minX: 0, minY: -4, maxX: 6, maxY: 3 });
  });
});
