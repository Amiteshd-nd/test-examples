// px → tokens / rem for the UI scale setting (DS-03): sizes that should grow with Settings → Text
// size are rewritten as tokens when on the scale (8px → var(--pc-space-200), 13px font →
// var(--pc-font-size-300)) and as rem otherwise (18px → 1.125rem). Hairlines (0, ±1px), borders,
// outlines, shadows, radii, filters, backgrounds and @media conditions stay in px.
//   node tools/tokens/rem-codemod.ts <file.css> [more.css …]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pxToRem } from './build.ts';

/** Properties whose lengths follow the UI scale. */
export const SCALABLE =
  /^(font-size|line-height|letter-spacing|text-indent|text-underline-offset|(padding|margin|inset|scroll-margin|scroll-padding)(-[a-z-]+)?|gap|row-gap|column-gap|(min-|max-)?(width|height)|flex|flex-basis|top|right|bottom|left|grid-template-(columns|rows)|grid-auto-(columns|rows)|transform|translate)$/;
const SPACING = /^(padding|margin|gap|row-gap|column-gap|inset)/;
const PX = /(?<![\w.#-])(-?\d*\.?\d+)px\b/g;

export const isHairline = (px: number) => px === 0 || Math.abs(px) === 1;

export interface ScaleMaps {
  space: Map<number, string>;
  fontSize: Map<number, string>;
  lineHeight: Map<number, string>;
}

export function readScaleMaps(root: string): ScaleMaps {
  const json = (p: string) =>
    JSON.parse(readFileSync(join(root, p), 'utf8')) as Record<string, Record<string, unknown>>;
  const map = (group: Record<string, unknown>) =>
    new Map(
      Object.entries(group)
        .filter(([k]) => !k.startsWith('$'))
        .map(([k, v]) => [parseFloat(String((v as { $value: string }).$value)), k] as const),
    );
  const font = json('design/tokens/base/type.json').font!;
  return {
    space: map(json('design/tokens/base/space.json').space!),
    fontSize: map(font.size as Record<string, unknown>),
    lineHeight: map(font['line-height'] as Record<string, unknown>),
  };
}

/** One declaration's value, converted. Values that are already tokens or rem are left alone. */
export function convertValue(prop: string, value: string, scales: ScaleMaps): string {
  if (!SCALABLE.test(prop)) return value;
  const whole = /^(\d*\.?\d+)px$/.exec(value.trim());
  if (whole && prop === 'font-size' && scales.fontSize.has(parseFloat(whole[1]!))) {
    return `var(--pc-font-size-${scales.fontSize.get(parseFloat(whole[1]!))})`;
  }
  if (whole && prop === 'line-height' && scales.lineHeight.has(parseFloat(whole[1]!))) {
    return `var(--pc-font-line-height-${scales.lineHeight.get(parseFloat(whole[1]!))})`;
  }
  const one = (m: string, n: string) => {
    const px = parseFloat(n);
    if (isHairline(px)) return m;
    if (SPACING.test(prop) && px > 0 && scales.space.has(px))
      return `var(--pc-space-${scales.space.get(px)})`;
    return pxToRem(px);
  };
  if (prop === 'transform') {
    return value.replace(/translate[XYZ3d]*\([^()]*\)/g, (t) => t.replace(PX, one));
  }
  return value.replace(PX, one);
}

/** Convert every scalable declaration in a stylesheet, keeping its formatting. */
export function convertCss(css: string, scales: ScaleMaps): { css: string; changes: number } {
  let changes = 0;
  const out = css.replace(
    /(^|[;{\s])([a-z-]+)(\s*:\s*)([^;{}]+?)(\s*(?:!important)?\s*;)/gm,
    (all, pre: string, prop: string, colon: string, value: string, end: string) => {
      const next = convertValue(prop, value, scales);
      if (next === value) return all;
      changes++;
      return `${pre}${prop}${colon}${next}${end}`;
    },
  );
  return { css: out, changes };
}

if (import.meta.main) {
  const scales = readScaleMaps(process.cwd());
  for (const file of process.argv.slice(2)) {
    const { css, changes } = convertCss(readFileSync(file, 'utf8'), scales);
    writeFileSync(file, css);
    console.log(`${file}: ${changes} declarations converted`);
  }
}
