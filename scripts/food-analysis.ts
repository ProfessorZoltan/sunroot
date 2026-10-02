/**
 * Where does the food come from? Replays bot runs and tallies, per year:
 * food made by building type, bonuses (Harmony, silt, compost, apiary,
 * loops), food eaten, rotted, and citizens. Usage:
 *   npx tsx scripts/food-analysis.ts [runs per bot] [bots]
 */
import willowReach from '../src/content/willow-reach.json';
import { loadBiome } from '../src/content';
import { BOTS } from '../src/balance/bots';
import { playRun } from '../src/balance/runner';

const content = loadBiome(willowReach);
const runs = Number(process.argv[2] ?? 50);
const bots = (process.argv[3] ?? 'greedyFood,greedyEnergy,balanced').split(',');

for (const name of bots) {
  const years = new Map<number, Record<string, number>>();
  const add = (y: number, k: string, n: number) => {
    const row = years.get(y) ?? {};
    row[k] = (row[k] ?? 0) + n;
    years.set(y, row);
  };
  for (let i = 0; i < runs; i++) {
    playRun(content, BOTS[name]!, `food-${i}`, {
      onSeason: (s) => {
        const r = s.lastReport!;
        const y = r.year;
        add(y, 'seasons', 1);
        add(y, 'made', r.food.produced);
        add(y, 'eaten', r.food.eaten);
        add(y, 'rotted', r.food.rotted);
        add(y, 'unfed', r.food.unfed);
        add(y, 'citizens', r.population.after);
        add(
          y,
          'workers',
          Object.values(s.buildings).reduce((n, b) => n + (content.byId[b.type]?.workers ?? 0), 0),
        );
        for (const [uid, y2] of Object.entries(r.yields)) {
          const f = y2.food ?? 0;
          if (!f) continue;
          add(y, `by:${s.buildings[uid]!.type}`, f);
          add(y, `n:${s.buildings[uid]!.type}`, 1);
        }
        for (const lines of Object.values(r.math)) {
          for (const l of lines) {
            const m = /^\+(\d+) food from (a neighbouring|the) (.+)$/.exec(l);
            if (m) add(y, `bonus:${m[3]}`, Number(m[1]));
          }
        }
        add(y, 'harmony', r.harmony.value);
      },
    });
  }
  console.log(`\n## ${name} (${runs} runs; per run per year)`);
  const keys = new Set<string>();
  for (const row of years.values()) Object.keys(row).forEach((k) => keys.add(k));
  const ordered = [
    'made',
    'eaten',
    'rotted',
    'unfed',
    'citizens',
    'workers',
    'harmony',
    ...[...keys].filter((k) => k.startsWith('by:')).sort(),
    ...[...keys].filter((k) => k.startsWith('bonus:')).sort(),
  ];
  console.log(['year', ...ordered].join('\t'));
  for (const [y, row] of [...years].sort((a, b) => a[0] - b[0])) {
    if (y > 12) continue;
    const per = (k: string) => {
      const v = row[k] ?? 0;
      if (k === 'citizens' || k === 'workers' || k === 'harmony')
        return (v / (row.seasons ?? 1)).toFixed(0);
      return (v / runs).toFixed(1);
    };
    console.log([y, ...ordered.map(per)].join('\t'));
  }
}
