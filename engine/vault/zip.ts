import { inflateRaw } from './inflate.ts';

// Zip files for `.plancraft` packages (A2 M10). Writing stores entries uncompressed (plans are
// small, and every program can read stored zips); reading accepts stored and deflated entries,
// so a package re-zipped by another program still opens. No Zip64, no encryption. Limits on the
// number of entries and the unpacked size guard against hostile files.

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

export interface ZipLimits {
  maxEntries?: number;
  /** Total unpacked bytes. */
  maxBytes?: number;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** UTF-8 bytes of a string (the engine allows `TextDecoder` only, D-15, so encoding is here). */
export function utf8(text: string): Uint8Array {
  const out: number[] = [];
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

export function utf8Text(data: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(data);
}

/** DOS date and time for a zip header, from an ISO time (UTC). */
function dosTime(iso: string): [number, number] {
  const d = new Date(iso);
  const year = Math.max(1980, Math.min(2107, d.getUTCFullYear()));
  return [
    (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >> 1),
    ((year - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate(),
  ];
}

/** A zip file of `entries`, stored without compression; `modified` dates every entry. */
export function writeZip(entries: ZipEntry[], modified = '1980-01-01T00:00:00Z'): Uint8Array {
  const [time, date] = dosTime(modified);
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = utf8(e.name);
    const crc = crc32(e.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, e.data.length, true);
    local.setUint32(22, e.data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, e.data);
    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, 0, true);
    dir.setUint16(12, time, true);
    dir.setUint16(14, date, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, e.data.length, true);
    dir.setUint32(24, e.data.length, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);
    central.push(new Uint8Array(dir.buffer), name);
    offset += 30 + name.length + e.data.length;
  }
  const dirSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, dirSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of all) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** The entries of a zip file by name (folders skipped). Throws with a plain reason if damaged. */
export function readZip(bytes: Uint8Array, limits: ZipLimits = {}): Map<string, Uint8Array> {
  const maxEntries = limits.maxEntries ?? 1000;
  const maxBytes = limits.maxBytes ?? 256 * 1024 * 1024;
  const fail = (why: string): never => {
    throw new Error(`Not a readable zip file: ${why}.`);
  };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) fail('no zip directory found');
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  if (count > maxEntries) fail(`it has more than ${maxEntries} entries`);
  const out = new Map<string, Uint8Array>();
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50)
      fail('the directory is damaged');
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const packed = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLen = view.getUint16(at + 28, true);
    const extraLen = view.getUint16(at + 30, true);
    const commentLen = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = utf8Text(bytes.subarray(at + 46, at + 46 + nameLen));
    at += 46 + nameLen + extraLen + commentLen;
    if (flags & 1) fail(`"${name}" is encrypted`);
    if (packed === 0xffffffff || size === 0xffffffff) fail('it is a Zip64 file');
    if (name.endsWith('/')) continue;
    total += size;
    if (total > maxBytes) fail('it unpacks to more than the size limit');
    if (local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034b50)
      fail(`the entry "${name}" is damaged`);
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (start + packed > bytes.length) fail(`the entry "${name}" is cut short`);
    const raw = bytes.subarray(start, start + packed);
    const data =
      method === 0
        ? raw.slice()
        : method === 8
          ? inflateRaw(raw, size)
          : fail(`"${name}" uses an unsupported compression method (${method})`);
    if (data.length !== size || crc32(data) !== crc) fail(`the entry "${name}" is damaged`);
    out.set(name, data);
  }
  return out;
}
