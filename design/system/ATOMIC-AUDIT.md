# Atomic design system audit — 7 Nov 2026

> PA.1 of `PRD-ADDENDUM-A5-ATOMIC-DESIGN-SYSTEM.md` (A5.0). **Read-only check: no code, styles or tokens were changed.** Snapshot taken while the Build session was finishing P3.2 (done during this audit, D-49) in `ui/components.tsx`, `design/ui.css`, `editor/editor.css` and the editor files, so counts in those files may differ by a few.
>
> How it was checked: the import graph of every file in `frontend/src`; a scan of every CSS declaration and inline `style` (the same parser as the token lint, `tools/as-built/static.ts`); every token alias resolved with the token build (`tools/tokens/build.ts`); and a live test in the browser that switched theme and text size on three screens (style sheet, Vault, editor) and measured every element.

## Verdict (plain language): PARTLY COMPLIANT

**The foundation is solid, but the building blocks are not yet sorted into levels.**

- **What already works:** one shared set of design decisions (tokens) drives the whole interface. Switching between light and dark, or changing the text size, updates every screen with no component code changes. I measured 495 elements on three screens and every one followed. Almost no raw colours are left.
- **What is missing:** nothing says which pieces are atoms, molecules or organisms. Most of the shared pieces sit in one file (`ui/components.tsx`, 25 of them). Several common pieces exist only as styles inside the Vault or editor stylesheets, not as reusable components: the nav item, the tree row, the search field and the shortcut key. A few are built two or three times: the ⌘K palette, the Help dialog, the avatar and the plan thumbnail.
- **The token links skip a step:** components mostly point straight at raw scale steps ("space step 4") instead of named meanings ("inset, small"). The named spacing and text-style tokens exist, but nothing uses them yet.

Nothing here is broken for users. The work is about making later changes safe and quick: change one atom, and everything built from it follows.

## Scorecard C1–C12

