/**
 * Milestone 8: Root City. "5 runs in a row play through with progression
 * kept": each run is sent home, the city places its Graft and chooses the
 * next expedition, and the city survives reloads.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { inOverview } from './menu';
import {
  applyCityCommand,
  createCity,
  loadContent,
  makeCitySave,
  type CityCommand,
  type CityState,
  type Graft,
} from '../src/sim';
import { withWorld } from '../src/sim/content/load';

const json = (file: string): unknown =>
  JSON.parse(readFileSync(new URL(`../src/content/${file}`, import.meta.url), 'utf8'));
// Willow Reach with Root City's shared parts, as the game loads it (src/content/index.ts).
const content = loadContent(withWorld(json('root-city.json'), json('willow-reach.json')));
const SHOTS = process.env.SUNROOT_SHOTS;

const graft = (district: string, tier = 'seedling'): Graft => ({
  district,
  tier,
  score: 300,
  seeds: 31,
  seed: 'earlier',
  vision: null,
  visionAchieved: false,
  sentAt: '2026-10-01T00:00:00Z',
});

function city(commands: CityCommand[]): CityState {
  let c = createCity(content, 'e2e-city');
  for (const command of commands) {
    const r = applyCityCommand(content, c, command);
    if (!r.ok) throw new Error(r.error);
    c = r.city;
  }
  return c;
}

/** Writes a city save into the browser's IndexedDB, as the game would. */
async function seedCity(page: Page, c: CityState) {
  await page.goto('/?sandbox');
  await page.evaluate(
    (save) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('sunroot', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('saves');
        open.onsuccess = () => {
          const tx = open.result.transaction('saves', 'readwrite');
          tx.objectStore('saves').put(save, 'city');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    makeCitySave(c, '2026-10-01T00:00:00Z'),
  );
}

type Win = {
  sunroot: {
    city(): CityState;
    savedCity: { runs: number };
    store?: {
      state: {
        status: string;
        turn: number;
        contentId: string;
        options: Record<string, unknown>;
        draft: { offer: string[]; picked: string | null };
        visionOffer: string[];
        charterOffer: string[];
      };
      resolution: unknown;
      reveals: { kind: string }[];
      dispatch(c: unknown): boolean;
      finishResolution(): void;
      dismissReveal(): void;
    };
  };
};

const cityNow = (page: Page) => page.evaluate(() => (window as unknown as Win).sunroot.city());

test('Root City: place the Graft, find a landmark, raise a district, choose an expedition', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // An Orchard Ward in the city, a Millrace Quarter waiting, and Seeds to spend.
  await seedCity(
    page,
    city([
      { type: 'sendHome', result: { graft: graft('orchardWard'), earned: 40, spent: 35 } },
      { type: 'place', slot: 0 },
      { type: 'sendHome', result: { graft: graft('millraceQuarter'), earned: 45, spent: 35 } },
    ]),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  const placing = page.getByRole('region', { name: 'Place the Graft' });
  await expect(placing).toContainText('Millrace Quarter, Seedling');
  // Choosing an expedition waits until the Graft is placed.
  await expect(page.getByRole('region', { name: 'Next expedition' })).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/city-placing.png` });

  // Next to the Orchard Ward (slot 1): the Cider Mill.
  await page.getByRole('button', { name: 'Slot 2: empty (place here)' }).click();
  const reveal = page.getByRole('dialog', { name: 'Landmark discovered: Cider Mill' });
  await expect(reveal).toBeVisible();
  await expect(reveal.getByRole('button', { name: 'Continue' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(reveal).toBeHidden();

  // Raise it to Sapling: 15 of the 15 Seeds.
  await page.getByRole('button', { name: 'Raise to Sapling for 15 Seeds' }).click();
  await expect(
    page.getByRole('button', { name: /Slot 2: Millrace Quarter, Sapling/ }),
  ).toBeVisible();
  await expect.poll(async () => (await cityNow(page)).seeds).toBe(0);

  // Three expeditions; choose one and set out.
  const next = page.getByRole('region', { name: 'Next expedition' });
  const options = next.locator('.card.expedition');
  await expect(options).toHaveCount(3);
  // Each is a valley region with a twist, its map drawn on the card.
  for (let i = 0; i < 3; i++) {
    await expect(options.nth(i).locator('.card-kind')).toContainText(/Willow Reach · \S/);
    await expect(options.nth(i).locator('.region-thumb')).toBeVisible();
  }
  await expect(next.getByRole('button', { name: 'Choose an expedition first' })).toBeDisabled();
  await options.nth(1).click();
  await expect(next.getByRole('button', { pressed: true })).toHaveCount(1);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/city-expedition.png` });
  const chosen = (await cityNow(page)).expedition!;
  await next.getByRole('button', { name: 'Set out on run 3' }).click();

  // The run begins with its start card: the twist, the city's gifts, and charters joining.
  const start = page.getByRole('dialog', { name: /Expedition: |A new Sprout/ });
  await expect(start).toBeVisible();
  await expect(start).toContainText('Millrace Quarter (Sapling): River wheels cost 4');
  await expect(start).toContainText('Cider Mill');
  await expect(start).toContainText('New this run: charters');
  const region = content.regions.find((r) => r.id === chosen.region)!;
  await expect(start).toContainText(`${region.name}: ${region.text}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/run-start.png` });
  const options3 = await page.evaluate(
    () => (window as unknown as Win).sunroot.store!.state.options,
  );
  expect(options3).toMatchObject({
    seed: chosen.seed,
    guided: false,
    tunings: true,
    charters: true,
    visions: false,
    city: {
      districts: { orchardWard: 'seedling', millraceQuarter: 'sapling' },
      landmarks: ['ciderMill'],
    },
    expedition: { twist: chosen.twist, request: chosen.request, region: chosen.region },
  });
  await page.keyboard.press('Enter');
  await inOverview(page, (d) =>
    expect(d.getByRole('region', { name: 'Expedition' })).toBeVisible(),
  );
  expect(errors).toEqual([]);
});

