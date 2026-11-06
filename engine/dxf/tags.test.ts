// Test cases ported from CADCraft `crates/dxf` (src/lib.rs tests, tests/hardening.rs,
// tests/conformance.rs, tests/ascii_bom.rs; commit 3b7eb1b, MIT; see THIRD_PARTY_NOTICES.md).
// Binary-writer cases are left out with the binary writer.
import { describe, expect, it } from 'vitest';
import {
  dxfRecords,
  dxfSections,
  parseAsciiText,
  parseDxf,
  tagNumber,
  tagString,
  writeDxfAscii,
  type DxfTag,
} from './tags.ts';

const bytes = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const utf8 = (s: string) => new TextEncoder().encode(s);
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
const SENTINEL = bytes('AutoCAD Binary DXF\r\n\x1a\0');
const le16 = (n: number) => bytes(String.fromCharCode(n & 0xff, (n >> 8) & 0xff));
const f64 = (v: number) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setFloat64(0, v, true);
  return b;
};
const cstr = (code: number, s: Uint8Array) => concat(le16(code), s, bytes('\0'));
const binWith = (...parts: Uint8Array[]) => concat(SENTINEL, ...parts, cstr(0, bytes('EOF')));

function tags(input: Uint8Array | string, maxTags?: number): DxfTag[] {
  const opts = maxTags === undefined ? {} : { maxTags };
  const r = typeof input === 'string' ? parseDxf(utf8(input), opts) : parseDxf(input, opts);
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.tags;
}
const errorOf = (input: Uint8Array, maxTags?: number) => {
  const r = parseDxf(input, maxTags === undefined ? {} : { maxTags });
  return r.ok ? null : r.error;
};

