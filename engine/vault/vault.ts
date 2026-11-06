import { ENGINE_VERSION } from '../version.ts';
import type { Clock, IdSource } from '../ids.ts';
import { autoTag } from '../library/tags.ts';
import { planThumbnailSvg } from '../render/thumbnail.ts';
import { orderBetween } from '../schema/collections.ts';
import type { Plan } from '../schema/plan.ts';
import { loadPlan, validatePlan } from '../validate/validate.ts';
import {
  FolderColor,
  ItemName,
  PACKAGE_FORMAT_VERSION,
  PackageManifest,
  VAULT_FORMAT_VERSION,
  VersionRecord,
  migrateVaultIndex,
  type FileStatus,
  type Folder,
  type VaultFile,
  type VaultIndex,
} from './records.ts';
import type { VaultStorage } from './storage.ts';
import { readZip, utf8, utf8Text, writeZip } from './zip.ts';

// The Vault's behaviour (P14.2): folders and files in a workspace, kept in a `VaultStorage`
// the host supplies. Pure apart from that storage: ids and time come from `IdSource` and
// `Clock` (A2 M2), the user from the host. Every operation reads the index, changes it and
// writes it back, one operation at a time. Trash keeps things for `purgeTrash` (30 days); only
// things in Trash can be deleted for ever. Thumbnails are redrawn when asked for after the plan
// changed, so repeated saves cost nothing extra ("debounced" without timers).

export interface VaultOptions {
  storage: VaultStorage;
  ids: IdSource;
  clock: Clock;
  /** Who is acting (owner of new items, last editor of saved files). */
  user: { id: string };
  /** Used when the storage holds no vault yet. */
  workspace?: { id: string; name: string };
}

export interface FolderSummary extends Folder {
  /** Files inside, at any depth (not in Trash). */
  file_count: number;
  /** Folders directly inside (not in Trash). */
  subfolder_count: number;
  /** Total size of the files inside, bytes. */
  size_bytes: number;
  /** Up to three files inside, most recently edited first (for the folder papers). */
  preview_file_ids: string[];
}

export interface FolderListing {
  /** null for the top level of the workspace. */
  folder: Folder | null;
  /** From the top level down to `folder` (the breadcrumb). */
  path: Folder[];
  folders: FolderSummary[];
  files: VaultFile[];
}

export interface TreeNode {
  folder: Folder;
  file_count: number;
  children: TreeNode[];
}

export type VaultItem = { type: 'folder'; folder: Folder } | { type: 'file'; file: VaultFile };

export interface SearchFilters {
  kind?: VaultFile['kind'];
  status?: FileStatus;
  owner_id?: string;
  bhk?: number;
  facing?: NonNullable<VaultFile['summary']>['facing'];
  starred?: boolean;
  /** Only inside this folder (at any depth). */
  folder_id?: string;
}

export interface SearchHit {
  item: VaultItem;
  /** Names of the folders above it, top first. */
  path: string[];
}

const DOC = (id: string) => `docs/${id}.json`;
const THUMB = (id: string) => `thumbs/${id}.svg`;
const VERSIONS = (id: string) => `versions/${id}.json`;
const SNAPSHOT = (id: string, versionId: string) => `versions/${id}/${versionId}.json`;
const DAY_MS = 86_400_000;
/** A2 M12: an unnamed version after every 30 minutes of editing. */
export const AUTO_VERSION_MS = 30 * 60_000;
/** A pause between saves counts as editing for at most 5 minutes. */
export const IDLE_CAP_MS = 5 * 60_000;

export class VaultError extends Error {}
/** The file was saved from somewhere else after this copy was opened (another tab or window). */
export class VaultConflictError extends VaultError {}

const byEdited = (a: VaultFile, b: VaultFile) =>
  a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : a.id < b.id ? -1 : 1;
const byName = <T extends { name: string; id: string }>(a: T, b: T) =>
  a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }) ||
  (a.id < b.id ? -1 : 1);
const words = (s: string) => s.toLocaleLowerCase('en').split(/\s+/).filter(Boolean);

function name(input: string): string {
  const parsed = ItemName.safeParse(input);
  if (!parsed.success)
    throw new VaultError(`That name won't do: ${parsed.error.issues[0]!.message}.`);
  return parsed.data;
}

