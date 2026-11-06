# PRD Addendum A2 — Vault, Collaboration, Branching & Mentor Audit

> **Extends:** `PRD.md` v1.2 and `PRD-ADDENDUM-3D-PRESENTATION.md` (A1). All rules still apply: `CLAUDE.md`, PRD §0.2 working rules, §0.4 portability, 🛑 STOP points, `DESIGN.md`.
> **Version:** A2.2 · **Date:** 6 Nov 2026 · **Replaces A2.0/A2.1** (same file name).
> **For Claude Code — first actions when you read this file:**
> 1. In `CLAUDE.md`, make sure the spec references include: *"Also follow `PRD-ADDENDUM-A2-VAULT.md` (amendments M1–M12, Phases 14–16)."* (Replace any older A2 line.)
> 2. Read §2 **Amendments M1–M12**. They change earlier prompts. Apply each one **at the prompt it names**; if that prompt is already done, apply it now through a migration (PRD rules) and 🛑 tell the founder what changed in plain words.
> 3. Do not start Phases 14–16 until the founder types a P14/P15/P16 prompt ID.

---

## 1. What this adds (plain language)

1. **The Vault (landing dashboard)** — the first page after opening the app: workspace, navigation, a folder tree, folder cards and a files table. Opening a file goes to the editor canvas.
2. **Versions & branches** — like Figma: make a branch of a file, work on it, compare it with main, and merge it back. Architects already think in *design options*; a branch is a design option.
3. **Multi-user editing** — several people in the same file at once, seeing each other's cursors and selections, with clear rules when two people change the same thing.
4. **A senior review (mentor audit)** of the whole plan — fixes to make now, while they are cheap (§2), and an honest MVP line (§9).

---

## 2. Mentor audit — amendments to earlier prompts

> Written from the point of view of building CAD and collaborative software for many years. The plan is good; these are the places where CAD and multi-user products usually break, fixed **now** while the code is small.

| ID | Amendment | Apply at | Why it matters |
|---|---|---|---|
| **M1** | **Objects stored in id-keyed maps, not arrays.** `walls`, `rooms`, `openings`, `stairs`, `fixtures`, `materials`, `views`, `sheets`, `frames` become `{ "<id>": {...} }`. Where order matters (layers, sheet frames, z-order), use a **fractional index** string field `order` (e.g. "a0", "a0V"). | **P1.1** | Arrays make every merge and every simultaneous edit conflict ("which position changed?"). Maps keyed by stable id merge cleanly object by object. This is the single most important change. |
| **M2** | **Deterministic commands.** `run()` never calls the clock or random. New ids come from `IdSource` **before** the command and travel inside its params; time comes in params too. Ids are **ULIDs** (unique across users and devices). | **P2.4** | The server must be able to re-run a user's command and get exactly the same result (needed for M8, Phase 16). |
| **M3** | **Room separator lines.** New object `separators` (centre-line, no thickness) that bound rooms like walls but are not built: for open plans (living/dining/kitchen), balconies, OTS edges. Room derivation uses walls **and** separators. | **P1.1 / P2.4** | Without them, open-plan Indian homes cannot have separate rooms with their own areas and rules. |
| **M4** | **A dedicated geometry kernel prompt.** Insert **P1.1b**: wall joins (L/T/X/multi-way, near-parallel, overlapping, tiny gaps), room derivation with a gap tolerance (≤ 2 cm closes), snap rounding to 0.1 cm, robust intersection tests, and **fuzz tests** (random wall sets must never crash or produce self-intersecting rooms). | **New P1.1b** (after P1.1) | Wall joins and room detection are where CAD tools fail most. A kernel with hard tests saves months later. |
| **M5** | **Precision input.** Every drawing tool accepts typed lengths and angles while drawing (e.g. type `450` ↵ for 4.5 m), relative coordinates, and editable dimensions (click a dimension, type a new value → the wall moves). | **P2.5** | Architects draw by numbers. Without typed input, they will not trust the tool. |
| **M6** | **Speed structures.** A spatial index (R-tree) for snapping, hit-testing and rule checks; derived data (rooms, graph, metrics, issues) recomputed **incrementally** for the changed area only (dirty flags). | **P2.3–P3.2** | Keeps 60 fps and the 300 ms check target as plans and teams grow. |
| **M7** | **Gesture coalescing.** A drag, a typed value or an AI batch is **one** undo step and **one** stored change, not hundreds of tiny ones. | **P2.4** | Clean undo; small change logs; fewer conflicts. |
| **M8** | **Per-user undo.** Undo reverts *your own* last change only, never a teammate's. If the object has changed since, undo applies what still makes sense and tells you what it skipped. | **P2.4** (single user now; behaviour proven in Phase 16) | This is what users expect from Figma-style tools. |
| **M9** | **Changesets as a first-class engine type.** Pure functions in `/engine`: `diff(a, b) → changeset`, `apply(doc, changeset)`, `invert(changeset)`, `merge3(base, ours, theirs) → {merged, conflicts}`. Undo, history, branches and multiplayer all use these. | **P2.4** (diff/apply/invert) · **P15.3** (merge3) | One mechanism for undo, versions, branches and sync instead of four. |
| **M10** | **Project package file.** Export/import a whole file as `.plancraft` (zip: document JSON, assets, thumbnails, version list). | **P14.2** | Backups, moving between machines/hosts, support cases. |
| **M11** | **Accounts and workspaces earlier.** P10.1 (accounts, workspaces, roles) must be done **before Phase 15**. Roles: Owner, Admin, Editor, Commenter, Viewer. Data separated per workspace on the server. | Move **P10.1** before **P15.1** | Branches, sharing and multiplayer need to know who is who. |
| **M12** | **Continuous save.** With versions and multiplayer, there is no "Save" button: every change is persisted; **versions** are named checkpoints; autosave creates an unnamed version every 30 minutes of activity. | **P14.4** | Removes "did I save?" and makes branching and history consistent. |

