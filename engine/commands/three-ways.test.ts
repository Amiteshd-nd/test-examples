import { describe, expect, it } from 'vitest';
import { blankPlan } from '../samples/blank-plan.ts';
import { sameValue } from './changeset.ts';
import { createHistory, execute, type CommandCall, type CommandRequest } from './history.ts';
import { PLAN_COMMANDS } from './registry.ts';
import { formatCommand, parseCommand } from './text.ts';

// P2.5 ✅: every command gives the same plan whether it is called directly, typed on the
// command line, or sent as an AI tool call (JSON). A new command without a sample fails here.

const setup: CommandCall[] = [
  { id: 'ADD_WALL', params: { id: 'S', start: [0, 0], end: [600, 0], type: 'external' } },
  { id: 'ADD_WALL', params: { id: 'E', start: [600, 0], end: [600, 400], type: 'external' } },
  { id: 'ADD_WALL', params: { id: 'N', start: [600, 400], end: [0, 400], type: 'external' } },
  { id: 'ADD_WALL', params: { id: 'W', start: [0, 400], end: [0, 0], type: 'external' } },
  { id: 'ADD_WALL', params: { id: 'V', start: [300, 0], end: [300, 400] } },
  { id: 'ADD_WALL', params: { id: 'X', start: [100, 300], end: [200, 300] } },
  { id: 'ADD_ROOM', params: { id: 'RL', seed: [150, 150], type: 'bedroom', name: 'Guest room' } },
  { id: 'ADD_OPENING', params: { id: 'DV', kind: 'door', wall: 'V', offset: 150 } },
  { id: 'ADD_DIMENSION', params: { id: 'DS', start: [0, 0], end: [600, 0] } },
];
let h = createHistory(blankPlan({ name: 'Three ways', plot: [1200, 800] }));
for (const call of setup) {
  const r = execute(h, { op: 'execute', ...call });
  if (!r.outcome.ok) throw new Error(r.outcome.message);
  h = r.history;
}
const base = h;

const SAMPLES: Record<string, CommandCall['params']> = {
  MOVE: { ids: ['V', 'RL'], from: [0, 0], to: [30.5, -10] },
  DELETE: { ids: ['V'] },
  ADD_WALL: { id: 'W9', start: [0, 200], end: [300, 200], thickness: 11.5 },
  ADD_ROOM: { id: 'R9', seed: [450, 200], type: 'kitchen', name: 'Kitchen 2' },
  ADD_OPENING: { id: 'D9', kind: 'window', wall: 'S', offset: 350, width: 150, sill: 75 },
  SET: { id: 'DV', props: { width: 100, swing: 'out-right' } },
  ADD_LINE: {
    id: 'L9',
    points: [
      [700, 0],
      [800, 0],
      [800, 100],
    ],
    closed: false,
  },
  RECTANGLE: { id: 'L8', corner: [700, 200], opposite: [900, 300] },
  ROOM: { id: 'RB', corner: [600, 0], opposite: [900, 400], type: 'study', name: 'Den' },
  ADD_SEPARATOR: { id: 'SP', start: [0, 250], end: [300, 250] },
  ADD_STAIR: { id: 'ST', corner: [700, 500], opposite: [1000, 600], direction: 'down' },
  ADD_DIMENSION: { id: 'DM', start: [0, 400], end: [600, 400], offset: 75 },
  ADD_TEXT: { id: 'TX', at: [300, 500], text: 'Open to sky', size: 20 },
  ADD_HATCH: {
    id: 'HT',
    polygon: [
      [0, 0],
      [300, 0],
      [300, 400],
    ],
    pattern: 'cross',
  },
  COPY: { ids: ['V'], from: [0, 0], to: [100, 0], id: 'K' },
  ROTATE: { ids: ['X'], center: [150, 300], angle: 90 },
  MIRROR: { ids: ['V', 'DV'], a: [600, 0], b: [600, 400], id: 'MI' },
  OFFSET: { source: 'V', distance: -50, id: 'V2' },
  TRIM: { target: 'S', at: [450, 0], id: 'S2' },
  EXTEND: { target: 'X', end: 'end' },
  SET_LENGTH: { target: 'DS', length: 650 },
};

describe('every command three ways (P2.5)', () => {
  it('has a sample for every registered command', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(Object.keys(PLAN_COMMANDS).sort());
  });

  for (const [id, params] of Object.entries(SAMPLES)) {
    it(`${id}: direct, typed and AI tool call give the same plan`, () => {
      const direct = execute(base, { op: 'execute', id, params });
      expect(direct.outcome, JSON.stringify(direct.outcome)).toMatchObject({ ok: true });
      expect(direct.history.plan).not.toBe(base.plan);

      const text = formatCommand({ id, params });
      const typed = parseCommand(text);
      expect(typed.ok, `${text}: ${typed.ok ? '' : typed.message}`).toBe(true);
      const viaText = execute(base, { op: 'execute', ...(typed as { call: CommandCall }).call });

      const tool = JSON.parse(
        JSON.stringify({ op: 'execute', id, params, revision: base.rev, request_id: `ai-${id}` }),
      ) as CommandRequest;
      const viaAi = execute(base, tool);

      expect(sameValue(viaText.history.plan, direct.history.plan), text).toBe(true);
      expect(sameValue(viaAi.history.plan, direct.history.plan)).toBe(true);
    });
  }
});
