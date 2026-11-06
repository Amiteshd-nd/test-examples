// Raw DEFLATE decoder (RFC 1951), so a `.plancraft` package that another program re-compressed
// still opens. Written from the RFC: canonical Huffman codes decoded bit by bit, which is plenty
// fast for plan-sized files. `maxOutput` guards against "zip bombs".

const LEN_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
  163, 195, 227, 258,
];
const LEN_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049,
  3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];
/** Order in which code-length code lengths are stored in a dynamic block. */
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

interface Huffman {
  /** Number of codes of each length 0–15. */
  count: Uint16Array;
  /** Symbols ordered by code. */
  symbol: Uint16Array;
}

function huffman(lengths: ArrayLike<number>): Huffman {
  const count = new Uint16Array(16);
  for (let i = 0; i < lengths.length; i++) count[lengths[i]!]!++;
  const offs = new Uint16Array(16);
  for (let len = 1; len < 15; len++) offs[len + 1] = offs[len]! + count[len]!;
  const symbol = new Uint16Array(lengths.length);
  for (let s = 0; s < lengths.length; s++) if (lengths[s]) symbol[offs[lengths[s]!]!++] = s;
  return { count, symbol };
}

const FIXED_LIT = huffman(
  Array.from({ length: 288 }, (_, s) => (s < 144 ? 8 : s < 256 ? 9 : s < 280 ? 7 : 8)),
);
const FIXED_DIST = huffman(new Array(30).fill(5));

export function inflateRaw(input: Uint8Array, maxOutput = 256 * 1024 * 1024): Uint8Array {
  let pos = 0;
  let bitBuf = 0;
  let bitCount = 0;
  let out = new Uint8Array(Math.max(1024, input.length * 4));
  let size = 0;

  const fail = (why: string): never => {
    throw new Error(`Damaged compressed data: ${why}.`);
  };
  const bits = (n: number): number => {
    while (bitCount < n) {
      if (pos >= input.length) fail('it ends too early');
      bitBuf |= input[pos++]! << bitCount;
      bitCount += 8;
    }
    const v = bitBuf & ((1 << n) - 1);
    bitBuf >>>= n;
    bitCount -= n;
    return v;
  };
  const room = (n: number) => {
    if (size + n > maxOutput) fail('it unpacks to more than the size limit');
    if (size + n <= out.length) return;
    let cap = out.length * 2;
    while (cap < size + n) cap *= 2;
    const next = new Uint8Array(Math.min(cap, maxOutput));
    next.set(out.subarray(0, size));
    out = next;
  };
  const decode = (h: Huffman): number => {
    let code = 0;
    let first = 0;
    let index = 0;
    for (let len = 1; len < 16; len++) {
      code |= bits(1);
      const count = h.count[len]!;
      if (code - count < first) return h.symbol[index + (code - first)]!;
      index += count;
      first = (first + count) << 1;
      code <<= 1;
    }
    return fail('a code is not in its table');
  };
  const codes = (lit: Huffman, dist: Huffman) => {
    for (;;) {
      const sym = decode(lit);
      if (sym < 256) {
        room(1);
        out[size++] = sym;
      } else if (sym === 256) return;
      else {
        const li = sym - 257;
        if (li >= 29) fail('a length code is out of range');
        const len = LEN_BASE[li]! + bits(LEN_EXTRA[li]!);
        const di = decode(dist);
        if (di >= 30) fail('a distance code is out of range');
        const d = DIST_BASE[di]! + bits(DIST_EXTRA[di]!);
        if (d > size) fail('a distance points before the start');
        room(len);
        for (let i = 0; i < len; i++, size++) out[size] = out[size - d]!;
      }
    }
  };

  for (let last = 0; !last;) {
    last = bits(1);
    const type = bits(2);
    if (type === 0) {
      bitBuf = 0;
      bitCount = 0;
      if (pos + 4 > input.length) fail('it ends too early');
      const len = input[pos]! | (input[pos + 1]! << 8);
      const nlen = input[pos + 2]! | (input[pos + 3]! << 8);
      if ((len ^ 0xffff) !== nlen) fail('a stored block has a bad length');
      pos += 4;
      if (pos + len > input.length) fail('it ends too early');
      room(len);
      out.set(input.subarray(pos, pos + len), size);
      size += len;
      pos += len;
    } else if (type === 1) codes(FIXED_LIT, FIXED_DIST);
    else if (type === 2) {
      const nLit = bits(5) + 257;
      const nDist = bits(5) + 1;
      const nCl = bits(4) + 4;
      const clLengths = new Uint8Array(19);
      for (let i = 0; i < nCl; i++) clLengths[CL_ORDER[i]!] = bits(3);
      const cl = huffman(clLengths);
      const lengths = new Uint8Array(nLit + nDist);
      for (let i = 0; i < nLit + nDist;) {
        const sym = decode(cl);
        if (sym < 16) lengths[i++] = sym;
        else {
          let value = 0;
          let repeat: number;
          if (sym === 16) {
            if (i === 0) fail('a repeat has nothing to repeat');
            value = lengths[i - 1]!;
            repeat = 3 + bits(2);
          } else repeat = sym === 17 ? 3 + bits(3) : 11 + bits(7);
          if (i + repeat > nLit + nDist) fail('code lengths run past the table');
          lengths.fill(value, i, i + repeat);
          i += repeat;
        }
      }
      if (!lengths[256]) fail('the block has no end code');
      codes(huffman(lengths.subarray(0, nLit)), huffman(lengths.subarray(nLit)));
    } else fail('a block type is unknown');
  }
  return out.slice(0, size);
}
