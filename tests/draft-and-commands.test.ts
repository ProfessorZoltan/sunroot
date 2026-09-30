import { describe, expect, it } from 'vitest';
import { applyCommand, blueprintPool, createRun } from '../src/sim';
import { act, content, endSeason, place, rejects, scenario, uidAt } from './helpers';

const DRY = [
  '^ ^ , . ~ . , m ^ ^',
  ' ^ . , , ~ , . m W ^',
  '^ . C , ~ , . . . ^',
  ' ^ . , , ~ , . . . ^',
];

describe('the draft', () => {
  it('offers 3 different blueprints that are not yet unlocked', () => {
    const s = createRun(content, { seed: 'draft' });
    expect(s.draft.offer).toHaveLength(3);
    expect(new Set(s.draft.offer).size).toBe(3);
    for (const card of s.draft.offer) {
      const def = content.byId[card]!;
      expect(def.starter).toBe(false);
      expect(def.draftable).toBe(true);
    }
  });

  it('unlocks the 5 starred buildings and the Solar Canopy at the start; the rest come through the draft', () => {
    const s = createRun(content, { seed: 'draft' });
    expect(s.unlocked.sort()).toEqual(
      ['composter', 'cottage', 'floodplainFarm', 'salvageYard', 'solarCanopy', 'workshop'].sort(),
    );
    // The design's 17, plus the Heat Pump and Solar Thermal Collector (docs/proposals/heat-routes.md).
    const draftable = content.buildings.filter((b) => b.draftable && !b.starter).map((b) => b.id);
    expect(draftable).toHaveLength(17 + 2);
    expect(draftable).toEqual(expect.arrayContaining(['heatPump', 'solarThermalCollector']));
  });

  it('uses fixed offers in the guided first year, then random ones', () => {
    let s = createRun(content, { seed: 'guided', guided: true });
    expect(s.draft.offer).toEqual(content.guidedYear[0]);
    for (let i = 0; i < 4; i++) s = endSeason(s);
    expect(s.year).toBe(2);
    expect(s.draft.offer).toHaveLength(3);
  });

  it('gates the Pumped Reservoir to era 3', () => {
    const s = scenario(DRY, { unlockAll: false });
    expect(blueprintPool(content, s)).not.toContain('pumpedReservoir');
    const late = scenario(DRY, { unlockAll: false, year: 7 });
    expect(late.era).toBe(3);
    expect(blueprintPool(content, late)).toContain('pumpedReservoir');
  });

  it('a pick unlocks the blueprint; one pick per season, required before the season ends', () => {
    let s = createRun(content, { seed: 'pick' });
    const [card, other] = s.draft.offer;
    expect(rejects(s, { type: 'endSeason' })).toMatch(/pick a draft card/);
    expect(rejects(s, { type: 'pickCard', card: 'weirdCard' })).toMatch(/not on offer/);
    s = act(s, { type: 'pickCard', card: card! });
    expect(s.unlocked).toContain(card);
    expect(rejects(s, { type: 'pickCard', card: other! })).toMatch(/already picked/);
  });

  it('knowledge buys rerolls (2) and a fourth card (3)', () => {
    let s = createRun(content, { seed: 'knowledge' });
    expect(rejects(s, { type: 'rerollDraft' })).toMatch(/needs 2 knowledge/);
    s.stores.knowledge = 5;
    s = act(s, { type: 'rerollDraft' });
    expect(s.stores.knowledge).toBe(3);
    expect(s.draft.offer).toHaveLength(3);
    s = act(s, { type: 'buyExtraCard' });
    expect(s.stores.knowledge).toBe(0);
    expect(s.draft.offer).toHaveLength(4);
    expect(new Set(s.draft.offer).size).toBe(4);
    s.stores.knowledge = 3;
    expect(rejects(s, { type: 'buyExtraCard' })).toMatch(/already bought/);
  });

  it('a powered Seedbank Library makes 1 knowledge a season', () => {
    let s = scenario(DRY);
    s = place(s, 'seedbankLibrary', 6, 2);
    s = endSeason(s);
    expect(s.stores.knowledge).toBe(1);
  });
});

describe('placing buildings', () => {
  it('needs the blueprint, the materials and a legal site', () => {
    let s = createRun(content, { seed: 'place' });
    const tile = Object.values(s.map.tiles).find((t) => t.type === 'barren' || t.type === 'scrub')!;
    expect(rejects(s, { type: 'place', building: 'greenhouse', at: tile })).toMatch(/not unlocked/);
    expect(rejects(s, { type: 'place', building: 'salvageYard', at: tile })).toMatch(
      /can't be built/,
    );
    expect(rejects(s, { type: 'place', building: 'cottage', at: s.buildings.b0!.at })).toMatch(
      /already has a building/,
    );
    s.stores.materials = 3;
    expect(rejects(s, { type: 'place', building: 'cottage', at: tile })).toMatch(/costs 4/);
    s.stores.materials = 4;
    s = act(s, { type: 'place', building: 'cottage', at: tile });
    expect(s.stores.materials).toBe(0);
  });

  it('keeps homes at the top of the priority list', () => {
    let s = scenario(DRY);
    s = place(s, 'workshop', 6, 2);
    s = place(s, 'cottage', 6, 3);
    expect(s.priority).toEqual(['b0', uidAt(s, 6, 3), uidAt(s, 6, 2)]);
    expect(rejects(s, { type: 'setPriority', order: ['b0'] })).toMatch(/every building once/);
  });
});

describe('commands', () => {
  it('never mutate the state they are given', () => {
    const s = createRun(content, { seed: 'pure' });
    const before = JSON.stringify(s);
    const tile = Object.values(s.map.tiles).find((t) => t.type === 'scrub')!;
    applyCommand(content, s, { type: 'pickCard', card: s.draft.offer[0]! });
    applyCommand(content, s, { type: 'place', building: 'cottage', at: tile });
    const picked = act(s, { type: 'pickCard', card: s.draft.offer[0]! });
    applyCommand(content, picked, { type: 'endSeason' });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('undo is free until the season ends', () => {
    let s = scenario(DRY);
    const start = JSON.stringify({ ...s, seasonStart: null });
    s = place(s, 'cottage', 6, 2);
    s = place(s, 'workshop', 6, 3);
    s = act(s, { type: 'undo' });
    expect(Object.keys(s.buildings)).toHaveLength(2);
    expect(s.stores.materials).toBe(200 - 4);
    s = act(s, { type: 'undo' });
    expect(JSON.stringify({ ...s, seasonStart: null })).toBe(start);
    expect(rejects(s, { type: 'undo' })).toMatch(/nothing to undo/);
    s = place(s, 'cottage', 6, 2);
    s = endSeason(s);
    expect(rejects(s, { type: 'undo' })).toMatch(/nothing to undo/);
  });

  it('undoing a reroll restores the knowledge and the same cards come back', () => {
    let s = createRun(content, { seed: 'reroll' });
    s.stores.knowledge = 4;
    s.seasonStart!.stores.knowledge = 4;
    const first = act(s, { type: 'rerollDraft' });
    s = act(first, { type: 'undo' });
    expect(s.stores.knowledge).toBe(4);
    expect(act(s, { type: 'rerollDraft' }).draft.offer).toEqual(first.draft.offer);
  });

  it('are rejected after the run ends', () => {
    const s = scenario(DRY, { year: 12, season: 'winter' });
    const done = endSeason(s);
    expect(done.status).toBe('complete');
    expect(rejects(done, { type: 'undo' })).toMatch(/ended/);
  });
});
