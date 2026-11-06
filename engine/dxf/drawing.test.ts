import { describe, expect, it } from 'vitest';
import { plainText, readDrawing } from './drawing.ts';
import type { DxfTag } from './tags.ts';

const T = (code: number, value: string | number): DxfTag => ({ code, value });
const section = (name: string, tags: DxfTag[]) => [
  T(0, 'SECTION'),
  T(2, name),
  ...tags,
  T(0, 'ENDSEC'),
];
const drawing = (entities: DxfTag[], blocks: DxfTag[] = [], layers: DxfTag[] = []) =>
  readDrawing([
    ...section('HEADER', [T(9, '$INSUNITS'), T(70, 4)]),
    ...section('TABLES', [T(0, 'TABLE'), T(2, 'LAYER'), ...layers, T(0, 'ENDTAB')]),
    ...section('BLOCKS', blocks),
    ...section('ENTITIES', entities),
    T(0, 'EOF'),
  ]);
const round = (n: number) => Math.round(n * 1000) / 1000;
const r2 = ([x, y]: [number, number]) => [round(x), round(y)];

describe('readDrawing', () => {
  it('reads the unit, lines and polylines', () => {
    const d = drawing([
      T(0, 'LINE'),
      T(8, 'A'),
      T(10, 0),
      T(20, 0),
      T(11, 10),
      T(21, 0),
      T(0, 'LWPOLYLINE'),
      T(8, 'B'),
      T(90, 3),
      T(70, 1),
      T(10, 0),
      T(20, 0),
      T(10, 10),
      T(20, 0),
      T(10, 10),
      T(20, 10),
    ]);
    expect(d.insunits).toBe(4);
    expect(d.segments).toHaveLength(4);
    expect(d.shapes).toEqual([
      {
        layer: 'B',
        points: [
          [0, 0],
          [10, 0],
          [10, 10],
        ],
      },
    ]);
  });

  it('flattens bulges and arcs into curved pieces', () => {
    const d = drawing([
      T(0, 'LWPOLYLINE'),
      T(8, 'A'),
      T(90, 2),
      T(70, 0),
      T(10, 0),
      T(20, 0),
      T(42, 1),
      T(10, 10),
      T(20, 0),
      T(0, 'ARC'),
      T(8, 'A'),
      T(10, 0),
      T(20, 0),
      T(40, 5),
      T(50, 0),
      T(51, 90),
    ]);
    expect(d.segments.every((s) => s.curved)).toBe(true);
    // A bulge of 1 is a half circle; its middle point is 5 below the chord's midpoint (clockwise from the left).
    const pts = d.segments.slice(0, 18).flatMap((s) => [s.a, s.b]);
    expect(Math.min(...pts.map((p) => p[1]))).toBeCloseTo(-5, 1);
  });

  it('places block contents with rotation, scale and the base point', () => {
    const blocks = [
      T(0, 'BLOCK'),
      T(8, '0'),
      T(2, 'B1'),
      T(10, 1),
      T(20, 0),
      T(0, 'LINE'),
      T(8, '0'),
      T(10, 1),
      T(20, 0),
      T(11, 2),
      T(21, 0),
      T(0, 'ENDBLK'),
    ];
    const d = drawing(
      [
        T(0, 'INSERT'),
        T(8, 'DOORS'),
        T(2, 'B1'),
        T(10, 10),
        T(20, 0),
        T(41, 2),
        T(42, 2),
        T(50, 90),
      ],
      blocks,
    );
    expect(d.segments.map((s) => [r2(s.a), r2(s.b), s.layer])).toEqual([
      [[10, 0], [10, 2], 'DOORS'],
    ]);
    expect(d.inserts[0]).toMatchObject({
      block: 'B1',
      layer: 'DOORS',
      bounds: { min: [10, 0], max: [10, 2] },
    });
  });

  it('mirrors entities whose extrusion points down', () => {
    const d = drawing([
      T(0, 'LWPOLYLINE'),
      T(8, 'A'),
      T(90, 2),
      T(70, 0),
      T(10, 5),
      T(20, 1),
      T(10, 7),
      T(20, 1),
      T(230, -1),
    ]);
    expect(d.segments.map((s) => [r2(s.a), r2(s.b)])).toEqual([
      [
        [-5, 1],
        [-7, 1],
      ],
    ]);
  });

  it('skips paper space, hidden layers, and counts what it does not read', () => {
    const layers = [
      T(0, 'LAYER'),
      T(2, 'OFF'),
      T(62, -7),
      T(70, 0),
      T(0, 'LAYER'),
      T(2, 'FROZEN'),
      T(62, 7),
      T(70, 1),
    ];
    const d = drawing(
      [
        T(0, 'LINE'),
        T(8, 'A'),
        T(67, 1),
        T(10, 0),
        T(20, 0),
        T(11, 1),
        T(21, 0),
        T(0, 'LINE'),
        T(8, 'OFF'),
        T(10, 0),
        T(20, 0),
        T(11, 1),
        T(21, 0),
        T(0, 'LINE'),
        T(8, 'FROZEN'),
        T(10, 0),
        T(20, 0),
        T(11, 1),
        T(21, 0),
        T(0, 'HATCH'),
        T(8, 'A'),
        T(0, 'INSERT'),
        T(8, 'A'),
        T(2, 'MISSING'),
        T(10, 0),
        T(20, 0),
      ],
      [],
      layers,
    );
    expect(d.segments).toHaveLength(0);
    expect(d.hidden).toBe(2);
    expect(d.ignored).toEqual({ HATCH: 1 });
    expect(d.warnings).toEqual(['Block "MISSING" is used but not defined; it was skipped.']);
  });

  it('reads TEXT and MTEXT with their centre', () => {
    const d = drawing([
      T(0, 'TEXT'),
      T(8, 'L'),
      T(10, 0),
      T(20, 0),
      T(40, 10),
      T(1, 'AB'),
      T(72, 1),
      T(73, 2),
      T(11, 50),
      T(21, 50),
      T(0, 'MTEXT'),
      T(8, 'L'),
      T(10, 100),
      T(20, 100),
      T(40, 10),
      T(71, 5),
      T(3, '{\\fArial|b1;KIT'),
      T(1, 'CHEN}\\P3 X 4'),
    ]);
    expect(d.texts.map((t) => [t.text, r2(t.at)])).toEqual([
      ['AB', [50, 50]],
      ['KITCHEN\n3 X 4', [100, 100]],
    ]);
  });

  it('strips formatting codes', () => {
    expect(plainText('{\\H2.5x;\\C1;BED}\\PROOM %%c12 \\~X')).toBe('BED\nROOM \u00D812 X');
    expect(plainText('%%uTOILET%%u')).toBe('TOILET');
  });
});
