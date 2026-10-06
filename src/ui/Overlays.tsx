/** The resolution banner, the map's building tooltip and keyboard help. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { waterAt } from '../game/waterInfo';
import { commuteAt } from '../game/commuteInfo';
import { heatAt } from '../game/heatInfo';
import { coolAt } from '../game/coolInfo';
import { lakeAt } from '../game/lakeInfo';
import { forestAt } from '../game/forestInfo';
import { edgesAround } from '../sim/edges';
import type { AudioEngine } from '../audio/engine';
import { logToCsv, type PlayLog } from '../game/playlog';
import type { GameStore } from '../game/store';
import { gaugeLines, type StorageGauge } from '../game/storageInfo';
import type { MapView } from '../render/mapView';
import { eventOf, hexKey } from '../sim';
import { Sun } from './icons';
import { SEASON_NAMES } from './TopBar';
import { SoundSettings } from './Sound';

const PHASE_TEXT = {
  event: (event: string) => event,
  day: (_: string, land: string) => `Day: the sun crosses the ${land}`,
  night: (_: string, land: string) => `Night: stores and wind carry the ${land}`,
  settle: () => 'The season settles',
} as const;

/** Shown over the map while a season plays out, with Pause and Skip. */
export function ResolutionBanner({ store }: { store: GameStore }) {
  const r = store.resolution!;
  const event = eventOf(store.content, r.report.event);
  return (
    <div class="pill resolution" role="status" aria-label="The season is resolving">
      <Sun size={16} />
      <span>
        <strong>{SEASON_NAMES[r.report.season]}</strong> ·{' '}
        {PHASE_TEXT[r.phase](event.name, store.content.land)}
        {r.paused ? ' (paused)' : ''}
      </span>
      <button
        type="button"
        class="button small-button"
        onClick={() => store.togglePause()}
        aria-keyshortcuts="P"
      >
        {r.paused ? 'Resume' : 'Pause'}
      </button>
      <button
        type="button"
        class="button small-button"
        onClick={() => store.finishResolution()}
        aria-keyshortcuts="Space"
      >
        Skip
      </button>
    </div>
  );
}

/** A small tooltip over the hovered building, with this season's math. */
export function MapTip({ store, view }: { store: GameStore; view: MapView | null }) {
  const { content, state } = store;
  if (!view || store.tool || !store.hover) return null;
  const b = Object.values(state.buildings).find((x) => hexKey(x.at) === hexKey(store.hover!));
  const tile = state.map.tiles[hexKey(store.hover)];
  if (!tile) return null;
  const at = view.screenOf(store.hover);
  // Water as this season stands (when the run has water); its lines replace the math's.
  const water = waterAt(store.rules, state, store.waterForecast, store.hover);
  const hedgeSides = edgesAround(store.hover).filter((e) => state.hedges.includes(e)).length;
  const walks = commuteAt(store.rules, state, store.commuteForecast, store.hover);
  const heat = heatAt(store.rules, state, store.heatForecast, store.hover, store.coldForecast);
  const cool = coolAt(store.rules, state, store.coolForecast, store.hover, store.hotForecast);
  const lake = lakeAt(store.rules, state, store.insight.now, store.hover);
  const forest = forestAt(store.rules, state, store.insight.now, store.hover);
  const gauge = b ? store.storageOf(b.uid) : null;
  const math = (b ? (store.insight.now.math[b.uid] ?? []) : []).filter(
    (l) => water.length === 0 || !l.startsWith('water:'),
  );
  const marks = store.marks.filter((m) => hexKey(m.at) === hexKey(store.hover!));
  const title = b
    ? content.byId[b.type]!.name
    : tile.type.charAt(0).toUpperCase() + tile.type.slice(1);
  return (
    <div
      class="map-tip"
      style={{ left: `${at.x + 26}px`, top: `${at.y - 20}px` }}
      aria-hidden="true"
    >
      <div class="strong">{title}</div>
      {b && <div class="quiet small">on {tile.type} · click for details</div>}
      {tile.height !== undefined && tile.height > 0 && (
        <div class="small">
          Height {tile.height}
          {tile.charred ? ' · charred: +1 food for a farm' : ''}
        </div>
      )}
      {tile.salvage !== undefined && <div class="small">{tile.salvage} salvage left</div>}
      {marks.map((m) => (
        <div class={`small mark-line${m.coming ? ' coming' : ''}`}>{m.text}</div>
      ))}
      {hedgeSides > 0 && (
        <div class="small">
          A hedge along {hedgeSides === 1 ? '1 side' : `${hedgeSides} sides`}: storms can’t damage
          what stands here.
        </div>
      )}
      {water.map((l) => (
        <div class="small water-line">{l}</div>
      ))}
      {walks.map((l) => (
        <div class="small walk-line">{l}</div>
      ))}
      {cool.map((l) => (
        <div class="small cool-line">{l}</div>
      ))}
      {lake.map((l) => (
        <div class="small lake-line">{l}</div>
      ))}
      {forest.map((l) => (
        <div class="small forest-line">{l}</div>
      ))}
      {heat.map((l) => (
        <div class="small heat-line">{l}</div>
      ))}
      {gauge && <StorageGaugeView gauge={gauge} />}
      {math.slice(0, 6).map((l) => (
        <div class="small">{l}</div>
      ))}
    </div>
  );
}