/** Plays the run in the page to its end, quickly: no building, so it ends early. */
async function playToEnd(page: Page) {
  await page.waitForFunction(() => (window as unknown as Win).sunroot?.store !== undefined);
  await page.evaluate(() => {
    const store = (window as unknown as Win).sunroot.store!;
    for (let guard = 0; guard < 60 && store.state.status === 'active'; guard++) {
      while (store.reveals.length > 0) store.dismissReveal();
      const s = store.state;
      if (s.visionOffer.length > 0)
        store.dispatch({ type: 'pickVision', vision: s.visionOffer[0] });
      if (s.charterOffer.length > 0)
        store.dispatch({ type: 'pickCharter', charter: s.charterOffer[0] });
      if (s.draft.offer.length > 0 && !s.draft.picked)
        store.dispatch({ type: 'pickCard', card: store.state.draft.offer[0] });
      store.dispatch({ type: 'endSeason' });
      store.finishResolution();
    }
    while (store.reveals.length > 0) store.dismissReveal();
  });
}

test('5 runs in a row, with Root City kept between them', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  for (let run = 1; run <= 5; run++) {
    // A new player goes straight into run 1; later runs set out from Root City.
    if (run > 1) {
      await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
      const waiting = page.getByRole('region', { name: 'Place the Graft' });
      if (await waiting.isVisible()) {
        await page
          .getByRole('button', { name: /\(place here\)/ })
          .first()
          .click();
        const card = page.getByRole('dialog');
        if (await card.isVisible()) await card.getByRole('button', { name: 'Continue' }).click();
      }
      const next = page.getByRole('region', { name: 'Next expedition' });
      await next.locator('.card.expedition').first().click();
      await next.getByRole('button', { name: `Set out on run ${run}` }).click();
    }
    // A new page for each run: give it time to load on a busy machine. A page error (a run that
    // can't start) shows in the message.
    await expect(page.locator('#map-host canvas'), errors.join('\n')).toBeVisible({
      timeout: 15_000,
    });
    await playToEnd(page);
    const dialog = page.getByRole('dialog', { name: 'The run has ended' });
    await expect(dialog).toBeVisible();
    const plant = dialog.locator('.card.graft').first();
    if (await plant.isVisible()) await plant.click();
    else await dialog.getByRole('button', { name: 'Bank the Seeds' }).click();
    await expect(dialog.getByRole('status')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.savedCity.runs))
      .toBe(run);
    await dialog.getByRole('button', { name: 'Go to Root City' }).click();
  }
  // A reload: Root City is still there, with all 5 runs and what they planted.
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  const c = await cityNow(page);
  expect(c.runs).toBe(5);
  expect(c.grafts.length).toBeGreaterThan(0);
  expect(c.districts.length + c.pending.length).toBe(c.grafts.length);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/city-after-5.png` });
  expect(errors).toEqual([]);
});

test('runs 5 and 6: the coast opens, a coast run plays and resumes, then back to the Reach', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const contentId = () =>
    page.evaluate(() => (window as unknown as Win).sunroot.store!.state.contentId);
  // A city four runs in, its next expedition still to choose.
  await seedCity(page, { ...city([]), runs: 4, seeds: 3 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  const next = page.getByRole('region', { name: 'Next expedition' });
  const coast = next.locator('.card.expedition', { hasText: 'Windswept Coast' });
  await expect(coast.first()).toBeVisible();
  await expect(next.locator('.card.expedition', { hasText: 'Willow Reach' }).first()).toBeVisible();
  await coast.first().click();
  expect((await cityNow(page)).expedition).toMatchObject({ biome: 'windsweptCoast' });
  await next.getByRole('button', { name: 'Set out on run 5' }).click();

  // Run 5 on the coast: guided, and told what is new there.
  await expect(page.locator('#map-host canvas'), errors.join('\n')).toBeVisible({
    timeout: 15_000,
  });
  const start = page.getByRole('dialog', { name: /Expedition: |A new Sprout/ });
  await expect(start).toContainText('New: the Windswept Coast');
  expect(await contentId()).toBe('windsweptCoast');
  await page.keyboard.press('Enter');
  // A reload resumes the coast run.
  await page.evaluate(() => {
    const store = (window as unknown as Win).sunroot.store!;
    const s = store.state;
    if (s.visionOffer.length > 0) store.dispatch({ type: 'pickVision', vision: s.visionOffer[0] });
    if (s.charterOffer.length > 0)
      store.dispatch({ type: 'pickCharter', charter: s.charterOffer[0] });
    if (s.draft.offer.length > 0) store.dispatch({ type: 'pickCard', card: s.draft.offer[0] });
    store.dispatch({ type: 'endSeason' });
    store.finishResolution();
  });
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.store!.state.turn))
    .toBe(1);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { sunroot: { saved: { turn: number } } }).sunroot.saved.turn,
      ),
    )
    .toBe(1);
  await page.reload();
  await expect(page.locator('#map-host canvas')).toBeVisible({ timeout: 15_000 });
  expect(await contentId()).toBe('windsweptCoast');
  await playToEnd(page);
  const dialog = page.getByRole('dialog', { name: 'The run has ended' });
  await expect(dialog).toBeVisible();
  const plant = dialog.locator('.card.graft').first();
  if (await plant.isVisible()) await plant.click();
  else await dialog.getByRole('button', { name: 'Bank the Seeds' }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.savedCity.runs))
    .toBe(5);
  await dialog.getByRole('button', { name: 'Go to Root City' }).click();

  // Run 6 back in the Reach, with the coast run counted.
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  const c = await cityNow(page);
  expect(c.runs).toBe(5);
  expect((c as CityState).biomeRuns).toEqual({ windsweptCoast: 1 });
  const waiting = page.getByRole('region', { name: 'Place the Graft' });
  if (await waiting.isVisible()) {
    await page
      .getByRole('button', { name: /\(place here\)/ })
      .first()
      .click();
    const card = page.getByRole('dialog');
    if (await card.isVisible()) await card.getByRole('button', { name: 'Continue' }).click();
  }
  await next.locator('.card.expedition', { hasText: 'Willow Reach' }).first().click();
  await next.getByRole('button', { name: 'Set out on run 6' }).click();
  await expect(page.locator('#map-host canvas')).toBeVisible({ timeout: 15_000 });
  expect(await contentId()).toBe('willowReach');
  expect(errors).toEqual([]);
});

test('the Highland opens with the fourth district: a run there, then on to the coast', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const contentId = () =>
    page.evaluate(() => (window as unknown as Win).sunroot.store!.state.contentId);
  // A city four runs in, with four districts standing.
  const four = city(
    ['orchardWard', 'millraceQuarter', 'mendedCommons', 'foundryDistrict'].flatMap((d, slot) => [
      { type: 'sendHome', result: { graft: graft(d), earned: 40, spent: 35 } } as CityCommand,
      { type: 'place', slot } as CityCommand,
    ]),
  );
  expect(four.districts).toHaveLength(4);
  await seedCity(page, { ...four, runs: 4 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  const next = page.getByRole('region', { name: 'Next expedition' });
  const glen = next.locator('.card.expedition', { hasText: 'Highland' });
  await expect(glen.first()).toBeVisible();
  await glen.first().click();
  expect((await cityNow(page)).expedition).toMatchObject({ biome: 'highland' });
  await next.getByRole('button', { name: 'Set out on run 5' }).click();

  // Run 5 in the glen: guided, and told what is new there.
  await expect(page.locator('#map-host canvas'), errors.join('\n')).toBeVisible({
    timeout: 15_000,
  });
  const start = page.getByRole('dialog', { name: /Expedition: |A new Sprout/ });
  await expect(start).toContainText('New: the Highland');
  expect(await contentId()).toBe('highland');
  await page.keyboard.press('Enter');
  await playToEnd(page);
  const dialog = page.getByRole('dialog', { name: 'The run has ended' });
  await expect(dialog).toBeVisible();
  const plant = dialog.locator('.card.graft').first();
  if (await plant.isVisible()) await plant.click();
  else await dialog.getByRole('button', { name: 'Bank the Seeds' }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.savedCity.runs))
    .toBe(5);
  await dialog.getByRole('button', { name: 'Go to Root City' }).click();

  // Back in Root City: the glen run counted, the districts kept; run 6 sets out for the coast.
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  const c = await cityNow(page);
  expect(c.runs).toBe(5);
  expect((c as CityState).biomeRuns).toEqual({ highland: 1 });
  expect(c.districts.length).toBeGreaterThanOrEqual(4);
  const waiting = page.getByRole('region', { name: 'Place the Graft' });
  if (await waiting.isVisible()) {
    await page
      .getByRole('button', { name: /\(place here\)/ })
      .first()
      .click();
    const card = page.getByRole('dialog');
    if (await card.isVisible()) await card.getByRole('button', { name: 'Continue' }).click();
  }
  await next.locator('.card.expedition', { hasText: 'Windswept Coast' }).first().click();
  await next.getByRole('button', { name: 'Set out on run 6' }).click();
  await expect(page.locator('#map-host canvas')).toBeVisible({ timeout: 15_000 });
  expect(await contentId()).toBe('windsweptCoast');
  expect(errors).toEqual([]);
});

test('the Sun Desert opens with the eighth district: a run there, then on to the coast', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const contentId = () =>
    page.evaluate(() => (window as unknown as Win).sunroot.store!.state.contentId);
  // A city nine runs in, with eight districts standing (the desert opens with the eighth).
  const eight = city(
    [
      'orchardWard',
      'millraceQuarter',
      'mendedCommons',
      'foundryDistrict',
      'tidalQuarter',
      'ridgeQuarter',
      'orchardWard',
      'millraceQuarter',
    ].flatMap((d, slot) => [
      { type: 'sendHome', result: { graft: graft(d), earned: 40, spent: 35 } } as CityCommand,
      { type: 'place', slot } as CityCommand,
    ]),
  );
  expect(eight.districts).toHaveLength(8);
  await seedCity(page, { ...eight, runs: 9, biomeRuns: { highland: 1, windsweptCoast: 1 } });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  const next = page.getByRole('region', { name: 'Next expedition' });
  const desert = next.locator('.card.expedition', { hasText: 'Sun Desert' });
  await expect(desert.first()).toBeVisible();
  await desert.first().click();
  expect((await cityNow(page)).expedition).toMatchObject({ biome: 'sunDesert' });
  await next.getByRole('button', { name: 'Set out on run 10' }).click();

  // Run 10 in the desert: guided, and told what is new there.
  await expect(page.locator('#map-host canvas'), errors.join('\n')).toBeVisible({
    timeout: 15_000,
  });
  const start = page.getByRole('dialog', { name: /Expedition: |A new Sprout/ });
  await expect(start).toContainText('New: the Sun Desert');
  expect(await contentId()).toBe('sunDesert');
  await page.keyboard.press('Enter');
  await playToEnd(page);
  const dialog = page.getByRole('dialog', { name: 'The run has ended' });
  await expect(dialog).toBeVisible();
  const plant = dialog.locator('.card.graft').first();
  if (await plant.isVisible()) await plant.click();
  else await dialog.getByRole('button', { name: 'Bank the Seeds' }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.savedCity.runs))
    .toBe(10);
  await dialog.getByRole('button', { name: 'Go to Root City' }).click();

  // Back in Root City: the desert run counted, the districts kept; run 11 sets out for the coast
  // (Lake Gardens, open after 10 runs and not yet visited, takes the Highland's place on offer).
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  const c = await cityNow(page);
  expect(c.runs).toBe(10);
  expect((c as CityState).biomeRuns).toEqual({ highland: 1, windsweptCoast: 1, sunDesert: 1 });
  expect(c.districts.length).toBeGreaterThanOrEqual(8);
  const waiting = page.getByRole('region', { name: 'Place the Graft' });
  if (await waiting.isVisible()) {
    await page
      .getByRole('button', { name: /\(place here\)/ })
      .first()
      .click();
    const card = page.getByRole('dialog');
    if (await card.isVisible()) await card.getByRole('button', { name: 'Continue' }).click();
  }
  await expect(next.locator('.card.expedition', { hasText: 'Lake Gardens' })).toHaveCount(1);
  await next.locator('.card.expedition', { hasText: 'Windswept Coast' }).first().click();
  await next.getByRole('button', { name: 'Set out on run 11' }).click();
  await expect(page.locator('#map-host canvas')).toBeVisible({ timeout: 15_000 });
  expect(await contentId()).toBe('windsweptCoast');
  expect(errors).toEqual([]);
});

test('Lake Gardens opens after 10 runs: a run there, then on to the desert', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const contentId = () =>
    page.evaluate(() => (window as unknown as Win).sunroot.store!.state.contentId);
  // A city ten runs in, with eight districts standing: all five biomes are open.
  const eight = city(
    [
      'orchardWard',
      'millraceQuarter',
      'mendedCommons',
      'foundryDistrict',
      'tidalQuarter',
      'ridgeQuarter',
      'sunQuarter',
      'millraceQuarter',
    ].flatMap((d, slot) => [
      { type: 'sendHome', result: { graft: graft(d), earned: 40, spent: 35 } } as CityCommand,
      { type: 'place', slot } as CityCommand,
    ]),
  );
  const visited = { highland: 1, windsweptCoast: 1, sunDesert: 1 };
  await seedCity(page, { ...eight, runs: 10, biomeRuns: visited });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  const next = page.getByRole('region', { name: 'Next expedition' });
  const lake = next.locator('.card.expedition', { hasText: 'Lake Gardens' });
  await expect(lake).toHaveCount(1);
  await lake.click();
  expect((await cityNow(page)).expedition).toMatchObject({ biome: 'lakeGardens' });
  await next.getByRole('button', { name: 'Set out on run 11' }).click();

  // Run 11 on the lake: guided, and told what is new there.
  await expect(page.locator('#map-host canvas'), errors.join('\n')).toBeVisible({
    timeout: 15_000,
  });
  const start = page.getByRole('dialog', { name: /Expedition: |A new Sprout/ });
  await expect(start).toContainText('New: Lake Gardens');
  expect(await contentId()).toBe('lakeGardens');
  await page.keyboard.press('Enter');
  await playToEnd(page);
  const dialog = page.getByRole('dialog', { name: 'The run has ended' });
  await expect(dialog).toBeVisible();
  const plant = dialog.locator('.card.graft').first();
  if (await plant.isVisible()) await plant.click();
  else await dialog.getByRole('button', { name: 'Bank the Seeds' }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.savedCity.runs))
    .toBe(11);
  await dialog.getByRole('button', { name: 'Go to Root City' }).click();

  // Back in Root City: the lake run counted, the districts kept; run 12 sets out for the desert.
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  const c = await cityNow(page);
  expect(c.runs).toBe(11);
  expect((c as CityState).biomeRuns).toEqual({ ...visited, lakeGardens: 1 });
  expect(c.districts.length).toBeGreaterThanOrEqual(8);
  const waiting = page.getByRole('region', { name: 'Place the Graft' });
  if (await waiting.isVisible()) {
    await page
      .getByRole('button', { name: /\(place here\)/ })
      .first()
      .click();
    const card = page.getByRole('dialog');
    if (await card.isVisible()) await card.getByRole('button', { name: 'Continue' }).click();
  }
  await next.locator('.card.expedition', { hasText: 'Sun Desert' }).first().click();
  await next.getByRole('button', { name: 'Set out on run 12' }).click();
  await expect(page.locator('#map-host canvas')).toBeVisible({ timeout: 15_000 });
  expect(await contentId()).toBe('sunDesert');
  expect(errors).toEqual([]);
});

test('Rainforest Gardens opens once 10 districts stand: a run there, then on to another biome', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const contentId = () =>
    page.evaluate(() => (window as unknown as Win).sunroot.store!.state.contentId);
  // A city twelve runs in, with ten districts standing: all six biomes are open.
  const ten = city(
    [
      'orchardWard',
      'millraceQuarter',
      'mendedCommons',
      'foundryDistrict',
      'tidalQuarter',
      'ridgeQuarter',
      'sunQuarter',
      'canalQuarter',
      'millraceQuarter',
      'orchardWard',
    ].flatMap((d, slot) => [
      { type: 'sendHome', result: { graft: graft(d), earned: 40, spent: 35 } } as CityCommand,
      { type: 'place', slot } as CityCommand,
    ]),
  );
  const visited = { highland: 1, windsweptCoast: 1, sunDesert: 1, lakeGardens: 1 };
  await seedCity(page, { ...ten, runs: 12, biomeRuns: visited });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  const next = page.getByRole('region', { name: 'Next expedition' });
  const forest = next.locator('.card.expedition', { hasText: 'Rainforest Gardens' });
  await expect(forest).toHaveCount(1);
  await forest.click();
  expect((await cityNow(page)).expedition).toMatchObject({ biome: 'rainforestGardens' });
  await next.getByRole('button', { name: 'Set out on run 13' }).click();

  // Run 13 in the forest: guided, and told what is new there.
  await expect(page.locator('#map-host canvas'), errors.join('\n')).toBeVisible({
    timeout: 15_000,
  });
  const start = page.getByRole('dialog', { name: /Expedition: |A new Sprout/ });
  await expect(start).toContainText('New: Rainforest Gardens');
  expect(await contentId()).toBe('rainforestGardens');
  await page.keyboard.press('Enter');
  await playToEnd(page);
  const dialog = page.getByRole('dialog', { name: 'The run has ended' });
  await expect(dialog).toBeVisible();
  const plant = dialog.locator('.card.graft').first();
  if (await plant.isVisible()) await plant.click();
  else await dialog.getByRole('button', { name: 'Bank the Seeds' }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.savedCity.runs))
    .toBe(13);
  await dialog.getByRole('button', { name: 'Go to Root City' }).click();

  // Back in Root City: the forest run counted, the districts kept; run 14 sets out elsewhere.
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  const c = await cityNow(page);
  expect(c.runs).toBe(13);
  expect((c as CityState).biomeRuns).toEqual({ ...visited, rainforestGardens: 1 });
  expect(c.districts.length).toBeGreaterThanOrEqual(10);
  const waiting = page.getByRole('region', { name: 'Place the Graft' });
  if (await waiting.isVisible()) {
    await page
      .getByRole('button', { name: /\(place here\)/ })
      .first()
      .click();
    const card = page.getByRole('dialog');
    if (await card.isVisible()) await card.getByRole('button', { name: 'Continue' }).click();
  }
  const elsewhere = next.locator('.card.expedition', { hasNotText: 'Rainforest Gardens' }).first();
  await elsewhere.click();
  const biome = (await cityNow(page)).expedition?.biome ?? 'willowReach';
  expect(biome).not.toBe('rainforestGardens');
  await next.getByRole('button', { name: 'Set out on run 14' }).click();
  await expect(page.locator('#map-host canvas')).toBeVisible({ timeout: 15_000 });
  expect(await contentId()).toBe(biome);
  expect(errors).toEqual([]);
});

test('Tempest: chosen in Root City, played in the run, its mark on the district', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // A Heartwood Graft at Tempest 1 placed (with its mark), and Tempest 2 unlocked.
  const c = city([
    {
      type: 'sendHome',
      result: {
        graft: { ...graft('orchardWard', 'heartwood'), tempest: 1 },
        earned: 40,
        spent: 35,
        tier: 'heartwood',
        tempest: 1,
      },
    },
    { type: 'place', slot: 0 },
  ]);
  expect(c.tempestUnlocked).toBe(2);
  await seedCity(page, c);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Slot 1: Orchard Ward, Heartwood, Tempest 1/ }),
  ).toBeVisible();
  await expect(page.getByLabel('Tempest', { exact: true })).toContainText('2 of 10 unlocked');
  const next = page.getByRole('region', { name: 'Next expedition' });
  await next.getByRole('radio', { name: '2' }).check();
  await expect(next).toContainText('Tempest 2: +4 Seeds');
  await expect(next).toContainText('Thin Drafts');
  expect((await cityNow(page)).tempest).toBe(2);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/tempest-city.png` });
  await next.locator('.card.expedition').first().click();
  await next.getByRole('button', { name: 'Set out on run 2' }).click();
  const start = page.getByRole('dialog', { name: /Expedition: / });
  await expect(start).toContainText('Tempest 2: Bitter Nights');
  await page.keyboard.press('Enter');
  await inOverview(page, (d) =>
    expect(d.getByRole('region', { name: 'Expedition' })).toContainText(
      'Tempest 2: Bitter Nights, Thin Drafts.',
    ),
  );
  expect(errors).toEqual([]);
});

