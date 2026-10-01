/**
 * Milestone 5: "each season resolves in about 5 seconds and can be skipped" (7.5 since
 * playtesting asked for a slower day and night).
 */
import { expect, test, type Page } from '@playwright/test';

const turn = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { sunroot: { store: { state: { turn: number } } } }).sunroot.store.state
        .turn,
  );

const phase = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { sunroot: { store: { resolution: { phase: string } | null } } })
        .sunroot.store.resolution?.phase ?? null,
  );

test('a season plays out in about 7.5 seconds, through event, day, night and settle', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=willow-reach-golden&visions=0');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  await page
    .getByRole('button', { name: /Floodplain Farm/ })
    .first()
    .waitFor();
  // Record each phase change in the page, with its time.
  await page.evaluate(() => {
    const w = window as unknown as {
      sunroot: {
        store: {
          resolution: { phase: string } | null;
          subscribe(f: () => void): void;
        };
      };
      phases: [string | null, number][];
      longestFrame: number;
    };
    w.phases = [];
    // The longest gap between frames: the season ends on the first frame after 7.5 seconds.
    w.longestFrame = 0;
    let last = performance.now();
    const frame = (now: number) => {
      w.longestFrame = Math.max(w.longestFrame, now - last);
      last = now;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    w.sunroot.store.subscribe(() => {
      const p = w.sunroot.store.resolution?.phase ?? null;
      if (w.phases.at(-1)?.[0] !== p) w.phases.push([p, performance.now()]);
    });
  });
  await page.keyboard.press('1');
  await page.keyboard.press('e');
  const banner = page.getByRole('status', { name: 'The season is resolving' });
  await expect(banner).toBeVisible();
  expect(await turn(page)).toBe(1);
  await expect.poll(() => phase(page), { timeout: 10_000 }).toBeNull();

  const { phases, longestFrame } = await page.evaluate(() => {
    const w = window as unknown as { phases: [string | null, number][]; longestFrame: number };
    return { phases: w.phases, longestFrame: w.longestFrame };
  });
  // Picking the card is recorded as "no resolution" first.
  const played = phases.filter(([p], i) => p !== null || i > 1);
  expect(played.map(([p]) => p)).toEqual(['event', 'day', 'night', 'settle', null]);
  const took = played.at(-1)![1] - played[0]![1];
  // 7.5 seconds, ending on the next frame (software rendering in CI can make frames slow).
  expect(took).toBeGreaterThan(7000);
  expect(took).toBeLessThan(7500 + longestFrame + 500);
  expect(longestFrame).toBeLessThan(2000);
  await expect(banner).toBeHidden();
  await expect(page.getByRole('button', { name: /End summer/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Space skips at once, P pauses, and acting skips the rest', async ({ page }) => {
  test.setTimeout(60_000); // it holds a paused season for 6 seconds
  await page.goto('/?seed=willow-reach-golden&visions=0');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  await page
    .getByRole('button', { name: /Floodplain Farm/ })
    .first()
    .waitFor();
  const banner = page.getByRole('status', { name: 'The season is resolving' });

  await page.keyboard.press('1');
  await page.keyboard.press('e');
  await expect(banner).toBeVisible();
  await page.keyboard.press(' ');
  await expect(banner).toBeHidden({ timeout: 500 });
  expect(await turn(page)).toBe(1);

  // Pausing holds the season where it is.
  await page.keyboard.press('1');
  await page.keyboard.press('e');
  await page.keyboard.press('p');
  await expect(banner).toContainText('paused');
  await page.waitForTimeout(6000);
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: 'Resume' }).click();
  await expect(banner).not.toContainText('paused');
  await page.getByRole('button', { name: /^Skip/ }).last().click();
  await expect(banner).toBeHidden({ timeout: 500 });

  // Picking a card during a resolution skips it and picks.
  await page.keyboard.press('e'); // no card picked yet: nothing happens
  expect(await turn(page)).toBe(2);
  await page.keyboard.press('1');
  await page.keyboard.press('e');
  await expect(banner).toBeVisible();
  await page.keyboard.press('1');
  await expect(banner).toBeHidden({ timeout: 500 });
  expect(await turn(page)).toBe(3);
});
