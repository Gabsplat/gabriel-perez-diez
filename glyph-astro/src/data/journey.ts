import type { Scene } from '../scripts/ascii-field';
import type { Lang } from './site';

// La historia de Gabriel, capítulo por capítulo: cada uno con su escena de
// letras, una frase grande y una línea chica debajo. Termina en el espacio.

type Text = { es: string; en: string };

export interface Chapter {
  scene: Scene;
  /** Color de la escena (las que lo usan: ciudad, lava, átomo). */
  accent?: [number, number, number];
  line: Text;
  sub: Text;
}

export const CHAPTERS: Chapter[] = [
  {
    scene: 'vinedos',
    line: { es: 'Mendoza. Viñedos, cordillera y una compu vieja.', en: 'Mendoza. Vineyards, mountains and an old computer.' },
    sub: { es: 'Desarmar todo para entender cómo anda', en: 'Taking everything apart to see how it works' },
  },
  {
    scene: 'atomo',
    accent: [97, 218, 251],
    line: { es: 'Aprendí a hablarles a las máquinas.', en: 'I learned to talk to machines.' },
    sub: { es: 'Licenciatura en Informática · Universidad del Aconcagua', en: 'Computer Science degree · Universidad del Aconcagua' },
  },
  {
    scene: 'ciudad',
    accent: [116, 172, 223],
    line: { es: 'Después, a construir para gente real.', en: 'Then I built for real people.' },
    sub: { es: 'Corpora · Nerdconf · eventos de más de 400 personas', en: 'Corpora · Nerdconf · events for 400+ people' },
  },
  {
    scene: 'lava',
    accent: [255, 110, 150],
    line: { es: 'Cofundé Aftercode. Nunca dejé de experimentar.', en: 'I co-founded Aftercode. Never stopped experimenting.' },
    sub: { es: 'Productos, herramientas internas y un laboratorio de ideas', en: 'Products, internal tools and a lab full of ideas' },
  },
  {
    scene: 'planeta',
    accent: [116, 172, 223],
    line: { es: 'Hoy construyo con IA. Soy parte de la revolución.', en: 'Today I build with AI. I’m part of the revolution.' },
    sub: { es: 'Desde Mendoza, para el mundo', en: 'From Mendoza, to the world' },
  },
];

export const JOURNEY_COPY = {
  es: { play: 'Mi historia', open: 'Y todo empieza acá…', finale: 'Mandándole prompts al universo.' },
  en: { play: 'My story', open: 'And it all begins here…', finale: 'Prompting the universe.' },
} satisfies Record<Lang, unknown>;
