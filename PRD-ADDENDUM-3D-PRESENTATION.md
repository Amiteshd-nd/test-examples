# PRD Addendum A1 — 3D Views, Presentation Renders & Sheet Layouts

> **Extends:** `PRD.md` v1.2 (all its rules apply: §0.2 working rules, §0.4 portability, commands, provenance, 🛑 STOP points).
> **Version:** A1.0 · **Date:** 6 Nov 2026
> **For Claude Code — first action when you read this file:** add one line to `CLAUDE.md` under the spec reference: *"Also follow `PRD-ADDENDUM-3D-PRESENTATION.md` (phases 11–13)."* Then continue with whatever prompt the founder asked for. Do not start these phases until the founder types a P11–P13 prompt ID.

---

## 1. What this adds (plain language)

From the same plan the architect draws or generates, the tool will:
1. **Build a 3D model automatically** (walls, slabs, openings, stairs, parapets, roof terraces) — no separate 3D modelling.
2. **Render presentation images** in architectural styles: white-model axonometrics, material axonometrics with callouts, exploded level-by-level views, diagram overlays (program, circulation), and optional photoreal / AI-enhanced images.
3. **Lay out presentation sheets and boards** (A1–A4, square social posts, multi-page decks) with live-linked views, plans, diagrams, a project-overview table filled from real metrics, legends, scale bars and title blocks — exported as PDF/PNG.

**Scope change to PRD §1.4:** "3D/BIM authoring" stays a non-goal. 3D here is a **view derived from the 2D plan document** (not a separate 3D editor). In v1 the user edits in 2D; in 3D they only orbit, pick views, assign materials and annotate.

**Style references:** the founder's reference images go in `/design/reference-3d/`. They are **style inspiration only**: never reproduce a specific project, building, firm name, logo or caption from them.

## 2. When to build it
- **Earliest start:** after P2.4 (smart objects) — the 3D model needs walls, levels and openings.
- **Recommended:** after Phase 7 (export & print), so 2D output is solid first. Phases 11–13 can run in parallel with Phases 8–9.
- **Order:** P11 → P12 → P13. P12.5 (photoreal/AI) is optional.

## 3. Architecture (fits PRD §3)
```
/engine  (pure, headless)            /frontend (rendering only)
 plan → 3D scene description  ───▶   three.js viewer + post-processing
 (meshes as plain arrays, materials,  styles · camera presets · hi-res export
  levels, labels, diagram data)
 sheets/boards document  ─────────▶  sheet editor (canvas) · PDF/PNG export
```
- `/engine` builds **scene data** (vertices, faces, material ids, element ids, level ids) and **sheet data** as plain JSON. No three.js, WebGL or DOM inside `/engine`.
- `/frontend` turns scene data into three.js objects and renders. three.js and helpers are added only after the founder approves (§8).
- New plug-in interface (PRD §3.4): **`ImageProvider`** — sends a rendered image + depth/edge maps + prompt to an image-generation service, returns an image. Calls go through `/server` (keys stay on the server). Used only by P12.5.

## 4. Data model additions (schema bump + migration + test, per PRD rules)
```json
{
  "materials": [{"id": "m-white-cement", "name": "White cement", "base_color": "#EDEBE6",
                 "roughness": 0.9, "texture": null, "category": "finish"},
                {"id": "m-brick", "name": "Exposed brick", "base_color": "#A85A3C",
                 "roughness": 0.8, "texture": "brick-01", "category": "finish"}],
  "material_assignments": [{"object_id": "W1", "face": "exterior", "material": "m-white-cement"}],
  "massing": {"parapet_height": 100, "slab_thickness": 15, "plinth_height": 45,
              "context_blocks": [{"id": "C1", "polygon": [[...]], "height": 900}]},
  "views": [{"id": "V1", "name": "Axo NE", "kind": "axonometric|exploded|perspective|plan|section",
             "camera": {"azimuth": 45, "elevation": 35.264, "ortho": true, "zoom": 1.0},
             "style_id": "white-model", "visible_levels": ["L0", "L1"], "explode_gap": 0}],
  "sheets": [{"id": "S1", "size": "A2", "orientation": "portrait", "template_id": "board-default",
              "frames": [{"id": "F1", "kind": "view|plan|diagram|text|table|legend|image|scalebar|north|titleblock",
                          "ref": "V1", "rect": [20, 20, 380, 300]}]}]
}
```
- All lengths in **cm** (sheet frame rects in **mm on paper**).
- Defaults filled by the engine carry provenance `"assumed"` (e.g. parapet height); the UI shows them as editable.
- Diagram data (program colours, circulation paths) is **derived**, never hand-stored.

## 5. Phases and prompts

### PHASE 11 — 3D model & viewer

