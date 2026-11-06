import { useRef } from 'react';
import { Button, Dialog } from '../ui/components.tsx';
import { useModalFocus } from '../ui/modal.ts';
import { TOOL_LIST, keyLabel } from './tools.ts';

// Help (P2.5 ✅ "keyboard shortcuts documented"): every tool and its key, editing, view and
// panel keys, and how to type lengths and points while drawing (A2 M5). Opened from the rail.

const MOD = /Mac|iP(hone|ad|od)/.test(navigator.userAgent) ? '⌘' : 'Ctrl+';
const ALT = MOD === '⌘' ? '⌥' : 'Alt+';

const SECTIONS: [string, [string, string][]][] = [
  ['Tools', TOOL_LIST.map((t) => [keyLabel(t), t.label])],
  [
    'While a tool works',
    [
      ['Click', 'Place the next point, or pick an object'],
      ['Shift', 'Keep lines straight; turn in 15° steps'],
      ['Enter', 'Finish a polyline or a chain of walls'],
      ['Esc', 'Stop what the tool is doing; again to go back to Select'],
      ['450', 'Type a length (cm) along the cursor’s direction'],
      ['4.5m · 15\'6"', 'Lengths with units: m, cm, mm, feet and inches'],
      ['450<90', 'Length and angle (degrees, anticlockwise from east)'],
      ['@120,-30', 'Distance from the last point'],
      ['300,450', 'A point on the plan'],
    ],
  ],
  [
    'Editing',
    [
      [`${MOD}Z`, 'Undo'],
      [MOD === '⌘' ? '⇧⌘Z' : 'Ctrl+Y', 'Redo'],
      ['Delete', 'Delete the selection'],
      ['Drag', 'Move the selected object (Shift: straight; Esc: put back)'],
      [`${ALT}click`, 'Select the next object under the cursor (a hatch under a room)'],
      ['Esc', 'Clear the selection'],
    ],
  ],
  [
    'View',
    [
      ['Wheel', 'Zoom about the cursor'],
      ['Drag · Space + drag', 'Pan'],
      ['+ / −', 'Zoom in / out'],
      ['0', 'Fit the plan'],
      ['Arrows', 'Pan'],
    ],
  ],
  [
    'Panels and commands',
    [
      [`${MOD}K`, 'Command palette; type a command such as MOVE V1 0,0 30,0'],
      [`${MOD}\\`, 'Hide or show all panels'],
      [`${MOD}${ALT}[ · ${MOD}${ALT}]`, 'Hide or show the left / right panel'],
    ],
  ],
];

export function HelpDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(ref);
  return (
    <div
      ref={ref}
      className="pc-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <Dialog
        inline
        title="Keyboard and mouse"
        footer={
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        }
      >
        <div className="ed-help">
          {SECTIONS.map(([title, rows]) => (
            <section key={title}>
              <h3 className="pc-eyebrow">{title}</h3>
              <dl>
                {rows.map(([key, what]) => (
                  <div key={key + what} className="ed-help-row">
                    <dt>
                      <kbd className="pc-mono">{key}</kbd>
                    </dt>
                    <dd>{what}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
