/**
 * Prioritize buildings (asked for in playtesting): every building in priority
 * order, to rearrange by dragging (or with the arrow buttons). Priority decides
 * who is staffed first and who is shut off last in a blackout, and breaks ties
 * for water. The panel takes the right column, so the map stays live: clicking
 * a building on the map or in the list highlights it in both. Several can be
 * chosen (their boxes, Shift for a run of them, or a whole kind) and moved
 * together, and presets sort the list by kind of building.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { KIND_NAMES, PRESETS, applyPreset, moveGroup, nudge, toEnd } from '../game/priorities';
import type { GameStore } from '../game/store';
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
  const now = store.insight.now;
  const order = state.priority;
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
    if (next.some((uid, i) => uid !== order[i]))
      store.dispatch({ type: 'setPriority', order: next });
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
    store.dispatch({ type: 'setPriority', order: next });
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
      <div class="quiet small">
        Drag to rearrange. Higher buildings are staffed first, shut off last in a blackout, and take
        water first when it's shared. Click a building here or on the map to find it. Tick several
        (Shift for a run of them) to move them together.
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
