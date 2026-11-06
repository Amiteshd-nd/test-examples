import {
  buildArrangement,
  pointInRing,
  pruneDangling,
  traceFaces,
  vecFromCm,
  type Face,
  type Vec,
} from '../geometry/planar.ts';
import {
  floatRingArea,
  insetRing,
  isSimpleFloatRing,
  pointInFloatRing,
  type FloatVec,
} from '../geometry/inset.ts';
import { values } from '../schema/collections.ts';
import type { Level, Room, Separator, Wall } from '../schema/plan.ts';
import { roundCm, roundM2, type Point } from '../schema/primitives.ts';
import type { Issue } from '../schema/rule.ts';
import { validatorIssue } from '../validate/issues.ts';

// Room derivation (PRD §4.1, P1.1 task 5): a room is the smallest region enclosed by wall
// centrelines around its seed, shrunk by half of each bounding wall's thickness. Free-standing
// wall loops inside it (a duct, a column box) become holes.
//
// Known limits (v1): wall stubs with a free end are ignored (they do not reduce the area);
// rooms not fully closed by walls (open plan, gaps) are not split; arcs are not supported.

/** A wall end this close to another wall joins it: gaps up to 2 cm close (A2 M4, D-30). */
export const JOIN_TOLERANCE_MM = 20;

/** What an arrangement edge came from: a wall or a separator. */
type Boundary = { wall: Wall; separator?: undefined } | { separator: Separator; wall?: undefined };

export interface DerivedRoom {
  room_id: string;
  level_id: string;
  /** Clear floor outline in cm, counter-clockwise. */
  outer: Point[];
  /** Outlines of free-standing wall blocks inside the room, in cm, clockwise. */
  holes: Point[][];
  area_m2: number;
  /** Walls that bound the room, sorted. */
  wall_ids: string[];
  /** Separators (unbuilt boundaries) that bound the room, sorted. */
  separator_ids: string[];
  /** Other rooms whose seed lies in the same enclosed region. */
  shared_with: string[];
}

export interface DeriveResult {
  rooms: DerivedRoom[];
  issues: Issue[];
}

/**
 * Ring in cm, starting at its lowest-left corner (direction kept), so the same room always
 * comes out the same whatever order the walls were listed in.
 */
const toCm = (ring: FloatVec[]): Point[] => {
  const pts = ring.map(([x, y]): Point => [roundCm(x / 10), roundCm(y / 10)]);
  let k = 0;
  pts.forEach((p, i) => {
    if (p[0] < pts[k]![0] || (p[0] === pts[k]![0] && p[1] < pts[k]![1])) k = i;
  });
  return [...pts.slice(k), ...pts.slice(0, k)];
};
const byFirstCorner = (a: Point[], b: Point[]) => a[0]![0] - b[0]![0] || a[0]![1] - b[0]![1];

function roomLabel(room: Room): string {
  return room.name ? `${room.name} (${room.id})` : room.id;
}

