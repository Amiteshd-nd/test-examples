import {
  createHistory,
  execute,
  firstLevel,
  gridPlan,
  validatePlan,
  type Point,
} from '@plancraft/engine';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OPTIONS,
  IDLE,
  TOOL_LIST,
  toolClick,
  toolFinish,
  toolPreview,
  toolPrompt,
  toolTyped,
  type ToolContext,
  type ToolId,
  type ToolState,
  type ToolStep,
} from './tools.ts';

const plan = gridPlan({ cols: 2, rows: 1 }); // walls H0, H1 (horizontal), V0, V1, V2; rooms R1, R2
let n = 0;
const ctx = (over: Partial<ToolContext> = {}): ToolContext => ({
  level: firstLevel(plan),
  rooms: validatePlan(plan).rooms,
  selected: null,
  options: DEFAULT_OPTIONS,
  newId: () => `new-${++n}`,
  ...over,
});
/** Clicks a series of points (no object under them) and returns every step. */
function clicks(tool: ToolId, points: Point[], c = ctx()): ToolStep[] {
  let state: ToolState = IDLE;
  return points.map((point) => {
    const step = toolClick(tool, state, { point, pick: null }, c);
    state = step.state;
    return step;
  });
}
const ok = (step: ToolStep) => {
  const r = execute(createHistory(plan), step.request!);
  if (!r.outcome.ok) throw new Error(r.outcome.message);
  return firstLevel(r.history.plan);
};

