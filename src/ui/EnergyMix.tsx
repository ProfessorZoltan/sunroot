/**
 * The Energy mix: the grid's energy through the year, by day and by night,
 * stacked by family of source, with the line of what the settlement needs.
 * Past seasons as they went, this one as it stands, the rest as forecast.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { GameStore } from '../game/store';
import { energyMix, type MixFamily, type MixPoint } from '../game/energyMix';
import { SEASON_NAMES } from './TopBar';

const W = 640;
const H = 250;
const M = { left: 34, right: 54, top: 26, bottom: 44 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

/** A round step for the y axis: 1, 2 or 5 times a power of ten, about 4 lines. */
function niceStep(max: number): number {
  const raw = Math.max(1, max / 4);
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
}

const slotName = (p: MixPoint) =>
  `${SEASON_NAMES[p.season]}, ${p.slot === 'day' ? 'day' : 'night'}`;
const statusName = (p: MixPoint) =>
  p.status === 'done' ? 'as it went' : p.status === 'now' ? 'this season' : 'forecast';

export function EnergyMixChart({
  points,
  families,
}: {
  points: MixPoint[];
  families: MixFamily[];
}) {
  const [at, setAt] = useState<number | null>(null);
  const step = PLOT_W / points.length;
  const x = (i: number) => M.left + (i + 0.5) * step;
  const top = Math.max(1, ...points.map((p) => Math.max(p.total, p.demand)));
  const tick = niceStep(top);
  const yMax = Math.ceil(top / tick) * tick;
  const y = (v: number) => M.top + PLOT_H - (v / yMax) * PLOT_H;
  const ticks = Array.from({ length: yMax / tick + 1 }, (_, i) => i * tick);

  // Each family's band: from the families below it to its own top, bottom to top.
  const below = points.map(() => 0);
  const bands = families.map((f) => {
    const lower = [...below];
    const upper = points.map((p, i) => (below[i] = below[i]! + p.values[f.id]!));
    const top = upper.map((v, i) => `${x(i)},${y(v)}`);
    const bottom = lower.map((v, i) => `${x(i)},${y(v)}`).reverse();
    return { f, area: `M${top.join('L')}L${bottom.join('L')}Z`, edge: `M${top.join('L')}` };
  });
  const demand = `M${points.map((p, i) => `${x(i)},${y(p.demand)}`).join('L')}`;
  const firstForecast = points.findIndex((p) => p.status === 'forecast');
  const nowAt = points.findIndex((p) => p.status === 'now');

  const pick = (e: PointerEvent) => {
    const svg = e.currentTarget as SVGSVGElement;
    const box = svg.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    setAt(Math.max(0, Math.min(points.length - 1, Math.floor((px - M.left) / step))));
  };
  const hovered = at !== null ? points[at]! : null;

  return (
    <div class="mix-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Stacked area chart of energy made by each kind of source, by day and by night through the year, with the energy needed"
        tabIndex={0}
        onPointerMove={pick}
        onPointerLeave={() => setAt(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') setAt(Math.min(points.length - 1, (at ?? -1) + 1));
          else if (e.key === 'ArrowLeft') setAt(Math.max(0, (at ?? points.length) - 1));
          else return;
          e.preventDefault();
        }}
        onBlur={() => setAt(null)}
      >
        {/* Nights shaded; seasons labelled beneath their two slots. */}
        {points.map((p, i) =>
          p.slot === 'night' ? (
            <rect class="mix-night" x={x(i) - step / 2} y={M.top} width={step} height={PLOT_H} />
          ) : null,
        )}
        {ticks.map((t) => (
          <g>
            <line class="mix-grid" x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} />
            <text class="mix-axis" x={M.left - 6} y={y(t) + 4} text-anchor="end">
              {t}
            </text>
          </g>
        ))}
        {bands.map((b) => (
          <path d={b.area} fill={b.f.color} class="mix-area" />
        ))}
        {/* The surface gap between bands. */}
        {bands.map((b) => (
          <path d={b.edge} class="mix-gap" />
        ))}
        {/* Where the forecast begins: a hairline, so the colours keep meaning the same source. */}
        {firstForecast > 0 && (
          <line
            class="mix-divider"
            x1={x(firstForecast) - step / 2}
            x2={x(firstForecast) - step / 2}
            y1={M.top - 14}
            y2={M.top + PLOT_H}
          />
        )}
        <path d={demand} class="mix-demand" />
        <text class="mix-axis" x={x(points.length - 1) + 8} y={y(points.at(-1)!.demand) + 4}>
          needed
        </text>
        {points.map((p, i) =>
          p.shortfall > 0 ? <circle class="mix-short" cx={x(i)} cy={y(p.demand)} r="4" /> : null,
        )}
        {points.map((p, i) => (
          <text class="mix-axis" x={x(i)} y={H - M.bottom + 15} text-anchor="middle">
            {p.slot}
          </text>
        ))}
        {points.map((p, i) =>
          p.slot === 'day' ? (
            <text class="mix-season" x={x(i) + step / 2} y={H - M.bottom + 32} text-anchor="middle">
              {SEASON_NAMES[p.season]}
              {i === nowAt ? ' · now' : ''}
            </text>
          ) : null,
        )}
        {firstForecast >= 0 && (
          <text class="mix-axis" x={x(firstForecast) - step / 2 + 4} y={M.top - 8}>
            forecast →
          </text>
        )}
        {hovered && at !== null && (
          <line class="mix-cross" x1={x(at)} x2={x(at)} y1={M.top} y2={M.top + PLOT_H} />
        )}
      </svg>
      {hovered && at !== null && (
        <div
          class="mix-tip"
          role="status"
          style={{ left: `${((x(at) + (at < points.length / 2 ? 14 : -14)) / W) * 100}%` }}
          data-side={at < points.length / 2 ? 'right' : 'left'}
        >
          <div class="strong">{slotName(hovered)}</div>
          <div class="quiet small">{statusName(hovered)}</div>
          {[...families].reverse().map((f) =>
            hovered.values[f.id]! > 0 ? (
              <div class="mix-tip-row">
                <span class="mix-key" style={{ background: f.color }} />
                <strong>{hovered.values[f.id]}</strong> {f.name}
              </div>
            ) : null,
          )}
          <div class="mix-tip-row">
            <strong>{hovered.total}</strong> made, <strong>{hovered.demand}</strong> needed
          </div>
          {hovered.shortfall > 0 && (
            <div class="mix-tip-row bad">
              <strong>{hovered.shortfall}</strong> short
            </div>
          )}
        </div>
      )}
      <ul class="mix-legend" aria-label="Kinds of source">
        {[...families].reverse().map((f) => (
          <li>
            <span class="mix-swatch" style={{ background: f.color }} />
            {f.name}
          </li>
        ))}
        <li>
          <span class="mix-line" />
          Needed
        </li>
      </ul>
    </div>
  );
}

