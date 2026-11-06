import {
  ROOM_TYPES,
  parseLength,
  roundCm,
  values,
  type CommandRequest,
  type DerivedRoom,
  type Level,
  type Pick,
  type Plan,
  type ProvenanceMap,
} from '@plancraft/engine';
import { useEffect, useState, type ReactNode } from 'react';
import { Chip } from '../ui/components.tsx';
import { formatArea, formatLength, type DisplayUnits } from '../ui/format.ts';

// The Properties tab (P2.2/P2.3): facts about the selected object, read from the plan and the
// engine's derived rooms. Where a value was guessed, its provenance chip says so. P2.5: the main
// values can be typed (A2 M5 "editable dimensions"): a wall's or a dimension's length moves the
// wall, and names, widths, thickness, notes and patterns change through commands, one undo step
// each. A bare number is in the units shown (6.5 → 6.50 m); 650cm or 21'4" say their own.

const OPENING_KIND = {
  door: 'Door',
  window: 'Window',
  ventilator: 'Ventilator',
  opening: 'Opening',
};
const SWING = {
  'in-left': 'Inward, hinged at the start',
  'in-right': 'Inward, hinged at the end',
  'out-left': 'Outward, hinged at the start',
  'out-right': 'Outward, hinged at the end',
};
const WALL_TYPE: Record<string, string> = {
  external: 'External',
  internal: 'Internal',
  parapet: 'Parapet',
  compound: 'Compound',
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <span className="pc-muted">{label}</span>
      <span>{children}</span>
    </>
  );
}

function Source({ provenance, field }: { provenance?: ProvenanceMap; field: string }) {
  const p = provenance?.[field];
  return p ? <Chip>{p.provenance}</Chip> : null;
}

