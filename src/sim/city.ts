/**
 * Root City (Milestone 8): the permanent home between runs. Like a run, the
 * city is plain data changed only by commands, so the same rules drive the
 * game, the tests and the progression check.
 *
 * Between runs the player places the Graft a run planted, spends Seeds to
 * raise districts' tiers, and chooses the next expedition. Districts give
 * their perk (the best tier of each kind counts) and add a card to future
 * drafts; neighbouring districts can form hidden landmarks. Filling every
 * slot with enough districts at Heartwood grows the Sun Tree: the ending.
 */
import type { Content } from './content/load';
import { HEX_DIRECTIONS, hexAdd, hexDistance, type Hex } from './hex';
import { createRng, shuffled } from './rng';
import type { RunCity, RunExpedition, RunOptions } from './types';

/** A district a finished run sends home, before and after it is placed. */
export interface Graft {
  district: string;
  tier: string;
  score: number;
  /** Seeds the run earned. */
  seeds: number;
  /** The run's seed. */
  seed: string;
  vision: string | null;
  visionAchieved: boolean;
  /** When it was sent (ISO time), supplied by the caller: the simulation has no clock. */
  sentAt: string;
  /** The run it came from (1 = the first), set when it reaches the city. */
  run?: number;
}

/** How a finished run was sent home: its Seeds, and its Graft if it was planted. */
export interface RunResult {
  /** Null when the Seeds were banked instead (too few to plant, or the player's choice). */
  graft: Graft | null;
  /** Seeds the run earned, and Seeds spent planting its Graft. */
  earned: number;
  spent: number;
}

export interface CityDistrict {
  /** Slot index: 0 to 5 the first ring, 6 to 17 the second. */
  slot: number;
  district: string;
  tier: string;
  /** Seeds spent raising its tier, for composting when it is replaced. */
  invested: number;
  /** The run (1 = the first) whose Graft it was. */
  run: number;
}

/** An expedition on offer: a valley (a map seed and a region), a twist and an optional city request. */
export interface Expedition {
  seed: string;
  twist: string;
  request: string | null;
  /** The valley's variation; null (or missing, in older saves) for the biome as it is. */
  region?: string | null;
}

export interface CityState {
  version: 2;
  contentId: string;
  /** Seeds the expedition offers and the first run's map. */
  seed: string;
  /** Runs finished and sent home, planted or not. */
  runs: number;
  /** Seeds in hand. */
  seeds: number;
  districts: CityDistrict[];
  /** Grafts planted and waiting for a slot, oldest first. */
  pending: Graft[];
  /** Every Graft ever planted, in order. */
  grafts: Graft[];
  /** Landmarks discovered, in order. */
  landmarks: string[];
  /** The expedition chosen for the next run, until the run begins. */
  expedition: Expedition | null;
  /** The number of runs it took to grow the Sun Tree, once grown. */
  sunTree: number | null;
}

export type CityCommand =
  | { type: 'sendHome'; result: RunResult }
  | { type: 'place'; slot: number }
  | { type: 'release' }
  | { type: 'upgrade'; slot: number }
  | { type: 'chooseExpedition'; index: number }
  | { type: 'embark' };

/** Something a command brought about, for the interface to reveal. */
export type CityEvent =
  | { kind: 'landmark'; id: string }
  | { kind: 'sunTree' }
  | { kind: 'composted'; district: string; seeds: number };

export type CityResult =
  { ok: true; city: CityState; events: CityEvent[] } | { ok: false; error: string };

export function createCity(content: Content, seed: string): CityState {
  return {
    version: 2,
    contentId: content.id,
    seed,
    runs: 0,
    seeds: 0,
    districts: [],
    pending: [],
    grafts: [],
    landmarks: [],
    expedition: null,
    sunTree: null,
  };
}

// ---------------------------------------------------------------------- layout

