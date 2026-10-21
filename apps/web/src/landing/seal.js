import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';

/*
 * 関門 · THE CHECKPOINT. One WebGL world for the whole page.
 *
 * A monumental gate stands on a flooded plaza at night. Behind it, a vermilion sun sinks into a skyline;
 * the wet ground mirrors everything (the sky shader reflects itself below the horizon, the gate is mirrored
 * geometry). Agent calls arrive as light trails, like tail lights through rain, and each gets a verdict at
 * the seal in the gate's heart: white passes, amber waits for a human, vermilion is thrown back. Every
 * verdict is stamped onto a ledger of blocks running away behind the gate. Revocation closes the iris and
 * the whole city goes to alarm red.
 *
 * Convention: the camera sits on the +z side looking toward -z; the gate is at the origin.
 */

const PI = Math.PI;
const COL = {
  bone: new THREE.Color(0xf1e9dc), shu: new THREE.Color(0xe8321e), ember: new THREE.Color(0xff6a2a),
  amber: new THREE.Color(0xffb020), jade: new THREE.Color(0x3ee08a), ash: new THREE.Color(0x6b6560),
};
const HOT = {neutral: COL.ash.clone().multiplyScalar(1.2), allow: COL.bone.clone().multiplyScalar(2.4), ask: COL.amber.clone().multiplyScalar(2.6), deny: COL.shu.clone().multiplyScalar(3)};
const STAMP = {neutral: new THREE.Color(0x1a1615), allow: COL.bone.clone().multiplyScalar(1.4), deny: COL.shu.clone().multiplyScalar(2)};

const FLOOR_Y = -2.2;
const GATE_H = 6.4, GATE_W = 4.6;
const HIDDEN = {p: [-3.4, 0.2, 2.6], tilt: 0.4, rx: 0, s: 0.7, o: 0};
const Z = (cx, cy, w, h) => ({cx, cy, w, h});
const S = o => ({az: 0, el: 0.08, r: 4, lx: 0, ly: 0, lz: 0, closed: 0, alert: 0, dim: 0, ledger: 0, zone: Z(0.66, 0.52, 0.5, 0.8), mix: [0.6, 0.2, 0.2], card: {...HIDDEN}, ...o});

// Each stage frames a bounding radius `r` around `look`, fitted into a screen `zone`. The page owns the other side.
const STAGES = [
  /* 0 hero     */ S({az: -0.18, el: 0.05, r: 4.3, lx: 0, ly: 1.0, lz: -1, zone: Z(0.68, 0.47, 0.56, 0.84), ledger: 1}),
  /* 1 identify */ S({az: -0.5, el: 0.06, r: 2.0, lx: 0.1, ly: 0.25, lz: 1.9, zone: Z(0.7, 0.5, 0.48, 0.74), mix: [0.5, 0.2, 0.3], card: {p: [0.15, 0.3, 2.0], tilt: -0.35, rx: 0.05, s: 1.0, o: 1}}),
  /* 2 decide   */ S({az: 0.0, el: 0.22, r: 4.6, lx: 0, ly: 0.9, lz: 0, zone: Z(0.5, 0.5, 1, 1), dim: 0.55, mix: [0.45, 0.25, 0.3]}),
  /* 3 prove    */ S({az: 0.72, el: 0.16, r: 4.6, lx: 0, ly: -0.2, lz: -5, zone: Z(0.68, 0.52, 0.56, 0.8), ledger: 1, mix: [0.75, 0.05, 0.2]}),
  /* 4 contain  */ S({az: 0.16, el: 0.04, r: 3.4, lx: 0, ly: 0.8, lz: 0, closed: 1, alert: 1, ledger: 0.6, zone: Z(0.68, 0.5, 0.52, 0.8), mix: [0, 0, 1]}),
  /* 5 lower    */ S({az: 0.18, el: 0.12, r: 7.5, lx: 0, ly: 1.6, lz: -9, zone: Z(0.5, 0.42, 1, 1), dim: 0.7, mix: [0.8, 0.1, 0.1]}),
  /* 6 finale   */ S({az: 0.0, el: 0.03, r: 5.2, lx: 0, ly: 1.4, lz: -1, zone: Z(0.5, 0.36, 1, 0.66), dim: 0.5, ledger: 0.8, mix: [0.9, 0.05, 0.05]}),
  /* 7 hold     */ S({az: 0.0, el: 0.03, r: 5.2, lx: 0, ly: 1.4, lz: -1, zone: Z(0.5, 0.36, 1, 0.66), dim: 0.5, ledger: 0.8, mix: [0.9, 0.05, 0.05]}),
];
const NUM = ['az', 'el', 'r', 'lx', 'ly', 'lz', 'closed', 'alert', 'dim', 'ledger'];
const ZONE = ['cx', 'cy', 'w', 'h'];

