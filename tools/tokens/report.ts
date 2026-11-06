// Token index and token sheet (skill §3.3, §3.7): every token with its values per theme, alias
// chain and where it is used; unused tokens; raw values still written in the frontend; contrast.
import { readFileSync } from 'node:fs';
import { contrast, parseColour } from '../as-built/colour.ts';
import { COLOUR_IN_TEXT, type Decl } from '../as-built/static.ts';
import { allPaths, chain, cssVar, lookup, resolveValue, type TokenSystem } from './build.ts';

export interface Usage {
  /** CSS variable name → files (with counts) that reference it. */
  byVar: Map<string, Map<string, number>>;
}

/** Count `var(--name…)` references in the given files (generated token files excluded by the caller). */
export function scanUsage(files: string[], root: string): Usage {
  const byVar = new Map<string, Map<string, number>>();
  for (const f of files) {
    const src = readFileSync(`${root}/${f}`, 'utf8');
    for (const m of src.matchAll(/var\(\s*(--[\w-]+)/g)) {
      const per = byVar.get(m[1]!) ?? new Map<string, number>();
      per.set(f, (per.get(f) ?? 0) + 1);
      byVar.set(m[1]!, per);
    }
  }
  return { byVar };
}

const total = (m?: Map<string, number>) => [...(m?.values() ?? [])].reduce((a, b) => a + b, 0);
const where = (m?: Map<string, number>) =>
  [...(m?.entries() ?? [])]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([f, n]) => `\`${f.replace(/^frontend\/src\//, '')}\` ${n}`)
    .join(', ') + ((m?.size ?? 0) > 4 ? `, +${m!.size - 4} files` : '');
const esc = (s: string) => s.replace(/\|/g, '\\|');

const TEXT = [
  'color.text.primary',
  'color.text.secondary',
  'color.text.disabled',
  'color.accent.default',
  'color.status.success',
  'color.status.warning',
  'color.status.error',
];
const BG = [
  'color.bg.app',
  'canvas.bg',
  'color.bg.surface',
  'color.bg.inset',
  'color.state.hover-bg',
  'color.accent.subtle',
  'color.accent.tint',
];
const UI = [
  'color.border.control',
  'color.border.default',
  'color.accent.default',
  'icon.accent',
  'icon.line',
];

function ratio(sys: TokenSystem, fg: string, bg: string, theme: 'light' | 'dark') {
  const f = parseColour(resolveValue(sys, fg, theme));
  const b = parseColour(resolveValue(sys, bg, theme));
  return f && b ? Math.round(contrast(f, b) * 100) / 100 : NaN;
}

