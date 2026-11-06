import { expect, test, type Page } from '@playwright/test';

// P2.2a: the editor's side panels hide and show (buttons, edge tabs, shortcuts, ⌘K), the
// drawing never moves, the layout is remembered, narrow windows use overlays. Uses a library
// plan when the local library has one; the editor falls back to its built-in sample otherwise.

const PLAN = '/#/library/synthetic-grid-4x3-typical';

interface Watch {
  __drift: number;
  __frames: number;
  /** A panel's width transition started (it slid rather than jumped). */
  __slid: boolean;
  __stop: () => void;
}

async function openEditor(page: Page) {
  await page.goto(PLAN);
  await expect(page.locator('.pc-planview text').first()).toBeVisible();
}

const panel = (page: Page, side: 'left' | 'right' | 'chat') => page.locator(`#ed-panel-${side}`);
const settled = (page: Page) => page.waitForFunction(() => document.getAnimations().length === 0);

/**
 * Records how far the first room label moves on screen while panels change. It reads the label
 * in a ResizeObserver created after the canvas's own, so it sees what the next frame paints.
 */
async function watchDrawing(page: Page) {
  await page.evaluate(() => {
    const label = document.querySelector('.pc-planview text')!;
    const at = () => {
      const r = label.getBoundingClientRect();
      return [r.left, r.top] as const;
    };
    const start = at();
    const w = window as unknown as Watch;
    w.__drift = 0;
    w.__frames = 0;
    w.__slid = false;
    const slid = (e: TransitionEvent) => {
      if (e.propertyName === 'width') w.__slid = true;
    };
    document.addEventListener('transitionrun', slid);
    const observer = new ResizeObserver(() => {
      const [x, y] = at();
      w.__frames++;
      w.__drift = Math.max(w.__drift, Math.abs(x - start[0]), Math.abs(y - start[1]));
    });
    observer.observe(document.querySelector('.ed-canvas-draw')!);
    w.__stop = () => {
      observer.disconnect();
      document.removeEventListener('transitionrun', slid);
    };
  });
}
async function drawingMoved(page: Page) {
  await settled(page);
  return page.evaluate(() => {
    const w = window as unknown as Watch;
    w.__stop();
    return { drift: w.__drift, frames: w.__frames, slid: w.__slid };
  });
}

