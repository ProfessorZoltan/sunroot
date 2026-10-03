/**
 * Bot strategies for the balance simulator. The design asks for greedy food,
 * greedy energy and random; "balanced" is a fourth, steadier baseline that
 * spends on Harmony and wellbeing once its needs are met.
 *
 * The three non-random bots share a survival layer: they cover this season's
 * power shortfalls, keep a food buffer, house growth and deal with scraps,
 * checking each fix by peeking at how the season would end. They differ in
 * which cards they draft, how they fix problems and how they spend the rest.
 */
import {
  effectiveContent,
  festivals,
  hexDistance,
  hexKey,
  hexNeighbors,
  flower,
  wonderOf,
  wonders,
  type Hex,
  type Tile,
} from '../sim';
import { pick, nextFloat, nextInt } from '../sim/rng';
import { lowGround, siteScore, type Turn } from './turn';
import { edgeBuilding } from '../sim/edges';
import { stormExposed } from '../sim/queries';
import { wonderSiteProblem } from '../sim/wonder';
import type { BuildingDef } from '../sim/content/schema';

/**
 * How a bot handles water (EXPANSION.md), when the water system is on. The
 * E1 decision gate compares them:
 * - `river`: digs nothing beyond the camp's channel; builds what needs water beside water.
 * - `short`: starts new channels from the river, never extends one.
 * - `long`: extends the channels it has, never starts another.
 * - `fields`: lays whichever tile reaches the most dry farmland (the default).
 * - `storage`: as `fields`, plus cisterns and weirs to carry spring's water into summer.
 */
export type WaterPolicy = 'river' | 'short' | 'long' | 'fields' | 'storage';
export const WATER_POLICIES: readonly WaterPolicy[] = [
  'river',
  'short',
  'long',
  'fields',
  'storage',
];

export interface Bot {
  name: string;
  description: string;
  playSeason(turn: Turn): void;
}

interface Profile {
  cards: string[];
  nightPower: string[];
  dayPower: string[];
  food: string[];
  /** Materials kept back for emergencies before spending on extras. */
  reserve: number;
  extras(turn: Turn, profile: Profile): void;
  /** Goes for the biome's wonder once its era comes (E5). */
  wonder?: boolean;
}

/** Builds the first candidate that makes `measure` smaller when the season is peeked. */
function buildFirstThatHelps(
  turn: Turn,
  candidates: readonly string[],
  measure: (t: Turn) => number,
): boolean {
  const before = measure(turn);
  for (const id of candidates) {
    if (!turn.canBuild(id)) continue;
    const saved = turn.save();
    if (!turn.build(id)) continue;
    if (measure(turn) < before) return true;
    turn.restore(saved); // didn't help: take it back, as a free undo would
  }
  return false;
}

function peekOr<T>(
  turn: Turn,
  read: (p: NonNullable<ReturnType<Turn['peek']>>) => T,
  fallback: T,
): T {
  const p = turn.peek();
  return p ? read(p) : fallback;
}

const shortfall = (slot: 'day' | 'night') => (t: Turn) =>
  peekOr(t, (p) => p.report.energy[slot].shortfall + p.report.blackouts.length, 0);

/**
 * Food still wanted by the end of this season: a season of eating in store
 * (two before winter, when farms rest), but never more than storage holds.
 */
const foodGap = (t: Turn) =>
  peekOr(
    t,
    (p) => {
      const seasons = t.state.season === 'autumn' ? 2 : 1;
      const want = Math.min(t.state.citizens * seasons, t.foodStorage() - 5);
      return Math.max(0, want - p.state.stores.food) + p.report.food.unfed * 10;
    },
    0,
  );

/** The biome's farms (fields that want water) and orchards: those of these it has. */
const FARMS = ['floodplainFarm', 'croft', 'glenFarm', 'terraceFarm'];
const ORCHARDS = ['orchard'];
const tilesFor = (turn: Turn, ids: readonly string[]) =>
  ids.flatMap((id) => turn.content.byId[id]?.placement.tiles ?? []);

