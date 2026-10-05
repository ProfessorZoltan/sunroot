/** Steps 8 and 9: food, population, wellbeing, then scraps, clutter and Harmony. */
import {
  byPriority,
  computeHarmony,
  defOf,
  foodStorage,
  harmonyMultiplier,
  housingCapacity,
  isHome,
  neighborBuildings,
  neighborTiles,
} from '../queries';
import type { PopulationReason, WellbeingLine } from '../types';
import { formationWellbeing } from '../combos';
import { finishedProjects } from '../projects';
import { flow, type SeasonContext } from './context';
import { festivalWellbeing, wildlifeWellbeing } from '../wildlife';

export function feedAndGrow(ctx: SeasonContext): void {
  const { content, state, report } = ctx;
  const rules = content.rules;

  // Food is eaten.
  const need = state.citizens * rules.foodPerCitizen;
  const eaten = Math.min(state.stores.food, need);
  state.stores.food -= eaten;
  flow(report.flows, 'food', 'used', 'Citizens eat', eaten);
  const unfed = rules.foodPerCitizen > 0 ? Math.ceil((need - eaten) / rules.foodPerCitizen) : 0;
  const spareFood = ctx.foodProduced - need;

  // Population grows or shrinks, using wellbeing as it stood this season.
  const pop = rules.population;
  const before = state.citizens;
  const free = housingCapacity(content, state) - state.citizens;
  let change = 0;
  let reason: PopulationReason;
  if (state.wellbeing < pop.leaveBelow) {
    change = -Math.min(pop.leaving, state.citizens);
    reason = 'leaving';
  } else if (state.wellbeing < pop.growAt) {
    reason = 'lowWellbeing';
  } else if (spareFood < pop.minSpareFood) {
    reason = 'lowSpareFood';
  } else if (free <= 0) {
    reason = 'noHousing';
  } else {
    const boom = state.wellbeing >= pop.boomAt;
    change = Math.min(boom ? pop.boomGrowth : pop.growth, free);
    reason = boom && change > 1 ? 'boom' : 'grew';
  }
  state.citizens += change;

  // Cider presses turn spare food from neighbouring producers into wellbeing.
  const cider: WellbeingLine[] = [];
  for (const b of byPriority(state)) {
    const press = defOf(content, b).cider;
    if (!press || !ctx.active.has(b.uid)) continue;
    const bearing = neighborBuildings(state, b).filter(
      (n) => press.nextTo.includes(n.type) && (report.yields[n.uid]?.food ?? 0) > 0,
    ).length;
    const n = Math.min(press.max, bearing, Math.floor(state.stores.food / press.foodEach));
    if (n <= 0) continue;
    state.stores.food -= n * press.foodEach;
    flow(report.flows, 'food', 'used', defOf(content, b).name, n * press.foodEach, b.uid);
    cider.push({
      kind: 'civic',
      reason: `${defOf(content, b).name}: ${n * press.foodEach} spare food`,
      amount: n * press.wellbeingEach,
    });
  }

  // Food beyond storage rots into scraps.
  const storage = foodStorage(content, state);
  // A powered smokehouse keeps what the larders can't hold (the coast).
  const kept = Object.values(state.buildings).some(
    (b) => defOf(content, b).stopsRot && ctx.powered.has(b.uid),
  );
  const over = Math.max(0, state.stores.food - storage);
  // With the Water Market, food beyond storage keeps a season: only what was already beyond
  // storage last season rots, and the rest is held over.
  const keeps = rules.surplusKeeps && !kept;
  const rotted = kept ? 0 : keeps ? Math.min(over, state.heldOver ?? 0) : over;
  if (keeps) state.heldOver = over - rotted;
  else delete state.heldOver;
  state.stores.food -= rotted;
  flow(report.flows, 'food', 'used', 'Rotted (beyond storage)', rotted);
  if (rules.rotsInto === 'biomass') {
    state.stores.biomass += rotted;
    flow(report.flows, 'biomass', 'made', 'Rotted food', rotted);
  }

  report.food = { produced: ctx.foodProduced, eaten, unfed, rotted, storage };
  report.population = { before, change, after: state.citizens, reason };

  // Wellbeing updates.
  const wb = rules.wellbeing;
  const lines: WellbeingLine[] = [];
  const buildings = Object.values(state.buildings);
  // A damaged home is as cold and dark as an unpowered one, but for its own reason.
  const homes = buildings.filter((b) => isHome(defOf(content, b)));
  const damagedHomes = homes.filter((b) => b.damage !== undefined).length;
  const unpowered = homes.filter((b) => !b.damage && !ctx.powered.has(b.uid));
  const unpoweredHomes = unpowered.length;
  // Without grid heat, a home no heat source reaches is shut off cold: the same cost, its own name.
  const cold = unpowered.filter((b) => ctx.report.cold.includes(b.uid));
  const coldHomes = cold.length;
  const coldBeds = cold.reduce((n, b) => n + defOf(content, b).housing, 0);
  // Without grid cooling, a home nothing cools is shut off hot: counted as a cold one is.
  const hot = unpowered.filter(
    (b) => !ctx.report.cold.includes(b.uid) && (ctx.report.hot ?? []).includes(b.uid),
  );
  const hotHomes = hot.length;
  const hotBeds = hot.reduce((n, b) => n + defOf(content, b).housing, 0);
  if (unfed === 0 && unpoweredHomes === 0 && damagedHomes === 0) {
    lines.push({ kind: 'needsMet', reason: 'every need met', amount: wb.allNeedsMet });
  }
  if (unfed > 0) {
    lines.push({
      kind: 'hunger',
      reason: `${unfed} unfed citizens`,
      amount: unfed * wb.perUnfedCitizen,
    });
  }
  if (unpoweredHomes - coldHomes - hotHomes > 0) {
    lines.push({
      kind: 'unpowered',
      reason: `${unpoweredHomes - coldHomes - hotHomes} unpowered homes`,
      amount: (unpoweredHomes - coldHomes - hotHomes) * wb.perUnpoweredHome,
    });
  }
  if (hotHomes > 0) {
    lines.push({
      kind: 'unpowered',
      reason: `${hotHomes} hot home${hotHomes > 1 ? 's' : ''}: nothing cools ${hotHomes > 1 ? 'them' : 'it'}`,
      amount: hotHomes * wb.perUnpoweredHome - hotBeds * rules.localHeat.coldPerBed,
    });
  }
  if (coldHomes > 0) {
    lines.push({
      kind: 'unpowered',
      reason: `${coldHomes} cold home${coldHomes > 1 ? 's' : ''}: no heat source reaches ${coldHomes > 1 ? 'them' : 'it'}`,
      amount: coldHomes * wb.perUnpoweredHome - coldBeds * rules.localHeat.coldPerBed,
    });
  }
  if (damagedHomes > 0) {
    lines.push({
      kind: 'damagedHomes',
      reason: `${damagedHomes} damaged home${damagedHomes > 1 ? 's' : ''}`,
      amount: damagedHomes * wb.perUnpoweredHome,
    });
  }
  const commute = report.commute;
  if (commute && commute.wellbeing < 0) {
    lines.push({
      kind: 'commute',
      reason: `long walks to work (${commute.excess} tiles beyond ${content.rules.commute.freeDistance})`,
      amount: commute.wellbeing,
    });
  }
  const toWater = commute?.toWater;
  if (toWater && toWater.wellbeing < 0) {
    lines.push({
      kind: 'commute',
      reason: `long walks to water (${toWater.excess} tiles beyond ${content.rules.commute.toWater!.freeDistance})`,
      amount: toWater.wellbeing,
    });
  }
  const clutterSteps = Math.floor(state.stores.clutter / wb.clutterStep);
  if (clutterSteps > 0) {
    lines.push({
      kind: 'clutter',
      reason: `${state.stores.clutter} clutter`,
      amount: clutterSteps * wb.perClutterStep,
    });
  }
  for (const b of buildings) {
    const def = defOf(content, b);
    const near = def.wellbeing?.nextToTiles;
    if (near && !b.damage && neighborTiles(state, b.at).some((t) => near.tiles.includes(t.type))) {
      lines.push({
        kind: 'greenery',
        reason: `${def.name} next to ${near.tiles.join(' or ')}`,
        amount: near.amount,
      });
    }
    const always = def.wellbeing?.always ?? 0;
    if (always !== 0 && !b.damage) lines.push({ kind: 'civic', reason: def.name, amount: always });
    let whenPowered = def.wellbeing?.whenPowered ?? 0;
    // Short of water (a Bathhouse with none), it does what it can.
    const dry = ctx.report.water?.uses[b.uid]?.short === true;
    if (dry) whenPowered = Math.floor(whenPowered * rules.water.shortfallFactor);
    if (whenPowered !== 0 && ctx.powered.has(b.uid)) {
      lines.push({
        kind: 'civic',
        reason: `powered ${def.name}${dry ? ', short of water' : ''}`,
        amount: whenPowered,
      });
    }
  }
  lines.push(...cider);
  // Rising expectations: from a later era, citizens beyond what civic life serves cost wellbeing.
  const ex = rules.expectations;
  if (ex && state.era >= ex.fromEra) {
    let served = ex.base;
    for (const b of buildings)
      if (ctx.active.has(b.uid) && !b.damage) served += ex.perBuilding[b.type] ?? 0;
    const unserved = state.citizens - served;
    if (unserved > 0) {
      lines.push({
        kind: 'expectations',
        reason: `${unserved} citizens beyond what civic life serves (${served})`,
        amount: -Math.ceil(unserved / ex.perUnserved),
      });
    }
  }
  for (const p of finishedProjects(content, state)) {
    if (p.effect.wellbeing !== 0)
      lines.push({ kind: 'civic', reason: p.name, amount: p.effect.wellbeing });
  }
  for (const f of formationWellbeing(ctx)) {
    lines.push({ kind: 'formation', reason: f.reason, amount: f.amount });
  }
  lines.push(...wildlifeWellbeing(ctx), ...festivalWellbeing(ctx));
  if (wb.nightPowered !== 0 && report.energy.night.shortfall === 0) {
    lines.push({ kind: 'charter', reason: 'the night market', amount: wb.nightPowered });
  }
  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  const wellbeingBefore = state.wellbeing;
  state.wellbeing = Math.max(wb.min, Math.min(wb.max, state.wellbeing + total));
  report.wellbeing = { before: wellbeingBefore, after: state.wellbeing, lines };
}

/** Scraps left unprocessed from last season become clutter; people (and rot, if set) make new scraps. */
export function scrapsAndHarmony(ctx: SeasonContext): void {
  const { content, state, report } = ctx;
  const fromScraps = state.stores.scraps;
  state.stores.clutter += fromScraps;
  flow(report.flows, 'scraps', 'used', 'Left over: became clutter', fromScraps);
  flow(report.flows, 'clutter', 'made', 'Scraps left over', fromScraps);
  const fromCitizens = Math.floor(state.citizens / content.rules.citizensPerScrap);
  const fromRot = content.rules.rotsInto === 'scraps' ? report.food.rotted : 0;
  state.stores.scraps = fromCitizens + fromRot;
  flow(report.flows, 'scraps', 'made', 'Citizens', fromCitizens);
  flow(report.flows, 'scraps', 'made', 'Rotted food', fromRot);
  report.clutter = { ...report.clutter, fromScraps, total: state.stores.clutter };
  report.scraps = { fromCitizens, fromRot, total: state.stores.scraps };
  state.harmony = computeHarmony(content, state);
  report.harmony = { value: state.harmony, multiplier: harmonyMultiplier(content, state.harmony) };
}
