import type { Look, Points, Shape } from './shapes';

// Íconos de los proyectos: objetos en 3D armados por piezas. Cada pieza tiene
// su color y su etiqueta, y `live` mueve las piezas etiquetadas en cada cuadro.
// Coordenadas de la forma: x a la derecha, y hacia abajo, z hacia quien mira.

type P3 = [number, number, number];
/** Un punto, y opcionalmente un valor propio para `live` (si no, uno al azar). */
type Sample = P3 | [number, number, number, number];

interface Part {
  /** Proporción de letras que lleva la pieza. */
  weight: number;
  /** 0 papel, 1 acento, 2 en adelante la paleta de la forma. */
  color?: number | ((p: P3) => number);
  /** Para reconocer la pieza en `live`. */
  tag?: number;
  sample: () => Sample;
}

interface Motion {
  base: Points;
  tags: Int8Array;
  /** Un valor por letra: el que dio la pieza, o uno al azar. */
  seeds: Float32Array;
  /** Letras que no se dibujan en este cuadro. */
  hidden: Uint8Array;
}

type Move = (pts: Points, motion: Motion, n: number, time: number, look: Look) => void;

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const jitter = (s: number) => rand(-s, s);
const fract = (v: number) => v - Math.floor(v);

/** Reparte las letras entre las piezas, en bloques contiguos. */
function compose(parts: Part[], move?: Move): Pick<Shape, 'build' | 'colors' | 'live' | 'marks'> {
  const total = parts.reduce((sum, part) => sum + part.weight, 0);
  let colors = new Uint8Array(0);
  let motion: Motion | null = null;
  return {
    build(n) {
      const pts = new Float32Array(n * 3);
      colors = new Uint8Array(n);
      const tags = new Int8Array(n);
      const seeds = new Float32Array(n);
      let i = 0;
      parts.forEach((part, index) => {
        const end = index === parts.length - 1 ? n : Math.min(n, i + Math.round((n * part.weight) / total));
        for (; i < end; i++) {
          const sample = part.sample();
          const p: P3 = [sample[0], sample[1], sample[2]];
          pts.set(p, i * 3);
          colors[i] = typeof part.color === 'function' ? part.color(p) : part.color ?? 0;
          tags[i] = part.tag ?? 0;
          seeds[i] = sample.length > 3 ? sample[3]! : Math.random();
        }
      });
      motion = { base: pts.slice(), tags, seeds, hidden: new Uint8Array(n) };
      return pts;
    },
    colors: () => colors,
    // Ningún carácter fijo: solo hace falta poder ocultar letras
    marks: (n) => ({ chars: new Int16Array(n).fill(-1), flatSize: 0, hidden: motion?.hidden }),
    live: move && ((pts, n, time, look) => {
      if (motion && motion.base.length === n * 3) move(pts, motion, n, time, look);
    }),
  };
}

// ── Muestreadores ───────────────────────────────────────────────────────────

function segment(a: P3, b: P3, s = 0.008): P3 {
  const t = Math.random();
  return [a[0] + (b[0] - a[0]) * t + jitter(s), a[1] + (b[1] - a[1]) * t + jitter(s), a[2] + (b[2] - a[2]) * t + jitter(s)];
}

/** Uno de varios tramos, elegido según su largo. */
function polyline(points: P3[], s = 0.008): P3 {
  const lengths = points.slice(1).map((b, i) => Math.hypot(b[0] - points[i][0], b[1] - points[i][1], b[2] - points[i][2]));
  let pick = Math.random() * lengths.reduce((sum, l) => sum + l, 0);
  let i = 0;
  while (pick > lengths[i] && i < lengths.length - 1) pick -= lengths[i++];
  return segment(points[i], points[i + 1], s);
}

function sphere(r = 1): P3 {
  const y = rand(-1, 1), a = rand(0, TAU), k = Math.sqrt(1 - y * y);
  return [Math.cos(a) * k * r, y * r, Math.sin(a) * k * r];
}

/** Anillo horizontal (plano xz). */
function ring(cy: number, r: number, s = 0.01): P3 {
  const a = rand(0, TAU);
  return [Math.cos(a) * r + jitter(s), cy + jitter(s), Math.sin(a) * r + jitter(s)];
}

/** Elipse en el plano xy, rellena (`fill`) o solo el borde. */
function ellipse(cx: number, cy: number, rx: number, ry: number, fill: number, z = 0): P3 {
  const a = rand(0, TAU);
  const k = Math.random() < fill ? Math.sqrt(Math.random()) : 1 + jitter(0.06);
  return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k, z + jitter(0.012)];
}

/** Rectángulo en el plano xy: borde, o relleno si `fill`. */
function rect(x0: number, y0: number, x1: number, y1: number, z: number, fill = false): P3 {
  if (fill) return [rand(x0, x1), rand(y0, y1), z + jitter(0.006)];
  return polyline([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [x0, y0, z]], 0.006);
}

const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];

// ── Nerdconf: un OVNI abduciendo una vaca, como en su sitio ─────────────────

const SAUCER = 1, LIGHT = 2, BEAM = 3, COW = 4;
const UFO_Y = -0.34;
const DISC = 0.92;
const BEAM_TOP = -0.18, BEAM_BOTTOM = 0.98;
const COW_AT: P3 = [0, 0.56, 0];
const LIGHTS = 16;

const lens = (r: number) => Math.pow(Math.max(0, 1 - (r / DISC) ** 2), 0.75);
const beamRadius = (y: number) => 0.15 + ((y - BEAM_TOP) / (BEAM_BOTTOM - BEAM_TOP)) * 0.52;
const onDisc = () => {
  const r = DISC * Math.sqrt(Math.random()), a = rand(0, TAU);
  return [Math.cos(a) * r, Math.sin(a) * r, r] as const;
};

