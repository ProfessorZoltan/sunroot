/** Projects: big works from era 3 that turn late-run stores into lasting effects. */
import { describe, expect, it } from 'vitest';
import {
  effectiveContent,
  harmonyLines,
  projectBlocked,
  scoreRun,
  seedsForRun,
  type RunState,
} from '../src/sim';
import { act, content, endSeason, rejects, scenario } from './helpers';

const LAND = [
  '^ ^ ^ , ~ , , , ^ ^',
  ' ^ ^ . , ~ , . , ^ ^',
  '^ , C , ~ , , . , ^',
  ' ^ . , , ~ , , , . ^',
];
const rich = { materials: 300, compost: 300, knowledge: 100, biomass: 200, food: 150 };
const at = (year: number, stores = rich) => scenario(LAND, { year, stores, citizens: 6 });
const ends = (s: RunState, n: number) => {
  for (let i = 0; i < n; i++) s = endSeason(s);
  return s;
};

describe('projects', () => {
  it('open from their era, cost their stores at once, and start only once', () => {
    expect(rejects(at(6), { type: 'startProject', project: 'seedVault' })).toMatch(/from era 3/);
    const s = act(at(7), { type: 'startProject', project: 'seedVault' });
    expect(s.stores.knowledge).toBe(100 - 20);
    expect(s.stores.materials).toBe(300 - 25);
    expect(s.projects).toEqual([{ id: 'seedVault', started: s.turn, done: null }]);
    expect(rejects(s, { type: 'startProject', project: 'seedVault' })).toMatch(/already/);
    expect(projectBlocked(content, at(7, { ...rich, knowledge: 5 }), 'seedVault')).toMatch(
      /needs 20 knowledge/,
    );
    expect(rejects(at(9), { type: 'startProject', project: 'longBridge' })).toMatch(/era 4/);
  });

  it('finish at the end of their last season, and undo refunds a start', () => {
    let s = act(at(7), { type: 'startProject', project: 'seedVault' });
    const undone = act(s, { type: 'undo' });
    expect(undone.projects).toEqual([]);
    expect(undone.stores.knowledge).toBe(100);
    s = endSeason(s);
    expect(s.projects[0]!.done).toBeNull();
    s = endSeason(s);
    expect(s.projects[0]!.done).toBe(s.turn - 1);
    expect(s.lastReport!.projectsDone).toEqual(['seedVault']);
  });

  it('pay off: score, Harmony, wellbeing, Seeds and healed land', () => {
    let s = at(10);
    for (const project of ['seedVault', 'biocharBeds', 'festivalGrounds', 'rootCityGift'])
      s = act(s, { type: 'startProject', project });
    s = ends(s, 3);
    const score = scoreRun(content, { ...s, status: 'collapsed' });
    expect(score.lines).toContainEqual({ reason: 'Seed Vault', points: 25 });
    expect(harmonyLines(effectiveContent(content, s), s)).toContainEqual({
      label: 'Biochar Beds',
      amount: 6,
    });
    expect(s.lastReport!.wellbeing.lines).toContainEqual(
      expect.objectContaining({ reason: 'Festival Grounds', amount: 2 }),
    );
    expect(seedsForRun(content, { ...s, status: 'collapsed' }).lines).toContainEqual({
      reason: 'Gift to Root City',
      points: 6,
    });
  });

  it('Green Terraces improve the 8 least healthy tiles one step', () => {
    let s = at(7);
    const barren = Object.values(s.map.tiles).filter((t) => t.type === 'barren').length;
    s = act(s, { type: 'startProject', project: 'greenTerraces' });
    s = ends(s, 2);
    const now = Object.values(s.map.tiles).filter((t) => t.type === 'barren').length;
    expect(now).toBe(Math.max(0, barren - 8));
  });

  it('show in the season ledger as spending', () => {
    let s = act(at(7), { type: 'startProject', project: 'seedVault' });
    s = endSeason(s);
    expect(s.lastReport!.flows.knowledge!.used['Project: Seed Vault']).toEqual({
      amount: 20,
      count: 1,
    });
  });
});
