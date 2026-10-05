/**
 * Lake Gardens against the Reach (LG3): each bot's median score, Heartwood share and collapses
 * over the same seeds, with water on as their runs have it, and what the lake looked like at the
 * end (grey water, blooms, silted shallows, beds, loops). Until the lake has its wonder (LG6),
 * the like-for-like row is the Reach without the Great Water Garden.
 *
 *   npx tsx scripts/lake-balance.ts [runs, default 20] [bots, comma-separated] [biome filter]
 *
 * EXPEDITIONS=1 plays the lake's regions and twists instead (LG5), each against the open lake.
 */
import { BIOMES, biomeContent, loadBiome } from '../src/content';
import { scoreRun, type Content, type RunExpedition, type RunState } from '../src/sim';
import { BOTS } from '../src/balance/bots';
import { playRun } from '../src/balance/runner';

const N = Number(process.argv[2] ?? 20);
const BOT_NAMES = (process.argv[3] ?? 'balanced,greedyFood,greedyEnergy').split(',');
const only = process.argv[4];
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const mean = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)).toFixed(1);

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

function play(content: Content, bot: string, expedition?: RunExpedition) {
  const scores: number[] = [];
  const grey: number[] = [];
  const silted: number[] = [];
  const beds: number[] = [];
  const loops: number[] = [];
  let heart = 0;
  let collapsed = 0;
  let blooms = 0;
  for (let i = 0; i < N; i++) {
    let last: RunState | null = null;
    playRun(content, BOTS[bot]!, `biome-${i}`, {
      onSeason: (s) => {
        last = s;
        if (s.lastReport?.lake?.bloom) blooms++;
      },
      run: { water: true, ...(expedition ? { expedition } : {}) },
    });
    const s = last as unknown as RunState;
    const score = scoreRun(content, s);
    scores.push(score.total);
    if (score.tier.id === 'heartwood') heart++;
    if (s.status === 'collapsed') collapsed++;
    const tiles = Object.values(s.map.tiles);
    grey.push(s.lake?.grey ?? 0);
    silted.push(tiles.filter((t) => t.silted).length);
    beds.push(tiles.filter((t) => t.type === 'bed').length);
    loops.push(s.loops.length);
  }
  return {
    median: med(scores),
    heartwood: Math.round((heart / N) * 100),
    collapsed,
    grey: mean(grey),
    blooms: (blooms / N).toFixed(1),
    silted: mean(silted),
    beds: mean(beds),
    loops: mean(loops),
  };
}

if (process.env.EXPEDITIONS) {
  const lake = biomeContent('lakeGardens');
  const none = { twist: null, request: null };
  const cases: [string, RunExpedition, number][] = [
    ['open lake', none, 0],
    ...lake.regions.map((r): [string, RunExpedition, number] => [
      `region ${r.id}`,
      { ...none, region: r.id },
      r.graftTierBonus,
    ]),
    ...lake.twists.map((t): [string, RunExpedition, number] => [
      `twist ${t.id}`,
      { ...none, twist: t.id },
      t.graftTierBonus,
    ]),
  ];
  console.log(
    '| Bot | Expedition | Graft bonus | Median score | Heartwood | Collapsed | Grey at the end | Silted tiles | Beds |',
  );
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const bot of BOT_NAMES)
    for (const [name, expedition, bonus] of cases) {
      const r = play(lake, bot, expedition);
      console.log(
        `| ${bot} | ${name} | ${bonus} | ${r.median} | ${r.heartwood}% | ${r.collapsed} of ${N} | ${r.grey} | ${r.silted} | ${r.beds} |`,
      );
    }
  process.exit(0);
}

const cases: [string, Content][] = [
  ['Willow Reach, no wonder', reachWithoutWonder()],
  ['Lake Gardens', biomeContent('lakeGardens')],
];
console.log(
  '| Bot | Biome | Median score | Heartwood | Collapsed | Grey at the end | Blooms a run | Silted tiles | Beds | Loops |',
);
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const bot of BOT_NAMES)
  for (const [name, content] of cases.filter(([n]) => !only || n.includes(only))) {
    const r = play(content, bot);
    console.log(
      `| ${bot} | ${name} | ${r.median} | ${r.heartwood}% | ${r.collapsed} of ${N} | ${r.grey} | ${r.blooms} | ${r.silted} | ${r.beds} | ${r.loops} |`,
    );
  }
