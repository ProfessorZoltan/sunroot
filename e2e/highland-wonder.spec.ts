/**
 * The Cloud Terraces on screen (HL6): a Highland run with a Carbon Loop and 2
 * pump stations starts the terraces over 7 tiles on the slope; they are drawn
 * over them, their details say what they will give, and the Highland's animals
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
// The Highland with Root City's shared parts, as the game loads it (src/content/index.ts).
const content = loadContent(withWorld(json('root-city.json'), json('highland.json')));

/** A sandbox glen with its Carbon Loop and 2 pump stations standing, and the terraces just started. */
function terracesRun(): RunState {
  let s = createRun(content, { seed: 'terraces-e2e', water: true, sandbox: true, visions: false });
  // The loop as closed, and 2 pump stations on open land (put straight onto the map).
  s.loops = [{ combo: 'carbonLoop', anchor: 'b0', members: ['b0'], turn: 0 }];
  const site = Object.values(s.map.tiles).find(
    (t) => !wonderSiteProblem(content, s, content.byId.cloudTerraces!, t),
  )!;
  const near = new Set(
    Object.values(s.map.tiles)
      .filter((t) => hexDistance(t, site) <= 1)
      .map(hexKey),
  );
  const taken = new Set(Object.values(s.buildings).map((b) => hexKey(b.at)));
  const open = Object.values(s.map.tiles).filter(
    (t) => t.type === 'scrub' && !taken.has(hexKey(t)) && !near.has(hexKey(t)),
  );
  for (const t of open.slice(0, 2)) {
    const uid = `b${s.nextUid++}`;
    s.buildings[uid] = { uid, type: 'pumpStation', at: { q: t.q, r: t.r }, builtTurn: 0 };
    s.priority.push(uid);
  }
  s.stores.biomass = 40;
  const placed = applyCommand(content, s, {
    type: 'place',
    building: 'cloudTerraces',
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
    makeSave(state, '2026-10-03T00:00:00Z'),
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

test('the Cloud Terraces: drawn over their 7 tiles, and what they will give', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await seedRun(page, terracesRun());
  await page.goto('/');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as Win).sunroot.store.state.contentId)).toBe(
    'highland',
  );
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.view?.scenery.wonders))
    .toBe(1);
  const uid = await page.evaluate(
    () =>
      Object.values((window as unknown as Win).sunroot.store.state.buildings).find(
        (b) => b.type === 'cloudTerraces',
      )!.uid,
  );
  await page.evaluate((u) => (window as unknown as Win).sunroot.store.inspect(u), uid);
  const details = page.getByRole('region', { name: 'Cloud Terraces details' });
  await expect(details).toContainText('0 of 4 seasons built');
  await expect(details).toContainText(
    'homes within 3 tiles need 2 less heat each night, +60 to the score, and the Graft a tier higher',
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/terraces.png` });
  expect(errors).toEqual([]);
});

test("the Highland's animals come out where their habitat is", async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const s = terracesRun();
  const uid = Object.values(s.buildings).find((b) => b.type === 'cloudTerraces')!.uid;
  s.buildings[uid]!.finished = s.turn;
  // A hill turbine for the dippers, a lookout for the eagles.
  let glen = s;
  for (const id of ['hillTurbine', 'lookout']) {
    const at = Object.values(glen.map.tiles).find((t) => canPlace(content, glen, id, t).ok)!;
    const placed = applyCommand(content, glen, { type: 'place', building: id, at });
    if (!placed.ok) throw new Error(placed.error);
    glen = placed.state;
  }
  // Each animal where the glen has its habitat (pine woods of 4 aren't on every map).
  glen.wildlife = content.wildlife
    .filter((a) => habitatOf(glen, a).tiles.length > 0)
    .map((a) => a.id);
  expect(glen.wildlife).toEqual(expect.arrayContaining(['hares', 'dippers', 'eagles']));
  const kinds: Record<string, string> = {
    hares: 'hare',
    dippers: 'dipper',
    eagles: 'eagle',
    martens: 'marten',
  };
  await seedRun(page, glen);
  await page.goto('/');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  await expect
    .poll(async () =>
      Object.keys(
        await page.evaluate(() => (window as unknown as Win).sunroot.view?.scenery.animals ?? {}),
      ).sort(),
    )
    .toEqual(glen.wildlife.map((id) => kinds[id]!).sort());
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/terraces-finished.png` });
    // Close up, around the terraces.
    const box = (await page.locator('#map-host canvas').boundingBox())!;
    const at = await page.evaluate(() => {
      const w = (window as unknown as Win).sunroot;
      const b = Object.values(w.store.state.buildings).find((x) => x.type === 'cloudTerraces')!;
      return w.view!.screenOf(b.at);
    });
    await page.screenshot({
      path: `${SHOTS}/terraces-close.png`,
      clip: { x: box.x + at.x - 160, y: box.y + at.y - 120, width: 320, height: 240 },
    });
  }
  expect(errors).toEqual([]);
});
