import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {NEON, rand, fontsReady, signMesh, WORDS, towerMaterial, towers, rain, glyphAtlas} from '../lab/base.js';
import {buildPassport, animatePassport, printTexture} from '../lab/artifact.js';

/*
 * 見張り · THE WATCH LINE. One world, one unbroken flight, for the whole page.
 *
 * The swarm is the thread through all of it. Tens of thousands of agents stream as a river of light across the
 * sky over the megacity, sweep down to the horizon, and arrive at a portal that they themselves form: a ring of
 * agents, an accretion disc of agents, a vortex. Through the portal the same stream becomes the walls of the
 * wormhole. Revoke throws every one of them back.
 *
 *   z   90 … -280   the megacity from the air (hero); a checkpoint hovers at z -125 where the passport is held
 *   z -292          the great entrance torii; then the Senbon Torii path, wet stone under neon
 *   z -524          the great exit torii, onto the portal's stone dais
 *   z -600          the swarm portal, standing on the water
 *   z -600 … -1320  the wormhole: the swarm's walls, a set piece for every chapter, the last iris, light
 *
 * Scroll is travel. Each chapter is a camera pose; between them the camera flies on eased paths.
 */

const PI = Math.PI, TAU = PI * 2;
const PORTAL = {z: -600, y: 14, r: 13};
const TUBE = {z1: -1320, r: 9};
const TORII = {z0: -300, z1: -518, gap: 2.7, entry: -292, exit: -524};
const CARD = new THREE.Vector3(0, 22, -125);

// camera position p, look target l, view centre on screen (cx, cy), how far the world sits back (dim), roll
const P = (p, l, o = {}) => ({p, l, cx: 0.5, cy: 0.5, dim: 0, roll: 0, ...o});
export const STAGES = [
  /* 0 hero      */ P([0, 64, 120], [0, 30, -360], {cx: 0.6, cy: 0.44}),
  /* 1 pass      */ P([-0.9, 22.3, -117.6], [0.15, 22, -125], {cx: 0.3, cy: 0.5}),
  /* 2 entry     */ P([0, 3.4, -258], [0, 5.6, -300], {cy: 0.48}),
  /* 3 decide    */ P([0.25, 1.6, -312], [0, 3.6, -380], {cy: 0.26, dim: 0.25}),
  /* 4 prove     */ P([-0.35, 1.45, -430], [0.25, 2.5, -480], {cx: 0.7, dim: 0.15}),
  /* 5 contain   */ P([0, 2.2, -530], [0, 13, -600], {cx: 0.66, cy: 0.46}),
  /* 6 console   */ P([0, 14, -665], [0, 14, -745], {dim: 0.42, roll: 0.15}),
  /* 7 passport  */ P([0, 14, -760], [0, 14, -840], {dim: 0.42, roll: -0.2}),
  /* 8 integrate */ P([0, 14, -865], [0, 14, -945], {dim: 0.45, roll: 0.2}),
  /* 9 cases     */ P([0, 14, -970], [0, 14, -1050], {dim: 0.48, roll: -0.15}),
  /* 10 stack    */ P([0, 14, -1075], [0, 14, -1155], {dim: 0.42, roll: 0.1}),
  /* 11 finale   */ P([0, 14, -1190], [0, 14, -1290], {dim: 0.05}),
  /* 12 hold     */ P([0, 14, -1190], [0, 14, -1290], {dim: 0.05}),
];

const smooth = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = x => Math.min(1, Math.max(0, x));
const span = (x, a, b) => clamp01((x - a) / (b - a));
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

