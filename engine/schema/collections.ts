import type { Level, Plan } from './plan.ts';

// Objects live in id-keyed maps (addendum A2, M1): each map key is the object's id. These
// helpers turn maps into lists and keep levels in their `order` (a fractional index).

export function values<T>(map: Readonly<Record<string, T>>): T[] {
  return Object.values(map);
}

export function toMap<T extends { id: string }>(items: readonly T[]): Record<string, T> {
  return Object.fromEntries(items.map((x) => [x.id, x]));
}

export function levelsInOrder(plan: Pick<Plan, 'levels'>): Level[] {
  return values(plan.levels).sort((a, b) =>
    a.order < b.order ? -1 : a.order > b.order ? 1 : a.id.localeCompare(b.id),
  );
}

/** The lowest level (plans always have at least one). */
export function firstLevel(plan: Pick<Plan, 'levels'>): Level {
  return levelsInOrder(plan)[0]!;
}

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * A fractional index strictly between `a` and `b` (null = open end), so an item can be placed
 * between two others without renumbering. Keys use 0–9 a–z, compare as plain strings, and
 * never end in "0".
 */
export function orderBetween(a: string | null = null, b: string | null = null): string {
  if (a !== null && b !== null && a >= b) throw new Error(`order "${a}" is not before "${b}"`);
  let prefix = '';
  let upper = b;
  for (let i = 0; ; i++) {
    const da = a !== null && i < a.length ? DIGITS.indexOf(a[i]!) : 0;
    const db = upper !== null && i < upper.length ? DIGITS.indexOf(upper[i]!) : DIGITS.length;
    if (db - da > 1) return prefix + DIGITS[(da + db) >> 1];
    prefix += DIGITS[da];
    if (db - da === 1) upper = null; // below `upper` from here on; any longer key works
  }
}
