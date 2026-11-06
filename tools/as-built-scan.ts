// As-built style index (skill plancraft-ux-refine §3.6): documents the design system the code
// already has — colours, type, spacing and the other scales — before any token work.
//   node tools/as-built-scan.ts             static scan + runtime sample (dev server on :5173, Chrome)
//   node tools/as-built-scan.ts --static    static scan only
//   node tools/as-built-scan.ts --report    redraw the report and sheet from the saved as-built.json
//                                            (e.g. after editing proposed-scales.json)
// Writes design/tokens/as-built.json, as-built-sheet.html and the generated part of
// AS-BUILT-INDEX.md (between its GENERATED markers; the rest of that file is written by hand).
// Then run Prettier on the two generated files.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { analyse, type Index } from './as-built/analyse.ts';
import { chromeAvailable, sampleScreens, type Sample, type Screen } from './as-built/runtime.ts';
import { writeMarkdown, writeSheet } from './as-built/report.ts';
import { readSources } from './as-built/static.ts';

const root = process.cwd();
const out = 'design/tokens';
const base = process.env.AS_BUILT_BASE ?? 'http://localhost:5173';

const SCREENS: Screen[] = [
  { name: 'vault-home', path: '/#/' },
  {
    name: 'vault-palette',
    path: '/#/',
    action: `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))`,
  },
  {
    name: 'vault-new-menu',
    path: '/#/',
    action: `[...document.querySelectorAll('button')].find((b) => /^\\+?\\s*New\\b/.test(b.textContent.trim()))?.click()`,
  },
  { name: 'vault-library', path: '/#/library' },
  { name: 'editor', path: '/#/library/synthetic-grid-4x3-typical' },
  { name: 'styleguide', path: '/styleguide.html' },
  { name: 'vault-components', path: '/vault.html' },
];

if (process.argv.includes('--report')) {
  const index = JSON.parse(readFileSync(`${out}/as-built.json`, 'utf8')) as Index;
  writeMarkdown(`${out}/AS-BUILT-INDEX.md`, index);
  writeSheet(`${out}/as-built-sheet.html`, index, `${out}/proposed-scales.json`);
  console.log(`Redrew the report and sheet from ${out}/as-built.json (${index.generated}).`);
} else {
  const { decls, rules, files } = readSources(root);
  let samples: Sample[] = [];
  if (!process.argv.includes('--static')) {
    if (!chromeAvailable()) console.warn('No Chrome found: static scan only.');
    else samples = await sampleScreens(base, SCREENS);
  }
  const index = analyse(decls, rules, files, samples);
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/as-built.json`, JSON.stringify(index, null, 2) + '\n');
  writeMarkdown(`${out}/AS-BUILT-INDEX.md`, index);
  writeSheet(`${out}/as-built-sheet.html`, index, `${out}/proposed-scales.json`);
  console.log(
    `As-built index: ${files.length} files, ${decls.length} declarations, ${samples.length} screen samples, ${index.colours.length} colours → ${out}/`,
  );
}
