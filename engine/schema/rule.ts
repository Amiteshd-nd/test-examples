import { z } from 'zod';
import { Id } from './primitives.ts';
import { RoomType } from './room-types.ts';

// Rule-pack entry (PRD §4.3) and issue (PRD §4.5). Thresholds live in rule-pack data, not code.

export const Severity = z.enum(['error', 'warning', 'info']);
export type Severity = z.infer<typeof Severity>;

/** `schema` is for problems reading the file itself; the others match rule-pack categories. */
export const IssueCategory = z.enum(['bylaw', 'geometry', 'brief', 'vastu', 'schema']);
export type IssueCategory = z.infer<typeof IssueCategory>;

export const RuleUnit = z.enum(['cm', 'm2', '%', 'ratio']);

export const Rule = z.strictObject({
  id: Id,
  scope: z.strictObject({ room_type: RoomType.optional() }),
  /** Name of the check function (defined with the rules engine, P3.1). */
  check: z.string().min(1),
  value: z.number(),
  unit: RuleUnit,
  severity: Severity,
  category: IssueCategory.exclude(['schema']),
  /** Where the threshold comes from, e.g. "NBC 2016 Part 3 (verify)". */
  source: z.string(),
  verified: z.boolean(),
  editable: z.boolean(),
});
export type Rule = z.infer<typeof Rule>;

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
});
export type Issue = z.infer<typeof Issue>;
