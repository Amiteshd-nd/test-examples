# Tasks
Updated: 2026-11-07

One line per item. Prompt IDs come from `PRD.md` §5; detail lives there. Founder actions are marked **Founder**. Finished prompts are logged in `PROGRESS.md`.

## Now
- [x] P0.1 Project setup and founder interview (2026-11-06)
- [x] P0.2 CADCraft reference review → ADR 0001 accepted (2026-11-06)
- [x] P1.1 Plan schema v1 + validator + migrations (2026-11-06)
- [x] P1.2 DXF import + bulk import runner, built without samples (founder's choice, 2026-11-06; D-16, D-18)
  - [ ] **Acceptance still open:** convert the founder's sample DXFs, tune `import-mapping`, founder confirms previews
- [x] P1.3 DXF export (2026-11-06): AutoCAD 2000 in mm, standard layers, joined wall outlines, read-back check, round trip, ezdxf checks (D-19…D-21)
  - [ ] **Founder** open one export (e.g. `data/exports/check/b-1bhk-t-junctions.dxf` after `npm run test:dxf`) in AutoCAD or LibreCAD and confirm layers and look — the one P1.3 check that needs AutoCAD
- [x] P1.4 Batch import + Plan Library index (2026-11-06; D-22): auto-tags with provenance, DocumentStore, tag-review CSV
  - [ ] 🛑 **Founder** review the tags of the real plans (`npm run import && npm run library`, then edit `data/library/tag-review.csv`, then `npm run library:review`) — waits for the drawings; acceptance "≥90% convert at least partially" is measured then
- [ ] 🧠 FT-0 optional practice training run — offered at the end of Phase 1; needs the founder's ~200 plans in the library first (P8.2-lite JSONL export then)

## Now — Phase 2: Editor shell & design system
- [x] P2.1 Founder interface screenshots → DESIGN.md — approved 2026-11-06, Geist fonts added (D-24, D-26)
- [x] P1.1b Geometry kernel (A2 M4): 2 cm gap closing, order-independent joins, snap rounding, join tests, 1,000-layout fuzz (2026-11-06, D-30)
- [x] P14.1 Vault design → DESIGN.md + component page `/vault.html` — approved 2026-11-06 (D-31, D-32)
- [x] P2.2 App shell (2026-11-06, D-33): checked in the browser at desktop, tablet and phone widths
- [x] P2.3 Canvas (+ A2 M6 spatial index) (2026-11-06, D-34, D-35): library plans via `DocumentStore`, pan/zoom/select/snap, door swings and window lines; speed measured
  - [x] **Founder** confirmed pan/zoom on the 120-room stress plan feels smooth (2026-11-06)
- [x] P14.2 Vault storage (+ A2 M10) (2026-11-06, D-36, D-37): folders/files, Trash, search, thumbnails, `.plancraft` packages; local vault in `data/vault/` (`npm run vault:seed`)
- [x] P14.3 Dashboard screen — built and browser-checked (2026-11-06, D-38)
  - [x] 🛑 **Founder test** (2026-11-06): created a folder and opened a plan in the editor without help; the DXF import step was skipped (no drawing at hand) and was checked by Claude in the browser. Accepted.
- [x] P14.4 Editor ⇄ Vault flow (+ M12 continuous save) (2026-11-06, D-39): continuous save with local drafts, Saved · Saving… · Offline · Changed elsewhere, auto-versions every 30 min of editing, rename from the editor, Home restores folder, scroll and selection
- [x] P14.5 Starred, Shared, Trash, search, shortcuts (2026-11-06, D-40): search page with filters, grid/list everywhere, 30-day auto-delete, Trash actions without right-click; Shared stays hidden until P10.1
- [x] **Phase 14 end** (2026-11-06): UX full audit `design/audits/2026-11-06-vault-phase14.md` (7 fixes made), golden plan notes, fine-tune gates reported (FT-0 waits for ~200 real plans; FT-1 0 / 1,000)
  - [ ] 🛑 **Founder:** small text in the Vault (audit V8): raise to ≥ 13 px, add a UI-scale setting (100–150%), or both
  - [ ] Design-system session: audit V9 (inputs/dropdowns react only on their inner line), V10 (menus don't return focus), V11 (selected row by colour only), V12 (pill contrast on glass)
  - [ ] Follow-ups: V13 live region for vault actions, V14 loading skeletons (with the server), V16 ★/✓ as icons (PI prompts)
- [x] **P2.2a Collapsible side panels (Figma-style)** (2026-11-06, D-41): top-bar toggles, edge tabs, ⌘\ focus mode, ⌘⌥[ / ⌘⌥], an editor ⌘K palette, the drawing stays still (checked frame by frame), 200 ms slide (none with reduced motion), remembered per user, narrow overlays close with Esc / click outside, chat included; optional resizing done (drag, double-click, arrow keys). Temporary panel icon (founder's choice) until PI.1–PI.2.
  - [x] **Founder** approved Playwright (2026-11-06, D-42): `npm run test:e2e`, 8 browser tests for P2.2a (they found and fixed a one-frame jitter while dragging a panel edge)
  - [ ] Follow-ups: one shared ⌘K palette component for Vault and editor (`ui/`); swap the temporary panel icons for Phosphor `sidebar-simple` at PI.2; editor Help should list the shortcuts (rail Help does nothing yet); resize edge is 8 px wide with no single-click way to set an exact width (WCAG 2.5.7/2.5.8 note)
- [x] **P2.4 Smart objects + command layer (+ M2, M7, M8, M9; M6 dirty flags)** (2026-11-06, D-43): engine commands MOVE / DELETE / ADD_WALL / ADD_ROOM / ADD_OPENING / SET, changesets, per-author undo / redo, batches, typed form; editor: drag the selection to move it (one undo step), Delete, ⌘Z / ⇧⌘Z, toolbar Undo / Redo, ⌘K typed commands, live region. 50-step undo/redo tested.
  - [ ] Follow-ups: Properties panel editing (typed values → SET) and the single-click Move (base point, then target) with P2.5; editor Help listing shortcuts; INTEGRATION.md gets the command API at the end of Phase 2
- [ ] **UX audit (docs & UX session, `design/audits/2026-11-06-full-ui.md`) items for Build:** B1 Vault folder tree as one Tab stop with arrow keys (P2) · B2 page headings: hidden h1 per place, section titles h2 (P2) · ~~B3 live region~~ (editor done in P2.4; the Vault still needs one) · ~~B4~~ (done in P2.4)
- [x] **P2.5 Minimal toolset (+ M5)** (2026-11-06, D-44): 21 commands behind 20 tools, keys documented in Help, typed lengths / points while drawing, editable lengths and dimensions in Properties, annotations (format 1.2.0), three-ways test; 6 browser tests
  - [ ] 🛑 **Founder:** annotation text (dimensions, notes) is sized in plan cm like CAD, so it is tiny when zoomed out: keep it true to print, or add a minimum on-screen size?
  - [ ] Follow-ups: multi-select (window / crossing) so Move / Copy / Rotate / Mirror take several objects; annotations in the DXF export and thumbnails (P7); swap temporary tool icons at PI.2–PI.3; the toolbar fills an 812 px canvas (consider grouped flyouts if more tools come)
- [x] **Phase 2 end** (2026-11-06): fine-tune gates reported (FT-0 waits for ~200 real plans; FT-1 0 / 1,000), `INTEGRATION.md` (commands, history, typed input, changesets, annotations), `SCHEMA-CHANGELOG.md` 1.2.0, golden plans; UX full audit of the Phase 2 editor requested from the docs & UX session — **on hold until the founder says when** (founder's answer to that session)
- [ ] **P3.1 Rule packs** — built (2026-11-06, D-45): four packs, eleven checks, issues in the Issues tab labelled "unverified"
  - [x] Founder's first answers (2026-11-06, D-46): NBC confirmed, combined toilet kept, Vastu kitchen south-east only, road width added (format 1.3.0)
  - [x] Second answers (2026-11-07, D-47): habitable list kept, height floor to ceiling, Vastu confirmed (+ toilets avoid the centre), firm door widths kept
  - [x] Severities confirmed as listed (2026-11-07, D-48): NBC and BBMP errors, Vastu and firm warnings
  - [ ] 🛑 **Founder:** BBMP setback / coverage / FAR values with sources (FAR by road width): the last open item of P3.1
- [x] **P3.2 Live reference-check panel** (2026-11-07, D-49): checks re-run 120 ms after each change (issue shows in ~170 ms), grouped by room, click to select and zoom, quick fixes as one undo step (move a wall, widen a door, raise a level), Vastu score and Vastu on/off switch; new commands `SET_PLAN`, `SET_LEVEL`
  - [x] Founder (2026-11-07, D-50): keep the whole-wall fix (other rooms along a long wall change too; ⌘Z undoes it)
  - [ ] Follow-ups: mark the issue whose object is selected; "Fix all" for fixes that don't touch the same walls; group headings as real headings (`h3`) for screen readers; incremental re-checks per changed room (M6) if plans get large (today ~5 ms for 120 rooms)
- [ ] **P3.3 Auto Plan Graph extraction** — built (2026-11-07, D-51): `planGraph` (rooms, open / door / wall / corner links, depth and Vastu zones, outside walls, door to the outside), Layers → Plan graph overlay with a key, a room's connections in Properties
  - [ ] 🛑 **Founder:** spot-check the five plans in `docs/design/P3.3-plan-graph-review.md` (pictures included) and answer its questions: depth zone by floor thirds, every outside door or only the main entrance, keep corner lines, missing bubbles (outside spaces, stairs)
  - [ ] Follow-ups: link rooms across levels through stairs; outside spaces (sit-out, parking, OTS) as nodes once the plan format has them; graph to Brief (P6.3)
- [x] **Phase 3 end** (2026-11-07, waiting only on the founder's BBMP values and the graph spot-check): fine-tune gates reported (FT-0 waits for ~200 real plans; FT-1 0 / 1,000), `INTEGRATION.md`, `SCHEMA-CHANGELOG.md`, golden plans (`engine/golden/README.md`); UX quick passes for P3.2 and P3.3 (Phase 3 isn't a UI phase in the skill's list, so no full audit)
- [ ] **A5 atomic design system:** adopted 2026-11-07 (file in the repo, lines in `CLAUDE.md` and the skill). **PA.1** done by another session (2026-11-07, DS-05): `design/system/ATOMIC-AUDIT.md`, verdict "partly compliant"
  - [ ] 🛑 **Founder:** read the audit's verdict and approve its plan (or parts). PA.2 then moves `ui/components.tsx` into atoms / molecules / organisms and lifts shared pieces out of `Dashboard.tsx` / `Editor.tsx`: that session plans the timing with Build, and Build pauses between prompts while it runs
- [ ] **Icons (PI.1–PI.3):** a separate Icons session owns them now (founder, 2026-11-07, `docs/design/PI-icons-handoff.md`), including the "swap temporary panel / tool icons" follow-ups above; it messages Build before touching editor files

## Queued from addendum A2 (D-27) — apply each at its prompt
- [x] **M1** objects in id-keyed maps + fractional `order` — format 1.1.0 with migration (2026-11-06, D-29)
- [x] **M3** room separator lines — in format 1.1.0, derivation, DXF export/import (2026-11-06, D-29); drawing them as a tool comes with P2.5
- [x] **P1.1b** geometry kernel (M4) — done 2026-11-06 (D-30)
- [ ] **M6** spatial index ✓ (P2.3) · dirty flags ✓ (P2.4: `changedObjects`; the snapping index isn't rebuilt mid-drag) · incremental recompute of rooms, drawing and checks — through P3.2
- [x] **M2, M7, M8, M9** deterministic commands with ids in params; one undo step per gesture; per-user undo with skipped parts; changesets (`diff`/`apply`/`invert`) — done in P2.4 (D-43); `merge3` at P15.3
- [x] **M5** typed lengths/angles while drawing, editable dimensions — done in P2.5 (D-44)
- [x] **M10** `.plancraft` package file — done in P14.2 (D-37) · [x] **M12** continuous save + auto-versions — done in P14.4 (D-39)
- [ ] **M11** P10.1 accounts, workspaces, roles — before Phase 15
- [ ] Phase 14 Vault: ~~P14.1~~ ~~P14.2~~ (2026-11-06, D-36, D-37) · P14.3 next (dashboard screen, 🛑 founder test) · P14.4 · P14.5 · Phase 15 versions & branches (P15.1–P15.5) · Phase 16 multiplayer (P16.1–P16.5, after beta) — on the founder's P14/P15/P16 prompt id
- A2 recommended order: P2.1 → P14.1 → P2.2 → P2.3 → P14.2–P14.5 → P2.4 → P2.5 → P3 → P4 → P5 → P6 → P7 → P10.1 → Phase 15 → A1 (P11, P12.1–P12.4, P13.1–P13.3, P13.5) → Phase 8 → P10.2–P10.4; after beta: Phase 9, Phase 16, A1 P12.5/P13.4, P10.5

## Later
- [x] Phase 2 Editor shell & design system (P2.1–P2.5) — done 2026-11-06
- [ ] Phase 3 Rules engine (P3.1–P3.3) — built 2026-11-07; open: BBMP values (P3.1), graph spot-check (P3.3)
- [ ] Phase 4 Chat agent (P4.1–P4.4)
- [ ] Phase 5 Layout engine (P5.1–P5.4)
- [ ] Phase 6 Plan Library & generation (P6.1–P6.3)
- [ ] Phase 7 Export & print (P7.1–P7.3)
- [ ] Phase 8 Data flywheel (P8.1–P8.3) · 🧠 FT-1
- [ ] Phase 9 Own model integration (P9.1–P9.4) · 🧠 FT-2, FT-3
- [ ] Phase 10 Beta hardening (P10.1–P10.6)
- [ ] Addendum A1 (D-25): Phase 11 3D model & viewer, Phase 12 render styles, Phase 13 sheets & boards — only when the founder types a P11–P13 id (earliest after P2.4, recommended after Phase 7)

## Small follow-ups
- [ ] Vault lists over 200 items should be virtualised (A2 §10: 500 items open in under 1 s); fine at today's sizes.
- [ ] Two browser tabs editing the same local vault can overwrite each other's index changes (single user, dev storage); the server (P10.1) or a version check on the index solves it.
- [ ] DXF export v0 leaves out dimensions (P7.2), chajjas, lofts and fixtures; rotated columns are boxes.
- [ ] DXF import gaps to revisit with real samples: sheets with several floor plans (only the largest drawing is imported), curved walls, single-line walls, door swing from the symbol, facing from a north arrow, room outlines drawn on area layers, rotated columns.
- [ ] Rooms not closed by walls (open-plan living/dining, doorway gaps): today they share one area with a warning (D-13). Needs separators or C2 gap closing; decide by P3/P5.
- [ ] Sunken toilet was not added in P1.1; revisit if needed for rules or export.
- [ ] Re-check `npm audit` when ESLint/typescript-eslint ship a release with patched `minimatch` (10 moderate findings, dev-only lint tooling, see D-07)
