/**
 * Imports the hand-made art in art/incoming (see its README.md) into the
 * game's art folder, src/art, which the map loads:
 *
 * - every frame at half size (256 x 320; the tile is still 200 px wide, four
 *   times the game's 50), which keeps the textures to about a quarter of the
 *   memory and is sharp at the closest zoom;
 * - for buildings with a night version (`id.lit.png`), only the windows that
 *   light up (`id.windows.png`), so the game can draw them glowing over the night;
 * - connecting pieces (channels, hedgerows) as a hub, `id.png`, and an arm
 *   towards each neighbour, `id.e.png` to `id.se.png`, each with a winter dress;
 * - an icon per building for the interface: the building cropped to a square (a building
 *   delivered only as edge pieces, from its east piece);
 * - `art.json`: the frame's geometry, the rotors' pivots, and which buildings
 *   are drawn with their own tile (their side band is filled in);
 * - a biome's own look for a shared tile type, `id.land.png` (the coast's
 *   headlands, `hill.coast.png`), as delivered;
 * - a delivered icon, `id.icon.png`, in place of the one cropped from the art.
 *
 * - wildlife and festival props (`wildlife/`, `festivals/`), off the standard
 *   frame, at half size like the rest (a 128 px frame becomes 64);
 * - festival cards (`id.card.png`) as WebP at full size, for the interface only.
 *
 * - wonders (`wonders/`, E5) at half size on their own larger frame (three
 *   standard frames wide, two tall), with an icon like a building's.
 *
 * - Root City (`city/`, docs/ART-CITY.md): each district at each tier, the Heartwood's stages
 *   and the Sun Tree on a tall frame (512 x 1024), the empty plot and the landmarks' edge
 *   pieces, at half size; their lit windows alone and their rotors' pivots, as the map's.
 *
 * It reads `tiles/`, `buildings/`, `wildlife/`, `festivals/`, `wonders/` and `city/`.
 *
 *   npx tsx scripts/import-art.ts
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { BIOMES, biomeContent } from '../src/content';
import { TILE_TYPES } from '../src/sim';
import { isTall, parseCityArt } from '../src/game/cityArt';

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

// Art for every biome: they share one art folder.
const biomes = Object.keys(BIOMES).map((id) => biomeContent(id));
const byId = Object.fromEntries(biomes.flatMap((c) => Object.entries(c.byId)));
const manifest = JSON.parse(readFileSync(join(IN, 'manifest.json'), 'utf8')) as Manifest;
const tiles = new Set<string>(TILE_TYPES);
/** Buildings, and pieces drawn with them: the sluice gate at a channel's intake. */
const DECORATIONS = ['sluiceGate'];
const buildings = new Set([...Object.keys(byId), ...DECORATIONS]);
/** A PNG's width and height, from its header. */
function pngSize(path: string): [number, number] {
  const b = readFileSync(path);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
const idOf = (file: string) => file.split('.')[0]!.replace(/-\d+$/, '');
/** A biome's own look for a tile type: `hill.coast.png`, `hill.coast.winter.png`. */
const lands = new Set(biomes.map((c) => c.land));
const inDir = (dir: 'tiles' | 'buildings') =>
  readdirSync(join(IN, dir))
    .filter((f) => f.endsWith('.png'))
    .map((f) => ({ dir, file: f }));
const files = [...inDir('tiles'), ...inDir('buildings')];
const unknown = files.filter(
  ({ dir, file }) => !(dir === 'tiles' ? tiles : buildings).has(idOf(file)),
);
if (unknown.length > 0)
  throw new Error(
    `not a tile type or building id: ${unknown.map((f) => `${f.dir}/${f.file}`).join(', ')}`,
  );

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
  for (const dir of ['tiles', 'buildings', 'icons', 'wildlife', 'festivals', 'wonders', 'city'])
    mkdirSync(join(OUT, dir), { recursive: true });
  const write = (path: string, dataUrl: string) =>
    writeFileSync(join(OUT, path), Buffer.from(dataUrl.split(',')[1]!, 'base64'));

  interface FrameArgs {
    src: string;
    day: string | null;
    fw: number;
    fh: number;
    scale: number;
    band: number;
    icon: number;
    wantGround: boolean;
    wantIcon: boolean;
    wantCentre: boolean;
  }
  /** One frame at half size; its lit windows alone, its own-tile check, icon and rotor pivot. */
  const processFrame = (args: FrameArgs) =>
    page.evaluate(
      async ({ src, day, fw, fh, scale, band, icon, wantGround, wantIcon, wantCentre }) => {
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
        // A rotor's pivot, for one the manifest doesn't give: the centre of its hub, the orange
        // disc the blades turn on (the blades themselves aren't symmetric in this view).
        let centre: [number, number] | null = null;
        if (wantCentre) {
          const data = fg.getImageData(0, 0, fw, fh).data;
          let [sx, sy, n] = [0, 0, 0];
          for (let y = 0; y < fh; y++)
            for (let x = 0; x < fw; x++) {
              const i = (y * fw + x) * 4;
              const [r, g, b, a] = [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!];
              if (a < 200 || r < 180 || g < 110 || g > 190 || b > 90) continue;
              sx += x;
              sy += y;
              n++;
            }
          if (n > 50) centre = [Math.round(sx / n), Math.round(sy / n)];
        }
        return { png: half.toDataURL('image/png'), hasGround, icon: iconUrl, centre };
      },
      args,
    );

  const ground: string[] = [];
  /** Each rotor's measured centre, in the full frame. */
  const centres: Record<string, [number, number]> = {};
  const delivered = files.filter(({ file }) => file.endsWith('.icon.png'));
  for (const { dir, file } of files.filter((f) => !delivered.includes(f))) {
    const id = idOf(file);
    const isTile = dir === 'tiles';
    const lit = file.endsWith('.lit.png');
    const result = await processFrame({
      src: read(join(dir, file)),
      day: lit ? read(join(dir, `${id}.png`)) : null,
      fw,
      fh,
      scale: SCALE,
      band: g.band_bottom,
      icon: ICON,
      wantGround: !isTile && file === `${id}.png`,
      // An edge piece only (the snow fence): its icon from the east piece.
      wantIcon:
        !isTile &&
        !DECORATIONS.includes(id) &&
        (file === `${id}.png` ||
          (file === `${id}.edge.e.png` && !files.some((f) => f.file === `${id}.png`))),
      wantCentre: file === `${id}.rotor.png`,
    });
    const land = file.split('.')[1];
    if (isTile && land !== undefined && !['png', 'winter'].includes(land) && !lands.has(land))
      throw new Error(`not a biome's land: tiles/${file}`);
    if (result.centre) centres[id] = result.centre;
    const name = lit ? `${id}.windows.png` : file;
    write(join(isTile ? 'tiles' : 'buildings', name), result.png);
    if (result.icon) write(join('icons', `${id}.png`), result.icon);
    if (result.hasGround) ground.push(id);
  }

  // Delivered icons, scaled to the interface's size, in place of the cropped ones.
  for (const { dir, file } of delivered) {
    const out = await page.evaluate(
      async ({ src, icon }) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = icon;
        c.height = icon;
        const g = c.getContext('2d')!;
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, icon, icon);
        return c.toDataURL('image/png');
      },
      { src: read(join(dir, file)), icon: ICON },
    );
    write(join('icons', `${idOf(file)}.png`), out);
  }

  // Wildlife and festival props at half size; festival cards as WebP, for the interface.
  // Each animal's art is named by its frames' first part (src/render/wildlifeArt.ts).
  const animals = new Set([
    'wildBees',
    'otter',
    'beaver',
    'deer',
    'tern',
    'seal',
    'puffin',
    'dolphin',
    'hare',
    'dipper',
    'eagle',
    'marten',
    'fennec',
    'sandgrouse',
    'falcon',
    'oryx',
  ]);
  const festivals = new Set([
    ...biomes.flatMap((c) => c.festivals.map((f) => f.id)),
    'bunting',
    'lantern',
  ]);
  let extras = 0;
  for (const dir of ['wildlife', 'festivals'] as const) {
    for (const file of readdirSync(join(IN, dir)).filter((f) => f.endsWith('.png'))) {
      const id = idOf(file);
      if (!(dir === 'wildlife' ? animals : festivals).has(id))
        throw new Error(`not a known ${dir} id: ${dir}/${file}`);
      const card = file.endsWith('.card.png');
      const out = await page.evaluate(
        async ({ src, scale, card }) => {
          const img = new Image();
          img.src = src;
          await img.decode();
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          const g = c.getContext('2d')!;
          g.imageSmoothingQuality = 'high';
          g.drawImage(img, 0, 0, c.width, c.height);
          return card ? c.toDataURL('image/webp', 0.82) : c.toDataURL('image/png');
        },
        { src: read(join(dir, file)), scale: card ? 1 : SCALE, card },
      );
      write(join(dir, card ? file.replace(/\.png$/, '.webp') : file), out);
      extras++;
    }
  }

  // Wonders: half size on their own frame, and an icon from the finished one.
  for (const file of readdirSync(join(IN, 'wonders')).filter((f) => f.endsWith('.png'))) {
    const id = idOf(file);
    if (!byId[id]?.wonder) throw new Error(`not a wonder id: wonders/${file}`);
    const out = await page.evaluate(
      async ({ src, scale, icon, wantIcon }) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        const g = c.getContext('2d')!;
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, c.width, c.height);
        let iconUrl: string | null = null;
        if (wantIcon) {
          const f = document.createElement('canvas');
          f.width = img.width;
          f.height = img.height;
          const fg = f.getContext('2d')!;
          fg.drawImage(img, 0, 0);
          const data = fg.getImageData(0, 0, img.width, img.height).data;
          let [x0, y0, x1, y1] = [img.width, img.height, 0, 0];
          for (let y = 0; y < img.height; y++)
            for (let x = 0; x < img.width; x++)
              if (data[(y * img.width + x) * 4 + 3]! > 16) {
                x0 = Math.min(x0, x);
                x1 = Math.max(x1, x);
                y0 = Math.min(y0, y);
                y1 = Math.max(y1, y);
              }
          const size = Math.max(x1 - x0, y1 - y0) * 1.04;
          const ic = document.createElement('canvas');
          ic.width = icon;
          ic.height = icon;
          const ig = ic.getContext('2d')!;
          ig.imageSmoothingQuality = 'high';
          ig.drawImage(
            f,
            (x0 + x1) / 2 - size / 2,
            (y0 + y1) / 2 - size / 2,
            size,
            size,
            0,
            0,
            icon,
            icon,
          );
          iconUrl = ic.toDataURL('image/png');
        }
        return { png: c.toDataURL('image/png'), icon: iconUrl };
      },
      {
        src: read(join('wonders', file)),
        scale: SCALE,
        icon: ICON,
        wantIcon: file === `${id}.png`,
      },
    );
    write(join('wonders', file), out.png);
    if (out.icon) write(join('icons', `${id}.png`), out.icon);
    extras++;
  }

  // Root City (docs/ART-CITY.md), on the standard frame; the Heartwood and the Sun Tree on a
  // frame 384 px taller, their tile at the bottom.
  const home = biomes[0]!;
  const cityIds = {
    districts: home.districts.map((d) => d.id),
    tiers: home.rules.score.tiers.map((t) => t.id),
    landmarks: home.landmarks.map((l) => l.id),
  };
  const TALL = 384;
  const cityPivots: Record<string, [number, number]> = {};
  const cityFiles = existsSync(join(IN, 'city'))
    ? readdirSync(join(IN, 'city')).filter((f) => f.endsWith('.png'))
    : [];
  for (const file of cityFiles) {
    const art = parseCityArt(file, cityIds);
    if (!art) throw new Error(`not a Root City art name (docs/ART-CITY.md): city/${file}`);
    const tall = isTall(art);
    const size = pngSize(join(IN, 'city', file));
    if (size[0] !== fw || size[1] !== fh + (tall ? TALL : 0))
      throw new Error(`city/${file} is ${size.join(' x ')}, not ${fw} x ${fh + (tall ? TALL : 0)}`);
    const part = 'part' in art ? art.part : 'day';
    const base = file.replace(/\.(lit|rotor)\.png$/, '.png');
    if (part !== 'day' && !cityFiles.includes(base))
      throw new Error(`city/${file} has no ${base} to go with it`);
    const result = await processFrame({
      src: read(join('city', file)),
      day: part === 'lit' ? read(join('city', base)) : null,
      fw,
      fh: fh + (tall ? TALL : 0),
      scale: SCALE,
      band: g.band_bottom,
      icon: ICON,
      wantGround: false,
      // A district's icon, from its highest tier.
      wantIcon: art.kind === 'district' && part === 'day' && art.tier === cityIds.tiers.at(-1),
      wantCentre: part === 'rotor',
    });
    write(
      join('city', part === 'lit' ? file.replace('.lit.png', '.windows.png') : file),
      result.png,
    );
    if (result.icon && art.kind === 'district')
      write(join('icons', `${art.district}.png`), result.icon);
    if (part === 'rotor') {
      if (!result.centre) throw new Error(`city/${file}: no orange hub to turn on`);
      cityPivots[file.replace('.rotor.png', '')] = [
        result.centre[0] * SCALE,
        result.centre[1] * SCALE,
      ];
    }
    extras++;
  }

  const given = Object.fromEntries(
    manifest.assets
      .filter((a) => a.rotation_hub && !a.file.includes('.winter'))
      .map((a) => [idOf(a.file.split('/').pop()!), a.rotation_hub!]),
  );
  // The manifest's pivots where it has them; measured ones for the rest (and a check on both).
  for (const [id, [x, y]] of Object.entries(given)) {
    const m = centres[id];
    if (m && Math.hypot(m[0] - x, m[1] - y) > 4)
      console.warn(
        `${id}: the manifest's pivot (${x}, ${y}) is far from its measured centre (${m[0]}, ${m[1]})`,
      );
  }
  const pivots = Object.fromEntries(
    Object.entries({ ...centres, ...given }).map(([id, [x, y]]) => [id, [x * SCALE, y * SCALE]]),
  );
  for (const id of Object.keys(centres))
    if (!given[id]) console.log(`${id}: rotor pivot measured at (${centres[id]!.join(', ')})`);
  const art = {
    source: `${IN} (see its README.md); made by scripts/import-art.ts`,
    frame: [fw * SCALE, fh * SCALE],
    tileCentre: [g.tile_center[0] * SCALE, g.tile_center[1] * SCALE],
    tileWidth: g.tile_width * SCALE,
    ground: ground.sort(),
    pivots,
    city: {
      tallFrame: [fw * SCALE, (fh + TALL) * SCALE],
      tallTileCentre: [g.tile_center[0] * SCALE, (g.tile_center[1] + TALL) * SCALE],
      pivots: cityPivots,
    },
  };
  writeFileSync(join(OUT, 'art.json'), `${JSON.stringify(art, null, 2)}\n`);
  console.log(
    `${files.length + extras} files into ${OUT}; drawn with their own tile: ${ground.join(', ')}; rotors: ${Object.keys(pivots).join(', ')}`,
  );
} finally {
  await browser.close();
}