/** La vaca, de perfil, centrada en el origen. */
function cow(): P3 {
  const piece = Math.random();
  if (piece < 0.5) return ellipse(0, 0, 0.17, 0.085, 0.8);
  if (piece < 0.64) return ellipse(0.205, -0.045, 0.062, 0.05, 0.75);
  if (piece < 0.7) return ellipse(0.255, -0.015, 0.032, 0.026, 0.6);
  if (piece < 0.74) return polyline([[0.18, -0.09, 0], [0.165, -0.13, 0], [0.19, -0.115, 0]], 0.005);
  if (piece < 0.78) return polyline([[0.23, -0.09, 0], [0.25, -0.13, 0]], 0.005);
  if (piece < 0.94) {
    const x = pick([-0.12, -0.06, 0.07, 0.125]);
    return segment([x, 0.06, 0], [x + jitter(0.01), 0.165, 0], 0.008);
  }
  return polyline([[-0.17, -0.03, 0], [-0.215, 0.02, 0], [-0.205, 0.08, 0]], 0.005);
}

/** Estrella de cuatro puntas, como las del cielo de Nerdconf. */
function star([cx, cy, cz]: P3, size: number): P3 {
  const t = jitter(1);
  const tip = (1 - Math.abs(t)) * size * 0.2;
  return Math.random() < 0.5 ? [cx + t * size + jitter(tip * 0.2), cy + jitter(tip), cz] : [cx + jitter(tip), cy + t * size, cz];
}

const STARS: [P3, number][] = [[[-0.95, -0.85, -0.2], 0.08], [[0.88, -0.7, -0.1], 0.06], [[-0.78, 0.55, 0.1], 0.05], [[0.9, 0.4, -0.2], 0.07], [[0.3, -0.95, -0.3], 0.04]];

export const ufo = compose(
  [
    // Platillo: lente de arriba, panza, borde y dos anillos de paneles
    { weight: 20, tag: SAUCER, sample: () => { const [x, z, r] = onDisc(); return [x, UFO_Y - 0.15 * lens(r), z]; } },
    { weight: 9, tag: SAUCER, sample: () => { const [x, z, r] = onDisc(); return [x, UFO_Y + 0.075 * lens(r), z]; } },
    { weight: 7, tag: SAUCER, sample: () => ring(UFO_Y, DISC, 0.012) },
    { weight: 5, tag: SAUCER, sample: () => { const r = pick([0.46, 0.7]); const p = ring(0, r, 0.006); p[1] = UFO_Y - 0.15 * lens(r) - 0.01; return p; } },
    // Cabina de vidrio
    { weight: 12, tag: SAUCER, color: 4, sample: () => { const d = sphere(); return [d[0] * 0.32, UFO_Y - 0.11 - Math.abs(d[1]) * 0.29, d[2] * 0.32]; } },
    // Luces del borde, que giran
    { weight: 8, tag: LIGHT, color: 1, sample: () => {
      const a = (Math.floor(Math.random() * LIGHTS) / LIGHTS) * TAU;
      const d = sphere(0.03);
      return [Math.cos(a) * 0.8 + d[0], UFO_Y + 0.055 + d[1], Math.sin(a) * 0.8 + d[2]];
    } },
    { weight: 4, tag: SAUCER, color: 3, sample: () => ring(UFO_Y + 0.1, 0.22, 0.01) },
    // Haz tractor: un cono naranja por el que suben las letras
    { weight: 16, tag: BEAM, color: 3, sample: () => {
      const y = rand(BEAM_TOP, BEAM_BOTTOM);
      const r = beamRadius(y) * (Math.random() < 0.7 ? 1 : Math.sqrt(Math.random()));
      const a = rand(0, TAU);
      return [Math.cos(a) * r, y, Math.sin(a) * r];
    } },
    { weight: 4, color: 3, sample: () => ring(BEAM_BOTTOM, beamRadius(BEAM_BOTTOM), 0.012) },
    // La vaca rosa con manchas, flotando en el haz
    { weight: 13, tag: COW, sample: () => { const p = cow(); return [p[0] + COW_AT[0], p[1] + COW_AT[1], p[2] + COW_AT[2]]; },
      color: ([x, y]) => (Math.sin((x - COW_AT[0]) * 46) * Math.sin((y - COW_AT[1]) * 58 + 1.2) > 0.38 ? 0 : 2) },
    { weight: 2, color: 4, sample: () => { const [at, size] = pick(STARS); return star(at, size); } },
  ],
  (pts, { base, tags, seeds }, n, time) => {
    const bob = Math.sin(time * 1.1) * 0.025;
    // La vaca gira despacio sobre sí misma y sube y baja con el haz
    const roll = Math.sin(time * 0.7) * 0.35 + 0.15;
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const lift = Math.sin(time * 1.3) * 0.035;
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      const x = base[k], y = base[k + 1], z = base[k + 2];
      switch (tags[i]) {
        case SAUCER:
          pts[k + 1] = y + bob;
          break;
        case LIGHT: {
          const a = time * 0.9, c = Math.cos(a), s = Math.sin(a);
          pts[k] = x * c - z * s;
          pts[k + 1] = y + bob;
          pts[k + 2] = x * s + z * c;
          break;
        }
        case BEAM: {
          // Sube en espiral y vuelve a empezar abajo
          const share = Math.hypot(x, z) / beamRadius(y);
          const climb = BEAM_BOTTOM - fract((BEAM_BOTTOM - y) / (BEAM_BOTTOM - BEAM_TOP) + time * 0.16 + seeds[i] * 0.05) * (BEAM_BOTTOM - BEAM_TOP);
          const a = Math.atan2(z, x) + time * 0.5;
          const r = share * beamRadius(climb);
          pts[k] = Math.cos(a) * r;
          pts[k + 1] = climb;
          pts[k + 2] = Math.sin(a) * r;
          break;
        }
        case COW: {
          const dx = x - COW_AT[0], dy = y - COW_AT[1];
          pts[k] = COW_AT[0] + dx * cr - dy * sr;
          pts[k + 1] = COW_AT[1] + dx * sr + dy * cr + lift;
          break;
        }
      }
    }
  },
);

