import { animate, stagger, splitText } from 'animejs';
import { createAsciiField, type Scene } from './ascii-field';
import { setupLabs } from './labs';
import { createStory } from './story';
import { photoText } from '../data/family';
import { SHAPES } from './shapes';

type Side = 'left' | 'right' | 'center';

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Cada sección tiene su escena de letras de fondo; lo que se elige en la sección
// (un proyecto, un experimento) cambia esa misma escena, sin nada encima
const lang = document.documentElement.lang === 'en' ? 'en' : 'es';
// La foto de la familia se escribe con los nombres de todos
// Al grabar el teaser (?rodaje) el espacio no lleva los nombres de la familia
const recording = new URLSearchParams(location.search).has('rodaje');
const backdrop = createAsciiField(document.querySelector<HTMLCanvasElement>('#scene')!, { photoText: recording ? 'prompting the universe · gabsplat.dev · ' : photoText(lang) });
// El centro de las escenas que se arman alrededor de un punto (lava, átomo, planeta):
// del lado contrario al texto, o arriba del texto en pantallas angostas
backdrop?.follow(() => {
  const side = active?.dataset.side;
  if (innerWidth < 820) return { x: innerWidth / 2, y: active ? Math.max(innerHeight * 0.22, active.getBoundingClientRect().top + innerHeight * 0.29) : innerHeight / 2 };
  return { x: innerWidth * (side === 'left' ? 0.27 : side === 'right' ? 0.73 : 0.5), y: innerHeight * 0.52 };
});
const panels = [...document.querySelectorAll<HTMLElement>('[data-shape]')];

let active: HTMLElement | null = null;

/** Tiñe el fondo con el color de una forma del catálogo. */
function tint(shape: string) {
  const accent = SHAPES[shape]?.accent;
  if (accent) backdrop?.setAccent(accent);
}

// ── Labs: una hoja de contactos; el experimento señalado cambia la lava ────
const labsPanel = document.querySelector<HTMLElement>('#labs')!;
const labsShape = labsPanel.dataset.shape!;
// Variante de la lava de cada experimento, en el orden de data/site.ts
const LAB_VARIANT: Record<string, number> = { personaje: 1, microondas: 2, maquinas: 3, carbono: 4 };
let labVariant = 0;
setupLabs(labsPanel.querySelector<HTMLElement>('[data-labs]')!, (lab) => {
  labVariant = lab ? LAB_VARIANT[lab.id] ?? 0 : 0;
  if (active !== labsPanel) return;
  tint(lab?.shape ?? labsShape);
  backdrop?.setVariant(labVariant);
});

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

// ── Portada: la cordillera es la protagonista ───────────────────────────
// Las letras sueltas se dispersan y se apagan: en la portada no hay forma, y
// vuelven a armarse al bajar a la sección siguiente
const hero = document.querySelector<HTMLElement>('#inicio')!;
// Celeste de la bandera, para el puntero y las ondas sobre los Andes
const CELESTE: [number, number, number] = [116, 172, 223];

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
  // La ciudad y la lava muestran lo que está elegido en su sección; el resto, la variante común
  backdrop?.setVariant(panel === projectsPanel ? tuned + 1 : panel === labsPanel ? labVariant : 0);
  backdrop?.show(panel.dataset.scene as Scene, side, panel === hero ? CELESTE : SHAPES[shape]?.accent);
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


// ── Proyectos: un dial con una estación por proyecto ──────────────────────
// La forma, el color y el texto cambian con la estación; arrastrando la aguja
// se pasa por todas, como al sintonizar una radio.
const projectsPanel = document.querySelector<HTMLElement>('#proyectos')!;
const stations = [...projectsPanel.querySelectorAll<HTMLButtonElement>('.station')];
const details = [...projectsPanel.querySelectorAll<HTMLElement>('[data-detail]')];
const dial = projectsPanel.querySelector<HTMLElement>('.dial')!;
const projectNow = projectsPanel.querySelector<HTMLElement>('#project-now')!;
const stationAt = (index: number) => (stations.length > 1 ? index / (stations.length - 1) : 0.5);
let tuned = 0;

