/**
 * What would go short if the season ended now (src/game/shortfalls.ts): power, heat, water and
 * cooling, read from the season's preview.
 */
import { describe, expect, it } from 'vitest';
import { forecastSeason, type SeasonReport } from '../src/sim';
import { shortfalls, shortOf } from '../src/game/shortfalls';
import { content, place, scenario, uidAt, withWater } from './helpers';

const LAND = ['~ f , , , ,', '~ f , , , ,', '~ f C , , ,', '~ f , , , ,'];

describe('shortfalls if the season ended now', () => {
  it('a farm with no channel beside it: short of water', () => {
    const W = withWater();
    const s = place(
      scenario(LAND, { content: W, run: { water: true } }),
      'floodplainFarm',
      1,
      0,
      W,
    );
    const short = shortfalls(W, s, forecastSeason(W, s).lastReport!);
    const farm = short.find((x) => x.uid === uidAt(s, 1, 0))!;
    expect(farm.needs).toEqual(['water']);
    expect(farm.lines[0]).toMatch(/needs 1 and gets none/);
  });

  it('more night demand than energy: the last in priority shut off, short of power (and heat in winter)', () => {
    const homes: [number, number][] = [
      [3, 0],
      [4, 0],
      [5, 0],
      [3, 1],
      [4, 1],
      [5, 1],
    ];
    const at = (season: 'spring' | 'winter') =>
      homes.reduce((s, [c, r]) => place(s, 'cottage', c, r), scenario(LAND, { season }));
    const spring = at('spring');
    const report = forecastSeason(content, spring).lastReport!;
    const short = shortfalls(content, spring, report);
    expect(short.length).toBe(report.blackouts.length);
    expect(short.length).toBeGreaterThan(0);
    for (const s of short) expect(s.needs).toEqual(['power']);
    // In winter the cottages need heat too, paid from the grid: a blackout leaves them without.
    const winter = at('winter');
    const cold = shortfalls(content, winter, forecastSeason(content, winter).lastReport!);
    expect(cold.length).toBeGreaterThan(0);
    for (const s of cold) expect(s.needs).toEqual(['power', 'heat']);
  });

  it('shut off cold or hot: short of heat or cooling, not power', () => {
    const s = place(scenario(LAND), 'cottage', 3, 0);
    const uid = uidAt(s, 3, 0);
    const base = forecastSeason(content, s).lastReport!;
    const report = (cold: string[], hot: string[]): SeasonReport => ({
      ...base,
      blackouts: [...cold, ...hot],
      cold,
      hot,
    });
    expect(shortfalls(content, s, report([uid], []))[0]!.needs).toEqual(['heat']);
    expect(shortfalls(content, s, report([], [uid]))[0]!.needs).toEqual(['cooling']);
    expect(shortOf(shortfalls(content, s, report([uid], [])), 'power')).toEqual([]);
  });

  it('nothing short in a quiet season', () => {
    const s = scenario(LAND);
    expect(shortfalls(content, s, forecastSeason(content, s).lastReport!)).toEqual([]);
  });
});
