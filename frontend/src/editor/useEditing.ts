import {
  canRedo,
  canUndo,
  createHistory,
  execute,
  preview,
  redo,
  undo,
  type CommandRequest,
  type History,
  type Outcome,
  type Plan,
} from '@plancraft/engine';
import { useRef, useState } from 'react';

// Editing a plan in the editor (P2.4): every change goes through the engine's commands, one
// undo step each. A drag shows a preview every frame and is executed once when it ends (A2 M7).
// Library plans are read-only. Undo is this user's own (A2 M8; one user until accounts).

export const READ_ONLY =
  'This is a plan from the Plan Library, shown read-only. Use it as a starting point in the Vault to edit it.';

export interface Editing {
  /** The plan as saved: every executed change, no preview. */
  plan: Plan;
  /** What to draw: the drag preview while there is one, otherwise `plan`. */
  shown: Plan;
  previewing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  run(request: CommandRequest): Outcome;
  undo(): Outcome;
  redo(): Outcome;
  /** Shows what a request would do, without recording it; false if it can't run. */
  preview(request: CommandRequest): boolean;
  endPreview(): void;
}

const refused = (message: string): Outcome => ({ ok: false, code: 'not_possible', message });

export function useEditing(initial: Plan, editable: boolean): Editing {
  const [history, setHistory] = useState<History>(() => createHistory(initial));
  // The latest history, so several calls in one event build on each other.
  const latest = useRef(history);
  latest.current = history;
  const [draft, setDraft] = useState<Plan | null>(null);

  const commit = (step: { history: History; outcome: Outcome }) => {
    latest.current = step.history;
    setHistory(step.history);
    return step.outcome;
  };
  const ts = () => new Date().toISOString();
  return {
    plan: history.plan,
    shown: draft ?? history.plan,
    previewing: draft !== null,
    canUndo: editable && canUndo(history),
    canRedo: editable && canRedo(history),
    run(request) {
      if (!editable) return refused(READ_ONLY);
      return commit(execute(latest.current, { ts: ts(), ...request }));
    },
    undo() {
      if (!editable) return refused(READ_ONLY);
      return commit(undo(latest.current, undefined, ts()));
    },
    redo() {
      if (!editable) return refused(READ_ONLY);
      return commit(redo(latest.current, undefined, ts()));
    },
    preview(request) {
      if (!editable) return false;
      const result = preview(latest.current, request);
      if (result.ok) setDraft(result.plan);
      return result.ok;
    },
    endPreview: () => setDraft(null),
  };
}
