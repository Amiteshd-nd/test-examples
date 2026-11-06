import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { jsonSchemas } from './json-schema.ts';

describe('generated JSON Schema files', () => {
  for (const [name, schema] of Object.entries(jsonSchemas())) {
    it(`json/${name}.schema.json is current (run \`npm run schema\` if this fails)`, () => {
      const onDisk = readFileSync(new URL(`./json/${name}.schema.json`, import.meta.url), 'utf8');
      expect(JSON.parse(onDisk)).toEqual(schema);
    });
  }
});
