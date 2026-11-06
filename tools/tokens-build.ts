// `npm run tokens`: design/tokens/*.json → frontend/src/design/tokens.css (CSS variables),
// frontend/src/design/tokens.ts (typed values for canvas code), design/tokens/tokens.html (sheet)
// and design/tokens/TOKEN-INDEX.md (skill plancraft-ux-refine §3.3, §3.7). Stops on any error.
import { writeFileSync } from 'node:fs';
import { format, resolveConfig } from 'prettier';
import { readSources } from './as-built/static.ts';
import { buildCss, buildTs, loadTokenSystem, validate } from './tokens/build.ts';
import { lintRepo } from './tokens/lint.ts';
import { rawValues, scanUsage, tokenIndex, tokenSheet } from './tokens/report.ts';

const root = process.cwd();
const sys = loadTokenSystem(`${root}/design/tokens`);
const errors = validate(sys);
if (errors.length) {
  console.error(`Token errors:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

const pretty = async (path: string, text: string) =>
  writeFileSync(path, await format(text, { ...(await resolveConfig(path)), filepath: path }));

const generated = new Date().toISOString();
await pretty('frontend/src/design/tokens.css', buildCss(sys));
await pretty('frontend/src/design/tokens.ts', buildTs(sys));
await pretty('design/tokens/tokens.html', tokenSheet(sys, generated));

const { decls, files } = readSources(root);
const usageFiles = files.filter(
  (f) => f.startsWith('frontend/') && !/design\/tokens\.(css|ts)$/.test(f),
);
const lint = lintRepo(root);
writeFileSync(
  'design/tokens/TOKEN-INDEX.md',
  tokenIndex(sys, scanUsage(usageFiles, root), rawValues(decls), generated) +
    `\n## Token lint (\`npm test\`, rules in tools/tokens/lint.ts)\n\n` +
    `${lint.left.length ? `**${lint.left.length} violations** — run \`npm test\` for details.` : 'No violations.'} ` +
    `Exceptions with reasons: \`design/tokens/lint-allow.json\`` +
    (lint.unused.length
      ? `; no longer needed (remove): ${lint.unused.map((r) => `${r.file} ${r.value ?? r.selector ?? ''}`).join('; ')}.\n`
      : '; all still needed.\n'),
);
console.log(
  `Tokens: ${sys.shared.size + sys.light.size} (${sys.light.size} themed) → tokens.css, tokens.ts, tokens.html, TOKEN-INDEX.md`,
);
