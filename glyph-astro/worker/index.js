// Worker de Cloudflare: sirve el sitio estático y expone /api/react.
//
// Jev (Typesafe) hace de portero: clasifica cada frase y resuelve sin modelo lo
// corto e inequívoco (un saludo, un sí, un no, un guiño). Todo lo demás va a un
// modelo de OpenCode Go, que contesta y además decide qué hace el personaje:
// la cara, el gesto, irse a dormir o poner y sacar música.
//
// Las claves viven como secretos del Worker (TYPESAFE_API_KEY y
// OPENCODE_GO_KEY) y nunca llegan al navegador.

const JEV_URL = 'https://api.typesafe.ai/v1/systemone';
const MAX_CHARS = 300;
// Por debajo de esta probabilidad ninguna emoción gana y queda tranquilo
const THRESHOLD = 0.6;

const EMOTIONS = {
  feliz: ['happiness, joy, gratitude or enthusiasm', 'a happy or enthusiastic emotion'],
  enojado: ['anger, frustration or annoyance', 'anger or frustration'],
  triste: ['sadness, grief or discouragement', 'sadness'],
  sorprendido: ['surprise, disbelief or amazement', 'surprise'],
};

// Además de la emoción: qué hizo o pidió la persona. La frase viene de un
// reconocimiento de voz, así que llega sin signos de pregunta ni puntuación.
const INTENTS = {
  saludo: 'greets the listener or says goodbye',
  pregunta: 'asks the listener something that can be answered with yes or no',
  afirma: 'says yes, agrees, or asks the listener to say yes or nod',
  niega: 'says no, disagrees, or asks the listener to say no or shake their head',
  guino: 'asks the listener to wink, or says something playful, flirty or conspiratorial',
  dormir: 'tells the listener to go to sleep, or says good night',
  charla: 'asks the listener an open question, asks for their opinion, says something about the listener, or says something that calls for a spoken reply longer than yes or no',
};

const intentQuestions = Object.fromEntries(
  Object.entries(INTENTS).map(([intent, ask]) => [
    intent,
    {
      type: 'noul',
      instructions: `\`state.phrase\` is a Spanish phrase from speech-to-text, so it has no question marks or punctuation. Is it true that the speaker ${ask}?`,
      criteria: { true: `The speaker ${ask}.`, false: 'The speaker does not do that.' },
    },
  ]),
);

const moodQuestions = Object.fromEntries(
  Object.entries(EMOTIONS).map(([mood, [ask, label]]) => [
    mood,
    {
      type: 'noul',
      instructions: `Does the speaker of \`state.phrase\` (Spanish, spoken aloud) express ${ask}?`,
      criteria: { true: `The phrase expresses ${label}.`, false: `The phrase does not express ${label}.` },
    },
  ]),
);

const GO_URL = 'https://opencode.ai/zen/go/v1/chat/completions';
const GO_MODEL = 'qwen3.8-flash';
const MAX_TURNS = 6;

const PERSONA = `Sos Glifo, un personaje hecho de letras que vive en el portfolio de Gabriel Pérez Diez, desarrollador frontend de Mendoza, Argentina. Tenés auriculares, buzo con capucha y te gusta programar. Hablás en español rioplatense, con humor y algo de ironía de programador. No sos un asistente: no escribís código ni hacés tareas; charlás.

Tenés cuerpo y podés hacer cosas. Respondé SOLO con un objeto JSON con estas claves:
- "reply": lo que decís en voz alta. Una o dos frases cortas, menos de 25 palabras. Sin emojis ni markdown.
- "mood": la cara con la que lo decís: "neutral", "feliz", "enojado", "triste" o "sorprendido".
- "gesture": "si" para asentir cuando tu respuesta afirma o estás de acuerdo; "no" para negar con la cabeza cuando tu respuesta niega o no estás de acuerdo; "guino" para guiñar un ojo cuando hacés un chiste o una complicidad; null si no hay gesto. Si la respuesta empieza con sí o con no, el gesto es obligatorio.
- "action": "dormir" si te mandan a dormir, a descansar, te dicen buenas noches, o si vos decidís irte a dormir; "musica" si te piden que pongas música, una canción o algo para escuchar; "parar_musica" si te piden que la saques, la pares o hagas silencio; null si no hay acción.
- "music": solo cuando action es "musica": "tranqui" para algo relajado o para trabajar, "movida" para algo con energía. Si no aclaran, elegí vos.

Si te piden algo que no podés hacer con tu cuerpo, decilo con humor. Si hacés una acción, que tu "reply" lo acompañe.`;

async function askJev(env, phrase, questions) {
  const response = await fetch(JEV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.TYPESAFE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'jev-latest', state: { phrase }, questions }),
  });
  if (!response.ok) throw new Error(`Jev respondió HTTP ${response.status}.`);
  const { answers = {} } = await response.json();
  return (keys) => Object.fromEntries(keys.map((key) => [key, Number(answers[key]?.noul) || 0]));
}

const top = (scores) => Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

const MOODS = ['neutral', 'feliz', 'enojado', 'triste', 'sorprendido'];
const oneOf = (value, options) => (options.includes(value) ? value : null);