#### P11.1 — Plan → 3D scene (engine)
**Tasks:** extrude walls per level (`elevation`, `height`, `thickness`) as joined solids; cut door/window openings (sill/head heights from data or defaults); slabs per level with stair openings; plinth; parapets on roofs and terraces; simple stairs (stepped mass); balconies/OTS voids; output scene JSON with element ids for picking. Add `materials`, `material_assignments`, `massing` to the schema (migration + test).
**✅** A 2-level golden plan produces a watertight scene; every mesh traces back to a plan object id; moving a wall in 2D updates the scene; unit tests on opening cuts and slab voids.

#### P11.2 — 3D viewer
**Tasks:** 🛑 ask founder to approve adding three.js (MIT). Viewer panel/tab per DESIGN.md: orbit/pan/zoom, **orthographic axonometric presets** (isometric 30°, dimetric, NE/NW/SE/SW), perspective toggle, level visibility, section box, click-to-select (syncs with 2D selection), save/load named views.
**✅** 60 fps orbit on a typical 3-level house; selecting a wall in 3D highlights it in 2D and vice versa.

#### P11.3 — Materials & context
**Tasks:** material library panel (starter set: white cement/plaster, exposed brick, concrete, timber, glass, metal, stone, terracotta jaali); assign by clicking faces or by rule ("all external walls of L0 = brick"); context: neighbour blocks from drawn polygons + heights, road/footpath strips, ground plane; generic entourage (trees, people, car) as **simple low-poly stylised models made by us or CC0-licensed** (record source in `THIRD_PARTY_NOTICES.md`).
**✅** Founder can produce a brick-base / white-upper massing with neighbour blocks in under 2 minutes (🛑 founder test).

#### P11.4 — AI tools for 3D
**Tasks:** new commands (usable from toolbar, command line and `plan_execute`): `SET_MATERIAL`, `SET_VIEW`, `SAVE_VIEW`, `SET_LEVEL_VISIBILITY`, `ADD_CONTEXT_BLOCK`, `SET_EXPLODE`, `RENDER_VIEW`. Extend `plan_capture` to accept a view id (returns a rendered image for the AI).
**✅** Chat request "make the ground floor brick and the upper floors white cement, show NE axonometric" produces the right result as one undo step.

---

### PHASE 12 — Presentation render styles

#### P12.1 — 🛑 Style references → RENDER-STYLES.md
**Tasks:** 🛑 ask the founder to put 4–10 reference images in `/design/reference-3d/` and to rank which looks matter most. Describe each look in `/design/RENDER-STYLES.md` as parameters (background, paper texture, palette, line weight, shadow softness, ambient occlusion strength, sun angle, label style, entourage style). Do not name or copy the referenced projects.
**✅** Founder approves RENDER-STYLES.md.

#### P12.2 — Non-photoreal styles (core)
**Styles to implement as presets (`style_id`):**
- `white-model` — white/grey clay massing, soft sun shadow, ambient occlusion, subtle edges, plain light background.
- `material-axo` — assigned materials, soft shadows, paper-grain background, thin dark edges.
- `line-drawing` — black/blue linework on white (edge + hidden-line style), light hatch on cut planes.
- `diagram-tint` — white model with colour overlays from §12.3.
**Tasks:** post-processing (ambient occlusion, edge detection/outline, soft shadows); sun position from site latitude/longitude, date and time (🛑 ask founder before adding a sun-position library); background textures generated procedurally or CC0.
**✅** Each style renders the golden plan; founder confirms each matches RENDER-STYLES.md (🛑).

#### P12.3 — Exploded & analytical views
**Tasks:**
- **Exploded axonometric:** levels (and optionally roof, slab, furniture layer) separated vertically by `explode_gap`, with dashed alignment lines between levels.
- **Program diagram:** rooms coloured by category (public / shared / private / service; mapping editable) + legend.
- **Circulation diagram:** main and secondary flow arrows derived from the Plan Graph (doors, stairs, entrance).
- **Open-space diagram:** terraces, balconies, OTS, garden highlighted.
- **Level sequence:** a row of thumbnails building up level by level (for "design concept" strips).
- **Callouts:** numbered markers or leader lines attached to object ids (e.g. "01 Main entrance", "Brick"), text editable, positions stay attached when the model updates.
**✅** For the golden plan, all five outputs generate in one click each; callouts follow their objects after a 2D edit.

#### P12.4 — High-resolution export
**Tasks:** export PNG at 2K / 4K / 8K (tiled rendering if needed), transparent-background option, SVG for `line-drawing` where feasible; filename and metadata include plan version.
**✅** 4K export of a typical house in < 30 s; exported image matches the on-screen view.

