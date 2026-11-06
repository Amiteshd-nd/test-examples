import type { Point } from '@plancraft/engine';

// Room labels on the drawing (DS-03, kept by the founder 2026-11-06): a label that doesn't fit
// its room at the current zoom and text size is left out instead of overlapping its neighbours,
// as CAD tools do. The area alone first; nothing if even that doesn't fit. Names are always in
// the Rooms list. Text widths are estimated per glyph (Geist ≈ 0.58 em, Geist Mono ≈ 0.62 em).

/** Screen px of the two label lines, before the UI scale. */
export const LABEL = { name: 13, area: 12 } as const;

export interface RoomLabel {
  name: string | null;
  area: string | null;
}

/**
 * Which lines of a room label to draw. `pxToCm` turns screen px (already times the UI scale) into
 * drawing units; `outer` is the room's clear outline in cm (empty when it isn't enclosed).
 */
export function fitRoomLabel(
  name: string,
  area: string,
  outer: readonly Point[],
  pxToCm: (px: number) => number,
): RoomLabel {
  if (!outer.length) return { name, area };
  const xs = outer.map((q) => q[0]);
  const ys = outer.map((q) => q[1]);
  const width = (Math.max(...xs) - Math.min(...xs)) * 0.92; // a little air at the walls
  const height = Math.max(...ys) - Math.min(...ys);
  const areaFits = area.length * pxToCm(LABEL.area) * 0.62 <= width && pxToCm(16) <= height;
  const nameFits =
    areaFits && name.length * pxToCm(LABEL.name) * 0.58 <= width && pxToCm(34) <= height;
  return { name: nameFits ? name : null, area: areaFits ? area : null };
}
