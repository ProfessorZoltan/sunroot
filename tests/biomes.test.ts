/**
 * Biomes (Milestone 11, B1): Root City is shared by every biome, each biome
 * is its own content, and a second biome loads beside Willow Reach without
 * changing it.
 */
import { describe, expect, it } from 'vitest';
import { BIOMES, biomeContent, loadBiome, rootCity, willowReach } from '../src/content';
import { applyCommand, createRun, makeSave, readSave, type RunState } from '../src/sim';
import { forBiome, runModifiers } from '../src/sim/content/modifiers';

/** A second biome for the tests: Willow Reach without its river wheel, orchards and weirs. */
function testShore() {
  const raw = structuredClone(willowReach) as {
    id: string;
    name: string;
    buildings: { id: string }[];
    combos: { id: string; from?: string; into?: string; links?: unknown }[];
  };
  raw.id = 'testShore';
  raw.name = 'Test Shore';
  const gone = ['riverWheel', 'orchard', 'ciderPress'];
  raw.buildings = raw.buildings.filter((b) => !gone.includes(b.id));
  // Combos and cards that name them go too.
  const names = (x: unknown) => gone.some((id) => JSON.stringify(x).includes(`"${id}"`));
  raw.combos = raw.combos.filter((c) => !names(c));
  for (const key of ['tunings', 'charters', 'visions', 'projects', 'twists', 'regions', 'wildlife'])
    (raw as unknown as Record<string, unknown[]>)[key] = (
      (raw as unknown as Record<string, unknown[]>)[key] ?? []
    ).filter((x) => !names(x));
  const t = (raw as unknown as { tempest: { levels: unknown[] } }).tempest;
  t.levels = t.levels.filter((x) => !names(x));
  // Rules and buildings that name them.
  const r = raw as unknown as {
    rules: { expectations?: { perBuilding: Record<string, number> } };
    buildings: { id: string; neighborFoodBonus?: { targets?: string[] } }[];
  };
  for (const id of gone) delete r.rules.expectations?.perBuilding[id];
  for (const b of r.buildings) {
    const t = b.neighborFoodBonus?.targets;
    if (t) b.neighborFoodBonus!.targets = t.filter((id) => !gone.includes(id));
  }
  const guided = (raw as unknown as { guidedYear: string[][] }).guidedYear;
  for (const offer of guided)
    offer.splice(0, offer.length, ...offer.filter((id) => !gone.includes(id)));
  return raw;
}

describe('Root City is shared by every biome', () => {
  it("Willow Reach has Root City's districts, landmarks, city requests and progression", () => {
    const c = biomeContent('willowReach');
    expect(c.districts.map((d) => d.id)).toEqual(rootCity.districts.map((d) => d.id));
    expect(c.landmarks.map((l) => l.id)).toEqual(rootCity.landmarks.map((l) => l.id));
    expect(c.requests.map((r) => r.id)).toEqual(rootCity.requests.map((r) => r.id));
    expect(c.progression).toBeDefined();
  });

  it('a biome may not define them itself', () => {
    const raw = { ...structuredClone(willowReach), districts: [] };
    expect(() => loadBiome(raw)).toThrow(/the biome defines districts, which Root City shares/);
  });

  it('everything Root City names is in some biome', () => {
    const all = Object.keys(BIOMES).map((id) => biomeContent(id));
    const card = (id: string) =>
      all.some((c) => c.byId[id] || c.tuningById[id] || c.charterById[id]);
    for (const d of rootCity.districts) {
      expect(card(d.adds), `${d.id} adds ${d.adds}`).toBeTruthy();
      const named = d.perks.flatMap((p) =>
        (p.modifiers as { target: string; id?: string }[]).filter((m) => m.target === 'building'),
      );
      for (const m of named)
        expect(
          all.some((c) => c.byId[m.id!]),
          `${d.id} names ${m.id}`,
        ).toBe(true);
    }
  });
});

describe('a second biome beside Willow Reach', () => {
  const shore = loadBiome(testShore());
  const reach = biomeContent('willowReach');

  it('loads, and plays a season', () => {
    expect(shore.id).toBe('testShore');
    expect(shore.byId.riverWheel).toBeUndefined();
    let s: RunState = createRun(shore, { seed: 'shore' });
    s = { ...s, draft: { ...s.draft, picked: s.draft.offer[0] ?? null } };
    const next = applyCommand(shore, s, { type: 'endSeason' });
    expect(next.ok).toBe(true);
  });

  it("Root City's perks for what it lacks are left out there, and kept in the Reach", () => {
    const city = { districts: { millraceQuarter: 'heartwood' }, landmarks: ['ciderMill'] };
    const run = (c: typeof shore) => createRun(c, { seed: 'perks', city });
    // The Millrace Quarter's cheaper river wheels and the Cider Mill's orchards.
    expect(runModifiers(shore, run(shore))).toEqual([]);
    expect(runModifiers(reach, run(reach)).map((m) => m.id)).toEqual(['riverWheel', 'orchard']);
    expect(
      forBiome(shore, [{ target: 'building', id: 'riverWheel', path: 'cost', add: -1 }]),
    ).toEqual([]);
    // A card it can't place is never offered: the Cider Press (the Orchard Ward's).
    const ward = createRun(shore, {
      seed: 'ward',
      city: { districts: { orchardWard: 'seedling' }, landmarks: [] },
    });
    expect(ward.draft.offer).not.toContain('ciderPress');
  });

  it("each biome's saves are its own", () => {
    const run = createRun(shore, { seed: 'save' });
    const save = makeSave(run, '2026-10-02T00:00:00Z');
    expect(readSave(shore, save).ok).toBe(true);
    const other = readSave(reach, save);
    expect(other.ok).toBe(false);
    expect(other.ok ? '' : other.error).toBe('the save is for testShore');
  });
});
