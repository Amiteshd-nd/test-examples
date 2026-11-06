# Golden test plans

Plans with known answers that any host can run against the engine (PRD P10.6 grows this to 20+ plans with expected issues, metrics and layouts, runnable with one command). Updated at the end of every phase (PRD §0.4 rule 6).

## After Phase 1

| Plan | Source | Expected (checked by the test named) |
|---|---|---|
| Sample A: one room | `engine/samples/1.3.0/a-one-room.plan.json` | Room 10.44 m²; built-up 13.66 m²; compound wall kept; exports to DXF and reads back identical (`rooms/derive.test.ts`, `library/tags.test.ts`, `dxf/export.test.ts`) |
| Sample B: 1BHK with T-junctions | `engine/samples/1.3.0/b-1bhk-t-junctions.plan.json` | Rooms 10.66 / 6.58 / 3.75 m²; built-up 26.35 m²; every plan-check rule triggers on a known edit; DXF round trip (`validate/validate.test.ts`, `dxf/export.test.ts`) |
| Sample C: L hall, duct, mixed walls | `engine/samples/1.3.0/c-l-hall-duct.plan.json` | Hall 32.46 m² with the duct as a hole, duct 0.25 m²; built-up 39.15 m² (`rooms/derive.test.ts`, `library/tags.test.ts`) |
| Sample D: open plan with a separator | `engine/samples/1.3.0/d-open-plan-separator.plan.json` | Living 8.99 / dining 9.21 / kitchen 10.66 m² split by separator SP1; without it, living and dining share one area (warning); DXF round trip keeps the separator (`rooms/derive.test.ts`, `dxf/export.test.ts`) |
| Drafted 1BHK, mm, lines | `oneBhkDxf({unit: 'mm', …})` in `engine/dxf/test-fixtures.ts` | Imports to sample B's walls, openings and room areas; DXF → plan → DXF → plan exact (`dxf/import.test.ts`, `dxf/export.test.ts`) |
| Drafted 1BHK, inches, polylines, one block | `oneBhkDxf({unit: 'in', …})` | Same as above, units inferred (`dxf/import.test.ts`) |

Geometry kernel cases (P1.1b): plus-shaped walls (four 8.41 m² rooms), five walls meeting at a point, a very shallow crossing, overlapping walls of different thickness, 1.5 / 2 cm gaps closing and a 2.5 cm gap staying open, a diagonal T-junction a hair off its wall, and 1,000 random layouts (`geometry/kernel.test.ts`).

## Added in Phases 2 and 14

| Case | Source | Expected (checked by the test named) |
|---|---|---|
| Grid plan 4 × 3 ("typical") | `gridPlan({cols: 4, rows: 3})` in `engine/samples/grid-plan.ts` | 12 enclosed rooms, smallest 8.84 m²; plan check clean; DXF export passes its read-back (`view/drawing.test.ts`) |
| Grid plan 12 × 10 ("stress") | `gridPlan({cols: 12, rows: 10})` | 120 rooms round-trip through DXF; 30 bedroom labels recorded as BHK 20 with a note (`dxf/export.test.ts`); hit-test and snaps on 437 shapes (`view/pick.test.ts`) |
| Opening symbols | `openingSymbol` in `engine/view/drawing.ts` | Door "in-left" on a wall along +x: leaf 0 → 90°, arc 0° → 90° about the start; "out-right": arc 180° → 270°; window lines at −t/4, 0, +t/4 (`view/drawing.test.ts`) |
| Demo Vault | `seedDemoVault` in `engine/vault/demo.ts` | 8 folders in all six colours, 3 plans (Draft / In review / Approved), one archived folder (`vault/vault.test.ts`) |
| Vault behaviour | `engine/vault/vault.test.ts` | Folder into itself refused; Trash with contents, restore to top level, delete for ever only from Trash, 30-day purge; search by words and filters; thumbnail redrawn only after a change; stale save refused (`VaultConflictError`); unnamed version after 30 min of editing (pauses count 5 min); `.plancraft` round trip, re-zipped and old-format packages import |

| Commands on a 6 × 4 m box | `engine/commands/plan-commands.test.ts`, `tool-commands.test.ts` | Moving the middle wall 60 cm: +2.26 / −2.26 m²; L and T joins follow; the door keeps its place; a room label in a moving wall's path stays in its room (18.20 / 3.12 m²); room box beside the shell adds 3 walls, not 4 (10.98 m²); setting the bottom wall's dimension to 7 m moves the right wall over (+3.77 m²); trim, extend, offset, copy, rotate, mirror give the listed coordinates |
| Every command three ways | `engine/commands/three-ways.test.ts` | 24 commands (P3.1–P3.2 added `SET_PLOT`, `SET_PLAN`, `SET_LEVEL`), each giving the same plan called directly, typed (`formatCommand` → `parseCommand`) and as a JSON tool call |
| Undo and history | `engine/commands/history.test.ts` | 50 steps undone and redone exactly; batch all or nothing; stale revision refused; retried request id applied once; gesture merging; per-author undo with skipped parts |
| Format 1.2.0 samples | `engine/samples/1.3.0/` | Samples A–D upgraded from 1.1.0 (empty annotation maps); same answers as above |

## Added in Phase 3

| Case | Source | Expected (checked by the test named) |
|---|---|---|
| NBC sizes on room boxes | `engine/rules/check.test.ts` | A 4.00 × 2.20 m bedroom box: "Bedroom is 2.08 m wide; the reference minimum is 2.40 m", fix "Move wall NAR.w1/w3 32 cm"; enlarging to 9.5 m² takes 37 cm and clears both; level 2.70 m → "Make Ground 2.75 m high" |
| Vastu | `engine/rules/check.test.ts` | Kitchen north-west, toilet north-east, entrance facing south flagged; master bedroom south-west passes; Vastu score 25 % (1 of 4), 50 % once the toilet moves |
| Firm door widths | `engine/rules/check.test.ts` | Main door 0.90 → fix 1.00 m at offset 95; inside door 0.70 → 0.75 m at 97.5; no fix when a window is beside it |
| Setbacks, coverage, FAR | `engine/rules/check.test.ts` | With a filled-in test table; FAR by road width, and a note when the plan has none |
| Issues by room | `engine/rules/groups.test.ts` | Whole plan first, then rooms in plan order; a door or wall goes with the first room beside it, a stair with the room it stands in |
| Plan Graph, five plans | `engine/graph/plan-graph.test.ts` | A: no links, outside on four sides; B: bedroom door kitchen, kitchen door toilet, bedroom–toilet wall only; C: hall–duct wall only; D: living open to dining (separator), dining door kitchen; E (grid 4 × 3): 11 doors, 6 walls, 12 corners, rows front / middle / rear |
| Live check timing | `e2e/checks.spec.ts` | Narrowing Bedroom 3 shows its issue in < 300 ms (≈ 170 ms); its Fix clears it; one undo brings it back |

Run them with `npm test`. The founder's real drawings join this list once they are imported and reviewed.
