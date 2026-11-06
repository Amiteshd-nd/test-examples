# PRD — AI Floor-Plan CAD Engine (Working name: "PlanCraft")

> **Audience:** Claude Code (implementer) + the founder (product owner, architect).
> **How it's used:** Claude Code reads this file and executes it **one prompt at a time** (e.g. the founder types `Do P1.2`).
> **Companion files:** `CLAUDE.md` (standing rules), `text-to-cad-project-memory.md` (decisions & context), `fine-tuning-guide.md` (model training).
> **Version:** 1.2 · **Date:** 5 Nov 2026 · Clean version: the portability audit (P1–P12) and the review fixes (R1–R12) are merged into the text. History is in §11.

---

## 0. How to use this PRD

### 0.1 For the founder
1. Create a **new, empty repository** (project folder). Put `PRD.md`, `CLAUDE.md`, `text-to-cad-project-memory.md` and `fine-tuning-guide.md` in its root.
2. Open Claude Code in that folder.
3. Type the prompt ID, e.g. **`Do P0.1`**. Claude Code does that step only, then stops and reports.
4. When Claude Code says **🛑 STOP — founder input needed**, answer before continuing.
5. When Claude Code says **🧠 FINE-TUNE GATE**, open `fine-tuning-guide.md` (or a Claude chat) for the training step.
6. Never skip prompts. If something breaks, say: `Fix the failing step in P#.# and re-run its acceptance checks.`

### 0.2 For Claude Code (binding instructions)
- Execute **only the prompt ID requested**. Do not start the next prompt on your own.
- Before starting a prompt: read its **Goal, Tasks, Deliverables, Acceptance criteria, STOP points**.
- At every **🛑 STOP**, ask the founder the listed questions and wait. Do not guess answers to STOP questions.
- After finishing a prompt: run its acceptance checks, then update `PROGRESS.md` (create if missing) with: prompt ID, date, what was built, files changed, how to run/test, open issues.
- Explain results in **plain, non-technical language** first, technical details second. The founder is an architect, not a developer.
- Ask before adding any new dependency, paid service, or external API.
- Never put secrets (API keys, tokens) in code, commits, logs, or the browser bundle. Use `.env` + `.env.example`; keys are read **only by the server** (§3.5).
- Write tests for logic modules. Keep them passing.
- If a prompt is too large for one session, split it into sub-steps, finish and test each, and record progress.

### 0.3 Prompt format used in this PRD
Each prompt has: **Goal · Context · Tasks · Deliverables · Acceptance criteria · 🛑 STOP points** (if any).

### 0.4 Portability rules (binding for every prompt)
1. **Engine vs UI.** All logic (document, commands, geometry, rules, layout, solver, metrics, library retrieval, DXF in/out, AI tool handling) lives in `/engine` as plain TypeScript: data in, data out. `/engine` never imports React, the DOM, `fetch`, a database, or Node file/network APIs. The UI in `/frontend` and the server in `/server` only call the engine.
2. **One public door.** Hosts use only what `engine/index.ts` exports. Anything not exported is internal and may change freely.
3. **Plug-in points instead of built-ins.** Storage, accounts, file access, AI model access and clock/ids come in through small interfaces (§3.4). This repo supplies simple local implementations.
4. **Versioned format.** Every stored change bumps `schema_version` and adds a migration from the previous version, with a test.
5. **Few dependencies.** Prefer small, permissively licensed (MIT / Apache / BSD / Boost) libraries; ask before adding any. Never copy code from GPL or unlicensed projects.
6. **Keep the integration kit current:** at the end of every phase, update `INTEGRATION.md`, `SCHEMA-CHANGELOG.md` and the golden test plans (P10.6).

---

## 1. Product summary

### 1.1 One-liner
A browser-based CAD editor for **residential floor plans** where architects draw manually **or** instruct an AI in chat, with Finch-style **graph rules**, **live auto-layout**, **continuous reference checking**, a **Plan Library** of the firm's own plans, and **layered, print-ready DXF** output. Built around a **headless engine** that other editors can adopt. Starts with Gemini as the AI; later switches to our **own fine-tuned model**.

### 1.2 Target users (v1)
- Small architecture firms and independent architects (India first).
- Draftsmen and builders doing repetitive plot sizes (e.g. 30×40, 30×50, 40×60 ft).

### 1.3 Goals (v1)
1. Draw and edit plans manually with a focused toolset.
2. Edit plans through chat using **tool calling** (precise commands).
3. Generate 3–5 valid plan options from a brief (plot, BHK, facing, Vastu, floors).
4. Live **auto-layout reflow** when plot/rooms change.
5. **Continuous reference checks** against editable rule packs (bylaws, NBC, Vastu, firm standards).
6. Export **layered DXF** and **PDF** using print templates.
7. Capture structured plans + edit histories (with consent) to train our model.
8. Keep the engine **portable**: any host editor can adopt it through one entry file and one guide.

### 1.4 Non-goals (v1)
- 3D/BIM authoring, MEP, structural design, renderings.
- **DWG export** (DXF only in v1; AutoCAD opens DXF directly).
- Replacing the architect's sign-off or statutory approvals. The product never claims a plan is "code-compliant".
- Copying any competitor's interface, branding, or patented methods.

---

## 2. Research basis — Finch and what we adopt

### 2.1 What Finch does (public information)
- Swedish, architect-founded platform; plans generated using **AI + graph technology**.
- **Finch Graph:** rooms/objects and their relationships mapped as a graph; generated automatically — the user does not draw the graph.
- **Graph Rules, two stages:** (1) *informed generation* — rules like minimum areas, widths, accessibility shape what is generated; (2) *continuous compliance checking* — rules keep being checked as the user edits.
- **Plan Library:** firm's past plans + rules used as the base for every generation.
- **Adaptive reconfiguration:** moving a wall/stair reconfigures the plan logically rather than just stretching it.
- **Live metrics:** areas (GFA/NIA etc.), daylight, CO₂; options scored and compared.
- **Agent ("Archie"):** handles repetitive precision work — door placement, compliance checks, consistent updates.
- Workflow described as "a dance between generating and editing".

### 2.2 ⚠️ IP caution (must read)
Finch states it has **patented** its graph-based floor-plan generation system. We build our **own** implementation using general, well-established techniques (constraint satisfaction / optimisation, rule checking, retrieval). Before public launch, the founder should have an **IP lawyer run a patent / freedom-to-operate check** in target markets. Claude Code must not attempt to reproduce Finch's specific proprietary methods, UI, terminology-as-branding, or assets.

