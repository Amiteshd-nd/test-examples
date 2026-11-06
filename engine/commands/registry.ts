import type { AnyCommand } from './define.ts';
import { BASIC_COMMANDS } from './plan-commands.ts';
import { TOOL_COMMANDS } from './tool-commands.ts';

/** Every plan command, by id: what the bus, the typed form and the AI tools know (P2.4, P2.5). */
export const PLAN_COMMANDS: Readonly<Record<string, AnyCommand>> = {
  ...BASIC_COMMANDS,
  ...TOOL_COMMANDS,
};