const smooth = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

/* ── Sky (and its reflection in the flooded plaza) ───────── */

const SKY_VERT = 'varying vec2 vNdc; void main(){ vNdc = position.xy; gl_Position = vec4(position.xy, 1.0, 1.0); }';
const SKY_FRAG = `
precision highp float;
varying vec2 vNdc;
uniform mat4 uInvProj, uCamWorld;
uniform float uTime, uAlert, uDim;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; } return v; }

vec3 sky(vec3 d, float wet){
  float e = d.y;
  vec3 top = vec3(0.012, 0.009, 0.011), haze = vec3(0.16, 0.025, 0.018), hor = vec3(0.42, 0.06, 0.03);
  vec3 col = mix(hor, haze, smoothstep(0.0, 0.1, e));
  col = mix(col, top, smoothstep(0.06, 0.55, e));
  // smog bands drifting across the sun
  float cl = fbm(vec2(d.x / (e + 0.25) * 2.2 + uTime * 0.01, e * 9.0));
  col += vec3(0.25, 0.03, 0.02) * smoothstep(0.5, 0.95, cl) * smoothstep(0.35, 0.02, e);
  // the sun: a vermilion disc low over the city, sliced by horizontal bands near its base
  vec3 sd = normalize(vec3(0.2, 0.17, -1.0));
  vec3 sr = normalize(cross(vec3(0.0, 1.0, 0.0), sd)), su = cross(sd, sr);
  vec2 sp = vec2(dot(d, sr), dot(d, su));
  float facing = step(0.0, dot(d, sd));
  float r = length(sp);
  float disc = smoothstep(0.125, 0.121, r) * facing;
  float slit = 1.0 - step(0.55, fract((sp.y + 0.02) * 48.0)) * smoothstep(0.0, -0.11, sp.y) * step(sp.y, 0.0);
  vec3 sunCol = mix(vec3(1.0, 0.42, 0.16), vec3(0.9, 0.1, 0.06), smoothstep(0.12, -0.12, sp.y));
  col = mix(col, sunCol * 1.3, disc * slit);
  col += vec3(0.9, 0.12, 0.05) * exp(-r * r * 40.0) * 0.4 * facing;
  // skyline in front of the sun: two layers of towers with sparse lit windows
  float az = atan(d.x, -d.z);
  float h1 = 0.012 + 0.07 * pow(hash(vec2(floor(az * 22.0), 1.0)), 2.0) + 0.025 * hash(vec2(floor(az * 61.0), 4.0));
  float h2 = 0.006 + 0.035 * hash(vec2(floor(az * 40.0), 8.0));
  float far = step(e, h2 + 0.02) * step(-0.001, e);
  float near = step(e, h1) * step(-0.001, e);
  col = mix(col, mix(col, vec3(0.05, 0.012, 0.012), 0.75), far);
  vec2 wp = vec2(az * 330.0, e * 1100.0);
  float lit = step(0.9, hash(floor(wp))) * step(0.5, fract(wp.y)) * step(0.4, fract(wp.x));
  vec3 win = mix(vec3(1.0, 0.82, 0.62), vec3(1.0, 0.22, 0.12), step(0.6, hash(floor(wp) + 7.0)));
  col = mix(col, vec3(0.01, 0.008, 0.009) + win * lit * 0.85, near);
  // a few aircraft warning lights blinking on the tallest towers
  float blink = step(0.5, sin(uTime * 2.4 + hash(vec2(floor(az * 22.0), 3.0)) * 30.0));
  col += vec3(1.0, 0.1, 0.05) * step(abs(e - h1 - 0.002), 0.0016) * step(0.82, hash(vec2(floor(az * 22.0), 2.0))) * blink * 2.0 * step(d.z, 0.0);
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
    col = sky(rd, 1.0) * 0.36;
    float fres = pow(1.0 - min(1.0, -d.y * 3.0), 3.0);
    col *= 0.45 + 0.75 * fres;
    col *= 0.85 + 0.3 * fbm(g * 3.0 + uTime * 0.2);
  }
  float lum = dot(col, vec3(0.3, 0.55, 0.15));
  col = mix(col, vec3(lum * 1.6, lum * 0.12, lum * 0.08) + vec3(0.03, 0.0, 0.0), uAlert * 0.75);
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
      // anime-cel lift: crush the deepest blacks slightly warm, like printed ink
      col = max(col, vec3(0.012, 0.009, 0.008));
      col *= 1.0 - uVig * smoothstep(0.1, 0.72, r * 1.9);
      col += (hash(uv * uRes + fract(uTime) * 61.0) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

/* ── Textures ────────────────────────────────────────────── */

const fontsReady = () => Promise.all([document.fonts?.load('900 100px "Noto Serif JP Variable"'), document.fonts?.load('500 40px "Geist Mono Variable"'), document.fonts?.ready]).catch(() => {});

function drawPassport() {
  const W = 1280, H = 806;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#0d0b0a'; g.fillRect(0, 0, W, H);
  // fine paper weave
  g.globalAlpha = 0.06; g.strokeStyle = '#f1e9dc'; g.lineWidth = 1;
  for (let y = 0; y < H; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + 3); g.stroke(); }
  g.globalAlpha = 1;
  // vermilion band down the right edge with vertical kanji, like a Japanese ID card
  g.fillStyle = '#e8321e'; g.fillRect(W - 180, 0, 180, H);
  g.fillStyle = '#0d0b0a'; g.font = '900 104px "Noto Serif JP Variable", serif'; g.textAlign = 'center';
  ['朱', '印', '証'].forEach((ch, i) => g.fillText(ch, W - 90, 170 + i * 150));
  g.textAlign = 'left';
  // seal stamp, slightly rotated
  g.save(); g.translate(W - 300, 600); g.rotate(-0.12);
  g.strokeStyle = 'rgba(232, 50, 30, 0.9)'; g.lineWidth = 9; g.strokeRect(-70, -70, 140, 140);
  g.fillStyle = 'rgba(232, 50, 30, 0.9)'; g.font = '900 54px "Noto Serif JP Variable", serif'; g.fillText('承認', -54, 20); g.restore();
  const mono = (px, w = 500) => `${w} ${px}px "Geist Mono Variable", ui-monospace, monospace`;
  g.fillStyle = '#e8321e'; g.font = mono(26); g.fillText('SHUIN / AGENT PASS — 朱印状', 72, 104);
  g.fillStyle = '#f1e9dc'; g.font = '900 108px "Noto Serif JP Variable", serif'; g.fillText('research-bot', 66, 268);
  g.font = mono(32); g.fillStyle = '#b8ada0';
  g.fillText('OPERATOR   Acme Inc.', 72, 372); g.fillText('SCOPES     read_file · web.search', 72, 420); g.fillText('ERC-8004   eip155:84532 · #10353', 72, 468);
  g.fillStyle = '#3ee08a'; g.fillRect(72, 522, 14, 14); g.fillStyle = '#f1e9dc'; g.font = mono(26, 600); g.fillText('ACTIVE', 100, 536);
  const seed = [7, 3, 9, 2, 8, 4, 6, 1, 9, 5, 3, 8, 2, 7, 4, 9, 6, 2, 8, 3, 7, 5, 1, 9];
  g.fillStyle = '#f1e9dc'; seed.forEach((v, i) => g.fillRect(72 + i * 20, 660, 7 + (v % 3) * 3, 40 + v * 3));
  g.fillStyle = '#8f857a'; g.font = mono(22); g.fillText('ED25519 · 8F3A 91C2 77DE 0B4E', 72, 752);
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

export function createSeal(canvas, {onDecision, onFrame, reduced = false, small = false} = {}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
  scene.add(camera);

  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, depthTest: false, depthWrite: false,
    uniforms: {uInvProj: {value: new THREE.Matrix4()}, uCamWorld: {value: new THREE.Matrix4()}, uTime: {value: 0}, uAlert: {value: 0}, uDim: {value: 0}},
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat); sky.frustumCulled = false; sky.renderOrder = -1000;
  scene.add(sky);

  const world = new THREE.Group(); scene.add(world);
  const real = new THREE.Group(); world.add(real);                       // reflected objects
  const mirror = new THREE.Group(); mirror.scale.y = -1; mirror.position.y = 2 * FLOOR_Y; world.add(mirror);

  // Lights: a cold bone key from the viewer, the sun as a vermilion rim from behind.
  scene.add(new THREE.HemisphereLight(0x2a1c1a, 0x0a0405, 1.2));
  const key = new THREE.DirectionalLight(0xf1e9dc, 1.4); key.position.set(-3, 4, 8); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff3a1e, 4.5); rim.position.set(0, 2, -10); scene.add(rim);
  const sealLight = new THREE.PointLight(0xffffff, 18, 9, 1.8); sealLight.position.set(0, 0.6, 0.6); scene.add(sealLight);

  /* Floor: a thin veil over the reflection, with chalk survey marks and a dark apron under the gate. */
  const veilMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, extensions: {derivatives: true},
    uniforms: {uAlpha: {value: 0.55}, uLine: {value: COL.bone.clone()}, uTime: {value: 0}},
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec3 vW; uniform float uAlpha, uTime; uniform vec3 uLine;
      float line(float v, float w){ float a = abs(fract(v - 0.5) - 0.5) / fwidth(v); return 1.0 - min(a / w, 1.0); }
      void main(){
        float d = length(vW.xz);
        float lane = max(line(vW.x / 3.0, 0.8) * step(abs(vW.x), 3.2), 0.0) * step(vW.z, 14.0);
        float dash = step(0.5, fract(vW.z * 0.25 - uTime * 0.6));
        float cross = line(vW.z / 6.0, 0.6) * step(abs(vW.x), 6.0) * 0.5;
        float ring = (1.0 - min(abs(d - 3.6) / fwidth(d) / 0.9, 1.0)) * 0.7;
        float a = (lane * dash * 0.55 + cross * 0.25 + ring) * exp(-d * 0.05);
        gl_FragColor = vec4(mix(vec3(0.004, 0.003, 0.003), uLine, a * 0.8), uAlpha * 0.72 + a * 0.4);
      }`,
  });
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), veilMat);
  veil.rotation.x = -PI / 2; veil.position.set(0, FLOOR_Y + 0.002, -60); veil.renderOrder = -300;
  world.add(veil);

  /* The gate: two pillars, a sweeping top beam and a tie beam, in black lacquer with vermilion edge inlays. */
  const lacquer = new THREE.MeshStandardMaterial({color: 0x0b0909, metalness: 0.55, roughness: 0.32});
  const inlayMat = new THREE.MeshBasicMaterial({color: COL.shu.clone().multiplyScalar(1.6)});
  const gate = new THREE.Group(); real.add(gate);
  const pillarGeo = new THREE.BoxGeometry(0.5, GATE_H, 0.5);
  const top = FLOOR_Y + GATE_H;
  [-GATE_W / 2, GATE_W / 2].forEach(x => {
    const p = new THREE.Mesh(pillarGeo, lacquer); p.position.set(x, FLOOR_Y + GATE_H / 2, 0); gate.add(p);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.03, GATE_H * 0.92, 0.03), inlayMat); strip.position.set(x + (x < 0 ? 0.26 : -0.26), FLOOR_Y + GATE_H * 0.47, 0.26); gate.add(strip);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.28, 0.8), lacquer); foot.position.set(x, FLOOR_Y + 0.14, 0); gate.add(foot);
  });
  // kasagi: a long top beam whose ends lift, built from a curved extrusion
  const kasagiShape = new THREE.Shape();
  const KW = GATE_W + 2.2;
  kasagiShape.moveTo(-KW / 2, 0.42); kasagiShape.quadraticCurveTo(0, 0.12, KW / 2, 0.42); kasagiShape.lineTo(KW / 2 - 0.1, 0.0);
  kasagiShape.quadraticCurveTo(0, -0.28, -KW / 2 + 0.1, 0.0); kasagiShape.closePath();
  const kasagiGeo = new THREE.ExtrudeGeometry(kasagiShape, {depth: 0.62, bevelEnabled: false, curveSegments: 32}); kasagiGeo.translate(0, 0, -0.31);
  const kasagi = new THREE.Mesh(kasagiGeo, lacquer); kasagi.position.y = top - 0.1; gate.add(kasagi);
  const kasagiLine = new THREE.Mesh(new THREE.BoxGeometry(KW * 0.86, 0.025, 0.03), inlayMat); kasagiLine.position.set(0, top - 0.22, 0.32); gate.add(kasagiLine);
  const nuki = new THREE.Mesh(new THREE.BoxGeometry(GATE_W + 1.1, 0.3, 0.36), lacquer); nuki.position.y = top - 1.15; gate.add(nuki);
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.78, 0.08), lacquer); plaque.position.set(0, top - 0.62, 0.22); gate.add(plaque);
  const plaqueMat = new THREE.MeshBasicMaterial({transparent: true});
  const plaqueFace = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.68), plaqueMat); plaqueFace.position.set(0, top - 0.62, 0.265); gate.add(plaqueFace);
  fontsReady().then(() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 190; const g = c.getContext('2d');
    g.fillStyle = '#e8321e'; g.fillRect(0, 0, 128, 190); g.fillStyle = '#0b0909'; g.font = '900 72px "Noto Serif JP Variable", serif'; g.textAlign = 'center';
    g.fillText('関', 64, 82); g.fillText('門', 64, 166);
    plaqueMat.map = new THREE.CanvasTexture(c); plaqueMat.map.colorSpace = THREE.SRGBColorSpace; plaqueMat.needsUpdate = true;
  });

  /* The seal: an aperture ring between the pillars, with an iris that closes on revocation. */
  const R = 1.35, SEAL_Y = 0.7;
  const seal = new THREE.Group(); seal.position.y = SEAL_Y; gate.add(seal);
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
  const bladeMat = new THREE.MeshStandardMaterial({color: 0x120c0b, metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide});
  const bladeGeo = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, -1)]));
  for (let i = 0; i < BLADES; i++) {
    const a = (i / BLADES) * PI * 2, g = new THREE.Group();
    g.position.set(Math.cos(a) * RB, Math.sin(a) * RB, 0.02 + i * 0.002); g.add(new THREE.Mesh(bladeGeo, bladeMat)); g.userData.a = a; seal.add(g); blades.push(g);
  }
  const irisBack = new THREE.Mesh(new THREE.CircleGeometry(R - 0.02, 64), new THREE.MeshBasicMaterial({color: 0x1a0302, transparent: true, opacity: 0, depthWrite: false}));
  irisBack.position.z = 0.01; seal.add(irisBack);
  const stampMat = new THREE.MeshBasicMaterial({transparent: true, opacity: 0, depthWrite: false, toneMapped: false});
  const stamp = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), stampMat); stamp.position.z = 0.06; seal.add(stamp);
  fontsReady().then(() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
    g.strokeStyle = '#ff3a22'; g.lineWidth = 14; g.strokeRect(22, 22, 212, 212);
    g.fillStyle = '#ff3a22'; g.font = '900 92px "Noto Serif JP Variable", serif'; g.textAlign = 'center'; g.fillText('封', 128, 120); g.fillText('鎖', 128, 214);
    stampMat.map = new THREE.CanvasTexture(c); stampMat.map.colorSpace = THREE.SRGBColorSpace; stampMat.needsUpdate = true;
  });

  // reflection: a mirrored copy of the gate (geometry only, shares materials)
  const gateMirror = gate.clone(true); mirror.add(gateMirror);

  /* Lanterns: two rows of stone posts with warm lights lining the approach. */
  const lanternGeo = new THREE.BoxGeometry(0.22, 1.1, 0.22);
  const lanterns = new THREE.InstancedMesh(lanternGeo, lacquer, 16);
  const lampMat = new THREE.MeshBasicMaterial({color: COL.ember.clone().multiplyScalar(2.2)});
  const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), lampMat, 16);
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1, z = 3 + Math.floor(i / 2) * 2.4;
    dm.rotation.set(0, 0, 0); dm.scale.setScalar(1); dm.position.set(side * 3.6, FLOOR_Y + 0.55, z); dm.updateMatrix(); lanterns.setMatrixAt(i, dm.matrix);
    dm.position.y = FLOOR_Y + 1.2; dm.updateMatrix(); lamps.setMatrixAt(i, dm.matrix);
  }
  real.add(lanterns, lamps); mirror.add(lanterns.clone(), lamps.clone());

  /* Rain: thin falling streaks. Cheap, and it makes every light in the scene feel wet. */
  const RAIN = small ? 500 : 1100;
  const rainMat = new THREE.MeshBasicMaterial({color: COL.bone.clone().multiplyScalar(0.55), transparent: true, opacity: 0.35, depthWrite: false});
  const rain = new THREE.InstancedMesh(new THREE.BoxGeometry(0.006, 0.42, 0.006), rainMat, RAIN);
  const drops = Array.from({length: RAIN}, () => ({x: rand(-12, 12), y: rand(FLOOR_Y, 9), z: rand(-14, 12), v: rand(9, 13)}));
  world.add(rain);

  /* Passport */
  const cardGroup = new THREE.Group();
  const CW = 1.7, CH = CW / 1.588;
  const cardGeo = new THREE.ShapeGeometry(roundedRect(CW, CH, 0.05), 12);
  const uv = cardGeo.attributes.uv, pos = cardGeo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + CW / 2) / CW, (pos.getY(i) + CH / 2) / CH);
  const cardMat = new THREE.MeshBasicMaterial({transparent: true, toneMapped: false});
  const cardBackMat = new THREE.MeshBasicMaterial({color: 0x0d0b0a, transparent: true, side: THREE.BackSide});
  const scanMat = new THREE.MeshBasicMaterial({color: COL.shu.clone().multiplyScalar(3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending});
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(CW * 1.1, 0.012), scanMat);
  cardGroup.add(new THREE.Mesh(cardGeo, cardMat), new THREE.Mesh(cardGeo, cardBackMat), scan);
  real.add(cardGroup);
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

  /* Ledger: stamped blocks running away behind the gate */
  const CHAIN = 18;
  const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshStandardMaterial({color: 0x110e0d, metalness: 0.5, roughness: 0.4}), CHAIN);
  const faces = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({toneMapped: false}), CHAIN);
  faces.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CHAIN * 3), 3);
  const slots = Array.from({length: CHAIN}, (_, i) => new THREE.Vector3(0, FLOOR_Y + 0.21, -2.2 - i * 1.15));
  const chainLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(slots.map(s => s.clone().setY(FLOOR_Y + 0.02))), new THREE.LineBasicMaterial({color: COL.shu.clone().multiplyScalar(1.4), transparent: true, opacity: 0.7}));
  real.add(blocks, faces, chainLine);
  const ledger = Array.from({length: CHAIN}, () => 'neutral');
  let pulse = 0, flash = 0, glitch = 0, shake = 0, alertNow = 0;
  const pushLedger = kind => { ledger.unshift(kind); ledger.pop(); pulse = 1; };
  const resolveCall = (p, kind) => {
    p.kind = kind; flash = 1; onDecision?.(kind);
    if (kind === 'deny' && glitch < 0.05 && (alertNow > 0.4 || Math.random() < 0.05)) { glitch = 0.7; shake = 0.3; }
  };

  /* Post */
  const rt = new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: small ? 0 : 4});
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.6, 0.6, 0.92);
  composer.addPass(bloom);
  const finalPass = new ShaderPass(FINAL); composer.addPass(finalPass);
  composer.addPass(new OutputPass());
  let usePost = true;

  /* Rig */
  const clone = o => JSON.parse(JSON.stringify(o));
  const cur = clone(STAGES[0]), target = clone(STAGES[0]);
  const pointer = {x: 0, y: 0, sx: 0, sy: 0};
  let override = null, stage = 0, velocity = 0, introT = 1, introOn = false, portrait = false;

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
    const half = THREE.MathUtils.degToRad(camera.fov / 2), t = Math.tan(half), aspect = width / height;
    let z = cur.zone;
    if (portrait) z = cur.zone.w > 0.9 ? Z(0.5, 0.45, 1, 1) : Z(0.5, 0.3, 0.94, 0.42);
    dist = Math.max(cur.r / (z.h * t), cur.r / (z.w * aspect * t));
    look.set(cur.lx, cur.ly, cur.lz);
    sph.set(dist, PI / 2 - cur.el - pointer.sy * 0.03, cur.az + pointer.sx * 0.06);
    cp.setFromSpherical(sph).add(look);
    if (cp.y < FLOOR_Y + 0.25) cp.y = FLOOR_Y + 0.25;
    cp.x += Math.sin(time * 41) * shake * 0.03; cp.y += Math.cos(time * 53) * shake * 0.03;
    camera.position.copy(cp); camera.lookAt(look);
    camera.setViewOffset(width, height, -(z.cx - 0.5) * width, -(z.cy - 0.5) * height, width, height);
  }

  const anchors = {};
  function project(name, v, space) { tmp.copy(v); space.localToWorld(tmp); tmp.project(camera); anchors[name] = {x: (tmp.x * 0.5 + 0.5) * width, y: (-tmp.y * 0.5 + 0.5) * height, on: tmp.z < 1 && tmp.z > -1}; }
  const sealAnchor = new THREE.Vector3(Math.cos(0.75) * (R + 0.34), Math.sin(0.75) * (R + 0.34), 0);
  const plaqueAnchor = new THREE.Vector3(0.3, top - 0.62, 0.26);

  const clock = new THREE.Clock();
  let raf = 0, running = false, time = 0, frames = 0;
  const tc = new THREE.Color();

  function step(dt) {
    time += dt;
    if (introOn) introT = Math.min(1, introT + dt / 2.8);
    const intro = smooth(introT);
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
    velocity *= Math.pow(0.02, dt);
    pulse = Math.max(0, pulse - dt * 2.4); flash = Math.max(0, flash - dt * 3); glitch = Math.max(0, glitch - dt * 4.5); shake = Math.max(0, shake - dt * 4);
    const closed = cur.closed;
    const alert = Math.max(cur.alert * (override === 'open' ? 0 : 1), closed > 0.5 ? (closed - 0.5) * 2 : 0); alertNow = alert;

    // palette
    const tone = COL.bone.clone().lerp(COL.shu, smooth(Math.min(closed * 1.2, 1)));
    ringMat.color.copy(tone).multiplyScalar(1.6 + flash * 1.4);
    haloMat.uniforms.uColor.value.copy(tone); haloMat.uniforms.uAmount.value = (0.45 + flash * 0.5 + closed * 0.4) * intro;
    sealLight.color.copy(tone); sealLight.intensity = (14 + flash * 18) * intro;
    inlayMat.color.copy(COL.shu).multiplyScalar(1.3 + alert * 1.5 + Math.sin(time * 8) * alert * 0.6);
    lampMat.color.copy(COL.ember).lerp(COL.shu, alert).multiplyScalar(2.2 + alert * Math.max(0, Math.sin(time * 10)) * 2);
    rainMat.color.copy(COL.bone).lerp(COL.shu, alert * 0.8).multiplyScalar(0.55 + alert * 0.4);
    rim.color.copy(new THREE.Color(0xff3a1e)); rim.intensity = 4.5 + alert * 3;
    skyMat.uniforms.uTime.value = time; skyMat.uniforms.uAlert.value = alert; skyMat.uniforms.uDim.value = cur.dim;
    veilMat.uniforms.uTime.value = time; veilMat.uniforms.uLine.value.copy(COL.bone).lerp(COL.shu, alert);
    stampMat.opacity = smooth(Math.max(0, (closed - 0.75) / 0.25)) * (override === 'open' ? 0 : 1);

    // gate intro: rises out of the flood
    gate.position.y = (1 - intro) * -1.2; gateMirror.position.y = gate.position.y;
    seal.rotation.z = (1 - intro) * 1.4;
    ticks.rotation.z = -time * 0.04 * (1 + velocity * 4);
    blades.forEach(g => { g.children[0].scale.y = Math.max(0.0001, closed * (RB + 0.02)); g.rotation.z = g.userData.a - PI / 2 + closed * 0.55; g.visible = closed > 0.01; });
    irisBack.material.opacity = smooth(Math.max(0, (closed - 0.5) / 0.5));
    // keep the reflection in sync with animated parts
    gateMirror.traverse(o => { const src = o.userData.src; if (src) { o.rotation.copy(src.rotation); o.visible = src.visible; o.scale.copy(src.scale); } });

    // rain
    const wind = 0.08 + Math.min(1, velocity) * 0.3;
    for (let i = 0; i < RAIN; i++) {
      const d = drops[i];
      d.y -= d.v * dt * (1 + velocity * 0.5); d.x -= wind * dt * 4;
      if (d.y < FLOOR_Y) { d.y = 9; d.x = rand(-12, 12); d.z = rand(-14, 12); }
      dm.position.set(d.x, d.y, d.z); dm.rotation.set(0, 0, wind * 0.6); dm.scale.set(1, 1 + velocity * 2, 1); dm.updateMatrix(); rain.setMatrixAt(i, dm.matrix);
    }
    rain.instanceMatrix.needsUpdate = true;

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
      dm.scale.set(1, 1, (p.phase === 'hold' ? 0.35 : 1) + Math.min(2, velocity * 2.4)).multiplyScalar(Math.max(p.scale * fadeIn * intro, 0.0001)); dm.updateMatrix();
      calls.setMatrixAt(i, dm.matrix); calls.setColorAt(i, HOT[p.kind]);
    }
    calls.instanceMatrix.needsUpdate = true; calls.instanceColor.needsUpdate = true;

    // ledger
    for (let i = 0; i < CHAIN; i++) {
      const s = Math.max(0.0001, (i === 0 ? 1 + pulse * 0.4 : 1) * cur.ledger);
      dm.position.copy(slots[i]); dm.rotation.set(0, 0, 0); dm.scale.setScalar(s); dm.updateMatrix(); blocks.setMatrixAt(i, dm.matrix);
      dm.position.y += 0.212 * s; dm.rotation.set(-PI / 2, 0, 0); dm.updateMatrix(); faces.setMatrixAt(i, dm.matrix);
      tc.copy(STAMP[ledger[i]]); if (i === 0) tc.multiplyScalar(1 + pulse); faces.setColorAt(i, tc);
    }
    blocks.instanceMatrix.needsUpdate = true; faces.instanceMatrix.needsUpdate = true; faces.instanceColor.needsUpdate = true;
    chainLine.visible = cur.ledger > 0.08; chainLine.material.opacity = 0.7 * cur.ledger;

    // passport
    const c = cur.card;
    cardGroup.position.set(c.p[0], c.p[1] + Math.sin(time * 0.9) * 0.04, c.p[2]);
    cardGroup.rotation.set(c.rx + Math.sin(time * 0.6) * 0.02 + pointer.sy * 0.05, cur.az + c.tilt + pointer.sx * 0.1, Math.sin(time * 0.5) * 0.012);
    cardGroup.scale.setScalar(c.s); cardGroup.visible = c.o > 0.02;
    cardMat.opacity = c.o; cardBackMat.opacity = c.o;
    scan.position.y = (((time * 0.5) % 1) - 0.5) * CH; scan.position.z = 0.005; scanMat.opacity = c.o * 0.9;

    bloom.strength = 0.6 + flash * 0.15 + alert * 0.35;
    finalPass.uniforms.uTime.value = time; finalPass.uniforms.uGlitch.value = glitch * (0.3 + alert * 0.7);
    finalPass.uniforms.uAb.value = 0.0004 + Math.min(1, velocity) * 0.003 + glitch * 0.003;
    camera.fov = 32 + Math.min(1, velocity) * 4; camera.updateProjectionMatrix();
  }

  function draw() {
    placeCamera(time);
    skyMat.uniforms.uInvProj.value.copy(camera.projectionMatrixInverse); skyMat.uniforms.uCamWorld.value.copy(camera.matrixWorld);
    if (usePost) composer.render(); else renderer.render(scene, camera);
    camera.updateMatrixWorld();
    project('card', cardGroup.position, real); project('seal', sealAnchor, seal); project('ledger', slots[4], real); project('plaque', plaqueAnchor, gate);
    onFrame?.(anchors, {stage, closed: cur.closed, alert: alertNow});
  }

  // tag mirror nodes with their source so animated parts can be synced cheaply
  (function link(src, dst) { dst.userData.src = src; src.children.forEach((c, i) => dst.children[i] && link(c, dst.children[i])); })(gate, gateMirror);

  let ema = 0.016, quality = 'high';
  const lockHigh = new URLSearchParams(location.search).get('q') === 'high';
  function downgrade() { quality = 'lite'; usePost = false; renderer.setPixelRatio(1); rain.count = Math.floor(RAIN / 3); width = 0; resize(); }
  function frame() {
    if (!running) return;
    const raw = clock.getDelta();
    ema = ema * 0.92 + raw * 0.08; frames++;
    if (quality === 'high' && !lockHigh && frames > 30 && ema > 0.05) downgrade();
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
  resize();
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
      scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { x.map?.dispose?.(); x.dispose(); }); });
      composer.dispose(); renderer.dispose();
    },
  };
}
