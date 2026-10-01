import { afterEach, describe, expect, it, vi } from 'vitest';
import { memorySlot, throttled } from '../src/game/saves';

describe('saving as you play', () => {
  afterEach(() => vi.useRealTimers());

  it('saves at once, then at most every gap, always ending with the latest', () => {
    vi.useFakeTimers();
    let saves = 0;
    const save = throttled(() => (saves += 1), 300);
    save();
    expect(saves).toBe(1); // at once: closing the tab right after an action loses nothing
    save();
    save();
    expect(saves).toBe(1);
    vi.advanceTimersByTime(300);
    expect(saves).toBe(2); // one trailing save for the burst
    vi.advanceTimersByTime(1000);
    save();
    expect(saves).toBe(3);
  });

  it('a memory slot keeps a copy, not the live object', async () => {
    const slot = memorySlot();
    const data = { turn: 1 };
    await slot.save(data);
    data.turn = 2;
    expect(await slot.load()).toEqual({ turn: 1 });
    await slot.clear();
    expect(await slot.load()).toBeUndefined();
  });
});
