import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';

/*
 * The world. One WebGL canvas for the whole page: a flowing aurora background (shader), a drafting
 * grid floor, and the instrument: a glass gate with a mechanical iris, gyroscopic rings with orbiting
 * agents, a passport, a stream of verdicts and a hash-linked ledger. A post stack (bloom, depth-of-field
 * falloff, chromatic aberration, grain) unifies it. Scroll drives the camera, the iris and night mode
 * through STAGES. DOM callouts are pinned to anchors this module projects every frame.
 */

const PI = Math.PI;
const COLORS = {
  neutral: new THREE.Color(0x5f6b65),
  allow: new THREE.Color(0x1fcf8e),
  ask: new THREE.Color(0xf0a81c),
  deny: new THREE.Color(0xf0502f),
};
const LEDGER = {neutral: new THREE.Color(0x56635d), allow: new THREE.Color(0x2fc58a), deny: new THREE.Color(0xe9553a)};

const HIDDEN = {p: [-3.6, 0.2, -3.2], tilt: 0.4, rx: 0, s: 0.7, o: 0};
// Each stage frames a bounding radius `r` around `look` inside the subject zone, so the subject always fits
// its zone and never reaches the copy column. az/el orbit it; `closed` is the iris; `dark` is night mode;
// `opacity` dissolves the instrument; `ledger` shows the chain.
const STAGES = [
  /* 0 hero      */ {az: PI + 0.78, el: 0.2, r: 3.05, lx: -0.1, ly: -0.1, lz: 0.5, closed: 0, dark: 0, opacity: 1, ledger: 1, mix: [0.6, 0.2, 0.2], card: {p: [-1.4, -0.7, -1.2], tilt: 0.22, rx: -0.05, s: 0.72, o: 1}},
  /* 1 identify  */ {az: PI + 0.32, el: 0.08, r: 1.85, lx: 0.05, ly: 0.28, lz: -1.3, closed: 0, dark: 0, opacity: 1, ledger: 0, mix: [0.5, 0.2, 0.3], card: {p: [0.1, 0.35, -1.4], tilt: -0.28, rx: 0.08, s: 1.05, o: 1}},
  /* 2 decide    */ {az: PI + 0.1, el: 0.06, r: 2.15, lx: 0, ly: 0, lz: 0, closed: 0, dark: 0, opacity: 1, ledger: 0, mix: [0.45, 0.25, 0.3], card: {...HIDDEN}},
  /* 3 prove     */ {az: PI + 1.05, el: 0.22, r: 3.6, lx: 0, ly: -0.1, lz: 3.0, closed: 0, dark: 0, opacity: 1, ledger: 1, mix: [0.75, 0.05, 0.2], card: {...HIDDEN}},
  /* 4 contain   */ {az: PI + 0.12, el: 0.06, r: 2.15, lx: 0, ly: 0, lz: 0, closed: 1, dark: 1, opacity: 1, ledger: 0.7, mix: [0, 0, 1], card: {...HIDDEN}},
  /* 5 outro     */ {az: PI + 0.12, el: 0.06, r: 2.6, lx: 0, ly: 0, lz: 0, closed: 1, dark: 0, opacity: 0, ledger: 0, mix: [0, 0, 1], card: {...HIDDEN}},
  /* 6 pre-cta   */ {az: PI + 0.5, el: 0.16, r: 2.9, lx: 0, ly: 0, lz: 0.4, closed: 0, dark: 0, opacity: 0, ledger: 0, mix: [0.9, 0.05, 0.05], card: {...HIDDEN}},
  /* 7 cta       */ {az: PI + 0.5, el: 0.16, r: 2.9, lx: 0, ly: 0, lz: 0.4, closed: 0, dark: 0, opacity: 1, ledger: 0.8, mix: [0.9, 0.05, 0.05], card: {p: [0.05, 0.02, 0.9], tilt: 0.1, rx: 0, s: 0.62, o: 1}},
];
const NUM = ['az', 'el', 'r', 'lx', 'ly', 'lz', 'closed', 'dark', 'opacity', 'ledger'];
const GHOSTS = ['Sigilant', 'Passport', 'Verdict', 'Ledger', 'Revoked'];

const smooth = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const hexLinear = h => new THREE.Color(h);

/* ── Shaders ─────────────────────────────────────────────── */

