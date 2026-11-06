# Golden test plans

Plans with known answers that any host can run against the engine (PRD P10.6 grows this to 20+ plans with expected issues, metrics and layouts, runnable with one command). Updated at the end of every phase (PRD §0.4 rule 6).

## After Phase 1

| Plan | Source | Expected (checked by the test named) |
|---|---|---|
| Sample A: one room | `engine/samples/1.2.0/a-one-room.plan.json` | Room 10.44 m²; built-up 13.66 m²; compound wall kept; exports to DXF and reads back identical (`rooms/derive.test.ts`, `library/tags.test.ts`, `dxf/export.test.ts`) |
| Sample B: 1BHK with T-junctions | `engine/samples/1.2.0/b-1bhk-t-junctions.plan.json` | Rooms 10.66 / 6.58 / 3.75 m²; built-up 26.35 m²; every plan-check rule triggers on a known edit; DXF round trip (`validate/validate.test.ts`, `dxf/export.test.ts`) |
| Sample C: L hall, duct, mixed walls | `engine/samples/1.2.0/c-l-hall-duct.plan.json` | Hall 32.46 m² with the duct as a hole, duct 0.25 m²; built-up 39.15 m² (`rooms/derive.test.ts`, `library/tags.test.ts`) |
| Sample D: open plan with a separator | `engine/samples/1.2.0/d-open-plan-separator.plan.json` | Living 8.99 / dining 9.21 / kitchen 10.66 m² split by separator SP1; without it, living and dining share one area (warning); DXF round trip keeps the separator (`rooms/derive.test.ts`, `dxf/export.test.ts`) |
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
| Every command three ways | `engine/commands/three-ways.test.ts` | 21 commands, each giving the same plan called directly, typed (`formatCommand` → `parseCommand`) and as a JSON tool call |
| Undo and history | `engine/commands/history.test.ts` | 50 steps undone and redone exactly; batch all or nothing; stale revision refused; retried request id applied once; gesture merging; per-author undo with skipped parts |
| Format 1.2.0 samples | `engine/samples/1.2.0/` | Samples A–D upgraded from 1.1.0 (empty annotation maps); same answers as above |

Run them with `npm test`. The founder's real drawings join this list once they are imported and reviewed.
