// Full UX audit runner (skill plancraft-ux-refine §2 steps 1, 4, 6): screenshots of every screen
// (light and dark at 1440 px, light at 1280 px and at 200 % zoom, forced colours), in-page
// accessibility checks, a scripted keyboard sweep, Esc on overlays, reduced motion, and the
// static state matrix. Read-only: it opens menus and dialogs but never confirms or edits.
//   node tools/audit-run.ts [out-dir]      (dev server on :5173, Chrome)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { format } from 'prettier';
import { openPage, sleep, withChrome, type Cdp, type Page } from './as-built/runtime.ts';
import { readSources } from './as-built/static.ts';
import { CHECKS, FOCUS, MOTION, OVERLAY } from './audit/page.ts';
import { hoverOnly, stateMatrix } from './audit/static.ts';

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith('--')) ?? 'design/audits/2026-11-06-full';
/** `--only=editor,vault-help`: re-run those screens and update the existing audit.json. */
const only = args
  .find((a) => a.startsWith('--only='))
  ?.slice(7)
  .split(',');
const shots = join(out, 'screens');
const base = process.env.AUDIT_BASE ?? 'http://localhost:5173';
mkdirSync(shots, { recursive: true });
writeFileSync(
  join(shots, '.gitignore'),
  '# Screenshots stay local (large); regenerate with tools/audit-run.ts\n*\n!.gitignore\n',
);

const index = JSON.parse(readFileSync('data/vault/index.json', 'utf8')) as {
  folders: Record<string, { id: string; name: string; parentId?: string; archived?: boolean }>;
};
const folder =
  Object.values(index.folders).find((f) => !f.parentId && !f.archived) ??
  Object.values(index.folders)[0];

type Key = { key: string; code: string; vk: number; modifiers?: number; text?: string };
const TAB: Key = { key: 'Tab', code: 'Tab', vk: 9 };
const ESC: Key = { key: 'Escape', code: 'Escape', vk: 27 };
const ENTER: Key = { key: 'Enter', code: 'Enter', vk: 13, text: '\r' };
const press = async (cdp: Cdp, p: Page, k: Key) => {
  const base = {
    key: k.key,
    code: k.code,
    windowsVirtualKeyCode: k.vk,
    modifiers: k.modifiers ?? 0,
  };
  // A keyDown with text is what makes Enter activate a focused button.
  await cdp.send(
    'Input.dispatchKeyEvent',
    { type: 'keyDown', ...base, ...(k.text ? { text: k.text, unmodifiedText: k.text } : {}) },
    p.session,
  );
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base }, p.session);
};
const findButton = (text: string) =>
  `[...document.querySelectorAll('button, a')].find((b) => b.textContent.trim().replace(/\\s+/g, ' ').match(${text}))`;
/** Open like a keyboard user: focus the button, press Enter (so focus return can be checked). */
const keyboardOpen = (text: string) => async (cdp: Cdp, p: Page) => {
  const found = await p.run(
    `(() => { const b = ${findButton(text)}; if (b) b.focus(); return !!b; })()`,
  );
  await press(cdp, p, ENTER);
  return found ? 'focused + Enter' : 'button not found';
};

interface Screen {
  name: string;
  path: string;
  main?: boolean;
  overlay?: boolean;
  open?: (cdp: Cdp, p: Page) => Promise<unknown>;
}
const SCREENS: Screen[] = [
  { name: 'vault-home', path: '/#/', main: true },
  { name: 'vault-folder', path: `/#/folder/${folder?.id ?? ''}`, main: true },
  { name: 'vault-search', path: '/#/search?q=plan', main: true },
  { name: 'vault-starred', path: '/#/starred' },
  { name: 'vault-trash', path: '/#/trash' },
  { name: 'vault-library', path: '/#/library', main: true },
  { name: 'vault-ask', path: '/#/ask' },
  { name: 'vault-templates', path: '/#/templates' },
  {
    name: 'vault-palette',
    path: '/#/',
    overlay: true,
    open: (c, p) => press(c, p, { key: 'k', code: 'KeyK', vk: 75, modifiers: 4 }),
  },
  {
    name: 'vault-new-menu',
    path: '/#/',
    overlay: true,
    open: keyboardOpen('/^\\+?\\s*New$/'),
  },
  {
    name: 'vault-context-menu',
    path: `/#/folder/${folder?.id ?? ''}`,
    overlay: true,
    open: (_, p) =>
      p.run(
        `(() => { const t = document.querySelector('.vlt-card, .ftile, .vlt-table tbody tr'); if (!t) return 'none'; t.focus(); const r = t.getBoundingClientRect(); t.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.top + 20 })); return 'ok'; })()`,
      ),
  },
  {
    name: 'vault-new-folder',
    path: '/#/',
    overlay: true,
    open: (c, p) => press(c, p, { key: 'N', code: 'KeyN', vk: 78, modifiers: 8 }),
  },
  { name: 'vault-help', path: '/#/', overlay: true, open: keyboardOpen('/^Help$/') },
  { name: 'editor', path: '/#/library/synthetic-grid-4x3-typical', main: true },
  {
    name: 'editor-palette',
    path: '/#/library/synthetic-grid-4x3-typical',
    overlay: true,
    open: (c, p) => press(c, p, { key: 'k', code: 'KeyK', vk: 75, modifiers: 4 }),
  },
  { name: 'styleguide', path: '/styleguide.html', main: true },
  { name: 'vault-components', path: '/vault.html', main: true },
];

