import type { Lang } from './site';

// La familia de la foto. `u` y `v` son el centro de cada cara en el video de
// la Live Photo (0 a 1, y hacia abajo) y `r` el radio de la cara.

type Text = { es: string; en: string };

export interface Member {
  id: string;
  name: string;
  u: number;
  v: number;
  r: number;
  role: Text;
  quip: Text;
}

const people: Record<string, Member> = {
  paula: { id: 'paula', name: 'Paula', u: 0.298, v: 0.241, r: 0.032, role: { es: 'Hermana', en: 'Sister' }, quip: { es: 'La artista de la familia.', en: 'The family’s artist.' } },
  ani: { id: 'ani', name: 'Ani', u: 0.236, v: 0.273, r: 0.034, role: { es: 'Cuñada', en: 'Sister-in-law' }, quip: { es: 'La deportista.', en: 'The athlete.' } },
  manu: {
    id: 'manu', name: 'Manu', u: 0.19, v: 0.296, r: 0.028,
    role: { es: 'El más chiquito', en: 'The littlest one' },
    quip: { es: 'El arte.', en: 'The art itself.' },
  },
  dibu: { id: 'dibu', name: 'Dibu', u: 0.394, v: 0.213, r: 0.036, role: { es: 'Cuñado', en: 'Brother-in-law' }, quip: { es: 'DibuGPT. Preguntale lo que quieras.', en: 'DibuGPT. Ask him anything.' } },
  pablito: { id: 'pablito', name: 'Pablito', u: 0.529, v: 0.204, r: 0.034, role: { es: 'Primo · hermano', en: 'Cousin · brother' }, quip: { es: 'Una máquina.', en: 'An absolute machine.' } },
  gabriel: { id: 'gabriel', name: 'Gabriel', u: 0.635, v: 0.222, r: 0.034, role: { es: '', en: '' }, quip: { es: '(yo)', en: '(me)' } },
  cristina: {
    id: 'cristina', name: 'Cristina', u: 0.776, v: 0.264, r: 0.032,
    role: { es: 'Mamá · Química', en: 'Mom · Chemist' },
    quip: { es: 'Directora del CUC. Tiene más carreras que dedos.', en: 'Runs the CUC. More degrees than fingers.' },
  },
  francisco: { id: 'francisco', name: 'Francisco', u: 0.887, v: 0.218, r: 0.034, role: { es: 'Papá · Abogado', en: 'Dad · Lawyer' }, quip: { es: 'El 1. Inigualable.', en: 'Number one. Unmatched.' } },
  pablo: {
    id: 'pablo', name: 'Pablo', u: 0.696, v: 0.44, r: 0.034,
    role: { es: 'Hermano · Emprendedor', en: 'Brother · Entrepreneur' },
    quip: { es: 'Arma negocios como quien arma rolls.', en: 'Rolls out businesses like nobody else.' },
  },
  delfina: { id: 'delfina', name: 'Delfi', u: 0.645, v: 0.574, r: 0.028, role: { es: 'La más chiquita', en: 'The littlest lady' }, quip: { es: 'La que manda en el sillón.', en: 'Runs the couch.' } },
  pitu: {
    id: 'pitu', name: 'Pitu', u: 0.544, v: 0.463, r: 0.032,
    role: { es: 'Cuñada · Maestra jardinera', en: 'Sister-in-law · Kindergarten teacher' },
    quip: { es: 'Paciencia nivel sala de 3.', en: 'Patience, kindergarten level.' },
  },
  fausti: {
    id: 'fausti', name: 'Fausti', u: 0.378, v: 0.468, r: 0.03,
    role: { es: 'El niño · Arquerazo', en: 'The kid · Goalkeeper' },
    quip: { es: 'El Dibu de la familia. Guerrero, único, genio.', en: 'Our own Dibu Martínez. A warrior, one of a kind, a genius.' },
  },
  florencia: { id: 'florencia', name: 'Florencia', u: 0.306, v: 0.454, r: 0.032, role: { es: 'Hermana · Psicóloga', en: 'Sister · Psychologist' }, quip: { es: 'Flopi. Te escucha de verdad.', en: 'Flopi. Actually listens.' } },
};

/** Una parada de la historia: una persona, o los papás juntos con un corazón. */
export interface Beat {
  members: Member[];
  /** Pausa más larga y el texto más grande. */
  me?: boolean;
  heart?: boolean;
  /** Llega volando un Iron Man chiquito, el héroe de su remera. */
  hero?: boolean;
}

// El recorrido: arriba de izquierda a derecha, y el sillón de vuelta
export const BEATS: Beat[] = [
  { members: [people.paula] },
  { members: [people.ani] },
  { members: [people.manu] },
  { members: [people.dibu] },
  { members: [people.pablito] },
  { members: [people.gabriel], me: true },
  { members: [people.cristina, people.francisco], heart: true },
  { members: [people.pablo] },
  { members: [people.delfina] },
  { members: [people.pitu] },
  { members: [people.florencia] },
  { members: [people.fausti], hero: true },
];

export const STORY_COPY = {
  es: { open: 'Y todo empieza acá…', end: 'Mi familia.', finale: 'Mandándole prompts al universo.', play: 'Conocé a mi familia', close: 'Volver', replay: 'Ver de nuevo', home: 'Volver al inicio' },
  en: { open: 'And it all begins here…', end: 'My family.', finale: 'Prompting the universe.', play: 'Meet my family', close: 'Back', replay: 'Replay', home: 'Back to the start' },
} satisfies Record<Lang, unknown>;

/** El texto con el que se escribe la foto: los nombres de todos. */
export const photoText = (lang: Lang) =>
  `${Object.values(people).map((p) => p.name.toLowerCase()).join(' · ')} · ${STORY_COPY[lang].end.toLowerCase()} · `;
