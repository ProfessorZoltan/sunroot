/**
 * The heat layer's gate (H2; DECISIONS.md, Heat needs a building): plays the
 * valley with heat shared and paid from the grid (runs 1 to 3), and with the
 * heat layer (energy can't heat directly; sources reach 2 tiles), on the same
 * seeds, with bots that see only the forecast: one that places heat sources
 * where it always did, and one that keeps them near what they heat. Alone,
 * with the layers below it on the ladder (water and walks to work), and in a
 * Long Winter.
 *
 *   npx tsx scripts/heat.ts [runs each, default 30] [bot, default balanced] [range=2] [cold=1]
 *
 * cold: wellbeing a cold home costs for each bed in it, beyond an unpowered home's.
 *
 * The gate, as for walks to work: the layer must cost a player who ignores it
 * something real, minding it must win much of that back, and no more runs
 * may collapse.
 */
import willowReach from '../src/content/willow-reach.json';
import { loadContent, scoreRun, type Content, type RunState } from '../src/sim';
import { BOTS, heatBlindBot, type Bot } from '../src/balance/bots';
import { playRun } from '../src/balance/runner';

const N = Number(process.argv[2] ?? 30);
const botName = (process.argv[3] ?? 'balanced') as 'balanced' | 'greedyFood' | 'greedyEnergy';
const settings = Object.fromEntries(process.argv.slice(4).map((a) => a.split('=')));

function contentWith(layer: boolean, below: boolean): Content {
  const raw = structuredClone(willowReach);
  raw.rules.localHeat.enabled = layer;
  (raw.rules.localHeat as { gridHeat?: boolean }).gridHeat = !layer;
  if (settings.range) raw.rules.localHeat.range = Number(settings.range);
  if (settings.cold) raw.rules.localHeat.coldPerBed = Number(settings.cold);
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
  /** Building-seasons shut off cold, and heat sources standing at the end. */
  cold: number;
  heatSources: number;
}

function play(content: Content, bot: Bot, seed: string, twist: string | null): Result {
  let last: RunState | null = null;
  let cold = 0;
  playRun(content, bot, seed, {
    run: { expedition: { twist, request: null } },
    onSeason: (s) => {
      last = s;
      cold += s.lastReport!.cold.length;
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
    cold,
    heatSources: Object.values(s.buildings).filter((b) => isSource(b.type)).length,
  };
}

const seeds = Array.from({ length: N }, (_, i) => `heat-${i}`);
const aware = BOTS[botName]!;
const blind = heatBlindBot(botName);
const cases: { label: string; layer: boolean; below: boolean; bot: Bot; twist: string | null }[] =
  [];
for (const [below, twist, where] of [
  [false, null, ''],
  [true, null, 'with water and walks, '],
  [true, 'longWinter', 'with water and walks, Long Winter, '],
] as const) {
  // A Long Winter brings the heat layer itself; "shared" there is the twist as it was before.
  cases.push(
    { label: `${where}heat shared, from the grid`, layer: false, below, bot: aware, twist },
    { label: `${where}heat layer, bot ignores it`, layer: true, below, bot: blind, twist },
    { label: `${where}heat layer, bot minds it`, layer: true, below, bot: aware, twist },
  );
}

console.log(
  `Bot: ${botName}, ${N} runs each, forecast sight, layers' score lines at 0. Heat reaches ${settings.range ?? willowReach.rules.localHeat.range} tiles; a cold home costs ${settings.cold ?? willowReach.rules.localHeat.coldPerBed} more wellbeing a bed.\n`,
);
console.log(
  '| Case | Median score | Heartwood | Collapsed | Cold building-seasons (median) | Heat sources at the end (median) |',
);
console.log('| --- | --- | --- | --- | --- | --- |');
for (const c of cases) {
  let content = contentWith(c.layer, c.below);
  if (c.twist === 'longWinter' && !c.layer) {
    // The Long Winter before the heat layer: its modifiers without the heat rules.
    const raw = structuredClone(willowReach);
    const t = raw.twists.find((x) => x.id === 'longWinter') as unknown as {
      modifiers: { path: string }[];
    };
    t.modifiers = t.modifiers.filter((m) => !m.path.startsWith('localHeat.'));
    raw.rules.water.enabled = c.below;
    raw.rules.commute.enabled = c.below;
    (raw.rules.score as { layers?: unknown }).layers = { water: 0, commute: 0, localHeat: 0 };
    content = loadContent(raw);
  }
  const rs = seeds.map((s) => play(content, c.bot, s, c.twist));
  console.log(
    `| ${c.label.charAt(0).toUpperCase() + c.label.slice(1)} | ${med(rs.map((r) => r.score))} | ${pct(rs.filter((r) => r.heartwood).length, N)} | ${pct(rs.filter((r) => r.collapsed).length, N)} | ${med(rs.map((r) => r.cold))} | ${med(rs.map((r) => r.heatSources))} |`,
  );
}
