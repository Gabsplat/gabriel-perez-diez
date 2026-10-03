import { animate, stagger } from 'animejs';
import { act, character, MOODS, mouth, nod, setMood, shake, voice, wink, type Mood } from './character';
import { createEar } from './ear';
import { createGlyphField } from './glyph-field';
import { react } from './react';
import { blip, musicPlaying, onBeat, play, playMusic, setSound, stopMusic, type Style } from './sound';

const canvas = document.querySelector<HTMLCanvasElement>('#glyphs')!;
// Más letras y más chicas que en la portada, para que entren los detalles
const field = createGlyphField(canvas, { count: [2000, 3400], size: [6, 11], stage: true });
const moodButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-mood]')];
const micButton = document.querySelector<HTMLButtonElement>('#mic')!;
const soundButton = document.querySelector<HTMLButtonElement>('#sound')!;
const musicButton = document.querySelector<HTMLButtonElement>('#music')!;
const status = document.querySelector<HTMLElement>('#status')!;
const caption = document.querySelector<HTMLElement>('#caption')!;
const bubble = document.querySelector<HTMLElement>('#bubble')!;

const pick = <T,>(list: T[]) => list[(Math.random() * list.length) | 0];

// Lo que dice en cada situación, y qué tan aguda suena la voz
const LINES: Record<Mood | 'si' | 'no' | 'saludo' | 'toque' | 'harto' | 'guino' | 'despierta', string[]> = {
  neutral: ['Acá estoy.', 'Contame.', 'Todo tranqui.', 'Ajá.'],
  feliz: ['¡Buenísimo!', '¡Vamos todavía!', 'Me encanta.', '¡Qué bien!'],
  enojado: ['¡No me rompas el build!', 'Grrr.', '¿Otra vez?', 'Así no.'],
  triste: ['Uh, qué bajón.', 'Me dio pena.', 'Snif.', 'Un abrazo.'],
  sorprendido: ['¡¿En serio?!', '¡Upa!', 'No te la puedo creer.', '¡Epa!'],
  dormido: ['Zzz…', 'Cinco minutitos más…'],
  si: ['Sí, obvio.', 'Dale.', 'Tal cual.', 'Sí, sí.'],
  no: ['No, ni ahí.', 'Nop.', 'Para nada.', 'No, no.'],
  saludo: ['¡Hola! ¿Todo bien?', '¡Buenas!', '¡Hola, hola!'],
  toque: ['¡Ey!', '¡Cosquillas no!', '¿Qué hacés?'],
  harto: ['¡Basta!', '¡Dejá de tocarme!'],
  guino: ['Guiño, guiño.', 'Vos me entendés.'],
  despierta: ['¿Eh? ¿Qué pasó?', 'Estaba despierto, eh.'],
};
const PITCH: Record<Mood, number> = { neutral: 1, feliz: 1.3, enojado: 0.62, triste: 0.78, sorprendido: 1.5, dormido: 0.55 };

let mood: Mood = 'neutral';
let speaking: ReturnType<typeof animate> | null = null;
let hush = 0;

// ── Hablar: el texto aparece letra por letra, con un pitido y la boca en cada una ──
function say(text: string) {
  speaking?.cancel();
  clearTimeout(hush);
  const progress = { shown: 0 };
  let last = 0;
  const pitch = PITCH[mood];
  speaking = animate(progress, {
    shown: text.length,
    duration: text.length * 62,
    ease: 'linear',
    onUpdate: () => {
      const shown = Math.floor(progress.shown);
      if (shown === last) return;
      last = shown;
      bubble.textContent = text.slice(0, shown);
      const char = text[shown - 1];
      blip(char, pitch * (0.92 + Math.random() * 0.16));
      // La boca se abre en cada letra y se cierra sola
      if (/\p{L}/u.test(char)) animate(mouth, { talk: [0.75, 0.05], duration: 110, ease: 'outQuad' });
    },
    onComplete: () => {
      bubble.textContent = text;
      mouth.talk = 0;
      // Las respuestas largas quedan más tiempo a la vista
      hush = window.setTimeout(() => (bubble.textContent = ''), 2600 + text.length * 45);
    },
  });
}

