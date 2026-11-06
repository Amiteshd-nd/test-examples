// Test cases ported from CADCraft `crates/dxf/src/codepage.rs` (commit 3b7eb1b, MIT; see
// THIRD_PARTY_NOTICES.md).
import { describe, expect, it } from 'vitest';
import { asciiCodePage, decodeCodePage, isUtf8Version } from './codepage.ts';
import { parseDxf, tagString } from './tags.ts';

/** Bytes from a string whose characters are all U+0000–U+00FF (one byte each). */
const bytes = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const utf8 = (s: string) => new TextEncoder().encode(s);
const latin = (b: Uint8Array | null) => (b ? String.fromCharCode(...b) : null);

describe('code pages', () => {
  it('decodes by $DWGCODEPAGE name', () => {
    const d = (b: string, cp: string) => decodeCodePage(bytes(b), cp);
    expect(d('\xCF\xF0\xE8\xE2\xE5\xF2', 'ANSI_1251')).toBe('Привет');
    expect(d('\xCF\xF0\xE8\xE2\xE5\xF2', ' ansi_1251 ')).toBe('Привет');
    expect(d('\x90\x7D\x96\xCA', 'ANSI_932')).toBe('図面');
    expect(d('\xCD\xBC\xB2\xE3', 'GB2312')).toBe('图层');
    expect(d('\xB9\xCF\xBC\x68', 'BIG5')).toBe('圖層');
    expect(d('\xB5\xB5\xB8\xE9', 'ANSI_949')).toBe('도면');
    expect(d('\xD3\xF7\xDD\xE4\xE9\xEF', 'ANSI_1253')).toBe('Σχέδιο');
    expect(d('\xC0\xD2\xBE', 'ANSI_874')).toBe('ภาพ');
    expect(d('\x80', 'ANSI_1252')).toBe('€');
    // DOS 437 and 850 agree on letters but differ on 0x9B (¢ / ø).
    expect(d('Gr\x94\xE1e \x9B', 'DOS437')).toBe('Größe ¢');
    expect(d('Gr\x94\xE1e \x9B', 'dos850')).toBe('Größe ø');
    expect(d('\xBD\xA2\x88w', 'DOS852')).toBe('Żółw');
    expect(d('\x91\xAB\xAE\xA9', 'DOS866')).toBe('Слой');
    expect(decodeCodePage(utf8('é'), 'UTF8')).toBe('é');
    expect(d('x', 'ANSI_1361')).toBeNull();
    expect(d('x', 'EBCDIC')).toBeNull();
    expect(d('x', '')).toBeNull();
  });

  it('turns invalid sequences into replacement characters, keeping line ends', () => {
    expect(decodeCodePage(bytes('\x90\n1\n'), 'ANSI_932')).toBe('\uFFFD\n1\n');
    expect(decodeCodePage(bytes('\x90'), 'ANSI_932')).toBe('\uFFFD');
    expect(decodeCodePage(bytes('\xFF\xFF'), 'ANSI_936')).toBe('\uFFFD\uFFFD');
  });

  it('finds $DWGCODEPAGE in the HEADER section only', () => {
    const head =
      '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n9\n$DWGCODEPAGE\n3\nANSI_1251\r\n0\nENDSEC\n';
    expect(latin(asciiCodePage(bytes(head)))).toBe('ANSI_1251');
    expect(
      asciiCodePage(bytes('0\nSECTION\n2\nHEADER\n0\nENDSEC\n9\n$DWGCODEPAGE\n3\nANSI_1251\n')),
    ).toBeNull();
    expect(asciiCodePage(bytes('9\n$DWGCODEPAGE\n1\nANSI_1251\n'))).toBeNull();
    expect(asciiCodePage(bytes('9\n$DWGCODEPAGE\n3'))).toBeNull();
    expect(isUtf8Version('AC1021') && isUtf8Version(' AC1032 ')).toBe(true);
    expect(isUtf8Version('AC1018') || isUtf8Version('AC1009') || isUtf8Version('garbage')).toBe(
      false,
    );
  });

  it('decodes \\M+ double-byte escapes and keeps unknown ones literal', () => {
    const one = (s: string) => {
      const r = parseDxf(utf8(`1\n${s}\n0\nEOF\n`));
      if (!r.ok) throw new Error(r.error.kind);
      return tagString(r.tags[0]!);
    };
    expect(one('\\M+5BCFE\\M+1907D\\M+2B9CF\\M+3B5B5!')).toBe('件図圖도!');
    expect(one('\\M+5BCFE\\U+0021')).toBe('件!');
    for (const s of [
      '\\M+4ABCD',
      '\\M+9BCFE',
      '\\M+5GGGG',
      '\\M+5BC',
      '\\M+',
      '\\M+50041',
      '\\M+5FFFF',
    ]) {
      expect(one(s)).toBe(s);
    }
  });
});
