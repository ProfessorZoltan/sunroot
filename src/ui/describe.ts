/**
 * Short, plain descriptions of buildings, built from their data (so they never drift from the
 * rules): every rule a building carries says what it does here (asked for in playtesting: a
 * smokehouse, a cistern or a well didn't say what they were for).
 */
import { wonderBrief, type BuildingDef, type Content } from '../sim';
import { SEASONS } from '../sim/content/schema';
import { available, walksToWater } from '../sim/water';

const SEASON_LIST = (values: readonly number[]) => values.join(' / ');
/** A tile type as words: `saltFlat` → "salt flat". */
const tile = (t: string) => t.replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`);
const tiles = (ts: readonly string[], joiner = ' or ') => ts.map(tile).join(joiner);

export function describeBuilding(content: Content, def: BuildingDef): string[] {
  const lines: string[] = [];
  // A hedgerow runs along the edges between tiles.
  if (def.edge) {
    return [
      `Planted along the edge between two tiles (not water), ${def.cost} materials a segment.`,
      'Storms can’t damage the buildings on either side of it.',
      ...(def.shades > 0
        ? [`Shade: a home along it needs ${def.shades} less cooling by day.`]
        : []),
    ];
  }
  // A wonder (E5) takes a flower of 7 tiles.
  if (def.wonder) {
    return [
      `Built over 7 tiles (one and the 6 around it) of ${tiles(def.placement.tiles, ', ')}${def.wonder.nearWater ? ', one of them touching the river, a reservoir or a channel' : ''}${def.wonder.minHeights > 1 ? `, climbing the slope over ${def.wonder.minHeights} heights or more` : ''}.`,
      wonderBrief(content, def.id),
      'Once a run, and it can’t be demolished.',
    ];
  }
  const water = content.rules.water.enabled;
  const w = water ? def.water : undefined;

  // Where it goes.
  const where = def.placement.tiles.length >= 6 ? 'any land' : tiles(def.placement.tiles);
  const near = def.placement.adjacentTo
    ? `, next to ${[
        ...def.placement.adjacentTo.map(tile),
        ...(def.placement.adjacentToBuildings ?? []).map((id) => content.byId[id]?.name ?? id),
      ].join(' or ')}`
    : '';
  const heights = def.placement.heights;
  const high = heights
    ? heights[0] === heights[1]
      ? `, at height ${heights[0]}${heights[0] === 0 ? ' (the valley floor)' : ''}`
      : `, at height ${heights[0]} to ${heights[1]}`
    : '';
  const edge = def.placement.atEdge ? ', at the edge of the map' : '';
  const away = def.placement.awayFrom ? ', out at sea, away from the shore' : '';
  lines.push(`Built on ${where}${near}${high}${edge}${away}.`);

  // What it makes.
  for (const [res, values] of Object.entries(def.yields)) {
    const tail = def.requiresPower ? ' when all its needs are met' : '';
    const wait = def.maturesAfterSeasons ? ` after ${def.maturesAfterSeasons} seasons` : '';
    lines.push(`${cap(res)} ${SEASON_LIST(values)} (spring to winter)${wait}${tail}.`);
  }
  if (def.forage) lines.push(`Forages ${def.forage} materials a season.`);
  for (const [t, n] of Object.entries(def.tileFoodModifier))
    lines.push(`${n > 0 ? '+' : '−'}${Math.abs(n)} food on ${tile(t)}.`);
  if (def.nextToTilesFood) {
    const f = def.nextToTilesFood;
    lines.push(
      `+${f.amount} food in ${seasonNames(f.seasons)} next to ${f.count} or more ${tiles(f.tiles)} tiles.`,
    );
  }
  if (def.farmland) lines.push(...farmland(content, def));
  if (def.matureTileBecomes)
    lines.push(`Once grown, its tile becomes ${tile(def.matureTileBecomes)} (never worse).`);
  if (def.setsTile)
    lines.push(`Its tile becomes ${def.setsTile} when it is planted (never worse).`);
  if (def.drawsFromRuin)
    lines.push('On a ruin, its salvage comes out of the ruin until the ruin is picked clean.');
  if (def.strandline) lines.push(`+${def.strandline} salvage washed up after each storm.`);
  if (def.chars)
    lines.push(
      'Each season it runs, it chars the tile of one farm beside it for good: +1 food there whenever that farm makes any.',
    );

  // Energy it makes, and what changes it.
  if (def.generation) {
    lines.push(
      `Energy by day ${SEASON_LIST(def.generation.day)}, by night ${SEASON_LIST(def.generation.night)}.`,
    );
  }
  if (w?.wheel)
    lines.push(
      `Turned by the river: its energy follows the flow beside it, 1 a slot for every ${content.rules.water.wheelFlowPerEnergy} water.`,
    );
  if (def.weirBonus) lines.push(`+${def.weirBonus.perSlot} energy a slot next to a weir.`);
  if (def.generationOnTiles)
    lines.push(
      `+${def.generationOnTiles.add} energy a slot on ${tiles(def.generationOnTiles.tiles)}.`,
    );
  if (def.generationAtHeight)
    lines.push(
      `+${def.generationAtHeight.add} energy a slot at height ${def.generationAtHeight.from} or more.`,
    );
  if (def.idleAtHeight) {
    const i = def.idleAtHeight;
    lines.push(
      `Under snow in ${i.seasons.join(' and ')} at height ${i.from} or more: it makes nothing` +
        (i.keepsBesideEdge > 0
          ? `, but ${i.keepsBesideEdge} by day with a snow fence along it.`
          : '.'),
    );
  }
  if (def.shading)
    lines.push(
      `−${def.shading.penaltyPerSlot} a slot next to a tall building or woodland (their shade).`,
    );
  if (def.spacing)
    lines.push(
      `−${def.spacing.penaltyPerSlot} a slot for each other ${def.name} within ${def.spacing.radius} tiles (they steal each other's wind).`,
    );
  if (def.fogged) {
    const dims = [
      ...(content.events.fog?.solarPenalty
        ? [`sea fog (−${content.events.fog.solarPenalty})`]
        : []),
      ...(content.events.storm?.solarPenalty
        ? [`a dust storm (−${content.events.storm.solarPenalty})`]
        : []),
    ];
    if (dims.length > 0) lines.push(`Dimmed a slot by ${dims.join(' or ')}.`);
  }
  if (def.heatDimmed && content.events.heatwave?.solarPenalty)
    lines.push(`A heatwave dims it by day (−${content.events.heatwave.solarPenalty}).`);
  if (def.heatGeneration) {
    const g = def.heatGeneration;
    const slots = (['day', 'night'] as const).filter((slot) => g[slot].some((n) => n > 0));
    lines.push(
      `Free heat ${slots.map((slot) => `by ${slot} ${SEASON_LIST(g[slot])}`).join(', ')} (spring to winter).`,
    );
  }
  if (def.heatFuel && def.heatGeneration) {
    const f = def.heatFuel;
    const free = f.freeNextTo.map((id) => content.byId[id]?.name ?? id).join(' or ');
    lines.push(
      `Its stove burns ${f.amount} ${f.resource} in each season it makes heat${free ? ` (none next to a ${free})` : ''}; with no ${f.resource}, no heat.`,
    );
  }
  if (def.heatPump) {
    lines.push(
      `Pays ${def.heatPump.heatPerEnergy} heat per energy, up to ${def.heatPump.maxHeatPerSlot} per slot.`,
    );
  }

  // Homes and food.
  if (def.housing) lines.push(`Houses ${def.housing}; stores ${def.foodStorage} food.`);
  else if (def.foodStorage)
    lines.push(
      `Adds ${def.foodStorage} to the food the settlement can store (food beyond storage rots).`,
    );
  if (def.stopsRot)
    lines.push(
      'While it runs (staffed, its needs met), no food rots, however much there is beyond storage.',
    );
  if (def.wellbeing?.nextToTiles) {
    const n = def.wellbeing.nextToTiles;
    lines.push(`+${n.amount} wellbeing next to ${tiles(n.tiles)}.`);
  }

  // Work it does with what is in store.
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
        const by = [
          ...o.bonusNextTo.tiles.map(tile),
          ...(o.bonusNextTo.tall ? ['a tall building'] : []),
        ];
        lines.push(`+${extra.join(' + ')} a run next to ${by.join(' or ')}.`);
      }
    }
    lines.push(`Up to ${def.recipes.maxRuns} run${def.recipes.maxRuns > 1 ? 's' : ''} a season.`);
    if (def.recipes.options.length > 1) lines.push(`${autoText(def.recipes.options)}.`);
  }
  if (def.composter) {
    lines.push(
      `Turns up to ${def.composter.maxInput} scraps or biomass into ${def.composter.outputPerFullRun} compost.`,
    );
  }
  if (def.digester) {
    const d = def.digester;
    lines.push(
      `Each run: ${d.inputPerRun} ${d.inputs.join(' or ')} → ${d.energyPerRun} energy${d.compostPerRun > 0 ? ` + ${d.compostPerRun} compost` : ''}; up to ${d.maxRuns} run${d.maxRuns > 1 ? 's' : ''} a season, by ${d.defaultSlot} unless set otherwise.`,
    );
  }
  if (def.neighborFoodBonus) {
    const nb = def.neighborFoodBonus;
    const who = nb.targets
      ? nb.targets.map((id) => content.byId[id]?.name ?? id).join(' and ')
      : 'food buildings';
    const extra = [
      ...(nb.maxTargets ? [`up to ${nb.maxTargets} of them`] : []),
      ...(nb.radius > 1 ? [`within ${nb.radius} tiles`] : []),
      ...(nb.seasons.some((on) => !on) ? [`in ${seasonNames(nb.seasons)}`] : []),
      ...(nb.costs ? [`each spends ${nb.costs.amount} ${nb.costs.resource} from the store`] : []),
      ...(nb.disabledNextTo.length > 0
        ? [
            `none while it touches a ${nb.disabledNextTo.map((id) => content.byId[id]?.name ?? id).join(' or ')}`,
          ]
        : []),
    ];
    lines.push(
      `+${nb.amount} food to neighbouring ${who} in a season they make food${extra.length > 0 ? ` (${extra.join('; ')})` : ''}.`,
    );
  }
  if (def.cider) {
    const who = def.cider.nextTo
      .map((id) => content.byId[id]?.name.toLowerCase() ?? id)
      .join(' or ');
    lines.push(
      `For each neighbouring ${who} that bore food (up to ${def.cider.max}), ` +
        `${def.cider.foodEach} spare food → +${def.cider.wellbeingEach} wellbeing.`,
    );
  }

  // What it needs to run: energy, heat and cooling.
  const energy = def.demand?.energy;
  for (const slot of ['day', 'night'] as const)
    if (energy?.[slot].some((n) => n > 0))
      lines.push(`Uses energy by ${slot}: ${SEASON_LIST(energy[slot])} (spring to winter).`);
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
  } else if (def.demand) {
    for (const slot of ['day', 'night'] as const) {
      const heat = def.demand.heat[slot];
      if (!heat.some((n) => n > 0)) continue;
      lines.push(
        content.rules.localHeat.gridHeat
          ? `Heat by ${slot} ${SEASON_LIST(heat)} (spring to winter), paid with energy from the grid where no heat source covers it.`
          : `Heat by ${slot} ${SEASON_LIST(heat)} (spring to winter), from a heat source within ${content.rules.localHeat.range} tiles; without one it goes cold.`,
      );
    }
  }
  if (def.heatAtHeight) {
    const h = def.heatAtHeight;
    lines.push(
      `+${h.add} heat on ${h.seasons.join(' and ')} nights at height ${h.from} or more (colder up high).`,
    );
  }
  const cool = def.demand?.cool;
  const reach = content.rules.cooling?.range ?? 2;
  for (const slot of ['day', 'night'] as const)
    if (cool?.[slot].some((n) => n > 0))
      lines.push(
        `Cooling by ${slot} ${SEASON_LIST(cool[slot])} (spring to winter), from a wind tower or chiller within ${reach} tiles, or the grid.`,
      );
  const heatwave = content.events.heatwave?.coolingAdd;
  if (heatwave && def.housing > 0)
    lines.push(`In a heatwave it needs ${heatwave} more cooling by day.`);
  if (def.coolingFreeNextTo) {
    const n = def.coolingFreeNextTo;
    const names = (n.buildings ?? []).map((id) => content.byId[id]?.name ?? id);
    lines.push(
      `Needs no cooling at all next to ${n.each ? `both a ${names.join(' and a ')}` : `a ${names.join(' or ')}`}.`,
    );
  }
  if (def.requiresPower && Object.keys(def.yields).length === 0)
    lines.push('Works only in a season all its needs are met.');

  // Cooling it gives.
  if (def.cooling) {
    const c = def.cooling;
    const bonus = c.besideBonus
      ? `; +${c.besideBonus.amount} next to ${[...c.besideBonus.tiles.map(tile), ...c.besideBonus.buildings.map((id) => content.byId[id]?.name.toLowerCase() ?? id)].join(' or ')}`
      : '';
    lines.push(
      `Cools the buildings within ${reach} tiles by day: ${SEASON_LIST(c.day)} (spring to winter)${bonus}.`,
    );
  }
  if (def.chiller)
    lines.push(
      `Turns heat no one needs, from heat sources within ${reach} tiles, into cooling for buildings in reach: ${def.chiller.coolPerHeat} for each heat, up to ${def.chiller.maxCoolPerSlot} a slot.`,
    );
  if (def.shades > 0)
    lines.push(`Shade: a home next to it needs ${def.shades} less cooling by day.`);

  // Water (only while the run has it).
  if (w && w.needs.some((n) => n > 0)) {
    const from = w.fromPond
      ? 'a fish pond next to it'
      : w.besideRiver
        ? 'the river beside it, or a channel'
        : 'a channel beside it';
    lines.push(
      `Water ${SEASON_LIST(w.needs)} (spring to winter): ${w.accepts.join(' or ')}, from ${from}` +
        (Object.keys(def.yields).length > 0
          ? `; short of it, it makes ×${content.rules.water.shortfallFactor}.`
          : '.'),
    );
  }
  if (w) {
    for (const [res, n] of Object.entries(w.nutrientBonus))
      lines.push(`+${n} ${res} with nutrient-rich water (what a fish pond puts in a channel).`);
  }
  if (w?.channel) {
    lines.push(
      `Carries water from ${[...(content.land === 'desert' ? ['the oasis'] : []), 'the river', 'a reservoir', ...(content.byId.desalinator ? ['a desalinator'] : [])].join(', ').replace(/, ([^,]*)$/, ' or $1')} at its head, up to ${content.rules.water.channelCapacity} a season, to the buildings beside it, nearest first.` +
        ' Start one beside the water, then extend it from its end; channels never branch or join.',
    );
    if (w.underground) lines.push('Underground: it loses no water to the sun.');
    else if (content.rules.water.evaporation.seasons.some(Boolean))
      lines.push(
        `In ${seasonNames(content.rules.water.evaporation.seasons)}, 1 water evaporates for every ${content.rules.water.evaporation.tilesPerUnit} tiles of open channel.`,
      );
  }
  if (w && w.stores > 0) {
    const gathers = w.collects.some((n) => n > 0);
    lines.push(
      gathers
        ? `Gathers ${SEASON_LIST(w.collects)} water from the fog (spring to winter) into a store of ${w.stores}, for buildings further down a channel beside it that run short.`
        : `Holds up to ${w.stores} water. Beside a channel, it fills from water the channel has spare (in ${seasonNames(w.fills)}) and gives it to buildings further down that run short; beside the river or a lake, it keeps water back for whatever draws below it.`,
    );
    if (content.events.fog?.cisternCatch && !gathers)
      lines.push(`Sea fog adds ${content.events.fog.cisternCatch} to it.`);
  }
  if (w?.feeds && w.startsChannel)
    lines.push(
      `Makes ${w.feeds.amount} ${w.feeds.quality} water a season for a channel: lay one from beside it to carry the water inland.`,
    );
  else if (w?.feeds)
    lines.push(
      `Puts ${w.feeds.amount} ${w.feeds.quality} water a season into the channel beside it` +
        (w.feeds.quality === 'nutrient'
          ? ': a farm down the channel that takes it makes +1 food.'
          : w.feeds.quality === 'grey'
            ? ': grey water costs Harmony if it reaches the river; a Reed Bed cleans it.'
            : '.'),
    );
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
  if (w?.holdsBack) {
    const h = w.holdsBack;
    lines.push(`Holds back ${h.amount} river water in ${h.fill} and lets it go in ${h.release}.`);
  }
  if (def.pump)
    lines.push(
      `Lifts up to ${def.pump.lift} water a season up one step of height, in a channel beside it; without one, a channel carries nothing uphill.`,
    );
  if (def.waterBody && !water)
    lines.push('Counts as water nearby: farms beside it keep their food when the river runs low.');
  if (def.drinkingWater && walksToWater(content)) {
    const walk = content.rules.commute.toWater!;
    lines.push(
      `Drinking water for homes: each home walks to the nearest well, cistern or channel; beyond ${walk.freeDistance} tiles, every ${walk.tilesPerWellbeing} tiles walked cost 1 wellbeing.`,
    );
    if (def.requiresWalks) lines.push('Only for homes: it waters no farms or gardens.');
  }

  // Storage.
  if (def.storage) {
    const s = def.storage;
    const back =
      s.returns.numerator !== s.returns.denominator
        ? `; gives back ${s.returns.numerator} for every ${s.returns.denominator} stored`
        : '';
    const decay = s.decayPerSeason > 0 ? `; loses ${s.decayPerSeason} a season` : '';
    lines.push(
      `Stores up to ${s.capacity} ${s.holds}, charged with what is spare by ${s.chargesFrom.join(' or ')}, for when there isn't enough${back}${decay}.`,
    );
  }

  // Wellbeing, Harmony and the land.
  if (def.wellbeing?.always) lines.push(`+${def.wellbeing.always} wellbeing each season.`);
  if (def.wellbeing?.whenPowered)
    lines.push(`+${def.wellbeing.whenPowered} wellbeing when powered.`);
  if (def.harmony) lines.push(`+${def.harmony} Harmony.`);
  if (def.harmonyPenalty) {
    const by = def.harmonyPenalty.cancelledByNeighbor
      .map((id) => content.byId[id]?.name ?? id)
      .join(' or ');
    lines.push(`−${def.harmonyPenalty.amount} Harmony, unless a ${by} stands next to it.`);
  }
  if (def.harmonyAsTile) lines.push(`Counts as ${def.harmonyAsTile} for Harmony.`);
  if (def.spawns) {
    const what = content.byId[def.spawns.building]?.name ?? def.spawns.building;
    lines.push(`Each spring a ${what} grows beside the reservoir, up to ${def.spawns.max}.`);
  }
  if (def.revertsAfterSeasons)
    lines.push(`Woodland again ${def.revertsAfterSeasons} seasons after it was stopped.`);
  const civic = content.rules.expectations?.perBuilding[def.id];
  if (civic)
    lines.push(
      `Civic life for ${civic} citizens (expected from era ${content.rules.expectations!.fromEra}).`,
    );
  if (def.improvesNeighborSteps)
    lines.push(
      `Each season, improves the least healthy land beside it ${def.improvesNeighborSteps} step (${content.rules.landHealth.join(' → ')}).`,
    );

  // Weather.
  if (def.sheltersNeighbors) lines.push("Storms can't damage the buildings next to it.");
  if (def.shelters)
    lines.push(
      `Storms can't damage any building within ${def.shelters.radius} tile${def.shelters.radius > 1 ? 's' : ''} of it.`,
    );
  if (def.stormProof) lines.push("Storms can't damage it.");
  if (def.tall) lines.push('Tall: it shades the solar next to it.');
  if (def.weir) lines.push('Halves the flooded area; the river above becomes reservoir.');
  if (def.levee)
    lines.push(
      `Keeps the ${content.events.flood?.name.toLowerCase() ?? 'flood'} off the land within ${def.levee.radius} tiles.`,
    );
  if (def.floodTolerant)
    lines.push(`Survives the ${content.events.flood?.name.toLowerCase() ?? 'flood'}.`);
  if (def.saltProof) lines.push("The king tide's salt doesn't touch it.");
  if (def.restsIn.some(Boolean)) lines.push(`Rests in ${seasonNames(def.restsIn)}.`);
  if (def.workers) lines.push(`Needs ${def.workers} worker${def.workers > 1 ? 's' : ''}.`);
  return lines;
}

