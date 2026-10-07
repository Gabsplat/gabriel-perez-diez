import type { Mood } from './character';

// Decide cómo reacciona el personaje a lo que dijo la persona. Consulta
// /api/react, el Worker que guarda las claves: ahí Jev resuelve lo simple y,
// para el resto, un modelo contesta y elige gesto y acción. Si esa ruta no responde, por
// ejemplo en desarrollo local, usa palabras clave.

const MOODS: Mood[] = ['neutral', 'feliz', 'enojado', 'triste', 'sorprendido'];

const CUES: Record<Exclude<Mood, 'neutral' | 'dormido'>, string[]> = {
  feliz: ['genial', 'buenisimo', 'gracias', 'me encanta', 'feliz', 'contento', 'contenta', 'jaja', 'excelente', 'te quiero', 'amo', 'hermoso', 'vamos', 'golazo', 'funciona', 'funciono', 'salio', 'bien ahi'],
  enojado: ['odio', 'bronca', 'enojado', 'enojada', 'me enoja', 'mierda', 'maldito', 'harto', 'harta', 'pesimo', 'horrible', 'basta', 'no funciona', 'se rompio', 'rompiste', 'bug', 'callate', 'estupido'],
  triste: ['triste', 'perdi', 'extrano', 'lloro', 'llorar', 'me siento mal', 'solo', 'sola', 'murio', 'lastima', 'que pena', 'deprimido', 'cansado', 'cansada', 'fracaso', 'no puedo mas'],
  sorprendido: ['wow', 'guau', 'en serio', 'no puedo creer', 'de verdad', 'posta', 'sorpresa', 'no te creo', 'increible', 'que locura', 'como que'],
};

const plain = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export interface Reaction {
  /** `null` cuando no hay señal clara: el ánimo queda como estaba. */
  mood: Mood | null;
  /** Lo que hizo la persona además de expresar una emoción. */
  action: 'saludo' | 'pregunta' | 'charla' | 'afirma' | 'niega' | 'guino' | 'dormir' | 'habla' | null;
  /** Respuesta del modelo, cuando `action` es `habla`. */
  reply?: string;
  /** Gesto que el modelo eligió para acompañar la respuesta. */
  gesture?: 'si' | 'no' | 'guino' | null;
  /** Algo que el modelo decidió hacer. */
  command?: 'dormir' | 'musica' | 'parar_musica' | null;
  music?: 'tranqui' | 'movida' | null;
}

/** En qué está el personaje, para que el modelo lo sepa. */
export interface Situation {
  music: boolean;
  asleep: boolean;
}

// Una conversación por visita: el modelo recuerda los últimos intercambios
const session = crypto.randomUUID?.() ?? `local-${Math.random().toString(36).slice(2)}`;
const history: { role: 'user' | 'assistant'; content: string }[] = [];

export async function react(text: string, state: Situation): Promise<Reaction> {
  try {
    const response = await fetch('/api/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, session, history, state }),
    });
    if (response.ok) {
      const { mood, action, reply, gesture, command, music } = (await response.json()) as Partial<Reaction>;
      if (mood && MOODS.includes(mood)) {
        if (reply) history.push({ role: 'user', content: text }, { role: 'assistant', content: reply });
        history.splice(0, Math.max(0, history.length - 6));
        return { mood, action: action ?? null, reply, gesture, command, music };
      }
    }
  } catch {
    // Sin red o sin Worker: sigue con las palabras clave
  }
  const said = plain(text);
  const action: Reaction['action'] = /\b(hola|buenas|chau|adios)\b/.test(said) ? 'saludo'
    : /\bguin/.test(said) ? 'guino'
    : /\b(dormi|dormite|a dormir)\b/.test(said) ? 'dormir'
    : /^(si|dale|obvio|claro)\b/.test(said) ? 'afirma'
    : /^(no|nop|para nada)\b/.test(said) ? 'niega'
    : text.includes('?') ? 'pregunta' : null;
  return { mood: byKeywords(text), action };
}

function byKeywords(text: string): Mood | null {
  const said = ` ${plain(text)} `;
  let best: Mood | null = null;
  let bestScore = 0;
  for (const [mood, cues] of Object.entries(CUES) as [Mood, string[]][]) {
    const score = cues.filter((cue) => said.includes(` ${cue} `) || said.includes(` ${cue},`) || said.includes(` ${cue}.`)).length;
    if (score > bestScore) {
      best = mood;
      bestScore = score;
    } else if (score === bestScore) {
      best = score ? null : best;
    }
  }
  return best;
}
