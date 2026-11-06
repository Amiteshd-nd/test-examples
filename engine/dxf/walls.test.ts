import { describe, expect, it } from 'vitest';
import { detectWalls, type FaceLine, type OpeningEvidence } from './walls.ts';

const OPTS = {
  minThickness: 7.5,
  maxThickness: 60,
  maxOpeningWithSymbol: 400,
  maxPlainOpening: 150,
};
const L = (a: [number, number], b: [number, number]): FaceLine => ({ a, b });
const rect = (x0: number, y0: number, x1: number, y1: number): FaceLine[] => [
  L([x0, y0], [x1, y0]),
  L([x1, y0], [x1, y1]),
  L([x1, y1], [x0, y1]),
  L([x0, y1], [x0, y0]),
];
const r = (n: number) => Math.round(n * 100) / 100 + 0; // + 0 turns -0 into 0
/** Walls as sorted, rounded [x0, y0, x1, y1, thickness] with each wall's ends in sorted order. */
const summary = (faces: FaceLine[], evidence: OpeningEvidence[] = []) => {
  const { walls } = detectWalls(faces, evidence, OPTS);
  return walls
    .map((w) => {
      const [a, b] = [w.start, w.end].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
      return [
        r(a![0]),
        r(a![1]),
        r(b![0]),
        r(b![1]),
        r(w.thickness),
        w.openings.map((o) => `${o.kind}@${r(o.offset)}+${r(o.width)}`).join(' '),
      ];
    })
    .sort((p, q) => String(p).localeCompare(String(q)));
};

describe('detectWalls', () => {
  it('pairs the faces of a closed room and meets at the corners', () => {
    expect(summary([...rect(-10, -10, 410, 310), ...rect(10, 10, 390, 290)])).toEqual([
      [0, 0, 0, 300, 20, ''],
      [0, 0, 400, 0, 20, ''],
      [0, 300, 400, 300, 20, ''],
      [400, 0, 400, 300, 20, ''],
    ]);
  });

  it('runs a wall through a T-junction and extends the stem to it', () => {
    const faces = [
      ...rect(-10, -10, 410, 310),
      L([10, 10], [195, 10]),
      L([205, 10], [390, 10]),
      L([390, 10], [390, 290]),
      L([390, 290], [205, 290]),
      L([195, 290], [10, 290]),
      L([10, 290], [10, 10]),
      L([195, 10], [195, 290]),
      L([205, 10], [205, 290]),
    ];
    expect(summary(faces)).toContainEqual([200, 0, 200, 300, 10, '']);
    expect(summary(faces)).toContainEqual([0, 0, 400, 0, 20, '']);
  });

  it('keeps both walls whole where they cross', () => {
    const faces = [
      L([-100, -5], [-5, -5]),
      L([5, -5], [100, -5]),
      L([-100, 5], [-5, 5]),
      L([5, 5], [100, 5]),
      L([-5, -100], [-5, -5]),
      L([-5, 5], [-5, 100]),
      L([5, -100], [5, -5]),
      L([5, 5], [5, 100]),
    ];
    expect(summary(faces)).toEqual([
      [-100, 0, 100, 0, 10, ''],
      [0, -100, 0, 100, 10, ''],
    ]);
  });

  it('bridges openings: with a symbol, short plain gaps, but not long ones', () => {
    const wall = (gapFrom: number, gapTo: number) => [
      L([0, -10], [gapFrom, -10]),
      L([gapTo, -10], [600, -10]),
      L([0, 10], [gapFrom, 10]),
      L([gapTo, 10], [600, 10]),
    ];
    const door: OpeningEvidence = {
      kind: 'door',
      bounds: { min: [100, 10], max: [190, 100] },
      source: 'block',
    };
    expect(summary(wall(100, 190), [door])).toEqual([[0, 0, 600, 0, 20, 'door@100+90']]);
    expect(summary(wall(100, 180))).toEqual([[0, 0, 600, 0, 20, 'opening@100+80']]);
    expect(summary(wall(100, 300))).toHaveLength(2);
  });

  it('does not mistake the jamb lines of a narrow opening for a wall', () => {
    const faces = [
      L([0, -10], [100, -10]),
      L([150, -10], [300, -10]),
      L([0, 10], [100, 10]),
      L([150, 10], [300, 10]),
      L([100, -10], [100, 10]),
      L([150, -10], [150, 10]),
    ];
    expect(summary(faces)).toEqual([[0, 0, 300, 0, 20, 'opening@100+50']]);
  });

  it('ignores lines farther apart than a wall can be thick', () => {
    expect(summary([L([0, 0], [300, 0]), L([0, 80], [300, 80])])).toEqual([]);
  });
});
