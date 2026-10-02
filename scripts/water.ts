/**
 * The E1 decision gate (EXPANSION.md, Build plan): plays the valley without
 * water (v1) and with it (v2, one row per bot water policy), on the same
 * seeds, with bots that see only the forecast, and reports whether summer
 * water is a real choice.
 *
 *   npx tsx scripts/water.ts [runs each, default 30] [bot, default balanced] [setting=value ...]
 *
 * Settings change the water rules for the v2 rows: summer=3 (summer river flow),
 * beside=on (buildings beside the river draw straight from it), capacity=5
 * (a channel's capacity), cistern=8 (a cistern's store), shortfall=0.25 (the yield a
 * building short of water keeps), commute=on (with commuting).
 *
 * Reads:
 * - Summers short: summers in years 1 to 3 in which at least one building got
 *   less water than it needed. The gate fails if most runs never fall short.
 * - Wheel loss: seasons in which water drawn upstream cost a river wheel energy.
 * - Policy wins: on each seed, which policy scored highest. The gate fails if
 *   one policy wins nearly every seed.
 * - Layouts: the commonest layout (channels, tiles of channel, cisterns) among
 *   the best quarter of v2 runs. The gate fails if one layout wins almost every time.
 */
import willowReach from '../src/content/willow-reach.json';
import { loadContent, scoreRun, waterOn, type Content, type RunState } from '../src/sim';
import { BOTS, WATER_POLICIES, waterBot, type WaterPolicy } from '../src/balance/bots';
import { playRun } from '../src/balance/runner';

const N = Number(process.argv[2] ?? 30);
const botName = (process.argv[3] ?? 'balanced') as 'balanced' | 'greedyFood' | 'greedyEnergy';
const settings = Object.fromEntries(process.argv.slice(4).map((a) => a.split('=')));

function contentWith(on: boolean): Content {
  const raw = structuredClone(willowReach);
  const w = raw.rules.water;
  w.enabled = on;
  if (settings.summer) w.riverFlow[1] = Number(settings.summer);
  if (settings.beside) w.drawBesideRiver = settings.beside === 'on';
  if (settings.capacity) w.channelCapacity = Number(settings.capacity);
  if (settings.shortfall) w.shortfallFactor = Number(settings.shortfall);
  if (settings.commute) raw.rules.commute.enabled = settings.commute === 'on';
  if (settings.cistern)
    raw.buildings.find((b) => b.id === 'cistern')!.water!.stores = Number(settings.cistern);
  return loadContent(raw);
}

const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const pct = (n: number, of: number) => (of === 0 ? '–' : `${Math.round((n / of) * 100)}%`);

interface Result {
  seed: string;
  score: number;
  tier: string;
  collapsed: boolean;
  foodPerCitizen: number;
  wheelShare: number;
  harmony: number;
  earlySummers: number;
  earlyShortSummers: number;
  /** Summers (all years) with a shortfall, of all summers. */
  shortSummers: number;
  summers: number;
  wheelLossSeasons: number;
  layout: string;
}

function play(content: Content, policy: WaterPolicy | null, seed: string): Result {
  const bot = policy ? waterBot(botName, policy) : BOTS[botName]!;
  let last: RunState | null = null;
  let earlySummers = 0;
  let earlyShort = 0;
  let summers = 0;
  let short = 0;
  let wheelLoss = 0;
  playRun(content, bot, seed, {
    onSeason: (s) => {
      last = s;
      const r = s.lastReport!;
      const w = r.water;
      if (!w) return;
      const isShort = Object.values(w.uses).some((u) => u.short);
      if (r.season === 'summer') {
        summers++;
        if (isShort) short++;
        if (r.year <= 3) {
          earlySummers++;
          if (isShort) earlyShort++;
        }
      }
      const full = Math.ceil(w.riverFlow / content.rules.water.wheelFlowPerEnergy);
      const lost = Object.values(s.buildings).some((b) => {
        if (!content.byId[b.type]!.water?.wheel) return false;
        const made = r.generated[b.uid]?.energy.day;
        return made !== undefined && made < full && !r.shaded[b.uid];
      });
      if (lost) wheelLoss++;
    },
  });
  const s = last as unknown as RunState;
  const score = scoreRun(content, s);
  const energy = Object.values(s.ledger.energy).reduce((a, b) => a + b, 0);
  const channelTiles = Object.values(s.buildings).filter((b) => b.type === 'irrigationChannel');
  const channelCount = waterOn(content)
    ? new Set((s.lastReport?.water?.channels ?? []).map((c) => c.tiles[0])).size
    : 0;
  const cisterns = Object.values(s.buildings).filter((b) => b.type === 'cistern').length;
  const bucket = (n: number, cuts: number[]) => {
    const i = cuts.findIndex((c) => n <= c);
    return i < 0 ? `>${cuts.at(-1)}` : `≤${cuts[i]}`;
  };
  return {
    seed,
    score: score.total,
    tier: score.tier.id,
    collapsed: s.status === 'collapsed',
    foodPerCitizen: s.ledger.foodMade / Math.max(1, s.ledger.citizenSeasons),
    wheelShare: (s.ledger.energy.riverWheel ?? 0) / Math.max(1, energy),
    harmony: s.harmony,
    earlySummers,
    earlyShortSummers: earlyShort,
    shortSummers: short,
    summers,
    wheelLossSeasons: wheelLoss,
    layout: `${channelCount} channel(s), ${bucket(channelTiles.length, [3, 8])} tiles, ${cisterns > 0 ? 'cisterns' : 'no cistern'}`,
  };
}

