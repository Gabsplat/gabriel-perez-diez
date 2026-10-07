import { createTimeline } from 'animejs';
import type { Shape } from './shapes';

// Portada: una laptop con código, Messi festejando a un lado y un mate
// humeante al otro. En la pantalla las letras dejan de ser sueltas y escriben
// código legible, carácter por carácter. La cordillera de atrás la dibuja el
// fondo ASCII (ascii-field.ts).

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

// La escena se dibuja de y = -0.1 a 0.82: se sube para que quede centrada
const LIFT = 0.36;

// Messi: de pie, con los dos brazos en alto señalando al cielo y la pelota al pie.
// Pocos trazos y limpios: a este tamaño cada línea de más lo vuelve una mancha.
const MX = -0.95;
const FEET = 0.82;
const BIG = 1.25;
const tall = ([x, y]: [number, number]): [number, number] => [MX + (x - MX) * BIG, FEET + (y - FEET) * BIG];
const MESSI: { points: [number, number][]; closed: boolean; weight: number }[] = [
  { points: [[MX - 0.1, 0.33], [MX + 0.1, 0.33], [MX + 0.09, 0.6], [MX - 0.09, 0.6]], closed: true, weight: 3 },
  { points: [[MX - 0.1, 0.34], [MX - 0.14, 0.22], [MX - 0.1, 0.1]], closed: false, weight: 1.5 },
  { points: [[MX + 0.1, 0.34], [MX + 0.14, 0.22], [MX + 0.1, 0.1]], closed: false, weight: 1.5 },
  { points: [[MX - 0.05, 0.6], [MX - 0.06, 0.8], [MX - 0.1, 0.82]], closed: false, weight: 1.5 },
  { points: [[MX + 0.05, 0.6], [MX + 0.06, 0.8], [MX + 0.1, 0.82]], closed: false, weight: 1.5 },
].map((part) => ({ ...part, points: part.points.map((point) => tall(point as [number, number])) }));
const HEAD: [number, number, number] = [...tall([MX, 0.24]), 0.062 * BIG];
const BALL: [number, number, number] = [MX + 0.24, 0.76, 0.055];
const NUMBER = [{ char: '1', x: MX - 0.032, y: tall([MX, 0.46])[1] }, { char: '0', x: MX + 0.032, y: tall([MX, 0.46])[1] }];

// Mate: calabaza con virola, bombilla y vapor
const TX = 0.95;
const GOURD: [number, number][] = [
  [TX - 0.1, 0.5], [TX - 0.15, 0.6], [TX - 0.155, 0.7], [TX - 0.09, 0.81], [TX + 0.09, 0.81], [TX + 0.155, 0.7], [TX + 0.15, 0.6], [TX + 0.1, 0.5],
];
const STRAW: [number, number][] = [[TX + 0.01, 0.6], [TX + 0.09, 0.3], [TX + 0.16, 0.22]];

// Qué se mueve en cada cuadro
const STILL = 0, STEAM = 1, BOUNCE = 2;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Punto en el borde de un círculo, con algo de relleno. */
function onCircle([cx, cy, r]: [number, number, number], fill = 0.3): [number, number] {
  const a = rand(0, Math.PI * 2);
  const k = Math.random() < fill ? Math.sqrt(Math.random()) : 1 + rand(-0.08, 0.08);
  return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k];
}
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

