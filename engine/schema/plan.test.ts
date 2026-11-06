import { describe, expect, it } from 'vitest';
import sample from '../samples/1.3.0/b-1bhk-t-junctions.plan.json' with { type: 'json' };
import { Plan } from './plan.ts';
import { ROOM_TYPES, RoomType } from './room-types.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixtures are mutated freely
type Doc = any;
const clone = (): Doc => JSON.parse(JSON.stringify(sample));

describe('Plan schema', () => {
  it('accepts a valid plan', () => {
    expect(Plan.safeParse(sample).success).toBe(true);
  });

  it('lists all PRD room types, including the Indian ones', () => {
    const ids = ROOM_TYPES.map((t) => t.id);
    for (const id of ['pooja', 'sit_out', 'ots', 'utility', 'servant', 'duct', 'wc']) {
      expect(ids).toContain(id);
    }
    expect(ids).toHaveLength(25);
    for (const id of ['dress', 'family_lounge', 'lift', 'shop_office']) expect(ids).toContain(id);
    expect(RoomType.safeParse('garage').success).toBe(false);
  });

  it.each([
    ['unknown room type', (d: Doc) => (d.levels.L0.rooms.R1.type = 'garage')],
    ['unknown field (typo)', (d: Doc) => (d.levels.L0.walls.W1.thicknes = 23)],
    ['missing room seed', (d: Doc) => delete d.levels.L0.rooms.R1.seed],
    ['off-grid coordinate', (d: Doc) => (d.levels.L0.walls.W1.end = [600.05, 0])],
    ['zero thickness', (d: Doc) => (d.levels.L0.walls.W1.thickness = 0)],
    ['door without swing', (d: Doc) => delete d.levels.L0.openings.D1.swing],
    ['window with a swing', (d: Doc) => (d.levels.L0.openings.N1.swing = 'in-left')],
    ['wrong schema_version', (d: Doc) => (d.schema_version = '1.0.0')],
    ['level order that is not a fractional index', (d: Doc) => (d.levels.L0.order = 'a0')],
    ['no levels', (d: Doc) => (d.levels = {})],
    [
      'plot with two corners',
      (d: Doc) =>
        (d.plot.polygon = [
          [0, 0],
          [1, 1],
        ]),
    ],
    ['loft without depth', (d: Doc) => delete d.levels.L0.rooms.R2.loft.depth],
    ['column with zero size', (d: Doc) => (d.levels.L0.columns.C1.size = [0, 23])],
    ['chajja with negative overhang', (d: Doc) => (d.levels.L0.openings.N1.chajja.overhang = -5)],
    ['bad provenance kind', (d: Doc) => (d.setbacks.provenance.front.provenance = 'guessed')],
  ])('rejects %s', (_, mutate) => {
    const doc = clone();
    mutate(doc);
    expect(Plan.safeParse(doc).success).toBe(false);
  });
});
