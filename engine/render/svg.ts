import type { DerivedRoom } from '../rooms/derive.ts';
import { firstLevel, values } from '../schema/collections.ts';
import type { Plan, Wall } from '../schema/plan.ts';
import type { Point } from '../schema/primitives.ts';
import { roomTypeLabel } from '../schema/room-types.ts';

// SVG preview of a plan (P1.2 task 5): for checking imports by eye, with the source drawing's
// lines underneath. Plan y points north (up); SVG y points down, so y is flipped. Lengths in cm.

export interface SvgOptions {
  rooms?: DerivedRoom[];
  /** Source drawing lines (cm), drawn faintly underneath. */
  underlay?: [Point, Point][];
  title?: string;
  /** Output width in px; height follows the plan's shape. */
  width?: number;
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const f = (n: number) => String(Math.round(n * 10) / 10);

function wallCorners(w: Wall, from = 0, to?: number): Point[] {
  const dx = w.end[0] - w.start[0];
  const dy = w.end[1] - w.start[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const h = w.thickness / 2;
  const a: Point = [w.start[0] + ux * from, w.start[1] + uy * from];
  const b: Point = [w.start[0] + ux * (to ?? len), w.start[1] + uy * (to ?? len)];
  return [
    [a[0] - uy * h, a[1] + ux * h],
    [b[0] - uy * h, b[1] + ux * h],
    [b[0] + uy * h, b[1] - ux * h],
    [a[0] + uy * h, a[1] - ux * h],
  ];
}

export function renderPlanSvg(plan: Plan, options: SvgOptions = {}): string {
  const level = firstLevel(plan);
  const all: Point[] = [
    ...plan.plot.polygon,
    ...values(level.walls).flatMap((w) => [w.start, w.end]),
    ...(options.underlay ?? []).flat(),
  ];
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const margin = 60;
  const minX = Math.min(...xs) - margin;
  const maxX = Math.max(...xs) + margin;
  const minY = Math.min(...ys) - margin;
  const maxY = Math.max(...ys) + margin;
  const pt = ([x, y]: Point) => `${f(x)},${f(maxY - y + minY)}`;
  const poly = (pts: Point[]) => pts.map(pt).join(' ');
  const width = options.width ?? 1000;
  const height = Math.round((width * (maxY - minY)) / (maxX - minX));
  const text = (p: Point, s: string, size: number, extra = '') =>
    `<text x="${pt(p).split(',')[0]}" y="${pt(p).split(',')[1]}" font-size="${size}" text-anchor="middle" ${extra}>${esc(s)}</text>`;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(minX)} ${f(minY)} ${f(maxX - minX)} ${f(maxY - minY)}" width="${width}" height="${height}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">`,
    `<rect x="${f(minX)}" y="${f(minY)}" width="${f(maxX - minX)}" height="${f(maxY - minY)}" fill="#ffffff"/>`,
  );
  if (options.underlay?.length) {
    const d = options.underlay.map(([a, b]) => `M${pt(a)}L${pt(b)}`).join('');
    parts.push(
      `<path d="${d}" stroke="#b8b8b8" stroke-width="1" vector-effect="non-scaling-stroke" fill="none"/>`,
    );
  }
  parts.push(
    `<polygon points="${poly(plan.plot.polygon)}" fill="none" stroke="#555" stroke-dasharray="12 6" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`,
  );
  for (const r of options.rooms ?? []) {
    const d = [r.outer, ...r.holes].map((ring) => `M${ring.map(pt).join('L')}Z`).join('');
    parts.push(`<path d="${d}" fill="#4f5bff" fill-opacity="0.10" fill-rule="evenodd"/>`);
  }
  for (const s of values(level.stairs)) {
    parts.push(
      `<polygon points="${poly(s.polygon)}" fill="none" stroke="#111" stroke-width="1" vector-effect="non-scaling-stroke"/>`,
    );
  }
  for (const w of values(level.walls)) {
    parts.push(
      `<polygon points="${poly(wallCorners(w))}" fill="#111" fill-opacity="0.85"><title>${esc(`${w.id} · ${w.type} · ${w.thickness} cm`)}</title></polygon>`,
    );
  }
  for (const o of values(level.openings)) {
    const w = level.walls[o.wall];
    if (!w) continue;
    const colour = o.kind === 'door' ? '#4f5bff' : o.kind === 'opening' ? '#ffffff' : '#7fd1ff';
    parts.push(
      `<polygon points="${poly(wallCorners(w, o.offset, o.offset + o.width))}" fill="${colour}" stroke="#111" stroke-width="0.5" vector-effect="non-scaling-stroke"><title>${esc(`${o.id} · ${o.kind} · ${o.width} cm`)}</title></polygon>`,
    );
  }
  for (const c of values(level.columns)) {
    const [x, y] = c.at;
    const [w, h] = c.size;
    parts.push(
      `<polygon points="${poly([
        [x - w / 2, y - h / 2],
        [x + w / 2, y - h / 2],
        [x + w / 2, y + h / 2],
        [x - w / 2, y + h / 2],
      ])}" fill="none" stroke="#e5484d" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`,
    );
  }
  const roomById = new Map((options.rooms ?? []).map((r) => [r.room_id, r]));
  for (const room of values(level.rooms)) {
    const area = roomById.get(room.id)?.area_m2;
    parts.push(text(room.seed, room.name || roomTypeLabel(room.type), 14, 'font-weight="600"'));
    parts.push(
      text(
        [room.seed[0], room.seed[1] - 18],
        area === undefined ? 'not enclosed' : `${area.toFixed(2)} m²`,
        11,
        'fill="#444"',
      ),
    );
  }
  if (options.title)
    parts.push(
      `<text x="${f(minX + 10)}" y="${f(minY + 22)}" font-size="16">${esc(options.title)}</text>`,
    );
  parts.push('</svg>');
  return parts.join('\n');
}
