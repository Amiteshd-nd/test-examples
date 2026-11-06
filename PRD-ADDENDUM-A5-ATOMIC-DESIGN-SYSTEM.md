# PRD Addendum A5 — Atomic Design System (atoms → molecules → organisms, token-linked)

> **Extends:** skill `plancraft-ux-refine` v1.2 (§3 tokens: base → semantic → component), `DESIGN.md`, A3.1 (icons), and every UI phase. All `CLAUDE.md` rules apply.
> **Version:** A5.0 · **Date:** 6 Nov 2026
> **Important context:** the founder has **already built the token system with Claude Code** following the skill. This file adds the **atomic structure** on top of it. It is **check-first**: nothing gets rewritten unless the check (§2) finds a gap **and** the founder approves.
> **For Claude Code — first actions when you read this file:**
> 1. Add one line to `CLAUDE.md` under the spec references: *"Also follow `PRD-ADDENDUM-A5-ATOMIC-DESIGN-SYSTEM.md` (atomic design system, prompts PA.1–PA.5; check-first, never overwrite without approval)."*
> 2. Add one line at the end of skill §3 (`.claude/skills/plancraft-ux-refine/SKILL.md`): *"Component tokens are organised by atomic level — see `PRD-ADDENDUM-A5-ATOMIC-DESIGN-SYSTEM.md`."*
> 3. Then run **PA.1 (check only)** when the founder asks. Do not move, rename or rewrite any component or token before PA.1's report is approved.

---

## 1. The structure the founder wants (plain language)

Everything in the interface is built in **nested levels**, like building blocks:

| Level | What it is | Built from | Examples (PlanCraft) |
|---|---|---|---|
| **Tokens** | Design decisions (colours, sizes, spacing, type, motion) | base → semantic (already built) | `color.text.primary`, `space.inset.md` |
| **Atoms** | Smallest UI pieces; can't be split further | **tokens only** | Icon, Text, Button, Input, Checkbox, Switch, Badge, Avatar, Divider, Spinner, Kbd (shortcut key), StatusDot, Thumbnail |
| **Molecules** | Small groups of atoms doing one job | **atoms** | SearchField (Input + Icon + Kbd), NavItem (Icon + Text + Badge + active bar), TreeItem, FormField (Label + Input + help/error), MenuItem, Tooltip, ToolButton (IconButton + Tooltip + shortcut), DimensionInput (Input + unit), MetricStat, IssueRow, VersionChip, AvatarGroup, FolderArt |
| **Organisms** | Full components / sections of a screen | **molecules** (and other organisms) | VaultSidebar, ProjectsTree, FolderGrid, FilesTable, CommandPalette, EditorTopBar (incl. panel toggles), ToolRail, PropertiesPanel, IssuesPanel, MetricsPanel, ChatPanel, VariationsGallery, LayersPanel, HistoryPanel, ShareDialog, ConflictCard |
| **Templates** | Page layouts (regions, no real data) | organisms | VaultLayout, EditorShell, SheetsWorkspace, SettingsLayout |
| **Pages** | Real screens with data | a template + data | Home, Folder, Editor, Sheets, Settings, Trash |

**The key promise:** tokens are attached at the **lowest** level. Atoms use tokens; molecules use atoms (and so inherit their tokens); organisms use molecules (and so inherit everything below). An organism is therefore **token-connected by default** — it should need almost no tokens of its own, and **never** raw values. Change a semantic token (theme, density, accent) and every atom, molecule and organism updates automatically.

---

## 2. PA.1 — Check first (no changes)

Before touching anything, inspect what exists and report.

**Read:** `DESIGN.md`, `/design/tokens/**` (incl. `TOKEN-INDEX.md`, `AS-BUILT-INDEX.md`), the component folders in `/frontend`, the token build output, and any component sheet/workshop.

**Check each rule and mark ✅ / ⚠️ partial / ❌ missing, with evidence (file paths, counts):**

