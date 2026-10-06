/**
 * Prioritize buildings (asked for in playtesting): every building in priority
 * order, to rearrange by dragging (or with the arrow buttons). Priority decides
 * who is staffed first and who is shut off last in a blackout, and breaks ties
 * for water. The panel takes the right column, so the map stays live: clicking
 * a building on the map or in the list highlights it in both. Several can be
 * chosen (their boxes, Shift for a run of them, or a whole kind) and moved
 * together, and presets sort the list by kind of building.
 *
 * Workers, energy, water, heat and cooling can each have a list of their own
 * (asked for after): a tab for each shows its order, the main list's until it is
 * rearranged there, and "Use the main list" lets it follow the main one again.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { KIND_NAMES, PRESETS, applyPreset, moveGroup, nudge, toEnd } from '../game/priorities';
import type { GameStore } from '../game/store';
import { priorityFor, waterOn, type PriorityKind } from '../sim';
import type { BuildingKind } from '../sim/content/schema';
import type { MapView } from '../render/mapView';
import type { Ui } from './RightPanel';

export function PrioritiesPanel({
  store,
  ui,
  view,
  onClose,
}: {
  store: GameStore;
  ui: Ui;
  view: () => MapView | null;
  onClose: () => void;
}) {
  const { state } = store;
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const [kind, setKind] = useState<PriorityKind | null>(null);
  const now = store.insight.now;
  // The needs this run has: water with the water layer, heat and cooling where anything needs it.
  const needed = (of: 'heat' | 'cool') =>
    store.rules.buildings.some((d) =>
      (['day', 'night'] as const).some((slot) => d.demand?.[of][slot].some((n) => n > 0)),
    );
  const needs = LISTS.filter(
    (l) =>
      (l.kind !== 'water' || waterOn(store.rules)) &&
      (l.kind !== 'heat' || needed('heat')) &&
      (l.kind !== 'cooling' || needed('cool')),
  );
  const own = kind !== null && state.priorities?.[kind] !== undefined;
  const order = kind ? priorityFor(state, kind) : state.priority;
  const kindOf = (uid: string): BuildingKind | undefined => {
    const b = state.buildings[uid];
    return b ? store.rules.byId[b.type]?.kind : undefined;
  };
  // Only buildings still standing (and never the camp) count as chosen.
  const picked = new Set(order.filter((uid, i) => i > 0 && chosen.has(uid)));
  const kinds = (Object.keys(KIND_NAMES) as BuildingKind[]).filter((k) =>
    order.some((uid, i) => i > 0 && kindOf(uid) === k),
  );
  const setOrder = (next: string[]) => {
    if (!next.some((uid, i) => uid !== order[i])) return;
    if (kind) store.dispatch({ type: 'setPriority', order: next, kind });
    else store.dispatch({ type: 'setPriority', order: next });
  };
  /** Ticks a box; with Shift, every row from the last box ticked to this one. */
  const toggle = (uid: string, range: boolean) => {
    const next = new Set(picked);
    const on = !picked.has(uid);
    if (range && anchor !== null && order.includes(anchor)) {
      const [a, b] = [order.indexOf(anchor), order.indexOf(uid)].sort((x, y) => x - y);
      for (const id of order.slice(Math.max(1, a!), b! + 1)) {
        if (on) next.add(id);
        else next.delete(id);
      }
    } else if (on) next.add(uid);
    else next.delete(uid);
    setChosen(next);
    setAnchor(uid);
  };
  const chooseKind = (kind: BuildingKind) => {
    const all = order.filter((uid, i) => i > 0 && kindOf(uid) === kind);
    const every = all.every((uid) => picked.has(uid));
    const next = new Set(picked);
    for (const uid of all) {
      if (every) next.delete(uid);
      else next.add(uid);
    }
    setChosen(next);
  };
  // Keep the highlighted building in view in the list.
  useEffect(() => {
    if (!store.inspected) return;
    list.current
      ?.querySelector(`[data-uid="${store.inspected}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [store.inspected]);

  const moveTo = (uid: string, to: number) => {
    // A chosen building brings the others chosen with it.
    if (picked.has(uid) && picked.size > 1) return setOrder(moveGroup(order, picked, to));
    const from = order.indexOf(uid);
    // The Founders' Camp stays first.
    const target = Math.max(1, Math.min(order.length - 1, to));
    if (from < 1 || from === target) return;
    const next = [...order];
    next.splice(from, 1);
    next.splice(target, 0, uid);
    setOrder(next);
  };
  const select = (uid: string) => {
    store.inspect(uid);
    const b = state.buildings[uid];
    if (b) view()?.ensureVisible(b.at);
  };

  return (
    <aside class="side priorities" aria-label="Prioritize buildings">
      <div class="section-head">
        <h2>Prioritize buildings</h2>
        <button type="button" class="button small-button" onClick={onClose}>
          Done
        </button>
      </div>
      <div class="priority-tools priority-lists" role="tablist" aria-label="Priority list">
        <span class="small">List:</span>
        {[{ kind: null, name: 'Main' } as const, ...needs].map((l) => {
          const on = kind === l.kind;
          const custom = l.kind !== null && state.priorities?.[l.kind] !== undefined;
          return (
            <button
              key={l.kind ?? 'main'}
              type="button"
              role="tab"
              class={`chip${on ? ' on' : ''}`}
              aria-selected={on}
              title={l.kind ? `${LIST_TEXT[l.kind]}${custom ? '' : ' Follows the main list.'}` : ''}
              onClick={() => setKind(l.kind)}
            >
              {l.name}
              {custom && <span aria-label=" (its own order)"> •</span>}
            </button>
          );
        })}
      </div>
      <div class="quiet small">
        {kind === null ? (
          <>
            Drag to rearrange. Higher buildings are staffed first, shut off last in a blackout, and
            take water, heat and cooling first, unless that need has a list of its own. Click a
            building here or on the map to find it. Tick several (Shift for a run of them) to move
            them together.
          </>
        ) : own ? (
          <>
            {LIST_TEXT[kind]} Its own order: the main list no longer decides it.{' '}
            <button
              type="button"
              class="link small"
              onClick={() => store.dispatch({ type: 'setPriority', kind, order: null })}
            >
              Use the main list
            </button>
          </>
        ) : (
          <>
            {LIST_TEXT[kind]} It follows the main list; rearrange it here to give it an order of its
            own.
          </>
        )}
      </div>
      <div class="priority-tools" role="group" aria-label="Presets">
        <span class="small">Sort:</span>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            class="chip"
            title={`${p.text} Within a kind, buildings keep their order.`}
            onClick={() => setOrder(applyPreset(order, kindOf, p))}
          >
            {p.name}
          </button>
        ))}
      </div>
      <div class="priority-tools" role="group" aria-label="Choose by kind">
        <span class="small">Choose:</span>
        {kinds.map((k) => {
          const all = order.filter((uid, i) => i > 0 && kindOf(uid) === k);
          const on = all.every((uid) => picked.has(uid));
          return (
            <button
              key={k}
              type="button"
              class={`chip${on ? ' on' : ''}`}
              aria-pressed={on}
              onClick={() => chooseKind(k)}
            >
              {KIND_NAMES[k]}
            </button>
          );
        })}
      </div>
      {picked.size > 0 && (
        <div class="priority-tools chosen" role="group" aria-label="Move the chosen buildings">
          <span class="small">
            <strong>{picked.size}</strong> chosen:
          </span>
          <button type="button" class="chip" onClick={() => setOrder(toEnd(order, picked, 'top'))}>
            To the top
          </button>
          <button type="button" class="chip" onClick={() => setOrder(nudge(order, picked, -1))}>
            Up
          </button>
          <button type="button" class="chip" onClick={() => setOrder(nudge(order, picked, 1))}>
            Down
          </button>
          <button
            type="button"
            class="chip"
            onClick={() => setOrder(toEnd(order, picked, 'bottom'))}
          >
            To the bottom
          </button>
          <button type="button" class="link small" onClick={() => setChosen(new Set())}>
            Clear
          </button>
        </div>
      )}
      <ol class="priority-list" ref={list}>
        {order.map((uid, i) => {
          const b = state.buildings[uid];
          if (!b) return null;
          const def = store.rules.byId[b.type]!;
          const fixed = i === 0;
          const notes = [
            now.unstaffed.includes(uid) ? 'no worker' : null,
            now.blackouts.includes(uid) ? 'shut off' : null,
            kind === 'water' && now.water?.uses[uid]?.short ? 'short of water' : null,
            kind === 'heat' && now.cold.includes(uid) ? 'cold' : null,
            kind === 'cooling' && (now.hot ?? []).includes(uid) ? 'hot' : null,
            b.damage ? 'damaged' : null,
          ].filter((n) => n !== null);
          return (
            <li
              key={uid}
              data-uid={uid}
              class={`priority-row${store.inspected === uid ? ' selected' : ''}${picked.has(uid) ? ' chosen' : ''}${dragging === uid || (dragging !== null && picked.has(dragging) && picked.has(uid)) ? ' dragging' : ''}${over === i && dragging !== null ? ' drop-here' : ''}`}
              draggable={!fixed}
              aria-current={store.inspected === uid ? 'true' : undefined}
              onDragStart={(e) => {
                setDragging(uid);
                e.dataTransfer?.setData('text/plain', uid);
                if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                setOver(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragging ?? e.dataTransfer?.getData('text/plain');
                if (from) moveTo(from, i);
                setDragging(null);
                setOver(null);
              }}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
            >
              {fixed ? (
                <span class="priority-check" />
              ) : (
                <input
                  type="checkbox"
                  class="priority-check"
                  checked={picked.has(uid)}
                  aria-label={`Choose ${def.name}`}
                  onClick={(e) => toggle(uid, e.shiftKey)}
                />
              )}
              <span class="priority-rank">{i + 1}</span>
              <button
                type="button"
                class="priority-name"
                onClick={() => select(uid)}
                aria-label={`${def.name}, priority ${i + 1}${notes.length ? `, ${notes.join(', ')}` : ''}`}
              >
                {ui.icons[b.type] && <img src={ui.icons[b.type]} alt="" width={22} height={22} />}
                <span>{def.name}</span>
                {notes.length > 0 && <span class="bad small">{notes.join(', ')}</span>}
              </button>
              {!fixed && (
                <span class="priority-moves">
                  <button
                    type="button"
                    class="icon-button"
                    disabled={i <= 1}
                    aria-label={`Raise ${def.name}`}
                    onClick={() =>
                      picked.has(uid) ? setOrder(nudge(order, picked, -1)) : moveTo(uid, i - 1)
                    }
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    class="icon-button"
                    disabled={i >= order.length - 1}
                    aria-label={`Lower ${def.name}`}
                    onClick={() =>
                      picked.has(uid) ? setOrder(nudge(order, picked, 1)) : moveTo(uid, i + 1)
                    }
                  >
                    ▼
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

/** The needs with a list of their own, in the order the tabs show them. */
const LISTS: { kind: PriorityKind; name: string }[] = [
  { kind: 'workers', name: 'Workers' },
  { kind: 'energy', name: 'Energy' },
  { kind: 'water', name: 'Water' },
  { kind: 'heat', name: 'Heat' },
  { kind: 'cooling', name: 'Cooling' },
];

/** What each need's list decides. */
const LIST_TEXT: Record<PriorityKind, string> = {
  workers: 'Who is staffed first when there are too few workers.',
  energy: 'Who is shut off last in a blackout, and whose runs use spare energy first.',
  water: 'Who takes water first when it is shared at the same distance.',
  heat: 'Who is warmed first when heat is short: the last go cold.',
  cooling: 'Who is cooled first when cooling is short: the last go hot.',
};
