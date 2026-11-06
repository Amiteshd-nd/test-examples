# Parallel sessions: who is working on what

Updated: 2026-11-06

The founder sometimes runs several Claude Code sessions in this folder at the same time. They share **one working tree** and there are **no git commits yet**, so one session can silently overwrite another's work. **Read this file before editing anything, add or update your row when you start, and move it to "Finished" when you stop.**

## Sessions now

| Session | Doing | Owns (edit freely) | Shared: small exact edits only | Leave alone |
|---|---|---|---|---|
| **Build** (the PRD prompts) | P2.5 done (2026-11-06, D-44): Phase 2 complete. Next **P3.1** (rule packs), waiting for the founder. `editor.css` and `ui/PlanView.tsx` are back with the design-system / docs & UX sessions; the Build session keeps the editor's `.ts` / `.tsx` files | `engine/**`, `tools/**` (except other sessions' new files), `frontend/vite.config.ts`, `frontend/src/vault/{client,http-storage,listing}.ts`, `frontend/src/app/**`, `frontend/src/library/**`, `frontend/src/editor/*.ts`, `Palette.tsx`, `ResizeHandle.tsx` (shared: `Editor.tsx`, `Canvas.tsx`), `e2e/**`, `playwright.config.ts`, `PROGRESS.md`, `TASKS.md`, `HANDOFF.md`, `ARCHITECTURE.md`, `INTEGRATION.md`, `SCHEMA-CHANGELOG.md`, `text-to-cad-project-memory.md`, `data/**` | `frontend/src/editor/Editor.tsx`, `Canvas.tsx`, `Properties.tsx`, `frontend/src/vault/Dashboard.tsx`, `items.tsx`, `dialogs.tsx`, `frontend/src/App.tsx`, `design/DESIGN.md`, `DECISIONS.md` | — |
| **Design system / UI fixes** | Visual fixes the founder asks for | `frontend/src/design/**` (tokens, `ui.css`), `frontend/src/ui/**` (components, icons, `Menu.tsx`, `PlanView.tsx` styling, `PlanThumbnail.tsx`), all `*.css` (`editor.css`, `vault.css`, `dashboard.css`, `styleguide.css`), `frontend/src/styleguide/**`, `frontend/src/vault/VaultPage.tsx`, `folder-art.tsx`, `design/**` except as noted | same as Build's shared column | `engine/**`, `tools/**`, `data/**`, PRD prompt work, `TASKS.md`, `HANDOFF.md`, `PROGRESS.md` (except its own section, below) |

Add a row for any other session the same way (what it does, what it owns).

## Rules

1. **Re-read a file right before you change it**, and on shared files make **exact-text edits** (the Edit tool), never whole-file rewrites or scripts that rewrite a file: the Edit tool refuses to edit a file that changed since you read it; a rewrite would erase the other session's work.
2. **Run Prettier only on the files you changed** (`npx prettier --write <file> …`), never on whole folders.
3. `npm run check` sees everyone's work. If it fails in files you didn't touch, the other session is probably mid-change: say so to the founder and leave those files alone.
4. **Decisions:** one table in `DECISIONS.md`, append-only, re-read before appending. The Build session uses `D-39`, `D-40`, …; the design-system session uses `DS-01`, `DS-02`, …
5. **Logs:** the design-system session records design changes in `design/DESIGN.md` (in the section it changes, plus a dated line under "Change log" at its end) and a short entry in `PROGRESS.md` under its own heading `## UI fixes (design-system session) · <date>`. Only the Build session edits `TASKS.md` and `HANDOFF.md`.
6. **Only the Build session starts PRD prompts** (`P#.#`). `HANDOFF.md`'s "next prompt" is for the Build session.
7. **One dev server:** `npm run dev` on port 5173 is shared; Vite reloads everyone's changes. Don't stop it.
8. **`data/vault/` is shared test data:** don't reset it (`npm run vault:seed -- --reset`) or delete from it without asking the founder.
9. **No commits, branches or worktrees without the founder.** Recommended to the founder (2026-11-06): one baseline commit, then a branch or worktree per session, which makes parallel work safe and reviewable. **Done 2026-11-06:** baseline commit on `main`, pushed to `origin` (github.com/Amiteshd-nd/test-examples).

## Finished

- 2026-11-06 · Build · P2.2a collapsible side panels (session 3, see `PROGRESS.md`); took the editor fixes from DS-01 (`.ed-badge` 11 px, 24 px status-bar targets, avatar/badge colour tokens). The four `editor.css` entries in `design/tokens/lint-allow.json` are no longer needed.
- 2026-11-06 · Build · P2.2, P2.3, P14.2, P14.3, P14.4, P14.5 + Phase 14 end (see `PROGRESS.md`). Context full; continues in a new chat from `HANDOFF.md` with P2.2a.
- 2026-11-06 · Docs & UX index · A3.1 + skill in `CLAUDE.md`; memory file merged (c14–c20); as-built style index in `design/tokens/` (🛑 founder decisions pending; no styles changed). Its tool: `tools/as-built-scan.ts` + `tools/as-built/`.
- 2026-11-06 · Tokens (docs & UX session) · token system v1 (DS-01): `design/tokens/*.json` → `npm run tokens` → generated `frontend/src/design/tokens.css` / `tokens.ts` (**don't hand-edit tokens.css**; old names are aliases); approved contrast and target fixes outside the editor. Editor fixes are in P2.2a.
- 2026-11-06 · Lint + full UX audit (docs & UX session) · token lint in `npm test` (DS-02); audit `design/audits/2026-11-06-full-ui.md` with fixes in shared components; re-run with `node tools/audit-run.ts`. Build-owned findings B1–B4 sent to the Build session.
- 2026-11-06 · UI scale + folder contrast + empty states (docs & UX session) · DS-03: Settings → Text size (rem tokens, `cssPx()` for code, lint forbids px sizes), folder-art pills/chips, "No plans here yet". All stylesheets converted, editor included (after P2.4).