---

## 3. Information architecture
```
Workspace (a firm or team; members with roles)
 └─ Folders (nested)
     └─ Files  (kind: Plan · Sheet set)
         ├─ main            ← the agreed design
         ├─ branches        ← design options / experiments
         └─ versions        ← named checkpoints on main or a branch
```

---

## 4. The Vault — landing dashboard (first page)

**Reference:** founder's dashboard image + folder images in `/design/reference-vault/`. **Style inspiration only** — do not copy names, icons or content from the references.

### 4.1 Layout
```
┌─────────────────────────┬────────────────────────────────────────────────────────┐
│ [AC] Workspace name   ⌄ │  Projects › Residential › 30x40 plots     🔍  [+ New]  │
│      12 members         │────────────────────────────────────────────────────────│
│ 🔍 Search …         ⌘K  │  Folders                                    ⊞ ☰  Sort  │
│                         │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│ ⌂  Home                 │  │ (glass   │ │ (colour  │ │ (archive │ │          │   │
│ ✦  Ask AI               │  │  folder) │ │  folder) │ │  folder) │ │   …      │   │
│ ▤  Plan Library         │  │ 👤👤 2h  │ │   v2.1   │ │ ZIP·1.2GB│ │          │   │
│ ▦  Templates            │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│ ◔  Insights   (later)   │   Residential   Rule packs   Archive 2024                │
│ ⇄  Integrations (later) │   15 files·3 sub 22 files     40 files                  │
│                         │                                                        │
│ PROJECTS            +   │  Files                                                 │
│ ▾ ▣ Residential     15  │  ┌──────────────────────────────────────────────────┐  │
│   ▾ ▣ 30x40 plots    5  │  │ Name         Owner   Edited     Branches Status  │  │
│     ▣ Villas        10  │  │ ▢ 30x40 E 3BHK  P   2 h ago (P)   2   In review │  │
│   ▣ Commercial       5  │  │ ▢ 40x60 N G+1   L   yesterday     0   Draft     │  │
│ ▸ ▣ Client boards        │  │ ▢ Board – Villa H   today        1   Approved  │  │
│                         │  └──────────────────────────────────────────────────┘  │
│ ☆ Starred  ⇆ Shared     │                                                        │
│ 🗑 Trash  ⚙ Settings  ?  │                                                        │
│ (●) account             │                                                        │
└─────────────────────────┴────────────────────────────────────────────────────────┘
```
- **Sidebar (≈ 260 px):** workspace switcher (initials avatar, name, member count); search with **⌘K command palette** (files, folders, commands, Ask AI); primary nav; **Projects tree** (nested folders, colour icons, item counts, expand/collapse, "+" for new folder, drag to reorder/move, selected state as a filled pill); footer: Starred, Shared with me, Trash, Settings, Help, account.
- **Ask AI (workspace level):** "find all 30×40 east-facing plans", "start a new 3BHK on a 30×50 north plot" (uses PRD P6.3). Not the same as the in-editor chat.
- **Insights / Integrations:** hidden until built (show nothing rather than empty pages).
- **Main:** breadcrumb, search, **+ New** (New plan · New folder · Import DXF · Import `.plancraft`), grid/list toggle, sort.
- **Folders row:** dark rounded tiles (radius ≈ 16 px) holding the folder art; title; meta line ("15 files · 3 subfolders").
- **Files table:** icon by kind, Name, Owner (avatar), Edited (time + avatar of last editor), Branches (count), Status (Draft / In review / Approved), Size. Row hover, multi-select, context menu.
- **Theme:** dark like the reference, plus light. 🛑 founder picks the default in P14.1.

