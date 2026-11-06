import type { ReactNode } from 'react';
import { Icon } from '../ui/icons.tsx';
import type { ToolId } from './tools.ts';

// Toolbar icons for the P2.5 tools, drawn like `ui/icons.tsx` (20 px grid, 1.5 px stroke, no
// fills, rem-sized). Temporary until the A3 icon registry (PI.1–PI.3) replaces them all.

const Svg = ({ children }: { children: ReactNode }) => (
  <svg
    width="1.25rem"
    height="1.25rem"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="square"
    strokeLinejoin="miter"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const NEW: Partial<Record<ToolId, () => ReactNode>> = {
  label: () => (
    <Svg>
      <path d="M3 4h14v12H3z" />
      <path d="M6 9h8M6 12h5" />
    </Svg>
  ),
  separator: () => (
    <Svg>
      <path d="M3 4h14v12H3z" />
      <path d="M10 4v2M10 9v2M10 14v2" />
    </Svg>
  ),
  line: () => (
    <Svg>
      <path d="M3 16l5-9 5 5 4-8" />
    </Svg>
  ),
  rectangle: () => (
    <Svg>
      <path d="M3 5h14v10H3z" />
    </Svg>
  ),
  hatch: () => (
    <Svg>
      <path d="M3 3h14v14H3z" />
      <path d="M3 9l6-6M3 15L15 3M9 17l8-8" />
    </Svg>
  ),
  move: () => (
    <Svg>
      <path d="M10 2v16M2 10h16M7 5l3-3 3 3M7 15l3 3 3-3M5 7l-3 3 3 3M15 7l3 3-3 3" />
    </Svg>
  ),
  rotate: () => (
    <Svg>
      <path d="M15.5 7A6 6 0 1 0 16 12" />
      <path d="M16 3v4h-4" />
    </Svg>
  ),
  mirror: () => (
    <Svg>
      <path d="M10 2v16" strokeDasharray="2 2" />
      <path d="M7 5L3 15h4zM13 5l4 10h-4z" />
    </Svg>
  ),
  offset: () => (
    <Svg>
      <path d="M3 13h11M3 17h14" />
      <path d="M3 9l4-6h10" />
    </Svg>
  ),
  trim: () => (
    <Svg>
      <path d="M10 2v16M2 10h5" />
      <path d="M13 10h5" strokeDasharray="1.5 2" />
    </Svg>
  ),
  extend: () => (
    <Svg>
      <path d="M17 2v16M2 10h9" />
      <path d="M11 10h4M12 7l3 3-3 3" />
    </Svg>
  ),
};

/** The icon for a tool: an existing one where it fits, else a new one above. */
export function ToolIcon({ tool }: { tool: ToolId }): ReactNode {
  switch (tool) {
    case 'select':
      return <Icon.Select />;
    case 'wall':
      return <Icon.Wall />;
    case 'room':
      return <Icon.Room />;
    case 'door':
      return <Icon.Door />;
    case 'window':
      return <Icon.Window />;
    case 'stair':
      return <Icon.Stair />;
    case 'dimension':
      return <Icon.Measure />;
    case 'text':
      return <Icon.Text />;
    case 'copy':
      return <Icon.Copy />;
    case 'delete':
      return <Icon.Trash />;
    default:
      return NEW[tool]?.() ?? null;
  }
}
