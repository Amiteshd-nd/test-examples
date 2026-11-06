# Mobile viewer — rules for when it is built (Phase 17)

> **Status:** rules only. **The mobile app is not being built now** (founder, 6 Nov 2026). Phase 17 starts only when the founder types a PM prompt ID, after the desktop beta, P10.1 (accounts and roles) and Phase 15 (versions and branches) (A4 §11).
> **Source:** `PRD-ADDENDUM-A4-MOBILE-VIEWER.md` (A4.0). Every rule below comes from it (section in brackets). Where this file and A4 disagree, A4 wins; a newer A4 version replaces these rules.
> **How to use:** a session working on Phase 17 reads this file first. Each rule can be checked; the PM acceptance checks (end of file) prove them.

## The golden rule

**MV-1. The mobile app is read-only.** It never changes a plan, a sheet, a folder, a version or a branch. This is enforced **on the server**: mobile sessions get read-and-share permission only. Hiding buttons is not enough. [§1, §9]

## What the app may do

- **MV-2. View:** the 2D plan by level, sheets and boards page by page, the 3D view (once A1 exists), project metrics, the rooms list. [§3]
- **MV-3. View-only tools, never saved:** pan and zoom; tap an object for its details; **temporary measure**; show or hide layers and dimensions **for this view only**; units switch (m ⇄ ft-in); level switcher. [§3]
- **MV-4. History, read-only:** see versions and branches, switch to view one, and see what changed (diff view in the A2.2 colours: blue / vermillion / amber, always with + / − / ~ glyphs). [§3]
- **MV-5. Share:** share links, export the current view or sheet as PDF or PNG, the phone's share sheet, QR code. [§3]
- **MV-6. Offline:** keep chosen files available offline. [§3]
- **MV-7. Personal actions only:** star / unstar, mark available offline, change your own settings. Nothing else is written. [§3]

## What the app must never do

- **MV-8. No editing of any kind:** drawing, moving, deleting, properties, rule packs, materials, sheet layout. [§3]
- **MV-9. No AI generation and no chat editing.** [§3]
- **MV-10. No creating, renaming, moving or deleting** files or folders. [§3]
- **MV-11. No merging branches, approving reviews or restoring versions.** [§3]
- **MV-12. No comments, markups or live co-editing in v1** (later candidates, §13). [§3]
- **MV-13. Out-of-scope features are simply absent**, never shown as disabled teasers, and nothing hints at editing. The only exception is **"Open on desktop"**, which sends the file link to the user's own email or desktop session. [§3, §4]

## Data and server

- **MV-14. One source of truth:** mobile reads the **same** plan document, sheets, versions and branches as desktop and never writes them. [§9]
- **MV-15. Same access rules:** read-only use of `DocumentStore` (read methods, versions and branches listing) and the same account and role checks (`AuthContext`). [§9]
- **MV-16. Same geometry:** drawings come from the same engine rules as desktop, through `engine/index.ts`. No separate "mobile geometry", so dimensions and areas always match desktop. [§9]
- **MV-17. The server refuses every write** from mobile and share-link sessions. They may only **read** and **create or revoke share links and exports**. [§1, §9]
- **MV-18. Personal state stays outside the plan:** starred files, the offline list and view settings are stored per user, never inside the plan document. [§9]

## Screens and navigation

- **MV-19. Structure:** sign in → workspace, then Home (Recent · Starred · Offline files), Projects (folder drill-down with a breadcrumb back), Library (read-only), Shared, Search (files, folders, rooms and tags such as BHK and facing), Settings (Theme · Text size · Units · Site mode · Offline storage · Account). [§4]
- **MV-20. File viewer:** Plan (levels), Sheets (pages), 3D (when available), Info (metrics, rooms list, reference-check summary, read-only), History (versions and branches: read-only switch and compare), Share (link, export, QR). [§4]
- **MV-21. One-handed navigation:** a bottom tab bar (Home, Projects, Search, Shared, Settings). The file viewer is full screen, with a top bar (back, file name, version / branch chip, share) and a bottom toolbar (Plan / Sheets / 3D / Info / History). [§4]

## Viewer behaviour

- **MV-22. No gesture-only actions.** Every gesture has another way to do it: [§5]

  | Action | Gesture | Other way |
  |---|---|---|
  | Zoom | Pinch | + / − buttons, double-tap to zoom in, a "Fit" button |
  | Pan | One- or two-finger drag | Arrow buttons in the accessibility toolbar; the object list jumps to an object |
  | Select / inspect | Tap an object | The rooms and objects list (Info) |
  | Measure (temporary) | Tap the start, tap the end; snaps to wall ends, corners and midpoints | Measure between two objects picked from the list |
  | Change level | Swipe the level switcher | Segmented control or list |
  | Next sheet page | Swipe | Page buttons and page list |

- **MV-23. Inspect sheet:** tapping a room, wall or opening shows name, type, dimensions with units, area (carpet / built-up), level, that object's reference-check notes (read-only), and provenance badges where a value is assumed. [§5]
- **MV-24. Always on the plan:** north arrow and scale bar. Room labels with areas, tabular numerals, units shown. Dimensions and layers can be toggled for this view only. [§5]
- **MV-25. Version clarity:** a chip always shows what you're looking at: "main · latest", "Version: Client review 1", "Branch: Option B", or "Offline copy · updated 2 h ago". An old version or a branch shows a clear banner. [§5]
- **MV-26. Site mode** is one toggle that gives: the maximum-contrast theme, larger text and line weights for sunlight, the screen kept awake while viewing, a simplified toolbar, and dimensions on by default. [§5]
- **MV-27. Speed:** a typical plan's first paint takes under 2 s on a mid-range phone on 4G. Zoom and pan stay smooth (target ≥ 50 fps). Sheets load page by page. [§5]