describe('ASCII reading and writing', () => {
  it('round-trips tags and splits sections and records', () => {
    const t: DxfTag[] = [
      { code: 0, value: 'SECTION' },
      { code: 2, value: 'ENTITIES' },
      { code: 0, value: 'LINE' },
      { code: 8, value: '0' },
      { code: 10, value: 1.5 },
      { code: 20, value: 2 },
      { code: 62, value: 1 },
      { code: 0, value: 'ENDSEC' },
      { code: 0, value: 'EOF' },
    ];
    const back = tags(writeDxfAscii(t));
    expect(back).toEqual(t);
    const secs = dxfSections(back);
    expect(secs).toHaveLength(1);
    expect(secs[0]!.name).toBe('ENTITIES');
    const recs = dxfRecords(secs[0]!.tags);
    expect(recs[0]!.type).toBe('LINE');
    expect(recs[0]!.tags).toHaveLength(4);
  });

  it('reads and writes independently authored values', () => {
    const fixtures: [DxfTag, string][] = [
      [{ code: 1, value: ' A ' }, '  1\r\n A \r\n'],
      [{ code: 1, value: '' }, '  1\r\n\r\n'],
      [{ code: 105, value: 'AB12' }, '105\r\nAB12\r\n'],
      [{ code: 10, value: -3.25 }, ' 10\r\n-3.25\r\n'],
      [{ code: 70, value: -32768 }, ' 70\r\n-32768\r\n'],
      [{ code: 90, value: -2147483648 }, ' 90\r\n-2147483648\r\n'],
      [{ code: 160, value: 9007199254740991 }, '160\r\n9007199254740991\r\n'],
      [{ code: 290, value: false }, '290\r\n0\r\n'],
      [{ code: 299, value: true }, '299\r\n1\r\n'],
      [{ code: 310, value: '00FF80' }, '310\r\n00FF80\r\n'],
      [{ code: 1004, value: '' }, '1004\r\n\r\n'],
      [{ code: 1070, value: -2 }, '1070\r\n-2\r\n'],
      [{ code: 1071, value: 65536 }, '1071\r\n65536\r\n'],
    ];
    for (const [tag, ascii] of fixtures) {
      expect(tags(bytes(ascii))).toEqual([tag]);
      for (const u of [false, true]) expect(writeDxfAscii([tag], { utf8: u })).toBe(ascii);
    }
  });

  it('accepts a BOM, CR-only and mixed line ends', () => {
    const want: DxfTag[] = [
      { code: 0, value: 'SECTION' },
      { code: 2, value: 'ENTITIES' },
      { code: 0, value: 'ENDSEC' },
      { code: 0, value: 'EOF' },
    ];
    const text = '0\rSECTION\r2\rENTITIES\r0\rENDSEC\r0\rEOF\r';
    expect(tags(text)).toEqual(want);
    expect(tags(concat(bytes('\xEF\xBB\xBF'), utf8(text.replaceAll('\r', '\r\n'))))).toEqual(want);
    expect(tags('0\r\nSECTION\r2\nENTITIES\n0\rENDSEC\r\n0\nEOF')).toEqual(want);
    expect(parseAsciiText(`\uFEFF${text}`).ok).toBe(true);
  });

  it('accepts padding and a missing final newline', () => {
    const expected: DxfTag[] = [
      { code: 70, value: -7 },
      { code: 1, value: '  text  ' },
      { code: 0, value: 'EOF' },
    ];
    for (const nl of ['\n', '\r\n']) {
      for (const final of [false, true]) {
        const text = [' 70 ', ' -7 ', '1', '  text  ', '0', 'EOF'].join(nl) + (final ? nl : '');
        expect(tags(text)).toEqual(expected);
      }
    }
  });

  it('keeps sections and EOF despite trailing spaces', () => {
    const t = tags(
      '0\nSECTION  \n2\nENTITIES \n0\nLINE\n0\nENDSEC \n0\nEOF \n0\nSECTION\n2\nX\n0\nENDSEC\n',
    );
    expect(t).toHaveLength(5);
    const s = dxfSections(t);
    expect(s).toHaveLength(1);
    expect(s[0]!.name).toBe('ENTITIES');
    expect(s[0]!.tags).toHaveLength(1);
  });

  it('turns bad numbers into 0 and clamps integers to their group width', () => {
    expect(tagNumber(tags('10\nnotanumber\n0\nEOF\n')[0]!)).toBe(0);
    const t = tags(
      '70\ninf\n70\nNaN\n70\n1e30\n70\n-1e30\n90\n1e30\n160\n1e30\n160\n-inf\n62\n12.0\n0\nEOF\n',
    );
    expect(t.slice(0, 8).map((x) => x.value)).toEqual([
      0,
      0,
      65535,
      -32768,
      4294967295,
      Number(2n ** 63n - 1n),
      0,
      12,
    ]);
    // An unsigned value reads the same in either spelling.
    const u = tags('70\n65535.0\n70\n65535\n90\n4294967295.0\n90\n4294967295\n0\nEOF\n');
    expect(u.slice(0, 4).map((x) => x.value)).toEqual([65535, 65535, 4294967295, 4294967295]);
  });

  it('pads odd hex digits, drops junk, and splits long chunks without injecting tags', () => {
    const t = tags('310\nABC\n310\nA-B zC1\n310\n\n1004\n0aF\n0\nEOF\n');
    expect(t.slice(0, 4).map((x) => x.value)).toEqual(['ABC0', 'ABC1', '', '0aF0']);
    const evil = writeDxfAscii([
      { code: 310, value: 'AB\r\n0\r\nEOF' },
      { code: 0, value: 'EOF' },
    ]);
    const back = tags(evil);
    expect(back).toHaveLength(2);
    expect(back[0]!.value).toBe('AB0EF0');
    const long = tags(
      writeDxfAscii([
        { code: 310, value: 'AB'.repeat(300) },
        { code: 0, value: 'EOF' },
      ]),
    );
    expect(long.filter((x) => x.code === 310).map((x) => tagString(x).length)).toEqual([
      254, 254, 92,
    ]);
    expect(
      tags(
        writeDxfAscii([
          { code: 310, value: '' },
          { code: 0, value: 'EOF' },
        ]),
      )[0]!.code,
    ).toBe(310);
  });
});

