// Una foto reconstruida con letras, como el fondo de la portada: cada celda es
// la letra siguiente de un texto, y la foto decide su color, su brillo y si va
// en negrita. La foto se lee en el navegador y no sale de él.

const FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace';
const GLYPH_W = 36, GLYPH_H = 64;
const MAX_TEXT = 4096;

const QUAD = `#version 300 es
in vec2 corner;
void main() { gl_Position = vec4(corner, 0.0, 1.0); }`;

const GLYPHS = `#version 300 es
precision highp float;
uniform sampler2D photo;
uniform sampler2D atlas;
uniform sampler2D text;
uniform vec2 cell;
uniform vec2 screen;
uniform vec4 frame;
uniform float lod;
uniform float count;
uniform int textLength;
uniform float mono;
uniform vec2 pointer;
out vec4 color;

float level(vec3 c) {
  return max(max(c.r, c.g), c.b) * 0.6 + dot(c, vec3(0.3, 0.55, 0.15)) * 0.4;
}

// De un punto de la pantalla (y hacia arriba) a la foto, que entra entera y centrada
vec2 toPhoto(vec2 q) {
  vec2 uv = (vec2(q.x, screen.y - q.y) - frame.xy) / frame.zw;
  return uv;
}

void main() {
  vec2 at = gl_FragCoord.xy / cell;
  vec2 id = floor(at);
  vec2 inside = fract(at);
  vec2 uvCell = toPhoto((id + 0.5) * cell);
  vec2 uvHere = toPhoto(gl_FragCoord.xy);
  if (any(lessThan(uvCell, vec2(0.0))) || any(greaterThan(uvCell, vec2(1.0)))) discard;

  // La celda entera decide letra y peso; el punto exacto, el color
  vec3 whole = textureLod(photo, uvCell, lod).rgb;
  vec3 here = texture(photo, uvHere).rgb;
  float light = level(whole);
  // El puntero ilumina lo que tiene cerca
  float near = exp(-dot(gl_FragCoord.xy - pointer, gl_FragCoord.xy - pointer) / (cell.x * cell.x * 120.0));
  light = min(1.0, light + near * 0.25);

  int columns = int(ceil(screen.x / cell.x));
  int rows = int(ceil(screen.y / cell.y));
  int index = (rows - 1 - int(id.y)) * columns + int(id.x);
  float glyph = floor(texelFetch(text, ivec2(index % textLength, 0), 0).r * 255.0 + 0.5);

  vec2 within = (inside - 0.5) * 0.92 + 0.5;
  float bold = step(0.55, light);
  float ink = glyph < 0.5 ? 0.0 : texture(atlas, vec2((glyph + within.x) / count, (bold + 1.0 - within.y) * 0.5)).a;
  ink = min(1.0, ink * 1.35);
  float alpha = ink * (0.12 + 0.88 * pow(smoothstep(0.02, 0.85, light), 1.1));

  // Color de la foto, algo más vivo; en monocromo, el papel del sitio
  vec3 vivid = here / max(max(here.r, here.g), max(here.b, 0.08));
  vec3 tint = mix(mix(here * 1.2, vivid, 0.35), vec3(0.94, 0.93, 0.89), mono);
  float glow = light * light * 0.3;
  vec3 under = mix(here, vec3(light), mono) * glow;
  color = vec4(tint * alpha + under * (1.0 - alpha), alpha + glow * (1.0 - alpha));
}`;