| # | Rule | Result | Evidence |
|---|---|---|---|
| C1 | Every component classified | ❌ | No folders, registry or metadata assign a level. Classifying the inventory below gives about 80 components: 0 classified today. *(Step 1, 7 Nov: all 95 now classified in `registry.json`.)* |
| C2 | Folders reflect the levels | ❌ | `frontend/src/ui/` is flat: `components.tsx` holds 25 components, plus `icons.tsx`, `Menu.tsx`, `SettingsDialog.tsx`, `PlanThumbnail.tsx` and `PlanView.tsx`. Feature folders `vault/` and `editor/` mix pages, layouts, organisms and molecules: `vault/Dashboard.tsx` has 1,883 lines and 17 components; `editor/Editor.tsx` has 1,595 lines and 6. No `atoms/`, `molecules/`, `organisms/`, `templates/` or `pages/` folders. |
| C3 | Imports only go downward | ⚠️ | Mostly downward (features → `ui/`), with **5 sideways links** between features (see Violations). No upward import from `ui/` into a feature. |
| C4 | Molecules built from atoms | ⚠️ | Of the 26 molecule-level parts, 7 are built from atoms (`SelectionPill` → Button, `IssueRow` → Chip, `PanelToggle` and the tool buttons → IconButton + Icon, `PanelSection`, `Card` and `Crumb` → Icon). The other 19 style raw `<button>`, `<input>`, `<kbd>` or `<span>` directly, e.g. `Tabs`, `Segmented`, `Tooltip`, `Field`, and the nav item, tree row, search field and menu item, which exist only as CSS classes. |
| C5 | Organisms built from molecules | ⚠️ | Organisms use the shared kit a lot (35 uses in `Editor.tsx`, 29 in `Dashboard.tsx`, 22 in `dialogs.tsx`), but they use atoms directly (Button, IconButton, Chip, Icon) with no `EXCEPTIONS.md`, and raw form elements: Editor 5 buttons + 3 inputs, Dashboard 4 buttons + 2 inputs, Properties 1 input + 1 select, ToolPrompt 3 selects + 1 input, Palette 1 input. |
| C6 | Token chain per level | ❌ | No token has a level (`$extensions.pc.level`: 0 of 44 component tokens). Component tokens: **30 of 39 aliases point at base** (avatar, folder-card, paper), 9 at semantic (icon, marks); 6 hold raw values (`size.panel.*` in px, `icon.stroke`). In the stylesheets, **286 references go straight to base steps** (ui.css 105, editor.css 71, vault.css 61, dashboard.css 49), mostly via the old `--space-N` names. The semantic `space.inset/stack/inline/gutter` and `type.*` tokens have **0 uses**. `TOKEN-INDEX.md` says "Components use semantic and component tokens only"; that is not true yet. |
| C7 | No raw values in components | ⚠️ | Colours: ✅ (only folder art, already allowed). The token lint covers colour, spacing scale and font sizes only. A5 also counts radii, shadows, durations, weights, z-index and opacity: **about 115 raw declarations** remain outside sizes (table below). Semantic tokens exist for several but aren't used (`opacity.disabled`, `z.overlay`, `z.dropdown`, `font.weight.*`, `radius.pill`). |
| C8 | States live on the lowest owner | ⚠️ | Good: one global `:focus-visible` ring and one shared "pressed" layer in `ui.css`. But **39 state selectors live in feature stylesheets** (editor.css 15, vault.css 15, dashboard.css 9). `vault.css` repeats the pressed rule word for word for `.vlt-nav`/`.vlt-tree-row`. **13 feature selectors restyle shared atoms** (e.g. `.ed-zoom .pc-icon-btn`, `.ed-status .pc-segmented button`, `.vlt-sort .pc-input-wrap`). Two inline overrides: `SelectionPill` recolours its Button with `style`, and `IssueRow` sets its dot colour inline. |
| C9 | Organisms define only composition tokens | ✅ | No organism token repeats a lower-level decision; only `size.panel.*` (panel widths) is organism-like, and that is composition. Caveat: this passes because organisms have no tokens. Their stylesheets still make molecule-level decisions (C4, C8). |
| C10 | Theme / density / UI-scale need no code changes | ⚠️ | **Theme ✅, UI scale ✅:** measured live on 495 elements (style sheet 221, Vault 102, editor 172): every element changed colour with the theme (except avatars, which are the same in both themes on purpose), and every text size and control height grew by exactly 125% at 1.25×. **Density ❌:** no density setting or tokens exist anywhere. One component carries theme code: `vault.css:130` has a `:root[data-theme='dark']` override for the selected nav and tree row. |
| C11 | Each component documents its anatomy | ⚠️ | `design/DESIGN.md` → Components has a 20-row table (look, sizes, some states). No per-component anatomy (children, tokens used, variants, states, keyboard and screen reader) and no component tests (`ui/*.test.tsx`: 0). Keyboard behaviour is described only in code comments. |
| C12 | A sheet shows hierarchy and token links | ⚠️ | Sheets exist: `/styleguide.html` (9 sections by kind), `/vault.html` (Vault component page), `design/tokens/tokens.html` and `TOKEN-INDEX.md` (alias chain per token), `as-built-sheet.html`. None shows levels or a component → token → base trace. |

**Totals:** ✅ 1 · ⚠️ 8 · ❌ 3.

## Inventory by level

Proposed levels follow A5 §1 and §4. "Class only" = exists as CSS, not as a component. Paths are proposals for PA.2; nothing has moved.

### Atoms