### 2.3 Concept mapping (Finch idea → our implementation)
| Finch concept | Our implementation | India-specific twist |
|---|---|---|
| Graph of rooms/relations | **Plan Graph** auto-extracted from the plan (P3.3) | Pooja, utility, OTS, sit-out, parking, store, staircase |
| Graph Rules – generation | Rule constraints fed to the **layout solver** (P5.3) | NBC / local bylaws, setbacks, FSI/FAR, Vastu zones |
| Graph Rules – checking | **Live reference-check panel** (P3.2) | Vastu score + bylaw pass/fail |
| Plan Library | **Plan Library** with retrieval + adaptation (P6) | Founder's 200 → 1,000+ plans; plot-size families |
| Adaptive reconfiguration | **Zone reflow** (P5.1) → **solver** (P5.3) | Front/middle/rear bands typical of Indian plots |
| Metrics & scoring | **Live metrics + option scoring** (P5.2) | Carpet / built-up / super built-up, FSI |
| Agent for precision work | **Chat agent with tool calling** (P4) | Mixed English / Indian-English phrasing |
| Native BIM export | **Layered DXF + PDF** (P7) | Indian layer & print standards |

---

## 3. System architecture

### 3.1 Layers
```
┌──────────── UI layer (/frontend, replaceable) ─────────────┐
│ canvas view · tool rail · chat panel · issues · gallery    │
└───────────────────────────┬────────────────────────────────┘
                            │ calls only engine/index.ts
┌──────────── Engine (/engine, headless TypeScript) ─────────┐
│ document + migrations · commands + undo · geometry          │
│ smart objects · rules + Vastu · plan graph · reflow/solver  │
│ metrics · library retrieval · DXF in/out · SVG render       │
│ AI tool handler (plan_read / plan_execute / plan_capture)   │
└───────────────────────────┬────────────────────────────────┘
                            │ plug-in interfaces (§3.4)
   DocumentStore · AuthContext · FileIO · ModelProvider · Clock/Ids
                            │
┌──────────── Thin server (/server, TypeScript) ─────────────┐
│ Phase 4: AI model proxy (holds API keys; OpenAI-compatible) │
│ Later: storage, accounts, consented logs, shadow mode       │
│ Never contains plan logic: it calls the engine or forwards  │
└─────────────────────────────────────────────────────────────┘

/tools (offline scripts): bulk import runner, dataset export, DXF verification (ezdxf), training notebooks
```

### 3.2 Tech stack
| Layer | Choice | Why |
|---|---|---|
| Engine | TypeScript, headless (`/engine`), strict mode | Portable; same language as UI, server and AI tools |
| Schemas | zod → JSON Schema | One definition for validation, commands and AI tools |
| Frontend | React + TypeScript + Vite | Common, well supported |
| Canvas | Our own (SVG or Canvas 2D) drawing what the engine returns | No foreign engine as bottleneck; CADCraft read for ideas only |
| Server | Thin TypeScript server (e.g. Node + Hono) | Keeps AI keys secret; later storage/accounts. No second runtime language |
| Geometry | Own geometry module + a polygon clipping library (e.g. Clipper, Boost licence) | Unions, offsets, overlaps in the browser |
| DXF | Own TypeScript reader/writer in the engine (a permissive DXF parsing library may be used — ask first) | Import and export work in the browser; one importer for user uploads and bulk import |
| DXF verification | ezdxf (Python) in `/tools` tests only | Strict independent check of our exports |
| Solver | TypeScript solver behind `solve(brief, options)`; CP-SAT (OR-Tools) as an optional service behind the same interface | See §3.3 and 🛑 P5.3 |
| PDF | A permissive JS PDF library (ask first) | Scaled print output in the browser |
| Storage | `DocumentStore` interface; local JSON files first; Postgres later on the server | Host can bring its own storage |
| LLM (now) | Gemini via its **OpenAI-compatible** endpoint, through the server proxy | Already used by founder; switching models = config |
| LLM (later) | Own fine-tuned model (Qwen first choice) served with vLLM (OpenAI-compatible) | See §6 gates |
| Tests | Vitest (`x.test.ts` beside `x.ts`); pytest only for `/tools` | Standard |

### 3.3 TypeScript vs the original Python plan: gains and losses
| | TypeScript engine (chosen) | Python backend (original) |
|---|---|---|
| Runs in the browser, works offline, small server bill | ✅ | ❌ needs a hosted server for everything |
| Easy to drop into a web editor | ✅ same language | ❌ needs a network API in between |
| Same schemas for UI, commands and AI tools | ✅ one definition (zod → JSON Schema) | ❌ defined twice |
| Ready-made strong solver (OR-Tools CP-SAT) | ❌ **the real loss**: TS solvers are weaker | ✅ |
| Geometry/DXF libraries (Shapely, ezdxf) | 🟡 must write more ourselves; Clipper covers polygons | ✅ mature |
| ML / training tools | ✅ unchanged: training stays in Python (Colab), offline | ✅ |

**How the loss is handled:** (1) start with a TypeScript solver (recursive subdivision + local search), enough for typical rectangular Indian plots; (2) the solver sits behind `solve(brief, options) → layouts[]`, so a CP-SAT service (Python, or the OR-Tools WebAssembly build) can be added **behind the same interface** later without touching anything else; (3) ezdxf still checks our DXF files in tests.

### 3.4 Plug-in interfaces (the host supplies these)
| Interface | What it does | Local version in this repo |
|---|---|---|
| `DocumentStore` | load / save / list plans, versions, library index | JSON files in `/data` (dev); server + Postgres later |
| `AuthContext` | who is the user, what they may do | single local user |
| `FileIO` | read an uploaded file, hand back a download | browser file picker / download |
| `ModelProvider` | send messages + tools to an AI model, get replies/tool calls | calls our server proxy, which calls Gemini's OpenAI-compatible endpoint |
| `Clock`, `IdSource` | time and new ids (so tests are repeatable) | `Date.now`, random ids; fixed versions in tests |
The engine only ever sees these interfaces, never a specific database, login system or model vendor.

