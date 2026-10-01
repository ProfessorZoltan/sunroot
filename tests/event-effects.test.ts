/**
 * Asked for in playtesting: show which tiles and buildings each event reaches,
 * mark the effects that last for a season (silt, damage), animate the event
 * on the buildings it touches, and highlight every tile a building can go on.
 */
import { describe, expect, it } from 'vitest';
import { mapMarks, reachSummary } from '../src/game/marks';
import { GameStore } from '../src/game/store';
import { buildTimeline } from '../src/game/timeline';
import { ambientFor, AMBIENT_CAPS } from '../src/render/ambient';
import { canPlace, forecastSeason, hexKey, type RunState } from '../src/sim';
import { at, content, endSeason, place, scenario, uidAt } from './helpers';

// Floodplain along both banks of a river in column 4.
const RIVER = [
  '^ . , f ~ f , . ^ ^',
  ' ^ . , f ~ f , . . ^',
  '^ . C f ~ f f . R ^',
  ' ^ . m m ~ f , . . ^',
  '^ . . , ~ f , . m ^',
  ' ^ . . , ~ f , . . ^',
];

// A wide floodplain: farms in column 7 are 3 tiles from the river.
const FIELDS = [
  '^ . f f ~ f f f ^ ^',
  ' ^ . f f ~ f f f . ^',
  '^ . C f ~ f f f . ^',
  ' ^ . , , ~ , , . . ^',
];

const HILLS = [
  '^ ^ ^ , ~ , , , ^ ^',
  ' ^ ^ , , ~ , , , ^ ^',
  '^ , C , ~ , , , , ^',
  ' ^ , , , ~ , , , , ^',
];

const marksOf = (s: RunState) => mapMarks(content, s, forecastSeason(content, s).lastReport);
const key = (s: RunState, col: number, row: number) => hexKey(s.buildings[uidAt(s, col, row)]!.at);

describe('the coming event, marked on the map', () => {
  it('a flood: the tiles it will cover, the buildings it will damage, the tiles levees keep dry', () => {
    let s = scenario(RIVER);
    s = place(s, 'levee', 5, 1);
    s = place(s, 'floodplainFarm', 5, 2);
    s = place(s, 'workshop', 5, 5);
    s = place(s, 'floodplainFarm', 3, 4 - 1);
    const marks = marksOf(s);
    const forecast = forecastSeason(content, s).lastReport!;
    const flood = marks.filter((m) => m.kind === 'flood' || m.kind === 'floodDamage');
    expect(flood.map((m) => hexKey(m.at)).sort()).toEqual([...forecast.flooded].sort());
    expect(marks.find((m) => m.kind === 'floodDamage')?.at).toEqual(at(5, 5));
    expect(marks.filter((m) => m.kind === 'sheltered').map((m) => hexKey(m.at))).toContain(
      hexKey(at(5, 2)),
    );
    expect(marks.filter((m) => m.kind !== 'unstaffed').every((m) => m.coming)).toBe(true);
    expect(reachSummary(marks)).toMatch(
      new RegExp(
        `^${flood.length} tiles will flood · 1 buildings damaged · \\d+ kept dry by levees$`,
      ),
    );
    // What the map marks is what the season then does.
    const after = endSeason(s);
    expect(after.lastReport!.flooded.sort()).toEqual([...forecast.flooded].sort());
    expect(after.lastReport!.sheltered.sort()).toEqual([...forecast.sheltered].sort());
  });

  it('a low river: the farms far from water', () => {
    let s = scenario(FIELDS, { season: 'summer' });
    s = place(s, 'floodplainFarm', 7, 0);
    s = place(s, 'floodplainFarm', 5, 0);
    const dry = marksOf(s).filter((m) => m.kind === 'dry');
    expect(dry.map((m) => m.at)).toEqual([at(7, 0)]);
    expect(endSeason(s).lastReport!.dried).toEqual([uidAt(s, 7, 0)]);
  });

  it('storms: the buildings exposed on hills, or the Mixed Grid sheltering them', () => {
    let s = scenario(HILLS, { season: 'autumn' });
    s = place(s, 'windSpire', 9, 1);
    s = place(s, 'windSpire', 0, 3);
    const exposed = marksOf(s).filter((m) => m.kind === 'exposed');
    expect(exposed.map((m) => hexKey(m.at)).sort()).toEqual([key(s, 9, 1), key(s, 0, 3)].sort());
    expect(reachSummary(marksOf(s))).toBe('2 buildings exposed');
  });

  it('the freeze: every home that will need heat at night', () => {
    let s = scenario(RIVER, { season: 'winter' });
    s = place(s, 'cottage', 7, 3);
    const cold = marksOf(s).filter((m) => m.kind === 'cold');
    expect(cold.map((m) => hexKey(m.at)).sort()).toEqual(
      [key(s, 7, 3), hexKey(s.buildings.b0!.at)].sort(),
    );
  });
});