describe('text and escapes', () => {
  it('decodes \\U+ escapes and Latin-1 bytes', () => {
    expect(tagString(tags(bytes('1\nCaf\\U+00E9\n0\nEOF\n'))[0]!)).toBe('Café');
    expect(tagString(tags(bytes('1\nCaf\xe9\n0\nEOF\n'))[0]!)).toBe('Café');
  });

  it('joins surrogate-pair escapes', () => {
    expect(tagString(tags('1\n\\U+D83D\\U+DE00 \\u+56fe\\U+53f7\n0\nEOF\n')[0]!)).toBe(
      '😀 \\u+56fe号',
    );
  });

  it('keeps hostile escapes literal', () => {
    const cases = [
      '\\U+',
      '\\U',
      '\\',
      'a\\U+ZZZZ',
      '\\U+12',
      '\\U+D800',
      '\\U+DC00',
      '\\U+D800\\U+0041',
      '\\U+D83D\\U+DE',
      '\\U++123',
      '\\U+-123',
      'x\\U+12é4',
    ];
    for (const s of cases) {
      const expected = s === '\\U+D800\\U+0041' ? '\\U+D800A' : s;
      expect(tagString(tags(`1\n${s}\n0\nEOF\n`)[0]!)).toBe(expected);
    }
  });

  it('writes non-ASCII as escapes (or UTF-8) and reads them back', () => {
    const t: DxfTag[] = [
      { code: 1, value: '图号 Ä°ø 😀\r\nend' },
      { code: 1000, value: 'Ø' },
      { code: 0, value: 'EOF' },
    ];
    const text = writeDxfAscii(t);
    expect([...text].every((c) => c.charCodeAt(0) < 0x80)).toBe(true);
    expect(text).toContain('\\U+56FE\\U+53F7 \\U+00C4\\U+00B0\\U+00F8 \\U+D83D\\U+DE00  end\r\n');
    const back = tags(text);
    expect(tagString(back[0]!)).toBe('图号 Ä°ø 😀  end');
    expect(tagString(back[1]!)).toBe('Ø');

    const one: DxfTag[] = [{ code: 1, value: 'é😀' }];
    expect(writeDxfAscii(one)).toBe('  1\r\n\\U+00E9\\U+D83D\\U+DE00\r\n');
    expect(writeDxfAscii(one, { utf8: true })).toBe('  1\r\né😀\r\n');
    expect(tags(writeDxfAscii(one))).toEqual(one);
    expect(tags(writeDxfAscii(one, { utf8: true }))).toEqual(one);
  });

  it('round-trips text that looks like an escape', () => {
    for (const u of [false, true]) {
      for (const text of ['\\U+00E9', '\\M+183A4F', 'a\\nb \\P', '\\\\U+00E9', '\\U+005C']) {
        expect(tags(writeDxfAscii([{ code: 8, value: text }], { utf8: u }))).toEqual([
          { code: 8, value: text },
        ]);
      }
    }
  });

  it('decodes each line on its own: one bad byte spoils one line, not the file', () => {
    const b = concat(
      bytes('9\n$DWGCODEPAGE\n3\nANSI_1251\n1\n'),
      utf8('Größe'),
      bytes('\n1\n\xCF\xF0\xE8\xE2\xE5\xF2\n0\nEOF\n'),
    );
    const t = tags(b);
    expect(t.slice(1, 4).map(tagString)).toEqual(['ANSI_1251', 'Größe', 'Привет']);
  });

  it('reads pre-2007 code-page bytes', () => {
    const ascii = bytes(
      '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n9\n$DWGCODEPAGE\n3\nANSI_1252\n0\nENDSEC\n1\n\x80\xe9\n0\nEOF\n',
    );
    const binary = concat(
      SENTINEL,
      bytes(
        '\0\0SECTION\0\x02\0HEADER\0\x09\0$ACADVER\0\x01\0AC1015\0\x09\0$DWGCODEPAGE\0\x03\0ANSI_1252\0\0\0ENDSEC\0\x01\0\x80\xe9\0\0\0EOF\0',
      ),
    );
    for (const b of [ascii, binary]) expect(tags(b)[7]).toEqual({ code: 1, value: '€é' });
  });

  it('reports an unknown code page as a warning', () => {
    const r = parseDxf(bytes('9\n$DWGCODEPAGE\n3\nEBCDIC\n1\nCaf\xe9\n0\nEOF\n'));
    expect(r.ok && r.warnings).toEqual([
      'Unknown code page "EBCDIC"; text was read as Windows-1252.',
    ]);
    expect(r.ok && tagString(r.tags[2]!)).toBe('Café');
  });
});

