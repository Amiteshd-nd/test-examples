import { expect, test, type Page } from '@playwright/test';
import { PLAN, clickAt, editorLevel, onScreen, openFile } from './helpers.ts';

// P2.5: the toolset in the editor, driven by real clicks and keys on a 4 × 3 grid plan (walls
// H0–H3 at y = 0, 300, 600, 900; V0–V4 at x = 0, 330, 660, 990, 1320). Each test zooms out
// and draws to the right of the plan (x ≥ 1500), clear of its walls; points are multiples of
// 100 cm, which is the grid step at that zoom, so snapping keeps them where they were clicked.

const count = async (
  page: Page,
  kind:
    | 'walls'
    | 'rooms'
    | 'openings'
    | 'lines'
    | 'dimensions'
    | 'texts'
    | 'hatches'
    | 'stairs'
    | 'separators',
) => Object.keys((await editorLevel(page))[kind]).length;
const base = (kind: 'walls' | 'openings') =>
  Object.keys(Object.values(PLAN.levels)[0]![kind]).length;
const prompt = (page: Page) => page.getByRole('group', { name: /tool$/ });
/** Opens the grid plan and zooms out to make room beside it. */
async function start(page: Page) {
  await openFile(page);
  for (let i = 0; i < 4; i++) await page.keyboard.press('-');
}

