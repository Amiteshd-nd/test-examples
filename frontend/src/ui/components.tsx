import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { Icon } from './icons.tsx';

// PlanCraft UI components (design/DESIGN.md → Components). Styles live in design/ui.css.

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

const NEXT = ['ArrowRight', 'ArrowDown'];
const PREV = ['ArrowLeft', 'ArrowUp'];

/**
 * Arrow keys, Home and End move between the buttons of a radio group, tab list or toolbar,
 * which is one Tab stop (WAI-ARIA roving tabindex, skill §6). `onMove` gets the new index.
 */
function rovingKeys(e: ReactKeyboardEvent<HTMLElement>, onMove?: (i: number) => void) {
  if (![...NEXT, ...PREV, 'Home', 'End'].includes(e.key)) return;
  const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
  const i = items.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  e.preventDefault();
  e.stopPropagation(); // not also a canvas pan or a Vault shortcut
  const n =
    e.key === 'Home'
      ? 0
      : e.key === 'End'
        ? items.length - 1
        : (i + (NEXT.includes(e.key) ? 1 : -1) + items.length) % items.length;
  items[n]?.focus();
  onMove?.(n);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  pill?: boolean;
};

export function Button({
  variant = 'secondary',
  size = 'md',
  pill,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        'pc-btn',
        `pc-btn--${variant}`,
        size !== 'md' && `pc-btn--${size}`,
        pill && 'pc-btn--pill',
        className,
      )}
      {...rest}
    />
  );
}

export function IconButton({
  label,
  pressed,
  marks,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  pressed?: boolean;
  marks?: boolean;
}) {
  return (
    <button
      type="button"
      className={cx('pc-btn pc-btn--ghost pc-icon-btn', marks && 'pc-marks')}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      {...rest}
    >
      {children}
    </button>
  );
}

