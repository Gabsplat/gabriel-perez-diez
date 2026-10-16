// Catálogo de formas. Cada forma devuelve N puntos (x, y, z) normalizados
// alrededor del origen, con la mayor extensión cercana a ±1.
//
// Para sumar una forma nueva alcanza con agregar una entrada a SHAPES usando
// alguno de los generadores: text(), path() o uno paramétrico.

import { balance, character, flask, house, jet, microwave, papers, phenol, ufo } from './icons';

export type Points = Float32Array;

/** Hacia dónde mira el puntero respecto de la forma, entre -1 y 1. */
export interface Look { x: number; y: number; active: boolean }

export interface Shape {
  /** Genera exactamente `n` puntos. */
  build: (n: number) => Points;
  /** Formas vivas: recalcula los puntos en cada cuadro. */
  live?: (pts: Points, n: number, time: number, look: Look) => void;
  /**
   * Letras con carácter fijo (código Unicode, o -1 para dejarla al azar), dibujadas
   * derechas. `hidden` marca las que no se dibujan y puede cambiar en cada cuadro.
   */
  marks?: (n: number) => { chars: Int16Array; flatSize: number; hidden?: Uint8Array };
  /** Gira sobre su eje (formas 3D) en vez de balancearse. */
  spin?: boolean;
  /** Amplitud de flotación de cada letra, en unidades de la forma. */
  float?: number;
  /** Multiplicador de tamaño. */
  scale?: number;
  /** Color de acento [r, g, b]. */
  accent?: [number, number, number];
  /** Color de cada letra: 0 papel, 1 acento, 2 en adelante `palette`. Se pide después de `build`. */
  colors?: (n: number) => Uint8Array;
  /** Colores propios de la forma, a partir del índice 2. */
  palette?: [number, number, number][];
}

const MONO = '700 300px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const SANS = '600 300px Manrope, Arial, sans-serif';

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Muestrea lo que `paint` dibuje en un canvas: mezcla borde y relleno. */
function raster(
  n: number,
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
  edgeRatio = 0.5,
): Points {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = ctx.strokeStyle = '#fff';
  ctx.lineJoin = ctx.lineCap = 'round';
  paint(ctx);
  const data = ctx.getImageData(0, 0, w, h).data;
  const on = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] > 110;

  const fill: number[] = [];
  const edge: number[] = [];
  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (!on(x, y)) continue;
      const border = !on(x - 3, y) || !on(x + 3, y) || !on(x, y - 3) || !on(x, y + 3);
      (border ? edge : fill).push(x, y);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const out = new Float32Array(n * 3);
  if (!fill.length && !edge.length) return scatter(n);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const half = Math.max(maxX - minX, maxY - minY) / 2 || 1;
  for (let i = 0; i < n; i++) {
    const useEdge = edge.length && (!fill.length || Math.random() < edgeRatio);
    const src = useEdge ? edge : fill;
    const k = ((Math.random() * src.length) >> 1) << 1;
    out[i * 3] = (src[k] + rand(-1, 1) - cx) / half;
    out[i * 3 + 1] = (src[k + 1] + rand(-1, 1) - cy) / half;
    out[i * 3 + 2] = rand(-0.07, 0.07);
  }
  return out;
}

/** Texto libre: sirve para palabras y para un solo carácter. */
export function text(value: string, font = SANS): Shape['build'] {
  return (n) => {
    const probe = document.createElement('canvas').getContext('2d')!;
    probe.font = font;
    const m = probe.measureText(value);
    const w = Math.ceil(m.width + 80);
    const h = 460;
    const k = Math.min(1, 1800 / w);
    return raster(n, Math.ceil(w * k), Math.ceil(h * k), (ctx) => {
      ctx.scale(k, k);
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(value, w / 2, h / 2);
    }, 0.45);
  };
}

/** Path SVG en un viewBox de 100×100. `stroke` dibuja solo el trazo. */
export function path(d: string, stroke = 0): Shape['build'] {
  return (n) =>
    raster(n, 500, 500, (ctx) => {
      ctx.scale(5, 5);
      const p = new Path2D(d);
      if (stroke) {
        ctx.lineWidth = stroke;
        ctx.stroke(p);
      } else {
        ctx.fill(p, 'evenodd');
      }
    }, stroke ? 0.25 : 0.55);
}

// ── Paramétricas 3D ─────────────────────────────────────────────────────────