test.describe('toolset (P2.5)', () => {
  let errors: string[] = [];
  test.beforeEach(({ page }) => {
    errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
  });
  test.afterEach(() => expect(errors).toEqual([]));

  test('walls by clicks and typed lengths; Enter stops; one undo per wall; Esc twice leaves', async ({
    page,
  }) => {
    await start(page);
    await page.keyboard.press('w');
    await expect(prompt(page)).toContainText('Click where the wall starts');
    await clickAt(page, [1500, 100]);
    await clickAt(page, [1900, 100]);
    expect(await count(page, 'walls')).toBe(base('walls') + 1);
    // Point the cursor up the plan, then type a length (A2 M5).
    const down = await onScreen(page, [1900, 700]);
    await page.mouse.move(down.x, down.y);
    await page.keyboard.type('3m');
    await page.keyboard.press('Enter');
    await expect.poll(() => count(page, 'walls')).toBe(base('walls') + 2);
    const walls = Object.values((await editorLevel(page)).walls);
    expect(walls.some((w) => w.start[0] === 1900 && w.start[1] === 100 && w.end[1] === 400)).toBe(
      true,
    );
    await page.keyboard.press('Escape'); // stops the chain
    await expect(prompt(page)).toContainText('Click where the wall starts');
    await page.keyboard.press('ControlOrMeta+z');
    expect(await count(page, 'walls')).toBe(base('walls') + 1);
    await page.keyboard.press('Escape'); // back to Select
    await expect(prompt(page)).toHaveCount(0);
  });

  test('room boxes, room labels, doors and stairs', async ({ page }) => {
    await start(page);
    await page.keyboard.press('r');
    await clickAt(page, [1500, 0]);
    await clickAt(page, [1800, 300]);
    await expect.poll(() => count(page, 'rooms')).toBe(13);
    await expect(page.locator('#ed-panel-left')).toContainText('Bedroom');

    await page.keyboard.press('d');
    await clickAt(page, [250, 0]);
    expect(await count(page, 'openings')).toBe(base('openings') + 1);

    await page.keyboard.press('s');
    await clickAt(page, [1500, 500]);
    await clickAt(page, [1800, 600]);
    expect(await count(page, 'stairs')).toBe(1);

    // A click off any wall with the door tool says why nothing happened.
    await page.keyboard.press('d');
    await clickAt(page, [165, 150]);
    await expect(prompt(page)).toContainText('Click on a wall');
  });

  test('lines, rectangles, dimensions, notes and hatches', async ({ page }) => {
    await start(page);
    await page.keyboard.press('l');
    await clickAt(page, [1500, 100]);
    await clickAt(page, [1700, 100]);
    await clickAt(page, [1700, 300]);
    await page.keyboard.press('Enter');
    expect(Object.values((await editorLevel(page)).lines)[0]!.points).toHaveLength(3);

    await page.keyboard.press('b');
    await clickAt(page, [1900, 100]);
    await clickAt(page, [2200, 300]);
    expect(await count(page, 'lines')).toBe(2);

    await page.keyboard.press('Shift+D');
    await clickAt(page, [1500, 500]);
    await clickAt(page, [1900, 500]);
    await clickAt(page, [1700, 400]);
    expect(await count(page, 'dimensions')).toBe(1);
    await expect(page.locator('.pc-planview text', { hasText: '4.00 m' })).toBeVisible();

    await page.keyboard.press('t');
    await clickAt(page, [2000, 700]);
    await page.keyboard.type('Courtyard');
    await page.keyboard.press('Enter');
    await expect(page.locator('.pc-planview text', { hasText: 'Courtyard' })).toBeVisible();

    await page.keyboard.press('h');
    await clickAt(page, [100, 100]);
    expect(await count(page, 'hatches')).toBe(1);
    // Alt-click steps from the room to the hatch under it.
    await page.keyboard.press('v');
    await clickAt(page, [100, 100]);
    await expect(page.locator('.pc-pill', { hasText: 'Living 1' })).toBeVisible();
    await clickAt(page, [100, 100], 'Alt');
    await expect(page.locator('.pc-pill', { hasText: /Hatch/ })).toBeVisible();
  });

  test('move, copy, rotate (typed angle), offset and delete', async ({ page }) => {
    await start(page);
    await page.keyboard.press('w');
    await clickAt(page, [1500, 200]);
    await clickAt(page, [1900, 200]);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    const id = Object.keys((await editorLevel(page)).walls).find(
      (k) => !(k in Object.values(PLAN.levels)[0]!.walls),
    )!;
    await clickAt(page, [1700, 200]); // select it

    await page.keyboard.press('m');
    await clickAt(page, [1700, 200]);
    await clickAt(page, [1700, 300]);
    expect((await editorLevel(page)).walls[id]!.start).toEqual([1500, 300]);

    await page.keyboard.press('c');
    await clickAt(page, [1700, 300]);
    await clickAt(page, [1700, 600]);
    await page.keyboard.press('Escape');
    expect(await count(page, 'walls')).toBe(base('walls') + 2);

    await page.keyboard.press('Escape');
    await clickAt(page, [1600, 300]);
    await page.keyboard.press('q');
    await clickAt(page, [1700, 300]);
    await page.keyboard.type('90');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await editorLevel(page)).walls[id]!.start).toEqual([1700, 100]);

    await page.keyboard.press('o');
    await clickAt(page, [2000, 300]);
    expect(await count(page, 'walls')).toBe(base('walls') + 3);

    await page.keyboard.press('e');
    await clickAt(page, [1600, 600]);
    expect(await count(page, 'walls')).toBe(base('walls') + 2);
  });

  test('a wall’s length typed in Properties moves its end (editable dimensions)', async ({
    page,
  }) => {
    await start(page);
    await clickAt(page, [660, 450]); // wall V2, 9 m long
    const field = page.getByLabel('Wall length');
    await expect(field).toHaveValue('9.00 m');
    await field.fill('6.5');
    await field.press('Enter');
    await expect.poll(async () => (await editorLevel(page)).walls.V2!.end).toEqual([660, 650]);
    await page.keyboard.press('ControlOrMeta+z');
    await expect(field).toHaveValue('9.00 m');
  });

  test('Help lists every tool’s key', async ({ page }) => {
    await start(page);
    await page.getByRole('button', { name: 'Keyboard and mouse help' }).click();
    const help = page.getByRole('dialog', { name: 'Keyboard and mouse' });
    await expect(help).toContainText('Trim');
    await expect(help).toContainText('⇧X');
    await expect(help).toContainText('450<90');
    await page.keyboard.press('Escape');
    await expect(help).toHaveCount(0);
  });
});
