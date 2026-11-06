---
name: plancraft-ux-refine
description: Senior product-design review and polish for the PlanCraft UI (Vault dashboard, CAD editor, panels, chat, 3D, boards). Use this skill whenever building, reviewing or changing any screen or component; whenever the founder mentions spacing, padding, gaps, alignment, hover, focus, states, accessibility, contrast, readability, "make it feel polished", design tokens, theming or density; and always before marking any UI prompt (P2.x, P14.x, P13.x, PI.x, or any task that touches /frontend) as done. Also use it to reverse-engineer and index the styles already in the code (colours, type scale, spacing and other scales), and to create, migrate or lint the design-token system (base → semantic → component tokens).
---

# PlanCraft UX Refine — senior product design review, tokens & accessibility

You are acting as a **senior staff product designer + design-token engineer** who has shipped professional CAD and design tools. Your job: make what Claude Code built feel **calm, precise and learnable** for everyone from a first-year architecture student to a 65-year-old senior draftsman with 30 years of AutoCAD muscle memory — without slowing down experts.

Work inside the project rules: `CLAUDE.md`, `PRD.md` and addenda, `/design/DESIGN.md`. Ask before adding dependencies. Never change product behaviour or visual direction without the founder (🛑) — polish within the approved style.

---

## 1. When to run, and how deep

| Trigger | Depth |
|---|---|
| End of any prompt that touched `/frontend` | **Quick pass** (§9 checklist on changed components only, 10–20 min) |
| End of a UI phase (P2, P14, P13, PI) or before a founder demo | **Full audit** (§2 workflow, all screens) |
| Founder asks for tokens, theming, density, or "fix spacing everywhere" | **Token work**: §3.6 as-built index first, then §3.1–§3.5 and §3.7, then a full audit |
| First time this skill runs on the project, or after a large UI change | **As-built index** (§3.6) — document what exists before changing anything |
| **P2.1** (design system set-up) and **PI.1–PI.2** (icons) | Build the token system (§3.1–§3.5) **from the start**, using DESIGN.md values; icon variables follow A3.1 names (`--pc-icon-*`, `--pc-size-icon-*`) |

## 2. Full-audit workflow
1. **Inventory** — list every screen, panel and component in scope with its file path. Take screenshots (dark + light, 100% and 200% zoom, desktop 1440 px and laptop 1280 px widths).
2. **As-built index + token index** (§3.6, §3.7) — reverse-engineer what the code really uses, then map it to tokens.
3. **Persona walkthroughs** (§7) — run the task scripts; note friction.
4. **State matrix** (§5) — every interactive component × every state.
5. **Spacing & layout pass** (§4) — padding, gaps, alignment, rhythm.
6. **Accessibility pass** (§6) — automated checks + keyboard sweep + zoom + contrast.
7. **Fix** in small, reviewable commits; one concern per commit (e.g. "nav: unify item padding to tokens").
8. **Verify** — re-run checks; before/after screenshots side by side.
9. **Report** (§10) — write `/design/audits/YYYY-MM-DD-<area>.md`; summarise in plain language for the founder; 🛑 list visual decisions that need approval.

---

## 3. Design-token system (atomic, nested, scalable)

### 3.1 Three tiers — and the one rule that keeps them clean
```
BASE (primitives)      raw, context-free values         color.neutral.900 = #121214
   ▲ referenced by
SEMANTIC (aliases)     purpose / meaning, theme-aware   color.bg.surface = {color.neutral.900}
   ▲ referenced by
COMPONENT (mapped)     a component's own slots          nav.item.bg.active = {color.accent.subtle}
   ▲ used by
CODE                   CSS / TSX use only semantic or component tokens — never base, never raw values
```
- **Base** never changes per theme; it is the palette and the scales.
- **Semantic** is where themes (dark, light, high-contrast), density (comfortable, compact) and UI scale plug in — by **re-mapping aliases**, not by editing components.
- **Component** tokens exist only when a component needs a value that differs from the semantic default, or needs per-state slots. Don't create one-off component tokens that just repeat a semantic token.
- Exception: canvas rendering code may read semantic **canvas** tokens (§3.4) through the TS export.

