// Colour maths for the as-built style index (skill plancraft-ux-refine §3.6): parsing CSS colours
// to #rrggbbaa, srgb color-mix(), WCAG contrast, CIEDE2000 colour difference and hue families.

export type Rgba = [r: number, g: number, b: number, a: number]; // r, g, b 0–255; a 0–1

const NAMED: Record<string, Rgba> = {
  transparent: [0, 0, 0, 0],
  white: [255, 255, 255, 1],
  black: [0, 0, 0, 1],
};

/** A CSS colour (hex, rgb()/rgba(), a few names) → channels, or null. */
export function parseColour(text: string): Rgba | null {
  const s = text.trim().toLowerCase();
  if (s in NAMED) return [...NAMED[s]!];
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let h = m[1]!;
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  m = /^rgba?\(([^)]*)\)$/.exec(s);
  if (m) {
    const parts = m[1]!.split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const ch = (p: string) => (p.endsWith('%') ? (parseFloat(p) * 255) / 100 : parseFloat(p));
    const a =
      parts[3] === undefined
        ? 1
        : parts[3].endsWith('%')
          ? parseFloat(parts[3]) / 100
          : parseFloat(parts[3]);
    return [ch(parts[0]!), ch(parts[1]!), ch(parts[2]!), a];
  }
  return null;
}

/** Channels → lowercase #rrggbbaa. */
export function toHex8([r, g, b, a]: Rgba): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}${h(a * 255)}`;
}

/** #rrggbbaa → #rrggbb when opaque, for display. */
export function shortHex(hex8: string): string {
  return hex8.endsWith('ff') ? hex8.slice(0, 7) : hex8;
}

/** CSS `color-mix(in srgb, a p%, b)` with premultiplied alpha, as browsers do. */
export function mixSrgb(a: Rgba, pa: number, b: Rgba): Rgba {
  const pb = 1 - pa;
  const alpha = a[3] * pa + b[3] * pb;
  if (alpha === 0) return [0, 0, 0, 0];
  const ch = (i: 0 | 1 | 2) => (a[i] * a[3] * pa + b[i] * b[3] * pb) / alpha;
  return [ch(0), ch(1), ch(2), alpha];
}

/** `fg` painted over `bg` (source-over). */
export function over(fg: Rgba, bg: Rgba): Rgba {
  const a = fg[3] + bg[3] * (1 - fg[3]);
  if (a === 0) return [0, 0, 0, 0];
  const ch = (i: 0 | 1 | 2) => (fg[i] * fg[3] + bg[i] * bg[3] * (1 - fg[3])) / a;
  return [ch(0), ch(1), ch(2), a];
}

function linear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance([r, g, b]: Rgba): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG 2 contrast ratio of `fg` (composited over `bg`) against an opaque `bg`. */
export function contrast(fg: Rgba, bg: Rgba): number {
  const f = luminance(over(fg, bg));
  const b = luminance(bg);
  return (Math.max(f, b) + 0.05) / (Math.min(f, b) + 0.05);
}

export function toLab([r, g, b]: Rgba): [number, number, number] {
  const [R, G, B] = [linear(r), linear(g), linear(b)];
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 / 116) * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => ((r * 180) / Math.PI + 360) % 360;

/** CIEDE2000 colour difference between two Lab colours (< 2 ≈ hard to tell apart). */
export function deltaE2000(
  [L1, a1, b1]: [number, number, number],
  [L2, a2, b2]: [number, number, number],
): number {
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = C1p === 0 ? 0 : deg(Math.atan2(b1, a1p));
  const h2p = C2p === 0 ? 0 : deg(Math.atan2(b2, a2p));
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp / 2));
  const Lpm = (L1 + L2) / 2;
  const Cpm = (C1p + C2p) / 2;
  let hpm = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hpm += h1p + h2p < 360 ? 360 : -360;
    hpm /= 2;
  }
  const T =
    1 -
    0.17 * Math.cos(rad(hpm - 30)) +
    0.24 * Math.cos(rad(2 * hpm)) +
    0.32 * Math.cos(rad(3 * hpm + 6)) -
    0.2 * Math.cos(rad(4 * hpm - 63));
  const dTheta = 30 * Math.exp(-(((hpm - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lpm - 50) ** 2) / Math.sqrt(20 + (Lpm - 50) ** 2);
  const Sc = 1 + 0.045 * Cpm;
  const Sh = 1 + 0.015 * Cpm * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh),
  );
}

/** Hue family for grouping: neutral when nearly grey, else by Lab hue angle. */
export function family(c: Rgba): string {
  const [, a, b] = toLab(c);
  if (Math.hypot(a, b) < 10) return 'neutral';
  const h = deg(Math.atan2(b, a)); // Lab hue: red ≈ 40, amber ≈ 74, green ≈ 136, blue ≈ 250–300
  if (h < 15 || h >= 320) return 'pink';
  if (h < 45) return 'red';
  if (h < 65) return 'orange';
  if (h < 110) return 'amber';
  if (h < 175) return 'green';
  if (h < 240) return 'teal';
  if (h < 303) return 'blue';
  return 'purple';
}
