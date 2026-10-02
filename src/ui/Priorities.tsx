/**
 * Prioritize buildings (asked for in playtesting): every building in priority
 * order, to rearrange by dragging (or with the arrow buttons). Priority decides
 * who is staffed first and who is shut off last in a blackout, and breaks ties
 * for water. The panel takes the right column, so the map stays live: clicking
 * a building on the map or in the list highlights it in both.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { GameStore } from '../game/store';
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
  const list = useRef<HTMLOListElement>(null);
  const now = store.insight.now;
  const order = state.priority;
  // Keep the highlighted building in view in the list.
  useEffect(() => {
    if (!store.inspected) return;
    list.current
      ?.querySelector(`[data-uid="${store.inspected}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [store.inspected]);

  const moveTo = (uid: string, to: number) => {
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
        water first when it's shared. Click a building here or on the map to find it.
      </div>
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
              class={`priority-row${store.inspected === uid ? ' selected' : ''}${dragging === uid ? ' dragging' : ''}${over === i && dragging !== null ? ' drop-here' : ''}`}
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
                    onClick={() => moveTo(uid, i - 1)}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    class="icon-button"
                    disabled={i >= order.length - 1}
                    aria-label={`Lower ${def.name}`}
                    onClick={() => moveTo(uid, i + 1)}
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
