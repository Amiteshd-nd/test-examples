import { describe, expect, it } from 'vitest';
import { MAX_SCALE, fitView, panBy, toPlan, toScreen, viewBox, zoomAt } from './view.ts';

const size = { w: 800, h: 600 };

describe('canvas view', () => {
  it('fits a plan into the free area and maps screen to plan and back', () => {
    const bounds = { minX: 0, minY: 0, maxX: 900, maxY: 700 };
    const v = fitView(bounds, size, { top: 0, right: 0, bottom: 72, left: 0 });
    // Height decides: (600 − 72) / (700 + 80).
    expect(v.scale).toBeCloseTo(528 / 780, 9);
    // The plan's centre sits in the middle of the area above the toolbar.
    expect(toScreen(v, size, [450, 350])).toEqual([400, 264]);
    // North is up: a point further north is higher on screen.
    expect(toScreen(v, size, [450, 400])[1]).toBeLessThan(264);
    const p = toPlan(v, size, [123, 456]);
    const back = toScreen(v, size, p);
    expect(back[0]).toBeCloseTo(123, 9);
    expect(back[1]).toBeCloseTo(456, 9);
    expect(viewBox({ cx: 100, cy: 50, scale: 2 }, size)).toBe('-100 -200 400 300');
  });

  it('pans with the cursor and zooms about it', () => {
    const v = { cx: 0, cy: 0, scale: 1 };
    expect(panBy(v, 100, 50)).toEqual({ cx: -100, cy: 50, scale: 1 });
    const at: [number, number] = [600, 100];
    const under = toPlan(v, size, at);
    const z = zoomAt(v, size, at, 2.5);
    expect(z.scale).toBe(2.5);
    const still = toPlan(z, size, at);
    expect(still[0]).toBeCloseTo(under[0], 9);
    expect(still[1]).toBeCloseTo(under[1], 9);
    expect(zoomAt(v, size, at, 1e6).scale).toBe(MAX_SCALE);
  });
});
