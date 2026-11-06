import type { Plan } from '@plancraft/engine';
import { useEffect, useState, type ReactNode } from 'react';
import { Button, Chip, IconButton, Segmented } from '../ui/components.tsx';
import { FolderIcon, Icon } from '../ui/icons.tsx';
import { PlanThumbnail } from '../ui/PlanThumbnail.tsx';
import {
  ArchiveFolder,
  ColourFolder,
  GlassFolder,
  Tile,
  type FolderColour as Colour,
  type Person,
} from './folder-art.tsx';
import { DEMO_PLANS, FILES, PEOPLE, TREE, type PersonKey } from './demo.ts';

// P14.1 component page: the Vault (A2 §4) in its default dark theme and in light, with every
// state of the folder tiles. Static: nothing here is wired to storage yet (P14.2–P14.3).

function readTheme(): 'light' | 'dark' {
  try {
    return localStorage.getItem('plancraft-vault-theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

const Avatar = ({ who, size }: { who: PersonKey; size?: number }) => (
  <span
    className="vlt-avatar"
    style={{
      background: PEOPLE[who].colour,
      width: size && `${size / 16}rem`,
      height: size && `${size / 16}rem`,
    }}
    title={PEOPLE[who].name}
  >
    {who}
  </span>
);

const people = (keys: PersonKey[]): Person[] =>
  keys.map((k) => ({ initials: k, colour: PEOPLE[k].colour, name: PEOPLE[k].name }));
const papers = (plans: Plan[]) => plans.map((p, i) => <PlanThumbnail key={i} plan={p} />);

function Sidebar() {
  const nav: [string, ReactNode, boolean][] = [
    ['Home', <Icon.Home key="h" />, true],
    ['Ask AI', <Icon.Sparkle key="a" />, false],
    ['Plan Library', <Icon.Library key="l" />, false],
    ['Templates', <Icon.Template key="t" />, false],
  ];
  return (
    <aside className="vlt-side">
      <button type="button" className="vlt-workspace">
        <span className="vlt-avatar-sq">SD</span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontWeight: 500 }}>Studio Demo</span>
          <span className="pc-small">6 members</span>
        </span>
        <Icon.ChevronDown />
      </button>
      <div className="pc-input-wrap vlt-search">
        <Icon.Search />
        <input className="pc-input" placeholder="Search…" aria-label="Search" />
        <span className="vlt-kbd">⌘K</span>
      </div>
      {nav.map(([label, icon, active]) => (
        <button
          key={label}
          type="button"
          className="vlt-nav"
          aria-current={active ? 'page' : undefined}
        >
          {icon}
          {label}
        </button>
      ))}
      <div className="vlt-group">
        <span className="pc-eyebrow">Projects</span>
        <IconButton label="New folder">
          <Icon.Plus />
        </IconButton>
      </div>
      <div role="tree">
        {TREE.map((f) => (
          <button
            key={f.id}
            type="button"
            role="treeitem"
            className="vlt-tree-row"
            aria-selected={f.id === '3040'}
            style={{ paddingLeft: `${(8 + f.depth * 16) / 16}rem` }}
          >
            <span className="vlt-twist">
              {'open' in f ? <Icon.ChevronDown /> : 'closed' in f ? <Icon.ChevronRight /> : null}
            </span>
            <FolderIcon colour={f.colour} />
            <span>{f.name}</span>
            <span className="vlt-count">{f.count}</span>
          </button>
        ))}
      </div>
      <div className="vlt-foot">
        {(
          [
            ['Starred', <Icon.Star key="s" />],
            ['Shared with me', <Icon.Shared key="sh" />],
            ['Trash', <Icon.Trash key="t" />],
            ['Settings', <Icon.Settings key="st" />],
            ['Help', <Icon.Help key="hp" />],
          ] as [string, ReactNode][]
        ).map(([label, icon]) => (
          <button key={label} type="button" className="vlt-nav">
            {icon}
            {label}
          </button>
        ))}
        <button type="button" className="vlt-nav">
          <Avatar who="A" size={20} />
          Asha Rao
        </button>
      </div>
    </aside>
  );
}

function FilesTable() {
  const status = {
    draft: ['Draft', ''],
    review: ['In review', 'vlt-status--review'],
    approved: ['Approved', 'vlt-status--approved'],
  } as const;
  return (
    <table className="vlt-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Owner</th>
          <th>Edited</th>
          <th>Branches</th>
          <th>Status</th>
          <th>Size</th>
        </tr>
      </thead>
      <tbody>
        {FILES.map((f, i) => (
          <tr key={f.name} aria-selected={i === 0}>
            <td>
              <span className="vlt-file">
                {f.kind === 'plan' ? <Icon.File /> : <Icon.Sheets />}
                {f.name}
              </span>
            </td>
            <td>
              <span className="vlt-person">
                <Avatar who={f.owner} />
                {PEOPLE[f.owner].name}
              </span>
            </td>
            <td>
              <span className="vlt-person">
                {f.edited} <Avatar who={f.editedBy} size={20} />
              </span>
            </td>
            <td className="pc-mono">{f.branches}</td>
            <td>
              <span className={`vlt-status ${status[f.status][1]}`}>{status[f.status][0]}</span>
            </td>
            <td className="pc-mono pc-muted">{f.size}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Palette() {
  const groups: [string, [ReactNode, string, string?][]][] = [
    [
      'Files',
      [
        [<Icon.File key="f" />, '30x40 East 3BHK', '↵'],
        [<Icon.File key="g" />, '30x40 West 2BHK'],
      ],
    ],
    ['Folders', [[<FolderIcon key="fo" colour="blue" />, 'Residential › 30×40 plots']]],
    [
      'Commands',
      [
        [<Icon.Plus key="p" />, 'New plan', 'N'],
        [<Icon.Plus key="q" />, 'New folder', '⇧N'],
        [<Icon.File key="i" />, 'Import DXF…'],
      ],
    ],
    ['Ask AI', [[<Icon.Sparkle key="s" />, 'Find all 30×40 east-facing plans']]],
  ];
  return (
    <div className="vlt-palette" role="dialog" aria-label="Command palette">
      <div className="vlt-palette-input">
        <Icon.Search />
        <input defaultValue="30x40" aria-label="Search files, folders and commands" />
        <span className="vlt-kbd">esc</span>
      </div>
      {groups.map(([title, items]) => (
        <div key={title} className="vlt-palette-group">
          <span className="pc-eyebrow">{title}</span>
          {items.map(([icon, label, kbd], i) => (
            <div
              key={label}
              className="vlt-palette-item"
              aria-selected={title === 'Files' && i === 0}
            >
              {icon}
              {label}
              {kbd && <span className="vlt-kbd">{kbd}</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
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

export function VaultPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>(readTheme);
  const [view, setView] = useState('grid');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('plancraft-vault-theme', theme);
    } catch {
      // Storage can be blocked; the theme still applies for this visit.
    }
  }, [theme]);
  const colours: Colour[] = ['graphite', 'blue', 'orange', 'green', 'purple', 'red'];

  return (
    <div className="sg" style={{ maxWidth: '80rem' }}>
      <header className="sg-top">
        <span className="sg-wordmark">
          <span className="sg-mark" aria-hidden="true">
            ✛
          </span>{' '}
          PlanCraft
        </span>
        <Chip>Vault components · P14.1</Chip>
        <span style={{ flex: 1 }} />
        <IconButton
          label={theme === 'light' ? 'Dark theme' : 'Light theme'}
          marks
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? <Icon.Moon /> : <Icon.Sun />}
        </IconButton>
      </header>

      <Section n={1} title="Dashboard">
        <div className="vlt">
          <Sidebar />
          <main className="vlt-main">
            <div className="vlt-head">
              <span className="vlt-crumbs">
                Projects <Icon.ChevronRight /> Residential <Icon.ChevronRight /> <b>30×40 plots</b>
              </span>
              <IconButton label="Search">
                <Icon.Search />
              </IconButton>
              <Button variant="primary" size="sm">
                <Icon.Plus /> New
              </Button>
            </div>
            <div className="vlt-section-title">
              <h3 className="pc-title">Folders</h3>
              <Segmented label="View" options={['grid', 'list']} value={view} onChange={setView} />
            </div>
            <div className="vlt-tiles">
              <Tile name="East facing" meta="3 files · 2 branches" selected>
                <GlassFolder
                  colour="graphite"
                  papers={papers(DEMO_PLANS)}
                  people={people(['A', 'R'])}
                  updated="Updated 2h"
                />
              </Tile>
              <Tile name="Rule packs" meta="6 packs · BBMP">
                <ColourFolder colour="blue" badge="v2.1" />
              </Tile>
              <Tile name="Archive 2024" meta="40 files">
                <ArchiveFolder badge="ZIP · 1.2 GB" />
              </Tile>
              <Tile name="Corner plots" meta="2 files">
                <GlassFolder
                  colour="orange"
                  papers={papers(DEMO_PLANS.slice(1))}
                  people={people(['M'])}
                  updated="Updated today"
                />
              </Tile>
            </div>
            <div className="vlt-section-title">
              <h3 className="pc-title">Files</h3>
            </div>
            <FilesTable />
          </main>
        </div>
      </Section>

      <Section n={2} title="Folder variants and colours">
        <div className="vlt-tiles">
          <Tile name="Glass" meta="Project folders">
            <GlassFolder
              papers={papers(DEMO_PLANS)}
              people={people(['A', 'R'])}
              updated="Updated 2h"
            />
          </Tile>
          <Tile name="Colour" meta="Templates, rule packs">
            <ColourFolder colour="orange" badge="v1.4" />
          </Tile>
          <Tile name="Archive" meta="Archived, exported">
            <ArchiveFolder badge="ZIP · 380 MB" />
          </Tile>
        </div>
        <div className="vlt-tiles">
          {colours.map((c) => (
            <Tile key={c} name={c[0]!.toUpperCase() + c.slice(1)} meta={`--folder-${c}`}>
              <GlassFolder
                colour={c}
                papers={papers(DEMO_PLANS)}
                people={people(['A', 'R'])}
                updated="Updated 2h"
              />
            </Tile>
          ))}
        </div>
      </Section>

      <Section n={3} title="Folder states">
        <div className="vlt-tiles">
          <Tile name="Default" meta="At rest">
            <GlassFolder
              colour="blue"
              papers={papers(DEMO_PLANS)}
              people={people(['A', 'R'])}
              updated="Updated 2h"
            />
          </Tile>
          <Tile name="Hover" meta="Papers lift, glow +10%" state="is-hover">
            <GlassFolder
              colour="blue"
              papers={papers(DEMO_PLANS)}
              people={people(['A', 'R'])}
              updated="Updated 2h"
            />
          </Tile>
          <Tile name="Selected" meta="Focus ring" selected>
            <GlassFolder
              colour="blue"
              papers={papers(DEMO_PLANS)}
              people={people(['A', 'R'])}
              updated="Updated 2h"
            />
          </Tile>
          <Tile name="Drag over" meta="Front tilts open" state="is-dragover">
            <GlassFolder
              colour="blue"
              papers={papers(DEMO_PLANS)}
              people={people(['A', 'R'])}
              updated="Updated 2h"
            />
          </Tile>
          <Tile name="Empty" meta="No papers">
            <GlassFolder colour="blue" />
          </Tile>
          <Tile name="No blur" meta="Fallback: solid front" state="no-glass">
            <GlassFolder
              colour="blue"
              papers={papers(DEMO_PLANS)}
              people={people(['A', 'R'])}
              updated="Updated 2h"
            />
          </Tile>
        </div>
      </Section>

      <Section n={4} title="⌘K command palette">
        <Palette />
      </Section>
    </div>
  );
}
