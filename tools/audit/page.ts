// In-page checks for the full UX audit (skill plancraft-ux-refine §2, §5, §6). Plain JS strings:
// they run in the browser through the DevTools protocol, and the tools' TypeScript has no DOM.

const HELPERS = String.raw`
  const label = (el) => {
    if (!el || !el.tagName) return '';
    let s = el.tagName.toLowerCase();
    const cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 2);
    if (cls.length) s += '.' + cls.join('.');
    const role = el.getAttribute('role');
    if (role) s += '[role=' + role + ']';
    return s;
  };
  const nameOf = (el) => {
    const al = el.getAttribute('aria-label');
    if (al && al.trim()) return al.trim();
    const lb = el.getAttribute('aria-labelledby');
    if (lb) {
      const t = lb.split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ').trim();
      if (t) return t;
    }
    if (el.id) {
      const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (l && l.textContent.trim()) return l.textContent.trim();
    }
    const wrap = el.closest('label');
    if (wrap && wrap.textContent.trim()) return wrap.textContent.trim();
    if (el.tagName === 'IMG') return el.getAttribute('alt') || '';
    if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
      const t = (el.innerText || el.textContent || '').trim();
      if (t) return t;
    }
    const svgTitle = el.querySelector && el.querySelector('svg title');
    if (svgTitle && svgTitle.textContent.trim()) return svgTitle.textContent.trim();
    const title = el.getAttribute('title');
    if (title && title.trim()) return title.trim();
    const ph = el.getAttribute('placeholder');
    if (ph) return 'placeholder only: ' + ph;
    return '';
  };
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const INTERACTIVE = 'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=link], [role=menuitem], [role=option], [role=tab], [role=treeitem], [role=checkbox], [role=switch], [role=radio], [role=combobox], [role=row][tabindex], [tabindex]:not([tabindex="-1"])';
  const hits = (el, x, y) => {
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false;
    const t = document.elementFromPoint(x, y);
    return !!t && (t === el || el.contains(t));
  };
`;

/** Names, labels, alt text, ids, headings, landmarks, targets, truncation, text sizes, overflow. */
export const CHECKS = String.raw`(() => {
  ${HELPERS}
  const out = { unnamed: [], placeholderOnly: [], imgNoAlt: [], dupIds: [], headings: [], landmarks: {},
    tabindexPositive: [], hiddenFocusable: [], smallTargets: [], truncatedNoTitle: [], textUnder11: [],
    textUnder13: 0, textTotal: 0, overflowX: false, dialogs: [], liveRegions: 0, lang: document.documentElement.lang || '' };
  const interactive = [...document.querySelectorAll(INTERACTIVE)].filter(visible);
  const rects = interactive.map((el) => el.getBoundingClientRect());
  interactive.forEach((el, i) => {
    const n = nameOf(el);
    if (!n) out.unnamed.push(label(el) + ' @' + Math.round(rects[i].left) + ',' + Math.round(rects[i].top));
    else if (n.startsWith('placeholder only')) out.placeholderOnly.push(label(el) + ' "' + n.slice(18) + '"');
    if (parseInt(el.getAttribute('tabindex') || '0', 10) > 0) out.tabindexPositive.push(label(el));
    if (el.closest('[aria-hidden="true"]')) out.hiddenFocusable.push(label(el));
    const r = rects[i];
    if (r.width < 24 || r.height < 24) {
      const inline = el.tagName === 'A' && el.parentElement && /^(P|LI|SPAN|TD)$/.test(el.parentElement.tagName) &&
        [...el.parentElement.childNodes].some((c) => c !== el && c.nodeType === 3 && c.textContent.trim());
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const hitBox = [hits(el, cx, cy - 11.5), hits(el, cx, cy + 11.5), hits(el, cx - 11.5, cy), hits(el, cx + 11.5, cy)].every(Boolean);
      const spaced = !rects.some((o, j) => j !== i && !interactive[j].contains(el) && !el.contains(interactive[j]) &&
        o.left < cx + 12 && o.right > cx - 12 && o.top < cy + 12 && o.bottom > cy - 12);
      if (!inline && !hitBox) out.smallTargets.push({ el: label(el), name: n.slice(0, 40), size: Math.round(r.width) + 'x' + Math.round(r.height), spacingException: spaced });
    }
  });
  for (const img of document.querySelectorAll('img')) if (visible(img) && !img.hasAttribute('alt')) out.imgNoAlt.push(img.src.slice(-60));
  const ids = {};
  for (const el of document.querySelectorAll('[id]')) ids[el.id] = (ids[el.id] || 0) + 1;
  out.dupIds = Object.entries(ids).filter(([, n]) => n > 1).map(([id, n]) => id + ' ×' + n);
  out.headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible).map((h) => h.tagName + ' ' + h.textContent.trim().slice(0, 40));
  for (const sel of ['main', 'nav', 'header', 'aside', 'footer', '[role=main]', '[role=navigation]', '[role=toolbar]', '[role=tree]', '[role=grid]', '[role=table]', 'table']) {
    const n = [...document.querySelectorAll(sel)].filter(visible).length;
    if (n) out.landmarks[sel] = n;
  }
  for (const d of document.querySelectorAll('[role=dialog], dialog, [role=alertdialog]')) {
    if (!visible(d)) continue;
    out.dialogs.push({ el: label(d), modal: d.getAttribute('aria-modal') === 'true' || d.tagName === 'DIALOG', name: nameOf(d).slice(0, 40) });
  }
  out.liveRegions = document.querySelectorAll('[aria-live], [role=status], [role=alert]').length;
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    const own = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
    if (own && !(el instanceof SVGElement)) {
      out.textTotal++;
      const fs = parseFloat(cs.fontSize);
      if (fs < 13) out.textUnder13++;
      if (fs < 11) out.textUnder11.push(label(el) + ' ' + cs.fontSize + ' "' + el.textContent.trim().slice(0, 20) + '"');
    }
    if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) {
      let titled = false;
      for (let e = el, k = 0; e && k < 4; e = e.parentElement, k++) if (e.getAttribute('title') || e.getAttribute('aria-label')) titled = true;
      if (!titled) out.truncatedNoTitle.push(label(el) + ' "' + el.textContent.trim().slice(0, 30) + '"');
    }
  }
  out.overflowX = document.documentElement.scrollWidth > innerWidth + 1;
  return out;
})()`;

