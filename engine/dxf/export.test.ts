import { describe, expect, it } from 'vitest';
import a from '../samples/1.2.0/a-one-room.plan.json' with { type: 'json' };
import b from '../samples/1.2.0/b-1bhk-t-junctions.plan.json' with { type: 'json' };
import c from '../samples/1.2.0/c-l-hall-duct.plan.json' with { type: 'json' };
import d from '../samples/1.2.0/d-open-plan-separator.plan.json' with { type: 'json' };
import { firstLevel, values } from '../schema/collections.ts';
import { Plan } from '../schema/plan.ts';
import { exportDxf } from './export.ts';
import { importDxf } from './import.ts';
import { dxfRecords, dxfSections, parseAsciiText, tagString } from './tags.ts';
import { gridPlan } from '../samples/grid-plan.ts';
import { oneBhkDxf } from './test-fixtures.ts';

const samples = { a, b, c, d };
const r1 = (n: number) => Math.round(n * 10) / 10 + 0;

/** A plan reduced to what a DXF round trip must keep, moved so the plot starts at 0,0. */
function essence(plan: Plan, rooms = importDxfRooms(plan)) {
  const level = firstLevel(plan);
  const ox = Math.min(...plan.plot.polygon.map((p) => p[0]));
  const oy = Math.min(...plan.plot.polygon.map((p) => p[1]));
  const pt = (p: readonly number[]) => `${r1(p[0]! - ox)},${r1(p[1]! - oy)}`;
  const seg = (p: readonly number[], q: readonly number[]) => [pt(p), pt(q)].sort().join(' ');
  const wall = new Map(values(level.walls).map((w) => [w.id, w]));
  return {
    walls: values(level.walls)
      .map((w) => `${seg(w.start, w.end)} t${w.thickness} ${w.type}`)
      .sort(),
    openings: values(level.openings)
      .map((o) => {
        const w = wall.get(o.wall)!;
        const len = Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]);
        const at = (d: number) => [
          w.start[0] + ((w.end[0] - w.start[0]) * d) / len,
          w.start[1] + ((w.end[1] - w.start[1]) * d) / len,
        ];
        return `${o.kind} ${seg(at(o.offset), at(o.offset + o.width))}`;
      })
      .sort(),
    rooms: rooms.sort(),
    separators: values(level.separators)
      .map((x) => seg(x.start, x.end))
      .sort(),
    stairs: values(level.stairs)
      .map((s) => s.polygon.map(pt).sort().join(' '))
      .sort(),
    columns: values(level.columns)
      .map((x) => `${pt(x.at)} ${x.size.join('x')}`)
      .sort(),
    plot: plan.plot.polygon.map(pt).sort(),
  };
}
function importDxfRooms(plan: Plan): string[] {
  return values(firstLevel(plan).rooms).map((r) => `${r.type} ${r.name}`);
}

const layersOf = (dxf: string) => {
  const parsed = parseAsciiText(dxf);
  if (!parsed.ok) throw new Error('unreadable');
  const sections = dxfSections(parsed.tags);
  const tables = dxfRecords(sections.find((s) => s.name === 'TABLES')!.tags);
  const entities = dxfRecords(sections.find((s) => s.name === 'ENTITIES')!.tags);
  const header = sections.find((s) => s.name === 'HEADER')!.tags;
  const units = header[header.findIndex((t) => tagString(t) === '$INSUNITS') + 1]!.value;
  return {
    units,
    layers: tables
      .filter((r) => r.type === 'LAYER')
      .map((r) => tagString(r.tags.find((t) => t.code === 2)!)),
    used: entities.map((r) => `${r.type}@${tagString(r.tags.find((t) => t.code === 8)!)}`),
  };
};

describe('exportDxf', () => {
  it.each(Object.entries(samples))(
    'sample %s exports in mm on the standard layers and reads back whole',
    (_, sample) => {
      const plan = Plan.parse(sample);
      const result = exportDxf(plan);
      expect(result.check.mismatches).toEqual([]);
      expect(result.ok).toBe(true);
      const { units, layers, used } = layersOf(result.dxf);
      expect(units).toBe(4);
      expect(layers).toEqual(
        expect.arrayContaining([
          'A-WALL',
          'A-WALL-INT',
          'A-DOOR',
          'A-GLAZ',
          'A-FLOR-STRS',
          'A-AREA-IDEN',
          'A-ANNO-DIMS',
          'A-ANNO-TEXT',
          'A-SITE-BNDY',
          'A-SITE-SETB',
        ]),
      );
      expect(used.filter((u) => u.startsWith('LWPOLYLINE@A-WALL'))).not.toHaveLength(0);
      const back = importDxf(result.dxf, { units: 'mm' });
      expect(essence(back.plan!)).toEqual(essence(plan));
    },
  );

  it('draws joined walls: one outer outline and one inner outline for a closed room', () => {
    const { used } = layersOf(exportDxf(Plan.parse(a)).dxf);
    expect(used.filter((u) => u === 'LWPOLYLINE@A-WALL')).toHaveLength(2);
  });

  it('round-trips DXF → plan → DXF → plan', () => {
    const first = importDxf(
      oneBhkDxf({ unit: 'mm', header: true, polylines: false, wrapInBlock: false }),
    );
    const exported = exportDxf(first.plan!);
    expect(exported.ok).toBe(true);
    const second = importDxf(exported.dxf, { units: 'mm' });
    expect(essence(second.plan!)).toEqual(essence(first.plan!));
    expect(second.rooms.map((r) => r.area_m2)).toEqual(first.rooms.map((r) => r.area_m2));
  });

  it('refuses a file that lost something, and says what', () => {
    const plan = Plan.parse(b);
    firstLevel(plan).rooms.R9 = {
      id: 'R9',
      type: 'store',
      name: 'Store',
      seed: [800, 800],
      behavior: 'fixed',
      locked: false,
    };
    const result = exportDxf(plan);
    expect(result.ok).toBe(false);
    expect(result.check.mismatches).toEqual(['store rooms: 1 in the plan, 0 in the file.']);
  });
});

describe('large drawings', () => {
  it('round-trips a 120-room grid; more than 20 bedroom labels are recorded as 20 BHK', () => {
    const exported = exportDxf(gridPlan({ cols: 12, rows: 10 }));
    expect(exported.ok).toBe(true);
    const back = importDxf(exported.dxf);
    expect(back.report.status).toBe('success');
    expect(values(firstLevel(back.plan!).rooms)).toHaveLength(120);
    expect(back.plan!.meta.bhk).toBe(20);
    expect(back.report.items).toContainEqual(
      expect.objectContaining({
        outcome: 'note',
        message: '30 bedroom labels found; BHK is recorded as 20, the most a plan can hold.',
      }),
    );
  });
});
