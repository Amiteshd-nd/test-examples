import { describe, expect, it } from 'vitest';
import { sequentialIds } from '../ids.ts';
import { firstLevel } from '../schema/collections.ts';
import { gridPlan } from '../samples/grid-plan.ts';
import { sameValue } from './changeset.ts';
import {
  applyRemote,
  canRedo,
  canUndo,
  createHistory,
  execute,
  preview,
  redo,
  undo,
  type CommandRequest,
  type History,
} from './history.ts';
import { formatCommand, parseCommand } from './text.ts';

const plan = gridPlan({ cols: 4, rows: 3 });
const walls = Object.keys(firstLevel(plan).walls);
const move = (ids: string[], dx: number, dy = 0, more: Partial<CommandRequest> = {}) =>
  ({
    op: 'execute',
    id: 'MOVE',
    params: { ids, from: [0, 0], to: [dx, dy] },
    ...more,
  }) as CommandRequest;
function ok(r: { history: History; outcome: { ok: boolean } }) {
  expect(r.outcome).toMatchObject({ ok: true });
  return r.history;
}

describe('command bus and history (P2.4)', () => {
  it('undoes and redoes 50 steps exactly', () => {
    let h = createHistory(plan);
    for (let i = 0; i < 50; i++) h = ok(execute(h, move([walls[i % walls.length]!], 10, -5)));
    const end = h.plan;
    expect(h.rev).toBe(50);
    for (let i = 0; i < 50; i++) h = ok(undo(h));
    expect(sameValue(h.plan, plan)).toBe(true);
    expect(canUndo(h)).toBe(false);
    for (let i = 0; i < 50; i++) h = ok(redo(h));
    expect(sameValue(h.plan, end)).toBe(true);
    expect(canRedo(h)).toBe(false);
    expect(h.rev).toBe(150);
  });

  it('a new change clears redo', () => {
    let h = ok(execute(createHistory(plan), move(['V1'], 10)));
    h = ok(undo(h));
    expect(canRedo(h)).toBe(true);
    h = ok(execute(h, move(['V2'], 10)));
    expect(canRedo(h)).toBe(false);
  });

  it('runs a batch as one undo step, all or nothing', () => {
    const h0 = createHistory(plan);
    const batch: CommandRequest = {
      op: 'batch',
      steps: [
        { id: 'MOVE', params: { ids: ['V1'], from: [0, 0], to: [20, 0] } },
        { id: 'SET', params: { id: 'R1', props: { name: 'Lounge' } } },
      ],
    };
    const h1 = ok(execute(h0, batch));
    expect(firstLevel(h1.plan).rooms.R1!.name).toBe('Lounge');
    expect(sameValue(ok(undo(h1)).plan, plan)).toBe(true);

    const broken = execute(h0, {
      op: 'batch',
      steps: [...batch.steps, { id: 'DELETE', params: { ids: ['NOPE'] } }],
    });
    expect(broken.outcome).toMatchObject({ ok: false, code: 'not_possible', step: 2 });
    expect(broken.history.plan).toBe(plan);
  });

  it('refuses stale revisions, and repeats nothing for a retried request id', () => {
    let h = ok(execute(createHistory(plan), move(['V1'], 10)));
    expect(execute(h, move(['V1'], 10, 0, { revision: 0 })).outcome).toMatchObject({
      ok: false,
      code: 'stale',
    });
    h = ok(execute(h, move(['V1'], 10, 0, { revision: 1, request_id: 'req-7' })));
    const again = execute(h, move(['V1'], 10, 0, { revision: 1, request_id: 'req-7' }));
    expect(again.history).toBe(h);
    expect(again.outcome).toMatchObject({ ok: true, changeset: { id: 'req-7' } });
    expect(firstLevel(h.plan).walls.V1!.start).toEqual([350, 0]);
  });

  it('merges the steps of one gesture into one undo step (A2 M7)', () => {
    let h = createHistory(plan);
    for (let i = 1; i <= 5; i++) h = ok(execute(h, move(['V1'], 2, 0, { gesture: 'nudge-1' })));
    expect(firstLevel(h.plan).walls.V1!.start).toEqual([340, 0]);
    expect(h.undo.local).toHaveLength(1);
    expect(h.log).toHaveLength(1);
    h = ok(execute(h, move(['V1'], 2, 0, { gesture: 'nudge-2' })));
    expect(h.undo.local).toHaveLength(2);
    h = ok(undo(ok(undo(h))));
    expect(sameValue(h.plan, plan)).toBe(true);
  });

  it('previews without recording, and records nothing for a change that changes nothing', () => {
    const h = createHistory(plan);
    const p = preview(h, move(['V1'], 40));
    expect(p.ok && firstLevel(p.plan).walls.V1!.start).toEqual([370, 0]);
    expect(h.rev).toBe(0);
    const none = execute(h, move(['V1'], 0));
    expect(none.outcome).toEqual({ ok: true, changeset: null });
    expect(none.history.rev).toBe(0);
  });

  it('refuses a change that would make the plan invalid, and unknown commands', () => {
    const h = createHistory(plan);
    // 1 km to the right: each point is allowed, but the wall would leave the drawing area.
    const far = {
      op: 'execute',
      id: 'MOVE',
      params: { ids: ['V1'], from: [-50_000, 0], to: [50_000, 0] },
    };
    expect(execute(h, far as CommandRequest).outcome).toMatchObject({
      ok: false,
      code: 'invalid_result',
    });
    expect(execute(h, { op: 'execute', id: 'FLY', params: {} }).outcome).toMatchObject({
      ok: false,
      code: 'unknown_command',
    });
    expect(execute(h, { op: 'execute', id: 'MOVE', params: { ids: [] } }).outcome).toMatchObject({
      ok: false,
      code: 'invalid_params',
    });
  });

  it('undo is per author and keeps what others changed since (A2 M8)', () => {
    let h = ok(execute(createHistory(plan), move(['V1'], 60, 0, { author: 'asha' })));
    // Ravi changes the same wall's thickness, then renames a room.
    h = ok(
      execute(h, {
        op: 'execute',
        id: 'SET',
        params: { id: 'V1', props: { thickness: 23 } },
        author: 'ravi',
      }),
    );
    h = ok(undo(h, 'asha'));
    expect(firstLevel(h.plan).walls.V1).toMatchObject({ start: [330, 0], thickness: 23 });
    expect(canUndo(h, 'asha')).toBe(false);
    expect(canUndo(h, 'ravi')).toBe(true);

    // Asha moves it again; Ravi then moves it too: Asha's undo can't put it back and says so.
    h = ok(execute(h, move(['V1'], 60, 0, { author: 'asha' })));
    h = ok(execute(h, move(['V1'], 10, 0, { author: 'ravi' })));
    const r = undo(h, 'asha');
    expect(r.outcome).toMatchObject({ ok: true });
    const skipped = r.outcome.ok ? (r.outcome.skipped ?? []) : [];
    expect(skipped.map((p) => p.path.at(-1))).toEqual(expect.arrayContaining(['start', 'end']));
    expect(firstLevel(r.history.plan).walls.V1!.start).toEqual([400, 0]);
  });

  it('applies changes made elsewhere without putting them on this author’s undo list', () => {
    const elsewhere = execute(createHistory(plan), move(['V2'], 15, 0, { author: 'ravi' }));
    const theirs = elsewhere.outcome.ok ? elsewhere.outcome.changeset! : null;
    let h = ok(execute(createHistory(plan), move(['V1'], 10)));
    h = applyRemote(h, theirs!);
    expect(firstLevel(h.plan).walls.V2!.start).toEqual([675, 0]);
    h = ok(undo(h));
    expect(firstLevel(h.plan).walls.V1!.start).toEqual([330, 0]);
    expect(firstLevel(h.plan).walls.V2!.start).toEqual([675, 0]);
  });

  it('gives the same plan whether a command is called, typed or sent as an AI tool call', () => {
    const ids = sequentialIds('W');
    const typed = parseCommand('ADD_WALL 0,150 1320,150 type=internal', { ids });
    expect(typed.ok).toBe(true);
    const call = typed.ok ? typed.call : null;
    const direct = execute(createHistory(plan), { op: 'execute', ...call! });
    const ai = execute(
      createHistory(plan),
      JSON.parse(
        JSON.stringify({ op: 'execute', id: 'ADD_WALL', params: call!.params, revision: 0 }),
      ) as CommandRequest,
    );
    const retyped = parseCommand(formatCommand(call!));
    const viaText = execute(createHistory(plan), {
      op: 'execute',
      ...(retyped.ok ? retyped.call : call!),
    });
    expect(sameValue(direct.history.plan, ai.history.plan)).toBe(true);
    expect(sameValue(direct.history.plan, viaText.history.plan)).toBe(true);
    expect(firstLevel(direct.history.plan).walls['W-0001']).toMatchObject({ thickness: 11.5 });
  });
});
