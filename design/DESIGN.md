# PlanCraft design system

**Status:** approved by the founder on 2026-11-06 (P2.1 🛑). It applies to all UI work from P2.2 on (PRD P2.1 rule): follow it, and add any new component here in the same style.

**Direction in one line:** a drafting table. Black, white and soft greys; one accent, blueprint blue. Dot grids, hairlines, `+` corner marks and numbered labels. Monospace for anything measured. Flat surfaces.

**Founder's answers (D-23):** light and dark themes, light first; accent = blueprint blue; no logo yet (placeholder wordmark); nothing to avoid in the references.

## Sources

The look comes from the founder's references in `design/reference/` (notes in its README). We take principles, never another product's screens, icons, wording or exact layout (CLAUDE.md rule 7).

| Reference | What we take |
|---|---|
| ref-01 dark dashboard | `+` corner marks on panels and buttons; grey cards with a ↗ "open" arrow; metric tiles (tiny uppercase label, big monospace number); `№` labels on canvas objects; dot-grid canvas |
| ref-02 blueprint landing | Blueprint-blue wash to show what is selected; hairline section rules; `( LABEL )` eyebrows; `01 / Name` numbering; solid ink primary button |
| ref-03 design-tool editor | The usual arrangement for design tools: library on the left, inspector with collapsible sections on the right, a floating grouped toolbar at the bottom, a scale bar at the bottom right. This is a competitor's product: layout convention only, nothing visual copied |
| ref-04 isometric boxes | Light-grey technical illustration: thin outlines, small round status dots, a round ink arrow button |
| ref-07 sign-in | Auth screens: centred form on white, split with a halftone image; ink pill buttons; rounded inputs |
| ref-09 technical palette | The accent family: `#8080DD`, `#E4E4F2`, `#EAEAFA`, `#F2F2F4` |
| ref-05, ref-06, ref-08 | White models, material axonometrics with callouts, a blue axonometric diagram. Mainly for the 3D render styles (addendum P12.1); here they confirm the grey + blueprint-blue mood and the callout style |

## Colour tokens

**Token system (approved 6 Nov 2026, DS-01).** Source of truth: the DTCG files in `design/tokens/` (base → semantic → component). `npm run tokens` generates `frontend/src/design/tokens.css` (CSS variables `--pc-…`) and `frontend/src/design/tokens.ts` (resolved values for canvas code), plus the sheet `design/tokens/tokens.html` and the index `design/tokens/TOKEN-INDEX.md`. Never edit `tokens.css` by hand. Components use **semantic and component tokens only**, never base steps or raw values. The old names below (`--bg`, `--text-muted`, …) still work as aliases for one release; new CSS uses the `--pc-` names.

Light is the default; dark is `data-theme="dark"` on `<html>`. Text pairs meet WCAG AA (4.5:1) on every surface, hover and selected row; control edges meet 3:1. Fills marked "decorative" are for graphics, not text.

| Token (`--pc-…`) | Old name | Light | Dark | Use |
|---|---|---|---|---|
| `color-bg-app` | `--bg` | `#F2F2F4` | `#0E0E11` | App background behind panels |
| `canvas-bg` | `--canvas` | `#FAFAFB` | `#121216` | Drawing area |
| `canvas-grid-minor` | `--canvas-dot` | `#C8C8D2` | `#33333F` | Dot grid (also the snap grid). Decorative |
| `color-bg-surface` | `--surface` | `#FFFFFF` | `#17171B` | Panels, toolbars, dialogs |
| `color-bg-inset` | `--surface-2` | `#F2F2F4` | `#1E1E23` | Cards inside panels, inputs |
| `color-state-hover-bg` | `--surface-3` | `#E8E8EE` | `#27272E` | Hover, pressed |
| `color-state-subtle-fill` | — | ink 7 % | white 10 % | Neutral icon fills |
| `color-border-subtle` | `--line` | `#E2E2E8` | `#2A2A31` | Hairlines, dividers. Decorative |
| `color-border-default` | `--line-strong` | `#C8C8D2` | `#3B3B45` | Corner marks, selected segment |
| `color-border-control` | — | `#84848E` | `#72727E` | Edges of inputs and the switch track (3:1) |
| `color-text-primary` | `--text` | `#111114` | `#F2F2F4` | Main text |
| `color-text-strong` | — | `#111114` | `#FFFFFF` | Active icon lines |
| `color-text-secondary` | `--text-muted` | `#656571` | `#A0A0AE` | Secondary text, placeholders (`color-text-placeholder`) |
| `color-text-disabled` | `--text-faint` | `#9A9AA6` | `#6E6E7A` | Disabled items only, never readable text |
| `color-bg-inverse` | `--ink` | `#111114` | `#F2F2F4` | Primary buttons, tooltips, walls on canvas |
| `color-text-inverse` | `--on-ink` | `#FFFFFF` | `#111114` | Text on ink |
| `color-accent-decorative` | `--accent` | `#8080DD` | `#8080DD` | Blueprint blue: selection wash, highlights. Decorative |
| `color-accent-default` | `--accent-strong` | `#5558CF` | `#A5A8F5` | Accent text, links, focus ring, active tool icon |
| `color-accent-subtle` | `--accent-soft` | `#EAEAFA` | `#23234A` | Selected rows, active tool background |
| `color-accent-tint` | `--accent-tint` | `#E4E4F2` | `#2E2E5C` | Room fill on canvas, tag backgrounds |
| `color-accent-fill` | — | accent 16 % | `#2E2E5C` | Fill inside active accent shapes (icons) |
| `color-status-success` | `--ok` | `#18753F` | `#3DD68C` | Passed checks, good status |
| `color-status-warning` | `--warn` | `#A34A07` | `#F5A524` | Warnings |
| `color-status-error` | `--error` | `#BB2B30` | `#FF6B6B` | Errors, failed checks |
| `color-bg-scrim` | `--backdrop` | ink 24 % | black 50 % | Behind dialogs |

