# ADR 0001 — CAD engine: our own TypeScript engine; CADCraft as reference

- **Status:** Accepted — confirmed by the founder 2026-11-06 (P0.2 🛑)
- **Date:** 2026-11-06
- **Prompt:** P0.2 — CADCraft reference review (time-boxed)

## Context

PRD v1.2 defaults to writing our own headless TypeScript engine and using CADCraft only as a reference (PRD §3, §9 question 1). P0.2 checks that default against CADCraft's actual code and lists what, if anything, is worth porting.

**What was reviewed**
- Repo: https://github.com/storytold/cadcraft
- **Pinned commit: `3b7eb1bb7bcbb5dd9a4f71ac1997f0e31105f2e82`** (2026-11-05, "Merge pull request #2842 from storytold/stack/s2")
- Cloned read-only into a scratch folder outside this repo. Nothing was copied into the repo.
- Size: about 250,000 lines of Rust in 12 library crates and 3 apps. It is an AutoCAD-parity desktop CAD (egui/wgpu UI, WASM web build).
- Licence: MIT OR Apache-2.0 at our option, copyright "ArtCraft Team and the CADCraft contributors". Exceptions:
  - The ArtCraft brand assets are not open source.
  - The DWG bridge uses `acadrust` under MPL-2.0 (weak copyleft).

**Areas read (PRD P0.2 task 2):**
- command metadata
- snapping and snap ranking
- object tracking / polar / ortho
- trim / extend / fillet / offset maths
- hatch boundary (region) tracing
- DXF reading and writing
- the undo model

Grips, selection and associativity were also skimmed.

## Decision

1. **Own TypeScript engine (confirms the PRD default).**
   - CADCraft's engine is Rust and tied to AutoCAD's entity model and system variables. It has no notion of walls, rooms or hosted openings.
   - Running it as our core (WASM) would put a 250k-line foreign engine under every feature. That is the bottleneck PRD §3 rules out.
2. **Port two self-contained pieces as code, with the MIT notice**, each when its prompt starts:

   | # | Piece | CADCraft source (at the pinned commit) | Our target | Effort | Prompt |
   |---|---|---|---|---|---|
   | C1 | DXF tag reader/writer: ASCII + binary tags, sections, code pages, hostile-input limits | `crates/dxf/src/{lib,codepage,version}.rs` (~1,440 lines, no other CADCraft dependency) | `engine/dxf/tags.ts` | 2–3 days (1–2 without binary DXF) | P1.2, P1.3 |
   | C2 | Planar region tracing: split segments at crossings, merge vertices, find the face around a seed point, islands, gap closing | `crates/geom/src/region.rs` (core ~350 of 871 lines) | `engine/geometry/region.ts` | 2–3 days | P1.1 (rooms), P7 (hatch) |

   - C1 is still weighed against an npm DXF parser at the P1.2 🛑, where the PRD already asks for confirmation. Porting gives input limits, binary DXF and code pages for the bulk importer; a library is less work up front.
   - C2 gets two fixes the review found:
     - split collinear overlapping segments (CADCraft skips parallel pairs, so overlapping wall faces can break the trace);
     - merge vertices on our 0.1 cm grid (integer mm) instead of float bins.
3. **Reuse ideas only (no code, no notice needed):**

   | # | Idea | Prompt |
   |---|---|---|
   | I1 | One command list feeds menus, keys, aliases and AI. `enabled()` returns a reason when disabled. One `execute(id, params)` entry for every channel. Target defaults to the current selection. | P2.4, P4.2 |
   | I2 | Undo step = snapshot "before", run, roll back on **any** error (stricter than CADCraft, which rolls back only on panics), run derived passes (room re-derivation, hosted openings) inside the same step, record a step only if something changed; a group collapses many steps into one. | P2.4, P4.2 |
   | I3 | Snap ranking: candidates within the aperture, score = distance − 0.15 × aperture for endpoint and intersection only, lowest wins. Nearest is a last resort. As a pure engine function. | P2.3 |
   | I4 | Tracking / polar / ortho: path = point + direction + kind + source; resolve path×path, then path×object, then nearest-on-path; object snap beats tracking; ortho turns polar off. | P2.5 |
   | I5 | Grip mode → transform matrix; window = fully inside, crossing = touches real geometry (bounding box only as a quick first filter). | P2.5 |
   | I6 | Trim / extend / line–line fillet / offset maths (textbook formulas). | P2.5 |
   | I7 | DXF writer pitfalls that make AutoCAD reject or hang on a file: R2000 CLASS records without group 91; copy the current dimension style's DIM* variables into the header; model-space PLOTSETTINGS plot type 1; justified TEXT needs group 11; LWPOLYLINE extrusion (0,0,−1) mirrors x and flips bulges. | P1.2, P1.3 |
   | I8 | Round-trip check: re-read, match by handle or content with tolerance, sort differences into categories, plus a "census" of raw file counts vs what was read. | P1.3 |
   | I9 | Test style: seeded property tests plus hostile inputs (NaN, ∞, 1e300, huge coordinates) that must never crash. | all |

4. **Not taken:**
   - the DWG bridge (`acadrust`, MPL-2.0; DWG is out of v1 anyway);
   - the egui UI, icons and fonts (our UI follows `/design/DESIGN.md`, CLAUDE.md rule 7);
   - AutoCAD command names, LISP, block editor, isometric grid, apparent-intersection and deferred-tangent snaps;
   - the generic numeric curve-fillet solver;
   - their R-tree port (an npm spatial index would be used instead, asked for when needed);
   - the ArtCraft brand.
5. **Not in CADCraft at all, built fresh:**
   - wall/room/opening detection from DXF (P1.2);
   - wall outline union with clean L/T/X corners (P2.4: a polygon-clipping library such as Clipper2's JS port or `polygon-clipping`, asked for at P2.4);
   - hosted openings;
   - the atomic multi-operation `plan_execute` (P4.2). CADCraft's MCP batch is not atomic.
6. **Licence handling.** When C1 or C2 is ported, the same change adds an entry to `THIRD_PARTY_NOTICES.md` with the MIT licence text, the copyright line, the source paths and this pinned commit, and a header comment in each ported file naming its source. Nothing from CADCraft is in the repo until then.

## Alternatives considered

- **CADCraft as the engine (WASM), our UI on top.** Rejected:
  - it is AutoCAD-shaped, not plan-shaped;
  - it is pre-alpha and changing daily (PR #2842 on the review day);
  - Rust + WASM adds a second language and toolchain;
  - it fails PRD §0.4 rule 1 (an engine others can adopt as plain TypeScript).
- **Drive CADCraft through its MCP / JSON control channel.** Rejected for the same reasons, plus there is no atomic batch.
- **Port nothing, ideas only.** Viable. C1 and C2 are offered because each saves real time on well-tested, edge-case-heavy code, but either can be dropped at its prompt's 🛑 with no other change.

## Consequences

- The engine stays pure TypeScript with zero Rust/WASM.
- Estimated saving from the review: about 4–6 days from the two ports and 10–15 days of design work from the ideas, mostly in P1.2–P1.3 and P2.3–P2.5.
- The pinned commit above is the only CADCraft version we reference. Re-reviewing a newer one is a new ADR.
- Phase 1 risk noted from CADCraft's own docs: their DXF support is tested only on synthetic files. We need the founder's real DXFs early (P1.2) and ezdxf checks in `/tools` (P1.3).
