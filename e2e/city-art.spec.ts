/**
 * Root City drawn from its art (docs/ART-CITY.md), and its dusk: back from a run, the city
 * dims and its windows light, then day returns. The slots still answer the pointer through the art.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { createCity, loadContent, makeCitySave, type CityState } from '../src/sim';
import { withWorld } from '../src/sim/content/load';

const json = (file: string): unknown =>
  JSON.parse(readFileSync(new URL(`../src/content/${file}`, import.meta.url), 'utf8'));
const content = loadContent(withWorld(json('root-city.json'), json('willow-reach.json')));
const SHOTS = process.env.SUNROOT_SHOTS;
if (SHOTS) test.use({ deviceScaleFactor: 2 });

/** A city of 12 districts at every tier, with the Cider Mill standing, 10 runs in. */
function grownCity(): CityState {
  const kinds = [
    'millraceQuarter',
    'orchardWard',
    'mendedCommons',
    'foundryDistrict',
    'tidalQuarter',
    'ridgeQuarter',
  ];
  const tiers = ['heartwood', 'sapling', 'seedling'];
  const districts = Array.from({ length: 12 }, (_, slot) => ({
    slot,
    district: kinds[slot % kinds.length]!,
    tier: tiers[slot % tiers.length]!,
    invested: 0,
    run: slot + 1,
  }));
  return {
    ...createCity(content, 'city-art'),
    runs: 10,
    seeds: 20,
    districts,
    landmarks: ['ciderMill'],
    expedition: null,
  };
}

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
    makeCitySave(c, '2026-10-04T00:00:00Z'),
  );
}

const duskOf = async (page: Page) =>
  Number(
    await page
      .getByRole('group', { name: 'District slots around the Heartwood' })
      .getAttribute('data-dusk'),
  );

test('back from a run, the city settles into dusk and day returns', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await seedCity(page, grownCity());
  await page.goto('/?city');
  const slots = page.getByRole('group', { name: 'District slots around the Heartwood' });
  await expect(slots).toBeVisible();
  expect(await duskOf(page)).toBe(0);
  if (SHOTS) await page.locator('.city-map').screenshot({ path: `${SHOTS}/city-day.png` });
  await expect.poll(() => duskOf(page), { timeout: 8000 }).toBe(1);
  if (SHOTS) await page.locator('.city-map').screenshot({ path: `${SHOTS}/city-dusk.png` });
  // A district still answers the pointer through its art.
  await slots.getByRole('button', { name: /^Slot 1: Millrace Quarter/ }).click();
  await expect(page.getByRole('region', { name: 'District' })).toContainText('Millrace Quarter');
  await expect.poll(() => duskOf(page), { timeout: 15_000 }).toBe(0);
  expect(errors).toEqual([]);
});

test('with reduced motion there is no dusk', async ({ browser }) => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await seedCity(page, grownCity());
  await page.goto('/?city');
  await expect(
    page.getByRole('group', { name: 'District slots around the Heartwood' }),
  ).toBeVisible();
  await page.waitForTimeout(4000);
  expect(await duskOf(page)).toBe(0);
  await page.close();
});
