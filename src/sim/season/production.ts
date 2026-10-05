/** Step 4: staffing, generation and production. */
import type { BuildingDef, Resource, Slot } from '../content/schema';
import { RESOURCES, SLOTS } from '../content/schema';
import { hexDistance, hexKey, hexNeighbors } from '../hex';
import {
  byPriority,
  defOf,
  harmonyMultiplier,
  heightAt,
  improveTile,
  neighborBuildings,
  neighborTiles,
  occupancy,
  tileAt,
  waterDistance,
} from '../queries';
import type { BuildingState } from '../types';
import { addHeat, addSupply, addYield, explain, flow, type SeasonContext } from './context';
import { festivalThisSeason } from '../wildlife';
import { hedged } from '../edges';
import { wonderDone } from '../wonder';

const EPSILON = 1e-9;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Assigns citizens as workers in priority order. Damaged buildings don't operate. */
export function staff(ctx: SeasonContext): void {
  let workers = ctx.state.citizens;
  for (const b of byPriority(ctx.state)) {
    if (b.damage) continue;
    // Resting this season (Siesta's summer): no work, no workers.
    if (defOf(ctx.content, b).restsIn[ctx.si]) {
      explain(ctx, b, `rests this ${ctx.state.season}`);
      continue;
    }
    // A wonder does nothing until it is finished.
    if (!wonderDone(ctx.content, ctx.state, b)) continue;
    const need = defOf(ctx.content, b).workers;
    if (need > workers) {
      ctx.report.unstaffed.push(b.uid);
      continue;
    }
    workers -= need;
    ctx.active.add(b.uid);
  }
}

function activeInOrder(ctx: SeasonContext): BuildingState[] {
  return byPriority(ctx.state).filter((b) => ctx.active.has(b.uid));
}

/**
 * Generators: the camp, solar, wheels and spires, plus free heat from solar
 * thermal collectors (digesters run later, on their inputs).
 */
