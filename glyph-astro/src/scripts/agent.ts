import { animate, stagger } from 'animejs';
import { createBlob } from './blob';
import type { Mood } from './character';
import { createEar } from './ear';
import { blip, musicPlaying, onBeat, play, playMusic, stopMusic, type Style } from './sound';

// Mimo en la portada: un blob al pie con el que se le habla al sitio.
// Escucha, piensa, contesta en voz alta y actúa sobre la página: lleva a una
// sección, abre un proyecto, pone música o muestra una tarjeta.

interface Deps {
  /** Arma una palabra con las letras del fondo. */
  write: (text: string) => void;
  showProject: (id: string) => void;
  section: () => string;
}

interface Answer {
  reply?: string;
  action?: 'navegar' | 'proyecto' | 'musica' | 'parar_musica' | 'contacto' | 'perfil' | 'escribir' | null;
  target?: string | null;
  music?: Style | null;
  text?: string | null;
  mood?: Mood | null;
  /** Quién resolvió el pedido: Jev o el modelo. */
  by?: string;
}

type State = 'idle' | 'listening' | 'hearing' | 'thinking' | 'speaking';

const TRACKS: Record<Style, { title: string; detail: string }> = {
  tranqui: { title: 'Tarde de commits', detail: 'Lo-fi · 76 bpm' },
  movida: { title: 'Deploy en viernes', detail: 'Chiptune · 132 bpm' },
};

// Ejemplos que se ven junto al botón y como atajos al abrirlo
const CALL = 'Tocá y hablame';
const TIPS = ['Mostrame los proyectos', 'Poné música', '¿Quién es Gabriel?', '¿Cómo lo contacto?', 'Escribí hola'];

