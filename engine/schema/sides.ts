import type { Compass } from './primitives.ts';

// Which compass side of a plot is its front, rear, left and right, for setbacks. The front faces
// the road (`facing`); left and right are as seen from the road, looking at the plot.
// Diagonal facings have no single side and return null.

export type Side = 'north' | 'south' | 'east' | 'west';

export function setbackSides(
  facing: Compass,
): Record<'front' | 'rear' | 'left' | 'right', Side> | null {
  switch (facing) {
    case 'north':
      return { front: 'north', rear: 'south', left: 'east', right: 'west' };
    case 'south':
      return { front: 'south', rear: 'north', left: 'west', right: 'east' };
    case 'east':
      return { front: 'east', rear: 'west', left: 'south', right: 'north' };
    case 'west':
      return { front: 'west', rear: 'east', left: 'north', right: 'south' };
    default:
      return null;
  }
}