describe('tools (P2.5)', () => {
  it('lists every tool once with a key and a prompt', () => {
    expect(new Set(TOOL_LIST.map((t) => t.id)).size).toBe(TOOL_LIST.length);
    const keys = TOOL_LIST.map((t) => `${t.shift ? '⇧' : ''}${t.key}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of TOOL_LIST) if (t.id !== 'select') expect(toolPrompt(t.id, IDLE)).not.toBe('');
  });

  it('draws a chain of walls, one command per segment, closing on its first point', () => {
    const steps = clicks('wall', [
      [0, 400],
      [300, 400],
      [300, 600],
      [0, 400],
    ]);
    expect(steps.map((s) => (s.request?.op === 'execute' ? s.request.id : undefined))).toEqual([
      undefined,
      'ADD_WALL',
      'ADD_WALL',
      'ADD_WALL',
    ]);
    expect(steps[3]!.state).toEqual(IDLE);
    expect(ok(steps[1]!).walls).toHaveProperty(
      (steps[1]!.request as { params: { id: string } }).params.id,
    );
  });

  it('takes typed lengths, polar and relative points while drawing (A2 M5)', () => {
    const c = ctx();
    let s = toolClick('wall', IDLE, { point: [0, 0], pick: null }, c).state;
    const step = toolTyped('wall', s, '4.5m', [1000, 0], c);
    expect(step.request).toMatchObject({ params: { start: [0, 0], end: [450, 0] } });
    s = step.state;
    expect(toolTyped('wall', s, '300<90', null, c).request).toMatchObject({
      params: { start: [450, 0], end: [450, 300] },
    });
    expect(toolTyped('wall', s, 'lots', null, c).message).toMatch(/not a length/);
  });

  it('finishes a polyline with Enter, or closes it on its first point', () => {
    const c = ctx();
    const steps = clicks(
      'line',
      [
        [0, 0],
        [100, 0],
        [100, 100],
      ],
      c,
    );
    expect(toolFinish('line', steps.at(-1)!.state, c).request).toMatchObject({
      id: 'ADD_LINE',
      params: {
        points: [
          [0, 0],
          [100, 0],
          [100, 100],
        ],
      },
    });
    const closed = clicks(
      'line',
      [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 0],
      ],
      c,
    );
    expect(closed.at(-1)!.request).toMatchObject({ params: { closed: true } });
  });

  it('puts a door on the clicked wall, centred on the click', () => {
    const step = toolClick(
      'door',
      IDLE,
      { point: [165, 0], pick: { kind: 'wall', id: 'H0' } },
      ctx(),
    );
    expect(step.request).toMatchObject({ params: { kind: 'door', wall: 'H0', offset: 120 } });
    expect(toolClick('door', IDLE, { point: [165, 150], pick: null }, ctx()).message).toMatch(
      /Click on a wall/,
    );
  });

  it('moves the selection from a base point to a target, then is done', () => {
    const c = ctx({ selected: { kind: 'wall', id: 'V1' } });
    let s = toolClick('move', IDLE, { point: [330, 100], pick: null }, c).state;
    expect(s.target).toEqual({ kind: 'wall', id: 'V1' });
    expect(toolPreview('move', s, [360, 100], c).request).toMatchObject({ id: 'MOVE' });
    const step = toolClick('move', s, { point: [360, 100], pick: null }, c);
    expect(step).toMatchObject({
      done: true,
      request: { params: { ids: ['V1'], from: [330, 100], to: [360, 100] } },
    });
    expect(ok(step).walls.V1!.start).toEqual([360, 0]);
    // Without a selection, the first click picks the object.
    s = IDLE;
    const pick = toolClick(
      'copy',
      s,
      { point: [330, 100], pick: { kind: 'wall', id: 'V1' } },
      ctx(),
    );
    expect(pick).toMatchObject({
      select: { kind: 'wall', id: 'V1' },
      state: { target: { id: 'V1' } },
    });
  });

  it('rotates by a typed angle and mirrors across a line', () => {
    const c = ctx({ selected: { kind: 'wall', id: 'V1' } });
    const s = toolClick('rotate', IDLE, { point: [330, 150], pick: null }, c).state;
    expect(toolTyped('rotate', s, '90', null, c).request).toMatchObject({
      params: { center: [330, 150], angle: 90 },
    });
    const m = clicks(
      'mirror',
      [
        [660, 0],
        [660, 300],
      ],
      c,
    );
    expect(m.at(-1)!.request).toMatchObject({
      id: 'MIRROR',
      params: { a: [660, 0], b: [660, 300] },
    });
  });

  it('offsets to the clicked side or a typed distance', () => {
    const c = ctx({ selected: { kind: 'wall', id: 'V1' } });
    const step = toolClick('offset', IDLE, { point: [300, 100], pick: null }, c);
    expect(step.request).toMatchObject({ params: { source: 'V1', distance: 30 } });
    const s = { ...IDLE, target: { kind: 'wall' as const, id: 'V1' } };
    expect(toolTyped('offset', s, '50', [400, 100], c).request).toMatchObject({
      params: { distance: -50 },
    });
  });

  it('trims, extends and deletes what is clicked; hatches a room', () => {
    const wall = { kind: 'wall' as const, id: 'H0' };
    expect(toolClick('trim', IDLE, { point: [500, 0], pick: wall }, ctx()).request).toMatchObject({
      id: 'TRIM',
      params: { target: 'H0', at: [500, 0] },
    });
    expect(toolClick('extend', IDLE, { point: [600, 0], pick: wall }, ctx()).request).toMatchObject(
      {
        params: { target: 'H0', end: 'end' },
      },
    );
    expect(toolClick('delete', IDLE, { point: [0, 0], pick: wall }, ctx()).request).toMatchObject({
      id: 'DELETE',
    });
    const hatch = toolClick('hatch', IDLE, { point: [165, 150], pick: null }, ctx());
    expect(ok(hatch).hatches).not.toEqual({});
  });

  it('places a dimension with a third click, and a note after its text', () => {
    const c = ctx();
    const d = clicks(
      'dimension',
      [
        [0, 0],
        [330, 0],
        [100, -60],
      ],
      c,
    );
    expect(d.at(-1)!.request).toMatchObject({
      params: { start: [0, 0], end: [330, 0], offset: -60 },
    });
    const t = toolClick('text', IDLE, { point: [100, 100], pick: null }, c);
    expect(t.state.asking).toBe('text');
    expect(toolTyped('text', t.state, 'Wash basin', null, c).request).toMatchObject({
      id: 'ADD_TEXT',
      params: { at: [100, 100], text: 'Wash basin' },
    });
  });
});
