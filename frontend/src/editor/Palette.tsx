import { useRef, useState, type ReactNode } from 'react';
import { Icon } from '../ui/icons.tsx';
import { useModalFocus } from '../vault/dialogs.tsx';

// The editor's ⌘K command palette (P2.2a): type to filter, arrows to move, Enter to run, Esc to
// close. Same look and combobox pattern as the Vault's palette (P14.1, P14.5).

export interface Command {
  group: string;
  label: string;
  icon?: ReactNode;
  /** Shown on the right, e.g. the shortcut. */
  hint?: string;
  run: () => void;
}

export function Palette({
  commands,
  typed,
  onClose,
}: {
  commands: Command[];
  /** Items made from what is typed (e.g. a typed command `MOVE W1 0,0 30,0`), shown first. */
  typed?: (query: string) => Command[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(ref);
  const q = query.trim().toLowerCase();
  const items = [
    ...(typed?.(query.trim()) ?? []),
    ...commands.filter(
      (c) => !q || c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q),
    ),
  ];
  const pick = Math.min(active, items.length - 1);
  // The palette closes first and gives focus back, then the command runs: a command that hides
  // the panel holding that focus can then move it to the panel's toggle.
  const choose = (c: Command) => {
    onClose();
    setTimeout(c.run);
  };
  const groups: { name: string; rows: { c: Command; i: number }[] }[] = [];
  items.forEach((c, i) => {
    const g = groups.at(-1);
    if (g?.name === c.group) g.rows.push({ c, i });
    else groups.push({ name: c.group, rows: [{ c, i }] });
  });
  return (
    <div
      className="pc-backdrop vlt-palette-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        className="vlt-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="vlt-palette-input">
          <Icon.Search />
          <input
            autoFocus
            value={query}
            placeholder="Type a command"
            aria-label="Type a command"
            role="combobox"
            aria-expanded="true"
            aria-controls="ed-palette-results"
            aria-activedescendant={items[pick] ? `ed-palette-item-${pick}` : undefined}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((pick + 1) % Math.max(1, items.length));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((pick - 1 + items.length) % Math.max(1, items.length));
              } else if (e.key === 'Enter' && items[pick]) choose(items[pick]);
            }}
          />
          <span className="vlt-kbd">esc</span>
        </div>
        <div
          id="ed-palette-results"
          className="vlt-palette-list"
          role="listbox"
          aria-label="Commands"
        >
          {groups.map((g) => (
            <div key={g.name} className="vlt-palette-group" role="group" aria-label={g.name}>
              <span className="pc-eyebrow" aria-hidden="true">
                {g.name}
              </span>
              {g.rows.map(({ c, i }) => (
                <div
                  key={c.label}
                  id={`ed-palette-item-${i}`}
                  role="option"
                  aria-selected={i === pick}
                  className="vlt-palette-item"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(c)}
                >
                  {c.icon}
                  <span className="vlt-palette-label">{c.label}</span>
                  {c.hint && <span className="vlt-kbd">{c.hint}</span>}
                </div>
              ))}
            </div>
          ))}
          {!items.length && (
            <p className="pc-small vlt-palette-none">No command matches “{query}”.</p>
          )}
        </div>
      </div>
    </div>
  );
}
