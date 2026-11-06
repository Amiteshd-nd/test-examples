# PRD Addendum A4 — Mobile App Foundations (View & Share only)

> **Extends:** `PRD.md` v1.2, A1 (3D & presentation), A2.2 (Vault, versions & branches), A3.1 (icons), skill `plancraft-ux-refine`. All rules still apply.
> **Version:** A4.0 · **Date:** 6 Nov 2026
> **Scope of this file:** product foundations only — what the mobile app is, who it serves, what it does and must never do, screens, behaviour, sharing, offline, design and accessibility. **The mobile tech stack is intentionally NOT decided here** (see §12).
> **For Claude Code — first action when you read this file:** add one line to `CLAUDE.md` under the spec references: *"Also follow `PRD-ADDENDUM-A4-MOBILE-VIEWER.md` (Phase 17, mobile viewer — view & share only; tech stack to be decided with the founder first)."* Do not start Phase 17 until the founder types a PM prompt ID.

---

## 1. What the mobile app is (plain language)

A **companion viewer** for phones and tablets, like Figma's mobile app: people can **open, look at, measure and share** plans, sheets and 3D views — **but never edit** them. All design work happens on desktop.

**Golden rule: the mobile app is read-only.** It never changes a plan, a sheet, a folder, a version or a branch. This is enforced on the server (mobile sessions get a read-and-share permission only), not just hidden in the interface.

## 2. Who it is for

| Person | Typical moment | What they need |
|---|---|---|
| **Site supervisor / contractor** | Standing on site, phone in one hand, bright sun | Exact dimensions, levels, offline access, large readable text, high contrast |
| **Client / homeowner** | At home or in a meeting | Beautiful sheets and 3D, simple navigation, no jargon, nothing to install for a shared link |
| **Architect / principal on the move** | Between meetings | Quick review of the latest version or a branch, share with client or site in seconds |
| **Student** | Class, studio, commute | Browse own work and library plans, show work to faculty |

## 3. In scope (v1) and out of scope

**In scope — view & share**
- Sign in; switch workspace.
- Browse: Home (Recent, Starred), Projects (folders), Plan Library (read-only), Shared with me, Search.
- Open a file and **view**: 2D plan by level, sheets/boards (page by page), 3D view (when A1 exists), project metrics, rooms list.
- **View-only tools** that change nothing and are never saved: pan/zoom, tap an object for details, **temporary measure**, show/hide layers and dimensions **for this view only**, units switch (m ⇄ ft-in), level switcher.
- **History read-only:** see versions and branches; switch to view a version or branch; see what changed (diff view, A2.2 colours).
- **Share:** share links, export the current view or sheet as PDF/PNG, system share sheet (WhatsApp, email, etc.), QR code.
- **Offline:** keep chosen files available offline.
- **Light personal actions** that don't touch design data: star/unstar, mark available offline, change own settings.

**Out of scope (v1)** — never shown as disabled teasers; simply not present
- Any editing: drawing, moving, deleting, properties, rule packs, materials, sheet layout.
- AI generation and chat editing.
- Creating, renaming, moving or deleting files and folders.
- Merging branches, approving reviews, restoring versions.
- Comments and markups (candidates for later, §13).
- Live co-editing (viewers may later *see* presence; see §13).

## 4. Information architecture
```
Sign in → Workspace
 ├─ Home        Recent · Starred · Offline files
 ├─ Projects    Folder list → subfolders → files (drill-down, breadcrumb back)
 ├─ Library     Firm's Plan Library (read-only)
 ├─ Shared      Files shared with me
 ├─ Search      Files, folders, rooms/tags (BHK, facing)
 └─ Settings    Theme · Text size · Units · Site mode · Offline storage · Account
File viewer
 ├─ Plan (levels)   ├─ Sheets (pages)   ├─ 3D (when available)
 ├─ Info            metrics, rooms list, reference-check summary (read-only)
 ├─ History         versions · branches (read-only switch, compare)
 └─ Share           link · export · QR
```
- **Navigation:** bottom tab bar (Home, Projects, Search, Shared, Settings) for one-handed reach; file viewer is full screen with a top bar (back, file name, version/branch chip, share) and a bottom toolbar (Plan / Sheets / 3D / Info / History).
- **"Open on desktop" handoff:** a menu item that sends the file link to the user's own email/desktop session; no editing hints elsewhere.

