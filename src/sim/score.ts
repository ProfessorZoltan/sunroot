/**
 * The end of a run (Milestone 7): the score, the Graft tier it earns, how far
 * the run's vision got, and the Graft offer, the 2 districts that best match
 * how the run was played. The design leaves the formula and the tier bands
 * open; every weight lives in the content file (see DECISIONS.md).
 */
import type { Content } from './content/load';
import type { District, Vision } from './content/schema';
import type { RunState } from './types';

export interface ScoreLine {
  reason: string;
  points: number;
}

export interface Tier {
  id: string;
  name: string;
  min: number;
}

export interface RunScore {
  total: number;
  lines: ScoreLine[];
  tier: Tier;
  /** The next tier up and the points still needed, if any. */
  next: { tier: Tier; points: number } | null;
}

export function scoreRun(content: Content, state: RunState): RunScore {
  const w = content.rules.score;
  const standingLoops = state.loops.length;
  const lines: ScoreLine[] = [
    { reason: `${state.turn} seasons survived`, points: state.turn * w.perSeasonSurvived },
    { reason: `${state.citizens} citizens`, points: state.citizens * w.perCitizen },
    { reason: `Harmony ${state.harmony}`, points: state.harmony * w.perHarmony },
    {
      reason: `wellbeing ${state.wellbeing}`,
      points: Math.floor(state.wellbeing / w.wellbeingStep) * w.perWellbeingStep,
    },
  ];
  if (standingLoops > 0) {
    lines.push({
      reason: `${standingLoops} loop${standingLoops > 1 ? 's' : ''} closed`,
      points: standingLoops * w.perLoop,
    });
  }
  if (state.discoveries.length > 0) {
    lines.push({
      reason: `${state.discoveries.length} combo${state.discoveries.length > 1 ? 's' : ''} discovered`,
      points: state.discoveries.length * w.perDiscovery,
    });
  }
  const vision = state.vision ? content.visions.find((v) => v.id === state.vision) : undefined;
  if (vision && state.visionAchieved !== null) {
    lines.push({ reason: `vision: ${vision.name}`, points: w.visionBonus });
  }
  if (state.status === 'complete') lines.push({ reason: 'run completed', points: w.completeBonus });
  const total = lines.reduce((sum, l) => sum + l.points, 0);
  const tiers = w.tiers;
  const reached = tiers.filter((t) => total >= t.min);
  const tier = reached.at(-1) ?? tiers[0]!;
  const up = tiers[tiers.indexOf(tier) + 1];
  return { total, lines, tier, next: up ? { tier: up, points: up.min - total } : null };
}

/** @deprecated The score before Milestone 7; kept as an alias for old callers. */
export const provisionalScore = scoreRun;

// --------------------------------------------------------------------- visions

export interface VisionProgress {
  /** 0 to 1. */
  share: number;
  /** One line for the interface, such as "21 of 33 tiles". */
  text: string;
}

/** How far a vision has come in this state. */
export function visionProgress(content: Content, state: RunState, vision: Vision): VisionProgress {
  const goal = vision.goal;
  switch (goal.kind) {
    case 'greenLand': {
      const ladder = content.rules.landHealth;
      const land = Object.values(state.map.tiles).filter((t) => ladder.includes(t.type));
      const green = land.filter((t) => t.type === 'meadow' || t.type === 'woodland').length;
      const need = Math.ceil(land.length * goal.share);
      return {
        share: Math.min(1, green / Math.max(1, need)),
        text: `${green} of ${need} healable tiles are meadow or woodland`,
      };
    }
    case 'noShortfallYear': {
      // Seasons in a row without a shortfall since the last one, within this calendar year.
      const thisYear = state.history.filter((h) => h.year === state.year);
      let clean = 0;
      for (const h of thisYear) clean = litSeason(h, goal.minCitizens) ? clean + 1 : 0;
      const people = goal.minCitizens > 0 ? ` with ${goal.minCitizens} or more citizens` : '';
      return {
        share: clean / 4,
        text: `${clean} of 4 seasons this year without a shortfall${people}`,
      };
    }
    case 'citizens': {
      const people = Math.min(1, state.citizens / goal.citizens);
      const mood = Math.min(1, state.wellbeing / Math.max(1, goal.wellbeing));
      return {
        share: Math.min(people, mood),
        text: `${state.citizens} of ${goal.citizens} citizens, wellbeing ${state.wellbeing} of ${goal.wellbeing}`,
      };
    }
  }
}

/** Whether the vision is met at the end of the season just resolved. */
export function visionMet(content: Content, state: RunState): boolean {
  const vision = content.visions.find((v) => v.id === state.vision);
  if (!vision) return false;
  const goal = vision.goal;
  if (goal.kind === 'noShortfallYear') {
    const year = state.history.filter((h) => h.year === state.year);
    return year.length === 4 && year.every((h) => litSeason(h, goal.minCitizens));
  }
  if (goal.kind === 'citizens') {
    return state.citizens >= goal.citizens && state.wellbeing >= goal.wellbeing;
  }
  return visionProgress(content, state, vision).share >= 1;
}

function litSeason(h: { shortfall: number; citizens: number }, minCitizens: number): boolean {
  return h.shortfall === 0 && h.citizens >= minCitizens;
}

// ----------------------------------------------------------------------- Graft

export interface Signature {
  /** Share of built energy (not the Founders' Camp) by source type. */
  energyShare: Record<string, number>;
  /** Food made per citizen per season. */
  foodPerCitizen: number;
  harmony: number;
  /** Materials made by workshops and kilns per season. */
  industry: number;
}

export function runSignature(content: Content, state: RunState): Signature {
  const { ledger } = state;
  const camp = content.campBuilding;
  const built = Object.entries(ledger.energy).filter(
    ([source]) => source !== camp && source !== 'mixedGrid',
  );
  const total = built.reduce((sum, [, n]) => sum + n, 0);
  const seasons = Math.max(1, state.turn);
  return {
    energyShare: Object.fromEntries(
      built.map(([source, n]) => [source, total === 0 ? 0 : n / total]),
    ),
    foodPerCitizen: ledger.citizenSeasons === 0 ? 0 : ledger.foodMade / ledger.citizenSeasons,
    harmony: state.harmony,
    industry: ledger.industry / seasons,
  };
}

export interface GraftOption {
  district: District;
  /** How strongly the run leans this way (1 = fully). */
  lean: number;
}

export interface GraftOffer {
  tier: Tier;
  options: GraftOption[];
  signature: Signature;
}

/**
 * "The game reads the run's signature, offers 2 matching districts and the
 * player picks one. The score sets the tier." The 2 districts the run leans
 * towards most; ties go to the order in the content file.
 */
export function graftOffer(content: Content, state: RunState, count = 2): GraftOffer {
  const signature = runSignature(content, state);
  const options = content.districts
    .map((district) => ({ district, lean: leanOf(signature, district) }))
    .sort((a, b) => b.lean - a.lean)
    .slice(0, count);
  return { tier: scoreRun(content, state).tier, options, signature };
}

/** How strongly a run's signature points at a district (1 = fully). */
export function leanOf(signature: Signature, district: District): number {
  const { metric, full, sources } = district.signature;
  const value =
    metric === 'energyShare'
      ? sources.reduce((sum, id) => sum + (signature.energyShare[id] ?? 0), 0)
      : signature[metric];
  return value / full;
}
