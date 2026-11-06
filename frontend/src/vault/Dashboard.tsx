import {
  blankPlan,
  importDxf,
  loadPlan,
  planThumbnailSvg,
  validatePlan,
  type FileStatus,
  type Folder,
  type LibraryEntry,
  type SearchFilters,
  type SearchHit,
  type TreeNode,
  type VaultFile,
  type VaultIndex,
  type VaultItem,
} from '@plancraft/engine';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { go, routeHash, type Route, type SearchParams } from '../app/route.ts';
import { FetchStore } from '../library/fetch-store.ts';
import { Button, Field, IconButton, Segmented, Select, TextInput } from '../ui/components.tsx';
import { FolderIcon, Icon } from '../ui/icons.tsx';
import { Menu, type MenuEntry } from '../ui/Menu.tsx';
import { SettingsDialog } from '../ui/SettingsDialog.tsx';
import { LAST_FILE_KEY } from '../editor/useFileSave.ts';
import { useVault, useVaultQuery } from './client.ts';
import {
  COLOURS,
  ConfirmDialog,
  FolderPickerDialog,
  ImportResultDialog,
  NameDialog,
  NewPlanDialog,
  useModalFocus,
  type ImportOutcome,
} from './dialogs.tsx';
import {
  FileCards,
  FileTable,
  FolderTiles,
  STATUS_LABEL,
  person,
  type ItemEvents,
} from './items.tsx';
import { clickSelect, sortFiles, sortFolders, type Sort } from './listing.ts';

// The Vault, the first page (P14.3, A2 §4.1): workspace, navigation and the folder tree on the
// left; breadcrumb, + New and the current view on the right. Every change goes through the
// engine's Vault; this screen only shows records and turns gestures into vault calls.

const ITEMS_MIME = 'application/x-plancraft-items';
/** Old Trash is emptied once per visit (page load), when the Vault first opens. */
let purgedThisVisit = false;
const THEME_KEY = 'plancraft-vault-theme';
const VIEW_KEY = 'plancraft-vault-view';

type DialogState =
  | { kind: 'new-folder'; parentId: string | null }
  | { kind: 'new-plan'; folderId: string | null }
  | { kind: 'rename'; id: string; name: string }
  | { kind: 'move'; ids: string[] }
  | { kind: 'copy-library'; entry: LibraryEntry }
  | { kind: 'import'; outcomes: ImportOutcome[] }
  | { kind: 'delete'; ids: string[]; label: string }
  | { kind: 'help' }
  | { kind: 'settings' }
  | null;