### 4.2 Folder art (three variants)
| Variant | Use | Look |
|---|---|---|
| **Glass folder** (default) | Normal project folders | Solid gradient back panel; 2–3 paper sheets showing **real plan thumbnails**; frosted glass front with folder tab; collaborator avatars + "Updated 2h" pill on the glass |
| **Colour folder** | Templates, rule packs, library collections | Saturated colour folder; content icons peeking out; **version badge** (e.g. "v2.1") |
| **Archive folder** | Archived projects / exported packages | Dark matte folder; zip-pull detail; **size badge** ("ZIP · 1.2 GB") |

**Glass folder spec** (starting values; tune with founder): glow = folder colour, blur 40–60 px, 35–50%; back panel radius ≈ 20 px, gradient light → deep tone (orange ≈ `#FF9F5A → #E8590C`, graphite ≈ `#3A3A3C → #1C1C1E`, blue ≈ `#5B8CFF → #2F5BEA`); papers radius 8 px, rotations ≈ −6°/0°/+5°; glass front fill white 18–30% (tinted), `backdrop-filter: blur(14–20px) saturate(140%)`, 1 px inner highlight `rgba(255,255,255,0.5)`, top-to-bottom sheen; text ≥ 4.5:1 contrast; shadow `0 24px 64px rgba(0,0,0,0.08)` + glow.
**States:** hover (papers lift 4–6 px, glow +10%, 180–240 ms); selected (focus ring); drag-over (glass tilts down 6–8°, "opens"); empty (no papers).
**Fallback:** no `backdrop-filter`, reduced transparency or reduced motion → solid tinted front, no animation.

---
## 5. Collaboration model (how multi-user works)

