# Interface references

Screenshots the founder chose for the look of the editor. P2.1 turns them into `/design/DESIGN.md`. We take the **principles**, never a copy of another product's screens (CLAUDE.md rule 7).

| # | File | Received | What it is |
|---|---|---|---|
| ref-01 | *(image to be saved here)* | 2026-11-06, in chat | Dark operations dashboard ("Energy Overview"): a white side panel floating over a full-screen dot-matrix site map |
| ref-02 | *(image to be saved here)* | 2026-11-06, in chat | Light landing page with a blueprint-style architectural drawing ("Build lasting relationships.") |
| ref-03 | `ref-03-design-tool-editor.png` | 2026-11-06 | A competitor's browser design tool: library panel left, inspector right, floating grouped toolbar at the bottom. Layout convention only |
| ref-04 | `ref-04-isometric-boxes.png` | 2026-11-06 | Light-grey isometric technical illustration with status dots and a round ink arrow button |
| ref-05 | `ref-05-white-model-axo.png` | 2026-11-06 | White-model axonometric with soft shadow (also a 3D render style, addendum P12.1) |
| ref-06 | `ref-06-material-axo-callouts.webp` | 2026-11-06 | Material axonometric with dashed callouts and context blocks (3D render style) |
| ref-07 | `ref-07-sign-in-halftone.png` | 2026-11-06 | Sign-in screen split with a halftone image; ink pill buttons, rounded inputs |
| ref-08 | `ref-08-blue-axo-diagram.webp` | 2026-11-06 | Blueprint-blue axonometric diagram with numbered leader callouts (3D/diagram style) |
| ref-09 | `ref-09-technical-palette.webp` | 2026-11-06 | Periwinkle technical-drawing palette: `#8080DD`, `#E4E4F2`, `#F2F2F4`, `#EAEAFA` |

The founder sent ref-01 and ref-02 ahead of P2.1 "to refer to when needed" (described here; not saved as files) and ref-03 to ref-09 for P2.1. Image files are local only (not committed: third-party work). Firm names and captions in them are never reused. The notes below are what I saw on 2026-11-06. The image files themselves still need to be dropped into this folder (Claude can't save images from chat).

## ref-01 — dark dashboard over a dot-matrix map

**Layout**
- The map is the whole screen.
- One white panel floats on the left, about a third of the width and inset from the edges. It holds the title and a column of cards.
- Square icon buttons sit at the top right: chat, notifications and an avatar.

**Canvas**
- Black background. The site is drawn as a dense dot-matrix (halftone) pattern.
- Buildings are solid black footprints with a crisp white outline.
- Labels are small dark rectangular tags with white monospace text: `№570`, `№564`.
- One footprint is highlighted with a white stipple fill and a soft glow. This reads as the selected object.

**Signature detail:** small `+` crosshair marks at the corners of every button and card, like printing or CAD registration marks.

**Panel content**
- A logo glyph (✱), then a row of four square, thin-line icon buttons.
- Title: large monospace type, regular weight, tight line spacing, two lines.
- Context tags below the title: tiny uppercase monospace on light grey rectangles (`SITE • AREA`, `LAST 24 HOURS ▾` as a dropdown).

**Cards**
- Flat light grey fill, square corners, no border, no shadow.
- Small monospace title at top left, ↗ "open" arrow at top right.
- Two small cards side by side, or one full width.

**Metrics**
- White tiles inside the grey cards.
- Labels are tiny uppercase monospace with a black dot (`● EFFICIENCY`). Values are large monospace numbers (`68%`, `99.4%`).

**Other elements**
- Bars: thin horizontal bars under each figure, black for the emphasised one and grey for the rest.
- A small node-and-link diagram: black blocks, dashed connectors, zoom control `+ 7% −`.

**Colour:** almost entirely black, white and greys. Green only for positive status text. Blue only on the avatar.

## ref-02 — light page with a blueprint drawing

**Background:** off-white with a faint dot grid.

**Headline**
- Very large, light weight, two lines.
- Two-tone: the first word in mid-grey, the rest in black.

**Body text:** light sans-serif in grey, centred under the headline.

**Illustration**
- A detailed architectural line drawing (an engraving of a classical building) in grey.
- One part of it is washed in a soft blueprint blue (periwinkle / indigo). It reads as "this part is selected or highlighted".

**Button:** solid near-black with white text, a very small corner radius and compact size.

**Page structure**
- Thin hairline rules divide the page into a grid, including diagonal construction lines like a draftsman's layout.
- Small uppercase labels in brackets, such as `( WHAT DO WE DO? )`.
- Section headings are large, light sans-serif, with a grey paragraph beside them.
- Numbered cards: `01 / Conversational`, `02 / …`, with a light grey fill, a 1 px border and almost square corners.

## Founder's answers (2026-11-06, D-23)

Both themes, light first · accent = blueprint blue · no logo yet · nothing to avoid · more screenshots coming.

## Shared direction (to confirm in P2.1)

**Palette**
- Black, white and greys, with **one accent: blueprint blue**.
- Status colours (green; red and amber for reference-check errors and warnings) used sparingly. The references don't show red or amber, so those need designing.

**Drafting language**
- Dot-grid backgrounds, hairlines and construction lines, `+` corner marks.
- Numbered labels (`№`, `01 /`) and tiny uppercase labels.

**Surfaces**
- Flat: no shadows, square or nearly square corners.
- Hierarchy comes from grey fills and type size, not from elevation.

**Type pairing**
- A **monospace** for data, labels, measurements and areas (e.g. `3.77 × 2.77 m`, `10.44 m²`).
- A clean, light **sans-serif** for headings and body text.
- Fonts must be free to use (e.g. Google Fonts); candidates are chosen in P2.1.

**How it could map onto the editor**
- **Canvas:** full screen, with the dot grid doubling as the snap grid. Walls drawn as solid fills with an outline. Room tags in monospace (name + area). Selection shown as a blue wash (ref-02) or a stipple (ref-01).
- **Floating panels:** properties, issues and metrics as grey cards with corner marks; chat in the same style.
- **Top right:** square icon buttons (chat, notifications, account).
- **Plan Graph view (P3.3):** like ref-01's node diagram.

**Questions for P2.1**
- Light, dark or both? ref-01 has a dark canvas and ref-02 is light.
- Is blueprint blue the brand accent? Is there a logo or brand font?
- Anything disliked in these references?
- Is a dot-matrix "site context" backdrop wanted around the plot?
- P2.1 asks for 3–8 references; these are 2.
