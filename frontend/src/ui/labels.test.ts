import type { Point } from '@plancraft/engine';
import { describe, expect, it } from 'vitest';
import { fitRoomLabel } from './labels.ts';

// A 300 × 300 cm room. `zoom` = screen px per cm; `ui` = Settings → Text size.
const room: Point[] = [
  [0, 0],
  [300, 0],
  [300, 300],
  [0, 300],
];
const at =
  (zoom: number, ui = 1) =>
  (px: number) =>
    (px * ui) / zoom;

describe('room labels that fit their room', () => {
  it('shows name and area when both fit', () => {
    expect(fitRoomLabel('Bedroom 3', '9.01 m²', room, at(0.5))).toEqual({
      name: 'Bedroom 3',
      area: '9.01 m²',
    });
  });

  it('drops the name first, then the area, as the room gets smaller on screen', () => {
    expect(fitRoomLabel('Master bedroom 6', '9.19 m²', room, at(0.3))).toEqual({
      name: null,
      area: '9.19 m²',
    });
    expect(fitRoomLabel('Bedroom 3', '9.01 m²', room, at(0.1))).toEqual({ name: null, area: null });
  });

  it('a larger text size needs more room: the same zoom can drop the name', () => {
    expect(fitRoomLabel('Bedroom 3', '9.01 m²', room, at(0.3)).name).toBe('Bedroom 3');
    expect(fitRoomLabel('Bedroom 3', '9.01 m²', room, at(0.3, 1.5)).name).toBeNull();
  });

  it('always labels a room that walls do not enclose (no outline to measure)', () => {
    expect(fitRoomLabel('Hall', 'not enclosed', [], at(0.01))).toEqual({
      name: 'Hall',
      area: 'not enclosed',
    });
  });
});
