import { gridPlan, validatePlan, type Plan } from '@plancraft/engine';
import { describe, expect, it } from 'vitest';
import { runChecks } from './useChecks.ts';

// The live checks (P3.2): the plan check, the reference checks, grouped by room, and the Vastu
// score, from what the editor already validated for the drawing.

const facts = (plan: Plan) => {
  const v = validatePlan(plan);
  return { plan, valid: v.plan !== undefined, issues: v.issues, rooms: v.rooms };
};
const grid = gridPlan({ cols: 4, rows: 3, name: 'Grid' });

describe('live checks', () => {
  it('runs the reference checks and groups them by room', () => {
    const checks = runChecks(facts(grid));
    expect(checks.issues.map((i) => `${i.rule_id}:${i.object_ids.join()}`)).toEqual([
      'habitable_room_area_one:R6',
      'firm_entrance_door_width:D1',
    ]);
    expect(checks.groups.map((g) => g.name)).toEqual(['Living 1', 'Master bedroom 6']);
    expect(checks.vastu).toBeNull(); // Vastu is off
    const vastu = runChecks(facts({ ...grid, meta: { ...grid.meta, vastu: true } })).vastu;
    expect(vastu).toMatchObject({ provenance: 'assumed' });
    expect(vastu!.total).toBeGreaterThan(0);
  });

  it('shows only the plan check for a plan that fails it', () => {
    const broken = { ...facts(grid), valid: false, issues: [] };
    expect(runChecks(broken)).toEqual({ issues: [], groups: [], vastu: null });
  });
});
