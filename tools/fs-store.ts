// The local DocumentStore (PRD §3.4): plans as JSON files in data/library/plans/ and the index
// in data/library/index.json. A server or database store can replace it without engine changes.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LibraryIndex, type DocumentStore, type Plan } from '../engine/index.ts';

export class FsStore implements DocumentStore {
  private readonly dir: string;
  constructor(dir: string) {
    this.dir = dir;
    mkdirSync(join(dir, 'plans'), { recursive: true });
  }
  async loadPlan(id: string) {
    const file = join(this.dir, 'plans', `${id}.json`);
    return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as unknown) : null;
  }
  async savePlan(id: string, plan: Plan) {
    writeFileSync(join(this.dir, 'plans', `${id}.json`), JSON.stringify(plan, null, 2) + '\n');
  }
  async listPlans() {
    return readdirSync(join(this.dir, 'plans'))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -5))
      .sort();
  }
  async loadIndex() {
    const file = join(this.dir, 'index.json');
    return existsSync(file)
      ? LibraryIndex.parse(JSON.parse(readFileSync(file, 'utf8')))
      : { version: 1 as const, entries: [] };
  }
  async saveIndex(index: LibraryIndex) {
    writeFileSync(join(this.dir, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  }
}
