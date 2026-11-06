# Token changelog

Newest first. Renames keep the old name as a deprecated alias for one release (skill `plancraft-ux-refine` §3.7.5), listed in `deprecated.json`.

## 1.1.0 — 2026-11-06 (DS-02, DS-03, founder approved)

**Changed**
- Text, spacing, control, icon, target and panel sizes are emitted in **rem** (`8px` → `0.5rem`, px kept in a comment) so **Settings → Text size** scales them; at 100 % they compute to the same px. Borders, radii, shadows, blur, durations stay px.

**Added**
- `paper.bg / ink / room` (white drawing paper for file cards and thumbnails).
- `color.alpha.ink-60`, `folder-card.pill.bg / text`, `folder-card.<colour>.ink`, `color.folder.orange.ink` `#C2410C`, `color.folder.green.ink` `#19864D` (folder-art contrast, D1).
- `lint-allow.json` and the token lint (`tools/tokens/lint.ts`, DS-02); `tools/tokens/rem-codemod.ts`.

## 1.0.0 — 2026-11-06 (DS-01, founder approved)

**Added**
- The token system: DTCG-style JSON in `base/` (colour, space, size, radius, border, type, motion, elevation, opacity, z, blur), `semantic/` (`common.json`, `theme.light.json`, `theme.dark.json`) and `component/` (`icon`, `folder-card`, `avatar`, `panel`, `marks`). Build: `npm run tokens` → `frontend/src/design/tokens.css`, `frontend/src/design/tokens.ts`, `tokens.html`, `TOKEN-INDEX.md`.
- `color.border.control` (`#84848E` light / `#72727E` dark): edges of inputs and the switch track, 3:1.
- `color.text.strong`, `color.text.placeholder`, `color.state.subtle-fill`, `color.accent.fill`, `color.categorical.1–7` (Okabe-Ito, for diff and presence later).
- A3.1 icon tokens (`icon.*`, `size.icon.*`) with a separate light-theme mapping (founder rule).
- `size.target.*` (24 / 32 / 44), `size.panel.*` and `motion.panel` / `motion.panel-duration` (for P2.2a), `avatar.*`, `folder-card.*`.

**Changed (light theme, for WCAG AA)**
- `color.text.secondary` (was `--text-muted`): `#6B6B78 → #656571`.
- `color.status.success` (`--ok`): `#1B7F46 → #18753F`; `color.status.warning` (`--warn`): `#B45309 → #A34A07`; `color.status.error` (`--error`): `#C93035 → #BB2B30`.
- `canvas.grid.minor` (`--canvas-dot`): `#CBCBD8 → #C8C8D2` (merged into `color.neutral.200`).

**Renamed (old name → token; old names still work)**
- Every variable of the old `tokens.css` and the Vault folder variables: see `deprecated.json` (56 names), e.g. `--text` → `color.text.primary` (`--pc-color-text-primary`), `--space-4` → `space.200`, `--ease` → `motion.hover`, `--folder-blue-to` → `folder-card.blue.to`.

**Removed**
- The hand-written `:root` folder colours and `--tile-radius` in `vault.css` (now tokens).

**Kept as built** (the code won): 220 ms folder-art motion; folder-art radii and greys (illustration; component tokens later).