export function deriveRooms(level: Level): DeriveResult {
  const issues: Issue[] = [];
  const arrangement = pruneDangling(
    buildArrangement<Boundary>(
      [
        ...values(level.walls).map((w) => ({
          a: vecFromCm(w.start),
          b: vecFromCm(w.end),
          data: { wall: w },
        })),
        ...values(level.separators).map((s) => ({
          a: vecFromCm(s.start),
          b: vecFromCm(s.end),
          data: { separator: s },
        })),
      ],
      JOIN_TOLERANCE_MM,
    ),
  );
  const faces = traceFaces(arrangement);
  const bounded = faces.filter((f) => f.area2 > 0);
  const outlines = faces.filter((f) => f.area2 < 0);

  const smallestContaining = (p: Vec, exceptComponent?: number): Face | undefined => {
    let best: Face | undefined;
    for (const f of bounded) {
      if (f.component === exceptComponent) continue;
      if (pointInRing(p, f.vertices) !== 'inside') continue;
      if (!best || f.area2 < best.area2) best = f;
    }
    return best;
  };

  // Each component's outer outline is a hole in the smallest other face that contains it.
  const holesOf = new Map<Face, Face[]>();
  for (const outline of outlines) {
    const host = smallestContaining(outline.vertices[0]!, outline.component);
    if (host) holesOf.set(host, [...(holesOf.get(host) ?? []), outline]);
  }

  // A separator has no thickness; where a wall and a separator overlap, the wall wins.
  const halfThicknessMm = (face: Face) =>
    face.edges.map(({ edge }) => {
      const ts = arrangement.edges[edge]!.data.map((d) => d.wall?.thickness ?? 0);
      return (Math.max(...ts) * 10) / 2;
    });
  const idsOf = (face: Face, kind: 'wall' | 'separator') =>
    face.edges.flatMap(({ edge }) =>
      arrangement.edges[edge]!.data.flatMap((d) => (d[kind] ? [d[kind].id] : [])),
    );
  const boundaryIds = (face: Face, kind: 'wall' | 'separator') =>
    [
      ...new Set([
        ...idsOf(face, kind),
        ...(holesOf.get(face) ?? []).flatMap((h) => idsOf(h, kind)),
      ]),
    ].sort();

  const faceOfRoom = new Map<Room, Face>();
  for (const room of values(level.rooms)) {
    const seed = vecFromCm(room.seed);
    const face = smallestContaining(seed);
    if (face) {
      faceOfRoom.set(room, face);
    } else if (bounded.some((f) => pointInRing(seed, f.vertices) === 'boundary')) {
      issues.push(
        validatorIssue(
          'geometry.room_seed_in_wall',
          `The label point of ${roomLabel(room)} sits on a wall.`,
          [room.id],
          `Move ${roomLabel(room)}'s label point into the open floor of the room.`,
        ),
      );
    } else {
      issues.push(
        validatorIssue(
          'geometry.room_seed_not_enclosed',
          `${roomLabel(room)} is not enclosed by walls, so its area can't be measured.`,
          [room.id],
          `Close the gap in the walls around ${roomLabel(room)}, or move its label point inside a closed room.`,
        ),
      );
    }
  }

  const roomsByFace = new Map<Face, Room[]>();
  for (const [room, face] of faceOfRoom) {
    roomsByFace.set(face, [...(roomsByFace.get(face) ?? []), room]);
  }
  for (const sharing of roomsByFace.values()) {
    if (sharing.length < 2) continue;
    const names = sharing.map(roomLabel).join(', ');
    issues.push(
      validatorIssue(
        'geometry.rooms_share_area',
        `${names} are inside one enclosed area, so each is measured as the whole area.`,
        sharing.map((r) => r.id),
        'Add a wall between them, or keep one room and remove the other.',
      ),
    );
  }

  const rooms: DerivedRoom[] = [];
  for (const [room, face] of faceOfRoom) {
    const outer = insetRing(face.vertices, halfThicknessMm(face));
    const holes = (holesOf.get(face) ?? []).map((h) => insetRing(h.vertices, halfThicknessMm(h)));

    if (
      !outer ||
      holes.some((h) => !h) ||
      floatRingArea(outer) <= 0 ||
      !isSimpleFloatRing(outer) ||
      floatRingArea(outer) + holes.reduce((sum, h) => sum + floatRingArea(h!), 0) <= 0
    ) {
      issues.push(
        validatorIssue(
          'geometry.room_too_small_for_walls',
          `${roomLabel(room)} (or part of it) is narrower than its walls are thick, so its floor can't be measured.`,
          [room.id],
          `Move the walls of ${roomLabel(room)} apart or make them thinner.`,
        ),
      );
      continue;
    }
    const holeRings = holes as FloatVec[][];
    const area = floatRingArea(outer) + holeRings.reduce((sum, h) => sum + floatRingArea(h), 0);

    const seedMm: FloatVec = [room.seed[0] * 10, room.seed[1] * 10];
    if (!pointInFloatRing(seedMm, outer) || holeRings.some((h) => pointInFloatRing(seedMm, h))) {
      issues.push(
        validatorIssue(
          'geometry.room_seed_in_wall',
          `The label point of ${roomLabel(room)} sits inside a wall.`,
          [room.id],
          `Move ${roomLabel(room)}'s label point into the open floor of the room.`,
        ),
      );
    }

    const sharing = roomsByFace.get(face)!;
    rooms.push({
      room_id: room.id,
      level_id: level.id,
      outer: toCm(outer),
      holes: holeRings.map(toCm).sort(byFirstCorner),
      area_m2: roundM2(area / 1_000_000),
      wall_ids: boundaryIds(face, 'wall'),
      separator_ids: boundaryIds(face, 'separator'),
      shared_with: sharing.filter((r) => r !== room).map((r) => r.id),
    });
  }

  return { rooms, issues };
}
