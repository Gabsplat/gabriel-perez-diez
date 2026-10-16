// Contenido del portfolio en los dos idiomas. Cada texto que se traduce es
// { es, en }; `content(lang)` devuelve todo ya en el idioma pedido.
// Para sumar un proyecto alcanza con una entrada más: el dial le hace lugar.
// `shape` es una forma de shapes.ts; `year` y `href` son opcionales.

export type Lang = 'es' | 'en';
type Text = { es: string; en: string };

const projectList: { id: string; name: string; tags: Text; shape: string; story: Text; year?: string; href?: string }[] = [
  {
    id: 'bildenlex',
    name: 'Bildenlex',
    tags: { es: 'Producto · Frontend', en: 'Product · Frontend' },
    shape: 'balanza',
    story: {
      es: 'Bildenlex es un estudio jurídico especializado en propiedad intelectual y derecho tecnológico. Creé la primera versión de su sistema como único desarrollador en Corpora: participé en la definición del producto, diseñé su arquitectura y lo implementé de punta a punta. Más tarde, en Aftercode, diseñé y desarrollé la arquitectura frontend para los flujos operativos que usan a diario entre 5 y 10 personas.',
      en: 'Bildenlex is a law firm specialised in intellectual property and technology law. As the sole developer at Corpora, I built the first version of their system: I helped define the product, designed its architecture and implemented it end to end. Later, at Aftercode, I designed and built the frontend architecture for the operational workflows that 5 to 10 people use every day.',
    },
  },
  {
    id: 'legali',
    name: 'Legali / LexFlow',
    tags: { es: 'Automatización · Legal tech', en: 'Automation · Legal tech' },
    shape: 'papeles',
    story: {
      es: 'Una plataforma para automatizar procesos legales en Mendoza. Trabajé en su frontend e integraciones: construí formularios validados con Zod y flujos que conectan datos de Google Sheets, Google Drive y Airtable con la generación de documentos DOCX.',
      en: 'A platform that automates legal processes in Mendoza. I worked on its frontend and integrations: forms validated with Zod, and flows that connect data from Google Sheets, Google Drive and Airtable to generate DOCX documents.',
    },
  },
  {
    id: 'micasa',
    name: 'Mi Casa Decoraciones',
    tags: { es: 'Herramientas · Integraciones', en: 'Tools · Integrations' },
    shape: 'casa',
    story: {
      es: 'Desarrollé un centro de cotizaciones para Mi Casa Decoraciones. La herramienta se integra con Tango y permite crear y guardar presupuestos para el trabajo cotidiano del negocio.',
      en: 'I built a quoting hub for Mi Casa Decoraciones. It integrates with Tango and lets the team create and save quotes for the day-to-day work of the business.',
    },
  },
  {
    id: 'nerdconf',
    name: 'Nerdconf',
    tags: { es: 'Experiencias · Web interactiva', en: 'Experiences · Interactive web' },
    shape: 'ovni',
    story: {
      es: 'Construí sitios con React y WordPress, juegos y experiencias web con tecnología 3D para eventos presenciales de más de 400 asistentes. Uno de esos proyectos fue el bingo humano, un juego de networking: transformé la dinámica del evento en una experiencia web que usaron los participantes.',
      en: 'I built sites with React and WordPress, plus games and 3D web experiences for in-person events with more than 400 attendees. One of them was the human bingo, a networking game: I turned the event’s dynamic into a web experience the participants played.',
    },
  },
];

const experienceList: { date: Text; place: string; role: Text }[] = [
  {
    date: { es: 'Mar 2024 — Sep 2026', en: 'Mar 2024 — Sep 2026' },
    place: 'Aftercode Software',
    role: {
      es: 'Desarrollador frontend y cofundador. Productos web, herramientas internas y automatización.',
      en: 'Frontend developer and co-founder. Web products, internal tools and automation.',
    },
  },
  {
    date: { es: 'Oct 2021 — Ene 2026', en: 'Oct 2021 — Jan 2026' },
    place: 'Nerdconf',
    role: {
      es: 'Desarrollador frontend por contrato. Sitios, juegos y experiencias digitales para eventos.',
      en: 'Contract frontend developer. Sites, games and digital experiences for events.',
    },
  },
  {
    date: { es: 'Ene 2022 — Jul 2023', en: 'Jan 2022 — Jul 2023' },
    place: 'Corpora',
    role: {
      es: 'Desarrollador de software. Productos a medida, automatización documental y sistemas internos.',
      en: 'Software developer. Custom products, document automation and internal systems.',
    },
  },
];