### 3.5 The thin server — why it is needed from Phase 4
A browser app cannot keep an API key secret: anything in the frontend bundle (including Vite `VITE_*` variables) is visible to users. So from **P4.1**, AI calls go **browser → our server → model**. The server holds keys in `.env`, adds rate limits, and forwards OpenAI-compatible requests. It contains **no plan logic**. In later phases it also hosts `DocumentStore`/`AuthContext` for real users (P10.1), consented edit logs (P8.1) and shadow mode (P9.3). For the engine and editor alone (Phases 0–3, 5–7 offline), no server is required.

### 3.6 Single source of truth
The **Plan document (JSON)** is the source of truth. Canvas drawings are a *view* of it. It is versioned (`schema_version` + migrations), stores geometry in **centimetres** (displayed in m or ft-in), and every object has a **stable id** that never changes when the object is edited. Every manual edit and every chat edit goes through the same command layer, so undo/redo, checks and AI context always agree.

---
## 4. Core data model (v1)

### 4.0 Units and numbers
- All stored geometry is in **centimetres**, as numbers rounded to **0.1 cm (1 mm)**. Areas in **m²** (2 decimals).
- Display units are a user setting: m, or ft-in. Typed input in ft-in is converted on entry.
- Every rule value states its unit (`"unit": "cm" | "m2" | "%" | "ratio"`).

### 4.1 Plan document (draft — finalise in P1.1 with founder)
- **Walls** are centrelines (`start`, `end`) + `thickness`.
- **Rooms are derived from walls.** The stored room record holds identity and intent (`id`, `type`, `name`, `seed` point inside the room, behaviour, size range). Its polygon is **computed** from the walls (a cached `polygon` may be written for readers but is never authoritative).
- **Openings are hosted:** `wall` id + `offset` along the wall from its start (cm).
- Every value the AI or a default filled carries a provenance tag (§4.5).
```json
{
  "schema_version": "1.0.0",
  "meta": {"name": "", "bhk": 3, "floors": 1, "facing": "east", "vastu": true,
           "city": "TBD", "display_units": "m", "source": "library|generated|manual"},
  "plot": {"polygon": [[0,0],[914,0],[914,1219],[0,1219]], "road_sides": ["east"]},
  "setbacks": {"front": 150, "rear": 100, "left": 90, "right": 90},
  "levels": [{
    "id": "L0", "name": "Ground", "elevation": 0, "height": 300,
    "walls": [{"id": "W1", "start": [0,0], "end": [914,0], "thickness": 23, "type": "external"}],
    "rooms": [{"id": "R1", "type": "living", "name": "Living", "seed": [300, 400],
               "behavior": "fill", "locked": false,
               "size_range": {"min_w": 300, "max_w": 450, "min_area_m2": 12.0}}],
    "openings": [{"id": "D1", "kind": "door", "wall": "W3", "offset": 120, "width": 90, "swing": "in-left"},
                 {"id": "N1", "kind": "window", "wall": "W1", "offset": 200, "width": 150, "sill": 90}],
    "stairs": [{"id": "S1", "polygon": [[...]], "direction": "up"}],
    "fixtures": []
  }],
  "rule_pack_ids": ["nbc-default", "vastu-default", "firm-default"]
}
```

### 4.2 Plan Graph (derived, never hand-edited)
```json
{"nodes": [{"id": "R1", "type": "living", "area_m2": 18.2, "zone": "front", "exterior": true, "vastu_zone": "NE"}],
 "edges": [{"a": "R1", "b": "R2", "kind": "door|open|wall|adjacent"}]}
```

### 4.3 Rule (rule pack entry)
Thresholds live in data tables, not in code.
```json
{"id": "min_bedroom_width", "scope": {"room_type": "bedroom"},
 "check": "min_width", "value": 240, "unit": "cm", "severity": "error|warning|info",
 "category": "bylaw|geometry|brief|vastu", "source": "NBC 2016 Part 3 (verify)", "verified": false, "editable": true}
```

### 4.4 Commands (shared by keyboard, toolbar, command line, AI and hosts)
Each command is defined once: `{id, label, shortcut, params (zod schema), enabled(state) → {ok, reason}, run(doc, params) → changes}`. `run` is pure.
```json
{"op": "execute", "id": "MOVE", "params": {"ids": ["R3"], "from": [0,0], "to": [100,0]}, "revision": 42, "request_id": "…"}
```
- Positions in cm.
- `{"op": "batch", "steps": [...]}` runs several commands as **one undo step, all or nothing**.
- The same commands can be typed as text: `MOVE R3 0,0 100,0`.
- `revision` makes a call fail safely if the plan changed meanwhile; `request_id` makes a retry harmless.
- Undo stores per-step patches (before/after of changed objects, by id), not whole copies.

### 4.5 Issue and provenance formats
```json
{"rule_id": "min_bedroom_width", "severity": "error", "category": "bylaw",
 "message": "Bedroom 2 is 2.2 m wide; minimum is 2.4 m.", "object_ids": ["R4"],
 "how_to_fix": "Widen Bedroom 2 by 20 cm, e.g. move wall W7 20 cm east.", "source": "NBC 2016 Part 3 (verify)"}
```
```json
{"value": 300, "provenance": "measured|inferred|assumed", "reason": "Typed by architect"}
```
Every number the generator or AI produces carries a provenance tag; a value built from an assumed input is never labelled better than "assumed". UI wording: **"reference check"**, never "code-compliant".

### 4.6 Brief (input to generation; also the model's training target)
The engine's own brief type. The AI fills it; `solve()` consumes it; the training data uses it (P8.2), so model output plugs in with no converter.
```json
{"plot": {"width_cm": 914, "depth_cm": 1219, "road_facing": "east"},
 "setbacks_cm": {"front": 150, "rear": 100, "left": 90, "right": 90},
 "bhk": 3, "floors": 1, "vastu": true, "parking": 1,
 "rooms": [{"id": "living", "type": "living", "target_m2": 16},
           {"id": "kitchen", "type": "kitchen", "target_m2": 7.5},
           {"id": "bedroom-1", "type": "master_bedroom", "target_m2": 12}],
 "adjacency": [{"a": "kitchen", "b": "living", "rel": "door", "strength": "must"}],
 "locked_room_ids": []}
```

---
## 5. Phases and prompts

> Legend: 🛑 = stop and ask founder · 🧠 = fine-tune gate · ✅ = acceptance criteria

