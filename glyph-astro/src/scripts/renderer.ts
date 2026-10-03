// Dibuja todas las letras en una sola llamada de WebGL: un atlas con los
// caracteres y un cuadrado instanciado por letra, más una pasada de brillo.
// Si WebGL2 no está disponible, cae a canvas 2D sin brillo.

/** Datos por letra: x, y, cos·tamaño, sin·tamaño, alfa, carácter, acento. */
export const STRIDE = 7;

export interface Renderer {
  resize(width: number, height: number): void;
  render(data: Float32Array, count: number, accent: [number, number, number]): void;
}

const CELL = 64;
const FONT_PX = 44;
const COLS = 8;
const FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const BASE = [239, 236, 228];

const VERTEX = `#version 300 es
in vec2 corner;
in vec2 offset;
in vec2 turn;
in vec3 info;
uniform vec2 resolution;
uniform vec2 grid;
uniform float halo;
out vec2 uv;
out vec2 spot;
out float alpha;
out float accent;
void main() {
  // En la pasada de brillo el cuadrado crece para dibujar un halo suave
  vec2 wide = corner * mix(1.0, 2.4, halo);
  vec2 local = vec2(wide.x * turn.x - wide.y * turn.y, wide.x * turn.y + wide.y * turn.x);
  spot = corner;
  vec2 clip = (offset + local) / resolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  float col = mod(info.y, grid.x);
  float row = floor(info.y / grid.x);
  uv = (vec2(col, row) + corner + 0.5) / grid;
  alpha = info.x;
  accent = info.z;
}`;

const FRAGMENT = `#version 300 es
precision mediump float;
in vec2 uv;
in float alpha;
in float accent;
in vec2 spot;
// Misma precisión que en el vertex shader, o el programa no enlaza
uniform highp float halo;
uniform sampler2D atlas;
uniform vec3 baseColor;
uniform vec3 accentColor;
out vec4 color;
void main() {
  vec3 tint = mix(baseColor, accentColor, accent);
  if (halo > 0.5) {
    // Alfa 0 con color premultiplicado: el halo se suma al fondo
    float fall = max(0.0, 1.0 - length(spot) * 2.0);
    color = vec4(tint * fall * fall * alpha * (0.06 + 0.17 * accent), 0.0);
    return;
  }
  float a = texture(atlas, uv).a * alpha;
  color = vec4(tint * a, a);
}`;

function atlas(chars: string) {
  const rows = Math.ceil(chars.length / COLS);
  const canvas = document.createElement('canvas');
  canvas.width = COLS * CELL;
  canvas.height = rows * CELL;
  const ctx = canvas.getContext('2d')!;
  ctx.font = `600 ${FONT_PX}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], (i % COLS) * CELL + CELL / 2, Math.floor(i / COLS) * CELL + CELL / 2);
  }
  return { canvas, rows };
}

function webgl(canvas: HTMLCanvasElement, chars: string, capacity: number): Renderer | null {
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: true });
  if (!gl) return null;

  const program = gl.createProgram()!;
  for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
  const corner = gl.getAttribLocation(program, 'corner');
  gl.enableVertexAttribArray(corner);
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);

  const instances = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instances);
  gl.bufferData(gl.ARRAY_BUFFER, capacity * STRIDE * 4, gl.DYNAMIC_DRAW);
  const layout: [string, number, number][] = [['offset', 2, 0], ['turn', 2, 2], ['info', 3, 4]];
  for (const [name, size, start] of layout) {
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, STRIDE * 4, start * 4);
    gl.vertexAttribDivisor(location, 1);
  }

  const { canvas: image, rows } = atlas(chars);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.uniform2f(gl.getUniformLocation(program, 'grid'), COLS, rows);
  gl.uniform3f(gl.getUniformLocation(program, 'baseColor'), BASE[0] / 255, BASE[1] / 255, BASE[2] / 255);
  const resolution = gl.getUniformLocation(program, 'resolution');
  const accentColor = gl.getUniformLocation(program, 'accentColor');
  const halo = gl.getUniformLocation(program, 'halo');
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  return {
    resize(width, height) {
      gl.viewport(0, 0, width, height);
      gl.uniform2f(resolution, width, height);
    },
    render(data, count, accent) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform3f(accentColor, accent[0] / 255, accent[1] / 255, accent[2] / 255);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, count * STRIDE);
      // Dos pasadas sobre los mismos datos: primero el brillo, después las letras
      gl.uniform1f(halo, 1);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
      gl.uniform1f(halo, 0);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    },
  };
}

function canvas2d(canvas: HTMLCanvasElement, chars: string): Renderer {
  const ctx = canvas.getContext('2d')!;
  const scale = 1 / (CELL * (16 / FONT_PX));
  return {
    resize() {},
    render(data, count, accent) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = `600 16px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const colors = [`rgb(${BASE})`, `rgb(${accent.map(Math.round)})`];
      for (let i = 0; i < count; i++) {
        const k = i * STRIDE;
        ctx.globalAlpha = data[k + 4];
        ctx.fillStyle = colors[data[k + 6]];
        ctx.setTransform(data[k + 2] * scale, data[k + 3] * scale, -data[k + 3] * scale, data[k + 2] * scale, data[k], data[k + 1]);
        ctx.fillText(chars[data[k + 5]], 0, 0);
      }
    },
  };
}

/** Tamaño en pantalla del cuadrado de una letra dibujada a `px` píxeles. */
export const quadSize = (px: number) => (px * CELL) / FONT_PX;

export function createRenderer(canvas: HTMLCanvasElement, chars: string, capacity: number): Renderer {
  return webgl(canvas, chars, capacity) ?? canvas2d(canvas, chars);
}
