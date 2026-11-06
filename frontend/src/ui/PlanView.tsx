import type { Arc, Pick, PlanDrawing, Point, RoomShape } from '@plancraft/engine';
import { memo, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useUiScale } from '../design/ui-scale.ts';
import { formatArea, formatLength, type DisplayUnits } from './format.ts';
import { LABEL, fitRoomLabel } from './labels.ts';
import { fitView, viewBox, type Insets, type Size, type View } from './view.ts';

// Draws an engine `PlanDrawing` with the design tokens (design/DESIGN.md → Canvas objects):
// rooms tinted, walls as one ink outline, door swings and window lines as hairlines, labels in
// sans + mono, the selection in blueprint blue with grips. Plan y points north, so every point
// is drawn at (x, −y). The view is fitted unless the canvas passes one (pan/zoom, P2.3). Labels
// and grips keep their screen size; the layers that don't change while panning are memoised,
// so a pan only moves the viewBox.

export type PlanLayer =
  | 'plot'
  | 'rooms'
  | 'walls'
  | 'openings'
  | 'stairs'
  | 'columns'
  | 'separators'
  | 'labels'
  | 'hatches'
  | 'lines'
  | 'dimensions'
  | 'texts';

export interface PlanViewProps {
  drawing: PlanDrawing;
  units?: DisplayUnits;
  selected?: Pick | null;
  hovered?: Pick | null;
  hidden?: readonly PlanLayer[];
  /** The view to show; fitted to the drawing when absent. */
  view?: View | null;
  /** Space the fitted view leaves free (e.g. under a floating toolbar), px. */
  insets?: Insets;
  /**
   * The drawing area's size when the parent measures it (the editor does, so the view and the
   * size change in the same frame while side panels slide); measured here otherwise.
   */
  size?: Size | null;
  onSize?: (size: Size) => void;
  /** Called with the drawing's scale on screen (px per cm) whenever it changes. */
  onScale?: (pxPerCm: number) => void;
  /** Drawn on top, in plan coordinates with y negated (see `svgPoint`). */
  overlay?: ReactNode;
}

export const svgPoint = ([x, y]: Point) => `${x},${-y}`;
const ring = (r: readonly Point[]) => (r.length ? `M${r.map(svgPoint).join('L')}Z` : '');
const line = ([a, b]: readonly [Point, Point]) => `M${svgPoint(a)}L${svgPoint(b)}`;

/** An arc as an SVG path: anticlockwise in plan axes stays anticlockwise on screen (sweep 0). */
function arc({ center: [cx, cy], radius: r, start, end }: Arc) {
  const at = (d: number): Point => [
    cx + r * Math.cos((d * Math.PI) / 180),
    cy + r * Math.sin((d * Math.PI) / 180),
  ];
  const sweep = (((end - start) % 360) + 360) % 360;
  return `M${svgPoint(at(start))}A${r} ${r} 0 ${sweep > 180 ? 1 : 0} 0 ${svgPoint(at(end))}`;
}

