import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { sequentialIds, steppingClock } from '../ids.ts';
import sampleB from '../samples/1.3.0/b-1bhk-t-junctions.plan.json' with { type: 'json' };
import oldSampleB from '../samples/1.0.0/b-1bhk-t-junctions.plan.json' with { type: 'json' };
import { blankPlan } from '../samples/blank-plan.ts';
import { gridPlan } from '../samples/grid-plan.ts';
import { CURRENT_SCHEMA_VERSION } from '../schema/version.ts';
import { seedDemoVault } from './demo.ts';
import { VaultIndex, migrateVaultIndex } from './records.ts';
import { MemoryStorage } from './storage.ts';
import { Vault, VaultConflictError } from './vault.ts';
import { readZip, utf8, utf8Text, writeZip } from './zip.ts';

function setup() {
  const storage = new MemoryStorage();
  const vault = new Vault({
    storage,
    ids: sequentialIds('v'),
    clock: steppingClock('2026-11-06T10:00:00.000Z', 60_000),
    user: { id: 'u-asha' },
    workspace: { id: 'w-1', name: 'Studio' },
  });
  return { storage, vault };
}

describe('Vault: folders and files', () => {
  it('creates folders and files, lists them with counts, and keeps the index valid', async () => {
    const { vault, storage } = setup();
    const res = await vault.createFolder({ parentId: null, name: '  Residential ', color: 'blue' });
    const plots = await vault.createFolder({ parentId: res.id, name: '30×40 plots' });
    const file = await vault.createFile({ folderId: plots.id, plan: sampleB });
    expect(res.name).toBe('Residential');
    expect(file).toMatchObject({
      name: 'Sample B - 1BHK with T-junctions',
      kind: 'plan',
      status: 'draft',
      owner_id: 'u-asha',
      workspace_id: 'w-1',
      doc_rev: 1,
      summary: { bhk: 1, facing: 'east' },
    });
    expect(file.size_bytes).toBe(utf8(JSON.stringify(sampleB)).length);

    const top = await vault.listFolder(null);
    expect(top.folders).toHaveLength(1);
    expect(top.folders[0]).toMatchObject({
      name: 'Residential',
      file_count: 1,
      subfolder_count: 1,
      size_bytes: file.size_bytes,
      preview_file_ids: [file.id],
    });
    const inside = await vault.listFolder(plots.id);
    expect(inside.path.map((f) => f.name)).toEqual(['Residential', '30×40 plots']);
    expect(inside.files.map((f) => f.id)).toEqual([file.id]);
    const tree = await vault.tree();
    expect(tree[0]).toMatchObject({ file_count: 1, children: [{ file_count: 1 }] });
    // Saving a file marks its folders as updated.
    expect(top.folders[0]!.updated_at).toBe(file.created_at);
    expect(VaultIndex.parse(JSON.parse((await storage.read('index.json'))!))).toBeTruthy();
  });

  it('refuses bad names, bad plans and missing folders with a plain reason', async () => {
    const { vault } = setup();
    await expect(vault.createFolder({ parentId: null, name: '   ' })).rejects.toThrow(
      /a name is needed/,
    );
    await expect(vault.createFolder({ parentId: 'nope', name: 'X' })).rejects.toThrow(
      /no longer exists/,
    );
    await expect(
      vault.createFile({ folderId: null, plan: { schema_version: '1.1.0' } }),
    ).rejects.toThrow(/can't be stored/);
    // A new, empty plan is fine.
    const blank = await vault.createFile({ folderId: null, plan: blankPlan({ name: 'New plan' }) });
    expect(blank.summary?.plot).toBe('30 × 40 ft');
  });

  it('renames, stars, colours, sets status and archives', async () => {
    const { vault } = setup();
    const f = await vault.createFolder({ parentId: null, name: 'Villas' });
    const file = await vault.createFile({ folderId: f.id, plan: sampleB });
    await vault.rename(file.id, 'Client A — 1BHK');
    await vault.setStar(file.id, true);
    await vault.setStatus(file.id, 'approved');
    await vault.setColor(f.id, 'green');
    await vault.archive(f.id);
    const ix = await vault.index();
    expect(ix.files[file.id]).toMatchObject({
      name: 'Client A — 1BHK',
      starred: true,
      status: 'approved',
    });
    expect(ix.folders[f.id]).toMatchObject({ color: 'green', archived: true });
    await expect(vault.setColor(file.id, 'red')).rejects.toThrow(/Only folders/);
    // Archived files are left out of Recent but stay in their folder.
    await vault.archive(file.id);
    expect(await vault.recent()).toEqual([]);
    expect((await vault.listFolder(f.id)).files).toHaveLength(1);
  });

  it('moves files and folders, but never a folder into itself', async () => {
    const { vault } = setup();
    const a = await vault.createFolder({ parentId: null, name: 'A' });
    const b = await vault.createFolder({ parentId: a.id, name: 'B' });
    const file = await vault.createFile({ folderId: a.id, plan: sampleB });
    await vault.move(file.id, b.id);
    const moved = (await vault.listFolder(b.id)).files;
    expect(moved.map((f) => f.id)).toEqual([file.id]);
    // Moving is not editing: the file keeps its edit time, the folder it went into changes.
    expect(moved[0]!.updated_at).toBe(file.updated_at);
    expect((await vault.index()).folders[b.id]!.updated_at > file.updated_at).toBe(true);
    await expect(vault.move(a.id, b.id)).rejects.toThrow(/inside itself/);
    await expect(vault.move(a.id, a.id)).rejects.toThrow(/inside itself/);
    await vault.move(b.id, null);
    expect((await vault.listFolder(null)).folders.map((f) => f.name)).toEqual(['A', 'B']);
  });

  it('duplicates a file, and a folder with everything in it', async () => {
    const { vault, storage } = setup();
    const a = await vault.createFolder({ parentId: null, name: 'A' });
    const sub = await vault.createFolder({ parentId: a.id, name: 'Sub' });
    const file = await vault.createFile({ folderId: sub.id, plan: sampleB });
    await vault.setStatus(file.id, 'approved');
    const copyId = await vault.duplicate(file.id);
    const ix = await vault.index();
    expect(ix.files[copyId]).toMatchObject({
      name: `${file.name} (copy)`,
      folder_id: sub.id,
      status: 'draft',
    });
    expect(await storage.read(`docs/${copyId}.json`)).toBe(
      await storage.read(`docs/${file.id}.json`),
    );
    const folderCopy = await vault.duplicate(a.id);
    const listing = await vault.listFolder(null);
    expect(listing.folders.map((f) => [f.name, f.file_count])).toEqual([
      ['A', 2],
      ['A (copy)', 2],
    ]);
    expect((await vault.listFolder(folderCopy)).folders.map((f) => f.name)).toEqual(['Sub']);
  });
});

describe('Vault: Trash', () => {
  it('trashes with contents, restores, and deletes for ever only from Trash', async () => {
    const { vault, storage } = setup();
    const a = await vault.createFolder({ parentId: null, name: 'A' });
    const file = await vault.createFile({ folderId: a.id, plan: sampleB });
    await vault.getThumbnail(file.id);
    await expect(vault.deleteForever(file.id)).rejects.toThrow(/must be in Trash/);

    await vault.trash(a.id);
    expect((await vault.listFolder(null)).folders).toEqual([]);
    expect(await vault.recent()).toEqual([]);
    expect((await vault.listTrash()).map((i) => i.type)).toEqual(['folder']);
    await expect(vault.rename(file.id, 'X')).rejects.toThrow(/in Trash/);
    await expect(vault.saveDocument(file.id, sampleB)).rejects.toThrow(/in Trash/);

    expect(await vault.restore(a.id)).toBeNull();
    expect((await vault.listFolder(null)).folders).toHaveLength(1);
    await expect(vault.restore(a.id)).rejects.toThrow(/not in Trash/);

    // A file whose folder is still in Trash comes back at the top level.
    await vault.trash(file.id);
    await vault.trash(a.id);
    expect(await vault.restore(file.id)).toBeNull();
    expect((await vault.listFolder(null)).files.map((f) => f.id)).toEqual([file.id]);

    await vault.deleteForever(a.id);
    await vault.trash(file.id);
    await vault.deleteForever(file.id);
    const ix = await vault.index();
    expect([Object.keys(ix.folders), Object.keys(ix.files)]).toEqual([[], []]);
    expect([...storage.data.keys()]).toEqual(['index.json']);
  });

  it('empties Trash of things older than 30 days', async () => {
    const storage = new MemoryStorage();
    let now = Date.parse('2026-11-06T10:00:00Z');
    const vault = new Vault({
      storage,
      ids: sequentialIds('v'),
      clock: { now: () => new Date(now).toISOString() },
      user: { id: 'u' },
    });
    const old = await vault.createFile({ folderId: null, plan: sampleB });
    const fresh = await vault.createFile({ folderId: null, plan: sampleB });
    await vault.trash(old.id);
    now += 20 * 86_400_000;
    await vault.trash(fresh.id);
    now += 11 * 86_400_000;
    expect(await vault.purgeTrash()).toBe(1);
    expect(Object.keys((await vault.index()).files)).toEqual([fresh.id]);
  });
});

describe('Vault: search, recent, documents and thumbnails', () => {
  it('finds by every word of the name, with filters, outside Trash', async () => {
    const { vault } = setup();
    await seedDemoVault(vault);
    const names = async (q: string, f = {}) =>
      (await vault.search(q, f)).map(
        (h) => (h.item.type === 'file' ? h.item.file : h.item.folder).name,
      );
    expect(await names('east 1bhk')).toEqual(['1BHK east, T-junctions']);
    expect(await names('plots')).toEqual(['30×40 plots']);
    expect(await names('', { status: 'approved' })).toEqual(['L-hall with duct']);
    expect(await names('', { bhk: 1, facing: 'east' })).toEqual(['1BHK east, T-junctions']);
    expect(await names('', { starred: true })).toEqual(['1BHK east, T-junctions']);
    const hit = (await vault.search('t-junctions'))[0]!;
    expect(hit.path).toEqual(['Residential', '30×40 plots', 'East facing']);
    const residential = (await vault.listFolder(null)).folders.find(
      (f) => f.name === 'Residential',
    )!;
    expect((await names('', { folder_id: residential.id, kind: 'plan' })).sort()).toEqual([
      '1BHK east, T-junctions',
      'L-hall with duct',
      'Open plan, living + dining',
    ]);
    await vault.trash(residential.id);
    expect(await names('east')).toEqual([]);
  });

  it('upgrades old plans on load and redraws the thumbnail only after a change', async () => {
    const { vault, storage } = setup();
    const file = await vault.createFile({ folderId: null, plan: sampleB });
    // A plan stored in format 1.0.0 (e.g. by an older version) comes back upgraded.
    await storage.write(`docs/${file.id}.json`, JSON.stringify(oldSampleB));
    expect((await vault.loadDocument(file.id)).schema_version).toBe(CURRENT_SCHEMA_VERSION);

    const first = await vault.getThumbnail(file.id);
    expect(first).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="\d+" height="\d+"/);
    expect(first).not.toMatch(/<script|<text|on\w+=/);
    expect((await vault.index()).files[file.id]!.thumbnail_rev).toBe(1);
    expect(await vault.getThumbnail(file.id)).toBe(first);

    const bigger = gridPlan({ cols: 3, rows: 2 });
    const saved = await vault.saveDocument(file.id, bigger);
    expect(saved).toMatchObject({ doc_rev: 2, thumbnail_rev: 1, summary: { bhk: 2 } }); // bedroom + master bedroom
    const second = await vault.getThumbnail(file.id);
    expect(second).not.toBe(first);
    expect((await vault.index()).files[file.id]!.thumbnail_rev).toBe(2);
    expect((await vault.recent()).map((f) => f.id)).toEqual([file.id]);
  });

  it('runs one change at a time, so parallel calls never lose each other', async () => {
    const { vault } = setup();
    const made = await Promise.all(
      Array.from({ length: 20 }, (_, i) => vault.createFolder({ parentId: null, name: `F${i}` })),
    );
    expect(Object.keys((await vault.index()).folders)).toHaveLength(20);
    expect(new Set(made.map((f) => f.order)).size).toBe(20);
  });

  it('reads older and refuses newer vault formats', () => {
    expect(() => migrateVaultIndex({ format: 'plancraft-vault', version: 3 })).toThrow(/newer/);
    expect(() => migrateVaultIndex({ hello: 1 })).toThrow(/not a PlanCraft vault/);
  });
});

