# CLAUDE.md — Standing instructions for Claude Code

This project is an AI-assisted floor-plan CAD editor built around a **headless TypeScript engine** that other editors can adopt. The full spec is **`PRD.md`** (v1.2) — follow its §0.4 portability rules in every prompt. Context and decisions: **`text-to-cad-project-memory.md`** (where it disagrees with the PRD, the PRD wins). Model training: **`fine-tuning-guide.md`**.
Also follow `PRD-ADDENDUM-3D-PRESENTATION.md` (phases 11–13).
Also follow `PRD-ADDENDUM-A2-VAULT.md` (amendments M1–M12, Phases 14–16).
Also follow `PRD-ADDENDUM-A3-ICONS.md` (A3.1: icon system, prompts PI.1–PI.4). Never use emoji or random icon sets in the UI; use the `Icon` component.
Also follow `PRD-ADDENDUM-A4-MOBILE-VIEWER.md` (Phase 17, mobile viewer — view & share only; tech stack to be decided with the founder first). **Not being built now** (founder, 6 Nov 2026); when Phase 17 starts, follow the rules in `docs/design/mobile-viewer-rules.md` (MV-1…MV-48).
Also follow the skill **`plancraft-ux-refine`** (`.claude/skills/plancraft-ux-refine/SKILL.md`, v1.2: design tokens, spacing, states, accessibility). Run its **quick pass** (§9) after every prompt that touches `/frontend`, a **full audit** (§2) at the end of each UI phase (P2, P14, P13, PI), and its **as-built index** (§3.6) before any token migration. Newer addendum versions win on conflicts (A2.2 over A2.1, A3.1 over A3.0); the skill decides *how* UI is specified, `DESIGN.md` the *look*, the PRD and addenda *what* exists.

## How to work
1. The founder will say a prompt ID like `Do P1.2`. Execute **only** that prompt from `PRD.md`.
2. At every 🛑 STOP in the PRD, ask the founder the listed questions and **wait**. Never guess STOP answers.
3. At the end of every prompt: run its ✅ acceptance checks (plus the UX skill's quick pass if it touched `/frontend`), update `PROGRESS.md`, and summarise in plain language first (the founder is an architect, not a developer), technical details second.
4. At the end of every **phase**: check the 🧠 fine-tune gate conditions (PRD §6) and report progress toward the next gate; update `INTEGRATION.md`, `SCHEMA-CHANGELOG.md` and the golden test plans; run the UX skill's full audit if the phase had UI.
5. Ask before adding dependencies, paid services, or external APIs.
6. Write tests for logic modules; keep them green. Vitest, `x.test.ts` beside `x.ts`; TypeScript strict mode. pytest only in `/tools`.
7. UI work must follow `/design/DESIGN.md` (created in P2.1 from the founder's screenshots). Do not copy CADCraft's or any competitor's interface.
8. Do not reproduce competitors' proprietary or patented methods (PRD §2.2). Use general techniques (rules, constraint solving, retrieval).

## Engine rules
9. **`/engine` is headless and pure:** data in, data out. No React, DOM, `fetch`, database, or Node `fs`/`net`/`http` inside it. The UI and server call only `engine/index.ts`.
10. **The Plan document is the single source of truth.** Geometry in **cm** (rounded to 0.1 cm), areas in m², stable ids, rooms derived from walls, openings hosted on walls. Every format change: `schema_version` bump + migration + test + `SCHEMA-CHANGELOG.md` entry.
11. **Every change is a command:** id, zod params schema, `enabled()`, pure `run()`; works from keyboard/toolbar, the text command line and the AI tools; one undo step; batches all-or-nothing; has a test.
12. **Storage, accounts, files and AI models** come in through the PRD §3.4 interfaces. Never call a specific database, login service or model vendor from `/engine`.
13. **Every generated number carries provenance** (measured / inferred / assumed). Issues use the PRD §4.5 format with a how-to-fix sentence. Wording says **"reference check"**, never "code-compliant".

## Secrets and security
14. Secrets only in `/server/.env` (never in code, commits, logs, chat, or the frontend bundle — no API keys in `VITE_*` variables). AI calls go browser → `/server` proxy → model. Never ask the founder to paste a key into chat.

## Licences
15. Never copy code from GPL or unlicensed projects. CADCraft (MIT/Apache-2.0) code may be ported with its notice kept in `THIRD_PARTY_NOTICES.md`.

## Project memory
After major decisions, append a short entry to `text-to-cad-project-memory.md` (section "Change log") so future Claude sessions stay in sync.

## Repo docs (added in P0.1)
**Start every session by reading `HANDOFF.md`** (current position, next steps, gotchas). **Several sessions may run at once: read `SESSIONS.md` before editing** (who owns which files, rules for shared files).
Read before each prompt: `TASKS.md` (what's next + founder to-dos), `DECISIONS.md` (decisions made in the repo, append-only; supersede, never edit), `MEMORY.md` (working facts about the founder and environment), `ARCHITECTURE.md` (what is actually built). Update them at the end of each prompt alongside `PROGRESS.md`. Product briefs and specs go in `docs/design/`; ADR files in `docs/decisions/`.

Commands: `npm run dev` (frontend, http://localhost:5173) · `npm test` · `npm run typecheck` · `npm run lint` · `npm run check` (everything; must be green before a prompt is done).
