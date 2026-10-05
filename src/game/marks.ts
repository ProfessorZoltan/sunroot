/**
 * What the map marks on tiles and buildings for the whole season (asked for in
 * playtesting): effects that last (silt, damage, no worker, shade) and the
 * reach of the event this season ends with (tiles a flood will cover, farms
 * the low river will dry, buildings a storm could damage, homes the freeze
 * makes cold). Pure data from the run and its forecast; the renderer draws
 * each kind as a tile wash and a small badge, and the map tooltip says what it
 * means.
 */
import {
  hexKey,
  repairCost,
  standsOn,
  parseHexKey,
  SEASONS,
  type Content,
  type Hex,
  type RunState,
  type SeasonReport,
} from '../sim';
import { heatDemand } from '../sim/queries';

export type MarkKind =
  /** Lasting: a flood's silt, for the seasons it feeds the farm. */
  | 'silt'
  /** Lasting: the coast's king tide salted this farm, which makes less for a while. */
  | 'salt'
  /** Lasting: the salt has cleared from this saltmarsh farm, which makes more until the next tide. */
  | 'saltBonus'
  /** Lasting: a late frost struck this farm in spring (the Highland); coming: it will. */
  | 'frost'
  /** Lasting: out of action until repaired (flood) or for the season (storm). */
  | 'damaged'
  /** This season: no worker to staff it. */
  | 'unstaffed'
  /** This season: in a tall neighbour's shade. */
  | 'shade'
  /** Coming: water will cover this tile when the season ends. */
  | 'flood'
  /** Coming: this building will be flood-damaged. */
  | 'floodDamage'
  /** Coming: a levee keeps this tile dry. */
  | 'sheltered'
  /** Coming: the low river will halve this farm's food, or it will be short of water. */
  | 'dry'
  /** Coming: a storm could damage this building. */
  | 'exposed'
  /** Coming: the Mixed Grid keeps the storm from damaging anything. */
  | 'calm'
  /** Coming: the freeze makes this home need heat at night. */
  | 'cold'
  /** This season: its workers walk further than the free distance. */
  | 'walk';

export interface Mark {
  at: Hex;
  kind: MarkKind;
  /** True for the coming event's reach, false for effects that already hold. */
  coming: boolean;
  text: string;
}