export function generate(ctx: SeasonContext): void {
  const { content, state, si } = ctx;
  const occ = occupancy(state);
  for (const b of activeInOrder(ctx)) {
    const def = defOf(content, b);
    // A source may make energy and heat both (the Concentrated Solar Plant's mirrors).
    const outputs = [
      ...(def.generation ? [{ output: def.generation, makesHeat: false }] : []),
      ...(def.heatGeneration ? [{ output: def.heatGeneration, makesHeat: true }] : []),
    ];
    if (outputs.length === 0) continue;
    const runsNow = (slot: Slot) => outputs.some((o) => o.output[slot][si]! > 0);
    const neighbors = neighborBuildings(state, b, occ);
    let adjust = 0;
    const notes: string[] = [];
    const effect = ctx.effects.get(b.uid);
    /** A formation's extra, in the slots it comes in (to energy, for a source making both). */
    const formed = (slot: Slot, makesHeat: boolean) =>
      effect?.generation && effect.generationSlots.includes(slot) && !(makesHeat && def.generation)
        ? effect.generation
        : 0;
    if (effect?.generation) {
      const when = effect.generationSlots.length === 1 ? ` by ${effect.generationSlots[0]}` : '';
      notes.push(`in a formation +${effect.generation}${when}`);
    }
    const boost = festivalThisSeason(content, state)?.boosts;
    if (boost && boost.generation > 0 && boost.buildings.includes(b.type)) {
      adjust += boost.generation;
      notes.push(`${festivalThisSeason(content, state)!.name} +${boost.generation}`);
    }
    if (def.shading && !effect?.ignoresShade) {
      const casters = [
        ...neighbors.filter((n) => defOf(content, n).tall).map((n) => hexKey(n.at)),
        ...neighborTiles(state, b.at)
          .filter((t) => t.type === 'woodland')
          .map((t) => hexKey(t)),
      ];
      if (casters.length > 0) {
        ctx.report.shaded[b.uid] = [...new Set(casters)];
        adjust -= def.shading.penaltyPerSlot;
        notes.push(`shaded by a tall neighbour -${def.shading.penaltyPerSlot}`);
      }
    }
    const on = def.generationOnTiles;
    if (on && on.tiles.includes(tileAt(state, b.at)?.type as never)) {
      adjust += on.add;
      notes.push(`on ${tileAt(state, b.at)!.type} +${on.add}`);
    }
    // The Highland: more wind up high; snow on the panels up high.
    const high = heightAt(state, b.at);
    const up = def.generationAtHeight;
    if (up && high >= up.from) {
      adjust += up.add;
      notes.push(`at height ${high} +${up.add}`);
    }
    const snow = def.idleAtHeight;
    const snowed = snow !== undefined && high >= snow.from && snow.seasons.includes(state.season);
    // A snow fence beside it keeps the drift off: it still makes a little by day.
    const kept =
      snowed && snow.keepsBesideEdge > 0 && hedged(state, b.at) ? snow.keepsBesideEdge : 0;
    if (kept > 0)
      notes.push(`under snow at height ${high}, but a fence keeps the drift off: ${kept} by day`);
    else if (snowed) notes.push(`under snow at height ${high}: nothing this ${state.season}`);
    // A stove burns its fuel (a bothy's biomass) in a season it makes any heat.
    let unfuelled = false;
    const fuel = def.heatGeneration ? def.heatFuel : undefined;
    if (fuel && SLOTS.some(runsNow)) {
      const free = neighbors.find((n) => fuel.freeNextTo.includes(n.type));
      if (free)
        notes.push(`next to a ${defOf(content, free).name}: its stove needs no ${fuel.resource}`);
      else if (fuel.amount > 0 && state.stores[fuel.resource] >= fuel.amount) {
        state.stores[fuel.resource] -= fuel.amount;
        flow(ctx.report.flows, fuel.resource, 'used', def.name, fuel.amount, b.uid);
        notes.push(`its stove burned ${fuel.amount} ${fuel.resource}`);
      } else if (fuel.amount > 0) {
        unfuelled = true;
        notes.push(`no ${fuel.resource} for its stove: no heat`);
      }
    }
    // Sea fog dims the sun.
    const fog = ctx.fog ? (content.events.fog?.solarPenalty ?? 0) : 0;
    if (def.fogged && fog > 0) {
      adjust -= fog;
      notes.push(`sea fog -${fog}`);
    }
    // Dust on the panels and mirrors (the Sun Desert's dust storm).
    const dust =
      ctx.report.event === 'storm' && def.fogged ? (content.events.storm?.solarPenalty ?? 0) : 0;
    if (dust > 0) {
      adjust -= dust;
      notes.push(`dust storm -${dust}`);
    }
    // A heatwave: too hot to work well, by day.
    const hot =
      ctx.report.event === 'heatwave' && def.heatDimmed
        ? (content.events.heatwave?.solarPenalty ?? 0)
        : 0;
    if (hot > 0) notes.push(`heatwave -${hot} by day`);
    if (def.weirBonus && neighbors.some((n) => defOf(content, n).weir)) {
      adjust += def.weirBonus.perSlot;
      notes.push(`next to a weir +${def.weirBonus.perSlot}`);
    }
    if (def.spacing) {
      const crowd = Object.values(state.buildings).filter(
        (o) =>
          o.uid !== b.uid && o.type === b.type && hexDistance(o.at, b.at) <= def.spacing!.radius,
      ).length;
      if (crowd > 0) {
        adjust -= crowd * def.spacing.penaltyPerSlot;
        notes.push(`${crowd} other ${def.name} within ${def.spacing.radius} tiles`);
      }
    }
    // While the water system is on, a river wheel turns with the flow beside it.
    const wheel = ctx.wheelFlow.get(b.uid);
    if (wheel !== undefined)
      notes.unshift(
        `river flow ${wheel}: ${Math.ceil(wheel / content.rules.water.wheelFlowPerEnergy)} a slot`,
      );
    for (const { output, makesHeat } of outputs)
      for (const slot of SLOTS) {
        const base =
          wheel !== undefined
            ? Math.ceil(wheel / content.rules.water.wheelFlowPerEnergy)
            : output[slot][si]!;
        const change = adjust - (slot === 'day' ? hot : 0) + formed(slot, makesHeat);
        // Adjustments apply only to slots where the source runs at all.
        let amount = base > 0 && !snowed && !unfuelled ? Math.max(0, base + change) : 0;
        if (kept > 0 && slot === 'day' && base > 0)
          amount = Math.min(kept, Math.max(0, base + change));
        if (makesHeat) addHeat(ctx, slot, b, amount);
        else addSupply(ctx, slot, b, amount);
        const what = makesHeat ? 'heat' : 'energy';
        explain(
          ctx,
          b,
          `${slot} ${what} ${base}${change ? ` ${change > 0 ? '+' : ''}${change}` : ''} = ${amount}`,
        );
      }
    notes.forEach((n) => explain(ctx, b, n));
  }
}

