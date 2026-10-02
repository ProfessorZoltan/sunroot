import { describe, expect, it } from 'vitest';
import { PlayLog, logToCsv } from '../src/game/playlog';
import { GameStore } from '../src/game/store';
import { at, content, place, scenario, withWater } from './helpers';

const DRY = ['^ ^ ^ , ~ , , , ^ ^', ' ^ ^ , , ~ , , , ^ ^', '^ , C , ~ , , , , ^'];

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

describe('the playtest log', () => {
  it('writes a row per season: time, undos, buildings, card and notes', () => {
    let clock = 0;
    const storage = new MemoryStorage() as unknown as Storage;
    const log = new PlayLog(content, storage, () => clock);
    const s = scenario(DRY);
    s.draft = { offer: ['orchard'], picked: null, extraBought: false };
    s.seasonStart!.draft = { offer: ['orchard'], picked: null, extraBought: false }; // for undo
    const store = new GameStore(content, s, {
      onCommand: (c, ok, before, after) => log.command(c, ok, before, after),
      onResolution: (playing, skipped, state) => log.resolution(playing, skipped, state),
    });
    log.begin(store.state);
    clock = 10_000;
    store.dispatch({ type: 'pickCard', card: 'orchard' });
    store.dispatch({ type: 'place', building: 'cottage', at: at(3, 2) });
    store.dispatch({ type: 'undo' });
    store.dispatch({ type: 'place', building: 'cottage', at: at(3, 1) });
    log.note(store.state, '  the cottage felt cheap  ');
    clock = 42_500;
    store.dispatch({ type: 'endSeason' });
    expect(log.rows).toEqual([]); // written once the season has played out
    clock = 45_000;
    store.finishResolution(); // skipped
    expect(log.rows).toHaveLength(1);
    expect(log.rows[0]).toMatchObject({
      turn: 0,
      season: 'spring',
      seconds: 42.5,
      watched: 2.5,
      skipped: true,
      undos: 1,
      placed: ['cottage', 'cottage'],
      card: 'orchard',
      notes: ['the cottage felt cheap'],
      ended: null,
    });
    // Kept across visits, and downloadable as CSV.
    expect(new PlayLog(content, storage).rows).toHaveLength(1);
    const csv = logToCsv(log.rows).split('\n');
    expect(csv[0]).toMatch(/^run,turn,year,season,seconds,watched,skipped,commands,undos,placed/);
    expect(csv[1]).toContain('cottage; cottage');
    log.clear();
    expect(new PlayLog(content, storage).rows).toEqual([]);
  });

  it('names the layers, hedges planted and combos discovered, for playtesting the new cards', () => {
    const W = withWater({ campChannel: 0 });
    const VALLEY = ['~ f . . . . .', '~ f m m m m m', '~ f m m m m m', '~ f , , C , ,'];
    let s = scenario(VALLEY, {
      content: W,
      citizens: 30,
      stores: { food: 500, biomass: 10, materials: 20 },
    });
    // A Keyhole Garden: a composter with 3 farms next to it.
    s = place(s, 'composter', 3, 1, W);
    for (const [col, row] of [
      [2, 1],
      [4, 1],
      [3, 2],
    ] as const)
      s = place(s, 'floodplainFarm', col, row, W);
    s.unlocked.push('hedgerow');
    const log = new PlayLog(W, null);
    const store = new GameStore(W, s, {
      onCommand: (c, ok, before, after) => log.command(c, ok, before, after),
      onResolution: (playing, skipped, state) => log.resolution(playing, skipped, state),
    });
    log.begin(store.state);
    expect(store.dispatch({ type: 'plantHedge', a: at(5, 2), b: at(6, 2) })).toBe(true);
    store.dispatch({ type: 'endSeason' });
    store.finishResolution();
    expect(log.rows[0]).toMatchObject({
      layers: ['water'],
      placed: ['hedgerow'],
      discovered: expect.arrayContaining(['keyholeGarden']),
    });
    expect(logToCsv(log.rows).split('\n')[0]).toContain('notes,layers,discovered,materials');
  });
});
