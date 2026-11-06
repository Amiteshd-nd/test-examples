// Ported from CADCraft `crates/dxf/src/codepage.rs` at commit 3b7eb1b
// (https://github.com/storytold/cadcraft), Copyright (c) 2026 ArtCraft Team and the CADCraft
// contributors, MIT licence — see THIRD_PARTY_NOTICES.md (ADR 0001, C1).
// Changes from the original: TypeScript; `encoding_rs` replaced by the WHATWG `TextDecoder`;
// the code-page *writer* (`encoder`, `encode_char`) is left out (we write ASCII with escapes);
// warnings are collected for the caller instead of logged.
//
// Text decoding for DXF files. R2007 (AC1021) and later DXF files are UTF-8. Older ones store
// text in the code page named by the `$DWGCODEPAGE` header variable (`ANSI_1252`, `ANSI_932`,
// `DOS850`, …); characters outside it are written as `\U+XXXX` (any character) or `\M+nXXXX`
// (a double-byte character of an East Asian code page) escapes, which the tag reader decodes
// after the bytes. Decoding never fails: an invalid byte sequence becomes U+FFFD and the bytes
// after it decode normally, so line ends and the group structure survive.

/** How the bytes of a code page become text. */
export type Decoder =
  | { kind: 'utf8' }
  /** A WHATWG encoding label understood by `TextDecoder`. */
  | { kind: 'label'; label: string }
  /** Single-byte DOS code page: ASCII, then these 128 characters for bytes 0x80–0xFF. */
  | { kind: 'table'; table: string };

const UTF8: Decoder = { kind: 'utf8' };
const EAST_ASIAN = new Set(['shift_jis', 'gbk', 'euc-kr', 'big5']);

const decoders = new Map<string, TextDecoder>();
function textDecoder(label: string, fatal: boolean): TextDecoder {
  const key = `${label}:${fatal}`;
  let d = decoders.get(key);
  if (!d) {
    d = new TextDecoder(label, { fatal, ignoreBOM: true });
    decoders.set(key, d);
  }
  return d;
}

/** `bytes` as UTF-8, or null when they are not valid UTF-8. */
export function tryUtf8(bytes: Uint8Array): string | null {
  try {
    return textDecoder('utf-8', true).decode(bytes);
  } catch {
    return null;
  }
}

export function isAscii(bytes: Uint8Array): boolean {
  for (const b of bytes) if (b >= 0x80) return false;
  return true;
}

function latin(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return s;
}

const LABELS: Record<string, string> = {
  ASCII: 'windows-1252',
  ANSI_1252: 'windows-1252',
  ISO8859_1: 'windows-1252',
  ISO_8859_1: 'windows-1252',
  ANSI_874: 'windows-874',
  ANSI_932: 'shift_jis',
  DOS932: 'shift_jis',
  SHIFT_JIS: 'shift_jis',
  ANSI_936: 'gbk',
  GB2312: 'gbk',
  GBK: 'gbk',
  ANSI_949: 'euc-kr',
  KSC5601: 'euc-kr',
  KOREAN: 'euc-kr',
  ANSI_950: 'big5',
  BIG5: 'big5',
  ANSI_1250: 'windows-1250',
  ANSI_1251: 'windows-1251',
  ANSI_1253: 'windows-1253',
  ANSI_1254: 'windows-1254',
  ISO8859_9: 'windows-1254',
  ISO_8859_9: 'windows-1254',
  ANSI_1255: 'windows-1255',
  ANSI_1256: 'windows-1256',
  ANSI_1257: 'windows-1257',
  ANSI_1258: 'windows-1258',
  DOS866: 'ibm866',
  MACINTOSH: 'macintosh',
  MAC_ROMAN: 'macintosh',
};
for (const n of [2, 3, 4, 5, 6, 7, 8]) {
  LABELS[`ISO8859_${n}`] = `iso-8859-${n}`;
  LABELS[`ISO_8859_${n}`] = `iso-8859-${n}`;
}