| # | Rule | How to check |
|---|---|---|
| C1 | Every UI component is classified as atom, molecule, organism, template or page | Folder structure or a registry/metadata; list unclassified components |
| C2 | Folder structure reflects the levels (§4) | Compare actual folders with §4 |
| C3 | **Import direction:** a level imports only from lower levels (§5) | Scan imports; list every upward or sideways violation |
| C4 | Molecules are built from atoms (not raw HTML + styles) | List molecules that style raw elements directly |
| C5 | Organisms are built from molecules (atoms only as approved exceptions, §5) | List organisms that use atoms or raw elements directly |
| C6 | **Token chain per level** (§3): atom tokens → semantic; molecule tokens → atom/semantic; organism tokens → molecule/semantic; nothing references base directly; no upward references | Resolve every component token's alias chain |
| C7 | No raw values in any component (colours, spacing, radii, type, shadows, durations) | Reuse the skill's raw-value scan |
| C8 | States and variants live at the **lowest** level that owns them (e.g. hover/focus/disabled defined on Button atom, not redefined in molecules/organisms) | Look for state styles above atom level |
| C9 | Organisms define only **composition tokens** (gaps/padding between molecules, region background) | List organism tokens that duplicate lower-level decisions |
| C10 | Theme / density / UI-scale switches update all levels with zero component code changes | Toggle and screenshot each level |
| C11 | Each component documents its anatomy (children, tokens, variants, states, accessibility) | Look for docs/stories/sheet entries |
| C12 | A design-system sheet shows the hierarchy and token links | Look for the sheet/workshop page |

**Output:** `/design/system/ATOMIC-AUDIT.md`:
```
# Atomic design system audit — <date>
## Verdict (plain language): COMPLIANT · PARTLY COMPLIANT · NOT STRUCTURED
## Scorecard C1–C12 (✅/⚠️/❌ + evidence)
## Inventory by level (component · current level · proposed level · path)
## Violations (imports, raw values, broken token chains, misplaced states)
## Proposed plan (only for ⚠️/❌), smallest safe steps, effort, risk
```

**🛑 Stop and ask the founder:**
- **If everything is ✅:** "Your design system already follows the atomic structure. I'll only add the missing guard-rails (lint/docs) if any — nothing else changes. OK?"
- **If anything is ⚠️ or ❌:** show the verdict, the violations and the plan; ask for approval of the plan (or which parts). **Do not change code until approved.**

---

## 3. Token rules by level (nested, interconnected)

**Allowed references** (DTCG aliases `{…}`):
| Token at level | May reference | Must never reference |
|---|---|---|
| Semantic | base | component tokens |
| Atom | semantic, other atom tokens | base, molecule, organism |
| Molecule | its atoms' tokens, semantic | base, organism |
| Organism | its molecules' tokens, semantic | base, atom tokens directly (go through the molecule) |

**Inheritance by default:** a component uses its children's tokens through the children. Add a token at a higher level **only** when the higher level makes a *different* decision (e.g. `vault-sidebar.padding-inline → {space.inset.md}`); if it would just repeat a child's value, don't create it.

**Example chain:**
```
base      space.200 = 8px
semantic  space.inline.sm  → {space.200}
atom      button.gap        → {space.inline.sm}          (icon ↔ label inside a button)
molecule  search-field.gap  → {space.inline.sm}          (icon ↔ input; same decision, semantic alias)
molecule  nav-item.gap      → {button.gap}               (deliberately follows the button)
organism  vault-sidebar.item-gap → {space.stack.xs}      (composition: gap between NavItems)
```

**Naming & files (non-destructive):**
- **Keep existing component token names** if they already work; record the level as metadata instead of renaming: `"$extensions": {"pc": {"level": "atom"}}`.
- New tokens: `{component}.{part}.{property}.{variant}.{state}` (e.g. `tree-item.chevron.size`), CSS `--pc-tree-item-chevron-size`. Component names are unique across levels, so no level prefix is needed in the name.
- Files: `/design/tokens/component/atoms/*.json`, `…/molecules/*.json`, `…/organisms/*.json` (move existing files only after approval; the build output names stay the same).
- Canvas rendering tokens (`canvas.*`) and diff/presence tokens stay **semantic** — the canvas is drawn by the renderer, not built from DOM atoms.

---

## 4. Code structure
```
/frontend/src/ui/
  atoms/       Icon/ Text/ Button/ IconButton/ Input/ Checkbox/ Switch/ Badge/ Avatar/ Divider/ Spinner/ Skeleton/ Kbd/ StatusDot/ Thumbnail/ …
  molecules/   SearchField/ NavItem/ TreeItem/ FormField/ MenuItem/ Tooltip/ ToolButton/ DimensionInput/ MetricStat/ IssueRow/ VersionChip/ AvatarGroup/ FolderArt/ …
  organisms/   VaultSidebar/ ProjectsTree/ FolderGrid/ FilesTable/ CommandPalette/ EditorTopBar/ ToolRail/ PropertiesPanel/ IssuesPanel/ ChatPanel/ …
  templates/   VaultLayout/ EditorShell/ SheetsWorkspace/ SettingsLayout/
  index.ts     public exports per level
/frontend/src/pages/   Home/ Folder/ Editor/ Sheets/ Settings/ Trash/
```
Each component folder: `Component.tsx` · `Component.test.tsx` · `README.md` (anatomy: children, tokens used, variants, states, keyboard & screen-reader behaviour) · sheet/story entry.
The inventory in §1 is a **starting list** — match it to what exists; don't create components nobody needs.

