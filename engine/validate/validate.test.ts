import { describe, expect, it } from 'vitest';
import sample from '../samples/1.3.0/b-1bhk-t-junctions.plan.json' with { type: 'json' };
import { VALIDATOR_RULES, type ValidatorRuleId } from './issues.ts';
import { loadPlan, validatePlan } from './validate.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixtures are mutated freely
type Doc = any;
const clone = (): Doc => JSON.parse(JSON.stringify(sample));
const lvl = (d: Doc) => d.levels.L0;

// One case per validator rule (PRD P1.1 acceptance: tests cover each rule).
const cases: [ValidatorRuleId, (d: Doc) => unknown, string[]][] = [
  ['schema.unreadable', (d) => (d.schema_version = '9.0.0'), []],
  ['schema.invalid', (d) => (lvl(d).walls.W1.thickness = -1), []],
  ['schema.id_key_mismatch', (d) => (lvl(d).walls.W1.id = 'W100'), ['W100']],
  [
    'geometry.separator_zero_length',
    (d) => (lvl(d).separators.SP9 = { id: 'SP9', start: [100, 100], end: [100, 100] }),
    ['SP9'],
  ],
  [
    'geometry.duplicate_id',
    (d) => (lvl(d).columns.W1 = { ...lvl(d).columns.C1, id: 'W1' }),
    ['W1'],
  ],
  [
    'geometry.wall_zero_length',
    (d) =>
      (lvl(d).walls.W9 = {
        id: 'W9',
        start: [50, 50],
        end: [50, 50],
        thickness: 10,
        type: 'internal',
      }),
    ['W9'],
  ],
  [
    'geometry.polygon_too_few_points',
    (d) =>
      (d.plot.polygon = [
        [0, 0],
        [100, 0],
        [100, 0],
        [0, 0],
      ]),
    ['plot'],
  ],
  [
    'geometry.polygon_zero_area',
    (d) =>
      (d.plot.polygon = [
        [0, 0],
        [100, 0],
        [200, 0],
      ]),
    ['plot'],
  ],
  [
    'geometry.polygon_self_intersecting',
    (d) =>
      (lvl(d).stairs.S1.polygon = [
        [620, 20],
        [700, 300],
        [700, 20],
        [620, 300],
      ]),
    ['S1'],
  ],
  ['geometry.host_wall_missing', (d) => (lvl(d).openings.D1.wall = 'W99'), ['D1']],
  ['geometry.opening_outside_wall', (d) => (lvl(d).openings.D1.offset = 350), ['D1', 'W5']],
  [
    'geometry.openings_overlap',
    (d) =>
      (lvl(d).openings.N2 = {
        id: 'N2',
        kind: 'window',
        wall: 'W4',
        offset: 200,
        width: 100,
        sill: 90,
      }),
    ['N1', 'N2'],
  ],
  ['geometry.loft_wall_not_in_room', (d) => (lvl(d).rooms.R2.loft.wall = 'W4'), ['R2', 'W4']],
  ['geometry.room_seed_not_enclosed', (d) => (lvl(d).rooms.R1.seed = [-50, 200]), ['R1']],
  ['geometry.room_seed_in_wall', (d) => (lvl(d).rooms.R1.seed = [5, 200]), ['R1']],
  ['geometry.room_too_small_for_walls', (d) => (lvl(d).walls.W6.thickness = 300), ['R3']],
  ['geometry.rooms_share_area', (d) => (lvl(d).rooms.R3.seed = [100, 100]), ['R1', 'R3']],
];

describe('validatePlan', () => {
  it('passes a valid plan and returns its rooms', () => {
    const result = validatePlan(sample);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.rooms.map((r) => r.area_m2)).toEqual([10.66, 6.58, 3.75]);
  });

  it('has a test case for every rule', () => {
    expect(cases.map(([id]) => id).sort()).toEqual(Object.keys(VALIDATOR_RULES).sort());
  });

  it.each(cases)('reports %s', (ruleId, mutate, objectIds) => {
    const doc = clone();
    mutate(doc);
    const result = validatePlan(doc);
    const hits = result.issues.filter((i) => i.rule_id === ruleId);
    expect(hits.length, JSON.stringify(result.issues, null, 2)).toBeGreaterThan(0);
    expect(result.ok).toBe(VALIDATOR_RULES[ruleId] !== 'error');
    if (objectIds.length) expect(hits[0]!.object_ids).toEqual(objectIds);
    for (const issue of hits) {
      expect(issue.message).toMatch(/^[A-Z"]/);
      expect(issue.how_to_fix).toMatch(/\.$/);
    }
  });

  it('reports a loft on a missing wall', () => {
    const doc = clone();
    lvl(doc).rooms.R2.loft.wall = 'W99';
    const hits = validatePlan(doc).issues.filter((i) => i.rule_id === 'geometry.host_wall_missing');
    expect(hits.map((i) => i.object_ids)).toEqual([['R2']]);
  });

  it('marks a plan with only warnings as ok', () => {
    const doc = clone();
    lvl(doc).rooms.R3.seed = [100, 100];
    const result = validatePlan(doc);
    expect(result.issues.every((i) => i.severity === 'warning')).toBe(true);
    expect(result.ok).toBe(true);
  });

  it('loadPlan reports the source version only when a migration ran', () => {
    const loaded = loadPlan(sample);
    expect(loaded.ok && 'migrated_from' in loaded).toBe(false);
  });
});
