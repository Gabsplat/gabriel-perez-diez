import { animate } from 'animejs';

// Fondo de letras: cada sección tiene una escena procedural (los Andes con el
// Sol de Mayo, una ciudad de noche, lava, viñedos, el átomo de React, la Tierra)
// dibujada con un texto que se puede leer. Cada celda es la letra siguiente del
// texto de la escena; la luz decide su color, su brillo y si va en negrita.
//
// Se hace en dos pasadas de WebGL. La primera calcula la escena en una textura
// de dos por dos píxeles por celda: ahí vive todo el costo, y por eso una escena
// en 3D con trazado de rayos cuesta lo mismo que un degradado. La segunda recorre
// la pantalla, toma la letra de cada celda y la tiñe con la escena que tiene
// debajo, así los bordes de la escena cortan por dentro de las letras.

export type Scene = 'andes' | 'ciudad' | 'lava' | 'vinedos' | 'atomo' | 'planeta' | 'foto';
type Side = 'left' | 'right' | 'center';

const SCENES: Scene[] = ['andes', 'ciudad', 'lava', 'vinedos', 'atomo', 'planeta', 'foto'];
// Cuánto se apaga cada escena detrás de la forma de letras
// Ya no hay figuras delante del fondo: ninguna escena se apaga en el centro
const HUSH = [0, 0, 0, 0, 0, 0, 0];
// Lo que se lee en cada escena, en el mismo orden, en los dos idiomas
const TEXTS_BY_LANG: Record<string, string[]> = {
  es: [
  'esto no es una foto. cada píxel es una letra: estás leyendo la cordillera de los andes ahora mismo. el cielo es celeste y blanco y el sol es el de mayo. soy gabriel pérez diez, desarrollador frontend, y escribo esto desde mendoza, argentina, al pie del aconcagua. argentino y orgulloso. vibecoder que ejecuta y lee el diff. ',
  'cada ventana encendida es alguien usando algo que construí. bildenlex: el sistema de un estudio de propiedad intelectual. legali: documentos que se arman solos. mi casa decoraciones: presupuestos en minutos. nerdconf: juegos para más de 400 personas. todo en producción, todos los días. ',
  'acá las ideas hierven. experimentos, vibecodeos y proyectos chicos que se publican apenas funcionan. un personaje hecho de letras, un microondas por dentro, máquinas que vuelan, moléculas que se arman solas. probar, romper, volver a probar. ',
  'mendoza: viñedos, acequias, álamos y la cordillera de fondo. acá vivo y trabajo. construyo interfaces con react y typescript para productos, equipos y eventos. cofundé aftercode software; antes, corpora y nerdconf. el sol se esconde atrás de los andes todas las tardes. ',
  'react · typescript · next.js · vite · tailwind css · tanstack query · zustand · react hook form · zod · nestjs · firebase · supabase · llm · vitest · playwright · git · docker · ',
  'hablemos. grperezdiez@gmail.com. desde mendoza, argentina, para el resto del mundo. respondo rápido, en español o en inglés. github: gabsplat. ¿hacemos algo juntos? ',
],
  en: [
  'this is not a photo. every pixel is a letter: you are reading the andes right now. the sky is light blue and white, and the sun is the sun of may. i am gabriel pérez diez, frontend developer, writing this from mendoza, argentina, at the foot of aconcagua. argentinian and proud. ',
  'every lit window is someone using something i built. bildenlex: the system of an intellectual property law firm. legali: documents that write themselves. mi casa decoraciones: quotes in minutes. nerdconf: games for more than 400 people. all in production, every day. ',
  'this is where ideas boil. experiments, vibe-coded builds and small projects, shipped as soon as they work. a character made of letters, a microwave from the inside, machines that fly, molecules that build themselves. try, break, try again. ',
  'mendoza: vineyards, irrigation ditches, poplars and the andes behind them. i live and work here. i build interfaces with react and typescript for products, teams and events. i co-founded aftercode software; before that, corpora and nerdconf. every evening the sun sets behind the andes. ',
  'react · typescript · next.js · vite · tailwind css · tanstack query · zustand · react hook form · zod · nestjs · firebase · supabase · llm · vitest · playwright · git · docker · ',
  'let us talk. grperezdiez@gmail.com. from mendoza, argentina, to the rest of the world. i reply fast, in spanish or english. github: gabsplat. shall we build something together? ',
],
};
const TEXTS = TEXTS_BY_LANG[document.documentElement.lang] ?? TEXTS_BY_LANG.es;
const FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace';
const GLYPH_W = 36, GLYPH_H = 64;
// Píxeles de escena por celda, en cada eje: 2 en equipos que llegan, 1 en los que no
const SUB = 2;
const WAVES = 4;

const QUAD = `#version 300 es
in vec2 corner;
void main() { gl_Position = vec4(corner, 0.0, 1.0); }`;

