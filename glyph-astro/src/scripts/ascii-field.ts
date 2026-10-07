import { animate } from 'animejs';

// Fondo ASCII: una escena procedural (cordillera en vuelo, curvas de nivel,
// lava, mar, lluvia de código, planeta) dibujada con caracteres.
//
// Se hace en dos pasadas de WebGL. La primera calcula la escena en una textura
// de una celda por píxel (unas 200×65): ahí vive todo el costo, y por eso una
// escena en 3D con trazado de rayos cuesta lo mismo que un degradado. La
// segunda recorre la pantalla y, para cada celda, elige en el atlas el carácter
// cuya tinta corresponde a esa luz.

export type Scene = 'cordillera' | 'flujo' | 'lava' | 'ondas' | 'lluvia' | 'orbita';
type Side = 'left' | 'right' | 'center';

const SCENES: Scene[] = ['cordillera', 'flujo', 'lava', 'ondas', 'lluvia', 'orbita'];
// Cuánto se apaga cada escena detrás de la forma de letras
const HUSH = [0.85, 0.55, 0.35, 0.45, 0.6, 0.7];
const FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
// Candidatos para la rampa de luz; se ordenan midiendo cuánta tinta tiene cada uno
const RAMP = ' .\'`,:;-~_+=*/\\|<>(){}[]!?ivcxzoaeGABRILPDZ0123456789#%&@$';
const GLYPH_W = 36, GLYPH_H = 64;
const WAVES = 4;

const QUAD = `#version 300 es
in vec2 corner;
void main() { gl_Position = vec4(corner, 0.0, 1.0); }`;

