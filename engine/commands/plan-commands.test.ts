import { describe, expect, it } from 'vitest';
import { firstLevel } from '../schema/collections.ts';
import type { Plan } from '../schema/plan.ts';
import { blankPlan } from '../samples/blank-plan.ts';
import { gridPlan } from '../samples/grid-plan.ts';
import { validatePlan } from '../validate/validate.ts';
import { createHistory, execute, type CommandCall } from './history.ts';
import { PLAN_COMMANDS } from './registry.ts';

// A 6 × 4 m box split by an internal wall V into two rooms; V ends on the middle of S and N
// (T joins), the outer walls meet at corners (L joins). N runs right to left, so its start is
// the corner that moves when E moves.
function run(plan: Plan, ...calls: CommandCall[]): Plan {
  let h = createHistory(plan);
  for (const call of calls) {
    const r = execute(h, { op: 'execute', ...call });
    if (!r.outcome.ok) throw new Error(`${call.id}: ${r.outcome.message}`);
    h = r.history;
  }
  return h.plan;
}
const wall = (id: string, start: [number, number], end: [number, number], type = 'external') => ({
  id: 'ADD_WALL',
  params: { id, start, end, type },
});
const box = run(
  blankPlan({ name: 'Box', plot: [800, 600] }),
  wall('S', [0, 0], [600, 0]),
  wall('E', [600, 0], [600, 400]),
  wall('N', [600, 400], [0, 400]),
  wall('W', [0, 400], [0, 0]),
  wall('V', [300, 0], [300, 400], 'internal'),
  { id: 'ADD_ROOM', params: { id: 'RL', seed: [150, 200], type: 'bedroom' } },
  { id: 'ADD_ROOM', params: { id: 'RR', seed: [450, 200], type: 'kitchen' } },
  { id: 'ADD_OPENING', params: { id: 'DV', kind: 'door', wall: 'V', offset: 150 } },
  { id: 'ADD_OPENING', params: { id: 'WN', kind: 'window', wall: 'N', offset: 100 } },
);
const level = (p: Plan) => firstLevel(p);
function areas(p: Plan) {
  const checked = validatePlan(p);
  expect(checked.issues.filter((i) => i.severity === 'error')).toEqual([]);
  return Object.fromEntries(checked.rooms.map((r) => [r.room_id, r.area_m2]));
}
const move = (ids: string[], to: [number, number]) => ({
  id: 'MOVE',
  params: { ids, from: [0, 0], to },
});

