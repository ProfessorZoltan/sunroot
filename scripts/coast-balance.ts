/**
 * The Windswept Coast against the Reach (B3): each bot's median score,
 * Heartwood share and collapses over the same seeds in both biomes, with
 * water on as their runs have it. Until the coast has its wonder (B6), the
 * like-for-like row is the Reach without the Great Water Garden.
 *
 *   npx tsx scripts/coast-balance.ts [runs, default 20]
 */
import { BIOMES, biomeContent, loadBiome } from '../src/content';
import { scoreRun, type Content, type RunState } from '../src/sim';
import { BOTS } from '../src/balance/bots';
import { playRun } from '../src/balance/runner';

const N = Number(process.argv[2] ?? 20);
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

/** Willow Reach with its wonder taken out (and the era goal's other way with it). */
function reachWithoutWonder(): Content {
  const raw = structuredClone(BIOMES.willowReach) as {
    buildings: { id: string; wonder?: unknown }[];
    eraGoals: { or?: unknown }[];
  };
  raw.buildings = raw.buildings.filter((b) => !b.wonder);
  for (const g of raw.eraGoals) delete g.or;
  return loadBiome(raw);
}

function play(content: Content, bot: string) {
  const scores: number[] = [];
  let heart = 0;
  let collapsed = 0;
  for (let i = 0; i < N; i++) {
    let last: RunState | null = null;
    playRun(content, BOTS[bot]!, `biome-${i}`, {
      onSeason: (s) => (last = s),
      run: { water: true },
    });
    const s = last as unknown as RunState;
    const score = scoreRun(content, s);
    scores.push(score.total);
    if (score.tier.id === 'heartwood') heart++;
    if (s.status === 'collapsed') collapsed++;
  }
  return { median: med(scores), heartwood: Math.round((heart / N) * 100), collapsed };
}

const cases: [string, Content][] = [
  ['Willow Reach', biomeContent('willowReach')],
  ['Willow Reach, no wonder', reachWithoutWonder()],
  ['Windswept Coast', biomeContent('windsweptCoast')],
];
console.log('| Bot | Biome | Median score | Heartwood | Collapsed |');
console.log('| --- | --- | --- | --- | --- |');
for (const bot of ['balanced', 'greedyFood', 'greedyEnergy'])
  for (const [name, content] of cases) {
    const r = play(content, bot);
    console.log(`| ${bot} | ${name} | ${r.median} | ${r.heartwood}% | ${r.collapsed} of ${N} |`);
  }
