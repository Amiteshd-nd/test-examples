import { describe, expect, it } from 'vitest';
import a from '../samples/1.2.0/a-one-room.plan.json' with { type: 'json' };
import b from '../samples/1.2.0/b-1bhk-t-junctions.plan.json' with { type: 'json' };
import c from '../samples/1.2.0/c-l-hall-duct.plan.json' with { type: 'json' };
import { importDxf } from '../dxf/import.ts';
import { oneBhkDxf } from '../dxf/test-fixtures.ts';
import { Plan } from '../schema/plan.ts';
import { autoTag } from './tags.ts';

describe('autoTag', () => {
  it('measures plot, built-up and carpet areas (hand-checked)', () => {
    // A: 400 × 300 walls, 23 cm → outer face 423 × 323 cm; room 10.44 m².
    expect(autoTag(Plan.parse(a))).toMatchObject({
      plot_size_m: '6.00 × 7.00 m', // facing east: width runs along the road (north–south)
      plot_area_m2: { value: 42, provenance: 'measured' },
      built_up_m2: { value: 13.66, provenance: 'inferred' },
      carpet_m2: { value: 10.44 },
      facing: { value: 'east', provenance: 'measured' },
    });
    expect(autoTag(Plan.parse(b))).toMatchObject({
      built_up_m2: { value: 26.35 },
      carpet_m2: { value: 20.99 },
      bhk: { value: 1 },
    });
    // C: the duct inside the hall is not counted twice.
    expect(autoTag(Plan.parse(c)).built_up_m2.value).toBe(39.15);
  });

  it('gives plot sizes in feet for Indian plot sizes', () => {
    const plan = Plan.parse(b);
    plan.meta.facing = 'north';
    plan.plot.polygon = [
      [0, 0],
      [914.4, 0],
      [914.4, 1219.2],
      [0, 1219.2],
    ];
    expect(autoTag(plan)).toMatchObject({
      plot_size_ft: '30 × 40 ft',
      plot_size_m: '9.14 × 12.19 m',
    });
  });

  it('places rooms in plot zones and notes usual Vastu placements, marked as assumed', () => {
    const plan = Plan.parse(b);
    plan.plot.polygon = [
      [0, 0],
      [620, 0],
      [620, 600],
      [0, 600],
    ]; // kitchen centre (447, 128): east third, south third
    const tags = autoTag(plan);
    expect(tags.zones.provenance).toBe('assumed');
    expect(tags.zones.value.kitchen).toBe('south_east');
    expect(tags.vastu_notes).toContain('Kitchen in the south-east: a usual Vastu placement.');
  });

  it('carries "assumed" through from an imported plan', () => {
    const plan = importDxf(
      oneBhkDxf({ unit: 'mm', header: true, polylines: false, wrapInBlock: false }),
    ).plan!;
    const tags = autoTag(plan);
    expect(tags.facing.provenance).toBe('assumed');
    expect(tags.plot_width_cm.provenance).toBe('assumed'); // width vs depth depends on facing
    expect(tags.bhk).toMatchObject({ value: 1, provenance: 'inferred' });
  });
});