function show(next: Mood, { keep = true, speak = true, sound = true } = {}) {
  if (keep) mood = next;
  setMood(next);
  field.setAccent(MOODS[next].accent);
  for (const button of moodButtons) button.setAttribute('aria-pressed', String(button.dataset.mood === next));
  if (sound) play(next);
  if (speak) say(pick(LINES[next]));
}

// ── Sueño: se duerme si nadie le presta atención y se despierta con cualquier cosa ──
let drowsy = 0;
function awake() {
  clearTimeout(drowsy);
  drowsy = window.setTimeout(() => !musicPlaying() && show('dormido'), 40000);
  if (mood !== 'dormido') return false;
  mood = 'neutral';
  show('sorprendido', { keep: false, speak: false });
  say(pick(LINES.despierta));
  setTimeout(() => show(mood, { speak: false, sound: false }), 1400);
  return true;
}

const answers = {
  si() {
    nod();
    play('si');
    say(pick(LINES.si));
  },
  no() {
    shake();
    play('no');
    say(pick(LINES.no));
  },
  guino() {
    wink();
    play('guino');
    say(pick(LINES.guino));
  },
  hablar() {
    say(pick(LINES[mood]));
  },
};

for (const button of moodButtons) {
  button.addEventListener('click', () => {
    clearTimeout(drowsy);
    const next = button.dataset.mood as Mood;
    show(next);
    if (next !== 'dormido') awake();
  });
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-act]')) {
  button.addEventListener('click', () => {
    if (!awake()) answers[button.dataset.act as keyof typeof answers]();
  });
}

// ── Música: generada en el momento; la puede poner él o el botón ──
function startMusic(style: Style) {
  if (!playMusic(style)) return;
  musicButton.setAttribute('aria-pressed', 'true');
  // Con música no se duerme de aburrido
  clearTimeout(drowsy);
}

function endMusic() {
  stopMusic();
  musicButton.setAttribute('aria-pressed', 'false');
}

// Mueve la cabeza al ritmo
onBeat(() => {
  if (mood !== 'dormido') animate(act, { nod: [0.45, 0], duration: 260, ease: 'outQuad' });
});

musicButton.addEventListener('click', () => {
  awake();
  if (musicPlaying()) endMusic();
  else startMusic(Math.random() < 0.5 ? 'tranqui' : 'movida');
});

soundButton.addEventListener('click', () => {
  const on = soundButton.getAttribute('aria-pressed') !== 'true';
  soundButton.setAttribute('aria-pressed', String(on));
  setSound(on);
  if (on) play('neutral');
  else musicButton.setAttribute('aria-pressed', 'false');
});

// ── Tocarlo: se sorprende, y si insisten se enoja ──
let pokes: number[] = [];
window.addEventListener('pointerdown', (event) => {
  if ((event.target as HTMLElement).closest('a, button, input')) return;
  field.pulse(event.clientX, event.clientY);
  const center = field.center();
  const reach = Math.min(window.innerWidth * 0.46, window.innerHeight * 0.29);
  if (Math.hypot(event.clientX - center.x, event.clientY - center.y) > reach) return;
  if (awake()) return;
  const now = performance.now();
  pokes = [...pokes.filter((at) => now - at < 4000), now];
  if (pokes.length >= 4) {
    pokes = [];
    show('enojado', { speak: false });
    say(pick(LINES.harto));
    return;
  }
  play('toque');
  show('sorprendido', { keep: false, speak: false, sound: false });
  say(pick(LINES.toque));
  setTimeout(() => show(mood, { speak: false, sound: false }), 1100);
});

// ── Micrófono: la boca sigue el volumen de la voz y un ruido fuerte lo asusta ──
let stream: MediaStream | null = null;
let audio: AudioContext | null = null;
let startled = 0;

function listen(analyser: AnalyserNode) {
  const samples = new Uint8Array(analyser.fftSize);
  const tick = () => {
    if (!stream) {
      voice.level = 0;
      return;
    }
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
    const level = Math.min(1, Math.sqrt(sum / samples.length) * 5);
    // Sube rápido y baja despacio, como una boca que se cierra
    voice.level += (level - voice.level) * (level > voice.level ? 0.5 : 0.15);

    const now = performance.now();
    // Mientras habla él no se asusta de su propia voz por los parlantes
    if (level > 0.75 && now - startled > 2500 && !bubble.textContent && !musicPlaying()) {
      startled = now;
      awake();
      show('sorprendido', { keep: false, speak: false });
      setTimeout(() => show(mood, { speak: false, sound: false }), 1300);
    }
    requestAnimationFrame(tick);
  };
  tick();
}