describe('binary DXF', () => {
  it('reads independently authored binary values', () => {
    const fixtures: [DxfTag, string][] = [
      [{ code: 1, value: ' A ' }, '\x01\0 A \0'],
      [{ code: 1, value: '' }, '\x01\0\0'],
      [{ code: 105, value: 'AB12' }, '\x69\0AB12\0'],
      [{ code: 10, value: -3.25 }, '\x0a\0\0\0\0\0\0\0\x0a\xc0'],
      [{ code: 70, value: -32768 }, '\x46\0\0\x80'],
      [{ code: 90, value: -2147483648 }, '\x5a\0\0\0\0\x80'],
      [{ code: 160, value: -1 }, '\xa0\0\xff\xff\xff\xff\xff\xff\xff\xff'],
      [{ code: 290, value: false }, '\x22\x01\0'],
      [{ code: 299, value: true }, '\x2b\x01\x01'],
      [{ code: 310, value: '00FF80' }, '\x36\x01\x03\0\xff\x80'],
      [{ code: 1004, value: '' }, '\xec\x03\0'],
      [{ code: 1070, value: -2 }, '\x2e\x04\xfe\xff'],
      [{ code: 1071, value: 65536 }, '\x2f\x04\0\0\x01\0'],
    ];
    for (const [tag, bin] of fixtures) expect(tags(concat(SENTINEL, bytes(bin)))).toEqual([tag]);
  });

  it('reads a small file and unescapes strings', () => {
    const b = concat(
      SENTINEL,
      cstr(0, bytes('LINE')),
      le16(10),
      f64(3.25),
      le16(62),
      le16(5),
      cstr(0, bytes('EOF')),
    );
    const t = tags(b);
    expect(t[1]).toEqual({ code: 10, value: 3.25 });
    expect(t[2]).toEqual({ code: 62, value: 5 });
    expect(tagString(tags(binWith(cstr(1, bytes('\\U+56FE\\U+53F7'))))[0]!)).toBe('图号');
  });

  it('turns non-finite reals into 0 and stops at an EOF with trailing spaces', () => {
    for (const v of [NaN, Infinity, -Infinity]) {
      expect(tags(binWith(le16(10), f64(v)))[0]).toEqual({ code: 10, value: 0 });
    }
    expect(tags(concat(SENTINEL, cstr(0, bytes('EOF  ')), cstr(1, bytes('after'))))).toHaveLength(
      1,
    );
  });

  it('reads strings from the code page, unlike ASCII which prefers UTF-8 per line', () => {
    const asUtf8 = utf8('Größe');
    const latin = bytes('Caf\xE9');
    const a = concat(
      bytes('9\n$DWGCODEPAGE\n3\nANSI_1252\n1\n'),
      asUtf8,
      bytes('\n1\n'),
      latin,
      bytes('\n0\nEOF\n'),
    );
    const b = binWith(
      cstr(9, bytes('$DWGCODEPAGE')),
      cstr(3, bytes('ANSI_1252')),
      cstr(1, asUtf8),
      cstr(1, latin),
    );
    const fromAscii = tags(a);
    const fromBinary = tags(b);
    expect(tagString(fromAscii[2]!)).toBe('Größe');
    expect(tagString(fromAscii[3]!)).toBe('Café');
    expect(tagString(fromBinary[2]!)).toBe('GrÃ¶ÃŸe');
    expect(tagString(fromBinary[3]!)).toBe('Café');
  });

  /** Strings of a `$DWGCODEPAGE`-declared file, as ASCII text and as a binary file. */
  const bothForms = (codePage: string, strings: Uint8Array[]) => {
    const a = concat(
      bytes(`9\n$DWGCODEPAGE\n3\n${codePage}\n`),
      ...strings.flatMap((s) => [bytes('1\n'), s, bytes('\n')]),
      bytes('0\nEOF\n'),
    );
    const b = binWith(
      cstr(9, bytes('$DWGCODEPAGE')),
      cstr(3, bytes(codePage)),
      ...strings.map((s) => cstr(1, s)),
    );
    return [tags(a), tags(b)];
  };

  it('keeps short East Asian strings that look like UTF-8 in the code page', () => {
    for (const t of bothForms('ANSI_932', [bytes('\xC3\xB1'), bytes('\x90\x7D\x96\xCA')])) {
      expect(tagString(t[2]!)).toBe('\uFF83\uFF71');
      expect(tagString(t[3]!)).toBe('図面');
    }
  });

  it('reads an East Asian file that is all UTF-8 as UTF-8', () => {
    for (const t of bothForms('ANSI_932', [utf8('図面'), bytes('\xC3\xB1'), bytes('plain')])) {
      expect(t.slice(2, 5).map(tagString)).toEqual(['図面', 'ñ', 'plain']);
    }
  });
});