interface Actions {
  index: VaultIndex | undefined;
  /** A dialog, menu or the palette is open: keys belong to it. */
  busy: boolean;
  open: (id: string) => void;
  itemMenu: (e: MouseEvent, ids: string[]) => void;
  areaMenu: (e: MouseEvent, folderId: string | null) => void;
  importFiles: (files: File[], folderId: string | null) => void;
  newPlan: (folderId: string | null) => void;
  newFolder: (parentId: string | null) => void;
  pick: (kind: 'dxf' | 'package', folderId: string | null) => void;
  move: (ids: string[], folderId: string | null) => void;
  rename: (id: string) => void;
  trash: (ids: string[]) => void;
  restore: (id: string) => void;
  restoreAll: (ids: string[]) => void;
  deleteForever: (ids: string[]) => void;
  /** The right-click menu for things in Trash: Restore, Delete for ever. */
  trashMenu: (e: MouseEvent, ids: string[]) => void;
  copyLibrary: (entry: LibraryEntry) => void;
}
const ActionsContext = createContext<Actions | null>(null);
const useActions = () => useContext(ActionsContext)!;

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
const baseName = (name: string) => name.replace(/\.[^.]+$/, '');
function readPref<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked; the choice still applies for this visit.
  }
}
/** Per-tab memory (scroll positions, the last open file). */
function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeSession(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Only a convenience.
  }
}
function download(name: string, data: Uint8Array, type: string) {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  Object.assign(document.createElement('a'), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Items being dragged: the selection when the dragged item is in it, else just that item. */
function startDrag(e: DragEvent, ids: string[]) {
  e.dataTransfer.setData(ITEMS_MIME, JSON.stringify(ids));
  e.dataTransfer.effectAllowed = 'move';
}
const draggedItems = (e: DragEvent): string[] | null => {
  const raw = e.dataTransfer.getData(ITEMS_MIME);
  return raw ? (JSON.parse(raw) as string[]) : null;
};
const carries = (e: DragEvent) =>
  e.dataTransfer.types.includes(ITEMS_MIME) || e.dataTransfer.types.includes('Files');

export function Dashboard({ route }: { route: Route }) {
  const { change } = useVault();
  const [theme, setTheme] = useState(() => readPref(THEME_KEY, 'dark', ['dark', 'light'] as const));
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writePref(THEME_KEY, theme);
  }, [theme]);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [menu, setMenu] = useState<{
    at: { x: number; y: number };
    entries: MenuEntry[];
    label: string;
  } | null>(null);
  const [palette, setPalette] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const index = useVaultQuery((v) => v.index(), []).data;
  const tree = useVaultQuery((v) => v.tree(), []).data ?? [];
  const folderId = route.page === 'folder' ? route.id : null;
  const picker = useRef<HTMLInputElement>(null);
  const pickTarget = useRef<string | null>(null);

  const run = useCallback(
    async <T,>(fn: Parameters<typeof change<T>>[0]): Promise<T | undefined> => {
      try {
        setError(null);
        return await change(fn);
      } catch (e) {
        setError((e as Error).message);
        return undefined;
      }
    },
    [change],
  );

  const importFiles = useCallback(
    async (files: File[], target: string | null) => {
      const outcomes: ImportOutcome[] = [];
      for (const file of files) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        try {
          if (/\.plancraft$/i.test(file.name)) {
            const f = await change((v) => v.importPackage(bytes, target));
            outcomes.push({ fileName: file.name, fileId: f.id });
          } else if (/\.dxf$/i.test(file.name)) {
            const result = importDxf(bytes, { name: baseName(file.name) });
            if (!result.plan) {
              outcomes.push({
                fileName: file.name,
                report: result.report,
                error: 'No plan could be read from this drawing.',
              });
              continue;
            }
            const f = await change((v) =>
              v.createFile({ folderId: target, name: baseName(file.name), plan: result.plan }),
            );
            outcomes.push({ fileName: file.name, fileId: f.id, report: result.report });
          } else
            outcomes.push({
              fileName: file.name,
              error: 'Only .dxf and .plancraft files can be imported.',
            });
        } catch (e) {
          outcomes.push({ fileName: file.name, error: (e as Error).message });
        }
      }
      if (outcomes.length) setDialog({ kind: 'import', outcomes });
    },
    [change],
  );

  const name = (id: string) => index?.folders[id]?.name ?? index?.files[id]?.name ?? 'this item';
  const actions: Actions = {
    index,
    busy: !!dialog || !!menu || palette,
    open: (id) => go(index?.folders[id] ? { page: 'folder', id } : { page: 'file', id }),
    newPlan: (f) => setDialog({ kind: 'new-plan', folderId: f }),
    newFolder: (p) => setDialog({ kind: 'new-folder', parentId: p }),
    pick: (kind, f) => {
      pickTarget.current = f;
      const input = picker.current!;
      input.accept = kind === 'dxf' ? '.dxf' : '.plancraft';
      input.multiple = kind === 'dxf';
      input.click();
    },
    importFiles: (files, f) => void importFiles(files, f),
    move: (ids, f) =>
      void run(async (v) => {
        for (const id of ids) if (id !== f) await v.move(id, f);
      }),
    rename: (id) => setDialog({ kind: 'rename', id, name: name(id) }),
    trash: (ids) =>
      void run(async (v) => {
        for (const id of ids) await v.trash(id);
      }),
    restore: (id) => void run((v) => v.restore(id)),
    restoreAll: (ids) =>
      void run(async (v) => {
        for (const id of ids) await v.restore(id);
      }),
    trashMenu: (e, ids) => {
      e.preventDefault();
      if (!ids.length) return;
      const label = ids.length === 1 ? `“${name(ids[0]!)}”` : `${ids.length} items`;
      setMenu({
        at: { x: e.clientX, y: e.clientY },
        label,
        entries: [
          { label: 'Restore', icon: <Icon.Undo />, onSelect: () => actions.restoreAll(ids) },
          'separator',
          {
            label: 'Delete for ever…',
            icon: <Icon.Trash />,
            shortcut: 'Del',
            danger: true,
            onSelect: () => actions.deleteForever(ids),
          },
        ],
      });
    },
    deleteForever: (ids) =>
      setDialog({
        kind: 'delete',
        ids,
        label: ids.length === 1 ? `“${name(ids[0]!)}”` : `${ids.length} items`,
      }),
    copyLibrary: (entry) => setDialog({ kind: 'copy-library', entry }),
    itemMenu: (e, ids) => {
      e.preventDefault();
      if (!index || !ids.length) return;
      const items = ids.flatMap((id): VaultItem[] =>
        index.folders[id]
          ? [{ type: 'folder', folder: index.folders[id] }]
          : index.files[id]
            ? [{ type: 'file', file: index.files[id] }]
            : [],
      );
      const one = items.length === 1 ? items[0]! : null;
      const rec = (i: VaultItem) => (i.type === 'folder' ? i.folder : i.file);
      const allStarred = items.every((i) => rec(i).starred);
      const allArchived = items.every((i) => rec(i).archived);
      const entries: MenuEntry[] = [];
      if (one) {
        entries.push({
          label: 'Open',
          icon: <Icon.ArrowUpRight />,
          shortcut: '↵',
          onSelect: () => actions.open(rec(one).id),
        });
        entries.push('separator', {
          label: 'Rename…',
          icon: <Icon.Pencil />,
          shortcut: 'F2',
          onSelect: () => actions.rename(rec(one).id),
        });
        entries.push({
          label: 'Duplicate',
          icon: <Icon.Copy />,
          onSelect: () => void run((v) => v.duplicate(rec(one).id)),
        });
      }
      entries.push({
        label: 'Move to…',
        icon: <Icon.Move />,
        onSelect: () => setDialog({ kind: 'move', ids }),
      });
      entries.push({
        label: allStarred ? 'Remove star' : 'Star',
        icon: <Icon.Star />,
        onSelect: () =>
          void run(async (v) => {
            for (const id of ids) await v.setStar(id, !allStarred);
          }),
      });
      if (one?.type === 'file') {
        entries.push('separator', { heading: 'Status' });
        for (const s of ['draft', 'in_review', 'approved'] as FileStatus[])
          entries.push({
            label: STATUS_LABEL(s),
            checked: one.file.status === s,
            onSelect: () => void run((v) => v.setStatus(one.file.id, s)),
          });
        entries.push('separator', {
          label: 'Export .plancraft',
          icon: <Icon.Download />,
          onSelect: () =>
            void run(async (v) =>
              download(
                `${one.file.name}.plancraft`,
                await v.exportPackage(one.file.id),
                'application/zip',
              ),
            ),
        });
      }
      if (one?.type === 'folder') {
        entries.push('separator', { heading: 'Colour' });
        for (const [c, label] of COLOURS)
          entries.push({
            label,
            icon: <FolderIcon colour={c} />,
            checked: one.folder.color === c,
            onSelect: () => void run((v) => v.setColor(one.folder.id, c)),
          });
      }
      entries.push('separator', {
        label: allArchived ? 'Unarchive' : 'Archive',
        icon: <Icon.Archive />,
        onSelect: () =>
          void run(async (v) => {
            for (const id of ids) await v.archive(id, !allArchived);
          }),
      });
      entries.push({
        label: ids.length > 1 ? `Move ${ids.length} to Trash` : 'Move to Trash',
        icon: <Icon.Trash />,
        shortcut: 'Del',
        danger: true,
        onSelect: () => actions.trash(ids),
      });
      setMenu({
        at: { x: e.clientX, y: e.clientY },
        entries,
        label: one ? rec(one).name : `${ids.length} items`,
      });
    },
    areaMenu: (e, f) => {
      e.preventDefault();
      setMenu({ at: { x: e.clientX, y: e.clientY }, entries: newEntries(f), label: 'New' });
    },
  };
  const newEntries = (f: string | null): MenuEntry[] => [
    { label: 'New plan', icon: <Icon.File />, shortcut: 'N', onSelect: () => actions.newPlan(f) },
    {
      label: 'New folder',
      icon: <FolderIcon colour="graphite" />,
      shortcut: '⇧N',
      onSelect: () => actions.newFolder(f),
    },
    'separator',
    { label: 'Import DXF…', icon: <Icon.Upload />, onSelect: () => actions.pick('dxf', f) },
    {
      label: 'Import .plancraft…',
      icon: <Icon.Upload />,
      onSelect: () => actions.pick('package', f),
    },
  ];

  // A2 P14.5: things in Trash for more than 30 days are deleted for ever when the Vault opens.
  useEffect(() => {
    if (purgedThisVisit) return;
    purgedThisVisit = true;
    void run((v) => v.purgeTrash(TRASH_DAYS));
  }, [run]);

  // Keys for the whole screen: ⌘K palette, N new plan, ⇧N new folder.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      if (actions.busy || typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'n') actions.newPlan(folderId);
      else if (e.key === 'N') actions.newFolder(folderId);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const crumbs: { label: string; route: Route; folderId?: string | null }[] =
    route.page === 'folder' && index
      ? [
          { label: 'Projects', route: { page: 'home' }, folderId: null },
          ...pathOf(index, route.id).map((f) => ({
            label: f.name,
            route: { page: 'folder' as const, id: f.id },
            folderId: f.id,
          })),
        ]
      : [
          {
            label: PAGE_TITLE[route.page] ?? 'Projects',
            route,
            folderId: route.page === 'home' ? null : undefined,
          },
        ];

  return (
    <ActionsContext.Provider value={actions}>
      <div className="vlt vlt--app">
        <Sidebar
          route={route}
          tree={tree}
          onPalette={() => setPalette(true)}
          onHelp={() => setDialog({ kind: 'help' })}
          onSettings={() => setDialog({ kind: 'settings' })}
        />
        <main className="vlt-main" aria-label="Vault">
          <div className="vlt-head">
            <nav className="vlt-crumbs" aria-label="Breadcrumb">
              {crumbs.map((c, i) => (
                <Crumb
                  key={i}
                  last={i === crumbs.length - 1}
                  label={c.label}
                  route={c.route}
                  folderId={c.folderId}
                />
              ))}
            </nav>
            <IconButton label="Search (⌘K)" onClick={() => setPalette(true)}>
              <Icon.Search />
            </IconButton>
            <IconButton
              label={theme === 'light' ? 'Dark theme' : 'Light theme'}
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              {theme === 'light' ? <Icon.Moon /> : <Icon.Sun />}
            </IconButton>
            <Button
              variant="primary"
              size="sm"
              aria-haspopup="menu"
              onClick={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setMenu({
                  at: { x: r.right - 220, y: r.bottom + 6 },
                  entries: newEntries(folderId),
                  label: 'New',
                });
              }}
            >
              <Icon.Plus /> New
            </Button>
          </div>
          {error && (
            <div className="vlt-banner" role="alert">
              <span>{error}</span>
              <IconButton label="Dismiss" onClick={() => setError(null)}>
                <Icon.Minus />
              </IconButton>
            </div>
          )}
          {route.page === 'home' || route.page === 'folder' ? (
            <FolderView key={folderId ?? 'home'} folderId={folderId} />
          ) : route.page === 'library' ? (
            <LibraryView />
          ) : route.page === 'search' ? (
            <SearchView params={route.search} />
          ) : route.page === 'starred' ? (
            <StarredView />
          ) : route.page === 'trash' ? (
            <TrashView />
          ) : route.page === 'templates' ? (
            <Empty
              title="No templates yet"
              text="Templates are plans you start new work from. Saving a plan as a template comes with plan generation (P6); until then, start from the Plan Library."
            />
          ) : (
            <Empty
              title="Ask AI"
              text="Ask about your plans in plain words (“find all 30×40 east-facing plans”) or start a new plan from a brief. This arrives with the assistant (P4) and plan generation (P6.3)."
            />
          )}
        </main>
      </div>

      <input
        ref={picker}
        type="file"
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) void importFiles(files, pickTarget.current);
        }}
      />
      {menu && (
        <Menu
          at={menu.at}
          entries={menu.entries}
          label={menu.label}
          onClose={() => setMenu(null)}
        />
      )}
      {palette && (
        <Palette
          onClose={() => setPalette(false)}
          newEntries={newEntries(folderId)}
          onTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          onSettings={() => setDialog({ kind: 'settings' })}
        />
      )}
      {dialog?.kind === 'new-folder' && (
        <NameDialog
          title="New folder"
          submit="Create folder"
          colour="graphite"
          onCancel={() => setDialog(null)}
          onSubmit={(n, c) => {
            setDialog(null);
            void run((v) => v.createFolder({ parentId: dialog.parentId, name: n, color: c }));
          }}
        />
      )}
      {dialog?.kind === 'new-plan' && (
        <NewPlanDialog
          onCancel={() => setDialog(null)}
          onSubmit={async (p) => {
            setDialog(null);
            const f = await run((v) =>
              v.createFile({
                folderId: dialog.folderId,
                name: p.name,
                plan: blankPlan({ name: p.name, plot: p.plot, facing: p.facing }),
              }),
            );
            if (f) go({ page: 'file', id: f.id });
          }}
        />
      )}
      {dialog?.kind === 'rename' && (
        <NameDialog
          title="Rename"
          submit="Rename"
          initial={dialog.name}
          onCancel={() => setDialog(null)}
          onSubmit={(n) => {
            setDialog(null);
            void run((v) => v.rename(dialog.id, n));
          }}
        />
      )}
      {dialog?.kind === 'move' && (
        <FolderPickerDialog
          title={
            dialog.ids.length === 1
              ? `Move “${name(dialog.ids[0]!)}”`
              : `Move ${dialog.ids.length} items`
          }
          submit="Move here"
          tree={tree}
          disabled={dialog.ids}
          initial={folderId}
          onCancel={() => setDialog(null)}
          onSubmit={(target) => {
            setDialog(null);
            actions.move(dialog.ids, target);
          }}
        />
      )}
      {dialog?.kind === 'copy-library' && (
        <FolderPickerDialog
          title={`Start from “${dialog.entry.name.replace(/^.*\//, '')}”`}
          submit="Copy here"
          tree={tree}
          onCancel={() => setDialog(null)}
          onSubmit={async (target) => {
            setDialog(null);
            const plan = await new FetchStore().loadPlan(dialog.entry.id);
            const f = await run((v) =>
              v.createFile({
                folderId: target,
                name: dialog.entry.name.replace(/^.*\//, ''),
                plan,
              }),
            );
            if (f) go(target ? { page: 'folder', id: target } : { page: 'home' });
          }}
        />
      )}
      {dialog?.kind === 'import' && (
        <ImportResultDialog
          outcomes={dialog.outcomes}
          onClose={() => setDialog(null)}
          onOpen={(id) => go({ page: 'file', id })}
        />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title="Delete for ever?"
          message={
            <>
              {dialog.label} and everything inside will be deleted for ever. This can’t be undone.
            </>
          }
          submit="Delete for ever"
          onCancel={() => setDialog(null)}
          onSubmit={() => {
            setDialog(null);
            void run(async (v) => {
              for (const id of dialog.ids) await v.deleteForever(id);
            });
          }}
        />
      )}
      {dialog?.kind === 'help' && <HelpDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === 'settings' && <SettingsDialog onClose={() => setDialog(null)} />}
    </ActionsContext.Provider>
  );
}

