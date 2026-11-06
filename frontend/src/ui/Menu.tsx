import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

// A floating menu (design/DESIGN.md → Menu): for "+ New" and right-click. Opens at a point,
// stays inside the window, closes on Esc, Tab, a click outside or a choice. Arrow keys, Home and
// End move; Enter chooses. On close, focus goes back to whatever had it before (WAI-ARIA menu).

export type MenuEntry =
  | {
      label: string;
      icon?: ReactNode;
      shortcut?: string;
      danger?: boolean;
      disabled?: boolean;
      checked?: boolean;
      onSelect: () => void;
    }
  | { heading: string }
  | 'separator';

export function Menu({
  at,
  entries,
  label,
  onClose,
}: {
  at: { x: number; y: number };
  entries: MenuEntry[];
  label: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(at);
  // The button or item that had focus when the menu opened (read before the menu takes focus).
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  useEffect(
    () => () => {
      // Return focus unless the user has already put it somewhere else (a click outside, a dialog).
      const now = document.activeElement;
      if (!now || now === document.body || ref.current?.contains(now)) opener?.focus();
    },
    [opener],
  );
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(at.x, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(at.y, window.innerHeight - height - 8)),
    });
    el.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [at]);
  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', key, true);
    window.addEventListener('blur', onClose);
    return () => {
      window.removeEventListener('pointerdown', away, true);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);
  const move = (e: ReactKeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      onClose();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const items = [
      ...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []),
    ];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? items.length - 1
          : (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };
  return createPortal(
    <div
      ref={ref}
      className="pc-menu"
      role="menu"
      aria-label={label}
      style={{ left: pos.x, top: pos.y }}
      onKeyDown={move}
      onContextMenu={(e) => e.preventDefault()}
    >
      {entries.map((e, i) =>
        e === 'separator' ? (
          <div key={i} className="pc-menu-sep" role="separator" />
        ) : 'heading' in e ? (
          <div key={i} className="pc-menu-heading pc-micro">
            {e.heading}
          </div>
        ) : (
          <button
            key={i}
            type="button"
            role={e.checked === undefined ? 'menuitem' : 'menuitemradio'}
            aria-checked={e.checked}
            className={`pc-menu-item${e.danger ? ' pc-menu-item--danger' : ''}`}
            disabled={e.disabled}
            onClick={() => {
              // Hand focus back first, so a dialog this choice opens returns to the opener too.
              opener?.focus({ preventScroll: true });
              onClose();
              e.onSelect();
            }}
          >
            <span className="pc-menu-icon">{e.checked ? '✓' : e.icon}</span>
            {e.label}
            {e.shortcut && <span className="pc-menu-kbd">{e.shortcut}</span>}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}
