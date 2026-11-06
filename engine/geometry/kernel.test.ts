import { describe, expect, it } from 'vitest';
import { deriveRooms } from '../rooms/derive.ts';
import { toMap } from '../schema/collections.ts';
import type { Level, Room, Wall } from '../schema/plan.ts';
import { validatePlan } from '../validate/validate.ts';
import { isSimpleFloatRing, pointInFloatRing } from './inset.ts';
import { wallOutlines } from './wall-outlines.ts';

// P1.1b geometry kernel (A2 M4): wall joins of every kind, gap tolerance, snap rounding, and
// fuzz tests — random wall sets must never crash or produce a self-intersecting room.

type P = [number, number];
const wall = (id: string, start: P, end: P, thickness = 10): Wall => ({
  id,
  start,
  end,
  thickness,
  type: 'internal',
});
const room = (id: string, seed: P): Room => ({
  id,
  type: 'bedroom',
  name: id,
  seed,
  behavior: 'fixed',
  locked: false,
});
const level = (walls: Wall[], rooms: Room[]): Level => ({
  id: 'L0',
  name: 'Ground',
  order: 'i',
  elevation: 0,
  height: 300,
  walls: toMap(walls),
  separators: {},
  rooms: toMap(rooms),
  openings: {},
  stairs: {},
  columns: {},
  fixtures: {},
  lines: {},
  dimensions: {},
  texts: {},
  hatches: {},
});
const square = (size: number, t = 10): Wall[] => [
  wall('S', [0, 0], [size, 0], t),
  wall('E', [size, 0], [size, size], t),
  wall('N', [size, size], [0, size], t),
  wall('W', [0, size], [0, 0], t),
];
const areas = (lvl: Level) => {
  const r = deriveRooms(lvl);
  return {
    areas: Object.fromEntries(r.rooms.map((x) => [x.room_id, x.area_m2])),
    issues: r.issues.map((i) => i.rule_id),
  };
};

describe('wall joins', () => {
  it('splits a square into four rooms with a plus of walls (X junction)', () => {
    const lvl = level(
      [...square(600), wall('H', [0, 300], [600, 300]), wall('V', [300, 0], [300, 600])],
      [room('A', [150, 150]), room('B', [450, 150]), room('C', [150, 450]), room('D', [450, 450])],
    );
    // Each quarter: 300 − 5 − 5 = 290 cm square.
    expect(areas(lvl)).toEqual({ areas: { A: 8.41, B: 8.41, C: 8.41, D: 8.41 }, issues: [] });
  });

  it('handles five walls meeting at one point', () => {
    const lvl = level(
      [
        ...square(600),
        wall('H1', [0, 300], [300, 300]),
        wall('H2', [300, 300], [600, 300]),
        wall('V1', [300, 0], [300, 300]),
        wall('V2', [300, 300], [300, 600]),
        wall('D', [300, 300], [600, 600]),
      ],
      [
        room('A', [150, 150]),
        room('B', [450, 150]),
        room('C', [150, 450]),
        room('D1', [500, 380]),
        room('D2', [380, 500]),
      ],
    );
    const { areas: a, issues } = areas(lvl);
    expect(issues).toEqual([]);
    expect(Object.keys(a).sort()).toEqual(['A', 'B', 'C', 'D1', 'D2']);
    expect(a.D1).toBeCloseTo(a.D2!, 2); // the diagonal halves the last quarter
  });

  it('crosses walls at a very shallow angle without losing the junction', () => {
    const lvl = level(
      [...square(600), wall('A', [0, 200], [600, 200]), wall('B', [0, 190], [600, 212])],
      [room('Low', [300, 80]), room('High', [300, 420])],
    );
    const { areas: a, issues } = areas(lvl);
    expect(issues).toEqual([]);
    expect(a.Low! + a.High!).toBeLessThan(36);
  });

  it('uses the thicker wall where two walls overlap in line', () => {
    const plain = level(square(400, 20), [room('R', [200, 200])]);
    const overlapped = level(
      [...square(400, 20), wall('O', [100, 0], [300, 0], 10)],
      [room('R', [200, 200])],
    );
    expect(areas(overlapped)).toEqual(areas(plain));
  });

  it('closes gaps up to 2 cm and reports wider ones', () => {
    const shortBy = (cm: number) =>
      level([...square(400).slice(0, 3), wall('W', [0, 400], [0, cm])], [room('R', [200, 200])]);
    expect(areas(shortBy(1.5)).issues).toEqual([]);
    expect(areas(shortBy(2)).issues).toEqual([]);
    expect(areas(shortBy(2.5)).issues).toEqual(['geometry.room_seed_not_enclosed']);
  });

  it('joins a diagonal wall that ends a hair off another diagonal wall', () => {
    const lvl = level(
      [
        wall('A', [0, 0], [500, 0]),
        wall('B', [500, 0], [250, 433]),
        wall('C', [250, 433], [0, 0]),
        wall('M', [250, 0], [375.3, 216.6]), // stops just off B
      ],
      [room('L', [200, 100]), room('R', [380, 60])],
    );
    expect(areas(lvl).issues).toEqual([]);
  });
});

