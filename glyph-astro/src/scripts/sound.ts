// Sonidos del personaje, sintetizados con Web Audio: no hay archivos de audio.
// La voz es un balbuceo de pitidos, uno por letra, al estilo de un robot.
// Al final del archivo está la música, también generada en el momento.

export type Effect =
  | 'neutral' | 'feliz' | 'enojado' | 'triste' | 'sorprendido' | 'dormido'
  | 'si' | 'no' | 'guino' | 'toque';

let context: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

export function setSound(on: boolean) {
  enabled = on;
  if (!on) stopMusic();
}

/** El navegador solo deja sonar después de un gesto de la persona. */
function ready() {
  if (!enabled) return null;
  if (!context) {
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.22;
    master.connect(context.destination);
  }
  if (context.state === 'suspended') context.resume();
  return context;
}

interface Tone {
  type?: OscillatorType;
  /** Segundos desde ahora. */
  at?: number;
  /** Frecuencia final, para barridos. */
  to?: number;
  gain?: number;
}

function tone(freq: number, length: number, { type = 'triangle', at = 0, to, gain = 1 }: Tone = {}) {
  const ctx = ready();
  if (!ctx || !master) return;
  const start = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + length);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(env).connect(master);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

function noise(length: number, cutoff: number, { at = 0, gain = 1 }: Tone = {}) {
  const ctx = ready();
  if (!ctx || !master) return;
  const start = ctx.currentTime + at;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const env = ctx.createGain();
  source.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + length * 0.4);
  env.gain.exponentialRampToValueAtTime(0.0001, start + length);
  source.connect(filter).connect(env).connect(master);
  source.start(start);
}

const EFFECTS: Record<Effect, () => void> = {
  neutral: () => tone(440, 0.09, { type: 'sine', gain: 0.6 }),
  // Arpegio que sube y un brillo al final
  feliz: () => {
    [523, 659, 784, 1047].forEach((freq, i) => tone(freq, 0.16, { at: i * 0.07 }));
    tone(1568, 0.3, { type: 'sine', at: 0.3, gain: 0.5 });
  },
  // Gruñido: dos sierras graves desafinadas que caen, con ruido
  enojado: () => {
    tone(120, 0.55, { type: 'sawtooth', to: 62, gain: 0.9 });
    tone(127, 0.55, { type: 'sawtooth', to: 58, gain: 0.7 });
    noise(0.45, 500, { gain: 0.8 });
  },
  // Dos notas que se caen, como un lamento
  triste: () => {
    tone(392, 0.28, { to: 370 });
    tone(330, 0.6, { at: 0.3, to: 233 });
  },
  sorprendido: () => {
    tone(280, 0.18, { type: 'sine', to: 1300 });
    tone(1400, 0.1, { type: 'sine', at: 0.2, gain: 0.7 });
  },
  // Ronquido: ruido grave que entra y sale, dos veces
  dormido: () => {
    noise(0.8, 260, { gain: 0.9 });
    tone(150, 0.7, { type: 'sine', to: 95, gain: 0.5 });
    noise(0.8, 220, { at: 1.1, gain: 0.7 });
  },
  si: () => {
    tone(440, 0.1);
    tone(660, 0.14, { at: 0.11 });
  },
  no: () => {
    tone(330, 0.12, { type: 'square', gain: 0.45 });
    tone(220, 0.2, { type: 'square', at: 0.14, gain: 0.45 });
  },
  guino: () => {
    tone(1320, 0.35, { type: 'sine', gain: 0.6 });
    tone(1760, 0.4, { type: 'sine', at: 0.06, gain: 0.5 });
  },
  toque: () => tone(220, 0.12, { type: 'square', to: 640, gain: 0.4 }),
};

export function play(effect: Effect) {
  EFFECTS[effect]();
}

/** Pitido de una letra al hablar; `pitch` sube o baja la voz según el ánimo. */
export function blip(char: string, pitch = 1) {
  if (!/[\p{L}\p{N}]/u.test(char)) return;
  const step = char.toLowerCase().charCodeAt(0) % 12;
  // Las vocales suenan más agudas y redondas
  const vowel = 'aeiouáéíóú'.includes(char.toLowerCase());
  tone((vowel ? 420 : 300) * pitch * 2 ** (step / 24), 0.06, { type: vowel ? 'triangle' : 'square', gain: vowel ? 0.7 : 0.35 });
}

// ── Música ──────────────────────────────────────────────────────────────────
// Se genera en el momento, nota por nota: no hay grabaciones ni derechos de
// nadie. Dos estilos: uno tranquilo, tipo lo-fi, y uno movido, tipo chiptune.