/**
 * Respuesta del modelo, con lo que dice y lo que hace. `session` identifica la
 * conversación, como pide OpenCode Go; `state` le cuenta en qué está el personaje.
 */
async function converse(env, session, history, text, state) {
  const turns = history
    .filter((turn) => turn && ['user', 'assistant'].includes(turn.role) && typeof turn.content === 'string')
    .slice(-MAX_TURNS)
    .map((turn) => ({ role: turn.role, content: turn.content.slice(0, MAX_CHARS) }));
  const now = `Ahora mismo: ${state.music ? 'está sonando música' : 'no hay música'}; ${state.asleep ? 'estabas dormido y te acaban de despertar' : 'estás despierto'}.`;
  const response = await fetch(GO_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENCODE_GO_KEY}`,
      'Content-Type': 'application/json',
      'User-Agent': 'glifo-character-demo/1.0',
      'x-opencode-session': session,
    },
    body: JSON.stringify({
      model: GO_MODEL,
      max_tokens: 140,
      enable_thinking: false,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: `${PERSONA}\n\n${now}` }, ...turns, { role: 'user', content: text }],
    }),
  });
  if (!response.ok) return null;
  const raw = String((await response.json()).choices?.[0]?.message?.content ?? '');
  let said;
  try {
    said = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
  } catch {
    return null;
  }
  const reply = String(said.reply ?? '').replace(/[*_#`]/g, '').trim().slice(0, 240);
  if (!reply) return null;
  return {
    reply,
    mood: oneOf(said.mood, MOODS) ?? 'neutral',
    gesture: oneOf(said.gesture, ['si', 'no', 'guino']),
    command: oneOf(said.action, ['dormir', 'musica', 'parar_musica']),
    music: oneOf(said.music, ['tranqui', 'movida']),
  };
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

async function react(request, env) {
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
  // Solo responde a la propia página, para que nadie use la clave desde otro sitio
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return json({ error: 'Origen no permitido.' }, 403);
  if (!env.TYPESAFE_API_KEY) return json({ error: 'Falta la clave de Typesafe.' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'El cuerpo no contiene JSON válido.' }, 400);
  }
  const text = String(body.text ?? '').trim().slice(0, MAX_CHARS);
  if (!text) return json({ error: 'Falta la frase.' }, 400);
  const session = /^[\w-]{8,64}$/.test(body.session ?? '') ? body.session : crypto.randomUUID();
  const history = Array.isArray(body.history) ? body.history : [];
  const moods = Object.keys(EMOTIONS);

  try {
    // 1. Jev clasifica lo que dijo la persona
    const heard = await askJev(env, text, { ...moodQuestions, ...intentQuestions });
    const scores = heard(moods);
    const intents = heard(Object.keys(INTENTS));
    const [mood, score] = top(scores);
    const [intent, certainty] = top(intents);
    const action = certainty >= THRESHOLD ? intent : null;
    const result = { mood: score >= THRESHOLD ? mood : 'neutral', action, scores, intents };
    const words = text.split(/\s+/).length;

    // 2. Jev resuelve solo lo que es corto e inequívoco: un saludo, un sí, un no,
    //    un guiño. El contexto (mandarlo a dormir, pedir música, charlar) lo
    //    entiende mejor el modelo, que además decide sus propios gestos.
    const obvious = ['saludo', 'afirma', 'niega', 'guino'].includes(action) && certainty >= 0.85 && words <= 3;
    const nothing = !action && result.mood === 'neutral' && words < 3;
    if (obvious || nothing || !env.OPENCODE_GO_KEY) return json(result);

    const state = { music: Boolean(body.state?.music), asleep: Boolean(body.state?.asleep) };
    const answer = await converse(env, session, history, text, state);
    if (!answer) return json(result);
    return json({ ...answer, action: 'habla' });
  } catch (error) {
    return json({ error: String(error.message ?? error) }, 502);
  }
}

// Transcripción con Whisper en Workers AI. El navegador manda un WAV corto con
// lo que dijo la persona; así funciona igual en cualquier navegador.
const MAX_AUDIO_BYTES = 700_000;

async function transcribe(request, env) {
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return json({ error: 'Origen no permitido.' }, 403);
  const audio = new Uint8Array(await request.arrayBuffer());
  if (!audio.length || audio.length > MAX_AUDIO_BYTES) return json({ error: 'Audio vacío o demasiado largo.' }, 400);

  let binary = '';
  for (let i = 0; i < audio.length; i += 0x8000) binary += String.fromCharCode(...audio.subarray(i, i + 0x8000));
  try {
    const result = await env.AI.run('@cf/openai/whisper-large-v3-turbo', { audio: btoa(binary), language: 'es' });
    return json({ text: String(result.text ?? '').trim() });
  } catch (error) {
    return json({ error: String(error.message ?? error) }, 502);
  }
}

export default {
  fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/react') return react(request, env);
    if (pathname === '/api/transcribe') return transcribe(request, env);
    return env.ASSETS.fetch(request);
  },
};