/** The decoder for a `$DWGCODEPAGE` value (case-insensitive), or null for an unknown code page. */
export function decoder(codePage: string): Decoder | null {
  const name = codePage.trim().toUpperCase().replace(/[- ]/g, '_');
  if (name === 'UTF8' || name === 'UTF_8' || name === 'UNICODE') return UTF8;
  if (name === 'DOS437') return { kind: 'table', table: DOS437 };
  if (name === 'DOS850') return { kind: 'table', table: DOS850 };
  if (name === 'DOS852') return { kind: 'table', table: DOS852 };
  const label = LABELS[name];
  return label ? { kind: 'label', label } : null;
}

/** True for the multi-byte East Asian code pages (Shift-JIS, GBK, EUC-KR/Wansung, Big5). */
function isEastAsian(d: Decoder): boolean {
  return d.kind === 'label' && EAST_ASIAN.has(d.label);
}

/** Decode bytes with a decoder. UTF-8 that isn't valid falls back to Windows-1252. */
export function decodeBytes(bytes: Uint8Array, d: Decoder): string {
  switch (d.kind) {
    case 'utf8':
      return tryUtf8(bytes) ?? textDecoder('windows-1252', false).decode(bytes);
    case 'label':
      return textDecoder(d.label, false).decode(bytes);
    case 'table': {
      if (isAscii(bytes)) return latin(bytes);
      let s = '';
      for (const b of bytes)
        s += b < 0x80 ? String.fromCharCode(b) : (d.table[b & 0x7f] ?? '\uFFFD');
      return s;
    }
  }
}

/** Decode `bytes` from the code page `codePage` names, or null when the code page is unknown. */
export function decodeCodePage(bytes: Uint8Array, codePage: string): string | null {
  const d = decoder(codePage);
  return d ? decodeBytes(bytes, d) : null;
}

/** One line of an ASCII DXF file: valid UTF-8 is read as UTF-8, anything else from `d`. */
function decodeText(bytes: Uint8Array, d: Decoder): string {
  return tryUtf8(bytes) ?? decodeBytes(bytes, d);
}

const ASCII_WS = new Set([0x20, 0x09, 0x0a, 0x0c, 0x0d]);

function trimAscii(bytes: Uint8Array): Uint8Array {
  let s = 0;
  let e = bytes.length;
  while (s < e && ASCII_WS.has(bytes[s]!)) s++;
  while (e > s && ASCII_WS.has(bytes[e - 1]!)) e--;
  return bytes.subarray(s, e);
}

/**
 * The `$DWGCODEPAGE` value of an ASCII DXF file: the line two lines after a `$DWGCODEPAGE` line
 * (the group code `3` between them), looked for in the HEADER section only (the scan stops at
 * the first `ENDSEC`). Works on the raw bytes, before they are decoded.
 */
export function asciiCodePage(bytes: Uint8Array): Uint8Array | null {
  const lines = nonBlankLines(bytes);
  for (let r = lines.next(); !r.done; r = lines.next()) {
    const line = latin(r.value);
    if (line === 'ENDSEC') return null;
    if (line.toUpperCase() === '$DWGCODEPAGE') {
      const code = lines.next();
      const value = lines.next();
      return !code.done && !value.done && latin(code.value) === '3' ? value.value : null;
    }
  }
  return null;
}

function* nonBlankLines(bytes: Uint8Array): Generator<Uint8Array> {
  let start = 0;
  for (let i = 0; i <= bytes.length; i++) {
    if (i === bytes.length || bytes[i] === 0x0a || bytes[i] === 0x0d) {
      const line = trimAscii(bytes.subarray(start, i));
      if (line.length) yield line;
      start = i + 1;
    }
  }
}

/**
 * Decode a whole ASCII DXF file. A file that is valid UTF-8 throughout is UTF-8. Otherwise, for
 * a single-byte code page, each line is decoded on its own: lines that aren't valid UTF-8 come
 * from the file's `$DWGCODEPAGE`, or from Windows-1252 when the header has none or names an
 * unknown code page. For a multi-byte East Asian code page the whole file is decoded from that
 * code page, because a short double-byte string can be valid UTF-8 by accident.
 */
