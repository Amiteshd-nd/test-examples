import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32 as nodeCrc32, deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { inflateRaw } from './inflate.ts';
import { crc32, readZip, utf8, utf8Text, writeZip } from './zip.ts';

// Deterministic pseudo-random bytes: a mix of text-like runs and noise, so DEFLATE uses
// literals, back-references, fixed and dynamic blocks.
function sample(n: number, seed: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    out[i] = seed % 7 === 0 ? seed >>> 24 : 97 + ((i >> 3) % 20);
  }
  return out;
}

describe('UTF-8 and CRC-32', () => {
  it('encodes text like the platform does and checksums like zlib', () => {
    const text = 'Plan ₹ 30×40 — कमरा 🏠';
    expect(utf8(text)).toEqual(new Uint8Array(Buffer.from(text, 'utf8')));
    expect(utf8Text(utf8(text))).toBe(text);
    const data = sample(5000, 3);
    expect(crc32(data)).toBe(nodeCrc32(data));
  });
});

describe('inflateRaw', () => {
  it('unpacks what zlib packs, at every compression level', () => {
    for (const [n, level] of [
      [0, 6],
      [10, 0],
      [70_000, 0],
      [3000, 1],
      [40_000, 6],
      [120_000, 9],
    ] as const) {
      const data = sample(n, n + level);
      expect(inflateRaw(deflateRawSync(data, { level }))).toEqual(data);
    }
  });

  it('rejects damaged data and output over the limit', () => {
    const packed = deflateRawSync(sample(20_000, 1));
    expect(() => inflateRaw(packed.subarray(0, packed.length >> 1))).toThrow(/Damaged/);
    expect(() => inflateRaw(new Uint8Array([0xff, 0xff, 0xff]))).toThrow(/Damaged/);
    expect(() => inflateRaw(packed, 1000)).toThrow(/size limit/);
  });
});

describe('zip files', () => {
  const entries = [
    { name: 'manifest.json', data: utf8('{"a":1}') },
    { name: 'docs/plan ₹.json', data: sample(2000, 9) },
    { name: 'empty.txt', data: new Uint8Array(0) },
  ];

  it('round-trips its own zips', () => {
    const zip = writeZip(entries, '2026-11-06T10:20:30Z');
    expect(readZip(zip)).toEqual(new Map(entries.map((e) => [e.name, e.data])));
  });

  it("writes zips the system's unzip reads, and reads zips the system's zip compresses", () => {
    const dir = mkdtempSync(join(tmpdir(), 'plancraft-zip-'));
    const ours = join(dir, 'ours.zip');
    writeFileSync(ours, writeZip(entries));
    const listing = execFileSync('unzip', ['-l', ours], { encoding: 'utf8' });
    expect(listing).toContain('manifest.json');
    expect(execFileSync('unzip', ['-p', ours, 'manifest.json'], { encoding: 'utf8' })).toBe(
      '{"a":1}',
    );
    // Re-pack with the system's zip (deflate) and read it back.
    writeFileSync(join(dir, 'big.txt'), sample(50_000, 4));
    execFileSync('zip', ['-q', '-9', 'theirs.zip', 'big.txt'], { cwd: dir });
    const theirs = readZip(new Uint8Array(readFileSync(join(dir, 'theirs.zip'))));
    expect(theirs.get('big.txt')).toEqual(sample(50_000, 4));
  });

  it('refuses damaged, oversized and crowded zips with a reason', () => {
    const zip = writeZip(entries);
    expect(() => readZip(zip.subarray(0, 40))).toThrow(/no zip directory/);
    const broken = zip.slice();
    broken[45] = (broken[45]! + 1) % 256; // the first entry's data starts at 30 + 13
    expect(() => readZip(broken)).toThrow(/damaged/);
    expect(() => readZip(zip, { maxBytes: 100 })).toThrow(/size limit/);
    expect(() => readZip(zip, { maxEntries: 2 })).toThrow(/more than 2 entries/);
  });
});