### 3.2 Naming
`{tier?}.{category}.{concept}.{property}.{variant}.{state}` — dot path in JSON, kebab-case CSS variables with the `--pc-` prefix.
- Base: `color.green.500`, `space.400`, `radius.300`, `font.size.300`, `duration.200`
- Semantic: `color.text.primary`, `color.bg.surface-raised`, `color.border.subtle`, `color.accent.default`, `space.inset.md`, `space.stack.lg`, `space.inline.sm`, `size.control.md`, `elevation.overlay`
- Component: `button.primary.bg.hover`, `nav.item.bg.active`, `folder-card.glass.blur`, `table.row.height`, `canvas.wall.fill`
- CSS: `--pc-color-text-primary`, `--pc-nav-item-bg-active`
- States always last: `default · hover · focus · pressed · selected · disabled · dragged · drop-target · error`
- Scales use numeric steps with gaps for later insertion (`100, 200, 300 …`), never `small/smaller/smallest`.

### 3.3 Format and build
- Source of truth: **DTCG-style JSON** (`$value`, `$type`, `$description`, aliases as `{color.neutral.900}`) in `/design/tokens/`:
```
/design/tokens/
  base/color.json  base/space.json  base/size.json  base/radius.json  base/type.json
  base/motion.json base/elevation.json base/opacity.json base/z.json base/blur.json
  semantic/theme.dark.json   semantic/theme.light.json   semantic/theme.high-contrast.json
  semantic/density.comfortable.json   semantic/density.compact.json
  semantic/common.json        (theme-independent semantics: type styles, motion, z)
  component/*.json            (button, input, nav, tree, folder-card, file-table, toolbar,
                               panel, tooltip, menu, dialog, chat, canvas, diff, presence …)
  TOKEN-INDEX.md  CHANGELOG.md
```
- Build (🛑 ask before adding a builder such as Style Dictionary, MIT) to:
  - `/frontend/src/styles/tokens.css` — `:root` = base + default theme; `[data-theme="light"]`, `[data-theme="high-contrast"]`, `[data-density="compact"]` blocks re-map semantics; `@media (prefers-color-scheme)` picks the default when the user hasn't chosen.
  - `/frontend/src/styles/tokens.ts` — typed constants for canvas/three.js code (no CSS access there).
  - `/design/tokens/tokens.html` — a visual token sheet (swatches, scales, type specimens, contrast ratios).
- **UI scale:** all sizes in `rem`; settings offer 100% / 112.5% / 125% / 150% by changing the root font size. Canvas line weights are **not** scaled by UI scale (drawing accuracy), but canvas labels are.

