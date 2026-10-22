import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';

import {createSkyEye} from './skyeye.js';
import {AsciiPass} from './ascii.js';

/*
 * 見張り · THE WATCH. One WebGL world for the whole page.
 *
 * A flooded neon canyon at night, and at the end of it, hanging in a vortex of lit cloud, a colossal eye.
 * The page is a single flight toward it. Agent calls arrive as light trails and meet the eye's scan ring
 * hovering over the street, where each gets a verdict: green passes, amber waits for a human, red is thrown
 * back. Every verdict is stamped onto a ledger of blocks running toward the eye. Revocation narrows the eye
 * to a slit and the city goes to alarm red. The finale ends inside the pupil.
 *
 * Convention: the camera sits on the +z side looking toward -z; the scan ring is at the origin.
 */

const PI = Math.PI;
const COL = {
  bone: new THREE.Color(0xd8f6ff), cyan: new THREE.Color(0x19e6ff), mag: new THREE.Color(0xff2fa6), shu: new THREE.Color(0xff3b52),
  ember: new THREE.Color(0xff2fa6), amber: new THREE.Color(0xffb21f), jade: new THREE.Color(0x2dff9a), ash: new THREE.Color(0x5d6b80),
};
const HOT = {neutral: COL.ash.clone().multiplyScalar(1.2), allow: COL.jade.clone().multiplyScalar(2.6), ask: COL.amber.clone().multiplyScalar(2.6), deny: COL.shu.clone().multiplyScalar(3)};
const STAMP = {neutral: new THREE.Color(0x10131f), allow: COL.cyan.clone().multiplyScalar(1.6), deny: COL.shu.clone().multiplyScalar(2)};

const FLOOR_Y = -2.2;
const EYE = [0, 46, -260];              // the eye in the sky: a vast plane far beyond the end of the canyon
const HIDDEN = {p: [-3.4, 0.2, 2.6], tilt: 0.4, rx: 0, s: 0.7, o: 0};
const Z = (cx, cy, w, h) => ({cx, cy, w, h});
// open: lid openness · pupil: fraction of the iris · slit: alert pupil · scan: iris sweep · beam: scan beam · gaze: 0 the viewer, 1 the scan ring
const S = o => ({az: 0, el: 0.08, r: 4, lx: 0, ly: 0, lz: 0, closed: 0, alert: 0, dim: 0, ledger: 0, open: 0.92, pupil: 0.3, slit: 0, scan: 0, beam: 0, gaze: 0, zone: Z(0.66, 0.52, 0.5, 0.8), mix: [0.6, 0.2, 0.2], card: {...HIDDEN}, ...o});

// Each stage frames a bounding radius `r` around `look`, fitted into a screen `zone`. The page owns the other side.
const FULL = Z(0.5, 0.5, 1, 1);
const fly = (lz, az, el, dim = 0.55, extra = {}) => S({az, el, r: 3.6, lx: az * 4, ly: 1.6, lz, zone: FULL, dim, ledger: 1, mix: [0.8, 0.1, 0.1], ...extra});
const eyeShot = (r, zone, extra = {}) => S({az: 0, el: 0, r, lx: EYE[0], ly: EYE[1], lz: EYE[2], zone, ledger: 1, ...extra});
const STAGES = [
  /* 0 watch     */ S({az: 0.0, el: -0.153, r: 81, lx: EYE[0], ly: EYE[1], lz: EYE[2], zone: Z(0.7, 0.33, 1, 1), dim: 0.2, ledger: 1, pupil: 0.32}),
  /* 1 identify  */ S({az: -0.42, el: 0.05, r: 2.1, lx: 0.2, ly: 0.35, lz: 2.0, zone: Z(0.72, 0.5, 0.5, 0.8), mix: [0.5, 0.2, 0.3], card: {p: [0.3, 0.35, 2.6], tilt: -0.3, rx: 0.04, s: 1.45, o: 1}, scan: 1, beam: 1, gaze: 1, pupil: 0.24}),
  /* 2 decide    */ S({az: 0.0, el: 0.16, r: 4.6, lx: 0, ly: 0.9, lz: 0, zone: FULL, dim: 0.55, mix: [0.45, 0.25, 0.3], beam: 1, gaze: 1, scan: 0.6, pupil: 0.26}),
  /* 3 prove     */ S({az: 0.06, el: 0.12, r: 3.2, lx: 0.6, ly: 0.2, lz: -16, zone: Z(0.7, 0.55, 0.56, 0.8), ledger: 1, mix: [0.75, 0.05, 0.2], gaze: 1}),
  /* 4 contain   */ S({az: -0.05, el: 0.04, r: 3.0, lx: 0, ly: 1.6, lz: -30, zone: Z(0.68, 0.5, 0.56, 0.8), closed: 1, alert: 1, ledger: 1, mix: [0, 0, 1], open: 0.5, slit: 1, pupil: 0.2}),
  /* 5 console   */ fly(-40, 0.1, -0.02),
  /* 6 passport  */ fly(-52, -0.1, -0.06),
  /* 7 integrate */ fly(-63, 0.1, -0.1),
  /* 8 cases     */ fly(-73, -0.1, -0.14),
  /* 9 stack     */ fly(-82, 0.06, -0.18),
  /* 10 finale   */ eyeShot(20.5, Z(0.5, 0.45, 1, 1), {dim: 0.3, pupil: 0.6, mix: [0.9, 0.05, 0.05]}),
  /* 11 hold     */ eyeShot(20.5, Z(0.5, 0.45, 1, 1), {dim: 0.3, pupil: 0.6, mix: [0.9, 0.05, 0.05]}),
];
const NUM = ['az', 'el', 'r', 'lx', 'ly', 'lz', 'closed', 'alert', 'dim', 'ledger', 'open', 'pupil', 'slit', 'scan', 'beam', 'gaze'];
const ZONE = ['cx', 'cy', 'w', 'h'];

const smooth = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

/* ── Sky (and its reflection in the flooded plaza) ───────── */

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
    float on = step(0.82, hash(cell + vSeed * 50.0 + (side ? 11.0 : 0.0))) * step(0.18, f.x) * step(f.x, 0.72) * step(0.22, f.y) * step(f.y, 0.68);
    on *= step(abs(vN.y), 0.5);
    float flick = step(0.985, hash(cell + floor(uTime * 1.5))) ;
    float h = hash(cell.yx + vSeed * 9.0);
    vec3 wc = h < 0.4 ? vec3(0.1, 0.9, 1.0) : h < 0.7 ? vec3(1.0, 0.2, 0.75) : h < 0.9 ? vec3(1.0, 0.7, 0.2) : vec3(0.85, 0.95, 1.0);
    wc = mix(wc, vec3(1.0, 0.12, 0.2), uAlert * 0.85);
    // bodies are lit just enough to register in the text-vision lens, so the skyline has mass there too
    vec3 base = vec3(0.016, 0.019, 0.045) + vec3(0.02, 0.06, 0.1) * smoothstep(0.0, 1.0, v / vDim.y) * 0.45;
    // rim light on the top and sides facing the corridor
    float rim = step(vDim.y - 0.12, v) * step(0.5, abs(vN.y));
    float hw = (side ? vDim.z : vDim.x) * 0.5;
    float edge = smoothstep(hw - 0.06, hw, abs(u)) * step(abs(vN.y), 0.5) * step(0.5, fract(vSeed * 7.0));
    float band = step(0.93, fract(v / 3.1 + vSeed)) * step(abs(vN.y), 0.5) * step(0.7, vSeed);
    vec3 neon = mix(vec3(0.1, 0.85, 1.0), vec3(1.0, 0.18, 0.66), step(0.5, fract(vSeed * 13.0)));
    neon = mix(neon, vec3(1.0, 0.12, 0.3), uAlert * 0.85);
    vec3 col = base + wc * on * (0.75 - flick * 0.4) + neon * (rim * 0.6 + edge * 1.4 + band * 0.9);
    float fog = 1.0 - exp(-vDepth * vDepth / (uFogFar * uFogFar));
    col = mix(col, uFog, clamp(fog, 0.0, 1.0));
    float a = uMirror > 0.5 ? 1.0 : 1.0;
    gl_FragColor = vec4(col, a);
  }`;


const SKY_VERT = 'varying vec2 vNdc; void main(){ vNdc = position.xy; gl_Position = vec4(position.xy, 1.0, 1.0); }';
const SKY_FRAG = `
precision highp float;
varying vec2 vNdc;
uniform mat4 uInvProj, uCamWorld;
uniform float uTime, uAlert, uDim, uEyeAng, uEyeOpen;
uniform vec3 uEyeDir;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; } return v; }

