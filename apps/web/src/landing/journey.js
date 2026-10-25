import * as THREE from 'three';
import {renderBudget, renderRatio} from './render-budget.js';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {NEON, fontsReady, towers, rain, glyphAtlas} from '../scene/base.js';
import {buildPassport, animatePassport, printTexture} from '../scene/artifact.js';
import {buildSwarmPortal} from './swarm-portal.js';
import {createParticlePhysics, PARTICLE_OFFSET} from './particle-physics.js';
import {PORTAL, FLOW, FLOW_PATH_GLSL, sampleFlow} from './flow-path.js';
import {buildWaterfront} from './waterfront.js';
import {SUN, SUNSET_SKY,createSkyNoise} from './sunset.js';
import {facadeMaterial, cityDetails, shopSign} from './architecture.js';
import {CITY_LOTS,CITY_SIGNATURE,seededRandom} from './world-layout.js';
import {createChapterPalette} from './chapter-palette.js';
import {SWARM_LIGHT_GLSL} from '../scene/swarm-style.js';
import {buildCityThreshold} from './landscape-edges.js';

/*
 * 見張り · THE WATCH LINE. One world, one unbroken flight, for the whole page.
 *
 * The swarm is the thread through all of it. Braided particles follow a golden spiral into one gateway.
 * The gateway stays fixed beyond the torii as the camera travels down to the street. Through
 * that gateway the same stream becomes the walls of the wormhole. Revoke closes its iris and rejects particles.
 *
 *   z   90 … -280   the megacity from the air (hero); a checkpoint hovers at z -125 where the passport is held
 *   z -292          the great entrance torii; then the Senbon Torii path, wet stone under neon
 *   z -524          the great exit torii, opening onto the shrine bay
 *   z -720          the swarm portal, beyond the suspended causeway
 *   z -720 … -1440  the wormhole: the swarm's walls, a set piece for every chapter, the last iris, light
 *
 * Scroll is travel. Each chapter is a camera pose; between them the camera flies on eased paths.
 */

const PI = Math.PI, TAU = PI * 2;
const TUBE = {z1: -1440, r: 9};
const TORII = {z0: -304, z1: -514, gap: 4.2, entry: -292, exit: -524};
const CARD = new THREE.Vector3(0, 22, -125);

// camera position p, look target l, view centre on screen (cx, cy), how far the world sits back (dim), roll
const P = (p, l, o = {}) => ({p, l, cx: 0.5, cy: 0.5, dim: 0, roll: 0, fov: 44, ...o});
export const STAGES = [
  /* 0 hero      */ P([0, 64, 120], [0, PORTAL.y, -720], {cx: 0.71, cy: 0.47}),
  /* 1 pass      */ P([0, 22.3, -116.3], [0, 22, -125], {cx: 0.265, cy: 0.47}),
  /* 2 entry     */ P([0, 1.7, -275], [0, PORTAL.y, -720], {cy: 0.6, fov: 56}),
  /* 3 decide    */ P([0.25, 1.6, -312], [0, 3.6, -380], {cy: 0.26, dim: 0.25}),
  /* 4 prove     */ P([-0.35, 1.45, -430], [0.25, 2.5, -480], {cx: 0.7, dim: 0.15}),
  /* 5 contain   */ P([0, 1.8, -555], [0, PORTAL.y, -720], {cx: 0.75, cy: 0.535, fov: 64}),
  /* 6 console   */ P([0, PORTAL.y, -785], [0, PORTAL.y, -865], {dim: 0.42, roll: 0.15}),
  /* 7 passport  */ P([0, PORTAL.y, -880], [0, PORTAL.y, -960], {dim: 0.42, roll: -0.2}),
  /* 8 integrate */ P([0, PORTAL.y, -985], [0, PORTAL.y, -1065], {dim: 0.45, roll: 0.2}),
  /* 9 cases     */ P([0, PORTAL.y, -1090], [0, PORTAL.y, -1170], {dim: 0.48, roll: -0.15}),
  /* 10 stack    */ P([0, PORTAL.y, -1195], [0, PORTAL.y, -1275], {dim: 0.42, roll: 0.1}),
  /* 11 finale   */ P([0, PORTAL.y, -1310], [0, PORTAL.y, -1410], {dim: 0.05}),
  /* 12 hold     */ P([0, PORTAL.y, -1310], [0, PORTAL.y, -1410], {dim: 0.05}),
];

const smooth = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = x => Math.min(1, Math.max(0, x));
const span = (x, a, b) => clamp01((x - a) / (b - a));
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

