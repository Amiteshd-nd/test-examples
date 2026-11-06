import { orderBetween } from '../schema/collections.ts';
import type { Plan } from '../schema/plan.ts';
import type { Compass } from '../schema/primitives.ts';
import { CURRENT_SCHEMA_VERSION } from '../schema/version.ts';

// A new, empty plan ("+ New → New plan"): a plot and one empty ground floor. 30 × 40 ft by
// default, the most common plot in the founder's market.

export interface BlankPlanOptions {
  name: string;
  /** Plot width along the road and depth, cm. */
  plot?: [number, number];
  facing?: Compass;
  city?: string;
}

export function blankPlan({
  name,
  plot = [914.4, 1219.2],
  facing = 'north',
  city = 'bengaluru',
}: BlankPlanOptions): Plan {
  const [w, d] = plot;
  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    meta: {
      name,
      bhk: 0,
      floors: 1,
      facing,
      vastu: false,
      city,
      display_units: 'm',
      source: 'manual',
    },
    plot: {
      polygon: [
        [0, 0],
        [w, 0],
        [w, d],
        [0, d],
      ],
      road_sides: [facing],
    },
    setbacks: { front: 0, rear: 0, left: 0, right: 0 },
    rule_pack_ids: [],
    levels: {
      L0: {
        id: 'L0',
        name: 'Ground',
        order: orderBetween(),
        elevation: 0,
        height: 300,
        walls: {},
        separators: {},
        rooms: {},
        openings: {},
        stairs: {},
        columns: {},
        fixtures: {},
        lines: {},
        dimensions: {},
        texts: {},
        hatches: {},
      },
    },
  };
}
