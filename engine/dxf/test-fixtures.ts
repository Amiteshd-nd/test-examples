import { writeDxfAscii, type DxfTag } from './tags.ts';

// Synthetic drafting-style DXF drawings for tests and the bulk-import demo, until the founder's
// sample drawings arrive. The plan is sample B (engine/samples/1.2.0): a 600 × 400 cm shell with
// 23 cm walls, an 11.5 cm wall at x = 300 and one at y = 250 east of it. Walls are drawn the way
// draftsmen do: two face lines, broken at T-junctions and openings, with jamb lines; doors are
// blocks, windows and ventilators are lines on their own layers; rooms are text labels. Plus the
// usual clutter: furniture, a dimension, a hatch, notes, a title.

export interface FixtureOptions {
  unit: 'mm' | 'in';
  /** Write `$INSUNITS` in the header. */
  header: boolean;
  /** Draw wall faces as LWPOLYLINEs instead of LINEs. */
  polylines: boolean;
  /** Put the whole plan in one block and insert it (a common drafting habit). */
  wrapInBlock: boolean;
}

type P = [number, number];

export function oneBhkDxf(opts: FixtureOptions): string {
  const k = opts.unit === 'mm' ? 10 : 1 / 2.54;
  const u = (p: P): P => [p[0] * k, p[1] * k];
  const xy = (p: P, base = 10): DxfTag[] => [
    { code: base, value: u(p)[0] },
    { code: base + 10, value: u(p)[1] },
  ];
  const ent = (type: string, layer: string, ...rest: DxfTag[]): DxfTag[] => [
    { code: 0, value: type },
    { code: 8, value: layer },
    ...rest,
  ];
  const line = (layer: string, a: P, b: P) =>
    opts.polylines
      ? ent('LWPOLYLINE', layer, { code: 90, value: 2 }, { code: 70, value: 0 }, ...xy(a), ...xy(b))
      : ent('LINE', layer, ...xy(a), ...xy(b, 11));
  const rect = (layer: string, a: P, b: P) =>
    ent(
      'LWPOLYLINE',
      layer,
      { code: 90, value: 4 },
      { code: 70, value: 1 },
      ...xy(a),
      ...xy([b[0], a[1]]),
      ...xy(b),
      ...xy([a[0], b[1]]),
    );
  const text = (layer: string, at: P, s: string) =>
    ent(
      'TEXT',
      layer,
      ...xy(at),
      { code: 40, value: 15 * k },
      { code: 1, value: s },
      { code: 72, value: 1 },
      ...xy(at, 11),
      { code: 73, value: 2 },
    );

  // Wall faces (cm). Openings: D3 bottom x 100–190, window left y 150–300, ventilator right
  // y 300–360, D1 on the x = 300 wall y 100–190, D2 on the y = 250 wall x 340–415.
  const faces: [P, P][] = [
    [
      [-11.5, -11.5],
      [100, -11.5],
    ],
    [
      [190, -11.5],
      [611.5, -11.5],
    ],
    [
      [11.5, 11.5],
      [100, 11.5],
    ],
    [
      [190, 11.5],
      [294.25, 11.5],
    ],
    [
      [305.75, 11.5],
      [588.5, 11.5],
    ],
    [
      [611.5, -11.5],
      [611.5, 300],
    ],
    [
      [611.5, 360],
      [611.5, 411.5],
    ],
    [
      [588.5, 11.5],
      [588.5, 244.25],
    ],
    [
      [588.5, 255.75],
      [588.5, 300],
    ],
    [
      [588.5, 360],
      [588.5, 388.5],
    ],
    [
      [-11.5, 411.5],
      [611.5, 411.5],
    ],
    [
      [11.5, 388.5],
      [294.25, 388.5],
    ],
    [
      [305.75, 388.5],
      [588.5, 388.5],
    ],
    [
      [-11.5, -11.5],
      [-11.5, 150],
    ],
    [
      [-11.5, 300],
      [-11.5, 411.5],
    ],
    [
      [11.5, 11.5],
      [11.5, 150],
    ],
    [
      [11.5, 300],
      [11.5, 388.5],
    ],
    [
      [294.25, 11.5],
      [294.25, 100],
    ],
    [
      [294.25, 190],
      [294.25, 388.5],
    ],
    [
      [305.75, 11.5],
      [305.75, 100],
    ],
    [
      [305.75, 190],
      [305.75, 244.25],
    ],
    [
      [305.75, 255.75],
      [305.75, 388.5],
    ],
    [
      [305.75, 244.25],
      [340, 244.25],
    ],
    [
      [415, 244.25],
      [588.5, 244.25],
    ],
    [
      [305.75, 255.75],
      [340, 255.75],
    ],
    [
      [415, 255.75],
      [588.5, 255.75],
    ],
  ];
  const jambs: [P, P][] = [
    [
      [100, -11.5],
      [100, 11.5],
    ],
    [
      [190, -11.5],
      [190, 11.5],
    ],
    [
      [-11.5, 150],
      [11.5, 150],
    ],
    [
      [-11.5, 300],
      [11.5, 300],
    ],
    [
      [588.5, 300],
      [611.5, 300],
    ],
    [
      [588.5, 360],
      [611.5, 360],
    ],
    [
      [294.25, 100],
      [305.75, 100],
    ],
    [
      [294.25, 190],
      [305.75, 190],
    ],
    [
      [340, 244.25],
      [340, 255.75],
    ],
    [
      [415, 244.25],
      [415, 255.75],
    ],
  ];

  const body: DxfTag[] = [
    ...faces.flatMap(([a, b]) => line('A-WALL', a, b)),
    ...jambs.flatMap(([a, b]) => line('A-WALL', a, b)),
    // Doors: a 90 cm door block scaled to each opening, rotated to its wall.
    ...door([100, -11.5], 0, 90 / 90),
    ...door([294.25, 100], 90, 90 / 90),
    ...door([340, 255.75], 0, 75 / 90),
    // Window: three lines across the opening in the left wall.
    ...[-6, 0, 6].flatMap((dx) => line('A-GLAZ', [dx, 150], [dx, 300])),
    // Ventilator: two lines in the right wall.
    ...[-4, 4].flatMap((dx) => line('VENTILATOR', [600 + dx, 300], [600 + dx, 360])),
    ...text('A-AREA-IDEN', [150, 210], 'BED ROOM'),
    ...text('A-AREA-IDEN', [150, 185], '10\'0" X 12\'4"'),
    ...ent(
      'MTEXT',
      'A-AREA-IDEN',
      ...xy([447, 128]),
      { code: 40, value: 12 * k },
      { code: 71, value: 5 },
      { code: 1, value: 'KITCHEN\\P9\'3" X 7\'8"' },
    ),
    ...text('TEXT', [447, 322], 'TOILET / W.C.'),
    // Stair outside the east wall: treads and an UP label.
    ...Array.from({ length: 15 }, (_, i) =>
      line('STAIR', [620, 20 + i * 20], [700, 20 + i * 20]),
    ).flat(),
    ...line('STAIR', [620, 20], [620, 300]),
    ...line('STAIR', [700, 20], [700, 300]),
    ...text('STAIR', [660, 160], 'UP'),
    ...[
      [0, 0],
      [600, 0],
      [600, 400],
      [0, 400],
    ].flatMap(([x, y]) => rect('COLUMN', [x! - 11.5, y! - 11.5], [x! + 11.5, y! + 11.5])),
    ...rect('PLOT', [-150, -150], [750, 550]),
    ...ent('INSERT', 'FURNITURE', { code: 2, value: 'BED' }, ...xy([60, 250])),
    ...ent('DIMENSION', 'DIM', ...xy([0, -60])),
    ...ent('HATCH', 'A-WALL-HATCH', { code: 2, value: 'ANSI31' }),
    ...text('NOTES', [300, -100], 'NOTE: ALL DIMENSIONS IN MM. TOILET FLOOR SUNKEN BY 300.'),
    ...text('A-ANNO-TITL', [300, -130], 'GROUND FLOOR PLAN'),
  ];

  function door(at: P, rotation: number, scale: number): DxfTag[] {
    return ent(
      'INSERT',
      'A-DOOR',
      { code: 2, value: 'DOOR-900' },
      ...xy(at),
      { code: 41, value: scale },
      { code: 42, value: scale },
      { code: 50, value: rotation },
    );
  }

  const block = (name: string, entities: DxfTag[]): DxfTag[] => [
    { code: 0, value: 'BLOCK' },
    { code: 8, value: '0' },
    { code: 2, value: name },
    { code: 70, value: 0 },
    ...xy([0, 0]),
    ...entities,
    { code: 0, value: 'ENDBLK' },
  ];
  const doorBlock = [
    ...ent('LINE', '0', ...xy([0, 0]), ...xy([0, 90], 11)),
    ...ent(
      'ARC',
      '0',
      ...xy([0, 0]),
      { code: 40, value: 90 * k },
      { code: 50, value: 0 },
      { code: 51, value: 90 },
    ),
  ];
  const bedBlock = [...rect('0', [0, 0], [180, 200])];
  const layers = [
    'A-WALL',
    'A-DOOR',
    'A-GLAZ',
    'VENTILATOR',
    'A-AREA-IDEN',
    'TEXT',
    'STAIR',
    'COLUMN',
    'PLOT',
    'FURNITURE',
    'DIM',
    'A-WALL-HATCH',
    'NOTES',
    'A-ANNO-TITL',
  ];

  const tags: DxfTag[] = [
    { code: 0, value: 'SECTION' },
    { code: 2, value: 'HEADER' },
    { code: 9, value: '$ACADVER' },
    { code: 1, value: 'AC1015' },
    ...(opts.header
      ? [
          { code: 9, value: '$INSUNITS' },
          { code: 70, value: opts.unit === 'mm' ? 4 : 1 },
        ]
      : []),
    { code: 0, value: 'ENDSEC' },
    { code: 0, value: 'SECTION' },
    { code: 2, value: 'TABLES' },
    { code: 0, value: 'TABLE' },
    { code: 2, value: 'LAYER' },
    ...layers.flatMap((name): DxfTag[] => [
      { code: 0, value: 'LAYER' },
      { code: 2, value: name },
      { code: 70, value: 0 },
      { code: 62, value: 7 },
    ]),
    { code: 0, value: 'ENDTAB' },
    { code: 0, value: 'ENDSEC' },
    { code: 0, value: 'SECTION' },
    { code: 2, value: 'BLOCKS' },
    ...block('DOOR-900', doorBlock),
    ...block('BED', bedBlock),
    ...(opts.wrapInBlock ? block('PLAN', body) : []),
    { code: 0, value: 'ENDSEC' },
    { code: 0, value: 'SECTION' },
    { code: 2, value: 'ENTITIES' },
    ...(opts.wrapInBlock
      ? ent('INSERT', '0', { code: 2, value: 'PLAN' }, ...xy([1000, 500]))
      : body),
    { code: 0, value: 'ENDSEC' },
    { code: 0, value: 'EOF' },
  ];
  return writeDxfAscii(tags);
}
