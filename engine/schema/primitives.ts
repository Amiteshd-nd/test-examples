import { z } from 'zod';

// Units (PRD §4.0): geometry in cm rounded to 0.1 cm (1 mm); areas in m² rounded to 0.01.

/**
 * Largest coordinate magnitude accepted, in cm (1 km). Keeps the integer-mm geometry in
 * `geometry/planar.ts` exact: products of mm coordinates stay far below 2^53.
 */
export const MAX_COORD_CM = 100_000;

const MM_PER_CM = 10;

export function isOnMmGrid(cm: number): boolean {
  return Math.abs(cm * MM_PER_CM - Math.round(cm * MM_PER_CM)) < 1e-6;
}

export function roundCm(cm: number): number {
  return Math.round(cm * MM_PER_CM) / MM_PER_CM;
}

export function roundM2(m2: number): number {
  return Math.round(m2 * 100) / 100;
}

const ON_GRID = { message: 'must be rounded to 0.1 cm (1 mm)' };

/** A coordinate or signed length in cm. */
export const Cm = z.number().min(-MAX_COORD_CM).max(MAX_COORD_CM).refine(isOnMmGrid, ON_GRID);
/** A length in cm that must be greater than zero. */
export const PositiveCm = z.number().gt(0).max(MAX_COORD_CM).refine(isOnMmGrid, ON_GRID);
/** A length in cm that may be zero. */
export const NonNegativeCm = z.number().min(0).max(MAX_COORD_CM).refine(isOnMmGrid, ON_GRID);

/** `[x, y]` in cm. */
export const Point = z.tuple([Cm, Cm]);
export type Point = z.infer<typeof Point>;

/** Closed polygon given by its corners (the last corner joins back to the first). */
export const Polygon = z.array(Point).min(3);
export type Polygon = z.infer<typeof Polygon>;

/** Stable id: never changes when the object is edited. */
export const Id = z
  .string()
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/, 'letters, digits, "_", "-" or "." only');
export type Id = z.infer<typeof Id>;

export const Compass = z.enum([
  'north',
  'north_east',
  'east',
  'south_east',
  'south',
  'south_west',
  'west',
  'north_west',
]);
export type Compass = z.infer<typeof Compass>;

// Provenance (PRD §4.5): absent means "measured" (typed or drawn by the architect).
export const ProvenanceKind = z.enum(['measured', 'inferred', 'assumed']);
export type ProvenanceKind = z.infer<typeof ProvenanceKind>;

export const ProvenanceTag = z.strictObject({
  provenance: ProvenanceKind,
  reason: z.string().optional(),
});
export type ProvenanceTag = z.infer<typeof ProvenanceTag>;

/** Field name → how that field's value was obtained. Only non-measured fields need an entry. */
export const ProvenanceMap = z.record(z.string(), ProvenanceTag);
export type ProvenanceMap = z.infer<typeof ProvenanceMap>;
