import { describe, expect, it } from 'vitest';
import { GLOBAL_KEYS, paletteHotkeys } from '../src/ui/hotkeys';
import { content } from './helpers';

describe('palette hotkeys', () => {
  it('gives distinct letters that are not global keys, starters first; the rest use Tab', () => {
    const palette = [
      ...content.buildings.filter((b) => b.starter),
      ...content.buildings.filter((b) => !b.starter && b.draftable),
    ];
    const keys = paletteHotkeys(palette.map((b) => ({ id: b.id, name: b.name })));
    const values = Object.values(keys);
    expect(new Set(values).size).toBe(values.length);
    for (const k of values) expect(Object.values(GLOBAL_KEYS)).not.toContain(k);
    for (const b of palette.filter((x) => x.starter)) expect(keys[b.id], b.id).toBeDefined();
    expect(values.length).toBe(26 - Object.keys(GLOBAL_KEYS).length + 1); // '?' is not a letter
  });

  it('prefers the first letter of a word', () => {
    const keys = paletteHotkeys([
      { id: 'floodplainFarm', name: 'Floodplain Farm' },
      { id: 'cottage', name: 'Cottage' },
    ]);
    expect(keys).toEqual({ floodplainFarm: 'f', cottage: 'c' });
  });
});
