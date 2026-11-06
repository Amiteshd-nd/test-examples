import { Plan } from '../schema/plan.ts';
import { apply, applyChecked, diff, invert, type Patch } from './changeset.ts';
import type { AnyCommand } from './define.ts';
import { PLAN_COMMANDS } from './registry.ts';

// The command bus (PRD §4.4, P2.4): every change to a plan is a command (or a batch of them)
// that becomes one changeset (A2 M9) and one undo step. Undo is per author (A2 M8): it reverts
// your own last change, keeps what others changed since, and says what it had to skip. A drag
// is previewed while it moves and executed once when it ends; steps of one gesture (e.g. a
// value nudged with the arrow keys) merge into one undo step (A2 M7). Everything is pure: each
// call returns a new history.

export interface CommandCall {
  id: string;
  params: unknown;
}

interface RequestBase {
  /** Fails safely when the plan is no longer at this revision (someone else changed it). */
  revision?: number;
  /** Makes a retry harmless: a request id seen recently returns its first outcome again. */
  request_id?: string;
  /** Who asks; undo and redo are per author. */
  author?: string;
  /** When, from the host's clock (A2 M2). */
  ts?: string;
  /** Steps sharing a gesture id merge into one undo step. */
  gesture?: string;
}
/** The AI tool / host call format of PRD §4.4. */
export type CommandRequest =
  | (RequestBase & { op: 'execute'; id: string; params: unknown })
  | (RequestBase & { op: 'batch'; steps: CommandCall[] });

export interface Changeset {
  id: string;
  author: string;
  /** The revision the change was made on, and the one it produced. */
  base_rev: number;
  rev: number;
  command:
    CommandCall | { op: 'batch'; steps: CommandCall[] } | { op: 'undo' | 'redo'; of: string };
  patches: Patch[];
  ts?: string;
  gesture?: string;
}

export type FailureCode =
  | 'unknown_command'
  | 'invalid_params'
  | 'not_possible'
  | 'stale'
  | 'invalid_result'
  | 'nothing_to_undo'
  | 'nothing_to_redo';

export type Outcome =
  | {
      ok: true;
      /** Null when the command changed nothing. */
      changeset: Changeset | null;
      /** Undo / redo: parts left out because they were changed since (A2 M8). */
      skipped?: Patch[];
    }
  | { ok: false; code: FailureCode; message: string; /** Batch step that failed. */ step?: number };

export interface History {
  plan: Plan;
  rev: number;
  /** Changesets applied, oldest first (the most recent `LOG_LIMIT`). */
  log: Changeset[];
  /** Per author, newest last. */
  undo: Readonly<Record<string, Changeset[]>>;
  redo: Readonly<Record<string, Changeset[]>>;
  requests: { id: string; outcome: Outcome }[];
}

export interface BusOptions {
  /** The commands available; the built-in plan commands by default. */
  commands?: Readonly<Record<string, AnyCommand>>;
}

export const UNDO_LIMIT = 200;
const LOG_LIMIT = 1000;
const REQUEST_MEMORY = 100;
const LOCAL = 'local';

export function createHistory(plan: Plan, rev = 0): History {
  return { plan, rev, log: [], undo: {}, redo: {}, requests: [] };
}

export const canUndo = (h: History, author = LOCAL) => (h.undo[author]?.length ?? 0) > 0;
export const canRedo = (h: History, author = LOCAL) => (h.redo[author]?.length ?? 0) > 0;

const fail = (code: FailureCode, message: string, step?: number): Outcome =>
  step === undefined ? { ok: false, code, message } : { ok: false, code, message, step };

