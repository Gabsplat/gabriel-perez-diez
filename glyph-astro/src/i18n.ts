import type { Lang } from './data/site';

// Textos de la interfaz en los dos idiomas. Los del contenido (proyectos,
// experiencia, labs) están en data/site.ts.

export const LANGS: Lang[] = ['es', 'en'];
/** Ruta de la portada en cada idioma. */
export const HOME: Record<Lang, string> = { es: '/', en: '/en/' };

export const copy = {
  es: {
    title: 'Gabriel Pérez Diez · Desarrollador frontend',
    description:
      'Gabriel Pérez Diez, desarrollador frontend en Mendoza, Argentina. Interfaces con React y TypeScript, hechas con IA y revisadas con criterio.',
    sections: { inicio: 'Inicio', proyectos: 'Proyectos', labs: 'Labs', 'sobre-mi': 'Sobre mí', tecnologias: 'Tecnologías', contacto: 'Contacto' },
    nav: 'Navegación principal',
    rail: 'Secciones',
    language: 'Idioma',
    cv: 'CV',
    cvFile: '/cv/Gabriel_Perez_Diez_CV_ES.pdf',
    ogAlt: 'La cordillera de los Andes dibujada con letras, con el Sol de Mayo',
    hero: {
      eyebrow: 'Desarrollador frontend · Mendoza, Argentina',
      lines: ['Interfaces con criterio.', 'Hechas a velocidad de IA.'],
      lead: 'Soy Gabriel, desarrollador frontend de Mendoza, Argentina.',
      intro: 'Trabajo con React y TypeScript: diseño la arquitectura, programo con IA y reviso cada cambio antes de que llegue a producción.',
      work: 'Ver proyectos',
      talk: 'Escribime',
      scroll: 'Seguí bajando',
      foot: 'Del pie del Aconcagua a producción',
    },
    projects: {
      label: 'Trabajo seleccionado',
      choose: 'Elegir proyecto',
      prev: 'Proyecto anterior',
      next: 'Proyecto siguiente',
      open: 'Ver proyecto ↗',
    },
    labs: {
      label: 'Labs',
      lead: 'Acá las ideas vuelan:',
      leadMuted: 'experimentos, proyectos chicos y vibecodeos, publicados apenas funcionan.',
      hint: 'Pasá por un experimento para ver de qué se trata.',
      open: 'Abrir ↗',
      soon: 'Próximamente',
    },
    about: {
      label: 'Sobre mí',
      lead: 'Construyo interfaces para productos, equipos y eventos.',
      leadMuted: 'Trabajo con React y TypeScript; cofundé Aftercode Software.',
    },
    stack: 'Tecnologías',
    contact: {
      label: '¿Hacemos algo juntos?',
      talk: 'Hablemos.',
      copy: 'Copiar',
      copied: 'Copiado',
      made: 'Hecho en Mendoza con Astro y WebGL',
    },
  },
  en: {
    title: 'Gabriel Pérez Diez · Frontend developer',
    description:
      'Gabriel Pérez Diez, frontend developer in Mendoza, Argentina. Interfaces built with React and TypeScript, at AI speed and with judgment.',
    sections: { inicio: 'Home', proyectos: 'Work', labs: 'Labs', 'sobre-mi': 'About', tecnologias: 'Stack', contacto: 'Contact' },
    nav: 'Main navigation',
    rail: 'Sections',
    language: 'Language',
    cv: 'Résumé',
    cvFile: '/cv/Gabriel_Perez_Diez_CV_EN.pdf',
    ogAlt: 'The Andes drawn in letters, with the Sun of May',
    hero: {
      eyebrow: 'Frontend developer · Mendoza, Argentina',
      lines: ['Interfaces with judgment.', 'Built at AI speed.'],
      lead: 'I’m Gabriel, a frontend developer from Mendoza, Argentina.',
      intro: 'I work with React and TypeScript: I design the architecture, build with AI and review every change before it reaches production.',
      work: 'See my work',
      talk: 'Get in touch',
      scroll: 'Keep scrolling',
      foot: 'From the foot of Aconcagua to production',
    },
    projects: {
      label: 'Selected work',
      choose: 'Choose a project',
      prev: 'Previous project',
      next: 'Next project',
      open: 'View project ↗',
    },
    labs: {
      label: 'Labs',
      lead: 'Where ideas take off:',
      leadMuted: 'experiments, small projects and vibe-coded builds, shipped as soon as they work.',
      hint: 'Hover an experiment to see what it is.',
      open: 'Open ↗',
      soon: 'Coming soon',
    },
    about: {
      label: 'About',
      lead: 'I build interfaces for products, teams and events.',
      leadMuted: 'I work with React and TypeScript, and co-founded Aftercode Software.',
    },
    stack: 'Stack',
    contact: {
      label: 'Shall we build something?',
      talk: 'Let’s talk.',
      copy: 'Copy',
      copied: 'Copied',
      made: 'Made in Mendoza with Astro and WebGL',
    },
  },
} satisfies Record<Lang, unknown>;
