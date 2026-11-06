// Writes the as-built index (skill §3.6 step 3): the generated tables of AS-BUILT-INDEX.md (only
// between its GENERATED markers, so the hand-written summary and proposal survive re-runs) and
// the visual sheet as-built-sheet.html (as-built values next to proposed-scales.json, if present).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { contrast, parseColour, shortHex } from './colour.ts';
import type { ColourEntry, Entry, Index } from './analyse.ts';

/** Current CSS variable → proposed token (the proposal in AS-BUILT-INDEX.md; 🛑 founder approval). */
export const TOKEN_MAP: Record<string, string> = {
  '--bg': 'color.bg.app',
  '--canvas': 'canvas.bg',
  '--canvas-dot': 'canvas.grid.minor',
  '--surface': 'color.bg.surface',
  '--surface-2': 'color.bg.inset',
  '--surface-3': 'color.state.hover-bg',
  '--line': 'color.border.subtle',
  '--line-strong': 'color.border.default',
  '--text': 'color.text.primary',
  '--text-muted': 'color.text.secondary',
  '--text-faint': 'color.text.disabled',
  '--ink': 'color.bg.inverse',
  '--on-ink': 'color.text.inverse',
  '--accent': 'color.accent.decorative',
  '--accent-strong': 'color.accent.default',
  '--accent-soft': 'color.accent.subtle',
  '--accent-tint': 'color.accent.tint',
  '--ok': 'color.status.success',
  '--warn': 'color.status.warning',
  '--error': 'color.status.error',
  '--backdrop': 'color.bg.scrim',
  '--shadow-float': 'elevation.overlay',
  '--font-sans': 'font.family.sans',
  '--font-mono': 'font.family.mono',
  '--radius-card': 'radius.card',
  '--radius-control': 'radius.control',
  '--radius-float': 'radius.overlay',
  '--radius-pill': 'radius.pill',
  '--control-sm': 'size.control.sm',
  '--control-md': 'size.control.md',
  '--control-lg': 'size.control.lg',
  '--ease': 'motion.hover',
  '--tile-radius': 'folder-card.radius',
  '--mark': 'marks.color',
};
const folderToken = (name: string) => {
  const m = /^--folder-(\w+)-(from|to)$/.exec(name);
  return m ? `folder-card.${m[1]}.${m[2]}` : undefined;
};
const proposedFor = (cssVar: string) => TOKEN_MAP[cssVar] ?? folderToken(cssVar) ?? `? ${cssVar}`;

const SPACE_SCALE = [0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64];
const RADIUS_SCALE: Record<string, string> = {
  '0': 'radius.0',
  '0px': 'radius.0',
  '2px': 'radius.100 (card)',
  '4px': 'radius.200 (control)',
  '6px': 'radius.300',
  '8px': 'radius.400 (overlay)',
  '12px': 'radius.500',
  '16px': 'radius.600 (tile)',
  '20px': 'radius.700',
  '999px': 'radius.full (pill)',
  '50%': 'radius.full (circle)',
};
export const TYPE_STEPS: Record<number, string> = {
  11: 'font.size.100 (micro, labels)',
  12: 'font.size.200 (small)',
  13: 'font.size.300 (body)',
  15: 'font.size.400 (section)',
  22: 'font.size.600 (metric)',
  24: 'font.size.700 (title)',
  40: 'font.size.900 (display)',
};

