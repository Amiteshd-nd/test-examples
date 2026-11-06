import { describe, expect, it } from 'vitest';
import { parseLength, typedPoint } from './input.ts';

describe('precision input while drawing (A2 M5)', () => {
  it('reads lengths in cm, metres, millimetres and feet-inches', () => {
    expect(parseLength('450')).toBe(450);
    expect(parseLength('4.5m')).toBe(450);
    expect(parseLength('450 cm')).toBe(450);
    expect(parseLength('4505mm')).toBe(450.5);
    expect(parseLength(`15'6"`)).toBe(472.4);
    expect(parseLength(`15'`)).toBe(457.2);
    expect(parseLength(`6"`)).toBe(15.2);
    expect(parseLength('-30')).toBe(-30);
    expect(parseLength('four')).toBeNull();
  });

  const last: [number, number] = [100, 100];
  it('turns a bare length into a point along the cursor’s direction', () => {
    expect(typedPoint('450', { last, toward: [900, 100] })).toEqual({
      ok: true,
      point: [550, 100],
    });
    expect(typedPoint('3m', { last, toward: [100, -50] })).toEqual({
      ok: true,
      point: [100, -200],
    });
  });

  it('reads polar, relative and absolute points', () => {
    expect(typedPoint('200<90', { last, toward: null })).toEqual({ ok: true, point: [100, 300] });
    expect(typedPoint('@200<180', { last, toward: null })).toEqual({
      ok: true,
      point: [-100, 100],
    });
    expect(typedPoint('@120,-30', { last, toward: null })).toEqual({ ok: true, point: [220, 70] });
    expect(typedPoint('300,4.5m', { last: null, toward: null })).toEqual({
      ok: true,
      point: [300, 450],
    });
  });

  it('says what is wrong', () => {
    const msg = (t: string, l = last) => {
      const r = typedPoint(t, { last: l, toward: null });
      return r.ok ? 'ok' : r.message;
    };
    expect(msg('')).toMatch(/Type a length/);
    expect(msg('450')).toMatch(/Point the cursor/);
    expect(msg('450', null as never)).toMatch(/first point/);
    expect(msg('@1,2', null as never)).toMatch(/first point/);
    expect(msg('1,2,3')).toMatch(/not a point/);
    expect(msg('450<')).toMatch(/not a length and angle/);
    expect(msg('lots')).toMatch(/not a length/);
  });
});
