import { describe, expect, it } from 'vitest';
import { gridPlan } from '../samples/grid-plan.ts';
import { firstLevel } from '../schema/collections.ts';
import type { Plan } from '../schema/plan.ts';
import { validatePlan } from '../validate/validate.ts';
import { planDrawing } from './drawing.ts';
import { buildPlanIndex, hitTest, snapPoint, type SnapKind } from './pick.ts';

// A 2 × 2 grid: rooms 330 × 300 cm between centrelines, external walls 23 cm, internal 11.5 cm.
// Wall H1 runs along y = 300 with door D3 at x 50–140; columns at every crossing.
function setup(plan: Plan = gridPlan({ cols: 2, rows: 2 })) {
  const drawing = planDrawing(plan, validatePlan(plan).rooms);
  return buildPlanIndex(firstLevel(plan), drawing);
}
const ALL: SnapKind[] = ['endpoint', 'midpoint', 'perpendicular', 'grid'];

describe('hitTest', () => {
  const index = setup();
  it('picks the smallest thing under the cursor', () => {
    expect(hitTest(index, [165, 150], 2)).toEqual({ kind: 'room', id: 'R1' });
    expect(hitTest(index, [495, 450], 2)).toEqual({ kind: 'room', id: 'R4' });
    expect(hitTest(index, [95, 300], 2)).toEqual({ kind: 'opening', id: 'D3' });
    expect(hitTest(index, [200, 302], 2)).toEqual({ kind: 'wall', id: 'H1' });
    expect(hitTest(index, [330, 0], 2)).toEqual({ kind: 'column', id: 'C2' });
  });

  it('reaches a wall from just outside it, but not a room', () => {
    // H1 is 11.5 cm thick: its face is at y = 305.75, 3.25 cm from the cursor.
    expect(hitTest(index, [200, 309], 2)).toEqual({ kind: 'room', id: 'R3' });
    expect(hitTest(index, [200, 309], 4)).toEqual({ kind: 'wall', id: 'H1' });
    expect(hitTest(index, [-50, -50], 2)).toBeNull();
  });
});

describe('snapPoint', () => {
  const index = setup();
  it('lands on wall ends and midpoints, nearest first', () => {
    expect(snapPoint(index, [3, -2], { tolerance: 8, snaps: ALL })).toMatchObject({
      point: [0, 0],
      kind: 'endpoint',
    });
    // The outside corner of the external walls.
    expect(snapPoint(index, [-9, -13], { tolerance: 8, snaps: ALL })).toMatchObject({
      point: [-11.5, -11.5],
      kind: 'endpoint',
    });
    // Centre of the 660 cm wall H1.
    expect(snapPoint(index, [328, 302], { tolerance: 8, snaps: ['midpoint'] })).toMatchObject({
      point: [330, 300],
      kind: 'midpoint',
    });
    // Centre of door D3 on H1.
    expect(snapPoint(index, [97, 299], { tolerance: 4, snaps: ['midpoint'] })).toEqual({
      point: [95, 300],
      kind: 'midpoint',
      ref: 'D3',
    });
  });

  it('drops a perpendicular from the point a line starts at', () => {
    expect(
      snapPoint(index, [212, 299], { tolerance: 6, snaps: ['perpendicular'], from: [210, 150] }),
    ).toEqual({ point: [210, 300], kind: 'perpendicular', ref: 'H1' });
    // Nearer the wall's face, the foot lands on the face (y = 294.25, rounded to 1 mm).
    expect(
      snapPoint(index, [212, 296], { tolerance: 6, snaps: ['perpendicular'], from: [210, 150] }),
    ).toEqual({ point: [210, 294.3], kind: 'perpendicular' });
    // Without a start point there is nothing to be perpendicular to.
    expect(snapPoint(index, [212, 297], { tolerance: 6, snaps: ['perpendicular'] }).kind).toBe(
      'none',
    );
  });

  it('falls back to the grid, then to the cursor rounded to 1 mm', () => {
    expect(snapPoint(index, [212.3, 151.7], { tolerance: 4, snaps: ALL, grid: 10 })).toEqual({
      point: [210, 150],
      kind: 'grid',
    });
    expect(snapPoint(index, [212.34, 151.77], { tolerance: 4, snaps: [] })).toEqual({
      point: [212.3, 151.8],
      kind: 'none',
    });
  });

  it('indexes a large plan and still answers from the neighbourhood only', () => {
    const big = setup(gridPlan({ cols: 12, rows: 10 }));
    expect(big.picks.size).toBeGreaterThan(120 + 23 + 143);
    expect(hitTest(big, [3300 + 165, 2700 + 150], 2)).toEqual({ kind: 'room', id: 'R119' });
    expect(snapPoint(big, [3961, 3001], { tolerance: 5, snaps: ['endpoint'] }).point).toEqual([
      3960, 3000,
    ]);
  });
});
