# Text-to-CAD Floor Plan Project — Project Memory

> Running memory file for this project. Upload this file at the start of every new Claude chat so the work continues from here.
> **Last updated:** 7 Nov 2026 · **Version:** v45 (repo log) + c20 (chat log) — see §14

> 🟩 **ADDED (v12):** reviewed so the engine can later be plugged into other editors easily. Marks: 🟩 ADDED / 🟨 CHANGED / 🟥 REMOVED, ids `[Px]` explained at the top of `PRD.md`. Older sections are history; where this file and `PRD.md` disagree, the latest PRD wins.

> **Current decisions at a glance (v13 — read this first; details in `PRD.md` v1.2):**
> - Own **headless TypeScript engine** (`/engine`); UI in `/frontend`; a **thin TypeScript server** (`/server`) from Phase 4 to hold AI keys; Python only for offline tools and training.
> - CADCraft = **reference only** (port ideas/code with licence notice).
> - Plan document: **cm**, stable ids, versioned with migrations; rooms derived from walls; openings hosted on walls.
> - Every change = a **command** (one undo step); AI uses **3 tools** (`plan_read`, `plan_execute`, `plan_capture`).
> - Generation: AI fills a **Brief** → `solve()` → checks → 3–5 options. Training target = the same Brief.
> - Models via **OpenAI-compatible** API: Gemini now; own model (Qwen first choice) later via vLLM.
> - DXF import/export in the engine (one importer recommended); **DXF only in v1** (no DWG).
> - Wording: **"reference check"**, never "code-compliant".
> - **Addendum A1 (`PRD-ADDENDUM-3D-PRESENTATION.md`):** 3D model derived from the 2D plan (three.js viewer), presentation render styles (white model, material axo, line drawing, diagram tints, exploded/analytical views, optional photoreal/AI with "not to scale" label), and a sheet/board builder with live-linked frames and PDF export. Phases 11–13, recommended after Phase 7. Reference images = style only.
> - **Addendum A2.1 (`PRD-ADDENDUM-A2-VAULT.md`):** Vault landing dashboard (workspace switcher, ⌘K, Home, Ask AI, Plan Library, Templates, projects tree, folder tiles in 3 variants, files table with owner/edited/branches/status). Versions & Figma-style branches (visual diff, three-way merge, review, protected main). Multiplayer: server-ordered commands, property-level resolution, rebase by re-running commands, CAD conflict table, locks, presence, offline → branch. **Mentor amendments M1–M12** (id-keyed maps + fractional index, deterministic commands + ULIDs, room separator lines, geometry kernel P1.1b, typed precision input, R-tree + incremental recompute, gesture coalescing, per-user undo, changesets diff/apply/invert/merge3, `.plancraft` package, accounts before Phase 15, continuous save). Phases 14–16 + beta build order + MVP line (branches before live multiplayer).
> - **Addendum A3 (`PRD-ADDENDUM-A3-ICONS.md`):** duotone icon system — Phosphor Icons (MIT, duotone weight) for common icons + custom CAD icons (wall, door, window, stair, separator, trim, offset, dimension, setback, Vastu compass, generate-layout…) in one style; colours from `DESIGN.md` accent; `Icon` component + registry; prompts PI.1–PI.4; 12 starter SVGs.
> - **Skill `plancraft-ux-refine`** (`.claude/skills/plancraft-ux-refine/SKILL.md`): senior product-design review — quick pass after every UI prompt, full audit per UI phase; 3-tier design tokens (base → semantic → component, DTCG-style JSON, themes/density/UI scale by re-mapping semantics, TOKEN-INDEX + lint); 4 px spacing system with starting paddings per component; state matrix (hover 8% / focus 10% / pressed 10% / dragged 16%); WCAG 2.2 AA (24 px targets, drag alternatives, focus not obscured); personas incl. senior AutoCAD draftsman (command aliases, Enter repeats, Esc cancels, window vs crossing selection); task scripts; audit report format. **Amends A2.1 diff colours** to colour-blind-safe blue / vermillion / amber + glyphs.

## 0. Start here — new session bootstrap (read first)

**If you are a new Claude session (chat or Claude Code):**
1. Read this memory file's "current decisions" box above, then this section.
2. Read the spec documents in the order of the table below. Newer versions win on conflicts; spec documents win over this memory file.
3. If the repo is available, read `PROGRESS.md` to see which prompt was last completed (the founder answered P0.1 question 1 with "Yes, I'll share later" — old editor code is on another machine; legacy prompts/examples will go to `/docs/legacy/` before Phase 4). **In Claude Code, read `HANDOFF.md` first** (current prompt, next steps, gotchas) and **`SESSIONS.md`** (several sessions may share the folder).
4. Ask the founder which prompt to continue with; do not restart finished prompts.
5. Explain in plain language (the founder is an architect, not a developer).

**Document map (current versions, all in the repo root unless noted):**
| File | Version | Purpose |
|---|---|---|
| `CLAUDE.md` | repo copy (6 Nov) | Standing rules for Claude Code; lists every spec document incl. A3.1 and the skill. (The chat-side v1.3 rewrite was not merged; the repo copy keeps its own rules and repo-docs section.) |
| `PRD.md` | 1.2 | Core spec: phases 0–10, portability rules, data model, fine-tune gates |
| `PRD-ADDENDUM-3D-PRESENTATION.md` | A1.0 | 3D model/viewer, render styles, sheets & boards (phases 11–13) |
| `PRD-ADDENDUM-A2-VAULT.md` | A2.2 | Vault dashboard, versions & branches, multiplayer (phases 14–16); mentor amendments M1–M12; beta build order; MVP line |
| `PRD-ADDENDUM-A3-ICONS.md` | A3.1 | Icon system: Phosphor (MIT) + custom CAD icons; prompts PI.1–PI.4; 12 starter SVGs |
| `PRD-ADDENDUM-A4-MOBILE-VIEWER.md` | A4.0 | Mobile companion viewer (Phase 17, PM.0–PM.7): view & share only, never edit (enforced on the server); share links open in any browser; offline snapshots; site mode. Tech stack deliberately undecided (PM.0 🛑). Build after the desktop beta, P10.1 and Phase 15. **Not being built now** (founder, 6 Nov 2026); rules for when it is: `docs/design/mobile-viewer-rules.md` |
| `PRD-ADDENDUM-A5-ATOMIC-DESIGN-SYSTEM.md` | A5.0 | Atomic design structure on top of the tokens (atoms → molecules → organisms → templates → pages); prompts PA.1–PA.5. **Check-first:** PA.1 audits and reports, nothing moves or is renamed until the founder approves the plan. Adopted 7 Nov 2026; PA.1 runs when the founder asks |
| `.claude/skills/plancraft-ux-refine/SKILL.md` | 1.2 | UX review skill: as-built index, 3-tier tokens, spacing, states, accessibility, personas |
| `fine-tuning-guide.md` | 1.2 | Model training steps (Colab), practice vs real run, scoring |
| `docs/design/AUDIT-SUMMARY.md` | — | Plain-language summary of the portability audit and review fixes R1–R12 (moved from the root in P0.1) |
| `text-to-cad-project-memory.md` | this file | Context, decisions, history |
| `HANDOFF.md`, `SESSIONS.md`, `PROGRESS.md`, `TASKS.md`, `DECISIONS.md`, `MEMORY.md`, `ARCHITECTURE.md` | repo | Claude Code's working docs: where we are, who edits what, per-prompt log, to-dos, decisions D-xx, working facts, what is built |
| `design/DESIGN.md` | repo | The approved look (P2.1, P14.1); `design/tokens/` holds the skill's token work (as-built index first) |
| `/design/reference*/` | — | Founder's reference images (style only): interface, 3D, Vault, icons |

