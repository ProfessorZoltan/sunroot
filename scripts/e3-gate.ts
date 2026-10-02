/**
 * The E3 gate (EXPANSION.md, Build plan): in the simulator, no single new
 * card may appear in more than 40% of winning bot runs. Plays the valley as
 * run 3 plays it (water and walks to work on) with the three profile bots,
 * and counts, for each Willow Reach v2 card, the share of winning runs
 * (Heartwood) that drafted it and that built it, against all runs, with each
 * new combo's discovery rate. Then, since which cards a bot builds is the bot's
 * habit as much as the card's strength, it plays again with each new card
 * left out of the draft: a card the bots can't win without would show there.
 *
 *   npx tsx scripts/e3-gate.ts [runs per bot, default 30] [WALKS=off]
 */
import willowReach from '../src/content/willow-reach.json';
import { loadContent, type RunState } from '../src/sim';
import { BOTS } from '../src/balance/bots';
import { playRun, type RunRecord } from '../src/balance/runner';

const N = Number(process.argv[2] ?? 30);
const raw = structuredClone(willowReach);
raw.rules.water.enabled = true;
raw.rules.commute.enabled = process.env.WALKS !== 'off';
const content = loadContent(raw);

const CARDS = ['reedBed', 'bathhouse', 'riceFishPaddy', 'mushroomCellar', 'hedgerow'];
const COMBOS = content.combos.filter((c) => c.requiresWater).map((c) => c.id);
const pct = (n: number, of: number) => (of === 0 ? '–' : `${Math.round((n / of) * 100)}%`);
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

interface Played {
  record: RunRecord;
  discovered: Set<string>;
}
const runs: Played[] = [];
for (const bot of ['balanced', 'greedyFood', 'greedyEnergy']) {
  for (let i = 0; i < N; i++) {
    let last: RunState | null = null;
    const record = playRun(content, BOTS[bot]!, `e3-${i}`, { onSeason: (s) => (last = s) });
    const s = last as unknown as RunState;
    runs.push({ record, discovered: new Set(s.discoveries) });
  }
}
const wins = runs.filter((r) => r.record.tier === 'heartwood');

console.log(
  `Bots: balanced, greedyFood, greedyEnergy; ${N} runs each (${runs.length}); water${raw.rules.commute.enabled ? ' and walks to work' : ''} on. ` +
    `Winning: reaching Heartwood (${wins.length} runs, ${pct(wins.length, runs.length)}).\n`,
);
console.log(
  '| Card | Drafted, winning runs | Built, winning runs | Built, all runs | Median score with it | Median score without |',
);
console.log('| --- | --- | --- | --- | --- | --- |');
for (const id of CARDS) {
  const name = content.byId[id]!.name;
  const drafted = wins.filter((r) => r.record.picks.includes(id)).length;
  const built = (rs: Played[]) => rs.filter((r) => (r.record.built[id] ?? 0) > 0);
  const withIt = built(runs);
  const without = runs.filter((r) => !withIt.includes(r));
  console.log(
    `| ${name} | ${pct(drafted, wins.length)} | ${pct(built(wins).length, wins.length)} | ${pct(withIt.length, runs.length)} | ${withIt.length ? med(withIt.map((r) => r.record.score)) : '–'} | ${without.length ? med(without.map((r) => r.record.score)) : '–'} |`,
  );
}
console.log('\n| Combo | Layer | Discovered, all runs | Discovered, winning runs |');
console.log('| --- | --- | --- | --- |');
for (const id of COMBOS) {
  const c = content.comboById[id]!;
  const found = (rs: Played[]) => rs.filter((r) => r.discovered.has(id)).length;
  console.log(
    `| ${c.name} | ${c.layer} | ${pct(found(runs), runs.length)} | ${pct(found(wins), wins.length)} |`,
  );
}
const collapsed = runs.filter((r) => r.record.status === 'collapsed').length;
console.log(
  `\nCollapsed: ${pct(collapsed, runs.length)}. Median score: ${med(runs.map((r) => r.record.score))}.`,
);

// Ablation: each card left out of the draft, the same seeds and bots.
console.log('\n| Left out of the draft | Heartwood | Median score | Collapsed |');
console.log('| --- | --- | --- | --- |');
const line = (label: string, rs: RunRecord[]) =>
  console.log(
    `| ${label} | ${pct(rs.filter((r) => r.tier === 'heartwood').length, rs.length)} | ${med(rs.map((r) => r.score))} | ${pct(rs.filter((r) => r.status === 'collapsed').length, rs.length)} |`,
  );
line(
  'Nothing',
  runs.map((r) => r.record),
);
for (const out of [...CARDS.map((id) => [id]), CARDS]) {
  const without = structuredClone(raw);
  for (const id of out)
    (without.buildings.find((b) => b.id === id) as { draftable?: boolean }).draftable = false;
  const c = loadContent(without);
  const rs: RunRecord[] = [];
  for (const bot of ['balanced', 'greedyFood', 'greedyEnergy'])
    for (let i = 0; i < N; i++) rs.push(playRun(c, BOTS[bot]!, `e3-${i}`));
  line(out.length === 1 ? content.byId[out[0]!]!.name : 'All five', rs);
}