const seeds = Array.from({ length: N }, (_, i) => `water-${i}`);
const rows: { label: string; policy: WaterPolicy | null; results: Result[] }[] = [];
const v1 = contentWith(false);
const v2 = contentWith(true);
rows.push({ label: 'v1 (no water)', policy: null, results: seeds.map((s) => play(v1, null, s)) });
for (const policy of WATER_POLICIES) {
  rows.push({ label: `v2 ${policy}`, policy, results: seeds.map((s) => play(v2, policy, s)) });
}

console.log(
  `Bot: ${botName}, ${N} runs each, forecast sight. Water: ${JSON.stringify(v2.rules.water.riverFlow)} river flow, channels carry ${v2.rules.water.channelCapacity}, ${v2.rules.water.drawBesideRiver ? 'buildings beside the river draw from it' : 'all water through channels'}.\n`,
);
console.log(
  '| Case | Median score | Heartwood | Collapsed | Food per citizen-season | River wheel share | Harmony | Summers short, years 1–3 | Runs never short, years 1–3 | Summers short, all | Seasons a wheel lost power |',
);
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const r of rows) {
  const rs = r.results;
  const sum = (f: (x: Result) => number) => rs.reduce((a, x) => a + f(x), 0);
  console.log(
    `| ${r.label} | ${med(rs.map((x) => x.score))} | ${pct(rs.filter((x) => x.tier === 'heartwood').length, N)} | ${pct(rs.filter((x) => x.collapsed).length, N)} | ${(sum((x) => x.foodPerCitizen) / N).toFixed(2)} | ${pct(
      sum((x) => x.wheelShare),
      N,
    )} | ${med(rs.map((x) => x.harmony))} | ${pct(
      sum((x) => x.earlyShortSummers),
      sum((x) => x.earlySummers),
    )} | ${r.policy ? pct(rs.filter((x) => x.earlyShortSummers === 0).length, N) : '–'} | ${pct(
      sum((x) => x.shortSummers),
      sum((x) => x.summers),
    )} | ${r.policy ? (sum((x) => x.wheelLossSeasons) / N).toFixed(1) : '–'} |`,
  );
}

// Which policy did best on each seed.
const v2rows = rows.filter((r) => r.policy);
const wins: Record<string, number> = {};
seeds.forEach((_, i) => {
  const best = Math.max(...v2rows.map((r) => r.results[i]!.score));
  const winners = v2rows.filter((r) => r.results[i]!.score === best);
  for (const w of winners) wins[w.policy!] = (wins[w.policy!] ?? 0) + 1 / winners.length;
});
console.log('\n| Policy | Seeds won (ties shared) |');
console.log('| --- | --- |');
for (const r of v2rows) console.log(`| ${r.policy} | ${pct(wins[r.policy!] ?? 0, N)} |`);

// Layouts of the best quarter of all v2 runs.
const all = v2rows.flatMap((r) => r.results).sort((a, b) => b.score - a.score);
const top = all.slice(0, Math.max(1, Math.floor(all.length / 4)));
const layouts: Record<string, number> = {};
for (const x of top) layouts[x.layout] = (layouts[x.layout] ?? 0) + 1;
console.log('\n| Layout among the best quarter of v2 runs | Share |');
console.log('| --- | --- |');
for (const [layout, n] of Object.entries(layouts).sort((a, b) => b[1] - a[1]))
  console.log(`| ${layout} | ${pct(n, top.length)} |`);
