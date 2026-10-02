/** Controls that sit on the map: highlighting one terrain, so tile types stay easy to read. */
import type { GameStore } from '../game/store';
import type { TileType } from '../sim';

const TERRAIN_NAMES: Partial<Record<TileType, string>> = {
  reservoir: 'Lake or reservoir',
};

export function terrainName(type: TileType): string {
  return TERRAIN_NAMES[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}

/** Picks a terrain to highlight: the map dims every other tile. */
export function TerrainPicker({ store }: { store: GameStore }) {
  const present = [...new Set(Object.values(store.state.map.tiles).map((t) => t.type))].sort();
  const counts = (type: TileType) =>
    Object.values(store.state.map.tiles).filter((t) => t.type === type).length;
  return (
    <label class="map-control terrain-picker">
      <span class="small">Highlight</span>
      <select
        aria-label="Highlight terrain"
        value={store.terrainFocus ?? ''}
        onChange={(e) =>
          store.focusTerrain(((e.target as HTMLSelectElement).value || null) as TileType | null)
        }
      >
        <option value="">No terrain</option>
        {present.map((t) => (
          <option value={t}>
            {terrainName(t)} ({counts(t)})
          </option>
        ))}
      </select>
    </label>
  );
}
