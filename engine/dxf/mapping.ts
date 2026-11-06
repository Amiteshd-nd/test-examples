import { z } from 'zod';
import { DoorSwing } from '../schema/plan.ts';
import { RoomType, type RoomTypeId } from '../schema/room-types.ts';
import defaults from './import-mapping.default.json' with { type: 'json' };

// The import mapping (P1.2 task 3): which layers, blocks and room names mean what. Data, not
// code, so the founder can tune it to the office's drawings (`data/import-mapping.json`).

const Patterns = z.array(z.string().min(1));

export const ImportMapping = z.strictObject({
  version: z.literal(1),
  about: z.string().optional(),
  layers: z.strictObject({
    ignore: Patterns,
    walls: Patterns,
    doors: Patterns,
    windows: Patterns,
    ventilators: Patterns,
    stairs: Patterns,
    columns: Patterns,
    plot: Patterns,
    separators: Patterns,
    room_labels: Patterns,
  }),
  blocks: z.strictObject({
    doors: Patterns,
    windows: Patterns,
    ventilators: Patterns,
    openings: Patterns,
  }),
  /** Wall layers that also say the wall type; walls on other wall layers are typed by position. */
  wall_types: z.strictObject({ internal: Patterns, parapet: Patterns, compound: Patterns }),
  room_types: z.partialRecord(RoomType, Patterns),
  wall_thickness_cm: z.strictObject({ min: z.number().positive(), max: z.number().positive() }),
  max_opening_with_symbol_cm: z.number().positive(),
  max_plain_opening_cm: z.number().min(0),
  defaults: z.strictObject({
    window_sill_cm: z.number().min(0),
    ventilator_sill_cm: z.number().min(0),
    door_swing: DoorSwing,
    city: z.string(),
    level_height_cm: z.number().positive(),
  }),
});
export type ImportMapping = z.infer<typeof ImportMapping>;

export const DEFAULT_IMPORT_MAPPING: ImportMapping = ImportMapping.parse(defaults);

const regexCache = new Map<string, RegExp>();

/** Case-insensitive glob: `*` any run of characters, `?` one character. */
export function globMatch(pattern: string, name: string): boolean {
  let re = regexCache.get(pattern);
  if (!re) {
    const body = pattern
      .split('')
      .map((c) => (c === '*' ? '.*' : c === '?' ? '.' : c.replace(/[.+^${}()|[\]\\]/g, '\\$&')))
      .join('');
    re = new RegExp(`^${body}$`, 'i');
    regexCache.set(pattern, re);
  }
  return re.test(name.trim());
}

export const matchesAny = (patterns: readonly string[], name: string) =>
  patterns.some((p) => globMatch(p, name));

export type LayerRole = keyof ImportMapping['layers'];

/** The role of a layer; `ignore` wins over everything, then the order of the mapping. */
export function layerRole(mapping: ImportMapping, layer: string): LayerRole | null {
  const order: LayerRole[] = [
    'ignore',
    'walls',
    'doors',
    'windows',
    'ventilators',
    'stairs',
    'columns',
    'plot',
    'separators',
    'room_labels',
  ];
  return order.find((role) => matchesAny(mapping.layers[role], layer)) ?? null;
}

const DIMENSION_LINE = /^[\d\s'".,xX×*\-–()=MmCcFfTtIiNn]+$/;
const AREA_LINE = /^[\d\s.,]+(m²|m2|sq\.?\s*m|sqm|sq\.?\s*ft|sft|ft²)\.?$/i;

/** Upper-case words of a label with dimension lines, numbering and punctuation removed. */
export function normalizeLabel(text: string): string {
  return text
    .split('\n')
    .filter(
      (line) => /[A-Za-z]/.test(line) && !DIMENSION_LINE.test(line) && !AREA_LINE.test(line.trim()),
    )
    .join(' ')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface LabelMatch {
  type: RoomTypeId;
  /** The mapping phrase that matched. */
  phrase: string;
}

/**
 * The room type a label names: the phrase found earliest in the label wins; among phrases
 * starting at the same word, the longest. Labels longer than four words are treated as notes.
 */
export function matchRoomLabel(mapping: ImportMapping, text: string): LabelMatch | null {
  const words = normalizeLabel(text).split(' ').filter(Boolean);
  if (words.length === 0 || words.length > 4) return null;
  let best: (LabelMatch & { at: number; len: number }) | null = null;
  for (const [type, phrases] of Object.entries(mapping.room_types) as [RoomTypeId, string[]][]) {
    for (const phrase of phrases) {
      const pw = normalizeLabel(phrase).split(' ').filter(Boolean);
      for (let at = 0; at + pw.length <= words.length; at++) {
        if (!pw.every((w, k) => words[at + k] === w)) continue;
        if (!best || at < best.at || (at === best.at && pw.length > best.len)) {
          best = { type, phrase, at, len: pw.length };
        }
        break;
      }
    }
  }
  return best && { type: best.type, phrase: best.phrase };
}
