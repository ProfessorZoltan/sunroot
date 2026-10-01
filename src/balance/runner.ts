/** Plays one run with a bot and records what the balance report needs. */
import {
  applyCommand,
  createRun,
  graftOffer,
  scoreRun,
  SEASONS,
  type Content,
  type RunState,
} from '../sim';
import { createRng } from '../sim/rng';
import type { Bot } from './bots';
import { Turn } from './turn';

export interface RunRecord {
  seed: string;
  bot: string;
  status: 'complete' | 'collapsed';
  seasons: number;
  score: number;
  /** The Graft tier the score earns. */
  tier: string;
  vision: string;
  /** The season the vision was achieved, or -1. */
  visionAchieved: number;
  /** The two districts offered as the Graft, best match first. */
  graft: string[];
  citizens: number;
  peakCitizens: number;
  wellbeing: number;
  harmony: number;
  materials: number;
  food: number;
  clutter: number;
  /** Seasons in which the bot built or changed nothing, by era. */
  idleByEra: number[];
  /** Seasons with at least one blackout, by season of the year. */
  blackoutsBySeason: number[];
  shortfall: number;
  unfedCitizenSeasons: number;
  /** Food made and eaten from year 2 on (the "is food too easy after Year 1?" question). */
  foodMadeAfterY1: number;
  foodEatenAfterY1: number;
  foodRotted: number;
  /** Where scraps came from, how much became clutter, and how much clutter was recycled. */
  scrapsFromCitizens: number;
  scrapsFromRot: number;
  clutterFromScraps: number;
  clutterRecycled: number;
  /** Seasons that ended with food storage full. */
  storageFullSeasons: number;
  energyBySource: Record<string, number>;
  heatPumped: number;
  heatFree: number;
  /** Total wellbeing lost to each cause over the run (positive numbers). */
  wellbeingLost: { hunger: number; unpowered: number; clutter: number };
  /** The biggest wellbeing drain over the last 4 seasons of a collapsed run. */
  collapseCause: string;
  picks: string[];
  /** Times each card was on offer at the start of a season. */
  offered: Record<string, number>;
  /** The season (turn) each card was picked. */
  pickTurns: Record<string, number>;
  /** Seasons with nothing left to draft. */
  emptyDraftSeasons: number;
  built: Record<string, number>;
}

const MAX_SEASONS = 1000;

