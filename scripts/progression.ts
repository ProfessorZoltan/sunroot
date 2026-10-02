/**
 * How many runs does the ending take? Draws run outcomes (score, Graft tier)
 * from a balance simulator CSV, plays them into a Root City with the content
 * file's progression numbers, and reports the runs to the ending.
 *
 *   npx tsx scripts/progression.ts balance-out/runs.csv
 *     [--base N] [--points-per-seed N] [--graft-cost N] [--cost-scale X] [--heartwood N]
 *
 * The city: a run earns Seeds in proportion to its score. Planting its Graft
 * costs `graftCost` Seeds; a Graft that can't be paid for isn't planted, and
 * the Seeds are banked. Once the city is full, a Graft replaces the
 * lowest-tier district only if it is a higher tier (that district composts
 * into its share of the Seeds spent on it). Seeds left over raise the best
 * district below Heartwood, keeping enough back to plant the next Graft while
 * slots are free, until enough districts are Heartwood.
 */
import { readFileSync } from 'node:fs';
import willowReach from '../src/content/willow-reach.json';
import { loadBiome } from '../src/content';
import { createRng, nextFloat, nextInt } from '../src/sim/rng';

const content = loadBiome(willowReach);
const argv = process.argv.slice(2);
const opt = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? Number(argv[i + 1]) : undefined;
};
const base = content.progression!;
const scale = opt('--cost-scale') ?? 1;
const p = {
  ...base,
  seeds: {
    ...base.seeds,
    base: opt('--base') ?? base.seeds.base,
    pointsPerSeed: opt('--points-per-seed') ?? base.seeds.pointsPerSeed,
  },
  graftCost: opt('--graft-cost') ?? base.graftCost,
  upgradeCost: Object.fromEntries(
    Object.entries(base.upgradeCost).map(([k, v]) => [k, Math.round(v * scale)]),
  ),
  ending: {
    ...base.ending,
    heartwoodDistricts: opt('--heartwood') ?? base.ending.heartwoodDistricts,
  },
};
const tiers = content.rules.score.tiers.map((t) => t.id);
const bands = content.rules.score.tiers.map((t) => t.min);

interface Outcome {
  score: number;
  tier: number;
}

const csvPath = argv.find((a) => a.endsWith('.csv')) ?? 'balance-out/runs.csv';
const csv = readFileSync(csvPath, 'utf8').trim().split('\n');
const header = csv[0]!.split(',');
const col = (name: string) => header.indexOf(name);
const byBot = new Map<string, Outcome[]>();
for (const line of csv.slice(1)) {
  const cells = line.split(',');
  const score = Number(cells[col('score')]);
  const outcomes = byBot.get(cells[col('bot')]!) ?? [];
  // The tier from the score, with the content file's current bands.
  outcomes.push({ score, tier: bands.filter((min) => score >= min).length - 1 });
  byBot.set(cells[col('bot')]!, outcomes);
}

const seedsFor = (o: Outcome) => p.seeds.base + Math.floor(o.score / p.seeds.pointsPerSeed);
/** Seeds spent raising a district from Seedling to this tier. */
const invested = (tier: number) =>
  tiers.slice(1, tier + 1).reduce((n, id) => n + (p.upgradeCost[id] ?? 0), 0);

/** Which bot's outcomes stand for the player on their nth run. */
type Profile = (run: number) => string;
const PROFILES: Record<string, Profile> = {
  'skilled (balanced bot)': () => 'balanced',
  'steady (greedyEnergy bot)': () => 'greedyEnergy',
  'learner (random for 3 runs, greedyEnergy for 5, then balanced)': (n) =>
    n <= 3 ? 'random' : n <= 8 ? 'greedyEnergy' : 'balanced',
};

function play(profile: Profile, requestChance: number, seed: string) {
  const rng = createRng(seed);
  const city: number[] = [];
  const heartwood = tiers.length - 1;
  let seeds = 0;
  let planted = 0;
  let runs = 0;
  for (let run = 1; run <= 200; run++) {
    runs = run;
    const pool = byBot.get(profile(run))!;
    const o = pool[nextInt(rng, pool.length)]!;
    seeds += seedsFor(o) + (nextFloat(rng) < requestChance ? p.seeds.cityRequest : 0);
    if (seeds >= p.graftCost) {
      if (city.length < p.ending.slots) {
        seeds -= p.graftCost;
        city.push(o.tier);
        planted += 1;
      } else {
        const lowest = Math.min(...city);
        if (o.tier > lowest) {
          seeds -= p.graftCost;
          seeds += Math.floor(invested(lowest) * p.compostShare);
          city[city.indexOf(lowest)] = o.tier;
          planted += 1;
        }
      }
    }
    // Raise the best district below Heartwood, keeping a Graft's cost back while slots are free.
    const reserve = city.length < p.ending.slots ? p.graftCost : 0;
    for (;;) {
      if (city.filter((t) => t === heartwood).length >= p.ending.heartwoodDistricts) break;
      const best = Math.max(...city.filter((t) => t < heartwood), -1);
      if (best < 0) break;
      const cost = p.upgradeCost[tiers[best + 1]!] ?? Infinity;
      if (seeds - cost < reserve) break;
      seeds -= cost;
      city[city.indexOf(best)] = best + 1;
    }
    const hw = city.filter((t) => t === heartwood).length;
    if (city.length >= p.ending.slots && hw >= p.ending.heartwoodDistricts) break;
  }
  return { ending: runs, planted };
}

const quantile = (xs: number[], q: number) =>
  [...xs].sort((a, b) => a - b)[Math.floor(q * (xs.length - 1))]!;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const competent = [...byBot.entries()].filter(([bot]) => bot !== 'random').flatMap(([, os]) => os);
const affordable = competent.filter((o) => seedsFor(o) >= p.graftCost).length / competent.length;

console.log(
  `Seeds: ${p.seeds.base} + score ÷ ${p.seeds.pointsPerSeed}; a Graft costs ` +
    `${p.graftCost}; upgrades ${Object.entries(p.upgradeCost)
      .map(([t, n]) => `${n} to ${t}`)
      .join(', ')}; the ending is ${p.ending.slots} districts with ` +
    `${p.ending.heartwoodDistricts} at Heartwood. ${Math.round(affordable * 100)}% of competent ` +
    'runs earn a Graft by themselves.\n',
);
console.log(
  '| Player | City requests met | Seeds per run (mean) | Runs to the ending (p10 / median / p90) |',
);
console.log('| --- | --- | --- | --- |');
for (const [name, profile] of Object.entries(PROFILES)) {
  for (const requests of [0, 0.5]) {
    const results = Array.from({ length: 2000 }, (_, i) =>
      play(profile, requests, `${name}:${requests}:${i}`),
    );
    const endings = results.map((r) => r.ending);
    const perRun = mean(
      Array.from({ length: 30 }, (_, i) => mean(byBot.get(profile(i + 1))!.map(seedsFor))),
    );
    console.log(
      `| ${name} | ${Math.round(requests * 100)}% | ${perRun.toFixed(1)} | ` +
        `${quantile(endings, 0.1)} / ${quantile(endings, 0.5)} / ${quantile(endings, 0.9)} |`,
    );
  }
}
