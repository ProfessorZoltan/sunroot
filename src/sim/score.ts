import type { Content } from './content/load';
import type { RunState } from './types';

export interface ScoreLine {
  reason: string;
  points: number;
}

/**
 * Provisional run score, used by the balance simulator until Milestone 7
 * settles the real formula and the Graft tiers. Weights live in the content file.
 */
export function provisionalScore(
  content: Content,
  state: RunState,
): { total: number; lines: ScoreLine[] } {
  const w = content.rules.provisionalScore;
  const lines: ScoreLine[] = [
    { reason: `${state.turn} seasons survived`, points: state.turn * w.perSeasonSurvived },
    { reason: `${state.citizens} citizens`, points: state.citizens * w.perCitizen },
    { reason: `Harmony ${state.harmony}`, points: state.harmony * w.perHarmony },
    {
      reason: `wellbeing ${state.wellbeing}`,
      points: Math.floor(state.wellbeing / w.wellbeingStep) * w.perWellbeingStep,
    },
  ];
  if (state.status === 'complete') lines.push({ reason: 'run completed', points: w.completeBonus });
  return { total: lines.reduce((sum, l) => sum + l.points, 0), lines };
}
