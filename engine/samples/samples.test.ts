import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, validatePlan } from '../index.ts';

// PRD P1.1 task 2: every sample from every format version still loads.
// When the format changes, keep the old folder and add a new one for the new version.

const SAMPLES_DIR = fileURLToPath(new URL('.', import.meta.url));
const versions = readdirSync(SAMPLES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

describe('sample plans', () => {
  it('include the current format version', () => {
    expect(versions).toContain(CURRENT_SCHEMA_VERSION);
  });

  for (const version of versions) {
    const files = readdirSync(join(SAMPLES_DIR, version)).filter((f) => f.endsWith('.plan.json'));
    for (const file of files) {
      it(`${version}/${file} loads, migrates and validates without errors`, () => {
        const doc = JSON.parse(readFileSync(join(SAMPLES_DIR, version, file), 'utf8'));
        const result = validatePlan(doc);
        expect(result.issues).toEqual([]);
        expect(result.ok).toBe(true);
        expect(result.plan?.schema_version).toBe(CURRENT_SCHEMA_VERSION);
      });
    }
  }
});