### Phase overview
| Phase | Name | Outcome | Fine-tune involvement |
|---|---|---|---|
| 0 | Setup & discovery | Repo, decisions, CADCraft reference review | — |
| 1 | Plan data foundation | Schema, DXF import/export, plan library import | 🧠 FT-0 (optional practice run) |
| 2 | Editor shell & design system | Our UI in founder's style, canvas, smart objects, tools | — |
| 3 | Rules engine | Rule packs, live reference checks, auto Plan Graph | — |
| 4 | Chat agent | Server proxy, 3 AI tools, router, clarifications | — |
| 5 | Layout engine | Reflow, metrics, solver, variations | — |
| 6 | Plan Library & generation | Retrieval, adaptation, brief → options | — |
| 7 | Export & print | Layer mapping, templates, DXF/PDF | — |
| 8 | Data flywheel | Edit history, dataset export | 🧠 FT-1 (real training) |
| 9 | Own model integration | Eval harness, shadow mode, switch | 🧠 FT-2, FT-3 |
| 10 | Beta hardening | Accounts, projects, privacy, launch, integration kit | — |

---

### PHASE 0 — Setup & discovery

#### P0.1 — Project setup and founder interview
**Goal:** Agree the starting point and create the repo skeleton.
**Tasks:**
1. 🛑 Ask the founder:
   - Do you have your existing editor code (Rayon-style editor + Gemini chat)? Where is it, and which parts should we reuse (chat UI, prompts, canvas ideas)?
   - Display units default: metres or feet-inches? (Storage is always cm.)
   - First target city for rule packs (e.g. Bengaluru/BBMP, Delhi/MCD, other)?
   - Do you have a Gemini API key ready? (It goes into `/server/.env` in P4.1 — never into chat, code or the frontend.)
2. Create the monorepo:
   ```
   /engine     headless TypeScript engine + tests (+ /engine/golden later)
   /frontend   React + TS + Vite — UI only; calls engine/index.ts
   /server     thin TypeScript server (created empty now; used from P4.1)
   /tools      offline scripts (bulk import runner, dataset export, ezdxf checks)
   /data       raw/, converted/, library/, exports/ — gitignored except samples
   /design     reference/ screenshots, DESIGN.md
   /docs       decisions/ (ADRs)
   PROGRESS.md, README.md, INTEGRATION.md, SCHEMA-CHANGELOG.md, THIRD_PARTY_NOTICES.md, .env.example
   ```
3. Add TypeScript strict mode, linting, formatting, Vitest, and one script (`npm run dev`) that starts the frontend.
4. Add an **engine-purity check** (lint rule or test) that fails if `/engine` imports React, DOM APIs, `fetch`, or Node `fs`/`net`/`http`.
**Deliverables:** skeleton repo, README with run instructions, PROGRESS.md.
**✅** `npm run dev` starts the frontend; tests run (even if empty); the engine-purity check passes.

#### P0.2 — CADCraft reference review (time-boxed)
**Goal:** Decide what, if anything, to port from CADCraft into our own TypeScript engine. Default decision: **own TypeScript engine; CADCraft is a reference.**
**Tasks:**
1. Clone CADCraft **read-only** into a scratch folder outside the repo; record the commit hash.
2. Read its design: command metadata, snapping and snap ranking, object tracking, trim/extend/fillet maths, hatch boundary tracing, DXF handling, undo model.
3. List candidates to port (idea only, or code with notice), with effort estimates.
4. Write ADR `/docs/decisions/0001-cad-engine.md`: decision, what we port, licence notes (MIT/Apache-2.0: keep notices in `THIRD_PARTY_NOTICES.md`), pinned commit.
**🛑** Present the list in plain language with a recommendation; founder confirms.
**✅** ADR written and confirmed; nothing from CADCraft is copied without its notice.

---

### PHASE 1 — Plan data foundation

#### P1.1 — Plan schema v1 + validator + migrations
**Goal:** Finalise the Plan document (§4.1) as a versioned schema.
**Tasks:**
1. zod models (JSON Schema generated from them) for Plan, Level, Wall, Room, Opening, Stair, Rule, Issue, Brief.
2. `schema_version`, a migration runner, and a test that every sample from older versions still loads.
3. Room types enum incl. Indian types: living, dining, kitchen, bedroom, master_bedroom, toilet, bath, wc, pooja, utility, store, staircase, sit_out, balcony, parking, ots (open-to-sky), study, foyer, passage, servant, duct.
4. Validator: geometry sanity (closed polygons, positive areas, openings within wall length, room seeds inside a closed region).
5. Room derivation: compute room polygons from wall centrelines/thickness and seeds.
6. 🛑 Show the founder the room-type list and fields in a simple table; ask what's missing (e.g. chajja/sunshade, sunken toilet, column grid).
**✅** Valid/invalid samples pass/fail correctly; room derivation correct on 3 hand-made plans; tests cover each rule.

#### P1.2 — DXF import (engine) + bulk import runner
**Goal:** Turn DXF drawings into Plan documents — the same importer for user uploads in the browser and for bulk import of the founder's library.
**Tasks:**
1. 🛑 Ask the founder to place 2–5 anonymised sample DXF files in `/data/raw/samples/` (convert DWG → DXF with ODA File Converter first) and to describe their layer naming (wall layer, door blocks, room-name text, etc.).
2. 🛑 Confirm the importer approach. Recommended: **one TypeScript importer in `/engine/dxf/import.ts`** (may use a permissive DXF parsing library — ask before adding), with `/tools/bulk-import` as a Node script that calls it for whole folders. Alternative: keep a separate Python/ezdxf bulk importer (two importers to maintain).
3. Detect: walls (polylines/lines/parallel pairs → centreline + thickness), rooms (closed polylines or wall-bounded regions + text labels → seed + type), doors/windows (blocks → hosted openings), stairs. Label → room type via a configurable mapping file.
4. Produce a **conversion report** per file: found / guessed (with provenance) / failed.
5. Produce an SVG preview per plan (engine SVG renderer) for visual checking.
**✅** All sample files convert; founder visually confirms previews match; reports list issues honestly.

