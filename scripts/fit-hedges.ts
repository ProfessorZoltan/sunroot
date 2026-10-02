/**
 * Fits the hedge-along-an-edge drawings (art/incoming/hedgerows_modified)
 * to the standard frame, for scripts/import-art.ts. Each source is a hedge
 * drawn on its own, at its own scale and slant; each guide marks, on a frame
 * twice the standard size, the band along one side of the tile where the
 * hedge stands (DECISIONS.md, Hedgerows on edges).
 *
 * The fit keeps the shrubs upright: column by column, it maps the hedge's
 * fitted bottom and top lines onto the band's, so a drawing slanted at 45°
 * lies along a 30° side without leaning. It writes
 * art/incoming/buildings/hedgerow.edge.{e,ne,nw}[.winter].png (512 x 640).
 *
 *   npx tsx scripts/fit-hedges.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const IN = 'art/incoming/hedgerows_modified';
const OUT = 'art/incoming/buildings';
const SIDES = ['e', 'ne', 'nw'] as const;
const read = (f: string) => `data:image/png;base64,${readFileSync(join(IN, f)).toString('base64')}`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.evaluate('window.__name = (f) => f');
  for (const side of SIDES) {
    for (const season of ['', '.winter']) {
      const png = await page.evaluate(
        async ({ guide, source }) => {
          const load = async (s: string) => {
            const img = new Image();
            img.src = s;
            await img.decode();
            const c = document.createElement('canvas');
            c.width = img.width;
            c.height = img.height;
            const g = c.getContext('2d')!;
            g.drawImage(img, 0, 0);
            return { c, data: g.getImageData(0, 0, c.width, c.height).data };
          };
          /** Per column, the top and bottom of the pixels `hit` picks. */
          const spans = (
            w: number,
            h: number,
            data: Uint8ClampedArray,
            hit: (i: number) => boolean,
          ) => {
            const cols: { x: number; top: number; bottom: number }[] = [];
            for (let x = 0; x < w; x++) {
              let top = -1;
              let bottom = -1;
              for (let y = 0; y < h; y++)
                if (hit((y * w + x) * 4)) {
                  if (top < 0) top = y;
                  bottom = y;
                }
              if (top >= 0) cols.push({ x, top, bottom });
            }
            return cols;
          };
          /** Least squares y = m x + b over the middle 80% of the columns (the ends taper). */
          const line = (pts: { x: number; y: number }[]) => {
            const mid = pts.slice(Math.floor(pts.length * 0.1), Math.ceil(pts.length * 0.9));
            const n = mid.length;
            const sx = mid.reduce((a, p) => a + p.x, 0);
            const sy = mid.reduce((a, p) => a + p.y, 0);
            const sxx = mid.reduce((a, p) => a + p.x * p.x, 0);
            const sxy = mid.reduce((a, p) => a + p.x * p.y, 0);
            const d = n * sxx - sx * sx;
            const m = d === 0 ? 0 : (n * sxy - sx * sy) / d;
            return (x: number) => m * x + (sy - m * sx) / n;
          };
          const g = await load(guide);
          const s = await load(source);
          // The band: the guide's pale fill (and its line), not the white around it.
          const band = spans(g.c.width, g.c.height, g.data, (i) => {
            const [r, gg, b] = [g.data[i]!, g.data[i + 1]!, g.data[i + 2]!];
            return g.data[i + 3]! > 128 && r + gg + b < 720;
          });
          const hedge = spans(s.c.width, s.c.height, s.data, (i) => s.data[i + 3]! > 40);
          const bandTop = line(band.map((c) => ({ x: c.x, y: c.top })));
          const bandBottom = line(band.map((c) => ({ x: c.x, y: c.bottom })));
          const srcTop = line(hedge.map((c) => ({ x: c.x, y: c.top })));
          const srcBottom = line(hedge.map((c) => ({ x: c.x, y: c.bottom })));
          const [bx0, bx1] = [band[0]!.x, band.at(-1)!.x];
          const [sx0, sx1] = [hedge[0]!.x, hedge.at(-1)!.x];
          const out = document.createElement('canvas');
          out.width = g.c.width;
          out.height = g.c.height;
          const og = out.getContext('2d')!;
          og.imageSmoothingQuality = 'high';
          // Column by column: the source column's fitted top-to-bottom onto the band's.
          for (let X = bx0; X <= bx1; X++) {
            const x = sx0 + ((X - bx0) / Math.max(1, bx1 - bx0)) * (sx1 - sx0);
            const [t, b] = [srcTop(x), srcBottom(x)];
            const [T, B] = [bandTop(X), bandBottom(X)];
            const k = (B - T) / Math.max(1, b - t);
            // The whole source column, scaled about its fitted span, so nothing is cut off.
            og.drawImage(
              s.c,
              x,
              0,
              (sx1 - sx0) / Math.max(1, bx1 - bx0),
              s.c.height,
              X,
              T - t * k,
              1,
              s.c.height * k,
            );
          }
          // Down to the standard frame.
          const half = document.createElement('canvas');
          half.width = out.width / 2;
          half.height = out.height / 2;
          const hg = half.getContext('2d')!;
          hg.imageSmoothingQuality = 'high';
          hg.drawImage(out, 0, 0, half.width, half.height);
          return half.toDataURL('image/png');
        },
        {
          guide: read(`guide-${side}.png`),
          source: read(`source-hedgerow.edge.${side}${season}.png`),
        },
      );
      const file = `hedgerow.edge.${side}${season}.png`;
      writeFileSync(join(OUT, file), Buffer.from(png.split(',')[1]!, 'base64'));
      console.log(`wrote ${OUT}/${file}`);
    }
  }
} finally {
  await browser.close();
}