/** Raw style values still written outside the token files, with a note on allowed exceptions. */
export function rawValues(
  decls: Decl[],
): { at: string; prop: string; value: string; note: string }[] {
  const out: { at: string; prop: string; value: string; note: string }[] = [];
  for (const d of decls) {
    if (/design\/tokens\.(css|ts)$/.test(d.file)) continue;
    const plain = d.value.replace(/var\([^()]*(\([^()]*\))?[^()]*\)/g, '');
    const colours = [...plain.matchAll(COLOUR_IN_TEXT)]
      .map((m) => m[0])
      .filter((c) => c !== 'transparent');
    const px =
      /^(font-size|padding|margin|gap|row-gap|column-gap|border-radius|z-index|transition|animation|box-shadow)/.test(
        d.prop,
      )
        ? [...plain.matchAll(/(?<![\w.#-])(-?\d*\.?\d+)(px|ms|s)\b|^\d+$/g)]
            .map((m) => m[0])
            .filter((v) => !/^-?0(px)?$/.test(v))
        : [];
    const found = [...colours, ...px];
    if (!found.length) continue;
    const note =
      /^\.fart|\.farch|folder/.test(d.selector) || /folder-art/.test(d.file)
        ? 'folder art (illustration: component tokens later)'
        : /PlanView|PlanThumbnail|Canvas\.tsx|thumbnail\.ts/.test(d.file)
          ? 'canvas'
          : /styleguide/.test(d.file)
            ? 'style-sheet page'
            : /demo\.ts|items\.tsx/.test(d.file) && d.prop === 'data-colour'
              ? 'demo data'
              : '';
    out.push({ at: `${d.file}:${d.line}`, prop: d.prop, value: found.join(' '), note });
  }
  return out;
}

export function tokenIndex(
  sys: TokenSystem,
  usage: Usage,
  raw: ReturnType<typeof rawValues>,
  generated: string,
): string {
  const paths = allPaths(sys).sort();
  const reverse = new Map<string, string[]>();
  for (const [name, path] of Object.entries(sys.deprecated))
    reverse.set(path, [...(reverse.get(path) ?? []), name]);
  const usesOf = (p: string) => {
    const merged = new Map<string, number>(usage.byVar.get(cssVar(p)) ?? []);
    for (const old of reverse.get(p) ?? [])
      for (const [f, n] of usage.byVar.get(old) ?? []) merged.set(f, (merged.get(f) ?? 0) + n);
    return merged;
  };
  const rows = paths.map((p) => {
    const t = lookup(sys, p, 'light')!;
    const themed = sys.light.has(p);
    const light = resolveValue(sys, p, 'light');
    const dark = resolveValue(sys, p, 'dark');
    const u = usesOf(p);
    return {
      p,
      tier: t.tier,
      line: `| \`${p}\` | ${t.tier} | \`${cssVar(p)}\`${(reverse.get(p) ?? []).map((o) => ` (was \`${o}\`)`).join('')} | \`${esc(light)}\` | ${themed || dark !== light ? `\`${esc(dark)}\`` : 'same'} | ${chain(
        sys,
        p,
        'light',
      )
        .slice(1, -1)
        .map((c) => `\`${c}\``)
        .join(' → ')} | ${total(u)} | ${where(u)} |`,
      uses: total(u),
    };
  });
  const unused = rows.filter((r) => r.uses === 0 && r.tier !== 'base');
  const oldLeft = Object.entries(sys.deprecated)
    .map(([name, path]) => ({
      name,
      path,
      n: total(usage.byVar.get(name)),
      m: usage.byVar.get(name),
    }))
    .filter((x) => x.n > 0);
  const contrastRows = (theme: 'light' | 'dark') => {
    const head = `| text ↓ / background → | ${BG.map((b) => `\`${b}\``).join(' | ')} |\n|---|${BG.map(() => '---').join('|')}|`;
    const body = TEXT.map(
      (fg) =>
        `| \`${fg}\` | ${BG.map((bg) => {
          const r = ratio(sys, fg, bg, theme);
          const exempt = fg === 'color.text.disabled';
          return `${r}${r < 4.5 ? (exempt ? ' (disabled: exempt)' : ' ✗') : ''}`;
        }).join(' | ')} |`,
    ).join('\n');
    const ui = UI.map(
      (fg) =>
        `| \`${fg}\` | ${BG.map((bg) => {
          const r = ratio(sys, fg, bg, theme);
          return `${r}${r < 3 ? ' ✗' : ''}`;
        }).join(' | ')} |`,
    ).join('\n');
    return `**${theme} — text (4.5:1)**\n\n${head}\n${body}\n\n**${theme} — UI parts (3:1)**\n\n${head.replace('text ↓', 'part ↓')}\n${ui}\n`;
  };
  const rawByNote = (note: boolean) => raw.filter((r) => Boolean(r.note) === note);
  return `# Token index — generated ${generated.slice(0, 10)}

> GENERATED by \`npm run tokens\` (tools/tokens-build.ts) from \`design/tokens/*.json\`: do not edit by hand. Skill \`plancraft-ux-refine\` §3.7. Visual sheet: \`design/tokens/tokens.html\`. History: \`design/tokens/CHANGELOG.md\`.

## Summary
- **${paths.length} tokens:** ${rows.filter((r) => r.tier === 'base').length} base, ${rows.filter((r) => r.tier === 'semantic').length} semantic (${sys.light.size} with light/dark values), ${rows.filter((r) => r.tier === 'component').length} component.
- **CSS variables:** \`--pc-\` + the token path with dots as dashes (\`color.text.primary\` → \`--pc-color-text-primary\`). Components use semantic and component tokens only.
- **Deprecated aliases:** ${Object.keys(sys.deprecated).length} old names still work; ${oldLeft.reduce((a, x) => a + x.n, 0)} references to them remain in ${new Set(oldLeft.flatMap((x) => [...(x.m?.keys() ?? [])])).size} files (migrate as files are touched; remove the aliases after one release).
- **Unused semantic/component tokens:** ${unused.length} (most are new and waiting for PI.2 icons, P2.2a panels or the migration).
- **Raw values remaining in the frontend:** ${rawByNote(false).length} to migrate, ${rawByNote(true).length} allowed for now (folder art, canvas, style-sheet page, demo data).

## Tokens
Uses = \`var()\` references in \`frontend/src\` (tokens.css / tokens.ts excluded), counting the deprecated name too.

| token | tier | CSS variable | light | dark | alias chain (light) | uses | where |
|---|---|---|---|---|---|---|---|
${rows.map((r) => r.line).join('\n')}

## Deprecated names still referenced
| old name | → token | references | where |
|---|---|---|---|
${oldLeft.map((x) => `| \`${x.name}\` | \`${x.path}\` | ${x.n} | ${where(x.m)} |`).join('\n')}

## Unused tokens (semantic and component)
${unused.map((r) => `\`${r.p}\``).join(', ') || 'None.'}

## Raw values remaining (file:line)
**To migrate:**

| where | property | raw value(s) |
|---|---|---|
${rawByNote(false)
  .map((r) => `| \`${r.at.replace(/^frontend\/src\//, '')}\` | ${r.prop} | \`${esc(r.value)}\` |`)
  .join('\n')}

**Allowed for now:**

| where | property | raw value(s) | why |
|---|---|---|---|
${rawByNote(true)
  .map(
    (r) =>
      `| \`${r.at.replace(/^frontend\/src\//, '')}\` | ${r.prop} | \`${esc(r.value)}\` | ${r.note} |`,
  )
  .join('\n')}

## Contrast
${contrastRows('light')}
${contrastRows('dark')}`;
}

const html = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The visual token sheet: semantic and component tokens in both themes, scales and type. */
export function tokenSheet(sys: TokenSystem, generated: string): string {
  const paths = allPaths(sys)
    .filter((p) => lookup(sys, p, 'light')!.tier !== 'base')
    .sort();
  const colourRow = (p: string) => {
    const l = resolveValue(sys, p, 'light');
    const d = resolveValue(sys, p, 'dark');
    if (!parseColour(l)) return '';
    return `<tr><td><code>${p}</code><small>${cssVar(p)}</small></td><td class="l"><i style="background:${l}"></i>${l}</td><td class="d"><i style="background:${d}"></i>${d}</td></tr>`;
  };
  const other = paths
    .filter((p) => !parseColour(resolveValue(sys, p, 'light')))
    .map(
      (p) =>
        `<tr><td><code>${p}</code><small>${cssVar(p)}</small></td><td colspan="2"><code>${html(resolveValue(sys, p, 'light'))}</code>${resolveValue(sys, p, 'dark') !== resolveValue(sys, p, 'light') ? ` · dark <code>${html(resolveValue(sys, p, 'dark'))}</code>` : ''}</td></tr>`,
    )
    .join('');
  const types = paths
    .filter((p) => lookup(sys, p, 'light')!.type === 'typography')
    .map((p) => {
      const tracking = (lookup(sys, p, 'light')!.value as Record<string, string>).letterSpacing;
      const ls = tracking ? resolveValue(sys, tracking.slice(1, -1), 'light') : 'normal';
      return `<div class="spec"><span style="font:${resolveValue(sys, p, 'light')};letter-spacing:${ls}">Living room 4.20 × 3.60 m · 15.1 m²</span><small>${p} · ${html(resolveValue(sys, p, 'light'))}</small></div>`;
    })
    .join('');
  const pairs = (theme: 'light' | 'dark') => {
    const bg = resolveValue(sys, 'color.bg.surface', theme);
    return TEXT.map((fg) => {
      const r = ratio(sys, fg, 'color.bg.surface', theme);
      return `<span class="pair" style="background:${bg};color:${resolveValue(sys, fg, theme)}">Aa ${fg.split('.').pop()} ${r}</span>`;
    }).join('');
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>PlanCraft tokens</title>
<style>
:root { --bg:#f6f6f8; --fg:#111114; --mute:#656571; --line:#dcdce2; --card:#fff; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root { --bg:#111114; --fg:#f2f2f4; --mute:#a0a0ae; --line:#2a2a31; --card:#17171b; color-scheme: dark; } }
body { margin:0; background:var(--bg); color:var(--fg); font:13px/18px 'Geist Variable','Geist',system-ui,sans-serif; }
main { max-width:1100px; margin:0 auto; padding:24px 16px 64px; }
h1 { font-size:24px; line-height:30px; font-weight:400; }
h2 { font-size:15px; margin:32px 0 8px; }
small { display:block; color:var(--mute); font-size:11px; line-height:14px; }
code { font-family:'Geist Mono Variable','Geist Mono',ui-monospace,monospace; font-size:12px; }
table { width:100%; border-collapse:collapse; background:var(--card); }
td, th { text-align:left; padding:6px 8px; border-bottom:1px solid var(--line); vertical-align:middle; }
td.l { background:#ffffff; color:#111114; } td.d { background:#17171b; color:#f2f2f4; }
td i { display:inline-block; width:28px; height:18px; border-radius:2px; vertical-align:middle; margin-right:8px; border:1px solid rgba(128,128,128,.35); }
.spec { padding:8px 0; border-bottom:1px solid var(--line); }
.pair { display:inline-block; padding:6px 10px; margin:4px; border-radius:4px; border:1px solid var(--line); }
.row { display:flex; flex-wrap:wrap; }
</style>
</head>
<body>
<main>
<h1>PlanCraft tokens <small>generated ${generated.slice(0, 16).replace('T', ' ')} UTC from design/tokens/*.json · index: TOKEN-INDEX.md</small></h1>
<h2>Text on the surface (WCAG ratio)</h2>
<div class="row">${pairs('light')}</div><div class="row">${pairs('dark')}</div>
<h2>Colours (semantic and component)</h2>
<table><tr><th>token</th><th>light</th><th>dark</th></tr>${paths.map(colourRow).join('')}</table>
<h2>Type styles</h2>
${types}
<h2>Other tokens</h2>
<table>${other}</table>
</main>
</body>
</html>
`;
}