test('Start over forgets Root City and begins again at run 1', async ({ page }) => {
  await seedCity(
    page,
    city([
      { type: 'sendHome', result: { graft: graft('orchardWard'), earned: 40, spent: 35 } },
      { type: 'place', slot: 0 },
      { type: 'sendHome', result: { graft: graft('millraceQuarter'), earned: 45, spent: 35 } },
    ]),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  await page.getByRole('button', { name: 'Start over' }).click();
  const dialog = page.getByRole('dialog', { name: 'Start over?' });
  await expect(dialog).toContainText('2 runs sent home, 1 district and 15 Seeds');
  // Cancelling keeps the city.
  await expect(dialog.getByRole('button', { name: 'Keep my city' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect((await cityNow(page)).runs).toBe(2);

  await page.getByRole('button', { name: 'Start over' }).click();
  await dialog.getByRole('button', { name: 'Start over' }).click();
  // Run 1 begins, guided, and the new city has sent nothing home.
  await expect(page.locator('#map-host canvas')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.store?.state.options))
    .toMatchObject({ guided: true });
  await expect.poll(() => cityNow(page).then((c) => c.runs)).toBe(0);
});

test('new expeditions for Seeds: three other valleys, dearer each time', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await seedCity(page, { ...city([]), runs: 2, seeds: 20 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  const next = page.getByRole('region', { name: 'Next expedition' });
  const seedsOf = () =>
    next.locator('.card.expedition').evaluateAll((cards) => cards.map((c) => c.textContent));
  const before = await seedsOf();
  await next.locator('.card.expedition').first().click();
  await next.getByRole('button', { name: 'New expeditions for 5 Seeds' }).click();
  await expect(next.getByRole('button', { name: 'New expeditions for 10 Seeds' })).toBeVisible();
  expect(await seedsOf()).not.toEqual(before);
  // The chosen one went with the old set.
  await expect(next.getByRole('button', { name: 'Choose an expedition first' })).toBeDisabled();
  expect((await cityNow(page)).seeds).toBe(15);
  await next.getByRole('button', { name: 'New expeditions for 10 Seeds' }).click();
  // 5 Seeds left: the next set, at 15, can't be paid.
  await expect(next.getByRole('button', { name: 'New expeditions for 15 Seeds' })).toBeDisabled();
  expect(errors).toEqual([]);
});

test('keepsakes: bought by mouse, drawn in the city, carried into the next run', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const c = city([
    { type: 'sendHome', result: { graft: graft('orchardWard'), earned: 135, spent: 35 } },
    { type: 'place', slot: 0 },
  ]);
  await seedCity(page, c);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  const panel = page.getByRole('region', { name: 'Keepsakes' });
  await panel.locator('summary').click();
  await expect(panel).toContainText('0 of 34');
  await panel.getByRole('button', { name: 'The fountain for 60 Seeds' }).click();
  await panel.getByRole('button', { name: "The city's banner for 30 Seeds" }).click();
  await expect.poll(async () => (await cityNow(page)).seeds).toBe(10);
  // 10 Seeds left: the white hart, at 20, can't be paid.
  await expect(panel.getByRole('button', { name: 'The white hart for 20 Seeds' })).toBeDisabled();
  await expect(page.locator('.city-ornaments .fountain')).toHaveCount(1);
  // Switched off, it goes; on again, it comes back.
  const fountain = panel.locator('li', { hasText: 'The fountain' }).getByRole('checkbox');
  await fountain.uncheck();
  await expect(page.locator('.city-ornaments .fountain')).toHaveCount(0);
  await fountain.check();
  await expect(page.locator('.city-ornaments .fountain')).toHaveCount(1);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/keepsakes-city.png` });

  // Into the next run: the banner flies over the camp.
  const next = page.getByRole('region', { name: 'Next expedition' });
  await next.locator('.card.expedition').first().click();
  await next.getByRole('button', { name: 'Set out on run 2' }).click();
  await expect(page.locator('#map-host canvas')).toBeVisible({ timeout: 15_000 });
  const run = () =>
    page.evaluate(() => {
      const w = (window as unknown as Win).sunroot as unknown as {
        store: { state: { options: { city: { keepsakes?: string[]; banner?: string } } } };
        view: { scenery: { props: Record<string, number> } } | null;
      };
      return { city: w.store.state.options.city, props: w.view?.scenery.props ?? {} };
    });
  expect((await run()).city).toMatchObject({
    keepsakes: ['fountain', 'cityBanner'],
    banner: 'orchardWard',
  });
  await expect.poll(async () => (await run()).props.banner).toBe(1);
  expect(errors).toEqual([]);
});
