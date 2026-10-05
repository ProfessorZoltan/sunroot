/**
 * Lake Gardens' lake (proposals/lake-gardens.md, The new rules), resolved right after the water:
 *
 *  1. Nutrient and grey water that reached the lake settles mud on the shallows where it entered:
 *     1 mud for every `waterPerMud`, up to `siltAt` a tile.
 *  2. Its grey water stays in the lake. Fisheries that eat grey water take theirs, in priority
 *     order, and make food of it; then the lake cleans a little by itself.
 *  3. In the bloom seasons, a lake still holding more than `bloom.above` grey water blooms.
 *  4. Mud boats lift mud from the shallows beside them, the fullest first, as compost.
 *  5. A shallows tile holding `siltAt` mud is silted up until dredged.
 *
 * Off (and nothing here runs) without `rules.lake`.
 */
import { hexKey, hexNeighbors } from '../hex';
import { byPriority, defOf } from '../queries';
import type { LakeReport } from '../types';
import { addYield, explain, type SeasonContext } from './context';

export function resolveLake(ctx: SeasonContext): void {
  const { content, state, si } = ctx;
  const rules = content.rules.lake;
  if (!rules || !state.lake) return;
  const report: LakeReport = {
    greyIn: 0,
    eaten: 0,
    cleaned: 0,
    grey: 0,
    settled: {},
    dredged: {},
    bloom: false,
  };
  ctx.report.lake = report;
  const order = byPriority(state).filter((b) => ctx.active.has(b.uid));

  // 1. Mud settles where water entered, on the shallows.
  const entered = ctx.report.water?.lakeIn ?? {};
  for (const key of Object.keys(entered).sort()) {
    const u = entered[key]!;
    report.greyIn += u.grey;
    const t = state.map.tiles[key];
    if (!t || t.type !== 'shallows') continue;
    const before = t.mud ?? 0;
    let settling = (t.settling ?? 0) + u.grey + u.nutrient;
    let mud = before;
    while (settling >= rules.waterPerMud && mud < rules.siltAt) {
      settling -= rules.waterPerMud;
      mud += 1;
    }
    // A tile full of mud takes no more: what would have settled washes on.
    t.settling = mud < rules.siltAt ? settling : 0;
    t.mud = mud;
    if (mud > before) report.settled[key] = mud - before;
  }

  // 2. The lake's grey water: fisheries eat it, then the lake cleans a little by itself.
  state.lake.grey += report.greyIn;
  for (const b of order) {
    const eats = defOf(content, b).eatsGrey;
    if (!eats) continue;
    const t = Math.min(eats.takesGrey, state.lake.grey);
    if (t <= 0) continue;
    state.lake.grey -= t;
    report.eaten += t;
    addYield(ctx, b, 'food', t * eats.foodPerGrey);
    explain(ctx, b, `lake: ate ${t} grey water, made ${t * eats.foodPerGrey} food`);
  }
  report.cleaned = Math.min(rules.selfCleans, state.lake.grey);
  state.lake.grey -= report.cleaned;
  report.grey = state.lake.grey;

  // 3. A dirty lake blooms in the warm seasons.
  report.bloom = rules.bloom.seasons[si]! && state.lake.grey > rules.bloom.above;

  // 4. Mud boats lift mud from the shallows beside them, the fullest first, as compost.
  for (const b of order) {
    const can = defOf(content, b).dredges?.[si] ?? 0;
    if (can <= 0) continue;
    let left = can;
    const beside = hexNeighbors(b.at)
      .map((h) => state.map.tiles[hexKey(h)])
      .filter((t) => t !== undefined && t.type === 'shallows' && (t.mud ?? 0) > 0)
      .sort((x, y) => (y!.mud ?? 0) - (x!.mud ?? 0) || hexKey(x!).localeCompare(hexKey(y!)));
    for (const t of beside) {
      const lift = Math.min(left, t!.mud ?? 0);
      t!.mud = (t!.mud ?? 0) - lift;
      left -= lift;
    }
    const lifted = can - left;
    if (lifted <= 0) continue;
    report.dredged[b.uid] = lifted;
    addYield(ctx, b, 'compost', lifted);
    explain(ctx, b, `lake: lifted ${lifted} mud as compost`);
  }

  // 5. Shallows full of mud silt up; dredged below that, they open again.
  for (const t of Object.values(state.map.tiles)) {
    if (t.type !== 'shallows') continue;
    const full = (t.mud ?? 0) >= rules.siltAt;
    if (full) t.silted = true;
    else delete t.silted;
  }
}