## 5. Viewer behaviour

**Gestures and their non-gesture alternatives** (accessibility rule: no gesture-only actions)
| Action | Gesture | Alternative |
|---|---|---|
| Zoom | Pinch | + / − buttons, double-tap to zoom in, "Fit" button |
| Pan | One- or two-finger drag | Arrow buttons in the accessibility toolbar; object list jumps to an object |
| Select / inspect | Tap object | Rooms & objects list (Info) |
| Measure (temporary) | Measure tool: tap start, tap end; snaps to wall ends, corners and midpoints | Measure between two objects picked from the list |
| Change level | Swipe the level switcher | Segmented control / list |
| Next sheet page | Swipe | Page buttons and page list |

**Inspect bottom sheet** (tap a room/wall/opening): name, type, dimensions with units, area (carpet/built-up), level, reference-check notes for that object (read-only), provenance badges where values are assumed.

**Plan display:** north arrow and scale bar always visible; dimensions on/off; layer visibility (local only); room labels with areas; tabular numerals; units switch.

**Site mode** (one toggle): maximum contrast theme, larger text and line weights for readability in sunlight, keep screen awake while viewing, simplified toolbar, dimensions on by default.

**Version clarity:** a chip always shows what you're looking at — "main · latest", "Version: Client review 1", "Branch: Option B", or "Offline copy · updated 2 h ago". Viewing an old version or branch shows a clear banner.

**Performance feel:** first paint of a typical plan < 2 s on a mid-range phone on 4G; zoom/pan smooth (≥ 50 fps target); sheets load page by page.

## 6. Sharing

- **Share link:** view-only by default; options: expiry date, password, allow download (PDF/PNG) on/off, which **version/branch** the link shows ("always latest main" or "frozen at this version"). Links can be revoked from desktop and mobile.
- **Who can share:** governed by workspace roles and settings (A2.2 / P10.1). Workspace admins can disable public links or require passwords.
- **Recipients without the app:** every share link opens in **any phone or desktop browser** as a read-only viewer — no install, no account for public links. The app is an enhanced viewer, not a requirement.
- **Export:** current plan view, a level, or sheets as PDF (at scale, with title block) or PNG; every export carries the footer "Design aid — architect must verify".
- **System share sheet:** send links or exported files to WhatsApp, email, messages, etc.
- **QR code:** show a QR for the current file/version so a supervisor on site can scan and open it.
- **Privacy:** before sharing externally, show what will be visible (file name, client name in title block); never include data the sender's role can't share.

## 7. Offline

- "Make available offline" per file (or per folder): downloads a **snapshot** of the chosen version (plan, sheets, thumbnails; 3D optional because of size).
- Offline copies are labelled with version and time; they refresh automatically when online (user can choose "keep this version" for site use).
- Storage screen: list offline files with sizes; remove; total usage.
- Measuring, inspecting and exporting work offline; sharing links queue until online (export files can still be shared directly).

## 8. Design & accessibility (follow the UX skill)

- **Same design system:** semantic tokens and icons (A3.1) with a **touch density** mode (targets ≥ 44×44, larger paddings), dark and light themes, plus the site-mode high-contrast theme.
- **Respect phone settings:** system text size (dynamic type), dark/light, reduced motion, reduced transparency, bold text.
- **Screen readers:** the canvas is complemented by the rooms & objects list; announcements for level change, measurement results ("Distance 4.50 m"), page changes.
- **One-handed use:** primary actions within thumb reach (bottom bar, bottom sheets); safe areas respected; landscape supported for plans and sheets.
- **Language:** plain words; units always shown; client-facing screens avoid technical jargon.
- **Personas walkthroughs** (skill §7) adapted: supervisor on site in sunlight; client opening a WhatsApp link; principal reviewing a branch between meetings.

