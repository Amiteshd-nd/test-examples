import { z } from 'zod';
import { Brief } from './brief.ts';
import { PlanGraph } from './graph.ts';
import { Plan } from './plan.ts';
import { Issue, Rule, RulePack } from './rule.ts';
import { PackageManifest, VaultIndex } from '../vault/records.ts';

/**
 * JSON Schema (draft 2020-12) for the public formats, generated from the zod models.
 * `npm run schema` writes them to `engine/schema/json/`; a test keeps those files current.
 * The 0.1 cm grid rule is a zod refinement and does not appear in JSON Schema.
 */
export function jsonSchemas(): Record<
  | 'plan'
  | 'rule'
  | 'rule-pack'
  | 'issue'
  | 'brief'
  | 'plan-graph'
  | 'vault-index'
  | 'plancraft-package-manifest',
  unknown
> {
  const opts = { target: 'draft-2020-12', io: 'input' } as const;
  return {
    plan: z.toJSONSchema(Plan, opts),
    rule: z.toJSONSchema(Rule, opts),
    'rule-pack': z.toJSONSchema(RulePack, opts),
    issue: z.toJSONSchema(Issue, opts),
    brief: z.toJSONSchema(Brief, opts),
    'plan-graph': z.toJSONSchema(PlanGraph, opts),
    'vault-index': z.toJSONSchema(VaultIndex, opts),
    'plancraft-package-manifest': z.toJSONSchema(PackageManifest, opts),
  };
}