/** The Heartwood at the centre; district slots ring it, the first ring first. */
export function slotHexes(count: number): Hex[] {
  const hexes: Hex[] = [];
  for (let radius = 1; hexes.length < count; radius++) {
    // Walk the ring: start radius steps out, then radius steps along each side.
    let h: Hex = { q: HEX_DIRECTIONS[4]!.q * radius, r: HEX_DIRECTIONS[4]!.r * radius };
    for (let side = 0; side < 6; side++) {
      for (let step = 0; step < radius; step++) {
        hexes.push(h);
        h = hexAdd(h, HEX_DIRECTIONS[side]!);
      }
    }
  }
  return hexes.slice(0, count);
}

export function slotCount(content: Content): number {
  return content.progression?.ending.slots ?? 0;
}

/** Slots next to a slot (the Heartwood at the centre is not a slot). */
export function neighborSlots(content: Content, slot: number): number[] {
  const hexes = slotHexes(slotCount(content));
  const h = hexes[slot]!;
  return hexes.flatMap((o, i) => (hexDistance(o, h) === 1 ? [i] : []));
}

export function districtAt(city: CityState, slot: number): CityDistrict | undefined {
  return city.districts.find((d) => d.slot === slot);
}

export function isFull(content: Content, city: CityState): boolean {
  return city.districts.length >= slotCount(content);
}

// ------------------------------------------------------------------- landmarks

/** Landmarks whose arrangement stands in the city now. */
export function standingLandmarks(content: Content, city: CityState): string[] {
  return content.landmarks
    .filter((l) =>
      city.districts.some((d) => {
        if (d.district !== l.district) return false;
        const matches = neighborSlots(content, d.slot).filter((s) => {
          const n = districtAt(city, s);
          if (!n) return false;
          if (l.nextTo.districts.includes(n.district)) return true;
          return l.nextTo.green && content.districts.find((x) => x.id === n.district)?.green;
        }).length;
        return matches >= l.nextTo.count;
      }),
    )
    .map((l) => l.id);
}

// ---------------------------------------------------------------- what runs get

/** The best tier of each kind of district: perks don't stack, the best one counts. */
export function bestTiers(content: Content, city: CityState): Record<string, string> {
  const tiers = content.rules.score.tiers.map((t) => t.id);
  const best: Record<string, string> = {};
  for (const d of city.districts) {
    const now = best[d.district];
    if (now === undefined || tiers.indexOf(d.tier) > tiers.indexOf(now)) best[d.district] = d.tier;
  }
  return best;
}

export function runCity(content: Content, city: CityState): RunCity {
  return { districts: bestTiers(content, city), landmarks: standingLandmarks(content, city) };
}

export interface Teaching {
  run: number;
  guided: boolean;
  tunings: boolean;
  charters: boolean;
  visions: boolean;
  /** Systems joining at this run, for a card at its start. */
  joining: ('tunings' | 'charters' | 'visions')[];
  /** The next system to join and the run it joins, if any ("the next unlock is always visible"). */
  next: { system: 'tunings' | 'charters' | 'visions'; run: number } | null;
}

/** Teaching across runs: which systems a run (1 = the first) plays with. */
export function teaching(content: Content, run: number): Teaching {
  const t = content.progression?.teaching ?? {
    guidedUntil: 2,
    tunings: 1,
    charters: 1,
    visions: 1,
  };
  const systems = (['tunings', 'charters', 'visions'] as const).map((system) => ({
    system,
    run: t[system],
  }));
  const later = systems.filter((s) => s.run > run).sort((a, b) => a.run - b.run);
  return {
    run,
    guided: run < t.guidedUntil,
    tunings: run >= t.tunings,
    charters: run >= t.charters,
    visions: run >= t.visions,
    joining: systems.filter((s) => s.run === run && run > 1).map((s) => s.system),
    next: later[0] ?? null,
  };
}

/** The options for the city's next run: its teaching, Root City's gifts and the expedition. */
export function nextRunOptions(content: Content, city: CityState): RunOptions {
  const run = city.runs + 1;
  const t = teaching(content, run);
  const expedition: RunExpedition = city.expedition
    ? {
        twist: city.expedition.twist,
        request: city.expedition.request,
        region: city.expedition.region ?? null,
      }
    : { twist: null, request: null };
  return {
    seed: city.expedition?.seed ?? `${city.seed}-${run}`,
    guided: t.guided,
    visions: t.visions,
    tunings: t.tunings,
    charters: t.charters,
    city: runCity(content, city),
    expedition,
  };
}

