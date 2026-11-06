import { footprint, autoTag } from '../library/tags.ts';
import { deriveRooms, type DerivedRoom } from '../rooms/derive.ts';
import { levelsInOrder, values } from '../schema/collections.ts';
import type { Level, Opening, Plan, Room, Wall } from '../schema/plan.ts';
import type { Point, ProvenanceKind } from '../schema/primitives.ts';
import { roomTypeLabel } from '../schema/room-types.ts';
import type { Issue, IssueFix, PlotZone, Rule, RulePack, RuleTable } from '../schema/rule.ts';
import { setbackSides } from '../schema/sides.ts';
import { packsFor } from './packs.ts';
import { centroid, compassOf, plotBox, plotZone, type PlotBox } from './zones.ts';

// Reference checks (P3.1): runs rule packs on a plan and reports what doesn't meet them, in the
// PRD §4.5 issue format, with one sentence on how to fix it. Wording says "reference check",
// never "code-compliant" (CLAUDE.md rule 13). Rules with no value yet (empty city tables) check
// nothing. Unconfirmed rules are reported with `verified: false`, and the UI says so. P3.2 adds
// quick fixes (commands, where the answer is certain) and a Vastu score.

type Pt = readonly [number, number];
const sub = (a: Pt, b: Pt): [number, number] => [a[0] - b[0], a[1] - b[1]];
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
const cross = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0];
const unit = (v: Pt): [number, number] => {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
};

/** Metres for messages (2.45 m); small differences in cm (20 cm). */
const m = (cm: number) => `${(cm / 100).toFixed(2)} m`;
const by = (cm: number) => (cm < 100 ? `${Math.ceil(cm)} cm` : m(Math.ceil(cm)));
const m2 = (v: number) => `${v.toFixed(2)} m²`;
/** To the 0.1 cm grid, without −0. */
const r1 = (v: number) => Math.round(v * 10) / 10 || 0;

const WORD: Record<PlotZone, string> = {
  north: 'north',
  north_east: 'north-east',
  east: 'east',
  south_east: 'south-east',
  south: 'south',
  south_west: 'south-west',
  west: 'west',
  north_west: 'north-west',
  centre: 'centre',
};
const list = (zones: readonly PlotZone[]) =>
  zones.length === 1
    ? WORD[zones[0]!]
    : `${zones
        .slice(0, -1)
        .map((z) => WORD[z])
        .join(', ')} or ${WORD[zones.at(-1)!]}`;

/**
 * A room's width: the short side of the smallest rectangle around its floor (rotating
 * calipers on the convex hull), with the direction across it. For an L-shaped room this is the
 * width of the whole L, a generous reading.
 */
export function roomWidth(ring: readonly Pt[]): { width: number; length: number; across: Point } {
  const pts = [...ring].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = (list: Pt[]) => {
    const h: Pt[] = [];
    for (const p of list) {
      while (h.length >= 2 && cross(sub(h.at(-1)!, h.at(-2)!), sub(p, h.at(-2)!)) <= 0) h.pop();
      h.push(p);
    }
    return h.slice(0, -1);
  };
  const hull = [...half(pts), ...half([...pts].reverse())];
  let best = { width: Infinity, length: 0, across: [0, 1] as Point, area: Infinity };
  for (let i = 0; i < hull.length; i++) {
    const u = unit(sub(hull[(i + 1) % hull.length]!, hull[i]!));
    const n: Point = [-u[1], u[0]];
    const us = hull.map((p) => dot(p, u));
    const ns = hull.map((p) => dot(p, n));
    const a = Math.max(...us) - Math.min(...us);
    const b = Math.max(...ns) - Math.min(...ns);
    if (a * b < best.area - 1e-6)
      best =
        a < b
          ? { width: a, length: b, across: [u[0], u[1]], area: a * b }
          : { width: b, length: a, across: n, area: a * b };
  }
  return { width: best.width, length: best.length, across: best.across };
}

interface Ctx {
  plan: Plan;
  /** Plot bounding box, north up. */
  plot: PlotBox;
  rooms: Map<string, DerivedRoom>;
  tags: ReturnType<typeof autoTag>;
}

const nameOf = (r: Room) => r.name || roomTypeLabel(r.type);

const typesOf = (r: Rule) => [
  ...(r.scope.room_types ?? []),
  ...(r.scope.room_type ? [r.scope.room_type] : []),
];
const inScope = (r: Rule, room: Room) => {
  const t = typesOf(r);
  return !t.length || (t as string[]).includes(room.type);
};