vec3 sky(vec3 d, float wet){
  float e = d.y;
  vec3 top = vec3(0.006, 0.01, 0.03), mid = vec3(0.03, 0.06, 0.11), hor = vec3(0.32, 0.07, 0.22);
  vec3 col = mix(hor, mid, smoothstep(0.0, 0.16, e));
  col = mix(col, top, smoothstep(0.12, 0.62, e));
  // smog and cloud bands lit from below by the city
  float cl = fbm(vec2(d.x / (e + 0.25) * 2.2 + uTime * 0.012, e * 9.0));
  col += vec3(0.05, 0.22, 0.3) * smoothstep(0.5, 0.95, cl) * smoothstep(0.35, 0.02, e);
  // milky way band and a synthwave cloud bank sitting on the skyline
  float mw = exp(-pow(dot(d, normalize(vec3(0.35, 0.45, 0.82))) * 4.0, 2.0)) * smoothstep(0.08, 0.5, e);

  float azc = atan(d.x, -d.z);
  float cb = fbm(vec2(azc * 3.2 + uTime * 0.008, e * 13.0));
  float bank = smoothstep(0.42, 0.82, cb) * smoothstep(0.3, 0.03, e) * step(-0.001, e);
  vec3 cloud = mix(vec3(0.42, 0.08, 0.3), vec3(0.04, 0.14, 0.2), smoothstep(0.0, 0.22, e)) * (0.45 + 0.7 * cb);   // smog lit by the city
  col = mix(col, cloud, bank * 0.55);
  // stars
  vec3 sd3 = d * 170.0; vec3 id = floor(sd3); vec3 fd = fract(sd3) - 0.5;
  float sh = hash(id.xy + id.z * 7.0);
  col += vec3(0.75, 0.9, 1.0) * step(0.9968, sh) * smoothstep(0.3, 0.0, length(fd)) * (0.6 + 0.4 * sin(uTime * 2.0 + sh * 90.0)) * smoothstep(0.05, 0.3, e) * 1.5;
  // 見張り: the eye hangs in a slow vortex of cloud, lit from within by its iris
  float ce = clamp(dot(d, uEyeDir), -1.0, 1.0);
  float rr = acos(ce) / uEyeAng;                       // 1 at the eyeball's edge
  vec3 ax = normalize(cross(uEyeDir, vec3(0.0, 1.0, 0.0))), ay = cross(ax, uEyeDir);
  float th = atan(dot(d, ay), dot(d, ax));
  float sw = th + 1.4 / (rr + 0.6) - uTime * 0.025;
  vec2 cp = vec2(cos(sw), sin(sw));
  float vort = fbm(cp * 2.2 + vec2(rr * 0.9, 0.0)) * 0.65 + fbm(cp * 5.0 - vec2(rr * 1.7, uTime * 0.01)) * 0.35;
  float reach = smoothstep(6.0, 1.05, rr) * step(0.0, ce);
  vec3 vlit = mix(vec3(0.95, 0.25, 0.85), vec3(0.15, 0.55, 1.0), smoothstep(1.2, 4.0, rr));
  vlit = mix(vlit, vec3(1.0, 0.12, 0.18), uAlert);
  float vcl = smoothstep(0.42, 0.8, vort) * reach;
  col = mix(col, col * 0.35, smoothstep(0.3, 0.55, vort) * reach * 0.7);   // dark cloud masses
  col += vlit * vcl * (0.12 + 0.3 * uEyeOpen) * smoothstep(5.0, 1.2, rr);
  col += vlit * exp(-pow(max(rr - 1.0, 0.0) * 1.6, 2.0)) * 0.22 * uEyeOpen * reach;  // glow hugging the eye
  // skyline with neon windows
  float az = atan(d.x, -d.z);
  float h1 = 0.012 + 0.075 * pow(hash(vec2(floor(az * 22.0), 1.0)), 2.0) + 0.025 * hash(vec2(floor(az * 61.0), 4.0));
  float h2 = 0.006 + 0.04 * hash(vec2(floor(az * 40.0), 8.0));
  float far = step(e, h2 + 0.022) * step(-0.001, e);
  float near = step(e, h1) * step(-0.001, e);
  col = mix(col, mix(col, vec3(0.05, 0.015, 0.1), 0.7), far);
  vec2 wp = vec2(az * 330.0, e * 1100.0);
  float lit = step(0.88, hash(floor(wp))) * step(0.5, fract(wp.y)) * step(0.4, fract(wp.x));
  vec3 win = mix(vec3(0.1, 0.9, 1.0), vec3(1.0, 0.2, 0.75), step(0.55, hash(floor(wp) + 7.0)));
  col = mix(col, vec3(0.008, 0.008, 0.025) + win * lit * 0.9, near);
  float blink = step(0.5, sin(uTime * 2.4 + hash(vec2(floor(az * 22.0), 3.0)) * 30.0));
  col += vec3(1.0, 0.1, 0.3) * step(abs(e - h1 - 0.002), 0.0016) * step(0.8, hash(vec2(floor(az * 22.0), 2.0))) * blink * 2.0 * step(d.z, 0.0);
  return col;
}