/** Farmland: silt from the flood, and (without the water system) the low river far from water. */
function farmland(content: Content, def: BuildingDef): string[] {
  const out: string[] = [];
  const flood = content.events.flood;
  if (flood && flood.siltBonus > 0 && flood.siltSeasons.length > 0)
    out.push(
      `Farmland: if the ${flood.name.toLowerCase()} reaches it, +${Math.round(flood.siltBonus * 100)}% food in ${flood.siltSeasons.join(' and ')} (silt).`,
    );
  if (flood?.salt)
    out.push(
      `If the ${flood.name.toLowerCase()} reaches it, salt: ×${flood.salt.factor} food for ${flood.salt.seasons} seasons.`,
    );
  const low = content.events.lowRiver;
  if (low && !content.rules.water.enabled && !def.ignoresLowRiver)
    out.push(
      `In a low-river season, ×${low.farYieldFactor} food more than ${low.farFromWaterDistance} tiles from water.`,
    );
  return out;
}

/** "summer and autumn" from per-season flags. */
function seasonNames(flags: readonly boolean[]): string {
  const on = SEASONS.filter((_, i) => flags[i]);
  if (on.length === 4) return 'every season';
  return on.length <= 1 ? (on[0] ?? 'no season') : `${on.slice(0, -1).join(', ')} and ${on.at(-1)}`;
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
