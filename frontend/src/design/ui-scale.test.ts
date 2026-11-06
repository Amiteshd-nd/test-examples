import { describe, expect, it } from 'vitest';
import { UI_SCALES, formatUiScale, parseUiScale } from './ui-scale.ts';

describe('UI scale setting', () => {
  it('offers 100, 112.5, 125 and 150 %', () => {
    expect(UI_SCALES.map(formatUiScale)).toEqual(['100 %', '112.5 %', '125 %', '150 %']);
  });

  it('reads only supported stored values; anything else is 100 %', () => {
    expect(parseUiScale('1.25')).toBe(1.25);
    expect(parseUiScale('1.5')).toBe(1.5);
    expect(parseUiScale('2')).toBe(1);
    expect(parseUiScale('big')).toBe(1);
    expect(parseUiScale(null)).toBe(1);
  });
});