export type Style = 'tranqui' | 'movida';

interface Song {
  bpm: number;
  /** Un acorde por compás, como notas MIDI. */
  chords: number[][];
  lead: OscillatorType;
  /** Semicorcheas en las que suena cada parte, dentro de un compás de 16. */
  kick: number[];
  snare: number[];
  hat: number[];
  arp: number[];
}

const SONGS: Record<Style, Song> = {
  tranqui: {
    bpm: 76,
    chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
    lead: 'triangle',
    kick: [0, 10],
    snare: [4, 12],
    hat: [2, 6, 8, 14],
    arp: [0, 3, 6, 8, 11, 14],
  },
  movida: {
    bpm: 132,
    chords: [[57, 60, 64, 69], [53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67]],
    lead: 'square',
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hat: [2, 6, 10, 14],
    arp: [0, 2, 4, 6, 8, 10, 12, 14],
  },
};

const hertz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

let band: GainNode | null = null;
let ticker = 0;
let playing: Style | null = null;
let beatListener: (() => void) | null = null;

/** Avisa en cada pulso, para que el personaje mueva la cabeza. */
export function onBeat(listener: () => void) {
  beatListener = listener;
}

export const musicPlaying = () => playing;

function voiceNote(freq: number, at: number, length: number, type: OscillatorType, gain: number) {
  if (!context || !band) return;
  const osc = context.createOscillator();
  const env = context.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + 0.015);
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(env).connect(band);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

function drum(at: number, kind: 'kick' | 'snare' | 'hat') {
  if (!context || !band) return;
  if (kind === 'kick') {
    const osc = context.createOscillator();
    const env = context.createGain();
    osc.frequency.setValueAtTime(140, at);
    osc.frequency.exponentialRampToValueAtTime(42, at + 0.14);
    env.gain.setValueAtTime(0.9, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
    osc.connect(env).connect(band);
    osc.start(at);
    osc.stop(at + 0.22);
    return;
  }
  const length = kind === 'snare' ? 0.14 : 0.04;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * length), context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const env = context.createGain();
  source.buffer = buffer;
  filter.type = 'highpass';
  filter.frequency.value = kind === 'snare' ? 1400 : 6000;
  env.gain.setValueAtTime(kind === 'snare' ? 0.45 : 0.16, at);
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);
  source.connect(filter).connect(env).connect(band);
  source.start(at);
}

export function playMusic(style: Style = 'tranqui') {
  const ctx = ready();
  if (!ctx || !master) return false;
  stopMusic();
  playing = style;
  band = ctx.createGain();
  band.gain.setValueAtTime(0.0001, ctx.currentTime);
  band.gain.exponentialRampToValueAtTime(0.55, ctx.currentTime + 0.6);
  band.connect(master);

  const song = SONGS[style];
  const step = 60 / song.bpm / 4;
  let index = 0;
  let next = ctx.currentTime + 0.08;
  const schedule = () => {
    // Programa las notas un poco antes de que suenen, para que el ritmo no dependa del temporizador
    while (next < ctx.currentTime + 0.25) {
      const tick = index % 16;
      const chord = song.chords[Math.floor(index / 16) % song.chords.length];
      if (tick === 0) {
        for (const note of chord) voiceNote(hertz(note), next, step * 15, 'sine', 0.13);
        voiceNote(hertz(chord[0] - 12), next, step * 7, 'triangle', 0.4);
      }
      if (tick === 8) voiceNote(hertz(chord[0] - 12), next, step * 6, 'triangle', 0.32);
      if (song.arp.includes(tick)) {
        const note = chord[(index * 3 + Math.floor(index / 16)) % chord.length] + 12;
        voiceNote(hertz(note), next, step * 1.8, song.lead, song.lead === 'square' ? 0.09 : 0.2);
      }
      if (song.kick.includes(tick)) drum(next, 'kick');
      if (song.snare.includes(tick)) drum(next, 'snare');
      if (song.hat.includes(tick)) drum(next, 'hat');
      if (tick % 4 === 0) setTimeout(() => playing && beatListener?.(), Math.max(0, (next - ctx.currentTime) * 1000));
      next += step;
      index++;
    }
  };
  schedule();
  ticker = window.setInterval(schedule, 80);
  return true;
}

export function stopMusic() {
  clearInterval(ticker);
  playing = null;
  if (band && context) {
    const old = band;
    old.gain.cancelScheduledValues(context.currentTime);
    old.gain.setValueAtTime(old.gain.value, context.currentTime);
    old.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.4);
    setTimeout(() => old.disconnect(), 600);
  }
  band = null;
}
