import { Compass, FileStatus } from '@plancraft/engine';
import { useEffect, useState } from 'react';

// The app's pages, kept in the URL hash so links and the back button work (P14.3). The Vault is
// the first page; the editor opens a vault file (`#/file/<id>`, A2 P14.4 deep link) or a
// library plan (`#/library/<id>`). Older `#<plan-id>` links from P2.3 open the library plan.

/** A search in the Vault (P14.5): words plus optional filters. */
export interface SearchParams {
  q: string;
  kind?: 'plan' | 'sheet_set';
  status?: FileStatus;
  bhk?: number;
  facing?: Compass;
  owner?: string;
}

export type Route =
  | { page: 'home' }
  | { page: 'search'; search: SearchParams }
  | { page: 'folder'; id: string }
  | { page: 'library' }
  | { page: 'templates' }
  | { page: 'ask' }
  | { page: 'starred' }
  | { page: 'trash' }
  | { page: 'file'; id: string }
  | { page: 'library-plan'; id: string };

const ID = '([A-Za-z0-9][A-Za-z0-9_.-]*)';

function parseSearch(query: string): SearchParams {
  const p = new URLSearchParams(query);
  const out: SearchParams = { q: p.get('q') ?? '' };
  const kind = p.get('kind');
  if (kind === 'plan' || kind === 'sheet_set') out.kind = kind;
  const status = FileStatus.safeParse(p.get('status'));
  if (status.success) out.status = status.data;
  const bhk = Number(p.get('bhk'));
  if (p.has('bhk') && Number.isInteger(bhk) && bhk >= 0 && bhk <= 20) out.bhk = bhk;
  const facing = Compass.safeParse(p.get('facing'));
  if (facing.success) out.facing = facing.data;
  const owner = p.get('owner');
  if (owner && /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(owner)) out.owner = owner;
  return out;
}

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#/, '');
  if (raw === '/search' || raw.startsWith('/search?'))
    return { page: 'search', search: parseSearch(raw.slice('/search'.length + 1)) };
  const h = decodeURIComponent(raw);
  let m: RegExpExecArray | null;
  if ((m = new RegExp(`^/folder/${ID}$`).exec(h))) return { page: 'folder', id: m[1]! };
  if ((m = new RegExp(`^/file/${ID}$`).exec(h))) return { page: 'file', id: m[1]! };
  if ((m = new RegExp(`^/library/${ID}$`).exec(h))) return { page: 'library-plan', id: m[1]! };
  if (h === '/library') return { page: 'library' };
  if (h === '/templates') return { page: 'templates' };
  if (h === '/ask') return { page: 'ask' };
  if (h === '/starred') return { page: 'starred' };
  if (h === '/trash') return { page: 'trash' };
  if ((m = new RegExp(`^${ID}$`).exec(h))) return { page: 'library-plan', id: m[1]! };
  return { page: 'home' };
}

export function routeHash(r: Route): string {
  switch (r.page) {
    case 'home':
      return '#/';
    case 'folder':
      return `#/folder/${encodeURIComponent(r.id)}`;
    case 'file':
      return `#/file/${encodeURIComponent(r.id)}`;
    case 'library-plan':
      return `#/library/${encodeURIComponent(r.id)}`;
    case 'search': {
      const p = new URLSearchParams();
      for (const [k, v] of Object.entries(r.search))
        if (v !== undefined && v !== '') p.set(k, String(v));
      const query = p.toString();
      return query ? `#/search?${query}` : '#/search';
    }
    default:
      return `#/${r.page}`;
  }
}

export function go(r: Route) {
  location.hash = routeHash(r);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseRoute(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
