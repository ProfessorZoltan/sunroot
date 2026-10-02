/**
 * The Windswept Coast (Milestone 11, proposals/windswept-coast.md): its map and
 * content. Its own rules (the king tide's salt, fog, gales) are tested with them.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import { createRun, hexKey, hexNeighbors, type RunState } from '../src/sim';
import { endSeason } from './helpers';

const COAST = biomeContent('windsweptCoast');
const seeds = ['a', 'b', 'coast-1', 'coast-2', 'coast-3'];

describe('the coast map', () => {
  it.each(seeds)('seed %s: sea to the east, a stream to it, the shore, the camp inland', (seed) => {
    const s = createRun(COAST, { seed, water: true });
    const tiles = Object.values(s.map.tiles);
    const count = (type: string) => tiles.filter((t) => t.type === type).length;
    // The sea fills the east columns, and touches the east edge on every row.
    expect(count('sea')).toBeGreaterThanOrEqual(2 * s.map.height);
    for (let r = 0; r < s.map.height; r++) {
      const row = tiles.filter((t) => t.r === r).sort((a, b) => a.q - b.q);
      expect(row.at(-1)!.type).toBe('sea');
    }
    // A stream from the west edge that reaches the sea (or its estuary).
    expect(s.map.river.length).toBeGreaterThan(5);
    const mouth = s.map.tiles[s.map.river.at(-1)!]!;
    expect(
      hexNeighbors(mouth).some((n) =>
        ['sea', 'mudflat'].includes(s.map.tiles[hexKey(n)]?.type ?? ''),
      ),
    ).toBe(true);
    // The shore: mudflat or dune beside the sea; the king tide reaches mudflat and saltmarsh only.
    expect(count('mudflat') + count('dune')).toBeGreaterThan(3);
    for (const k of s.map.floodOrder)
      expect(['mudflat', 'saltmarsh']).toContain(s.map.tiles[k]!.type);
    // Starts at the coast's Harmony, like the Reach.
    expect(s.harmony).toBe(COAST.map.startingHarmony);
  });

  it('the same seed always makes the same coast', () => {
    const a = createRun(COAST, { seed: 'same' });
    const b = createRun(COAST, { seed: 'same' });
    expect(a.map).toEqual(b.map);
  });
});

describe('the coast content', () => {
  it("has the proposal's starters: croft, tide turbine, beachcombing yard, cottage", () => {
    const starters = COAST.buildings.filter((b) => b.starter).map((b) => b.id);
    for (const id of ['croft', 'tideTurbine', 'beachcombingYard', 'cottage', 'workshop'])
      expect(starters).toContain(id);
    // Not the Reach's own.
    for (const id of ['floodplainFarm', 'weir', 'levee', 'orchard', 'greatWaterGarden'])
      expect(COAST.byId[id]).toBeUndefined();
    expect(COAST.calendar).toEqual(['flood', 'fog', 'storm', 'freeze']);
    expect(COAST.events.flood!.name).toBe('King tide');
  });

  it('a whole year plays', () => {
    let s: RunState = createRun(COAST, { seed: 'year', water: true });
    for (let i = 0; i < 4; i++) s = endSeason(s, COAST);
    expect(s.status).toBe('active');
    expect(s.year).toBe(2);
  });
});