export function mapMarks(content: Content, state: RunState, forecast: SeasonReport | null): Mark[] {
  const marks: Mark[] = [];
  const name = (uid: string) => content.byId[state.buildings[uid]?.type ?? '']?.name ?? 'Building';
  const atOf = (uid: string) => state.buildings[uid]?.at;
  const add = (at: Hex | undefined, kind: MarkKind, coming: boolean, text: string) => {
    if (at) marks.push({ at, kind, coming, text });
  };

  // Lasting effects.
  const flood = content.events.flood;
  // "the flood" in the Reach, "the king tide" on the coast.
  const theFlood = `the ${(flood?.name ?? 'flood').toLowerCase()}`;
  const salt = flood?.salt;
  for (const b of Object.values(state.buildings)) {
    if (flood && b.siltYear === state.year && flood.siltSeasons.includes(state.season)) {
      const bonus = Math.round(flood.siltBonus * (b.siltShare ?? 1) * 100);
      add(b.at, 'silt', false, `Silted by ${theFlood}: +${bonus}% food this ${state.season}.`);
    }
    // The coast's salt, as the season's harvest counts it (src/sim/season/production.ts).
    if (salt && b.saltTurn !== undefined) {
      const since = state.turn - b.saltTurn;
      const last = since === 0 ? b.saltBefore : b.saltTurn;
      const after = last === undefined ? -1 : state.turn - last;
      const tile = state.map.tiles[hexKey(b.at)]?.type;
      if (since >= 1 && since <= salt.seasons)
        add(
          b.at,
          'salt',
          false,
          `Salted by ${theFlood}: ${salt.factor === 0.5 ? 'half its' : `×${salt.factor}`} food this ${state.season}.`,
        );
      else if (tile && after > salt.seasons && after <= 4 && salt.bonusOn.includes(tile))
        add(
          b.at,
          'saltBonus',
          false,
          `The salt has cleared: +${salt.bonus} food this ${state.season} on ${tile}.`,
        );
    }
    const frost = flood?.frost;
    if (frost && b.frostYear === state.year && (frost.loss[SEASONS.indexOf(state.season)] ?? 0) > 0)
      add(
        b.at,
        'frost',
        false,
        `Struck by the late frost: ${frost.loss[SEASONS.indexOf(state.season)]} less food this ${state.season}.`,
      );
    if (b.damage) {
      const cost = repairCost(content, b);
      const event = b.damage.cause === 'flood' ? content.events.flood : content.events.storm;
      const named = event?.name ?? (b.damage.cause === 'flood' ? 'Flood' : 'Storm');
      // "Flood-damaged" in the Reach; "Damaged by the king tide" on the coast.
      const cause = named.includes(' ')
        ? `Damaged by the ${named.toLowerCase()}`
        : `${named}-damaged`;
      add(
        b.at,
        'damaged',
        false,
        cost === null
          ? `${cause}: idle this season.`
          : b.holdRepairs
            ? `${cause}: repairs on hold. Repair it from its panel (${cost} materials).`
            : `${cause}: idle until repaired for ${cost} materials.`,
      );
    }
  }
  if (forecast) {
    for (const uid of forecast.unstaffed)
      add(atOf(uid), 'unstaffed', false, `${name(uid)}: no worker this season.`);
    for (const uid of Object.keys(forecast.shaded))
      add(atOf(uid), 'shade', false, `${name(uid)}: in shade, making less.`);
    // With commuting, work whose workers walk far.
    const free = content.rules.commute.freeDistance;
    for (const [uid, walks] of Object.entries(forecast.commute?.walks ?? {})) {
      const beyond = walks.reduce((s, w) => s + Math.max(0, w.distance - free), 0);
      if (beyond > 0)
        add(
          atOf(uid),
          'walk',
          false,
          `Long walk: the ${name(uid)}'s workers walk ${beyond} tile${beyond > 1 ? 's' : ''} beyond the free ${free}.`,
        );
    }
    // Walks to water: homes whose people walk far for it.
    const water = content.rules.commute.toWater;
    for (const [uid, h] of Object.entries(forecast.commute?.toWater?.homes ?? {}))
      if (water && h.distance > water.freeDistance)
        add(
          atOf(uid),
          'walk',
          false,
          `Long walk to water: the ${name(uid)} walks ${h.distance - water.freeDistance} tile${h.distance - water.freeDistance > 1 ? 's' : ''} beyond the free ${water.freeDistance}.`,
        );
    // With water, any season can leave a building thirsty.
    for (const [uid, u] of Object.entries(forecast.water?.uses ?? {}))
      if (u.short)
        add(
          atOf(uid),
          'dry',
          true,
          u.from === null
            ? `The ${name(uid)} has no channel beside it: no water, so it makes half.`
            : `The ${name(uid)} will be short of water: it makes half.`,
        );
  }

  // The coming event's reach, as the forecast resolves it.
  const event = state.forecast.event;
  if (!forecast || state.status !== 'active') return marks;
  if (event === 'flood') {
    const damaged = new Set(forecast.damaged);
    const silted = new Set(forecast.silted);
    const salted = new Set(forecast.salted);
    const levee = content.buildings.find((d) => d.levee);
    const leveeName = levee ? `A ${levee.name.toLowerCase()}` : 'A levee';
    const The = theFlood[0]!.toUpperCase() + theFlood.slice(1);
    for (const key of forecast.flooded) {
      const at = parseHexKey(key);
      const b = Object.values(state.buildings).find((x) => hexKey(x.at) === key);
      if (b && damaged.has(b.uid)) {
        add(at, 'floodDamage', true, `${The} will damage the ${name(b.uid)}.`);
      } else if (b && silted.has(b.uid)) {
        add(at, 'flood', true, `${The} will leave silt on the ${name(b.uid)}.`);
      } else if (b && salted.has(b.uid) && salt) {
        add(
          at,
          'flood',
          true,
          `${The} will salt the ${name(b.uid)}: ${salt.factor === 0.5 ? 'half' : `×${salt.factor}`} its food for ${salt.seasons} seasons.`,
        );
      } else {
        add(at, 'flood', true, `${The} will cover this tile.`);
      }
    }
    for (const key of forecast.sheltered)
      add(parseHexKey(key), 'sheltered', true, `${leveeName} keeps this tile dry.`);
    // A late frost comes with the Highland's snowmelt.
    const frost = flood?.frost;
    if (frost) {
      const lost = frost.loss.filter((n) => n > 0);
      for (const uid of forecast.frosted ?? [])
        add(
          atOf(uid),
          'frost',
          true,
          `A late frost will strike the ${name(uid)}: ${lost.join(' and ')} less food in the seasons after. Standing water beside it (a cistern, a pond, the stream) keeps it off.`,
        );
    }
  } else if (event === 'lowRiver') {
    for (const uid of forecast.dried)
      add(atOf(uid), 'dry', true, `Low river: the ${name(uid)} is far from water and loses food.`);
  } else if (event === 'storm') {
    for (const uid of forecast.exposed) {
      if (forecast.mixedGrid && content.events.storm?.mixedGridShelters)
        add(atOf(uid), 'calm', true, `The Mixed Grid shelters the ${name(uid)} from the storm.`);
      else
        add(
          atOf(uid),
          'exposed',
          true,
          `Exposed ${standsOn(state.map.tiles[hexKey(atOf(uid) ?? { q: 0, r: 0 })]?.type)}: the storm could damage it.`,
        );
    }
  } else if (event === 'freeze') {
    const si = SEASONS.indexOf(state.season);
    for (const b of Object.values(state.buildings)) {
      const heat = content.byId[b.type] ? heatDemand(content, state, b, 'night', si) : 0;
      if (heat > 0)
        add(b.at, 'cold', true, `The freeze: the ${name(b.uid)} needs ${heat} heat at night.`);
    }
  }
  return marks;
}

/** A line for the forecast pill: how far the coming event reaches. */
export function reachSummary(marks: Mark[], shelter = 'levees'): string {
  const count = (k: MarkKind) => marks.filter((m) => m.kind === k).length;
  const parts: string[] = [];
  const flood = count('flood') + count('floodDamage');
  if (flood) parts.push(`${flood} tiles will flood`);
  if (count('floodDamage')) parts.push(`${count('floodDamage')} buildings damaged`);
  if (count('sheltered')) parts.push(`${count('sheltered')} kept dry by ${shelter}`);
  if (count('dry')) parts.push(`${count('dry')} short of water`);
  if (count('exposed')) parts.push(`${count('exposed')} buildings exposed`);
  if (count('calm')) parts.push('the Mixed Grid shelters all');
  if (count('cold')) parts.push(`${count('cold')} homes need heat`);
  return parts.join(' · ');
}