const SCENE = `#version 300 es
precision highp float;
uniform vec2 grid;
uniform float aspect;
uniform float time;
uniform int from;
uniform int to;
uniform float blend;
uniform float side;
uniform float narrow;
uniform vec2 center;
uniform vec2 pointer;
uniform float scroll;
uniform float hush;
uniform vec4 waves[${WAVES}];
out vec4 color;

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

// Cada escena devuelve (luz, acento), las dos entre 0 y 1

// Cordillera: vuelo por un valle entre picos nevados, con el sol que sube y baja
float ground(vec2 q) {
  float valley = smoothstep(0.1, 1.9, abs(q.x + sin(q.y * 0.35) * 0.45));
  float ridge = 0.0, amp = 0.6;
  vec2 w = q * 0.55;
  for (int i = 0; i < 4; i++) {
    float n = 1.0 - abs(noise(w) * 2.0 - 1.0);
    ridge += amp * n * n;
    w = w * 2.07 + 9.3;
    amp *= 0.5;
  }
  return ridge * (0.12 + 2.7 * valley);
}
vec2 cordillera(vec2 p) {
  float day = time * 0.05;
  float height = 0.2 + 0.25 * sin(day);
  vec3 sun = normalize(vec3(center.x * 1.1, height, 1.0));
  float light = smoothstep(-0.06, 0.14, height);
  float dusk = 1.0 - smoothstep(0.08, 0.5, height);

  // La cámara sigue las curvas del valle
  float along = time * 0.22;
  vec3 eye = vec3(-sin(along * 0.35) * 0.45, 0.7 + scroll * 0.6, along);
  vec3 ray = normalize(vec3(p.x, p.y + 0.03 - scroll * 0.12, 0.9));

  float facing = max(dot(ray, sun), 0.0);
  float disc = smoothstep(0.9968, 0.9982, facing);
  float sky = 0.02 + 0.1 * light * smoothstep(0.45, -0.1, p.y) + pow(facing, 22.0) * 0.3 * light;
  float clouds = smoothstep(0.52, 0.78, fbm(vec2(p.x * 1.8 + time * 0.025, p.y * 7.0 + 3.0))) * smoothstep(0.16, 0.36, p.y);
  sky += clouds * (0.06 + 0.16 * light) + stars(0.018) * (1.0 - light) * step(clouds, 0.2);
  vec2 result = vec2(max(sky, disc), disc + pow(facing, 22.0) * 0.6 + clouds * dusk * 0.5);

  float far = 0.05;
  bool hit = false;
  for (int i = 0; i < 64; i++) {
    vec3 q = eye + ray * far;
    float above = q.y - ground(q.xz);
    if (above < 0.004 * far) { hit = true; break; }
    far += max(0.03, above * 0.42);
    if (far > 16.0) break;
  }
  if (hit) {
    vec3 q = eye + ray * far;
    float e = 0.012 * far + 0.01;
    float here = ground(q.xz);
    vec3 normal = normalize(vec3(ground(q.xz - vec2(e, 0)) - ground(q.xz + vec2(e, 0)), 2.0 * e, ground(q.xz - vec2(0, e)) - ground(q.xz + vec2(0, e))));
    // El sol queda de frente y dejaría las laderas a contraluz: las ilumina una luz lateral
    float lit = max(dot(normal, normalize(vec3(-0.18, 0.6, -0.78))), 0.0) * (0.3 + 0.7 * light);
    // Las crestas, vistas de canto, se encienden y dibujan el perfil
    float rim = pow(1.0 - max(dot(normal, -ray), 0.0), 3.0);
    float snow = smoothstep(1.2, 1.9, here) * smoothstep(0.45, 0.75, normal.y);
    // Estratos: líneas de altura que ayudan a leer el relieve en caracteres
    float strata = 0.62 + 0.38 * step(0.5, fract(here * 7.0));
    float rock = (0.02 + lit * lit * 1.1 + rim * 0.25 + snow * (0.25 + 0.6 * lit) + 0.1 * smoothstep(0.5, 2.0, here)) * strata;
    float fog = 1.0 - exp(-far * 0.1);
    result = vec2(mix(rock, sky - disc, fog), mix(lit * dusk * 0.9, 0.0, fog));
  }
  return result;
}

// Flujo: curvas de nivel de un ruido que se deforma despacio
vec2 flujo(vec2 p) {
  vec2 q = p * 1.1 + center * 0.2;
  vec2 warp = vec2(fbm(q + time * 0.05), fbm(q + 5.2 - time * 0.04));
  float f = fbm(q + warp * 1.8 + time * 0.02);
  float line = 1.0 - smoothstep(0.1, 0.36, abs(fract(f * 6.0) - 0.5));
  return vec2(line * 0.72 + f * 0.1, line * smoothstep(0.58, 0.68, f));
}

// Lava: gotas que se funden y se separan alrededor de la forma
vec2 lava(vec2 p) {
  float field = 0.0;
  for (int i = 0; i < 7; i++) {
    float k = float(i);
    vec2 drop = center + vec2(sin(time * 0.21 + k * 2.1) * 0.62, cos(time * 0.27 + k * 1.3) * 0.36);
    vec2 d = p - drop;
    field += (0.012 + 0.006 * sin(k * 5.0)) / dot(d, d);
  }
  float edge = smoothstep(0.75, 1.0, field) - smoothstep(1.0, 1.55, field);
  float body = smoothstep(1.0, 1.3, field);
  return vec2(edge * 0.8 + body * (0.12 + 0.24 * noise(p * 9.0 + time * 0.6)), edge);
}

// Ondas: mar en perspectiva bajo una luna
vec2 ondas(vec2 p) {
  float horizon = 0.06;
  if (p.y < horizon) {
    float z = 0.3 / (horizon - p.y);
    vec2 g = vec2(p.x * z, z + time * 0.5);
    float crest = smoothstep(0.25, 1.0, sin(g.y * 8.0 + sin(g.x * 2.2 + time * 0.45) * 1.6 + sin(g.x * 0.7 - time * 0.2) * 2.0));
    float shimmer = exp(-pow((p.x - center.x) * 3.2, 2.0)) * (0.5 + 0.5 * sin(g.y * 9.0 - time * 2.0));
    float fade = exp(-z * 0.085);
    return vec2((crest * 0.62 + shimmer * 0.4) * fade + 0.035, shimmer * fade * 0.9);
  }
  float moon = 1.0 - smoothstep(0.075, 0.085, length(p - vec2(center.x, 0.27)));
  float bite = 1.0 - smoothstep(0.07, 0.08, length(p - vec2(center.x + 0.035, 0.285)));
  float crescent = moon * (1.0 - bite);
  return vec2(crescent + stars(0.022) * (1.0 - moon) * 0.9 + 0.03, crescent);
}

// Lluvia: columnas de código que caen, cada una a su ritmo
vec2 lluvia(vec2 p) {
  float column = floor(gl_FragCoord.x);
  float seed = hash(vec2(column, 3.0));
  float fall = fract(gl_FragCoord.y / grid.y * (0.7 + seed) + time * (0.1 + seed * 0.22) + seed * 9.0);
  float on = step(0.42, hash(vec2(column, 11.0)));
  float tail = pow(1.0 - fall, 3.0);
  return vec2(on * tail * 0.85, on * smoothstep(0.05, 0.0, fall));
}

// Órbita: un planeta que gira, con anillo y estrellas
vec2 orbita(vec2 p) {
  vec2 c = p - center;
  float radius = 0.3;
  float d2 = dot(c, c);
  // Anillo: una elipse inclinada, cortada donde pasa por detrás del planeta
  vec2 tilt = vec2(c.x * 0.94 + c.y * 0.34, (c.y * 0.94 - c.x * 0.34) * 3.6);
  float ring = smoothstep(0.09, 0.02, abs(length(tilt) - radius * 1.72)) * 0.7;
  if (d2 < radius * radius) {
    vec3 n = vec3(c, sqrt(radius * radius - d2)) / radius;
    vec2 map = vec2(atan(n.x, n.z) + time * 0.12, asin(n.y));
    float land = smoothstep(0.48, 0.56, fbm(map * vec2(1.6, 2.6) + 3.0));
    float lit = max(dot(n, normalize(vec3(-0.6, 0.4, 0.55))), 0.0);
    float front = step(0.0, tilt.y);
    // El lado de sombra no desaparece: queda el contorno del disco
    float limb = smoothstep(0.82, 1.0, sqrt(d2) / radius) * 0.3;
    return vec2(max(lit * (0.24 + 0.62 * land) + 0.1 + limb, ring * front), max(land * lit * 0.7, ring * front));
  }
  return vec2(max(ring, stars(0.02) * 0.85) + 0.02, ring * 0.6);
}

vec2 scene(int which, vec2 p) {
  if (which == 0) return cordillera(p);
  if (which == 1) return flujo(p);
  if (which == 2) return lava(p);
  if (which == 3) return ondas(p);
  if (which == 4) return lluvia(p);
  return orbita(p);
}

void main() {
  vec2 uv = gl_FragCoord.xy / grid;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  // Cambio de escena: una se disuelve en la otra siguiendo un ruido
  vec2 result;
  if (blend <= 0.0) result = scene(from, p);
  else if (blend >= 1.0) result = scene(to, p);
  else {
    float edge = blend * 1.5 - 0.25 - noise(gl_FragCoord.xy * 0.09) * 0.5 - uv.y * 0.25 + 0.25;
    float turn = smoothstep(0.0, 0.12, edge);
    result = mix(scene(from, p), scene(to, p), turn);
    // El frente del cambio se enciende
    float front = smoothstep(0.0, 0.06, edge) - smoothstep(0.06, 0.2, edge);
    result += front * vec2(0.5, 0.9);
  }

  // Puntero: un resplandor; clic: un anillo que se abre
  float near = exp(-dot(p - pointer, p - pointer) * 46.0);
  result += near * vec2(0.2, 0.55);
  for (int i = 0; i < ${WAVES}; i++) {
    float ring = exp(-pow((length(p - waves[i].xy) - waves[i].z) * 16.0, 2.0)) * waves[i].w;
    result += ring * vec2(0.6, 0.8);
  }

  // Detrás de la forma de letras la escena baja, para que no se mezclen
  // En pantallas angostas la forma es más chica, y el hueco también
  vec2 behind = (p - center) / (vec2(0.5, 0.3) * clamp(aspect / 1.6, 0.42, 1.0));
  result.x *= 1.0 - hush * exp(-dot(behind, behind));

  // Del lado del texto la escena se apaga para que se pueda leer
  float wide = mix(0.05, 1.0, smoothstep(-0.3, 0.5, (uv.x * 2.0 - 1.0) * side));
  float tall = mix(0.05, 1.0, smoothstep(0.4, 0.66, uv.y));
  result.x *= mix(mix(1.0, wide, abs(side)), tall, narrow);

  color = vec4(clamp(result, 0.0, 1.0), 0.0, 1.0);
}`;

