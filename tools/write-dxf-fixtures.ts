// Writes the synthetic test drawings to data/raw/synthetic/ so the bulk importer has something
// to convert before the founder's samples arrive: `npm run fixtures`. The two grid plans are
// drawn by our own DXF export: a typical house-sized plan (4 × 3 rooms) and a stress plan
// (12 × 10 rooms) for the canvas speed check (P2.3).
import { mkdirSync, writeFileSync } from 'node:fs';
import { exportDxf, gridPlan, oneBhkDxf } from '../engine/index.ts';

const dir = 'data/raw/synthetic';
mkdirSync(dir, { recursive: true });
writeFileSync(
  `${dir}/1bhk-mm-lines.dxf`,
  oneBhkDxf({ unit: 'mm', header: true, polylines: false, wrapInBlock: false }),
);
writeFileSync(
  `${dir}/1bhk-inches-polylines-block.dxf`,
  oneBhkDxf({ unit: 'in', header: false, polylines: true, wrapInBlock: true }),
);
for (const [file, cols, rows] of [
  ['grid-4x3-typical', 4, 3],
  ['grid-12x10-stress', 12, 10],
] as const) {
  const result = exportDxf(gridPlan({ cols, rows }));
  if (!result.ok) throw new Error(`${file}: ${result.check.mismatches.join('; ')}`);
  writeFileSync(`${dir}/${file}.dxf`, result.dxf);
}
console.log(`Wrote 4 synthetic drawings to ${dir}/`);