export function RoundButton({
  label,
  children = <Icon.ArrowRight />,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" className="pc-btn pc-round" aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

export function Field({
  label,
  help,
  error,
  children,
}: {
  label: string;
  help?: string;
  error?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="pc-field">
      <label className="pc-label" htmlFor={id}>
        {label}
      </label>
      {children(id)}
      {error ? (
        <span className="pc-help pc-help--error">{error}</span>
      ) : help ? (
        <span className="pc-help">{help}</span>
      ) : null}
    </div>
  );
}

export function TextInput({
  pill,
  error,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { pill?: boolean; error?: boolean }) {
  return (
    <div
      className={cx(
        'pc-input-wrap',
        pill && 'pc-input-wrap--pill',
        error && 'pc-input-wrap--error',
      )}
    >
      <input className="pc-input" {...rest} />
    </div>
  );
}

export function NumberInput({
  unit,
  error,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { unit: string; error?: boolean }) {
  return (
    <div className={cx('pc-input-wrap', error && 'pc-input-wrap--error')}>
      <input className="pc-input pc-input--number" inputMode="decimal" {...rest} />
      <span className="pc-unit">{unit}</span>
    </div>
  );
}

export function Select({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id?: string;
  /** Accessible name when no <label for> points at the select (e.g. a "Sort" control). */
  label?: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="pc-input-wrap">
      <select
        id={id}
        aria-label={label}
        className="pc-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <Icon.ChevronDown />
    </div>
  );
}

export function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className="pc-segmented"
      role="radiogroup"
      aria-label={label}
      onKeyDown={(e) => rovingKeys(e, (i) => onChange(options[i]!))}
    >
      {options.map((o, i) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={o === value}
          tabIndex={o === value || (i === 0 && !options.includes(value)) ? 0 : -1}
          onClick={() => onChange(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <span className="pc-check">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="pc-switch"
        onClick={() => onChange(!checked)}
      />
      <span>{label}</span>
    </span>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="pc-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      className="pc-tabs"
      role="tablist"
      onKeyDown={(e) => rovingKeys(e, (i) => onChange(tabs[i]!.id))}
    >
      {tabs.map((t, i) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          className="pc-tab"
          aria-selected={t.id === value}
          tabIndex={t.id === value || (i === 0 && !tabs.some((x) => x.id === value)) ? 0 : -1}
          onClick={() => onChange(t.id)}
        >
          {t.label} {t.count !== undefined && <span className="pc-mono">({t.count})</span>}
        </button>
      ))}
    </div>
  );
}

export function PanelSection({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="pc-panel-section" data-open={open}>
      <button
        type="button"
        className="pc-panel-head"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="pc-chevron">
          <Icon.ChevronDown />
        </span>
        <span className="pc-section">
          {title} {count !== undefined && <span className="pc-mono pc-muted">({count})</span>}
        </span>
      </button>
      {open && <div className="pc-panel-body">{children}</div>}
    </section>
  );
}

export function Card({
  title,
  opens,
  marks = true,
  children,
}: {
  title: ReactNode;
  opens?: boolean;
  marks?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cx('pc-card', marks && 'pc-marks')}>
      <div className="pc-card-head">
        <span>{title}</span>
        {opens && <Icon.ArrowUpRight />}
      </div>
      {children}
    </div>
  );
}

export function MetricTile({
  label,
  value,
  unit,
  bar,
}: {
  label: string;
  value: string;
  unit?: string;
  bar?: 'strong' | 'normal';
}) {
  return (
    <div className="pc-tile">
      <span className="pc-micro pc-tile-label">{label}</span>
      <span className="pc-metric">
        {value}
        {unit && <span className="pc-unit"> {unit}</span>}
      </span>
      {bar && <span className={cx('pc-bar', bar === 'strong' && 'pc-bar--strong')} />}
    </div>
  );
}

export function Chip({ accent, children }: { accent?: boolean; children: ReactNode }) {
  return <span className={cx('pc-chip pc-micro', accent && 'pc-chip--accent')}>{children}</span>;
}

export function Status({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'error' | 'accent';
  children: ReactNode;
}) {
  return <span className={`pc-status pc-status--${tone}`}>{children}</span>;
}

export interface IssueView {
  severity: 'error' | 'warning' | 'info';
  message: string;
  how_to_fix: string;
  object_ids: string[];
  source: string;
}

export function IssueRow({ issue }: { issue: IssueView }) {
  const colour =
    issue.severity === 'error'
      ? 'var(--error)'
      : issue.severity === 'warning'
        ? 'var(--warn)'
        : 'var(--accent-strong)';
  return (
    <div className="pc-issue" title={issue.source}>
      <span className="pc-issue-dot" style={{ background: colour }} aria-label={issue.severity} />
      <span>{issue.message}</span>
      <span className="pc-issue-fix">{issue.how_to_fix}</span>
      <span className="pc-issue-ids">
        {issue.object_ids.map((id) => (
          <Chip key={id}>{id}</Chip>
        ))}
      </span>
    </div>
  );
}

export function ChatBubble({
  from,
  children,
}: {
  from: 'user' | 'assistant';
  children: ReactNode;
}) {
  return <div className={`pc-bubble pc-bubble--${from}`}>{children}</div>;
}

export function ToolCall({
  tool,
  steps,
  onUndo,
}: {
  tool: string;
  steps: string[];
  onUndo?: () => void;
}) {
  return (
    <div className="pc-toolcall">
      <span className="pc-eyebrow">( {tool} )</span>
      <ol>
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {onUndo && (
        <span>
          <button type="button" className="pc-link" onClick={onUndo}>
            Undo
          </button>
        </span>
      )}
    </div>
  );
}

export function Tooltip({ label, shortcut }: { label: string; shortcut?: string }) {
  return (
    <span className="pc-tooltip" role="tooltip">
      {label}
      {shortcut && <kbd>{shortcut}</kbd>}
    </span>
  );
}

export function Dialog({
  title,
  children,
  footer,
  inline,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
  inline?: boolean;
}) {
  const box = (
    <div
      className="pc-dialog"
      role="dialog"
      aria-label={title}
      aria-modal={inline ? undefined : true}
    >
      <div className="pc-dialog-body">
        <h2 className="pc-section">{title}</h2>
        {children}
      </div>
      <div className="pc-dialog-foot">{footer}</div>
    </div>
  );
  return inline ? box : <div className="pc-backdrop">{box}</div>;
}

export function Toolbar({ children, label }: { children: ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // One Tab stop: the pressed tool (or the first button); arrow keys reach the others.
  useEffect(() => {
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const stop = items.find((b) => b.getAttribute('aria-pressed') === 'true') ?? items[0];
    for (const b of items) b.tabIndex = b === stop ? 0 : -1;
  });
  return (
    <div
      ref={ref}
      className="pc-toolbar"
      role="toolbar"
      aria-label={label}
      onKeyDown={(e) => rovingKeys(e)}
      onFocus={(e) => {
        for (const b of ref.current?.querySelectorAll('button') ?? []) {
          b.tabIndex = b === (e.target as Element) ? 0 : -1;
        }
      }}
    >
      {children}
    </div>
  );
}
export const ToolbarSep = () => <span className="pc-toolbar-sep" aria-hidden="true" />;

export function SelectionPill({
  text,
  action,
  onAction,
}: {
  text: ReactNode;
  action: string;
  onAction?: () => void;
}) {
  return (
    <span className="pc-pill">
      <span>{text}</span>
      <Button
        size="sm"
        variant="ghost"
        style={{ color: 'var(--accent-strong)' }}
        onClick={onAction}
      >
        {action}
      </Button>
    </span>
  );
}

/** `width` is the bar's real length on screen in px (two equal segments). */
export function ScaleBar({ label, width = 80 }: { label: string; width?: number }) {
  return (
    <span className="pc-scalebar">
      <span className="pc-mono pc-small">{label}</span>
      <span className="pc-scalebar-bar">
        <span style={{ width: width / 2 }} />
        <span style={{ width: width / 2 }} />
      </span>
    </span>
  );
}
