import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Decl } from '../as-built/static.ts';
import { applyAllow, explain, findViolations, lintRepo, type AllowRule } from './lint.ts';

const decl = (file: string, selector: string, prop: string, value: string): Decl => ({
  file,
  line: 1,
  selector,
  media: '',
  prop,
  value,
  source: file.endsWith('.css') ? 'css' : 'tsx',
  theme: 'both',
});
const scales = {
  space: [0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64],
  fontSizes: [11, 12, 13, 15, 22, 24, 40],
};

describe('token lint rules', () => {
  it('flags raw colours but not tokens or transparent', () => {
    const v = findViolations(
      [
        decl('frontend/src/a.css', '.a', 'color', '#fff'),
        decl('frontend/src/a.css', '.b', 'box-shadow', '0 1px 2px rgba(0, 0, 0, 0.1)'),
        decl(
          'frontend/src/a.css',
          '.c',
          'background',
          'color-mix(in srgb, var(--pc-color-accent-default) 20%, transparent)',
        ),
        decl('frontend/src/a.tsx', '<span style>', 'background', 'var(--pc-avatar-local-bg)'),
      ],
      scales,
    );
    expect(v.map((x) => x.value)).toEqual(['#fff', 'rgba(0, 0, 0, 0.1)']);
  });

  it('flags spacing off the scale (1 px hairlines allowed) and text off the type scale', () => {
    const v = findViolations(
      [
        decl('frontend/src/a.css', '.a', 'padding', '1px 6px 10px var(--pc-space-200)'),
        decl('frontend/src/a.css', '.b', 'margin', '-1px 0 -6px'),
        decl('frontend/src/a.css', '.c', 'font-size', '10px'),
        decl('frontend/src/a.css', '.d', 'font-size', '13px'),
      ],
      scales,
    );
    expect(v.map((x) => `${x.kind} ${x.value}`)).toEqual([
      'spacing 10px',
      'px 6px',
      'px 10px',
      'px -6px',
      'font-size 10px',
      'px 10px',
      'px 13px',
    ]);
  });

  it('accepts rem and tokens for sizes, judging rem against the scales in px', () => {
    const v = findViolations(
      [
        decl('frontend/src/a.css', '.a', 'padding', '0.5rem 1.125rem var(--pc-space-200)'),
        decl('frontend/src/a.css', '.b', 'font-size', '0.8125rem'),
        decl('frontend/src/a.css', '.c', 'height', '3rem'),
        decl('frontend/src/a.css', '.d', 'transform', 'perspective(300px) translateY(-6px)'),
        decl('frontend/src/a.css', '.e', 'border-radius', '8px'),
      ],
      scales,
    );
    expect(v.map((x) => `${x.kind} ${x.value}`)).toEqual(['spacing 18px', 'px -6px']);
  });

  it('skips the generated token files and tests', () => {
    expect(
      findViolations(
        [
          decl('frontend/src/design/tokens.css', ':root', '--pc-x', '#fff'),
          decl('frontend/src/design/tokens.ts', 'literal', 'literal', '#fff'),
          decl('frontend/src/a.test.ts', 'literal', 'literal', '#fff'),
        ],
        scales,
      ),
    ).toEqual([]);
  });

  it('applies allow rules by file, selector, value and kind, and reports unused rules', () => {
    const v = findViolations(
      [
        decl('frontend/src/vault/vault.css', '.fart-pill', 'color', '#fff'),
        decl('frontend/src/vault/vault.css', '.vlt-x', 'color', '#fff'),
      ],
      scales,
    );
    const rules: AllowRule[] = [
      {
        file: 'frontend/src/vault/vault.css',
        selector: '^\\.fart',
        kinds: ['colour'],
        reason: 'art',
      },
      { file: 'frontend/src/editor/', kinds: ['colour'], reason: 'unused' },
    ];
    const { left, unused } = applyAllow(v, rules);
    expect(left.map((x) => x.selector)).toEqual(['.vlt-x']);
    expect(unused.map((r) => r.reason)).toEqual(['unused']);
    expect(explain(left)).toContain('lint-allow.json');
  });
});

describe('token lint on the repo', () => {
  it('finds no raw colours, off-scale spacing or off-scale text outside the allow list', () => {
    const { left } = lintRepo(fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, ''));
    expect(left, explain(left)).toEqual([]);
  });
});