describe('plan commands (P2.4)', () => {
  it('builds a valid plan through commands, with defaults filled in', () => {
    expect(areas(box)).toEqual({ RL: 10.66, RR: 10.66 });
    expect(level(box).walls.V!.thickness).toBe(11.5);
    expect(level(box).walls.S!.thickness).toBe(23);
    expect(level(box).openings.DV).toMatchObject({ width: 90, swing: 'in-left' });
    expect(level(box).openings.WN).toMatchObject({ width: 120, sill: 90 });
    expect(level(box).rooms.RL).toMatchObject({ name: 'Bedroom', behavior: 'fixed' });
  });

  it('moving a wall updates the rooms on both sides; its door stays on it', () => {
    const before = areas(box);
    const moved = run(box, move(['V'], [60, 0]));
    const after = areas(moved);
    expect(after.RL! - before.RL!).toBeCloseTo(0.6 * 3.77, 2);
    expect(after.RR! - before.RR!).toBeCloseTo(-0.6 * 3.77, 2);
    expect(level(moved).walls.V).toMatchObject({ start: [360, 0], end: [360, 400] });
    expect(level(moved).openings.DV).toEqual(level(box).openings.DV);
    // The walls V ends on don't change (T joins: the moved wall's own ends slide along them).
    expect(level(moved).walls.S).toEqual(level(box).walls.S);
  });

  it('a wall joined at its corners drags the walls it meets (L joins)', () => {
    const moved = run(box, move(['E'], [100, 0]));
    expect(level(moved).walls.S!.end).toEqual([700, 0]);
    expect(level(moved).walls.N!.start).toEqual([700, 400]);
    // N's start moved by 1 m, so the window's offset grows by 1 m: it stays where it was.
    expect(level(moved).openings.WN!.offset).toBe(200);
    expect(areas(moved).RR! - areas(box).RR!).toBeCloseTo(3.77, 2);
  });

  it('walls ending on a moved wall stretch to meet it (T joins); their doors stay put', () => {
    const moved = run(box, move(['S'], [0, -50]));
    const l = level(moved);
    expect(l.walls.V!.start).toEqual([300, -50]);
    expect(l.walls.W!.end).toEqual([0, -50]);
    expect(l.walls.E!.start).toEqual([600, -50]);
    expect(l.openings.DV!.offset).toBe(200);
    expect(areas(moved).RL! - areas(box).RL!).toBeCloseTo(0.5 * 2.8275, 2);
  });

  it('a room label in the path of a moving wall stays in its own, smaller room', () => {
    const moved = run(box, move(['V'], [200, 0]));
    const seed = level(moved).rooms.RR!.seed;
    expect(seed[0]).toBeGreaterThan(505.75);
    expect(seed[0]).toBeLessThan(588.5);
    const checked = validatePlan(moved);
    expect(checked.issues).toEqual([]);
    expect(Object.fromEntries(checked.rooms.map((r) => [r.room_id, r.area_m2]))).toEqual({
      RL: 18.2,
      RR: 3.12,
    });
  });

  it('moves openings along their wall, and rooms, columns and stairs by the whole distance', () => {
    let p = run(box, move(['DV'], [30, 30]));
    expect(level(p).openings.DV!.offset).toBe(180); // only the part along V counts
    p = run(
      p,
      { id: 'MOVE', params: { ids: ['RL'], from: [0, 0], to: [-20, 10] } },
      { id: 'MOVE', params: { ids: ['DV'], from: [0, 0], to: [0, 900] } },
    );
    expect(level(p).rooms.RL!.seed).toEqual([130, 210]);
    expect(level(p).openings.DV!.offset).toBe(310); // kept within the wall
  });

  it('crossing walls (X joins) need no stretching', () => {
    const grid = gridPlan({ cols: 3, rows: 2 });
    const moved = run(grid, move(['V1'], [30, 0]));
    const changed = Object.entries(level(moved).walls).filter(
      ([id, w]) => w !== level(grid).walls[id],
    );
    expect(changed.map(([id]) => id)).toEqual(['V1']);
    const a = areas(grid);
    const b = areas(moved);
    expect(b.R1! - a.R1!).toBeCloseTo(-(b.R2! - a.R2!), 2);
  });

  it('deletes a wall with its doors and windows', () => {
    const p = run(box, { id: 'DELETE', params: { ids: ['V'] } });
    expect(level(p).walls.V).toBeUndefined();
    expect(level(p).openings.DV).toBeUndefined();
    expect(level(p).openings.WN).toBeDefined();
  });

  it('refuses what cannot work, with a reason', () => {
    const h = createHistory(box);
    const why = (call: CommandCall) => {
      const r = execute(h, { op: 'execute', ...call });
      return r.outcome.ok ? 'ok' : r.outcome.message;
    };
    expect(why(move(['NOPE'], [1, 0]))).toMatch(/Nothing called NOPE/);
    expect(
      why({
        id: 'ADD_OPENING',
        params: { id: 'D9', kind: 'door', wall: 'V', offset: 350 },
      }),
    ).toMatch(/needs 4.40 m of wall V, which is 4.00 m long/);
    expect(
      why({ id: 'ADD_OPENING', params: { id: 'D9', kind: 'door', wall: 'V', offset: 100 } }),
    ).toMatch(/overlap door DV/);
    expect(why({ id: 'ADD_WALL', params: { id: 'V', start: [0, 0], end: [1, 0] } })).toMatch(
      /already used/,
    );
    expect(why({ id: 'SET', params: { id: 'V', props: { id: 'X' } } })).toMatch(
      /id of V can't be changed/,
    );
    expect(why({ id: 'SET', params: { id: 'V', props: { thickness: -1 } } })).toMatch(
      /wall V: thickness/,
    );
  });

  it('changes properties; null removes an optional one', () => {
    let p = run(box, { id: 'SET', params: { id: 'DV', props: { width: 100, height: 210 } } });
    expect(level(p).openings.DV).toMatchObject({ width: 100, height: 210 });
    p = run(p, { id: 'SET', params: { id: 'DV', props: { height: null } } });
    expect(level(p).openings.DV!.height).toBeUndefined();
    p = run(p, { id: 'SET', params: { id: 'RL', props: { name: 'Guest room' } } });
    expect(level(p).rooms.RL!.name).toBe('Guest room');
  });

  it('is pure and repeatable: same plan and params, same result, input untouched', () => {
    const frozen = structuredClone(box);
    const once = PLAN_COMMANDS.MOVE!.run(box, move(['S', 'RL'], [12.3, -45.6]).params as never);
    const twice = PLAN_COMMANDS.MOVE!.run(box, move(['S', 'RL'], [12.3, -45.6]).params as never);
    expect(once).toEqual(twice);
    expect(box).toEqual(frozen);
  });
});
