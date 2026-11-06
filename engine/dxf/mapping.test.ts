import { describe, expect, it } from 'vitest';
import defaults from './import-mapping.default.json' with { type: 'json' };
import {
  DEFAULT_IMPORT_MAPPING,
  globMatch,
  ImportMapping,
  layerRole,
  matchRoomLabel,
  normalizeLabel,
} from './mapping.ts';

const m = DEFAULT_IMPORT_MAPPING;
const typeOf = (label: string) => matchRoomLabel(m, label)?.type ?? null;

describe('import mapping', () => {
  it('the default mapping file is valid and covers every room type', () => {
    expect(ImportMapping.safeParse(defaults).success).toBe(true);
    expect(Object.keys(m.room_types)).toHaveLength(25);
  });

  it('matches layer patterns without regard to case', () => {
    expect(globMatch('A-WALL-*', 'a-wall-ext')).toBe(true);
    expect(globMatch('D?', 'D1')).toBe(true);
    expect(globMatch('D?', 'DIM')).toBe(false);
    expect(globMatch('*VENT*', 'ventilator')).toBe(true);
    expect(globMatch('A.WALL', 'AXWALL')).toBe(false);
  });

  it('gives layers a role, with "ignore" first', () => {
    expect(layerRole(m, 'A-WALL')).toBe('walls');
    expect(layerRole(m, 'WALL-HATCH')).toBe('ignore');
    expect(layerRole(m, 'A-GLAZ')).toBe('windows');
    expect(layerRole(m, 'FURNITURE')).toBe('ignore');
    expect(layerRole(m, 'MY-LAYER')).toBeNull();
  });

  it('reads Indian room labels', () => {
    expect(typeOf('BED ROOM-1')).toBe('bedroom');
    expect(typeOf('M. BED ROOM')).toBe('master_bedroom');
    expect(typeOf('MASTER BEDROOM\n12\'0" X 14\'0"')).toBe('master_bedroom');
    expect(typeOf('DINNING')).toBe('dining');
    expect(typeOf('KITCHEN & DINING')).toBe('kitchen');
    expect(typeOf('DINING HALL')).toBe('dining');
    expect(typeOf('W.C.')).toBe('wc');
    expect(typeOf('TOILET / W.C.')).toBe('toilet');
    expect(typeOf('WASH ROOM')).toBe('toilet');
    expect(typeOf('WASH AREA')).toBe('utility');
    expect(typeOf('CAR PORCH')).toBe('parking');
    expect(typeOf('PORCH')).toBe('sit_out');
    expect(typeOf('HOME OFFICE')).toBe('study');
    expect(typeOf('O.T.S')).toBe('ots');
    expect(typeOf('Pooja')).toBe('pooja');
    expect(typeOf('SERVANT ROOM WITH TOILET')).toBe('servant');
  });

  it('ignores sizes, numbers and notes', () => {
    expect(normalizeLabel('10\'0" X 12\'4"')).toBe('');
    expect(normalizeLabel('3000 x 4000 mm')).toBe('');
    expect(typeOf('3.00 X 4.00')).toBeNull();
    expect(typeOf('NOTE: TOILET FLOOR SUNKEN BY 300 MM')).toBeNull();
    expect(typeOf('GROUND FLOOR PLAN')).toBeNull();
  });
});
