/** Demolishing a building (asked for in playtesting; see DECISIONS.md). */
import { describe, expect, it } from 'vitest';
import { BIOMES, biomeContent } from '../src/content';
import { applyCommand, createRun, demolishCheck, type TileType } from '../src/sim';
import {
  act,
  at,
  content,
  endSeason,
  place,
  rejects,
  scenario,
  tileTypeAt,
  uidAt,
} from './helpers';

const LAND = [
  '^ ^ ^ , ~ , , , ^ ^',
  ' ^ ^ , , ~ m f , ^ ^',
  '^ , C , ~ W , , ^ ^',
  ' ^ , , R ~ , , , , ^',
];

describe('demolishing', () => {
  it('removes the building, leaves half its cost as clutter, and flat land turns barren', () => {
    let s = scenario(LAND);
    s = place(s, 'cottage', 5, 2); // on woodland
    s = endSeason(s);
    const uid = uidAt(s, 5, 2);
    const before = s.stores.clutter;
    s = act(s, { type: 'demolish', uid });
    expect(s.buildings[uid]).toBeUndefined();
    expect(s.priority).not.toContain(uid);
    expect(s.stores.clutter).toBe(before + 2); // a cottage costs 4
    expect(tileTypeAt(s, 5, 2)).toBe('barren');
    // The tile can be built on again at once.
    expect(uidAt(place(s, 'solarCanopy', 5, 2), 5, 2)).toBeTruthy();
  });

  it('hills and floodplain keep their type', () => {
    let s = scenario(LAND);
    s = place(s, 'solarCanopy', 8, 2); // hill
    s = place(s, 'floodplainFarm', 6, 1); // floodplain
    s = act(s, { type: 'demolish', uid: uidAt(s, 8, 2) });
    s = act(s, { type: 'demolish', uid: uidAt(s, 6, 1) });
    expect(tileTypeAt(s, 8, 2)).toBe('hill');
    expect(tileTypeAt(s, 6, 1)).toBe('floodplain');
  });

  it('takes 2 day energy this season, as demand that can cause a shortfall', () => {
    let s = scenario(LAND, { season: 'summer' });
    s = place(s, 'cottage', 5, 2);
    const plain = endSeason(s).lastReport!.energy.day;
    s = act(s, { type: 'demolish', uid: uidAt(s, 5, 2) });
    const day = endSeason(s).lastReport!.energy.day;
    expect(day.demandBy.demolition).toBe(2);
    expect(day.demand).toBe(plain.demand + 2);
  });

  it('turns rubble into salvage while a salvage yard stands', () => {
    let s = scenario(LAND);
    s = place(s, 'salvageYard', 3, 3);
    s = place(s, 'cottage', 5, 2);
    const check = demolishCheck(content, s, uidAt(s, 5, 2));
    expect(check).toMatchObject({ ok: true, rubble: 2, into: 'salvage', tile: 'barren' });
    const salvage = s.stores.salvage;
    s = act(s, { type: 'demolish', uid: uidAt(s, 5, 2) });
    expect(s.stores.salvage).toBe(salvage + 2);
    // The yard itself: its rubble is clutter (no other yard), and the ruin stays a ruin.
    const yard = demolishCheck(content, s, uidAt(s, 3, 3));
    expect(yard).toMatchObject({ into: 'clutter', rubble: 1, tile: 'ruin' });
  });

  it("a weir's reservoir becomes river again", () => {
    let s = scenario(LAND, { stores: { materials: 50 } });
    s = place(s, 'weir', 4, 3);
    expect(Object.values(s.map.tiles).some((t) => t.type === 'reservoir')).toBe(true);
    s = act(s, { type: 'demolish', uid: uidAt(s, 4, 3) });
    expect(Object.values(s.map.tiles).some((t) => t.type === 'reservoir')).toBe(false);
    expect(tileTypeAt(s, 4, 3)).toBe('river');
  });

  it("can't demolish the Founders' Camp; undo restores the building", () => {
    let s = scenario(LAND);
    expect(rejects(s, { type: 'demolish', uid: 'b0' })).toMatch(/Founders' Camp/);
    s = place(s, 'cottage', 5, 2);
    const uid = uidAt(s, 5, 2);
    const demolished = act(s, { type: 'demolish', uid });
    const undone = act(demolished, { type: 'undo' });
    expect(undone.buildings[uid]?.type).toBe('cottage');
    expect(tileTypeAt(undone, 5, 2)).toBe('woodland');
    expect(applyCommand(content, demolished, { type: 'demolish', uid }).ok).toBe(false);
  });

  it('breaks a loop it was part of', () => {
    const MAP = [
      '^ ^ ^ , ~ , , , ^ ^',
      ' ^ ^ , , ~ f f f ^ ^',
      '^ , C , ~ f f f , ^',
      ' ^ , , , ~ f f f , ^',
    ];
    let s = scenario(MAP, { season: 'summer', stores: { scraps: 3 } });
    s = place(s, 'floodplainFarm', 5, 3);
    s = place(s, 'composter', 6, 3);
    s = endSeason(s);
    expect(s.loops).toHaveLength(1);
    s = act(s, { type: 'demolish', uid: uidAt(s, 6, 3) });
    expect(s.loops).toEqual([]);
  });
});

describe("demolishing keeps a biome's own ground", () => {
  const COAST = biomeContent('windsweptCoast');
  const HIGH = biomeContent('highland');

  it('the coast: mudflat, saltmarsh, dune and sea stay as they are', () => {
    // Sea, mudflat, saltmarsh and dune in a row, the camp inland.
    let s = scenario(['= _ " : , ,', '= _ " : C ,', '= _ " : , ,'], {
      content: COAST,
      stores: { materials: 200 },
    });
    s = place(s, 'oysterReef', 1, 0, COAST);
    s = place(s, 'croft', 2, 0, COAST);
    s = place(s, 'duneGrass', 3, 2, COAST);
    s = place(s, 'kelpFarm', 0, 0, COAST);
    for (const [col, row, type] of [
      [1, 0, 'mudflat'],
      [2, 0, 'saltmarsh'],
      [3, 2, 'dune'],
      [0, 0, 'sea'],
    ] as const) {
      s = act(s, { type: 'demolish', uid: uidAt(s, col, row) }, COAST);
      expect(tileTypeAt(s, col, row), type).toBe(type);
    }
  });

  it('the Highland: crag and bog stay as they are', () => {
    let s = scenario(['A b , ,', 'A b C ,'], { content: HIGH, stores: { materials: 200 } });
    s = place(s, 'lookout', 0, 0, HIGH);
    // A rewetted bog is a bog brought back (an evolution), not placed: put it straight on the map.
    const uid = `b${s.nextUid++}`;
    s.buildings[uid] = { uid, type: 'rewettedBog', at: at(1, 0), builtTurn: s.turn };
    s.priority.push(uid);
    s = act(s, { type: 'demolish', uid: uidAt(s, 0, 0) }, HIGH);
    s = act(s, { type: 'demolish', uid: uidAt(s, 1, 0) }, HIGH);
    expect(tileTypeAt(s, 0, 0)).toBe('crag');
    expect(tileTypeAt(s, 1, 0)).toBe('bog');
  });

  it('in every biome, only land on its soil ladder (at or above where demolition leaves it) changes', () => {
    for (const id of Object.keys(BIOMES)) {
      const c = biomeContent(id);
      const { landHealth, demolition } = c.rules;
      const floor = landHealth.indexOf(demolition.tileBecomes);
      const types = new Set<TileType>();
      for (const region of [null, ...c.regions.map((r) => r.id)])
        for (let i = 0; i < 3; i++) {
          const s = createRun(c, {
            seed: `ground-${i}`,
            water: true,
            expedition: { twist: null, request: null, region },
          });
          for (const t of Object.values(s.map.tiles)) types.add(t.type);
        }
      for (const t of types) {
        const degrades = landHealth.indexOf(t) >= floor && floor >= 0;
        if (!degrades) expect(demolition.keeps, `${id}: ${t}`).toContain(t);
      }
    }
  });
});
