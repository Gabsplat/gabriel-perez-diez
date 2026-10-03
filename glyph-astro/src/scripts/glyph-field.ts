import { animate } from 'animejs';
import { createRenderer, quadSize, STRIDE } from './renderer';
import { SHAPES, scatter, type Shape } from './shapes';

// Campo de letras: cada letra vuela por una curva hacia su lugar en la forma
// activa. Anime.js anima el progreso de cada letra y el estado de la vista;
// el renderer dibuja todas las letras juntas en cada cuadro.

type Side = 'left' | 'right' | 'center';
type Flight = 'vortex' | 'burst' | 'sweep' | 'rise';

interface Glyph {
  ch: number;
  /** Carácter propio, para volver a él al dejar una forma con texto. */
  own: number;
  /** Letra de texto: derecha, de tamaño fijo y casi sin flotar. */
  flat: boolean;
  // Curva de vuelo: origen, punto de control y destino
  fx: number; fy: number; fz: number;
  cx: number; cy: number; cz: number;
  tx: number; ty: number; tz: number;
  t: number;
  delay: number;
  dur: number;
  twist: number;
  size: number;
  alpha: number;
  seed: number;
  f1: number; f2: number; f3: number;
  // Empuje del puntero, en píxeles
  ox: number; oy: number;
}

interface Wave { x: number; y: number; r: number; power: number }

const CHARS = 'GABRIELPEREZDIEZgabrielperezdiez{}[]()<>/=+*#&@01';
const FLIGHTS: Flight[] = ['vortex', 'burst', 'sweep', 'rise'];
// Todo el ASCII imprimible, para poder escribir código con las letras
const ATLAS = Array.from({ length: 94 }, (_, i) => String.fromCharCode(33 + i)).join('');
const FOCAL = 3.6;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface Options {
  /** Cantidad de letras en pantallas angostas y anchas. */
  count?: [number, number];
  /** Tamaño de letra mínimo y máximo, en píxeles. */
  size?: [number, number];
  /** La forma ocupa el centro de la pantalla en vez de un costado. */
  stage?: boolean;
  /**
   * Retrato: el lienzo no ocupa la ventana sino su propio elemento. `center` es
   * dónde va el centro de la forma y `fit` su radio, como fracción del lado menor.
   */
  portrait?: { center: [number, number]; fit: number };
}

