import { animate, stagger, splitText } from 'animejs';
import { createAsciiField, type Scene } from './ascii-field';
import { createGlyphField } from './glyph-field';
import { createAgent } from './agent';
import { createOrbit } from './orbit';
import { SHAPES, text as textShape } from './shapes';

type Side = 'left' | 'right' | 'center';

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.querySelector<HTMLCanvasElement>('#glyphs')!;
// La portada tiene muchos elementos chicos: hace falta más letras que el valor por defecto
const field = createGlyphField(canvas, { count: [1200, 2000] });
// Detrás de las letras sueltas, la escena ASCII de cada sección
const backdrop = createAsciiField(document.querySelector<HTMLCanvasElement>('#scene')!);
backdrop?.follow(field.center);
const panels = [...document.querySelectorAll<HTMLElement>('[data-shape]')];

let active: HTMLElement | null = null;

/** Cambia la forma de letras y tiñe el fondo con su color. */
function morph(shape: string, options?: Parameters<typeof field.morph>[2]) {
  field.morph(shape, undefined, options);
  const accent = SHAPES[shape]?.accent;
  if (accent) backdrop?.setAccent(accent);
}

// ── Labs: tarjetas en órbita alrededor de la forma ─────────────────────────
const labsPanel = document.querySelector<HTMLElement>('#labs')!;
const labDetails = [...labsPanel.querySelectorAll<HTMLElement>('[data-lab-detail]')];
const orbitRoot = document.querySelector<HTMLElement>('#orbit')!;
const labsShape = labsPanel.dataset.shape!;
let shownLab: string | null = null;

/** Muestra uno de varios bloques de detalle y hace entrar su contenido. */
function swap(details: HTMLElement[], match: (detail: HTMLElement) => boolean) {
  for (const detail of details) {
    const on = match(detail);
    detail.hidden = !on;
    if (on && !still) {
      animate(detail.children, {
        y: { from: 14 },
        opacity: { from: 0 },
        duration: 620,
        delay: stagger(60),
        ease: 'outQuart',
      });
    }
  }
}

const orbit = createOrbit(orbitRoot, {
  center: field.center,
  onSelect(id) {
    if (id === shownLab) return;
    shownLab = id;
    // Sin tarjeta señalada vuelve la forma propia de la sección
    const shape = id ? orbitRoot.querySelector<HTMLElement>(`[data-lab="${id}"]`)!.dataset.labShape! : labsShape;
    if (active === labsPanel) morph(shape);
    swap(labDetails, (detail) => detail.dataset.labDetail === id);
  },
});

// ── Portada: una secuencia en bucle ────────────────────────────────────────
// La laptop escribe el código; cuando llega a `ship()`, las letras despegan
// como un cohete y vuelven a armar la escena.
const hero = document.querySelector<HTMLElement>('#inicio')!;
const ACTS: { shape: string; flight: 'vortex' | 'rise' | 'burst'; hold: number }[] = [
  { shape: 'summit', flight: 'vortex', hold: 19500 },
  { shape: 'rocket', flight: 'rise', hold: 5200 },
];
let act = 0;
let curtain = 0;

function play(next: number) {
  clearTimeout(curtain);
  act = next % ACTS.length;
  const { shape, flight, hold } = ACTS[act];
  morph(shape, { flight });
  if (act) {
    // Despegue: una onda sale desde donde estaba la laptop
    const { x, y } = field.center();
    field.pulse(x, y);
    backdrop?.pulse(x, y);
  }
  if (!still) curtain = window.setTimeout(() => active === hero && play(act + 1), hold);
}

// ── La forma y la escena siguen a la sección que cruza el centro ───────────
const marks = [...document.querySelectorAll<HTMLElement>('[data-nav], [data-rail]')];
const nav = document.querySelector<HTMLElement>('nav')!;
const navMark = nav.querySelector<HTMLElement>('.nav-mark')!;

function mark(id: string) {
  // Tecnologías no está en el menú: sigue marcada la sección de la que forma parte
  const inMenu = id === 'tecnologias' ? 'sobre-mi' : id;
  let current: HTMLElement | null = null;
  for (const link of marks) {
    const on = link.dataset.rail === id || link.dataset.nav === inMenu;
    if (on) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
    if (on && link.dataset.nav) current = link;
  }
  navMark.style.opacity = current ? '1' : '0';
  if (current) {
    navMark.style.width = `${current.offsetWidth}px`;
    navMark.style.translate = `${current.offsetLeft}px 0`;
  }
}

