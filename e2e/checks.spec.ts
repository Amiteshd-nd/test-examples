import { expect, test } from '@playwright/test';
import { createHistory, execute } from '../engine/index.ts';
import { PLAN, editorPlan, openFile } from './helpers.ts';

// P3.1: reference checks from the rule packs show in the Issues tab; a rule whose value the
// architect hasn't confirmed yet is labelled "unverified" (NBC values were confirmed 2026-11-06).
// P3.2: the checks run again after every change, grouped by room; an issue can be shown on the
// plan, fixed in one step where the fix is certain, and Vastu gives a score.

test('a room below the NBC width shows as a reference-check issue', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const narrow = execute(createHistory(PLAN), {
    op: 'execute',
    id: 'ROOM',
    params: { id: 'NAR', corner: [1500, 0], opposite: [1900, 200], type: 'bedroom' },
  });
  if (!narrow.outcome.ok) throw new Error(narrow.outcome.message);
  await openFile(page, narrow.history.plan);
  await page.getByRole('button', { name: 'Issues' }).click();
  const issue = page.locator('.pc-issue', { hasText: 'wide; the reference minimum is 2.40 m' });
  await expect(issue).toBeVisible();
  await expect(issue).not.toContainText('unverified'); // NBC: confirmed by the architect
  await expect(issue).toContainText(/Widen Bedroom by \d+ cm, e\.g\. move wall NAR\.w\d/);
  expect(errors).toEqual([]);
});

type Hook = { __plancraft: { run(r: unknown): { ok: boolean }; undo(): unknown } };

test('P3.2 ✅ shrinking a bedroom shows an issue within 300 ms; its quick fix clears it', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openFile(page);
  await page.getByRole('tab', { name: /Issues/ }).click();
  await expect(page.locator('.pc-issue', { hasText: 'Bedroom 3' })).toHaveCount(0);

  // Move wall V3 1 m west: Bedroom 3 (between V2 and V3) becomes too narrow.
  const ms = await page.evaluate(async () => {
    const pc = (window as unknown as Hook).__plancraft;
    const t0 = performance.now();
    pc.run({ op: 'execute', id: 'MOVE', params: { ids: ['V3'], from: [0, 0], to: [-100, 0] } });
    return new Promise<number>((resolve) => {
      const seen = () =>
        [...document.querySelectorAll('.pc-issue')].some((e) =>
          /Bedroom 3 is [\d.]+ m wide/.test(e.textContent ?? ''),
        );
      const wait = () => (seen() ? resolve(performance.now() - t0) : requestAnimationFrame(wait));
      wait();
    });
  });
  test.info().annotations.push({ type: 'issue shown after (ms)', description: ms.toFixed(0) });
  expect(ms).toBeLessThan(300);

  // Grouped under the room, with the sentence on how to fix it and a one-step fix.
  const group = page.locator('.pc-panel-section', { hasText: 'Bedroom 3' }).first();
  await expect(group.locator('.pc-panel-head')).toHaveText(/Bedroom 3/);
  const issue = group.locator('.pc-issue', { hasText: /Bedroom 3 is [\d.]+ m wide/ });
  await expect(issue).toContainText(/Widen Bedroom 3 by 22 cm, e\.g\. move wall V[23] 22 cm/);
  const fix = issue.getByRole('button', { name: /^Fix: Move wall V[23] 22 cm (east|west)$/ });
  await fix.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.pc-issue', { hasText: /Bedroom 3 is [\d.]+ m wide/ })).toHaveCount(0);
  await expect(page.getByText(/^Fixed: Move wall V[23] 22 cm/)).toBeAttached();
  await expect(page.locator('.ed-issues-summary')).toBeFocused();

  // One undo step brings the narrow room (and its issue) back.
  await page.evaluate(() => (window as unknown as Hook).__plancraft.undo());
  await expect(page.locator('.pc-issue', { hasText: /Bedroom 3 is [\d.]+ m wide/ })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('P3.2: clicking an issue selects its room and zooms to it', async ({ page }) => {
  await openFile(page);
  await page.getByRole('tab', { name: /Issues/ }).click();
  const zoom = page.locator('.ed-zoom-value');
  const before = parseInt((await zoom.textContent())!, 10);
  const area = page.locator('.pc-issue', { hasText: 'No habitable room reaches 9.50 m²' });
  await area.locator('.pc-issue-show').click();
  await expect(page.getByText('Selecting')).toContainText('Master bedroom 6');
  await expect(area).toBeVisible(); // the Issues list stays open
  await expect.poll(async () => parseInt((await zoom.textContent())!, 10)).toBeGreaterThan(before);
  // The zoom button fits the whole plan again.
  await zoom.click();
  await expect.poll(async () => parseInt((await zoom.textContent())!, 10)).toBe(before);
});

test('P3.2: the Vastu switch turns the checks on and shows a score', async ({ page }) => {
  await openFile(page);
  await page.getByRole('tab', { name: /Issues/ }).click();
  await expect(page.getByText('Vastu checks are off for this plan.')).toBeVisible();
  await page.getByRole('switch', { name: 'Vastu checks' }).click();
  await expect(page.getByRole('switch', { name: 'Vastu checks' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expect((await editorPlan(page)).meta.vastu).toBe(true);
  const tile = page.locator('.pc-tile', { hasText: 'Vastu score' });
  await expect(tile).toContainText(/\d+ %/);
  await expect(
    page.getByText(/\d+ of \d+ preferences met\. Assumed: north points up/),
  ).toBeVisible();
  await expect(page.locator('.pc-issue', { hasText: 'Vastu prefers' }).first()).toBeVisible();
});

test('P3.3: the plan graph overlay and a room’s connections', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openFile(page);
  await expect(page.locator('.ed-graph')).toHaveCount(0); // off until asked for
  await page.getByRole('button', { name: 'Layers' }).first().click();
  await page.getByRole('checkbox', { name: /Plan graph/ }).check();
  const overlay = page.locator('.ed-graph');
  await expect(overlay).toBeVisible();
  // The 4 × 3 grid: 12 rooms, 29 links (11 doors, 6 walls, 12 corners), tags like "front · W".
  await expect(overlay.locator('circle')).toHaveCount(12);
  await expect(overlay.locator('path')).toHaveCount(29);
  await expect(overlay.getByText('front · W')).toBeAttached();
  await expect(page.getByRole('list', { name: 'Plan graph key' })).toContainText(
    'meet at a corner',
  );

  // A room's place in the graph, in Properties.
  await page.getByRole('button', { name: 'Rooms' }).first().click();
  await page.getByText('Master bedroom 6', { exact: true }).first().click();
  const props = page.locator('.ed-props');
  await expect(props).toContainText('Middle third');
  await expect(props).toContainText('Kitchen 2 (door)');
  await expect(props).toContainText('Dining 5 (wall)');
  expect(errors).toEqual([]);
});