#### P1.3 — DXF export (CAD Builder v0)
**Goal:** Clean, layered DXF from a Plan document, in the browser.
**Tasks:**
1. `engine/dxf/export.ts`. Internal object kinds map to layers through an **export mapping** (kind → layer name, colour, lineweight, linetype). Default mapping v0: `A-WALL`, `A-WALL-INT`, `A-DOOR`, `A-GLAZ`, `A-FLOR-STRS`, `A-AREA-IDEN` (room names/areas), `A-ANNO-DIMS`, `A-ANNO-TEXT`, `A-SITE-BNDY`, `A-SITE-SETB`.
2. Walls drawn as joined outlines (polygon union, no seams at corners), thickness from data (defaults 23 cm external / 11.5 cm internal). DXF units set to millimetres (cm × 10) unless the founder's template says otherwise.
3. **Verify every export:** re-read the written file with our importer, compare counts by type, refuse to download a file that lost data.
4. Round-trip test: DXF → doc → DXF → doc yields equivalent plans. In `/tools` tests, also open exports with ezdxf's strict reader.
**✅** Output opens in AutoCAD/LibreCAD with correct layers; round-trip and ezdxf checks pass.

#### P1.4 — Batch import + Plan Library index
**Goal:** Convert all available plans and index them.
**Tasks:**
1. Bulk import `/data/raw/**` → `/data/converted/`; summary report (success/partial/failed).
2. Auto-tag: plot size (ft & m), facing, BHK, floors, built-up area, Vastu flags (where derivable), each with provenance.
3. 🛑 Show the founder a tag-review table (CSV or simple page) to correct tags.
4. Save through `DocumentStore`; local version: `/data/library/*.json` + `index.json`.
**✅** ≥90% of plans convert at least partially; tags reviewed by founder.

> 🧠 **FT-0 — Optional practice run (tell the founder):**
> "Your plans are now in the engine's format. If you want to *learn* the training process, you can do a practice run with `fine-tuning-guide.md` using these ~200 plans. Expect memorisation, not real skill. This is optional and does not block the next phases." Then run **P8.2-lite**: export a small train/test JSONL (practice format, cm — see the guide §2.2).

---

### PHASE 2 — Editor shell & design system

#### P2.1 — 🛑 Founder interface screenshots → DESIGN.md
**Goal:** Our UI follows the founder's chosen visual style (not CADCraft's, not Finch's).
**Tasks:**
1. 🛑 Ask the founder:
   - "Please put 3–8 screenshots of the interface style you want in `/design/reference/` (e.g. main editor, toolbar, chat panel, side panels, dialogs, mobile if any) and tell me when done."
   - "Light, dark, or both?" · "Any brand colours/fonts/logo?" · "Anything you dislike in these references?"
2. Look at every screenshot. Extract into `/design/DESIGN.md`:
   - Colour tokens (background, surface, text, muted, accent, success/warning/error), dark-mode values.
   - Typography (families + fallbacks, sizes, weights, line heights).
   - Spacing scale, radii, borders, shadows, icon style, density.
   - Layout: where toolbar, canvas, chat, properties, issues panels sit.
   - Component specs: buttons, inputs, tabs, panels, chat bubbles, tooltips, modals.
3. Implement tokens as CSS variables + a small component library.
4. 🛑 Show the founder a static "style sheet" page with all components; get approval before building screens.
**✅** Founder approves the style sheet page.
**Rule for all later UI work:** follow DESIGN.md; if a new component is needed, design it in the same style and add it to DESIGN.md.

#### P2.2 — App shell
**Goal:** Main editor screen per DESIGN.md: top bar, tool rail, canvas, right panel (properties / issues / metrics tabs), chat panel, status bar (units, snap, zoom). The shell only arranges panels and calls the engine; no plan logic in components.
**✅** Responsive shell renders; panels collapse/expand; matches approved style.

#### P2.3 — Canvas
**Goal:** Render and navigate plans: pan, zoom, select, snap (grid/endpoint/midpoint/perpendicular), units display. The canvas draws what the engine returns.
**✅** A library plan loads through `DocumentStore` and renders correctly; 60 fps pan/zoom on a typical plan.

#### P2.4 — Smart objects + command layer
**Goal:** Walls, rooms, openings, stairs are smart objects bound to the Plan document.
**Tasks:**
1. Command bus in `/engine` (§4.4): every change = command → document patch → re-render.
2. Undo/redo across manual and chat edits, using per-step patches.
3. Wall joins (L/T/X), drawn as one joined outline (polygon union, no seams at corners); doors/windows hosted on walls (move with wall); rooms recomputed from walls.
**✅** Moving a wall updates adjacent room areas; door stays on its wall; undo/redo works 50 steps.

#### P2.5 — Minimal toolset
**Tools:** select, wall, line/polyline, rectangle, room, door, window, stair, move, copy, rotate, mirror, offset, trim/extend, delete, dimension, text, room label, layers panel, hatch.
**✅** Each tool works via mouse **and** is a command (usable from the command line and, later, the AI). Keyboard shortcuts documented. A test runs every command three ways (direct call, typed command line, AI tool call) and gets identical results.

---

### PHASE 3 — Rules engine (our "graph rules")

#### P3.1 — Rule packs
**Goal:** Editable rule packs that drive both checking and generation.
**Tasks:**
1. Rule schema (§4.3); results in the §4.5 issue format; thresholds in data tables. Packs: `nbc-default`, `city-<name>` (setbacks, FSI/FAR, coverage), `vastu-default`, `firm-default`.
2. Seed `nbc-default` with **starting values to verify** (NBC 2016 Part 3 as commonly cited), all `verified: false`: habitable room ≥ 9.5 m² (second room ≥ 7.5 m²), min width 240 cm; kitchen ≥ 5.0 m², width ≥ 180 cm; bath ≥ 1.8 m², width ≥ 120 cm; WC ≥ 1.1 m², width ≥ 90 cm; habitable ceiling height ≥ 275 cm.
3. Seed `vastu-default` (configurable): kitchen SE, master bedroom SW, pooja NE, main entrance N/E preferred, toilets avoid NE, staircase S/W/SW preferred.
4. 🛑 Ask the founder to review/correct every seeded value and add city bylaws for the first target city. Anything not confirmed stays `verified: false` and is labelled "unverified" in the UI.
**✅** Packs load; founder-approved values recorded with sources.

#### P3.2 — Live reference-check panel
**Goal:** Checks run while editing (Finch "stage 2" equivalent, our own implementation).
**Tasks:** run checks after every command (debounced); panel lists issues grouped by room, each with its how-to-fix sentence; click → zoom to issue; Vastu score; quick-fix buttons where the fix is deterministic (applied as one command batch).
**✅** Shrinking a bedroom below the minimum shows an issue within 300 ms; fixing it clears the issue.

