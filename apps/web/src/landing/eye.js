/*
 * 見張り — the opening. A manga-inked eye drawn entirely in a fragment shader (no images): it blinks open,
 * glances toward the cursor, then the camera falls into the pupil. The pupil is transparent, so what you see
 * through it is the live 3D city behind this canvas; as the pupil swallows the screen the eye becomes a portal.
 * Raw WebGL, one draw call, ~3.5 s, then the canvas is removed.
 */

const VERT = 'attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';
const FRAG = `
precision highp float;
varying vec2 v;
uniform vec2 uRes, uLook;
uniform float uTime, uOpen, uZoom, uFade;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }

const float W = 0.62;     // half-width of the eye opening
const float HU = 0.30;    // upper lid height
const float HL = 0.20;    // lower lid depth

float upper(float x){ float t = clamp(1.0 - pow(abs(x) / W, 2.0), 0.0, 1.0); return HU * pow(t, 0.8); }
float lower(float x){ float t = clamp(1.0 - pow(abs(x) / W, 2.0), 0.0, 1.0); return -HL * pow(t, 0.9); }

void main(){
  vec2 q = (v - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  vec2 irisC = uLook * vec2(0.09, 0.045);
  vec2 p = q / uZoom + irisC * (1.0 - 1.0 / uZoom);          // zoom toward the pupil
  float px = 1.5 / uRes.y / uZoom;

  // ── skin: indigo with magenta neon wash, halftone and hatching like a comic panel ──
  vec3 skin = mix(vec3(0.10, 0.10, 0.42), vec3(0.24, 0.20, 0.78), smoothstep(-0.9, 0.6, p.y + p.x * 0.3));
  skin = mix(skin, vec3(0.95, 0.18, 0.75), smoothstep(0.35, 1.0, noise(p * 1.6 + 3.1)) * 0.5);
  
  vec2 hp = p * 70.0; float dots = smoothstep(0.32, 0.28, length(fract(hp) - 0.5));
  skin *= 1.0 - dots * 0.12;
  float hatch = smoothstep(0.75, 0.95, sin((p.x - p.y * 0.6) * 260.0)) * smoothstep(-0.2, 0.6, p.y - 0.25);
  skin *= 1.0 - hatch * 0.35;
  float browY = 0.56 - 0.32 * p.x * p.x + 0.05 * p.x;
  float browBand = smoothstep(0.075, 0.0, abs(p.y - browY)) * smoothstep(0.95, 0.4, abs(p.x));
  float hair = smoothstep(0.55, 0.85, sin((p.x * 1.0 + (p.y - browY) * 2.8) * 140.0 + noise(p * 20.0) * 4.0));
  skin = mix(skin, vec3(0.02, 0.02, 0.08), browBand * (0.55 + 0.45 * hair));

  // ── the opening, scaled by how open the eye is ──
  float yu = upper(p.x) * uOpen, yl = lower(p.x) * uOpen;
  float inside = step(yl, p.y) * step(p.y, yu) * step(abs(p.x), W);

  // ── iris: data rain glyphs in magenta, radial fibres, dark limbal ring ──
  vec2 ip = p - irisC; float r = length(ip);
  float R = 0.2, PR = 0.085;
  vec2 g = vec2(ip.x * 80.0, ip.y * 80.0 + uTime * 7.0);
  vec2 gi = floor(g); vec2 gf = fract(g);
  float glyph = step(0.42, hash(gi + floor(uTime * 3.0 + hash(gi.xx) * 9.0))) * step(0.15, gf.x) * step(gf.x, 0.8) * step(0.1, gf.y) * step(gf.y, 0.85);
  float a = atan(ip.y, ip.x);
  float fib = 0.6 + 0.4 * noise(vec2(a * 18.0, r * 30.0));
  vec3 iris = mix(vec3(0.16, 0.0, 0.14), vec3(1.0, 0.14, 0.68), fib * 0.7) * (0.25 + 1.0 * glyph);
  iris += vec3(0.1, 0.9, 1.0) * smoothstep(0.012, 0.0, abs(r - PR - 0.05)) * 0.45;
  iris += vec3(1.0, 0.2, 0.7) * smoothstep(0.05, 0.0, abs(r - R + 0.03)) * 0.25 * glyph;
  iris *= smoothstep(R, R - 0.03, r) * 0.85 + 0.15;
  vec3 sclera = mix(vec3(0.85, 0.22, 0.7), vec3(0.32, 0.08, 0.45), smoothstep(0.0, 0.6, length(p)));
  sclera *= 0.35 + 0.55 * glyph;
  vec3 eyeCol = mix(sclera, iris, smoothstep(R + px, R - px, r));
  float limbal = smoothstep(0.012, 0.0, abs(r - R)); eyeCol = mix(eyeCol, vec3(0.05, 0.0, 0.08), limbal * 0.9);
  // lid shadow across the top of the eyeball
  eyeCol *= 1.0 - smoothstep(0.08, 0.0, yu - p.y) * 0.55;
  // catchlight
  eyeCol += vec3(0.6, 1.0, 1.0) * smoothstep(0.03, 0.0, length(ip - vec2(-0.07, 0.07))) * 1.2;

  // the pupil: transparent: this is the portal
  float pupil = smoothstep(PR + px * 2.0, PR - px * 2.0, r) * inside;
  float rim = smoothstep(0.02, 0.0, abs(r - PR)) * inside;

  vec3 col = mix(skin, eyeCol, inside);
  col += vec3(1.0, 0.3, 0.85) * rim * 0.9;

  // ── ink: lid lines and lashes ──
  float lidU = abs(p.y - yu) - 0.014 - 0.012 * (1.0 - abs(p.x) / W);
  float lidL = abs(p.y - yl) - 0.005;
  float ink = smoothstep(px, -px, min(lidU, lidL)) * smoothstep(W + 0.03, W - 0.01, abs(p.x));
  // upper lashes: tapered, curved, clustered, of uneven length (each is two segments)
  for (int i = 0; i < 64; i++) {
    float fi = float(i) / 63.0;
    float jit = hash(vec2(fi, 9.0));
    float x = mix(-W * 0.97, W * 0.99, fi) + (jit - 0.5) * 0.012;
    vec2 base = vec2(x, upper(x) * uOpen);
    float side = x / W;
    float len = (0.07 + 0.16 * smoothstep(-0.9, 0.85, side) * (1.0 - smoothstep(0.85, 1.0, side) * 0.5)) * (0.55 + 0.6 * hash(vec2(fi, 3.0))) * (0.35 + 0.65 * uOpen);
    vec2 dir = normalize(vec2(side * 1.25 + 0.25, 1.0));
    vec2 perp = vec2(dir.y, -dir.x) * sign(side + 0.25);
    vec2 m1 = base + dir * len * 0.38 - perp * len * 0.06;
    vec2 m2 = base + dir * len * 0.7 + perp * len * 0.05;
    vec2 tip = base + dir * len * 0.9 + perp * len * 0.3;
    float d = min(min(seg(p, base, m1), seg(p, m1, m2)), seg(p, m2, tip));
    float along = clamp(length(p - base) / len, 0.0, 1.0);
    ink = max(ink, smoothstep(px, -px, d - (0.0062 * (1.0 - along) + 0.0006)));
  }
  // lower lashes: short, sparse, falling outward
  for (int i = 0; i < 22; i++) {
    float fi = float(i) / 21.0;
    float x = mix(-W * 0.7, W * 0.92, fi);
    vec2 lb = vec2(x, lower(x) * uOpen);
    float len = (0.025 + 0.05 * hash(vec2(fi, 5.0))) * uOpen;
    vec2 lt = lb + normalize(vec2(x / W * 0.9 + 0.2, -1.0)) * len;
    float along = clamp(length(p - lb) / max(len, 0.001), 0.0, 1.0);
    ink = max(ink, smoothstep(px, -px, seg(p, lb, lt) - (0.003 * (1.0 - along) + 0.0004)));
  }
  // crease above the lid
  float crease = smoothstep(px * 2.0, 0.0, abs(p.y - (upper(p.x) * 0.55 + 0.17)) - 0.004) * step(abs(p.x), W * 0.85);
  ink = max(ink, crease * 0.8);
  col = mix(col, vec3(0.01, 0.0, 0.03), ink);

  // during the fall, streak lines rush outward
  float fall = smoothstep(1.5, 8.0, uZoom);
  float ang = atan(q.y, q.x);
  float streak = step(0.92, hash(vec2(floor(ang * 60.0), 1.0))) * smoothstep(0.1, 0.9, length(q)) * fall;
  col += vec3(0.4, 0.95, 1.0) * streak * 0.6;

  float alpha = (1.0 - pupil * (1.0 - ink)) * uFade;
  gl_FragColor = vec4(col * alpha, alpha);
}`;