function isDownstreamOfWeir(ctx: SeasonContext, b: BuildingState): boolean {
  const { content, state } = ctx;
  const weirIndexes = Object.values(state.buildings)
    .filter((w) => defOf(content, w).weir)
    .map((w) => tileAt(state, w.at)?.riverIndex ?? Infinity);
  if (weirIndexes.length === 0) return false;
  const touching = neighborTiles(state, b.at)
    .map((t) => t.riverIndex)
    .filter((i): i is number => i !== undefined);
  return touching.some((i) => weirIndexes.some((w) => i > w));
}

/** The weir's downstream penalty, if any weir names this building type. */
function downstreamPenalty(ctx: SeasonContext, def: BuildingDef): number {
  for (const w of ctx.content.buildings) {
    if (w.weir && w.weir.downstreamFoodPenalty.targets.includes(def.id)) {
      return w.weir.downstreamFoodPenalty.amount;
    }
  }
  return 0;
}

/**
 * The coast's king tide: once a farm's salt has cleared, up to and including the next spring's
 * harvest (which grows before the next tide), a farm on the tiles it names makes this much more
 * food (DECISIONS.md, The Windswept Coast).
 */
function saltAfter(ctx: SeasonContext, b: BuildingState): number {
  const salt = ctx.content.events.flood?.salt;
  if (!salt || !defOf(ctx.content, b).farmland) return 0;
  // This season's harvest grew before this season's tide: it counts the salt before it.
  const last = b.saltTurn === ctx.state.turn ? b.saltBefore : b.saltTurn;
  if (last === undefined) return 0;
  const since = ctx.state.turn - last;
  if (since <= salt.seasons || since > 4) return 0;
  return salt.bonusOn.includes(tileAt(ctx.state, b.at)!.type) ? salt.bonus : 0;
}

/**
 * A building's yield of one resource before flat neighbour bonuses:
 * base (with tile modifier) x multipliers, rounded down, then flat penalties.
 */
