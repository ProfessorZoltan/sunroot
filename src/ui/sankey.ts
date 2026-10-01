/**
 * The season report's Sankey diagram, laid out as plain data (tested apart
 * from the drawing). Three columns: what made each resource (and stock drawn
 * from the stores), the resources, and what used them (and stock kept). Built
 * from the season's ledger, which balances, so every resource node's inflow
 * equals its outflow by construction.
 */
import { RESOURCES, type Flows, type Resource } from '../sim';

/** Resource colours, checked with the dataviz validator against the report's surface (#fffbf0). */
export const RESOURCE_COLORS: Record<Resource, string> = {
  materials: '#e87ba4',
  food: '#eda100',
  biomass: '#008300',
  salvage: '#1baf7a',
  compost: '#eb6834',
  knowledge: '#2a78d6',
  scraps: '#4a3aa7',
  clutter: '#e34948',
};

export const FROM_STORES = 'From stores';
export const INTO_STORES = 'Into stores';

export interface SankeyNode {
  id: string;
  label: string;
  column: 0 | 1 | 2;
  /** Units through the node. */
  value: number;
  /** Buildings counted on the line (×3), when more than one. */
  count: number;
  resource?: Resource;
  y: number;
  h: number;
}

export interface SankeyLink {
  source: string;
  target: string;
  resource: Resource;
  value: number;
  /** Where the band leaves its source and reaches its target (top edges), and its width. */
  sy: number;
  ty: number;
  w: number;
}

export interface SankeyLayout {
  nodes: SankeyNode[];
  links: SankeyLink[];
  height: number;
}

export function sankeyLayout(
  flows: Flows,
  options: { pad?: number; minHeight?: number; rowHeight?: number } = {},
): SankeyLayout {
  const pad = options.pad ?? 14;
  const nodes = new Map<string, SankeyNode>();
  const links: SankeyLink[] = [];
  const node = (id: string, label: string, column: 0 | 1 | 2, resource?: Resource) => {
    let n = nodes.get(id);
    if (!n) nodes.set(id, (n = { id, label, column, value: 0, count: 1, resource, y: 0, h: 0 }));
    return n;
  };
  const resources = RESOURCES.filter((r) => {
    const f = flows[r];
    return f && (Object.keys(f.made).length > 0 || Object.keys(f.used).length > 0);
  });
  for (const res of resources) {
    const f = flows[res]!;
    const made = Object.values(f.made).reduce((n, l) => n + l.amount, 0);
    const used = Object.values(f.used).reduce((n, l) => n + l.amount, 0);
    const mid = node(`res:${res}`, res, 1, res);
    const into = (id: string, label: string, amount: number, count = 1) => {
      if (amount <= 0) return;
      const n = node(id, label, 0);
      n.count = Math.max(n.count, count);
      n.value += amount;
      links.push({ source: id, target: mid.id, resource: res, value: amount, sy: 0, ty: 0, w: 0 });
    };
    const out = (id: string, label: string, amount: number, count = 1) => {
      if (amount <= 0) return;
      const n = node(id, label, 2);
      n.count = Math.max(n.count, count);
      n.value += amount;
      links.push({ source: mid.id, target: id, resource: res, value: amount, sy: 0, ty: 0, w: 0 });
    };
    for (const [label, l] of Object.entries(f.made)) into(`src:${label}`, label, l.amount, l.count);
    for (const [label, l] of Object.entries(f.used)) out(`use:${label}`, label, l.amount, l.count);
    // Stock drawn from, or kept in, the stores balances the node.
    into(`src:${FROM_STORES}`, FROM_STORES, used - made);
    out(`use:${INTO_STORES}`, INTO_STORES, made - used);
    mid.value = Math.max(made, used);
  }

  // Order: resources in their usual order; the others by the resources they touch
  // (weighted by amount), so bands cross as little as possible.
  const rank = new Map(resources.map((r, i) => [`res:${r}`, i]));
  const centre = (n: SankeyNode) => {
    const mine = links.filter((l) => l.source === n.id || l.target === n.id);
    const total = mine.reduce((s, l) => s + l.value, 0);
    return (
      mine.reduce((s, l) => s + l.value * rank.get(l.source === n.id ? l.target : l.source)!, 0) /
      Math.max(1, total)
    );
  };
  const columns = ([0, 1, 2] as const).map((c) => {
    const col = [...nodes.values()].filter((n) => n.column === c);
    if (c === 1) return col.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
    return col.sort((a, b) => centre(a) - centre(b) || b.value - a.value);
  });

  const most = Math.max(1, ...columns.map((c) => c.length));
  // Tall enough that every label has a row of its own.
  const height = Math.max(options.minHeight ?? 260, most * (options.rowHeight ?? 26));
  // The largest scale at which every column fits, with each node at least 2 high.
  const fits = (k: number) =>
    columns.every(
      (col) =>
        col.reduce((s, n) => s + Math.max(2, n.value * k), 0) + pad * (col.length - 1) <= height,
    );
  let [lo, hi] = [0, height];
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  const scale = lo;
  for (const col of columns) {
    const used = col.reduce((s, n) => s + Math.max(2, n.value * scale), 0) + pad * (col.length - 1);
    let y = (height - used) / 2;
    for (const n of col) {
      n.y = y;
      n.h = Math.max(2, n.value * scale);
      y += n.h + pad;
    }
  }

  // Stack each node's bands in the order of the nodes at their other ends.
  const yOf = (id: string) => nodes.get(id)!.y;
  for (const n of nodes.values()) {
    const k = n.h / Math.max(1, n.value);
    let out = n.y;
    for (const l of links
      .filter((l) => l.source === n.id)
      .sort((a, b) => yOf(a.target) - yOf(b.target))) {
      l.sy = out;
      l.w = l.value * k;
      out += l.w;
    }
    let inn = n.y;
    for (const l of links
      .filter((l) => l.target === n.id)
      .sort((a, b) => yOf(a.source) - yOf(b.source))) {
      l.ty = inn;
      inn += l.value * k;
    }
  }
  // A band keeps one width: the narrower end's scale, so it fits both nodes.
  for (const l of links) {
    const s = nodes.get(l.source)!;
    const t = nodes.get(l.target)!;
    l.w = Math.min((l.value * s.h) / Math.max(1, s.value), (l.value * t.h) / Math.max(1, t.value));
  }
  return { nodes: [...nodes.values()], links, height };
}
