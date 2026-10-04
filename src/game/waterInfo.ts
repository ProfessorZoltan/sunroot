/**
 * Water for the interface (EXPANSION.md, E2: "a player can see where every
 * unit of water went in any season"): what a tile of the map does with
 * water, and a season's water ledger, from the season's water report.
 */
import { hexKey, type Hex } from '../sim/hex';
import type { Content } from '../sim/content/load';
import type { FlowLines, RunState, WaterReport, WaterUnits } from '../sim/types';
import { riverIndexesNear } from '../sim/water';

const QUALITY_NAMES: Record<keyof WaterUnits, string> = {
  clean: 'clean',
  nutrient: 'nutrient-rich',
  grey: 'grey',
};

/** "2 clean + 1 nutrient-rich", or "none". */
export function describeUnits(u: WaterUnits): string {
  const parts = (Object.keys(QUALITY_NAMES) as (keyof WaterUnits)[])
    .filter((q) => u[q] > 0)
    .map((q) => `${u[q]} ${QUALITY_NAMES[q]}`);
  return parts.length > 0 ? parts.join(' + ') : 'none';
}

const total = (u: WaterUnits) => u.clean + u.nutrient + u.grey;

/** What happens to water on this tile this season, line by line (empty when there is none). */
export function waterAt(
  content: Content,
  state: RunState,
  report: WaterReport | null,
  at: Hex,
): string[] {
  if (!report) return [];
  const key = hexKey(at);
  const tile = state.map.tiles[key];
  const b = Object.values(state.buildings).find((x) => hexKey(x.at) === key);
  const def = b ? content.byId[b.type] : undefined;
  const lines: string[] = [];

  if (b && def?.water?.channel) {
    const c = report.channels.findIndex((ch) => ch?.tiles.includes(b.uid));
    const ch = report.channels[c];
    if (!ch) return ['Water: this stretch carries nothing (damaged, or cut off from its intake).'];
    const p = ch.tiles.indexOf(b.uid);
    const n = ch.tiles.length;
    lines.push(
      `Channel: tile ${p + 1} of ${n} from its intake (carries at most ${content.rules.water.channelCapacity}).`,
    );
    if (p === 0) {
      if (ch.intake === null) lines.push('No intake: it touches no river or lake at its ends.');
      else {
        const from = 'river' in ch.intake ? 'the river' : 'the lake';
        lines.push(
          `Takes ${ch.drawn} from ${from}${ch.evaporated > 0 ? `, ${ch.evaporated} of it lost to summer evaporation` : ''}.`,
        );
      }
      if (ch.fed > 0) lines.push(`${ch.fed} put in along it by ponds and buildings.`);
      if (ch.released > 0) lines.push(`${ch.released} released by its cisterns.`);
    }
    if ((ch.usedAt[p] ?? 0) > 0) lines.push(`Taken here: ${ch.usedAt[p]}.`);
    lines.push(
      `Flows on: ${describeUnits(ch.carriedBy[p] ?? { clean: 0, nutrient: 0, grey: 0 })}.`,
    );
    if (p === n - 1) {
      const back = total(ch.rejoined);
      const lost = total(ch.lost);
      if (back > 0) lines.push(`${back} returns to the river at its end.`);
      if (lost > 0) lines.push(`${lost} soaks away at its end (it doesn't reach the river).`);
    }
    return lines;
  }

  if (b && report.uses[b.uid]) {
    const u = report.uses[b.uid]!;
    const from = u.from === null ? 'nothing (no channel beside it)' : `the ${u.from}`;
    lines.push(`Water: needs ${u.need}, gets ${describeUnits(u.got)} from ${from}.`);
    if (u.short) lines.push(`Short of water: yields × ${content.rules.water.shortfallFactor}.`);
    else if (u.got.nutrient > 0 && def?.water?.nutrientBonus.food)
      lines.push(`Nutrient-rich water: +${def.water.nutrientBonus.food} food.`);
  }
  if (b && def?.water?.stores) {
    const fills = def.water.fills
      .map((on, i) => (on ? ['spring', 'summer', 'autumn', 'winter'][i] : null))
      .filter(Boolean);
    lines.push(
      `Cistern: holds ${b.stored ?? 0} of ${def.water.stores}; refills in ${fills.join(', ')}; covers buildings at or below it that run short.`,
    );
  }
  if (b && def?.water?.holdsBack && (b.stored ?? 0) > 0)
    lines.push(`Holding back ${b.stored} water for ${def.water.holdsBack.release}.`);
  if (b && def?.water?.wheel) {
    const near = riverIndexesNear(state, b.at).map((i) => report.flowAt[i] ?? 0);
    const flow = near.length > 0 ? Math.min(...near) : 0;
    const per = content.rules.water.wheelFlowPerEnergy;
    lines.push(
      `Turned by ${flow} flowing past: ${Math.ceil(flow / per)} energy a slot (1 for every ${per}).`,
    );
  }
  if (!b && tile?.riverIndex !== undefined) {
    const flow = report.flowAt[tile.riverIndex] ?? 0;
    lines.push(`River: ${flow} flowing on past here (${report.riverFlow} came in at the top).`);
  }
  if (
    !b &&
    (tile?.type === 'reservoir' || tile?.type === 'oasis') &&
    tile.riverIndex === undefined
  ) {
    lines.push(`Lake: holds ${tile.water ?? 0} (the spring flood fills it).`);
  }
  return lines;
}

