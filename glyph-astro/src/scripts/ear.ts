// Oído del personaje: detecta cuándo la persona empieza y termina de hablar,
// recorta esa frase del micrófono y la manda a transcribir a /api/transcribe
// (Whisper en Cloudflare). No depende del reconocimiento de voz del navegador,
// así que funciona igual en Chrome, Safari, Firefox y celulares.

interface Options {
  /** Mientras devuelva true no escucha: el personaje está hablando. */
  busy: () => boolean;
  /** Empezó o terminó una frase. */
  onSpeech: (speaking: boolean) => void;
  onPhrase: (text: string) => void;
  /** La frase terminó y se está transcribiendo. */
  onSending?: () => void;
  /** Se oyó algo, pero la transcripción volvió vacía. */
  onUnclear?: () => void;
  onError: (message: string) => void;
}

const RATE = 16000;
const BLOCK = 4096;
// Bloques de silencio que cierran la frase y tope de duración
const QUIET_BLOCKS = 7;
const MAX_BLOCKS = 130;
const PREROLL = 4;
// Whisper inventa estas frases cuando solo hay ruido
const NOISE = /amara|subt[ií]tulos|suscr[ií]b|gracias por ver/i;

function wav(samples: Float32Array) {
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (at: number, value: string) => [...value].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, sample * 0x7fff, true);
  }
  return view.buffer;
}

/** Baja la frecuencia de muestreo promediando, que alcanza para la voz. */
function resample(blocks: Float32Array[], from: number) {
  const total = blocks.reduce((sum, block) => sum + block.length, 0);
  const joined = new Float32Array(total);
  let offset = 0;
  for (const block of blocks) {
    joined.set(block, offset);
    offset += block.length;
  }
  const ratio = from / RATE;
  const out = new Float32Array(Math.floor(total / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio), end = Math.min(total, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let k = start; k < end; k++) sum += joined[k];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

export function createEar(context: AudioContext, source: MediaStreamAudioSourceNode, options: Options) {
  // ScriptProcessor está en desuso, pero es el único que anda igual en todos lados sin archivos extra
  const tap = context.createScriptProcessor(BLOCK, 1, 1);
  const silent = context.createGain();
  silent.gain.value = 0;
  source.connect(tap).connect(silent).connect(context.destination);

  let floor = 0.006;
  let recent: Float32Array[] = [];
  let phrase: Float32Array[] | null = null;
  let loud = 0;
  let quiet = 0;

  async function send(blocks: Float32Array[]) {
    options.onSending?.();
    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: wav(resample(blocks, context.sampleRate)),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { text = '' } = (await response.json()) as { text?: string };
      if (text.length > 1 && !NOISE.test(text)) options.onPhrase(text);
      else options.onUnclear?.();
    } catch {
      options.onError('No pude transcribir lo que dijiste.');
    }
  }

  tap.onaudioprocess = (event) => {
    const block = new Float32Array(event.inputBuffer.getChannelData(0));
    let sum = 0;
    for (const sample of block) sum += sample * sample;
    const rms = Math.sqrt(sum / block.length);

    if (options.busy()) {
      // No se escucha a sí mismo
      if (phrase) options.onSpeech(false);
      phrase = null;
      recent = [];
      return;
    }

    const threshold = Math.max(0.012, floor * 2.8);
    if (!phrase) {
      // El piso de ruido se adapta al ambiente (ventilador, música de fondo)
      floor += (rms - floor) * (rms < floor ? 0.3 : 0.03);
      recent = [...recent.slice(-(PREROLL - 1)), block];
      if (rms > threshold) {
        phrase = [...recent];
        loud = 1;
        quiet = 0;
        options.onSpeech(true);
      }
      return;
    }

    phrase.push(block);
    if (rms > threshold) {
      loud++;
      quiet = 0;
    } else {
      quiet++;
    }
    if (quiet < QUIET_BLOCKS && phrase.length < MAX_BLOCKS) return;
    const done = phrase;
    phrase = null;
    recent = [];
    options.onSpeech(false);
    // Un golpe o un clic no es una frase
    if (loud >= 3) send(done);
  };

  return {
    stop() {
      tap.onaudioprocess = null;
      tap.disconnect();
      silent.disconnect();
    },
  };
}
