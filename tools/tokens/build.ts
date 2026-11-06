// Design-token build (skill plancraft-ux-refine §3.1–§3.3): reads the DTCG-style JSON in
// design/tokens/ (base → semantic → component), checks it, resolves aliases per theme and writes
// CSS variables (`--pc-…`) and typed constants for canvas code. No packages beyond Prettier.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export type Tier = 'base' | 'semantic' | 'component';
export type Theme = 'light' | 'dark';

export interface Token {
  path: string;
  type: string;
  value: unknown;
  description?: string;
  tier: Tier;
  file: string;
}

export interface TokenSystem {
  /** Theme-independent tokens: base, semantic/common, component. */
  shared: Map<string, Token>;
  light: Map<string, Token>;
  dark: Map<string, Token>;
  /** Old CSS variable → token path, emitted as aliases. */
  deprecated: Record<string, string>;
}

const ALIAS = /\{([^{}]+)\}/g;

/** DTCG tree → tokens (an object with `$value` is a token; other `$` keys are group metadata). */
export function flatten(obj: unknown, tier: Tier, file: string, prefix: string[] = []): Token[] {
  if (typeof obj !== 'object' || obj === null) return [];
  const o = obj as Record<string, unknown>;
  if ('$value' in o) {
    return [
      {
        path: prefix.join('.'),
        type: String(o.$type ?? ''),
        value: o.$value,
        description: typeof o.$description === 'string' ? o.$description : undefined,
        tier,
        file,
      },
    ];
  }
  return Object.entries(o)
    .filter(([k]) => !k.startsWith('$'))
    .flatMap(([k, v]) => flatten(v, tier, file, [...prefix, k]));
}

const readJson = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'));
const jsonFiles = (dir: string) =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => join(dir, f));

export function loadTokenSystem(dir: string): TokenSystem {
  const rel = (p: string) => p.slice(dir.length + 1);
  const shared: Token[] = [
    ...jsonFiles(join(dir, 'base')).flatMap((f) => flatten(readJson(f), 'base', rel(f))),
    ...flatten(readJson(join(dir, 'semantic/common.json')), 'semantic', 'semantic/common.json'),
    ...jsonFiles(join(dir, 'component')).flatMap((f) => flatten(readJson(f), 'component', rel(f))),
  ];
  const theme = (t: Theme) =>
    flatten(
      readJson(join(dir, `semantic/theme.${t}.json`)),
      'semantic',
      `semantic/theme.${t}.json`,
    );
  const deprecated = Object.fromEntries(
    Object.entries(readJson(join(dir, 'deprecated.json')) as Record<string, string>).filter(
      ([k]) => !k.startsWith('$'),
    ),
  );
  return makeSystem(shared, theme('light'), theme('dark'), deprecated);
}

export function makeSystem(
  shared: Token[],
  light: Token[],
  dark: Token[],
  deprecated: Record<string, string> = {},
): TokenSystem {
  const map = (list: Token[]) => new Map(list.map((t) => [t.path, t]));
  return { shared: map(shared), light: map(light), dark: map(dark), deprecated };
}

export function lookup(sys: TokenSystem, path: string, theme: Theme): Token | undefined {
  return (theme === 'light' ? sys.light : sys.dark).get(path) ?? sys.shared.get(path);
}

export const allPaths = (sys: TokenSystem) => [
  ...new Set([...sys.shared.keys(), ...sys.light.keys(), ...sys.dark.keys()]),
];

const aliasesIn = (v: unknown): string[] =>
  typeof v === 'string'
    ? [...v.matchAll(ALIAS)].map((m) => m[1]!)
    : typeof v === 'object' && v !== null && !Array.isArray(v)
      ? Object.values(v).flatMap(aliasesIn)
      : [];