function helix(n: number): Points {
  const out = new Float32Array(n * 3);
  const rungs = 13;
  for (let i = 0; i < n; i++) {
    const kind = i % 5;
    const y = rand(-1.15, 1.15);
    const a = y * 3.6;
    if (kind < 2) {
      // Dos hebras
      const phase = kind * Math.PI;
      out[i * 3] = Math.cos(a + phase) * 0.46 + rand(-0.025, 0.025);
      out[i * 3 + 1] = y;
      out[i * 3 + 2] = Math.sin(a + phase) * 0.46 + rand(-0.025, 0.025);
    } else {
      // Peldaños
      const yr = (Math.round(((y + 1.15) / 2.3) * rungs) / rungs) * 2.3 - 1.15;
      const ar = yr * 3.6;
      const t = rand(-0.42, 0.42);
      out[i * 3] = Math.cos(ar) * t;
      out[i * 3 + 1] = yr;
      out[i * 3 + 2] = Math.sin(ar) * t;
    }
  }
  return out;
}

/** Letras sueltas flotando por toda la pantalla. */
export function scatter(n: number): Points {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    out[i * 3] = rand(-3.4, 3.4);
    out[i * 3 + 1] = rand(-1.9, 1.9);
    out[i * 3 + 2] = rand(-1.2, 1.2);
  }
  return out;
}

const ORANGE: Shape['accent'] = [255, 122, 61];
const BLUE: Shape['accent'] = [108, 172, 228];
const GREEN: Shape['accent'] = [126, 224, 166];
const PINK: Shape['accent'] = [255, 110, 150];
const YELLOW: Shape['accent'] = [255, 208, 92];
const CORAL: [number, number, number] = [255, 138, 118];
const MINT: [number, number, number] = [196, 255, 228];
const SCREEN: [number, number, number] = [110, 240, 210];
const GLASS: [number, number, number] = [150, 214, 255];
const FIRE: [number, number, number] = [255, 128, 56];
const HYDROGEN: [number, number, number] = [214, 232, 255];
const OXYGEN: [number, number, number] = [255, 96, 96];
// Los colores de Nerdconf
const NERD_YELLOW: Shape['accent'] = [255, 222, 74];
const NERD_PINK: [number, number, number] = [255, 92, 170];
const NERD_ORANGE: [number, number, number] = [255, 118, 52];
const NERD_CYAN: [number, number, number] = [92, 200, 222];
const LAB = 0.5;

export const SHAPES: Record<string, Shape> = {
  scatter: { build: scatter, float: 0.2, accent: ORANGE },
  // Bildenlex: propiedad intelectual y derecho. La balanza se mece
  balanza: { ...balance, float: 0.008, accent: BLUE, palette: [YELLOW!] },
  // Legali / LexFlow: hojas que se escriben solas y salen selladas
  papeles: { ...papers, float: 0.008, scale: 1.12, accent: GREEN },
  // Mi Casa Decoraciones: cortinas que se mecen y la chimenea prendida
  casa: { ...house, float: 0.008, accent: YELLOW, palette: [CORAL, GREEN!] },
  // Nerdconf: el OVNI de su sitio, abduciendo a la vaca rosa
  ovni: { ...ufo, float: 0.008, accent: NERD_YELLOW, palette: [NERD_PINK, NERD_ORANGE, NERD_CYAN] },
  // Labs: un matraz que burbujea; al señalar una tarjeta, la forma de ese experimento
  flask: { ...flask, float: 0.008, scale: 0.64, accent: GREEN, palette: [MINT] },
  microwave: { ...microwave, float: 0.006, scale: LAB, accent: YELLOW, palette: [SCREEN, CORAL] },
  jet: { ...jet, float: 0.006, scale: 0.56, accent: BLUE, palette: [GLASS, FIRE] },
  smiley: { ...character, float: 0.006, scale: 0.56, accent: ORANGE, palette: [PINK!] },
  molecule: { ...phenol, spin: true, float: 0.006, scale: 0.56, accent: GREEN, palette: [HYDROGEN, OXYGEN] },
  braces: { build: text('{ }', MONO), float: 0.012, accent: YELLOW },
  helix: { build: helix, spin: true, float: 0.014, scale: 0.9, accent: GREEN },
  at: { build: text('@', SANS), float: 0.012, accent: PINK },
};
