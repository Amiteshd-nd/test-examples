import { z } from 'zod';
import { Compass, Id } from './primitives.ts';
import { RoomType } from './room-types.ts';

// Rule-pack entry (PRD §4.3) and issue (PRD §4.5). Thresholds live in rule-pack data, not code:
// a rule names a check the engine knows (`RuleCheck`) and gives its value, a table of values
// that depend on the plot, or the Vastu zones it wants. P3.1 adds the pack file around rules.

export const Severity = z.enum(['error', 'warning', 'info']);
export type Severity = z.infer<typeof Severity>;

/** `schema` is for problems reading the file itself; the others match rule-pack categories. */
export const IssueCategory = z.enum(['bylaw', 'geometry', 'brief', 'vastu', 'schema']);
export type IssueCategory = z.infer<typeof IssueCategory>;

export const RuleUnit = z.enum(['cm', 'm2', '%', 'ratio', 'zone']);

/** The checks the engine runs (`engine/rules/check.ts`). */
export const RuleCheck = z.enum([
  /** Every room in scope has at least `value` m². */
  'min_area',
  /** At least one room in scope has `value` m² (NBC: one habitable room of 9.5 m²). */
  'min_area_one',
  /** Every room in scope is at least `value` cm wide. */
  'min_width',
  /** Levels holding rooms in scope are at least `value` cm high. */
  'min_level_height',
  /** Rooms in scope lie in one of `zones` of the plot (Vastu). */
  'zone_in',
  /** Rooms in scope lie outside `zones`. */
  'zone_not_in',
  /** The main entrance faces one of `zones` (north, east…). */
  'entrance_side_in',
  /** Doors in scope (`scope.door`) are at least `value` cm wide. */
  'min_door_width',
  /** The building stands at least the value (cm) back from the plot edge on `scope.side`. */
  'min_setback',
  /** Built-up area of the ground floor is at most the value (%) of the plot (ground coverage). */
  'max_coverage',
  /** Built-up area of all floors ÷ plot area is at most the value (FAR / FSI). */
  'max_far',
]);
export type RuleCheck = z.infer<typeof RuleCheck>;

/** A part of the plot, as a 3 × 3 grid with north up (Vastu zones). */
export const PlotZone = z.enum([...Compass.options, 'centre']);
export type PlotZone = z.infer<typeof PlotZone>;

/** A value that depends on the plot: the first row whose `upto` the plot's measure doesn't pass. */
export const RuleTable = z.strictObject({
  by: z.enum(['plot_area_m2', 'plot_width_m', 'plot_depth_m', 'road_width_m']),
  /** Rows in rising order; the last may have `upto: null` (and above). Empty until filled in. */
  rows: z.array(z.strictObject({ upto: z.number().positive().nullable(), value: z.number() })),
});
export type RuleTable = z.infer<typeof RuleTable>;

export const RuleScope = z.strictObject({
  /** One room type (PRD §4.3's form). */
  room_type: RoomType.optional(),
  /** Several room types, e.g. every habitable room. */
  room_types: z.array(RoomType).min(1).optional(),
  /** Which doors a door check looks at: the main entrance, or the doors inside. */
  door: z.enum(['entrance', 'internal']).optional(),
  /** Which side of the plot a setback check measures, as seen from the road. */
  side: z.enum(['front', 'rear', 'left', 'right']).optional(),
});
export type RuleScope = z.infer<typeof RuleScope>;

const NUMERIC = new Set<RuleCheck>([
  'min_area',
  'min_area_one',
  'min_width',
  'min_level_height',
  'min_door_width',
  'min_setback',
  'max_coverage',
  'max_far',
]);

export const Rule = z
  .strictObject({
    id: Id,
    /** A short name for the rule, for people (e.g. "Kitchen area"). */
    label: z.string().min(1).optional(),
    scope: RuleScope,
    check: RuleCheck,
    value: z.number().optional(),
    table: RuleTable.optional(),
    zones: z.array(PlotZone).min(1).optional(),
    unit: RuleUnit,
    severity: Severity,
    category: IssueCategory.exclude(['schema']),
    /** Where the threshold comes from, e.g. "NBC 2016 Part 3 (verify)". */
    source: z.string(),
    /** Confirmed by the architect against its source; unconfirmed rules are labelled "unverified". */
    verified: z.boolean(),
    editable: z.boolean(),
    /** Anything a reader of the rule should know (exceptions, what counts). */
    note: z.string().optional(),
  })
  .superRefine((r, ctx) => {
    if (NUMERIC.has(r.check) && r.value === undefined && !r.table)
      ctx.addIssue({ code: 'custom', message: `${r.check} needs a value or a table` });
    if (!NUMERIC.has(r.check) && !r.zones)
      ctx.addIssue({ code: 'custom', message: `${r.check} needs zones` });
    if (r.check === 'min_setback' && !r.scope.side)
      ctx.addIssue({ code: 'custom', message: 'min_setback needs scope.side' });
    if (r.check === 'min_door_width' && !r.scope.door)
      ctx.addIssue({ code: 'custom', message: 'min_door_width needs scope.door' });
  });
export type Rule = z.infer<typeof Rule>;

/** A set of rules kept and edited together, e.g. `nbc-default` or `city-bengaluru` (P3.1). */
export const RulePack = z
  .strictObject({
    format: z.literal('plancraft-rule-pack'),
    version: z.literal(1),
    id: Id,
    name: z.string().min(1),
    description: z.string(),
    /** `vastu`: checked only when the plan asks for Vastu (`meta.vastu`). */
    applies: z.enum(['always', 'vastu']),
    rules: z.array(Rule),
  })
  .superRefine((p, ctx) => {
    const seen = new Set<string>();
    for (const r of p.rules) {
      if (seen.has(r.id)) ctx.addIssue({ code: 'custom', message: `two rules use the id ${r.id}` });
      seen.add(r.id);
    }
  });
export type RulePack = z.infer<typeof RulePack>;

/**
 * A fix with only one sensible answer (P3.2), as commands the host runs as one batch, i.e. one
 * undo step. Offered only where the result is certain, e.g. widening a door to the minimum.
 */
export const IssueFix = z.strictObject({
  /** What the fix does, for its button: "Move wall W3 32 cm north". */
  label: z.string().min(1),
  steps: z.array(z.strictObject({ id: z.string().min(1), params: z.unknown() })).min(1),
});
export type IssueFix = z.infer<typeof IssueFix>;

export const Issue = z.strictObject({
  rule_id: z.string().min(1),
  severity: Severity,
  category: IssueCategory,
  /** Plain-language statement of the problem. */
  message: z.string().min(1),
  object_ids: z.array(z.string()),
  /** One sentence on how to fix it. */
  how_to_fix: z.string().min(1),
  source: z.string(),
  /** False when the rule's value hasn't been confirmed yet: the UI says "unverified". */
  verified: z.boolean().optional(),
  fix: IssueFix.optional(),
});
export type Issue = z.infer<typeof Issue>;