## 9. Data rules (contracts only — no stack)

- The mobile app reads the **same plan document, sheets, versions and branches** as desktop; it never writes them.
- It uses read-only access to storage and history (`DocumentStore` read methods, versions/branches listing) and the same account/role checks (`AuthContext`).
- Drawings shown on mobile come from the same engine rules as desktop (no separate "mobile geometry"), so dimensions and areas always match the desktop.
- Server enforces: mobile and share-link sessions can **read** and **create/revoke share links and exports** only; any write attempt is refused.
- Personal state (starred, offline list, view settings) is stored per user and never inside the plan.

## 10. Phase 17 — prompts (product level)

#### PM.0 — 🛑 Tech-stack decision (deferred)
Before any mobile code: present options to the founder (native, cross-platform, mobile web/PWA, or web viewer first + app later) with costs and trade-offs; record the decision in `/docs/decisions/`. **Do not choose on your own.**

#### PM.1 — 🛑 Mobile design adaptation
Ask the founder for mobile references (place in `/design/reference-mobile/`); add touch density, site-mode theme and mobile components (bottom tab bar, bottom sheet, segmented level switcher, share sheet, version chip) to `DESIGN.md` and the token system.
**✅** Founder approves a mobile component sheet in dark, light and site mode.

#### PM.2 — Browse & search
Home, Projects drill-down, Library, Shared, Search, starring, pull-to-refresh, empty/loading/error states.
**✅** Find and open any file in ≤ 3 taps from Home or via search.

#### PM.3 — Plan viewer
Levels, pan/zoom with alternatives (§5), inspect sheet, temporary measure with snapping, dimensions/layers toggles (local), units switch, north arrow, scale bar, version chip.
**✅** Measured distances match desktop values exactly on 5 golden plans; nothing the user does is saved to the plan.

#### PM.4 — Sheets & 3D viewer
Page-by-page sheets with zoom; 3D orbit with saved views from desktop (when A1 exists); exports respect scale.
**✅** A2 sheet viewed on phone matches the desktop PDF.

#### PM.5 — History (read-only) & share
Versions/branches list, switch view, compare (A2.2 colours + glyphs); share links with options (§6), revoke, export PDF/PNG, system share sheet, QR code; browser viewer for link recipients.
**✅** A client opens a WhatsApp link on a phone without the app and sees the right version; a revoked link stops working.

#### PM.6 — Offline
Offline files, snapshots, labels, refresh, storage screen (§7).
**✅** In airplane mode, an offline file opens, measures and exports correctly.

#### PM.7 — Accessibility, site mode & audit
Run the UX skill full audit for mobile: touch targets, screen readers, dynamic type up to the largest setting, site mode in sunlight conditions (max contrast), one-handed reach.
**✅** Supervisor, client and principal walkthroughs complete without gesture-only steps or unreadable text.

## 11. When to build
After the desktop beta (A2.2 §9 MVP line) and after **P10.1** (accounts/roles) and **Phase 15** (versions/branches), because sharing and read-only history depend on them. The **browser viewer for share links** (part of PM.5) is useful even before the app and may be pulled earlier if the founder wants clients to view links sooner (🛑 ask).

## 12. Deliberately undecided (for later)
- Mobile tech stack and app-store distribution (PM.0).
- Push notifications (shared with you, branch ready for review).
- Tablet-specific layouts beyond scaling (e.g. side-by-side sheet + plan).

## 13. Later candidates (not v1)
Comments and redline markups on a separate review layer (never editing the plan); approve a branch review from mobile; notifications; watching live presence while others edit (view-only follow); "Ask AI" read-only questions ("what's the kitchen area?"); regional languages; AR site overlay.

## 14. Change log
- **A4.0 (6 Nov 2026):** First version — view & share mobile app foundations: scope and non-goals, personas, information architecture, viewer behaviour with gesture alternatives, site mode, sharing (links, export, QR, browser viewer for recipients), offline, design/accessibility, read-only data rules, Phase 17 prompts (PM.0–PM.7). Tech stack deferred.
