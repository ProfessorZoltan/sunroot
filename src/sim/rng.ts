/**
 * Seeded random numbers (sfc32 seeded by cyrb128). The whole generator state
 * is four uint32s kept in plain data, so it serializes with the run and the
 * same seed plus the same commands always gives the same run.
 */
export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

function cyrb128(text: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export function createRng(seed: string): RngState {
  const [a, b, c, d] = cyrb128(seed);
  const state = { a, b, c, d };
  // Discard the first outputs so similar seeds diverge quickly.
  for (let i = 0; i < 15; i++) nextUint32(state);
  return state;
}

/** Advances the generator in place and returns a uint32. */
export function nextUint32(s: RngState): number {
  const t = (((s.a + s.b) >>> 0) + s.d) >>> 0;
  s.d = (s.d + 1) >>> 0;
  s.a = s.b ^ (s.b >>> 9);
  s.b = (s.c + (s.c << 3)) >>> 0;
  s.c = (s.c << 21) | (s.c >>> 11);
  s.c = (s.c + t) >>> 0;
  return t;
}

/** A float in [0, 1). */
export function nextFloat(s: RngState): number {
  return nextUint32(s) / 4294967296;
}

/** An integer in [0, n). */
export function nextInt(s: RngState, n: number): number {
  if (n <= 0) throw new Error('nextInt needs a positive bound');
  return Math.floor(nextFloat(s) * n);
}

export function chance(s: RngState, p: number): boolean {
  return nextFloat(s) < p;
}

export function pick<T>(s: RngState, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick from an empty list');
  return items[nextInt(s, items.length)]!;
}

/** Fisher-Yates shuffle into a new array. */
export function shuffled<T>(s: RngState, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = nextInt(s, i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
