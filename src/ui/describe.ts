/** Short, plain descriptions of buildings, built from their data (so they never drift from the rules). */
import { wonderBrief, type BuildingDef, type Content } from '../sim';
import { available } from '../sim/water';

const SEASON_LIST = (values: readonly number[]) => values.join(' / ');

export function describeBuilding(content: Content, def: BuildingDef): string[] {
  const lines: string[] = [];
  // A hedgerow runs along the edges between tiles.
  if (def.edge) {
    return [
      `Planted along the edge between two tiles (not water), ${def.cost} materials a segment.`,
      'Storms can’t damage the buildings on either side of it.',
      `1 Harmony for every ${def.edge.harmonyPer} segments.`,
    ];
  }
  // A wonder (E5) takes a flower of 7 tiles.
  if (def.wonder) {
    return [
      `Built over 7 tiles (one and the 6 around it) of ${def.placement.tiles.join(', ')}${def.wonder.nearWater ? ', one of them touching the river, a reservoir or a channel' : ''}.`,
      wonderBrief(content, def.id),
      'Once a run, and it can’t be demolished.',
    ];
  }
  const where = def.placement.tiles.length >= 6 ? 'any land' : def.placement.tiles.join(' or ');
  const near = def.placement.adjacentTo
    ? `, next to ${[
        ...def.placement.adjacentTo,
        ...(def.placement.adjacentToBuildings ?? []).map((id) => content.byId[id]?.name ?? id),
      ].join(' or ')}`
    : '';
  lines.push(`Built on ${where}${near}.`);
  for (const [res, values] of Object.entries(def.yields)) {
    const tail = def.requiresPower ? ' when powered' : '';
    const wait = def.maturesAfterSeasons ? ` after ${def.maturesAfterSeasons} seasons` : '';
    lines.push(`${cap(res)} ${SEASON_LIST(values)} (spring to winter)${wait}${tail}.`);
  }
  if (def.generation) {
    lines.push(
      `Energy by day ${SEASON_LIST(def.generation.day)}, by night ${SEASON_LIST(def.generation.night)}.`,
    );
  }
  if (def.heatGeneration) lines.push(`Free heat by day ${SEASON_LIST(def.heatGeneration.day)}.`);
  if (def.heatPump) {
    lines.push(
      `Pays ${def.heatPump.heatPerEnergy} heat per energy, up to ${def.heatPump.maxHeatPerSlot} per slot.`,
    );
  }
  if (def.housing) lines.push(`Houses ${def.housing}; stores ${def.foodStorage} food.`);
  if (def.recipes) {
    for (const o of def.recipes.options) {
      const ins = Object.entries(o.inputs).map(([r, n]) => `${n} ${r}`);
      const outs = Object.entries(o.outputs).map(([r, n]) => `${n} ${r}`);
      lines.push(
        `Run: ${[...(def.recipes.energyPerRun > 0 ? [`${def.recipes.energyPerRun} spare energy`] : []), ...ins].join(' + ')} → ${outs.join(' + ')}` +
          `${o.heatToNeighborStorage ? ` + ${o.heatToNeighborStorage} heat to a neighbouring heat well` : ''}.`,
      );
      if (o.bonusNextTo) {
        const extra = Object.entries(o.bonusNextTo.outputs).map(([r, n]) => `${n} ${r}`);
        const by = [...o.bonusNextTo.tiles, ...(o.bonusNextTo.tall ? ['a tall building'] : [])];
        lines.push(`+${extra.join(' + ')} a run next to ${by.join(' or ')}.`);
      }
    }
    lines.push(`Up to ${def.recipes.maxRuns} runs a season.`);
    if (def.recipes.options.length > 1) lines.push(`${autoText(def.recipes.options)}.`);
  }
  if (def.composter) {
    lines.push(
      `Turns up to ${def.composter.maxInput} scraps or biomass into ${def.composter.outputPerFullRun} compost.`,
    );
  }
  if (def.digester) {
    lines.push(
      `Each run: ${def.digester.inputPerRun} scraps or biomass → ${def.digester.energyPerRun} energy + ${def.digester.compostPerRun} compost.`,
    );
  }
  if (def.neighborFoodBonus) {
    const who = def.neighborFoodBonus.targets
      ? def.neighborFoodBonus.targets.map((id) => content.byId[id]?.name ?? id).join(' and ')
      : 'food buildings';
    lines.push(`+${def.neighborFoodBonus.amount} food to neighbouring ${who}.`);
  }
  // Heat from neighbours (a bathhouse from a kiln; a greenhouse from a warmed bathhouse).
  const givers = (def.heatFromNeighbors ?? []).filter(
    (id) => content.byId[id] && available(content, content.byId[id]!),
  );
  if (givers.length > 0) {
    const heat = def.demand?.heat;
    const slot = heat && Math.max(...heat.night) > 0 ? 'night' : 'day';
    const most = heat ? Math.max(...heat[slot]) : 0;
    const who = givers.map((id) => content.byId[id]!.name).join(' or ');
    const how = givers.every((id) => content.byId[id]!.heatFromNeighbors)
      ? ' (one warmed by its own neighbour passes on up to 1)'
      : ' (a staffed kiln for free)';
    lines.push(
      `Needs ${most} heat by ${slot}${slot === 'day' ? ' in winter' : ''}: a ${who} next to it gives it first${how}; otherwise ${content.rules.localHeat.gridHeat ? 'the grid' : `a heat source within ${content.rules.localHeat.range} tiles, or it goes cold`}.`,
    );
  } else if (!content.rules.localHeat.gridHeat && def.demand) {
    // The heat layer: say what heat it needs and that only a building can give it.
    for (const slot of ['day', 'night'] as const) {
      const heat = def.demand.heat[slot];
      if (!heat.some((n) => n > 0)) continue;
      lines.push(
        `Heat by ${slot} ${SEASON_LIST(heat)} (spring to winter), from a heat source within ${content.rules.localHeat.range} tiles; without one it goes cold.`,
      );
    }
  }
  // Water only matters while the run has it.
  const w = content.rules.water.enabled ? def.water : undefined;
  if (w && w.needs.some((n) => n > 0)) {
    lines.push(`Water ${SEASON_LIST(w.needs)} (spring to winter): ${w.accepts.join(' or ')}.`);
  }
  if (w) {
    for (const [res, n] of Object.entries(w.nutrientBonus))
      lines.push(`+${n} ${res} with nutrient-rich water.`);
  }
  if (w?.returns) {
    lines.push(`Returns ${w.returns.amount} ${w.returns.quality} water to its channel.`);
    if (w.returns.quality === 'grey')
      lines.push(
        'Grey water costs Harmony if it reaches the river: a Reed Bed further down the channel, or beside the river where it rejoins, cleans it.',
      );
  }
  if (w?.fromPond) lines.push('Watered by a fish pond next to it, not a channel.');
  if (w?.noEvaporation) lines.push('Its channel loses no water to summer evaporation.');
  if (w?.cleans)
    lines.push(
      `Cleans up to ${w.cleans} grey water in its channel, or where it joins the river beside it.`,
    );
  if (def.storage) {
    lines.push(`Stores up to ${def.storage.capacity} ${def.storage.holds}.`);
  }
  if (def.wellbeing?.always) lines.push(`+${def.wellbeing.always} wellbeing each season.`);
  if (def.wellbeing?.whenPowered)
    lines.push(`+${def.wellbeing.whenPowered} wellbeing when powered.`);
  if (def.cider) {
    const who = def.cider.nextTo
      .map((id) => content.byId[id]?.name.toLowerCase() ?? id)
      .join(' or ');
    lines.push(
      `For each neighbouring ${who} that bore food (up to ${def.cider.max}), ` +
        `${def.cider.foodEach} spare food → +${def.cider.wellbeingEach} wellbeing.`,
    );
  }
  if (def.harmony) lines.push(`+${def.harmony} Harmony.`);
  if (def.harmonyAsTile) lines.push(`Counts as ${def.harmonyAsTile} for Harmony.`);
  if (def.spawns) {
    const what = content.byId[def.spawns.building]?.name ?? def.spawns.building;
    lines.push(`Each spring a ${what} grows beside the reservoir, up to ${def.spawns.max}.`);
  }
  if (def.revertsAfterSeasons)
    lines.push(`Woodland again ${def.revertsAfterSeasons} seasons after it was stopped.`);
  if (def.sheltersNeighbors) lines.push("Storms can't damage the buildings next to it.");
  const civic = content.rules.expectations?.perBuilding[def.id];
  if (civic)
    lines.push(
      `Civic life for ${civic} citizens (expected from era ${content.rules.expectations!.fromEra}).`,
    );
  if (def.improvesNeighborSteps) lines.push('Improves a neighbouring tile each season.');
  if (def.weir) lines.push('Halves the flooded area; the river above becomes reservoir.');
  if (def.levee) lines.push(`Protects floodplain within ${def.levee.radius} tiles from the flood.`);
  if (def.floodTolerant) lines.push('Survives the flood.');
  if (def.workers) lines.push(`Needs ${def.workers} worker.`);
  return lines;
}

/** What Auto does, such as "Auto: salvage, then clutter once there are 5 or more". */
export function autoText(
  options: { id: string; autoAtLeast: Partial<Record<string, number>> }[],
): string {
  return `Auto: ${options
    .map((o) => {
      const min = Object.entries(o.autoAtLeast)
        .map(([res, n]) => `${n} or more ${res}`)
        .join(' and ');
      return min ? `${o.id} once there are ${min}` : o.id;
    })
    .join(', then ')}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
