import { z } from 'zod';
import { Plan } from '../schema/plan.ts';
import { Compass, Id } from '../schema/primitives.ts';
import { autoTag, PlanTags } from './tags.ts';

// The Plan Library (P1.4): plans plus an index of their tags, kept through a DocumentStore
// (PRD §3.4) so a host can swap the local JSON files for a database. The founder reviews tags
// in a CSV (spreadsheet) and corrections flow back into the plans.

export const LibraryEntry = z.strictObject({
  id: Id,
  name: z.string(),
  /** File the plan was imported from, if any. */
  source: z.string().optional(),
  status: z.enum(['success', 'partial']),
  imported_at: z.string(),
  /** True once the founder has reviewed the tags. */
  reviewed: z.boolean(),
  tags: PlanTags,
});
export type LibraryEntry = z.infer<typeof LibraryEntry>;

export const LibraryIndex = z.strictObject({
  version: z.literal(1),
  entries: z.array(LibraryEntry),
});
export type LibraryIndex = z.infer<typeof LibraryIndex>;

/** Storage the host supplies (PRD §3.4). The engine never touches files or databases itself. */
export interface DocumentStore {
  loadPlan(id: string): Promise<unknown | null>;
  savePlan(id: string, plan: Plan): Promise<void>;
  listPlans(): Promise<string[]>;
  loadIndex(): Promise<LibraryIndex>;
  saveIndex(index: LibraryIndex): Promise<void>;
}

/** A DocumentStore in memory, for tests and short-lived hosts. */
export class MemoryStore implements DocumentStore {
  private plans = new Map<string, Plan>();
  private index: LibraryIndex = { version: 1, entries: [] };
  async loadPlan(id: string) {
    const plan = this.plans.get(id);
    return plan ? structuredCopy(plan) : null;
  }
  async savePlan(id: string, plan: Plan) {
    this.plans.set(id, structuredCopy(plan));
  }
  async listPlans() {
    return [...this.plans.keys()].sort();
  }
  async loadIndex() {
    return structuredCopy(this.index);
  }
  async saveIndex(index: LibraryIndex) {
    this.index = structuredCopy(index);
  }
}

const structuredCopy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** A library id from a file name: lower case, letters, digits and dashes. */
export function libraryId(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'plan'
  );
}

export interface AddToLibrary {
  id: string;
  plan: Plan;
  status: LibraryEntry['status'];
  /** ISO time, supplied by the host's clock. */
  now: string;
  source?: string;
}

/** Saves a plan and (re)tags it. Founder-reviewed facts (facing, BHK, floors, Vastu) are kept. */
export async function addToLibrary(
  store: DocumentStore,
  input: AddToLibrary,
): Promise<LibraryEntry> {
  const index = await store.loadIndex();
  const previous = index.entries.find((e) => e.id === input.id);
  const plan = structuredCopy(input.plan);
  if (previous?.reviewed) {
    plan.meta.facing = previous.tags.facing.value;
    plan.meta.bhk = previous.tags.bhk.value;
    plan.meta.floors = previous.tags.floors.value;
    plan.meta.vastu = previous.tags.vastu.value;
    plan.meta.provenance = {
      ...plan.meta.provenance,
      ...confirmed(['facing', 'bhk', 'floors', 'vastu']),
    };
  }
  await store.savePlan(input.id, plan);
  const entry: LibraryEntry = {
    id: input.id,
    name: plan.meta.name,
    ...(input.source ? { source: input.source } : {}),
    status: input.status,
    imported_at: input.now,
    reviewed: previous?.reviewed ?? false,
    tags: autoTag(plan),
  };
  index.entries = [...index.entries.filter((e) => e.id !== input.id), entry].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  await store.saveIndex(index);
  return entry;
}

const confirmed = (fields: string[]) =>
  Object.fromEntries(
    fields.map((f) => [
      f,
      { provenance: 'measured' as const, reason: 'Confirmed in the tag review.' },
    ]),
  );

// --- Tag review (P1.4 🛑): a CSV the founder edits in a spreadsheet --------------------------------

const EDITABLE = ['facing', 'bhk', 'floors', 'vastu'] as const;
const COLUMNS = [
  'id',
  'name',
  'status',
  'reviewed',
  'facing',
  'facing_source',
  'bhk',
  'bhk_source',
  'floors',
  'floors_source',
  'vastu',
  'vastu_source',
  'plot_size_ft',
  'plot_size_m',
  'plot_area_m2',
  'built_up_m2',
  'carpet_m2',
  'zones',
  'vastu_notes',
] as const;

const csvCell = (v: string | number | boolean) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * The tag-review table: one row per plan. The founder corrects facing, bhk, floors and vastu
 * in place (and may type "yes" in `reviewed` to confirm a row unchanged), then saves it as CSV.
 */
