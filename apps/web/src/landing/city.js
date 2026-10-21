import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';

/*
 * NEON GATEHOUSE. One WebGL world: a night city canyon with a reflective wet floor, a striped sun on the
 * horizon, a chrome wordmark, and a checkpoint gate in the middle of it. Agent calls stream toward the
 * gate and each gets a verdict. Scroll flies the camera down the corridor. A post stack (bloom, chromatic
 * aberration, scanlines, glitch on denials, grain) makes it cinematic.
 *
 * Convention: forward is -z. The camera starts at +z looking toward the gate at the origin; calls travel
 * from +z through the gate and on into the corridor, where the ledger chain recedes into the distance.
 */

const PI = Math.PI;
const C = {
  cyan: new THREE.Color(0x19e6ff), green: new THREE.Color(0x2dff9a), magenta: new THREE.Color(0xff2fa6),
  amber: new THREE.Color(0xffb21f), red: new THREE.Color(0xff3b52), grey: new THREE.Color(0x6d7f92),
};
const HOT = {neutral: C.grey.clone().multiplyScalar(1.1), allow: C.green.clone().multiplyScalar(2.6), ask: C.amber.clone().multiplyScalar(2.4), deny: C.red.clone().multiplyScalar(2.6)};
const LEDGER = {neutral: C.grey.clone().multiplyScalar(0.8), allow: C.green.clone().multiplyScalar(1.5), deny: C.red.clone().multiplyScalar(1.6)};

const FLOOR_Y = -2.1;
const HIDDEN = {p: [-3.4, 0.2, 2.5], tilt: 0.4, rx: 0, s: 0.7, o: 0};
const FULL = {cx: 0.5, cy: 0.5, w: 1, h: 1};
const RIGHT = {cx: 0.7, cy: 0.52, w: 0.44, h: 0.76};
const LEFT = {cx: 0.3, cy: 0.52, w: 0.44, h: 0.76};

// Camera orbits `look` at azimuth `az`, elevation `el`, with `r` the bounding radius that must fit inside `zone`.
// closed = iris, alert = red alarm, dim = pull the whole city back so copy stays legible, ledger = chain size.
const S = (o) => ({az: 0, el: 0.1, r: 4, lx: 0, ly: 0, lz: 0, closed: 0, alert: 0, dim: 0, ledger: 0, word: 0, word2: 0, opacity: 1, zone: RIGHT, mix: [0.6, 0.2, 0.2], card: {...HIDDEN}, ...o});
const STAGES = [
  /* 0 hero      */ S({az: 0.0, el: 0.07, r: 3.3, lx: 0, ly: 0.2, lz: -1, zone: {cx: 0.5, cy: 0.39, w: 1, h: 0.6}, ledger: 1, word: 1, card: {...HIDDEN}}),
  /* 1 identify  */ S({az: -0.5, el: 0.07, r: 2.2, lx: 0.1, ly: 0.2, lz: 1.8, zone: RIGHT, mix: [0.5, 0.2, 0.3], card: {p: [0.15, 0.3, 1.9], tilt: -0.35, rx: 0.06, s: 1.0, o: 1}}),
  /* 2 decide    */ S({az: 0.28, el: 0.05, r: 2.7, lx: 0, ly: 0, lz: 0, zone: RIGHT, mix: [0.45, 0.25, 0.3]}),
  /* 3 prove     */ S({az: 0.55, el: 0.16, r: 4.6, lx: 0, ly: -0.2, lz: -4.6, zone: RIGHT, ledger: 1, mix: [0.75, 0.05, 0.2]}),
  /* 4 contain   */ S({az: 0.12, el: 0.05, r: 2.7, lx: 0, ly: 0, lz: 0, closed: 1, alert: 1, ledger: 0.5, zone: RIGHT, mix: [0, 0, 1]}),
  /* 5 handoff   */ S({az: 0.0, el: 0.1, r: 5.4, lx: 0, ly: 0.2, lz: -6, zone: FULL, dim: 0.55, mix: [0.8, 0.1, 0.1]}),
  /* 6 product   */ S({az: 0.14, el: 0.1, r: 5.4, lx: 0, ly: 0.2, lz: -16, zone: FULL, dim: 0.62, mix: [0.8, 0.1, 0.1]}),
  /* 7 passport  */ S({az: -0.14, el: 0.1, r: 5.4, lx: 0, ly: 0.2, lz: -26, zone: FULL, dim: 0.62, mix: [0.8, 0.1, 0.1]}),
  /* 8 policy    */ S({az: 0.14, el: 0.1, r: 5.4, lx: 0, ly: 0.2, lz: -36, zone: FULL, dim: 0.62, mix: [0.8, 0.1, 0.1]}),
  /* 9 integrate */ S({az: -0.14, el: 0.1, r: 5.4, lx: 0, ly: 0.2, lz: -46, zone: FULL, dim: 0.62, mix: [0.8, 0.1, 0.1]}),
  /* 10 cases    */ S({az: 0.14, el: 0.1, r: 5.4, lx: 0, ly: 0.2, lz: -56, zone: FULL, dim: 0.62, mix: [0.8, 0.1, 0.1]}),
  /* 11 stack    */ S({az: -0.14, el: 0.1, r: 5.4, lx: 0, ly: 0.2, lz: -66, zone: FULL, dim: 0.62, mix: [0.8, 0.1, 0.1]}),
  /* 12 trust    */ S({az: 0.14, el: 0.1, r: 5.4, lx: 0, ly: 0.2, lz: -76, zone: FULL, dim: 0.62, mix: [0.8, 0.1, 0.1]}),
  /* 13 cta      */ S({az: 0.0, el: 0.02, r: 6.4, lx: 0, ly: 1.4, lz: -90, zone: FULL, dim: 0.28, word2: 0, mix: [0.9, 0.05, 0.05]}),
];
const NUM = ['az', 'el', 'r', 'lx', 'ly', 'lz', 'closed', 'alert', 'dim', 'ledger', 'word', 'word2', 'opacity'];
const ZONE = ['cx', 'cy', 'w', 'h'];

const smooth = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

/* ── Shaders ─────────────────────────────────────────────── */

