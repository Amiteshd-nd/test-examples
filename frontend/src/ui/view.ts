import type { Box, Point } from '@plancraft/engine';

// The canvas view (P2.3): which part of the plan is on screen. `cx, cy` is the plan point (cm)
// at the centre of the drawing area and `scale` is screen pixels per cm. Plan y points north and
// screen y points down; SVG draws every plan point at (x, −y).

export interface View {
  cx: number;
  cy: number;
  scale: number;
}
export interface Size {
  w: number;
  h: number;
}
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** 2% to 2000% (100% = 1 px per cm). */
export const MIN_SCALE = 0.02;
export const MAX_SCALE = 20;
const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

/** The view that shows `bounds` (plus `marginCm`) inside the area left free by `insets`. */
export function fitView(bounds: Box, size: Size, insets = NO_INSETS, marginCm = 40): View {
  const w = Math.max(1, size.w - insets.left - insets.right);
  const h = Math.max(1, size.h - insets.top - insets.bottom);
  const bw = bounds.maxX - bounds.minX + 2 * marginCm;
  const bh = bounds.maxY - bounds.minY + 2 * marginCm;
  const scale = clampScale(Math.min(w / bw, h / bh));
  return {
    cx: (bounds.minX + bounds.maxX) / 2 - (insets.left - insets.right) / 2 / scale,
    cy: (bounds.minY + bounds.maxY) / 2 + (insets.top - insets.bottom) / 2 / scale,
    scale,
  };
}

/** The SVG viewBox for a view on a drawing area of `size`. */
export function viewBox(v: View, size: Size): string {
  const w = size.w / v.scale;
  const h = size.h / v.scale;
  return `${v.cx - w / 2} ${-(v.cy + h / 2)} ${w} ${h}`;
}

/** The plan point under screen point (sx, sy), measured from the drawing area's top left. */
export function toPlan(v: View, size: Size, [sx, sy]: Point): Point {
  return [v.cx + (sx - size.w / 2) / v.scale, v.cy - (sy - size.h / 2) / v.scale];
}

/** The screen point of plan point p. */
export function toScreen(v: View, size: Size, [x, y]: Point): Point {
  return [(x - v.cx) * v.scale + size.w / 2, (v.cy - y) * v.scale + size.h / 2];
}

/** Moves the view with the cursor: dragging right by dx px shows what is further left. */
export function panBy(v: View, dx: number, dy: number): View {
  return { cx: v.cx - dx / v.scale, cy: v.cy + dy / v.scale, scale: v.scale };
}

/** Zooms by `factor`, keeping the plan point under screen point `at` where it is. */
export function zoomAt(v: View, size: Size, at: Point, factor: number): View {
  const scale = clampScale(v.scale * factor);
  const p = toPlan(v, size, at);
  return {
    cx: p[0] - (at[0] - size.w / 2) / scale,
    cy: p[1] + (at[1] - size.h / 2) / scale,
    scale,
  };
}