/**
 * The value a rule asks for on this plot: its own, or its table's row; null when there is none.
 * `road_width` when the table goes by road width and the plan doesn't record it.
 */
function valueFor(rule: Rule, ctx: Ctx): number | null | 'road_width' {
  if (rule.value !== undefined) return rule.value;
  const t: RuleTable | undefined = rule.table;
  if (!t?.rows.length) return null;
  const road = ctx.plan.plot.road_width_cm;
  if (t.by === 'road_width_m' && road === undefined) return 'road_width';
  const measure =
    t.by === 'plot_area_m2'
      ? ctx.tags.plot_area_m2.value
      : t.by === 'plot_width_m'
        ? ctx.tags.plot_width_cm.value / 100
        : t.by === 'plot_depth_m'
          ? ctx.tags.plot_depth_cm.value / 100
          : road! / 100;
  return t.rows.find((row) => row.upto === null || measure <= row.upto)?.value ?? null;
}

/**
 * How to fix a small room: `lead` says what is needed ("Widen Bedroom by 32 cm"), then one of its
 * long walls to move outward by `cm`: one that runs the whole side if there is one, and an
 * internal one before an external one (which would change the building's outline). The move is
 * also offered as a quick fix when its result is certain: a rectangular room whose side is that
 * one wall from end to end.
 */
function widen(
  level: Level,
  room: Room,
  shape: DerivedRoom,
  across: Point,
  cm: number,
  lead: string,
): { how: string; fix?: IssueFix } {
  const c = centroid(shape.outer);
  const along: Point = [-across[1], across[0]];
  const span = (pts: readonly Pt[]) => {
    const t = pts.map((p) => dot(p, along));
    return [Math.min(...t), Math.max(...t)] as const;
  };
  const [lo, hi] = span(shape.outer);
  const whole = (w: Wall) => {
    const [a, b] = span([w.start, w.end]);
    return a <= lo + 1 && b >= hi - 1;
  };
  const walls = shape.wall_ids
    .map((id) => level.walls[id]!)
    .filter((w) => w && Math.abs(dot(unit(sub(w.end, w.start)), across)) < 0.25)
    .sort(
      (a, b) =>
        Number(!whole(a)) - Number(!whole(b)) ||
        Number(a.type === 'external') - Number(b.type === 'external') ||
        (a.id < b.id ? -1 : 1),
    );
  const w = walls[0];
  if (!w) return { how: `${lead}.` };
  const mid: Point = [(w.start[0] + w.end[0]) / 2, (w.start[1] + w.end[1]) / 2];
  const s = Math.sign(dot(sub(mid, c), across)) || 1;
  const out: Point = [across[0] * s, across[1] * s];
  const move = `move wall ${w.id} ${by(cm)} ${WORD[compassOf(out)]}`;
  const how = `${lead}, e.g. ${move}.`;
  const { width, length } = roomWidth(shape.outer);
  const rectangle =
    !shape.holes.length &&
    Math.abs(shape.area_m2 * 10_000 - width * length) <= 0.005 * width * length;
  if (!rectangle || !whole(w)) return { how };
  // Whole centimetres, as the sentence says.
  const d = Math.ceil(cm);
  return {
    how,
    fix: {
      label: move[0]!.toUpperCase() + move.slice(1),
      steps: [
        {
          id: 'MOVE',
          params: {
            ids: [w.id],
            from: [0, 0],
            to: [r1(out[0] * d), r1(out[1] * d)],
            level: level.id,
          },
        },
      ],
    },
  };
}

const issue = (
  rule: Rule,
  message: string,
  object_ids: string[],
  how_to_fix: string | { how: string; fix?: IssueFix },
): Issue => {
  const how = typeof how_to_fix === 'string' ? { how: how_to_fix } : how_to_fix;
  return {
    rule_id: rule.id,
    severity: rule.severity,
    category: rule.category,
    message,
    object_ids,
    how_to_fix: how.how,
    source: rule.source,
    verified: rule.verified,
    ...(how.fix ? { fix: how.fix } : {}),
  };
};