| Component | Current level | Proposed level | Path now → proposed |
|---|---|---|---|
| Icon (+ FolderIcon) | none | atom | `ui/icons.tsx` → `ui/atoms/Icon/`. The icon session (A3.1 PI.1–PI.3, `docs/design/PI-icons-handoff.md`) plans to build the new `Icon` atom there; it's a new component, so nothing existing moves. The temporary icons are swapped for it in PI.3 |
| ToolIcon (21 tool glyphs) | none | atom (Icon set) | `editor/tool-icons.tsx` → `ui/atoms/Icon/tools.tsx` |
| Button (4 variants, 3 sizes, pill) | none | atom | `ui/components.tsx` → `ui/atoms/Button/` |
| IconButton | none | atom | `ui/components.tsx` → `ui/atoms/IconButton/` |
| RoundButton | none | atom (Button variant `round`) | `ui/components.tsx` → `ui/atoms/Button/` |
| TextInput | none | atom (Input) | `ui/components.tsx` → `ui/atoms/Input/` |
| Inline edit input (`.ed-edit`, `.ed-filename`, `.ed-prompt-input`) | class only | atom (Input variant `inline`) | `editor/Properties.tsx`, `Editor.tsx`, `ToolPrompt.tsx` → `ui/atoms/Input/` |
| Select (+ `.ed-prompt-option`) | none / class only | atom | `ui/components.tsx`, `editor/ToolPrompt.tsx` → `ui/atoms/Select/` |
| Switch | none | atom | `ui/components.tsx` → `ui/atoms/Switch/` |
| Checkbox | none | atom | `ui/components.tsx` → `ui/atoms/Checkbox/` |
| Chip | none | atom (Badge) | `ui/components.tsx` → `ui/atoms/Badge/` |
| Status (dot + word) | none | atom (StatusDot) | `ui/components.tsx` → `ui/atoms/StatusDot/` |
| Kbd | class only, **3 styles** (`.vlt-kbd` ×9 uses, `<kbd>` in Tooltip, `<kbd class="pc-mono">` in editor Help) | atom | → `ui/atoms/Kbd/` |
| Avatar | **3 copies**: `vault/items.tsx`, `vault/VaultPage.tsx`, `.ed-avatar` in `Editor.tsx` | atom | → `ui/atoms/Avatar/` |
| Thumbnail | **3 copies**: `ui/PlanThumbnail.tsx`, `Thumb` in `vault/items.tsx` (fetches from the Vault itself), `LibraryThumb` in `Dashboard.tsx` | atom (pure; data passed in) | → `ui/atoms/Thumbnail/` |
| Divider | `ToolbarSep` | atom | `ui/components.tsx` → `ui/atoms/Divider/` |
| Text styles | class only (`.pc-display/title/section/body/small/micro/mono/eyebrow`) | atom (Text) | `design/ui.css` → `ui/atoms/Text/` |
| ResizeHandle | none | atom (separator) | `editor/ResizeHandle.tsx` → `ui/atoms/ResizeHandle/` |
| Spinner, Skeleton | missing | atom, only when needed (Vault audit V14, with the server) | — |

### Molecules

| Component | Current level | Proposed level | Path now → proposed |
|---|---|---|---|
| Field (label + help/error) | none | molecule (FormField) | `ui/components.tsx` → `ui/molecules/FormField/` |
| NumberInput (input + unit) | none | molecule (DimensionInput) | `ui/components.tsx` → `ui/molecules/DimensionInput/` |
| Segmented | none | molecule | `ui/components.tsx` → `ui/molecules/Segmented/` |
| Tabs | none | molecule | `ui/components.tsx` → `ui/molecules/Tabs/` |
| Tooltip | none | molecule (Text + Kbd) | `ui/components.tsx` → `ui/molecules/Tooltip/` |
| MetricTile | none | molecule (MetricStat) | `ui/components.tsx` → `ui/molecules/MetricStat/` |
| IssueRow | none | molecule | `ui/components.tsx` → `ui/molecules/IssueRow/` |
| ChatBubble, ToolCall | none | molecule | `ui/components.tsx` → `ui/molecules/ChatBubble/`, `ToolCallCard/` |
| SelectionPill | none | molecule | `ui/components.tsx` → `ui/molecules/SelectionPill/` |
| ScaleBar | none | molecule | `ui/components.tsx` → `ui/molecules/ScaleBar/` |
| PanelSection | none | molecule (collapsible section) | `ui/components.tsx` → `ui/molecules/PanelSection/` |
| Card | none | molecule | `ui/components.tsx` → `ui/molecules/Card/` |
| MenuItem | inside `ui/Menu.tsx` | molecule | → `ui/molecules/MenuItem/` |
| NavItem | class only (`.vlt-nav`, Dashboard + VaultPage) | molecule | → `ui/molecules/NavItem/` |
| TreeItem | class only (`.vlt-tree-row` in Dashboard, `.ed-row` in editor RoomList) | molecule | → `ui/molecules/TreeItem/` |
| SearchField | class only (`.vlt-search` + `.vlt-kbd`) | molecule | → `ui/molecules/SearchField/` |
| ToolButton | inline in `Editor.tsx` (IconButton + ToolIcon + key in title) | molecule | → `ui/molecules/ToolButton/` |
| Crumb | inside `Dashboard.tsx` | molecule (Breadcrumb) | → `ui/molecules/Breadcrumb/` |
| PanelToggle | inside `Editor.tsx` | molecule | → `ui/molecules/PanelToggle/` |
| Empty | inside `Dashboard.tsx` | molecule (EmptyState) | → `ui/molecules/EmptyState/` |
| Properties Row / Edit / Choose / Source | inside `editor/Properties.tsx` | molecule (PropertyRow) | → `ui/molecules/PropertyRow/` |
| GlassFolder, ColourFolder, ArchiveFolder, Tile | `vault/folder-art.tsx` | molecule (FolderArt, FolderTile) | → `ui/molecules/FolderArt/` |
| AvatarGroup | class only (`.fart-avatars`) | molecule | → `ui/molecules/AvatarGroup/` |
| VersionChip | class only (`.ed-branch`) | molecule | → `ui/molecules/VersionChip/` |

