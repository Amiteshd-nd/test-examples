import { describe, expect, it } from 'vitest';
import { createHistory, execute, type CommandCall } from '../commands/history.ts';
import { firstLevel } from '../schema/collections.ts';
import type { Plan } from '../schema/plan.ts';
import type { Issue } from '../schema/rule.ts';
import { blankPlan } from '../samples/blank-plan.ts';
import { objectBounds } from '../view/bounds.ts';
import { deriveRooms } from '../rooms/derive.ts';
import { checkPlan } from './check.ts';
import { groupIssues, roomOfObject } from './groups.ts';

// The live check panel (P3.2): issues grouped by the room they are about, and the area to zoom to.

function draw(plan: Plan, ...calls: CommandCall[]): Plan {
  let h = createHistory(plan);
  for (const call of calls) {
    const r = execute(h, { op: 'execute', ...call });
    if (!r.outcome.ok) throw new Error(`${call.id}: ${r.outcome.message}`);
    h = r.history;
  }
  return h.plan;
}
const box = (id: string, corner: [number, number], opposite: [number, number], type: string) => ({
  id: 'ROOM',
  params: { id, corner, opposite, type, wall_type: 'internal' },
});
const plan = draw(
  blankPlan({ name: 'Groups', plot: [1200, 1200] }),
  box('KIT', [0, 0], [400, 300], 'kitchen'),
  box('BED', [0, 500], [400, 720], 'bedroom'),
  box('BD2', [600, 500], [1000, 720], 'bedroom'),
  { id: 'ADD_OPENING', params: { id: 'D1', kind: 'door', wall: 'BED.w1', offset: 100, width: 70 } },
  {
    id: 'ADD_STAIR',
    params: { id: 'ST', corner: [650, 550], opposite: [750, 650], direction: 'up' },
  },
);
const L = firstLevel(plan);
const said = (object_ids: string[], severity: Issue['severity'] = 'warning'): Issue => ({
  rule_id: 'test',
  severity,
  category: 'bylaw',
  message: `About ${object_ids.join(', ') || 'the plot'}.`,
  object_ids,
  how_to_fix: 'Fix it.',
  source: 'test',
});

describe('issues by room (P3.2)', () => {
  it('finds the room of a room, a door, a wall and a stair; none for the level or the plot', () => {
    expect(roomOfObject(plan, 'BED')).toBe('BED');
    expect(roomOfObject(plan, 'D1')).toBe('BED');
    expect(roomOfObject(plan, 'KIT.w2')).toBe('KIT');
    expect(roomOfObject(plan, 'ST')).toBe('BD2');
    expect(roomOfObject(plan, L.id)).toBeNull();
    expect(roomOfObject(plan, 'nothing')).toBeNull();
  });

  it('puts the whole plan first, then rooms in plan order, most serious first in each', () => {
    const groups = groupIssues(plan, [
      said(['BD2']),
      said(['D1']),
      said([]),
      said(['BED'], 'error'),
      said([L.id], 'info'),
      said(['ST', 'BED']),
    ]);
    expect(
      groups.map((g) => [g.name, g.severity, g.issues.map((i) => i.message).join(' | ')]),
    ).toEqual([
      ['Whole plan', 'warning', 'About the plot. | About L0.'],
      ['Bedroom (BED)', 'error', 'About BED. | About D1.'],
      ['Bedroom (BD2)', 'warning', 'About BD2. | About ST, BED.'],
    ]);
    expect(groupIssues(plan, [])).toEqual([]);
  });

  it('groups the real reference checks', () => {
    const low = { ...plan, levels: { [L.id]: { ...L, height: 270 } } };
    const groups = groupIssues(low, checkPlan(low));
    // The kitchen is big enough; both bedrooms are too narrow.
    expect(groups.map((g) => g.room_id)).toEqual([null, 'BED', 'BD2']);
    expect(groups[0]!.issues.map((i) => i.rule_id)).toEqual(['habitable_ceiling_height']);
    expect(groups[1]!.issues.map((i) => i.rule_id)).toEqual([
      'habitable_room_area_one',
      'habitable_room_width',
      'firm_internal_door_width',
    ]);
  });

  it('gives the box to zoom to for rooms, doors, walls and stairs', () => {
    const rooms = deriveRooms(L).rooms;
    // Room outlines are on the 0.1 cm grid.
    expect(objectBounds(L, rooms, ['BED'])).toEqual({
      minX: 5.8,
      minY: 505.8,
      maxX: 394.3,
      maxY: 714.3,
    });
    // The door's stretch of its wall (BED.w1 runs along y = 500).
    expect(objectBounds(L, rooms, ['D1'])).toEqual({
      minX: 100,
      minY: 494.25,
      maxX: 170,
      maxY: 505.75,
    });
    expect(objectBounds(L, rooms, ['ST', 'KIT'])).toMatchObject({ minX: 5.8, maxX: 750 });
    expect(objectBounds(L, rooms, [L.id])).toBeNull();
  });
});
