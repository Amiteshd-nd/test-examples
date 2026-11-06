# Progress

One entry per finished prompt (PRD §0.2): prompt ID, date, what was built, files changed, how to run/test, open issues.

---

## P0.1 — Project setup and founder interview · 2026-11-06

**What was built.** The empty project skeleton: three packages (engine, frontend, server), the folder layout from the PRD, strict TypeScript, tests, linting, formatting, and an automatic check that keeps the engine free of screens, network and files. The founder interview is recorded in `DECISIONS.md` (D-01…D-04).

**Founder answers.**
- Existing editor code: yes, to be shared later.
- Display units: metres.
- First rule-pack city: Bengaluru (BBMP).
- Gemini API key: ready (goes into `server/.env` in P4.1).

**Files.**
- Root: `package.json`, `package-lock.json`, `tsconfig.base.json`, `vitest.config.ts`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `.env.example`
- Docs: `README.md`, `PROGRESS.md`, `INTEGRATION.md`, `SCHEMA-CHANGELOG.md`, `THIRD_PARTY_NOTICES.md`, `ARCHITECTURE.md`, `TASKS.md`, `DECISIONS.md`, `MEMORY.md`, `CLAUDE.md` (repo-docs section added), `docs/decisions/README.md`, `docs/design/README.md`, `docs/design/AUDIT-SUMMARY.md` (moved)
- `engine/`: `package.json`, `tsconfig.json`, `tsconfig.test.json`, `index.ts`, `index.test.ts`, `purity.test.ts`
- `frontend/`: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`
- `server/`: `package.json`, `README.md` · `tools/README.md`
- Empty folders kept with `.gitkeep`: `data/{raw/samples,converted,library,exports}`, `design/reference`

**How to run / test.** `npm install`, then `npm run dev` (http://localhost:5173) and `npm run check`.

**Acceptance checks.**
- ✅ `npm run dev` starts the frontend; the page loads with no console errors and shows the engine version (proves the UI reaches the engine through `index.ts`).
- ✅ Tests run: 2 files, 4 tests pass.
- ✅ Engine-purity check passes. Also proven to fail: a temporary `engine/bad.ts` importing `node:fs` and calling `fetch` was caught by the test, ESLint and the type check, then deleted.
- ✅ `npm run typecheck`, `npm run lint`, `npm run format:check` clean.

**Open issues.**
- `npm audit`: 10 moderate findings, all `minimatch` inside ESLint tooling (dev-only, never shipped). Accepted for now (D-07).
- Existing editor code not shared yet (D-03).
- PRD §9 open questions still open: 1 (CADCraft, P0.2), 2 (DXF importer, P1.2), 3 (solver, P5.3), 5 (layer standard, P7.1), 6 (hosting, P4.1/P9.1), 7 (pricing, P10.5). Question 4 is answered: BBMP.

---

## P0.2 — CADCraft reference review · 2026-11-06

**What was done.** Read CADCraft (the free AutoCAD-style program) to decide what to borrow. Four parallel reviews covered commands, undo, snapping/tracking, geometry (trim/extend/fillet/offset, hatch boundaries) and DXF; the key numbers were spot-checked by hand. The founder confirmed the recommendation: **own TypeScript engine; copy two self-contained pieces later with CADCraft's licence notice (DXF tag reader, room-outline tracing); reuse nine ideas without code.**

**Files.** `docs/decisions/0001-cad-engine.md` (new, Accepted), `DECISIONS.md` (D-09), `TASKS.md`, `PROGRESS.md`, `text-to-cad-project-memory.md` (change log v15).

**Reference copy.** CADCraft cloned read-only outside the repo, pinned at commit `3b7eb1bb7bcbb5dd9a4f71ac1997f0e31105f2e82` (2026-11-05). No CADCraft code or files are in this repo.

**Acceptance checks.**
- ✅ ADR written and confirmed by the founder.
- ✅ Nothing from CADCraft copied, so no notice is due yet; ADR 0001 §6 says how the notice is added when C1/C2 are ported.
- ✅ `npm run check` still green.

**Open issues.**
- PRD §9 question 1 (CADCraft) is answered. Still open: 2 (DXF importer: settled at P1.2 together with C1), 3, 5, 6, 7.
- CADCraft's own DXF code is tested only on synthetic files, so the founder's real sample DXFs matter for P1.2.

---

## P1.1 — Plan schema v1 + validator + migrations · 2026-11-06

**What was built.** The plan file format (version 1.0.0) and a checker for it. A plan now has a strict, written-down shape: what a wall, room, door, window, stair, column and so on contains, all sizes in centimetres. The engine works out each room's floor outline and area from the walls around it, and the checker explains any problem in plain words with a fix ("Door D1 runs past the end of wall W5: it needs 4.40 m of wall but the wall is 4.00 m long").

**Founder answers (🛑).** Added: chajja/sunshade, column grid, loft; room types Dress/walk-in, Family lounge, Lift, Shop/office; wall types parapet and compound. Not added: sunken toilet. (D-12)

**Files.**
- New: `engine/schema/{primitives,room-types,plan,rule,brief,version,migrate,json-schema}.ts`, `engine/schema/json/{plan,rule,issue,brief}.schema.json`, `engine/geometry/{planar,inset}.ts`, `engine/rooms/derive.ts`, `engine/validate/{issues,validate}.ts`, `engine/samples/1.0.0/` (3 plans + README with hand calculations), `tools/generate-json-schema.ts`, `tools/tsconfig.json`; tests beside each module.
- Changed: `engine/index.ts` (public API, version 0.1.0), `engine/package.json` (zod), `engine/tsconfig.test.json`, `tsconfig.base.json` (D-10), `package.json` (`schema` script; typecheck includes tools).
- Docs: `DECISIONS.md` (D-10…D-14), `SCHEMA-CHANGELOG.md`, `INTEGRATION.md`, `ARCHITECTURE.md`, `TASKS.md`.

**How to run / test.** `npm run check`. Regenerate JSON Schema after a format change: `npm run schema`.

**Acceptance checks.**
- ✅ Valid samples pass; 14 kinds of invalid schema input and every one of the 15 checker rules fail as expected (a test fails if a rule has no test case).
- ✅ Room derivation matches hand-worked areas on 3 hand-made plans: one room (10.44 m²); 1BHK with T-junctions (10.66 / 6.58 / 3.75 m²); L-shaped hall with a wall-thickness change, a free-standing duct and a stub wall (32.46 m², duct 0.25 m²). Moving a wall changes the areas.
- ✅ Migration runner tested with a toy two-step chain; every sample of every version loads.
- ✅ 75 tests, type check, lint, format and engine purity all green.

**Dependency added.** `zod` 4.6.7 (MIT), named in `CLAUDE.md` and the PRD for this prompt.

**Open issues.**
- Open-plan rooms without a wall between them are measured as one area, with a warning (D-13, TASKS follow-up).
- Columns don't reduce room areas yet; wall stubs with a free end are ignored.
- Room messages use metres; ft-in display comes with the UI.

---

## P1.2 — DXF import · part A of 2 · 2026-11-06 (in progress)

**Founder answers (🛑).** One importer for both browser uploads and bulk import; its low-level reader copied from CADCraft (D-16). Sample DXFs and layer names: not yet provided, so the prompt is split:
- **Part A (done):** reading the raw contents of any DXF file.
- **Part B (waiting):** recognising walls, rooms, doors/windows and stairs, the conversion report, previews and the bulk runner. These depend on how the founder's drawings are layered.

**What was built (part A).** A reader that turns a DXF file into its list of entries, for both text and binary DXF, including old drawings in non-English character sets (Windows, DOS, Japanese, Chinese, Korean). Damaged files give a plain-language error instead of crashing. Oversized files are refused before memory fills up. A writer for text DXF is included for P1.3.

**Files.**
- New: `engine/dxf/{tags,codepage}.ts`, `engine/dxf/text-decoder.d.ts`, `engine/dxf/{tags,codepage}.test.ts`.
- Docs: `THIRD_PARTY_NOTICES.md` (CADCraft MIT notice), `DECISIONS.md` (D-15, D-16), `ARCHITECTURE.md`, `TASKS.md`, `MEMORY.md`.
- Also filed for P2.1: `design/reference/README.md`, notes on the founder's two interface references.

**Checks.** 29 ported tests (25 for the reader/writer, 4 for code pages; most cover several cases each) pass, including CADCraft's independent byte fixtures. 104 tests total; type check, lint, format and engine purity green.

**Open issues.**
- Part B blocked on sample DXFs + layer names.
- Writing source with `\u` escapes once produced invisible characters (caught and fixed; see the lint run). No effect on behaviour.

---

## P1.2 — DXF import · part B · 2026-11-06

**Founder decision.** No sample drawings yet: "build without it for now, I'll share later". So the importer was built to be tuned by data, tested on synthetic drawings in drafting style, and the sample-based acceptance stays open.

**What was built.** The importer turns a DXF drawing into a plan:
- **Walls** come from pairs of parallel wall lines.
- **Doors, windows and ventilators** come from the gaps between wall pieces, matched to door blocks and window or ventilator lines.
- **Rooms** come from their name labels: "BED ROOM", "M. BED", "DINNING", "TOILET / W.C." and so on.
- **Stairs, columns and the plot** are read from their own layers.

Each drawing gets three outputs:
- a **report** in plain words: what was found, what was guessed (check these), what failed and why;
- a **preview picture**, the imported plan drawn over the original lines;
- the **plan file**.

The bulk runner does this for a whole folder and writes a summary table.

**Files.**
- New: `engine/dxf/{drawing,mapping,walls,import,report,test-fixtures}.ts`, `engine/dxf/import-mapping.default.json`, `engine/render/svg.ts`, tests beside each, `tools/bulk-import.ts`, `tools/write-dxf-fixtures.ts`.
- Changed: `engine/geometry/planar.ts` and `engine/rooms/derive.ts` (1 mm join tolerance, D-17), `engine/index.ts`, `package.json` (`import`, `fixtures`).
- Docs: `DECISIONS.md` (D-17, D-18), `ARCHITECTURE.md`, `INTEGRATION.md`, `README.md`, `TASKS.md`.

**How to run.** `npm run fixtures` then `npm run import`; open `data/converted/SUMMARY.md` and the `.preview.svg` files. Your own drawings go in `data/raw/samples/`.

**Acceptance checks.**
- ✅ The synthetic drawings convert exactly. Sample B was redrawn two ways: millimetres with lines and the unit in the header, and inches with polylines, all inside one block, with no unit in the header. Both give the same 6 walls (4 external, 2 internal) at the right places and thicknesses; 3 doors, 1 window and 1 ventilator on the right walls; rooms of 10.66 / 6.58 / 3.75 m², the hand-worked areas; the plot, 4 columns and the stair. No plan-check issues.
- ✅ Reports list issues honestly. Tests cover a non-DXF file, a drawing with no walls, walls on an unknown layer (found, and reported as guessed), an unknown room label (reported as failed, with the unnamed area counted), and the defaults marked "assumed".
- ⏳ **Open:** "All sample files convert; founder visually confirms previews match" waits for the founder's drawings.
- ✅ 131 tests; type check, lint, format and engine purity green.

**Open issues.** Listed in TASKS → small follow-ups (several floors on one sheet, curved walls, single-line walls, door swing, facing). The importer's behaviour is set by the mapping file, so most fixes for real drawings will be data edits.

---

## P1.3 — DXF export (CAD Builder v0) · 2026-11-06

**What was built.** Any plan can now be saved as a DXF that AutoCAD opens:
- **Units and layers:** millimetres, with each kind of object on its own standard layer: `A-WALL`, `A-WALL-INT`, `A-DOOR`, `A-GLAZ`, `A-FLOR-STRS`, `A-AREA-IDEN`, `A-ANNO-DIMS`, `A-ANNO-TEXT`, `A-SITE-BNDY`, `A-SITE-SETB`, plus parapet, compound-wall and column layers. Each layer has its colour, line weight and line type.
- **Walls** are one joined outline per layer, with no seams at corners and gaps at doors and windows.
- **Openings** use door swings, window and ventilator symbols, and plain-opening marks.
- **Rooms** get their name and area. Stairs get treads and an UP/DN mark, plus columns, the plot boundary and the setback line.

Before a file is handed over, PlanCraft reads it back. If any wall length, opening, room, stair or column is missing, the export is refused and the message says what's missing.

**Files.**
- New: `engine/dxf/export.ts`, `engine/dxf/export-layers.default.json`, `engine/dxf/r2000-template.ts` (generated), `engine/geometry/union.ts`, `engine/schema/sides.ts`, tests beside each; `tools/make_dxf_template.py`, `tools/export-samples.ts`, `tools/test_exports.py`, `tools/pytest.ini`.
- Changed: importer (D-21), `engine/geometry/planar.ts` (`halfEdges`), `engine/index.ts`, `package.json` (`test:dxf`), `.gitignore` (`tools/.venv`).
- Docs: `DECISIONS.md` (D-19…D-21), `ARCHITECTURE.md`, `INTEGRATION.md`, `README.md`, `THIRD_PARTY_NOTICES.md`, `TASKS.md`.

**How to run / test.** `npm run check`; `npm run test:dxf` (after the one-time Python setup in README).

**Acceptance checks.**
- ✅ Round trip: DXF → plan → DXF → plan gives the same plan. Walls, thicknesses and types, opening positions and widths, room types and names, stairs, columns and plot all match. Room areas are identical.
- ✅ All three sample plans export, read back identical and pass the read-back check. A plan with a room that can't be drawn is refused with "store rooms: 1 in the plan, 0 in the file."
- ✅ ezdxf: every export loads in its strict reader with **0 audit errors and 0 fixes**, is AutoCAD 2000 in mm, and has the standard layers. That's 5 pytest checks.
- ⏳ "Opens in AutoCAD/LibreCAD with correct layers": needs the founder to open one file; ezdxf is the stand-in until then.
- ✅ 140 tests; type check, lint, format and engine purity green.

**Open issues.** Dimensions aren't drawn yet (P7.2). Chajjas, lofts and fixtures aren't exported yet. An independent picture of the DXF would need one more Python package (Pillow); skipped for now.

---

## P1.4 — Batch import + Plan Library index · 2026-11-06

**What was built.** Converted drawings now go into a **Plan Library**. Each plan is saved with tags:
- plot size in feet and metres (e.g. "30 × 40 ft");
- facing, BHK, floors;
- built-up area (inside the outer face of the walls) and carpet area (sum of rooms);
- Vastu zones, with notes such as "Kitchen in the south-east: a usual Vastu placement".

Every tag says how it was obtained: measured, inferred or assumed. The founder reviews the tags in a spreadsheet (`data/library/tag-review.csv`) and corrects facing, BHK, floors or Vastu, or types "yes" to confirm a row. Corrections go back into the plans and survive a re-import. Storage goes through a swappable "document store" (PRD §3.4), so a database can replace the local files later.

**Files.** New: `engine/library/{tags,library}.ts` + tests, `engine/geometry/wall-outlines.ts` (moved out of the exporter), `engine/golden/README.md`, `tools/{fs-store,library-build,library-review}.ts`. Changed: `engine/index.ts`, `package.json` (`library`, `library:review`). Docs: `DECISIONS.md` (D-22), `ARCHITECTURE.md`, `INTEGRATION.md`, `SCHEMA-CHANGELOG.md`, `README.md`, `TASKS.md`.

**How to run.** `npm run import`, then `npm run library`. Edit `data/library/tag-review.csv`, then `npm run library:review`.

**Acceptance checks.**
- ✅ The pipeline works end to end on the synthetic drawings: 2 of 2 converted (100%), tagged, stored, review CSV written, review applied.
- ✅ Tags are hand-checked on the samples: built-up 13.66 / 26.35 / 39.15 m², carpet 10.44 / 20.99 m², "30 × 40 ft" for a 914.4 × 1219.2 cm plot. Assumed inputs stay "assumed".
- ✅ The review flow is tested: corrections and confirmations apply, survive re-import, and a row with a bad value is rejected whole.
- ⏳ 🛑 "≥90% of plans convert at least partially; tags reviewed by founder": waits for the founder's drawings.
- ✅ 149 tests; type check, lint, format, engine purity and the ezdxf checks green.

---

## End of Phase 1 — Plan data foundation · 2026-11-06

**Phase result.** The engine can:
- hold a plan in a versioned format;
- check it and measure its rooms;
- read architects' DXF drawings, with a report and preview, built without samples so far;
- write clean layered DXF that reads back exactly;
- keep a tagged library with a spreadsheet review.

**Waiting on the founder.** Sample DXFs (P1.2 acceptance); opening one export in AutoCAD (P1.3); the tag review of real plans (P1.4). The existing editor code is still to come.

**🧠 Fine-tune gates (PRD §6).**
- **FT-0** (optional practice run) is open from now. It needs the ~200 plans in the library: run `npm run import && npm run library` on them, then the practice JSONL export (P8.2-lite, guide §2.2).
- **Library progress toward FT-1:** **0 / 1,000** original plans. Only 2 synthetic test plans are in the library, and they don't count.

**Integration kit.** `INTEGRATION.md`, `SCHEMA-CHANGELOG.md` and `engine/golden/README.md` updated.

---

## P2.1 — Founder interface screenshots → DESIGN.md · 2026-11-06 (awaiting approval)

**Founder input (🛑).**
- Answers: both themes, light first; blueprint blue as the only accent; no logo yet; nothing to avoid (D-23).
- Seven more references, saved into `design/reference/` as files with neutral names; the first two were described in its README.
- PRD addendum A1 (3D, renders, sheets) adopted (D-25).

**What was built.**
- **The design system** (`design/DESIGN.md`): colour tokens for light and dark, type, spacing, corner radii, the drafting details (corner marks, dot grid), icons, the editor layout for P2.2, and a spec for every component.
- **In code** (`frontend/src`): CSS variables, our own React components, our own icons; no outside UI library.
- **A style sheet page** at http://localhost:5173/styleguide.html showing every token and component in both themes. Its drawing-area section is drawn by the engine running in the browser.

**Files.** New: `design/DESIGN.md`, `frontend/src/design/{tokens,ui}.css`, `frontend/src/ui/{components,icons}.tsx`, `frontend/src/styleguide/*`, `frontend/styleguide.html`, `PRD-ADDENDUM-3D-PRESENTATION.md`. Changed: `frontend/vite.config.ts` (two pages), `frontend/src/main.tsx`, `CLAUDE.md` (addendum line), `.gitignore` (reference images), `design/reference/README.md`. Docs: `DECISIONS.md` (D-24, D-25), `ARCHITECTURE.md`, `README.md`, `TASKS.md`.

**Checks.**
- ✅ The style sheet renders in light and dark with no console errors; text contrast is AA in both themes.
- ✅ The production build includes the page.
- ✅ 149 tests; type check, lint and format green.
- ⏳ 🛑 **Founder approves the style sheet page**, and says yes or no to adding the Geist fonts.

**2026-11-06: P2.1 approved.**
- The founder approved the style sheet; Geist and Geist Mono are now bundled (D-26). P2.1 is done.
- Addendum A2 (Vault, versions & branches, multiplayer, amendments M1–M12) is filed and queued (D-27). Four Vault references are saved in `design/reference-vault/`.

---

## A2 amendments M1 + M3 → plan format 1.1.0 · 2026-11-06

**What changed, in plain words.**
- **Stored by id:** a plan's walls, rooms, doors and windows, stairs, columns and fixtures are now filed under their own id, like named drawers, instead of in a numbered list. When two people (or two design options) change different objects, nothing clashes. That's the groundwork for versions, branches and multi-user editing.
- **Floor order:** floors carry an `order` field, so a floor can be inserted between two others without renumbering.
- **Separators:** a new **separator** line marks a room boundary that isn't a wall, for example between living and dining in an open plan. Each side becomes its own room with its own area. Separators are saved in DXF on a dashed layer and read back.
- **Old plans upgrade automatically.** If an old plan reuses an id, the upgrade stops and says so rather than silently dropping one of the two objects.

**Files.**
- New: `engine/schema/{collections,migrations}.ts` (+ tests), `engine/samples/1.1.0/` (A–C upgraded, new D).
- Changed: schema, checker (2 new rules), room derivation, importer and exporter (separators), outlines, tags, preview, style sheet page, tests, JSON Schema, `SCHEMA-CHANGELOG.md`, `INTEGRATION.md`, `ARCHITECTURE.md`, `DECISIONS.md` (D-29), golden list.

**Checks.**
- ✅ Sample D splits into living 8.99 / dining 9.21 / kitchen 10.66 m², the hand-worked figures. Without the separator, living and dining share one area, with a warning.
- ✅ All 1.0.0 samples still load through the upgrade.
- ✅ All four samples export to DXF and read back identical, separators included; ezdxf clean (6 checks).
- ✅ 163 tests; type check, lint, format green.

---

## P1.1b — Geometry kernel (A2 M4) · 2026-11-06

**What changed, in plain words.**
- **Joins:** room outlines now cope with every kind of wall join: corners, T and X junctions, several walls meeting at one point, walls crossing at a very shallow angle, walls overlapping in line, and diagonal walls.
- **Gaps:** a gap of up to **2 cm** between a wall end and another wall now closes (before: 1 mm). Wider gaps are still reported.
- **Same walls, same rooms:** the result is identical whatever order the walls are listed in. A random stress test found this was not always true (a short wall pulled onto a diagonal wall that was itself being adjusted); it is fixed and now tested on every run.

**Files.** `engine/geometry/planar.ts` (arrangement), `engine/rooms/derive.ts` (2 cm tolerance, outlines start at the lowest-left corner), `engine/geometry/kernel.test.ts` (new), tests and docs (`DECISIONS.md` D-30, `ARCHITECTURE.md`, golden list).

**Checks.**
- ✅ Join cases: four rooms of 8.41 m² from a plus of walls; five walls at one point; a shallow crossing; overlapping walls use the thicker one; 1.5 and 2 cm gaps close, 2.5 cm stays open; a diagonal T a hair off its wall joins.
- ✅ **1,000 random layouts** (94% of their rooms fully enclosed): no crash, every room outline a simple shape with its label inside, the same rooms when the walls are shuffled, the plan check and wall outlines never fail.
- ✅ 170 tests; all checks green.

---

## P14.1 — Vault design → DESIGN.md + component page · 2026-11-06 (awaiting approval)

**Founder input (🛑, D-28).** References in `design/reference-vault/`; the Vault opens dark; six folder colours; navigation Home, Ask AI, Plan Library, Templates.

**What was built.** A component page for the home dashboard at http://localhost:5173/vault.html:
- **A full dashboard mock-up:** workspace switcher, search with ⌘K, navigation, the projects tree with counts, breadcrumb, **+ New**, folders, and a files table with owner, edit time, branches and status.
- **The three folder styles:** glass folders whose papers show real plan drawings, colour folders with a version badge, and archive folders with a zip pull and size badge.
- **All six colours**, and every state: hover (the papers lift), selected, drag-over (the front tilts open), empty, and the no-blur fallback.
- **The ⌘K palette.**
- **Light and dark.**

`design/DESIGN.md` gained a Vault section with the exact measurements and colours.

**Files.** New: `frontend/vault.html`, `frontend/src/vault/{VaultPage.tsx,demo.ts,vault.css,main.tsx}`, `frontend/src/ui/PlanThumbnail.tsx`, `design/reference-vault/README.md`. Changed: `frontend/src/ui/icons.tsx`, `frontend/vite.config.ts`, `design/DESIGN.md`, docs (`DECISIONS.md` D-31, `ARCHITECTURE.md`, `README.md`, `TASKS.md`).

**Checks.**
- ✅ Renders in dark and light with no errors.
- ✅ The production build includes the page.
- ✅ 170 tests; all checks green.
- ⏳ 🛑 **Founder approves the Vault component page.** P2.2 follows.

**2026-11-06: P14.1 approved** (D-32). P2.2 next.

---

**2026-11-06: end of session 1 (context full).** P2.2 is part-done: the editor shell code is written and all checks are green (174 tests), but it hasn't been checked in the browser and isn't recorded yet. The next session starts from `HANDOFF.md`.

---

## P2.2 — App shell · 2026-11-06 (session 2)

**What was built, in plain words.** The main editor screen at http://localhost:5173/:
- **Top bar:** Home (will open the Vault), the file name you can rename, the branch chip (`main`, active from Phase 15), "Saved", the level and plot size, then chat, issues (with a count), light/dark, your avatar and **Export DXF**, which saves an AutoCAD file straight from the editor.
- **Left:** a narrow rail switches the panel between **Rooms** (name, type, area), **Layers** (show/hide plot line, rooms, walls, doors and windows, separators, stairs, columns, labels) and **Library** (fills in with P14.3/P6.1).
- **Centre:** the plan on the dot grid. Click a room (or pick it in the list) and it turns blueprint blue with corner grips; a pill says what is selected. Tools sit in the floating toolbar at the bottom (they start working in P2.4–P2.5). A scale bar at the bottom right.
- **Right:** Properties (with where each fact came from: inferred, assumed), Issues, and Metrics (built-up, carpet, plot, efficiency).
- **Chat** opens as its own column; typing connects in P4.1.
- **Bottom:** metres or feet-inches (changes every number on screen), snap switches, level, engine version.
- **Smaller screens:** under 1100 px wide, panels slide over the drawing one at a time and start closed, so the plan is always visible first. Works down to phone width.

**What the browser check found and fixed.**
- Outside wall corners had small white notches: walls are now drawn as one joined outline computed by the engine, the same shapes the DXF export uses.
- The scale bar was a fixed picture labelled "2 m" whatever the drawing size. It now measures the drawing (checked: 1 m = 82.8 px on screen, bar 82.8 px).
- Room names and the 6 px corner grips shrank when the canvas got narrow: they now stay the same size on screen.
- The external stair was cut off (the view fitted the walls only): the view now fits the plot, stairs and columns, and draws the plot boundary as a dashed line.
- Columns were drawn in the error red: now solid ink with a light cross, readable on a wall corner and on their own.
- On a tablet or phone both side panels opened at once and hid the plan; the top bar wrapped onto two lines; the scale bar ran into the toolbar; the toolbar ran off a phone screen; the Issues "all clear" message ran into its explanation. All fixed.
- The download link is released a moment after the click, so Safari and Firefox finish saving.
- The style sheet page now draws its canvas sample with the same component as the editor.

**Files.** New: `frontend/src/editor/{Editor.tsx,state.ts,state.test.ts,editor.css}`, `frontend/src/ui/{PlanView.tsx,format.ts,format.test.ts}`, `engine/geometry/wall-outlines.test.ts`. Changed: `engine/geometry/wall-outlines.ts` + `engine/index.ts` (`wallOutlinesCm`), `frontend/src/App.tsx`, `frontend/src/ui/components.tsx` (`ScaleBar` width), `frontend/src/design/ui.css`, `frontend/src/styleguide/{StyleGuide.tsx,styleguide.css}`, `design/DESIGN.md` (editor layout), docs (`DECISIONS.md` D-33, `ARCHITECTURE.md`, `INTEGRATION.md`, `TASKS.md`, `HANDOFF.md`, memory v26).

**Checks (PRD ✅: "Responsive shell renders; panels collapse/expand; matches approved style").**
- ✅ Renders at 1440 × 900, 800 × 700 and 375 × 812, light and dark; no errors from the app.
- ✅ Every panel opens, switches and closes from the rail, the top bar and its close button; on narrow screens only one at a time.
- ✅ Units switch everywhere; room selection from canvas and list; layers hide and show; Export DXF produces a 29 KB AutoCAD 2000 file with the standard layers (checked in the page without saving it).
- ✅ Matches `design/DESIGN.md` (updated with the details settled here).
- ✅ 179 tests; all checks green.

**Not in P2.2 (by design).** Zoom and pan, door swings and window glass lines (P2.3); editing (P2.4); the drawing tools (P2.5); chat (P4.1); opening files from the Vault (P14.3).

---

## P2.3 — Canvas (+ A2 M6 spatial index) · 2026-11-06 (session 2)

**What was built, in plain words.**
- **Plans open from the Plan Library.** The editor asks the library (through the same storage door every host will use, `DocumentStore`) for its list and opens a plan; the Library panel lists them and each plan has its own link (`…/#synthetic-grid-4x3-typical`). If the library is empty or unreachable, the built-in sample opens with a note.
- **Move around:** mouse wheel or trackpad pinch zooms around the cursor, as in AutoCAD; drag pans (left drag for now, middle drag, or hold Space). `+` / `−` zoom, `0` fits the plan, arrow keys pan. The status bar shows the zoom (100% = 1 px per cm) with − and + buttons; click the percentage to fit.
- **Click anything:** rooms, walls, doors, windows, columns, stairs and separators can be selected; the right panel shows their facts (wall type, thickness, length, rooms on each side; door width, swing, host wall; and so on) with "assumed" / "inferred" tags where a value was guessed. Hovering outlines what a click would pick.
- **Snapping:** with a drawing tool (W, R, D …) the cursor snaps to wall ends, midpoints and the grid, shows a marker (square = end, triangle = mid, + = grid), and the status bar shows the position in metres or feet-inches. Perpendicular snapping is ready and starts working when lines are drawn (P2.5).
- **The drawing is richer:** door leaves and swings, window and ventilator lines, stair treads with UP/DN — the same symbols the DXF export writes, because both now come from one place in the engine.
- **The dot grid follows the zoom** and always means a round length (e.g. 20 cm), which is also the snap grid.

**Speed (PRD: "60 fps pan/zoom on a typical plan").** Two generated plans went through the real path (exported to DXF, imported, added to the library): a typical 12-room plan and a 120-room stress plan (10× typical). Work per frame, measured in the browser (time to update and lay out the drawing; the browser pane was hidden, so the final paint could not be timed):
- Typical plan: pan ~1 ms, zoom ~1.2 ms.
- Stress plan: pan median 2.2 ms (worst 4.7 ms), zoom median 5 ms (worst 14.6 ms), including ~1.3 ms of measuring overhead.
A frame at 60 fps allows 16.7 ms. Two improvements came out of measuring: labels redraw on zoom without redrawing walls, and the room list no longer redraws while panning.
Engine on the stress plan: plan check 14 ms, drawing 27 ms and index 17 ms (once per plan change); a click is answered in ~3 µs.

**Found and fixed on the way.** The DXF importer counted 30 bedrooms on the stress plan and wrote "30 BHK", which the plan format (max 20) then rejected; it now records 20 and says so in the report (D-35).

**Files.** Engine: new `spatial/rtree.ts`, `view/drawing.ts`, `view/pick.ts`, `samples/grid-plan.ts` (+ tests), `dxf/export.ts` (shared stair/column geometry), `dxf/import.ts` (BHK cap), `index.ts`. Frontend: new `editor/Canvas.tsx`, `editor/Properties.tsx`, `library/fetch-store.ts`, `ui/view.ts` (+ test); rewritten `ui/PlanView.tsx`, `editor/Editor.tsx`; `editor/state.ts` (any object can be selected), `ui/format.ts` (`gridStep`), `editor/editor.css`, `styleguide/StyleGuide.tsx`, `vite.config.ts` (dev route for the library). Tools: `write-dxf-fixtures.ts` (two grid plans). Docs: `design/DESIGN.md`, `DECISIONS.md` D-34, D-35, `ARCHITECTURE.md`, `INTEGRATION.md`, `TASKS.md`, `HANDOFF.md`, memory v27.

**Checks.**
- ✅ A library plan loads through `DocumentStore` and renders correctly (4 library plans opened; door, wall and room selection, zoom 83% → 151%, pan, fit, snapping to a wall end at x 4.50 m · y 4.00 m checked in the browser).
- ✅ Pan/zoom work per frame well under 16.7 ms, even on a plan 10× typical (numbers above). ⏳ Screen painting not timed: **founder** to pan and zoom the stress plan once and confirm it feels smooth.
- ✅ 198 tests (R-tree against brute force over 2,000 inserts and 1,200 removals; door swing directions; hit-test priorities; snaps; view maths; 120-room DXF round trip); all checks green; production build OK.

**Not in P2.3 (by design).** Drawing and moving things (P2.4–P2.5); M6's incremental recomputation (comes with P2.4's commands); marquee selection (P2.5 decides what left-drag does).

**2026-11-06: founder confirmed pan/zoom on the stress plan is smooth.** P2.3 accepted. P14.2 next.

---

## P14.2 — Vault storage (+ A2 M10) · 2026-11-06 (session 2)

**What was built, in plain words.** The storage behind the home dashboard (the screen itself is P14.3):
- **Folders and files** in a workspace: create, rename, move (a folder can't go inside itself), duplicate (a folder with everything in it), star, folder colour (the six colours), file status (Draft / In review / Approved), archive (stays visible with the archive look, leaves "Recent").
- **Trash:** anything can go to Trash with its contents and come back; if its old folder is gone, it comes back at the top level. Only things in Trash can be deleted for ever; things older than 30 days can be cleared automatically (switched on in P14.5).
- **Search** by any words of the name, with filters for kind, status, owner, BHK, facing, starred and folder; **Recent** files.
- **Thumbnails:** a small drawing of each plan (rooms tinted, walls in ink, door and window lines). After a plan is saved, its thumbnail is redrawn the next time it is shown.
- **`.plancraft` files (A2 M10):** a whole file exported as one package (the plan, its thumbnail, its version list and a label) and imported into any folder, also by another computer. It is an ordinary zip, so it opens in any zip program; and a package someone re-zipped still imports.
- **Your local vault** lives in `data/vault/`. `npm run vault:seed` filled it with a demo workspace: 8 folders in all six colours (Residential › 30×40 plots › East facing, Villas, Commercial, Client boards, Rule packs, an archived "Archive 2025") and three sample plans in different statuses.
- Every new folder and file gets a ULID (unique across people and computers, A2 M2); the vault never reads the clock itself, so its tests always give the same result.

**Files.** Engine: new `vault/` (`vault.ts`, `records.ts`, `storage.ts`, `zip.ts`, `inflate.ts`, `demo.ts`, tests), `render/thumbnail.ts`, `ids.ts` (+ test), `samples/blank-plan.ts`, `version.ts`; `schema/json-schema.ts` (+ two JSON Schemas), `index.ts`. Tools: `fs-vault-storage.ts` (+ test), `vault-seed.ts`; `package.json` (`vault:seed`), `vitest.config.ts` (tools tests). Docs: `SCHEMA-CHANGELOG.md`, `DECISIONS.md` D-36, D-37, `ARCHITECTURE.md`, `INTEGRATION.md`, `TASKS.md`, `HANDOFF.md`, memory v28.

**Checks (✅ "Create / rename / move / star / archive / trash / restore / search / export / import pass tests; thumbnails update after a plan edit").**
- ✅ Each operation has tests, including the refusals (bad names, bad plans, a folder into itself, editing something in Trash, deleting something not in Trash).
- ✅ Thumbnail: drawn once, reused while the plan is unchanged, redrawn after a save; contains no text or scripts. The three seeded thumbnails checked by eye in the browser.
- ✅ Packages: export → import gives an identical plan in a new file; a package re-zipped with compression imports; an old-format (1.0.0) plan inside is upgraded; non-packages, newer packages and damaged plans are refused with a reason. Our zips open with the system's `unzip`; zips made by the system's `zip` open with ours; the decoder matches zlib at every compression level.
- ✅ Twenty changes started at once all land (operations run one at a time); the disk storage leaves no half-written files.
- ✅ 225 tests; all checks green.

---

## P14.3 — Dashboard screen · 2026-11-06 (session 2, awaiting the founder test)

**What was built, in plain words.** http://localhost:5173/ now opens the **Vault** (dark), your home dashboard:
- **Left:** workspace, search (⌘K), Home · Ask AI · Plan Library · Templates, the **Projects** tree with file counts (+ for a new folder), and Starred · Trash · Help at the bottom.
- **Top:** where you are (Projects › Residential › …, each step clickable), search, light/dark, **+ New** (New plan · New folder · Import DXF… · Import .plancraft…).
- **Folders** as the approved folder tiles: glass folders show the three latest plans on their papers; colour folders their file count; archived folders their size. **Files** as cards with thumbnails (grid) or in a sortable table (list); your choice is remembered.
- **Right-click** anything: open, rename, duplicate, move to…, star, status (Draft / In review / Approved), export .plancraft, folder colour, archive, move to Trash. Several items at once with ⌘/Shift-click.
- **Drag** files and folders onto a folder, the tree or the breadcrumb to move them. **Drop** .dxf or .plancraft files onto a folder to import them.
- **Import DXF:** after converting, a small report (walls, rooms, openings, guesses to check) with **Open in editor**. In the editor, **Home** brings you back to the file's folder.
- **Plan Library:** the library plans with thumbnails; **Use as starting point** copies one into a folder you choose.
- **Starred** and **Trash** (Restore, Delete for ever with a warning). Ask AI and Templates say when they arrive.
- Keys: ⌘K, N, ⇧N, ↵, F2, Del, ⌘A, Esc (listed under Help).

**What the browser check covered** (1440 × 900 and narrow, dark and light): create a folder (with colour) → open it → Import DXF (the 12-room plan: "Converted · 9 walls · 12 rooms · 20 openings · 2 guesses to check") → Open in editor → Home back to the folder; star, rename, drag the file onto another folder in the tree, ⌘K search and open, Plan Library → Use as starting point into a chosen folder, list view and sorting, Move to Trash → Trash → Restore. Fixed on the way: moving or restoring a file no longer shows it as "edited just now"; thumbnails not yet drawn are no longer requested first.

**Files.** Frontend: new `src/app/route.ts` (+ test), `src/vault/{Dashboard,items,dialogs,folder-art}.tsx`, `src/vault/{client,http-storage,listing}.ts` (+ `listing.test.ts`), `src/vault/dashboard.css`, `src/ui/Menu.tsx`; changed `src/App.tsx`, `src/editor/Editor.tsx` (opens vault files, Home), `src/vault/VaultPage.tsx` (shared art), `src/ui/icons.tsx` (7 icons), `src/design/ui.css` (menu), `vite.config.ts` (vault storage route). Engine: `vault/vault.ts` (moving keeps edit time; thumbnail read order) + test. Docs: `design/DESIGN.md` (dashboard behaviour, Menu, File card, Empty state), `DECISIONS.md` D-38, `ARCHITECTURE.md`, `TASKS.md`, `HANDOFF.md`, memory v29.

**Checks.**
- ✅ 231 tests (routes, listing helpers, vault rules); all checks green; production build OK.
- ⏳ 🛑 **Founder test (the PRD acceptance):** create a folder, import a DXF into it and open it in the editor **without help**.

**2026-11-06: P14.3 accepted.** The founder opened the Vault, created a folder and opened a plan in the editor without help; the DXF import step was skipped (no drawing at hand) and was checked by Claude in the browser. P14.4 next. Parallel sessions start from here: see `SESSIONS.md`.

---

## P14.4 — Editor ⇄ Vault flow (+ A2 M12) · 2026-11-06 (session 2)

**What was built, in plain words.**
- **No Save button.** Every change in a plan is kept in your browser at once and saved to the Vault a moment later (under a second after you stop, at most 5 seconds while you keep working). The top bar says **Saved**, **Saving…**, **Offline** (it keeps trying, and saves as soon as the connection is back) or **Changed elsewhere**.
- **Nothing is lost on refresh or crash.** If the browser closes before a save, the change is recovered the next time you open the file, and a notice says so.
- **Two tabs never overwrite each other.** If the same file was saved from another tab or window, your unsaved changes are kept as a separate copy "… (unsaved changes)" beside the file, and a notice tells you its name.
- **Automatic versions:** after every 30 minutes of editing (a long pause counts as 5 minutes) the Vault keeps an unnamed version with a copy of the plan; named versions ("Client review 1") are ready for the version history screen (P15.1).
- **Rename from the editor:** type in the file name at the top (Enter saves, Esc cancels).
- **Home** returns to the file's folder, scrolled where you left it, with that file selected.
- Plans can't be edited by hand until commands arrive (P2.4), so the saving was exercised with test changes made through a development-only hook; the same path will carry real edits.

**Checked in the browser** (on the real local vault, which upgraded itself to format 2 on its first save): change → "Saving…" → "Saved" (revision 1 → 2, plan stored, draft cleared); Home → back in "Projects › Residential › 30×40 plots" with the file selected → reopen shows the change; **change, then reload before it saves** → recovered and saved; **vault unreachable** → "Offline" with a visible explanation, saved once back online; **another tab saved first** → "Changed elsewhere", and on reopening the other save is intact and the change is a copy beside it; rename with Enter / Esc / leaving the field; scroll position kept.
**Fixed on the way:** React running effects twice made a second saver start from an old revision (a false "Changed elsewhere") and saved the conflict copy twice; Escape on the file name would have saved the cancelled name; drafts that hit a conflict could have been applied over the other tab's save.
**UX quick pass** (`plancraft-ux-refine` §9, the new standing rule, on the changed parts): no new colours or sizes; offline/conflict explanations and rename errors now show in the visible notice (not only a hover tooltip); the file name's tooltip shows the full name; Enter/Esc work on the name. Noted for the PI prompts / P14 full audit: ★ and ✓ are text characters in the Vault (A3 says icons come from the `Icon` component).
**Not finished:** my two test copies "Open plan, living + dining (unsaved changes)" are in the local vault's **Trash**; emptying Trash (deleting for ever) was blocked by the session's safety rules, so the founder can empty it or leave it.

**Files.** Engine: `vault/vault.ts` (`saveDocument` with `baseRev`, `VaultConflictError`, editing time, auto-versions, `createVersion`, `loadVersion`, version copies removed with the file), `vault/records.ts` (format 2 + upgrade), tests; `index.ts`. Frontend: new `src/editor/autosave.ts` (+ test), `src/editor/useFileSave.ts`; `src/editor/Editor.tsx` (draft recovery, conflict copy, save state, rename, notices), `src/vault/Dashboard.tsx` (scroll and selection on return), `src/vault/listing.test.ts`. Tools: `generate-json-schema.ts` writes Prettier-formatted files. Docs: `DECISIONS.md` D-39, `SCHEMA-CHANGELOG.md` (vault index 2), `design/DESIGN.md` (save states, notices), `ARCHITECTURE.md`, `INTEGRATION.md`, `TASKS.md`, `HANDOFF.md`, `SESSIONS.md`, memory v30.

**Checks.** ✅ "Edit → Home → reopen shows the latest state; nothing lost on refresh or crash" (above). ✅ 243 tests (autosave timing, retries, offline, conflict, drafts; vault conflicts, editing time and versions, format upgrade); all checks green; production build OK.

---

## P14.5 — Starred, Shared, Trash, search, shortcuts · 2026-11-06 (session 2) — and the end of Phase 14

**What was built, in plain words.**
- **Search page:** type part of a name and/or pick Kind, BHK, Facing, Status and Owner; results update as you type and show in grid or list. From ⌘K: "See all results for …" or "Search with filters". The search is in the page address, so Back works and a search can be linked.
- **Grid and list everywhere:** folders, Search, Starred, Trash and the Plan Library all have the same switch and sort.
- **Trash:** things left in Trash for 30 days are deleted for ever when you open the Vault; each item shows how many days it has left. Select items to Restore them or Delete them for ever (with a warning) using buttons at the top, or right-click. Enter doesn't open things in Trash, and Delete there asks before deleting for ever.
- **Shared with me** stays hidden until accounts exist (P10.1). The shortcuts (N, ⇧N, F2, Del, ↵, ⌘K, ⌘A, Esc, and Space) are listed under Help.

**Checked in the browser:** searches by words ("east" → the East facing folder and the 1BHK), by BHK, status and facing, words + status, and nothing found; typing in the search box and choosing from a filter; Starred and Trash in grid and list; Trash selection buttons, days left, Enter doing nothing, the right-click menu, Restore (and back to Trash); the Plan Library in grid and list; Help.

**End of Phase 14 (CLAUDE.md rule 4).**
- **UX full audit** (`design/audits/2026-11-06-vault-phase14.md`): 7 fixes made: list rows can now be used with the keyboard (they couldn't at all), Enter on a focused card opened the wrong item, dialogs and ⌘K now keep and return focus, ⌘K announces the highlighted result, sort targets 24 px, the "Search…" hint is readable, long names show in full on hover. No horizontal scrolling at 200% zoom. 🛑 **Your decision:** much of the Vault's small print is 9–12 px, below the 13 px the skill asks for a senior draftsman (raise it, add a UI-scale setting, or both). Four smaller items go to the design-system session.
- **Golden test plans** (`engine/golden/README.md`): grid plans, opening symbols, demo Vault and Vault behaviour added.
- **🧠 Fine-tune gates:** FT-0 (optional practice run) still waits for ~200 real plans in the library: there are 4 synthetic ones; FT-1 needs 1,000 original plans (0 so far) and Phase 8. Nothing to run yet.
- **Not green right now:** `npm run check` stops at formatting in files the Docs & UX session is still writing (`design/tokens/*`, `tools/as-built/*`); per `SESSIONS.md` those are left to that session. Everything else (types, lint, 249 tests, my files' formatting) is green.

**Files.** Engine: `vault/vault.ts` (`folderSummaries`) + test. Frontend: `app/route.ts` (search route with filters) + test; `vault/Dashboard.tsx` (Search view, shared grid/list view, Trash actions and menu, auto-delete, ⌘K search entries, Library list, focus fixes, palette ARIA), `vault/items.tsx` (keyboard on rows, cards and tiles; full-name tooltips), `vault/dialogs.tsx` (`useModalFocus`), `vault/dashboard.css` (filter bar, focus ring, 24 px sort targets, readable search hint). Docs: `design/audits/2026-11-06-vault-phase14.md`, `design/DESIGN.md`, `DECISIONS.md` D-40, `INTEGRATION.md`, `engine/golden/README.md`, `TASKS.md`, `HANDOFF.md`, `SESSIONS.md`, memory v31.

**Checks.** ✅ "All views work in grid and list; shortcuts listed in Help." ✅ 249 tests; types and lint green.

---

## Docs & UX index (separate session) · 2026-11-06

**What was done, in plain words.**
- **New specs in the repo:** `PRD-ADDENDUM-A3-ICONS.md` (A3.1, icon system), A2.2 (replaces A2.1: colour-blind-safe diff colours), the skill `.claude/skills/plancraft-ux-refine/SKILL.md` (v1.2) and the icon preview `design/reference-icons/icon-starter-preview.png`. `CLAUDE.md` now lists A3.1 and the skill: quick pass after every `/frontend` prompt, full audit at the end of each UI phase, as-built index before any token migration.
- **Memory file merged** with the founder's chat copy: §0 "Start here" (with repo paths and what is already decided), the A1/A2/A3/skill lines, the chat to-dos (ticked where done) and the chat change-log entries as **c14–c20** (the repo keeps its v-numbers).
- **Founder rule recorded** in `design/DESIGN.md` → Icons: light-theme icon tokens mapped separately (near-black line, very light grey fill, pale accent active fill, darker accent details ≥ 3:1); the PI.3 icon sheet shows both themes before PI.3 is done.
- **As-built style index** (skill §3.6), read-only, no styles changed: `design/tokens/AS-BUILT-INDEX.md` (summary, 🛑 8 decisions, all tables, proposal and mapping), `as-built.json`, `as-built-sheet.html`, `proposed-scales.json`. Tool: `node tools/as-built-scan.ts` (static scan of `frontend/src` + headless-Chrome sample of 7 screens in light and dark; `--static`, `--report`).

**Files.** New: `PRD-ADDENDUM-A3-ICONS.md`, `.claude/skills/plancraft-ux-refine/SKILL.md`, `design/reference-icons/{README.md,icon-starter-preview.png}`, `design/tokens/*`, `tools/as-built-scan.ts`, `tools/as-built/{colour,colour.test,static,runtime,analyse,report}.ts`. Changed: `CLAUDE.md`, `PRD-ADDENDUM-A2-VAULT.md` (A2.2), `text-to-cad-project-memory.md`, `design/DESIGN.md` (Icons note), `SESSIONS.md`.

**Checks.** ✅ `npm run check` green at 22:02 (types, lint, format, 249 tests incl. 5 new colour-maths tests). The index is a snapshot from 21:59; nothing in `frontend/src` changed after it. 🛑 Waiting on the founder's decisions in `AS-BUILT-INDEX.md` before any token migration (skill §3.7).

**Follow-up · token system adopted (DS-01).** The founder answered the as-built decisions ("Approve 1–4, 6, 7; keep 11 px floor; code wins").
- **In plain words:** the app's colours, sizes and spacing now come from one set of named design tokens, in light and dark. Light-theme grey text and the green/orange/red status colours are a touch darker, so they're readable on hover and selected rows. Input fields and the switch have clearer edges. Placeholders are readable. Nothing in the Vault or the style sheet is smaller than 11 px. Small links, the switch, checkbox labels, breadcrumbs and whole input boxes can now be clicked across at least 24 px.
- **How it works:** the tokens are JSON in `design/tokens/` (base → semantic → component). `npm run tokens` (`tools/tokens-build.ts`, no new packages) writes `frontend/src/design/tokens.css` (`--pc-…` variables; the 56 old names still work as aliases), `tokens.ts`, `design/tokens/tokens.html` and `TOKEN-INDEX.md`. Panel tokens for P2.2a were added on that session's request; it is making the editor fixes (`.ed-badge` 11 px, status-bar hit areas) inside P2.2a.
- **Files:** new `design/tokens/{base,semantic,component}/*.json`, `deprecated.json`, `CHANGELOG.md`, `TOKEN-INDEX.md`, `tokens.html`, `tools/tokens-build.ts`, `tools/tokens/{build,build.test,report}.ts`, `frontend/src/design/tokens.ts`. Changed: `frontend/src/design/tokens.css` (now generated), `ui.css` (control border, placeholder, full-height inputs, link/switch/checkbox hit areas), `vault/vault.css` (folder variables moved to tokens, 11 px pill and initials, avatar text token), `vault/dashboard.css` (24 px breadcrumbs), `vault/items.tsx` + `Dashboard.tsx` (avatar colour token), `package.json` (`tokens` script), `design/DESIGN.md`, `DECISIONS.md` (DS-01), memory v32.
- **Checks:** ✅ every old variable resolves to its old value except the 5 approved changes (compared mechanically). ✅ Re-measured in headless Chrome: text below AA on screen 7 → 4 (left: a disabled button, which is exempt; white pill text on glass; the orange folder chip, ×2); targets under 24 px 23 → 11, and the rest are either the editor items P2.2a is fixing or are fixed by hit areas the scanner can't see (checked by hand in the browser: link 24 px, switch 24 px, checkbox label 24 px, inputs fill 30 of 32 px). ✅ `npm run check` green (269 tests incl. 5 new token-build tests).
- **Open:** the orange folder chip (3.6:1) and the white text on glass pills are illustration colours, not part of the approval; 161 raw values remain to migrate (listed in `TOKEN-INDEX.md`); the skill's lint rule (fail CI on raw colours) needs the founder's OK before it is added.

---

## P2.2a — Collapsible side panels (Figma-style) · 2026-11-06 (session 3)

**What was built, in plain words.**
- **Hide and show the panels** to give the drawing the whole width: a button at each end of the top bar (left panel, right panel; the icon shows whether the panel is open), the chat button, **⌘\\** (Ctrl+\\ on Windows) to hide or bring back everything at once (focus mode), **⌘⌥[** and **⌘⌥]** (Ctrl+Alt+[ / ]) for the left and right panel, and the same commands in a new **⌘K command palette** in the editor (it also lists the tools, zoom, units, theme, Export DXF and Go to the Vault).
- **The drawing doesn't move.** When a panel slides away (200 ms; no animation if the computer asks for reduced motion), the plan stays exactly where it was on screen and the canvas simply grows.
- **A small tab on the canvas edge** (24 × 48 px, always visible) brings a hidden panel back. Hidden panels stay hidden: selecting something never opens them.
- **Remembered:** which panels are open (and their widths) is kept in this browser as your preference, not in the plan; it comes back after a reload.
- **Narrow windows** (under 1100 px): panels float over the drawing one at a time; **Esc** or a click outside closes them. On a phone the two side buttons leave the top bar (the edge tabs do their job) so it doesn't overflow.
- **Resizing (the optional part):** drag a side panel's inner edge (240–480 px), double-click it for the usual width, or focus it with Tab and use the arrow keys (Shift for bigger steps, Home/End for narrowest/widest). The drawing stays still while you drag. ⌘K has "Reset panel widths".
- **Keyboard focus:** if the keyboard was inside a panel that hides, it moves to that panel's button in the top bar (on a phone, to its edge tab), so it is never lost.
- **Your icon choice:** the panel icon is a temporary one drawn in our current set; it will be swapped for Phosphor's `sidebar-simple` when the icon prompts PI.1–PI.2 run.
- **Also in this prompt** (approved fixes handed over by the tokens session): the issues badge is 11 px (was 10 px); the status bar's snap buttons, branch chip, zoom value and units switch are 24 px tall targets; the badge and avatar colours come from tokens.

**Checked in the browser** (1440 × 900, 900 × 760, 720 × 450 and 375 × 812; light and dark): the plan's position measured to 0.1 px before, during (transition paused at 60, 90 and 130 ms) and after hiding and showing the left panel, the right panel and focus mode, and while dragging a panel edge: unchanged every time; all three shortcuts (⌘ and Ctrl), ignored while typing in the file name; ⌘⌥[ with the cursor on a room row moves focus to the left toggle; ⌘K "Hide left panel" from inside the panel does the same; edge tabs reopen; state after reload; overlays one at a time, Esc and click outside; reduced motion (the stylesheet's reduced-motion rule applied: no transitions, panels switch at once); no horizontal scroll at 720 or 375 px; no console warnings. The browser pane was hidden during the session, so animation frames were checked by pausing the transitions rather than watching them. An automated browser test suite needs Playwright (🛑 not added; asks the founder).

**UX quick pass (skill §9) on the changed parts.** Tokens only in the new CSS (panel sizes, motion, edge tab from `design/tokens/component/panel.json`; colours, spacing, z-index from semantic tokens); the token lint passes. States: hover, focus ring (inside the edge tab and the resize edge, which sit against the canvas edge), pressed/expanded, dragging. Targets: toggles 32 px, edge tabs 24 × 48. Labels and tooltips with shortcuts on every icon button ("Hide left panel (⌘⌥[)"). Contrast: edge-tab chevron 5.9:1 light / 7.6:1 dark; resize line accent 5.5:1. Keyboard: tab order starts and ends with the panel toggles; Esc closes overlays before it clears the selection; focus never lost. Open items: the resize edge is 8 px wide (keyboard and double-click alternatives exist; no single-click way to set an exact width); the edge tab's outline is the quiet hairline (its chevron carries the contrast).

**Technical notes.** `editor/panels.ts` is the panel store (pure: docked layout, focus-mode memory, narrow overlay, widths; reading/writing `plancraft-editor-panels`; shortcut matching on `event.code`, so Option+[ on a Mac and AltGr layouts behave; `keepStill` view maths). The canvas reports its place in the window from a ResizeObserver inside `flushSync`, so each animation frame is drawn with the corrected view before paint; `PlanView` takes the measured size from its parent. Panels stay in the page while hidden (`inert`, `visibility: hidden` after the slide) so the toggles' `aria-controls` always point at something. D-41.

**Files.** New: `frontend/src/editor/panels.ts` + `panels.test.ts`, `Palette.tsx`, `ResizeHandle.tsx`. Changed: `editor/state.ts` + test (panels inside the shell state; no more `narrow` on actions), `editor/Editor.tsx` (toggles, edge tabs, palette, shortcuts, overlays, resize, focus), `editor/Canvas.tsx` (`onLayout`), `editor/editor.css`, `ui/PlanView.tsx` (optional `size` prop), `ui/icons.tsx` (`Sidebar`, `SidebarHidden`). Docs: `design/DESIGN.md` (editor layout), `DECISIONS.md` D-41, `ARCHITECTURE.md`, `TASKS.md`, `HANDOFF.md`, `SESSIONS.md`, `docs/design/P2.2a-collapsible-panels.md` (status), memory v33.

**Checks.** ✅ "Both panels hide/show by button, shortcut, command palette and edge tab; the canvas fills the space without the drawing shifting; state persists after reload; works in dark and light themes." ✅ `npm run check` green: types, lint, format, 274 tests (13 new for the panel store, 2 more for the shell state).

**Follow-up · Playwright browser tests (founder approved, D-42).** `npm run test:e2e` now runs 8 browser tests for P2.2a in Chrome: buttons and edge tabs (the drawing measured every frame: never moves), the three shortcuts and not while typing, ⌘K, reload, focus moving to the toggle, reduced motion, narrow-window overlays, and resizing. They found one real problem the manual check had missed: while dragging a panel edge, the plan jumped ~6 px for single frames (React drew the new width a moment after the frame); fixed by drawing each drag step at once. 32 of 32 passed on repeat. Files: `playwright.config.ts`, `e2e/panels.spec.ts`, `e2e/tsconfig.json`, `package.json` (`test:e2e`, typecheck includes `e2e`), ignore files, `editor/ResizeHandle.tsx`.

**Follow-up · token lint + full UX audit (DS-02).** Founder: "Yes to both: add the lint check, then run the full audit".
- **In plain words:** a new automatic check stops anyone adding raw colours, off-scale spacing or off-scale text sizes; only five values had to be converted, plus a short list of exceptions with reasons. The full audit covered every screen in light and dark, at 1280 px and 200 % zoom, in Windows high-contrast mode, and by keyboard. Fixed:
  - the unnamed Sort dropdown;
  - menus that let focus escape;
  - dialogs not marked modal;
  - option switches, tabs and the toolbar needing one Tab per option (arrow keys now);
  - selected rows shown only by colour (a bar now);
  - no pressed feedback;
  - the drawing breaking in high-contrast mode;
  - a short ⌘K field;
  - unnamed demo fields.
- **Files:** new `tools/tokens/{lint,lint.test}.ts`, `design/tokens/lint-allow.json`, `design/tokens/component/paper.json`, `tools/audit-run.ts`, `tools/audit/{page,static}.ts`, `design/audits/2026-11-06-full-ui.md`, `design/audits/2026-11-06-full/` (audit.json; screenshots local only). Changed: `tools/as-built/runtime.ts` (shared Chrome helpers), `tools/tokens/report.ts`, `tools/tokens-build.ts`; `frontend/src/ui/{Menu,components}.tsx`, `ui/PlanThumbnail.tsx`, `design/ui.css`, `vault/{vault,dashboard}.css`, `editor/editor.css`, `vault/Dashboard.tsx` (Sort label), `styleguide/StyleGuide.tsx`; `design/DESIGN.md`, `DECISIONS.md` (DS-02), memory v32 note.
- **Checks:** ✅ `npm run check` green (274 tests, 41 files, incl. the lint). ✅ Re-audited the changed screens: 0 unnamed controls; dialogs modal; Tab closes menus and returns to "+ New"; New folder from the menu returns focus to "+ New" on Esc (checked in the browser); editor 49 → 39 Tab stops; forced-colours editor readable. ✅ As-built re-run: only the folder-art pairs (🛑 D1) and a disabled button are below AA.
- **Open:** for the Build session: B1 tree arrow keys, B2 page headings, B3 live region, B4 duplicate "Hide left panel" name (sent to it). For the founder: D1 folder-art contrast, D2 UI-scale setting, D3 empty-state wording.

---

## P2.4 — Smart objects + command layer (+ A2 M2, M6, M7, M8, M9) · 2026-11-06 (session 3)

**What was built, in plain words.**
- **Every change to a plan is now a "command"** inside the engine (move, delete, add wall / room / door or window, change a property). Each one is checked before it runs and says in plain words why it can't ("The door needs 4.40 m of wall V, which is 4.00 m long…"). The same commands will serve the toolbar, the typed command line, the AI chat and other apps.
- **Undo and redo:** ⌘Z and ⇧⌘Z (Ctrl+Z / Ctrl+Y on Windows), or the two new buttons at the end of the floating toolbar. Tested over 50 steps there and back. A drag, or a batch of changes from the AI later, is **one** undo step. Undo is per person: when teams edit together (Phase 16) your undo only reverts your own changes and tells you if someone changed the same thing since.
- **Walls behave like walls:** move a wall and the walls joined to it stretch to stay joined (corners and T-junctions); doors and windows stay on their wall, in place; the rooms on both sides change size; a room label in the wall's way stays in its own (smaller) room.
- **In the editor now:** click a wall, door, column… to select it, then **drag it** to move it. It moves in grid steps (Shift keeps it straight, Esc puts it back), and room areas update live while you drag. **Delete** removes the selection. ⌘K also works as a **command line**: type `MOVE V1 0,0 30,0` or `ADD_WALL 0,450 1320,450` and press Enter. Plans from the Plan Library stay read-only. Changes save to the Vault as before.
- **Accessibility:** what each change did is read out by screen readers ("Moved Wall V1 by 0.50 m"); the panel close buttons now say which panel they close (audit B4).

**Checked.** Engine: 35 new tests. Areas after moving a wall (e.g. +2.26 m² / −2.26 m² for a 60 cm move), L and T joins, doors keeping their place, room labels, refusals with reasons, 50-step undo/redo, batches all or nothing, stale revisions, retried requests, gesture merging, per-author undo with skipped parts, and the same plan whether a command is called directly, typed, or sent as an AI tool call. Browser (Playwright, each test with its own in-memory Vault so `data/vault/` is untouched): drag a wall (rooms follow live, nothing recorded until release, one undo step, redo, saved to the Vault), Esc during a drag, Delete + undo, ⌘K Delete, ⌘K typed commands, read-only library plan. 14 browser tests, 42/42 over three runs. Speed: a command takes about 1 ms on the 120-room plan; a drag frame about 2.4 ms on a typical plan, ~17 ms on the 120-room one.

**UX quick pass (skill §9).** New CSS: only the visually hidden live region (1 px clip). Undo / Redo: labelled, shortcut in the tooltip, disabled with the reason in the tooltip. Drag has a non-drag way (⌘K typed MOVE); a single-click way (pick a base point, then a target) comes with P2.5's Move tool. Hover shows the `move` cursor on the selected object. Focus: commands from ⌘K run after it closes and returns focus.

**Already in place from P2.2:** walls drawn as one joined outline (`wallOutlinesCm`, D-33), redrawn after every change. **M6:** commands report which objects changed (`changedObjects`, the dirty flags); recomputing only those parts of the derived data continues through P3.2.

**Files.** Engine: `commands/{changeset,define,plan-commands,history,text}.ts` + tests, `index.ts`. Frontend: `editor/useEditing.ts` (new), `Editor.tsx`, `Canvas.tsx` (drag to move), `Palette.tsx` (typed items), `editor.css` (live region). Browser tests: `e2e/editing.spec.ts`, `e2e/panels.spec.ts` (renamed close button). Docs: `design/DESIGN.md`, `DECISIONS.md` D-43, `ARCHITECTURE.md`, `TASKS.md`, `HANDOFF.md`, `SESSIONS.md`, memory v34.

**Checks.** ✅ "Moving a wall updates adjacent room areas; door stays on its wall; undo/redo works 50 steps." ✅ Types, lint, 309 unit tests, 14 browser tests. `npm run check` stops at formatting in two files the tokens session is writing (`design/tokens/as-built*`); everything else passes.

**Follow-up · text size (UI scale) + folder-art contrast + empty states (DS-03).** Founder: "Yes to 1 and 3, add the UI scale setting".
- **In plain words:**
  - **Settings → Text size** offers 100 / 112.5 / 125 / 150 %. It's in the Vault sidebar, in ⌘K and in the editor's left rail. The whole interface grows together (text, buttons, panels, icons), changes apply at once in every open tab, and the choice is remembered on this computer. The drawing keeps its exact line weights. Room names and areas on it grow too, and a label that doesn't fit its room at the current zoom is left out instead of overlapping.
  - The folder pills ("Updated 2h", "0 files") now sit on a darker background, and the orange and green chip letters are darker; all pass contrast.
  - A folder with subfolders but no plans now says "No plans here yet." with **New plan** and **Import DXF…**.
- **How:**
  - Tokens for text, spacing, controls, icons and panels are now rem. The root font size is the browser default × the scale.
  - Every stylesheet was converted by `tools/tokens/rem-codemod.ts` (ui, vault, dashboard, styleguide, editor).
  - Code-side sizes became rem: icons, avatars, tree indents.
  - The editor reads panel widths with `cssPx()`.
  - The lint now forbids px for scalable sizes.
  - `useModalFocus` moved to `ui/modal.ts` and skips options that aren't Tab stops.
- **Files:**
  - New: `frontend/src/design/ui-scale.ts` (+ test), `frontend/src/ui/{SettingsDialog.tsx,modal.ts}`, `tools/tokens/rem-codemod.ts` (+ test).
  - Changed:
    - `design/tokens/{base/color.json,component/folder-card.json,lint-allow.json}`, `tools/tokens/{build,lint}.ts` (+ tests);
    - all `*.css`, `ui/{PlanView,icons}.tsx`;
    - `vault/{Dashboard,items,dialogs,VaultPage}.tsx`, `editor/{Editor,ResizeHandle}.tsx` (cssPx, Settings button), `styleguide/StyleGuide.tsx`, the three `main.tsx`;
    - `design/DESIGN.md`, `DECISIONS.md` DS-03, `design/tokens/CHANGELOG.md` 1.1.0, the audit report (D1–D3 fixed), memory v32 note.
- **Checks:**
  - ✅ Computed sizes on every screen are identical at 100 % (measured before and after; the only differences are the new Settings buttons).
  - ✅ At 125 % and 150 %: root 20 / 24 px, body 16.25 / 19.5 px, no horizontal overflow at 1440 px, no new small targets.
  - ✅ Settings by keyboard: arrows change the size live, Tab, Esc returns focus, and the choice survives a reload.
  - ✅ `npm run check` green (315 tests, 47 files); `npx playwright test` 14 / 14.
  - ✅ The as-built re-run has no text below AA except a disabled button.
- **2026-11-06, founder: "Keep the label fitting"** (DS-04). The rule moved from `PlanView.tsx` into `frontend/src/ui/labels.ts` (`fitRoomLabel`), with 4 tests: both lines fit; the name drops before the area; a larger text size needs more room; rooms that walls don't enclose are always labelled. Same behaviour as before.

---

## P2.5 — Minimal toolset (+ A2 M5 precision input) · 2026-11-06 (session 3) — and the end of Phase 2

**What was built, in plain words.**
- **All 20 tools of the PRD list** are in the floating toolbar, each with a key: Select `V`; Wall `W`; Room `R` (two corners make the walls and the room; a side that already has a wall doesn't get a second one); Room label `A` (click inside walls to name the space); Door `D` and Window `N` (click on a wall); Stair `S`; Room separator `P`; Line / polyline `L`; Rectangle `B`; Dimension `⇧D`; Note `T`; Hatch `H` (click inside a room); Move `M`; Copy `C`; Rotate `Q`; Mirror `I`; Offset `O`; Trim `X`; Extend `⇧X`; Delete `E`. The Layers panel can hide lines, dimensions, notes and hatches.
- **Draw by numbers (A2 M5):** while a tool waits for a point, just type: `450` puts the next point 4.5 m away in the direction the cursor points, `4.5m`, `15'6"`, `450<90` (length and angle), `@120,-30` (from the last point) or `300,450`. A prompt line above the toolbar always says what the tool wants next, and why a click did nothing.
- **Change a length by typing it:** in Properties, a wall's length, thickness and type, a room's name and type, a door's width, a note's text, a hatch's pattern, and a dimension's value can be typed over. Typing a new value into a dimension that measures a wall changes the wall; the wall across its end moves over, like widening a room in Revit. Each change is one undo step.
- **What you see is what you get:** move, copy, rotate, mirror, offset, doors and dimensions show their real result while you move the cursor.
- **Every tool is also a command:** the same 21 commands run from the tools, from ⌘K as a typed command line (`ROOM 0,0 400,300 bedroom`, `TRIM W3 250,0`), and later from the AI. A test runs every one of them three ways (called directly, typed, sent as an AI tool call) and gets identical plans.
- **Help** (the `?` in the left rail) lists every key, mouse action and typed form. **Alt-click** selects the next thing under the cursor, e.g. a hatch lying under a room.
- **Plan format 1.2.0:** plans can now hold drafting lines, dimensions, notes and hatches. Older files upgrade themselves when opened.

**Checked.** 45 new unit tests: 8 toolset commands, 22 three-ways (one per command plus the "every command has a sample" check), 4 typed input, 10 tool logic, 1 migration. 363 in total, all green. Browser (Playwright, in-memory Vault): 6 new toolset tests by real clicks and keys (walls by clicks and by typing "3m"; room box, door, stair; line, rectangle, dimension showing "4.00 m", note "Courtyard", hatch, Alt-click from room to hatch; move, copy, rotate by typing 90, offset, delete; a wall's length typed in Properties and undone; Help). 20 browser tests, 60/60 over three runs. The browser tests found two real problems, now fixed:
- After typing a value, the keys stayed in the prompt box, so the next tool key typed a letter instead of switching tool.
- The full toolbar ran under the scale bar, which blocked a click on Undo. The scale bar never takes clicks now, and moves to the top right on narrower canvases.

**UX quick pass (skill §9).** New CSS uses tokens and rem only (the token lint passes). Targets: toolbar 32 px, prompt box 28 px. Every tool button has a label and tooltip with its key. The prompt line states the next expected input (skill §5) and is announced politely. Moving now has a single-click way (Move tool: base point, then target), as WCAG 2.5.7 asks. Contrast: the hint uses `--warn` (≥ 4.5:1 in both themes). Open:
- Annotation text is sized in plan centimetres, so it is very small when zoomed out (by design, true to print). 🛑 founder may prefer a minimum on-screen size.
- The toolbar fills an 812 px canvas, and scrolls sideways when narrower.
- Multi-select is not in P2.5.

**End of Phase 2 (CLAUDE.md rule 4).**
- **🧠 Fine-tune gates:** FT-0 (optional practice run) still needs ~200 real plans in the library. There are 4 synthetic ones; the founder's sample drawings are still awaited. FT-1 needs 1,000 original plans (0 so far) and Phase 8's edit history. Phase 2 adds what FT-1 will learn from: every change is now a recorded changeset with author and time. Nothing to run yet.
- **`INTEGRATION.md`:** commands, the §4.4 request format, history, undo, typed commands, precision input, changesets and annotations documented for hosts.
- **`SCHEMA-CHANGELOG.md`:** 1.2.0.
- **Golden test plans:** command cases, the three-ways test and the 1.2.0 samples.
- **UX full audit:** the docs & UX session's full audit (DS-02) covered the editor up to P2.4; the Phase 2 end audit, with the new toolset, is requested from that session.

**Files.** Engine: `schema/plan.ts` (Line, Dimension, TextNote, Hatch), `schema/migrations.ts`, `schema/version.ts` (1.2.0), `samples/1.2.0/`, `commands/{tool-commands,registry,input}.ts` + tests, `commands/three-ways.test.ts`, `commands/{plan-commands,text,define,history}.ts`, `view/{drawing,pick}.ts`, `index.ts`, JSON Schema. Frontend: `editor/{tools,useTools}.ts` + test, `editor/{ToolPrompt,HelpDialog,tool-icons}.tsx`, `Editor.tsx`, `Canvas.tsx`, `Properties.tsx`, `state.ts`, `editor.css`, `ui/PlanView.tsx` (annotation layers, pick shapes), `vault/demo.ts`. Browser tests: `e2e/{helpers,tools.spec}.ts`, `e2e/editing.spec.ts`. Docs: `design/DESIGN.md`, `DECISIONS.md` D-44, `ARCHITECTURE.md`, `INTEGRATION.md`, `SCHEMA-CHANGELOG.md`, `engine/golden/README.md`, `TASKS.md`, `HANDOFF.md`, `SESSIONS.md`, memory v35.

**Checks.** ✅ "Each tool works via mouse and is a command (usable from the command line and, later, the AI). Keyboard shortcuts documented. A test runs every command three ways (direct call, typed command line, AI tool call) and gets identical results." ✅ `npm run check` green: 363 tests. ✅ 20 browser tests.

---

## P3.1 — Rule packs · 2026-11-06 (session 3) — built; 🛑 waiting for the founder's review

**What was built, in plain words.**
- **Rule packs** are plain data files the architect can change: `nbc-default` (minimum room sizes, the PRD's NBC values), `vastu-default` (room zones, used only when a plan has Vastu on), `firm-default` (two example office standards: door widths), `city-bengaluru` (setbacks, ground coverage, FAR — ready, but empty until you give the BBMP values). Nothing is hard-coded: each rule names a check and its value.
- **Reference checks** run on the plan and say, in plain words, what doesn't meet a rule and how to fix it, e.g. "Bedroom is 1.89 m wide; the reference minimum is 2.40 m. Widen Bedroom by 52 cm, e.g. move wall NAR.w1 52 cm south." They appear in the editor's Issues tab now, each marked **unverified** until you confirm the value it comes from. (Grouping by room, click-to-zoom and quick fixes are P3.2.)
- **Your review** (the 🛑): `docs/design/P3.1-rule-pack-review.md` lists every seeded value with seven questions.

**Checked.** 9 new engine tests (packs load and every value is unverified; which packs a plan uses; a broken pack is refused with reasons; NBC area / width / "one room of 9.5 m²" / level height with exact messages and fixes; Vastu zones and main entrance; firm door widths; setbacks, coverage and FAR with a filled-in test table; width of a turned room), 1 browser test (an unverified NBC issue in the Issues tab). 373 unit tests and 21 browser tests green.

**Files.** Engine: `schema/rule.ts`, `schema/json-schema.ts` (+ `rule-pack` JSON Schema), `rules/{check,packs}.ts` + test, `rules/packs/*.json`, `library/tags.ts` (`footprint`), `index.ts`. Frontend: `editor/Editor.tsx` (reference checks in the Issues tab), `ui/components.tsx` (`IssueRow` "unverified" chip). Browser test: `e2e/checks.spec.ts`. Docs: `docs/design/P3.1-rule-pack-review.md`, `DECISIONS.md` D-45, `SCHEMA-CHANGELOG.md`, `ARCHITECTURE.md`, `TASKS.md`, `HANDOFF.md`, `SESSIONS.md`, memory v36.

**UX quick pass (skill §9)** on the Issues tab: the "unverified" label is a word chip (not colour alone) next to the object ids; messages use plain words, metres and m², and say "reference minimum"; no new CSS.

**Review, first answers (founder, D-46).** NBC sizes confirmed as listed, so they're now "verified" with that source. The combined toilet rule is kept. The Vastu kitchen is south-east only. Road width is now recorded on the plot (plan format 1.3.0: Properties → Road width, or `SET_PLOT road_width=900`), and the BBMP FAR table goes by road width; a plan without it gets a note that FAR can't be checked yet. 379 unit tests, 21 browser tests.

**Review, second answers (founder, 2026-11-07, D-47).** The habitable-room list is kept; the height is floor to ceiling; all Vastu preferences are confirmed, and toilets now also avoid the centre of the plot; the two firm door widths are kept. Every rule except the empty Bengaluru tables is now "verified".

**Checks.** ✅ "Packs load". ⏳ "founder-approved values recorded with sources": done for NBC, Vastu and the firm pack; the BBMP values and the severities are still open.

## P3.2 — Live reference-check panel · 2026-11-07 (Build chat "Atomic design system handoff")

**What was built, in plain words.**
- **Checks run while you draw.** After every change the plan is checked again: an issue appears in the Issues tab about 0.17 s after the change (target: within 0.3 s). A drag is checked when you let go.
- **Grouped by room.** Issues are listed under the room they are about ("Bedroom 3 (2)"), with the plot and level issues first under "Whole plan". Each one still says how to fix it.
- **Click an issue** to select the room (or door, wall…) and zoom to it. The Issues list stays open, so you can work down it.
- **Fix buttons** where there is only one sensible answer: move the named wall to widen or enlarge a room, widen a door to the minimum (about its middle), raise a low level. One click is one undo step (⌘Z). Vastu, setbacks, coverage and FAR get no Fix button: they need your judgement.
- **Vastu score:** with Vastu on, the share of Vastu preferences the plan meets (e.g. "17 %: 1 of 6 preferences met"), marked "assumed" because the drawing's north is assumed to point up. A **Vastu checks** switch in the Issues tab turns Vastu on or off for the plan.
- Also recorded: your P3.1 answer on severities (D-48). Only the BBMP values remain open for P3.1.

**Checked.** ✅ "Shrinking a bedroom below the minimum shows an issue within 300 ms; fixing it clears the issue": browser test, 168–170 ms over three runs; the Fix button clears it and one undo brings it back. 14 new unit tests: quick fixes for a narrow and a small room, a side made of two walls, an L-shaped room (no fix), doors (and a door with a window beside it: no fix), level height, the Vastu score, grouping by room, zoom areas, `SET_PLAN` / `SET_LEVEL`, the live-check helper, the Issues tab staying open. 3 new browser tests (timing + fix + undo, click to zoom, Vastu switch). 393 unit tests and 24 browser tests green; `npm run check` green.

**UX quick pass (skill §9) + A5 §7.** Tokens only (token lint green). The issue is one button for message and fix sentence, with hover, pressed and an inset keyboard ring (so it doesn't cover the object chips). Focus moves to the summary after a fix, since the fixed row disappears. Contrast on hover: message 15.8:1 light / 13.3:1 dark, fix sentence 4.8:1 / 5.8:1. Fix button 35 × 28 px. Reflows at 150 % text size. Counts are words with colour ("7 errors"), not colour alone. A5: no upward imports; the issue row owns its states; the new section variant (`PanelSection flush`) is a variant, not an outside override; the Issues panel uses three atoms directly (Button, Status, Switch), for PA.1 to classify.

**Files.** Engine: `rules/check.ts` (fixes, `vastuScore`), `rules/groups.ts` (+ test), `view/bounds.ts`, `schema/rule.ts` (`IssueFix`, `Issue.fix`), `commands/tool-commands.ts` (`SET_PLAN`, `SET_LEVEL`), `index.ts`, tests; JSON Schema `issue` regenerated. Frontend: `editor/useChecks.ts` (+ test), `editor/IssuesPanel.tsx`, `editor/Editor.tsx`, `editor/state.ts` (`keepTab`), small exact edits in `ui/components.tsx` (`IssueRow` `onShow` / `action`, `PanelSection` `flush`), `design/ui.css` (`.pc-issue-show`, flush sections), `editor/editor.css` (`.ed-issues`, `.ed-vastu`). Browser tests: `e2e/checks.spec.ts`.

**🛑 For the founder.** A Fix moves the whole wall it names. When that wall runs past several rooms (like the long walls of the test grid plans), those rooms change too. Keep it, or split the wall at the room's corners first?

---

## A5 PA.1 — Atomic design system check · 2026-11-07 (chat "Hand off files and memory") — approved; step 1 done

**What was done, in plain words.** A read-only check of the whole interface against the atomic design rules (A5 C1–C12). Nothing in the code, styles or tokens was changed. The report is `design/system/ATOMIC-AUDIT.md`.

**Verdict: partly compliant.** The token foundation is solid. Switching light/dark or the text size updates every screen with no code changes (measured on 495 elements across the style sheet, the Vault and the editor). But no component is assigned a level yet, most shared pieces sit in one file, several common pieces exist only as CSS inside the Vault or editor (nav item, tree row, search field, shortcut key), and some are built two or three times (⌘K palette, Help dialog, avatar, thumbnail). The stylesheets point at raw scale steps 286 times instead of the named spacing and text tokens, which are unused. Scorecard: ✅ 1, ⚠️ 8, ❌ 3. There is no density setting.

**Checked.** Import graph of every `frontend/src` file; every CSS declaration and inline style (same parser as the token lint); every token alias resolved with the token build; live theme and 125 % text-size switch in the browser pane. Report formatted with Prettier.

**🛑 For the founder** (in the report): approve the six-step plan; allow Button, IconButton, Icon and Chip directly in organisms; keep folder art as an exception; leave density out for now; split `Dashboard.tsx` and `Editor.tsx` during the restructure. Moving files (PA.2) gets planned with Build and the icon session first.

**Founder's answer (DS-05):** "Approve 1–5, start step 1."

**Step 1 (classify on paper) — done.** Docs only; no code, styles or tokens changed.
- `design/system/registry.json`: all 95 interface components with their level (21 atoms, 27 molecules, 31 organisms, 2 templates, 7 pages, 7 outside the levels), where each lives now, its target folder, its status (11 built more than once, 9 that exist only as CSS, 26 inside bigger files), what it's built from and its plan step.
- `design/system/EXCEPTIONS.md`: the approved exceptions E1–E5 (the four basic atoms; folder art; drawing renderers; reference pages; app shell), the density note, and seven cases for step 3 (organisms using other atoms directly).
- Checked against the code with a one-off script: every file, component and class named exists; no entry uses a higher level. Prettier and an invisible-character scan passed.

**Next:** step 2 (folders, old imports kept working) needs a time agreed with Build and the icon session; the founder decides when to start it.

## P3.3 — Auto Plan Graph extraction · 2026-11-07 (Build chat "Atomic design system handoff") — and the end of Phase 3

**What was built, in plain words.**
- **The Plan Graph:** PlanCraft reads every plan as a bubble diagram, worked out from the walls, doors and rooms (never drawn by hand). It gives one bubble per room (with its area, which third of the house it sits in from the road, its Vastu zone, which sides face outside, and whether a door to the outside opens into it) and a line between rooms that relate: **open** (arch, separator, or one shared space), **door**, **wall only**, or **meet at a corner**.
- **See it:** Layers → **Plan graph** draws it over the plan, with a key (line styles differ, so it never relies on colour). Click a room and **Properties** shows its zone, Vastu zone, outside walls and the rooms it connects to.
- **Your spot-check** (the 🛑): `docs/design/P3.3-plan-graph-review.md`, five plans with pictures and five questions.
- Your earlier answer is in: quick fixes move the whole wall (D-50).

**Checked.** 9 engine tests: the five spot-check plans' graphs (doors, shared walls, the duct inside the hall, the open-plan separator, the grid's 11 doors / 6 walls / 12 corners, zones, outside sides, entrance), an arch, a window in a shared wall (still "wall only"), two rooms in one space, rooms apart, provenance (zones "assumed" when the facing is). 2 editor tests (neighbours, overlay shapes), 1 state test (overlay off by default), 1 browser test (overlay: 12 dots, 29 lines; Properties connections). 405 unit tests and 25 browser tests green; `npm run check` green. Speed: 12 ms for the 120-room stress plan; computed only while the overlay is on or a room is selected. ⏳ "Graph matches founder's expectation on 5 sample plans": waiting for your spot-check.

**UX quick pass (skill §9) + A5 §7.** Tokens only (the token lint caught a fixed 11 px tag size; it now follows Settings → Text size). Light and dark checked by screenshot. The overlay doesn't take clicks; dots sit above the room names so labels stay readable; lines differ by width and dashes and the key names each. The switch is a plain checkbox in Layers, with a ⌘K command too. A5: new pieces live in `editor/` (an organism-level overlay and a pure helper), import downward only.

**Files.** Engine: `graph/plan-graph.ts` (+ test), `schema/graph.ts` (+ JSON Schema `plan-graph`), `rules/zones.ts` (plot grid, compass, centroid, point-in-room shared by checks, groups and graph), `rules/check.ts` and `rules/groups.ts` use it, `index.ts`. Frontend: `editor/graph-view.ts` (+ test), `editor/GraphOverlay.tsx`, `editor/state.ts` (`graph`, `toggleGraph`), `editor/Editor.tsx` (memo, overlay, Layers switch and key, ⌘K), `editor/Properties.tsx` (`GraphFacts`), `editor/editor.css` (`.ed-graph-legend`, `.ed-links`). Browser test in `e2e/checks.spec.ts`. Review: `docs/design/P3.3-plan-graph-review.md` + `P3.3-plan-graph/*.png`.

**Phase 3 end.** Phase 3 (rules engine) is built: rule packs (P3.1), live reference checks (P3.2), Plan Graph (P3.3). Still open: the BBMP values (P3.1) and your graph spot-check (P3.3).
- 🧠 **Fine-tune gates:** FT-0 (optional practice run) still waits for ~200 real plans in the library: **0 / 200** (only 4 synthetic plans so far). FT-1: **0 / 1,000** original plans, and it also needs P8.3 and the Gemini pipeline. The Plan Graph built here is the core of the FT-1 "graph target".
- `INTEGRATION.md` (live checks, quick fixes, Vastu score, Plan Graph), `SCHEMA-CHANGELOG.md` (Issue `fix`, Plan graph 1), golden plans (`engine/golden/README.md`, "Added in Phase 3") updated.
- UX: quick passes done for P3.2 and P3.3. Phase 3 isn't one of the skill's UI phases (P2, P14, P13, PI), so no full audit; the Phase 2 audit still waits for your go.

## PI.1 — Icon style sign-off · 2026-11-07 (Icons chat "PI icons handoff") — approved

**What was done, in plain words.** The icon style was agreed and written down; no app code changed. The founder assigned PI.1–PI.3 and the icon swap to this separate session (`docs/design/PI-icons-handoff.md`; row in `SESSIONS.md`). The Build and A5 sessions were told.

**Founder's answers (DS-06): "Approve 1, 2, 3a, 4b, 5, 6".** Icons use the blueprint-blue accent; the duotone look (outline, soft fill, accent details) with the founder's own light-theme colours; 20 px is the default, toolbars included (24 only where a button has room, compared on the sheet first); icons grow with Text size, and the 22.5 px default at 112.5 % is accepted; active items keep today's look (Vault raised pill, editor pale-accent square) and only the icon recolours; the `Icon` component is an A5 atom in `frontend/src/ui/atoms/Icon/`; third-party images in `design/reference-icons/` stay local.

**Changed.** `design/DESIGN.md` → Icons rewritten (look, drawing rules, sizes per text size, states, CSS, component and accessibility, rule for new icons) + change-log line; `DECISIONS.md` DS-06; `.gitignore` (reference-icons, keeping the README and our own preview; checked with `git check-ignore`); `design/reference-icons/README.md`. Prettier check passed on the changed docs.

**✅** The founder approved the Icons section. No UI was touched, so no UX quick pass.

**Next:** PI.2 (🛑 adding `@phosphor-icons/react`; how our own SVG files become components).
