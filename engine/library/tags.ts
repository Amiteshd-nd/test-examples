import { z } from 'zod';
import { WALL_GRID, wallOutlines } from '../geometry/wall-outlines.ts';
import { firstLevel, toMap, values } from '../schema/collections.ts';
import { deriveRooms } from '../rooms/derive.ts';
import type { Level, Plan } from '../schema/plan.ts';
import {
  Compass,
  ProvenanceKind,
  roundM2,
  type Point,
  type ProvenanceTag,
} from '../schema/primitives.ts';
import type { RoomTypeId } from '../schema/room-types.ts';

// Plan Library tags (P1.4 task 2): what a plan is, for search and for the founder's review.
// Every tag says how it was obtained (PRD §4.5); a tag built on an assumed input is "assumed".

const tagged = <T extends z.ZodType>(value: T) =>
  z.strictObject({ value, provenance: ProvenanceKind, reason: z.string().optional() });

export const Zone = z.enum([...Compass.options, 'centre']);
export type Zone = z.infer<typeof Zone>;

export const PlanTags = z.strictObject({
  /** Along the road. */
  plot_width_cm: tagged(z.number()),
  plot_depth_cm: tagged(z.number()),
  /** e.g. "30 × 40 ft" and "9.14 × 12.19 m". */
  plot_size_ft: z.string(),
  plot_size_m: z.string(),
  plot_area_m2: tagged(z.number()),
  facing: tagged(Compass),
  bhk: tagged(z.number().int()),
  floors: tagged(z.number().int()),
  /** Inside the outer face of the building's walls. */
  built_up_m2: tagged(z.number()),
  /** Sum of room floor areas. */
  carpet_m2: tagged(z.number()),
  vastu: tagged(z.boolean()),
  /** Room type → zone of the plot (a 3 × 3 grid, north up). */
  zones: tagged(z.record(z.string(), Zone)),
  /** Plain-language Vastu observations; reference only. */
  vastu_notes: z.array(z.string()),
});
export type PlanTags = z.infer<typeof PlanTags>;

const ZONE_ROOMS: RoomTypeId[] = [
  'kitchen',
  'master_bedroom',
  'pooja',
  'toilet',
  'bath',
  'wc',
  'staircase',
  'living',
];

/** Usual Vastu placements, for observations only (rule packs check Vastu in P3). */
const VASTU_HINTS: Partial<Record<RoomTypeId, { good: Zone[]; avoid: Zone[] }>> = {
  kitchen: { good: ['south_east', 'north_west'], avoid: ['north_east'] },
  master_bedroom: { good: ['south_west'], avoid: ['north_east'] },
  pooja: { good: ['north_east'], avoid: ['south_west'] },
  toilet: { good: ['north_west', 'west', 'south'], avoid: ['north_east', 'centre'] },
  staircase: { good: ['south_west', 'south', 'west'], avoid: ['north_east', 'centre'] },
};

