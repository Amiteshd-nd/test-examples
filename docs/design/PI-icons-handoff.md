# Handoff — the icon system (A3.1, prompts PI.1–PI.4), for a separate session

> **Written:** 7 Nov 2026 by the docs & UX session, at the founder's request ("write a handoff file … so that I can start it in a separate chat").
> **The founder assigns PI.1–PI.3 to this separate "Icons" session.** `SESSIONS.md` rule 6 normally keeps PRD prompts with the Build session, so say in your `SESSIONS.md` row that the founder assigned these, and tell the Build session.
> **Open the new chat in `/Users/amiteshdebnath/Projects/a7/five` and say:**
> **"Read `docs/design/PI-icons-handoff.md` and start PI.1."**

---

## 1. What to do, in plain words

Replace PlanCraft's temporary single-colour icons with the **duotone icon system** of `PRD-ADDENDUM-A3-ICONS.md` (A3.1):
- the free **Phosphor** library (MIT, "duotone" weight) for common icons;
- our **own CAD icons** (wall, door, window, stair, separator, trim, offset, setback, Vastu compass, generate layout …) drawn in the same style;
- everything through **one `Icon` component** with a **registry**.

Then show the founder an **icon sheet in light and dark** for approval, and swap every icon in the app.

| Prompt | What | Founder stop |
|---|---|---|
| **PI.1** | Style sign-off; write the "Icons" section of `design/DESIGN.md` (A3 §2–§3) | 🛑 questions in §4 below |
| **PI.2** | `Icon` component, registry, Phosphor adapter, CSS, accessibility, tests | 🛑 OK to add `@phosphor-icons/react`, and how custom SVGs become components |
| **PI.3** | The 12 starter icons (A3 §7) as files, the remaining custom icons (A3 §4), the icon sheet, an automated SVG check | 🛑 founder approves the sheet in **both themes**; rejected icons are redrawn, never swapped for a random library icon |
| **Swap** | Replace the temporary icons and glyphs everywhere (§3); no behaviour change | — |
| **PI.4** | Standing rule for every later prompt (A3 §5) | — |

## 2. Read first, in this order

