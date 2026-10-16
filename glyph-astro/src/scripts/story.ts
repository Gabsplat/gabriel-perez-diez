import { animate, createTimeline, stagger, type JSAnimation, type Timeline } from 'animejs';
import type { AsciiField } from './ascii-field';
import { BEATS, STORY_COPY, type Beat } from '../data/family';
import { CHAPTERS, JOURNEY_COPY } from '../data/journey';
import type { Lang } from '../data/site';

// La historia de la familia, sobre el fondo de letras: la cordillera con una
// frase, la montaña que se abre como un iris, y una cámara que va de cara en
// cara. El movimiento sigue los principios de Disney:
// - anticipación: antes de acercarse, la cámara se aleja apenas;
// - arcos: x e y viajan con curvas distintas, así el recorrido es curvo;
// - estirar y encoger: el halo se agranda al viajar y rebota al llegar;
// - acción superpuesta: el rol y el nombre entran letra por letra y
//   la frase llega después; la tarjeta anterior se va mientras la cámara viaja.
// Una línea celeste une el halo con la tarjeta, como una llamada.

// Viaje de la cámara de una cara a la otra, en milisegundos
const MOVE = 1000;

// Un Iron Man chiquito: casco rojo, máscara dorada, reactor en el pecho y propulsores
const IRON_MAN = `<svg viewBox="0 0 64 108" aria-hidden="true">
  <g class="flame"><path d="M21 86c-3 9 0 17 3.5 20 3.5-3 6.5-11 3.5-20z" fill="#ffb02e"/><path d="M23 88c-1.5 6 0 11 1.5 13 1.5-2 3-7 1.5-13z" fill="#fff4c2"/></g>
  <g class="flame"><path d="M36 86c-3 9 0 17 3.5 20 3.5-3 6.5-11 3.5-20z" fill="#ffb02e"/><path d="M38 88c-1.5 6 0 11 1.5 13 1.5-2 3-7 1.5-13z" fill="#fff4c2"/></g>
  <rect x="19.5" y="62" width="10" height="26" rx="3.5" fill="#c8102e"/>
  <rect x="34.5" y="62" width="10" height="26" rx="3.5" fill="#c8102e"/>
  <rect x="19.5" y="72" width="10" height="5" fill="#e8b33a"/>
  <rect x="34.5" y="72" width="10" height="5" fill="#e8b33a"/>
  <rect x="5" y="37" width="10" height="24" rx="4.5" fill="#c8102e" transform="rotate(16 10 38)"/>
  <rect x="49" y="15" width="10" height="24" rx="4.5" fill="#c8102e" transform="rotate(-24 54 38)"/>
  <circle class="repulsor" cx="58" cy="15" r="4.5" fill="#bff6ff"/>
  <path d="M15 36h34l-4 29H19z" fill="#c8102e"/>
  <path d="M23 38h18l-2.5 11h-13z" fill="#e8b33a"/>
  <circle class="reactor" cx="32" cy="46" r="4" fill="#d8fbff"/>
  <path d="M17 19C17 7 24 2 32 2s15 5 15 17v8c0 7-5 9.5-7 10H24c-2-.5-7-3-7-10z" fill="#c8102e"/>
  <path d="M21.5 15.5c6.5-3 14.5-3 21 0V25c0 5-3 7.5-4.5 8H26c-1.5-.5-4.5-3-4.5-8z" fill="#e8b33a"/>
  <path d="M24.5 19.5h6l-1 2.5h-5zM33.5 19.5h6v2.5h-5z" fill="#eafcff"/>
</svg>`;

interface Options {
  field: AsciiField;
  /** Capa donde se dibujan las frases y las tarjetas. */
  stage: HTMLElement;
  lang: Lang;
  /** Qué historia: la de la familia, o la de Gabriel (por defecto, la familia). */
  script?: 'family' | 'me';
  /** Al terminar: aparecen estos botones (volver, ver de nuevo). */
  onEnd?: () => void;
}

const words = (text: string) => text.split(' ').length;
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = '') =>
  Object.assign(document.createElement(tag), { className, textContent: text });
const span = (className: string, text = '') => element('span', className, text);

