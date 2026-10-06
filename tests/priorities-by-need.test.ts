/**
 * Priorities by need (asked for in playtesting): besides the main priority list, the player can
 * give workers, energy, water, heat and cooling each a list of their own. A need without one
 * follows the main list; everything else (repairs, events, animals) always does.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  priorityFor,
  type Content,
  type PriorityKind,
  type RunState,
} from '../src/sim';
import type willowReach from '../src/content/willow-reach.json';
import { content, endSeason, place, scenario, uidAt, withWater } from './helpers';

type Raw = typeof willowReach;
const LAND = ['~ f , , , ,', '~ f , , , ,', '~ f C , , ,', '~ f , , , ,'];

/** Gives one need a list of its own: the main list with `first` moved just after the camp. */
function ownList(c: Content, s: RunState, kind: PriorityKind, first: string[]): RunState {
  const [camp, ...rest] = s.priority;
  const order = [camp!, ...first, ...rest.filter((uid) => !first.includes(uid))];
  const r = applyCommand(c, s, { type: 'setPriority', kind, order });
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

describe('a need with a list of its own', () => {
  it('follows the main list until it has one; then that order, new buildings where homes go', () => {
    let s = place(scenario(LAND), 'cottage', 3, 0);
    s = place(s, 'workshop', 4, 0);
    expect(priorityFor(s, 'energy')).toBe(s.priority);
    const workshop = uidAt(s, 4, 0);
    s = ownList(content, s, 'energy', [workshop]);
    expect(priorityFor(s, 'energy')).toEqual(['b0', workshop, uidAt(s, 3, 0)]);
    // The main list is untouched, and so are the other needs.
    expect(s.priority).toEqual(['b0', uidAt(s, 3, 0), workshop]);
    expect(priorityFor(s, 'workers')).toBe(s.priority);
    // A home built since goes after the last home before it in the main list (the cottage).
    s = place(s, 'cottage', 5, 0);
    const home = uidAt(s, 5, 0);
    expect(s.priority).toEqual(['b0', uidAt(s, 3, 0), home, workshop]);
    expect(priorityFor(s, 'energy')).toEqual(['b0', workshop, uidAt(s, 3, 0), home]);
  });

  it('goes back to the main list when cleared; a list must name every building once', () => {
    let s = place(scenario(LAND), 'workshop', 3, 0);
    s = ownList(content, s, 'water', [uidAt(s, 3, 0)]);
    expect(s.priorities?.water).toBeDefined();
    const cleared = applyCommand(content, s, { type: 'setPriority', kind: 'water', order: null });
    expect(cleared.ok && cleared.state.priorities).toBeFalsy();
    const bad = applyCommand(content, s, { type: 'setPriority', kind: 'water', order: ['b0'] });
    expect(bad.ok).toBe(false);
  });
});

describe('each need in its own order', () => {
  it('workers: staffed in the workers list, not the main one', () => {
    // One worker for two farms: the main list staffs the first built.
    let s = scenario(LAND, { citizens: 1, stores: { food: 500 } });
    s = place(s, 'floodplainFarm', 1, 0);
    s = place(s, 'floodplainFarm', 1, 1);
    const [a, b] = [uidAt(s, 1, 0), uidAt(s, 1, 1)];
    expect(endSeason(s).lastReport!.unstaffed).toEqual([b]);
    expect(endSeason(ownList(content, s, 'workers', [b])).lastReport!.unstaffed).toEqual([a]);
  });

  it('energy: shut off in a blackout from the bottom of the energy list', () => {
    const cells: [number, number][] = [
      [3, 0],
      [4, 0],
      [5, 0],
      [3, 1],
      [4, 1],
      [5, 1],
    ];
    const s = cells.reduce((acc, [c, r]) => place(acc, 'cottage', c, r), scenario(LAND));
    const main = endSeason(s).lastReport!.blackouts;
    expect(main.length).toBeGreaterThan(0);
    // Put the ones shut off first in the energy list: the ones that stayed lit go dark instead.
    const own = endSeason(ownList(content, s, 'energy', main)).lastReport!.blackouts;
    expect(own.length).toBe(main.length);
    const lit = cells.map(([c, r]) => uidAt(s, c, r)).filter((uid) => !main.includes(uid));
    expect(own).toEqual(expect.arrayContaining(lit));
    // Workers follow the main list still: an energy list changes nothing there.
    expect(endSeason(ownList(content, s, 'workers', main)).lastReport!.blackouts).toEqual(main);
  });

  it('water: ties at the same distance go by the water list', () => {
    const narrow = withWater({
      campChannel: 0,
      edit: (raw) => (raw.rules.water.channelCapacity = 1),
    });
    const VALLEY = [
      '~ f . . . . .',
      '~ f m m m m m',
      '~ f m m m m m',
      '~ f m m m m m',
      '~ f , , C , ,',
    ];
    let s = scenario(VALLEY, { content: narrow, citizens: 30, stores: { food: 500 } });
    for (const i of [0, 1, 2]) s = place(s, 'irrigationChannel', 1 + i, 2, narrow);
    s = place(s, 'floodplainFarm', 2, 3, narrow);
    s = place(s, 'floodplainFarm', 2, 1, narrow);
    const short = (x: RunState) => x.lastReport!.water!.uses[uidAt(x, 2, 1)]!.short;
    expect(short(endSeason(s, narrow))).toBe(true);
    expect(short(endSeason(ownList(narrow, s, 'water', [uidAt(s, 2, 1)]), narrow))).toBe(false);
  });

  it('heat: heat that is short goes to the heat list first, the last goes cold', () => {
    // No grid heat, and a pump reaching everyone: 4 heat a night for the camp's 2 and 3 cottages.
    const cold = withWater({
      edit: (raw: Raw) => Object.assign(raw.rules.localHeat, { enabled: false, gridHeat: false }),
    });
    let s = scenario(LAND, { content: cold, season: 'winter', stores: { food: 500 } });
    s = place(s, 'airSourceHeatPump', 3, 2, cold);
    for (const [c, r] of [
      [3, 0],
      [4, 0],
      [5, 0],
    ] as const)
      s = place(s, 'cottage', c, r, cold);
    const main = endSeason(s, cold).lastReport!.cold;
    expect(main).toEqual([uidAt(s, 5, 0)]);
    const own = endSeason(ownList(cold, s, 'heat', [uidAt(s, 5, 0)]), cold).lastReport!.cold;
    expect(own).toHaveLength(1);
    expect(own).not.toContain(uidAt(s, 5, 0));
  });

  it('cooling: cooling that is short goes to the cooling list first, the last is hot', () => {
    // A wind tower cools 2 on a hot day, three huts need 1 each, and no grid cooling.
    const hot = withWater({
      edit: (raw: Raw) => {
        const find = (id: string) => raw.buildings.find((b) => b.id === id)!;
        const hut = structuredClone(find('cottage')) as Record<string, unknown>;
        Object.assign(hut, {
          id: 'hut',
          name: 'Hut',
          demand: { energy: { night: [0, 0, 0, 0] }, cool: { day: [0, 1, 0, 0] } },
        });
        const tower = structuredClone(find('well')) as Record<string, unknown>;
        Object.assign(tower, {
          id: 'windTower',
          name: 'Wind Tower',
          drinkingWater: false,
          requiresWalks: false,
          cooling: { day: [2, 2, 2, 2] },
        });
        raw.buildings.push(hut as never, tower as never);
        (raw.rules as Record<string, unknown>).cooling = {
          range: 2,
          gridCool: false,
          gridCoolCost: 2,
        };
      },
    });
    let s = scenario(LAND, { content: hot, season: 'summer', stores: { food: 500 } });
    s = place(s, 'windTower', 4, 1, hot);
    for (const [c, r] of [
      [3, 0],
      [4, 0],
      [5, 0],
    ] as const)
      s = place(s, 'hut', c, r, hot);
    const main = endSeason(s, hot).lastReport!.hot ?? [];
    expect(main).toEqual([uidAt(s, 5, 0)]);
    const own = endSeason(ownList(hot, s, 'cooling', [uidAt(s, 5, 0)]), hot).lastReport!.hot;
    expect(own).toHaveLength(1);
    expect(own).not.toContain(uidAt(s, 5, 0));
  });
});
