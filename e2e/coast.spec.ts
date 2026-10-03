/**
 * The Windswept Coast on screen (B4, proposals/windswept-coast.md): "a coast
 * run plays to the end with mouse and keyboard". A visit (?biome=) never
 * touches the saved run or Root City.
 */
import { expect, test, type Page } from '@playwright/test';

type Sunroot = {
  store: {
    state: {
      contentId: string;
      status: string;
      turn: number;
      buildings: Record<string, { type: string }>;
    };
    resolution: unknown;
    reveals: unknown[];
  };
  saved: { turn: number };
  savedCity: { runs: number };
};
const sunroot = (page: Page) =>
  page.evaluate(() => {
    const w = (window as unknown as { sunroot: Sunroot }).sunroot;
    const s = w.store.state;
    return {
      contentId: s.contentId,
      status: s.status,
      turn: s.turn,
      types: Object.values(s.buildings).map((b) => b.type),
      saved: w.saved.turn,
    };
  });

async function settle(page: Page) {
  for (let i = 0; i < 12; i++) {
    const busy = await page.evaluate(() => {
      const { store } = (window as unknown as { sunroot: Sunroot }).sunroot;
      return store.resolution !== null || store.reveals.length > 0;
    });
    if (!busy) return;
    await page.keyboard.press('Escape');
  }
}

/** The palette's key for a building, as its button shows it. */
const keyOf = async (page: Page, name: string) =>
  (
    await page
      .locator('#palette button', {
        has: page.locator('.tool-name', { hasText: new RegExp(`^${name}$`) }),
      })
      .getAttribute('aria-keyshortcuts')
  )?.toLowerCase();

test('a whole coast run, keyboard only, to the end screen', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?biome=windsweptCoast&seed=coast-keyboard');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  expect((await sunroot(page)).contentId).toBe('windsweptCoast');

  // Crofts, the beachcombing yard and workshop, a composter, then cottages and a tide turbine.
  const names = [
    'Croft',
    'Beachcombing Yard',
    'Workshop',
    'Croft',
    'Composter',
    'Cottage',
    'Croft',
    'Tide Turbine',
    'Cottage',
    'Croft',
  ];
  const keys = await Promise.all(names.map((n) => keyOf(page, n)));
  expect(keys.every(Boolean)).toBe(true);
  for (let season = 0; season < 48; season++) {
    const s = await sunroot(page);
    if (s.status !== 'active') break;
    await settle(page);
    await page.keyboard.press('1'); // a charter, when one is offered at a new era
    await page.keyboard.press('1'); // the draft card
    const key = keys[season];
    if (key) {
      await page.keyboard.press(key);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Escape');
    }
    await page.keyboard.press('e');
    await expect.poll(async () => (await sunroot(page)).turn).toBe(season + 1);
  }
  const end = await sunroot(page);
  expect(['complete', 'collapsed']).toContain(end.status);
  expect(end.types).toEqual(expect.arrayContaining(['croft', 'beachcombingYard', 'workshop']));
  await settle(page);
  const dialog = page.getByRole('dialog', { name: 'The run has ended' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/Score: (Seedling|Sapling|Heartwood) Graft/);
  // A visit is never saved.
  expect((await sunroot(page)).saved).toBe(-1);
  expect(errors).toEqual([]);
});

test('a coast visit leaves the saved run and Root City as they were', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const seedOf = () =>
    page.evaluate(
      () =>
        (window as unknown as { sunroot: { store: { state: { options: { seed: string } } } } })
          .sunroot.store.state.options.seed,
    );
  // A Reach run, saved.
  await page.goto('/?seed=kept-reach&visions=0');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { sunroot: { saved: { turn: number } } }).sunroot.saved.turn,
      ),
    )
    .toBe(0);
  // A visit to the coast, a season played there.
  await page.goto('/?biome=windsweptCoast&seed=just-visiting&visions=0');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  expect((await sunroot(page)).contentId).toBe('windsweptCoast');
  await page.keyboard.press('1');
  await page.keyboard.press('e');
  await expect.poll(async () => (await sunroot(page)).turn).toBe(1);
  // Back home: the Reach run resumes.
  await page.goto('/');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  expect(await seedOf()).toBe('kept-reach');
  expect((await sunroot(page)).contentId).toBe('willowReach');
  expect(errors).toEqual([]);
});

test("the coast's wonder on the palette, and Kite Day held from its card", async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?biome=windsweptCoast&sandbox');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  await expect(page.locator('#palette .tool-name', { hasText: /^Tidal Lagoon$/ })).toHaveCount(1);
  const card = page.getByRole('region', { name: 'Festival' });
  await expect(card.getByRole('heading', { name: 'Kite Day' })).toBeVisible();
  await card.getByRole('button', { name: /^Hold it/ }).click();
  await expect(card.getByRole('button', { name: 'Call off' })).toBeVisible();
  expect(errors).toEqual([]);
});
