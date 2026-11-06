import type { IdSource } from '../ids.ts';
import type { AnyCommand, TextKind } from './define.ts';
import type { CommandCall } from './history.ts';
import { PLAN_COMMANDS } from './registry.ts';

// The typed form of commands (PRD §4.4): `MOVE W3 0,0 100,0`, `ADD_WALL 0,0 500,0 type=external`,
// `SET D1 width=100 swing=out-left`. Lengths and points are in cm. Words are positional in the
// order the command lists, or `name=value`; "quotes" keep spaces; 'single quotes' hold JSON. A new object's id comes from
// the host's IdSource when it isn't typed (A2 M2). `formatCommand` writes a call back as text.

export type ParseResult = { ok: true; call: CommandCall } | { ok: false; message: string };

interface Token {
  /** Set for `name=value`. */
  name?: string;
  value: string;
  quoted: boolean;
}

const POINT = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/;
const NUMBER = /^-?\d+(?:\.\d+)?$/;

const tokenize = (text: string): Token[] =>
  [...text.matchAll(/(?:([A-Za-z_]\w*)=)?(?:"([^"]*)"|'([^']*)'|(\S+))/g)].map((m) => ({
    ...(m[1] !== undefined ? { name: m[1] } : {}),
    value: m[2] ?? m[3] ?? m[4]!,
    quoted: m[4] === undefined,
  }));

