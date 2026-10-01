import { describe, expect, it } from 'vitest';
import { EMPTY_ALMANAC, entryView, loadAlmanac, recordRun, saveAlmanac } from '../src/game/almanac';
import { GameStore } from '../src/game/store';
import { buildTimeline } from '../src/game/timeline';
import { previewPlacement } from '../src/sim';
import { at, content, endSeason, place, scenario, uidAt } from './helpers';

const LAND = [
  '^ ^ ^ , ~ , , , ^ ^',
  ' ^ ^ , , ~ , , , ^ ^',
  '^ , C , ~ , , , , ^',
  ' ^ , , f ~ f , , , ^',
  '^ , , , ~ , , m , ^',
];

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

describe('the Almanac', () => {
  it('keeps discoveries and hints across runs, and ignores unknown or broken data', () => {
    const storage = new MemoryStorage() as unknown as Storage;
    expect(loadAlmanac(content, storage)).toEqual(EMPTY_ALMANAC);
    const s = { ...scenario(LAND), discoveries: ['kitchenLoop'], hints: ['wildway'] };
    const { almanac, fresh } = recordRun(EMPTY_ALMANAC, s);
    expect(fresh).toEqual(['kitchenLoop']);
    saveAlmanac(content, storage, { ...almanac, discovered: [...almanac.discovered, 'gone'] });
    expect(loadAlmanac(content, storage)).toEqual({
      version: 1,
      discovered: ['kitchenLoop'],
      hints: ['wildway'],
    });
    expect(recordRun(almanac, s).fresh).toEqual([]);
    storage.setItem(`sunroot:almanac:${content.id}`, '{not json');
    expect(loadAlmanac(content, storage)).toEqual(EMPTY_ALMANAC);
  });

  it('shows silhouettes; adjacency and chain hints are free, the hidden layers need buying', () => {
    const s = scenario(LAND);
    const view = (id: string, almanac = EMPTY_ALMANAC, state = s) =>
      entryView(almanac, state, content.comboById[id]!);
    expect(view('busyBees')).toBe('hinted');
    expect(view('kitchenLoop')).toBe('hinted');
    expect(view('wildway')).toBe('silhouette');
    expect(view('wildway', { ...EMPTY_ALMANAC, hints: ['wildway'] })).toBe('hinted');
    expect(view('wildway', EMPTY_ALMANAC, { ...s, hints: ['wildway'] })).toBe('hinted');
    expect(view('wildway', { ...EMPTY_ALMANAC, discovered: ['wildway'] })).toBe('known');
  });

  it('the store reveals combos new to the Almanac once the season ends', () => {
    const saved: unknown[] = [];
    let s = scenario(LAND, { season: 'summer', stores: { scraps: 3 } });
    s = place(s, 'floodplainFarm', 5, 3);
    s = place(s, 'composter', 6, 3);
    const store = new GameStore(content, s, {
      almanac: { version: 1, discovered: ['kitchenLoop'], hints: [] },
      onAlmanac: (a) => saved.push(a),
    });
    store.dispatch({ type: 'endSeason' });
    // The Kitchen Loop was already in the Almanac; the composter's neighbour is new.
    expect(store.state.lastReport!.discoveries).toContain('kitchenLoop');
    expect(store.reveals).not.toContain('kitchenLoop');
    expect(saved).toHaveLength(store.reveals.length > 0 ? 1 : 0);
    const before = store.reveals.length;
    store.dismissReveal();
    expect(store.reveals.length).toBe(Math.max(0, before - 1));
  });
});

describe('combos in the preview and the resolution', () => {
  it('the placement preview names the loop a building would close, with vines', () => {
    let s = scenario(LAND, { season: 'summer', stores: { scraps: 3 } });
    s = place(s, 'floodplainFarm', 5, 3);
    const p = previewPlacement(content, s, 'composter', at(6, 3));
    expect(p.ok && p.combos.map((h) => h.combo)).toEqual(['kitchenLoop']);
    const store = new GameStore(content, s);
    store.selectBuilding('composter');
    store.hoverAt(at(6, 3));
    expect(store.vines).toEqual([[at(6, 3), at(5, 3)]]);
  });

  it('the preview shows a canopy over a farm evolving it', () => {
    let s = scenario(LAND, { season: 'summer' });
    s = place(s, 'floodplainFarm', 5, 3);
    const p = previewPlacement(content, s, 'solarCanopy', at(5, 3));
    expect(p.ok && p.evolves).toEqual({ uid: uidAt(s, 5, 3), into: 'agrivoltaicField' });
  });

  it('loops at work glow during the resolution', () => {
    let s = scenario(LAND, { season: 'summer', stores: { scraps: 3 } });
    s = place(s, 'floodplainFarm', 5, 3);
    s = place(s, 'composter', 6, 3);
    s = endSeason(s);
    const t = buildTimeline(content, s, s.lastReport!);
    expect(t.glow).toEqual([[at(6, 3), at(5, 3)]]);
  });
});
