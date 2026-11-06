import { expect, type Page } from '@playwright/test';
import {
  MemoryStorage,
  Vault,
  firstLevel,
  gridPlan,
  sequentialIds,
  steppingClock,
  type Level,
  type Plan,
} from '../engine/index.ts';

// Shared by the browser tests: an editable file in an in-memory Vault (the page's storage calls
// are answered here, so the shared data/vault/ is never touched), plan ↔ screen points, and the
// plan the editor holds (from its development hook).

export const PLAN = gridPlan({ cols: 4, rows: 3, name: 'Grid' });

export async function openFile(page: Page, plan: Plan = PLAN) {
  const storage = new MemoryStorage();
  const vault = new Vault({
    storage,
    ids: sequentialIds('t'),
    clock: steppingClock(),
    user: { id: 'local' },
    workspace: { id: 'local', name: 'My workspace' },
  });
  const file = await vault.createFile({ folderId: null, name: 'Grid', plan });
  await page.route('**/vault-storage/**', async (route) => {
    const url = new URL(route.request().url());
    const key = url.pathname
      .replace(/^\/vault-storage\//, '')
      .split('/')
      .map(decodeURIComponent)
      .join('/');
    const method = route.request().method();
    if (method === 'GET') {
      const text = storage.data.get(key);
      return text === undefined
        ? route.fulfill({ status: 404, body: '' })
        : route.fulfill({ status: 200, body: text });
    }
    if (method === 'PUT') storage.data.set(key, route.request().postData() ?? '');
    else if (method === 'DELETE') storage.data.delete(key);
    return route.fulfill({ status: 200, body: '' });
  });
  await page.goto(`/#/file/${file.id}`);
  await expect(page.locator('.pc-planview text').first()).toBeVisible();
  return { storage, file };
}

/** Where a plan point (cm) is on the page. */
export const onScreen = (page: Page, [x, y]: [number, number]) =>
  page.evaluate(
    ([px, py]) => {
      const svg = document.querySelector<SVGSVGElement>('.pc-planview')!;
      const p = new DOMPoint(px, -py).matrixTransform(svg.getScreenCTM()!);
      return { x: p.x, y: p.y };
    },
    [x, y] as const,
  );

/** Clicks a plan point, holding a modifier key if given. */
export async function clickAt(page: Page, at: [number, number], hold?: 'Shift' | 'Alt') {
  const p = await onScreen(page, at);
  if (hold) await page.keyboard.down(hold);
  await page.mouse.click(p.x, p.y);
  if (hold) await page.keyboard.up(hold);
}

export const editorPlan = (page: Page) =>
  page.evaluate(() => (window as unknown as { __plancraft: { plan: Plan } }).__plancraft.plan);
export const editorLevel = async (page: Page): Promise<Level> => firstLevel(await editorPlan(page));
