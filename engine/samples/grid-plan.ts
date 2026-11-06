import { CURRENT_SCHEMA_VERSION } from '../schema/version.ts';
import type { Column, Opening, Plan, Room, Wall } from '../schema/plan.ts';
import type { RoomTypeId } from '../schema/room-types.ts';

// A regular plan of `cols × rows` rooms, for speed checks and the library demo until real plans
// arrive. 23 cm external walls, 11.5 cm internal walls; every room has a door, rooms on the
// outside have a window; columns at the wall crossings. It is a test shape, not a design.

export interface GridPlanOptions {
  cols: number;
  rows: number;
  /** Room size between wall centrelines, cm. */
  room?: [number, number];
  name?: string;
}

const TYPES: [RoomTypeId, string][] = [
  ['living', 'Living'],
  ['kitchen', 'Kitchen'],
  ['bedroom', 'Bedroom'],
  ['toilet', 'Toilet'],
  ['dining', 'Dining'],
  ['master_bedroom', 'Master bedroom'],
  ['study', 'Study'],
  ['store', 'Store'],
];

export function gridPlan({ cols, rows, room = [330, 300], name }: GridPlanOptions): Plan {
  const [W, D] = room;
  const walls: Record<string, Wall> = {};
  const wall = (id: string, start: [number, number], end: [number, number], external: boolean) => {
    walls[id] = {
      id,
      start,
      end,
      thickness: external ? 23 : 11.5,
      type: external ? 'external' : 'internal',
    };
  };
  for (let j = 0; j <= rows; j++)
    wall(`H${j}`, [0, j * D], [cols * W, j * D], j === 0 || j === rows);
  for (let i = 0; i <= cols; i++)
    wall(`V${i}`, [i * W, 0], [i * W, rows * D], i === 0 || i === cols);

  const rooms: Record<string, Room> = {};
  const openings: Record<string, Opening> = {};
  const columns: Record<string, Column> = {};
  let n = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const [type, label] = TYPES[n % TYPES.length]!;
      n++;
      const id = `R${n}`;
      rooms[id] = {
        id,
        type,
        name: `${label} ${n}`,
        seed: [i * W + W / 2, j * D + D / 2],
        behavior: 'fixed',
        locked: false,
      };
      // Door: from the room below, or from the left in the first row; the first room's door
      // on the front wall is the entrance.
      const [doorWall, doorOffset] =
        j > 0 || i === 0 ? [`H${j}`, i * W + 50] : [`V${i}`, j * D + 50];
      openings[`D${n}`] = {
        id: `D${n}`,
        kind: 'door',
        wall: doorWall,
        offset: doorOffset,
        width: 90,
        swing: 'in-left',
      };
      // Window on an outside wall: the back first, then the right or left side.
      const window: [string, number] | null =
        j === rows - 1
          ? [`H${rows}`, i * W + W / 2 - 60]
          : i === cols - 1
            ? [`V${cols}`, j * D + D / 2 - 60]
            : i === 0
              ? ['V0', j * D + D / 2 - 60]
              : null;
      if (window)
        openings[`N${n}`] = {
          id: `N${n}`,
          kind: 'window',
          wall: window[0],
          offset: window[1],
          width: 120,
          sill: 90,
        };
    }
  }
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= cols; i++) {
      const id = `C${j * (cols + 1) + i + 1}`;
      columns[id] = { id, at: [i * W, j * D], size: [23, 23], rotation_deg: 0 };
    }

  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    meta: {
      name: name ?? `Grid ${cols} × ${rows}`,
      bhk: Math.min(20, Object.values(rooms).filter((r) => r.type.endsWith('bedroom')).length),
      floors: 1,
      facing: 'south',
      vastu: false,
      city: 'bengaluru',
      display_units: 'm',
      source: 'manual',
    },
    plot: {
      polygon: [
        [-150, -300],
        [cols * W + 150, -300],
        [cols * W + 150, rows * D + 150],
        [-150, rows * D + 150],
      ],
      road_sides: ['south'],
    },
    setbacks: { front: 300, rear: 150, left: 150, right: 150 },
    rule_pack_ids: [],
    levels: {
      L0: {
        id: 'L0',
        name: 'Ground',
        order: 'i',
        elevation: 0,
        height: 300,
        walls,
        separators: {},
        rooms,
        openings,
        stairs: {},
        columns,
        fixtures: {},
        lines: {},
        dimensions: {},
        texts: {},
        hatches: {},
      },
    },
  };
}
