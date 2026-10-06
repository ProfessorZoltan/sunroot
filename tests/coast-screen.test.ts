/**
 * The Windswept Coast on screen (B4, proposals/windswept-coast.md): every
 * building has a drawing, the tide covers the mudflat by night, the king
 * tide's salt is marked on the map, and the interface names the coast's own
 * things (the king tide, sea walls, the coast).
 */
import { describe, expect, it } from 'vitest';
import { BIOMES, biomeContent } from '../src/content';
import { mapMarks, reachSummary } from '../src/game/marks';
import { GameStore } from '../src/game/store';
import { buildTimeline } from '../src/game/timeline';
import { BUILDING_ART } from '../src/render/buildingArt';
import { forecastSeason, hexKey, type RunState } from '../src/sim';
import { endSeason, place, scenario, uidAt } from './helpers';

const COAST = biomeContent('windsweptCoast');

// The shore on the east: saltmarsh, mudflat, then sea.
const SHORE = [
  '. , m " _ = = =',
  '. , m " _ = = =',
  '. C , : : = = =',
  '. , , ^ ^ = = =',
  '. , m " _ = = =',
  '. , , : : = = =',
];
const start = (season: 'spring' | 'summer' = 'spring') =>
  scenario(SHORE, { content: COAST, season, citizens: 10, stores: { food: 40 } });
const end = (s: RunState) => endSeason({ ...s, stores: { ...s.stores, food: 40 } }, COAST);

describe('drawn in code until hand-made art comes', () => {
  it('every building of every biome has a drawing', () => {
    for (const id of Object.keys(BIOMES))
      for (const def of biomeContent(id).buildings)
        expect(BUILDING_ART[def.id], `${id}: ${def.id}`).toBeDefined();
  }, 30_000);
});

describe('the tide', () => {
  it("rises over the coast's mudflat as a season plays out; the Reach has none", () => {
    const s = end(start());
    const tide = buildTimeline(COAST, s, s.lastReport!).tide.map(hexKey).sort();
    const mudflat = Object.values(s.map.tiles)
      .filter((t) => t.type === 'mudflat')
      .map(hexKey)
      .sort();
    expect(tide).toEqual(mudflat);
    expect(tide.length).toBeGreaterThan(0);
    const reach = scenario(['. , m ~', '. C f ~']);
    const r = endSeason(reach);
    expect(buildTimeline(biomeContent('willowReach'), r, r.lastReport!).tide).toEqual([]);
  });
});

describe('the king tide on the map', () => {
  it("names itself, the salt it will leave and the sea walls' shelter", () => {
    let s = place(start(), 'croft', 3, 0, COAST);
    s = place(s, 'seaWall', 4, 4, COAST);
    const marks = mapMarks(COAST, s, forecastSeason(COAST, s).lastReport!);
    const at = (col: number, row: number) =>
      marks.filter((m) => hexKey(m.at) === hexKey(s.buildings[uidAt(s, col, row)]!.at));
    expect(at(3, 0).map((m) => m.text)).toContain(
      'The king tide will salt the Croft: half its food for 2 seasons.',
    );
    expect(marks.some((m) => m.text === 'The king tide will cover this tile.')).toBe(true);
    expect(marks.some((m) => m.text === 'A sea wall keeps this tile dry.')).toBe(true);
    expect(reachSummary(marks, 'sea walls')).toMatch(/kept dry by sea walls/);
  });

  it('marks a salted croft for 2 seasons, then the saltmarsh bonus', () => {
    let s = place(start(), 'croft', 3, 0, COAST);
    s = end(s); // the king tide
    const kinds = () =>
      mapMarks(COAST, s, null)
        .filter((m) => hexKey(m.at) === hexKey(s.buildings[uidAt(s, 3, 0)]!.at))
        .map((m) => [m.kind, m.text]);
    expect(kinds()).toEqual([['salt', 'Salted by the king tide: half its food this summer.']]);
    s = end(s);
    expect(kinds()).toEqual([['salt', 'Salted by the king tide: half its food this autumn.']]);
    s = end(s);
    expect(kinds()).toEqual([
      ['saltBonus', 'The salt has cleared: +1 food this winter on saltmarsh.'],
    ]);
  });
});

describe('placing on the coast', () => {
  it('flags the ground the king tide reaches for buildings it would damage', () => {
    const store = new GameStore(COAST, start());
    const floodable = new Set(store.state.map.floodOrder);
    store.selectBuilding('workshop');
    const risky = store.legalSites.filter((x) => x.risky).map((x) => hexKey(x.at));
    expect(risky.length).toBeGreaterThan(0);
    for (const key of risky) expect(floodable.has(key)).toBe(true);
    // Salt-tolerant crofts are never at risk.
    store.selectBuilding('croft');
    expect(store.legalSites.some((x) => x.risky)).toBe(false);
  });

  it('the interface calls it the coast', () => {
    expect(COAST.land).toBe('coast');
    expect(biomeContent('willowReach').land).toBe('valley');
  });
});
