import type { VaultStorage } from '@plancraft/engine';

// The Vault's storage seen from the browser (P14.3, D-38): text by key over HTTP. In development
// Vite serves `data/vault/` at `/vault-storage/` (frontend/vite.config.ts); the server provides
// the same three calls from P10.1.

export class HttpVaultStorage implements VaultStorage {
  private readonly base: string;
  constructor(base = '/vault-storage') {
    this.base = base.replace(/\/$/, '');
  }
  private url(key: string) {
    return `${this.base}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }
  async read(key: string): Promise<string | null> {
    const res = await fetch(this.url(key), { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`The vault could not be read (HTTP ${res.status}).`);
    return res.text();
  }
  async write(key: string, text: string): Promise<void> {
    const res = await fetch(this.url(key), { method: 'PUT', body: text });
    if (!res.ok) throw new Error(`The vault could not be saved (HTTP ${res.status}).`);
  }
  async remove(key: string): Promise<void> {
    const res = await fetch(this.url(key), { method: 'DELETE' });
    if (!res.ok) throw new Error(`The vault could not be changed (HTTP ${res.status}).`);
  }
}