export function playRun(
  content: Content,
  bot: Bot,
  seed: string,
  options: { guided?: boolean; onSeason?: (state: RunState) => void } = {},
): RunRecord {
  let state = createRun(content, { seed, guided: options.guided ?? false, visions: true });
  const rng = createRng(`${seed}:bot:${bot.name}`);
  const record: RunRecord = {
    seed,
    bot: bot.name,
    status: 'complete',
    seasons: 0,
    score: 0,
    tier: '',
    vision: '',
    visionAchieved: -1,
    graft: [],
    citizens: 0,
    peakCitizens: state.citizens,
    wellbeing: 0,
    harmony: 0,
    materials: 0,
    food: 0,
    clutter: 0,
    idleByEra: content.rules.eras.map(() => 0),
    blackoutsBySeason: SEASONS.map(() => 0),
    shortfall: 0,
    unfedCitizenSeasons: 0,
    foodMadeAfterY1: 0,
    foodEatenAfterY1: 0,
    foodRotted: 0,
    scrapsFromCitizens: 0,
    scrapsFromRot: 0,
    clutterFromScraps: 0,
    clutterRecycled: 0,
    storageFullSeasons: 0,
    energyBySource: {},
    heatPumped: 0,
    heatFree: 0,
    wellbeingLost: { hunger: 0, unpowered: 0, clutter: 0 },
    collapseCause: '',
    picks: [],
    offered: {},
    pickTurns: {},
    emptyDraftSeasons: 0,
    built: {},
  };
  const recentLosses: Record<string, number>[] = [];

  for (let guard = 0; state.status === 'active' && guard < MAX_SEASONS; guard++) {
    const era = state.era;
    for (const card of state.draft.offer) record.offered[card] = (record.offered[card] ?? 0) + 1;
    if (state.draft.offer.length === 0) record.emptyDraftSeasons += 1;
    const turn = new Turn(content, state, rng);
    bot.playSeason(turn);
    state = turn.state;
    if (state.draft.offer.length > 0 && !state.draft.picked) {
      state = ok(applyCommand(content, state, { type: 'pickCard', card: state.draft.offer[0]! }));
    }
    // Visions and charters: the first on offer (the offers are already shuffled).
    if (state.visionOffer.length > 0) {
      const vision = state.visionOffer[0]!;
      state = ok(applyCommand(content, state, { type: 'pickVision', vision }));
    }
    if (state.charterOffer.length > 0) {
      const charter = state.charterOffer[0]!;
      state = ok(applyCommand(content, state, { type: 'pickCharter', charter }));
    }
    if (state.draft.picked) {
      record.picks.push(state.draft.picked);
      record.pickTurns[state.draft.picked] = state.turn;
    }
    if (turn.actions === 0) record.idleByEra[era - 1]! += 1;
    for (const c of state.seasonCommands) {
      if (c.type === 'place') record.built[c.building] = (record.built[c.building] ?? 0) + 1;
    }

    state = ok(applyCommand(content, state, { type: 'endSeason' }));
    options.onSeason?.(state);
    const r = state.lastReport!;
    const si = SEASONS.indexOf(r.season);
    if (r.blackouts.length > 0) record.blackoutsBySeason[si]! += 1;
    record.shortfall += r.energy.day.shortfall + r.energy.night.shortfall;
    record.unfedCitizenSeasons += r.food.unfed;
    if (r.year > 1) {
      record.foodMadeAfterY1 += r.food.produced;
      record.foodEatenAfterY1 += r.food.eaten;
    }
    record.foodRotted += r.food.rotted;
    record.scrapsFromCitizens += r.scraps.fromCitizens;
    record.scrapsFromRot += r.scraps.fromRot;
    record.clutterFromScraps += r.clutter.fromScraps;
    record.clutterRecycled += r.clutter.recycled;
    if (state.stores.food >= r.food.storage) record.storageFullSeasons += 1;
    for (const slot of ['day', 'night'] as const) {
      for (const [source, amount] of Object.entries(r.energy[slot].bySource)) {
        record.energyBySource[source] = (record.energyBySource[source] ?? 0) + amount;
      }
      record.heatPumped += r.energy[slot].heat.pumped;
      record.heatFree += r.energy[slot].heat.free + r.energy[slot].heat.stored;
    }
    const losses: Record<string, number> = {};
    for (const line of r.wellbeing.lines) {
      if (line.amount >= 0) continue;
      const kind = line.kind as keyof RunRecord['wellbeingLost'];
      if (kind in record.wellbeingLost) record.wellbeingLost[kind] -= line.amount;
      losses[line.kind] = (losses[line.kind] ?? 0) - line.amount;
    }
    recentLosses.push(losses);
    if (recentLosses.length > 4) recentLosses.shift();
    record.peakCitizens = Math.max(record.peakCitizens, state.citizens);
  }

  record.status = state.status === 'complete' ? 'complete' : 'collapsed';
  record.seasons = state.turn;
  const score = scoreRun(content, state);
  record.score = score.total;
  record.tier = score.tier.id;
  record.vision = state.vision ?? '';
  record.visionAchieved = state.visionAchieved ?? -1;
  record.graft = graftOffer(content, state).options.map((o) => o.district.id);
  record.citizens = state.citizens;
  record.wellbeing = state.wellbeing;
  record.harmony = state.harmony;
  record.materials = state.stores.materials;
  record.food = state.stores.food;
  record.clutter = state.stores.clutter;
  if (record.status === 'collapsed') {
    const totals: Record<string, number> = {};
    for (const l of recentLosses) {
      for (const [k, v] of Object.entries(l)) totals[k] = (totals[k] ?? 0) + v;
    }
    record.collapseCause = Object.entries(totals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';
  }
  return record;
}

function ok<T>(result: { ok: true; state: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error);
  return result.state;
}
