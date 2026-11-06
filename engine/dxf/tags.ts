// Ported from CADCraft `crates/dxf/src/lib.rs` at commit 3b7eb1b
// (https://github.com/storytold/cadcraft), Copyright (c) 2026 ArtCraft Team and the CADCraft
// contributors, MIT licence — see THIRD_PARTY_NOTICES.md (ADR 0001, C1).
// Changes from the original: TypeScript; results instead of exceptions; the tag limit is a
// parameter (default 10 million, sized for a browser) instead of an environment variable; values
// are plain numbers (64-bit integers beyond 2^53 lose precision); the binary and code-page
// *writers* are left out (we write ASCII DXF only); a real is written in JavaScript's shortest
// form, which may use an exponent (`1e-7`) where the original writes plain digits.
//
// A DXF file is a sequence of (group code, value) pairs. This module parses ASCII and binary DXF
// into a flat list of tags, splits them into sections and records, and writes tags back as ASCII.
// Mapping tags to plan objects is left to the importer.

import { BinaryText, decodeAsciiFile, decodeDoubleByte, mifLabel } from './codepage.ts';

export type DxfValue = string | number | boolean;

export interface DxfTag {
  code: number;
  /** String, number or boolean, by the group code's kind; binary chunks are hex text. */
  value: DxfValue;
}

/** The value type of a group code (DXF Reference, "Group Code Value Types"). */
export type DxfKind = 'str' | 'real' | 'int16' | 'int32' | 'int64' | 'bool' | 'hex';

const KIND_RANGES: [number, number, DxfKind][] = [
  [0, 9, 'str'],
  [10, 59, 'real'],
  [60, 79, 'int16'],
  [90, 99, 'int32'],
  [100, 109, 'str'],
  [110, 149, 'real'],
  [160, 169, 'int64'],
  [170, 179, 'int16'],
  [210, 239, 'real'],
  [270, 289, 'int16'],
  [290, 299, 'bool'],
  [300, 309, 'str'],
  [310, 319, 'hex'],
  [320, 369, 'str'],
  [370, 389, 'int16'],
  [390, 399, 'str'],
  [400, 409, 'int16'],
  [410, 419, 'str'],
  [420, 429, 'int32'],
  [430, 439, 'str'],
  [440, 459, 'int32'],
  [460, 469, 'real'],
  [470, 481, 'str'],
  [999, 999, 'str'],
  [1000, 1003, 'str'],
  [1004, 1004, 'hex'],
  [1005, 1009, 'str'],
  [1010, 1059, 'real'],
  [1060, 1070, 'int16'],
  [1071, 1071, 'int32'],
];

export function kindOf(code: number): DxfKind {
  for (const [lo, hi, kind] of KIND_RANGES) if (code >= lo && code <= hi) return kind;
  return 'str';
}

const INT = /^[+-]?\d+$/;
const FLOAT = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const I64_MIN = -(2n ** 63n);
const I64_MAX = 2n ** 63n - 1n;

function parseFloatStrict(t: string): number {
  return FLOAT.test(t) ? Number(t) : NaN;
}

/** An integer value as the group's width holds it: a float spelling is truncated and clamped. */
function parseInteger(t: string, lo: number, hi: number): number {
  if (INT.test(t)) {
    const b = BigInt(t);
    if (b >= I64_MIN && b <= I64_MAX) return Number(b);
  }
  const f = parseFloatStrict(t);
  return Number.isFinite(f) ? Math.min(hi, Math.max(lo, Math.trunc(f))) : 0;
}

const INT_RANGE: Record<'int16' | 'int32' | 'int64', [number, number]> = {
  int16: [-32768, 65535],
  int32: [-2147483648, 4294967295],
  int64: [Number(I64_MIN), Number(I64_MAX)],
};

