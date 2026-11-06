import {
  ENGINE_VERSION,
  autoTag,
  buildPlanIndex,
  exportDxf,
  firstLevel,
  importDxf,
  loadPlan,
  oneBhkDxf,
  planDrawing,
  roomTypeLabel,
  validatePlan,
  values,
  type DerivedRoom,
  type Level,
  findCommand,
  formatCommand,
  formatUlid,
  parseCommand,
  type CommandRequest,
  type LibraryEntry,
  type Outcome,
  type Pick,
  type Plan,
} from '@plancraft/engine';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
} from 'react';
import { go, routeHash } from '../app/route.ts';
import { FetchStore } from '../library/fetch-store.ts';
import { useVault } from '../vault/client.ts';
import {
  Button,
  Chip,
  Dialog,
  IconButton,
  IssueRow,
  MetricTile,
  Segmented,
  SelectionPill,
  ScaleBar,
  Status,
  Tabs,
  Toolbar,
  ToolbarSep,
} from '../ui/components.tsx';
import { formatArea, formatLength, scaleBarLength, type DisplayUnits } from '../ui/format.ts';
import { cssPx } from '../design/ui-scale.ts';
import { Icon } from '../ui/icons.tsx';
import type { PlanLayer } from '../ui/PlanView.tsx';
import { SettingsDialog } from '../ui/SettingsDialog.tsx';
import { fitView, zoomAt, type Size, type View } from '../ui/view.ts';
import { draftDecision, localDraft, type SaveStatus } from './autosave.ts';
import { CANVAS_INSETS, Canvas, type Cursor, type MoveDrag } from './Canvas.tsx';
import { Palette, type Command } from './Palette.tsx';
import {
  PANEL_SIDES,
  browserStore,
  isOpen,
  isTextField,
  keepStill,
  panelShortcut,
  readPanels,
  shortcutLabel,
  writePanels,
  type PanelCommand,
  type PanelSide,
  type Rect,
  type ResizableSide,
} from './panels.ts';
import { HelpDialog } from './HelpDialog.tsx';
import { Properties } from './Properties.tsx';
import { ResizeHandle } from './ResizeHandle.tsx';
import { ToolIcon } from './tool-icons.tsx';
import { ToolPrompt, ToolShapes } from './ToolPrompt.tsx';
import { TOOL_LIST, keyLabel, toolInfo } from './tools.ts';
import { READ_ONLY, useEditing } from './useEditing.ts';
import { useTools } from './useTools.ts';
import { useFileSave } from './useFileSave.ts';
import {
  editorReducer,
  initialUi,
  type EditorAction,
  type EditorUi,
  type LeftTab,
  type RightTab,
  type Snap,
  type Tool,
} from './state.ts';

// The editor (P2.2 shell, P2.3 canvas): top bar, panel rail, left panel, canvas, chat column,
// right panel and status bar, arranged per design/DESIGN.md. Plans come from the Plan Library
// through a DocumentStore (`#<plan-id>` opens one); the shell only arranges panels and asks the
// engine for facts (rooms, issues, metrics, drawing, picking, snapping, DXF). P2.2a: the side
// panels and the chat hide and show (top-bar toggles, edge tabs, shortcuts, ⌘K) without moving
// the drawing, and the layout is remembered.

function useNarrow(query = '(max-width: 1099px)') {
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return narrow;
}

/** Shown when the library is empty or unreachable: the synthetic drafted 1BHK, imported. */
function demoPlan(): Plan {
  return importDxf(oneBhkDxf({ unit: 'mm', header: true, polylines: false, wrapInBlock: false }), {
    name: 'Demo 1BHK (imported)',
  }).plan!;
}

/** What the editor opens: a file from the Vault or a plan from the Plan Library (P14.3). */
export type EditorSource = { kind: 'file'; id: string } | { kind: 'library'; id: string };

interface Doc {
  /** Library id; null for a vault file or the built-in demo. */
  id: string | null;
  plan: Plan;
  /** The vault file shown: name, folder (for Home), revision, and whether a draft was recovered. */
  file?: { id: string; name: string; folderId: string | null; rev: number; recovered: boolean };
}

const LAYERS: [PlanLayer, string][] = [
  ['plot', 'Plot boundary'],
  ['rooms', 'Rooms'],
  ['walls', 'Walls'],
  ['openings', 'Doors and windows'],
  ['separators', 'Room separators'],
  ['stairs', 'Stairs'],
  ['columns', 'Columns'],
  ['labels', 'Room labels'],
  ['hatches', 'Hatches'],
  ['lines', 'Lines'],
  ['dimensions', 'Dimensions'],
  ['texts', 'Notes'],
];
/** Tools that take typed values (A2 M5); digits typed on the canvas go to the prompt line. */
const TYPED_TOOLS = new Set<Tool>([
  'wall',
  'line',
  'separator',
  'rectangle',
  'room',
  'stair',
  'dimension',
  'move',
  'copy',
  'rotate',
  'mirror',
  'offset',
]);
const SNAPS: [Snap, string][] = [
  ['grid', 'Grid'],
  ['endpoint', 'End'],
  ['midpoint', 'Mid'],
  ['perpendicular', 'Perp'],
];
const SNAP_WORD: Record<Cursor['snap'], string> = {
  endpoint: 'End',
  midpoint: 'Mid',
  perpendicular: 'Perp',
  grid: 'Grid',
  none: '',
};
const PICK_WORD: Record<Pick['kind'], string> = {
  room: 'Room',
  wall: 'Wall',
  opening: 'Opening',
  column: 'Column',
  stair: 'Stair',
  separator: 'Separator',
  line: 'Line',
  dimension: 'Dimension',
  text: 'Note',
  hatch: 'Hatch',
};
/** The save state in the top bar (A2 P14.4: "Saved · Saving… · Offline"). */
type SaveShown = SaveStatus | 'library';
const SAVE_WORD: Record<SaveShown, string> = {
  saved: 'Saved',
  pending: 'Saving…',
  saving: 'Saving…',
  offline: 'Offline',
  conflict: 'Changed elsewhere',
  library: 'Library plan',
};
const SAVE_TONE: Record<SaveShown, 'ok' | 'warn' | 'error' | 'accent'> = {
  saved: 'ok',
  pending: 'accent',
  saving: 'accent',
  offline: 'warn',
  conflict: 'error',
  library: 'accent',
};
const SAVE_HINT: Record<SaveShown, string> = {
  saved: 'Every change is saved to the Vault as you work.',
  pending: 'Saving your latest change.',
  saving: 'Saving your latest change.',
  offline: 'Can’t reach the Vault. Your changes are kept in this browser and saved when it’s back.',
  conflict:
    'This file was saved from another tab or window. Your changes are kept in this browser: reopen the file and they are saved as a copy beside it, so nothing is lost.',
  library:
    'A plan from the Plan Library, shown read-only. Use it as a starting point in the Vault to edit it.',
};