## Sharing

- **MV-28. Links are view-only by default.** Options: expiry date, password, allow download (PDF / PNG) on or off, and which version or branch the link shows ("always latest main" or "frozen at this version"). Links can be revoked from desktop and from mobile. [§6]
- **MV-29. Who may share is set by workspace roles and settings** (A2.2, P10.1). Admins can turn off public links or require passwords. [§6]
- **MV-30. No install needed:** every share link opens in any phone or desktop browser as a read-only viewer, with no account needed for public links. The app is an enhanced viewer, not a requirement. [§6]
- **MV-31. Exports:** the current plan view, a level, or sheets as PDF (at scale, with title block) or PNG. **Every export carries the footer "Design aid — architect must verify".** [§6]
- **MV-32. Share sheet and QR:** send links or exported files through the phone's share sheet (WhatsApp, email, messages). Show a QR code for the current file and version, so a site supervisor can scan and open it. [§6]
- **MV-33. Privacy check before external sharing:** show what will be visible (file name, client name in the title block). Never include data the sender's role can't share. [§6]

## Offline

- **MV-34. Snapshots:** "Make available offline" per file or per folder downloads a snapshot of the chosen version: plan, sheets and thumbnails, with 3D optional because of its size. [§7]
- **MV-35. Labelled and refreshed:** offline copies show their version and time. They refresh automatically when online, unless the user picks "keep this version" (for site use). [§7]
- **MV-36. Storage screen:** offline files with sizes, remove, total usage. [§7]
- **MV-37. Works offline:** measuring, inspecting and exporting. Share links wait until the phone is online; exported files can still be shared directly. [§7]

## Design and accessibility

- **MV-38. Same design system:** the same semantic tokens and A3.1 icons, plus a **touch density** mode (targets at least 44 × 44, larger paddings), dark and light themes, and the site-mode high-contrast theme. [§8]
- **MV-39. Follow the phone's settings:** system text size (dynamic type), dark / light, reduced motion, reduced transparency, bold text. [§8]
- **MV-40. Screen readers:** the rooms and objects list stands in for the canvas. Level changes, measurement results ("Distance 4.50 m") and page changes are announced. [§8]
- **MV-41. One-handed:** main actions within thumb reach (bottom bar, bottom sheets); safe areas respected; landscape supported for plans and sheets. [§8]
- **MV-42. Plain language:** plain words, units always shown, no technical jargon on screens clients see. [§8]
- **MV-43. Persona walkthroughs** (skill §7), adapted: a supervisor on site in sunlight, a client opening a WhatsApp link, a principal reviewing a branch between meetings. [§8, PM.7]

## How Phase 17 is run

- **MV-44. Decide the technology first (PM.0 🛑).** Before any mobile code, present the options (native, cross-platform, mobile web / PWA, or a web viewer first and an app later) with costs and trade-offs. Record the founder's decision in `docs/decisions/`. **Never choose without the founder.** [§10, §12]
- **MV-45. Mobile design next (PM.1 🛑).** Ask for mobile references in `design/reference-mobile/`. Add touch density, the site-mode theme and the mobile components (bottom tab bar, bottom sheet, segmented level switcher, share sheet, version chip) to `DESIGN.md` and the token system. The founder approves a mobile component sheet in dark, light and site mode. [§10]
- **MV-46. Order of prompts:** PM.0 → PM.1 → PM.2 browse and search → PM.3 plan viewer → PM.4 sheets and 3D → PM.5 history and share → PM.6 offline → PM.7 accessibility, site mode and audit. [§10]
- **MV-47. Share-link viewer earlier only if asked:** the browser viewer for share links (part of PM.5) may come before the app if the founder wants clients to view links sooner. Ask (🛑); don't decide. [§11]
- **MV-48. Left for later, don't build now:** push notifications, tablet-only layouts, app-store distribution (§12); comments and redlines, approving from mobile, watching live presence, read-only "Ask AI", regional languages, AR site overlay (§13).

## Acceptance checks (from the PM prompts)

| Prompt | Proven when |
|---|---|
| PM.1 | The founder approves the mobile component sheet in dark, light and site mode |
| PM.2 | Any file can be found and opened in ≤ 3 taps from Home or via search |
| PM.3 | Measured distances match desktop exactly on 5 golden plans; nothing the user does is saved to the plan |
| PM.4 | An A2 sheet viewed on a phone matches the desktop PDF |
| PM.5 | A client opens a WhatsApp link on a phone without the app and sees the right version; a revoked link stops working |
| PM.6 | In airplane mode, an offline file opens, measures and exports correctly |
| PM.7 | The supervisor, client and principal walkthroughs complete without gesture-only steps or unreadable text |

## Existing project rules that also apply (not new; from `CLAUDE.md` and earlier decisions)

- Plan logic only through `engine/index.ts`. The engine stays headless (CLAUDE.md rules 9–12).
- Ask before adding dependencies, paid services or external APIs (CLAUDE.md rule 5). No secrets in the app bundle (rule 14).
- Wording says "reference check", never "code-compliant" (rule 13).
- Tokens only, no raw colours or pixel sizes, as enforced by the token lint (DS-02, DS-03). Icons through the `Icon` component (A3.1).
- The UX skill's quick pass after each prompt that touches UI, and its full audit at the end of the phase (PM.7).
- Room labels that don't fit their room at the current zoom are left out, area first (DS-04): the same rule on mobile, since the drawing rules are shared (MV-16).