export function decodeAsciiFile(bytes: Uint8Array, warnings: string[]): string {
  const asUtf8 = tryUtf8(bytes);
  if (asUtf8 !== null) return asUtf8;
  let d: Decoder = UTF8;
  const name = asciiCodePage(bytes);
  if (name) {
    const n = textDecoder('utf-8', false).decode(name);
    const found = decoder(n);
    if (found) d = found;
    else warnings.push(`Unknown code page "${n}"; text was read as Windows-1252.`);
  }
  if (isEastAsian(d)) return decodeBytes(bytes, d);
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x0a || bytes[i] === 0x0d) {
      parts.push(decodeText(bytes.subarray(start, i + 1), d));
      start = i + 1;
    }
  }
  if (start < bytes.length) parts.push(decodeText(bytes.subarray(start), d));
  return parts.join('');
}

/** True for an `$ACADVER` of R2007 (AC1021) or later, whose text is UTF-8. */
export function isUtf8Version(acadver: string): boolean {
  const m = /^AC(\d+)$/.exec(acadver.trim());
  return m !== null && Number(m[1]) >= 1021;
}

/**
 * The text state of a binary DXF file, learnt from the header as the tags go by: `$ACADVER`
 * (R2007+ strings are UTF-8) and `$DWGCODEPAGE` (the code page of older files). Both come first
 * in the HEADER section and are ASCII, so every later string is decoded right.
 */
export class BinaryText {
  private variable: 'acadver' | 'codepage' | null = null;
  private utf8 = false;
  private codePage: Decoder | null = null;
  /** Non-ASCII strings seen under an East Asian code page: valid UTF-8 / not valid UTF-8. */
  private eaUtf8 = false;
  private eaOther = false;

  private readonly warnings: string[];
  /** Decode every East Asian string from the code page, never as UTF-8 (second pass). */
  private readonly codePageOnly: boolean;

  constructor(warnings: string[], codePageOnly = false) {
    this.warnings = warnings;
    this.codePageOnly = codePageOnly;
  }

  /**
   * True when the file declared an East Asian code page and its non-ASCII strings are a mix of
   * valid UTF-8 and not: the valid ones may be double-byte text that looks like UTF-8 by
   * accident, so the file must be read again in code-page-only mode.
   */
  needsCodePagePass(): boolean {
    return !this.codePageOnly && this.eaUtf8 && this.eaOther;
  }

  /** Decode one string value of group `code` and update the state from it. */
  string(code: number, raw: Uint8Array): string {
    const d = this.utf8 ? UTF8 : (this.codePage ?? UTF8);
    let s: string;
    if (isEastAsian(d) && !this.codePageOnly) {
      if (!isAscii(raw)) {
        if (tryUtf8(raw) !== null) this.eaUtf8 = true;
        else this.eaOther = true;
      }
      s = decodeText(raw, d);
    } else {
      s = decodeBytes(raw, d);
    }
    const variable = this.variable;
    this.variable = null;
    if (code === 9) {
      const name = s.trim();
      this.variable = name === '$ACADVER' ? 'acadver' : name === '$DWGCODEPAGE' ? 'codepage' : null;
    } else if (code === 1 && variable === 'acadver') {
      this.utf8 = isUtf8Version(s);
    } else if (code === 3 && variable === 'codepage') {
      this.codePage = decoder(s);
      if (!this.codePage) {
        this.warnings.push(`Unknown code page "${s.trim()}"; text was read as Windows-1252.`);
      }
    }
    return s;
  }
}

/**
 * The double-byte code page of a `\M+n` escape: 1 Japanese (Shift-JIS), 2 Traditional Chinese
 * (Big5), 3 Korean (Wansung), 5 Simplified Chinese (GB 2312). 4 (Korean Johab) is not supported.
 */
export function mifLabel(n: string): string | null {
  return { '1': 'shift_jis', '2': 'big5', '3': 'euc-kr', '5': 'gbk' }[n] ?? null;
}

/** Decodes two bytes strictly in `label`; null when they are not one valid character there. */
export function decodeDoubleByte(label: string, hi: number, lo: number): string | null {
  try {
    const text = textDecoder(label, true).decode(Uint8Array.of(hi, lo));
    return Array.from(text).length === 1 ? text : null;
  } catch {
    return null;
  }
}