### 3.4 Categories (complete list to maintain)
| Category | Base | Semantic examples |
|---|---|---|
| Color | neutral 0–1000, accent 50–950 (brand hue from DESIGN.md), red, amber, blue, teal, categorical (Okabe-Ito: `#E69F00 #56B4E9 #009E73 #F0E442 #0072B2 #D55E00 #CC79A7`) | `bg.canvas/app/surface/surface-raised/overlay/inset`, `text.primary/secondary/muted/inverse/on-accent/link`, `border.subtle/default/strong/focus`, `accent.default/hover/pressed/subtle/deep`, `status.error/warning/success/info` (+ `-subtle` backgrounds), `state.hover-overlay/pressed-overlay/selected-bg` |
| Typography | families (UI sans + fallbacks, mono), sizes 100–900, weights, line-heights, letter-spacing | composite styles: `type.display`, `type.title.lg/md/sm`, `type.body.md/sm`, `type.label.md/sm`, `type.caption`, `type.mono.dimension`, `type.number.tabular` |
| Space | 0, 50(2), 100(4), 150(6), 200(8), 300(12), 400(16), 500(20), 600(24), 800(32), 1000(40), 1200(48), 1600(64) px | `space.inset.xs/sm/md/lg/xl` (padding), `space.stack.xs…xl` (vertical gaps), `space.inline.xs…lg` (horizontal gaps), `space.gutter.page/panel`, `space.grid.gap` |
| Size | 12–64 steps | `size.control.sm/md/lg` (28/32/40 compact… see §4), `size.icon.sm/md/lg/xl` (16/20/24/32), `size.target.min` (24), `size.target.comfortable` (32), `size.target.touch` (44), `size.sidebar`, `size.panel` |
| Radius | 0, 100(2), 200(4), 300(6), 400(8), 500(12), 600(16), 700(20), full | `radius.control`, `radius.card`, `radius.panel`, `radius.tile`, `radius.pill` |
| Border | widths 1, 1.5, 2 | `border.width.default/strong/focus` |
| Elevation | shadow recipes 0–5 | `elevation.raised/overlay/dialog/drag` (on dark: lighter surface tint + soft shadow) |
| Blur | 0, 8, 14, 20, 40, 60 | `blur.glass`, `blur.glow` |
| Opacity | 0–100 steps | `opacity.state.hover` .08, `focus` .10, `pressed` .10, `dragged` .16, `disabled` .38 |
| Motion | durations 0/100/150/200/250/300/400 ms; easings standard/enter/exit/emphasized | `motion.hover`, `motion.panel`, `motion.dialog`, `motion.reduced` (0 ms, honours `prefers-reduced-motion`) |
| Z-index | 0, 10…100 | `z.canvas`, `z.toolbar`, `z.panel`, `z.dropdown`, `z.tooltip`, `z.dialog`, `z.toast`, `z.drag-ghost` |
| Breakpoints | 960, 1280, 1440, 1920 | `bp.compact-layout`, `bp.wide-layout` |
| Focus | — | `focus.ring.width` 2, `focus.ring.offset` 2, `focus.ring.color` |
| **Canvas (CAD)** | — | `canvas.bg`, `canvas.grid.minor/major`, `canvas.wall.fill/stroke/hatch`, `canvas.room.fill` (by category), `canvas.selection.stroke/fill`, `canvas.hover.stroke`, `canvas.snap.marker`, `canvas.dimension.text/line`, `canvas.issue.error/warning`, `canvas.ghost` (preview while drawing), `canvas.plot.boundary`, `canvas.setback` |
| **Diff & presence** | — | `diff.added`, `diff.removed`, `diff.changed` (colour-blind-safe: blue / vermillion / amber, **always** with + / − / ~ glyphs or patterns), `presence.user.1…8` (categorical, distinguishable, with name labels) |
| **Icons** (A3) | — | `icon.line`, `icon.fill.neutral`, `icon.accent`, `icon.accent.deep` → replace A3's provisional `--icon-*` / `--accent*` variables via aliases |

### 3.5 Starter skeleton (shape only — real values come from DESIGN.md)
```json
// base/color.json
{ "color": { "neutral": { "0": {"$type":"color","$value":"#FFFFFF"}, "900": {"$type":"color","$value":"#121214"} },
             "accent":  { "500": {"$type":"color","$value":"#2EE59D","$description":"Brand accent — confirm in DESIGN.md"} } } }
// semantic/theme.dark.json
{ "color": { "bg":   { "surface": {"$type":"color","$value":"{color.neutral.900}"} },
             "text": { "primary": {"$type":"color","$value":"{color.neutral.50}"} },
             "accent": { "default": {"$type":"color","$value":"{color.accent.500}"} } } }
// component/nav.json
{ "nav": { "item": { "bg":  { "active": {"$type":"color","$value":"{color.accent.subtle}"} },
                     "padding-inline": {"$type":"dimension","$value":"{space.inset.sm}"},
                     "height": {"$type":"dimension","$value":"{size.control.md}"} } } }
```

### 3.6 As-built index — reverse-engineer what already exists (run FIRST, change nothing)
Before designing or migrating tokens, document the design system the code **already** has, so nothing is lost and every later change is traceable.

**1. Collect from every source** (static scan + runtime sample):
- Stylesheets: CSS / SCSS / CSS modules, `tokens.css` or `:root` variables, `@media` and `[data-theme]` blocks.
- Utility classes: if Tailwind (or similar) is used, read its config **and** the class names in TSX (`p-3`, `gap-2`, `text-sm`, `rounded-lg`) — including arbitrary values like `p-[13px]`, `text-[#8e8e93]`.
- Inline styles and style objects in TSX; styled-components / CSS-in-JS.
- SVGs (`fill`, `stroke`, `stroke-width`), canvas and three.js code (hex numbers, line widths, font strings).
- Runtime: with browser tests, open each screen (dark + light, comfortable + compact if they exist) and record **computed styles** of every visible element (colour, background, border, font family/size/weight/line-height/letter-spacing, padding, margin, gap, radius, shadow, opacity, transition). This catches inherited values and browser defaults the static scan misses.

