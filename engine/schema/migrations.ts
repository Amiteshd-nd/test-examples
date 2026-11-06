import { orderBetween } from './collections.ts';
import type { Migration, RawDocument } from './migrate.ts';

// Format upgrades, oldest first. Each works on raw JSON (never on the current schema types) so it
// keeps working when the format moves on.

type Raw = Record<string, unknown>;

/** 1.0.0 → 1.1.0 (A2, M1 + M3): object arrays become id-keyed maps; levels get an order; rooms can have separators. */
function toIdMaps(doc: RawDocument): RawDocument {
  const levels = Array.isArray(doc.levels) ? (doc.levels as Raw[]) : [];
  const out: Record<string, Raw> = {};
  let previous: string | null = null;
  for (const level of levels) {
    const id = String(level.id);
    if (id in out) throw new Error(`two levels use the id "${id}"`);
    const order = orderBetween(previous, null);
    previous = order;
    const map = (key: string) => {
      const items = Array.isArray(level[key]) ? (level[key] as Raw[]) : [];
      const m: Record<string, Raw> = {};
      for (const item of items) {
        const itemId = String(item.id);
        if (itemId in m) throw new Error(`two ${key} on level "${id}" use the id "${itemId}"`);
        m[itemId] = item;
      }
      return m;
    };
    out[id] = {
      id: level.id,
      name: level.name,
      order,
      elevation: level.elevation,
      height: level.height,
      walls: map('walls'),
      separators: {},
      rooms: map('rooms'),
      openings: map('openings'),
      stairs: map('stairs'),
      columns: map('columns'),
      fixtures: map('fixtures'),
    };
  }
  return { ...doc, levels: out };
}

/** 1.1.0 → 1.2.0 (P2.5): every level gains empty maps of lines, dimensions, notes and hatches. */
function addAnnotations(doc: RawDocument): RawDocument {
  const levels = (doc.levels ?? {}) as Record<string, Raw>;
  const out: Record<string, Raw> = {};
  for (const [id, level] of Object.entries(levels))
    out[id] = { ...level, lines: {}, dimensions: {}, texts: {}, hatches: {} };
  return { ...doc, levels: out };
}

/** 1.2.0 → 1.3.0 (P3.1): the plot may record the road's width; older plans don't know it. */
const roadWidth = (doc: RawDocument): RawDocument => doc;

export const MIGRATIONS: readonly Migration[] = [
  { from: '1.0.0', to: '1.1.0', migrate: toIdMaps },
  { from: '1.1.0', to: '1.2.0', migrate: addAnnotations },
  { from: '1.2.0', to: '1.3.0', migrate: roadWidth },
];