export function tagReviewCsv(index: LibraryIndex): string {
  const rows = index.entries.map((e) => {
    const t = e.tags;
    const src = (x: { provenance: string; reason?: string }) =>
      x.reason ? `${x.provenance}: ${x.reason}` : x.provenance;
    const row: Record<(typeof COLUMNS)[number], string | number | boolean> = {
      id: e.id,
      name: e.name,
      status: e.status,
      reviewed: e.reviewed ? 'yes' : '',
      facing: t.facing.value,
      facing_source: src(t.facing),
      bhk: t.bhk.value,
      bhk_source: src(t.bhk),
      floors: t.floors.value,
      floors_source: src(t.floors),
      vastu: t.vastu.value ? 'yes' : 'no',
      vastu_source: src(t.vastu),
      plot_size_ft: t.plot_size_ft,
      plot_size_m: t.plot_size_m,
      plot_area_m2: t.plot_area_m2.value,
      built_up_m2: t.built_up_m2.value,
      carpet_m2: t.carpet_m2.value,
      zones: Object.entries(t.zones.value)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; '),
      vastu_notes: t.vastu_notes.join(' '),
    };
    return COLUMNS.map((c) => csvCell(row[c])).join(',');
  });
  return [COLUMNS.join(','), ...rows].join('\n') + '\n';
}

/** Parses CSV text (quoted fields, doubled quotes, commas and line breaks inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

export interface ReviewResult {
  /** Plain-language list of what changed. */
  changes: string[];
  /** Rows or cells that could not be used, and why. */
  errors: string[];
}

/** Applies a reviewed CSV: corrected or confirmed rows update the plan and its tags. */
export async function applyTagReview(store: DocumentStore, csv: string): Promise<ReviewResult> {
  const [header, ...rows] = parseCsv(csv);
  const col = (name: string) => header?.indexOf(name) ?? -1;
  const result: ReviewResult = { changes: [], errors: [] };
  if (!header || col('id') < 0)
    return { changes: [], errors: ['The file has no "id" column; use the CSV PlanCraft wrote.'] };
  const index = await store.loadIndex();
  for (const cells of rows) {
    const id = cells[col('id')]?.trim() ?? '';
    const entry = index.entries.find((e) => e.id === id);
    if (!entry) {
      result.errors.push(`No plan "${id}" in the library.`);
      continue;
    }
    const raw = await store.loadPlan(id);
    const parsed = Plan.safeParse(raw);
    if (!parsed.success) {
      result.errors.push(`Plan "${id}" could not be read from the library.`);
      continue;
    }
    const plan = parsed.data;
    const value = (name: (typeof EDITABLE)[number]) => cells[col(name)]?.trim() ?? '';
    const rowErrors: string[] = [];
    const facing = Compass.safeParse(
      value('facing')
        .toLowerCase()
        .replace(/[\s-]+/g, '_'),
    );
    if (!facing.success)
      rowErrors.push(
        `${id}: facing "${value('facing')}" is not one of ${Compass.options.join(', ')}.`,
      );
    const bhk = Number(value('bhk'));
    if (!Number.isInteger(bhk) || bhk < 0 || bhk > 20)
      rowErrors.push(`${id}: BHK "${value('bhk')}" is not a whole number from 0 to 20.`);
    const floors = Number(value('floors'));
    if (!Number.isInteger(floors) || floors < 1 || floors > 10)
      rowErrors.push(`${id}: floors "${value('floors')}" is not a whole number from 1 to 10.`);
    const vastuText = value('vastu').toLowerCase();
    if (!['yes', 'no'].includes(vastuText))
      rowErrors.push(`${id}: Vastu "${value('vastu')}" should be yes or no.`);
    if (rowErrors.length || !facing.success) {
      result.errors.push(...rowErrors, `${id}: row not applied.`);
      continue;
    }
    const vastu = vastuText === 'yes';
    const changed = [
      facing.data !== plan.meta.facing ? `facing ${plan.meta.facing} → ${facing.data}` : '',
      bhk !== plan.meta.bhk ? `BHK ${plan.meta.bhk} → ${bhk}` : '',
      floors !== plan.meta.floors ? `floors ${plan.meta.floors} → ${floors}` : '',
      vastu !== plan.meta.vastu ? `Vastu ${plan.meta.vastu ? 'yes' : 'no'} → ${vastuText}` : '',
    ].filter(Boolean);
    const confirmedRow = (cells[col('reviewed')]?.trim().toLowerCase() ?? '') === 'yes';
    if (!changed.length && !(confirmedRow && !entry.reviewed)) continue;
    plan.meta.facing = facing.data;
    plan.meta.bhk = bhk;
    plan.meta.floors = floors;
    plan.meta.vastu = vastu;
    plan.meta.provenance = { ...plan.meta.provenance, ...confirmed([...EDITABLE]) };
    await store.savePlan(id, plan);
    entry.reviewed = true;
    entry.tags = autoTag(plan);
    result.changes.push(
      `${entry.name}: ${changed.length ? changed.join(', ') : 'confirmed as is'}.`,
    );
  }
  await store.saveIndex(index);
  return result;
}