/** Workshop runs short of two each, while there is salvage for them. */
const idleWorkshops = (t: Turn) =>
  t.state.stores.salvage < 6
    ? 0
    : peekOr(
        t,
        (p) =>
          Object.values(t.state.buildings)
            .filter((b) => b.type === 'workshop')
            .reduce((sum, b) => sum + Math.max(0, 2 - (p.report.runs[b.uid]?.runs ?? 0)), 0),
        0,
      );

/** Free sites a farm or orchard could take that can draw water. */
function wateredSites(turn: Turn): number {
  const taken = new Set(Object.values(turn.state.buildings).map((b) => hexKey(b.at)));
  const land = tilesFor(turn, [...FARMS, ...ORCHARDS]);
  const fits = (t: Tile) => land.includes(t.type);
  return Object.values(turn.state.map.tiles).filter(
    (t) => !taken.has(hexKey(t)) && fits(t) && turn.watered(t),
  ).length;
}

/** The tile of channel that would bring water to the most dry farmland, by the policy's rules. */
function bestChannelSite(turn: Turn, policy: WaterPolicy): Tile | undefined {
  const channelAt = new Set(
    Object.values(turn.state.buildings)
      .filter((b) => turn.content.byId[b.type]!.water?.channel)
      .map((b) => hexKey(b.at)),
  );
  const taken = new Set(Object.values(turn.state.buildings).map((b) => hexKey(b.at)));
  const farm = tilesFor(turn, FARMS);
  const orchard = tilesFor(turn, ORCHARDS);
  let best: Tile | undefined;
  let bestScore = 2;
  for (const t of turn.sites(turn.rules.rules.water.channelBuilding)) {
    const extends_ = hexNeighbors(t).some((n) => channelAt.has(hexKey(n)));
    if (policy === 'short' && extends_) continue;
    if (policy === 'long' && !extends_ && channelAt.size > 0) continue;
    let score = lowGround(t) ? -1 : 0;
    for (const n of hexNeighbors(t)) {
      const tile = turn.state.map.tiles[hexKey(n)];
      if (!tile || taken.has(hexKey(n)) || turn.watered(n)) continue;
      if (farm.includes(tile.type)) score += 2;
      else if (orchard.includes(tile.type)) score += 1;
    }
    score += nextFloat(turn.rng) * 0.1;
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return best;
}

/** Water: channels towards dry farmland when watered sites run low, and storage. */
function tendWater(turn: Turn, profile: Profile, policy: WaterPolicy): void {
  if (!turn.waterOn || policy === 'river') return;
  const channel = turn.rules.rules.water.channelBuilding;
  for (let i = 0; i < 2 && wateredSites(turn) < 3; i++) {
    if (!turn.canBuild(channel, profile.reserve)) break;
    const site = bestChannelSite(turn, policy);
    if (!site || !turn.apply({ type: 'place', building: channel, at: { q: site.q, r: site.r } }))
      break;
  }
  if (policy === 'storage') {
    // A cistern for every 4 buildings that need water in summer, built before summer.
    const thirsty = Object.values(turn.state.buildings).filter(
      (b) => (turn.content.byId[b.type]!.water?.needs[1] ?? 0) > 0,
    ).length;
    const season = turn.state.season;
    if ((season === 'spring' || season === 'winter') && turn.count('cistern') * 4 < thirsty)
      turn.build('cistern', profile.reserve);
  }
}

/**
 * Heat each building still lacks at its neediest (any season, either slot), once the heat
 * pumps within reach have given what they can, nearest first, in priority order.
 */
function uncoveredHeat(turn: Turn): Map<string, number> {
  const rules = turn.rules;
  const range = rules.rules.localHeat.range;
  const buildings = turn.state.priority.map((uid) => turn.state.buildings[uid]!).filter(Boolean);
  const peak = (id: string) => {
    const h = rules.byId[id]!.demand?.heat;
    return h ? Math.max(...h.day, ...h.night) : 0;
  };
  const capacity = new Map(
    buildings
      .filter((b) => rules.byId[b.type]!.heatPump)
      .map((b) => [b.uid, rules.byId[b.type]!.heatPump!.maxHeatPerSlot]),
  );
  const left = new Map<string, number>();
  for (const b of buildings) {
    let need = peak(b.type);
    if (need === 0) continue;
    const near = [...capacity.keys()]
      .map((uid) => turn.state.buildings[uid]!)
      .filter((p) => hexDistance(p.at, b.at) <= range)
      .sort((x, y) => hexDistance(x.at, b.at) - hexDistance(y.at, b.at));
    for (const p of near) {
      const t = Math.min(need, capacity.get(p.uid)!);
      capacity.set(p.uid, capacity.get(p.uid)! - t);
      need -= t;
    }
    if (need > 0) left.set(b.uid, need);
  }
  return left;
}

/**
 * The heat layer, for a bot that minds it: before the cold comes, a heat pump within reach of
 * every building that needs heat, where it covers the most (a water-source one by the water,
 * at 3 heat an energy, before an air-source one anywhere).
 */
function tendHeat(turn: Turn, profile: Profile): void {
  const range = turn.rules.rules.localHeat.range;
  for (let i = 0; i < 3; i++) {
    const left = uncoveredHeat(turn);
    if (left.size === 0) return;
    let best: { id: string; at: Hex; score: number } | null = null;
    for (const id of ['heatPump', 'airSourceHeatPump']) {
      if (!turn.canBuild(id, Math.min(profile.reserve, 2))) continue;
      for (const t of turn.sites(id)) {
        let covered = 0;
        for (const [uid, n] of left)
          if (hexDistance(turn.state.buildings[uid]!.at, t) <= range) covered += n;
        if (covered === 0) continue;
        const score = 10 * covered + (id === 'heatPump' ? 5 : 0) + siteScore(turn, id, t);
        if (!best || score > best.score) best = { id, at: { q: t.q, r: t.r }, score };
      }
    }
    if (!best || !turn.apply({ type: 'place', building: best.id, at: best.at })) return;
  }
}

/**
 * Hedges along an edge of each building storms could damage (each shelters the tiles on both
 * its sides), until the valley has `max` segments.
 */
function plantHedges(turn: Turn, profile: Profile, max: number): void {
  const def = edgeBuilding(turn.rules);
  if (!def || !turn.unlocked(def.id)) return;
  for (const uid of turn.state.priority) {
    if (turn.state.hedges.length >= max) return;
    if (turn.state.stores.materials < def.cost + profile.reserve) return;
    const b = turn.state.buildings[uid];
    if (!b || !stormExposed(turn.rules, turn.state, b)) continue;
    for (const n of hexNeighbors(b.at))
      if (turn.apply({ type: 'plantHedge', a: b.at, b: n })) break;
  }
}

/** The shared needs-first play of the non-random bots. */
function survive(turn: Turn, profile: Profile, water: WaterPolicy = 'fields'): void {
  // A wonder's tiles are kept free from the start of the run.
  if (profile.wonder && turn.waterOn)
    for (const def of wonders(turn.rules)) {
      const at = wonderOf(turn.state, def.id) ? undefined : keptFlower(turn, def);
      if (at) for (const h of flower(at)) turn.reserved.add(hexKey(h));
    }
  turn.pick(
    turn.waterOn && water === 'storage' ? ['cistern', 'weir', ...profile.cards] : profile.cards,
  );
  if (turn.waterOn) tendWater(turn, profile, water);
  // The heat layer: energy can't heat, so a heat-minding bot puts a pump by every home first.
  if (!turn.rules.rules.localHeat.gridHeat && turn.heatAware) tendHeat(turn, profile);
  if (!turn.has('salvageYard')) turn.build('salvageYard');
  if (!turn.has('workshop')) turn.build('workshop');
  // On the coast, salvage from the strandline as well as the ruins: a beachcombing yard a workshop.
  if (turn.count('beachcombingYard') < turn.count('workshop')) turn.build('beachcombingYard');

  for (let i = 0; i < 3 && shortfall('night')(turn) > 0; i++) {
    if (!buildFirstThatHelps(turn, profile.nightPower, shortfall('night'))) break;
  }
  for (let i = 0; i < 2 && shortfall('day')(turn) > 0; i++) {
    if (!buildFirstThatHelps(turn, profile.dayPower, shortfall('day'))) break;
  }
  for (let i = 0; i < 3 && foodGap(turn) > 0; i++) {
    if (!buildFirstThatHelps(turn, profile.food, foodGap)) break;
  }

  // Salvage piling up while the workshops stand idle for want of day energy: power to run them.
  for (let i = 0; i < 2 && idleWorkshops(turn) > 0; i++) {
    const power = profile.dayPower.filter((id) => turn.canBuild(id, profile.reserve));
    if (!buildFirstThatHelps(turn, power, idleWorkshops)) break;
  }

  // Long walks to work: a cottage near the far work, when the walks cost wellbeing.
  if (turn.commuteOn && turn.commuteAware && (turn.peek()?.report.commute?.wellbeing ?? 0) < 0)
    turn.build('cottage', profile.reserve);
  // Long walks to water: a well by the homes far from it.
  if (
    turn.commuteOn &&
    turn.commuteAware &&
    (turn.peek()?.report.commute?.toWater?.wellbeing ?? 0) < 0
  )
    turn.build('well', profile.reserve);

  // House growth when people would otherwise stop arriving.
  const p = turn.peek();
  if (p && turn.state.citizens >= turn.housing() && turn.state.wellbeing >= 60) {
    if (p.report.food.produced - turn.state.citizens >= 2 || turn.state.stores.food > 20) {
      turn.build('cottage');
    }
  }

  // Scraps left at the end of the season become clutter next season.
  const scraps = turn.peek()?.state.stores.scraps ?? 0;
  const capacity = turn.count('composter') * 3 + turn.count('biogasDigester') * 4;
  if (scraps > capacity) {
    if (!turn.build('composter')) turn.build('biogasDigester');
  }

  // Recycle clutter once it starts to cost wellbeing and salvage runs short.
  const workshop = Object.values(turn.state.buildings).find((b) => b.type === 'workshop');
  if (workshop) {
    const recipe =
      turn.state.stores.clutter >= 5 && turn.state.stores.salvage < 2 ? 'clutter' : 'salvage';
    if (workshop.recipe !== recipe) turn.apply({ type: 'setRecipe', uid: workshop.uid, recipe });
  }

  // Rising expectations: build civic life when citizens outgrow it.
  const unserved = () =>
    -peekOr(
      turn,
      (p) => p.report.wellbeing.lines.find((l) => l.kind === 'expectations')?.amount ?? 0,
      0,
    );
  for (let i = 0; i < 2 && unserved() > 0; i++) {
    if (!buildFirstThatHelps(turn, ['commonsPlaza', 'seedbankLibrary', 'ciderPress'], unserved))
      break;
  }

  // The wonder before the extras: while saving for it, nothing else is bought.
  if (profile.wonder && turn.waterOn && pursueWonder(turn, profile)) return;
  profile.extras(turn, profile);

  // Projects: start the first one the stores can pay for, keeping the materials reserve.
  for (const project of turn.content.projects) {
    const materials = project.cost.materials ?? 0;
    if (turn.state.stores.materials - materials < profile.reserve) continue;
    if (turn.apply({ type: 'startProject', project: project.id })) break;
  }

  // Festivals: hold this season's when it pays (more wellbeing, nobody hungrier, the lanterns
  // lit) and keeps the materials reserve; otherwise take it back, as a free undo would.
  const festival = festivals(effectiveContent(turn.content, turn.state)).find(
    (f) => f.season === turn.state.season,
  );
  if (festival && turn.state.stores.materials - (festival.cost.materials ?? 0) >= profile.reserve) {
    const outcome = () =>
      peekOr(
        turn,
        (p) => ({
          wellbeing: p.state.wellbeing,
          unfed: p.report.food.unfed,
          lit: p.report.festival?.lit ?? false,
        }),
        null,
      );
    const before = outcome();
    const saved = turn.save();
    if (turn.apply({ type: 'holdFestival', festival: festival.id })) {
      const after = outcome();
      const pays =
        before &&
        after &&
        after.lit &&
        after.unfed <= before.unfed &&
        after.wellbeing > before.wellbeing;
      if (!pays) turn.restore(saved);
    }
  }
}

/**
 * The biome's wonder (E5), from its era: close the loops it needs, build the
 * buildings it needs, then start it once its costs can be paid on top of the
 * reserve. Nothing else is held back for it.
 */
function pursueWonder(turn: Turn, profile: Profile): boolean {
  const state = turn.state;
  for (const def of wonders(turn.rules)) {
    if (wonderOf(state, def.id)) continue;
    // Its loops and buildings come the era before.
    if (state.era < def.minEra - 1) continue;
    const flowerAt = keptFlower(turn, def);
    const w = def.wonder!;
    for (const loop of w.needsLoops) {
      if (state.loops.some((l) => l.combo === loop)) continue;
      if (loop === 'bathLoop') closeBathLoop(turn, profile);
      // The coast's materials run short: save for the Kelp Loop while there is a place for it.
      if (loop === 'kelpLoop') return closeKelpLoop(turn, profile);
      return false;
    }
    for (const [id, n] of Object.entries(w.needsBuildings) as [string, number][]) {
      while (turn.count(id) < n) if (!turn.build(id, profile.reserve)) return false;
    }
    if (state.era < def.minEra || !flowerAt) return false;
    const extra = Object.entries(w.alsoCosts) as [keyof typeof state.stores, number][];
    const paid =
      state.stores.materials >= def.cost + profile.reserve &&
      extra.every(([res, n]) => state.stores[res] >= n);
    if (paid && turn.apply({ type: 'place', building: def.id, at: flowerAt })) return false;
    // Saving up for it: nothing else is bought this season.
    return true;
  }
  return false;
}

/**
 * The flower kept free for a wonder: of the sites it could take now (its
 * loops and era aside), the one with the least floodplain (kept for farms) or mudflat,
 * then the first by position, so the choice holds from season to season.
 */
function keptFlower(turn: Turn, def: BuildingDef): Hex | undefined {
  let best: { at: Hex; cost: number; key: string } | undefined;
  for (const t of Object.values(turn.state.map.tiles)) {
    if (wonderSiteProblem(turn.rules, turn.state, def, t)) continue;
    // Floodplain kept for farms; on the coast, mudflat kept for the oyster reefs it needs.
    const cost = flower(t).filter((h) =>
      ['floodplain', 'mudflat'].includes(turn.state.map.tiles[hexKey(h)]?.type ?? ''),
    ).length;
    const key = hexKey(t);
    if (!best || cost < best.cost || (cost === best.cost && key < best.key))
      best = { at: { q: t.q, r: t.r }, cost, key };
  }
  return best?.at;
}

/**
 * A Bath Loop: a bathhouse with a kiln and a reed bed beside it. Tries an
 * existing bathhouse first, then new ones, keeping the first that the season
 * ahead shows closing the loop (a free undo otherwise).
 */
function closeBathLoop(turn: Turn, profile: Profile): void {
  const closes = () =>
    peekOr(turn, (p) => p.report.combos.some((h) => h.combo === 'bathLoop'), false);
  const occupied = () => new Set(Object.keys(turn.state.map.tiles).filter((k) => isTaken(turn, k)));
  const beside = (id: string, at: Hex) => {
    const taken = occupied();
    return turn
      .sites(id)
      .filter((t) => hexDistance(t, at) === 1 && !taken.has(hexKey(t)))
      .sort((a, b) => siteScore(turn, id, b) - siteScore(turn, id, a));
  };
  const nextTo = (ids: readonly string[], bath: Hex) =>
    Object.values(turn.state.buildings).some(
      (b) => ids.includes(b.type) && hexDistance(b.at, bath) === 1,
    );
  /** Puts the first of `ids` it can afford on its best free site beside the bath. */
  const add = (ids: readonly string[], bath: Hex): boolean => {
    if (nextTo(ids, bath)) return true;
    for (const id of ids) {
      const site = turn.canBuild(id, profile.reserve) ? beside(id, bath)[0] : undefined;
      if (site && turn.apply({ type: 'place', building: id, at: { q: site.q, r: site.r } }))
        return true;
    }
    return false;
  };
  const tryAt = (bath: Hex): boolean => {
    // Warmed by a kiln or a heat well, cleaned by a reed bed.
    for (const heat of [['kiln'], ['heatWell']] as const) {
      const saved = turn.save();
      if (add(heat, bath) && add(['reedBed'], bath) && closes()) return true;
      turn.restore(saved);
    }
    return false;
  };
  for (const b of Object.values(turn.state.buildings).filter((x) => x.type === 'bathhouse'))
    if (tryAt(b.at)) return;
  if (!turn.canBuild('bathhouse', profile.reserve)) return;
  const sites = turn
    .sites('bathhouse')
    .sort((a, b) => siteScore(turn, 'bathhouse', b) - siteScore(turn, 'bathhouse', a))
    .slice(0, 4);
  for (const site of sites) {
    const saved = turn.save();
    if (!turn.apply({ type: 'place', building: 'bathhouse', at: { q: site.q, r: site.r } }))
      continue;
    if (tryAt(site)) return;
    turn.restore(saved);
  }
}

/**
 * A Kelp Loop (the coast's, for the Tidal Lagoon): a composter between a kelp farm and a croft.
 * Tries the composters standing first, then new ones by the sea, keeping the first that the
 * season ahead shows closing the loop (a free undo otherwise).
 */
function closeKelpLoop(turn: Turn, profile: Profile): boolean {
  const closes = () =>
    peekOr(turn, (p) => p.report.combos.some((h) => h.combo === 'kelpLoop'), false);
  const beside = (id: string, at: Hex) =>
    turn
      .sites(id)
      .filter((t) => hexDistance(t, at) === 1)
      .sort((a, b) => siteScore(turn, id, b) - siteScore(turn, id, a));
  const nextTo = (ids: readonly string[], at: Hex) =>
    Object.values(turn.state.buildings).some(
      (b) => ids.includes(b.type) && hexDistance(b.at, at) === 1,
    );
  const add = (ids: readonly string[], at: Hex): boolean => {
    if (nextTo(ids, at)) return true;
    for (const id of ids) {
      const site = turn.canBuild(id, profile.reserve) ? beside(id, at)[0] : undefined;
      if (site && turn.apply({ type: 'place', building: id, at: { q: site.q, r: site.r } }))
        return true;
    }
    return false;
  };
  const tryAt = (heap: Hex): boolean => {
    const saved = turn.save();
    if (add(['croft', 'machairCroft'], heap) && add(['kelpFarm', 'kelpForest'], heap) && closes())
      return true;
    turn.restore(saved);
    return false;
  };
  for (const b of Object.values(turn.state.buildings).filter((x) => x.type === 'composter'))
    if (tryAt(b.at)) return false;
  // Composter sites with room for a kelp farm beside them.
  const sites = turn
    .sites('composter')
    .filter((t) => beside('kelpFarm', t).length > 0 && beside('croft', t).length > 0)
    .slice(0, 4);
  if (!turn.canBuild('composter', profile.reserve)) return sites.length > 0;
  for (const site of sites) {
    const saved = turn.save();
    if (!turn.apply({ type: 'place', building: 'composter', at: { q: site.q, r: site.r } }))
      continue;
    if (tryAt(site)) return false;
    turn.restore(saved);
  }
  // Not closed yet: save up for it while there is a place.
  return sites.length > 0;
}

const isTaken = (turn: Turn, key: string) =>
  Object.values(turn.state.buildings).some((b) => hexKey(b.at) === key);

function spend(turn: Turn, profile: Profile, options: readonly string[], limit = 3): void {
  for (let i = 0; i < limit; i++) {
    const id = options.find((o) => turn.canBuild(o, profile.reserve) && turn.bestSite(o));
    if (!id || !turn.build(id, profile.reserve)) return;
  }
}

const growHousing = (turn: Turn) =>
  turn.state.citizens >= turn.housing() - 1 && turn.state.wellbeing >= 60;

// With the heat layer, a cold home counts as a blackout: the heat pumps answer it.
// On the coast, the tide turbine and wave buoy in the river wheel's place.
const NIGHT = [
  'airSourceHeatPump',
  'riverWheel',
  'hillTurbine',
  'tideTurbine',
  'waveBuoy',
  'windSpire',
  'heatPump',
  'heatWell',
  'cellBank',
  'biogasDigester',
];
const DAY = ['solarCanopy', 'tideTurbine', 'hillTurbine', 'airSourceHeatPump'];

const profiles: Record<'greedyFood' | 'greedyEnergy' | 'balanced', Profile> = {
  greedyFood: {
    cards: [
      'orchard',
      'fishPond',
      'riceFishPaddy',
      'greenhouse',
      'mushroomCellar',
      'apiary',
      'riverWheel',
      'heatWell',
      'cellBank',
      'kelpFarm',
      'oysterReef',
      'smokehouse',
      'tideTurbine',
      'hillTurbine',
      'shieling',
      'biocharKiln',
    ],
    nightPower: NIGHT,
    dayPower: DAY,
    food: [
      'floodplainFarm',
      'croft',
      'glenFarm',
      'terraceFarm',
      'shieling',
      'riceFishPaddy',
      'fishPond',
      'kelpFarm',
      'oysterReef',
      'orchard',
      'greenhouse',
    ],
    reserve: 4,
    extras(turn, profile) {
      const options = [
        'floodplainFarm',
        'croft',
        'glenFarm',
        'terraceFarm',
        'shieling',
        'fishPond',
        'kelpFarm',
        'oysterReef',
        'orchard',
        'apiary',
        'greenhouse',
      ];
      // A paddy for every two farms, where the floodplain meets a channel.
      if (turn.count('riceFishPaddy') * 2 < turn.count('floodplainFarm'))
        options.unshift('riceFishPaddy');
      // A mushroom cellar once there is biomass to spare.
      if (turn.state.stores.biomass >= 2 && turn.count('mushroomCellar') < 2)
        options.unshift('mushroomCellar');
      if (growHousing(turn)) options.unshift('cottage');
      spend(turn, profile, options);
    },
  },
  greedyEnergy: {
    cards: [
      'riverWheel',
      'windSpire',
      'biogasDigester',
      'cellBank',
      'heatPump',
      'solarThermalCollector',
      'heatWell',
      'kiln',
      'hedgerow',
      'weir',
      'pumpedReservoir',
      'tideTurbine',
      'waveBuoy',
      'lighthouse',
      'duneGrass',
      'hillTurbine',
      'snowFence',
      'lookout',
    ],
    nightPower: [
      'windSpire',
      'riverWheel',
      'hillTurbine',
      'tideTurbine',
      'waveBuoy',
      'heatPump',
      'airSourceHeatPump',
      'biogasDigester',
      'cellBank',
      'heatWell',
    ],
    dayPower: ['solarCanopy', 'riverWheel', 'tideTurbine', 'hillTurbine', 'airSourceHeatPump'],
    food: [
      'floodplainFarm',
      'croft',
      'glenFarm',
      'terraceFarm',
      'fishPond',
      'kelpFarm',
      'greenhouse',
      'orchard',
    ],
    reserve: 3,
    extras(turn, profile) {
      const spare = turn.peek()?.report.energy.day.unused ?? 0;
      const options =
        spare >= 2
          ? ['workshop', 'kiln']
          : ['riverWheel', 'tideTurbine', 'hillTurbine', 'windSpire', 'waveBuoy', 'solarCanopy'];
      if (growHousing(turn)) options.unshift('cottage');
      spend(turn, profile, options, 2);
      // Hedges by the hill generators storms can reach.
      plantHedges(turn, profile, 6);
    },
  },
  balanced: {
    cards: [
      'riverWheel',
      'pollinatorMeadow',
      'orchard',
      'treeNursery',
      'heatWell',
      'fishPond',
      'commonsPlaza',
      'apiary',
      'seedbankLibrary',
      'bathhouse',
      'reedBed',
      'solarThermalCollector',
      'hedgerow',
      'tideTurbine',
      'kelpFarm',
      'duneGrass',
      'oysterReef',
      'smokehouse',
      'lighthouse',
      'hillTurbine',
      'snowFence',
      'rewettedBog',
      'shieling',
    ],
    nightPower: NIGHT,
    dayPower: DAY,
    food: [
      'floodplainFarm',
      'croft',
      'glenFarm',
      'terraceFarm',
      'shieling',
      'fishPond',
      'kelpFarm',
      'oysterReef',
      'orchard',
      'greenhouse',
    ],
    reserve: 5,
    wonder: true,
    extras(turn, profile) {
      const options = ['pollinatorMeadow', 'treeNursery'];
      if (growHousing(turn)) options.unshift('cottage');
      if (turn.state.citizens >= 10 && !turn.has('commonsPlaza')) options.push('commonsPlaza');
      // A bathhouse for wellbeing, and a reed bed to clean what it lets out.
      if (turn.state.citizens >= 12 && turn.count('bathhouse') < 1) options.unshift('bathhouse');
      if (turn.count('reedBed') < turn.count('bathhouse')) options.unshift('reedBed');
      spend(turn, profile, options, 2);
      // Hedges to shelter what storms could damage.
      plantHedges(turn, profile, 4);
      // Spread spare compost on the poorest land.
      while (turn.state.stores.compost >= turn.content.rules.compostPerTileStep) {
        const barren = Object.values(turn.state.map.tiles).find((t) => t.type === 'barren');
        if (!barren || !turn.apply({ type: 'spreadCompost', at: barren })) break;
      }
    },
  },
};

const profileBot = (name: keyof typeof profiles, description: string): Bot => ({
  name,
  description,
  playSeason: (turn) => survive(turn, profiles[name]),
});

/** A profile bot that places heat sources without minding where the heat is needed (H1 gate). */
export function heatBlindBot(name: 'greedyFood' | 'greedyEnergy' | 'balanced'): Bot {
  return {
    name: `${name}-heatBlind`,
    description: `${BOTS[name]!.description} Ignores where heat is needed.`,
    playSeason: (turn) => {
      turn.heatAware = false;
      survive(turn, profiles[name]);
    },
  };
}

/** A profile bot that ignores walks to work when it places things (for the C1 gate). */
export function commuteBlindBot(name: 'greedyFood' | 'greedyEnergy' | 'balanced'): Bot {
  return {
    name: `${name}-blind`,
    description: `${BOTS[name]!.description} Ignores walks to work.`,
    playSeason: (turn) => {
      turn.commuteAware = false;
      survive(turn, profiles[name]);
    },
  };
}

/** A profile bot playing a given water policy (for the E1 decision gate). */
export function waterBot(
  name: 'greedyFood' | 'greedyEnergy' | 'balanced',
  policy: WaterPolicy,
): Bot {
  return {
    name: `${name}+${policy}`,
    description: `${BOTS[name]!.description} Water: ${policy}.`,
    playSeason: (turn) => survive(turn, profiles[name], policy),
  };
}

export const BOTS: Record<string, Bot> = {
  random: {
    name: 'random',
    description: 'Picks random cards and builds random affordable buildings at random legal sites.',
    playSeason(turn) {
      const offer = turn.state.draft.offer;
      if (offer.length > 0) turn.apply({ type: 'pickCard', card: pick(turn.rng, offer) });
      for (let i = 0; i < 4; i++) {
        if (nextFloat(turn.rng) > 0.6) continue;
        const affordable = turn.state.unlocked.filter(
          (id) => turn.content.byId[id]!.cost <= turn.state.stores.materials,
        );
        if (affordable.length === 0) return;
        const id = pick(turn.rng, affordable);
        const sites = turn.sites(id);
        if (sites.length === 0) continue;
        const at = sites[nextInt(turn.rng, sites.length)]!;
        turn.apply({ type: 'place', building: id, at: { q: at.q, r: at.r } });
      }
    },
  },
  greedyFood: profileBot(
    'greedyFood',
    'Covers its needs, drafts food blueprints, then spends everything on food and housing.',
  ),
  greedyEnergy: profileBot(
    'greedyEnergy',
    'Covers its needs, drafts energy blueprints, then builds generators and turns spare energy into materials.',
  ),
  balanced: profileBot(
    'balanced',
    'Covers its needs with a reserve, then spends on Harmony, land and wellbeing.',
  ),
};
