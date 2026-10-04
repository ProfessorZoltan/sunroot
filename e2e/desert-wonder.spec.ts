/**
 * The Solar Oasis on screen (SD6): a desert run with a Grey Water Loop and 2
 * Concentrated Solar Plants starts the oasis over 7 tiles by the water; it is
 * drawn over them, its details say what it will give, and the desert's animals
 * come out where their habitat is.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import {
  applyCommand,
  canPlace,
  createRun,
  habitatOf,
  hexKey,
  hexNeighbors,
  loadContent,
  makeSave,
  type RunState,
} from '../src/sim';
import { withWorld } from '../src/sim/content/load';
import { hexDistance } from '../src/sim/hex';
import { wonderSiteProblem } from '../src/sim/wonder';

const SHOTS = process.env.SUNROOT_SHOTS;
if (SHOTS) test.use({ deviceScaleFactor: 3 });
const json = (file: string): unknown =>
  JSON.parse(readFileSync(new URL(`../src/content/${file}`, import.meta.url), 'utf8'));
// The Sun Desert with Root City's shared parts, as the game loads it (src/content/index.ts).
const content = loadContent(withWorld(json('root-city.json'), json('sun-desert.json')));

/** A sandbox desert with its Grey Water Loop and 2 solar plants standing, and the oasis just started. */
function oasisRun(): RunState {
  let s = createRun(content, { seed: 'oasis-e2e', water: true, sandbox: true, visions: false });
  // The loop as closed, and 2 plants on the gravel plain (put straight onto the map).
  s.loops = [{ combo: 'greyWaterLoop', anchor: 'b0', members: ['b0'], turn: 0 }];
  const site = Object.values(s.map.tiles).find(
    (t) => !wonderSiteProblem(content, s, content.byId.solarOasis!, t),
  )!;
  const near = new Set(
    Object.values(s.map.tiles)
      .filter((t) => hexDistance(t, site) <= 1)
      .map(hexKey),
  );
  const taken = new Set(Object.values(s.buildings).map((b) => hexKey(b.at)));
  const open = Object.values(s.map.tiles).filter(
    (t) => t.type === 'reg' && !taken.has(hexKey(t)) && !near.has(hexKey(t)),
  );
  for (const t of open.slice(-2)) {
    const uid = `b${s.nextUid++}`;
    s.buildings[uid] = {
      uid,
      type: 'concentratedSolarPlant',
      at: { q: t.q, r: t.r },
      builtTurn: 0,
    };
    s.priority.push(uid);
  }
  s.stores.food = 40;
  const placed = applyCommand(content, s, {
    type: 'place',
    building: 'solarOasis',
    at: { q: site.q, r: site.r },
  });
  if (!placed.ok) throw new Error(placed.error);
  s = placed.state;
  return s;
}

async function seedRun(page: Page, state: RunState) {
  await page.goto('/?sandbox');
  await page.evaluate(
    (save) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('sunroot', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('saves');
        open.onsuccess = () => {
          const tx = open.result.transaction('saves', 'readwrite');
          tx.objectStore('saves').put(save, 'current');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    makeSave(state, '2026-10-04T00:00:00Z'),
  );
}

type Win = {
  sunroot: {
    store: {
      state: {
        contentId: string;
        buildings: Record<string, { uid: string; type: string; at: { q: number; r: number } }>;
      };
      inspect(uid: string | null): void;
    };
    view: {
      scenery: { wonders: number; animals: Record<string, number> };
      screenOf(h: { q: number; r: number }): { x: number; y: number };
    } | null;
  };
};

test('the Solar Oasis: drawn over its 7 tiles, and what it will give', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await seedRun(page, oasisRun());
  await page.goto('/');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as Win).sunroot.store.state.contentId)).toBe(
    'sunDesert',
  );
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.view?.scenery.wonders))
    .toBe(1);
  const uid = await page.evaluate(
    () =>
      Object.values((window as unknown as Win).sunroot.store.state.buildings).find(
        (b) => b.type === 'solarOasis',
      )!.uid,
  );
  await page.evaluate((u) => (window as unknown as Win).sunroot.store.inspect(u), uid);
  const details = page.getByRole('region', { name: 'Solar Oasis details' });
  await expect(details).toContainText('0 of 4 seasons built');
  await expect(details).toContainText(
    '2 energy by day and 2 by night, 2 clean water a season into the channel beside it, +60 to the score, and the Graft a tier higher',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/solar-oasis.png` });
  expect(errors).toEqual([]);
});

test("the desert's animals come out where their habitat is", async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const s = oasisRun();
  const uid = Object.values(s.buildings).find((b) => b.type === 'solarOasis')!.uid;
  s.buildings[uid]!.finished = s.turn;
  // A wind tower on the rocks for the falcons; a fog net by the oasis, where there is one, for
  // the sandgrouse.
  let dunes = s;
  const beside = (t: { q: number; r: number }, type: string) =>
    hexNeighbors(t).some((n) => dunes.map.tiles[hexKey(n)]?.type === type);
  for (const [id, by] of [
    ['windTower', 'rock'],
    ['fogNet', 'oasis'],
  ] as const) {
    const at = Object.values(dunes.map.tiles).find(
      (t) => canPlace(content, dunes, id, t).ok && beside(t, by),
    );
    if (!at) continue;
    const placed = applyCommand(content, dunes, { type: 'place', building: id, at });
    if (!placed.ok) throw new Error(placed.error);
    dunes = placed.state;
  }
  // Each animal where the desert has its habitat.
  dunes.wildlife = content.wildlife
    .filter((a) => habitatOf(dunes, a).tiles.length > 0)
    .map((a) => a.id);
  expect(dunes.wildlife).toEqual(expect.arrayContaining(['fennecs', 'falcons', 'oryx']));
  const kinds: Record<string, string> = {
    fennecs: 'fennec',
    sandgrouse: 'sandgrouse',
    falcons: 'falcon',
    oryx: 'oryx',
  };
  await seedRun(page, dunes);
  await page.goto('/');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  await expect
    .poll(async () =>
      Object.keys(
        await page.evaluate(() => (window as unknown as Win).sunroot.view?.scenery.animals ?? {}),
      ).sort(),
    )
    .toEqual(dunes.wildlife.map((id) => kinds[id]!).sort());
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/solar-oasis-finished.png` });
  expect(errors).toEqual([]);
});
