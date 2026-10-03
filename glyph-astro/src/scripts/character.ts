import { animate, createTimeline } from 'animejs';
import type { Look, Shape } from './shapes';

// Personaje hecho de letras: cabeza con pelo, auriculares con micrófono, ojos,
// cejas, boca y buzo con capucha. Cada punto pertenece a una parte y se
// recalcula en cada cuadro a partir del gesto actual, que anima Anime.js.

export type Mood = 'neutral' | 'feliz' | 'enojado' | 'triste' | 'sorprendido' | 'dormido';

interface Gesture {
  /** Cejas: positivo junta y baja el lado interno (enojo), negativo lo sube (tristeza). */
  browTilt: number;
  browRaise: number;
  /** Apertura de los ojos: 0 cerrados, 1 normal. */
  eye: number;
  /** Ojos en arco hacia arriba, de risa. */
  squint: number;
  smile: number;
  open: number;
  blush: number;
  vein: number;
  tear: number;
  tilt: number;
  sleep: number;
}

export const MOODS: Record<Mood, { gesture: Gesture; accent: [number, number, number] }> = {
  neutral: {
    gesture: { browTilt: 0, browRaise: 0, eye: 1, squint: 0, smile: 0.25, open: 0.04, blush: 0, vein: 0, tear: 0, tilt: 0, sleep: 0 },
    accent: [255, 122, 61],
  },
  feliz: {
    gesture: { browTilt: -0.15, browRaise: 0.6, eye: 0.3, squint: 1, smile: 1, open: 0.5, blush: 1, vein: 0, tear: 0, tilt: 0.5, sleep: 0 },
    accent: [255, 208, 92],
  },
  enojado: {
    gesture: { browTilt: 1, browRaise: -0.5, eye: 0.62, squint: 0, smile: -0.75, open: 0.1, blush: 0, vein: 1, tear: 0, tilt: -0.15, sleep: 0 },
    accent: [255, 74, 74],
  },
  triste: {
    gesture: { browTilt: -1, browRaise: 0.2, eye: 0.7, squint: 0, smile: -0.9, open: 0.02, blush: 0, vein: 0, tear: 1, tilt: -0.6, sleep: 0 },
    accent: [108, 172, 228],
  },
  sorprendido: {
    gesture: { browTilt: 0, browRaise: 1, eye: 1.3, squint: 0, smile: -0.1, open: 1, blush: 0, vein: 0, tear: 0, tilt: 0, sleep: 0 },
    accent: [178, 148, 255],
  },
  dormido: {
    gesture: { browTilt: -0.2, browRaise: -0.3, eye: 0.04, squint: 0, smile: 0.1, open: 0.1, blush: 0, vein: 0, tear: 0, tilt: 0.8, sleep: 1 },
    accent: [140, 156, 214],
  },
};

const gesture: Gesture = { ...MOODS.neutral.gesture };
const lids = { blink: 0 };
/** Volumen de la voz entre 0 y 1; lo escribe la página cuando el micrófono está activo. */
export const voice = { level: 0 };

/** Gestos cortos que se suman al ánimo: asentir, negar y guiñar. */
export const act = { nod: 0, turn: 0, wink: 0 };
/** Mirada forzada, por ejemplo hacia arriba mientras piensa. */
export const gaze = { on: 0, x: 0, y: 0 };
/** Apertura de la boca al hablar. Va aparte: animarla junto a `act` cortaba los otros gestos. */
export const mouth = { talk: 0 };

export function setMood(mood: Mood) {
  animate(gesture, { ...MOODS[mood].gesture, duration: 650, ease: 'outBack(1.6)' });
}

/** Asiente tres veces. */
export function nod() {
  animate(act, {
    nod: [1, 0, 1, 0, 1, 0].map((to) => ({ to, duration: to ? 130 : 170 })),
    ease: 'inOutQuad',
  });
}

/** Niega con la cabeza. */
export function shake() {
  animate(act, {
    turn: [-1, 1, -1, 1, 0].map((to) => ({ to, duration: to ? 150 : 200 })),
    ease: 'inOutQuad',
  });
}

export function wink() {
  animate(act, { wink: 1, duration: 110, ease: 'outQuad' });
  // Queda cerrado un momento antes de volver a abrir
  setTimeout(() => animate(act, { wink: 0, duration: 220, ease: 'inQuad' }), 490);
}

// Partes, en el orden en que se reparten las letras. Las últimas reciben el
// color de acento: auriculares, iris, pupilas y los detalles de cada gesto
// (marca de enojo, lágrima y las zetas del sueño).
const PARTS = [
  ['hair', 0.176], ['head', 0.08], ['band', 0.04], ['boom', 0.02], ['brow', 0.045], ['lid', 0.06],
  ['nose', 0.012], ['mouth', 0.08], ['cheek', 0.03], ['neck', 0.02], ['shoulder', 0.1], ['collar', 0.05],
  ['hood', 0.03], ['string', 0.02], ['pocket', 0.05], ['arm', 0.03],
  ['cup', 0.07], ['iris', 0.03], ['pupil', 0.025], ['vein', 0.02], ['tear', 0.012], ['zzz', 0.02],
] as const;
type Part = (typeof PARTS)[number][0];

