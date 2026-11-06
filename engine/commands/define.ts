import type { z } from 'zod';
import { firstLevel } from '../schema/collections.ts';
import type { Level, Plan } from '../schema/plan.ts';

// What a command is (PRD §4.4, CLAUDE.md rule 11): defined once, used by the keyboard, the
// toolbar, the typed command line, the AI tools and host apps. `run` is pure and deterministic
// (A2 M2): new ids and times arrive in the params, never from a clock or random source.

export type Enabled = { ok: true } | { ok: false; reason: string };
export const OK: Enabled = { ok: true };
export const no = (reason: string): Enabled => ({ ok: false, reason });

/** How a parameter is written in the typed form, e.g. `MOVE W3 0,0 100,0`. */
/** `points` takes every following x,y word (a polyline, a hatch outline). */
export type TextKind = 'ids' | 'id' | 'point' | 'points' | 'number' | 'word' | 'text';
export interface TextParam {
  name: string;
  kind: TextKind;
  optional?: boolean;
}

export interface Command<P = unknown> {
  /** Upper-case id, e.g. `MOVE`; also the word typed on the command line. */
  id: string;
  label: string;
  /** What it does, for the command palette and the AI's tool list. */
  description: string;
  params: z.ZodType<P>;
  /** Positional parameters of the typed form; any parameter can also be written `name=value`. */
  text: TextParam[];
  /** Other words that run it on the command line (AutoCAD habits), e.g. `M` for MOVE. */
  aliases?: string[];
  /** A record parameter that collects every other `name=value` typed (SET's `props`). */
  textProps?: string;
  /** Whether the command can run with these params, and if not, why (shown to the user). */
  enabled(plan: Plan, params: P): Enabled;
  /** The plan after the command. Pure: same plan and params, same result. */
  run(plan: Plan, params: P): Plan;
}

/** A command with its parameter type erased, as kept in the registry. */
export type AnyCommand = Command<never>;

export const defineCommand = <P>(c: Command<P>): AnyCommand => c as unknown as AnyCommand;

/** The level a command works on: the one named in its params, or the plan's first level. */
export function levelOf(plan: Plan, id?: string): Level | undefined {
  return id === undefined ? firstLevel(plan) : plan.levels[id];
}

/** The plan with one level replaced. */
export const withLevel = (plan: Plan, level: Level): Plan => ({
  ...plan,
  levels: { ...plan.levels, [level.id]: level },
});