Changed on 6 Nov 2026 (DS-01): light `--text-muted` `#6B6B78 → #656571`, `--ok` `#1B7F46 → #18753F`, `--warn` `#B45309 → #A34A07`, `--error` `#C93035 → #BB2B30` (all now ≥ 4.5:1 on hover and selected rows); light canvas dot `#CBCBD8 → #C8C8D2` (merged; this table had `#D6D6E0` / `#2B2B35`, the code won). New: the control border.

Reference checks use these three status colours, always with a word or icon too, never colour alone.

## Typography

- **Sans:** `Geist`, then `Inter`, `system-ui`, `-apple-system`, `Segoe UI`, `Roboto`, `sans-serif`. For headings, body text and buttons.
- **Mono:** `Geist Mono`, then `JetBrains Mono`, `ui-monospace`, `SFMono-Regular`, `Menlo`, `monospace`. For numbers, dimensions, areas, ids, tags and eyebrows. Always tabular figures.
- Geist and Geist Mono are free (SIL Open Font License), bundled with the app from `@fontsource-variable/geist` and `@fontsource-variable/geist-mono` (approved 2026-11-06), so they work offline.

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `--type-display` | 40 / 44 | 300, tracking −0.02em | Auth and empty-state headlines; two-tone (first words `--text-muted`) |
| `--type-title` | 24 / 30 | 400 | Panel and page titles |
| `--type-section` | 15 / 20 | 500 | Section headers, card titles |
| `--type-body` | 13 / 18 | 400 | Default UI text (dense, CAD-like) |
| `--type-small` | 12 / 16 | 400 | Help text, captions |
| `--type-micro` | 11 / 14 | 500 mono, uppercase, tracking +0.06em | Eyebrows, tag chips, metric labels |
| `--type-metric` | 22 / 24 | 400 mono | Big numbers in metric tiles |

Tokens: `--pc-type-display / title / section / body / body-strong / small / micro / label / metric` (CSS `font` shorthands; `-tracking` for letter-spacing) and `--pc-font-size-100…900` = 11, 12, 13, 15, 22, 24, 40. **11 px is the smallest text** (founder, DS-01): nothing smaller, except the 8 px `●` bullet before tile labels, which is a symbol.

## Space, shape, depth

- **Spacing** (4 px base): `2 4 6 8 12 16 20 24 32 40 48 64` as `--pc-space-50 … --pc-space-1600` (step = px × 25; old `--space-1 … --space-11`). Semantic: `--pc-space-inset-*`, `-stack-*`, `-inline-*`, `-gutter-page` (24), `-gutter-panel` (16). Panel padding 16, card padding 12, control gaps 8.
- **Control height:** 28 (compact, in panels), 32 (default), 40 (auth and primary page actions).
- **Radii:** 2 (cards, panels, tiles: near-square, drafting), 4 (buttons, inputs, menus), 8 (floating toolbars), 999 (status chips, the round arrow button).
- **Borders:** 1 px `--pc-color-border-subtle`; inputs and switch tracks `--pc-color-border-control` (3:1); focus = 2 px `--pc-color-accent-default` ring with 2 px offset.
- **Targets:** every control can be hit across at least 24 × 24 px (`--pc-size-target-min`, WCAG 2.5.8). Small-looking controls (text links, the switch) keep their look and get an invisible hit area; inputs and dropdowns fill their whole box.
- **Shadows:** docked surfaces have none. Floating layers (toolbar, menus, dialogs, tooltips) use one soft shadow, `--shadow-float`.
- **Corner marks:** `.marks` draws a small `+` at each corner (7 px arms, `--line-strong`). Use it on panel cards, metric cards, the drawing sheet frame and square icon buttons in the top bar. Not on everything.
- **Dot grid:** `.dots` puts 1 px dots every 16 px on the canvas (`--canvas-dot`). It follows zoom on the real canvas.

