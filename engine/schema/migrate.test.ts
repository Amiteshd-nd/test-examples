import { describe, expect, it } from 'vitest';
import { migrate, type Migration } from './migrate.ts';

const toy: Migration[] = [
  { from: '1.0.0', to: '1.1.0', migrate: (d) => ({ ...d, added: true }) },
  { from: '1.1.0', to: '2.0.0', migrate: ({ added, ...rest }) => ({ ...rest, renamed: added }) },
];

describe('migration runner', () => {
  it('leaves a current document unchanged', () => {
    const r = migrate({ schema_version: '1.2.0', x: 1 });
    expect(r).toEqual({
      ok: true,
      doc: { schema_version: '1.2.0', x: 1 },
      from: '1.2.0',
      applied: [],
    });
  });

  it('upgrades 1.1.0 plans: every level gains empty annotation maps (P2.5)', () => {
    const r = migrate({
      schema_version: '1.1.0',
      levels: { L0: { id: 'L0', walls: { W1: { id: 'W1' } } }, L1: { id: 'L1', walls: {} } },
    });
    expect(r.ok && r.applied).toEqual(['1.1.0→1.2.0']);
    expect(r.ok && r.doc.levels).toEqual({
      L0: {
        id: 'L0',
        walls: { W1: { id: 'W1' } },
        lines: {},
        dimensions: {},
        texts: {},
        hatches: {},
      },
      L1: { id: 'L1', walls: {}, lines: {}, dimensions: {}, texts: {}, hatches: {} },
    });
  });

  it('chains steps to the target and stamps each version', () => {
    const input = { schema_version: '1.0.0', x: 1 };
    const r = migrate(input, toy, '2.0.0');
    expect(r).toEqual({
      ok: true,
      doc: { schema_version: '2.0.0', x: 1, renamed: true },
      from: '1.0.0',
      applied: ['1.0.0→1.1.0', '1.1.0→2.0.0'],
    });
    expect(input).toEqual({ schema_version: '1.0.0', x: 1 });
  });

  it('starts from an intermediate version', () => {
    const r = migrate({ schema_version: '1.1.0', added: false }, toy, '2.0.0');
    expect(r.ok && r.applied).toEqual(['1.1.0→2.0.0']);
  });

  it('refuses newer files, unknown versions and non-plans', () => {
    expect(migrate({ schema_version: '3.0.0' }, toy, '2.0.0').ok).toBe(false);
    expect(migrate({ schema_version: '0.5.0' }, toy, '2.0.0').ok).toBe(false);
    expect(migrate({ schema_version: 'one' }).ok).toBe(false);
    expect(migrate({}).ok).toBe(false);
    expect(migrate([]).ok).toBe(false);
    expect(migrate(null).ok).toBe(false);
  });

  it('upgrades 1.0.0 plans: lists become id maps, levels get an order, separators start empty', () => {
    const r = migrate({
      schema_version: '1.0.0',
      levels: [
        {
          id: 'L0',
          name: 'Ground',
          walls: [{ id: 'W1' }],
          rooms: [{ id: 'R1' }],
          openings: [],
          stairs: [],
          columns: [],
          fixtures: [],
        },
        {
          id: 'L1',
          name: 'First',
          walls: [],
          rooms: [],
          openings: [],
          stairs: [],
          columns: [],
          fixtures: [],
        },
      ],
    });
    if (!r.ok) throw new Error(r.error);
    const levels = r.doc.levels as Record<
      string,
      { order: string; walls: object; separators: object }
    >;
    expect(Object.keys(levels)).toEqual(['L0', 'L1']);
    expect(levels.L0!.walls).toEqual({ W1: { id: 'W1' } });
    expect(levels.L0!.separators).toEqual({});
    expect(levels.L0!.order < levels.L1!.order).toBe(true);
  });

  it('refuses to upgrade a plan that reuses an id instead of dropping one of the objects', () => {
    const r = migrate({
      schema_version: '1.0.0',
      levels: [{ id: 'L0', walls: [{ id: 'W1' }, { id: 'W1' }] }],
    });
    expect(r).toEqual({
      ok: false,
      error:
        'The plan could not be upgraded from format 1.0.0 to 1.1.0: two walls on level "L0" use the id "W1".',
    });
  });
});
