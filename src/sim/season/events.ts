/** Step 3: the season's event. */
import { hexDistance, hexKey } from '../hex';
import { nextInt } from '../rng';
import { defOf, neighborTiles, occupancy, tileAt } from '../queries';
import type { SeasonContext } from './context';

/**
 * Mixed Grid: 3 or more source types each supplied at least 15% of the
 * energy over the last 4 seasons (the Founders' Camp doesn't count).
 */
/** The Mixed Grid's extra energy shows under this source in the energy report. */
export const MIXED_GRID_SOURCE = 'mixedGrid';

/** While the Mixed Grid holds, every slot gets a little extra energy. */
export function mixedGridBonus(ctx: SeasonContext): void {
  const bonus = ctx.content.rules.mixedGrid.bonusPerSlot;
  if (!ctx.report.mixedGrid || bonus === 0) return;
  for (const slot of ['day', 'night'] as const) {
    const r = ctx.report.energy[slot];
    r.bySource[MIXED_GRID_SOURCE] = (r.bySource[MIXED_GRID_SOURCE] ?? 0) + bonus;
    r.supply += bonus;
  }
}

export function hasMixedGrid(ctx: SeasonContext): boolean {
  const { minSourceTypes, minShare, excludeSources } = ctx.content.rules.mixedGrid;
  // Shares of built sources only: not the camp, not the bonus itself, not storage releases.
  const totals: Record<string, number> = {};
  for (const season of ctx.state.energyHistory.slice(-4)) {
    for (const [source, amount] of Object.entries(season)) {
      if (excludeSources.includes(source) || source === MIXED_GRID_SOURCE) continue;
      const type = ctx.content.byId[source]?.sourceType ?? source;
      totals[type] = (totals[type] ?? 0) + amount;
    }
  }
  const sum = Object.values(totals).reduce((a, b) => a + b, 0);
  if (sum === 0) return false;
  const qualifying = Object.values(totals).filter((v) => v / sum >= minShare).length;
  return qualifying >= minSourceTypes;
}

export function applyEvent(ctx: SeasonContext): void {
  const { content, state, report } = ctx;
  const event = state.forecast.event;
  report.event = event;
  report.mixedGrid = hasMixedGrid(ctx);

  switch (event) {
    case 'flood': {
      const buildings = Object.values(state.buildings);
      const weirs = buildings.filter((b) => defOf(content, b).weir);
      let floodable = state.map.floodOrder;
      if (weirs.length > 0) {
        const factor = Math.min(...weirs.map((w) => defOf(content, w).weir!.floodAreaFactor));
        floodable = floodable.slice(0, Math.floor(floodable.length * factor));
      }
      const levees = buildings.filter((b) => defOf(content, b).levee);
      const protectedTile = (key: string) => {
        const t = state.map.tiles[key]!;
        return levees.some((l) => hexDistance(l.at, t) <= defOf(content, l).levee!.radius);
      };
      const flooded = floodable.filter((k) => !protectedTile(k));
      report.flooded = flooded;
      const occ = occupancy(state);
      // Levees with Silt Traps let part of the silt through to the farms they protect.
      const share = Math.max(0, ...levees.map((l) => defOf(content, l).levee!.siltShare));
      if (share > 0) {
        for (const key of floodable) {
          const b = occ.get(key);
          if (!b || !protectedTile(key) || !defOf(content, b).farmland) continue;
          b.siltYear = state.year;
          b.siltShare = share;
          report.silted.push(b.uid);
        }
      }
      for (const key of flooded) {
        const b = occ.get(key);
        if (!b) continue;
        const def = defOf(content, b);
        if (def.farmland) {
          b.siltYear = state.year;
          b.siltShare = 1;
          report.silted.push(b.uid);
        }
        if (!def.floodTolerant && content.events.flood.damages) {
          b.damage = { cause: 'flood', turn: state.turn };
          report.damaged.push(b.uid);
        }
      }
      break;
    }
    case 'lowRiver':
      ctx.lowRiver = true;
      break;
    case 'storm': {
      if (report.mixedGrid) break;
      const count = content.events.storm.disableCount;
      for (let i = 0; i < count; i++) {
        const exposed = state.priority
          .map((uid) => state.buildings[uid]!)
          .filter((b) => {
            if (b.damage) return false;
            if (tileAt(state, b.at)?.type !== 'hill') return false;
            return !neighborTiles(state, b.at).some((t) => t.type === 'woodland');
          })
          .sort((a, b) => hexKey(a.at).localeCompare(hexKey(b.at)));
        if (exposed.length === 0) break;
        // A forecast knows which buildings are exposed, not which one the storm will hit.
        if (ctx.forecast) {
          report.atRisk = exposed.map((b) => b.uid);
          break;
        }
        const hit = exposed[nextInt(state.rng, exposed.length)]!;
        hit.damage = { cause: 'storm', turn: state.turn };
        report.damaged.push(hit.uid);
      }
      break;
    }
    case 'freeze':
      // Freeze is expressed by the seasonal tables (weak solar, winter heat demand, strong wind).
      break;
  }
}
