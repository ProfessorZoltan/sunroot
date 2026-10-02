/**
 * The H1 gate for local heat (DECISIONS.md, Teaching by layers): plays the
 * valley with heat shared and with it local, on the same seeds, with bots
 * that see only the forecast: one that places heat sources where it always
 * did, and one that keeps them near what they heat. Alone, with the layers
 * below it on the ladder (water and walks to work), and in a Long Winter,
 * when homes need far more heat.
 *
 *   npx tsx scripts/heat.ts [runs each, default 30] [bot, default balanced] [range=2] [cost=2]
 *
 * cost: energy per heat paid from the grid while local heat is on (resistive heating).
 *
 * The gate, as for walks to work: local heat must cost a player who ignores
 * it something real, minding it must win much of that back, and no more runs
 * may collapse.
 */
import willowReach from '../src/content/willow-reach.json';
import { loadContent, scoreRun, type Content, type RunState } from '../src/sim';
import { BOTS, heatBlindBot, type Bot } from '../src/balance/bots';
import { playRun } from '../src/balance/runner';

const N = Number(process.argv[2] ?? 30);
const botName = (process.argv[3] ?? 'balanced') as 'balanced' | 'greedyFood' | 'greedyEnergy';
const settings = Object.fromEntries(process.argv.slice(4).map((a) => a.split('=')));

function contentWith(local: boolean, below: boolean): Content {
  const raw = structuredClone(willowReach);
  raw.rules.localHeat.enabled = local;
  if (settings.range) raw.rules.localHeat.range = Number(settings.range);
  if (settings.cost)
    (raw.rules.localHeat as { gridHeatCost?: number }).gridHeatCost = Number(settings.cost);
  raw.rules.water.enabled = below;
  raw.rules.commute.enabled = below;
  (raw.rules.score as { layers?: unknown }).layers = { water: 0, commute: 0, localHeat: 0 };
  return loadContent(raw);
}

const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const pct = (n: number, of: number) => (of === 0 ? '–' : `${Math.round((n / of) * 100)}%`);

interface Result {
  score: number;
  heartwood: boolean;
  collapsed: boolean;
  /** Heat demand over the run, and the share paid 1:1 from the grid. */
  heat: number;
  direct: number;
  shortfall: number;
  heatSources: number;
}

function play(content: Content, bot: Bot, seed: string, twist: string | null): Result {
  let last: RunState | null = null;
  let heat = 0;
  let direct = 0;
  let shortfall = 0;
  playRun(content, bot, seed, {
    run: { expedition: { twist, request: null } },
    onSeason: (s) => {
      last = s;
      for (const slot of ['day', 'night'] as const) {
        const e = s.lastReport!.energy[slot];
        heat += e.heat.demand;
        direct += e.heat.direct - e.storageDischarged;
        shortfall += e.shortfall;
      }
    },
  });
  const s = last as unknown as RunState;
  const score = scoreRun(content, s);
  const isSource = (id: string) => {
    const d = content.byId[id]!;
    return (
      d.heatPump !== undefined || d.heatGeneration !== undefined || d.storage?.holds === 'heat'
    );
  };
  return {
    score: score.total,
    heartwood: score.tier.id === 'heartwood',
    collapsed: s.status === 'collapsed',
    heat,
    direct: Math.max(0, direct),
    shortfall,
    heatSources: Object.values(s.buildings).filter((b) => isSource(b.type)).length,
  };
}

const seeds = Array.from({ length: N }, (_, i) => `heat-${i}`);
const aware = BOTS[botName]!;
const blind = heatBlindBot(botName);
const cases: { label: string; local: boolean; below: boolean; bot: Bot; twist: string | null }[] =
  [];
for (const [below, twist, where] of [
  [false, null, ''],
  [true, null, 'with water and walks, '],
  [true, 'longWinter', 'with water and walks, Long Winter, '],
] as const) {
  cases.push(
    { label: `${where}heat shared`, local: false, below, bot: aware, twist },
    { label: `${where}local heat, bot ignores it`, local: true, below, bot: blind, twist },
    { label: `${where}local heat, bot minds it`, local: true, below, bot: aware, twist },
  );
}

console.log(
  `Bot: ${botName}, ${N} runs each, forecast sight, layers' score lines at 0. Heat reaches ${settings.range ?? willowReach.rules.localHeat.range} tiles; the grid's heat costs ${settings.cost ?? 1} energy each.\n`,
);
console.log(
  '| Case | Median score | Heartwood | Collapsed | Heat paid from the grid | Shortfall over the run (median) | Heat sources at the end (median) |',
);
console.log('| --- | --- | --- | --- | --- | --- | --- |');
for (const c of cases) {
  const content = contentWith(c.local, c.below);
  const rs = seeds.map((s) => play(content, c.bot, s, c.twist));
  const heat = rs.reduce((a, r) => a + r.heat, 0);
  const direct = rs.reduce((a, r) => a + r.direct, 0);
  console.log(
    `| ${c.label.charAt(0).toUpperCase() + c.label.slice(1)} | ${med(rs.map((r) => r.score))} | ${pct(rs.filter((r) => r.heartwood).length, N)} | ${pct(rs.filter((r) => r.collapsed).length, N)} | ${pct(direct, heat)} | ${med(rs.map((r) => r.shortfall))} | ${med(rs.map((r) => r.heatSources))} |`,
  );
}