/** Problems that must stop the build: duplicates, theme gaps, unknown aliases, cycles, base used by deprecated names. */
export function validate(sys: TokenSystem, shared: Token[] = [...sys.shared.values()]): string[] {
  const errors: string[] = [];
  const seen = new Map<string, string>();
  for (const t of shared) {
    if (seen.has(t.path))
      errors.push(`${t.path} is defined twice (${seen.get(t.path)}, ${t.file})`);
    seen.set(t.path, t.file);
  }
  for (const p of sys.light.keys()) {
    if (!sys.dark.has(p)) errors.push(`${p} is in the light theme but not the dark one`);
    if (sys.shared.has(p)) errors.push(`${p} is both themed and shared`);
  }
  for (const p of sys.dark.keys())
    if (!sys.light.has(p)) errors.push(`${p} is in the dark theme but not the light one`);
  for (const theme of ['light', 'dark'] as const) {
    for (const path of allPaths(sys)) {
      const visit = (p: string, chain: string[]) => {
        const t = lookup(sys, p, theme);
        if (!t) {
          errors.push(`${chain.at(-2) ?? p} → {${p}}: no such token (${theme})`);
          return;
        }
        for (const a of aliasesIn(t.value)) {
          if (chain.includes(a)) errors.push(`alias cycle: ${[...chain, a].join(' → ')}`);
          else visit(a, [...chain, a]);
        }
      };
      visit(path, [path]);
    }
  }
  for (const [name, path] of Object.entries(sys.deprecated)) {
    if (!lookup(sys, path, 'light')) errors.push(`deprecated ${name} → ${path}: no such token`);
  }
  return [...new Set(errors)];
}

export const cssVar = (path: string) => `--pc-${path.replace(/\./g, '-')}`;

const GENERIC = new Set([
  'system-ui',
  '-apple-system',
  'sans-serif',
  'serif',
  'monospace',
  'ui-monospace',
]);
const family = (v: unknown) =>
  (Array.isArray(v) ? v : [v])
    .map((f) => (GENERIC.has(String(f)) ? String(f) : `'${String(f)}'`))
    .join(', ');

/**
 * Tokens that follow the UI scale (Settings → Text size, DS-03): text, spacing, control and panel
 * sizes are written in rem, so the root font size scales them (code reads them in px with
 * `cssPx`). Hairlines, borders, radii and shadows stay in px.
 */
export const scalesWithUi = (path: string) =>
  /^(space|size|font\.size|font\.line-height)\./.test(path);

/** 8px → 0.5rem (16 px root at 100 %). */
export const pxToRem = (px: number) => `${Number((px / 16).toFixed(4))}rem`;

/** A token's value as CSS: aliases become var() references, so themes switch by semantics alone. */
export function cssValue(t: Token): string {
  const sub = (s: string) => s.replace(ALIAS, (_, p: string) => `var(${cssVar(p)})`);
  if (t.type === 'dimension' && scalesWithUi(t.path)) {
    const m = /^(-?\d*\.?\d+)px$/.exec(String(t.value));
    if (m && parseFloat(m[1]!) !== 0) return pxToRem(parseFloat(m[1]!));
  }
  if (t.type === 'fontFamily')
    return Array.isArray(t.value) ? family(t.value) : sub(String(t.value));
  if (t.type === 'typography') {
    const v = t.value as Record<string, string>;
    return sub(`${v.fontWeight} ${v.fontSize}/${v.lineHeight} ${v.fontFamily}`);
  }
  return sub(String(t.value));
}

/** CSS declarations for one token (typography adds a `-tracking` variable for letter-spacing). */
export function cssDecls(t: Token): string[] {
  const v = cssValue(t);
  const out = [`${cssVar(t.path)}: ${v};${v.endsWith('rem') ? ` /* ${String(t.value)} */` : ''}`];
  if (t.type === 'typography') {
    const ls = (t.value as Record<string, string>).letterSpacing;
    if (ls)
      out.push(`${cssVar(t.path)}-tracking: ${cssValue({ ...t, type: 'dimension', value: ls })};`);
  }
  return out;
}