const FILM = {
  uniforms: {tDiffuse: {value: null}, uTime: {value: 0}, uAb: {value: 0.0006}, uGrain: {value: 0.04}, uVig: {value: 0.62}, uDim: {value: 0}, uFade: {value: 1}, uRes: {value: new THREE.Vector2(1, 1)}, uAlert: {value: 0}},
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uAb, uGrain, uVig, uDim, uFade, uAlert; uniform vec2 uRes; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){ vec2 c = vUv - 0.5; float r = dot(c, c); vec2 ab = c * uAb * 10.0 * (0.4 + r * 3.0);
      vec3 col = vec3(texture2D(tDiffuse, vUv + ab).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - ab).b);
      float l = dot(col, vec3(0.3, 0.55, 0.15));
      col = mix(col, vec3(l * 1.6, l * 0.12, l * 0.18), uAlert * 0.5);
      col *= 0.97 + 0.03 * sin(vUv.y * uRes.y * 1.6);
      col *= 1.0 - uVig * smoothstep(0.1, 0.72, r * 1.9);
      col *= (1.0 - uDim * 0.55) * uFade;
      col += (hash(vUv * uRes + fract(uTime) * 61.0) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0); }`,
};

const SKY = `varying vec2 vNdc; uniform mat4 uInvProj, uCamWorld; uniform float uTime, uAlert; uniform vec3 uPortalDir;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
vec3 sky(vec3 d){
  float e = d.y;
  vec3 col = mix(vec3(0.4, 0.09, 0.3), vec3(0.012, 0.01, 0.04), smoothstep(-0.02, 0.42, e));
  float cl = fbm(vec2(d.x / (abs(e) + 0.15) * 0.9 + uTime * 0.008, e * 6.0));
  col = mix(col, vec3(0.42, 0.14, 0.32), smoothstep(0.55, 0.9, cl) * smoothstep(0.32, 0.02, e) * 0.5);
  float toward = max(0.0, dot(d, uPortalDir));
  vec3 glow = mix(vec3(0.15, 0.6, 1.0), vec3(1.0, 0.1, 0.2), uAlert);
  col += glow * (pow(toward, 80.0) * 0.25 + pow(toward, 10.0) * 0.06) * (0.6 + 0.6 * cl);
  vec2 st = floor(d.xz / max(e, 0.05) * 80.0); col += step(0.997, hash(st)) * smoothstep(0.15, 0.4, e) * 0.8;
  return mix(col, vec3(0.25, 0.0, 0.03) * (0.5 + col.r), uAlert * 0.55);
}
void main(){
  vec4 v = uInvProj * vec4(vNdc, 1.0, 1.0); vec3 d = normalize((uCamWorld * vec4(normalize(v.xyz / v.w), 0.0)).xyz);
  vec3 col;
  if (d.y >= 0.0) col = sky(d);
  else col = mix(vec3(0.07, 0.02, 0.07), vec3(0.008, 0.006, 0.014), smoothstep(0.0, 0.25, -d.y));   // ground haze, no mirror
  gl_FragColor = vec4(col, 1.0);
}`;

/* The swarm's path, shared by its streaks and its heads. s in [0, 1): the first half is the river across the sky
   (a cubic bezier ending at the portal, widening into the portal's ring), the second half is the wormhole wall. */
const SWARM_FN = `
uniform float uTime, uLock, uInside, uPx;
const vec3 A = vec3(30.0, 54.0, 52.0), B = vec3(30.0, 50.0, -90.0), C = vec3(4.0, 42.0, -400.0), D = vec3(0.0, ${PORTAL.y.toFixed(1)}, ${PORTAL.z.toFixed(1)});
vec3 bez(float u){ float v = 1.0 - u; return v*v*v*A + 3.0*v*v*u*B + 3.0*v*u*u*C + u*u*u*D; }
vec3 swarmAt(vec4 seed, float s, out vec3 col, out float a){
  float twist = seed.y * 6.2831853;
  col = mix(vec3(0.7, 0.86, 1.0), vec3(0.2, 0.85, 1.0), seed.w);
  a = 0.45 + 0.55 * seed.w;
  float verdict = fract(seed.z * 7.0);
  if (s < 0.5) {
    float u = s / 0.5;
    vec3 c = bez(u);
    float k = smoothstep(0.72, 1.0, u);                         // near the portal the river opens into its ring
    float ang = twist + u * 7.0 + uTime * 0.05;
    float rr = mix(mix(16.0, 9.0, u) * sqrt(seed.z) * (0.6 + 0.4 * sin(u * 9.0 + seed.w * 6.0)), ${PORTAL.r.toFixed(1)} * (0.92 + 0.16 * seed.z), k);
    vec3 off = vec3(cos(ang) * rr, sin(ang) * rr * mix(0.35, 1.0, k), 0.0);
    off.x += sin(u * 21.0 + seed.w * 6.0 + uTime * 0.6) * 3.0 * (1.0 - k);
    off.y += cos(u * 17.0 + seed.y * 6.0 + uTime * 0.5) * 2.0 * (1.0 - k);
    a *= smoothstep(0.0, 0.03, u) * mix(1.0, 0.45, k) * mix(1.0, 0.35, smoothstep(0.3, 0.9, u));   // dense up close, thinner far away
    if (seed.w > 0.93) col = vec3(1.0, 0.3, 0.75);
    return c + off;
  }
  float u = (s - 0.5) / 0.5, z = mix(${PORTAL.z.toFixed(1)}, ${TUBE.z1.toFixed(1)}, u);
  float past = ${PORTAL.z.toFixed(1)} - z;
  if (verdict < 0.08 + uLock && past < 60.0) {                // denied at the portal: thrown back out, red sparks
    float ang = twist + uTime * 0.2;
    vec3 p = vec3(cos(ang), sin(ang), 0.0) * (${PORTAL.r.toFixed(1)} + past * (0.4 + seed.w)) + vec3(0.0, ${PORTAL.y.toFixed(1)}, ${PORTAL.z.toFixed(1)} + past * 0.9);
    p.y += past * past * 0.004;
    col = vec3(1.0, 0.12, 0.2) * 1.6; a *= 1.0 - past / 60.0;
    return p;
  }
  float ang = twist + z * 0.018 + uTime * 0.25;
  float rr = mix(${PORTAL.r.toFixed(1)} * (0.92 + 0.16 * seed.z), ${(TUBE.r - 0.6).toFixed(1)} + seed.z * 0.9, smoothstep(0.0, 40.0, past));
  vec3 p = vec3(cos(ang) * rr, ${PORTAL.y.toFixed(1)} + sin(ang) * rr, z);
  col = mix(vec3(0.2, 0.95, 1.0), vec3(1.0, 0.25, 0.75), smoothstep(0.35, 0.65, fract(ang / 6.2831853 * 3.0 + z * 0.004)));
  col = mix(col, vec3(0.3, 1.0, 0.55), step(0.9, seed.w));
  a *= max(uInside, smoothstep(140.0, 30.0, past));
  return p;
}`;

export function createWorld(canvas, {onDecision, onFrame, reduced = false, small = false} = {}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.25 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x120822, 0.0042);
  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 1800);
  scene.add(camera);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0x7a6cff, 0x22081c, 0.7));
  const dm = new THREE.Object3D(), tc = new THREE.Color();
  const shared = {uTime: {value: 0}, uAlert: {value: 0}};
  const RED = new THREE.Color(NEON.red);

  const skyMat = new THREE.ShaderMaterial({vertexShader: 'varying vec2 vNdc; void main(){ vNdc = position.xy; gl_Position = vec4(position.xy, 1.0, 1.0); }', fragmentShader: SKY, depthTest: false, depthWrite: false,
    uniforms: {uInvProj: {value: new THREE.Matrix4()}, uCamWorld: {value: new THREE.Matrix4()}, uTime: shared.uTime, uAlert: shared.uAlert, uPortalDir: {value: new THREE.Vector3(0, 0, -1)}}});
  const skyMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat); skyMesh.frustumCulled = false; skyMesh.renderOrder = -1000; scene.add(skyMesh);

  /* ── THE MEGACITY ─────────────────────────────────────── */
  const city = new THREE.Group(); scene.add(city);
  const tmat = towerMaterial({fogColor: 0x170a28, fogFar: 320, windowScale: [1.1, 1.3]}); tmat.uniforms.uTime = shared.uTime; tmat.uniforms.uAlert = shared.uAlert;
  const lots = [];
  for (let i = 0; i < (small ? 800 : 1700); i++) {
    const x = rand(-300, 300), z = rand(-660, 110), ax = Math.abs(x);
    if (z > -285 && ax < 14) continue;
    if (z <= -285 && z > -540 && ax < 16) continue;
    if (z <= -540 && z > -690 && ax < 50) continue;
    if (Math.abs(z - CARD.z) < 26 && ax < 26) continue;
    const avenue = z > -285 && ax < 34;
    const h = avenue ? rand(6, 17) : rand(18, 84) * (Math.random() < 0.08 ? 1.7 : 1) * (z < -285 && ax < 60 ? 0.55 : 1);
    lots.push({x, z, w: rand(7, 16), d: rand(7, 16), h, y0: 0});
  }
  city.add(towers(lots.length, tmat, i => lots[i]));
  const landmarks = [{x: 36, z: 30, w: 14, d: 14, h: 120}, {x: -42, z: -10, w: 12, d: 16, h: 96}, {x: 30, z: -70, w: 10, d: 10, h: 70}];
  city.add(towers(landmarks.length, tmat, i => ({...landmarks[i], y0: 0})));
  const holoMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: {uTime: shared.uTime, uAlert: shared.uAlert},
    vertexShader: 'attribute float aKind; attribute vec3 aCol; varying vec2 vUv; varying float vKind; varying vec3 vCol; void main(){ vUv = uv; vKind = aKind; vCol = aCol; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; varying float vKind; varying vec3 vCol; uniform float uTime, uAlert;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){ vec2 p = vUv; float a = 0.0;
        if (vKind < 0.5) { vec2 q = (p - vec2(0.5, 0.45)) * vec2(1.0, 1.4); a = clamp(smoothstep(0.32, 0.3, length(q * vec2(1.2, 1.0))) - smoothstep(0.31, 0.29, length((q - vec2(0.12, 0.02)) * vec2(1.6, 1.0))) * 0.6, 0.0, 1.0) * (0.6 + 0.4 * step(0.5, fract(p.y * 90.0))); }
        else if (vKind < 1.5) { a = step(0.55, hash(vec2(floor(p.x * 18.0), floor(p.y * 30.0 - uTime * 4.0 * hash(vec2(floor(p.x * 18.0), 1.0)))))) * 0.8; }
        else { float r = length(p - 0.5); a = smoothstep(0.02, 0.0, abs(r - 0.3 - 0.04 * sin(uTime * 2.0))) + smoothstep(0.015, 0.0, abs(r - 0.2)) * 0.6; }
        float edge = max(smoothstep(0.02, 0.0, min(p.x, 1.0 - p.x)), smoothstep(0.015, 0.0, min(p.y, 1.0 - p.y))) * 0.5;
        float flick = 0.85 + 0.15 * step(0.97, hash(vec2(floor(uTime * 12.0), vKind)));
        gl_FragColor = vec4(mix(vCol, vec3(1.0, 0.1, 0.15), uAlert) * (a + edge) * flick * 0.85, 1.0); }`,
  });
  const H = 28, holos = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), holoMat, H);
  const kinds = new Float32Array(H), cols = new Float32Array(H * 3);
  for (let i = 0; i < H; i++) {
    const side = i % 2 ? 1 : -1;
    dm.position.set(side * rand(34, 46), rand(28, 56), 50 - i * 12); dm.rotation.set(0, side * -0.75, 0); dm.scale.set(rand(12, 20), rand(22, 36), 1); dm.updateMatrix(); holos.setMatrixAt(i, dm.matrix);
    kinds[i] = i % 3; new THREE.Color([NEON.cyan, NEON.mag, NEON.violet, NEON.amber][i % 4]).multiplyScalar(1.4).toArray(cols, i * 3);
  }
  holos.geometry.setAttribute('aKind', new THREE.InstancedBufferAttribute(kinds, 1)); holos.geometry.setAttribute('aCol', new THREE.InstancedBufferAttribute(cols, 3));
  city.add(holos);
  const coneMat = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; varying float vFace; void main(){ vUv = uv; vec3 n = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vFace = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec2 vUv; varying float vFace; void main(){ float a = pow(vFace, 3.0) * vUv.y * 0.09; gl_FragColor = vec4(vec3(0.6, 0.8, 1.0) * a, 1.0); }'});
  const cones = [];
  for (let i = 0; i < 6; i++) { const g = new THREE.Group(); g.position.set((i % 2 ? 1 : -1) * rand(60, 160), 45, rand(-460, 0)); const c = new THREE.Mesh(new THREE.ConeGeometry(16, 300, 28, 1, true), coneMat); c.position.y = 150; c.rotation.x = PI; g.add(c); g.userData = {p: rand(0, 6), s: rand(0.2, 0.4)}; city.add(g); cones.push(g); }
  const T = small ? 120 : 260, traffic = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.2, 3), new THREE.MeshBasicMaterial({toneMapped: false}), T);
  traffic.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(T * 3), 3);
  const flights = Array.from({length: T}, (_, i) => ({x: rand(-140, 140), y: [14, 24, 34, 48][i % 4] + rand(-1, 1), z: rand(-560, 100), v: rand(20, 45) * (i % 2 ? 1 : -1), c: new THREE.Color([NEON.amber, NEON.bone, NEON.red, NEON.cyan][i % 4]).multiplyScalar(2.4)}));
  city.add(traffic);
  fontsReady().then(() => {
    for (let i = 0; i < 26; i++) {
      const word = WORDS[i % WORDS.length], v = /[^A-Z0-9]/.test(word);
      const m = signMesh(word, ['#ff2fa6', '#19e6ff', '#ffb21f', '#9a6bff'][i % 4], v ? rand(8, 14) : rand(4, 6), v);
      const side = i % 2 ? 1 : -1; m.position.set(side * rand(15, 22), rand(12, 30), 30 - i * 12); m.rotation.y = -side * PI / 2 * 0.8; city.add(m);
    }
    const big = signMesh('見張り', '#ff2fa6', 30, true); big.position.set(28.6, 62, 30); big.rotation.y = -PI / 2; city.add(big);
  });

  /* ── THE CHECKPOINT: the passport, on a stage of its own ── */
  const checkpoint = new THREE.Group(); checkpoint.position.copy(CARD); scene.add(checkpoint);
  const pass = buildPassport(); checkpoint.add(pass.card);
  const halo = new THREE.Mesh(new THREE.CircleGeometry(7, 64), new THREE.ShaderMaterial({transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; void main(){ float r = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(0.008, 0.01, 0.028, smoothstep(1.0, 0.25, r) * 0.9); }'}));
  halo.renderOrder = -1; checkpoint.add(halo);
  const scanMat = new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.cyan).multiplyScalar(2), transparent: true, opacity: 0.7, toneMapped: false, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending});
  const scanRings = [2.5, 2.9, 3.8].map((r, i) => { const m = new THREE.Mesh(new THREE.RingGeometry(r, r + (i === 1 ? 0.012 : 0.03), 120), scanMat); m.rotation.x = -PI / 2; m.position.y = -1.9 - i * 0.05; checkpoint.add(m); return m; });
  const beamUp = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.8, 1.9, 64, 1, true), new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; void main(){ gl_FragColor = vec4(vec3(0.1, 0.8, 1.0) * (1.0 - vUv.y) * 0.25, 1.0); }'}));
  beamUp.position.y = -0.95; checkpoint.add(beamUp);
  const scanSheet = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 0.012), new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.cyan).multiplyScalar(3), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending})); checkpoint.add(scanSheet);
  const keyLight = new THREE.PointLight(NEON.cyan, 26, 16); keyLight.position.set(-3, 2, 4); checkpoint.add(keyLight);
  const rimLight = new THREE.PointLight(NEON.mag, 40, 16); rimLight.position.set(3, -1, -2); checkpoint.add(rimLight);
  const fill = new THREE.PointLight(0xffffff, 6, 10); fill.position.set(0, 0, 5); checkpoint.add(fill);
  // interaction: drag turns it (with momentum), click opens it, hovering scans it
  const pi = {yaw: 0, pitch: 0, vy: 0, vx: 0, open: false, hover: 0, hoverOn: false, dragging: false, moved: 0};

  /* ── SENBON TORII ─────────────────────────────────────── */
  const torii = new THREE.Group(); scene.add(torii);
  const N = Math.floor((TORII.z0 - TORII.z1) / TORII.gap) + 1;
  const lacquer = new THREE.MeshStandardMaterial({color: 0x3a0806, metalness: 0.3, roughness: 0.35, emissive: 0x6a0c06, emissiveIntensity: 0.9});
  const neonMat = new THREE.MeshBasicMaterial({toneMapped: false});
  function gateGeometry(scale) {
    const pillarGeo = new THREE.CylinderGeometry(0.16, 0.2, 4.2, 12); pillarGeo.translate(0, 2.1, 0);
    const KW = 4.9, sh = new THREE.Shape();
    sh.moveTo(-KW / 2, 0.36); sh.quadraticCurveTo(0, 0.08, KW / 2, 0.36); sh.lineTo(KW / 2 - 0.12, 0); sh.quadraticCurveTo(0, -0.22, -KW / 2 + 0.12, 0); sh.closePath();
    const kasaGeo = new THREE.ExtrudeGeometry(sh, {depth: 0.4, bevelEnabled: false, curveSegments: 24}); kasaGeo.translate(0, 4.25, -0.2);
    const nukiGeo = new THREE.BoxGeometry(3.9, 0.2, 0.22); nukiGeo.translate(0, 3.55, 0);
    const tubeV = new THREE.BoxGeometry(0.045, 3.9, 0.045); tubeV.translate(0, 2.05, 0.2);
    const tubeK = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(v3(-KW / 2 + 0.12, 4.25, 0.22), v3(0, 4.03, 0.22), v3(KW / 2 - 0.12, 4.25, 0.22)), 40, 0.028, 5, false);
    [pillarGeo, kasaGeo, nukiGeo, tubeV, tubeK].forEach(g => g.scale(scale, scale, scale));
    return {pillarGeo, kasaGeo, nukiGeo, tubeV, tubeK};
  }
  const G = gateGeometry(1);
  const pillars = new THREE.InstancedMesh(G.pillarGeo, lacquer, N * 2), kasa = new THREE.InstancedMesh(G.kasaGeo, lacquer, N), nuki = new THREE.InstancedMesh(G.nukiGeo, lacquer, N);
  const tubesV = new THREE.InstancedMesh(G.tubeV, neonMat, N * 2), tubesK = new THREE.InstancedMesh(G.tubeK, neonMat, N);
  tubesV.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 6), 3); tubesK.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  const gateZ = [], gateCol = [], gateFlash = new Float32Array(N), flashCol = Array.from({length: N}, () => new THREE.Color());
  const palette = [NEON.red, NEON.red, NEON.mag, NEON.red, NEON.amber, NEON.red, NEON.mag];
  for (let i = 0; i < N; i++) {
    const z = TORII.z0 - i * TORII.gap; gateZ.push(z); gateCol.push(new THREE.Color(palette[Math.floor(i / 3) % palette.length]));
    dm.rotation.set(0, 0, 0); dm.scale.setScalar(1);
    for (const sx of [-1, 1]) { dm.position.set(sx * 1.65, 0, z); dm.updateMatrix(); pillars.setMatrixAt(i * 2 + (sx > 0 ? 1 : 0), dm.matrix); tubesV.setMatrixAt(i * 2 + (sx > 0 ? 1 : 0), dm.matrix); }
    dm.position.set(0, 0, z); dm.updateMatrix(); kasa.setMatrixAt(i, dm.matrix); nuki.setMatrixAt(i, dm.matrix); tubesK.setMatrixAt(i, dm.matrix);
  }
  const lampMat = new THREE.MeshBasicMaterial({color: new THREE.Color(1, 0.55, 0.22).multiplyScalar(2.2), toneMapped: false});
  const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.26, 0.18), lampMat, N), posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.9, 0.26), lacquer, N);
  for (let i = 0; i < N; i++) { const sx = i % 2 ? 2.5 : -2.5; dm.position.set(sx, 0.45, gateZ[i] - TORII.gap / 2); dm.updateMatrix(); posts.setMatrixAt(i, dm.matrix); dm.position.y = 1.03; dm.updateMatrix(); lamps.setMatrixAt(i, dm.matrix); }
  const toriiParts = [pillars, kasa, nuki, tubesV, tubesK, lamps, posts];
  torii.add(...toriiParts);
  // the great gates at each end: twice the height, lit, named
  const GG = gateGeometry(2.2), greatNeon = new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.red).multiplyScalar(2.6), toneMapped: false});
  const great = [TORII.entry, TORII.exit].map((z, k) => {
    const g = new THREE.Group(); g.position.z = z;
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(GG.pillarGeo, lacquer); p.position.x = sx * 3.6; g.add(p); const t = new THREE.Mesh(GG.tubeV, greatNeon); t.position.x = sx * 3.6; g.add(t); }
    g.add(new THREE.Mesh(GG.kasaGeo, lacquer), new THREE.Mesh(GG.nukiGeo, lacquer), new THREE.Mesh(GG.tubeK, greatNeon));
    const l = new THREE.PointLight(0xff3a22, 30, 26, 1.6); l.position.set(0, 7, 3); g.add(l);
    for (const sx of [-1, 1]) { const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.2, 0.7), lacquer); lantern.position.set(sx * 6, 1.1, 1.5); const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.5), lampMat); lamp.position.set(sx * 6, 2.5, 1.5); g.add(lantern, lamp); }
    torii.add(g); return g;
  });
  fontsReady().then(() => {
    for (let i = 0; i < N; i += 9) { const m = signMesh(['識別', '審判', '記録', '封鎖', '見張り', '認証', '中枢', '通行証', '関門'][(i / 9) % 9], '#ffb21f', 0.62, true); m.position.set(0, 3.15, gateZ[i] + 0.15); torii.add(m); }
    great.forEach((g, k) => { const m = signMesh(k ? '中枢' : '見張り', '#ffb21f', 1.9, true); m.position.set(0, 6.9, 0.35); g.add(m); });
  });
  // the ground of the path and the plaza: wet stone, lit by what stands on it (no mirrors: light pools and smears)
  const floorMat = new THREE.ShaderMaterial({uniforms: {uTime: shared.uTime, uAlert: shared.uAlert, uFog: {value: new THREE.Color(0x120822)}},
    vertexShader: 'varying vec3 vW; varying float vDepth; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `varying vec3 vW; varying float vDepth; uniform float uTime, uAlert; uniform vec3 uFog;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        vec2 p = vW.xz; float x = abs(p.x);
        // paving: long slabs along the path, staggered; a few darker, seams that hold water
        vec2 q = vec2(p.x / 1.1, p.y / 0.9); q.x += step(0.5, fract(floor(q.y) * 0.5)) * 0.5;
        vec2 cell = floor(q), f = fract(q);
        float seam = 1.0 - smoothstep(0.0, 0.05, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
        float tone = 0.7 + 0.3 * hash(cell);
        float wet = smoothstep(0.45, 0.75, noise(p * 0.35)) ;                         // puddled patches shine more
        vec3 col = vec3(0.022, 0.02, 0.032) * tone * (1.0 - seam * 0.5);
        vec3 warm = vec3(1.0, 0.5, 0.2), neon = mix(vec3(1.0, 0.16, 0.2), vec3(1.0, 0.1, 0.15), uAlert);
        float onPath = step(${TORII.exit.toFixed(1)}, p.y) * step(p.y, ${(TORII.entry + 6).toFixed(1)});
        if (p.y > ${(TORII.exit - 2).toFixed(1)}) {
          // lantern pools: every gate has a lantern on alternating sides
          float k = (${TORII.z0.toFixed(1)} - p.y) / ${TORII.gap.toFixed(2)} - 0.5;
          float dz = (fract(k) - 0.5) * ${TORII.gap.toFixed(2)};
          float side = mod(floor(k), 2.0) < 0.5 ? -1.0 : 1.0;
          float pool = exp(-(pow(p.x - side * 2.5, 2.0) + dz * dz) * 1.3);
          // pillar neon smears: long glows on the wet stone beneath each pillar line
          float gz = (fract((${TORII.z0.toFixed(1)} - p.y) / ${TORII.gap.toFixed(2)} + 0.5) - 0.5) * ${TORII.gap.toFixed(2)};
          float smear = exp(-pow(x - 1.65, 2.0) * 30.0) * exp(-gz * gz * 0.9);
          float lane = exp(-p.x * p.x * 1.4) * 0.35;                                   // the walked middle, polished
          col += warm * pool * (0.22 + 0.3 * wet) * onPath;
          col += neon * (smear * (0.25 + 0.35 * wet) + lane * 0.04) * onPath;
          col += (seam * 0.04) * warm * pool * onPath;
        }
        // the dais: engraved rings and spokes lit from the portal, pulses running outward
        vec2 d = p - vec2(0.0, ${PORTAL.z.toFixed(1)}); float r = length(d), a = atan(d.y, d.x);
        float dais = smoothstep(46.0, 40.0, r) * step(p.y, ${(TORII.exit + 4).toFixed(1)});
        float rings = smoothstep(0.07, 0.0, abs(fract(r / 3.0) - 0.5) - 0.44);
        float spokes = smoothstep(0.012, 0.0, abs(fract(a / 6.2831853 * 36.0) - 0.5) - 0.48) * step(16.0, r);
        float pulse = exp(-pow(fract(r * 0.03 - uTime * 0.25) - 0.5, 2.0) * 60.0);
        vec3 cyan = mix(vec3(0.15, 0.75, 1.0), vec3(1.0, 0.12, 0.18), uAlert);
        col = mix(col, vec3(0.018, 0.02, 0.03) * tone, dais * 0.6);
        col += cyan * (rings * 0.12 + spokes * 0.08) * (0.3 + pulse) * dais * exp(-r * 0.03);
        col += cyan * exp(-r * 0.09) * 0.25 * dais;                                     // the portal's light falling on it
        float fog = 1.0 - exp(-vDepth * 0.006);
        gl_FragColor = vec4(mix(col, uFog * 0.6, fog), 1.0);
      }`});
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(110, 440), floorMat); floor.rotation.x = -PI / 2; floor.position.set(0, 0.01, -500); scene.add(floor);
  const C = 30, comets = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.03, 0.7, 4, 8).rotateX(PI / 2), new THREE.MeshBasicMaterial({toneMapped: false}), C);
  comets.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(C * 3), 3); torii.add(comets);
  const KIND = {allow: new THREE.Color(NEON.jade).multiplyScalar(3), ask: new THREE.Color(NEON.amber).multiplyScalar(3), deny: new THREE.Color(NEON.red).multiplyScalar(3.5), neutral: new THREE.Color(NEON.bone).multiplyScalar(2.2)};
  const respawn = c => { c.x = rand(-1.1, 1.1); c.y = rand(0.6, 3.2); c.z = TORII.z0 + rand(0, 6); c.v = rand(5, 9); c.kind = 'neutral'; c.fate = Math.random(); c.gate = -1; c.back = 0; c.hold = 0; };
  const calls = Array.from({length: C}, () => { const c = {}; respawn(c); c.z -= rand(0, TORII.z0 - TORII.z1); return c; });

  /* ── THE PORTAL ───────────────────────────────────────── */
  const portal = new THREE.Group(); portal.position.set(0, PORTAL.y, PORTAL.z); scene.add(portal);
  const ringMat = new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.cyan).multiplyScalar(2.4), toneMapped: false});
  portal.add(new THREE.Mesh(new THREE.TorusGeometry(PORTAL.r, 0.22, 12, 240), ringMat));
  const ring2Mat = new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.mag).multiplyScalar(2), toneMapped: false});
  portal.add(new THREE.Mesh(new THREE.TorusGeometry(PORTAL.r + 1.6, 0.06, 6, 240), ring2Mat));
  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), ringMat, 180);
  for (let i = 0; i < 180; i++) { const a = (i / 180) * TAU; dm.position.set(Math.cos(a) * (PORTAL.r + 2.6), Math.sin(a) * (PORTAL.r + 2.6), 0); dm.rotation.set(0, 0, a - PI / 2); dm.scale.set(1, i % 15 === 0 ? 2.4 : 1, 1); dm.updateMatrix(); ticks.setMatrixAt(i, dm.matrix); }
  const tickRing = new THREE.Group(); tickRing.add(ticks); portal.add(tickRing);
  // the aura: a halo and light rays behind the ring
  const auraMat = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {uTime: shared.uTime, uAlert: shared.uAlert, uR: {value: PORTAL.r / 60}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uTime, uAlert, uR;
      float hash(float n){ return fract(sin(n) * 43758.5453); }
      void main(){ vec2 p = (vUv - 0.5) * 2.0; float r = length(p), a = atan(p.y, p.x);
        float ring = exp(-pow((r - uR) / 0.03, 2.0)) * 0.45 + exp(-pow((r - uR) / 0.12, 2.0)) * 0.12;
        float k = floor((a / 6.2831853 + 0.5) * 90.0);
        float rays = pow(hash(k * 1.7 + floor(uTime * 0.8 + hash(k) * 4.0)), 6.0) * smoothstep(uR, uR + 0.05, r) * exp(-(r - uR) * 3.2);
        float inner = smoothstep(uR, 0.0, r) * 0.18;
        vec3 c = mix(mix(vec3(0.15, 0.75, 1.0), vec3(0.9, 0.3, 1.0), 0.5 + 0.5 * sin(a * 2.0 + uTime * 0.3)), vec3(1.0, 0.1, 0.15), uAlert);
        gl_FragColor = vec4(c * (ring + rays * 0.5 + inner * 0.35) * smoothstep(1.0, 0.6, r), 1.0); }`});
  const aura = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), auraMat); aura.position.z = -0.6; portal.add(aura);
  // the vortex face: spiral arms down the tunnel beyond; it opens as you arrive
  const vortexMat = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: {uTime: shared.uTime, uAlert: shared.uAlert, uOn: {value: 1}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uTime, uAlert, uOn;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){ vec2 p = (vUv - 0.5) * 2.0; float r = length(p); if (r > 1.0) discard; float a = atan(p.y, p.x);
        float depth = 1.0 / max(r, 0.03);
        float arms = pow(0.5 + 0.5 * sin(a * 5.0 + depth * 1.6 - uTime * 2.2), 6.0);
        float rings = smoothstep(0.44, 0.5, abs(fract(depth * 0.7 - uTime * 0.9) - 0.5));
        float sparks = step(0.985, hash(floor(vec2(a * 30.0, depth * 3.0 - uTime * 4.0))));
        vec3 c = mix(vec3(0.1, 0.8, 1.0), vec3(1.0, 0.2, 0.7), 0.5 + 0.5 * sin(depth * 0.5 - uTime));
        c = mix(c, vec3(1.0, 0.1, 0.15), uAlert);
        vec3 col = c * (arms * 0.28 + rings * 0.12 + sparks * 1.2) * smoothstep(0.02, 0.4, r) + vec3(0.8, 0.95, 1.0) * exp(-r * r * 60.0) * 0.4;
        gl_FragColor = vec4(col * smoothstep(1.0, 0.8, r) * uOn, 1.0); }`});
  const vortex = new THREE.Mesh(new THREE.CircleGeometry(PORTAL.r - 0.1, 128), vortexMat); portal.add(vortex);
  // the accretion disc: agents orbiting the ring, some spiralling in
  const AC = small ? 9000 : 22000, acSeed = new Float32Array(AC * 4);
  for (let i = 0; i < AC; i++) acSeed.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
  const acGeo = new THREE.BufferGeometry(); acGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(AC * 3), 3)); acGeo.setAttribute('aSeed', new THREE.BufferAttribute(acSeed, 4));
  const acMat = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {uTime: shared.uTime, uAlert: shared.uAlert, uPx: {value: 1}},
    vertexShader: `attribute vec4 aSeed; uniform float uTime, uAlert, uPx; varying vec3 vCol; varying float vA;
      void main(){
        float spiral = fract(aSeed.x + uTime * 0.04 * (0.5 + aSeed.w));
        float inward = step(0.8, aSeed.z);
        float r = ${PORTAL.r.toFixed(1)} * mix(1.0 + pow(aSeed.y, 2.0) * 0.9, 1.0 - spiral * 0.95, inward);
        float a = aSeed.x * 6.2831853 + uTime * (0.6 + 0.5 * aSeed.w) * (14.0 / r);
        vec3 p = vec3(cos(a) * r, sin(a) * r, (aSeed.z - 0.5) * 2.2 * (1.0 - inward) - inward * spiral * 4.0);
        vCol = mix(mix(vec3(0.2, 0.85, 1.0), vec3(1.0, 0.3, 0.8), aSeed.y), vec3(1.0, 0.12, 0.2), uAlert);
        vA = (0.2 + 0.4 * aSeed.w) * mix(1.0, 1.0 - spiral, inward);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp((1.2 + 2.0 * aSeed.w) * uPx * 80.0 / -mv.z, 1.0, 4.0 * uPx);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'varying vec3 vCol; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(vCol * smoothstep(1.0, 0.0, r) * vA, 1.0); }'});
  const accretion = new THREE.Points(acGeo, acMat); accretion.frustumCulled = false; portal.add(accretion);
  // lightning crawling along the rim
  const arcs = Array.from({length: 3}, () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(26 * 3), 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({color: new THREE.Color(0.7, 0.95, 1).multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, toneMapped: false})); l.frustumCulled = false; portal.add(l); return {l, t: 0}; });
  const portalLight = new THREE.PointLight(NEON.cyan, 30, 80, 1.5); portalLight.position.set(0, PORTAL.y, PORTAL.z + 8); scene.add(portalLight);
  /* ── THE SWARM: one stream from the sky, through the portal, into the walls of the wormhole ── */
  const SN = small ? 22000 : 56000, seeds = new Float32Array(SN * 4);
  for (let i = 0; i < SN; i++) seeds.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
  const swarmU = {uTime: shared.uTime, uLock: {value: 0}, uInside: {value: 0}, uPx: {value: 1}};
  const swarmS = 'float speed(vec4 sd){ return 0.012 + 0.006 * sd.w; }';
  const hGeo = new THREE.BufferGeometry(); hGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SN * 3), 3)); hGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const heads = new THREE.Points(hGeo, new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: swarmU,
    vertexShader: `attribute vec4 aSeed; varying vec3 vCol; varying float vA; ${SWARM_FN} ${swarmS}
      void main(){ float s = fract(aSeed.x + uTime * speed(aSeed)); vec3 col; float a; vec3 p = swarmAt(aSeed, s, col, a); vCol = col; vA = a;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = clamp((1.3 + 2.2 * aSeed.w) * uPx * 70.0 / -mv.z, 1.0, 4.5 * uPx); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'varying vec3 vCol; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(vCol * smoothstep(1.0, 0.0, r) * vA, 1.0); }'}));
  heads.frustumCulled = false; scene.add(heads);
  // streaks: a line per agent from where it is to where it was a moment ago
  const TR = Math.floor(SN * 0.6), tSeeds = new Float32Array(TR * 2 * 4), tEnd = new Float32Array(TR * 2);
  for (let i = 0; i < TR; i++) for (let e = 0; e < 2; e++) { tSeeds.set(seeds.subarray(i * 4, i * 4 + 4), (i * 2 + e) * 4); tEnd[i * 2 + e] = e; }
  const tGeo = new THREE.BufferGeometry(); tGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TR * 2 * 3), 3)); tGeo.setAttribute('aSeed', new THREE.BufferAttribute(tSeeds, 4)); tGeo.setAttribute('aEnd', new THREE.BufferAttribute(tEnd, 1));
  const trails = new THREE.LineSegments(tGeo, new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: swarmU,
    vertexShader: `attribute vec4 aSeed; attribute float aEnd; varying vec3 vCol; varying float vA; ${SWARM_FN} ${swarmS}
      void main(){ float s0 = fract(aSeed.x + uTime * speed(aSeed)); float s = s0 - aEnd * (0.004 + 0.004 * aSeed.w); if (s < 0.0 || (s0 >= 0.5 && s < 0.5)) s = s0; vec3 col; float a; vec3 p = swarmAt(aSeed, s, col, a);
        vCol = col; vA = a * (1.0 - aEnd) * (s0 < 0.5 ? 0.85 : 0.55); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: 'varying vec3 vCol; varying float vA; void main(){ gl_FragColor = vec4(vCol * vA, 1.0); }'}));
  trails.frustumCulled = false; scene.add(trails);

  /* ── THE WORMHOLE ─────────────────────────────────────── */
  const tunnel = new THREE.Group(); scene.add(tunnel);
  const LEN = PORTAL.z - TUBE.z1;
  const tubeMat = new THREE.ShaderMaterial({side: THREE.BackSide, uniforms: {uTime: shared.uTime, uAlert: shared.uAlert, uFlow: {value: 0}},
    vertexShader: 'varying vec3 vP; varying float vDepth; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `varying vec3 vP; varying float vDepth; uniform float uTime, uAlert, uFlow;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        float a = atan(vP.y, vP.x) / 6.2831853 + 0.5, z = vP.z + uFlow;
        vec2 p = vec2(a * 36.0, z * 0.28); p.x += step(0.5, fract(floor(p.y) * 0.5)) * 0.5;
        vec2 cell = floor(p), f = fract(p);
        float seam = max(smoothstep(0.94, 0.985, f.x), smoothstep(0.92, 0.98, f.y));
        float lit = step(0.95, hash(cell + floor(uTime * 0.4 + hash(cell) * 4.0)));
        float ring = smoothstep(0.488, 0.5, abs(fract(z / 46.0) - 0.5));
        vec3 tint = mix(vec3(0.1, 0.8, 1.0), vec3(1.0, 0.2, 0.7), 0.5 + 0.5 * sin(vP.z * 0.01));
        tint = mix(tint, vec3(1.0, 0.1, 0.15), uAlert);
        vec3 col = vec3(0.006, 0.008, 0.02) + tint * (seam * 0.07 + lit * 0.12 + ring * 1.1);
        gl_FragColor = vec4(col * exp(-vDepth * 0.005), 1.0);
      }`});
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(TUBE.r + 1.2, TUBE.r + 1.2, LEN, 96, 1, true).rotateX(PI / 2), tubeMat);
  tube.position.set(0, PORTAL.y, (PORTAL.z + TUBE.z1) / 2); tunnel.add(tube);
  const bladeGeo = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-2.6, 0), new THREE.Vector2(2.6, 0), new THREE.Vector2(0, -9.6)]));
  const bladeMat = new THREE.MeshStandardMaterial({color: 0x0a0b14, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide});
  const edgeMat = new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.cyan).multiplyScalar(2.2), toneMapped: false});
  const IRIS_Z = [-715, -820, -925, -1030, -1135, -1262];
  const irises = IRIS_Z.map((z, k) => {
    const g = new THREE.Group(); g.position.set(0, PORTAL.y, z); tunnel.add(g);
    g.add(new THREE.Mesh(new THREE.TorusGeometry(TUBE.r + 0.6, 0.12, 6, 140), edgeMat));
    const bl = []; for (let i = 0; i < 12; i++) { const b = new THREE.Group(), a = (i / 12) * TAU; b.position.set(Math.cos(a) * (TUBE.r + 0.5), Math.sin(a) * (TUBE.r + 0.5), 0); b.rotation.z = a + PI / 2; b.add(new THREE.Mesh(bladeGeo, bladeMat)); g.add(b); bl.push(b); }
    g.userData = {bl, z, last: k === IRIS_Z.length - 1}; return g;
  });
  const exit = new THREE.Mesh(new THREE.CircleGeometry(TUBE.r + 1.2, 64), new THREE.MeshBasicMaterial({color: new THREE.Color(0.75, 0.95, 1).multiplyScalar(2.6), toneMapped: false}));
  exit.position.set(0, PORTAL.y, TUBE.z1 + 2); tunnel.add(exit);
  const PK = 360, packets = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.04, 1.8), new THREE.MeshBasicMaterial({toneMapped: false}), PK);
  packets.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PK * 3), 3); tunnel.add(packets);
  const pk = Array.from({length: PK}, (_, i) => ({a: rand(0, TAU), r: rand(2, TUBE.r - 1.5), z: rand(TUBE.z1, PORTAL.z), v: rand(30, 70), c: new THREE.Color([NEON.cyan, NEON.mag, NEON.bone, NEON.jade][i % 4]).multiplyScalar(2)}));

  // set piece · console: a ring of live screens orbiting the axis
  const feedMat = new THREE.ShaderMaterial({transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: {uTime: shared.uTime, tGlyph: {value: null}, uCount: {value: 1}},
    vertexShader: 'attribute float aSeed; varying vec2 vUv; varying float vSeed; void main(){ vUv = uv; vSeed = aSeed; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; varying float vSeed; uniform float uTime, uCount; uniform sampler2D tGlyph;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){ vec2 q = vec2(vUv.x * 26.0, vUv.y * 14.0 + uTime * (1.5 + vSeed)); vec2 c = floor(q), f = fract(q);
        float on = step(0.2, hash(vec2(c.y, vSeed * 9.0))) * step(c.x, 5.0 + 19.0 * hash(vec2(c.y, 3.0 + vSeed)));
        float g = floor(hash(c + floor(uTime * 0.6) + vSeed) * uCount);
        float ink = texture2D(tGlyph, vec2((g + f.x) / uCount, f.y)).r * on;
        float h = hash(vec2(c.y, 11.0 + vSeed));
        vec3 col = h < 0.12 ? vec3(1.0, 0.25, 0.3) : h < 0.25 ? vec3(1.0, 0.7, 0.2) : vec3(0.3, 1.0, 0.65);
        float frame = max(smoothstep(0.02, 0.0, min(vUv.x, 1.0 - vUv.x)), smoothstep(0.03, 0.0, min(vUv.y, 1.0 - vUv.y)));
        vec3 o = col * ink * 1.4 + vec3(0.1, 0.9, 1.0) * frame + vec3(0.02, 0.05, 0.08);
        gl_FragColor = vec4(o, 0.88); }`});
  const SCR = 14, screens = new THREE.InstancedMesh(new THREE.PlaneGeometry(4.2, 2.6), feedMat, SCR);
  const scrSeed = new Float32Array(SCR); for (let i = 0; i < SCR; i++) scrSeed[i] = Math.random();
  screens.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(scrSeed, 1)); tunnel.add(screens);
  // set piece · passport: passes streaming toward you along a spiral
  const passMat = new THREE.MeshBasicMaterial({transparent: true, opacity: 0.9, toneMapped: false, side: THREE.DoubleSide, depthWrite: false});
  const PS = 22, passes = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.4, 1.51), passMat, PS); tunnel.add(passes);
  // set piece · integrate: a double helix of code
  const helixMat = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {uTime: shared.uTime, tGlyph: {value: null}, uCount: {value: 1}},
    vertexShader: 'attribute float aSeed; varying vec2 vUv; varying float vSeed; void main(){ vUv = uv; vSeed = aSeed; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; varying float vSeed; uniform float uTime, uCount; uniform sampler2D tGlyph;
      void main(){ float g = floor(fract(vSeed * 13.7 + floor(uTime * 3.0 + vSeed * 10.0) * 0.137) * uCount);
        float ink = texture2D(tGlyph, vec2((g + vUv.x) / uCount, vUv.y)).r;
        vec3 c = mix(vec3(0.2, 1.0, 0.6), vec3(0.2, 0.85, 1.0), step(0.5, vSeed));
        gl_FragColor = vec4(c * ink * 1.8, 1.0); }`});
  const HX = 260, helix = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.6, 0.8), helixMat, HX);
  const hxSeed = new Float32Array(HX); for (let i = 0; i < HX; i++) hxSeed[i] = (i % 2) * 0.5 + Math.random() * 0.49;
  helix.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(hxSeed, 1)); tunnel.add(helix);
  // set piece · your stack: three labelled rings, one inside the next
  const stackRings = [];
  fontsReady().then(() => {
    const a = glyphAtlas('ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ{}()=;:<>/.0123456789abcdef'); feedMat.uniforms.tGlyph.value = helixMat.uniforms.tGlyph.value = a.tex; feedMat.uniforms.uCount.value = helixMat.uniforms.uCount.value = a.count;
    passMat.map = printTexture(); passMat.needsUpdate = true;
    [['IDENTITY · 身元 · WHO IS THIS AGENT', '#19e6ff'], ['ACCESS · 権限 · WHICH APPS MAY IT OPEN', '#9a6bff'], ['ACTION · 行為 · MAY IT DO THIS, NOW — MIHARI', '#ff2fa6']].forEach(([label, col], k) => {
      const c = document.createElement('canvas'); c.width = 4096; c.height = 128; const g = c.getContext('2d');
      g.fillStyle = col; g.font = '700 64px "Chakra Petch", sans-serif'; g.textBaseline = 'middle';
      const step = g.measureText(label + '   ✦   ').width;
      for (let x = 0; x < 4096; x += step) g.fillText(label + '   ✦   ', x, 66);
      g.fillRect(0, 4, 4096, 3); g.fillRect(0, 121, 4096, 3);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping;
      const r = 3.2 + k * 2.1;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.55, 128, 1, true), new THREE.MeshBasicMaterial({map: tex, transparent: true, side: THREE.DoubleSide, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending}));
      m.rotation.x = PI / 2; m.position.set(0, PORTAL.y, -1110 - k * 6); tunnel.add(m); stackRings.push(m);
    });
  });
  const rn = rain(small ? 600 : 1300, {size: [30, 20, 40], speed: [16, 24], length: 0.7, opacity: 0.3}); scene.add(rn.mesh);

  /* ── post ─────────────────────────────────────────────── */
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: small ? 0 : 4}));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.75, 0.5, 0.8);
  const bs = bloom.setSize.bind(bloom); bloom.setSize = (w, h) => bs(Math.ceil(w / 2), Math.ceil(h / 2));
  composer.addPass(bloom);
  const film = new ShaderPass(FILM); composer.addPass(film); composer.addPass(new OutputPass());

  /* ── rig ──────────────────────────────────────────────── */
  const pointer = {x: 0, y: 0, sx: 0, sy: 0};
  const KEYS = ['cx', 'cy', 'dim', 'roll'];
  const cur = {p: v3(...STAGES[0].p), l: v3(...STAGES[0].l), cx: STAGES[0].cx, cy: STAGES[0].cy, dim: 0, roll: 0};
  const tgt = {p: v3(0, 0, 0), l: v3(0, 0, 0), cx: 0.5, cy: 0.5, dim: 0, roll: 0};
  let f = 0, velocity = 0, velTarget = 0, override = null, lock = 0, fade = 1, intro = null, width = 0, height = 0, portrait = false;
  function aim(x) {
    const i = Math.min(Math.max(Math.floor(x), 0), STAGES.length - 2), u = smooth(clamp01(x - i)), a = STAGES[i], b = STAGES[i + 1];
    tgt.p.set(...a.p).lerp(v3(...b.p), u); tgt.l.set(...a.l).lerp(v3(...b.l), u);
    for (const k of KEYS) tgt[k] = lerp(a[k], b[k], u);
  }
  aim(0);
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    if (w === width && h === height) return; width = w; height = h; portrait = w / h < 0.85;
    renderer.setSize(w, h, false); composer.setSize(w, h); composer.setPixelRatio(renderer.getPixelRatio());
    camera.aspect = w / h; camera.fov = portrait ? 62 : 44; camera.updateProjectionMatrix();
    film.uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    pass.card.scale.setScalar(portrait ? 0.72 : 1);
  }

  let nextDecision = 0.6, time = 0;
  const decide = () => { const r = Math.random(); return lock > 0.5 ? 'deny' : r < 0.68 ? 'allow' : r < 0.84 ? 'ask' : 'deny'; };
  const tmpV = v3(0, 0, 0);
  function step(dt) {
    time += dt; shared.uTime.value = time;
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.pow(0.02, dt)); pointer.sy += (pointer.y - pointer.sy) * (1 - Math.pow(0.02, dt));
    velTarget *= Math.pow(0.04, dt); velocity += (velTarget - velocity) * (1 - Math.pow(0.02, dt));
    const k = 1 - Math.pow(0.0012, dt);
    cur.p.lerp(tgt.p, k); cur.l.lerp(tgt.l, k);
    for (const key of KEYS) cur[key] += (tgt[key] - cur[key]) * k;
    lock += ((override === 'closed' ? 1 : 0) - lock) * (1 - Math.pow(0.02, dt));
    shared.uAlert.value = lock * 0.85;
    if (intro) { intro.t += dt * intro.speed; fade = smooth(clamp01(intro.t / 2.2)); if (intro.t >= 2.6) { const d = intro.done; intro = null; d?.(); } } else fade = Math.min(1, fade + dt * 2);

    const cz = cur.p.z, inTube = cz < PORTAL.z - 1.5, onGround = cur.p.y < 6;
    const introLift = intro ? 1 - smooth(clamp01(intro.t / 2.6)) : 0;
    const hover = inTube ? 0 : onGround ? 0.35 : 1;
    camera.position.copy(cur.p).add(tmpV.set(Math.sin(time * 0.31) * 0.25 * hover, Math.sin(time * 0.43) * 0.18 * hover + introLift * 34, introLift * 70));
    camera.lookAt(cur.l);
    camera.rotateZ(cur.roll * Math.sin(time * 0.2) + (inTube ? Math.sin(time * 0.08) * 0.25 : 0));
    camera.rotateY(-pointer.sx * 0.012); camera.rotateX(-pointer.sy * 0.008);
    const cx = portrait ? 0.5 : cur.cx, cy = portrait ? Math.min(cur.cy, 0.42) : cur.cy;
    camera.setViewOffset(width, height, -(cx - 0.5) * width, -(cy - 0.5) * height, width, height);
    camera.updateMatrixWorld();
    skyMat.uniforms.uInvProj.value.copy(camera.projectionMatrixInverse); skyMat.uniforms.uCamWorld.value.copy(camera.matrixWorld);
    skyMat.uniforms.uPortalDir.value.set(0, PORTAL.y, PORTAL.z).sub(camera.position).normalize();

    city.visible = skyMesh.visible = cz > PORTAL.z - 25; rn.mesh.visible = !inTube;
    torii.visible = floor.visible = cz < -170 && cz > PORTAL.z - 25;
    tunnel.visible = cz < PORTAL.z + 40;
    vortexMat.uniforms.uOn.value = smooth(clamp01((cz - PORTAL.z - 1) / 40));
    // the portal's glow layers only exist up close; from the city it is a crisp ring on the horizon
    aura.visible = vortex.visible = !inTube && cz < -330;
    checkpoint.visible = cz > -240;
    swarmU.uInside.value = inTube ? 1 : smooth(span(-cz, -PORTAL.z - 20, -PORTAL.z - 1));
    swarmU.uLock.value = lock; swarmU.uPx.value = acMat.uniforms.uPx.value = renderer.getPixelRatio();

    if (city.visible) {
      for (let i = 0; i < T; i++) { const o = flights[i]; o.z += o.v * dt * (1 + velocity * 2); if (o.z > 100) o.z = -560; if (o.z < -560) o.z = 100; dm.position.set(o.x, o.y, o.z); dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1 + Math.abs(o.v) / 30 + velocity * 2); dm.updateMatrix(); traffic.setMatrixAt(i, dm.matrix); traffic.setColorAt(i, tc.copy(o.c).lerp(KIND.deny, lock)); }
      traffic.instanceMatrix.needsUpdate = traffic.instanceColor.needsUpdate = true;
      cones.forEach(g => { g.rotation.z = Math.sin(time * g.userData.s + g.userData.p) * 0.5; g.rotation.x = Math.cos(time * g.userData.s * 0.8 + g.userData.p) * 0.35; });
    }

    // the passport: momentum, the user's open/closed, hover scan
    if (checkpoint.visible) {
      if (!pi.dragging) { pi.yaw += pi.vy * dt; pi.pitch += pi.vx * dt; pi.vy *= Math.pow(0.15, dt); pi.vx *= Math.pow(0.15, dt); pi.pitch *= Math.pow(0.3, dt); }
      animatePassport(pass, dt, time, pi.open ? 1 : 0, {sx: 0, sy: 0});
      pass.card.rotation.y += pi.yaw; pass.card.rotation.x += pi.pitch;
      pass.card.position.x = -0.35 * pass.open;
      pi.hover += ((pi.hoverOn ? 1 : 0) - pi.hover) * (1 - Math.pow(0.02, dt));
      halo.position.copy(camera.position).sub(CARD).normalize().multiplyScalar(-2.6); halo.lookAt(camera.position);
      scanRings.forEach((r, i) => { r.rotation.z = time * (i % 2 ? 0.4 : -0.3) * (1 + pi.hover * 3); });
      scanMat.opacity = 0.5 + pi.hover * 0.5;
      scanSheet.position.set(-0.35 * pass.open, Math.sin(time * (1.6 + pi.hover * 2)) * 0.9, 0.6); scanSheet.visible = pass.open < 0.3; scanSheet.lookAt(camera.position);
    }

    if (torii.visible) {
      for (let i = 0; i < N; i++) {
        gateFlash[i] = Math.max(0, gateFlash[i] - dt * 2.4);
        tc.copy(gateCol[i]).lerp(KIND.deny, lock).multiplyScalar(2.2).lerp(flashCol[i], gateFlash[i]);
        tubesV.setColorAt(i * 2, tc); tubesV.setColorAt(i * 2 + 1, tc); tubesK.setColorAt(i, tc);
      }
      tubesV.instanceColor.needsUpdate = tubesK.instanceColor.needsUpdate = true;
      greatNeon.color.set(NEON.red).lerp(RED, lock).multiplyScalar(2.4 + Math.sin(time * 2) * 0.3);
      calls.forEach((c, i) => {
        if (c.hold > 0) { c.hold -= dt; if (c.hold <= 0) { c.kind = Math.random() < 0.7 && lock < 0.5 ? 'allow' : 'deny'; c.back = c.kind === 'deny' ? 1 : 0; } }
        else c.z += (c.back ? 6 : -c.v) * dt;
        const gi = Math.floor((TORII.z0 - c.z) / TORII.gap);
        if (gi !== c.gate && gi >= 0 && gi < N && !c.back) {
          c.gate = gi;
          if (gi % 9 === 4) { c.kind = lock > 0.5 ? 'deny' : c.fate < 0.62 ? 'allow' : c.fate < 0.8 ? 'ask' : 'deny'; if (c.kind === 'ask') c.hold = 1.4; if (c.kind === 'deny') c.back = 1; gateFlash[gi] = 1; flashCol[gi].copy(KIND[c.kind]).multiplyScalar(1.3); }
        }
        if (c.z < TORII.z1 - 4 || c.z > TORII.z0 + 8 || (c.back && c.z > TORII.z0 - c.gate * TORII.gap + 8)) respawn(c);
        dm.position.set(c.x, c.y, c.z); dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, c.hold > 0 ? 0.3 : 1); dm.updateMatrix(); comets.setMatrixAt(i, dm.matrix); comets.setColorAt(i, KIND[c.kind]);
      });
      comets.instanceMatrix.needsUpdate = comets.instanceColor.needsUpdate = true;
    }

    ringMat.color.set(NEON.cyan).lerp(RED, lock).multiplyScalar(2.4 + lock * Math.max(0, Math.sin(time * 9)) * 1.5);
    tickRing.rotation.z = time * 0.05 * (1 + velocity * 4);
    portalLight.color.set(NEON.cyan).lerp(RED, lock);
    arcs.forEach(a => {
      a.t -= dt;
      if (a.t <= 0) {
        a.t = rand(0.06, 0.18); const start = rand(0, TAU), len = rand(0.3, 0.9), pos = a.l.geometry.attributes.position.array;
        for (let i = 0; i < 26; i++) { const ang = start + len * (i / 25), rr = PORTAL.r + (i === 0 || i === 25 ? 0 : rand(-0.9, 0.9)); pos.set([Math.cos(ang) * rr, Math.sin(ang) * rr, rand(-0.4, 0.4)], i * 3); }
        a.l.geometry.attributes.position.needsUpdate = true; a.l.visible = Math.random() < 0.6;
        a.l.material.color.set(lock > 0.5 ? 0xff5060 : 0xbff4ff).multiplyScalar(3);
      }
    });

    if (tunnel.visible) {
      tubeMat.uniforms.uFlow.value = time * (12 + velocity * 60);
      irises.forEach(g => {
        const d = g.userData.z - cz;
        const open = g.userData.last ? smooth(span(d, -105, -70)) : smooth(span(d, -80, -30));
        g.userData.bl.forEach(b => { b.children[0].scale.y = Math.max(0.0001, 1 - open); });
        g.rotation.z = time * 0.12 + open * 1.4;
      });
      edgeMat.color.set(NEON.cyan).lerp(RED, lock).multiplyScalar(2.2);
      pk.forEach((o, i) => { o.z += o.v * dt * (1 + velocity * 2); if (o.z > PORTAL.z) o.z = TUBE.z1; dm.position.set(Math.cos(o.a) * o.r, PORTAL.y + Math.sin(o.a) * o.r, o.z); dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1 + o.v / 30 + velocity * 3); dm.updateMatrix(); packets.setMatrixAt(i, dm.matrix); packets.setColorAt(i, o.c); });
      packets.instanceMatrix.needsUpdate = packets.instanceColor.needsUpdate = true;
      for (let i = 0; i < SCR; i++) { const a = (i / SCR) * TAU + time * 0.08, z = -695 - (i % 3) * 7; dm.position.set(Math.cos(a) * 5.6, PORTAL.y + Math.sin(a) * 5.6, z); dm.rotation.set(0, 0, a - PI / 2); dm.scale.setScalar(1); dm.updateMatrix(); screens.setMatrixAt(i, dm.matrix); }
      screens.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < PS; i++) { const u = ((time * 0.06 + i / PS) % 1), z = -855 + u * 80, a = i * 2.4 + u * 3; dm.position.set(Math.cos(a) * 4.8, PORTAL.y + Math.sin(a) * 4.8, z); dm.rotation.set(0, Math.sin(a) * 0.5, a * 0.15); dm.scale.setScalar(Math.max(0.0001, Math.min(1, u * 5, (1 - u) * 5))); dm.updateMatrix(); passes.setMatrixAt(i, dm.matrix); }
      passes.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < HX; i++) { const strand = i % 2, j = Math.floor(i / 2), z = -905 - j * 0.6, a = j * 0.28 + strand * PI + time * 0.5; dm.position.set(Math.cos(a) * 3.2, PORTAL.y + Math.sin(a) * 3.2, z); dm.scale.setScalar(1); dm.lookAt(camera.position); dm.updateMatrix(); helix.setMatrixAt(i, dm.matrix); }
      helix.instanceMatrix.needsUpdate = true;
      stackRings.forEach((m, k) => { m.material.map.offset.x = time * 0.01 * (k + 1) * (k % 2 ? -1 : 1); });
    }
    rn.update(time, camera.position.clone().add(tmpV.set(0, 0, -14)));

    bloom.strength = 0.75 + lock * 0.2;
    film.uniforms.uTime.value = time; film.uniforms.uDim.value = cur.dim; film.uniforms.uFade.value = fade; film.uniforms.uAlert.value = lock;
    film.uniforms.uAb.value = 0.0006 + velocity * 0.0025;
    nextDecision -= dt;
    if (nextDecision <= 0) { nextDecision = 0.35 + Math.random() * 0.9; onDecision?.(decide()); }
  }
  function draw() { composer.render(); onFrame?.({}, {stage: f, closed: lock, alert: lock, intro: !!intro}); }

  let ema = 0.016, quality = 2, frames = 0, settleUntil = 60, raf = 0, running = false;
  const lockHigh = new URLSearchParams(location.search).get('q') === 'high';
  const clock = new THREE.Clock();
  function frame() {
    if (!running) return;
    const raw = clock.getDelta(); ema = ema * 0.94 + Math.min(raw, 0.2) * 0.06; frames++;
    if (quality > 0 && !lockHigh && frames > settleUntil && ema > 0.034) { quality--; settleUntil = frames + 90; renderer.setPixelRatio(quality === 1 ? 1 : 0.8); width = 0; resize(); }
    step(Math.min(raw, 0.05)); draw(); raf = requestAnimationFrame(frame);
  }
  const start = () => { if (running || reduced) return; running = true; clock.getDelta(); raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  const onVis = () => (document.hidden ? stop() : start());
  const onMove = e => { pointer.x = (e.clientX / innerWidth - 0.5) * 2; pointer.y = (e.clientY / innerHeight - 0.5) * 2; };
  addEventListener('pointermove', onMove, {passive: true});
  document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(() => { resize(); if (!running) { step(0.016); draw(); } }); ro.observe(canvas);
  resize();
  try { renderer.compile(scene, camera); } catch { /* compiled on first draw */ }
  if (reduced) { for (let i = 0; i < 60; i++) step(0.03); draw(); } else start();

  const snap = () => { cur.p.copy(tgt.p); cur.l.copy(tgt.l); for (const k of KEYS) cur[k] = tgt[k]; };
  return {
    setStage(x) { f = x; aim(x); if (reduced) { snap(); step(0.016); draw(); } },
    setVelocity(v) { velTarget = Math.max(velTarget, Math.min(1, v)); },
    intro(done) { if (reduced) { done?.(); return; } fade = 0; intro = {t: 0, speed: 1, done}; },
    skipIntro() { if (intro) intro.speed = 3; },
    setIris(mode) { override = mode; },
    /** The passport's hit area drives it: drag turns it, a click opens or closes it, hovering scans it. */
    passInput(kind, dx = 0, dy = 0) {
      if (kind === 'down') { pi.dragging = true; pi.moved = 0; }
      else if (kind === 'drag' && pi.dragging) { pi.moved += Math.abs(dx) + Math.abs(dy); pi.yaw += dx * 0.006; pi.pitch = Math.max(-0.5, Math.min(0.5, pi.pitch + dy * 0.005)); pi.vy = dx * 0.06; pi.vx = dy * 0.04; }
      else if (kind === 'up') { if (pi.dragging && pi.moved < 6) pi.open = !pi.open; pi.dragging = false; }
      else if (kind === 'enter') pi.hoverOn = true;
      else if (kind === 'leave') { pi.hoverOn = false; pi.dragging = false; }
      return pi.open;
    },
    state() { return {f, cam: camera.position.toArray().map(v => +v.toFixed(1))}; },
    settle(n = 60) { if (intro) { const d = intro.done; intro = null; d?.(); } snap(); fade = 1; for (let i = 0; i < n; i++) step(0.033); draw(); },
    destroy() {
      stop(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); removeEventListener('pointermove', onMove);
      scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { x.map?.dispose?.(); x.dispose(); }); });
      composer.dispose(); renderer.dispose(); pmrem.dispose();
    },
  };
}
