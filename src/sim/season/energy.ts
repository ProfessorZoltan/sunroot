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
 * Storage first reserves the spare day energy (or free heat) it needs to cover
 * a night shortfall it can already see (covering demand is a need, not a
 * spare); flexible consumers then use what is spare; storage then charges from
 * what is still spare; demand is paid, storage discharges into shortfalls and
 * any gap left becomes a blackout, shutting buildings off lowest priority first.
 */
import type { Resource, Slot } from '../content/schema';
import { AUTO_RECIPE, SLOTS } from '../content/schema';
import { hexDistance } from '../hex';
import { byPriority, defOf, neighborBuildings, neighborTiles, occupancy } from '../queries';
import type { BuildingState, HeatLink } from '../types';
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
  const active = byPriority(state).filter((b) => ctx.active.has(b.uid));

  const energyOf = (b: BuildingState, slot: Slot) =>
    defOf(content, b).demand?.energy[slot][si] ?? 0;
  const heatOf = (b: BuildingState, slot: Slot) => defOf(content, b).demand?.heat[slot][si] ?? 0;
  const pumps = active.filter((b) => defOf(content, b).heatPump);
  const freeHeat = perSlot();
  for (const slot of SLOTS) {
    freeHeat[slot] = Object.values(report.energy[slot].heat.bySource).reduce((a, b) => a + b, 0);
  }

  // Demolition work this season: demand that can't be shut off.
  const demolition = perSlot();
  demolition[content.rules.demolition.slot] = ctx.demolitions * content.rules.demolition.energy;

  // Local heat: a source reaches the buildings within its range (unlimited with it off).
  const local = content.rules.localHeat;
  const range = local.enabled ? local.range : Infinity;
  /** Energy per heat paid from the grid: 1, unless local heat makes the grid's heat dear. */
  const gridCost = local.enabled ? local.gridHeatCost : 1;
  const near = (a: BuildingState, b: BuildingState) =>
    range === Infinity || hexDistance(a.at, b.at) <= range;
  const rank = new Map(active.map((b, i) => [b.uid, i]));
  /** Nearest to `to` first, ties (and everything, with no range) by priority. */
  const nearestTo = (to: BuildingState) => (x: BuildingState, y: BuildingState) =>
    (range === Infinity ? 0 : hexDistance(x.at, to.at) - hexDistance(y.at, to.at)) ||
    rank.get(x.uid)! - rank.get(y.uid)!;
  const collectors = active.filter((b) => defOf(content, b).heatGeneration);
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
    for (const b of active) {
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
          if (k === 1) n.stored = (n.stored ?? 0) - t;
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
  const freeOf = (b: BuildingState, slot: Slot) => report.generated[b.uid]?.heat[slot] ?? 0;

  /** What the buildings that are still on need in a slot. `links` records who heated whom. */
  const settle = (slot: Slot, off: Set<string>, links?: HeatLink[]): Settlement => {
    const on = active.filter((b) => !off.has(b.uid));
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
    for (const b of consumers) {
      for (const c of collectors.filter((x) => near(x, b)).sort(nearestTo(b))) {
        const t = Math.min(left.get(b.uid)!, freeLeft.get(c.uid)!);
        if (t <= 0) continue;
        freeLeft.set(c.uid, freeLeft.get(c.uid)! - t);
        free += t;
        pay(c, b, t);
      }
    }
    // Heat pumps: each pays for the buildings within reach, in whole energy's worth.
    let pumped = 0;
    let pumpEnergy = 0;
    const byPump: Settlement['byPump'] = {};
    for (const p of pumps) {
      const hp = defOf(content, p).heatPump!;
      const reach = consumers.filter((b) => near(p, b)).sort(nearestTo(p));
      const owed = reach.reduce((sum, b) => sum + left.get(b.uid)!, 0);
      const units = Math.min(
        Math.floor(owed / hp.heatPerEnergy),
        Math.floor(hp.maxHeatPerSlot / hp.heatPerEnergy),
      );
      if (units === 0) continue;
      byPump[p.uid] = { heat: units * hp.heatPerEnergy, energy: units };
      pumped += units * hp.heatPerEnergy;
      pumpEnergy += units;
      let paying = units * hp.heatPerEnergy;
      for (const b of reach) {
        const t = Math.min(paying, left.get(b.uid)!);
        paying -= t;
        pay(p, b, t);
      }
    }
    const direct = [...left.values()].reduce((a, b) => a + b, 0);
    return {
      demand: energy + direct * gridCost + pumpEnergy,
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
    for (const b of active) {
      const d = energyOf(b, slot) + heatOf(b, slot);
      if (d > 0) r.demandBy[b.type] = (r.demandBy[b.type] ?? 0) + d;
    }
    if (demolition[slot] > 0) r.demandBy.demolition = demolition[slot];
    Object.assign(r.heat, {
      demand: s.heat,
      free: s.free,
      pumped: s.pumped,
      pumpEnergy: s.pumpEnergy,
      direct: s.direct,
      gridLoss: s.direct * (gridCost - 1),
    });
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
    active
      .filter((b) => directLeft[slot].has(b.uid) && near(well, b))
      .reduce((sum, b) => sum + directLeft[slot].get(b.uid)!, 0);
  /** A heat well pays `amount` of the heat owed by the buildings it reaches, nearest first. */
  const payFromWell = (well: BuildingState, slot: Slot, amount: number) => {
    let paying = amount;
    for (const b of active
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

  const storages = active.filter((b) => defOf(content, b).storage);
  const storageDef = (b: BuildingState) => defOf(content, b).storage!;
  const room = (b: BuildingState) => storageDef(b).capacity - (b.stored ?? 0);
  const discharge = (slot: Slot, amount: number) => {
    short[slot] -= amount;
    report.energy[slot].storageDischarged += amount;
  };
  const charge = (b: BuildingState, slot: Slot, amount: number) => {
    b.stored = (b.stored ?? 0) + amount;
    spare[slot] -= amount;
    report.energy[slot].storageCharged += amount;
  };
  /** Delivers up to `want` from an energy store, spending stored energy at its return ratio. */
  const drawEnergy = (b: BuildingState, want: number): number => {
    const { numerator, denominator } = storageDef(b).returns;
    const deliverable = Math.floor(((b.stored ?? 0) * numerator) / denominator);
    const give = Math.min(want, deliverable);
    b.stored = (b.stored ?? 0) - Math.ceil((give * denominator) / numerator);
    return give;
  };

  // Stored heat and energy from earlier seasons cover shortfalls first.
  for (const slot of SLOTS) {
    for (const b of storages) {
      if (short[slot] === 0) break;
      const s = storageDef(b);
      if (s.holds === 'heat') {
        // Each heat a well pays saves the grid `gridCost` energy.
        const give = Math.min(Math.ceil(short[slot] / gridCost), reachable(b, slot), b.stored ?? 0);
        b.stored = (b.stored ?? 0) - give;
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
  for (const b of heatFirst) {
    if (short.night === 0 || spare.day + spareHeat.day === 0) break;
    const s = storageDef(b);
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
        b.stored! -= give - fromHeat;
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
    const maxRuns = def.recipes.maxRuns + (state.year === 1 ? def.recipes.firstYearExtraRuns : 0);
    while (runs < maxRuns + def.recipes.nightOnlyRuns) {
      const has = (needs: Partial<Record<Resource, number>>) =>
        Object.entries(needs).every(([res, n]) => state.stores[res as Resource] >= n);
      const recipe = choices.find(
        (o) => has(o.inputs) && (recipeId !== AUTO_RECIPE || has(o.autoAtLeast)),
      );
      if (!recipe) break;
      const inputs = Object.entries(recipe.inputs) as [keyof typeof state.stores, number][];
      const slots: readonly Slot[] = runs < maxRuns ? SLOTS : ['night'];
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
          well.stored = (well.stored ?? 0) + Math.min(recipe.heatToNeighborStorage, room(well));
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
        b.stored = (b.stored ?? 0) + heat;
        spareHeat[slot] -= heat;
        report.energy[slot].heat.stored += heat;
      }
      const amount = Math.min(spare[slot], room(b));
      if (amount > 0) charge(b, slot, amount);
    }
  }

  // Blackouts: shut buildings off, lowest priority first, until demand fits. Demand
  // is worked out again after each one, since heat pumps save less as heat demand falls.
  // A building shut off by day stays off at night.
  const off = new Set<string>();
  for (const slot of SLOTS) {
    const r = report.energy[slot];
    r.shortfall = short[slot];
    r.unused = spare[slot];
    r.heat.unused = spareHeat[slot];
    if (short[slot] === 0) continue;
    const available = r.supply + r.storageDischarged;
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
      for (const [uid, n] of s.left)
        if (n > 0) links.push({ slot, from: 'grid', to: uid, amount: n });
      links.push(...neighborLinks.filter((l) => l.slot === slot && !off.has(l.to)));
    }
    report.heat = links;
  }
}