export function computeYield(ctx: SeasonContext, b: BuildingState, res: Resource): number {
  const { content, state, si } = ctx;
  const def = defOf(content, b);
  const perSeason = def.yields[res];
  if (!perSeason) return 0;
  let base = perSeason[si]!;
  // Once the king tide's salt clears, a croft on saltmarsh makes more, even in winter.
  const after = res === 'food' ? saltAfter(ctx, b) : 0;
  if (base === 0) {
    if (after > 0) explain(ctx, b, `${cap(res)}: +${after} on saltmarsh the salt has left`);
    return after;
  }
  const age = state.turn - b.builtTurn;
  if (age < def.maturesAfterSeasons) {
    explain(ctx, b, `${res}: still growing (${age}/${def.maturesAfterSeasons} seasons)`);
    return 0;
  }
  const lines = [`${cap(res)}: ${base} in ${state.season}`];
  const tile = tileAt(state, b.at)!;
  if (res === 'food') {
    const mod = def.tileFoodModifier[tile.type] ?? 0;
    if (mod !== 0) {
      base = Math.max(0, base + mod);
      lines.push(`${mod > 0 ? '+' : '−'}${Math.abs(mod)} on ${tile.type}`);
    }
    // Biochar (the Highland): a charred tile keeps a farm 1 better, for good.
    if (def.farmland && tile.charred) {
      base += 1;
      lines.push('+1 biochar');
    }
    // High pasture: a shieling among meadows.
    const pasture = def.nextToTilesFood;
    if (pasture?.seasons[ctx.si]) {
      const n = neighborTiles(state, b.at).filter(
        (t) => !t.silted && pasture.tiles.includes(t.type),
      ).length;
      if (n >= pasture.count) {
        base += pasture.amount;
        lines.push(`+${pasture.amount} next to ${n} ${pasture.tiles.join(' or ')}`);
      }
    }
    // A festival for these farms (Shieling Day).
    const festival = festivalThisSeason(content, state);
    const boost = festival?.boosts;
    if (boost && boost.food > 0 && boost.buildings.includes(b.type)) {
      base += boost.food;
      lines.push(`+${boost.food} ${festival!.name}`);
    }
  }
  let multiplier = 1;
  if (res === 'food' && def.farmland) {
    const flood = content.events.flood;
    if (flood && b.siltYear === state.year && flood.siltSeasons.includes(state.season)) {
      const silt = 1 + flood.siltBonus * (b.siltShare ?? 1);
      multiplier *= silt;
      lines.push(`× ${silt} silt`);
    }
    const salt = flood?.salt;
    const since = b.saltTurn === undefined ? -1 : state.turn - b.saltTurn;
    if (salt && since >= 1 && since <= salt.seasons) {
      multiplier *= salt.factor;
      lines.push(`× ${salt.factor} salted by the ${flood!.name.toLowerCase()}`);
    }
    const low = content.events.lowRiver;
    // With the water system on, water replaces the low river's "far from water" rule.
    if (
      low &&
      !ctx.report.water &&
      ctx.lowRiver &&
      !def.ignoresLowRiver &&
      waterDistance(content, state, b.at) > low.farFromWaterDistance
    ) {
      multiplier *= low.farYieldFactor;
      lines.push(`× ${low.farYieldFactor} low river, far from water`);
      if (!ctx.report.dried.includes(b.uid)) ctx.report.dried.push(b.uid);
    }
  }
  const water = ctx.report.water?.uses[b.uid];
  if (water?.short) {
    multiplier *= content.rules.water.shortfallFactor;
    lines.push(`× ${content.rules.water.shortfallFactor} short of water`);
  }
  if (content.rules.harmony.multiplies.includes(res)) {
    const h = harmonyMultiplier(content, state.harmony);
    multiplier *= h;
    if (h !== 1) lines.push(`× ${h} Harmony`);
  }
  let value = Math.floor(base * multiplier + EPSILON);
  if (after > 0) {
    value += after;
    lines.push(`+${after} on saltmarsh the salt has left`);
  }
  if (res === 'food') {
    const penalty = downstreamPenalty(ctx, def);
    if (penalty > 0 && isDownstreamOfWeir(ctx, b)) {
      value = Math.max(0, value - penalty);
      lines.push(`−${penalty} downstream of a weir`);
    }
  }
  // A late frost struck this farm in spring (the Highland): a smaller harvest all year.
  const frost = content.events.flood?.frost;
  if (res === 'food' && frost && b.frostYear === state.year) {
    const loss = frost.loss[ctx.si] ?? 0;
    if (loss > 0 && value > 0) {
      value = Math.max(0, value - loss);
      lines.push(`−${loss} late frost`);
    }
  }
  // An algae bloom (Lake Gardens): fish that feed in the lake are fewer.
  const bloom = content.rules.lake?.bloom;
  if (res === 'food' && def.fishesLake && bloom && ctx.report.lake?.bloom && value > 0) {
    value = Math.max(0, value - bloom.foodLoss);
    lines.push(`−${bloom.foodLoss} algae bloom`);
  }
  const nutrient = def.water?.nutrientBonus[res] ?? 0;
  if (nutrient > 0 && water && water.got.nutrient > 0) {
    value += nutrient;
    lines.push(`+${nutrient} nutrient-rich water`);
  }
  lines.push(`= ${value}`);
  explain(ctx, b, lines.join(' '));
  return value;
}

