/**
 * Combos as pictures (playtester): every combo in every biome draws as the buildings and tiles
 * its card describes, each one a real building or tile with art to draw it.
 */
import { describe, expect, it } from 'vitest';
import { BIOMES, biomeContent } from '../src/content';
import { comboPicture, picturePieces, shows } from '../src/game/comboPicture';
import { BUILDING_ART } from '../src/render/buildingArt';
import { TILE_TYPES } from '../src/sim';
import { GameStore } from '../src/game/store';
import { at, content, scenario } from './helpers';

const reach = biomeContent('willowReach');
const picture = (id: string) => comboPicture(reach, reach.comboById[id]!);
const ids = (id: string) => picture(id).slots.map((s) => s.pieces.map((p) => p.id));

describe('every combo has a picture', () => {
  for (const biome of Object.keys(BIOMES)) {
    const content = biomeContent(biome);
    it(`in ${content.name}, drawn from buildings and tiles the map can draw`, () => {
      for (const combo of content.combos) {
        const p = comboPicture(content, combo);
        expect(p.slots.length, combo.id).toBeGreaterThan(0);
        expect(p.joins.length, combo.id).toBe(p.slots.length - 1);
        for (const piece of picturePieces(p)) {
          if (piece.kind === 'tile') expect(TILE_TYPES, combo.id).toContain(piece.id);
          else {
            expect(content.byId[piece.id], `${combo.id}: ${piece.id}`).toBeDefined();
            expect(BUILDING_ART[piece.id], `${combo.id}: art for ${piece.id}`).toBeDefined();
          }
        }
      }
    });
  }
});

describe('pictures read as their cards do', () => {
  it('an adjacency: the building, next to any of its neighbours', () => {
    expect(ids('busyBees')).toEqual([
      ['apiary'],
      ['floodplainFarm', 'orchard', 'agrivoltaicField'],
    ]);
    expect(picture('busyBees').joins).toEqual(['next']);
    // Tiles too: a cottage next to meadow or woodland.
    const green = picture('greenDoorstep');
    expect(green.slots[1]!.pieces.map((p) => [p.kind, p.name])).toEqual([
      ['tile', 'meadow'],
      ['tile', 'woodland'],
    ]);
  });

  it('a chain: each link in turn, closing back on the first', () => {
    const p = picture('bathLoop');
    expect(ids('bathLoop')).toEqual([['kiln', 'heatWell'], ['bathhouse'], ['reedBed']]);
    expect(p.joins).toEqual(['then', 'then']);
    expect(p.loop).toBe(true);
  });

  it('a formation: a ring, a line, a strip and a run of hedges', () => {
    const ring = picture('keyholeGarden');
    expect(ring.ring).toBe(true);
    expect(ring.slots[1]).toMatchObject({ count: 3 });
    expect(ring.note).toBe('3 around it');
    const green = picture('villageGreen');
    expect(green.slots[1]!.pieces).toEqual([]); // any building
    expect(green.note).toBe('6 around it, of 3 kinds or more');
    expect(ids('millRace')).toEqual([['weir'], ['riverWheel'], ['workshop']]);
    expect(picture('sunTerrace').note).toBe('in a straight line, on hill');
    expect(ids('wildway')).toEqual([['meadow', 'woodland']]);
    expect(picture('windbreak').slots).toEqual([
      { pieces: [{ kind: 'building', id: 'hedgerow', name: 'Hedgerow' }], count: 4 },
    ]);
  });

  it('an evolution: what it is, what it needs beside it, and what it becomes', () => {
    expect(ids('foodForest')).toEqual([['orchard'], ['apiary'], ['meadow'], ['foodForest']]);
    expect(picture('foodForest').slots[2]!.count).toBe(2);
    expect(picture('foodForest').joins).toEqual(['next', 'next', 'becomes']);
    expect(picture('agrivoltaicField').joins).toEqual(['placed', 'becomes']);
    expect(picture('beaverDam').note).toBe('while Harmony is 50 or more');
    // Coppicing starts from a tile.
    expect(picture('coppiceWood').slots[0]!.pieces[0]).toMatchObject({
      kind: 'tile',
      id: 'woodland',
    });
  });
});

describe("a building's combos", () => {
  it('are the ones whose pictures show it, as a piece or a choice', () => {
    const withOrchard = reach.combos.filter((c) => shows(reach, c, 'orchard')).map((c) => c.id);
    expect(withOrchard).toEqual(expect.arrayContaining(['busyBees', 'kitchenLoop', 'foodForest']));
    expect(withOrchard).not.toContain('bathLoop');
  });
});

describe('a closed loop on the map', () => {
  it('lights up its buildings when chosen, and gives way to a terrain', () => {
    const s = scenario(['~ f , , ,', '~ f , C ,', '~ f , , ,']);
    s.buildings.f1 = { uid: 'f1', type: 'floodplainFarm', at: at(1, 0), builtTurn: 0 };
    s.buildings.c1 = { uid: 'c1', type: 'composter', at: at(2, 0), builtTurn: 0 };
    s.loops = [{ combo: 'kitchenLoop', anchor: 'c1', members: ['c1', 'f1'], turn: 0 }];
    const store = new GameStore(content, s);
    store.focusLoop('kitchenLoop:c1');
    expect(store.terrainTiles).toEqual([at(2, 0), at(1, 0)]);
    store.focusTerrain('floodplain');
    expect(store.loopFocus).toBeNull();
    expect(store.terrainTiles).toHaveLength(3);
  });
});