/** The expeditions on offer before the next run: distinct regions, twists and requests, at random. */
export function expeditionOffer(content: Content, city: CityState): Expedition[] {
  const count = content.progression?.expeditionChoices ?? 3;
  const rng = createRng(`${city.seed}:expeditions:${city.runs}`);
  const twists = shuffled(
    rng,
    content.twists.map((t) => t.id),
  );
  const requests = shuffled(
    rng,
    content.requests.map((r) => r.id),
  );
  // Regions are drawn last, after the twists and requests.
  const regions = shuffled(
    rng,
    content.regions.map((r) => r.id),
  );
  const run = city.runs + 1;
  return Array.from({ length: count }, (_, i) => ({
    seed: `${city.seed}-${run}-${String.fromCharCode(97 + i)}`,
    twist: twists[i % Math.max(1, twists.length)] ?? 'none',
    request: requests[i] ?? null,
    region: regions[i] ?? null,
  }));
}

/** Whether the city must choose an expedition before its next run (not before the first). */
export function needsExpedition(content: Content, city: CityState): boolean {
  return city.runs > 0 && content.twists.length > 0 && city.expedition === null;
}

// -------------------------------------------------------------------- commands

export function applyCityCommand(
  content: Content,
  city: CityState,
  command: CityCommand,
): CityResult {
  const fail = (error: string): CityResult => ({ ok: false, error });
  const p = content.progression;
  if (!p) return fail('this content has no Root City');
  const tiers = content.rules.score.tiers.map((t) => t.id);
  const next: CityState = {
    ...city,
    districts: city.districts.map((d) => ({ ...d })),
    pending: [...city.pending],
    grafts: [...city.grafts],
    landmarks: [...city.landmarks],
  };
  const events: CityEvent[] = [];

  switch (command.type) {
    case 'sendHome': {
      const { graft, earned, spent } = command.result;
      if (earned < 0 || spent < 0) return fail('Seeds cannot be negative');
      if (next.seeds + earned < spent) return fail('not enough Seeds to plant the Graft');
      next.seeds += earned - spent;
      next.runs += 1;
      next.expedition = null;
      if (graft) {
        if (!content.districts.some((d) => d.id === graft.district))
          return fail(`unknown district ${graft.district}`);
        next.pending.push({ ...graft, run: next.runs });
        next.grafts.push({ ...graft, run: next.runs });
      }
      break;
    }
    case 'place': {
      const graft = next.pending[0];
      if (!graft) return fail('no Graft is waiting to be placed');
      if (command.slot < 0 || command.slot >= slotCount(content)) return fail('no such slot');
      const there = districtAt(next, command.slot);
      if (there) {
        if (!isFull(content, next)) return fail('place it in a free slot while there are some');
        // The city is full: the new Graft replaces this district, which composts.
        const back = Math.floor(there.invested * p.compostShare);
        next.seeds += back;
        next.districts = next.districts.filter((d) => d !== there);
        events.push({ kind: 'composted', district: there.district, seeds: back });
      }
      next.pending.shift();
      next.districts.push({
        slot: command.slot,
        district: graft.district,
        tier: graft.tier,
        invested: 0,
        run: graft.run ?? next.runs,
      });
      break;
    }
    case 'release': {
      if (next.pending.length === 0) return fail('no Graft is waiting');
      if (!isFull(content, next)) return fail('there are free slots for it');
      next.pending.shift();
      break;
    }
    case 'upgrade': {
      const d = districtAt(next, command.slot);
      if (!d) return fail('no district there');
      const up = tiers[tiers.indexOf(d.tier) + 1];
      if (!up) return fail('it is already at the highest tier');
      const cost = p.upgradeCost[up] ?? 0;
      if (next.seeds < cost) return fail(`raising it costs ${cost} Seeds`);
      next.seeds -= cost;
      d.tier = up;
      d.invested += cost;
      break;
    }
    case 'chooseExpedition': {
      if (next.pending.length > 0) return fail('place the Graft first');
      const offer = expeditionOffer(content, next)[command.index];
      if (!offer) return fail('no such expedition');
      next.expedition = offer;
      break;
    }
    case 'embark': {
      if (next.pending.length > 0) return fail('place the Graft first');
      if (needsExpedition(content, next)) return fail('choose an expedition first');
      next.expedition = null;
      break;
    }
  }

  // Landmarks are discovered the first time their arrangement stands.
  for (const id of standingLandmarks(content, next)) {
    if (!next.landmarks.includes(id)) {
      next.landmarks.push(id);
      events.push({ kind: 'landmark', id });
    }
  }
  if (next.sunTree === null && sunTreeGrown(content, next)) {
    next.sunTree = next.runs;
    events.push({ kind: 'sunTree' });
  }
  return { ok: true, city: next, events };
}