1. `CLAUDE.md` → `SESSIONS.md` (who owns which files **today**; add your row) → `HANDOFF.md` (the Build session's position) → this file.
2. `PRD-ADDENDUM-A3-ICONS.md` (the spec) and `PRD-ADDENDUM-A5-ATOMIC-DESIGN-SYSTEM.md` (Icon is an **atom**; see §6 here).
3. `design/DESIGN.md` → "Icons" (the founder's light-mode rule and the approved token values) and "Colour tokens".
4. `.claude/skills/plancraft-ux-refine/SKILL.md`: quick pass after each prompt, full audit at the end of the PI phase.
5. `design/tokens/component/icon.json`, `design/tokens/TOKEN-INDEX.md`, `DECISIONS.md` (DS-01…, D-…).
6. Style reference: `design/reference-icons/icon-starter-preview.png`. It's our own art, A3 §7's 12 starters. The founder's original reference (two-tone line icons, green when active) is **style only**, and the accent is **not** green (see §4).

## 3. Where things stand (checked 7 Nov 2026)

**Built already (DS-01, DS-03): the icon tokens**, with the founder's separate light-mode mapping.

| CSS variable | Light | Dark |
|---|---|---|
| `--pc-icon-line` | `#111114` | `#F2F2F4` |
| `--pc-icon-line-strong` | `#111114` | `#FFFFFF` |
| `--pc-icon-fill-neutral` | ink 7 % | white 10 % |
| `--pc-icon-fill-active` | accent `#5558CF` at 16 % | `#2E2E5C` |
| `--pc-icon-accent` | `#5558CF` (≥ 3 : 1 on light surfaces, selected rows and its own fill) | `#A5A8F5` |
| `--pc-icon-accent-muted` | `#656571` | `#A0A0AE` |
| `--pc-icon-stroke` | 1.5 | 1.5 |

Sizes: `--pc-size-icon-sm/md/lg/xl` = 16 / 20 / 24 / 32 px at 100 %. They are **rem**, so they grow with Settings → Text size. `--pc-opacity-disabled` = 0.45.
These are exactly the names A3 §3's CSS uses, so that CSS works as written. Source: `design/tokens/component/icon.json`; run `npm run tokens` after any change.

**Not built:** no Phosphor package, no `Icon` component or registry, no custom SVG files, no icon sheet. Nothing uses the icon tokens yet.

**The temporary icons to replace (single colour, `currentColor`, 1.5 px, 20 px grid, rem-sized):**
- `frontend/src/ui/icons.tsx`, the `Icon.*` object with 46 icons: Select Wall Door Window Room Stair Measure Text Undo Redo Chat Bell Layers Grid Search Plus Minus ChevronDown ArrowRight ArrowUpRight Sun Moon Eye Lock Home Sparkle Library Template Star Shared Trash Settings Help File Sheets ChevronRight List Upload Download Copy Pencil Archive Move More Sidebar SidebarHidden. Also `FolderIcon`.
- `frontend/src/editor/tool-icons.tsx`, 11 tool icons (label separator line rectangle hatch move rotate mirror offset trim extend), marked "temporary until the A3 icon registry".
- About 140 `Icon.*` uses: `vault/Dashboard.tsx` 43, `editor/Editor.tsx` 39, `vault/VaultPage.tsx` 29, `styleguide/StyleGuide.tsx` 15, `editor/tool-icons.tsx` 10, `ui/components.tsx` 4, `vault/items.tsx` 2, `editor/Palette.tsx` 1.
- **Text glyphs used as icons** (A3 PI.4 and audit V16: replace them): `★` in `vault/items.tsx` (starred files, two places) and `✓` in `ui/Menu.tsx` (checked menu item).
- `TASKS.md` lists the follow-ups "swap the temporary panel icons for Phosphor `sidebar-simple` at PI.2" and "swap temporary tool icons at PI.2–PI.3".

## 4. PI.1: the questions for the founder

The founder answers short numbered lists ("Approve 1–3, keep 4"). Ask once, recommend, and wait.

1. **Accent:** icons use the one accent already in `DESIGN.md`, blueprint blue (`#5558CF` light / `#A5A8F5` dark for details; D-23), not the green or orange of the reference images. *(Recommend yes; the tokens already assume it.)*
2. **Size and look:** default 20 px (16 in dense lists, 24 in toolbars, 32 for empty states). Duotone as A3 §2: line, a fill tint, accent details. Light and dark follow the founder's rule already recorded in `DESIGN.md`. *(Confirm.)*
3. **Text size interaction:** icons are rem, so at 112.5 % a 20 px icon draws at 22.5 px. A3 §3 says "never scale non-integer". Options: (a) accept, since the 24-grid strokes still look clean; (b) snap each size step to whole pixels per text size. *(Recommend a; check it on the sheet.)*
4. **Active look:** A3 §2 wants an active nav row to have accent text, accent icon details, **a 3 px accent bar on the left** and a soft accent gradient. Today the Vault nav uses a filled pill and the editor toolbar uses accent on a pale accent background. Adopt A3's active look, or keep today's and only recolour the icon? *(This changes the approved look, so the founder decides.)*
5. **Where the files go:** build the `Icon` as an **A5 atom** at `frontend/src/ui/atoms/Icon/`. A5 PA.1 isn't approved yet, but this is a **new** component, so nothing existing moves. *(Recommend yes; tell the A5 session, see §6.)*
6. **Third-party references:** if the founder adds other icon references to `design/reference-icons/`, add `/design/reference-icons/*` (keeping `README.md` and our own `icon-starter-preview.png`) to `.gitignore`, like the other reference folders.

Then write A3 §2–§3 into `design/DESIGN.md` → Icons, replacing the "Thin line icons … until an icon library is approved" paragraph and keeping the founder's light-mode rule and token table. ✅ when the founder approves that section.

## 5. PI.2 → PI.3 → swap: how to build it

**PI.2:**
- 🛑 Ask before adding `@phosphor-icons/react` (MIT): add its notice to `THIRD_PARTY_NOTICES.md`, import icons one by one so unused ones are tree-shaken, and check the installed version's names (newer releases use names like `HouseIcon`).
- **Check its duotone markup** (A3 says the second layer is `opacity="0.2"`) and adapt the recolouring selector if it differs.
- 🛑 How custom SVGs become React components. Options:
  - **(a) recommended, no new package:** a small script in the style of `tools/tokens-build.ts`, e.g. `tools/icons-build.ts`, turns `custom/*.svg` into a generated `.tsx`;
  - (b) SVGR (a package, ask).

Build, in `frontend/src/ui/atoms/Icon/` if PI.1 Q5 is yes:
- `Icon.tsx`: `<Icon name="wall" size="md|sm|lg|xl" state="default|active|disabled" label="Wall tool" />`.
- `registry.ts`: `name → { source: 'custom' | 'phosphor', component }`; names in kebab-case, as in A3 §4.
- `custom/`, `Icon.test.tsx`, and `README.md` (anatomy: layers, tokens, sizes, states, accessibility; A5 §4).

**CSS:**
- A3 §3 as written, in `design/ui.css` or the atom's folder (`.pc-icon`, `.pc-line`, `.pc-fill`, `.pc-accent`, `.pc-accent-fill`, the `.pc-ph` recolouring).
- Sizes come from the tokens, never px: the token lint fails px sizes and raw colours.

**Accessibility:**
- `label` gives `role="img"` and `aria-label`; without `label` the icon is `aria-hidden`.
- Icon-only buttons keep their name and tooltip; `IconButton` in `ui/components.tsx` already takes `label` and shows a tooltip with the shortcut.
- An unknown name gives a visible fallback plus a console warning in dev (test both).

✅ Phosphor and custom icons render side by side at the same size, stroke and colours, in default / active / disabled, in both themes.

**PI.3:**
- The 12 starter SVGs from A3 §7, as files.
- Every other "C" icon in A3 §4. Write each metaphor in one line first ("hatch = rectangle with diagonal accent lines").
- An **automated check** (a test like `tools/tokens/lint.test.ts`): every custom SVG uses only the 4 allowed classes and `viewBox="0 0 24 24"`, with no hard-coded colours.
- The **icon sheet** `design/icons.html`: every icon at 16 / 20 / 24 / 32, default and active, **light and dark**, with names. Generating it from the registry keeps it current, for example a Vite page like `/styleguide.html` plus a saved copy.
- 🛑 The founder approves the sheet in both themes before PI.3 is done (founder rule, `DESIGN.md`).

**Swap:**
- Map the 46 + 11 temporary icons and the `★` / `✓` glyphs to registry names. The A3 §4 inventory lists most of them, for example Home → `house`, Star → `star`, Trash → `trash`, Help → `question`, Settings → `gear-six`, Sidebar → `sidebar-simple`.
- Migrate file by file. During the migration, keep `Icon.X` in `ui/icons.tsx` as a thin **deprecated** wrapper over `<Icon name=… />` (the A5 style: old paths keep working), then delete it once no file uses it.
- **Keep every button's accessible name**: the 26 Playwright tests find buttons by name ("Issues", "Undo…", "Keyboard and mouse help", "Close Properties panel", "Show left panel", "… tool").
- No other behaviour change.

**PI.4 (from then on):** for every new icon, check the registry → use Phosphor if it has a good match → otherwise draw a custom icon by A3 §3 → add it to A3 §4's list and the sheet. No emoji, no other icon sets, no raster icons.

## 6. Other sessions and who owns what (re-check `SESSIONS.md`; this changes during the day)

- **Build** (PRD prompts; P3.2 done, P3.3 next on the founder's word):
  - owns `frontend/src/editor/*.ts`, `Palette.tsx`, `ResizeHandle.tsx`, `e2e/**`, `TASKS.md`, `HANDOFF.md`;
  - shares `Editor.tsx` and `Canvas.tsx`: small exact edits only.
  - The editor swaps (`editor/tool-icons.tsx`, `Editor.tsx`, `Palette.tsx`) need a message to Build first. `ListAgents` shows its current chat name; `SendMessage` to it, say which files you'll touch, and wait if it's busy in them.
- **A5 atomic audit** (PA.1, read-only, writes `design/system/ATOMIC-AUDIT.md`): tell it that the `Icon` atom is being built at `frontend/src/ui/atoms/Icon/`, so its inventory and plan include it. Don't move other components; that's PA.2, after the founder's approval.
- **Design-system / UI files** (`frontend/src/ui/**`, `design/**`, all `*.css`) have no active owner session right now. Register them in your row for this work.
- **Shared-file rules:** re-read a file before changing it, make exact-text edits only, and run Prettier only on files you changed.

## 7. Checks, records and rules

- **After each prompt:**
  - `npm run check` must be green (typecheck, lint, Prettier, all tests including the token lint);
  - `npx playwright test` (26 browser tests; they reuse the dev server on :5173);
  - the UX skill's **quick pass** on the changed parts;
  - a **full audit** at the end of the PI phase (CLAUDE.md rule 4; the skill counts PI as a UI phase).
- **Records:**
  - decisions as `DS-nn`: take the next free number after re-reading `DECISIONS.md` (DS-04 was the last one by the docs & UX session; the A5 session may take more);
  - `design/DESIGN.md` (Icons section + a dated line under "Change log");
  - `design/tokens/CHANGELOG.md` if icon tokens change;
  - `THIRD_PARTY_NOTICES.md` (Phosphor);
  - your own section in `PROGRESS.md`;
  - a "Finished" line in `SESSIONS.md`;
  - one entry in `text-to-cad-project-memory.md` § 14 with the next free v-number (v41 was the last on 7 Nov morning; the A5 session uses v42+), and tell the others which one you took.
- **Rules:**
  - ask before adding any package;
  - **commit and push only when the founder asks** (the code is on GitHub `Amiteshd-nd/test-examples`, `main`);
  - explain results in plain language first (the founder is an architect, not a developer).
- **Out of scope here:** the pending **Phase 2 UX audit** (it waits for the founder's go), A5 PA.2–PA.5, and the mobile app (A4: rules only).

## 8. Gotchas (learnt in this repo)

- The **Write tool turns `\uXXXX` text into the literal character**. Scan for invisible characters after writing code with escapes.
- **Prettier reflows files**: re-read before an exact-text edit.
- The token lint rejects px for sizes, spacing and positions, and any raw colour, in `frontend/src`. Use `var(--pc-…)` or rem. JS that needs a size token in px uses `cssPx()` from `design/ui-scale.ts`.
- The browser pane is about 800 px wide: use `resize_window` 1440 × 900 for desktop checks, and take screenshots again if they come out blank or mid-transition.
- Headless-Chrome scripts (`tools/as-built-scan.ts`, `tools/audit-run.ts`) need the dev server running. For a CDP Enter key to activate a button, send `text: '\r'` with the key.
