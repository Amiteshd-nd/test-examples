# Exceptions to the atomic rules

> A5 §5.4: an organism may use an atom directly only when it is listed here with a reason. This file also records what sits **outside** the levels. Each entry names who approved it. Add entries only with the founder's yes, and record them as a DS-nn decision too. The step-5 guard-rail lint will read the **Approved** table. Components and levels: `registry.json`. Findings: `ATOMIC-AUDIT.md`.
>
> Started 7 Nov 2026 (step 1 of the PA.1 plan, DS-05).

## Approved

| Id | Exception | Applies to | Why | Approved |
|---|---|---|---|---|
| E1 | Organisms, templates and pages may use the atoms **Button** (with RoundButton), **IconButton**, **Icon** (with ToolIcon and FolderIcon) and **Badge** (export name `Chip`) directly. | every organism, template and page | A molecule wrapped around one of these would add nothing. Atoms using `Icon` is not an exception; A5 §5.2 already allows it. | Founder, 7 Nov 2026 (DS-05, answer 2) |
| E2 | **Folder art** keeps its exact illustration values: colours and gradients, blur, shadows, the 220 ms motion and the radii of `.fart*` / `.farch*` in `vault/vault.css`, and the `folder-card.*` tokens. In step 4 those tokens get level metadata only. | `FolderArt`, `FolderTile`, `AvatarGroup` (on the glass folder) | It is an illustration, not interface ("code wins"). The token lint already allows it (`design/tokens/lint-allow.json`). | Founder, 7 Nov 2026 (DS-05, answer 3; DS-01) |
| E3 | **Renderers** are outside the levels: `Canvas` (with `SnapMarker`), `PlanView`, `GraphOverlay`, `ToolShapes`. They draw the plan in SVG, not from DOM atoms; `canvas.*`, diff and presence tokens stay semantic. | the four renderers | A5 §3 | A5 spec |
| E4 | **Reference pages** are outside the levels: `/styleguide.html` (`StyleGuide`) and `/vault.html` (`VaultPage`). They may show any level and use raw values. Their demo copies (Avatar, Sidebar, FilesTable, Palette) are replaced by the real components in step 6. | `frontend/src/styleguide/**`, `frontend/src/vault/VaultPage.tsx` | They document the system and aren't product screens. The token lint already allows the style sheet. | A5 PA.5; DS-01 |
| E5 | The **app shell** (`App.tsx`) is outside the levels: it only routes between the Vault and the editor. | `frontend/src/App.tsx` | It has no interface of its own. | A5 §4 |

## Scope notes

- **No density setting for now** (founder, DS-05 answer 4): the C10 check covers theme and text size only. Once step 4 has moved the stylesheets onto semantic tokens, a density setting only needs new token values.

## Open: decided in step 3

These organisms use atoms **not** covered by E1. They are not exceptions; step 3 either builds a small molecule for each case or brings a new exception to the founder.

| Atom | Used directly by | Likely fix |
|---|---|---|
| Input | NameDialog, NewPlanDialog, SearchFilters | Each sits inside `FormField` (its child slot). Either allow the slot, or add TextField / SelectField molecules. |
| Select | ItemsView, NewPlanDialog, SearchFilters, FolderPage | Same as Input; the sort control becomes a labelled molecule. |
| Thumbnail | FolderGrid, FileCards, LibraryTable | Through `FileCard` / a library row molecule. |
| Avatar | FilesTable | Through a person cell molecule or `AvatarGroup`. |
| StatusDot | ImportResultDialog, EditorTopBar, IssuesPanel | A summary line molecule ("● 3 errors · 2 warnings") or a new E-entry. |
| Switch | IssuesPanel | A labelled setting row molecule. |
| Divider | ToolRail | A5's own example of an allowed exception ("a single Divider"); bring it to the founder as E6. |

Known violations (sideways imports, raw values, states in feature CSS) are **not** exceptions. They are listed in `ATOMIC-AUDIT.md` → Violations and get fixed in steps 2–4.