async function respond(text: string) {
  // Mientras piensa, puntos suspensivos
  const waiting = window.setTimeout(() => (bubble.textContent ||= '…'), 350);
  const asleep = mood === 'dormido';
  const { mood: next, action, reply, gesture, command, music } = await react(text, { music: Boolean(musicPlaying()), asleep });
  clearTimeout(waiting);
  if (bubble.textContent === '…') bubble.textContent = '';

  if (action === 'habla') {
    // El modelo contestó: dice su frase con la cara, el gesto y la acción que eligió
    if (command !== 'dormir') {
      awake();
      if (next) show(next, { speak: false });
    }
    if (gesture === 'si') nod();
    if (gesture === 'no') shake();
    if (gesture === 'guino') wink();
    if (command === 'musica') startMusic(music ?? 'tranqui');
    if (command === 'parar_musica') endMusic();
    say(reply!);
    if (command === 'dormir') {
      // Termina de hablar y se duerme
      clearTimeout(drowsy);
      endMusic();
      setTimeout(() => show('dormido', { speak: false }), 400 + reply!.length * 62);
    }
    return;
  }

  awake();
  if (action && next && next !== mood) show(next, { speak: false, sound: false });
  switch (action) {
    case 'saludo':
      show('feliz', { speak: false });
      say(pick(LINES.saludo));
      break;
    case 'pregunta':
    case 'charla':
      // Sin modelo disponible, contesta lo que se le ocurre
      (Math.random() < 0.5 ? answers.si : answers.no)();
      break;
    case 'afirma':
      answers.si();
      break;
    case 'niega':
      answers.no();
      break;
    case 'guino':
      answers.guino();
      break;
    case 'dormir':
      clearTimeout(drowsy);
      show('dormido');
      break;
    default:
      // Sin emoción ni gesto no dice nada: solo vuelve a la calma
      if (next === 'neutral') {
        if (mood !== 'neutral') show('neutral', { speak: false, sound: false });
      } else if (next) {
        show(next);
      }
  }
}

// También se le puede escribir
const chat = document.querySelector<HTMLFormElement>('#chat')!;
chat.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = chat.querySelector('input')!;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  caption.textContent = `«${text}»`;
  respond(text);
});

let ear: ReturnType<typeof createEar> | null = null;

async function toggleMic() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
    ear?.stop();
    ear = null;
    caption.textContent = '';
    await audio?.close();
    audio = null;
    micButton.setAttribute('aria-pressed', 'false');
    status.textContent = 'Micrófono apagado.';
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    status.textContent = 'El micrófono solo funciona con HTTPS.';
    return;
  }
  try {
    // La cancelación de eco evita que escuche su propia voz y la música
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    status.textContent = 'No pude acceder al micrófono. Revisá el permiso del navegador.';
    return;
  }
  audio = new AudioContext();
  await audio.resume();
  const analyser = audio.createAnalyser();
  analyser.fftSize = 512;
  const source = audio.createMediaStreamSource(stream);
  source.connect(analyser);
  micButton.setAttribute('aria-pressed', 'true');
  listen(analyser);
  status.textContent = 'Te escucho: hablale y esperá un segundo cuando termines.';
  ear = createEar(audio, source, {
    // Mientras habla él no se escucha a sí mismo
    busy: () => Boolean(speaking && !speaking.completed),
    onSpeech: (talking) => {
      if (talking) caption.textContent = 'Escuchando…';
      else if (caption.textContent === 'Escuchando…') caption.textContent = '…';
    },
    onPhrase: (text) => {
      caption.textContent = `«${text}»`;
      respond(text);
    },
    onError: (message) => {
      caption.textContent = '';
      status.textContent = message;
    },
  });
}

micButton.addEventListener('click', () => {
  awake();
  toggleMic();
});

document.fonts.ready.then(() => {
  setTimeout(() => {
    field.morph('character', { ...character(), float: 0.003, scale: 1.05, accent: MOODS.neutral.accent }, { flight: 'vortex' });
    awake();
  }, 500);
});

if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  animate('.controls > *', { y: { from: 24 }, opacity: { from: 0 }, duration: 900, delay: stagger(70, { start: 900 }), ease: 'outQuart' });
}
