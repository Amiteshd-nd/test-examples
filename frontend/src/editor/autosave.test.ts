import { describe, expect, it } from 'vitest';
import { Autosaver, draftDecision, localDraft, type SaveStatus, type Timers } from './autosave.ts';

/** Timers we move by hand. */
function fakeTimers() {
  let now = 0;
  let next = 0;
  const due = new Map<number, { at: number; fn: () => void }>();
  const timers: Timers = {
    set: (fn, ms) => {
      due.set(++next, { at: now + ms, fn });
      return next;
    },
    clear: (id) => void due.delete(id as number),
  };
  const advance = async (ms: number) => {
    const end = now + ms;
    for (;;) {
      const [id, t] =
        [...due].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0] ?? [];
      if (!t) break;
      due.delete(id!);
      now = t.at;
      t.fn();
      await new Promise((r) => setTimeout(r, 0));
    }
    now = end;
  };
  return { timers, advance };
}

function setup(save: (doc: string, rev: number) => Promise<number>) {
  const { timers, advance } = fakeTimers();
  const statuses: SaveStatus[] = [];
  const draft: { doc: string | null; rev: number | null } = { doc: null, rev: null };
  const saver = new Autosaver<string>({
    save,
    isConflict: (e) => (e as Error).message === 'conflict',
    baseRev: 1,
    timers,
    onStatus: (s) => statuses.push(s),
    draft: {
      write: (doc, rev) => Object.assign(draft, { doc, rev }),
      clear: () => Object.assign(draft, { doc: null, rev: null }),
    },
  });
  return { saver, advance, statuses, draft };
}

describe('Autosaver', () => {
  it('saves 0.8 s after the last change, keeping a draft until it is saved', async () => {
    const saved: [string, number][] = [];
    const { saver, advance, statuses, draft } = setup(async (doc, rev) => {
      saved.push([doc, rev]);
      return rev + 1;
    });
    saver.change('a');
    expect(draft).toEqual({ doc: 'a', rev: 1 });
    await advance(500);
    saver.change('ab');
    await advance(500);
    expect(saved).toEqual([]);
    await advance(400);
    expect(saved).toEqual([['ab', 1]]);
    expect(saver.revision).toBe(2);
    expect(draft).toEqual({ doc: null, rev: null });
    expect(statuses).toEqual(['pending', 'saving', 'saved']);
  });

  it('saves at least every 5 s while changes keep coming', async () => {
    const saved: string[] = [];
    const { saver, advance } = setup(async (doc, rev) => (saved.push(doc), rev + 1));
    for (let i = 1; i <= 12; i++) {
      saver.change(`v${i}`);
      await advance(500);
    }
    expect(saved).toEqual(['v10']);
  });

  it('saves changes made during a save right after it, on the new revision', async () => {
    const calls: [string, number][] = [];
    let release!: () => void;
    const { saver, advance, draft } = setup(
      (doc, rev) =>
        new Promise((r) => {
          calls.push([doc, rev]);
          release = () => r(rev + 1);
        }),
    );
    saver.change('a');
    await advance(800);
    saver.change('ab');
    release();
    await new Promise((r) => setTimeout(r, 0));
    expect(draft).toEqual({ doc: 'ab', rev: 2 });
    await advance(800);
    release();
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toEqual([
      ['a', 1],
      ['ab', 2],
    ]);
    expect(saver.status).toBe('saved');
  });

  it('goes "offline" when a save fails, retries by itself, and saves when back online', async () => {
    let up = false;
    const saved: string[] = [];
    const { saver, advance, statuses } = setup(async (doc, rev) => {
      if (!up) throw new Error('network');
      saved.push(doc);
      return rev + 1;
    });
    saver.change('a');
    await advance(800);
    expect(saver.status).toBe('offline');
    await advance(2000); // first retry fails too
    expect(saved).toEqual([]);
    up = true;
    saver.online();
    await new Promise((r) => setTimeout(r, 0));
    expect(saved).toEqual(['a']);
    expect(statuses).toEqual([
      'pending',
      'saving',
      'offline',
      'saving',
      'offline',
      'saving',
      'saved',
    ]);
  });

  it('stops on a conflict and keeps the change as a draft', async () => {
    const { saver, advance, draft } = setup(async () => {
      throw new Error('conflict');
    });
    saver.change('a');
    await advance(800);
    expect(saver.status).toBe('conflict');
    saver.change('ab');
    await advance(10_000);
    expect(saver.status).toBe('conflict');
    expect(draft.doc).toBe('ab');
  });
});

describe('drafts', () => {
  it('keeps one draft per file in browser storage', () => {
    const data = new Map<string, string>();
    const store = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
    const d = localDraft<{ n: number }>('f1', store, () => '2026-11-06T10:00:00.000Z');
    d.write({ n: 1 }, 4);
    expect(d.read()).toEqual({ baseRev: 4, writtenAt: '2026-11-06T10:00:00.000Z', doc: { n: 1 } });
    expect(localDraft('f2', store).read()).toBeNull();
    d.clear();
    expect(d.read()).toBeNull();
    expect(localDraft('f1', null).read()).toBeNull();
  });

  it('decides whether a draft found on opening is used', () => {
    expect(draftDecision({ baseRev: 4, docText: 'b' }, { rev: 4, docText: 'a' })).toBe('apply');
    // The browser closed while the save of revision 5 was finishing: the draft is newer.
    expect(draftDecision({ baseRev: 4, docText: 'c' }, { rev: 5, docText: 'b' })).toBe('apply');
    expect(draftDecision({ baseRev: 4, docText: 'b' }, { rev: 5, docText: 'b' })).toBe('same');
    expect(draftDecision({ baseRev: 2, docText: 'x' }, { rev: 5, docText: 'b' })).toBe('stale');
    // Refused because another tab saved: never applied over that save.
    expect(
      draftDecision({ baseRev: 4, docText: 'c', conflict: true }, { rev: 5, docText: 'b' }),
    ).toBe('stale');
  });

  it('marks a draft that hit a conflict, and keeps the mark on later writes', () => {
    const data = new Map<string, string>();
    const store = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
    const d = localDraft<string>('f1', store);
    d.write('a', 3);
    d.markConflict();
    expect(d.read()?.conflict).toBe(true);
    d.write('ab', 3);
    expect(d.read()).toMatchObject({ doc: 'ab', conflict: true });
  });
});