// Al cambiar de proyecto el nombre entra letra por letra, sin reemplazar ninguna
function scramble(target: HTMLElement) {
  const name = target.dataset.name!;
  target.replaceChildren(...[...name].map((char) => Object.assign(document.createElement('span'), { textContent: char, style: 'display:inline-block;white-space:pre' })));
  if (still) return;
  animate(target.children, { opacity: [0, 1], y: ['0.4em', '0em'], duration: 700, delay: stagger(28), ease: 'outBack(1.7)' });
}

/** Elige un proyecto. `snap` lleva la aguja a su estación (al arrastrar, la aguja va con el dedo). */
function showProject(index: number, snap = true) {
  index = Math.max(0, Math.min(stations.length - 1, index));
  if (snap) dial.style.setProperty('--needle', String(stationAt(index)));
  const station = stations[index];
  if (station.getAttribute('aria-pressed') === 'true') return;
  tuned = index;
  for (const other of stations) other.setAttribute('aria-pressed', String(other === station));
  dial.setAttribute('aria-valuenow', String(index + 1));
  dial.setAttribute('aria-valuetext', station.dataset.name!);
  projectNow.textContent = String(index + 1).padStart(2, '0');
  const shape = station.dataset.projectShape!;
  projectsPanel.dataset.shape = shape;
  const accent = SHAPES[shape]?.accent;
  if (accent) projectsPanel.style.setProperty('--tint', `rgb(${accent.join(' ')})`);
  if (active === projectsPanel) {
    tint(shape);
    backdrop?.setVariant(index + 1);
  }
  swap(details, (detail) => detail.dataset.detail === station.dataset.project);
  scramble(details[index].querySelector<HTMLElement>('[data-name]')!);
}

/** Lleva la aguja bajo el puntero y sintoniza la estación más cercana. */
function tune(clientX: number) {
  const box = dial.getBoundingClientRect();
  const pad = 14;
  const at = Math.max(0, Math.min(1, (clientX - box.left - pad) / (box.width - pad * 2)));
  dial.style.setProperty('--needle', String(at));
  showProject(stations.length > 1 ? Math.round(at * (stations.length - 1)) : 0, false);
}

let dragging = false;
dial.addEventListener('pointerdown', (event) => {
  dragging = true;
  dial.setPointerCapture(event.pointerId);
  dial.classList.add('dragging');
  tune(event.clientX);
});
dial.addEventListener('pointermove', (event) => dragging && tune(event.clientX));
for (const type of ['pointerup', 'pointercancel']) {
  dial.addEventListener(type, () => {
    if (!dragging) return;
    dragging = false;
    dial.classList.remove('dragging');
    // Al soltar, la aguja cae en la estación elegida
    dial.style.setProperty('--needle', String(stationAt(tuned)));
  });
}
dial.addEventListener('keydown', (event) => {
  const moves: Record<string, number> = { ArrowRight: tuned + 1, ArrowUp: tuned + 1, ArrowLeft: tuned - 1, ArrowDown: tuned - 1, Home: 0, End: stations.length - 1 };
  if (!(event.key in moves)) return;
  event.preventDefault();
  showProject(moves[event.key]);
});
// Las flechas dan la vuelta: después del último viene el primero
for (const button of projectsPanel.querySelectorAll<HTMLButtonElement>('.tune')) {
  button.addEventListener('click', () => showProject((tuned + Number(button.dataset.step) + stations.length) % stations.length));
}
// El color del primer proyecto, antes de tocar nada
projectsPanel.style.setProperty('--tint', `rgb(${(SHAPES[stations[0].dataset.projectShape!]?.accent ?? [255, 122, 61]).join(' ')})`);