## Icons

Thin line icons, 1.5 px stroke on a 20 px grid, square ends, no fills, centred in 32 px buttons. Our own small set (`frontend/src/ui/icons.tsx`) until an icon library is approved. The active tool icon is `--accent-strong` on `--accent-soft`.

**Founder rule for the A3 duotone icons (6 Nov 2026, applies in PI.1–PI.3):** the icon tokens get their **own light-theme mapping**, not the dark values reused: icon line = the near-black text colour; neutral fill = a very light grey tint; active fill = a pale accent tint; accent details = a darker accent shade with **at least 3:1 contrast on the light background**. The icon sheet (`/design/icons.html`) shows **both themes** to the founder before PI.3 is finished. Tokens (approved, DS-01; `design/tokens/component/icon.json`):

| Token (`--pc-…`) | Light | Dark |
|---|---|---|
| `icon-line` | `#111114` (text primary, near-black) | `#F2F2F4` |
| `icon-line-strong` | `#111114` | `#FFFFFF` |
| `icon-fill-neutral` | ink 7 % (very light grey tint) | white 10 % |
| `icon-fill-active` | accent `#5558CF` at 16 % (pale accent tint) | `#2E2E5C` (deep accent) |
| `icon-accent` | `#5558CF` (5.7:1 on white, 4.8:1 on a selected row, 3.9:1 on its own active fill) | `#A5A8F5` |
| `icon-accent-muted` | `#656571` | `#A0A0AE` |
| `icon-stroke` | 1.5 | 1.5 |
| `size-icon-sm / md / lg / xl` | 16 / 20 / 24 / 32 | same |

