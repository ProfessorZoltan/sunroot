/**
 * Playtest requests: the season report (what each resource was made and used
 * by, for the last of each season) and demolishing a building.
 */
import { expect, test, type Page } from '@playwright/test';

const SHOTS = process.env.SUNROOT_SHOTS;
type Win = {
  sunroot: {
    store: {
      state: {
        turn: number;
        buildings: Record<string, { type: string; at: { q: number; r: number } }>;
        map: { tiles: Record<string, { type: string }> };
        stores: Record<string, number>;
      };
      resolution: unknown;
      reveals: unknown[];
      inspect(uid: string | null): void;
    };
  };
};

async function endSeason(page: Page, turn: number) {
  await page.keyboard.press('1');
  await page.keyboard.press('e');
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.store.state.turn))
    .toBe(turn);
  for (let i = 0; i < 10; i++) {
    const busy = await page.evaluate(() => {
      const s = (window as unknown as Win).sunroot.store;
      return s.resolution !== null || s.reveals.length > 0;
    });
    if (!busy) break;
    await page.keyboard.press('Escape');
  }
}

test('the season report shows what made and used each resource', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=willow-reach-golden&visions=0');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  const button = page.getByRole('button', { name: 'Season report' });
  await expect(button).toBeDisabled();
  // Spring: a farm, then end the season.
  await page.keyboard.press('f');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await endSeason(page, 1);
  await endSeason(page, 2);

  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Season report' });
  await expect(dialog.getByRole('tab')).toHaveCount(2);
  await expect(dialog.getByRole('tab', { name: 'Summer, year 1' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(dialog).toContainText('Citizens eat');
  // The Sankey: a node per source, resource and use; focusing one shows its numbers.
  const sankey = dialog.getByRole('img', { name: /Where each resource came from and went/ });
  await expect(sankey).toBeVisible();
  await dialog.getByRole('button', { name: /^Food: / }).focus();
  await expect(dialog.locator('.sankey-tip')).toContainText('Food made and used');
  // The energy and heat Sankey: a node for each slot.
  await expect(
    dialog.getByRole('img', { name: /Where the day's and the night's energy/ }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: /^Night: / }).focus();
  await expect(dialog.locator('.sankey-tip')).toContainText('Night supplied and used');
  await expect(dialog).toContainText('Floodplain Farm');
  await dialog.getByRole('tab', { name: 'Spring, year 1' }).click();
  await expect(dialog).toContainText('Building: Floodplain Farm');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/season-report.png` });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  // The year strip links each past season to its report.
  await page.getByRole('button', { name: 'Report for the last spring' }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Season report' })
      .getByRole('tab', { name: 'Spring, year 1' }),
  ).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('a building can be demolished from the inspector, or with Delete', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=willow-reach-golden&visions=0');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  await page.keyboard.press('f');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.keyboard.press('c');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  const ids = () =>
    page.evaluate(() =>
      Object.entries((window as unknown as Win).sunroot.store.state.buildings)
        .filter(([, b]) => b.type !== 'foundersCamp')
        .map(([uid, b]) => [uid, b.type] as const),
    );
  const built = await ids();
  const farm = built[0]![0];
  const composter = built[1]![0];
  await page.evaluate((uid) => (window as unknown as Win).sunroot.store.inspect(uid), farm);
  const details = page.getByRole('region', { name: 'Floodplain Farm details' });
  await expect(details).toContainText('2 day energy this season, leaves 1 clutter');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/demolish.png` });
  await details.getByRole('button', { name: 'Demolish' }).click();
  await expect.poll(async () => (await ids()).map(([, t]) => t)).toEqual(['composter']);
  // Delete demolishes what the inspector shows.
  await page.evaluate((uid) => (window as unknown as Win).sunroot.store.inspect(uid), composter);
  await expect(page.getByRole('region', { name: 'Composter details' })).toBeVisible();
  await page.keyboard.press('Delete');
  await expect.poll(async () => (await ids()).length).toBe(0);
  // Undo brings it back.
  await page.keyboard.press('z');
  await expect.poll(async () => (await ids()).length).toBe(1);
  expect(errors).toEqual([]);
});

test('fast-forward ends seasons, waiting for each card, and Esc stops it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=willow-reach-golden&visions=0');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  const turn = () => page.evaluate(() => (window as unknown as Win).sunroot.store.state.turn);
  await page.keyboard.press('1');
  await page.keyboard.press('Shift+E');
  await expect.poll(turn).toBe(1);
  // Summer deals a card: fast-forward waits for it.
  await expect(
    page.getByRole('status').filter({ hasText: 'Pick a card to carry on' }),
  ).toBeVisible();
  await page.keyboard.press('1');
  await expect.poll(turn).toBe(2);
  await page.getByRole('button', { name: 'Stop' }).click();
  await page.keyboard.press('1');
  await page.waitForTimeout(500);
  expect(await turn()).toBe(2);
  expect(errors).toEqual([]);
});

test('repairs: on hold from the inspector, then repaired now', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=willow-reach-golden&visions=0&sandbox&guided=0');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  type Store = {
    legalSites: { at: { q: number; r: number }; risky: boolean }[];
    selectBuilding(b: string | null): void;
    dispatch(c: unknown): boolean;
    inspect(uid: string | null): void;
    finishResolution(): void;
    reveals: unknown[];
    dismissReveal(): void;
    state: {
      buildings: Record<string, { type: string; damage?: { cause: string } }>;
      draft: { offer: string[] };
    };
  };
  // A workshop where the spring flood will reach it.
  const uid = await page.evaluate(() => {
    const s = (window as unknown as { sunroot: { store: Store } }).sunroot.store;
    s.selectBuilding('workshop');
    const site = s.legalSites.find((x) => x.risky)!;
    s.dispatch({ type: 'place', building: 'workshop', at: site.at });
    s.selectBuilding(null);
    return Object.entries(s.state.buildings).find(([, b]) => b.type === 'workshop')![0];
  });
  await page.evaluate(
    (u) => (window as unknown as { sunroot: { store: Store } }).sunroot.store.inspect(u),
    uid,
  );
  const details = page.getByRole('region', { name: 'Workshop details' });
  const auto = details.getByRole('checkbox', { name: 'Repair automatically when damaged' });
  await expect(auto).toBeChecked();
  await auto.uncheck();
  // The flood comes; the workshop stays damaged.
  await page.evaluate(() => {
    const s = (window as unknown as { sunroot: { store: Store } }).sunroot.store;
    s.dispatch({ type: 'pickCard', card: s.state.draft.offer[0] });
    s.dispatch({ type: 'endSeason' });
    s.finishResolution();
    while (s.reveals.length) s.dismissReveal();
  });
  const damage = () =>
    page.evaluate(
      (u) =>
        (window as unknown as { sunroot: { store: Store } }).sunroot.store.state.buildings[u]!
          .damage?.cause ?? null,
      uid,
    );
  expect(await damage()).toBe('flood');
  await page.evaluate(
    (u) => (window as unknown as { sunroot: { store: Store } }).sunroot.store.inspect(u),
    uid,
  );
  await expect(details).toContainText('Repairs are on hold');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/repairs.png` });
  await details.getByRole('button', { name: /^Repair now for \d+ materials$/ }).click();
  await expect.poll(damage).toBeNull();
  expect(errors).toEqual([]);
});
