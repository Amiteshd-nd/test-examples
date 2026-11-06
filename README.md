# PlanCraft (working name)

A browser CAD editor for residential floor plans: draw by hand or instruct an AI in chat, with live reference checks, auto-layout and layered DXF output. Built around a **headless TypeScript engine** that other editors can adopt.

The full spec is [`PRD.md`](PRD.md). Claude Code builds it one prompt at a time (`Do P1.1`); see [`CLAUDE.md`](CLAUDE.md).

## Run it

You need Node.js 24+ and npm 11+.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. Today it shows a placeholder page; the real editor arrives in Phase 2. The design style sheet is at http://localhost:5173/styleguide.html and the Vault (home dashboard) components at http://localhost:5173/vault.html.

## Check it

| Command | What it does |
|---|---|
| `npm test` | Runs all tests once (Vitest), including the engine-purity check |
| `npm run test:watch` | Re-runs tests as files change |
| `npm run typecheck` | TypeScript strict check of every package |
| `npm run lint` | ESLint, including the engine-purity rule |
| `npm run format` / `format:check` | Prettier: fix / verify code formatting |
| `npm run import` | Converts every DXF under `data/raw/` into `data/converted/` (plan, report, preview) |
| `npm run fixtures` | Writes two synthetic test drawings to `data/raw/synthetic/` |
| `npm run library` | Tags and stores every converted plan in `data/library/`; writes `tag-review.csv` |
| `npm run library:review` | Applies your corrections from `data/library/tag-review.csv` |
| `npm run test:dxf` | Exports the sample plans to `data/exports/check/` and checks them with ezdxf (needs the Python tools, below) |

Python tools (only for `test:dxf`), once:

```bash
python3 -m venv tools/.venv && tools/.venv/bin/pip install ezdxf pytest
```
| `npm run check` | All of the above; must pass before a prompt is called done |

## Folders

| Folder | What lives there |
|---|---|
| `engine/` | The headless engine: plain TypeScript, data in, data out. Hosts use only `engine/index.ts`. |
| `frontend/` | React + Vite UI. Calls the engine; contains no plan logic. |
| `server/` | Thin server for AI calls and secrets. Empty until P4.1. |
| `tools/` | Offline scripts (bulk import, dataset export, ezdxf checks). |
| `data/` | `raw/`, `converted/`, `library/`, `exports/`. Not committed, except `raw/samples/`. |
| `design/` | UI look: `reference/` screenshots and `DESIGN.md` (from P2.1). |
| `docs/` | `decisions/` (ADR files) and `design/` (product briefs and specs). |

## Project docs

| File | Purpose |
|---|---|
| `PRD.md` | The spec: phases, prompts, acceptance checks. Wins every disagreement. |
| `CLAUDE.md` | Standing rules for Claude Code. Read first. |
| `ARCHITECTURE.md` | How the code is built today. |
| `TASKS.md` | What's next, by PRD prompt ID. |
| `DECISIONS.md` | Every decision made in the repo, with why. |
| `MEMORY.md` | Working facts about the project and the founder. |
| `PROGRESS.md` | Log of each finished prompt. |
| `INTEGRATION.md` | How another editor adopts the engine. |
| `SCHEMA-CHANGELOG.md` | Every plan-format version and its migration. |
| `THIRD_PARTY_NOTICES.md` | Licences of code we ported. |
| `text-to-cad-project-memory.md` | Product context and history. |
| `fine-tuning-guide.md` | Training our own model. |
