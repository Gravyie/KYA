import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {NEON, rand, fontsReady, signMesh, WORDS, towerMaterial, towers, rain} from '../lab/base.js';
import {buildPassport, animatePassport} from '../lab/artifact.js';

/*
 * 見張り · THE WATCH LINE. One world, one unbroken flight, for the whole page.
 *
 *   z    60 … -300   the megacity from the air: holograms on the towers, searchlights, traffic lanes. Far ahead,
 *                    on the horizon, a vast portal made of the swarm, agents streaming to it across the sky.
 *   z  -125          a checkpoint hovering over the city, where the agent's passport is scanned (Identify)
 *   z -300 … -545    down onto a flooded street: the Senbon Torii path. Agents walk the gates and are stamped;
 *                    the city beside it dissolves into wireframe as you near the portal (Decide, Prove)
 *   z -560           the swarm portal: a ring of tens of thousands of agents. Revoke throws them all back
 *   z -560 … -1300   through it, the wormhole: an endless data tunnel the swarm pours into (the rest of the page)
 *   z -1240          the last iris gate (finale)
 *
 * Scroll is travel. Each chapter is a camera pose on the path; between them the camera flies, never cuts.
 */

const PI = Math.PI, TAU = PI * 2;
const PORTAL = {z: -560, y: 16, r: 17};
const TUBE = {z0: -566, z1: -1320, r: 9, y: 16};
const TORII = {z0: -300, z1: -545, gap: 2.7};
const CARD = new THREE.Vector3(0, 22, -125);

// Each stage: camera position p, look target l, where the view's centre sits on screen (cx, cy), how far the world
// sits back behind the copy (dim), and the agent swarm's state.
const P = (p, l, o = {}) => ({p, l, cx: 0.5, cy: 0.5, dim: 0, roll: 0, open: 0, ...o});
const STAGES = [
  /* 0 hero      */ P([0, 46, 80], [0, 26, -300], {cx: 0.64, cy: 0.46, dim: 0.05}),
  /* 1 identify  */ P([2.0, 22.6, -118.6], [0.2, 22, -125], {cx: 0.76, dim: 0.05, open: 1}),
  /* 2 decide    */ P([0.5, 1.7, -305], [0, 2.8, -345], {dim: 0.45}),
  /* 3 prove     */ P([-0.5, 1.3, -420], [0.3, 2.6, -470], {cx: 0.68, dim: 0.2}),
  /* 4 contain   */ P([0, 7, -482], [0, 15, -560], {cx: 0.66, dim: 0.05}),
  /* 5 console   */ P([0, 16, -650], [0, 16, -720], {dim: 0.55, roll: 0.2}),
  /* 6 passport  */ P([0, 16, -740], [0, 16, -810], {dim: 0.5, roll: -0.25}),
  /* 7 integrate */ P([0, 16, -830], [0, 16, -900], {dim: 0.55, roll: 0.3}),
  /* 8 cases     */ P([0, 16, -920], [0, 16, -990], {dim: 0.55, roll: -0.2}),
  /* 9 stack     */ P([0, 16, -1010], [0, 16, -1080], {dim: 0.5, roll: 0.15}),
  /* 10 finale   */ P([0, 16, -1170], [0, 16, -1240], {dim: 0.1}),
  /* 11 hold     */ P([0, 16, -1170], [0, 16, -1240], {dim: 0.1}),
];

const smooth = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = x => Math.min(1, Math.max(0, x));
const span = (x, a, b) => clamp01((x - a) / (b - a));

