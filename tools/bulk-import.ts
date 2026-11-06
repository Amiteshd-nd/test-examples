// Bulk DXF import (P1.2): converts every .dxf under data/raw/ into data/converted/ with a plan,
// a conversion report and a preview each, plus SUMMARY.md. Usage:
//   npm run import -- [--in data/raw] [--out data/converted] [--mapping data/import-mapping.json] [--units mm|cm|m|in|ft]
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import {
  ImportMapping,
  importDxf,
  renderPlanSvg,
  reportToMarkdown,
  type ConversionReport,
  type UnitName,
} from '../engine/index.ts';

const { values } = parseArgs({
  options: {
    in: { type: 'string', default: 'data/raw' },
    out: { type: 'string', default: 'data/converted' },
    mapping: { type: 'string', default: 'data/import-mapping.json' },
    units: { type: 'string' },
  },
});

const mapping = existsSync(values.mapping)
  ? ImportMapping.parse(JSON.parse(readFileSync(values.mapping, 'utf8')))
  : undefined;
if (mapping) console.log(`Using mapping ${values.mapping}`);

function dxfFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return dxfFiles(path);
    return /\.dxf$/i.test(e.name) ? [path] : [];
  });
}

const files = dxfFiles(values.in);
if (files.length === 0) {
  console.log(
    `No .dxf files under ${values.in}. Put drawings there (e.g. ${values.in}/samples/) and run again.`,
  );
  process.exit(0);
}

const rows: ConversionReport[] = [];
for (const file of files) {
  const rel = relative(values.in, file).replace(/\.dxf$/i, '');
  const base = join(values.out, rel);
  mkdirSync(dirname(base), { recursive: true });
  const result = importDxf(new Uint8Array(readFileSync(file)), {
    name: rel,
    ...(mapping ? { mapping } : {}),
    ...(values.units ? { units: values.units as UnitName } : {}),
  });
  writeFileSync(`${base}.report.md`, reportToMarkdown(result.report));
  writeFileSync(`${base}.report.json`, JSON.stringify(result.report, null, 2) + '\n');
  if (result.plan) {
    writeFileSync(`${base}.plan.json`, JSON.stringify(result.plan, null, 2) + '\n');
    writeFileSync(
      `${base}.preview.svg`,
      renderPlanSvg(result.plan, { rooms: result.rooms, underlay: result.underlay, title: rel }),
    );
  }
  rows.push(result.report);
  console.log(`${result.report.status.padEnd(8)} ${rel}`);
}

const count = (s: ConversionReport['status']) => rows.filter((r) => r.status === s).length;
const summary = [
  '# DXF import summary',
  '',
  `${rows.length} files: ${count('success')} converted, ${count('partial')} with problems, ${count('failed')} not converted.`,
  '',
  '| File | Status | Walls | Rooms | Doors | Windows | Failed items | Check errors |',
  '|---|---|---|---|---|---|---|---|',
  ...rows.map(
    (r) =>
      `| ${r.name} | ${r.status} | ${r.counts.walls} | ${r.counts.rooms} | ${r.counts.doors} | ${r.counts.windows} | ${r.items.filter((i) => i.outcome === 'failed').length} | ${r.issues.filter((i) => i.severity === 'error').length} |`,
  ),
  '',
];
writeFileSync(join(values.out, 'SUMMARY.md'), summary.join('\n'));
console.log(`\n${summary[2]}\nReports, plans and previews in ${values.out}/ (see SUMMARY.md).`);
