import { isSimpleRing, orient, vecFromCm, type Vec } from '../geometry/planar.ts';
import { deriveRooms, type DerivedRoom } from '../rooms/derive.ts';
import { migrate } from '../schema/migrate.ts';
import { levelsInOrder, values } from '../schema/collections.ts';
import { Plan, type Opening } from '../schema/plan.ts';
import type { Point } from '../schema/primitives.ts';
import type { Issue } from '../schema/rule.ts';
import { formatM, validatorIssue } from './issues.ts';

// Loads and checks a plan document: format version, schema, then geometry sanity (P1.1 task 4).

export type LoadResult =
  { ok: true; plan: Plan; migrated_from?: string } | { ok: false; issues: Issue[] };

/** Upgrades an older plan to the current format and checks it against the schema. */
export function loadPlan(input: unknown): LoadResult {
  const migrated = migrate(input);
  if (!migrated.ok) {
    return {
      ok: false,
      issues: [
        validatorIssue(
          'schema.unreadable',
          migrated.error,
          [],
          'Open the file in the app that made it and export it again, or update this app.',
        ),
      ],
    };
  }
  const parsed = Plan.safeParse(migrated.doc);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((e) => {
        const where = e.path.length ? e.path.join('.') : 'plan';
        return validatorIssue(
          'schema.invalid',
          `The value at ${where} is not allowed: ${e.message}.`,
          [],
          `Correct the value at ${where}, or re-import the plan.`,
        );
      }),
    };
  }
  return migrated.applied.length
    ? { ok: true, plan: parsed.data, migrated_from: migrated.from }
    : { ok: true, plan: parsed.data };
}

export interface ValidationResult {
  /** True when there are no errors (warnings are allowed). */
  ok: boolean;
  plan?: Plan;
  migrated_from?: string;
  issues: Issue[];
  rooms: DerivedRoom[];
}

function checkPolygon(polygon: Point[], id: string, what: string): Issue[] {
  const ring: Vec[] = [];
  for (const p of polygon.map(vecFromCm)) {
    const last = ring[ring.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) ring.push(p);
  }
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (ring.length > 1 && first[0] === last[0] && first[1] === last[1]) ring.pop();

  if (ring.length < 3) {
    return [
      validatorIssue(
        'geometry.polygon_too_few_points',
        `The ${what} outline has fewer than 3 distinct corners.`,
        [id],
        `Redraw the ${what} outline with at least 3 corners.`,
      ),
    ];
  }
  if (ring.every((p) => orient(ring[0]!, ring[1]!, p) === 0)) {
    return [
      validatorIssue(
        'geometry.polygon_zero_area',
        `The ${what} outline has no area (all corners lie on one line).`,
        [id],
        `Redraw the ${what} outline as a closed shape.`,
      ),
    ];
  }
  if (!isSimpleRing(ring)) {
    return [
      validatorIssue(
        'geometry.polygon_self_intersecting',
        `The ${what} outline crosses or touches itself.`,
        [id],
        `Redraw the ${what} outline so its edges don't cross.`,
      ),
    ];
  }
  return [];
}

function openingLabel(o: { kind: string; id: string }): string {
  return `${o.kind[0]!.toUpperCase()}${o.kind.slice(1)} ${o.id}`;
}

/** Ids are unique across the whole plan, and every map key equals its object's id (A2, M1). */
function checkIds(plan: Plan): Issue[] {
  const issues: Issue[] = [];
  const seen = new Map<string, number>();
  const visit = (map: Record<string, { id: string }>, what: string) => {
    for (const [key, item] of Object.entries(map)) {
      seen.set(item.id, (seen.get(item.id) ?? 0) + 1);
      if (key !== item.id) {
        issues.push(
          validatorIssue(
            'schema.id_key_mismatch',
            `The ${what} stored under "${key}" says its id is "${item.id}".`,
            [item.id],
            `Store it under "${item.id}", or change its id to "${key}".`,
          ),
        );
      }
    }
  };
  visit(plan.levels, 'level');
  for (const level of levelsInOrder(plan)) {
    visit(level.walls, 'wall');
    visit(level.separators, 'separator');
    visit(level.rooms, 'room');
    visit(level.openings, 'opening');
    visit(level.stairs, 'stair');
    visit(level.columns, 'column');
    visit(level.fixtures, 'fixture');
  }
  for (const [id, n] of seen) {
    if (n > 1) {
      issues.push(
        validatorIssue(
          'geometry.duplicate_id',
          `The id "${id}" is used by ${n} objects; every object needs its own id.`,
          [id],
          `Give each object that uses "${id}" a new, unique id.`,
        ),
      );
    }
  }
  return issues;
}