const SCENE = `#version 300 es
precision highp float;
uniform vec2 grid;
// Píxeles de escena por celda (2, o 1 en calidad liviana)
uniform float sub;
uniform float aspect;
uniform float time;
uniform int from;
uniform int to;
uniform float blend;
// 1: el cambio de escena se abre como un iris, desde el centro
uniform float iris;
uniform float side;
uniform float narrow;
uniform vec2 center;
uniform vec2 pointer;
uniform float scroll;
uniform float hush;
uniform vec3 accent;
uniform vec4 waves[${WAVES}];
// Foto: la imagen, su proporción, la cámara (centro en la foto y zoom) y el halo
// que señala a una persona (centro, radio y fuerza, en coordenadas de la foto)
uniform sampler2D photo;
uniform float photoAspect;
uniform vec3 camera;
uniform vec4 halo;
// El final en el espacio: cuánto se ve (x), cuánto subió la luna (y),
// por dónde va el cohete (z) y el destello del alunizaje (w)
uniform vec4 cosmic;
// La ciudad cambia según el proyecto: variante de la que viene (x), a la que va (y) y cuánto (z)
uniform vec3 variant;
// La Tierra: día en rgb y luces de ciudades en a, en proyección equirectangular
uniform sampler2D earth;
out vec4 color;

const vec3 CELESTE = vec3(0.45, 0.68, 0.9);
const vec3 GOLD = vec3(1.0, 0.74, 0.26);

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float sum = 0.0, amp = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amp * noise(p);
    p = p * 2.03 + 17.0;
    amp *= 0.5;
  }
  return sum;
}
float stars(float amount) {
  vec2 cell = floor(gl_FragCoord.xy);
  float seed = hash(cell);
  return step(1.0 - amount, seed) * (0.45 + 0.55 * sin(time * (1.0 + seed * 3.0) + seed * 40.0));
}
mat2 turn(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

// Cada escena devuelve un color; su brillo decide cuánto se ve cada letra

// ── Andes: vuelo por un valle de la cordillera, con el Sol de Mayo ──────────
float ridges(vec2 w, int octaves) {
  float ridge = 0.0, amp = 0.6;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    float n = 1.0 - abs(noise(w) * 2.0 - 1.0);
    ridge += amp * n * n;
    w = w * 2.07 + 9.3;
    amp *= 0.5;
  }
  return ridge;
}
float valley(vec2 q) { return 0.12 + 2.3 * smoothstep(0.1, 1.9, abs(q.x + sin(q.y * 0.35) * 0.45)); }
// La marcha usa el relieve grueso; la luz, el fino
float ground(vec2 q) { return ridges(q * 0.55, 4) * valley(q); }
float groundFine(vec2 q) { return ridges(q * 0.55, 7) * valley(q); }

// El sol de la bandera: un disco y 32 rayos, rectos y flamígeros alternados
vec3 solDeMayo(vec2 d, float R) {
  float r = length(d);
  float sector = (atan(d.y, d.x) + time * 0.04) / 6.2831853 * 32.0;
  float wavy = mod(floor(sector), 2.0);
  float along = (r - R * 1.1) / (R * 1.6);
  float f = fract(sector) - 0.5 + wavy * sin(along * 15.0 - time * 1.6) * 0.17 * along;
  float reach = mix(1.0, 0.8, wavy);
  float width = 0.42 * (1.0 - along / reach);
  float ray = step(0.0, along) * step(along, reach) * smoothstep(width, width - 0.12, abs(f));
  float disc = smoothstep(R, R * 0.93, r);
  return GOLD * (disc * 1.3 + ray * 0.95 + exp(-r / R * 1.2) * 0.5);
}

vec3 andes(vec2 p) {
  vec2 sun = vec2(center.x + 0.04, 0.27 + 0.012 * sin(time * 0.3));
  float R = 0.062;
  // Cielo con la bandera: blanco en el horizonte, celeste arriba
  vec3 sky = mix(vec3(0.94, 0.96, 1.0) * 0.85, CELESTE * 0.75, smoothstep(0.12, 0.3, p.y));
  sky = mix(sky, CELESTE * 0.5, smoothstep(0.34, 0.6, p.y));
  float clouds = smoothstep(0.55, 0.8, fbm(vec2(p.x * 1.6 + time * 0.02, p.y * 6.0 + 3.0))) * smoothstep(0.3, 0.45, p.y);
  sky += clouds * vec3(0.28, 0.3, 0.34);
  sky += solDeMayo(p - sun, R);

  // El Aconcagua y su cordón, lejos, recortados contra el sol
  float far = 0.1 + 0.05 * fbm(vec2(p.x * 2.4 + 4.0, 1.0)) + 0.2 * exp(-abs(p.x - sun.x + 0.24) * 5.5);
  if (p.y < far) {
    float depth = far - p.y;
    float snow = smoothstep(0.08, 0.0, depth) * smoothstep(0.13, 0.2, far) * (0.55 + 0.45 * noise(p * vec2(70.0, 35.0)));
    vec3 massif = mix(vec3(0.44, 0.54, 0.72) * 0.6, vec3(0.92, 0.95, 1.0) * 0.92, snow);
    massif += GOLD * smoothstep(0.01, 0.0, depth) * exp(-abs(p.x - sun.x) * 3.0) * 0.9;
    sky = massif;
  }

  // La cámara vuela alto, siguiendo las curvas del valle: el cielo queda arriba
  float along = time * 0.22;
  vec3 eye = vec3(-sin(along * 0.35) * 0.45, 1.9 + scroll * 0.6, along);
  vec3 ray = normalize(vec3(p.x, p.y - 0.1 - scroll * 0.12, 0.9));
  vec3 toSun = normalize(vec3(sun, 0.9));

  float t = 0.05;
  bool hit = false;
  for (int i = 0; i < 110; i++) {
    vec3 q = eye + ray * t;
    float above = q.y - ground(q.xz);
    if (above < 0.002 * t) { hit = true; break; }
    t += max(0.02, above * 0.4);
    if (t > 18.0) break;
  }
  vec3 haze = vec3(0.78, 0.86, 0.96) * 0.55;
  // Lo que apunta hacia abajo y no tocó nada es valle lejano, en la bruma
  if (!hit) return ray.y < 0.0 ? haze : sky;

  vec3 q = eye + ray * t;
  float e = 0.006 * t + 0.006;
  float here = groundFine(q.xz);
  vec3 n = normalize(vec3(groundFine(q.xz - vec2(e, 0)) - groundFine(q.xz + vec2(e, 0)), 2.0 * e, groundFine(q.xz - vec2(0, e)) - groundFine(q.xz + vec2(0, e))));
  // El sol queda de frente: una luz lateral modela las laderas y el sol enciende los filos
  float fill = max(dot(n, normalize(vec3(-0.25, 0.65, -0.72))), 0.0);
  float rim = pow(1.0 - max(dot(n, -ray), 0.0), 3.0) * (0.35 + 0.65 * max(dot(n, toSun), 0.0));
  float snow = smoothstep(1.1, 1.8, here + (noise(q.xz * 8.0) - 0.5) * 0.3) * smoothstep(0.45, 0.75, n.y);
  vec3 rock = vec3(0.22, 0.27, 0.4) * (0.04 + fill * 1.05);
  rock = mix(rock, vec3(0.9, 0.95, 1.0) * (0.25 + 0.85 * fill), snow);
  rock += GOLD * rim * 0.9;
  // Estratos: líneas de altura que ayudan a leer el relieve
  rock *= 0.8 + 0.2 * step(0.5, fract(here * 7.0));
  return mix(rock, haze, 1.0 - exp(-t * 0.09));
}

// ── Ciudad: vuelo de noche por una avenida entre edificios ──────────────────
const float BLOCK = 1.7;
float box(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
// Variante de la ciudad que se está dibujando:
// 0 noche común, 1 Bildenlex, 2 Legali, 3 Mi Casa, 4 Nerdconf
float gv = 0.0;
// Centro, medio ancho y altura del edificio de una manzana
vec4 building(vec2 c) {
  float tall = 0.8 + pow(hash(c + 3.1), 2.0) * 7.0;
  // Mi Casa: un barrio de casas bajas
  if (gv > 2.5 && gv < 3.5) tall = 0.55 + 0.35 * hash(c + 3.1);
  // Bildenlex: edificios macizos y parejos, como un barrio de tribunales
  if (gv > 0.5 && gv < 1.5) tall = 1.8 + 1.6 * hash(c + 3.1);
  return vec4((c + 0.5) * BLOCK, BLOCK * (0.3 + 0.1 * hash(c + 7.7)), tall);
}
float city(vec3 q) {
  vec2 c = floor(q.xz / BLOCK);
  vec2 local = q.xz - c * BLOCK;
  // Nunca avanza más allá del borde de la manzana: el edificio vecino puede estar ahí
  float d = min(q.y, min(min(local.x, BLOCK - local.x), min(local.y, BLOCK - local.y)) + BLOCK * 0.08);
  // Las dos columnas del medio son la avenida
  if (c.x < -1.0 || c.x > 0.0) {
    vec4 b = building(c);
    d = min(d, box(q - vec3(b.x, b.w * 0.5, b.y), vec3(b.z, b.w * 0.5, b.z)));
  }
  return d;
}
vec3 cityLook(vec2 p, float v) {
  gv = v;
  vec3 eye = vec3(sin(time * 0.2) * 0.3, 1.0 + sin(time * 0.13) * 0.35, time * 1.6);
  if (v > 2.5 && v < 3.5) eye.y = 0.55 + sin(time * 0.13) * 0.1;
  vec3 ray = normalize(vec3(p.x, p.y + 0.02, 1.0));
  ray.xz = turn(sin(time * 0.1) * 0.08) * ray.xz;
  vec3 haze = vec3(0.3, 0.12, 0.34) * 0.55;
  vec3 glowSky = vec3(0.7, 0.22, 0.55);
  if (v > 0.5 && v < 1.5) { haze = vec3(0.1, 0.16, 0.32) * 0.6; glowSky = vec3(0.3, 0.5, 0.9); }
  if (v > 1.5 && v < 2.5) { haze = vec3(0.08, 0.2, 0.14) * 0.6; glowSky = vec3(0.3, 0.8, 0.5); }
  if (v > 2.5 && v < 3.5) { haze = vec3(0.3, 0.18, 0.1) * 0.6; glowSky = vec3(1.0, 0.55, 0.3); }
  vec3 sky = vec3(0.06, 0.04, 0.12) + glowSky * exp(-abs(p.y + 0.02) * 7.0) * 0.6 + stars(0.012) * 0.4;

  // Nerdconf: un OVNI flota sobre la avenida y su haz cae a la calle
  float beam = 0.0;
  // El OVNI se dibuja encima de todo, edificios incluidos
  vec3 ufoCol = vec3(0.0);
  float ufoA = 0.0;
  if (v > 3.5) {
    // Del lado de la escena, lejos del texto
    vec2 ufo = vec2(-aspect * 0.24 + sin(time * 0.5) * 0.06, 0.26 + sin(time * 1.3) * 0.015);
    vec2 u = p - ufo;
    float disc = length(u * vec2(1.0, 4.2)) - 0.14;
    float dome = length(u - vec2(0.0, 0.025)) - 0.05;
    float lights = step(0.5, fract((u.x + time * 0.08) * 22.0)) * smoothstep(0.012, 0.0, abs(u.y + 0.003)) * step(abs(u.x), 0.13);
    float spread = clamp((ufo.y - p.y) * 0.45 + 0.06, 0.0, 1.0);
    beam = step(p.y, ufo.y) * smoothstep(spread, spread * 0.6, abs(u.x)) * (0.55 + 0.25 * sin(p.y * 60.0 + time * 6.0));
    sky += vec3(1.0, 0.45, 0.15) * beam * 0.6;
    if (dome < 0.0) { ufoCol = vec3(0.45, 0.85, 0.95) * (0.6 + 0.4 * (-dome / 0.05)); ufoA = 1.0; }
    if (disc < 0.0) { ufoCol = vec3(0.55, 0.56, 0.62) * (0.7 + 0.5 * smoothstep(0.0, -0.04, disc)) + vec3(1.0, 0.85, 0.3) * lights; ufoA = 1.0; }
  }

  float t = 0.0;
  bool hit = false;
  for (int i = 0; i < 100; i++) {
    float d = city(eye + ray * t);
    if (d < 0.002) { hit = true; break; }
    t += d;
    if (t > 45.0) break;
  }
  if (!hit) return mix(sky, ufoCol, ufoA);

  vec3 q = eye + ray * t;
  vec3 col;
  if (q.y < 0.01) {
    // Avenida mojada: línea del medio y luces de autos en dos carriles
    float lane = sign(q.x);
    col = vec3(0.03, 0.03, 0.05) + vec3(0.9, 0.8, 0.5) * 0.5 * step(abs(q.x), 0.03) * step(0.5, fract(q.z * 0.4));
    float s = fract(q.z * 0.12 - lane * time * 0.5 + hash(vec2(lane, 2.0)));
    float car = smoothstep(0.14, 0.0, abs(abs(q.x) - 0.7)) * pow(s, 8.0);
    col += (lane > 0.0 ? vec3(1.0, 0.18, 0.15) : vec3(1.0, 0.92, 0.75)) * car * 1.4;
    // Mi Casa: faroles cálidos a los costados de la calle
    if (v > 2.5 && v < 3.5) col += vec3(1.0, 0.7, 0.35) * exp(-pow((abs(q.x) - 1.05) * 6.0, 2.0)) * (0.4 + 0.6 * step(0.7, fract(q.z * 0.25)));
    // Nerdconf: el haz ilumina la avenida
    col += vec3(1.0, 0.45, 0.15) * beam * 0.5;
    col += vec3(0.5, 0.2, 0.45) * 0.12 * (1.0 - exp(-t * 0.08));
  } else {
    vec2 c = floor(q.xz / BLOCK);
    vec4 b = building(c);
    vec3 rel = q - vec3(b.x, 0.0, b.y);
    bool faceX = abs(abs(rel.x) - b.z) < abs(abs(rel.z) - b.z);
    float along = faceX ? rel.z : rel.x;
    // Ventanas: una grilla en cada cara, encendidas al azar
    vec2 win = vec2(along * 6.0, q.y * 5.0);
    vec2 wi = floor(win), wf = fract(win);
    float pane = step(0.25, wf.x) * step(wf.x, 0.8) * step(0.25, wf.y) * step(wf.y, 0.75);
    float on = step(0.5, hash(wi + c * 13.1 + (faceX ? 5.0 : 0.0)));
    vec3 lamp = mix(vec3(1.0, 0.78, 0.42), vec3(0.62, 0.82, 1.0), step(0.85, hash(wi * 1.3 + c)));
    vec3 wall = vec3(0.1, 0.08, 0.16) * (0.6 + 0.6 * exp(-q.y * 0.4));
    if (v > 0.5 && v < 1.5) {
      // Bildenlex: fachadas de columnas claras, como un palacio de justicia
      float column = smoothstep(0.32, 0.22, abs(fract(along * 3.2) - 0.5));
      float band = step(b.w - 0.28, q.y) + step(q.y, 0.18);
      wall = vec3(0.16, 0.2, 0.3) * (0.5 + 0.7 * exp(-q.y * 0.25));
      col = wall + vec3(0.75, 0.82, 0.95) * max(column, band) * 0.55 + accent * 0.25 * step(b.w - 0.06, q.y);
    } else if (v > 1.5 && v < 2.5) {
      // Legali: las ventanas se encienden en orden de lectura, como un documento que se escribe
      float floors = floor(b.w * 5.0);
      float cols = floor(b.z * 12.0);
      float index = (floors - wi.y) * cols + (wi.x + b.z * 6.0);
      float typed = fract(time * 0.09 + hash(c + 2.2)) * floors * cols;
      on = step(index, typed);
      float cursor = step(abs(index - typed), 0.6);
      col = wall + pane * (on * vec3(0.55, 0.95, 0.65) * 0.8 + cursor * vec3(1.0));
    } else if (v > 2.5 && v < 3.5) {
      // Mi Casa: casas con ventanas grandes, cálidas, casi todas encendidas
      vec2 big = vec2(along * 3.0, q.y * 3.0);
      vec2 bf = fract(big);
      float glass = step(0.22, bf.x) * step(bf.x, 0.78) * step(0.3, bf.y) * step(bf.y, 0.8);
      float home = step(0.25, hash(floor(big) + c * 3.7));
      wall = vec3(0.16, 0.11, 0.09) * (0.7 + 0.5 * exp(-q.y));
      col = wall + glass * home * vec3(1.0, 0.72, 0.38) * (0.75 + 0.35 * hash(floor(big) + 1.0));
    } else {
      col = wall + pane * on * lamp * (0.65 + 0.45 * hash(wi + 2.0));
      if (v > 3.5) lamp = mix(vec3(1.0, 0.86, 0.3), vec3(1.0, 0.36, 0.67), step(0.5, hash(wi + c)));
      if (v > 3.5) col = wall + pane * on * lamp * 0.9 + vec3(1.0, 0.45, 0.15) * beam * 0.35;
    }
    // Algunos edificios llevan una franja de neón con el color del proyecto
    col += accent * step(0.68, hash(c + 1.3)) * smoothstep(0.05, 0.0, abs(q.y - b.w * (0.3 + 0.5 * hash(c + 4.4)))) * 1.3;
    if (q.y > b.w - 0.01) col = vec3(0.08, 0.07, 0.12) + accent * 0.35 * step(0.8, hash(c + 9.0));
  }
  return mix(mix(col, haze, 1.0 - exp(-t * 0.05)) + vec3(1.0, 0.45, 0.15) * beam * 0.25, ufoCol, ufoA);
}
vec3 ciudad(vec2 p) {
  if (variant.z <= 0.0) return cityLook(p, variant.x);
  if (variant.z >= 1.0) return cityLook(p, variant.y);
  // El cambio barre la pantalla de izquierda a derecha, con un borde que se enciende
  float edge = variant.z * 1.6 - 0.3 - (p.x / aspect + 0.5) + noise(gl_FragCoord.xy * 0.05) * 0.1;
  if (edge > 0.12) return cityLook(p, variant.y);
  if (edge < -0.02) return cityLook(p, variant.x);
  return mix(cityLook(p, variant.x), cityLook(p, variant.y), smoothstep(-0.02, 0.12, edge)) + accent * 0.5;
}

// ── Lava: gotas que se funden y se separan alrededor de la forma ────────────
// Dónde va cada gota según el experimento elegido en Labs (xy) y su tamaño (z):
// 0 sueltas, 1 una carita, 2 el plato del microondas, 3 una formación que vuela, 4 una molécula
vec3 drop(float k, float v) {
  float wob = 0.012 * sin(time * 1.3 + k * 2.0);
  // Las figuras crecen con la pantalla, sin pasarse en las angostas
  float S = clamp(aspect * 0.75, 0.55, 1.25);
  if (v > 0.5 && v < 1.5) {
    if (k < 2.0) return vec3((k - 0.5) * 0.3 * S, (0.14 + wob) * S, 0.0045 * S * S);
    float a = 3.75 + (k - 2.0) * 0.48;
    return vec3(cos(a) * 0.25 * S, (0.04 + sin(a) * 0.22 + wob) * S, 0.0026 * S * S);
  }
  if (v > 1.5 && v < 2.5) {
    float a = time * 0.9 + k * 0.8976;
    return vec3(cos(a) * 0.3 * S, (sin(a) * 0.1 - 0.04) * S, 0.0028 * S * S);
  }
  if (v > 2.5 && v < 3.5) {
    float row = abs(k - 3.0);
    return vec3((0.2 - row * 0.12 + sin(time * 2.0 + k) * 0.01) * S, ((k - 3.0) * 0.09 + sin(time * 0.8) * 0.04) * S, (0.004 - row * 0.0007) * S * S);
  }
  if (v > 3.5) {
    if (k > 5.5) return vec3(0.0, 0.0, 0.0022 * S * S);
    float a = time * 0.25 + k * 1.0472;
    return vec3(cos(a) * 0.27 * S, sin(a) * 0.27 * S, 0.003 * S * S);
  }
  return vec3(sin(time * 0.21 + k * 2.1) * 0.62, cos(time * 0.27 + k * 1.3) * 0.36, 0.02 + 0.008 * sin(k * 5.0));
}
float lavaField(vec2 p) {
  float field = 0.0;
  // Al cambiar de experimento las gotas viajan de una figura a la otra
  float m = smoothstep(0.0, 1.0, variant.z);
  for (int i = 0; i < 7; i++) {
    float k = float(i);
    vec3 at = mix(drop(k, variant.x), drop(k, variant.y), m);
    vec2 d = p - center - at.xy;
    field += at.z / dot(d, d);
  }
  // Acotado entre 0 y 1: así la pendiente no se dispara en el centro de cada gota
  return field / (1.0 + field);
}
vec3 lava(vec2 p) {
  float f = lavaField(p);
  vec2 e = vec2(0.004, 0.0);
  vec2 slope = vec2(lavaField(p + e) - lavaField(p - e), lavaField(p + e.yx) - lavaField(p - e.yx)) / 0.008;
  vec3 warm = mix(vec3(1.0, 0.42, 0.12), vec3(0.95, 0.18, 0.5), smoothstep(-0.4, 0.4, p.y - center.y));
  warm = mix(warm, accent, 0.35);
  vec3 back = vec3(0.04, 0.02, 0.05) + warm * smoothstep(0.2, 0.5, f) * 0.28;
  vec3 n = normalize(vec3(-slope * 0.12, 1.0));
  vec3 light = normalize(vec3(-0.4, 0.5, 0.8));
  float diffuse = max(dot(n, light), 0.0);
  float shine = pow(max(reflect(-light, n).z, 0.0), 24.0);
  return mix(back, warm * (0.3 + 0.8 * diffuse) + shine * 0.8, smoothstep(0.5, 0.56, f));
}

// ── Viñedos: hileras de Mendoza al atardecer, con los Andes al fondo ────────
vec3 vinedos(vec2 p) {
  float horizon = 0.02;
  vec2 sun = vec2(center.x + 0.1, horizon + 0.075);
  vec3 sky = mix(vec3(1.0, 0.56, 0.3) * 0.75, vec3(0.25, 0.16, 0.4) * 0.5, smoothstep(horizon, 0.5, p.y));
  sky += vec3(1.0, 0.6, 0.3) * exp(-length((p - sun) * vec2(1.0, 2.2)) * 3.0) * 0.55;
  sky += vec3(1.0, 0.78, 0.5) * smoothstep(0.045, 0.04, length(p - sun));
  // La cordillera, a contraluz: el sol se esconde detrás
  float ridge = horizon + 0.03 + ridges(vec2(p.x * 2.6 + 5.0, 2.0), 5) * 0.13 + 0.08 * exp(-abs(p.x - sun.x - 0.3) * 4.0);
  if (p.y < ridge) {
    // Las cumbres nevadas toman el rosa del último sol
    float snow = smoothstep(0.035, 0.0, ridge - p.y) * smoothstep(horizon + 0.1, horizon + 0.16, ridge);
    sky = mix(vec3(0.36, 0.26, 0.5) * 0.55, vec3(1.0, 0.6, 0.62) * 0.8, snow);
  }
  // Álamos: una cortina de siluetas finas sobre el horizonte
  float row = floor(p.x * 38.0);
  float tall = 0.04 + 0.06 * hash(vec2(row, 4.0));
  float up = (p.y - horizon) / tall;
  float poplar = step(abs(fract(p.x * 38.0) - 0.5), 0.28 * (1.0 - up)) * step(0.0, up) * step(up, 1.0) * step(0.35, hash(vec2(row, 9.0)));
  sky = mix(sky, vec3(0.05, 0.04, 0.07), poplar);
  if (p.y >= horizon) return sky;

  // El suelo en perspectiva: las hileras van hacia el punto de fuga
  float z = 0.35 / (horizon - p.y);
  float lane = (p.x - center.x) * z * 1.6 + 0.5;
  float travel = z + time * 0.35;
  float vine = smoothstep(0.2, 0.12, abs(fract(lane) - 0.5));
  float leaf = fbm(vec2(lane * 3.0, travel * 2.2));
  vec3 leaves = mix(vec3(0.16, 0.32, 0.1), vec3(0.48, 0.64, 0.22), leaf);
  vec2 bunch = vec2(lane * 6.0, travel * 5.0);
  float grape = step(0.86, hash(floor(bunch))) * smoothstep(0.35, 0.1, length(fract(bunch) - 0.5));
  leaves = mix(leaves, vec3(0.45, 0.16, 0.5), grape);
  vec3 soil = vec3(0.24, 0.14, 0.09) * 0.5;
  vec3 field = mix(soil, leaves * (0.7 + 0.6 * leaf), vine) * vec3(1.15, 0.95, 0.8);
  // Lejos las hileras se confunden: se funden en un color parejo
  field = mix(field, mix(soil, leaves, 0.45) * 0.8, smoothstep(3.0, 10.0, z));
  return mix(vec3(0.75, 0.45, 0.3) * 0.5, field, exp(-z * 0.12));
}

// ── Átomo: el logo de React girando sobre una lluvia de código ──────────────
vec3 atomo(vec2 p) {
  float column = floor(gl_FragCoord.x / sub);
  float seed = hash(vec2(column, 3.0));
  float fall = fract(gl_FragCoord.y / grid.y * (0.7 + seed) + time * (0.08 + seed * 0.18) + seed * 9.0);
  vec3 col = vec3(0.19, 0.47, 0.85) * step(0.55, hash(vec2(column, 11.0))) * pow(1.0 - fall, 3.0) * 0.45 + 0.015;

  vec2 c = p - center;
  vec2 ab = vec2(0.42, 0.15);
  vec3 cyan = vec3(0.38, 0.86, 1.0);
  for (int i = 0; i < 3; i++) {
    float k = float(i);
    vec2 q = turn(k * 1.0472 + time * 0.12) * c;
    // Distancia aproximada a la elipse
    float k0 = length(q / ab), k1 = length(q / (ab * ab));
    float line = exp(-pow(k0 * (k0 - 1.0) / k1 / 0.006, 2.0));
    // El electrón deja una estela detrás
    float spin = time * (1.1 + k * 0.27) + k * 2.1;
    float behind = mod(spin - atan(q.y / ab.y, q.x / ab.x), 6.2831853);
    col += cyan * line * (0.28 + 0.9 * exp(-behind * 1.4));
    vec2 electron = vec2(cos(spin), sin(spin)) * ab;
    col += vec3(0.85, 0.97, 1.0) * exp(-dot(q - electron, q - electron) * 2500.0) * 1.2;
  }
  float r = length(c);
  return col + cyan * (smoothstep(0.05, 0.042, r) * 0.9 + exp(-r * 14.0) * 0.4);
}

// ── Planeta: la Tierra real, con Mendoza en su lugar ────────────────────────
// Mendoza: 32,89° S, 68,83° O
const vec2 MENDOZA = vec2(-0.5741, -1.2013);
vec3 onGlobe(vec2 latlon) {
  return vec3(cos(latlon.x) * sin(latlon.y), sin(latlon.x), cos(latlon.x) * cos(latlon.y));
}
vec3 planeta(vec2 p) {
  vec2 c = p - center;
  float R = 0.33;
  float r = length(c);
  vec3 col = vec3(stars(0.02) * 0.8 + 0.015);
  if (r >= R) return col + vec3(0.35, 0.62, 1.0) * exp(-(r - R) * 28.0) * 0.45;

  vec3 n = vec3(c, sqrt(R * R - r * r)) / R;
  // Mira a Sudamérica desde arriba del Pacífico sur y se balancea despacio
  float lat0 = -0.47;
  float lon0 = -1.34 + sin(time * 0.06) * 0.22;
  float lat = asin(clamp(n.y * cos(lat0) + n.z * sin(lat0), -1.0, 1.0));
  float lon = lon0 + atan(n.x, n.z * cos(lat0) - n.y * sin(lat0));
  vec4 map = texture(earth, vec2(fract((lon + 3.14159265) / 6.2831853), (1.5707963 - lat) / 3.14159265));
  // El sol queda atrás a la izquierda: Mendoza ya está de noche, con sus luces
  // El día cubre casi todo; la noche empieza justo pasando Mendoza
  float day = smoothstep(-0.04, 0.16, dot(n, normalize(vec3(-0.95, 0.12, 0.22))));
  col = pow(map.rgb, vec3(0.8)) * day * 1.45;
  col += vec3(1.0, 0.72, 0.38) * pow(map.a, 1.1) * (1.0 - day) * 2.6;
  col += vec3(0.02, 0.04, 0.1) * (1.0 - day);
  col += vec3(0.35, 0.62, 1.0) * pow(1.0 - n.z, 3.0) * 0.55;
  // Mendoza: un punto que late y anillos que se abren sobre el planeta
  float angle = acos(clamp(dot(onGlobe(vec2(lat, lon)), onGlobe(MENDOZA)), -1.0, 1.0));
  float phase = fract(time * 0.3);
  col += accent * (exp(-pow(angle / 0.018, 2.0)) * 1.6 + exp(-pow((angle - phase * 0.5) / 0.008, 2.0)) * (1.0 - phase) * 1.1);
  return col;
}

// ── Foto: una imagen con cámara y un halo que va señalando ───────────────────
vec3 photoAt(vec2 p) {
  // A zoom 1 la foto entra entera; la cámara la recorre
  float fit = min(1.0, aspect / photoAspect);
  vec2 uv = camera.xy + vec2(p.x / photoAspect, -p.y) / (fit * camera.z);
  // Respira apenas: las letras nunca quedan del todo quietas
  uv += vec2(sin(uv.y * 40.0 + time * 1.3), cos(uv.x * 36.0 + time)) * 0.0009;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) {
    // Afuera de la foto: el color de su borde, muy desenfocado, con ondas lentas
    // que se apagan al alejarse. Tranquilo, para que los costados no queden negros
    vec2 outside = max(abs(uv - 0.5) - 0.5, 0.0) * vec2(photoAspect, 1.0);
    float away = length(outside);
    vec3 edge = textureLod(photo, clamp(uv, 0.0, 1.0), 6.5).rgb;
    float drift = fbm(vec2(uv.x * 1.6 + time * 0.025, uv.y * 2.2 - time * 0.018));
    float waves = 0.5 + 0.5 * sin(uv.y * 9.0 + drift * 7.0 + time * 0.35);
    float fade = exp(-away * 1.4);
    return pow(edge, vec3(0.7)) * (0.3 + 0.32 * waves) * fade + CELESTE * (0.05 + 0.1 * drift * waves);
  }
  // La foto es de noche y adentro: se aclara un poco para que las letras la lean
  // De cerca se aclara más: cada cara tiene que leerse sola
  vec3 col = pow(texture(photo, uv).rgb, vec3(0.74)) * (1.22 + (camera.z - 1.0) * 0.1);
  // El halo: lo de afuera se apaga y un anillo celeste rodea a la persona
  vec2 d = (uv - halo.xy) * vec2(photoAspect, 1.0);
  float r = length(d);
  col *= mix(1.0, 0.5, halo.w * smoothstep(halo.z * 1.3, halo.z * 2.0, r));
  col += CELESTE * exp(-pow((r - halo.z * 1.4) / (0.004 / camera.z + 0.0012), 2.0)) * halo.w * 0.75;
  return col;
}

// ── El espacio del final: una luna gigante y un cohete con su estela ─────────
float moonRadius() { return 0.3 + 0.22 * clamp((aspect - 0.5) / 1.2, 0.0, 1.0); }
vec2 moonCenter() {
  float R = moonRadius();
  return vec2(aspect * 0.5 - R * 0.42, 0.5 - R * 0.5 - (1.0 - cosmic.y) * 1.3);
}
// La cara de Gabriel en el espacio de la escena, y el radio de su círculo
vec3 faceSpot() {
  float fit = min(1.0, aspect / photoAspect);
  vec2 at = (halo.xy - camera.xy) * fit * camera.z * vec2(photoAspect, -1.0);
  return vec3(at, halo.z * fit * camera.z * 1.55);
}
// El recorrido del cohete: sale de arriba de la cara y llega a la luna en arco
void route(out vec2 a, out vec2 c, out vec2 b) {
  vec3 face = faceSpot();
  vec2 mc = moonCenter();
  a = face.xy + vec2(0.0, face.z);
  b = mc + normalize(a - mc) * moonRadius() * 0.97;
  c = vec2(mix(a.x, b.x, 0.25), max(a.y, b.y) + 0.32);
}
vec2 bez(vec2 a, vec2 c, vec2 b, float t) { return mix(mix(a, c, t), mix(c, b, t), t); }

vec3 cosmos(vec2 p) {
  vec3 col = vec3(0.012, 0.016, 0.03) + vec3(stars(0.03)) * 0.9;
  // Una banda de nebulosa celeste, muy tenue
  col += CELESTE * 0.07 * fbm(p * 2.2 + vec2(time * 0.01, 0.0)) * smoothstep(0.6, 0.0, abs(p.y + p.x * 0.35 - 0.05));
  float R = moonRadius();
  vec2 q = (p - moonCenter()) / R;
  float d = length(q);
  // Halo de la luna
  col += vec3(0.75, 0.8, 0.9) * exp(-max(d - 1.0, 0.0) * 9.0) * 0.18 * step(1.0, d);
  if (d < 1.0) {
    vec3 n = vec3(q, sqrt(1.0 - d * d));
    vec3 light = normalize(vec3(-0.55, 0.35, 0.75));
    float lit = max(dot(n, light), 0.0);
    vec2 surf = n.xy / (n.z + 0.6) * 2.2;
    // Mares oscuros y cráteres con borde claro
    float maria = smoothstep(0.45, 0.62, fbm(surf * 1.3 + 4.0));
    float craters = 0.0;
    for (int i = 0; i < 3; i++) {
      float k = float(i);
      vec2 g = surf * (3.0 + k * 3.0) + k * 7.0;
      vec2 cell = floor(g), f = fract(g) - 0.5;
      vec2 off = vec2(hash(cell), hash(cell + 3.1)) - 0.5;
      float rr = 0.15 + 0.25 * hash(cell + 9.0);
      float e = length(f - off * 0.5) / rr;
      craters += (smoothstep(1.0, 0.75, e) * -0.35 + exp(-pow((e - 1.0) * 6.0, 2.0)) * 0.3) * step(0.45, hash(cell + 1.7)) / (1.0 + k);
    }
    float albedo = 0.85 - maria * 0.32 + craters + 0.08 * fbm(surf * 8.0);
    vec3 moon = vec3(0.93, 0.92, 0.88) * albedo * (0.05 + 1.05 * pow(lit, 0.8));
    moon += CELESTE * pow(1.0 - n.z, 3.0) * 0.35;
    col = mix(col, moon, smoothstep(1.0, 0.985, d));
  }
  // El destello del alunizaje: un anillo que se abre desde donde llega el cohete
  if (cosmic.w > 0.0) {
    vec2 a, c, b;
    route(a, c, b);
    float ring = length(p - b) - cosmic.w * 0.7;
    col += vec3(1.0, 0.9, 0.7) * exp(-ring * ring * 300.0) * (1.0 - cosmic.w) * 1.4;
    col += vec3(1.0, 0.85, 0.6) * exp(-length(p - b) * 9.0) * (1.0 - cosmic.w) * 1.2;
  }
  return col;
}

// El cohete y su estela: color y opacidad
vec4 rocketLayer(vec2 p) {
  float t = cosmic.z;
  if (t <= 0.0 || t >= 1.0) return vec4(0.0);
  vec2 a, c, b;
  route(a, c, b);
  vec3 glow = vec3(0.0);
  // Estela: puntos del recorrido ya hecho, cada vez más anchos y apagados
  for (int i = 0; i < 28; i++) {
    float k = float(i);
    float tt = t - k * 0.013 - 0.05;
    if (tt < 0.0) break;
    vec2 at = bez(a, c, b, tt) + vec2(fbm(vec2(k * 0.7, time * 2.0)) - 0.5, fbm(vec2(time * 2.0, k)) - 0.5) * 0.02 * k / 10.0;
    float w = 0.02 + k * 0.0038;
    float fade = exp(-k * 0.11);
    vec3 hot = mix(vec3(1.0, 0.95, 0.75), vec3(1.0, 0.45, 0.15), clamp(k / 8.0, 0.0, 1.0));
    hot = mix(hot, vec3(0.45), clamp((k - 10.0) / 14.0, 0.0, 1.0));
    glow += hot * exp(-dot(p - at, p - at) / (w * w)) * fade;
  }
  // El cohete, en su propio marco: y apunta hacia donde va (y = largo, x = ancho)
  vec2 pos = bez(a, c, b, t);
  vec2 dir = normalize(mix(c - a, b - c, t));
  vec2 side = vec2(dir.y, -dir.x);
  float S = 0.095 * (1.0 - 0.4 * t);
  vec2 l = vec2(dot(p - pos, side), dot(p - pos, dir)) / S;
  // Fuselaje: ancho máximo en el medio, ojiva en punta y base recta
  float halfw = 0.42 * sqrt(clamp(1.0 - pow(max(l.y - 0.1, 0.0) / 1.25, 2.0), 0.0, 1.0)) * (l.y < -0.9 ? 1.0 - (-0.9 - l.y) * 0.8 : 1.0);
  float body = abs(l.x) - halfw;
  body = max(body, max(-l.y - 1.1, l.y - 1.35));
  float nose = step(0.75, l.y);
  float stripe = step(abs(l.y + 0.35), 0.07);
  float rivets = step(0.8, fract(l.y * 6.0)) * step(abs(abs(l.x) - 0.3), 0.025);
  // Alerones: tres, el del medio de canto
  float fins = max(abs(l.x) - 0.85 + (l.y + 1.1) * 0.75, max(-l.y - 1.3, l.y + 0.3));
  float middleFin = max(abs(l.x) - 0.06, max(-l.y - 1.35, l.y + 0.55));
  // Dos ventanitas con marco
  float win1 = length(l - vec2(0.0, 0.42)) - 0.17;
  float win2 = length(l - vec2(0.0, 0.0)) - 0.11;
  // Tobera y llama en capas
  float nozzle = max(abs(l.x) - (0.2 + (-l.y - 1.1) * 0.35), max(-l.y - 1.3, l.y + 1.1));
  float flick = 0.85 + 0.2 * sin(time * 47.0) + 0.1 * sin(time * 31.0);
  float flameOut = length(vec2(l.x * 2.0, (l.y + 1.9) / (1.3 * flick))) - 0.6;
  float flameIn = length(vec2(l.x * 3.2, (l.y + 1.65) / (0.9 * flick))) - 0.45;
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  if (flameOut < 0.0) { col = vec3(1.0, 0.42, 0.12); alpha = 1.0; }
  if (flameIn < 0.0) { col = vec3(1.0, 0.92, 0.6); alpha = 1.0; }
  if (nozzle < 0.0) { col = vec3(0.35, 0.36, 0.4); alpha = 1.0; }
  if (fins < 0.0) { col = CELESTE * (0.8 + 0.4 * sign(l.x) * 0.5); alpha = 1.0; }
  if (body < 0.0) {
    // Luz de costado: un lado más claro que el otro
    col = vec3(0.96, 0.95, 0.92) * (0.62 + 0.45 * smoothstep(0.42, -0.42, l.x));
    col = mix(col, CELESTE * 1.1, max(nose, stripe));
    col -= rivets * 0.25;
    alpha = 1.0;
  }
  if (middleFin < 0.0) { col = CELESTE * 0.75; alpha = 1.0; }
  if (win1 < 0.0) { col = win1 > -0.05 ? vec3(0.25) : vec3(0.75, 0.95, 1.0) * (0.8 + 0.4 * step(0.05, l.x - 0.04)); alpha = 1.0; }
  if (win2 < 0.0) { col = win2 > -0.04 ? vec3(0.25) : vec3(0.55, 0.85, 1.0); alpha = 1.0; }
  return vec4(col + glow * (1.0 - alpha), max(alpha, min(1.0, length(glow))));
}

vec3 foto(vec2 p) {
  vec3 col = photoAt(p);
  if (cosmic.x <= 0.0) return col;
  // La cara queda adentro de un círculo; afuera, el espacio
  vec3 face = faceSpot();
  float r = length(p - face.xy);
  float inside = 1.0 - smoothstep(face.z * 0.97, face.z, r);
  vec3 out_ = mix(col, cosmos(p), cosmic.x);
  col = mix(out_, col, inside) + CELESTE * exp(-pow((r - face.z) / 0.005, 2.0)) * cosmic.x * 1.2;
  vec4 rocket = rocketLayer(p);
  return mix(col, rocket.rgb, clamp(rocket.a, 0.0, 1.0));
}

vec3 scene(int which, vec2 p) {
  if (which == 0) return andes(p);
  if (which == 1) return ciudad(p);
  if (which == 2) return lava(p);
  if (which == 3) return vinedos(p);
  if (which == 4) return atomo(p);
  if (which == 5) return planeta(p);
  return foto(p);
}

void main() {
  vec2 uv = gl_FragCoord.xy / grid;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  // Cambio de escena: una se disuelve en la otra siguiendo un ruido.
  // El canal alfa dice qué escena manda, para elegir su texto
  vec3 result;
  float which = 1.0;
  if (blend <= 0.0) { result = scene(from, p); which = 0.0; }
  else if (blend >= 1.0) result = scene(to, p);
  else {
    float ragged = noise(gl_FragCoord.xy * 0.09 / sub);
    float edge = mix(blend * 1.5 - 0.25 - ragged * 0.5 - uv.y * 0.25 + 0.25, blend * 1.35 - length(p) * 1.1 - ragged * 0.12 + 0.05, iris);
    float turned = smoothstep(0.0, 0.12, edge);
    result = mix(scene(from, p), scene(to, p), turned);
    which = step(0.5, turned);
    // El frente del cambio se enciende
    result += (smoothstep(0.0, 0.06, edge) - smoothstep(0.06, 0.2, edge)) * vec3(0.6, 0.75, 0.9);
  }

  // Puntero: un resplandor; clic: un anillo que se abre
  result += exp(-dot(p - pointer, p - pointer) * 46.0) * vec3(0.28, 0.32, 0.38);
  for (int i = 0; i < ${WAVES}; i++) {
    float ring = exp(-pow((length(p - waves[i].xy) - waves[i].z) * 16.0, 2.0)) * waves[i].w;
    result += ring * mix(vec3(0.8), accent, 0.5);
  }

  // Detrás de la forma de letras la escena baja, para que no se mezclen
  // En pantallas angostas la forma es más chica, y el hueco también
  vec2 behind = (p - center) / (vec2(0.5, 0.3) * clamp(aspect / 1.6, 0.42, 1.0));
  result *= 1.0 - hush * exp(-dot(behind, behind));

  // Del lado del texto la escena se apaga para que se pueda leer
  float wide = mix(0.05, 1.0, smoothstep(-0.3, 0.5, (uv.x * 2.0 - 1.0) * side));
  float tall = mix(0.05, 1.0, smoothstep(0.4, 0.66, uv.y));
  result *= mix(mix(1.0, wide, abs(side)), tall, narrow);

  color = vec4(clamp(result, 0.0, 1.0), which);
}`;

