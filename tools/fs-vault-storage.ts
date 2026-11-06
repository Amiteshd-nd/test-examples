// The local VaultStorage (PRD §3.4, A2 P14.2): a vault as files under one folder, by default
// data/vault/ (`index.json`, `docs/<id>.json`, `thumbs/<id>.svg`, `versions/<id>.json`). Writes
// go to a temporary file first and are then renamed into place, so a crash never leaves a
// half-written index or plan. A server or browser storage can replace it without engine changes.
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { STORAGE_KEY, type VaultStorage } from '../engine/index.ts';

export class FsVaultStorage implements VaultStorage {
  private readonly dir: string;
  constructor(dir: string) {
    this.dir = dir;
  }
  private path(key: string): string {
    if (!STORAGE_KEY.test(key)) throw new Error(`Bad storage key: ${key}`);
    return join(this.dir, key);
  }
  async read(key: string): Promise<string | null> {
    try {
      return readFileSync(this.path(key), 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }
  async write(key: string, text: string): Promise<void> {
    const file = this.path(key);
    mkdirSync(dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    writeFileSync(temp, text);
    renameSync(temp, file);
  }
  async remove(key: string): Promise<void> {
    rmSync(this.path(key), { force: true });
  }
}