### 5.1 Chosen approach
- **Server-ordered command log**, the approach used by most design tools: each client applies its own change immediately (feels instant), sends the **command + the revision it was based on** to the server; the server puts all changes in one order and sends them to everyone.
- **Conflicts are resolved per object and per property.** Two people changing *different* objects, or *different properties* of the same object, never conflict. The same property changed by two people: the change the server receives **last wins**.
- **Rebase by re-running commands (M2):** if a change was based on an older revision and touches objects that changed meanwhile, the server re-runs the command on the latest document. If `enabled()` now fails (e.g. the wall it needs was deleted), the change is **rejected**, the sender's screen rolls it back, and they see why.
- **The server runs the same `/engine`** (it is plain TypeScript), so validation and rebase use exactly the same rules as the browser. Plan logic still lives only in `/engine`.
- **Derived data is never synced or merged** (rooms polygons, plan graph, metrics, issues); every client recomputes it, so it can't conflict.
- Why not a CRDT library? CAD has rules between objects (doors live on walls, rooms come from walls). Re-running commands keeps those rules true; a generic CRDT can merge into a state the rules don't allow. A CRDT can be revisited later behind the same `SyncProvider` interface (§7).

### 5.2 CAD conflict policies
| Situation | Result |
|---|---|
| A and B move different walls | Both apply |
| A renames a room, B resizes it | Both apply (different properties) |
| A and B drag the same wall | Last received wins; the other user sees it move, with a small "moved by A" hint |
| A deletes a wall, B adds a door on it | B's change rejected: "Wall was deleted by A" + one-click undo of A's delete if B has rights |
| A moves a wall that hosts B's door | Door follows the wall (hosting rule) |
| A runs **GENERATE_LAYOUT / REFLOW** on a level while B edits that level | **Advisory level lock** while generation runs (seconds): others see "A is regenerating Ground floor"; their edits to that level wait in a queue and are re-run afterwards (or rejected with reason) |
| A edits a rule value, B edits another rule | Both apply; same rule → last wins |
| A and B edit the same sheet | Frames are independent objects; order via fractional index (M1) |
| A undoes (M8) after B changed the same object | Only A's still-valid parts are undone; A is told what was skipped |

**Transient locks:** while a user is dragging an object, others see it highlighted in that user's colour and cannot grab it until release (prevents tug-of-war). Locks expire automatically (≤ 10 s without activity).

### 5.3 Presence
Avatars of people in the file; live cursors with names; selection outlines in each user's colour; "follow" a user's view; who-is-on-which-level indicator; typing indicator in the AI chat when someone is running a command through AI.

### 5.4 Offline and reconnect
Changes made offline queue locally. On reconnect they are rebased (§5.1). If more than ~20% of them are rejected, or the user was offline > 24 h, the app offers: **"Save your offline work as a branch"** instead of forcing a messy merge.

---

## 6. Versions & branches (Figma-style)

- **Versions:** named checkpoints ("Client review 1"), plus automatic unnamed ones (M12). View any version read-only; restore = create a new version that copies it (history is never rewritten).
- **Create branch:** from main (or a version): name + description; the branch starts as an exact copy; edits are recorded as changesets.
- **Update branch from main:** pull main's newer changes into the branch (three-way merge, conflicts resolved inside the branch).
- **Compare:** visual diff on the canvas — **added** blue, **removed** vermillion, **changed** amber (colour-blind-safe, tokens `diff.added/removed/changed`), always with **+ / − / ~** glyphs or hatch patterns; side-by-side or overlay slider; change list grouped by level and type; **metrics delta** (carpet area, FSI, Vastu score) and **issues delta** (new / fixed reference-check issues).
- **Merge into main:** `merge3(base, main, branch)` (M9). Non-overlapping changes merge automatically; same property changed on both sides → a **conflict card** per object (keep main / keep branch / view both). After merging, validation and reference checks run; new issues are shown before confirming. The merge creates a version on main; the branch is archived (restorable).
- **Review (optional):** "Request review" → reviewer comments and approves → merge. Workspace setting **"Protect main"**: only Admins/Owners merge, edits to main only via branches.
- **Design-option use:** branches show as tabs ("Option A — central courtyard", "Option B — L-plan"); boards (A1 Phase 13) can place views from different branches side by side for client presentations.

---

## 7. Data model & interfaces (additions)

