// Turns the static declarations and runtime samples into the as-built index (skill §3.6 step 2):
// colours by family with roles, themes and near-duplicates; contrast pairs; type, spacing and the
// other scales, each value with its usage count and file:line locations.
import {
  contrast,
  deltaE2000,
  family,
  parseColour,
  shortHex,
  toHex8,
  toLab,
  type Rgba,
} from './colour.ts';
import type { Sample } from './runtime.ts';
import {
  COLOUR_IN_TEXT,
  collectTokens,
  resolve,
  resolveScoped,
  splitTop,
  type Decl,
  type Theme,
  type TokenSet,
} from './static.ts';

export interface Loc {
  at: string;
  prop: string;
  selector: string;
  via: string[];
  theme: Theme | 'fixed';
}

export interface Entry {
  value: string;
  uses: Loc[];
  runtime: { light: number; dark: number };
  samples: string[];
  notes: string[];
}

export interface ColourEntry extends Entry {
  /** Only produced by color-mix() or a gradient stop computed from other colours, never written. */
  derived: boolean;
  family: string;
  lightness: number;
  alpha: number;
  roles: string[];
  tokens: string[];
  defs: Loc[];
  nearDuplicates: { value: string; deltaE: number }[];
}

export interface PairEntry {
  theme: Theme;
  fg: string;
  bg: string;
  ratio: number;
  minSize: number;
  large: boolean;
  pass: boolean;
  overImage: boolean;
  n: number;
  screens: string[];
  samples: string[];
}

export interface TokenContrast {
  theme: Theme;
  fg: string;
  bg: string;
  ratio: number;
  need: number;
}

export interface Index {
  generated: string;
  files: string[];
  screens: { screen: string; theme: Theme; url: string; elements: number }[];
  rootFontSize: string;
  tokens: {
    light: Record<string, string>;
    dark: Record<string, string>;
    defined: Record<string, string[]>;
  };
  colours: ColourEntry[];
  transparentUses: number;
  tokenContrast: TokenContrast[];
  pairs: PairEntry[];
  fontFamilies: Entry[];
  fontSizes: (Entry & {
    px: number;
    weights: string[];
    lineHeights: string[];
    letterSpacing: string[];
  })[];
  textStyles: Entry[];
  typeRatios: { from: number; to: number; ratio: number }[];
  typeScaleFit: { ratio: number; name: string; matches: number; off: number[] }[];
  spacing: (Entry & { px: number; on4: boolean; on8: boolean; kinds: string[] })[];
  spacingShare: { on2: number; on4: number; on8: number; total: number };
  /** Runtime margins dropped as `margin: auto` centring (non-integer or > 64 px). */
  autoMargins: number;
  radii: Entry[];
  borders: Entry[];
  shadows: Entry[];
  blur: Entry[];
  opacity: Entry[];
  durations: Entry[];
  easings: Entry[];
  zIndex: Entry[];
  breakpoints: Entry[];
  sizes: Entry[];
  controlHeights: Entry[];
  iconSizes: Entry[];
  strokeWidths: Entry[];
  smallTargets: Entry[];
}

const THEMES: Theme[] = ['light', 'dark'];
const at = (d: Decl) => `${d.file}:${d.line}`;

class Table<E extends Entry> {
  readonly map = new Map<string, E>();
  private make: (value: string) => E;
  constructor(make: (value: string) => E) {
    this.make = make;
  }
  get(value: string): E {
    let e = this.map.get(value);
    if (!e) this.map.set(value, (e = this.make(value)));
    return e;
  }
  use(value: string, loc: Loc) {
    const e = this.get(value);
    if (!e.uses.some((u) => u.at === loc.at && u.theme === loc.theme && u.prop === loc.prop))
      e.uses.push(loc);
  }
  seen(value: string, theme: Theme, n: number, samples: string[]) {
    const e = this.get(value);
    e.runtime[theme] += n;
    for (const s of samples) if (e.samples.length < 6 && !e.samples.includes(s)) e.samples.push(s);
  }
  list(): E[] {
    return [...this.map.values()];
  }
}

const entry = (value: string): Entry => ({
  value,
  uses: [],
  runtime: { light: 0, dark: 0 },
  samples: [],
  notes: [],
});
const total = (e: Entry) => e.uses.length + e.runtime.light + e.runtime.dark;