**2. Normalise and group**
- **Colours:** convert all to lowercase `#rrggbbaa`; resolve CSS variables to final values per theme; group by hue family (neutral, accent, red, amber, green, blue …) and sort by lightness; flag **near-duplicates** (colour difference ΔE2000 < 2, e.g. `#8e8e93` vs `#8f8f94`) as merge candidates; record where each is used as **text / background / border / icon / canvas** and the text-on-background pairs with their contrast ratios.
- **Type:** list font families (with fallbacks), every font-size (rem → px at 16), weight, line-height, letter-spacing, and the **combinations** actually used (these become text styles: e.g. 14/20/500). Sort sizes and compute the **ratio between consecutive steps**; report the nearest standard scale (1.125 major second · 1.2 minor third · 1.25 major third · 1.333 perfect fourth) and the sizes that break it.
- **Spacing:** every padding, margin, gap, inset (px). Detect the **base unit** (share of values divisible by 4 and by 8); list off-grid values (e.g. 5, 7, 10, 13, 15, 18) as fix candidates; show the implied scale.
- **Other scales:** radii, border widths, shadows (full recipe), blur, opacity, durations and easings, z-indexes, breakpoints, control heights, icon sizes.
- For every value: **usage count** and **locations** (`file:line` and component/screen). Values used fewer than 3 times are **outliers** to review.

**3. Write the as-built outputs**
- `/design/tokens/AS-BUILT-INDEX.md` — readable report:
  ```
  # As-built design system — <date>
  ## Summary (plain language): N colours (M near-duplicates), N font sizes (implied ratio ≈ 1.2, K off-scale), spacing base 4 px (X% on grid) …
  ## Colours        | value | family | role(s) | themes | uses | locations | near-duplicate of | proposed token |
  ## Contrast pairs | text | background | ratio | AA pass |
  ## Type scale     | size px | rem | weights | line-heights | letter-spacing | uses | proposed step |
  ## Text styles    | family | size/line-height/weight | uses | proposed style token |
  ## Spacing        | px | on 4-grid | uses | proposed step |
  ## Radii · Borders · Shadows · Blur · Opacity · Motion · Z-index · Breakpoints · Sizes   (same columns)
  ## Outliers & merge candidates
  ```
- `/design/tokens/as-built.json` — the same data machine-readable (values, counts, locations), so later audits can **diff** against it ("3 new colours since last audit").
- `/design/tokens/as-built-sheet.html` — visual sheet: colour swatches by family with contrast badges, type specimens for every size/style in use, spacing ruler, radius/shadow samples.

**4. Propose, then 🛑 stop**
- Draft the normalised **base scales** (colour ramps, type scale, spacing scale, radii …) that keep everything already used and merge only true duplicates and off-grid outliers.
- Write a **mapping table** `as-built value → proposed token` (with "merge", "keep", "snap to scale" notes) at the end of `AS-BUILT-INDEX.md`.
- Show the founder the summary and the as-built sheet next to the proposed sheet; **do not migrate code until approved**. After approval, continue with §3.7.

### 3.7 Token index & enforcement (do this on every full audit)
1. **Scan** `/frontend` (same sources as §3.6) for raw values remaining after migration: hex/rgb/hsl colours, `px`/`rem` lengths in margin/padding/gap/width/height/radius/font-size, shadows, durations, z-indexes. Report `file:line → value`.
2. **Map** each to an existing token, or propose a new semantic token (never a new base value unless the scale truly lacks it). Near-duplicates (e.g. 15px, 14px, 13px paddings) collapse to the nearest scale step.
3. **Write `/design/tokens/TOKEN-INDEX.md`**: for every token — name, tier, value per theme/density, alias chain, components that use it, usage count; plus sections **Unused tokens**, **Raw values remaining (file:line)**, **Contrast table** (every text/background and UI/background pair with ratio and pass/fail).
4. **Lint** (🛑 ask before adding tools): fail CI on raw colours and off-scale spacing in `/frontend` components (allow-list: token files, canvas rendering that reads `tokens.ts`).
5. **Change discipline:** renames keep the old name as a deprecated alias for one release (`$description: "deprecated → use …"`), logged in `tokens/CHANGELOG.md`.
6. **Migrate** earlier ad-hoc variables (A2 folder values, A3 icon variables) into the tiers; delete the old ones once unused.
7. **Re-run §3.6** at each full audit and diff `as-built.json` against the previous run; report new raw values, new colours or sizes, and tokens whose usage dropped to zero.

