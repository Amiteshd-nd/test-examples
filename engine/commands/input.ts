import { roundCm, type Point } from '../schema/primitives.ts';

// Precision input while drawing (A2 M5): architects draw by numbers. While a tool waits for its
// next point, the user can type it instead of clicking:
//   450 ↵          450 cm along the direction the cursor points (4.5 m)
//   4.5m, 450cm, 4500mm, 15'6", 15', 6"   the same with units (a bare number is cm)
//   450<90         450 cm at 90° (anticlockwise from east) from the last point
//   @120,-30       120 cm right and 30 cm down from the last point
//   300,450        an absolute point
// Results are on the 1 mm grid.

const NUM = String.raw`-?\d+(?:\.\d+)?`;
const METRIC = new RegExp(`^(${NUM})\\s*(mm|cm|m)?$`, 'i');
const FEET = new RegExp(`^(${NUM})'\\s*(?:(\\d+(?:\\.\\d+)?)\\s*(?:"|in)?)?$`, 'i');
const INCHES = new RegExp(`^(${NUM})\\s*(?:"|in)$`, 'i');
const UNIT_CM = { mm: 0.1, cm: 1, m: 100 } as const;

/** A typed length in cm, or null when it isn't one. */
export function parseLength(text: string): number | null {
  const t = text.trim();
  let m = METRIC.exec(t);
  if (m)
    return roundCm(Number(m[1]) * UNIT_CM[(m[2]?.toLowerCase() ?? 'cm') as keyof typeof UNIT_CM]);
  m = FEET.exec(t);
  if (m) {
    const feet = Number(m[1]);
    const inches = Number(m[2] ?? 0) * Math.sign(feet || 1);
    return roundCm(feet * 30.48 + inches * 2.54);
  }
  m = INCHES.exec(t);
  if (m) return roundCm(Number(m[1]) * 2.54);
  return null;
}

export type PointInput = { ok: true; point: Point } | { ok: false; message: string };

const at = (p: Point, len: number, deg: number): Point => {
  const r = (deg * Math.PI) / 180;
  return [roundCm(p[0] + len * Math.cos(r)), roundCm(p[1] + len * Math.sin(r))];
};
const bad = (message: string): PointInput => ({ ok: false, message });

/**
 * The point a typed entry means. `last` is the point drawn from (null for a first point);
 * `toward` is where the cursor is, which gives the direction of a bare length.
 */
export function typedPoint(
  text: string,
  ctx: { last: Point | null; toward: Point | null },
): PointInput {
  const t = text.trim();
  if (!t) return bad('Type a length (e.g. 450 or 4.5m), a point (x,y) or @dx,dy.');
  const relative = t.startsWith('@');
  const body = relative ? t.slice(1).trim() : t;
  const needLast = () => bad('Pick or type the first point before a length or a relative point.');

  if (body.includes('<')) {
    const [lenText, angText] = body.split('<');
    const len = parseLength(lenText ?? '');
    const ang = Number(angText);
    if (len === null || !Number.isFinite(ang) || angText?.trim() === '')
      return bad(`"${t}" is not a length and angle; write it as 450<90.`);
    if (!ctx.last) return needLast();
    return { ok: true, point: at(ctx.last, len, ang) };
  }
  if (body.includes(',')) {
    const [xs, ys, extra] = body.split(',');
    const x = parseLength(xs ?? '');
    const y = parseLength(ys ?? '');
    if (x === null || y === null || extra !== undefined)
      return bad(`"${t}" is not a point; write it as x,y (e.g. 300,450) or @dx,dy.`);
    if (!relative) return { ok: true, point: [x, y] };
    if (!ctx.last) return needLast();
    return { ok: true, point: [roundCm(ctx.last[0] + x), roundCm(ctx.last[1] + y)] };
  }
  const len = parseLength(body);
  if (len === null) return bad(`"${t}" is not a length; type e.g. 450, 4.5m or 15'6".`);
  if (!ctx.last) return needLast();
  const to = ctx.toward;
  if (!to || (to[0] === ctx.last[0] && to[1] === ctx.last[1]))
    return bad('Point the cursor in the direction to draw, then type the length.');
  const deg = (Math.atan2(to[1] - ctx.last[1], to[0] - ctx.last[0]) * 180) / Math.PI;
  return { ok: true, point: at(ctx.last, len, deg) };
}
