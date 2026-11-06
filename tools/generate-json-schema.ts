// Writes JSON Schema files for the public formats: `npm run schema`. Output is Prettier-formatted,
// so `npm run check` stays green without a separate format step.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { jsonSchemas } from '../engine/index.ts';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'engine', 'schema', 'json');
mkdirSync(outDir, { recursive: true });
for (const [name, schema] of Object.entries(jsonSchemas())) {
  const file = join(outDir, `${name}.schema.json`);
  writeFileSync(
    file,
    await format(JSON.stringify(schema, null, 2), {
      ...(await resolveConfig(file)),
      filepath: file,
    }),
  );
  console.log(`wrote engine/schema/json/${name}.schema.json`);
}
