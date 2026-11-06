import { describe, expect, it } from 'vitest';
import {
  buildArrangement,
  isSimpleRing,
  pointInRing,
  pruneDangling,
  segmentContacts,
  traceFaces,
  type Vec,
} from './planar.ts';

const seg = (a: Vec, b: Vec, data = '') => ({ a, b, data });

describe('segmentContacts', () => {
  it('finds proper crossings, T-junctions and collinear overlaps', () => {
    expect(segmentContacts([0, 0], [10, 10], [0, 10], [10, 0])).toEqual([[5, 5]]);
    expect(segmentContacts([0, 0], [10, 0], [5, 0], [5, 8])).toEqual([[5, 0]]);
    expect(segmentContacts([0, 0], [10, 0], [4, 0], [20, 0])).toEqual([
      [10, 0],
      [4, 0],
    ]);
    expect(segmentContacts([0, 0], [10, 0], [11, 0], [20, 0])).toEqual([]);
    expect(segmentContacts([0, 0], [10, 0], [0, 1], [10, 1])).toEqual([]);
  });

  it('rounds a diagonal crossing to the nearest mm', () => {
    expect(segmentContacts([0, 0], [3, 1], [0, 1], [3, 0])).toEqual([[2, 1]]);
  });
});

describe('arrangement and faces', () => {
  const square = [
    seg([0, 0], [100, 0], 'S'),
    seg([100, 0], [100, 100], 'E'),
    seg([100, 100], [0, 100], 'N'),
    seg([0, 100], [0, 0], 'W'),
  ];

  it('splits walls at T and X junctions', () => {
    const arr = buildArrangement([
      ...square,
      seg([50, 0], [50, 100], 'X'),
      seg([0, 50], [100, 50], 'Y'),
    ]);
    // 4 sides split in two, plus X and Y split in two each.
    expect(arr.edges).toHaveLength(12);
    const faces = traceFaces(arr);
    expect(faces.filter((f) => f.area2 > 0)).toHaveLength(4);
    expect(faces.filter((f) => f.area2 < 0)).toHaveLength(1);
  });

  it('merges collinear overlapping walls and keeps both sources', () => {
    const arr = buildArrangement([...square, seg([0, 0], [60, 0], 'S2')]);
    const shared = arr.edges.filter((e) => e.data.includes('S2'));
    expect(shared).toHaveLength(1);
    expect(shared[0]!.data.sort()).toEqual(['S', 'S2']);
  });

  it('prunes wall stubs with a free end', () => {
    const arr = pruneDangling(buildArrangement([...square, seg([100, 50], [60, 50], 'stub')]));
    expect(arr.edges.some((e) => e.data.includes('stub'))).toBe(false);
    expect(traceFaces(arr).filter((f) => f.area2 > 0)).toHaveLength(1);
  });

  it('joins ends that stop within the snap distance, and only then', () => {
    const t = [...square, seg([50, 99], [50, 40], 'T')]; // stops 1 mm short of the top wall
    expect(buildArrangement(t).edges.filter((e) => e.data.includes('N'))).toHaveLength(1);
    const snapped = pruneDangling(buildArrangement(t, 1));
    expect(snapped.edges.filter((e) => e.data.includes('N'))).toHaveLength(2);
    expect(snapped.edges.some((e) => e.data.includes('T'))).toBe(false); // still a stub below
    const gapped = [...square, seg([50, 0], [50, 98]), seg([50, 98], [50, 99])];
    expect(
      traceFaces(pruneDangling(buildArrangement(gapped, 1))).filter((f) => f.area2 > 0),
    ).toHaveLength(2);
  });

  it('gives each separate wall group its own component', () => {
    const inner = [
      seg([40, 40], [60, 40]),
      seg([60, 40], [60, 60]),
      seg([60, 60], [40, 60]),
      seg([40, 60], [40, 40]),
    ];
    const faces = traceFaces(buildArrangement([...square, ...inner]));
    expect(new Set(faces.map((f) => f.component)).size).toBe(2);
    expect(faces.filter((f) => f.area2 < 0)).toHaveLength(2);
  });
});

describe('ring predicates', () => {
  const ring: Vec[] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];

  it('classifies points inside, outside and on the boundary', () => {
    expect(pointInRing([5, 5], ring)).toBe('inside');
    expect(pointInRing([15, 5], ring)).toBe('outside');
    expect(pointInRing([10, 5], ring)).toBe('boundary');
    expect(pointInRing([0, 0], ring)).toBe('boundary');
  });

  it('detects self-intersection and fold-backs', () => {
    expect(isSimpleRing(ring)).toBe(true);
    expect(
      isSimpleRing([
        [0, 0],
        [10, 10],
        [10, 0],
        [0, 10],
      ]),
    ).toBe(false);
    expect(
      isSimpleRing([
        [0, 0],
        [10, 0],
        [5, 0],
        [5, 5],
      ]),
    ).toBe(false);
    expect(
      isSimpleRing([
        [0, 0],
        [10, 0],
        [10, 10],
        [5, 0],
        [0, 10],
      ]),
    ).toBe(false);
  });
});