void main(){
  vec4 v = uInvProj * vec4(vNdc, 1.0, 1.0);
  vec3 d = normalize((uCamWorld * vec4(normalize(v.xyz / v.w), 0.0)).xyz);
  vec3 col;
  if (d.y >= 0.0) {
    col = sky(d, 0.0);
  } else {
    // flooded ground: reflect, ripple, darken, smear vertically like rain on asphalt
    float dist = 1.0 / max(-d.y, 0.02);
    vec2 g = d.xz * dist;
    float rip = fbm(g * 1.4 + vec2(0.0, uTime * 0.35)) - 0.5;
    vec3 rd = normalize(vec3(d.x + rip * 0.018, -d.y * (0.75 + 0.5 * fbm(g * 0.6)), d.z));
    col = sky(rd, 1.0) * 0.42;
    float fres = pow(1.0 - min(1.0, -d.y * 3.0), 3.0);
    col *= 0.45 + 0.75 * fres;
    col *= 0.85 + 0.3 * fbm(g * 3.0 + uTime * 0.2);
  }
  float lum = dot(col, vec3(0.3, 0.55, 0.15));
  col = mix(col, vec3(lum * 1.7, lum * 0.1, lum * 0.16) + vec3(0.03, 0.0, 0.01), uAlert * 0.75);
  col *= 1.0 - uDim * 0.45;
  gl_FragColor = vec4(col, 1.0);
}`;

const FINAL = {
  uniforms: {tDiffuse: {value: null}, uTime: {value: 0}, uAb: {value: 0.0004}, uGrain: {value: 0.045}, uVig: {value: 0.62}, uGlitch: {value: 0}, uRes: {value: new THREE.Vector2(1, 1)}},
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uAb, uGrain, uVig, uGlitch; uniform vec2 uRes; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      float tick = floor(uTime * 20.0);
      float band = floor(uv.y * 22.0 + tick);
      float g = step(0.88, hash(vec2(band, tick))) * uGlitch;
      uv.x += g * (hash(vec2(band, 3.0)) - 0.5) * 0.05;
      vec2 c = uv - 0.5; float r = dot(c, c);
      vec2 ab = c * (uAb * 10.0 * (0.4 + r * 3.0)) + vec2(g * 0.008, 0.0);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + ab).r; col.g = texture2D(tDiffuse, uv).g; col.b = texture2D(tDiffuse, uv - ab).b;
      // cool ink floor and CRT scanlines
      col = max(col, vec3(0.008, 0.008, 0.02));
      col *= 0.96 + 0.04 * sin(uv.y * uRes.y * 1.6);
      col *= 1.0 - uVig * smoothstep(0.1, 0.72, r * 1.9);
      col += (hash(uv * uRes + fract(uTime) * 61.0) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

/* ── Textures ────────────────────────────────────────────── */

const fontsReady = () => Promise.all([document.fonts?.load('900 100px "Noto Sans JP Variable"'), document.fonts?.load('700 100px "Chakra Petch"'), document.fonts?.load('500 40px "Geist Mono Variable"'), document.fonts?.ready]).catch(() => {});

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
  g.fillStyle = '#62e8ff'; g.font = mono(27); g.fillText('MIHARI // AGENT PASSPORT', 84, 118);
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

/* ── World ───────────────────────────────────────────────── */

export function createWorld(canvas, {onDecision, onFrame, reduced = false, small = false} = {}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
  scene.add(camera);

  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, depthTest: false, depthWrite: false,
    uniforms: {uInvProj: {value: new THREE.Matrix4()}, uCamWorld: {value: new THREE.Matrix4()}, uTime: {value: 0}, uAlert: {value: 0}, uDim: {value: 0}, uEyeDir: {value: new THREE.Vector3(0, 0, -1)}, uEyeAng: {value: 0.1}, uEyeOpen: {value: 1}},
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat); sky.frustumCulled = false; sky.renderOrder = -1000;
  scene.add(sky);

  const world = new THREE.Group(); scene.add(world);
  const real = new THREE.Group(); world.add(real);                       // reflected objects
  const mirror = new THREE.Group(); mirror.scale.y = -1; mirror.position.y = 2 * FLOOR_Y; world.add(mirror);

  // Lights: a cold cyan key from the viewer, a magenta rim from the eye's side.
  scene.add(new THREE.HemisphereLight(0x5a4cff, 0x1a0630, 1.1));
  const key = new THREE.DirectionalLight(0x19e6ff, 1.6); key.position.set(-3, 4, 8); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff2fa6, 4.5); rim.position.set(0, 2, -10); scene.add(rim);
  const sealLight = new THREE.PointLight(0xffffff, 18, 9, 1.8); sealLight.position.set(0, 0.6, 0.6); scene.add(sealLight);

  /* Floor: a thin veil over the reflection, with survey marks and a ring under the scan ring. */
  const veilMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, extensions: {derivatives: true},
    uniforms: {uAlpha: {value: 0.55}, uLine: {value: COL.cyan.clone()}, uLine2: {value: COL.mag.clone()}, uTime: {value: 0}},
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec3 vW; uniform float uAlpha, uTime; uniform vec3 uLine, uLine2;
      float line(float v, float w){ float a = abs(fract(v - 0.5) - 0.5) / fwidth(v); return 1.0 - min(a / w, 1.0); }
      void main(){
        float d = length(vW.xz);
        float minor = max(line(vW.x * 0.5, 0.8), line(vW.z * 0.5, 0.8));
        float major = max(line(vW.x / 4.0, 1.3), line(vW.z / 4.0, 1.3));
        float pulse = 0.55 + 0.45 * sin(vW.z * 0.3 - uTime * 2.4);
        float lane = line(vW.x / 3.0, 1.0) * step(abs(vW.x), 3.2) * step(0.5, fract(vW.z * 0.25 - uTime * 0.8));
        float ring = (1.0 - min(abs(d - 3.6) / fwidth(d) / 1.2, 1.0));
        vec3 c = mix(uLine, uLine2, smoothstep(-4.0, 4.0, vW.x));
        float a = (minor * 0.28 + major * 0.8 * pulse + lane * 0.9 + ring) * exp(-d * 0.035);
        gl_FragColor = vec4(mix(vec3(0.004, 0.003, 0.012), c * (1.0 + major), min(1.0, a)), uAlpha * 0.62 + a * 0.5);
      }`,
  });
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), veilMat);
  veil.rotation.x = -PI / 2; veil.position.set(0, FLOOR_Y + 0.002, -60); veil.renderOrder = -300;
  world.add(veil);

  const lacquer = new THREE.MeshStandardMaterial({color: 0x0a0c18, metalness: 0.7, roughness: 0.28});

  /* The scan ring: the eye's gaze, projected over the street. Calls are judged as they pass through it;
     on revocation its aperture closes. */
  const R = 1.35, SEAL_Y = 0.7;
  const seal = new THREE.Group(); seal.position.y = SEAL_Y; real.add(seal);
  const ringMat = new THREE.MeshBasicMaterial({color: COL.bone.clone().multiplyScalar(1.6)});
  seal.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.05, 16, 200), ringMat));
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(R + 0.14, 0.12, 16, 200), lacquer); bezel.scale.z = 0.6; seal.add(bezel);
  const haloMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {uColor: {value: COL.bone.clone()}, uAmount: {value: 0.5}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform vec3 uColor; uniform float uAmount; void main(){ float r = length(vUv - 0.5) * 2.0; float band = exp(-pow((r - 0.5) * 7.0, 2.0)); float inner = smoothstep(0.5, 0.0, r) * 0.05; gl_FragColor = vec4(uColor * (band * 0.6 + inner) * uAmount, 1.0); }',
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 5.4), haloMat); halo.position.z = -0.2; seal.add(halo);
  const tickMat = new THREE.MeshBasicMaterial({color: COL.bone.clone().multiplyScalar(0.9)});
  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.09, 0.012), tickMat, 72);
  const dm = new THREE.Object3D();
  for (let i = 0; i < 72; i++) { const a = (i / 72) * PI * 2; dm.position.set(Math.cos(a) * (R + 0.34), Math.sin(a) * (R + 0.34), 0.08); dm.rotation.set(0, 0, a + PI / 2); dm.scale.set(1, i % 6 === 0 ? 2 : 1, 1); dm.updateMatrix(); ticks.setMatrixAt(i, dm.matrix); }
  seal.add(ticks);
  const BLADES = 9, blades = [], RB = R - 0.04;
  const half = RB * Math.sin(PI / BLADES) * 1.3;
  const bladeMat = new THREE.MeshStandardMaterial({color: 0x0c0e1c, metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide});
  const bladeGeo = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, -1)]));
  for (let i = 0; i < BLADES; i++) {
    const a = (i / BLADES) * PI * 2, g = new THREE.Group();
    g.position.set(Math.cos(a) * RB, Math.sin(a) * RB, 0.02 + i * 0.002); g.add(new THREE.Mesh(bladeGeo, bladeMat)); g.userData.a = a; seal.add(g); blades.push(g);
  }
  const irisBack = new THREE.Mesh(new THREE.CircleGeometry(R - 0.02, 64), new THREE.MeshBasicMaterial({color: 0x1a0208, transparent: true, opacity: 0, depthWrite: false}));
  irisBack.position.z = 0.01; seal.add(irisBack);
  const stampMat = new THREE.MeshBasicMaterial({transparent: true, opacity: 0, depthWrite: false, toneMapped: false});
  const stamp = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), stampMat); stamp.position.z = 0.06; seal.add(stamp);
  fontsReady().then(() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
    g.strokeStyle = '#ff3a22'; g.lineWidth = 14; g.strokeRect(22, 22, 212, 212);
    g.fillStyle = '#ff3a22'; g.font = '900 92px "Noto Sans JP Variable", serif'; g.textAlign = 'center'; g.fillText('封', 128, 120); g.fillText('鎖', 128, 214);
    stampMat.map = new THREE.CanvasTexture(c); stampMat.map.colorSpace = THREE.SRGBColorSpace; stampMat.needsUpdate = true;
  });

  // reflection: a mirrored copy of the ring (geometry only, shares materials)
  const sealMirror = seal.clone(true); mirror.add(sealMirror);

  /* Rain: thin falling streaks, animated entirely on the GPU (no per-frame CPU work). It follows the camera. */
  const RAIN = small ? 600 : 1400;
  const rainGeo = new THREE.InstancedBufferGeometry().copy(new THREE.BoxGeometry(0.006, 0.42, 0.006));
  rainGeo.instanceCount = RAIN;
  const seeds4 = new Float32Array(RAIN * 4);
  for (let i = 0; i < RAIN; i++) { seeds4[i * 4] = rand(-12, 12); seeds4[i * 4 + 1] = rand(-14, 12); seeds4[i * 4 + 2] = Math.random(); seeds4[i * 4 + 3] = rand(9, 13); }
  rainGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds4, 4));
  const rainMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {uTime: {value: 0}, uCamZ: {value: 8}, uVel: {value: 0}, uColor: {value: COL.cyan.clone().multiplyScalar(0.5)}, uFloor: {value: FLOOR_Y}},
    vertexShader: `attribute vec4 aSeed; uniform float uTime, uCamZ, uVel, uFloor;
      void main(){
        float range = 11.2;
        float y = uFloor + mod(aSeed.z * range - uTime * aSeed.w * (1.0 + uVel * 0.5), range);
        vec3 p = position; p.y *= 1.0 + uVel * 2.0; p.x += p.y * (0.05 + uVel * 0.2);
        vec3 w = vec3(aSeed.x - uTime * 0.3, y, uCamZ - 6.0 + aSeed.y) + p;
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: 'uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor, 0.35); }',
  });
  const rain = new THREE.Mesh(rainGeo, rainMat); rain.frustumCulled = false;
  world.add(rain);

  /* The city: towers lining the plaza, neon kanji signs, and air traffic between them. */
  const towerCount = small ? 80 : 150;
  const towerGeo = new THREE.BoxGeometry(1, 1, 1);
  const dims = new Float32Array(towerCount * 3), seeds = new Float32Array(towerCount);
  const towerMat = new THREE.ShaderMaterial({vertexShader: TOWER_VERT, fragmentShader: TOWER_FRAG, uniforms: {uTime: {value: 0}, uAlert: {value: 0}, uFogFar: {value: 52}, uFog: {value: new THREE.Color(0x14062a)}, uMirror: {value: 0}}});
  const towers = new THREE.InstancedMesh(towerGeo, towerMat, towerCount);
  const signSpots = [];
  for (let i = 0; i < towerCount; i++) {
    const far = i / towerCount > 0.45;   // the far canyon stays low, so the eye is always above the skyline
    const side = i % 2 ? 1 : -1, w = rand(2, 4.2), dd = rand(2, 4.2), h = far ? rand(4, 13) : rand(4, 11) * (i > towerCount * 0.3 ? rand(1.2, 2.2) : 1);
    const z = 10 - (i / towerCount) * 128 + rand(-2, 2), x = side * (z < -88 ? rand(16, 26) : rand(7.5, 10.5) + (i % 4 === 0 ? rand(2, 8) : 0));
    dm.rotation.set(0, 0, 0); dm.position.set(x, FLOOR_Y + h / 2, z); dm.scale.set(w, h, dd); dm.updateMatrix(); towers.setMatrixAt(i, dm.matrix);
    dims[i * 3] = w; dims[i * 3 + 1] = h; dims[i * 3 + 2] = dd; seeds[i] = Math.random();
    if (i % 3 === 0 && signSpots.length < 22 && h > 5) signSpots.push({x: x - side * (w / 2 + 0.06), y: FLOOR_Y + rand(2.4, Math.min(h - 1.2, 7)), z, side});
  }
  towerGeo.setAttribute('aDim', new THREE.InstancedBufferAttribute(dims, 3));
  towerGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  real.add(towers); mirror.add(towers.clone());

  const WORDS = ['承認', '監査', '識別', '関門', '代理人', '封鎖', '見張り', '認証', '記録', '審判', 'AGENT', '可決', '否決', '通行証'];
  const signs = [];
  fontsReady().then(() => {
    signSpots.forEach((sp, i) => {
      const word = WORDS[i % WORDS.length], vertical = /[^A-Z]/.test(word) && i % 2 === 0;
      const c = document.createElement('canvas'); const g = c.getContext('2d');
      const colr = i % 3 === 0 ? '#ff2fa6' : i % 3 === 1 ? '#19e6ff' : '#ffb21f';
      if (vertical) { c.width = 128; c.height = 128 * word.length + 40; } else { c.width = 120 * word.length + 60; c.height = 160; }
      g.fillStyle = 'rgba(6, 6, 20, 0.55)'; g.fillRect(0, 0, c.width, c.height);
      g.strokeStyle = colr; g.lineWidth = 5; g.shadowColor = colr; g.shadowBlur = 18; g.strokeRect(8, 8, c.width - 16, c.height - 16);
      g.fillStyle = '#ffffff'; g.font = `900 ${/[A-Z]/.test(word) ? 92 : 100}px "Noto Sans JP Variable", "Chakra Petch", serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowBlur = 26;
      if (vertical) [...word].forEach((ch, k) => g.fillText(ch, 64, 84 + k * 128)); else g.fillText(word, c.width / 2, 86);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({map: tex, transparent: true, toneMapped: false, color: new THREE.Color(colr).multiplyScalar(1.6), side: THREE.DoubleSide, depthWrite: false});
      const hgt = vertical ? 0.6 * word.length : 0.9, wid = hgt * c.width / c.height;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(wid, hgt), mat);
      m.position.set(sp.x, sp.y, sp.z); m.rotation.y = sp.side > 0 ? -PI / 2 : PI / 2;
      real.add(m); signs.push({m, mat, base: mat.color.clone(), seed: Math.random() * 10});
      const mm = m.clone(); mirror.add(mm);
    });
  });

  const AIR = small ? 30 : 60;
  const air = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.05, 1), new THREE.MeshBasicMaterial({}), AIR);
  air.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(AIR * 3), 3);
  const flights = Array.from({length: AIR}, (_, i) => ({x: rand(-14, 14), y: FLOOR_Y + rand(4.5, 9), z: rand(-80, 12), v: rand(5, 14) * (i % 2 ? 1 : -1), len: rand(1, 3), c: [COL.cyan, COL.mag, COL.amber][i % 3]}));
  world.add(air);

  /* The approach: runway lights chasing toward the eye; low traffic in four lanes. */
  const RUN = small ? 60 : 96;
  const runGeo = new THREE.BoxGeometry(0.08, 0.035, 0.8);
  const runL = new THREE.InstancedMesh(runGeo, new THREE.MeshBasicMaterial({}), RUN), runR = new THREE.InstancedMesh(runGeo, new THREE.MeshBasicMaterial({}), RUN);
  for (let i = 0; i < RUN; i++) { dm.rotation.set(0, 0, 0); dm.scale.setScalar(1); dm.position.set(-4.6, FLOOR_Y + 0.03, 6 - i * 1.7); dm.updateMatrix(); runL.setMatrixAt(i, dm.matrix); dm.position.x = 4.6; dm.updateMatrix(); runR.setMatrixAt(i, dm.matrix); }
  runL.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(RUN * 3), 3); runR.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(RUN * 3), 3);
  real.add(runL, runR);
  const LANES = small ? 40 : 80;
  const lanes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.035, 1), new THREE.MeshBasicMaterial({}), LANES);
  lanes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(LANES * 3), 3);
  const cars = Array.from({length: LANES}, (_, i) => ({x: (i % 2 ? 1 : -1) * rand(5.3, 6.6), y: FLOOR_Y + rand(0.25, 2.6), z: rand(-112, 8), v: rand(8, 22) * (i % 4 < 2 ? 1 : -1), len: rand(1, 3.4), c: [COL.cyan, COL.mag, COL.amber, COL.bone][i % 4]}));
  world.add(lanes);

  /* The eye in the sky, and its reflection in the flood */
  const eye = createSkyEye();
  eye.mesh.position.set(...EYE); real.add(eye.mesh);
  eye.mirror.position.set(...EYE); mirror.add(eye.mirror);

  /* The scan beam: a cone of light from the pupil down to whatever the eye is reading */
  const beamGeo = new THREE.CylinderGeometry(0.05, 1, 1, 64, 1, true); beamGeo.translate(0, -0.5, 0);
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {uColor: {value: COL.cyan.clone()}, uAmount: {value: 0}, uTime: {value: 0}},
    vertexShader: 'varying vec2 vUv; varying float vFace; void main(){ vUv = uv; vec3 n = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vFace = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `varying vec2 vUv; varying float vFace; uniform vec3 uColor; uniform float uAmount, uTime;
      void main(){
        float along = vUv.y;                                    // 1 at the eye, 0 at the target
        float core = pow(vFace, 2.5);
        float bands = 0.65 + 0.35 * step(0.5, fract(along * 70.0 + uTime * 3.0));
        float a = core * bands * (0.15 + 0.85 * smoothstep(0.0, 0.25, along) * smoothstep(1.0, 0.6, along)) + smoothstep(0.04, 0.0, along) * 0.8;
        gl_FragColor = vec4(uColor * a * uAmount, 1.0);
      }`,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat); beam.frustumCulled = false; beam.renderOrder = 20; real.add(beam);
  const beamFrom = new THREE.Vector3(), beamTo = new THREE.Vector3(), gazeAt = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);

  /* Passport */
  const cardGroup = new THREE.Group();
  const CW = 1.7, CH = CW / 1.588;
  const cardGeo = new THREE.ShapeGeometry(roundedRect(CW, CH, 0.05), 12);
  const uv = cardGeo.attributes.uv, pos = cardGeo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + CW / 2) / CW, (pos.getY(i) + CH / 2) / CH);
  const cardMat = new THREE.MeshBasicMaterial({transparent: true, toneMapped: false});
  const cardBackMat = new THREE.MeshBasicMaterial({color: 0x050914, transparent: true, side: THREE.BackSide});
  const scanMat = new THREE.MeshBasicMaterial({color: COL.cyan.clone().multiplyScalar(3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending});
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(CW * 1.1, 0.012), scanMat);
  cardGroup.add(new THREE.Mesh(cardGeo, cardMat), new THREE.Mesh(cardGeo, cardBackMat), scan);
  cardGroup.traverse(o => { if (o.material) { o.material.depthTest = false; o.renderOrder = 50; } });
  const overlay = new THREE.Scene(); overlay.add(cardGroup);   // drawn crisp over the text-vision (see AsciiPass)
  fontsReady().then(() => { cardMat.map = drawPassport(); cardMat.needsUpdate = true; });

  /* Calls: light trails arriving through the rain */
  const COUNT = small ? 40 : 64;
  const trailGeo = new THREE.CapsuleGeometry(0.022, 0.5, 4, 8); trailGeo.rotateX(PI / 2);
  const calls = new THREE.InstancedMesh(trailGeo, new THREE.MeshBasicMaterial({}), COUNT);
  calls.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 3), 3);
  real.add(calls);
  const state = {mix: [...STAGES[0].mix]};
  const parts = Array.from({length: COUNT}, () => ({}));
  const pick = () => { const [a, k, d] = state.mix; const r = Math.random() * (a + k + d || 1); return r < a ? 'allow' : r < a + k ? 'ask' : 'deny'; };
  function spawn(p, far = true) {
    const r = Math.sqrt(Math.random()) * (R - 0.35), a = Math.random() * PI * 2;
    p.x = Math.cos(a) * r; p.y = SEAL_Y + Math.sin(a) * r; p.z = far ? rand(0.6, 7) : rand(6, 8);
    p.vx = p.vy = 0; p.vz = rand(2.4, 3.6); p.phase = 'in'; p.t = 0; p.scale = 1; p.fate = pick(); p.kind = 'neutral';
  }
  parts.forEach(p => spawn(p));

  /* Ledger: stamped blocks running away toward the eye */
  const CHAIN = small ? 40 : 64;
  const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshStandardMaterial({color: 0x110e0d, metalness: 0.5, roughness: 0.4}), CHAIN);
  const faces = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({toneMapped: false}), CHAIN);
  faces.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CHAIN * 3), 3);
  const slots = Array.from({length: CHAIN}, (_, i) => new THREE.Vector3(0, FLOOR_Y + 0.21, -2.2 - i * 1.7));
  const chainLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(slots.map(s => s.clone().setY(FLOOR_Y + 0.02))), new THREE.LineBasicMaterial({color: COL.shu.clone().multiplyScalar(1.4), transparent: true, opacity: 0.7}));
  real.add(blocks, faces, chainLine);
  const ledger = Array.from({length: CHAIN}, () => 'neutral');
  let pulse = 0, flash = 0, glitch = 0, shake = 0, alertNow = 0;
  const pushLedger = kind => { ledger.unshift(kind); ledger.pop(); pulse = 1; };
  const resolveCall = (p, kind) => {
    p.kind = kind; flash = 1; onDecision?.(kind); eye.flash(kind);
    if (kind === 'deny' && glitch < 0.05 && (alertNow > 0.4 || Math.random() < 0.05)) { glitch = 0.7; shake = 0.3; }
  };

  /* Post */
  const rt = new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: small ? 0 : 4});
  const composer = new EffectComposer(renderer, rt);
  const ascii = new AsciiPass(scene, camera, {cell: small ? [7, 12] : [8, 14]});
  ascii.overlay = overlay;
  composer.addPass(ascii);
  fontsReady().then(() => ascii.build());
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.42, 0.45, 0.9);
  // bloom at half resolution: it is a soft glow, extra pixels buy nothing
  const bloomSetSize = bloom.setSize.bind(bloom); bloom.setSize = (w, h) => bloomSetSize(Math.ceil(w / 2), Math.ceil(h / 2));
  composer.addPass(bloom);
  const finalPass = new ShaderPass(FINAL); composer.addPass(finalPass);
  composer.addPass(new OutputPass());
  let usePost = true;

  /* Rig */
  const clone = o => JSON.parse(JSON.stringify(o));
  const cur = clone(STAGES[0]), target = clone(STAGES[0]), view = clone(STAGES[0]);
  const pointer = {x: 0, y: 0, sx: 0, sy: 0};
  let override = null, stage = 0, velocity = 0, velTarget = 0, portrait = false;
  // the opening: the city decodes out of scrambled glyphs, then the eye in the sky opens, blinks, and finds you
  // then the text-vision dissolves, cell by cell, into the full picture
  const OPEN = {decode: [0, 1.6], wake: [1.4, 2.5], blink: [2.75, 3.0], look: [3.05, 3.7], dissolve: [3.7, 4.7], end: 4.8};
  let intro = null;

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
    ascii.pixelRatio = dpr;
    renderer.setSize(w, h, false); composer.setSize(w, h); composer.setPixelRatio(dpr);
    portrait = w / h < 0.85;
    camera.fov = portrait ? 46 : 32;   // a phone gets a wider lens instead of a camera pushed back behind the city
    camera.aspect = w / h; camera.updateProjectionMatrix();
    finalPass.uniforms.uRes.value.set(w * dpr, h * dpr);
  }

  const sph = new THREE.Spherical(), cp = new THREE.Vector3(), tmp = new THREE.Vector3(), look = new THREE.Vector3();
  let dist = 8, prevCamX = 0, bank = 0;
  function placeCamera(v, time) {
    const half = THREE.MathUtils.degToRad(camera.fov / 2), t = Math.tan(half), aspect = width / height;
    let z = v.zone;
    // portrait: wide stages keep the full frame; side-panel stages put the subject in the top band
    if (portrait) z = v.zone.w > 0.9 ? Z(0.5, v.zone.cy, 1, 1) : Z(0.5, 0.3, 0.94, 0.42);
    dist = Math.max(v.r / (z.h * t), v.r / (z.w * aspect * t));
    // a phone is too narrow to fit wide subjects by width: meet halfway, and let the edges crop
    if (portrait && v.zone.w > 0.9) dist = Math.sqrt((v.r / (z.h * t)) * (v.r / (z.w * aspect * t)));
    look.set(v.lx, v.ly, v.lz);
    sph.set(dist, PI / 2 - v.el, v.az);
    cp.setFromSpherical(sph).add(look);
    if (cp.y < FLOOR_Y + 0.25) cp.y = FLOOR_Y + 0.25;
    cp.x += Math.sin(time * 41) * shake * 0.03; cp.y += Math.cos(time * 53) * shake * 0.03;
    camera.position.copy(cp); camera.lookAt(look);
    // bank into lateral moves, like a craft turning, eased so it never snaps
    const dx = cp.x - prevCamX; prevCamX = cp.x;
    bank += (Math.max(-0.08, Math.min(0.08, -dx * 1.4)) - bank) * 0.08;
    camera.rotateZ(bank);
    // the cursor turns the head a touch; it never swings the camera around the subject
    camera.rotateY(-pointer.sx * 0.012); camera.rotateX(-pointer.sy * 0.008);
    camera.setViewOffset(width, height, -(z.cx - 0.5) * width, -(z.cy - 0.5) * height, width, height);
  }

  const anchors = {};
  function project(name, v, space) { tmp.copy(v); space.localToWorld(tmp); tmp.project(camera); anchors[name] = {x: (tmp.x * 0.5 + 0.5) * width, y: (-tmp.y * 0.5 + 0.5) * height, on: tmp.z < 1 && tmp.z > -1}; }
  const sealAnchor = new THREE.Vector3(Math.cos(0.75) * (R + 0.34), Math.sin(0.75) * (R + 0.34), 0);

  const clock = new THREE.Clock();
  let raf = 0, running = false, time = 0, frames = 0, reveal = 1;
  const tc = new THREE.Color();
  const eyeWorld = new THREE.Vector3(...EYE);
  const ease3 = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const span = (t, [a, b]) => Math.min(1, Math.max(0, (t - a) / (b - a)));

  /** The view the camera uses: the scroll-driven pose. */
  function blendView() { Object.assign(view, cur); }

  function step(dt) {
    time += dt;
    const k = 1 - Math.pow(0.0008, dt);
    for (const key of NUM) if (key !== 'closed') cur[key] += (target[key] - cur[key]) * k;
    for (const key of ZONE) cur.zone[key] += (target.zone[key] - cur.zone[key]) * k;
    for (let i = 0; i < 3; i++) cur.card.p[i] += (target.card.p[i] - cur.card.p[i]) * k;
    for (const key of ['tilt', 'rx', 's', 'o']) cur.card[key] += (target.card[key] - cur.card[key]) * k;
    state.mix = target.mix;
    const wantClosed = override === 'closed' ? 1 : override === 'open' ? 0 : target.closed;
    cur.closed += (wantClosed - cur.closed) * (1 - Math.pow(0.003, dt));
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.pow(0.004, dt));
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.pow(0.004, dt));
    velTarget *= Math.pow(0.04, dt);
    velocity += (velTarget - velocity) * (1 - Math.pow(0.02, dt));   // eased: a flick of the wheel never jolts the scene
    pulse = Math.max(0, pulse - dt * 2.4); flash = Math.max(0, flash - dt * 3); glitch = Math.max(0, glitch - dt * 4.5); shake = Math.max(0, shake - dt * 4);
    if (intro) {
      intro.t += dt * intro.speed;
      if (intro.t >= OPEN.end) { const done = intro.done; intro = null; done?.(); }
    }
    blendView();
    reveal = intro ? smooth(span(intro.t, [1.0, 2.4])) : Math.min(1, reveal + dt);
    const au = ascii.material.uniforms;
    au.uDecode.value = intro ? smooth(span(intro.t, OPEN.decode)) : 1;
    au.uAll.value = intro ? 1 - smooth(span(intro.t, OPEN.dissolve)) : 0;
    au.uTime.value = time; au.uAlert.value = alertNow;
    // the lens: follows the pointer tightly, grows in when it arrives, shrinks away when it leaves
    const dpr = renderer.getPixelRatio();
    lens.x += (lens.tx * dpr - lens.x) * (1 - Math.pow(1e-5, dt)); lens.y += ((height - lens.ty) * dpr - lens.y) * (1 - Math.pow(1e-5, dt));
    lens.r += ((lens.on && !intro ? (portrait ? 96 : 150) * dpr : 0) - lens.r) * (1 - Math.pow(0.002, dt));
    au.uLens.value.set(lens.x, lens.y); au.uLensR.value = lens.r;
    const closed = cur.closed;
    const alert = Math.max(cur.alert * (override === 'open' ? 0 : 1), closed > 0.5 ? (closed - 0.5) * 2 : 0); alertNow = alert;

    // palette
    const tone = COL.cyan.clone().lerp(COL.shu, smooth(Math.min(closed * 1.2, 1)));
    ringMat.color.copy(tone).multiplyScalar(1.6 + flash * 1.4);
    haloMat.uniforms.uColor.value.copy(tone);
    // the camera sometimes passes close over the ring: fade its glow, and drop it entirely when it would fill the lens
    const ringNear = smooth(Math.min(1, Math.max(0, (camera.position.distanceTo(seal.position) - 2.5) / 4)));
    haloMat.uniforms.uAmount.value = (0.45 + flash * 0.5 + closed * 0.4) * reveal * ringNear;
    sealLight.color.copy(tone); sealLight.intensity = (14 + flash * 18) * reveal;
    rainMat.uniforms.uColor.value.copy(COL.cyan).lerp(COL.shu, alert * 0.8).multiplyScalar(0.5 + alert * 0.4);
    rim.color.copy(COL.mag).lerp(COL.shu, alert); rim.intensity = 4.5 + alert * 3;
    key.color.copy(COL.cyan).lerp(COL.shu, alert);
    towerMat.uniforms.uTime.value = time; towerMat.uniforms.uAlert.value = alert;
    signs.forEach(sg => { const fl = Math.sin(time * 3 + sg.seed) > 0.985 || (Math.sin(time * 23 + sg.seed * 7) > 0.995) ? 0.25 : 1; sg.mat.color.copy(sg.base).lerp(COL.shu, alert * 0.8).multiplyScalar(fl); });
    for (let i = 0; i < AIR; i++) {
      const f = flights[i]; f.z += f.v * dt * (1 + velocity * 3);
      if (f.z > 14) f.z = -110; if (f.z < -110) f.z = 14;
      dm.position.set(f.x, f.y, f.z); dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, f.len * (1 + velocity * 3)); dm.updateMatrix(); air.setMatrixAt(i, dm.matrix);
      tc.copy(f.c).lerp(COL.shu, alert).multiplyScalar(1.8); air.setColorAt(i, tc);
    }
    air.instanceMatrix.needsUpdate = true; air.instanceColor.needsUpdate = true;
    skyMat.uniforms.uTime.value = time; skyMat.uniforms.uAlert.value = alert; skyMat.uniforms.uDim.value = view.dim;
    veilMat.uniforms.uTime.value = time; veilMat.uniforms.uLine.value.copy(COL.cyan).lerp(COL.shu, alert); veilMat.uniforms.uLine2.value.copy(COL.mag).lerp(COL.shu, alert);
    stampMat.opacity = smooth(Math.max(0, (closed - 0.75) / 0.25)) * (override === 'open' ? 0 : 1);

    // the scan ring
    seal.rotation.z = (1 - reveal) * 1.4;
    seal.scale.setScalar(Math.max(0.0001, reveal)); seal.visible = ringNear > 0.02;
    ticks.rotation.z = -time * 0.04 * (1 + velocity * 4);
    blades.forEach(g => { g.children[0].scale.y = Math.max(0.0001, closed * (RB + 0.02)); g.rotation.z = g.userData.a - PI / 2 + closed * 0.55; g.visible = closed > 0.01; });
    irisBack.material.opacity = smooth(Math.max(0, (closed - 0.5) / 0.5));
    sealMirror.traverse(o => { const src = o.userData.src; if (src) { o.rotation.copy(src.rotation); o.visible = src.visible; o.scale.copy(src.scale); } });

    // the eye: how open it is, where it looks, what the pupil does
    const it = intro ? intro.t : 99;
    const wake = intro ? smooth(span(it, OPEN.wake)) : 1;
    let open = view.open * wake;
    if (intro && it > OPEN.blink[0] && it < OPEN.blink[1]) open *= 1 - Math.sin(span(it, OPEN.blink) * PI);
    // gaze: down at the scan ring (or the pass) when it is reading; otherwise toward your cursor
    const reading = cur.card.o > 0.5 ? cardGroup.position : seal.position;
    const gz = smooth(Math.min(1, view.gaze));
    const look2 = {x: lerp(pointer.sx * 0.7, cur.card.o > 0.5 ? 0.1 : 0, gz), y: lerp(-pointer.sy * 0.6, -1, gz)};
    if (intro && it > OPEN.look[0] && it < OPEN.look[1]) { const g = span(it, OPEN.look); look2.x = g < 0.33 ? -0.85 : g < 0.66 ? 0.85 : 0; look2.y = g < 0.66 ? -0.3 : 0; }
    const eyeOpen = eye.update(dt, time, {open, look: look2, pupil: view.pupil + (1 - wake) * 0.25, slit: override === 'open' ? 0 : override === 'closed' ? 1 : view.slit, scan: view.scan, alert, autoBlink: !intro});
    // the sky around the eye
    tmp.copy(eyeWorld).sub(camera.position); const eyeDist = tmp.length();
    skyMat.uniforms.uEyeDir.value.copy(tmp).normalize(); skyMat.uniforms.uEyeAng.value = Math.atan(eye.unit * 0.55 / eyeDist); skyMat.uniforms.uEyeOpen.value = eyeOpen;
    // the beam from the pupil to whatever it is reading
    const beamOn = view.beam * reveal * Math.min(1, eyeOpen * 1.5);
    beam.visible = beamOn > 0.01;
    if (beam.visible) {
      eye.pupilLocal(beamFrom).add(eyeWorld);
      beamTo.copy(reading);
      tmp.copy(beamTo).sub(beamFrom); const len = tmp.length();
      beam.position.copy(beamFrom); beam.quaternion.setFromUnitVectors(yAxis, tmp.normalize().negate()); beam.scale.set(R * 0.9, len, R * 0.9);
      // never fly through it: fade as the camera nears the beam's axis
      const along = Math.max(0, Math.min(len, tmp.set(0, 0, 0).subVectors(camera.position, beamFrom).dot(look.copy(beamTo).sub(beamFrom).normalize())));
      const axisDist = tmp.copy(beamFrom).addScaledVector(look, along).distanceTo(camera.position);
      beamMat.uniforms.uAmount.value = beamOn * 0.55 * smooth(Math.min(1, Math.max(0, (axisDist - 2) / 5))); beamMat.uniforms.uTime.value = time;
      beamMat.uniforms.uColor.value.copy(COL.cyan).lerp(COL.shu, alert);
    }

    for (let i = 0; i < RUN; i++) {
      const wave = 0.2 + 0.8 * Math.pow(0.5 + 0.5 * Math.sin(i * 0.45 + time * 7), 4);
      tc.copy(COL.cyan).lerp(COL.shu, alert).multiplyScalar(0.35 + wave * 2.4); runL.setColorAt(i, tc);
      tc.copy(COL.mag).lerp(COL.shu, alert).multiplyScalar(0.35 + wave * 2.4); runR.setColorAt(i, tc);
    }
    runL.instanceColor.needsUpdate = true; runR.instanceColor.needsUpdate = true;
    const cz = camera.position.z;
    for (let i = 0; i < LANES; i++) {
      const c = cars[i]; c.z += c.v * dt * (1 + velocity * 4);
      if (c.z > 10) c.z = -112; if (c.z < -112) c.z = 10;
      dm.position.set(c.x, c.y, c.z); dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, c.len * (1 + velocity * 5)); dm.updateMatrix(); lanes.setMatrixAt(i, dm.matrix);
      tc.copy(c.c).lerp(COL.shu, alert * 0.9).multiplyScalar(2); lanes.setColorAt(i, tc);
    }
    lanes.instanceMatrix.needsUpdate = true; lanes.instanceColor.needsUpdate = true;
    rainMat.uniforms.uTime.value = time; rainMat.uniforms.uCamZ.value = cz; rainMat.uniforms.uVel.value = Math.min(1, velocity);

    // calls
    for (let i = 0; i < COUNT; i++) {
      const p = parts[i];
      if (p.phase === 'in') {
        p.z -= p.vz * dt * (1 + velocity * 0.6);
        if (p.z <= 0.15) {
          const fate = closed > 0.55 ? 'deny' : p.fate;
          if (fate === 'allow') { p.phase = 'pass'; resolveCall(p, 'allow'); p.vz = rand(3.2, 4.2); }
          else if (fate === 'deny') { p.phase = 'bounce'; p.t = 0; resolveCall(p, 'deny'); pushLedger('deny'); const a = Math.random() * PI * 2; p.vx = Math.cos(a) * rand(0.9, 2); p.vy = Math.sin(a) * rand(0.9, 2); p.vz = -rand(1.6, 2.6); }
          else { p.phase = 'hold'; p.t = 0; p.z = 0.35; p.kind = 'ask'; flash = 0.5; }
        }
      } else if (p.phase === 'hold') {
        p.t += dt; p.z = 0.35 + Math.sin(p.t * 5) * 0.02;
        if (p.t > 1.6) {
          if (closed < 0.5 && Math.random() < 0.72) { p.phase = 'pass'; resolveCall(p, 'allow'); p.vz = 3.4; }
          else { p.phase = 'bounce'; p.t = 0; resolveCall(p, 'deny'); pushLedger('deny'); p.vx = rand(-1.4, 1.4); p.vy = rand(-1.4, 1.4); p.vz = -2; }
        }
      } else if (p.phase === 'pass') {
        p.z -= p.vz * dt; p.x *= 1 - dt * 0.8; p.y += (FLOOR_Y + 0.25 - p.y) * dt * 0.9;
        if (p.z < -1.8) { p.phase = 'log'; p.t = 0; }
      } else if (p.phase === 'log') {
        p.t += dt * 2.4; const s = slots[0];
        p.x += (s.x - p.x) * Math.min(1, dt * 6); p.y += (s.y - p.y) * Math.min(1, dt * 6); p.z += (s.z - p.z) * Math.min(1, dt * 5);
        p.scale = Math.max(0, 1 - p.t);
        if (p.t >= 1) { pushLedger('allow'); spawn(p, false); }
      } else if (p.phase === 'bounce') {
        p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z -= p.vz * dt; p.scale = Math.max(0, 1 - p.t * 1.2);
        if (p.t > 0.85) spawn(p, false);
      }
      const fadeIn = p.phase === 'in' ? smooth(Math.min(Math.max((7.4 - p.z) / 2, 0), 1)) : 1;
      dm.position.set(p.x, p.y, p.z); dm.rotation.set(0, 0, 0);
      dm.scale.set(1, 1, (p.phase === 'hold' ? 0.35 : 1) + Math.min(2, velocity * 2.4)).multiplyScalar(Math.max(p.scale * fadeIn * reveal, 0.0001)); dm.updateMatrix();
      calls.setMatrixAt(i, dm.matrix); calls.setColorAt(i, HOT[p.kind]);
    }
    calls.instanceMatrix.needsUpdate = true; calls.instanceColor.needsUpdate = true;

    // ledger
    for (let i = 0; i < CHAIN; i++) {
      const s = Math.max(0.0001, (i === 0 ? 1 + pulse * 0.4 : 1) * view.ledger);
      dm.position.copy(slots[i]); dm.rotation.set(0, 0, 0); dm.scale.setScalar(s); dm.updateMatrix(); blocks.setMatrixAt(i, dm.matrix);
      dm.position.y += 0.212 * s; dm.rotation.set(-PI / 2, 0, 0); dm.updateMatrix(); faces.setMatrixAt(i, dm.matrix);
      tc.copy(STAMP[ledger[i]]); if (i === 0) tc.multiplyScalar(1 + pulse); faces.setColorAt(i, tc);
    }
    blocks.instanceMatrix.needsUpdate = true; faces.instanceMatrix.needsUpdate = true; faces.instanceColor.needsUpdate = true;
    chainLine.visible = view.ledger > 0.08; chainLine.material.opacity = 0.7 * view.ledger;

    // passport
    const c = cur.card;
    cardGroup.position.set(c.p[0], c.p[1] + Math.sin(time * 0.9) * 0.04, c.p[2]);
    cardGroup.rotation.set(c.rx + Math.sin(time * 0.6) * 0.02 + pointer.sy * 0.05, cur.az + c.tilt + pointer.sx * 0.1, Math.sin(time * 0.5) * 0.012);
    cardGroup.scale.setScalar(c.s); cardGroup.visible = c.o > 0.02;
    cardMat.opacity = c.o; cardBackMat.opacity = c.o;
    scan.position.y = (((time * 0.5) % 1) - 0.5) * CH; scan.position.z = 0.005; scanMat.opacity = c.o * 0.9;

    bloom.strength = 0.42 + flash * 0.1 + alert * 0.25;
    finalPass.uniforms.uTime.value = time; finalPass.uniforms.uGlitch.value = glitch * (0.3 + alert * 0.7);
    finalPass.uniforms.uAb.value = 0.0004 + glitch * 0.003;
  }

  function draw() {
    placeCamera(view, time);
    skyMat.uniforms.uInvProj.value.copy(camera.projectionMatrixInverse); skyMat.uniforms.uCamWorld.value.copy(camera.matrixWorld);
    if (usePost) composer.render(); else renderer.render(scene, camera);
    camera.updateMatrixWorld();
    project('card', cardGroup.position, real); project('seal', sealAnchor, seal); project('ledger', slots[4], real);
    onFrame?.(anchors, {stage, closed: cur.closed, alert: alertNow, intro: !!intro});
  }

  // tag mirror nodes with their source so animated parts can be synced cheaply
  (function link(src, dst) { dst.userData.src = src; src.children.forEach((c, i) => dst.children[i] && link(c, dst.children[i])); })(seal, sealMirror);

  // Adaptive quality, two steps, both only lower the pixel ratio (post stays on, so the look never changes).
  let ema = 0.016, quality = 2, settleUntil = 45;
  const lockHigh = new URLSearchParams(location.search).get('q') === 'high';
  function downgrade() {
    quality -= 1; settleUntil = frames + 60;
    if (quality === 1) renderer.setPixelRatio(1);
    else { renderer.setPixelRatio(0.8); rainGeo.instanceCount = Math.floor(RAIN / 3); }
    width = 0; resize();
  }
  function frame() {
    if (!running) return;
    const raw = clock.getDelta();
    ema = ema * 0.94 + Math.min(raw, 0.2) * 0.06; frames++;
    if (quality > 0 && !lockHigh && frames > settleUntil && ema > 0.034) downgrade();
    step(Math.min(raw, 0.05)); draw();
    raf = requestAnimationFrame(frame);
  }
  const start = () => { if (reduced || running) return; running = true; clock.getDelta(); raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  const onVisibility = () => (document.hidden ? stop() : start());
  const lens = {x: -9999, y: -9999, tx: -9999, ty: -9999, r: 0, on: false, off: 0};
  const onPointer = e => {
    pointer.x = (e.clientX / innerWidth - 0.5) * 2; pointer.y = (e.clientY / innerHeight - 0.5) * 2;
    if (lens.x < -999) { lens.x = e.clientX * renderer.getPixelRatio(); lens.y = (height - e.clientY) * renderer.getPixelRatio(); }
    lens.tx = e.clientX; lens.ty = e.clientY;
    if (e.pointerType !== 'touch' || e.buttons) { lens.on = true; clearTimeout(lens.off); }
  };
  const onLeave = e => { if (!e.relatedTarget) lens.on = false; };
  const onUp = e => { if (e.pointerType === 'touch') { clearTimeout(lens.off); lens.off = setTimeout(() => { lens.on = false; }, 900); } };
  const ro = new ResizeObserver(() => { resize(); if (!running) draw(); });
  ro.observe(canvas);
  document.addEventListener('visibilitychange', onVisibility);
  addEventListener('pointermove', onPointer, {passive: true}); addEventListener('pointerdown', onPointer, {passive: true});
  addEventListener('pointerup', onUp, {passive: true}); document.addEventListener('pointerout', onLeave);
  resize();
  if (reduced) { for (let i = 0; i < 260; i++) step(0.03); draw(); } else start();

  return {
    setStage(f) {
      stage = f; aim(f);
      if (reduced) { for (const key of NUM) cur[key] = target[key]; for (const key of ZONE) cur.zone[key] = target.zone[key]; cur.card = clone(target.card); step(0.016); draw(); }
    },
    /** Play the opening (eye wakes in close-up, then the camera pulls back to the page's first frame). */
    intro(done) { if (reduced) { done?.(); return; } intro = {t: 0, speed: 1, done}; reveal = 0; },
    /** Hurry the opening along: jump to the pull-back and run it faster. */
    skipIntro() { if (!intro) return; intro.speed = 3; },
    /** Debug: jump the opening to time t (seconds) and draw. */
    seek(t) { if (intro) { intro.t = t; for (let i = 0; i < 30; i++) step(0.016); draw(); } },
    setVelocity(v) { velTarget = Math.max(velTarget, Math.min(1, v)); },
    settle(n = 60) { if (intro) { const d = intro.done; intro = null; d?.(); } for (let i = 0; i < n; i++) step(0.05); draw(); },
    setIris(mode) { override = mode; },
    destroy() {
      stop(); ro.disconnect(); document.removeEventListener('visibilitychange', onVisibility); removeEventListener('pointermove', onPointer); removeEventListener('pointerdown', onPointer); removeEventListener('pointerup', onUp); document.removeEventListener('pointerout', onLeave); clearTimeout(lens.off);
      scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { x.map?.dispose?.(); x.dispose(); }); });
      composer.dispose(); renderer.dispose();
    },
  };
}
