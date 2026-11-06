import type { Point } from '@plancraft/engine';
import { describe, expect, it } from 'vitest';
import { toScreen, type View } from '../ui/view.ts';
import {
  PANELS_KEY,
  clampWidth,
  initialPanels,
  isOpen,
  keepStill,
  panelShortcut,
  readPanels,
  setCompact,
  setPanel,
  setWidth,
  shortcutLabel,
  toggleFocus,
  togglePanel,
  writePanels,
  type Panels,
  type Rect,
} from './panels.ts';

const open = (p: Panels) => [isOpen(p, 'left'), isOpen(p, 'right'), isOpen(p, 'chat')];

function memoryStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
  };
}

describe('side panels', () => {
  it('starts with both side panels open and the chat closed', () => {
    expect(open(initialPanels(false))).toEqual([true, true, false]);
  });

  it('toggles each panel on its own', () => {
    let p = initialPanels(false);
    p = togglePanel(p, 'left');
    expect(open(p)).toEqual([false, true, false]);
    p = togglePanel(p, 'chat');
    expect(open(p)).toEqual([false, true, true]);
    p = togglePanel(p, 'left');
    expect(open(p)).toEqual([true, true, true]);
    expect(setPanel(p, 'left', true)).toBe(p); // no change, same state
  });

  it('focus mode hides every panel and brings the same ones back', () => {
    let p = togglePanel(initialPanels(false), 'chat'); // left, right and chat open
    p = toggleFocus(p);
    expect(open(p)).toEqual([false, false, false]);
    p = toggleFocus(p);
    expect(open(p)).toEqual([true, true, true]);
    expect(p.stash).toBeNull();
  });

  it('focus mode remembers only what was open, and opens the default pair when nothing was', () => {
    let p = togglePanel(initialPanels(false), 'right'); // only left open
    p = toggleFocus(toggleFocus(p));
    expect(open(p)).toEqual([true, false, false]);
    p = togglePanel(p, 'left'); // all closed by hand
    expect(open(toggleFocus(p))).toEqual([true, true, false]);
  });

  it('a panel opened after focus mode is hidden again by the next Ctrl/⌘ + \\', () => {
    let p = toggleFocus(initialPanels(false)); // all hidden, left + right remembered
    p = togglePanel(p, 'right'); // reopened from its edge tab
    p = toggleFocus(p);
    expect(open(p)).toEqual([false, false, false]);
    expect(open(toggleFocus(p))).toEqual([false, true, false]);
  });

  it('on a narrow window opens one overlay at a time and keeps the docked layout', () => {
    let p = setCompact(togglePanel(initialPanels(false), 'right'), true); // docked: left only
    expect(open(p)).toEqual([false, false, false]); // overlays start closed
    p = togglePanel(p, 'right');
    expect(open(p)).toEqual([false, true, false]);
    p = togglePanel(p, 'left');
    expect(open(p)).toEqual([true, false, false]);
    expect(open(toggleFocus(p))).toEqual([false, false, false]);
    p = setCompact(p, false); // wide again: the docked layout, untouched by the overlays
    expect(open(p)).toEqual([true, false, false]);
    expect(open(setCompact(togglePanel(setCompact(p, true), 'chat'), true))).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('remembers the layout, focus-mode memory and widths across visits', () => {
    const store = memoryStore();
    let p = setWidth(toggleFocus(togglePanel(initialPanels(false), 'chat')), 'left', 320);
    writePanels(store, p);
    const saved = readPanels(store);
    expect(saved).toEqual({
      docked: { left: false, right: false, chat: false },
      stash: { left: true, right: true, chat: true },
      width: { left: 320, right: null },
    });
    p = initialPanels(false, saved);
    expect(open(p)).toEqual([false, false, false]);
    expect(open(toggleFocus(p))).toEqual([true, true, true]);
    expect(p.width).toEqual({ left: 320, right: null });
    // A narrow window still starts with its overlays closed.
    expect(open(initialPanels(true, saved))).toEqual([false, false, false]);
  });

  it('ignores a remembered layout it cannot read, and storage that throws', () => {
    for (const raw of ['{', 'null', '{"v":2,"docked":{}}', '{"v":1,"docked":{"left":1}}'])
      expect(readPanels(memoryStore({ [PANELS_KEY]: raw }))).toBeNull();
    const odd = readPanels(
      memoryStore({
        [PANELS_KEY]: JSON.stringify({
          v: 1,
          docked: { left: true, right: false, chat: false },
          stash: 'x',
          width: { left: -4, right: 'wide' },
        }),
      }),
    );
    expect(odd).toEqual({
      docked: { left: true, right: false, chat: false },
      stash: null,
      width: { left: null, right: null },
    });
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readPanels(broken)).toBeNull();
    expect(() => writePanels(broken, initialPanels(false))).not.toThrow();
    expect(readPanels(null)).toBeNull();
  });

  it('clamps dragged widths to the limits', () => {
    expect(clampWidth(100, 240, 480)).toBe(240);
    expect(clampWidth(612.4, 240, 480)).toBe(480);
    expect(clampWidth(300.6, 240, 480)).toBe(301);
  });
});

describe('panel shortcuts', () => {
  const key = (e: Partial<KeyboardEvent>) => ({
    code: '',
    key: '',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...e,
  });

  it('matches ⌘ / Ctrl + \\ and ⌘ / Ctrl + Alt + [ ]', () => {
    expect(panelShortcut(key({ code: 'Backslash', key: '\\', metaKey: true }))).toBe('focus');
    expect(panelShortcut(key({ code: 'Backslash', key: '\\', ctrlKey: true }))).toBe('focus');
    // Option + [ types “ on a Mac: the physical key decides.
    expect(panelShortcut(key({ code: 'BracketLeft', key: '“', metaKey: true, altKey: true }))).toBe(
      'left',
    );
    expect(
      panelShortcut(key({ code: 'BracketRight', key: ']', ctrlKey: true, altKey: true })),
    ).toBe('right');
  });

  it('ignores the keys without the modifier, with Shift, and AltGr typing [ from another key', () => {
    expect(panelShortcut(key({ code: 'Backslash', key: '\\' }))).toBeNull();
    expect(panelShortcut(key({ code: 'BracketLeft', key: '[', metaKey: true }))).toBeNull();
    expect(
      panelShortcut(key({ code: 'Backslash', key: '|', metaKey: true, shiftKey: true })),
    ).toBeNull();
    // German layout: AltGr (= Ctrl + Alt) + 8 types [.
    expect(
      panelShortcut(key({ code: 'Digit8', key: '[', ctrlKey: true, altKey: true })),
    ).toBeNull();
  });

  it('labels shortcuts for Mac and for Windows / Linux', () => {
    expect(shortcutLabel('focus', true)).toBe('⌘\\');
    expect(shortcutLabel('left', true)).toBe('⌘⌥[');
    expect(shortcutLabel('right', false)).toBe('Ctrl+Alt+]');
  });
});

describe('keeping the drawing still', () => {
  const view: View = { cx: 450, cy: 350, scale: 0.8 };
  const before: Rect = { left: 328, top: 48, w: 812, h: 700 };
  /** Where plan point p appears in the window. */
  const inWindow = (v: View, r: Rect, p: Point) => {
    const [x, y] = toScreen(v, r, p);
    return [x + r.left, y + r.top];
  };

  it('keeps plan points where they were when a panel hides, shows or is dragged', () => {
    for (const after of [
      { left: 48, top: 48, w: 1092, h: 700 }, // left panel hidden
      { left: 328, top: 48, w: 1112, h: 700 }, // right panel hidden
      { left: 48, top: 48, w: 1392, h: 700 }, // focus mode
      { left: 360, top: 48, w: 780, h: 700 }, // left panel dragged wider
      { left: 328, top: 60, w: 812, h: 680 }, // top and height change too
    ]) {
      const moved = keepStill(view, before, after);
      expect(moved.scale).toBe(view.scale);
      for (const p of [
        [0, 0],
        [900, 700],
        [-120, 455.5],
      ] as Point[]) {
        const [x0, y0] = inWindow(view, before, p);
        const [x1, y1] = inWindow(moved, after, p);
        expect(x1).toBeCloseTo(x0!, 9);
        expect(y1).toBeCloseTo(y0!, 9);
      }
    }
    expect(keepStill(view, before, { ...before })).toBe(view);
  });
});
