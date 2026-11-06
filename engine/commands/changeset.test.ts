import { describe, expect, it } from 'vitest';
import { gridPlan } from '../samples/grid-plan.ts';
import { apply, applyChecked, changedObjects, diff, invert, sameValue } from './changeset.ts';

describe('changesets (A2 M9)', () => {
  const a = gridPlan({ cols: 3, rows: 2 });
  const L0 = Object.keys(a.levels)[0]!;
  const level = a.levels[L0]!;
  const b = {
    ...a,
    meta: { ...a.meta, name: 'Renamed' },
    levels: {
      [L0]: {
        ...level,
        walls: { ...level.walls, V1: { ...level.walls.V1!, start: [360, 0], end: [360, 600] } },
        openings: Object.fromEntries(Object.entries(level.openings).filter(([k]) => k !== 'D2')),
        columns: {
          ...level.columns,
          C99: { id: 'C99', at: [10, 10], size: [23, 23], rotation_deg: 0 },
        },
      },
    },
  } as typeof a;

  it('diffs field by field and treats points and polygons as single values', () => {
    const patches = diff(a, b);
    expect(patches).toContainEqual({
      path: ['meta', 'name'],
      before: a.meta.name,
      after: 'Renamed',
    });
    expect(patches).toContainEqual({
      path: ['levels', L0, 'walls', 'V1', 'start'],
      before: [330, 0],
      after: [360, 0],
    });
    expect(patches).toContainEqual({
      path: ['levels', L0, 'openings', 'D2'],
      before: level.openings.D2,
    });
    expect(patches).toContainEqual({
      path: ['levels', L0, 'columns', 'C99'],
      after: b.levels[L0]!.columns.C99,
    });
    expect(patches).toHaveLength(5);
    expect(diff(a, a)).toEqual([]);
    expect(diff(a, structuredClone(a))).toEqual([]);
  });

  it('applies, inverts and round-trips without touching the input', () => {
    const frozen = structuredClone(a);
    const patches = diff(a, b);
    const after = apply(a, patches);
    expect(sameValue(after, b)).toBe(true);
    expect(a).toEqual(frozen);
    expect(sameValue(apply(after, invert(patches)), a)).toBe(true);
    // Unchanged parts are shared, not copied.
    expect(after.plot).toBe(a.plot);
    expect(after.levels[L0]!.rooms).toBe(level.rooms);
  });

  it('skips patches whose value was changed since, and reports them (A2 M8)', () => {
    const patches = diff(a, b);
    // Someone else renamed the plan after our change.
    const theirs = apply(apply(a, patches), [
      { path: ['meta', 'name'], before: 'Renamed', after: 'Theirs' },
    ]);
    const undone = applyChecked(theirs, invert(patches));
    expect(undone.skipped.map((p) => p.path.join('.'))).toEqual(['meta.name']);
    expect(undone.doc.meta.name).toBe('Theirs');
    expect(undone.doc.levels[L0]!.walls.V1!.start).toEqual([330, 0]);
    expect(undone.doc.levels[L0]!.openings.D2).toEqual(level.openings.D2);
    // An object that no longer exists can't take a field change.
    const gone = applyChecked(a, [
      { path: ['levels', L0, 'walls', 'NOPE', 'start'], before: [0, 0], after: [1, 1] },
    ]);
    expect(gone.skipped).toHaveLength(1);
    expect(gone.doc).toBe(a);
  });

  it('lists the objects a changeset touched (dirty flags, A2 M6)', () => {
    expect(changedObjects(diff(a, b))).toEqual([
      { kind: 'meta' },
      { level: L0, kind: 'walls', id: 'V1' },
      { level: L0, kind: 'openings', id: 'D2' },
      { level: L0, kind: 'columns', id: 'C99' },
    ]);
    expect(changedObjects([{ path: ['levels', L0, 'name'], before: 'a', after: 'b' }])).toEqual([
      { level: L0, kind: 'level' },
    ]);
  });
});
