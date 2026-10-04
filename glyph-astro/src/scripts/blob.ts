import { animate } from 'animejs';
import type { Mood } from './character';

// Mimo: un blob blando y cariñoso. Es un SVG de pocas formas grandes (cuerpo,
// ojos, cejas, boca, cachetes), así que se entiende igual a 60 píxeles que a
// 200. Todo sale de un puñado de números que Anime.js anima entre gestos, y en
// cada cuadro se vuelve a dibujar el contorno, que nunca queda quieto.

type State = 'idle' | 'listening' | 'hearing' | 'thinking' | 'speaking';

interface Pose {
  smile: number;
  /** Apertura de los ojos: 1 normal, más grande de sorpresa. */
  eye: number;
  /** Ojos en arco, de risa. */
  squint: number;
  /** Cejas: positivo enojado, negativo triste. */
  brow: number;
  blush: number;
  /** Tono del cuerpo, en grados. */
  hue: number;
  /** Alto relativo: menos de 1 achatado, más de 1 estirado. */
  tall: number;
  /** Cuánto se sacude el contorno. */
  wobble: number;
}

const POSES: Record<Mood, Pose> = {
  neutral: { smile: 0.55, eye: 1, squint: 0, brow: 0, blush: 0.35, hue: 345, tall: 1, wobble: 0.5 },
  feliz: { smile: 1, eye: 1, squint: 1, brow: 0, blush: 1, hue: 22, tall: 1.04, wobble: 0.8 },
  enojado: { smile: -0.7, eye: 0.75, squint: 0, brow: 1, blush: 0, hue: 2, tall: 0.92, wobble: 1.6 },
  triste: { smile: -0.9, eye: 0.85, squint: 0, brow: -1, blush: 0, hue: 212, tall: 0.9, wobble: 0.25 },
  sorprendido: { smile: 0, eye: 1.4, squint: 0, brow: 0, blush: 0.2, hue: 268, tall: 1.14, wobble: 0.6 },
  dormido: { smile: 0.2, eye: 0.1, squint: 0, brow: 0, blush: 0.3, hue: 250, tall: 0.88, wobble: 0.2 },
};

const SVG = 'http://www.w3.org/2000/svg';
const POINTS = 10;
const RADIUS = 34;