const NAMES: Record<Zone, string> = {
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

const weakest = (...kinds: ProvenanceKind[]): ProvenanceKind =>
  kinds.includes('assumed') ? 'assumed' : kinds.includes('inferred') ? 'inferred' : 'measured';
const provOf = (tag: ProvenanceTag | undefined): ProvenanceKind => tag?.provenance ?? 'measured';

/**
 * The building's footprint on one level: the outer outlines of its external and internal walls
 * (cm, anticlockwise; a free-standing duct inside counts once) and the area inside them, m².
 * Shared by the library tags (built-up area) and the reference checks (coverage, FAR, setbacks).
 */
export function footprint(level: Level): { outlines: Point[][]; area_m2: number } {
  const building = {
    ...level,
    walls: toMap(values(level.walls).filter((w) => w.type === 'external' || w.type === 'internal')),
  };
  const all = wallOutlines(building, () => 'all', { solid: true }).get('all') ?? [];
  const area2 = (loop: readonly (readonly [number, number])[]) => {
    let a = 0;
    for (let i = 0; i < loop.length; i++)
      a +=
        loop[i]![0] * loop[(i + 1) % loop.length]![1] -
        loop[(i + 1) % loop.length]![0] * loop[i]![1];
    return a;
  };
  const inside = (pt: readonly [number, number], loop: readonly (readonly [number, number])[]) => {
    let c = false;
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      const a = loop[i]!;
      const b = loop[j]!;
      if (
        a[1] > pt[1] !== b[1] > pt[1] &&
        pt[0] < a[0] + ((pt[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1])
      )
        c = !c;
    }
    return c;
  };
  const outers = all.filter((l) => area2(l) > 0);
  const kept = outers.filter((l) => !outers.some((m) => m !== l && inside(l[0]!, m)));
  return {
    outlines: kept.map((l) => l.map(([x, y]): Point => [x / WALL_GRID, y / WALL_GRID])),
    area_m2: kept.reduce((s, l) => s + area2(l) / 2 / (WALL_GRID * WALL_GRID) / 10_000, 0),
  };
}

export function autoTag(plan: Plan): PlanTags {
  const level = firstLevel(plan);
  const meta = plan.meta.provenance ?? {};
  const xs = plan.plot.polygon.map((p) => p[0]);
  const ys = plan.plot.polygon.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];

  // Plot: width runs along the road side.
  const p = plan.plot.polygon;
  const rectangle =
    p.length === 4 && p.every((q, i) => q[0] === p[(i + 1) % 4]![0] || q[1] === p[(i + 1) % 4]![1]);
  const alongX = !['east', 'west'].includes(plan.meta.facing);
  const plotProv = weakest(
    provOf(plan.plot.provenance?.polygon),
    rectangle ? 'measured' : 'inferred',
  );
  const sizeProv = weakest(plotProv, provOf(meta.facing));
  const sizeReason = [
    rectangle ? null : 'Bounding box of an irregular plot.',
    provOf(meta.facing) === 'assumed'
      ? 'Which side is the width depends on the assumed facing.'
      : null,
    plan.plot.provenance?.polygon?.reason ?? null,
  ]
    .filter(Boolean)
    .join(' ');
  const width = alongX ? x1 - x0 : y1 - y0;
  const depth = alongX ? y1 - y0 : x1 - x0;
  const withReason = <T>(value: T, provenance: ProvenanceKind, reason: string) =>
    reason ? { value, provenance, reason } : { value, provenance };
  let plotArea = 0;
  for (let i = 0; i < p.length; i++)
    plotArea += p[i]![0] * p[(i + 1) % p.length]![1] - p[(i + 1) % p.length]![0] * p[i]![1];

  // Areas
  const builtUp = footprint(level).area_m2;
  const derived = deriveRooms(level).rooms;
  const carpet = derived.reduce((s, r) => s + r.area_m2, 0);

  // BHK: what the architect typed wins; otherwise count bedrooms.
  const bedrooms = values(level.rooms).filter(
    (r) => r.type === 'bedroom' || r.type === 'master_bedroom',
  ).length;
  const bhk =
    provOf(meta.bhk) === 'measured'
      ? { value: plan.meta.bhk, provenance: 'measured' as const }
      : {
          value: bedrooms,
          provenance: 'inferred' as const,
          reason: `${bedrooms} bedroom${bedrooms === 1 ? '' : 's'} in the plan.`,
        };

  // Zones of the plot, north up.
  const zoneOf = (x: number, y: number): Zone => {
    const col = x < x0 + (x1 - x0) / 3 ? 'west' : x > x1 - (x1 - x0) / 3 ? 'east' : '';
    const row = y < y0 + (y1 - y0) / 3 ? 'south' : y > y1 - (y1 - y0) / 3 ? 'north' : '';
    return (row && col ? `${row}_${col}` : row || col || 'centre') as Zone;
  };
  const zones: Record<string, Zone> = {};
  const notes: string[] = [];
  for (const room of values(level.rooms).filter((r) => ZONE_ROOMS.includes(r.type))) {
    const shape = derived.find((d) => d.room_id === room.id);
    const pts = shape?.outer ?? [room.seed];
    const cx = pts.reduce((s, q) => s + q[0], 0) / pts.length;
    const cy = pts.reduce((s, q) => s + q[1], 0) / pts.length;
    const zone = zoneOf(cx, cy);
    zones[room.type] ??= zone;
    const hint = VASTU_HINTS[room.type];
    const label = room.name || room.type;
    if (hint?.good.includes(zone))
      notes.push(`${label} in the ${NAMES[zone]}: a usual Vastu placement.`);
    if (hint?.avoid.includes(zone))
      notes.push(`${label} in the ${NAMES[zone]}: usually avoided in Vastu.`);
  }

  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    plot_width_cm: withReason(round1(width), sizeProv, sizeReason),
    plot_depth_cm: withReason(round1(depth), sizeProv, sizeReason),
    plot_size_ft: `${Math.round(width / 30.48)} × ${Math.round(depth / 30.48)} ft`,
    plot_size_m: `${(width / 100).toFixed(2)} × ${(depth / 100).toFixed(2)} m`,
    plot_area_m2: withReason(
      roundM2(Math.abs(plotArea) / 2 / 10_000),
      plotProv,
      plan.plot.provenance?.polygon?.reason ?? '',
    ),
    facing: withReason(plan.meta.facing, provOf(meta.facing), meta.facing?.reason ?? ''),
    bhk,
    floors: withReason(plan.meta.floors, provOf(meta.floors), meta.floors?.reason ?? ''),
    built_up_m2: {
      value: roundM2(builtUp),
      provenance: 'inferred',
      reason: 'Inside the outer face of the external walls.',
    },
    carpet_m2: {
      value: roundM2(carpet),
      provenance: 'inferred',
      reason: 'Sum of the room floor areas.',
    },
    vastu: withReason(plan.meta.vastu, provOf(meta.vastu), meta.vastu?.reason ?? ''),
    zones: {
      value: zones,
      provenance: 'assumed',
      reason: 'Assumes north points up in the drawing.',
    },
    vastu_notes: notes,
  };
}
