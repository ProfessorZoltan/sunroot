/**
 * Root City's hand-made art (docs/ART-CITY.md): which files it is made of, and
 * which of them the city shows. Pure, shared by the importer and the city screen.
 */

export type CityArtPart = 'day' | 'lit' | 'rotor';
export type EdgeSide = 'e' | 'ne' | 'nw';

export type CityArtFile =
  | { kind: 'district'; district: string; tier: string; part: CityArtPart }
  | { kind: 'heartwood'; stage: number; part: 'day' | 'lit' }
  | { kind: 'sunTree'; part: 'day' | 'lit' }
  | { kind: 'slot' }
  | { kind: 'landmark'; landmark: string; side: EdgeSide };

/** The ids a file name may use: the city's districts, tiers and landmarks. */
export interface CityArtIds {
  districts: readonly string[];
  tiers: readonly string[];
  landmarks: readonly string[];
}

/** The Heartwood's growth stages, 1 to 4, and how many districts each starts at. */
export const HEARTWOOD_STAGES = [0, 5, 10, 15] as const;

/** What a file in art/incoming/city is, or null if its name isn't one of the guide's. */
export function parseCityArt(file: string, ids: CityArtIds): CityArtFile | null {
  if (!file.endsWith('.png')) return null;
  const parts = file.slice(0, -4).split('.');
  const [id, second, third, fourth] = parts;
  const part = (p: string | undefined): CityArtPart | null =>
    p === undefined ? 'day' : p === 'lit' ? 'lit' : p === 'rotor' ? 'rotor' : null;
  if (id === 'slot') return parts.length === 1 ? { kind: 'slot' } : null;
  if (id === 'sunTree') {
    const p = part(second);
    return parts.length <= 2 && p && p !== 'rotor' ? { kind: 'sunTree', part: p } : null;
  }
  if (id === 'heartwood') {
    const stage = Number(second);
    const p = part(third);
    if (!Number.isInteger(stage) || stage < 1 || stage > HEARTWOOD_STAGES.length) return null;
    return parts.length <= 3 && p && p !== 'rotor' ? { kind: 'heartwood', stage, part: p } : null;
  }
  if (id && ids.landmarks.includes(id)) {
    if (parts.length !== 3 || second !== 'edge') return null;
    return third === 'e' || third === 'ne' || third === 'nw'
      ? { kind: 'landmark', landmark: id, side: third }
      : null;
  }
  if (id && ids.districts.includes(id) && second && ids.tiers.includes(second)) {
    const p = part(third);
    return parts.length <= 3 && p && fourth === undefined
      ? { kind: 'district', district: id, tier: second, part: p }
      : null;
  }
  return null;
}

/** Drawn on the tall frame (512 × 1024 delivered): the Heartwood and the Sun Tree. */
export const isTall = (f: CityArtFile) => f.kind === 'heartwood' || f.kind === 'sunTree';

/** The Heartwood's stage for this many districts in the city (1 to 4). */
export function heartwoodStage(filled: number): number {
  let stage = 1;
  HEARTWOOD_STAGES.forEach((from, i) => {
    if (filled >= from) stage = i + 1;
  });
  return stage;
}

/** The file (without `.png`) the centre shows: a Heartwood stage, or the Sun Tree once grown. */
export function centreArt(filled: number, sunTree: boolean): string {
  return sunTree ? 'sunTree' : `heartwood.${heartwoodStage(filled)}`;
}

/** Dusk on the city screen: a pause, the light going down, a while at dusk, then day again. */
export const DUSK = { delay: 600, fall: 2500, hold: 7000, rise: 2500 } as const;
export const DUSK_LENGTH = DUSK.delay + DUSK.fall + DUSK.hold + DUSK.rise;

/** How far into dusk the city is (0 day, 1 dusk) this many milliseconds after it begins. */
export function duskAt(ms: number): number {
  const ease = (f: number) => {
    const x = Math.min(1, Math.max(0, f));
    return x * x * (3 - 2 * x);
  };
  const t = ms - DUSK.delay;
  if (t <= 0 || ms >= DUSK_LENGTH) return 0;
  if (t < DUSK.fall) return ease(t / DUSK.fall);
  if (t < DUSK.fall + DUSK.hold) return 1;
  return 1 - ease((t - DUSK.fall - DUSK.hold) / DUSK.rise);
}