const FILM = {
  uniforms: {tDiffuse: {value: null}, uTime: {value: 0}, uAb: {value: 0.00015}, uGrain: {value: 0.005}, uVig: {value: 0.48}, uDim: {value: 0}, uFade: {value: 1}, uRes: {value: new THREE.Vector2(1, 1)}, uAlert: {value: 0}},
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

const SKY = SUNSET_SKY;

/* Shared by the particle heads, trails, and physics rest positions. One fixed golden spiral runs from the
   foreground to the gateway; downstream particles continue into the wormhole. Scrolling only moves the camera. */
const SWARM_FN = `
uniform float uTime, uLock, uInside, uPx, uCoilScale;
${FLOW_PATH_GLSL}
${SWARM_LIGHT_GLSL}

vec3 swarmAt(vec4 seed, float s, out vec3 col, out float a){
  float twist = seed.y * 6.2831853;
  col = mix(vec3(0.7, 0.86, 1.0), vec3(0.2, 0.85, 1.0), seed.w);
  a = 0.45 + 0.55 * seed.w;
  float verdict = fract(seed.z * 7.0);
  if (s < ${FLOW.split.toFixed(2)}) {
    // More agents and a filled cross-section near the viewer; the entire body narrows into the gate.
    float u=pow(s/${FLOW.split.toFixed(2)},${FLOW.densityPower.toFixed(1)});
    vec3 direction;vec3 c=riverFrame(u,direction);
    float width=mix(${FLOW.farWidth.toFixed(1)},${FLOW.nearWidth.toFixed(1)},pow(1.0-u,1.8))*mix(.10,1.0,smoothstep(.0,.19,u));
    float strand=floor(seed.y*18.0);
    float angle=seed.y*6.2831853+u*14.0+uTime*0.14;
    float fill=pow(seed.z,.6);
    float filament=.6+.10*sin(u*17.0+strand);
    float radius=width*mix(fill,filament,step(.8,seed.w));
    // A cross-section perpendicular to the path keeps the foreground a stream rather than a sheet of dots.
    vec3 tangent=normalize(direction);
    vec3 side=normalize(cross(tangent,vec3(0.0,1.0,0.0))),up=normalize(cross(side,tangent));
    vec3 off=side*cos(angle)*radius+up*sin(angle)*radius*.75;
    off+=(side*sin(u*25.0+strand+uTime*.35)+up*cos(u*23.0+strand))*width*.025;
    col=swarmLight(seed.w);
    a*=smoothstep(0.0,0.008,u)*mix(0.95,0.45,u);
    vec3 p=c+off;
    float submerged=1.0-smoothstep(-5.0,1.0,p.y+1.8);
    col=mix(col,swarmLight(seed.w)*vec3(.65,1.0,1.15),submerged*.75);
    a*=mix(1.0,.6,submerged);
    return p;
  }
  float u = (s - ${FLOW.split.toFixed(2)}) / ${(1-FLOW.split).toFixed(2)}, z = mix(${PORTAL.z.toFixed(1)}, ${TUBE.z1.toFixed(1)}, u);
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
  a *= uInside;
  return p;
}`;

export function createWorld(canvas, {onDecision, onFrame, onPassState, reduced = false, small = false} = {}) {
  let disposed = false;
  const budget = renderBudget({width: small ? Math.min(innerWidth,759) : innerWidth, coarse: matchMedia('(pointer: coarse)').matches, memory: navigator.deviceMemory, cores: navigator.hardwareConcurrency});
  small = budget.compact;
  let quality = 2;
  const random=seededRandom(421231),rand=(a,b)=>a+(b-a)*random();
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, powerPreference: 'high-performance'});
  renderer.setPixelRatio(renderRatio(budget, innerWidth, innerHeight, devicePixelRatio || 1, quality));
  renderer.info.autoReset = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x977769, 0.0012);
  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 1800);
  scene.add(camera);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentRoom = new RoomEnvironment();
  const environmentTarget = pmrem.fromScene(environmentRoom, 0.04);
  scene.environment = environmentTarget.texture;
  environmentRoom.dispose();
  const ambient=new THREE.HemisphereLight(0xbfc7db,0x20202e,1.05),ambientWhite=new THREE.Color(0xbfc7db);scene.add(ambient);
  const sunsetLight=new THREE.DirectionalLight(0xffbe83,2.1);
  sunsetLight.target.position.set(57,0,-50);sunsetLight.position.set(...SUN).multiplyScalar(1000).add(sunsetLight.target.position);
  sunsetLight.castShadow=true;sunsetLight.shadow.mapSize.setScalar(small?1024:2048);
  Object.assign(sunsetLight.shadow.camera,{left:-160,right:160,top:110,bottom:-110,near:1,far:1800});
  sunsetLight.shadow.bias=-.0002;sunsetLight.shadow.normalBias=.05;scene.add(sunsetLight,sunsetLight.target);
  const dm = new THREE.Object3D(), tc = new THREE.Color();
  const shared = {uTime: {value: 0}, uAlert: {value: 0}};
  const pointerField = {uActive: {value: 0}, uPress: {value: 0}, uRayOrigin: {value: new THREE.Vector3()}, uRayDirection: {value: new THREE.Vector3(0,0,-1)}, uPointerVelocity: {value: new THREE.Vector3()}};
  const RED = new THREE.Color(NEON.red);
  const chapter=createChapterPalette(),palette=chapter.current;
  const paletteUniforms={uHorizon:{value:palette.horizon},uZenith:{value:palette.zenith},uCloud:{value:palette.cloud},uWater:{value:palette.water},uAccent:{value:palette.accent},uSecondary:{value:palette.secondary},uFog:{value:palette.fog},uNight:{value:palette.night},uSolar:{value:palette.sun}};


  const skyNoise=createSkyNoise();
  const skyMat = new THREE.ShaderMaterial({vertexShader: 'varying vec2 vNdc; void main(){ vNdc = position.xy; gl_Position = vec4(position.xy, 1.0, 1.0); }', fragmentShader: SKY, depthTest: false, depthWrite: false,
    uniforms: {...paletteUniforms,uSkyNoise:{value:skyNoise},uInvProj: {value: new THREE.Matrix4()}, uCamWorld: {value: new THREE.Matrix4()}, uTime: shared.uTime, uAlert: shared.uAlert}});
  const skyMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat); skyMesh.frustumCulled = false; skyMesh.renderOrder = -1000; scene.add(skyMesh);

  /* ── THE MEGACITY ─────────────────────────────────────── */
  const city = new THREE.Group(); scene.add(city);
  const tmat=facadeMaterial(shared.uTime,shared.uAlert,paletteUniforms);
  const lots=CITY_LOTS;
  // Keep every roof in place while extending the facades below the visible city.
  // Both nearby blocks and the distant skyline continue down into the same deep canyon.
  const cityBottom = -1600;
  const fullDepth = lot => ({...lot, h: lot.h - cityBottom, y0: cityBottom});
  city.add(towers(lots.length, tmat, i => fullDepth(lots[i]),{random}));
  const landmarks = [{x: 112, z: 30, w: 14, d: 14, h: 108}, {x: -42, z: -10, w: 12, d: 16, h: 96}, {x: 98, z: -70, w: 10, d: 10, h: 52}];
  city.add(towers(landmarks.length, tmat, i => fullDepth(landmarks[i]),{random}));
  const waterfront=buildWaterfront({time:shared.uTime,alert:shared.uAlert,small,paletteUniforms});scene.add(waterfront.group);
  const cityThreshold=buildCityThreshold();waterfront.group.add(cityThreshold);
  const architecture=cityDetails([...lots,...landmarks],small);city.add(architecture.group);
  const T = small ? 100 : 180, traffic = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.2, 3), new THREE.MeshBasicMaterial({toneMapped: false}), T);
  traffic.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(T * 3), 3);
  const flights = Array.from({length: T}, (_, i) => ({x: rand(-140, 140), y: [14, 24, 34, 48][i % 4] + rand(-1, 1), z: rand(-235, 100), v: rand(20, 45) * (i % 2 ? 1 : -1), c: new THREE.Color([NEON.amber, NEON.bone, NEON.red, NEON.cyan][i % 4]).multiplyScalar(1.5)}));
  city.add(traffic);
  /* ── THE CHECKPOINT: the passport, on a stage of its own ── */
  const checkpoint = new THREE.Group(); checkpoint.position.copy(CARD); scene.add(checkpoint);
  const pass = buildPassport({labels: false}); checkpoint.add(pass.card);
  const halo = new THREE.Mesh(new THREE.CircleGeometry(7, 64), new THREE.ShaderMaterial({transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; void main(){ float r = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(0.008, 0.01, 0.028, smoothstep(1.0, 0.25, r) * 0.9); }'}));
  halo.renderOrder = -1; checkpoint.add(halo);
  const scanMat = new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.cyan).multiplyScalar(2), transparent: true, opacity: 0.7, toneMapped: false, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending});
  const scanRings = [2.2, 2.5, 2.8].map((r, i) => { const m = new THREE.Mesh(new THREE.RingGeometry(r, r + (i === 1 ? 0.012 : 0.03), 120), scanMat); m.rotation.x = -PI / 2; m.position.y = -1.9 - i * 0.05; checkpoint.add(m); return m; });
  const beamUp = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.8, 1.9, 64, 1, true), new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; void main(){ gl_FragColor = vec4(vec3(0.1, 0.8, 1.0) * (1.0 - vUv.y) * 0.07, 1.0); }'}));
  beamUp.position.y = -0.95; checkpoint.add(beamUp);
  const scanSheet = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 0.012), new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.cyan).multiplyScalar(3), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending})); checkpoint.add(scanSheet);
  const keyLight = new THREE.PointLight(NEON.cyan, 26, 16); keyLight.position.set(-3, 2, 4); checkpoint.add(keyLight);
  const rimLight = new THREE.PointLight(NEON.mag, 40, 16); rimLight.position.set(3, -1, -2); checkpoint.add(rimLight);
  const fill = new THREE.PointLight(0xffffff, 6, 10); fill.position.set(0, 0, 5); checkpoint.add(fill);
  // interaction: drag turns it (with momentum), click opens it, hovering scans it
  const pi = {yaw: 0, pitch: 0, vy: 0, vx: 0, manual: null, open: false, reported: null, hover: 0, hoverOn: false, dragging: false, moved: 0};

  /* ── SENBON TORII ─────────────────────────────────────── */
  const torii = new THREE.Group(); scene.add(torii);
  const basalt = new THREE.MeshStandardMaterial({color: 0x151c24, roughness: 0.5, metalness: 0.25});
  const pathLength = TORII.entry - TORII.exit + 28;
  for (const side of [-1, 1]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.15, pathLength), basalt);
    curb.position.set(side * 4.74, 0.025, (TORII.entry + TORII.exit) / 2 + 4); torii.add(curb);
  }
  const N = Math.floor((TORII.z0 - TORII.z1) / TORII.gap) + 1;
  const lacquer = new THREE.MeshStandardMaterial({color: 0x8b231b, metalness: 0.24, roughness: 0.42, emissive: 0x3e0a06, emissiveIntensity: 0.32});
  const neonMat = new THREE.MeshBasicMaterial({toneMapped: false});
  function gateGeometry(scale) {
    const pillarGeo = new THREE.CylinderGeometry(0.21, 0.26, 4.25, 18); pillarGeo.translate(0, 2.125, 0);
    const KW = 5.5, sh = new THREE.Shape();
    sh.moveTo(-KW / 2, 0.34); sh.quadraticCurveTo(0, -0.08, KW / 2, 0.34);
    sh.lineTo(KW / 2 - 0.1, 0.08); sh.quadraticCurveTo(0, -0.26, -KW / 2 + 0.1, 0.08); sh.closePath();
    const kasaGeo = new THREE.ExtrudeGeometry(sh, {depth: 0.44, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2, curveSegments: 32}); kasaGeo.translate(0, 4.3, -0.22);
    const nukiGeo = new THREE.BoxGeometry(4.7, 0.23, 0.32); nukiGeo.translate(0, 3.45, 0);
    const tubeV = new THREE.BoxGeometry(0.014, 3.8, 0.014); tubeV.translate(-0.1, 2.05, 0.24);
    const tubeK = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(v3(-KW / 2 + 0.12, 4.35, 0.25), v3(0, 3.96, 0.25), v3(KW / 2 - 0.12, 4.35, 0.25)), 40, 0.009, 5, false);
    [pillarGeo, kasaGeo, nukiGeo, tubeV, tubeK].forEach(g => g.scale(scale, scale, scale));
    return {pillarGeo, kasaGeo, nukiGeo, tubeV, tubeK};
  }
  const G = gateGeometry(1);
  const pillars = new THREE.InstancedMesh(G.pillarGeo, lacquer, N * 2), kasa = new THREE.InstancedMesh(G.kasaGeo, lacquer, N), nuki = new THREE.InstancedMesh(G.nukiGeo, lacquer, N);
  const tubesV = new THREE.InstancedMesh(G.tubeV, neonMat, N * 2), tubesK = new THREE.InstancedMesh(G.tubeK, neonMat, N);
  tubesV.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 6), 3); tubesK.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  const gateZ = [], gateCol = [], gateFlash = new Float32Array(N), flashCol = Array.from({length: N}, () => new THREE.Color());
  const gatePalette = [NEON.red, NEON.red, NEON.mag, NEON.red, NEON.amber, NEON.red, NEON.mag];
  for (let i = 0; i < N; i++) {
    const z = TORII.z0 - i * TORII.gap; gateZ.push(z); gateCol.push(new THREE.Color(gatePalette[Math.floor(i / 3) % gatePalette.length]));
    dm.rotation.set(0, 0, 0); dm.scale.setScalar(1);
    for (const sx of [-1, 1]) { dm.position.set(sx * 1.65, 0, z); dm.updateMatrix(); pillars.setMatrixAt(i * 2 + (sx > 0 ? 1 : 0), dm.matrix); tubesV.setMatrixAt(i * 2 + (sx > 0 ? 1 : 0), dm.matrix); }
    dm.position.set(0, 0, z); dm.updateMatrix(); kasa.setMatrixAt(i, dm.matrix); nuki.setMatrixAt(i, dm.matrix); tubesK.setMatrixAt(i, dm.matrix);
  }
  const lampMat = new THREE.MeshBasicMaterial({color: new THREE.Color(1, 0.55, 0.22).multiplyScalar(2.2), toneMapped: false});
  const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.26, 0.18), lampMat, N), posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.9, 0.26), basalt, N);
  for (let i = 0; i < N; i++) { const sx = i % 2 ? 2.5 : -2.5; dm.position.set(sx, 0.45, gateZ[i] - TORII.gap / 2); dm.updateMatrix(); posts.setMatrixAt(i, dm.matrix); dm.position.y = 1.03; dm.updateMatrix(); lamps.setMatrixAt(i, dm.matrix); }
  const toriiParts = [pillars, kasa, nuki, tubesV, tubesK, lamps, posts];
  torii.add(...toriiParts);
  // the great gates at each end: twice the height, lit, named
  const GG = gateGeometry(2.2), greatNeon = new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.red).multiplyScalar(1.1), toneMapped: false});
  const capShape = new THREE.Shape();
  capShape.moveTo(-6.13,10.28);capShape.quadraticCurveTo(0,9.36,6.13,10.28);
  capShape.lineTo(6.13,10.14);capShape.quadraticCurveTo(0,9.22,-6.13,10.14);capShape.closePath();
  const capGeometry = new THREE.ExtrudeGeometry(capShape,{depth:1.1,bevelEnabled:true,bevelSize:0.025,bevelThickness:0.025,bevelSegments:2,curveSegments:32});capGeometry.translate(0,0,-0.55);
  const great = [TORII.entry, TORII.exit].map((z, k) => {
    const g = new THREE.Group(); g.position.z = z;
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(GG.pillarGeo, lacquer); p.position.x = sx * 3.6; g.add(p); const t = new THREE.Mesh(GG.tubeV, greatNeon); t.position.x = sx * 3.6; g.add(t); }
    g.add(new THREE.Mesh(GG.kasaGeo, lacquer), new THREE.Mesh(GG.nukiGeo, lacquer), new THREE.Mesh(GG.tubeK, greatNeon));
    const crown = new THREE.Mesh(capGeometry, basalt); g.add(crown);
    for (const side of [-1, 1]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.59, 0.64, 0.36, 24), basalt);
      foot.position.set(side * 3.6, 0.18, 0); g.add(foot);
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.49, 0.15, 24), basalt);
      collar.position.set(side * 3.6, 7.36, 0); g.add(collar);
    }
    const l = new THREE.PointLight(0xff3a22, 30, 26, 1.6); l.position.set(0, 7, 3); g.add(l);
    for (const sx of [-1, 1]) {
      const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.7, 0.55), basalt); lantern.position.set(sx * 6, 0.85, 1.5);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.52, 0.44), lampMat); lamp.position.set(sx * 6, 1.96, 1.5);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.12, 0.76), basalt); cap.position.set(sx * 6, 2.28, 1.5);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.15, 0.78), basalt); base.position.set(sx * 6, 0.075, 1.5);
      g.add(lantern, lamp, cap, base);
    }
    torii.add(g); return g;
  });
  fontsReady().then(() => {
    if (disposed) return;
    for (let i = 0; i < N; i += 9) { const m = shopSign(['識別', '審判', '記録', '封鎖', '見張り', '認証', '中枢', '通行証', '関門'][(i / 9) % 9], 0.62, 0); m.position.set(0, 3.15, gateZ[i] + 0.15); torii.add(m); }
    great.forEach((g, k) => { const m = shopSign(k ? '中枢' : '見張り', 1.9, 0); m.position.set(0, 6.9, 0.35); g.add(m); });
  });
  // the ground of the path and the plaza: wet stone, lit by what stands on it (no mirrors: light pools and smears)
  const floorMat = new THREE.ShaderMaterial({transparent: true, uniforms: {uGroundOpacity: {value: 1}, uTime: shared.uTime, uAlert: shared.uAlert, uFog: {value: new THREE.Color(0x8b7467)}},
    vertexShader: 'varying vec3 vW; varying float vDepth; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `varying vec3 vW; varying float vDepth; uniform float uTime, uAlert, uGroundOpacity; uniform vec3 uFog;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        vec2 p = vW.xz; float x = abs(p.x);
        // The torii path is a suspended causeway into a particle bay, with no plane cutting the aperture.
        float roadWidth=mix(14.0,4.7,clamp((-p.y-216.0)/42.0,0.0,1.0));
        if(p.y < -542.0 || (p.y < -216.0 && x > roadWidth) || (p.y >= -216.0 && x > 14.0 && x < 97.0)) discard;
        float stone = noise(p * 3.0) * 0.6 + noise(p * 11.0) * 0.4;
        float path = (1.0 - smoothstep(4.6, 4.7, x)) * smoothstep(-542.0, -533.0, p.y);
        vec2 q = vec2(p.x / 1.55, p.y / 2.4);
        q.x += mod(floor(q.y), 2.0) * 0.5;
        vec2 f = fract(q), aa = max(fwidth(q), vec2(0.001));
        vec2 edge = min(f, 1.0 - f);
        float grout = 1.0 - min(smoothstep(0.008, 0.008 + aa.x, edge.x), smoothstep(0.008, 0.008 + aa.y, edge.y));
        vec3 col = mix(vec3(0.12, 0.13, 0.12), vec3(0.17, 0.16, 0.14), path);
        col *= 0.78 + stone * 0.22;
        col *= 1.0 - grout * path * 0.38;
        float border = exp(-pow((x - 4.7) * 12.0, 2.0));
        col += vec3(0.1, 0.13, 0.15) * border * 0.25;
        float onPath = smoothstep(-540.0, -528.0, p.y) * (1.0 - smoothstep(-282.0, -272.0, p.y));
        float dz = (fract((${TORII.z0.toFixed(1)} - p.y) / ${(TORII.gap * 2).toFixed(2)} + 0.5) - 0.5) * ${(TORII.gap * 2).toFixed(2)};
        float pool = exp(-pow(x - 2.5, 2.0) * 3.0 - dz * dz * 0.18);
        float reflection = exp(-pow(x - 1.65, 2.0) * 20.0) * exp(-dz * dz * 0.14);
        vec3 red = mix(vec3(0.36, 0.045, 0.025), vec3(0.7, 0.02, 0.04), uAlert);
        col += (vec3(0.25, 0.12, 0.045) * pool + red * reflection * 0.38) * (0.5 + stone * 0.5) * onPath;
        // Wet city avenues carry reflected signs and thin cyan circuit lanes.
        float avenue=(1.0-smoothstep(12.0,16.0,x))*smoothstep(-290.0,-280.0,p.y);
        float wetNoise=noise(vec2(p.x*0.6,p.y*0.08)+vec2(0.0,uTime*0.08));
        float lane=exp(-pow((x-11.0)*3.0,2.0));
        float packets=pow(max(0.0,sin(p.y*0.12+uTime*1.2)),14.0);
        col+=vec3(0.17,0.12,0.065)*(lane*0.25+packets*0.06)*avenue;
        col+=mix(vec3(0.07,0.075,0.08),vec3(0.17,0.09,0.045),wetNoise)*avenue*(0.2+wetNoise*.3);
        // The stone path ends before the destination; no rigid plaza under the swarm.
        vec2 d = p - vec2(0.0, ${PORTAL.z.toFixed(1)});
        float r = length(d);
        float rim = exp(-pow((r - 20.0) * 3.0, 2.0)) + exp(-pow((r - 29.0) * 3.0, 2.0));
        vec3 light = mix(vec3(0.07, 0.32, 0.4), vec3(0.6, 0.025, 0.05), uAlert);
        float reflectionShape = exp(-p.x * p.x * 0.012 - d.y * d.y * 0.0015);
        float ripple = 0.5 + 0.5 * sin(p.y * 7.0 + noise(p * 0.5) * 5.0 + uTime * 0.3);
        col += light * (reflectionShape * (0.12 + ripple * 0.1) + rim * 0.08);
        float fog = 1.0 - exp(-vDepth * 0.004);
        gl_FragColor = vec4(mix(col, uFog * 0.35, fog), uGroundOpacity);
      }`});
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(420, 1100), floorMat); floor.rotation.x = -PI / 2; floor.position.set(0, -0.035, -220); scene.add(floor);
  const C = 30, comets = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.03, 0.7, 4, 8).rotateX(PI / 2), new THREE.MeshBasicMaterial({toneMapped: false}), C);
  comets.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(C * 3), 3); torii.add(comets);
  const KIND = {allow: new THREE.Color(NEON.jade).multiplyScalar(3), ask: new THREE.Color(NEON.amber).multiplyScalar(3), deny: new THREE.Color(NEON.red).multiplyScalar(3.5), neutral: new THREE.Color(NEON.bone).multiplyScalar(2.2)};
  const respawn = c => { c.x = rand(-1.1, 1.1); c.y = rand(0.6, 3.2); c.z = TORII.z0 + rand(0, 6); c.v = rand(5, 9); c.kind = 'neutral'; c.fate = random(); c.gate = -1; c.back = 0; c.hold = 0; };
  const calls = Array.from({length: C}, () => { const c = {}; respawn(c); c.z -= rand(0, TORII.z0 - TORII.z1); return c; });

  /* ── ONE GATEWAY, shared by every view of the journey ── */
  const gateway = buildSwarmPortal({renderer, radius: PORTAL.r, small, time: shared.uTime, alert: shared.uAlert, pointer: pointerField,random});
  const portal = gateway.group; portal.position.set(0, PORTAL.y, PORTAL.z); scene.add(portal);
  const portalLight = new THREE.PointLight(NEON.cyan, 24, 70, 1.5); portalLight.position.set(0, PORTAL.y, PORTAL.z + 8); scene.add(portalLight);
  /* ── THE SWARM: one stream from the sky, through the portal, into the walls of the wormhole ── */
  // At least twice the former 192² / 512² agents, with the same physical interaction per agent.
  const swarmSide = small ? 272 : 725, SN = swarmSide * swarmSide, seeds = new Float32Array(SN * 4);
  for (let i = 0; i < SN; i++) seeds.set([random(), random(), random(), random()], i * 4);
  const swarmU = {uCoilScale:{value:1.4},uTime: shared.uTime, uLock: {value: 0}, uInside: {value: 0}, uPx: {value: 1}, uVisibility: {value: 1}};
  const swarmS = 'float speed(vec4 sd){ return 0.012 + 0.006 * sd.w; }';
  const swarmPhysics = createParticlePhysics(renderer, {side: swarmSide, seeds, uniforms: swarmU, pointer: pointerField,
    restShader: `${SWARM_FN} ${swarmS} vec3 restPosition(vec4 seed){vec3 col;float alpha;return swarmAt(seed,fract(seed.x+uTime*speed(seed)),col,alpha);}`});
  swarmU.uOffset = swarmPhysics.texture;
  const hGeo = new THREE.BufferGeometry(); hGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SN * 3), 3)); hGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4)); hGeo.setAttribute('aPhysicsUv', new THREE.BufferAttribute(swarmPhysics.uv, 2));
  const heads = new THREE.Points(hGeo, new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: swarmU,
    vertexShader: `attribute vec4 aSeed; varying vec3 vCol; varying float vA; uniform float uVisibility; ${PARTICLE_OFFSET} ${SWARM_FN} ${swarmS}
      void main(){ float s = fract(aSeed.x + uTime * speed(aSeed)); vec3 col; float a; vec3 p = swarmAt(aSeed, s, col, a) + texture2D(uOffset,aPhysicsUv).xyz; vCol = col; vA = a * uVisibility;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = clamp((1.5 + 2.5 * aSeed.w) * uPx * 75.0 / max(1.0,-mv.z), 0.8, 4.5 * uPx); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'varying vec3 vCol; varying float vA; void main(){ float r=length(gl_PointCoord-0.5)*2.0;if(r>1.0)discard;float core=exp(-r*r*3.8);gl_FragColor=vec4(vCol*1.55,core*vA); }'}));
  heads.renderOrder=3;heads.frustumCulled = false; scene.add(heads);
  // streaks: a line per agent from where it is to where it was a moment ago
  const TR = Math.floor(SN * 0.22), tSeeds = new Float32Array(TR * 2 * 4), tEnd = new Float32Array(TR * 2);
  for (let i = 0; i < TR; i++) for (let e = 0; e < 2; e++) { tSeeds.set(seeds.subarray(i * 4, i * 4 + 4), (i * 2 + e) * 4); tEnd[i * 2 + e] = e; }
  const tUv = new Float32Array(TR * 2 * 2);
  for (let i=0;i<TR;i++) for(let e=0;e<2;e++) tUv.set(swarmPhysics.uv.subarray(i*2,i*2+2),(i*2+e)*2);
  const tGeo = new THREE.BufferGeometry(); tGeo.setAttribute('aPhysicsUv', new THREE.BufferAttribute(tUv,2)); tGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TR * 2 * 3), 3)); tGeo.setAttribute('aSeed', new THREE.BufferAttribute(tSeeds, 4)); tGeo.setAttribute('aEnd', new THREE.BufferAttribute(tEnd, 1));
  const trails = new THREE.LineSegments(tGeo, new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: swarmU,
    vertexShader: `attribute vec4 aSeed; attribute float aEnd; varying vec3 vCol; varying float vA; uniform float uVisibility; ${PARTICLE_OFFSET} ${SWARM_FN} ${swarmS}
      void main(){ float s0 = fract(aSeed.x + uTime * speed(aSeed)); float s = s0 - aEnd * (0.00035 + 0.00045 * aSeed.w); if (s < 0.0 || (s0 >= ${FLOW.split.toFixed(2)} && s < ${FLOW.split.toFixed(2)})) s = s0; vec3 col; float a; vec3 p = swarmAt(aSeed, s, col, a) + texture2D(uOffset,aPhysicsUv).xyz;
        vCol = col; vA = a * uVisibility * (1.0 - aEnd) * (s0 < ${FLOW.split.toFixed(2)} ? 0.18 : 0.4); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: 'varying vec3 vCol; varying float vA; void main(){ gl_FragColor = vec4(vCol * vA, 1.0); }'}));
  trails.renderOrder=3;trails.frustumCulled = false; scene.add(trails);

  // Suspended ion mist replaces a platform at the gateway. Its surface is a field of moving points.
  const mistCount = small ? 6000 : 16000, mistSeeds = new Float32Array(mistCount * 3);
  for(let i=0;i<mistCount;i++)mistSeeds.set([rand(-160,160),rand(-12,-2),rand(-830,-210)],i*3);
  const mistGeometry = new THREE.BufferGeometry();mistGeometry.setAttribute('position',new THREE.BufferAttribute(mistSeeds,3));
  const mistMaterial = new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{uTime:shared.uTime,uAlert:shared.uAlert,uPx:{value:1}},
    vertexShader:`uniform float uTime,uPx;varying float vA;varying float vHue;
      void main(){vec3 p=position;float r=length(p.xz-vec2(0.0,-720.0));
        p.y+=sin(r*0.13-uTime*0.7)*1.5+sin(p.x*0.09+uTime*0.2)*1.4;
        p.x+=sin(p.z*0.08+uTime*0.25)*2.5;
        vA=(0.25+0.75*exp(-r*0.012))*(0.35+0.65*pow(0.5+0.5*sin(r*0.2-uTime*0.6),3.0));vHue=sin(p.z*0.035+p.x*0.02);
        vec4 mv=modelViewMatrix*vec4(p,1.0);gl_PointSize=clamp(uPx*90.0/max(1.0,-mv.z),0.7,2.5*uPx);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float uAlert;varying float vA,vHue;
      void main(){float r=length(gl_PointCoord-0.5)*2.0;vec3 c=mix(vec3(0.05,0.5,0.7),vec3(0.5,0.15,0.6),vHue*0.5+0.5);
        c=mix(c,vec3(1.0,0.08,0.17),uAlert);gl_FragColor=vec4(c,(1.0-smoothstep(0.0,1.0,r))*vA);}`});
  const ionMist = new THREE.Points(mistGeometry,mistMaterial);ionMist.frustumCulled=false;scene.add(ionMist);

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
  const IRIS_Z = [-835, -940, -1045, -1150, -1255, -1382];
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
  const scrSeed = new Float32Array(SCR); for (let i = 0; i < SCR; i++) scrSeed[i] = random();
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
  const hxSeed = new Float32Array(HX); for (let i = 0; i < HX; i++) hxSeed[i] = (i % 2) * 0.5 + random() * 0.49;
  helix.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(hxSeed, 1)); tunnel.add(helix);
  // set piece · your stack: three labelled rings, one inside the next
  const stackRings = [];
  fontsReady().then(() => {
    if (disposed) return;
    const a = glyphAtlas('ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ{}()=;:<>/.0123456789abcdef'); feedMat.uniforms.tGlyph.value = helixMat.uniforms.tGlyph.value = a.tex; feedMat.uniforms.uCount.value = helixMat.uniforms.uCount.value = a.count;
    passMat.map = printTexture(); passMat.needsUpdate = true;
    [['IDENTITY · 身元 · WHO IS THIS AGENT', '#19e6ff'], ['ACCESS · 権限 · WHICH APPS MAY IT OPEN', '#9a6bff'], ['ACTION · 行為 · MAY IT DO THIS, NOW — WARDRAIL', '#ff2fa6']].forEach(([label, col], k) => {
      const c = document.createElement('canvas'); c.width = 4096; c.height = 128; const g = c.getContext('2d');
      g.fillStyle = col; g.font = '700 64px "Chakra Petch", sans-serif'; g.textBaseline = 'middle';
      const step = g.measureText(label + '   ✦   ').width;
      for (let x = 0; x < 4096; x += step) g.fillText(label + '   ✦   ', x, 66);
      g.fillRect(0, 4, 4096, 3); g.fillRect(0, 121, 4096, 3);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping;
      const r = 3.2 + k * 2.1;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.55, 128, 1, true), new THREE.MeshBasicMaterial({map: tex, transparent: true, side: THREE.DoubleSide, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending}));
      m.rotation.x = PI / 2; m.position.set(0, PORTAL.y, -1230 - k * 6); tunnel.add(m); stackRings.push(m);
    });
  });
  const rn = rain(small ? 400 : 850, {size: [30, 20, 40], speed: [16, 24], length: 0.45, opacity: 0.17}); scene.add(rn.mesh);

  /* ── post ─────────────────────────────────────────────── */
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: budget.samples}));
  let composerRatio = renderer.getPixelRatio();
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.38, 0.35, 0.95);
  const bs = bloom.setSize.bind(bloom); bloom.setSize = (w, h) => bs(Math.ceil(w / 2), Math.ceil(h / 2));
  composer.addPass(bloom);
  const film = new ShaderPass(FILM); composer.addPass(film); composer.addPass(new OutputPass());

  /* ── rig ──────────────────────────────────────────────── */
  const pointer = {x: 0, y: 0, sx: 0, sy: 0, active: false, down: false, vx: 0, vy: 0};
  const raycaster = new THREE.Raycaster();
  const KEYS = ['cx', 'cy', 'dim', 'roll', 'fov'];
  const cur = {p: v3(...STAGES[0].p), l: v3(...STAGES[0].l), cx: STAGES[0].cx, cy: STAGES[0].cy, dim: 0, roll: 0, fov: 44};
  const tgt = {p: v3(0, 0, 0), l: v3(0, 0, 0), cx: 0.5, cy: 0.5, dim: 0, roll: 0, fov: 44};
  let f = 0, velocity = 0, velTarget = 0, override = null, lock = 0, fade = 1, intro = null, width = 0, height = 0, portrait = false;
  function aim(x) {
    const i = Math.min(Math.max(Math.floor(x), 0), STAGES.length - 2), u = smooth(clamp01(x - i)), a = STAGES[i], b = STAGES[i + 1];
    tgt.p.set(...a.p).lerp(v3(...b.p), u); tgt.l.set(...a.l).lerp(v3(...b.l), u);
    for (const k of KEYS) tgt[k] = lerp(a[k], b[k], u);
    if(i===4){
      // Walk through the final arch, then let the road dissolve into the swarm at eye level.
      const v=1-u;
      tgt.p.copy(v3(...a.p)).multiplyScalar(v*v*v).addScaledVector(v3(-0.15,1.55,-475),3*v*v*u).addScaledVector(v3(0,2.1,-535),3*v*u*u).addScaledVector(v3(...b.p),u*u*u);
      tgt.l.copy(v3(...a.l)).multiplyScalar(v*v*v).addScaledVector(v3(0,3,-550),3*v*v*u).addScaledVector(v3(0,PORTAL.y,-690),3*v*u*u).addScaledVector(v3(...b.l),u*u*u);
    }
  }
  aim(0);
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    if (w === width && h === height) return; width = w; height = h; portrait = w / h < 0.85;
    const ratio = renderRatio(budget,w,h,devicePixelRatio || 1,quality);
    renderer.setPixelRatio(ratio); renderer.setSize(w, h, false);
    if (composerRatio !== ratio) { composer.setPixelRatio(ratio); composerRatio = ratio; }
    composer.setSize(w, h);
    camera.aspect = w / h; camera.fov = portrait ? 62 : cur.fov; camera.updateProjectionMatrix();
    film.uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    pass.card.scale.setScalar(portrait ? 0.85 : 1);
  }

  let nextDecision = 0.6, time = 0;
  const decide = () => { const r = random(); return lock > 0.5 ? 'deny' : r < 0.68 ? 'allow' : r < 0.84 ? 'ask' : 'deny'; };
  const tmpV = v3(0, 0, 0);
  const passBox = new THREE.Box3(), passCorner = new THREE.Vector3();
  const passFit = {left: 0, right: 0};
  function fitPassport(dt) {
    // A fitting camera must face the object. During departure the card passes behind the camera;
    // projecting that box would reverse the feedback and push it out of the next visit.
    if (Math.abs(f-1)>0.12 || camera.position.distanceTo(CARD)>15) {
      pass.card.position.x*=Math.exp(-dt*3);return;
    }
    pass.card.updateWorldMatrix(true, true);passBox.setFromObject(pass.card);
    let left=Infinity,right=-Infinity;
    for(let i=0;i<8;i++){
      passCorner.set(i&1?passBox.max.x:passBox.min.x,i&2?passBox.max.y:passBox.min.y,i&4?passBox.max.z:passBox.min.z);
      if(passCorner.clone().applyMatrix4(camera.matrixWorldInverse).z>-1)return;
      passCorner.project(camera);
      const x=(passCorner.x*0.5+0.5)*width;left=Math.min(left,x);right=Math.max(right,x);
    }
    passFit.left=left;passFit.right=right;
    const margin=portrait?24:32, boundary=portrait?width-24:width*0.5-26;
    const allowed=boundary-margin, center=(boundary+margin)/2;
    const currentScale=pass.card.scale.x, maxScale=portrait?0.85:1;
    const desired=Math.min(maxScale,currentScale*allowed/Math.max(1,right-left));
    const blend=1-Math.exp(-dt*10);
    pass.card.scale.setScalar(lerp(currentScale,Math.max(portrait?0.4:0.55,desired),blend));
    const worldPerPixel=2*Math.tan(camera.fov*PI/360)*camera.position.distanceTo(CARD)/height;
    const shift=Math.max(-0.4,Math.min(0.4,(center-(left+right)/2)*worldPerPixel*blend));
    pass.card.position.x=Math.max(-1.8,Math.min(1.8,pass.card.position.x+shift));
  }
  function step(dt) {
    time += dt; shared.uTime.value = time;
    chapter.sample(f);
    // One proportional adjustment for the complete inner spiral. The exterior
    // descent retains its original curve and the turns retain their axial depth.
    swarmU.uCoilScale.value=lerp(1.4,.71,smooth(span(f,0,2)));
    paletteUniforms.uNight.value=palette.night;paletteUniforms.uSolar.value=palette.sun;
    scene.fog.color.copy(palette.fog);
    floorMat.uniforms.uFog.value.copy(palette.fog);
    sunsetLight.intensity=palette.light;
    ambient.color.copy(palette.accent).lerp(ambientWhite,1-palette.night*.35);
    ambient.intensity=1.05-palette.night*.48;
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
    const gateFocus=1-smooth(span(Math.abs(f-2),0,.5));
    camera.position.copy(cur.p).add(tmpV.set(Math.sin(time * 0.31) * 0.25 * hover, Math.sin(time * 0.43) * 0.18 * hover + introLift * 34, introLift * 70));
    if(portrait)camera.position.z+=8*gateFocus;
    camera.lookAt(cur.l);
    camera.rotateZ(cur.roll * Math.sin(time * 0.2) + (inTube ? Math.sin(time * 0.08) * 0.25 : 0));
    camera.rotateY(-pointer.sx * 0.012); camera.rotateX(-pointer.sy * 0.008);
    const cardFocus=smooth(span(f,0.55,0.9))*(1-smooth(span(f,1.1,1.5)));
    const portalFocus=smooth(span(f,4.6,5))*(1-smooth(span(f,5,5.7)));
    const cx = portrait ? 0.5 : cur.cx;
    let cy = portrait ? lerp(Math.min(cur.cy,lerp(.42,.6,gateFocus)),0.23,cardFocus) : cur.cy;
    if(portrait)cy=lerp(cy,.29,portalFocus);
    // Keep the same monumental gateway in the world; fit its complete halo in the chapter's reading layout.
    const slotWidth=portrait?width-48:width*.5-56,slotHeight=portrait?height*.38:height-136;
    const chapterHalfSize=Math.max(80,Math.min(slotWidth,slotHeight)/2);
    // Begin the lens adjustment while travelling through the gates, rather than
    // suddenly zooming out on arrival at the final chapter.
    const halfSize=portrait?chapterHalfSize:lerp(height*.49,chapterHalfSize,smooth(span(f,2,5)));
    const distance=camera.position.distanceTo(portal.position);
    const fittedFov=2*Math.atan(gateway.outerRadius*height/(2*halfSize*distance))*180/PI;
    const baseFov=portrait?62:cur.fov;
    const haloFit=smooth(span(f,2,2.65))*(1-smooth(span(f,5,5.7)));
    camera.fov=lerp(baseFov,Math.max(baseFov,fittedFov),portrait?portalFocus:haloFit);
    camera.setViewOffset(width, height, -(cx - 0.5) * width, -(cy - 0.5) * height, width, height);
    camera.updateMatrixWorld();
    skyMat.uniforms.uInvProj.value.copy(camera.projectionMatrixInverse); skyMat.uniforms.uCamWorld.value.copy(camera.matrixWorld);

    rn.mesh.material.uniforms.uOpacity.value=.055+.10*palette.night;
    waterfront.update(cz,inTube);

    city.visible = skyMesh.visible = cz > PORTAL.z - 25; rn.mesh.visible = !inTube;
    torii.visible = cz < -170 && cz > -545;
    floorMat.uniforms.uGroundOpacity.value=1-smooth(span(f,4.2,4.75));
    floor.visible = cz > -520 && floorMat.uniforms.uGroundOpacity.value>0.001;
    ionMist.visible = cz < -200 && !inTube;mistMaterial.uniforms.uPx.value=renderer.getPixelRatio();
    tunnel.visible = cz < PORTAL.z - 1.5;
    const journeyVisibility=1-smooth(span(f,0.35,0.75))*(1-smooth(span(f,1.25,1.7)));
    portal.visible = !inTube && journeyVisibility>0.001;
    heads.visible=trails.visible=journeyVisibility>0.001;
    swarmU.uVisibility.value=journeyVisibility;
    raycaster.setFromCamera(new THREE.Vector2(pointer.x, -pointer.y), camera);
    pointerField.uRayOrigin.value.copy(raycaster.ray.origin);
    pointerField.uRayDirection.value.copy(raycaster.ray.direction);
    pointerField.uActive.value = reduced || journeyVisibility<0.5 ? 0 : pointer.active ? 1 : 0;
    pointerField.uPress.value += ((pointer.down ? 1 : 0) - pointerField.uPress.value) * (1 - Math.exp(-dt * 8));
    pointerField.uPointerVelocity.value.set(pointer.vx, -pointer.vy, 0).applyQuaternion(camera.quaternion);
    pointer.vx *= Math.exp(-dt * 10); pointer.vy *= Math.exp(-dt * 10);
    gateway.update(time, renderer.getPixelRatio(), lock, reduced || !portal.visible ? 0 : dt, journeyVisibility);
    checkpoint.visible = cz < -40 && cz > -240;
    swarmU.uInside.value = inTube ? 1 : smooth(span(-cz, -PORTAL.z - 20, -PORTAL.z - 1));
    swarmU.uLock.value = lock; swarmU.uPx.value = renderer.getPixelRatio();
    swarmPhysics.update(reduced ? 0 : dt);

    if (city.visible) {
      for (let i = 0; i < T; i++) { const o = flights[i]; o.z += o.v * dt * (1 + velocity * 2); if (o.z > 100) o.z = -235; if (o.z < -235) o.z = 100; dm.position.set(o.x, o.y, o.z); dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1 + Math.abs(o.v) / 30 + velocity * 2); dm.updateMatrix(); traffic.setMatrixAt(i, dm.matrix); traffic.setColorAt(i, tc.copy(o.c).lerp(KIND.deny, lock)); }
      traffic.instanceMatrix.needsUpdate = traffic.instanceColor.needsUpdate = true;
    }

    // The hidden card also closes and forgets per-visit overrides; no stale state on a direct jump.
    if (!checkpoint.visible) {
      pi.manual=null;pi.dragging=false;pi.vx=pi.vy=0;pi.yaw*=Math.exp(-dt*5);pi.pitch*=Math.exp(-dt*5);
      animatePassport(pass,dt,time,0,{sx:0,sy:0});
      pass.card.position.x*=Math.exp(-dt*5);
      if(pi.reported&&pass.open<0.5){pi.reported=false;onPassState?.(false);}
    }
    // the passport: momentum, the user's open/closed, hover scan
    if (checkpoint.visible) {
      const presence = smooth(span(f, 0.55, 0.9)) * (1 - smooth(span(f, 1.12, 1.48)));
      if (presence < 0.01) { pi.manual = null; pi.dragging = false; pi.vx = pi.vy = 0; }
      pi.open = pi.manual ?? true;
      if (!pi.dragging) { pi.yaw = Math.max(-0.9,Math.min(0.9,pi.yaw + pi.vy * dt)); pi.pitch += pi.vx * dt; pi.vy *= Math.pow(0.08, dt); pi.vx *= Math.pow(0.08, dt); pi.pitch *= Math.pow(0.3, dt); }
      // Departure always wins over a manual open, and gently restores orientation before the next chapter.
      if (presence < 0.8) { pi.yaw *= Math.exp(-dt * 4 * (1-presence)); pi.pitch *= Math.exp(-dt * 4 * (1-presence)); }
      animatePassport(pass, dt, time, (pi.open ? 1 : 0) * presence, {sx: 0, sy: 0});
      pass.card.rotation.y += pi.yaw * presence; pass.card.rotation.x += pi.pitch * presence;
      fitPassport(dt);
      const reported = pass.open > 0.5;
      if (reported !== pi.reported) { pi.reported = reported; onPassState?.(reported); }
      pi.hover += ((pi.hoverOn ? 1 : 0) - pi.hover) * (1 - Math.pow(0.02, dt));
      halo.position.copy(camera.position).sub(CARD).normalize().multiplyScalar(-2.6); halo.lookAt(camera.position);
      scanRings.forEach((r, i) => { r.rotation.z = time * (i % 2 ? 0.4 : -0.3) * (1 + pi.hover * 3); });
      scanMat.opacity = 0.25 + pi.hover * 0.25;
      scanSheet.position.set(-0.35 * pass.open, Math.sin(time * (1.6 + pi.hover * 2)) * 0.9, 0.6); scanSheet.visible = pass.open < 0.3; scanSheet.lookAt(camera.position);
    }

    if (torii.visible) {
      for (let i = 0; i < N; i++) {
        gateFlash[i] = Math.max(0, gateFlash[i] - dt * 2.4);
        tc.copy(gateCol[i]).lerp(KIND.deny, lock).multiplyScalar(0.85).lerp(flashCol[i], gateFlash[i]);
        tubesV.setColorAt(i * 2, tc); tubesV.setColorAt(i * 2 + 1, tc); tubesK.setColorAt(i, tc);
      }
      tubesV.instanceColor.needsUpdate = tubesK.instanceColor.needsUpdate = true;
      greatNeon.color.set(NEON.red).lerp(RED, lock).multiplyScalar(1.0 + Math.sin(time * 2) * 0.08);
      calls.forEach((c, i) => {
        if (c.hold > 0) { c.hold -= dt; if (c.hold <= 0) { c.kind = random() < 0.7 && lock < 0.5 ? 'allow' : 'deny'; c.back = c.kind === 'deny' ? 1 : 0; } }
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

    portalLight.color.set(NEON.cyan).lerp(RED, lock);

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
      for (let i = 0; i < SCR; i++) { const a = (i / SCR) * TAU + time * 0.08, z = -815 - (i % 3) * 7; dm.position.set(Math.cos(a) * 5.6, PORTAL.y + Math.sin(a) * 5.6, z); dm.rotation.set(0, 0, a - PI / 2); dm.scale.setScalar(1); dm.updateMatrix(); screens.setMatrixAt(i, dm.matrix); }
      screens.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < PS; i++) { const u = ((time * 0.06 + i / PS) % 1), z = -975 + u * 80, a = i * 2.4 + u * 3; dm.position.set(Math.cos(a) * 4.8, PORTAL.y + Math.sin(a) * 4.8, z); dm.rotation.set(0, Math.sin(a) * 0.5, a * 0.15); dm.scale.setScalar(Math.max(0.0001, Math.min(1, u * 5, (1 - u) * 5))); dm.updateMatrix(); passes.setMatrixAt(i, dm.matrix); }
      passes.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < HX; i++) { const strand = i % 2, j = Math.floor(i / 2), z = -1025 - j * 0.6, a = j * 0.28 + strand * PI + time * 0.5; dm.position.set(Math.cos(a) * 3.2, PORTAL.y + Math.sin(a) * 3.2, z); dm.scale.setScalar(1); dm.lookAt(camera.position); dm.updateMatrix(); helix.setMatrixAt(i, dm.matrix); }
      helix.instanceMatrix.needsUpdate = true;
      stackRings.forEach((m, k) => { m.material.map.offset.x = time * 0.01 * (k + 1) * (k % 2 ? -1 : 1); });
    }
    rn.update(time, camera.position.clone().add(tmpV.set(0, 0, -14)));

    bloom.strength = 0.28 + palette.night*.16 + lock * 0.12;
    film.uniforms.uTime.value = time; film.uniforms.uDim.value = cur.dim; film.uniforms.uFade.value = fade; film.uniforms.uAlert.value = lock;
    film.uniforms.uAb.value = 0.000025 + velocity * 0.0002;
    nextDecision -= dt;
    if (nextDecision <= 0) { nextDecision = 0.35 + random() * 0.9; onDecision?.(decide()); }
  }
  function draw() { renderer.info.reset(); composer.render(); onFrame?.({}, {stage: f, closed: lock, alert: lock, intro: !!intro, accent:palette.accent.getHexString()}); }

  let ema = 0.016, frames = 0, slowFrames = 0, fastFrames = 0, settleUntil = 90, raf = 0, running = false;
  const lockHigh = new URLSearchParams(location.search).get('q') === 'high';
  const clock = new THREE.Clock();
  function frame() {
    if (!running) return;
    const raw = clock.getDelta(); ema = ema * 0.94 + Math.min(raw, 0.2) * 0.06; frames++;
    // A shader compilation or tab switch should not permanently blur the entire landscape.
    slowFrames=raw>.034?slowFrames+1:Math.max(0,slowFrames-2);
    fastFrames=ema<.021?fastFrames+1:0;
    if(!lockHigh&&frames>settleUntil){
      let next=quality;
      if(quality>0&&slowFrames>45)next--;
      else if(quality<2&&fastFrames>900)next++;
      if(next!==quality){quality=next;slowFrames=fastFrames=0;settleUntil=frames+120;width=0;resize();}
    }
    step(Math.min(raw, 0.05)); draw(); raf = requestAnimationFrame(frame);
  }
  const start = () => { if (running || reduced) return; running = true; clock.getDelta(); raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  const onVis = () => { if(document.hidden){onLeave();stop();}else {ema=.016;slowFrames=fastFrames=0;settleUntil=frames+90;start();} };
  // Touch is page navigation; it must not leave a synthetic hover running the
  // particle physics after release. Passport manipulation has its own input path.
  const onMove = e => { if(e.pointerType==='touch'){pointer.active=false;pointer.down=false;return;} const x=(e.clientX/innerWidth-0.5)*2, y=(e.clientY/innerHeight-0.5)*2;
    pointer.vx=Math.max(-3,Math.min(3,(x-pointer.x)*25));pointer.vy=Math.max(-3,Math.min(3,(y-pointer.y)*25));
    pointer.x=x;pointer.y=y;pointer.active=!e.target.closest?.('button,a,input,.sheet,.magi,.nav'); };
  const onDown = e => { if(e.pointerType==='touch')return; if (!e.target.closest?.('button,a,input,.sheet,.magi,.nav,.pass-stage')) pointer.down=true; };
  const onUp = e => { pointer.down=false;if(e.pointerType==='touch')pointer.active=false; };
  const onLeave = () => { pointer.active=false; pointer.down=false; };
  addEventListener('blur',onLeave);
  addEventListener('pointerdown', onDown);addEventListener('pointerup',onUp);addEventListener('pointercancel',onUp);document.documentElement.addEventListener('pointerleave',onLeave);
  addEventListener('pointermove', onMove, {passive: true});
  document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(() => { resize(); if (!running) { step(0.016); draw(); } }); ro.observe(canvas);
  resize();
  // Compile materials as their chapter becomes visible. Compiling the entire world here
  // stalls the first paint on shaders for the passport and tunnel that are still off screen.
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
      else if (kind === 'drag' && pi.dragging) { pi.moved += Math.abs(dx) + Math.abs(dy); pi.yaw = Math.max(-0.9,Math.min(0.9,pi.yaw + dx * 0.006)); pi.pitch = Math.max(-0.5, Math.min(0.5, pi.pitch + dy * 0.005)); pi.vy = dx * 0.06; pi.vx = dy * 0.04; }
      else if (kind === 'up') { if (pi.dragging && pi.moved < 6) pi.manual = !(pi.manual ?? pi.open); pi.dragging = false; }
      else if (kind === 'cancel') pi.dragging = false;
      else if (kind === 'enter') pi.hoverOn = true;
      else if (kind === 'leave') pi.hoverOn = false;
      return pi.open;
    },
    physicsState() { return {swarm: swarmPhysics.measure(), portal: gateway.physics.measure()}; },
    spiralPoint(u = 0.2) {
      const p=v3(...sampleFlow(u,swarmU.uCoilScale.value)).project(camera);
      return {x:(p.x*0.5+0.5)*width,y:(0.5-p.y*0.5)*height};
    },
    state() {
      const bounds={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
      for(let i=0;i<32;i++){const a=i/32*TAU,p=v3(PORTAL.x+Math.cos(a)*gateway.outerRadius,PORTAL.y+Math.sin(a)*gateway.outerRadius,PORTAL.z).project(camera);const x=(p.x*.5+.5)*width,y=(.5-p.y*.5)*height;bounds.left=Math.min(bounds.left,x);bounds.right=Math.max(bounds.right,x);bounds.top=Math.min(bounds.top,y);bounds.bottom=Math.max(bounds.bottom,y);}
      return {f,citySignature:CITY_SIGNATURE,park:waterfront.park,palette:{name:palette.name,night:palette.night,accent:palette.accent.getHexString()}, performance: {frameMs: +(ema*1000).toFixed(1), quality, compact:budget.compact, maxPixels:budget.maxPixels, samples:budget.samples, calls:renderer.info.render.calls, triangles:renderer.info.render.triangles, pixelRatio: renderer.getPixelRatio()}, viewport: {width,height}, passport: {open: +pass.open.toFixed(3), manual: pi.manual, yaw: +pi.yaw.toFixed(3), bounds: passFit}, physics: {enabled: swarmPhysics.enabled, pressed: pointer.down}, flow: {particles: SN, foregroundWidth: FLOW.nearWidth, endWidth: FLOW.farWidth, endpoint: sampleFlow(1)}, portals: 1, portal: {center: portal.position.toArray(), radius: PORTAL.r, scale: portal.scale.x, bounds,rigidRings:gateway.boundary.children.filter(o=>o.geometry?.type==='TorusGeometry').length}, cam: camera.position.toArray().map(v => +v.toFixed(1))}; },
    settle(n = 60) { if (intro) { const d = intro.done; intro = null; d?.(); } snap(); fade = 1; for (let i = 0; i < n; i++) step(0.033); draw(); },
    destroy() {
      disposed = true; pass.dispose();
      stop(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); removeEventListener('pointermove', onMove);removeEventListener('pointerdown',onDown);removeEventListener('pointerup',onUp);removeEventListener('pointercancel',onUp);document.documentElement.removeEventListener('pointerleave',onLeave);
      removeEventListener('blur',onLeave);swarmPhysics.dispose();gateway.dispose();waterfront.dispose();architecture.dispose();skyNoise.dispose();
      scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { x.map?.dispose?.(); x.dispose(); }); });
      bloom.dispose(); composer.dispose(); environmentTarget.dispose(); renderer.dispose(); pmrem.dispose();
    },
  };
}