const GLYPHS = `#version 300 es
precision highp float;
uniform sampler2D scene;
uniform sampler2D atlas;
uniform vec2 cell;
uniform float count;
uniform float time;
uniform float gain;
uniform vec3 paper;
uniform vec3 accent;
out vec4 color;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 at = gl_FragCoord.xy / cell;
  vec2 id = floor(at);
  vec2 inside = fract(at);
  vec4 lit = texelFetch(scene, ivec2(id), 0);
  // Lo oscuro queda vacío: la escena se lee por sus luces
  float light = smoothstep(0.12, 0.9, lit.r);
  if (light < 0.03) discard;
  // Entre caracteres de tinta parecida elige uno distinto cada tanto: la escena titila
  float seed = hash(id);
  float pick = hash(id + floor(time * (0.6 + seed * 1.6) + seed * 9.0));
  float glyph = clamp(floor(light * (count - 1.0) + (pick - 0.5) * 2.4), 1.0, count - 1.0);
  // Un margen dentro de la celda: sin él, el filtrado trae tinta del carácter vecino
  vec2 within = (inside - 0.5) * 0.92 + 0.5;
  float ink = texture(atlas, vec2((glyph + within.x) / count, 1.0 - within.y)).a;
  float alpha = ink * (0.34 + 0.66 * light) * gain;
  color = vec4(mix(paper, accent, lit.g) * alpha, alpha);
}`;

