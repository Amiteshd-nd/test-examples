import {
  hitTest,
  hitTestAll,
  snapPoint,
  type Pick,
  type PlanDrawing,
  type PlanIndex,
  type Point,
  type Snap,
  type SnapKind,
} from '@plancraft/engine';
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { gridStep, type DisplayUnits } from '../ui/format.ts';
import { PlanView, type PlanLayer } from '../ui/PlanView.tsx';
import { panBy, toPlan, toScreen, zoomAt, type Insets, type Size, type View } from '../ui/view.ts';
import type { Rect } from './panels.ts';
import type { Tool } from './state.ts';

// The canvas (P2.3): pan, zoom, pick and snap around the plan drawing. Everything about the
// plan comes from the engine: the drawing (`planDrawing`), what is under the cursor (`hitTest`)
// and where the cursor lands (`snapPoint`). The canvas owns no plan logic, only the gestures:
// - wheel or pinch zooms about the cursor (as in AutoCAD); drag pans (left drag on the canvas,
//   middle drag, or Space + drag); a click without movement selects;
// - dragging the selected object moves it (P2.4): the distance snaps to the grid when grid snap
//   is on (else to whole cm), Shift keeps it horizontal or vertical, Esc cancels. The editor
//   previews it every frame and runs one MOVE when the drag ends (one undo step, A2 M7);
// - with a drawing tool, the cursor snaps (grid, end, mid, perpendicular once a line has a
//   start point) and shows a marker; the status bar shows where it landed.
// It reports where it sits in the window on every size change, before that frame is painted,
// so the editor can keep the plan still while side panels slide (P2.2a).

export const CANVAS_INSETS: Insets = { top: 0, right: 0, bottom: 72, left: 0 };
/** Pick and snap reach, in screen pixels. */
const PICK_PX = 4;
const SNAP_PX = 10;
const DRAG_PX = 3;

export interface Cursor {
  point: Point;
  snap: Snap['kind'];
  /** While moving an object: how far, cm. */
  delta?: Point;
  /** Shift is held (tools keep lines straight, angles in 15° steps). */
  shift?: boolean;
}

/** A click with a drawing or modify tool: the snapped point and the object under it. */
export interface ToolClick {
  point: Point;
  pick: Pick | null;
  shift: boolean;
}

/** Tools that act on an object highlight what a click would pick. */
const PICKING_TOOLS = new Set<Tool>([
  'door',
  'window',
  'trim',
  'extend',
  'delete',
  'offset',
  'move',
  'copy',
  'rotate',
  'mirror',
]);

/** A drag that moves an object: from a point on it to where it is now (both on the 1 mm grid). */
export type MoveDrag = (
  pick: Pick,
  from: Point,
  to: Point,
  phase: 'move' | 'end' | 'cancel',
) => void;

interface CanvasProps {
  drawing: PlanDrawing;
  index: PlanIndex;
  units: DisplayUnits;
  tool: Tool;
  snaps: readonly SnapKind[];
  hidden: readonly PlanLayer[];
  selected: Pick | null;
  onSelect: (pick: Pick | null) => void;
  /** The view shown (the fitted view until the user pans or zooms). */
  view: View | null;
  onView: (view: View) => void;
  size: Size | null;
  /** The drawing area moved or resized (a panel, the window); called before the frame paints. */
  onLayout: (rect: Rect) => void;
  onCursor: (cursor: Cursor | null) => void;
  /** Space is held: drags pan whatever the tool. */
  spaceDown: boolean;
  /** Set when the plan can be edited: the selected object can then be dragged. */
  onMoveDrag?: MoveDrag;
  /** A click with a tool other than Select (P2.5). */
  onToolClick?: (click: ToolClick) => void;
  /** The point the tool draws from, for perpendicular snaps. */
  snapFrom?: Point;
  /** The active tool's preview, in plan coordinates (y negated), drawn over the plan. */
  toolOverlay?: ReactNode;
  children?: ReactNode;
}

interface Drag {
  pointer: number;
  start: Point;
  view: View;
  pan: boolean;
  moved: boolean;
  /** Moving the selected object instead of panning: it and the plan point grabbed. */
  move?: { pick: Pick; from: Point };
}

const samePick = (a: Pick | null, b: Pick | null) =>
  !!a && !!b && a.kind === b.kind && a.id === b.id;
const mm = (n: number) => Math.round(n * 10) / 10;

