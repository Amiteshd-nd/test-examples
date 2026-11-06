import { describe, expect, it } from 'vitest';
import { parseRoute, routeHash, type Route } from './route.ts';

describe('routes', () => {
  it('round-trips every page through the hash', () => {
    const routes: Route[] = [
      { page: 'home' },
      { page: 'folder', id: '01M6RQEZKNETBDTFN9XXSKZFQ5' },
      { page: 'library' },
      { page: 'templates' },
      { page: 'ask' },
      { page: 'starred' },
      { page: 'trash' },
      { page: 'file', id: 'f-0001' },
      { page: 'library-plan', id: 'synthetic-grid-4x3-typical' },
      { page: 'search', search: { q: '' } },
      {
        page: 'search',
        search: {
          q: '30×40 east & co',
          kind: 'plan',
          status: 'in_review',
          bhk: 2,
          facing: 'north_east',
          owner: 'local',
        },
      },
    ];
    for (const r of routes) expect(parseRoute(routeHash(r))).toEqual(r);
  });

  it('opens old library links and falls back to Home', () => {
    expect(parseRoute('#synthetic-1bhk-mm-lines')).toEqual({
      page: 'library-plan',
      id: 'synthetic-1bhk-mm-lines',
    });
    expect(parseRoute('')).toEqual({ page: 'home' });
    expect(parseRoute('#/nowhere/../x')).toEqual({ page: 'home' });
    // Unknown or broken filter values are dropped, the words are kept.
    expect(parseRoute('#/search?q=villa&bhk=two&facing=up&status=done&kind=x&owner=../a')).toEqual({
      page: 'search',
      search: { q: 'villa' },
    });
  });
});
