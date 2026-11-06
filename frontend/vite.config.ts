import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { FsVaultStorage } from '../tools/fs-vault-storage.ts';

/**
 * Development only: serves the local Plan Library (`data/library/`) read-only at `/library/`,
 * so the editor loads plans through its DocumentStore (P2.3). Only `index.json` and
 * `plans/<id>.json` with a plain id are served.
 */
function planLibrary(): Plugin {
  const dir = resolve(__dirname, '../data/library');
  return {
    name: 'plancraft-library',
    configureServer(server) {
      server.middlewares.use('/library', (req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        const match = /^\/(index\.json|plans\/[a-z0-9][a-z0-9-]*\.json)$/.exec(path ?? '');
        if (req.method !== 'GET' || !match) return next();
        const file = resolve(dir, match[1]!);
        if (!existsSync(file)) {
          res.statusCode = 404;
          return res.end();
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(readFileSync(file));
      });
    },
  };
}

/**
 * Development only: the local Vault's storage (`data/vault/`) at `/vault-storage/<key>` — GET
 * reads, PUT writes, DELETE removes — so the engine's Vault can run in the browser (P14.3, D-38).
 * Keys are checked by the storage; writes are atomic. The server takes this over at P10.1.
 */
function vaultStorage(): Plugin {
  const storage = new FsVaultStorage(resolve(__dirname, '../data/vault'));
  const MAX_BYTES = 64 * 1024 * 1024;
  return {
    name: 'plancraft-vault-storage',
    configureServer(server) {
      server.middlewares.use('/vault-storage/', (req, res) => {
        const key = decodeURIComponent((req.url ?? '').split('?')[0]!.replace(/^\//, ''));
        const reply = (status: number, body = '') => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(body);
        };
        const fail = (e: unknown) =>
          reply(/Bad storage key/.test(String(e)) ? 400 : 500, String(e));
        if (req.method === 'GET')
          storage.read(key).then((t) => (t === null ? reply(404) : reply(200, t)), fail);
        else if (req.method === 'DELETE') storage.remove(key).then(() => reply(204), fail);
        else if (req.method === 'PUT') {
          const chunks: Buffer[] = [];
          let size = 0;
          req.on('data', (c: Buffer) => {
            size += c.length;
            if (size > MAX_BYTES) req.destroy();
            else chunks.push(c);
          });
          req.on('end', () =>
            storage.write(key, Buffer.concat(chunks).toString('utf8')).then(() => reply(204), fail),
          );
        } else reply(405);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), planLibrary(), vaultStorage()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        styleguide: resolve(__dirname, 'styleguide.html'),
        vault: resolve(__dirname, 'vault.html'),
      },
    },
  },
});
