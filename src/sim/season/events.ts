/** Step 3: the season's event. */
import { hexDistance, hexKey, hexNeighbors } from '../hex';
import { nextInt } from '../rng';
import {
  defOf,
  eventOf,
  heightAt,
  neighborBuildings,
  neighborTiles,
  occupancy,
  stormExposed,
  tileAt,
} from '../queries';
import { addYield, type SeasonContext } from './context';
import { edgeKey } from '../edges';
import { festivalThisSeason, siltBeyond } from '../wildlife';

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

/**
 * A late frost with the flood (the Highland's snowmelt): farmland high enough loses food for the
 * rest of the year, unless standing water beside it keeps the frost off (waru waru).
 */
export function frostFarms(ctx: SeasonContext): void {
  const { content, state, report } = ctx;
  const frost = content.events.flood?.frost;
  if (!frost) return;
  report.frosted = [];
  report.frostSpared = [];
  const occ = occupancy(state);
  for (const b of Object.values(state.buildings)) {
    if (!defOf(content, b).farmland || heightAt(state, b.at) < frost.fromHeight) continue;
    const warm =
      neighborTiles(state, b.at).some((t) => frost.besideTiles.includes(t.type)) ||
      neighborBuildings(state, b, occ).some((n) => frost.besideBuildings.includes(n.type));
    if (warm) {
      report.frostSpared.push(b.uid);
      continue;
    }
    b.frostYear = state.year;
    report.frosted.push(b.uid);
  }
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
      report.sheltered = floodable.filter((k) => protectedTile(k));
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
      const salt = eventOf(content, 'flood').salt;
      for (const key of flooded) {
        const b = occ.get(key);
        if (!b) continue;
        const def = defOf(content, b);
        // The king tide's salt water, where the Reach's flood leaves silt.
        if (def.farmland && salt && def.saltProof) {
          // Sheltered by its dunes: no salt, and no silt either.
        } else if (def.farmland && salt) {
          if (b.saltTurn !== undefined) b.saltBefore = b.saltTurn;
          b.saltTurn = state.turn;
          report.salted.push(b.uid);
        } else if (def.farmland && eventOf(content, 'flood').siltBonus > 0) {
          // A flood that leaves no silt (the Highland's snowmelt) leaves none on the farms either.
          b.siltYear = state.year;
          b.siltShare = 1;
          report.silted.push(b.uid);
        }
        if (!def.floodTolerant && eventOf(content, 'flood').damages) {
          b.damage = { cause: 'flood', turn: state.turn };
          report.damaged.push(b.uid);
        }
      }
      frostFarms(ctx);
      // The Flood Fair: the silt reaches farms beyond the water, which does them no harm.
      const rings = festivalThisSeason(content, state)?.siltRings ?? 0;
      for (const uid of siltBeyond(content, state, flooded, rings)) {
        const b = state.buildings[uid]!;
        if (report.silted.includes(uid) && b.siltShare === 1) continue;
        b.siltYear = state.year;
        b.siltShare = 1;
        if (!report.silted.includes(uid)) report.silted.push(uid);
      }
      break;
    }
    case 'lowRiver':
      ctx.lowRiver = true;
      break;
    case 'fog': {
      // Sea fog: fogged sources make less (see generate), and cisterns catch the drip.
      ctx.fog = true;
      const fog = eventOf(content, 'fog');
      for (const b of Object.values(state.buildings)) {
        const store = defOf(content, b).water?.stores;
        if (store && fog.cisternCatch > 0)
          b.stored = Math.min(store, (b.stored ?? 0) + fog.cisternCatch);
      }
      break;
    }
    case 'storm': {
      report.exposed = state.priority.filter((uid) =>
        stormExposed(content, state, state.buildings[uid]!),
      );
      // The strandline: what the storm washes up (a beachcombing yard after a gale).
      for (const b of Object.values(state.buildings)) {
        const washed = defOf(content, b).strandline;
        if (washed > 0 && !b.damage)
          addYield(ctx, b, 'salvage', washed, 'Strandline after the storm');
      }
      const storm = eventOf(content, 'storm');
      if (report.mixedGrid && storm.mixedGridShelters) break;
      const count = storm.disableCount;
      for (let i = 0; i < count; i++) {
        const exposed = state.priority
          .map((uid) => state.buildings[uid]!)
          .filter((b) => !b.damage && stormExposed(content, state, b))
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
        // A cyclone fells the canopy of a garden it strikes.
        const fells = storm.fellsLayers;
        if (hit.layers?.some((l) => fells.includes(l.id))) {
          hit.layers = hit.layers.filter((l) => !fells.includes(l.id));
          (report.felled ??= []).push(hit.uid);
        }
      }
      break;
    }
    case 'freeze':
      // Freeze is expressed by the seasonal tables (weak solar, winter heat demand, strong wind).
      break;
    case 'bloom':
      // The lake's own step decides whether it blooms (resolveLake).
      break;
    case 'firstRains':
      // The milpas sown with the rains make more next season (computeYield).
      break;
    case 'fire':
      dryFire(ctx);
      break;
  }
}

/**
 * The dry season's fire (Rainforest Gardens): open forest beside cleared ground (open, or a field)
 * may catch, unless an edge building (a living fence) runs between them. A forecast names the tiles at risk; the
 * season burns `count` of them, by chance, to `burnsTo`.
 */
function dryFire(ctx: SeasonContext): void {
  const { content, state, report } = ctx;
  const fire = eventOf(content, 'fire');
  const occ = occupancy(state);
  const risk = Object.values(state.map.tiles)
    .filter(
      (t) =>
        fire.burns.includes(t.type) &&
        !occ.has(hexKey(t)) &&
        hexNeighbors(t).some((n) => {
          const from = tileAt(state, n);
          // Open ground and fields burn; the ground under a house or a workshop is kept clear.
          const on = occ.get(hexKey(n));
          return (
            from !== undefined &&
            fire.catchesFrom.includes(from.type) &&
            (!on || defOf(content, on).farmland) &&
            !state.hedges.includes(edgeKey(t, n))
          );
        }),
    )
    .map(hexKey)
    .sort();
  report.fireRisk = risk;
  if (ctx.forecast) return;
  report.burned = [];
  let left = risk;
  for (let i = 0; i < fire.count && left.length > 0; i++) {
    const key = left[nextInt(state.rng, left.length)]!;
    state.map.tiles[key]!.type = fire.burnsTo;
    report.burned.push(key);
    left = left.filter((k) => k !== key);
  }
}