### Organisms

| Component | Current level | Proposed level | Path now → proposed |
|---|---|---|---|
| Dialog (frame), Toolbar (roving keys) | none | organism frames | `ui/components.tsx` → `ui/organisms/Dialog/`, `Toolbar/` |
| Menu | `ui/Menu.tsx` | organism | → `ui/organisms/Menu/` |
| SettingsDialog | `ui/SettingsDialog.tsx` | organism | → `ui/organisms/SettingsDialog/` |
| CommandPalette | **3 copies**: `Palette` in `Dashboard.tsx`, `VaultPage.tsx` (demo), `editor/Palette.tsx` (styled by `vault.css`) | organism (one shared) | → `ui/organisms/CommandPalette/` (TASKS.md already lists this follow-up) |
| HelpDialog | **2 copies**: `Dashboard.tsx`, `editor/HelpDialog.tsx` | organism (one frame, content per page) | → `ui/organisms/HelpDialog/` |
| VaultSidebar | `Sidebar` in `Dashboard.tsx` (+ demo copy in `VaultPage.tsx`) | organism | → `ui/organisms/VaultSidebar/` |
| ProjectsTree | `TreeRows` in `Dashboard.tsx` | organism | → `ui/organisms/ProjectsTree/` |
| FolderGrid, FileCards, FilesTable | `vault/items.tsx` (+ demo `FilesTable` in `VaultPage.tsx`) | organism | → `ui/organisms/FolderGrid/`, `FileCards/`, `FilesTable/` |
| Vault dialogs (Name, NewPlan, FolderPicker, Confirm, ImportResult) | `vault/dialogs.tsx` | organism | → `ui/organisms/*Dialog/` |
| EditorTopBar | inside `Shell` in `Editor.tsx` | organism | → `ui/organisms/EditorTopBar/` |
| ToolRail (floating toolbar) | inside `Editor.tsx` | organism | → `ui/organisms/ToolRail/` |
| Panel, RoomList | inside `Editor.tsx` | organism | → `ui/organisms/SidePanel/`, `RoomList/` |
| PropertiesPanel | `editor/Properties.tsx` | organism | → `ui/organisms/PropertiesPanel/` |
| IssuesPanel | `editor/IssuesPanel.tsx` (P3.2, Build) | organism | → `ui/organisms/IssuesPanel/` |
| ToolPrompt | `editor/ToolPrompt.tsx` | organism | → `ui/organisms/ToolPrompt/` |
| Canvas, PlanView | `editor/Canvas.tsx`, `ui/PlanView.tsx` | **renderer, outside the levels** (A5 §3: canvas tokens stay semantic) | stay where they are |

### Templates and pages

| Component | Current level | Proposed level | Path now → proposed |
|---|---|---|---|
| Editor layout | `Shell` in `Editor.tsx` | template (EditorShell) | → `ui/templates/EditorShell/` |
| Vault layout | inside `Dashboard` | template (VaultLayout) | → `ui/templates/VaultLayout/` |
| Editor (loads file, autosave, checks) | `Editor` in `Editor.tsx` | page | → `pages/Editor/` |
| Vault views: Folder, Starred, Trash, Search, Library | inside `Dashboard.tsx` | pages | → `pages/{Folder,Starred,Trash,Search,Library}/` |
| App router | `App.tsx` | app shell (stays) | — |
| StyleGuide, VaultPage | `styleguide/`, `vault/VaultPage.tsx` | reference pages, outside the levels | stay; later fed by PA.5 |

## Violations

### Imports (C3)
1. `editor/Palette.tsx:3` imports `useModalFocus` from `vault/dialogs.tsx`, which only re-exports `ui/modal.ts`: editor → vault, sideways.
2. The editor's ⌘K palette is styled by Vault classes (`vlt-palette*`, `vlt-kbd`, 8 classes) from `vault/vault.css`: a sideways style dependency.
3. `vault/Dashboard.tsx:36` imports `LAST_FILE_KEY` from `editor/useFileSave.ts`: vault → editor, sideways.
4. `vault/items.tsx:11, 53`: the presentational `Thumb` calls `useVault()` to load its own drawing. A5 §5.5 says data loading belongs to pages.
5. `vault/main.tsx:6` (the `/vault.html` component page) imports `styleguide/styleguide.css`.

