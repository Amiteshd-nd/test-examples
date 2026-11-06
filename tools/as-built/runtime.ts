// Runtime half of the as-built style index (skill §3.6): opens each screen in headless Chrome
// through the DevTools protocol (Node's own WebSocket, no extra packages) and records the
// computed styles of every visible element, in light and dark. Needs the dev server running.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface Screen {
  name: string;
  path: string;
  /** Script run in the page after load (e.g. open the ⌘K palette). */
  action?: string;
}

/** value → count and a few sample elements, per bucket (e.g. "color:text", "padding"). */
export type Buckets = Record<string, Record<string, { n: number; s: string[] }>>;

export interface Sample {
  screen: string;
  url: string;
  theme: 'light' | 'dark';
  elements: number;
  buckets: Buckets;
}

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => existsSync(p));

export const chromeAvailable = () => CHROME !== undefined;

// Runs inside the page. Plain JS in a string: the tools' TypeScript has no DOM types.
const COLLECT = String.raw`(() => {
  const B = {};
  const add = (bucket, key, sample) => {
    if (key == null) return;
    const o = (B[bucket] ||= {});
    const e = (o[key] ||= { n: 0, s: [] });
    e.n++;
    if (e.s.length < 4 && !e.s.includes(sample)) e.s.push(sample);
  };
  const parse = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c || '');
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  };
  const hex = (c) => {
    const v = Array.isArray(c) ? c : parse(c);
    if (!v) return null;
    const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return '#' + h(v[0]) + h(v[1]) + h(v[2]) + h(v[3] * 255);
  };
  const over = (f, b) => {
    const a = f[3] + b[3] * (1 - f[3]);
    if (!a) return [0, 0, 0, 0];
    const ch = (i) => (f[i] * f[3] + b[i] * b[3] * (1 - f[3])) / a;
    return [ch(0), ch(1), ch(2), a];
  };
  const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (f, b) => { const x = lum(over(f, b)), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const label = (el) => {
    if (!el) return '';
    let s = el.tagName.toLowerCase();
    const c = el.getAttribute('class') || '';
    const cls = c.split(/\s+/).filter(Boolean).slice(0, 2);
    if (cls.length) s += '.' + cls.join('.');
    const role = el.getAttribute('role');
    if (role) s += '[role=' + role + ']';
    return s;
  };
  const backdrop = (el) => {
    const layers = [];
    let image = false;
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== 'none') image = true;
      if (cs.backdropFilter && cs.backdropFilter !== 'none') image = true;
      const c = parse(cs.backgroundColor);
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
    }
    let base = [255, 255, 255, 1];
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return { c: base, image };
  };
  const opacityChain = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; };
  const px = (v) => (v === '0px' || v === 'normal' || v === 'auto' || v == null ? null : v);
  const CONTROL = 'button, input, select, textarea, a[href], [role=button], [role=menuitem], [role=option], [role=tab], [role=treeitem], [role=checkbox], [role=switch], summary';
  let elements = 0;
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('script, style, template, defs, clipPath, mask')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    elements++;
    const L = label(el);
    const svg = el instanceof SVGElement;
    const typed = el.tagName === 'INPUT' && /^(text|search|number|email|url|tel|password)$/.test(el.type) && el.value;
    const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || typed;
    if (text && svg) {
      // Canvas labels: SVG user units scaled by the view, not screen pixels.
      add('canvas-text', cs.fontFamily.split(',')[0].replace(/["']/g, '').trim() + ' ' + cs.fontWeight, L);
    } else if (text) {
      const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
      add('color:text', hex(cs.color), L);
      add('font-family', fam, L);
      add('font-size', cs.fontSize, L);
      add('font-weight', cs.fontWeight, L);
      add('line-height', cs.lineHeight, L);
      add('letter-spacing', cs.letterSpacing, L);
      add('text-style', fam + ' ' + cs.fontSize + '/' + cs.lineHeight + ' ' + cs.fontWeight +
        (cs.letterSpacing !== 'normal' ? ' ls ' + cs.letterSpacing : '') +
        (cs.textTransform !== 'none' ? ' ' + cs.textTransform : '') +
        (cs.fontVariantNumeric !== 'normal' ? ' ' + cs.fontVariantNumeric : ''), L);
      {
        const bg = backdrop(el);
        const fg = parse(cs.color);
        const op = opacityChain(el);
        if (fg) {
          const f = [fg[0], fg[1], fg[2], fg[3] * op];
          add('pair', hex(f) + '|' + hex(bg.c) + '|' + ratio(f, bg.c).toFixed(2) + '|' + parseFloat(cs.fontSize) + '|' + cs.fontWeight + (bg.image ? '|over-image' : ''), L);
        }
      }
    }
    if (!svg) {
      const bgc = hex(cs.backgroundColor);
      if (bgc && !bgc.endsWith('00')) add('color:background', bgc, L);
      if (cs.backgroundImage !== 'none') add('background-image', cs.backgroundImage.slice(0, 200), L);
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
        const w = cs['border' + side + 'Width'];
        if (parseFloat(w) > 0 && cs['border' + side + 'Style'] !== 'none') {
          add('color:border', hex(cs['border' + side + 'Color']), L);
          add('border-width', w + ' ' + cs['border' + side + 'Style'], L);
        }
      }
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
        add('padding', px(cs['padding' + side]), L);
        add('margin', px(cs['margin' + side]), L);
      }
      if (/flex|grid/.test(cs.display)) {
        add('gap', px(cs.rowGap), L);
        if (cs.columnGap !== cs.rowGap) add('gap', px(cs.columnGap), L);
      }
      const rad = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius];
      if (rad.some((v) => parseFloat(v) > 0)) add('radius', new Set(rad).size === 1 ? rad[0] : rad.join(' '), L);
      if (cs.boxShadow !== 'none') add('shadow', cs.boxShadow, L);
      if (cs.backdropFilter && cs.backdropFilter !== 'none') add('backdrop-filter', cs.backdropFilter, L);
      if (cs.filter !== 'none') add('filter', cs.filter, L);
      if (cs.opacity !== '1') add('opacity', cs.opacity, L);
      if (cs.transitionDuration.split(',').some((d) => parseFloat(d) > 0))
        add('transition', cs.transitionProperty + ' | ' + cs.transitionDuration + ' | ' + cs.transitionTimingFunction, L);
      if (cs.animationName !== 'none') add('animation', cs.animationName + ' ' + cs.animationDuration, L);
      if (cs.zIndex !== 'auto') add('z-index', cs.zIndex, L);
      if (el.matches(CONTROL)) {
        add('control-height', Math.round(r.height) + 'px', L);
        if (r.width < 24 || r.height < 24) add('small-target', Math.round(r.width) + 'x' + Math.round(r.height), L);
      }
    } else if (el.tagName === 'svg') {
      if (r.width <= 64) add('icon-size', Math.round(r.width) + 'x' + Math.round(r.height), L + ' in ' + label(el.parentElement));
    } else if (/^(path|rect|circle|ellipse|line|polyline|polygon|text|tspan|use)$/.test(el.tagName)) {
      if (cs.fill && cs.fill !== 'none' && !cs.fill.startsWith('url')) add('color:svg-fill', hex(cs.fill), L);
      if (cs.stroke && cs.stroke !== 'none') {
        add('color:svg-stroke', hex(cs.stroke), L);
        add('stroke-width', cs.strokeWidth, L);
      }
    }
  }
  return { url: location.pathname + location.hash, theme: document.documentElement.dataset.theme || 'light', elements, buckets: B };
})()`;

