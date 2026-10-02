/**
 * The game's type, served with the app (no font service): Fraunces for
 * titles, Nunito for everything else, and Atkinson Hyperlegible Next for
 * numbers only, as a font that covers just the digits and the signs around
 * them. `fontsReady` waits for all three before the first paint, so text
 * never changes font after the page loads.
 */
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/nunito/index.css';
import numbersUrl from '@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2?url';

/** Digits, and the signs that sit with them: + − / % × . , : ± */
export const NUMBER_RANGE = 'U+0030-0039, U+002B-002F, U+0025, U+003A, U+00B1, U+00D7, U+2212';

export async function fontsReady(timeoutMs = 2500): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  try {
    const numbers = new FontFace('Sunroot Numbers', `url(${numbersUrl}) format('woff2')`, {
      weight: '200 800',
      unicodeRange: NUMBER_RANGE,
      display: 'block',
    });
    document.fonts.add(numbers);
    const loads = Promise.all([
      numbers.load(),
      document.fonts.load('600 20px "Fraunces Variable"'),
      document.fonts.load('400 14px "Nunito Variable"'),
      document.fonts.load('700 14px "Nunito Variable"'),
    ]);
    // Never hold the game back for long if a font can't be had.
    await Promise.race([loads, new Promise((r) => setTimeout(r, timeoutMs))]);
  } catch {
    // The fallback fonts in the stacks take over.
  }
}
