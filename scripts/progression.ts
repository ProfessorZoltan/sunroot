/**
 * Do the Seed and upgrade numbers give an ending after about 20 to 25 runs?
 * Draws run outcomes (completed or not, years survived, Graft tier) from a
 * balance simulator CSV, plays them into a Root City with the content file's
 * progression numbers, and reports how many runs the ending takes.
 *
 *   npx tsx scripts/progression.ts balance-out/runs.csv
 *
 * The city: each run's Graft takes an empty slot; once the city is full, a
 * Graft replaces the lowest-tier district only if it is a higher tier (that
 * district composts into its share of the Seeds spent on it). Seeds raise the
 * best district below Heartwood, one tier at a time, until 6 are Heartwood.
 */
import { readFileSync } from 'node:fs';
import willowReach from '../src/content/willow-reach.json';
import { loadContent } from '../src/sim';
import { createRng, nextFloat, nextInt } from '../src/sim/rng';

const content = loadContent(willowReach);
// Overrides for trying other numbers: --heartwood N (districts needed), --cost-scale X.
const argv = process.argv.slice(2);
const opt = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? Number(argv[i + 1]) : undefined;
};
const base = content.progression!;
const scale = opt('--cost-scale') ?? 1;
/** Seeds to grow the Heartwood into the Sun Tree, once the rest of the ending is met. */
const sunTree = opt('--sun-tree') ?? 0;
const p = {
  ...base,
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
  complete: boolean;
  years: number;
  tier: number;
}

const csvPath = argv.find((a) => a.endsWith('.csv')) ?? 'balance-out/runs.csv';
const csv = readFileSync(csvPath, 'utf8').trim().split('\n');
const header = csv[0]!.split(',');
const col = (name: string) => header.indexOf(name);
const byBot = new Map<string, Outcome[]>();
for (const line of csv.slice(1)) {
  const cells = line.split(',');
  const bot = cells[col('bot')]!;
  const outcomes = byBot.get(bot) ?? [];
  outcomes.push({
    complete: cells[col('status')] === 'complete',
    years: Math.floor(Number(cells[col('seasons')]) / 4),
    // The tier from the score, with the content file's current bands.
    tier: bands.filter((min) => Number(cells[col('score')]) >= min).length - 1,
  });
  byBot.set(bot, outcomes);
}

const seedsFor = (o: Outcome) =>
  o.complete
    ? p.seeds.complete + (p.seeds.tierBonus[tiers[o.tier]!] ?? 0)
    : Math.max(p.seeds.minEnded, o.years * p.seeds.perYearEnded);
/** Seeds spent raising a district from Seedling to this tier. */
const invested = (tier: number) =>
  tiers.slice(1, tier + 1).reduce((n, id) => n + (p.upgradeCost[id] ?? 0), 0);

/** Which bot's outcomes stand for the player on their nth run. */
type Profile = (run: number) => string;
const PROFILES: Record<string, Profile> = {
  'skilled (balanced bot every run)': () => 'balanced',
  'steady (greedyEnergy bot every run)': () => 'greedyEnergy',
  'learner (random for 3 runs, greedyEnergy for 5, then balanced)': (n) =>
    n <= 3 ? 'random' : n <= 8 ? 'greedyEnergy' : 'balanced',
};

function play(profile: Profile, requestChance: number, seed: string) {
  const rng = createRng(seed);
  const city: number[] = [];
  let seeds = 0;
  let filledAt = 0;
  let heartwoodAt = 0;
  const heartwood = tiers.length - 1;
  for (let run = 1; run <= 200; run++) {
    const pool = byBot.get(profile(run))!;
    const o = pool[nextInt(rng, pool.length)]!;
    seeds += seedsFor(o) + (nextFloat(rng) < requestChance ? p.seeds.cityRequest : 0);
    if (city.length < p.ending.slots) city.push(o.tier);
    else {
      const lowest = Math.min(...city);
      if (o.tier > lowest) {
        const at = city.indexOf(lowest);
        seeds += Math.floor(invested(lowest) * p.compostShare);
        city[at] = o.tier;
      }
    }
    // Raise the best district that isn't Heartwood yet, while 6 aren't.
    for (;;) {
      if (city.filter((t) => t === heartwood).length >= p.ending.heartwoodDistricts) break;
      const best = Math.max(...city.filter((t) => t < heartwood), -1);
      if (best < 0) break;
      const cost = p.upgradeCost[tiers[best + 1]!] ?? Infinity;
      if (seeds < cost) break;
      seeds -= cost;
      city[city.indexOf(best)] = best + 1;
    }
    if (!filledAt && city.length >= p.ending.slots) filledAt = run;
    const hw = city.filter((t) => t === heartwood).length;
    if (!heartwoodAt && hw >= p.ending.heartwoodDistricts) heartwoodAt = run;
    if (city.length >= p.ending.slots && hw >= p.ending.heartwoodDistricts && seeds >= sunTree) {
      return { ending: run, filledAt, heartwoodAt };
    }
  }
  return { ending: Infinity, filledAt, heartwoodAt };
}

const quantile = (xs: number[], q: number) =>
  [...xs].sort((a, b) => a - b)[Math.floor(q * (xs.length - 1))]!;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

console.log(
  `Ending: ${p.ending.slots} districts with ${p.ending.heartwoodDistricts} at Heartwood. ` +
    `Seeds: ${p.seeds.complete} a completed run (+${Object.entries(p.seeds.tierBonus)
      .map(([t, n]) => `${n} ${t}`)
      .join(
        ', +',
      )}), ${p.seeds.perYearEnded} a year (at least ${p.seeds.minEnded}) for one that ends early.\n`,
);
console.log(
  '| Player | City requests met | Runs to the ending (p10 / median / p90) | City full by run (median) | 6 Heartwood by run (median) | Seeds per run (mean) |',
);
console.log('| --- | --- | --- | --- | --- | --- |');
for (const [name, profile] of Object.entries(PROFILES)) {
  for (const requests of [0, 0.5]) {
    const results = Array.from({ length: 2000 }, (_, i) =>
      play(profile, requests, `${name}:${requests}:${i}`),
    );
    const endings = results.map((r) => r.ending);
    const perRun = mean(
      Array.from({ length: 30 }, (_, i) => {
        const pool = byBot.get(profile(i + 1))!;
        return mean(pool.map(seedsFor));
      }),
    );
    console.log(
      `| ${name} | ${Math.round(requests * 100)}% | ${quantile(endings, 0.1)} / ${quantile(endings, 0.5)} / ${quantile(endings, 0.9)} | ` +
        `${quantile(
          results.map((r) => r.filledAt),
          0.5,
        )} | ${quantile(
          results.map((r) => r.heartwoodAt),
          0.5,
        )} | ` +
        `${perRun.toFixed(1)} |`,
    );
  }
}