## Layout of the editor (built in P2.2)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ ◧ ⌂ File name main ▾ ● Saved  (L0 · Ground ▾)( 9.00 m × 7.00 m ) chat bell ☾ A Export ◨│ top bar 48
├─────┬───────────────┬────────────────────────────────┬──────────┬──────────────────────┤
│Rooms│ Rooms / Layers│ canvas: dot grid, plot line,   │ Chat     │ Properties │ Issues  │
│Layrs│ / Library     │ plan, room labels,             │ column   │ │ Metrics            │
│Libry│ panel 280     │ selection wash + grips         │ 360      │ 300                  │
│     │ (toggle)      │                                │ (toggle) │ (toggle)             │
│     │               │  ┌ selection pill ┐  scale     │          │                      │
│ ?   │               │ └ floating toolbar ┘  bar      │          │                      │
├─────┴───────────────┴────────────────────────────────┴──────────┴──────────────────────┤
│ m | ft-in · Snap GRID END MID PERP · x 4.50 m · y 4.00 m End        − 83% +  engine 0.1│ status 28
└────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Top bar** (left to right): the left-panel toggle (P2.2a), Home (opens the Vault from P14.3), editable file name, branch chip (`main ▾`, disabled until Phase 15), save state (`Saved · Saving… · Offline`, live from P14.4) — the four slots of A2 P14.4; then the level and plot chips in the middle; then chat, issues bell with a count badge (red when any error, amber otherwise), theme toggle, avatar, **Export DXF** (primary), and the right-panel toggle. The bar never wraps: the file name shortens with an ellipsis first.
- **Save state (P14.4):** a status dot and word: `Saved` (`--ok`), `Saving…` (accent), `Offline` (`--warn`), `Changed elsewhere` (`--error`), or `Library plan` (accent) for a read-only library plan; its tooltip explains it. The file name renames the file (Enter saves, Esc cancels, leaving the field saves; the tooltip shows the full name); it is read-only for library plans. **Notices** (recovered work, offline, a conflict copy, a failed rename) appear in the floating pill above the toolbar with an **OK** button, so nothing important lives only in a hover tooltip.
- **Rail** (48 px) switches the left panel: Rooms, Layers, Library; Help at the bottom. Clicking the open panel's icon closes it. Drawing tools live in the floating toolbar, not the rail.
- **Right panel** has three tabs, Properties / Issues (count) / Metrics; selecting a room switches it to Properties.
- **Chat** opens as its own column (360 px) between the canvas and the right panel, from the top bar's chat button. Example requests are secondary buttons in sentence case.
- **Hiding panels (P2.2a, Figma-style):** the left panel, right panel and chat hide to give the canvas their width. Toggles at the two ends of the top bar (icon: a window with its side panel shown, with lines in the strip, or hidden, empty strip; mirrored for the right; temporary until the A3 icon registry), the chat button, **⌘\** / Ctrl+\ hides everything and brings the same set back (focus mode), **⌘⌥[** / **⌘⌥]** (Ctrl+Alt+[ / ]) toggle the left / right panel, and the editor's **⌘K** palette lists the same commands. Tooltips name the shortcut: "Hide left panel (⌘⌥[)". The rail stays. A hidden side panel leaves an **edge tab** on its side of the canvas: 24 × 48 px, `--surface` with a `--line-strong` hairline on three sides, a chevron pointing into the canvas, always visible. Panels slide in 200 ms (`--pc-motion-panel`; none with reduced motion) and **the drawing never moves**: the canvas grows or shrinks around it. Nothing opens a hidden panel by itself (a selection only switches an open right panel to Properties). If keyboard focus was inside a panel that hides, it moves to that panel's toggle. The layout is remembered per user (this browser until accounts).
- **Resizing (P2.2a):** a side panel's inner edge (8 px, `col-resize` cursor, a 2 px accent line on hover, focus and while dragging) drags between 240 and 480 px (`--pc-size-panel-min` / `-max`); double-click returns it to 280 / 300; with keyboard focus the arrows change it by 8 px (Shift 32), Home / End go to the limits. Widths are remembered with the layout.
- **Narrow screens (under 1100 px):** panels float over the canvas instead of squeezing it, one at a time, and start closed (they also close when the window narrows; the remembered wide layout returns when it widens). They fade and slide 16 px in from their side; **Esc** or a click outside closes them. Under 720 px the top-bar chips, branch, save state and the status bar's snap toggles are hidden; under 480 px the avatar and the two side-panel toggles too (the edge tabs open the panels). The floating toolbar's buttons may shrink a little, then it scrolls sideways.
- **Scale bar** measures the drawing on screen: the longest round length (10, 20, 50 cm, 1, 2, 5 m … or 1, 2, 5, 10 ft …) that fits in 120 px. When the canvas is under 640 px wide it sits above the toolbar instead of beside it.
- **Canvas navigation (P2.3):** the wheel or a pinch zooms about the cursor (AutoCAD habit); dragging pans (left drag on empty canvas with any tool, middle drag, or Space + drag); a click selects (Select tool) or places a point (other tools); **Alt-click** selects the next object under the cursor (a hatch under a room). Keys: `+` / `−` zoom, `0` fits, arrows pan, `Esc` clears the selection, tool letters as on the toolbar. Zoom is shown as a percentage where 100% = 1 px per cm (a 9 m plot is 900 px wide), from 2% to 2000%.
- **Editing (P2.4):** every change is an engine command with one undo step. **Drag the selected object** to move it (the cursor shows `move` over it): the distance snaps to the grid step when grid snap is on (else whole cm), **Shift** keeps it horizontal or vertical, **Esc** puts it back. While dragging, the plan, room areas and metrics follow the drag live; one MOVE is recorded when the drag ends. Walls joined to a moved wall stretch with it, doors and windows stay on their wall. **Delete** / Backspace deletes the selection (a wall takes its doors and windows). **⌘Z** undo, **⇧⌘Z** or Ctrl+Y redo (a text field keeps its own undo); the floating toolbar ends with Undo and Redo after a separator, disabled with a tooltip that says why. **⌘K** also works as a command line: a command word with its values (`MOVE V1 0,0 30,0`, `M`, `DELETE W3`, `ADD_WALL 0,450 1320,450`, `SET D1 width=100`) becomes one item that runs it or says what is missing. Library plans are read-only: editing shows a notice instead. What each change did is read out by screen readers (a polite live region).
- **Tools (P2.5):** the floating toolbar holds every tool in four groups separated by hairlines, then Undo / Redo: **Select** `V` · **build** Wall `W`, Room `R` (two corners: walls + room), Room label `A` (click inside walls), Door `D`, Window `N`, Stair `S`, Room separator `P` · **draw** Line / polyline `L`, Rectangle `B`, Dimension `⇧D`, Note `T`, Hatch `H` · **modify** Move `M`, Copy `C`, Rotate `Q`, Mirror `I`, Offset `O`, Trim `X`, Extend `⇧X`, Delete `E`. Tool icons are temporary line icons until the A3 registry. With a tool active, a **prompt line** sits above the toolbar (`--surface`, radius 8, `--shadow-float`): the tool's name, its option (wall type, room type, hatch pattern), what it wants next in `--text-muted` 12 px (a refusal replaces it in `--warn` until the next action), and a 28 px box for **typed values** (A2 M5): digits, `.`, `@` and `<` typed on the canvas go there (`450` = 450 cm along the cursor's direction, `4.5m`, `15'6"`, `450<90`, `@120,-30`, `300,450`; the note tool takes its text there); Enter uses it and hands the keys back. While a tool works: Shift keeps lines straight and angles in 15° steps; Enter finishes a polyline or a wall chain; Esc stops the operation, a second Esc returns to Select. Previews: drawing tools show a dashed `--accent-strong` outline (walls as a band at their thickness, `--accent` 25 %), with dots on placed points; modify tools, doors and dimensions show the real result live (the engine previews it). Tools that act on an object (door, window, move, copy, rotate, mirror, offset, trim, extend, delete) highlight what a click would pick. When the canvas is narrower than 68 rem the scale bar moves to the top right corner. **Help** (rail, `?`) lists every key, mouse action and typed form.
- **Annotations (P2.5):** drafting lines and rectangles as 1 px `--ink` hairlines; dimensions as 1 px `--ink` dimension and extension lines with 45° ticks and the length in mono at 20 cm text height, above the line and always readable; notes in sans at their own height (25 cm default); hatches under the walls in `--text-muted`: diagonal or cross lines every 20 cm, dots on a 20 cm grid, or a 25 % solid fill. Annotation text is sized in plan cm (true to print, CAD style), so it scales with the zoom; room labels keep their screen size. The Layers panel can hide each kind.
- **Properties editing (P2.5):** values can be typed over (Enter or leaving the field applies, Esc puts it back): a wall's length (its end moves; a wall meeting that end across it moves over), thickness and type; a room's name and type; an opening's width; a separator's or straight line's length; a dimension's value (the wall it measures changes); a note's text and height; a hatch's pattern. A bare number is in the units shown (`6.5` → 6.50 m); `650cm` or `21'4"` say their own.
- **Status bar (P2.3):** units, snap toggles, then the cursor position in the display units (`x 4.50 m · y 4.00 m`) followed by the snap it landed on in `--accent-strong` (`End`, `Mid`, `Perp`, `Grid`); while moving an object, `Move Δx 0.30 m · Δy 0.00 m` instead (P2.4); on the right the zoom group: − button, the percentage (click to fit), + button, all 24 px.
- **Dot grid** follows pan and zoom: one dot per round length (1, 2, 5, 10, 20, 50 cm … or 1″, 3″, 6″, 1′, 2′ …), the finest whose dots are at least 12 px apart. It is also the grid snap.
- **Canvas objects:** walls drawn as one joined `--ink` outline from the engine (`wallOutlinesCm`: no seams at corners or junctions), openings cut out and framed by a 1 px `--ink` hairline on `--canvas`. Rooms filled `--accent-tint` at low opacity, with a label: name (sans 13 / 500) over area (mono 12, e.g. `10.66 m²`). Columns: solid `--ink` with a 1 px `--canvas` outline and cross, so they read on a wall junction and on their own. Plot boundary: dashed 8/4 `--text-muted` hairline. Room separators: dashed 6/4 `--text-muted`. Stairs: 1 px `--text-muted` outline and treads, `UP`/`DN` in mono 11. Opening symbols are 1 px `--ink` hairlines, the same symbols as the DXF export: a door is its leaf open at 90° plus the quarter-circle swing, a window three lines, a ventilator two, a plain opening one. Selection: a room gets an `--accent` wash; any other object an `--accent` fill at 25%; both a 1.5 px `--accent-strong` outline and 6 px square grips on the corners. Hover (select tool): a 1.5 px `--accent` outline and a pointer cursor. Snap markers (drawing tools, crosshair cursor) are 10 px `--accent-strong` hairline glyphs: square = end, triangle = mid, ⊥ = perpendicular, + = grid. Labels and grips keep their screen size at any scale. Labels on markers use `№` numbering. Accent is never used for drawing content, only for selection.
- **Issue markers** on the canvas are round status dots (`--error`, `--warn`), like ref-04's indicator lights.

