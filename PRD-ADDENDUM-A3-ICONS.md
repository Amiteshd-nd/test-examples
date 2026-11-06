# PRD Addendum A3 — Icon System (duotone)

> **Extends:** `PRD.md` v1.2, A1 (`PRD-ADDENDUM-3D-PRESENTATION.md`), A2.1 (`PRD-ADDENDUM-A2-VAULT.md`). All rules still apply (`CLAUDE.md`, 🛑 STOP points, `DESIGN.md`).
> **Version:** A3.1 · **Date:** 6 Nov 2026 · CSS variable names aligned with the `plancraft-ux-refine` token system (`--pc-` prefix, semantic tier).
> **For Claude Code — first action when you read this file:** add one line to `CLAUDE.md` under the spec references: *"Also follow `PRD-ADDENDUM-A3-ICONS.md` (icon system, prompts PI.1–PI.4). Never use emoji or random icon sets in the UI; use the `Icon` component."* Then continue with the current prompt. Run PI.1 together with **P2.1**, PI.2–PI.3 before **P2.2 / P14.1**, PI.4 whenever new features need icons.

---

## 1. Decision (plain language)

**Use a free library for common icons, and draw our own for CAD-specific ones, all in one duotone style.**
- **Library: Phosphor Icons** (`@phosphor-icons/react`, **MIT licence**, 1,500+ icons, has a **duotone** weight, icons inherit `currentColor`). No attribution required; keep the MIT notice in `THIRD_PARTY_NOTICES.md`.
- **Custom icons:** walls, doors, windows, stairs, separators, trim/offset, setbacks, Vastu compass, generation etc. don't exist in any library in a good form. We draw them on the same grid and stroke so they sit next to Phosphor icons seamlessly. A **starter set of 12** is in §7 (drawn by Claude in chat; refine with the founder).
- **Alternative considered:** Solar icons ("Line Duotone", 1,200+ icons) look close to the reference but are **CC BY 4.0** (attribution required) and mixing two libraries breaks consistency. Not chosen; can be revisited.
- **Reference image** (`/design/reference-icons/`): style only. Do not copy its icons (they are someone else's artwork).

## 2. The style (from the founder's reference)

Two-tone line icons on dark UI:
- **Line layer:** rounded outline, light (white/near-white on dark; near-black on light theme).
- **Fill layer:** the main shape filled with a dark tint — neutral grey when inactive, deep accent (e.g. dark green) when active.
- **Accent layer:** small inner details (grid lines, hatch, dashes, dots, sparkles) — grey when inactive, bright accent when active.
- **Active nav item:** accent text, accent icon details, a 3 px accent bar on the left, and a soft accent gradient behind the row.
- **Accent colour comes from `DESIGN.md`**, not from the reference: the reference uses green; if the brand accent is orange (Vault folders) or another colour, icons follow it automatically. 🛑 Confirm the accent with the founder in PI.1.

## 3. Technical spec

| Item | Rule |
|---|---|
| Grid | `viewBox="0 0 24 24"`, live area 20×20 (2 px padding); key shapes on whole or half pixels |
| Stroke | line layer **1.5** (matches Phosphor regular/duotone), accent layer 1.5; round caps and joins |
| Corners | rectangles `rx` 1.5–2.5; no sharp outer corners except where the meaning needs them |
| Fill | only the main silhouette; never fill accent details |
| Sizes | 16 (dense lists), **20 (default)**, 24 (toolbars), 32 (empty states/onboarding); never scale non-integer |
| Layers (classes) | `pc-line`, `pc-fill`, `pc-accent`, `pc-accent-fill` — the only allowed classes |
| Colours | never hard-coded inside SVGs; always CSS variables (below) |
| Naming | kebab-case nouns or verbs: `wall`, `door`, `generate-layout`, `plot-setback` |

**CSS (tokens come from `DESIGN.md`):**
```css
.pc-icon { width: var(--pc-size-icon-md); height: var(--pc-size-icon-md); flex: none;
  --i-line: var(--pc-icon-line); --i-fill: var(--pc-icon-fill-neutral); --i-accent: var(--pc-icon-accent-muted); }
.pc-icon.sm { width: var(--pc-size-icon-sm); height: var(--pc-size-icon-sm); }
.pc-icon.lg { width: var(--pc-size-icon-lg); height: var(--pc-size-icon-lg); }
.pc-icon .pc-line { fill: none; stroke: var(--i-line); stroke-width: var(--pc-icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.pc-icon .pc-accent { fill: none; stroke: var(--i-accent); stroke-width: var(--pc-icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.pc-icon .pc-accent-fill { fill: var(--i-accent); }
.pc-icon .pc-fill { fill: var(--i-fill); }
[data-state="active"] .pc-icon, .pc-icon[data-state="active"] {
  --i-line: var(--pc-icon-line-strong); --i-fill: var(--pc-icon-fill-active); --i-accent: var(--pc-icon-accent); }
[data-state="disabled"] .pc-icon { opacity: var(--pc-opacity-disabled); }
/* Phosphor duotone: recolour its secondary (20% opacity) layer to our fill token */
.pc-ph [opacity="0.2"] { fill: var(--i-fill); opacity: 1; }
.pc-ph { color: var(--i-line); }
```
These are **semantic / component tokens** defined in `/design/tokens/` (skill §3), aliasing semantic colours — e.g. `icon.line → {color.text.primary}`, `icon.line-strong → {color.text.strong}`, `icon.fill-neutral → {color.state.subtle-fill}`, `icon.accent-muted → {color.text.muted}`, `icon.accent → {color.accent.default}`, `icon.fill-active → {color.accent.deep}`, `icon.stroke → 1.5`, `size.icon.sm/md/lg/xl → 16/20/24/32`. Starting dark-theme values to try: subtle fill `rgba(255,255,255,.10)`, accent `#2EE59D`, accent deep `#0F3D2A`, muted `#8E8E93` — final values come from `DESIGN.md` and the brand accent decision. Never write raw colours in icon CSS.

**One component for everything:**
```tsx
<Icon name="wall" size={20} state="default|active|disabled" label="Wall tool" />
```
- `name` resolves to a custom SVG (`/frontend/icons/custom/*.svg`) or a Phosphor icon through a **registry** (`/frontend/icons/registry.ts`: `name → {source: "custom"|"phosphor", component}`).
- Phosphor icons render with `weight="duotone"` inside a wrapper with class `pc-icon pc-ph`.
- `label` → `aria-label` + `role="img"`; without `label` the icon is decorative (`aria-hidden`). Icon-only buttons **must** have a label and a tooltip.
- Custom SVGs are compiled to React components at build time (e.g. SVGR, ask before adding) and tree-shaken.
- ✅ Verify Phosphor's duotone markup in the installed version (secondary layer uses `opacity="0.2"`); adapt the CSS selector if it differs.

## 4. Icon inventory (brainstormed — Claude Code completes and maintains it)

Source: **P** = Phosphor (suggested name; verify it exists in the installed version, otherwise pick the closest and note it) · **C** = custom.

**UI primitives (used everywhere):** close **P** `x` · check **P** `check` · chevrons **P** `caret-down` / `caret-right` / `caret-left` / `caret-up` · switcher **P** `caret-up-down` · info **P** `info` · filter **P** `funnel` · sort **P** `sort-ascending` · external link **P** `arrow-square-out` · link **P** `link` · upload **P** `upload-simple` · download **P** `download-simple` · notifications **P** `bell` · sign out **P** `sign-out` · keyboard shortcuts **P** `keyboard` · theme **P** `sun` / `moon` · UI scale **P** `text-aa` · density **P** `rows` · drag handle **P** `dots-six-vertical` · pin **P** `push-pin` · visibility **P** `eye` / `eye-slash` · edit **P** `pencil-simple` · duplicate **P** `copy-simple` · refresh **P** `arrow-clockwise` · loading spinner **C** (accent arc, honours reduced motion)

**Vault & navigation (A2.1):** home **P** `house` · search **P** `magnifying-glass` · ask-ai **P** `sparkle` · plan-library **P** `books` · templates **P** `layout` · insights **P** `chart-line-up` · integrations **P** `plugs` · starred **P** `star` · shared **P** `users-three` · trash **P** `trash` · settings **P** `gear-six` · help **P** `question` · account **P** `user-circle` · folder **P** `folder` · folder-open **P** `folder-open` · archive **P** `archive` · new **P** `plus` · import-dxf **C** · export **P** `export` · grid-view **P** `squares-four` · list-view **P** `list` · more **P** `dots-three` · command-k **P** `command`

**Drawing & editing tools (P2.5):** select **P** `cursor` · pan **P** `hand` · wall **C** · room **C** · separator **C** · door **C** · window **C** · stair **C** · line **P** `line-segment` · polyline **P** `line-segments` · rectangle **P** `rectangle` · move **P** `arrows-out-cardinal` · copy **P** `copy` · rotate **P** `arrow-clockwise` · mirror **P** `flip-horizontal` · offset **C** · trim **C** · extend **C** · delete **P** `trash` · dimension **C** · text **P** `text-t` · room-label **C** · hatch **C** · layers **P** `stack` · snap **P** `magnet` · grid **P** `grid-four` · measure **P** `ruler` · undo **P** `arrow-counter-clockwise` · redo **P** `arrow-clockwise` · zoom-in/out **P** `magnifying-glass-plus` / `magnifying-glass-minus` · fit **P** `arrows-in`

**Plan, rules & layout (P3, P5):** plot-setback **C** · vastu-compass **C** · north-arrow **C** · reference-check **C** · issue-error **P** `x-circle` · issue-warning **P** `warning` · issue-ok **P** `check-circle` · lock **P** `lock-simple` · unlock **P** `lock-simple-open` · fixed/fill/range behaviour **C** (3 icons) · reflow **C** · variations **C** · metrics **P** `chart-bar` · plan-graph **P** `graph` (or **C**)

**AI & chat (P4, P6):** generate-layout **C** · chat **P** `chat-circle-dots` · send **P** `paper-plane-right` · ai-working **C** (animated accent dots) · brief **C**

**Room types (labels, legends, library filters):** living **P** `couch` · bedroom **P** `bed` · kitchen **P** `cooking-pot` · toilet **P** `toilet` · bath **P** `bathtub` · dining **P** `fork-knife` · parking **P** `car` · utility **P** `washing-machine` · balcony **C** · pooja **C** (a simple lamp/diya, respectful and minimal) · store **P** `package` · study **P** `desk` · ots **C** (open-to-sky) · staircase → `stair` **C**

**3D & presentation (A1):** view-3d **P** `cube` · axonometric **C** · exploded-view **C** · section-box **C** · material **P** `paint-bucket` · sun **P** `sun` · render **P** `camera` · sheet **C** · frame **P** `frame-corners` · scale-bar **C** · export-pdf **P** `file-pdf` · print **P** `printer`

**Versions, branches & collaboration (A2.1):** history **P** `clock-counter-clockwise` · version **P** `bookmark-simple` · branch **P** `git-branch` · merge **P** `git-merge` · compare **P** `git-diff` · conflict **C** · review **P** `seal-check` · comment **P** `chat-teardrop-dots` · presence **P** `users` · follow **P** `eye` · offline **P** `wifi-slash` · saved **P** `cloud-check`

## 5. Prompts

#### PI.1 — 🛑 Icon style sign-off (run with P2.1)
**Tasks:** 🛑 ask the founder to put the icon reference(s) in `/design/reference-icons/` and confirm: accent colour (from `DESIGN.md`), default size (20), dark/light behaviour. Add the §2–§3 spec as an "Icons" section in `DESIGN.md`.
**✅** Founder approves the section.

#### PI.2 — Icon component, registry, Phosphor adapter
**Tasks:** 🛑 ask before adding `@phosphor-icons/react` (MIT) and an SVG-to-component build step. Build `Icon`, registry, CSS (§3), Phosphor duotone recolouring, accessibility rules, unit tests (unknown name → visible fallback + console warning in dev; label → `aria-label`).
**✅** Phosphor and custom icons render side by side with identical size, stroke weight and colours in default / active / disabled states, in both themes.

#### PI.3 — Custom icon set v1
**Tasks:** add the 12 starter icons from §7 as files; then draw the remaining **C** icons in §4 following §3 (Claude Code brainstorms each metaphor first, in one line, e.g. "hatch = rectangle with diagonal accent lines"). Generate `/design/icons.html`: every icon at 16/20/24/32, default and active, dark and light, with names — the **icon sheet**.
**🛑** Show the icon sheet to the founder; revise until approved. Icons the founder rejects are redrawn, never replaced by a random library icon.
**✅** All §4 icons exist and render; the sheet is approved; an automated check confirms every custom SVG uses only the 4 allowed classes, `viewBox="0 0 24 24"`, and no hard-coded colours.

#### PI.4 — Ongoing rule (every later prompt)
Every new feature that needs an icon: check the registry → use Phosphor if a good match exists → otherwise draw a custom icon per §3 → add it to §4 inventory and the icon sheet. No emoji, no other icon libraries, no raster icons in the UI.

## 6. Accessibility & quality
- Contrast: line layer ≥ 3:1 against its background (WCAG non-text contrast); never convey state by colour alone (active also has the left bar / weight change).
- Hit area for icon buttons ≥ 32×32 px (≥ 40×40 on touch), even when the icon is 20 px.
- Tooltips on all icon-only buttons, with shortcut (e.g. "Wall · W").
- Optical check at 16 px: if details blur, the 16 px version may drop accent details (separate `-16` variant only when needed).

## 7. Starter custom icons (12) — production SVGs

Drawn on the 24 grid with the §3 classes. A preview sheet (`icon-starter-preview.png`) was shared with the founder; refine in PI.3.

```svg
<!-- wall.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pc-icon" aria-hidden="true" focusable="false">
<rect class="pc-fill" x="3" y="8.5" width="18" height="7" rx="1.5"/>
<path class="pc-accent" d="M7 15.5l4-7M12 15.5l4-7M17 15.5l2.6-4.6"/>
<rect class="pc-line" x="3" y="8.5" width="18" height="7" rx="1.5"/>
</svg>

<!-- door.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pc-icon" aria-hidden="true" focusable="false">
<path class="pc-fill" d="M6 20V7a13 13 0 0 1 13 13z"/>
<path class="pc-accent" d="M6 7a13 13 0 0 1 13 13" stroke-dasharray="2 2.2"/>
<path class="pc-line" d="M2.5 20H6M19 20h2.5M6 20V7"/>
</svg>

<!-- window.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pc-icon" aria-hidden="true" focusable="false">
<rect class="pc-fill" x="3" y="9" width="18" height="6" rx="1.5"/>
<path class="pc-accent" d="M5.5 11h13M5.5 13h13"/>
<rect class="pc-line" x="3" y="9" width="18" height="6" rx="1.5"/>
</svg>

<!-- stair.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pc-icon" aria-hidden="true" focusable="false">
<rect class="pc-fill" x="5" y="3" width="14" height="18" rx="2"/>
<path class="pc-accent" d="M5 7.5h14M5 11.5h14M5 15.5h14"/>
<rect class="pc-line" x="5" y="3" width="14" height="18" rx="2"/>
<path class="pc-line" d="M12 18.5V5.5M9.5 8l2.5-2.5L14.5 8"/>
</svg>

<!-- room.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pc-icon" aria-hidden="true" focusable="false">
<rect class="pc-fill" x="3.5" y="3.5" width="17" height="17" rx="2.5"/>
<path class="pc-line" d="M9 20.5H6a2.5 2.5 0 0 1-2.5-2.5V6A2.5 2.5 0 0 1 6 3.5h12A2.5 2.5 0 0 1 20.5 6v12a2.5 2.5 0 0 1-2.5 2.5h-3"/>
<circle class="pc-accent-fill" cx="12" cy="11" r="1.6"/>
<path class="pc-accent" d="M12 6.5v1.5M12 14v1.5M7.5 11h1.5M15 11h1.5"/>
</svg>

<!-- separator.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pc-icon" aria-hidden="true" focusable="false">
<rect class="pc-fill" x="3.5" y="4.5" width="8.5" height="15" rx="0"/>
<path class="pc-accent" d="M12 4.5v15" stroke-dasharray="2.2 2.2"/>
<rect class="pc-line" x="3.5" y="4.5" width="17" height="15" rx="2.5"/>
</svg>

<!-- dimension.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pc-icon" aria-hidden="true" focusable="false">
<rect class="pc-fill" x="8.5" y="4" width="7" height="4.5" rx="1.2"/>
<path class="pc-line" d="M4 9v11M20 9v11M2.8 16.2l2.4-2.4M18.8 16.2l2.4-2.4"/>
<path class="pc-accent" d="M4 15h16"/>
<rect class="pc-line" x="8.5" y="4" width="7" height="4.5" rx="1.2"/>
</svg>

<!-- trim.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pc-icon" aria-hidden="true" focusable="false">
<rect class="pc-fill" x="12" y="9.5" width="9" height="5" rx="1.2"/>
<path class="pc-line" d="M12 3.5v17M3.5 12H12"/>
<path class="pc-accent" d="M13.5 12h4" stroke-dasharray="1.8 2"/>
<path class="pc-accent" d="M18.8 10.3l2.4 3.4M21.2 10.3l-2.4 3.4"/>
</svg>

<!-- offset.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pc-icon" aria-hidden="true" focusable="false">
<path class="pc-line" d="M4 19.5V13a8 8 0 0 1 8-8h7.5"/>
<path class="pc-accent" d="M8.5 19.5V13A3.5 3.5 0 0 1 12 9.5h7.5"/>
<circle class="pc-accent-fill" cx="19.5" cy="9.5" r="1.3"/>
</svg>

<!-- plot-setback.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pc-icon" aria-hidden="true" focusable="false">
<rect class="pc-line" x="3" y="3" width="18" height="18" rx="2.5"/>
<rect class="pc-fill" x="7" y="7" width="10" height="10" rx="1.2"/>
<rect class="pc-accent" x="7" y="7" width="10" height="10" rx="1.2" stroke-dasharray="2 2"/>
</svg>

<!-- vastu-compass.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pc-icon" aria-hidden="true" focusable="false">
<circle class="pc-fill" cx="12" cy="12" r="8.5"/>
<circle class="pc-line" cx="12" cy="12" r="8.5"/>
<path class="pc-accent-fill" d="M12 5.2l1.9 6.8h-3.8z"/>
<path class="pc-accent" d="M12 12v6.3"/>
<path class="pc-line" d="M12 1.8v1.2M22.2 12H21M12 22.2V21M1.8 12H3"/>
</svg>

<!-- generate-layout.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pc-icon" aria-hidden="true" focusable="false">
<rect class="pc-fill" x="3" y="6" width="14" height="15" rx="2"/>
<path class="pc-line" d="M17 11v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M3 13.5h7v7.5M10 13.5v-3"/>
<path class="pc-accent-fill" d="M18 2.5l1.1 2.9 2.9 1.1-2.9 1.1L18 10.5l-1.1-2.9-2.9-1.1 2.9-1.1z"/>
</svg>
```

## 8. Change log
- **A3.1 (6 Nov 2026):** CSS variables renamed to the skill's token system (`--pc-…`, semantic/component tiers; no raw colours); UI-primitive and settings icons added to the inventory.
- **A3.0 (6 Nov 2026):** Icon system: Phosphor (MIT, duotone) + custom CAD icons in one style; tokens and CSS; `Icon` component and registry; inventory across Vault, editor, rules, AI, room types, 3D/boards and collaboration; prompts PI.1–PI.4; 12 starter custom SVGs.
