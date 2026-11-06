import { describe, expect, it } from 'vitest';
import { exportDxf } from '../dxf/export.ts';
import { gridPlan } from '../samples/grid-plan.ts';
import sample from '../samples/1.3.0/a-one-room.plan.json' with { type: 'json' };
import { Plan, type Opening, type Wall } from '../schema/plan.ts';
import { validatePlan } from '../validate/validate.ts';
import { openingSymbol, planDrawing, stairSymbol } from './drawing.ts';

const wall: Wall = { id: 'W1', start: [0, 0], end: [400, 0], thickness: 23, type: 'external' };
const door = (swing: 'in-left' | 'in-right' | 'out-left' | 'out-right'): Opening => ({
  id: 'D1',
  wall: 'W1',
  offset: 100,
  width: 90,
  kind: 'door',
  swing,
});

describe('opening symbols (same as the DXF blocks)', () => {
  it('hinges a door on the centreline and swings it a quarter turn', () => {
    // "in" = left of the wall's direction (+y here); "-left" = hinge at the opening's start.
    expect(openingSymbol(door('in-left'), wall)).toMatchObject({
      frame: [
        [100, -11.5],
        [190, -11.5],
        [190, 11.5],
        [100, 11.5],
      ],
      lines: [
        [
          [100, 0],
          [100, 90],
        ],
      ],
      arcs: [{ center: [100, 0], radius: 90, start: 0, end: 90 }],
    });
    const outRight = openingSymbol(door('out-right'), wall);
    expect(outRight.lines).toEqual([
      [
        [190, 0],
        [190, -90],
      ],
    ]);
    expect(outRight.arcs).toEqual([{ center: [190, 0], radius: 90, start: 180, end: 270 }]);
    // Mirrored cases turn the other way: the arc still runs anticlockwise from start to end.
    expect(openingSymbol(door('in-right'), wall).arcs[0]).toMatchObject({ start: 90, end: 180 });
    expect(openingSymbol(door('out-left'), wall).arcs[0]).toMatchObject({ start: 270, end: 0 });
  });

  it('draws windows with three lines, ventilators with two, plain openings with one', () => {
    const base = { id: 'N1', wall: 'W1', offset: 100, width: 120 };
    const lines = (o: Opening) => openingSymbol(o, wall).lines.map(([a]) => a[1]);
    expect(lines({ ...base, kind: 'window', sill: 90 })).toEqual([-5.75, 0, 5.75]);
    expect(lines({ ...base, kind: 'ventilator', sill: 210 })).toEqual([-4.6, 4.6]);
    expect(lines({ ...base, kind: 'opening' })).toEqual([0]);
  });

  it('draws stair treads every 25 cm across the longer side', () => {
    const s = stairSymbol({
      id: 'S1',
      polygon: [
        [0, 0],
        [100, 0],
        [100, 300],
        [0, 300],
      ],
      direction: 'up',
    });
    expect(s.treads).toHaveLength(11);
    expect(s.treads[0]).toEqual([
      [0, 25],
      [100, 25],
    ]);
    expect([s.label, s.labelAt]).toEqual(['UP', [50, 150]]);
  });
});

describe('planDrawing', () => {
  it('gives a host everything to draw, with bounds around plot, walls and door swings', () => {
    const plan = Plan.parse(sample);
    const checked = validatePlan(plan);
    const d = planDrawing(plan, checked.rooms);
    expect(d.walls.length).toBeGreaterThan(0);
    expect(d.openings.map((o) => o.kind).sort()).toEqual(['door', 'window']);
    expect(d.rooms).toMatchObject([{ id: 'R1', name: 'Living', labelAt: [200, 150] }]);
    expect(d.rooms[0]!.area_m2).toBe(checked.rooms[0]!.area_m2);
    expect(d.bounds).toEqual({ minX: -111.5, minY: -111.5, maxX: 611.5, maxY: 511.5 });
  });

  it('keeps an unenclosed room with its label but no outline or area', () => {
    const plan = Plan.parse(sample);
    const d = planDrawing(plan, []);
    expect(d.rooms[0]).toEqual({
      id: 'R1',
      name: 'Living',
      outer: [],
      holes: [],
      labelAt: [200, 150],
    });
  });
});

describe('gridPlan', () => {
  it('makes a valid plan whose rooms are all enclosed and which exports cleanly', () => {
    const plan = gridPlan({ cols: 4, rows: 3 });
    const checked = validatePlan(plan);
    expect(checked.ok).toBe(true);
    expect(checked.issues.filter((i) => i.severity !== 'info')).toEqual([]);
    expect(checked.rooms).toHaveLength(12);
    // Corner rooms lose the most to walls: 312.75 × 282.75 cm clear.
    expect(Math.min(...checked.rooms.map((r) => r.area_m2))).toBe(8.84);
    expect(exportDxf(plan).ok).toBe(true);
  });
});