function typed(code: number, text: string): DxfValue {
  const t = text.trim();
  const kind = kindOf(code);
  switch (kind) {
    case 'real': {
      const f = parseFloatStrict(t);
      return Number.isFinite(f) ? f : 0;
    }
    case 'int16':
    case 'int32':
    case 'int64':
      return parseInteger(t, ...INT_RANGE[kind]);
    case 'bool': {
      // Like a 64-bit integer parse: anything that is not one (or overflows) counts as 0.
      const b = INT.test(t) ? BigInt(t) : 0n;
      return b !== 0n && b >= I64_MIN && b <= I64_MAX;
    }
    case 'hex':
      return normalizeHex(t);
    case 'str':
      return text;
  }
}

/** A tag's value as text. */
export function tagString(tag: DxfTag): string {
  const v = tag.value;
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? '1' : '0';
  return kindOf(tag.code) === 'real' ? formatReal(v) : String(v);
}

/** A tag's value as a finite number (0 when it has none). */
export function tagNumber(tag: DxfTag): number {
  const v = tag.value;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const f = parseFloatStrict(v.trim());
  return Number.isFinite(f) ? f : 0;
}

/** A tag's value as an integer (0 when it has none). */
export function tagInt(tag: DxfTag): number {
  const v = tag.value;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return parseInteger(v.trim(), Number(I64_MIN), Number(I64_MAX));
}

export type DxfError =
  | { kind: 'not_dxf' }
  | { kind: 'bad_code'; line: number; text: string }
  | { kind: 'eof' }
  | { kind: 'too_large'; tags: number; limit: number };

export type DxfParseResult =
  { ok: true; tags: DxfTag[]; warnings: string[] } | { ok: false; error: DxfError };

/** Plain-language description of a parse failure, for import reports. */
export function dxfErrorMessage(error: DxfError): string {
  switch (error.kind) {
    case 'not_dxf':
      return 'This file is not a DXF drawing.';
    case 'bad_code':
      return `This DXF file is damaged: line ${error.line} should hold a group code but holds "${error.text}".`;
    case 'eof':
      return 'This DXF file is cut short: it ends in the middle of an entry.';
    case 'too_large':
      return `This drawing is too large to open here: it has more than ${error.limit.toLocaleString('en-IN')} entries.`;
  }
}

/** Most group codes read from one file by default; a house plan has well under a million. */
export const DEFAULT_MAX_TAGS = 10_000_000;

export interface DxfParseOptions {
  maxTags?: number;
}

const BINARY_SENTINEL = Uint8Array.from('AutoCAD Binary DXF\r\n\x1a\0', (c) => c.charCodeAt(0));

export function isBinaryDxf(bytes: Uint8Array): boolean {
  return BINARY_SENTINEL.every((b, i) => bytes[i] === b);
}

/** Parse a DXF file, ASCII or binary. */
export function parseDxf(bytes: Uint8Array, options: DxfParseOptions = {}): DxfParseResult {
  const maxTags = options.maxTags ?? DEFAULT_MAX_TAGS;
  if (isBinaryDxf(bytes)) return parseBinary(bytes.subarray(BINARY_SENTINEL.length), maxTags);
  const body =
    bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes;
  // Count group-code/value pairs before decoding anything, so an oversized file fails fast.
  const tags = countAsciiTags(body);
  if (tags > maxTags) return { ok: false, error: { kind: 'too_large', tags, limit: maxTags } };
  const warnings: string[] = [];
  const text = decodeAsciiFile(body, warnings);
  const parsed = parseAsciiText(text, { maxTags });
  return parsed.ok ? { ...parsed, warnings: [...warnings, ...parsed.warnings] } : parsed;
}

const ASCII_WS = new Set([0x20, 0x09, 0x0a, 0x0c, 0x0d]);