const PAGE_TITLE: Partial<Record<Route['page'], string>> = {
  home: 'Projects',
  library: 'Plan Library',
  templates: 'Templates',
  ask: 'Ask AI',
  starred: 'Starred',
  search: 'Search',
  trash: 'Trash',
};

function pathOf(index: VaultIndex, id: string) {
  const path = [];
  for (let f = index.folders[id]; f; f = f.parent_id ? index.folders[f.parent_id] : undefined)
    path.unshift(f);
  return path;
}

/** A breadcrumb step; folders (and Projects) take dropped items. */
function Crumb({
  label,
  route,
  folderId,
  last,
}: {
  label: string;
  route: Route;
  folderId?: string | null;
  last: boolean;
}) {
  const a = useActions();
  const [over, setOver] = useState(false);
  const droppable = folderId !== undefined;
  return (
    <>
      <a
        href={routeHash(route)}
        className={`vlt-crumb${over ? ' is-dragover' : ''}`}
        aria-current={last ? 'page' : undefined}
        onDragOver={(e) => {
          if (droppable && carries(e)) {
            e.preventDefault();
            setOver(true);
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          setOver(false);
          if (!droppable) return;
          e.preventDefault();
          const ids = draggedItems(e);
          if (ids) a.move(ids, folderId);
          else a.importFiles([...e.dataTransfer.files], folderId);
        }}
      >
        {last ? <b>{label}</b> : label}
      </a>
      {!last && <Icon.ChevronRight />}
    </>
  );
}

function Sidebar({
  route,
  tree,
  onPalette,
  onHelp,
  onSettings,
}: {
  route: Route;
  tree: TreeNode[];
  onPalette: () => void;
  onHelp: () => void;
  onSettings: () => void;
}) {
  const a = useActions();
  const workspace = a.index?.workspace.name ?? 'My workspace';
  const current = route.page === 'folder' ? route.id : null;
  const [open, setOpen] = useState<Set<string>>(new Set());
  // Keep the way to the current folder open.
  useEffect(() => {
    if (!current || !a.index) return;
    const up = pathOf(a.index, current).map((f) => f.id);
    setOpen((o) => (up.every((id) => o.has(id)) ? o : new Set([...o, ...up])));
  }, [current, a.index]);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const nav: [Route, string, ReactNode][] = [
    [{ page: 'home' }, 'Home', <Icon.Home key="h" />],
    [{ page: 'ask' }, 'Ask AI', <Icon.Sparkle key="a" />],
    [{ page: 'library' }, 'Plan Library', <Icon.Library key="l" />],
    [{ page: 'templates' }, 'Templates', <Icon.Template key="t" />],
  ];
  return (
    <aside className="vlt-side" aria-label="Vault navigation">
      <button
        type="button"
        className="vlt-workspace"
        aria-haspopup="menu"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setMenu({ x: r.left, y: r.bottom + 4 });
        }}
      >
        <span className="vlt-avatar-sq">
          {workspace
            .split(/\s+/)
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()}
        </span>
        <span style={{ flex: 1, textAlign: 'left' }}>
          <span style={{ display: 'block', fontWeight: 500 }}>{workspace}</span>
          <span className="pc-small">1 member</span>
        </span>
        <Icon.ChevronDown />
      </button>
      {menu && (
        <Menu
          at={menu}
          label="Workspaces"
          onClose={() => setMenu(null)}
          entries={[
            { label: workspace, checked: true, onSelect: () => {} },
            'separator',
            {
              label: 'Teams and more workspaces come with accounts',
              disabled: true,
              onSelect: () => {},
            },
          ]}
        />
      )}
      <button type="button" className="pc-input-wrap vlt-search" onClick={onPalette}>
        <Icon.Search />
        <span className="pc-input vlt-search-text">Search…</span>
        <span className="vlt-kbd">⌘K</span>
      </button>
      {nav.map(([r, label, icon]) => (
        <a
          key={label}
          href={routeHash(r)}
          className="vlt-nav"
          aria-current={route.page === r.page ? 'page' : undefined}
        >
          {icon}
          {label}
        </a>
      ))}
      <div className="vlt-group">
        <span className="pc-eyebrow">Projects</span>
        <IconButton label="New folder" onClick={() => a.newFolder(null)}>
          <Icon.Plus />
        </IconButton>
      </div>
      <div role="tree" aria-label="Projects" className="vlt-tree">
        {tree.length ? (
          <TreeRows nodes={tree} depth={0} current={current} open={open} setOpen={setOpen} />
        ) : (
          <span className="pc-small vlt-tree-empty">No folders yet.</span>
        )}
      </div>
      <div className="vlt-foot">
        <a
          href={routeHash({ page: 'starred' })}
          className="vlt-nav"
          aria-current={route.page === 'starred' ? 'page' : undefined}
        >
          <Icon.Star /> Starred
        </a>
        <a
          href={routeHash({ page: 'trash' })}
          className="vlt-nav"
          aria-current={route.page === 'trash' ? 'page' : undefined}
        >
          <Icon.Trash /> Trash
        </a>
        <button type="button" className="vlt-nav" onClick={onSettings}>
          <Icon.Settings /> Settings
        </button>
        <button type="button" className="vlt-nav" onClick={onHelp}>
          <Icon.Help /> Help
        </button>
        <span className="vlt-nav vlt-account">
          <span
            className="vlt-avatar"
            style={{ background: 'var(--pc-avatar-local-bg)', width: '1.25rem', height: '1.25rem' }}
          >
            Y
          </span>
          You
        </span>
      </div>
    </aside>
  );
}

