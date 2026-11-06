import type { FileStatus, FolderSummary, VaultFile } from '@plancraft/engine';

// Pure helpers for the Vault screen (P14.3): how times and sizes read, how rows sort, and how
// clicks change the selection. Kept apart from React so they are tested on their own.

/** "just now", "5 min ago", "2 h ago", "yesterday", "3 days ago", then the date. */
export function timeAgo(iso: string, now: number): string {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 2 * 86_400) return 'yesterday';
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)} days ago`;
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Bytes in KB / MB / GB (1 KB = 1024 bytes), one decimal under 10. */
export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

export type SortKey = 'name' | 'owner' | 'edited' | 'branches' | 'status' | 'size';
export interface Sort {
  key: SortKey;
  dir: 'asc' | 'desc';
}
const STATUS_ORDER: Record<FileStatus, number> = { draft: 0, in_review: 1, approved: 2 };
const byName = (a: string, b: string) =>
  a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });

export function sortFiles(files: readonly VaultFile[], { key, dir }: Sort): VaultFile[] {
  const sign = dir === 'asc' ? 1 : -1;
  const cmp = (a: VaultFile, b: VaultFile): number => {
    switch (key) {
      case 'name':
        return byName(a.name, b.name);
      case 'owner':
        return byName(a.owner_id, b.owner_id);
      case 'edited':
        return a.updated_at < b.updated_at ? -1 : a.updated_at > b.updated_at ? 1 : 0;
      case 'branches':
        return a.branch_count - b.branch_count;
      case 'status':
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      case 'size':
        return a.size_bytes - b.size_bytes;
    }
  };
  return [...files].sort(
    (a, b) => sign * cmp(a, b) || byName(a.name, b.name) || (a.id < b.id ? -1 : 1),
  );
}

/** Folders sort by name for name sorts, otherwise keep their own order (drag order). */
export function sortFolders(
  folders: readonly FolderSummary[],
  { key, dir }: Sort,
): FolderSummary[] {
  if (key === 'name')
    return [...folders].sort((a, b) => (dir === 'asc' ? 1 : -1) * byName(a.name, b.name));
  if (key === 'edited')
    return [...folders].sort(
      (a, b) =>
        (dir === 'asc' ? 1 : -1) *
        (a.updated_at < b.updated_at ? -1 : a.updated_at > b.updated_at ? 1 : 0),
    );
  return [...folders];
}

/**
 * The selection after a click on `id` among `order` (the items as shown): a plain click picks
 * one, ⌘/Ctrl adds or removes, Shift selects the range from the last plain click (`anchor`).
 */
export function clickSelect(
  selection: readonly string[],
  anchor: string | null,
  id: string,
  order: readonly string[],
  mods: { toggle?: boolean; range?: boolean },
): { selection: string[]; anchor: string | null } {
  if (mods.range && anchor !== null && order.includes(anchor)) {
    const [a, b] = [order.indexOf(anchor), order.indexOf(id)].sort((x, y) => x - y);
    const range = order.slice(a!, b! + 1);
    return {
      selection: mods.toggle ? [...new Set([...selection, ...range])] : range,
      anchor,
    };
  }
  if (mods.toggle)
    return {
      selection: selection.includes(id) ? selection.filter((x) => x !== id) : [...selection, id],
      anchor: id,
    };
  return { selection: [id], anchor: id };
}
