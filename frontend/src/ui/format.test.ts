import { describe, expect, it } from 'vitest';
import { formatArea, formatLength, gridStep, scaleBarLength } from './format.ts';

describe('display units', () => {
  it('formats lengths and areas in metres or feet-inches', () => {
    expect(formatLength(914.4, 'm')).toBe('9.14 m');
    expect(formatLength(914.4, 'ft_in')).toBe('30′ 0″');
    expect(formatLength(377, 'ft_in')).toBe('12′ 4″');
    expect(formatArea(10.44, 'm')).toBe('10.44 m²');
    expect(formatArea(10.44, 'ft_in')).toBe('112 ft²');
  });
});

describe('scaleBarLength', () => {
  it('picks the longest round length that fits', () => {
    expect(scaleBarLength(1, 'm')).toEqual({ cm: 100, px: 100, label: '1 m' });
    expect(scaleBarLength(0.5, 'm')).toEqual({ cm: 200, px: 100, label: '2 m' });
    expect(scaleBarLength(5, 'm')).toEqual({ cm: 20, px: 100, label: '20 cm' });
    expect(scaleBarLength(0.5, 'ft_in')).toMatchObject({ label: '5′' });
    expect(scaleBarLength(0.5, 'ft_in').px).toBeCloseTo(76.2, 6);
  });

  it('falls back to the shortest step when even that is too long', () => {
    expect(scaleBarLength(100, 'm')).toMatchObject({ cm: 10, label: '10 cm', px: 1000 });
  });
});

describe('gridStep', () => {
  it('keeps grid dots at least 12 px apart on round lengths', () => {
    expect(gridStep(0.8, 'm')).toBe(20); // 16 px
    expect(gridStep(3, 'm')).toBe(5); // 15 px
    expect(gridStep(0.05, 'm')).toBe(500);
    expect(gridStep(0.8, 'ft_in')).toBeCloseTo(15.24, 6); // 6″ = 12.2 px
    expect(gridStep(0.0001, 'm')).toBe(1000);
  });
});
