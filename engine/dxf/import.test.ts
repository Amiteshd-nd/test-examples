import { describe, expect, it } from 'vitest';
import sampleB from '../samples/1.2.0/b-1bhk-t-junctions.plan.json' with { type: 'json' };
import { renderPlanSvg } from '../render/svg.ts';
import { importDxf, type ImportOptions } from './import.ts';
import { DEFAULT_IMPORT_MAPPING } from './mapping.ts';
import { reportToMarkdown } from './report.ts';
import { oneBhkDxf, type FixtureOptions } from './test-fixtures.ts';

const MM: FixtureOptions = { unit: 'mm', header: true, polylines: false, wrapInBlock: false };
const INCHES: FixtureOptions = { unit: 'in', header: false, polylines: true, wrapInBlock: true };
const bytes = (s: string) => new TextEncoder().encode(s);
const run = (dxf: string, options: ImportOptions = {}) =>
  importDxf(bytes(dxf), { name: 'test', ...options });

/** Sample B's walls moved by the plot origin (-150, -150), as [start, end, thickness, type]. */
const expectedWalls = Object.values(sampleB.levels.L0.walls)
  .map((w) => [
    [w.start[0]! + 150, w.start[1]! + 150],
    [w.end[0]! + 150, w.end[1]! + 150],
    w.thickness,
    w.type,
  ])
  .map(([a, b, t, type]) => [[a, b].sort((p, q) => String(p).localeCompare(String(q))), t, type])
  .sort((p, q) => String(p).localeCompare(String(q)));
const wallsOf = (r: ReturnType<typeof run>) =>
  Object.values(r.plan!.levels.L0!.walls)
    .map((w) => [
      [w.start, w.end].sort((p, q) => String(p).localeCompare(String(q))),
      w.thickness,
      w.type,
    ])
    .sort((p, q) => String(p).localeCompare(String(q)));

describe('importDxf on drafting-style drawings (sample B redrawn)', () => {
  it.each([
    ['millimetres, lines, unit in header', MM, 'measured'],
    ['inches, polylines, all in one block, no unit in header', INCHES, 'inferred'],
  ])('%s', (_, fixture, unitProvenance) => {
    const r = run(oneBhkDxf(fixture));
    expect(r.report.status).toBe('success');
    expect(r.report.units).toMatchObject({ unit: fixture.unit, provenance: unitProvenance });
    expect(wallsOf(r)).toEqual(expectedWalls);
    expect(r.report.counts).toEqual({
      walls: 6,
      doors: 3,
      windows: 1,
      ventilators: 1,
      openings: 0,
      rooms: 3,
      stairs: 1,
      columns: 4,
    });
    expect(r.rooms.map((x) => x.area_m2)).toEqual([10.66, 6.58, 3.75]);
    expect(Object.values(r.plan!.levels.L0!.rooms).map((x) => x.type)).toEqual([
      'bedroom',
      'kitchen',
      'toilet',
    ]);
    expect(r.plan!.plot.polygon).toEqual([
      [0, 0],
      [900, 0],
      [900, 700],
      [0, 700],
    ]);
    expect(r.plan!.levels.L0!.stairs.S1).toMatchObject({ direction: 'up' });
    expect(r.report.issues).toEqual([]);
  });

  it('hosts each opening on its wall at the right place and marks defaults as assumed', () => {
    const plan = run(oneBhkDxf(MM)).plan!;
    const wallAt = (id: string) => plan.levels.L0!.walls[id]!;
    const openings = Object.values(plan.levels.L0!.openings).map((o) => {
      const w = wallAt(o.wall);
      const dir = [Math.sign(w.end[0] - w.start[0]), Math.sign(w.end[1] - w.start[1])];
      const from = [w.start[0] + dir[0]! * o.offset, w.start[1] + dir[1]! * o.offset];
      return [o.kind, from, o.width];
    });
    expect(openings).toEqual(
      expect.arrayContaining([
        ['door', [250, 150], 90],
        ['door', [450, 250], 90],
        ['door', [490, 400], 75],
        ['window', [150, 300], 150],
        ['ventilator', [750, 450], 60],
      ]),
    );
    const door = Object.values(plan.levels.L0!.openings).find((o) => o.kind === 'door')!;
    expect(door.provenance?.swing?.provenance).toBe('assumed');
    expect(plan.meta.provenance?.facing?.provenance).toBe('assumed');
    expect(plan.meta.bhk).toBe(1);
  });

  it('says plainly when a file is not a drawing', () => {
    const r = importDxf(bytes('hello\nworld\n'));
    expect(r.plan).toBeNull();
    expect(r.report.status).toBe('failed');
    expect(r.report.items.at(-1)!.message).toMatch(/damaged: line 1/);
  });

  it('lists the layers when it finds no walls', () => {
    const r = run(
      '0\nSECTION\n2\nENTITIES\n0\nLINE\n8\nSKETCH\n10\n0\n20\n0\n11\n5\n21\n5\n0\nENDSEC\n0\nEOF\n',
    );
    expect(r.report.status).toBe('failed');
    expect(r.report.items.at(-1)!.message).toMatch(/No walls found.*Layers in this file: SKETCH/);
  });

  it('finds walls on an unknown layer, and uses a custom mapping when given one', () => {
    const dxf = oneBhkDxf(MM).replaceAll('\r\nA-WALL\r\n', '\r\nMURO\r\n');
    const guessed = run(dxf);
    expect(guessed.report.counts.walls).toBe(6);
    expect(guessed.report.items).toContainEqual(
      expect.objectContaining({ outcome: 'guessed', topic: 'walls' }),
    );
    const mapping = {
      ...DEFAULT_IMPORT_MAPPING,
      layers: { ...DEFAULT_IMPORT_MAPPING.layers, walls: ['MURO'] },
    };
    const mapped = run(dxf, { mapping });
    expect(mapped.report.counts.walls).toBe(6);
    expect(mapped.report.items.some((i) => i.outcome === 'guessed' && i.topic === 'walls')).toBe(
      false,
    );
  });

  it('reports a room label it does not know, and the room it could not import', () => {
    const dxf = oneBhkDxf(MM)
      .replace('\r\nTOILET / W.C.\r\n', '\r\nGYM\r\n')
      .replaceAll('  8\r\nTEXT\r\n', '  8\r\nA-AREA-IDEN\r\n');
    const r = run(dxf);
    expect(r.report.status).toBe('partial');
    expect(r.report.items).toContainEqual(
      expect.objectContaining({
        outcome: 'failed',
        message: expect.stringContaining('"GYM" is not in the mapping'),
      }),
    );
    expect(r.report.items).toContainEqual(
      expect.objectContaining({
        outcome: 'failed',
        message: expect.stringContaining('1 enclosed area'),
      }),
    );
    expect(r.report.counts.rooms).toBe(2);
  });

  it('writes a readable report and a preview', () => {
    const r = run(oneBhkDxf(MM));
    const md = reportToMarkdown(r.report);
    expect(md).toContain('**Converted.**');
    expect(md).toContain('## Guessed (check these)');
    const svg = renderPlanSvg(r.plan!, { rooms: r.rooms, underlay: r.underlay, title: 'test' });
    expect(svg.match(/<title>W\d+ /g)).toHaveLength(6);
    expect(svg).toContain('10.66 m²');
  });
});