## 5. Composition and import rules
1. **Downward only:** atoms ← molecules ← organisms ← templates ← pages. A lower level never imports a higher one.
2. **Atoms** import tokens and utilities only. Exception: atoms may use the `Icon` atom and a visually-hidden-text helper.
3. **Molecules** import atoms only (not other molecules), keeping them small. If a molecule needs another molecule, it is probably an organism.
4. **Organisms** import molecules and other organisms. Using an atom directly is an **exception** allowed only when wrapping it in a molecule adds nothing (e.g. a single Divider); each exception is listed in `/design/system/EXCEPTIONS.md` with a reason.
5. **Templates** arrange organisms in regions; **pages** add data. Data fetching and engine calls happen in pages (or organism containers passed in as props) — atoms and molecules are purely presentational and never call the engine or storage.
6. **Variants flow down as props** (size, tone, density); higher levels never restyle lower-level internals (no overriding a Button's padding from inside an organism — add a Button variant instead).
7. **States belong to the owner:** hover/focus/pressed/disabled are defined once on the atom (or the molecule that owns the interaction, e.g. NavItem active state) and reused upward.

## 6. Prompts

#### PA.1 — Check (no changes)
§2. **✅** `ATOMIC-AUDIT.md` written; founder has read the verdict and approved a plan (or confirmed "compliant").

#### PA.2 — Restructure (only the approved parts)
**Safety first:** create a git tag `pre-atomic-migration`; work in small commits; **move** files rather than rewrite; keep old import paths working through re-exports marked deprecated; keep old token names as deprecated aliases (skill §3.7). This is a **pure refactor**: visual-regression screenshots of every screen and theme must show **no visual change** (any intended visual fix is a separate, approved commit).
Order: classify → move atoms → molecules → organisms → templates → pages; after each level: tests + screenshots + `PROGRESS.md` note.
**✅** All approved gaps closed; zero unintended visual diffs; old paths still compile (with deprecation warnings).

#### PA.3 — Token re-linking
Fix token chains per §3: add level metadata, replace base references with semantic, route organism tokens through molecules, delete duplicate higher-level tokens (as deprecated aliases first). Update `TOKEN-INDEX.md` with a **Level** column and the full alias chain for each token.
**✅** Every component token resolves through an allowed chain; theme/density/UI-scale switches update all levels with no code changes (C10).

#### PA.4 — Guard-rails
🛑 Ask before adding tools. Add checks that fail the build on: upward/sideways imports between levels; raw values in components; tokens referencing base from a component level; organisms using atoms outside `EXCEPTIONS.md`. Add a script that generates `/design/system/component-graph.json` and a diagram (component → children → tokens).
**✅** Checks run in tests/CI; a deliberate violation is caught.

#### PA.5 — Design-system sheet
A page (route `#design-system`, dev and admin only) showing levels as tabs: every atom, molecule, organism in all variants × states × themes × densities; clicking a component shows its children and token chain (token → semantic → base, with values per theme).
**✅** Founder can trace any colour or spacing on any organism back to its base token in ≤ 3 clicks.

## 7. Ongoing rule (every future UI prompt)
New UI starts at the lowest level that's missing: reuse atoms → compose a molecule → compose the organism. Before creating a component, search the registry; prefer extending a variant over creating a near-duplicate. The skill's quick pass now also checks C3, C6, C7 and C8 for the changed components.

## 8. Mobile (A4)
Atoms and molecules are shared with mobile through tokens (touch density). Mobile-specific organisms (bottom tab bar, bottom sheet, level switcher) are built from the same molecules.

## 9. Change log
- **A5.0 (6 Nov 2026):** Atomic design structure on top of the existing token system: levels and starting inventory; check-first audit (C1–C12) with founder approval before any change; token reference rules per level (nested, inheritance by default, non-destructive naming via level metadata); code structure; composition/import rules; prompts PA.1–PA.5 with pure-refactor safety (tag, re-exports, deprecated aliases, zero visual diff); guard-rails and design-system sheet.
