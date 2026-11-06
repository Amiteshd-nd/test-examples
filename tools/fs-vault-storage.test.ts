import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import sampleB from '../engine/samples/1.2.0/b-1bhk-t-junctions.plan.json' with { type: 'json' };
import { Vault, sequentialIds, steppingClock } from '../engine/index.ts';
import { FsVaultStorage } from './fs-vault-storage.ts';

describe('FsVaultStorage', () => {
  it('stores text as files, replaces them whole, and refuses keys outside its folder', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'plancraft-vault-'));
    const s = new FsVaultStorage(dir);
    expect(await s.read('index.json')).toBeNull();
    await s.write('docs/a.json', '{"v":1}');
    await s.write('docs/a.json', '{"v":2}');
    expect(await s.read('docs/a.json')).toBe('{"v":2}');
    expect(readdirSync(join(dir, 'docs'))).toEqual(['a.json']); // no temporary files left
    await s.remove('docs/a.json');
    await s.remove('docs/a.json');
    expect(await s.read('docs/a.json')).toBeNull();
    await expect(s.write('../outside.json', 'x')).rejects.toThrow(/Bad storage key/);
    await expect(s.read('/etc/passwd')).rejects.toThrow(/Bad storage key/);
  });

  it('holds a working vault on disk', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'plancraft-vault-'));
    const vault = new Vault({
      storage: new FsVaultStorage(dir),
      ids: sequentialIds('f'),
      clock: steppingClock(),
      user: { id: 'local' },
    });
    const folder = await vault.createFolder({ parentId: null, name: 'Residential' });
    const file = await vault.createFile({ folderId: folder.id, plan: sampleB });
    await vault.getThumbnail(file.id);
    const copy = await vault.importPackage(await vault.exportPackage(file.id), folder.id);
    expect(JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')).files[copy.id].name).toBe(
      file.name,
    );
    expect(existsSync(join(dir, 'docs', `${file.id}.json`))).toBe(true);
    expect(readFileSync(join(dir, 'thumbs', `${file.id}.svg`), 'utf8')).toMatch(/^<svg /);
    await vault.trash(folder.id);
    await vault.deleteForever(folder.id);
    expect(readdirSync(join(dir, 'docs'))).toEqual([]);
  });
});
