/**
 * The Highland (Milestone 12, HL2; proposals/highland.md): its glen, its
 * content and its own rules: the snowmelt on the glen floor, gales on the
 * tops, biochar that improves a farm's land for good, bothies that heat
 * themselves, and placement by height.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import {
  createRun,
  hexDistance,
  hexKey,
  hexNeighbors,
  type RunState,
  type Season,
} from '../src/sim';
import { stormExposed } from '../src/sim/queries';
import { endSeason, place, rejects, scenario, uidAt, at } from './helpers';

const HIGH = biomeContent('highland');
const seeds = ['a', 'b', 'glen-1', 'glen-2', 'glen-3'];

describe('the glen', () => {
  it('rises from the stream to the tops, heights 0 to 3; the stream falls as it goes', () => {
    for (const seed of seeds) {
      const s = createRun(HIGH, { seed, water: true });
      const tiles = Object.values(s.map.tiles);
      for (const t of tiles) expect(t.height ?? 0).toBeLessThanOrEqual(3);
      const stream = s.map.river.map((k) => s.map.tiles[k]!);
      for (let i = 1; i < stream.length; i++)
        expect(stream[i]!.height ?? 0).toBeLessThanOrEqual(stream[i - 1]!.height ?? 0);
      expect(stream[0]!.height).toBe(HIGH.map.kind === 'highland' ? HIGH.map.streamTopHeight : 0);
      expect(stream.at(-1)!.height ?? 0).toBe(0);
      // Crags only on the tops; bogs and old mines on the shoulders.
      for (const t of tiles) {
        if (t.type === 'crag') expect(t.height).toBe(3);
        if (t.type === 'bog' || t.type === 'ruin') expect([1, 2]).toContain(t.height);
      }
      expect(tiles.filter((t) => t.type === 'ruin')).toHaveLength(
        HIGH.map.kind === 'highland' ? HIGH.map.ruins : 0,
      );
    }
  });

  it('the camp stands low; the snowmelt reaches only the glen floor beside the stream', () => {
    for (const seed of seeds) {
      const s = createRun(HIGH, { seed, water: true });
      const camp = s.buildings.b0!.at;
      expect(s.map.tiles[hexKey(camp)]!.height ?? 0).toBeLessThanOrEqual(1);
      expect(s.map.floodOrder).not.toContain(hexKey(camp));
      for (const k of s.map.floodOrder) {
        const t = s.map.tiles[k]!;
        expect(t.height ?? 0).toBe(0);
        expect(hexNeighbors(t).some((n) => s.map.tiles[hexKey(n)]?.type === 'river')).toBe(true);
      }
    }
  });

  it('the same seed always makes the same glen', () => {
    const a = createRun(HIGH, { seed: 'same' });
    const b = createRun(HIGH, { seed: 'same' });
    expect(a.map).toEqual(b.map);
  });
});

describe('the Highland content', () => {
  it("has the proposal's starters and none of the Reach's floodplain", () => {
    const starters = HIGH.buildings.filter((b) => b.starter).map((b) => b.id);
    for (const id of ['terraceFarm', 'glenFarm', 'hillTurbine', 'bothy', 'workshop'])
      expect(starters).toContain(id);
    for (const id of ['floodplainFarm', 'orchard', 'weir', 'levee', 'riverWheel', 'hedgerow'])
      expect(HIGH.byId[id]).toBeUndefined();
    expect(HIGH.calendar).toEqual(['flood', 'lowRiver', 'storm', 'freeze']);
    expect(HIGH.events.flood!.name).toBe('Snowmelt');
    // Heat needs a building, every run.
    expect(HIGH.rules.localHeat.enabled).toBe(true);
    expect(HIGH.land).toBe('glen');
  });

  it('a whole year plays', () => {
    let s: RunState = createRun(HIGH, { seed: 'year', water: true });
    for (let i = 0; i < 4; i++) s = endSeason(s, HIGH);
    expect(s.status).toBe('active');
    expect(s.year).toBe(2);
  });
});

describe('the Highland rules', () => {
  // The stream down column 2 from height 2 to 0; the land rises east and west of it.
  const GLEN = [
    'm , ~ , m A',
    'm , ~ , m A',
    'm , ~ , m A',
    'm C ~ , m b',
    'm , ~ , m ,',
    'm , ~ , m ,',
  ];
  const HEIGHTS = [
    '3 2 2 2 3 3',
    '3 2 2 2 3 3',
    '2 1 1 1 2 3',
    '2 1 1 1 2 2',
    '1 0 0 0 1 1',
    '1 0 0 0 1 1',
  ];
  const start = (season: Season = 'spring') =>
    scenario(GLEN, {
      content: HIGH,
      season,
      heights: HEIGHTS,
      citizens: 12,
      stores: { food: 80, biomass: 20 },
      run: { water: true },
    });
  const end = (s: RunState) => endSeason({ ...s, stores: { ...s.stores, food: 80 } }, HIGH);

  it('placement by height: terraces on the slopes, glen farms on the floor, shielings up high', () => {
    const s = start();
    const why = (id: string, c: number, r: number) =>
      rejects(s, { type: 'place', building: id, at: at(c, r) }, HIGH);
    expect(why('terraceFarm', 3, 5)).toBe('Terrace Farm goes at heights 1 to 2');
    expect(why('glenFarm', 3, 2)).toBe('Glen Farm goes at height 0');
    expect(why('shieling', 4, 4)).toBe('Shieling goes at heights 2 to 3');
    expect(why('hillTurbine', 3, 5)).toBe('Hill Turbine goes at heights 1 to 3');
    expect(why('lookout', 4, 0)).toBe("Lookout can't be built on meadow");
    // Each where it belongs.
    let t = place(s, 'terraceFarm', 3, 3, HIGH);
    t = place(t, 'glenFarm', 3, 5, HIGH);
    t = place(t, 'shieling', 4, 0, HIGH);
    t = place(t, 'hillTurbine', 3, 1, HIGH);
    t = place(t, 'lookout', 5, 0, HIGH);
    // With the camp and its channel, which runs only level or downhill: 2 tiles, down to the floor.
    expect(Object.keys(t.buildings)).toHaveLength(8);
  });

  it('a glen farm drinks from the stream beside it, with no channel', () => {
    let s = place(start('summer'), 'glenFarm', 3, 4, HIGH);
    s = end(s);
    const use = s.lastReport!.water!.uses[uidAt(s, 3, 4)]!;
    expect(use.from).toBe('river');
    expect(use.short).toBe(false);
    // A terrace farm beside the same stream still needs a channel.
    expect(HIGH.byId.terraceFarm!.water!.besideRiver).toBe(false);
  });

  it('the snowmelt floods the glen floor: a glen farm stands it, a workshop does not; no silt', () => {
    let s = place(start('spring'), 'glenFarm', 3, 4, HIGH);
    s = place(s, 'workshop', 3, 5, HIGH);
    s = end(s);
    expect(s.lastReport!.flooded).toEqual(
      expect.arrayContaining([hexKey(at(3, 4)), hexKey(at(3, 5))]),
    );
    expect(s.lastReport!.damaged).toEqual([uidAt(s, 3, 5)]);
    expect(s.lastReport!.silted).toEqual([]);
    // Nothing higher floods.
    for (const k of s.lastReport!.flooded) expect(s.map.tiles[k]!.height ?? 0).toBe(0);
  });

  it('gales reach what stands on a crag or at height 3; a lookout shelters what is near it', () => {
    const exposed = (s: RunState, c: number, r: number) =>
      stormExposed(HIGH, s, s.buildings[uidAt(s, c, r)]!);
    // A shieling at height 3 and a wind spire on a crag are exposed; a terrace low down is not.
    let s = place(start('autumn'), 'shieling', 0, 0, HIGH);
    s = place(s, 'windSpire', 5, 0, HIGH);
    s = place(s, 'terraceFarm', 3, 3, HIGH);
    expect(exposed(s, 0, 0)).toBe(true);
    expect(exposed(s, 5, 0)).toBe(true);
    expect(exposed(s, 3, 3)).toBe(false);
    // A lookout on a crag shelters what stands within 2 of it.
    s = place(s, 'lookout', 5, 1, HIGH);
    expect(hexDistance(at(5, 1), at(5, 0))).toBeLessThanOrEqual(2);
    expect(exposed(s, 5, 0)).toBe(false);
    expect(hexDistance(at(5, 1), at(0, 0))).toBeGreaterThan(2);
    expect(exposed(s, 0, 0)).toBe(true);
  });

  it('a biochar kiln that runs chars a farm beside it: +1 food there for good', () => {
    let s = place(start('summer'), 'glenFarm', 3, 5, HIGH);
    s = place(s, 'biocharKiln', 3, 4, HIGH);
    const farmTile = () => s.map.tiles[hexKey(at(3, 5))]!;
    s = end(s);
    expect(farmTile().charred).toBe(true);
    expect(s.lastReport!.math[uidAt(s, 3, 4)]).toContain(
      "charred the Glen Farm's land: +1 food there for good",
    );
    // From the next season on, the farm makes 1 more.
    s = end(s);
    expect(s.lastReport!.math[uidAt(s, 3, 5)]!.join(' ')).toContain('+1 biochar');
    // It stays charred with the kiln gone.
    s = {
      ...s,
      buildings: Object.fromEntries(
        Object.entries(s.buildings).filter(([, b]) => b.type !== 'biocharKiln'),
      ),
    };
    expect(farmTile().charred).toBe(true);
  });

  it('a bothy heats itself, up high in winter too', () => {
    // At height 3, away from the camp: it needs 2 heat on a winter night, and its stove gives 2.
    let s = place(start('winter'), 'bothy', 4, 0, HIGH);
    s = end(s);
    expect(s.lastReport!.blackouts).not.toContain(uidAt(s, 4, 0));
    expect(s.lastReport!.energy.night.heat.bySource.bothy).toBeGreaterThanOrEqual(2);
  });

  it("a bothy beside the camp keeps its stove's heat for itself", () => {
    // The camp at (1,3) comes first by priority, but the bothy's own stove heats the bothy.
    let s = place(start('winter'), 'bothy', 0, 3, HIGH);
    s = end(s);
    expect(s.lastReport!.cold).not.toContain(uidAt(s, 0, 3));
    expect(s.lastReport!.math[uidAt(s, 0, 3)]!.join(' ')).not.toContain('cold');
  });
});
