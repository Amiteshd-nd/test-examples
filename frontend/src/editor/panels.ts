import type { Size, View } from '../ui/view.ts';

// The editor's side panels (P2.2a, Figma-style): the left panel (Rooms / Layers / Library), the
// right panel (Properties / Issues / Metrics) and the chat column can each be hidden so the
// canvas gets their width; Ctrl/⌘ + \ hides or shows them together (focus mode). View state
// only: it never enters the plan, undo/redo, changesets or the engine. The docked layout is a
// user preference kept in this browser (P10.1 moves preferences to the user's account).

export type PanelSide = 'left' | 'right' | 'chat';
export const PANEL_SIDES: readonly PanelSide[] = ['left', 'right', 'chat'];
export type Shown = Record<PanelSide, boolean>;
/** The two side panels whose width can be dragged. */
export type ResizableSide = 'left' | 'right';

export interface Panels {
  /** Which panels are docked open on a wide window; remembered across visits. */
  docked: Shown;
  /** What focus mode hid; the next Ctrl/⌘ + \ shows it again. */
  stash: Shown | null;
  /** On a narrow window panels float over the canvas, one at a time, and start closed. */
  compact: boolean;
  overlay: PanelSide | null;
  /** Widths the user dragged a panel to, px; null keeps the design token's width. */
  width: Record<ResizableSide, number | null>;
}

/** Shown on a first visit, and by focus mode when nothing was hidden by it. */
const DEFAULT_SHOWN: Shown = { left: true, right: true, chat: false };

export function initialPanels(compact: boolean, saved: SavedPanels | null = null): Panels {
  return {
    docked: { ...(saved?.docked ?? DEFAULT_SHOWN) },
    stash: saved?.stash ? { ...saved.stash } : null,
    compact,
    overlay: null,
    width: { left: saved?.width.left ?? null, right: saved?.width.right ?? null },
  };
}

export const isOpen = (p: Panels, side: PanelSide) =>
  p.compact ? p.overlay === side : p.docked[side];

export function setPanel(p: Panels, side: PanelSide, open: boolean): Panels {
  if (isOpen(p, side) === open) return p;
  if (p.compact) return { ...p, overlay: open ? side : null };
  return { ...p, docked: { ...p.docked, [side]: open } };
}

export const togglePanel = (p: Panels, side: PanelSide) => setPanel(p, side, !isOpen(p, side));

/**
 * Ctrl/⌘ + \: with any panel open, hide them all and remember which were open; with none open,
 * show the remembered ones (or the default pair). On a narrow window it closes the overlay.
 */
export function toggleFocus(p: Panels): Panels {
  if (p.compact) return p.overlay ? { ...p, overlay: null } : p;
  if (PANEL_SIDES.some((s) => p.docked[s]))
    return { ...p, docked: { left: false, right: false, chat: false }, stash: { ...p.docked } };
  return { ...p, docked: { ...(p.stash ?? DEFAULT_SHOWN) }, stash: null };
}

/** Crossing the narrow-window breakpoint closes any overlay; the docked layout is kept. */
export const setCompact = (p: Panels, compact: boolean): Panels =>
  p.compact === compact ? p : { ...p, compact, overlay: null };

export const setWidth = (p: Panels, side: ResizableSide, width: number | null): Panels =>
  p.width[side] === width ? p : { ...p, width: { ...p.width, [side]: width } };

export const clampWidth = (width: number, min: number, max: number) =>
  Math.round(Math.min(max, Math.max(min, width)));

// --- Remembered layout ------------------------------------------------------------------------

export const PANELS_KEY = 'plancraft-editor-panels';
export interface SavedPanels {
  docked: Shown;
  stash: Shown | null;
  width: Record<ResizableSide, number | null>;
}
type KeyStore = Pick<Storage, 'getItem' | 'setItem'>;

const isShown = (x: unknown): x is Shown =>
  typeof x === 'object' &&
  x !== null &&
  PANEL_SIDES.every((s) => typeof (x as Record<string, unknown>)[s] === 'boolean');