const BG_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }';
const BG_FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime, uDark, uAspect, uReveal;
uniform vec2 uMouse, uZone;
uniform vec3 uL0, uL1, uL2, uL3, uD0, uD1, uD2, uD3;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p = p * 2.03 + vec2(17.0, 9.0); a *= 0.5; } return v; }
vec3 palette(vec2 p, float t, vec3 c0, vec3 c1, vec3 c2, vec3 c3){
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  float n = fbm(p + 2.2 * q + vec2(0.0, t));
  vec3 c = mix(c0, c1, smoothstep(0.25, 0.78, n));
  c = mix(c, c2, smoothstep(0.38, 0.82, fbm(p * 0.8 + q + vec2(3.0, 8.0))) * 0.9);
  c = mix(c, c3, smoothstep(0.4, 0.88, fbm(p * 0.7 - q + vec2(-4.0, 2.0))) * 0.75);
  return c;
}
void main(){
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0) * 1.5;
  float t = uTime * 0.04;
  vec3 light = palette(p, t, uL0, uL1, uL2, uL3);
  vec3 dark = palette(p * 1.1, t * 1.2, uD0, uD1, uD2, uD3);
  vec3 col = mix(light, dark, uDark);
  // a soft pool of light behind the subject
  float zd = length((uv - uZone) * vec2(uAspect, 1.0));
  col += mix(vec3(0.085, 0.10, 0.09), vec3(0.015, 0.075, 0.05), uDark) * exp(-zd * zd * 5.0) * uReveal;
  // light that follows the pointer
  float md = length((uv - uMouse) * vec2(uAspect, 1.0));
  col += mix(vec3(0.045, 0.06, 0.05), vec3(0.015, 0.06, 0.045), uDark) * exp(-md * md * 9.0);
  gl_FragColor = vec4(col, 1.0);
}`;

const FINAL = {
  uniforms: {tDiffuse: {value: null}, uTime: {value: 0}, uAb: {value: 0.0016}, uGrain: {value: 0.028}, uVig: {value: 0.32}, uBlur: {value: 2.4}, uFocus: {value: new THREE.Vector2(0.7, 0.5)}, uFocusR: {value: 0.34}, uRes: {value: new THREE.Vector2(1, 1)}, uAspect: {value: 1.6}},
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uAb, uGrain, uVig, uBlur, uFocusR, uAspect; uniform vec2 uFocus, uRes; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float r = dot(c, c);
      // tilt-shift style falloff: sharp around the subject, softer toward the edges
      float d = length((vUv - uFocus) * vec2(uAspect, 1.0));
      float blur = smoothstep(uFocusR, uFocusR + 0.55, d) * uBlur;
      vec2 px = blur / uRes;
      vec3 acc = vec3(0.0); float wsum = 0.0;
      for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) {
        float w = 1.0 / (1.0 + float(i * i + j * j));
        vec2 o = vec2(float(i), float(j)) * px;
        acc += texture2D(tDiffuse, vUv + o).rgb * w; wsum += w;
      }
      vec3 col = acc / wsum;
      vec2 ab = c * r * uAb * 12.0;
      col.r = mix(col.r, texture2D(tDiffuse, vUv + ab).r, 0.85);
      col.b = mix(col.b, texture2D(tDiffuse, vUv - ab).b, 0.85);
      col *= 1.0 - uVig * smoothstep(0.18, 0.62, r * 1.9);
      col += (hash(vUv * uRes + fract(uTime) * 61.0) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

const GRID_FRAG = `
  varying vec3 vW; uniform vec3 uColor; uniform float uAlpha; uniform vec2 uCenter;
  float line(float v, float w){ float a = abs(fract(v - 0.5) - 0.5) / fwidth(v); return 1.0 - min(a / w, 1.0); }
  void main(){
    vec2 g = vW.xz;
    float minor = max(line(g.x, 0.9), line(g.y, 0.9));
    float major = max(line(g.x / 5.0, 1.3), line(g.y / 5.0, 1.3));
    float d = length(g - uCenter);
    float fade = smoothstep(26.0, 3.0, d);
    float a = (minor * 0.32 + major * 0.7) * fade * uAlpha;
    gl_FragColor = vec4(uColor, a);
  }`;

/* ── Textures ────────────────────────────────────────────── */

const fontReady = () => (document.fonts?.ready ?? Promise.resolve());

/** The passport face, drawn once to a canvas. */
function drawPassport() {
  const W = 1280, H = 806;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#16231d'); bg.addColorStop(0.6, '#0d1512'); bg.addColorStop(1, '#0a1210');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W - 190, 190, 10, W - 190, 190, 520);
  glow.addColorStop(0, 'rgba(31, 207, 142, 0.3)'); glow.addColorStop(1, 'rgba(31, 207, 142, 0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  g.lineWidth = 1.2;
  for (let k = 0; k < 46; k++) {
    g.beginPath(); g.strokeStyle = `rgba(160, 235, 205, ${0.05 + (k % 5) * 0.012})`;
    for (let x = 0; x <= W; x += 6) {
      const y = H * 0.66 + Math.sin(x * 0.011 + k * 0.22) * (46 + k * 2.6) + Math.sin(x * 0.027 - k * 0.15) * 14 - k * 4;
      x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }
  g.strokeStyle = '#eaf6f0'; g.lineWidth = 15;
  g.beginPath(); g.arc(W - 190, 190, 76, 0, PI * 2); g.stroke();
  g.fillStyle = '#1fcf8e'; g.beginPath(); g.arc(W - 190, 190, 22, 0, PI * 2); g.fill();
  const mono = (px, w = 500) => `${w} ${px}px "Geist Mono Variable", ui-monospace, monospace`;
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#8fa89d'; g.font = mono(28); g.fillText('SIGILANT  ·  AGENT PASSPORT', 80, 112);
  g.fillStyle = '#eef7f2'; g.font = '400 118px "Instrument Serif", Georgia, serif'; g.fillText('research-bot', 80, 300);
  g.font = mono(34); g.fillStyle = '#b9ccc3';
  g.fillText('OPERATOR   Acme Inc.', 80, 392);
  g.fillText('SCOPES     read_file · web.search', 80, 440);
  g.fillText('ERC-8004   eip155:84532 · #10353', 80, 488);
  g.fillStyle = 'rgba(31, 207, 142, 0.18)'; g.beginPath(); g.roundRect(80, 540, 210, 58, 29); g.fill();
  g.fillStyle = '#1fcf8e'; g.beginPath(); g.arc(114, 569, 9, 0, PI * 2); g.fill();
  g.fillStyle = '#7ff0c0'; g.font = mono(26, 600); g.fillText('ACTIVE', 140, 578);
  const seed = [7, 3, 9, 2, 8, 4, 6, 1, 9, 5, 3, 8, 2, 7, 4, 9, 6, 2, 8, 3, 7, 5, 1, 9];
  g.fillStyle = '#eaf6f0';
  seed.forEach((v, i) => g.fillRect(80 + i * 22, 690, 8 + (v % 3) * 3, 40 + v * 3));
  g.fillStyle = '#8fa89d'; g.font = mono(24); g.fillText('ed25519  8f3a·91c2·77de·0b4e', 650, 722);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}

/** Outlined, italic serif word for the ghost layer. Returns the texture and its aspect ratio. */
function drawGhost(word) {
  const size = 440, pad = 40;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `italic 400 ${size}px "Instrument Serif", Georgia, serif`;
  const w = Math.ceil(probe.measureText(word).width) + pad * 2, h = Math.ceil(size * 1.25);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.font = `italic 400 ${size}px "Instrument Serif", Georgia, serif`;
  g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.lineWidth = 3.4; g.strokeStyle = '#fff';
  g.strokeText(word, pad, size * 0.95);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.generateMipmaps = true;
  return {tex, aspect: w / h};
}

function makeEnvironment(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(
    new THREE.SphereGeometry(40, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP;
        void main(){
          float h = vP.y * 0.5 + 0.5;
          vec3 low = vec3(0.10, 0.17, 0.14), mid = vec3(0.42, 0.55, 0.50), high = vec3(0.55, 0.70, 0.78);
          vec3 c = mix(low, mid, smoothstep(0.0, 0.5, h)); c = mix(c, high, smoothstep(0.5, 1.0, h));
          c += vec3(0.10, 0.04, 0.12) * smoothstep(0.65, 0.2, abs(vP.x - 0.2)) * smoothstep(0.2, 0.7, h);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  ));
  const panel = (w, h, pos, color, intensity) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide}));
    m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
  };
  panel(14, 3, [0, 14, 4], 0xffffff, 6); panel(3, 12, [-14, 3, 2], 0xfff1e0, 5); panel(3, 12, [14, 2, -4], 0xd6f4ff, 5);
  panel(10, 2, [0, -6, 12], 0xffd9f0, 2.4); panel(6, 6, [-6, 6, -14], 0xcfffe6, 3.2);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.02).texture;
  pm.dispose();
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

/* ── The world ───────────────────────────────────────────── */

export function createWorld(canvas, {onDecision, onFrame, reduced = false, small = false} = {}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, powerPreference: 'high-performance'});
  const maxDpr = small ? 1.5 : 1.75;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const envTexture = makeEnvironment(renderer);
  scene.environment = envTexture;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);
  scene.add(camera);
  scene.fog = new THREE.Fog(0xdfe9e1, 8, 22);

  /* Background: aurora shader on a fullscreen triangle, always behind everything. */
  const bgMat = new THREE.ShaderMaterial({
    vertexShader: BG_VERT, fragmentShader: BG_FRAG, depthTest: false, depthWrite: false, fog: false,
    uniforms: {
      uTime: {value: 0}, uDark: {value: 0}, uAspect: {value: 1.6}, uReveal: {value: 0}, uMouse: {value: new THREE.Vector2(0.7, 0.5)}, uZone: {value: new THREE.Vector2(0.7, 0.5)},
      uL0: {value: hexLinear(0xe6eee7)}, uL1: {value: hexLinear(0xc2ebd6)}, uL2: {value: hexLinear(0xd6d0f4)}, uL3: {value: hexLinear(0xf7dcc9)},
      uD0: {value: hexLinear(0x050c09)}, uD1: {value: hexLinear(0x0b4733)}, uD2: {value: hexLinear(0x16254d)}, uD3: {value: hexLinear(0x34172a)},
    },
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bg.frustumCulled = false; bg.renderOrder = -1000;
  scene.add(bg);

  const world = new THREE.Group();
  scene.add(world);
  const instrument = new THREE.Group();   // everything that dissolves in and out
  world.add(instrument);

  /* Ghost words ride the camera, far behind the subject. */
  const ghostGroup = new THREE.Group();
  camera.add(ghostGroup);
  const ghosts = [];
  const ghostMats = [];
  fontReady().then(() => {
    GHOSTS.forEach((word, i) => {
      const {tex, aspect} = drawGhost(word);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: false,
        uniforms: {uMap: {value: tex}, uOpacity: {value: 0}, uColor: {value: new THREE.Color(0x0a0f0d)}},
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'varying vec2 vUv; uniform sampler2D uMap; uniform float uOpacity; uniform vec3 uColor; void main(){ float a = texture2D(uMap, vUv).a * smoothstep(0.02, 0.5, vUv.x) * uOpacity; gl_FragColor = vec4(uColor, a); }',
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(aspect, 1), mat);
      mesh.renderOrder = -500; ghostGroup.add(mesh); ghosts[i] = {mesh, aspect}; ghostMats[i] = mat;
    });
  });

  /* Floor: a drafting grid that fades to the horizon, with a pool of gate-coloured light on it. */
  const FLOOR_Y = -3.3;
  const gridMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, extensions: {derivatives: true},
    uniforms: {uColor: {value: new THREE.Color(0x10281f)}, uAlpha: {value: 0.55}, uCenter: {value: new THREE.Vector2(0, 0)}},
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: GRID_FRAG,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), gridMat);
  floor.rotation.x = -PI / 2; floor.position.y = FLOOR_Y; floor.renderOrder = -400;
  instrument.add(floor);
  const poolMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: THREE.NormalBlending,
    uniforms: {uColor: {value: new THREE.Color(COLORS.allow)}, uAmount: {value: 0.3}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform vec3 uColor; uniform float uAmount; void main(){ float r = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(uColor, exp(-r * r * 3.2) * uAmount); }',
  });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), poolMat);
  pool.rotation.x = -PI / 2; pool.position.y = FLOOR_Y + 0.01; pool.renderOrder = -390;
  instrument.add(pool);

  /* Gate: glass ring with a mechanical iris */
  const R = 1.55;
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xf4fffa, metalness: 0, roughness: 0.02, transmission: 1, thickness: 0.8, ior: 1.5, dispersion: small ? 0 : 0.6,
    iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [120, 620], clearcoat: 1, clearcoatRoughness: 0.03,
    envMapIntensity: 1.5, attenuationColor: new THREE.Color(0xb6f0d6), attenuationDistance: 3.2,
  });
  const gate = new THREE.Group(); instrument.add(gate);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.17, 64, 220), glass);
  gate.add(ring);
  const coreMat = new THREE.MeshBasicMaterial({color: COLORS.allow.clone().multiplyScalar(2.1)});
  gate.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.026, 16, 220), coreMat));

  const bladeMat = new THREE.MeshStandardMaterial({color: 0x1d2924, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide});
  const BLADES = 10, blades = [], RB = R - 0.17;
  const half = RB * Math.sin(PI / BLADES) * 1.22;
  const bladeGeo = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, -1)]));
  for (let i = 0; i < BLADES; i++) {
    const a = (i / BLADES) * PI * 2, g = new THREE.Group();
    g.position.set(Math.cos(a) * RB, Math.sin(a) * RB, -0.012 + i * 0.0016);
    g.add(new THREE.Mesh(bladeGeo, bladeMat)); g.userData.a = a; gate.add(g); blades.push(g);
  }
  const irisBack = new THREE.Mesh(new THREE.CircleGeometry(R - 0.12, 64), new THREE.MeshBasicMaterial({color: 0x060b09, transparent: true, opacity: 0, depthWrite: false}));
  irisBack.position.z = -0.02; gate.add(irisBack);
  const membraneMat = new THREE.MeshBasicMaterial({color: COLORS.deny, transparent: true, opacity: 0, depthWrite: false});
  const membrane = new THREE.Mesh(new THREE.CircleGeometry(R - 0.1, 96), membraneMat);
  membrane.position.z = 0.02; gate.add(membrane);
  const glowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: {uColor: {value: new THREE.Color(COLORS.allow)}, uAmount: {value: 0.2}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform vec3 uColor; uniform float uAmount; void main(){ float r = length(vUv - 0.5) * 2.0; float band = exp(-pow((r - 0.5) * 6.0, 2.0)); float inner = smoothstep(0.5, 0.0, r) * 0.1; gl_FragColor = vec4(uColor, (band * 0.55 + inner) * uAmount); }',
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), glowMat);
  glow.position.z = -0.4; gate.add(glow);

  /* Gyro: two thin rings on different axes with beads orbiting, the other agents queueing. */
  const gyro = new THREE.Group(); instrument.add(gyro);
  const gyroMat = new THREE.MeshBasicMaterial({color: 0x24372f, transparent: true, opacity: 0.55});
  const mkRing = (r, tube, rx, ry) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 12, 200), gyroMat); const g = new THREE.Group(); g.rotation.set(rx, ry, 0); g.add(m); gyro.add(g); return {g, r}; };
  const gA = mkRing(2.02, 0.016, 1.25, 0.2), gB = mkRing(2.6, 0.011, 0.55, 0.95);
  const beadMat = new THREE.MeshBasicMaterial({color: COLORS.allow.clone().multiplyScalar(2.4)});
  const beads = [];
  [[gA, 0], [gA, 2.6], [gB, 1.2], [gB, 4.1]].forEach(([ringRef, phase]) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), beadMat); ringRef.g.add(b); beads.push({b, r: ringRef.r, phase, speed: ringRef === gA ? 0.34 : -0.22});
  });

  /* Blueprint: dashed construction circles, crosshair, dial */
  const dashMat = new THREE.LineDashedMaterial({color: 0x10201a, dashSize: 0.07, gapSize: 0.07, transparent: true, opacity: 0.38});
  const circle = r => { const pts = []; for (let i = 0; i <= 160; i++) { const a = (i / 160) * PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); } const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), dashMat); l.computeLineDistances(); return l; };
  const cross = (a, b) => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]), dashMat); l.computeLineDistances(); return l; };
  const blueprint = new THREE.Group();
  blueprint.add(circle(2.28), circle(3.05), cross([-4.2, 0, 0], [4.2, 0, 0]), cross([0, -4.2, 0], [0, 4.2, 0]));
  instrument.add(blueprint);
  const tickMat = new THREE.MeshBasicMaterial({color: 0x10201a});
  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.012, 0.1), tickMat, 120);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * PI * 2, long = i % 10 === 0;
    dummy.position.set(Math.cos(a) * 2.28, Math.sin(a) * 2.28, 0); dummy.scale.set(long ? 1.6 : 1, long ? 1.6 : 1, long ? 1.8 : 0.8); dummy.updateMatrix(); ticks.setMatrixAt(i, dummy.matrix);
  }
  instrument.add(ticks);

  /* Dust */
  const DUST = small ? 240 : 560;
  const dustGeo = new THREE.BufferGeometry(), dp = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) { dp[i * 3] = rand(-9, 9); dp[i * 3 + 1] = rand(-3, 5); dp[i * 3 + 2] = rand(-7, 12); }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dustMat = new THREE.PointsMaterial({color: 0x0f2a20, size: 0.03, transparent: true, opacity: 0.4, depthWrite: false, sizeAttenuation: true});
  const dust = new THREE.Points(dustGeo, dustMat); instrument.add(dust);

  /* Passport */
  const cardGroup = new THREE.Group();
  const CW = 1.7, CH = CW / 1.588;
  const cardGeo = new THREE.ShapeGeometry(roundedRect(CW, CH, 0.1), 16);
  const uv = cardGeo.attributes.uv, pos = cardGeo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + CW / 2) / CW, (pos.getY(i) + CH / 2) / CH);
  const cardMat = new THREE.MeshPhysicalMaterial({roughness: 0.55, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.2, iridescence: 0.25, iridescenceIOR: 1.3, iridescenceThicknessRange: [200, 600], transparent: true, envMapIntensity: 0.35, emissive: 0xffffff, emissiveIntensity: 0.7});
  const backMat = new THREE.MeshStandardMaterial({color: 0x0f1512, roughness: 0.35, metalness: 0.6, transparent: true});
  const back = new THREE.Mesh(cardGeo, backMat); back.rotation.y = PI; back.position.z = -0.012;
  const slab = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(CW - 0.01, CH - 0.01, 0.1), {depth: 0.01, bevelEnabled: false}), backMat); slab.position.z = -0.011;
  cardGroup.add(new THREE.Mesh(cardGeo, cardMat), back, slab);
  instrument.add(cardGroup);
  fontReady().then(() => { cardMat.map = drawPassport(); cardMat.emissiveMap = cardMat.map; cardMat.needsUpdate = true; });

  /* Calls: unlit, so they can glow */
  const COUNT = small ? 40 : 64;
  const capsuleGeo = new THREE.CapsuleGeometry(0.034, 0.16, 4, 10); capsuleGeo.rotateX(PI / 2);
  const calls = new THREE.InstancedMesh(capsuleGeo, new THREE.MeshBasicMaterial({}), COUNT);
  calls.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 3), 3);
  instrument.add(calls);
  const state = {mix: [...STAGES[0].mix]};
  const parts = Array.from({length: COUNT}, () => ({}));
  const pick = () => { const [a, k, d] = state.mix; const r = Math.random() * (a + k + d || 1); return r < a ? 'allow' : r < a + k ? 'ask' : 'deny'; };
  const HOT = {neutral: COLORS.neutral.clone(), allow: COLORS.allow.clone().multiplyScalar(1.8), ask: COLORS.ask.clone().multiplyScalar(1.7), deny: COLORS.deny.clone().multiplyScalar(1.7)};
  function spawn(p, far = true) {
    const r = Math.sqrt(Math.random()) * (R - 0.45), a = Math.random() * PI * 2;
    p.x = Math.cos(a) * r; p.y = Math.sin(a) * r; p.z = far ? rand(-3.6, -0.5) : rand(-3.8, -3);
    p.vx = p.vy = 0; p.vz = rand(1.2, 2.0); p.phase = 'in'; p.t = 0; p.scale = 1; p.fate = pick(); p.kind = 'neutral';
  }
  parts.forEach(p => spawn(p));

  /* Ledger */
  const CHAIN = 14;
  const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshPhysicalMaterial({color: 0xffffff, roughness: 0.18, metalness: 0.25, clearcoat: 1, envMapIntensity: 1.3}), CHAIN);
  blocks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CHAIN * 3), 3);
  const slots = Array.from({length: CHAIN}, (_, i) => new THREE.Vector3(Math.sin(i * 0.5) * 0.12, -0.04 * i, 2.35 + i * 0.62));
  const chainLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(slots), new THREE.LineBasicMaterial({color: 0x10201a, transparent: true, opacity: 0.4}));
  instrument.add(chainLine, blocks);
  const ledger = Array.from({length: CHAIN}, () => 'neutral');
  let pulse = 0, flash = 0;
  const pushLedger = kind => { ledger.unshift(kind); ledger.pop(); pulse = 1; };
  const resolveCall = (p, kind) => { p.kind = kind; flash = 1; onDecision?.(kind); };

  /* Post stack */
  const rt = new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: small ? 0 : 4});
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.3, 0.5, 1.15);
  composer.addPass(bloom);
  const finalPass = new ShaderPass(FINAL);
  composer.addPass(finalPass);
  composer.addPass(new OutputPass());
  let usePost = true;

  /* Rig */
  const clone = o => JSON.parse(JSON.stringify(o));
  const cur = clone(STAGES[0]), target = clone(STAGES[0]);
  const pointer = {x: 0, y: 0, sx: 0, sy: 0, ux: 0.7, uy: 0.5};
  let override = null, stage = 0, velocity = 0, introT = 0, introOn = false;

  function aim(f) {
    const i = Math.min(Math.max(Math.floor(f), 0), STAGES.length - 2);
    const t = smooth(Math.min(Math.max(f - i, 0), 1));
    const a = STAGES[i], b = STAGES[i + 1];
    for (const k of NUM) target[k] = lerp(a[k], b[k], t);
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
    bgMat.uniforms.uAspect.value = w / h; finalPass.uniforms.uAspect.value = w / h; finalPass.uniforms.uRes.value.set(w * dpr, h * dpr);
  }

  let zone = {cx: 0.7, cy: 0.52, w: 0.44, h: 0.8};
  const sph = new THREE.Spherical(), cp = new THREE.Vector3(), tmp = new THREE.Vector3(), look = new THREE.Vector3();
  const HALF = THREE.MathUtils.degToRad(camera.fov / 2);
  let dist = 8;
  function placeCamera() {
    const t = Math.tan(HALF), aspect = width / height;
    dist = Math.max(cur.r / (zone.h * t), cur.r / (zone.w * aspect * t));
    look.set(cur.lx, cur.ly, cur.lz);
    sph.set(dist, PI / 2 - cur.el - pointer.sy * 0.04, cur.az + pointer.sx * 0.08);
    cp.setFromSpherical(sph).add(look); camera.position.copy(cp); camera.lookAt(look);
    camera.setViewOffset(width, height, -(zone.cx - 0.5) * width, -(zone.cy - 0.5) * height, width, height);
    // ghost words: far behind, right-aligned to the edge of the screen, vertically centred on the subject
    const gz = 30, vh = 2 * gz * t, vw = vh * aspect;
    ghosts.forEach(gh => {
      if (!gh) return;
      const h = vh * 0.3;
      gh.mesh.scale.set(gh.aspect * h, h, 1);
      gh.mesh.position.set((1.02 - zone.cx) * vw - gh.aspect * h * 0.5 + pointer.sx * 0.5, pointer.sy * -0.3, -gz);
    });
  }

  const anchors = {};
  function project(name, v) { tmp.copy(v); instrument.localToWorld(tmp); tmp.project(camera); anchors[name] = {x: (tmp.x * 0.5 + 0.5) * width, y: (-tmp.y * 0.5 + 0.5) * height, on: tmp.z < 1}; }
  const gateAnchor = new THREE.Vector3(Math.cos(0.72) * R, Math.sin(0.72) * R, 0);

  const clock = new THREE.Clock();
  let raf = 0, running = false, time = 0, frames = 0;

  function step(dt) {
    time += dt;
    if (introOn) introT = Math.min(1, introT + dt / 2.4);
    const intro = smooth(introT);
    const k = 1 - Math.pow(0.0007, dt);
    for (const key of NUM) if (key !== 'closed') cur[key] += (target[key] - cur[key]) * k;
    for (let i = 0; i < 3; i++) cur.card.p[i] += (target.card.p[i] - cur.card.p[i]) * k;
    for (const key of ['tilt', 'rx', 's', 'o']) cur.card[key] += (target.card[key] - cur.card[key]) * k;
    state.mix = target.mix;
    const wantClosed = override === 'closed' ? 1 : override === 'open' ? 0 : target.closed;
    cur.closed += (wantClosed - cur.closed) * (1 - Math.pow(0.004, dt));
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.pow(0.004, dt));
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.pow(0.004, dt));
    pointer.ux += (pointer.tx - pointer.ux) * (1 - Math.pow(0.002, dt)); pointer.uy += (pointer.ty - pointer.uy) * (1 - Math.pow(0.002, dt));
    velocity *= Math.pow(0.02, dt);
    const closed = cur.closed, night = cur.dark > 0.5;
    const vis = smooth(Math.max(0, Math.min(1, cur.opacity))) * (0.75 + 0.25 * intro) * (introOn ? Math.max(0.0001, intro) : 1);

    // dissolve the instrument by scale; ghost words fade
    instrument.scale.setScalar(Math.max(0.0001, vis)); instrument.visible = vis > 0.01;
    const active = stage > 6 ? 0 : Math.round(stage), ghostOn = (stage < 4.6 || stage > 6.4) && cur.opacity > 0.5;
    ghostMats.forEach((m, i) => { m.uniforms.uOpacity.value += (((i === active && ghostOn) ? 0.24 : 0) - m.uniforms.uOpacity.value) * (1 - Math.pow(0.004, dt)); m.uniforms.uColor.value.set(night ? 0xcfeee0 : 0x0a0f0d); });

    // background
    bgMat.uniforms.uTime.value = time; bgMat.uniforms.uDark.value = cur.dark; bgMat.uniforms.uReveal.value = vis;
    bgMat.uniforms.uMouse.value.set(pointer.ux, 1 - pointer.uy); bgMat.uniforms.uZone.value.set(zone.cx, 1 - zone.cy);
    finalPass.uniforms.uTime.value = time; finalPass.uniforms.uFocus.value.set(zone.cx, 1 - zone.cy);
    finalPass.uniforms.uAb.value = 0.0016 + Math.min(1, velocity) * 0.004;
    bloom.strength = (night ? 0.8 : 0.26) + flash * 0.2; bloom.radius = night ? 0.8 : 0.5;
    scene.fog.color.set(0xdfe9e1).lerp(new THREE.Color(0x050c09), Math.min(1, cur.dark));
    scene.fog.near = dist + 0.2; scene.fog.far = dist + 6.5;

    // gate
    const spin = 1 + Math.min(4, velocity * 5);
    ring.rotation.z = time * 0.04 * spin; ticks.rotation.z = -time * 0.03 * spin; blueprint.rotation.z = time * 0.012;
    gate.scale.setScalar(0.82 + 0.18 * intro); gate.rotation.z = (1 - intro) * 1.2;
    pulse = Math.max(0, pulse - dt * 2.4); flash = Math.max(0, flash - dt * 3);
    const tone = COLORS.allow.clone().lerp(COLORS.deny, smooth(Math.min(closed * 1.2, 1)));
    coreMat.color.copy(tone).multiplyScalar(2.1 + flash * 1.2);
    glowMat.uniforms.uColor.value.copy(tone); glowMat.uniforms.uAmount.value = 0.16 + flash * 0.25 + closed * 0.3;
    poolMat.uniforms.uColor.value.copy(tone); poolMat.uniforms.uAmount.value = (night ? 0.5 : 0.34) + flash * 0.25;
    membraneMat.opacity = smooth(Math.max(0, (closed - 0.55) / 0.45)) * 0.3;
    irisBack.material.opacity = smooth(Math.max(0, (closed - 0.5) / 0.5));
    blades.forEach(g => { g.children[0].scale.y = Math.max(0.0001, closed * (RB + 0.04)); g.rotation.z = g.userData.a - PI / 2 + closed * 0.5; g.visible = closed > 0.01; });

    // gyro + beads
    gA.g.rotation.z = time * 0.18 * spin; gB.g.rotation.z = -time * 0.12 * spin;
    gyroMat.color.set(night ? 0x9fd9bd : 0x24372f);
    beadMat.color.copy(tone).multiplyScalar(2.4);
    beads.forEach(b => { const a = b.phase + time * b.speed * spin; b.b.position.set(Math.cos(a) * b.r, Math.sin(a) * b.r, 0); });
    gyro.visible = true;

    // blueprint colors
    dashMat.opacity = night ? 0.3 : 0.36;
    const ink = night ? 0xbfe9d3 : 0x10201a;
    dashMat.color.set(ink); tickMat.color.set(ink); chainLine.material.color.set(ink);
    chainLine.visible = cur.ledger > 0.08; chainLine.material.opacity = 0.4 * cur.ledger;
    gridMat.uniforms.uColor.value.set(night ? 0x6fd6a8 : 0x10281f); gridMat.uniforms.uAlpha.value = night ? 0.5 : 0.42;
    dust.rotation.y = time * 0.012; dust.position.y = Math.sin(time * 0.2) * 0.12; dustMat.color.set(night ? 0xbfe9d3 : 0x0f2a20);

    // calls
    for (let i = 0; i < COUNT; i++) {
      const p = parts[i];
      if (p.phase === 'in') {
        p.z += p.vz * dt * (1 + velocity);
        if (p.z >= -0.12) {
          const fate = closed > 0.55 ? 'deny' : p.fate;
          if (fate === 'allow') { p.phase = 'pass'; resolveCall(p, 'allow'); p.vz = rand(2.4, 3.2); }
          else if (fate === 'deny') { p.phase = 'bounce'; p.t = 0; resolveCall(p, 'deny'); pushLedger('deny'); const a = Math.random() * PI * 2; p.vx = Math.cos(a) * rand(0.7, 1.7); p.vy = Math.sin(a) * rand(0.7, 1.7); p.vz = -rand(1.4, 2.4); }
          else { p.phase = 'hold'; p.t = 0; p.z = -0.3; p.kind = 'ask'; flash = 0.6; }
        }
      } else if (p.phase === 'hold') {
        p.t += dt; p.z = -0.3 + Math.sin(p.t * 5) * 0.015;
        if (p.t > 1.5) {
          if (closed < 0.5 && Math.random() < 0.72) { p.phase = 'pass'; resolveCall(p, 'allow'); p.vz = 2.6; }
          else { p.phase = 'bounce'; p.t = 0; resolveCall(p, 'deny'); pushLedger('deny'); p.vx = rand(-1.2, 1.2); p.vy = rand(-1.2, 1.2); p.vz = -1.8; }
        }
      } else if (p.phase === 'pass') {
        p.z += p.vz * dt; p.x *= 1 - dt * 0.35; p.y *= 1 - dt * 0.35;
        if (p.z > 2.0) { p.phase = 'log'; p.t = 0; }
      } else if (p.phase === 'log') {
        p.t += dt * 2.2; const s = slots[0];
        p.x += (s.x - p.x) * Math.min(1, dt * 6); p.y += (s.y - p.y) * Math.min(1, dt * 6); p.z += (s.z - p.z) * Math.min(1, dt * 5);
        p.scale = Math.max(0, 1 - p.t);
        if (p.t >= 1) { pushLedger('allow'); spawn(p, false); }
      } else if (p.phase === 'bounce') {
        p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.scale = Math.max(0, 1 - p.t * 1.1);
        if (p.t > 0.95) spawn(p, false);
      }
      const fadeIn = p.phase === 'in' ? smooth(Math.min(Math.max((p.z + 2.8) / 1.2, 0), 1)) : 1;
      const stretch = 1 + Math.min(1.8, velocity * 2.2);
      dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, stretch).multiplyScalar(Math.max(p.scale * fadeIn, 0.0001) * (p.phase === 'hold' ? 1.25 : 1)); dummy.updateMatrix();
      calls.setMatrixAt(i, dummy.matrix); calls.setColorAt(i, HOT[p.kind]);
    }
    calls.instanceMatrix.needsUpdate = true; calls.instanceColor.needsUpdate = true;

    for (let i = 0; i < CHAIN; i++) {
      blocks.setColorAt(i, LEDGER[ledger[i]]);
      dummy.position.copy(slots[i]); dummy.rotation.set(0, time * 0.15 + i * 0.4, 0);
      dummy.scale.setScalar(Math.max(0.0001, (0.55 + (1 - i / CHAIN) * 0.45) * (i === 0 ? 1 + pulse * 0.35 : 1) * cur.ledger)); dummy.updateMatrix(); blocks.setMatrixAt(i, dummy.matrix);
    }
    blocks.instanceMatrix.needsUpdate = true; blocks.instanceColor.needsUpdate = true;

    const c = cur.card;
    cardGroup.position.set(c.p[0], c.p[1] + Math.sin(time * 0.9) * 0.05, c.p[2]);
    cardGroup.rotation.set(c.rx + Math.sin(time * 0.6) * 0.02 + pointer.sy * 0.06, cur.az + c.tilt + pointer.sx * 0.12, Math.sin(time * 0.5) * 0.015);
    cardGroup.scale.setScalar(c.s); cardGroup.visible = c.o > 0.02;
    cardMat.opacity = c.o; backMat.opacity = c.o;
  }

  function draw() {
    placeCamera();
    if (usePost) composer.render(); else renderer.render(scene, camera);
    camera.updateMatrixWorld();
    project('card', cardGroup.position); project('gate', gateAnchor); project('ledger', slots[3]);
    onFrame?.(anchors, {stage, dark: cur.dark, closed: cur.closed, opacity: cur.opacity});
  }

  // Adaptive quality: if frames are slow, drop the post stack and the transmission pass.
  let ema = 0.016, quality = 'high';
  const lockHigh = new URLSearchParams(location.search).get('q') === 'high';
  function downgrade() {
    quality = 'lite'; usePost = false;
    glass.transmission = 0; glass.dispersion = 0; glass.transparent = true; glass.opacity = 0.42; glass.needsUpdate = true;
    renderer.setPixelRatio(1); width = 0; resize();
  }
  function frame() {
    if (!running) return;
    const raw = clock.getDelta();
    ema = ema * 0.92 + raw * 0.08; frames++;
    if (quality === 'high' && !lockHigh && frames > 24 && ema > 0.05) downgrade();
    step(Math.min(raw, 0.05));
    // when the instrument is dissolved, only the background moves: render at half rate
    if (cur.opacity > 0.02 || (frames & 1)) draw();
    raf = requestAnimationFrame(frame);
  }
  const start = () => { if (reduced || running) return; running = true; clock.getDelta(); raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  const onVisibility = () => (document.hidden ? stop() : start());
  pointer.tx = 0.7; pointer.ty = 0.5;
  const onPointer = e => { pointer.x = (e.clientX / innerWidth - 0.5) * 2; pointer.y = (e.clientY / innerHeight - 0.5) * 2; pointer.tx = e.clientX / innerWidth; pointer.ty = e.clientY / innerHeight; };
  const ro = new ResizeObserver(() => { resize(); if (!running) draw(); });
  ro.observe(canvas);
  document.addEventListener('visibilitychange', onVisibility);
  addEventListener('pointermove', onPointer, {passive: true});
  resize();
  introOn = false; introT = 1;
  if (reduced) { for (let i = 0; i < 260; i++) step(0.03); draw(); } else start();

  return {
    setStage(f) {
      stage = f; aim(f);
      if (reduced) { for (const key of NUM) cur[key] = target[key]; cur.card = clone(target.card); step(0.016); draw(); }
    },
    /** Play the entrance: the gate assembles. Call once the preloader lifts. */
    intro() { introT = 0; introOn = true; },
    setZone(z) { zone = {...zone, ...z}; if (!running) draw(); },
    /** Scroll speed, roughly 0 to 1: spins the instrument, stretches the calls, bends the lens. */
    setVelocity(v) { velocity = Math.max(velocity, Math.min(1.5, v)); },
    settle(n = 60) { for (let i = 0; i < n; i++) step(0.05); introT = 1; draw(); },
    setIris(mode) { override = mode; },
    destroy() {
      stop(); ro.disconnect(); document.removeEventListener('visibilitychange', onVisibility); removeEventListener('pointermove', onPointer);
      scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { x.map?.dispose?.(); x.uniforms?.uMap?.value?.dispose?.(); x.dispose(); }); });
      composer.dispose(); envTexture.dispose(); renderer.dispose();
    },
  };
}
