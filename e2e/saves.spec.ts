/**
 * Milestone 7: "saved runs can be resumed". The run is saved as you play;
 * coming back continues it, and a new run can be started on purpose.
 */
import { expect, test, type Page } from '@playwright/test';

/** The run's essentials, or null while the page is between loads. */
const run = (page: Page) =>
  page
    .evaluate(() => {
      const s = (
        window as unknown as {
          sunroot: {
            store: {
              state: {
                turn: number;
                options: { seed: string };
                vision: string | null;
                buildings: Record<string, unknown>;
              };
            };
          };
        }
      ).sunroot.store.state;
      return {
        turn: s.turn,
        seed: s.options.seed,
        vision: s.vision,
        buildings: Object.keys(s.buildings).length,
      };
    })
    .catch(() => null);

test('a run is saved as you play and resumed when you come back', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=resume-me');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Vision' })).toBeVisible();
  await page.keyboard.press('2'); // a vision
  await page.keyboard.press('1'); // a draft card
  await page.keyboard.press('f');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.keyboard.press('e');
  await page.keyboard.press(' ');
  await expect.poll(async () => (await run(page))?.turn).toBe(1);
  const before = (await run(page))!;
  expect(before.vision).not.toBeNull();

  // Leave, come back without a seed: the same run, where it was.
  // The autosave has written this season.
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { sunroot: { saved: { turn: number } } }).sunroot.saved.turn,
      ),
    )
    .toBe(1);
  await page.goto('/');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  await expect.poll(() => run(page)).toEqual(before);
  await expect(page.getByRole('status').filter({ hasText: 'Welcome back' })).toBeVisible();

  // A new run, on purpose.
  await page.getByRole('button', { name: 'New run' }).click();
  const dialog = page.getByRole('dialog', { name: 'Start a new run?' });
  await expect(dialog.getByRole('button', { name: 'Keep playing' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Start a new run' }).click();
  await expect.poll(async () => (await run(page))?.seed ?? 'resume-me').not.toBe('resume-me');
  expect((await run(page))?.turn).toBe(0);
  expect(page.url()).not.toContain('new');
  expect(errors).toEqual([]);
});
