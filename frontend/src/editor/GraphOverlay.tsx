import type { GraphEdgeKind } from '@plancraft/engine';
import { cssPx } from '../design/ui-scale.ts';
import { svgPoint } from '../ui/PlanView.tsx';
import { KIND_WORD, type GraphShapes } from './graph-view.ts';

// The Plan Graph over the drawing (P3.3, Layers → Plan graph): a dot per room, lines between
// rooms that relate, styled by kind (never by colour alone: width and dashes differ, and the
// legend names them), and each room's depth zone and Vastu zone ("front · NE"). Dots sit a
// little above the room's name so the labels stay readable.

/** How each kind of link is drawn: screen px, as the lines don't scale with zoom. */
const LINK: Record<GraphEdgeKind, { stroke: string; width: number; dash?: string }> = {
  open: { stroke: 'var(--accent-strong)', width: 3 },
  door: { stroke: 'var(--accent-strong)', width: 1.5 },
  wall: { stroke: 'var(--text-muted)', width: 1.5, dash: '6 4' },
  adjacent: { stroke: 'var(--text-faint)', width: 1, dash: '1 4' },
};
/** Dots are drawn this far (screen px) above the room's label point. */
const LIFT = 26;

export function GraphOverlay({ shapes, scale }: { shapes: GraphShapes; scale: number }) {
  const px = (n: number) => n / scale;
  // Tags follow Settings → Text size, like the rest of the interface.
  const tagSize = cssPx('--pc-font-size-100');
  const lift = (p: readonly [number, number]): [number, number] => [p[0], p[1] + px(LIFT)];
  const where = new Map(shapes.nodes.map((n) => [n.id, lift(n.at)]));
  return (
    <g className="ed-graph" pointerEvents="none" aria-hidden="true">
      {shapes.edges.map((e) => {
        const style = LINK[e.kind];
        const pts = [where.get(e.a)!, ...e.points.slice(1, -1), where.get(e.b)!];
        return (
          <path
            key={`${e.a}-${e.b}`}
            d={`M${pts.map(svgPoint).join('L')}`}
            fill="none"
            stroke={style.stroke}
            strokeWidth={style.width}
            strokeDasharray={style.dash}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {shapes.nodes.map((n) => {
        const [x, y] = where.get(n.id)!;
        return (
          <g key={n.id}>
            <circle
              cx={x}
              cy={-y}
              r={px(5)}
              fill={n.entrance ? 'var(--accent-strong)' : 'var(--surface)'}
              stroke="var(--accent-strong)"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={x}
              y={-y - px(9)}
              fontSize={px(tagSize)}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontFamily="var(--font-mono)"
            >
              {n.tag}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** The key to the overlay, beside its switch in the Layers panel. */
export function GraphLegend() {
  return (
    <ul className="ed-graph-legend" aria-label="Plan graph key">
      {(Object.keys(LINK) as GraphEdgeKind[]).map((kind) => {
        const s = LINK[kind];
        return (
          <li key={kind}>
            <svg width="24" height="8" aria-hidden="true">
              <line
                x1="2"
                y1="4"
                x2="22"
                y2="4"
                stroke={s.stroke}
                strokeWidth={s.width}
                strokeDasharray={s.dash}
                strokeLinecap="round"
              />
            </svg>
            {kind === 'adjacent'
              ? 'meet at a corner'
              : `${KIND_WORD[kind]}${kind === 'wall' ? ' only' : ''}`}
          </li>
        );
      })}
      <li>
        <svg width="24" height="10" aria-hidden="true">
          <circle cx="12" cy="5" r="4" fill="var(--accent-strong)" />
        </svg>
        door to the outside
      </li>
      <li className="pc-small">Tags: depth zone (front, middle, rear) · Vastu zone, north up</li>
    </ul>
  );
}