/** The ending: every slot filled, and enough districts at the highest tier. */
export function sunTreeGrown(content: Content, city: CityState): boolean {
  const p = content.progression;
  if (!p) return false;
  const top = content.rules.score.tiers.at(-1)!.id;
  const topCount = city.districts.filter((d) => d.tier === top).length;
  return isFull(content, city) && topCount >= p.ending.heartwoodDistricts;
}

/** How far the Sun Tree has come: slots filled and districts at Heartwood. */
export function sunTreeProgress(
  content: Content,
  city: CityState,
): { filled: number; slots: number; heartwood: number; needed: number } {
  const top = content.rules.score.tiers.at(-1)!.id;
  return {
    filled: city.districts.length,
    slots: slotCount(content),
    heartwood: city.districts.filter((d) => d.tier === top).length,
    needed: content.progression?.ending.heartwoodDistricts ?? 0,
  };
}

// ----------------------------------------------------------------------- saves

export const CITY_FORMAT = 'sunroot-city';

export interface CitySave {
  format: typeof CITY_FORMAT;
  version: 2;
  contentId: string;
  savedAt: string;
  city: CityState;
}

export function makeCitySave(city: CityState, savedAt: string): CitySave {
  return { format: CITY_FORMAT, version: 2, contentId: city.contentId, savedAt, city };
}

export type ReadCity = { ok: true; city: CityState } | { ok: false; error: string };

/**
 * Reads a city save. Also reads the city kept before Milestone 8 (version 1:
 * the Grafts sent home, Seeds and runs), whose Grafts become waiting to be
 * placed. `seed` is for a city that had none.
 */
export function readCity(content: Content, data: unknown, seed: string): ReadCity {
  const fail = (error: string): ReadCity => ({ ok: false, error });
  if (!data || typeof data !== 'object') return fail('not a city save');
  const d = data as Record<string, unknown>;
  if (d.version === 1 && Array.isArray(d.grafts)) {
    const grafts = (d.grafts as Graft[]).filter((g) =>
      content.districts.some((x) => x.id === g?.district),
    );
    return {
      ok: true,
      city: {
        ...createCity(content, seed),
        seeds: typeof d.seeds === 'number' ? d.seeds : 0,
        runs: typeof d.runs === 'number' ? d.runs : grafts.length,
        pending: grafts,
        grafts,
      },
    };
  }
  if (d.format !== CITY_FORMAT) return fail('not a Sunroot city save');
  if (d.version !== 2) return fail(`city save version ${String(d.version)} is not supported`);
  if (d.contentId !== content.id) return fail(`the city is for ${String(d.contentId)}`);
  const city = d.city as CityState | undefined;
  if (!city || typeof city !== 'object') return fail('the save has no city');
  const missing = Object.keys(createCity(content, seed)).filter((k) => !(k in city));
  if (missing.length > 0) return fail(`the city is missing ${missing.join(', ')}`);
  for (const x of [...city.districts, ...city.pending]) {
    if (!content.districts.some((c) => c.id === x.district))
      return fail(`unknown district ${x.district}`);
  }
  return { ok: true, city };
}
