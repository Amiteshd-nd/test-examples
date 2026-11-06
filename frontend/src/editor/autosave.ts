// Continuous save for the editor (P14.4, A2 M12): there is no Save button. Every change is
// kept at once as a local draft (so a refresh or a crash loses nothing) and saved to the Vault
// soon after: 0.8 s after the last change, or 5 s after the first unsaved one if changes keep
// coming. A failed save retries by itself (2, 5, 10, then every 30 s) and as soon as the
// browser is back online. A save refused because the file changed elsewhere stops ("conflict")
// and keeps the draft, marked as conflicting so it is never applied over the other save.

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'offline' | 'conflict';

export interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(id: unknown): void;
}

export interface Draft<T> {
  write(doc: T, baseRev: number): void;
  clear(): void;
  /** The draft's base was overtaken by a save elsewhere: never apply it on its own. */
  markConflict?(): void;
}

export interface AutosaveOptions<T> {
  /** Saves `doc` on top of revision `baseRev`; resolves to the new revision. */
  save: (doc: T, baseRev: number) => Promise<number>;
  /** A refused save that retrying can't fix (the file changed elsewhere). */
  isConflict: (e: unknown) => boolean;
  baseRev: number;
  draft?: Draft<T>;
  onStatus?: (s: SaveStatus) => void;
  timers?: Timers;
  debounceMs?: number;
  maxWaitMs?: number;
  retryMs?: number[];
}

const browserTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

export class Autosaver<T> {
  private readonly o: AutosaveOptions<T>;
  private readonly timers: Timers;
  private baseRev: number;
  private pending: T | null = null;
  private saving: Promise<void> | null = null;
  private again = false;
  private retries = 0;
  private debounce: unknown = null;
  private maxWait: unknown = null;
  private retry: unknown = null;
  status: SaveStatus = 'saved';

  constructor(options: AutosaveOptions<T>) {
    this.o = options;
    this.timers = options.timers ?? browserTimers;
    this.baseRev = options.baseRev;
  }

  get revision(): number {
    return this.baseRev;
  }

  /** A new state of the document: kept as a draft now, saved soon. */
  change(doc: T): void {
    this.pending = doc;
    this.o.draft?.write(doc, this.baseRev);
    if (this.status === 'conflict') return;
    if (!this.saving) this.setStatus('pending');
    this.schedule();
  }

  /** Saves now (e.g. when leaving the editor). Resolves when nothing is left to save. */
  async flush(): Promise<void> {
    this.clearTimers();
    if (this.saving) {
      this.again = true;
      return this.saving;
    }
    if (this.pending === null || this.status === 'conflict') return;
    const doc = this.pending;
    this.pending = null;
    this.setStatus('saving');
    this.saving = this.attempt(doc);
    await this.saving;
    this.saving = null;
    if (this.again) {
      this.again = false;
      await this.flush();
    }
  }

  /** The browser is back online: try a waiting save at once. */
  online(): void {
    if (this.status === 'offline') void this.flush();
  }

  dispose(): void {
    this.clearTimers();
  }

  private async attempt(doc: T): Promise<void> {
    try {
      this.baseRev = await this.o.save(doc, this.baseRev);
      this.retries = 0;
      if (this.pending !== null) {
        // Changes made while saving: keep their draft on the new revision and save them next.
        this.o.draft?.write(this.pending, this.baseRev);
        this.setStatus('pending');
        this.schedule();
      } else {
        this.o.draft?.clear();
        this.setStatus('saved');
      }
    } catch (e) {
      if (this.pending === null) this.pending = doc;
      if (this.o.isConflict(e)) {
        this.o.draft?.markConflict?.();
        this.setStatus('conflict');
        return;
      }
      this.setStatus('offline');
      const delays = this.o.retryMs ?? [2000, 5000, 10_000, 30_000];
      const ms = delays[Math.min(this.retries++, delays.length - 1)]!;
      this.retry = this.timers.set(() => void this.flush(), ms);
    }
  }

  private schedule() {
    if (this.debounce !== null) this.timers.clear(this.debounce);
    this.debounce = this.timers.set(() => void this.flush(), this.o.debounceMs ?? 800);
    if (this.maxWait === null)
      this.maxWait = this.timers.set(() => void this.flush(), this.o.maxWaitMs ?? 5000);
  }

  private clearTimers() {
    for (const t of [this.debounce, this.maxWait, this.retry]) if (t !== null) this.timers.clear(t);
    this.debounce = this.maxWait = this.retry = null;
  }

  private setStatus(s: SaveStatus) {
    if (s === this.status) return;
    this.status = s;
    this.o.onStatus?.(s);
  }
}

/** A local draft kept per file, in the browser (survives refresh and crash). */
export interface StoredDraft<T> {
  baseRev: number;
  writtenAt: string;
  doc: T;
  /** A save of this draft was refused because the file changed elsewhere. */
  conflict?: boolean;
}

export function localDraft<T>(
  fileId: string,
  store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = safeLocalStorage(),
  now: () => string = () => new Date().toISOString(),
): Draft<T> & { read(): StoredDraft<T> | null; markConflict(): void } {
  const key = `plancraft-draft:${fileId}`;
  let conflict = false;
  const put = (d: StoredDraft<T>) => {
    try {
      store?.setItem(key, JSON.stringify(d));
    } catch {
      // Storage full or blocked: the Vault save still happens; only crash recovery is lost.
    }
  };
  return {
    read() {
      try {
        const raw = store?.getItem(key);
        return raw ? (JSON.parse(raw) as StoredDraft<T>) : null;
      } catch {
        return null;
      }
    },
    write(doc, baseRev) {
      put({ baseRev, writtenAt: now(), doc, ...(conflict ? { conflict } : {}) });
    },
    markConflict() {
      conflict = true;
      const d = this.read();
      if (d) put({ ...d, conflict });
    },
    clear() {
      try {
        store?.removeItem(key);
      } catch {
        // Nothing to clear.
      }
    },
  };
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * What to do with a draft found when a file opens. Drop it when it equals the saved plan
 * (`same`). `apply` it when it was made on the saved revision, or one before (the browser
 * closed while that save was finishing) and was never refused. Otherwise the file was saved
 * elsewhere since: the draft is `stale` and must be kept apart, not applied.
 */
export function draftDecision(
  draft: { baseRev: number; docText: string; conflict?: boolean },
  saved: { rev: number; docText: string },
): 'apply' | 'same' | 'stale' {
  if (draft.docText === saved.docText) return 'same';
  if (draft.conflict) return 'stale';
  return draft.baseRev === saved.rev || draft.baseRev === saved.rev - 1 ? 'apply' : 'stale';
}
