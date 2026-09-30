/**
 * Tooltips that show the math. Any element can offer one on hover and on
 * keyboard focus; they render on a fixed layer so panels never clip them.
 */
import { createContext, type ComponentChildren } from 'preact';
import { useContext, useLayoutEffect, useRef, useState } from 'preact/hooks';

interface TipState {
  rect: DOMRect;
  /** Rendered on every update, so an open tooltip stays live. */
  render: () => ComponentChildren;
}

const TipContext = createContext<(tip: TipState | null) => void>(() => {});

export function TipProvider({ children }: { children: ComponentChildren }) {
  const [tip, setTip] = useState<TipState | null>(null);
  return (
    <TipContext.Provider value={setTip}>
      {children}
      {tip && <TipLayer tip={tip} />}
    </TipContext.Provider>
  );
}

/** Event handlers that show `content()` next to the element. */
export function useTip(content: () => ComponentChildren) {
  const set = useContext(TipContext);
  const show = (e: Event) =>
    set({ rect: (e.currentTarget as HTMLElement).getBoundingClientRect(), render: content });
  const hide = () => set(null);
  return { onMouseEnter: show, onMouseLeave: hide, onFocus: show, onBlur: hide };
}

function TipLayer({ tip }: { tip: TipState }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: tip.rect.left, top: tip.rect.bottom + 8 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.max(8, Math.min(tip.rect.left, window.innerWidth - w - 8));
    const below = tip.rect.bottom + 8;
    const top = below + h > window.innerHeight - 8 ? Math.max(8, tip.rect.top - h - 8) : below;
    setPos({ left, top });
  }, [tip]);
  return (
    <div
      ref={ref}
      class="tip"
      role="tooltip"
      style={{ left: `${pos.left}px`, top: `${pos.top}px` }}
    >
      {tip.render()}
    </div>
  );
}

export interface Row {
  label: string;
  amount: number | string;
  tone?: 'good' | 'bad' | 'quiet';
}

/** A small table of signed amounts, optionally with a total line. */
export function TipTable({ title, rows, total }: { title?: string; rows: Row[]; total?: Row }) {
  return (
    <div class="tip-table">
      {title && <div class="tip-title">{title}</div>}
      {rows.length === 0 && <div class="quiet">Nothing this season.</div>}
      {rows.map((r) => (
        <div class={`tip-row ${r.tone ?? ''}`}>
          <span>{r.label}</span>
          <span>{signed(r.amount)}</span>
        </div>
      ))}
      {total && (
        <div class={`tip-row total ${total.tone ?? ''}`}>
          <span>{total.label}</span>
          <span>{signed(total.amount)}</span>
        </div>
      )}
    </div>
  );
}

export function signed(n: number | string): string {
  if (typeof n === 'string') return n;
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
}
