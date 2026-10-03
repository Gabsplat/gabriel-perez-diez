import { animate, stagger } from 'animejs';

// Tarjetas de Labs. Aparecen cuando la sección está activa y giran en órbita
// alrededor de la forma de letras. No se pueden mover: son enlaces.

interface Card {
  el: HTMLElement;
  presence: number;
  tilt: number;
}

interface Options {
  /** Centro de la órbita, en píxeles de pantalla. */
  center: () => { x: number; y: number };
  /** Tarjeta señalada, o `null` cuando no hay ninguna. */
  onSelect: (id: string | null) => void;
}

export function createOrbit(root: HTMLElement, { center, onSelect }: Options) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cards: Card[] = [...root.querySelectorAll<HTMLElement>('[data-lab]')].map((el, i) => ({
    el, presence: 0, tilt: (i % 2 ? 1 : -1) * (4 + i * 1.5),
  }));
  const orbit = { angle: -0.6, speed: 1 };
  let active = false;
  let running = false;
  let last = 0;
  let fade: ReturnType<typeof animate> | null = null;

  function frame(now: number) {
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    if (!still) orbit.angle += dt * 0.16 * orbit.speed;

    const w = window.innerWidth, h = window.innerHeight;
    const narrow = w < 820;
    const c = center();
    const rx = narrow ? w * 0.33 : Math.min(w * 0.2, 330);
    const ry = narrow ? h * 0.19 : Math.min(h * 0.34, 320);

    let busy = active;
    cards.forEach((card, i) => {
      const a = orbit.angle + (i / cards.length) * Math.PI * 2;
      const el = card.el;
      const k = card.presence;
      if (k > 0.001) busy = true;
      const x = c.x + Math.cos(a) * rx - el.offsetWidth / 2;
      const y = c.y + Math.sin(a) * ry - el.offsetHeight / 2;
      el.style.transform = `translate3d(${x}px,${y}px,0) rotate(${card.tilt}deg) scale(${0.8 + 0.2 * k})`;
      el.style.opacity = String(k);
    });

    if (busy) requestAnimationFrame(frame);
    else {
      running = false;
      root.hidden = true;
    }
  }

  function setActive(on: boolean) {
    if (on === active) return;
    active = on;
    if (on) root.hidden = false;
    else select(null);
    // Sin cancelar, las tarjetas que todavía esperaban su turno para entrar
    // aparecían después de haber salido de la sección
    fade?.cancel();
    fade = animate(cards, {
      presence: on ? 1 : 0,
      duration: still ? 0 : on ? 700 : 300,
      delay: still ? 0 : stagger(on ? 110 : 0),
      ease: 'outQuart',
    });
    if (!running) {
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    }
  }

  function select(card: Card | null) {
    for (const other of cards) other.el.classList.toggle('on', other === card);
    onSelect(card ? card.el.dataset.lab! : null);
  }

  // La órbita se frena mientras se señala una tarjeta, para poder hacer clic
  const cruise = (speed: number) => animate(orbit, { speed, duration: 500, ease: 'outQuad' });

  cards.forEach((card) => {
    const el = card.el;
    el.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'mouse') return;
      select(card);
      cruise(0);
    });
    el.addEventListener('pointerleave', (event) => {
      if (event.pointerType !== 'mouse') return;
      select(null);
      cruise(1);
    });
    el.addEventListener('focus', () => select(card));
    el.addEventListener('blur', () => select(null));
    // Sin destino todavía: el toque muestra la descripción en lugar de navegar
    el.addEventListener('click', (event) => {
      if (el.getAttribute('href') !== '#labs') return;
      event.preventDefault();
      select(card);
    });
  });

  return { setActive };
}