/** How full a store of energy or heat is: a bar for now, a mark for the season's end. */
export function StorageGaugeView({ gauge }: { gauge: StorageGauge }) {
  const pct = (n: number) => `${Math.round((100 * n) / Math.max(1, gauge.capacity))}%`;
  return (
    <div class={`storage-gauge ${gauge.holds}`}>
      <div
        class="gauge-bar"
        role="meter"
        aria-label={`${gauge.holds === 'heat' ? 'Heat' : gauge.holds === 'ice' ? 'Ice' : 'Energy'} stored`}
        aria-valuemin={0}
        aria-valuemax={gauge.capacity}
        aria-valuenow={gauge.now}
      >
        <div class="gauge-fill" style={{ width: pct(gauge.now) }} />
        <div class="gauge-after" style={{ left: pct(gauge.after) }} title="When the season ends" />
      </div>
      {gaugeLines(gauge).map((l) => (
        <div class="small">{l}</div>
      ))}
    </div>
  );
}

export function Help({
  onClose,
  log,
  audio,
}: {
  onClose: () => void;
  log?: PlayLog;
  audio?: AudioEngine;
}) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), []);
  const keys: [string, string][] = [
    ['1 – 4', 'Pick a draft card (or a vision or charter, when one is offered)'],
    ['A', 'Open the Almanac'],
    ['R / X', 'Reroll the draft / buy a 4th card (knowledge)'],
    ['Letters on the palette', 'Pick a building to place'],
    ['K', 'Spread compost'],
    ['Arrow keys', 'Aim at a tile while placing (pan the map otherwise)'],
    ['N / Shift+N', 'Next / previous legal site'],
    ['Enter', 'Place at the aimed tile'],
    ['Esc', 'Stop placing, close panels'],
    ['Z or Ctrl+Z', 'Undo (free until the season ends)'],
    ['Delete', 'Demolish the building in the inspector'],
    ['E', 'End the season'],
    ['Shift+E', 'Fast-forward to next spring (pauses for choices; Esc stops)'],
    ['Space / Esc', 'Skip the season playing out'],
    ['P', 'Pause or resume the season playing out'],
    ['+ / − / 0', 'Zoom in / out / fit the valley'],
    ['Tab', 'Move between buttons; tooltips show on focus'],
  ];
  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Keyboard</h2>
        <table class="keys">
          {keys.map(([k, v]) => (
            <tr>
              <th>{k}</th>
              <td>{v}</td>
            </tr>
          ))}
        </table>
        {audio && <SoundSettings engine={audio} />}
        {log && <LogTools log={log} />}
        <button type="button" class="button" ref={close} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

/** The playtest log: how many seasons it holds, a CSV download, and a reset. */
function LogTools({ log }: { log: PlayLog }) {
  const [rows, setRows] = useState(log.rows.length);
  const download = () => {
    const blob = new Blob([logToCsv(log.rows)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sunroot-playtest-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div class="log-tools small">
      <strong>Playtest log:</strong> {rows} season{rows === 1 ? '' : 's'} recorded, with time spent,
      undos, cards and your notes (the Note button).
      <div class="row">
        <button type="button" class="button small-button" disabled={rows === 0} onClick={download}>
          Download CSV
        </button>
        <button
          type="button"
          class="button small-button"
          disabled={rows === 0}
          onClick={() => {
            log.clear();
            setRows(0);
          }}
        >
          Clear log
        </button>
      </div>
    </div>
  );
}