#### P3.3 — Auto Plan Graph extraction
**Goal:** Derive the Plan Graph (§4.2) automatically.
**Tasks:** adjacency (shared walls), connections (doors/openings), exterior exposure, zones (front/middle/rear), Vastu zone (from facing + centroid); overlay toggle on canvas.
**✅** Graph matches founder's expectation on 5 sample plans (🛑 founder spot-check).

---

### PHASE 4 — Chat agent

#### P4.1 — Server proxy + model provider
**Goal:** All AI calls go through one interface and one server, so keys stay secret and Gemini can later be swapped for our model by config.
**Tasks:**
1. `/server`: minimal TypeScript server with one route that forwards OpenAI-compatible chat requests (messages + tools) to the configured model endpoint. Keys only in `/server/.env`. Add rate limiting and request size limits.
2. Engine side: `ModelProvider` interface; frontend implementation calls the server route.
3. Config: base URL, model name, key name — Gemini's OpenAI-compatible endpoint now.
4. Logging of prompts/outputs on the server only with the privacy setting on; never log keys.
5. 🛑 Ask the founder to put the Gemini key into `/server/.env` themselves (Claude Code must not ask for the key in chat).
**✅** A test conversation returns a valid tool call; the built frontend bundle contains no key (automated check).

#### P4.2 — AI tools (three tools over the command layer)
**Goal:** The AI can do everything the toolbar can, through **three tools**:
- `plan_read` — ops: `list_commands`, `query_objects`, `measure`, `area`, `issues`, `validate`.
- `plan_execute` — ops: `command_line`, `execute`, `batch`, `set_properties`, `undo`.
- `plan_capture` — returns a picture of the plan with numbered tags on objects (engine renders SVG; the frontend/server rasterises to PNG for the model).
`list_commands` is generated from the command schemas, so a new command reaches the AI automatically. The commands cover: create wall/room/rectangle/line/polyline, place door/window/stair, add text/dimension, name, select, move, copy, rotate, mirror, scale, array, offset, delete, resize/move/swap room, resize plot, set room behaviour, lock/unlock room, reflow, **GENERATE_LAYOUT** (takes a Brief, §4.6), generate variations, check plan, set layer, wall thickness default, units, apply print template, export DXF/PDF, undo/redo.
**✅** Each op has a schema, validation and a test; the agent cannot change the plan except through `plan_execute`.

#### P4.3 — Router (command vs design vs question)
- *Command* ("make a box named X, move it 2 m right") → `plan_execute`.
- *Design* ("3BHK on 30×40 east facing") → model fills a **Brief** (§4.6) → `GENERATE_LAYOUT` (pipeline in P6.3).
- *Question* ("what's the kitchen area?") → `plan_read`.
Mixed requests are split into parts.
**✅** Router accuracy ≥ 90% on a 50-example test set (founder helps write examples 🛑).

#### P4.4 — Clarifications, defaults, safety
**Rules:** missing numbers → ask (unless a project default exists); ambiguous words (e.g. "multiply" = scale or copy) → ask; announce defaults used (provenance "assumed"); confirm bulk deletes; unique names (suggest X-2); every chat action is one undo step (batch); show a short "what I did" summary after each action.
**✅** Scripted test conversations behave per rules.

---
### PHASE 5 — Layout engine

#### P5.1 — Zone-based reflow (v1 auto-layout)
**Goal:** Figma-auto-layout feel for typical rectangular Indian plots.
**Tasks:** bands front/middle/rear; room behaviours fixed / fill / range; locks; on plot or room resize → recompute; walls and openings follow. `reflow(doc, brief, change) → layout` is a pure function; its result is applied as **one command batch** (one undo step).
**✅** Dragging the plot edge from 30 to 35 ft reflows rooms with no overlaps; locked rooms don't move; checks re-run.

#### P5.2 — Live metrics
**Metrics:** plot area, setback-limited buildable area, ground coverage %, built-up area, carpet area per room/total, FSI/FAR, circulation %, Vastu score, issue count — each with provenance.
**✅** Metrics update live and match hand calculations on 3 test plans (🛑 founder verifies one).

#### P5.3 — Solver + variations
**Goal:** `solve(brief, options) → layouts[]`.
🛑 Ask the founder: "Start with a TypeScript solver in the browser (free, no server), or go straight to Google's CP-SAT as a small separate service (stronger, but a server to host)?" Recommended: TypeScript first; add CP-SAT behind the same interface only if the ✅ below is not met.
**Tasks:**
1. Variables: room x, y, w, h (grid-snapped, e.g. 7.5 cm or 3 in).
2. Hard constraints: inside buildable polygon, no overlaps, min/max sizes from rule packs, required adjacencies from the brief/Plan Graph, exterior wall for habitable rooms, locked rooms fixed, staircase rules.
3. Soft objectives (weighted): area targets, compactness, Vastu zone preference, circulation length, wet-wall grouping (kitchen/toilets sharing walls).
4. Variations: diverse solutions (diversity constraints).
5. Score each option; show in a **variations gallery** with metrics. Choosing an option applies it as one command batch.
**✅** For 5 founder-provided briefs, returns ≥3 valid, visibly different options in < 10 s each.

#### P5.4 — Behaviour UI
**Goal:** Per-room controls: fixed/fill/range, lock, target area, preferred zone; "regenerate around locked rooms".
**✅** Founder can lock kitchen + stair and regenerate the rest (🛑 founder test).

---

### PHASE 6 — Plan Library & generation

#### P6.1 — Library retrieval
**Goal:** Find the most relevant library plans for a brief (plot size, facing, BHK, floors, road side, Vastu). Runs in the engine over the library index.
**✅** Top-5 results judged relevant by founder on 10 briefs (🛑).

#### P6.2 — Plan adaptation
**Goal:** Adapt a library plan to a new plot (e.g. 30×40 → 32×45): plan → Plan Graph → Brief with the original topology → solve for the new boundary → check rules.
**✅** Adapted plans keep the original's room relationships and pass checks on 5 test cases.

#### P6.3 — Generation pipeline (`GENERATE_LAYOUT`)
```
chat request → model fills a Brief (§4.6)
            → retrieve similar library plans (P6.1) → adapted Briefs (P6.2)
            → solve() each candidate (P5.3) → rule checks (P3) → score → top 3–5 options
```
- Model's job = **interpret the request and fill the Brief (room graph)**, NOT draw coordinates.
- Solver's job = exact geometry. Checker's job = report issues honestly.
**✅** End-to-end: typing "3BHK, 30×40 ft, east facing, Vastu, car parking" produces 3–5 valid options in the gallery; the chosen option is editable and undoable in one step.