describe('effects that last, marked for the season', () => {
  it('silt on the farms the flood fed, and flood damage until repaired', () => {
    let s = scenario(RIVER);
    s = place(s, 'floodplainFarm', 5, 1);
    s = place(s, 'workshop', 5, 5);
    s = place(s, 'workshop', 5, 4);
    s = place(s, 'workshop', 5, 3);
    // Only the camp's foraged materials to repair them with: some stay damaged.
    s = { ...s, stores: { ...s.stores, materials: 0 } };
    s = endSeason(s);
    expect(s.season).toBe('summer');
    const marks = marksOf(s);
    const silt = marks.find((m) => m.kind === 'silt');
    expect(silt?.at).toEqual(at(5, 1));
    expect(silt?.coming).toBe(false);
    expect(silt?.text).toMatch(/Silted by the flood: \+\d+% food this summer/);
    const damaged = marks.filter((m) => m.kind === 'damaged');
    expect(damaged.length).toBe(
      Object.values(s.buildings).filter((b) => b.damage?.cause === 'flood').length,
    );
    expect(damaged.length).toBeGreaterThan(0);
    expect(damaged[0]!.text).toMatch(/idle until repaired/);
  });
});

describe('the event, animated tile by tile', () => {
  it('a flood: shelter, damage and silt, each when the water reaches it, during the event', () => {
    let s = scenario(RIVER);
    s = place(s, 'levee', 5, 1);
    s = place(s, 'floodplainFarm', 5, 4);
    s = place(s, 'workshop', 5, 5);
    s = endSeason(s);
    const tl = buildTimeline(content, s, s.lastReport!);
    const ev = tl.phases[0]!;
    const kinds = (k: string) => tl.eventFx.filter((f) => f.kind === k).map((f) => hexKey(f.at));
    expect(kinds('flooded')).toEqual([hexKey(at(5, 5))]);
    expect(kinds('silted')).toEqual([hexKey(at(5, 4))]);
    expect(kinds('sheltered').sort()).toEqual([...s.lastReport!.sheltered].sort());
    expect(tl.eventFx.every((f) => f.t >= ev.start && f.t < ev.end)).toBe(true);
    // The damage shows as the water arrives.
    const water = tl.flood.find((f) => f.key === hexKey(at(5, 5)))!;
    expect(tl.eventFx.find((f) => f.kind === 'flooded')!.t).toBe(water.t);
    expect(tl.pops.map((p) => p.text)).toEqual(expect.arrayContaining(['flooded', 'silt']));
  });

  it('a low river: dried farms and slowed river wheels, and the river to drain', () => {
    let s = scenario(FIELDS, { season: 'summer' });
    s = place(s, 'floodplainFarm', 7, 0);
    s = place(s, 'riverWheel', 3, 3);
    s = endSeason(s);
    const tl = buildTimeline(content, s, s.lastReport!);
    expect(tl.eventFx.map((f) => [f.kind, hexKey(f.at)]).sort()).toEqual(
      [
        ['dried', hexKey(at(7, 0))],
        ['slowed', hexKey(at(3, 3))],
      ].sort(),
    );
    expect(tl.river.length).toBe(s.map.river.length);
  });

  it('storms: one building struck, the others exposed; with the Mixed Grid, all calm', () => {
    let s = scenario(HILLS, { season: 'autumn' });
    s = place(s, 'windSpire', 9, 1);
    s = place(s, 'windSpire', 0, 3);
    s = endSeason(s);
    const tl = buildTimeline(content, s, s.lastReport!);
    expect(tl.eventFx.filter((f) => f.kind === 'struck')).toHaveLength(1);
    expect(tl.eventFx.filter((f) => f.kind === 'exposed')).toHaveLength(1);
    expect(tl.pops.some((p) => p.text === 'storm damage' && p.tone === 'bad')).toBe(true);
  });

  it('the freeze: frost on every home that needs heat', () => {
    let s = scenario(RIVER, { season: 'winter' });
    s = place(s, 'cottage', 7, 3);
    s = endSeason(s);
    const tl = buildTimeline(content, s, s.lastReport!);
    expect(tl.eventFx.filter((f) => f.kind === 'chilled')).toHaveLength(2);
  });
});

