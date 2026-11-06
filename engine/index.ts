// The engine's only public door (PRD §0.4 rule 2). Hosts import from here and nowhere else.

export { ENGINE_VERSION } from './version.ts';

// Plan format (P1.1)
export { CURRENT_SCHEMA_VERSION } from './schema/version.ts';
export {
  MAX_COORD_CM,
  Point,
  Polygon,
  Id,
  Compass,
  ProvenanceKind,
  ProvenanceTag,
  ProvenanceMap,
  isOnMmGrid,
  roundCm,
  roundM2,
} from './schema/primitives.ts';
export { ROOM_TYPES, RoomType, roomTypeLabel, type RoomTypeId } from './schema/room-types.ts';
export {
  Plan,
  PlanMeta,
  Plot,
  Setbacks,
  Level,
  Wall,
  WallType,
  Room,
  RoomBehavior,
  SizeRange,
  Opening,
  DoorSwing,
  Stair,
  Column,
  Chajja,
  Loft,
  Fixture,
  Separator,
  OrderKey,
  Line,
  Dimension,
  TextNote,
  Hatch,
  HatchPattern,
} from './schema/plan.ts';
export { values, toMap, levelsInOrder, firstLevel, orderBetween } from './schema/collections.ts';
export { Rule, Issue, Severity, IssueCategory, RuleUnit } from './schema/rule.ts';
export { Brief, BriefRoom, Adjacency } from './schema/brief.ts';
export { jsonSchemas } from './schema/json-schema.ts';
export { migrate, MIGRATIONS, type Migration, type MigrateResult } from './schema/migrate.ts';

// Checks and derived geometry (P1.1)
export {
  loadPlan,
  validatePlan,
  type LoadResult,
  type ValidationResult,
} from './validate/validate.ts';
export { VALIDATOR_RULES, type ValidatorRuleId } from './validate/issues.ts';
export { deriveRooms, type DerivedRoom, type DeriveResult } from './rooms/derive.ts';
export { wallOutlinesCm } from './geometry/wall-outlines.ts';

// DXF import and previews (P1.2)
export {
  importDxf,
  type ImportOptions,
  type ImportResult,
  type ConversionReport,
  type ReportItem,
  type ReportOutcome,
  type UnitName,
} from './dxf/import.ts';
export { ImportMapping, DEFAULT_IMPORT_MAPPING } from './dxf/mapping.ts';
export { reportToMarkdown } from './dxf/report.ts';
export { renderPlanSvg, type SvgOptions } from './render/svg.ts';
export { oneBhkDxf, type FixtureOptions } from './dxf/test-fixtures.ts';

// DXF export (P1.3)
export {
  exportDxf,
  ExportLayers,
  DEFAULT_EXPORT_LAYERS,
  type ExportOptions,
  type ExportResult,
  type ExportCheck,
  type LayerStyle,
  type LayerKind,
} from './dxf/export.ts';
export { setbackSides, type Side } from './schema/sides.ts';

// Plan Library (P1.4)
export { autoTag, PlanTags, Zone } from './library/tags.ts';
export {
  addToLibrary,
  applyTagReview,
  libraryId,
  LibraryEntry,
  LibraryIndex,
  MemoryStore,
  parseCsv,
  tagReviewCsv,
  type AddToLibrary,
  type DocumentStore,
  type ReviewResult,
} from './library/library.ts';

// Drawing, picking and snapping for host canvases (P2.3, A2 M6)
export {
  planDrawing,
  type PlanDrawing,
  type DimensionSymbol,
  type TextSymbol,
  type OpeningSymbol,
  type StairSymbol,
  type RoomShape,
  type Arc,
} from './view/drawing.ts';
export {
  buildPlanIndex,
  hitTest,
  hitTestAll,
  snapPoint,
  type PlanIndex,
  type Pick,
  type PickKind,
  type Snap,
  type SnapKind,
  type SnapOptions,
} from './view/pick.ts';
export type { Box } from './spatial/rtree.ts';
export { gridPlan, type GridPlanOptions } from './samples/grid-plan.ts';

// Host-supplied ids and time (PRD §3.4, A2 M2)
export { formatUlid, sequentialIds, steppingClock, type Clock, type IdSource } from './ids.ts';

// The Vault: folders, files, Trash, search, thumbnails, `.plancraft` packages (P14.2, A2 M10)
export {
  AUTO_VERSION_MS,
  IDLE_CAP_MS,
  Vault,
  VaultConflictError,
  VaultError,
  type FolderListing,
  type FolderSummary,
  type SearchFilters,
  type SearchHit,
  type TreeNode,
  type VaultItem,
  type VaultOptions,
} from './vault/vault.ts';
export {
  FileKind,
  FileStatus,
  FileSummary,
  Folder,
  FolderColor,
  FolderStyle,
  ItemName,
  PackageManifest,
  PACKAGE_FORMAT_VERSION,
  VaultFile,
  VaultIndex,
  VAULT_FORMAT_VERSION,
  VersionRecord,
  migrateVaultIndex,
} from './vault/records.ts';
export { MemoryStorage, STORAGE_KEY, type VaultStorage } from './vault/storage.ts';
export { seedDemoVault } from './vault/demo.ts';
export { planThumbnailSvg, type ThumbnailOptions } from './render/thumbnail.ts';
export { blankPlan, type BlankPlanOptions } from './samples/blank-plan.ts';

// Commands, changesets and undo (P2.4; A2 M2, M6, M7, M8, M9)
export {
  apply,
  applyChecked,
  changedObjects,
  diff,
  invert,
  sameValue,
} from './commands/changeset.ts';
export type { ChangedObject, Patch, Path } from './commands/changeset.ts';
export {
  defineCommand,
  type AnyCommand,
  type Command,
  type Enabled,
  type TextKind,
  type TextParam,
} from './commands/define.ts';
export {
  ADD_OPENING,
  ADD_ROOM,
  ADD_WALL,
  DELETE,
  MOVE,
  OBJECT_KINDS,
  SET,
  kindOf,
  type ObjectKind,
} from './commands/plan-commands.ts';
export {
  ADD_DIMENSION,
  ADD_HATCH,
  ADD_LINE,
  ADD_SEPARATOR,
  ADD_STAIR,
  ADD_TEXT,
  COPY,
  EXTEND,
  MIRROR,
  OFFSET,
  RECTANGLE,
  ROOM,
  ROTATE,
  SET_LENGTH,
  TRIM,
} from './commands/tool-commands.ts';
export { PLAN_COMMANDS } from './commands/registry.ts';
export {
  UNDO_LIMIT,
  applyRemote,
  canRedo,
  canUndo,
  createHistory,
  execute,
  preview,
  redo,
  undo,
  type BusOptions,
  type Changeset,
  type CommandCall,
  type CommandRequest,
  type FailureCode,
  type History,
  type Outcome,
} from './commands/history.ts';
export {
  findCommand,
  formatCommand,
  parseCommand,
  usage,
  type ParseResult,
} from './commands/text.ts';
export { parseLength, typedPoint, type PointInput } from './commands/input.ts';