/** Byte-level twin of the ASCII parser's loop: counts nonblank code/value pairs up to EOF. */
function countAsciiTags(bytes: Uint8Array): number {
  let pos = 0;
  const nextLine = (): [number, number] | null => {
    if (pos >= bytes.length) return null;
    const start = pos;
    while (pos < bytes.length && bytes[pos] !== 0x0a && bytes[pos] !== 0x0d) pos++;
    const end = pos;
    if (bytes[pos] === 0x0d && bytes[pos + 1] === 0x0a) pos += 2;
    else if (pos < bytes.length) pos += 1;
    return [start, end];
  };
  const trimmed = ([s, e]: [number, number]): [number, number] => {
    while (s < e && ASCII_WS.has(bytes[s]!)) s++;
    while (e > s && ASCII_WS.has(bytes[e - 1]!)) e--;
    return [s, e];
  };
  const is = ([s, e]: [number, number], text: string) =>
    e - s === text.length && [...text].every((c, i) => bytes[s + i] === c.charCodeAt(0));

  let tags = 0;
  for (let code = nextLine(); code; code = nextLine()) {
    const c = trimmed(code);
    if (c[0] === c[1]) continue;
    const value = nextLine();
    if (!value) break;
    tags++;
    if (is(c, '0') && is(trimmed(value), 'EOF')) break;
  }
  return tags;
}

