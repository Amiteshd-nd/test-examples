import { describe, expect, it } from 'vitest';
import { firstLevel } from '../schema/collections.ts';
import type { Plan } from '../schema/plan.ts';
import { blankPlan } from '../samples/blank-plan.ts';
import { planDrawing } from '../view/drawing.ts';
import { validatePlan } from '../validate/validate.ts';
import { createHistory, execute, type CommandCall } from './history.ts';

// The P2.5 toolset's commands on a 6 × 4 m box split by wall V (as in plan-commands.test.ts).
function run(plan: Plan, ...calls: CommandCall[]): Plan {
  let h = createHistory(plan);
  for (const call of calls) {
    const r = execute(h, { op: 'execute', ...call });
    if (!r.outcome.ok) throw new Error(`${call.id}: ${r.outcome.message}`);
    h = r.history;
  }
  return h.plan;
}
function why(plan: Plan, call: CommandCall) {
  const r = execute(createHistory(plan), { op: 'execute', ...call });
  return r.outcome.ok ? 'ok' : r.outcome.message;
}
const wall = (id: string, start: [number, number], end: [number, number], type = 'external') => ({
  id: 'ADD_WALL',
  params: { id, start, end, type },
});
const box = run(
  blankPlan({ name: 'Box', plot: [1200, 800] }),
  wall('S', [0, 0], [600, 0]),
  wall('E', [600, 0], [600, 400]),
  wall('N', [600, 400], [0, 400]),
  wall('W', [0, 400], [0, 0]),
  wall('V', [300, 0], [300, 400], 'internal'),
  { id: 'ADD_ROOM', params: { id: 'RL', seed: [150, 200], type: 'bedroom' } },
  { id: 'ADD_ROOM', params: { id: 'RR', seed: [450, 200], type: 'kitchen' } },
  { id: 'ADD_OPENING', params: { id: 'DV', kind: 'door', wall: 'V', offset: 150 } },
);
const L = (p: Plan) => firstLevel(p);
const areas = (p: Plan) =>
  Object.fromEntries(validatePlan(p).rooms.map((r) => [r.room_id, r.area_m2]));