const GLYPHS = `#version 300 es
precision highp float;
uniform sampler2D scene;
uniform sampler2D atlas;
uniform sampler2D text;
uniform vec2 cell;
uniform vec2 cells;
uniform float count;
uniform float gain;
uniform int from;
uniform int to;
uniform int lengths[${SCENES.length}];
uniform float raw;
out vec4 color;

// Brillo de un color: el canal más fuerte manda, para que un celeste puro no quede apagado
float level(vec3 c) {
  return max(max(c.r, c.g), c.b) * 0.7 + dot(c, vec3(0.3, 0.55, 0.15)) * 0.3;
}

void main() {
  vec2 at = gl_FragCoord.xy / cell;
  vec2 id = floor(at);
  vec2 inside = fract(at);
  // La celda entera decide la letra y el peso; el punto exacto, el color y la tinta
  vec4 whole = texture(scene, (id + 0.5) / cells);
  vec4 here = texture(scene, at / cells);
  if (raw > 0.5) { color = vec4(texture(scene, gl_FragCoord.xy / cell / cells).rgb, 1.0); return; }
  float lightCell = level(whole.rgb);
  float light = mix(lightCell, level(here.rgb), 0.75);
  if (light < 0.03) discard;

  // Las celdas se leen como un párrafo: de izquierda a derecha y de arriba abajo
  int which = whole.a > 0.5 ? to : from;
  int index = (int(cells.y) - 1 - int(id.y)) * int(cells.x) + int(id.x);
  float glyph = floor(texelFetch(text, ivec2(index % lengths[which], which), 0).r * 255.0 + 0.5);

  // Un margen dentro de la celda: sin él, el filtrado trae tinta del carácter vecino
  vec2 within = (inside - 0.5) * 0.92 + 0.5;
  float bold = step(0.5, lightCell);
  float ink = glyph < 0.5 ? 0.0 : texture(atlas, vec2((glyph + within.x) / count, (bold + 1.0 - within.y) * 0.5)).a;
  ink = min(1.0, ink * 1.35);
  // Lo oscuro casi no se ve, pero el texto sigue ahí
  float alpha = ink * (0.1 * smoothstep(0.03, 0.09, light) + 0.9 * pow(smoothstep(0.05, 0.75, light), 1.3)) * gain;
  vec3 tint = here.rgb / max(max(here.r, here.g), max(here.b, 0.05));
  tint = mix(tint, vec3(1.0), smoothstep(0.8, 1.0, light) * 0.4);
  // Un resplandor debajo de las letras le da cuerpo a las luces de la escena
  float glow = light * light * 0.38 * gain;
  color = vec4(tint * alpha + here.rgb * glow * (1.0 - alpha), alpha + glow * (1.0 - alpha));
}`;