/** The lines of a text: LF, CRLF and a lone CR all end a line; no empty line after the last end. */
function asciiLines(text: string): string[] {
  const lines = text.split(/\r\n|\r|\n/);
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** Parse ASCII DXF that is already text. */
export function parseAsciiText(text: string, options: DxfParseOptions = {}): DxfParseResult {
  const maxTags = options.maxTags ?? DEFAULT_MAX_TAGS;
  const lines = asciiLines(text.startsWith('\uFEFF') ? text.slice(1) : text);
  const tags: DxfTag[] = [];
  let i = 0;
  while (i < lines.length) {
    const ln = i;
    const ct = lines[i++]!.trim();
    if (ct === '') continue;
    const code = INT.test(ct) ? Number(ct) : NaN;
    if (!Number.isInteger(code) || code < -2147483648 || code > 2147483647) {
      return {
        ok: false,
        error: { kind: 'bad_code', line: ln + 1, text: Array.from(ct).slice(0, 40).join('') },
      };
    }
    if (i >= lines.length) return { ok: false, error: { kind: 'eof' } };
    let value = typed(code, lines[i++]!);
    if (typeof value === 'string' && kindOf(code) === 'str') value = unescapeUnicode(value);
    const tag = { code, value };
    tags.push(tag);
    if (tags.length > maxTags) {
      return { ok: false, error: { kind: 'too_large', tags: tags.length, limit: maxTags } };
    }
    if (code === 0 && tagString(tag).trimEnd() === 'EOF') break;
  }
  if (tags.length === 0) return { ok: false, error: { kind: 'not_dxf' } };
  return { ok: true, tags, warnings: [] };
}

/** The four hex digits of a `\U+XXXX` escape starting at `chars[i]`, if there is one. */
function escapeAt(chars: string[], i: number): number | null {
  if (chars[i] !== '\\' || chars[i + 1] !== 'U' || chars[i + 2] !== '+') return null;
  const hex = chars.slice(i + 3, i + 7);
  if (hex.length !== 4 || !hex.every((c) => /^[0-9A-Fa-f]$/.test(c))) return null;
  return parseInt(hex.join(''), 16);
}

/** The character of a `\M+nXXXX` escape (double-byte East Asian character) at `chars[i]`. */
function mifEscapeAt(chars: string[], i: number): string | null {
  if (chars[i] !== '\\' || chars[i + 1] !== 'M' || chars[i + 2] !== '+') return null;
  const label = mifLabel(chars[i + 3] ?? '');
  if (!label) return null;
  const hex = chars.slice(i + 4, i + 8);
  if (hex.length !== 4 || !hex.every((c) => /^[0-9A-Fa-f]$/.test(c))) return null;
  const code = parseInt(hex.join(''), 16);
  return decodeDoubleByte(label, code >> 8, code & 0xff);
}

/**
 * Unescape `\U+XXXX` (one UTF-16 unit; above U+FFFF a surrogate pair of escapes) and `\M+nXXXX`
 * sequences. Malformed escapes, unpaired surrogates and unknown `\M+` code pages stay literal.
 */
function unescapeUnicode(s: string): string {
  if (!s.includes('\\U+') && !s.includes('\\M+')) return s;
  const chars = Array.from(s);
  let out = '';
  let i = 0;
  while (i < chars.length) {
    const mif = mifEscapeAt(chars, i);
    if (mif !== null) {
      out += mif;
      i += 8;
      continue;
    }
    const unit = escapeAt(chars, i);
    if (unit !== null) {
      if (unit < 0xd800 || unit > 0xdfff) {
        out += String.fromCodePoint(unit);
        i += 7;
        continue;
      }
      const low = unit < 0xdc00 ? escapeAt(chars, i + 7) : null;
      if (low !== null && low >= 0xdc00 && low < 0xe000) {
        out += String.fromCodePoint(0x10000 + ((unit - 0xd800) << 10) + (low - 0xdc00));
        i += 14;
        continue;
      }
    }
    out += chars[i];
    i += 1;
  }
  return out;
}

/** Binary DXF (R13+: 2-byte group codes). `body` starts after the sentinel. */
function parseBinary(body: Uint8Array, maxTags: number): DxfParseResult {
  const warnings: string[] = [];
  const text = new BinaryText(warnings);
  const first = parseBinaryPass(body, maxTags, text);
  if (!first.ok || !text.needsCodePagePass()) return first.ok ? { ...first, warnings } : first;
  const secondWarnings: string[] = [];
  const second = parseBinaryPass(body, maxTags, new BinaryText(secondWarnings, true));
  return second.ok ? { ...second, warnings: secondWarnings } : second;
}

function parseBinaryPass(b: Uint8Array, maxTags: number, text: BinaryText): DxfParseResult {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const eof: DxfParseResult = { ok: false, error: { kind: 'eof' } };
  let p = 0;
  const need = (n: number) => p + n <= b.length;
  const tags: DxfTag[] = [];
  while (p < b.length) {
    if (!need(2)) return eof;
    let code = view.getInt16(p, true);
    p += 2;
    if (code === 255) {
      if (!need(2)) return eof;
      code = view.getInt16(p, true);
      p += 2;
    }
    let value: DxfValue;
    switch (kindOf(code)) {
      case 'str': {
        const start = p;
        while (p < b.length && b[p] !== 0) p++;
        if (p >= b.length) return eof;
        value = unescapeUnicode(text.string(code, b.subarray(start, p)));
        p += 1;
        break;
      }
      case 'real': {
        if (!need(8)) return eof;
        const f = view.getFloat64(p, true);
        value = Number.isFinite(f) ? f : 0;
        p += 8;
        break;
      }
      case 'int16':
        if (!need(2)) return eof;
        value = view.getInt16(p, true);
        p += 2;
        break;
      case 'int32':
        if (!need(4)) return eof;
        value = view.getInt32(p, true);
        p += 4;
        break;
      case 'int64':
        if (!need(8)) return eof;
        value = Number(view.getBigInt64(p, true));
        p += 8;
        break;
      case 'bool':
        if (!need(1)) return eof;
        value = b[p] !== 0;
        p += 1;
        break;
      case 'hex': {
        if (!need(1)) return eof;
        const n = b[p]!;
        p += 1;
        if (!need(n)) return eof;
        value = Array.from(b.subarray(p, p + n), (x) =>
          x.toString(16).toUpperCase().padStart(2, '0'),
        ).join('');
        p += n;
        break;
      }
    }
    const tag = { code, value };
    tags.push(tag);
    if (tags.length > maxTags) {
      return { ok: false, error: { kind: 'too_large', tags: tags.length, limit: maxTags } };
    }
    if (code === 0 && typeof value === 'string' && value.trimEnd() === 'EOF') break;
  }
  if (tags.length === 0) return { ok: false, error: { kind: 'not_dxf' } };
  return { ok: true, tags, warnings: [] };
}

/** Format a real the way DXF writers usually do (shortest round trip, with a decimal point). */
export function formatReal(v: number): string {
  if (!Number.isFinite(v)) return '0.0';
  if (Object.is(v, -0)) return '-0.0';
  const s = String(v);
  return s.includes('.') || s.includes('e') ? s : `${s}.0`;
}

/** Hex text cleaned up: only hex digits kept; an odd trailing digit is padded with `0`. */
function normalizeHex(s: string): string {
  const digits = s.replace(/[^0-9A-Fa-f]/g, '');
  return digits.length % 2 === 1 ? `${digits}0` : digits;
}

/**
 * A string value as written. Line breaks become spaces. Without `utf8` (before R2007) every
 * non-ASCII character becomes `\U+XXXX` (a surrogate pair of escapes above U+FFFF), so the file
 * is pure ASCII and valid in any code page. A backslash that would start a `\U+` or `\M+`
 * sequence is written as `\U+005C`, so a reader gives back the literal text.
 */
function encodeString(s: string, utf8: boolean): string {
  const chars = Array.from(s);
  let out = '';
  chars.forEach((c, i) => {
    if (c === '\r' || c === '\n') out += ' ';
    else if (c === '\\' && (chars[i + 1] === 'U' || chars[i + 1] === 'M') && chars[i + 2] === '+') {
      out += '\\U+005C';
    } else if (utf8 || c.charCodeAt(0) < 0x80) out += c;
    else {
      for (let k = 0; k < c.length; k++) {
        out += `\\U+${c.charCodeAt(k).toString(16).toUpperCase().padStart(4, '0')}`;
      }
    }
  });
  return out;
}

/**
 * Write tags as ASCII DXF: CRLF line ends, codes right-aligned to 3. Strings are UTF-8 when
 * `utf8` (R2007+), otherwise escaped to pure ASCII (see `encodeString`).
 */
export function writeDxfAscii(tags: readonly DxfTag[], options: { utf8?: boolean } = {}): string {
  const utf8 = options.utf8 ?? false;
  const out: string[] = [];
  for (const t of tags) {
    const codeLine = String(t.code).padStart(3, ' ');
    const kind = kindOf(t.code);
    if (kind === 'hex') {
      // A binary chunk line holds at most 254 hex digits; longer data continues in further
      // groups of the same code. Only hex digits are written, so a value can't inject tags.
      const digits = normalizeHex(tagString(t));
      const chunks = digits.match(/.{1,254}/g) ?? [''];
      for (const chunk of chunks) out.push(codeLine, chunk);
      continue;
    }
    let value: string;
    if (typeof t.value === 'string') value = encodeString(t.value, utf8);
    else if (typeof t.value === 'boolean') value = t.value ? '1' : '0';
    else if (kind === 'real') value = formatReal(t.value);
    else if (kind === 'str') value = String(t.value);
    else value = String(Math.trunc(t.value));
    out.push(codeLine, value);
  }
  return out.map((line) => `${line}\r\n`).join('');
}

export interface DxfSection {
  name: string;
  tags: DxfTag[];
}

const isMarker = (t: DxfTag | undefined, name: string) =>
  t !== undefined && t.code === 0 && tagString(t).trimEnd() === name;

/** Split a tag stream into sections: `0 SECTION / 2 NAME … 0 ENDSEC`. */
export function dxfSections(tags: readonly DxfTag[]): DxfSection[] {
  const out: DxfSection[] = [];
  let i = 0;
  while (i < tags.length) {
    if (isMarker(tags[i], 'SECTION')) {
      const nameTag = tags[i + 1];
      const name = nameTag && nameTag.code === 2 ? tagString(nameTag).trimEnd() : '';
      const start = i + 2;
      let j = start;
      while (j < tags.length && !isMarker(tags[j], 'ENDSEC')) j++;
      out.push({ name, tags: tags.slice(start, j) });
      i = j + 1;
    } else {
      i += 1;
    }
  }
  return out;
}

export interface DxfRecord {
  /** The record type (the value of its code-0 tag), e.g. `LINE`. */
  type: string;
  /** The tags after the code-0 tag. */
  tags: DxfTag[];
}

/** Split a run of tags into records starting at each code-0 tag. */
export function dxfRecords(tags: readonly DxfTag[]): DxfRecord[] {
  const out: DxfRecord[] = [];
  for (const t of tags) {
    if (t.code === 0) out.push({ type: tagString(t), tags: [] });
    else out[out.length - 1]?.tags.push(t);
  }
  return out;
}