const SKY_VERT = 'varying vec2 vNdc; void main(){ vNdc = position.xy; gl_Position = vec4(position.xy, 1.0, 1.0); }';
const SKY_FRAG = `
precision highp float;
varying vec2 vNdc;
uniform mat4 uInvProj, uCamWorld;
uniform float uTime, uAlert, uDim;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p = p * 2.02 + 7.3; a *= 0.5; } return v; }
void main(){
  vec4 v = uInvProj * vec4(vNdc, 1.0, 1.0);
  vec3 d = normalize((uCamWorld * vec4(normalize(v.xyz / v.w), 0.0)).xyz);
  float e = d.y;
  // sky gradient: deep violet overhead, magenta haze, cyan glow below the horizon
  vec3 top = vec3(0.012, 0.008, 0.06), mid = vec3(0.10, 0.02, 0.2), hor = vec3(0.7, 0.07, 0.42), low = vec3(0.03, 0.4, 0.7);
  vec3 col = mix(hor, mid, smoothstep(0.0, 0.2, e));
  col = mix(col, top, smoothstep(0.14, 0.7, e));
  col = mix(col, low * 0.4, smoothstep(0.0, -0.06, e) * 0.9);
  // clouds
  vec2 cp = d.xz / (abs(e) + 0.35) * 1.6;
  float cl = fbm(cp + vec2(uTime * 0.012, 0.0)); cl = smoothstep(0.45, 0.88, cl);
  col += vec3(0.45, 0.08, 0.5) * cl * smoothstep(0.4, 0.04, e) * 0.5;
  // stars
  vec3 sd = d * 160.0; vec3 id = floor(sd); vec3 fd = fract(sd) - 0.5;
  float sh = hash(id.xy + id.z * 7.0);
  float star = step(0.9965, sh) * smoothstep(0.30, 0.0, length(fd)) * (0.6 + 0.4 * sin(uTime * 2.0 + sh * 90.0));
  col += vec3(0.8, 0.9, 1.0) * star * smoothstep(0.04, 0.3, e) * 1.6;
  // retrowave sun at the end of the corridor, cut by bands that widen toward the bottom
  vec2 sq = vec2(d.x, d.y) / max(-d.z, 0.05) - vec2(0.0, 0.115);
  float sr = length(sq);
  float disc = smoothstep(0.17, 0.165, sr) * step(d.z, 0.0);
  float gapW = smoothstep(0.045, -0.15, sq.y) * 0.62;
  float cut = step(gapW, fract(sq.y * 46.0)) ;
  cut = mix(1.0, cut, step(sq.y, 0.045));
  vec3 sunCol = mix(vec3(1.0, 0.62, 0.1), vec3(1.0, 0.08, 0.55), smoothstep(0.1, -0.16, sq.y));
  col = mix(col, sunCol * 1.5, disc * cut);
  col += vec3(1.0, 0.18, 0.5) * exp(-sr * sr * 22.0) * 0.32 * step(d.z, 0.0);
  // far skyline: a layered silhouette on the horizon with lit windows
  float az = atan(d.x, -d.z);
  float h1 = 0.015 + 0.055 * hash(vec2(floor(az * 26.0), 3.0)) + 0.03 * hash(vec2(floor(az * 71.0), 9.0));
  float sil = step(e, h1) * step(-0.04, e);
  vec2 wp = vec2(az * 260.0, e * 900.0);
  float win = step(0.84, hash(floor(wp))) * step(0.55, fract(wp.y)) * step(0.35, fract(wp.x));
  vec3 city = vec3(0.012, 0.01, 0.03) + win * mix(vec3(0.1, 0.9, 1.0), vec3(1.0, 0.3, 0.8), step(0.5, hash(floor(wp) + 3.0))) * 0.9;
  col = mix(col, city, sil);
  // alarm
  vec3 al = vec3(0.12, 0.0, 0.02) + vec3(0.9, 0.05, 0.1) * smoothstep(0.4, 0.0, abs(e)) * 0.4;
  col = mix(col, al + col * 0.18, uAlert * 0.85);
  col *= 1.0 - uDim * 0.35;
  gl_FragColor = vec4(col, 1.0);
}`;

