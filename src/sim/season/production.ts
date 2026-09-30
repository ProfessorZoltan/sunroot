/** Step 4: staffing, generation and production. */
import type { BuildingDef, Resource } from '../content/schema';
import { RESOURCES, SLOTS } from '../content/schema';
import { hexDistance, hexKey, hexNeighbors } from '../hex';
import {
  byPriority,
  defOf,
  harmonyMultiplier,
  improveTile,
  neighborBuildings,
  neighborTiles,
  occupancy,
  tileAt,
  waterDistance,
} from '../queries';
import type { BuildingState } from '../types';
import { addSupply, addYield, explain, type SeasonContext } from './context';

const EPSILON = 1e-9;

/** Assigns citizens as workers in priority order. Damaged buildings don't operate. */
export function staff(ctx: SeasonContext): void {
  let workers = ctx.state.citizens;
  for (const b of byPriority(ctx.state)) {
    if (b.damage) continue;
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

/** Generators: the camp, solar, wheels and spires (digesters run later, on their inputs). */
export function generate(ctx: SeasonContext): void {
  const { content, state, si } = ctx;
  const occ = occupancy(state);
  for (const b of activeInOrder(ctx)) {
    const def = defOf(content, b);
    if (!def.generation) continue;
    const neighbors = neighborBuildings(state, b, occ);
    let adjust = 0;
    const notes: string[] = [];
    if (def.shading) {
      const tallNeighbor =
        neighbors.some((n) => defOf(content, n).tall) ||
        neighborTiles(state, b.at).some((t) => t.type === 'woodland');
      if (tallNeighbor) {
        adjust -= def.shading.penaltyPerSlot;
        notes.push(`shaded by a tall neighbour -${def.shading.penaltyPerSlot}`);
      }
    }
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
    for (const slot of SLOTS) {
      const base = def.generation[slot][si]!;
      // Adjustments apply only to slots where the source runs at all.
      const amount = base > 0 ? Math.max(0, base + adjust) : 0;
      addSupply(ctx, slot, def.id, amount);
      explain(
        ctx,
        b,
        `${slot} energy ${base}${adjust ? ` ${adjust > 0 ? '+' : ''}${adjust}` : ''} = ${amount}`,
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
 * A building's yield of one resource before flat neighbour bonuses:
 * base (with tile modifier) x multipliers, rounded down, then flat penalties.
 */
export function computeYield(ctx: SeasonContext, b: BuildingState, res: Resource): number {
  const { content, state, si } = ctx;
  const def = defOf(content, b);
  const perSeason = def.yields[res];
  if (!perSeason) return 0;
  let base = perSeason[si]!;
  if (base === 0) return 0;
  const age = state.turn - b.builtTurn;
  if (age < def.maturesAfterSeasons) {
    explain(ctx, b, `${res}: still growing (${age}/${def.maturesAfterSeasons} seasons)`);
    return 0;
  }
  const lines = [`${res} ${base} (${state.season})`];
  const tile = tileAt(state, b.at)!;
  if (res === 'food') {
    const mod = def.tileFoodModifier[tile.type] ?? 0;
    if (mod !== 0) {
      base = Math.max(0, base + mod);
      lines.push(`on ${tile.type} ${mod > 0 ? '+' : ''}${mod}`);
    }
  }
  let multiplier = 1;
  if (res === 'food' && def.farmland) {
    const flood = content.events.flood;
    if (b.siltYear === state.year && flood.siltSeasons.includes(state.season)) {
      multiplier *= 1 + flood.siltBonus;
      lines.push(`silt x${1 + flood.siltBonus}`);
    }
    const low = content.events.lowRiver;
    if (ctx.lowRiver && waterDistance(content, state, b.at) > low.farFromWaterDistance) {
      multiplier *= low.farYieldFactor;
      lines.push(`low river, far from water x${low.farYieldFactor}`);
    }
  }
  if (content.rules.harmony.multiplies.includes(res)) {
    const h = harmonyMultiplier(content, state.harmony);
    multiplier *= h;
    if (h !== 1) lines.push(`Harmony x${h}`);
  }
  let value = Math.floor(base * multiplier + EPSILON);
  if (res === 'food') {
    const penalty = downstreamPenalty(ctx, def);
    if (penalty > 0 && isDownstreamOfWeir(ctx, b)) {
      value = Math.max(0, value - penalty);
      lines.push(`downstream of a weir -${penalty}`);
    }
  }
  lines.push(`= ${value}`);
  explain(ctx, b, lines.join(', '));
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
        amount = Math.min(amount, tile.salvage ?? 0);
        tile.salvage = (tile.salvage ?? 0) - amount;
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

function takeInputs(ctx: SeasonContext, inputs: readonly Resource[], max: number): number {
  let taken = 0;
  for (const res of inputs) {
    const t = Math.min(max - taken, ctx.state.stores[res]);
    ctx.state.stores[res] -= t;
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
        takeInputs(ctx, d.inputs, d.inputPerRun);
        runs++;
      }
      if (runs > 0) {
        addSupply(ctx, slot, def.id, runs * d.energyPerRun);
        addYield(ctx, b, 'compost', runs * d.compostPerRun);
      }
      explain(
        ctx,
        b,
        `${runs} runs: ${runs * d.energyPerRun} ${slot} energy, ${runs * d.compostPerRun} compost`,
      );
    }
    if (def.composter) {
      const c = def.composter;
      const taken = takeInputs(ctx, c.inputs, c.maxInput);
      const out = Math.floor((taken * c.outputPerFullRun) / c.maxInput);
      addYield(ctx, b, c.output, out);
      explain(ctx, b, `composted ${taken} scraps and biomass into ${out} ${c.output}`);
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
    for (const target of neighbors) {
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
      }
      ctx.bonusGiven.add(tag);
      addYield(ctx, target, 'food', bonus.amount);
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
