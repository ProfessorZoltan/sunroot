/**
 * Controls that sit on the map: highlighting one terrain, so tile types stay easy to read, and
 * the buildings that would go short if the season ended now.
 */
import { NEEDS, shortOf, type Need } from '../game/shortfalls';
import type { GameStore } from '../game/store';
import type { TileType } from '../sim';

const TERRAIN_NAMES: Partial<Record<TileType, string>> = {
  reservoir: 'Lake or reservoir',
};

export function terrainName(type: TileType): string {
  return TERRAIN_NAMES[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Picks what to highlight (the map dims every other tile): a terrain, or a closed loop's
 * buildings, so a loop on its card can be found on the map.
 */
export function TerrainPicker({ store }: { store: GameStore }) {
  const present = [...new Set(Object.values(store.state.map.tiles).map((t) => t.type))].sort();
  const counts = (type: TileType) =>
    Object.values(store.state.map.tiles).filter((t) => t.type === type).length;
  const loops = store.state.loops.map((l) => ({
    key: `${l.combo}:${l.anchor}`,
    name: store.rules.comboById[l.combo]?.name ?? l.combo,
    n: l.members.length,
  }));
  const value = store.loopFocus ? `loop:${store.loopFocus}` : (store.terrainFocus ?? '');
  return (
    <label class="map-control terrain-picker">
      <span class="small">Highlight</span>
      <select
        aria-label="Highlight terrain"
        value={value}
        onChange={(e) => {
          const v = (e.target as HTMLSelectElement).value;
          if (v.startsWith('loop:')) store.focusLoop(v.slice('loop:'.length));
          else store.focusTerrain((v || null) as TileType | null);
        }}
      >
        <option value="">Nothing</option>
        {loops.length > 0 && (
          <optgroup label="Closed loops">
            {loops.map((l) => (
              <option value={`loop:${l.key}`}>
                {l.name} ({l.n} buildings)
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="Terrain">
          {present.map((t) => (
            <option value={t}>
              {terrainName(t)} ({counts(t)})
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}

const NEED_LABEL: Record<Need | 'any', string> = {
  any: 'Anything',
  power: 'Power',
  heat: 'Heat',
  water: 'Water',
  cooling: 'Cooling',
};

/**
 * The buildings that would be short of power, heat, water or cooling if the season ended now
 * (asked for in playtesting): pick one to light them up on the map and list them.
 */
export function ShortfallPicker({ store }: { store: GameStore }) {
  const all = store.shortfalls;
  const focus = store.shortFocus;
  const listed = focus ? shortOf(all, focus) : [];
  const name = (uid: string) =>
    store.rules.byId[store.state.buildings[uid]?.type ?? '']?.name ?? 'Building';
  return (
    <>
      <label class="map-control shortfall-picker">
        <span class="small">Short if it ended now</span>
        <select
          aria-label="Highlight shortfalls"
          value={focus ?? ''}
          onChange={(e) =>
            store.focusShortfall(
              ((e.target as HTMLSelectElement).value || null) as Need | 'any' | null,
            )
          }
        >
          <option value="">
            {all.length === 0 ? 'Nothing' : `${all.length} building${all.length > 1 ? 's' : ''}`}
          </option>
          {(['any', ...NEEDS] as const).map((n) => {
            const count = shortOf(all, n).length;
            return (
              <option value={n} disabled={count === 0 && focus !== n}>
                {NEED_LABEL[n]} ({count})
              </option>
            );
          })}
        </select>
      </label>
      {focus && (
        <div
          class="map-control shortfall-list"
          role="group"
          aria-label="Buildings that would go short"
        >
          {listed.length === 0 && <span class="small">None this season.</span>}
          {listed.map((s) => (
            <button type="button" onClick={() => store.inspect(s.uid)}>
              <strong>{name(s.uid)}</strong>
              {s.lines.map((l) => (
                <span class="small">{l}</span>
              ))}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