type Msg = {
  id?: number;
  method?: string;
  sessionId?: string;
  result?: unknown;
  error?: { message: string };
};

export class Cdp {
  private next = 1;
  private pending = new Map<number, (m: Msg) => void>();
  private waiters: ((m: Msg) => boolean)[] = [];
  private ws: WebSocket;
  constructor(ws: WebSocket) {
    this.ws = ws;
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(String(e.data)) as Msg;
      if (m.id !== undefined) this.pending.get(m.id)?.(m);
      else this.waiters = this.waiters.filter((w) => !w(m));
    });
  }
  send<T>(method: string, params: object = {}, sessionId?: string): Promise<T> {
    const id = this.next++;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((res, rej) =>
      this.pending.set(id, (m) =>
        m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result as T),
      ),
    );
  }
  event(method: string, sessionId: string, ms: number): Promise<void> {
    return new Promise((res) => {
      const t = setTimeout(res, ms);
      this.waiters.push((m) => {
        if (m.method !== method || m.sessionId !== sessionId) return false;
        clearTimeout(t);
        res();
        return true;
      });
    });
  }
  close() {
    this.ws.close();
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run `fn` against a fresh headless Chrome (temporary profile, removed afterwards). */
export async function withChrome<T>(fn: (cdp: Cdp) => Promise<T>): Promise<T> {
  if (!CHROME) throw new Error('No Chrome or Chromium found.');
  const dir = mkdtempSync(join(tmpdir(), 'pc-as-built-'));
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${dir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--force-color-profile=srgb',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  try {
    let endpoint = '';
    for (let i = 0; i < 100 && !endpoint; i++) {
      await sleep(100);
      try {
        const [port, path] = readFileSync(join(dir, 'DevToolsActivePort'), 'utf8').split('\n');
        if (port && path) endpoint = `ws://127.0.0.1:${port}${path}`;
      } catch {
        // Chrome has not written the port file yet.
      }
    }
    if (!endpoint) throw new Error('Chrome did not open its DevTools port.');
    const ws = new WebSocket(endpoint);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res);
      ws.addEventListener('error', rej);
    });
    const cdp = new Cdp(ws);
    try {
      return await fn(cdp);
    } finally {
      cdp.close();
    }
  } finally {
    chrome.kill();
    await sleep(300);
    rmSync(dir, { recursive: true, force: true });
  }
}

