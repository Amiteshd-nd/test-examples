# HANDOFF — start here in a new session

> **Parallel sessions (from 2026-11-06):** the founder may run other Claude sessions in this folder at the same time (e.g. design-system UI fixes). Read **`SESSIONS.md`** before editing. The "next prompt" below is for the **Build** session only.

Updated: 2026-11-06, session 3 (P2.2a, Playwright, P2.4 and P2.5 done: Phase 2 complete). Next session: open Claude Code in `/Users/amiteshdebnath/Projects/a7/five` and say:

> **Read HANDOFF.md and continue with P3.1.**

Then read, in this order: `CLAUDE.md` → `SESSIONS.md` → this file → `TASKS.md` → `DECISIONS.md` (D-01…D-40; design-system decisions are `DS-nn`) → `MEMORY.md` → `ARCHITECTURE.md` → `design/DESIGN.md`. The specs are `PRD.md` (v1.2), `PRD-ADDENDUM-3D-PRESENTATION.md` (A1, phases 11–13) and `PRD-ADDENDUM-A2-VAULT.md` (A2: amendments M1–M12, phases 14–16). The per-prompt log is `PROGRESS.md`.

## The project in one paragraph

PlanCraft: a browser CAD editor for Indian residential floor plans, built around a **headless TypeScript engine** (`/engine`, pure: no DOM, network or files; only `TextDecoder` is allowed, D-15). React + Vite UI in `/frontend`; `/server` is still empty (P4.1); offline scripts in `/tools`. The founder is an architect, not a developer: explain in plain language first.

## Working agreements (the founder's)

