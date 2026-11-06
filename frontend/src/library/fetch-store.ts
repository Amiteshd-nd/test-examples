import { LibraryIndex, type DocumentStore } from '@plancraft/engine';

// A read-only DocumentStore (PRD §3.4) over HTTP: the Plan Library as JSON files under one base
// URL (`index.json`, `plans/<id>.json`). In development Vite serves `data/library/` at
// `/library/` (frontend/vite.config.ts); the server takes over in P4.1. Saving arrives with the
// Vault (P14.2–P14.4).

const ID = /^[a-z0-9][a-z0-9-]*$/;

export class FetchStore implements DocumentStore {
  private readonly base: string;
  constructor(base = '/library') {
    this.base = base.replace(/\/$/, '');
  }
  async loadPlan(id: string): Promise<unknown | null> {
    if (!ID.test(id)) return null;
    const res = await fetch(`${this.base}/plans/${id}.json`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Could not load plan ${id} (HTTP ${res.status})`);
    return (await res.json()) as unknown;
  }
  async listPlans(): Promise<string[]> {
    return (await this.loadIndex()).entries.map((e) => e.id).sort();
  }
  async loadIndex(): Promise<LibraryIndex> {
    const res = await fetch(`${this.base}/index.json`);
    if (res.status === 404) return { version: 1, entries: [] };
    if (!res.ok) throw new Error(`Could not load the library index (HTTP ${res.status})`);
    return LibraryIndex.parse(await res.json());
  }
  async savePlan(): Promise<void> {
    throw new Error('This library is read-only until the Vault saves files (P14.4).');
  }
  async saveIndex(): Promise<void> {
    throw new Error('This library is read-only until the Vault saves files (P14.4).');
  }
}