const FILM = {
  uniforms: {tDiffuse: {value: null}, uTime: {value: 0}, uAb: {value: 0.0006}, uGrain: {value: 0.04}, uVig: {value: 0.6}, uDim: {value: 0}, uFade: {value: 1}, uRes: {value: new THREE.Vector2(1, 1)}, uAlert: {value: 0}},
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uAb, uGrain, uVig, uDim, uFade, uAlert; uniform vec2 uRes; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){ vec2 c = vUv - 0.5; float r = dot(c, c); vec2 ab = c * uAb * 10.0 * (0.4 + r * 3.0);
      vec3 col = vec3(texture2D(tDiffuse, vUv + ab).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - ab).b);
      float l = dot(col, vec3(0.3, 0.55, 0.15));
      col = mix(col, vec3(l * 1.6, l * 0.12, l * 0.18), uAlert * 0.55);
      col *= 0.97 + 0.03 * sin(vUv.y * uRes.y * 1.6);
      col *= 1.0 - uVig * smoothstep(0.1, 0.72, r * 1.9);
      col *= (1.0 - uDim * 0.55) * uFade;
      col += (hash(vUv * uRes + fract(uTime) * 61.0) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0); }`,
};

/* ── the sky over the city, and its reflection in the flood ── */
const SKY = `varying vec2 vNdc; uniform mat4 uInvProj, uCamWorld; uniform float uTime, uAlert;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
vec3 sky(vec3 d){
  float e = d.y;
  vec3 col = mix(vec3(0.42, 0.1, 0.3), vec3(0.015, 0.012, 0.045), smoothstep(-0.02, 0.4, e));
  float cl = fbm(vec2(d.x / (abs(e) + 0.15) * 0.9 + uTime * 0.01, e * 6.0));
  col = mix(col, vec3(0.5, 0.18, 0.36), smoothstep(0.55, 0.9, cl) * smoothstep(0.3, 0.02, e) * 0.45);
  // the portal's glow on the clouds, straight ahead
  float ahead = max(0.0, -d.z); col += mix(vec3(0.2, 0.7, 1.0), vec3(1.0, 0.1, 0.2), uAlert) * pow(ahead, 40.0) * exp(-abs(e - 0.04) * 8.0) * 0.5;
  vec2 st = floor(d.xz / max(e, 0.05) * 80.0); col += step(0.997, hash(st)) * smoothstep(0.15, 0.4, e) * 0.8;
  return mix(col, vec3(0.25, 0.0, 0.03) * (0.5 + col.r), uAlert * 0.6);
}
void main(){
  vec4 v = uInvProj * vec4(vNdc, 1.0, 1.0); vec3 d = normalize((uCamWorld * vec4(normalize(v.xyz / v.w), 0.0)).xyz);
  vec3 col;
  if (d.y >= 0.0) col = sky(d);
  else { // the flood: the sky smeared by ripples
    vec2 g = d.xz / max(-d.y, 0.02);
    float rip = fbm(g * 0.8 + vec2(0.0, uTime * 0.4)) - 0.5;
    col = sky(normalize(vec3(d.x + rip * 0.03, -d.y * 0.8, d.z))) * (0.35 + 0.25 * fbm(g * 2.0));
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export function createWorld(canvas, {onDecision, onFrame, reduced = false, small = false} = {}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.25 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x120822, 0.0045);
  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 1600);
  scene.add(camera);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0x7a6cff, 0x22081c, 0.75));
  const dm = new THREE.Object3D(), tc = new THREE.Color();
  const shared = {uTime: {value: 0}, uAlert: {value: 0}};

  const skyMat = new THREE.ShaderMaterial({vertexShader: 'varying vec2 vNdc; void main(){ vNdc = position.xy; gl_Position = vec4(position.xy, 1.0, 1.0); }', fragmentShader: SKY, depthTest: false, depthWrite: false,
    uniforms: {uInvProj: {value: new THREE.Matrix4()}, uCamWorld: {value: new THREE.Matrix4()}, uTime: shared.uTime, uAlert: shared.uAlert}});
  const skyMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat); skyMesh.frustumCulled = false; skyMesh.renderOrder = -1000; scene.add(skyMesh);

  /* ── 1 · THE MEGACITY ─────────────────────────────────── */
  const city = new THREE.Group(); scene.add(city);
  const tmat = towerMaterial({fogColor: 0x170a28, fogFar: 300, windowScale: [1.1, 1.3]});
  tmat.uniforms.uTime = shared.uTime; tmat.uniforms.uAlert = shared.uAlert;
  const lots = [];
  for (let i = 0; i < (small ? 800 : 1600); i++) {
    const x = rand(-280, 280), z = rand(-640, 90), ax = Math.abs(x);
    if (z > -290 && ax < 12) continue;                         // the avenue the flight follows
    if (z <= -290 && ax < 9) continue;                         // the torii path
    if (z < -520 && z > -600 && ax < 34) continue;             // the plaza around the portal
    const avenue = z > -290 && ax < 30, path = z <= -290 && ax < 22;
    const h = avenue ? rand(6, 18) : path ? rand(8, 26) : rand(18, 80) * (Math.random() < 0.08 ? 1.7 : 1);
    lots.push({x, z, w: path ? rand(3, 6) : rand(7, 16), d: path ? rand(3, 6) : rand(7, 16), h, y0: 0});
  }
  // the towers near the torii path, mirrored in the flood, wear the dissolve; they are their own mesh
  const nearMat = towerMaterial({fogColor: 0x170a28, fogFar: 120, windowScale: [0.6, 0.7]});
  nearMat.uniforms.uTime = shared.uTime; nearMat.uniforms.uAlert = shared.uAlert;
  const farLots = lots.filter(o => !(o.z <= -290 && Math.abs(o.x) < 22)), nearLots = lots.filter(o => o.z <= -290 && Math.abs(o.x) < 22);
  city.add(towers(farLots.length, tmat, i => farLots[i]));
  const nearCity = towers(nearLots.length, nearMat, i => nearLots[i]); city.add(nearCity);
  const nearMirror = nearCity.clone(); nearMirror.scale.y = -1; city.add(nearMirror);
  // holograms on the tower faces along the avenue
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
  const H = 30, holos = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), holoMat, H);
  const kinds = new Float32Array(H), cols = new Float32Array(H * 3);
  for (let i = 0; i < H; i++) {
    const side = i % 2 ? 1 : -1;
    dm.position.set(side * rand(30, 44), rand(26, 52), 40 - i * 11); dm.rotation.set(0, side * -0.75, 0); dm.scale.set(rand(12, 20), rand(22, 36), 1); dm.updateMatrix(); holos.setMatrixAt(i, dm.matrix);
    kinds[i] = i % 3; new THREE.Color([NEON.cyan, NEON.mag, NEON.violet, NEON.amber][i % 4]).multiplyScalar(1.5).toArray(cols, i * 3);
  }
  holos.geometry.setAttribute('aKind', new THREE.InstancedBufferAttribute(kinds, 1)); holos.geometry.setAttribute('aCol', new THREE.InstancedBufferAttribute(cols, 3));
  city.add(holos);
  // searchlights sweeping the smog
  const coneMat = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; varying float vFace; void main(){ vUv = uv; vec3 n = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vFace = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec2 vUv; varying float vFace; void main(){ float a = pow(vFace, 3.0) * vUv.y * 0.1; gl_FragColor = vec4(vec3(0.6, 0.8, 1.0) * a, 1.0); }'});
  const cones = [];
  for (let i = 0; i < 6; i++) { const g = new THREE.Group(); g.position.set(rand(-140, 140) || 60, 45, rand(-420, -40)); const c = new THREE.Mesh(new THREE.ConeGeometry(16, 300, 28, 1, true), coneMat); c.position.y = 150; c.rotation.x = PI; g.add(c); g.userData = {p: rand(0, 6), s: rand(0.2, 0.4)}; city.add(g); cones.push(g); }
  // air traffic in lanes, and signs on the avenue
  const T = small ? 120 : 240, traffic = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.2, 3), new THREE.MeshBasicMaterial({toneMapped: false}), T);
  traffic.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(T * 3), 3);
  const flights = Array.from({length: T}, (_, i) => ({x: rand(-120, 120), y: [16, 26, 36, 50][i % 4] + rand(-1, 1), z: rand(-560, 80), v: rand(20, 45) * (i % 2 ? 1 : -1), c: new THREE.Color([NEON.amber, NEON.bone, NEON.red, NEON.cyan][i % 4]).multiplyScalar(2.4)}));
  city.add(traffic);
  fontsReady().then(() => {
    for (let i = 0; i < 26; i++) {
      const word = WORDS[i % WORDS.length], v = /[^A-Z0-9]/.test(word);
      const m = signMesh(word, ['#ff2fa6', '#19e6ff', '#ffb21f', '#9a6bff'][i % 4], v ? rand(8, 14) : rand(4, 6), v);
      const side = i % 2 ? 1 : -1; m.position.set(side * rand(13, 20), rand(12, 30), 20 - i * 12); m.rotation.y = -side * PI / 2 * 0.8; city.add(m);
    }
  });

  /* ── 2 · THE CHECKPOINT, and the passport ─────────────── */
  const checkpoint = new THREE.Group(); checkpoint.position.copy(CARD); scene.add(checkpoint);
  const pass = buildPassport(); pass.card.scale.setScalar(0.62); checkpoint.add(pass.card);
  const scanMat = new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.cyan).multiplyScalar(2), transparent: true, opacity: 0.7, toneMapped: false, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending});
  const scanRings = [2.2, 2.6, 3.4].map((r, i) => { const m = new THREE.Mesh(new THREE.RingGeometry(r, r + (i === 1 ? 0.012 : 0.03), 96), scanMat); m.rotation.x = -PI / 2; m.position.y = -1.6 - i * 0.05; checkpoint.add(m); return m; });
  const scanSheet = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.01), new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.cyan).multiplyScalar(3), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending})); checkpoint.add(scanSheet);
  const veil = new THREE.Mesh(new THREE.CircleGeometry(4.2, 64), new THREE.ShaderMaterial({transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; void main(){ float r = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(0.01, 0.01, 0.03, smoothstep(1.0, 0.2, r) * 0.82); }'}));
  veil.position.z = -1.6; veil.renderOrder = -1; checkpoint.add(veil);
  const keyLight = new THREE.PointLight(NEON.cyan, 30, 14); keyLight.position.set(-3, 2, 3); checkpoint.add(keyLight);
  const rimLight = new THREE.PointLight(NEON.mag, 40, 14); rimLight.position.set(3, -1, -2); checkpoint.add(rimLight);

  /* ── 3 · SENBON TORII ─────────────────────────────────── */
  const torii = new THREE.Group(); scene.add(torii);
  const toriiMirror = new THREE.Group(); toriiMirror.scale.y = -1; scene.add(toriiMirror);
  const N = Math.floor((TORII.z0 - TORII.z1) / TORII.gap);
  const lacquer = new THREE.MeshStandardMaterial({color: 0x3a0806, metalness: 0.3, roughness: 0.35, emissive: 0x6a0c06, emissiveIntensity: 0.9});
  const neonMat = new THREE.MeshBasicMaterial({toneMapped: false});
  const pillarGeo = new THREE.CylinderGeometry(0.16, 0.2, 4.2, 12); pillarGeo.translate(0, 2.1, 0);
  const KW = 4.9, kasaShape = new THREE.Shape();
  kasaShape.moveTo(-KW / 2, 0.36); kasaShape.quadraticCurveTo(0, 0.08, KW / 2, 0.36); kasaShape.lineTo(KW / 2 - 0.12, 0); kasaShape.quadraticCurveTo(0, -0.22, -KW / 2 + 0.12, 0); kasaShape.closePath();
  const kasaGeo = new THREE.ExtrudeGeometry(kasaShape, {depth: 0.4, bevelEnabled: false, curveSegments: 24}); kasaGeo.translate(0, 4.25, -0.2);
  const nukiGeo = new THREE.BoxGeometry(3.9, 0.2, 0.22); nukiGeo.translate(0, 3.55, 0);
  const tubeV = new THREE.BoxGeometry(0.045, 3.9, 0.045); tubeV.translate(0, 2.05, 0.2);
  const tubeK = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-KW / 2 + 0.12, 4.25, 0.22), new THREE.Vector3(0, 4.03, 0.22), new THREE.Vector3(KW / 2 - 0.12, 4.25, 0.22)), 40, 0.028, 5, false);
  const pillars = new THREE.InstancedMesh(pillarGeo, lacquer, N * 2), kasa = new THREE.InstancedMesh(kasaGeo, lacquer, N), nuki = new THREE.InstancedMesh(nukiGeo, lacquer, N);
  const tubesV = new THREE.InstancedMesh(tubeV, neonMat, N * 2), tubesK = new THREE.InstancedMesh(tubeK, neonMat, N);
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
  toriiParts.forEach(m => { const c = m.clone(); if (m.instanceColor) c.instanceColor = m.instanceColor; toriiMirror.add(c); });
  fontsReady().then(() => { for (let i = 0; i < N; i += 9) { const m = signMesh(['関門', '識別', '審判', '記録', '封鎖', '見張り', '認証', '中枢', '通行証'][(i / 9) % 9], '#ffb21f', 0.62, true); m.position.set(0, 3.15, gateZ[i] + 0.15); torii.add(m); } });
  const floodVeil = new THREE.Mesh(new THREE.PlaneGeometry(80, 300), new THREE.MeshBasicMaterial({color: 0x05030a, transparent: true, opacity: 0.5, depthWrite: false}));
  floodVeil.rotation.x = -PI / 2; floodVeil.position.set(0, 0.01, -430); floodVeil.renderOrder = -10; scene.add(floodVeil);
  // agents walking the path, stamped at every ninth gate
  const C = 30, comets = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.03, 0.7, 4, 8).rotateX(PI / 2), new THREE.MeshBasicMaterial({toneMapped: false}), C);
  comets.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(C * 3), 3); torii.add(comets);
  const KIND = {allow: new THREE.Color(NEON.jade).multiplyScalar(3), ask: new THREE.Color(NEON.amber).multiplyScalar(3), deny: new THREE.Color(NEON.red).multiplyScalar(3.5), neutral: new THREE.Color(NEON.bone).multiplyScalar(2.2)};
  const respawn = c => { c.x = rand(-1.1, 1.1); c.y = rand(0.6, 3.2); c.z = TORII.z0 + rand(0, 6); c.v = rand(5, 9); c.kind = 'neutral'; c.fate = Math.random(); c.gate = -1; c.back = 0; c.hold = 0; };
  const calls = Array.from({length: C}, () => { const c = {}; respawn(c); c.z -= rand(0, TORII.z0 - TORII.z1); return c; });

  /* ── 4 · THE SWARM PORTAL ─────────────────────────────── */
  const portal = new THREE.Group(); portal.position.set(0, PORTAL.y, PORTAL.z); scene.add(portal);
  const ringMat = new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.cyan).multiplyScalar(2.2), toneMapped: false});
  portal.add(new THREE.Mesh(new THREE.TorusGeometry(PORTAL.r, 0.3, 12, 240), ringMat));
  const ring2Mat = new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.mag).multiplyScalar(2), toneMapped: false});
  portal.add(new THREE.Mesh(new THREE.TorusGeometry(PORTAL.r + 1.4, 0.07, 6, 240), ring2Mat));
  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), ringMat, 144);
  for (let i = 0; i < 144; i++) { const a = (i / 144) * TAU; dm.position.set(Math.cos(a) * (PORTAL.r + 2.6), Math.sin(a) * (PORTAL.r + 2.6), 0); dm.rotation.set(0, 0, a - PI / 2); dm.scale.set(1, i % 12 === 0 ? 2.2 : 1, 1); dm.updateMatrix(); ticks.setMatrixAt(i, dm.matrix); }
  portal.add(ticks);
  // the portal's face: a vortex that looks down the tunnel beyond; it vanishes as you pass through
  const vortexMat = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: {uTime: shared.uTime, uAlert: shared.uAlert, uOn: {value: 1}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uTime, uAlert, uOn;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){ vec2 p = (vUv - 0.5) * 2.0; float r = length(p); if (r > 1.0) discard; float a = atan(p.y, p.x);
        float depth = 1.0 / max(r, 0.04);
        float rings = smoothstep(0.42, 0.5, abs(fract(depth * 0.9 - uTime * 0.8) - 0.5));
        float lanes = step(0.86, hash(vec2(floor(a / 6.2831853 * 60.0), 3.0))) * pow(fract(depth * 0.3 - uTime * 1.5 + hash(vec2(floor(a / 6.2831853 * 60.0), 1.0))), 8.0);
        vec3 c = mix(vec3(0.1, 0.8, 1.0), vec3(1.0, 0.2, 0.7), 0.5 + 0.5 * sin(depth * 0.4));
        c = mix(c, vec3(1.0, 0.1, 0.15), uAlert);
        vec3 col = c * (rings * 0.25 + lanes * 1.2) * smoothstep(0.0, 0.5, r) + c * exp(-r * r * 30.0) * 0.6;
        gl_FragColor = vec4(col * smoothstep(1.0, 0.85, r) * uOn, 1.0); }`});
  const vortex = new THREE.Mesh(new THREE.CircleGeometry(PORTAL.r - 0.2, 96), vortexMat); portal.add(vortex);
  const portalMirror = portal.clone(true); portalMirror.position.y = -PORTAL.y; portalMirror.scale.y = -1; scene.add(portalMirror);
  const portalLight = new THREE.PointLight(NEON.cyan, 40, 70, 1.5); portalLight.position.set(0, PORTAL.y, PORTAL.z + 6); scene.add(portalLight);
  // the swarm: agents from all over the sky converging on the portal and pouring through it
  const SN = small ? 24000 : 64000, seeds = new Float32Array(SN * 4);
  for (let i = 0; i < SN; i++) seeds.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SN * 3), 3)); sgeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const swarmMat = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {uTime: shared.uTime, uPx: {value: 1}, uLock: {value: 0}, uInside: {value: 0}},
    vertexShader: `attribute vec4 aSeed; uniform float uTime, uPx, uLock, uInside; varying vec3 vCol; varying float vA;
      void main(){
        float s = fract(aSeed.x + uTime * (0.03 + 0.015 * aSeed.w));
        float z = mix(-120.0, ${(PORTAL.z - 160).toFixed(1)}, s);
        float k = smoothstep(-120.0, ${PORTAL.z.toFixed(1)}, z);            // 0 out over the city, 1 at the portal
        float a = aSeed.y * 6.2831853 + uTime * 0.12 * (1.0 - k) + k * 1.5;
        float rad = mix(80.0 * sqrt(aSeed.z), ${(PORTAL.r - 2.5).toFixed(1)} * pow(aSeed.z, 0.4), pow(k, 1.4));
        vec3 p = vec3(cos(a) * rad, ${PORTAL.y.toFixed(1)} + sin(a) * rad * mix(0.35, 1.0, k) + 30.0 * (1.0 - k), z);
        p.x += sin(z * 0.02 + uTime * 0.3 + aSeed.w) * 24.0 * (1.0 - k) + sin(z * 0.09 + aSeed.y * 6.0) * 2.0 * (1.0 - k);
        p.y += cos(z * 0.017 + uTime * 0.25) * 10.0 * (1.0 - k);
        vec3 col = mix(vec3(0.75, 0.88, 1.0), vec3(0.2, 0.85, 1.0), aSeed.w);
        float verdict = fract(aSeed.z * 7.0);
        float past = ${PORTAL.z.toFixed(1)} - z;
        vA = 1.0;
        if (past > 0.0) {
          if (verdict < 0.12 + uLock) {          // denied: thrown back out of the portal, scattering red
            p.z = ${PORTAL.z.toFixed(1)} + past * 0.7; p.xy += normalize(vec2(cos(a), sin(a)) + 0.001) * past * (0.5 + aSeed.w);
            p.y += past * past * 0.002; col = vec3(1.0, 0.12, 0.2) * 1.5;
          } else if (verdict < 0.22 + uLock) {   // held for a human: orbiting the ring in amber
            float o = a + uTime * (0.5 + aSeed.w) + past * 0.04;
            p = vec3(cos(o) * (${PORTAL.r.toFixed(1)} + 0.8 + aSeed.w), ${PORTAL.y.toFixed(1)} + sin(o) * (${PORTAL.r.toFixed(1)} + 0.8 + aSeed.w), ${PORTAL.z.toFixed(1)} - mod(past, 6.0) * 0.3);
            col = vec3(1.0, 0.65, 0.15) * 1.3;
          } else {                               // allowed: into the tunnel, seen only from inside
            p.xy = vec2(p.x, p.y - ${PORTAL.y.toFixed(1)}) * mix(1.0, ${(TUBE.r - 1.5).toFixed(1)} / ${(PORTAL.r - 2.5).toFixed(1)}, smoothstep(0.0, 30.0, past)) + vec2(0.0, ${PORTAL.y.toFixed(1)});
            col = mix(vec3(0.2, 1.0, 0.55), vec3(0.2, 0.85, 1.0), aSeed.w); vA = uInside;
          }
        }
        vA *= smoothstep(0.0, 0.12, s) * (0.45 + 0.55 * aSeed.w);
        vCol = col;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp((1.4 + 2.4 * aSeed.w) * uPx * 90.0 / -mv.z, 1.0, 5.0 * uPx);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'varying vec3 vCol; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(vCol * smoothstep(1.0, 0.0, r) * vA * 0.8, 1.0); }'});
  const swarm = new THREE.Points(sgeo, swarmMat); swarm.frustumCulled = false; scene.add(swarm);

  /* ── 5 · THE WORMHOLE ─────────────────────────────────── */
  const tunnel = new THREE.Group(); scene.add(tunnel);
  const LEN = TUBE.z0 - TUBE.z1;
  const tubeMat = new THREE.ShaderMaterial({side: THREE.BackSide, uniforms: {uTime: shared.uTime, uAlert: shared.uAlert, uFlow: {value: 0}},
    vertexShader: 'varying vec3 vP; varying float vDepth; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `varying vec3 vP; varying float vDepth; uniform float uTime, uAlert, uFlow;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        float a = atan(vP.y, vP.x) / 6.2831853 + 0.5, z = vP.z + uFlow;
        vec2 p = vec2(a * 40.0, z * 0.32); p.x += step(0.5, fract(floor(p.y) * 0.5)) * 0.5;
        vec2 cell = floor(p), f = fract(p);
        float seam = max(smoothstep(0.93, 0.98, f.x), smoothstep(0.9, 0.97, f.y));
        float lit = step(0.93, hash(cell + floor(uTime * 0.5 + hash(cell) * 4.0)));
        float lane = floor(a * 48.0);
        float streak = step(0.8, hash(vec2(lane, 1.0))) * smoothstep(0.3, 0.0, abs(fract(a * 48.0) - 0.5)) * pow(fract(z * 0.02 + hash(vec2(lane, 2.0))), 14.0);
        float ring = smoothstep(0.485, 0.5, abs(fract(z / 40.0) - 0.5));
        vec3 tint = mix(vec3(0.1, 0.85, 1.0), vec3(1.0, 0.2, 0.7), 0.5 + 0.5 * sin(vP.z * 0.012));
        tint = mix(tint, vec3(1.0, 0.1, 0.15), uAlert);
        float panel = 0.5 + 0.5 * hash(cell);
        vec3 col = vec3(0.012, 0.014, 0.03) * panel + tint * (seam * 0.14 + lit * 0.2 * (1.0 - seam) + streak * 2.5 + ring * 1.4);
        col *= exp(-vDepth * 0.006);
        gl_FragColor = vec4(col, 1.0);
      }`});
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(TUBE.r, TUBE.r, LEN, 96, 1, true).rotateX(PI / 2), tubeMat);
  tube.position.set(0, TUBE.y, (TUBE.z0 + TUBE.z1) / 2); tunnel.add(tube);
  // irises along the tunnel, opening as you near them; the last one is the finale
  const bladeGeo = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-2.6, 0), new THREE.Vector2(2.6, 0), new THREE.Vector2(0, -8.6)]));
  const bladeMat = new THREE.MeshStandardMaterial({color: 0x0a0b14, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide});
  const edgeMat = new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.cyan).multiplyScalar(2.2), toneMapped: false});
  const irises = [-700, -790, -880, -970, -1060, -1240].map((z, k) => {
    const g = new THREE.Group(); g.position.set(0, TUBE.y, z); tunnel.add(g);
    g.add(new THREE.Mesh(new THREE.TorusGeometry(TUBE.r - 0.15, 0.1, 6, 120), edgeMat));
    const bl = []; for (let i = 0; i < 12; i++) { const b = new THREE.Group(), a = (i / 12) * TAU; b.position.set(Math.cos(a) * (TUBE.r - 0.2), Math.sin(a) * (TUBE.r - 0.2), 0); b.rotation.z = a + PI / 2; b.add(new THREE.Mesh(bladeGeo, bladeMat)); g.add(b); bl.push(b); }
    g.userData = {bl, z, last: k === 5}; return g;
  });
  // beyond the last gate: light
  const exit = new THREE.Mesh(new THREE.CircleGeometry(TUBE.r, 64), new THREE.MeshBasicMaterial({color: new THREE.Color(0.7, 0.95, 1).multiplyScalar(2.5), toneMapped: false}));
  exit.position.set(0, TUBE.y, TUBE.z1 + 2); tunnel.add(exit);
  const PK = 420, packets = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.05, 1.6), new THREE.MeshBasicMaterial({toneMapped: false}), PK);
  packets.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PK * 3), 3); tunnel.add(packets);
  const pk = Array.from({length: PK}, (_, i) => ({a: rand(0, TAU), r: rand(1.5, TUBE.r - 0.8), z: rand(TUBE.z1, TUBE.z0), v: rand(30, 70), c: new THREE.Color([NEON.cyan, NEON.mag, NEON.bone, NEON.jade][i % 4]).multiplyScalar(2.2)}));
  const rn = rain(small ? 600 : 1300, {size: [30, 20, 40], speed: [16, 24], length: 0.7, opacity: 0.32}); scene.add(rn.mesh);

  /* ── post ─────────────────────────────────────────────── */
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: small ? 0 : 4}));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.7, 0.5, 0.82);
  const bs = bloom.setSize.bind(bloom); bloom.setSize = (w, h) => bs(Math.ceil(w / 2), Math.ceil(h / 2));
  composer.addPass(bloom);
  const film = new ShaderPass(FILM); composer.addPass(film); composer.addPass(new OutputPass());

  /* ── rig ──────────────────────────────────────────────── */
  const pointer = {x: 0, y: 0, sx: 0, sy: 0, down: false};
  const cur = {p: new THREE.Vector3(...STAGES[0].p), l: new THREE.Vector3(...STAGES[0].l), cx: 0.64, cy: 0.46, dim: 0, roll: 0, open: 0};
  const tgt = {p: new THREE.Vector3(), l: new THREE.Vector3(), cx: 0.5, cy: 0.5, dim: 0, roll: 0, open: 0};
  let f = 0, velocity = 0, velTarget = 0, override = null, lock = 0, fade = 1, intro = null, width = 0, height = 0, portrait = false;
  function aim(x) {
    const i = Math.min(Math.max(Math.floor(x), 0), STAGES.length - 2), u = smooth(clamp01(x - i)), a = STAGES[i], b = STAGES[i + 1];
    tgt.p.set(...a.p).lerp(new THREE.Vector3(...b.p), u); tgt.l.set(...a.l).lerp(new THREE.Vector3(...b.l), u);
    for (const k of ['cx', 'cy', 'dim', 'roll', 'open']) tgt[k] = lerp(a[k], b[k], u);
  }
  aim(0);
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    if (w === width && h === height) return; width = w; height = h; portrait = w / h < 0.85;
    renderer.setSize(w, h, false); composer.setSize(w, h); composer.setPixelRatio(renderer.getPixelRatio());
    camera.aspect = w / h; camera.fov = portrait ? 62 : 44; camera.updateProjectionMatrix();
    film.uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    pass.card.scale.setScalar(portrait ? 0.62 : 0.8);
  }

  let nextDecision = 0.6, time = 0;
  const decide = () => { const r = Math.random(); return lock > 0.5 ? 'deny' : r < 0.68 ? 'allow' : r < 0.84 ? 'ask' : 'deny'; };
  function step(dt) {
    time += dt; shared.uTime.value = time;
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.pow(0.02, dt)); pointer.sy += (pointer.y - pointer.sy) * (1 - Math.pow(0.02, dt));
    velTarget *= Math.pow(0.04, dt); velocity += (velTarget - velocity) * (1 - Math.pow(0.02, dt));
    const k = 1 - Math.pow(0.0012, dt);
    cur.p.lerp(tgt.p, k); cur.l.lerp(tgt.l, k);
    for (const key of ['cx', 'cy', 'dim', 'roll', 'open']) cur[key] += (tgt[key] - cur[key]) * k;
    lock += ((override === 'closed' ? 1 : 0) - lock) * (1 - Math.pow(0.02, dt));
    shared.uAlert.value = lock * 0.85;
    if (intro) { intro.t += dt * intro.speed; fade = smooth(clamp01(intro.t / 2.2)); if (intro.t >= 2.4) { const d = intro.done; intro = null; d?.(); } } else fade = Math.min(1, fade + dt * 2);

    // camera: the pose on the path, a gentle hover, a touch of head-turn toward the cursor
    const cz = cur.p.z, inTube = cz < PORTAL.z - 2;
    const hover = inTube ? 0 : 1;
    const introLift = intro ? (1 - smooth(clamp01(intro.t / 2.4))) : 0;
    camera.position.copy(cur.p).add(new THREE.Vector3(Math.sin(time * 0.31) * 0.25 * hover, Math.sin(time * 0.43) * 0.18 * hover + introLift * 30, introLift * 60));
    camera.lookAt(cur.l);
    camera.rotateZ(cur.roll * Math.sin(time * 0.2) + (inTube ? time * 0.05 : 0));
    camera.rotateY(-pointer.sx * 0.014); camera.rotateX(-pointer.sy * 0.01);
    const cx = portrait ? 0.5 : cur.cx, cy = portrait ? Math.min(cur.cy, 0.42) : cur.cy;
    camera.setViewOffset(width, height, -(cx - 0.5) * width, -(cy - 0.5) * height, width, height);
    camera.updateMatrixWorld();
    skyMat.uniforms.uInvProj.value.copy(camera.projectionMatrixInverse); skyMat.uniforms.uCamWorld.value.copy(camera.matrixWorld);

    // what is near enough to matter
    city.visible = cz > PORTAL.z - 20; skyMesh.visible = city.visible; rn.mesh.visible = !inTube;
    torii.visible = toriiMirror.visible = floodVeil.visible = cz < -150 && cz > PORTAL.z - 20;
    tunnel.visible = cz < PORTAL.z + 3;
    vortexMat.uniforms.uOn.value = smooth(clamp01((cz - PORTAL.z - 1) / 30));
    checkpoint.visible = cz > -260;
    swarmMat.uniforms.uInside.value = inTube ? 1 : 0;

    // the city
    for (let i = 0; i < T; i++) { const o = flights[i]; o.z += o.v * dt * (1 + velocity * 2); if (o.z > 90) o.z = -560; if (o.z < -560) o.z = 90; dm.position.set(o.x, o.y, o.z); dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1 + Math.abs(o.v) / 30 + velocity * 2); dm.updateMatrix(); traffic.setMatrixAt(i, dm.matrix); traffic.setColorAt(i, tc.copy(o.c).lerp(KIND.deny, lock)); }
    traffic.instanceMatrix.needsUpdate = traffic.instanceColor.needsUpdate = true;
    cones.forEach(g => { g.rotation.z = Math.sin(time * g.userData.s + g.userData.p) * 0.5; g.rotation.x = Math.cos(time * g.userData.s * 0.8 + g.userData.p) * 0.35; });
    // the near towers dissolve into wireframe as they near the portal (and as you near them, a little)
    nearMat.uniforms.uWire.value = smooth(span(-cz, 330, 500));
    tmat.uniforms.uWire.value = 0;

    // the checkpoint
    if (checkpoint.visible) {
      // the dark halo sits behind the card, always between it and the city
      veil.position.copy(camera.position).sub(CARD).normalize().multiplyScalar(-1.8); veil.lookAt(camera.position);
      const open = pointer.down && cz > -200 ? 1 : cur.open;
      animatePassport(pass, dt, time, open, pointer);
      pass.card.position.x = -0.35 * pass.open;
      scanRings.forEach((r, i) => { r.rotation.z = time * (i % 2 ? 0.4 : -0.3); });
      scanSheet.position.set(0, Math.sin(time * 1.6) * 0.75, 0.4); scanSheet.visible = pass.open < 0.3;
    }

    // the torii: gate colour, verdict flashes, agents walking
    if (torii.visible) {
      for (let i = 0; i < N; i++) {
        gateFlash[i] = Math.max(0, gateFlash[i] - dt * 2.4);
        tc.copy(gateCol[i]).lerp(KIND.deny, lock).multiplyScalar(2.2).lerp(flashCol[i], gateFlash[i]);
        tubesV.setColorAt(i * 2, tc); tubesV.setColorAt(i * 2 + 1, tc); tubesK.setColorAt(i, tc);
      }
      tubesV.instanceColor.needsUpdate = tubesK.instanceColor.needsUpdate = true;
      calls.forEach((c, i) => {
        if (c.hold > 0) { c.hold -= dt; if (c.hold <= 0) { c.kind = Math.random() < 0.7 && lock < 0.5 ? 'allow' : 'deny'; c.back = c.kind === 'deny' ? 1 : 0; } }
        else c.z += (c.back ? 6 : -c.v) * dt;
        const gi = Math.floor((TORII.z0 - c.z) / TORII.gap);
        if (gi !== c.gate && gi >= 0 && gi < N && !c.back) {
          c.gate = gi;
          if (gi % 9 === 4) { c.kind = lock > 0.5 ? 'deny' : c.fate < 0.62 ? 'allow' : c.fate < 0.8 ? 'ask' : 'deny'; if (c.kind === 'ask') c.hold = 1.4; if (c.kind === 'deny') c.back = 1; gateFlash[gi] = 1; flashCol[gi].copy(KIND[c.kind]).multiplyScalar(1.3); }
        }
        if (c.z < TORII.z1 || c.z > TORII.z0 + 8 || (c.back && c.z > TORII.z0 - c.gate * TORII.gap + 8)) respawn(c);
        dm.position.set(c.x, c.y, c.z); dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, c.hold > 0 ? 0.3 : 1); dm.updateMatrix(); comets.setMatrixAt(i, dm.matrix); comets.setColorAt(i, KIND[c.kind]);
      });
      comets.instanceMatrix.needsUpdate = comets.instanceColor.needsUpdate = true;
    }

    // the portal
    swarmMat.uniforms.uLock.value = lock; swarmMat.uniforms.uPx.value = renderer.getPixelRatio();
    ringMat.color.set(NEON.cyan).lerp(KIND.deny, lock).multiplyScalar(2.2 + lock * Math.max(0, Math.sin(time * 9)) * 1.5);
    ticks.rotation.z = time * 0.06 * (1 + velocity * 4);
    portalLight.color.set(NEON.cyan).lerp(new THREE.Color(NEON.red), lock);

    // the tunnel: the plating flows past even when you stop; irises open as you near them
    if (tunnel.visible) {
      tubeMat.uniforms.uFlow.value = time * (14 + velocity * 60);
      irises.forEach(g => {
        const d = cz - g.userData.z;
        const open = g.userData.last ? smooth(span(-d, -95, -60)) : smooth(span(-d, -70, -25));
        g.userData.bl.forEach(b => { b.children[0].scale.y = Math.max(0.0001, 1 - open); });
        g.rotation.z = time * 0.15 + open * 1.2;
      });
      pk.forEach((o, i) => { o.z += o.v * dt * (1 + velocity * 2); if (o.z > TUBE.z0) o.z = TUBE.z1; dm.position.set(Math.cos(o.a) * o.r, TUBE.y + Math.sin(o.a) * o.r, o.z); dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1 + o.v / 30 + velocity * 3); dm.updateMatrix(); packets.setMatrixAt(i, dm.matrix); packets.setColorAt(i, o.c); });
      packets.instanceMatrix.needsUpdate = packets.instanceColor.needsUpdate = true;
      edgeMat.color.set(NEON.cyan).lerp(new THREE.Color(NEON.red), lock).multiplyScalar(2.2);
    }
    rn.update(time, camera.position.clone().add(new THREE.Vector3(0, 0, -14)));

    bloom.strength = 0.7 + lock * 0.2;
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
  const onDown = e => { if (e.target === canvas || e.target.closest?.('.scene, .hero')) pointer.down = true; }, onUp = () => { pointer.down = false; };
  addEventListener('pointermove', onMove, {passive: true}); addEventListener('pointerdown', onDown, {passive: true}); addEventListener('pointerup', onUp);
  document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(() => { resize(); if (!running) { step(0.016); draw(); } }); ro.observe(canvas);
  resize();
  try { renderer.compile(scene, camera); } catch { /* compiled on first draw instead */ }
  if (reduced) { for (let i = 0; i < 60; i++) step(0.03); draw(); } else start();

  const snap = () => { cur.p.copy(tgt.p); cur.l.copy(tgt.l); for (const k of ['cx', 'cy', 'dim', 'roll', 'open']) cur[k] = tgt[k]; };
  return {
    setStage(x) { f = x; aim(x); if (reduced) { snap(); step(0.016); draw(); } },
    setVelocity(v) { velTarget = Math.max(velTarget, Math.min(1, v)); },
    /** The opening: the city fades up out of the dark as the camera glides down to the first pose. */
    intro(done) { if (reduced) { done?.(); return; } fade = 0; intro = {t: 0, speed: 1, done}; },
    skipIntro() { if (intro) intro.speed = 3; },
    setIris(mode) { override = mode; },
    state() { return {f, cam: camera.position.toArray().map(v => +v.toFixed(1))}; },
    settle(n = 60) { if (intro) { const d = intro.done; intro = null; d?.(); } snap(); fade = 1; for (let i = 0; i < n; i++) step(0.033); draw(); },
    destroy() {
      stop(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis);
      removeEventListener('pointermove', onMove); removeEventListener('pointerdown', onDown); removeEventListener('pointerup', onUp);
      scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { x.map?.dispose?.(); x.dispose(); }); });
      composer.dispose(); renderer.dispose(); pmrem.dispose();
    },
  };
}