## Components

All in `frontend/src/ui/` (no outside UI library), shown on the style sheet page `/styleguide.html`.

| Component | Spec |
|---|---|
| **Button** | Primary: `--ink` fill, `--on-ink` text, radius 4. Secondary: `--surface` with a `--line-strong` border. Ghost: text only, `--surface-3` on hover. Danger: `--error` text and border. Sizes 28 / 32 / 40; label 13 / 500. Pill variant (radius 999) for auth screens. |
| **Icon button** | 32 × 32, ghost by default; active = `--accent-soft` background with an `--accent-strong` icon; `marks` variant for the top bar. |
| **Round arrow button** | 40 px circle, `--ink`, white arrow (ref-04): "next", "open", "go". |
| **Input** | 32 high, `--surface-2` fill, `--line-strong` border, radius 4. Numeric inputs right-aligned mono, with a unit suffix (`m`, `ft`, `m²`). Error state: `--error` border and help text below. |
| **Select, segmented control** | Select like an input with a chevron. Segmented control for exclusive options (e.g. `m · ft-in`): `--surface-2` track with the selected segment on `--surface` with a hairline border. |
| **Toggle and checkbox** | 16 px box or 28 × 16 switch; on = `--accent-strong`. |
| **Tabs** | Text tabs with a 2 px `--accent-strong` underline when active; counts in mono `(3)`. |
| **Panel section** | Header: title (15 / 500) + count `(1)` + chevron to collapse. Body padding 16; sections separated by hairlines. |
| **Card** | `--surface-2` fill, radius 2, corner marks; title at top left, ↗ at top right when it opens a detail. |
| **Metric tile** | `--surface` tile in a card: `● LABEL` micro on top, big mono value below, optional thin bar (emphasised = `--ink`, others `--line-strong`). |
| **Chip / tag** | Micro uppercase mono on `--surface-2` (or `--accent-tint` when it is the selection), radius 2; dropdown chips end with `▾`. Eyebrow: `( LABEL )`. |
| **Status dot and badge** | 8 px dot plus word: `● 3 errors`. |
| **Issue row** | Severity dot · message (13) · how to fix (12, muted) · object ids as mono chips · source on hover. Errors first. |
| **Chat** | User bubble: `--ink`, aligned right, radius 8 (4 at the tail corner). Assistant: `--surface-2`, aligned left. Tool-call card: hairline box, eyebrow `( PLAN_EXECUTE )` and the operation list in mono, with an **Undo** link. |
| **Tooltip** | `--ink` background, `--on-ink` text, 12 px, radius 4, shortcut in mono on the right. |
| **Dialog** | `--surface`, radius 4, `--shadow-float`, title 15 / 500, body 13, footer buttons on the right (primary last). Dimmed backdrop `rgba(17,17,20,0.24)`. |
| **Floating toolbar** | `--surface`, radius 8, `--shadow-float`; tool groups separated by vertical hairlines; small ▴ under a tool opens its variants. |
| **Scale bar** | Mono label over a 2-segment bar (ink and white). Its length is measured from the drawing on screen (`scaleBarLength`), never a fixed graphic. |
| **Selection pill** | Small floating capsule above the toolbar: `Selecting Wall W3` + `Edit` in accent. |
| **Menu** | For **+ New** and right-click (`frontend/src/ui/Menu.tsx`). `--surface`, hairline border, radius 4, `--shadow-float`, 200 px min; items 32 px: 20 px icon (`--text-muted`), label, shortcut in mono 11 at the right; hover/focus `--accent-soft`; disabled `--text-faint`; danger items `--error`; micro-uppercase headings and hairline separators group items; a ✓ replaces the icon of the chosen option. Opens at the pointer, stays inside the window; arrows move, Enter chooses, Esc or a click outside closes. |
| **Empty state** | Centred, 480 px max: `( TITLE )` eyebrow, one helpful sentence (12, muted), then the next actions as buttons (primary first). |

