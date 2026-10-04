/**
 * The citizens and the fish in hand-made art (docs/ART-PEOPLE.md): who each walker is, what they
 * wear, where they are and what they do; the fish's leap and its land. Drawing is checked by
 * hand with test art; here, the choices the map makes.
 */
import { describe, expect, it } from 'vitest';
import {
  CLOTHES,
  PAUSE,
  WALK,
  castOf,
  fishName,
  fishPose,
  walkerLook,
  walkerPose,
} from '../src/render/peopleArt';

const has = (names: string[]) => (name: string) => names.includes(name);

describe('the cast', () => {
  it('those delivered: a first walking or rolling frame', () => {
    expect(castOf(has([]))).toEqual([]);
    expect(castOf(has(['citizen.2.walk.1', 'citizen.7.roll.1', 'citizen.5.stand']))).toEqual([
      2, 7,
    ]);
  });

  it('one citizen delivered: every walker is them, in different colours', () => {
    const looks = [0, 1, 2, 3, 4, 5].map((i) => walkerLook(i, [2])!);
    expect(new Set(looks.map((l) => l.citizen))).toEqual(new Set([2]));
    expect(new Set(looks.map((l) => l.color)).size).toBe(6);
    expect(walkerLook(0, [])).toBeNull();
  });

  it('all twelve: six walkers, six different people, sizes within 5%', () => {
    const cast = Array.from({ length: 12 }, (_, i) => i + 1);
    const looks = [0, 1, 2, 3, 4, 5].map((i) => walkerLook(i, cast)!);
    expect(new Set(looks.map((l) => l.citizen)).size).toBe(6);
    for (const l of looks) {
      expect(CLOTHES).toContain(l.color);
      expect(Math.abs(l.size - 1)).toBeLessThanOrEqual(0.05 + 1e-9);
    }
  });
});

describe('a walker’s day', () => {
  const w = { from: { x: 0, y: 0 }, to: { x: 100, y: 0 } };
  const at = (t: number, rolls = false) => walkerPose(w, 0, t, false, rolls);

  it('rests at home, walks there, works, walks back', () => {
    expect(at(0)).toMatchObject({ x: 0, frame: 'stand' });
    const going = at(PAUSE + WALK / 2);
    expect(going.x).toBeCloseTo(50);
    expect(going.frame).toMatch(/^walk\.[1-4]$/);
    expect(going.flip).toBe(false);
    expect(at(PAUSE + WALK + 10)).toMatchObject({ x: 100, frame: 'work' });
    const back = at(2 * PAUSE + WALK + WALK / 2);
    expect(back.x).toBeCloseTo(50);
    expect(back.flip).toBe(true);
  });

  it('a wheelchair user rolls; with reduced motion, standing half way', () => {
    expect(at(PAUSE + 100, true).frame).toMatch(/^roll\.[12]$/);
    expect(walkerPose(w, 0, 9999, true, false)).toMatchObject({ x: 50, frame: 'stand' });
  });

  it('feet a little below the path, as the code-drawn walkers', () => {
    expect(at(0).y).toBe(14);
  });
});

describe('the fish', () => {
  it("a land's own fish, else the valley's, else none (drawn in code)", () => {
    const all = has(['fish.leap.1', 'fish.coast.leap.1']);
    expect(fishName('coast', all)).toBe('fish.coast.leap');
    expect(fishName('glen', all)).toBe('fish.leap');
    expect(fishName('valley', all)).toBe('fish.leap');
    expect(fishName('desert', has([]))).toBeNull();
  });

  it('leaps rising, at the top, diving, then rests while its rings spread', () => {
    const c = { x: 0, y: 0 };
    const frames = [0.1, 0.5, 0.9].map((f) => fishPose(c, 0, (f / 2.4) * 3600, false)!.frame);
    expect(frames).toEqual([1, 2, 3]);
    expect(fishPose(c, 0, (1.5 / 2.4) * 3600, false)).toBeNull();
    expect(fishPose(c, 0, 0, true)!.frame).toBe(2);
  });
});