export function createAgent({ write, showProject, section }: Deps) {
  const root = document.querySelector<HTMLElement>('#agent')!;
  const orb = root.querySelector<HTMLButtonElement>('#agent-orb')!;
  const hint = root.querySelector<HTMLElement>('#agent-hint')!;
  const sayBox = root.querySelector<HTMLElement>('#agent-say')!;
  const heardBox = root.querySelector<HTMLElement>('#agent-heard')!;
  const cards = root.querySelector<HTMLElement>('#agent-cards')!;
  const panel = root.querySelector<HTMLElement>('#agent-panel')!;
  const tips = root.querySelector<HTMLElement>('#agent-tips')!;
  const form = root.querySelector<HTMLFormElement>('#agent-type')!;
  const more = root.querySelector<HTMLButtonElement>('#agent-more')!;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // randomUUID solo existe en contextos seguros; por HTTP en la red local alcanza con un número al azar
  const session = crypto.randomUUID?.() ?? `local-${Math.random().toString(36).slice(2)}`;
  const history: { role: 'user' | 'assistant'; content: string }[] = [];
  let stream: MediaStream | null = null;
  let audio: AudioContext | null = null;
  let ear: ReturnType<typeof createEar> | null = null;
  let open = false;
  let speaking: ReturnType<typeof animate> | null = null;
  let hush = 0;
  let track: Style = 'tranqui';

  const who = { name: 'Mimo', hello: '¡Hola! Soy Mimo. Tocame y te muestro todo.', pitch: 1.45, ...createBlob(root.querySelector<HTMLElement>('#agent-blob')!) };

  function feel(mood: Mood) {
    who.feel(mood);
  }

  const LABEL: Partial<Record<State, string>> = { listening: 'Te escucho', hearing: 'Escuchando…', thinking: 'Pensando…', speaking: who.name };
  const setState = (state: State) => {
    root.dataset.state = state;
    if (open && LABEL[state]) hint.textContent = LABEL[state]!;
    who.state(state);
  };
  const rest = () => setState(stream ? 'listening' : 'idle');

  // ── Decir: el texto aparece letra por letra, con su pitido ──
  function say(text: string) {
    speaking?.cancel();
    clearTimeout(hush);
    setState('speaking');
    const progress = { shown: 0 };
    let last = 0;
    speaking = animate(progress, {
      shown: text.length,
      duration: still ? 0 : text.length * 42,
      ease: 'linear',
      onUpdate: () => {
        const shown = Math.floor(progress.shown);
        if (shown === last) return;
        last = shown;
        sayBox.textContent = text.slice(0, shown);
        const char = text[shown - 1];
        blip(char, who.pitch * (0.95 + Math.random() * 0.12));
        who.talk(char);
      },
      onComplete: () => {
        sayBox.textContent = text;
        who.quiet();
        rest();
        hush = window.setTimeout(() => (sayBox.textContent = ''), 3200 + text.length * 50);
      },
    });
  }

  // ── Tarjetas: una a la vez, encima del botón ──
  function showCard(html: string, kind: string) {
    cards.innerHTML = `<div class="mini ${kind}">${html}<button type="button" class="mini-close" data-close aria-label="Cerrar">×</button></div>`;
    if (!still) animate(cards.firstElementChild!, { y: { from: 16 }, scale: { from: 0.92 }, opacity: { from: 0 }, duration: 520, ease: 'outBack(1.4)' });
  }

  function hideCard(kind?: string) {
    if (!kind || cards.querySelector(`.${kind}`)) cards.innerHTML = '';
  }

  function player() {
    const playing = Boolean(musicPlaying());
    showCard(
      `<div class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
       <div class="mini-text"><strong>${TRACKS[track].title}</strong><span>${TRACKS[track].detail} · generada en vivo</span></div>
       <button type="button" data-player="toggle" aria-label="${playing ? 'Pausar' : 'Reproducir'}">${playing ? '❚❚' : '▶'}</button>
       <button type="button" data-player="next" aria-label="Siguiente">▶▶</button>`,
      `player${playing ? ' playing' : ''}`,
    );
  }

  function music(style?: Style | null) {
    track = style ?? track;
    if (playMusic(track)) player();
  }

  function contact() {
    showCard(
      `<div class="mini-text"><strong>gprezdiez@gmail.com</strong><span>Gabriel Pérez Diez · Mendoza</span></div>
       <button type="button" data-copy="gprezdiez@gmail.com">Copiar</button>
       <a href="https://www.linkedin.com/in/gabriel-p%C3%A9rez-diez/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
       <a href="https://github.com/gabsplat" target="_blank" rel="noopener noreferrer">GitHub</a>`,
      'contact',
    );
  }

  function profile() {
    showCard(
      `<div class="mini-text"><strong>Gabriel Pérez Diez</strong><span>Frontend · Mendoza, Argentina</span>
         <ul><li>Cofundó Aftercode Software</li><li>React y TypeScript</li><li>Vibecoder que lee el diff</li></ul></div>
       <a href="#sobre-mi">Ver más</a>`,
      'profile',
    );
  }

  cards.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-close]')) {
      if (cards.querySelector('.player')) stopMusic();
      hideCard();
    }
    const control = target.closest<HTMLElement>('[data-player]')?.dataset.player;
    if (control === 'toggle') {
      if (musicPlaying()) stopMusic();
      else playMusic(track);
      player();
    }
    if (control === 'next') music(track === 'tranqui' ? 'movida' : 'tranqui');
    const copy = target.closest<HTMLElement>('[data-copy]');
    if (copy) {
      navigator.clipboard?.writeText(copy.dataset.copy!);
      copy.textContent = 'Copiado';
    }
  });

  // Las barras del reproductor marcan el pulso
  onBeat(() => {
    who.beat();
    const bars = cards.querySelectorAll('.eq i');
    if (bars.length && !still) animate(bars, { scaleY: [() => 0.5 + Math.random() * 0.7, 0.3], duration: 300, delay: stagger(25), ease: 'outQuad' });
  });

  // ── Actuar sobre la página ──
  function perform({ action, target, music: style, text }: Answer) {
    switch (action) {
      case 'navegar':
        document.getElementById(target ?? 'inicio')?.scrollIntoView({ behavior: still ? 'auto' : 'smooth' });
        break;
      case 'proyecto':
        document.getElementById('proyectos')?.scrollIntoView({ behavior: still ? 'auto' : 'smooth' });
        if (target) showProject(target);
        break;
      case 'musica':
        music(style);
        break;
      case 'parar_musica':
        stopMusic();
        hideCard('player');
        break;
      case 'contacto':
        contact();
        break;
      case 'perfil':
        profile();
        break;
      case 'escribir':
        if (text) write(text);
        break;
    }
  }

  /** Sin el Worker (desarrollo local) entiende los pedidos más directos. */
  function offline(text: string): Answer {
    const said = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (/\b(para|saca|silencio|apaga)\b/.test(said) && /music|eso|cancion/.test(said)) return { reply: 'Listo, silencio.', action: 'parar_musica' };
    if (/music|cancion|tema/.test(said)) return { reply: 'Va música.', action: 'musica' };
    if (/proyecto|trabajo/.test(said)) return { reply: 'Acá están los proyectos.', action: 'navegar', target: 'proyectos' };
    if (/lab|experimento/.test(said)) return { reply: 'Labs, allá vamos.', action: 'navegar', target: 'labs' };
    if (/contact|mail|linkedin|github/.test(said)) return { reply: 'Te dejo sus datos.', action: 'contacto' };
    if (/quien es|gabriel|sobre/.test(said)) return { reply: 'Este es Gabriel.', action: 'perfil' };
    const word = said.match(/escrib\w*\s+(\w{1,10})/)?.[1];
    if (word) return { reply: 'Ahí va.', action: 'escribir', text: word };
    return { reply: 'Pedime proyectos, música o contacto.', action: null };
  }

  // Lo que entendió y cuánto tardó cada paso: transcripción y respuesta
  const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

  async function handle(text: string, heardIn?: number) {
    const asked = performance.now();
    heardBox.textContent = `«${text}»${heardIn ? ` · transcripción ${seconds(heardIn)}` : ''}`;
    // Los ejemplos ya cumplieron: se guardan para no tapar la página
    examples(false);
    setState('thinking');
    sayBox.textContent = '';
    let answer: Answer;
    try {
      const response = await fetch('/api/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'site', text, session, history, state: { music: Boolean(musicPlaying()), section: section() } }),
      });
      if (!response.ok) throw new Error(String(response.status));
      answer = (await response.json()) as Answer;
    } catch {
      answer = offline(text);
    }
    heardBox.textContent += ` · ${answer.by ?? 'sin conexión'} ${seconds(performance.now() - asked)}`;
    if (answer.reply) {
      history.push({ role: 'user', content: text }, { role: 'assistant', content: answer.reply });
      history.splice(0, Math.max(0, history.length - 6));
    }
    perform(answer);
    // Asiente cuando hace algo, y pone la cara que corresponde
    if (answer.action) who.nod();
    const mood = answer.mood ?? (answer.action ? 'feliz' : 'neutral');
    feel(mood);
    if (mood === 'feliz') who.love();
    if (answer.reply) say(answer.reply);
    else rest();
  }

  // ── Micrófono ──
  function level(analyser: AnalyserNode) {
    const samples = new Uint8Array(analyser.fftSize);
    let smooth = 0;
    let heard = performance.now();
    const tick = () => {
      if (!stream) {
        root.style.setProperty('--level', '0');
        return;
      }
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
      const now = Math.min(1, Math.sqrt(sum / samples.length) * 5);
      smooth += (now - smooth) * (now > smooth ? 0.5 : 0.12);
      // Si en varios segundos no entra nada de sonido, el micrófono no está llegando
      if (now > 0.02) heard = performance.now();
      else if (performance.now() - heard > 6000 && root.dataset.state === 'listening') hint.textContent = 'No me llega sonido del micrófono';
      // La aurora crece con la voz
      root.style.setProperty('--level', smooth.toFixed(3));
      who.level(smooth);
      requestAnimationFrame(tick);
    };
    tick();
  }

  async function listen() {
    if (!navigator.mediaDevices?.getUserMedia) return false;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      return false;
    }
    audio = new AudioContext();
    await audio.resume();
    const analyser = audio.createAnalyser();
    analyser.fftSize = 512;
    const source = audio.createMediaStreamSource(stream);
    source.connect(analyser);
    level(analyser);
    ear = createEar(audio, source, {
      busy: () => root.dataset.state === 'speaking' || root.dataset.state === 'thinking',
      onSpeech: (talking) => setState(talking ? 'hearing' : 'listening'),
      onPhrase: handle,
      onSending: () => setState('thinking'),
      onUnclear: () => {
        rest();
        hint.textContent = 'No te entendí, ¿repetís?';
      },
      onError: (message) => {
        hint.textContent = message;
        rest();
      },
    });
    return true;
  }

  /** Muestra o guarda los ejemplos y el campo de texto. Quedan a mano en el botón «?». */
  let folding = 0;
  function examples(show: boolean) {
    clearTimeout(folding);
    panel.hidden = !show;
    more.setAttribute('aria-expanded', String(show));
    if (!show) return;
    if (!still) animate(panel.querySelectorAll('button, form'), { y: { from: 10 }, opacity: { from: 0 }, duration: 420, delay: stagger(40), ease: 'outQuart' });
    // Si nadie los toca, se guardan solos
    folding = window.setTimeout(() => {
      if (document.activeElement !== form.querySelector('input')) examples(false);
    }, 9000);
  }

  more.addEventListener('click', () => examples(panel.hidden));

  function close() {
    open = false;
    delete root.dataset.open;
    more.hidden = true;
    clearTimeout(folding);
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    ear?.stop();
    ear = null;
    audio?.close();
    audio = null;
    panel.hidden = true;
    orb.setAttribute('aria-pressed', 'false');
    hint.textContent = CALL;
    heardBox.textContent = '';
    feel('neutral');
    setState('idle');
  }

  // Primera visita: Mimo se presenta y dice cómo se lo usa
  if (!sessionStorage.getItem('mimo')) {
    sessionStorage.setItem('mimo', '1');
    setTimeout(() => {
      if (open) return;
      sayBox.textContent = who.hello;
      feel('feliz');
      hush = window.setTimeout(() => {
        if (!open) {
          sayBox.textContent = '';
          feel('neutral');
        }
      }, 6000);
    }, 3200);
  }

  // Todo el rótulo sirve para activarlo, no solo el blob
  hint.addEventListener('click', () => !open && orb.click());

  orb.addEventListener('click', async () => {
    if (open) {
      close();
      return;
    }
    open = true;
    root.dataset.open = '';
    clearTimeout(hush);
    sayBox.textContent = '';
    feel('neutral');
    play('neutral');
    orb.setAttribute('aria-pressed', 'true');
    more.hidden = false;
    examples(true);
    const hearing = await listen();
    if (!open) return;
    hint.textContent = hearing ? 'Te escucho' : 'Sin micrófono: escribime';
    setState(hearing ? 'listening' : 'idle');
  });

  tips.innerHTML = TIPS.map((tip) => `<button type="button">${tip}</button>`).join('');
  tips.addEventListener('click', (event) => {
    const tip = (event.target as HTMLElement).closest('button');
    if (tip) handle(tip.textContent!);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = form.querySelector('input')!;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    handle(text);
  });

  // Mientras nadie lo usa, el rótulo va mostrando qué se le puede pedir
  let example = 0;
  setInterval(() => {
    if (open || still) return;
    // Alterna la invitación con un ejemplo, para que nunca falte el «tocá»
    example = (example + 1) % (TIPS.length * 2);
    const next = example % 2 ? `Probá: «${TIPS[(example - 1) / 2]}»` : CALL;
    animate(hint, {
      opacity: [1, 0],
      duration: 220,
      ease: 'inQuad',
      onComplete: () => {
        hint.textContent = next;
        animate(hint, { opacity: [0, 1], y: [6, 0], duration: 320, ease: 'outQuad' });
      },
    });
  }, 3600);
}
