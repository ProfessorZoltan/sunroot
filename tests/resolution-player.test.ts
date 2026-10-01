import { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { FULL_DURATIONS, buildTimeline } from '../src/game/timeline';
import { ResolutionPlayer } from '../src/render/resolution';
import { content, endSeason, scenario } from './helpers';

const DRY = ['^ ^ ^ , ~ , , , ^ ^', ' ^ ^ , , ~ , , , ^ ^', '^ , C , ~ , , , , ^'];

describe('the resolution player', () => {
  it('announces every phase in order, even when one frame jumps over some', () => {
    const s = endSeason(scenario(DRY));
    const timeline = { ...buildTimeline(content, s, s.lastReport!), pops: [] };
    const phases: string[] = [];
    let done = 0;
    const layers = {
      under: new Container(),
      over: new Container(),
      screen: new Container(),
      shake: new Container(),
    };
    const player = new ResolutionPlayer(
      timeline,
      layers,
      { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      () => ({ width: 800, height: 600 }),
      { onPhase: (p) => phases.push(p), onDone: () => (done += 1) },
    );
    player.update(FULL_DURATIONS.event + 100); // into the day
    player.update(FULL_DURATIONS.day + FULL_DURATIONS.night); // a 3.6 s frame: past the night
    expect(phases).toEqual(['event', 'day', 'night', 'settle']);
    player.update(10_000);
    expect(done).toBe(1);
    player.destroy();
  });
});
