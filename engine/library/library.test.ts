import { describe, expect, it } from 'vitest';
import a from '../samples/1.3.0/a-one-room.plan.json' with { type: 'json' };
import b from '../samples/1.3.0/b-1bhk-t-junctions.plan.json' with { type: 'json' };
import { Plan } from '../schema/plan.ts';
import {
  addToLibrary,
  applyTagReview,
  libraryId,
  MemoryStore,
  parseCsv,
  tagReviewCsv,
} from './library.ts';

const NOW = '2026-11-06T10:00:00Z';
async function library() {
  const store = new MemoryStore();
  await addToLibrary(store, { id: 'a', plan: Plan.parse(a), status: 'success', now: NOW });
  await addToLibrary(store, {
    id: 'b',
    plan: Plan.parse(b),
    status: 'partial',
    now: NOW,
    source: 'b.dxf',
  });
  return store;
}

describe('Plan Library', () => {
  it('saves plans and an index of their tags', async () => {
    const store = await library();
    expect(await store.listPlans()).toEqual(['a', 'b']);
    const index = await store.loadIndex();
    expect(index.entries.map((e) => [e.id, e.status, e.reviewed, e.tags.carpet_m2.value])).toEqual([
      ['a', 'success', false, 10.44],
      ['b', 'partial', false, 20.99],
    ]);
  });

  it('makes ids from file names', () => {
    expect(libraryId('Ramesh House 30x40 (rev 2).DXF')).toBe('ramesh-house-30x40-rev-2');
    expect(libraryId('...')).toBe('plan');
  });

  it('writes a review table that round-trips through a spreadsheet', async () => {
    const csv = tagReviewCsv(await (await library()).loadIndex());
    const rows = parseCsv(csv);
    expect(rows[0]!.slice(0, 6)).toEqual([
      'id',
      'name',
      'status',
      'reviewed',
      'facing',
      'facing_source',
    ]);
    expect(rows).toHaveLength(3);
    expect(parseCsv('x,"a ""quoted"", with comma"\r\n1,2\n')).toEqual([
      ['x', 'a "quoted", with comma'],
      ['1', '2'],
    ]);
  });

  it('applies corrections and confirmations, and keeps them when the plan is imported again', async () => {
    const store = await library();
    const rows = parseCsv(tagReviewCsv(await store.loadIndex()));
    const h = rows[0]!;
    rows[1]![h.indexOf('facing')] = 'North';
    rows[1]![h.indexOf('bhk')] = '2';
    rows[2]![h.indexOf('reviewed')] = 'yes';
    const result = await applyTagReview(store, rows.map((r) => r.join(',')).join('\n'));
    expect(result.errors).toEqual([]);
    expect(result.changes).toEqual([
      'Sample A - one room: facing east → north, BHK 0 → 2.',
      'Sample B - 1BHK with T-junctions: confirmed as is.',
    ]);
    const planA = Plan.parse(await store.loadPlan('a'));
    expect(planA.meta).toMatchObject({
      facing: 'north',
      bhk: 2,
      provenance: { facing: { provenance: 'measured' } },
    });
    // A fresh import of the same drawing keeps the reviewed facts.
    await addToLibrary(store, { id: 'a', plan: Plan.parse(a), status: 'success', now: NOW });
    const entry = (await store.loadIndex()).entries.find((e) => e.id === 'a')!;
    expect(entry).toMatchObject({
      reviewed: true,
      tags: { facing: { value: 'north', provenance: 'measured' }, bhk: { value: 2 } },
    });
  });

  it('rejects a row with a bad value instead of applying half of it', async () => {
    const store = await library();
    const rows = parseCsv(tagReviewCsv(await store.loadIndex()));
    const h = rows[0]!;
    rows[1]![h.indexOf('facing')] = 'up';
    rows[1]![h.indexOf('bhk')] = '3';
    const result = await applyTagReview(store, rows.map((r) => r.join(',')).join('\n'));
    expect(result.changes).toEqual([]);
    expect(result.errors[0]).toMatch(/facing "up" is not one of/);
    expect(Plan.parse(await store.loadPlan('a')).meta.bhk).toBe(0);
  });
});
