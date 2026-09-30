/**
 * Keyboard: global keys and the building palette's letter keys. Palette keys
 * are the first free letter of each building's name, skipping the global ones.
 */
export const GLOBAL_KEYS = {
  endSeason: 'e',
  reroll: 'r',
  extraCard: 'x',
  undo: 'z',
  nextSite: 'n',
  compost: 'k',
  help: '?',
} as const;

const RESERVED = new Set<string>(Object.values(GLOBAL_KEYS));

export function paletteHotkeys(names: { id: string; name: string }[]): Record<string, string> {
  const used = new Set<string>();
  const out: Record<string, string> = {};
  for (const { id, name } of names) {
    const letters = name.toLowerCase().replace(/[^a-z]/g, '');
    const words = name
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w[0] ?? '');
    const candidates = [...words, ...letters, ...'abcdefghijklmnopqrstuvwxyz'];
    const key = candidates.find((c) => c && !used.has(c) && !RESERVED.has(c));
    if (key) {
      used.add(key);
      out[id] = key;
    }
  }
  return out;
}
