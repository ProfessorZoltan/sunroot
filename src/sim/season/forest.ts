/**
 * Rainforest Gardens' soil and layers in the season (proposals/rainforest-gardens.md, The new
 * rules):
 *
 *  - Layers: each grown layer of a forest garden makes its own yields, and helps the layers it
 *    names (`ground` is the garden's own yields, in `computeYield`) while they make any.
 *  - After production: char hearths burn biomass into charcoal; kitchen middens take scraps and,
 *    with charcoal near, come a season nearer to turning a tile into dark earth.
 *  - In the monsoon, every farmed tile nothing covers loses 1 fertility; a field with none left
 *    wears a step down the land-health ladder instead.
 *
 * Off (and nothing here runs) without `rules.forest`.
 */
import { RESOURCES, type Resource } from '../content/schema';
import { covered, fertilityOf, layersOf } from '../forest';
import { hexDistance, hexKey } from '../hex';
import { byPriority, defOf, harmonyMultiplier, neighborBuildings, tileAt } from '../queries';
import type { BuildingState, ForestReport } from '../types';
import { addYield, explain, flow, type SeasonContext } from './context';
import { loopBoost } from '../combos';

const EPSILON = 1e-9;

/** What the grown layers that help `target` (a layer id, or `ground`) add to its `res`. */
export function layerHelp(
  ctx: SeasonContext,
  b: BuildingState,
  target: string,
  res: Resource,
): { amount: number; from: string[] } {
  let amount = 0;
  const from: string[] = [];
  for (const l of layersOf(ctx.content, ctx.state, b)) {
    if (!l.grown) continue;
    for (const h of l.def.helps)
      if (h.layer === target && h.resource === res) {
        amount += h.amount;
        from.push(`+${h.amount} ${l.def.name.toLowerCase()}`);
      }
  }
  return { amount, from };
}

/** The yields of a building's grown layers, after its own. */
export function layerYields(ctx: SeasonContext, b: BuildingState): void {
  const { content, state, si } = ctx;
  for (const l of layersOf(content, state, b)) {
    const name = l.def.name;
    if (!l.grown) {
      explain(ctx, b, `${name}: still growing (${l.age}/${l.def.grows} seasons)`);
      continue;
    }
    let made = false;
    for (const res of RESOURCES) {
      const base = l.def.yields[res]?.[si] ?? 0;
      if (base <= 0) continue;
      const help = layerHelp(ctx, b, l.def.id, res);
      const h = content.rules.harmony.multiplies.includes(res)
        ? harmonyMultiplier(content, state.harmony)
        : 1;
      const amount = Math.floor((base + help.amount) * h + EPSILON);
      const parts = [`${name}: ${res} ${base} in ${state.season}`, ...help.from];
      if (h !== 1) parts.push(`× ${h} Harmony`);
      explain(ctx, b, `${parts.join(' ')} = ${amount}`);
      addYield(ctx, b, res, amount, `${defOf(content, b).name} (${name.toLowerCase()})`);
      made = made || amount > 0;
    }
    // Pepper on the tree: a grown layer beside the right neighbour makes more.
    const by = l.def.besides;
    if (by && made && neighborBuildings(state, b).some((n) => by.buildings.includes(n.type))) {
      explain(ctx, b, `${name}: +${by.amount} ${by.resource} beside ${by.buildings.join(' or ')}`);
      addYield(ctx, b, by.resource, by.amount, `${defOf(content, b).name} (${name.toLowerCase()})`);
    }
  }
}

