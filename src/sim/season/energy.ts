/**
 * Steps 5 to 7: flexible consumers, storage and demand, slot by slot.
 *
 * Heat demand is paid first by free heat (solar thermal), then by heat pumps
 * (2 heat per energy), and the rest directly, 1 energy per heat. With local
 * heat on (rules.localHeat), a source reaches only buildings within its
 * range: free heat and pumps pay the buildings near them (in priority order,
 * nearest source first), heat wells cover only nearby buildings' heat and
 * charge only from nearby collectors' spare heat; energy paid 1:1 from the
 * grid reaches anywhere. With it off the range is unlimited, which is the
 * shared pool of before.
 *
 * A building that takes heat from its neighbours (the Bathhouse) is warmed
 * first by a staffed kiln next to it, for free, or by a neighbouring heat
 * well's stored heat; only what they can't give goes to the sources above.
 *
 * Without grid heat (rules.localHeat.gridHeat off: the heat layer from run 4,
 * and a Long Winter) energy can't pay heat directly. Heat comes only from
 * collectors, pumps (in whole energy's worth, rounded up), neighbours and heat
 * wells; wells charge from spare free heat or a nearby pump's spare capacity,
 * never 1:1 from energy, and pay only a building's whole heat. A building
 * whose heat no source can pay is cold: shut off, like a blackout.
 *
 * Storage first reserves the spare day energy (or free heat) it needs to cover
 * a night shortfall it can already see (covering demand is a need, not a
 * spare); flexible consumers then use what is spare; storage then charges from
 * what is still spare; demand is paid, storage discharges into shortfalls and
 * any gap left becomes a blackout, shutting buildings off lowest priority first.
 */
import type { Resource, Slot } from '../content/schema';
import { AUTO_RECIPE, SLOTS } from '../content/schema';
import { hexDistance } from '../hex';
import {
  byPriority,
  defOf,
  coolDemand as coolNeed,
  heatDemand as heatNeed,
  neighborBuildings,
  neighborTiles,
  occupancy,
} from '../queries';
import type { BuildingState, HeatLink } from '../types';
import { festivalThisSeason } from '../wildlife';
import { addYield, explain, flow, type SeasonContext } from './context';

type PerSlot = Record<Slot, number>;
const perSlot = (): PerSlot => ({ day: 0, night: 0 });

interface Settlement {
  /** Energy the buildings need once free heat and heat pumps have paid what they can. */
  demand: number;
  heat: number;
  free: number;
  pumped: number;
  pumpEnergy: number;
  /** Heat still to pay directly with energy. */
  direct: number;
  /** Heat paid and energy drawn, per heat pump uid. */
  byPump: Record<string, { heat: number; energy: number }>;
  /** Heat each building still needs, after free heat and pumps (by uid). */
  left: Map<string, number>;
  /** Free heat each collector has left (by uid). */
  freeLeft: Map<string, number>;
}