function summarise(plan: Plan): VaultFile['summary'] {
  try {
    const t = autoTag(plan);
    return {
      plot: t.plot_size_ft,
      bhk: t.bhk.value,
      facing: t.facing.value,
      floors: t.floors.value,
    };
  } catch {
    return undefined;
  }
}

export class Vault {
  private readonly o: VaultOptions;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(options: VaultOptions) {
    this.o = options;
  }

  // ---- reading -------------------------------------------------------------------------

  /** A copy of the whole index (workspace, folders, files). */
  index(): Promise<VaultIndex> {
    return this.exclusive(() => this.readIndex());
  }

  listFolder(folderId: string | null): Promise<FolderListing> {
    return this.exclusive(async () => {
      const ix = await this.readIndex();
      const folder = folderId === null ? null : this.liveFolder(ix, folderId);
      const path: Folder[] = [];
      for (let f = folder; f; f = f.parent_id ? ix.folders[f.parent_id]! : null) path.unshift(f);
      const live = (x: { trashed_at: string | null }) => x.trashed_at === null;
      const folders = Object.values(ix.folders)
        .filter((f) => f.parent_id === folderId && live(f))
        .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : byName(a, b)))
        .map((f) => this.summary(ix, f));
      const files = Object.values(ix.files)
        .filter((f) => f.folder_id === folderId && live(f))
        .sort(byEdited);
      return { folder, path, folders, files };
    });
  }

  /** The folder tree for the sidebar, with file counts (Trash left out). */
  tree(): Promise<TreeNode[]> {
    return this.exclusive(async () => {
      const ix = await this.readIndex();
      const build = (parent: string | null): TreeNode[] =>
        Object.values(ix.folders)
          .filter((f) => f.parent_id === parent && f.trashed_at === null)
          .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : byName(a, b)))
          .map((folder) => ({
            folder,
            file_count: this.filesUnder(ix, folder.id).length,
            children: build(folder.id),
          }));
      return build(null);
    });
  }

  /** Recently edited files, newest first (Trash and archived files left out). */
  recent(limit = 20): Promise<VaultFile[]> {
    return this.exclusive(async () => {
      const ix = await this.readIndex();
      return Object.values(ix.files)
        .filter((f) => !f.archived && !this.inTrash(ix, f))
        .sort(byEdited)
        .slice(0, limit);
    });
  }

  /**
   * Summaries (file and folder counts, size, papers) of these folders, for tiles in views
   * other than the folder's own parent (Starred, Search, Trash). A folder in Trash still
   * counts what went to Trash with it.
   */
  folderSummaries(ids: readonly string[]): Promise<FolderSummary[]> {
    return this.exclusive(async () => {
      const ix = await this.readIndex();
      return ids.flatMap((id) => (ix.folders[id] ? [this.summary(ix, ix.folders[id], true)] : []));
    });
  }

  /** Things put in Trash (each with its contents), most recent first. */
  listTrash(): Promise<VaultItem[]> {
    return this.exclusive(async () => {
      const ix = await this.readIndex();
      const items: VaultItem[] = [
        ...Object.values(ix.folders)
          .filter((f) => f.trashed_at !== null)
          .map((folder) => ({ type: 'folder' as const, folder })),
        ...Object.values(ix.files)
          .filter((f) => f.trashed_at !== null)
          .map((file) => ({ type: 'file' as const, file })),
      ];
      const at = (i: VaultItem) => (i.type === 'folder' ? i.folder : i.file).trashed_at!;
      return items.sort((a, b) => (at(a) < at(b) ? 1 : at(a) > at(b) ? -1 : 0));
    });
  }

  /**
   * Files and folders whose names contain every word of `query` (any order, any case), with
   * filters; Trash is left out. Most recently changed first.
   */
  search(query: string, filters: SearchFilters = {}): Promise<SearchHit[]> {
    return this.exclusive(async () => {
      const ix = await this.readIndex();
      const want = words(query);
      const matches = (n: string) => {
        const have = n.toLocaleLowerCase('en');
        return want.every((w) => have.includes(w));
      };
      const within = (folderId: string | null) =>
        filters.folder_id === undefined || this.ancestry(ix, folderId).includes(filters.folder_id);
      const fileFilter = Object.keys(filters).some((k) => k !== 'folder_id' && k !== 'starred');
      const hits: (SearchHit & { at: string })[] = [];
      if (!fileFilter)
        for (const f of Object.values(ix.folders))
          if (
            !this.inTrash(ix, f) &&
            matches(f.name) &&
            within(f.parent_id) &&
            (filters.starred === undefined || f.starred === filters.starred)
          )
            hits.push({
              item: { type: 'folder', folder: f },
              path: this.pathNames(ix, f.parent_id),
              at: f.updated_at,
            });
      for (const f of Object.values(ix.files)) {
        if (this.inTrash(ix, f) || !matches(f.name) || !within(f.folder_id)) continue;
        if (filters.kind && f.kind !== filters.kind) continue;
        if (filters.status && f.status !== filters.status) continue;
        if (filters.owner_id && f.owner_id !== filters.owner_id) continue;
        if (filters.starred !== undefined && f.starred !== filters.starred) continue;
        if (filters.bhk !== undefined && f.summary?.bhk !== filters.bhk) continue;
        if (filters.facing && f.summary?.facing !== filters.facing) continue;
        hits.push({
          item: { type: 'file', file: f },
          path: this.pathNames(ix, f.folder_id),
          at: f.updated_at,
        });
      }
      return hits
        .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
        .map(({ item, path }) => ({ item, path }));
    });
  }

  /** The plan stored in a file, upgraded to the current format if it is older. */
  loadDocument(fileId: string): Promise<Plan> {
    return this.exclusive(async () => {
      const ix = await this.readIndex();
      this.file(ix, fileId);
      return this.readDoc(fileId);
    });
  }

  /** The file's thumbnail (SVG), redrawn first if the plan changed since it was drawn. */
  getThumbnail(fileId: string): Promise<string> {
    return this.exclusive(async () => {
      const ix = await this.readIndex();
      const f = this.file(ix, fileId);
      if (f.thumbnail_rev === f.doc_rev) {
        const stored = await this.o.storage.read(THUMB(fileId));
        if (stored !== null) return stored;
      }
      const plan = await this.readDoc(fileId);
      const svg = planThumbnailSvg(plan, validatePlan(plan).rooms);
      await this.o.storage.write(THUMB(fileId), svg);
      f.thumbnail_rev = f.doc_rev;
      await this.writeIndex(ix);
      return svg;
    });
  }

  /** A version's plan, as it was saved (read-only; restoring comes with version history, P15.1). */
  loadVersion(fileId: string, versionId: string): Promise<Plan> {
    return this.exclusive(async () => {
      this.file(await this.readIndex(), fileId);
      if (!(await this.readVersions(fileId)).some((v) => v.id === versionId))
        throw new VaultError('That version no longer exists.');
      const text = await this.o.storage.read(SNAPSHOT(fileId, versionId));
      if (text === null) throw new VaultError('The plan of that version is missing.');
      const loaded = loadPlan(JSON.parse(text));
      if (!loaded.ok) throw new VaultError('The plan of that version is damaged.');
      return loaded.plan;
    });
  }

  /** Makes a named version of the file as it is now (a checkpoint, A2 §6). */
  createVersion(fileId: string, label: string): Promise<VersionRecord> {
    return this.exclusive(async () => {
      const ix = await this.readIndex();
      const f = this.file(ix, fileId);
      if (this.inTrash(ix, f)) throw new VaultError(`“${f.name}” is in Trash; restore it first.`);
      const text = await this.o.storage.read(DOC(fileId));
      if (text === null) throw new VaultError('The plan of this file is missing.');
      const v = await this.addVersion(f, text, name(label), this.o.clock.now());
      f.active_ms = 0;
      await this.writeIndex(ix);
      return v;
    });
  }

  /** Versions of a file, oldest first (created from P14.4). */
  listVersions(fileId: string): Promise<VersionRecord[]> {
    return this.exclusive(async () => {
      this.file(await this.readIndex(), fileId);
      return this.readVersions(fileId);
    });
  }

  // ---- creating and saving --------------------------------------------------------------

  createFolder(input: {
    parentId: string | null;
    name: string;
    color?: FolderColor;
    style?: Folder['style'];
  }): Promise<Folder> {
    return this.exclusive(async () => {
      const ix = await this.readIndex();
      if (input.parentId !== null) this.liveFolder(ix, input.parentId);
      const now = this.o.clock.now();
      const folder: Folder = {
        id: this.o.ids.next(),
        workspace_id: ix.workspace.id,
        name: name(input.name),
        owner_id: this.o.user.id,
        created_at: now,
        updated_at: now,
        starred: false,
        archived: false,
        trashed_at: null,
        parent_id: input.parentId,
        color: FolderColor.parse(input.color ?? 'graphite'),
        style: input.style ?? 'glass',
        order: this.nextOrder(ix, input.parentId),
      };
      ix.folders[folder.id] = folder;
      this.touch(ix, input.parentId, now);
      await this.writeIndex(ix);
      return folder;
    });
  }

  /** A new file holding `plan` (a new plan, an imported DXF, a library plan). */
  createFile(input: {
    folderId: string | null;
    name?: string;
    plan: unknown;
    kind?: VaultFile['kind'];
    status?: FileStatus;
  }): Promise<VaultFile> {
    return this.exclusive(async () => {
      const ix = await this.readIndex();
      if (input.folderId !== null) this.liveFolder(ix, input.folderId);
      const plan = this.checkPlan(input.plan);
      const now = this.o.clock.now();
      const text = JSON.stringify(plan);
      const summary = summarise(plan);
      const file: VaultFile = {
        id: this.o.ids.next(),
        workspace_id: ix.workspace.id,
        name: name(input.name ?? (plan.meta.name.trim() || 'Untitled plan')),
        owner_id: this.o.user.id,
        created_at: now,
        updated_at: now,
        starred: false,
        archived: false,
        trashed_at: null,
        folder_id: input.folderId,
        kind: input.kind ?? 'plan',
        status: input.status ?? 'draft',
        last_editor_id: this.o.user.id,
        branch_count: 0,
        size_bytes: utf8(text).length,
        doc_rev: 1,
        thumbnail_rev: 0,
        active_ms: 0,
        ...(summary ? { summary } : {}),
      };
      await this.o.storage.write(DOC(file.id), text);
      ix.files[file.id] = file;
      this.touch(ix, input.folderId, now);
      await this.writeIndex(ix);
      return file;
    });
  }

  /**
   * Saves a new state of a file's plan (checked against the plan format first). With `baseRev`,
   * the save is refused if the file has been saved since that revision (`VaultConflictError`).
   * Editing time adds up between saves (a pause counts for at most `IDLE_CAP_MS`); after
   * `AUTO_VERSION_MS` of it, the save also becomes an unnamed version (A2 M12).
   */
  saveDocument(
    fileId: string,
    plan: unknown,
    options: { baseRev?: number } = {},
  ): Promise<VaultFile> {
    return this.exclusive(async () => {
      const ix = await this.readIndex();
      const f = this.file(ix, fileId);
      if (this.inTrash(ix, f))
        throw new VaultError(`“${f.name}” is in Trash; restore it to edit it.`);
      if (options.baseRev !== undefined && options.baseRev !== f.doc_rev)
        throw new VaultConflictError(
          `“${f.name}” was saved from another tab or window after this copy was opened.`,
        );
      const checked = this.checkPlan(plan);
      const text = JSON.stringify(checked);
      await this.o.storage.write(DOC(fileId), text);
      const summary = summarise(checked);
      const now = this.o.clock.now();
      const gap = Math.max(0, Date.parse(now) - Date.parse(f.updated_at));
      Object.assign(f, {
        updated_at: now,
        last_editor_id: this.o.user.id,
        size_bytes: utf8(text).length,
        doc_rev: f.doc_rev + 1,
        active_ms: f.active_ms + Math.min(gap, IDLE_CAP_MS),
      });
      if (f.active_ms >= AUTO_VERSION_MS) {
        await this.addVersion(f, text, null, now);
        f.active_ms = 0;
      }
      if (summary) f.summary = summary;
      else delete f.summary;
      this.touch(ix, f.folder_id, now);
      await this.writeIndex(ix);
      return { ...f };
    });
  }

  // ---- organising -----------------------------------------------------------------------

  rename(id: string, newName: string): Promise<void> {
    return this.edit(id, (item) => {
      item.name = name(newName);
    });
  }

  setStar(id: string, starred: boolean): Promise<void> {
    return this.edit(
      id,
      (item) => {
        item.starred = starred;
      },
      false,
    );
  }

  setColor(folderId: string, color: FolderColor): Promise<void> {
    return this.edit(folderId, (item, ix) => {
      if (!ix.folders[folderId]) throw new VaultError('Only folders have a colour.');
      (item as Folder).color = FolderColor.parse(color);
    });
  }

  setStatus(fileId: string, status: FileStatus): Promise<void> {
    return this.edit(fileId, (item, ix) => {
      if (!ix.files[fileId]) throw new VaultError('Only files have a status.');
      (item as VaultFile).status = status;
    });
  }

  archive(id: string, archived = true): Promise<void> {
    return this.edit(id, (item) => {
      item.archived = archived;
    });
  }

  /** Moves a file or folder into another folder (null = top level). */
  move(id: string, folderId: string | null): Promise<void> {
    return this.exclusive(async () => {
      const ix = await this.readIndex();
      const item = this.item(ix, id);
      if (this.inTrash(ix, item))
        throw new VaultError(`“${item.name}” is in Trash; restore it first.`);
      if (folderId !== null) {
        this.liveFolder(ix, folderId);
        if (ix.folders[id] && this.ancestry(ix, folderId).includes(id))
          throw new VaultError(`A folder can't go inside itself.`);
      }
      const now = this.o.clock.now();
      const from = ix.folders[id] ? ix.folders[id].parent_id : ix.files[id]!.folder_id;
      if (ix.folders[id])
        Object.assign(ix.folders[id], { parent_id: folderId, order: this.nextOrder(ix, folderId) });
      else ix.files[id]!.folder_id = folderId;
      // Moving is not editing: the item keeps its edit time; the folders it left and entered change.
      this.touch(ix, from, now);
      this.touch(ix, folderId, now);
      await this.writeIndex(ix);
    });
  }

  /** A copy beside the original (a folder is copied with everything in it). Returns its id. */
  duplicate(id: string): Promise<string> {
    return this.exclusive(async () => {
      const ix = await this.readIndex();
      const item = this.item(ix, id);
      if (this.inTrash(ix, item))
        throw new VaultError(`“${item.name}” is in Trash; restore it first.`);
      const now = this.o.clock.now();
      const fresh = {
        owner_id: this.o.user.id,
        created_at: now,
        updated_at: now,
        starred: false,
        trashed_at: null,
      };
      const copyFile = async (f: VaultFile, folderId: string | null, newName = f.name) => {
        const copy: VaultFile = {
          ...f,
          ...fresh,
          id: this.o.ids.next(),
          name: name(newName),
          folder_id: folderId,
          status: 'draft',
          last_editor_id: this.o.user.id,
          branch_count: 0,
          doc_rev: 1,
          thumbnail_rev: 0,
          active_ms: 0,
        };
        const text = await this.o.storage.read(DOC(f.id));
        if (text === null) throw new VaultError(`The plan of “${f.name}” is missing.`);
        await this.o.storage.write(DOC(copy.id), text);
        ix.files[copy.id] = copy;
        return copy.id;
      };
      const copyFolder = async (f: Folder, parentId: string | null, newName = f.name) => {
        const copy: Folder = {
          ...f,
          ...fresh,
          id: this.o.ids.next(),
          name: name(newName),
          parent_id: parentId,
          order: this.nextOrder(ix, parentId),
        };
        ix.folders[copy.id] = copy;
        for (const child of Object.values(ix.folders).filter(
          (c) => c.parent_id === f.id && c.trashed_at === null,
        ))
          await copyFolder(child, copy.id);
        for (const file of Object.values(ix.files).filter(
          (c) => c.folder_id === f.id && c.trashed_at === null,
        ))
          await copyFile(file, copy.id);
        return copy.id;
      };
      const copyName = `${item.name} (copy)`.slice(0, 120);
      const newId = ix.folders[id]
        ? await copyFolder(ix.folders[id], ix.folders[id].parent_id, copyName)
        : await copyFile(ix.files[id]!, ix.files[id]!.folder_id, copyName);
      this.touch(ix, ix.folders[id] ? ix.folders[id].parent_id : ix.files[id]!.folder_id, now);
      await this.writeIndex(ix);
      return newId;
    });
  }

  // ---- Trash ----------------------------------------------------------------------------

  /** Moves a file or folder (with its contents) to Trash. */
  trash(id: string): Promise<void> {
    return this.exclusive(async () => {
      const ix = await this.readIndex();
      const item = this.item(ix, id);
      if (this.inTrash(ix, item)) return;
      item.trashed_at = this.o.clock.now();
      await this.writeIndex(ix);
    });
  }

  /**
   * Takes a file or folder out of Trash. If the folder it was in is gone or still in Trash, it
   * comes back at the top level. Returns the folder it is now in.
   */
  restore(id: string): Promise<string | null> {
    return this.exclusive(async () => {
      const ix = await this.readIndex();
      const item = this.item(ix, id);
      if (item.trashed_at === null) throw new VaultError(`“${item.name}” is not in Trash.`);
      item.trashed_at = null;
      let parent = ix.folders[id] ? ix.folders[id].parent_id : ix.files[id]!.folder_id;
      const home = parent === null ? undefined : ix.folders[parent];
      if (parent !== null && (!home || this.inTrash(ix, home))) {
        parent = null;
        if (ix.folders[id])
          Object.assign(ix.folders[id], { parent_id: null, order: this.nextOrder(ix, null) });
        else ix.files[id]!.folder_id = null;
      }
      this.touch(ix, parent, this.o.clock.now());
      await this.writeIndex(ix);
      return parent;
    });
  }

  /** Deletes something in Trash for ever, with everything inside it. */
  deleteForever(id: string): Promise<void> {
    return this.exclusive(async () => {
      const ix = await this.readIndex();
      const item = this.item(ix, id);
      if (!this.inTrash(ix, item))
        throw new VaultError(`“${item.name}” must be in Trash before it can be deleted for ever.`);
      await this.erase(ix, id);
      await this.writeIndex(ix);
    });
  }

  /** Deletes for ever what has been in Trash for more than `days` days. Returns how many. */
  purgeTrash(days = 30): Promise<number> {
    return this.exclusive(async () => {
      const ix = await this.readIndex();
      const cutoff = Date.parse(this.o.clock.now()) - days * DAY_MS;
      const old = [...Object.values(ix.folders), ...Object.values(ix.files)].filter(
        (x) => x.trashed_at !== null && Date.parse(x.trashed_at) <= cutoff,
      );
      let n = 0;
      for (const x of old) if (ix.folders[x.id] || ix.files[x.id]) n += await this.erase(ix, x.id);
      await this.writeIndex(ix);
      return n;
    });
  }

  // ---- packages (A2 M10) ------------------------------------------------------------------

  /** The file as a `.plancraft` package: manifest, plan, thumbnail and version list. */
  exportPackage(fileId: string): Promise<Uint8Array> {
    return this.exclusive(async () => {
      const ix = await this.readIndex();
      const f = this.file(ix, fileId);
      const plan = await this.readDoc(fileId);
      const now = this.o.clock.now();
      const manifest: PackageManifest = {
        format: 'plancraft-package',
        version: PACKAGE_FORMAT_VERSION,
        generator: `PlanCraft engine ${ENGINE_VERSION}`,
        exported_at: now,
        file: {
          name: f.name,
          kind: f.kind,
          status: f.status,
          created_at: f.created_at,
          updated_at: f.updated_at,
        },
        schema_version: plan.schema_version,
        entries: {
          document: 'document.json',
          thumbnail: 'thumbnail.svg',
          versions: 'versions.json',
        },
      };
      const json = (v: unknown) => utf8(JSON.stringify(v, null, 2) + '\n');
      return writeZip(
        [
          { name: 'manifest.json', data: json(manifest) },
          { name: 'document.json', data: json(plan) },
          { name: 'thumbnail.svg', data: utf8(planThumbnailSvg(plan, validatePlan(plan).rooms)) },
          { name: 'versions.json', data: json(await this.readVersions(fileId)) },
        ],
        now,
      );
    });
  }

  /**
   * Adds the file in a `.plancraft` package to a folder, as a new file. The plan is upgraded and
   * checked; the thumbnail is redrawn rather than trusted. Version history starts afresh (it
   * comes across once versions and branches exist, Phase 15).
   */
  async importPackage(bytes: Uint8Array, folderId: string | null): Promise<VaultFile> {
    let entries: Map<string, Uint8Array>;
    try {
      entries = readZip(bytes, { maxEntries: 200, maxBytes: 64 * 1024 * 1024 });
    } catch (e) {
      throw new VaultError(`This is not a PlanCraft package. ${(e as Error).message}`);
    }
    const json = (entry: string): unknown => {
      const data = entries.get(entry);
      if (!data) throw new VaultError(`The package has no ${entry}.`);
      try {
        return JSON.parse(utf8Text(data));
      } catch {
        throw new VaultError(`The package's ${entry} is damaged.`);
      }
    };
    const head = json('manifest.json') as { format?: unknown; version?: unknown };
    if (head?.format !== 'plancraft-package')
      throw new VaultError('This is not a PlanCraft package.');
    if (typeof head.version === 'number' && head.version > PACKAGE_FORMAT_VERSION)
      throw new VaultError(
        'This package was made by a newer PlanCraft; update the app to open it.',
      );
    const manifest = PackageManifest.safeParse(head);
    if (!manifest.success)
      throw new VaultError(
        `The package's manifest is damaged: ${manifest.error.issues[0]!.message}.`,
      );
    const m = manifest.data.file;
    return this.createFile({
      folderId,
      name: m.name,
      plan: json('document.json'),
      kind: m.kind,
      status: m.status,
    });
  }

  // ---- internals --------------------------------------------------------------------------

  /** Runs operations one after another, so two changes never overwrite each other. */
  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async readIndex(): Promise<VaultIndex> {
    const text = await this.o.storage.read('index.json');
    if (text === null)
      return {
        format: 'plancraft-vault',
        version: VAULT_FORMAT_VERSION,
        workspace: this.o.workspace ?? { id: 'local', name: 'My workspace' },
        folders: {},
        files: {},
      };
    return migrateVaultIndex(JSON.parse(text));
  }

  private writeIndex(ix: VaultIndex) {
    return this.o.storage.write('index.json', JSON.stringify(ix, null, 2) + '\n');
  }

  private async readDoc(fileId: string): Promise<Plan> {
    const text = await this.o.storage.read(DOC(fileId));
    if (text === null) throw new VaultError('The plan of this file is missing.');
    const loaded = loadPlan(JSON.parse(text));
    if (!loaded.ok)
      throw new VaultError(`The stored plan is damaged: ${loaded.issues[0]?.message ?? ''}`);
    return loaded.plan;
  }

  /** Stores a copy of the plan as a version of the file at its current revision. */
  private async addVersion(
    f: VaultFile,
    text: string,
    label: string | null,
    now: string,
  ): Promise<VersionRecord> {
    const list = await this.readVersions(f.id);
    const v: VersionRecord = {
      id: this.o.ids.next(),
      file_id: f.id,
      branch_id: 'main',
      rev: f.doc_rev,
      label,
      created_by: this.o.user.id,
      created_at: now,
    };
    await this.o.storage.write(SNAPSHOT(f.id, v.id), text);
    await this.o.storage.write(VERSIONS(f.id), JSON.stringify([...list, v], null, 2) + '\n');
    return v;
  }

  private async readVersions(fileId: string): Promise<VersionRecord[]> {
    const text = await this.o.storage.read(VERSIONS(fileId));
    return text === null ? [] : VersionRecord.array().parse(JSON.parse(text));
  }

  private checkPlan(plan: unknown): Plan {
    const loaded = loadPlan(plan);
    if (!loaded.ok)
      throw new VaultError(
        `This plan can't be stored: ${loaded.issues
          .map((i) => i.message)
          .slice(0, 3)
          .join(' ')}`,
      );
    return loaded.plan;
  }

  private item(ix: VaultIndex, id: string): Folder | VaultFile {
    const item = ix.folders[id] ?? ix.files[id];
    if (!item) throw new VaultError('That file or folder no longer exists.');
    return item;
  }

  private file(ix: VaultIndex, id: string): VaultFile {
    const f = ix.files[id];
    if (!f) throw new VaultError('That file no longer exists.');
    return f;
  }

  private liveFolder(ix: VaultIndex, id: string): Folder {
    const f = ix.folders[id];
    if (!f) throw new VaultError('That folder no longer exists.');
    if (this.inTrash(ix, f)) throw new VaultError(`The folder “${f.name}” is in Trash.`);
    return f;
  }

  /** Folder ids from `folderId` up to the top (nearest first). */
  private ancestry(ix: VaultIndex, folderId: string | null): string[] {
    const out: string[] = [];
    for (let id = folderId; id !== null && !out.includes(id);) {
      const f = ix.folders[id];
      if (!f) break;
      out.push(id);
      id = f.parent_id;
    }
    return out;
  }

  private pathNames(ix: VaultIndex, folderId: string | null): string[] {
    return this.ancestry(ix, folderId)
      .reverse()
      .map((id) => ix.folders[id]!.name);
  }

  /** In Trash itself, or inside a folder that is. */
  private inTrash(ix: VaultIndex, item: Folder | VaultFile): boolean {
    if (item.trashed_at !== null) return true;
    const parent = 'parent_id' in item ? item.parent_id : item.folder_id;
    return this.ancestry(ix, parent).some((id) => ix.folders[id]!.trashed_at !== null);
  }

  /** Files inside a folder at any depth; `withTrashedRoot` counts them even if the folder is in Trash. */
  private filesUnder(ix: VaultIndex, folderId: string, withTrashedRoot = false): VaultFile[] {
    return Object.values(ix.files).filter(
      (f) =>
        f.trashed_at === null &&
        f.folder_id !== null &&
        this.liveAncestry(ix, f.folder_id, folderId, withTrashedRoot),
    );
  }

  /** Whether `folderId` is `target` or inside it, with nothing in Trash on the way. */
  private liveAncestry(
    ix: VaultIndex,
    folderId: string,
    target: string,
    withTrashedRoot = false,
  ): boolean {
    for (let id: string | null = folderId; id !== null; id = ix.folders[id]?.parent_id ?? null) {
      const f = ix.folders[id];
      if (!f || (f.trashed_at !== null && !(withTrashedRoot && id === target))) return false;
      if (id === target) return true;
    }
    return false;
  }

  private summary(ix: VaultIndex, folder: Folder, withTrashedRoot = false): FolderSummary {
    const files = this.filesUnder(ix, folder.id, withTrashedRoot).sort(byEdited);
    return {
      ...folder,
      file_count: files.length,
      subfolder_count: Object.values(ix.folders).filter(
        (f) => f.parent_id === folder.id && f.trashed_at === null,
      ).length,
      size_bytes: files.reduce((s, f) => s + f.size_bytes, 0),
      preview_file_ids: files.slice(0, 3).map((f) => f.id),
    };
  }

  private nextOrder(ix: VaultIndex, parentId: string | null): string {
    const last = Object.values(ix.folders)
      .filter((f) => f.parent_id === parentId)
      .map((f) => f.order)
      .sort()
      .at(-1);
    return orderBetween(last ?? null, null);
  }

  /** Marks a folder (and its parents) as changed, for "Updated 2h" on folder tiles. */
  private touch(ix: VaultIndex, folderId: string | null, now: string) {
    for (const id of this.ancestry(ix, folderId)) ix.folders[id]!.updated_at = now;
  }

  private edit(
    id: string,
    change: (item: Folder | VaultFile, ix: VaultIndex) => void,
    touches = true,
  ): Promise<void> {
    return this.exclusive(async () => {
      const ix = await this.readIndex();
      const item = this.item(ix, id);
      if (this.inTrash(ix, item))
        throw new VaultError(`“${item.name}” is in Trash; restore it first.`);
      change(item, ix);
      if (touches) item.updated_at = this.o.clock.now();
      await this.writeIndex(ix);
    });
  }

  /** Removes an item and everything inside it, with its stored plan, thumbnail and versions. */
  private async erase(ix: VaultIndex, id: string): Promise<number> {
    let n = 0;
    if (ix.files[id]) {
      delete ix.files[id];
      for (const v of await this.readVersions(id)) await this.o.storage.remove(SNAPSHOT(id, v.id));
      await this.o.storage.remove(DOC(id));
      await this.o.storage.remove(THUMB(id));
      await this.o.storage.remove(VERSIONS(id));
      return 1;
    }
    for (const f of Object.values(ix.files).filter((x) => x.folder_id === id))
      n += await this.erase(ix, f.id);
    for (const f of Object.values(ix.folders).filter((x) => x.parent_id === id))
      n += await this.erase(ix, f.id);
    delete ix.folders[id];
    return n + 1;
  }
}