/** Separa un texto en letras animables, sin cortar las palabras. */
function letters(target: HTMLElement, text: string) {
  target.replaceChildren(
    ...text.split(' ').flatMap((word, i, all) => {
      const box = span('word');
      box.append(...[...word].map((char) => span('char', char)));
      return i < all.length - 1 ? [box, document.createTextNode(' ')] : [box];
    }),
  );
  return target.querySelectorAll<HTMLElement>('.char');
}

export function createStory({ field, stage, lang, script = 'family', onEnd }: Options) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const copy = STORY_COPY[lang];
  const { lens } = field;

  // Escenario: frase central, línea de llamada, tarjeta, corazón y el héroe
  const line = element('p', 'story-line');
  const card = element('div', 'story-card');
  const heart = element('div', 'story-heart');
  heart.innerHTML = '<svg viewBox="0 0 32 29" aria-hidden="true"><path d="M16 29 2.4 15.6A8.3 8.3 0 0 1 14.2 3.8L16 5.6l1.8-1.8a8.3 8.3 0 0 1 11.8 11.8z"/></svg>';
  const link = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  link.setAttribute('class', 'story-link');
  link.innerHTML = '<path pathLength="1" />';
  const path = link.querySelector('path')!;
  const hero = element('div', 'story-hero');
  const fly = element('div', 'hero-fly');
  fly.innerHTML = IRON_MAN;
  hero.append(fly);
  // La polaroid del Dibu Martínez, el arquero que Fausti imita
  const dibu = element('figure', 'story-dibu');
  dibu.innerHTML = `<img src="/family/dibu.webp" alt="Dibu Martínez" width="360" height="407" /><figcaption>Dibu Martínez<small>${lang === 'en' ? 'photo' : 'foto'}: Sebas · CC BY 3.0</small></figcaption>`;
  // Línea chica debajo de la frase, para los capítulos de la historia de Gabriel
  const sub = element('p', 'story-sub');
  const cast = [link, line, sub, card, heart, hero, dibu];
  stage.replaceChildren(...cast);

  let timeline: Timeline | null = null;
  let heartAt: [number, number] | null = null;
  // La cara de Fausti: el héroe y la polaroid se ubican a su alrededor
  let kid: { u: number; v: number; r: number } | null = null;
  let linked = false;
  let following = 0;
  let bobbing: JSAnimation | null = null;

  const narrow = () => innerWidth < 820;
  /** Dónde va la cara en pantalla: a un costado de la tarjeta, o arriba en el celular. */
  const spot = () => (narrow() ? [innerWidth * 0.5, innerHeight * 0.34] : [innerWidth * 0.36, innerHeight * 0.48]);

  // Lo que sigue a la cámara en cada cuadro: el corazón, el héroe y la línea
  function follow() {
    if (heartAt) {
      const { x, y } = field.photoToScreen(heartAt[0], heartAt[1]);
      heart.style.translate = `${x}px ${y}px`;
    }
    if (kid) {
      // En múltiplos del radio de la cara en pantalla, sin salirse de los bordes
      const face = field.photoToScreen(kid.u, kid.v);
      const radius = field.photoToScreen(kid.u + kid.r, kid.v).x - face.x;
      const keep = (x: number, y: number) => `${Math.min(innerWidth - 60, Math.max(60, x))}px ${Math.min(innerHeight - 90, Math.max(80, y))}px`;
      hero.style.translate = keep(face.x - radius * 1.7, face.y - radius * 2.1);
      dibu.style.translate = narrow() ? keep(face.x + radius * 1.9, face.y - radius * 1.2) : keep(face.x - radius * 3.1, face.y + radius * 0.9);
    }
    if (linked) {
      const box = card.getBoundingClientRect();
      // Sale del borde del halo y llega a la tarjeta con una curva suave
      const from = narrow() ? field.photoToScreen(lens.hx, lens.hy + lens.hr * 1.45) : field.photoToScreen(lens.hx + lens.hr * 1.45, lens.hy);
      // En el celular termina arriba del contador, sin cruzarlo
      const [ex, ey] = narrow() ? [box.left + box.width / 2, box.top - 40] : [box.left - 18, box.top + 14];
      path.setAttribute(
        'd',
        narrow()
          ? `M${from.x} ${from.y}C${from.x} ${from.y + 50} ${ex} ${ey - 50} ${ex} ${ey}`
          : `M${from.x} ${from.y}C${from.x + 70} ${from.y} ${ex - 80} ${ey} ${ex} ${ey}`,
      );
    }
    following = requestAnimationFrame(follow);
  }

  function say(text: string, size: '' | 'big' | 'finale' = '') {
    line.classList.toggle('big', size === 'big');
    line.classList.toggle('finale', size === 'finale');
    line.classList.remove('chapter');
    const chars = letters(line, text);
    return animate(chars, {
      opacity: [0, 1],
      y: ['0.55em', '0em'],
      scale: [0.7, 1],
      duration: still ? 0 : 900,
      delay: still ? 0 : stagger(42),
      ease: 'outBack(1.9)',
    });
  }
  // Salida con anticipación: las letras se agachan y salen hacia arriba
  const unsay = () =>
    animate(line.querySelectorAll('.char'), { opacity: 0, y: '-0.5em', duration: still ? 0 : 360, delay: still ? 0 : stagger(10), ease: 'inBack(1.6)' });

  /**
   * Las letras entran una por una: suben con un rebote y pasan de celeste a su
   * color. Nunca se reemplaza ninguna, así el texto siempre es el correcto.
   */
  function rise(chars: NodeListOf<HTMLElement>, delay: number, step: number) {
    if (!chars.length) return;
    animate(chars, {
      opacity: [0, 1],
      y: ['0.45em', '0em'],
      scale: [0.8, 1],
      duration: 760,
      delay: stagger(step, { start: delay }),
      ease: 'outBack(1.8)',
    });
    chars.forEach((char) => char.classList.add('fresh'));
    setTimeout(() => chars.forEach((char) => char.classList.remove('fresh')), delay + chars.length * step + 500);
  }

  /** Arma la tarjeta de una parada y la hace entrar. */
  function showCard(beat: Beat, index: number) {
    card.className = `story-card${beat.me ? ' me' : ''}${beat.members.length > 1 ? ' pair' : ''}`;
    const tally = span('tally', `${String(index + 1).padStart(2, '0')} / ${String(BEATS.length).padStart(2, '0')}`);
    card.replaceChildren(
      tally,
      ...beat.members.map((member) => {
        const entry = span('entry');
        const role = span('role');
        letters(role, member.role[lang]);
        const name = span('name');
        letters(name, member.name);
        const quip = span('quip');
        letters(quip, member.quip[lang]);
        entry.append(...(member.role[lang] ? [role] : []), name, quip);
        return entry;
      }),
    );
    // La salida de la tarjeta anterior no puede pisar a esta
    hiding?.cancel();
    hiding = null;
    card.style.opacity = '1';
    card.style.transform = '';
    linked = true;
    if (still) return void (path.style.strokeDashoffset = '0');
    animate(path, { strokeDashoffset: [1, 0], duration: 850, ease: 'outCubic' });
    animate(tally, { opacity: [0, 1], x: [-10, 0], duration: 500, ease: 'outCubic' });
    rise(card.querySelectorAll<HTMLElement>('.role .char'), 150, 20);
    rise(card.querySelectorAll<HTMLElement>('.name .char'), 320, 65);
    animate(card.querySelectorAll('.quip .word'), { opacity: [0, 1], y: [12, 0], duration: 650, delay: stagger(90, { start: 800 }), ease: 'outQuart' });
  }

  let hiding: JSAnimation | null = null;
  const hideCard = () => {
    linked = false;
    animate(path, { strokeDashoffset: -1, duration: still ? 0 : 220, ease: 'inQuad' });
    hiding = animate(card, { opacity: 0, scale: [1, 0.96], duration: still ? 0 : 320, ease: 'inQuad' });
  };

  function popHeart() {
    if (still) return void (heart.style.opacity = '1');
    animate(heart, {
      opacity: [0, 1],
      // Estira y encoge: aparece aplastado, se pasa de tamaño y se acomoda
      scaleX: [{ to: 1.35, duration: 220, ease: 'outQuad' }, { to: 0.9, duration: 160 }, { to: 1, duration: 420, ease: 'outElastic(1, .5)' }],
      scaleY: [{ to: 0.75, duration: 220, ease: 'outQuad' }, { to: 1.15, duration: 160 }, { to: 1, duration: 420, ease: 'outElastic(1, .5)' }],
      duration: 800,
    });
    // Y late dos veces
    animate(heart, { scale: [1, 1.14, 1], duration: 380, delay: 900, loop: 2, ease: 'inOutSine' });
  }

  /** El héroe llega volando en arco desde el cielo, aterriza con un rebote y se queda flotando. */
  function flyIn(beat: Beat) {
    kid = beat.members[0];
    hero.style.opacity = dibu.style.opacity = '1';
    if (still) return;
    // La polaroid cae girando y rebota, un poco antes de que llegue el héroe
    animate(dibu, {
      scale: [{ from: 0, to: 1.12, duration: 380, ease: 'outQuad' }, { to: 1, duration: 520, ease: 'outElastic(1, .5)' }],
      rotate: [{ from: -30, to: -4, duration: 900, ease: 'outElastic(1, .6)' }],
    });
    bobbing?.cancel();
    animate(fly, { x: [620, 0], duration: 1150, ease: 'outCubic' });
    animate(fly, { y: [-460, 0], duration: 1150, ease: 'outQuad' });
    animate(fly, { rotate: [-38, 0], duration: 1300, ease: 'outElastic(1, .6)' });
    // Aterrizaje: se aplasta y se estira antes de quedarse quieto
    animate(fly, {
      scaleY: [{ to: 0.8, duration: 140, ease: 'outQuad' }, { to: 1.08, duration: 160 }, { to: 1, duration: 380, ease: 'outElastic(1, .5)' }],
      scaleX: [{ to: 1.16, duration: 140, ease: 'outQuad' }, { to: 0.95, duration: 160 }, { to: 1, duration: 380, ease: 'outElastic(1, .5)' }],
      delay: 1050,
    });
    bobbing = animate(fly, { y: [0, -9], duration: 1100, delay: 1800, loop: true, alternate: true, ease: 'inOutSine' });
  }

  function flyAway() {
    if (!kid) return;
    bobbing?.cancel();
    animate(dibu, { scale: 0, rotate: 20, duration: still ? 0 : 420, ease: 'inBack(1.6)' });
    animate(fly, {
      x: 260,
      y: -900,
      rotate: 18,
      duration: still ? 0 : 950,
      ease: 'inBack(1.5)',
      onComplete: () => {
        kid = null;
        hero.style.opacity = dibu.style.opacity = '0';
      },
    });
  }

  function reset() {
    heartAt = kid = null;
    linked = false;
    bobbing?.cancel();
    heart.style.opacity = hero.style.opacity = dibu.style.opacity = card.style.opacity = '0';
    Object.assign(lens, { space: 0, moon: 0, rocket: 0, flash: 0 });
    dibu.style.transform = '';
    fly.style.transform = '';
    path.style.strokeDashoffset = '1';
    line.replaceChildren();
    sub.style.opacity = '0';
  }


  const me = BEATS.find((beat) => beat.me)!.members[0];

  /** El final de las dos historias: la cara de Gabriel, el espacio y el cohete a la luna. */
  function finale(tl: Timeline, t: number) {
    // 5. Zoom a la cara de Gabriel, la última frase y el cohete a la luna
    tl.call(() => {
      unsay();
      const [sx, sy] = narrow() ? [innerWidth * 0.5, innerHeight * 0.36] : [innerWidth * 0.42, innerHeight * 0.44];
      const zoom = field.zoomFor(me.r * 2, narrow() ? innerWidth * 0.5 : innerHeight * 0.34);
      const aim = field.lensFor(me.u, me.v, sx, sy, zoom);
      animate(lens, { x: aim.x, duration: still ? 0 : 1600, ease: 'inOutQuad' });
      animate(lens, { y: aim.y, duration: still ? 0 : 1600, ease: 'inOutCubic' });
      animate(lens, { zoom: still ? zoom : [{ to: 0.9, duration: 500, ease: 'outQuad' }, { to: zoom, duration: 1300, ease: 'outBack(1.2)' }] });
      animate(lens, { hx: me.u, hy: me.v, hr: me.r, glow: 1, duration: still ? 0 : 1600, ease: 'inOutQuad' });
    }, t);
    tl.call(() => say(JOURNEY_COPY[lang].finale, 'finale'), t + 1500);

    // La cara se achica y se va a un costado; alrededor aparece el espacio en letras
    tl.call(() => {
      const [sx, sy] = narrow() ? [innerWidth * 0.3, innerHeight * 0.6] : [innerWidth * 0.2, innerHeight * 0.48];
      const zoom = field.zoomFor(me.r * 2, Math.min(innerWidth, innerHeight) * (narrow() ? 0.2 : 0.16));
      const aim = field.lensFor(me.u, me.v, sx, sy, zoom);
      const slow = still ? 0 : 1800;
      animate(lens, { x: aim.x, y: aim.y, duration: slow, ease: 'inOutCubic' });
      // Anticipación: se agranda apenas antes de achicarse
      animate(lens, { zoom: still ? zoom : [{ to: lens.zoom * 1.06, duration: 260, ease: 'outQuad' }, { to: zoom, duration: 1540, ease: 'inOutCubic' }] });
      animate(lens, { glow: 0, space: 1, duration: still ? 0 : 1400, ease: 'inOutSine' });
      // La luna sube desde abajo, enorme, y se acomoda con un leve rebote
      animate(lens, { moon: 1, delay: still ? 0 : 500, duration: still ? 0 : 2600, ease: 'outBack(1.15)' });
    }, t + 3400);
    // El cohete despega de la cara y viaja en arco; al llegar, el destello
    tl.call(() => animate(lens, { rocket: [0.001, 0.999], duration: still ? 0 : 3000, ease: 'inOutSine', onComplete: () => {
      lens.rocket = 0;
      animate(lens, { flash: [0.001, 1], duration: still ? 0 : 1300, ease: 'outCubic' });
    } }), t + 6400);
    tl.call(() => onEnd?.(), t + 11400);
  }

  /** Empieza de cero: cámara, escena y escenario. */
  function begin() {
    timeline?.revert();
    cancelAnimationFrame(following);
    following = requestAnimationFrame(follow);
    reset();
    Object.assign(lens, { x: 0.5, y: 0.5, zoom: 1.7, hx: 0.5, hy: 0.5, hr: 0.05, glow: 0 });
    // Si se vuelve a ver, arranca otra vez en la montaña
    field.show('andes', 'center', undefined, { duration: 500 });
    const tl = createTimeline({ autoplay: true });
    timeline = tl;
    return tl;
  }

  /** Un capítulo: la frase grande y la línea chica debajo. */
  function chapter(text: string, small: string) {
    say(text, 'big');
    line.classList.add('chapter');
    sub.textContent = small;
    if (!still) animate(sub, { opacity: [0, 1], y: [10, 0], duration: 800, delay: 900, ease: 'outQuart' });
    else sub.style.opacity = '1';
  }
  const unchapter = () => {
    unsay();
    animate(sub, { opacity: 0, duration: still ? 0 : 400, ease: 'inQuad' });
  };

  /** La historia de Gabriel: de la cordillera, capítulo por capítulo, al espacio. */
  function playMe() {
    const tl = begin();
    const journey = JOURNEY_COPY[lang];
    let t = 300;
    tl.call(() => say(journey.open), t);
    t += 3200;
    tl.call(unsay, t);
    t += 500;
    for (const step of CHAPTERS) {
      // Cada escena se abre como un iris desde el centro
      tl.call(() => field.show(step.scene, 'center', step.accent, { iris: true, duration: 1700 }), t);
      tl.call(() => chapter(step.line[lang], step.sub[lang]), t + 700);
      t += 5200;
      tl.call(unchapter, t);
      t += 500;
    }
    // La foto vuelve, ya encuadrada en la cara de Gabriel
    tl.call(() => {
      const [sx, sy] = narrow() ? [innerWidth * 0.5, innerHeight * 0.36] : [innerWidth * 0.42, innerHeight * 0.44];
      const zoom = field.zoomFor(me.r * 2, narrow() ? innerWidth * 0.5 : innerHeight * 0.34);
      Object.assign(lens, field.lensFor(me.u, me.v, sx, sy, zoom), { zoom: zoom * 1.6 });
      field.show('foto', 'center', undefined, { iris: true, duration: 1700 });
    }, t);
    finale(tl, t + 400);
    return tl;
  }

  /** La historia de la familia: la foto, cara por cara. */
  function playFamily() {
    const tl = begin();
    let t = 300;

    // 1. La cordillera y la frase
    tl.call(() => say(copy.open), t);
    t += 3200;
    tl.call(unsay, t);
    t += 450;

    // 2. La montaña se abre y la foto aparece alejándose
    tl.call(() => field.show('foto', 'center', undefined, { iris: true, duration: 1900 }), t);
    // Todo lo que mueve la cámara va en animaciones sueltas: si la línea de tiempo animara
    // la misma propiedad, la animación de la próxima cara la reemplazaría y la frenaría
    tl.call(() => animate(lens, { zoom: 1, duration: still ? 0 : 2800, ease: 'outQuart' }), t);
    t += 2600;

    // 3. Cara por cara
    BEATS.forEach((beat, index) => {
      const [first] = beat.members;
      const pair = beat.members.length > 1;
      // Centro y radio del halo: una cara, o las dos juntas
      const u = beat.members.reduce((sum, m) => sum + m.u, 0) / beat.members.length;
      const v = beat.members.reduce((sum, m) => sum + m.v, 0) / beat.members.length;
      const r = pair ? Math.hypot(beat.members[1].u - first.u, beat.members[1].v - first.v) / 2 + first.r * 1.25 : first.r;
      const reading = beat.members.reduce((sum, m) => sum + words(`${m.role[lang]} ${m.name} ${m.quip[lang]}`), 0);
      const hold = beat.hero ? 5600 : beat.me ? 3400 : pair ? 4800 : Math.min(3800, 1700 + reading * 190);

      tl.call(hideCard, t);
      tl.call(() => {
        const [sx, sy] = spot();
        // La cara (o la pareja) ocupa una parte fija de la pantalla: en el celular, la mitad del ancho
        const target = pair ? (narrow() ? innerWidth * 0.82 : innerHeight * 0.56) : narrow() ? Math.min(innerWidth * 0.52, innerHeight * 0.3) : innerHeight * 0.3;
        const zoom = field.zoomFor(r * 2, target) * (beat.me ? 1.12 : 1);
        const aim = field.lensFor(u, v, sx, sy, zoom);
        // Arco: x e y con curvas distintas; zoom con anticipación (se aleja y vuelve)
        animate(lens, { x: aim.x, duration: still ? 0 : MOVE, ease: 'inOutQuad' });
        animate(lens, { y: aim.y, duration: still ? 0 : MOVE, ease: 'inOutCubic' });
        animate(lens, {
          zoom: still ? zoom : [{ to: Math.max(1, lens.zoom * 0.78), duration: MOVE * 0.42, ease: 'outQuad' }, { to: zoom, duration: MOVE * 0.58 + 200, ease: 'outBack(1.3)' }],
        });
        // El halo viaja estirado y rebota al llegar
        animate(lens, { hx: u, hy: v, glow: 1, duration: still ? 0 : MOVE, ease: 'inOutQuad' });
        animate(lens, {
          hr: still ? r : [{ to: Math.max(r, lens.hr) * 1.6, duration: MOVE * 0.5, ease: 'outQuad' }, { to: r, duration: 560, ease: 'outElastic(1, .55)' }],
        });
        heartAt = beat.heart ? [u, Math.min(...beat.members.map((m) => m.v)) - 0.075] : null;
        if (!beat.heart) heart.style.opacity = '0';
      }, t);
      tl.call(() => showCard(beat, index), t + Math.round(MOVE * 0.75));
      if (beat.heart) tl.call(popHeart, t + MOVE + 300);
      if (beat.hero) tl.call(() => flyIn(beat), t + MOVE + 900);
      t += MOVE + hold;
    });

    // 4. Todos juntos
    tl.call(() => {
      hideCard();
      flyAway();
      heartAt = null;
      animate(heart, { opacity: 0, duration: 200 });
      animate(lens, { x: 0.5, y: 0.5, zoom: 1, glow: 0, hr: 0.7, duration: still ? 0 : 2000, ease: 'inOutCubic' });
    }, t);
    tl.call(() => say(copy.end, 'big'), t + 1400);

    t += 4400;
    finale(tl, t);
    return tl;
  }

  function stop() {
    timeline?.revert();
    timeline = null;
    cancelAnimationFrame(following);
    stage.replaceChildren(...cast);
    reset();
    Object.assign(lens, { glow: 0, zoom: 1, x: 0.5, y: 0.5, space: 0, moon: 0, rocket: 0, flash: 0 });
  }

  const play = () => (script === 'me' ? playMe() : playFamily());
  return { play, stop };
}
