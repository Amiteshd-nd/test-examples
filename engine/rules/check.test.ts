import { describe, expect, it } from 'vitest';
import { createHistory, execute, type CommandCall } from '../commands/history.ts';
import { firstLevel } from '../schema/collections.ts';
import type { Plan } from '../schema/plan.ts';
import { Issue, RulePack } from '../schema/rule.ts';
import { blankPlan } from '../samples/blank-plan.ts';
import { checkPlan, roomWidth, vastuScore } from './check.ts';
import { BUILT_IN_PACKS, loadRulePack, packsFor } from './packs.ts';

// Reference checks (P3.1) on small plans drawn with the P2.5 commands. Room boxes use 11.5 cm
// internal walls, so a 300 × 280 box has a clear floor of 288.5 × 268.5 cm.

function draw(plan: Plan, ...calls: CommandCall[]): Plan {
  let h = createHistory(plan);
  for (const call of calls) {
    const r = execute(h, { op: 'execute', ...call });
    if (!r.outcome.ok) throw new Error(`${call.id}: ${r.outcome.message}`);
    h = r.history;
  }
  return h.plan;
}
const box = (
  id: string,
  corner: [number, number],
  opposite: [number, number],
  type: string,
  wall_type = 'internal',
) => ({
  id: 'ROOM',
  params: { id, corner, opposite, type, wall_type },
});
const site = (over: Partial<Plan['meta']> = {}) => {
  const p = blankPlan({ name: 'Checks', plot: [1200, 1200] });
  return { ...p, meta: { ...p.meta, ...over } };
};
const ids = (issues: Issue[]) => issues.map((i) => `${i.rule_id}:${i.object_ids.join(',')}`);
const nbc = [BUILT_IN_PACKS['nbc-default']!];

