import {
  CURRENT_SCHEMA_VERSION,
  importDxf,
  oneBhkDxf,
  orderBetween,
  toMap,
  type Plan,
} from '@plancraft/engine';

// Demo data for the Vault component page (P14.1). Neutral names; nothing from the references.

type W = [number, number, number, number, number];

function simplePlan(name: string, walls: W[], seeds: [number, number][]): Plan {
  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    meta: {
      name,
      bhk: 0,
      floors: 1,
      facing: 'north',
      vastu: false,
      city: 'bengaluru',
      display_units: 'm',
      source: 'manual',
    },
    plot: {
      polygon: [
        [-100, -100],
        [1100, -100],
        [1100, 900],
        [-100, 900],
      ],
      road_sides: ['north'],
    },
    setbacks: { front: 0, rear: 0, left: 0, right: 0 },
    levels: {
      L0: {
        id: 'L0',
        name: 'Ground',
        order: orderBetween(),
        elevation: 0,
        height: 300,
        walls: toMap(
          walls.map(([x0, y0, x1, y1, t], i) => ({
            id: `W${i}`,
            start: [x0, y0],
            end: [x1, y1],
            thickness: t,
            type: 'internal' as const,
          })),
        ),
        separators: {},
        rooms: toMap(
          seeds.map((seed, i) => ({
            id: `R${i}`,
            type: 'bedroom' as const,
            name: '',
            seed,
            behavior: 'fixed' as const,
            locked: false,
          })),
        ),
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
    rule_pack_ids: [],
  };
}

const oneBhk = importDxf(
  oneBhkDxf({ unit: 'mm', header: true, polylines: false, wrapInBlock: false }),
).plan!;
const twoRooms = simplePlan(
  '2BHK',
  [
    [0, 0, 900, 0, 23],
    [900, 0, 900, 600, 23],
    [900, 600, 0, 600, 23],
    [0, 600, 0, 0, 23],
    [450, 0, 450, 600, 11.5],
    [0, 300, 450, 300, 11.5],
    [450, 350, 900, 350, 11.5],
  ],
  [
    [200, 150],
    [200, 450],
    [700, 150],
    [700, 480],
  ],
);
const lPlan = simplePlan(
  'L villa',
  [
    [0, 0, 800, 0, 23],
    [800, 0, 800, 350, 23],
    [800, 350, 400, 350, 23],
    [400, 350, 400, 700, 23],
    [400, 700, 0, 700, 23],
    [0, 700, 0, 0, 23],
    [400, 0, 400, 350, 11.5],
    [0, 350, 400, 350, 11.5],
  ],
  [
    [200, 170],
    [600, 170],
    [200, 520],
  ],
);

export const DEMO_PLANS: Plan[] = [oneBhk, twoRooms, lPlan];

export const PEOPLE = {
  A: { name: 'Asha Rao', colour: '#c9cbff' },
  R: { name: 'Rohit Menon', colour: '#bfe8cf' },
  M: { name: 'Meera Iyer', colour: '#ffd3b0' },
} as const;
export type PersonKey = keyof typeof PEOPLE;

export const TREE = [
  { id: 'res', name: 'Residential', colour: 'graphite', count: 15, depth: 0, open: true },
  { id: '3040', name: '30×40 plots', colour: 'blue', count: 5, depth: 1, open: true },
  { id: 'east', name: 'East facing', colour: 'blue', count: 3, depth: 2 },
  { id: 'villas', name: 'Villas', colour: 'green', count: 10, depth: 1 },
  { id: 'comm', name: 'Commercial', colour: 'orange', count: 5, depth: 0 },
  { id: 'boards', name: 'Client boards', colour: 'purple', count: 4, depth: 0, closed: true },
  { id: 'rules', name: 'Rule packs', colour: 'red', count: 6, depth: 0, closed: true },
] as const;

export const FILES = [
  {
    name: '30x40 East 3BHK',
    kind: 'plan',
    owner: 'A',
    editedBy: 'R',
    edited: '2 h ago',
    branches: 2,
    status: 'review',
    size: '184 KB',
  },
  {
    name: '40x60 North G+1',
    kind: 'plan',
    owner: 'R',
    editedBy: 'R',
    edited: 'yesterday',
    branches: 0,
    status: 'draft',
    size: '342 KB',
  },
  {
    name: 'Board – Villa client review',
    kind: 'sheets',
    owner: 'M',
    editedBy: 'A',
    edited: 'today',
    branches: 1,
    status: 'approved',
    size: '2.4 MB',
  },
  {
    name: 'Duplex 30x50 West',
    kind: 'plan',
    owner: 'A',
    editedBy: 'M',
    edited: '3 days ago',
    branches: 0,
    status: 'draft',
    size: '211 KB',
  },
] as const;
