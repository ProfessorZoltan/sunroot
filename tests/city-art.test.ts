/**
 * Root City's art (docs/ART-CITY.md): the file names the importer accepts, which
 * Heartwood stage the city shows, and the dusk's course.
 */
import { describe, expect, it } from 'vitest';
import { content } from './helpers';
import {
  DUSK,
  DUSK_LENGTH,
  centreArt,
  duskAt,
  heartwoodStage,
  parseCityArt,
} from '../src/game/cityArt';

const ids = {
  districts: content.districts.map((d) => d.id),
  tiers: content.rules.score.tiers.map((t) => t.id),
  landmarks: content.landmarks.map((l) => l.id),
};

describe("Root City's art files", () => {
  it('takes every name the guide asks for', () => {
    for (const d of ids.districts)
      for (const t of ids.tiers) {
        expect(parseCityArt(`${d}.${t}.png`, ids)).toEqual({
          kind: 'district',
          district: d,
          tier: t,
          part: 'day',
        });
        expect(parseCityArt(`${d}.${t}.lit.png`, ids)).toMatchObject({ part: 'lit' });
      }
    expect(parseCityArt('millraceQuarter.sapling.rotor.png', ids)).toMatchObject({
      part: 'rotor',
    });
    for (const stage of [1, 2, 3, 4])
      expect(parseCityArt(`heartwood.${stage}.png`, ids)).toEqual({
        kind: 'heartwood',
        stage,
        part: 'day',
      });
    expect(parseCityArt('heartwood.4.lit.png', ids)).toMatchObject({ part: 'lit' });
    expect(parseCityArt('sunTree.png', ids)).toEqual({ kind: 'sunTree', part: 'day' });
    expect(parseCityArt('sunTree.lit.png', ids)).toEqual({ kind: 'sunTree', part: 'lit' });
    expect(parseCityArt('slot.png', ids)).toEqual({ kind: 'slot' });
    for (const l of ids.landmarks)
      for (const side of ['e', 'ne', 'nw'] as const)
        expect(parseCityArt(`${l}.edge.${side}.png`, ids)).toEqual({
          kind: 'landmark',
          landmark: l,
          side,
        });
  });

  it('refuses names that are not the guide’s', () => {
    for (const bad of [
      'millraceQuarter.png',
      'millraceQuarter.oak.png',
      'nowhereQuarter.sapling.png',
      'millraceQuarter.sapling.winter.png',
      'heartwood.5.png',
      'heartwood.png',
      'sunTree.rotor.png',
      'ciderMill.edge.w.png',
      'ciderMill.png',
      'slot.lit.png',
      'notes.txt',
    ])
      expect(parseCityArt(bad, ids), bad).toBeNull();
  });
});

describe('the centre', () => {
  it('grows through 4 stages as districts fill the slots, then becomes the Sun Tree', () => {
    expect([0, 4, 5, 9, 10, 14, 15, 18].map(heartwoodStage)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    expect(centreArt(12, false)).toBe('heartwood.3');
    expect(centreArt(18, true)).toBe('sunTree');
  });
});

describe('dusk', () => {
  it('waits, falls, holds and rises again, ending in day', () => {
    expect(duskAt(0)).toBe(0);
    expect(duskAt(DUSK.delay)).toBe(0);
    const falling = duskAt(DUSK.delay + DUSK.fall / 2);
    expect(falling).toBeGreaterThan(0.2);
    expect(falling).toBeLessThan(0.8);
    expect(duskAt(DUSK.delay + DUSK.fall + DUSK.hold / 2)).toBe(1);
    expect(duskAt(DUSK_LENGTH - DUSK.rise / 2)).toBeCloseTo(0.5, 5);
    expect(duskAt(DUSK_LENGTH)).toBe(0);
    // Never outside day and dusk.
    for (let t = 0; t <= DUSK_LENGTH; t += 97) {
      expect(duskAt(t)).toBeGreaterThanOrEqual(0);
      expect(duskAt(t)).toBeLessThanOrEqual(1);
    }
  });
});
