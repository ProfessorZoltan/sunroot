/**
 * Root City (Milestone 8): the city screen between runs. The Heartwood sits
 * at the centre, ringed by district slots. Here the player places the Graft
 * a run planted, spends Seeds to raise districts' tiers, and chooses the next
 * expedition. Every change is a city command (src/sim/city.ts).
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { TILE_COLORS } from '../render/palette';
import {
  effectiveContent,
  applyCityCommand,
  districtAt,
  expeditionOffer,
  generateMap,
  isFull,
  needsExpedition,
  neighborSlots,
  slotCount,
  slotHexes,
  standingLandmarks,
  sunTreeProgress,
  teaching,
  type CityCommand,
  type CityEvent,
  type CityState,
  type Content,
  type District,
  type Expedition,
  type Hex,
} from '../sim';
import { cityCue } from '../audio/director';
import type { AudioEngine } from '../audio/engine';
import { cardLabel } from './RunUi';
import { SoundButton } from './Sound';

const SIZE = 44;
const SQRT3 = Math.sqrt(3);

/** Each district's colour and emblem, drawn in code like everything else. */
const LOOK: Record<string, { color: string; ink: string }> = {
  millraceQuarter: { color: '#3A6EA5', ink: '#e8f1fa' },
  orchardWard: { color: '#E0A33B', ink: '#4a3410' },
  mendedCommons: { color: '#2E8B6A', ink: '#eaf6ef' },
  foundryDistrict: { color: '#B85C6E', ink: '#fbecef' },
  tidalQuarter: { color: '#2F5E63', ink: '#e6f2f2' },
};
const lookOf = (id: string) => LOOK[id] ?? { color: '#9e9280', ink: '#fffbf0' };

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

function toPixel(h: Hex, size = SIZE): { x: number; y: number } {
  return { x: size * SQRT3 * (h.q + h.r / 2), y: size * 1.5 * h.r };
}

function hexPoints(cx: number, cy: number, size: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + size * Math.cos(a)).toFixed(1)},${(cy + size * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

/** A district's emblem, centred on (0, 0). */
function Emblem({ id, ink }: { id: string; ink: string }) {
  switch (id) {
    case 'millraceQuarter':
      return (
        <g stroke={ink} stroke-width="2" fill="none">
          <circle r="10" />
          {[0, 45, 90, 135].map((a) => (
            <line
              x1={-10 * Math.cos((a * Math.PI) / 180)}
              y1={-10 * Math.sin((a * Math.PI) / 180)}
              x2={10 * Math.cos((a * Math.PI) / 180)}
              y2={10 * Math.sin((a * Math.PI) / 180)}
            />
          ))}
        </g>
      );
    case 'orchardWard':
      return (
        <g>
          <rect x="-2" y="2" width="4" height="9" fill={ink} />
          <circle cy="-3" r="9" fill={ink} />
          <circle cx="-3" cy="-4" r="2" fill="#d9543c" />
          <circle cx="4" cy="-1" r="2" fill="#d9543c" />
        </g>
      );
    case 'mendedCommons':
      return (
        <path
          d="M0,-11 C9,-6 9,6 0,11 C-9,6 -9,-6 0,-11 Z M0,-9 L0,10"
          fill={ink}
          stroke="#2E8B6A"
          stroke-width="1.5"
        />
      );
    case 'foundryDistrict':
      return (
        <g fill={ink}>
          <rect x="-11" y="-2" width="16" height="11" />
          <rect x="6" y="-11" width="5" height="20" />
          <circle cx="9" cy="-14" r="2.5" opacity="0.7" />
        </g>
      );
    default:
      return <circle r="9" fill={ink} />;
  }
}

/** The Heartwood at the centre, growing towards the Sun Tree as the city fills. */
function Heartwood({ growth, grown }: { growth: number; grown: boolean }) {
  const crown = 12 + 14 * growth;
  return (
    <g aria-hidden="true">
      {grown && <circle r={SIZE * 0.95} fill="#F2C14E" opacity="0.35" />}
      <polygon points={hexPoints(0, 0, SIZE - 3)} fill="#efe2bf" stroke="#cdbb92" />
      <rect x="-3" y="2" width="6" height="16" fill="#7a4a2a" />
      <circle cy={-crown / 3} r={crown} fill={grown ? '#E0A33B' : '#5e8a55'} />
      <circle
        cx={-crown / 2.5}
        cy={-crown / 2}
        r={crown / 2.2}
        fill={grown ? '#F2C14E' : '#94b780'}
      />
      {grown &&
        Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <line
              x1={Math.cos(a) * (crown + 3)}
              y1={Math.sin(a) * (crown + 3) - crown / 3}
              x2={Math.cos(a) * (crown + 9)}
              y2={Math.sin(a) * (crown + 9) - crown / 3}
              stroke="#F2C14E"
              stroke-width="2.5"
            />
          );
        })}
    </g>
  );
}

