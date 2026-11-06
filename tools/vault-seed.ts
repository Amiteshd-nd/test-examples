// Puts the demo workspace into data/vault/ (P14.2): `npm run vault:seed`. It will not touch an
// existing vault; `npm run vault:seed -- --reset` deletes data/vault/ first and starts over.
import { randomBytes } from 'node:crypto';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Vault, formatUlid, seedDemoVault } from '../engine/index.ts';
import { FsVaultStorage } from './fs-vault-storage.ts';

const dir = 'data/vault';
if (existsSync(join(dir, 'index.json'))) {
  if (!process.argv.includes('--reset')) {
    console.error(
      `${dir}/ already holds a vault. Run with -- --reset to delete it and start over.`,
    );
    process.exit(1);
  }
  rmSync(dir, { recursive: true, force: true });
}
const vault = new Vault({
  storage: new FsVaultStorage(dir),
  ids: { next: () => formatUlid(Date.now(), randomBytes(10)) },
  clock: { now: () => new Date().toISOString() },
  user: { id: 'local' },
  workspace: { id: 'local', name: 'My workspace' },
});
await seedDemoVault(vault);
const index = await vault.index();
for (const id of Object.keys(index.files)) await vault.getThumbnail(id);
console.log(
  `Seeded ${dir}/: ${Object.keys(index.folders).length} folders, ${Object.keys(index.files).length} plans, with thumbnails.`,
);
