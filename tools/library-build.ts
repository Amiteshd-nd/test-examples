// Builds the Plan Library (P1.4) from the bulk importer's output: every converted plan in
// data/converted/ is tagged and saved to data/library/, and data/library/tag-review.csv is
// written for the founder to check. Run `npm run import` first, then `npm run library`.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  addToLibrary,
  libraryId,
  Plan,
  tagReviewCsv,
  type ConversionReport,
} from '../engine/index.ts';
import { FsStore } from './fs-store.ts';

const converted = 'data/converted';
const store = new FsStore('data/library');

function reports(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? reports(join(dir, e.name))
      : e.name.endsWith('.report.json')
        ? [join(dir, e.name)]
        : [],
  );
}

const files = reports(converted);
if (!files.length) {
  console.log(`Nothing in ${converted}/. Run \`npm run import\` first.`);
  process.exit(0);
}
let added = 0;
let failed = 0;
const now = new Date().toISOString();
for (const file of files) {
  const report = JSON.parse(readFileSync(file, 'utf8')) as ConversionReport;
  const planFile = file.replace(/\.report\.json$/, '.plan.json');
  if (report.status === 'failed' || !existsSync(planFile)) {
    failed++;
    continue;
  }
  const plan = Plan.parse(JSON.parse(readFileSync(planFile, 'utf8')));
  const rel = relative(converted, planFile).replace(/\.plan\.json$/, '');
  await addToLibrary(store, {
    id: libraryId(rel),
    plan,
    status: report.status,
    now,
    source: `${rel}.dxf`,
  });
  added++;
}
const index = await store.loadIndex();
writeFileSync('data/library/tag-review.csv', tagReviewCsv(index));
const share = Math.round((added / files.length) * 100);
console.log(
  `Library: ${index.entries.length} plans (${added} added or updated now, ${failed} not converted).`,
);
console.log(`${share}% of drawings converted at least partially (target ≥ 90%).`);
console.log(
  'Review the tags in data/library/tag-review.csv, save it, then run `npm run library:review`.',
);
