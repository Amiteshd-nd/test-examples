// Where a vault keeps its text (PRD §3.4: the host supplies storage). Keys look like paths:
// `index.json`, `docs/<file-id>.json`, `thumbs/<file-id>.svg`, `versions/<file-id>.json`. A
// folder of files, a browser database or a server can all provide this; the vault's behaviour
// lives once, in `vault.ts`.

export interface VaultStorage {
  read(key: string): Promise<string | null>;
  write(key: string, text: string): Promise<void>;
  /** Removing a key that isn't there is not an error. */
  remove(key: string): Promise<void>;
}

/** Keys are short relative paths of plain characters. */
export const STORAGE_KEY = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9._/-]{0,200}$/;

export class MemoryStorage implements VaultStorage {
  readonly data = new Map<string, string>();
  async read(key: string) {
    return this.data.get(key) ?? null;
  }
  async write(key: string, text: string) {
    if (!STORAGE_KEY.test(key)) throw new Error(`Bad storage key: ${key}`);
    this.data.set(key, text);
  }
  async remove(key: string) {
    this.data.delete(key);
  }
}