// Upper halves (bytes 0x80–0xFF) of the IBM PC code pages, generated from their published
// definitions (same values as the CADCraft tables).
const DOS437 =
  '\u00C7\u00FC\u00E9\u00E2\u00E4\u00E0\u00E5\u00E7\u00EA\u00EB\u00E8\u00EF\u00EE\u00EC\u00C4\u00C5\u00C9\u00E6\u00C6\u00F4\u00F6\u00F2\u00FB\u00F9\u00FF\u00D6\u00DC\u00A2\u00A3\u00A5\u20A7\u0192\u00E1\u00ED\u00F3\u00FA\u00F1\u00D1\u00AA\u00BA\u00BF\u2310\u00AC\u00BD\u00BC\u00A1\u00AB\u00BB\u2591\u2592\u2593\u2502\u2524\u2561\u2562\u2556\u2555\u2563\u2551\u2557\u255D\u255C\u255B\u2510\u2514\u2534\u252C\u251C\u2500\u253C\u255E\u255F\u255A\u2554\u2569\u2566\u2560\u2550\u256C\u2567\u2568\u2564\u2565\u2559\u2558\u2552\u2553\u256B\u256A\u2518\u250C\u2588\u2584\u258C\u2590\u2580\u03B1\u00DF\u0393\u03C0\u03A3\u03C3\u00B5\u03C4\u03A6\u0398\u03A9\u03B4\u221E\u03C6\u03B5\u2229\u2261\u00B1\u2265\u2264\u2320\u2321\u00F7\u2248\u00B0\u2219\u00B7\u221A\u207F\u00B2\u25A0\u00A0';
const DOS850 =
  '\u00C7\u00FC\u00E9\u00E2\u00E4\u00E0\u00E5\u00E7\u00EA\u00EB\u00E8\u00EF\u00EE\u00EC\u00C4\u00C5\u00C9\u00E6\u00C6\u00F4\u00F6\u00F2\u00FB\u00F9\u00FF\u00D6\u00DC\u00F8\u00A3\u00D8\u00D7\u0192\u00E1\u00ED\u00F3\u00FA\u00F1\u00D1\u00AA\u00BA\u00BF\u00AE\u00AC\u00BD\u00BC\u00A1\u00AB\u00BB\u2591\u2592\u2593\u2502\u2524\u00C1\u00C2\u00C0\u00A9\u2563\u2551\u2557\u255D\u00A2\u00A5\u2510\u2514\u2534\u252C\u251C\u2500\u253C\u00E3\u00C3\u255A\u2554\u2569\u2566\u2560\u2550\u256C\u00A4\u00F0\u00D0\u00CA\u00CB\u00C8\u0131\u00CD\u00CE\u00CF\u2518\u250C\u2588\u2584\u00A6\u00CC\u2580\u00D3\u00DF\u00D4\u00D2\u00F5\u00D5\u00B5\u00FE\u00DE\u00DA\u00DB\u00D9\u00FD\u00DD\u00AF\u00B4\u00AD\u00B1\u2017\u00BE\u00B6\u00A7\u00F7\u00B8\u00B0\u00A8\u00B7\u00B9\u00B3\u00B2\u25A0\u00A0';
const DOS852 =
  '\u00C7\u00FC\u00E9\u00E2\u00E4\u016F\u0107\u00E7\u0142\u00EB\u0150\u0151\u00EE\u0179\u00C4\u0106\u00C9\u0139\u013A\u00F4\u00F6\u013D\u013E\u015A\u015B\u00D6\u00DC\u0164\u0165\u0141\u00D7\u010D\u00E1\u00ED\u00F3\u00FA\u0104\u0105\u017D\u017E\u0118\u0119\u00AC\u017A\u010C\u015F\u00AB\u00BB\u2591\u2592\u2593\u2502\u2524\u00C1\u00C2\u011A\u015E\u2563\u2551\u2557\u255D\u017B\u017C\u2510\u2514\u2534\u252C\u251C\u2500\u253C\u0102\u0103\u255A\u2554\u2569\u2566\u2560\u2550\u256C\u00A4\u0111\u0110\u010E\u00CB\u010F\u0147\u00CD\u00CE\u011B\u2518\u250C\u2588\u2584\u0162\u016E\u2580\u00D3\u00DF\u00D4\u0143\u0144\u0148\u0160\u0161\u0154\u00DA\u0155\u0170\u00FD\u00DD\u0163\u00B4\u00AD\u02DD\u02DB\u02C7\u02D8\u00A7\u00F7\u00B8\u00B0\u00A8\u02D9\u0171\u0158\u0159\u25A0\u00A0';
