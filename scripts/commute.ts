/**
 * The C1 gate for commuting (DECISIONS.md, Teaching by layers): plays the
 * valley without commuting and with it, on the same seeds, with bots that
 * see only the forecast: one that ignores walks to work and one that minds
 * them (work near homes, homes near work). With and without water.
 *
 *   npx tsx scripts/commute.ts [runs each, default 30] [bot, default balanced] [setting=value ...]
 *
 * Settings change the commuting rules: free=3 (tiles walked for nothing),
 * per=4 (tiles beyond that per 1 wellbeing).
 *
 * The gate: commuting must cost a player who ignores it something real, and
 * minding it must win much of that back (placement is a decision), without
 * more runs collapsing.
 */
import willowReach from '../src/content/willow-reach.json';
import { loadContent, scoreRun, type Content, type RunState } from '../src/sim';
import { BOTS, commuteBlindBot, type Bot } from '../src/balance/bots';
import { playRun } from '../src/balance/runner';

const N = Number(process.argv[2] ?? 30);
const botName = (process.argv[3] ?? 'balanced') as 'balanced' | 'greedyFood' | 'greedyEnergy';
const settings = Object.fromEntries(process.argv.slice(4).map((a) => a.split('=')));

function contentWith(water: boolean, commute: boolean): Content {
  const raw = structuredClone(willowReach);
  raw.rules.water.enabled = water;
  raw.rules.commute.enabled = commute;
  if (settings.free) raw.rules.commute.freeDistance = Number(settings.free);
  if (settings.per) raw.rules.commute.tilesPerWellbeing = Number(settings.per);
  return loadContent(raw);
}

const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const pct = (n: number, of: number) => (of === 0 ? '–' : `${Math.round((n / of) * 100)}%`);

interface Result {
  score: number;
  heartwood: boolean;
  collapsed: boolean;
  /** Wellbeing lost to long walks over the run. */
  walkLoss: number;
  /** Tiles walked beyond the free distance per worker, averaged over seasons. */
  excessPerWorker: number;
  homes: number;
  citizens: number;
  wellbeing: number;
}

function play(content: Content, bot: Bot, seed: string): Result {
  let last: RunState | null = null;
  let loss = 0;
  let excess = 0;
  let workers = 0;
  playRun(content, bot, seed, {
    onSeason: (s) => {
      last = s;
      const c = s.lastReport!.commute;
      if (!c) return;
      loss -= c.wellbeing;
      excess += c.excess;
      workers += Object.values(c.walks).reduce((a, w) => a + w.length, 0);
    },
  });
  const s = last as unknown as RunState;
  const score = scoreRun(content, s);
  return {
    score: score.total,
    heartwood: score.tier.id === 'heartwood',
    collapsed: s.status === 'collapsed',
    walkLoss: loss,
    excessPerWorker: workers > 0 ? excess / workers : 0,
    homes: Object.values(s.buildings).filter((b) => content.byId[b.type]!.housing > 0).length,
    citizens: s.citizens,
    wellbeing: s.wellbeing,
  };
}

const seeds = Array.from({ length: N }, (_, i) => `commute-${i}`);
const aware = BOTS[botName]!;
const blind = commuteBlindBot(botName);
const cases: { label: string; water: boolean; commute: boolean; bot: Bot }[] = [
  { label: 'No commuting', water: false, commute: false, bot: aware },
  { label: 'Commuting, bot ignores walks', water: false, commute: true, bot: blind },
  { label: 'Commuting, bot minds walks', water: false, commute: true, bot: aware },
  { label: 'Water, no commuting', water: true, commute: false, bot: aware },
  { label: 'Water and commuting, bot ignores walks', water: true, commute: true, bot: blind },
  { label: 'Water and commuting, bot minds walks', water: true, commute: true, bot: aware },
];

const c0 = contentWith(false, false);
console.log(
  `Bot: ${botName}, ${N} runs each, forecast sight. Commuting: ${settings.free ?? c0.rules.commute.freeDistance} tiles free, 1 wellbeing per ${settings.per ?? c0.rules.commute.tilesPerWellbeing} tiles beyond.\n`,
);
console.log(
  '| Case | Median score | Heartwood | Collapsed | Wellbeing lost to walks (median, per run) | Tiles beyond free per worker | Homes at the end (median) | Citizens (median) | Wellbeing (median) |',
);
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const c of cases) {
  const content = contentWith(c.water, c.commute);
  const rs = seeds.map((s) => play(content, c.bot, s));
  console.log(
    `| ${c.label} | ${med(rs.map((r) => r.score))} | ${pct(rs.filter((r) => r.heartwood).length, N)} | ${pct(rs.filter((r) => r.collapsed).length, N)} | ${c.commute ? med(rs.map((r) => r.walkLoss)) : '–'} | ${c.commute ? (rs.reduce((a, r) => a + r.excessPerWorker, 0) / N).toFixed(2) : '–'} | ${med(rs.map((r) => r.homes))} | ${med(rs.map((r) => r.citizens))} | ${med(rs.map((r) => r.wellbeing))} |`,
  );
}
