import { firstLevel, gridPlan, planGraph } from '@plancraft/engine';
import { describe, expect, it } from 'vitest';
import { graphShapes, neighbours, zoneWord } from './graph-view.ts';

const plan = gridPlan({ cols: 4, rows: 3, name: 'Grid' });
const graph = planGraph(plan);

describe('Plan Graph in the editor (P3.3)', () => {
  it('lists a room’s neighbours, strongest link first', () => {
    expect(neighbours(graph, 'R6').map((n) => `${n.name} ${n.kind}`)).toEqual([
      'Kitchen 2 door',
      'Kitchen 10 door',
      'Dining 5 wall',
      'Study 7 wall',
      'Living 1 adjacent',
      'Bedroom 3 adjacent',
      'Living 9 adjacent',
      'Bedroom 11 adjacent',
    ]);
    expect(zoneWord('north_east')).toBe('North-east');
    expect(zoneWord('centre')).toBe('Centre');
  });

  it('draws door links through the doorway, other links straight', () => {
    const shapes = graphShapes(graph, firstLevel(plan));
    expect(shapes.nodes).toHaveLength(12);
    expect(shapes.nodes[0]).toMatchObject({ id: 'R1', entrance: true, tag: 'front · W' });
    const door = shapes.edges.find((e) => e.a === 'R1' && e.b === 'R2')!;
    expect(door.kind).toBe('door');
    expect(door.points).toHaveLength(3);
    expect(door.points[1]![0]).toBe(330); // on wall V1
    const corner = shapes.edges.find((e) => e.kind === 'adjacent')!;
    expect(corner.points).toHaveLength(2);
  });
});
