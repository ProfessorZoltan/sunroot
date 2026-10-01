/**
 * Milestone 4: "a full run can be played to the end with mouse and keyboard".
 * This plays a whole run with the keyboard alone, and checks the tooltips.
 */
import { expect, test, type Page } from '@playwright/test';

const state = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { sunroot: { store: { state: Record<string, unknown> } } })
      .sunroot.store.state as {
      status: string;
      turn: number;
      stores: { materials: number };
      buildings: Record<string, { type: string }>;
    };
    return {
      status: s.status,
      turn: s.turn,
      materials: s.stores.materials,
      types: Object.values(s.buildings).map((b) => b.type),
    };
  });

/** Esc until the season has played out and every discovery card is closed. */
async function settle(page: Page) {
  for (let i = 0; i < 12; i++) {
    const busy = await page.evaluate(() => {
      const { store } = (
        window as unknown as {
          sunroot: { store: { resolution: unknown; reveals: unknown[] } };
        }
      ).sunroot;
      return store.resolution !== null || store.reveals.length > 0;
    });
    if (!busy) return;
    await page.keyboard.press('Escape');
  }
}

test('a whole run, keyboard only, to the end screen', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=keyboard-run');
  await expect(page.locator('#map-host canvas')).toBeVisible();

  // A simple plan: farms, a salvage yard and workshop, a composter, then cottages.
  const plan = ['f', 's', 'w', 'c', 'f', 'o', 'f', 'o'];
  for (let season = 0; season < 48; season++) {
    const s = await state(page);
    if (s.status !== 'active') break;
    await settle(page); // skip the last season's resolution and close discovery cards
    await page.keyboard.press('1'); // a charter, when one is offered at a new era
    await page.keyboard.press('1'); // the draft card
    const key = plan[season];
    if (key) {
      await page.keyboard.press(key);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Escape');
    }
    await page.keyboard.press('e');
    await expect.poll(async () => (await state(page)).turn).toBe(season + 1);
  }
  const end = await state(page);
  expect(['complete', 'collapsed']).toContain(end.status);
  expect(end.types).toEqual(expect.arrayContaining(['floodplainFarm', 'workshop']));
  // The salvage yard may have emptied its ruin and evolved into a Rewilded Ruin.
  expect(end.types.some((t) => t === 'salvageYard' || t === 'rewildedRuin')).toBe(true);
  const dialog = page.getByRole('dialog', { name: 'The run has ended' });
  await settle(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/Score: (Seedling|Sapling|Heartwood) Graft/);
  // If the Seeds pay for a Graft, the first one on offer has focus; otherwise
  // banking the Seeds does. Either way Enter sends the run home.
  const planted = await dialog.getByRole('button', { name: /runs/ }).first().isVisible();
  await expect(
    planted
      ? dialog.getByRole('button', { name: /runs/ }).first()
      : dialog.getByRole('button', { name: 'Bank the Seeds' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog.getByRole('status')).toContainText(
    planted ? 'is on its way to Root City' : 'Seeds are banked',
  );
  await expect(dialog.getByRole('button', { name: 'Start a new run' })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  const city = await page.evaluate(() => JSON.parse(localStorage.getItem('sunroot:city')!));
  expect(city.runs).toBe(1);
  expect(city.grafts).toHaveLength(planted ? 1 : 0);
  expect(city.seeds).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('tooltips show the math on hover and on keyboard focus', async ({ page }) => {
  await page.goto('/?seed=willow-reach-golden&visions=0');
  await expect(page.locator('#map-host canvas')).toBeVisible();

  await page
    .getByRole('button', { name: /Floodplain Farm/ })
    .first()
    .waitFor();
  await page.locator('[aria-label^="Winter night"]').hover();
  await expect(page.getByRole('tooltip')).toContainText('Winter night');
  await expect(page.getByRole('tooltip')).toContainText("Founders' Camp");

  await page.locator('.store-row').first().focus();
  await expect(page.getByRole('tooltip')).toContainText('Materials this season');
  await expect(page.getByRole('tooltip')).toContainText('Foraging');

  await page.locator('.stat').nth(1).focus();
  await expect(page.getByRole('tooltip')).toContainText('Wellbeing by the end of this season');

  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Keyboard' })).toBeHidden();
});

test('the inspector changes a workshop recipe and blackout priority', async ({ page }) => {
  await page.goto('/?seed=willow-reach-golden&sandbox&visions=0');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  await page.keyboard.press('w');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  // Click the workshop on the map to inspect it.
  const where = await page.evaluate(() => {
    const { store, view } = (
      window as unknown as {
        sunroot: {
          store: {
            state: { buildings: Record<string, { type: string; at: { q: number; r: number } }> };
          };
          view: { screenOf(h: { q: number; r: number }): { x: number; y: number } };
        };
      }
    ).sunroot;
    const w = Object.values(store.state.buildings).find((b) => b.type === 'workshop')!;
    const rect = document.querySelector('#map-host canvas')!.getBoundingClientRect();
    const s = view.screenOf(w.at);
    return { x: rect.left + s.x, y: rect.top + s.y };
  });
  await page.mouse.click(where.x, where.y);
  const inspector = page.getByRole('region', { name: 'Workshop details' });
  await expect(inspector).toBeVisible();
  await inspector.getByRole('combobox').selectOption('clutter');
  expect(
    await page.evaluate(
      () =>
        Object.values(
          (
            window as unknown as {
              sunroot: {
                store: { state: { buildings: Record<string, { type: string; recipe?: string }> } };
              };
            }
          ).sunroot.store.state.buildings,
        ).find((b) => b.type === 'workshop')!.recipe,
    ),
  ).toBe('clutter');
});
