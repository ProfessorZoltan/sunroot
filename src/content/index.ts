/**
 * The game's content: Root City, shared by every biome, and each biome
 * (DECISIONS.md, The Windswept Coast). A biome's content is its own file
 * merged with Root City's districts, landmarks, city requests and progression.
 */
import { loadContent, withWorld, type Content } from '../sim/content/load';
import rootCity from './root-city.json';
import willowReach from './willow-reach.json';
import windsweptCoast from './windswept-coast.json';

export { rootCity, willowReach, windsweptCoast };

/** A biome's raw content (its own file, or a changed copy of one) loaded with Root City's. */
export function loadBiome(
  raw: unknown,
  options: { checkModifiers?: boolean } = {},
  world: unknown = rootCity,
): Content {
  return loadContent(withWorld(world, raw), options);
}

/** Every biome's raw content, by id. */
export const BIOMES: Record<string, unknown> = { willowReach, windsweptCoast };

/** The biome a run starts in until there is a choice (DECISIONS.md, The Windswept Coast). */
export const HOME_BIOME = 'willowReach';

const loaded = new Map<string, Content>();

/** A biome's content, loaded once. */
export function biomeContent(id: string): Content {
  let content = loaded.get(id);
  if (!content) {
    const raw = BIOMES[id];
    if (!raw) throw new Error(`unknown biome ${id}`);
    content = loadBiome(raw);
    // Every biome Root City can reach, loaded when first asked for (not copied with the content).
    Object.defineProperty(content, 'atlas', {
      enumerable: false,
      get: () => Object.fromEntries(Object.keys(BIOMES).map((b) => [b, biomeContent(b)])),
    });
    loaded.set(id, content);
  }
  return content;
}