const shot = async (cdp: Cdp, p: Page, file: string) => {
  const { data } = await cdp.send<{ data: string }>(
    'Page.captureScreenshot',
    { format: 'jpeg', quality: 60 },
    p.session,
  );
  writeFileSync(join(shots, file), Buffer.from(data, 'base64'));
  return `screens/${file}`;
};

async function sweep(cdp: Cdp, p: Page, steps: number) {
  const seen: {
    el: string;
    name: string;
    indicator: boolean;
    focusVisible: boolean;
    obscured: boolean;
    inView: boolean;
    by: string;
    body?: boolean;
    repeat?: boolean;
    stop?: number;
  }[] = [];
  for (let i = 0; i < steps; i++) {
    await press(cdp, p, TAB);
    await sleep(60);
    const f = await p.run<(typeof seen)[number]>(FOCUS);
    if (f.repeat) break; // wrapped around to an element already visited
    seen.push(f);
  }
  return seen;
}

const previous = only
  ? (JSON.parse(readFileSync(join(out, 'audit.json'), 'utf8')) as {
      screens: Record<string, unknown>;
    })
  : undefined;
const report: Record<string, unknown> = {
  generated: new Date().toISOString(),
  base,
  folder: folder?.name,
  screens: previous?.screens ?? {},
};
await withChrome(async (cdp) => {
  for (const s of SCREENS.filter((x) => !only || only.includes(x.name))) {
    const r: Record<string, unknown> = { path: s.path };
    for (const theme of ['light', 'dark'] as const) {
      const p = await openPage(cdp, base + s.path);
      await p.run(`document.documentElement.dataset.theme = '${theme}'`);
      if (s.open) {
        r.opened = await s.open(cdp, p);
        await sleep(500);
      }
      await sleep(800);
      r[`shot-${theme}`] = await shot(cdp, p, `${s.name}-${theme}-1440.jpg`);
      r[`checks-${theme}`] = await p.run(CHECKS);
      if (theme === 'light') {
        if (s.overlay) {
          r.overlayBefore = await p.run(OVERLAY);
          r.focusInOverlay = await sweep(cdp, p, 16);
          await press(cdp, p, ESC);
          await sleep(300);
          r.afterEsc = await p.run(OVERLAY);
        } else {
          await p.run('document.activeElement && document.activeElement.blur()');
          r.keyboard = await sweep(cdp, p, 80);
        }
        if (s.main) {
          await cdp.send(
            'Emulation.setEmulatedMedia',
            { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] },
            p.session,
          );
          await sleep(300);
          r.reducedMotion = await p.run(MOTION);
          await cdp.send(
            'Emulation.setEmulatedMedia',
            { features: [{ name: 'forced-colors', value: 'active' }] },
            p.session,
          );
          await sleep(300);
          r['shot-forced-colors'] = await shot(cdp, p, `${s.name}-forced-colors.jpg`);
        }
      }
      await p.close();
    }
    if (s.main) {
      for (const [label, opts] of [
        ['1280', { width: 1280, height: 800 }],
        ['zoom200', { width: 720, height: 450, scale: 2 }],
      ] as const) {
        const p = await openPage(cdp, base + s.path, opts);
        await p.run(`document.documentElement.dataset.theme = 'light'`);
        await sleep(800);
        r[`shot-${label}`] = await shot(cdp, p, `${s.name}-light-${label}.jpg`);
        r[`overflow-${label}`] = await p.run(
          'document.documentElement.scrollWidth > innerWidth + 1',
        );
        r[`checks-${label}`] = await p.run(CHECKS);
        await p.close();
      }
    }
    (report.screens as Record<string, unknown>)[s.name] = r;
    console.log(`audited ${s.name}`);
  }
});

const { decls } = readSources(process.cwd());
report.stateMatrix = stateMatrix(decls);
report.hoverOnly = hoverOnly(decls);
writeFileSync(join(out, 'audit.json'), JSON.stringify(report, null, 2) + '\n');
const imgs = Object.entries(report.screens as Record<string, Record<string, unknown>>).flatMap(
  ([name, r]) =>
    Object.entries(r)
      .filter(([k]) => k.startsWith('shot-'))
      .map(
        ([k, v]) =>
          `<figure><img src="${String(v).replace('screens/', '')}" loading="lazy" alt="${name} ${k.slice(5)}" /><figcaption>${name} · ${k.slice(5)}</figcaption></figure>`,
      ),
);
// Formatted, so `npm run check` (Prettier) passes even though the screens folder is git-ignored.
writeFileSync(
  join(shots, 'index.html'),
  await format(
    `<!doctype html><html lang="en"><meta charset="utf-8" /><title>Audit screenshots</title><style>body{font:13px system-ui;margin:16px;background:#f2f2f4}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:16px}figure{margin:0;background:#fff;padding:8px;border-radius:4px}img{width:100%;display:block;border:1px solid #ddd}</style><main>${imgs.join('')}</main></html>\n`,
    { parser: 'html' },
  ),
);
console.log(`Audit written to ${out}/audit.json and ${shots}/`);
