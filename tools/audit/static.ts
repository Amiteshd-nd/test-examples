// Static half of the full UX audit (skill §5): which interaction states each component's CSS
// defines, and things revealed only on hover (they must also show on focus or selection).
import { splitTop, type Decl } from '../as-built/static.ts';

const STATES: [string, RegExp][] = [
  ['hover', /:hover/],
  ['focus', /:focus(-visible|-within)?\b/],
  ['pressed', /:active|\[aria-pressed/],
  ['selected', /\[aria-(selected|current|checked)|\.is-(selected|active)|--active\b/],
  ['disabled', /:disabled|\[aria-disabled|\[disabled/],
  ['drag', /is-drag|dragover|drop/],
  ['error', /--error|\[aria-invalid|:invalid/],
];

/** Component (first class in the selector) → states its CSS styles. */
export function stateMatrix(decls: Decl[]): Record<string, string[]> {
  const out: Record<string, Set<string>> = {};
  for (const d of decls) {
    if (d.source !== 'css') continue;
    for (const sel of splitTop(d.selector, ',')) {
      const last =
        sel
          .trim()
          .split(/\s+|>|\+|~/)
          .filter(Boolean)
          .at(-1) ?? '';
      const cls = /\.([a-z][\w-]*?)(?:--[\w-]+)?(?=[:.[]|$)/.exec(last)?.[1];
      if (!cls || !/^(pc|vlt|ftile|ed|sg)-?/.test(cls)) continue;
      const set = (out[cls] ??= new Set());
      for (const [name, re] of STATES) if (re.test(sel)) set.add(name);
    }
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v]]));
}

/** Rules that reveal something on hover (opacity / visibility / display) with no focus twin. */
export function hoverOnly(
  decls: Decl[],
): { at: string; selector: string; prop: string; value: string }[] {
  const reveal = (d: Decl) =>
    (d.prop === 'opacity' && parseFloat(d.value) > 0) ||
    (d.prop === 'visibility' && d.value === 'visible') ||
    (d.prop === 'display' && d.value !== 'none');
  const css = decls.filter((d) => d.source === 'css' && reveal(d));
  return css
    .filter((d) => d.selector.includes(':hover'))
    .filter((d) => {
      const twins = css.filter(
        (o) =>
          o.prop === d.prop &&
          o.value === d.value &&
          /:focus|aria-selected|is-selected|is-hover|:focus-within/.test(o.selector),
      );
      return !twins.length && !/:focus|:focus-within/.test(d.selector);
    })
    .map((d) => ({
      at: `${d.file}:${d.line}`,
      selector: d.selector,
      prop: d.prop,
      value: d.value,
    }));
}