/** Dibuja cada carácter de los textos en dos filas: normal y negrita. */
function atlas(texts: string[]) {
  const chars = [' ', ...[...new Set(texts.join(''))].filter((char) => char !== ' ').sort()];
  const canvas = document.createElement('canvas');
  canvas.width = GLYPH_W * chars.length;
  canvas.height = GLYPH_H * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ['500', '800'].forEach((weight, row) => {
    ctx.font = `${weight} ${GLYPH_H * 0.7}px ${FONT}`;
    chars.forEach((char, i) => ctx.fillText(char, i * GLYPH_W + GLYPH_W / 2, row * GLYPH_H + GLYPH_H / 2));
  });
  return { canvas, chars };
}

export function createAsciiField(canvas: HTMLCanvasElement, options: { photoText?: string; cell?: number } = {}) {
  // La escena de la foto se escribe con su propio texto
  const texts = [...TEXTS, options.photoText ?? 'esto no es una foto. '];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: true, alpha: true });
  // Sin WebGL2 la portada queda con las letras sueltas, sin fondo
  if (!gl) return null;

  function program(fragment: string) {
    const made = gl!.createProgram()!;
    for (const [type, source] of [[gl!.VERTEX_SHADER, QUAD], [gl!.FRAGMENT_SHADER, fragment]] as const) {
      const shader = gl!.createShader(type)!;
      gl!.shaderSource(shader, source);
      gl!.compileShader(shader);
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) console.error(gl!.getShaderInfoLog(shader));
      gl!.attachShader(made, shader);
    }
    gl!.bindAttribLocation(made, 0, 'corner');
    gl!.linkProgram(made);
    if (!gl!.getProgramParameter(made, gl!.LINK_STATUS)) return null;
    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    const total = gl!.getProgramParameter(made, gl!.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < total; i++) {
      const name = gl!.getActiveUniform(made, i)!.name.replace('[0]', '');
      uniforms[name] = gl!.getUniformLocation(made, name);
    }
    return { made, uniforms };
  }

  const scenePass = program(SCENE);
  const glyphPass = program(GLYPHS);
  if (!scenePass || !glyphPass) return null;

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const { canvas: image, chars } = atlas(texts);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // Los textos, una fila por escena, como índices del atlas
  const lengths = new Int32Array(texts.map((line) => [...line].length));
  const longest = Math.max(...lengths);
  const indices = new Uint8Array(longest * texts.length);
  texts.forEach((line, row) => [...line].forEach((char, i) => (indices[row * longest + i] = chars.indexOf(char))));
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, longest, texts.length, 0, gl.RED, gl.UNSIGNED_BYTE, indices);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  const target = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, target);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const buffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  let w = 0, h = 0, dpr = 1, cols = 0, rows = 0, cellW = 0, cellH = 0;
  let visible = true;
  let dirty = true;
  let getCenter: (() => { x: number; y: number }) | null = null;
  // Estado animado por Anime.js
  const view = { vFrom: 0, vTo: 0, vMix: 0, from: 0, to: 0, blend: 1, iris: 0, side: 0, gain: 0, hush: HUSH[0], r: 116, g: 172, b: 223 };
  const pointer = { x: -9, y: -9, sx: -9, sy: -9 };
  const waves = new Float32Array(WAVES * 4);
  const rings: { x: number; y: number; r: number; power: number }[] = [];
  let mixing: ReturnType<typeof animate> | null = null;
  let bare = false;
  // /?escena=andes&crudo muestra la escena sin letras, para ajustarla
  const raw = new URLSearchParams(location.search).has('crudo') ? 1 : 0;

  /** De píxeles de pantalla al espacio de la escena: alto 1, origen en el centro. */
  const toScene = (x: number, y: number): [number, number] => [(x / w - 0.5) * (w / h), 0.5 - y / h];

  // Calidad adaptativa: en celulares arranca liviana; en cualquier equipo, si los cuadros
  // tardan de más baja la resolución de la escena y, si aún no alcanza, dibuja a 30 fps
  let sub = window.innerWidth < 820 ? 1 : SUB;
  let halfRate = false;
  let slow = 0;
  let lastFrame = 0;
  let skip = false;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 820 ? 1.5 : 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    cellW = options.cell ?? (w < 820 ? 6 : 7);
    cellH = cellW * (GLYPH_H / GLYPH_W);
    cols = Math.ceil(w / cellW);
    rows = Math.ceil(h / cellH);
    gl!.activeTexture(gl!.TEXTURE0);
    gl!.bindTexture(gl!.TEXTURE_2D, target);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA8, cols * sub, rows * sub, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, null);
    dirty = true;
  }

  // Rodaje: con ?rodaje en la dirección, el tiempo lo fija quien graba, cuadro por cuadro
  let clock: number | null = null;

  function frame(now: number) {
    requestAnimationFrame(frame);
    // Quieto: solo se vuelve a dibujar cuando algo cambia
    if (!visible || (still && !dirty && !mixing && clock === null)) return;
    // Medir: un promedio del tiempo entre cuadros decide si hay que bajar la calidad
    if (clock === null && lastFrame) {
      const dt = now - lastFrame;
      if (dt < 250) slow = slow * 0.95 + (dt > (halfRate ? 40 : 24) ? 1 : 0) * 0.05;
      if (slow > 0.6) {
        slow = 0;
        if (sub > 1) {
          sub = 1;
          resize();
        } else halfRate = true;
      }
    }
    lastFrame = now;
    if (halfRate && clock === null && (skip = !skip)) return;
    dirty = false;
    const time = clock ?? (still ? 40 : now / 1000);

    pointer.sx += (pointer.x - pointer.sx) * 0.12;
    pointer.sy += (pointer.y - pointer.sy) * 0.12;
    const spot = getCenter?.();
    const [cx, cy] = spot ? toScene(spot.x, spot.y) : [0, 0];
    waves.fill(0);
    rings.slice(-WAVES).forEach((ring, i) => waves.set([ring.x, ring.y, ring.r, ring.power], i * 4));

    if (photoSource instanceof HTMLVideoElement && !photoSource.paused) upload();

    // 1. La escena, dos por dos píxeles por celda
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, buffer);
    gl!.viewport(0, 0, cols * sub, rows * sub);
    gl!.disable(gl!.BLEND);
    gl!.useProgram(scenePass!.made);
    const s = scenePass!.uniforms;
    gl!.uniform2f(s.grid, cols * sub, rows * sub);
    gl!.uniform1f(s.sub, sub);
    gl!.uniform1f(s.aspect, w / h);
    gl!.uniform1f(s.time, time);
    gl!.uniform1i(s.from, view.from);
    gl!.uniform1i(s.to, view.to);
    gl!.uniform1f(s.blend, view.blend);
    gl!.uniform1f(s.iris, view.iris);
    gl!.uniform1f(s.side, view.side);
    // En el celular la mitad de abajo se apaga para leer, salvo en el espacio del final
    gl!.uniform1f(s.narrow, w < 820 && !bare ? 1 - lens.space : 0);
    gl!.uniform2f(s.center, cx, cy);
    gl!.uniform2f(s.pointer, pointer.sx, pointer.sy);
    gl!.uniform1f(s.hush, view.hush);
    gl!.uniform1f(s.scroll, Math.min(1, window.scrollY / h));
    gl!.uniform3f(s.accent, view.r / 255, view.g / 255, view.b / 255);
    gl!.uniform4fv(s.waves, waves);
    gl!.uniform1i(s.photo, 3);
    gl!.uniform1f(s.photoAspect, photoAspect);
    gl!.uniform3f(s.camera, lens.x, lens.y, lens.zoom);
    gl!.uniform4f(s.halo, lens.hx, lens.hy, lens.hr, lens.glow);
    gl!.uniform4f(s.cosmic, lens.space, lens.moon, lens.rocket, lens.flash);
    gl!.uniform3f(s.variant, view.vFrom, view.vTo, view.vMix);
    gl!.uniform1i(s.earth, 4);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);

    // 2. Las letras, a resolución de pantalla
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
    gl!.viewport(0, 0, canvas.width, canvas.height);
    gl!.enable(gl!.BLEND);
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.useProgram(glyphPass!.made);
    const g = glyphPass!.uniforms;
    gl!.uniform1i(g.scene, 0);
    gl!.uniform1i(g.atlas, 1);
    gl!.uniform1i(g.text, 2);
    gl!.uniform2f(g.cell, cellW * dpr, cellH * dpr);
    gl!.uniform2f(g.cells, cols, rows);
    gl!.uniform1f(g.count, chars.length);
    gl!.uniform1f(g.gain, view.gain);
    gl!.uniform1i(g.from, view.from);
    gl!.uniform1i(g.to, view.to);
    gl!.uniform1iv(g.lengths, lengths);
    gl!.uniform1f(g.raw, raw);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (event) => {
    [pointer.x, pointer.y] = toScene(event.clientX, event.clientY);
  });
  document.documentElement.addEventListener('mouseleave', () => (pointer.x = pointer.y = -9));
  document.addEventListener('visibilitychange', () => (visible = !document.hidden));

  resize();
  requestAnimationFrame(frame);
  // Entra de a poco, detrás del título
  animate(view, { gain: 1, duration: still ? 0 : 2400, delay: still ? 0 : 500, ease: 'outQuad' });

  // La foto va en su propia unidad de textura; hasta que llega, un píxel negro
  let photoAspect = 1;
  // La Tierra: se baja recién la primera vez que se muestra el planeta
  let earthLoaded = false;
  gl.activeTexture(gl.TEXTURE4);
  const earthTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, earthTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([8, 20, 50, 0]));
  function loadEarth() {
    if (earthLoaded) return;
    earthLoaded = true;
    const image = new Image();
    image.src = '/scenes/earth.webp';
    image.decode().then(() => {
      gl!.activeTexture(gl!.TEXTURE4);
      gl!.bindTexture(gl!.TEXTURE_2D, earthTexture);
      gl!.pixelStorei(gl!.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, image);
      gl!.generateMipmap(gl!.TEXTURE_2D);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR_MIPMAP_LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.REPEAT);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
      gl!.activeTexture(gl!.TEXTURE0);
      dirty = true;
    });
  }
  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  let photoSource: HTMLImageElement | HTMLVideoElement | null = null;
  function upload() {
    const source = photoSource;
    if (!source) return;
    const video = source instanceof HTMLVideoElement;
    if (video && source.readyState < 2) return;
    gl!.activeTexture(gl!.TEXTURE3);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, source);
    gl!.generateMipmap(gl!.TEXTURE_2D);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR_MIPMAP_LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    gl!.activeTexture(gl!.TEXTURE0);
    photoAspect = video ? source.videoWidth / source.videoHeight : source.naturalWidth / source.naturalHeight;
    dirty = true;
  }
  /** Cámara y halo de la foto: se animan desde afuera. */
  const lens = { x: 0.5, y: 0.5, zoom: 1, hx: 0.5, hy: 0.5, hr: 0.05, glow: 0, space: 0, moon: 0, rocket: 0, flash: 0 };

  // Para grabar el sitio cuadro por cuadro (el teaser): fija escena, variante, cámara y tiempo
  if (new URLSearchParams(location.search).has('rodaje')) {
    Object.assign(window, {
      __rodaje: {
        scene(name: Scene, variant = 0, accent: [number, number, number] = [116, 172, 223]) {
          const index = SCENES.indexOf(name);
          Object.assign(view, { from: index, to: index, blend: 1, iris: 0, vFrom: variant, vTo: variant, vMix: 0, side: 0, hush: 0, gain: 1, r: accent[0], g: accent[1], b: accent[2] });
          if (name === 'planeta') loadEarth();
          dirty = true;
        },
        lens,
        time(t: number) {
          clock = t;
          dirty = true;
        },
        photo(url: string) {
          const image = new Image();
          image.src = url;
          return image.decode().then(() => {
            photoSource = image;
            upload();
          });
        },
      },
    });
  }

  return {
    /** Carga la imagen de la escena `foto`. Un video se vuelve a subir en cada cuadro. */
    setPhoto(source: HTMLImageElement | HTMLVideoElement) {
      photoSource = source;
      upload();
    },
    lens,
    /** Zoom con el que un largo de la foto (en altos de foto) ocupa `px` píxeles de pantalla. */
    zoomFor(size: number, px: number) {
      const fit = Math.min(1, w / h / photoAspect);
      return Math.max(1, px / (size * fit * h));
    },
    /** Dónde poner la cámara para que el punto (u, v) de la foto quede en (sx, sy) de pantalla con ese zoom. */
    lensFor(u: number, v: number, sx: number, sy: number, zoom: number) {
      const fit = Math.min(1, w / h / photoAspect);
      return { x: u - (sx - w / 2) / (photoAspect * fit * zoom * h), y: v - (sy - h / 2) / (fit * zoom * h) };
    },
    /** De un punto de la foto (0 a 1) a píxeles de pantalla, con la cámara de ahora. */
    photoToScreen(u: number, v: number) {
      const fit = Math.min(1, w / h / photoAspect);
      const px = (u - lens.x) * photoAspect * fit * lens.zoom;
      const py = -(v - lens.y) * fit * lens.zoom;
      // Del espacio de la escena (alto 1, origen al centro) a píxeles
      return { x: w / 2 + px * h, y: h / 2 - py * h };
    },
    /** Cambia de escena y de lado: el texto queda del lado contrario a `side`. */
    show(scene: Scene, side: Side = 'center', accent?: [number, number, number], options: { iris?: boolean; duration?: number } = {}) {
      const next = SCENES.indexOf(scene);
      if (next < 0) return;
      if (scene === 'planeta') loadEarth();
      view.iris = options.iris ? 1 : 0;
      const lean = side === 'left' ? -1 : side === 'right' ? 1 : 0;
      dirty = true;
      animate(view, {
        side: bare ? 0 : lean,
        hush: bare ? 0 : HUSH[next],
        ...(accent && { r: accent[0], g: accent[1], b: accent[2] }),
        duration: still ? 0 : 1400,
        ease: 'inOutCubic',
      });
      if (next === view.to) return;
      // Si venía a mitad de un cambio, arranca desde la que ya se veía más
      view.from = view.blend < 0.5 ? view.from : view.to;
      view.to = next;
      view.blend = 0;
      mixing?.cancel();
      mixing = animate(view, {
        blend: 1,
        duration: still ? 0 : options.duration ?? 1700,
        ease: 'inOutSine',
        onComplete: () => (mixing = null),
      });
    },
    /** Anillo que se abre desde un punto de la pantalla. */
    pulse(x: number, y: number) {
      if (still) return;
      const [px, py] = toScene(x, y);
      const ring = { x: px, y: py, r: 0, power: 1 };
      rings.push(ring);
      animate(ring, {
        r: 1.5,
        power: 0,
        duration: 1500,
        ease: 'outCubic',
        onComplete: () => rings.splice(rings.indexOf(ring), 1),
      });
    },
    /** Cambia la ciudad: 0 noche común, 1 Bildenlex, 2 Legali, 3 Mi Casa, 4 Nerdconf. */
    setVariant(next: number) {
      if (next === view.vTo && view.vMix >= 1) return;
      if (next === view.vTo) return;
      // Lo que se ve ahora pasa a ser el punto de partida
      view.vFrom = view.vMix >= 0.5 ? view.vTo : view.vFrom;
      view.vTo = next;
      view.vMix = 0;
      dirty = true;
      animate(view, { vMix: 1, duration: still ? 0 : 1600, ease: 'inOutSine' });
    },
    setAccent([r, g, b]: [number, number, number]) {
      dirty = true;
      animate(view, { r, g, b, duration: still ? 0 : 600, ease: 'outQuad' });
    },
    /** Escena sola y entera, sin apagarla para el texto ni para la forma. */
    /** Mientras corre una historia: la escena entera, sin apagar ningún lado. */
    focus(on: boolean) {
      bare = on;
      dirty = true;
      animate(view, { side: 0, hush: 0, duration: still ? 0 : 700, ease: 'inOutCubic' });
    },
    bare() {
      bare = true;
      view.hush = 0;
    },
    /** Dónde está la forma de letras: varias escenas se arman alrededor de ella. */
    follow(center: () => { x: number; y: number }) {
      getCenter = center;
    },
  };
}

export type AsciiField = NonNullable<ReturnType<typeof createAsciiField>>;