/** A typed value: by the parameter's kind when known, otherwise by its look. */
function read(kind: TextKind | undefined, raw: string, quoted: boolean): unknown {
  if (kind === 'ids') return raw.split(',').filter(Boolean);
  if (kind === 'id' || kind === 'word' || kind === 'text') return raw;
  if (kind === 'point') {
    const m = POINT.exec(raw);
    if (!m) throw new Error(`"${raw}" is not a point; write it as x,y in cm, e.g. 120,0.`);
    return [Number(m[1]), Number(m[2])];
  }
  if (kind === 'number') {
    if (!NUMBER.test(raw)) throw new Error(`"${raw}" is not a number.`);
    return Number(raw);
  }
  if (quoted) {
    if (/^[[{]/.test(raw)) {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return raw;
      }
    }
    return raw;
  }
  const point = POINT.exec(raw);
  if (point) return [Number(point[1]), Number(point[2])];
  if (NUMBER.test(raw)) return Number(raw);
  if (raw === 'true' || raw === 'false') return raw === 'true';
  if (raw === 'null') return null;
  return raw;
}

const shapeOf = (c: AnyCommand) =>
  (c.params as unknown as { shape?: Record<string, unknown> }).shape ?? {};

/** The command a typed word names: its id or one of its aliases, in any case. */
export function findCommand(
  word: string,
  commands: Readonly<Record<string, AnyCommand>> = PLAN_COMMANDS,
): AnyCommand | undefined {
  const w = word.toUpperCase();
  return (
    commands[w] ??
    Object.values(commands).find((c) => c.aliases?.some((a) => a.toUpperCase() === w))
  );
}

export function parseCommand(
  text: string,
  options: { commands?: Readonly<Record<string, AnyCommand>>; ids?: IdSource } = {},
): ParseResult {
  const commands = options.commands ?? PLAN_COMMANDS;
  const [first, ...rest] = tokenize(text.trim());
  if (!first) return { ok: false, message: 'Type a command, e.g. MOVE W1 0,0 100,0.' };
  const command = findCommand(first.value, commands);
  if (!command)
    return {
      ok: false,
      message: `There is no command ${first.value}. Commands: ${Object.keys(commands).join(', ')}.`,
    };
  const known = new Set(Object.keys(shapeOf(command)));
  const params: Record<string, unknown> = {};
  const props: Record<string, unknown> = {};
  try {
    let next = 0;
    for (let i = 0; i < rest.length; i++) {
      const t = rest[i]!;
      if (t.name !== undefined) {
        const spec = command.text.find((s) => s.name === t.name);
        if (spec || known.has(t.name)) params[t.name] = read(spec?.kind, t.value, t.quoted);
        else if (command.textProps) props[t.name] = read(undefined, t.value, t.quoted);
        else throw new Error(`${command.id} has no setting "${t.name}".`);
        continue;
      }
      while (next < command.text.length && command.text[next]!.name in params) next++;
      const spec = command.text[next];
      if (!spec) throw new Error(`Too many values for ${command.id}: "${t.value}".`);
      next++;
      if (spec.kind === 'points') {
        // A list of points: this word and every following x,y word.
        const list = [read('point', t.value, t.quoted)];
        while (
          i + 1 < rest.length &&
          rest[i + 1]!.name === undefined &&
          POINT.test(rest[i + 1]!.value)
        )
          list.push(read('point', rest[++i]!.value, false));
        params[spec.name] = list;
      } else if (spec.kind === 'text' && !t.quoted) {
        // Unquoted text takes the remaining plain words: ADD_ROOM 100,100 bedroom Guest room
        const words = [t.value];
        while (i + 1 < rest.length && rest[i + 1]!.name === undefined) words.push(rest[++i]!.value);
        params[spec.name] = words.join(' ');
      } else params[spec.name] = read(spec.kind, t.value, t.quoted);
    }
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  if (command.textProps)
    params[command.textProps] = { ...(params[command.textProps] ?? {}), ...props };
  // A new object's id comes from the host before the command runs (A2 M2).
  if (known.has('id') && !command.text.some((s) => s.name === 'id') && params.id === undefined) {
    if (!options.ids) return { ok: false, message: `${command.id} needs an id, e.g. id=W12.` };
    params.id = options.ids.next();
  }
  const missing = command.text.find((s) => !s.optional && !(s.name in params));
  if (missing)
    return {
      ok: false,
      message: `${command.id} needs ${missing.name}: ${usage(command)}`,
    };
  const parsed = command.params.safeParse(params);
  if (!parsed.success) {
    const e = parsed.error.issues[0]!;
    return {
      ok: false,
      message: `${command.id}: ${e.path.join('.') || 'value'} ${e.message.toLowerCase()}.`,
    };
  }
  return { ok: true, call: { id: command.id, params: parsed.data } };
}

/** How to type a command, e.g. `MOVE ids from to`. */
export function usage(command: AnyCommand): string {
  return [command.id, ...command.text.map((s) => (s.optional ? `[${s.name}]` : s.name))].join(' ');
}

function write(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 2 && value.every((v) => typeof v === 'number')) return value.join(',');
    if (value.every((v) => typeof v === 'string' && !/[\s,"]/.test(v))) return value.join(',');
    return `'${JSON.stringify(value)}'`;
  }
  if (typeof value === 'object' && value !== null) return `'${JSON.stringify(value)}'`;
  if (typeof value === 'string')
    return value.includes('"')
      ? `'${value}'`
      : value === '' || /[\s"=]/.test(value) || POINT.test(value) || NUMBER.test(value)
        ? `"${value}"`
        : value;
  return String(value);
}

/** A call written as text that `parseCommand` reads back to the same call. */
export function formatCommand(
  call: CommandCall,
  commands: Readonly<Record<string, AnyCommand>> = PLAN_COMMANDS,
): string {
  const command = commands[call.id];
  const params = { ...((call.params ?? {}) as Record<string, unknown>) };
  if (!command) return call.id;
  const parts = [command.id];
  for (const spec of command.text) {
    const value = params[spec.name];
    if (value === undefined) break;
    if (spec.kind === 'points') parts.push(...(value as number[][]).map((p) => p.join(',')));
    else parts.push(write(value));
    delete params[spec.name];
  }
  const props = command.textProps ? (params[command.textProps] as Record<string, unknown>) : null;
  if (command.textProps) delete params[command.textProps];
  for (const [k, v] of Object.entries({ ...params, ...(props ?? {}) }))
    if (v !== undefined) parts.push(`${k}=${write(v)}`);
  return parts.join(' ');
}
