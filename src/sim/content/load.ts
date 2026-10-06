import { applyModifiers, forBiome } from './modifiers';
import {
  AUTO_RECIPE,
  ContentSchema,
  type BuildingDef,
  type Charter,
  type Combo,
  type ContentData,
  type Tuning,
} from './schema';

/** Validated, indexed content. Treat as read-only. */
export interface Content extends ContentData {
  byId: Record<string, BuildingDef>;
  comboById: Record<string, Combo>;
  tuningById: Record<string, Tuning>;
  charterById: Record<string, Charter>;
  /**
   * Every biome Root City can send expeditions to, by id, this one included: set by the
   * game's content registry (src/content). Content loaded on its own has none, and its city
   * goes only to its own biome.
   */
  atlas?: Record<string, Content>;
}

/**
 * Validates raw content (usually a JSON import) and checks cross references.
 * Throws with every problem listed if the data is invalid.
 */
export function loadContent(raw: unknown, options: { checkModifiers?: boolean } = {}): Content {
  const parsed = ContentSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid content:\n${lines.join('\n')}`);
  }
  const data = parsed.data;
  const byId: Record<string, BuildingDef> = {};
  const problems: string[] = [];
  for (const b of data.buildings) {
    if (byId[b.id]) problems.push(`duplicate building id ${b.id}`);
    byId[b.id] = b;
  }
  const known = (id: string, where: string) => {
    if (!byId[id]) problems.push(`${where} names unknown building ${id}`);
  };
  known(data.campBuilding, 'campBuilding');
  data.rules.demolition.salvagedBy.forEach((id) => known(id, 'rules.demolition.salvagedBy'));
  for (const id of Object.keys(data.rules.expectations?.perBuilding ?? {}))
    known(id, 'rules.expectations.perBuilding');
  data.guidedYear.forEach((offer, i) => offer.forEach((id) => known(id, `guidedYear[${i}]`)));
  for (const b of data.buildings) {
    b.neighborFoodBonus?.targets?.forEach((id) => known(id, `${b.id}.neighborFoodBonus`));
    b.neighborFoodBonus?.disabledNextTo.forEach((id) => known(id, `${b.id}.neighborFoodBonus`));
    b.harmonyPenalty?.cancelledByNeighbor.forEach((id) => known(id, `${b.id}.harmonyPenalty`));
    b.weir?.downstreamFoodPenalty.targets.forEach((id) => known(id, `${b.id}.weir`));
    b.placement.adjacentToBuildings?.forEach((id) => known(id, `${b.id}.placement`));
    b.heatFromNeighbors?.forEach((id) => known(id, `${b.id}.heatFromNeighbors`));
    b.heatFuel?.freeNextTo.forEach((id) => known(id, `${b.id}.heatFuel`));
    if (b.spawns) known(b.spawns.building, `${b.id}.spawns`);
    if (b.placement.adjacentToBuildings && !b.placement.adjacentTo) {
      problems.push(`${b.id}.placement.adjacentToBuildings needs adjacentTo`);
    }
    const auto = b.recipes?.defaultRecipe === AUTO_RECIPE && b.recipes.options.length > 1;
    if (b.recipes && !auto && !b.recipes.options.some((o) => o.id === b.recipes!.defaultRecipe)) {
      problems.push(`${b.id}.recipes.defaultRecipe is not one of its options (or auto)`);
    }
  }
  known(data.rules.water.channelBuilding, 'rules.water.channelBuilding');
  if (!data.buildings.find((b) => b.id === data.rules.water.channelBuilding)?.water?.channel)
    problems.push('rules.water.channelBuilding must be a building with water.channel');
  for (const c of data.combos) checkCombo(c, known);
  for (const g of data.eraGoals) {
    if (g.era > data.rules.eras.length)
      problems.push(`era goal for era ${g.era}, but there are ${data.rules.eras.length} eras`);
  }
  const tierIds = data.rules.score.tiers.map((t) => t.id);
  const p = data.progression;
  for (const id of Object.keys(p?.upgradeCost ?? {})) {
    if (!tierIds.includes(id)) problems.push(`progression names unknown tier ${id}`);
  }
  const districtIds = new Set(data.districts.map((d) => d.id));
  for (const t of data.tunings) if (t.building) known(t.building, `tuning ${t.id}`);
  // Root City is shared by every biome: its districts may name buildings and cards a biome
  // doesn't have (they are left out there); every name is checked against some biome by the
  // biomes test instead.
  for (const d of data.districts) {
    if (d.perks.length !== data.rules.score.tiers.length)
      problems.push(`district ${d.id} needs a perk for each of the ${tierIds.length} tiers`);
  }
  for (const l of data.landmarks) {
    for (const id of [l.district, ...l.nextTo.districts])
      if (!districtIds.has(id)) problems.push(`landmark ${l.id} names unknown district ${id}`);
  }
  const cards = new Set(data.buildings.map((b) => b.id));
  for (const t of data.tunings) {
    if (cards.has(t.id)) problems.push(`tuning ${t.id} has the same id as a draft card`);
    cards.add(t.id);
  }
  const unique = (ids: string[], what: string) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) problems.push(`duplicate ${what} id ${id}`);
      seen.add(id);
    }
  };
  unique(
    data.combos.map((c) => c.id),
    'combo',
  );
  unique(
    data.charters.map((c) => c.id),
    'charter',
  );
  unique(
    data.visions.map((v) => v.id),
    'vision',
  );
  unique(
    data.districts.map((d) => d.id),
    'district',
  );
  unique(
    data.landmarks.map((l) => l.id),
    'landmark',
  );
  unique(
    data.keepsakes.map((k) => k.id),
    'keepsake',
  );
  unique(
    data.projects.map((p) => p.id),
    'project',
  );
  unique(
    data.twists.map((t) => t.id),
    'twist',
  );
  unique(
    data.requests.map((r) => r.id),
    'request',
  );
  unique(
    data.regions.map((r) => r.id),
    'region',
  );
  unique(
    data.tempest.levels.map((l) => l.id),
    'Tempest level',
  );
  unique(
    data.wildlife.map((a) => a.id),
    'animal',
  );
  unique(
    data.festivals.map((f) => f.id),
    'festival',
  );
  for (const a of data.wildlife) {
    const where = `wildlife ${a.id}`;
    const h = a.habitat;
    (h.kind === 'tiles'
      ? (h.nextToBuildings ?? [])
      : h.kind === 'building'
        ? h.buildings
        : []
    ).forEach((id) => known(id, where));
    if (h.kind === 'edges' && !data.buildings.some((b) => b.edge))
      problems.push(`${where} lives along edges, but nothing here is built on them`);
    const e = a.effect;
    if (e.kind === 'nextToTiles' || e.kind === 'nearHabitat')
      e.buildings.forEach((id) => known(id, where));
    if (e.kind === 'evolution') {
      // The animals are what the evolution waits for: it needs the same Harmony.
      const combo = data.combos.find((c) => c.id === e.combo);
      if (!combo || combo.layer !== 'evolution' || combo.when.kind !== 'nextTo')
        problems.push(`${where} names ${e.combo}, not an evolution by neighbours`);
      else if (combo.when.minHarmony !== a.harmony)
        problems.push(
          `${where} arrives at Harmony ${a.harmony} but ${e.combo} needs ${combo.when.minHarmony}`,
        );
    }
  }
  // Rainforest Gardens' soil and layers.
  for (const b of data.buildings) {
    // A forest garden's layers grow anywhere (the Canopy Quarter's card); its soil is the forest's.
    const forest = b.burns || b.fertilityFood > 0 || b.midden || b.charcoal;
    if (forest && !data.rules.forest) problems.push(`${b.id} needs rules.forest`);
    const ids = (b.layers ?? []).map((l) => l.id);
    if (new Set(ids).size !== ids.length) problems.push(`${b.id}.layers has a layer twice`);
    for (const l of b.layers ?? [])
      for (const h of l.helps)
        if (h.layer !== 'ground' && !ids.includes(h.layer))
          problems.push(`${b.id}.layers.${l.id} helps ${h.layer}, which is not one of its layers`);
  }
  for (const b of data.buildings) {
    const w = b.wonder;
    if (!w) continue;
    w.needsLoops.forEach((id) => {
      if (!data.combos.some((c) => c.id === id && c.layer === 'chain'))
        problems.push(`${b.id}.wonder needs ${id}, which is not a loop`);
    });
    Object.keys(w.needsBuildings).forEach((id) => known(id, `${b.id}.wonder`));
    if (b.draftable) problems.push(`${b.id} is a wonder: it joins at its era, not in the draft`);
  }
  const wonderGoals = [
    ...data.visions.map((v) => v.goal),
    ...data.eraGoals.flatMap((g) => [g.goal, ...(g.or ? [g.or.goal] : [])]),
  ];
  for (const goal of wonderGoals) {
    if (goal.kind === 'wonder' && !byId[goal.building]?.wonder)
      problems.push(`a goal names ${goal.building}, which is not a wonder`);
  }
  for (const id of data.calendar)
    if (!data.events[id]) problems.push(`the calendar names ${id}, which has no event`);
  const { harmony } = data.rules;
  if (!harmony.tiers.every((t, i, a) => i === 0 || t.min > a[i - 1]!.min)) {
    problems.push('rules.harmony.tiers must be sorted by min');
  }
  if (!data.rules.score.tiers.every((t, i, a) => i === 0 || t.min > a[i - 1]!.min)) {
    problems.push('rules.score.tiers must be sorted by min');
  }
  if (problems.length > 0) throw new Error(`Invalid content:\n  ${problems.join('\n  ')}`);
  const content: Content = {
    ...data,
    byId,
    comboById: Object.fromEntries(data.combos.map((c) => [c.id, c])),
    tuningById: Object.fromEntries(data.tunings.map((t) => [t.id, t])),
    charterById: Object.fromEntries(data.charters.map((c) => [c.id, c])),
  };
  // Every modifier (tunings, charters, landmarks, twists, regions, perks) must apply cleanly (valid paths, valid results).
  if (options.checkModifiers ?? true) {
    const sources = [
      ...data.tunings,
      ...data.charters,
      ...data.landmarks.map((l) => ({ id: l.id, modifiers: forBiome(content, l.modifiers) })),
      ...data.twists,
      ...data.regions,
      // Each Tempest level with every level below it, as a run plays it.
      ...data.tempest.levels.map((l, i) => ({
        id: l.id,
        modifiers: data.tempest.levels.slice(0, i + 1).flatMap((x) => x.modifiers),
      })),
      ...data.rules.eraModifiers.map((m) => ({ id: `era ${m.era}`, modifiers: m.modifiers })),
      ...data.projects.map((p) => ({ id: p.id, modifiers: p.effect.modifiers })),
      ...data.buildings
        .filter((b) => b.wonder && b.wonder.modifiers.length > 0)
        .map((b) => ({ id: b.id, modifiers: b.wonder!.modifiers })),
      ...data.districts.flatMap((d) =>
        d.perks.map((perk, i) => ({
          id: `${d.id} perk ${i + 1}`,
          modifiers: forBiome(content, perk.modifiers),
        })),
      ),
    ];
    for (const card of sources) {
      try {
        applyModifiers(content, card.modifiers);
      } catch (e) {
        throw new Error(`Invalid content:\n  ${card.id}: ${(e as Error).message}`, { cause: e });
      }
    }
  }
  return content;
}

function checkCombo(c: Combo, known: (id: string, where: string) => void): void {
  const where = `combo ${c.id}`;
  const all = (ids: string[] | undefined) => ids?.forEach((id) => known(id, where));
  switch (c.layer) {
    case 'adjacency':
      known(c.building, where);
      all(c.nextTo.buildings);
      all(c.notNextTo);
      break;
    case 'chain':
      c.links.forEach((l) => all(l.buildings));
      break;
    case 'formation':
      if (c.shape.kind === 'ring') {
        known(c.shape.center, where);
        all(c.shape.of);
      }
      if (c.shape.kind === 'cluster') all(c.shape.buildings);
      if (c.shape.kind === 'line') all(c.shape.sequence);
      if (c.shape.kind === 'layered') known(c.shape.building, where);
      if (c.shape.kind === 'cover') all(c.shape.buildings);
      if (c.effect.appliesTo) known(c.effect.appliesTo, where);
      break;
    case 'evolution':
      // A coppice starts from a tile, not a building.
      if (c.when.kind !== 'coppiced') known(c.from, where);
      known(c.into, where);
      if (c.when.kind === 'nextTo') {
        all(c.when.nextTo.buildings);
        all(c.when.also?.buildings);
      }
      if (c.when.kind === 'ruinExhausted') all(c.when.nextTo?.buildings);
      if (c.when.kind === 'placed') known(c.when.building, where);
      if (c.when.kind === 'coppiced') {
        all(c.when.nextTo.buildings);
        known(c.when.regrowth, where);
      }
      break;
  }
}

/** Root City's parts of the content, shared by every biome (DECISIONS.md, The Windswept Coast). */
export const WORLD_KEYS = [
  'districts',
  'landmarks',
  'requests',
  'keepsakes',
  'progression',
] as const;

/**
 * A biome's raw content with Root City's shared parts (districts, landmarks,
 * city requests, progression) from `world`. A biome may not define them itself.
 */
export function withWorld(world: unknown, biome: unknown): unknown {
  const w = world as Record<string, unknown>;
  const b = biome as Record<string, unknown>;
  const own = WORLD_KEYS.filter((k) => k in b);
  if (own.length > 0)
    throw new Error(
      `Invalid content:\n  the biome defines ${own.join(', ')}, which Root City shares`,
    );
  return { ...b, ...Object.fromEntries(WORLD_KEYS.filter((k) => k in w).map((k) => [k, w[k]])) };
}
