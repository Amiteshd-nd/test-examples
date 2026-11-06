import { expect, test, type Page } from '@playwright/test';
import { PLAN, editorPlan, onScreen, openFile } from './helpers.ts';

// P2.4: editing through commands in the editor — drag a selected wall to move it (one undo
// step), rooms follow, Delete, undo / redo, saving, and read-only library plans. Each test gets
// its own in-memory Vault (see helpers.ts), so the shared `data/vault/` is never touched.

const wallX = async (page: Page, id: string) =>
  Object.values((await editorPlan(page)).levels)[0]!.walls[id]!.start[0];
const roomArea = (page: Page, name: string) =>
  page.locator('#ed-panel-left .ed-row', { hasText: name }).first().locator('.pc-mono').innerText();

test.describe('editing with commands (P2.4)', () => {
  let errors: string[] = [];
  test.beforeEach(({ page }) => {
    errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
  });
  test.afterEach(() => expect(errors).toEqual([]));

  test('drag a selected wall: rooms follow live, one undo step, redo, and it is saved', async ({
    page,
  }) => {
    const { storage, file } = await openFile(page);
    const undoButton = page.getByRole('button', { name: /^Undo/ });
    await expect(undoButton).toBeDisabled();
    const before = await roomArea(page, 'Living 1');

    const at = await onScreen(page, [330, 450]);
    await page.mouse.click(at.x, at.y);
    await expect(page.locator('.pc-pill', { hasText: 'Wall V1' })).toBeVisible();

    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 30, at.y, { steps: 3 });
    await page.mouse.move(at.x + 70, at.y, { steps: 3 });
    // While dragging, the room's area already follows the preview…
    await expect.poll(() => roomArea(page, 'Living 1')).not.toBe(before);
    await expect(page.getByLabel('Cursor position')).toContainText('Move');
    // …but nothing is recorded until the drag ends.
    expect(await wallX(page, 'V1')).toBe(330);
    await page.mouse.up();

    const moved = await wallX(page, 'V1');
    expect(moved).toBeGreaterThan(330);
    expect((moved - 330) % 10).toBe(0); // moved in whole grid steps
    await expect(page.locator('.ed-live')).toHaveText(/^Moved Wall V1 by /);
    await expect(undoButton).toBeEnabled();

    await page.keyboard.press('ControlOrMeta+z'); // one gesture, one undo step
    expect(await wallX(page, 'V1')).toBe(330);
    await expect(page.locator('#ed-panel-left .ed-row', { hasText: 'Living 1' })).toContainText(
      before,
    );
    await page.keyboard.press('ControlOrMeta+Shift+z');
    expect(await wallX(page, 'V1')).toBe(moved);

    // Saved to the Vault (continuous save, P14.4).
    await expect
      .poll(() => {
        const text = storage.data.get(`docs/${file.id}.json`) ?? '';
        return text.includes(`"start":[${moved},0]`);
      })
      .toBe(true);
  });

  test('Esc during a drag puts the wall back', async ({ page }) => {
    await openFile(page);
    const at = await onScreen(page, [330, 450]);
    await page.mouse.click(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 60, at.y, { steps: 4 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect(await wallX(page, 'V1')).toBe(330);
    await expect(page.locator('.pc-pill', { hasText: 'Wall V1' })).toBeVisible(); // still selected
    await expect(page.getByRole('button', { name: /^Undo/ })).toBeDisabled();
  });

  test('Delete removes the selected wall with its door; undo brings both back', async ({
    page,
  }) => {
    await openFile(page);
    const at = await onScreen(page, [330, 450]);
    await page.mouse.click(at.x, at.y);
    await page.keyboard.press('Delete');
    let plan = Object.values((await editorPlan(page)).levels)[0]!;
    expect(plan.walls.V1).toBeUndefined();
    expect(Object.values(plan.openings).some((o) => o.wall === 'V1')).toBe(false);
    await expect(page.locator('.pc-pill', { hasText: 'Wall V1' })).toHaveCount(0);
    await page.getByRole('button', { name: /^Undo/ }).click();
    plan = Object.values((await editorPlan(page)).levels)[0]!;
    expect(plan.walls.V1).toBeDefined();
    expect(Object.values(plan.openings).some((o) => o.wall === 'V1')).toBe(true);
  });

  test('⌘K lists Undo, Redo and Delete', async ({ page }) => {
    await openFile(page);
    const at = await onScreen(page, [330, 450]);
    await page.mouse.click(at.x, at.y);
    await page.keyboard.press('ControlOrMeta+k');
    await page.getByRole('combobox', { name: 'Type a command' }).fill('delete');
    const results = page.getByRole('listbox', { name: 'Commands' }).getByRole('option');
    await expect(results.first()).toHaveText(/Delete Wall V1/);
    await page.keyboard.press('Enter');
    // The palette closes first, then the command runs.
    await expect
      .poll(async () => Object.values((await editorPlan(page)).levels)[0]!.walls.V1)
      .toBeUndefined();
  });

  test('⌘K runs typed commands (the command line), with the same result as dragging', async ({
    page,
  }) => {
    await openFile(page);
    await page.keyboard.press('ControlOrMeta+k');
    const input = page.getByRole('combobox', { name: 'Type a command' });
    await input.fill('MOVE V1 0,0');
    const results = page.getByRole('listbox', { name: 'Commands' }).getByRole('option');
    await expect(results.first()).toHaveText(/MOVE needs to/);
    await input.fill('m V1 0,0 30,0');
    await expect(results.first()).toHaveText(/MOVE V1 0,0 30,0/);
    await page.keyboard.press('Enter');
    await expect.poll(() => wallX(page, 'V1')).toBe(360);
    await expect(page.locator('.ed-live')).toHaveText('Done: MOVE V1 0,0 30,0.');
    await page.keyboard.press('ControlOrMeta+k');
    await input.fill('ADD_WALL 0,450 1320,450');
    await page.keyboard.press('Enter');
    await expect
      .poll(
        async () => Object.values(Object.values((await editorPlan(page)).levels)[0]!.walls).length,
      )
      .toBe(Object.keys(Object.values(PLAN.levels)[0]!.walls).length + 1);
  });

  test('a library plan is read-only', async ({ page }) => {
    await page.goto('/#/library/synthetic-grid-4x3-typical');
    await expect(page.locator('.pc-planview text').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Undo/ })).toBeDisabled();
    const at = await onScreen(page, [330, 450]);
    await page.mouse.click(at.x, at.y);
    await page.keyboard.press('Delete');
    await expect(page.locator('.pc-pill', { hasText: 'read-only' })).toBeVisible();
  });
});