/** The main entrance: a door in an external wall, on the road side when there are several. */
function mainEntrance(level: Level, ctx: Ctx) {
  const front = setbackSides(ctx.plan.meta.facing)?.front;
  const centre: Point = [(ctx.plot.x0 + ctx.plot.x1) / 2, (ctx.plot.y0 + ctx.plot.y1) / 2];
  const doors = values(level.openings).flatMap((o) => {
    const w = level.walls[o.wall];
    if (o.kind !== 'door' || w?.type !== 'external') return [];
    const u = unit(sub(w.end, w.start));
    const n: Point = [-u[1], u[0]];
    const mid: Point = [(w.start[0] + w.end[0]) / 2, (w.start[1] + w.end[1]) / 2];
    const s = Math.sign(dot(sub(mid, centre), n)) || 1;
    return [{ door: o, faces: compassOf([n[0] * s, n[1] * s]) }];
  });
  return doors.find((d) => d.faces === front) ?? doors[0] ?? null;
}

/** What a zone rule looks at on a level: its rooms in scope, and drawn stairs for a staircase. */
function zoneSubjects(rule: Rule, level: Level, ctx: Ctx) {
  return [
    ...values(level.rooms)
      .filter((r) => inScope(rule, r))
      .map((r) => {
        const s = ctx.rooms.get(r.id);
        return { id: r.id, name: nameOf(r), at: s?.outer.length ? centroid(s.outer) : r.seed };
      }),
    ...(typesOf(rule).includes('staircase')
      ? values(level.stairs).map((s) => ({
          id: s.id,
          name: `Stair ${s.id}`,
          at: centroid(s.polygon),
        }))
      : []),
  ];
}

/**
 * Where a door widened to `width` starts on its wall: grown equally on both sides, kept on the
 * wall; null when it doesn't fit there or would run into another opening.
 */
function widenedDoor(level: Level, door: Opening, width: number): number | null {
  const w = level.walls[door.wall];
  if (!w) return null;
  const length = Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]);
  if (width > length) return null;
  const offset = r1(Math.min(Math.max(0, door.offset - (width - door.width) / 2), length - width));
  const clash = values(level.openings).some(
    (o) =>
      o.id !== door.id &&
      o.wall === door.wall &&
      o.offset < offset + width &&
      offset < o.offset + o.width,
  );
  return clash ? null : offset;
}