## Motion

150 ms ease-out for hovers (`--pc-motion-hover`); 200 ms ease-out for side panels (`--pc-motion-panel`, P2.2a); 220 ms ease-out for the Vault folder art (`--pc-folder-card-motion`, kept as built: the code won, DS-01). No movement on canvas content except on user input. Respect `prefers-reduced-motion`.

## Accessibility

Text contrast AA in both themes. Every icon button has a label and tooltip. Keyboard focus is always visible. Status never relies on colour alone.

Interaction rules from the full audit (2026-11-06, `design/audits/2026-11-06-full-ui.md`):
- **Keyboard patterns:** option switches (`Segmented`), tab strips (`Tabs`) and toolbars (`Toolbar`) are **one Tab stop**; arrow keys, Home and End move inside (options and tabs also choose). The stop is the chosen option, tab or tool. Menus close on Esc, Tab, a click outside or a choice, and **focus returns to the button that opened them** (also through a dialog the choice opens). Dialogs are `aria-modal`, keep focus inside and return it on close.
- **Every control has a name:** a visible label or `aria-label` (`Select` takes `label` when no `<label>` points at it). Placeholders are never the only name.
- **States:** hover, focus ring (global), **pressed** (a 10 % layer of the content colour, `--pc-opacity-state-pressed`), selected, disabled. **Selected rows show a 3 px accent bar** as well as the tint (never colour alone).
- **Targets:** at least 24 × 24 px (`--pc-size-target-min`); fields fill their drawn box.
- **Windows high contrast (forced colours):** the plan canvas keeps its own colours (`forced-color-adjust: none` on the drawing and its paper); everything else follows the system colours.
- **Token lint:** `npm test` fails on raw colours, spacing off the space scale and text sizes off the type scale in `frontend/src` (DS-02). Exceptions need a reason in `design/tokens/lint-allow.json`.

**Text size (UI scale), DS-03.** **Settings → Text size** (Vault sidebar, ⌘K "Settings: text size", editor rail) offers 100 / 112.5 / 125 / 150 %. It applies at once in every open tab and is remembered on this computer (`frontend/src/design/ui-scale.ts`).
- **How it works:** the root font size is the browser's default size × the scale (`html { font-size: calc(100% * var(--pc-ui-scale, 1)) }`). Text, spacing, control, icon and panel tokens are in rem, so the whole interface grows together and also follows a larger default size set in the browser. Body text stays 13 px at 100 %.
- **What stays exact:** borders, hairlines, radii, shadows and the drawing's line weights. Room names and areas on the drawing grow with the setting. A label that doesn't fit its room at the current zoom is left out (the area alone first); the Rooms list always has every name. Kept by the founder (DS-04); the rule is `fitRoomLabel` in `frontend/src/ui/labels.ts`.
- **Rules for new code:** sizes for text, spacing, widths/heights and positions use tokens or rem, never px (the lint enforces it; 0 and 1 px hairlines are fine). Code that needs a token in px uses `cssPx('--pc-…')`. `node tools/tokens/rem-codemod.ts <file.css>` converts a stylesheet.

