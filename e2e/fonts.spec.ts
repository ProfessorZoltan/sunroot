/**
 * The type is served with the app: Fraunces and Nunito, and Atkinson
 * Hyperlegible Next for numbers only; all loaded before the first paint.
 */
import { expect, test } from '@playwright/test';

test('fonts come from the app and are ready when the game appears', async ({ page }) => {
  const outside: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    // blob: and data: URLs are made in the page (the icons); only other hosts count.
    if (!url.protocol.startsWith('http')) return;
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') outside.push(r.url());
  });
  await page.goto('/?seed=fonts-1');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  const loaded = await page.evaluate(() => ({
    numbers: document.fonts.check('16px "Sunroot Numbers"', '0123456789'),
    text: document.fonts.check('16px "Nunito Variable"', 'Stores'),
    titles: document.fonts.check('600 20px "Fraunces Variable"', 'Sunroot'),
    stack: getComputedStyle(document.body).fontFamily,
  }));
  expect(loaded).toMatchObject({ numbers: true, text: true, titles: true });
  expect(loaded.stack).toMatch(/^"?Sunroot Numbers"?, "?Nunito Variable"?/);
  expect(outside).toEqual([]);
});