Low: `editor/state.ts:3` imports a type from `ui/PlanView.tsx` (types only; harmless, but logic should not depend on a component file).

### Raw values (C7), outside sizes

| File | radius | type (weights, line-heights) | shadow | motion | z-index | opacity | spacing off-token | border/outline | colour |
|---|---|---|---|---|---|---|---|---|---|
| `design/ui.css` | 4 | 10 | 1 | 0 | 2 | 2 | 6 | 5 | 0 |
| `editor/editor.css` | 1 | 4 | 1 | 4 | 0 | 0 | 3 | 0 | 0 |
| `vault/dashboard.css` | 1 | 2 | 3 | 0 | 1 | 1 | 2 | 7 | 0 |
| `vault/vault.css` (folder art mostly, allowed) | 10 | 7 | 6 | 3 | 2 | 2 | 16 | 3 | 7 |
| inline `style` (Dashboard, VaultPage) | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Examples: `.pc-btn:disabled { opacity: 0.45 }` (token `opacity.disabled` exists); `.pc-backdrop { z-index: 10 }` and `.pc-menu { z-index: 50 }` (tokens `z.overlay`, `z.dropdown` exist); `font-weight: 500` in 9 places (token `font.weight.500` exists); `.vlt-card-paper { border-radius: 8px }`; `.fart-paper { transition: transform 220ms ease-out }` (token `folder-card.motion` exists). Also about 80 raw widths and heights in rem (layout sizes; A5 does not list sizes, so I've reported them without counting them as failures). `editor.css` "motion" lines are `visibility 0s` steps, not real durations.

### Broken token chains (C6)
- Component → base: `avatar.*` (2), `paper.*` (3), `folder-card.*` (25: folder colours, blur, motion, pill).
- Component tokens with raw values: `size.panel.left/right/chat/min/max` (px), `icon.stroke` (1.5).
- No level metadata on any component token.
- Stylesheets reference base steps directly 286 times; semantic spacing (`space.inset/stack/inline/gutter`, 16 tokens) and text styles (`type.*`, 10 tokens) are unused.

### Misplaced states (C8)
- Hover / pressed / selected defined in feature CSS for parts that should be molecules: `.vlt-nav`, `.vlt-tree-row`, `.ed-row`, `.vlt-table tr`, `.vlt-crumb`, `.vlt-account`, `.vlt-workspace`, `.ed-filename`, `.ed-edge`, `.ed-zoom-value`, `.ed-edit`.
- `vault.css:120` repeats the shared pressed rule from `ui.css:40`.
- `vault.css:130` changes the selected nav and tree row per theme (`:root[data-theme='dark']`). A semantic "selected surface" token would let the theme do this.
- Feature CSS restyling atoms: `editor.css` 8 selectors (`.ed-right-tabs .pc-tabs`, `.ed-zoom .pc-icon-btn`, `.ed-status .pc-segmented button`, …), `dashboard.css` 3, `vault.css` 2.
- Inline overrides: `SelectionPill` sets its Button's colour with `style` (should be a Button tone); `IssueRow` sets the dot colour inline (should be a StatusDot tone).

## Proposed plan (only for ⚠️ / ❌), smallest safe steps

All steps follow A5's safety rules: git tag `pre-atomic-migration` first, small commits, **move rather than rewrite**, old import paths kept as deprecated re-exports, old token names kept as aliases, and **before/after screenshots of every screen in both themes must show no visual change**. The as-built scan and audit runner we already have (`tools/as-built-scan.ts`, `tools/audit-run.ts`) can take those screenshots, so no new tool is needed. Run the skill's as-built index (§3.6) again before step 4.

| Step | What | Fixes | Effort | Risk | Touches Build files? |
|---|---|---|---|---|---|
| **1. Classify on paper** | `design/system/registry.json` (every component, its level and its path) and `design/system/EXCEPTIONS.md` (the allowed exceptions, see question 2). Docs only. | C1 | ½ day | none | no |
| **2. Folders, no rewrites (PA.2a)** | Split `ui/components.tsx` into `ui/atoms/`, `ui/molecules/` and `ui/organisms/` (one folder per component); `components.tsx` stays as a deprecated barrel, so no other file changes. `ui.css` is split by level later, if at all. | C2 for the shared kit | 1 day | low | **yes**: `components.tsx` is shared with Build (P3.2 is done; P3.3 next) and the icon session (`ui/atoms/Icon/`). Plan the timing with both |
| **3. Missing pieces and duplicates (PA.2b)** | One component per commit: Kbd, Avatar, Thumbnail (data passed in), NavItem, TreeItem, SearchField, EmptyState, Breadcrumb; then **one** CommandPalette and **one** HelpDialog frame; fix the 5 sideways imports. Pages and templates out of `Dashboard.tsx` and `Editor.tsx` last. | C2–C5, C8 (most) | 3–5 days | medium (largest files, both Build-owned) | **yes**: plan each with Build |
| **4. Token re-linking (PA.3)** | Add level metadata to the 6 component files; route `avatar`/`paper` through semantic tokens; replace the 286 base references in the stylesheets with semantic ones (mechanical, same values, so zero visual change); use the existing tokens for weights, z-index, opacity and radius; add a "selected surface" token to remove the dark-theme fork. | C6, C7, C8 (theme fork), C10 (code-free theme) | 2 days | low–medium (wide but mechanical) | stylesheets: coordinate |
| **5. Guard-rails (PA.4)** | Extend our own token lint (no new package): imports only go downward between levels; no base tokens from component CSS; no raw radius/weight/z/opacity/duration; organisms use atoms only as listed in `EXCEPTIONS.md`. Generate `component-graph.json` from the registry. | keeps C3, C6, C7 green | 1 day | low | no |
| **6. Docs and sheet (PA.5)** | A short `README.md` per component (children, tokens, variants, states, keys); add a "Levels" view with token trace to `/styleguide.html`. | C11, C12 | 2–3 days | none | no |

Density (C10) is not in this plan: it needs a decision first (question 4).

## Founder's answers (7 Nov 2026, DS-05): "Approve 1–5, start step 1"

1. The six-step plan is approved in that order. Steps 2–4 are planned with Build and the icon session before any file moves.
2. Button, IconButton, Icon and Chip may be used directly in organisms, templates and pages (`EXCEPTIONS.md` E1).
3. Folder art keeps its exact values (E2).
4. No density setting for now.
5. `Dashboard.tsx` and `Editor.tsx` are split during step 3, one piece per commit, with Build.

**Step 1 done (7 Nov 2026):** `design/system/registry.json` lists all 95 components (21 atoms, 27 molecules, 31 organisms, 2 templates, 7 pages, 7 outside the levels), each with its place now, its target folder, status, what it is built from and its plan step. It was checked against the code: every file, component and class it names exists, and no entry uses a higher level. `design/system/EXCEPTIONS.md` holds E1–E5, the density note and the cases left for step 3. C1 is met on paper; it is met in code once step 2 moves the files. The registry replaces the inventory tables above as the list to keep up to date.

## 🛑 Questions for the founder (answered above)

1. **Plan:** approve steps 1–6 in this order? Step 1 (docs only) can start now; steps 2–4 are planned with Build and the icon session first, so no two sessions move the same files. *Recommended: yes.*
2. **Atoms inside organisms:** A5 lets an organism use an atom directly only as a listed exception. Today organisms use Button, IconButton, Icon and Chip directly in dozens of places. Allow these four as one standing exception in `EXCEPTIONS.md`, or wrap each use in a molecule? *Recommended: allow; the wrappers would add nothing.*
3. **Folder art:** keep its exact illustration values (colours, blur, timing, radii) as a documented exception, like the canvas, or move them all into tokens in step 4? *Recommended: keep the exception (you said "code wins" for folder art); only its tokens get level metadata.*
4. **Density:** A5's C10 mentions a density switch (compact / comfortable), but PlanCraft has none and DESIGN.md never asked for one. Add one later, or leave density out for now? *Recommended: leave out for now; step 4 makes it easy to add.*
5. **Monster files:** `Dashboard.tsx` (1,883 lines) and `Editor.tsx` (1,595 lines) hold pages, layouts and organisms together. Split them in step 3 (slower, safest) or leave them until the next prompt that changes them? *Recommended: split in step 3, one organism per commit, with Build.*
