import type { VaultFile } from '@plancraft/engine';
import { describe, expect, it } from 'vitest';
import { bytes, clickSelect, sortFiles, timeAgo } from './listing.ts';

const file = (id: string, extra: Partial<VaultFile>): VaultFile => ({
  id,
  workspace_id: 'w',
  name: id,
  owner_id: 'u',
  created_at: '2026-11-01T00:00:00.000Z',
  updated_at: '2026-11-01T00:00:00.000Z',
  starred: false,
  archived: false,
  trashed_at: null,
  folder_id: null,
  kind: 'plan',
  status: 'draft',
  last_editor_id: 'u',
  branch_count: 0,
  size_bytes: 0,
  doc_rev: 1,
  thumbnail_rev: 0,
  active_ms: 0,
  ...extra,
});

describe('Vault listing helpers', () => {
  it('says how long ago something changed', () => {
    const now = Date.parse('2026-11-06T12:00:00Z');
    expect(timeAgo('2026-11-06T11:59:30Z', now)).toBe('just now');
    expect(timeAgo('2026-11-06T11:55:00Z', now)).toBe('5 min ago');
    expect(timeAgo('2026-11-06T10:00:00Z', now)).toBe('2 h ago');
    expect(timeAgo('2026-11-05T09:00:00Z', now)).toBe('yesterday');
    expect(timeAgo('2026-11-02T12:00:00Z', now)).toBe('4 days ago');
    expect(timeAgo('2026-10-01T12:00:00Z', now)).toBe('1 Oct 2026');
  });

  it('writes sizes in KB and MB', () => {
    expect([bytes(900), bytes(5_300), bytes(250_000), bytes(1_288_490_189)]).toEqual([
      '900 B',
      '5.2 KB',
      '244 KB',
      '1.2 GB',
    ]);
  });

  it('sorts files by any column, ties by name', () => {
    const files = [
      file('b', { status: 'approved', size_bytes: 10, updated_at: '2026-11-03T00:00:00.000Z' }),
      file('a10', { status: 'draft', size_bytes: 30 }),
      file('a2', { status: 'in_review', size_bytes: 20, updated_at: '2026-11-05T00:00:00.000Z' }),
    ];
    const ids = (key: Parameters<typeof sortFiles>[1]['key'], dir: 'asc' | 'desc' = 'asc') =>
      sortFiles(files, { key, dir }).map((f) => f.id);
    expect(ids('name')).toEqual(['a2', 'a10', 'b']);
    expect(ids('edited', 'desc')).toEqual(['a2', 'b', 'a10']);
    expect(ids('status')).toEqual(['a10', 'a2', 'b']);
    expect(ids('size', 'desc')).toEqual(['a10', 'a2', 'b']);
  });

  it('selects with click, ⌘-click and Shift-click', () => {
    const order = ['a', 'b', 'c', 'd', 'e'];
    let s = clickSelect([], null, 'b', order, {});
    expect(s).toEqual({ selection: ['b'], anchor: 'b' });
    s = clickSelect(s.selection, s.anchor, 'd', order, { range: true });
    expect(s.selection).toEqual(['b', 'c', 'd']);
    s = clickSelect(s.selection, s.anchor, 'c', order, { toggle: true });
    expect(s.selection).toEqual(['b', 'd']);
    s = clickSelect(s.selection, s.anchor, 'a', order, { range: true });
    expect(s.selection).toEqual(['a', 'b', 'c']);
  });
});