const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const html = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const short = (at: string) => at.replace(/^frontend\/src\//, '');
const seen = (e: Entry) => e.runtime.light + e.runtime.dark;
const where = (e: Entry, n = 4) => {
  const locs = [...new Set(e.uses.map((u) => short(u.at)))];
  const list = locs.slice(0, n).map((l) => `\`${l}\``);
  if (locs.length > n) list.push(`+${locs.length - n} more`);
  if (!locs.length && e.samples.length)
    list.push(...e.samples.slice(0, 2).map((s) => `_${esc(s)}_`));
  return list.join(', ');
};
const counts = (e: Entry) => `${e.uses.length} / ${seen(e)}`;

export function spaceStep(px: number): string {
  if (px < 0) return 'negative offset (keep, review)';
  if (SPACE_SCALE.includes(px)) return `space.${px * 25}`;
  if (px % 4 === 0) return `space.${px * 25} (add step)`;
  const near = SPACE_SCALE.reduce((a, b) => (Math.abs(b - px) < Math.abs(a - px) ? b : a));
  return px === 1
    ? 'hairline: use border.width, not spacing'
    : `snap → ${near}px (space.${near * 25})`;
}

function colourProposal(c: ColourEntry, all: ColourEntry[]): string {
  const vars = [...new Set(c.tokens.map((t) => t.replace(/ \(.*\)$/, '')))];
  if (vars.length) return vars.map(proposedFor).join(', ');
  if (c.derived) return 'derived (computed by color-mix; no token)';
  const near = c.nearDuplicates
    .map((n) => all.find((x) => x.value === n.value))
    .find((x) => x && x.tokens.length);
  if (near) return `merge → ${proposedFor(near.tokens[0]!.replace(/ \(.*\)$/, ''))}`;
  if (c.roles.includes('data')) return 'data colour (avatars/demo): categorical palette';
  if (c.uses.some((u) => /vault\.css|folder-art/.test(u.at))) return 'component: folder-card.*';
  return 'review: new semantic token or merge';
}

function table(head: string[], rows: string[][]): string {
  return [
    `| ${head.join(' | ')} |`,
    `|${head.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');
}

function genericSection(
  title: string,
  list: Entry[],
  propose: (e: Entry) => string = () => '',
): string {
  if (!list.length) return `### ${title}\n\nNone found.\n`;
  return `### ${title}\n\n${table(
    ['value', 'uses (code / seen)', 'where', 'proposed'],
    list.map((e) => [`\`${esc(e.value)}\``, counts(e), where(e), propose(e)]),
  )}\n`;
}

export function markdown(ix: Index): string {
  const out: string[] = [];
  const nonDerived = ix.colours.filter((c) => !c.derived);
  const nearPairs = new Set<string>();
  for (const c of nonDerived) {
    for (const n of c.nearDuplicates) {
      if (nonDerived.some((x) => x.value === n.value)) {
        nearPairs.add([c.value, n.value].map(shortHex).sort().join(' ≈ ') + ` (ΔE ${n.deltaE})`);
      }
    }
  }
  const fails = ix.pairs.filter((p) => !p.pass);
  const tokenFails = ix.tokenContrast.filter((t) => t.ratio < t.need);
  const uiSizes = [...new Set(ix.fontSizes.map((f) => f.px))];
  out.push(`## Numbers (generated ${ix.generated.slice(0, 10)})

