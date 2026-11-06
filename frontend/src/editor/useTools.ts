import type { DerivedRoom, Level, Outcome, Pick, Point } from '@plancraft/engine';
import { PLAN_COMMANDS } from '@plancraft/engine';
import { useEffect, useRef, useState } from 'react';
import type { ToolClick } from './Canvas.tsx';
import {
  DEFAULT_OPTIONS,
  IDLE,
  snapFrom,
  toolClick,
  toolFinish,
  toolPreview,
  toolPrompt,
  toolTyped,
  type PreviewShape,
  type ToolId,
  type ToolOptions,
  type ToolState,
  type ToolStep,
} from './tools.ts';
import type { Editing } from './useEditing.ts';

// Runs the active tool in the editor (P2.5): canvas clicks, typed values and Enter / Esc go to
// `tools.ts`, the commands it asks for run through the editor's history (one undo step each),
// and its preview shows on the canvas — modify tools preview the real result through the
// engine, so what you see is what you get.

export interface Tools {
  state: ToolState;
  prompt: string;
  /** Why the last click did nothing, shown in the prompt line until the next action. */
  hint: string | null;
  options: ToolOptions;
  setOptions(o: ToolOptions): void;
  shapes: PreviewShape[];
  snapFrom: Point | undefined;
  click(c: ToolClick): void;
  typed(text: string): boolean;
  /** Enter. */
  finish(): void;
  /** Esc: drop the operation in progress (a polyline keeps what was drawn); true if there was one. */
  cancel(): boolean;
}

export function useTools(args: {
  tool: ToolId;
  setTool(t: ToolId): void;
  editing: Editing;
  level: Level;
  rooms: readonly DerivedRoom[];
  selected: Pick | null;
  select(p: Pick | null): void;
  cursor: { point: Point; shift?: boolean } | null;
  newId(): string;
  /** Runs once before a change, so a fitted view doesn't jump. */
  freeze(): void;
  report(out: Outcome, done: string): boolean;
}): Tools {
  const { tool, editing } = args;
  const [state, setState] = useState<ToolState>(IDLE);
  const [hint, setHint] = useState<string | null>(null);
  const [options, setOptions] = useState<ToolOptions>(DEFAULT_OPTIONS);
  // Changing tools drops what the last one was doing.
  const lastTool = useRef(tool);
  if (lastTool.current !== tool) {
    lastTool.current = tool;
    if (state !== IDLE) setState(IDLE);
    if (hint) setHint(null);
  }
  const ctx = {
    level: args.level,
    rooms: args.rooms,
    selected: args.selected,
    options,
    newId: args.newId,
  };

  // The live preview: drawing tools give shapes; modify tools a command previewed by the engine.
  const preview =
    tool === 'select'
      ? { shapes: [] }
      : toolPreview(tool, state, args.cursor?.point ?? null, ctx, args.cursor?.shift ?? false);
  const previewKey = preview.request ? JSON.stringify(preview.request) : '';
  useEffect(() => {
    // Back on Select (no drag is under way at that moment): drop the last tool's preview.
    if (tool === 'select') {
      if (editing.previewing) editing.endPreview();
      return;
    }
    if (preview.request && editing.preview(preview.request)) return;
    if (editing.previewing) editing.endPreview();
    // The request's text stands for the request; `editing` changes with every preview.
  }, [tool, previewKey]);

  const apply = (step: ToolStep) => {
    setState(step.state);
    setHint(step.message ?? null);
    if (step.select) args.select(step.select);
    if (step.request) {
      args.freeze();
      editing.endPreview();
      const id = step.request.op === 'execute' ? step.request.id : 'batch';
      const label = PLAN_COMMANDS[id]?.label ?? id;
      if (!args.report(editing.run(step.request), `${label}: done.`)) {
        setState(IDLE);
        return;
      }
    }
    if (step.done) args.setTool('select');
  };

  return {
    state,
    prompt: toolPrompt(tool, state),
    hint,
    options,
    setOptions,
    shapes: preview.shapes,
    snapFrom: snapFrom(state),
    click: (c) => apply(toolClick(tool, state, c, ctx)),
    typed(text) {
      const step = toolTyped(tool, state, text, args.cursor?.point ?? null, ctx);
      apply(step);
      return !step.message;
    },
    finish: () => apply(toolFinish(tool, state, ctx)),
    cancel() {
      if (state === IDLE && !hint) return false;
      editing.endPreview();
      apply(toolFinish(tool, state, ctx));
      return true;
    },
  };
}
