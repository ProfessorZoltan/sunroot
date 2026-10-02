/**
 * Calibrates the score lines for the teaching ladder's layers (DECISIONS.md,
 * Teaching by layers): plays the same seeds with no layers, with water (run
 * 2 on), and with water and commuting (run 3 on), with the layers' score
 * lines set to 0, and suggests the points that bring each back to the
 * valley's own median. Then plays again with the suggestion to check the
 * Graft tiers come out alike.
 *
 *   npx tsx scripts/calibrate-layers.ts [runs, default 40] [bots, default balanced,greedyEnergy,greedyFood] [water=N commute=N]
 */
import willowReach from '../src/content/willow-reach.json';
import { loadContent, scoreRun, type Content, type RunState } from '../src/sim';
import { BOTS } from '../src/balance/bots';
import { playRun } from '../src/balance/runner';

const N = Number(process.argv[2] ?? 40);
const bots = (process.argv[3] ?? 'balanced,greedyEnergy,greedyFood').split(',');
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const pct = (n: number, of: number) => `${Math.round((n / of) * 100)}%`;

function contentWith(water: boolean, commute: boolean, points: { water: number; commute: number }) {
  const raw = structuredClone(willowReach);
  raw.rules.water.enabled = water;
  raw.rules.commute.enabled = commute;
  (raw.rules.score as { layers?: unknown }).layers = points;
  return loadContent(raw);
}

function play(content: Content, bot: string) {
  return Array.from({ length: N }, (_, i) => {
    let last: RunState | null = null;
    playRun(content, BOTS[bot]!, `layers-${i}`, { onSeason: (s) => (last = s) });
    return scoreRun(content, last as unknown as RunState);
  });
}

const zero = { water: 0, commute: 0 };
const content0 = (): Content => contentWith(false, false, zero);
const cases = [
  { label: 'No layers (run 1)', water: false, commute: false },
  { label: 'Water (run 2)', water: true, commute: false },
  { label: 'Water and commuting (run 3 on)', water: true, commute: true },
];

const suggested: Record<string, { water: number; commute: number }> = {};
const heartwoodMatched: Record<string, { water: number; commute: number }> = {};
const top = content0().rules.score.tiers.at(-1)!.min;
/** The fewest points that give `scores` at least the Heartwood share of `target`. */
const toMatch = (scores: number[], target: number[]) => {
  const want = target.filter((s) => s >= top).length;
  for (let b = 0; b < 100; b++) if (scores.filter((s) => s + b >= top).length >= want) return b;
  return 100;
};
console.log('Score lines at 0:\n');
console.log('| Bot | Case | Median score | Heartwood |');
console.log('| --- | --- | --- | --- |');
for (const bot of bots) {
  const medians: number[] = [];
  const all: number[][] = [];
  for (const c of cases) {
    const scores = play(contentWith(c.water, c.commute, zero), bot);
    all.push(scores.map((s) => s.total));
    medians.push(med(scores.map((s) => s.total)));
    console.log(
      `| ${bot} | ${c.label} | ${medians.at(-1)} | ${pct(scores.filter((s) => s.tier.id === 'heartwood').length, N)} |`,
    );
  }
  const water = Math.max(0, medians[0]! - medians[1]!);
  suggested[bot] = { water, commute: Math.max(0, medians[0]! - medians[2]! - water) };
  const w = toMatch(all[1]!, all[0]!);
  heartwoodMatched[bot] = { water: w, commute: Math.max(0, toMatch(all[2]!, all[0]!) - w) };
}
console.log('\nPoints that bring each case back to the valley without layers:\n');
console.log(
  '| Bot | Water (median) | Commuting (median) | Water (Heartwood share) | Commuting (Heartwood share) |',
);
console.log('| --- | --- | --- | --- | --- |');
for (const bot of bots)
  console.log(
    `| ${bot} | ${suggested[bot]!.water} | ${suggested[bot]!.commute} | ${heartwoodMatched[bot]!.water} | ${heartwoodMatched[bot]!.commute} |`,
  );

// Check: the balanced bot's Heartwood-share points (the tiers were set on the balanced bot), or
// the points given as arguments: water=N commute=N.
const given = Object.fromEntries(process.argv.slice(4).map((a) => a.split('=')));
const points =
  given.water !== undefined
    ? { water: Number(given.water), commute: Number(given.commute ?? 0) }
    : heartwoodMatched[bots[0]!]!;
console.log(`\nWith ${JSON.stringify(points)}:\n`);
console.log('| Bot | Case | Median score | Heartwood |');
console.log('| --- | --- | --- | --- |');
for (const bot of bots) {
  for (const c of cases) {
    const scores = play(contentWith(c.water, c.commute, points), bot);
    console.log(
      `| ${bot} | ${c.label} | ${med(scores.map((s) => s.total))} | ${pct(scores.filter((s) => s.tier.id === 'heartwood').length, N)} |`,
    );
  }
}