// ── Bildenlex: la balanza de la justicia, que nunca termina de quedar quieta ──

const BEAM_ARM = 1, LEFT = 2, RIGHT = 3;
const PIVOT: P3 = [0, -0.5, 0];
const ARM = 0.7;
const DROP = 0.48;
const PAN = 0.27;

/** Platillo colgando del extremo `side` (-1 izquierda, 1 derecha) de la cruz quieta. */
function pan(side: number): P3 {
  const end: P3 = [side * ARM, PIVOT[1], 0];
  const rim = end[1] + DROP;
  if (Math.random() < 0.3) {
    // Tres cadenas del extremo de la cruz al borde del platillo
    const a = (Math.floor(Math.random() * 3) / 3) * TAU + 0.5;
    return segment(end, [end[0] + Math.cos(a) * PAN, rim, Math.sin(a) * PAN], 0.005);
  }
  // Cuenco: un casquete esférico
  const r = PAN * Math.sqrt(Math.random()), a = rand(0, TAU);
  const edge = Math.random() < 0.3 ? PAN : r;
  return [end[0] + Math.cos(a) * edge, rim + 0.08 * (1 - (edge / PAN) ** 2), Math.sin(a) * edge];
}

export const balance = compose(
  [
    // Base escalonada
    { weight: 8, sample: () => (Math.random() < 0.5 ? ring(0.86, 0.4, 0.01) : ring(0.78, 0.3, 0.01)) },
    { weight: 5, sample: () => { const p = ring(0, 0.4 * Math.sqrt(Math.random()), 0.004); p[1] = pick([0.86, 0.78]); return p; } },
    { weight: 2, sample: () => { const a = rand(0, TAU); return [Math.cos(a) * 0.3, rand(0.78, 0.86), Math.sin(a) * 0.3]; } },
    // Columna con estrías y remate dorado
    { weight: 12, sample: () => { const a = (Math.floor(Math.random() * 8) / 8) * TAU; return [Math.cos(a) * 0.05, rand(PIVOT[1], 0.78), Math.sin(a) * 0.05]; } },
    { weight: 3, color: 2, sample: () => { const d = sphere(0.065); return [d[0], PIVOT[1] - 0.11 + d[1], d[2]]; } },
    { weight: 2, color: 2, sample: () => { const d = sphere(0.035); return [d[0], PIVOT[1] + d[1], d[2] + 0.04]; } },
    // La cruz, más gruesa en el centro
    { weight: 10, tag: BEAM_ARM, color: 1, sample: () => {
      const x = rand(-ARM, ARM);
      const thick = 0.022 * (1.4 - Math.abs(x) / ARM);
      return [x, PIVOT[1] + jitter(thick), jitter(thick)];
    } },
    { weight: 13, tag: LEFT, color: (p) => (p[1] > PIVOT[1] + DROP - 0.02 ? 1 : 0), sample: () => pan(-1) },
    { weight: 13, tag: RIGHT, color: (p) => (p[1] > PIVOT[1] + DROP - 0.02 ? 1 : 0), sample: () => pan(1) },
  ],
  (pts, { base, tags }, n, time) => {
    const tilt = Math.sin(time * 0.7) * 0.13 + Math.sin(time * 1.9) * 0.02;
    const c = Math.cos(tilt), s = Math.sin(tilt);
    // Cuánto se corre cada extremo de la cruz; los platillos cuelgan siempre derechos
    const shift = (side: number) => [side * ARM * c - side * ARM, side * ARM * s];
    const [lx, ly] = shift(-1), [rx, ry] = shift(1);
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      const x = base[k], y = base[k + 1];
      if (tags[i] === BEAM_ARM) {
        const dy = y - PIVOT[1];
        pts[k] = x * c - dy * s;
        pts[k + 1] = PIVOT[1] + x * s + dy * c;
      } else if (tags[i] === LEFT) {
        pts[k] = x + lx;
        pts[k + 1] = y + ly;
      } else if (tags[i] === RIGHT) {
        pts[k] = x + rx;
        pts[k + 1] = y + ry;
      }
    }
  },
);

// ── Legali: hojas que se escriben solas y salen selladas ────────────────────

const TYPED = 1, CURSOR = 2, STAMP = 3;
const SHEET_W = 0.5, SHEET_H = 0.68;
const ROWS = 8;
// Cada hoja: giro, desplazamiento y profundidad; la última es la que se escribe
const SHEETS: [number, number, number, number][] = [[-0.24, -0.3, -0.06, -0.3], [-0.11, -0.15, -0.02, -0.15], [0.05, 0.1, 0.03, 0.04]];
const FRONT = SHEETS.length - 1;
const rowLength = (row: number) => (row === 0 ? 0.55 : 0.7 + 0.3 * fract(Math.sin(row * 91.7) * 43758.5));
const rowY = (row: number) => -SHEET_H + 0.18 + row * 0.115;
const TYPE_LOOP = 8;

/** Lleva un punto de la hoja a su lugar: girado y corrido. */
function onSheet(sheet: number, x: number, y: number): P3 {
  const [turn, dx, dy, z] = SHEETS[sheet];
  const c = Math.cos(turn), s = Math.sin(turn);
  return [x * c - y * s + dx, x * s + y * c + dy, z + jitter(0.006)];
}

/** Borde de la hoja con la esquina doblada. */
function sheetEdge(sheet: number): P3 {
  const w = SHEET_W, h = SHEET_H, f = 0.14;
  const [x, y] = polyline([[-w, -h, 0], [w - f, -h, 0], [w, -h + f, 0], [w, h, 0], [-w, h, 0], [-w, -h, 0], [w - f, -h, 0], [w - f, -h + f, 0], [w, -h + f, 0]], 0.007);
  return onSheet(sheet, x, y);
}

