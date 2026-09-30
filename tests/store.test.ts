import { describe, expect, it } from 'vitest';
import { GameStore } from '../src/game/store';
import { createRun, hexKey } from '../src/sim';
import { at, content, scenario } from './helpers';

const RIVER = [
  '^ . , f ~ f , . ^ ^',
  ' ^ . , f ~ f , . . ^',
  '^ . C f ~ f f . R ^',
  ' ^ . m m ~ f , . . ^',
];

describe('game store', () => {
  it('places with the tool in hand, keeps it for the next one, and explains failures', () => {
    const store = new GameStore(content, scenario(RIVER));
    store.selectBuilding('cottage');
    store.clickAt(at(6, 3));
    store.clickAt(at(7, 3));
    expect(Object.values(store.state.buildings).filter((b) => b.type === 'cottage')).toHaveLength(
      2,
    );
    store.clickAt(at(4, 0));
    expect(store.message).toMatch(/can't be built on river/);
  });

  it('previews the hovered tile', () => {
    const store = new GameStore(content, scenario(RIVER, { season: 'autumn' }));
    store.selectBuilding('floodplainFarm');
    store.hoverAt(at(5, 1));
    expect(store.placement?.preview.ok).toBe(true);
    store.hoverAt(at(4, 1));
    expect(store.placement?.preview.ok).toBe(false);
  });

  it('moves a keyboard cursor, and N offers dry land first for buildings the flood would damage', () => {
    const store = new GameStore(content, scenario(RIVER));
    store.selectBuilding('workshop');
    store.nextSite();
    const first = store.state.map.tiles[hexKey(store.hover!)]!;
    expect(first.type).not.toBe('floodplain');
    const start = store.hover!;
    store.moveCursor(1, 0);
    expect(store.hover).not.toEqual(start);
    store.confirm();
    expect(Object.values(store.state.buildings).some((b) => b.type === 'workshop')).toBe(true);
  });

  it('inspects a building on click when no tool is in hand', () => {
    const store = new GameStore(content, scenario(RIVER));
    store.clickAt(store.state.buildings.b0!.at);
    expect(store.inspected).toBe('b0');
    store.selectBuilding('cottage');
    expect(store.inspected).toBeNull();
  });

  it('spreads compost with the compost tool', () => {
    const store = new GameStore(content, scenario(RIVER, { stores: { compost: 2 } }));
    store.setTool({ kind: 'compost' });
    store.clickAt(at(1, 0));
    expect(store.state.map.tiles[hexKey(at(1, 0))]!.type).toBe('scrub');
    expect(store.state.stores.compost).toBe(0);
  });

  it('caches the interface numbers per state', () => {
    const store = new GameStore(content, createRun(content, { seed: 'cache' }));
    const a = store.insight;
    expect(store.insight).toBe(a);
    store.dispatch({ type: 'pickCard', card: store.state.draft.offer[0]! });
    expect(store.insight).not.toBe(a);
  });

  it('plays each season out, and any action skips the rest of it', () => {
    const store = new GameStore(content, scenario(RIVER));
    store.dispatch({ type: 'pickCard', card: store.state.draft.offer[0]! });
    const spring = store.insight;
    store.dispatch({ type: 'endSeason' });
    const r = store.resolution!;
    expect(r.report).toBe(store.state.lastReport);
    expect(r.before).toBe(spring);
    expect(r.phase).toBe('event');

    store.setResolutionPhase(r.id, 'day');
    store.togglePause();
    expect(store.resolution).toMatchObject({ phase: 'day', paused: true });
    store.finishResolution(r.id + 1); // a stale finish is ignored
    expect(store.resolution).not.toBeNull();

    store.selectBuilding('cottage'); // picking up a tool skips
    expect(store.resolution).toBeNull();
    store.selectBuilding(null);

    store.dispatch({ type: 'pickCard', card: store.state.draft.offer[0]! });
    store.dispatch({ type: 'endSeason' });
    expect(store.resolution!.id).toBe(r.id + 1);
    store.dispatch({ type: 'undo' }); // a command skips, even one that fails
    expect(store.resolution).toBeNull();
  });
});