/** Runs commands on a plan without recording anything; null plan means a step failed. */
function runSteps(
  plan: Plan,
  steps: readonly CommandCall[],
  commands: Readonly<Record<string, AnyCommand>>,
): { plan: Plan } | { failure: Outcome } {
  let cur = plan;
  for (const [i, call] of steps.entries()) {
    const step = steps.length > 1 ? i : undefined;
    const command = commands[call.id];
    if (!command)
      return { failure: fail('unknown_command', `There is no command ${call.id}.`, step) };
    const parsed = command.params.safeParse(call.params);
    if (!parsed.success) {
      const e = parsed.error.issues[0]!;
      const where = e.path.length ? `${e.path.join('.')}: ` : '';
      return {
        failure: fail('invalid_params', `${command.label}: ${where}${e.message}.`, step),
      };
    }
    const params = parsed.data as never;
    const enabled = command.enabled(cur, params);
    if (!enabled.ok) return { failure: fail('not_possible', enabled.reason, step) };
    try {
      cur = command.run(cur, params);
    } catch (e) {
      return { failure: fail('not_possible', (e as Error).message, step) };
    }
  }
  return { plan: cur };
}

const stepsOf = (r: CommandRequest): CommandCall[] =>
  r.op === 'batch' ? r.steps : [{ id: r.id, params: r.params }];

/**
 * The plan a request would produce, without recording it: for previewing a drag every frame.
 * Skips the final format check, which `execute` does once at the end.
 */
export function preview(
  h: History,
  request: CommandRequest,
  options: BusOptions = {},
): { ok: true; plan: Plan } | Extract<Outcome, { ok: false }> {
  const r = runSteps(h.plan, stepsOf(request), options.commands ?? PLAN_COMMANDS);
  return 'plan' in r ? { ok: true, plan: r.plan } : (r.failure as Extract<Outcome, { ok: false }>);
}

/** The format check every recorded result passes (the plan schema). */
function checkResult(plan: Plan): Outcome | null {
  const parsed = Plan.safeParse(plan);
  if (parsed.success) return null;
  const e = parsed.error.issues[0]!;
  return fail(
    'invalid_result',
    `The change would leave the plan invalid at ${e.path.join('.')}: ${e.message}.`,
  );
}

const push = <T>(list: readonly T[] | undefined, item: T, limit: number) =>
  [...(list ?? []), item].slice(-limit);

function remember(h: History, request: CommandRequest, outcome: Outcome): History {
  if (!request.request_id) return h;
  return {
    ...h,
    requests: push(h.requests, { id: request.request_id, outcome }, REQUEST_MEMORY),
  };
}

/** Runs a command or an all-or-nothing batch as one undo step. */
export function execute(
  h: History,
  request: CommandRequest,
  options: BusOptions = {},
): { history: History; outcome: Outcome } {
  const seen = request.request_id && h.requests.find((r) => r.id === request.request_id);
  if (seen) return { history: h, outcome: seen.outcome };
  if (request.revision !== undefined && request.revision !== h.rev) {
    const outcome = fail(
      'stale',
      `The plan changed since revision ${request.revision} (it is now at ${h.rev}). Read it again and retry.`,
    );
    return { history: h, outcome };
  }
  const steps = stepsOf(request);
  const ran = runSteps(h.plan, steps, options.commands ?? PLAN_COMMANDS);
  if ('failure' in ran) return { history: remember(h, request, ran.failure), outcome: ran.failure };
  const invalid = checkResult(ran.plan);
  if (invalid) return { history: remember(h, request, invalid), outcome: invalid };

  const author = request.author ?? LOCAL;
  const mine = h.undo[author] ?? [];
  const last = mine.at(-1);
  // Another step of the same gesture: one undo step from before the gesture to now.
  const merging =
    request.gesture !== undefined && last?.gesture === request.gesture && h.log.at(-1) === last;
  const from = merging ? apply(h.plan, invert(last.patches)) : h.plan;
  const patches = diff(from, ran.plan);
  if (!patches.length && !merging) {
    const outcome: Outcome = { ok: true, changeset: null };
    return { history: remember(h, request, outcome), outcome };
  }

  const changeset: Changeset = {
    id: merging ? last.id : (request.request_id ?? `r${h.rev + 1}`),
    author,
    base_rev: merging ? last.base_rev : h.rev,
    rev: h.rev + 1,
    command: request.op === 'batch' ? { op: 'batch', steps } : steps[0]!,
    patches,
    ...(request.ts !== undefined ? { ts: request.ts } : {}),
    ...(request.gesture !== undefined ? { gesture: request.gesture } : {}),
  };
  const keep = patches.length > 0;
  const log = merging ? h.log.slice(0, -1) : h.log;
  const undoList = merging ? mine.slice(0, -1) : mine;
  const history: History = {
    ...h,
    plan: ran.plan,
    rev: h.rev + 1,
    log: keep ? push(log, changeset, LOG_LIMIT) : log,
    undo: { ...h.undo, [author]: keep ? push(undoList, changeset, UNDO_LIMIT) : undoList },
    redo: { ...h.redo, [author]: [] },
  };
  const outcome: Outcome = { ok: true, changeset: keep ? changeset : null };
  return { history: remember(history, request, outcome), outcome };
}

