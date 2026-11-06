import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createHistory, execute, type CommandCall } from '../commands/history.ts';
import { loadPlan } from '../validate/validate.ts';
import { PlanGraph } from '../schema/graph.ts';
import type { Plan } from '../schema/plan.ts';
import { blankPlan } from '../samples/blank-plan.ts';
import { gridPlan } from '../samples/grid-plan.ts';
import { planGraph } from './plan-graph.ts';

// P3.3: the Plan Graph of the four sample plans and a 4 × 3 grid (the five plans of the founder's
// spot-check, `docs/design/P3.3-plan-graph-review.md`), and the cases each edge kind comes from.

const sample = (name: string): Plan => {
  const url = new URL(`../samples/1.3.0/${name}.plan.json`, import.meta.url);
  const r = loadPlan(JSON.parse(readFileSync(url, 'utf8')));
  if (!r.ok) throw new Error(name);
  return r.plan;
};
const edges = (p: Plan) => planGraph(p).edges.map((e) => `${e.a} ${e.kind} ${e.b} (${e.via})`);
const node = (p: Plan, id: string) => planGraph(p).nodes.find((n) => n.id === id)!;
function draw(plan: Plan, ...calls: CommandCall[]): Plan {
  let h = createHistory(plan);
  for (const call of calls) {
    const r = execute(h, { op: 'execute', ...call });
    if (!r.outcome.ok) throw new Error(`${call.id}: ${r.outcome.message}`);
    h = r.history;
  }
  return h.plan;
}
const site = () => blankPlan({ name: 'Graph', plot: [1200, 1200] });
const box = (
  id: string,
  corner: [number, number],
  opposite: [number, number],
  type = 'bedroom',
) => ({
  id: 'ROOM',
  params: { id, corner, opposite, type },
});

describe('Plan Graph of the five spot-check plans (P3.3)', () => {
  it('A, one room: no edges; outside on all four sides; the entrance', () => {
    const p = sample('a-one-room');
    expect(edges(p)).toEqual([]);
    expect(node(p, 'R1')).toMatchObject({
      area_m2: 10.44,
      zone: 'middle',
      exterior: true,
      exterior_sides: ['north', 'east', 'south', 'west'],
      entrance: true,
    });
  });

  it('B, 1BHK: doors bedroom–kitchen and kitchen–toilet; bedroom and toilet share a wall', () => {
    const p = sample('b-1bhk-t-junctions');
    expect(edges(p)).toEqual(['R1 door R2 (D1)', 'R1 wall R3 (W5)', 'R2 door R3 (D2)']);
    // Facing east: the bedroom (west half) is at the rear, kitchen and toilet at the front.
    expect(planGraph(p).nodes.map((n) => `${n.id} ${n.zone} ${n.exterior_sides}`)).toEqual([
      'R1 rear north,south,west',
      'R2 front east,south',
      'R3 front north,east',
    ]);
  });

  it('C, L-shaped hall: the duct inside it shares its walls; the stub changes nothing', () => {
    const p = sample('c-l-hall-duct');
    expect(edges(p)).toEqual(['R1 wall R2 (D_W1,D_W2,D_W3,D_W4)']);
    expect(node(p, 'R2')).toMatchObject({ exterior: false, entrance: false, zone: 'rear' });
  });

  it('D, open plan: living and dining open into each other; a door to the kitchen', () => {
    const p = sample('d-open-plan-separator');
    expect(edges(p)).toEqual(['R1 open R2 (SP1)', 'R2 door R3 (D1)']);
    expect(
      planGraph(p)
        .nodes.filter((n) => n.entrance)
        .map((n) => n.id),
    ).toEqual(['R1']);
  });

  it('E, 4 × 3 grid: doors to neighbours, shared walls, corners; rows front to rear', () => {
    const p = gridPlan({ cols: 4, rows: 3, name: 'Grid' });
    const g = planGraph(p);
    const count = (kind: string) => g.edges.filter((e) => e.kind === kind).length;
    // 17 neighbour pairs (3 × 3 across, 4 × 2 down): 11 doors and 6 plain walls; 12 corner pairs.
    expect([count('door'), count('wall'), count('adjacent'), count('open')]).toEqual([
      11, 6, 12, 0,
    ]);
    expect(edges(p).slice(0, 3)).toEqual([
      'R1 door R2 (D2)',
      'R1 door R5 (D5)',
      'R1 adjacent R6 ()',
    ]);
    expect(g.nodes.map((n) => n.zone[0]).join('')).toBe('ffffmmmmrrrr'); // faces south
    expect(g.nodes.filter((n) => !n.exterior).map((n) => n.id)).toEqual(['R6', 'R7']);
    expect(g.nodes.filter((n) => n.entrance).map((n) => n.id)).toEqual(['R1']);
    expect(PlanGraph.safeParse(g).success).toBe(true);
  });
});

describe('Plan Graph edges and provenance (P3.3)', () => {
  it('an opening without a door is open; a window in a shared wall is still a wall', () => {
    const p = draw(
      site(),
      box('A', [0, 0], [400, 400]),
      box('B', [400, 0], [800, 400]),
      box('C', [800, 0], [1100, 400]),
      {
        id: 'ADD_OPENING',
        params: { id: 'O1', kind: 'opening', wall: 'A.w2', offset: 100, width: 120 },
      },
      {
        id: 'ADD_OPENING',
        params: { id: 'N1', kind: 'window', wall: 'B.w2', offset: 100, width: 120, sill: 90 },
      },
    );
    // A side that already has a wall gets no second one: A.w2 and B.w2 are the shared walls.
    expect(edges(p)).toEqual(['A open B (O1)', 'B wall C (B.w2)']);
  });

  it('two rooms named in one enclosed space are open to each other', () => {
    const p = draw(site(), box('LIV', [0, 0], [600, 400], 'living'), {
      id: 'ADD_ROOM',
      params: { id: 'DIN', seed: [500, 300], type: 'dining' },
    });
    expect(edges(p)).toEqual(['LIV open DIN ()']);
  });

  it('rooms apart from each other are not linked; an unenclosed room has no area', () => {
    const p = draw(site(), box('A', [0, 0], [300, 300]), box('B', [600, 0], [900, 300]), {
      id: 'ADD_ROOM',
      params: { id: 'X', seed: [1100, 1100], type: 'store' },
    });
    expect(edges(p)).toEqual([]);
    expect(node(p, 'X')).toMatchObject({ area_m2: 0, at: [1100, 1100], exterior: false });
  });

  it('says how each derived field was found; an assumed facing makes the zones assumed', () => {
    const p = sample('b-1bhk-t-junctions');
    expect(planGraph(p).provenance).toMatchObject({
      zone: { provenance: 'inferred' },
      vastu_zone: { provenance: 'assumed', reason: 'Assumes north points up in the drawing.' },
    });
    const guessed = {
      ...p,
      meta: { ...p.meta, provenance: { facing: { provenance: 'assumed' as const } } },
    };
    expect(planGraph(guessed).provenance.zone!.provenance).toBe('assumed');
  });
});
