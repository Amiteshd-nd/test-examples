# As-built design system — 6 Nov 2026

> **What this is:** skill `plancraft-ux-refine` §3.6 (v1.2): an index of the styles the code **already** uses, made before any token work. **Read-only: no styles were changed.**
> **How it was made:** `node tools/as-built-scan.ts` reads every stylesheet and component in `frontend/src` (plus the engine's thumbnail renderer), then opens 7 screens in headless Chrome at 1440 × 900 in light and dark and records the computed style of every visible element (Vault home, ⌘K palette, + New menu, Plan Library, editor, `/styleguide.html`, `/vault.html`). Use `--static` for code only. Then run `npx prettier --write design/tokens/as-built.json design/tokens/as-built-sheet.html`.
> **Files:** this report (the part between the GENERATED markers is rewritten on every run; the rest is hand-written) · `as-built.json` (same data, for diffing at the next audit) · `as-built-sheet.html` (open in a browser: swatches, contrast, type specimens, spacing ruler, radii, shadows, and the proposed scales with an icon preview in both themes) · `proposed-scales.json` (the proposal's values).
> **Snapshot:** other sessions were editing the frontend while this ran (e.g. the dashboard search text changed at about 21:58). Re-run before migrating anything.

## Summary for the founder (plain language)

- **The design system in the code is small and mostly tidy.** One accent (blueprint blue), cool greys, two fonts (Geist and Geist Mono), and almost every colour already goes through the named colours in `tokens.css`. 78 % of spacing values sit on the 4 px grid; most of the rest are the 2 px and 6 px half-steps DESIGN.md allows.
- **Colours:** 67 real colours (plus 29 the browser mixes for the folder art). The near-duplicates are mostly deliberate: the dark backgrounds are 1–2 steps apart on purpose so panels layer. Two true merges: the canvas dot grey into the hairline grey, and a stray `#111111` (3 places) into the ink `#111114`.
- **Contrast — the part that matters:** the main text colour passes everywhere. Below the accessibility minimum (WCAG AA): grey secondary text on hover and selected rows (4.3–4.4 : 1, needs 4.5), the warning orange on the app background (4.49), status colours on selected rows, the orange folder chip (3.6), white text on the glass folder pills (needs a check by eye: it sits on a blur), and **the outlines of input fields** (1.5–1.7 : 1; a field's edge needs 3 : 1). The faint grey is fine only for disabled things.
- **Text sizes:** 7 sizes make the scale (11, 12, 13, 15, 22, 24, 40 px) — dense and CAD-like; it doesn't follow one mathematical ratio and doesn't need to. Much of the interface is 11–12 px; the skill's bar for an older draftsman is 13 px (decision 5).
- **Small click targets:** snap chips, breadcrumbs, text links, the switch and the checkbox are under 24 px tall (the accessibility minimum).
- **Small inconsistencies:** a few one-off sizes (5, 7, 10, 18 px spacing; 3, 5, 10, 18 px corners; 220 ms animations), most inside the folder art or with a reason (see "Mapping"). DESIGN.md lists the canvas dot colour as `#D6D6E0` / `#2B2B35`, but the code uses `#CBCBD8` / `#33333F`.

## Decisions — answered 6 Nov 2026 (DS-01)

**Founder:** "Approve 1–4, 6, 7; keep 11 px floor; code wins." So: token names and scales, the four contrast fixes, the control border, readable placeholders, 24 px targets and the icon tokens are in (`design/tokens/`, `npm run tokens`, see `TOKEN-INDEX.md` and `CHANGELOG.md`); text below 11 px was raised to 11 px; where DESIGN.md and the code disagreed, the code's values stay (canvas dot, 220 ms folder motion). The list below is the original question set, kept for the record.

### Original questions

1. **Token names and base scales** in "Proposal" below: renaming only; nothing looks different. Approve?
2. **Four light-theme contrast fixes**, each a slight darkening: secondary text `#6B6B78 → #656571`, warning `#B45309 → #A34A07`, success `#1B7F46 → #18753F`, error `#C93035 → #BB2B30`.
3. **Input and checkbox outlines:** a new, darker *control border* (`#84848E` light, `#72727E` dark) so fields meet 3 : 1. Visible change: field edges get a little stronger. Hairlines and `+` corner marks stay as they are.
4. **Placeholders** use the secondary grey (passes) instead of the faint grey; faint stays for disabled items only.
5. **Smallest text:** keep 11 px as the floor and raise the 9–10 px exceptions (avatar initials, folder pills, editor badges) to 11 px — or raise the floor to 12–13 px for older users (bigger change; a UI-scale setting is the other route).
6. **Small targets:** give snap chips, breadcrumbs, text links, the switch and the checkbox a hit area of at least 24 px (they can look the same).
7. **Icons (your rule):** approve the light and dark icon token values in "Proposal → Icon tokens"; preview at the bottom of `as-built-sheet.html`. The full icon sheet still comes in PI.3, in both themes.
8. **Housekeeping:** 220 ms → 200 ms for the folder-art animation; DESIGN.md's canvas-dot values corrected to what the code uses (or the code to DESIGN.md: which one?).

<!-- GENERATED:START (node tools/as-built-scan.ts) -->

## Numbers (generated 2026-11-06)

- **Sources:** 44 files (6 stylesheets, 38 TS/TSX incl. the engine thumbnail renderer); runtime: 14 screen samples at 1440 × 900 (vault-home, vault-palette, vault-new-menu, vault-library, editor, styleguide, vault-components), light and dark, 4984 visible elements.
- **Root font size:** calc(100% * var(--pc-ui-scale, 1)) (frontend/src/design/ui.css:12, selector html) — so `1rem` = 16 px here.
- **Colours:** 117 distinct (80 written or tokenised, 37 derived by `color-mix()`); 26 near-duplicate pairs among them (ΔE2000 < 2); 30 uses of `transparent` not listed.
- **Contrast:** 38 token pairs below target; 1 of 64 text/background pairs seen on screen below WCAG AA.
- **Type:** Geist Variable, Geist Mono Variable; 8 font sizes (8, 11, 12, 13, 15, 22, 24, 40 px).
- **Spacing:** 448 written values; 79 % on the 4 px grid, 46 % on 8 px, 97 % on 2 px. 40 runtime `margin: auto` values ignored.
- **Other scales:** 16 radii, 24 shadow recipes, 4 durations, 7 z-index values, 7 media/supports rules.

## Colours

Uses = declarations in code (each theme counted) / elements seen on screen. "fixed" = hard-coded, does not follow the theme. Sorted by family, then light → dark.

### amber (5)

| value | role(s) | themes | uses (code / seen) | token(s) now | where | near-duplicate of | proposed token |
|---|---|---|---|---|---|---|---|
| `#f0e442` |  | light, dark | 0 / 0 | `--pc-color-categorical-4 (light)` `--pc-color-categorical-4 (dark)` |  |  | ? --pc-color-categorical-4 |
| `#ffd3b0` | data, background | fixed, light, dark | 1 / 6 |  | `vault/demo.ts:123` |  | data colour (avatars/demo): categorical palette |
| `#f5a524` | text, background, other | dark, fixed, light | 5 / 4 | `--pc-color-amber-400 (light)` `--pc-color-amber-400 (dark)` `--pc-color-status-warning (dark)` `--warn (dark)` | `design/ui.css:522`, `editor/editor.css:74`, `vault/dashboard.css:198`, +2 more |  | ? --pc-color-amber-400, ? --pc-color-status-warning, color.status.warning |
| `#f5a52429` _(derived)_ | background | dark | 1 / 0 |  | `vault/vault.css:498` |  | derived (computed by color-mix; no token) |
| `#e69f00` |  | light, dark | 0 / 0 | `--pc-color-categorical-1 (light)` `--pc-color-categorical-1 (dark)` |  |  | ? --pc-color-categorical-1 |

### blue (14)

| value | role(s) | themes | uses (code / seen) | token(s) now | where | near-duplicate of | proposed token |
|---|---|---|---|---|---|---|---|
| `#c9cbff` | background, other, data | light, dark, fixed | 7 / 68 | `--pc-color-accent-200 (light)` `--pc-avatar-local-bg (light)` `--pc-color-accent-200 (dark)` `--pc-avatar-local-bg (dark)` | `editor/editor.css:94`, `design/tokens.ts:7`, `design/tokens.ts:153`, +2 more |  | ? --pc-color-accent-200, ? --pc-avatar-local-bg |
| `#a9acf7` _(derived)_ | background | light, dark | 2 / 0 |  | `vault/vault.css:354` | `#a5a8f5` (1.11) | derived (computed by color-mix; no token) |
| `#a5a8f5` | border, text, background, control, shadow, other, canvas, svg | dark, fixed, light | 31 / 25 | `--pc-color-accent-300 (light)` `--pc-color-accent-300 (dark)` `--pc-color-border-focus (dark)` `--pc-color-accent-default (dark)` `--pc-icon-accent (dark)` `--accent-strong (dark)` | `design/ui.css:35`, `design/ui.css:219`, `design/ui.css:236`, +28 more | `#a9acf7` (1.11) | ? --pc-color-accent-300, ? --pc-color-border-focus, ? --pc-color-accent-default, ? --pc-icon-accent, color.accent.default |
| `#56b4e9` |  | light, dark | 0 / 0 | `--pc-color-categorical-2 (light)` `--pc-color-categorical-2 (dark)` |  |  | ? --pc-color-categorical-2 |
| `#9a9df5` | background, other, svg | light, dark, fixed | 10 / 6 | `--pc-color-accent-350 (light)` `--pc-color-folder-blue-from (light)` `--pc-folder-card-blue-from (light)` `--folder-blue-from (light)` `--pc-color-accent-350 (dark)` `--pc-color-folder-blue-from (dark)` `--pc-folder-card-blue-from (dark)` `--folder-blue-from (dark)` | `vault/vault.css:248`, `vault/vault.css:418`, `vault/vault.css:422`, +3 more |  | ? --pc-color-accent-350, ? --pc-color-folder-blue-from, ? --pc-folder-card-blue-from, folder-card.blue.from |
| `#9a9df54d` _(derived)_ | background | light, dark | 2 / 0 |  | `vault/vault.css:305` |  | derived (computed by color-mix; no token) |
| `#8080dd` | other, canvas, background, svg | fixed, light, dark | 6 / 4 | `--pc-color-accent-500 (light)` `--pc-color-accent-decorative (light)` `--accent (light)` `--pc-color-accent-500 (dark)` `--pc-color-accent-decorative (dark)` `--accent (dark)` | `design/tokens.ts:16`, `design/tokens.ts:162`, `ui/PlanView.tsx:321`, +1 more |  | ? --pc-color-accent-500, ? --pc-color-accent-decorative, color.accent.decorative |
| `#6f71d6` _(derived)_ | background | light | 1 / 0 |  | `design/ui.css:189` |  | derived (computed by color-mix; no token) |
| `#0072b2` |  | light, dark | 0 / 0 | `--pc-color-categorical-5 (light)` `--pc-color-categorical-5 (dark)` |  |  | ? --pc-color-categorical-5 |
| `#5558cf` | border, background, text, control, shadow, other, canvas, svg | light, dark, fixed | 61 / 35 | `--pc-color-accent-600 (light)` `--pc-color-folder-blue-to (light)` `--pc-color-border-focus (light)` `--pc-color-accent-default (light)` `--pc-folder-card-blue-to (light)` `--pc-folder-card-blue-ink (light)` `--pc-icon-accent (light)` `--accent-strong (light)` `--folder-blue-to (light)` `--pc-color-accent-600 (dark)` `--pc-color-folder-blue-to (dark)` `--pc-folder-card-blue-to (dark)` `--pc-folder-card-blue-ink (dark)` `--folder-blue-to (dark)` | `design/ui.css:35`, `design/ui.css:185`, `design/ui.css:219`, +45 more |  | ? --pc-color-accent-600, ? --pc-color-folder-blue-to, ? --pc-color-border-focus, ? --pc-color-accent-default, ? --pc-folder-card-blue-to, ? --pc-folder-card-blue-ink, ? --pc-icon-accent, color.accent.default, folder-card.blue.to |
| `#5558cf29` | other | fixed, light, dark | 2 / 0 | `--pc-color-alpha-accent-600-16 (light)` `--pc-color-accent-fill (light)` `--pc-icon-fill-active (light)` `--pc-color-alpha-accent-600-16 (dark)` | `design/tokens.ts:18`, `design/tokens.ts:73` |  | ? --pc-color-alpha-accent-600-16, ? --pc-color-accent-fill, ? --pc-icon-fill-active |
| `#4c4eb4` _(derived)_ | background | dark | 1 / 0 |  | `design/ui.css:189` |  | derived (computed by color-mix; no token) |
| `#2e2e5c` | background, other, canvas, svg | dark, fixed, light | 5 / 17 | `--pc-color-accent-800 (light)` `--pc-color-accent-800 (dark)` `--pc-color-accent-tint (dark)` `--pc-color-accent-fill (dark)` `--pc-icon-fill-active (dark)` `--accent-tint (dark)` | `design/ui.css:500`, `design/tokens.ts:164`, `design/tokens.ts:166`, +2 more |  | ? --pc-color-accent-800, ? --pc-color-accent-tint, ? --pc-color-accent-fill, ? --pc-icon-fill-active, color.accent.tint |
| `#23234a` | background, other | dark, fixed, light | 9 / 18 | `--pc-color-accent-900 (light)` `--pc-color-accent-900 (dark)` `--pc-color-accent-subtle (dark)` `--accent-soft (dark)` | `design/ui.css:218`, `design/ui.css:721`, `editor/editor.css:217`, +6 more |  | ? --pc-color-accent-900, ? --pc-color-accent-subtle, color.accent.subtle |

### green (14)

| value | role(s) | themes | uses (code / seen) | token(s) now | where | near-duplicate of | proposed token |
|---|---|---|---|---|---|---|---|
| `#bfe8cf` | data, background | fixed, light, dark | 2 / 32 |  | `vault/demo.ts:122`, `vault/items.tsx:25` |  | data colour (avatars/demo): categorical palette |
| `#7adaa6` _(derived)_ | background | light, dark | 2 / 0 |  | `vault/vault.css:354` |  | derived (computed by color-mix; no token) |
| `#63d496` | background, other, svg | light, dark, fixed | 6 / 2 | `--pc-color-folder-green-from (light)` `--pc-folder-card-green-from (light)` `--folder-green-from (light)` `--pc-color-folder-green-from (dark)` `--pc-folder-card-green-from (dark)` `--folder-green-from (dark)` | `vault/vault.css:248`, `vault/vault.css:354`, `design/tokens.ts:55`, +1 more |  | ? --pc-color-folder-green-from, ? --pc-folder-card-green-from, folder-card.green.from |
| `#63d4964d` _(derived)_ | background | light, dark | 2 / 0 |  | `vault/vault.css:305` |  | derived (computed by color-mix; no token) |
| `#3dd68c` | text, other, background | dark, fixed, light | 3 / 3 | `--pc-color-green-300 (light)` `--pc-color-green-300 (dark)` `--pc-color-status-success (dark)` `--ok (dark)` | `design/ui.css:519`, `vault/vault.css:503`, `design/tokens.ts:179` |  | ? --pc-color-green-300, ? --pc-color-status-success, color.status.success |
| `#3dd68c29` _(derived)_ | background | dark | 1 / 0 |  | `vault/vault.css:502` |  | derived (computed by color-mix; no token) |
| `#43b577` _(derived)_ | background | light, dark | 6 / 0 |  | `vault/vault.css:418`, `vault/vault.css:422`, `vault/vault.css:429` |  | derived (computed by color-mix; no token) |
| `#009e73` |  | light, dark | 0 / 0 | `--pc-color-categorical-3 (light)` `--pc-color-categorical-3 (dark)` |  |  | ? --pc-color-categorical-3 |
| `#3c9868` _(derived)_ | background | light | 1 / 0 |  | `design/ui.css:189` |  | derived (computed by color-mix; no token) |
| `#1b8f52` | background, other, svg | light, dark, fixed | 6 / 2 | `--pc-color-folder-green-to (light)` `--pc-folder-card-green-to (light)` `--folder-green-to (light)` `--pc-color-folder-green-to (dark)` `--pc-folder-card-green-to (dark)` `--folder-green-to (dark)` | `vault/vault.css:239`, `vault/vault.css:248`, `design/tokens.ts:57`, +1 more |  | ? --pc-color-folder-green-to, ? --pc-folder-card-green-to, folder-card.green.to |
| `#19864d` | background, border, text, other, canvas | light, dark, fixed | 26 / 0 | `--pc-color-folder-green-ink (light)` `--pc-folder-card-green-ink (light)` `--pc-color-folder-green-ink (dark)` `--pc-folder-card-green-ink (dark)` | `design/ui.css:185`, `design/ui.css:231`, `design/ui.css:485`, +11 more |  | ? --pc-color-folder-green-ink, ? --pc-folder-card-green-ink |
| `#197546` _(derived)_ | background | dark | 1 / 0 |  | `design/ui.css:189` | `#18753f` (1.75) | derived (computed by color-mix; no token) |
| `#18753f` | text, other, background | light, fixed, dark | 3 / 3 | `--pc-color-green-700 (light)` `--pc-color-status-success (light)` `--ok (light)` `--pc-color-green-700 (dark)` | `design/ui.css:519`, `vault/vault.css:503`, `design/tokens.ts:33` | `#197546` (1.75) | ? --pc-color-green-700, ? --pc-color-status-success, color.status.success |
| `#18753f29` _(derived)_ | background | light | 1 / 0 |  | `vault/vault.css:502` |  | derived (computed by color-mix; no token) |

### neutral (56)

| value | role(s) | themes | uses (code / seen) | token(s) now | where | near-duplicate of | proposed token |
|---|---|---|---|---|---|---|---|
| `#ffffff` | text, background, other, canvas, svg | light, dark, fixed | 46 / 276 | `--pc-color-neutral-0 (light)` `--pc-color-bg-surface (light)` `--pc-color-text-inverse (light)` `--pc-folder-card-pill-text (light)` `--pc-paper-bg (light)` `--surface (light)` `--on-ink (light)` `--pc-color-neutral-0 (dark)` `--pc-color-text-strong (dark)` `--pc-folder-card-pill-text (dark)` `--pc-icon-line-strong (dark)` `--pc-paper-bg (dark)` | `design/ui.css:186`, `design/ui.css:192`, `design/ui.css:205`, +39 more | `#fafafb` (1.12) | ? --pc-color-neutral-0, ? --pc-color-bg-surface, ? --pc-color-text-inverse, ? --pc-folder-card-pill-text, ? --pc-paper-bg, color.bg.surface, color.text.inverse, ? --pc-color-text-strong, ? --pc-icon-line-strong |
| `#ffffffb3` | border | light, dark | 2 / 312 |  | `vault/vault.css:345` |  | component: folder-card.* |
| `#ffffff80` | shadow | light, dark | 2 / 0 |  | `vault/vault.css:310` |  | component: folder-card.* |
| `#ffffff57` _(derived)_ | background | light, dark | 2 / 0 |  | `vault/vault.css:305` |  | derived (computed by color-mix; no token) |
| `#ffffff1f` _(derived)_ | background | light, dark | 2 / 0 |  | `vault/vault.css:305` | `#ffffff1a` (0), `#ffffff14` (0) | derived (computed by color-mix; no token) |
| `#ffffff1a` | other | fixed, light, dark | 2 / 0 | `--pc-color-alpha-white-10 (light)` `--pc-color-alpha-white-10 (dark)` `--pc-color-state-subtle-fill (dark)` `--pc-icon-fill-neutral (dark)` | `design/tokens.ts:177`, `design/tokens.ts:220` | `#ffffff1f` (0), `#ffffff14` (0) | ? --pc-color-alpha-white-10, ? --pc-color-state-subtle-fill, ? --pc-icon-fill-neutral |
| `#ffffff14` | shadow | light, dark | 2 / 0 |  | `vault/vault.css:392` | `#ffffff1a` (0), `#ffffff1f` (0) | merge → ? --pc-color-alpha-white-10 |
| `#fafafb` | background, other, canvas, svg | light, fixed, dark | 3 / 27 | `--pc-color-neutral-25 (light)` `--pc-canvas-bg (light)` `--canvas (light)` `--pc-color-neutral-25 (dark)` | `design/ui.css:139`, `design/tokens.ts:14`, `ui/PlanView.tsx:144` | `#ffffff` (1.12), `#f2f2f4` (1.7) | ? --pc-color-neutral-25, ? --pc-canvas-bg, canvas.bg |
| `#f2f2f4` | background, text, other, canvas, svg, border | light, dark, fixed | 49 / 544 | `--pc-color-neutral-50 (light)` `--pc-color-bg-app (light)` `--pc-color-bg-inset (light)` `--bg (light)` `--surface-2 (light)` `--pc-color-neutral-50 (dark)` `--pc-color-bg-inverse (dark)` `--pc-color-text-primary (dark)` `--pc-icon-line (dark)` `--text (dark)` `--ink (dark)` | `design/ui.css:17`, `design/ui.css:18`, `design/ui.css:193`, +46 more | `#fafafb` (1.7) | ? --pc-color-neutral-50, ? --pc-color-bg-app, ? --pc-color-bg-inset, color.bg.app, color.bg.inset, ? --pc-color-bg-inverse, ? --pc-color-text-primary, ? --pc-icon-line, color.text.primary, color.bg.inverse |
| `#eaeafa` | background, other | light, fixed, dark | 9 / 18 | `--pc-color-accent-50 (light)` `--pc-color-accent-subtle (light)` `--accent-soft (light)` `--pc-color-accent-50 (dark)` | `design/ui.css:218`, `design/ui.css:721`, `editor/editor.css:217`, +6 more | `#e4e4f2` (1.54) | ? --pc-color-accent-50, ? --pc-color-accent-subtle, color.accent.subtle |
| `#e8e8ee` | background, other | light, fixed, dark | 4 / 1 | `--pc-color-neutral-100 (light)` `--pc-color-state-hover-bg (light)` `--surface-3 (light)` `--pc-color-neutral-100 (dark)` | `design/ui.css:198`, `editor/editor.css:240`, `editor/editor.css:498`, +1 more | `#e2e2e8` (1.31) | ? --pc-color-neutral-100, ? --pc-color-state-hover-bg, color.state.hover-bg |
| `#e4e4f2` | background, other, canvas, svg | light, fixed, dark | 8 / 291 | `--pc-color-accent-100 (light)` `--pc-color-accent-tint (light)` `--pc-paper-room (light)` `--accent-tint (light)` `--pc-color-accent-100 (dark)` `--pc-paper-room (dark)` | `design/ui.css:500`, `design/tokens.ts:20`, `design/tokens.ts:88`, +4 more | `#eaeafa` (1.54) | ? --pc-color-accent-100, ? --pc-color-accent-tint, ? --pc-paper-room, color.accent.tint |
| `#e2e2e8` | border, background, shadow, other | light, fixed, dark | 45 / 277 | `--pc-color-neutral-150 (light)` `--pc-color-border-subtle (light)` `--line (light)` `--pc-color-neutral-150 (dark)` | `design/ui.css:145`, `design/ui.css:224`, `design/ui.css:327`, +42 more | `#e8e8ee` (1.31) | ? --pc-color-neutral-150, ? --pc-color-border-subtle, color.border.subtle |
| `#c8c8d2` | background, border, other | light, fixed, dark | 11 / 95 | `--pc-color-neutral-200 (light)` `--pc-color-border-default (light)` `--pc-canvas-grid-minor (light)` `--pc-marks-color (light)` `--canvas-dot (light)` `--line-strong (light)` `--pc-color-neutral-200 (dark)` | `design/ui.css:113`, `design/ui.css:140`, `design/ui.css:194`, +8 more |  | ? --pc-color-neutral-200, ? --pc-color-border-default, ? --pc-canvas-grid-minor, ? --pc-marks-color, canvas.grid.minor, color.border.default |
| `#a0a0ae` | text, other, canvas, svg, background | dark, fixed, light | 37 / 416 | `--pc-color-neutral-400 (light)` `--pc-color-neutral-400 (dark)` `--pc-color-text-secondary (dark)` `--pc-color-text-placeholder (dark)` `--pc-icon-accent-muted (dark)` `--text-muted (dark)` | `design/ui.css:57`, `design/ui.css:74`, `design/ui.css:90`, +34 more |  | ? --pc-color-neutral-400, ? --pc-color-text-secondary, ? --pc-color-text-placeholder, ? --pc-icon-accent-muted, color.text.secondary |
| `#9a9aa6` | text, other, background | light, fixed, dark | 3 / 1 | `--pc-color-neutral-450 (light)` `--pc-color-text-disabled (light)` `--text-faint (light)` `--pc-color-neutral-450 (dark)` | `design/ui.css:725`, `editor/editor.css:462`, `design/tokens.ts:35` |  | ? --pc-color-neutral-450, ? --pc-color-text-disabled, color.text.disabled |
| `#84848e` | border, background, other | light, fixed, dark | 3 / 60 | `--pc-color-neutral-500 (light)` `--pc-color-border-control (light)` `--pc-color-neutral-500 (dark)` | `design/ui.css:266`, `design/ui.css:350`, `design/tokens.ts:26` |  | ? --pc-color-neutral-500, ? --pc-color-border-control |
| `#72727e` | border, background, other | dark, fixed, light | 3 / 68 | `--pc-color-neutral-550 (light)` `--pc-color-neutral-550 (dark)` `--pc-color-border-control (dark)` | `design/ui.css:266`, `design/ui.css:350`, `design/tokens.ts:172` | `#6e6e7a` (1.58) | ? --pc-color-neutral-550, ? --pc-color-border-control |
| `#6e6e7a` | text, other, background | dark, fixed, light | 3 / 1 | `--pc-color-neutral-575 (light)` `--pc-color-neutral-575 (dark)` `--pc-color-text-disabled (dark)` `--text-faint (dark)` | `design/ui.css:725`, `editor/editor.css:462`, `design/tokens.ts:181` | `#72727e` (1.58), `#6b6b78` (1.24) | ? --pc-color-neutral-575, ? --pc-color-text-disabled, color.text.disabled |
| `#6b6b78` | canvas | fixed | 1 / 0 |  | `engine/render/thumbnail.ts:50` | `#6e6e7a` (1.24) | merge → ? --pc-color-neutral-575 |
| `#6a6a70` | background | light, dark | 2 / 0 |  | `vault/vault.css:411` |  | component: folder-card.* |
| `#656571` | text, other, canvas, svg, background | light, fixed, dark | 37 / 354 | `--pc-color-neutral-600 (light)` `--pc-color-text-secondary (light)` `--pc-color-text-placeholder (light)` `--pc-icon-accent-muted (light)` `--text-muted (light)` `--pc-color-neutral-600 (dark)` | `design/ui.css:57`, `design/ui.css:74`, `design/ui.css:90`, +34 more |  | ? --pc-color-neutral-600, ? --pc-color-text-secondary, ? --pc-color-text-placeholder, ? --pc-icon-accent-muted, color.text.secondary |
| `#656569` _(derived)_ | background | light, dark | 2 / 0 |  | `vault/vault.css:354` |  | derived (computed by color-mix; no token) |
| `#5a5a60` | background | light, dark | 2 / 0 |  | `vault/vault.css:401` | `#58585b` (1.92) | component: folder-card.* |
| `#58585b` _(derived)_ | background | light, dark | 2 / 0 |  | `vault/vault.css:354` | `#5a5a60` (1.92) | derived (computed by color-mix; no token) |
| `#4a4a4e` | background, other, svg | light, dark, fixed | 6 / 30 | `--pc-color-folder-graphite-from (light)` `--pc-folder-card-graphite-from (light)` `--folder-graphite-from (light)` `--pc-color-folder-graphite-from (dark)` `--pc-folder-card-graphite-from (dark)` `--folder-graphite-from (dark)` | `vault/vault.css:248`, `vault/vault.css:354`, `design/tokens.ts:52`, +1 more |  | ? --pc-color-folder-graphite-from, ? --pc-folder-card-graphite-from, folder-card.graphite.from |
| `#4a4a4e4d` _(derived)_ | background | light, dark | 2 / 0 |  | `vault/vault.css:305` |  | derived (computed by color-mix; no token) |
| `#3e3e40` _(derived)_ | background | light | 1 / 0 |  | `design/ui.css:189` | `#3a3a3e` (1.82) | derived (computed by color-mix; no token) |
| `#3b3b45` | background, border, other | dark, fixed, light | 9 / 111 | `--pc-color-neutral-750 (light)` `--pc-color-neutral-750 (dark)` `--pc-color-border-default (dark)` `--pc-marks-color (dark)` `--line-strong (dark)` | `design/ui.css:113`, `design/ui.css:194`, `design/ui.css:342`, +6 more |  | ? --pc-color-neutral-750, ? --pc-color-border-default, ? --pc-marks-color, color.border.default |
| `#3a3a3e` | background | light, dark, fixed | 4 / 0 |  | `vault/vault.css:248`, `vault/vault.css:354` | `#3e3e40` (1.82), `#353538` (1.76) | component: folder-card.* |
| `#3a3a3e4d` _(derived)_ | background | light, dark | 2 / 0 |  | `vault/vault.css:305` |  | derived (computed by color-mix; no token) |
| `#353538` _(derived)_ | background | light, dark | 6 / 0 |  | `vault/vault.css:418`, `vault/vault.css:422`, `vault/vault.css:429` | `#3a3a3e` (1.76) | derived (computed by color-mix; no token) |
| `#33333f` | background, other | dark, fixed, light | 2 / 0 | `--pc-color-neutral-775 (light)` `--pc-color-neutral-775 (dark)` `--pc-canvas-grid-minor (dark)` `--canvas-dot (dark)` | `design/ui.css:140`, `design/tokens.ts:161` |  | ? --pc-color-neutral-775, ? --pc-canvas-grid-minor, canvas.grid.minor |
| `#2c2c30` | background | light, dark | 2 / 0 |  | `vault/vault.css:388` | `#2a2a2e` (0.64), `#2b2b2e` (0.74) | component: folder-card.* |
| `#2b2b2e` _(derived)_ | background | light, dark | 6 / 0 |  | `vault/vault.css:418`, `vault/vault.css:422`, `vault/vault.css:429` | `#2c2c30` (0.74), `#2a2a2e` (0.74) | derived (computed by color-mix; no token) |
| `#2a2a31` | border, background, shadow, other | dark, fixed, light | 45 / 307 | `--pc-color-neutral-800 (light)` `--pc-color-neutral-800 (dark)` `--pc-color-border-subtle (dark)` `--line (dark)` | `design/ui.css:145`, `design/ui.css:224`, `design/ui.css:327`, +42 more | `#27272e` (0.95), `#2a2a2e` (1.91) | ? --pc-color-neutral-800, ? --pc-color-border-subtle, color.border.subtle |
| `#2a2a2e` | background | light, dark | 2 / 0 |  | `vault/vault.css:401` | `#2a2a31` (1.91), `#2c2c30` (0.64), `#2b2b2e` (0.74) | merge → ? --pc-color-neutral-800 |
| `#27272e` | background, other | dark, fixed, light | 5 / 8 | `--pc-color-neutral-825 (light)` `--pc-color-neutral-825 (dark)` `--pc-color-state-hover-bg (dark)` `--surface-3 (dark)` | `design/ui.css:198`, `editor/editor.css:240`, `editor/editor.css:498`, +2 more | `#2a2a31` (0.95) | ? --pc-color-neutral-825, ? --pc-color-state-hover-bg, color.state.hover-bg |
| `#1e1e23` | background, other | dark, fixed, light | 19 / 52 | `--pc-color-neutral-850 (light)` `--pc-color-neutral-850 (dark)` `--pc-color-bg-inset (dark)` `--surface-2 (dark)` | `design/ui.css:265`, `design/ui.css:325`, `design/ui.css:456`, +16 more | `#1b1b1e` (1.68) | ? --pc-color-neutral-850, ? --pc-color-bg-inset, color.bg.inset |
| `#1c1c1e` | background, border, text, other, canvas, svg | light, dark, fixed | 32 / 30 | `--pc-color-folder-graphite-to (light)` `--pc-folder-card-graphite-to (light)` `--pc-folder-card-graphite-ink (light)` `--folder-graphite-to (light)` `--pc-color-folder-graphite-to (dark)` `--pc-folder-card-graphite-to (dark)` `--pc-folder-card-graphite-ink (dark)` `--folder-graphite-to (dark)` | `design/ui.css:185`, `design/ui.css:231`, `design/ui.css:485`, +15 more | `#18181b` (1.45), `#1b1b1e` (0.79) | ? --pc-color-folder-graphite-to, ? --pc-folder-card-graphite-to, ? --pc-folder-card-graphite-ink, folder-card.graphite.to |
| `#1b1b1e` | background | dark, light | 3 / 0 |  | `design/ui.css:189`, `vault/vault.css:388` | `#1e1e23` (1.68), `#17171b` (1.45), `#1c1c1e` (0.79), `#18181b` (0.94) | merge → ? --pc-color-neutral-850 |
| `#18181b` | background | light, dark, fixed | 4 / 0 |  | `vault/vault.css:239`, `vault/vault.css:248` | `#17171b` (0.79), `#121216` (1.72), `#111114` (1.99), `#1c1c1e` (1.45), `#1b1b1e` (0.94) | merge → ? --pc-color-neutral-900 |
| `#17171b` | background, other, canvas, svg | dark, fixed, light | 24 / 50 | `--pc-color-neutral-900 (light)` `--pc-color-neutral-900 (dark)` `--pc-color-bg-surface (dark)` `--surface (dark)` | `design/ui.css:192`, `design/ui.css:205`, `design/ui.css:222`, +21 more | `#121216` (1.45), `#18181b` (0.79), `#1b1b1e` (1.45) | ? --pc-color-neutral-900, ? --pc-color-bg-surface, color.bg.surface |
| `#121216` | background, other, canvas, svg | dark, fixed, light | 3 / 27 | `--pc-color-neutral-925 (light)` `--pc-color-neutral-925 (dark)` `--pc-canvas-bg (dark)` `--canvas (dark)` | `design/ui.css:139`, `design/tokens.ts:160`, `ui/PlanView.tsx:144` | `#17171b` (1.45), `#111114` (0.8), `#0e0e11` (1.35), `#18181b` (1.72) | ? --pc-color-neutral-925, ? --pc-canvas-bg, canvas.bg |
| `#111114` | text, other, canvas, background, svg, border | light, dark, fixed | 47 / 1134 | `--pc-color-neutral-950 (light)` `--pc-color-bg-inverse (light)` `--pc-color-text-primary (light)` `--pc-color-text-strong (light)` `--pc-avatar-text (light)` `--pc-icon-line (light)` `--pc-icon-line-strong (light)` `--pc-paper-ink (light)` `--text (light)` `--ink (light)` `--pc-color-neutral-950 (dark)` `--pc-color-text-inverse (dark)` `--pc-avatar-text (dark)` `--pc-paper-ink (dark)` `--on-ink (dark)` | `design/ui.css:18`, `design/ui.css:186`, `design/ui.css:193`, +40 more | `#121216` (0.8), `#0e0e11` (0.7), `#18181b` (1.99) | ? --pc-color-neutral-950, ? --pc-color-bg-inverse, ? --pc-color-text-primary, ? --pc-color-text-strong, ? --pc-avatar-text, ? --pc-icon-line, ? --pc-icon-line-strong, ? --pc-paper-ink, color.text.primary, color.bg.inverse, ? --pc-color-text-inverse, color.text.inverse |
| `#11111499` | background, other | light, dark, fixed | 4 / 72 | `--pc-color-alpha-ink-60 (light)` `--pc-folder-card-pill-bg (light)` `--pc-color-alpha-ink-60 (dark)` `--pc-folder-card-pill-bg (dark)` | `vault/vault.css:327`, `design/tokens.ts:62`, `design/tokens.ts:208` |  | ? --pc-color-alpha-ink-60, ? --pc-folder-card-pill-bg |
| `#1111143d` | background, other | light, fixed, dark | 2 / 1 | `--pc-color-alpha-ink-24 (light)` `--pc-color-bg-scrim (light)` `--backdrop (light)` `--pc-color-alpha-ink-24 (dark)` | `design/ui.css:612`, `design/tokens.ts:24` |  | ? --pc-color-alpha-ink-24, ? --pc-color-bg-scrim, color.bg.scrim |
| `#11111414` | shadow, other | light, fixed, dark | 8 / 0 | `--pc-shadow-400-light (light)` `--pc-elevation-overlay (light)` `--shadow-float (light)` `--pc-shadow-400-light (dark)` | `design/ui.css:603`, `design/ui.css:621`, `design/ui.css:643`, +5 more | `#11111412` (0), `#1111140f` (0) | ? --pc-shadow-400-light, ? --pc-elevation-overlay, elevation.overlay |
| `#11111412` | other | fixed, light, dark | 2 / 0 | `--pc-color-alpha-ink-7 (light)` `--pc-color-state-subtle-fill (light)` `--pc-icon-fill-neutral (light)` `--pc-color-alpha-ink-7 (dark)` | `design/tokens.ts:31`, `design/tokens.ts:74` | `#1111140f` (0), `#11111414` (0) | ? --pc-color-alpha-ink-7, ? --pc-color-state-subtle-fill, ? --pc-icon-fill-neutral |
| `#1111140f` | shadow, other | light, dark, fixed | 12 / 0 | `--pc-shadow-100 (light)` `--pc-shadow-400-light (light)` `--pc-elevation-raised (light)` `--pc-elevation-overlay (light)` `--shadow-float (light)` `--pc-shadow-100 (dark)` `--pc-shadow-400-light (dark)` `--pc-elevation-raised (dark)` | `design/ui.css:603`, `design/ui.css:621`, `design/ui.css:643`, +8 more | `#11111412` (0), `#11111414` (0) | ? --pc-shadow-100, ? --pc-shadow-400-light, ? --pc-elevation-raised, ? --pc-elevation-overlay, elevation.overlay |
| `#0e0e11` | background, other | dark, fixed, light | 6 / 15 | `--pc-color-neutral-975 (light)` `--pc-color-neutral-975 (dark)` `--pc-color-bg-app (dark)` `--bg (dark)` | `design/ui.css:17`, `editor/editor.css:7`, `styleguide/styleguide.css:15`, +3 more | `#121216` (1.35), `#111114` (0.7) | ? --pc-color-neutral-975, ? --pc-color-bg-app, color.bg.app |
| `#00000080` | background, other | dark, fixed, light | 2 / 1 | `--pc-color-alpha-black-50 (light)` `--pc-color-alpha-black-50 (dark)` `--pc-color-bg-scrim (dark)` `--backdrop (dark)` | `design/ui.css:612`, `design/tokens.ts:170` |  | ? --pc-color-alpha-black-50, ? --pc-color-bg-scrim, color.bg.scrim |
| `#00000073` | shadow, other | dark, fixed, light | 8 / 0 | `--pc-shadow-400-dark (light)` `--pc-shadow-400-dark (dark)` `--pc-elevation-overlay (dark)` `--shadow-float (dark)` | `design/ui.css:603`, `design/ui.css:621`, `design/ui.css:643`, +5 more |  | ? --pc-shadow-400-dark, ? --pc-elevation-overlay, elevation.overlay |
| `#00000066` | shadow, other | dark, fixed, light | 8 / 0 | `--pc-shadow-400-dark (light)` `--pc-shadow-400-dark (dark)` `--pc-elevation-overlay (dark)` `--shadow-float (dark)` | `design/ui.css:603`, `design/ui.css:621`, `design/ui.css:643`, +5 more |  | ? --pc-shadow-400-dark, ? --pc-elevation-overlay, elevation.overlay |
| `#0000002e` | shadow | light, dark | 4 / 0 |  | `vault/vault.css:257`, `vault/vault.css:370` | `#00000026` (0) | merge → ? --pc-shadow-200 |
| `#00000026` | shadow, other | light, dark, fixed | 4 / 0 | `--pc-shadow-200 (light)` `--pc-elevation-paper (light)` `--pc-shadow-200 (dark)` `--pc-elevation-paper (dark)` | `vault/dashboard.css:157`, `design/tokens.ts:42`, `design/tokens.ts:188` | `#0000002e` (0) | ? --pc-shadow-200, ? --pc-elevation-paper |

### orange (11)

| value | role(s) | themes | uses (code / seen) | token(s) now | where | near-duplicate of | proposed token |
|---|---|---|---|---|---|---|---|
| `#ffad73` _(derived)_ | background | light, dark | 2 / 0 |  | `vault/vault.css:354` |  | derived (computed by color-mix; no token) |
| `#ff9f5a` | background, other, svg | light, dark, fixed | 6 / 10 | `--pc-color-folder-orange-from (light)` `--pc-folder-card-orange-from (light)` `--folder-orange-from (light)` `--pc-color-folder-orange-from (dark)` `--pc-folder-card-orange-from (dark)` `--folder-orange-from (dark)` | `vault/vault.css:248`, `vault/vault.css:354`, `design/tokens.ts:59`, +1 more |  | ? --pc-color-folder-orange-from, ? --pc-folder-card-orange-from, folder-card.orange.from |
| `#ff9f5a4d` _(derived)_ | background | light, dark | 2 / 0 |  | `vault/vault.css:305` |  | derived (computed by color-mix; no token) |
| `#f58037` _(derived)_ | background | light, dark | 6 / 0 |  | `vault/vault.css:418`, `vault/vault.css:422`, `vault/vault.css:429` |  | derived (computed by color-mix; no token) |
| `#e8590c` | background, other, svg | light, dark, fixed | 6 / 10 | `--pc-color-folder-orange-to (light)` `--pc-folder-card-orange-to (light)` `--folder-orange-to (light)` `--pc-color-folder-orange-to (dark)` `--pc-folder-card-orange-to (dark)` `--folder-orange-to (dark)` | `vault/vault.css:239`, `vault/vault.css:248`, `design/tokens.ts:61`, +1 more |  | ? --pc-color-folder-orange-to, ? --pc-folder-card-orange-to, folder-card.orange.to |
| `#d55e00` |  | light, dark | 0 / 0 | `--pc-color-categorical-6 (light)` `--pc-color-categorical-6 (dark)` |  |  | ? --pc-color-categorical-6 |
| `#cb5e30` _(derived)_ | background | light | 1 / 0 |  | `design/ui.css:189` |  | derived (computed by color-mix; no token) |
| `#c2410c` | background, border, text, other, canvas | light, dark, fixed | 26 / 4 | `--pc-color-folder-orange-ink (light)` `--pc-folder-card-orange-ink (light)` `--pc-color-folder-orange-ink (dark)` `--pc-folder-card-orange-ink (dark)` | `design/ui.css:185`, `design/ui.css:231`, `design/ui.css:485`, +11 more |  | ? --pc-color-folder-orange-ink, ? --pc-folder-card-orange-ink |
| `#a34a07` | text, background, other | light, fixed, dark | 5 / 4 | `--pc-color-amber-700 (light)` `--pc-color-status-warning (light)` `--warn (light)` `--pc-color-amber-700 (dark)` | `design/ui.css:522`, `editor/editor.css:74`, `vault/dashboard.css:198`, +2 more |  | ? --pc-color-amber-700, ? --pc-color-status-warning, color.status.warning |
| `#a34a0729` _(derived)_ | background | light | 1 / 0 |  | `vault/vault.css:498` |  | derived (computed by color-mix; no token) |
| `#a83b0e` _(derived)_ | background | dark | 1 / 0 |  | `design/ui.css:189` |  | derived (computed by color-mix; no token) |

### pink (1)

| value | role(s) | themes | uses (code / seen) | token(s) now | where | near-duplicate of | proposed token |
|---|---|---|---|---|---|---|---|
| `#cc79a7` |  | light, dark | 0 / 0 | `--pc-color-categorical-7 (light)` `--pc-color-categorical-7 (dark)` |  |  | ? --pc-color-categorical-7 |

### purple (7)

| value | role(s) | themes | uses (code / seen) | token(s) now | where | near-duplicate of | proposed token |
|---|---|---|---|---|---|---|---|
| `#c3a2ff` _(derived)_ | background | light, dark | 2 / 0 |  | `vault/vault.css:354` |  | derived (computed by color-mix; no token) |
| `#b892ff` | background, other, svg | light, dark, fixed | 6 / 10 | `--pc-color-folder-purple-from (light)` `--pc-folder-card-purple-from (light)` `--folder-purple-from (light)` `--pc-color-folder-purple-from (dark)` `--pc-folder-card-purple-from (dark)` `--folder-purple-from (dark)` | `vault/vault.css:248`, `vault/vault.css:354`, `design/tokens.ts:64`, +1 more |  | ? --pc-color-folder-purple-from, ? --pc-folder-card-purple-from, folder-card.purple.from |
| `#b892ff4d` _(derived)_ | background | light, dark | 2 / 0 |  | `vault/vault.css:305` |  | derived (computed by color-mix; no token) |
| `#9c74f1` _(derived)_ | background | light, dark | 6 / 0 |  | `vault/vault.css:418`, `vault/vault.css:422`, `vault/vault.css:429` |  | derived (computed by color-mix; no token) |
| `#8e69e5` _(derived)_ | background | light | 1 / 0 |  | `design/ui.css:189` |  | derived (computed by color-mix; no token) |
| `#7a4fe0` | background, border, text, other, canvas, svg | light, dark, fixed | 32 / 10 | `--pc-color-folder-purple-to (light)` `--pc-folder-card-purple-to (light)` `--pc-folder-card-purple-ink (light)` `--folder-purple-to (light)` `--pc-color-folder-purple-to (dark)` `--pc-folder-card-purple-to (dark)` `--pc-folder-card-purple-ink (dark)` `--folder-purple-to (dark)` | `design/ui.css:185`, `design/ui.css:231`, `design/ui.css:485`, +15 more |  | ? --pc-color-folder-purple-to, ? --pc-folder-card-purple-to, ? --pc-folder-card-purple-ink, folder-card.purple.to |
| `#6b47c2` _(derived)_ | background | dark | 1 / 0 |  | `design/ui.css:189` |  | derived (computed by color-mix; no token) |

### red (9)

| value | role(s) | themes | uses (code / seen) | token(s) now | where | near-duplicate of | proposed token |
|---|---|---|---|---|---|---|---|
| `#ff9c93` _(derived)_ | background | light, dark | 2 / 0 |  | `vault/vault.css:354` |  | derived (computed by color-mix; no token) |
| `#ff8a80` | background, other, svg | light, dark, fixed | 6 / 10 | `--pc-color-folder-red-from (light)` `--pc-folder-card-red-from (light)` `--folder-red-from (light)` `--pc-color-folder-red-from (dark)` `--pc-folder-card-red-from (dark)` `--folder-red-from (dark)` | `vault/vault.css:248`, `vault/vault.css:354`, `design/tokens.ts:68`, +1 more |  | ? --pc-color-folder-red-from, ? --pc-folder-card-red-from, folder-card.red.from |
| `#ff8a804d` _(derived)_ | background | light, dark | 2 / 0 |  | `vault/vault.css:305` |  | derived (computed by color-mix; no token) |
| `#ff6b6b` | text, border, background, other | dark, fixed, light | 10 / 13 | `--pc-color-red-400 (light)` `--pc-color-red-400 (dark)` `--pc-color-status-error (dark)` `--error (dark)` | `design/ui.css:206`, `design/ui.css:207`, `design/ui.css:276`, +7 more |  | ? --pc-color-red-400, ? --pc-color-status-error, color.status.error |
| `#eb6663` _(derived)_ | background | light, dark | 6 / 0 |  | `vault/vault.css:418`, `vault/vault.css:422`, `vault/vault.css:429` |  | derived (computed by color-mix; no token) |
| `#da585d` _(derived)_ | background | light | 1 / 0 |  | `design/ui.css:189` |  | derived (computed by color-mix; no token) |
| `#d33a40` | background, border, text, other, canvas, svg | light, dark, fixed | 32 / 22 | `--pc-color-folder-red-to (light)` `--pc-folder-card-red-to (light)` `--pc-folder-card-red-ink (light)` `--folder-red-to (light)` `--pc-color-folder-red-to (dark)` `--pc-folder-card-red-to (dark)` `--pc-folder-card-red-ink (dark)` `--folder-red-to (dark)` | `design/ui.css:185`, `design/ui.css:231`, `design/ui.css:485`, +15 more |  | ? --pc-color-folder-red-to, ? --pc-folder-card-red-to, ? --pc-folder-card-red-ink, folder-card.red.to |
| `#b7353a` _(derived)_ | background | dark | 1 / 0 |  | `design/ui.css:189` |  | derived (computed by color-mix; no token) |
| `#bb2b30` | text, border, background, other | light, fixed, dark | 10 / 13 | `--pc-color-red-700 (light)` `--pc-color-status-error (light)` `--error (light)` `--pc-color-red-700 (dark)` | `design/ui.css:206`, `design/ui.css:207`, `design/ui.css:276`, +7 more |  | ? --pc-color-red-700, ? --pc-color-status-error, color.status.error |

## Contrast pairs

### Token pairs (from `tokens.css`)

Text needs 4.5:1; borders, focus rings and other meaningful UI parts need 3:1. ✗ = below.

**light — text**

| text ↓ / background → | `--bg` | `--canvas` | `--surface` | `--surface-2` | `--surface-3` | `--accent-soft` | `--accent-tint` |
|---|---|---|---|---|---|---|---|
| `--text` | 16.86 | 18.07 | 18.85 | 16.86 | 15.45 | 15.84 | 14.97 |
| `--text-muted` | 5.14 | 5.51 | 5.75 | 5.14 | 4.71 | 4.83 | 4.57 |
| `--text-faint` | 2.49 ✗ | 2.67 ✗ | 2.78 ✗ | 2.49 ✗ | 2.28 ✗ | 2.34 ✗ | 2.21 ✗ |
| `--accent-strong` | 5.1 | 5.47 | 5.7 | 5.1 | 4.67 | 4.79 | 4.53 |
| `--ok` | 5.14 | 5.51 | 5.75 | 5.14 | 4.71 | 4.83 | 4.56 |
| `--warn` | 5.31 | 5.69 | 5.93 | 5.31 | 4.86 | 4.99 | 4.71 |
| `--error` | 5.36 | 5.75 | 6 | 5.36 | 4.92 | 5.04 | 4.76 |

`--on-ink` on `--ink`: 18.85

**light — UI parts (3:1)**

| part ↓ / background → | `--bg` | `--canvas` | `--surface` | `--surface-2` |
|---|---|---|---|---|
| `--line-strong` | 1.49 ✗ | 1.59 ✗ | 1.66 ✗ | 1.49 ✗ |
| `--line` | 1.15 ✗ | 1.24 ✗ | 1.29 ✗ | 1.15 ✗ |
| `--accent` | 3.1 | 3.33 | 3.47 | 3.1 |
| `--accent-strong` | 5.1 | 5.47 | 5.7 | 5.1 |
| `--ink` | 16.86 | 18.07 | 18.85 | 16.86 |
| `--canvas-dot` | 1.49 ✗ | 1.59 ✗ | 1.66 ✗ | 1.49 ✗ |

**dark — text**

| text ↓ / background → | `--bg` | `--canvas` | `--surface` | `--surface-2` | `--surface-3` | `--accent-soft` | `--accent-tint` |
|---|---|---|---|---|---|---|---|
| `--text` | 17.24 | 16.71 | 15.99 | 14.85 | 13.27 | 13.31 | 11.3 |
| `--text-muted` | 7.47 | 7.24 | 6.92 | 6.43 | 5.74 | 5.77 | 4.9 |
| `--text-faint` | 3.83 ✗ | 3.71 ✗ | 3.55 ✗ | 3.3 ✗ | 2.95 ✗ | 2.96 ✗ | 2.51 ✗ |
| `--accent-strong` | 8.74 | 8.47 | 8.1 | 7.52 | 6.72 | 6.75 | 5.73 |
| `--ok` | 10.28 | 9.96 | 9.53 | 8.85 | 7.91 | 7.94 | 6.74 |
| `--warn` | 9.44 | 9.16 | 8.76 | 8.13 | 7.27 | 7.29 | 6.19 |
| `--error` | 6.95 | 6.73 | 6.44 | 5.98 | 5.34 | 5.36 | 4.55 |

`--on-ink` on `--ink`: 16.86

**dark — UI parts (3:1)**

| part ↓ / background → | `--bg` | `--canvas` | `--surface` | `--surface-2` |
|---|---|---|---|---|
| `--line-strong` | 1.74 ✗ | 1.69 ✗ | 1.62 ✗ | 1.5 ✗ |
| `--line` | 1.35 ✗ | 1.31 ✗ | 1.25 ✗ | 1.17 ✗ |
| `--accent` | 5.55 | 5.38 | 5.15 | 4.78 |
| `--accent-strong` | 8.74 | 8.47 | 8.1 | 7.52 |
| `--ink` | 17.24 | 16.71 | 15.99 | 14.85 |
| `--canvas-dot` | 1.55 ✗ | 1.5 ✗ | 1.44 ✗ | 1.33 ✗ |

### Text seen on screen (runtime)

Every text colour on its real background (semi-transparent layers composited; element opacity applied). "on glass" = over a gradient or blur, so the ratio is against the nearest solid colour: check by eye.

| AA | theme | text | background | ratio | smallest size | seen | screens | example |
|---|---|---|---|---|---|---|---|---|
| ✗ | dark | `#11111473` | `#f2f2f4` | 2.97 | 13px | 1 | styleguide | button.pc-btn.pc-btn--primary |
| ✓ | light | `#ffffff73` | `#111114` | 4.53 | 13px | 1 | styleguide | button.pc-btn.pc-btn--primary |
| ✓ | light | `#d33a40` | `#ffffff` | 4.72 | 13px | 6 | vault-home, vault-palette, vault-new-menu | span.fart-chip |
| ✓ | dark | `#d33a40` | `#ffffff` | 4.72 | 13px | 6 | vault-home, vault-palette, vault-new-menu | span.fart-chip |
| ✓ | light | `#5558cf` | `#eaeafa` | 4.79 | 11px | 4 | editor | button.ed-snap.pc-micro |
| ✓ | light | `#656571` | `#eaeafa` | 4.83 | 11px | 3 | vault-new-menu, vault-components | span.pc-menu-kbd; td.pc-mono.pc-muted |
| ✓ | light | `#a34a07` | `#eaeafa` | 4.99 | 12px | 1 | vault-components | span.vlt-status.vlt-status--review |
| ✓ | light | `#5558cf` | `#f2f2f4` | 5.1 | 13px | 3 | styleguide, vault-components | span.sg-mark; button.pc-link |
| ✓ | light | `#656571` | `#f2f2f4` | 5.14 | 11px | 114 | vault-home, vault-palette, vault-new-menu, editor, styleguide, vault-components | span.pc-input.vlt-search-text; span.vlt-kbd |
| ✓ | light | `#18753f` | `#f2f2f4` | 5.14 | 13px | 1 | styleguide | span.pc-status.pc-status--ok |
| ✓ | light | `#c2410c` | `#ffffff` | 5.18 | 13px | 2 | vault-components | span.fart-chip |
| ✓ | dark | `#c2410c` | `#ffffff` | 5.18 | 13px | 2 | vault-components | span.fart-chip |
| ✓ | light | `#ffffff` | `#6b6b6e` (on glass) | 5.31 | 11px | 36 | vault-home, vault-palette, vault-new-menu, vault-components | span.fart-pill |
| ✓ | light | `#a34a07` | `#f2f2f4` | 5.31 | 13px | 1 | styleguide | span.pc-status.pc-status--warn |
| ✓ | light | `#bb2b30` | `#f2f2f4` | 5.36 | 12px | 2 | styleguide | span.pc-help.pc-help--error; span.pc-status.pc-status--error |
| ✓ | light | `#656571` | `#fafafb` (on glass) | 5.51 | 12px | 2 | editor, styleguide | span.pc-mono.pc-small |
| ✓ | light | `#5558cf` | `#ffffff` | 5.7 | 12px | 5 | editor, styleguide, vault-components | span.pc-status.pc-status--accent; button.pc-link |
| ✓ | dark | `#5558cf` | `#ffffff` | 5.7 | 13px | 2 | vault-components | span.fart-chip |
| ✓ | dark | `#a0a0ae` | `#27272e` | 5.74 | 11px | 1 | vault-components | span.vlt-count |
| ✓ | light | `#656571` | `#ffffff` | 5.75 | 11px | 98 | vault-home, vault-palette, vault-new-menu, editor, styleguide, vault-components | span.pc-small; span.pc-eyebrow |
| ✓ | light | `#18753f` | `#ffffff` | 5.75 | 12px | 1 | vault-components | span.vlt-status.vlt-status--approved |
| ✓ | dark | `#a0a0ae` | `#23234a` | 5.77 | 11px | 3 | vault-new-menu, vault-components | span.pc-menu-kbd; td.pc-mono.pc-muted |
| ✓ | light | `#bb2b30` | `#ffffff` | 6 | 13px | 1 | styleguide | button.pc-btn.pc-btn--danger |
| ✓ | dark | `#a0a0ae` | `#1e1e23` | 6.43 | 11px | 31 | vault-home, vault-palette, vault-new-menu, vault-library, editor, styleguide, vault-components | span.pc-input.vlt-search-text; span.vlt-kbd |
| ✓ | light | `#a0a0ae` | `#1e1e23` | 6.43 | 11px | 3 | vault-library | span.pc-input.vlt-search-text; span.vlt-kbd |
| ✓ | dark | `#ff6b6b` | `#17171b` | 6.44 | 13px | 1 | styleguide | button.pc-btn.pc-btn--danger |
| ✓ | dark | `#111114b3` | `#f2f2f4` | 6.7 | 12px | 1 | styleguide | kbd |
| ✓ | dark | `#a5a8f5` | `#23234a` | 6.75 | 11px | 4 | editor | button.ed-snap.pc-micro |
| ✓ | dark | `#a0a0ae` | `#17171b` | 6.92 | 11px | 105 | vault-home, vault-palette, vault-new-menu, vault-library, editor, styleguide, vault-components | span.pc-small; span.pc-eyebrow |
| ✓ | light | `#a0a0ae` | `#17171b` | 6.92 | 11px | 8 | vault-library | span.pc-small; span.pc-eyebrow |
| ✓ | dark | `#ff6b6b` | `#0e0e11` | 6.95 | 12px | 2 | styleguide | span.pc-help.pc-help--error; span.pc-status.pc-status--error |
| ✓ | dark | `#a0a0ae` | `#121216` (on glass) | 7.24 | 12px | 2 | editor, styleguide | span.pc-mono.pc-small |
| ✓ | dark | `#f5a524` | `#23234a` | 7.29 | 12px | 1 | vault-components | span.vlt-status.vlt-status--review |
| ✓ | dark | `#a0a0ae` | `#0e0e11` | 7.47 | 11px | 90 | vault-home, vault-palette, vault-new-menu, vault-library, styleguide, vault-components | span.pc-muted.pc-small; span.ftile-meta |
| ✓ | light | `#a0a0ae` | `#0e0e11` | 7.47 | 12px | 4 | vault-library | span.vlt-card-meta |
| ✓ | dark | `#a5a8f5` | `#17171b` | 8.1 | 12px | 3 | editor, styleguide | span.pc-status.pc-status--accent; button.pc-link |
| ✓ | dark | `#a5a8f5` | `#0e0e11` | 8.74 | 13px | 3 | styleguide, vault-components | span.sg-mark; button.pc-link |
| ✓ | dark | `#f5a524` | `#0e0e11` | 9.44 | 13px | 1 | styleguide | span.pc-status.pc-status--warn |
| ✓ | light | `#ffffffb3` | `#111114` | 9.47 | 12px | 1 | styleguide | kbd |
| ✓ | dark | `#3dd68c` | `#17171b` | 9.53 | 12px | 1 | vault-components | span.vlt-status.vlt-status--approved |
| ✓ | dark | `#3dd68c` | `#0e0e11` | 10.28 | 13px | 1 | styleguide | span.pc-status.pc-status--ok |
| ✓ | dark | `#f2f2f4` | `#2e2e5c` | 11.3 | 11px | 1 | styleguide | span.pc-chip.pc-micro |
| ✓ | light | `#111114` | `#c9cbff` | 12.09 | 11px | 34 | vault-home, vault-palette, vault-new-menu, vault-library, editor, vault-components | span.vlt-avatar; span |
| ✓ | dark | `#111114` | `#c9cbff` | 12.09 | 11px | 34 | vault-home, vault-palette, vault-new-menu, vault-library, editor, vault-components | span.vlt-avatar; span |
| ✓ | dark | `#f2f2f4` | `#27272e` | 13.27 | 13px | 6 | vault-home, vault-palette, vault-new-menu, vault-library, vault-components | a.vlt-nav; button.vlt-nav |
| ✓ | light | `#f2f2f4` | `#27272e` | 13.27 | 13px | 1 | vault-library | a.vlt-nav |
| ✓ | dark | `#f2f2f4` | `#23234a` | 13.31 | 13px | 7 | vault-palette, vault-new-menu, vault-components | span.vlt-palette-label; button.pc-menu-item[role=menuitem] |
| ✓ | light | `#111114` | `#ffd3b0` | 13.64 | 11px | 3 | vault-components | span; span.vlt-avatar |
| ✓ | dark | `#111114` | `#ffd3b0` | 13.64 | 11px | 3 | vault-components | span; span.vlt-avatar |
| ✓ | light | `#111114` | `#bfe8cf` | 14.06 | 11px | 16 | vault-components | span; span.vlt-avatar |
| ✓ | dark | `#111114` | `#bfe8cf` | 14.06 | 11px | 16 | vault-components | span; span.vlt-avatar |
| ✓ | dark | `#f2f2f4` | `#1e1e23` | 14.85 | 11px | 21 | editor, styleguide, vault-components | span.pc-chip.pc-micro; input.pc-input |
| ✓ | light | `#111114` | `#e4e4f2` | 14.97 | 11px | 1 | styleguide | span.pc-chip.pc-micro |
| ✓ | light | `#111114` | `#eaeafa` | 15.84 | 13px | 7 | vault-palette, vault-new-menu, vault-components | span.vlt-palette-label; button.pc-menu-item[role=menuitem] |
| ✓ | dark | `#f2f2f4` | `#17171b` | 15.99 | 11px | 162 | vault-home, vault-palette, vault-new-menu, vault-library, editor, styleguide, vault-components | span; a.vlt-nav |
| ✓ | light | `#f2f2f4` | `#17171b` | 15.99 | 12px | 16 | vault-library | span; a.vlt-nav |
| ✓ | light | `#111114` | `#f2f2f4` | 16.86 | 11px | 115 | vault-home, vault-palette, vault-new-menu, vault-library, editor, styleguide, vault-components | b; span.ftile-name |
| ✓ | dark | `#111114` | `#f2f2f4` | 16.86 | 12px | 24 | vault-home, vault-palette, vault-new-menu, vault-library, editor, styleguide, vault-components | span.vlt-avatar-sq; button.pc-btn.pc-btn--primary |
| ✓ | dark | `#f2f2f4` | `#0e0e11` | 17.24 | 12px | 98 | vault-home, vault-palette, vault-new-menu, vault-library, styleguide, vault-components | b; span.ftile-name |
| ✓ | light | `#f2f2f4` | `#0e0e11` | 17.24 | 12px | 10 | vault-library | b; span.vlt-card-name |
| ✓ | dark | `#ffffff` | `#16161a` (on glass) | 18.01 | 11px | 3 | vault-components | span.fart-pill |
| ✓ | light | `#ffffff` | `#111114` | 18.85 | 12px | 18 | vault-home, vault-palette, vault-new-menu, editor, styleguide, vault-components | span.vlt-avatar-sq; button.pc-btn.pc-btn--primary |
| ✓ | light | `#111114` | `#ffffff` | 18.85 | 11px | 151 | vault-home, vault-palette, vault-new-menu, editor, styleguide, vault-components | span; a.vlt-nav |
| ✓ | dark | `#ffffff` | `#101013` (on glass) | 19.02 | 11px | 33 | vault-home, vault-palette, vault-new-menu, vault-components | span.fart-pill |

## Type scale

| size | rem (÷16) | weights | line-heights | letter-spacing | uses (code / seen) | where | proposed step |
|---|---|---|---|---|---|---|---|
| 8px | 0.5rem |  |  |  | 2 / 0 | `design/ui.css:477` | off-scale → 11px (font.size.100) |
| 11px | 0.688rem | 500, 600 | var(--pc-font-line-height-100), 0.9375rem | 0.06em | 19 / 362 | `design/ui.css:83`, `design/ui.css:742`, `editor/editor.css:77`, +7 more | font.size.100 (micro, labels) |
| 12px | 0.75rem | 600 | var(--pc-font-line-height-200) |  | 35 / 382 | `design/ui.css:72`, `design/ui.css:175`, `design/ui.css:258`, +15 more | font.size.200 (small) |
| 13px | 0.813rem |  | var(--pc-font-line-height-300) |  | 3 / 504 | `design/ui.css:23`, `ui/PlanView.tsx:211` | font.size.300 (body) |
| 15px | 0.938rem | 500 | var(--pc-font-line-height-400) | -0.01em | 6 / 28 | `design/ui.css:66`, `styleguide/styleguide.css:20`, `vault/vault.css:531` | font.size.400 (section) |
| 22px | 1.375rem |  | var(--pc-font-line-height-500) |  | 2 / 8 | `design/ui.css:95` | font.size.600 (metric) |
| 24px | 1.5rem | 400 | var(--pc-font-line-height-600) |  | 2 / 46 | `design/ui.css:60` | font.size.700 (title) |
| 40px | 2.5rem | 300 | var(--pc-font-line-height-700) | -0.02em | 2 / 8 | `design/ui.css:50` | font.size.900 (display) |

**Ratios between consecutive sizes:** 8→11 ×1.375 · 11→12 ×1.091 · 12→13 ×1.083 · 13→15 ×1.154 · 15→22 ×1.467 · 22→24 ×1.091 · 24→40 ×1.667

**Fit to standard scales (anchored at 13 px body, ±0.5 px):** major second 1.125: 4/8 sizes fit (off: 11, 22, 24, 40) · minor third 1.2: 4/8 sizes fit (off: 12, 15, 24, 40) · major third 1.25: 3/8 sizes fit (off: 11, 12, 15, 22, 24) · perfect fourth 1.333: 1/8 sizes fit (off: 8, 11, 12, 15, 22, 24, 40)

### Text styles seen on screen

| family size/line-height weight (extras) | seen | examples |
|---|---|---|
| `Geist Variable 13px/18px 400` | 298 | vault-home: span.pc-input.vlt-search-text; vault-home: a.vlt-nav |
| `Geist Variable 13px/18px 500` | 160 | vault-home: span; vault-home: b |
| `Geist Variable 12px/18px 400` | 120 | vault-home: span.ftile-meta; vault-palette: span.ftile-meta |
| `Geist Variable 11px/18px 600` | 106 | vault-home: span.vlt-avatar; vault-home: span |
| `Geist Mono Variable 11px/14px 500 ls 0.66px uppercase` | 94 | vault-home: span.pc-eyebrow; vault-palette: span.pc-eyebrow |
| `Geist Mono Variable 11px/18px 400` | 90 | vault-home: span.vlt-kbd; vault-home: span.vlt-count |
| `Geist Mono Variable 12px/18px 400 tabular-nums` | 76 | editor: span.pc-muted; editor: span.pc-mono.pc-muted |
| `Geist Mono Variable 11px/14px 400` | 72 | vault-home: span.fart-pill; vault-palette: span.fart-pill |
| `Geist Variable 12px/16px 400` | 56 | vault-home: span.pc-small; vault-home: span.pc-muted.pc-small |
| `Geist Variable 24px/30px 400` | 46 | vault-home: h3.pc-title; vault-palette: h3.pc-title |
| `Geist Variable 12px/18px 500` | 44 | vault-home: button.pc-btn.pc-btn--primary; vault-home: button.pc-btn.pc-btn--secondary |
| `Geist Mono Variable 12px/normal 400` | 28 | vault-home: button[role=radio]; vault-palette: button[role=radio] |
| `Geist Mono Variable 12px/16px 400 tabular-nums` | 28 | editor: span.pc-mono.pc-small; styleguide: span.pc-mono.pc-small |
| `Geist Mono Variable 13px/18px 400 tabular-nums` | 26 | editor: span.pc-mono; styleguide: input.pc-input.pc-input--number |
| `Geist Variable 13px/18px 600` | 20 | vault-home: span.fart-chip; vault-palette: span.fart-chip |
| `Geist Variable 15px/20px 500` | 14 | editor: span.pc-section; styleguide: p.pc-section |
| `Geist Variable 12px/18px 600` | 10 | vault-home: span.vlt-avatar-sq; vault-palette: span.vlt-avatar-sq |
| `Geist Mono Variable 12px/18px 400` | 10 | styleguide: span.pc-unit; styleguide: li |
| `Geist Variable 15px/18px 500 ls -0.15px` | 8 | styleguide: span.sg-wordmark; styleguide: span.sg-mark |
| `Geist Variable 40px/44px 300 ls -0.8px` | 8 | styleguide: h1.pc-display; styleguide: span.pc-quiet |
| `Geist Mono Variable 22px/24px 400 tabular-nums` | 8 | styleguide: p.pc-metric; styleguide: span.pc-metric |
| `Geist Mono Variable 12px/24px 400 tabular-nums` | 6 | styleguide: span.pc-unit |
| `Geist Mono Variable 15px/20px 500 tabular-nums` | 4 | styleguide: span.pc-mono.pc-muted |
| `Geist Mono Variable 12px/normal 400 tabular-nums` | 2 | editor: button.ed-zoom-value.pc-mono |
| `Geist Variable 12px/18px 700` | 2 | styleguide: b |
| `Geist Variable 15px/18px 400` | 2 | vault-components: input |

## Spacing

Padding, margin, gap and inset values. Code uses count each theme once.

| px | on 4 | on 8 | uses (code / seen) | kind | where | proposed |
|---|---|---|---|---|---|---|
| -24 | ✓ | ✓ | 0 / 20 | margin (runtime) | _vault-home: margin div.vlt-head_, _vault-palette: margin div.vlt-head_ | negative offset (keep, review) |
| -6 | — | — | 2 / 34 | margin (runtime), margin | `vault/vault.css:346` | negative offset (keep, review) |
| -4 | ✓ | — | 2 / 0 | inset | `design/ui.css:110` | negative offset (keep, review) |
| -1 | — | — | 2 / 12 | margin (runtime), margin | `design/ui.css:404` | negative offset (keep, review) |
| 0 | ✓ | ✓ | 140 / 0 | margin, padding, inset | `design/ui.css:16`, `design/ui.css:54`, `design/ui.css:63`, +67 more | space.0 |
| 1 | — | — | 6 / 96 | padding (runtime), gap (runtime), gap, padding | `vault/dashboard.css:43`, `vault/dashboard.css:274`, `vault/vault.css:91` | hairline: use border.width, not spacing |
| 2 | — | — | 14 / 286 | padding (runtime), margin (runtime), gap (runtime), padding, margin, gap | `design/ui.css:324`, `design/ui.css:649`, `design/ui.css:667`, +4 more | space.50 |
| 4 | ✓ | — | 66 / 316 | padding (runtime), gap (runtime), margin (runtime), gap, margin, padding, inset | `design/ui.css:255`, `design/ui.css:492`, `design/ui.css:535`, +30 more | space.100 |
| 5 | — | — | 2 / 6 | margin (runtime), margin | `design/ui.css:545` | snap → 4px (space.100) |
| 6 | — | — | 62 / 522 | padding (runtime), margin (runtime), gap (runtime), gap, margin, padding, inset | `design/ui.css:154`, `design/ui.css:269`, `design/ui.css:432`, +28 more | space.150 |
| 7 | — | — | 2 / 144 | padding (runtime), padding | `vault/vault.css:324` | snap → 6px (space.150) |
| 8 | ✓ | ✓ | 116 / 1330 | padding (runtime), margin (runtime), gap (runtime), padding, gap, margin | `design/ui.css:174`, `design/ui.css:268`, `design/ui.css:383`, +55 more | space.200 |
| 10 | — | — | 2 / 148 | padding (runtime), padding | `vault/vault.css:316` | snap → 8px (space.200) |
| 12 | ✓ | — | 74 / 564 | padding (runtime), margin (runtime), gap (runtime), padding, margin, gap | `design/ui.css:156`, `design/ui.css:331`, `design/ui.css:434`, +34 more | space.300 |
| 13 | — | — | 0 / 4 | margin (runtime) | _styleguide: margin p.pc-muted_ | snap → 12px (space.300) |
| 16 | ✓ | ✓ | 64 / 336 | padding (runtime), margin (runtime), gap (runtime), padding, gap, margin | `design/ui.css:179`, `design/ui.css:281`, `design/ui.css:396`, +29 more | space.400 |
| 18 | — | — | 4 / 2 | padding (runtime), padding, inset | `design/ui.css:589`, `vault/vault.css:246` | snap → 16px (space.400) |
| 20 | ✓ | — | 4 / 28 | gap (runtime), gap | `styleguide/styleguide.css:36`, `styleguide/styleguide.css:74` | space.500 |
| 24 | ✓ | ✓ | 14 / 92 | padding (runtime), margin (runtime), padding, margin | `styleguide/styleguide.css:5`, `styleguide/styleguide.css:30`, `vault/dashboard.css:345`, +4 more | space.600 |
| 32 | ✓ | ✓ | 2 / 52 | padding (runtime), padding | `styleguide/styleguide.css:33` | space.800 |
| 40 | ✓ | ✓ | 0 / 2 | padding (runtime) | _vault-components: padding button.vlt-tree-row[role=treeitem]_ | space.1000 |
| 48 | ✓ | ✓ | 2 / 0 | padding | `vault/dashboard.css:234` | space.1200 |
| 56 | ✓ | ✓ | 2 / 2 | padding (runtime), padding | `styleguide/styleguide.css:30` | space.1400 (add step) |
| 64 | ✓ | ✓ | 2 / 0 | padding | `styleguide/styleguide.css:125` | space.1600 |
| 72 | ✓ | ✓ | 2 / 0 | inset | `styleguide/styleguide.css:107` | space.1800 (add step) |
| 80 | ✓ | ✓ | 2 / 4 | padding (runtime), padding | `styleguide/styleguide.css:5` | space.2000 (add step) |
| 108 | ✓ | — | 0 / 2 | padding (runtime) | _vault-palette: padding div.pc-backdrop.vlt-palette-backdrop_ | space.2700 (add step) |

## Other scales

### Radii

| value | uses (code / seen) | where | proposed |
|---|---|---|---|
| `0` | 4 / 0 | `design/ui.css:223`, `vault/dashboard.css:8` | radius.0 |
| `0 4px 4px 0` | 2 / 0 | `editor/editor.css:250` | off-scale: review |
| `2px` | 14 / 86 | `design/ui.css:424`, `design/ui.css:457`, `design/ui.css:469`, `design/ui.css:496`, +3 more | radius.100 (card) |
| `3px` | 2 / 28 | `design/ui.css:333` | off-scale: review |
| `4px` | 42 / 488 | `design/ui.css:158`, `design/ui.css:267`, `design/ui.css:326`, `design/ui.css:572`, +17 more | radius.200 (control) |
| `4px 0 0 4px` | 2 / 0 | `editor/editor.css:255` | off-scale: review |
| `5px` | 2 / 10 | `vault/vault.css:400` | off-scale: review |
| `8px` | 16 / 142 | `design/ui.css:566`, `design/ui.css:642`, `vault/dashboard.css:101`, `vault/dashboard.css:155`, +4 more | radius.400 (overlay) |
| `8px 8px 4px 8px` | 0 / 2 | _styleguide: div.pc-bubble.pc-bubble--user_ | off-scale: review |
| `8px 8px 8px 4px` | 0 / 2 | _styleguide: div.pc-bubble.pc-bubble--assistant_ | off-scale: review |
| `10px` | 2 / 20 | `vault/vault.css:364` | off-scale: review |
| `12px` | 2 / 4 | `vault/vault.css:511` | radius.500 |
| `16px` | 4 / 82 | `vault/dashboard.css:130`, `vault/vault.css:171` | radius.600 (tile) |
| `18px` | 4 / 148 | `vault/vault.css:247`, `vault/vault.css:303` | off-scale: review |
| `50%` | 12 / 112 | `design/ui.css:369`, `design/ui.css:515`, `design/ui.css:544`, `editor/editor.css:88`, +2 more | radius.full (circle) |
| `999px` | 16 / 90 | `design/ui.css:182`, `design/ui.css:230`, `design/ui.css:279`, `design/ui.css:349`, +4 more | radius.full (pill) |

### Border and outline widths

| value | uses (code / seen) | where | proposed |
|---|---|---|---|
| `1px solid` | 0 / 2200 | _vault-home: div.vlt.vlt--app_, _vault-home: aside.vlt-side_ |  |
| `2px solid` | 0 / 324 | _vault-home: span_, _vault-palette: span_ |  |
| `1px` | 94 / 0 | `design/ui.css:145`, `design/ui.css:157`, `design/ui.css:266`, `design/ui.css:327`, +43 more |  |
| `0px` | 44 / 0 | `design/ui.css:144`, `design/ui.css:240`, `design/ui.css:290`, `design/ui.css:291`, +18 more |  |
| `2px` | 18 / 0 | `design/ui.css:35`, `design/ui.css:272`, `design/ui.css:403`, `vault/dashboard.css:104`, +5 more |  |
| `offset 2px` | 10 / 0 | `design/ui.css:36`, `design/ui.css:273`, `vault/dashboard.css:144`, `vault/dashboard.css:217`, +1 more |  |
| `offset calc(-1 * 2px)` | 4 / 0 | `editor/editor.css:203`, `editor/editor.css:245` |  |
| `offset 8px` | 2 / 0 | `vault/dashboard.css:105` |  |
| `offset -2px` | 2 / 0 | `vault/dashboard.css:213` |  |

### Shadows

| value | uses (code / seen) | where | proposed |
|---|---|---|---|
| `rgba(0, 0, 0, 0.18) 0px 1px 3px 0px` | 0 / 120 | _vault-home: div.fart-paper_, _vault-home: span.fart-chip_ |  |
| `rgba(255, 255, 255, 0.5) 0px 1px 0px 0px inset` | 0 / 64 | _vault-home: div.fart-front_, _vault-palette: div.fart-front_ |  |
| `rgba(17, 17, 20, 0.06) 0px 1px 2px 0px` | 0 / 12 | _vault-home: a.vlt-nav_, _vault-palette: a.vlt-nav_ |  |
| `rgba(255, 255, 255, 0.08) 0px 1px 0px 0px inset` | 0 / 10 | _vault-home: div.fart-front_, _vault-palette: div.fart-front_ |  |
| `rgba(17, 17, 20, 0.06) 0px 1px 2px 0px, rgba(17, 17, 20, 0.08) 0px 8px 24px 0px` | 0 / 8 | _vault-palette: div.vlt-palette[role=dialog]_, _vault-new-menu: div.pc-menu[role=menu]_ |  |
| `rgba(0, 0, 0, 0.4) 0px 1px 2px 0px, rgba(0, 0, 0, 0.45) 0px 8px 24px 0px` | 0 / 8 | _vault-palette: div.vlt-palette[role=dialog]_, _vault-new-menu: div.pc-menu[role=menu]_ |  |
| `rgba(0, 0, 0, 0.15) 0px 1px 3px 0px, rgb(42, 42, 49) 0px 0px 0px 1px` | 0 / 8 | _vault-library: span.vlt-card-paper_ |  |
| `0 1px 2px rgba(17, 17, 20, 0.06), 0 8px 24px rgba(17, 17, 20, 0.08)` | 7 / 0 | `design/ui.css:603`, `design/ui.css:621`, `design/ui.css:643`, `design/ui.css:660`, +3 more |  |
| `0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.45)` | 7 / 0 | `design/ui.css:603`, `design/ui.css:621`, `design/ui.css:643`, `design/ui.css:660`, +3 more |  |
| `inset 0 0 0 999px color-mix(in srgb, currentColor calc(0.1 * 100%), transparent)` | 4 / 0 | `design/ui.css:44`, `vault/vault.css:121` |  |
| `0 1px 3px rgba(0, 0, 0, 0.18)` | 4 / 0 | `vault/vault.css:257`, `vault/vault.css:370` |  |
| `inset 3px 0 0 #5558cf` | 2 / 0 | `editor/editor.css:381`, `vault/vault.css:465` |  |
| `inset 3px 0 0 #a5a8f5` | 2 / 0 | `editor/editor.css:381`, `vault/vault.css:465` |  |
| `0 1px 2px rgba(17, 17, 20, 0.06)` | 2 / 0 | `vault/vault.css:128` |  |
| `inset 0 1px 0 rgba(255, 255, 255, 0.5)` | 2 / 0 | `vault/vault.css:310` |  |
| `inset 0 1px 0 rgba(255, 255, 255, 0.08)` | 2 / 0 | `vault/vault.css:392` |  |
| `inset 0 0 0 1px #5558cf` | 1 / 0 | `vault/dashboard.css:97` |  |
| `inset 0 0 0 1px #a5a8f5` | 1 / 0 | `vault/dashboard.css:97` |  |
| `0 1px 3px rgba(0, 0, 0, 0.15), 0 0 0 1px #e2e2e8` | 1 / 0 | `vault/dashboard.css:157` |  |
| `0 1px 3px rgba(0, 0, 0, 0.15), 0 0 0 1px #2a2a31` | 1 / 0 | `vault/dashboard.css:157` |  |
| `0 0 0 1px #5558cf` | 1 / 0 | `vault/dashboard.css:265` |  |
| `0 0 0 1px #a5a8f5` | 1 / 0 | `vault/dashboard.css:265` |  |
| `rgb(85, 88, 207) 3px 0px 0px 0px inset` | 0 / 1 | _vault-components: td_ |  |
| `rgb(165, 168, 245) 3px 0px 0px 0px inset` | 0 / 1 | _vault-components: td_ |  |

### Blur and backdrop filters

| value | uses (code / seen) | where | proposed |
|---|---|---|---|
| `blur(6px)` | 4 / 72 | `vault/vault.css:328`, `vault/vault.css:329` |  |
| `blur(16px) saturate(1.4)` | 0 / 52 | _vault-home: div.fart-front_, _vault-palette: div.fart-front_ |  |
| `blur(16px)` | 4 / 0 | `vault/vault.css:308`, `vault/vault.css:309` |  |
| `saturate(140%)` | 4 / 0 | `vault/vault.css:308`, `vault/vault.css:309` |  |
| `blur(22px)` | 2 / 0 | `vault/vault.css:240` |  |

### Opacity

| value | uses (code / seen) | where | proposed |
|---|---|---|---|
| `0` | 2 / 0 | `editor/editor.css:517` |  |
| `0.35` | 2 / 0 | `vault/vault.css:241` |  |
| `0.4` | 2 / 0 | `vault/dashboard.css:289` |  |
| `0.45` | 4 / 6 | `design/ui.css:169`, `vault/vault.css:293` |  |
| `0.7` | 2 / 2 | `design/ui.css:607` |  |
| `fill-opacity 0.25` | 1 / 0 | `ui/PlanView.tsx:340` |  |
| `fill-opacity 0.3` | 1 / 0 | `ui/PlanView.tsx:321` |  |
| `fill-opacity 0.55` | 1 / 0 | `ui/PlanView.tsx:91` |  |

### Durations

| value | uses (code / seen) | where | proposed |
|---|---|---|---|
| `0ms` | 8 / 0 | `editor/editor.css:126`, `editor/editor.css:133`, `editor/editor.css:510`, `editor/editor.css:519` | duration.0 |
| `150ms` | 16 / 262 | `design/ui.css:162`, `design/ui.css:354`, `design/ui.css:371`, `design/ui.css:449`, +4 more | duration.150 |
| `200ms` | 8 / 4 | `editor/editor.css:126`, `editor/editor.css:133`, `editor/editor.css:510`, `editor/editor.css:519` | duration.200 |
| `220ms` | 6 / 174 | `vault/vault.css:242`, `vault/vault.css:259`, `vault/vault.css:312` | snap → 200ms |

### Easings

| value | uses (code / seen) | where | proposed |
|---|---|---|---|
| `ease-out` | 30 / 440 | `design/ui.css:162`, `design/ui.css:354`, `design/ui.css:371`, `design/ui.css:449`, +11 more |  |
| `linear` | 4 / 0 | `editor/editor.css:133`, `editor/editor.css:519` |  |
| `ease` | 0 / 4 | _editor: aside.ed-side.ed-left_, _editor: aside.ed-side.ed-right_ |  |

### Z-index

| value | uses (code / seen) | where | proposed |
|---|---|---|---|
| `1` | 8 / 48 | `editor/editor.css:172`, `editor/editor.css:224`, `vault/vault.css:273`, `vault/vault.css:379` |  |
| `2` | 2 / 8 | `vault/dashboard.css:18` |  |
| `4` | 4 / 2 | `editor/editor.css:106`, `editor/editor.css:507` |  |
| `5` | 2 / 4 | `styleguide/styleguide.css:10` |  |
| `10` | 2 / 2 | `design/ui.css:615` |  |
| `50` | 2 / 2 | `design/ui.css:695` |  |
| `calc(4 - 1)` | 2 / 0 | `editor/editor.css:542` |  |

### Media and supports rules (breakpoints)

| value | uses (code / seen) | where | proposed |
|---|---|---|---|
| `@media (prefers-reduced-motion: reduce)` | 1 / 0 | `design/ui.css:27` |  |
| `@media (max-width: 720px)` | 1 / 0 | `editor/editor.css:544` |  |
| `@media (max-width: 480px)` | 1 / 0 | `editor/editor.css:558` |  |
| `@media (max-width: 640px)` | 1 / 0 | `styleguide/styleguide.css:123` |  |
| `@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))` | 1 / 0 | `vault/vault.css:420` |  |
| `@media (prefers-reduced-transparency: reduce)` | 1 / 0 | `vault/vault.css:425` |  |
| `@media (max-width: 760px)` | 1 / 0 | `vault/vault.css:555` |  |

### Control heights (buttons, inputs, rows, tabs…)

| value | uses (code / seen) | where | proposed |
|---|---|---|---|
| `16px` | 2 / 4 | `design/ui.css:388` |  |
| `18px` | 0 / 4 | _styleguide: button.pc-link_ |  |
| `20px` | 2 / 0 | `design/ui.css:493` |  |
| `24px` | 6 / 52 | `design/ui.css:330`, `editor/editor.css:449`, `editor/editor.css:484` |  |
| `28px` | 2 / 46 | `design/ui.css:173` |  |
| `30px` | 0 / 24 | _vault-home: select.pc-select_, _vault-palette: select.pc-select_ |  |
| `32px` | 10 / 284 | `design/ui.css:155`, `design/ui.css:264`, `design/ui.css:708`, `vault/dashboard.css:257`, +1 more |  |
| `36px` | 4 / 38 | `design/ui.css:400`, `vault/vault.css:544` |  |
| `38px` | 0 / 2 | _styleguide: input.pc-input_ |  |
| `40px` | 8 / 4 | `design/ui.css:178`, `design/ui.css:280`, `editor/editor.css:365`, `vault/vault.css:448` |  |
| `44px` | 2 / 0 | `vault/vault.css:363` |  |
| `45px` | 0 / 4 | _styleguide: button.pc-panel-head_ |  |
| `48px` | 4 / 24 | `styleguide/styleguide.css:54`, `vault/vault.css:452` |  |
| `51px` | 0 / 4 | _vault-palette: input[role=combobox]_, _vault-components: input_ |  |
| `52px` | 2 / 10 | `vault/vault.css:520` |  |

### Icon sizes

| value | uses (code / seen) | where | proposed |
|---|---|---|---|
| `16px` | 3 / 0 | `ui/icons.tsx:112`, `ui/icons.tsx:122`, `ui/icons.tsx:207` |  |
| `16x16` | 0 / 114 | _vault-home: svg in button.vlt-workspace_, _vault-home: svg in span.vlt-twist_ |  |
| `20px` | 4 / 0 | `ui/icons.tsx:6`, `vault/VaultPage.tsx:119`, `vault/VaultPage.tsx:162`, `vault/items.tsx:334` |  |
| `20x20` | 0 / 266 | _vault-home: svg in button.pc-input-wrap.vlt-search_, _vault-home: svg in a.vlt-nav_ |  |
| `58x74` | 0 / 54 | _vault-components: svg in div.fart-paper_ |  |

### SVG stroke widths

| value | uses (code / seen) | where | proposed |
|---|---|---|---|
| `1` | 4 / 104 | `ui/PlanView.tsx:81`, `ui/PlanView.tsx:112`, `ui/PlanView.tsx:133`, `ui/PlanView.tsx:145` |  |
| `1.25` | 1 / 0 | `ui/PlanView.tsx:102` |  |
| `1.5` | 5 / 396 | `editor/Canvas.tsx:107`, `ui/PlanView.tsx:331`, `ui/PlanView.tsx:342`, `ui/PlanView.tsx:354`, +1 more |  |

### Targets smaller than 24 × 24 px (WCAG 2.5.8; an input inside a taller wrapper may be fine)

| value | uses (code / seen) | where | proposed |
|---|---|---|---|
| `50x18` | 0 / 2 | _styleguide: button.pc-link_ |  |
| `28x16` | 0 / 2 | _styleguide: button.pc-switch[role=switch]_ |  |
| `16x16` | 0 / 2 | _styleguide: input_ |  |
| `29x18` | 0 / 2 | _styleguide: button.pc-link_ |  |

### Widths and heights in code (top 40)

| value | uses (code / seen) | where | proposed |
|---|---|---|---|
| `min-width 0px` | 16 / 0 | `design/ui.css:289`, `editor/editor.css:21`, `editor/editor.css:290`, `editor/editor.css:555`, +4 more |  |
| `height 24px` | 16 / 0 | `design/ui.css:330`, `editor/editor.css:55`, `editor/editor.css:449`, `editor/editor.css:457`, +4 more |  |
| `height 32px` | 12 / 0 | `design/ui.css:155`, `design/ui.css:264`, `design/ui.css:708`, `vault/dashboard.css:257`, +2 more |  |
| `min-height 0px` | 12 / 0 | `editor/editor.css:101`, `editor/editor.css:123`, `editor/editor.css:143`, `editor/editor.css:283`, +2 more |  |
| `height 40px` | 10 / 0 | `design/ui.css:178`, `design/ui.css:228`, `design/ui.css:280`, `vault/vault.css:238`, +1 more |  |
| `width 32px` | 6 / 0 | `design/ui.css:210`, `vault/dashboard.css:256`, `vault/vault.css:75` |  |
| `min-height 24px` | 6 / 0 | `design/ui.css:382`, `vault/dashboard.css:71`, `vault/dashboard.css:208` |  |
| `width 16px` | 6 / 0 | `design/ui.css:387`, `vault/vault.css:147`, `vault/vault.css:408` |  |
| `width 8px` | 6 / 0 | `design/ui.css:513`, `design/ui.css:542`, `editor/editor.css:173` |  |
| `width 280px` | 6 / 0 | `editor/editor.css:124`, `editor/editor.css:140`, `editor/editor.css:516` |  |
| `width 360px` | 6 / 0 | `editor/editor.css:124`, `editor/editor.css:140`, `editor/editor.css:516` |  |
| `width 300px` | 6 / 0 | `editor/editor.css:124`, `editor/editor.css:140`, `editor/editor.css:516` |  |
| `width 24px` | 6 / 0 | `editor/editor.css:227`, `editor/editor.css:483`, `vault/vault.css:478` |  |
| `height 44px` | 6 / 0 | `editor/editor.css:264`, `vault/vault.css:363`, `vault/vault.css:399` |  |
| `height 20px` | 5 / 0 | `design/ui.css:493`, `vault/vault.css:338`, `vault/Dashboard.tsx:844` |  |
| `width 20px` | 5 / 0 | `design/ui.css:735`, `vault/vault.css:337`, `vault/Dashboard.tsx:844` |  |
| `height 28px` | 4 / 0 | `design/ui.css:173`, `editor/editor.css:37` |  |
| `width 40px` | 4 / 0 | `design/ui.css:227`, `design/ui.css:676` |  |
| `height 16px` | 4 / 0 | `design/ui.css:348`, `design/ui.css:388` |  |
| `height 36px` | 4 / 0 | `design/ui.css:400`, `vault/vault.css:544` |  |
| `height 8px` | 4 / 0 | `design/ui.css:514`, `design/ui.css:543` |  |
| `width 1px` | 4 / 0 | `design/ui.css:647`, `editor/editor.css:342` |  |
| `height 1px` | 4 / 0 | `design/ui.css:746`, `editor/editor.css:343` |  |
| `height 56px` | 4 / 0 | `styleguide/styleguide.css:14`, `vault/vault.css:32` |  |
| `height 48px` | 4 / 0 | `styleguide/styleguide.css:54`, `vault/vault.css:452` |  |
| `width 168px` | 4 / 0 | `vault/dashboard.css:115`, `vault/vault.css:202` |  |
| `width 28px` | 2 / 0 | `design/ui.css:347` |  |
| `width 12px` | 2 / 0 | `design/ui.css:367` |  |
| `height 12px` | 2 / 0 | `design/ui.css:368` |  |
| `height 3px` | 2 / 0 | `design/ui.css:481` |  |
| `height 6px` | 2 / 0 | `design/ui.css:672` |  |
| `min-width 200px` | 2 / 0 | `design/ui.css:696` |  |
| `min-width 64px` | 2 / 0 | `editor/editor.css:34` |  |
| `min-width 15px` | 2 / 0 | `editor/editor.css:70` |  |
| `height 15px` | 2 / 0 | `editor/editor.css:71` |  |
| `width 26px` | 2 / 0 | `editor/editor.css:86` |  |
| `height 26px` | 2 / 0 | `editor/editor.css:87` |  |
| `width 48px` | 2 / 0 | `editor/editor.css:108` |  |
| `width 0px` | 2 / 0 | `editor/editor.css:131` |  |
| `width 2px` | 2 / 0 | `editor/editor.css:188` |  |


## Outliers & merge candidates

**Near-duplicate colours (ΔE2000 < 2, written or tokenised; derived colours left out):**

- #fafafb ≈ #ffffff (ΔE 1.12)
- #ffffff14 ≈ #ffffff1a (ΔE 0)
- #f2f2f4 ≈ #fafafb (ΔE 1.7)
- #e4e4f2 ≈ #eaeafa (ΔE 1.54)
- #e2e2e8 ≈ #e8e8ee (ΔE 1.31)
- #6e6e7a ≈ #72727e (ΔE 1.58)
- #6b6b78 ≈ #6e6e7a (ΔE 1.24)
- #2a2a2e ≈ #2c2c30 (ΔE 0.64)
- #27272e ≈ #2a2a31 (ΔE 0.95)
- #2a2a2e ≈ #2a2a31 (ΔE 1.91)
- #1b1b1e ≈ #1e1e23 (ΔE 1.68)
- #18181b ≈ #1c1c1e (ΔE 1.45)
- #1b1b1e ≈ #1c1c1e (ΔE 0.79)
- #17171b ≈ #1b1b1e (ΔE 1.45)
- #18181b ≈ #1b1b1e (ΔE 0.94)
- #17171b ≈ #18181b (ΔE 0.79)
- #121216 ≈ #18181b (ΔE 1.72)
- #111114 ≈ #18181b (ΔE 1.99)
- #121216 ≈ #17171b (ΔE 1.45)
- #111114 ≈ #121216 (ΔE 0.8)
- #0e0e11 ≈ #121216 (ΔE 1.35)
- #0e0e11 ≈ #111114 (ΔE 0.7)
- #11111412 ≈ #11111414 (ΔE 0)
- #1111140f ≈ #11111414 (ΔE 0)
- #1111140f ≈ #11111412 (ΔE 0)
- #00000026 ≈ #0000002e (ΔE 0)

**Used fewer than 3 times (review):**

- **colours:** `#5558cf29` (`design/tokens.ts:18`, `design/tokens.ts:73`); `#ffffff80` (`vault/vault.css:310`); `#ffffff1a` (`design/tokens.ts:177`, `design/tokens.ts:220`); `#ffffff14` (`vault/vault.css:392`); `#6b6b78` (`engine/render/thumbnail.ts:50`); `#6a6a70` (`vault/vault.css:411`); `#5a5a60` (`vault/vault.css:401`); `#33333f` (`design/ui.css:140`, `design/tokens.ts:161`); `#2c2c30` (`vault/vault.css:388`); `#2a2a2e` (`vault/vault.css:401`); `#11111412` (`design/tokens.ts:31`, `design/tokens.ts:74`)
- **font sizes:** `8px` (`design/ui.css:477`)
- **spacing:** `-4px` (`design/ui.css:110`); `48px` (`vault/dashboard.css:234`); `64px` (`styleguide/styleguide.css:125`); `72px` (`styleguide/styleguide.css:107`)
- **radii:** `0 4px 4px 0` (`editor/editor.css:250`); `4px 0 0 4px` (`editor/editor.css:255`)
- **z-index:** `calc(4 - 1)` (`editor/editor.css:542`)
- **opacity:** `0` (`editor/editor.css:517`); `0.35` (`vault/vault.css:241`); `0.4` (`vault/dashboard.css:289`); `fill-opacity 0.25` (`ui/PlanView.tsx:340`); `fill-opacity 0.3` (`ui/PlanView.tsx:321`); `fill-opacity 0.55` (`ui/PlanView.tsx:91`)

<!-- GENERATED:END -->

## Proposal (hand-written · 🛑 not applied until the founder approves)

Rule followed: keep everything already used; merge only true duplicates; change a value only to pass WCAG AA (marked **fix**). Values: `proposed-scales.json`; visual: `as-built-sheet.html` → "Proposed base scales". After approval: DTCG files in `design/tokens/{base,semantic,component}/` (skill §3.3), generated `tokens.css` / `tokens.ts`, then the §3.7 token index — old CSS variable names stay as deprecated aliases for one release.

### Base scales

| Scale | Proposed steps | From the as-built values |
|---|---|---|
| `color.neutral` | 0 `#FFFFFF` · 25 `#FAFAFB` · 50 `#F2F2F4` · 100 `#E8E8EE` · 150 `#E2E2E8` · 200 `#C8C8D2` · 400 `#A0A0AE` · 450 `#9A9AA6` · 500 `#84848E` (new) · 550 `#72727E` (new) · 575 `#6E6E7A` · 600 `#656571` (**fix**, was `#6B6B78`) · 750 `#3B3B45` · 775 `#33333F` · 800 `#2A2A31` · 825 `#27272E` · 850 `#1E1E23` · 900 `#17171B` · 925 `#121216` · 950 `#111114` · 975 `#0E0E11` | every grey in `tokens.css`; merges `#CBCBD8` → 200 and `#111111` → 950 |
| `color.accent` (blueprint blue) | 50 `#EAEAFA` · 100 `#E4E4F2` · 200 `#C9CBFF` · 300 `#A5A8F5` · 350 `#9A9DF5` · 500 `#8080DD` · 600 `#5558CF` · 800 `#2E2E5C` · 900 `#23234A` | the accent tokens + avatar `#C9CBFF` + blue folder |
| `color.green / amber / red` | green 300 `#3DD68C`, 700 `#18753F` (**fix**) · amber 400 `#F5A524`, 700 `#A34A07` (**fix**) · red 400 `#FF6B6B`, 700 `#BB2B30` (**fix**) | status tokens |
| `color.categorical` | Okabe-Ito (skill §3.4), for diff and presence later | new, not used yet |
| `font.family` | sans = Geist stack · mono = Geist Mono stack | as built |
| `font.size` | 100 = 11 · 200 = 12 · 300 = 13 · 400 = 15 · 600 = 22 · 700 = 24 · 900 = 40 | as built; 9–10 px exceptions → 100 (decision 5); the 8 px "●" bullet is a glyph, not text |
| `space` | 0 · 50 = 2 · 100 = 4 · 150 = 6 · 200 = 8 · 300 = 12 · 400 = 16 · 500 = 20 · 600 = 24 · 800 = 32 · 1000 = 40 · 1200 = 48 · 1600 = 64 | DESIGN.md's scale + 64 |
| `radius` | 0 · 100 = 2 · 200 = 4 · 400 = 8 · 500 = 12 · 600 = 16 · 700 = 20 · full | as built |
| `size` | control 28 / 32 / 40 · icon 16 / 20 / 24 / 32 · target min 24, comfortable 32, touch 44 | as built + A3 + skill |
| `border.width` | 1 · 1.5 · 2 (focus ring 2, offset 2) | as built |
| `elevation` | raised `0 1px 2px` ink 6 % · paper `0 1px 3px` black 15 % (merges 12 % and 18 %) · overlay = today's `--shadow-float` (light and dark recipes) | as built |
| `motion` | duration 150 (hover), 200 (folder art; was 220) · easing out = `ease-out` | as built |
| `z` | raised 1 · sticky 2 · panel 4 · page-header 5 · overlay 10 · dropdown 50 | as built (menus sit above dialogs on purpose) |
| `opacity` | disabled 0.45 (as built; the skill suggests 0.38 — keep ours) · state overlays hover 0.08, pressed 0.10, dragged 0.16 (new, skill §5) | |
| `bp` | phone 480 · narrow 760 (merges 640 / 720 / 760) | three nearly equal breakpoints today |

### Semantic tokens (per theme)

| Proposed token | Light | Dark | Today |
|---|---|---|---|
| `color.bg.app` | neutral.50 | neutral.975 | `--bg` |
| `canvas.bg` | neutral.25 | neutral.925 | `--canvas` |
| `canvas.grid.minor` | neutral.200 | neutral.775 | `--canvas-dot` |
| `color.bg.surface` | neutral.0 | neutral.900 | `--surface` |
| `color.bg.inset` | neutral.50 | neutral.850 | `--surface-2` (inputs, cards inside panels) |
| `color.state.hover-bg` | neutral.100 | neutral.825 | `--surface-3` |
| `color.state.subtle-fill` | ink 7 % | white 10 % | new (A3 icon fills) |
| `color.border.subtle` | neutral.150 | neutral.800 | `--line` (hairlines, decorative) |
| `color.border.default` | neutral.200 | neutral.750 | `--line-strong` (corner marks, dividers) |
| `color.border.control` | neutral.500 | neutral.550 | new: input / checkbox edges, 3 : 1 (decision 3) |
| `color.text.primary` / `.strong` | neutral.950 / neutral.950 | neutral.50 / neutral.0 | `--text` |
| `color.text.secondary` (+ `.placeholder`) | neutral.600 | neutral.400 | `--text-muted` |
| `color.text.disabled` | neutral.450 | neutral.575 | `--text-faint` (disabled only) |
| `color.bg.inverse` / `color.text.inverse` | neutral.950 / neutral.0 | neutral.50 / neutral.950 | `--ink` / `--on-ink` |
| `color.accent.default` | accent.600 | accent.300 | `--accent-strong` (text, links, focus, active) |
| `color.accent.decorative` | accent.500 | accent.500 | `--accent` (selection wash; never text) |
| `color.accent.subtle` / `.tint` | accent.50 / accent.100 | accent.900 / accent.800 | `--accent-soft` / `--accent-tint` |
| `color.status.success / warning / error` | green.700 / amber.700 / red.700 | green.300 / amber.400 / red.400 | `--ok` / `--warn` / `--error` |
| `color.bg.scrim` | ink 24 % | black 50 % | `--backdrop` |

### Icon tokens (A3.1 names; founder's light-mode rule, 6 Nov 2026)

| Token | Light | Dark | Check |
|---|---|---|---|
| `icon.line` | `#111114` (text.primary, near-black) | `#F2F2F4` | 18.9 : 1 on white |
| `icon.line-strong` | `#111114` | `#FFFFFF` | |
| `icon.fill-neutral` | ink 7 % (`#11111412`), a very light grey tint | white 10 % (`#FFFFFF1A`) | decorative |
| `icon.fill-active` | accent.600 at 16 % (`#5558CF29`), a pale accent tint | accent.800 `#2E2E5C` (deep) | decorative |
| `icon.accent` | `#5558CF` (accent.600, the darker shade) | `#A5A8F5` | light: 5.7 : 1 on white, 4.8 on a selected row, 3.9 on its own active fill — all ≥ 3 : 1 |
| `icon.accent-muted` | `#656571` (text.secondary) | `#A0A0AE` | 5.0 / 5.2 : 1 on the neutral fill |
| `size.icon.sm / md / lg / xl` | 16 / 20 / 24 / 32 | same | |
| `icon.stroke` | 1.5 | same | matches today's icons |

Translucent fills on purpose: they stay visible on white panels, grey inputs and selected rows alike.

### Mapping: as-built value → proposed token

| As built | Where | Proposed | Note |
|---|---|---|---|
| all `--*` colour variables in `tokens.css` | `frontend/src/design/tokens.css` | the semantic tokens above | **rename**; keep old names as deprecated aliases for one release |
| `--space-1 … --space-11` | `tokens.css` | `space.50 … space.1200` | rename |
| `--radius-card / control / float / pill`, `--tile-radius` | `tokens.css`, `vault.css` | `radius.card` (100), `radius.control` (200), `radius.overlay` (400), `radius.pill` (full), `folder-card.radius` (600) | rename |
| `--control-sm / md / lg` | `tokens.css` | `size.control.sm / md / lg` | rename |
| `--shadow-float` | `tokens.css` | `elevation.overlay` | rename |
| `--ease` (150 ms ease-out) | `tokens.css` | `motion.hover` = duration.150 + easing.out | split |
| `--folder-*-from / -to` | `vault.css` | `folder-card.<colour>.from / to` | component tokens; blue.to aliases accent.600 |
| `--mark` | `ui.css` | `marks.color` → color.border.default | component |
| `#111111` | `editor.css:93`, `vault.css:346`, `vault.css:483` | color.text.primary (neutral.950) | **merge** (ΔE 1.9) |
| `#CBCBD8` / `#33333F` (canvas dots) | `tokens.css` | canvas.grid.minor | **merge** light into neutral.200 (ΔE 1.5); fix DESIGN.md drift |
| `#C9CBFF` (your avatar) | `editor.css:94`, `Dashboard.tsx`, `items.tsx`, `demo.ts` | `avatar.local.bg` → accent.200 | tokenise |
| `#BFE8CF`, `#FFD3B0` (demo people) | `demo.ts`, `items.tsx` | `presence.user.*` (categorical) | data colours, later (Phase 16) |
| folder-art greys `#18181B #1B1B1E #2A2A2E #2C2C30 #3A3A3E #5A5A60 #6A6A70` and white glass layers (8–70 %) | `vault.css` | `folder-card.glass.* / archive.*` | component tokens; illustration, keep exact |
| `0 1px 3px rgba(0,0,0,.18)` and `.12` | `vault.css:259/372`, `dashboard.css:154` | `elevation.paper` (15 %) | **merge** |
| `0 1px 2px rgba(17,17,20,.06)` | `vault.css:136` | `elevation.raised` | keep |
| `inset 0 0 0 1px` / `0 0 0 1px` accent rings | `dashboard.css:93/254` | `border.width.default` + color.accent.default (selection ring) | keep, tokenise |
| font 9 px, 10 px | `vault.css:344` (avatar initials), `vault.css:324` (folder pill), `editor.css:77` (badge) | font.size.100 (11) | decision 5 |
| font 8 px | `ui.css:445` (`●` before tile labels) | keep as glyph size | not text |
| spacing 5 px | `ui.css:513` (issue dot) | keep | optical: (18 − 8) / 2 centres the dot on the text line |
| spacing 7 / 10 / 18 px | `vault.css:326` (pill), `vault.css:318` (glass front), `vault.css:248` (back panel) | keep inside folder art | illustration |
| spacing 18 px | `ui.css:557` (`.pc-toolcall ol` indent) | space.500 (20) or 400 (16) | snap |
| margin 13 px on `p.pc-muted` | style sheet page (browser default `1em`) | set an explicit margin | browser default leaking through |
| radius 3 px | `ui.css:308` (segmented buttons) | keep = radius.control − 1 px padding | concentric (skill §4.1) |
| radius 5 / 10 / 18 px | `vault.css:402/366/249/305` | keep inside folder art (A2 says back panel ≈ 20 → radius.700?) | illustration |
| opacity 0.45 | `ui.css:153` (disabled buttons) | opacity.disabled | keep |
| opacity 0.35 / 0.4 / 0.7 | `vault.css:243` (glow), `dashboard.css:286` (disabled tree row), `ui.css:575` (tooltip key) | glow → component; 0.4 → opacity.disabled (0.45); 0.7 → color.text.secondary on ink | merge |
| canvas fill-opacity 0.25 / 0.3 / 0.55 | `PlanView.tsx:306/287/85` | `canvas.selection.fill`, `canvas.hover.fill`, `canvas.room.fill` | canvas tokens (via `tokens.ts`) |
| hard-coded thumbnail colours `#E4E4F2`, `#111114`, `#6B6B78`, `#FFFFFF` | `engine/render/thumbnail.ts`, `ui/PlanThumbnail.tsx` | `canvas.room.fill`, `canvas.wall.fill`, … passed in as options | the engine stays pure: the app passes token values in |
| z-index 1 / 2 / 4 / 5 / 10 / 50 | see Z-index table | `z.*` above | rename |
| `@media` 640 / 720 / 760 | `styleguide.css:123`, `editor.css:378`, `vault.css:552` | `bp.narrow` (760) | merge |

### Not covered by this run
- Hover, focus and pressed colours come from the static scan only (the runtime sample does not hover).
- Dialogs other than ⌘K, the editor's chat panel states and the narrow (phone) layouts were not opened; the full audit (skill §2) will add screenshots at 1280 / 1440 px and 200 % zoom.