/** Yields for a set of buildings (all resources), crediting the stores. */
export function yieldFor(ctx: SeasonContext, buildings: BuildingState[]): void {
  const { content, state } = ctx;
  for (const b of buildings) {
    const def = defOf(content, b);
    for (const res of RESOURCES) {
      let amount = computeYield(ctx, b, res);
      if (amount > 0 && res === 'salvage' && def.drawsFromRuin) {
        const tile = tileAt(state, b.at)!;
        const drawn = Math.min(amount, tile.salvage ?? 0);
        tile.salvage = (tile.salvage ?? 0) - drawn;
        amount = Math.floor(drawn * content.rules.ruinSalvageFactor);
        if (amount !== drawn) explain(ctx, b, `${drawn} salvage from the ruin gives ${amount}`);
      }
      addYield(ctx, b, res, amount);
    }
  }
}

export function forage(ctx: SeasonContext): void {
  for (const b of activeInOrder(ctx)) {
    const amount = defOf(ctx.content, b).forage;
    if (amount > 0) {
      ctx.state.stores.materials += amount;
      ctx.report.forage += amount;
      flow(
        ctx.report.flows,
        'materials',
        'made',
        `${defOf(ctx.content, b).name} foraging`,
        amount,
        b.uid,
      );
      explain(ctx, b, `forages ${amount} materials`);
    }
  }
}

/** Tree nurseries improve their least healthy neighbouring tile. */
export function nurture(ctx: SeasonContext): void {
  const { content, state } = ctx;
  const ladder = content.rules.landHealth;
  for (const b of activeInOrder(ctx)) {
    const steps = defOf(content, b).improvesNeighborSteps;
    if (steps === 0) continue;
    const candidates = hexNeighbors(b.at)
      .map((h) => tileAt(state, h))
      .filter((t) => t !== undefined)
      .filter((t) => {
        const at = ladder.indexOf(t.type);
        return at >= 0 && at < ladder.length - 1;
      });
    if (candidates.length === 0) continue;
    const target = candidates.reduce((best, t) =>
      ladder.indexOf(t.type) < ladder.indexOf(best.type) ? t : best,
    );
    const before = target.type;
    improveTile(content, target, steps);
    ctx.report.improvedTiles.push(hexKey(target));
    explain(ctx, b, `improved ${hexKey(target)} from ${before} to ${target.type}`);
  }
}

function takeInputs(
  ctx: SeasonContext,
  b: BuildingState,
  inputs: readonly Resource[],
  max: number,
): number {
  let taken = 0;
  for (const res of inputs) {
    const t = Math.min(max - taken, ctx.state.stores[res]);
    ctx.state.stores[res] -= t;
    flow(ctx.report.flows, res, 'used', defOf(ctx.content, b).name, t, b.uid);
    taken += t;
  }
  return taken;
}

/** Digesters and composters turn scraps (first) and biomass into energy and compost. */
export function convert(ctx: SeasonContext): void {
  const { content, state } = ctx;
  for (const b of activeInOrder(ctx)) {
    const def = defOf(content, b);
    if (def.digester) {
      const d = def.digester;
      const slot = b.slot ?? d.defaultSlot;
      let runs = 0;
      while (
        runs < d.maxRuns &&
        d.inputs.reduce((s, r) => s + state.stores[r], 0) >= d.inputPerRun
      ) {
        takeInputs(ctx, b, d.inputs, d.inputPerRun);
        runs++;
      }
      if (runs > 0) {
        addSupply(ctx, slot, b, runs * d.energyPerRun);
        addYield(ctx, b, 'compost', runs * d.compostPerRun);
      }
      explain(
        ctx,
        b,
        `${runs} runs: ${runs * d.energyPerRun} ${slot} energy, ${runs * d.compostPerRun} compost`,
      );
      // A biochar kiln chars the tile of one farm beside it, for good.
      if (runs > 0 && def.chars) {
        const farm = neighborBuildings(state, b)
          .filter((n) => defOf(content, n).farmland && !tileAt(state, n.at)?.charred)
          .sort((x, y) => state.priority.indexOf(x.uid) - state.priority.indexOf(y.uid))[0];
        if (farm) {
          tileAt(state, farm.at)!.charred = true;
          explain(
            ctx,
            b,
            `charred the ${defOf(content, farm).name}'s land: +1 food there for good`,
          );
        }
      }
    }
    if (def.composter) {
      const c = def.composter;
      const taken = takeInputs(ctx, b, c.inputs, c.maxInput);
      // The Keyhole Garden doubles it.
      const times = ctx.effects.get(b.uid)?.outputMultiplier ?? 1;
      const out = Math.floor((taken * c.outputPerFullRun) / c.maxInput) * times;
      addYield(ctx, b, c.output, out);
      explain(
        ctx,
        b,
        `composted ${taken} scraps and biomass into ${out} ${c.output}${times > 1 ? ` (× ${times})` : ''}`,
      );
    }
  }
}

