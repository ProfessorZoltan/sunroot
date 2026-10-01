/**
 * A Sankey diagram for the season report: what made each group's units on
 * the left (a resource, or a slot's energy and heat), the groups in the
 * middle, what used them on the right. Band widths are amounts. Hovering or
 * focusing a node or band shows its numbers and highlights its bands; the
 * tables below the diagrams hold every value.
 */
import { useRef, useState } from 'preact/hooks';
import { SHORT } from '../sim';
import {
  FROM_STORES,
  INTO_STORES,
  sankeyLayout,
  type SankeyGroup,
  type SankeyLink,
  type SankeyNode,
} from './sankey';

const WIDTH = 960;
const NODE = 10;
const X = [200, 450, 680] as const;
/** Room above and below for the labels of the first and last nodes. */
const MARGIN = 10;

function bandPath(l: SankeyLink, x0: number, x1: number): string {
  const xm = (x0 + x1) / 2;
  const [a, b] = [l.sy, l.ty];
  const w = l.w;
  return (
    `M${x0},${a} C${xm},${a} ${xm},${b} ${x1},${b} ` +
    `L${x1},${b + w} C${xm},${b + w} ${xm},${a + w} ${x0},${a + w} Z`
  );
}

interface Tip {
  x: number;
  y: number;
  value: string;
  text: string;
}

export function SankeyDiagram({
  groups,
  label,
  unit,
}: {
  groups: SankeyGroup[];
  /** What the diagram shows, for screen readers. */
  label: string;
  /** What a middle node's tooltip calls its flow ("made and used"). */
  unit: string;
}) {
  const layout = sankeyLayout(groups);
  const groupOf = new Map(groups.map((g) => [g.key, g]));
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  const [focus, setFocus] = useState<{ node?: string; link?: number } | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const box = useRef<HTMLDivElement>(null);
  if (layout.links.length === 0) return null;

  const nameOf = (n: SankeyNode) => n.label;
  const lit = (l: SankeyLink, i: number) =>
    !focus ||
    focus.link === i ||
    (focus.node !== undefined && (l.source === focus.node || l.target === focus.node));
  const at = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const nodeTip = (n: SankeyNode): Omit<Tip, 'x' | 'y'> => {
    if (n.column === 1) {
      const g = groupOf.get(n.group!)!;
      const made = Object.values(g.made).reduce((s, l) => s + l.amount, 0);
      const used = Object.values(g.used).reduce((s, l) => s + l.amount, 0);
      return { value: `+${made} −${used}`, text: `${nameOf(n)} ${unit}` };
    }
    const into = layout.links.filter((l) => l.source === n.id || l.target === n.id);
    return {
      value: String(n.value),
      text: `${n.label}: ${into.map((l) => `${l.value} ${groupOf.get(l.group)!.label.toLowerCase()}`).join(', ')}`,
    };
  };
  const show = (node: SankeyNode, where: { x: number; y: number }) => {
    setFocus({ node: node.id });
    setTip({ ...where, ...nodeTip(node) });
  };
  const clear = () => {
    setFocus(null);
    setTip(null);
  };
  const scale = (x: number) => (x / WIDTH) * (box.current?.clientWidth ?? WIDTH);
  const scaleY = (y: number) => scale(y + MARGIN);

  return (
    <div class="sankey" ref={box} onPointerLeave={clear}>
      <svg
        viewBox={`0 ${-MARGIN} ${WIDTH} ${layout.height + 2 * MARGIN}`}
        role="img"
        aria-label={label}
      >
        <g>
          {layout.links.map((l, i) => {
            const s = byId.get(l.source)!;
            const t = byId.get(l.target)!;
            return (
              <path
                class="sankey-band"
                d={bandPath(l, X[s.column] + NODE, X[t.column])}
                fill={groupOf.get(l.group)!.color}
                fill-opacity={focus ? (lit(l, i) ? 0.6 : 0.08) : 0.32}
                onPointerMove={(e) => {
                  setFocus({ link: i });
                  setTip({
                    ...at(e),
                    value: String(l.value),
                    text: `${nameOf(s)} → ${nameOf(t)}`,
                  });
                }}
              />
            );
          })}
        </g>
        {layout.nodes.map((n) => {
          const x = X[n.column];
          const store = n.label === FROM_STORES || n.label === INTO_STORES;
          const short = n.label === SHORT;
          const label = `${nameOf(n)}${n.count > 1 ? ` ×${n.count}` : ''}`;
          const textX = n.column === 0 ? x - 8 : x + NODE + 8;
          return (
            <g
              class="sankey-node"
              tabIndex={0}
              role="button"
              aria-label={`${label}: ${nodeTip(n).value}`}
              onPointerMove={(e) => show(n, at(e))}
              onFocus={() => show(n, { x: scale(textX), y: scaleY(n.y + n.h / 2) })}
              onBlur={clear}
            >
              <rect
                x={x}
                y={n.y}
                width={NODE}
                height={n.h}
                rx={2}
                fill={n.color ?? (short ? '#a3401f' : store ? '#cdbb92' : '#8b9386')}
              />
              <text
                x={textX}
                y={n.y + n.h / 2}
                dy="0.35em"
                text-anchor={n.column === 0 ? 'end' : 'start'}
                class={`sankey-label${n.column === 1 ? ' resource' : ''}${store ? ' store' : ''}${short ? ' short' : ''}`}
              >
                {label}
                <tspan class="sankey-value"> {n.value}</tspan>
              </text>
            </g>
          );
        })}
      </svg>
      {tip && (
        <div class="sankey-tip" style={{ left: `${tip.x + 12}px`, top: `${tip.y + 12}px` }}>
          <strong>{tip.value}</strong>
          <span>{tip.text}</span>
        </div>
      )}
    </div>
  );
}