export function createGlyphField(canvas: HTMLCanvasElement, options: Options = {}) {
  const [fewer, more] = options.count ?? [800, 1500];
  const [smallest, largest] = options.size ?? [8, 15];
  const stage = options.stage ?? false;
  const portrait = options.portrait;
  const renderer = createRenderer(canvas, ATLAS, more);
  const data = new Float32Array(more * STRIDE);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let w = 0, h = 0, dpr = 1;
  let count = 0;
  let glyphs: Glyph[] = [];
  let accentFrom = 0;
  let flying: ReturnType<typeof animate> | null = null;
  let current: Shape = SHAPES.scatter;
  let currentKey = 'scatter';
  let side: Side = 'center';
  let flightIndex = 0;
  let angle = 0;
  let last = performance.now();
  let scrollY = window.scrollY;
  let shake = 0;
  let visible = true;
  let livePts: Float32Array | null = null;
  let flatSize = 0;
  let hidden: Uint8Array | null = null;
  let anchor: (() => number | null) | null = null;
  let centerY = 0;

  const cache = new Map<string, Float32Array>();
  const waves: Wave[] = [];
  const look = { x: 0, y: 0, active: false };
  const pointer = { x: -9999, y: -9999, nx: 0, ny: 0, sx: 0, sy: 0 };
  // Estado de la vista, animado por Anime.js en cada cambio de forma
  const view = { px: 0.5, py: 0.5, scale: 1, spin: 0, float: 0.2, r: 255, g: 122, b: 61 };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = portrait ? canvas.clientWidth : window.innerWidth;
    h = portrait ? canvas.clientHeight : window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    renderer.resize(canvas.width, canvas.height);
    const wanted = portrait || w >= 820 ? more : fewer;
    if (wanted !== count) {
      const first = count === 0;
      count = wanted;
      cache.clear();
      seed();
      // Cambió la cantidad de letras: se vuelve a armar la forma activa
      if (!first) {
        const key = currentKey;
        currentKey = 'scatter';
        morph(key, current);
      }
    }
    const layout = place(side);
    view.px = layout.px;
    view.py = layout.py;
  }

  function seed() {
    const pts = scatter(count);
    accentFrom = Math.floor(count * 0.84);
    glyphs = Array.from({ length: count }, (_, i): Glyph => {
      const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
      return {
        ch: 0, own: ATLAS.indexOf(CHARS[(Math.random() * CHARS.length) | 0]), flat: false,
        fx: x, fy: y, fz: z, cx: x, cy: y, cz: z, tx: x, ty: y, tz: z,
        t: 1, delay: 0, dur: 0,
        twist: rand(-3, 3),
        size: rand(smallest, largest),
        alpha: rand(0.5, 1),
        seed: rand(0, 100),
        f1: rand(0.35, 1), f2: rand(0.35, 1), f3: rand(0.25, 0.8),
        ox: 0, oy: 0,
      };
    });
    for (const p of glyphs) p.ch = p.own;
  }

  function place(s: Side) {
    if (portrait) return { px: portrait.center[0], py: portrait.center[1] };
    if (stage) return { px: 0.5, py: w < 820 ? 0.37 : 0.45 };
    if (w < 820) return { px: 0.5, py: 0.3 };
    if (s === 'left') return { px: 0.27, py: 0.52 };
    if (s === 'right') return { px: 0.73, py: 0.52 };
    return { px: 0.5, py: 0.5 };
  }

  function points(key: string, shape: Shape) {
    let pts = cache.get(key);
    if (!pts) {
      pts = shape.build(count);
      cache.set(key, pts);
    }
    return pts;
  }

  /** Fija cada letra en el punto de la curva donde está ahora. */
  function freeze() {
    for (const p of glyphs) {
      const t = p.t, u = 1 - t;
      p.fx = u * u * p.fx + 2 * u * t * p.cx + t * t * p.tx;
      p.fy = u * u * p.fy + 2 * u * t * p.cy + t * t * p.ty;
      p.fz = u * u * p.fz + 2 * u * t * p.cz + t * t * p.tz;
    }
  }

  function route(p: Glyph, flight: Flight) {
    const mx = (p.fx + p.tx) / 2, my = (p.fy + p.ty) / 2;
    switch (flight) {
      case 'vortex': {
        // Giro alrededor del centro: las letras entran en espiral
        p.cx = -my * 2.1 - p.ty * 0.9;
        p.cy = mx * 2.1 + p.tx * 0.9;
        p.cz = rand(-1.4, 1.4);
        const a = (Math.atan2(p.ty, p.tx) + Math.PI) / (Math.PI * 2);
        p.delay = a * 620 + rand(0, 90);
        p.dur = rand(1350, 1850);
        break;
      }
      case 'burst': {
        // Estallido hacia afuera y regreso
        const len = Math.hypot(p.fx, p.fy) || 1;
        const k = rand(1.5, 2.6);
        p.cx = (p.fx / len) * k + rand(-0.4, 0.4);
        p.cy = (p.fy / len) * k + rand(-0.4, 0.4);
        p.cz = rand(-0.5, 2.2);
        p.delay = rand(0, 260);
        p.dur = rand(1400, 2000);
        break;
      }
      case 'sweep': {
        // Barrido de izquierda a derecha
        p.cx = mx + rand(-0.3, 0.3);
        p.cy = my - rand(0.9, 1.7);
        p.cz = rand(0.4, 1.8);
        p.delay = ((p.tx + 1.2) / 2.4) * 760 + rand(0, 110);
        p.dur = rand(1100, 1500);
        break;
      }
      default: {
        // Se arma desde abajo, como si se imprimiera
        p.cx = p.tx * 0.25 + rand(-0.5, 0.5);
        p.cy = rand(1.3, 2);
        p.cz = rand(-1.2, 1.2);
        p.delay = ((1.2 - p.ty) / 2.4) * 720 + rand(0, 120);
        p.dur = rand(1150, 1600);
      }
    }
  }

  function morph(key: string, shape: Shape = SHAPES[key], options: { side?: Side; flight?: Flight } = {}) {
    if (!shape) return;
    if (options.side) side = options.side;
    const sameShape = key === currentKey;
    current = shape;
    currentKey = key;
    const layout = place(side);
    const accent = shape.accent ?? [255, 122, 61];

    animate(view, {
      px: layout.px,
      py: layout.py,
      scale: shape.scale ?? 1,
      spin: shape.spin ? 1 : 0,
      float: shape.float ?? 0.014,
      r: accent[0],
      g: accent[1],
      b: accent[2],
      duration: still ? 0 : 1500,
      ease: 'inOutCubic',
    });
    if (sameShape) return;

    const pts = points(key, shape);
    livePts = shape.live ? pts : null;
    const marks = shape.marks?.(count);
    flatSize = marks?.flatSize ?? 0;
    hidden = marks?.hidden ?? null;
    const flight = options.flight ?? FLIGHTS[flightIndex++ % FLIGHTS.length];
    freeze();
    flying?.cancel();
    for (let i = 0; i < count; i++) {
      const p = glyphs[i];
      p.tx = pts[i * 3];
      p.ty = pts[i * 3 + 1];
      p.tz = pts[i * 3 + 2];
      p.twist = rand(-3.4, 3.4);
      const code = marks ? marks.chars[i] : -1;
      p.flat = code >= 0;
      p.ch = p.flat ? code - 33 : p.own;
      route(p, key === 'scatter' ? 'burst' : flight);
      p.t = still ? 1 : 0;
    }
    if (still) return;
    flying = animate(glyphs, {
      t: [0, 1],
      delay: (p: Glyph) => p.delay,
      duration: (p: Glyph) => p.dur,
      ease: 'inOutQuart',
    } as Parameters<typeof animate>[1]);
  }

  /** Onda expansiva desde un punto de la pantalla. */
  function pulse(x: number, y: number) {
    if (still) return;
    const wave: Wave = { x, y, r: 0, power: 1 };
    waves.push(wave);
    animate(wave, {
      r: Math.hypot(w, h) * 0.75,
      power: 0,
      duration: 1300,
      ease: 'outCubic',
      onComplete: () => waves.splice(waves.indexOf(wave), 1),
    });
  }

  function frame(now: number) {
    requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const time = still ? 0 : now / 1000;

    // El scroll rápido afloja las letras
    const sy = window.scrollY;
    if (!portrait) shake += (Math.min(0.12, Math.abs(sy - scrollY) * 0.0016) - shake) * 0.1;
    scrollY = sy;

    pointer.sx += (pointer.nx - pointer.sx) * 0.06;
    pointer.sy += (pointer.ny - pointer.sy) * 0.06;

    // Formas vivas: los destinos se mueven en cada cuadro
    if (current.live && livePts) {
      look.active = pointer.x > -999;
      if (look.active) {
        const reachX = Math.max(w, h) * 0.3;
        let tx = (pointer.x - w * view.px) / reachX, ty = (pointer.y - centerY) / reachX;
        const len = Math.hypot(tx, ty);
        if (len > 1) { tx /= len; ty /= len; }
        look.x += (tx - look.x) * 0.14;
        look.y += (ty - look.y) * 0.14;
      }
      current.live(livePts, count, time, look);
      for (let i = 0; i < count; i++) {
        const p = glyphs[i];
        p.tx = livePts[i * 3];
        p.ty = livePts[i * 3 + 1];
        p.tz = livePts[i * 3 + 2];
      }
    }

    angle += dt * 0.42 * view.spin;
    if (view.spin > 0.999 && angle > Math.PI) angle -= Math.PI * 2;
    const rotY = angle * view.spin + (1 - view.spin) * Math.sin(time * 0.55) * 0.3 + pointer.sx * 0.5;
    const rotX = view.spin * 0.3 + Math.sin(time * 0.4) * 0.07 + pointer.sy * 0.32;
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);

    const fit = portrait ? Math.min(w, h) * portrait.fit : stage ? Math.min(w * 0.46, h * 0.29) : w < 820 ? Math.min(w * 0.4, h * 0.25) : Math.min(w * 0.21, h * 0.31);
    const radius = fit * view.scale;
    // Angosto: la forma sigue a su sección al hacer scroll; ancho: queda fija
    const pinned = w < 820 ? anchor?.() ?? null : null;
    const wantedY = pinned ?? h * view.py;
    centerY = pinned === null ? wantedY : centerY + (wantedY - centerY) * 0.3;
    const ox = w * view.px, oy = centerY;
    const float = view.float + shake;
    const reach = Math.min(170, w * 0.22);

    let drawn = 0;
    for (let i = 0; i < count; i++) {
      const p = glyphs[i];

      const t = p.t, u = 1 - t;
      const air = 4 * t * u; // 0 en reposo, 1 en pleno vuelo
      const drift = (p.flat ? float * 0.2 : float) + air * 0.07;
      let x = u * u * p.fx + 2 * u * t * p.cx + t * t * p.tx + Math.sin(time * p.f1 + p.seed) * drift;
      let y = u * u * p.fy + 2 * u * t * p.cy + t * t * p.ty + Math.cos(time * p.f2 + p.seed * 2.3) * drift;
      let z = u * u * p.fz + 2 * u * t * p.cz + t * t * p.tz + Math.sin(time * p.f3 + p.seed * 4.1) * drift;

      const x1 = x * cosY + z * sinY;
      const z1 = z * cosY - x * sinY;
      const y1 = y * cosX - z1 * sinX;
      z = z1 * cosX + y * sinX;
      x = x1;
      y = y1;

      const persp = FOCAL / (FOCAL - Math.min(z, FOCAL - 0.8));
      let sx = ox + x * radius * persp;
      let sy2 = oy + y * radius * persp;

      // Repulsión del puntero y ondas
      let pushX = 0, pushY = 0;
      const dx = sx - pointer.x, dy = sy2 - pointer.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < reach * reach) {
        const d = Math.sqrt(d2) || 1;
        const force = (1 - d / reach) ** 2 * 86;
        pushX = (dx / d) * force;
        pushY = (dy / d) * force;
      }
      for (let k = 0; k < waves.length; k++) {
        const wave = waves[k];
        const wx = sx - wave.x, wy = sy2 - wave.y;
        const d = Math.hypot(wx, wy) || 1;
        const band = 1 - Math.abs(d - wave.r) / 130;
        if (band > 0) {
          pushX += (wx / d) * band * wave.power * 95;
          pushY += (wy / d) * band * wave.power * 95;
        }
      }
      p.ox += (pushX - p.ox) * 0.13;
      p.oy += (pushY - p.oy) * 0.13;
      sx += p.ox;
      sy2 += p.oy;

      if (sx < -30 || sy2 < -30 || sx > w + 30 || sy2 > h + 30) continue;
      if (hidden && hidden[i]) continue;

      const depth = Math.max(0, Math.min(1, (z + 1.2) / 2.4));
      const size = p.flat ? flatSize * radius : p.size;
      const s = quadSize(size * persp * (1 + air * 0.55) * dpr);
      const turn = p.twist * u + (p.flat ? 0 : Math.sin(time * p.f1 + p.seed) * Math.min(1, drift * 5) * 0.5);
      const k = drawn++ * STRIDE;
      data[k] = sx * dpr;
      data[k + 1] = sy2 * dpr;
      data[k + 2] = Math.cos(turn) * s;
      data[k + 3] = Math.sin(turn) * s;
      data[k + 4] = p.flat ? 1 : p.alpha * (0.28 + depth * 0.72);
      data[k + 5] = p.ch;
      data[k + 6] = i >= accentFrom ? 1 : 0;
    }
    renderer.render(data, drawn, [view.r, view.g, view.b]);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (e) => {
    // En un retrato el puntero se mide desde el propio lienzo
    const box = portrait ? canvas.getBoundingClientRect() : null;
    pointer.x = e.clientX - (box?.left ?? 0);
    pointer.y = e.clientY - (box?.top ?? 0);
    pointer.nx = portrait ? 0 : e.clientX / w - 0.5;
    pointer.ny = portrait ? 0 : e.clientY / h - 0.5;
  });
  const release = () => (pointer.x = pointer.y = -9999);
  document.documentElement.addEventListener('mouseleave', release);
  window.addEventListener('pointerup', (e) => e.pointerType !== 'mouse' && release());
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    last = performance.now();
  });

  resize();
  requestAnimationFrame(frame);

  return {
    morph,
    pulse,
    /** Vuelve a generar las formas de texto cuando terminan de cargar las fuentes. */
    refresh() {
      cache.clear();
      const key = currentKey;
      currentKey = '';
      morph(key, current);
    },
    get shape() {
      return currentKey;
    },
    /** Centro de la forma en pantalla, en píxeles. */
    center: () => ({ x: w * view.px, y: centerY }),
    /** Altura del centro de la forma en pantallas angostas, en píxeles. */
    /** Cambia el color de acento sin cambiar de forma. */
    setAccent([r, g, b]: [number, number, number]) {
      animate(view, { r, g, b, duration: still ? 0 : 600, ease: 'outQuad' });
    },
    setAnchor(fn: () => number | null) {
      anchor = fn;
    },
  };
}

export type GlyphField = ReturnType<typeof createGlyphField>;