const MAC = /Mac|iP(hone|ad|od)/.test(navigator.userAgent);
const keys = (command: PanelCommand) => shortcutLabel(command, MAC);
const SIDE_NAME: Record<PanelSide, string> = {
  left: 'left panel',
  right: 'right panel',
  chat: 'chat',
};
/** New object ids for typed commands (A2 M2): ULIDs from this browser's clock and randomness. */
const BROWSER_IDS = {
  next: () => formatUlid(Date.now(), crypto.getRandomValues(new Uint8Array(10))),
};
const UNDO_KEY = MAC ? '⌘Z' : 'Ctrl+Z';
const REDO_KEY = MAC ? '⇧⌘Z' : 'Ctrl+Y';
/** Where each kind of picked object lives in a level. */
const PICK_MAP = {
  room: 'rooms',
  wall: 'walls',
  opening: 'openings',
  column: 'columns',
  stair: 'stairs',
  separator: 'separators',
  line: 'lines',
  dimension: 'dimensions',
  text: 'texts',
  hatch: 'hatches',
} as const;
const OPENING_WORD = {
  door: 'Door',
  window: 'Window',
  ventilator: 'Ventilator',
  opening: 'Opening',
};
/** How an object is named in messages: a room by its name, others as "Wall W3". */
function pickName(level: Level, pick: Pick): string {
  if (pick.kind === 'room') return level.rooms[pick.id]?.name ?? pick.id;
  const o = pick.kind === 'opening' ? level.openings[pick.id] : undefined;
  return o ? `${OPENING_WORD[o.kind]} ${o.id}` : `${PICK_WORD[pick.kind]} ${pick.id}`;
}
/** What the editor shows about a plan: rooms, issues, metrics and the drawing. */
function factsOf(plan: Plan) {
  const checked = validatePlan(plan);
  return {
    rooms: checked.rooms,
    issues: checked.issues,
    tags: autoTag(plan),
    drawing: planDrawing(plan, checked.rooms),
  };
}

/** A top-bar button that hides or shows a panel; its icon shows the panel's state. */
function PanelToggle({
  side,
  open,
  onToggle,
}: {
  side: PanelSide;
  open: boolean;
  onToggle: () => void;
}) {
  const label = `${open ? 'Hide' : 'Show'} ${SIDE_NAME[side]}`;
  return (
    <IconButton
      id={`ed-toggle-${side}`}
      label={label}
      title={side === 'chat' ? label : `${label} (${keys(side)})`}
      aria-expanded={open}
      aria-controls={`ed-panel-${side}`}
      onClick={onToggle}
    >
      {side === 'chat' ? (
        <Icon.Chat />
      ) : (
        <span className={side === 'right' ? 'ed-flip' : 'ed-icon'}>
          {open ? <Icon.Sidebar /> : <Icon.SidebarHidden />}
        </span>
      )}
    </IconButton>
  );
}

function Panel({
  title,
  closeLabel,
  onClose,
  children,
}: {
  title: ReactNode;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <div className="ed-panel-head">
        <span className="pc-section">{title}</span>
        <IconButton label={closeLabel} onClick={onClose}>
          <Icon.Minus />
        </IconButton>
      </div>
      <div className="ed-panel-body">{children}</div>
    </>
  );
}