describe('malformed input and limits', () => {
  it('reports errors instead of crashing', () => {
    expect(errorOf(bytes(''))).toEqual({ kind: 'not_dxf' });
    expect(errorOf(bytes('oops\nvalue\n'))).toEqual({ kind: 'bad_code', line: 1, text: 'oops' });
    expect(errorOf(bytes('abc\nxyz\n'))?.kind).toBe('bad_code');
    expect(errorOf(bytes('10\n'))).toEqual({ kind: 'eof' });
    expect(errorOf(bytes('0\n'))).toEqual({ kind: 'eof' });
    expect(errorOf(SENTINEL)).toEqual({ kind: 'not_dxf' });
    expect(errorOf(concat(SENTINEL, le16(10), bytes('\x01\x02\x03')))).toEqual({ kind: 'eof' });
  });

  it('treats every cut inside a binary record as truncation', () => {
    const records = [
      '\x01\0 A \0',
      '\x0a\0\0\0\0\0\0\0\x0a\xc0',
      '\x46\0\0\x80',
      '\x5a\0\0\0\0\x80',
      '\x36\x01\x03\0\xff\x80',
    ];
    for (const rec of records) {
      for (let cut = 1; cut < rec.length; cut++) {
        expect(errorOf(concat(SENTINEL, bytes(rec.slice(0, cut))))).toEqual({ kind: 'eof' });
      }
    }
  });

  it('enforces the tag limit at the exact boundary', () => {
    const ascii = bytes('1\nA\n70\n-7\n0\nEOF\n');
    const binary = concat(SENTINEL, bytes('\x01\0A\0\x46\0\xf9\xff\0\0EOF\0'));
    for (const b of [ascii, binary]) {
      for (const limit of [0, 1, 2])
        expect(errorOf(b, limit)).toMatchObject({ kind: 'too_large', limit });
      for (const limit of [3, 4]) {
        expect(tags(b, limit)).toEqual([
          { code: 1, value: 'A' },
          { code: 70, value: -7 },
          { code: 0, value: 'EOF' },
        ]);
      }
    }
  });

  it('does not count blank lines, and counts CR-only files correctly', () => {
    expect(tags(bytes('0\nEOF\n\n\n'), 1)).toEqual([{ code: 0, value: 'EOF' }]);
    const text = '999\rcomment\r'.repeat(50) + '0\rEOF\r';
    expect(errorOf(bytes(text), 10)?.kind).toBe('too_large');
    expect(tags(bytes(text), 100)).toHaveLength(51);
  });
});
