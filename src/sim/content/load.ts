import { ContentSchema, type BuildingDef, type ContentData } from './schema';

/** Validated, indexed content. Treat as read-only. */
export interface Content extends ContentData {
  byId: Record<string, BuildingDef>;
}

/**
 * Validates raw content (usually a JSON import) and checks cross references.
 * Throws with every problem listed if the data is invalid.
 */
export function loadContent(raw: unknown): Content {
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
  data.guidedYear.forEach((offer, i) => offer.forEach((id) => known(id, `guidedYear[${i}]`)));
  for (const b of data.buildings) {
    b.neighborFoodBonus?.targets?.forEach((id) => known(id, `${b.id}.neighborFoodBonus`));
    b.neighborFoodBonus?.disabledNextTo.forEach((id) => known(id, `${b.id}.neighborFoodBonus`));
    b.harmonyPenalty?.cancelledByNeighbor.forEach((id) => known(id, `${b.id}.harmonyPenalty`));
    b.weir?.downstreamFoodPenalty.targets.forEach((id) => known(id, `${b.id}.weir`));
    if (b.recipes && !b.recipes.options.some((o) => o.id === b.recipes!.defaultRecipe)) {
      problems.push(`${b.id}.recipes.defaultRecipe is not one of its options`);
    }
  }
  const { harmony } = data.rules;
  if (!harmony.tiers.every((t, i, a) => i === 0 || t.min > a[i - 1]!.min)) {
    problems.push('rules.harmony.tiers must be sorted by min');
  }
  if (problems.length > 0) throw new Error(`Invalid content:\n  ${problems.join('\n  ')}`);
  return { ...data, byId };
}