// Experimentos y vibecodeos. Para publicar uno nuevo: sumar una entrada, dejar
// su captura en public/labs/<id>.webp (800×520) y elegir una forma de shapes.ts.
// Sin `href` la tarjeta todavía no lleva a ningún lado.
const labList: { id: string; name: Text; note: Text; tags: string; shape: string; href?: string }[] = [
  {
    id: 'personaje',
    name: { es: 'Personaje de letras', en: 'Letter character' },
    note: {
      es: 'Un personaje hecho de letras que cambia de ánimo con botones y mueve la boca con tu voz.',
      en: 'A character made of letters that changes mood with buttons and moves its mouth with your voice.',
    },
    tags: 'Anime.js · WebGL · Web Audio',
    shape: 'smiley',
    href: '/personaje',
  },
  {
    id: 'microondas',
    name: { es: 'Dentro del microondas', en: 'Inside the microwave' },
    note: {
      es: 'Cuaderno de ingeniería interactivo que explica un microondas por dentro, dibujado en grafito.',
      en: 'An interactive engineering notebook that explains a microwave from the inside, drawn in graphite.',
    },
    tags: 'Canvas 2D · JavaScript',
    shape: 'microwave',
    href: 'https://gabsplat.github.io/microondas-opus-55/',
  },
  {
    id: 'maquinas',
    name: { es: 'Cuaderno de máquinas', en: 'Machine notebook' },
    note: {
      es: 'Láminas animadas de una aeronave ficticia: partes, fuerzas, alas y motores.',
      en: 'Animated plates of a fictional aircraft: parts, forces, wings and engines.',
    },
    tags: 'Canvas 2D · Sin dependencias',
    shape: 'jet',
  },
  {
    id: 'carbono',
    name: { es: 'Carbono', en: 'Carbono' },
    note: {
      es: 'Laboratorio visual de química orgánica para explorar moléculas, descubrir isómeros y construir las propias.',
      en: 'A visual organic-chemistry lab to explore molecules, discover isomers and build your own.',
    },
    tags: 'Canvas 2D · Proyección 3D',
    shape: 'molecule',
  },
];

const stackList: { area: Text; items: string[] }[] = [
  { area: { es: 'Frontend', en: 'Frontend' }, items: ['React', 'TypeScript', 'Next.js', 'Vite', 'Tailwind CSS'] },
  { area: { es: 'Estado y formularios', en: 'State & forms' }, items: ['TanStack Query', 'Zustand', 'React Hook Form', 'Zod'] },
  { area: { es: 'Backend y automatización', en: 'Backend & automation' }, items: ['NestJS', 'Firebase', 'Supabase', 'Integraciones con LLM'] },
  { area: { es: 'Calidad y herramientas', en: 'Quality & tooling' }, items: ['Vitest', 'Playwright', 'Git', 'Docker'] },
];

// Etiquetas y nombres técnicos que también se traducen
const TERMS_EN: Record<string, string> = {
  'Sin dependencias': 'No dependencies',
  'Proyección 3D': '3D projection',
  'Integraciones con LLM': 'LLM integrations',
};
const term = (value: string, lang: Lang) => (lang === 'en' ? TERMS_EN[value] ?? value : value);

export function content(lang: Lang) {
  return {
    projects: projectList.map((p) => ({ ...p, tags: p.tags[lang], story: p.story[lang] })),
    experience: experienceList.map((e) => ({ date: e.date[lang], place: e.place, role: e.role[lang] })),
    labs: labList.map((l) => ({ ...l, name: l.name[lang], note: l.note[lang], tags: l.tags.split(' · ').map((t) => term(t, lang)).join(' · ') })),
    stack: stackList.map((s) => ({ area: s.area[lang], items: s.items.map((item) => term(item, lang)) })),
  };
}

// En español, para lo que no se traduce
export const { projects, experience, labs, stack } = content('es');
