// Static half of the as-built style index (skill plancraft-ux-refine §3.6): every style value
// written in the frontend's CSS and TSX (plus the engine's thumbnail renderer, which paints the
// Vault's plan thumbnails), with file:line, the property and the CSS variables it came through.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { mixSrgb, parseColour, toHex8 } from './colour.ts';

export type Theme = 'light' | 'dark';
export type Source = 'css' | 'tsx' | 'engine';

/** One written style value: a CSS declaration, an inline style key or an SVG/JSX attribute. */
export interface Decl {
  file: string;
  line: number;
  selector: string;
  media: string;
  prop: string;
  value: string;
  source: Source;
  theme: Theme | 'both';
}

export interface TokenSet {
  light: Map<string, string>;
  dark: Map<string, string>;
  /** Global custom property → where it is defined (file:line, first definition per theme). */
  defined: Map<string, string[]>;
  /** Custom properties set on component selectors (e.g. a folder's `--from`): every value seen. */
  scoped: Map<string, { value: string; at: string; selector: string }[]>;
}

export interface Resolved {
  text: string;
  via: string[];
}

export function listFiles(dir: string, test: (f: string) => boolean): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p, test));
    else if (test(p)) out.push(p);
  }
  return out;
}

const themeOf = (selector: string): Theme | 'both' =>
  /\[data-theme=['"]?dark/.test(selector)
    ? 'dark'
    : /\[data-theme=['"]?light/.test(selector)
      ? 'light'
      : 'both';

/** Declarations of a stylesheet, with the innermost selector and enclosing @media/@supports. */
export function parseCss(file: string, src: string): Decl[] {
  const text = src.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  const out: Decl[] = [];
  const stack: string[] = [];
  let buf = '';
  let start = 1;
  let line = 1;
  let quote = '';
  let paren = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '\n') line++;
    if (quote) {
      buf += ch;
      if (ch === quote && text[i - 1] !== '\\') quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') paren++;
    else if (ch === ')') paren--;
    if (paren === 0 && (ch === '{' || ch === '}' || ch === ';')) {
      const t = buf.trim();
      if (ch === '{') stack.push(t.replace(/\s+/g, ' '));
      else {
        const m = /^(--[\w-]+|-?[a-z][a-z-]*)\s*:\s*([\s\S]+)$/i.exec(t);
        const selector = [...stack].reverse().find((s) => !s.startsWith('@')) ?? '';
        if (m && stack.length) {
          out.push({
            file,
            line: start,
            selector,
            media: stack.filter((s) => s.startsWith('@')).join(' '),
            prop: m[1]!.toLowerCase(),
            value: m[2]!.replace(/\s+/g, ' ').replace(/\s*!important$/, ''),
            source: 'css',
            theme: themeOf(selector),
          });
        }
        if (ch === '}') stack.pop();
      }
      buf = '';
      continue;
    }
    if (!buf.trim() && ch.trim()) start = line;
    buf += ch;
  }
  return out;
}

/** `@media` / `@supports` conditions of a stylesheet, with lines. */
export function atRules(file: string, src: string): { file: string; line: number; rule: string }[] {
  const out: { file: string; line: number; rule: string }[] = [];
  src.split('\n').forEach((l, i) => {
    const m = /^\s*(@(?:media|supports)[^{]*)\{/.exec(l);
    if (m) out.push({ file, line: i + 1, rule: m[1]!.trim() });
  });
  return out;
}

const kebab = (k: string) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const UNITLESS = new Set(['opacity', 'z-index', 'flex', 'font-weight', 'line-height', 'order']);

/** Split on a separator at the top level (outside brackets and quotes). */
export function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = '';
  let cur = '';
  for (const ch of s) {
    if (quote) {
      if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    else if (depth === 0 && ch === sep) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

const lineAt = (src: string, index: number) => src.slice(0, index).split('\n').length;

/** Inline `style={{…}}` keys, literal SVG/JSX style attributes and colour literals in TS/TSX. */
export function scanTsx(file: string, src: string, source: Source): Decl[] {
  const out: Decl[] = [];
  const seen = new Set<string>();
  const push = (line: number, prop: string, value: string, selector: string) => {
    seen.add(`${line}|${value}`);
    out.push({ file, line, selector, media: '', prop, value, source, theme: 'both' });
  };
  for (let i = src.indexOf('style={{'); i >= 0; i = src.indexOf('style={{', i + 1)) {
    let depth = 0;
    let j = i + 6;
    for (; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}' && --depth === 0) break;
    }
    const body = src.slice(i + 8, j - 1);
    const tag = /<([A-Za-z][\w.]*)[^<]*$/.exec(src.slice(Math.max(0, i - 300), i))?.[1] ?? '?';
    let offset = i + 8;
    for (const part of splitTop(body, ',')) {
      const at = src.indexOf(part, offset);
      offset = at + part.length;
      const m = /^(\w+)\s*:\s*([\s\S]+)$/.exec(part);
      if (!m) continue;
      const prop = kebab(m[1]!);
      let value = m[2]!.trim();
      const q = /^(['"`])(.*)\1$/.exec(value);
      if (q) value = q[2]!;
      else if (/^-?\d+(\.\d+)?$/.test(value) && !UNITLESS.has(prop)) value = `${value}px`;
      else if (!/^-?\d+(\.\d+)?$/.test(value)) value = `{${value}}`;
      push(lineAt(src, at), prop, value, `<${tag} style>`);
    }
  }
  const ATTR =
    /\b(strokeWidth|stroke-width|fontSize|rx|fill|stroke|opacity|fillOpacity|strokeDasharray|size)=(?:"([^"]*)"|\{([^{}]*(?:\([^()]*\))?)\})/g;
  for (const m of src.matchAll(ATTR)) {
    let value = (m[2] ?? m[3] ?? '').trim();
    const px = /^px\((\d+(?:\.\d+)?)\)$/.exec(value);
    if (px) value = `${px[1]}px`;
    else if (m[3] !== undefined && !/^-?\d+(\.\d+)?$/.test(value)) continue; // data-driven
    if (value.includes('${')) continue;
    const prop = kebab(m[1]!);
    if (prop === 'size' && !/^\d+$/.test(value)) continue;
    const line = lineAt(src, m.index);
    const tag = /<([A-Za-z][\w.]*)[^<]*$/.exec(src.slice(Math.max(0, m.index - 400), m.index))?.[1];
    push(line, prop === 'size' ? 'icon-size' : prop, value, tag ? `<${tag}>` : 'attribute');
  }
  // Defaults like `size = 20` in icon components.
  for (const m of src.matchAll(/\bsize\s*=\s*(\d+)\b/g)) {
    if (/icon/i.test(file)) push(lineAt(src, m.index), 'icon-size', m[1]!, 'default prop');
  }
  // Remaining colour literals: data colours (avatars, folders) and SVG strings.
  const COLOUR = /(?<=["'`=\s(])(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))(?=["'`\s,;)])/g;
  src.split('\n').forEach((l, idx) => {
    if (/^\s*(\/\/|\*)/.test(l)) return;
    for (const m of l.matchAll(COLOUR)) {
      const line = idx + 1;
      if (seen.has(`${line}|${m[1]}`) || !parseColour(m[1]!)) continue;
      const before = l.slice(0, m.index);
      const prop = /stroke[^=]*=\s*["'`]?$/.test(before)
        ? 'stroke'
        : /fill[^=]*=\s*["'`]?$/.test(before)
          ? 'fill'
          : /background\s*[:=]\s*["'`]?$/.test(before)
            ? 'background'
            : /colou?r\s*[:=]\s*["'`]?$/.test(before)
              ? 'data-colour'
              : 'literal';
      push(line, prop, m[1]!, 'literal');
    }
  });
  return out;
}

const isGlobal = (selector: string) => /^:root(\[data-theme=['"]?\w+['"]?\])?$/.test(selector);

export function collectTokens(decls: Decl[]): TokenSet {
  const t: TokenSet = { light: new Map(), dark: new Map(), defined: new Map(), scoped: new Map() };
  for (const d of decls) {
    if (!d.prop.startsWith('--')) continue;
    const at = `${d.file}:${d.line}`;
    if (isGlobal(d.selector) && !d.media) {
      if (d.theme !== 'dark') t.light.set(d.prop, d.value);
      if (d.theme !== 'light') t.dark.set(d.prop, d.value);
      t.defined.set(d.prop, [...(t.defined.get(d.prop) ?? []), at]);
    } else {
      const def = { value: d.value, at, selector: d.selector };
      t.scoped.set(d.prop, [...(t.scoped.get(d.prop) ?? []), def]);
    }
  }
  for (const [k, v] of t.light) if (!t.dark.has(k)) t.dark.set(k, v);
  return t;
}

/** Resolve var() for one theme. `scope` pins scoped variables (one component's set); an unpinned
 *  scoped variable fans out into one result per value seen. */
export function resolve(
  value: string,
  theme: Theme,
  tokens: TokenSet,
  scope?: Map<string, string>,
  depth = 0,
): Resolved[] {
  const m = /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/.exec(value);
  if (!m || depth > 8) return [{ text: evalMixes(value), via: [] }];
  const name = m[1]!;
  const global = scope?.get(name) ?? (theme === 'light' ? tokens.light : tokens.dark).get(name);
  const choices =
    global !== undefined
      ? [global]
      : tokens.scoped.has(name)
        ? [...new Set(tokens.scoped.get(name)!.map((s) => s.value))].slice(0, 12)
        : [m[2]?.trim() ?? `var(${name})`];
  const out: Resolved[] = [];
  for (const choice of choices) {
    const replaced = value.slice(0, m.index) + choice + value.slice(m.index + m[0].length);
    for (const r of resolve(replaced, theme, tokens, scope, depth + 1)) {
      out.push({ text: r.text, via: [name, ...r.via] });
    }
  }
  return out;
}

/** Replace `color-mix(in srgb, a p%, b)` whose arguments are literal colours by its result. */
export function evalMixes(value: string): string {
  let v = value;
  for (let guard = 0; guard < 10; guard++) {
    const m =
      /color-mix\(\s*in srgb\s*,\s*([^,()]+(?:\([^()]*\))?[^,()]*),\s*([^,()]+(?:\([^()]*\))?[^,()]*)\)/.exec(
        v,
      );
    if (!m) break;
    const arg = (s: string) => {
      const p = /^(.*?)\s+(\d+(?:\.\d+)?)%$/.exec(s.trim());
      return { c: parseColour(p ? p[1]! : s), p: p ? parseFloat(p[2]!) / 100 : undefined };
    };
    const a = arg(m[1]!);
    const b = arg(m[2]!);
    if (!a.c || !b.c) break;
    const pa = a.p ?? (b.p !== undefined ? 1 - b.p : 0.5);
    v = v.slice(0, m.index) + toHex8(mixSrgb(a.c, pa, b.c)) + v.slice(m.index + m[0].length);
  }
  return v;
}

/** Resolve a declaration's value once per component scope that sets the scoped variables it
 *  uses (so a folder's `--from` and `--to` stay paired), or once when it uses none. */
export function resolveScoped(value: string, theme: Theme, tokens: TokenSet): Resolved[] {
  const names = new Set<string>();
  const walk = (v: string, depth: number) => {
    for (const m of v.matchAll(/var\(\s*(--[\w-]+)/g)) {
      const n = m[1]!;
      if (tokens.scoped.has(n)) names.add(n);
      const g = (theme === 'light' ? tokens.light : tokens.dark).get(n);
      if (g && depth < 8) walk(g, depth + 1);
    }
  };
  walk(value, 0);
  if (!names.size) return resolve(value, theme, tokens);
  const selectors = new Set(
    [...names].flatMap((n) => tokens.scoped.get(n)!.map((d) => d.selector)),
  );
  return [...selectors].flatMap((selector) => {
    const scope = new Map<string, string>();
    for (const [n, defs] of tokens.scoped) {
      for (const d of defs) if (d.selector === selector) scope.set(n, d.value);
    }
    return resolve(value, theme, tokens, scope);
  });
}

export const COLOUR_IN_TEXT = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\b(?:transparent|white|black)\b/g;

export function readSources(root: string): {
  decls: Decl[];
  rules: { file: string; line: number; rule: string }[];
  files: string[];
} {
  const css = listFiles(join(root, 'frontend/src'), (f) => f.endsWith('.css'));
  const tsx = listFiles(
    join(root, 'frontend/src'),
    (f) => /\.tsx?$/.test(f) && !/\.test\./.test(f),
  );
  const engine = [join(root, 'engine/render/thumbnail.ts')];
  const rel = (f: string) => f.slice(root.length + 1);
  const decls: Decl[] = [];
  const rules: { file: string; line: number; rule: string }[] = [];
  for (const f of css) {
    const src = readFileSync(f, 'utf8');
    decls.push(...parseCss(rel(f), src));
    rules.push(...atRules(rel(f), src));
  }
  for (const f of tsx) decls.push(...scanTsx(rel(f), readFileSync(f, 'utf8'), 'tsx'));
  for (const f of engine) decls.push(...scanTsx(rel(f), readFileSync(f, 'utf8'), 'engine'));
  return { decls, rules, files: [...css, ...tsx, ...engine].map(rel) };
}