function checkRule(rule: Rule, level: Level, ctx: Ctx): Issue[] {
  const found = valueFor(rule, ctx);
  if (found === 'road_width')
    return level === levelsInOrder(ctx.plan)[0]
      ? [
          {
            ...issue(
              rule,
              `${rule.label ?? rule.id} depends on the width of the road in front, which the plan doesn't record yet.`,
              [],
              'Enter the road width in the plan’s properties (or type SET_PLOT road_width=900 for 9 m).',
            ),
            severity: 'info',
          },
        ]
      : [];
  const v = found;
  const rooms = values(level.rooms).filter((r) => inScope(rule, r));
  const shaped = rooms.flatMap((r) => {
    const s = ctx.rooms.get(r.id);
    return s && s.outer.length >= 3 ? [{ room: r, shape: s }] : [];
  });
  switch (rule.check) {
    case 'min_area':
      if (v === null) return [];
      return shaped
        .filter(({ shape }) => shape.area_m2 < v - 1e-9)
        .map(({ room, shape }) => {
          const { length, across } = roomWidth(shape.outer);
          const need = ((v - shape.area_m2) * 10_000) / (length || 1);
          return issue(
            rule,
            `${nameOf(room)} is ${m2(shape.area_m2)}; the reference minimum is ${m2(v)}.`,
            [room.id],
            widen(
              level,
              room,
              shape,
              across,
              need,
              `Enlarge ${nameOf(room)} by ${m2(v - shape.area_m2)}`,
            ),
          );
        });
    case 'min_area_one': {
      if (v === null || !shaped.length || shaped.some(({ shape }) => shape.area_m2 >= v - 1e-9))
        return [];
      const { room, shape } = shaped.reduce((a, b) => (b.shape.area_m2 > a.shape.area_m2 ? b : a));
      const { length, across } = roomWidth(shape.outer);
      return [
        issue(
          rule,
          `No ${typesOf(rule).length > 1 ? 'habitable room' : roomTypeLabel(typesOf(rule)[0]!).toLowerCase()} reaches ${m2(v)}; the largest, ${nameOf(room)}, is ${m2(shape.area_m2)}.`,
          [room.id],
          widen(
            level,
            room,
            shape,
            across,
            ((v - shape.area_m2) * 10_000) / (length || 1),
            `Enlarge ${nameOf(room)} by ${m2(v - shape.area_m2)}`,
          ),
        ),
      ];
    }
    case 'min_width':
      if (v === null) return [];
      return shaped.flatMap(({ room, shape }) => {
        const { width, across } = roomWidth(shape.outer);
        if (width >= v - 0.05) return [];
        return [
          issue(
            rule,
            `${nameOf(room)} is ${m(width)} wide; the reference minimum is ${m(v)}.`,
            [room.id],
            widen(
              level,
              room,
              shape,
              across,
              v - width,
              `Widen ${nameOf(room)} by ${by(v - width)}`,
            ),
          ),
        ];
      });
    case 'min_level_height':
      if (v === null || !rooms.length || level.height >= v) return [];
      return [
        issue(
          rule,
          `${level.name || level.id} is ${m(level.height)} high; rooms such as ${nameOf(rooms[0]!)} need at least ${m(v)}.`,
          [level.id],
          {
            how: `Make the level at least ${m(v)} high (${by(v - level.height)} more).`,
            fix: {
              label: `Make ${level.name || level.id} ${m(v)} high`,
              steps: [{ id: 'SET_LEVEL', params: { height: v, level: level.id } }],
            },
          },
        ),
      ];
    case 'zone_in':
    case 'zone_not_in': {
      const zones = rule.zones ?? [];
      const wanted = rule.check === 'zone_in';
      return zoneSubjects(rule, level, ctx).flatMap(({ id, name, at }) => {
        const zone = plotZone(ctx.plot, at);
        if (zones.includes(zone) === wanted) return [];
        return [
          issue(
            rule,
            wanted
              ? `${name} is in the ${WORD[zone]} of the plot; Vastu prefers the ${list(zones)}.`
              : `${name} is in the ${WORD[zone]} of the plot, which Vastu usually avoids for it.`,
            [id],
            wanted
              ? `Place ${name} in the ${list(zones)} part of the plot if the layout allows, or keep it as a known exception.`
              : `Move ${name} out of the ${WORD[zone]} if the layout allows, or keep it as a known exception.`,
          ),
        ];
      });
    }
    case 'entrance_side_in': {
      const main = mainEntrance(level, ctx);
      const zones = rule.zones ?? [];
      if (!main || zones.includes(main.faces)) return [];
      return [
        issue(
          rule,
          `The main entrance (door ${main.door.id}) faces ${WORD[main.faces]}; Vastu prefers ${list(zones)}.`,
          [main.door.id],
          `If the plot allows, put the main door on the ${list(zones)} side, or keep this as a known exception.`,
        ),
      ];
    }
    case 'min_door_width': {
      if (v === null) return [];
      const main = mainEntrance(level, ctx)?.door;
      const doors =
        rule.scope.door === 'entrance'
          ? main
            ? [main]
            : []
          : values(level.openings).filter(
              (o) => o.kind === 'door' && level.walls[o.wall]?.type !== 'external',
            );
      return doors
        .filter((d) => d.width < v - 1e-9)
        .map((d) => {
          const how = `Make door ${d.id} at least ${m(v)} wide (${by(v - d.width)} more).`;
          const offset = widenedDoor(level, d, v);
          return issue(
            rule,
            `${rule.scope.door === 'entrance' ? 'The main door' : 'Door'} ${d.id} is ${m(d.width)} wide; the reference is at least ${m(v)}.`,
            [d.id],
            offset === null
              ? how
              : {
                  how,
                  fix: {
                    label: `Make door ${d.id} ${m(v)} wide`,
                    steps: [
                      {
                        id: 'SET',
                        params: { id: d.id, props: { width: v, offset }, level: level.id },
                      },
                    ],
                  },
                },
          );
        });
    }
    case 'min_setback': {
      if (v === null || level !== levelsInOrder(ctx.plan)[0]) return [];
      const sides = setbackSides(ctx.plan.meta.facing);
      const fp = footprint(level).outlines.flat();
      if (!sides || !fp.length) return [];
      const side = sides[rule.scope.side!];
      const xs = fp.map((p) => p[0]);
      const ys = fp.map((p) => p[1]);
      const gap = {
        north: ctx.plot.y1 - Math.max(...ys),
        south: Math.min(...ys) - ctx.plot.y0,
        east: ctx.plot.x1 - Math.max(...xs),
        west: Math.min(...xs) - ctx.plot.x0,
      }[side];
      if (gap >= v - 0.05) return [];
      const assumed =
        ctx.plan.meta.provenance?.facing?.provenance === 'assumed'
          ? ' The plan’s facing is assumed, so which side is the front may be wrong.'
          : '';
      return [
        issue(
          rule,
          `The building is ${m(Math.max(0, gap))} from the ${rule.scope.side} (${side}) edge of the plot; the reference setback there is ${m(v)}.${assumed}`,
          [],
          `Move or shorten the building so it stands ${m(v)} from the ${rule.scope.side} edge (${by(v - gap)} more).`,
        ),
      ];
    }
    case 'max_coverage': {
      if (v === null || level !== levelsInOrder(ctx.plan)[0]) return [];
      const plot = ctx.tags.plot_area_m2.value;
      const pct = plot ? (footprint(level).area_m2 / plot) * 100 : 0;
      if (pct <= v + 1e-9) return [];
      return [
        issue(
          rule,
          `The ground floor covers ${pct.toFixed(1)}% of the plot; the reference maximum is ${v}%.`,
          [],
          `Reduce the ground-floor built-up area by ${m2(((pct - v) / 100) * plot)}.`,
        ),
      ];
    }
    case 'max_far': {
      if (v === null || level !== levelsInOrder(ctx.plan)[0]) return [];
      const plot = ctx.tags.plot_area_m2.value;
      const built = levelsInOrder(ctx.plan).reduce((s, l) => s + footprint(l).area_m2, 0);
      const far = plot ? built / plot : 0;
      if (far <= v + 1e-9) return [];
      return [
        issue(
          rule,
          `The FAR (built-up area of all floors ÷ plot area) is ${far.toFixed(2)}; the reference maximum is ${v}.`,
          [],
          `Reduce the total built-up area by ${m2((far - v) * plot)}.`,
        ),
      ];
    }
  }
}