export function resolveForest(ctx: SeasonContext): void {
  const { content, state, si } = ctx;
  const rules = content.rules.forest;
  if (!rules) return;
  const report: ForestReport = {
    leached: [],
    wornOut: [],
    charcoal: [],
    middens: {},
    darkened: [],
  };
  ctx.report.forest = report;
  const order = byPriority(state);
  const active = order.filter((b) => ctx.active.has(b.uid));

  // Char hearths burn biomass into charcoal.
  const burned: BuildingState[] = [];
  for (const b of active) {
    const c = defOf(content, b).charcoal;
    if (!c) continue;
    if (state.stores.biomass < c.biomass) {
      explain(ctx, b, `no charcoal: it needs ${c.biomass} biomass`);
      continue;
    }
    state.stores.biomass -= c.biomass;
    flow(ctx.report.flows, 'biomass', 'used', defOf(content, b).name, c.biomass, b.uid);
    explain(ctx, b, `burned ${c.biomass} biomass into charcoal`);
    report.charcoal.push(b.uid);
    burned.push(b);
  }

  // Kitchen middens take scraps, and with charcoal near, make dark earth.
  for (const b of active) {
    const m = defOf(content, b).midden;
    if (!m) continue;
    const took = Math.min(m.scraps, state.stores.scraps);
    if (took > 0) {
      state.stores.scraps -= took;
      flow(ctx.report.flows, 'scraps', 'used', defOf(content, b).name, took, b.uid);
    }
    const char = burned.some((h) => hexDistance(h.at, b.at) <= m.range);
    if (took < m.scraps || !char) {
      explain(
        ctx,
        b,
        took < m.scraps
          ? `took ${took} scraps of the ${m.scraps} it needs: no nearer to dark earth`
          : `took ${took} scraps, but no charcoal within ${m.range}: no nearer to dark earth`,
      );
      continue;
    }
    // The Midden Loop: a midden in it comes on faster.
    const step = 1 + loopBoost(content, state, b.uid, 'middenBonus');
    b.darkening = Math.min(m.seasons, (b.darkening ?? 0) + step);
    report.middens[b.uid] = b.darkening;
    if (b.darkening < m.seasons) {
      explain(ctx, b, `took ${took} scraps and charcoal: ${b.darkening} of ${m.seasons} seasons`);
      continue;
    }
    const tile = darkenSite(ctx, b, m.range);
    if (!tile) {
      explain(ctx, b, `ready to make dark earth, but no land within ${m.range} to make it on`);
      continue;
    }
    tile.type = 'darkEarth';
    tile.fertility = rules.maxFertility;
    b.darkening = 0;
    report.darkened.push(hexKey(tile));
    explain(ctx, b, `turned ${hexKey(tile)} into dark earth`);
  }

  // The monsoon washes fertility out of every farmed tile nothing covers.
  if (!rules.leaches[si]) return;
  const ladder = content.rules.landHealth;
  for (const b of order) {
    if (!defOf(content, b).farmland) continue;
    const tile = tileAt(state, b.at)!;
    if (rules.keeps.includes(tile.type) || covered(content, state, b)) continue;
    const f = fertilityOf(content, tile)!;
    if (f > 0) {
      tile.fertility = f - 1;
      report.leached.push(hexKey(tile));
      explain(ctx, b, `the rain washed 1 fertility out of its field: ${f - 1} left`);
      continue;
    }
    tile.fertility = 0;
    const at = ladder.indexOf(tile.type);
    if (at <= 0) continue;
    const from = tile.type;
    tile.type = ladder[at - 1]!;
    report.wornOut.push(hexKey(tile));
    explain(ctx, b, `no fertility left: its field wore from ${from} to ${tile.type}`);
  }
}

/** The tile a ready midden turns into dark earth: the nearest it can, fields first. */
function darkenSite(ctx: SeasonContext, midden: BuildingState, range: number) {
  const { content, state } = ctx;
  const darkens = content.rules.forest!.darkens;
  const on = new Map(Object.values(state.buildings).map((b) => [hexKey(b.at), b]));
  return Object.values(state.map.tiles)
    .filter((t) => {
      if (!darkens.includes(t.type) || hexDistance(t, midden.at) > range) return false;
      // Open land, or a field: dark earth goes under nothing else.
      const b = on.get(hexKey(t));
      return !b || defOf(content, b).farmland;
    })
    .map((t) => ({ t, key: hexKey(t), farmed: on.has(hexKey(t)) ? 0 : 1 }))
    .sort(
      (a, b) =>
        hexDistance(a.t, midden.at) - hexDistance(b.t, midden.at) ||
        a.farmed - b.farmed ||
        a.key.localeCompare(b.key),
    )[0]?.t;
}