/** Un punto sobre los renglones; devuelve también en qué parte del texto está. */
function sheetLine(sheet: number): [P3, number] {
  const row = Math.floor(Math.random() * ROWS);
  const along = Math.random();
  const x = -SHEET_W + 0.06 + along * (SHEET_W * 2 - 0.12) * rowLength(row);
  return [onSheet(sheet, x, rowY(row) + jitter(row === 0 ? 0.018 : 0.008)), (row + along) / ROWS];
}

export const papers = compose(
  [
    // Las hojas de atrás: casi solo el contorno, para que no se mezclen
    { weight: 16, sample: () => sheetEdge(Math.floor(Math.random() * FRONT)) },
    { weight: 6, sample: () => sheetLine(Math.floor(Math.random() * FRONT))[0] },
    { weight: 12, sample: () => sheetEdge(FRONT) },
    // Cada letra de la hoja de adelante guarda en qué momento del texto aparece
    { weight: 42, tag: TYPED, color: (p) => (p[1] < onSheet(FRONT, 0, rowY(0) + 0.05)[1] ? 1 : 0), sample: () => {
      const [p, order] = sheetLine(FRONT);
      return [...p, order];
    } },
    { weight: 1.5, tag: CURSOR, color: 1, sample: () => [0, rand(-0.045, 0.045), 0.04] },
    // Sello de aprobado: un círculo con una tilde
    { weight: 10, tag: STAMP, color: 1, sample: () => {
      const [cx, cy] = [0.24, 0.43];
      const [x, y] = Math.random() < 0.6
        ? (() => { const a = rand(0, TAU), r = 0.14 + jitter(0.01); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; })()
        : polyline([[cx - 0.07, cy, 0], [cx - 0.015, cy + 0.055, 0], [cx + 0.08, cy - 0.06, 0]], 0.008);
      return onSheet(FRONT, x, y);
    } },
  ],
  (pts, { base, tags, seeds, hidden }, n, time) => {
    // Escribe durante seis segundos, sella, y vuelve a empezar
    const progress = (time % TYPE_LOOP) / (TYPE_LOOP - 2);
    const row = Math.min(ROWS - 1, Math.floor(progress * ROWS));
    const along = progress * ROWS - row;
    const cursor = onSheet(FRONT, -SHEET_W + 0.06 + along * (SHEET_W * 2 - 0.12) * rowLength(row), rowY(row));
    const blink = Math.floor(time * 3) % 2 === 0 || progress < 1;
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      switch (tags[i]) {
        case TYPED:
          hidden[i] = seeds[i] > progress ? 1 : 0;
          break;
        case CURSOR:
          pts[k] = cursor[0] + base[k] * 0.3;
          pts[k + 1] = cursor[1] + base[k + 1];
          pts[k + 2] = cursor[2] + base[k + 2];
          hidden[i] = blink && progress <= 1 ? 0 : 1;
          break;
        case STAMP:
          hidden[i] = progress > 1.04 ? 0 : 1;
          break;
      }
    }
  },
);

// ── Mi Casa Decoraciones: una casa con cortinas y la chimenea prendida ──────

const CURTAIN = 1, SMOKE = 2;
const W = 0.56, D = 0.4, GROUND = 0.72, EAVE = 0.04, RIDGE = -0.46;
const WINDOWS: [number, number][] = [[-0.42, -0.2], [0.2, 0.42]];
const WIN_TOP = 0.16, WIN_BOTTOM = 0.38;
const CHIMNEY: P3 = [0.3, -0.44, -0.04];

/** Altura del techo a una distancia `x` del centro. */
const roofY = (x: number) => RIDGE + (Math.abs(x) / (W + 0.08)) * (EAVE - RIDGE);