// Clic en cualquier zona libre: onda expansiva en las letras y en el fondo
window.addEventListener('pointerdown', (event) => {
  if ((event.target as HTMLElement).closest('a, button, input, summary, .dial')) return;
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
  const original = note.textContent;
  note.textContent = copy.dataset.copied ?? '✓';
  setTimeout(() => (note.textContent = original), 1800);
});

// El selector de idioma recuerda la elección
document.querySelectorAll<HTMLAnchorElement>('[data-lang]').forEach((link) =>
  link.addEventListener('click', () => {
    try {
      localStorage.setItem('lang', link.dataset.lang!);
    } catch {}
  }),
);

// ── La historia de Gabriel: desde la montaña de la portada ──────────────
const storyRoot = document.querySelector<HTMLElement>('#story')!;
const replay = document.querySelector<HTMLButtonElement>('#story-replay')!;
// El sonido de la historia: prendido salvo que la persona lo haya apagado antes
const soundButton = document.querySelector<HTMLButtonElement>('#story-sound')!;
try {
  if (localStorage.getItem('storySound') === 'off') soundButton.setAttribute('aria-pressed', 'false');
} catch {}
soundButton.addEventListener('click', () => {
  const on = soundButton.getAttribute('aria-pressed') !== 'true';
  soundButton.setAttribute('aria-pressed', String(on));
  story?.setMuted(!on);
  try {
    localStorage.setItem('storySound', on ? 'on' : 'off');
  } catch {}
});
const storyEnd = document.querySelector<HTMLElement>('#story-end')!;

/** El final: el botón para volver aparece con un rebote. */
function showEnd() {
  storyEnd.hidden = false;
  if (still) return;
  animate(storyEnd.children, {
    opacity: [0, 1],
    scale: [{ from: 0.6, to: 1.06, duration: 380, ease: 'outQuad' }, { to: 1, duration: 520, ease: 'outElastic(1, .5)' }],
    delay: stagger(140),
  });
}
let story: ReturnType<typeof createStory> | null = null;
let video: Promise<void> | null = null;

// El video de la Live Photo se baja recién al apretar play
function loadVideo(field: NonNullable<typeof backdrop>) {
  video ??= (() => {
    const element = Object.assign(document.createElement('video'), { src: '/family/vivo.mp4', muted: true, loop: true, playsInline: true, preload: 'auto' });
    return element.play().catch(() => undefined).then(() => field.setPhoto(element));
  })();
  return video;
}

function openStory() {
  if (!backdrop) return;
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.documentElement.classList.add('story-on');
  storyRoot.hidden = false;
  storyEnd.hidden = true;
  backdrop.focus(true);
  story ??= createStory({ field: backdrop, stage: document.querySelector<HTMLElement>('#story-stage')!, lang, script: 'me', music: '/audio/historia.mp3', onEnd: showEnd });
  story.setMuted(soundButton.getAttribute('aria-pressed') !== 'true');
  const current = story;
  loadVideo(backdrop).then(() => current.play());
}

function closeStory() {
  if (storyRoot.hidden || !backdrop) return;
  story?.stop();
  storyRoot.hidden = true;
  storyEnd.hidden = true;
  document.documentElement.classList.remove('story-on');
  backdrop.focus(false);
  // La foto se cierra de vuelta en la montaña
  backdrop.show('andes', 'right', CELESTE, { iris: true, duration: 1200 });
}

document.querySelector('#play-story')!.addEventListener('click', openStory);
document.querySelector('#story-close')!.addEventListener('click', closeStory);
replay.addEventListener('click', () => {
  storyEnd.hidden = true;
  story?.play();
});
document.querySelector('#story-home')!.addEventListener('click', closeStory);
window.addEventListener('keydown', (event) => event.key === 'Escape' && closeStory());

intro();
reveals();

// Para ajustar una escena del fondo: /?escena=andes la muestra sola
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