/**
 * A season's water ledger: where it came from and where it went, every unit,
 * as flow lines (what buildings used is shown by building).
 */
export function waterLedger(
  content: Content,
  state: RunState,
  report: WaterReport,
): { made: FlowLines; used: FlowLines } {
  const made: FlowLines = {};
  const used: FlowLines = {};
  const add = (lines: FlowLines, label: string, amount: number, count = 1) => {
    if (amount <= 0) return;
    const l = (lines[label] ??= { amount: 0, count: 0 });
    l.amount += amount;
    l.count += count;
  };
  const IN: Record<string, string> = {
    river: 'The river, from upstream',
    flood: 'The spring flood',
    'fed by ponds': 'Fish ponds',
    returned: 'Returned by buildings',
    'stored at the start': 'In store at the start',
  };
  for (const [k, n] of Object.entries(report.in)) add(made, IN[k] ?? k, n);
  for (const [uid, u] of Object.entries(report.uses)) {
    const name = content.byId[state.buildings[uid]?.type ?? '']?.name ?? 'A building since removed';
    add(used, name, total(u.got));
  }
  const OUT: Record<string, string> = {
    evaporated: 'Evaporated',
    'lost at channel ends': 'Soaked away at channel ends',
    'flowed downstream': 'Flowed on downstream',
    'stored at the end': 'In store at the end',
  };
  for (const [k, n] of Object.entries(report.out)) if (k !== 'used') add(used, OUT[k] ?? k, n);
  return { made, used };
}

/** Plain lines for the season report: channels, who went short, grey water. */
export function waterNotes(content: Content, state: RunState, report: WaterReport): string[] {
  const name = (uid: string) =>
    content.byId[state.buildings[uid]?.type ?? '']?.name ?? 'A building since removed';
  const lines: string[] = [`The river brought ${report.riverFlow}.`];
  report.channels.forEach((ch, i) => {
    if (!ch) return;
    const from = ch.intake === null ? 'no intake' : 'river' in ch.intake ? 'the river' : 'a lake';
    lines.push(
      `Channel ${i + 1} (${ch.tiles.length} tiles, from ${from}): took ${ch.drawn}${ch.evaporated > 0 ? ` (${ch.evaporated} evaporated)` : ''}, gave ${ch.usedAt.reduce((a, b) => a + b, 0)} to buildings` +
        (ch.released > 0 ? `, ${ch.released} from cisterns` : '') +
        (total(ch.rejoined) > 0 ? `, returned ${total(ch.rejoined)} to the river` : '') +
        (total(ch.lost) > 0 ? `, lost ${total(ch.lost)} at its end` : '') +
        '.',
    );
  });
  const short = Object.entries(report.uses).filter(([, u]) => u.short);
  if (short.length > 0) {
    const counts = new Map<string, number>();
    for (const [uid] of short) counts.set(name(uid), (counts.get(name(uid)) ?? 0) + 1);
    lines.push(
      `Short of water (half yields): ${[...counts].map(([n, c]) => (c > 1 ? `${c} ${n}s` : n)).join(', ')}.`,
    );
  } else if (Object.keys(report.uses).length > 0) lines.push('Every building got its water.');
  if (report.greyToRiver > 0)
    lines.push(
      `${report.greyToRiver} grey water reached the river: −${report.greyToRiver * content.rules.water.greyHarmonyPerUnit} Harmony until next season.`,
    );
  return lines;
}
