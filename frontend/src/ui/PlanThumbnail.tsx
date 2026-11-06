import {
  firstLevel,
  validatePlan,
  values,
  type Plan,
  type Point,
  type Wall,
} from '@plancraft/engine';
import { useMemo } from 'react';

// A small drawing of a plan's first level: tinted rooms and walls in ink, on white paper.
// Used for folder papers in the Vault and file previews (A2 §4.2: real plan thumbnails).

function wallPolygon(w: Wall): Point[] {
  const dx = w.end[0] - w.start[0];
  const dy = w.end[1] - w.start[1];
  const len = Math.hypot(dx, dy);
  const nx = (-dy / len) * (w.thickness / 2);
  const ny = (dx / len) * (w.thickness / 2);
  return [
    [w.start[0] + nx, w.start[1] + ny],
    [w.end[0] + nx, w.end[1] + ny],
    [w.end[0] - nx, w.end[1] - ny],
    [w.start[0] - nx, w.start[1] - ny],
  ];
}

export function PlanThumbnail({ plan, padding = 40 }: { plan: Plan; padding?: number }) {
  const { walls, rooms, box } = useMemo(() => {
    const level = firstLevel(plan);
    const ws = values(level.walls).map(wallPolygon);
    const rs = validatePlan(plan).rooms.map((r) => r.outer);
    const pts = ws.flat();
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    return {
      walls: ws,
      rooms: rs,
      box: {
        x0: Math.min(...xs) - padding,
        y0: Math.min(...ys) - padding,
        x1: Math.max(...xs) + padding,
        y1: Math.max(...ys) + padding,
      },
    };
  }, [plan, padding]);
  const pt = ([x, y]: Point) => `${x},${box.y1 + box.y0 - y}`;
  return (
    <svg
      viewBox={`${box.x0} ${box.y0} ${box.x1 - box.x0} ${box.y1 - box.y0}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {rooms.map((r, i) => (
        <polygon key={`r${i}`} points={r.map(pt).join(' ')} fill="var(--pc-paper-room)" />
      ))}
      {walls.map((w, i) => (
        <polygon key={`w${i}`} points={w.map(pt).join(' ')} fill="var(--pc-paper-ink)" />
      ))}
    </svg>
  );
}