/** A length typed in a field: in the display units unless it carries its own (cm, m, ', "). */
export function readLength(text: string, units: DisplayUnits): number | null {
  const t = text.trim();
  if (/[a-z'"]/i.test(t)) return parseLength(t);
  const n = Number(t);
  if (!t || !Number.isFinite(n)) return null;
  return roundCm(units === 'm' ? n * 100 : n * 30.48);
}

export type OnCommand = (request: CommandRequest, done: string) => boolean;

/** A value that can be typed over: Enter or leaving the field applies it, Esc puts it back. */
function Edit({
  value,
  label,
  onCommit,
  mono = true,
}: {
  value: string;
  label: string;
  /** False when the value was refused (it is then put back). */
  onCommit: ((text: string) => boolean) | null;
  mono?: boolean;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  if (!onCommit) return <span className={mono ? 'pc-mono' : undefined}>{value}</span>;
  const commit = () => {
    if (text.trim() === value.trim()) return;
    if (!onCommit(text)) setText(value);
  };
  return (
    <input
      className={`ed-edit${mono ? ' pc-mono' : ''}`}
      value={text}
      aria-label={label}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          setText(value);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

/** A choice that changes at once. */
function Choose({
  value,
  label,
  options,
  onCommit,
}: {
  value: string;
  label: string;
  options: readonly (readonly [string, string])[];
  onCommit: ((v: string) => boolean) | null;
}) {
  if (!onCommit) return <>{options.find(([v]) => v === value)?.[1] ?? value}</>;
  return (
    <select
      className="ed-edit"
      value={value}
      aria-label={label}
      onChange={(e) => onCommit(e.target.value)}
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

const Note = ({ children }: { children: ReactNode }) => (
  <span className="pc-small" style={{ gridColumn: '1 / -1' }}>
    {children}
  </span>
);

export function Properties({
  plan,
  level,
  rooms,
  selected,
  units,
  onCommand,
}: {
  plan: Plan;
  level: Level;
  rooms: DerivedRoom[];
  selected: Pick | null;
  units: DisplayUnits;
  /** Set when the plan can be edited. */
  onCommand?: OnCommand;
}) {
  const len = (cm: number) => <span className="pc-mono">{formatLength(cm, units)}</span>;
  const run = (id: string, params: unknown, done: string) =>
    onCommand ? onCommand({ op: 'execute', id, params }, done) : false;
  /** A field that sets one property of the selected object. */
  const setter = (id: string, key: string, read: (t: string) => unknown | null, what: string) =>
    onCommand
      ? (t: string) => {
          const v = read(t);
          return v !== null && run('SET', { id, props: { [key]: v } }, `${what} changed.`);
        }
      : null;
  const lengthOf = (id: string, what: string) =>
    onCommand
      ? (t: string) => {
          const v = readLength(t, units);
          return (
            v !== null &&
            v > 0 &&
            run(
              'SET_LENGTH',
              { target: id, length: v },
              `${what} is now ${formatLength(v, units)}.`,
            )
          );
        }
      : null;
  const asLength = (t: string) => {
    const v = readLength(t, units);
    return v !== null && v > 0 ? v : null;
  };
  const asText = (t: string) => (t.trim() ? t.trim() : null);
  const fmt = (cm: number) => formatLength(cm, units);
  const chips = (ids: string[]) => (
    <span className="ed-chips">
      {ids.length ? ids.map((id) => <Chip key={id}>{id}</Chip>) : '—'}
    </span>
  );
  const roomsBy = (id: string) =>
    rooms
      .filter((r) => r.wall_ids.includes(id) || r.separator_ids.includes(id))
      .map((r) => r.room_id);

  const body = (() => {
    switch (selected?.kind) {
      case 'room': {
        const room = level.rooms[selected.id];
        if (!room) return null;
        const shape = rooms.find((r) => r.room_id === room.id);
        return (
          <>
            <Row label="Name">
              <Edit
                value={room.name}
                label="Room name"
                mono={false}
                onCommit={setter(room.id, 'name', asText, 'Room name')}
              />
            </Row>
            <Row label="Type">
              <Choose
                value={room.type}
                label="Room type"
                options={ROOM_TYPES.map((t) => [t.id, t.label] as const)}
                onCommit={setter(room.id, 'type', (v) => v, 'Room type')}
              />{' '}
              <Source provenance={room.provenance} field="type" />
            </Row>
            <Row label="Area">
              <span className="pc-mono">
                {shape ? formatArea(shape.area_m2, units) : 'not enclosed'}
              </span>
            </Row>
            <Row label="Walls">{chips(shape?.wall_ids ?? [])}</Row>
            <Row label="Behaviour">{room.behavior}</Row>
            {room.provenance?.type?.reason && <Note>{room.provenance.type.reason}</Note>}
          </>
        );
      }
      case 'wall': {
        const w = level.walls[selected.id];
        if (!w) return null;
        const openings = values(level.openings).filter((o) => o.wall === w.id);
        return (
          <>
            <Row label="Wall">{w.id}</Row>
            <Row label="Type">
              <Choose
                value={w.type}
                label="Wall type"
                options={Object.entries(WALL_TYPE)}
                onCommit={setter(w.id, 'type', (v) => v, 'Wall type')}
              />{' '}
              <Source provenance={w.provenance} field="type" />
            </Row>
            <Row label="Thickness">
              <Edit
                value={fmt(w.thickness)}
                label="Wall thickness"
                onCommit={setter(w.id, 'thickness', asLength, 'Wall thickness')}
              />
            </Row>
            <Row label="Length">
              <Edit
                value={fmt(Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]))}
                label="Wall length"
                onCommit={lengthOf(w.id, `Wall ${w.id}`)}
              />
            </Row>
            <Row label="Openings">{chips(openings.map((o) => o.id))}</Row>
            <Row label="Rooms">{chips(roomsBy(w.id))}</Row>
          </>
        );
      }
      case 'opening': {
        const o = level.openings[selected.id];
        if (!o) return null;
        return (
          <>
            <Row label={OPENING_KIND[o.kind]}>{o.id}</Row>
            <Row label="Width">
              <Edit
                value={fmt(o.width)}
                label="Opening width"
                onCommit={setter(o.id, 'width', asLength, `${OPENING_KIND[o.kind]} width`)}
              />
            </Row>
            {o.height !== undefined && <Row label="Height">{len(o.height)}</Row>}
            {'sill' in o && (
              <Row label="Sill">
                {len(o.sill)} <Source provenance={o.provenance} field="sill" />
              </Row>
            )}
            {o.kind === 'door' && (
              <Row label="Swing">
                {SWING[o.swing]} <Source provenance={o.provenance} field="swing" />
              </Row>
            )}
            <Row label="In wall">{chips([o.wall])}</Row>
            <Row label="From start">{len(o.offset)}</Row>
          </>
        );
      }
      case 'column': {
        const c = level.columns[selected.id];
        if (!c) return null;
        return (
          <>
            <Row label="Column">{c.id}</Row>
            <Row label="Size">
              <span className="pc-mono">
                {formatLength(c.size[0], units)} × {formatLength(c.size[1], units)}
              </span>
            </Row>
            <Row label="Turned">
              <span className="pc-mono">{c.rotation_deg}°</span>
            </Row>
          </>
        );
      }
      case 'stair': {
        const s = level.stairs[selected.id];
        if (!s) return null;
        const xs = s.polygon.map((p) => p[0]);
        const ys = s.polygon.map((p) => p[1]);
        return (
          <>
            <Row label="Stair">{s.id}</Row>
            <Row label="Direction">
              {s.direction === 'up' ? 'Up' : 'Down'}{' '}
              <Source provenance={s.provenance} field="direction" />
            </Row>
            <Row label="Size">
              <span className="pc-mono">
                {formatLength(Math.max(...xs) - Math.min(...xs), units)} ×{' '}
                {formatLength(Math.max(...ys) - Math.min(...ys), units)}
              </span>
            </Row>
            {s.steps !== undefined && <Row label="Steps">{s.steps}</Row>}
          </>
        );
      }
      case 'separator': {
        const s = level.separators[selected.id];
        if (!s) return null;
        return (
          <>
            <Row label="Separator">{s.id}</Row>
            <Row label="Length">
              <Edit
                value={fmt(Math.hypot(s.end[0] - s.start[0], s.end[1] - s.start[1]))}
                label="Separator length"
                onCommit={lengthOf(s.id, `Separator ${s.id}`)}
              />
            </Row>
            <Row label="Rooms">{chips(roomsBy(s.id))}</Row>
          </>
        );
      }
      case 'line': {
        const l = level.lines[selected.id];
        if (!l) return null;
        const pts = l.closed ? [...l.points, l.points[0]!] : l.points;
        const total = pts
          .slice(1)
          .reduce((a, p, i) => a + Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]), 0);
        return (
          <>
            <Row label="Line">{l.id}</Row>
            <Row label="Points">
              {l.points.length}
              {l.closed ? ', closed' : ''}
            </Row>
            <Row label="Length">
              {l.points.length === 2 && !l.closed ? (
                <Edit
                  value={fmt(total)}
                  label="Line length"
                  onCommit={lengthOf(l.id, `Line ${l.id}`)}
                />
              ) : (
                len(total)
              )}
            </Row>
          </>
        );
      }
      case 'dimension': {
        const m = level.dimensions[selected.id];
        if (!m) return null;
        return (
          <>
            <Row label="Dimension">{m.id}</Row>
            <Row label="Measures">
              <Edit
                value={fmt(Math.hypot(m.end[0] - m.start[0], m.end[1] - m.start[1]))}
                label="Dimension value"
                onCommit={lengthOf(m.id, 'The dimension')}
              />
            </Row>
            <Note>Type a new value: when it measures a wall, the wall changes length.</Note>
          </>
        );
      }
      case 'text': {
        const t = level.texts[selected.id];
        if (!t) return null;
        return (
          <>
            <Row label="Note">
              <Edit
                value={t.text}
                label="Note text"
                mono={false}
                onCommit={setter(t.id, 'text', asText, 'Note')}
              />
            </Row>
            <Row label="Text height">
              <Edit
                value={fmt(t.size)}
                label="Text height"
                onCommit={setter(t.id, 'size', asLength, 'Text height')}
              />
            </Row>
          </>
        );
      }
      case 'hatch': {
        const h = level.hatches[selected.id];
        if (!h) return null;
        const area =
          Math.abs(
            h.polygon.reduce((a, p, i) => {
              const q = h.polygon[(i + 1) % h.polygon.length]!;
              return a + p[0] * q[1] - q[0] * p[1];
            }, 0) / 2,
          ) / 10000;
        return (
          <>
            <Row label="Hatch">{h.id}</Row>
            <Row label="Pattern">
              <Choose
                value={h.pattern}
                label="Hatch pattern"
                options={[
                  ['diagonal', 'Diagonal'],
                  ['cross', 'Cross'],
                  ['dots', 'Dots'],
                  ['solid', 'Solid'],
                ]}
                onCommit={setter(h.id, 'pattern', (v) => v, 'Hatch pattern')}
              />
            </Row>
            <Row label="Area">
              <span className="pc-mono">{formatArea(area, units)}</span>
            </Row>
          </>
        );
      }
      default:
        return null;
    }
  })();

  if (!body)
    return (
      <div className="ed-props">
        <Row label="Plan">{plan.meta.name}</Row>
        <Row label="Facing">
          {plan.meta.facing} <Source provenance={plan.meta.provenance} field="facing" />
        </Row>
        <Row label="Units">{units === 'm' ? 'Metres' : 'Feet-inches'}</Row>
        <Note>Click a room, wall, door, window or any other object to see its properties.</Note>
      </div>
    );
  return (
    <div className="ed-props">
      {body}
      {onCommand && <Note>Type a new value and press Enter. ⌘Z undoes it.</Note>}
    </div>
  );
}
