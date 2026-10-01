import { applyModifiers } from './modifiers';
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
    if (b.placement.adjacentToBuildings && !b.placement.adjacentTo) {
      problems.push(`${b.id}.placement.adjacentToBuildings needs adjacentTo`);
    }
    const auto = b.recipes?.defaultRecipe === AUTO_RECIPE && b.recipes.options.length > 1;
    if (b.recipes && !auto && !b.recipes.options.some((o) => o.id === b.recipes!.defaultRecipe)) {
      problems.push(`${b.id}.recipes.defaultRecipe is not one of its options (or auto)`);
    }
  }
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
  const cardIds = new Set([
    ...data.buildings.map((b) => b.id),
    ...data.tunings.map((t) => t.id),
    ...data.charters.map((c) => c.id),
  ]);
  for (const t of data.tunings) if (t.building) known(t.building, `tuning ${t.id}`);
  for (const d of data.districts) {
    d.signature.sources.forEach((id) => known(id, `district ${d.id}`));
    if (!cardIds.has(d.adds)) problems.push(`district ${d.id} adds unknown card ${d.adds}`);
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
      ...data.landmarks,
      ...data.twists,
      ...data.regions,
      ...data.rules.eraModifiers.map((m) => ({ id: `era ${m.era}`, modifiers: m.modifiers })),
      ...data.projects.map((p) => ({ id: p.id, modifiers: p.effect.modifiers })),
      ...data.districts.flatMap((d) =>
        d.perks.map((perk, i) => ({ id: `${d.id} perk ${i + 1}`, modifiers: perk.modifiers })),
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
      if (c.shape.kind === 'ring') known(c.shape.center, where);
      if (c.shape.kind === 'line') all(c.shape.sequence);
      if (c.effect.appliesTo) known(c.effect.appliesTo, where);
      break;
    case 'evolution':
      known(c.from, where);
      known(c.into, where);
      if (c.when.kind === 'nextTo') all(c.when.nextTo.buildings);
      if (c.when.kind === 'placed') known(c.when.building, where);
      break;
  }
}
