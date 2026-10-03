import { createTimeline } from 'animejs';
import type { Shape } from './shapes';

// Portada: cordillera con nubes y, adelante, una laptop. En la pantalla las
// letras dejan de ser sueltas y escriben código legible, carácter por carácter.

const CODE = [
  'const gabriel = {',
  "  rol: 'frontend',",
  '  vibe: true,',
  "  lee: 'el diff',",
  '};',
  'ship(gabriel);',
];

// Grilla del texto, en unidades de la forma
const CELL = 0.042;
const LINE = 0.09;
const TEXT_LEFT = -0.41;
const TEXT_TOP = 0.03;
// Marco de la pantalla
const SCREEN = { left: -0.5, right: 0.5, top: -0.08, bottom: 0.64 };

const RIDGE: [number, number][] = [
  [-1.18, 0.14], [-0.62, -0.62], [-0.42, -0.42], [0, -1], [0.36, -0.5], [0.6, -0.7], [1.18, 0.14],
];
// Picos con nieve: x, y, alto de la nieve y pendiente de las laderas
const SNOW: [number, number, number, number][] = [[0, -1, 0.2, 0.72], [-0.62, -0.62, 0.11, 0.9], [0.6, -0.7, 0.12, 0.7]];
const CLOUDS: [number, number, number][] = [[-0.82, -0.84, 0.14], [0.72, -0.94, 0.11]];
const PUFFS: [number, number, number][] = [[-0.85, 0.18, 0.5], [-0.2, -0.28, 0.72], [0.62, -0.02, 0.58], [1.2, 0.24, 0.4]];

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const typing = { typed: 0 };
let started = false;

/** Punto al azar sobre una poligonal, con un poco de grosor. */
function onPath(points: [number, number][], closed: boolean, spread: number): [number, number] {
  const count = closed ? points.length : points.length - 1;
  const lengths = Array.from({ length: count }, (_, i) => {
    const a = points[i], b = points[(i + 1) % points.length];
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  });
  let pick = Math.random() * lengths.reduce((sum, l) => sum + l, 0);
  let i = 0;
  while (pick > lengths[i] && i < count - 1) pick -= lengths[i++];
  const a = points[i], b = points[(i + 1) % points.length];
  const t = Math.random();
  return [a[0] + (b[0] - a[0]) * t + rand(-spread, spread), a[1] + (b[1] - a[1]) * t + rand(-spread, spread)];
}

/** Punto sobre el contorno de una nube: unión de círculos con base plana. */
function onCloud(cx: number, cy: number, s: number): [number, number] {
  for (;;) {
    if (Math.random() < 0.18) return [cx + rand(-0.85, 1.2) * s, cy + 0.62 * s + rand(-0.01, 0.01)];
    const [dx, dy, r] = PUFFS[(Math.random() * PUFFS.length) | 0];
    const a = rand(0, Math.PI * 2);
    const x = dx + Math.cos(a) * r, y = dy + Math.sin(a) * r;
    if (y > 0.6) continue;
    if (PUFFS.some(([ox, oy, or]) => Math.hypot(x - ox, y - oy) < or - 0.02)) continue;
    return [cx + x * s, cy + y * s];
  }
}

export function scene(): Pick<Shape, 'build' | 'live' | 'marks'> {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Cada carácter visible del código, con su lugar en la grilla
  const letters: { char: string; x: number; y: number }[] = [];
  CODE.forEach((line, row) => {
    [...line].forEach((char, col) => {
      if (char !== ' ') letters.push({ char, x: TEXT_LEFT + col * CELL, y: TEXT_TOP + row * LINE });
    });
  });

  let base = new Float32Array(0);
  let cloudOf = new Int8Array(0);
  let textFrom = 0;
  let hidden = new Uint8Array(0);

  return {
    build(n) {
      const pts = new Float32Array(n * 3);
      cloudOf = new Int8Array(n).fill(-1);
      textFrom = n - letters.length;
      const ridgeEnd = Math.round(textFrom * 0.42);
      const cloudEnd = ridgeEnd + Math.round(textFrom * 0.2);
      const frameEnd = cloudEnd + Math.round(textFrom * 0.24);
      const { left, right, top, bottom } = SCREEN;

      for (let i = 0; i < textFrom; i++) {
        let x = 0, y = 0, z = 0.16;
        if (i < ridgeEnd) {
          z = -0.4;
          if (i % 5 === 0) {
            // Nieve: triángulo bajo cada pico, con borde dentado
            const [px, py, height, slope] = SNOW[i % SNOW.length];
            const v = Math.sqrt(Math.random());
            x = px + rand(-1, 1) * v * height * slope;
            y = py + v * height * (0.8 + 0.2 * Math.abs(Math.sin((x - px) * 60)));
          } else {
            // Sin línea de base: las laderas bajan por detrás de la laptop
            [x, y] = onPath(RIDGE, false, 0.012);
          }
        } else if (i < cloudEnd) {
          const which = i % CLOUDS.length;
          cloudOf[i] = which;
          [x, y] = onCloud(...CLOUDS[which]);
          z = -0.2;
        } else if (i < frameEnd) {
          [x, y] = onPath([[left, top], [right, top], [right, bottom], [left, bottom]], true, 0.011);
        } else {
          // Base de la laptop: trapecio y una línea de teclado
          const deck: [number, number][] = [[left, bottom + 0.03], [right, bottom + 0.03], [right + 0.2, bottom + 0.17], [left - 0.2, bottom + 0.17]];
          [x, y] = i % 4 === 0
            ? onPath([[left - 0.04, bottom + 0.1], [right + 0.04, bottom + 0.1]], false, 0.008)
            : onPath(deck, true, 0.011);
        }
        pts[i * 3] = x;
        pts[i * 3 + 1] = y;
        pts[i * 3 + 2] = z;
      }
      letters.forEach((letter, j) => {
        const k = (textFrom + j) * 3;
        pts[k] = letter.x;
        pts[k + 1] = letter.y;
        pts[k + 2] = 0.16;
      });
      base = pts.slice();

      if (still) typing.typed = letters.length;
      else if (!started) {
        started = true;
        const total = letters.length;
        createTimeline({ loop: true })
          .add(typing, { typed: total, duration: total * 58, ease: 'linear' }, 700)
          .add(typing, { typed: 0, duration: 450, ease: 'inQuad' }, 700 + total * 58 + 4200);
      }
      return pts;
    },

    marks(n) {
      const chars = new Int16Array(n).fill(-1);
      letters.forEach((letter, j) => (chars[n - letters.length + j] = letter.char.charCodeAt(0)));
      hidden = new Uint8Array(n);
      return { chars, flatSize: CELL * 1.45, hidden };
    },

    live(pts, n, time) {
      if (hidden.length !== n) return;
      // Las nubes derivan de lado a lado
      for (let i = 0; i < textFrom; i++) {
        const which = cloudOf[i];
        if (which < 0) continue;
        pts[i * 3] = base[i * 3] + Math.sin(time * (which ? 0.33 : 0.45) + which * 2) * 0.07;
      }
      // Los caracteres todavía no escritos quedan ocultos
      const typed = Math.floor(typing.typed);
      for (let j = 0; j < letters.length; j++) hidden[n - letters.length + j] = j >= typed ? 1 : 0;
    },
  };
}