export function playEye(canvas, {onDone, onReveal, onFall} = {}) {
  const gl = canvas.getContext('webgl', {premultipliedAlpha: true, alpha: true, antialias: false});
  if (!gl) { onDone?.(); return () => {}; }
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(prog)); onDone?.(); return () => {}; }
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(prog, n);
  const u = {res: U('uRes'), look: U('uLook'), time: U('uTime'), open: U('uOpen'), zoom: U('uZoom'), fade: U('uFade')};
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const size = () => { canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; gl.viewport(0, 0, canvas.width, canvas.height); };
  size(); addEventListener('resize', size);
  const look = {x: 0, y: 0, tx: 0, ty: 0};
  const onMove = e => { look.tx = (e.clientX / innerWidth - 0.5) * 2; look.ty = -(e.clientY / innerHeight - 0.5) * 2; };
  addEventListener('pointermove', onMove);

  const ease = t => t * t * (3 - 2 * t);
  const easeIn = t => t * t * t * t;
  // timeline (s): fade in closed · open · quick blink · glance · fall
  const T = {open: [0.25, 1.05], blink: [1.55, 1.85], fall: [2.35, 3.55]};
  // clock advances by clamped frame deltas, so a main-thread stall (the city compiling) pauses the eye instead of skipping it
  let raf = 0, last = 0, clock = 0, revealed = false, fell = false, skipAt = null;
  const frame = now => {
    const dt = last ? (now - last) / 1000 : 0; last = now; clock += dt > 0.25 ? 1 / 60 : dt;
    if (skipAt !== null) { clock = Math.max(clock, T.fall[0]); skipAt = null; }
    const t = clock;
    let open = ease(Math.min(1, Math.max(0, (t - T.open[0]) / (T.open[1] - T.open[0]))));
    if (t > T.blink[0] && t < T.blink[1]) { const b = (t - T.blink[0]) / (T.blink[1] - T.blink[0]); open *= Math.abs(Math.cos(b * Math.PI)); }
    // glance: before the fall the eye looks at the cursor, then recentres
    const fallT = Math.min(1, Math.max(0, (t - T.fall[0]) / (T.fall[1] - T.fall[0])));
    const gaze = t > T.blink[1] ? 1 - ease(fallT) : t > T.open[1] ? 0.6 : 0;
    look.x += (look.tx * gaze - look.x) * 0.08; look.y += (look.ty * gaze - look.y) * 0.08;
    const zoom = 1 + easeIn(fallT) * 46;
    const fade = Math.min(1, t / 0.25) * (1 - Math.max(0, (fallT - 0.86) / 0.14));
    if (!fell && fallT > 0) { fell = true; onFall?.(); }
    if (!revealed && fallT > 0.5) { revealed = true; onReveal?.(); }
    gl.uniform2f(u.res, canvas.width, canvas.height); gl.uniform2f(u.look, look.x, look.y);
    gl.uniform1f(u.time, t); gl.uniform1f(u.open, Math.max(open, fallT > 0 ? 1 : 0)); gl.uniform1f(u.zoom, zoom); gl.uniform1f(u.fade, Math.max(0, fade));
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (fallT >= 1) { cleanup(); onDone?.(); return; }
    raf = requestAnimationFrame(frame);
  };
  const skip = () => { if (skipAt === null) skipAt = performance.now(); };
  addEventListener('keydown', skip); addEventListener('pointerdown', skip); addEventListener('wheel', skip, {passive: true});
  const cleanup = () => {
    cancelAnimationFrame(raf); removeEventListener('resize', size); removeEventListener('pointermove', onMove);
    removeEventListener('keydown', skip); removeEventListener('pointerdown', skip); removeEventListener('wheel', skip);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
  raf = requestAnimationFrame(frame);
  return cleanup;
}