/** Ordena los caracteres de menos a más tinta y los dibuja en una fila. */
function ramp() {
  const probe = document.createElement('canvas');
  probe.width = GLYPH_W;
  probe.height = GLYPH_H;
  const ctx = probe.getContext('2d', { willReadFrequently: true })!;
  const font = `600 ${GLYPH_H * 0.72}px ${FONT}`;
  const inked = [...new Set(RAMP)].map((char) => {
    ctx.clearRect(0, 0, GLYPH_W, GLYPH_H);
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(char, GLYPH_W / 2, GLYPH_H / 2);
    const data = ctx.getImageData(0, 0, GLYPH_W, GLYPH_H).data;
    let ink = 0;
    for (let i = 3; i < data.length; i += 4) ink += data[i];
    return { char, ink };
  }).sort((a, b) => a.ink - b.ink);

  const canvas = document.createElement('canvas');
  canvas.width = GLYPH_W * inked.length;
  canvas.height = GLYPH_H;
  const row = canvas.getContext('2d')!;
  row.font = font;
  row.textAlign = 'center';
  row.textBaseline = 'middle';
  row.fillStyle = '#fff';
  inked.forEach(({ char }, i) => row.fillText(char, i * GLYPH_W + GLYPH_W / 2, GLYPH_H / 2));
  return { canvas, count: inked.length };
}

