import { animate, stagger, splitText } from 'animejs';
import { createGlyphField } from './glyph-field';
import { createOrbit } from './orbit';

type Side = 'left' | 'right' | 'center';

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.querySelector<HTMLCanvasElement>('#glyphs')!;
const field = createGlyphField(canvas);
const panels = [...document.querySelectorAll<HTMLElement>('[data-shape]')];

let active: HTMLElement | null = null;

// ── Labs: tarjetas en órbita alrededor de la forma ─────────────────────────
const labsPanel = document.querySelector<HTMLElement>('#labs')!;
const labDetails = [...labsPanel.querySelectorAll<HTMLElement>('[data-lab-detail]')];
const orbitRoot = document.querySelector<HTMLElement>('#orbit')!;
const labsShape = labsPanel.dataset.shape!;
let shownLab: string | null = null;

const orbit = createOrbit(orbitRoot, {
  center: field.center,
  onSelect(id) {
    if (id === shownLab) return;
    shownLab = id;
    // Sin tarjeta señalada vuelve la forma propia de la sección
    const shape = id ? orbitRoot.querySelector<HTMLElement>(`[data-lab="${id}"]`)!.dataset.labShape! : labsShape;
    if (active === labsPanel) {
      field.morph(shape);
    }
    for (const detail of labDetails) {
      const match = detail.dataset.labDetail === id;
      detail.hidden = !match;
      if (match && !still) {
        animate(detail.children, {
          y: { from: 18 },
          opacity: { from: 0 },
          duration: 700,
          delay: stagger(70),
          ease: 'outQuart',
        });
      }
    }
  },
});

// ── La forma sigue a la sección que cruza el centro de la pantalla ──────────
function follow() {
  const middle = window.innerHeight / 2;
  const panel = panels.find((el) => {
    const box = el.getBoundingClientRect();
    return box.top <= middle && box.bottom > middle;
  });
  if (!panel || panel === active) return;
  active = panel;
  const shape = panel.dataset.shape!;
  field.morph(shape, undefined, { side: (panel.dataset.side as Side) ?? 'center' });
  orbit.setActive(panel === labsPanel);
}

let queued = false;
window.addEventListener('scroll', () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    follow();
  });
}, { passive: true });
window.addEventListener('resize', follow);

// En pantallas angostas la forma viaja con su sección, en el espacio reservado
// arriba del texto, para que las letras nunca queden detrás de lo que se lee
field.setAnchor(() => (active ? active.getBoundingClientRect().top + window.innerHeight * 0.29 : null));

// ── Proyectos: una sola pantalla, la forma cambia con el proyecto elegido ──
const projectsPanel = document.querySelector<HTMLElement>('#proyectos')!;
const projectButtons = [...projectsPanel.querySelectorAll<HTMLButtonElement>('[data-project]')];
const details = [...projectsPanel.querySelectorAll<HTMLElement>('[data-detail]')];

function showProject(button: HTMLButtonElement) {
  if (button.getAttribute('aria-pressed') === 'true') return;
  for (const other of projectButtons) other.setAttribute('aria-pressed', String(other === button));
  const shape = button.dataset.projectShape!;
  projectsPanel.dataset.shape = shape;
  if (active === projectsPanel) {
    field.morph(shape);
  }
  for (const detail of details) {
    const match = detail.dataset.detail === button.dataset.project;
    detail.hidden = !match;
    if (match && !still) {
      animate(detail.children, {
        y: { from: 18 },
        opacity: { from: 0 },
        duration: 700,
        delay: stagger(70),
        ease: 'outQuart',
      });
    }
  }
}

for (const button of projectButtons) {
  button.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') showProject(button);
  });
  button.addEventListener('focus', () => showProject(button));
  button.addEventListener('click', () => showProject(button));
}

// Clic en cualquier zona libre: onda expansiva
window.addEventListener('pointerdown', (event) => {
  if ((event.target as HTMLElement).closest('a, button, input, summary')) return;
  field.pulse(event.clientX, event.clientY);
});

// ── Entrada del título ─────────────────────────────────────────────────────
function intro() {
  const lines = document.querySelectorAll<HTMLElement>('.hero h1 span');
  if (still) return;
  lines.forEach((line, row) => {
    const { chars } = splitText(line, { chars: true, words: true });
    animate(chars, {
      y: { from: '0.85em' },
      rotate: { from: () => (Math.random() - 0.5) * 50 },
      opacity: { from: 0 },
      duration: 1300,
      delay: stagger(34, { start: 350 + row * 260 }),
      ease: 'outExpo',
    });
  });
}

// ── Aparición de cada bloque ───────────────────────────────────────────────
function reveals() {
  const groups = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (still) {
    groups.forEach((group) => group.classList.add('shown'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      entry.target.classList.add('shown');
      animate(entry.target.children, {
        y: { from: 34 },
        opacity: { from: 0 },
        duration: 1000,
        delay: stagger(85, { start: 120 }),
        ease: 'outQuart',
      });
    }
  }, { threshold: 0.3 });
  groups.forEach((group) => observer.observe(group));
}

intro();
reveals();

// Las letras empiezan sueltas y arman la primera forma cuando cargan las fuentes
document.fonts.ready.then(() => {
  setTimeout(follow, still ? 0 : 900);
});