```json
{
  "doc": {"schema_version": "1.1.0", "levels": {"L0": {"walls": {"01J…W1": {"start": [0,0], "end": [914,0], "thickness": 23}}}}},
  "changeset": {"id": "01J…", "author": "u-priya", "base_rev": 41, "command": {"id": "MOVE", "params": {}},
                "patches": [{"path": ["levels","L0","walls","01J…W1","end"], "before": [914,0], "after": [914,30]}], "ts": "…"},
  "version": {"id": "v-12", "file_id": "D1", "branch_id": "main", "rev": 120, "label": "Client review 1", "created_by": "u-leo"},
  "branch":  {"id": "b-3", "file_id": "D1", "name": "Option B – L-plan", "base_version": "v-12", "head_rev": 37,
              "status": "active|in_review|merged|archived", "created_by": "u-priya"}
}
```
- Vault records (folders, files) as in A2.0, plus `workspace_id`, `owner_id`, `last_editor_id`, `status`, `branch_count`, `size_bytes`, `archived`.
- **Interfaces (PRD §3.4), extended:**
  - `DocumentStore` + vault methods (`listFolder`, `createFolder`, `rename`, `move`, `duplicate`, `setStar`, `setColor`, `archive`, `trash`, `restore`, `deleteForever`, `search`, `recent`, `getThumbnail`) + history methods (`listVersions`, `createVersion`, `listBranches`, `createBranch`, `getChangesets(fromRev)`).
  - **New `SyncProvider`:** `connect(fileId, branchId)`, `send(changeset)`, `onRemote(cb)`, `onReject(cb)`, `presence.update/subscribe`, `lock/unlock`. Local single-user implementation = no-op loopback, so the app works fully **without** a server.
  - `AuthContext` adds `workspace`, `role`, `can(action, resource)`.
- All new engine functions (diff, apply, invert, merge3, rebase-by-rerun) are **pure** and live in `/engine`; WebSockets, database and auth live in `/server`.

---
## 8. Phases and prompts

### Recommended build order (whole product)
```
BETA BUILD
P0 → P1.1 (with M1, M3) → P1.1b (M4) → P1.2–P1.4 → P2.1 → P14.1 → P2.2 → P2.3 (M6)
   → P14.2–P14.5 (M10, M12) → P2.4 (M2, M7, M8, M9) → P2.5 (M5) → P3 → P4 → P5 → P6 → P7
   → P10.1 (M11, moved up) → Phase 15 → A1: P11, P12.1–P12.4, P13.1–P13.3, P13.5
   → Phase 8 → P10.2–P10.4 (privacy, telemetry, beta programme)
AFTER BETA FEEDBACK
   → Phase 9 (when FT-1 is met) · Phase 16 · A1 P12.5, P13.4 · P10.5 · Integrations/Insights
```
🛑 Claude Code: if the founder asks for a prompt whose prerequisites in this order are missing, say which ones and ask before continuing.

### PHASE 14 — Vault (landing dashboard)

#### P14.1 — 🛑 Dashboard + folder style → DESIGN.md + component page
**Tasks:** 🛑 ask the founder to place the dashboard and folder references in `/design/reference-vault/`, choose the default theme (dark / light), folder colours, and which nav items to show at launch. Build: sidebar, workspace switcher, tree item, folder tile (3 variants, §4.2), file row, ⌘K palette shell. Add their specs to `DESIGN.md`. Show a static page with all components, themes and states.
**✅** Founder approves the component page.

#### P14.2 — Vault storage (+ M10)
**Tasks:** §7 vault records and `DocumentStore` vault methods (local implementation in `/data/vault/`), migrations + tests; thumbnails from the engine's SVG render on change (debounced); `.plancraft` export/import; seed a demo workspace with folders and 3 sample plans.
**✅** Create / rename / move / star / archive / trash / restore / search / export / import pass tests; thumbnails update after a plan edit.

#### P14.3 — Dashboard screen
**Tasks:** implement §4.1 fully: tree with counts and drag-to-move, folder tiles, files table (sortable columns), grid/list, breadcrumb, **+ New** menu, context menus, multi-select, empty states; Plan Library view with **"Use as starting point"** (copies a library plan into a folder); Templates view (when templates exist); ⌘K palette (files, folders, commands, Ask AI entry).
**✅** A new user can create a folder, import a DXF into it and open it in the editor without help (🛑 founder test).