function themesOf(d: Decl): (Theme | 'fixed')[] {
  if (d.source !== 'css' && !d.value.includes('var(')) return ['fixed'];
  return d.theme === 'both' ? THEMES : [d.theme];
}

function variants(
  d: Decl,
  tokens: TokenSet,
): { theme: Theme | 'fixed'; text: string; via: string[] }[] {
  return themesOf(d).flatMap((theme) =>
    resolveScoped(d.value, theme === 'fixed' ? 'light' : theme, tokens).map((r) => ({
      theme,
      ...r,
    })),
  );
}

function colourRole(prop: string, file: string, selector: string): string {
  if (/^(color|caret-color|-webkit-text-fill-color|text-decoration)/.test(prop)) return 'text';
  if (prop.startsWith('background')) return 'background';
  if (/^(border|outline|column-rule)/.test(prop)) return 'border';
  if (prop.includes('shadow')) return 'shadow';
  if (/^(fill|stroke|stop-color)/.test(prop))
    return /PlanView|PlanThumbnail|Canvas|thumbnail|folder-art/.test(file) ||
      /plan|canvas|wall|room|thumb|paper|pv-/.test(selector)
      ? 'canvas'
      : 'icon';
  if (prop === 'data-colour') return 'data';
  if (prop === 'accent-color') return 'control';
  return 'other';
}

/** px number of a length token, or null (%, auto, calc…). rem uses the root font size. */
function toPx(token: string, rootPx: number): number | null {
  const t = token.trim();
  if (t === '0') return 0;
  const m = /^(-?\d*\.?\d+)(px|rem)$/.exec(t);
  if (!m) return null;
  return m[2] === 'rem' ? parseFloat(m[1]!) * rootPx : parseFloat(m[1]!);
}

const isLength = (t: string) => /^-?\d*\.?\d+(px|rem)$|^0$/.test(t.trim());

