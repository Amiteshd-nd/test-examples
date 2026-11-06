import type { DerivedRoom } from '../rooms/derive.ts';
import type { Level } from '../schema/plan.ts';
import type { Point } from '../schema/primitives.ts';
import type { Box } from '../spatial/rtree.ts';
import { columnCorners, wallBand } from './drawing.ts';

// The area some objects cover on a level (P3.2: zoom to an issue). Rooms use their derived floor,
// doors and windows their stretch of wall; ids not on the level are left out.

/** The box around the objects with these ids on the level; null when none of them is there. */
export function objectBounds(
  level: Level,
  rooms: readonly DerivedRoom[],
  ids: readonly string[],
): Box | null {
  const pts: Point[] = [];
  for (const id of ids) {
    const wall = level.walls[id];
    const opening = level.openings[id];
    const host = opening && level.walls[opening.wall];
    if (wall) pts.push(...wallBand(wall));
    else if (opening && host)
      pts.push(...wallBand(host, opening.offset, opening.offset + opening.width));
    else if (level.rooms[id]) {
      const shape = rooms.find((r) => r.room_id === id);
      pts.push(...(shape?.outer.length ? shape.outer : [level.rooms[id].seed]));
    } else if (level.stairs[id]) pts.push(...level.stairs[id].polygon);
    else if (level.columns[id]) pts.push(...columnCorners(level.columns[id]));
    else if (level.separators[id]) pts.push(level.separators[id].start, level.separators[id].end);
    else if (level.fixtures[id]) pts.push(level.fixtures[id].at);
  }
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}