describe('placing a building highlights every tile it can go on', () => {
  it('exactly the legal tiles, with floodplain flagged for buildings the flood would damage', () => {
    const store = new GameStore(content, scenario(RIVER));
    expect(store.legalSites).toEqual([]);
    for (const building of ['workshop', 'floodplainFarm', 'riverWheel']) {
      store.selectBuilding(building);
      const legal = Object.values(store.state.map.tiles)
        .filter((t) => canPlace(content, store.state, building, t).ok)
        .map((t) => hexKey(t))
        .sort();
      expect(store.legalSites.map((x) => hexKey(x.at)).sort()).toEqual(legal);
      // Risky: floodplain, for a building the flood would damage.
      const tolerant = content.byId[building]!.floodTolerant;
      for (const site of store.legalSites)
        expect(site.risky).toBe(
          !tolerant && store.state.map.tiles[hexKey(site.at)]?.type === 'floodplain',
        );
      if (building === 'workshop') expect(store.legalSites.some((x) => x.risky)).toBe(true);
    }
    store.selectBuilding(null);
    expect(store.legalSites).toEqual([]);
  });
});

describe('small life about the valley', () => {
  it('butterflies over pollinator meadows and bees at apiaries in the warm seasons', () => {
    let s = scenario(RIVER, { season: 'summer' });
    s = place(s, 'pollinatorMeadow', 7, 3);
    s = place(s, 'apiary', 6, 3);
    s = place(s, 'fishPond', 3, 4);
    const a = ambientFor(content, s);
    expect(a.butterflies.length).toBeGreaterThanOrEqual(2);
    expect(a.bees).toHaveLength(3);
    expect(a.fish.length).toBeGreaterThanOrEqual(1);
    expect(a.falling).toBe('fluff');
    expect(ambientFor(content, s)).toEqual(a);
  });

  it('in winter: no butterflies, bees or fish, smoke from homes kept warm, and snow', () => {
    let s = scenario(RIVER, { season: 'winter' });
    s = place(s, 'pollinatorMeadow', 7, 3);
    s = place(s, 'apiary', 6, 3);
    s = place(s, 'cottage', 7, 1);
    const a = ambientFor(content, s);
    expect([a.butterflies, a.bees, a.fish]).toEqual([[], [], []]);
    expect(a.smoke).toHaveLength(2); // the camp and the cottage
    expect(a.falling).toBe('snow');
  });

  it('smoke from workshops that ran; citizens walk to work; never more than the caps', () => {
    let s = scenario(RIVER, { season: 'spring', stores: { clutter: 6 }, citizens: 12 });
    s = place(s, 'workshop', 7, 3);
    for (const [c, r] of [
      [1, 4],
      [2, 4],
      [1, 5],
      [2, 5],
    ] as const)
      s = place(s, 'cottage', c, r);
    s = endSeason(s);
    const a = ambientFor(content, s);
    if ((s.lastReport!.runs[uidAt(s, 7, 3)]?.runs ?? 0) > 0) expect(a.smoke.length).toBe(1);
    expect(a.walkers.length).toBeGreaterThan(0);
    expect(a.walkers.length).toBeLessThanOrEqual(AMBIENT_CAPS.walkers);
    for (const w of a.walkers) expect(w.from).not.toEqual(w.to);
  });
});
