import { describe, expect, it } from 'vitest';
import { convertCss, convertValue, type ScaleMaps } from './rem-codemod.ts';

const scales: ScaleMaps = {
  space: new Map([
    [4, '100'],
    [8, '200'],
    [16, '400'],
  ]),
  fontSize: new Map([
    [12, '200'],
    [13, '300'],
  ]),
  lineHeight: new Map([[18, '300']]),
};

describe('px → tokens / rem', () => {
  it('uses tokens for values on the scale and rem for the rest', () => {
    expect(convertValue('font-size', '13px', scales)).toBe('var(--pc-font-size-300)');
    expect(convertValue('font-size', '9px', scales)).toBe('0.5625rem');
    expect(convertValue('line-height', '18px', scales)).toBe('var(--pc-font-line-height-300)');
    expect(convertValue('padding', '4px 8px 18px', scales)).toBe(
      'var(--pc-space-100) var(--pc-space-200) 1.125rem',
    );
    expect(convertValue('margin', '0 -16px', scales)).toBe('0 -1rem');
    expect(convertValue('height', '48px', scales)).toBe('3rem');
    expect(
      convertValue('grid-template-columns', 'repeat(auto-fill, minmax(200px, 1fr))', scales),
    ).toBe('repeat(auto-fill, minmax(12.5rem, 1fr))');
  });

  it('keeps hairlines, non-scaling properties and the non-translate parts of transforms', () => {
    expect(convertValue('width', '1px', scales)).toBe('1px');
    expect(convertValue('margin-bottom', '-1px', scales)).toBe('-1px');
    expect(convertValue('border', '2px solid red', scales)).toBe('2px solid red');
    expect(convertValue('box-shadow', '0 8px 24px black', scales)).toBe('0 8px 24px black');
    expect(convertValue('border-radius', '8px', scales)).toBe('8px');
    expect(
      convertValue('transform', 'perspective(300px) translateY(-6px) rotate(4deg)', scales),
    ).toBe('perspective(300px) translateY(-0.375rem) rotate(4deg)');
    expect(convertValue('padding', 'var(--pc-space-200)', scales)).toBe('var(--pc-space-200)');
  });

  it('rewrites declarations in place, leaving selectors and @media alone', () => {
    const css = `@media (max-width: 720px) {\n  .a:hover { padding: 8px; border: 1px solid; }\n}\n.b {\n  font-size: 12px;\n  --x: 12px;\n}\n`;
    const { css: out, changes } = convertCss(css, scales);
    expect(changes).toBe(2);
    expect(out).toContain('@media (max-width: 720px)');
    expect(out).toContain('.a:hover { padding: var(--pc-space-200); border: 1px solid; }');
    expect(out).toContain('font-size: var(--pc-font-size-200);');
    expect(out).toContain('--x: 12px;');
  });
});
