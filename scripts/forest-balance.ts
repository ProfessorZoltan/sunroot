/**
 * Rainforest Gardens against the Reach: each bot's median score, Heartwood share and collapses
 * over the same seeds, with water on as their runs have it, and what the forest looked like at
 * the end (rainforest left, fields worn out, dark earth, layers added, fires).
 *
 *   npx tsx scripts/forest-balance.ts [runs, default 20] [bots, comma-separated] [biome filter]
 *
 * EXPEDITIONS=1 plays the forest's regions and twists instead (FG5), each against the deep forest.
 */
import { biomeContent } from '../src/content';
import { scoreRun, type Content, type RunExpedition, type RunState } from '../src/sim';
import { BOTS } from '../src/balance/bots';
import { playRun } from '../src/balance/runner';

const N = Number(process.argv[2] ?? 20);
const BOT_NAMES = (process.argv[3] ?? 'balanced,greedyFood,greedyEnergy').split(',');
const only = process.argv[4];
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const mean = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)).toFixed(1);

function play(content: Content, bot: string, expedition?: RunExpedition) {
  const scores: number[] = [];
  const forest: number[] = [];
  const dark: number[] = [];
  const layers: number[] = [];
  const citizens: number[] = [];
  const harmony: number[] = [];
  const loops: number[] = [];
  let heart = 0;
  let collapsed = 0;
  let fires = 0;
  for (let i = 0; i < N; i++) {
    let last: RunState | null = null;
    playRun(content, BOTS[bot]!, `biome-${i}`, {
      onSeason: (s) => {
        last = s;
        fires += s.lastReport?.burned?.length ?? 0;
      },
      run: { water: true, ...(expedition ? { expedition } : {}) },
    });
    const s = last as unknown as RunState;
    const score = scoreRun(content, s);
    scores.push(score.total);
    if (score.tier.id === 'heartwood') heart++;
    if (s.status === 'collapsed') collapsed++;
    const tiles = Object.values(s.map.tiles);
    forest.push(tiles.filter((t) => t.type === 'woodland').length);
    dark.push(tiles.filter((t) => t.type === 'darkEarth').length);
    layers.push(Object.values(s.buildings).reduce((n, b) => n + (b.layers?.length ?? 0), 0));
    citizens.push(s.citizens);
    harmony.push(s.harmony);
    loops.push(s.loops.length);
  }
  return {
    median: med(scores),
    heartwood: `${Math.round((heart / N) * 100)}%`,
    collapsed: `${collapsed} of ${N}`,
    citizens: med(citizens),
    harmony: med(harmony),
    loops: mean(loops),
    forest: mean(forest),
    darkEarth: mean(dark),
    layers: mean(layers),
    fires: (fires / N).toFixed(1),
  };
}

if (process.env.EXPEDITIONS) {
  const forest = biomeContent('rainforestGardens');
  const none = { twist: null, request: null };
  const cases: [string, RunExpedition, number][] = [
    ['deep forest', none, 0],
    ...forest.regions
      .filter((r) => r.id !== 'deepForest')
      .map((r): [string, RunExpedition, number] => [
        `region ${r.id}`,
        { ...none, region: r.id },
        r.graftTierBonus,
      ]),
    ...forest.twists
      .filter((t) => t.id !== 'fairWeather')
      .map((t): [string, RunExpedition, number] => [
        `twist ${t.id}`,
        { ...none, twist: t.id },
        t.graftTierBonus,
      ]),
  ];
  console.log(
    '| Bot | Expedition | Graft bonus | Median score | Heartwood | Collapsed | Citizens | Rainforest left | Dark earth | Fires a run |',
  );
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const bot of BOT_NAMES)
    for (const [name, expedition, bonus] of cases.filter(([n]) => !only || n.includes(only))) {
      const r = play(forest, bot, expedition);
      console.log(
        `| ${bot} | ${name} | ${bonus} | ${r.median} | ${r.heartwood} | ${r.collapsed} | ${r.citizens} | ${r.forest} | ${r.darkEarth} | ${r.fires} |`,
      );
    }
  process.exit(0);
}

const rows: Record<string, unknown>[] = [];
for (const biome of ['willowReach', 'rainforestGardens']) {
  if (only && biome !== only) continue;
  const content = biomeContent(biome);
  for (const bot of BOT_NAMES) rows.push({ bot, biome, ...play(content, bot) });
}
console.table(rows);
