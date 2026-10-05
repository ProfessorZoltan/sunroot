/**
 * Lake Gardens on screen (LG4, proposals/lake-gardens.md): what the interface says about the
 * lake. The grey water it holds and whether it will bloom, mud and silt on the shallows, where
 * water comes in, boats with nothing to lift, the bloom's reach on the fisheries, and the season
 * report's lines. Drawing is checked in e2e; here, the data it draws.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import { hexKey, parseHexKey, projectSeason, type RunState } from '../src/sim';
import { bloomSummary, lakeAt, lakeNotes, lakeOutlook } from '../src/game/lakeInfo';
import { mapMarks, reachSummary } from '../src/game/marks';
import { buildTimeline } from '../src/game/timeline';
import { ambientFor } from '../src/render/ambient';
import { lakeLook, shoreSides } from '../src/render/lakeArt';
import { snowless } from '../src/render/lands';
import { artSeason } from '../src/render/sprites';
import { at, endSeason, place, scenario, uidAt } from './helpers';

const LAKE = biomeContent('lakeGardens');

// Land on the left, shallows in the middle, deep water on the right.
const SHORE = [
  '~ , , , , w w D D',
  '~ , , , , w w D D',
  '~ , C , , w w D D',
  '~ , , , , w w D D',
  '~ , , , , , w w D',
];

function start(season: 'spring' | 'summer' | 'autumn' | 'winter' = 'summer') {
  const s = scenario(SHORE, {
    content: LAKE,
    season,
    citizens: 20,
    stores: { food: 200, materials: 200 },
    run: { water: true },
  });
  for (const t of Object.values(s.map.tiles))
    if (t.type === 'shallows' || t.type === 'deep') t.water = 4;
  return s;
}
const now = (s: RunState) => projectSeason(LAKE, s, s.season, { forecast: true });
const tileAt = (s: RunState, col: number, row: number) => s.map.tiles[hexKey(at(col, row))]!;

describe('the lake in the tooltip', () => {
  it('says how much mud a shallows tile holds, and when it has silted up', () => {
    const s = start();
    tileAt(s, 5, 0).mud = 2;
    expect(lakeAt(LAKE, s, now(s), at(5, 0))).toContain(
      'Mud: 2 of 4 (it silts up at 4). A mud boat beside it lifts it as compost.',
    );
    tileAt(s, 5, 0).mud = 4;
    tileAt(s, 5, 0).silted = true;
    expect(lakeAt(LAKE, s, now(s), at(5, 0)).join(' ')).toMatch(/^Silted up with 4 mud: nothing/);
    expect(lakeAt(LAKE, s, now(s), at(6, 0))).toEqual([]);
  });

  it('says where water comes into the lake, and the mud it leaves', () => {
    const s = place(start(), 'stiltHouse', 5, 1, LAKE);
    const forecast = now(s);
    const [key] = Object.keys(forecast.water!.lakeIn!);
    expect(key).toBeDefined();
    const lines = lakeAt(LAKE, s, forecast, parseHexKey(key!));
    expect(lines.join(' ')).toMatch(/grey water comes into the lake here this season/);
  });

  it('a mud boat with no mud beside it, and a fishery with no grey water, say so', () => {
    let s = place(start(), 'mudBoat', 4, 1, LAKE);
    s = place(s, 'wastewaterFishery', 5, 3, LAKE);
    const lines = [...lakeAt(LAKE, s, now(s), at(4, 1)), ...lakeAt(LAKE, s, now(s), at(5, 3))];
    expect(lines).toContain('Nothing to lift: no mud on the shallows beside it this season.');
    expect(lines).toContain('No grey water left in the lake for it to eat this season.');
    // With mud and grey water, neither line.
    tileAt(s, 5, 1).mud = 2;
    s.lake!.grey = 5;
    expect(lakeAt(LAKE, s, now(s), at(4, 1))).toEqual([]);
    expect(lakeAt(LAKE, s, now(s), at(5, 3))).toEqual([]);
  });

  it('is silent outside Lake Gardens', () => {
    const reach = biomeContent('willowReach');
    const s = scenario(['~ , , ,', '~ , C ,'], { content: reach });
    expect(lakeAt(reach, s, null, at(1, 0))).toEqual([]);
    expect(lakeOutlook(reach, s, null)).toBeNull();
  });
});

describe('the bloom ahead', () => {
  it('in summer a lake holding too much grey water will bloom: the panel, the banner, the marks', () => {
    const s = place(start(), 'lakeFishery', 7, 1, LAKE);
    s.lake!.grey = 9;
    const forecast = now(s);
    const o = lakeOutlook(LAKE, s, forecast)!;
    expect(o).toMatchObject({ grey: 9, above: 4, blooms: true });
    expect(o.after).toBeGreaterThan(4);
    expect(bloomSummary(o)).toBe(`the lake will hold ${o.after} grey water: it will bloom`);
    const marks = mapMarks(LAKE, s, forecast).filter((m) => m.kind === 'bloom');
    expect(marks.map((m) => hexKey(m.at))).toEqual([hexKey(at(7, 1))]);
    expect(marks[0]!.text).toMatch(/the Lake Fishery will make 1 less food/);
    expect(reachSummary(marks)).toBe('1 fisheries make less');
  });

  it('a clean lake stays clear; outside summer the banner says nothing of it', () => {
    const s = start();
    s.lake!.grey = 2;
    const o = lakeOutlook(LAKE, s, now(s))!;
    expect(o.blooms).toBe(false);
    expect(bloomSummary(o)).toBe(`the lake will hold ${o.after}: it stays clear`);
    const autumn = start('autumn');
    autumn.lake!.grey = 9;
    expect(lakeOutlook(LAKE, autumn, now(autumn))!.blooms).toBeNull();
    expect(bloomSummary(lakeOutlook(LAKE, autumn, now(autumn)))).toBe('');
  });

  it('counts silted shallows and the mud on them', () => {
    const s = start();
    tileAt(s, 5, 0).mud = 4;
    tileAt(s, 5, 0).silted = true;
    tileAt(s, 5, 1).mud = 1;
    expect(lakeOutlook(LAKE, s, now(s))).toMatchObject({ silted: 1, mud: 5 });
  });
});

describe('the lake in the season report', () => {
  it('sums up the grey water, the bloom, the mud settled and lifted', () => {
    let s = place(start(), 'mudBoat', 4, 1, LAKE);
    tileAt(s, 5, 1).mud = 3;
    s.lake!.grey = 9;
    s = endSeason(s, LAKE);
    const lines = lakeNotes(LAKE, s.lastReport!.lake!);
    expect(lines[0]).toMatch(/grey water reached the lake; fisheries ate 0, it cleaned 1 itself/);
    expect(lines).toContain(
      'It bloomed: lake fisheries made 1 less food, and its grey water costs 2 times the Harmony.',
    );
    expect(lines).toContain('A mud boat lifted 3 mud onto the land as compost.');
    expect(uidAt(s, 4, 1)).toBeDefined();
  });
});

describe('the lake on the map', () => {
  it('draws the mud, the silted shallows, the murk of its grey water and the bloom', () => {
    const s = start();
    tileAt(s, 5, 0).mud = 2;
    tileAt(s, 5, 1).mud = 4;
    tileAt(s, 5, 1).silted = true;
    s.lake!.grey = 3;
    const look = lakeLook(LAKE, s)!;
    expect(look.mud).toEqual([{ at: at(5, 0), mud: 2 }]);
    expect(look.silted).toEqual([at(5, 1)]);
    expect(look.water).toHaveLength(
      Object.values(s.map.tiles).filter((t) => t.type === 'shallows' || t.type === 'deep').length,
    );
    expect(look.murk).toBeCloseTo(3 / 5);
    expect(look).toMatchObject({ bloom: false, low: false });
    // A bloom last season: green, not murky; the signature changes, so the map redraws.
    const bloomed = {
      ...s,
      lastReport: { ...s.lastReport!, lake: { ...bloomReport(), bloom: true } },
    };
    expect(lakeLook(LAKE, bloomed)).toMatchObject({ bloom: true, murk: 0 });
    expect(lakeLook(LAKE, bloomed)!.signature).not.toBe(look.signature);
    expect(lakeLook(LAKE, start('winter'))!.low).toBe(true);
    expect(lakeLook(biomeContent('willowReach'), scenario(['~ , C'], {}))).toBeNull();
  });

  it('low water shows along the sides of the shallows that touch land', () => {
    const s = start();
    // (5, 2) has land to its north-west, west and south-west; (6, 2) is all water round.
    expect(shoreSides(s, at(5, 2))).toEqual([2, 3, 4]);
    expect(shoreSides(s, at(6, 2))).toEqual([]);
  });

  it('the season plays the bloom across the lake, the low water, and the mud settling', () => {
    let s = place(start(), 'lakeFishery', 7, 1, LAKE);
    s = place(s, 'stiltHouse', 5, 1, LAKE);
    s.lake!.grey = 9;
    s = endSeason(s, LAKE);
    const tl = buildTimeline(LAKE, s, s.lastReport!);
    const water = Object.values(s.map.tiles).filter(
      (t) => t.type === 'shallows' || t.type === 'deep',
    );
    expect(tl.eventFx.filter((f) => f.kind === 'bloomed')).toHaveLength(water.length);
    expect(tl.pops.some((p) => p.text === 'algae bloom' && hexKey(p.at) === hexKey(at(7, 1)))).toBe(
      true,
    );
    // A clean summer: the lake stays clear.
    const clean = endSeason(place(start(), 'wastewaterFishery', 5, 3, LAKE), LAKE);
    expect(buildTimeline(LAKE, clean, clean.lastReport!).pops.map((p) => p.text)).toContain(
      'the lake stays clear',
    );
    // Winter's low water falls back on the shallows; mud settles where the house's water came in.
    let w = place(start('winter'), 'stiltHouse', 5, 1, LAKE);
    w = endSeason(w, LAKE);
    const wl = buildTimeline(LAKE, w, w.lastReport!);
    expect(wl.eventFx.filter((f) => f.kind === 'lowWater').length).toBe(
      Object.values(w.map.tiles).filter((t) => t.type === 'shallows').length,
    );
    const settled = Object.keys(w.lastReport!.lake!.settled);
    for (const key of settled)
      expect(wl.pops.some((p) => hexKey(p.at) === key && /mud$/.test(p.text))).toBe(true);
  });

  it("the lake's air: fish on the open water, mist in the cool seasons, leaves for snow", () => {
    const summer = ambientFor(LAKE, start());
    expect(summer.fish.length).toBeGreaterThan(0);
    expect(summer.mist).toEqual([]);
    expect(ambientFor(LAKE, start('autumn')).mist.length).toBeGreaterThan(0);
    const winter = ambientFor(LAKE, start('winter'));
    expect(winter.falling).toBe('leaf');
    expect(winter.mist.length).toBeGreaterThan(0);
  });

  it('a winter without snow: shared art keeps its summer look, the lake its own winter', () => {
    expect(snowless('lake')).toBe(true);
    expect(snowless('valley')).toBe(false);
    expect(artSeason('cottage', 'winter', 'lake')).toBe('summer');
    expect(artSeason('chinampa', 'winter', 'lake')).toBe('winter');
    expect(artSeason('shallows', 'winter', 'lake')).toBe('winter');
    expect(artSeason('cottage', 'winter', 'valley')).toBe('winter');
  });
});

function bloomReport() {
  return { greyIn: 0, eaten: 0, cleaned: 0, grey: 6, settled: {}, dredged: {}, bloom: false };
}
