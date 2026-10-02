/**
 * The Great Water Garden (E5) and the balanced bot, on each rung of the
 * teaching ladder: median score, Heartwood share, and gardens finished.
 *
 *   npx tsx scripts/wonder-balance.ts [runs, default 40]
 */
import willowReach from '../src/content/willow-reach.json';
import { loadBiome } from '../src/content';
import { scoreRun, type RunState } from '../src/sim';
import { BOTS } from '../src/balance/bots';
import { playRun } from '../src/balance/runner';
const N = Number(process.argv[2] ?? 40);
const cases = [
  ['run 1', false, false, false],
  ['run 2 (water)', true, false, false],
  ['run 3 (water, walks)', true, true, false],
  ['run 4 (all)', true, true, true],
] as const;
for (const [name, water, commute, heat] of cases) {
  const raw = structuredClone(willowReach);
  raw.rules.water.enabled = water;
  raw.rules.commute.enabled = commute;
  raw.rules.localHeat.enabled = heat;
  (raw.rules.localHeat as { gridHeat?: boolean }).gridHeat = !heat;
  const c = loadBiome(raw);
  const scores: number[] = [];
  let heart = 0,
    gardens = 0;
  for (let i = 0; i < N; i++) {
    let last: RunState | null = null;
    playRun(c, BOTS.balanced!, `layers-${i}`, { onSeason: (s) => (last = s) });
    const s = last as unknown as RunState;
    const sc = scoreRun(c, s);
    scores.push(sc.total);
    if (sc.tier.id === 'heartwood') heart++;
    if (
      Object.values(s.buildings).some(
        (b) => b.type === 'greatWaterGarden' && (b as { finished?: number }).finished !== undefined,
      )
    )
      gardens++;
  }
  scores.sort((a, b) => a - b);
  console.log(
    `| ${name} | ${scores[Math.floor(N / 2)]} | ${Math.round((heart / N) * 100)}% | ${gardens} of ${N} |`,
  );
}
