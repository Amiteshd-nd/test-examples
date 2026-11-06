import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { flushSync } from 'react-dom';
import { cssPx } from '../design/ui-scale.ts';
import { clampWidth, type ResizableSide } from './panels.ts';

// The inner edge of a side panel (P2.2a): drag it to resize the panel, double-click to go back
// to the design width; when focused, the arrow keys resize (Shift for bigger steps) and Home /
// End go to the narrowest / widest. Limits come from the panel tokens.

const STEP = 8;
const BIG_STEP = 32;

// Panel tokens are rem (they follow Settings → Text size); measured in px here.
const tokenPx = (name: string) => cssPx(name);

export function ResizeHandle({
  side,
  width,
  onStart,
  onWidth,
  onEnd,
}: {
  side: ResizableSide;
  /** The panel's width now, px. */
  width: number;
  /** A change begins; `dragging` while the pointer moves it (the width then follows at once). */
  onStart: (dragging: boolean) => void;
  /** A new width, or null for the design width. */
  onWidth: (width: number | null) => void;
  onEnd: () => void;
}) {
  const drag = useRef<{ pointer: number; x: number; width: number } | null>(null);
  const min = tokenPx('--pc-size-panel-min');
  const max = tokenPx('--pc-size-panel-max');
  // Dragging towards the canvas widens the panel: right for the left panel, left for the right.
  const towardsCanvas = side === 'left' ? 1 : -1;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // The pointer is already gone: resize without capturing it.
    }
    drag.current = { pointer: e.pointerId, x: e.clientX, width };
    onStart(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    // Rendered now, not with React's later batch for pointer moves: the canvas corrects the
    // view for the new width in the same frame, so the drawing doesn't jitter while dragging.
    flushSync(() => onWidth(clampWidth(d.width + (e.clientX - d.x) * towardsCanvas, min, max)));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointer !== e.pointerId) return;
    drag.current = null;
    onEnd();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? BIG_STEP : STEP;
    const next =
      e.key === 'ArrowRight'
        ? width + step * towardsCanvas
        : e.key === 'ArrowLeft'
          ? width - step * towardsCanvas
          : e.key === 'Home'
            ? min
            : e.key === 'End'
              ? max
              : null;
    if (next === null) return;
    e.preventDefault();
    onStart(false);
    onWidth(clampWidth(next, min, max));
  };

  return (
    <div
      className={`ed-resize ed-resize--${side}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize the ${side} panel`}
      aria-controls={`ed-panel-${side}`}
      aria-valuenow={Math.round(width)}
      aria-valuemin={min}
      aria-valuemax={max}
      title="Drag to resize · double-click for the usual width · arrow keys when focused"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => {
        onStart(false);
        onWidth(null);
      }}
      onKeyDown={onKeyDown}
    />
  );
}
