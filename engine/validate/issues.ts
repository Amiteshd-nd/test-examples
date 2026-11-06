import type { Issue, Severity } from '../schema/rule.ts';

// Rules of the built-in geometry and format check (P1.1). Rule-pack checks (P3) are separate.

export const VALIDATOR_SOURCE = 'PlanCraft plan check';

export const VALIDATOR_RULES = {
  'schema.unreadable': 'error',
  'schema.invalid': 'error',
  'schema.id_key_mismatch': 'error',
  'geometry.duplicate_id': 'error',
  'geometry.wall_zero_length': 'error',
  'geometry.separator_zero_length': 'error',
  'geometry.polygon_too_few_points': 'error',
  'geometry.polygon_zero_area': 'error',
  'geometry.polygon_self_intersecting': 'error',
  'geometry.host_wall_missing': 'error',
  'geometry.opening_outside_wall': 'error',
  'geometry.openings_overlap': 'error',
  'geometry.loft_wall_not_in_room': 'error',
  'geometry.room_seed_not_enclosed': 'error',
  'geometry.room_seed_in_wall': 'error',
  'geometry.room_too_small_for_walls': 'error',
  'geometry.rooms_share_area': 'warning',
} as const satisfies Record<string, Severity>;

export type ValidatorRuleId = keyof typeof VALIDATOR_RULES;

export function validatorIssue(
  rule_id: ValidatorRuleId,
  message: string,
  object_ids: string[],
  how_to_fix: string,
): Issue {
  return {
    rule_id,
    severity: VALIDATOR_RULES[rule_id],
    category: rule_id.startsWith('schema.') ? 'schema' : 'geometry',
    message,
    object_ids,
    how_to_fix,
    source: VALIDATOR_SOURCE,
  };
}

/** Formats a length in cm as metres for messages, e.g. 245 → "2.45 m". */
export function formatM(cm: number): string {
  return `${(cm / 100).toFixed(2)} m`;
}