/** Where focus is now, and whether focusing it changes how it (or its box) looks. */
export const FOCUS = String.raw`(() => {
  ${HELPERS}
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return { body: true };
  window.__auditStops = window.__auditStops || 0;
  const repeat = el.dataset.auditStop !== undefined;
  if (!repeat) el.dataset.auditStop = String(window.__auditStops++);
  const sig = () => [el, el.parentElement, el.parentElement && el.parentElement.parentElement]
    .filter(Boolean).map((e) => { const cs = getComputedStyle(e); return [cs.outlineStyle, cs.outlineWidth, cs.outlineColor, cs.boxShadow, cs.backgroundColor, cs.borderTopColor, cs.textDecorationLine].join('|'); }).join('/');
  const focused = sig();
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const inView = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const top = inView ? document.elementFromPoint(Math.min(Math.max(cx, 0), innerWidth - 1), Math.min(Math.max(cy, 0), innerHeight - 1)) : null;
  const obscured = inView && !!top && !(top === el || el.contains(top) || top.contains(el));
  el.blur();
  const plain = sig();
  el.focus();
  return { el: label(el), repeat, stop: Number(el.dataset.auditStop), name: nameOf(el).slice(0, 40), indicator: focused !== plain, focusVisible: el.matches(':focus-visible'), obscured, inView, by: obscured ? label(top) : '' };
})()`;

/** Elements still animating when the user asks for reduced motion. */
export const MOTION = String.raw`(() => {
  ${HELPERS}
  const moving = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    const t = cs.transitionDuration.split(',').some((d) => parseFloat(d) > 0);
    const a = cs.animationName !== 'none' && parseFloat(cs.animationDuration) > 0;
    if (t || a) moving.push(label(el) + (a ? ' animation ' + cs.animationName : ' transition ' + cs.transitionDuration));
  }
  return [...new Set(moving)];
})()`;

/** Is an overlay (dialog, menu, listbox) open, and what has focus. */
export const OVERLAY = String.raw`(() => {
  ${HELPERS}
  const open = [...document.querySelectorAll('[role=dialog], [role=menu], [role=listbox], dialog[open], .pc-menu')].filter(visible).map(label);
  const a = document.activeElement;
  return { open, focus: a && a !== document.body ? label(a) + ' "' + nameOf(a).slice(0, 30) + '"' : 'body' };
})()`;