export function createAsciiField(canvas: HTMLCanvasElement) {
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

  const { canvas: image, count: glyphs } = ramp();
  const atlas = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, atlas);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const target = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, target);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
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
  const view = { from: 0, to: 0, blend: 1, side: 0, gain: 0, hush: HUSH[0], r: 255, g: 122, b: 61 };
  const pointer = { x: -9, y: -9, sx: -9, sy: -9 };
  const waves = new Float32Array(WAVES * 4);
  const rings: { x: number; y: number; r: number; power: number }[] = [];
  let mixing: ReturnType<typeof animate> | null = null;
  let bare = false;

  /** De píxeles de pantalla al espacio de la escena: alto 1, origen en el centro. */
  const toScene = (x: number, y: number): [number, number] => [(x / w - 0.5) * (w / h), 0.5 - y / h];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    cellW = w < 820 ? 8 : 10;
    cellH = cellW * (GLYPH_H / GLYPH_W);
    cols = Math.ceil(w / cellW);
    rows = Math.ceil(h / cellH);
    gl!.bindTexture(gl!.TEXTURE_2D, target);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA8, cols, rows, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, null);
    dirty = true;
  }

  function frame(now: number) {
    requestAnimationFrame(frame);
    // Quieto: solo se vuelve a dibujar cuando algo cambia
    if (!visible || (still && !dirty && !mixing)) return;
    dirty = false;
    const time = still ? 40 : now / 1000;

    pointer.sx += (pointer.x - pointer.sx) * 0.12;
    pointer.sy += (pointer.y - pointer.sy) * 0.12;
    const spot = getCenter?.();
    const [cx, cy] = spot ? toScene(spot.x, spot.y) : [0, 0];
    waves.fill(0);
    rings.slice(-WAVES).forEach((ring, i) => waves.set([ring.x, ring.y, ring.r, ring.power], i * 4));

    // 1. La escena, una celda por píxel
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, buffer);
    gl!.viewport(0, 0, cols, rows);
    gl!.disable(gl!.BLEND);
    gl!.useProgram(scenePass!.made);
    const s = scenePass!.uniforms;
    gl!.uniform2f(s.grid, cols, rows);
    gl!.uniform1f(s.aspect, w / h);
    gl!.uniform1f(s.time, time);
    gl!.uniform1i(s.from, view.from);
    gl!.uniform1i(s.to, view.to);
    gl!.uniform1f(s.blend, view.blend);
    gl!.uniform1f(s.side, view.side);
    gl!.uniform1f(s.narrow, w < 820 ? 1 : 0);
    gl!.uniform2f(s.center, cx, cy);
    gl!.uniform2f(s.pointer, pointer.sx, pointer.sy);
    gl!.uniform1f(s.hush, view.hush);
    gl!.uniform1f(s.scroll, Math.min(1, window.scrollY / h));
    gl!.uniform4fv(s.waves, waves);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);

    // 2. Los caracteres, a resolución de pantalla
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
    gl!.viewport(0, 0, canvas.width, canvas.height);
    gl!.enable(gl!.BLEND);
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.useProgram(glyphPass!.made);
    const g = glyphPass!.uniforms;
    gl!.uniform1i(g.scene, 0);
    gl!.uniform1i(g.atlas, 1);
    gl!.uniform2f(g.cell, cellW * dpr, cellH * dpr);
    gl!.uniform1f(g.count, glyphs);
    gl!.uniform1f(g.time, time);
    gl!.uniform1f(g.gain, view.gain);
    // Más apagado que las letras sueltas, que quedan adelante
    gl!.uniform3f(g.paper, 0.66, 0.65, 0.62);
    gl!.uniform3f(g.accent, view.r / 255, view.g / 255, view.b / 255);
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
  animate(view, { gain: 0.8, duration: still ? 0 : 2400, delay: still ? 0 : 500, ease: 'outQuad' });

  return {
    /** Cambia de escena y de lado: el texto queda del lado contrario a `side`. */
    show(scene: Scene, side: Side = 'center', accent?: [number, number, number]) {
      const next = SCENES.indexOf(scene);
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
        duration: still ? 0 : 1700,
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
    setAccent([r, g, b]: [number, number, number]) {
      dirty = true;
      animate(view, { r, g, b, duration: still ? 0 : 600, ease: 'outQuad' });
    },
    /** Escena sola y entera, sin apagarla para el texto ni para la forma. */
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
