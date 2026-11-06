import { useSyncExternalStore } from 'react';

// UI scale (Settings → Text size, DS-03, skill §3.3): one choice, 100–150 %, stored per browser.
// It sets `--pc-ui-scale` on <html>; ui.css makes the root font size 100 % × that, so every rem
// token (text, spacing, controls, icons) grows together. Drawing line weights do not scale;
// canvas labels do (PlanView reads `useUiScale`).

export const UI_SCALES = [1, 1.125, 1.25, 1.5] as const;
export type UiScale = (typeof UI_SCALES)[number];

const KEY = 'plancraft-ui-scale';
const EVENT = 'plancraft-ui-scale';

/** A stored value → a supported scale (anything else → 100 %). */
export function parseUiScale(raw: string | null | undefined): UiScale {
  const n = Number(raw);
  return UI_SCALES.find((s) => s === n) ?? 1;
}

export const formatUiScale = (s: number) => `${Math.round(s * 1000) / 10} %`;

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // private mode or blocked storage: the setting just isn't remembered
  }
}

export function readUiScale(): UiScale {
  return parseUiScale(storage()?.getItem(KEY));
}

export function applyUiScale(scale: number, root: HTMLElement = document.documentElement) {
  if (scale === 1) root.style.removeProperty('--pc-ui-scale');
  else root.style.setProperty('--pc-ui-scale', String(scale));
}

export function setUiScale(scale: UiScale) {
  try {
    storage()?.setItem(KEY, String(scale));
  } catch {
    // not remembered; still applied below
  }
  applyUiScale(scale);
  window.dispatchEvent(new Event(EVENT));
}

/** Call once before the first render of every page; follows changes made in other tabs. */
export function startUiScale() {
  applyUiScale(readUiScale());
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    applyUiScale(readUiScale());
    window.dispatchEvent(new Event(EVENT));
  });
}

const subscribe = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
};

export const useUiScale = (): UiScale => useSyncExternalStore(subscribe, readUiScale, () => 1);

/**
 * A length custom property in px (tokens in rem follow the UI scale), e.g.
 * `cssPx('--pc-size-panel-left')`. Measured, so rem, calc() and var() all resolve.
 */
export function cssPx(name: string, el: HTMLElement = document.documentElement): number {
  const probe = document.createElement('div');
  probe.style.cssText = `position:absolute;visibility:hidden;width:var(${name})`;
  el.appendChild(probe);
  const px = probe.getBoundingClientRect().width;
  probe.remove();
  return px;
}
