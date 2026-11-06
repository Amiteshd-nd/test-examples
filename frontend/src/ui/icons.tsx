import type { ReactNode } from 'react';

// Our own thin line icons (design/DESIGN.md → Icons): 20 px grid, 1.5 px stroke, no fills.
// Sized in rem so they follow the UI scale (DS-03); 20 → 1.25rem at 100 %.

const Svg = ({ children, size = 20 }: { children: ReactNode; size?: number }) => (
  <svg
    width={`${size / 16}rem`}
    height={`${size / 16}rem`}
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

export const Icon = {
  Select: () => (
    <Svg>
      <path d="M5 3l10 6.5-4.5 1.2L8.3 15z" />
    </Svg>
  ),
  Wall: () => (
    <Svg>
      <path d="M3 6h14M3 10h14M6 6v4M14 10v4M3 14h14" />
    </Svg>
  ),
  Door: () => (
    <Svg>
      <path d="M4 16h12M5 16V5" />
      <path d="M5 5a11 11 0 0 1 11 11" strokeDasharray="2 2" />
    </Svg>
  ),
  Window: () => (
    <Svg>
      <path d="M3 7h14v6H3zM3 10h14" />
    </Svg>
  ),
  Room: () => (
    <Svg>
      <path d="M4 4h12v12H4z" />
      <path d="M8 10h4" />
    </Svg>
  ),
  Stair: () => (
    <Svg>
      <path d="M4 4h12v12H4zM4 8h12M4 12h12M10 4v12" />
    </Svg>
  ),
  Measure: () => (
    <Svg>
      <path d="M3 10h14M3 7v6M17 7v6M7 9v2M10 9v2M13 9v2" />
    </Svg>
  ),
  Text: () => (
    <Svg>
      <path d="M5 5h10M10 5v11M8 16h4" />
    </Svg>
  ),
  Undo: () => (
    <Svg>
      <path d="M7 6L4 9l3 3M4 9h8a4 4 0 0 1 0 8h-2" />
    </Svg>
  ),
  Redo: () => (
    <Svg>
      <path d="M13 6l3 3-3 3M16 9H8a4 4 0 0 0 0 8h2" />
    </Svg>
  ),
  Chat: () => (
    <Svg>
      <path d="M3 4h14v10H9l-4 3v-3H3z" />
    </Svg>
  ),
  Bell: () => (
    <Svg>
      <path d="M5 13V9a5 5 0 0 1 10 0v4l1.5 2h-13zM8 17h4" />
    </Svg>
  ),
  Layers: () => (
    <Svg>
      <path d="M10 3l7 4-7 4-7-4zM3 11l7 4 7-4" />
    </Svg>
  ),
  Grid: () => (
    <Svg>
      <path d="M4 4h12v12H4zM8 4v12M12 4v12M4 8h12M4 12h12" />
    </Svg>
  ),
  Search: () => (
    <Svg>
      <circle cx="9" cy="9" r="5" />
      <path d="M13 13l4 4" />
    </Svg>
  ),
  Plus: () => (
    <Svg>
      <path d="M10 4v12M4 10h12" />
    </Svg>
  ),
  Minus: () => (
    <Svg>
      <path d="M4 10h12" />
    </Svg>
  ),
  ChevronDown: () => (
    <Svg size={16}>
      <path d="M6 8l4 4 4-4" />
    </Svg>
  ),
  ArrowRight: () => (
    <Svg>
      <path d="M4 10h12M12 6l4 4-4 4" />
    </Svg>
  ),
  ArrowUpRight: () => (
    <Svg size={16}>
      <path d="M6 14l8-8M8 6h6v6" />
    </Svg>
  ),
  Sun: () => (
    <Svg>
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" />
    </Svg>
  ),
  Moon: () => (
    <Svg>
      <path d="M15 12.5A6 6 0 0 1 7.5 5a6 6 0 1 0 7.5 7.5z" />
    </Svg>
  ),
  Eye: () => (
    <Svg>
      <path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z" />
      <circle cx="10" cy="10" r="2" />
    </Svg>
  ),
  Lock: () => (
    <Svg>
      <path d="M5 9h10v8H5zM7 9V6a3 3 0 0 1 6 0v3" />
    </Svg>
  ),
  Home: () => (
    <Svg>
      <path d="M3 9l7-6 7 6v8h-5v-5H8v5H3z" />
    </Svg>
  ),
  Sparkle: () => (
    <Svg>
      <path d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6zM15.5 14l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" />
    </Svg>
  ),
  Library: () => (
    <Svg>
      <path d="M4 4h3v12H4zM8.5 4h3v12h-3zM13 5l2.8-.8 2.6 11.4-2.8.8z" />
    </Svg>
  ),
  Template: () => (
    <Svg>
      <path d="M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z" strokeDasharray="0" />
    </Svg>
  ),
  Star: () => (
    <Svg>
      <path d="M10 3l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5L2.8 8.2l5-.6z" />
    </Svg>
  ),
  Shared: () => (
    <Svg>
      <circle cx="7" cy="7" r="3" />
      <path d="M2 17c0-3 2.2-5 5-5s5 2 5 5M13 5.5a3 3 0 0 1 0 5M15 12.5c1.8.6 3 2.2 3 4.5" />
    </Svg>
  ),
  Trash: () => (
    <Svg>
      <path d="M4 6h12M8 6V4h4v2M5.5 6l1 11h7l1-11" />
    </Svg>
  ),
  Settings: () => (
    <Svg>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" />
    </Svg>
  ),
  Help: () => (
    <Svg>
      <circle cx="10" cy="10" r="7" />
      <path d="M8 8a2 2 0 1 1 2.8 1.8c-.6.3-.8.7-.8 1.2V12M10 14.5v.5" />
    </Svg>
  ),
  File: () => (
    <Svg>
      <path d="M5 2.5h6.5L15 6v11.5H5zM11.5 2.5V6H15" />
    </Svg>
  ),
  Sheets: () => (
    <Svg>
      <path d="M4 4h9v12H4zM13 6h3v12H7v-2" />
    </Svg>
  ),
  ChevronRight: () => (
    <Svg size={16}>
      <path d="M8 6l4 4-4 4" />
    </Svg>
  ),
  List: () => (
    <Svg>
      <path d="M7 5h10M7 10h10M7 15h10M3 5h1M3 10h1M3 15h1" />
    </Svg>
  ),
  Upload: () => (
    <Svg>
      <path d="M10 13V3M6 7l4-4 4 4M3 13v4h14v-4" />
    </Svg>
  ),
  Download: () => (
    <Svg>
      <path d="M10 3v10M6 9l4 4 4-4M3 13v4h14v-4" />
    </Svg>
  ),
  Copy: () => (
    <Svg>
      <path d="M7 7h10v10H7zM13 7V3H3v10h4" />
    </Svg>
  ),
  Pencil: () => (
    <Svg>
      <path d="M13.5 3.5l3 3L7 16H4v-3zM11.5 5.5l3 3" />
    </Svg>
  ),
  Archive: () => (
    <Svg>
      <path d="M3 4h14v3H3zM4 7v9h12V7M8 10h4" />
    </Svg>
  ),
  Move: () => (
    <Svg>
      <path d="M2.5 4.5h5l1.5 1.5h8.5v10h-15zM8 11h6M12 9l2 2-2 2" />
    </Svg>
  ),
  More: () => (
    <Svg>
      <path d="M4.5 10h1M9.5 10h1M14.5 10h1" />
    </Svg>
  ),
  // Side panel shown / hidden (P2.2a). Temporary, until the A3 icon registry brings Phosphor's
  // `sidebar-simple`; the editor mirrors them for the right side.
  Sidebar: () => (
    <Svg>
      <path d="M3 4h14v12H3zM8 4v12M5 7.5h1M5 10h1M5 12.5h1" />
    </Svg>
  ),
  SidebarHidden: () => (
    <Svg>
      <path d="M3 4h14v12H3zM8 4v12" />
    </Svg>
  ),
};

/** A small folder in a folder colour, for the Vault tree. */
export const FolderIcon = ({ colour }: { colour: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M1.5 3.5a1 1 0 0 1 1-1h3.6l1.4 1.5h6a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"
      fill={`var(--folder-${colour}-to)`}
    />
    <path
      d="M1.5 6h13v6.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"
      fill={`var(--folder-${colour}-from)`}
    />
  </svg>
);