/** A small map of an expedition's region, so the options look like places. */
function RegionThumb({
  content,
  seed,
  region,
  twist,
}: {
  content: Content;
  seed: string;
  region: string | null;
  twist: string;
}) {
  // The valley as the run will generate it: the region (and a twist) can change the map.
  const valley = effectiveContent(content, {
    tunings: [],
    charters: [],
    options: { expedition: { twist, region } },
  });
  const { map } = generateMap(valley, seed);
  const s = 4;
  const tiles = Object.values(map.tiles).map((t) => ({ ...toPixel(t, s), type: t.type }));
  const xs = tiles.map((t) => t.x);
  const ys = tiles.map((t) => t.y);
  const [x0, y0] = [Math.min(...xs) - s, Math.min(...ys) - s];
  const [w, h] = [Math.max(...xs) - x0 + s, Math.max(...ys) - y0 + s];
  return (
    <svg class="region-thumb" viewBox={`${x0} ${y0} ${w} ${h}`} aria-hidden="true">
      {tiles.map((t) => (
        <polygon points={hexPoints(t.x, t.y, s)} fill={hex(TILE_COLORS[t.type].top)} />
      ))}
    </svg>
  );
}

/** Lines between districts that form a standing landmark. */
function landmarkLinks(content: Content, city: CityState): [number, number][] {
  const links: [number, number][] = [];
  for (const id of standingLandmarks(content, city)) {
    const l = content.landmarks.find((x) => x.id === id)!;
    for (const d of city.districts.filter((x) => x.district === l.district)) {
      for (const s of neighborSlots(content, d.slot)) {
        const n = districtAt(city, s);
        if (!n) continue;
        const green = content.districts.find((x) => x.id === n.district)?.green;
        if (l.nextTo.districts.includes(n.district) || (l.nextTo.green && green))
          links.push([d.slot, s]);
      }
    }
  }
  return links;
}

