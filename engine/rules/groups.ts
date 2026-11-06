import { deriveRooms, type DerivedRoom } from '../rooms/derive.ts';
import { levelsInOrder, values } from '../schema/collections.ts';
import type { Plan } from '../schema/plan.ts';
import type { Point } from '../schema/primitives.ts';
import { roomTypeLabel } from '../schema/room-types.ts';
import type { Issue, Severity } from '../schema/rule.ts';
import { insideRing } from './zones.ts';

// Issues grouped by the room they are about (P3.2), for the live check panel and for AI
// summaries ("Bedroom 2: 2 problems"). An issue about a door, wall or stair goes with the room
// it borders or stands in; issues about the plot, a level or the file go under the whole plan.

export interface IssueGroup {
  /** The room the issues are about; null for the whole plan (plot, levels, setbacks, the file). */
  room_id: string | null;
  /** The room's name ("Bedroom 2"), with its id when two rooms share a name; "Whole plan". */
  name: string;
  /** The most serious severity in the group. */
  severity: Severity;
  /** Most serious first, otherwise in the order they were found. */
  issues: Issue[];
}

const RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

const middle = (pts: readonly Point[]): Point => [
  pts.reduce((s, p) => s + p[0], 0) / pts.length,
  pts.reduce((s, p) => s + p[1], 0) / pts.length,
];

/** Finds the room of objects on any level (see `roomOfObject`), with the room shapes indexed once. */
function roomFinder(plan: Plan, rooms: readonly DerivedRoom[]) {
  const shapeOf = new Map(rooms.map((r) => [r.room_id, r]));
  const levels = levelsInOrder(plan).map((level) => ({
    level,
    shapes: values(level.rooms).flatMap((r) => shapeOf.get(r.id) ?? []),
  }));
  return (id: string): string | null => {
    for (const { level, shapes } of levels) {
      if (level.rooms[id]) return id;
      const wall = level.walls[id] ? id : level.openings[id]?.wall;
      if (wall) return shapes.find((s) => s.wall_ids.includes(wall))?.room_id ?? null;
      const at = level.stairs[id]
        ? middle(level.stairs[id].polygon)
        : (level.columns[id]?.at ?? level.fixtures[id]?.at);
      if (at) return shapes.find((s) => insideRing(at, s.outer))?.room_id ?? null;
    }
    return null;
  };
}
const allRooms = (plan: Plan) => levelsInOrder(plan).flatMap((l) => deriveRooms(l).rooms);

/**
 * The room an object belongs to: a room itself; the first room (in plan order) a wall, door or
 * window borders; the room a stair, column or fixture stands in. Null for anything else.
 */
export function roomOfObject(
  plan: Plan,
  id: string,
  rooms: readonly DerivedRoom[] = allRooms(plan),
): string | null {
  return roomFinder(plan, rooms)(id);
}

/**
 * Groups issues by room: the whole plan first, then rooms in plan order (stable while editing,
 * so groups don't jump about). Each issue goes with the first of its objects that has a room.
 */
export function groupIssues(
  plan: Plan,
  issues: readonly Issue[],
  rooms: readonly DerivedRoom[] = allRooms(plan),
): IssueGroup[] {
  const roomOf = roomFinder(plan, rooms);
  const byRoom = new Map<string | null, Issue[]>();
  for (const issue of issues) {
    let room: string | null = null;
    for (const id of issue.object_ids) if ((room = roomOf(id))) break;
    byRoom.set(room, [...(byRoom.get(room) ?? []), issue]);
  }
  const order = levelsInOrder(plan).flatMap((l) => values(l.rooms));
  const named = order.map((r) => ({ id: r.id, name: r.name || roomTypeLabel(r.type) }));
  const count = new Map<string, number>();
  for (const { name } of named) count.set(name, (count.get(name) ?? 0) + 1);
  const keys = [null, ...named.map((r) => r.id)].filter((k) => byRoom.has(k));
  return keys.map((key) => {
    const list = [...byRoom.get(key)!].sort((a, b) => RANK[a.severity] - RANK[b.severity]);
    const room = named.find((r) => r.id === key);
    return {
      room_id: key,
      name: !room
        ? 'Whole plan'
        : count.get(room.name)! > 1
          ? `${room.name} (${room.id})`
          : room.name,
      severity: list[0]!.severity,
      issues: list,
    };
  });
}