export const house = compose(
  [
    // Aristas de las paredes
    { weight: 14, sample: () => {
      const corners: P3[] = [[-W, GROUND, D], [W, GROUND, D], [W, GROUND, -D], [-W, GROUND, -D]];
      const i = Math.floor(Math.random() * 4);
      const [x, , z] = corners[i];
      const next = corners[(i + 1) % 4];
      return pick([() => segment([x, GROUND, z], [x, EAVE, z]), () => segment(corners[i], next), () => segment([x, EAVE, z], [next[0], EAVE, next[2]])])();
    } },
    // Techo a dos aguas, con hileras de tejas
    { weight: 18, sample: () => {
      const side = Math.random() < 0.5 ? -1 : 1;
      const t = Math.random() < 0.55 ? Math.round(Math.random() * 7) / 7 : Math.random();
      const x = side * t * (W + 0.08);
      return [x, roofY(x) + jitter(0.006), rand(-D - 0.08, D + 0.08)];
    } },
    { weight: 6, sample: () => polyline([[-W - 0.08, EAVE, D + 0.08], [0, RIDGE, D + 0.08], [W + 0.08, EAVE, D + 0.08]]) },
    { weight: 3, sample: () => segment([0, RIDGE, -D - 0.08], [0, RIDGE, D + 0.08]) },
    // Puerta con picaporte
    { weight: 6, sample: () => rect(-0.1, 0.4, 0.1, GROUND, D) },
    { weight: 1, color: 2, sample: () => { const d = sphere(0.014); return [0.065 + d[0], 0.57 + d[1], D + 0.01]; } },
    // Ventanas encendidas: marco, luz y cruz
    { weight: 9, sample: () => { const [x0, x1] = pick(WINDOWS); return Math.random() < 0.7 ? rect(x0, WIN_TOP, x1, WIN_BOTTOM, D) : Math.random() < 0.5 ? segment([(x0 + x1) / 2, WIN_TOP, D], [(x0 + x1) / 2, WIN_BOTTOM, D]) : segment([x0, (WIN_TOP + WIN_BOTTOM) / 2, D], [x1, (WIN_TOP + WIN_BOTTOM) / 2, D]); } },
    { weight: 8, color: 1, sample: () => { const [x0, x1] = pick(WINDOWS); return rect(x0 + 0.02, WIN_TOP + 0.02, x1 - 0.02, WIN_BOTTOM - 0.02, D - 0.01, true); } },
    // Cortinas: dos paños por ventana, que se mecen
    { weight: 8, tag: CURTAIN, color: 2, sample: () => {
      const [x0, x1] = pick(WINDOWS);
      const left = Math.random() < 0.5;
      const y = rand(WIN_TOP, WIN_BOTTOM);
      const open = 0.035 + (y - WIN_TOP) * 0.12;
      const x = left ? x0 + rand(0, open) : x1 - rand(0, open);
      return [x, y, D + 0.012];
    } },
    // Ventana lateral y ojo de buey en el frontón
    { weight: 4, color: 1, sample: () => [W, rand(WIN_TOP, WIN_BOTTOM), rand(-0.14, 0.14)] },
    { weight: 4, sample: () => { const a = rand(0, TAU); return [Math.cos(a) * 0.075, -0.16 + Math.sin(a) * 0.075, D + 0.08]; } },
    { weight: 2, color: 1, sample: () => ellipse(0, -0.16, 0.05, 0.05, 1, D + 0.08) },
    // Chimenea y humo
    { weight: 5, sample: () => {
      const [cx, top, cz] = CHIMNEY;
      const a = Math.floor(Math.random() * 4);
      const x = cx + (a % 2 ? 0.06 : -0.06), z = cz + (a < 2 ? 0.06 : -0.06);
      return segment([x, top, z], [x, roofY(x) + 0.02, z], 0.005);
    } },
    { weight: 8, tag: SMOKE, sample: () => [...CHIMNEY] as P3 },
    // Suelo, camino y un árbol redondo
    { weight: 4, sample: () => { const a = rand(0, TAU); return [Math.cos(a) * 0.95, GROUND + 0.02, Math.sin(a) * 0.62]; } },
    { weight: 3, sample: () => [pick([-0.1, 0.1]) + jitter(0.006), GROUND + 0.02, rand(D, 0.62)] },
    { weight: 7, color: 3, sample: () => { const d = sphere(0.2); return [-0.86 + d[0], 0.28 + d[1], 0.1 + d[2]]; } },
    { weight: 2, sample: () => segment([-0.86, 0.45, 0.1], [-0.86, GROUND, 0.1], 0.008) },
  ],
  (pts, { base, tags, seeds }, n, time) => {
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      if (tags[i] === CURTAIN) {
        const y = base[k + 1];
        pts[k] = base[k] + Math.sin(y * 24 + time * 1.8) * 0.008 * ((y - WIN_TOP) / (WIN_BOTTOM - WIN_TOP));
      } else if (tags[i] === SMOKE) {
        // Sube, se abre y se dobla con el viento
        const rise = fract(seeds[i] + time * 0.11);
        const spread = 0.02 + rise * 0.12;
        pts[k] = CHIMNEY[0] + rise * 0.3 + Math.sin(rise * 9 + time + seeds[i] * 6) * 0.05 * rise + Math.cos(seeds[i] * 40) * spread;
        pts[k + 1] = CHIMNEY[1] - rise * 0.6;
        pts[k + 2] = CHIMNEY[2] + Math.sin(seeds[i] * 70) * spread;
      }
    }
  },
);

// ══ Labs ════════════════════════════════════════════════════════════════════

/** Punto al azar de un cuadrilátero (a, b arriba; d, c abajo). */
function quad(a: P3, b: P3, c: P3, d: P3): P3 {
  const u = Math.random(), v = Math.random();
  const top = [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * u);
  const bottom = [0, 1, 2].map((i) => d[i] + (c[i] - d[i]) * u);
  return [0, 1, 2].map((i) => top[i] + (bottom[i] - top[i]) * v + jitter(0.006)) as P3;
}

/** Contorno o superficie de un cuadrilátero, y su espejo en x. */
function wing(points: [P3, P3, P3, P3], outline: number): P3 {
  const p = Math.random() < outline ? polyline([...points, points[0]], 0.006) : quad(...points);
  return Math.random() < 0.5 ? p : [-p[0], p[1], p[2]];
}

/** Gira (x, z) alrededor del eje vertical que pasa por (cx, cz). */
function spinY(pts: Points, k: number, x: number, z: number, cx: number, cz: number, angle: number) {
  const c = Math.cos(angle), s = Math.sin(angle);
  pts[k] = cx + (x - cx) * c - (z - cz) * s;
  pts[k + 2] = cz + (x - cx) * s + (z - cz) * c;
}

// ── Matraz: un Erlenmeyer con líquido que burbujea y echa vapor ──────────────

const SURFACE = 1, BUBBLE = 2, VAPOR = 3;
const NECK_TOP = -0.95, SHOULDER = -0.35, FLASK_BOTTOM = 0.82, LIQUID = 0.2;
const flaskRadius = (y: number) => (y < SHOULDER ? 0.13 : 0.13 + ((y - SHOULDER) / (FLASK_BOTTOM - SHOULDER)) * 0.5);

