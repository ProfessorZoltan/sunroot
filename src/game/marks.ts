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

export type MarkKind =
  /** Lasting: a flood's silt, for the seasons it feeds the farm. */
  | 'silt'
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
  for (const b of Object.values(state.buildings)) {
    if (b.siltYear === state.year && flood.siltSeasons.includes(state.season)) {
      const bonus = Math.round(flood.siltBonus * (b.siltShare ?? 1) * 100);
      add(b.at, 'silt', false, `Silted by the flood: +${bonus}% food this ${state.season}.`);
    }
    if (b.damage) {
      const cost = repairCost(content, b);
      const cause = b.damage.cause === 'flood' ? 'Flood' : 'Storm';
      add(
        b.at,
        'damaged',
        false,
        cost === null
          ? `${cause}-damaged: idle this season.`
          : b.holdRepairs
            ? `${cause}-damaged: repairs on hold. Repair it from its panel (${cost} materials).`
            : `${cause}-damaged: idle until repaired for ${cost} materials.`,
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
    for (const key of forecast.flooded) {
      const at = parseHexKey(key);
      const b = Object.values(state.buildings).find((x) => hexKey(x.at) === key);
      if (b && damaged.has(b.uid)) {
        add(at, 'floodDamage', true, `The flood will damage the ${name(b.uid)}.`);
      } else if (b && silted.has(b.uid)) {
        add(at, 'flood', true, `The flood will leave silt on the ${name(b.uid)}.`);
      } else {
        add(at, 'flood', true, 'The flood will cover this tile.');
      }
    }
    for (const key of forecast.sheltered)
      add(parseHexKey(key), 'sheltered', true, 'A levee keeps this tile dry.');
  } else if (event === 'lowRiver') {
    for (const uid of forecast.dried)
      add(atOf(uid), 'dry', true, `Low river: the ${name(uid)} is far from water and loses food.`);
  } else if (event === 'storm') {
    for (const uid of forecast.exposed) {
      if (forecast.mixedGrid && content.events.storm.mixedGridShelters)
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
      const heat = content.byId[b.type]?.demand?.heat.night[si] ?? 0;
      if (heat > 0)
        add(b.at, 'cold', true, `The freeze: the ${name(b.uid)} needs ${heat} heat at night.`);
    }
  }
  return marks;
}

/** A line for the forecast pill: how far the coming event reaches. */
export function reachSummary(marks: Mark[]): string {
  const count = (k: MarkKind) => marks.filter((m) => m.kind === k).length;
  const parts: string[] = [];
  const flood = count('flood') + count('floodDamage');
  if (flood) parts.push(`${flood} tiles will flood`);
  if (count('floodDamage')) parts.push(`${count('floodDamage')} buildings damaged`);
  if (count('sheltered')) parts.push(`${count('sheltered')} kept dry by levees`);
  if (count('dry')) parts.push(`${count('dry')} short of water`);
  if (count('exposed')) parts.push(`${count('exposed')} buildings exposed`);
  if (count('calm')) parts.push('the Mixed Grid shelters all');
  if (count('cold')) parts.push(`${count('cold')} homes need heat`);
  return parts.join(' · ');
}
