import { ROOM_TYPES, type Point, type RoomTypeId } from '@plancraft/engine';
import { useState, type RefObject } from 'react';
import { svgPoint } from '../ui/PlanView.tsx';
import type { PreviewShape, ToolInfo, ToolOptions } from './tools.ts';

// The active tool's prompt line (P2.5, skill §5 "the next expected input"): what the tool wants
// next, its options (wall type, room type, hatch pattern), and a box for typed values (A2 M5):
// lengths, points, angles, or a note's text. Typing anywhere on the canvas starts typing here.

export function ToolPrompt({
  tool,
  prompt,
  hint,
  options,
  onOptions,
  inputRef,
  onTyped,
}: {
  tool: ToolInfo;
  prompt: string;
  hint: string | null;
  options: ToolOptions;
  onOptions: (o: ToolOptions) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  /** True when the entry was used (the box then empties). */
  onTyped: (text: string) => boolean;
}) {
  const [text, setText] = useState('');
  return (
    <div className="ed-prompt" role="group" aria-label={`${tool.label} tool`}>
      <span className="ed-prompt-tool">{tool.label}</span>
      {tool.id === 'wall' && (
        <select
          className="ed-prompt-option"
          aria-label="Wall type"
          value={options.wallType}
          onChange={(e) =>
            onOptions({ ...options, wallType: e.target.value as ToolOptions['wallType'] })
          }
        >
          <option value="internal">Internal 11.5 cm</option>
          <option value="external">External 23 cm</option>
          <option value="parapet">Parapet 11.5 cm</option>
          <option value="compound">Compound 23 cm</option>
        </select>
      )}
      {(tool.id === 'room' || tool.id === 'label') && (
        <select
          className="ed-prompt-option"
          aria-label="Room type"
          value={options.roomType}
          onChange={(e) => onOptions({ ...options, roomType: e.target.value as RoomTypeId })}
        >
          {ROOM_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      )}
      {tool.id === 'hatch' && (
        <select
          className="ed-prompt-option"
          aria-label="Hatch pattern"
          value={options.hatch}
          onChange={(e) => onOptions({ ...options, hatch: e.target.value as ToolOptions['hatch'] })}
        >
          <option value="diagonal">Diagonal</option>
          <option value="cross">Cross</option>
          <option value="dots">Dots</option>
          <option value="solid">Solid</option>
        </select>
      )}
      <span className={`ed-prompt-text${hint ? ' ed-prompt-text--hint' : ''}`} aria-live="polite">
        {hint ?? prompt}
      </span>
      <input
        ref={inputRef}
        className="ed-prompt-input pc-mono"
        value={text}
        placeholder={tool.id === 'text' ? 'Note' : '450, 4.5m, @x,y'}
        aria-label={`Type a value for the ${tool.label.toLowerCase()} tool`}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && text.trim()) {
            e.preventDefault();
            e.stopPropagation();
            // A value that was used empties the box and hands the keys back to the canvas, so
            // the next tool key or Enter / Esc works straight away.
            if (onTyped(text)) {
              setText('');
              e.currentTarget.blur();
            }
          } else if (e.key === 'Escape') {
            e.stopPropagation();
            setText('');
            e.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}

/** The tool's preview shapes, in plan coordinates (y negated), drawn over the plan. */
export function ToolShapes({ shapes, scale }: { shapes: PreviewShape[]; scale: number }) {
  const line = {
    fill: 'none',
    stroke: 'var(--accent-strong)',
    strokeWidth: 1.5,
    vectorEffect: 'non-scaling-stroke',
  } as const;
  return (
    <g pointerEvents="none">
      {shapes.map((s, i) => {
        if (s.kind === 'dot')
          return (
            <circle key={i} cx={s.at[0]} cy={-s.at[1]} r={3 / scale} fill="var(--accent-strong)" />
          );
        if (s.kind === 'path')
          return (
            <path
              key={i}
              d={`M${s.points.map(svgPoint).join('L')}${s.closed ? 'Z' : ''}`}
              {...line}
              strokeDasharray="6 4"
            />
          );
        const { a, b, thickness } = s;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const n: Point = [
          ((a[1] - b[1]) / len) * (thickness / 2),
          ((b[0] - a[0]) / len) * (thickness / 2),
        ];
        const band: Point[] = [
          [a[0] + n[0], a[1] + n[1]],
          [b[0] + n[0], b[1] + n[1]],
          [b[0] - n[0], b[1] - n[1]],
          [a[0] - n[0], a[1] - n[1]],
        ];
        return (
          <path
            key={i}
            d={`M${band.map(svgPoint).join('L')}Z`}
            {...line}
            fill="var(--accent)"
            fillOpacity={0.25}
          />
        );
      })}
    </g>
  );
}