export function CityScreen({
  content,
  initial,
  readOnly = false,
  onSave,
  onSetOut,
  onBack,
  audio,
}: {
  content: Content;
  initial: CityState;
  /** A run is in progress: the city can be looked at, not changed. */
  readOnly?: boolean;
  onSave: (city: CityState) => void;
  onSetOut: (city: CityState) => void;
  onBack?: () => void;
  audio?: AudioEngine;
}) {
  const [city, setCity] = useState(initial);
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [events, setEvents] = useState<CityEvent[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  // The city's music fills out as its slots fill.
  useEffect(
    () => audio?.setLayers(1 + Math.floor((3 * initial.districts.length) / slotCount(content))),
    [],
  );

  const apply = (command: CityCommand): boolean => {
    const r = applyCityCommand(content, city, command);
    if (!r.ok) {
      setMessage(r.error.charAt(0).toUpperCase() + r.error.slice(1) + '.');
      return false;
    }
    setCity(r.city);
    onSave(r.city);
    if (audio) {
      const placed = command.type === 'place' ? r.city.districts.at(-1) : undefined;
      const district =
        placed ?? (command.type === 'upgrade' ? districtAt(r.city, command.slot) : undefined);
      if (district) {
        const cue = cityCue(
          command.type === 'upgrade' ? 'upgrade' : 'place',
          districtNote(content, district.district),
        );
        audio.play(cue.cue, cue.notes);
      }
      for (const e of r.events) {
        if (e.kind === 'landmark' || e.kind === 'sunTree') {
          const cue = cityCue(e.kind);
          audio.play(cue.cue, cue.notes);
        }
      }
      audio.setLayers(1 + Math.floor((3 * r.city.districts.length) / slotCount(content)));
    }
    const composted = r.events.find((e) => e.kind === 'composted');
    setMessage(
      composted && composted.kind === 'composted'
        ? `The ${nameOf(content, composted.district)} composted into ${composted.seeds} Seeds.`
        : null,
    );
    setEvents((q) => [...q, ...r.events.filter((e) => e.kind !== 'composted')]);
    return true;
  };

  const tiers = content.rules.score.tiers;
  const slots = slotHexes(slotCount(content));
  const pending = city.pending[0];
  const full = isFull(content, city);
  const progress = sunTreeProgress(content, city);
  const links = landmarkLinks(content, city);
  const nextRun = city.runs + 1;
  const teach = teaching(content, nextRun);
  const chooseSlot = (slot: number) => {
    if (readOnly) return setSelected(slot);
    if (pending && (!districtAt(city, slot) || full)) {
      if (apply({ type: 'place', slot })) setSelected(slot);
      return;
    }
    setSelected(districtAt(city, slot) ? slot : null);
  };
  const extent = SIZE * SQRT3 * 2.5 + SIZE;

  return (
    <div class="screen city-screen">
      <header class="top city-top">
        <h1 class="city-title" tabIndex={-1} ref={heading}>
          Root City
        </h1>
        <div class="stat">
          <span class="quiet small">Seeds</span> <strong>{city.seeds}</strong>
        </div>
        <div class="stat">
          <span class="quiet small">Runs sent home</span> <strong>{city.runs}</strong>
        </div>
        <div class="stat" aria-label="Sun Tree progress">
          <span class="quiet small">Sun Tree</span>{' '}
          <strong>
            {progress.filled} of {progress.slots} districts, {progress.heartwood} of{' '}
            {progress.needed} at Heartwood
          </strong>
        </div>
        <span class="grow" />
        {audio && <SoundButton engine={audio} />}
        {readOnly && onBack && (
          <button type="button" class="button primary" onClick={onBack}>
            Back to the run
          </button>
        )}
      </header>
      <div class="city-body">
        <main class="city-map" aria-label="The city">
          <svg
            viewBox={`${-extent} ${-extent * 0.82} ${extent * 2} ${extent * 1.64}`}
            role="group"
            aria-label="District slots around the Heartwood"
          >
            <Heartwood
              growth={progress.filled / Math.max(1, progress.slots)}
              grown={city.sunTree !== null}
            />
            {slots.map((h, slot) => {
              const { x, y } = toPixel(h);
              const d = districtAt(city, slot);
              const look = d ? lookOf(d.district) : null;
              const tierIndex = d ? tiers.findIndex((t) => t.id === d.tier) : -1;
              const target = !readOnly && pending !== undefined && (!d || full);
              const label = d
                ? `Slot ${slot + 1}: ${nameOf(content, d.district)}, ${tiers[tierIndex]?.name}${
                    target ? ' (replace)' : ''
                  }`
                : `Slot ${slot + 1}: empty${target ? ' (place here)' : ''}`;
              return (
                <g
                  class={`slot${d ? ' filled' : ''}${target ? ' target' : ''}${
                    selected === slot ? ' selected' : ''
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-label={label}
                  aria-pressed={selected === slot}
                  transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}
                  onClick={() => chooseSlot(slot)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      chooseSlot(slot);
                    }
                  }}
                >
                  <polygon
                    points={hexPoints(0, 0, SIZE - 3)}
                    fill={look ? look.color : '#fbf5e6'}
                    stroke={look ? '#2f3b2e' : '#cdbb92'}
                    stroke-width={look ? 1.2 : 1.5}
                    stroke-dasharray={look ? undefined : '5 4'}
                  />
                  {d && look && (
                    <>
                      <g transform="translate(0,-6)">
                        <Emblem id={d.district} ink={look.ink} />
                      </g>
                      <g aria-hidden="true">
                        {Array.from({ length: tierIndex + 1 }, (_, i) => (
                          <circle
                            cx={(i - tierIndex / 2) * 9}
                            cy="20"
                            r="3.2"
                            fill={i === 2 ? '#F2C14E' : look.ink}
                            stroke="#2f3b2e"
                            stroke-width="0.8"
                          />
                        ))}
                      </g>
                    </>
                  )}
                </g>
              );
            })}
            {links.map(([a, b]) => {
              // A gold clasp across the shared edge of two districts that form a landmark.
              const p = toPixel(slots[a]!);
              const q = toPixel(slots[b]!);
              const mx = (p.x + q.x) / 2;
              const my = (p.y + q.y) / 2;
              const dx = (q.x - p.x) * 0.22;
              const dy = (q.y - p.y) * 0.22;
              return (
                <g class="landmark-link" aria-hidden="true">
                  <line
                    x1={mx - dx}
                    y1={my - dy}
                    x2={mx + dx}
                    y2={my + dy}
                    stroke="#D9A441"
                    stroke-width="6"
                    stroke-linecap="round"
                  />
                  <circle
                    cx={mx}
                    cy={my}
                    r="5"
                    fill="#F2C14E"
                    stroke="#8a6414"
                    stroke-width="1.2"
                  />
                </g>
              );
            })}
          </svg>
        </main>
        <aside class="city-side" aria-label="Between runs">
          {message && (
            <div class="panel small" role="status">
              {message}
            </div>
          )}
          {pending && !readOnly && (
            <PendingPanel
              content={content}
              graft={pending}
              full={full}
              more={city.pending.length - 1}
              onRelease={() => apply({ type: 'release' })}
            />
          )}
          {selected !== null && districtAt(city, selected) && (
            <DistrictPanel
              content={content}
              city={city}
              slot={selected}
              readOnly={readOnly}
              onUpgrade={() => apply({ type: 'upgrade', slot: selected })}
            />
          )}
          {!readOnly && !pending && (
            <ExpeditionPanel
              content={content}
              city={city}
              onChoose={(index) => apply({ type: 'chooseExpedition', index })}
              onSetOut={() => onSetOut(city)}
            />
          )}
          <section class="panel" aria-label="What comes next">
            <h2>Run {nextRun}</h2>
            <p class="small">
              {teach.joining.length > 0
                ? `New in this run: ${teach.joining.map(describeSystem).join('; ')}.`
                : 'No new systems this run.'}{' '}
              {teach.next
                ? `From run ${teach.next.run}: ${describeSystem(teach.next.system)}.`
                : 'Every system is in play.'}
            </p>
          </section>
          <LandmarkPanel content={content} city={city} />
          <DistrictGuide content={content} />
        </aside>
      </div>
      {events.length > 0 && (
        <CityReveal
          content={content}
          event={events[0]!}
          onClose={() => setEvents((q) => q.slice(1))}
        />
      )}
    </div>
  );
}

/** A district's note: its place among the districts, on the pentatonic scale. */
function districtNote(content: Content, district: string): number {
  const i = Math.max(
    0,
    content.districts.findIndex((d) => d.id === district),
  );
  return 62 + [0, 2, 4, 7, 9][i % 5]!;
}

function nameOf(content: Content, district: string): string {
  return content.districts.find((d) => d.id === district)?.name ?? district;
}

function describeSystem(system: string): string {
  if (system === 'tunings') return 'tunings join the draft';
  if (system === 'charters') return 'charters at each new era';
  if (system === 'visions') return 'a vision to choose at the start';
  return system;
}

function perkAt(content: Content, d: District, tier: string): string {
  const i = Math.max(
    0,
    content.rules.score.tiers.findIndex((t) => t.id === tier),
  );
  return d.perks[Math.min(i, d.perks.length - 1)]!.text;
}

function PendingPanel({
  content,
  graft,
  full,
  more,
  onRelease,
}: {
  content: Content;
  graft: CityState['pending'][number];
  full: boolean;
  more: number;
  onRelease: () => void;
}) {
  const d = content.districts.find((x) => x.id === graft.district)!;
  const tier = content.rules.score.tiers.find((t) => t.id === graft.tier)!;
  return (
    <section class="panel pending" aria-label="Place the Graft">
      <span class="card-kind">A Graft is waiting{more > 0 ? ` (and ${more} more)` : ''}</span>
      <h2>
        {d.name}, {tier.name}
      </h2>
      <p class="small">
        {perkAt(content, d, graft.tier)}. Adds {cardLabel(content, d.adds)} to future drafts.
      </p>
      <p class="small strong">
        {full
          ? 'Root City is full: choose a district for it to replace. The old one composts into half the Seeds spent raising it.'
          : 'Choose a free slot for it. Neighbouring districts can form landmarks.'}
      </p>
      {full && (
        <button type="button" class="button" onClick={onRelease}>
          Let it go
        </button>
      )}
    </section>
  );
}

function DistrictPanel({
  content,
  city,
  slot,
  readOnly,
  onUpgrade,
}: {
  content: Content;
  city: CityState;
  slot: number;
  readOnly: boolean;
  onUpgrade: () => void;
}) {
  const placed = districtAt(city, slot)!;
  const d = content.districts.find((x) => x.id === placed.district)!;
  const tiers = content.rules.score.tiers;
  const i = tiers.findIndex((t) => t.id === placed.tier);
  const up = tiers[i + 1];
  const cost = up ? (content.progression?.upgradeCost[up.id] ?? 0) : 0;
  return (
    <section class="panel" aria-label="District">
      <span class="card-kind">
        Slot {slot + 1} · from run {placed.run}
      </span>
      <h2>
        {d.name}, {tiers[i]!.name}
      </h2>
      <p class="small">
        {perkAt(content, d, placed.tier)}. Adds {cardLabel(content, d.adds)} to future drafts.
      </p>
      {up ? (
        <>
          <p class="small quiet">
            At {up.name}: {perkAt(content, d, up.id)}.
          </p>
          {!readOnly && (
            <button
              type="button"
              class="button primary"
              disabled={city.seeds < cost}
              onClick={onUpgrade}
            >
              Raise to {up.name} for {cost} Seeds
            </button>
          )}
        </>
      ) : (
        <p class="small quiet">At the highest tier.</p>
      )}
    </section>
  );
}

function ExpeditionPanel({
  content,
  city,
  onChoose,
  onSetOut,
}: {
  content: Content;
  city: CityState;
  onChoose: (index: number) => void;
  onSetOut: () => void;
}) {
  const offer: Expedition[] = city.runs > 0 ? expeditionOffer(content, city) : [];
  const chosen = city.expedition ? offer.findIndex((o) => o.seed === city.expedition!.seed) : -1;
  const ready = !needsExpedition(content, city);
  const bonus = content.progression?.seeds.cityRequest ?? 0;
  return (
    <section class="panel" aria-label="Next expedition">
      <h2>{offer.length > 0 ? 'Choose the next expedition' : 'Set out'}</h2>
      {offer.length > 0 && (
        <div class="expeditions">
          {offer.map((o, i) => {
            const twist = content.twists.find((t) => t.id === o.twist);
            const request = content.requests.find((r) => r.id === o.request);
            const region = content.regions.find((r) => r.id === o.region);
            return (
              <button
                type="button"
                class={`card expedition${chosen === i ? ' chosen' : ''}`}
                aria-pressed={chosen === i}
                onClick={() => onChoose(i)}
              >
                <RegionThumb
                  content={content}
                  seed={o.seed}
                  region={o.region ?? null}
                  twist={o.twist}
                />
                <span class="card-body">
                  <span class="card-kind">
                    {content.name}
                    {region ? ` · ${region.name}` : ''}
                  </span>
                  {region && region.modifiers.length > 0 && (
                    <span class="card-text">{region.text}</span>
                  )}
                  <span class="card-name">{twist?.name ?? 'Fair Weather'}</span>
                  <span class="card-text">{twist?.text}</span>
                  {request && (
                    <span class="card-text">
                      City request: {request.text} +{bonus} Seeds.
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <button type="button" class="button primary" disabled={!ready} onClick={onSetOut}>
        {ready ? `Set out on run ${city.runs + 1}` : 'Choose an expedition first'}
      </button>
    </section>
  );
}

function LandmarkPanel({ content, city }: { content: Content; city: CityState }) {
  if (content.landmarks.length === 0) return null;
  const standing = standingLandmarks(content, city);
  return (
    <section class="panel" aria-label="Landmarks">
      <h2>Landmarks</h2>
      <ul class="small plain">
        {content.landmarks.map((l) =>
          city.landmarks.includes(l.id) ? (
            <li>
              <strong>{l.name}</strong>
              {standing.includes(l.id) ? '' : ' (broken)'}: {l.text}
            </li>
          ) : (
            <li class="quiet">
              <strong>Undiscovered.</strong> {l.hint}
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

function DistrictGuide({ content }: { content: Content }) {
  const tiers = content.rules.score.tiers;
  return (
    <details class="panel">
      <summary>
        <strong>Districts</strong> <span class="quiet small">what each Graft gives</span>
      </summary>
      <table class="keys small">
        <thead>
          <tr>
            <th>District</th>
            <th>Earned by</th>
            <th>Perk ({tiers.map((t) => t.name).join(' → ')})</th>
            <th>Adds to drafts</th>
          </tr>
        </thead>
        <tbody>
          {content.districts.map((d) => (
            <tr>
              <th>{d.name}</th>
              <td>{d.earnedBy}</td>
              <td>{d.perks.map((p) => p.text).join(' → ')}</td>
              <td>{cardLabel(content, d.adds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function CityReveal({
  content,
  event,
  onClose,
}: {
  content: Content;
  event: CityEvent;
  onClose: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => button.current?.focus(), [event]);
  const landmark =
    event.kind === 'landmark' ? content.landmarks.find((l) => l.id === event.id) : undefined;
  const title = landmark ? landmark.name : 'The Sun Tree';
  return (
    <div class="modal-backdrop">
      <div
        class="modal glass discovery"
        role="dialog"
        aria-modal="true"
        aria-label={landmark ? `Landmark discovered: ${title}` : title}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <span class="combo-jewel" style={{ background: '#E0A33B' }} aria-hidden="true">
          ☼
        </span>
        <span class="card-kind">{landmark ? 'Landmark discovered' : 'The ending'}</span>
        <h2 class="glass-title">{title}</h2>
        <p>
          {landmark
            ? `${landmark.text} It holds in every run while these districts stand together.`
            : 'Every slot is filled and the Heartwood has grown into the Sun Tree. The valley remembers. Runs go on, and Root City with them.'}
        </p>
        <button type="button" class="button primary" ref={button} onClick={onClose}>
          Continue
        </button>
      </div>
    </div>
  );
}