/** Loads, migrates and checks a plan. Derived room outlines are returned for valid geometry. */
export function validatePlan(input: unknown): ValidationResult {
  const loaded = loadPlan(input);
  if (!loaded.ok) return { ok: false, issues: loaded.issues, rooms: [] };
  const { plan } = loaded;

  const issues: Issue[] = [...checkIds(plan), ...checkPolygon(plan.plot.polygon, 'plot', 'plot')];
  const rooms: DerivedRoom[] = [];

  for (const level of levelsInOrder(plan)) {
    const lengths = new Map<string, number>();
    for (const wall of values(level.walls)) {
      const [ax, ay] = vecFromCm(wall.start);
      const [bx, by] = vecFromCm(wall.end);
      if (ax === bx && ay === by) {
        issues.push(
          validatorIssue(
            'geometry.wall_zero_length',
            `Wall ${wall.id} starts and ends at the same point.`,
            [wall.id],
            `Delete wall ${wall.id} or move one of its ends.`,
          ),
        );
      }
      lengths.set(wall.id, Math.hypot(bx - ax, by - ay) / 10);
    }
    for (const sep of values(level.separators)) {
      const [ax, ay] = vecFromCm(sep.start);
      const [bx, by] = vecFromCm(sep.end);
      if (ax === bx && ay === by) {
        issues.push(
          validatorIssue(
            'geometry.separator_zero_length',
            `Separator ${sep.id} starts and ends at the same point.`,
            [sep.id],
            `Delete separator ${sep.id} or move one of its ends.`,
          ),
        );
      }
    }

    for (const stair of values(level.stairs))
      issues.push(...checkPolygon(stair.polygon, stair.id, `stair ${stair.id}`));
    for (const room of values(level.rooms)) {
      if (room.polygon)
        issues.push(...checkPolygon(room.polygon, room.id, `cached room ${room.id}`));
    }

    const byWall = new Map<string, Opening[]>();
    for (const opening of values(level.openings)) {
      const length = lengths.get(opening.wall);
      if (length === undefined) {
        issues.push(
          validatorIssue(
            'geometry.host_wall_missing',
            `${openingLabel(opening)} is placed on wall ${opening.wall}, which is not on this level.`,
            [opening.id],
            `Place ${opening.id} on an existing wall or delete it.`,
          ),
        );
        continue;
      }
      if (opening.offset + opening.width > length + 1e-6) {
        issues.push(
          validatorIssue(
            'geometry.opening_outside_wall',
            `${openingLabel(opening)} runs past the end of wall ${opening.wall}: it needs ${formatM(opening.offset + opening.width)} of wall but the wall is ${formatM(length)} long.`,
            [opening.id, opening.wall],
            `Move ${opening.id} along the wall, make it narrower, or lengthen wall ${opening.wall}.`,
          ),
        );
      }
      byWall.set(opening.wall, [...(byWall.get(opening.wall) ?? []), opening]);
    }
    for (const openings of byWall.values()) {
      const sorted = [...openings].sort((a, b) => a.offset - b.offset);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]!;
        const cur = sorted[i]!;
        if (cur.offset < prev.offset + prev.width - 1e-6) {
          issues.push(
            validatorIssue(
              'geometry.openings_overlap',
              `${openingLabel(prev)} and ${cur.kind} ${cur.id} overlap on wall ${cur.wall}.`,
              [prev.id, cur.id],
              `Move ${cur.id} along wall ${cur.wall} so the openings don't overlap.`,
            ),
          );
        }
      }
    }

    const derived = deriveRooms(level);
    issues.push(...derived.issues);
    rooms.push(...derived.rooms);

    for (const room of values(level.rooms)) {
      if (!room.loft) continue;
      const wall = room.loft.wall;
      if (!lengths.has(wall)) {
        issues.push(
          validatorIssue(
            'geometry.host_wall_missing',
            `The loft in ${room.name || room.id} is placed on wall ${wall}, which is not on this level.`,
            [room.id],
            `Place the loft on one of the room's walls or remove it.`,
          ),
        );
        continue;
      }
      const shape = derived.rooms.find((r) => r.room_id === room.id);
      if (shape && !shape.wall_ids.includes(wall)) {
        issues.push(
          validatorIssue(
            'geometry.loft_wall_not_in_room',
            `The loft in ${room.name || room.id} is on wall ${wall}, which is not a wall of that room.`,
            [room.id, wall],
            `Place the loft on one of the walls around ${room.name || room.id}: ${shape.wall_ids.join(', ')}.`,
          ),
        );
      }
    }
  }

  const result: ValidationResult = {
    ok: !issues.some((i) => i.severity === 'error'),
    plan,
    issues,
    rooms,
  };
  if (loaded.migrated_from) result.migrated_from = loaded.migrated_from;
  return result;
}
