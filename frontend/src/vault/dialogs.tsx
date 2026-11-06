import type { ConversionReport, FolderColor, TreeNode } from '@plancraft/engine';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button, Dialog, Field, Select, Status, TextInput } from '../ui/components.tsx';
import { useModalFocus } from '../ui/modal.ts';
import { FolderIcon } from '../ui/icons.tsx';

// Dialogs of the Vault screen (P14.3): new folder, new plan, rename, move, import results and
// confirmations. Each is a small form: Enter confirms, Esc cancels.

/** Moved to ui/modal.ts (shared with the editor and Settings); re-exported for existing imports. */
export { useModalFocus };

export const COLOURS: [FolderColor, string][] = [
  ['graphite', 'Graphite'],
  ['blue', 'Blueprint blue'],
  ['orange', 'Orange'],
  ['green', 'Green'],
  ['purple', 'Purple'],
  ['red', 'Red'],
];

function FormDialog({
  title,
  submit,
  onSubmit,
  onCancel,
  danger,
  children,
}: {
  title: string;
  submit: string;
  onSubmit: () => void;
  onCancel: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onCancel]);
  const ref = useRef<HTMLFormElement>(null);
  useModalFocus(ref);
  return (
    <form
      ref={ref}
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <Dialog
        title={title}
        footer={
          <>
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant={danger ? 'danger' : 'primary'} type="submit">
              {submit}
            </Button>
          </>
        }
      >
        {children}
      </Dialog>
    </form>
  );
}

export function NameDialog({
  title,
  submit,
  initial = '',
  colour,
  onSubmit,
  onCancel,
}: {
  title: string;
  submit: string;
  initial?: string;
  /** Show the colour choice (new folder). */
  colour?: FolderColor;
  onSubmit: (name: string, colour: FolderColor) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial);
  const [pick, setPick] = useState<FolderColor>(colour ?? 'graphite');
  const [error, setError] = useState('');
  return (
    <FormDialog
      title={title}
      submit={submit}
      onCancel={onCancel}
      onSubmit={() => (name.trim() ? onSubmit(name.trim(), pick) : setError('A name is needed.'))}
    >
      <Field label="Name" error={error}>
        {(id) => (
          <TextInput
            id={id}
            value={name}
            autoFocus
            maxLength={120}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            error={!!error}
          />
        )}
      </Field>
      {colour && (
        <div className="vlt-swatches" role="radiogroup" aria-label="Colour">
          {COLOURS.map(([c, label]) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={pick === c}
              aria-label={label}
              title={label}
              className="vlt-swatch-btn"
              onClick={() => setPick(c)}
            >
              <FolderIcon colour={c} />
            </button>
          ))}
        </div>
      )}
    </FormDialog>
  );
}

const PLOTS: [string, [number, number] | null][] = [
  ['30 × 40 ft', [914.4, 1219.2]],
  ['30 × 50 ft', [914.4, 1524]],
  ['40 × 60 ft', [1219.2, 1828.8]],
  ['Other size', null],
];
const FACINGS = ['north', 'east', 'south', 'west'] as const;