/** Fully resolved value for one theme (aliases followed to the end). */
export function resolveValue(sys: TokenSystem, path: string, theme: Theme, depth = 0): string {
  const t = lookup(sys, path, theme);
  if (!t || depth > 20) throw new Error(`cannot resolve ${path}`);
  const sub = (s: string) =>
    s.replace(ALIAS, (_, p: string) => resolveValue(sys, p, theme, depth + 1));
  if (t.type === 'fontFamily')
    return Array.isArray(t.value) ? family(t.value) : sub(String(t.value));
  if (t.type === 'typography') {
    const v = t.value as Record<string, string>;
    return sub(`${v.fontWeight} ${v.fontSize}/${v.lineHeight} ${v.fontFamily}`);
  }
  return sub(String(t.value));
}

/** Alias chain for display: color.text.secondary → color.neutral.600 → #656571. */
export function chain(sys: TokenSystem, path: string, theme: Theme): string[] {
  const out = [path];
  let t = lookup(sys, path, theme);
  while (t && typeof t.value === 'string' && /^\{[^{}]+\}$/.test(t.value) && out.length < 20) {
    const next = t.value.slice(1, -1);
    out.push(next);
    t = lookup(sys, next, theme);
  }
  out.push(resolveValue(sys, path, theme));
  return out;
}

const HEADER = `/* GENERATED by tools/tokens-build.ts from design/tokens/*.json: do not edit by hand.
   Change the JSON, then run \`npm run tokens\`. Index: design/tokens/TOKEN-INDEX.md.
   Light is the default; dark is html[data-theme="dark"]. Components use semantic and component
   tokens only (--pc-color-…, --pc-icon-…), never base steps or raw values.
   Fonts: Geist and Geist Mono (SIL OFL 1.1), bundled from @fontsource-variable. */`;

export function buildCss(sys: TokenSystem): string {
  const group = (tier: Tier, list: Token[]) =>
    list.filter((t) => t.tier === tier).flatMap(cssDecls);
  const shared = [...sys.shared.values()];
  const lines = [
    HEADER,
    `@import '@fontsource-variable/geist';`,
    `@import '@fontsource-variable/geist-mono';`,
    '',
    ':root {',
    'color-scheme: light;',
    '/* Base */',
    ...group('base', shared),
    '/* Semantic */',
    ...group('semantic', shared),
    '/* Semantic, light theme */',
    ...[...sys.light.values()].flatMap(cssDecls),
    '/* Component */',
    ...group('component', shared),
    '/* Deprecated aliases (one release; new CSS uses the --pc- names) */',
    ...Object.entries(sys.deprecated).map(([name, path]) => `${name}: var(${cssVar(path)});`),
    '}',
    '',
    ":root[data-theme='dark'] {",
    'color-scheme: dark;',
    ...[...sys.dark.values()].flatMap(cssDecls),
    '}',
    '',
  ];
  return lines.join('\n');
}

/** Typed, resolved values of the semantic and component tokens, for canvas and three.js code. */
export function buildTs(sys: TokenSystem): string {
  const paths = allPaths(sys)
    .filter((p) => lookup(sys, p, 'light')!.tier !== 'base')
    .sort();
  const obj = (theme: Theme) =>
    `{\n${paths.map((p) => `    '${p}': ${JSON.stringify(resolveValue(sys, p, theme))},`).join('\n')}\n  }`;
  return `// GENERATED by tools/tokens-build.ts from design/tokens/*.json: do not edit by hand.
// Resolved token values for code that cannot read CSS variables (canvas, three.js). In the DOM,
// prefer the CSS variables: \`var(--pc-color-text-primary)\` follows the theme by itself.

export const tokens = {
  light: ${obj('light')},
  dark: ${obj('dark')},
} as const;

export type TokenName = keyof (typeof tokens)['light'];

/** The CSS variable of a token, e.g. cssVar('icon.accent') → 'var(--pc-icon-accent)'. */
export const cssVar = (name: TokenName): string => \`var(--pc-\${name.replace(/\\./g, '-')})\`;
`;
}