const widthOf = (x: unknown) =>
  typeof x === 'number' && Number.isFinite(x) && x > 0 && x < 4000 ? Math.round(x) : null;

/** This browser's storage, or null when it is blocked. */
export function browserStore(): KeyStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The remembered layout, or null when there is none or it can't be read. */
export function readPanels(store: KeyStore | null): SavedPanels | null {
  try {
    const raw = store?.getItem(PANELS_KEY);
    if (!raw) return null;
    const x = JSON.parse(raw) as Record<string, unknown>;
    if (x.v !== 1 || !isShown(x.docked)) return null;
    const w = (x.width ?? {}) as Record<string, unknown>;
    return {
      docked: x.docked,
      stash: isShown(x.stash) ? x.stash : null,
      width: { left: widthOf(w.left), right: widthOf(w.right) },
    };
  } catch {
    return null;
  }
}

export function writePanels(store: KeyStore | null, p: Panels) {
  try {
    store?.setItem(
      PANELS_KEY,
      JSON.stringify({ v: 1, docked: p.docked, stash: p.stash, width: p.width }),
    );
  } catch {
    // Storage can be blocked; the layout still applies for this visit.
  }
}

// --- Shortcuts --------------------------------------------------------------------------------

export type PanelCommand = 'focus' | 'left' | 'right';
type Keys = Pick<KeyboardEvent, 'code' | 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>;

/**
 * Ctrl/⌘ + \ (focus mode), Ctrl/⌘ + Alt/Option + [ and ] (left, right). Matched on the physical
 * key (`code`): Option + [ types “ on a Mac, and on many non-US layouts Ctrl + Alt is AltGr,
 * which types [ and ] from other keys.
 */
export function panelShortcut(e: Keys): PanelCommand | null {
  if (!(e.metaKey || e.ctrlKey) || e.shiftKey) return null;
  if (!e.altKey && (e.code === 'Backslash' || (!e.code && e.key === '\\'))) return 'focus';
  if (e.altKey && e.code === 'BracketLeft') return 'left';
  if (e.altKey && e.code === 'BracketRight') return 'right';
  return null;
}

export const SHORTCUT_KEYS: Record<PanelCommand, string> = {
  focus: '\\',
  left: '[',
  right: ']',
};
/** "⌘⌥[" on a Mac, "Ctrl+Alt+[" elsewhere. */
export function shortcutLabel(command: PanelCommand, mac: boolean) {
  const alt = command !== 'focus';
  return mac
    ? `⌘${alt ? '⌥' : ''}${SHORTCUT_KEYS[command]}`
    : `Ctrl+${alt ? 'Alt+' : ''}${SHORTCUT_KEYS[command]}`;
}

/** A text field takes key presses for typing (checkboxes and buttons don't). */
export function isTextField(t: EventTarget | null) {
  if (typeof HTMLElement === 'undefined' || !(t instanceof HTMLElement)) return false;
  if (t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return true;
  return (
    t.tagName === 'INPUT' &&
    !/^(checkbox|radio|button|submit|reset|range|color|file)$/.test((t as HTMLInputElement).type)
  );
}

// --- Keeping the drawing still ----------------------------------------------------------------

/** Where the drawing area sits in the window, px. */
export interface Rect extends Size {
  left: number;
  top: number;
}

/**
 * The view that keeps every plan point at the same place in the window when the drawing area
 * moves or resizes from `before` to `after` (a panel opening, closing or being dragged). The view
 * is a centre point plus scale, so the centre shifts by the edge movement in plan units.
 */
export function keepStill(v: View, before: Rect, after: Rect): View {
  const dx = after.left - before.left + (after.w - before.w) / 2;
  const dy = after.top - before.top + (after.h - before.h) / 2;
  if (!dx && !dy) return v;
  return { cx: v.cx + dx / v.scale, cy: v.cy - dy / v.scale, scale: v.scale };
}
