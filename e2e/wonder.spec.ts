/**
 * The Great Water Garden on screen (E5): a run with a Bath Loop and 3 reed
 * beds starts the garden over 7 tiles; it is drawn over them with its art, its
 * details show how far it has come, and the palette no longer offers it.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import {
  applyCommand,
  canPlace,
  createRun,
  hexKey,
  hexNeighbors,
  loadContent,
  makeSave,
  type RunState,
} from '../src/sim';
import { withWorld } from '../src/sim/content/load';

const SHOTS = process.env.SUNROOT_SHOTS;
const json = (file: string): unknown =>
  JSON.parse(readFileSync(new URL(`../src/content/${file}`, import.meta.url), 'utf8'));
// Willow Reach with Root City's shared parts, as the game loads it (src/content/index.ts).
const content = loadContent(withWorld(json('root-city.json'), json('willow-reach.json')));

/** A sandbox run with water, its Bath Loop and 3 reed beds standing, and the garden just started. */
function gardenRun(): RunState {
  let s = createRun(content, { seed: 'garden-e2e', water: true, sandbox: true, visions: false });
  // The loop as closed, and 3 reed beds on the river bank (put straight onto the map).
  s.loops = [{ combo: 'bathLoop', anchor: 'b0', members: ['b0'], turn: 0 }];
  const taken = new Set(Object.values(s.buildings).map((b) => hexKey(b.at)));
  const bank = Object.values(s.map.tiles).filter(
    (t) =>
      t.type === 'floodplain' &&
      !taken.has(hexKey(t)) &&
      hexNeighbors(t).some((n) => s.map.tiles[hexKey(n)]?.type === 'river'),
  );
  for (const t of bank.slice(0, 3)) {
    const uid = `b${s.nextUid++}`;
    s.buildings[uid] = { uid, type: 'reedBed', at: { q: t.q, r: t.r }, builtTurn: 0 };
    s.priority.push(uid);
  }
  s.stores.biomass = 40;
  const site = Object.values(s.map.tiles).find(
    (t) => canPlace(content, s, 'greatWaterGarden', t).ok,
  )!;
  const placed = applyCommand(content, s, {
    type: 'place',
    building: 'greatWaterGarden',
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
    makeSave(state, '2026-10-02T00:00:00Z'),
  );
}

type Win = {
  sunroot: {
    store: {
      state: { turn: number; buildings: Record<string, { uid: string; type: string }> };
      inspect(uid: string | null): void;
      resolution: unknown;
      reveals: unknown[];
    };
    view: { scenery: { wonders: number } } | null;
  };
};

test('the Great Water Garden: drawn over its 7 tiles, its progress, a season on', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await seedRun(page, gardenRun());
  await page.goto('/');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.view?.scenery.wonders))
    .toBe(1);
  // Started, so the palette no longer offers it.
  const palette = page.getByRole('group', { name: 'Buildings' });
  await expect(palette.getByRole('button', { name: /Great Water Garden/ })).toHaveCount(0);

  // Its details: how far it has come, and what it gives.
  const uid = await page.evaluate(
    () =>
      Object.values((window as unknown as Win).sunroot.store.state.buildings).find(
        (b) => b.type === 'greatWaterGarden',
      )!.uid,
  );
  await page.evaluate((u) => (window as unknown as Win).sunroot.store.inspect(u), uid);
  const details = page.getByRole('region', { name: 'Great Water Garden details' });
  await expect(details).toContainText('0 of 4 seasons built');
  await expect(details).toContainText('+60 to the score, and the Graft a tier higher');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/garden-stage1.png` });
  await page.keyboard.press('Escape');

  // A season on, a season further.
  await page.keyboard.press('1');
  await page.keyboard.press('e');
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.store.state.turn))
    .toBe(1);
  for (let i = 0; i < 10; i++) {
    const busy = await page.evaluate(() => {
      const s = (window as unknown as Win).sunroot.store;
      return s.resolution !== null || s.reveals.length > 0;
    });
    if (!busy) break;
    await page.keyboard.press('Escape');
  }
  await page.evaluate((u) => (window as unknown as Win).sunroot.store.inspect(u), uid);
  await expect(details).toContainText('1 of 4 seasons built');
  expect(errors).toEqual([]);
});
