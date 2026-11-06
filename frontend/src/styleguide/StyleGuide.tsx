import {
  firstLevel,
  importDxf,
  oneBhkDxf,
  planDrawing,
  values,
  type Plan,
} from '@plancraft/engine';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Button,
  Card,
  ChatBubble,
  Checkbox,
  Chip,
  Dialog,
  Field,
  IconButton,
  IssueRow,
  MetricTile,
  NumberInput,
  PanelSection,
  RoundButton,
  ScaleBar,
  Segmented,
  Select,
  SelectionPill,
  Status,
  Switch,
  Tabs,
  TextInput,
  ToolCall,
  Toolbar,
  ToolbarSep,
  Tooltip,
} from '../ui/components.tsx';
import { scaleBarLength } from '../ui/format.ts';
import { Icon } from '../ui/icons.tsx';
import { PlanView } from '../ui/PlanView.tsx';

// The P2.1 style sheet: every token and component on one page, in light and dark (design/DESIGN.md).

const TOKENS = [
  'bg',
  'canvas',
  'surface',
  'surface-2',
  'surface-3',
  'line',
  'line-strong',
  'text',
  'text-muted',
  'text-faint',
  'ink',
  'accent',
  'accent-strong',
  'accent-soft',
  'accent-tint',
  'ok',
  'warn',
  'error',
];

function readTheme(): 'light' | 'dark' {
  try {
    return localStorage.getItem('plancraft-theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="sg-section">
      <header className="sg-section-head">
        <span className="pc-eyebrow">{String(n).padStart(2, '0')} /</span>
        <h2 className="pc-title">{title}</h2>
      </header>
      {children}
    </section>
  );
}

function Swatches({ theme }: { theme: string }) {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const css = getComputedStyle(document.documentElement);
    setValues(Object.fromEntries(TOKENS.map((t) => [t, css.getPropertyValue(`--${t}`).trim()])));
  }, [theme]);
  return (
    <div className="sg-swatches">
      {TOKENS.map((t) => (
        <div key={t} className="sg-swatch">
          <span className="sg-chip" style={{ background: `var(--${t})` }} />
          <span className="pc-mono">--{t}</span>
          <span className="pc-mono pc-muted">{values[t]}</span>
        </div>
      ))}
    </div>
  );
}

/** A plan drawn with the design tokens: the synthetic 1BHK, imported by the engine in the browser. */
function CanvasSample() {
  const result = useMemo(
    () => importDxf(oneBhkDxf({ unit: 'mm', header: true, polylines: false, wrapInBlock: false })),
    [],
  );
  const plan = result.plan as Plan;
  const level = firstLevel(plan);
  const drawing = useMemo(() => planDrawing(plan, result.rooms), [plan, result.rooms]);
  const selected = result.rooms[0]?.room_id;
  const [pxPerCm, setPxPerCm] = useState<number | null>(null);
  const scale = pxPerCm ? scaleBarLength(pxPerCm, 'm') : null;
  return (
    <div className="pc-marks">
      <div className="sg-canvas pc-dots">
        <div className="sg-canvas-draw">
          <PlanView
            drawing={drawing}
            selected={selected ? { kind: 'room', id: selected } : null}
            onScale={setPxPerCm}
          />
        </div>
        <div className="sg-canvas-overlay">
          <SelectionPill
            text={
              <>
                Selecting <b>{values(level.rooms)[0]?.name}</b>
              </>
            }
            action="Edit"
          />
          <Toolbar>
            <IconButton label="Select (V)" pressed>
              <Icon.Select />
            </IconButton>
            <ToolbarSep />
            <IconButton label="Wall (W)">
              <Icon.Wall />
            </IconButton>
            <IconButton label="Room (R)">
              <Icon.Room />
            </IconButton>
            <IconButton label="Door (D)">
              <Icon.Door />
            </IconButton>
            <IconButton label="Window (N)">
              <Icon.Window />
            </IconButton>
            <IconButton label="Stair">
              <Icon.Stair />
            </IconButton>
            <ToolbarSep />
            <IconButton label="Dimension">
              <Icon.Measure />
            </IconButton>
            <IconButton label="Text">
              <Icon.Text />
            </IconButton>
            <ToolbarSep />
            <IconButton label="Undo">
              <Icon.Undo />
            </IconButton>
            <IconButton label="Redo">
              <Icon.Redo />
            </IconButton>
          </Toolbar>
        </div>
        {scale && (
          <div className="sg-canvas-scale">
            <ScaleBar label={scale.label} width={scale.px} />
          </div>
        )}
      </div>
    </div>
  );
}