export interface Page {
  session: string;
  /** Evaluate an expression in the page and return its value. */
  run: <T = unknown>(expression: string) => Promise<T>;
  close: () => Promise<void>;
}

/** Open a tab at `url` with a given viewport; waits for load plus the app's data fetches. */
export async function openPage(
  cdp: Cdp,
  url: string,
  {
    width = 1440,
    height = 900,
    scale = 1,
  }: { width?: number; height?: number; scale?: number } = {},
): Promise<Page> {
  const { targetId } = await cdp.send<{ targetId: string }>('Target.createTarget', {
    url: 'about:blank',
  });
  const { sessionId: s } = await cdp.send<{ sessionId: string }>('Target.attachToTarget', {
    targetId,
    flatten: true,
  });
  await cdp.send(
    'Emulation.setDeviceMetricsOverride',
    { width, height, deviceScaleFactor: scale, mobile: false },
    s,
  );
  await cdp.send('Page.enable', {}, s);
  const loaded = cdp.event('Page.loadEventFired', s, 15000);
  await cdp.send('Page.navigate', { url }, s);
  await loaded;
  await sleep(1500); // the Vault and editor fetch their data after load
  return {
    session: s,
    run: async <T>(expression: string) =>
      (
        await cdp.send<{ result: { value: T } }>(
          'Runtime.evaluate',
          { expression, returnByValue: true, awaitPromise: true },
          s,
        )
      ).result.value,
    close: async () => {
      await cdp.send('Target.closeTarget', { targetId });
    },
  };
}

/** Sample every screen in both themes. Theme is switched with `data-theme` on <html>. */
export async function sampleScreens(base: string, screens: Screen[]): Promise<Sample[]> {
  return withChrome(async (cdp) => {
    const out: Sample[] = [];
    for (const screen of screens) {
      for (const theme of ['light', 'dark'] as const) {
        const page = await openPage(cdp, base + screen.path);
        await page.run(`document.documentElement.dataset.theme = '${theme}'`);
        if (screen.action) {
          await page.run(screen.action);
          await sleep(500);
        }
        await sleep(800); // let colour transitions finish
        const v = await page.run<Omit<Sample, 'screen'>>(COLLECT);
        out.push({ screen: screen.name, ...v, theme });
        await page.close();
      }
    }
    return out;
  });
}
