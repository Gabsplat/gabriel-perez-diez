// Catálogo de formas. Cada forma devuelve N puntos (x, y, z) normalizados
// alrededor del origen, con la mayor extensión cercana a ±1.
//
// Para sumar una forma nueva alcanza con agregar una entrada a SHAPES usando
// alguno de los generadores: text(), path() o uno paramétrico.

import { scene } from './scene';

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
}

const SERIF = '400 300px Instrument, Georgia, serif';
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

/** Metano: un átomo central, cuatro alrededor y sus enlaces. */
function molecule(n: number): Points {
  const out = new Float32Array(n * 3);
  const arms = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((v) => v.map((c) => (c / Math.sqrt(3)) * 0.95));
  for (let i = 0; i < n; i++) {
    const kind = i % 10;
    // Punto al azar sobre una esfera
    const y = rand(-1, 1), a = rand(0, Math.PI * 2), r = Math.sqrt(1 - y * y);
    const sx = Math.cos(a) * r, sz = Math.sin(a) * r;
    let x = 0, py = 0, z = 0;
    if (kind < 3) {
      x = sx * 0.34; py = y * 0.34; z = sz * 0.34;
    } else {
      const arm = arms[i % 4];
      if (kind < 8) {
        x = arm[0] + sx * 0.2; py = arm[1] + y * 0.2; z = arm[2] + sz * 0.2;
      } else {
        const t = rand(0.35, 0.8);
        x = arm[0] * t + rand(-0.02, 0.02); py = arm[1] * t + rand(-0.02, 0.02); z = arm[2] * t;
      }
    }
    out[i * 3] = x; out[i * 3 + 1] = py; out[i * 3 + 2] = z;
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
const VIOLET: Shape['accent'] = [178, 148, 255];
const LAB = 0.5;

export const SHAPES: Record<string, Shape> = {
  scatter: { build: scatter, float: 0.2, accent: ORANGE },
  // Portada: cordillera, nubes y una laptop con código
  summit: { ...scene(), float: 0.006, accent: ORANGE },
  // Bildenlex: propiedad intelectual y derecho
  section: { build: text('§', SERIF), float: 0.012, accent: BLUE },
  // Legali / LexFlow: documentos generados
  document: {
    build: path(
      'M22 8h38l20 20v64H22z M60 8v20h20 M33 44h36v5H33z M33 57h36v5H33z M33 70h24v5H33z',
      3.4,
    ),
    float: 0.012,
    accent: GREEN,
  },
  // Mi Casa Decoraciones
  house: {
    build: path('M50 10 8 46h11v44h24V64h14v26h24V46h11z'),
    float: 0.012,
    accent: YELLOW,
  },
  // Nerdconf: experiencias web
  code: { build: text('</>', MONO), float: 0.012, accent: VIOLET },
  // Labs: matraz; al señalar una tarjeta, la forma de ese experimento
  flask: {
    build: path('M40 9h20v7h-4v23l25 42a7 7 0 0 1-6 10H25a7 7 0 0 1-6-10l25-42V16h-4z M33 66h34l10 17H23z', 3.2),
    scale: 0.62,
    accent: GREEN,
  },
  microwave: {
    build: path(
      'M8 24h84v52H8z M16 32h50v36H16z M74 34h10v6H74z M74 46h10v6H74z M74 62a5 5 0 1 0 10 0a5 5 0 1 0-10 0',
      3.2,
    ),
    scale: LAB,
    accent: YELLOW,
  },
  jet: {
    build: path(
      'M50 6c4 0 6 8 6 16v14l34 22v8l-34-9v18l10 9v6l-16-4-16 4v-6l10-9V57l-34 9v-8l34-22V22c0-8 2-16 6-16z',
    ),
    scale: LAB,
    accent: BLUE,
  },
  smiley: { build: text(':)', MONO), scale: LAB, accent: ORANGE },
  molecule: { build: molecule, spin: true, scale: LAB, accent: GREEN },
  braces: { build: text('{ }', MONO), float: 0.012, accent: YELLOW },
  helix: { build: helix, spin: true, float: 0.014, scale: 0.9, accent: GREEN },
  at: { build: text('@', SANS), float: 0.012, accent: PINK },
};
