import type { DragEvent, KeyboardEvent, MouseEvent, ReactNode } from 'react';

// Folder art and tiles for the Vault (A2 §4.2, design/DESIGN.md → Vault): glass folders with
// plan papers, colour folders with a badge, archive folders with a size badge. Shared by the
// dashboard (P14.3) and the component page (P14.1).

export type FolderColour = 'graphite' | 'blue' | 'orange' | 'green' | 'purple' | 'red';
export interface Person {
  initials: string;
  colour: string;
  name?: string;
}

export function GlassFolder({
  colour = 'graphite',
  papers = [],
  people = [],
  updated,
}: {
  colour?: FolderColour;
  /** Up to three plan drawings shown as papers. */
  papers?: ReactNode[];
  people?: Person[];
  updated?: string;
}) {
  return (
    <div className="fart" data-colour={colour}>
      <div className="fart-back" />
      {papers.slice(0, 3).map((p, i) => (
        <div key={i} className="fart-paper">
          {p}
        </div>
      ))}
      <div className="fart-front">
        <span className="fart-avatars">
          {people.map((p) => (
            <span key={p.initials} style={{ background: p.colour }} title={p.name}>
              {p.initials}
            </span>
          ))}
        </span>
        {updated && <span className="fart-pill">{updated}</span>}
      </div>
    </div>
  );
}

export function ColourFolder({ colour, badge }: { colour: FolderColour; badge?: string }) {
  return (
    <div className="fart fart--colour" data-colour={colour}>
      <div className="fart-back" />
      <span className="fart-chip">Aa</span>
      <span className="fart-chip">§</span>
      <div className="fart-front">{badge && <span className="fart-pill">{badge}</span>}</div>
    </div>
  );
}

export function ArchiveFolder({ badge }: { badge: string }) {
  return (
    <div className="fart fart--archive">
      <div className="fart-back" />
      <div className="fart-front">
        <span className="fart-zip" />
        <span className="fart-pill">{badge}</span>
      </div>
    </div>
  );
}

export type TileState = 'is-hover' | 'is-dragover' | 'no-glass' | '';

export function Tile({
  name,
  meta,
  selected,
  state = '',
  children,
  ...events
}: {
  name: string;
  meta: string;
  selected?: boolean;
  state?: TileState;
  children: ReactNode;
  onClick?: (e: MouseEvent) => void;
  onDoubleClick?: (e: MouseEvent) => void;
  onContextMenu?: (e: MouseEvent) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  draggable?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onDragLeave?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
}) {
  return (
    <button type="button" className={`ftile ${state}`} aria-selected={selected} {...events}>
      {children}
      <span className="ftile-name">{name}</span>
      <span className="ftile-meta">{meta}</span>
    </button>
  );
}