## Vault (home dashboard) — A2 §4, P14.1

**Status:** approved by the founder on 2026-11-06 (P14.1 🛑). Component page: `/vault.html`. References: `design/reference-vault/` (style only; no names, icons or content reused).

**Founder's choices (D-28):** opens **dark** by default (light available; the editor stays light-first); **six folder colours**; navigation at launch: **Home, Ask AI, Plan Library, Templates** (Insights and Integrations hidden until built; Shared with me hidden until accounts exist, P10.1).

### Layout
- **Sidebar, 260 px:** workspace switcher (8 px-radius initials square, name, member count, chevron); search field with a `⌘K` key hint; navigation rows (32 px, icon + label); `PROJECTS` eyebrow with a `+` for a new folder; folder tree (16 px indent per level, chevron, coloured folder icon, name, mono count); footer: Starred, Shared with me, Trash, Settings, Help, account. Selected row and current page: a filled pill (`--surface` + hairline + soft shadow in light, `--surface-3` in dark).
- **Main:** a 56 px header with breadcrumb (`Projects › Residential › 30×40 plots`, last part `--text`), search, **+ New** (primary, small); **Folders** title with a grid/list segmented control; folder tiles; **Files** table.
- Below 760 px the sidebar stacks above the main area.

### Folder colours
Gradient pairs (light → deep), as tokens `--folder-<colour>-from` / `-to`:

| Colour | From | To |
|---|---|---|
| Graphite (default) | `#4A4A4E` | `#1C1C1E` |
| Blueprint blue | `#9A9DF5` | `#5558CF` |
| Orange | `#FF9F5A` | `#E8590C` |
| Green | `#63D496` | `#1B8F52` |
| Purple | `#B892FF` | `#7A4FE0` |
| Red | `#FF8A80` | `#D33A40` |

### Folder tile (168 × 128 art, tile radius 16)
| Variant | Use | Build |
|---|---|---|
| **Glass** (default) | Project folders | Back panel (radius 18, colour gradient); up to 3 white papers (radius 8, rotated −6° / 0° / +5°) showing **real plan thumbnails** (engine-drawn); frosted front with a tab on its top edge: white 34% → 12% over 30% of the colour, `backdrop-filter: blur(16px) saturate(140%)`, 1 px inner highlight; avatars + "Updated 2h" pill on the glass; soft glow of the colour beneath (blur 22 px, 35%) |
| **Colour** | Templates, rule packs, library collections | Solid colour front; content tiles peeking out ("Aa", "§"); version badge ("v2.1") |
| **Archive** | Archived projects, exported packages | Dark matte folder; zip pull on the front; size badge ("ZIP · 1.2 GB") |

**Readable text on the art (D1, DS-03):** pills on the glass ("Updated 2h", badges) are white 11 px mono on **ink at 60 %** (`--pc-folder-card-pill-bg`), so they stay ≥ 4.9:1 over any folder colour or paper behind the glass. Letters on the white content chips use each colour's **ink** (`--pc-folder-card-<colour>-ink`): the folder's dark tone, except orange `#C2410C` and green `#19864D`, darkened to pass 4.5:1.

**States:** hover (papers lift 4–6 px, glow to 45%, 220 ms); selected (2 px `--accent-strong` focus ring + `--surface-2` tile); drag-over (front tilts 8° toward the viewer, "opening"); empty (no papers). **Fallback:** no `backdrop-filter`, reduced transparency or reduced motion → a solid tinted front and no movement. Title 13 / 500 under the art; meta line 12 muted ("3 files · 2 branches").

### Files table
Columns: Name (file or sheet icon), Owner (avatar + name), Edited (time + avatar of the last editor), Branches (mono count), Status (pill: Draft neutral, In review `--warn` tint, Approved `--ok` tint), Size (mono, muted). Header row on `--surface-2`; rows 48 px with a hover tint; selected row `--accent-soft` with a 3 px accent bar. When a folder has subfolders but no plans, the Files section says **"No plans here yet."** with **New plan** and **Import DXF…** (D3). Avatars are 24 px circles with initials on a soft colour.