function follow() {
  const middle = window.innerHeight / 2;
  const panel = panels.find((el) => {
    const box = el.getBoundingClientRect();
    return box.top <= middle && box.bottom > middle;
  });
  if (!panel || panel === active) return;
  active = panel;
  const side = (panel.dataset.side as Side) ?? 'center';
  const shape = panel.dataset.shape!;
  clearTimeout(curtain);
  if (panel === hero) {
    field.morph(shape, undefined, { side });
    play(0);
  } else {
    morph(shape, { side });
  }
  backdrop?.show(panel.dataset.scene as Scene, side, SHAPES[shape]?.accent);
  orbit.setActive(panel === labsPanel);
  mark(panel.id);
}

const header = document.querySelector<HTMLElement>('#top')!;
let queued = false;
window.addEventListener('scroll', () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    header.classList.toggle('scrolled', window.scrollY > 24);
    follow();
  });
}, { passive: true });
window.addEventListener('resize', () => {
  follow();
  if (active) mark(active.id);
});

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
  if (active === projectsPanel) morph(shape);
  swap(details, (detail) => detail.dataset.detail === button.dataset.project);
}

for (const button of projectButtons) {
  button.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') showProject(button);
  });
  button.addEventListener('focus', () => showProject(button));
  button.addEventListener('click', () => showProject(button));
}

// Clic en cualquier zona libre: onda expansiva en las letras y en el fondo
window.addEventListener('pointerdown', (event) => {
  if ((event.target as HTMLElement).closest('a, button, input, summary, .agent')) return;
  field.pulse(event.clientX, event.clientY);
  backdrop?.pulse(event.clientX, event.clientY);
});

// ── Entrada del título ─────────────────────────────────────────────────────
function intro() {
  if (still) return;
  document.querySelectorAll<HTMLElement>('.hero h1 span').forEach((line, row) => {
    const { chars } = splitText(line, { chars: true, words: true });
    animate(chars, {
      y: { from: '0.5em' },
      opacity: { from: 0 },
      duration: 1100,
      delay: stagger(18, { start: 250 + row * 220 }),
      ease: 'outExpo',
    });
  });
}

// ── Aparición de cada bloque: el CSS hace la transición, acá solo se dispara ──
function reveals() {
  const groups = document.querySelectorAll<HTMLElement>('[data-reveal]');
  groups.forEach((group) => [...group.children].forEach((child, i) => (child as HTMLElement).style.setProperty('--i', String(i))));
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      entry.target.classList.add('shown');
    }
  }, { threshold: 0.25 });
  groups.forEach((group) => observer.observe(group));
}

// ── Detalles ───────────────────────────────────────────────────────────────
// Hora de Mendoza, al lado del nombre
const clock = document.querySelector<HTMLElement>('#clock')!;
const hour = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Mendoza', hour: '2-digit', minute: '2-digit', hour12: false });
const tick = () => (clock.textContent = hour.format(new Date()));
tick();
setInterval(tick, 20000);

document.addEventListener('click', (event) => {
  const copy = (event.target as HTMLElement).closest<HTMLElement>('main [data-copy]');
  if (!copy) return;
  navigator.clipboard?.writeText(copy.dataset.copy!);
  const note = copy.querySelector('span')!;
  note.textContent = 'Copiado';
  setTimeout(() => (note.textContent = 'Copiar'), 1800);
});

createAgent({
  write(text) {
    clearTimeout(curtain);
    field.morph(`word:${text}`, { build: textShape(text.toUpperCase()), float: 0.012, accent: [255, 122, 61] }, { flight: 'vortex' });
  },
  showProject: (id) => {
    const button = projectButtons.find((item) => item.dataset.project === id);
    if (button) showProject(button);
  },
  section: () => active?.id ?? 'inicio',
});

// El botón de la portada abre a Mimo
document.querySelector('#call-agent')!.addEventListener('click', () => {
  const orb = document.querySelector<HTMLButtonElement>('#agent-orb')!;
  if (orb.getAttribute('aria-pressed') !== 'true') orb.click();
});

intro();
reveals();

// Para ajustar una escena del fondo: /?escena=cordillera la muestra sola
const preview = new URLSearchParams(location.search).get('escena') as Scene | null;
if (preview && backdrop) {
  document.body.classList.add('scene-only');
  backdrop.bare();
  backdrop.show(preview);
  panels.length = 0;
}

// Las letras empiezan sueltas y arman la primera forma cuando cargan las fuentes
document.fonts.ready.then(() => {
  setTimeout(follow, still ? 0 : 900);
});