describe('toolset commands (P2.5)', () => {
  it('draws lines, rectangles, separators, stairs, dimensions, notes and hatches', () => {
    const p = run(
      box,
      {
        id: 'ADD_LINE',
        params: {
          id: 'A1',
          points: [
            [700, 0],
            [800, 0],
            [800, 100],
          ],
        },
      },
      { id: 'RECTANGLE', params: { id: 'A2', corner: [900, 300], opposite: [700, 200] } },
      { id: 'ADD_SEPARATOR', params: { id: 'SP', start: [0, 250], end: [300, 250] } },
      { id: 'ADD_STAIR', params: { id: 'ST', corner: [700, 500], opposite: [1000, 600] } },
      { id: 'ADD_DIMENSION', params: { id: 'DM', start: [0, 0], end: [600, 0], offset: -80 } },
      { id: 'ADD_TEXT', params: { id: 'TX', at: [300, 500], text: 'Courtyard' } },
      {
        id: 'ADD_HATCH',
        params: {
          id: 'HT',
          polygon: [
            [0, 0],
            [100, 0],
            [100, 100],
          ],
        },
      },
    );
    const l = L(p);
    expect(l.lines.A2).toEqual({
      id: 'A2',
      points: [
        [700, 200],
        [900, 200],
        [900, 300],
        [700, 300],
      ],
      closed: true,
    });
    expect(l.stairs.ST).toMatchObject({ direction: 'up' });
    expect(l.texts.TX).toMatchObject({ size: 25, rotation_deg: 0 });
    expect(l.hatches.HT!.pattern).toBe('diagonal');
    // The separator splits the bedroom; the room keeps the part with its label.
    expect(areas(p).RL).toBeCloseTo((282.75 * 238.5) / 10000, 2);
    const d = planDrawing(p, validatePlan(p).rooms);
    expect(d.dimensions[0]).toMatchObject({
      length: 600,
      line: [
        [0, -80],
        [600, -80],
      ],
      angle: 0,
    });
    expect(d.texts[0]!.box).toHaveLength(4);
    expect(d.lines.map((x) => x.id)).toEqual(['A1', 'A2']);
  });

  it('draws a room as a box of walls, without doubling a wall that is already there', () => {
    const p = run(box, {
      id: 'ROOM',
      params: { id: 'RB', corner: [600, 0], opposite: [900, 400], type: 'study' },
    });
    // Its left side lies on wall E, so only three walls are new.
    expect(Object.keys(L(p).walls).filter((k) => k.startsWith('RB.'))).toEqual([
      'RB.w1',
      'RB.w2',
      'RB.w3',
    ]);
    expect(L(p).rooms.RB).toMatchObject({ name: 'Study', seed: [750, 200] });
    expect(validatePlan(p).issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(areas(p).RB).toBeCloseTo((282.75 * 388.5) / 10000, 1);
  });

  it('copies walls with their doors, under new ids', () => {
    const p = run(box, {
      id: 'COPY',
      params: { ids: ['V'], from: [0, 0], to: [100, 0], id: 'K' },
    });
    expect(L(p).walls['K.1']).toMatchObject({ start: [400, 0], end: [400, 400] });
    expect(L(p).openings['K.2']).toMatchObject({ wall: 'K.1', offset: 150, kind: 'door' });
    expect(L(p).walls.V).toEqual(L(box).walls.V);
  });

  it('rotates about a point and mirrors across a line (doors swing the other way)', () => {
    const rotated = run(box, {
      id: 'ROTATE',
      params: { ids: ['V'], center: [300, 200], angle: 90 },
    });
    expect(L(rotated).walls.V).toMatchObject({ start: [500, 200], end: [100, 200] });
    const mirrored = run(box, {
      id: 'MIRROR',
      params: { ids: ['V'], a: [600, 0], b: [600, 400], id: 'MI' },
    });
    expect(L(mirrored).walls['MI.1']).toMatchObject({ start: [900, 0], end: [900, 400] });
    expect(L(mirrored).openings['MI.2']).toMatchObject({ swing: 'out-left', wall: 'MI.1' });
    const flipped = run(box, {
      id: 'MIRROR',
      params: { ids: ['V', 'RL'], a: [300, 0], b: [300, 400], keep: false, id: 'X' },
    });
    expect(L(flipped).rooms.RL!.seed).toEqual([450, 200]);
    expect(L(flipped).openings.DV).toMatchObject({ swing: 'out-left' });
  });

  it('offsets walls and polylines', () => {
    let p = run(box, { id: 'OFFSET', params: { source: 'V', distance: -50, id: 'V2' } });
    expect(L(p).walls.V2).toMatchObject({ start: [350, 0], end: [350, 400], thickness: 11.5 });
    p = run(
      p,
      {
        id: 'ADD_LINE',
        params: {
          id: 'PL',
          points: [
            [0, 500],
            [100, 500],
            [100, 600],
          ],
        },
      },
      { id: 'OFFSET', params: { source: 'PL', distance: 10, id: 'PL2' } },
    );
    expect(L(p).lines.PL2!.points).toEqual([
      [0, 510],
      [90, 510],
      [90, 600],
    ]);
  });

  it('trims a wall between the walls that cross it, and extends one to the next wall', () => {
    // A wall right across the box: trimming its middle part splits it in two.
    let p = run(box, wall('X', [-100, 200], [700, 200], 'internal'));
    p = run(p, { id: 'TRIM', params: { target: 'X', at: [150, 200], id: 'X2' } });
    expect(L(p).walls.X).toMatchObject({ start: [-100, 200], end: [0, 200] });
    expect(L(p).walls.X2).toMatchObject({ start: [300, 200], end: [700, 200] });
    // Trimming the end piece shortens it to the wall it crosses.
    p = run(p, { id: 'TRIM', params: { target: 'X2', at: [650, 200], id: 'X3' } });
    expect(L(p).walls.X2).toMatchObject({ start: [300, 200], end: [600, 200] });
    // A stub that stops short of the wall ahead is extended to meet it.
    p = run(p, wall('Y', [100, 300], [200, 300], 'internal'), {
      id: 'EXTEND',
      params: { target: 'Y', end: 'end' },
    });
    expect(L(p).walls.Y!.end).toEqual([300, 300]);
    // The door on V survives a trim of the part without it, and moves to the far piece.
    p = run(box, wall('X', [0, 100], [600, 100], 'internal'), {
      id: 'TRIM',
      params: { target: 'V', at: [300, 50], id: 'V9' },
    });
    expect(L(p).walls.V).toMatchObject({ start: [300, 100], end: [300, 400] });
    expect(L(p).openings.DV).toMatchObject({ wall: 'V', offset: 50 });
  });

  it('sets a wall’s length; walls joined at the moved end follow, and so do dimensions', () => {
    const p = run(
      box,
      { id: 'ADD_DIMENSION', params: { id: 'DS', start: [0, 0], end: [600, 0] } },
      { id: 'SET_LENGTH', params: { target: 'DS', length: 700 } },
    );
    // The wall across S's end (E) moves over, and N stretches with it: the room is 1 m wider.
    expect(L(p).walls.S!.end).toEqual([700, 0]);
    expect(L(p).walls.E).toMatchObject({ start: [700, 0], end: [700, 400] });
    expect(L(p).walls.N!.start).toEqual([700, 400]);
    expect(L(p).dimensions.DS!.end).toEqual([700, 0]);
    expect(areas(p).RR! - areas(box).RR!).toBeCloseTo(3.77, 2);
    const q = run(box, { id: 'SET_LENGTH', params: { target: 'V', length: 300, keep: 'end' } });
    expect(L(q).walls.V!.start).toEqual([300, 100]);
    expect(L(q).openings.DV!.offset).toBe(50); // the door stays where it was
  });

  it('refuses with a reason', () => {
    expect(why(box, { id: 'TRIM', params: { target: 'W', at: [0, 200], id: 'Z' } })).toMatch(
      /Nothing crosses W to cut against/,
    );
    expect(why(box, { id: 'TRIM', params: { target: 'RL', at: [0, 0], id: 'Z' } })).toMatch(
      /isn't a wall, a separator or a straight line/,
    );
    expect(why(box, { id: 'EXTEND', params: { target: 'S', end: 'end' } })).toMatch(
      /Nothing lies ahead/,
    );
    expect(why(box, { id: 'OFFSET', params: { source: 'V', distance: 0, id: 'Z' } })).toMatch(
      /other than 0/,
    );
    expect(
      why(box, { id: 'RECTANGLE', params: { id: 'Z', corner: [0, 0], opposite: [0, 50] } }),
    ).toMatch(/at least 1 cm apart both ways/);
    expect(
      why(box, { id: 'COPY', params: { ids: ['V'], from: [0, 0], to: [1, 0], id: 'V' } }),
    ).toBe('ok');
  });
});

describe('plan and level settings (P3.2)', () => {
  it('turn Vastu on and off, and set a level’s height', () => {
    expect(box.meta.vastu).toBe(false);
    const on = run(box, { id: 'SET_PLAN', params: { vastu: true } });
    expect(on.meta.vastu).toBe(true);
    expect(run(on, { id: 'SET_PLAN', params: { vastu: false } }).meta.vastu).toBe(false);
    const tall = run(box, { id: 'SET_LEVEL', params: { height: 312.3 } });
    expect(L(tall).height).toBe(312.3);
    expect(why(box, { id: 'SET_LEVEL', params: { height: 312.34 } })).toMatch(/rounded to 0\.1 cm/);
    expect(why(box, { id: 'SET_LEVEL', params: { height: 300, level: 'L9' } })).toBe(
      'There is no level L9 in this plan.',
    );
    expect(why(box, { id: 'SET_LEVEL', params: { height: 0 } })).not.toBe('ok');
  });
});