/**
 * Flat neighbour food bonuses (apiaries, composters) for buildings that are
 * producing food this season. A target gains each kind of bonus at most once.
 */
export function neighborBonuses(ctx: SeasonContext, targets: BuildingState[]): void {
  const { content, state, si } = ctx;
  const occ = occupancy(state);
  const eligible = new Set(
    targets.filter((t) => (ctx.report.yields[t.uid]?.food ?? 0) > 0).map((t) => t.uid),
  );
  for (const giver of activeInOrder(ctx)) {
    const def = defOf(content, giver);
    const bonus = def.neighborFoodBonus;
    if (!bonus || !bonus.seasons[si]) continue;
    const neighbors = neighborBuildings(state, giver, occ);
    if (neighbors.some((n) => bonus.disabledNextTo.includes(n.type))) {
      explain(ctx, giver, `disabled by a neighbouring ${bonus.disabledNextTo.join(' or ')}`);
      continue;
    }
    let given = 0;
    const reach =
      bonus.radius > 1
        ? Object.values(state.buildings)
            .filter((o) => o.uid !== giver.uid && hexDistance(o.at, giver.at) <= bonus.radius)
            .sort((a, b) => hexDistance(a.at, giver.at) - hexDistance(b.at, giver.at))
        : neighbors;
    for (const target of reach) {
      if (bonus.maxTargets !== undefined && given >= bonus.maxTargets) break;
      if (!eligible.has(target.uid)) continue;
      const tdef = defOf(content, target);
      const fits = bonus.targets ? bonus.targets.includes(target.type) : tdef.kind === 'food';
      if (!fits) continue;
      const tag = `${target.uid}:${def.id}`;
      if (ctx.bonusGiven.has(tag)) continue;
      if (bonus.costs) {
        if (state.stores[bonus.costs.resource] < bonus.costs.amount) break;
        state.stores[bonus.costs.resource] -= bonus.costs.amount;
        flow(
          ctx.report.flows,
          bonus.costs.resource,
          'used',
          `${def.name} bonuses`,
          bonus.costs.amount,
          giver.uid,
        );
      }
      ctx.bonusGiven.add(tag);
      addYield(ctx, target, 'food', bonus.amount, `${def.name} bonus`);
      explain(ctx, target, `+${bonus.amount} food from a neighbouring ${def.name}`);
      if (def.composter) ctx.report.bonuses.compost += bonus.amount;
      else ctx.report.bonuses.apiary += bonus.amount;
      given++;
    }
  }
}

/** Yields that don't depend on power, then conversions, then bonuses. */
export function produce(ctx: SeasonContext): void {
  forage(ctx);
  const unpoweredProducers = activeInOrder(ctx).filter((b) => !defOf(ctx.content, b).requiresPower);
  yieldFor(ctx, unpoweredProducers);
  nurture(ctx);
  convert(ctx);
  neighborBonuses(ctx, unpoweredProducers);
}

/** After the energy step: yields of powered buildings (greenhouse food, library knowledge). */
export function producePowered(ctx: SeasonContext): void {
  const powered = activeInOrder(ctx).filter(
    (b) => defOf(ctx.content, b).requiresPower && ctx.powered.has(b.uid),
  );
  yieldFor(ctx, powered);
  neighborBonuses(ctx, powered);
}
