import { z } from 'zod';
import { Brief } from './brief.ts';
import { Plan } from './plan.ts';
import { Issue, Rule } from './rule.ts';
import { PackageManifest, VaultIndex } from '../vault/records.ts';

/**
 * JSON Schema (draft 2020-12) for the public formats, generated from the zod models.
 * `npm run schema` writes them to `engine/schema/json/`; a test keeps those files current.
 * The 0.1 cm grid rule is a zod refinement and does not appear in JSON Schema.
 */
export function jsonSchemas(): Record<
  'plan' | 'rule' | 'issue' | 'brief' | 'vault-index' | 'plancraft-package-manifest',
  unknown
> {
  const opts = { target: 'draft-2020-12', io: 'input' } as const;
  return {
    plan: z.toJSONSchema(Plan, opts),
    rule: z.toJSONSchema(Rule, opts),
    issue: z.toJSONSchema(Issue, opts),
    brief: z.toJSONSchema(Brief, opts),
    'vault-index': z.toJSONSchema(VaultIndex, opts),
    'plancraft-package-manifest': z.toJSONSchema(PackageManifest, opts),
  };
}
