import { describe, expect, it } from 'vitest';
import { sequentialIds } from '../ids.ts';
import type { CommandCall } from './history.ts';
import { findCommand, formatCommand, parseCommand, usage } from './text.ts';

const parse = (text: string) => parseCommand(text, { ids: sequentialIds('N') });
const call = (text: string) => {
  const r = parse(text);
  if (!r.ok) throw new Error(r.message);
  return r.call;
};
const error = (text: string) => {
  const r = parse(text);
  return r.ok ? 'parsed' : r.message;
};

describe('typed commands (PRD §4.4)', () => {
  it('reads positional values, name=value pairs and AutoCAD aliases', () => {
    expect(call('MOVE W3 0,0 100,0')).toEqual({
      id: 'MOVE',
      params: { ids: ['W3'], from: [0, 0], to: [100, 0] },
    });
    expect(call('m W3,D1 0,0 -12.5,40')).toEqual({
      id: 'MOVE',
      params: { ids: ['W3', 'D1'], from: [0, 0], to: [-12.5, 40] },
    });
    expect(call('erase W3')).toEqual({ id: 'DELETE', params: { ids: ['W3'] } });
    expect(call('ADD_WALL 0,0 500,0 type=external')).toEqual({
      id: 'ADD_WALL',
      params: { id: 'N-0001', start: [0, 0], end: [500, 0], type: 'external' },
    });
    expect(call('ADD_WALL 0,0 500,0 11.5 id=W9 level=L0').params).toEqual({
      id: 'W9',
      start: [0, 0],
      end: [500, 0],
      thickness: 11.5,
      level: 'L0',
    });
  });

  it('reads names with spaces, quoted or not, and collects SET properties', () => {
    expect(call('ADD_ROOM 150,200 bedroom Guest room').params).toMatchObject({
      seed: [150, 200],
      type: 'bedroom',
      name: 'Guest room',
    });
    expect(call('ADD_ROOM 150,200 bedroom "Guest room" id=R9').params).toMatchObject({
      id: 'R9',
      name: 'Guest room',
    });
    expect(call('SET D1 width=100 swing=out-left height=null').params).toEqual({
      id: 'D1',
      props: { width: 100, swing: 'out-left', height: null },
    });
    expect(call('SET R1 name="Master bedroom" locked=true').params).toEqual({
      id: 'R1',
      props: { name: 'Master bedroom', locked: true },
    });
  });

  it('explains what is wrong', () => {
    expect(error('')).toMatch(/Type a command/);
    expect(error('FLY W1')).toMatch(/There is no command FLY/);
    expect(error('MOVE W1 0,0')).toBe('MOVE needs to: MOVE ids from to');
    expect(error('MOVE W1 0;0 1,1')).toMatch(/not a point; write it as x,y/);
    expect(error('DELETE W1 W2')).toMatch(/Too many values for DELETE: "W2"/);
    expect(error('MOVE W1 0,0 1,1 speed=3')).toMatch(/MOVE has no setting "speed"/);
    expect(parseCommand('ADD_WALL 0,0 1,0')).toEqual({
      ok: false,
      message: 'ADD_WALL needs an id, e.g. id=W12.',
    });
    expect(usage(findCommand('add_opening')!)).toBe('ADD_OPENING kind wall offset [width]');
  });

  it('writes calls back as text that reads back the same', () => {
    const calls: CommandCall[] = [
      { id: 'MOVE', params: { ids: ['W3', 'D1'], from: [0, 0], to: [100.5, -20] } },
      { id: 'DELETE', params: { ids: ['W3'] } },
      { id: 'ADD_WALL', params: { id: 'W9', start: [0, 0], end: [500, 0], type: 'external' } },
      {
        id: 'ADD_ROOM',
        params: { id: 'R9', seed: [150, 200], type: 'bedroom', name: 'Guest room' },
      },
      {
        id: 'ADD_OPENING',
        params: { id: 'D9', kind: 'door', wall: 'W9', offset: 50, swing: 'out-right' },
      },
      {
        id: 'SET',
        params: { id: 'D1', props: { width: 100, chajja: { depth: 45, overhang: 15 } } },
      },
      { id: 'SET', params: { id: 'R1', props: { name: '12' } } },
      { id: 'SET', params: { id: 'R2', props: { name: 'The "big" room' } } },
    ];
    for (const c of calls) {
      const text = formatCommand(c);
      expect(call(text), text).toEqual(c);
    }
    expect(formatCommand(calls[0]!)).toBe('MOVE W3,D1 0,0 100.5,-20');
    expect(formatCommand(calls[3]!)).toBe('ADD_ROOM 150,200 bedroom "Guest room" id=R9');
  });
});