export const flask = compose(
  [
    // Vidrio: la pared, más marcada en el borde de la boca, el hombro y la base
    { weight: 20, sample: () => { const y = rand(NECK_TOP, FLASK_BOTTOM); return ring(y, flaskRadius(y), 0.005); } },
    { weight: 9, sample: () => pick([() => ring(NECK_TOP, 0.17, 0.008), () => ring(SHOULDER, 0.135, 0.006), () => ring(FLASK_BOTTOM, 0.63, 0.008)])() },
    { weight: 4, sample: () => { const p = ring(0, 0.62 * Math.sqrt(Math.random()), 0.004); p[1] = FLASK_BOTTOM + 0.01; return p; } },
    // Graduación al frente
    { weight: 4, sample: () => {
      const y = pick([-0.1, 0.1, 0.3, 0.5]);
      const a = Math.PI / 2 + rand(-0.32, 0.05);
      const r = flaskRadius(y) + 0.01;
      return [Math.cos(a) * r, y + jitter(0.004), Math.sin(a) * r];
    } },
    // Líquido: contra la pared y su superficie, que se mueve
    { weight: 13, color: 1, sample: () => { const y = rand(LIQUID, FLASK_BOTTOM); return ring(y, flaskRadius(y) - 0.025, 0.006); } },
    { weight: 10, tag: SURFACE, color: 1, sample: () => { const p = ring(0, (flaskRadius(LIQUID) - 0.025) * Math.sqrt(Math.random()), 0.004); p[1] = LIQUID; return p; } },
    // Burbujas que suben y vapor que sale por la boca
    { weight: 10, tag: BUBBLE, color: 2, sample: () => { const a = rand(0, TAU), r = 0.36 * Math.sqrt(Math.random()); return [Math.cos(a) * r, FLASK_BOTTOM, Math.sin(a) * r]; } },
    { weight: 7, tag: VAPOR, sample: () => [0, NECK_TOP, 0] },
  ],
  (pts, { base, tags, seeds }, n, time) => {
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      const x = base[k], z = base[k + 2], seed = seeds[i];
      switch (tags[i]) {
        case SURFACE:
          pts[k + 1] = LIQUID + Math.sin(x * 7 + time * 2.2) * 0.02 + Math.cos(z * 6 - time * 1.7) * 0.015;
          break;
        case BUBBLE: {
          const rise = fract(seed + time * 0.22);
          const y = FLASK_BOTTOM - 0.05 - rise * (FLASK_BOTTOM - 0.05 - LIQUID);
          // Se mece al subir, sin salirse del vidrio
          const room = (flaskRadius(y) - 0.06) / 0.36;
          pts[k] = (x + Math.sin(rise * 12 + seed * 20) * 0.03) * Math.min(1, room);
          pts[k + 1] = y;
          pts[k + 2] = z * Math.min(1, room);
          break;
        }
        case VAPOR: {
          const rise = fract(seed + time * 0.12);
          pts[k] = (seed - 0.5) * 0.14 + Math.sin(rise * 7 + time * 0.8 + seed * 6) * 0.16 * rise;
          pts[k + 1] = NECK_TOP - 0.03 - rise * 0.45;
          pts[k + 2] = Math.cos(seed * 40) * 0.05;
          break;
        }
      }
    }
  },
);

// ── Personaje de letras: una cabeza con auriculares, que canta ──────────────

const EYE = 1, MOUTH = 2, NOTE = 3;
const HEAD_Y = -0.12, HEAD_R = 0.52;
const EYE_Y = -0.18, MOUTH_Y = 0.04;
/** Profundidad de la cara en (x, y): los rasgos van sobre la esfera. */
const face = (x: number, y: number) => Math.sqrt(Math.max(0, HEAD_R ** 2 - x ** 2 - (y - HEAD_Y) ** 2)) + 0.012;

export const character = compose(
  [
    { weight: 22, sample: () => { const d = sphere(HEAD_R); return [d[0], HEAD_Y + d[1], d[2]]; } },
    { weight: 7, tag: EYE, sample: () => { const x = pick([-0.19, 0.19]); const p = ellipse(x, EYE_Y, 0.055, 0.085, 0.8); return [p[0], p[1], face(p[0], p[1])]; } },
    { weight: 6, tag: MOUTH, sample: () => {
      const a = rand(0.15, 0.85) * Math.PI;
      const x = Math.cos(a) * 0.21 + jitter(0.006), y = MOUTH_Y + Math.sin(a) * 0.11 + jitter(0.006);
      return [x, y, face(x, y)];
    } },
    { weight: 3, color: 2, sample: () => { const x = pick([-0.32, 0.32]); const p = ellipse(x, 0, 0.06, 0.035, 0.9); return [p[0], p[1], face(p[0], p[1]) - 0.02]; } },
    // Auriculares: vincha y dos copas
    { weight: 9, color: 1, sample: () => {
      const a = rand(Math.PI * 1.02, Math.PI * 1.98);
      return [Math.cos(a) * 0.6 + jitter(0.015), HEAD_Y + Math.sin(a) * 0.68 + jitter(0.015), jitter(0.03)];
    } },
    { weight: 11, color: 1, sample: () => {
      const side = pick([-1, 1]);
      const a = rand(0, TAU), r = Math.random() < 0.5 ? 0.17 : 0.17 * Math.sqrt(Math.random());
      return [side * pick([0.56, 0.66, rand(0.56, 0.66)]), HEAD_Y + 0.04 + Math.sin(a) * r, Math.cos(a) * r];
    } },
    // Buzo con capucha: hombros, borde de la capucha y cordones
    { weight: 12, sample: () => polyline([[-0.9, 1, -0.1], [-0.62, 0.58, -0.05], [-0.25, 0.44, 0], [0.25, 0.44, 0], [0.62, 0.58, -0.05], [0.9, 1, -0.1]], 0.01) },
    { weight: 7, sample: () => { const a = rand(0.78, 2.22) * Math.PI; return [Math.cos(a) * 0.72, HEAD_Y + 0.08 + Math.sin(a) * 0.74, -0.2]; } },
    { weight: 3, color: 2, sample: () => { const x = pick([-0.12, 0.12]); return segment([x, 0.46, 0.05], [x * 1.15, 0.78, 0.08], 0.006); } },
    // Notas musicales: cada una guarda cuál es, para moverse entera
    { weight: 5, tag: NOTE, color: 2, sample: () => {
      const note = Math.floor(Math.random() * 3);
      const p = Math.random() < 0.6 ? ellipse(0, 0, 0.035, 0.026, 0.9) : segment([0.032, 0, 0], [0.032, -0.12, 0], 0.005);
      return [p[0], p[1], p[2], note / 3 + 0.001];
    } },
  ],
  (pts, { base, tags, seeds }, n, time) => {
    // Mueve la cabeza al ritmo, parpadea y, de a ratos, canta
    const nod = Math.sin(time * 3.2) * 0.022;
    const blink = time % 3.6 < 0.14 ? 0.12 : 1;
    const singing = Math.sin(time * 0.9) > -0.2;
    const open = singing ? 1 + Math.max(0, Math.sin(time * 9)) * 0.9 : 1;
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      const x = base[k], y = base[k + 1];
      switch (tags[i]) {
        case NOTE: {
          const note = Math.floor(seeds[i] * 3);
          const rise = fract(time * 0.22 + note / 3);
          const side = note === 1 ? -1 : 1;
          pts[k] = x + side * (0.78 + rise * 0.22) + Math.sin(rise * 6 + note) * 0.05;
          pts[k + 1] = y - 0.05 - rise * 0.75;
          break;
        }
        case EYE:
          pts[k + 1] = EYE_Y + (y - EYE_Y) * blink + nod;
          break;
        case MOUTH:
          pts[k + 1] = MOUTH_Y + (y - MOUTH_Y) * open + nod;
          break;
        default:
          pts[k + 1] = y + nod;
      }
    }
  },
);