export function analyse(
  decls: Decl[],
  rules: { file: string; line: number; rule: string }[],
  files: string[],
  samples: Sample[],
): Index {
  const tokens = collectTokens(decls);
  const root = decls.find((d) => d.prop === 'font-size' && /\bhtml\b/.test(d.selector));
  const rootPx = root ? (toPx(root.value, 16) ?? 16) : 16;

  // Colours ---------------------------------------------------------------------------------
  const colours = new Table<ColourEntry>((value) => {
    const c = parseColour(value)!;
    return {
      ...entry(value),
      derived: true,
      family: family(c),
      lightness: Math.round(toLab(c)[0] * 10) / 10,
      alpha: Math.round(c[3] * 100) / 100,
      roles: [],
      tokens: [],
      defs: [],
      nearDuplicates: [],
    };
  });
  let transparentUses = 0;
  const addRole = (e: ColourEntry, r: string) => {
    if (!e.roles.includes(r)) e.roles.push(r);
  };
  const coloursIn = (text: string) =>
    [...text.matchAll(COLOUR_IN_TEXT)]
      .map((m) => parseColour(m[0]))
      .filter((c): c is Rgba => c !== null);

  for (const theme of THEMES) {
    for (const [name, raw] of theme === 'light' ? tokens.light : tokens.dark) {
      for (const r of resolve(raw, theme, tokens)) {
        for (const c of coloursIn(r.text)) {
          if (c[3] === 0) continue;
          const e = colours.get(toHex8(c));
          if (!raw.includes('color-mix')) e.derived = false;
          const label = `${name} (${theme})`;
          if (!e.tokens.includes(label)) e.tokens.push(label);
          const def = (tokens.defined.get(name) ?? [])[0] ?? '';
          e.defs.push({ at: def, prop: name, selector: ':root', via: r.via, theme });
        }
      }
    }
  }
  for (const [name, defs] of tokens.scoped) {
    for (const d of defs) {
      for (const c of coloursIn(d.value)) {
        if (c[3] === 0) continue;
        const e = colours.get(toHex8(c));
        e.derived = false;
        e.defs.push({ at: d.at, prop: name, selector: '(scoped)', via: [], theme: 'fixed' });
      }
    }
  }
  for (const d of decls) {
    if (d.prop.startsWith('--')) continue;
    for (const v of variants(d, tokens)) {
      for (const c of coloursIn(v.text)) {
        if (c[3] === 0) {
          transparentUses++;
          continue;
        }
        const e = colours.get(toHex8(c));
        if (!d.value.includes('color-mix')) e.derived = false;
        colours.use(e.value, {
          at: at(d),
          prop: d.prop,
          selector: d.selector,
          via: v.via,
          theme: v.theme,
        });
        addRole(e, colourRole(d.prop, d.file, d.selector));
      }
    }
  }
  const RUNTIME_ROLE: Record<string, string> = {
    'color:text': 'text',
    'color:background': 'background',
    'color:border': 'border',
    'color:outline': 'border',
    'color:svg-fill': 'svg',
    'color:svg-stroke': 'svg',
  };
  for (const s of samples) {
    for (const [bucket, role] of Object.entries(RUNTIME_ROLE)) {
      for (const [hex, v] of Object.entries(s.buckets[bucket] ?? {})) {
        if (hex.endsWith('00')) continue;
        colours.seen(
          hex,
          s.theme,
          v.n,
          v.s.map((x) => `${s.screen}: ${x}`),
        );
        addRole(colours.get(hex), `${role} (runtime)`);
        if (!colours.get(hex).uses.length) colours.get(hex).derived = false;
      }
    }
  }
  const colourList = colours.list();
  for (const a of colourList) {
    const ca = parseColour(a.value)!;
    for (const b of colourList) {
      if (a === b) continue;
      const cb = parseColour(b.value)!;
      if (Math.abs(ca[3] - cb[3]) > 0.05) continue;
      const dE = deltaE2000(toLab(ca), toLab(cb));
      if (dE < 2) a.nearDuplicates.push({ value: b.value, deltaE: Math.round(dE * 100) / 100 });
    }
  }
  colourList.sort(
    (a, b) => a.family.localeCompare(b.family) || b.lightness - a.lightness || b.alpha - a.alpha,
  );

  // Contrast ----------------------------------------------------------------------------------
  const tokenContrast: TokenContrast[] = [];
  const TEXT = [
    '--text',
    '--text-muted',
    '--text-faint',
    '--accent-strong',
    '--ok',
    '--warn',
    '--error',
  ];
  const BG = [
    '--bg',
    '--canvas',
    '--surface',
    '--surface-2',
    '--surface-3',
    '--accent-soft',
    '--accent-tint',
  ];
  const UI = ['--line-strong', '--line', '--accent', '--accent-strong', '--ink', '--canvas-dot'];
  for (const theme of THEMES) {
    const val = (n: string) => parseColour(resolve(`var(${n})`, theme, tokens)[0]!.text);
    const pair = (fg: string, bg: string, need: number) => {
      const f = val(fg);
      const b = val(bg);
      if (f && b)
        tokenContrast.push({ theme, fg, bg, ratio: Math.round(contrast(f, b) * 100) / 100, need });
    };
    for (const fg of TEXT) for (const bg of BG) pair(fg, bg, 4.5);
    pair('--on-ink', '--ink', 4.5);
    for (const fg of UI)
      for (const bg of ['--bg', '--canvas', '--surface', '--surface-2']) pair(fg, bg, 3);
  }
  const pairs = new Map<string, PairEntry>();
  for (const s of samples) {
    for (const [key, v] of Object.entries(s.buckets['pair'] ?? {})) {
      const [fg, bg, ratio, size, weight, flag] = key.split('|');
      const k = `${s.theme}|${fg}|${bg}`;
      const px = parseFloat(size!);
      const large = px >= 24 || (px >= 18.66 && parseInt(weight!, 10) >= 700);
      let p = pairs.get(k);
      if (!p) {
        p = {
          theme: s.theme,
          fg: fg!,
          bg: bg!,
          ratio: parseFloat(ratio!),
          minSize: px,
          large,
          pass: true,
          overImage: false,
          n: 0,
          screens: [],
          samples: [],
        };
        pairs.set(k, p);
      }
      p.n += v.n;
      p.minSize = Math.min(p.minSize, px);
      p.large = p.large && large;
      p.pass = p.ratio >= (p.large ? 3 : 4.5);
      p.overImage ||= flag === 'over-image';
      if (!p.screens.includes(s.screen)) p.screens.push(s.screen);
      for (const x of v.s) if (p.samples.length < 4 && !p.samples.includes(x)) p.samples.push(x);
    }
  }
  const pairList = [...pairs.values()].sort(
    (a, b) => Number(a.pass) - Number(b.pass) || a.ratio - b.ratio,
  );

  // Generic value tables ----------------------------------------------------------------------
  const runtimeInto = <E extends Entry>(
    table: Table<E>,
    bucket: string,
    map: (v: string) => string | null = (v) => v,
  ) => {
    for (const s of samples) {
      for (const [value, v] of Object.entries(s.buckets[bucket] ?? {})) {
        const key = map(value);
        if (key !== null)
          table.seen(
            key,
            s.theme,
            v.n,
            v.s.map((x) => `${s.screen}: ${x}`),
          );
      }
    }
  };
  const staticInto = <E extends Entry>(
    table: Table<E>,
    test: (d: Decl) => boolean,
    pick: (text: string, d: Decl) => string[],
  ) => {
    for (const d of decls) {
      if (d.prop.startsWith('--') || !test(d)) continue;
      for (const v of variants(d, tokens)) {
        for (const value of pick(v.text, d)) {
          table.use(value, {
            at: at(d),
            prop: d.prop,
            selector: d.selector,
            via: v.via,
            theme: v.theme,
          });
        }
      }
    }
  };
  const lengths = (text: string) =>
    splitTop(text, ' ')
      .filter(isLength)
      .map((t) => `${toPx(t, rootPx)}px`);

  // Type
  const families = new Table(entry);
  staticInto(
    families,
    (d) => d.prop === 'font-family',
    (t) => [splitTop(t, ',')[0]!.replace(/["']/g, '')],
  );
  runtimeInto(families, 'font-family');
  const sizeTable = new Table((value) => ({
    ...entry(value),
    px: parseFloat(value),
    weights: [] as string[],
    lineHeights: [] as string[],
    letterSpacing: [] as string[],
  }));
  const blocks = new Map<string, Decl[]>();
  for (const d of decls) {
    const k = `${d.file}|${d.selector}|${d.media}`;
    blocks.set(k, [...(blocks.get(k) ?? []), d]);
  }
  staticInto(
    sizeTable,
    (d) => d.prop === 'font-size',
    (t) => lengths(t),
  );
  for (const e of sizeTable.list()) {
    for (const u of e.uses) {
      const file = u.at.slice(0, u.at.lastIndexOf(':'));
      for (const d of [...blocks.entries()].find(([k]) =>
        k.startsWith(`${file}|${u.selector}|`),
      )?.[1] ?? []) {
        const add = (list: string[], v: string) => {
          if (!list.includes(v)) list.push(v);
        };
        if (d.prop === 'font-weight') add(e.weights, d.value);
        if (d.prop === 'line-height') add(e.lineHeights, d.value);
        if (d.prop === 'letter-spacing') add(e.letterSpacing, d.value);
      }
    }
  }
  runtimeInto(sizeTable, 'font-size');
  const textStyles = new Table(entry);
  runtimeInto(textStyles, 'text-style');
  const fontSizes = sizeTable.list().sort((a, b) => a.px - b.px);
  const uiSizes = fontSizes
    .map((f) => f.px)
    .filter((px, i, all) => px > 0 && all.indexOf(px) === i);
  const typeRatios = uiSizes.slice(1).map((to, i) => ({
    from: uiSizes[i]!,
    to,
    ratio: Math.round((to / uiSizes[i]!) * 1000) / 1000,
  }));
  const body = 13;
  const typeScaleFit = [
    { ratio: 1.125, name: 'major second' },
    { ratio: 1.2, name: 'minor third' },
    { ratio: 1.25, name: 'major third' },
    { ratio: 1.333, name: 'perfect fourth' },
  ].map((s) => {
    const steps = Array.from({ length: 16 }, (_, k) => body * s.ratio ** (k - 4));
    const off = uiSizes.filter((px) => !steps.some((st) => Math.abs(st - px) <= 0.5));
    return { ...s, matches: uiSizes.length - off.length, off };
  });

  // Spacing
  const SPACING = /^(padding|margin|gap|row-gap|column-gap|inset)/;
  const spaceTable = new Table((value) => ({
    ...entry(value),
    px: parseFloat(value),
    on4: false,
    on8: false,
    kinds: [] as string[],
  }));
  staticInto(
    spaceTable,
    (d) => SPACING.test(d.prop),
    (t) => lengths(t),
  );
  let autoMargins = 0;
  for (const s of samples) {
    for (const bucket of ['padding', 'margin', 'gap']) {
      for (const [value, v] of Object.entries(s.buckets[bucket] ?? {})) {
        const px = parseFloat(value);
        if (bucket === 'margin' && (!Number.isInteger(px) || Math.abs(px) > 64)) {
          autoMargins += v.n; // margin: auto centring, not a spacing choice
          continue;
        }
        spaceTable.seen(
          value,
          s.theme,
          v.n,
          v.s.map((x) => `${s.screen}: ${bucket} ${x}`),
        );
        const e = spaceTable.get(value);
        if (!e.kinds.includes(`${bucket} (runtime)`)) e.kinds.push(`${bucket} (runtime)`);
      }
    }
  }
  const spacing = spaceTable.list().sort((a, b) => a.px - b.px);
  for (const e of spacing) {
    e.on4 = Math.abs(e.px) % 4 === 0;
    e.on8 = Math.abs(e.px) % 8 === 0;
    for (const u of e.uses) {
      const k = u.prop.replace(/-(top|right|bottom|left|inline|block)(-start|-end)?$/, '');
      if (!e.kinds.includes(k)) e.kinds.push(k);
    }
  }
  const staticSpace = spacing.flatMap((e) => e.uses.map(() => e.px)).filter((px) => px !== 0);
  const share = (n: number) => staticSpace.filter((px) => Math.abs(px) % n === 0).length;
  const spacingShare = { on2: share(2), on4: share(4), on8: share(8), total: staticSpace.length };

  // Other scales
  const radii = new Table(entry);
  staticInto(
    radii,
    (d) => /radius$/.test(d.prop) || d.prop === 'rx',
    (t) => [t],
  );
  runtimeInto(radii, 'radius');
  const borders = new Table(entry);
  staticInto(
    borders,
    (d) =>
      /^(border|outline)(-(top|right|bottom|left))?(-width)?$/.test(d.prop) ||
      d.prop === 'outline-offset',
    (t, d) => (d.prop === 'outline-offset' ? [`offset ${t}`] : lengths(t)),
  );
  runtimeInto(borders, 'border-width');
  runtimeInto(borders, 'outline');
  const shadows = new Table(entry);
  staticInto(
    shadows,
    (d) => /shadow$/.test(d.prop),
    (t) => (t === 'none' ? [] : [t]),
  );
  runtimeInto(shadows, 'shadow');
  const blur = new Table(entry);
  staticInto(
    blur,
    (d) => /filter$/.test(d.prop),
    (t) => [...t.matchAll(/(blur|saturate|drop-shadow)\([^)]*\)/g)].map((m) => m[0]),
  );
  runtimeInto(blur, 'backdrop-filter');
  runtimeInto(blur, 'filter');
  const opacity = new Table(entry);
  staticInto(
    opacity,
    (d) => /(^|-)opacity$/.test(d.prop),
    (t, d) => [`${d.prop === 'opacity' ? '' : `${d.prop} `}${t}`],
  );
  runtimeInto(opacity, 'opacity');
  const durations = new Table(entry);
  const easings = new Table(entry);
  const MOTION = (d: Decl) => /^(transition|animation)/.test(d.prop);
  staticInto(durations, MOTION, (t) =>
    [...t.matchAll(/(?<![\w.-])(\d*\.?\d+)(ms|s)\b/g)].map(
      (m) => `${m[2] === 's' ? parseFloat(m[1]!) * 1000 : parseFloat(m[1]!)}ms`,
    ),
  );
  staticInto(easings, MOTION, (t) =>
    [
      ...t.matchAll(
        /\b(ease-in-out|ease-in|ease-out|ease|linear|cubic-bezier\([^)]*\)|steps\([^)]*\))/g,
      ),
    ].map((m) => m[1]!),
  );
  for (const s of samples) {
    for (const [value, v] of Object.entries(s.buckets['transition'] ?? {})) {
      const [, dur = '', ease = ''] = value.split(' | ');
      for (const d of new Set(dur.split(/,\s*/))) {
        if (parseFloat(d) > 0)
          durations.seen(
            `${parseFloat(d) * (d.endsWith('ms') ? 1 : 1000)}ms`,
            s.theme,
            v.n,
            v.s.map((x) => `${s.screen}: ${x}`),
          );
      }
      for (const e of new Set(ease.split(/,\s*(?![^()]*\))/)))
        easings.seen(
          e,
          s.theme,
          v.n,
          v.s.map((x) => `${s.screen}: ${x}`),
        );
    }
  }
  const zIndex = new Table(entry);
  staticInto(
    zIndex,
    (d) => d.prop === 'z-index',
    (t) => [t],
  );
  runtimeInto(zIndex, 'z-index');
  const breakpoints = new Table(entry);
  for (const r of rules)
    breakpoints.use(r.rule, {
      at: `${r.file}:${r.line}`,
      prop: '@',
      selector: '',
      via: [],
      theme: 'fixed',
    });
  const sizes = new Table(entry);
  staticInto(
    sizes,
    (d) => /^(min-|max-)?(width|height)$|^flex-basis$/.test(d.prop),
    (t, d) => lengths(t).map((v) => `${d.prop} ${v}`),
  );
  const controlHeights = new Table(entry);
  runtimeInto(controlHeights, 'control-height', (v) => (parseFloat(v) > 64 ? null : v));
  staticInto(
    controlHeights,
    (d) =>
      /^(min-)?height$/.test(d.prop) &&
      /btn|button|input|select|tab|seg|chip|row|item|nav|tool|control|field/i.test(d.selector),
    (t) => lengths(t),
  );
  const iconSizes = new Table(entry);
  staticInto(
    iconSizes,
    (d) => d.prop === 'icon-size',
    (t) => [`${t}px`],
  );
  runtimeInto(iconSizes, 'icon-size');
  const strokeWidths = new Table(entry);
  staticInto(
    strokeWidths,
    (d) => d.prop === 'stroke-width',
    (t) => [t.replace(/px$/, '')],
  );
  runtimeInto(strokeWidths, 'stroke-width', (v) => v.replace(/px$/, ''));
  const smallTargets = new Table(entry);
  runtimeInto(smallTargets, 'small-target');

  const byUse = <E extends Entry>(t: Table<E>) => t.list().sort((a, b) => total(b) - total(a));
  const num = <E extends Entry>(t: Table<E>) =>
    t
      .list()
      .sort((a, b) => parseFloat(a.value) - parseFloat(b.value) || a.value.localeCompare(b.value));

  const rec = (m: Map<string, string>) => Object.fromEntries([...m].sort());
  return {
    generated: new Date().toISOString(),
    files,
    screens: samples.map((s) => ({
      screen: s.screen,
      theme: s.theme,
      url: s.url,
      elements: s.elements,
    })),
    rootFontSize: root
      ? `${root.value} (${root.file}:${root.line}, selector ${root.selector})`
      : '16px (browser default)',
    tokens: {
      light: rec(tokens.light),
      dark: rec(tokens.dark),
      defined: Object.fromEntries(tokens.defined),
    },
    colours: colourList,
    transparentUses,
    tokenContrast,
    pairs: pairList,
    fontFamilies: byUse(families),
    fontSizes,
    textStyles: byUse(textStyles),
    typeRatios,
    typeScaleFit,
    spacing,
    spacingShare,
    autoMargins,
    radii: num(radii),
    borders: byUse(borders),
    shadows: byUse(shadows),
    blur: byUse(blur),
    opacity: num(opacity),
    durations: num(durations),
    easings: byUse(easings),
    zIndex: num(zIndex),
    breakpoints: byUse(breakpoints),
    sizes: byUse(sizes),
    controlHeights: num(controlHeights),
    iconSizes: num(iconSizes),
    strokeWidths: num(strokeWidths),
    smallTargets: byUse(smallTargets),
  };
}

export const usesOf = total;
export { shortHex };
