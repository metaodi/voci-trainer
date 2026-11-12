// Erzeugt die App-Icons (PNG) ohne externe Abhängigkeiten.
// Aufruf: node scripts/erzeuge-icons.ts  (Ergebnis liegt in public/icons/, wird committet)
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

type Farbe = [number, number, number];

const LILA: Farbe = [0x5b, 0x4f, 0xe0];
const LILA_HELL: Farbe = [0x8f, 0x85, 0xff];
const WEISS: Farbe = [0xff, 0xff, 0xff];
const KARTE_HINTEN: Farbe = [0xd9, 0xd4, 0xff];
const GRUEN: Farbe = [0x1d, 0x94, 0x65];

// ---------- Geometrie (Koordinaten 0..1) ----------

function inAbgerundetemRechteck(x: number, y: number, cx: number, cy: number, b: number, h: number, r: number, winkel = 0): boolean {
  const c = Math.cos(-winkel);
  const s = Math.sin(-winkel);
  const dx = x - cx;
  const dy = y - cy;
  const lx = Math.abs(dx * c - dy * s) - (b / 2 - r);
  const ly = Math.abs(dx * s + dy * c) - (h / 2 - r);
  const ax = Math.max(lx, 0);
  const ay = Math.max(ly, 0);
  return Math.hypot(ax, ay) <= r;
}

function abstandZuStrecke(x: number, y: number, x1: number, y1: number, x2: number, y2: number): number {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((x - x1) * vx + (y - y1) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(x - (x1 + t * vx), y - (y1 + t * vy));
}

/** Farbe an einem Punkt; null = transparent. */
function motiv(x: number, y: number, maskierbar: boolean): Farbe | null {
  // Hintergrund
  const hintergrund = maskierbar || inAbgerundetemRechteck(x, y, 0.5, 0.5, 1, 1, 0.22);
  if (!hintergrund) return null;
  // Für maskierbare Icons muss das Motiv in der inneren "Safe Zone" (80 %) liegen
  const k = maskierbar ? 0.8 : 1;
  const mx = (x - 0.5) / k + 0.5;
  const my = (y - 0.5) / k + 0.5;

  // vordere Karte mit Haken
  if (inAbgerundetemRechteck(mx, my, 0.46, 0.56, 0.54, 0.38, 0.06, -0.1)) {
    const d = Math.min(abstandZuStrecke(mx, my, 0.35, 0.56, 0.43, 0.64), abstandZuStrecke(mx, my, 0.43, 0.64, 0.58, 0.47));
    if (d < 0.035) return GRUEN;
    return WEISS;
  }
  // hintere Karte (gedreht)
  if (inAbgerundetemRechteck(mx, my, 0.56, 0.44, 0.5, 0.36, 0.06, 0.22)) {
    return KARTE_HINTEN;
  }
  // leichter Verlauf im Hintergrund
  const t = Math.min(1, Math.max(0, (x + y) / 2));
  return [0, 1, 2].map((i) => Math.round(LILA_HELL[i] + (LILA[i] - LILA_HELL[i]) * t)) as Farbe;
}

// ---------- PNG schreiben ----------

const CRC_TABELLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABELLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(typ: string, daten: Buffer): Buffer {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length);
  const typUndDaten = Buffer.concat([Buffer.from(typ, 'ascii'), daten]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typUndDaten));
  return Buffer.concat([laenge, typUndDaten, crc]);
}

function png(groesse: number, maskierbar: boolean): Buffer {
  const SS = 4; // Supersampling für glatte Kanten
  const roh = Buffer.alloc((groesse * 4 + 1) * groesse);
  for (let py = 0; py < groesse; py++) {
    roh[py * (groesse * 4 + 1)] = 0; // Filter: keiner
    for (let px = 0; px < groesse; px++) {
      let [r, g, b, a] = [0, 0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const f = motiv((px + (sx + 0.5) / SS) / groesse, (py + (sy + 0.5) / SS) / groesse, maskierbar);
          if (!f) continue;
          r += f[0];
          g += f[1];
          b += f[2];
          a++;
        }
      }
      const o = py * (groesse * 4 + 1) + 1 + px * 4;
      roh[o] = a ? Math.round(r / a) : 0;
      roh[o + 1] = a ? Math.round(g / a) : 0;
      roh[o + 2] = a ? Math.round(b / a) : 0;
      roh[o + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(groesse, 0);
  ihdr.writeUInt32BE(groesse, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(roh, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const ziel = new URL('../public/icons/', import.meta.url);
mkdirSync(ziel, { recursive: true });
const dateien: [string, number, boolean][] = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true],
  ['favicon-32.png', 32, false],
];
for (const [name, groesse, maskierbar] of dateien) {
  writeFileSync(new URL(name, ziel), png(groesse, maskierbar));
  console.log(`✓ public/icons/${name}`);
}
