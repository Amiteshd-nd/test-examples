// Token lint (skill plancraft-ux-refine §3.7.4, founder-approved 2026-11-06): the frontend may
// not write raw colours, spacing off the space scale, or text sizes off the type scale or under
// the 11 px floor. The scales come from design/tokens/base; exceptions, each with a reason, from
// design/tokens/lint-allow.json. Run by `npm test` (tools/tokens/lint.test.ts).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COLOUR_IN_TEXT, readSources, type Decl } from '../as-built/static.ts';
import { SCALABLE, isHairline } from './rem-codemod.ts';

export type Kind = 'colour' | 'spacing' | 'font-size' | 'px';

export interface Violation {
  at: string;
  kind: Kind;
  prop: string;
  selector: string;
  value: string;
}

export interface AllowRule {
  file: string;
  selector?: string;
  value?: string;
  kinds: Kind[];
  reason: string;
  until?: string;
}

export interface Scales {
  space: number[];
  fontSizes: number[];
}

/** Files the lint does not read: the generated token files and tests. */
const SKIP = /design\/tokens\.(css|ts)$|\.test\.tsx?$/;
const SPACING = /^(padding|margin|gap|row-gap|column-gap|inset)/;
const NOT_COLOURS = new Set(['transparent']);

/** Drop var(…) references (they are tokens) before looking for raw values. */
const withoutVars = (v: string) => v.replace(/var\([^()]*(\([^()]*\))?[^()]*\)/g, '');

export function findViolations(decls: Decl[], scales: Scales): Violation[] {
  const out: Violation[] = [];
  for (const d of decls) {
    if (SKIP.test(d.file)) continue;
    const plain = withoutVars(d.value);
    const push = (kind: Kind, value: string) =>
      out.push({ at: `${d.file}:${d.line}`, kind, prop: d.prop, selector: d.selector, value });
    for (const m of plain.matchAll(COLOUR_IN_TEXT)) {
      if (!NOT_COLOURS.has(m[0].toLowerCase())) push('colour', m[0]);
    }
    // Lengths in px or rem; values are reported in px so allow rules read the same either way.
    const lengths = [...plain.matchAll(/(?<![\w.#-])(-?\d*\.?\d+)(px|rem)\b/g)].map((m) => ({
      raw: m[0],
      unit: m[2]!,
      px: Math.abs(parseFloat(m[1]!) * (m[2] === 'rem' ? 16 : 1)),
    }));
    if (SPACING.test(d.prop)) {
      // 1 px is a hairline (border overlap or gap), not a spacing step.
      for (const l of lengths) {
        if (l.px !== 1 && !scales.space.includes(l.px)) push('spacing', `${l.px}px`);
      }
    }
    if (d.prop === 'font-size') {
      for (const l of lengths) if (!scales.fontSizes.includes(l.px)) push('font-size', `${l.px}px`);
    }
    // Sizes that should follow Settings → Text size may not be px (DS-03). Transforms: only
    // translate() lengths count (perspective is a 3D distance).
    if (SCALABLE.test(d.prop)) {
      const scoped =
        d.prop === 'transform'
          ? [...plain.matchAll(/translate[XYZ3d]*\([^()]*\)/g)].join(' ')
          : plain;
      for (const m of scoped.matchAll(/(?<![\w.#-])(-?\d*\.?\d+)px\b/g)) {
        if (!isHairline(parseFloat(m[1]!))) push('px', m[0]);
      }
    }
  }
  return out;
}

export function allowed(v: Violation, rule: AllowRule): boolean {
  return (
    rule.kinds.includes(v.kind) &&
    v.at.startsWith(rule.file) &&
    (rule.value === undefined || rule.value.toLowerCase() === v.value.toLowerCase()) &&
    (rule.selector === undefined || new RegExp(rule.selector).test(v.selector))
  );
}

/** Violations no rule allows, and the rules nothing needs any more (to clean up). */
export function applyAllow(
  violations: Violation[],
  rules: AllowRule[],
): { left: Violation[]; unused: AllowRule[] } {
  const used = new Set<AllowRule>();
  const left = violations.filter((v) => {
    const rule = rules.find((r) => allowed(v, r));
    if (rule) used.add(rule);
    return !rule;
  });
  return { left, unused: rules.filter((r) => !used.has(r)) };
}

const px = (v: unknown) => parseFloat(String((v as { $value: string }).$value));
const steps = (group: Record<string, unknown>) =>
  Object.entries(group)
    .filter(([k]) => !k.startsWith('$'))
    .map(([, v]) => px(v));

export function readScales(root: string): Scales {
  const json = (p: string) =>
    JSON.parse(readFileSync(join(root, p), 'utf8')) as Record<string, Record<string, unknown>>;
  return {
    space: steps(json('design/tokens/base/space.json').space!),
    fontSizes: steps(json('design/tokens/base/type.json').font!.size as Record<string, unknown>),
  };
}

export function lintRepo(root: string): { left: Violation[]; unused: AllowRule[] } {
  const { decls } = readSources(root);
  const rules = (
    JSON.parse(readFileSync(join(root, 'design/tokens/lint-allow.json'), 'utf8')) as {
      rules: AllowRule[];
    }
  ).rules;
  return applyAllow(
    findViolations(
      decls.filter((d) => d.file.startsWith('frontend/')),
      readScales(root),
    ),
    rules,
  );
}

const HINT: Record<Kind, string> = {
  colour: 'use a colour token (design/tokens/TOKEN-INDEX.md), e.g. var(--pc-color-text-secondary)',
  spacing: 'use a step of the space scale, e.g. var(--pc-space-200) (8 px)',
  'font-size': 'use the type scale (11, 12, 13, 15, 22, 24, 40 px), e.g. var(--pc-font-size-200)',
  px: 'use a token or rem so Settings → Text size reaches it (e.g. var(--pc-space-200), 1.5rem); `node tools/tokens/rem-codemod.ts <file>` converts a stylesheet',
};

export function explain(left: Violation[]): string {
  return left
    .map((v) => `${v.at} (${v.selector || v.prop}) ${v.prop}: ${v.value} — ${HINT[v.kind]}`)
    .concat(
      left.length
        ? [
            'If a raw value truly has to stay, add an entry with a reason to design/tokens/lint-allow.json.',
          ]
        : [],
    )
    .join('\n');
}
