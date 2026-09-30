import { describe, expect, it } from 'vitest';
import { buildTimeline, phaseAt } from '../src/game/timeline';
import { act, place as placeAt, playToWinter } from './walkthrough';
import { content, endSeason, place, scenario, uidAt } from './helpers';

describe('season resolution timeline', () => {
  it('lasts about 5 seconds: event, day, night, settle', () => {
    const s = endSeason(scenario(['^ . C , ~ , . . ^']));
    const tl = buildTimeline(content, s, s.lastReport!);
    expect(tl.duration).toBe(5000);
    expect(tl.phases.map((p) => p.name)).toEqual(['event', 'day', 'night', 'settle']);
    expect(phaseAt(tl, 0)).toBe('event');
    expect(phaseAt(tl, 1000)).toBe('day');
    expect(phaseAt(tl, 4000)).toBe('night');
    expect(phaseAt(tl, 4999)).toBe('settle');
  });

  it('is much shorter with reduced motion', () => {
    const s = endSeason(scenario(['^ . C , ~ , . . ^']));
    expect(
      buildTimeline(content, s, s.lastReport!, { reducedMotion: true }).duration,
    ).toBeLessThanOrEqual(1200);
  });

  it('pops every yield, following the sun east to west, and shows the flood', () => {
    const { state: autumn, sites } = playToWinter();
    // Replay the walkthrough's spring for its report: farm, yard, workshop, solar.
    const tl = buildTimeline(content, autumn, autumn.lastReport!);
    const yielding = Object.keys(autumn.lastReport!.yields).length;
    expect(
      tl.pops.filter((p) => p.tone === 'good' && p.text.includes('+')).length,
    ).toBeGreaterThanOrEqual(yielding);
    const day = tl.phases[1]!;
    for (const p of tl.pops.filter(
      (x) => !x.text.includes('citizen') && !x.text.includes('wellbeing'),
    )) {
      expect(p.t).toBeGreaterThanOrEqual(day.start);
      expect(p.t).toBeLessThanOrEqual(day.end);
    }
    let s = act(autumn, { type: 'pickCard', card: 'riverWheel' });
    s = placeAt(s, 'riverWheel', sites.wheel);
    s = act(s, { type: 'endSeason' });
    const winter = buildTimeline(content, s, s.lastReport!);
    // Night: the cottage and camp draw light from the camp and the wheel; no blackouts.
    expect(winter.flows.filter((f) => f.slot === 'night').length).toBeGreaterThan(0);
    expect(winter.dark).toEqual([]);
    expect(winter.lit.length).toBe(2);
  });

  it('floods tiles in order and darkens blacked-out buildings', () => {
    let s = scenario(['^ . , f ~ f , . ^ ^', ' ^ . C f ~ f , . . ^']);
    s = endSeason(s);
    const tl = buildTimeline(content, s, s.lastReport!);
    expect(tl.flood.length).toBe(s.lastReport!.flooded.length);
    expect(tl.flood.every((f) => f.t < tl.phases[0]!.end)).toBe(true);

    let w = scenario(['^ . C , ~ , . . ^'], { season: 'winter' });
    w = place(w, 'cottage', 3, 0);
    w = endSeason(w);
    const tw = buildTimeline(content, w, w.lastReport!);
    expect(tw.dark).toEqual([w.buildings[uidAt(w, 3, 0)]!.at]);
    expect(tw.pops.some((p) => p.text === 'blackout')).toBe(true);
  });
});