function TreeRows({
  nodes,
  depth,
  current,
  open,
  setOpen,
}: {
  nodes: TreeNode[];
  depth: number;
  current: string | null;
  open: Set<string>;
  setOpen: (f: (o: Set<string>) => Set<string>) => void;
}) {
  const a = useActions();
  const [over, setOver] = useState<string | null>(null);
  return (
    <>
      {nodes.map((n) => {
        const id = n.folder.id;
        const isOpen = open.has(id);
        return (
          <div key={id} role="none">
            <a
              href={routeHash({ page: 'folder', id })}
              role="treeitem"
              aria-selected={current === id}
              aria-expanded={n.children.length ? isOpen : undefined}
              className={`vlt-tree-row${over === id ? ' is-dragover' : ''}`}
              style={{ paddingLeft: `${(8 + depth * 16) / 16}rem` }}
              draggable
              onDragStart={(e) => startDrag(e, [id])}
              onDragOver={(e) => {
                if (carries(e)) {
                  e.preventDefault();
                  setOver(id);
                }
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const ids = draggedItems(e);
                if (ids) a.move(ids, id);
                else a.importFiles([...e.dataTransfer.files], id);
              }}
              onContextMenu={(e) => a.itemMenu(e, [id])}
            >
              <span
                className="vlt-twist"
                onClick={(e) => {
                  if (!n.children.length) return;
                  e.preventDefault();
                  setOpen((o) => {
                    const next = new Set(o);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  });
                }}
              >
                {n.children.length ? isOpen ? <Icon.ChevronDown /> : <Icon.ChevronRight /> : null}
              </span>
              <FolderIcon colour={n.folder.color} />
              <span className="vlt-tree-name" title={n.folder.name}>
                {n.folder.name}
              </span>
              <span className="vlt-count">{n.file_count}</span>
            </a>
            {isOpen && n.children.length > 0 && (
              <TreeRows
                nodes={n.children}
                depth={depth + 1}
                current={current}
                open={open}
                setOpen={setOpen}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

/** Selection, drag and drop and keys shared by the lists. */
type ListEvents = ItemEvents & { selection: string[]; clear: () => void };

/** What Enter, F2 and Delete do in a view (Trash: no opening or renaming; Delete = for ever). */
interface ListHandlers {
  open?: (id: string) => void;
  rename?: (id: string) => void;
  remove?: (ids: string[]) => void;
  menu?: (e: MouseEvent, ids: string[]) => void;
}

function useItemEvents(
  order: string[],
  initial: string | null = null,
  handlers: ListHandlers = {},
): ListEvents {
  const a = useActions();
  const open = handlers.open ?? a.open;
  const rename = handlers.rename ?? a.rename;
  const remove = handlers.remove ?? a.trash;
  const [sel, setSel] = useState<{ selection: string[]; anchor: string | null }>({
    selection: initial ? [initial] : [],
    anchor: initial,
  });
  const [dragOver, setDragOver] = useState<string | null>(null);
  const selection = sel.selection.filter((id) => order.includes(id));
  const clear = () => setSel({ selection: [], anchor: null });
  const selectAll = () => setSel({ selection: order, anchor: order[0] ?? null });
  // Keys on the current list: Enter opens, F2 renames, Delete moves to Trash, Esc clears, ⌘A all.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (a.busy || typing(e.target)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAll();
      } else if (e.metaKey || e.ctrlKey || e.altKey) return;
      else if (e.key === 'Escape') clear();
      else if (e.key === 'Enter' && selection.length === 1) open(selection[0]!);
      else if (e.key === 'F2' && selection.length === 1) rename(selection[0]!);
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selection.length) {
        e.preventDefault();
        remove(selection);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  return {
    selection,
    clear,
    dragOver,
    selected: (id) => selection.includes(id),
    onClick: (e, id) => {
      e.stopPropagation();
      setSel(
        clickSelect(selection, sel.anchor, id, order, {
          toggle: e.metaKey || e.ctrlKey,
          range: e.shiftKey,
        }),
      );
    },
    onOpen: (id) => open(id),
    onMenu: (e, id) => {
      e.stopPropagation();
      const ids = selection.includes(id) ? selection : [id];
      if (!selection.includes(id)) setSel({ selection: [id], anchor: id });
      (handlers.menu ?? a.itemMenu)(e, ids);
    },
    onDragStart: (e, id) => startDrag(e, selection.includes(id) ? selection : [id]),
    onDragOver: (e, target) => {
      if (!carries(e)) return;
      e.preventDefault();
      e.stopPropagation();
      setDragOver(target);
    },
    onDragLeave: (target) => setDragOver((d) => (d === target ? null : d)),
    onDrop: (e, target) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(null);
      const ids = draggedItems(e);
      if (ids)
        a.move(
          ids.filter((id) => id !== target),
          target,
        );
      else a.importFiles([...e.dataTransfer.files], target);
    },
  };
}

const SORTS: [string, Sort][] = [
  ['Edited (newest)', { key: 'edited', dir: 'desc' }],
  ['Edited (oldest)', { key: 'edited', dir: 'asc' }],
  ['Name (A–Z)', { key: 'name', dir: 'asc' }],
  ['Name (Z–A)', { key: 'name', dir: 'desc' }],
  ['Status', { key: 'status', dir: 'asc' }],
  ['Size (largest)', { key: 'size', dir: 'desc' }],
];

function FolderView({ folderId }: { folderId: string | null }) {
  const a = useActions();
  const { data, error } = useVaultQuery((v) => v.listFolder(folderId), [folderId]);
  const [view, setView] = useState(() => readPref(VIEW_KEY, 'grid', ['grid', 'list'] as const));
  const [sort, setSort] = useState<Sort>({ key: 'edited', dir: 'desc' });
  const [dropping, setDropping] = useState(false);
  const now = Date.now();
  const folders = useMemo(() => (data ? sortFolders(data.folders, sort) : []), [data, sort]);
  const files = useMemo(() => (data ? sortFiles(data.files, sort) : []), [data, sort]);
  const order = [...folders.map((f) => f.id), ...files.map((f) => f.id)];
  // Coming back from the editor (P14.4): the file you had open is selected and the folder is
  // scrolled where you left it.
  const [cameFrom] = useState(() => readSession(LAST_FILE_KEY));
  const ev = useItemEvents(order, cameFrom);
  const fileMap = useMemo(() => new Map(Object.entries(a.index?.files ?? {})), [a.index]);
  const loaded = !!data;
  useLayoutEffect(() => {
    const main = document.querySelector<HTMLElement>('.vlt-main');
    if (!loaded || !main) return;
    const key = `plancraft-scroll:${folderId ?? 'home'}`;
    main.scrollTop = Number(readSession(key) ?? 0);
    const keep = () => writeSession(key, String(main.scrollTop));
    main.addEventListener('scroll', keep, { passive: true });
    return () => main.removeEventListener('scroll', keep);
  }, [loaded, folderId]);
  if (error && !data) return <Empty title="This folder can’t be shown" text={error} />;
  if (!data) return null;
  const sortLabel =
    SORTS.find(([, s]) => s.key === sort.key && s.dir === sort.dir)?.[0] ?? 'Custom';
  return (
    <div
      className={`vlt-view${dropping ? ' is-dropping' : ''}`}
      onClick={ev.clear}
      onContextMenu={(e) => a.areaMenu(e, folderId)}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDropping(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropping(false);
      }}
      onDrop={(e) => {
        setDropping(false);
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        a.importFiles([...e.dataTransfer.files], folderId);
      }}
    >
      <div className="vlt-section-title">
        <h3 className="pc-title">{view === 'grid' ? 'Folders' : 'Everything here'}</h3>
        {view === 'grid' && (
          <span className="vlt-sort">
            <span className="pc-muted pc-small">Sort</span>
            <Select
              label="Sort"
              options={SORTS.map(([l]) => l)}
              value={sortLabel}
              onChange={(l) => setSort(SORTS.find(([x]) => x === l)![1])}
            />
          </span>
        )}
        <Segmented
          label="View"
          options={['grid', 'list']}
          value={view}
          onChange={(v) => {
            setView(v as 'grid' | 'list');
            writePref(VIEW_KEY, v);
          }}
        />
      </div>
      {!folders.length && !files.length ? (
        <Empty
          title={folderId ? 'This folder is empty' : 'Your vault is empty'}
          text="Start a new plan, import a DXF drawing, or drop .dxf and .plancraft files here."
          actions={
            <>
              <Button variant="primary" onClick={() => a.newPlan(folderId)}>
                New plan
              </Button>
              <Button onClick={() => a.pick('dxf', folderId)}>Import DXF…</Button>
              <Button variant="ghost" onClick={() => a.newFolder(folderId)}>
                New folder
              </Button>
            </>
          }
        />
      ) : view === 'grid' ? (
        <>
          {folders.length ? (
            <FolderTiles folders={folders} files={fileMap} now={now} ev={ev} />
          ) : (
            <p className="pc-small pc-muted">No folders here. Use + New to add one.</p>
          )}
          <div className="vlt-section-title">
            <h3 className="pc-title">Files</h3>
          </div>
          {files.length ? (
            <FileCards files={files} now={now} ev={ev} />
          ) : (
            // Empty states say what goes here and offer the way to add it (skill §5, founder D3).
            <div className="vlt-empty-inline">
              <p className="pc-small pc-muted">No plans here yet.</p>
              <Button size="sm" variant="primary" onClick={() => a.newPlan(folderId)}>
                New plan
              </Button>
              <Button size="sm" onClick={() => a.pick('dxf', folderId)}>
                Import DXF…
              </Button>
            </div>
          )}
        </>
      ) : (
        <FileTable folders={folders} files={files} now={now} ev={ev} sort={sort} onSort={setSort} />
      )}
    </div>
  );
}

/**
 * Found things (Starred, Search, Trash) in grid or list, like a folder: the same view choice,
 * sort and selection. `actions` sit at the right of the title; `extra` adds a last table cell.
 */
function ItemsView({
  title,
  note,
  folders,
  files,
  ev,
  sort,
  onSort,
  actions,
  extra,
}: {
  title: ReactNode;
  note?: ReactNode;
  folders: Folder[];
  files: VaultFile[];
  ev: ListEvents;
  sort: Sort;
  onSort: (s: Sort) => void;
  actions?: ReactNode;
  extra?: (id: string) => ReactNode;
}) {
  const a = useActions();
  const [view, setView] = useState(() => readPref(VIEW_KEY, 'grid', ['grid', 'list'] as const));
  const ids = folders.map((f) => f.id);
  // Tiles need counts and papers, also for folders in Trash.
  const { data: summaries } = useVaultQuery((v) => v.folderSummaries(ids), [ids.join()]);
  const fileMap = useMemo(() => new Map(Object.entries(a.index?.files ?? {})), [a.index]);
  const now = Date.now();
  const sortLabel =
    SORTS.find(([, s]) => s.key === sort.key && s.dir === sort.dir)?.[0] ?? 'Custom';
  return (
    <div className="vlt-view" onClick={ev.clear}>
      <div className="vlt-section-title">
        <h3 className="pc-title">{title}</h3>
        {actions}
        {view === 'grid' && (
          <span className="vlt-sort">
            <span className="pc-muted pc-small">Sort</span>
            <Select
              label="Sort"
              options={SORTS.map(([l]) => l)}
              value={sortLabel}
              onChange={(l) => onSort(SORTS.find(([x]) => x === l)![1])}
            />
          </span>
        )}
        <Segmented
          label="View"
          options={['grid', 'list']}
          value={view}
          onChange={(v) => {
            setView(v as 'grid' | 'list');
            writePref(VIEW_KEY, v);
          }}
        />
      </div>
      {note && <p className="pc-small pc-muted vlt-view-note">{note}</p>}
      {view === 'grid' ? (
        <>
          {folders.length > 0 && (
            <FolderTiles folders={summaries ?? []} files={fileMap} now={now} ev={ev} />
          )}
          {folders.length > 0 && files.length > 0 && <div className="vlt-gap" />}
          {files.length > 0 && <FileCards files={files} now={now} ev={ev} />}
        </>
      ) : (
        <FileTable
          folders={summaries ?? folders}
          files={files}
          now={now}
          ev={ev}
          sort={sort}
          onSort={onSort}
          extra={extra}
        />
      )}
    </div>
  );
}

function StarredView() {
  const { data } = useVaultQuery((v) => v.search('', { starred: true }), []);
  const [sort, setSort] = useState<Sort>({ key: 'edited', dir: 'desc' });
  const hits = data ?? [];
  const folders = hits.flatMap((h: SearchHit) => (h.item.type === 'folder' ? [h.item.folder] : []));
  const files = sortFiles(
    hits.flatMap((h: SearchHit) => (h.item.type === 'file' ? [h.item.file] : [])),
    sort,
  );
  const ev = useItemEvents([...folders.map((f) => f.id), ...files.map((f) => f.id)]);
  if (!data) return null;
  if (!hits.length)
    return (
      <Empty
        title="Nothing starred"
        text="Star a file or folder (right-click → Star) to keep it here."
      />
    );
  return (
    <ItemsView
      title="Starred"
      folders={folders}
      files={files}
      ev={ev}
      sort={sort}
      onSort={setSort}
    />
  );
}

/** Days until something in Trash is deleted for ever (A2 P14.5: 30-day auto-delete). */
const TRASH_DAYS = 30;
const daysLeft = (trashedAt: string | null, now: number) =>
  trashedAt === null
    ? TRASH_DAYS
    : Math.max(0, Math.ceil((Date.parse(trashedAt) + TRASH_DAYS * 86_400_000 - now) / 86_400_000));

function TrashView() {
  const a = useActions();
  const { data } = useVaultQuery((v) => v.listTrash(), []);
  const [sort, setSort] = useState<Sort>({ key: 'edited', dir: 'desc' });
  const items = data ?? [];
  const folders = items.flatMap((i) => (i.type === 'folder' ? [i.folder] : []));
  const files = sortFiles(
    items.flatMap((i) => (i.type === 'file' ? [i.file] : [])),
    sort,
  );
  const ids = [...folders.map((f) => f.id), ...files.map((f) => f.id)];
  // In Trash, Enter and F2 do nothing; Delete deletes for ever (after a warning).
  const ev = useItemEvents(ids, null, {
    open: () => {},
    rename: () => {},
    remove: (sel) => a.deleteForever(sel),
    menu: (e, sel) => a.trashMenu(e, sel),
  });
  const events: ListEvents = {
    ...ev,
    onDragStart: (e) => e.preventDefault(),
    onDragOver: () => {},
    onDrop: (e) => e.preventDefault(),
  };
  if (!data) return null;
  if (!items.length)
    return (
      <Empty
        title="Trash is empty"
        text={`Things you move to Trash wait here for ${TRASH_DAYS} days, until you restore them or delete them for ever.`}
      />
    );
  const now = Date.now();
  const when = (id: string) => {
    const left = daysLeft(
      a.index?.folders[id]?.trashed_at ?? a.index?.files[id]?.trashed_at ?? null,
      now,
    );
    return left === 0 ? 'Deleted today' : `${left} ${left === 1 ? 'day' : 'days'} left`;
  };
  const picked = ev.selection;
  return (
    <ItemsView
      title="Trash"
      note={`Things here are deleted for ever ${TRASH_DAYS} days after they were moved to Trash. Select items to restore them or delete them now.`}
      folders={folders}
      files={files}
      ev={events}
      sort={sort}
      onSort={setSort}
      actions={
        <span className="vlt-row-actions" onClick={(e) => e.stopPropagation()}>
          {picked.length > 0 && (
            <>
              <Button size="sm" onClick={() => a.restoreAll(picked)}>
                Restore{picked.length > 1 ? ` ${picked.length}` : ''}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => a.deleteForever(picked)}>
                Delete for ever
              </Button>
            </>
          )}
          <Button variant="danger" size="sm" onClick={() => a.deleteForever(ids)}>
            Empty Trash
          </Button>
        </span>
      }
      extra={(id) => (
        <span className="vlt-row-actions">
          <span className="pc-small pc-muted">{when(id)}</span>
          <Button size="sm" onClick={() => a.restore(id)}>
            Restore
          </Button>
          <Button size="sm" variant="ghost" onClick={() => a.deleteForever([id])}>
            Delete for ever
          </Button>
        </span>
      )}
    />
  );
}

const FACINGS = [
  'north',
  'north_east',
  'east',
  'south_east',
  'south',
  'south_west',
  'west',
  'north_west',
] as const;
const facingLabel = (f: string) => f.replace('_', '-').replace(/^./, (c) => c.toUpperCase());
const STATUS_OPTIONS: [string, FileStatus | undefined][] = [
  ['Any status', undefined],
  ['Draft', 'draft'],
  ['In review', 'in_review'],
  ['Approved', 'approved'],
];

/** Search with filters (A2 P14.5): words in the name, plus kind, BHK, facing, status, owner. */
function SearchView({ params }: { params: SearchParams }) {
  const a = useActions();
  const [text, setText] = useState(params.q);
  const update = (patch: Partial<SearchParams>) => {
    const next = { ...params, ...patch };
    for (const k of Object.keys(next) as (keyof SearchParams)[])
      if (next[k] === undefined || (k !== 'q' && next[k] === '')) delete next[k];
    location.replace(routeHash({ page: 'search', search: next }));
  };
  // Typing updates the address (and the results) after a short pause.
  useEffect(() => {
    if (text === params.q) return;
    const t = setTimeout(() => update({ q: text }), 250);
    return () => clearTimeout(t);
  });
  const filters: SearchFilters = {
    ...(params.kind ? { kind: params.kind } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.bhk !== undefined ? { bhk: params.bhk } : {}),
    ...(params.facing ? { facing: params.facing } : {}),
    ...(params.owner ? { owner_id: params.owner } : {}),
  };
  const key = routeHash({ page: 'search', search: params });
  const { data } = useVaultQuery((v) => v.search(params.q, filters), [key]);
  const [sort, setSort] = useState<Sort>({ key: 'edited', dir: 'desc' });
  const hits = data ?? [];
  const folders = hits.flatMap((h) => (h.item.type === 'folder' ? [h.item.folder] : []));
  const files = sortFiles(
    hits.flatMap((h) => (h.item.type === 'file' ? [h.item.file] : [])),
    sort,
  );
  const ev = useItemEvents([...folders.map((f) => f.id), ...files.map((f) => f.id)]);
  const owners = [...new Set(Object.values(a.index?.files ?? {}).map((f) => f.owner_id))];
  const filtered = Object.keys(filters).length > 0;
  const pick = <T,>(
    label: string,
    options: [string, T | undefined][],
    value: T | undefined,
    set: (v: T | undefined) => void,
  ) => (
    <Field label={label}>
      {(id) => (
        <Select
          id={id}
          options={options.map(([l]) => l)}
          value={options.find(([, v]) => v === value)?.[0] ?? options[0]![0]}
          onChange={(l) => set(options.find(([x]) => x === l)?.[1])}
        />
      )}
    </Field>
  );
  return (
    <>
      <div className="vlt-filters" role="search">
        <Field label="Name contains">
          {(id) => (
            <TextInput
              id={id}
              autoFocus
              value={text}
              placeholder="e.g. 30x40 east"
              onChange={(e) => setText(e.target.value)}
            />
          )}
        </Field>
        {pick(
          'Kind',
          [
            ['Any kind', undefined],
            ['Plan', 'plan'],
            ['Sheet set', 'sheet_set'],
          ] as [string, 'plan' | 'sheet_set' | undefined][],
          params.kind,
          (kind) => update({ kind }),
        )}
        {pick(
          'BHK',
          [
            ['Any', undefined],
            ...[0, 1, 2, 3, 4, 5, 6].map((n): [string, number] => [String(n), n]),
          ],
          params.bhk,
          (bhk) => update({ bhk }),
        )}
        {pick(
          'Facing',
          [
            ['Any', undefined],
            ...FACINGS.map((f): [string, (typeof FACINGS)[number]] => [facingLabel(f), f]),
          ],
          params.facing,
          (facing) => update({ facing }),
        )}
        {pick('Status', STATUS_OPTIONS, params.status, (status) => update({ status }))}
        {pick(
          'Owner',
          [['Anyone', undefined], ...owners.map((o): [string, string] => [person(o).name ?? o, o])],
          params.owner,
          (owner) => update({ owner }),
        )}
        {(filtered || params.q) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setText('');
              location.replace(routeHash({ page: 'search', search: { q: '' } }));
            }}
          >
            Clear
          </Button>
        )}
      </div>
      {!data ? null : !params.q && !filtered ? (
        <Empty
          title="Search the Vault"
          text="Type part of a name, or choose a BHK, facing, status or owner. Filters find plans; words find plans and folders."
        />
      ) : hits.length ? (
        <ItemsView
          title={`${hits.length} ${hits.length === 1 ? 'result' : 'results'}`}
          folders={folders}
          files={files}
          ev={ev}
          sort={sort}
          onSort={setSort}
        />
      ) : (
        <Empty
          title="Nothing found"
          text="No file or folder matches. Try fewer words or clear a filter."
        />
      )}
    </>
  );
}

function LibraryView() {
  const a = useActions();
  const store = useMemo(() => new FetchStore(), []);
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState(() => readPref(VIEW_KEY, 'grid', ['grid', 'list'] as const));
  useEffect(() => {
    store.loadIndex().then(
      (i) => setEntries(i.entries),
      () => setFailed(true),
    );
  }, [store]);
  if (failed)
    return (
      <Empty
        title="The Plan Library can’t be reached"
        text="The library is served by the development server from data/library/."
      />
    );
  if (!entries) return null;
  if (!entries.length)
    return (
      <Empty
        title="The Plan Library is empty"
        text="Import drawings into it with npm run import and npm run library."
      />
    );
  const use = (e: LibraryEntry) => (
    <>
      <Button size="sm" variant="primary" onClick={() => a.copyLibrary(e)}>
        Use as starting point
      </Button>
      <a
        className="pc-btn pc-btn--ghost pc-btn--sm"
        href={routeHash({ page: 'library-plan', id: e.id })}
      >
        View
      </a>
    </>
  );
  return (
    <div className="vlt-view">
      <div className="vlt-section-title">
        <h3 className="pc-title">Plans to start from</h3>
        <Segmented
          label="View"
          options={['grid', 'list']}
          value={view}
          onChange={(v) => {
            setView(v as 'grid' | 'list');
            writePref(VIEW_KEY, v);
          }}
        />
      </div>
      {view === 'list' ? (
        <table className="vlt-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Plot</th>
              <th>BHK</th>
              <th>Facing</th>
              <th>Converted</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>
                  <span className="vlt-file">
                    <Icon.File />
                    {e.name.replace(/^.*\//, '')}
                  </span>
                </td>
                <td className="pc-mono">{e.tags.plot_size_ft}</td>
                <td className="pc-mono">{e.tags.bhk.value}</td>
                <td>{e.tags.facing.value}</td>
                <td className="pc-muted">{e.status === 'success' ? 'Fully' : 'Partly'}</td>
                <td>
                  <span className="vlt-row-actions">{use(e)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="vlt-cards">
          {entries.map((e) => (
            <div key={e.id} className="vlt-card vlt-card--library">
              <span className="vlt-card-paper">
                <LibraryThumb store={store} id={e.id} />
              </span>
              <span className="vlt-card-name">{e.name.replace(/^.*\//, '')}</span>
              <span className="vlt-card-meta">
                {e.tags.plot_size_ft} · {e.tags.bhk.value} BHK · {e.tags.facing.value}
              </span>
              <span className="vlt-card-actions">{use(e)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LibraryThumb({ store, id }: { store: FetchStore; id: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    store.loadPlan(id).then((json) => {
      const loaded = json ? loadPlan(json) : null;
      if (!live || !loaded?.ok) return;
      const svg = planThumbnailSvg(loaded.plan, validatePlan(loaded.plan).rooms);
      setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    });
    return () => {
      live = false;
    };
  }, [store, id]);
  return src ? <img src={src} alt="" /> : <span className="vlt-thumb-empty" />;
}

function Empty({ title, text, actions }: { title: string; text: string; actions?: ReactNode }) {
  return (
    <div className="vlt-empty">
      <span className="pc-eyebrow">( {title} )</span>
      <p className="pc-small">{text}</p>
      {actions && <div className="vlt-empty-actions">{actions}</div>}
    </div>
  );
}

function HelpDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const keys: [string, string][] = [
    ['⌘K', 'Search files, folders and commands'],
    ['N', 'New plan'],
    ['⇧N', 'New folder'],
    ['↵', 'Open the selected file or folder'],
    ['F2', 'Rename'],
    ['Del', 'Move to Trash'],
    ['⌘A', 'Select everything here'],
    ['⌘ / ⇧ click', 'Select several'],
    ['Space', 'Select the focused item (Tab moves between items)'],
    ['Esc', 'Clear the selection'],
  ];
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(ref);
  return (
    <div className="pc-backdrop">
      <div ref={ref} className="pc-dialog" role="dialog" aria-modal="true" aria-label="Help">
        <div className="pc-dialog-body">
          <h2 className="pc-section">Keyboard shortcuts</h2>
          <dl className="vlt-keys">
            {keys.map(([k, t]) => (
              <div key={k}>
                <dt className="vlt-kbd">{k}</dt>
                <dd>{t}</dd>
              </div>
            ))}
          </dl>
          <p className="pc-small">
            Drag files and folders onto a folder, the tree or the breadcrumb to move them. Drop .dxf
            or .plancraft files anywhere in a folder to import them.
          </p>
        </div>
        <div className="pc-dialog-foot">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

/** ⌘K: files and folders by name, commands, and the Ask AI entry. */
function Palette({
  onClose,
  newEntries,
  onTheme,
  onSettings,
}: {
  onClose: () => void;
  newEntries: MenuEntry[];
  onTheme: () => void;
  onSettings: () => void;
}) {
  const [query, setQuery] = useState('');
  const paletteRef = useRef<HTMLDivElement>(null);
  useModalFocus(paletteRef);
  const [active, setActive] = useState(0);
  const { data: hits } = useVaultQuery(
    (v) => (query.trim() ? v.search(query) : Promise.resolve([] as SearchHit[])),
    [query],
  );
  const { data: recent } = useVaultQuery((v) => v.recent(5), []);
  type Item = { group: string; label: string; icon: ReactNode; hint?: string; run: () => void };
  const items: Item[] = [];
  const fileItem = (f: VaultFile, path: string[]): Item => ({
    group: 'Files',
    label: f.name,
    hint: path.join(' › '),
    icon: <Icon.File />,
    run: () => go({ page: 'file', id: f.id }),
  });
  if (query.trim()) {
    for (const h of (hits ?? []).slice(0, 12))
      items.push(
        h.item.type === 'file'
          ? fileItem(h.item.file, h.path)
          : {
              group: 'Folders',
              label: h.item.folder.name,
              hint: h.path.join(' › '),
              icon: <FolderIcon colour={h.item.folder.color} />,
              run: () =>
                go({ page: 'folder', id: (h.item as { folder: { id: string } }).folder.id }),
            },
      );
  } else for (const f of recent ?? []) items.push({ ...fileItem(f, []), group: 'Recent' });
  const commands: Item[] = [
    ...newEntries.flatMap((e) =>
      typeof e === 'object' && 'onSelect' in e
        ? [{ group: 'Commands', label: e.label, icon: e.icon, hint: e.shortcut, run: e.onSelect }]
        : [],
    ),
    {
      group: 'Commands',
      label: 'Search with filters (BHK, facing, status…)',
      icon: <Icon.Search />,
      run: () => go({ page: 'search', search: { q: query.trim() } }),
    },
    {
      group: 'Commands',
      label: 'Go to Plan Library',
      icon: <Icon.Library />,
      run: () => go({ page: 'library' }),
    },
    {
      group: 'Commands',
      label: 'Go to Starred',
      icon: <Icon.Star />,
      run: () => go({ page: 'starred' }),
    },
    {
      group: 'Commands',
      label: 'Go to Trash',
      icon: <Icon.Trash />,
      run: () => go({ page: 'trash' }),
    },
    { group: 'Commands', label: 'Switch light / dark', icon: <Icon.Moon />, run: onTheme },
    {
      group: 'Commands',
      label: 'Settings: text size',
      icon: <Icon.Settings />,
      run: onSettings,
    },
  ];
  const q = query.trim().toLowerCase();
  if (q)
    items.push({
      group: 'Search',
      label: `See all results for “${query.trim()}”`,
      icon: <Icon.Search />,
      run: () => go({ page: 'search', search: { q: query.trim() } }),
    });
  items.push(...commands.filter((c) => !q || c.label.toLowerCase().includes(q)));
  if (q)
    items.push({
      group: 'Ask AI',
      label: `Ask AI: “${query.trim()}”`,
      icon: <Icon.Sparkle />,
      run: () => go({ page: 'ask' }),
    });
  const pick = Math.min(active, items.length - 1);
  const choose = (i: Item) => {
    onClose();
    i.run();
  };
  const groups: { name: string; rows: { it: Item; i: number }[] }[] = [];
  items.forEach((it, i) => {
    const g = groups.at(-1);
    if (g?.name === it.group) g.rows.push({ it, i });
    else groups.push({ name: it.group, rows: [{ it, i }] });
  });
  return (
    <div
      className="pc-backdrop vlt-palette-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={paletteRef}
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
            placeholder="Search files, folders and commands"
            aria-label="Search files, folders and commands"
            role="combobox"
            aria-expanded="true"
            aria-controls="vlt-palette-results"
            aria-activedescendant={items[pick] ? `vlt-palette-item-${pick}` : undefined}
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
          id="vlt-palette-results"
          className="vlt-palette-list"
          role="listbox"
          aria-label="Results"
        >
          {groups.map((g) => (
            <div key={g.name} className="vlt-palette-group" role="group" aria-label={g.name}>
              <span className="pc-eyebrow" aria-hidden="true">
                {g.name}
              </span>
              {g.rows.map(({ it, i }) => (
                <div
                  key={i}
                  id={`vlt-palette-item-${i}`}
                  role="option"
                  aria-selected={i === pick}
                  className="vlt-palette-item"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(it)}
                >
                  {it.icon}
                  <span className="vlt-palette-label">{it.label}</span>
                  {it.hint && <span className="vlt-kbd">{it.hint}</span>}
                </div>
              ))}
            </div>
          ))}
          {!items.length && <p className="pc-small vlt-palette-none">Nothing matches “{query}”.</p>}
        </div>
      </div>
    </div>
  );
}
