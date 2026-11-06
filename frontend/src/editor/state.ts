import type { Pick } from '@plancraft/engine';
import type { DisplayUnits } from '../ui/format.ts';
import type { PlanLayer } from '../ui/PlanView.tsx';
import type { ToolId } from './tools.ts';
import {
  initialPanels,
  isOpen,
  setCompact,
  setPanel,
  setWidth,
  toggleFocus,
  togglePanel,
  type PanelSide,
  type Panels,
  type ResizableSide,
  type SavedPanels,
} from './panels.ts';

// Editor shell state (P2.2): which panels are open, the current tool, units, snapping, hidden
// layers and the selection. View state only; plan changes go through engine commands (P2.4).
// The panels themselves (open, focus mode, overlays, widths) live in `panels.ts` (P2.2a).

export type LeftTab = 'layers' | 'rooms' | 'library';
export type RightTab = 'properties' | 'issues' | 'metrics';
/** The active tool (P2.5: `tools.ts` lists them all). */
export type Tool = ToolId;
export type Snap = 'grid' | 'endpoint' | 'midpoint' | 'perpendicular';

export interface EditorUi {
  panels: Panels;
  leftTab: LeftTab;
  rightTab: RightTab;
  tool: Tool;
  units: DisplayUnits;
  snaps: Snap[];
  hidden: PlanLayer[];
  /** The selected object (room, wall, opening, column, stair or separator). */
  selected: Pick | null;
}

export type EditorAction =
  | { type: 'toggleLeft'; tab?: LeftTab }
  | { type: 'toggleRight'; tab?: RightTab }
  | { type: 'toggleChat' }
  | { type: 'setPanel'; side: PanelSide; open: boolean }
  | { type: 'focusMode' }
  | { type: 'compact'; compact: boolean }
  | { type: 'panelWidth'; side: ResizableSide; width: number | null }
  | { type: 'setTool'; tool: Tool }
  | { type: 'setUnits'; units: DisplayUnits }
  | { type: 'toggleSnap'; snap: Snap }
  | { type: 'toggleLayer'; layer: PlanLayer }
  | { type: 'select'; pick: Pick | null };

/** On narrow screens panels cover the canvas, so they start closed. */
export const initialUi = (
  units: DisplayUnits = 'm',
  narrow = false,
  saved: SavedPanels | null = null,
): EditorUi => ({
  panels: initialPanels(narrow, saved),
  leftTab: 'rooms',
  rightTab: 'properties',
  tool: 'select',
  units,
  snaps: ['grid', 'endpoint', 'midpoint', 'perpendicular'],
  hidden: [],
  selected: null,
});

const toggleIn = <T>(list: T[], item: T) =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

/**
 * Clicking the open tab again closes its panel; another tab switches. On narrow screens panels
 * overlay the canvas, so at most one panel is open at a time. Nothing opens a panel by itself
 * (a selection only switches an open right panel to Properties).
 */
export function editorReducer(ui: EditorUi, action: EditorAction): EditorUi {
  switch (action.type) {
    case 'toggleLeft': {
      const tab = action.tab ?? ui.leftTab;
      const open = !(isOpen(ui.panels, 'left') && tab === ui.leftTab);
      return { ...ui, leftTab: tab, panels: setPanel(ui.panels, 'left', open) };
    }
    case 'toggleRight': {
      const tab = action.tab ?? ui.rightTab;
      const open = !(isOpen(ui.panels, 'right') && tab === ui.rightTab);
      return { ...ui, rightTab: tab, panels: setPanel(ui.panels, 'right', open) };
    }
    case 'toggleChat':
      return { ...ui, panels: togglePanel(ui.panels, 'chat') };
    case 'setPanel':
      return { ...ui, panels: setPanel(ui.panels, action.side, action.open) };
    case 'focusMode':
      return { ...ui, panels: toggleFocus(ui.panels) };
    case 'compact':
      return { ...ui, panels: setCompact(ui.panels, action.compact) };
    case 'panelWidth':
      return { ...ui, panels: setWidth(ui.panels, action.side, action.width) };
    case 'setTool':
      return { ...ui, tool: action.tool };
    case 'setUnits':
      return { ...ui, units: action.units };
    case 'toggleSnap':
      return { ...ui, snaps: toggleIn(ui.snaps, action.snap) };
    case 'toggleLayer':
      return { ...ui, hidden: toggleIn(ui.hidden, action.layer) };
    case 'select':
      return {
        ...ui,
        selected: action.pick,
        ...(action.pick && isOpen(ui.panels, 'right') ? { rightTab: 'properties' as const } : {}),
      };
  }
}