---

## 4. Spacing, padding & layout

### 4.1 Principles
- **4 px grid** for every dimension; 8 px rhythm for most layout gaps. Off-grid values are bugs.
- **Inside ≤ outside** (proximity): padding inside a group is smaller than the gap between groups. Related items 4–8 px; items in a group 8–12 px; groups 16–24 px; sections 32–48 px.
- **One padding owner**: a container pads its content *or* its children carry margin — never both (double padding is the most common polish bug).
- **Nested radius = outer radius − padding** (min 2 px), so corners look concentric.
- **Optical alignment:** icons align to the text's cap height, not its box; icon-only buttons are square; text baselines in a row line up.
- **Density** changes heights and padding together through semantic tokens — never per component.

### 4.2 Starting values (comfortable default · compact)
| Element | Height | Padding / gaps |
|---|---|---|
| Button / input / select | 36 · 32 (large 44) | inline padding 12–16 · 10–12; icon-label gap 8 |
| Icon button | 32×32 · 28×28 (visual 20 px icon) | hit area ≥ 32 (≥ 44 touch), even if visual is smaller |
| Sidebar nav item | 40 · 32 | padding-inline 12; icon-label gap 12; active bar 3 px; group gap 24; section label top 24 / bottom 8 |
| Tree item | 32 · 28 | indent 16 per level; chevron 16 in a 24 target; count right-aligned, muted |
| Folder tile (Vault) | per A2.1 | tile padding 16; grid gap 20–24; title-to-meta gap 4 |
| File table row | 44 · 36 | cell padding-inline 16 · 12; first column aligned with header text |
| Panel (right side) | — | padding 16; section gap 24; label-to-field 6; field-to-field 12 |
| Toolbar | 44 · 40 | tool gap 4; group separator with 8 px each side |
| Dialog | — | padding 24; title-to-body 12; button row gap 8–12, top margin 24 |
| Tooltip | — | padding 6×10; max width 280; offset 8 from target |
| Menu | item 32 · 28 | padding 4 container, 8–12 item inline; separator margin 4 |
| Chat panel | — | message padding 12×14; message gap 8 (same author) / 16 (new author); composer padding 12 |
| Page / main area | — | gutter 24 (≥1280 px: 32); section heading margin-bottom 16 |

### 4.3 Layout checks
- Content max widths for reading (forms, settings, docs): 60–80 characters.
- No horizontal page scroll at 1280 px or at 200% zoom; wide tables scroll inside their own container.
- Truncate long names with ellipsis **and** a tooltip/title with the full name; truncation never shifts layout.
- Numbers (areas, dimensions, metrics) use **tabular numerals**, right-aligned in tables, always with units.

---

## 5. Interaction states (every interactive component)

| State | Treatment |
|---|---|
| Default | Clear affordance: buttons look pressable, links look like links; clickable rows show it on hover |
| Hover | State layer over the component in its content colour at **8%**; cursor `pointer` for actions; ≤ 150 ms transition |
| Focus-visible | 2 px ring in `border.focus` + 2 px offset, ≥ 3:1 contrast against adjacent colours; never removed; only on keyboard focus (`:focus-visible`); never hidden under sticky bars |
| Pressed | 10% layer; visual response < 100 ms |
| Selected / active | Distinct from hover (filled background + accent marker + weight), not colour alone |
| Dragged | 16% layer, elevated shadow, ghost at source; drop targets highlight on entry |
| Disabled | 38% opacity content; `aria-disabled`; tooltip explains **why** ("Select a wall first") |
| Loading | Skeletons for lists/tiles; inline spinner + label for actions > 400 ms; long tasks (AI generation, export) show progress and can be cancelled |
| Error | Message near the field, in words + icon, with how to fix |
| Empty | Says what goes here and gives one primary action ("Import a DXF" / "New plan") |

**Hover is never the only way in.** Anything revealed on hover (row actions, tooltips, folder "⋯" menus) must also appear on keyboard focus and on selection, and be reachable on touch. Tooltips: show after ~500 ms, hide after ~100 ms; once one is showing, neighbours show instantly; tooltips include the shortcut ("Wall · W").

