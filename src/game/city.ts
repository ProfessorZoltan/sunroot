/**
 * Where Root City is kept: a versioned city save (src/sim/city.ts) in its
 * own IndexedDB slot. A city kept by an older build in localStorage (the
 * Grafts sent home before Milestone 8) is read once and moved over.
 */
import { createCity, makeCitySave, readCity, type CityState, type Content } from '../sim';
import { forgetAlmanac } from './almanac';
import type { SaveSlot } from './saves';

export type { CityState, Graft, RunResult } from '../sim';

const OLD_KEY = 'sunroot:city';

export interface LoadedCity {
  city: CityState;
  /** Set when a saved city couldn't be read and a new one was begun. */
  problem: string | null;
}

/** The saved city, the old one moved over, or a new one with this seed. */
export async function loadCity(
  content: Content,
  slot: SaveSlot,
  storage: Storage | null,
  seed: string,
): Promise<LoadedCity> {
  const data = await slot.load();
  if (data !== undefined) {
    const read = readCity(content, data, seed);
    if (read.ok) return { city: read.city, problem: null };
    return { city: createCity(content, seed), problem: read.error };
  }
  let old: unknown;
  try {
    old = JSON.parse(storage?.getItem(OLD_KEY) ?? 'null');
  } catch {
    old = null;
  }
  if (old) {
    const read = readCity(content, old, seed);
    if (read.ok) {
      await saveCity(slot, read.city, new Date().toISOString());
      try {
        storage?.removeItem(OLD_KEY);
      } catch {
        // Blocked storage: the old copy stays, and the new save is read first anyway.
      }
      return { city: read.city, problem: null };
    }
  }
  return { city: createCity(content, seed), problem: null };
}

/**
 * Start over: forgets Root City and the run in progress, so the next visit
 * begins at run 1 as a new player's would. The Almanac goes too if asked;
 * the playtest log and sound settings stay.
 */
export async function startOver(
  content: Content,
  slots: { run: SaveSlot; city: SaveSlot },
  storage: Storage | null,
  options: { almanac: boolean },
): Promise<void> {
  await Promise.all([slots.run.clear(), slots.city.clear()]);
  try {
    storage?.removeItem(OLD_KEY);
  } catch {
    // Blocked storage: no old city could have been kept there.
  }
  if (options.almanac) forgetAlmanac(content, storage);
}

export function saveCity(slot: SaveSlot, city: CityState, savedAt: string): Promise<void> {
  return slot.save(makeCitySave(city, savedAt));
}