export interface CheckOptions {
  /** The packs to run; by default those the plan asks for (`packsFor`). */
  packs?: readonly RulePack[];
  /** Rooms already derived (`validatePlan(plan).rooms`), to save deriving them again. */
  rooms?: readonly DerivedRoom[];
}

function context(plan: Plan, rooms?: readonly DerivedRoom[]): Ctx {
  const derived = rooms ?? levelsInOrder(plan).flatMap((l) => deriveRooms(l).rooms);
  return {
    plan,
    plot: plotBox(plan),
    rooms: new Map(derived.map((r) => [r.room_id, r])),
    tags: autoTag(plan),
  };
}

/** Runs the reference checks of every pack on every level; issues in pack and rule order. */
export function checkPlan(plan: Plan, options: CheckOptions = {}): Issue[] {
  const ctx = context(plan, options.rooms);
  const out: Issue[] = [];
  for (const pack of options.packs ?? packsFor(plan))
    for (const rule of pack.rules)
      for (const level of levelsInOrder(plan)) out.push(...checkRule(rule, level, ctx));
  return out;
}

export interface VastuScore {
  /** Share of the Vastu preferences the plan meets, 0–100. */
  value: number;
  /** Preferences met, out of `total`: one per room (or stair, or main entrance) a rule applies to. */
  met: number;
  total: number;
  provenance: ProvenanceKind;
  reason: string;
}

/**
 * How well the plan follows its Vastu preferences (P3.2): every room a Vastu rule applies to
 * counts once, and so does the main entrance. Null when no Vastu rule applies (Vastu off, or
 * nothing to judge yet). Zones assume north points up in the drawing, so the score is "assumed".
 */
export function vastuScore(plan: Plan, options: CheckOptions = {}): VastuScore | null {
  const ctx = context(plan, options.rooms);
  let total = 0;
  let missed = 0;
  for (const pack of options.packs ?? packsFor(plan))
    for (const rule of pack.rules) {
      if (rule.category !== 'vastu') continue;
      for (const level of levelsInOrder(plan)) {
        const subjects =
          rule.check === 'entrance_side_in'
            ? Number(mainEntrance(level, ctx) !== null)
            : rule.check === 'zone_in' || rule.check === 'zone_not_in'
              ? zoneSubjects(rule, level, ctx).length
              : 0;
        if (!subjects) continue;
        total += subjects;
        missed += checkRule(rule, level, ctx).length;
      }
    }
  if (!total) return null;
  return {
    value: Math.round((100 * (total - missed)) / total),
    met: total - missed,
    total,
    provenance: 'assumed',
    reason: 'Assumes north points up in the drawing.',
  };
}