/** Small seeded generator (xorshift32), so failures can be replayed. */
function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

describe('fuzz: random wall sets', () => {
  it('never crash and never produce a self-intersecting room', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const r = rng(seed);
      const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)]!;
      const cm = (n: number) => Math.round(n * 10) / 10;
      // A closed outer wall, then inner walls that run between walls, overshoot, stop short
      // (gaps up to 3 cm: some close, some don't), cross diagonally and overlap.
      const W = 300 + Math.round(r() * 90) * 10;
      const H = 300 + Math.round(r() * 90) * 10;
      const t = pick([15, 20, 23]);
      const walls: Wall[] = [
        wall('S', [0, 0], [W, 0], t),
        wall('E', [W, 0], [W, H], t),
        wall('N', [W, H], [0, H], t),
        wall('Wst', [0, H], [0, 0], t),
      ];
      const off = () => (r() < 0.4 ? cm((r() - 0.5) * 6) : 0); // ±3 cm
      for (let i = 0, n = 1 + Math.floor(r() * 8); i < n; i++) {
        const kind = r();
        let a: P;
        let b: P;
        if (kind < 0.4) {
          const y = Math.round((0.1 + r() * 0.8) * H);
          a = [r() < 0.7 ? 0 : Math.round(r() * W), y];
          b = [
            r() < 0.7 ? W : Math.round(r() * W),
            y + (r() < 0.1 ? Math.round((r() - 0.5) * 6) : 0),
          ];
        } else if (kind < 0.8) {
          const x = Math.round((0.1 + r() * 0.8) * W);
          a = [x, r() < 0.7 ? 0 : Math.round(r() * H)];
          b = [x, r() < 0.7 ? H : Math.round(r() * H)];
        } else {
          a = [Math.round(r() * W), 0];
          b = [Math.round(r() * W), H];
        }
        a = [cm(a[0] + off()), cm(a[1] + off())];
        b = [cm(b[0] + off()), cm(b[1] + off())];
        if (r() < 0.1) b = [cm(b[0] + (b[0] - a[0]) * 0.1), cm(b[1] + (b[1] - a[1]) * 0.1)]; // overshoot
        if (a[0] === b[0] && a[1] === b[1]) continue;
        walls.push(wall(`W${i}`, a, b, pick([10, 11.5, 15, 23])));
      }
      const rooms = Array.from({ length: 1 + Math.floor(r() * 6) }, (_, i) =>
        room(`R${i}`, [Math.round(r() * W), Math.round(r() * H)]),
      );
      const lvl = level(walls, rooms);
      const context = `seed ${seed}`;

      const derived = deriveRooms(lvl);
      const seedIssues = new Set(
        derived.issues
          .filter((i) => i.rule_id === 'geometry.room_seed_in_wall')
          .flatMap((i) => i.object_ids),
      );
      for (const d of derived.rooms) {
        const mm = (ring: P[]) => ring.map(([x, y]): P => [x * 10, y * 10]);
        expect(isSimpleFloatRing(mm(d.outer)), context).toBe(true);
        expect(d.area_m2, context).toBeGreaterThan(0);
        for (const h of d.holes) expect(isSimpleFloatRing(mm(h)), context).toBe(true);
        if (!seedIssues.has(d.room_id)) {
          const seed = lvl.rooms[d.room_id]!.seed;
          expect(pointInFloatRing([seed[0], seed[1]], d.outer), context).toBe(true);
          expect(
            d.holes.some((h) => pointInFloatRing([seed[0], seed[1]], h)),
            context,
          ).toBe(false);
        }
      }
      // Same walls in a different order: exactly the same rooms (needed for merges and sync).
      const shuffled = level(
        [...walls].sort(() => r() - 0.5),
        rooms,
      );
      expect(deriveRooms(shuffled), context).toEqual(derived);
      expect(deriveRooms(lvl), context).toEqual(derived);
      expect(() => wallOutlines(lvl, () => 'all'), context).not.toThrow();
      const plan = {
        schema_version: '1.1.0',
        meta: {
          name: 'fuzz',
          bhk: 0,
          floors: 1,
          facing: 'north',
          vastu: false,
          city: 'x',
          display_units: 'm',
          source: 'manual',
        },
        plot: {
          polygon: [
            [-100, -100],
            [900, -100],
            [900, 900],
            [-100, 900],
          ],
          road_sides: [],
        },
        setbacks: { front: 0, rear: 0, left: 0, right: 0 },
        levels: { L0: lvl },
        rule_pack_ids: [],
      };
      expect(() => validatePlan(plan), context).not.toThrow();
    }
  });
});