---

### PHASE 7 — Export & print

#### P7.1 — Layer mapping & print templates
**Tasks:** template format (internal kind → layer name, colour, lineweight, linetype, plot style); default template; firm can upload/edit their own; `apply_print_template` command. Internal layers stay simple; office standards are applied **on export only**.
**🛑** Ask founder for their office layer list, lineweights and title block (sample DXF or PDF).
**✅** Exported DXF uses the founder's layers/lineweights exactly; export verification (P1.3) still passes.

#### P7.2 — Annotation
**Tasks:** auto dimensions (overall, room, opening), room name + area labels, north arrow, door/window schedule tags, title block with project fields, and a "design aid — architect must verify" note.
**✅** Founder confirms a sample sheet is "site-ready" (🛑).

#### P7.3 — Exports
**Tasks:** DXF (primary, verified on every export), PDF at scale (1:50 / 1:100) on A3/A2, PNG preview. DWG is out of scope for v1 (AutoCAD opens DXF).
**✅** PDF prints at correct scale (measured); DXF opens cleanly in AutoCAD.

---

### PHASE 8 — Data flywheel

#### P8.1 — Edit-history logging (with consent)
**Goal:** Record how plans are built and edited (command sequences) — valuable training data.
**Tasks:** opt-in consent toggle per user/project; command logs linked to plan versions; anonymise (strip names/addresses); export/delete my data. Local mode stores logs through `DocumentStore`; collecting logs from beta users requires the server storage of P10.1 (build the storage part here if P10.1 is not done yet — 🛑 confirm with founder).
**✅** Logs captured only when consent is on; deletion works.

#### P8.2 — Dataset export
**Goal:** Produce training data exactly as `fine-tuning-guide.md` expects.
**Tasks:**
1. Export **by plan** into `train.jsonl` / `test.jsonl` (85–90 / 10–15), never splitting one plan's phrasings across files.
2. 3–5 auto-generated request phrasings per plan from tags (English + Indian-English variants, ft and m).
3. Two target formats (configurable), both in **cm**:
   - **Graph target (recommended, real run):** the engine's **Brief** (§4.6), so model output feeds `solve()` directly.
   - **Practice target (FT-0 only):** simplified rectangles `{"plot": {"width_cm", "depth_cm", "facing"}, "rooms": [{"type", "x", "y", "w", "h"}]}` (room bounding boxes) — matches the guide's scorer.
4. Augmentation: mirror/rotate with **facing & Vastu labels recomputed**; mark augmented rows.
5. Dataset card: counts, distributions (plot sizes, BHK, facing), licence/source of each plan.
**✅** Files validate against the guide's formats; a 10-line sample is shown to the founder.

#### P8.3 — Dataset dashboard
**Goal:** Show how close we are to the fine-tune gate: total plans (original vs augmented), coverage by plot size/BHK/facing, gaps.
**✅** Dashboard shows counts and highlights under-represented categories.

> 🧠 **FT-1 — Real fine-tuning gate. Tell the founder when ALL are true:**
> - ≥ **1,000 original plans** (not counting augmentation) in the library, reasonably spread across plot sizes, BHK and facings;
> - P8.2 export works (graph target);
> - the Gemini pipeline (P6.3) is live, so we have a baseline to beat.
>
> **Message to founder:** "You've reached the fine-tuning gate. Next step happens outside this codebase: follow `fine-tuning-guide.md` (or open a Claude chat with that guide + the memory file) to train the model on the exported dataset using the **graph target**. Bring back: the private Hugging Face model name and the evaluation scores. Then run P9.1."
> If not yet met: report what's missing (e.g. "need ~300 more 30×50 east-facing plans") and continue with Phase 10.

---

### PHASE 9 — Own model integration

#### P9.1 — Own-model endpoint
**Goal:** Use the founder's model through the same `ModelProvider` and server proxy.
**Tasks:** 🛑 ask the founder which hosting to use (self-hosted vLLM or a hosted-inference service) — pick one with an **OpenAI-compatible API**, so this is configuration only; route the **design path** (Brief filling) to it; commands can stay on Gemini initially.
**✅** Design requests can be routed to either model via config.

#### P9.2 — Evaluation harness
**Goal:** Decide objectively whether our model beats Gemini.
**Metrics on held-out briefs:** valid Brief %, check pass rate after `solve()`, request match (BHK, facing, required rooms), diversity of options, latency, cost per request, and **architect blind review** (founder + 2–3 architects rate 1–5 without knowing the source 🛑).
**✅** Report table: Gemini vs own model on every metric.

> 🧠 **FT-2 — Switch gate:** proceed to P9.3 only if the own model **matches or beats Gemini on blind review** and is **not worse on check pass rate**, with acceptable latency/cost. Otherwise tell the founder what to improve (more data in weak categories, more epochs, larger base model, RL with checker reward) and loop back to `fine-tuning-guide.md`.

#### P9.3 — Shadow mode
**Goal:** Run the own model silently alongside Gemini on real traffic (server-side, with consent) for ~2 weeks; log both outputs and user choices.
**✅** Shadow report shows own-model options chosen/edited at least as often as Gemini's.

> 🧠 **FT-3 — Go-live gate:** if shadow results are positive, switch the design path default to the own model; keep Gemini as fallback; schedule retraining monthly/quarterly using P8.2 exports.

#### P9.4 — Switch + fallback
**✅** Config flag switches default; automatic fallback to Gemini on errors/timeouts; monitoring for error rate and latency.

---

### PHASE 10 — Beta hardening & launch

