/**
 * The Highland against the Reach (HL3): each bot's median score, Heartwood
 * share and collapses over the same seeds, with water on as their runs have
 * it. Until the Highland had its wonder (HL6), the like-for-like row was the
 * Reach without the Great Water Garden, as the coast's was in B3; with the
 * Cloud Terraces, the Reach plays with its own, and wonders finished are counted.
 *
 *   npx tsx scripts/highland-balance.ts [runs, default 20] [bots, comma-separated]
 */
import { BIOMES, biomeContent, loadBiome } from '../src/content';
import { scoreRun, type Content, type RunState } from '../src/sim';
import { finishedWonders } from '../src/sim/wonder';
import { BOTS } from '../src/balance/bots';
import { playRun } from '../src/balance/runner';

const N = Number(process.argv[2] ?? 20);
const BOT_NAMES = (process.argv[3] ?? 'balanced,greedyFood,greedyEnergy').split(',');
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
  let year = 0;
  let wonders = 0;
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
    year += s.year;
    if (finishedWonders(content, s).length > 0) wonders++;
  }
  return {
    median: med(scores),
    heartwood: Math.round((heart / N) * 100),
    collapsed,
    years: (year / N).toFixed(1),
    wonders,
  };
}

const cases: [string, Content][] = [
  ...(process.argv[4] === 'noWonder'
    ? ([['Willow Reach, no wonder', reachWithoutWonder()]] as [string, Content][])
    : ([['Willow Reach', biomeContent('willowReach')]] as [string, Content][])),
  ['Highland', biomeContent('highland')],
];
console.log(
  '| Bot | Biome | Median score | Heartwood | Collapsed | Mean last year | Wonder finished |',
);
console.log('| --- | --- | --- | --- | --- | --- | --- |');
for (const bot of BOT_NAMES)
  for (const [name, content] of cases) {
    const r = play(content, bot);
    console.log(
      `| ${bot} | ${name} | ${r.median} | ${r.heartwood}% | ${r.collapsed} of ${N} | ${r.years} | ${r.wonders} of ${N} |`,
    );
  }