- **Back to back:** do PRD prompts one after the other without waiting for "Do P#.#"; **stop only at a 🛑** that needs the founder's answer. Build around missing inputs when told to (P1.2 was built without sample drawings).
- **Build order: the A2 order** (D-28): ~~P2.1~~ → ~~P14.1~~ → ~~P2.2~~ → ~~P2.3 (+M6 index)~~ → ~~P14.2 (+M10)~~ → ~~P14.3~~ → ~~P14.4 (+M12)~~ → ~~P14.5~~ (Phase 14 done) → ~~P2.2a collapsible side panels~~ (founder's addition, D-41) → ~~P2.4 (+M2, M7, M8, M9)~~ → ~~P2.5 (+M5)~~ (Phase 2 done) → **P3 (now: P3.1)** → P3 → P4 → P5 → P6 → P7 → P10.1 (moved up, M11) → Phase 15 → A1 (P11, P12.1–P12.4, P13.1–P13.3, P13.5) → Phase 8 → P10.2–P10.4. After beta: Phase 9, Phase 16, A1 P12.5/P13.4, P10.5.
- Ask before adding dependencies, **except tools a PRD prompt names** (we installed zod, React, Vite, Vitest, ESLint, Prettier, ezdxf, pytest, Geist fonts on that basis or with approval).
- Never ask for API keys in chat. Commit only when asked (the repo has **no commits yet**; branch `main`).
- At the end of each prompt: run `npm run check`, update `PROGRESS.md`, `TASKS.md`, `DECISIONS.md` (append-only, next id **D-45**; the design-system / tokens session uses DS-nn), `ARCHITECTURE.md`, and the change log in `text-to-cad-project-memory.md` (next **v36**: v32 was the tokens session's, v33 P2.2a, v34 P2.4, v35 P2.5; the founder's chat copy uses c21+). New standing rule in `CLAUDE.md`: after any prompt that touches `/frontend`, run the `plancraft-ux-refine` skill's quick pass (§9); a full audit at the end of Phase 14.

## Where things stand

**Done:** P0.1, P0.2 (ADR 0001), P1.1, format **1.1.0** (A2 M1 + M3), **P1.1b** geometry kernel, P1.2 (DXF import), P1.3 (DXF export), P1.4 (Plan Library), P2.1 (design system), P14.1 (Vault component page), **P2.2 app shell** (D-33), **P2.3 canvas + M6 spatial index** (D-34, D-35). 198 tests, all checks green.

The editor (http://localhost:5173/, `#<plan-id>` opens a library plan):
- Engine view API: `planDrawing` (what to draw; opening symbols = DXF blocks), `buildPlanIndex` / `hitTest` / `snapPoint` over our own R-tree (`engine/spatial/rtree.ts`), `gridPlan` test plans.
- Frontend: `editor/Editor.tsx` (loader + shell), `editor/Canvas.tsx` (gestures), `editor/Properties.tsx`, `editor/state.ts` (view-state reducer; selection is any `{kind, id}`), `ui/PlanView.tsx` (SVG of a `PlanDrawing`, memoised layers), `ui/view.ts` (view maths), `library/fetch-store.ts` (read-only `DocumentStore` over HTTP; `frontend/vite.config.ts` serves `data/library/` at `/library/` in dev).
- Local library: 4 synthetic plans (two 1BHK drawings, `synthetic-grid-4x3-typical`, `synthetic-grid-12x10-stress`), rebuilt with `npm run fixtures && npm run import && npm run library`. `data/` is git-ignored.

**P14.2 Vault storage (+ M10) — done** (D-36, D-37): `engine/vault/` (`Vault` on a read/write/remove `VaultStorage`; records; own zip + DEFLATE decoder; `seedDemoVault`), `engine/render/thumbnail.ts`, `engine/ids.ts` (`IdSource`, `Clock`, `formatUlid`), `engine/samples/blank-plan.ts`; `tools/fs-vault-storage.ts` + `npm run vault:seed` → `data/vault/` holds a demo workspace (8 folders, 3 plans). 225 tests green.

**P14.3 Dashboard screen — done** (D-38; founder test passed except the DXF import step, which Claude checked). The Vault is the first page (`src/App.tsx` routes by hash; `src/vault/Dashboard.tsx` + `items.tsx`, `dialogs.tsx`, `folder-art.tsx`, `listing.ts`, `client.ts`, `http-storage.ts`; `src/ui/Menu.tsx`). The engine's Vault runs in the browser on `/vault-storage/<key>` (dev route over `data/vault/`). Starred/Trash lists and the P14.5 shortcuts are already in.

**P14.4 Editor ⇄ Vault (+ M12) — done** (D-39): `src/editor/autosave.ts` (`Autosaver`, `localDraft`, `draftDecision`) + `useFileSave.ts`; `Vault.saveDocument(id, plan, {baseRev})` with `VaultConflictError`, editing time + auto-versions (`createVersion`, `loadVersion`), vault format 2. Until P2.4, plan changes for checks go through the dev-only `window.__plancraft.setPlan`. 243 tests green.

**P14.5 + Phase 14 end — done** (D-40): Search page with filters in the address (`#/search?…`), grid/list in every view (shared `ItemsView`), 30-day Trash purge when the Vault opens, Trash actions for the selection; UX full audit `design/audits/2026-11-06-vault-phase14.md` (7 fixes; 🛑 V8 small text waits for the founder; V9–V12 for the design-system session). 249 tests.

**P2.2a collapsible side panels — done** (D-41): `src/editor/panels.ts` (panel store, shortcuts, `keepStill`), `Palette.tsx` (editor ⌘K), `ResizeHandle.tsx`; the canvas reports its place in the window (`onLayout`, ResizeObserver + `flushSync`) so the plan never moves while panels slide. Temporary panel icons (`Icon.Sidebar`, `Icon.SidebarHidden`) until PI.1–PI.2. 🛑 Open question to the founder: add Playwright for automated browser tests?

**Tokens (from the parallel session, DS-01):** `frontend/src/design/tokens.css` is **generated** — add tokens to `design/tokens/*.json` and run `npm run tokens`; never hand-edit it. New CSS uses `--pc-*` names (`design/tokens/TOKEN-INDEX.md`); old names are aliases. `npm test` includes a token lint (`tools/tokens/lint.test.ts`): no raw colours, spacing on the space scale, font sizes on the type scale; exceptions with a reason in `design/tokens/lint-allow.json`.

**P2.4 command layer — done** (D-43): `engine/commands/` (changesets `diff`/`apply`/`invert`/`applyChecked`/`changedObjects`; commands MOVE, DELETE, ADD_WALL, ADD_ROOM, ADD_OPENING, SET; the bus `execute`/`preview`/`undo`/`redo`/`applyRemote`; typed form `parseCommand`/`formatCommand`). Editor: `src/editor/useEditing.ts`; drag the selection to move it, Delete, ⌘Z/⇧⌘Z, toolbar Undo/Redo, ⌘K typed commands, live region. The dev hook is now `window.__plancraft.{plan, run, undo, redo}` (`run({op:'execute', id, params})`); `setPlan` is gone.

**P2.5 toolset — done, and Phase 2 is complete** (D-44): plan format **1.2.0** (annotation maps `lines`, `dimensions`, `texts`, `hatches`); `engine/commands/tool-commands.ts` (15 more commands; 21 in `PLAN_COMMANDS`, `registry.ts`), `input.ts` (typed lengths / points, A2 M5), `three-ways.test.ts`; editor tools in `src/editor/tools.ts` (pure, tested) run by `useTools.ts`, prompt line `ToolPrompt.tsx`, `HelpDialog.tsx`, Properties editing, annotation layers in `ui/PlanView.tsx`. Browser tests in `e2e/tools.spec.ts` (shared helpers in `e2e/helpers.ts`: in-memory Vault, `clickAt`, `editorLevel`). Phase 2 end: gates reported, `INTEGRATION.md`, `SCHEMA-CHANGELOG.md`, golden plans; the UX full audit for Phase 2 was requested from the docs & UX session and is on hold until the founder says when (its findings for Build go into `TASKS.md`).

**Next: P3.1 Rule packs** (Phase 3, rules engine; first city Bengaluru, D-02). It has a 🛑: the founder reviews every seeded value and adds city bylaws; build the packs first, then stop and ask. Open founder question from P2.5: minimum on-screen size for annotation text (see `TASKS.md`).

## Waiting on the founder (not blocking)

- 2–5 anonymised **sample DXFs** in `data/raw/samples/` + their layer names → `npm run import` → check previews (P1.2 acceptance) → `npm run library` → edit `data/library/tag-review.csv` → `npm run library:review` (P1.4 🛑).
- Open `data/exports/check/b-1bhk-t-junctions.dxf` in AutoCAD/LibreCAD (P1.3 acceptance; created by `npm run test:dxf`).
- Their existing editor code (Rayon-style + Gemini chat), before P4.
- 🧠 FT-0 practice run: open once ~200 plans are in the library. FT-1 progress: 0 / 1,000.

## Commands and pages

- `npm run dev` → http://localhost:5173 (editor) · `/styleguide.html` (P2.1) · `/vault.html` (P14.1, dark default). A dev server from session 1 may still be running: if port 5173 is busy, use it or stop it in its terminal (`pkill -f vite` is blocked by permissions).
- `npm run check` = typecheck + lint + format + tests (363 tests now; `npm run test:e2e`: 20 browser tests) · `npm test` · `npm run schema` (JSON Schema after a format change).
- `npm run test:e2e` = Playwright browser tests in `e2e/` (installed Google Chrome, headless; frames and ResizeObservers run there, unlike the hidden browser pane). Reuses the dev server on 5173. Write one spec per UI prompt; `page.on('pageerror')` fails a test on any script error.
- `npm run fixtures` / `npm run import` / `npm run library` / `npm run library:review` · `npm run test:dxf` (needs `python3 -m venv tools/.venv && tools/.venv/bin/pip install ezdxf pytest`; already installed locally).

## Gotchas learnt so far

- **Unicode escapes:** the Write/Edit tools turn `\uXXXX` text into the literal character. After writing code that needs escapes, scan for invisible characters and fix them with a script.
- **Prettier reflows files**, so re-read a file before patching it by exact text (several edits failed on stale text).
- **Engine TypeScript rules:** explicit `.ts` import extensions; `erasableSyntaxOnly` (no constructor parameter properties); JSON imports need `with { type: 'json' }`; `lib: ES2022` only (no DOM, no Node).
- **Browser pane:**
  - It's about 800 px wide: use `resize_window` 1440 × 900 for desktop checks (the app clears it each turn).
  - Screenshots are sometimes blank or caught mid-transition: take them again.
  - The console log keeps stale errors from old hot reloads: reload and re-read before trusting it.
- **Fuzz tests:** check they really exercise the code (the first generator enclosed only 2 of 887 rooms).
- **Reference images:** in `design/reference/`, `design/reference-vault/` (and later `design/reference-3d/`). Local only, git-ignored, style inspiration only: never reuse names, captions or icons.
- **Browser pane (session 2):** `computer` `zoom` with a region isn't supported (returns the full screenshot); measure in the page with `javascript_tool` instead. Testing Export DXF: intercept `URL.createObjectURL` in the page to read the file without downloading it.
- **Hidden browser pane (session 2):** when the pane is hidden, animation frames and ResizeObserver don't run, so a freshly loaded page has no canvas size. Taking a `computer` screenshot makes it lay out once. For speed checks, stand in for `requestAnimationFrame` with a timer in the page and time update + layout; paint can only be judged with the pane visible.
- **Testing the dashboard in the pane:** the pane can't drive the computer's file chooser; stub `HTMLInputElement.prototype.click` for file inputs, then set `input.files` from a `DataTransfer` holding a `File` fetched via `/@fs/<abs path>` and dispatch `change`. Right-click by screen coordinates can miss after the pane rescales; dispatch `contextmenu` on the element instead.
- **Stale code after edits (session 2):** Vite's hot update sometimes leaves the open tab running old code (new routes or hooks "do nothing"). Do a full `location.reload()` before testing a change in the browser.
- **`npm run check` and other sessions:** at the end of session 2 it stopped at formatting in the Docs & UX session's unfinished files (`design/tokens/*`, `tools/as-built/*`). Leave those to that session; check your own work with `npm run typecheck`, `npm run lint`, `npx vitest run` and `npx prettier --check <your files>`.
- **Scripted browser checks (session 3):** React applies state from a scripted `click()` or `dispatchEvent` a tick later; `await` a short timeout between steps or later steps act on stale state. Synthetic `PointerEvent`s need a real pointer id (1 for the mouse) or `setPointerCapture` throws.
- **Checking animations with the pane hidden (session 3):** frames and ResizeObservers don't run, so transitions stall. Pause them (`document.getAnimations()`, `a.pause(); a.currentTime = 90`), take a `computer` screenshot (it renders one frame), then measure; `a.finish()` jumps to the end. Screenshots taken right after a theme switch can show a colour transition half-way: take another.
- **Browser tests that edit a file (session 3):** `e2e/editing.spec.ts` builds a Vault in Node with the engine (`MemoryStorage`) and answers the page's `/vault-storage/` calls with `page.route`, so tests never touch `data/vault/`. Engine code imports fine in Playwright specs.
- **React and pointer moves (session 3):** state set in a `pointermove` handler renders after the next frame's ResizeObserver; when a layout change must be corrected in the same frame (panel resize), set it inside `flushSync`.
- **Talking to parallel sessions:** other Claude sessions may message this one (`SendMessage` back to their `from` address); the tokens session added the panel tokens on request. Ask them for token changes rather than editing their files.
- **Permanent deletion is blocked for Claude** in this environment (emptying Trash, deleting for ever): leave it to the founder.