/** A snap marker of a fixed screen size: square = end, triangle = mid, ⊥ = perpendicular. */
function SnapMarker({ snap, scale }: { snap: Snap; scale: number }) {
  const r = 5 / scale;
  const [x, y] = [snap.point[0], -snap.point[1]];
  const d =
    snap.kind === 'endpoint'
      ? `M${x - r},${y - r}h${2 * r}v${2 * r}h${-2 * r}Z`
      : snap.kind === 'midpoint'
        ? `M${x},${y - r * 1.2}L${x + r * 1.1},${y + r * 0.8}L${x - r * 1.1},${y + r * 0.8}Z`
        : snap.kind === 'perpendicular'
          ? `M${x - r},${y - r}V${y + r}H${x + r}M${x - r},${y}H${x}V${y + r}`
          : `M${x - r * 0.8},${y}H${x + r * 0.8}M${x},${y - r * 0.8}V${y + r * 0.8}`;
  return (
    <path
      d={d}
      fill="none"
      stroke="var(--accent-strong)"
      strokeWidth={1.5}
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />
  );
}

export function Canvas({
  drawing,
  index,
  units,
  tool,
  snaps,
  hidden,
  selected,
  onSelect,
  view,
  onView,
  size,
  onLayout,
  onCursor,
  spaceDown,
  onMoveDrag,
  onToolClick,
  snapFrom,
  toolOverlay,
  children,
}: CanvasProps) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [panning, setPanning] = useState(false);
  const [hovered, setHovered] = useState<Pick | null>(null);
  const [snap, setSnap] = useState<Snap | null>(null);
  // Pointer moves arrive faster than frames: keep the latest and handle it once per frame.
  const pending = useRef<{ at: Point; shift: boolean } | null>(null);
  const frame = useRef(0);
  const latest = useRef({
    view,
    size,
    index,
    tool,
    snaps,
    units,
    onView,
    onCursor,
    onLayout,
    onMoveDrag,
    snapFrom,
  });
  latest.current = {
    snapFrom,
    view,
    size,
    index,
    tool,
    snaps,
    units,
    onView,
    onCursor,
    onLayout,
    onMoveDrag,
  };

  /** Where a move-drag has got to: the grabbed point plus the distance, snapped. */
  const moveTarget = (d: Drag, at: Point, shift: boolean) => {
    const { view: v, size: s, snaps: on, units: u } = latest.current;
    const p = toPlan(v ?? d.view, s!, at);
    const from = d.move!.from;
    let dx = p[0] - from[0];
    let dy = p[1] - from[1];
    if (shift) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    const step = on.includes('grid') ? gridStep((v ?? d.view).scale, u) : 1;
    const delta: Point = [mm(Math.round(dx / step) * step), mm(Math.round(dy / step) * step)];
    return { from, to: [mm(from[0] + delta[0]), mm(from[1] + delta[1])] as Point, delta };
  };

  const local = (e: { clientX: number; clientY: number }): Point => {
    const r = ref.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const flush = () => {
    frame.current = 0;
    const job = pending.current;
    pending.current = null;
    const { view: v, size: s, index: idx, tool: t, snaps: on, units: u } = latest.current;
    if (!job || !v || !s) return;
    const d = drag.current;
    if (d?.move && d.moved) {
      const m = moveTarget(d, job.at, job.shift);
      latest.current.onMoveDrag?.(d.move.pick, m.from, m.to, 'move');
      latest.current.onCursor({ point: m.to, snap: 'none', delta: m.delta });
      return;
    }
    if (d && (d.moved || d.pan)) {
      latest.current.onView(panBy(d.view, job.at[0] - d.start[0], job.at[1] - d.start[1]));
      return;
    }
    const p = toPlan(v, s, job.at);
    if (t === 'select') {
      setSnap(null);
      setHovered(hitTest(idx, p, PICK_PX / v.scale));
      latest.current.onCursor({ point: p, snap: 'none' });
    } else {
      const found = snapPoint(idx, p, {
        tolerance: SNAP_PX / v.scale,
        snaps: on,
        grid: gridStep(v.scale, u),
        ...(latest.current.snapFrom ? { from: latest.current.snapFrom } : {}),
      });
      setHovered(PICKING_TOOLS.has(t) ? hitTest(idx, p, PICK_PX / v.scale) : null);
      setSnap(found.kind === 'none' ? null : found);
      latest.current.onCursor({ point: found.point, snap: found.kind, shift: job.shift });
    }
  };
  const schedule = (at: Point, shift = false) => {
    pending.current = { at, shift };
    if (!frame.current) frame.current = requestAnimationFrame(flush);
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // The drawing area's place in the window. Rendered synchronously (`flushSync`) inside the
  // observer, which runs after layout and before paint, so the plan never shows a frame out of
  // place while a panel animates.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      flushSync(() =>
        latest.current.onLayout({ left: r.left, top: r.top, w: r.width, h: r.height }),
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Wheel and pinch zoom about the cursor. Registered by hand: React's wheel listener is passive
  // and could not stop the page from scrolling.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const { view: v, size: s } = latest.current;
      if (!v || !s) return;
      e.preventDefault();
      const lines = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const factor = Math.exp(-e.deltaY * lines * (e.ctrlKey ? 0.01 : 0.002));
      latest.current.onView(zoomAt(v, s, local(e), factor));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: PointerEvent) => {
    if (!view || (e.button !== 0 && e.button !== 1)) return;
    e.preventDefault();
    try {
      ref.current!.setPointerCapture(e.pointerId);
    } catch {
      // The pointer is already gone (released before this event was handled): drag without it.
    }
    const pan = e.button === 1 || spaceDown;
    const at = local(e);
    drag.current = { pointer: e.pointerId, start: at, view, pan, moved: false };
    // Pressing on the selected object (Select tool) starts a move instead of a pan.
    if (!pan && e.button === 0 && tool === 'select' && onMoveDrag && size) {
      const p = toPlan(view, size, at);
      const hit = hitTest(index, p, PICK_PX / view.scale);
      if (samePick(hit, selected)) drag.current.move = { pick: hit!, from: [mm(p[0]), mm(p[1])] };
    }
    if (pan) setPanning(true);
  };
  // Esc while moving puts the object back; the key goes no further (it would clear the selection).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = drag.current;
      if (e.key !== 'Escape' || !d?.move) return;
      e.stopImmediatePropagation();
      drag.current = null;
      setPanning(false);
      if (d.moved) latest.current.onMoveDrag?.(d.move.pick, d.move.from, d.move.from, 'cancel');
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  const onPointerMove = (e: PointerEvent) => {
    const at = local(e);
    const d = drag.current;
    if (d && !d.moved && Math.hypot(at[0] - d.start[0], at[1] - d.start[1]) > DRAG_PX) {
      d.moved = true;
      if (!d.move) setPanning(true);
    }
    schedule(at, e.shiftKey);
  };
  const onPointerUp = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    setPanning(false);
    if (d.move && d.moved) {
      const m = moveTarget(d, local(e), e.shiftKey);
      onMoveDrag?.(d.move.pick, m.from, m.to, 'end');
      return;
    }
    if (!d.moved && !d.pan && view && size) {
      const p = toPlan(view, size, local(e));
      const reach = PICK_PX / view.scale;
      if (tool === 'select') {
        // A click selects what is under it; Alt-click steps to the next object under the cursor
        // (a hatch under a room, a wall under a door).
        const all = hitTestAll(index, p, reach);
        const i = all.findIndex((x) => samePick(x, selected));
        onSelect(e.altKey && i >= 0 ? (all[(i + 1) % all.length] ?? null) : (all[0] ?? null));
        return;
      }
      const found = snapPoint(index, p, {
        tolerance: SNAP_PX / view.scale,
        snaps,
        grid: gridStep(view.scale, units),
        ...(snapFrom ? { from: snapFrom } : {}),
      });
      onToolClick?.({ point: found.point, pick: hitTest(index, p, reach), shift: e.shiftKey });
    }
  };
  const onPointerLeave = () => {
    if (drag.current) return;
    setHovered(null);
    setSnap(null);
    onCursor(null);
  };

  // The dot grid follows the plan: one dot per grid step, on the plan's grid lines.
  const step = view ? gridStep(view.scale, units) : 16;
  const spacing = view ? step * view.scale : 16;
  const origin = view && size ? toScreen(view, size, [0, 0]) : [0, 0];
  const mod = (a: number) => (((a - spacing / 2) % spacing) + spacing) % spacing;

  const cursor = panning
    ? 'grabbing'
    : spaceDown
      ? 'grab'
      : tool !== 'select'
        ? 'crosshair'
        : drag.current?.move || (onMoveDrag && samePick(hovered, selected))
          ? 'move'
          : hovered
            ? 'pointer'
            : 'default';

  return (
    <main
      className="ed-canvas pc-dots"
      aria-label="Canvas"
      style={{
        backgroundSize: `${spacing}px ${spacing}px`,
        backgroundPosition: `${mod(origin[0]!)}px ${mod(origin[1]!)}px`,
      }}
    >
      <div
        ref={ref}
        className="ed-canvas-draw"
        style={{ cursor, touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
      >
        <PlanView
          drawing={drawing}
          units={units}
          selected={selected}
          hovered={hovered}
          hidden={hidden}
          view={view}
          size={size}
          insets={CANVAS_INSETS}
          overlay={
            <>
              {toolOverlay}
              {snap && view && <SnapMarker snap={snap} scale={view.scale} />}
            </>
          }
        />
      </div>
      {children}
    </main>
  );
}