function useSize(ref: RefObject<Element | null>) {
  const [size, setSize] = useState<Size | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry!.contentRect;
      setSize((s) => (s && s.w === width && s.h === height ? s : { w: width, h: height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

const hairline = { vectorEffect: 'non-scaling-stroke', fill: 'none' } as const;
type Show = (layer: PlanLayer) => boolean;

/** Under the selection wash: plot line, room tints, separators, stairs. */
const Under = memo(function Under({ d, show }: { d: PlanDrawing; show: Show }) {
  return (
    <>
      {show('plot') && (
        <path
          d={ring(d.plot)}
          {...hairline}
          stroke="var(--text-muted)"
          strokeDasharray="8 4"
          strokeWidth={1}
        />
      )}
      {show('rooms') &&
        d.rooms.map((r) => (
          <path
            key={r.id}
            d={[r.outer, ...r.holes].map(ring).join('')}
            fillRule="evenodd"
            fill="var(--accent-tint)"
            fillOpacity={0.55}
          />
        ))}
      {show('separators') &&
        d.separators.map((s) => (
          <path
            key={s.id}
            d={line(s.line)}
            {...hairline}
            stroke="var(--text-muted)"
            strokeDasharray="6 4"
            strokeWidth={1.25}
          />
        ))}
      {show('stairs') &&
        d.stairs.map((s) => (
          <path
            key={s.id}
            d={ring(s.outline) + s.treads.map(line).join('')}
            {...hairline}
            stroke="var(--text-muted)"
            strokeWidth={1}
          />
        ))}
    </>
  );
});

/** Over the wash: walls, opening symbols, columns. Unchanged by panning and zooming. */
/**
 * Hatch patterns (P2.5), in plan cm like the drawing so they print true to scale: lines every
 * 20 cm, dots on a 20 cm grid, or a light solid fill.
 */
function HatchDefs() {
  const stroke = { stroke: 'var(--text-muted)', strokeWidth: 1.2 } as const;
  return (
    <defs>
      <pattern
        id="pc-hatch-diagonal"
        patternUnits="userSpaceOnUse"
        width={20}
        height={20}
        patternTransform="rotate(45)"
      >
        <path d="M0,0V20" {...stroke} />
      </pattern>
      <pattern
        id="pc-hatch-cross"
        patternUnits="userSpaceOnUse"
        width={20}
        height={20}
        patternTransform="rotate(45)"
      >
        <path d="M0,0V20M0,0H20" {...stroke} />
      </pattern>
      <pattern id="pc-hatch-dots" patternUnits="userSpaceOnUse" width={20} height={20}>
        <circle cx={10} cy={10} r={1.8} fill="var(--text-muted)" />
      </pattern>
    </defs>
  );
}

/** Hatched areas, under the walls. */
const Hatches = memo(function Hatches({ d, show }: { d: PlanDrawing; show: Show }) {
  if (!show('hatches') || !d.hatches.length) return null;
  return (
    <>
      <HatchDefs />
      {d.hatches.map((h) => (
        <path
          key={h.id}
          d={ring(h.polygon)}
          fill={h.pattern === 'solid' ? 'var(--text-muted)' : `url(#pc-hatch-${h.pattern})`}
          fillOpacity={h.pattern === 'solid' ? 0.25 : 1}
          stroke="var(--text-muted)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </>
  );
});

/**
 * Drafting lines, dimensions and notes (P2.5), over the walls. Their text is in plan cm
 * (CAD-style, true to print), so it grows and shrinks with the zoom.
 */
const Notes = memo(function Notes({
  d,
  show,
  units,
}: {
  d: PlanDrawing;
  show: Show;
  units: DisplayUnits;
}) {
  const stroke = { ...hairline, stroke: 'var(--ink)', strokeWidth: 1 } as const;
  const text = (at: Point, angle: number) => ({
    x: at[0],
    y: -at[1],
    transform: angle ? `rotate(${-angle} ${at[0]} ${-at[1]})` : undefined,
    textAnchor: 'middle' as const,
    dominantBaseline: 'central' as const,
    fill: 'var(--ink)',
  });
  return (
    <>
      {show('lines') &&
        d.lines.map((l) => (
          <path
            key={l.id}
            d={`M${l.points.map(svgPoint).join('L')}${l.closed ? 'Z' : ''}`}
            {...stroke}
          />
        ))}
      {show('dimensions') &&
        d.dimensions.map((m) => (
          <g key={m.id}>
            <path d={[m.line, ...m.extensions, ...m.ticks].map(line).join('')} {...stroke} />
            <text {...text(m.textAt, m.angle)} fontSize={m.size} fontFamily="var(--font-mono)">
              {formatLength(m.length, units)}
            </text>
          </g>
        ))}
      {show('texts') &&
        d.texts.map((t) => (
          <text key={t.id} {...text(t.at, t.angle)} fontSize={t.size}>
            {t.text}
          </text>
        ))}
    </>
  );
});

const Over = memo(function Over({ d, show }: { d: PlanDrawing; show: Show }) {
  return (
    <>
      {show('walls') && (
        <path d={d.walls.map(ring).join('')} fill="var(--ink)" fillRule="evenodd" />
      )}
      {show('openings') &&
        d.openings.map((o) => (
          <path
            key={o.id}
            d={o.lines.map(line).join('') + o.arcs.map(arc).join('')}
            {...hairline}
            stroke="var(--ink)"
            strokeWidth={1}
          />
        ))}
      {show('columns') &&
        d.columns.map((c) => {
          const [a, b, cc, e] = c.outline;
          return (
            <path
              key={c.id}
              d={`${ring(c.outline)}${line([a!, cc!])}${line([b!, e!])}`}
              fill="var(--ink)"
              stroke="var(--canvas)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
    </>
  );
});

/** Room and stair labels: sized in screen pixels, so they redraw when the zoom changes. */
const Labels = memo(function Labels({
  d,
  show,
  units,
  scale,
  uiScale,
}: {
  d: PlanDrawing;
  show: Show;
  units: DisplayUnits;
  scale: number;
  /** Settings → Text size: labels grow with it; line weights don't (DS-03). */
  uiScale: number;
}) {
  const px = (n: number) => (n * uiScale) / scale;
  // Labels that don't fit their room at this zoom and text size are left out (ui/labels.ts).
  const room = (r: RoomShape) =>
    fitRoomLabel(
      r.name,
      r.area_m2 === undefined ? 'not enclosed' : formatArea(r.area_m2, units),
      r.outer,
      px,
    );
  return (
    <g pointerEvents="none">
      {show('stairs') &&
        d.stairs.map((s) => (
          <text
            key={s.id}
            x={s.labelAt[0]}
            y={-s.labelAt[1]}
            fontSize={px(11)}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--text-muted)"
            fontFamily="var(--font-mono)"
          >
            {s.label}
          </text>
        ))}
      {show('labels') &&
        d.rooms.map((r) => {
          const { name, area } = room(r);
          return (
            <g key={r.id} textAnchor="middle">
              {name && (
                <text
                  x={r.labelAt[0]}
                  y={-r.labelAt[1] - px(3)}
                  fontSize={px(LABEL.name)}
                  fontWeight={500}
                  fill="var(--text)"
                  fontFamily="var(--font-sans)"
                >
                  {name}
                </text>
              )}
              {area && (
                <text
                  x={r.labelAt[0]}
                  y={-r.labelAt[1] + (name ? px(13) : px(4))}
                  fontSize={px(LABEL.area)}
                  fill="var(--text-muted)"
                  fontFamily="var(--font-mono)"
                >
                  {area}
                </text>
              )}
            </g>
          );
        })}
    </g>
  );
});

/** The outline of a picked object, for selection and hover. */
export function pickShape(d: PlanDrawing, p: Pick): { rings: Point[][]; open?: boolean } | null {
  switch (p.kind) {
    case 'room': {
      const r = d.rooms.find((x) => x.id === p.id);
      return r?.outer.length ? { rings: [r.outer, ...r.holes] } : null;
    }
    case 'wall': {
      const w = d.wallShapes.find((x) => x.id === p.id);
      return w ? { rings: [w.band] } : null;
    }
    case 'opening': {
      const o = d.openings.find((x) => x.id === p.id);
      return o ? { rings: [o.frame] } : null;
    }
    case 'column': {
      const c = d.columns.find((x) => x.id === p.id);
      return c ? { rings: [c.outline] } : null;
    }
    case 'stair': {
      const s = d.stairs.find((x) => x.id === p.id);
      return s ? { rings: [s.outline] } : null;
    }
    case 'separator': {
      const s = d.separators.find((x) => x.id === p.id);
      return s ? { rings: [[...s.line]], open: true } : null;
    }
    case 'line': {
      const l = d.lines.find((x) => x.id === p.id);
      return l ? { rings: [l.points], open: !l.closed } : null;
    }
    case 'dimension': {
      const m = d.dimensions.find((x) => x.id === p.id);
      return m ? { rings: [[...m.line]], open: true } : null;
    }
    case 'text': {
      const t = d.texts.find((x) => x.id === p.id);
      return t ? { rings: [t.box] } : null;
    }
    case 'hatch': {
      const h = d.hatches.find((x) => x.id === p.id);
      return h ? { rings: [h.polygon] } : null;
    }
  }
}

const samePick = (a: Pick | null, b: Pick | null) => a?.kind === b?.kind && a?.id === b?.id;

export function PlanView({
  drawing,
  units = 'm',
  selected = null,
  hovered = null,
  hidden = [],
  view,
  insets,
  size: givenSize,
  onSize,
  onScale,
  overlay,
}: PlanViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const measured = useSize(svgRef);
  const size = givenSize ?? measured;
  const v = view ?? (size ? fitView(drawing.bounds, size, insets) : null);
  const scale = v?.scale ?? 1;
  useEffect(() => {
    if (size) onSize?.(size);
  }, [size, onSize]);
  const shownScale = v ? scale : null;
  useEffect(() => {
    if (shownScale !== null) onScale?.(shownScale);
  }, [shownScale, onScale]);

  // A stable `show` per set of hidden layers keeps the memoised layers from redrawing.
  const hiddenKey = hidden.join();
  const show = useMemo<Show>(() => {
    const off = new Set(hiddenKey.split(','));
    return (layer) => !off.has(layer);
  }, [hiddenKey]);

  const uiScale = useUiScale();
  const px = (n: number) => n / scale;
  const sel = selected ? pickShape(drawing, selected) : null;
  const hov = hovered && !samePick(hovered, selected) ? pickShape(drawing, hovered) : null;
  const path = (s: { rings: Point[][]; open?: boolean }) =>
    s.open ? `M${s.rings[0]!.map(svgPoint).join('L')}` : s.rings.map(ring).join('');

  return (
    <svg
      ref={svgRef}
      className="pc-planview"
      viewBox={v && size ? viewBox(v, size) : '0 0 1 1'}
      role="img"
      aria-label="Plan"
    >
      {v && (
        <>
          <Under d={drawing} show={show} />
          <Hatches d={drawing} show={show} />
          {sel && selected?.kind === 'room' && (
            <path d={path(sel)} fillRule="evenodd" fill="var(--accent)" fillOpacity={0.3} />
          )}
          <Over d={drawing} show={show} />
          <Notes d={drawing} show={show} units={units} />
          <Labels d={drawing} show={show} units={units} scale={scale} uiScale={uiScale} />
          {hov && (
            <path
              d={path(hov)}
              {...hairline}
              fillRule="evenodd"
              stroke="var(--accent)"
              strokeWidth={1.5}
            />
          )}
          {sel && (
            <>
              <path
                d={path(sel)}
                fillRule="evenodd"
                fill={selected?.kind === 'room' ? 'none' : 'var(--accent)'}
                fillOpacity={0.25}
                stroke="var(--accent-strong)"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
              {sel.rings[0]!.map(([x, y], i) => (
                <rect
                  key={i}
                  x={x - px(3)}
                  y={-y - px(3)}
                  width={px(6)}
                  height={px(6)}
                  fill="var(--surface)"
                  stroke="var(--accent-strong)"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </>
          )}
          {overlay}
        </>
      )}
    </svg>
  );
}