export function resolveEnergy(ctx: SeasonContext): void {
  const { content, state, si, report } = ctx;
  // Every change to what a store holds goes through here, so the report can say, per store,
  // what it charged and gave this season.
  const setStored = (b: BuildingState, value: number) => {
    const before = b.stored ?? 0;
    const trace = (report.storage[b.uid] ??= { start: before, charged: 0, given: 0 });
    if (value > before) trace.charged += value - before;
    else trace.given += before - value;
    b.stored = value;
  };
  const active = byPriority(state, 'energy').filter((b) => ctx.active.has(b.uid));
  // Heat and cooling go to buildings in their own order, if the player made one (each need's
  // list, DECISIONS.md, Priorities by need); energy, blackouts and runs in energy's.
  const heatActive = byPriority(state, 'heat').filter((b) => ctx.active.has(b.uid));
  const coolActive = byPriority(state, 'cooling').filter((b) => ctx.active.has(b.uid));

  // Cooling (the Sun Desert, heat's mirror): cooling sources within range pay the buildings
  // that need it, in priority order, nearest source first. The grid pays the rest at its cost
  // in energy, as part of each building's demand; without grid cooling, the building is hot.
  const cooling = content.rules.cooling;
  const coolers = active.filter((b) => defOf(content, b).cooling);
  // Absorption chillers turn heat into cooling: heat from the heat sources within range, only
  // what no building needs for warmth that slot, and only as much as the homes they reach need.
  const chillers = active.filter((b) => defOf(content, b).chiller);
  // Ice houses: winter's water frozen, melting a little each season, given out as cooling.
  const iceHouses = active.filter((b) => defOf(content, b).ice);
  for (const b of iceHouses) {
    const ice = defOf(content, b).ice!;
    const held = b.stored ?? 0;
    if (state.season === 'winter') {
      const got = Object.values(report.water?.uses[b.uid]?.got ?? {}).reduce((n, x) => n + x, 0);
      const frozen = Math.min(ice.capacity, held + got * ice.perWater);
      if (frozen > held) explain(ctx, b, `froze ${got} water into ${frozen - held} ice`);
      setStored(b, frozen);
    } else if (held > 0 && ice.melt > 0) {
      const left = Math.max(0, held - ice.melt);
      explain(ctx, b, `${held - left} ice melted`);
      setStored(b, left);
    }
  }
  const heatSources = active.filter((b) => defOf(content, b).heatGeneration);
  const genHeat = (b: BuildingState, slot: Slot) => report.generated[b.uid]?.heat[slot] ?? 0;
  /** Heat each source gave the chillers, by slot: not there for warming anyone. */
  const chilled: Record<Slot, Map<string, number>> = { day: new Map(), night: new Map() };
  const chilledBy = (b: BuildingState, slot: Slot) => chilled[slot].get(b.uid) ?? 0;
  /** Cooling each building still needs once the cooling sources have given what they can. */
  const coolLeft: Record<Slot, Map<string, number>> = { day: new Map(), night: new Map() };
  const coolOutput = (c: BuildingState, slot: Slot): number => {
    const def = defOf(content, c).cooling!;
    const base = def[slot][si]!;
    const bonus = def.besideBonus;
    if (base <= 0 || !bonus) return base;
    const beside =
      neighborTiles(state, c.at).some((t) => bonus.tiles.includes(t.type)) ||
      neighborBuildings(state, c).some((n) => bonus.buildings.includes(n.type));
    return base + (beside ? bonus.amount : 0);
  };
  /** Who cooled whom, for the interface. */
  const coolLinks: HeatLink[] = [];
  for (const slot of SLOTS) {
    const r = report.energy[slot].cool!;
    const left = new Map(coolers.map((c) => [c.uid, coolOutput(c, slot)]));
    // Heat the buildings won't need for warmth this slot: the most the chillers may take.
    let spareForChillers = Math.max(
      0,
      heatSources.reduce((n, h) => n + genHeat(h, slot), 0) -
        active.reduce((n, h) => n + heatNeed(content, state, h, slot, si), 0),
    );
    /** Cooling each chiller can still make this slot. */
    const chillLeft = new Map(
      chillers.map((c) => [c.uid, defOf(content, c).chiller!.maxCoolPerSlot]),
    );
    /** A chiller makes up to `want` cooling from the heat within its reach; returns what it made. */
    const chill = (c: BuildingState, want: number): number => {
      const spec = defOf(content, c).chiller!;
      let made = 0;
      const sources = heatSources
        .filter((h) => hexDistance(h.at, c.at) <= cooling.range)
        .sort((x, y) => hexDistance(x.at, c.at) - hexDistance(y.at, c.at));
      for (const h of sources) {
        const heatWanted = Math.ceil(
          (Math.min(want, chillLeft.get(c.uid)!) - made) / spec.coolPerHeat,
        );
        const take = Math.min(heatWanted, genHeat(h, slot) - chilledBy(h, slot), spareForChillers);
        if (take <= 0) continue;
        chilled[slot].set(h.uid, chilledBy(h, slot) + take);
        spareForChillers -= take;
        made += take * spec.coolPerHeat;
        r.fromHeat = (r.fromHeat ?? 0) + take;
      }
      made = Math.min(made, want, chillLeft.get(c.uid)!);
      chillLeft.set(c.uid, chillLeft.get(c.uid)! - made);
      return made;
    };
    for (const b of coolActive) {
      let need = coolNeed(content, state, b, slot, si);
      if (need <= 0) continue;
      r.demand += need;
      const reach = coolers
        .filter((c) => hexDistance(c.at, b.at) <= cooling.range)
        .sort((x, y) => hexDistance(x.at, b.at) - hexDistance(y.at, b.at));
      for (const c of reach) {
        const t = Math.min(need, left.get(c.uid)!);
        if (t <= 0) continue;
        left.set(c.uid, left.get(c.uid)! - t);
        need -= t;
        r.free += t;
        r.bySource[c.type] = (r.bySource[c.type] ?? 0) + t;
        coolLinks.push({ slot, from: c.uid, to: b.uid, amount: t });
        explain(ctx, b, `${slot}: ${t} cooling from the ${defOf(content, c).name}`);
      }
      // Then the absorption chillers within reach, on spare heat.
      for (const c of chillers
        .filter((x) => hexDistance(x.at, b.at) <= cooling.range)
        .sort((x, y) => hexDistance(x.at, b.at) - hexDistance(y.at, b.at))) {
        if (need <= 0) break;
        const t = chill(c, need);
        if (t <= 0) continue;
        need -= t;
        r.free += t;
        r.bySource[c.type] = (r.bySource[c.type] ?? 0) + t;
        coolLinks.push({ slot, from: c.uid, to: b.uid, amount: t });
        explain(ctx, b, `${slot}: ${t} cooling from the ${defOf(content, c).name}, made from heat`);
      }
      // Then the ice houses within reach, from what they hold.
      for (const c of iceHouses
        .filter((x) => hexDistance(x.at, b.at) <= cooling.range)
        .sort((x, y) => hexDistance(x.at, b.at) - hexDistance(y.at, b.at))) {
        if (need <= 0) break;
        const t = Math.min(need, c.stored ?? 0);
        if (t <= 0) continue;
        setStored(c, (c.stored ?? 0) - t);
        need -= t;
        r.free += t;
        r.bySource[c.type] = (r.bySource[c.type] ?? 0) + t;
        coolLinks.push({ slot, from: c.uid, to: b.uid, amount: t });
        explain(ctx, b, `${slot}: ${t} cooling from the ${defOf(content, c).name}'s ice`);
      }
      if (need > 0) {
        coolLeft[slot].set(b.uid, need);
        if (cooling.gridCool) coolLinks.push({ slot, from: 'grid', to: b.uid, amount: need });
      }
    }
  }
  if (coolLinks.length > 0 || coolLeft.day.size + coolLeft.night.size > 0) report.cool = coolLinks;
  /** Energy the grid spends cooling a building in a slot. */
  const gridCoolOf = (b: BuildingState, slot: Slot) =>
    cooling.gridCool ? (coolLeft[slot].get(b.uid) ?? 0) * cooling.gridCoolCost : 0;

  // Star Night: homes keep their lights out, using less at night.
  const lightsOut = festivalThisSeason(content, state)?.nightEnergyRelief ?? 0;
  /** A building's own energy use in a slot, before any grid cooling. */
  const ownEnergyOf = (b: BuildingState, slot: Slot) => {
    const def = defOf(content, b);
    const own = def.demand?.energy[slot][si] ?? 0;
    const relief = slot === 'night' && def.housing > 0 ? lightsOut : 0;
    return Math.max(0, own - relief);
  };
  const energyOf = (b: BuildingState, slot: Slot) => ownEnergyOf(b, slot) + gridCoolOf(b, slot);
  const heatOf = (b: BuildingState, slot: Slot) => heatNeed(content, state, b, slot, si);
  const pumps = heatActive.filter((b) => defOf(content, b).heatPump);
  const freeHeat = perSlot();
  for (const slot of SLOTS) {
    freeHeat[slot] =
      Object.values(report.energy[slot].heat.bySource).reduce((a, b) => a + b, 0) -
      [...chilled[slot].values()].reduce((a, b) => a + b, 0);
  }

  // Demolition work this season: demand that can't be shut off.
  const demolition = perSlot();
  demolition[content.rules.demolition.slot] = ctx.demolitions * content.rules.demolition.energy;

  // Local heat: a source reaches the buildings within its range (unlimited with it off).
  const local = content.rules.localHeat;
  const range = local.enabled ? local.range : Infinity;
  /** Energy per heat paid from the grid: 1, unless local heat makes the grid's heat dear. */
  const gridCost = local.enabled ? local.gridHeatCost : 1;
  /** Whether energy can pay heat directly at all (off from the heat layer, run 4). */
  const gridHeat = local.gridHeat;
  const near = (a: BuildingState, b: BuildingState) =>
    range === Infinity || hexDistance(a.at, b.at) <= range;
  const rank = new Map(heatActive.map((b, i) => [b.uid, i]));
  /** Nearest to `to` first, ties (and everything, with no range) by priority. */
  const nearestTo = (to: BuildingState) => (x: BuildingState, y: BuildingState) =>
    (range === Infinity ? 0 : hexDistance(x.at, to.at) - hexDistance(y.at, to.at)) ||
    rank.get(x.uid)! - rank.get(y.uid)!;
  const collectors = heatActive.filter((b) => defOf(content, b).heatGeneration);
  const occ = occupancy(state);

  // Heat from a neighbour (the Bathhouse): a staffed kiln next to it warms it for free; a heat
  // well next to it pays from what it holds. Kilns first, then wells, each by priority. Then the
  // heat cascade: a building warmed that way passes on up to 1 heat a slot, losing the rest, to
  // a neighbour that takes heat from it (a bathhouse to a greenhouse).
  const fromNeighbor: Record<Slot, Map<string, number>> = { day: new Map(), night: new Map() };
  const neighborLinks: HeatLink[] = [];
  const warmed = new Set<string>();
  /** Heat each relay has passed on, by slot and uid (at most 1). */
  const relayed: Record<Slot, Map<string, number>> = { day: new Map(), night: new Map() };
  const give = (slot: Slot, n: BuildingState, b: BuildingState, t: number) => {
    fromNeighbor[slot].set(b.uid, (fromNeighbor[slot].get(b.uid) ?? 0) + t);
    neighborLinks.push({ slot, from: n.uid, to: b.uid, amount: t });
    report.energy[slot].heat.neighbor += t;
    explain(ctx, b, `${slot}: ${t} heat from the ${defOf(content, n).name} next to it`);
  };
  for (const pass of ['sources', 'relays'] as const) {
    for (const b of heatActive) {
      const from = defOf(content, b).heatFromNeighbors;
      if (!from) continue;
      const kind = (n: BuildingState) => {
        const nd = defOf(content, n);
        return nd.recipes ? 0 : nd.storage?.holds === 'heat' ? 1 : nd.heatFromNeighbors ? 2 : 3;
      };
      const next = neighborBuildings(state, b, occ)
        .filter((n) => from.includes(n.type) && ctx.active.has(n.uid))
        .filter((n) => (pass === 'sources' ? kind(n) < 2 : kind(n) === 2 && warmed.has(n.uid)))
        .sort((x, y) => kind(x) - kind(y) || rank.get(x.uid)! - rank.get(y.uid)!);
      for (const slot of SLOTS) {
        let owed = heatOf(b, slot) - (fromNeighbor[slot].get(b.uid) ?? 0);
        for (const n of next) {
          if (owed <= 0) break;
          const k = kind(n);
          const t =
            k === 0
              ? owed
              : k === 1
                ? Math.min(owed, n.stored ?? 0)
                : Math.min(owed, 1 - (relayed[slot].get(n.uid) ?? 0));
          if (t <= 0) continue;
          if (k === 1) setStored(n, (n.stored ?? 0) - t);
          if (k === 2) relayed[slot].set(n.uid, (relayed[slot].get(n.uid) ?? 0) + t);
          owed -= t;
          give(slot, n, b, t);
          warmed.add(b.uid);
        }
      }
    }
  }
  report.neighborHeat = neighborLinks;
  /** Heat a building still needs once its neighbours have given what they can. */
  const owedOf = (b: BuildingState, slot: Slot) =>
    heatOf(b, slot) - (fromNeighbor[slot].get(b.uid) ?? 0);
  const freeOf = (b: BuildingState, slot: Slot) =>
    (report.generated[b.uid]?.heat[slot] ?? 0) - chilledBy(b, slot);

  /** What the buildings that are still on need in a slot. `links` records who heated whom. */
  const settle = (slot: Slot, off: Set<string>, links?: HeatLink[]): Settlement => {
    const on = heatActive.filter((b) => !off.has(b.uid));
    const energy = on.reduce((sum, b) => sum + energyOf(b, slot), 0) + demolition[slot];
    const consumers = on.filter((b) => heatOf(b, slot) > 0);
    const left = new Map(consumers.map((b) => [b.uid, owedOf(b, slot)]));
    const heat = consumers.reduce((sum, b) => sum + heatOf(b, slot), 0);
    const pay = (from: BuildingState, to: BuildingState, amount: number) => {
      left.set(to.uid, left.get(to.uid)! - amount);
      if (amount > 0) links?.push({ slot, from: from.uid, to: to.uid, amount });
    };
    // Free heat: each building, in priority order, from the collectors within reach.
    const freeLeft = new Map(collectors.map((c) => [c.uid, freeOf(c, slot)]));
    let free = 0;
    // A building with its own stove (the Highland's bothy) heats itself before anyone else.
    for (const b of consumers) {
      const own = Math.min(left.get(b.uid)!, freeLeft.get(b.uid) ?? 0);
      if (own <= 0) continue;
      freeLeft.set(b.uid, freeLeft.get(b.uid)! - own);
      left.set(b.uid, left.get(b.uid)! - own);
      free += own;
    }
    for (const b of consumers) {
      for (const c of collectors.filter((x) => near(x, b)).sort(nearestTo(b))) {
        const t = Math.min(left.get(b.uid)!, freeLeft.get(c.uid)!);
        if (t <= 0) continue;
        freeLeft.set(c.uid, freeLeft.get(c.uid)! - t);
        free += t;
        pay(c, b, t);
      }
    }
    // Heat pumps: each pays for the buildings within reach, in whole energy's worth (rounded
    // down while the grid can pay the rest, up when nothing else can).
    let pumped = 0;
    let pumpEnergy = 0;
    const byPump: Settlement['byPump'] = {};
    for (const p of pumps) {
      const hp = defOf(content, p).heatPump!;
      const reach = consumers.filter((b) => near(p, b)).sort(nearestTo(p));
      const owed = reach.reduce((sum, b) => sum + left.get(b.uid)!, 0);
      const units = Math.min(
        (gridHeat ? Math.floor : Math.ceil)(owed / hp.heatPerEnergy),
        Math.floor(hp.maxHeatPerSlot / hp.heatPerEnergy),
      );
      if (units === 0) continue;
      const paid = Math.min(owed, units * hp.heatPerEnergy);
      byPump[p.uid] = { heat: paid, energy: units };
      pumped += paid;
      pumpEnergy += units;
      let paying = paid;
      for (const b of reach) {
        const t = Math.min(paying, left.get(b.uid)!);
        paying -= t;
        pay(p, b, t);
      }
    }
    const direct = [...left.values()].reduce((a, b) => a + b, 0);
    return {
      demand: energy + (gridHeat ? direct * gridCost : 0) + pumpEnergy,
      heat,
      free,
      pumped,
      pumpEnergy,
      direct,
      byPump,
      left,
      freeLeft,
    };
  };

  const spare = perSlot();
  const short = perSlot();
  /** Heat each pump could still make this slot (its most, less what it paid). */
  const pumpLeft: Record<Slot, Map<string, number>> = { day: new Map(), night: new Map() };
  /** Heat each building still needs from the grid (or a heat well), by slot and uid. */
  const directLeft: Record<Slot, Map<string, number>> = { day: new Map(), night: new Map() };
  /** Free heat each collector has spare, by slot and uid. */
  const collectorSpare: Record<Slot, Map<string, number>> = { day: new Map(), night: new Map() };
  /** Heat the wells paid, for the report of who heated whom. */
  const wellLinks: HeatLink[] = [];
  /** Heat still paid directly with energy: the part stored heat can cover. */
  const heatDemand = perSlot();
  const heatPaid = perSlot();
  const spareHeat = perSlot();
  for (const slot of SLOTS) {
    const r = report.energy[slot];
    const s = settle(slot, new Set());
    r.demand = s.demand;
    // Energy and heat stay apart: what each building type needs of each.
    for (const b of active) {
      const e = energyOf(b, slot);
      const h = heatOf(b, slot);
      if (e > 0) r.demandBy[b.type] = (r.demandBy[b.type] ?? 0) + e;
      if (h > 0) r.heatBy[b.type] = (r.heatBy[b.type] ?? 0) + h;
    }
    if (demolition[slot] > 0) r.demandBy.demolition = demolition[slot];
    Object.assign(r.heat, {
      demand: s.heat,
      free: s.free,
      pumped: s.pumped,
      pumpEnergy: s.pumpEnergy,
      direct: gridHeat ? s.direct : 0,
      gridLoss: gridHeat ? s.direct * (gridCost - 1) : 0,
    });
    pumpLeft[slot] = new Map(
      pumps.map((p) => [
        p.uid,
        defOf(content, p).heatPump!.maxHeatPerSlot - (s.byPump[p.uid]?.heat ?? 0),
      ]),
    );
    for (const [uid, paid] of Object.entries(s.byPump)) {
      explain(
        ctx,
        state.buildings[uid]!,
        `${slot}: paid ${paid.heat} heat with ${paid.energy} energy`,
      );
    }
    heatDemand[slot] = s.direct;
    spareHeat[slot] = freeHeat[slot] - s.free;
    directLeft[slot] = s.left;
    collectorSpare[slot] = s.freeLeft;
    spare[slot] = Math.max(0, r.supply - r.demand);
    short[slot] = Math.max(0, r.demand - r.supply);
  }

  /** Heat still owed by the buildings a heat well reaches. */
  const reachable = (well: BuildingState, slot: Slot) =>
    heatActive
      .filter((b) => directLeft[slot].has(b.uid) && near(well, b))
      .reduce((sum, b) => sum + directLeft[slot].get(b.uid)!, 0);
  /** A heat well pays `amount` of the heat owed by the buildings it reaches, nearest first. */
  const payFromWell = (well: BuildingState, slot: Slot, amount: number) => {
    let paying = amount;
    for (const b of heatActive
      .filter((x) => directLeft[slot].has(x.uid) && near(well, x))
      .sort(nearestTo(well))) {
      const t = Math.min(paying, directLeft[slot].get(b.uid)!);
      if (t <= 0) continue;
      directLeft[slot].set(b.uid, directLeft[slot].get(b.uid)! - t);
      wellLinks.push({ slot, from: well.uid, to: b.uid, amount: t });
      paying -= t;
    }
  };
  /** Spare free heat from the collectors a heat well reaches. */
  const spareNear = (well: BuildingState, slot: Slot) =>
    collectors
      .filter((c) => near(c, well))
      .reduce((sum, c) => sum + (collectorSpare[slot].get(c.uid) ?? 0), 0);
  /** Takes `amount` of spare free heat from the collectors a heat well reaches, nearest first. */
  const takeSpare = (well: BuildingState, slot: Slot, amount: number) => {
    let taking = amount;
    for (const c of collectors.filter((x) => near(x, well)).sort(nearestTo(well))) {
      const t = Math.min(taking, collectorSpare[slot].get(c.uid) ?? 0);
      collectorSpare[slot].set(c.uid, (collectorSpare[slot].get(c.uid) ?? 0) - t);
      taking -= t;
    }
  };

  /**
   * Without grid heat: pumps near a heat well turn spare energy into heat for it, at their
   * ratio, up to what they could still make. Returns the heat made.
   */
  const pumpInto = (
    well: BuildingState,
    slot: Slot,
    want: number,
    phase: 'wellsReserved' | 'wellsCharged',
  ): number => {
    let made = 0;
    for (const p of pumps.filter((x) => near(x, well)).sort(nearestTo(well))) {
      if (made >= want) break;
      const ratio = defOf(content, p).heatPump!.heatPerEnergy;
      const cap = Math.min(want - made, pumpLeft[slot].get(p.uid) ?? 0);
      const units = Math.min(spare[slot], Math.ceil(cap / ratio));
      if (units <= 0) continue;
      const h = Math.min(cap, units * ratio);
      spare[slot] -= units;
      pumpLeft[slot].set(p.uid, (pumpLeft[slot].get(p.uid) ?? 0) - h);
      report.energy[slot].heat.pumped += h;
      report.energy[slot].heat.pumpEnergy += units;
      report.energy[slot].heat[phase] = (report.energy[slot].heat[phase] ?? 0) + units;
      made += h;
      explain(ctx, p, `${slot}: ${h} heat into a heat well with ${units} spare energy`);
    }
    return made;
  };
  /** Without grid heat: a heat well pays whole buildings' heat from its store, nearest first. */
  const payWhole = (well: BuildingState, slot: Slot) => {
    for (const b of heatActive
      .filter((x) => (directLeft[slot].get(x.uid) ?? 0) > 0 && near(well, x))
      .sort(nearestTo(well))) {
      const t = directLeft[slot].get(b.uid)!;
      if (t > (well.stored ?? 0)) continue;
      setStored(well, (well.stored ?? 0) - t);
      directLeft[slot].set(b.uid, 0);
      wellLinks.push({ slot, from: well.uid, to: b.uid, amount: t });
      report.energy[slot].storageDischarged += t;
      report.energy[slot].heat.fromWells = (report.energy[slot].heat.fromWells ?? 0) + t;
      heatPaid[slot] += t;
    }
  };

  const storages = active.filter((b) => defOf(content, b).storage);
  const storageDef = (b: BuildingState) => defOf(content, b).storage!;
  const room = (b: BuildingState) => storageDef(b).capacity - (b.stored ?? 0);
  // The tide fills a tide mill before anything is paid, to give in either slot.
  for (const b of storages) {
    const fill = Math.min(storageDef(b).tideFill, room(b));
    if (fill > 0) setStored(b, (b.stored ?? 0) + fill);
  }
  const discharge = (slot: Slot, amount: number) => {
    short[slot] -= amount;
    report.energy[slot].storageDischarged += amount;
  };
  const charge = (b: BuildingState, slot: Slot, amount: number) => {
    setStored(b, (b.stored ?? 0) + amount);
    spare[slot] -= amount;
    report.energy[slot].storageCharged += amount;
  };
  /** Delivers up to `want` from an energy store, spending stored energy at its return ratio. */
  const drawEnergy = (b: BuildingState, want: number): number => {
    const { numerator, denominator } = storageDef(b).returns;
    const deliverable = Math.floor(((b.stored ?? 0) * numerator) / denominator);
    const give = Math.min(want, deliverable);
    setStored(b, (b.stored ?? 0) - Math.ceil((give * denominator) / numerator));
    return give;
  };

  // Without grid heat, stored heat pays the buildings it reaches first, whatever the energy.
  const heatWells = storages.filter((b) => storageDef(b).holds === 'heat');
  if (!gridHeat) for (const slot of SLOTS) for (const w of heatWells) payWhole(w, slot);

  // Stored heat and energy from earlier seasons cover shortfalls first.
  for (const slot of SLOTS) {
    for (const b of storages) {
      if (short[slot] === 0) break;
      if (!gridHeat && storageDef(b).holds === 'heat') continue;
      const s = storageDef(b);
      if (s.holds === 'heat') {
        // Each heat a well pays saves the grid `gridCost` energy.
        const give = Math.min(Math.ceil(short[slot] / gridCost), reachable(b, slot), b.stored ?? 0);
        setStored(b, (b.stored ?? 0) - give);
        payFromWell(b, slot, give);
        heatPaid[slot] += give;
        discharge(slot, Math.min(short[slot], give * gridCost));
      } else {
        discharge(slot, drawEnergy(b, short[slot]));
      }
    }
  }

  // Reserve for the night shortfall: heat wells take spare free heat, then spare day
  // energy, for the heat part; energy storage takes spare day energy for the rest.
  const heatFirst = [...storages].sort(
    (a, b) => Number(storageDef(b).holds === 'heat') - Number(storageDef(a).holds === 'heat'),
  );
  // Without grid heat, wells near buildings still cold at night take spare day heat (from
  // collectors, then nearby pumps' spare capacity) to warm them.
  if (!gridHeat) {
    for (const w of heatWells) {
      if (!storageDef(w).chargesFrom.includes('day')) continue;
      const want = Math.min(reachable(w, 'night') - (w.stored ?? 0), room(w));
      if (want <= 0) continue;
      const fromHeat = Math.min(want, spareNear(w, 'day'));
      takeSpare(w, 'day', fromHeat);
      spareHeat.day -= fromHeat;
      const fromPumps = pumpInto(w, 'day', want - fromHeat, 'wellsReserved');
      setStored(w, (w.stored ?? 0) + fromHeat + fromPumps);
      report.energy.day.heat.stored += fromHeat + fromPumps;
      payWhole(w, 'night');
    }
  }
  for (const b of heatFirst) {
    if (short.night === 0 || spare.day + spareHeat.day === 0) break;
    const s = storageDef(b);
    if (!gridHeat && s.holds === 'heat') continue;
    if (!s.chargesFrom.includes('day')) continue;
    if (s.holds === 'heat') {
      const give = Math.min(
        Math.ceil(short.night / gridCost),
        reachable(b, 'night'),
        room(b),
        spareNear(b, 'day') + spare.day,
      );
      if (give <= 0) continue;
      const fromHeat = Math.min(give, spareNear(b, 'day'));
      takeSpare(b, 'day', fromHeat);
      spareHeat.day -= fromHeat;
      report.energy.day.heat.stored += fromHeat;
      if (give > fromHeat) {
        charge(b, 'day', give - fromHeat);
        report.energy.day.reserved += give - fromHeat;
        setStored(b, b.stored! - (give - fromHeat));
      }
      payFromWell(b, 'night', give);
      heatPaid.night += give;
      discharge('night', Math.min(short.night, give * gridCost));
    } else {
      if (spare.day === 0) continue;
      const { numerator, denominator } = s.returns;
      const need = Math.ceil((short.night * denominator) / numerator);
      const amount = Math.min(need, room(b), spare.day);
      if (amount <= 0) continue;
      charge(b, 'day', amount);
      report.energy.day.reserved += amount;
      discharge('night', drawEnergy(b, short.night));
    }
  }

  // Flexible consumers ("sponges") run only on spare energy.
  for (const b of active) {
    const def = defOf(content, b);
    if (!def.recipes) continue;
    const recipeId = b.recipe ?? def.recipes.defaultRecipe;
    // Auto: each run uses the first recipe whose inputs are in store (salvage, then clutter).
    const choices =
      recipeId === AUTO_RECIPE
        ? def.recipes.options
        : def.recipes.options.filter((o) => o.id === recipeId);
    const used = perSlot();
    // A Mill Race workshop runs on the river's power; Night Shift adds night-only runs.
    const millRace = ctx.effects.get(b.uid)?.freeRuns === true && def.recipes.energyPerRun > 0;
    const cost = millRace ? 0 : def.recipes.energyPerRun;
    const made: Partial<Record<keyof typeof state.stores, number>> = {};
    const byRecipe: Record<string, number> = {};
    let runs = 0;
    // The Foundry District's perk: extra runs, on any energy, in the first year.
    // A festival's extra runs (the Silk Fair: the silk houses' busiest summer).
    const fair = festivalThisSeason(content, state)?.extraRuns;
    const maxRuns =
      def.recipes.maxRuns +
      (state.year === 1 ? def.recipes.firstYearExtraRuns : 0) +
      (fair?.buildings.includes(b.type) ? fair.runs : 0);
    while (runs < maxRuns + def.recipes.nightOnlyRuns) {
      const has = (needs: Partial<Record<Resource, number>>) =>
        Object.entries(needs).every(([res, n]) => state.stores[res as Resource] >= n);
      const recipe = choices.find(
        (o) => has(o.inputs) && (recipeId !== AUTO_RECIPE || has(o.autoAtLeast)),
      );
      if (!recipe) break;
      const inputs = Object.entries(recipe.inputs) as [keyof typeof state.stores, number][];
      const slots: readonly Slot[] = runs < maxRuns ? def.recipes.runSlots : ['night'];
      const slot = slots.find((s) => spare[s] >= cost);
      if (!slot) break;
      spare[slot] -= cost;
      used[slot] += cost;
      report.energy[slot].sponges += cost;
      for (const [res, n] of inputs) {
        state.stores[res] -= n;
        flow(report.flows, res, 'used', `${def.name} runs`, n, b.uid);
        if (res === 'clutter') report.clutter.recycled += n;
      }
      for (const [res, n] of Object.entries(recipe.outputs) as [
        keyof typeof state.stores,
        number,
      ][]) {
        made[res] = (made[res] ?? 0) + n;
      }
      // Shade or woodland next to it (the Mushroom Cellar).
      const bonus = recipe.bonusNextTo;
      if (
        bonus &&
        (neighborTiles(state, b.at).some((t) => bonus.tiles.includes(t.type)) ||
          (bonus.tall && neighborBuildings(state, b, occ).some((n) => defOf(content, n).tall)))
      ) {
        for (const [res, n] of Object.entries(bonus.outputs) as [
          keyof typeof state.stores,
          number,
        ][])
          made[res] = (made[res] ?? 0) + n;
        if (runs === 0) explain(ctx, b, 'shaded: more from each run');
      }
      if (recipe.heatToNeighborStorage > 0) {
        const well = neighborBuildings(state, b, occ).find(
          (n) => defOf(content, n).storage?.holds === 'heat' && room(n) > 0,
        );
        if (well)
          setStored(well, (well.stored ?? 0) + Math.min(recipe.heatToNeighborStorage, room(well)));
      }
      byRecipe[recipe.id] = (byRecipe[recipe.id] ?? 0) + 1;
      runs++;
    }
    const factor = content.rules.flexibleOutputFactor;
    for (const [res, n] of Object.entries(made) as [keyof typeof state.stores, number][]) {
      addYield(ctx, b, res, Math.floor(n * factor));
    }
    if (factor !== 1 && runs > 0) explain(ctx, b, `outputs × ${factor}`);
    if (millRace && runs > 0) explain(ctx, b, 'runs need no energy (Mill Race)');
    report.runs[b.uid] = { recipe: recipeId, runs, energy: used, byRecipe };
    const which = Object.entries(byRecipe)
      .map(([id, n]) => `${n} ${id}`)
      .join(' and ');
    explain(
      ctx,
      b,
      `${runs > 0 ? which : `0 ${recipeId}`} runs using ${used.day} day and ${used.night} night energy`,
    );
  }

  // Storage charges from whatever is still spare: free heat first, then energy.
  for (const b of storages) {
    for (const slot of storageDef(b).chargesFrom) {
      if (storageDef(b).holds === 'heat') {
        const heat = Math.min(spareNear(b, slot), room(b));
        takeSpare(b, slot, heat);
        setStored(b, (b.stored ?? 0) + heat);
        spareHeat[slot] -= heat;
        report.energy[slot].heat.stored += heat;
        if (!gridHeat) {
          // Energy becomes heat only through a pump.
          const pumped = pumpInto(b, slot, room(b), 'wellsCharged');
          setStored(b, (b.stored ?? 0) + pumped);
          report.energy[slot].heat.stored += pumped;
          continue;
        }
      }
      const amount = Math.min(spare[slot], room(b));
      if (amount > 0) charge(b, slot, amount);
    }
  }

  // Blackouts: shut buildings off, lowest priority first, until demand fits. Demand
  // is worked out again after each one, since heat pumps save less as heat demand falls.
  // A building shut off by day stays off at night.
  const off = new Set<string>();
  // Without grid heat, a building whose heat no source paid is cold: shut off first.
  if (!gridHeat) {
    for (const slot of SLOTS) {
      for (const b of active) {
        const n = directLeft[slot].get(b.uid) ?? 0;
        if (n <= 0) continue;
        report.energy[slot].heat.cold += n;
        if (off.has(b.uid)) continue;
        off.add(b.uid);
        report.blackouts.push(b.uid);
        report.cold.push(b.uid);
        explain(ctx, b, `cold: shut off, no heat source reaches it by ${slot}`);
      }
    }
  }
  // Without grid cooling, a building nothing cooled is hot: shut off first, as a cold one.
  if (!cooling.gridCool) {
    for (const slot of SLOTS) {
      for (const [uid, n] of coolLeft[slot]) {
        report.energy[slot].cool!.hot += n;
        if (off.has(uid)) continue;
        off.add(uid);
        report.blackouts.push(uid);
        (report.hot ??= []).push(uid);
        explain(ctx, state.buildings[uid]!, `hot: shut off, nothing cools it by ${slot}`);
      }
    }
  }
  for (const slot of SLOTS) {
    const r = report.energy[slot];
    r.shortfall = short[slot];
    r.unused = spare[slot];
    r.heat.unused = spareHeat[slot];
    if (short[slot] === 0) continue;
    // Energy to pay the slot's demand: heat the wells paid homes straight from their store is none.
    const available = r.supply + r.storageDischarged - (r.heat.fromWells ?? 0);
    let gap = settle(slot, off).demand - available;
    for (const b of [...active].reverse()) {
      if (gap <= 0) break;
      // Shutting off a building whose neighbours pay all its heat saves nothing.
      if (off.has(b.uid) || energyOf(b, slot) + owedOf(b, slot) === 0) continue;
      off.add(b.uid);
      report.blackouts.push(b.uid);
      gap = settle(slot, off).demand - available;
      explain(ctx, b, `shut off in the ${slot} blackout`);
    }
  }
  for (const b of active) if (!off.has(b.uid)) ctx.powered.add(b.uid);
  // What each building needed of energy, heat and cooling, and got: all of it while it is on
  // (the grid, or a source, paid the rest), none once it is shut off.
  for (const b of active) {
    const on = !off.has(b.uid);
    const total = (of: (b: BuildingState, slot: Slot) => number) =>
      SLOTS.reduce((n, slot) => n + of(b, slot), 0);
    const amounts = {
      dayEnergy: ownEnergyOf(b, 'day'),
      nightEnergy: ownEnergyOf(b, 'night'),
      heat: total(heatOf),
      cooling: total((x, slot) => coolNeed(content, state, x, slot, si)),
    } as const;
    for (const [kind, need] of Object.entries(amounts) as [keyof typeof amounts, number][])
      if (need > 0) (report.needs[b.uid] ??= {})[kind] = { got: on ? need : 0, need };
  }
  // Water, as the water step shared it out.
  for (const [uid, use] of Object.entries(report.water?.uses ?? {})) {
    if (use.need <= 0) continue;
    const got = Object.values(use.got).reduce((n, x) => n + x, 0);
    (report.needs[uid] ??= {}).water = { got: Math.min(got, use.need), need: use.need };
  }
  // The grid's cooling, for the buildings it kept on.
  if (cooling.gridCool)
    for (const slot of SLOTS)
      for (const [uid, n] of coolLeft[slot]) {
        if (off.has(uid)) continue;
        const r = report.energy[slot].cool!;
        r.grid += n;
        r.gridEnergy += n * cooling.gridCoolCost;
        explain(
          ctx,
          state.buildings[uid]!,
          `${slot}: ${n} cooling from the grid (${n * cooling.gridCoolCost} energy)`,
        );
      }

  // With local heat on, who heated whom: free heat and pumps for the buildings still on, the
  // wells' heat, and the rest from the grid.
  if (local.enabled) {
    const links: HeatLink[] = [];
    for (const slot of SLOTS) {
      const s = settle(slot, off, links);
      for (const l of wellLinks.filter((w) => w.slot === slot && s.left.has(w.to))) {
        const t = Math.min(l.amount, s.left.get(l.to)!);
        if (t <= 0) continue;
        s.left.set(l.to, s.left.get(l.to)! - t);
        links.push({ ...l, amount: t });
      }
      if (gridHeat)
        for (const [uid, n] of s.left)
          if (n > 0) links.push({ slot, from: 'grid', to: uid, amount: n });
      links.push(...neighborLinks.filter((l) => l.slot === slot && !off.has(l.to)));
    }
    report.heat = links;
  }
}
