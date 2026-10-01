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
import { pick, nextFloat, nextInt } from '../sim/rng';
import type { Turn } from './turn';

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

/** The shared needs-first play of the non-random bots. */
function survive(turn: Turn, profile: Profile): void {
  turn.pick(profile.cards);
  if (!turn.has('salvageYard')) turn.build('salvageYard');
  if (!turn.has('workshop')) turn.build('workshop');

  for (let i = 0; i < 3 && shortfall('night')(turn) > 0; i++) {
    if (!buildFirstThatHelps(turn, profile.nightPower, shortfall('night'))) break;
  }
  for (let i = 0; i < 2 && shortfall('day')(turn) > 0; i++) {
    if (!buildFirstThatHelps(turn, profile.dayPower, shortfall('day'))) break;
  }
  for (let i = 0; i < 3 && foodGap(turn) > 0; i++) {
    if (!buildFirstThatHelps(turn, profile.food, foodGap)) break;
  }

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

  profile.extras(turn, profile);

  // Projects: start the first one the stores can pay for, keeping the materials reserve.
  for (const project of turn.content.projects) {
    const materials = project.cost.materials ?? 0;
    if (turn.state.stores.materials - materials < profile.reserve) continue;
    if (turn.apply({ type: 'startProject', project: project.id })) break;
  }
}

function spend(turn: Turn, profile: Profile, options: readonly string[], limit = 3): void {
  for (let i = 0; i < limit; i++) {
    const id = options.find((o) => turn.canBuild(o, profile.reserve) && turn.bestSite(o));
    if (!id || !turn.build(id, profile.reserve)) return;
  }
}

const growHousing = (turn: Turn) =>
  turn.state.citizens >= turn.housing() - 1 && turn.state.wellbeing >= 60;

const NIGHT = ['riverWheel', 'windSpire', 'heatPump', 'heatWell', 'cellBank', 'biogasDigester'];

const profiles: Record<'greedyFood' | 'greedyEnergy' | 'balanced', Profile> = {
  greedyFood: {
    cards: ['orchard', 'fishPond', 'greenhouse', 'apiary', 'riverWheel', 'heatWell', 'cellBank'],
    nightPower: NIGHT,
    dayPower: ['solarCanopy'],
    food: ['floodplainFarm', 'fishPond', 'orchard', 'greenhouse'],
    reserve: 4,
    extras(turn, profile) {
      const options = ['floodplainFarm', 'fishPond', 'orchard', 'apiary', 'greenhouse'];
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
      'weir',
      'pumpedReservoir',
    ],
    nightPower: ['windSpire', 'riverWheel', 'heatPump', 'biogasDigester', 'cellBank', 'heatWell'],
    dayPower: ['solarCanopy', 'riverWheel'],
    food: ['floodplainFarm', 'fishPond', 'greenhouse', 'orchard'],
    reserve: 3,
    extras(turn, profile) {
      const spare = turn.peek()?.report.energy.day.unused ?? 0;
      const options =
        spare >= 2 ? ['workshop', 'kiln'] : ['riverWheel', 'windSpire', 'solarCanopy'];
      if (growHousing(turn)) options.unshift('cottage');
      spend(turn, profile, options, 2);
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
      'solarThermalCollector',
    ],
    nightPower: NIGHT,
    dayPower: ['solarCanopy'],
    food: ['floodplainFarm', 'fishPond', 'orchard', 'greenhouse'],
    reserve: 5,
    extras(turn, profile) {
      const options = ['pollinatorMeadow', 'treeNursery'];
      if (growHousing(turn)) options.unshift('cottage');
      if (turn.state.citizens >= 10 && !turn.has('commonsPlaza')) options.push('commonsPlaza');
      spend(turn, profile, options, 2);
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