export function createPhotoField(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true });
  if (!gl) return null;

  const made = gl.createProgram()!;
  for (const [type, source] of [[gl.VERTEX_SHADER, QUAD], [gl.FRAGMENT_SHADER, GLYPHS]] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(shader));
    gl.attachShader(made, shader);
  }
  gl.bindAttribLocation(made, 0, 'corner');
  gl.linkProgram(made);
  if (!gl.getProgramParameter(made, gl.LINK_STATUS)) return null;
  gl.useProgram(made);
  const u = (name: string) => gl.getUniformLocation(made, name);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  const photoTexture = gl.createTexture();
  const atlasTexture = gl.createTexture();
  const textTexture = gl.createTexture();
  gl.uniform1i(u('photo'), 0);
  gl.uniform1i(u('atlas'), 1);
  gl.uniform1i(u('text'), 2);

  let photo: { width: number; height: number } | null = null;
  let cellW = 7;
  let mono = 0;
  let count = 1;
  const pointer = { x: -9999, y: -9999 };

  /** Arma el atlas con los caracteres del texto y el texto como índices. */
  function setText(value: string) {
    const line = [...(value.trim() ? `${value.trim()} ` : 'esto no es una foto. ')].slice(0, MAX_TEXT);
    const chars = [' ', ...[...new Set(line)].filter((char) => char !== ' ').sort()].slice(0, 255);
    const image = document.createElement('canvas');
    image.width = GLYPH_W * chars.length;
    image.height = GLYPH_H * 2;
    const ctx = image.getContext('2d')!;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ['500', '800'].forEach((weight, row) => {
      ctx.font = `${weight} ${GLYPH_H * 0.7}px ${FONT}`;
      chars.forEach((char, i) => ctx.fillText(char, i * GLYPH_W + GLYPH_W / 2, row * GLYPH_H + GLYPH_H / 2));
    });
    gl!.activeTexture(gl!.TEXTURE1);
    gl!.bindTexture(gl!.TEXTURE_2D, atlasTexture);
    gl!.pixelStorei(gl!.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, image);
    gl!.pixelStorei(gl!.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl!.generateMipmap(gl!.TEXTURE_2D);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR_MIPMAP_LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);

    const indices = new Uint8Array(line.map((char) => Math.max(0, chars.indexOf(char))));
    gl!.activeTexture(gl!.TEXTURE2);
    gl!.bindTexture(gl!.TEXTURE_2D, textTexture);
    gl!.pixelStorei(gl!.UNPACK_ALIGNMENT, 1);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.R8, indices.length, 1, 0, gl!.RED, gl!.UNSIGNED_BYTE, indices);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.NEAREST);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.NEAREST);
    count = chars.length;
    gl!.uniform1f(u('count'), count);
    gl!.uniform1i(u('textLength'), indices.length);
    draw();
  }

  function setPhoto(image: TexImageSource & { width: number; height: number }) {
    gl!.activeTexture(gl!.TEXTURE0);
    gl!.bindTexture(gl!.TEXTURE_2D, photoTexture);
    gl!.pixelStorei(gl!.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, image);
    gl!.generateMipmap(gl!.TEXTURE_2D);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR_MIPMAP_LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    photo = { width: image.width, height: image.height };
    draw();
  }

  let queued = false;
  function draw() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      gl!.viewport(0, 0, canvas.width, canvas.height);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      if (!photo) return;
      // La foto entra entera y centrada, con un margen
      const fit = Math.min((canvas.width * 0.94) / photo.width, (canvas.height * 0.94) / photo.height);
      const fw = photo.width * fit, fh = photo.height * fit;
      const cell: [number, number] = [cellW * dpr, cellW * dpr * (GLYPH_H / GLYPH_W)];
      gl!.uniform2f(u('cell'), ...cell);
      gl!.uniform2f(u('screen'), canvas.width, canvas.height);
      gl!.uniform4f(u('frame'), (canvas.width - fw) / 2, (canvas.height - fh) / 2, fw, fh);
      // Cuántos píxeles de la foto caen en una celda: de ahí el nivel de mipmap que los promedia
      gl!.uniform1f(u('lod'), Math.max(0, Math.log2((cell[0] / fit) * 0.8)));
      gl!.uniform1f(u('mono'), mono);
      gl!.uniform2f(u('pointer'), pointer.x * dpr, (h - pointer.y) * dpr);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
    });
  }

  new ResizeObserver(draw).observe(canvas);
  canvas.addEventListener('pointermove', (event) => {
    const box = canvas.getBoundingClientRect();
    pointer.x = event.clientX - box.left;
    pointer.y = event.clientY - box.top;
    draw();
  });
  canvas.addEventListener('pointerleave', () => {
    pointer.x = pointer.y = -9999;
    draw();
  });

  return {
    setPhoto,
    setText,
    setCell(px: number) {
      cellW = px;
      draw();
    },
    setMono(on: boolean) {
      mono = on ? 1 : 0;
      draw();
    },
    get hasPhoto() {
      return photo !== null;
    },
  };
}