#### P14.4 — Editor ⇄ Vault flow (+ M12)
**Tasks:** open file → editor; editor top bar: Home button, editable file name, branch selector (shows "main" until Phase 15), save state ("Saved · Saving… · Offline"); continuous save; unnamed auto-versions every 30 min of activity; returning Home restores folder and scroll; deep link `#<file-id>`.
**✅** Edit → Home → reopen shows the latest state; nothing lost on refresh or crash.

#### P14.5 — Starred, Shared, Trash, search, shortcuts
**Tasks:** Starred and Trash views (restore; delete forever with confirmation; 30-day auto-delete), Shared-with-me (hidden until P10.1), search with filters (kind, BHK, facing, status, owner), shortcuts (N new plan, ⇧N new folder, F2 rename, Del → Trash, ↵ open, ⌘K palette).
**✅** All views work in grid and list; shortcuts listed in Help.

### PHASE 15 — Versions & branches (needs P10.1)

#### P15.1 — Version history
**Tasks:** history panel (auto + named versions with author, time, change summary); name a version; view read-only; restore as a new version; storage on the server per workspace.
**✅** Restoring an old version never deletes newer history; tests cover it.

#### P15.2 — Branches
**Tasks:** create branch (from main or a version), switch branches (editor selector + dashboard "Branches" column), rename, archive, **update from main**; branches as design-option tabs.
**✅** Two branches of one file evolve independently; updating a branch from main pulls main's new changes.

#### P15.3 — Diff & three-way merge (engine, M9)
**Tasks:** pure `diff`, `apply`, `invert`, `merge3` over id-keyed maps; property-level conflict detection; post-merge validation (orphaned openings, broken joins) with deterministic repairs or explicit conflicts; **property-based tests**: random edit sequences on two sides always produce a valid document or a reported conflict — never a crash or silent corruption.
**✅** 1,000 randomised merge tests pass; golden merge cases (§5.2 situations) give the documented results.

#### P15.4 — Compare & merge UI
**Tasks:** visual diff (blue / vermillion / amber + glyphs, overlay slider, side-by-side), change list, metrics and issues delta, conflict cards (keep main / keep branch / view both), merge confirmation showing new issues; merge creates a version on main.
**✅** Founder merges a branch with 2 deliberate conflicts and understands every step without help (🛑).

#### P15.5 — Review, permissions, protected main
**Tasks:** request review, comments on a branch, approve / request changes; roles from M11 enforced (`can()`); workspace setting "Protect main"; audit log of merges.
**✅** A Viewer cannot edit; an Editor cannot merge into a protected main; the audit log records every merge.

### PHASE 16 — Real-time multiplayer (after the beta proves demand — see §9)

#### P16.1 — Sync server & protocol
**Tasks:** WebSocket service in `/server`; per-file, per-branch ordered changeset log; snapshots every N changes; `SyncProvider` (browser) with optimistic apply, server acknowledge, rebase-by-rerun, reject + rollback; reconnect with resume from last revision.
**✅** Two browsers editing the same file converge to identical documents in automated tests, including injected latency and dropped messages.

#### P16.2 — Presence
**Tasks:** avatars, live cursors, selection outlines, follow mode, per-level presence, AI-activity indicator (§5.3).
**✅** 5 simulated users show smooth cursors (≥ 20 updates/s, < 150 ms perceived lag on a normal connection).

#### P16.3 — Conflict policies, locks, per-user undo
**Tasks:** implement §5.2 table; transient drag locks; advisory level lock for GENERATE_LAYOUT / REFLOW; per-user undo (M8) with skipped-parts notice; friendly rejection messages with the how-to-fix pattern (PRD §4.5).
**✅** Every row of §5.2 has an automated test with the documented outcome.

