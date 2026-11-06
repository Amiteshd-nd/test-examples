// Exports the sample plans and the synthetic drawings' imports to data/exports/check/ for the
// ezdxf checks in tools/test_exports.py: `npm run test:dxf`.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { exportDxf, importDxf, oneBhkDxf, Plan } from '../engine/index.ts';

const dir = 'data/exports/check';
mkdirSync(dir, { recursive: true });
const plans: [string, Plan][] = readdirSync('engine/samples/1.3.0')
  .filter((f) => f.endsWith('.plan.json'))
  .map((f) => [
    f.replace('.plan.json', ''),
    Plan.parse(JSON.parse(readFileSync(`engine/samples/1.3.0/${f}`, 'utf8'))),
  ]);
const imported = importDxf(
  oneBhkDxf({ unit: 'mm', header: true, polylines: false, wrapInBlock: false }),
);
if (imported.plan) plans.push(['synthetic-1bhk-roundtrip', imported.plan]);
for (const [name, plan] of plans) {
  const result = exportDxf(plan);
  if (!result.ok) throw new Error(`${name}: ${result.check.mismatches.join(' ')}`);
  writeFileSync(`${dir}/${name}.dxf`, result.dxf);
}
console.log(`Wrote ${plans.length} exports to ${dir}/`);