// ── Microondas: el plato gira con una taza, y adentro se ven las ondas ──────

const SPIN = 1, STEAM = 2, WAVE = 3;
const MW: [number, number, number, number, number, number] = [-0.95, 0.95, -0.55, 0.55, -0.5, 0.5];
const PLATE: P3 = [-0.27, 0.38, 0];
const MUG_AT = 0.17;
const MUG_TOP = PLATE[1] - 0.24;
const WAVE_ROWS = [-0.26, -0.06];

export const microwave = compose(
  [
    // La caja: sus doce aristas
    { weight: 16, sample: () => {
      const [x0, x1, y0, y1, z0, z1] = MW;
      const axis = Math.floor(Math.random() * 3);
      const a = pick([x0, x1]), b = pick([y0, y1]), c = pick([z0, z1]);
      if (axis === 0) return segment([x0, b, c], [x1, b, c], 0.006);
      if (axis === 1) return segment([a, y0, c], [a, y1, c], 0.006);
      return segment([a, b, z0], [a, b, z1], 0.006);
    } },
    // Puerta: ventana con marco doble y manija
    { weight: 9, sample: () => (Math.random() < 0.55 ? rect(-0.85, -0.44, 0.34, 0.46, MW[5]) : rect(-0.8, -0.39, 0.29, 0.41, MW[5])) },
    { weight: 3, sample: () => segment([0.41, -0.34, MW[5] + 0.05], [0.41, 0.34, MW[5] + 0.05], 0.008) },
    { weight: 2, sample: () => segment([0.47, MW[2], MW[5]], [0.47, MW[3], MW[5]], 0.005) },
    // Panel: visor encendido, teclado y perilla
    { weight: 5, color: 2, sample: () => rect(0.56, -0.44, 0.87, -0.29, MW[5] + 0.01, Math.random() < 0.6) },
    { weight: 7, sample: () => ellipse(pick([0.6, 0.715, 0.83]), pick([-0.14, -0.02, 0.1, 0.22]), 0.028, 0.028, 0.3, MW[5]) },
    { weight: 3, sample: () => ellipse(0.715, 0.4, 0.075, 0.075, 0.25, MW[5]) },
    // Adentro: la luz del fondo, el plato y la taza, que giran juntos
    { weight: 9, color: 1, sample: () => rect(-0.78, -0.37, 0.27, 0.4, -0.42, true) },
    { weight: 7, tag: SPIN, sample: () => ring(PLATE[1], 0.4, 0.006).map((v, i) => v + (i === 1 ? 0 : PLATE[i])) as P3 },
    { weight: 10, tag: SPIN, color: 3, sample: () => {
      const cx = PLATE[0] + MUG_AT, cz = PLATE[2];
      if (Math.random() < 0.18) {
        // Asa
        const a = rand(-0.5, 0.5) * Math.PI;
        return [cx + 0.11 + Math.cos(a) * 0.06, PLATE[1] - 0.12 + Math.sin(a) * 0.07, cz];
      }
      const p = ring(rand(MUG_TOP, PLATE[1]), 0.11, 0.004);
      return [cx + p[0], p[1], cz + p[2]];
    } },
    { weight: 5, tag: STEAM, sample: () => [0, MUG_TOP, 0] },
    // Ondas que corren por la cámara
    { weight: 8, tag: WAVE, color: 1, sample: () => [rand(-0.78, 0.27), pick(WAVE_ROWS), rand(-0.2, 0.2)] },
  ],
  (pts, { base, tags, seeds }, n, time) => {
    const turn = time * 0.8;
    const mugX = PLATE[0] + Math.cos(turn) * MUG_AT, mugZ = PLATE[2] + Math.sin(turn) * MUG_AT;
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      const x = base[k], y = base[k + 1], z = base[k + 2], seed = seeds[i];
      switch (tags[i]) {
        case SPIN:
          spinY(pts, k, x, z, PLATE[0], PLATE[2], turn);
          break;
        case STEAM: {
          const rise = fract(seed + time * 0.3);
          pts[k] = mugX + (seed - 0.5) * 0.1 + Math.sin(rise * 8 + seed * 9) * 0.04;
          pts[k + 1] = MUG_TOP - 0.02 - rise * 0.42;
          pts[k + 2] = mugZ + Math.cos(seed * 50) * 0.04;
          break;
        }
        case WAVE:
          pts[k + 1] = y + Math.sin(x * 14 - time * 4 + (y > -0.15 ? 2 : 0)) * 0.035;
          break;
      }
    }
  },
);