export function scene(): Pick<Shape, 'build' | 'live' | 'marks'> {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Letras con carácter fijo: primero el 10 de Messi, siempre visible, y después
  // el código, que se va escribiendo
  const letters: { char: string; x: number; y: number }[] = [...NUMBER];
  CODE.forEach((line, row) => {
    [...line].forEach((char, col) => {
      if (char !== ' ') letters.push({ char, x: TEXT_LEFT + col * CELL, y: TEXT_TOP + row * LINE });
    });
  });
  const typedFrom = NUMBER.length;
  const messiWeight = MESSI.reduce((sum, part) => sum + part.weight, 0);

  let base = new Float32Array(0);
  let motion = new Int8Array(0);
  let textFrom = 0;
  let hidden = new Uint8Array(0);

  function messi(): [number, number, number] {
    const pick = Math.random();
    if (pick < 0.14) return [...onCircle(HEAD, 0.2), STILL];
    if (pick < 0.26) return [...onCircle(BALL, 0.2), BOUNCE];
    let at = Math.random() * messiWeight;
    const part = MESSI.find((item) => (at -= item.weight) <= 0) ?? MESSI[0];
    return [...onPath(part.points, part.closed, 0.006), STILL];
  }

  function mate(): [number, number, number] {
    const pick = Math.random();
    if (pick < 0.56) return [...onPath(GOURD, true, 0.007), STILL];
    if (pick < 0.68) return [...onPath([[TX - 0.13, 0.57], [TX + 0.13, 0.57]], false, 0.006), STILL];
    if (pick < 0.88) return [...onPath(STRAW, false, 0.006), STILL];
    // Vapor: dos hilos que suben; en `live` ondulan
    return [TX - 0.06 + (Math.random() < 0.5 ? 0 : 0.07), rand(0.16, 0.46), STEAM];
  }

  return {
    build(n) {
      const pts = new Float32Array(n * 3);
      motion = new Int8Array(n);
      textFrom = n - letters.length;
      // Reparto de las letras sueltas: pantalla, base, Messi y mate
      const ends = [0.3, 0.46, 0.8].map((share) => Math.round(textFrom * share));
      const [frameEnd, deckEnd, messiEnd] = ends;
      const { left, right, top, bottom } = SCREEN;

      for (let i = 0; i < textFrom; i++) {
        let x = 0, y = 0, z = 0.16;
        if (i < frameEnd) {
          [x, y] = onPath([[left, top], [right, top], [right, bottom], [left, bottom]], true, 0.011);
        } else if (i < deckEnd) {
          // Base de la laptop: trapecio y una línea de teclado
          const deck: [number, number][] = [[left, bottom + 0.03], [right, bottom + 0.03], [right + 0.13, bottom + 0.17], [left - 0.13, bottom + 0.17]];
          [x, y] = i % 4 === 0
            ? onPath([[left - 0.03, bottom + 0.1], [right + 0.03, bottom + 0.1]], false, 0.008)
            : onPath(deck, true, 0.011);
        } else {
          [x, y, motion[i]] = i < messiEnd ? messi() : mate();
          z = 0.2;
        }
        pts[i * 3] = x;
        pts[i * 3 + 1] = y;
        pts[i * 3 + 2] = z;
      }
      letters.forEach((letter, j) => {
        const k = (textFrom + j) * 3;
        pts[k] = letter.x;
        pts[k + 1] = letter.y;
        pts[k + 2] = j < typedFrom ? 0.22 : 0.16;
      });
      for (let i = 0; i < n; i++) pts[i * 3 + 1] -= LIFT;
      base = pts.slice();

      const total = letters.length - typedFrom;
      if (still) typing.typed = total;
      else if (!started) {
        started = true;
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
      for (let i = 0; i < textFrom; i++) {
        const k = i * 3;
        switch (motion[i]) {
          case STEAM: {
            // El vapor sube, ondula y vuelve a empezar
            const rise = (0.46 - LIFT - base[k + 1] + time * 0.05) % 0.3;
            pts[k + 1] = 0.46 - LIFT - rise;
            pts[k] = base[k] + Math.sin(rise * 26 + time * 1.4) * 0.022 * (0.4 + rise * 3);
            break;
          }
          case BOUNCE:
            // Messi hace jueguito
            pts[k + 1] = base[k + 1] - Math.abs(Math.sin(time * 3.2)) * 0.16;
            break;
        }
      }
      // Los caracteres del código todavía no escritos quedan ocultos
      const typed = Math.floor(typing.typed);
      for (let j = typedFrom; j < letters.length; j++) hidden[n - letters.length + j] = j - typedFrom >= typed ? 1 : 0;
    },
  };
}
