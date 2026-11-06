import type { DerivedRoom } from '../rooms/derive.ts';
import type { Plan } from '../schema/plan.ts';
import type { Point } from '../schema/primitives.ts';
import { boxAround } from '../spatial/rtree.ts';
import { planDrawing } from '../view/drawing.ts';

// A small picture of a plan for the Vault (A2 §4.2 "real plan thumbnails"): tinted rooms, ink
// walls and hairline door and window symbols on white paper, fitted to the building (not the
// plot). A plain SVG string with fixed colours and no text, so it can be stored and shown
// anywhere, and holds nothing that could run.

export interface ThumbnailOptions {
  /** Longest side in px. */
  size?: number;
  /** Space around the building, in cm. */
  padding?: number;
  background?: string;
}

const n = (v: number) => String(Math.round(v * 10) / 10);

export function planThumbnailSvg(
  plan: Plan,
  rooms: readonly DerivedRoom[],
  { size = 256, padding = 40, background = '#ffffff' }: ThumbnailOptions = {},
): string {
  const d = planDrawing(plan, rooms);
  const body = [
    ...d.walls.flat(),
    ...d.stairs.flatMap((s) => s.outline),
    ...d.columns.flatMap((c) => c.outline),
  ];
  const b = body.length ? boxAround(body, padding) : d.bounds;
  const w = Math.max(1, b.maxX - b.minX);
  const h = Math.max(1, b.maxY - b.minY);
  const k = size / Math.max(w, h);
  const [pw, ph] = [Math.round(w * k), Math.round(h * k)];
  const pt = ([x, y]: Point) => `${n(x)},${n(b.maxY + b.minY - y)}`;
  const ring = (r: readonly Point[]) => (r.length ? `M${r.map(pt).join('L')}Z` : '');
  const seg = ([a, c]: readonly [Point, Point]) => `M${pt(a)}L${pt(c)}`;
  const hair = n(1 / k);
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}" viewBox="${n(b.minX)} ${n(b.minY)} ${n(w)} ${n(h)}">`,
    `<rect x="${n(b.minX)}" y="${n(b.minY)}" width="${n(w)}" height="${n(h)}" fill="${background}"/>`,
  ];
  const roomPath = d.rooms.map((r) => [r.outer, ...r.holes].map(ring).join('')).join('');
  if (roomPath) parts.push(`<path d="${roomPath}" fill="#e4e4f2" fill-rule="evenodd"/>`);
  const stairs = d.stairs.map((s) => ring(s.outline) + s.treads.map(seg).join('')).join('');
  if (stairs)
    parts.push(`<path d="${stairs}" fill="none" stroke="#6b6b78" stroke-width="${hair}"/>`);
  const walls = d.walls.map(ring).join('') + d.columns.map((c) => ring(c.outline)).join('');
  if (walls) parts.push(`<path d="${walls}" fill="#111114" fill-rule="evenodd"/>`);
  const symbols = d.openings.flatMap((o) => o.lines.map(seg)).join('');
  if (symbols)
    parts.push(`<path d="${symbols}" fill="none" stroke="#111114" stroke-width="${hair}"/>`);
  parts.push('</svg>');
  return parts.join('');
}