#### P10.1 — Accounts & projects
Sign-up/login, projects, versions, autosave, sharing (view/comment) — implemented on the server behind `AuthContext` and `DocumentStore`, so a host can swap in its own accounts and storage.
#### P10.2 — Privacy & security
Data processing notice, consent controls (P8.1), encryption at rest, backups, rate limits, no plan data in URLs, secrets only in server `.env` / a secrets manager.
#### P10.3 — Telemetry & feedback
Error tracking, privacy-respecting usage analytics, in-app feedback, "report bad output".
#### P10.4 — Beta programme
Onboarding for 10–20 architects/builders (project memory §11.4), feedback survey, willingness-to-pay questions.
#### P10.5 — Pricing & billing (🛑 founder decides model)
#### P10.6 — Integration kit
**Goal:** any host editor can adopt the engine, and later upgrades, without guesswork.
**Tasks:** (1) `engine/index.ts` exports the public API only; (2) `INTEGRATION.md`: what the engine does, the data format and its versions, every command and its schema, the plug-in interfaces, events the UI can listen to, how to run the golden tests; (3) `SCHEMA-CHANGELOG.md`: every format change with its migration; (4) `/engine/golden/`: 20+ plans with expected issues, metrics and layouts, runnable with one command; (5) the engine builds as an npm-style package (`/engine/package.json`, ES modules, type declarations).
**✅** A fresh empty Vite app can install the engine package, load a golden plan, run a command, export DXF and pass the golden tests, using only `INTEGRATION.md`.

**✅ for Phase 10:** a non-technical beta user can sign up, generate a plan, edit by hand and chat, see reference checks, and export a site-ready DXF/PDF without help.

---

## 6. Fine-tune gates — summary for Claude Code

| Gate | When | What Claude Code tells the founder |
|---|---|---|
| **FT-0** | End of P1.4 | Optional practice run with ~200 plans; export practice JSONL (cm) |
| **FT-1** | End of P8.3 + ≥1,000 original plans + Gemini pipeline live | Run `fine-tuning-guide.md` with the **graph target** (Brief); bring back model name + scores |
| **FT-2** | After P9.2 | Switch only if own model ≥ Gemini on blind review and check pass rate |
| **FT-3** | After P9.3 shadow mode | Make own model default; keep Gemini fallback; schedule retraining |

Claude Code must **check gate conditions at the end of every phase** and mention progress toward the next gate (e.g. "Library: 640/1,000 original plans").

---

## 7. Non-functional requirements
- **Performance:** canvas 60 fps for plans up to ~2,000 entities; checks < 300 ms; reflow < 500 ms; solver variations < 10 s each.
- **Reliability:** autosave every 30 s; no data loss on refresh; undo/redo 50+ steps; batches all-or-nothing.
- **Accuracy:** geometry tolerance 1 mm (0.1 cm); exported dimensions exact; every export verified.
- **Privacy:** plans private by default; training use only with explicit consent; anonymisation before dataset export.
- **Security:** no secrets in the frontend bundle; keys only on the server.
- **Accessibility:** keyboard shortcuts, readable contrast per DESIGN.md.
- **Portability:** the engine has no UI, network, database or file-system code; hosts use only `engine/index.ts`; storage, auth, files and models come in through §3.4 interfaces.

## 8. Risks & mitigations
| Risk | Mitigation |
|---|---|
| TypeScript solver not strong enough | Solver behind one interface; add CP-SAT service later without other changes |
| DXF parsing edge cases in TypeScript | Permissive parser library (if approved) + conversion reports + ezdxf cross-checks in `/tools` |
| AI key exposure | Server proxy from P4.1; automated bundle check |
| Finch patent / IP | Own implementation with general techniques; FTO check by IP lawyer before launch |
| Inconsistent founder DXF layers | Mapping file + conversion reports + manual review |
| Rule values wrong | Founder verifies every seeded rule; sources recorded; "unverified" labels |
| Thin training data | Plan Library + solver work without fine-tuning; flywheel; augmentation; graph target |
| Gemini cost/latency | Caching, smaller prompts, retrieval; later own model |
| Users treat output as approved drawings | "Reference check" wording; "design aid — architect must verify" on exports |

## 9. Open questions (track in PROGRESS.md)
1. CADCraft: what to port (P0.2). Default: own TypeScript engine.
2. DXF importer: one TypeScript importer (recommended) or a separate Python bulk importer (P1.2).
3. Solver: TypeScript first or CP-SAT service (P5.3).
4. First target city bylaws (P0.1/P3.1).
5. Founder's office layer standard + title block (P7.1).
6. Hosting for the server and, later, the own model (P4.1/P9.1).
7. Pricing model (P10.5).

## 10. Glossary (plain language)
- **Plan document:** the plan written as structured text — rooms, walls, doors — the "truth" behind the drawing.
- **Headless engine:** the part that does the work, with no screens; any app can put its own screens on top.
- **Plug-in interface:** a small, fixed way for the host app to supply storage, login, files or AI models.
- **Plan Graph:** a map of which rooms connect or touch; used for checks and generation.
- **Brief:** the structured description of what to design (rooms, sizes, connections, plot) — what the AI fills and the solver draws.
- **Rule pack:** a list of design rules (bylaws, NBC, Vastu, firm standards) the system checks.
- **Solver:** software that finds room positions satisfying the rules.
- **Tool calling:** the AI picks from a fixed set of editor actions instead of drawing freely.
- **Router:** decides whether a chat message is a command, a design request, or a question.
- **Server proxy:** a small program on our server that holds the AI key and passes requests to the model.
- **Fine-tuning:** teaching an open model from our plan data so it fills better Briefs.
- **Shadow mode:** running the new model quietly next to the old one to compare before switching.

## 11. Change log
- **v1.2 (5 Nov 2026):** Clean version — portability audit merged into the text (no strikethroughs). Review fixes R1–R12: thin server proxy from P4.1 for API keys (R1); stale architecture/stack removed, sections renumbered (R2); data-model examples in cm, rule units, rounding, room seeds (R3); one TypeScript DXF importer recommended (🛑 P1.2) (R4); P0.2 rewritten as a reference review (R5); P2.3 loads via `DocumentStore` (R6); DWG out of scope v1 (R7); `GENERATE_LAYOUT` takes a Brief; Brief type added §4.6 (R8); server needed for consented logs/shadow mode (R9); `plan_capture` = engine SVG, rasterised outside the engine (R10); "reference check" wording throughout (R11); practice-run dataset format in cm matching the guide's scorer (R12).
- **v1.1 (4 Nov 2026):** Portability audit P1–P12: TypeScript headless engine; CADCraft as reference; cm + versioned format with stable ids; rooms from walls, hosted openings; command layer with one undo step per command and 3 AI tools; OpenAI-compatible model access; plug-in interfaces; issue + provenance formats; layer mapping on export with verification; integration kit; training data in the engine's Brief format.
- **v1.0 (4 Nov 2026):** First version. Phases 0–10, prompts, Finch research basis, fine-tune gates FT-0…FT-3, design-from-screenshots step.
