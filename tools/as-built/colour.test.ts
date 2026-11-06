import { describe, expect, it } from 'vitest';
import { contrast, deltaE2000, family, mixSrgb, parseColour, shortHex, toHex8 } from './colour.ts';

const c = (s: string) => parseColour(s)!;

describe('as-built colour maths', () => {
  it('normalises hex, rgb() and names to #rrggbbaa', () => {
    expect(toHex8(c('#abc'))).toBe('#aabbccff');
    expect(toHex8(c('#8080DD'))).toBe('#8080ddff');
    expect(toHex8(c('rgba(17, 17, 20, 0.24)'))).toBe('#1111143d');
    expect(toHex8(c('rgb(255 255 255 / 50%)'))).toBe('#ffffff80');
    expect(toHex8(c('transparent'))).toBe('#00000000');
    expect(shortHex('#111114ff')).toBe('#111114');
    expect(parseColour('currentColor')).toBeNull();
  });

  it('mixes like CSS color-mix(in srgb) with premultiplied alpha', () => {
    expect(toHex8(mixSrgb(c('#ffffff'), 0.5, c('#000000')))).toBe('#808080ff');
    expect(toHex8(mixSrgb(c('#3dd68c'), 0.16, c('transparent')))).toBe('#3dd68c29');
  });

  it('computes WCAG contrast ratios', () => {
    expect(contrast(c('#000'), c('#fff'))).toBeCloseTo(21, 5);
    expect(contrast(c('#777'), c('#fff'))).toBeCloseTo(4.48, 2);
    // Semi-transparent text is composited over its background first.
    expect(contrast(c('rgba(0,0,0,0.5)'), c('#fff'))).toBeCloseTo(
      contrast(c('#808080'), c('#fff')),
      1,
    );
  });

  it('matches the CIEDE2000 reference data (Sharma et al. 2005)', () => {
    expect(deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 3);
    expect(deltaE2000([50, 2.5, 0], [73, 25, -18])).toBeCloseTo(27.1492, 3);
  });

  it('groups colours into hue families', () => {
    expect(family(c('#6b6b78'))).toBe('neutral');
    expect(family(c('#8080dd'))).toBe('blue');
    expect(family(c('#c93035'))).toBe('red');
    expect(family(c('#f5a524'))).toBe('amber');
    expect(family(c('#1b7f46'))).toBe('green');
  });
});
