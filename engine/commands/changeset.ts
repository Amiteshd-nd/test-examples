// Changesets (A2 M9): the one mechanism behind undo, history, branches and multiplayer. A
// changeset is a list of patches, each one value at a path changing from `before` to `after`.
// Objects (records) are walked field by field; arrays (points, polygons, lists) are single
// values. A patch without `before` adds a value, one without `after` removes it.
// All functions are pure: documents are never changed in place, and unchanged parts are shared.

export type Path = readonly string[];

export interface Patch {
  path: Path;
  before?: unknown;
  after?: unknown;
}

type Rec = Record<string, unknown>;
const isRecord = (x: unknown): x is Rec => typeof x === 'object' && x !== null && !Array.isArray(x);
const has = (o: Rec, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** Deep equality of JSON values. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => sameValue(x, b[i]));
  }
  if (isRecord(a)) {
    if (!isRecord(b)) return false;
    const ka = Object.keys(a);
    if (ka.length !== Object.keys(b).length) return false;
    return ka.every((k) => has(b, k) && sameValue(a[k], b[k]));
  }
  return false;
}

/** The patches that turn `a` into `b`. Unchanged branches (same object) are skipped at once. */
export function diff(a: unknown, b: unknown, path: Path = []): Patch[] {
  if (a === b) return [];
  if (!isRecord(a) || !isRecord(b)) return sameValue(a, b) ? [] : [{ path, before: a, after: b }];
  const out: Patch[] = [];
  for (const k of Object.keys(a)) {
    if (!has(b, k)) out.push({ path: [...path, k], before: a[k] });
    else out.push(...diff(a[k], b[k], [...path, k]));
  }
  for (const k of Object.keys(b)) if (!has(a, k)) out.push({ path: [...path, k], after: b[k] });
  return out;
}

const read = (doc: unknown, path: Path): { found: boolean; value?: unknown } => {
  let cur: unknown = doc;
  for (const k of path) {
    if (!isRecord(cur) || !has(cur, k)) return { found: false };
    cur = cur[k];
  }
  return { found: true, value: cur };
};

/** A copy of `doc` with the value at `path` set (or removed when `remove`); null if no parent. */
function write(doc: unknown, path: Path, value: unknown, remove: boolean): unknown {
  if (!path.length) return remove ? undefined : value;
  if (!isRecord(doc)) return null;
  const [k, ...rest] = path as [string, ...string[]];
  if (!rest.length) {
    const copy: Rec = { ...doc };
    if (remove) delete copy[k];
    else copy[k] = value;
    return copy;
  }
  if (!has(doc, k)) return null;
  const child = write(doc[k], rest, value, remove);
  return child === null ? null : { ...doc, [k]: child };
}

/** Applies patches in order, without checking what they replace. */
export function apply<T>(doc: T, patches: readonly Patch[]): T {
  let cur: unknown = doc;
  for (const p of patches) {
    const next = write(cur, p.path, p.after, !('after' in p));
    if (next === null) throw new Error(`Cannot apply a change at ${p.path.join('.')}: no parent.`);
    cur = next;
  }
  return cur as T;
}

/**
 * Applies the patches whose `before` still matches the document (A2 M8): a patch whose value
 * was changed by someone since is skipped and returned, so the caller can say what was left out.
 */
export function applyChecked<T>(
  doc: T,
  patches: readonly Patch[],
): { doc: T; applied: Patch[]; skipped: Patch[] } {
  let cur: unknown = doc;
  const applied: Patch[] = [];
  const skipped: Patch[] = [];
  for (const p of patches) {
    const now = read(cur, p.path);
    const expected = 'before' in p;
    const matches = expected ? now.found && sameValue(now.value, p.before) : !now.found;
    const next = matches ? write(cur, p.path, p.after, !('after' in p)) : null;
    if (next === null) skipped.push(p);
    else {
      cur = next;
      applied.push(p);
    }
  }
  return { doc: cur as T, applied, skipped };
}

/** The patches that undo `patches`: reversed, with before and after swapped. */
export function invert(patches: readonly Patch[]): Patch[] {
  return [...patches].reverse().map((p) => {
    const q: Patch = { path: p.path };
    if ('after' in p) q.before = p.after;
    if ('before' in p) q.after = p.before;
    return q;
  });
}

/** One object a changeset touched: `levels.<level>.<kind>.<id>`, or a top-level part. */
export interface ChangedObject {
  level?: string;
  kind: string;
  id?: string;
}

/**
 * What a changeset touched, one entry per object (A2 M6 dirty flags): hosts and derived data
 * (rooms, drawing, index, checks) can update only these instead of everything.
 */
export function changedObjects(patches: readonly Patch[]): ChangedObject[] {
  const seen = new Map<string, ChangedObject>();
  for (const { path } of patches) {
    const [top, level, kind, id] = path;
    const o: ChangedObject =
      top === 'levels' && level !== undefined
        ? kind === undefined
          ? { level, kind: 'level' }
          : id === undefined || !isObjectMap(kind)
            ? { level, kind: 'level' }
            : { level, kind, id }
        : { kind: top ?? 'plan' };
    const key = `${o.level ?? ''}/${o.kind}/${o.id ?? ''}`;
    if (!seen.has(key)) seen.set(key, o);
  }
  return [...seen.values()];
}

const OBJECT_MAPS = new Set([
  'walls',
  'separators',
  'rooms',
  'openings',
  'stairs',
  'columns',
  'fixtures',
]);
const isObjectMap = (k: string) => OBJECT_MAPS.has(k);