#### P12.5 — Photoreal / AI-enhanced renders (optional)
🛑 Ask the founder to choose (cost and quality differ):
- **A. In-browser path tracing** (free, slower, geometrically exact).
- **B. AI image enhancement** through `ImageProvider` (fast, very realistic, adds vegetation/lighting; may change details).
- **C. Both.**
**Rules:** AI-enhanced images are labelled **"AI-enhanced illustration — not to scale"** in the UI and in file metadata; the geometry-exact render is always kept alongside; the user's prompt and settings are saved with the image; never send client-identifying data to the image service without consent.
**✅** Founder approves 3 sample renders (🛑).

---

### PHASE 13 — Sheets & presentation boards

#### P13.1 — 🛑 Board references → BOARD-DESIGN.md
**Tasks:** 🛑 ask the founder for 3–6 board/sheet references, preferred sizes (A1/A2/A3/A4, square 1080×1080, 16:9 slides), logo, fonts. Extract a board grid system, typography, colour, label and table styles into `/design/BOARD-DESIGN.md` (same method as P2.1). No copying of referenced boards' text, names or exact layouts.
**✅** Founder approves BOARD-DESIGN.md and a blank template page.

#### P13.2 — Sheet editor
**Tasks:** new "Sheets" workspace: page sizes, margins, grid and snapping; frames for view / plan / diagram / text / table / legend / image / scale bar / north arrow / title block; drag, resize, align, distribute; multi-page documents; frames are **live-linked** — a plan or view frame updates when the plan changes (with a "freeze this frame" option).
**✅** A 3-page document with linked frames survives a plan edit with all frames updated; undo/redo works across sheet edits.

#### P13.3 — Smart content blocks
**Tasks:**
- **Project overview table** auto-filled from metrics (P5.2): site area, built-up area, total floor area, floors, height, FSI/FAR, structure, status — each value shows provenance; editable labels.
- **Legend blocks** auto-generated from the diagrams used on the sheet.
- **Plans at scale** (1:50 / 1:100 / 1:200) with correct scale bar on paper.
- **Title block / captions** from project fields.
- **Design-concept strip** (level sequence or diagram series with arrows).
**✅** Scale bars measure correctly on printed PDF; the overview table matches the metrics panel.

#### P13.4 — Templates & auto-layout
**Tasks:** 4–6 starter templates from BOARD-DESIGN.md (e.g. hero axo + analysis strip + overview table; exploded axo poster; plan set sheet; square social post); `AUTO_LAYOUT_SHEET` command that fills a template from the current project; AI commands `CREATE_SHEET`, `PLACE_FRAME`, `ADD_CALLOUT`, `APPLY_TEMPLATE` via `plan_execute`.
**✅** Chat request "make an A2 portrait board with the exploded axo, ground floor plan at 1:100, program diagram and project overview" produces a sensible board in one undo step; founder rates it usable after minor tweaks (🛑).

#### P13.5 — Export
**Tasks:** PDF (vector for text, plans and line drawings; embedded high-res raster for renders), PNG per page, multi-page PDF deck; fonts embedded; print-ready at chosen size; a footer note on renders/boards: "Design aid — architect must verify".
**✅** A2 PDF prints at correct scale and opens correctly in common PDF viewers.

---

## 6. Non-functional requirements (additions)
- 3D viewer ≥ 30 fps (target 60) on a mid-range laptop for a 3-level house; scene rebuild after a 2D edit < 500 ms.
- Hi-res 4K render < 30 s; board PDF export < 20 s for 4 pages.
- Large textures loaded lazily; the editor stays responsive while rendering (render off the main thread where possible).
- Everything works offline except P12.5 option B.

## 7. Risks
| Risk | Mitigation |
|---|---|
| 3D slows the 2D editor | 3D in its own tab/panel, built lazily; scene rebuild debounced |
| Renders look generic | Styles defined from founder references (P12.1); tuned with founder sign-off |
| AI renders alter the design | Clear "not to scale" label; exact render kept alongside; prompt saved |
| Copying reference projects | References are style-only; no names, captions or layouts copied |
| Asset/texture licences | Own or CC0 assets only; sources in `THIRD_PARTY_NOTICES.md` |

## 8. Dependencies to propose (ask before adding each)
three.js (MIT) · a post-processing package for three.js (MIT) · optionally a path-tracing package (MIT) for P12.5-A · a sun-position library (permissive) · a PDF library (already planned in PRD §3.2) · CC0 textures. Confirm licences at the time of adding.

## 9. Change log
- **A1.0 (6 Nov 2026):** First version: Phase 11 (3D model & viewer), Phase 12 (render styles, exploded/analytical views, hi-res, optional photoreal/AI), Phase 13 (sheets, smart blocks, templates, PDF export). New `ImageProvider` interface; schema additions for materials, massing, views, sheets.