/** The Rooms panel; memoised so panning and zooming don't redraw a long list. */
const RoomList = memo(function RoomList({
  level,
  rooms,
  units,
  selectedId,
  onSelect,
}: {
  level: Level;
  rooms: DerivedRoom[];
  units: DisplayUnits;
  selectedId: string | null;
  onSelect: (pick: Pick) => void;
}) {
  const areas = new Map(rooms.map((r) => [r.room_id, r.area_m2]));
  return (
    <div className="ed-list">
      {values(level.rooms).map((r) => {
        const area = areas.get(r.id);
        return (
          <button
            key={r.id}
            type="button"
            className="ed-row"
            aria-selected={r.id === selectedId}
            onClick={() => onSelect({ kind: 'room', id: r.id })}
          >
            <span>
              <span className="ed-row-title">{r.name}</span>
              <span className="pc-small">{roomTypeLabel(r.type)}</span>
            </span>
            <span className="pc-mono pc-small">
              {area === undefined ? '—' : formatArea(area, units)}
            </span>
          </button>
        );
      })}
    </div>
  );
});

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** Loads the library and the open plan; keeps view settings (panels, units, snaps) across plans. */
export function Editor({ source }: { source: EditorSource }) {
  const store = useMemo(() => new FetchStore(), []);
  const { vault, change } = useVault();
  const narrow = useNarrow();
  const [ui, dispatch] = useReducer(editorReducer, undefined, () =>
    initialUi('m', narrow, readPanels(browserStore())),
  );
  useEffect(() => dispatch({ type: 'compact', compact: narrow }), [narrow]);
  // The panel layout is a preference of this user (this browser until P10.1), never the plan's.
  useEffect(() => {
    const t = setTimeout(() => writePanels(browserStore(), ui.panels), 250);
    return () => clearTimeout(t);
  }, [ui.panels]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  useEffect(() => {
    store
      .loadIndex()
      .then((index) => setEntries(index.entries))
      .catch(() => {
        setEntries([]);
        setNote('The plan library could not be reached, so the built-in sample is open.');
      });
  }, [store]);
  // A vault file: its plan and record from the Vault, or the unsaved draft left in this browser
  // by a refresh or crash (P14.4).
  useEffect(() => {
    if (source.kind !== 'file') return;
    let live = true;
    Promise.all([vault.loadDocument(source.id), vault.index()])
      .then(async ([saved, index]) => {
        // A load that was replaced (React may run this twice) must not act on the draft too.
        if (!live) return;
        const f = index.files[source.id]!;
        const drafts = localDraft<unknown>(f.id);
        const draft = drafts.read();
        let plan = saved;
        let recovered = false;
        if (draft) {
          const decision = draftDecision(
            {
              baseRev: draft.baseRev,
              docText: JSON.stringify(draft.doc),
              ...(draft.conflict ? { conflict: true } : {}),
            },
            { rev: f.doc_rev, docText: JSON.stringify(saved) },
          );
          const loaded = decision === 'same' ? null : loadPlan(draft.doc);
          if (decision === 'apply' && loaded?.ok) {
            plan = loaded.plan;
            recovered = true;
          } else {
            // Saved elsewhere since: keep the unsaved changes as a copy beside the file, so
            // neither this browser's work nor the other save is lost.
            if (decision === 'stale' && loaded?.ok) {
              const copy = `${f.name} (unsaved changes)`.slice(0, 120);
              await change((v) =>
                v.createFile({ folderId: f.folder_id, name: copy, plan: loaded.plan }),
              );
              setNote(
                `This file was changed elsewhere, so your unsaved changes were saved as “${copy}” in the same folder.`,
              );
            }
            drafts.clear();
          }
        }
        if (live)
          setDoc({
            id: null,
            plan,
            file: { id: f.id, name: f.name, folderId: f.folder_id, rev: f.doc_rev, recovered },
          });
      })
      .catch((e: unknown) => {
        if (!live) return;
        setNote(`${(e as Error).message} The built-in sample is open instead.`);
        setDoc({ id: null, plan: demoPlan() });
      });
    return () => {
      live = false;
    };
  }, [source.kind, source.id, vault]); // the source, not its object, decides what loads
  // A library plan (or the first one, or the built-in sample when the library is empty).
  useEffect(() => {
    if (entries === null || source.kind !== 'library') return;
    const hash = source.id;
    const id = entries.some((e) => e.id === hash) ? hash : entries[0]?.id;
    if (!id) {
      setDoc({ id: null, plan: demoPlan() });
      return;
    }
    let live = true;
    store
      .loadPlan(id)
      .then((json) => {
        const loaded = json ? loadPlan(json) : null;
        if (!live) return;
        if (loaded?.ok) setDoc({ id, plan: loaded.plan });
        else {
          setNote(`Plan “${id}” could not be opened, so the built-in sample is open.`);
          setDoc({ id: null, plan: demoPlan() });
        }
      })
      .catch(() => {
        if (live) setDoc({ id: null, plan: demoPlan() });
      });
    return () => {
      live = false;
    };
  }, [entries, source.kind, source.id, store]);
  useEffect(() => {
    dispatch({ type: 'select', pick: null });
  }, [doc]);

  if (!doc)
    return (
      <div className="ed-loading pc-dots">
        <span className="pc-eyebrow">( Opening plan )</span>
      </div>
    );
  return (
    <Shell
      key={doc.file?.id ?? doc.id ?? 'demo'}
      doc={doc}
      entries={entries ?? []}
      note={note}
      ui={ui}
      dispatch={dispatch}
      narrow={narrow}
      theme={theme}
      onTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
    />
  );
}

function Shell({
  doc,
  entries,
  note,
  ui,
  dispatch,
  narrow,
  theme,
  onTheme,
}: {
  doc: Doc;
  entries: LibraryEntry[];
  note: string | null;
  ui: EditorUi;
  dispatch: Dispatch<EditorAction>;
  narrow: boolean;
  theme: 'light' | 'dark';
  onTheme: () => void;
}) {
  // The plan being edited: every change is an engine command with one undo step (P2.4), and
  // every new state is saved continuously to the Vault (P14.4). Library plans are read-only.
  const editable = !!doc.file;
  const editing = useEditing(doc.plan, editable);
  const plan = editing.shown;
  const saveStatus = useFileSave(doc.file ?? null, editing.plan);
  // A one-time notice above the toolbar: recovered work, or a copy kept after a conflict.
  const [notice, setNotice] = useState<string | null>(
    doc.file?.recovered
      ? 'Unsaved changes from your last visit were recovered and saved.'
      : doc.file
        ? note
        : null,
  );
  // Offline and conflicts explain themselves in the notice too, not only in a hover tooltip.
  useEffect(() => {
    if (saveStatus === 'offline' || saveStatus === 'conflict') setNotice(SAVE_HINT[saveStatus]);
    else if (saveStatus === 'saved') setNotice((n) => (n === SAVE_HINT.offline ? null : n));
  }, [saveStatus]);
  useEffect(() => {
    // Development only: lets checks run commands from the browser console or a test.
    if (import.meta.env.DEV)
      (window as unknown as { __plancraft?: unknown }).__plancraft = {
        plan: editing.plan,
        run: editing.run,
        undo: editing.undo,
        redo: editing.redo,
      };
  }, [editing]);
  const level = firstLevel(plan);
  // Facts of the saved plan, with the index used for picking and snapping. While a drag is
  // previewed, the drawing, rooms and metrics follow the preview but the index stays: it is the
  // slowest part to rebuild, and snapping to where things were is what a drag needs.
  const saved = useMemo(() => {
    const f = factsOf(editing.plan);
    return { ...f, index: buildPlanIndex(firstLevel(editing.plan), f.drawing) };
  }, [editing.plan]);
  const draft = useMemo(
    () => (editing.previewing ? factsOf(editing.shown) : null),
    [editing.previewing, editing.shown],
  );
  const facts = draft ? { ...draft, index: saved.index } : saved;
  // A selected object that a change removed (delete, undo) is no longer selected.
  useEffect(() => {
    const s = ui.selected;
    if (s && !(s.id in firstLevel(editing.plan)[PICK_MAP[s.kind]]))
      dispatch({ type: 'select', pick: null });
  }, [editing.plan, ui.selected, dispatch]);

  // The view: fitted until the user pans or zooms; `null` means "fit".
  const [size, setSize] = useState<Size | null>(null);
  const [userView, setUserView] = useState<View | null>(null);
  const view = userView ?? (size ? fitView(facts.drawing.bounds, size, CANVAS_INSETS) : null);
  const zoomBy = useCallback(
    (factor: number) => {
      if (view && size) setUserView(zoomAt(view, size, [size.w / 2, size.h / 2], factor));
    },
    [view, size],
  );
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const scaleBar = view ? scaleBarLength(view.scale, ui.units) : null;

  // Side panels (P2.2a). When the drawing area moves or resizes (a panel sliding, the window),
  // the view follows so the plan stays exactly where it was on screen; a fitted view refits.
  const rect = useRef<Rect | null>(null);
  const onLayout = useCallback((next: Rect) => {
    const before = rect.current;
    rect.current = next;
    setSize((s) => (s && s.w === next.w && s.h === next.h ? s : { w: next.w, h: next.h }));
    if (before) setUserView((v) => v && keepStill(v, before, next));
  }, []);
  const panels = ui.panels;
  const leftOpen = isOpen(panels, 'left');
  const rightOpen = isOpen(panels, 'right');
  const chatOpen = isOpen(panels, 'chat');
  const anyOpen = leftOpen || rightOpen || chatOpen;
  /**
   * Every way of opening or closing a panel comes here (toggles, edge tabs, shortcuts, ⌘K, Esc,
   * a click outside an overlay). A fitted view is fixed first so the plan doesn't refit, and
   * keyboard focus inside a panel that hides moves to that panel's top-bar toggle (on a phone,
   * where the top bar has no side toggles, to the edge tab the panel leaves).
   */
  const changePanels = (action: EditorAction) => {
    if (!userView && view) setUserView(view);
    const next = editorReducer(ui, action).panels;
    for (const side of PANEL_SIDES) {
      if (
        !isOpen(panels, side) ||
        isOpen(next, side) ||
        !document.getElementById(`ed-panel-${side}`)?.contains(document.activeElement)
      )
        continue;
      const toggle = document.getElementById(`ed-toggle-${side}`);
      if (toggle?.offsetParent) toggle.focus();
      else setTimeout(() => document.querySelector<HTMLElement>(`.ed-edge--${side}`)?.focus());
    }
    dispatch(action);
  };
  const runPanel = (command: PanelCommand) =>
    changePanels(
      command === 'focus'
        ? { type: 'focusMode' }
        : { type: 'setPanel', side: command, open: !isOpen(panels, command) },
    );
  const [palette, setPalette] = useState(false);
  const [settings, setSettings] = useState(false);
  // Dragging a panel's inner edge: the width follows the pointer without animating.
  const [resizing, setResizing] = useState<ResizableSide | null>(null);
  const sideStyle = (side: ResizableSide) => {
    const w = panels.width[side];
    return w ? ({ '--ed-panel-w': `${w}px` } as CSSProperties) : undefined;
  };
  const resizeHandle = (side: ResizableSide) => (
    <ResizeHandle
      side={side}
      width={panels.width[side] ?? cssPx(`--pc-size-panel-${side}`)}
      onStart={(dragging) => {
        if (!userView && view) setUserView(view);
        if (dragging) setResizing(side);
      }}
      onWidth={(width) => dispatch({ type: 'panelWidth', side, width })}
      onEnd={() => setResizing(null)}
    />
  );

  const [fileName, setFileName] = useState(doc.file?.name ?? plan.meta.name);
  const [savedName, setSavedName] = useState(fileName);
  const { change } = useVault();
  /** The name typed in the top bar becomes the file's name in the Vault. */
  // Enter and Escape decide themselves; the blur that follows them must not save again.
  const skipBlur = useRef(false);
  const commitName = async (typed: string) => {
    const next = typed.trim();
    if (!doc.file || next === savedName) return;
    if (!next) return setFileName(savedName);
    try {
      await change((v) => v.rename(doc.file!.id, next));
      setSavedName(next);
      setFileName(next);
    } catch (e) {
      setFileName(savedName);
      setNotice(`The file could not be renamed. ${(e as Error).message}`);
    }
  };
  const [exportProblem, setExportProblem] = useState<string[] | null>(null);
  const errors = facts.issues.filter((i) => i.severity === 'error').length;
  const selectedName = ui.selected ? pickName(level, ui.selected) : null;

  // Editing (P2.4). Results are announced to screen readers; problems also show in the notice.
  const [announcement, setAnnouncement] = useState('');
  /** A fitted view is fixed before an edit, so the plan doesn't jump to a new fit. */
  const freeze = () => {
    if (!userView && view) setUserView(view);
  };
  const report = (out: Outcome, done: string) => {
    if (!out.ok) {
      if (out.code !== 'nothing_to_undo' && out.code !== 'nothing_to_redo') setNotice(out.message);
      setAnnouncement(out.message);
      return false;
    }
    const skipped = out.skipped?.length ?? 0;
    if (skipped)
      setNotice(
        `${done.replace(/\.$/, '')}, except ${skipped} part${skipped > 1 ? 's' : ''} changed by someone else since.`,
      );
    setAnnouncement(done);
    return true;
  };
  const doUndo = () => {
    freeze();
    report(editing.undo(), 'Undid the last change.');
  };
  const doRedo = () => {
    freeze();
    report(editing.redo(), 'Redid the change.');
  };
  const deleteSelected = () => {
    const s = ui.selected;
    if (!s) return;
    freeze();
    const request: CommandRequest = { op: 'execute', id: 'DELETE', params: { ids: [s.id] } };
    report(editing.run(request), `Deleted ${pickName(level, s)}.`);
  };
  /**
   * ⌘K as a command line (PRD §4.4): a command word (MOVE, M, DELETE, ADD_WALL, SET…) followed
   * by its values becomes one item that runs it, or says what is missing. A word alone still
   * searches the palette.
   */
  const typedCommands = (text: string): Command[] => {
    const [word = '', ...values] = text.split(/\s+/);
    const found = values.length > 0 && findCommand(word);
    if (!found) return [];
    const parsed = parseCommand(text, { ids: BROWSER_IDS });
    if (!parsed.ok)
      return [
        {
          group: 'Command line',
          label: parsed.message,
          icon: <Icon.ArrowRight />,
          hint: found.label,
          run: () => setNotice(parsed.message),
        },
      ];
    const shown = formatCommand(parsed.call);
    return [
      {
        group: 'Command line',
        label: shown,
        icon: <Icon.ArrowRight />,
        hint: '↵',
        run: () => {
          freeze();
          report(editing.run({ op: 'execute', ...parsed.call }), `Done: ${shown}.`);
        },
      },
    ];
  };
  // The active tool (P2.5): its clicks, typed values, Enter and Esc, preview and prompt line.
  const promptInput = useRef<HTMLInputElement>(null);
  const tools = useTools({
    tool: ui.tool,
    setTool: (tool) => dispatch({ type: 'setTool', tool }),
    editing,
    level,
    rooms: facts.rooms,
    selected: ui.selected,
    select: (pick) => dispatch({ type: 'select', pick }),
    cursor,
    newId: BROWSER_IDS.next,
    freeze,
    report,
  });
  // The note tool asks for its text: the prompt line takes the keys.
  useEffect(() => {
    if (tools.state.asking) promptInput.current?.focus();
  }, [tools.state.asking]);
  const [help, setHelp] = useState(false);
  const onMoveDrag: MoveDrag = (pick, from, to, phase) => {
    const request: CommandRequest = {
      op: 'execute',
      id: 'MOVE',
      params: { ids: [pick.id], from, to },
    };
    freeze();
    if (phase === 'move') {
      editing.preview(request);
      return;
    }
    editing.endPreview();
    const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
    if (phase === 'cancel' || !distance) return;
    report(
      editing.run(request),
      `Moved ${pickName(firstLevel(editing.plan), pick)} by ${formatLength(distance, ui.units)}.`,
    );
  };

  // Keyboard: ⌘K palette, panel shortcuts (⌘\ focus mode, ⌘⌥[ / ⌘⌥] left / right), Esc closes
  // an overlay panel or clears the selection, tools, zoom (+ − 0), pan (arrows), Space + drag.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      if (palette) return;
      const command = panelShortcut(e);
      if (command) {
        // In a text field the same keys may be typing (AltGr is Ctrl + Alt on many layouts).
        if (isTextField(e.target)) return;
        e.preventDefault();
        runPanel(command);
        return;
      }
      if (e.key === 'Escape' && panels.overlay && !isTextField(e.target)) {
        changePanels({ type: 'setPanel', side: panels.overlay, open: false });
        return;
      }
      // ⌘Z undo, ⇧⌘Z or Ctrl+Y redo; a text field keeps its own undo.
      const letter = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (letter === 'z' || letter === 'y')) {
        if (isTextField(e.target)) return;
        e.preventDefault();
        if (letter === 'y' || e.shiftKey) doRedo();
        else doUndo();
        return;
      }
      // A tool at work: Enter finishes, Esc stops it (and a second Esc goes back to Select).
      if (ui.tool !== 'select' && !isTextField(e.target)) {
        if (e.key === 'Enter') {
          e.preventDefault();
          tools.finish();
          return;
        }
        if (e.key === 'Escape') {
          if (!tools.cancel()) dispatch({ type: 'setTool', tool: 'select' });
          return;
        }
      }
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      // Typed values while drawing (A2 M5): the key goes on into the prompt line's box.
      const waiting = tools.state.points.length > 0 || !!tools.state.target;
      if (
        TYPED_TOOLS.has(ui.tool) &&
        (/^[0-9.@<]$/.test(e.key) || (e.key === '-' && waiting)) &&
        promptInput.current
      ) {
        promptInput.current.focus();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && ui.selected) {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (e.key === ' ') {
        setSpaceDown(true);
        e.preventDefault();
        return;
      }
      const tool = TOOL_LIST.find((t) => t.key === e.key.toUpperCase() && !!t.shift === e.shiftKey);
      if (tool) dispatch({ type: 'setTool', tool: tool.id });
      else if (e.key === '+' || e.key === '=') zoomBy(1.25);
      else if (e.key === '-' || e.key === '_') zoomBy(0.8);
      else if (e.key === '0') setUserView(null);
      else if (e.key === 'Escape') dispatch({ type: 'select', pick: null });
      else if (e.key.startsWith('Arrow') && view) {
        const step = 80 / view.scale;
        const [dx, dy] = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, 1],
          ArrowDown: [0, -1],
        }[e.key] ?? [0, 0];
        setUserView({ ...view, cx: view.cx + dx! * step, cy: view.cy + dy! * step });
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ') setSpaceDown(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  });

  const download = () => {
    const result = exportDxf(editing.plan);
    if (!result.ok) {
      setExportProblem(result.check.mismatches);
      return;
    }
    const url = URL.createObjectURL(new Blob([result.dxf], { type: 'application/dxf' }));
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `${fileName || 'plan'}.dxf`,
    });
    a.click();
    // Some browsers start the download after click() returns; free the file a moment later.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const select = useCallback((pick: Pick | null) => dispatch({ type: 'select', pick }), [dispatch]);
  const goHome = () =>
    go(doc.file?.folderId ? { page: 'folder', id: doc.file.folderId } : { page: 'home' });

  const commands: Command[] = [
    {
      group: 'Panels',
      label: `${leftOpen ? 'Hide' : 'Show'} left panel`,
      icon: leftOpen ? <Icon.Sidebar /> : <Icon.SidebarHidden />,
      hint: keys('left'),
      run: () => runPanel('left'),
    },
    {
      group: 'Panels',
      label: `${rightOpen ? 'Hide' : 'Show'} right panel`,
      icon: (
        <span className="ed-flip">{rightOpen ? <Icon.Sidebar /> : <Icon.SidebarHidden />}</span>
      ),
      hint: keys('right'),
      run: () => runPanel('right'),
    },
    // On a narrow window focus mode only closes the open overlay.
    ...(panels.compact && !panels.overlay
      ? []
      : [
          {
            group: 'Panels',
            label: anyOpen ? 'Hide all panels (focus mode)' : 'Show panels',
            icon: <Icon.SidebarHidden />,
            hint: keys('focus'),
            run: () => runPanel('focus'),
          },
        ]),
    {
      group: 'Panels',
      label: `${chatOpen ? 'Hide' : 'Show'} chat`,
      icon: <Icon.Chat />,
      run: () => changePanels({ type: 'toggleChat' }),
    },
    ...(panels.width.left || panels.width.right
      ? [
          {
            group: 'Panels',
            label: 'Reset panel widths',
            icon: <Icon.Sidebar />,
            run: () => {
              if (!userView && view) setUserView(view);
              dispatch({ type: 'panelWidth', side: 'left', width: null });
              dispatch({ type: 'panelWidth', side: 'right', width: null });
            },
          },
        ]
      : []),
    ...(editable
      ? [
          {
            group: 'Edit',
            label: 'Undo',
            icon: <Icon.Undo />,
            hint: UNDO_KEY,
            run: doUndo,
          },
          {
            group: 'Edit',
            label: 'Redo',
            icon: <Icon.Redo />,
            hint: REDO_KEY,
            run: doRedo,
          },
          ...(ui.selected
            ? [
                {
                  group: 'Edit',
                  label: `Delete ${pickName(level, ui.selected)}`,
                  icon: <Icon.Trash />,
                  hint: 'Del',
                  run: deleteSelected,
                },
              ]
            : []),
        ]
      : []),
    ...TOOL_LIST.map((t) => ({
      group: 'Tools',
      label: `${t.label} tool`,
      icon: <ToolIcon tool={t.id} />,
      hint: keyLabel(t),
      run: () => dispatch({ type: 'setTool', tool: t.id }),
    })),
    { group: 'View', label: 'Zoom in', icon: <Icon.Plus />, hint: '+', run: () => zoomBy(1.25) },
    { group: 'View', label: 'Zoom out', icon: <Icon.Minus />, hint: '−', run: () => zoomBy(0.8) },
    {
      group: 'View',
      label: 'Fit the plan',
      icon: <Icon.Grid />,
      hint: '0',
      run: () => setUserView(null),
    },
    {
      group: 'View',
      label: ui.units === 'm' ? 'Show lengths in feet and inches' : 'Show lengths in metres',
      icon: <Icon.Measure />,
      run: () => dispatch({ type: 'setUnits', units: ui.units === 'm' ? 'ft_in' : 'm' }),
    },
    {
      group: 'View',
      label: theme === 'light' ? 'Switch to the dark theme' : 'Switch to the light theme',
      icon: theme === 'light' ? <Icon.Moon /> : <Icon.Sun />,
      run: onTheme,
    },
    { group: 'File', label: 'Export DXF', icon: <Icon.Download />, run: download },
    { group: 'File', label: 'Go to the Vault', icon: <Icon.Home />, run: goHome },
  ];

  return (
    <div className={`ed${narrow ? ' ed--narrow' : ''}`}>
      <header className="ed-top">
        <PanelToggle side="left" open={leftOpen} onToggle={() => runPanel('left')} />
        <IconButton label="Home" onClick={goHome}>
          <Icon.Home />
        </IconButton>
        <input
          className="ed-filename"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== 'Escape') return;
            skipBlur.current = true;
            if (e.key === 'Enter') void commitName(e.currentTarget.value);
            else setFileName(savedName);
            e.currentTarget.blur();
          }}
          onFocus={() => (skipBlur.current = false)}
          onBlur={(e) => {
            if (skipBlur.current) skipBlur.current = false;
            else void commitName(e.currentTarget.value);
          }}
          readOnly={!doc.file}
          title={
            doc.file
              ? `${savedName} (click to rename)`
              : `${savedName}: a library plan; use it as a starting point in the Vault to edit it`
          }
          aria-label="File name"
        />
        <button
          type="button"
          className="ed-branch pc-micro"
          disabled
          title="Branches arrive with Phase 15"
        >
          main ▾
        </button>
        <span className="pc-small" title={SAVE_HINT[doc.file ? saveStatus : 'library']}>
          <Status tone={SAVE_TONE[doc.file ? saveStatus : 'library']}>
            {SAVE_WORD[doc.file ? saveStatus : 'library']}
          </Status>
        </span>
        <span className="ed-spacer" />
        <Chip>
          {level.id} · {level.name} ▾
        </Chip>
        <Chip>
          {formatLength(facts.tags.plot_width_cm.value, ui.units)} ×{' '}
          {formatLength(facts.tags.plot_depth_cm.value, ui.units)}
        </Chip>
        <span className="ed-spacer" />
        <PanelToggle
          side="chat"
          open={chatOpen}
          onToggle={() => changePanels({ type: 'toggleChat' })}
        />
        <span className="ed-badge-wrap">
          <IconButton
            label="Issues"
            pressed={rightOpen && ui.rightTab === 'issues'}
            onClick={() => changePanels({ type: 'toggleRight', tab: 'issues' })}
          >
            <Icon.Bell />
          </IconButton>
          {facts.issues.length > 0 && (
            <span className={`ed-badge${errors ? ' ed-badge--error' : ''}`}>
              {facts.issues.length}
            </span>
          )}
        </span>
        <IconButton label={theme === 'light' ? 'Dark theme' : 'Light theme'} onClick={onTheme}>
          {theme === 'light' ? <Icon.Moon /> : <Icon.Sun />}
        </IconButton>
        <span className="ed-avatar" title="You">
          A
        </span>
        <Button variant="primary" size="sm" onClick={download}>
          Export DXF
        </Button>
        <PanelToggle side="right" open={rightOpen} onToggle={() => runPanel('right')} />
      </header>

      <div className="ed-body">
        <nav className="ed-rail" aria-label="Panels">
          {(
            [
              ['rooms', 'Rooms', <Icon.Room key="r" />],
              ['layers', 'Layers', <Icon.Layers key="l" />],
              ['library', 'Library', <Icon.Library key="b" />],
            ] as [LeftTab, string, ReactNode][]
          ).map(([tab, label, icon]) => (
            <IconButton
              key={tab}
              label={label}
              pressed={leftOpen && ui.leftTab === tab}
              onClick={() => changePanels({ type: 'toggleLeft', tab })}
            >
              {icon}
            </IconButton>
          ))}
          <span className="ed-spacer" />
          <IconButton label="Settings" onClick={() => setSettings(true)}>
            <Icon.Settings />
          </IconButton>
          <IconButton label="Keyboard and mouse help" onClick={() => setHelp(true)}>
            <Icon.Help />
          </IconButton>
        </nav>

        <aside
          id="ed-panel-left"
          className="ed-side ed-left"
          data-open={leftOpen}
          data-resizing={resizing === 'left' || undefined}
          style={sideStyle('left')}
          aria-label="Left panel"
          inert={!leftOpen}
        >
          <div className="ed-side-inner">
            <Panel
              title={{ rooms: 'Rooms', layers: 'Layers', library: 'Library' }[ui.leftTab]}
              closeLabel={`Close ${{ rooms: 'Rooms', layers: 'Layers', library: 'Library' }[ui.leftTab]} panel`}
              onClose={() => changePanels({ type: 'setPanel', side: 'left', open: false })}
            >
              {ui.leftTab === 'rooms' && (
                <RoomList
                  level={level}
                  rooms={facts.rooms}
                  units={ui.units}
                  selectedId={ui.selected?.kind === 'room' ? ui.selected.id : null}
                  onSelect={select}
                />
              )}
              {ui.leftTab === 'layers' && (
                <div className="ed-list">
                  {LAYERS.map(([layer, label]) => (
                    <label key={layer} className="ed-row ed-row--check">
                      <input
                        type="checkbox"
                        checked={!ui.hidden.includes(layer)}
                        onChange={() => dispatch({ type: 'toggleLayer', layer })}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              )}
              {ui.leftTab === 'library' && (
                <div className="ed-list">
                  {note && <span className="pc-small ed-note">{note}</span>}
                  {entries.map((e) => (
                    <a
                      key={e.id}
                      className="ed-row"
                      href={routeHash({ page: 'library-plan', id: e.id })}
                      aria-selected={e.id === doc.id}
                    >
                      <span>
                        <span className="ed-row-title">{e.name}</span>
                        <span className="pc-small">
                          {e.tags.plot_size_ft} · {e.tags.bhk.value} BHK · {e.tags.facing.value}
                        </span>
                      </span>
                      {e.status === 'partial' && <Chip>partial</Chip>}
                    </a>
                  ))}
                  {!entries.length && (
                    <span className="pc-small ed-note">
                      The library is empty. Import drawings with <code>npm run import</code> and{' '}
                      <code>npm run library</code>.
                    </span>
                  )}
                </div>
              )}
            </Panel>
            {resizeHandle('left')}
          </div>
        </aside>

        <Canvas
          drawing={facts.drawing}
          index={facts.index}
          units={ui.units}
          tool={ui.tool}
          snaps={ui.snaps}
          hidden={ui.hidden}
          selected={ui.selected}
          onSelect={select}
          view={view}
          onView={setUserView}
          size={size}
          onLayout={onLayout}
          onCursor={setCursor}
          spaceDown={spaceDown}
          {...(editable ? { onMoveDrag } : {})}
          onToolClick={tools.click}
          {...(tools.snapFrom ? { snapFrom: tools.snapFrom } : {})}
          toolOverlay={view && <ToolShapes shapes={tools.shapes} scale={view.scale} />}
        >
          <div className="ed-float">
            {notice && <SelectionPill text={notice} action="OK" onAction={() => setNotice(null)} />}
            {selectedName && (
              <SelectionPill
                text={
                  <>
                    Selecting <b>{selectedName}</b>
                  </>
                }
                action="Edit"
              />
            )}
            {ui.tool !== 'select' && (
              <ToolPrompt
                key={ui.tool}
                tool={toolInfo(ui.tool)}
                prompt={tools.prompt}
                hint={tools.hint}
                options={tools.options}
                onOptions={tools.setOptions}
                inputRef={promptInput}
                onTyped={tools.typed}
              />
            )}
            <Toolbar label="Tools">
              {TOOL_LIST.map((t, i) => (
                <span key={t.id} style={{ display: 'contents' }}>
                  {i > 0 && TOOL_LIST[i - 1]!.group !== t.group && <ToolbarSep />}
                  <IconButton
                    label={`${t.label} (${keyLabel(t)})`}
                    pressed={ui.tool === t.id}
                    onClick={() => dispatch({ type: 'setTool', tool: t.id })}
                  >
                    <ToolIcon tool={t.id} />
                  </IconButton>
                </span>
              ))}
              <ToolbarSep />
              <IconButton
                label={`Undo (${UNDO_KEY})`}
                title={
                  !editable
                    ? READ_ONLY
                    : editing.canUndo
                      ? `Undo (${UNDO_KEY})`
                      : 'Nothing to undo yet'
                }
                disabled={!editing.canUndo}
                onClick={doUndo}
              >
                <Icon.Undo />
              </IconButton>
              <IconButton
                label={`Redo (${REDO_KEY})`}
                title={
                  !editable ? READ_ONLY : editing.canRedo ? `Redo (${REDO_KEY})` : 'Nothing to redo'
                }
                disabled={!editing.canRedo}
                onClick={doRedo}
              >
                <Icon.Redo />
              </IconButton>
            </Toolbar>
          </div>
          {scaleBar && (
            <div className="ed-scale">
              <ScaleBar label={scaleBar.label} width={scaleBar.px} />
            </div>
          )}
          {/* A hidden side panel leaves a tab on its edge of the canvas that brings it back. */}
          {(['left', 'right'] as const).map(
            (side) =>
              !isOpen(panels, side) && (
                <button
                  key={side}
                  type="button"
                  className={`ed-edge ed-edge--${side}`}
                  aria-label={`Show ${SIDE_NAME[side]}`}
                  title={`Show ${SIDE_NAME[side]} (${keys(side)})`}
                  aria-expanded={false}
                  aria-controls={`ed-panel-${side}`}
                  onClick={() => changePanels({ type: 'setPanel', side, open: true })}
                >
                  <Icon.ChevronRight />
                </button>
              ),
          )}
        </Canvas>

        <aside
          id="ed-panel-chat"
          className="ed-side ed-chat"
          data-open={chatOpen}
          aria-label="Chat"
          inert={!chatOpen}
        >
          <div className="ed-side-inner">
            <Panel
              title="Assistant"
              closeLabel="Close chat"
              onClose={() => changePanels({ type: 'setPanel', side: 'chat', open: false })}
            >
              <div className="ed-chat-empty">
                <span className="pc-eyebrow">( Ask or instruct )</span>
                <p className="pc-small">
                  Describe a change or ask about the plan. The assistant edits through the same
                  commands as the toolbar.
                </p>
                {[
                  'Make the kitchen 30 cm wider',
                  'Add a window to the bedroom',
                  'Check this plan against BBMP',
                ].map((s) => (
                  <Button key={s} size="sm" disabled title="Chat connects in P4.1">
                    {s}
                  </Button>
                ))}
              </div>
            </Panel>
            <div className="ed-chat-input">
              <div className="pc-input-wrap" style={{ flex: 1 }}>
                <input
                  className="pc-input"
                  placeholder="Chat connects in P4.1"
                  disabled
                  aria-label="Message"
                />
              </div>
              <Button variant="primary" disabled>
                Send
              </Button>
            </div>
          </div>
        </aside>

        <aside
          id="ed-panel-right"
          className="ed-side ed-right"
          data-open={rightOpen}
          data-resizing={resizing === 'right' || undefined}
          style={sideStyle('right')}
          aria-label="Right panel"
          inert={!rightOpen}
        >
          <div className="ed-side-inner">
            {resizeHandle('right')}
            <div className="ed-right-tabs">
              <Tabs
                value={ui.rightTab}
                onChange={(tab) =>
                  tab !== ui.rightTab && dispatch({ type: 'toggleRight', tab: tab as RightTab })
                }
                tabs={[
                  { id: 'properties', label: 'Properties' },
                  { id: 'issues', label: 'Issues', count: facts.issues.length },
                  { id: 'metrics', label: 'Metrics' },
                ]}
              />
              <IconButton
                label={`Close ${{ properties: 'Properties', issues: 'Issues', metrics: 'Metrics' }[ui.rightTab]} panel`}
                onClick={() => changePanels({ type: 'setPanel', side: 'right', open: false })}
              >
                <Icon.Minus />
              </IconButton>
            </div>
            <div className="ed-panel-body">
              {ui.rightTab === 'properties' && (
                <Properties
                  plan={plan}
                  level={level}
                  rooms={facts.rooms}
                  selected={ui.selected}
                  units={ui.units}
                  {...(editable
                    ? {
                        onCommand: (request: CommandRequest, done: string) => {
                          freeze();
                          return report(editing.run(request), done);
                        },
                      }
                    : {})}
                />
              )}
              {ui.rightTab === 'issues' &&
                (facts.issues.length ? (
                  facts.issues.map((issue, i) => <IssueRow key={i} issue={issue} />)
                ) : (
                  <div className="ed-stack">
                    <Status tone="ok">Plan check passed</Status>
                    <span className="pc-small">
                      Reference checks (bylaws, Vastu, firm rules) arrive with the rules engine
                      (P3).
                    </span>
                  </div>
                ))}
              {ui.rightTab === 'metrics' && (
                <div className="ed-metrics">
                  <MetricTile
                    label="Built-up"
                    value={formatArea(facts.tags.built_up_m2.value, ui.units).split(' ')[0]!}
                    unit={ui.units === 'm' ? 'm²' : 'ft²'}
                    bar="strong"
                  />
                  <MetricTile
                    label="Carpet"
                    value={formatArea(facts.tags.carpet_m2.value, ui.units).split(' ')[0]!}
                    unit={ui.units === 'm' ? 'm²' : 'ft²'}
                    bar="normal"
                  />
                  <MetricTile
                    label="Plot"
                    value={formatArea(facts.tags.plot_area_m2.value, ui.units).split(' ')[0]!}
                    unit={ui.units === 'm' ? 'm²' : 'ft²'}
                  />
                  <MetricTile
                    label="Efficiency"
                    value={String(
                      Math.round((facts.tags.carpet_m2.value / facts.tags.built_up_m2.value) * 100),
                    )}
                    unit="%"
                  />
                  <span className="pc-small" style={{ gridColumn: '1 / -1' }}>
                    Plot {facts.tags.plot_size_ft} · {facts.tags.plot_size_m} ·{' '}
                    {facts.tags.bhk.value} BHK
                  </span>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Narrow window: a click outside the floating panel closes it. */}
        {panels.overlay && (
          <div
            className="ed-scrim"
            aria-hidden="true"
            onPointerDown={() =>
              changePanels({ type: 'setPanel', side: panels.overlay!, open: false })
            }
          />
        )}
      </div>

      <footer className="ed-status">
        <Segmented
          label="Units"
          options={['m', 'ft-in']}
          value={ui.units === 'm' ? 'm' : 'ft-in'}
          onChange={(v) => dispatch({ type: 'setUnits', units: v === 'm' ? 'm' : 'ft_in' })}
        />
        <span className="ed-snaps" role="group" aria-label="Snapping">
          <span className="pc-muted">Snap</span>
          {SNAPS.map(([snap, label]) => (
            <button
              key={snap}
              type="button"
              className="ed-snap pc-micro"
              aria-pressed={ui.snaps.includes(snap)}
              onClick={() => dispatch({ type: 'toggleSnap', snap })}
            >
              {label}
            </button>
          ))}
        </span>
        <span className="ed-coords pc-mono" aria-label="Cursor position">
          {cursor?.delta ? (
            <>
              Move <span className="ed-snap-word">Δx</span>{' '}
              {formatLength(cursor.delta[0], ui.units)} · <span className="ed-snap-word">Δy</span>{' '}
              {formatLength(cursor.delta[1], ui.units)}
            </>
          ) : cursor ? (
            <>
              x {formatLength(cursor.point[0], ui.units)} · y{' '}
              {formatLength(cursor.point[1], ui.units)}
              {cursor.snap !== 'none' && (
                <span className="ed-snap-word"> {SNAP_WORD[cursor.snap]}</span>
              )}
            </>
          ) : (
            <span className="pc-muted">
              {level.id} · {level.name}
            </span>
          )}
        </span>
        <span className="ed-spacer" />
        <span className="ed-zoom" role="group" aria-label="Zoom">
          <IconButton label="Zoom out (−)" onClick={() => zoomBy(0.8)}>
            <Icon.Minus />
          </IconButton>
          <button
            type="button"
            className="ed-zoom-value pc-mono"
            title="Fit the plan (0)"
            onClick={() => setUserView(null)}
          >
            {view ? `${Math.round(view.scale * 100)}%` : '—'}
          </button>
          <IconButton label="Zoom in (+)" onClick={() => zoomBy(1.25)}>
            <Icon.Plus />
          </IconButton>
        </span>
        <span className="pc-mono pc-muted ed-engine">engine {ENGINE_VERSION}</span>
      </footer>

      {palette && (
        <Palette
          commands={commands}
          {...(editable ? { typed: typedCommands } : {})}
          onClose={() => setPalette(false)}
        />
      )}
      {settings && <SettingsDialog onClose={() => setSettings(false)} />}
      {help && <HelpDialog onClose={() => setHelp(false)} />}
      {/* What the last change did, read out by screen readers (skill §6, audit B3). */}
      <div className="ed-live" role="status" aria-live="polite">
        {announcement}
      </div>

      {exportProblem && (
        <Dialog
          title="Export stopped"
          footer={
            <Button variant="primary" onClick={() => setExportProblem(null)}>
              OK
            </Button>
          }
        >
          <span>The file lost something when read back, so it was not saved:</span>
          <ul>
            {exportProblem.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Dialog>
      )}
    </div>
  );
}
