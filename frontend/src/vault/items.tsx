import type { FileStatus, Folder, FolderSummary, VaultFile } from '@plancraft/engine';
import {
  useEffect,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { FolderIcon, Icon } from '../ui/icons.tsx';
import { LOCAL_USER, useVault } from './client.ts';
import { ArchiveFolder, ColourFolder, GlassFolder, Tile, type Person } from './folder-art.tsx';
import { bytes, timeAgo, type Sort, type SortKey } from './listing.ts';

// Rows, cards and tiles of the Vault screen (P14.3), drawn from vault records. Thumbnails come
// from the vault (`getThumbnail`) and are shown as images, so nothing in them can run.

/** px → rem, so sizes set in code follow the UI scale (DS-03). */
const rem = (px?: number) => (px === undefined ? undefined : `${px / 16}rem`);

/** Everyone is the local user until accounts exist (P10.1). */
export function person(id: string): Person {
  return id === LOCAL_USER.id
    ? { initials: 'Y', colour: 'var(--pc-avatar-local-bg)', name: LOCAL_USER.name }
    : { initials: id.slice(0, 1).toUpperCase(), colour: '#bfe8cf', name: id };
}

export const Avatar = ({ id, size }: { id: string; size?: number }) => {
  const p = person(id);
  return (
    <span
      className="vlt-avatar"
      style={{ background: p.colour, width: rem(size), height: rem(size) }}
      title={p.name}
    >
      {p.initials}
    </span>
  );
};

const STATUS: Record<FileStatus, [string, string]> = {
  draft: ['Draft', ''],
  in_review: ['In review', 'vlt-status--review'],
  approved: ['Approved', 'vlt-status--approved'],
};
export const StatusPill = ({ status }: { status: FileStatus }) => (
  <span className={`vlt-status ${STATUS[status][1]}`}>{STATUS[status][0]}</span>
);
export const STATUS_LABEL = (s: FileStatus) => STATUS[s][0];

/** A file's thumbnail, redrawn by the vault when the plan has changed since. */
export function Thumb({ file }: { file: VaultFile }) {
  const { vault } = useVault();
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    vault.getThumbnail(file.id).then(
      (svg) => live && setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`),
      () => live && setSrc(null),
    );
    return () => {
      live = false;
    };
  }, [vault, file.id, file.doc_rev]);
  return src ? <img src={src} alt="" draggable={false} /> : <span className="vlt-thumb-empty" />;
}

/** A click, or a key press standing in for one (Space selects from the keyboard). */
type ClickLike = Pick<MouseEvent, 'metaKey' | 'ctrlKey' | 'shiftKey' | 'stopPropagation'>;

/** Interaction shared by every row, card and tile. */
export interface ItemEvents {
  selected: (id: string) => boolean;
  dragOver: string | null;
  onClick: (e: ClickLike, id: string) => void;
  onOpen: (id: string) => void;
  onMenu: (e: MouseEvent, id: string) => void;
  onDragStart: (e: DragEvent, id: string) => void;
  /** Folders only: something is dragged over or dropped onto them. */
  onDragOver: (e: DragEvent, folderId: string) => void;
  onDragLeave: (folderId: string) => void;
  onDrop: (e: DragEvent, folderId: string) => void;
}

/**
 * Keyboard on a focused row, card or tile: Enter opens that item (not the previous selection),
 * Space selects it (⌘/Ctrl or Shift as with a click).
 */
const keysFor = (ev: ItemEvents, id: string) => (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    ev.onOpen(id);
  } else if (e.key === ' ') {
    e.preventDefault();
    ev.onClick(e, id);
  }
};

const folderMeta = (f: FolderSummary) =>
  [
    `${f.file_count} ${f.file_count === 1 ? 'file' : 'files'}`,
    f.subfolder_count
      ? `${f.subfolder_count} ${f.subfolder_count === 1 ? 'folder' : 'folders'}`
      : '',
  ]
    .filter(Boolean)
    .join(' · ');

export function FolderTiles({
  folders,
  files,
  now,
  ev,
}: {
  folders: FolderSummary[];
  /** Files by id, for the papers. */
  files: Map<string, VaultFile>;
  now: number;
  ev: ItemEvents;
}) {
  return (
    <div className="vlt-tiles">
      {folders.map((f) => (
        <Tile
          key={f.id}
          name={f.name}
          meta={folderMeta(f)}
          selected={ev.selected(f.id)}
          state={ev.dragOver === f.id ? 'is-dragover' : ''}
          onClick={(e) => ev.onClick(e, f.id)}
          onDoubleClick={() => ev.onOpen(f.id)}
          onContextMenu={(e) => ev.onMenu(e, f.id)}
          onKeyDown={keysFor(ev, f.id)}
          draggable
          onDragStart={(e) => ev.onDragStart(e, f.id)}
          onDragOver={(e) => ev.onDragOver(e, f.id)}
          onDragLeave={() => ev.onDragLeave(f.id)}
          onDrop={(e) => ev.onDrop(e, f.id)}
        >
          {f.archived ? (
            <ArchiveFolder badge={`ZIP · ${bytes(f.size_bytes)}`} />
          ) : f.style === 'colour' ? (
            <ColourFolder colour={f.color} badge={folderMeta(f).split(' · ')[0]} />
          ) : (
            <GlassFolder
              colour={f.color}
              papers={f.preview_file_ids.flatMap((id) => {
                const file = files.get(id);
                return file ? [<Thumb key={id} file={file} />] : [];
              })}
              people={[person(f.owner_id)]}
              updated={`Updated ${timeAgo(f.updated_at, now).replace(' ago', '')}`}
            />
          )}
        </Tile>
      ))}
    </div>
  );
}

export function FileCards({ files, now, ev }: { files: VaultFile[]; now: number; ev: ItemEvents }) {
  return (
    <div className="vlt-cards">
      {files.map((f) => (
        <button
          key={f.id}
          type="button"
          className="vlt-card"
          aria-selected={ev.selected(f.id)}
          onClick={(e) => ev.onClick(e, f.id)}
          onDoubleClick={() => ev.onOpen(f.id)}
          onContextMenu={(e) => ev.onMenu(e, f.id)}
          onKeyDown={keysFor(ev, f.id)}
          draggable
          onDragStart={(e) => ev.onDragStart(e, f.id)}
        >
          <span className="vlt-card-paper">
            <Thumb file={f} />
          </span>
          <span className="vlt-card-name" title={f.name}>
            {f.starred && (
              <span className="vlt-star" aria-label="Starred">
                ★
              </span>
            )}
            {f.name}
          </span>
          <span className="vlt-card-meta">
            {timeAgo(f.updated_at, now)} · <StatusPill status={f.status} />
          </span>
        </button>
      ))}
    </div>
  );
}

const COLUMNS: [SortKey, string][] = [
  ['name', 'Name'],
  ['owner', 'Owner'],
  ['edited', 'Edited'],
  ['branches', 'Branches'],
  ['status', 'Status'],
  ['size', 'Size'],
];

/** The files table; folders (if any) come first as rows. Headers sort. */
export function FileTable({
  folders = [],
  files,
  now,
  ev,
  sort,
  onSort,
  extra,
}: {
  folders?: (Folder & { file_count?: number; size_bytes?: number })[];
  files: VaultFile[];
  now: number;
  ev: ItemEvents;
  sort: Sort;
  onSort: (s: Sort) => void;
  /** An extra cell at the end of every row (e.g. Restore in Trash). */
  extra?: (id: string) => ReactNode;
}) {
  const header = (key: SortKey, label: string) => (
    <th
      key={key}
      aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <button
        type="button"
        className="vlt-th"
        onClick={() =>
          onSort({
            key,
            dir:
              sort.key === key && sort.dir === 'asc'
                ? 'desc'
                : key === 'edited' && sort.key !== key
                  ? 'desc'
                  : 'asc',
          })
        }
      >
        {label}
        {sort.key === key && <span aria-hidden="true">{sort.dir === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  );
  return (
    <table className="vlt-table">
      <thead>
        <tr>
          {COLUMNS.map(([k, l]) => header(k, l))}
          {extra && <th />}
        </tr>
      </thead>
      <tbody>
        {folders.map((f) => (
          <tr
            key={f.id}
            aria-selected={ev.selected(f.id)}
            className={ev.dragOver === f.id ? 'is-dragover' : undefined}
            tabIndex={0}
            onClick={(e) => ev.onClick(e, f.id)}
            onDoubleClick={() => ev.onOpen(f.id)}
            onContextMenu={(e) => ev.onMenu(e, f.id)}
            onKeyDown={keysFor(ev, f.id)}
            draggable
            onDragStart={(e) => ev.onDragStart(e, f.id)}
            onDragOver={(e) => ev.onDragOver(e, f.id)}
            onDragLeave={() => ev.onDragLeave(f.id)}
            onDrop={(e) => ev.onDrop(e, f.id)}
          >
            <td>
              <span className="vlt-file" title={f.name}>
                <FolderIcon colour={f.color} />
                {f.name}
                {f.archived && <span className="pc-chip pc-micro">archived</span>}
              </span>
            </td>
            <td>
              <span className="vlt-person">
                <Avatar id={f.owner_id} />
                {person(f.owner_id).name}
              </span>
            </td>
            <td>{timeAgo(f.updated_at, now)}</td>
            <td className="pc-mono pc-muted">—</td>
            <td className="pc-muted">
              {f.file_count !== undefined
                ? `${f.file_count} ${f.file_count === 1 ? 'file' : 'files'}`
                : 'Folder'}
            </td>
            <td className="pc-mono pc-muted">
              {f.size_bytes !== undefined ? bytes(f.size_bytes) : ''}
            </td>
            {extra && <td>{extra(f.id)}</td>}
          </tr>
        ))}
        {files.map((f) => (
          <tr
            key={f.id}
            aria-selected={ev.selected(f.id)}
            tabIndex={0}
            onClick={(e) => ev.onClick(e, f.id)}
            onDoubleClick={() => ev.onOpen(f.id)}
            onContextMenu={(e) => ev.onMenu(e, f.id)}
            onKeyDown={keysFor(ev, f.id)}
            draggable
            onDragStart={(e) => ev.onDragStart(e, f.id)}
          >
            <td>
              <span className="vlt-file" title={f.name}>
                {f.kind === 'plan' ? <Icon.File /> : <Icon.Sheets />}
                {f.name}
                {f.starred && (
                  <span className="vlt-star" aria-label="Starred">
                    ★
                  </span>
                )}
                {f.archived && <span className="pc-chip pc-micro">archived</span>}
              </span>
            </td>
            <td>
              <span className="vlt-person">
                <Avatar id={f.owner_id} />
                {person(f.owner_id).name}
              </span>
            </td>
            <td>
              <span className="vlt-person">
                {timeAgo(f.updated_at, now)} <Avatar id={f.last_editor_id} size={20} />
              </span>
            </td>
            <td className="pc-mono">{f.branch_count}</td>
            <td>
              <StatusPill status={f.status} />
            </td>
            <td className="pc-mono pc-muted">{bytes(f.size_bytes)}</td>
            {extra && <td>{extra(f.id)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