export function StyleGuide() {
  const [theme, setTheme] = useState<'light' | 'dark'>(readTheme);
  const [tab, setTab] = useState('properties');
  const [units, setUnits] = useState('m');
  const [snap, setSnap] = useState(true);
  const [vastu, setVastu] = useState(false);
  const [level, setLevel] = useState('Ground');
  const [dialog, setDialog] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('plancraft-theme', theme);
    } catch {
      // Private windows may block storage; the theme still applies for this visit.
    }
  }, [theme]);

  return (
    <div className="sg">
      <header className="sg-top">
        <span className="sg-wordmark">
          <span className="sg-mark" aria-hidden="true">
            ✛
          </span>{' '}
          PlanCraft
        </span>
        <Chip>Style sheet · P2.1</Chip>
        <span style={{ flex: 1 }} />
        <IconButton
          label={theme === 'light' ? 'Dark theme' : 'Light theme'}
          marks
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? <Icon.Moon /> : <Icon.Sun />}
        </IconButton>
      </header>

      <div className="sg-hero">
        <span className="pc-eyebrow">( Design system )</span>
        <h1 className="pc-display">
          <span className="pc-quiet">Draw it,</span> check it, build it.
        </h1>
        <p className="pc-muted">
          Every colour, type size and component of the editor. Approve this page before screens are
          built (P2.1).
        </p>
      </div>

      <Section n={1} title="Colour">
        <Swatches theme={theme} />
      </Section>

      <Section n={2} title="Type">
        <div className="sg-stack">
          <p className="pc-display">
            <span className="pc-quiet">Display</span> 40 / light
          </p>
          <p className="pc-title">Title 24 — Ground floor plan</p>
          <p className="pc-section">Section 15 — Selection (1)</p>
          <p>Body 13 — Rooms are measured from the walls around them.</p>
          <p className="pc-small">Small 12 — Door swing is a default (assumed).</p>
          <p className="pc-eyebrow">( Micro 11 — eyebrow )</p>
          <p className="pc-metric">10.66 m² · 3.77 × 2.77 m · 30 × 40 ft</p>
        </div>
      </Section>

      <Section n={3} title="Buttons">
        <div className="sg-row">
          <Button variant="primary">Export DXF</Button>
          <Button>Import</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">Delete wall</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button size="sm">Small</Button>
          <Button variant="primary" size="lg" pill>
            Sign in with email
          </Button>
          <RoundButton label="Next" />
          <IconButton label="Chat" marks>
            <Icon.Chat />
          </IconButton>
          <IconButton label="Issues" marks>
            <Icon.Bell />
          </IconButton>
          <IconButton label="Layers" pressed>
            <Icon.Layers />
          </IconButton>
          <button type="button" className="pc-link">
            Text link
          </button>
        </div>
      </Section>

      <Section n={4} title="Inputs and choices">
        <div className="sg-grid-3">
          <Field label="Room name">{(id) => <TextInput id={id} defaultValue="Bed Room" />}</Field>
          <Field label="Wall thickness" help="External walls are usually 23 cm.">
            {(id) => <NumberInput id={id} unit="cm" defaultValue="23" />}
          </Field>
          <Field label="Width" error="Must be at least 2.40 m for a bedroom (reference check).">
            {(id) => <NumberInput id={id} unit="m" defaultValue="2.20" error />}
          </Field>
          <Field label="Level">
            {(id) => (
              <Select
                id={id}
                options={['Ground', 'First', 'Terrace']}
                value={level}
                onChange={setLevel}
              />
            )}
          </Field>
          <Field label="Search">
            {(id) => <TextInput id={id} placeholder="Find a room, wall or command" />}
          </Field>
          <Field label="Email (sign-in style)">
            {(id) => <TextInput id={id} pill placeholder="Enter your email" />}
          </Field>
        </div>
        <div className="sg-row" style={{ marginTop: 'var(--pc-space-400)' }}>
          <Segmented label="Units" options={['m', 'ft-in']} value={units} onChange={setUnits} />
          <Switch label="Snap to grid" checked={snap} onChange={setSnap} />
          <Checkbox label="Vastu" checked={vastu} onChange={setVastu} />
          <Status tone="ok">Plan check passed</Status>
          <Status tone="warn">2 warnings</Status>
          <Status tone="error">1 error</Status>
          <Chip>LEVEL · GROUND ▾</Chip>
          <Chip accent>№ R1 · BEDROOM</Chip>
        </div>
      </Section>

      <Section n={5} title="Panels, cards and metrics">
        <div className="sg-grid-2">
          <div className="pc-panel">
            <div style={{ padding: '0 var(--pc-space-400)' }}>
              <Tabs
                value={tab}
                onChange={setTab}
                tabs={[
                  { id: 'properties', label: 'Properties' },
                  { id: 'issues', label: 'Issues', count: 3 },
                  { id: 'metrics', label: 'Metrics' },
                ]}
              />
            </div>
            <PanelSection title="Selection" count={1}>
              <div className="sg-props">
                <span className="pc-muted">Name</span>
                <TextInput defaultValue="Bed Room" aria-label="Name" />
                <span className="pc-muted">Type</span>
                <Select
                  label="Type"
                  options={['Bedroom', 'Master bedroom', 'Kitchen']}
                  value="Bedroom"
                  onChange={() => undefined}
                />
                <span className="pc-muted">Area</span>
                <span className="pc-mono">10.66 m²</span>
              </div>
            </PanelSection>
            <PanelSection title="Size limits" count={2} defaultOpen={false}>
              <span className="pc-muted">Hidden until opened.</span>
            </PanelSection>
          </div>
          <div className="sg-stack">
            <Card title={<span className="pc-section">Plan health</span>} opens>
              <div className="sg-grid-3 sg-tight">
                <MetricTile label="Built-up" value="26.35" unit="m²" bar="strong" />
                <MetricTile label="Carpet" value="20.99" unit="m²" bar="normal" />
                <MetricTile label="Efficiency" value="80" unit="%" bar="normal" />
              </div>
            </Card>
            <Card title={<span className="pc-section">Library</span>}>
              <span className="pc-small">01 / 30 × 40 ft · 2BHK · east facing</span>
            </Card>
          </div>
        </div>
      </Section>

      <Section n={6} title="Issues">
        <div className="pc-panel" style={{ padding: '0 var(--pc-space-400)' }}>
          <IssueRow
            issue={{
              severity: 'error',
              message: 'Bedroom 2 is 2.20 m wide; the reference minimum is 2.40 m.',
              how_to_fix: 'Widen Bedroom 2 by 20 cm, e.g. move wall W7 20 cm east.',
              object_ids: ['R4', 'W7'],
              source: 'NBC 2016 Part 3 (verify)',
            }}
          />
          <IssueRow
            issue={{
              severity: 'warning',
              message:
                'Living and Dining are inside one enclosed area, so each is measured as the whole area.',
              how_to_fix: 'Add a wall between them, or keep one room and remove the other.',
              object_ids: ['R1', 'R2'],
              source: 'PlanCraft plan check',
            }}
          />
          <IssueRow
            issue={{
              severity: 'info',
              message: 'Kitchen in the south-east: a usual Vastu placement.',
              how_to_fix: 'No change needed.',
              object_ids: ['R3'],
              source: 'Vastu (reference)',
            }}
          />
        </div>
      </Section>

      <Section n={7} title="Chat">
        <div className="pc-panel sg-chat">
          <div className="pc-chat">
            <ChatBubble from="user">
              Make the kitchen 30 cm wider and add a window on the east wall.
            </ChatBubble>
            <ToolCall
              tool="plan_execute"
              steps={['MOVE W5 by 30 cm east', 'ADD_WINDOW on W2, offset 1.20 m, width 1.20 m']}
              onUndo={() => undefined}
            />
            <ChatBubble from="assistant">
              Done. The kitchen is now 6.89 m² and the plan check still passes.
            </ChatBubble>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 'var(--pc-space-200)',
              marginTop: 'var(--pc-space-400)',
            }}
          >
            <div style={{ flex: 1 }}>
              <TextInput placeholder="Ask or instruct…" aria-label="Message" />
            </div>
            <Button variant="primary">Send</Button>
          </div>
        </div>
      </Section>

      <Section n={8} title="Floating layers">
        <div className="sg-row" style={{ alignItems: 'flex-start' }}>
          <Tooltip label="Wall" shortcut="W" />
          <Dialog
            inline
            title="Export DXF"
            footer={
              <>
                <Button variant="ghost">Cancel</Button>
                <Button variant="primary">Export</Button>
              </>
            }
          >
            <span>
              AutoCAD 2000, millimetres, standard layers. The file is checked before it is saved.
            </span>
          </Dialog>
          <Button onClick={() => setDialog(true)}>Open a real dialog</Button>
        </div>
        {dialog && (
          <Dialog
            title="Discard changes?"
            footer={
              <>
                <Button variant="ghost" onClick={() => setDialog(false)}>
                  Keep editing
                </Button>
                <Button variant="danger" onClick={() => setDialog(false)}>
                  Discard
                </Button>
              </>
            }
          >
            <span>Your last 3 edits are not saved.</span>
          </Dialog>
        )}
      </Section>

      <Section n={9} title="Canvas">
        <CanvasSample />
        <p className="pc-small" style={{ marginTop: 'var(--pc-space-200)' }}>
          Drawn by the engine in this browser from the synthetic test drawing: walls in ink, rooms
          tinted, the selected room in blueprint blue with grips.
        </p>
      </Section>
    </div>
  );
}