// ── Cuaderno de máquinas: un jet de frente, que se inclina en las curvas ────

const FLAME = 1;
const ENGINES: P3[] = [[-0.42, 0.38, -0.08], [0.42, 0.38, -0.08], [0, 0.88, 0]];
const fuselage = (y: number) => (y < -0.6 ? 0.11 * Math.sqrt((y + 0.95) / 0.35) : y < 0.5 ? 0.11 : 0.11 - ((y - 0.5) / 0.38) * 0.06);

export const jet = compose(
  [
    // Fuselaje: un tubo que se afina en la nariz y en la cola, con la cabina
    { weight: 20, sample: () => { const y = rand(-0.95, 0.88), a = rand(0, TAU), r = fuselage(y); return [Math.cos(a) * r, y, Math.sin(a) * r]; } },
    { weight: 5, color: 2, sample: () => { const d = sphere(); return [d[0] * 0.06, -0.55 + d[1] * 0.17, 0.08 + Math.abs(d[2]) * 0.05]; } },
    // Alas en flecha, con una franja de color
    { weight: 22, sample: () => wing([[-0.1, -0.16, 0], [-0.1, 0.3, 0], [-0.92, 0.5, 0], [-0.92, 0.39, 0]], 0.55) },
    { weight: 4, color: 1, sample: () => { const p = segment([-0.14, 0.08, 0.01], [-0.86, 0.43, 0.01], 0.006); return Math.random() < 0.5 ? p : [-p[0], p[1], p[2]]; } },
    { weight: 6, sample: () => wing([[-0.07, 0.58, 0], [-0.07, 0.78, 0], [-0.38, 0.87, 0], [-0.38, 0.8, 0]], 0.6) },
    { weight: 5, sample: () => (Math.random() < 0.6 ? polyline([[0, 0.5, 0], [0, 0.82, 0.36], [0, 0.9, 0.36], [0, 0.86, 0]], 0.006) : quad([0, 0.5, 0], [0, 0.86, 0], [0, 0.9, 0.36], [0, 0.82, 0.36])) },
    // Turbinas bajo las alas
    { weight: 8, color: 1, sample: () => { const x = pick([-0.42, 0.42]); const p = ring(0, 0.065, 0.004); return [x + p[0], rand(0, 0.38), -0.08 + p[2]]; } },
    // Fuego de las turbinas y de la cola
    { weight: 10, tag: FLAME, color: 3, sample: () => { const e = Math.floor(Math.random() * ENGINES.length); return [0, 0, 0, e / ENGINES.length + 0.001]; } },
  ],
  (pts, { base, tags, seeds }, n, time) => {
    const roll = Math.sin(time * 0.6) * 0.45;
    const c = Math.cos(roll), s = Math.sin(roll);
    const bob = Math.sin(time * 0.9) * 0.02;
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      let x = base[k], y = base[k + 1], z = base[k + 2];
      if (tags[i] === FLAME) {
        // Cada letra del fuego sale de su turbina y se apaga al alejarse
        const seed = seeds[i];
        const [ex, ey, ez] = ENGINES[Math.floor(seed * ENGINES.length)];
        const out = fract(seed * 13.7 + time * 2.2);
        const spread = 0.05 * (1 - out);
        x = ex + Math.cos(seed * 91) * spread;
        y = ey + out * 0.45;
        z = ez + Math.sin(seed * 57) * spread;
      }
      // Se inclina sobre su eje, el largo del avión
      pts[k] = x * c - z * s;
      pts[k + 1] = y + bob;
      pts[k + 2] = x * s + z * c;
    }
  },
);

// ── Carbono: un fenol, el anillo de benceno con su grupo OH ─────────────────

const C_R = 0.42;
const carbon = (k: number): P3 => [Math.cos(k * (Math.PI / 3) - Math.PI / 2) * C_R, Math.sin(k * (Math.PI / 3) - Math.PI / 2) * C_R, 0];
const outward = (k: number, r: number): P3 => carbon(k).map((v) => (v / C_R) * r) as P3;
const atom = (center: P3, r: number): P3 => sphere(r).map((v, i) => v + center[i]) as P3;
const OXYGEN = outward(0, 0.86);
const HYDROXYL: P3 = [OXYGEN[0] + 0.3, OXYGEN[1] - 0.1, 0];

export const phenol = compose([
  // Seis carbonos y sus enlaces; uno de cada dos es doble
  { weight: 26, sample: () => atom(carbon(Math.floor(Math.random() * 6)), 0.1) },
  { weight: 12, sample: () => {
    const k = Math.floor(Math.random() * 6);
    const a = carbon(k), b = carbon((k + 1) % 6);
    if (k % 2 === 0 && Math.random() < 0.5) return segment(a.map((v) => v * 0.8) as P3, b.map((v) => v * 0.8) as P3, 0.006);
    return segment(a, b, 0.006);
  } },
  // La nube aromática, en el centro del anillo
  { weight: 5, color: 1, sample: () => { const a = rand(0, TAU); return [Math.cos(a) * 0.22, Math.sin(a) * 0.22, jitter(0.02)]; } },
  // Hidrógenos en cinco carbonos
  { weight: 15, color: 2, sample: () => atom(outward(1 + Math.floor(Math.random() * 5), 0.8), 0.065) },
  { weight: 6, sample: () => { const k = 1 + Math.floor(Math.random() * 5); return segment(outward(k, C_R + 0.1), outward(k, 0.74), 0.005); } },
  // El grupo OH en el sexto
  { weight: 10, color: 3, sample: () => atom(OXYGEN, 0.11) },
  { weight: 3, color: 2, sample: () => atom(HYDROXYL, 0.065) },
  { weight: 3, sample: () => (Math.random() < 0.6 ? segment(outward(0, C_R + 0.1), outward(0, 0.75), 0.005) : segment(OXYGEN, HYDROXYL, 0.005)) },
]);
