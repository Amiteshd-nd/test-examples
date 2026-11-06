import { describe, expect, it } from 'vitest';
import {
  buildCss,
  buildTs,
  chain,
  cssDecls,
  flatten,
  makeSystem,
  resolveValue,
  validate,
  type Token,
} from './build.ts';

const base = flatten(
  {
    color: {
      $description: 'palette',
      neutral: {
        0: { $type: 'color', $value: '#ffffff' },
        950: { $type: 'color', $value: '#111114' },
      },
    },
    space: { 100: { $type: 'dimension', $value: '4px' } },
    font: {
      family: { sans: { $type: 'fontFamily', $value: ['Geist Variable', 'system-ui'] } },
      size: { 300: { $type: 'dimension', $value: '13px' } },
    },
  },
  'base',
  'base/x.json',
);
const common = flatten(
  {
    type: {
      body: {
        $type: 'typography',
        $value: {
          fontFamily: '{font.family.sans}',
          fontSize: '{font.size.300}',
          lineHeight: '18px',
          fontWeight: 400,
          letterSpacing: '0.06em',
        },
      },
    },
  },
  'semantic',
  'semantic/common.json',
);
const theme = (text: string): Token[] =>
  flatten(
    { color: { text: { primary: { $type: 'color', $value: text } } } },
    'semantic',
    'semantic/theme.json',
  );
const icon = flatten(
  { icon: { line: { $type: 'color', $value: '{color.text.primary}' } } },
  'component',
  'component/icon.json',
);
const sys = makeSystem(
  [...base, ...common, ...icon],
  theme('{color.neutral.950}'),
  theme('{color.neutral.0}'),
  {
    '--text': 'color.text.primary',
  },
);

describe('token build', () => {
  it('flattens DTCG groups into dotted paths and skips group metadata', () => {
    expect(base.map((t) => t.path)).toEqual([
      'color.neutral.0',
      'color.neutral.950',
      'space.100',
      'font.family.sans',
      'font.size.300',
    ]);
  });

  it('accepts a consistent system and resolves aliases per theme', () => {
    expect(validate(sys)).toEqual([]);
    expect(resolveValue(sys, 'icon.line', 'light')).toBe('#111114');
    expect(resolveValue(sys, 'icon.line', 'dark')).toBe('#ffffff');
    expect(chain(sys, 'icon.line', 'light')).toEqual([
      'icon.line',
      'color.text.primary',
      'color.neutral.950',
      '#111114',
    ]);
  });

  it('reports unknown aliases, cycles, theme gaps, duplicates and bad deprecated names', () => {
    const loop = flatten(
      {
        a: { $type: 'color', $value: '{b}' },
        b: { $type: 'color', $value: '{a}' },
        c: { $type: 'color', $value: '{nope}' },
      },
      'semantic',
      'x.json',
    );
    const bad = makeSystem([...base, ...base.slice(0, 1), ...loop], theme('#000'), [], {
      '--gone': 'no.such',
    });
    const errors = validate(bad, [...base, ...base.slice(0, 1), ...loop]).join('\n');
    expect(errors).toContain('color.neutral.0 is defined twice');
    expect(errors).toContain('alias cycle');
    expect(errors).toContain('{nope}: no such token');
    expect(errors).toContain('color.text.primary is in the light theme but not the dark one');
    expect(errors).toContain('deprecated --gone');
  });

  it('writes CSS with var() aliases, a dark block, typography shorthands and deprecated aliases', () => {
    const css = buildCss(sys);
    expect(css).toContain('--pc-icon-line: var(--pc-color-text-primary);');
    expect(css).toContain("--pc-font-family-sans: 'Geist Variable', system-ui;");
    expect(css).toMatch(
      /:root\[data-theme='dark'\] \{\ncolor-scheme: dark;\n--pc-color-text-primary: var\(--pc-color-neutral-0\);/,
    );
    expect(css).toContain('--text: var(--pc-color-text-primary);');
    expect(cssDecls(common[0]!)).toEqual([
      '--pc-type-body: 400 var(--pc-font-size-300)/18px var(--pc-font-family-sans);',
      '--pc-type-body-tracking: 0.06em;',
    ]);
  });

  it('writes UI-scaled sizes in rem (with the px in a comment) and keeps borders in px', () => {
    const sized = flatten(
      {
        space: {
          200: { $type: 'dimension', $value: '8px' },
          0: { $type: 'dimension', $value: '0px' },
        },
        size: { panel: { left: { $type: 'dimension', $value: '280px' } } },
        border: { width: { 100: { $type: 'dimension', $value: '1px' } } },
      },
      'base',
      'base/x.json',
    );
    expect(sized.flatMap(cssDecls)).toEqual([
      '--pc-space-0: 0px;',
      '--pc-space-200: 0.5rem; /* 8px */',
      '--pc-size-panel-left: 17.5rem; /* 280px */',
      '--pc-border-width-100: 1px;',
    ]);
  });

  it('writes typed resolved values for semantic and component tokens only', () => {
    const ts = buildTs(sys);
    expect(ts).toContain(`'icon.line': "#111114"`);
    expect(ts).toContain(`'icon.line': "#ffffff"`);
    expect(ts).not.toContain(`'color.neutral.0'`);
  });
});