**Open decisions waiting for the founder:** brand accent colour (green from icon reference vs orange from folder reference); default theme (dark/light); first target city for bylaws; DXF importer approach (P1.2); solver choice (P5.3); hosting for server and own model.
> **Repo status of these (6 Nov 2026):** already decided — first city **Bengaluru (BBMP)** (D-02); **one TypeScript DXF importer** (D-16); themes **light and dark**, editor light-first, Vault **dark** by default (D-23, D-28); the one accent in `DESIGN.md` is **blueprint blue `#8080dd`** (D-23), so for icons PI.1 only has to confirm that icons use it (green and orange come from reference images). Still open: solver choice (P5.3), hosting for server and own model.

**Where things stand (7 Nov 2026, end of Build session 3)** — details in `HANDOFF.md`, `PROGRESS.md`, `SESSIONS.md`:
- **Done:**
  - Phase 0, Phase 1 (plan data, DXF in/out, Plan Library), **Phase 2 (editor)** and **Phase 14 (Vault dashboard)**.
  - Phase 2 in short: shell, canvas, Figma-style hideable panels (P2.2a), every change a command with per-person undo / redo (P2.4), and the toolset (P2.5). The toolset has 20 tools with AutoCAD-style keys; typed lengths while drawing (450 ↵, 4.5m, 15'6", 450<90, @dx,dy); editable lengths and dimensions in Properties; lines, dimensions, notes and hatches; Help with every key.
  - Plan format is now **1.3.0**: annotations (1.2.0) and road width on the plot (1.3.0). Older files upgrade themselves.
  - **Browser tests** with Playwright (`npm run test:e2e`, 21 tests). Unit tests: `npm run check`, 379, all green.
- **In progress — P3.1 rule packs** (`docs/design/P3.1-rule-pack-review.md`):
  - Confirmed by the founder (D-46, D-47):
    - NBC minimum sizes, plus the combined toilet rule at 2.8 m² / 1.20 m.
    - The habitable-room list, and the height rule reading floor to ceiling.
    - Vastu preferences: kitchen south-east only; toilets also avoid the centre.
    - Firm door widths: main ≥ 1.00 m, inside ≥ 0.75 m.
    - Road width on the plot.
  - 🛑 **Still needed from the founder:**
    - The **BBMP values** with their sources: front / rear setbacks by plot depth, left / right by plot width, ground coverage % by plot area, FAR by road width.
  - Severities confirmed 7 Nov (D-48): NBC and BBMP errors, Vastu and firm warnings.
  - **P3.2 done** (7 Nov, D-49): checks re-run as you draw (issue in ~0.17 s), grouped by room, click to zoom, Fix buttons where the answer is certain (one undo step), Vastu score and on/off switch. Quick fixes move the whole wall (founder, D-50).
  - **P3.3 built** (7 Nov, D-51): the **Plan Graph**, a bubble diagram worked out from the plan (rooms; open / door / wall-only / corner links; depth zone from the road; Vastu zone; outside walls; door to the outside). Layers → Plan graph shows it; Properties lists a room's connections. 🛑 Founder spot-check: `docs/design/P3.3-plan-graph-review.md`. **Phase 3 is built**; the next phase is **Phase 4** (chat agent: P4.1 sets up the server and needs the Gemini key in `server/.env`, plus the old editor code to review).
- **Design system** (docs & UX session, DS-01…DS-04):
  - Tokens in `design/tokens/` (`npm run tokens`), with a lint in `npm test`.
  - **Settings → Text size** 100–150 %.
  - WCAG fixes from a full UX audit (`design/audits/2026-11-06-full-ui.md`).
  - Room labels that don't fit are left out (founder: keep).
  - Addendum **A5** (atomic design structure) adopted 7 Nov; the founder handed **PA.1** (check only) to a separate session. PA.2 (moving files) is planned with the Build session.
- **Code on GitHub:** https://github.com/Amiteshd-nd/test-examples (branch `main`, baseline commit `e3bd7e4` at the end of Phase 2). The work since then (P3.1, format 1.3.0, P3.2) is **not committed yet**. Commit and push only when the founder asks.
- **Waiting on the founder:**
  - The BBMP values (above), and the Plan Graph spot-check (P3.3).
  - A minimum on-screen size for annotation text (P2.5): today it is true to print, so it is tiny when zoomed out.
  - Go-ahead for the **Phase 2 end-of-phase UX audit** (on hold).
  - Sample DXFs, the AutoCAD check of an export, the old editor code (`TASKS.md`).
  - **Mobile app (A4): rules only, not to be built now.**
- **To continue in a new Claude Code chat:** open the repo folder and say **"Read HANDOFF.md and continue"**. The 7 Nov Build chat ("Atomic design system handoff") adopted A5 and built **P3.2** and **P3.3** (end of Phase 3); check `SESSIONS.md` and `PROGRESS.md` for anything later. Give the BBMP values in whichever Build chat is current, and run only one Build chat at a time.
---

## 1. Project in one paragraph

Build a prompt-to-CAD tool for residential floor plans. A user types a request (e.g. "3BHK, 30×40 plot, east facing, Vastu, parking"). The system produces editable floor plan options in a web editor and exports a layered, print-ready DXF. Long-term, the "brain" will be an open model (e.g. Qwen) fine-tuned on the founder's own professional floor plans. Short-term, it keeps using Gemini with a better-structured pipeline.

## 2. Founder and current state

- **Founder:** architecture undergraduate (design background). Not a software developer; Claude writes code and explains it, and the founder runs it. A part-time developer will be needed once real users arrive.
- **Existing product:** a browser editor similar to Rayon.design, with a built-in chat interface connected to **Gemini**, prompted with **20–30 example floor plans**.
- **Problem with current setup:** little variety. Likely causes:
  1. Gemini sees the same fixed examples every time, so it copies them.
  2. Gemini is asked to "draw" (do geometry), which language models are weak at.
- **Decision:** don't throw the editor away. Restructure the pipeline around it.

## 3. Data

| Item | Status |
|---|---|
| Plans available now | ~200 |
| Plans expected later (own company) | ~800–1,200 more |
| File formats | **TBD:** DWG/DXF? Revit? PDF? (key open question) |
| Ownership | Founder's own work, but check client contracts and remove client details |

- 200 plans is too few to fine-tune for variety (the model would memorise). ~1,000+ becomes workable, especially with augmentation and public datasets.
- Western/public datasets are acceptable for a first training round (e.g. RPLAN, Swiss Dwellings, CubiCasa5K). **Check each licence**: some are academic or non-commercial only.

## 4. Core concepts (explained in plain words)

### 4.1 What the model is
- Qwen (standard version) is **text in → text out**. Vision versions (Qwen-VL) can look at images but can't read exact dimensions reliably.
- **We do not train on pictures.** Floor plans are converted into structured text (JSON).

### 4.2 How a drawing becomes data
- **DWG** is converted to **DXF** with the free ODA File Converter.
- **DXF** is already text: lines, polylines, blocks and text labels, each with coordinates and a layer.
- A **converter program** reads the DXF and outputs clean JSON: plot, setbacks, rooms (type, position, size), doors, windows, stair, facing.
- This works best if drawings use consistent layers: walls on a wall layer, room names as text inside rooms, doors as blocks.

### 4.3 Training pairs ("the paragraph" clarified)
- Training works with pairs: **request text → correct plan JSON**.
- Request text is **generated automatically** from each plan's metadata, so nobody writes paragraphs by hand. Several phrasings are generated per plan.
  - Example request: "East-facing 30×40 plot, 3BHK, ground floor, Vastu kitchen, parking in front."
  - Example answer: that plan's JSON.
- The model learns **patterns** (room sizes, adjacencies, stair position, zoning by facing, circulation), not copies of files.

### 4.4 Who does what: model vs app

| Job | Who |
|---|---|
| Understand the user's request | Model |
| Decide the room layout | Model |
| Revise the layout on request ("bigger kitchen") | Model |
| Building rules, setbacks, Vastu checks | App (checker) |
| Wall thickness, layers, line weights, dimensions | App (CAD builder) |
| Title block, print template, DXF export | App (CAD builder) |
| Manual editing | App (editor) |
| Accounts, project saving, payments | App |

**Key principle:** the model is the creative brain. Fixed, rule-based code handles everything that must be exact (layers, line widths, standards). Chat can *change settings* ("external walls 300 mm"), but code applies them.

## 5. Target system architecture

```
User prompt
   │
   ▼
App adds context (city rules, preferences, 3–5 closest reference plans)
   │
   ▼
Model (Gemini now → own fine-tuned model later)
   │   outputs: structured brief and/or plan JSON
   ▼
Layout engine (rule-based) → many variations         [Phase 2]
   │
   ▼
Checker → reject / repair invalid plans
   │
   ▼
Editor shows best 3–5 options → user edits via chat or by dragging
   │
   ▼
CAD builder → layered, plot-ready DXF (+ title block)
```

Chat editing loop: current plan JSON + instruction → model → updated JSON → checker → redraw.

## 6. Roadmap (step by step)

### Phase 0: Prepare
1. Keep the existing editor as the front end.
2. Gather the 200 plans; plan to add 800–1,200 later.
3. Remove client names, addresses and site details.
4. Convert DWG to DXF (ODA File Converter).

### Phase 1: Plans as data (≈4–6 weeks; founder-led with Claude)
5. Agree the standard plan JSON format (draft in §8).
6. Build the DXF → JSON converter.
7. Test on ~50 plans; fix layer inconsistencies.
8. Convert all 200; tag each plan (BHK, plot size, facing, Vastu, floors).
9. Change Gemini's role: output a **structured brief**, not a drawing. Use Gemini's structured-output (JSON schema) feature.
10. Add **smart example selection** so each request gets the 3–5 most similar plans from the library.

### Phase 2: App engine (≈2–3 months; developer recommended)
11. **Checker:** overlaps, minimum room sizes, setbacks, Vastu, light and ventilation.
12. **Layout engine:** generates many arrangements from one brief (source of variety).
13. **CAD builder:** JSON → DXF with layers, line weights, dimensions, room labels and areas, title block.
14. **Chat editing loop.**

### Phase 3: Own model (once ~1,000 plans)
15. Save every plan made or edited in the editor as JSON (data flywheel).
16. **Augmentation:** mirror and rotate plans. ⚠️ Update facing and Vastu labels after every mirror or rotation, or the model learns wrong Vastu.
17. Generate request → JSON training pairs.
18. Train in two rounds: public datasets (licence-checked), then own plans. Base model: Qwen (Apache 2.0), LoRA fine-tuning with Unsloth or Hugging Face TRL on a rented GPU.
19. Compare against the Gemini pipeline; switch only if better or cheaper.

### Phase 4: Launch
20. Host the model privately on a GPU server; the editor calls it like it calls Gemini today.
21. Never publish the weights publicly; monetise via subscription.

## 7. Infrastructure and cost notes

- **Founder's laptop (16 GB RAM, 4 GB GPU):** fine for data prep, scripts, viewing results, tiny test models. Not for training.
- **Rent GPUs instead:** Google Colab (free/paid), Kaggle (free weekly hours), RunPod / Vast.ai / Lambda (hourly), E2E Networks (Indian provider).
- Rough expectation: a fine-tuning run costs thousands to low tens of thousands of rupees, not lakhs. To be confirmed when scoped.
- The training button itself is easy (ready-made notebooks). The hard parts are data preparation, evaluation, fixing invalid outputs and CAD conversion.

## 8. Draft plan JSON format (v0, to be refined by founder)

```json
{
  "meta": {"bhk": 3, "floors": 1, "facing": "East", "vastu": true, "city": "TBD"},
  "plot": {"width": 9.14, "depth": 12.19, "units": "m"},
  "setbacks": {"front": 1.5, "rear": 1.0, "left": 0.9, "right": 0.9},
  "rooms": [
    {"id": "R1", "type": "Living", "x": 0.9, "y": 1.5, "w": 4.2, "h": 4.8},
    {"id": "R2", "type": "Kitchen", "x": 5.1, "y": 1.5, "w": 3.0, "h": 3.3}
  ],
  "doors": [{"between": ["R1", "R2"], "width": 0.9}],
  "windows": [{"room": "R2", "wall": "north", "width": 1.2}],
  "stair": {"x": 5.1, "y": 5.0, "w": 1.2, "h": 3.0}
}
```

Open decisions: non-rectangular rooms (polygons?), multiple floors, wall thickness in data vs builder, units (m vs ft), Indian room types (pooja, utility, OTS, sit-out, parking, store).

🟨 **CHANGED [P4, P5] (v12):** decided: rooms are polygons derived from walls; floors are levels; wall thickness stored on each wall; geometry stored in **cm**, shown in m or ft-in; Indian room types in the room-type list. Format is versioned with migrations.

## 9. CAD builder: draft spec (to discuss further)

- **Wall thickness defaults:** 230 mm external, 115 mm internal (configurable).
- **Proposed layer standard:** A-WALL, A-DOOR, A-GLAZ, A-FLOR-STRS, A-ANNO-DIMS, A-ANNO-TEXT, A-ANNO-TTLB (title block), plot boundary and setback layers.
- Each layer gets a colour and line weight from a **print template**. Firms can upload their own template or layer standard.
- Adds dimensions, room names and areas, north arrow, title block.
- Output: DXF that opens in AutoCAD, layered and plot-ready. Python library candidate: **ezdxf**.

## 9A. Product architecture decisions (v5)

### CAD engine: CADCraft (open source)
🟨 **CHANGED [P1, P3] (v12):** we now write our **own headless TypeScript engine** and use CADCraft as a reference (porting ideas/code its licence allows). Notes below kept as history.
- AutoCAD-style 2D CAD, rewritten in Rust; runs on desktop and in the browser (WebAssembly). Repo: github.com/storytold/cadcraft (part of ArtCraft "Crafting Apps").
- **License:** MIT or Apache-2.0, so commercial use is allowed; keep copyright notices.
- **DXF:** read/write native. **DWG:** open/save via the open-source acadrust library, but DWG saving is unverified in AutoCAD and drops unsupported data, so **ship DXF as main export; DWG = beta.**
- **Automation:** MCP server, JSON control channel, cadcraft-cli, which makes chat-driven control possible.
- ⚠️ **Pre-alpha and very young** (built in weeks). Pin a specific version, keep our own fork, expect bugs.

### Decisions
1. Use CADCraft's **engine**; build **our own interface** (not a copy of their UI). Developer to spend ~1 week checking how cleanly the engine separates from their UI. Fallback: drive the engine via its JSON channel or MCP.
2. **Minimal toolset first:** wall, line/polyline, rectangle, move, copy, rotate, mirror, offset, trim/extend, delete, undo/redo, dimension, text, room label, layers, door/window blocks, hatch, print. Hide the rest.
3. **Chat ↔ engine via tool calling:** the AI picks from a fixed menu of allowed actions and fills in values; the engine executes exactly. Gemini supports this today.
4. **Two prompt types + router:**
   - *Command prompts* ("box named X, move it, copy it twice"): no training needed; general LLM + tool calling. Handle ambiguity (e.g. "move 3 times" = how far? "multiply by 2" = scale or copy?) with defaults or a clarifying question.
   - *Design prompts* ("2BHK on 30×40"): need design knowledge. Gemini + plan library + checker now; fine-tuned model later.
   - Router sends each prompt (or each part of a mixed prompt) down the right path.
5. **Launch before the model is trained:** manual drawing + command chat + Gemini-based generation. All user plans feed the dataset; swap in our model later, invisibly.
6. **Smart objects, not loose lines:** walls, doors, windows and rooms carry names and attributes so manual edits and AI edits stay in sync with the plan JSON. Decide this early.

### Fork plan
🟥 **REMOVED [P3] (v12):** no fork needed. Kept below as history.
- The founder or developer **forks CADCraft** on GitHub (own copy); all our changes live there; pull upstream fixes selectively.
- Claude cannot hold the fork (workspace resets, no GitHub login). Claude writes code changes, reviews pasted code, and can download CADCraft into its workspace in a chat to inspect the engine/UI separation.

### Fine-tuning plan (summary)
1. Collect: 200 plans now → 1,000+ (company plans + editor users).
2. Convert: DWG → DXF → plan JSON; anonymise.
3. Tag: plot size, facing, BHK, floors, Vastu, city.
4. Augment: mirror/rotate, updating facing and Vastu labels.
5. Pairs: 3–5 auto-generated request phrasings per plan → plan JSON.
6. Hold out 10–15% for fair testing.
7. Train in two stages: public datasets (licence-checked) → own plans. Qwen ~7B + LoRA, rented GPU (Colab/RunPod).
8. Evaluate: checker pass rate, architect ratings, vs the Gemini pipeline.
9. Optional: RL with the checker as reward (Mila method).
10. Deploy privately; router switches design prompts to our model only if it wins step 8.
11. Retrain monthly/quarterly with new data.

Effort is mostly in steps 2–5, so **the converter is built first.**

### Base model choice (v11, Nov 2026)
- Needs: Apache 2.0 (or clearly commercial) licence · 4–14B size · strong structured/JSON output · Unsloth support. Output target = room graph (solver handles geometry), so a small model is enough.
- **1st: Qwen** (Apache 2.0; best tutorials/Unsloth support; prior floor-plan work used it). Practice run ~4B; real run ~8B. Larger Qwen3.8-27B exists (Aug 2026) but not needed initially.
- **2nd: Gemma 4** (Apache 2.0; 12B dense, E4B/E2B small variants).
- **3rd: Mistral**: Mistral Small 3.x 24B (Apache 2.0; base of Sarvam-M; heavier) or Mistral NeMo 12B (Apache 2.0; base of Krutrim-2). Skip Mistral Small 4 (119B MoE, too heavy to fine-tune cheaply). Mistral Large 4 uses a non-Apache "Ecosystem" licence and is ~1T params.
- **Plan:** in the practice run, A/B Qwen ~8B vs Gemma 4 12B or Mistral NeMo 12B on identical data; pick the winner by the eval harness. Data quality matters more than base-model brand. Re-check exact model name and licence on Hugging Face on training day.


**Detailed beginner guide:** see `fine-tuning-guide.md` (Colab + Unsloth + Qwen, copy-paste cells, before/after scoring, loss reading, architect blind review, private save). Practice run with 200 plans; real run at 1,000+.

## 9B. Chat tool menu v0 (actions the AI may perform)

The AI never draws freely: it picks actions from this menu and fills in values; ~~the CADCraft engine~~ 🟨 **[P6]** our engine's command layer executes them. 🟩 **[P6]** The model sees them through three tools (`plan_read`, `plan_execute`, `plan_capture`) with an operation list, not as 40 separate tools.

1. **Create:** `create_wall` (start, end, thickness, ext/int) · `create_room` (name, type, position, width, depth) · `create_rectangle` (name, position, w, h, layer) · `create_line` / `create_polyline` (points, layer) · `place_door` (wall, position, width, swing) · `place_window` (wall, position, width, sill) · `place_stair` (position, width, length, direction) · `add_text` · `add_dimension`
2. **Name and select:** `name_object` (unique names) · `select` (by name/type/layer)
3. **Change:** `move` · `copy` (count, spacing, direction) · `rotate` · `mirror` · `scale` · `array` · `offset` · `delete`
4. **Room-level (AI design help):** `resize_plot` · `set_room_behavior` (fixed/fill/range) · `lock_room` / `unlock_room` · `reflow_layout` · `generate_variations` · `resize_room` · `move_room` (connected walls adjust) · `swap_rooms` · `generate_layout` (brief → 3–5 options) · `check_plan` (rule report)
5. **Information (read-only):** `list_objects` · `get_object_info` · `measure_distance` · `get_area`
6. **Settings and output:** `set_layer` · `set_default_wall_thickness` · `set_units` · `apply_print_template` · `export_dxf` · `export_pdf` · `undo` · `redo`

**Rules:**
1. Missing number → ask (unless a project default exists).
2. Ambiguous word (e.g. "multiply" = scale or copy) → ask.
3. Used a default → say so.
4. Confirm before big deletions.
5. Unique names; suggest X-2, X-3.
6. Every chat action is undoable in one step.

**Worked example:** "Make a box named X, move it three times, make 2 copies named X" → `create_rectangle` (default 1×1 m, announced) → `name_object` X → `move` (asks distance and direction) → `move` ×3 → `copy` ×2, suggesting X-2 and X-3.

## 9C. Layout engine design: Finch-style auto-layout (v9)

**Concept:** rooms form a graph; each room has rules; a solver recomputes positions whenever the plot, a room or a lock changes, so the layout reflows live.

**Room rules:** Fixed (e.g. toilet 1.5×2.4 m) · Fill (absorbs extra space, e.g. living) · Range (e.g. bedroom 3.0–4.2 m wide) · Must touch an exterior wall (light/air) · Vastu zone (e.g. kitchen SE) · Locked.

**Build options (simplest first):**
- **A. Zone-based reflow (first version):** front / middle / rear bands typical of Indian rectangular plots; bands stretch, rooms redistribute by rules. Weeks to build.
- **B. Constraint solver (proper engine):** Google OR-Tools CP-SAT (free, open-source, commercial use OK). 🟨 **[P1] (v12):** start with a TypeScript solver in the browser; CP-SAT can be added later as a service behind the same `solve()` interface. Variables = room x/y/w/h; constraints = no overlap, inside setbacks, adjacencies, min sizes, Vastu; also generates variations.
- **C. AI + solver (long-term):** fine-tuned model outputs the **room graph** (rooms, connections, zones); the solver produces exact geometry. Far more data-efficient than learning coordinates, which suits 200–1,000 plans. ⇒ **Consider training the model on graphs, not coordinates.**

**Editor features:** drag plot/building edge → live reflow · lock icon per room · fixed/fill/range setting per room · live metrics (carpet area, built-up area, FSI/FAR, setback pass/fail) · "show variations" button.

**Pipeline position:** AI → layout engine → checker → CAD builder.

## 10. Legal and business notes (not legal advice; consult an IP lawyer)

- Check client contracts for ownership or reuse restrictions on drawings; anonymise.
- Check licences of base models (Qwen, Mistral: Apache 2.0; Llama: own licence) and of datasets.
- Keep trained weights private; the founder's design knowledge is the moat.

## 11. Market and research context (from earlier discussion)

- No publicly known India-based, VC-funded prompt-to-CAD or prompt-to-BIM company was found. Indian architecture-AI players are mostly angel or incubator stage; Snaptrude is the main exception (BIM engine, not a wrapper).
- Investors are wary of thin "AI wrappers". Editable, rule-checked, layered CAD output is the differentiator.
- **Relevant existing work:**
  - Hugging Face `Karthik8nitt/parametric-floorplan-generator`: Qwen2.5-1.5B + LoRA, Indian-style inputs (setbacks, pooja, Vastu), trained on 5,000 synthetic plans. Good reference for format; weak data.
  - Mila / ACL 2026 paper "Generative Floor Plan Design with LLMs via Reinforcement Learning with Verifiable Rewards" (Lara et al.): fine-tune an LLM on real plans plus a reinforcement-learning step using rule checks. Closest blueprint for Phase 3. Adapters published under `ludolara/` (Llama 3.3 70B, RPLAN, research use).
  - DStruct2Design dataset (`ludolara/DStruct2Design`) and paper (arXiv 2407.15723).
  - Image-only Stable Diffusion floor plan models exist but produce pictures, not CAD.
- Side context discussed: Hugging Face is "GitHub for models"; most uploads are fine-tunes, quantisations, adapters and merges of a few base models. The base-model field on a model card shows lineage (e.g. Sarvam-M → Mistral Small; Krutrim-2 → Mistral NeMo; Sarvam 30B/105B claimed from scratch).

### 11.1 Competitor deep-dive: Skyfall AI (SKY-001)

- **Company:** Toronto / San Francisco (not India-HQ; CEO Sam Pasupalak is of Odia origin). Team behind Maluuba (acquired by Microsoft, 2017). Backers: Fidelity, Touring Capital, M13, iNovia.
- **Product:** SKY-001, launched 19 Oct 2026. A "world model" (diffusion, plans in images and 3D states), **not an LLM**. Covers both CAD (parts and assemblies) and BIM (floor plans).
- **Floor plans:** drawn like an architect would: exterior walls, then party walls and corridors, then room by room. Trained on ~35,000 real and synthetic plans.
- **Self-reported BIM score:** 43.6% IoU at ~1.2 s/plan vs GPT-6 Astra 40.6% at ~145 s. Less than half the plan reconstructed, so a sketch generator, not a drafting tool. Not independently verified.
- **Availability:** research preview, waitlist only; no API, pricing or weights. Commercial target: early 2027.
- **Output is NOT editable yet;** BIM objects are on their roadmap.
- **Takeaways for us:**
  1. Confirms the gap: editable, layered, rule-checked output is the differentiator.
  2. Serious, funded competition, so stay narrow and deep: Indian residential, local rules and Vastu, print-ready DXF.
  3. Borrow the idea: record **build/edit histories** in our editor (the order of drawing and edits) as future training data.

### 11.2 Competitor note: Praxyz Generative (Hyderabad)

- Pre-seed, founder Sai Teja Kavuda, seeking angel/seed money via eChai Ventures. No announced round as of Oct 2026.
- Builds AI that turns **2D engineering blueprints and specs into manufacturable 3D geometry**, which points to the mechanical/manufacturing domain, not architecture.
- Opposite direction to our tool (existing 2D → 3D vs text brief → new 2D plan).
- Possible future overlap if we add 2D plan → 3D massing/BIM. More a potential peer or collaborator than a direct competitor.

### 11.3 Positioning summary

- Big players (Skyfall, Autodesk, etc.) treat floor plans as **one feature** of a general engineering or BIM product, aimed more at multi-unit buildings than independent houses.
- Praxyz has **no overlap** (mechanical parts, 2D → 3D).
- Direct niche players exist but are **small or unproven**: Studio Matrx ArchitectAI (closest; Indian codes and Vastu; unverified), Naksha AI (idea stage), the HF parametric floor-plan generator (hobby/research), Mila research (academic, Chinese data).
- **Our niche:** independent residential house plans in India with editable, layered, print-ready output. No strong, well-funded player is focused here yet. Move before big players narrow down.

### 11.4 Viability assessment: risks and how to win

**Verdict:** the idea is distinct and realistic, but the idea alone is not a moat. Execution decides.

**Strengths:** focused niche (Indian residential, editable print-ready output, local rules and Vastu); approach backed by research and by competitors' gaps; founder combines architecture training with access to real practice plans.

**Risks:**
1. General models (Gemini/GPT/Claude) keep improving at layouts. Defend with what they don't do: rule checker, layered DXF, print templates, curated data.
2. Price-sensitive Indian market (cheap plans from builders/draftsmen). Need to prove who pays and how much.
3. Responsibility and approvals: construction drawings need an architect's sign-off. Position as a tool that speeds up professionals.
4. Thin data (200 plans). Grow via editor usage (data flywheel).
5. Bigger players narrowing into the niche. Move fast and go deep.

**To win:**
- Pick a starting customer: small architecture firms, draftsmen, builders with repetitive plots.
- Test the current Gemini version with 10–20 of them now; track usage, complaints, willingness to pay.
- Make the CAD builder excellent (clean, layered, print-ready), since that earns professional trust.

### 11.5 Reference: Finch (finch3d.com)

- Swedish, architect-founded (Martin Kretz, Pamela Nunez Wallgren, Jesper Wallgren). "AI-native platform for building design" using **AI + graph technology**; residential, master plan, high-rise, office; plans grounded in a firm's standards and local codes.
- Focus: larger firms and multi-unit buildings, not independent Indian houses. A model to learn from, not a direct competitor.
- **Idea to borrow:** plan as a **graph** (rooms = nodes, required connections = edges) + rules, so resizing reflows the layout (Figma auto-layout feel).
- Build the concept, not a copy of their UI, branding or workflows.

### 11.6 Finch deep research (4 Nov 2026) — what we adopt
- Founded 2019/2020 in Malmö by Pamela Nunez Wallgren, Jesper Wallgren, Martin Kretz; began as a Rhino/Grasshopper plug-in (Wallgren Arkitekter + BOX Bygg); now standalone web platform with Rhino/Grasshopper/Revit streams. Seed €2.5M (2022, Inventure) + €1M (2024, Ampli Ventures). Customers incl. White Arkitekter, Herzog & de Meuron, Sweco, Hawkins\Brown, OYO.
- **Finch Graph:** auto-generated graph of rooms/objects and relationships; user never builds it. **Patented** (per Finch) → we build our own; FTO check before launch.
- **Graph Rules, 2 stages:** informed generation + continuous compliance checking.
- **Plan Library:** firm's past plans + rules as base for every generation.
- **Adaptive reconfiguration:** moving a wall/stair reconfigures logically, not just stretches.
- **Metrics/scoring:** areas, daylight, CO₂; many options compared.
- **Archie agent:** precision work (door placement, compliance, linked-unit updates).
- Third-party explainers describe the engine as graph-based spatial allocation + iterative optimisation (not confirmed by Finch).
- **Our mapping:** see PRD §2.3 (Plan Graph, rule packs, live compliance, Plan Library retrieval/adaptation, zone reflow → CP-SAT, live metrics, chat agent with tool calling, layered DXF).

## 12. Open questions

1. What format are the 200 plans in (DWG/DXF, Revit, PDF/images)?
2. Are layers consistent across the founder's drawings?
3. What does Gemini currently return to the editor (JSON coordinates, SVG, other)?
4. What is the editor's tech stack (framework, how plans are stored)?
5. Target users first: individual architects, builders, or homeowners?
6. Which city or cities' building rules to support first?

## 13. Next actions

**Current (7 Nov 2026)** — the repo's `TASKS.md` is the full list:
- [ ] Founder: BBMP setback / coverage / FAR values with sources, and confirm the severities (finishes P3.1).
- [ ] Founder: minimum on-screen size for annotation text, or keep it true to print (P2.5 question).
- [ ] Founder: say when to run the Phase 2 UX audit (docs & UX session).
- [ ] Founder: ask for a commit and push of the P3.1 work when ready (baseline `e3bd7e4` is on GitHub).
- [ ] Claude (Build): after the BBMP values, finish P3.1; ~~P3.2 live reference-check panel~~ (done 7 Nov); ~~P3.3 Plan Graph~~ (built 7 Nov; founder spot-check open); next Phase 4 (P4.1).

**Earlier list (kept for history):**

- [x] Founder: save `SKILL.md` at `.claude/skills/plancraft-ux-refine/SKILL.md` in the repo; add the CLAUDE.md line to run it after every UI prompt. *(Done 6 Nov 2026: skill v1.2 saved; `CLAUDE.md` lists it with quick pass / full audit / as-built index.)*

- [x] Founder: put `PRD-ADDENDUM-A3-ICONS.md` in the repo; save the icon reference in `/design/reference-icons/`. *(Done 6 Nov 2026: A3.1 in the root; `icon-starter-preview.png` in `design/reference-icons/`.)*
- [ ] Founder: confirm brand accent colour for icons in PI.1. *(Repo note: `DESIGN.md`'s only accent is blueprint blue `#8080dd` (D-23); green and orange come from reference images.)*

- [x] Founder: replace `PRD-ADDENDUM-A2-VAULT.md` in the repo with v A2.1; tell Claude Code to read it and apply amendments M1–M12 at the named prompts (M1, M3 at P1.1 — important). Save dashboard + folder references in `/design/reference-vault/` before P14.1. *(Done: A2.1 adopted (D-28), M1 + M3 applied as plan format 1.1.0, references saved, P14.1 approved. A2.2 replaced A2.1 on 6 Nov 2026.)*

- [x] Founder: put `PRD-ADDENDUM-3D-PRESENTATION.md` in the repo root; tell Claude Code to read it (it adds itself to CLAUDE.md). *(Done in P2.1.)*
- [ ] Founder: save 3D style references in `/design/reference-3d/` before P12.1 and board references before P13.1.

- [ ] Founder: put `PRD.md`, `CLAUDE.md`, this memory file and `fine-tuning-guide.md` in the project root; open Claude Code; type `Do P0.1`.
- [ ] Founder: prepare 3–8 interface screenshots for P2.1 (`/design/reference/`).

- [ ] Founder: share 1–2 anonymised sample DXF files.
- [ ] Founder: answer open questions 1–4.
- [ ] Claude: write converter v1 (DXF → JSON) and show the output.
- [ ] Together: finalise the plan JSON format v1.
- [ ] Founder: questions on the app and CAD builder (next discussion).
- [ ] Founder: create Hugging Face account + Drive folders (guide §1).
- [ ] Together: practice training run with 200 plans after the converter works (guide §3–9).
- [ ] Founder: define room rules (fixed/fill/range, exterior-wall, Vastu zones) for typical Indian house types.
- [ ] ~~Founder/developer: fork CADCraft on GitHub.~~ 🟥 **[P3]** not needed.
- [ ] Developer: 1-week spike on CADCraft 🟨 **[P3]** as a reference review: what to port into our TypeScript engine.
- [x] Draft chat tool menu v0 (§9B). Founder to review and add/remove actions.
- [ ] Together: define the smart-object model for walls/doors/windows/rooms.
- [ ] Founder: test the current Gemini prototype with 10–20 architects, draftsmen or builders; note usage, complaints, willingness to pay.

## 14. Change log

- **v45 (7 Nov 2026):** **Icon style agreed (PI.1, DS-06)** in a separate Icons session the founder assigned PI.1–PI.3 to: blueprint-blue accent; duotone look (outline, soft fill, accent details) with the founder's light-theme colours; 20 px default including toolbars; icons grow with Text size (22.5 px at 112.5 % accepted); active items keep today's look and only the icon recolours (A3's accent-bar row not adopted); `Icon` is an A5 atom in `frontend/src/ui/atoms/Icon/`; third-party icon references stay local. Written up in `design/DESIGN.md` → Icons. Next: PI.2 (Phosphor package and the `Icon` component).
- **v44 (7 Nov 2026):** **A5 PA.1 approved** (DS-05: "Approve 1–5, start step 1"): the six-step atomic plan in order; Button, IconButton, Icon and Chip may be used directly in organisms; folder art keeps its exact values; no density setting for now; `Dashboard.tsx` and `Editor.tsx` get split in step 3 with Build. **Step 1 done** (docs only): `design/system/registry.json` classifies all 95 components; `design/system/EXCEPTIONS.md` holds E1–E5. Step 2 (moving files, old imports kept) waits for a time agreed with Build and the icon session.
- **v43 (7 Nov 2026):** Founder kept the whole-wall quick fix (D-50). **P3.3 Plan Graph built** (D-51): every plan is read as a bubble diagram, derived from walls, doors and rooms, never drawn by hand: one node per room (area, depth zone front / middle / rear from the road, Vastu zone, outside walls, door to the outside) and a link per pair of rooms that relate (open, door, wall only, corner). It shows over the drawing from Layers → Plan graph, with a key; Properties lists a room's connections. Spot-check of five plans waits for the founder (`docs/design/P3.3-plan-graph-review.md`). **Phase 3 (rules engine) built**; open: BBMP values, the spot-check. Fine-tune gates: FT-0 0 / 200 real plans, FT-1 0 / 1,000. Next: Phase 4.
- **v42 (7 Nov 2026):** **A5 PA.1 check done** (separate session; read-only, nothing changed): `design/system/ATOMIC-AUDIT.md`, verdict **partly compliant**. The tokens and the theme/text-size switches work everywhere, but there are no atomic levels yet (flat `ui/components.tsx`, molecules living only as Vault/editor CSS, three palettes, two Help dialogs), and the stylesheets use base scale steps instead of the semantic spacing and type tokens. A six-step plan and five questions wait for the founder; PA.2 (moving files) is planned with Build and the icon session first.
- **v41 (7 Nov 2026):** Addendum **A5** (atomic design system) adopted: file in the repo, one line in `CLAUDE.md` and one in the UX skill; PA.1 handed by the founder to a separate session. Severities confirmed (D-48). **P3.2 done** (D-49): the plan is re-checked about 0.12 s after each change (the issue shows in ~0.17 s; target 0.3 s); issues grouped by room; clicking one selects and zooms to it; Fix buttons only where the result is certain (move the named wall, widen a door about its middle, raise a low level), each one undo step; Vastu score (share of preferences met, "assumed" because north is assumed up) and a Vastu on/off switch (new commands `SET_PLAN`, `SET_LEVEL`). Open question: a Fix moves the whole wall, which also changes other rooms along a long wall.
- **v40 (7 Nov 2026):** End of Build session 3 (P2.2a → P3.1 in one chat). This file's §0 snapshot and §13 are refreshed for a new chat. A new Build chat had already started on 7 Nov (A5 adopted, P3.2 begun); P3.1 finishes once the BBMP values and severities arrive. Not yet committed since the baseline `e3bd7e4`: P3.1 and plan format 1.3.0.
- **v39 (7 Nov 2026):** P3.1 review, second answers (D-47): habitable-room list kept; the 2.75 m height is floor to ceiling; all Vastu preferences confirmed, toilets also avoid the plot's centre; the firm door widths (main ≥ 1.00 m, inside ≥ 0.75 m) kept. Only the BBMP values and the severities remain.
- **v38 (6 Nov 2026):** P3.1 review, first answers (D-46): NBC minimum sizes confirmed as listed (now "verified"), the combined toilet rule kept (2.8 m² / 1.20 m), Vastu kitchen south-east only, and road width added to the plot (format 1.3.0; `SET_PLOT`; Properties → Road width) so the BBMP FAR table can go by road width. Still open: BBMP setback / coverage / FAR values, the habitable-room list, the height reading, the other Vastu preferences, the example firm door widths, severities.
- **v37 (6 Nov 2026):** Docs & UX session, end of day.
  - **Room-label fitting kept** (DS-04): a label that doesn't fit its room is left out, area first; the rule is in `frontend/src/ui/labels.ts`.
  - **Mobile viewer addendum A4.0 adopted, not built:** rules MV-1…MV-48 in `docs/design/mobile-viewer-rules.md`; Phase 17 waits for a PM prompt ID, and PM.0 (tech stack) is the founder's call.
  - **First commit `e3bd7e4` pushed** to https://github.com/Amiteshd-nd/test-examples (`main`) at the founder's request, after checks (all green, no secrets; plan data and reference images stay local).
  - Open: the Phase 2 UX audit (the founder hasn't said go yet).
- **v36 (6 Nov 2026):** P3.1 rule packs built (D-45): NBC minimum room sizes (PRD values), Vastu preferences, example firm door widths, and a Bengaluru pack ready for BBMP setbacks / coverage / FAR (empty until the founder supplies values). Reference checks say what fails and how to fix it ("Widen Bedroom by 52 cm, e.g. move wall W1 52 cm south") and show as "unverified" until confirmed. 🛑 Waiting for the founder's review (`docs/design/P3.1-rule-pack-review.md`).
- **v35 (6 Nov 2026):** P2.5 done (D-44) and **Phase 2 (editor) complete**. The toolset: 20 tools with AutoCAD-style keys (Wall W, Room R, Door D, Window N, Stair S, Line L, Rectangle B, Dimension ⇧D, Note T, Hatch H, Move M, Copy C, Rotate Q, Mirror I, Offset O, Trim X, Extend ⇧X, Delete E…), each also a typed command (⌘K) and, later, an AI tool. Architects draw by numbers (450 ↵, 4.5m, 15'6", 450<90, @dx,dy); lengths and dimensions can be typed in Properties (the wall moves). Plan format 1.2.0 adds drafting lines, dimensions, notes and hatches. Help lists every key. Open question to the founder: minimum on-screen size for annotation text. Next: Phase 3 (rules engine), P3.1 rule packs with a 🛑 review of seeded values.
- **v34 (6 Nov 2026):** Playwright browser tests added (founder approved, D-42; they caught a one-frame jitter when dragging a panel edge). P2.4 done (D-43): every plan change is an engine command (move, delete, add wall / room / door or window, change a property) with a plain-words reason when it can't run; one undo step per change or drag; undo / redo per person (keeps teammates' later changes and says what it skipped); changesets (diff / apply / invert) shared by undo, history, branches and sync later; walls keep their corner and T joins when moved, doors stay on their wall, rooms re-derive. Editor: drag the selection to move it, Delete, ⌘Z / ⇧⌘Z, Undo / Redo buttons, ⌘K as a command line (`MOVE V1 0,0 30,0`). Next: P2.5 (toolset), the last prompt of Phase 2.
- **v33 (6 Nov 2026):** P2.2a done (D-41): the editor's left panel, right panel and chat hide and show like Figma — top-bar buttons, a tab on the canvas edge, ⌘\ for all (focus mode), ⌘⌥[ / ⌘⌥], and a new ⌘K palette in the editor. The drawing stays exactly still while panels slide (200 ms, none with reduced motion); the layout and dragged widths (240–480 px) are remembered per user; narrow windows show panels as overlays closed by Esc or a click outside. Founder chose a temporary panel icon until the A3 icon prompts (PI.1–PI.2). Open question: add Playwright for automated browser tests. Next: P2.4 (commands).
- **v32 (6 Nov 2026):** Design tokens adopted (DS-01, docs & UX session). Founder approved the as-built proposal with an **11 px text floor** (answers the Vault audit's small-print question: keep 11, raise the 9–10 px exceptions) and **"code wins"** where DESIGN.md and code disagreed. Tokens live in `design/tokens/*.json`; `npm run tokens` writes `tokens.css` (`--pc-…`, old names kept as aliases), `tokens.ts`, the sheet and `TOKEN-INDEX.md`. Light-theme text and status colours darkened slightly to pass WCAG AA everywhere; stronger input edges; readable placeholders; 24 px hit areas; A3 icon tokens with a separate light mapping. Editor fixes (badge size, status-bar hit areas) go in with P2.2a. Same day: a **token lint** in `npm test` (DS-02) and the skill's **full UX audit** of every screen (`design/audits/2026-11-06-full-ui.md`): 10 fixes in shared components (menus, dialogs, keyboard patterns, selection bar, high-contrast canvas); the founder then approved all three (DS-03): **Settings → Text size** (100–150 %, every size in rem tokens, pixel-identical at 100 %), readable folder-art pills and chips, and "No plans here yet" with New plan / Import DXF.
- **v31 (6 Nov 2026):** P14.5 done and **Phase 14 (Vault) complete**: search page with filters (BHK, facing, status, kind, owner), grid and list in every view, Trash deletes for ever after 30 days, Trash actions without right-click. UX full audit: 7 keyboard / accessibility fixes; the founder decides on raising the Vault's 9–12 px small print to 13 px or adding a UI-scale setting. Founder added **P2.2a** (collapsible side panels, Figma-style) to the queue: it is next, then P2.4.
- **v30 (6 Nov 2026):** P14.3 accepted (founder created a folder and opened a plan without help; DXF import checked by Claude). P14.4 done: no Save button — every change kept as a local draft and saved to the Vault within seconds ("Saved · Saving… · Offline · Changed elsewhere"); refresh or crash loses nothing; a save from another tab is never overwritten (your changes become a copy beside the file); an unnamed version after every 30 min of editing; rename from the editor; Home returns to the folder, scroll position and file. `SESSIONS.md` set up for parallel sessions. Next: P14.5.
- **v29 (6 Nov 2026):** P14.3 Vault dashboard built and checked in the browser: the Vault is now the first page (dark), with the folder tree, folder tiles with plan thumbnails, file cards / sortable list, + New (plan, folder, DXF, .plancraft), right-click menus, multi-select, drag-to-move and drop-to-import, Plan Library with "Use as starting point", Starred and Trash, ⌘K palette; files open in the editor and Home returns to their folder. Waiting on the founder's 🛑 test (create a folder, import a DXF, open it, without help).
- **v28 (6 Nov 2026):** P2.3 accepted (founder: smooth). P14.2 Vault storage done: folders and files with create, rename, move, duplicate, star, colour, status, archive, Trash (restore, delete for ever, 30-day purge), search with filters, recent, thumbnails that redraw after edits, `.plancraft` package export/import (A2 M10); local vault in `data/vault/` seeded with a demo workspace (`npm run vault:seed`). Next: P14.3 dashboard screen (🛑 founder test at its end).
- **v27 (6 Nov 2026):** P2.3 canvas done with A2 M6's spatial index: plans open from the Plan Library through a DocumentStore; pan, zoom (AutoCAD-style wheel), click-select of any object, snapping (grid, end, mid, perpendicular) with markers and coordinates; door swings, window lines and stair treads drawn by the engine (same symbols as the DXF export). Measured on a 120-room stress plan: pan ~1 ms and zoom ~4 ms of work per frame. Importer bug fixed (more than 20 bedroom labels). Next in the A2 order: P14.2–P14.5 (Vault), then P2.4.
- **v26 (6 Nov 2026):** P14.1 approved. P2.2 app shell done and checked in the browser at desktop, tablet and phone widths: top bar (A2 P14.4 slots), panel rail, rooms/layers/library panel, canvas with the engine-drawn plan (joined walls, plot line, honest scale bar), chat column (connects in P4.1), properties/issues/metrics, status bar; Export DXF works from the editor. Next: P2.3 canvas (pan, zoom, select, snaps) with A2 M6 speed structures.
- **v25 (6 Nov 2026):** P14.1 Vault component page built (`/vault.html`): dark-first dashboard, tree, glass/colour/archive folders with real plan thumbnails, six colours, all states, files table, ⌘K palette; specs in DESIGN.md. Awaiting founder approval, then P2.2.
- **v24 (6 Nov 2026):** P1.1b geometry kernel done: 2 cm gap closing, order-independent joins (fuzz found and fixed a real order bug), snap rounding, 1,000-layout fuzz test. Next: P14.1 Vault design (🛑 approval), then P2.2.
- **v23 (6 Nov 2026):** Plan format 1.1.0 (A2 M1 + M3): objects stored in id-keyed maps, levels ordered by fractional index, room separators for open plans; automatic upgrade from 1.0.0. Next: P1.1b geometry kernel, then P14.1 Vault design.
- **v22 (6 Nov 2026):** P2.1 approved; Geist fonts added. Addendum A2.1 (Vault dashboard, versions/branches, multiplayer, mentor amendments M1–M12) adopted and queued; its build order puts M1/M3 (format 1.1.0), P1.1b (geometry kernel) and P14.1 (Vault design) before P2.2.
- **v21 (6 Nov 2026):** P2.1: 9 interface references (drafting look, blueprint blue), `design/DESIGN.md`, tokens + own components, style sheet page `/styleguide.html` in light and dark; awaiting founder approval. PRD addendum A1 (3D views, presentation renders, sheets; phases 11–13) adopted, not started.
- **v20 (6 Nov 2026):** P1.4 done, Phase 1 complete: Plan Library with auto-tags (plot ft/m, facing, BHK, floors, built-up/carpet area, Vastu zones; all with provenance), DocumentStore, tag review via CSV. Waiting on founder: sample DXFs, AutoCAD check of an export, tag review. FT-0 open once the ~200 plans are imported; library 0/1,000 real plans.
- **v19 (6 Nov 2026):** P1.3 done: DXF export (AutoCAD 2000, mm, standard layers, joined wall outlines, opening symbols, room labels with areas) with a read-back check that refuses lossy files; DXF→plan→DXF→plan round trip exact; ezdxf audit clean. Founder to confirm one file in AutoCAD.
- **v18 (6 Nov 2026):** P1.2 built without samples (founder's choice): mapping-driven DXF importer (walls from parallel line pairs, openings from gaps + symbols, rooms from labels, stairs, columns, plot), conversion report, SVG preview, bulk runner. Verified on synthetic drafting-style drawings (mm and inches); acceptance on the founder's real drawings still open. Founder asked to continue prompt after prompt, stopping only at 🛑 points.
- **v17 (6 Nov 2026):** P1.2 part A: founder chose one TypeScript DXF importer with CADCraft's tag reader copied (MIT notice in `THIRD_PARTY_NOTICES.md`). Reader done (ASCII + binary, code pages, damaged-file handling). Part B (wall/room/opening detection) waits for the founder's sample DXFs and layer names. Founder also sent two UI references ahead of P2.1 (notes in `design/reference/README.md`).
- **v16 (6 Nov 2026):** P1.1 done: Plan format 1.0.0 (zod + JSON Schema), migration runner, plan checker (15 rules with plain-language fixes), room derivation from walls (exact integer-mm, own code; CADCraft region tracing not ported). Founder added chajja, column grid, loft; room types dress, family lounge, lift, shop/office; wall types parapet, compound. Sunken toilet not added.
- **v15 (6 Nov 2026):** P0.2 done, ADR 0001 accepted by the founder: own TypeScript engine; CADCraft (pinned `3b7eb1b`) is a reference. Port with MIT notice when needed: DXF tag reader/writer (P1.2/P1.3) and planar region tracing (P1.1 rooms, P7 hatch). Nine ideas reused without code (command list, undo, snap ranking, tracking, grips/selection, trim/extend/fillet/offset maths, DXF writer pitfalls, round-trip census, property tests). DWG bridge (acadrust, MPL-2.0) not taken.
- **v14 (6 Nov 2026):** P0.1 done. Founder answers: existing editor code to be shared later; display units metres; first rule pack Bengaluru (BBMP); Gemini key ready for `server/.env` (P4.1). Repo skeleton built (npm workspaces engine/frontend/server, strict TS, Vitest, ESLint, Prettier, engine-purity check). Working docs added: `ARCHITECTURE.md`, `TASKS.md`, `DECISIONS.md`, `MEMORY.md`; `AUDIT-SUMMARY.md` moved to `docs/design/`.

**Founder's chat sessions — spec documents (6 Nov 2026, in parallel with the repo's v14–v29).** From v14 on, the repo (above) and the founder's chat copy of this file kept separate change logs with clashing numbers. They were merged on 6 Nov 2026: repo entries keep their **v** numbers (v14 onwards, newest at the top of this section); the chat entries (v14–v20 in the chat copy) are renamed **c14–c20** below. **Chat sessions continue with c21; Claude Code continues the v numbers.** The merge (docs session in Claude Code) added §0 "Start here", the A1/A2/A3/skill lines in the decisions box and the chat to-dos in §13 (ticked where already done); brought `PRD-ADDENDUM-A3-ICONS.md` (A3.1), A2.2 (replaces A2.1) and the skill (v1.2) into the repo and listed them in `CLAUDE.md`; and ran the skill's as-built style index (§3.6) → `design/tokens/AS-BUILT-INDEX.md`, changing no styles until the founder approves.
- **c20 (6 Nov 2026):** Added §0 new-session bootstrap + document map; A2.2 (colour-blind-safe diff colours), A3.1 (icon variables aligned to token system, UI-primitive icons), skill v1.2 (set-up timing, precedence), CLAUDE.md v1.3 (consolidated document list and M-amendment rules).
- **c19 (6 Nov 2026):** UX refine skill v1.1 — §3.6 as-built reverse-engineering index of existing colours, type scale, spacing and other scales (static scan + runtime computed styles; AS-BUILT-INDEX.md, as-built.json, as-built-sheet.html; mapping table; founder approval before migration).
- **c18 (6 Nov 2026):** Added UX refine skill (design tokens, spacing, states, accessibility, personas).
- **c17 (6 Nov 2026):** Added Addendum A3 (icon system, 12 starter custom icons).
- **c16 (6 Nov 2026):** Addendum A2.1: landing dashboard, versions & branches, multiplayer model, mentor amendments M1–M12, Phases 14–16, beta build order.
- **c15 (6 Nov 2026):** Added Addendum A2 (Vault: home dashboard, glass folder design, Phase 14).
- **c14 (6 Nov 2026):** Added Addendum A1 (3D views, presentation renders, sheet layouts; phases 11–13; new `ImageProvider` interface; schema additions for materials, massing, views, sheets).

- **v13 (5 Nov 2026):** Review of the portability audit; clean `PRD.md` v1.2, `CLAUDE.md` v1.2, `fine-tuning-guide.md` v1.2. Fixes R1–R12 (server proxy for keys from P4.1; cm examples and rule units; one TS DXF importer recommended; DWG out of v1; Brief type §4.6 + `GENERATE_LAYOUT`; practice dataset in cm). Added 'current decisions' box at top.
- 🟩 **v12 (4 Nov 2026):** Portability audit (P1–P12, see `PRD.md` v1.1): TypeScript headless engine, CADCraft as reference, cm + versioned format, command layer + 3 AI tools, OpenAI-compatible model access, plug-in interfaces, integration kit.

- **v11 (4 Nov 2026):** Added base-model choice (Qwen first, Gemma 4 second, Mistral options and cautions; A/B in practice run).

- **v10 (4 Nov 2026):** Finch deep research (§11.6). Created `PRD.md` (phases 0–10, prompt-by-prompt, fine-tune gates FT-0…FT-3, screenshot-driven design step) and `CLAUDE.md` for Claude Code.

- **v9 (31 Oct 2026):** Added §9C layout engine (Finch-style auto-layout, options A/B/C, graph-based training idea), §11.5 Finch reference, new tool-menu actions.
- **v8 (31 Oct 2026):** Created companion `fine-tuning-guide.md`; linked from fine-tuning plan. Added the practice-run next action.
- **v7 (31 Oct 2026):** Added CADCraft fork plan and fine-tuning plan summary (§9A).
- **v6 (31 Oct 2026):** Added §9B chat tool menu v0 with AI rules and worked example.
- **v5 (31 Oct 2026):** Added §9A product architecture: CADCraft as engine (license, DXF/DWG status, automation, pre-alpha risk), own UI, minimal toolset, tool-calling chat, two prompt types + router, launch-before-training, smart objects.
- **v4 (31 Oct 2026):** Added §11.4 viability assessment (risks, how to win, first customer test). Added validation as a next action.
- **v3 (31 Oct 2026):** Added §11.3 positioning summary (who is and isn't in the house-plan niche).
- **v2 (31 Oct 2026):** Added competitor deep-dives (§11.1 Skyfall AI SKY-001, §11.2 Praxyz Generative). Corrected the earlier assumption that Skyfall is Indian-HQ. Added the idea of recording build/edit histories in the editor.
- **v1 (31 Oct 2026):** First version, covering the full discussion: market research, wrappers, Indian LLMs, Hugging Face basics, concept explanation, roadmap, CAD builder draft, open questions.
