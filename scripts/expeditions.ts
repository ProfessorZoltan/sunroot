/**
 * How each expedition region and twist plays for the bots: median score, how
 * often runs reach each Graft tier, and how often they collapse, against the
 * valley as it is. Twists are played in The Reach; regions without a twist.
 *
 *   npx tsx scripts/expeditions.ts [runs each, default 30] [bot, default balanced] [only: ids, comma-separated]
 */
import willowReach from '../src/content/willow-reach.json';
import { loadContent, scoreRun, type RunExpedition, type RunState } from '../src/sim';
import { BOTS } from '../src/balance/bots';
import { playRun } from '../src/balance/runner';

const content = loadContent(willowReach);
const N = Number(process.argv[2] ?? 30);
const bot = BOTS[process.argv[3] ?? 'balanced']!;
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const pct = (n: number) => `${Math.round((n / N) * 100)}%`;

const cases: { label: string; expedition: RunExpedition; bonus: number }[] = [
  { label: 'baseline', expedition: { twist: null, request: null }, bonus: 0 },
  ...content.regions.map((r) => ({
    label: `region ${r.id}`,
    expedition: { twist: null, request: null, region: r.id },
    bonus: r.graftTierBonus,
  })),
  ...content.twists.map((t) => ({
    label: `twist ${t.id}`,
    expedition: { twist: t.id, request: null },
    bonus: t.graftTierBonus,
  })),
];

const only = process.argv[4]?.split(',');
const chosen = cases.filter((c) => !only || only.some((id) => c.label.endsWith(` ${id}`)));

console.log(`| Case | Median score | Sapling+ | Heartwood | Collapsed | Graft bonus |`);
console.log(`| ---- | ------------ | -------- | --------- | --------- | ----------- |`);
for (const c of chosen) {
  const scores: number[] = [];
  let sapling = 0;
  let heartwood = 0;
  let collapsed = 0;
  for (let i = 0; i < N; i++) {
    let last: RunState | null = null;
    playRun(content, bot, `exp-${i}`, {
      run: { expedition: c.expedition },
      onSeason: (s) => (last = s),
    });
    const s = last as unknown as RunState;
    const score = scoreRun(content, s);
    scores.push(score.total);
    if (score.tier.id !== 'seedling') sapling++;
    if (score.tier.id === 'heartwood') heartwood++;
    if (s.status === 'collapsed') collapsed++;
  }
  console.log(
    `| ${c.label} | ${med(scores)} | ${pct(sapling)} | ${pct(heartwood)} | ${pct(collapsed)} | ${c.bonus} |`,
  );
}