- **Sources:** ${ix.files.length} files (${ix.files.filter((f) => f.endsWith('.css')).length} stylesheets, ${ix.files.filter((f) => /\.tsx?$/.test(f)).length} TS/TSX incl. the engine thumbnail renderer); runtime: ${ix.screens.length} screen samples at 1440 × 900 (${[...new Set(ix.screens.map((s) => s.screen))].join(', ')}), light and dark, ${ix.screens.reduce((a, s) => a + s.elements, 0)} visible elements.
- **Root font size:** ${ix.rootFontSize} — so \`1rem\` = ${/^(\d+)px/.exec(ix.rootFontSize)?.[1] ?? 16} px here.
- **Colours:** ${ix.colours.length} distinct (${nonDerived.length} written or tokenised, ${ix.colours.length - nonDerived.length} derived by \`color-mix()\`); ${nearPairs.size} near-duplicate pairs among them (ΔE2000 < 2); ${ix.transparentUses} uses of \`transparent\` not listed.
- **Contrast:** ${tokenFails.length} token pairs below target; ${fails.length} of ${ix.pairs.length} text/background pairs seen on screen below WCAG AA.
- **Type:** ${ix.fontFamilies.map((f) => f.value).join(', ')}; ${uiSizes.length} font sizes (${uiSizes.join(', ')} px).
- **Spacing:** ${ix.spacingShare.total} written values; ${Math.round((100 * ix.spacingShare.on4) / ix.spacingShare.total)} % on the 4 px grid, ${Math.round((100 * ix.spacingShare.on8) / ix.spacingShare.total)} % on 8 px, ${Math.round((100 * ix.spacingShare.on2) / ix.spacingShare.total)} % on 2 px. ${ix.autoMargins} runtime \`margin: auto\` values ignored.
- **Other scales:** ${ix.radii.length} radii, ${ix.shadows.length} shadow recipes, ${ix.durations.length} durations, ${ix.zIndex.length} z-index values, ${ix.breakpoints.length} media/supports rules.
`);

  out.push(
    `## Colours\n\nUses = declarations in code (each theme counted) / elements seen on screen. "fixed" = hard-coded, does not follow the theme. Sorted by family, then light → dark.\n`,
  );
  const families = [...new Set(ix.colours.map((c) => c.family))];
  for (const fam of families) {
    const list = ix.colours.filter((c) => c.family === fam);
    out.push(`### ${fam} (${list.length})\n`);
    out.push(
      table(
        [
          'value',
          'role(s)',
          'themes',
          'uses (code / seen)',
          'token(s) now',
          'where',
          'near-duplicate of',
          'proposed token',
        ],
        list.map((c) => {
          const themes = [
            ...new Set([...c.uses.map((u) => u.theme), ...c.defs.map((d) => d.theme)]),
          ];
          if (c.runtime.light) themes.push('light');
          if (c.runtime.dark) themes.push('dark');
          return [
            `\`${shortHex(c.value)}\`${c.derived ? ' _(derived)_' : ''}`,
            [...new Set(c.roles.map((r) => r.replace(' (runtime)', '')))].join(', '),
            [...new Set(themes)].join(', '),
            counts(c),
            c.tokens.map((t) => `\`${t}\``).join(' '),
            where(c, 3),
            c.nearDuplicates.map((n) => `\`${shortHex(n.value)}\` (${n.deltaE})`).join(', '),
            colourProposal(c, ix.colours),
          ];
        }),
      ),
    );
    out.push('');
  }

  out.push(
    `## Contrast pairs\n\n### Token pairs (from \`tokens.css\`)\n\nText needs 4.5:1; borders, focus rings and other meaningful UI parts need 3:1. ✗ = below.\n`,
  );
  for (const theme of ['light', 'dark'] as const) {
    const rows = ix.tokenContrast.filter((t) => t.theme === theme && t.need === 4.5);
    const fgs = [...new Set(rows.map((r) => r.fg))];
    const bgs = [...new Set(rows.filter((r) => r.fg !== '--on-ink').map((r) => r.bg))];
    out.push(`**${theme} — text**\n`);
    out.push(
      table(
        ['text ↓ / background →', ...bgs.map((b) => `\`${b}\``)],
        fgs
          .filter((f) => f !== '--on-ink')
          .map((fg) => [
            `\`${fg}\``,
            ...bgs.map((bg) => {
              const r = rows.find((x) => x.fg === fg && x.bg === bg)!;
              return `${r.ratio}${r.ratio < r.need ? ' ✗' : ''}`;
            }),
          ]),
      ),
    );
    const ink = rows.find((r) => r.fg === '--on-ink');
    if (ink) out.push(`\n\`--on-ink\` on \`--ink\`: ${ink.ratio}${ink.ratio < 4.5 ? ' ✗' : ''}\n`);
    const ui = ix.tokenContrast.filter((t) => t.theme === theme && t.need === 3);
    const ubgs = [...new Set(ui.map((r) => r.bg))];
    out.push(`**${theme} — UI parts (3:1)**\n`);
    out.push(
      table(
        ['part ↓ / background →', ...ubgs.map((b) => `\`${b}\``)],
        [...new Set(ui.map((r) => r.fg))].map((fg) => [
          `\`${fg}\``,
          ...ubgs.map((bg) => {
            const r = ui.find((x) => x.fg === fg && x.bg === bg)!;
            return `${r.ratio}${r.ratio < 3 ? ' ✗' : ''}`;
          }),
        ]),
      ),
    );
    out.push('');
  }
  out.push(
    `### Text seen on screen (runtime)\n\nEvery text colour on its real background (semi-transparent layers composited; element opacity applied). "on glass" = over a gradient or blur, so the ratio is against the nearest solid colour: check by eye.\n`,
  );
  out.push(
    table(
      ['AA', 'theme', 'text', 'background', 'ratio', 'smallest size', 'seen', 'screens', 'example'],
      ix.pairs.map((p) => [
        p.pass ? '✓' : '✗',
        p.theme,
        `\`${shortHex(p.fg)}\``,
        `\`${shortHex(p.bg)}\`${p.overImage ? ' (on glass)' : ''}`,
        String(p.ratio),
        `${p.minSize}px`,
        String(p.n),
        p.screens.join(', '),
        p.samples.slice(0, 2).map(esc).join('; '),
      ]),
    ),
  );

  out.push(`\n## Type scale\n`);
  out.push(
    table(
      [
        'size',
        'rem (÷16)',
        'weights',
        'line-heights',
        'letter-spacing',
        'uses (code / seen)',
        'where',
        'proposed step',
      ],
      ix.fontSizes.map((f) => [
        `${f.px}px`,
        `${Math.round((f.px / 16) * 1000) / 1000}rem`,
        f.weights.join(', '),
        f.lineHeights.join(', '),
        f.letterSpacing.join(', '),
        counts(f),
        where(f, 3),
        TYPE_STEPS[f.px] ?? `off-scale → ${f.px < 11 ? '11px (font.size.100)' : 'review'}`,
      ]),
    ),
  );
  out.push(
    `\n**Ratios between consecutive sizes:** ${ix.typeRatios.map((r) => `${r.from}→${r.to} ×${r.ratio}`).join(' · ')}\n`,
  );
  out.push(
    `**Fit to standard scales (anchored at 13 px body, ±0.5 px):** ${ix.typeScaleFit
      .map(
        (s) =>
          `${s.name} ${s.ratio}: ${s.matches}/${s.matches + s.off.length} sizes fit (off: ${s.off.join(', ') || '—'})`,
      )
      .join(' · ')}\n`,
  );
  out.push(`### Text styles seen on screen\n`);
  out.push(
    table(
      ['family size/line-height weight (extras)', 'seen', 'examples'],
      ix.textStyles.map((t) => [
        `\`${esc(t.value)}\``,
        String(seen(t)),
        t.samples.slice(0, 2).map(esc).join('; '),
      ]),
    ),
  );

  out.push(
    `\n## Spacing\n\nPadding, margin, gap and inset values. Code uses count each theme once.\n`,
  );
  out.push(
    table(
      ['px', 'on 4', 'on 8', 'uses (code / seen)', 'kind', 'where', 'proposed'],
      ix.spacing.map((s) => [
        String(s.px),
        s.on4 ? '✓' : '—',
        s.on8 ? '✓' : '—',
        counts(s),
        s.kinds.join(', '),
        where(s, 3),
        spaceStep(s.px),
      ]),
    ),
  );

  out.push(`\n## Other scales\n`);
  out.push(genericSection('Radii', ix.radii, (e) => RADIUS_SCALE[e.value] ?? 'off-scale: review'));
  out.push(genericSection('Border and outline widths', ix.borders));
  out.push(genericSection('Shadows', ix.shadows));
  out.push(genericSection('Blur and backdrop filters', ix.blur));
  out.push(genericSection('Opacity', ix.opacity));
  out.push(
    genericSection('Durations', ix.durations, (e) =>
      [0, 100, 150, 200, 250, 300, 400].includes(parseFloat(e.value))
        ? `duration.${parseFloat(e.value)}`
        : 'snap → 200ms',
    ),
  );
  out.push(genericSection('Easings', ix.easings));
  out.push(genericSection('Z-index', ix.zIndex));
  out.push(genericSection('Media and supports rules (breakpoints)', ix.breakpoints));
  out.push(genericSection('Control heights (buttons, inputs, rows, tabs…)', ix.controlHeights));
  out.push(genericSection('Icon sizes', ix.iconSizes));
  out.push(genericSection('SVG stroke widths', ix.strokeWidths));
  out.push(
    genericSection(
      'Targets smaller than 24 × 24 px (WCAG 2.5.8; an input inside a taller wrapper may be fine)',
      ix.smallTargets,
    ),
  );
  out.push(genericSection('Widths and heights in code (top 40)', ix.sizes.slice(0, 40)));

  out.push(`\n## Outliers & merge candidates\n`);
  out.push(
    `**Near-duplicate colours (ΔE2000 < 2, written or tokenised; derived colours left out):**\n\n${[...nearPairs].map((p) => `- ${p}`).join('\n')}\n`,
  );
  const rare = (label: string, list: Entry[]) => {
    const r = list.filter((e) => e.uses.length + seen(e) < 3 && e.uses.length > 0);
    const name = (v: string) => (/^#[0-9a-f]{8}$/.test(v) ? shortHex(v) : v);
    return r.length
      ? `- **${label}:** ${r.map((e) => `\`${esc(name(e.value))}\` (${where(e, 2)})`).join('; ')}`
      : '';
  };
  out.push(
    `**Used fewer than 3 times (review):**\n\n${[
      rare('colours', nonDerived),
      rare('font sizes', ix.fontSizes),
      rare('spacing', ix.spacing),
      rare('radii', ix.radii),
      rare('z-index', ix.zIndex),
      rare('opacity', ix.opacity),
    ]
      .filter(Boolean)
      .join('\n')}\n`,
  );
  return out.join('\n');
}

export const MARK_START = '<!-- GENERATED:START (node tools/as-built-scan.ts) -->';
export const MARK_END = '<!-- GENERATED:END -->';

export function writeMarkdown(path: string, ix: Index) {
  const body = `${MARK_START}\n\n${markdown(ix)}\n${MARK_END}`;
  if (!existsSync(path)) {
    writeFileSync(path, `# As-built design system — ${ix.generated.slice(0, 10)}\n\n${body}\n`);
    return;
  }
  const old = readFileSync(path, 'utf8');
  const a = old.indexOf(MARK_START);
  const b = old.indexOf(MARK_END);
  writeFileSync(
    path,
    a >= 0 && b > a ? old.slice(0, a) + body + old.slice(b + MARK_END.length) : `${old}\n${body}\n`,
  );
}