export function createBlob(host: HTMLElement) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  host.innerHTML = `
    <svg viewBox="-50 -50 100 100" aria-hidden="true">
      <defs>
        <radialGradient id="blob-skin" cx="38%" cy="30%" r="80%">
          <stop offset="0%" data-stop="light" />
          <stop offset="100%" data-stop="deep" />
        </radialGradient>
      </defs>
      <g data-part="all">
        <path data-part="body" fill="url(#blob-skin)" />
        <ellipse data-part="shine" cx="-13" cy="-19" rx="9" ry="5" fill="#fff" opacity="0.32" transform="rotate(-24 -13 -19)" />
        <g data-part="face">
          <ellipse data-part="cheek" cx="-20" cy="6" rx="6" ry="3.6" fill="#ff5d8f" />
          <ellipse data-part="cheek" cx="20" cy="6" rx="6" ry="3.6" fill="#ff5d8f" />
          <g data-part="eyes" fill="#2b1830" stroke="#2b1830" stroke-width="3" stroke-linecap="round">
            <ellipse data-part="eye" cx="-12" cy="-4" rx="4.6" />
            <ellipse data-part="eye" cx="12" cy="-4" rx="4.6" />
            <path data-part="arc" fill="none" />
            <path data-part="arc" fill="none" />
            <circle data-part="glint" cx="-10.4" cy="-6.6" r="1.5" fill="#fff" stroke="none" />
            <circle data-part="glint" cx="13.6" cy="-6.6" r="1.5" fill="#fff" stroke="none" />
            <path data-part="brow" fill="none" stroke-width="2.6" />
            <path data-part="brow" fill="none" stroke-width="2.6" />
          </g>
          <path data-part="mouth" fill="#2b1830" stroke="#2b1830" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        </g>
      </g>
    </svg>`;
  const pick = (name: string) => [...host.querySelectorAll<SVGElement>(`[data-part="${name}"]`)];
  const [all] = pick('all');
  const [body] = pick('body');
  const [face] = pick('face');
  const eyes = pick('eye');
  const arcs = pick('arc');
  const glints = pick('glint');
  const brows = pick('brow');
  const cheeks = pick('cheek');
  const [mouth] = pick('mouth');
  const light = host.querySelector<SVGElement>('[data-stop="light"]')!;
  const deep = host.querySelector<SVGElement>('[data-stop="deep"]')!;

  const pose: Pose = { ...POSES.neutral };
  // Movimientos cortos que se suman al gesto
  const move = { blink: 0, talk: 0, hop: 0, lean: 0, lookX: 0, lookY: 0, think: 0, level: 0 };
  const pointer = { x: 0, y: 0 };
  let state: State = 'idle';

  function draw(now: number) {
    requestAnimationFrame(draw);
    const t = still ? 0 : now / 1000;

    // Contorno: un círculo cuyos radios ondulan, pasado por una curva suave
    const breathe = Math.sin(t * 1.7) * 0.02;
    const sy = pose.tall * (1 + breathe - move.hop * 0.16) * (1 + move.level * 0.1);
    const sx = (1 / Math.sqrt(pose.tall)) * (1 - breathe + move.hop * 0.14) * (1 + move.level * 0.1);
    const speed = 1.2 + pose.wobble * 1.4 + move.think * 2.4;
    const ring: [number, number][] = [];
    for (let i = 0; i < POINTS; i++) {
      const a = (i / POINTS) * Math.PI * 2;
      const wave = Math.sin(t * speed + i * 1.9) * 0.035 + Math.sin(t * speed * 0.6 + i * 3.1) * 0.025;
      // La base queda más quieta y ancha: está apoyado
      const ground = Math.max(0, Math.sin(a));
      const r = RADIUS * (1 + wave * (0.5 + pose.wobble) * (1 - ground * 0.6) + ground * 0.05);
      ring.push([Math.cos(a) * r * sx, Math.sin(a) * r * sy + (1 - sy) * RADIUS]);
    }
    let d = '';
    for (let i = 0; i < POINTS; i++) {
      const p0 = ring[(i + POINTS - 1) % POINTS], p1 = ring[i], p2 = ring[(i + 1) % POINTS], p3 = ring[(i + 2) % POINTS];
      if (!i) d += `M${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`;
      d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(2)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(2)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(2)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
    }
    body.setAttribute('d', `${d}Z`);
    light.setAttribute('stop-color', `hsl(${pose.hue} 100% 82%)`);
    deep.setAttribute('stop-color', `hsl(${pose.hue - 14} 86% 62%)`);

    const shake = pose.brow > 0.5 && !still ? Math.sin(t * 44) * 0.9 * pose.brow : 0;
    const sway = Math.sin(t * 2.6) * 5 * move.think;
    all.setAttribute('transform', `translate(${shake.toFixed(2)} ${(-move.hop * 5).toFixed(2)}) rotate(${(move.lean * 9 + sway).toFixed(2)})`);

    // La cara sigue la mirada y acompaña el estirón del cuerpo
    const lookX = move.lookX * (1 - move.think) + 0.7 * move.think;
    const lookY = move.lookY * (1 - move.think) - 0.9 * move.think;
    face.setAttribute('transform', `translate(${(lookX * 4).toFixed(2)} ${(lookY * 3 + (1 - sy) * RADIUS * 0.7).toFixed(2)})`);

    const open = Math.max(0.08, pose.eye * (1 - move.blink));
    eyes.forEach((eye, i) => {
      eye.setAttribute('ry', (6.2 * open).toFixed(2));
      eye.setAttribute('opacity', String(1 - pose.squint));
      const s = i ? 1 : -1;
      arcs[i].setAttribute('d', `M${s * 12 - 5.4} -2.5Q${s * 12} -10.5 ${s * 12 + 5.4} -2.5`);
      arcs[i].setAttribute('opacity', String(pose.squint));
      glints[i].setAttribute('opacity', String(Math.max(0, 1 - pose.squint * 2) * Math.min(1, open * 2)));
      // Cejas: el lado de adentro baja al enojarse y sube al entristecerse
      const inner = -14 + pose.brow * 3.2, outer = -14 - pose.brow * 2.2;
      brows[i].setAttribute('d', `M${s * 6.5} ${inner}L${s * 17.5} ${outer}`);
      brows[i].setAttribute('opacity', String(Math.min(1, Math.abs(pose.brow))));
    });
    cheeks.forEach((cheek) => cheek.setAttribute('opacity', String(pose.blush * 0.75)));

    const talk = Math.max(move.talk, pose.eye > 1.2 ? 0.75 : 0);
    const width = 9.5 * (1 + 0.2 * Math.max(0, pose.smile)) * (1 - 0.4 * talk * (1 - Math.max(0, pose.smile)));
    const curve = pose.smile * 7.5;
    mouth.setAttribute('d', `M${-width} 12Q0 ${12 + curve - talk * 1.5} ${width} 12Q0 ${12 + curve + talk * 15} ${-width} 12Z`);
  }
  requestAnimationFrame(draw);

  // Parpadea solo, a intervalos irregulares
  (function blink() {
    setTimeout(() => {
      if (!still) animate(move, { blink: [0, 1, 0], duration: 190, ease: 'inOutQuad' });
      blink();
    }, 1800 + Math.random() * 3200);
  })();

  // Mira hacia donde anda el puntero
  window.addEventListener('pointermove', (event) => {
    const box = host.getBoundingClientRect();
    const dx = event.clientX - (box.left + box.width / 2), dy = event.clientY - (box.top + box.height / 2);
    const reach = Math.max(window.innerWidth, window.innerHeight) * 0.35;
    const len = Math.max(1, Math.hypot(dx, dy) / reach);
    pointer.x = dx / reach / len;
    pointer.y = dy / reach / len;
    animate(move, { lookX: pointer.x, lookY: pointer.y, duration: 300, ease: 'outQuad' });
  });

  const hop = (height = 1) => !still && animate(move, { hop: [0, height, 0], duration: 320, ease: 'outQuad' });

  return {
    feel(mood: Mood) {
      animate(pose, { ...POSES[mood], duration: still ? 0 : 600, ease: 'outBack(1.8)' });
    },
    state(next: State) {
      state = next;
      animate(move, {
        think: next === 'thinking' ? 1 : 0,
        // Al escuchar se inclina hacia quien le habla
        lean: next === 'listening' || next === 'hearing' ? 0.7 : 0,
        duration: still ? 0 : 420,
        ease: 'outQuad',
      });
    },
    /** Una letra dicha en voz alta: abre la boca y rebota apenas. */
    talk(char: string) {
      if (still || !/\p{L}/u.test(char)) return;
      animate(move, { talk: [0.85, 0.05], duration: 110, ease: 'outQuad' });
    },
    quiet() {
      move.talk = 0;
    },
    nod() {
      if (!still) animate(move, { hop: [0, 1, 0, 0.7, 0], duration: 620, ease: 'inOutQuad' });
    },
    beat: () => hop(0.5),
    level(value: number) {
      move.level = state === 'speaking' ? 0 : value;
    },
    /** Corazones que salen flotando: lo hace cuando está contento con vos. */
    love() {
      if (still) return;
      for (let i = 0; i < 4; i++) {
        const heart = document.createElement('span');
        heart.className = 'blob-heart';
        heart.textContent = '♥';
        host.append(heart);
        animate(heart, {
          x: [(Math.random() - 0.5) * 20, (Math.random() - 0.5) * 90],
          y: [0, -70 - Math.random() * 50],
          scale: [0.4, 1 + Math.random() * 0.6],
          opacity: [0, 1, 0],
          rotate: (Math.random() - 0.5) * 50,
          duration: 1300 + Math.random() * 500,
          delay: i * 110,
          ease: 'outQuad',
          onComplete: () => heart.remove(),
        });
      }
    },
  };
}
