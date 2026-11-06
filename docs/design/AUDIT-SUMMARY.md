# Audit summary: making the CAD engine easy to plug in anywhere

Date: 4 Nov 2026. All four briefs are amended so the engine stands on its own and is easy for any editor to adopt later. Every change is marked:

- 🟩 **ADDED [Px]**: new text
- 🟨 **CHANGED [Px]**: rewritten (the old wording is ~~struck through~~)
- 🟥 **REMOVED [Px]**: no longer applies

The full change log, P1 to P12, is at the top of `PRD.md`.

## The main changes, in plain words

- **TypeScript instead of a Python server (P1).** Python stays for offline jobs: bulk import and training. PRD §3.3 lists what we gain and what we lose. The one real loss is Google's CP-SAT solver, and it can still be added later behind the same "solve" door.
- **A headless engine (P2).** It's the part that does the work, with no screens, network or database inside it. The UI sits on top and can be swapped out.
- **CADCraft is a reference, not the core (P3).** We borrow its ideas and the code its licence allows.
- **A data format that survives growth (P4, P5).** Sizes are stored in centimetres, every object has an id that never changes, and the format has a version number with upgrades for old files. Rooms are worked out from the walls, and doors and windows sit on their wall.
- **One command layer for everything (P6).** The keyboard, toolbar and AI all use the same commands. Each command is one undo step, and the AI gets 3 tools instead of 40.
- **Standard model access (P7).** Gemini now, and your own model later, both connect through the common "OpenAI-compatible" format, so switching models is a settings change.
- **Plug-in points (P8).** Storage, login, files and AI models come in through small, fixed connectors, so another app can supply its own.
- **Clear issue and trust labels (P9), office layer standards applied on DXF export (P10), and training data in the engine's own format (P12).**
- **An integration kit (P11)** is now part of the plan: one public entry file, an integration guide, a log of format changes, and a set of test plans any app can run.

---

## Review of the audit (5 Nov 2026) — clean v1.2

The audit is sound and is now merged into clean files: `PRD.md` v1.2, `CLAUDE.md` v1.2 and `fine-tuning-guide.md` v1.2 have **no strikethroughs or inline marks**, so Claude Code reads one clear instruction per topic. The history is kept in each file's change log. Twelve fixes were added:

- **R1. A small server is needed from Phase 4.** A browser app can't hide an API key, so AI calls go through a tiny TypeScript server that holds the Gemini key. It contains no plan logic, so the engine stays portable.
- **R2. Old pictures and old tech-stack rows removed**, sections renumbered.
- **R3. Examples now in centimetres**, every rule value states its unit, sizes round to 1 mm, rooms store a "seed point" and their shape is worked out from the walls.
- **R4. One DXF importer instead of two (recommended).** The same TypeScript importer reads uploads in the browser and bulk-imports your library; Python's ezdxf only double-checks our files. Claude Code asks you to confirm in P1.2.
- **R5. P0.2 is now a reading review of CADCraft**, not a build of its WebAssembly app.
- **R6. P2.3 loads plans through the storage connector**, not a "backend" that no longer exists.
- **R7. DWG export is out of v1.** DXF only; AutoCAD opens it directly.
- **R8. A "Brief" type is defined (§4.6)** and generation is one command, `GENERATE_LAYOUT`, that takes a Brief. The AI fills the Brief; the solver draws it. The training data uses the same Brief.
- **R9. Collecting edit logs from beta users and shadow-testing your model need the server's storage**; this is now stated where it applies.
- **R10. The AI's "picture of the plan" tool** is drawn by the engine as SVG and turned into an image outside the engine.
- **R11. "Reference check" wording everywhere**, never "code-compliant".
- **R12. The practice-run training format and its scorer now use centimetres**, matching what the engine exports (the old scorer used metres and would have given wrong results).
