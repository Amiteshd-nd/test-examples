# Memory
Updated: 2026-11-06

Working facts about the project and the founder that fit nowhere else. Product context and history: `text-to-cad-project-memory.md`. Decisions: `DECISIONS.md`.

## About the founder
- An architect, not a developer. Explain results in plain language first, technical detail second (CLAUDE.md rule 3).
- Builds for small Indian architecture firms, draftsmen and builders; typical plots 30×40, 30×50, 40×60 ft.
- Answers STOP questions quickly when they come as short multiple choice.
- Approves numbered decision lists tersely ("Approve 1–4, 6, 7; keep 11 px floor; code wins"; "code wins" = keep the code's values where docs and code disagree). End design or audit work with a short numbered 🛑 list with a recommendation, and act only on what was approved.
- A dismissed question or an interrupted request means **stop and wait** (2026-11-06: an interrupted "commit and push" was carried out only when re-sent on its own). Push, publish or delete only on an explicit, uninterrupted request.
- Mobile app (A4): write rules, don't build (2026-11-06; `docs/design/mobile-viewer-rules.md`).
- Sends material ahead of time "to refer to when needed" (e.g. UI references on 2026-11-06): file it where its prompt will look (`design/reference/README.md`), don't start that prompt early.
- Visual taste (from 2 references): monochrome drafting aesthetic, dot grids, hairlines, `+` corner marks, monospace data, one blueprint-blue accent. Details: `design/reference/README.md`.
- Works one PRD prompt at a time (`Do P#.#`); don't start the next prompt unasked.

## Working agreements
- Ask before adding any dependency, paid service or external API, except tools the PRD prompt itself names.
- Never ask for, or accept, an API key in chat. Keys go into `server/.env` only, by the founder.
- `npm run check` must be green before a prompt is reported done.
- Start each prompt by checking `TASKS.md` founder to-dos: the existing editor code (D-03) is still outstanding.
- 2026-11-06: the founder runs parallel Claude sessions in this folder (the Build session for PRD prompts, a design-system session for UI fixes, maybe others). Ownership and rules: `SESSIONS.md`.
- 2026-11-06: founder asked to "keep doing it one after the other": continue to the next PRD prompt without waiting for `Do P#.#`; still stop at every 🛑 that needs their answer, and build around missing inputs when they say so (e.g. P1.2 without sample DXFs).

## Environment
- macOS, Node 24, npm 11. Vite dev server on its default port 5173.
- Git: baseline commit on `main` (6 Nov 2026, end of Phase 2), pushed to `origin` = https://github.com/Amiteshd-nd/test-examples.git at the founder's request. Commit and push only when the founder asks.