describe('Vault: .plancraft packages (A2 M10)', () => {
  it('exports a file and imports it back as a new file, plan unchanged', async () => {
    const { vault } = setup();
    const folder = await vault.createFolder({ parentId: null, name: 'In' });
    const file = await vault.createFile({ folderId: null, plan: sampleB });
    await vault.setStatus(file.id, 'in_review');
    const bytes = await vault.exportPackage(file.id);
    const entries = readZip(bytes);
    expect([...entries.keys()]).toEqual([
      'manifest.json',
      'document.json',
      'thumbnail.svg',
      'versions.json',
    ]);
    expect(JSON.parse(utf8Text(entries.get('manifest.json')!))).toMatchObject({
      format: 'plancraft-package',
      version: 1,
      file: { name: file.name, status: 'in_review' },
      schema_version: CURRENT_SCHEMA_VERSION,
    });
    const copy = await vault.importPackage(bytes, folder.id);
    expect(copy).toMatchObject({ name: file.name, status: 'in_review', folder_id: folder.id });
    expect(copy.id).not.toBe(file.id);
    expect(await vault.loadDocument(copy.id)).toEqual(await vault.loadDocument(file.id));
  });

  it('opens a package re-zipped with compression, and upgrades an old plan inside', async () => {
    const { vault } = setup();
    const file = await vault.createFile({ folderId: null, plan: sampleB });
    const entries = readZip(await vault.exportPackage(file.id));
    entries.set('document.json', utf8(JSON.stringify(oldSampleB)));
    // Build a zip whose entries are deflated, as other zip programs write them.
    const stored = writeZip([...entries].map(([name, data]) => ({ name, data })));
    const deflated = recompress(stored);
    const back = await vault.importPackage(deflated, null);
    expect((await vault.loadDocument(back.id)).schema_version).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('refuses things that are not packages, with a reason', async () => {
    const { vault } = setup();
    await expect(vault.importPackage(utf8('hello'), null)).rejects.toThrow(
      /not a PlanCraft package/,
    );
    const noManifest = writeZip([{ name: 'document.json', data: utf8('{}') }]);
    await expect(vault.importPackage(noManifest, null)).rejects.toThrow(/no manifest.json/);
    const newer = writeZip([
      { name: 'manifest.json', data: utf8('{"format":"plancraft-package","version":9}') },
    ]);
    await expect(vault.importPackage(newer, null)).rejects.toThrow(/newer PlanCraft/);
    const file = await vault.createFile({ folderId: null, plan: sampleB });
    const entries = readZip(await vault.exportPackage(file.id));
    entries.set('document.json', utf8('{"schema_version":"1.1.0"}'));
    const badPlan = writeZip([...entries].map(([name, data]) => ({ name, data })));
    await expect(vault.importPackage(badPlan, null)).rejects.toThrow(/can't be stored/);
  });
});

describe('demo workspace', () => {
  it('seeds folders in six colours and three plans', async () => {
    const { vault } = setup();
    await seedDemoVault(vault);
    const ix = await vault.index();
    expect(Object.values(ix.files)).toHaveLength(3);
    expect(new Set(Object.values(ix.folders).map((f) => f.color)).size).toBe(6);
    expect(Object.values(ix.folders).some((f) => f.archived)).toBe(true);
    expect(
      Object.values(ix.files)
        .map((f) => f.status)
        .sort(),
    ).toEqual(['approved', 'draft', 'in_review']);
  });
});

/** Rewrites a stored zip with every entry deflated (method 8), like a typical zip program. */
function recompress(zip: Uint8Array): Uint8Array {
  const entries = readZip(zip);
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const packed = deflateRawSync(data, { level: 9 });
    const n = Buffer.from(name, 'utf8');
    const crc = readCrc(zip, name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(n.length, 26);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(8, 10);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(packed.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(n.length, 28);
    dir.writeUInt32LE(offset, 42);
    parts.push(local, n, packed);
    central.push(dir, n);
    offset += 30 + n.length + packed.length;
  }
  const size = central.reduce((s, b) => s + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.size, 8);
  end.writeUInt16LE(entries.size, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...parts, ...central, end]));
}

function readCrc(zip: Uint8Array, name: string): number {
  const view = Buffer.from(zip);
  for (let at = 0; at + 46 < view.length; at++)
    if (view.readUInt32LE(at) === 0x02014b50) {
      const len = view.readUInt16LE(at + 28);
      if (view.toString('utf8', at + 46, at + 46 + len) === name) return view.readUInt32LE(at + 16);
    }
  throw new Error(`no ${name}`);
}

describe('Vault: continuous save and versions (P14.4, A2 M12)', () => {
  function timed() {
    const storage = new MemoryStorage();
    let now = Date.parse('2026-11-06T10:00:00Z');
    const vault = new Vault({
      storage,
      ids: sequentialIds('t'),
      clock: { now: () => new Date(now).toISOString() },
      user: { id: 'u' },
    });
    return { storage, vault, wait: (min: number) => (now += min * 60_000) };
  }

  it('refuses a save based on an older revision, so one tab never overwrites another', async () => {
    const { vault } = timed();
    const f = await vault.createFile({ folderId: null, plan: sampleB });
    const tabA = await vault.saveDocument(f.id, sampleB, { baseRev: 1 });
    expect(tabA.doc_rev).toBe(2);
    await expect(vault.saveDocument(f.id, sampleB, { baseRev: 1 })).rejects.toThrow(
      /saved from another tab or window/,
    );
    await expect(vault.saveDocument(f.id, sampleB, { baseRev: 1 })).rejects.toBeInstanceOf(
      VaultConflictError,
    );
  });

  it('makes an unnamed version after every 30 minutes of editing; pauses count 5 minutes', async () => {
    const { vault, wait } = timed();
    const f = await vault.createFile({ folderId: null, plan: sampleB });
    // Saves every 2 minutes: 14 saves = 28 minutes, no version yet; the 15th makes one.
    for (let i = 0; i < 14; i++) {
      wait(2);
      await vault.saveDocument(f.id, sampleB);
    }
    expect(await vault.listVersions(f.id)).toEqual([]);
    expect((await vault.index()).files[f.id]!.active_ms).toBe(28 * 60_000);
    wait(2);
    const saved = await vault.saveDocument(f.id, sampleB);
    expect(saved.active_ms).toBe(0);
    const versions = await vault.listVersions(f.id);
    expect(versions).toMatchObject([{ label: null, rev: 16, branch_id: 'main' }]);
    // A three-hour lunch counts as five minutes of editing.
    wait(180);
    expect((await vault.saveDocument(f.id, sampleB)).active_ms).toBe(5 * 60_000);
  });

  it('keeps named versions with their plan, and deletes them with the file', async () => {
    const { vault, storage } = timed();
    const f = await vault.createFile({ folderId: null, plan: sampleB });
    const v = await vault.createVersion(f.id, 'Client review 1');
    await vault.saveDocument(f.id, gridPlan({ cols: 2, rows: 1 }));
    expect(v).toMatchObject({ label: 'Client review 1', rev: 1, created_by: 'u' });
    expect((await vault.loadVersion(f.id, v.id)).meta.name).toBe(sampleB.meta.name);
    expect((await vault.loadDocument(f.id)).meta.name).toBe('Grid 2 × 1');
    await expect(vault.createVersion(f.id, ' ')).rejects.toThrow(/a name is needed/);
    await vault.trash(f.id);
    await vault.deleteForever(f.id);
    expect([...storage.data.keys()]).toEqual(['index.json']);
  });

  it('upgrades a format-1 vault: files start with no editing time', () => {
    const v1 = {
      format: 'plancraft-vault',
      version: 1,
      workspace: { id: 'w', name: 'W' },
      folders: {},
      files: {
        f1: {
          id: 'f1',
          workspace_id: 'w',
          name: 'Old',
          owner_id: 'u',
          created_at: '2026-11-06T10:00:00.000Z',
          updated_at: '2026-11-06T10:00:00.000Z',
          starred: false,
          archived: false,
          trashed_at: null,
          folder_id: null,
          kind: 'plan',
          status: 'draft',
          last_editor_id: 'u',
          branch_count: 0,
          size_bytes: 10,
          doc_rev: 3,
          thumbnail_rev: 3,
        },
      },
    };
    const ix = migrateVaultIndex(v1);
    expect(ix.version).toBe(2);
    expect(ix.files.f1!.active_ms).toBe(0);
  });
});

describe('Vault: folder summaries for other views (P14.5)', () => {
  it('counts what is inside a folder, also while the folder is in Trash', async () => {
    const { vault } = setup();
    const a = await vault.createFolder({ parentId: null, name: 'A' });
    const sub = await vault.createFolder({ parentId: a.id, name: 'Sub' });
    const f1 = await vault.createFile({ folderId: a.id, plan: sampleB });
    await vault.createFile({ folderId: sub.id, plan: sampleB });
    const loose = await vault.createFile({ folderId: a.id, plan: sampleB });
    await vault.trash(loose.id); // trashed on its own: not counted with the folder
    await vault.trash(a.id);
    const [summary] = await vault.folderSummaries([a.id, 'missing']);
    expect(summary).toMatchObject({ name: 'A', file_count: 2, subfolder_count: 1 });
    expect(summary!.size_bytes).toBe(2 * f1.size_bytes);
    expect((await vault.folderSummaries(['missing'])).length).toBe(0);
  });
});