### Dashboard behaviour (P14.3)
- **The Vault is the first page** (`/`); the editor opens a file at `#/file/<id>` and a library plan at `#/library/<id>`; Home in the editor returns to the file's folder. The Vault keeps its own theme (dark by default); the editor opens light.
- **Grid / list** (remembered per browser): grid = folder tiles, then **file cards**; list = one sortable table, folders first. Sort: a select in grid view, the column headers in list view; default "Edited (newest)".
- **File card:** 4:3 white paper (radius 8, hairline, soft shadow) with the plan thumbnail at 86%; name 13 / 500 (★ in `--warn` when starred); meta 12 muted: edited time · status pill. Hover `--surface-2`; selected like a folder tile (2 px `--accent-strong` ring).
- **Folder tiles in use:** glass for project folders (papers = the three most recently edited plans inside, "Updated …" pill, owner avatar); colour style shows the file count as its badge; archived folders use the archive art with the total size as "ZIP · 12 KB".
- **Selecting:** click, ⌘/Ctrl-click to add, Shift-click for a range; a click on empty space clears. Right-click opens the item's menu (or the New menu on empty space).
- **Moving:** drag files and folders onto a folder tile, a list row, a tree row or a breadcrumb step; the target shows an `--accent-soft` fill with a 1 px `--accent-strong` edge (tiles tilt open). **Importing:** drop `.dxf` / `.plancraft` files anywhere in a folder (dashed `--accent-strong` outline) or onto a folder.
- **Import result:** a dialog per import listing each file with its status (Converted / Converted with problems / error), counts of walls, rooms and openings, and how many guesses to check, with **Open in editor**.
- **Keys:** ⌘K palette, N new plan, ⇧N new folder, ↵ open, F2 rename, Del → Trash, ⌘A select all, Esc clear; listed under Help.
- Starred and Trash are lists (Trash rows have Restore and Delete for ever, with a confirmation); Settings, Shared with me, Insights and Integrations stay hidden until built. Ask AI and Templates show empty states that say when they arrive.
- **P14.5:** every view (folders, Search, Starred, Trash, Plan Library) has the same grid / list switch and sort. **Search** is a page: a filter bar (Name contains · Kind · BHK · Facing · Status · Owner, then Clear) above the results; the words and filters live in the address. **Trash** explains itself in a muted line under its title ("deleted for ever 30 days after…"), shows "N days left" per row, and puts Restore / Delete for ever / Empty Trash at the right of the title for the selection, so nothing depends on right-click or hover.
- **Keyboard (P14 audit):** Tab reaches every tile, card and list row (2 px `--accent-strong` focus ring); Enter opens the focused item, Space selects it; dialogs and ⌘K keep focus inside and give it back when they close; sort headers are at least 24 px tall; truncated names show the full name as a tooltip. Audit: `design/audits/2026-11-06-vault-phase14.md`.

### ⌘K command palette
560 px panel, radius 12, `--shadow-float`, 12% from the top of the window: a 52 px search row (icon, input 15 px, `esc` hint), then groups **Recent** (empty query) or **Files · Folders** (matches, with their folder path at the right), **Commands**, **Ask AI** with micro eyebrows; 36 px items with icon, label and shortcut (`N`, `⇧N`, `↵`); the active item on `--accent-soft`.

## Change log

- 2026-11-06 (Build session, P2.5, D-44): the full toolset (21 tools, keys above), the prompt line with typed values, tool previews, annotations (lines, dimensions, notes, hatches), Properties editing, Help with every key, Alt-click cycling; the scale bar never takes clicks and moves to the top right on narrower canvases.
- 2026-11-06 (Build session, P2.4, D-43): editing through commands — drag the selected object to move it (grid steps, Shift, Esc), Delete, undo / redo (keys, toolbar, ⌘K), ⌘K typed commands, live region; panel close buttons named after their panel ("Close Rooms panel", audit B4).
- 2026-11-06 (Build session, P2.2a, D-41): editor panels hide and show (top-bar toggles, edge tabs, ⌘\, ⌘⌥[ / ⌘⌥], ⌘K), the drawing stays still, panels resize from their inner edge; narrow overlays close with Esc or a click outside; `.ed-badge` 11 px and 24 px status-bar targets (handed over from DS-01).
- 2026-11-06 (docs & UX session, DS-01): token system adopted (`design/tokens/`, `npm run tokens`); colour table rewritten with `--pc-` names, old names kept as aliases; 4 light-theme contrast fixes; control border; placeholders use secondary text; 11 px text floor; 24 px hit areas; canvas-dot values corrected to the code; A3 icon tokens with the founder's light-mode mapping.
- 2026-11-06 (docs & UX session, DS-02): token lint in `npm test`; full UX audit fixes (menu focus return and Tab, modal dialogs, named selects, arrow keys in options/tabs/toolbar, pressed state, selection bar, canvas in forced colours, full-height ⌘K field); `paper.*` tokens.
- 2026-11-06 (docs & UX session, DS-03): Settings → Text size (UI scale 100–150 %), sizes moved to rem tokens across all stylesheets (pixel-identical at 100 %, measured); room labels that don't fit are left out; folder-art pills on ink 60 % (white text ≥ 4.9:1) and darker letters on orange (`#C2410C`) and green (`#19864D`) chips; "No plans here yet" with New plan and Import DXF.
