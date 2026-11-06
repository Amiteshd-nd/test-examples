import type { Plan } from '../schema/plan.ts';
import { RulePack, type Issue } from '../schema/rule.ts';
import { validatorIssue } from '../validate/issues.ts';
import city from './packs/city-bengaluru.json' with { type: 'json' };
import firm from './packs/firm-default.json' with { type: 'json' };
import nbc from './packs/nbc-default.json' with { type: 'json' };
import vastu from './packs/vastu-default.json' with { type: 'json' };

// Rule packs (P3.1): data files of rules, edited by the architect (thresholds live in data, not
// code). The engine ships starting packs; a host can load edited or extra packs and pass them to
// `checkPlan`. Values not yet confirmed by the architect are `verified: false`.

/** The packs that ship with the engine, by id. */
export const BUILT_IN_PACKS: Readonly<Record<string, RulePack>> = Object.fromEntries(
  [nbc, city, firm, vastu].map((json) => {
    const pack = RulePack.parse(json);
    return [pack.id, pack];
  }),
);

/** The packs a plan uses when it doesn't list its own: NBC, its city, the firm's and Vastu. */
export const defaultPackIds = (plan: Plan) => [
  'nbc-default',
  `city-${plan.meta.city}`,
  'firm-default',
  'vastu-default',
];

/**
 * The packs to check a plan with: those it lists (`rule_pack_ids`) or the defaults, among the
 * packs available. A Vastu pack only counts when the plan asks for Vastu.
 */
export function packsFor(
  plan: Plan,
  available: Readonly<Record<string, RulePack>> = BUILT_IN_PACKS,
): RulePack[] {
  const ids = plan.rule_pack_ids.length ? plan.rule_pack_ids : defaultPackIds(plan);
  return ids.flatMap((id) => {
    const pack = available[id];
    return pack && (pack.applies === 'always' || plan.meta.vastu) ? [pack] : [];
  });
}

export type LoadPackResult = { ok: true; pack: RulePack } | { ok: false; issues: Issue[] };

/** Reads a rule pack (e.g. one the architect edited), saying what is wrong when it can't. */
export function loadRulePack(input: unknown): LoadPackResult {
  const parsed = RulePack.safeParse(input);
  if (parsed.success) return { ok: true, pack: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((e) => {
      const where = e.path.length ? e.path.join('.') : 'pack';
      return validatorIssue(
        'schema.invalid',
        `The rule pack's value at ${where} is not allowed: ${e.message}.`,
        [],
        `Correct the value at ${where} in the rule pack.`,
      );
    }),
  };
}