describe('rule packs (P3.1)', () => {
  it('ship NBC, Bengaluru, firm and Vastu packs; all confirmed except the empty Bengaluru tables', () => {
    expect(Object.keys(BUILT_IN_PACKS).sort()).toEqual([
      'city-bengaluru',
      'firm-default',
      'nbc-default',
      'vastu-default',
    ]);
    const all = Object.values(BUILT_IN_PACKS).flatMap((p) => p.rules);
    expect(all.every((r) => r.editable)).toBe(true);
    // The founder's review (2026-11-06 / 07): NBC, Vastu and firm confirmed; BBMP values still to come.
    expect(all.filter((r) => !r.verified).map((r) => r.id)).toEqual(
      BUILT_IN_PACKS['city-bengaluru']!.rules.map((r) => r.id),
    );
    expect(
      BUILT_IN_PACKS['vastu-default']!.rules.find((r) => r.id === 'vastu_toilets')!.zones,
    ).toEqual(['north_east', 'centre']);
    expect(
      BUILT_IN_PACKS['nbc-default']!.rules.every((r) =>
        r.source.startsWith('NBC 2016 Part 3 (confirmed'),
      ),
    ).toBe(true);
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length);
    const nbcValues = Object.fromEntries(
      BUILT_IN_PACKS['nbc-default']!.rules.map((r) => [r.id, r.value]),
    );
    expect(nbcValues).toMatchObject({
      habitable_room_area_one: 9.5,
      habitable_room_area: 7.5,
      habitable_room_width: 240,
      kitchen_area: 5,
      kitchen_width: 180,
      bath_area: 1.8,
      bath_width: 120,
      wc_area: 1.1,
      wc_width: 90,
      habitable_ceiling_height: 275,
    });
    // The city tables wait for the architect's BBMP values.
    expect(BUILT_IN_PACKS['city-bengaluru']!.rules.every((r) => r.table?.rows.length === 0)).toBe(
      true,
    );
  });

  it('use the plan’s own list, else the defaults; Vastu only when the plan asks for it', () => {
    expect(packsFor(site()).map((p) => p.id)).toEqual([
      'nbc-default',
      'city-bengaluru',
      'firm-default',
    ]);
    expect(packsFor(site({ vastu: true })).map((p) => p.id)).toContain('vastu-default');
    expect(packsFor(site({ city: 'pune' })).map((p) => p.id)).toEqual([
      'nbc-default',
      'firm-default',
    ]);
    expect(
      packsFor({ ...site(), rule_pack_ids: ['nbc-default', 'nope'] }).map((p) => p.id),
    ).toEqual(['nbc-default']);
  });

  it('refuse a broken pack with reasons', () => {
    const r = loadRulePack({
      ...BUILT_IN_PACKS['nbc-default'],
      rules: [{ id: 'x', check: 'min_area' }],
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.issues[0]!.message).toMatch(/rule pack's value at rules\.0/);
    expect(
      RulePack.safeParse({
        ...BUILT_IN_PACKS['firm-default'],
        rules: [{ ...BUILT_IN_PACKS['firm-default']!.rules[0]!, scope: {} }],
      }).success,
    ).toBe(false); // a door check needs scope.door
  });
});

describe('reference checks (P3.1)', () => {
  it('flag rooms under the NBC areas and widths, saying which wall to move and how far', () => {
    const p = draw(
      site(),
      box('BED', [0, 0], [300, 280], 'bedroom'),
      box('KIT', [500, 0], [700, 200], 'kitchen'),
      box('TLT', [900, 0], [1050, 200], 'toilet'),
      box('NAR', [0, 500], [400, 720], 'bedroom'),
    );
    const issues = checkPlan(p, { packs: nbc });
    expect(ids(issues)).toEqual([
      'habitable_room_area_one:NAR',
      'habitable_room_width:NAR',
      'kitchen_area:KIT',
      'toilet_area:TLT',
    ]);
    const one = issues[0]!;
    expect(one).toMatchObject({ severity: 'error', category: 'bylaw', verified: true });
    expect(one.message).toBe(
      'No habitable room reaches 9.50 m²; the largest, Bedroom, is 8.10 m².',
    );
    expect(one.how_to_fix).toMatch(
      /^Enlarge Bedroom by 1\.40 m², e\.g\. move wall NAR\.w\d \d+ cm (north|south|east|west)\.$/,
    );
    const narrow = issues[1]!;
    expect(narrow.message).toBe('Bedroom is 2.08 m wide; the reference minimum is 2.40 m.');
    expect(narrow.how_to_fix).toMatch(
      /^Widen Bedroom by 32 cm, e\.g\. move wall NAR\.w[13] 32 cm (north|south)\.$/,
    );
    for (const i of issues) {
      expect(Issue.safeParse(i).success).toBe(true);
      expect(`${i.message} ${i.how_to_fix}`).not.toMatch(/complian/i);
    }
  });

  it('pass rooms that meet the minimums, and check the level height', () => {
    let p = draw(
      site(),
      box('BED', [0, 0], [400, 350], 'bedroom'),
      box('KIT', [500, 0], [800, 250], 'kitchen'),
    );
    expect(checkPlan(p, { packs: nbc })).toEqual([]);
    const L = firstLevel(p);
    p = { ...p, levels: { [L.id]: { ...L, height: 270 } } };
    expect(checkPlan(p, { packs: nbc }).map((i) => i.message)).toEqual([
      'Ground is 2.70 m high; rooms such as Bedroom need at least 2.75 m.',
    ]);
  });

  it('check Vastu zones and the main entrance when the plan asks for Vastu', () => {
    const p = draw(
      site({ vastu: true }),
      box('KIT', [0, 900], [300, 1200], 'kitchen'), // north-west corner
      box('MBR', [0, 0], [400, 350], 'master_bedroom'), // south-west: fine
      box('TLT', [1000, 1000], [1200, 1200], 'toilet'), // north-east: avoided
      box('LIV', [500, 0], [900, 400], 'living', 'external'),
      {
        id: 'ADD_OPENING',
        params: { id: 'DE', kind: 'door', wall: 'LIV.w1', offset: 150, width: 100 },
      },
    );
    const vastu = checkPlan(p, { packs: [BUILT_IN_PACKS['vastu-default']!] });
    expect(ids(vastu)).toEqual(['vastu_kitchen:KIT', 'vastu_entrance:DE', 'vastu_toilets:TLT']);
    expect(vastu[0]!.message).toBe(
      'Kitchen is in the north-west of the plot; Vastu prefers the south-east.',
    );
    expect(vastu[1]!.message).toBe(
      'The main entrance (door DE) faces south; Vastu prefers north or east.',
    );
    expect(vastu.every((i) => i.severity === 'warning' && i.category === 'vastu')).toBe(true);
    // Not asked for: no Vastu issues by default.
    expect(
      checkPlan({ ...p, meta: { ...p.meta, vastu: false } }).some((i) => i.category === 'vastu'),
    ).toBe(false);
  });

  it('check the firm’s door widths', () => {
    const p = draw(
      site(),
      box('LIV', [0, 0], [400, 400], 'living', 'external'),
      box('BED', [400, 0], [800, 400], 'bedroom'),
      {
        id: 'ADD_OPENING',
        params: { id: 'DE', kind: 'door', wall: 'LIV.w1', offset: 100, width: 90 },
      },
      {
        id: 'ADD_OPENING',
        // BED's walls are internal; LIV's (the shell) external.
        params: { id: 'DI', kind: 'door', wall: 'BED.w3', offset: 100, width: 70 },
      },
    );
    const firm = checkPlan(p, { packs: [BUILT_IN_PACKS['firm-default']!] });
    expect(firm.map((i) => i.message)).toEqual([
      'The main door DE is 0.90 m wide; the reference is at least 1.00 m.',
      'Door DI is 0.70 m wide; the reference is at least 0.75 m.',
    ]);
  });

  it('check setbacks, coverage and FAR once a city pack has values', () => {
    const p = draw(site(), box('B', [50, 100], [1100, 1150], 'living', 'external'));
    // The shipped Bengaluru pack has no values yet, so it finds nothing.
    expect(checkPlan(p, { packs: [BUILT_IN_PACKS['city-bengaluru']!] })).toEqual([]);
    const city = BUILT_IN_PACKS['city-bengaluru']!;
    const filled: RulePack = {
      ...city,
      rules: city.rules.map((r) =>
        r.check === 'min_setback'
          ? {
              ...r,
              table: {
                by: 'plot_depth_m',
                rows: [
                  { upto: 9, value: 75 },
                  { upto: null, value: 100 },
                ],
              },
            }
          : r.check === 'max_coverage'
            ? { ...r, table: { by: 'plot_area_m2', rows: [{ upto: null, value: 60 }] } }
            : { ...r, value: 0.5, table: undefined },
      ),
    };
    const issues = checkPlan(p, { packs: [filled] });
    // North-facing plot: the front is the north edge (38.5 cm away), the left the east edge.
    expect(issues.map((i) => i.rule_id)).toEqual([
      'blr_setback_front',
      'blr_setback_rear',
      'blr_setback_left',
      'blr_setback_right',
      'blr_coverage',
      'blr_far',
    ]);
    expect(issues[0]!.message).toBe(
      'The building is 0.39 m from the front (north) edge of the plot; the reference setback there is 1.00 m.',
    );
    expect(issues[4]!.message).toBe(
      'The ground floor covers 80.0% of the plot; the reference maximum is 60%.',
    );
    expect(issues[5]!.message).toBe(
      'The FAR (built-up area of all floors ÷ plot area) is 0.80; the reference maximum is 0.5.',
    );
  });

  it('look FAR up by road width, and say so when the plan doesn’t record it', () => {
    const p = draw(site(), box('B', [50, 100], [1100, 1150], 'living', 'external'));
    const city = BUILT_IN_PACKS['city-bengaluru']!;
    const far: RulePack = {
      ...city,
      rules: city.rules
        .filter((r) => r.check === 'max_far')
        .map((r) => ({
          ...r,
          table: {
            by: 'road_width_m',
            rows: [
              { upto: 9, value: 0.5 },
              { upto: null, value: 2 },
            ],
          },
        })),
    };
    expect(far.rules[0]!.table!.by).toBe('road_width_m'); // as shipped
    const unknown = checkPlan(p, { packs: [far] });
    expect(unknown).toMatchObject([{ rule_id: 'blr_far', severity: 'info' }]);
    expect(unknown[0]!.message).toMatch(/depends on the width of the road/);
    const narrowRoad = draw(p, { id: 'SET_PLOT', params: { road_width: 600 } });
    expect(firstLevel(narrowRoad)).toBeDefined();
    expect(narrowRoad.plot.road_width_cm).toBe(600);
    expect(checkPlan(narrowRoad, { packs: [far] }).map((i) => i.message)).toEqual([
      'The FAR (built-up area of all floors ÷ plot area) is 0.80; the reference maximum is 0.5.',
    ]);
    const wideRoad = draw(p, { id: 'SET_PLOT', params: { road_width: 1200 } });
    expect(checkPlan(wideRoad, { packs: [far] })).toEqual([]);
    expect(
      draw(wideRoad, { id: 'SET_PLOT', params: { road_width: null } }).plot,
    ).not.toHaveProperty('road_width_cm');
  });

  it('measures a room’s width across its shortest side, however it is turned', () => {
    const r = (deg: number) => {
      const a = (deg * Math.PI) / 180;
      const [c, s] = [Math.cos(a), Math.sin(a)];
      return (
        [
          [0, 0],
          [400, 0],
          [400, 250],
          [0, 250],
        ] as [number, number][]
      ).map(([x, y]): [number, number] => [x * c - y * s, x * s + y * c]);
    };
    for (const deg of [0, 30, 45, 90]) {
      const w = roomWidth(r(deg));
      expect(w.width).toBeCloseTo(250, 6);
      expect(w.length).toBeCloseTo(400, 6);
    }
  });
});

describe('quick fixes and the Vastu score (P3.2)', () => {
  const run = (p: Plan, steps: CommandCall[]) => {
    const r = execute(createHistory(p), { op: 'batch', steps });
    if (!r.outcome.ok) throw new Error(r.outcome.message);
    return r.history;
  };

  it('move a whole-side wall far enough to clear a narrow or small room, in one undo step', () => {
    const p = draw(site(), box('NAR', [0, 500], [400, 720], 'bedroom'));
    const [one, narrow] = checkPlan(p, { packs: nbc });
    expect(narrow!.rule_id).toBe('habitable_room_width');
    expect(narrow!.fix!.label).toMatch(/^Move wall NAR\.w[13] 32 cm (north|south)$/);
    // The button does what the sentence says.
    const label = narrow!.fix!.label;
    expect(narrow!.how_to_fix).toBe(`Widen Bedroom by 32 cm, e.g. m${label.slice(1)}.`);
    const widened = run(p, narrow!.fix!.steps);
    expect(Object.values(widened.undo).flat()).toHaveLength(1);
    expect(ids(checkPlan(widened.plan, { packs: nbc }))).toEqual(['habitable_room_area_one:NAR']);
    // Enlarging to 9.5 m² also makes it wide enough.
    expect(one!.fix!.label).toMatch(/^Move wall NAR\.w[13] 37 cm (north|south)$/);
    expect(checkPlan(run(p, one!.fix!.steps).plan, { packs: nbc })).toEqual([]);
  });

  it('suggest a wall that runs the whole side, and offer no fix when the result is uncertain', () => {
    const walls = (pts: [number, number][]) =>
      pts.map((start, i) => ({
        id: 'ADD_WALL',
        params: { id: `K${i}`, start, end: pts[(i + 1) % pts.length]! },
      }));
    // A narrow room whose south side is two walls: the north wall is the one to move.
    const split = draw(
      site(),
      ...walls([
        [0, 0],
        [200, 0],
        [400, 0],
        [400, 220],
        [0, 220],
      ]),
      { id: 'ADD_ROOM', params: { id: 'R', seed: [100, 100], type: 'bedroom' } },
    );
    const narrow = checkPlan(split, { packs: nbc }).find(
      (i) => i.rule_id === 'habitable_room_width',
    )!;
    expect(narrow.fix!.label).toBe('Move wall K3 32 cm north');
    // An L-shaped room: moving one wall wouldn't certainly reach the minimum.
    const ell = draw(
      site(),
      ...walls([
        [0, 0],
        [300, 0],
        [300, 150],
        [150, 150],
        [150, 300],
        [0, 300],
      ]),
      { id: 'ADD_ROOM', params: { id: 'R', seed: [60, 60], type: 'bedroom' } },
    );
    const small = checkPlan(ell, { packs: nbc });
    expect(small.length).toBeGreaterThan(0);
    expect(small.every((i) => i.fix === undefined && i.how_to_fix.length > 0)).toBe(true);
  });

  it('widen doors about their middle, unless they would run into another opening', () => {
    const p = draw(
      site(),
      box('LIV', [0, 0], [400, 400], 'living', 'external'),
      box('BED', [400, 0], [800, 400], 'bedroom'),
      {
        id: 'ADD_OPENING',
        params: { id: 'DE', kind: 'door', wall: 'LIV.w1', offset: 100, width: 90 },
      },
      {
        id: 'ADD_OPENING',
        params: { id: 'DI', kind: 'door', wall: 'BED.w3', offset: 100, width: 70 },
      },
    );
    const firm = [BUILT_IN_PACKS['firm-default']!];
    const [main, inner] = checkPlan(p, { packs: firm });
    expect(main!.fix).toEqual({
      label: 'Make door DE 1.00 m wide',
      steps: [{ id: 'SET', params: { id: 'DE', props: { width: 100, offset: 95 }, level: 'L0' } }],
    });
    expect(inner!.fix!.steps[0]!.params).toMatchObject({ props: { width: 75, offset: 97.5 } });
    expect(
      checkPlan(run(p, [...main!.fix!.steps, ...inner!.fix!.steps]).plan, { packs: firm }),
    ).toEqual([]);
    // A window right beside the inside door: no quick fix, only the sentence.
    const tight = draw(p, {
      id: 'ADD_OPENING',
      params: { id: 'WI', kind: 'window', wall: 'BED.w3', offset: 171, width: 100, sill: 90 },
    });
    expect(checkPlan(tight, { packs: firm })[1]!.fix).toBeUndefined();
  });

  it('raise a low level to the minimum height', () => {
    const p = draw(site(), box('BED', [0, 0], [400, 350], 'bedroom'));
    const L = firstLevel(p);
    const low = { ...p, levels: { [L.id]: { ...L, height: 270 } } };
    const [height] = checkPlan(low, { packs: nbc });
    expect(height!.fix).toEqual({
      label: 'Make Ground 2.75 m high',
      steps: [{ id: 'SET_LEVEL', params: { height: 275, level: L.id } }],
    });
    expect(checkPlan(run(low, height!.fix!.steps).plan, { packs: nbc })).toEqual([]);
  });

  it('score Vastu as the share of preferences met, one per room and the main entrance', () => {
    const p = draw(
      site({ vastu: true }),
      box('KIT', [0, 900], [300, 1200], 'kitchen'), // north-west: missed
      box('MBR', [0, 0], [400, 350], 'master_bedroom'), // south-west: met
      box('TLT', [1000, 1000], [1200, 1200], 'toilet'), // north-east: missed
      box('LIV', [500, 0], [900, 400], 'living', 'external'), // no Vastu rule
      {
        id: 'ADD_OPENING',
        params: { id: 'DE', kind: 'door', wall: 'LIV.w1', offset: 150, width: 100 }, // faces south
      },
    );
    expect(vastuScore(p)).toEqual({
      value: 25,
      met: 1,
      total: 4,
      provenance: 'assumed',
      reason: 'Assumes north points up in the drawing.',
    });
    // Moving the toilet out of the north-east meets one more preference.
    const moved = draw(p, { id: 'MOVE', params: { ids: ['TLT'], from: [0, 0], to: [0, -500] } });
    expect(vastuScore(moved)?.value).toBe(50);
    // Vastu off, or nothing a Vastu rule applies to: no score.
    expect(vastuScore({ ...p, meta: { ...p.meta, vastu: false } })).toBeNull();
    expect(
      vastuScore(draw(site({ vastu: true }), box('B', [0, 0], [400, 400], 'bedroom'))),
    ).toBeNull();
  });
});
