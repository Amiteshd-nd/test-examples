import { z } from 'zod';
import { Compass, Id } from '../schema/primitives.ts';
import { OrderKey } from '../schema/plan.ts';

// Vault records (A2 §3, §4.1, §7; P14.2): a workspace holds nested folders, folders hold files
// (plans, later sheet sets). Records are kept in id-keyed maps like the plan (A2 M1). The index
// is one JSON document per workspace; each file's plan, thumbnail and version list are stored
// next to it under their own keys (see `vault.ts`). Times are ISO 8601 UTC strings.

export const VAULT_FORMAT_VERSION = 2;
export const PACKAGE_FORMAT_VERSION = 1;

/** The six folder colours (D-28); graphite is the default. */
export const FolderColor = z.enum(['graphite', 'blue', 'orange', 'green', 'purple', 'red']);
export type FolderColor = z.infer<typeof FolderColor>;
/** Glass folders for projects; colour folders for templates, rule packs and collections. */
export const FolderStyle = z.enum(['glass', 'colour']);
export const FileKind = z.enum(['plan', 'sheet_set']);
export const FileStatus = z.enum(['draft', 'in_review', 'approved']);
export type FileStatus = z.infer<typeof FileStatus>;

const Time = z.iso.datetime();
export const ItemName = z
  .string()
  .trim()
  .min(1, 'a name is needed')
  .max(120, 'at most 120 characters')
  .regex(/^[^\p{Cc}]*$/u, 'no control characters');

const item = {
  id: Id,
  workspace_id: Id,
  name: ItemName,
  owner_id: Id,
  created_at: Time,
  updated_at: Time,
  starred: z.boolean(),
  /** Put away: shown with archive art, left out of "Recent". */
  archived: z.boolean(),
  /** When it was moved to Trash; null when not in Trash. Its contents go with it. */
  trashed_at: Time.nullable(),
};

export const Folder = z.strictObject({
  ...item,
  /** null = top level of the workspace. */
  parent_id: Id.nullable(),
  color: FolderColor,
  style: FolderStyle,
  /** Position among its siblings (fractional index). */
  order: OrderKey,
});
export type Folder = z.infer<typeof Folder>;

/** Facts about a plan for the files table and search filters (from `autoTag`). */
export const FileSummary = z.strictObject({
  plot: z.string(),
  bhk: z.number().int().min(0),
  facing: Compass,
  floors: z.number().int().min(1),
});

export const VaultFile = z.strictObject({
  ...item,
  /** null = top level of the workspace. */
  folder_id: Id.nullable(),
  kind: FileKind,
  status: FileStatus,
  last_editor_id: Id,
  branch_count: z.number().int().min(0),
  /** Size of the stored document, bytes. */
  size_bytes: z.number().int().min(0),
  /** Goes up on every save. */
  doc_rev: z.number().int().min(1),
  /** The `doc_rev` the stored thumbnail shows; behind `doc_rev` means it is redrawn on request. */
  thumbnail_rev: z.number().int().min(0),
  /** Editing time since the last version, ms (A2 M12: a version every 30 min of activity). */
  active_ms: z.number().int().min(0),
  summary: FileSummary.optional(),
});
export type VaultFile = z.infer<typeof VaultFile>;

export const VaultIndex = z.strictObject({
  format: z.literal('plancraft-vault'),
  version: z.literal(VAULT_FORMAT_VERSION),
  workspace: z.strictObject({ id: Id, name: z.string() }),
  folders: z.record(Id, Folder),
  files: z.record(Id, VaultFile),
});
export type VaultIndex = z.infer<typeof VaultIndex>;

/** A named or automatic checkpoint of a file (A2 §6); created from P14.4 (M12). */
export const VersionRecord = z.strictObject({
  id: Id,
  file_id: Id,
  branch_id: Id,
  rev: z.number().int().min(1),
  /** null for automatic versions. */
  label: z.string().nullable(),
  created_by: Id,
  created_at: Time,
});
export type VersionRecord = z.infer<typeof VersionRecord>;

/** `manifest.json` of a `.plancraft` package (A2 M10). */
export const PackageManifest = z.strictObject({
  format: z.literal('plancraft-package'),
  version: z.number().int().min(1),
  generator: z.string(),
  exported_at: Time,
  file: z.strictObject({
    name: ItemName,
    kind: FileKind,
    status: FileStatus,
    created_at: Time,
    updated_at: Time,
  }),
  /** Plan format of `document.json`. */
  schema_version: z.string(),
  entries: z.strictObject({
    document: z.literal('document.json'),
    thumbnail: z.literal('thumbnail.svg'),
    versions: z.literal('versions.json'),
  }),
});
export type PackageManifest = z.infer<typeof PackageManifest>;

/** Upgrades a stored vault index to the current format, or explains why it can't. */
export function migrateVaultIndex(raw: unknown): VaultIndex {
  const head = z
    .object({ format: z.literal('plancraft-vault'), version: z.number() })
    .safeParse(raw);
  if (!head.success) throw new Error('This is not a PlanCraft vault index.');
  if (head.data.version > VAULT_FORMAT_VERSION)
    throw new Error(
      `This vault was written by a newer PlanCraft (format ${head.data.version}); update the app to open it.`,
    );
  // Upgrade steps, oldest first. 1 → 2 (P14.4): files count editing time since their last
  // version (`active_ms`), starting from zero.
  let ix = raw as { version: number; files?: Record<string, Record<string, unknown>> };
  if (ix.version === 1)
    ix = {
      ...ix,
      version: 2,
      files: Object.fromEntries(
        Object.entries(ix.files ?? {}).map(([id, f]) => [id, { ...f, active_ms: 0 }]),
      ),
    };
  const parsed = VaultIndex.safeParse(ix);
  if (!parsed.success)
    throw new Error(`The vault index is damaged: ${parsed.error.issues[0]?.message ?? 'unknown'}.`);
  return parsed.data;
}