export function NewPlanDialog({
  onSubmit,
  onCancel,
}: {
  onSubmit: (p: { name: string; plot: [number, number]; facing: (typeof FACINGS)[number] }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('New plan');
  const [plot, setPlot] = useState(PLOTS[0]![0]);
  const [w, setW] = useState('9.14');
  const [d, setD] = useState('12.19');
  const [facing, setFacing] = useState<(typeof FACINGS)[number]>('north');
  const [error, setError] = useState('');
  const submit = () => {
    if (!name.trim()) return setError('A name is needed.');
    const preset = PLOTS.find(([l]) => l === plot)?.[1];
    const custom: [number, number] = [Number(w) * 100, Number(d) * 100];
    const size = preset ?? custom;
    if (!(size[0] >= 300 && size[1] >= 300 && size[0] <= 20_000 && size[1] <= 20_000))
      return setError('The plot must be between 3 m and 200 m on each side.');
    onSubmit({
      name: name.trim(),
      plot: [Math.round(size[0] * 10) / 10, Math.round(size[1] * 10) / 10],
      facing,
    });
  };
  return (
    <FormDialog title="New plan" submit="Create plan" onSubmit={submit} onCancel={onCancel}>
      <Field label="Name" error={error}>
        {(id) => (
          <TextInput
            id={id}
            value={name}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
          />
        )}
      </Field>
      <Field label="Plot">
        {(id) => <Select id={id} options={PLOTS.map(([l]) => l)} value={plot} onChange={setPlot} />}
      </Field>
      {plot === 'Other size' && (
        <div className="vlt-row2">
          <Field label="Width along the road, m">
            {(id) => (
              <TextInput
                id={id}
                inputMode="decimal"
                value={w}
                onChange={(e) => setW(e.target.value)}
              />
            )}
          </Field>
          <Field label="Depth, m">
            {(id) => (
              <TextInput
                id={id}
                inputMode="decimal"
                value={d}
                onChange={(e) => setD(e.target.value)}
              />
            )}
          </Field>
        </div>
      )}
      <Field label="Road side (facing)">
        {(id) => (
          <Select
            id={id}
            options={[...FACINGS]}
            value={facing}
            onChange={(v) => setFacing(v as (typeof FACINGS)[number])}
          />
        )}
      </Field>
    </FormDialog>
  );
}

/** Choose a folder (or the top level) to move or copy into. */
export function FolderPickerDialog({
  title,
  submit,
  tree,
  disabled = [],
  initial = null,
  onSubmit,
  onCancel,
}: {
  title: string;
  submit: string;
  tree: TreeNode[];
  /** Folders that can't be chosen (e.g. the ones being moved). */
  disabled?: string[];
  initial?: string | null;
  onSubmit: (folderId: string | null) => void;
  onCancel: () => void;
}) {
  const [pick, setPick] = useState<string | null>(initial);
  const rows: { id: string | null; name: string; colour: string; depth: number; off: boolean }[] = [
    { id: null, name: 'Projects (top level)', colour: 'graphite', depth: 0, off: false },
  ];
  const walk = (nodes: TreeNode[], depth: number, off: boolean) => {
    for (const n of nodes) {
      const blocked = off || disabled.includes(n.folder.id);
      rows.push({
        id: n.folder.id,
        name: n.folder.name,
        colour: n.folder.color,
        depth,
        off: blocked,
      });
      walk(n.children, depth + 1, blocked);
    }
  };
  walk(tree, 1, false);
  return (
    <FormDialog title={title} submit={submit} onSubmit={() => onSubmit(pick)} onCancel={onCancel}>
      <div className="vlt-picker" role="listbox" aria-label="Folders">
        {rows.map((r) => (
          <button
            key={r.id ?? 'top'}
            type="button"
            role="option"
            className="vlt-tree-row"
            aria-selected={pick === r.id}
            disabled={r.off}
            style={{ paddingLeft: `${(8 + r.depth * 16) / 16}rem` }}
            onClick={() => setPick(r.id)}
            onDoubleClick={() => !r.off && onSubmit(r.id)}
          >
            <FolderIcon colour={r.colour} />
            <span>{r.name}</span>
          </button>
        ))}
      </div>
    </FormDialog>
  );
}

export function ConfirmDialog({
  title,
  message,
  submit,
  onSubmit,
  onCancel,
}: {
  title: string;
  message: ReactNode;
  submit: string;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <FormDialog title={title} submit={submit} danger onSubmit={onSubmit} onCancel={onCancel}>
      <span>{message}</span>
    </FormDialog>
  );
}

export interface ImportOutcome {
  fileName: string;
  /** The new vault file, when something was imported. */
  fileId?: string;
  report?: ConversionReport;
  error?: string;
}

/** What an import produced, with the way into the editor. */
export function ImportResultDialog({
  outcomes,
  onOpen,
  onClose,
}: {
  outcomes: ImportOutcome[];
  onOpen: (fileId: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(ref);
  const opened = outcomes.filter((o) => o.fileId);
  return (
    <div ref={ref}>
      <Dialog
        title={opened.length === 1 ? 'Imported' : `Imported ${opened.length} of ${outcomes.length}`}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            {opened.length === 1 && (
              <Button variant="primary" autoFocus onClick={() => onOpen(opened[0]!.fileId!)}>
                Open in editor
              </Button>
            )}
          </>
        }
      >
        <div className="vlt-import-list">
          {outcomes.map((o, i) => {
            const r = o.report;
            const guessed = r?.items.filter((x) => x.outcome === 'guessed').length ?? 0;
            const failed = r?.items.filter((x) => x.outcome === 'failed').length ?? 0;
            return (
              <div key={i} className="vlt-import-row">
                <span className="vlt-import-name">{o.fileName}</span>
                {o.error ? (
                  <Status tone="error">{o.error}</Status>
                ) : r ? (
                  <>
                    <Status tone={r.status === 'success' ? 'ok' : 'warn'}>
                      {r.status === 'success' ? 'Converted' : 'Converted with problems'}
                    </Status>
                    <span className="pc-small">
                      {r.counts.walls} walls · {r.counts.rooms} rooms ·{' '}
                      {r.counts.doors + r.counts.windows + r.counts.ventilators + r.counts.openings}{' '}
                      openings
                      {guessed ? ` · ${guessed} guesses to check` : ''}
                      {failed ? ` · ${failed} problems` : ''}
                    </span>
                  </>
                ) : (
                  <Status tone="ok">Added</Status>
                )}
                {o.fileId && opened.length > 1 && (
                  <Button size="sm" onClick={() => onOpen(o.fileId!)}>
                    Open
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Dialog>
    </div>
  );
}