function step(
  h: History,
  author: string,
  kind: 'undo' | 'redo',
  ts?: string,
): { history: History; outcome: Outcome } {
  const from = kind === 'undo' ? h.undo : h.redo;
  const to = kind === 'undo' ? h.redo : h.undo;
  const target = from[author]?.at(-1);
  if (!target)
    return {
      history: h,
      outcome: fail(
        kind === 'undo' ? 'nothing_to_undo' : 'nothing_to_redo',
        kind === 'undo' ? 'Nothing to undo.' : 'Nothing to redo.',
      ),
    };
  const wanted = kind === 'undo' ? invert(target.patches) : target.patches;
  const result = applyChecked(h.plan, wanted);
  const invalid = result.applied.length ? checkResult(result.doc) : null;
  if (invalid) return { history: h, outcome: invalid };
  const changeset: Changeset = {
    id: `${target.id}.${kind}${h.rev + 1}`,
    author,
    base_rev: h.rev,
    rev: h.rev + 1,
    command: { op: kind, of: target.id },
    patches: result.applied,
    ...(ts !== undefined ? { ts } : {}),
  };
  // What moves to the other stack is what was really changed, so a partial undo redoes only
  // its own part.
  const moved: Changeset = {
    ...target,
    patches: kind === 'undo' ? invert(result.applied) : result.applied,
  };
  const history: History = {
    ...h,
    plan: result.doc,
    rev: h.rev + 1,
    log: push(h.log, changeset, LOG_LIMIT),
    [kind === 'undo' ? 'undo' : 'redo']: { ...from, [author]: from[author]!.slice(0, -1) },
    [kind === 'undo' ? 'redo' : 'undo']: {
      ...to,
      [author]: moved.patches.length ? push(to[author], moved, UNDO_LIMIT) : (to[author] ?? []),
    },
  };
  return {
    history,
    outcome: {
      ok: true,
      changeset: result.applied.length ? changeset : null,
      ...(result.skipped.length ? { skipped: result.skipped } : {}),
    },
  };
}

/** Undoes `author`'s last change; parts changed by others since are kept and reported. */
export const undo = (h: History, author = LOCAL, ts?: string) => step(h, author, 'undo', ts);
/** Redoes `author`'s last undone change. */
export const redo = (h: History, author = LOCAL, ts?: string) => step(h, author, 'redo', ts);

/**
 * Applies a changeset made elsewhere (another tab, a teammate, the server). It joins the log
 * but not this author's undo list, so undo never reverts someone else's work (A2 M8).
 */
export function applyRemote(h: History, changeset: Changeset): History {
  const result = applyChecked(h.plan, changeset.patches);
  return {
    ...h,
    plan: result.doc,
    rev: h.rev + 1,
    log: push(h.log, { ...changeset, patches: result.applied, rev: h.rev + 1 }, LOG_LIMIT),
  };
}
