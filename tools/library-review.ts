// Applies the founder's corrections from data/library/tag-review.csv (P1.4 🛑).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { applyTagReview, tagReviewCsv } from '../engine/index.ts';
import { FsStore } from './fs-store.ts';

const file = process.argv[2] ?? 'data/library/tag-review.csv';
if (!existsSync(file)) {
  console.log(`No ${file}. Run \`npm run library\` first.`);
  process.exit(1);
}
const store = new FsStore('data/library');
const result = await applyTagReview(store, readFileSync(file, 'utf8'));
for (const c of result.changes) console.log(`updated  ${c}`);
for (const e of result.errors) console.log(`problem  ${e}`);
if (!result.changes.length && !result.errors.length) console.log('No changes.');
writeFileSync('data/library/tag-review.csv', tagReviewCsv(await store.loadIndex()));
