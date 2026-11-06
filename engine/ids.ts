// Ids and time come from the host (PRD §3.4 `IdSource`, `Clock`; A2 M2): the engine never reads
// the clock or a random source, so the same inputs always give the same result and tests can
// be repeated. Ids are ULIDs: sortable by time and unique across users and devices.

export interface IdSource {
  next(): string;
}

export interface Clock {
  /** The current time as an ISO 8601 string in UTC, e.g. "2026-11-06T10:00:00.000Z". */
  now(): string;
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * A ULID from a time in milliseconds and 10 random bytes (the host supplies both, e.g. from
 * `Date.now()` and `crypto.getRandomValues`): 10 characters of time, 16 of randomness.
 */
export function formatUlid(timeMs: number, random: ArrayLike<number>): string {
  if (!Number.isInteger(timeMs) || timeMs < 0 || timeMs > 2 ** 48 - 1)
    throw new Error('ULID time must be a whole number of milliseconds from 1970 to 10889');
  if (random.length < 10) throw new Error('A ULID needs 10 random bytes');
  let time = '';
  for (let t = timeMs, i = 0; i < 10; i++, t = Math.floor(t / 32)) time = CROCKFORD[t % 32] + time;
  // 80 random bits → 16 characters of 5 bits each.
  let bits = 0;
  let acc = 0;
  let rand = '';
  for (let i = 0; i < 10; i++) {
    acc = (acc << 8) | (random[i]! & 0xff);
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      rand += CROCKFORD[(acc >> bits) & 31];
    }
    acc &= (1 << bits) - 1;
  }
  return time + rand;
}

/** Ids `prefix-0001`, `prefix-0002`, … for tests and fixtures. */
export function sequentialIds(prefix = 'id'): IdSource {
  let n = 0;
  return { next: () => `${prefix}-${String(++n).padStart(4, '0')}` };
}

/** A clock that starts at `start` and moves on `stepMs` every time it is read (for tests). */
export function steppingClock(start = '2026-11-06T10:00:00.000Z', stepMs = 1000): Clock {
  let t = Date.parse(start);
  return {
    now: () => {
      const s = new Date(t).toISOString();
      t += stepMs;
      return s;
    },
  };
}
