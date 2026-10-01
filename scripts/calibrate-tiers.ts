/**
 * Graft tier bands from a balance simulator CSV: Heartwood at the score
 * reached by the best `--heartwood` share of competent runs (the non-random
 * bots, pooled), Sapling at the score of the weakest `--sapling` share of
 * them, both rounded down to a multiple of 5.
 *
 *   npx tsx scripts/calibrate-tiers.ts balance-out/runs.csv [--heartwood 0.2] [--sapling 0.1]
 */
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (name: string, fallback: number) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const path = args.find((a) => a.endsWith('.csv')) ?? 'balance-out/runs.csv';
const heartwoodShare = flag('--heartwood', 0.2);
const saplingShare = flag('--sapling', 0.1);

const lines = readFileSync(path, 'utf8').trim().split('\n');
const header = lines[0]!.split(',');
const bot = header.indexOf('bot');
const score = header.indexOf('score');
const scores = lines
  .slice(1)
  .map((l) => l.split(','))
  .filter((c) => c[bot] !== 'random')
  .map((c) => Number(c[score]))
  .sort((a, b) => a - b);
const at = (q: number) => scores[Math.min(scores.length - 1, Math.floor(q * scores.length))]!;
const down5 = (n: number) => Math.floor(n / 5) * 5;
const heartwood = down5(at(1 - heartwoodShare));
const sapling = down5(at(saplingShare));
const share = (min: number) => scores.filter((s) => s >= min).length / scores.length;
console.log(`${scores.length} competent runs (all bots but random).`);
console.log(`Sapling from ${sapling}: ${(share(sapling) * 100).toFixed(0)}% of them reach it.`);
console.log(
  `Heartwood from ${heartwood}: ${(share(heartwood) * 100).toFixed(0)}% of them reach it.`,
);
