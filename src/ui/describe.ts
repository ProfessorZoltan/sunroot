/** Short, plain descriptions of buildings, built from their data (so they never drift from the rules). */
import type { BuildingDef, Content } from '../sim';

const SEASON_LIST = (values: readonly number[]) => values.join(' / ');

export function describeBuilding(content: Content, def: BuildingDef): string[] {
  const lines: string[] = [];
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
        `Run: ${[`${def.recipes.energyPerRun} spare energy`, ...ins].join(' + ')} → ${outs.join(' + ')}` +
          `${o.heatToNeighborStorage ? ` + ${o.heatToNeighborStorage} heat to a neighbouring heat well` : ''}.`,
      );
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
  if (def.storage) {
    lines.push(`Stores up to ${def.storage.capacity} ${def.storage.holds}.`);
  }
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