**CAD-specific feedback:** snap markers and inference lines while drawing; live dimension of the segment being drawn; ghost preview before commit; hover-highlight of the object that a click would select; status bar shows current tool, snap mode, units and the next expected input ("Specify next point or type length").

---

## 6. Accessibility (WCAG 2.2 AA as the floor)
- **Contrast:** text ≥ 4.5:1 (large text ≥ 3:1); icons, borders of inputs, focus rings, canvas strokes that carry meaning ≥ 3:1. Check every theme, including text on glass.
- **Target size:** ≥ 24×24 CSS px minimum (2.5.8), design default 32×32, touch 44×44; enough spacing between small targets.
- **Dragging alternatives (2.5.7):** every drag has a non-drag way — typed coordinates/lengths, arrow-key nudge (Shift = ×10), Move/Copy commands, "Move to…" menus for files, buttons for reordering.
- **Focus not obscured (2.4.11):** sticky toolbars, panels and toasts never cover the focused element; scroll it into view.
- **Keyboard:** everything operable; logical tab order; **roving tabindex** inside toolbars, trees, grids, menus, tabs (WAI-ARIA patterns); Esc cancels/closes (also the CAD convention); a "Skip to canvas" link; no keyboard traps; dialogs trap focus and restore it on close.
- **Screen readers:** semantic HTML first; labelled icon buttons; the canvas is complemented by an **Objects/Outline panel** (levels → rooms → walls/openings with names and sizes) that is fully navigable; a polite live region announces command results ("Wall created, 4.50 m"; "3 options generated").
- **Colour is never the only signal:** issues have icons + text; diff uses glyphs/patterns; presence colours come with names; program diagrams have labels or patterns.
- **Motion & transparency:** honour `prefers-reduced-motion` (no parallax, no animated glass) and `prefers-reduced-transparency` (solid fallbacks); no flashing.
- **Zoom & reflow:** usable at 200% browser zoom and at UI scale 150%; Windows `forced-colors: active` keeps borders and focus visible.
- **Consistent help (3.2.6):** Help lives in the same place on every screen.
- **Language:** plain, architect-friendly words ("carpet area", "setback", "plot"); avoid developer jargon in UI text.

---

## 7. Personas & walkthrough scripts

| Persona | Needs | Watch for |
|---|---|---|
| **Student (19–24)**, new to CAD | Discoverability, learning by doing, fast feedback, forgiving undo | Jargon, blank-canvas paralysis, hidden features |
| **Practising architect (28–45)** | Speed, precision, shortcuts, chat + manual together | Extra clicks, modal interruptions, slow feedback |
| **Senior draftsman (55–70)**, deep AutoCAD habits | AutoCAD conventions, typed input, large readable text, labels, stability | Small text/targets, icon-only controls, hover-only menus, drag-only actions, low contrast on dark UI, changed layouts |
| **Low-vision / colour-blind / keyboard-only user** | Contrast, zoom, non-colour cues, full keyboard | Any check in §6 |

**AutoCAD-familiar defaults** (setting "AutoCAD-style keys", on by default for new users who choose "I use AutoCAD"): command line with aliases (`L`, `PL`, `REC`, `M`, `CO`, `RO`, `MI`, `O`, `TR`, `EX`, `DIM`, `E`), **Enter/Space repeats last command**, **Esc cancels**, right-click = Enter/confirm option, F3 object snap, F7 grid, F8 ortho, wheel zoom centred on the cursor, **window selection left→right (inside) vs crossing right→left**, typed lengths while drawing.

**Settings that serve everyone:** UI scale (100–150%), density (comfortable/compact), theme (dark/light/high-contrast), "show labels under toolbar icons", units, AutoCAD-style keys, reduced motion.

**Task scripts — run each as every persona, record steps, time, errors, hidden affordances, unclear words:**
1. First launch → create a folder → import a DXF → open it.
2. Draw an outer wall rectangle 9.14 × 12.19 m using typed lengths; add a door and a window.
3. Ask the chat for "3BHK, 30×40, east facing, Vastu"; compare options; pick one; undo.
4. Find and fix one reference-check issue from the panel.
5. Create a branch, change the kitchen, compare with main, merge.
6. Export a PDF at 1:100 and a DXF.
Pass bar: the senior-draftsman walkthrough completes every task **without hover-only discoveries, without drag-only steps, and without reading text below 13 px**.