const TORSO = new Set<Part>(['neck', 'shoulder', 'collar', 'hood', 'string', 'pocket', 'arm']);
const CHEST = ['<', '/', '>'];

const HEAD_Y = -0.3;
const EYE_X = 0.2, EYE_Y = -0.33, EYE_W = 0.115;
const SHOULDER: [number, number][] = [[0.16, 0.38], [0.45, 0.43], [0.74, 0.55], [0.9, 0.78], [0.97, 1.12]];
const POCKET: [number, number][] = [[-0.44, 1.12], [-0.3, 0.8], [0.3, 0.8], [0.44, 1.12]];
const NOSE: [number, number][] = [[-0.012, -0.25], [0.035, -0.15], [0.02, -0.12], [-0.03, -0.125]];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Punto a lo largo de una poligonal, con `t` entre 0 y 1. */
function along(points: [number, number][], t: number): [number, number] {
  const scaled = Math.min(0.9999, Math.max(0, t)) * (points.length - 1);
  const i = Math.floor(scaled), f = scaled - i;
  return [lerp(points[i][0], points[i + 1][0], f), lerp(points[i][1], points[i + 1][1], f)];
}

export function character(): Pick<Shape, 'build' | 'live' | 'marks'> {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let part: Part[] = [];
  let u = new Float32Array(0);
  let v = new Float32Array(0);
  let jx = new Float32Array(0);
  let jy = new Float32Array(0);
  let side = new Int8Array(0);
  let blinking = false;

  /** Pelo: una franja que cubre la cabeza y un flequillo peinado hacia un lado. */
  function hair(i: number): [number, number] {
    if (v[i] < 0.5) {
      const a = Math.PI * (0.94 + u[i] * 1.12);
      const r = lerp(0.97, 1.17, v[i] * 2);
      return [Math.cos(a) * 0.46 * r, HEAD_Y + Math.sin(a) * 0.56 * r];
    }
    const x = (u[i] * 2 - 1) * 0.43;
    const top = HEAD_Y - 0.56 * Math.sqrt(Math.max(0, 1 - (x / 0.46) ** 2));
    const fringe = -0.61 + 0.045 * Math.sin(x * 17) + 0.11 * x;
    return [x, lerp(top, Math.max(top, fringe), (v[i] - 0.5) * 2)];
  }

  function place(i: number, time: number, look: Look): [number, number, number] {
    const g = gesture;
    const s = side[i], a = u[i] * Math.PI * 2;
    // El guiño cierra solo el ojo derecho; dormido, la boca respira
    const eye = Math.max(0.04, g.eye * (1 - lids.blink) * (s > 0 ? 1 - act.wink : 1));
    const breath = g.sleep * (0.5 + 0.5 * Math.sin(time * 1.6)) * 0.22;
    const open = Math.min(1, Math.max(g.open + breath, voice.level * 1.25, mouth.talk));
    const freeX = look.active ? look.x : Math.sin(time * 0.5) * 0.5;
    const freeY = look.active ? look.y : Math.sin(time * 0.33) * 0.25;
    const lookX = lerp(freeX, gaze.x, gaze.on);
    const lookY = lerp(freeY, gaze.y, gaze.on);
    // Párpados: arcos sobre el ancho del ojo
    const lidUp = (l: number) => EYE_Y - (eye * 0.075 + g.squint * 0.02) * (1 - l * l);
    const lidDown = (l: number) => EYE_Y + (eye * 0.045 - g.squint * 0.045) * (1 - l * l);

    switch (part[i]) {
      case 'hair': {
        const [x, y] = hair(i);
        return [x, y, -0.06];
      }
      case 'head': {
        const chin = Math.max(0, Math.sin(a));
        const jaw = chin > 0.6 ? open * 0.035 : 0;
        return [Math.cos(a) * 0.46 * (1 - 0.16 * chin * chin) + jx[i] * 0.008, HEAD_Y + Math.sin(a) * 0.56 + jaw + jy[i] * 0.008, 0];
      }
      case 'band': {
        const b = Math.PI * (1.09 + u[i] * 0.82);
        return [Math.cos(b) * (0.56 + jx[i] * 0.014), -0.27 + Math.sin(b) * (0.71 + jy[i] * 0.014), -0.08];
      }
      case 'cup': {
        const r = Math.sqrt(v[i]);
        return [s * 0.535 + Math.cos(a) * 0.085 * r, -0.27 + Math.sin(a) * 0.17 * r, 0.05];
      }
      case 'boom': {
        // Brazo del micrófono, del auricular izquierdo hasta la boca
        if (u[i] > 0.72) return [-0.2 + jx[i] * 0.03, 0.17 + jy[i] * 0.02, 0.2];
        const t = u[i] / 0.72, k = 1 - t;
        return [k * k * -0.53 + 2 * k * t * -0.52 + t * t * -0.22 + jx[i] * 0.006, k * k * -0.12 + 2 * k * t * 0.2 + t * t * 0.17 + jy[i] * 0.006, 0.16];
      }
      case 'brow': {
        const l = u[i];
        const y = -0.5 - g.browRaise * 0.07 + g.browTilt * (0.065 * (1 - l) - 0.03 * l) - 0.025 * Math.sin(l * Math.PI);
        return [s * (0.085 + l * 0.245), y + jy[i] * 0.015, 0.13];
      }
      case 'lid': {
        const l = u[i] * 2 - 1;
        return [s * EYE_X + l * EYE_W, (v[i] < 0.6 ? lidUp(l) : lidDown(l)) + jy[i] * 0.006, 0.13];
      }
      case 'iris':
      case 'pupil': {
        const ring = part[i] === 'iris';
        const r = ring ? 0.05 + jx[i] * 0.006 : Math.sqrt(v[i]) * 0.027;
        const x = Math.cos(a) * r + lookX * 0.035;
        const l = Math.max(-1, Math.min(1, x / EYE_W));
        // El iris queda recortado por los párpados
        const y = Math.min(lidDown(l), Math.max(lidUp(l), EYE_Y + Math.sin(a) * r + lookY * 0.025));
        return [s * EYE_X + x, y, 0.15];
      }
      case 'nose': {
        const [x, y] = along(NOSE, u[i]);
        return [x + jx[i] * 0.005, y + jy[i] * 0.005, 0.18];
      }
      case 'mouth': {
        const t = u[i] * 2 - 1, arch = 1 - t * t;
        const grin = Math.max(0, g.smile);
        const width = 0.17 * (1 + 0.25 * grin) * (1 - 0.38 * open * (1 - grin));
        let y = 0.04 - g.smile * 0.07 * t * t;
        if (v[i] < 0.4) y -= open * 0.03 * arch;          // labio de arriba
        else if (v[i] < 0.8) y += open * 0.14 * arch;      // labio de abajo
        else y += open * 0.02 * arch - open * 0.012;       // dientes
        return [t * width, y + jy[i] * 0.008, 0.14];
      }
      case 'cheek': {
        // Rubor: sale del contorno de la cara cuando está feliz
        const r = Math.sqrt(v[i]);
        const hx = Math.cos(a) * 0.46, hy = HEAD_Y + Math.sin(a) * 0.56;
        return [lerp(hx, s * 0.3 + Math.cos(a) * 0.065 * r, g.blush), lerp(hy, -0.13 + Math.sin(a) * 0.03 * r, g.blush), 0.1];
      }
      case 'vein': {
        // Marca de enojo en la sien: cuatro trazos en cruz, escondidos en el pelo
        const [hx, hy] = hair(i);
        const dir = Math.PI / 4 + Math.floor(u[i] * 4) * (Math.PI / 2);
        const reach = 0.025 + v[i] * 0.055;
        const pulse = 1 + Math.sin(time * 9) * 0.12;
        return [lerp(hx, 0.34 + Math.cos(dir) * reach * pulse, g.vein), lerp(hy, -0.78 + Math.sin(dir) * reach * pulse, g.vein), 0.1];
      }
      case 'tear': {
        // Lágrima que cae en bucle desde el ojo izquierdo
        const fall = still ? 0.3 : (time * 0.45 + 0.2) % 1;
        const r = Math.sqrt(v[i]) * 0.028 * (1 - 0.6 * Math.max(0, -Math.sin(a)));
        const l = u[i] * 2 - 1;
        return [
          lerp(-EYE_X + l * EYE_W, -0.27 + Math.cos(a) * r, g.tear),
          lerp(lidDown(l), -0.24 + fall * 0.3 + Math.sin(a) * r * 1.5, g.tear),
          0.16,
        ];
      }
      case 'zzz': {
        // Tres zetas que suben desde la cabeza mientras duerme
        const [hx, hy] = hair(i);
        const k = Math.floor(v[i] * 3);
        const size = 0.035 + k * 0.022;
        const t = u[i] * 3;
        const zx = t < 1 ? t : t < 2 ? 2 - t : t - 2;
        const zy = t < 1 ? 0 : t < 2 ? t - 1 : 1;
        const rise = still ? 0 : ((time * 0.22 + k * 0.33) % 1) * 0.07;
        return [
          lerp(hx, 0.5 + k * 0.13 + (zx - 0.5) * 2 * size, g.sleep),
          lerp(hy, -0.72 - k * 0.17 - rise + (zy - 0.5) * 2 * size, g.sleep),
          0.05,
        ];
      }
      case 'neck':
        return [s * 0.13 + jx[i] * 0.008, lerp(0.23, 0.4, u[i]), -0.05];
      case 'shoulder': {
        const [x, y] = along(SHOULDER, u[i]);
        return [s * x + jx[i] * 0.011, y + jy[i] * 0.011, -0.1];
      }
      case 'collar': {
        // Cuello del buzo en «U»
        const t = u[i] * 2 - 1;
        return [t * 0.3 + jx[i] * 0.01, 0.34 + (1 - t * t) * 0.2 + jy[i] * 0.012, -0.02];
      }
      case 'hood': {
        const b = Math.PI * (1.04 + u[i] * 0.92);
        return [Math.cos(b) * 0.52, 0.34 + Math.sin(b) * 0.17 + jy[i] * 0.012, -0.18];
      }
      case 'string':
        return u[i] > 0.85
          ? [s * 0.115 + jx[i] * 0.016, 0.81 + jy[i] * 0.02, 0]
          : [s * lerp(0.09, 0.115, u[i]) + jx[i] * 0.005, lerp(0.5, 0.79, u[i] / 0.85), 0];
      case 'pocket': {
        const [x, y] = along(POCKET, u[i]);
        return [x + jx[i] * 0.01, y + jy[i] * 0.01, -0.08];
      }
      default:
        return [s * lerp(0.6, 0.66, u[i]) + jx[i] * 0.008, lerp(0.72, 1.12, u[i]), -0.1];
    }
  }

  return {
    build(n) {
      const body = n - CHEST.length;
      part = [];
      PARTS.forEach(([name, share], k) => {
        const amount = k === 0 ? 0 : Math.round(body * share);
        for (let i = 0; i < amount; i++) part.push(name);
      });
      // El pelo se queda con lo que sobra del redondeo
      part = [...new Array<Part>(Math.max(0, body - part.length)).fill('hair'), ...part].slice(0, body);
      u = Float32Array.from({ length: n }, Math.random);
      v = Float32Array.from({ length: n }, Math.random);
      jx = Float32Array.from({ length: n }, () => Math.random() * 2 - 1);
      jy = Float32Array.from({ length: n }, () => Math.random() * 2 - 1);
      side = Int8Array.from({ length: n }, (_, i) => (i % 2 ? 1 : -1));

      if (!still && !blinking) {
        blinking = true;
        const blink = createTimeline({ loop: true });
        for (const at of [1900, 4600, 4950]) {
          blink.add(lids, { blink: 1, duration: 80, ease: 'inQuad' }, at).add(lids, { blink: 0, duration: 150, ease: 'outQuad' }, at + 80);
        }
        blink.add(lids, { blink: 0, duration: 1200 }, 5200);
      }
      const pts = new Float32Array(n * 3);
      this.live!(pts, n, 0, { x: 0, y: 0, active: false });
      return pts;
    },

    marks(n) {
      const chars = new Int16Array(n).fill(-1);
      CHEST.forEach((char, j) => (chars[n - CHEST.length + j] = char.charCodeAt(0)));
      return { chars, flatSize: 0.1 };
    },

    live(pts, n, time, look) {
      const body = n - CHEST.length;
      if (part.length !== body) return;
      const g = gesture;
      // La cabeza se inclina, tiembla de enojo y rebota de alegría o al hablar
      const angle = g.tilt * 0.13;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const shake = still ? 0 : Math.sin(time * 46) * 0.006 * g.vein;
      const bounce = still ? 0 : Math.abs(Math.sin(time * 5)) * 0.018 * g.blush + voice.level * 0.03;
      const turnX = (look.active ? look.x * 0.03 : 0) + act.turn * 0.11;
      const dip = act.nod * 0.05;

      for (let i = 0; i < body; i++) {
        let [x, y, z] = place(i, time, look);
        if (!TORSO.has(part[i])) {
          const dy = y - 0.24;
          const rx = x * cos - dy * sin, ry = x * sin + dy * cos;
          x = rx + shake + turnX * (0.5 + z * 3);
          // Al asentir, los rasgos bajan más que el contorno: la cara mira hacia abajo
          y = ry + 0.24 - bounce + dip * (0.6 + z * 4);
        }
        pts[i * 3] = x;
        pts[i * 3 + 1] = y;
        pts[i * 3 + 2] = z;
      }
      CHEST.forEach((_, j) => {
        const k = (body + j) * 3;
        pts[k] = (j - 1) * 0.085;
        pts[k + 1] = 0.67;
        pts[k + 2] = -0.02;
      });
    },
  };
}
