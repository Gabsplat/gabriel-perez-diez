export const projects = [
  {
    id: 'bildenlex',
    name: 'Bildenlex',
    tags: 'Producto · Frontend',
    shape: 'section',
    story:
      'Bildenlex es un estudio jurídico especializado en propiedad intelectual y derecho tecnológico. Creé la primera versión de su sistema como único desarrollador en Corpora: participé en la definición del producto, diseñé su arquitectura y lo implementé de punta a punta. Más tarde, en Aftercode, diseñé y desarrollé la arquitectura frontend para los flujos operativos que usan a diario entre 5 y 10 personas.',
  },
  {
    id: 'legali',
    name: 'Legali / LexFlow',
    tags: 'Automatización · Legal tech',
    shape: 'document',
    story:
      'Una plataforma para automatizar procesos legales en Mendoza. Trabajé en su frontend e integraciones: construí formularios validados con Zod y flujos que conectan datos de Google Sheets, Google Drive y Airtable con la generación de documentos DOCX.',
  },
  {
    id: 'micasa',
    name: 'Mi Casa Decoraciones',
    tags: 'Herramientas · Integraciones',
    shape: 'house',
    story:
      'Desarrollé un centro de cotizaciones para Mi Casa Decoraciones. La herramienta se integra con Tango y permite crear y guardar presupuestos para el trabajo cotidiano del negocio.',
  },
  {
    id: 'nerdconf',
    name: 'Nerdconf',
    tags: 'Experiencias · Web interactiva',
    shape: 'code',
    story:
      'Construí sitios con React y WordPress, juegos y experiencias web con tecnología 3D para eventos presenciales de más de 400 asistentes. Uno de esos proyectos fue el bingo humano, un juego de networking: transformé la dinámica del evento en una experiencia web que usaron los participantes.',
  },
];

export const experience = [
  {
    date: 'Mar 2024 — Sep 2026',
    place: 'Aftercode Software',
    role: 'Desarrollador frontend y cofundador. Productos web, herramientas internas y automatización.',
  },
  {
    date: 'Oct 2021 — Ene 2026',
    place: 'Nerdconf',
    role: 'Desarrollador frontend por contrato. Sitios, juegos y experiencias digitales para eventos.',
  },
  {
    date: 'Ene 2022 — Jul 2023',
    place: 'Corpora',
    role: 'Desarrollador de software. Productos a medida, automatización documental y sistemas internos.',
  },
];

// Experimentos y vibecodeos. Para publicar uno nuevo: sumar una entrada, dejar
// su captura en public/labs/<id>.webp (800×520) y elegir una forma de shapes.ts.
// Sin `href` la tarjeta todavía no lleva a ningún lado.
export const labs: { id: string; name: string; note: string; tags: string; shape: string; href?: string }[] = [
  {
    id: 'personaje',
    name: 'Personaje de letras',
    note: 'Un personaje hecho de letras que cambia de ánimo con botones y mueve la boca con tu voz.',
    tags: 'Anime.js · WebGL · Web Audio',
    shape: 'smiley',
    href: '/personaje',
  },
  {
    id: 'microondas',
    name: 'Dentro del microondas',
    note: 'Cuaderno de ingeniería interactivo que explica un microondas por dentro, dibujado en grafito.',
    tags: 'Canvas 2D · JavaScript',
    shape: 'microwave',
    href: 'https://gabsplat.github.io/microondas-opus-55/',
  },
  {
    id: 'maquinas',
    name: 'Cuaderno de máquinas',
    note: 'Láminas animadas de una aeronave ficticia: partes, fuerzas, alas y motores.',
    tags: 'Canvas 2D · Sin dependencias',
    shape: 'jet',
  },
  {
    id: 'carbono',
    name: 'Carbono',
    note: 'Laboratorio visual de química orgánica para explorar moléculas, descubrir isómeros y construir las propias.',
    tags: 'Canvas 2D · Proyección 3D',
    shape: 'molecule',
  },
];

export const stack = [
  { area: 'Frontend', items: ['React', 'TypeScript', 'Next.js', 'Vite', 'Tailwind CSS'] },
  { area: 'Estado y formularios', items: ['TanStack Query', 'Zustand', 'React Hook Form', 'Zod'] },
  { area: 'Backend y automatización', items: ['NestJS', 'Firebase', 'Supabase', 'Integraciones con LLM'] },
  { area: 'Calidad y herramientas', items: ['Vitest', 'Playwright', 'Git', 'Docker'] },
];
