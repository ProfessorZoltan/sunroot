/**
 * Milestone 9: sound. Audio starts with the first key press; placing a
 * building plays its note, the soundtrack plays bars, and the sound can be
 * turned off and stays off.
 */
import { expect, test, type Page } from '@playwright/test';

type Audio = {
  unlocked: boolean;
  bars: number;
  settings: { on: boolean; music: number; effects: number };
  log: { cue: string }[];
  currentLayers: number;
};
const audio = (page: Page) =>
  page.evaluate(() => {
    const a = (window as unknown as { sunroot: { audio: Audio } }).sunroot.audio;
    return {
      unlocked: a.unlocked,
      bars: a.bars,
      settings: a.settings,
      cues: a.log.map((e) => e.cue),
      layers: a.currentLayers,
    };
  });

test('sound: notes for what you do, music that plays, and an off switch', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=willow-reach-golden&visions=0');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  expect((await audio(page)).unlocked).toBe(false);

  await page.keyboard.press('1'); // the first key press starts audio, and picks the orchard card
  await expect.poll(async () => (await audio(page)).unlocked).toBe(true);
  await expect.poll(async () => (await audio(page)).bars).toBeGreaterThan(0);
  await page.keyboard.press('f');
  await page.keyboard.press('Enter');
  await expect
    .poll(async () => (await audio(page)).cues)
    .toEqual(expect.arrayContaining(['pick:orchard', 'place:floodplainFarm']));
  // Harmony starts below the first tier: one layer of music.
  expect((await audio(page)).layers).toBe(1);

  // Off, and still off after a reload.
  const button = page.getByRole('button', { name: 'Sound', exact: true });
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(page.locator('#map-host canvas')).toBeVisible();
  expect((await audio(page)).settings.on).toBe(false);

  // The keys panel has the volumes.
  await page.keyboard.press('?');
  const help = page.getByRole('dialog', { name: 'Keyboard' });
  await expect(help.getByRole('slider', { name: 'Music volume' })).toBeVisible();
  await help.getByRole('slider', { name: 'Effects volume' }).fill('30');
  await expect.poll(async () => (await audio(page)).settings.effects).toBe(0.3);
  expect(errors).toEqual([]);
});
