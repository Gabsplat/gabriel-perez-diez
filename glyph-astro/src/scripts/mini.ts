import { act, blinkLoop, gaze, gesture, lids, mouth } from './character';
import type { Shape } from './shapes';

// Carita de Glifo para el botón del asistente. Usa los mismos gestos que el
// personaje completo, pero con pocos rasgos y gruesos: a 70 píxeles los detalles
// finos (nariz, párpados, micrófono, buzo) se vuelven ruido.

const PARTS = [['hair', 0.24], ['head', 0.2], ['brow', 0.08], ['mouth', 0.16], ['cup', 0.16], ['eye', 0.16]] as const;
type Part = (typeof PARTS)[number][0];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function miniFace(): Pick<Shape, 'build' | 'live'> {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let part: Part[] = [];
  let u = new Float32Array(0);
  let v = new Float32Array(0);
  let jx = new Float32Array(0);
  let jy = new Float32Array(0);
  let side = new Int8Array(0);

  return {
    build(n) {
      part = [];
      PARTS.forEach(([name, share]) => {
        for (let i = Math.round(n * share); i > 0; i--) part.push(name);
      });
      // Lo que falte o sobre por el redondeo se ajusta en los ojos, que van últimos
      while (part.length < n) part.push('eye');
      part.length = n;
      u = Float32Array.from({ length: n }, Math.random);
      v = Float32Array.from({ length: n }, Math.random);
      jx = Float32Array.from({ length: n }, () => Math.random() * 2 - 1);
      jy = Float32Array.from({ length: n }, () => Math.random() * 2 - 1);
      side = Int8Array.from({ length: n }, (_, i) => (i % 2 ? 1 : -1));
      blinkLoop();
      const pts = new Float32Array(n * 3);
      this.live!(pts, n, 0, { x: 0, y: 0, active: false });
      return pts;
    },

    live(pts, n, time, look) {
      if (part.length !== n) return;
      const g = gesture;
      const freeX = look.active ? look.x : Math.sin(time * 0.5) * 0.5;
      const freeY = look.active ? look.y : Math.sin(time * 0.33) * 0.25;
      const lookX = lerp(freeX, gaze.x, gaze.on);
      const lookY = lerp(freeY, gaze.y, gaze.on);
      const open = Math.min(1, Math.max(g.open, mouth.talk));
      const grin = Math.max(0, g.smile);
      const angle = g.tilt * 0.12;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const shake = still ? 0 : Math.sin(time * 46) * 0.012 * g.vein;
      const bounce = still ? 0 : Math.abs(Math.sin(time * 5)) * 0.03 * g.blush;

      for (let i = 0; i < n; i++) {
        const s = side[i], a = u[i] * Math.PI * 2;
        let x = 0, y = 0, z = 0.12;
        switch (part[i]) {
          case 'head': {
            const chin = Math.max(0, Math.sin(a));
            x = Math.cos(a) * 0.76 * (1 - 0.14 * chin * chin) + jx[i] * 0.03;
            y = Math.sin(a) * 0.9 + jy[i] * 0.03;
            z = 0;
            break;
          }
          case 'hair': {
            if (v[i] < 0.45) {
              // Casco de pelo sobre la cabeza
              const b = Math.PI * (0.96 + u[i] * 1.08);
              const r = lerp(0.98, 1.16, v[i] / 0.45);
              x = Math.cos(b) * 0.76 * r;
              y = Math.sin(b) * 0.9 * r;
            } else {
              // Flequillo
              x = (u[i] * 2 - 1) * 0.68;
              const top = -0.9 * Math.sqrt(Math.max(0, 1 - (x / 0.76) ** 2));
              const fringe = -0.5 + 0.07 * Math.sin(x * 11) + 0.14 * x;
              y = lerp(top, Math.max(top, fringe), (v[i] - 0.45) / 0.55);
            }
            z = -0.05;
            break;
          }
          case 'cup': {
            const r = Math.sqrt(v[i]);
            x = s * 0.86 + Math.cos(a) * 0.14 * r;
            y = 0.04 + Math.sin(a) * 0.27 * r;
            z = 0.04;
            break;
          }
          case 'brow': {
            const l = u[i];
            x = s * (0.14 + l * 0.38);
            y = -0.4 - g.browRaise * 0.1 + g.browTilt * (0.12 * (1 - l) - 0.05 * l) - 0.03 * Math.sin(l * Math.PI) + jy[i] * 0.03;
            break;
          }
          case 'eye': {
            // Ojo lleno: se achata al parpadear y se arquea hacia arriba al reír
            const openness = Math.max(0.14, g.eye * (1 - lids.blink) * (s > 0 ? 1 - act.wink : 1));
            const r = Math.sqrt(v[i]) * 0.15;
            const ex = Math.cos(a) * r;
            x = s * 0.33 + ex + lookX * 0.05;
            y = -0.08 + Math.sin(a) * r * Math.min(1.15, openness) + lookY * 0.04 - g.squint * 0.09 * (1 - (ex / 0.15) ** 2);
            z = 0.16;
            break;
          }
          default: {
            const t = u[i] * 2 - 1, arch = 1 - t * t;
            const width = 0.36 * (1 + 0.2 * grin) * (1 - 0.4 * open * (1 - grin));
            x = t * width;
            y = 0.44 - g.smile * 0.14 * t * t + jy[i] * 0.028;
            y += v[i] < 0.5 ? -open * 0.05 * arch : open * 0.26 * arch;
          }
        }
        // Inclina, asiente y gira la cabeza entera
        const dy = y - 0.9;
        const rx = x * cos - dy * sin, ry = x * sin + dy * cos;
        pts[i * 3] = rx + shake + act.turn * 0.16 * (0.4 + z * 4);
        pts[i * 3 + 1] = ry + 0.9 - bounce + act.nod * 0.12 * (0.5 + z * 4);
        pts[i * 3 + 2] = z;
      }
    },
  };
}