/** The same numbers as a table: every slot, every kind of source, and what was needed. */
export function EnergyMixTable({
  points,
  families,
}: {
  points: MixPoint[];
  families: MixFamily[];
}) {
  return (
    <table class="mix-table">
      <thead>
        <tr>
          <th scope="col">Slot</th>
          {families.map((f) => (
            <th scope="col">{f.name}</th>
          ))}
          <th scope="col">Made</th>
          <th scope="col">Needed</th>
          <th scope="col">Short</th>
        </tr>
      </thead>
      <tbody>
        {points.map((p) => (
          <tr class={p.status}>
            <th scope="row">
              {slotName(p)} <span class="quiet small">({statusName(p)})</span>
            </th>
            {families.map((f) => (
              <td>{p.values[f.id]}</td>
            ))}
            <td>{p.total}</td>
            <td>{p.demand}</td>
            <td class={p.shortfall > 0 ? 'bad' : ''}>{p.shortfall || ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EnergyMixDialog({ store, onClose }: { store: GameStore; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  const [table, setTable] = useState(false);
  useEffect(() => close.current?.focus(), []);
  const mix = energyMix(store.rules, store.insight.year);
  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal energy-mix"
        role="dialog"
        aria-modal="true"
        aria-label="Energy mix this year"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <div class="panel-head">
          <div>
            <h2>Energy mix this year</h2>
            <p class="quiet small">
              Energy made by each kind of source, by day and by night; the line is what the
              settlement needs. Past seasons as they went, the rest as forecast.
            </p>
          </div>
          <div class="mix-actions">
            <button type="button" class="button small-button" onClick={() => setTable(!table)}>
              {table ? 'Show chart' : 'Show table'}
            </button>
            <button type="button" class="button small-button" ref={close} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        {mix.families.length === 0 ? (
          <p class="quiet">No energy made yet this year.</p>
        ) : table ? (
          <EnergyMixTable {...mix} />
        ) : (
          <EnergyMixChart {...mix} />
        )}
      </div>
    </div>
  );
}