---

## 8. Heuristics, applied to a CAD product
1. **System status** — save state, AI working, generation progress, snap/ortho state, current tool and prompt always visible.
2. **Real-world match** — architect vocabulary; plan conventions (north arrow, scale bar, dimension style).
3. **Control & freedom** — Esc, undo/redo everywhere (including chat actions), non-destructive by default, Trash.
4. **Consistency** — same action, same place, same name, same shortcut in Vault, editor and boards.
5. **Error prevention** — validate typed values, confirm destructive bulk actions, disable impossible actions with a reason.
6. **Recognition over recall** — labels, recent commands, command palette with descriptions, tooltips with shortcuts.
7. **Flexibility** — mouse, keyboard, command line, chat: four routes to the same command.
8. **Minimalism** — one primary action per view; progressive disclosure for advanced options; no decorative glass on dense work surfaces.
9. **Recover from errors** — every error says what happened and how to fix it (PRD §4.5 pattern).
10. **Help** — contextual help links; first-run sample project; empty states that teach.

---

## 9. Quick-pass checklist (end of every UI prompt)
- [ ] No raw colours/sizes added — tokens only; TOKEN-INDEX updated if tokens changed (if raw values were unavoidable, list them for the next as-built run)
- [ ] Spacing on the 4 px grid; inside ≤ outside; no double padding; concentric radii
- [ ] All states present (§5) incl. focus-visible, disabled-with-reason, loading, empty, error
- [ ] Hover-revealed things also reachable by focus/selection/touch
- [ ] Targets ≥ 24 px (≥ 32 default); icon-only buttons labelled + tooltip with shortcut
- [ ] Contrast checked in dark and light (text 4.5:1, UI 3:1)
- [ ] Keyboard: tab order, Esc, arrow keys inside composite widgets, focus restored
- [ ] Drag has a non-drag alternative
- [ ] Works at 200% zoom and UI scale 150%; reduced motion/transparency respected
- [ ] Text: plain words, units on numbers, tabular numerals, truncation with full-name tooltip

## 10. Audit report format
Write `/design/audits/YYYY-MM-DD-<area>.md`:
```
# UX audit — <area> — <date>
## Summary for the founder (plain language, 5 lines max)
## Scores (1–5): Clarity · Consistency · Spacing · States · Accessibility · Expert speed · Beginner learnability
## Issues
| ID | Sev | Persona | Where (file / screen) | Problem | Fix | WCAG / heuristic | Status |
## Token changes (added / renamed / deprecated)
## Before / after screenshots
## 🛑 Decisions needed from the founder
```
Severity: **P0** blocks a task or fails WCAG AA · **P1** causes errors or confusion for a persona · **P2** inconsistency or polish that users notice · **P3** nice-to-have.

## 11. Verification tools (🛑 ask before adding each)
Automated accessibility checks (e.g. axe-core) run through browser tests (e.g. Playwright) on every screen and theme; screenshot comparisons for visual regressions; a scripted keyboard sweep; a contrast script over the token pairs; optional component workshop (e.g. Storybook) showing every component × state × theme × density.

## 12. Guardrails
- **Precedence when documents disagree:** this skill decides *how* UI is specified and polished (tokens, spacing, states, accessibility); `DESIGN.md` decides the *look* (founder-approved values); PRD + addenda decide *what* features exist. Newer addendum versions win over older ones (A2.2 over A2.1, A3.1 over A3.0).
- Polish within the approved direction (`DESIGN.md`, reference folders); 🛑 for new visual directions.
- Never trade accessibility for looks (glass, thin fonts, low-contrast greys on dark).
- Small commits; tests green; no behaviour changes hidden inside "polish".
- Record every decision in `DESIGN.md` or `tokens/CHANGELOG.md` so the next session follows it.

---
_Skill version 1.2 (6 Nov 2026): v1.1 added §3.6 as-built reverse-engineering index (colours, type scale, spacing and other scales) before token work, token index renumbered §3.7; v1.2 adds set-up timing at P2.1/PI.1–PI.2, icon token names aligned with A3.1, and document precedence._