const FINAL = {
  uniforms: {tDiffuse: {value: null}, uTime: {value: 0}, uAb: {value: 0.00025}, uGrain: {value: 0.03}, uVig: {value: 0.5}, uScan: {value: 0.05}, uGlitch: {value: 0}, uRes: {value: new THREE.Vector2(1, 1)}},
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uAb, uGrain, uVig, uScan, uGlitch; uniform vec2 uRes; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      // glitch: a few horizontal bands slide sideways, brief and rare
      float band = floor(uv.y * 26.0 + floor(uTime * 24.0));
      float g = step(0.86, hash(vec2(band, floor(uTime * 24.0)))) * uGlitch;
      uv.x += g * (hash(vec2(band, 3.0)) - 0.5) * 0.06;
      vec2 c = uv - 0.5; float r = dot(c, c);
      vec2 ab = c * (uAb * 10.0 * (0.5 + r * 3.0)) + vec2(g * 0.01, 0.0);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + ab).r; col.g = texture2D(tDiffuse, uv).g; col.b = texture2D(tDiffuse, uv - ab).b;
      col *= 1.0 - uScan * (0.5 + 0.5 * sin(uv.y * uRes.y * 1.5));
      col *= 1.0 - uVig * smoothstep(0.12, 0.7, r * 1.9);
      col += (hash(uv * uRes + fract(uTime) * 61.0) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

const GRID_FRAG = `
  varying vec3 vW; uniform vec3 uA, uB; uniform float uAlpha, uTime; uniform vec3 uCam;
  float line(float v, float w){ float a = abs(fract(v - 0.5) - 0.5) / fwidth(v); return 1.0 - min(a / w, 1.0); }
  void main(){
    vec2 g = vW.xz;
    float minor = max(line(g.x * 0.5, 0.9), line(g.y * 0.5, 0.9));
    float major = max(line(g.x / 4.0, 1.4), line(g.y / 4.0, 1.4));
    float d = length(vW - uCam);
    float fade = exp(-d * 0.022);
    float pulse = 0.65 + 0.35 * sin(vW.z * 0.25 - uTime * 2.2);
    vec3 col = mix(uA, uB, smoothstep(-3.0, 3.0, vW.x));
    float a = (minor * 0.5 + major * 1.0) * fade * uAlpha * pulse;
    gl_FragColor = vec4(col * (1.0 + major * 1.3), a);
  }`;

const TOWER_VERT = `
  attribute vec3 aDim; attribute float aSeed; varying vec3 vObj; varying vec3 vN; varying float vSeed; varying float vDepth; varying vec3 vDim; varying float vWorldY;
  void main(){
    vObj = position * aDim; vN = normal; vSeed = aSeed; vDim = aDim;
    vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vWorldY = w.y;
    vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv;
  }`;
const TOWER_FRAG = `
  varying vec3 vObj; varying vec3 vN; varying float vSeed; varying float vDepth; varying vec3 vDim; varying float vWorldY;
  uniform float uTime, uAlert, uFogFar, uMirror; uniform vec3 uFog;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main(){
    bool side = abs(vN.x) > 0.5;
    float u = side ? vObj.z : vObj.x; float v = vObj.y + vDim.y * 0.5;
    vec2 cell = vec2(floor(u / 0.55 + 100.0), floor(v / 0.62));
    vec2 f = vec2(fract(u / 0.55), fract(v / 0.62));
    float on = step(0.88, hash(cell + vSeed * 50.0 + (side ? 11.0 : 0.0))) * step(0.18, f.x) * step(f.x, 0.72) * step(0.22, f.y) * step(f.y, 0.68);
    on *= step(abs(vN.y), 0.5);
    float flick = step(0.985, hash(cell + floor(uTime * 1.5))) ;
    float h = hash(cell.yx + vSeed * 9.0);
    vec3 wc = h < 0.4 ? vec3(0.1, 0.9, 1.0) : h < 0.7 ? vec3(1.0, 0.2, 0.75) : h < 0.9 ? vec3(1.0, 0.7, 0.2) : vec3(0.85, 0.95, 1.0);
    wc = mix(wc, vec3(1.0, 0.12, 0.2), uAlert * 0.85);
    vec3 base = vec3(0.012, 0.016, 0.04) + vec3(0.02, 0.06, 0.1) * smoothstep(0.0, 1.0, v / vDim.y) * 0.4;
    // rim light on the top and sides facing the corridor
    float rim = step(vDim.y - 0.12, v) * step(0.5, abs(vN.y));
    vec3 col = base + wc * on * (0.6 - flick * 0.35) + mix(vec3(0.1, 0.8, 1.0), vec3(1.0, 0.2, 0.7), vSeed) * rim * 0.5;
    float fog = 1.0 - exp(-vDepth * vDepth / (uFogFar * uFogFar));
    col = mix(col, uFog, clamp(fog, 0.0, 1.0));
    float a = uMirror > 0.5 ? 1.0 : 1.0;
    gl_FragColor = vec4(col, a);
  }`;

const CHROME_FRAG = `
  varying vec2 vUv; uniform sampler2D uMask, uHeight; uniform float uOpacity, uTime, uAlert; uniform vec2 uTexel;
  void main(){
    float m = texture2D(uMask, vUv).r;
    if (m < 0.02) discard;
    float e = 1.6 * uTexel.x * 2.0;
    float hx = texture2D(uHeight, vUv + vec2(e, 0.0)).r - texture2D(uHeight, vUv - vec2(e, 0.0)).r;
    float hy = texture2D(uHeight, vUv + vec2(0.0, e)).r - texture2D(uHeight, vUv - vec2(0.0, e)).r;
    float h = texture2D(uHeight, vUv).r;
    vec3 n = normalize(vec3(-hx * 7.5, -hy * 7.5, 0.55));
    vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
    float t = r.y * 0.5 + 0.5;
    vec3 c = mix(vec3(0.01, 0.0, 0.06), vec3(0.22, 0.04, 0.5), smoothstep(0.0, 0.55, t));
    c += exp(-pow((t - 0.5) * 11.0, 2.0)) * vec3(1.9, 1.5, 2.1);
    c += vec3(1.0, 0.16, 0.62) * smoothstep(0.46, 0.0, t) * 1.5;
    c += vec3(0.05, 0.85, 1.0) * smoothstep(0.54, 1.0, t) * 0.9;
    c += vec3(0.4, 0.9, 1.0) * pow(max(n.x, 0.0), 2.0) * 1.4;
    float edge = smoothstep(0.7, 0.2, h);
    c += vec3(1.0, 0.9, 1.0) * edge * 0.55;
    c = mix(c, vec3(1.4, 0.12, 0.2) * (0.4 + c), uAlert * 0.6);
    c = min(c, vec3(1.25)) * 0.8;
    float a = smoothstep(0.3, 0.62, m) * uOpacity;
    gl_FragColor = vec4(c, a);
  }`;

/* ── Textures ────────────────────────────────────────────── */

const fontsReady = () => Promise.all([document.fonts?.load('italic 700 120px "Chakra Petch"'), document.fonts?.load('500 40px "Geist Mono Variable"'), document.fonts?.ready]).catch(() => {});

function textMaps(text, {size = 330, w = 2400, h = 560, italic = true} = {}) {
  const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const sharp = mk(), soft = mk();
  const font = `${italic ? 'italic ' : ''}700 ${size}px "Chakra Petch", "Arial Black", sans-serif`;
  const gs = sharp.getContext('2d');
  gs.fillStyle = '#000'; gs.fillRect(0, 0, w, h); gs.font = font; gs.textAlign = 'center'; gs.textBaseline = 'middle'; gs.fillStyle = '#fff';
  gs.fillText(text, w / 2, h / 2 + size * 0.04);
  const g2 = soft.getContext('2d');
  g2.fillStyle = '#000'; g2.fillRect(0, 0, w, h);
  g2.filter = `blur(${Math.round(size * 0.035)}px)`; g2.drawImage(sharp, 0, 0);
  const t1 = new THREE.CanvasTexture(sharp), t2 = new THREE.CanvasTexture(soft);
  for (const t of [t1, t2]) { t.anisotropy = 4; t.colorSpace = THREE.NoColorSpace; }
  return {mask: t1, height: t2, aspect: w / h};
}

function drawPassport() {
  const W = 1280, H = 806;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0b1530'); bg.addColorStop(0.6, '#070b1c'); bg.addColorStop(1, '#060814');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(25, 230, 255, 0.07)'; g.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  const glow = g.createRadialGradient(W - 190, 190, 10, W - 190, 190, 520);
  glow.addColorStop(0, 'rgba(25, 230, 255, 0.32)'); glow.addColorStop(1, 'rgba(25, 230, 255, 0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#19e6ff'; g.lineWidth = 6; g.strokeRect(22, 22, W - 44, H - 44);
  g.fillStyle = '#19e6ff'; for (const [x, y] of [[22, 22], [W - 22, 22], [22, H - 22], [W - 22, H - 22]]) g.fillRect(x - 14, y - 14, 28, 28);
  g.strokeStyle = '#e8f4ff'; g.lineWidth = 15; g.beginPath(); g.arc(W - 190, 190, 76, 0, PI * 2); g.stroke();
  g.fillStyle = '#2dff9a'; g.beginPath(); g.arc(W - 190, 190, 22, 0, PI * 2); g.fill();
  const mono = (px, w = 500) => `${w} ${px}px "Geist Mono Variable", ui-monospace, monospace`;
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#62e8ff'; g.font = mono(27); g.fillText('SIGILANT // AGENT PASSPORT', 84, 118);
  g.fillStyle = '#f2fbff'; g.font = '700 112px "Chakra Petch", sans-serif'; g.fillText('RESEARCH-BOT', 80, 290);
  g.font = mono(33); g.fillStyle = '#9db8cc';
  g.fillText('OPERATOR   ACME INC.', 84, 390); g.fillText('SCOPES     read_file · web.search', 84, 438); g.fillText('ERC-8004   eip155:84532 · #10353', 84, 486);
  g.fillStyle = 'rgba(45, 255, 154, 0.16)'; g.fillRect(84, 540, 220, 58); g.strokeStyle = '#2dff9a'; g.lineWidth = 2; g.strokeRect(84, 540, 220, 58);
  g.fillStyle = '#2dff9a'; g.beginPath(); g.arc(118, 569, 9, 0, PI * 2); g.fill();
  g.fillStyle = '#7dffbf'; g.font = mono(26, 600); g.fillText('ACTIVE', 144, 578);
  const seed = [7, 3, 9, 2, 8, 4, 6, 1, 9, 5, 3, 8, 2, 7, 4, 9, 6, 2, 8, 3, 7, 5, 1, 9];
  g.fillStyle = '#e8f4ff'; seed.forEach((v, i) => g.fillRect(84 + i * 22, 690, 8 + (v % 3) * 3, 40 + v * 3));
  g.fillStyle = '#62e8ff'; g.font = mono(24); g.fillText('ed25519  8f3a·91c2·77de·0b4e', 650, 722);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/* ── The city ────────────────────────────────────────────── */

export function createCity(canvas, {onDecision, onFrame, reduced = false, small = false} = {}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
  scene.add(camera);
  const FOG = new THREE.Color(0x14052a);

  /* Sky: a fullscreen triangle that reads the camera ray, so the horizon and sun stay put as the camera flies. */
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, depthTest: false, depthWrite: false,
    uniforms: {uInvProj: {value: new THREE.Matrix4()}, uCamWorld: {value: new THREE.Matrix4()}, uTime: {value: 0}, uAlert: {value: 0}, uDim: {value: 0}},
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat); sky.frustumCulled = false; sky.renderOrder = -1000;
  scene.add(sky);

  const world = new THREE.Group(); scene.add(world);

  /* Floor + mirror. The floor is a translucent veil with a neon grid; below it a mirrored copy of the city shows through. */
  const gridMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, extensions: {derivatives: true},
    uniforms: {uA: {value: C.cyan.clone()}, uB: {value: C.magenta.clone()}, uAlpha: {value: 0.9}, uTime: {value: 0}, uCam: {value: new THREE.Vector3()}},
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: GRID_FRAG,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), gridMat);
  floor.rotation.x = -PI / 2; floor.position.set(0, FLOOR_Y, -80); floor.renderOrder = -300;
  const veilMat = new THREE.MeshBasicMaterial({color: 0x07031a, transparent: true, opacity: 0.55, depthWrite: false});
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), veilMat);
  veil.rotation.x = -PI / 2; veil.position.set(0, FLOOR_Y + 0.005, -80); veil.renderOrder = -350;
  world.add(veil, floor);

  const city = new THREE.Group(); world.add(city);                 // everything that reflects
  const mirror = new THREE.Group(); mirror.scale.y = -1; mirror.position.y = 2 * FLOOR_Y; world.add(mirror);
  const both = obj => { city.add(obj); const m = obj.clone(); mirror.add(m); return m; };

  /* Towers: instanced boxes along the canyon, windows drawn in the fragment shader. */
  const towerCount = small ? 70 : 110;
  const towerGeo = new THREE.BoxGeometry(1, 1, 1);
  const dims = new Float32Array(towerCount * 3), seeds = new Float32Array(towerCount);
  const towerMat = new THREE.ShaderMaterial({
    vertexShader: TOWER_VERT, fragmentShader: TOWER_FRAG,
    uniforms: {uTime: {value: 0}, uAlert: {value: 0}, uFogFar: {value: 46}, uFog: {value: FOG.clone()}, uMirror: {value: 0}},
  });
  const towers = new THREE.InstancedMesh(towerGeo, towerMat, towerCount);
  const dm = new THREE.Object3D();
  for (let i = 0; i < towerCount; i++) {
    const side = i % 2 ? 1 : -1, w = rand(1.6, 3.8), d = rand(1.6, 3.8), h = rand(3, 9) * (i > towerCount * 0.5 ? rand(1.3, 2.8) : 1);
    const z = 5 - (i / towerCount) * 122 + rand(-2, 2), x = side * (rand(8.6, 11.5) + (i % 5 === 0 ? rand(2, 8) : 0));
    dm.position.set(x, FLOOR_Y + h / 2, z); dm.scale.set(w, h, d); dm.updateMatrix(); towers.setMatrixAt(i, dm.matrix);
    dims[i * 3] = w; dims[i * 3 + 1] = h; dims[i * 3 + 2] = d; seeds[i] = Math.random();
  }
  towerGeo.setAttribute('aDim', new THREE.InstancedBufferAttribute(dims, 3));
  towerGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  const mirrorTowers = both(towers);

  /* Runway lights along both edges of the corridor, with a chase running toward the gate. */
  const RUN = small ? 40 : 64;
  const runMat = new THREE.MeshBasicMaterial({color: 0xffffff});
  const runGeo = new THREE.BoxGeometry(0.1, 0.04, 0.9);
  const runL = new THREE.InstancedMesh(runGeo, runMat, RUN), runR = new THREE.InstancedMesh(runGeo, runMat, RUN);
  for (let i = 0; i < RUN; i++) { dm.rotation.set(0, 0, 0); dm.scale.setScalar(1); dm.position.set(-4.4, FLOOR_Y + 0.03, 3 - i * 2.0); dm.updateMatrix(); runL.setMatrixAt(i, dm.matrix); dm.position.x = 4.4; dm.updateMatrix(); runR.setMatrixAt(i, dm.matrix); }
  runL.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(RUN * 3), 3); runR.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(RUN * 3), 3);
  city.add(runL, runR);

  /* Echo gates: neon rings receding down the corridor. The first is the real gate (with its iris). */
  const neonMat = (col, k = 2.4) => new THREE.MeshBasicMaterial({color: col.clone().multiplyScalar(k)});
  const echoMats = [];
  const echo = new THREE.Group(); city.add(echo);
  for (let i = 1; i <= 8; i++) {
    const m = neonMat(i % 2 ? C.cyan : C.magenta, 1.2); echoMats.push(m);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.04, 8, 140), m); ring.position.set(0, FLOOR_Y + 4.2 * 0.9, -4 - i * 13);
    echo.add(ring);
  }

  /* The gate */
  const R = 1.55;
  const gate = new THREE.Group(); gate.position.y = 0; world.add(gate);
  const ringMat = new THREE.MeshBasicMaterial({color: C.green.clone().multiplyScalar(1.1)});
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.1, 24, 220), ringMat);
  const metal = new THREE.MeshStandardMaterial({color: 0x0b1224, metalness: 0.9, roughness: 0.28});
  const housing = new THREE.Mesh(new THREE.TorusGeometry(R, 0.17, 20, 220), metal); housing.scale.z = 0.7; housing.position.z = -0.02;
  const coreMat = new THREE.MeshBasicMaterial({color: C.green.clone().multiplyScalar(2.6)});
  const core = new THREE.Mesh(new THREE.TorusGeometry(R - 0.12, 0.018, 12, 220), coreMat);
  const arcMat = new THREE.MeshBasicMaterial({color: C.cyan.clone().multiplyScalar(2.2)});
  const arcs = [];
  [[R + 0.34, 0.012, 1.9, 0.5], [R + 0.5, 0.008, 1.1, -0.35], [R + 0.7, 0.012, 2.6, 0.22]].forEach(([r, t, len, sp], i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 120, len), arcMat); m.userData = {sp, off: i * 2.1}; arcs.push(m); gate.add(m);
  });
  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.014, 0.014, 0.12), new THREE.MeshBasicMaterial({color: C.cyan.clone().multiplyScalar(1.6)}), 120);
  for (let i = 0; i < 120; i++) { const a = (i / 120) * PI * 2, long = i % 10 === 0; dm.position.set(Math.cos(a) * (R + 0.95), Math.sin(a) * (R + 0.95), 0); dm.rotation.set(0, 0, 0); dm.scale.set(long ? 1.6 : 1, long ? 1.6 : 1, long ? 2 : 0.8); dm.updateMatrix(); ticks.setMatrixAt(i, dm.matrix); }
  const glowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {uColor: {value: C.green.clone()}, uAmount: {value: 0.4}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform vec3 uColor; uniform float uAmount; void main(){ float r = length(vUv - 0.5) * 2.0; float band = exp(-pow((r - 0.45) * 5.5, 2.0)); float inner = smoothstep(0.45, 0.0, r) * 0.08; gl_FragColor = vec4(uColor * (band * 0.7 + inner) * uAmount, 1.0); }',
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), glowMat); glow.position.z = -0.3;
  gate.add(ring, housing, core, ticks, glow);
  // stand: two legs and a base plate so the ring reads as an installation
  const legMat = new THREE.MeshStandardMaterial({color: 0x0b1224, metalness: 0.8, roughness: 0.35});
  const leg = x => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 0.14), legMat); l.position.set(x, -R - 0.2, 0); gate.add(l); };
  leg(-0.9); leg(0.9);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 1.3), legMat); plate.position.set(0, FLOOR_Y + 0.04 - gate.position.y, 0); gate.add(plate);
  const plateEdge = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.012, 1.3), neonMat(C.cyan, 1.4)); plateEdge.position.set(0, FLOOR_Y + 0.085, 0); gate.add(plateEdge);

  const BLADES = 10, blades = [], RB = R - 0.12;
  const half = RB * Math.sin(PI / BLADES) * 1.22;
  const bladeMat = new THREE.MeshStandardMaterial({color: 0x10182b, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide});
  const bladeGeo = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, -1)]));
  for (let i = 0; i < BLADES; i++) {
    const a = (i / BLADES) * PI * 2, g = new THREE.Group();
    g.position.set(Math.cos(a) * RB, Math.sin(a) * RB, -0.01 + i * 0.0016); g.add(new THREE.Mesh(bladeGeo, bladeMat)); g.userData.a = a; gate.add(g); blades.push(g);
  }
  const irisBack = new THREE.Mesh(new THREE.CircleGeometry(R - 0.1, 64), new THREE.MeshBasicMaterial({color: 0x120208, transparent: true, opacity: 0, depthWrite: false}));
  irisBack.position.z = -0.03; gate.add(irisBack);
  const mirrorGate = gate.clone(); mirror.add(mirrorGate);

  // lights for the metal parts
  scene.add(new THREE.HemisphereLight(0x6a8cff, 0x2a0a40, 0.9));
  const key = new THREE.PointLight(0x19e6ff, 40, 30, 1.6); key.position.set(-3, 2.5, 4); scene.add(key);
  const rim = new THREE.PointLight(0xff2fa6, 40, 30, 1.6); rim.position.set(3.5, 1.5, -2); scene.add(rim);

  /* Passport and its scan beam */
  const cardGroup = new THREE.Group();
  const CW = 1.7, CH = CW / 1.588;
  const cardGeo = new THREE.ShapeGeometry(roundedRect(CW, CH, 0.06), 12);
  const uv = cardGeo.attributes.uv, pos = cardGeo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + CW / 2) / CW, (pos.getY(i) + CH / 2) / CH);
  const cardMat = new THREE.MeshBasicMaterial({transparent: true, toneMapped: false});
  const cardBack = new THREE.MeshBasicMaterial({color: 0x050914, transparent: true, side: THREE.BackSide});
  const cardFront = new THREE.Mesh(cardGeo, cardMat);
  const cardEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.ShapeGeometry(roundedRect(CW, CH, 0.06), 12)), new THREE.LineBasicMaterial({color: C.cyan.clone().multiplyScalar(2.2)}));
  const scanMat = new THREE.MeshBasicMaterial({color: C.cyan.clone().multiplyScalar(3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending});
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(CW * 1.12, 0.018), scanMat);
  const scanWash = new THREE.Mesh(new THREE.PlaneGeometry(CW, 0.3), new THREE.MeshBasicMaterial({color: C.cyan.clone().multiplyScalar(0.7), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending}));
  cardGroup.add(cardFront, new THREE.Mesh(cardGeo, cardBack), cardEdge, scan, scanWash); city.add(cardGroup);
  fontsReady().then(() => { cardMat.map = drawPassport(); cardMat.needsUpdate = true; });

  /* Chrome wordmarks */
  const chromes = [];
  function makeChrome(text, width, y, z, opts) {
    const maps = textMaps(text, opts);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {uMask: {value: maps.mask}, uHeight: {value: maps.height}, uOpacity: {value: 0}, uTime: {value: 0}, uAlert: {value: 0}, uTexel: {value: new THREE.Vector2(1 / 2400, 1 / 560)}},
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: CHROME_FRAG,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / maps.aspect), mat);
    mesh.position.set(0, y, z); mesh.renderOrder = -200; world.add(mesh);
    chromes.push({mesh, mat}); return {mesh, mat};
  }
  let wordHero = null, wordCta = null;
  fontsReady().then(() => {
    wordHero = makeChrome('SIGILANT', 14.5, 3.35, -9);
    wordCta = makeChrome('KNOW YOUR AGENT', 22, 5.4, -108, {size: 270});
  });

  /* Calls */
  const COUNT = small ? 44 : 70;
  const capsuleGeo = new THREE.CapsuleGeometry(0.03, 0.2, 4, 10); capsuleGeo.rotateX(PI / 2);
  const calls = new THREE.InstancedMesh(capsuleGeo, new THREE.MeshBasicMaterial({}), COUNT);
  calls.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 3), 3);
  city.add(calls);
  const state = {mix: [...STAGES[0].mix]};
  const parts = Array.from({length: COUNT}, () => ({}));
  const pick = () => { const [a, k, d] = state.mix; const r = Math.random() * (a + k + d || 1); return r < a ? 'allow' : r < a + k ? 'ask' : 'deny'; };
  function spawn(p, far = true) {
    const r = Math.sqrt(Math.random()) * (R - 0.45), a = Math.random() * PI * 2;
    p.x = Math.cos(a) * r; p.y = Math.sin(a) * r; p.z = far ? rand(0.5, 4.4) : rand(4, 5);
    p.vx = p.vy = 0; p.vz = rand(1.2, 2.0); p.phase = 'in'; p.t = 0; p.scale = 1; p.fate = pick(); p.kind = 'neutral';
  }
  parts.forEach(p => spawn(p));

  /* Ledger: a chain of blocks that recedes into the corridor */
  const CHAIN = 16;
  const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), new THREE.MeshBasicMaterial({}), CHAIN);
  blocks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CHAIN * 3), 3);
  const edges = new THREE.InstancedMesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), new THREE.MeshBasicMaterial({color: 0x04060f}), CHAIN);
  const slots = Array.from({length: CHAIN}, (_, i) => new THREE.Vector3(Math.sin(i * 0.5) * 0.1, -0.05 * i, -2.4 - i * 0.78));
  const chainLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(slots), new THREE.LineBasicMaterial({color: C.cyan.clone().multiplyScalar(1.6), transparent: true, opacity: 0.6}));
  city.add(chainLine, edges, blocks);
  const ledger = Array.from({length: CHAIN}, () => 'neutral');
  let pulse = 0, flash = 0, glitch = 0, shake = 0, alertNow = 0;
  const pushLedger = kind => { ledger.unshift(kind); ledger.pop(); pulse = 1; };
  const resolveCall = (p, kind) => { p.kind = kind; flash = 1; onDecision?.(kind); if (kind === 'deny' && glitch < 0.05 && (alertNow > 0.4 || Math.random() < 0.04)) { glitch = 0.75; shake = 0.35; } };

  /* Traffic: light streaks along the corridor lanes, the page's sense of speed */
  const STREAKS = small ? 50 : 90;
  const streakMat = new THREE.MeshBasicMaterial({});
  const streaks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.03, 1), streakMat, STREAKS);
  streaks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(STREAKS * 3), 3);
  const sd = Array.from({length: STREAKS}, () => ({x: 0, y: 0, z: 0, v: 0, len: 1, c: 0}));
  const lanes = [C.cyan, C.magenta, C.green, C.amber];
  sd.forEach(s => { s.x = (Math.random() < 0.5 ? -1 : 1) * rand(1.2, 4.2); s.y = FLOOR_Y + rand(0.15, 3.4); s.z = rand(-110, 2); s.v = rand(7, 20); s.len = rand(0.8, 3.2); s.c = Math.floor(rand(0, 4)); });
  city.add(streaks);

  /* Post stack */
  const rt = new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: small ? 0 : 4});
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.55, 0.55, 1.05);
  composer.addPass(bloom);
  const finalPass = new ShaderPass(FINAL); composer.addPass(finalPass);
  composer.addPass(new OutputPass());
  let usePost = true;

  /* Rig */
  const clone = o => JSON.parse(JSON.stringify(o));
  const cur = clone(STAGES[0]), target = clone(STAGES[0]);
  const pointer = {x: 0, y: 0, sx: 0, sy: 0};
  let override = null, stage = 0, velocity = 0, introT = 0, introOn = false, portrait = false;

  function aim(f) {
    const i = Math.min(Math.max(Math.floor(f), 0), STAGES.length - 2);
    const t = smooth(Math.min(Math.max(f - i, 0), 1));
    const a = STAGES[i], b = STAGES[i + 1];
    for (const k of NUM) target[k] = lerp(a[k], b[k], t);
    for (const k of ZONE) target.zone[k] = lerp(a.zone[k], b.zone[k], t);
    target.mix = a.mix.map((v, j) => lerp(v, b.mix[j], t));
    target.card = {p: a.card.p.map((v, j) => lerp(v, b.card.p[j], t)), tilt: lerp(a.card.tilt, b.card.tilt, t), rx: lerp(a.card.rx, b.card.rx, t), s: lerp(a.card.s, b.card.s, t), o: lerp(a.card.o, b.card.o, t)};
  }
  aim(0);

  let width = 1, height = 1;
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    if (w === width && h === height && renderer.domElement.width) return;
    width = w; height = h;
    const dpr = renderer.getPixelRatio();
    renderer.setSize(w, h, false); composer.setSize(w, h); composer.setPixelRatio(dpr);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    finalPass.uniforms.uRes.value.set(w * dpr, h * dpr);
    portrait = w / h < 0.85;
  }

  const sph = new THREE.Spherical(), cp = new THREE.Vector3(), tmp = new THREE.Vector3(), look = new THREE.Vector3();
  let dist = 8;
  function placeCamera(time) {
    const fov = 34 + Math.min(1, velocity) * 5;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; }
    const half = THREE.MathUtils.degToRad(camera.fov / 2), t = Math.tan(half), aspect = width / height;
    let z = cur.zone;
    if (portrait) z = cur.zone.w > 0.9 ? {cx: 0.5, cy: 0.5, w: 1, h: 1} : {cx: 0.5, cy: 0.27, w: 0.92, h: 0.36};
    dist = Math.max(cur.r / (z.h * t), cur.r / (z.w * aspect * t)) * (portrait && z.w <= 0.95 ? 1.0 : 1);
    look.set(cur.lx, cur.ly, cur.lz);
    sph.set(dist, PI / 2 - cur.el - pointer.sy * 0.035, cur.az + pointer.sx * 0.07); // theta 0 puts the camera on the +z side, looking toward -z
    cp.setFromSpherical(sph).add(look);
    cp.x += Math.sin(time * 41) * shake * 0.03; cp.y += Math.cos(time * 53) * shake * 0.03;
    camera.position.copy(cp); camera.lookAt(look);
    camera.updateProjectionMatrix();
    camera.setViewOffset(width, height, -(z.cx - 0.5) * width, -(z.cy - 0.5) * height, width, height);
  }

  const anchors = {};
  function project(name, v, space) { tmp.copy(v); space.localToWorld(tmp); tmp.project(camera); anchors[name] = {x: (tmp.x * 0.5 + 0.5) * width, y: (-tmp.y * 0.5 + 0.5) * height, on: tmp.z < 1 && tmp.z > -1}; }
  const gateAnchor = new THREE.Vector3(Math.cos(0.72) * (R + 0.1), Math.sin(0.72) * (R + 0.1), 0);

  const clock = new THREE.Clock();
  let raf = 0, running = false, time = 0, frames = 0;

  function step(dt) {
    time += dt;
    if (introOn) introT = Math.min(1, introT + dt / 2.6);
    const intro = smooth(introT);
    const k = 1 - Math.pow(0.0007, dt);
    for (const key of NUM) if (key !== 'closed') cur[key] += (target[key] - cur[key]) * k;
    for (const key of ZONE) cur.zone[key] += (target.zone[key] - cur.zone[key]) * k;
    for (let i = 0; i < 3; i++) cur.card.p[i] += (target.card.p[i] - cur.card.p[i]) * k;
    for (const key of ['tilt', 'rx', 's', 'o']) cur.card[key] += (target.card[key] - cur.card[key]) * k;
    state.mix = target.mix;
    const wantClosed = override === 'closed' ? 1 : override === 'open' ? 0 : target.closed;
    cur.closed += (wantClosed - cur.closed) * (1 - Math.pow(0.004, dt));
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.pow(0.004, dt));
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.pow(0.004, dt));
    velocity *= Math.pow(0.02, dt);
    pulse = Math.max(0, pulse - dt * 2.4); flash = Math.max(0, flash - dt * 3); glitch = Math.max(0, glitch - dt * 4.5); shake = Math.max(0, shake - dt * 4);
    const closed = cur.closed;
    const alert = Math.max(cur.alert, closed > 0.5 ? (closed - 0.5) * 2 : 0); alertNow = alert;

    // palette: tone of the gate and the city follows allow/alert
    const tone = C.green.clone().lerp(C.red, smooth(Math.min(closed * 1.2, 1)));
    ringMat.color.copy(tone).multiplyScalar(1.3 + flash * 1.2); coreMat.color.copy(tone).multiplyScalar(2.8 + flash * 2);
    glowMat.uniforms.uColor.value.copy(tone); glowMat.uniforms.uAmount.value = 0.4 + flash * 0.5 + closed * 0.3;
    arcMat.color.copy(C.cyan).lerp(C.red, smooth(closed)).multiplyScalar(2.2);
    echoMats.forEach((m, i) => m.color.copy(i % 2 ? C.cyan : C.magenta).lerp(C.red, alert).multiplyScalar(1.2));
    key.color.copy(C.cyan).lerp(C.red, alert); rim.color.copy(C.magenta).lerp(C.red, alert * 0.6);
    gridMat.uniforms.uA.value.copy(C.cyan).lerp(C.red, alert); gridMat.uniforms.uB.value.copy(C.magenta).lerp(C.red, alert * 0.7);
    gridMat.uniforms.uTime.value = time; gridMat.uniforms.uCam.value.copy(camera.position);
    towerMat.uniforms.uTime.value = time; towerMat.uniforms.uAlert.value = alert;
    FOG.set(0x14052a).lerp(new THREE.Color(0x2a0208), alert); towerMat.uniforms.uFog.value.copy(FOG);
    skyMat.uniforms.uTime.value = time; skyMat.uniforms.uAlert.value = alert; skyMat.uniforms.uDim.value = cur.dim;
    chromes.forEach((c, i) => { c.mat.uniforms.uTime.value = time; c.mat.uniforms.uAlert.value = alert; c.mat.uniforms.uOpacity.value = (i === 0 ? cur.word : cur.word2) * (0.4 + 0.6 * intro); });
    veilMat.opacity = 0.5 + cur.dim * 0.15;

    // intro: the gate assembles
    gate.scale.setScalar(0.8 + 0.2 * intro); gate.rotation.z = (1 - intro) * 1.0; mirrorGate.scale.copy(gate.scale);
    arcs.forEach(a => { a.rotation.z = time * a.userData.sp * (1 + velocity * 3) + a.userData.off; });
    ticks.rotation.z = -time * 0.03 * (1 + velocity * 3);
    mirrorGate.children.forEach((c, i) => { if (gate.children[i]) { c.rotation.copy(gate.children[i].rotation); c.visible = gate.children[i].visible; if (c.scale && gate.children[i].scale) c.scale.copy(gate.children[i].scale); } });
    blades.forEach(g => { g.children[0].scale.y = Math.max(0.0001, closed * (RB + 0.04)); g.rotation.z = g.userData.a - PI / 2 + closed * 0.5; g.visible = closed > 0.01; });
    irisBack.material.opacity = smooth(Math.max(0, (closed - 0.5) / 0.5));

    // runway chase
    const tc = new THREE.Color();
    for (let i = 0; i < RUN; i++) {
      const wave = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(i * 0.5 + time * 6), 3);
      tc.copy(C.cyan).lerp(C.red, alert).multiplyScalar(0.4 + wave * 2.2 * Math.max(0.2, 1 - i / RUN)); runL.setColorAt(i, tc); tc.copy(C.magenta).lerp(C.red, alert).multiplyScalar(0.4 + wave * 2.2 * Math.max(0.2, 1 - i / RUN)); runR.setColorAt(i, tc);
    }
    runL.instanceColor.needsUpdate = true; runR.instanceColor.needsUpdate = true;

    // traffic
    for (let i = 0; i < STREAKS; i++) {
      const s = sd[i];
      s.z += s.v * dt * (1 + velocity * 5);
      if (s.z > 3) { s.z = -112; s.x = (Math.random() < 0.5 ? -1 : 1) * rand(1.2, 4.2); s.y = FLOOR_Y + rand(0.15, 3.4); }
      dm.position.set(s.x, s.y, s.z); dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, s.len * (1 + velocity * 4)); dm.updateMatrix(); streaks.setMatrixAt(i, dm.matrix);
      tc.copy(lanes[s.c]).lerp(C.red, alert).multiplyScalar(1.6); streaks.setColorAt(i, tc);
    }
    streaks.instanceMatrix.needsUpdate = true; streaks.instanceColor.needsUpdate = true;

    // calls
    for (let i = 0; i < COUNT; i++) {
      const p = parts[i];
      if (p.phase === 'in') {
        p.z -= p.vz * dt * (1 + velocity * 0.6);
        if (p.z <= 0.12) {
          const fate = closed > 0.55 ? 'deny' : p.fate;
          if (fate === 'allow') { p.phase = 'pass'; resolveCall(p, 'allow'); p.vz = rand(2.4, 3.2); }
          else if (fate === 'deny') { p.phase = 'bounce'; p.t = 0; resolveCall(p, 'deny'); pushLedger('deny'); const a = Math.random() * PI * 2; p.vx = Math.cos(a) * rand(0.7, 1.7); p.vy = Math.sin(a) * rand(0.7, 1.7); p.vz = -rand(1.4, 2.4); }
          else { p.phase = 'hold'; p.t = 0; p.z = 0.3; p.kind = 'ask'; flash = 0.6; }
        }
      } else if (p.phase === 'hold') {
        p.t += dt; p.z = 0.3 + Math.sin(p.t * 5) * 0.015;
        if (p.t > 1.5) {
          if (closed < 0.5 && Math.random() < 0.72) { p.phase = 'pass'; resolveCall(p, 'allow'); p.vz = 2.6; }
          else { p.phase = 'bounce'; p.t = 0; resolveCall(p, 'deny'); pushLedger('deny'); p.vx = rand(-1.2, 1.2); p.vy = rand(-1.2, 1.2); p.vz = -1.8; }
        }
      } else if (p.phase === 'pass') {
        p.z -= p.vz * dt; p.x *= 1 - dt * 0.35; p.y *= 1 - dt * 0.35;
        if (p.z < -2.0) { p.phase = 'log'; p.t = 0; }
      } else if (p.phase === 'log') {
        p.t += dt * 2.2; const s = slots[0];
        p.x += (s.x - p.x) * Math.min(1, dt * 6); p.y += (s.y - p.y) * Math.min(1, dt * 6); p.z += (s.z - p.z) * Math.min(1, dt * 5);
        p.scale = Math.max(0, 1 - p.t);
        if (p.t >= 1) { pushLedger('allow'); spawn(p, false); }
      } else if (p.phase === 'bounce') {
        p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z -= p.vz * dt; p.scale = Math.max(0, 1 - p.t * 1.1);
        if (p.t > 0.95) spawn(p, false);
      }
      const fadeIn = p.phase === 'in' ? smooth(Math.min(Math.max((4.6 - p.z) / 1.4, 0), 1)) : 1;
      dm.position.set(p.x, p.y, p.z); dm.rotation.set(0, 0, 0);
      dm.scale.set(1, 1, 1 + Math.min(1.8, velocity * 2.2)).multiplyScalar(Math.max(p.scale * fadeIn, 0.0001) * (p.phase === 'hold' ? 1.3 : 1)); dm.updateMatrix();
      calls.setMatrixAt(i, dm.matrix); calls.setColorAt(i, HOT[p.kind]);
    }
    calls.instanceMatrix.needsUpdate = true; calls.instanceColor.needsUpdate = true;

    for (let i = 0; i < CHAIN; i++) {
      blocks.setColorAt(i, LEDGER[ledger[i]]);
      dm.position.copy(slots[i]); dm.rotation.set(0, time * 0.15 + i * 0.4, 0);
      dm.scale.setScalar(Math.max(0.0001, (0.55 + (1 - i / CHAIN) * 0.45) * (i === 0 ? 1 + pulse * 0.35 : 1) * cur.ledger)); dm.updateMatrix(); blocks.setMatrixAt(i, dm.matrix); edges.setMatrixAt(i, dm.matrix);
    }
    blocks.instanceMatrix.needsUpdate = true; blocks.instanceColor.needsUpdate = true; edges.instanceMatrix.needsUpdate = true;
    chainLine.visible = cur.ledger > 0.08; chainLine.material.opacity = 0.6 * cur.ledger;

    // passport and its scan
    const c = cur.card;
    cardGroup.position.set(c.p[0], c.p[1] + Math.sin(time * 0.9) * 0.05, c.p[2]);
    cardGroup.rotation.set(c.rx + Math.sin(time * 0.6) * 0.02 + pointer.sy * 0.05, cur.az + c.tilt + pointer.sx * 0.1, Math.sin(time * 0.5) * 0.012);
    cardGroup.scale.setScalar(c.s * (0.86 + 0.14 * intro)); cardGroup.visible = c.o > 0.02;
    cardMat.opacity = c.o; cardBack.opacity = c.o; cardEdge.material.opacity = c.o;
    const sp = (time * 0.55) % 1;
    scan.position.y = (sp - 0.5) * CH * 1.05; scanWash.position.y = scan.position.y - 0.12; scan.position.z = scanWash.position.z = 0.01;
    scanMat.opacity = c.o * (cur.card.o > 0.5 ? 1 : 0) * 0.9; scanWash.material.opacity = scanMat.opacity * 0.5;

    // bloom and glitch
    bloom.strength = 0.55 + flash * 0.2 + alert * 0.2;
    finalPass.uniforms.uTime.value = time; finalPass.uniforms.uGlitch.value = glitch * (0.35 + alert * 0.65);
    finalPass.uniforms.uAb.value = 0.00025 + Math.min(1, velocity) * 0.003 + glitch * 0.003;
    renderer.toneMappingExposure = 1.05 * (1 - cur.dim * 0.15);
  }

  function draw() {
    placeCamera(time);
    skyMat.uniforms.uInvProj.value.copy(camera.projectionMatrixInverse); skyMat.uniforms.uCamWorld.value.copy(camera.matrixWorld);
    if (usePost) composer.render(); else renderer.render(scene, camera);
    camera.updateMatrixWorld();
    project('card', cardGroup.position, city); project('gate', gateAnchor, gate); project('ledger', slots[3], city);
    onFrame?.(anchors, {stage, closed: cur.closed, alert: cur.alert});
  }

  let ema = 0.016, quality = 'high';
  const lockHigh = new URLSearchParams(location.search).get('q') === 'high';
  function downgrade() { quality = 'lite'; usePost = false; renderer.setPixelRatio(1); width = 0; resize(); }
  function frame() {
    if (!running) return;
    const raw = clock.getDelta();
    ema = ema * 0.92 + raw * 0.08; frames++;
    if (quality === 'high' && !lockHigh && frames > 24 && ema > 0.05) downgrade();
    step(Math.min(raw, 0.05)); draw();
    raf = requestAnimationFrame(frame);
  }
  const start = () => { if (reduced || running) return; running = true; clock.getDelta(); raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  const onVisibility = () => (document.hidden ? stop() : start());
  const onPointer = e => { pointer.x = (e.clientX / innerWidth - 0.5) * 2; pointer.y = (e.clientY / innerHeight - 0.5) * 2; };
  const ro = new ResizeObserver(() => { resize(); if (!running) draw(); });
  ro.observe(canvas);
  document.addEventListener('visibilitychange', onVisibility);
  addEventListener('pointermove', onPointer, {passive: true});
  resize(); introT = 1;
  if (reduced) { for (let i = 0; i < 260; i++) step(0.03); draw(); } else start();

  return {
    setStage(f) {
      stage = f; aim(f);
      if (reduced) { for (const key of NUM) cur[key] = target[key]; for (const key of ZONE) cur.zone[key] = target.zone[key]; cur.card = clone(target.card); step(0.016); draw(); }
    },
    intro() { introT = 0; introOn = true; },
    setVelocity(v) { velocity = Math.max(velocity, Math.min(1.5, v)); },
    settle(n = 60) { for (let i = 0; i < n; i++) step(0.05); introT = 1; draw(); },
    setIris(mode) { override = mode; },
    destroy() {
      stop(); ro.disconnect(); document.removeEventListener('visibilitychange', onVisibility); removeEventListener('pointermove', onPointer);
      scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { x.map?.dispose?.(); x.uniforms?.uMask?.value?.dispose?.(); x.uniforms?.uHeight?.value?.dispose?.(); x.dispose(); }); });
      composer.dispose(); renderer.dispose();
    },
  };
}