test.describe('side panels (P2.2a)', () => {
  // Any script error (e.g. a ResizeObserver loop) fails the test.
  let errors: string[] = [];
  test.beforeEach(({ page }) => {
    errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
  });
  test.afterEach(() => expect(errors).toEqual([]));

  test('the top-bar buttons and edge tabs hide and show panels without moving the drawing', async ({
    page,
  }) => {
    await openEditor(page);
    for (const side of ['left', 'right'] as const) {
      const toggle = page.locator(`#ed-toggle-${side}`);
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(toggle).toHaveAttribute('aria-controls', `ed-panel-${side}`);
      await watchDrawing(page);
      await toggle.click();
      await expect(panel(page, side)).toHaveAttribute('data-open', 'false');
      const hidden = await drawingMoved(page);
      expect(hidden.drift).toBeLessThan(0.5);
      expect(hidden.slid).toBe(true);
      await expect(toggle).toHaveAttribute('aria-label', `Show ${side} panel`);
      expect(await panel(page, side).evaluate((el) => el.getBoundingClientRect().width)).toBe(0);

      await watchDrawing(page);
      await page.locator(`.ed-edge--${side}`).click();
      await expect(panel(page, side)).toHaveAttribute('data-open', 'true');
      expect((await drawingMoved(page)).drift).toBeLessThan(0.5);
      await expect(page.locator(`.ed-edge--${side}`)).toHaveCount(0);
    }
    await watchDrawing(page);
    await page.locator('#ed-toggle-chat').click();
    await expect(panel(page, 'chat')).toHaveAttribute('data-open', 'true');
    expect((await drawingMoved(page)).drift).toBeLessThan(0.5);
  });

  test('the three shortcuts, and not while typing', async ({ page }) => {
    await openEditor(page);
    await page.locator('.ed-canvas-draw').hover();
    await watchDrawing(page);
    await page.keyboard.press('ControlOrMeta+Backslash');
    for (const side of ['left', 'right', 'chat'] as const)
      await expect(panel(page, side)).toHaveAttribute('data-open', 'false');
    expect((await drawingMoved(page)).drift).toBeLessThan(0.5);
    await page.keyboard.press('ControlOrMeta+Backslash');
    await expect(panel(page, 'left')).toHaveAttribute('data-open', 'true');
    await expect(panel(page, 'right')).toHaveAttribute('data-open', 'true');
    await expect(panel(page, 'chat')).toHaveAttribute('data-open', 'false');

    await page.keyboard.press('ControlOrMeta+Alt+BracketLeft');
    await expect(panel(page, 'left')).toHaveAttribute('data-open', 'false');
    await page.keyboard.press('ControlOrMeta+Alt+BracketRight');
    await expect(panel(page, 'right')).toHaveAttribute('data-open', 'false');
    await page.keyboard.press('ControlOrMeta+Alt+BracketRight');
    await expect(panel(page, 'right')).toHaveAttribute('data-open', 'true');

    await page.getByLabel('File name').focus();
    await page.keyboard.press('ControlOrMeta+Alt+BracketRight');
    await page.keyboard.press('ControlOrMeta+Backslash');
    await expect(panel(page, 'right')).toHaveAttribute('data-open', 'true');
  });

  test('the ⌘K palette runs the panel commands', async ({ page }) => {
    await openEditor(page);
    await page.keyboard.press('ControlOrMeta+k');
    const input = page.getByRole('combobox', { name: 'Type a command' });
    await expect(input).toBeFocused();
    await input.fill('hide left');
    await expect(page.getByRole('option')).toHaveText(['Hide left panel' + (await shortcut(page))]);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toHaveCount(0);
    await expect(panel(page, 'left')).toHaveAttribute('data-open', 'false');
  });

  test('the layout survives a reload', async ({ page }) => {
    await openEditor(page);
    await page.locator('#ed-toggle-left').click();
    await page.locator('#ed-toggle-chat').click();
    await settled(page);
    await page.waitForTimeout(400); // the layout is written 250 ms after the last change
    await page.reload();
    await expect(page.locator('.pc-planview text').first()).toBeVisible();
    await expect(panel(page, 'left')).toHaveAttribute('data-open', 'false');
    await expect(panel(page, 'right')).toHaveAttribute('data-open', 'true');
    await expect(panel(page, 'chat')).toHaveAttribute('data-open', 'true');
    await expect(page.locator('.ed-edge--left')).toBeVisible();
  });

  test('keyboard focus inside a panel that hides moves to its toggle', async ({ page }) => {
    await openEditor(page);
    await page.locator('#ed-panel-left .ed-row').first().focus();
    await page.keyboard.press('ControlOrMeta+Alt+BracketLeft');
    await expect(page.locator('#ed-toggle-left')).toBeFocused();
    await expect(panel(page, 'left')).toHaveJSProperty('inert', true);

    await page
      .locator('#ed-panel-right')
      .getByRole('button', { name: 'Close Properties panel' })
      .focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#ed-toggle-right')).toBeFocused();
  });

  test('no animation when reduced motion is asked for', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openEditor(page);
    await page.locator('#ed-toggle-left').click();
    await expect(panel(page, 'left')).toHaveAttribute('data-open', 'false');
    const now = await panel(page, 'left').evaluate((el) => ({
      animations: document.getAnimations().length,
      width: el.getBoundingClientRect().width,
    }));
    expect(now).toEqual({ animations: 0, width: 0 });
  });

  test('narrow window: one overlay at a time, closed by Esc or a click outside', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 760 });
    await openEditor(page);
    for (const side of ['left', 'right', 'chat'] as const)
      await expect(panel(page, side)).toHaveAttribute('data-open', 'false');
    await page.locator('.ed-edge--right').click();
    await expect(panel(page, 'right')).toHaveAttribute('data-open', 'true');
    await page.keyboard.press('Escape');
    await expect(panel(page, 'right')).toHaveAttribute('data-open', 'false');

    await page.getByRole('navigation', { name: 'Panels' }).getByLabel('Layers').click();
    await expect(panel(page, 'left')).toHaveAttribute('data-open', 'true');
    await page.locator('#ed-toggle-chat').click();
    await expect(panel(page, 'left')).toHaveAttribute('data-open', 'false');
    await expect(panel(page, 'chat')).toHaveAttribute('data-open', 'true');
    await page.mouse.click(200, 400); // the canvas, outside the chat
    await expect(panel(page, 'chat')).toHaveAttribute('data-open', 'false');

    // The overlays don't change the remembered wide layout.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(panel(page, 'left')).toHaveAttribute('data-open', 'true');
    await expect(panel(page, 'right')).toHaveAttribute('data-open', 'true');
  });

  test('a panel edge resizes by drag, double-click and arrow keys', async ({ page }) => {
    await openEditor(page);
    const edge = page.getByRole('separator', { name: 'Resize the left panel' });
    await expect(edge).toHaveAttribute('aria-valuenow', '280');
    const box = (await edge.boundingBox())!;
    await watchDrawing(page);
    await page.mouse.move(box.x + 4, 400);
    await page.mouse.down();
    await page.mouse.move(box.x + 34, 400, { steps: 4 });
    await page.mouse.move(box.x + 64, 400, { steps: 4 });
    await page.mouse.up();
    await expect(edge).toHaveAttribute('aria-valuenow', '340');
    expect((await drawingMoved(page)).drift).toBeLessThan(0.5);

    await edge.dblclick();
    await expect(edge).toHaveAttribute('aria-valuenow', '280');
    await edge.focus();
    await page.keyboard.press('ArrowRight');
    await expect(edge).toHaveAttribute('aria-valuenow', '288');
    await page.keyboard.press('Home');
    await expect(edge).toHaveAttribute('aria-valuenow', '240');
  });
});

/** The shortcut label the palette shows for "Hide left panel" on this platform. */
async function shortcut(page: Page) {
  const mac = await page.evaluate(() => /Mac|iP(hone|ad|od)/.test(navigator.userAgent));
  return mac ? '⌘⌥[' : 'Ctrl+Alt+[';
}
