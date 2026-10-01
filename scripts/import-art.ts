/**
 * Imports the hand-made art in art/incoming (see its README.md) into the
 * game's art folder, src/art, which the map loads:
 *
 * - every frame at half size (256 x 320; the tile is still 200 px wide, four
 *   times the game's 50), which keeps the textures to about a quarter of the
 *   memory and is sharp at the closest zoom;
 * - for homes with a night version (`id.lit.png`), only the windows that light
 *   up (`id.windows.png`), so the game can draw them glowing over the night;
 * - an icon per building for the interface: the building cropped to a square;
 * - `art.json`: the frame's geometry, the rotors' pivots, and which buildings
 *   are drawn with their own tile (their side band is filled in).
 *
 *   npx tsx scripts/import-art.ts
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import willowReach from '../src/content/willow-reach.json';
import { loadContent, TILE_TYPES } from '../src/sim';

const IN = 'art/incoming';
const OUT = 'src/art';
const SCALE = 0.5;
const ICON = 96;

interface Manifest {
  geometry: {
    frame: [number, number];
    tile_center: [number, number];
    tile_width: number;
    band_bottom: number;
  };
  assets: { file: string; rotation_hub?: [number, number] }[];
}

const content = loadContent(willowReach);
const manifest = JSON.parse(readFileSync(join(IN, 'manifest.json'), 'utf8')) as Manifest;
const files = readdirSync(IN).filter((f) => f.endsWith('.png'));
const tiles = new Set<string>(TILE_TYPES);
const buildings = new Set(content.buildings.map((b) => b.id));
const idOf = (file: string) => file.split('.')[0]!.replace(/-\d+$/, '');
const unknown = files.filter((f) => !tiles.has(idOf(f)) && !buildings.has(idOf(f)));
if (unknown.length > 0) throw new Error(`not a tile type or building id: ${unknown.join(', ')}`);

const g = manifest.geometry;
const [fw, fh] = g.frame;
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  // tsx names functions with a helper the page lacks; give the page a stand-in.
  await page.evaluate('window.__name = (f) => f');
  const read = (f: string) =>
    `data:image/png;base64,${readFileSync(join(IN, f)).toString('base64')}`;

  rmSync(OUT, { recursive: true, force: true });
  for (const dir of ['tiles', 'buildings', 'icons']) mkdirSync(join(OUT, dir), { recursive: true });
  const write = (path: string, dataUrl: string) =>
    writeFileSync(join(OUT, path), Buffer.from(dataUrl.split(',')[1]!, 'base64'));

  const ground: string[] = [];
  for (const file of files) {
    const id = idOf(file);
    const isTile = tiles.has(id);
    const lit = file.endsWith('.lit.png');
    const result = await page.evaluate(
      async ({ src, day, fw, fh, scale, band, icon, wantGround, wantIcon }) => {
        const load = async (s: string) => {
          const img = new Image();
          img.src = s;
          await img.decode();
          return img;
        };
        const img = await load(src);
        const full = document.createElement('canvas');
        full.width = fw;
        full.height = fh;
        const fg = full.getContext('2d')!;
        fg.drawImage(img, 0, 0);
        let source: HTMLCanvasElement = full;
        if (day) {
          // Only what the night version adds: pixels that differ from the day sprite, softly.
          const d = document.createElement('canvas');
          d.width = fw;
          d.height = fh;
          const dg = d.getContext('2d')!;
          dg.drawImage(await load(day), 0, 0);
          const a = fg.getImageData(0, 0, fw, fh);
          const b = dg.getImageData(0, 0, fw, fh).data;
          for (let i = 0; i < a.data.length; i += 4) {
            // Lit windows are much brighter than by day; the rest differs only by a shade.
            const brighter =
              a.data[i]! +
              a.data[i + 1]! -
              (b[i]! + b[i + 1]!) -
              Math.max(0, a.data[i + 2]! - b[i + 2]!);
            a.data[i + 3] = Math.round(
              a.data[i + 3]! * Math.min(1, Math.max(0, (brighter - 90) / 90)),
            );
          }
          const w = document.createElement('canvas');
          w.width = fw;
          w.height = fh;
          w.getContext('2d')!.putImageData(a, 0, 0);
          source = w;
        }
        const half = document.createElement('canvas');
        half.width = Math.round(fw * scale);
        half.height = Math.round(fh * scale);
        const hg = half.getContext('2d')!;
        hg.imageSmoothingQuality = 'high';
        hg.drawImage(source, 0, 0, half.width, half.height);

        // Drawn with its own tile: the side band, just above its bottom, is filled in.
        let hasGround = false;
        if (wantGround) {
          const px = fg.getImageData(fw / 2, band - 10, 1, 1).data;
          hasGround = px[3]! > 128;
        }
        let iconUrl: string | null = null;
        if (wantIcon) {
          // The icon: the opaque part, cropped to a square with a little margin.
          const data = fg.getImageData(0, 0, fw, fh).data;
          let [x0, y0, x1, y1] = [fw, fh, 0, 0];
          for (let y = 0; y < fh; y++)
            for (let x = 0; x < fw; x++)
              if (data[(y * fw + x) * 4 + 3]! > 16) {
                x0 = Math.min(x0, x);
                x1 = Math.max(x1, x);
                y0 = Math.min(y0, y);
                y1 = Math.max(y1, y);
              }
          const size = Math.max(x1 - x0, y1 - y0) * 1.08;
          const c = document.createElement('canvas');
          c.width = icon;
          c.height = icon;
          const cg = c.getContext('2d')!;
          cg.imageSmoothingQuality = 'high';
          cg.drawImage(
            full,
            (x0 + x1) / 2 - size / 2,
            (y0 + y1) / 2 - size / 2,
            size,
            size,
            0,
            0,
            icon,
            icon,
          );
          iconUrl = c.toDataURL('image/png');
        }
        return { png: half.toDataURL('image/png'), hasGround, icon: iconUrl };
      },
      {
        src: read(file),
        day: lit ? read(`${id}.png`) : null,
        fw,
        fh,
        scale: SCALE,
        band: g.band_bottom,
        icon: ICON,
        wantGround: !isTile && file === `${id}.png`,
        wantIcon: !isTile && file === `${id}.png`,
      },
    );
    const name = lit ? `${id}.windows.png` : file;
    write(join(isTile ? 'tiles' : 'buildings', name), result.png);
    if (result.icon) write(join('icons', `${id}.png`), result.icon);
    if (result.hasGround) ground.push(id);
  }

  const pivots = Object.fromEntries(
    manifest.assets
      .filter((a) => a.rotation_hub && !a.file.includes('.winter'))
      .map((a) => [
        idOf(a.file.split('/').pop()!),
        [a.rotation_hub![0] * SCALE, a.rotation_hub![1] * SCALE],
      ]),
  );
  const art = {
    source: `${IN} (see its README.md); made by scripts/import-art.ts`,
    frame: [fw * SCALE, fh * SCALE],
    tileCentre: [g.tile_center[0] * SCALE, g.tile_center[1] * SCALE],
    tileWidth: g.tile_width * SCALE,
    ground: ground.sort(),
    pivots,
  };
  writeFileSync(join(OUT, 'art.json'), `${JSON.stringify(art, null, 2)}\n`);
  console.log(
    `${files.length} files into ${OUT}; drawn with their own tile: ${ground.join(', ')}; rotors: ${Object.keys(pivots).join(', ')}`,
  );
} finally {
  await browser.close();
}