#### P16.4 — Offline & recovery
**Tasks:** local queue; rebase on reconnect; "save offline work as a branch" (§5.4); crash recovery from local queue.
**✅** 30 minutes of offline edits reconnect without data loss; heavy conflicts produce a branch offer.

#### P16.5 — Load & convergence testing
**Tasks:** fuzz test with 10 simulated users × 10 minutes of random commands; measure server CPU/memory per active file; document limits in `INTEGRATION.md`.
**✅** Zero divergence; no corrupted documents; limits documented.

---

## 9. Mentor's MVP line (honest advice)

The product has grown: AI generation, solver, 3D, boards, vault, branches, multiplayer. Each is worthwhile, but building all of them before real users try the core is the most common way products like this fail.

| Build for the beta (first) | Build after beta feedback |
|---|---|
| Phases 0–7 (engine, editor, checks, chat, solver, generation, DXF/PDF) | Phase 16 real-time multiplayer |
| Phase 14 Vault | A1 P12.5 photoreal/AI renders, P13.4 board templates |
| P10.1 accounts + Phase 15 versions & branches (async teamwork, design options) | Phase 9 own model (needs data anyway — FT-1 gate) |
| A1 P11 3D viewer, P12.1–P12.4 render styles, P13.1–P13.3 + P13.5 basic boards | P10.5 pricing/billing, Integrations, Insights |
| Phase 8 data flywheel, P10.2–P10.4 privacy, telemetry, beta programme | |

**Why branches before live multiplayer:** branches give teamwork and design options with far less risk (no live sync), and every piece (changesets, merge3, versions) is reused later by multiplayer. Because amendments M1, M2, M7–M9 are applied **now**, adding multiplayer later is an extension, not a rewrite.

**Other cautions:**
- Keep golden test plans growing with every bug found — in CAD, regressions in geometry are the most expensive bugs.
- Measure on real founder plans early (performance numbers on toy plans mislead).
- Put the IP/FTO check (PRD §2.2) and a privacy notice in place before the first external beta user.

---

## 10. Non-functional additions
- Dashboard opens in < 1 s with 500 items; grids/tables over 200 items are virtualised.
- Glass blur only on visible tiles; solid fallback during fast scroll if frame rate drops.
- Multiplayer: local edit visible instantly; remote edits visible < 200 ms on a normal connection; server keeps the last 30 days of changesets per file plus snapshots.
- Security: every server request checks workspace + role; documents of different workspaces are never mixed in queries; audit log for merges, deletes and role changes.
- Accessibility: keyboard navigation in sidebar, tree, grid, table; visible focus; text contrast ≥ 4.5:1 on glass.

## 11. Risks
| Risk | Mitigation |
|---|---|
| Merge produces an invalid plan | Command re-run + post-merge validation + property-based tests (P15.3) |
| Generation clobbers teammates' work | Advisory level lock + queue (§5.2) |
| Sync complexity delays launch | Phase 16 after beta; branches first; local loopback `SyncProvider` keeps single-user mode simple |
| Data model change late | M1–M3 applied at P1.1 now |
| Copying reference designs | References are style-only |

## 12. Change log
- **A2.2 (6 Nov 2026):** Diff colours changed to colour-blind-safe blue / vermillion / amber with glyphs (per `plancraft-ux-refine` skill). All colours, spacing and states in this file are starting values: final values come from the token system (skill §3).
- **A2.1 (6 Nov 2026):** Landing dashboard from founder's reference (workspace switcher, ⌘K, nav, projects tree, folder tiles in 3 variants, files table); collaboration model (server-ordered commands, property-level resolution, rebase by re-running commands, CAD conflict table, locks, presence, offline); versions & branches with visual diff and three-way merge; mentor audit amendments **M1–M12** to earlier prompts; Phases 14 (updated), 15 and 16; recommended build order; MVP line.
- **A2.0 (6 Nov 2026):** Vault with left nav + main space, glass folder cards, storage model, Phase 14.