// Visual sheet ----------------------------------------------------------------------------------

interface Proposal {
  note?: string;
  ramps: Record<string, { step: string; value: string; was?: string }[]>;
  themes: Record<'light' | 'dark', Record<string, string>>;
  type: {
    step: string;
    px: number;
    lineHeight: number;
    weight: number;
    family: 'sans' | 'mono';
    use: string;
  }[];
  space: number[];
  radius: { step: string; px: number | string; use: string }[];
}

const swatch = (value: string, label: string, sub: string, bgs: [string, string][]) => {
  const c = parseColour(value)!;
  const badges = bgs
    .map(([name, bg]) => {
      const r = contrast(c, parseColour(bg)!);
      return `<span class="b ${r >= 4.5 ? 'ok' : r >= 3 ? 'mid' : 'no'}" title="contrast on ${name} ${bg}">${name} ${r.toFixed(1)}</span>`;
    })
    .join('');
  return `<div class="sw"><div class="chip"><i style="background:${value}"></i></div><code>${html(label)}</code><small>${html(sub)}</small><div>${badges}</div></div>`;
};

export function sheet(ix: Index, proposal: Proposal | null): string {
  // Follow var() chains (tokens.css aliases old names to --pc- tokens) to a literal colour.
  const deref = (map: Record<string, string>, name: string, fallback: string) => {
    let v = map[name] ?? fallback;
    for (let i = 0; i < 10; i++) {
      const m = /^var\((--[\w-]+)\)$/.exec(v.trim());
      if (!m) break;
      v = map[m[1]!] ?? fallback;
    }
    return parseColour(v) ? v : fallback;
  };
  const bgs: [string, string][] = [
    ['L', deref(ix.tokens.light, '--surface', '#ffffff')],
    ['D', deref(ix.tokens.dark, '--surface', '#17171b')],
  ];
  const families = [...new Set(ix.colours.map((c) => c.family))];
  const colourHtml = families
    .map((fam) => {
      const list = ix.colours.filter((c) => c.family === fam && !c.derived);
      const derived = ix.colours.filter((c) => c.family === fam && c.derived).length;
      return `<h3>${fam} <small>${list.length}${derived ? ` + ${derived} derived` : ''}</small></h3><div class="grid">${list
        .map((c) =>
          swatch(
            c.value,
            shortHex(c.value),
            `${c.tokens.map((t) => t.replace(' (light)', ' L').replace(' (dark)', ' D')).join(' ') || 'literal'} · ${c.uses.length}/${seen(c)}${c.nearDuplicates.length ? ' · ≈' + c.nearDuplicates.map((n) => shortHex(n.value)).join(' ≈') : ''}`,
            bgs,
          ),
        )
        .join('')}</div>`;
    })
    .join('');
  const fails = ix.pairs.filter((p) => !p.pass);
  const pairHtml = fails
    .map(
      (p) =>
        `<div class="pair" style="background:${p.bg};color:${p.fg}"><b>Aa ${p.minSize}px</b> ${p.ratio}:1 · ${p.theme}${p.overImage ? ' · on glass' : ''}<small>${html(p.samples[0] ?? '')}</small></div>`,
    )
    .join('');
  const typeHtml = ix.textStyles
    .map((t) => {
      const m = /^(.+?) (\d+(?:\.\d+)?px)\/(\S+) (\d+)(.*)$/.exec(t.value);
      if (!m) return '';
      const [, fam, size, lh, weight, extra] = m;
      const ls = /ls (\S+)/.exec(extra ?? '')?.[1] ?? 'normal';
      const upper = (extra ?? '').includes('uppercase') ? 'uppercase' : 'none';
      return `<div class="spec"><span style="font-family:'${fam}',system-ui;font-size:${size};line-height:${lh};font-weight:${weight};letter-spacing:${ls};text-transform:${upper}">Ground floor plan 30×40 · 3BHK · 12.4 m²</span><small>${html(t.value)} · seen ${seen(t)}</small></div>`;
    })
    .join('');
  const spaceHtml = ix.spacing
    .filter((s) => s.px >= 0 && s.px <= 80)
    .map(
      (s) =>
        `<div class="ruler ${s.on4 ? '' : 'off'}"><code>${s.px}</code><i style="width:${Math.max(s.px * 3, 1)}px"></i><small>${counts(s)}</small></div>`,
    )
    .join('');
  const radiusHtml = ix.radii
    .filter((r) => !r.value.includes(' '))
    .map(
      (r) =>
        `<div class="rad"><i style="border-radius:${r.value}"></i><code>${html(r.value)}</code><small>${counts(r)}</small></div>`,
    )
    .join('');
  const shadowHtml = ix.shadows
    .filter((s) => s.uses.length)
    .map(
      (s) =>
        `<div class="sh"><i style="box-shadow:${s.value}"></i><small>${html(s.value)} · ${counts(s)}</small></div>`,
    )
    .join('');
  let proposalHtml = '<p>No proposal file yet.</p>';
  if (proposal) {
    const ramps = Object.entries(proposal.ramps)
      .map(
        ([name, steps]) =>
          `<h3>${name}</h3><div class="ramp">${steps
            .map(
              (s) =>
                `<div><i style="background:${s.value}"></i><code>${s.step}</code><small>${s.value}${s.was && s.was !== s.value ? ` (was ${s.was})` : ''}</small></div>`,
            )
            .join('')}</div>`,
      )
      .join('');
    const themeTable = ['light', 'dark']
      .map((t) => {
        const map = proposal.themes[t as 'light' | 'dark'];
        const surface = map['color.bg.surface'] ?? (t === 'light' ? '#ffffff' : '#17171b');
        return `<div class="theme ${t}" style="background:${surface}"><h4 style="color:${map['color.text.primary']}">${t}</h4>${Object.entries(
          map,
        )
          .map(
            ([k, v]) =>
              `<div class="row"><i style="background:${v}"></i><code style="color:${map['color.text.secondary']}">${k}</code><span style="color:${map['color.text.primary']}">${v}</span></div>`,
          )
          .join('')}</div>`;
      })
      .join('');
    const typeScale = proposal.type
      .map(
        (t) =>
          `<div class="spec"><span style="font-family:${t.family === 'mono' ? "'Geist Mono Variable','Geist Mono',ui-monospace" : "'Geist Variable','Geist',system-ui"};font-size:${t.px}px;line-height:${t.lineHeight}px;font-weight:${t.weight}">${t.px}/${t.lineHeight} — Living room 4.20 × 3.60 m</span><small>${t.step} · ${html(t.use)}</small></div>`,
      )
      .join('');
    const spaceScale = proposal.space
      .map(
        (px) =>
          `<div class="ruler"><code>${px}</code><i style="width:${px * 3}px"></i><small>space.${px * 25}</small></div>`,
      )
      .join('');
    const radiusScale = proposal.radius
      .map(
        (r) =>
          `<div class="rad"><i style="border-radius:${typeof r.px === 'number' ? `${r.px}px` : r.px}"></i><code>${r.step}</code><small>${html(r.use)}</small></div>`,
      )
      .join('');
    proposalHtml = `${proposal.note ? `<p>${html(proposal.note)}</p>` : ''}${ramps}<h3>Semantic tokens per theme</h3><div class="themes">${themeTable}</div><h3>Type scale</h3>${typeScale}<h3>Spacing scale</h3>${spaceScale}<h3>Radii</h3><div class="grid">${radiusScale}</div>${iconPreview(proposal)}`;
  }
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>As-built style sheet</title>
<style>
:root { --bg:#f6f6f8; --fg:#111114; --mute:#6b6b78; --line:#dcdce2; --card:#fff; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root { --bg:#111114; --fg:#f2f2f4; --mute:#a0a0ae; --line:#2a2a31; --card:#17171b; color-scheme: dark; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--fg); font:13px/18px 'Geist Variable','Geist',system-ui,sans-serif; }
main { max-width:1280px; margin:0 auto; padding:24px 16px 64px; }
nav { position:sticky; top:0; background:var(--bg); border-bottom:1px solid var(--line); padding:8px 16px; display:flex; gap:16px; flex-wrap:wrap; z-index:1; }
nav a { color:inherit; }
h1 { font-size:24px; line-height:30px; font-weight:400; }
h2 { font-size:18px; margin:40px 0 8px; padding-top:16px; border-top:1px solid var(--line); }
h3 { font-size:13px; margin:24px 0 8px; text-transform:uppercase; letter-spacing:.06em; color:var(--mute); }
h3 small { font-weight:400; }
code { font-family:'Geist Mono Variable','Geist Mono',ui-monospace,monospace; font-size:12px; }
small { display:block; color:var(--mute); font-size:11px; line-height:14px; word-break:break-word; }
.cols { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
@media (max-width: 900px) { .cols { grid-template-columns:1fr; } }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:8px; }
.sw, .rad, .sh { background:var(--card); border:1px solid var(--line); border-radius:4px; padding:8px; }
.chip { height:40px; border-radius:2px; background:repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0/10px 10px; overflow:hidden; margin-bottom:6px; }
.chip i { display:block; height:100%; }
.b { display:inline-block; font-size:10px; line-height:14px; padding:0 4px; border-radius:2px; margin:4px 4px 0 0; }
.b.ok { background:#1b7f4622; } .b.mid { background:#b4530922; } .b.no { background:#c9303522; }
.pair { padding:8px 12px; border-radius:4px; margin:4px 0; border:1px solid var(--line); }
.pair small { color:inherit; opacity:.8; }
.spec { padding:8px 0; border-bottom:1px solid var(--line); overflow:hidden; }
.spec span { display:block; white-space:nowrap; text-overflow:ellipsis; overflow:hidden; }
.ruler { display:grid; grid-template-columns:40px 1fr 90px; align-items:center; gap:8px; padding:2px 0; }
.ruler i { display:block; height:12px; background:#8080dd; }
.ruler.off i { background:#c93035; }
.rad i { display:block; width:56px; height:40px; border:2px solid var(--fg); margin-bottom:6px; }
.sh i { display:block; height:40px; background:var(--card); border-radius:4px; margin:8px 8px 12px; }
.ramp { display:flex; flex-wrap:wrap; gap:4px; }
.ramp div { width:96px; }
.ramp i { display:block; height:36px; border-radius:2px; border:1px solid var(--line); }
.themes { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.theme { border:1px solid var(--line); border-radius:8px; padding:12px; }
.theme h4 { margin:0 0 8px; }
.theme .row { display:grid; grid-template-columns:20px 1fr auto; gap:8px; align-items:center; padding:2px 0; }
.theme .row i { width:16px; height:16px; border-radius:2px; border:1px solid rgba(128,128,128,.4); display:block; }
.icons { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.icons .theme { display:flex; flex-wrap:wrap; gap:8px; }
.ib { display:flex; align-items:center; gap:8px; padding:6px 12px 6px 10px; border-radius:4px; border-left:3px solid transparent; min-width:150px; }
.ib svg { width:24px; height:24px; flex:none; }
.ib .pc-line { fill:none; stroke:var(--i-line); stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; }
.ib .pc-accent { fill:none; stroke:var(--i-accent); stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; }
.ib .pc-accent-fill { fill:var(--i-accent); }
.ib .pc-fill { fill:var(--i-fill); }
</style>
</head>
<body>
<nav><b>As-built style sheet</b><a href="#colours">Colours</a><a href="#contrast">Contrast</a><a href="#type">Type</a><a href="#space">Spacing</a><a href="#shape">Radii &amp; shadows</a><a href="#proposal">Proposed scales</a></nav>
<main>
<h1>As-built design system <small>generated ${ix.generated.slice(0, 16).replace('T', ' ')} UTC by tools/as-built-scan.ts · ${ix.files.length} files · ${ix.screens.length} screen samples · read with design/tokens/AS-BUILT-INDEX.md</small></h1>
<h2 id="colours">Colours <small>as built: ${ix.colours.filter((c) => !c.derived).length} written or tokenised (+${ix.colours.filter((c) => c.derived).length} derived). Badges: contrast on the light (L) and dark (D) surface. Label: tokens · uses in code / elements seen.</small></h2>
${colourHtml}
<h2 id="contrast">Text below WCAG AA on screen <small>${fails.length} of ${ix.pairs.length} pairs</small></h2>
${pairHtml}
<h2 id="type">Text styles seen on screen</h2>
${typeHtml}
<h2 id="space">Spacing in use <small>bar = value × 3; red = off the 4 px grid</small></h2>
${spaceHtml}
<h2 id="shape">Radii and shadows</h2>
<div class="grid">${radiusHtml}</div>
<h3>Shadows</h3>
<div class="grid">${shadowHtml}</div>
<h2 id="proposal">Proposed base scales (🛑 for approval)</h2>
${proposalHtml}
</main>
</body>
</html>
`;
}

const ICONS: Record<string, string> = {
  wall: '<rect class="pc-fill" x="3" y="8.5" width="18" height="7" rx="1.5"/><path class="pc-accent" d="M7 15.5l4-7M12 15.5l4-7M17 15.5l2.6-4.6"/><rect class="pc-line" x="3" y="8.5" width="18" height="7" rx="1.5"/>',
  door: '<path class="pc-fill" d="M6 20V7a13 13 0 0 1 13 13z"/><path class="pc-accent" d="M6 7a13 13 0 0 1 13 13" stroke-dasharray="2 2.2"/><path class="pc-line" d="M2.5 20H6M19 20h2.5M6 20V7"/>',
  room: '<rect class="pc-fill" x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path class="pc-line" d="M9 20.5H6a2.5 2.5 0 0 1-2.5-2.5V6A2.5 2.5 0 0 1 6 3.5h12A2.5 2.5 0 0 1 20.5 6v12a2.5 2.5 0 0 1-2.5 2.5h-3"/><circle class="pc-accent-fill" cx="12" cy="11" r="1.6"/><path class="pc-accent" d="M12 6.5v1.5M12 14v1.5M7.5 11h1.5M15 11h1.5"/>',
  'generate-layout':
    '<rect class="pc-fill" x="3" y="6" width="14" height="15" rx="2"/><path class="pc-line" d="M17 11v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M3 13.5h7v7.5M10 13.5v-3"/><path class="pc-accent-fill" d="M18 2.5l1.1 2.9 2.9 1.1-2.9 1.1L18 10.5l-1.1-2.9-2.9-1.1 2.9-1.1z"/>',
};

/** A3 starter icons (§7) drawn with the proposed icon tokens, default and active, both themes. */
function iconPreview(p: Proposal): string {
  const panel = (t: 'light' | 'dark') => {
    const m = p.themes[t];
    const states = [
      {
        name: 'default',
        line: m['icon.line'],
        fill: m['icon.fill-neutral'],
        accent: m['icon.accent-muted'],
        bg: 'transparent',
        text: m['color.text.primary'],
        bar: 'transparent',
      },
      {
        name: 'active',
        line: m['icon.line-strong'],
        fill: m['icon.fill-active'],
        accent: m['icon.accent'],
        bg: m['color.accent.subtle'],
        text: m['color.accent.default'],
        bar: m['color.accent.default'],
      },
    ];
    return `<div class="theme" style="background:${m['color.bg.surface']}"><h4 style="color:${m['color.text.primary']};width:100%">${t}</h4>${states
      .flatMap((s) =>
        Object.entries(ICONS).map(
          ([name, body]) =>
            `<div class="ib" style="--i-line:${s.line};--i-fill:${s.fill};--i-accent:${s.accent};background:${s.bg};color:${s.text};border-left-color:${s.bar}"><svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>${name} · ${s.name}</div>`,
        ),
      )
      .join('')}</div>`;
  };
  return `<h3>Icon tokens (A3 duotone, founder's light-mode rule) — preview with 4 of the A3 §7 starter icons</h3><div class="icons">${panel('light')}${panel('dark')}</div>`;
}

export function writeSheet(path: string, ix: Index, proposalPath: string) {
  const proposal = existsSync(proposalPath)
    ? (JSON.parse(readFileSync(proposalPath, 'utf8')) as Proposal)
    : null;
  writeFileSync(path, sheet(ix, proposal));
}
