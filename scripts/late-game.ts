/**
 * Is the end of a run worth playing? Plays bot runs and reports, per bot:
 * scores and tiers, collapses, stores at the end, how much is built each
 * year, seasons whose draft was empty, projects finished, and wellbeing lost
 * to rising expectations.
 *
 *   npx tsx scripts/late-game.ts [runs per bot, default 40]
 */
import willowReach from '../src/content/willow-reach.json';
import { loadBiome } from '../src/content';
import { scoreRun, type RunState } from '../src/sim';
import { BOTS } from '../src/balance/bots';
import { playRun } from '../src/balance/runner';

const content = loadBiome(willowReach);
const N = Number(process.argv[2] ?? 40);
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const pct = (n: number) => `${Math.round((n / N) * 100)}%`;

for (const bot of ['balanced', 'greedyFood', 'greedyEnergy']) {
  const scores: number[] = [];
  let heartwood = 0;
  let collapsed = 0;
  const end: Record<string, number[]> = {};
  const builtByYear: number[][] = Array.from({ length: 12 }, () => []);
  const emptyByYear: number[][] = Array.from({ length: 12 }, () => []);
  const projects: number[] = [];
  const expectationsLost: number[] = [];
  for (let i = 0; i < N; i++) {
    let prev: RunState | null = null;
    let last: RunState | null = null;
    const built = Array(12).fill(0) as number[];
    const empty = Array(12).fill(0) as number[];
    let lost = 0;
    playRun(content, BOTS[bot]!, `late-${i}`, {
      onSeason: (s) => {
        const y = Math.min(11, Math.floor((s.turn - 1) / 4));
        const before = prev ? Object.keys(prev.buildings).length : 1;
        built[y]! += Math.max(0, Object.keys(s.buildings).length - before);
        if (prev && prev.status === 'active' && prev.draft.offer.length === 0) empty[y]! += 1;
        for (const l of s.lastReport?.wellbeing.lines ?? [])
          if (l.kind === 'expectations') lost -= l.amount;
        prev = s;
        last = s;
      },
    });
    const s = last as unknown as RunState;
    const score = scoreRun(content, s);
    scores.push(score.total);
    if (score.tier.id === 'heartwood') heartwood++;
    if (s.status === 'collapsed') collapsed++;
    for (const [res, n] of Object.entries(s.stores)) (end[res] ??= []).push(n);
    built.forEach((n, y) => builtByYear[y]!.push(n));
    empty.forEach((n, y) => emptyByYear[y]!.push(n));
    projects.push(s.projects.filter((p) => p.done !== null).length);
    expectationsLost.push(lost);
  }
  console.log(`\n## ${bot} (${N} runs)\n`);
  console.log(
    `Score median ${med(scores)}, Heartwood ${pct(heartwood)}, collapsed ${pct(collapsed)}; ` +
      `projects finished (median) ${med(projects)}; wellbeing lost to expectations (median) ${med(expectationsLost)}.\n`,
  );
  console.log(
    `End stores (median): ${Object.entries(end)
      .map(([r, xs]) => `${r} ${med(xs)}`)
      .join(', ')}.\n`,
  );
  console.log('| Year | Buildings built (median) | Seasons with an empty draft (median) |');
  console.log('| --- | --- | --- |');
  for (let y = 0; y < 12; y++)
    console.log(`| ${y + 1} | ${med(builtByYear[y]!)} | ${med(emptyByYear[y]!)} |`);
}
