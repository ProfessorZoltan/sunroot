/**
 * Saves the game's current art as PNGs, for artists to draw over (see
 * docs/ART.md): every tile and building in the frame hand-made art is
 * delivered in, each building also on a tile, a contact sheet and a frame
 * template.
 *
 *   npx tsx scripts/export-art.ts [out-dir]   (default docs/art/current)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

interface Entry {
  kind: 'tile' | 'building' | 'context';
  id: string;
  name: string;
  png: string;
}

const out = process.argv[2] ?? 'docs/art/current';
const server = await createServer({ server: { port: 5199, strictPort: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls!.local[0]!;
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  // tsx names functions with a helper the page lacks; give the page a stand-in.
  await page.addInitScript({ content: 'window.__name = (f) => f;' });
  await page.goto(`${url}?art`);
  await page.waitForFunction(() => 'sunrootArt' in window, null, { timeout: 60_000 });
  const entries = await page.evaluate(
    () => (window as unknown as { sunrootArt: Entry[] }).sunrootArt,
  );
  const folder = { tile: 'tiles', building: 'buildings', context: 'in-context' } as const;
  for (const e of entries) {
    const dir = join(out, folder[e.kind]);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${e.id}.png`), Buffer.from(e.png.split(',')[1]!, 'base64'));
  }

  // A contact sheet and a frame template, drawn with the canvas in the page.
  const images = await page.evaluate(async (entries: Entry[]) => {
    const load = (src: string) =>
      new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = src;
      });
    const font = '600 13px system-ui, sans-serif';
    // Contact sheet: tiles, then each building on its tile, at half the delivery size.
    const cw = 150;
    const ch = 192 + 34;
    const cols = 8;
    // Tiles first, then each building on its tile, each group starting a new row.
    const placed: { e: Entry; col: number; row: number }[] = [];
    let row = 0;
    for (const kind of ['tile', 'context'] as const) {
      const group = entries.filter((e) => e.kind === kind);
      group.forEach((e, i) => placed.push({ e, col: i % cols, row: row + Math.floor(i / cols) }));
      row += Math.ceil(group.length / cols);
    }
    const sheet = document.createElement('canvas');
    sheet.width = cols * cw;
    sheet.height = row * ch;
    const s = sheet.getContext('2d')!;
    s.fillStyle = '#f4ebd6';
    s.fillRect(0, 0, sheet.width, sheet.height);
    s.textAlign = 'center';
    for (const { e, col, row } of placed) {
      const x = col * cw;
      const y = row * ch;
      s.drawImage(await load(e.png), x + (cw - 128) / 2, y, 128, 192);
      s.fillStyle = '#2f3b2e';
      s.font = font;
      s.fillText(e.name, x + cw / 2, y + 192 + 14);
      s.fillStyle = '#5e6b58';
      s.font = '11px ui-monospace, monospace';
      s.fillText(e.id, x + cw / 2, y + 192 + 28);
    }

    // The frame template at delivery size: 256 x 384, tile centre at (128, 240).
    const t = document.createElement('canvas');
    t.width = 256;
    t.height = 384;
    const g = t.getContext('2d')!;
    const cx = 128;
    const cy = 240;
    const hex = (r: number, dy = 0) => {
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 180) * (60 * k - 30);
        const px = cx + r * Math.cos(a);
        const py = cy + dy + r * Math.sin(a);
        if (k === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
    };
    g.fillStyle = '#a0976e';
    hex(116, 18);
    g.fill();
    g.fillStyle = '#e9e1c8';
    hex(116);
    g.fill();
    g.setLineDash([6, 5]);
    g.strokeStyle = '#3f7a3a';
    g.lineWidth = 2;
    hex(88);
    g.stroke();
    g.strokeStyle = '#d9a441';
    g.beginPath();
    g.moveTo(0, cy - 120);
    g.lineTo(256, cy - 120);
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = '#c8553d';
    g.strokeRect(0.5, 0.5, 255, 383);
    g.fillStyle = '#c8553d';
    g.beginPath();
    g.arc(cx, cy, 4, 0, Math.PI * 2);
    g.fill();
    g.font = '600 12px system-ui, sans-serif';
    g.fillStyle = '#2f3b2e';
    g.textAlign = 'center';
    g.fillText('centre (128, 240)', cx, cy + 20);
    g.fillText('footprint: base stays inside', cx, cy - 64);
    g.fillText('usual top (y 120)', cx, cy - 126);
    g.fillText('tall buildings: up to y 0', cx, 18);
    g.fillText('side: 18 px', cx, 372);
    return { sheet: sheet.toDataURL('image/png'), template: t.toDataURL('image/png') };
  }, entries);
  writeFileSync(join(out, 'sheet.png'), Buffer.from(images.sheet.split(',')[1]!, 'base64'));
  writeFileSync(
    join(out, '..', 'template.png'),
    Buffer.from(images.template.split(',')[1]!, 'base64'),
  );
  console.log(`${entries.length} images, a contact sheet and the template in ${out}`);
} finally {
  await browser.close();
  await server.close();
}
