/** The season report's Sankey layout (src/ui/sankey.ts), on real seasons from a bot's run. */
import { describe, expect, it } from 'vitest';
import { playRun } from '../src/balance/runner';
import { BOTS } from '../src/balance/bots';
import { RESOURCES, type SeasonReport } from '../src/sim';
import { FROM_STORES, INTO_STORES, RESOURCE_COLORS, sankeyLayout } from '../src/ui/sankey';
import { content } from './helpers';

const reports: SeasonReport[] = [];
playRun(content, BOTS.balanced!, 'sankey', {
  onSeason: (s) => {
    if (s.lastReport) reports.push(s.lastReport);
  },
});

describe('the Sankey layout', () => {
  it('has a season to lay out', () => {
    expect(reports.length).toBeGreaterThan(40);
  });

  it('conserves every resource: in = out = the node', () => {
    for (const r of reports) {
      const { nodes, links } = sankeyLayout(r.flows);
      for (const n of nodes.filter((n) => n.column === 1)) {
        const into = links.filter((l) => l.target === n.id).reduce((s, l) => s + l.value, 0);
        const out = links.filter((l) => l.source === n.id).reduce((s, l) => s + l.value, 0);
        expect(into).toBe(out);
        expect(into).toBe(n.value);
      }
    }
  });

  it('shows every line of the ledger, and stock drawn or kept for what it does not explain', () => {
    const r = reports[20]!;
    const { links } = sankeyLayout(r.flows);
    for (const res of RESOURCES) {
      const f = r.flows[res];
      if (!f) continue;
      for (const [label, l] of Object.entries(f.made))
        expect(links).toContainEqual(
          expect.objectContaining({ source: `src:${label}`, resource: res, value: l.amount }),
        );
      for (const [label, l] of Object.entries(f.used))
        expect(links).toContainEqual(
          expect.objectContaining({ target: `use:${label}`, resource: res, value: l.amount }),
        );
      const net =
        Object.values(f.made).reduce((s, l) => s + l.amount, 0) -
        Object.values(f.used).reduce((s, l) => s + l.amount, 0);
      const store = links.find(
        (l) =>
          l.resource === res &&
          (l.source === `src:${FROM_STORES}` || l.target === `use:${INTO_STORES}`),
      );
      expect(store?.value ?? 0).toBe(Math.abs(net));
    }
  });

  it('keeps nodes apart, bands inside their nodes, and everything inside the height', () => {
    for (const r of reports) {
      const { nodes, links, height } = sankeyLayout(r.flows);
      for (const c of [0, 1, 2]) {
        const col = nodes.filter((n) => n.column === c).sort((a, b) => a.y - b.y);
        for (let i = 1; i < col.length; i++)
          expect(col[i]!.y).toBeGreaterThanOrEqual(col[i - 1]!.y + col[i - 1]!.h + 13.99);
        for (const n of col) {
          expect(n.y).toBeGreaterThanOrEqual(-0.01);
          expect(n.y + n.h).toBeLessThanOrEqual(height + 0.01);
        }
      }
      const byId = new Map(nodes.map((n) => [n.id, n]));
      for (const l of links) {
        const s = byId.get(l.source)!;
        const t = byId.get(l.target)!;
        expect(l.sy + l.w).toBeLessThanOrEqual(s.y + s.h + 0.01);
        expect(l.ty + l.w).toBeLessThanOrEqual(t.y + t.h + 0.01);
      }
    }
  });

  it('colours every resource', () => {
    for (const res of RESOURCES) expect(RESOURCE_COLORS[res]).toMatch(/^#[0-9a-f]{6}$/);
  });
});
