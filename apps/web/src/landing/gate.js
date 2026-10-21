import * as THREE from 'three';

/*
 * The instrument. A glass gate with a mechanical iris, an agent passport that
 * presents itself to it, a stream of calls that each receive a verdict, and a
 * hash-linked ledger that grows behind. Scroll drives the camera, the passport,
 * the iris and the background through STAGES. Blueprint callouts in the DOM are
 * pinned to 3D anchors that this module projects every frame.
 */

const PI = Math.PI;
const COLORS = {
  neutral: new THREE.Color(0x5a6660),
  allow: new THREE.Color(0x1fcf8e),
  ask: new THREE.Color(0xf0a81c),
  deny: new THREE.Color(0xf0502f),
};
const LEDGER = {neutral: new THREE.Color(0x56635d), allow: new THREE.Color(0x2fc58a), deny: new THREE.Color(0xe9553a)};

const HIDDEN = {p: [-3.6, 0.2, -3.2], tilt: 0.4, rx: 0, s: 0.7, o: 0};
// Each stage frames a bounding radius `r` around `look` *inside the subject zone* (the right side of the
// screen), so the subject always fits its zone and never reaches the copy column.
// az/el orbit it, `closed` is the iris, `dark` is page night-mode, `opacity` fades the whole scene out.
const STAGES = [
  /* 0 hero     */ {az: PI + 0.78, el: 0.16, r: 3.05, lx: -0.1, ly: -0.05, lz: 0.5, closed: 0, dark: 0, opacity: 1, ledger: 1, mix: [0.6, 0.2, 0.2], card: {p: [-1.4, -0.7, -1.2], tilt: 0.22, rx: -0.05, s: 0.72, o: 1}},
  /* 1 identify */ {az: PI + 0.32, el: 0.06, r: 1.85, lx: 0.05, ly: 0.28, lz: -1.3, closed: 0, dark: 0, opacity: 1, ledger: 0, mix: [0.5, 0.2, 0.3], card: {p: [0.1, 0.35, -1.4], tilt: -0.28, rx: 0.08, s: 1.05, o: 1}},
  /* 2 decide   */ {az: PI + 0.1, el: 0.04, r: 2.15, lx: 0, ly: 0, lz: 0, closed: 0, dark: 0, opacity: 1, ledger: 0, mix: [0.45, 0.25, 0.3], card: {...HIDDEN}},
  /* 3 prove    */ {az: PI + 1.05, el: 0.2, r: 4.3, lx: 0, ly: -0.1, lz: 2.6, closed: 0, dark: 0, opacity: 1, ledger: 1, mix: [0.75, 0.05, 0.2], card: {...HIDDEN}},
  /* 4 contain  */ {az: PI + 0.12, el: 0.04, r: 2.15, lx: 0, ly: 0, lz: 0, closed: 1, dark: 1, opacity: 1, ledger: 0.7, mix: [0, 0, 1], card: {...HIDDEN}},
  /* 5 outro    */ {az: PI + 0.12, el: 0.04, r: 2.6, lx: 0, ly: 0, lz: 0, closed: 1, dark: 0, opacity: 0, ledger: 0, mix: [0, 0, 1], card: {...HIDDEN}},
];
const NUM = ['az', 'el', 'r', 'lx', 'ly', 'lz', 'closed', 'dark', 'opacity', 'ledger'];
const LIGHT_BG = new THREE.Color(0xe8eee7), NIGHT_BG = new THREE.Color(0x060d0a);

const smooth = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

/** Procedural studio environment: soft gradient dome plus light panels, so the glass has something beautiful to refract. */
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
          vec3 low = vec3(0.10, 0.17, 0.14);
          vec3 mid = vec3(0.42, 0.55, 0.50);
          vec3 high = vec3(0.55, 0.70, 0.78);
          vec3 c = mix(low, mid, smoothstep(0.0, 0.5, h));
          c = mix(c, high, smoothstep(0.5, 1.0, h));
          c += vec3(0.10, 0.04, 0.12) * smoothstep(0.65, 0.2, abs(vP.x - 0.2)) * smoothstep(0.2, 0.7, h);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  ));
  const panel = (w, h, pos, color, intensity) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide}));
    m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
  };
  panel(14, 3, [0, 14, 4], 0xffffff, 6);
  panel(3, 12, [-14, 3, 2], 0xfff1e0, 5);
  panel(3, 12, [14, 2, -4], 0xd6f4ff, 5);
  panel(10, 2, [0, -6, 12], 0xffd9f0, 2.4);
  panel(6, 6, [-6, 6, -14], 0xcfffe6, 3.2);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.02).texture;
  pm.dispose();
  return tex;
}

/** The passport face, drawn once to a canvas: guilloche, sigil, identity fields. */
function drawPassport() {
  const W = 1280, H = 806;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#16231d'); bg.addColorStop(0.6, '#0d1512'); bg.addColorStop(1, '#0a1210');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W - 190, 190, 10, W - 190, 190, 520);
  glow.addColorStop(0, 'rgba(31, 207, 142, 0.28)'); glow.addColorStop(1, 'rgba(31, 207, 142, 0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  g.lineWidth = 1.2;
  for (let k = 0; k < 46; k++) {
    g.beginPath();
    g.strokeStyle = `rgba(160, 235, 205, ${0.05 + (k % 5) * 0.012})`;
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
  g.fillStyle = '#eef7f2'; g.font = '500 96px "Geist Variable", system-ui, sans-serif'; g.fillText('research-bot', 80, 300);
  g.font = mono(34); g.fillStyle = '#b9ccc3';
  g.fillText('OPERATOR   Acme Inc.', 80, 392);
  g.fillText('SCOPES     read_file · web.search', 80, 440);
  g.fillText('LIMIT      $500 / 24h', 80, 488);
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

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function createGate(canvas, {onDecision, onFrame, reduced = false, small = false} = {}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.8));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const envTexture = makeEnvironment(renderer);
  scene.environment = envTexture;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 90);
  scene.fog = new THREE.Fog(LIGHT_BG.clone(), 8, 20);
  const world = new THREE.Group();
  scene.add(world);

  // Gate: glass ring with a mechanical iris
  const R = 1.55;
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xe6fff3, metalness: 0, roughness: 0.03, transmission: 1, thickness: 0.9, ior: 1.5, dispersion: small ? 0 : 0.6,
    iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [120, 620], clearcoat: 1, clearcoatRoughness: 0.03,
    envMapIntensity: 1.5, attenuationColor: new THREE.Color(0x6fe0b0), attenuationDistance: 1.5,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.17, 64, 220), glass);
  world.add(ring);
  const core = new THREE.Mesh(new THREE.TorusGeometry(R, 0.028, 16, 220), new THREE.MeshBasicMaterial({color: COLORS.allow}));
  world.add(core);

  const bladeMat = new THREE.MeshStandardMaterial({color: 0x1d2924, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide});
  const BLADES = 10;
  const blades = [];
  const RB = R - 0.17;
  const half = RB * Math.sin(PI / BLADES) * 1.22;
  const bladeGeo = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, -1)]));
  for (let i = 0; i < BLADES; i++) {
    const a = (i / BLADES) * PI * 2;
    const g = new THREE.Group();
    g.position.set(Math.cos(a) * RB, Math.sin(a) * RB, -0.012 + i * 0.0016);
    g.add(new THREE.Mesh(bladeGeo, bladeMat)); g.userData.a = a;
    world.add(g); blades.push(g);
  }
  const irisBack = new THREE.Mesh(new THREE.CircleGeometry(R - 0.12, 64), new THREE.MeshBasicMaterial({color: 0x060b09, transparent: true, opacity: 0, depthWrite: false}));
  irisBack.position.z = -0.02;
  world.add(irisBack);
  const membraneMat = new THREE.MeshBasicMaterial({color: COLORS.deny, transparent: true, opacity: 0, depthWrite: false});
  const membrane = new THREE.Mesh(new THREE.CircleGeometry(R - 0.1, 96), membraneMat);
  membrane.position.z = 0.02;
  world.add(membrane);

  const glowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {uColor: {value: new THREE.Color(COLORS.allow)}, uAmount: {value: 0.2}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform vec3 uColor; uniform float uAmount;
      void main(){ float r = length(vUv - 0.5) * 2.0; float band = exp(-pow((r - 0.5) * 6.0, 2.0)); float inner = smoothstep(0.5, 0.0, r) * 0.1; gl_FragColor = vec4(uColor, (band * 0.55 + inner) * uAmount); }`,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), glowMat);
  glow.position.z = -0.4;
  world.add(glow);

  // Blueprint: dashed construction circles, crosshair, dial
  const dashMat = new THREE.LineDashedMaterial({color: 0x10201a, dashSize: 0.07, gapSize: 0.07, transparent: true, opacity: 0.38});
  const circle = r => {
    const pts = []; for (let i = 0; i <= 160; i++) { const a = (i / 160) * PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); }
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), dashMat); l.computeLineDistances(); return l;
  };
  const cross = (a, b) => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]), dashMat); l.computeLineDistances(); return l; };
  const blueprint = new THREE.Group();
  blueprint.add(circle(2.28), circle(3.05), cross([-4.2, 0, 0], [4.2, 0, 0]), cross([0, -4.2, 0], [0, 4.2, 0]));
  world.add(blueprint);
  const tickMat = new THREE.MeshBasicMaterial({color: 0x10201a});
  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.012, 0.1), tickMat, 120);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * PI * 2, long = i % 10 === 0;
    dummy.position.set(Math.cos(a) * 2.28, Math.sin(a) * 2.28, 0);
    dummy.scale.set(long ? 1.6 : 1, long ? 1.6 : 1, long ? 1.8 : 0.8); dummy.updateMatrix(); ticks.setMatrixAt(i, dummy.matrix);
  }
  world.add(ticks);

  // Dust: a faint field of motes through the whole volume. Pure ambience, never competes with the subject.
  const DUST = small ? 220 : 520;
  const dustGeo = new THREE.BufferGeometry();
  const dp = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) { dp[i * 3] = rand(-9, 9); dp[i * 3 + 1] = rand(-5, 5); dp[i * 3 + 2] = rand(-7, 12); }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dustMat = new THREE.PointsMaterial({color: 0x0f2a20, size: 0.028, transparent: true, opacity: 0.35, depthWrite: false, sizeAttenuation: true});
  const dust = new THREE.Points(dustGeo, dustMat);
  world.add(dust);

  // Passport
  const cardGroup = new THREE.Group();
  const CW = 1.7, CH = CW / 1.588;
  const cardGeo = new THREE.ShapeGeometry(roundedRect(CW, CH, 0.1), 16);
  const uv = cardGeo.attributes.uv, pos = cardGeo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + CW / 2) / CW, (pos.getY(i) + CH / 2) / CH);
  const cardMat = new THREE.MeshPhysicalMaterial({roughness: 0.55, metalness: 0.0, clearcoat: 0.5, clearcoatRoughness: 0.2, iridescence: 0.25, iridescenceIOR: 1.3, iridescenceThicknessRange: [200, 600], transparent: true, envMapIntensity: 0.35, emissive: 0xffffff, emissiveIntensity: 0.75});
  const backMat = new THREE.MeshStandardMaterial({color: 0x0f1512, roughness: 0.35, metalness: 0.6, transparent: true});
  const back = new THREE.Mesh(cardGeo, backMat); back.rotation.y = PI; back.position.z = -0.012;
  const slab = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(CW - 0.01, CH - 0.01, 0.1), {depth: 0.01, bevelEnabled: false}), backMat);
  slab.position.z = -0.011;
  cardGroup.add(new THREE.Mesh(cardGeo, cardMat), back, slab);
  world.add(cardGroup);
  const makeTexture = () => { cardMat.map = drawPassport(); cardMat.emissiveMap = cardMat.map; cardMat.needsUpdate = true; };
  if (document.fonts?.ready) document.fonts.ready.then(makeTexture); else makeTexture();

  // Calls
  const COUNT = small ? 40 : 64;
  const capsuleGeo = new THREE.CapsuleGeometry(0.034, 0.16, 4, 10); capsuleGeo.rotateX(PI / 2);
  const calls = new THREE.InstancedMesh(capsuleGeo, new THREE.MeshStandardMaterial({roughness: 0.28, metalness: 0.2}), COUNT);
  calls.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 3), 3);
  world.add(calls);
  const state = {mix: [...STAGES[0].mix]};
  const parts = Array.from({length: COUNT}, () => ({}));
  const pick = () => { const [a, k, d] = state.mix; const r = Math.random() * (a + k + d || 1); return r < a ? 'allow' : r < a + k ? 'ask' : 'deny'; };
  function spawn(p, far = true) {
    const r = Math.sqrt(Math.random()) * (R - 0.45), a = Math.random() * PI * 2;
    p.x = Math.cos(a) * r; p.y = Math.sin(a) * r; p.z = far ? rand(-3.6, -0.5) : rand(-3.8, -3);
    p.vx = p.vy = 0; p.vz = rand(1.2, 2.0); p.phase = 'in'; p.t = 0; p.scale = 1; p.fate = pick(); p.color = COLORS.neutral;
  }
  parts.forEach(p => spawn(p));

  // Ledger
  const CHAIN = 14;
  const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshPhysicalMaterial({color: 0xffffff, roughness: 0.18, metalness: 0.25, clearcoat: 1, envMapIntensity: 1.3}), CHAIN);
  blocks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CHAIN * 3), 3);
  const slots = Array.from({length: CHAIN}, (_, i) => new THREE.Vector3(Math.sin(i * 0.5) * 0.12, -0.04 * i, 2.35 + i * 0.62));
  const chainLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(slots), new THREE.LineBasicMaterial({color: 0x10201a, transparent: true, opacity: 0.4}));
  world.add(chainLine, blocks);
  const ledger = Array.from({length: CHAIN}, () => 'neutral');
  let pulse = 0, flash = 0;
  const pushLedger = kind => { ledger.unshift(kind); ledger.pop(); pulse = 1; };
  const resolveCall = (p, kind) => { p.color = COLORS[kind]; flash = 1; onDecision?.(kind); };

  // Rig
  const clone = o => JSON.parse(JSON.stringify(o));
  const cur = clone(STAGES[0]);
  const target = clone(STAGES[0]);
  const pointer = {x: 0, y: 0, sx: 0, sy: 0};
  let override = null;
  let stage = 0;

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
    width = w; height = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  // The subject zone: where on screen the scene is composed (fractions of the viewport).
  let zone = {cx: 0.7, cy: 0.52, w: 0.44, h: 0.8};
  const sph = new THREE.Spherical(), cp = new THREE.Vector3(), tmp = new THREE.Vector3(), look = new THREE.Vector3();
  const HALF = THREE.MathUtils.degToRad(camera.fov / 2);
  let dist = 8;
  function placeCamera() {
    const t = Math.tan(HALF), aspect = width / height;
    // distance at which radius r fills the zone's height and width, whichever binds first
    dist = Math.max(cur.r / (zone.h * t), cur.r / (zone.w * aspect * t));
    look.set(cur.lx, cur.ly, cur.lz);
    sph.set(dist, PI / 2 - cur.el - pointer.sy * 0.04, cur.az + pointer.sx * 0.08);
    cp.setFromSpherical(sph).add(look); camera.position.copy(cp); camera.lookAt(look);
    camera.setViewOffset(width, height, -(zone.cx - 0.5) * width, -(zone.cy - 0.5) * height, width, height);
  }

  const anchors = {};
  function project(name, v) {
    tmp.copy(v); world.localToWorld(tmp); tmp.project(camera);
    anchors[name] = {x: (tmp.x * 0.5 + 0.5) * width, y: (-tmp.y * 0.5 + 0.5) * height, on: tmp.z < 1};
  }
  const gateAnchor = new THREE.Vector3(Math.cos(0.72) * R, Math.sin(0.72) * R, 0);

  const clock = new THREE.Clock();
  let raf = 0, running = false, time = 0;

  function step(dt) {
    time += dt;
    const k = 1 - Math.pow(0.0007, dt);
    for (const key of NUM) if (key !== 'closed') cur[key] += (target[key] - cur[key]) * k;
    for (let i = 0; i < 3; i++) cur.card.p[i] += (target.card.p[i] - cur.card.p[i]) * k;
    for (const key of ['tilt', 'rx', 's', 'o']) cur.card[key] += (target.card[key] - cur.card[key]) * k;
    state.mix = target.mix;
    const wantClosed = override === 'closed' ? 1 : override === 'open' ? 0 : target.closed;
    cur.closed += (wantClosed - cur.closed) * (1 - Math.pow(0.004, dt));
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.pow(0.004, dt));
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.pow(0.004, dt));
    const closed = cur.closed;

    dust.rotation.y = time * 0.012; dust.position.y = Math.sin(time * 0.2) * 0.12;
    dustMat.color.set(cur.dark > 0.5 ? 0xbfe9d3 : 0x0f2a20);
    ring.rotation.z = time * 0.04; ticks.rotation.z = -time * 0.03; blueprint.rotation.z = time * 0.012;
    pulse = Math.max(0, pulse - dt * 2.4); flash = Math.max(0, flash - dt * 3);

    const tone = COLORS.allow.clone().lerp(COLORS.deny, smooth(Math.min(closed * 1.2, 1)));
    core.material.color.copy(tone); glowMat.uniforms.uColor.value.copy(tone);
    glowMat.uniforms.uAmount.value = 0.16 + flash * 0.25 + closed * 0.3;
    membraneMat.opacity = smooth(Math.max(0, (closed - 0.55) / 0.45)) * 0.3;
    const night = cur.dark > 0.5;
    dashMat.opacity = night ? 0.3 : 0.38;
    dashMat.color.set(night ? 0xbfe9d3 : 0x10201a); tickMat.color.set(night ? 0xbfe9d3 : 0x10201a); chainLine.material.color.set(night ? 0xbfe9d3 : 0x10201a);

    irisBack.material.opacity = smooth(Math.max(0, (closed - 0.5) / 0.5));
    blades.forEach(g => {
      g.children[0].scale.y = Math.max(0.0001, closed * (RB + 0.04));
      g.rotation.z = g.userData.a - PI / 2 + closed * 0.5;
      g.visible = closed > 0.01;
    });

    for (let i = 0; i < COUNT; i++) {
      const p = parts[i];
      if (p.phase === 'in') {
        p.z += p.vz * dt;
        if (p.z >= -0.12) {
          const fate = closed > 0.55 ? 'deny' : p.fate;
          if (fate === 'allow') { p.phase = 'pass'; resolveCall(p, 'allow'); p.vz = rand(2.4, 3.2); }
          else if (fate === 'deny') { p.phase = 'bounce'; p.t = 0; resolveCall(p, 'deny'); pushLedger('deny'); const a = Math.random() * PI * 2; p.vx = Math.cos(a) * rand(0.7, 1.7); p.vy = Math.sin(a) * rand(0.7, 1.7); p.vz = -rand(1.4, 2.4); }
          else { p.phase = 'hold'; p.t = 0; p.z = -0.3; p.color = COLORS.ask; flash = 0.6; }
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
      dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(Math.max(p.scale * fadeIn, 0.0001) * (p.phase === 'hold' ? 1.25 : 1)); dummy.updateMatrix();
      calls.setMatrixAt(i, dummy.matrix); calls.setColorAt(i, p.color);
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

    scene.fog.color.copy(LIGHT_BG).lerp(NIGHT_BG, Math.min(1, cur.dark));
    canvas.style.opacity = String(Math.max(0, Math.min(1, cur.opacity)));
    scene.fog.near = dist + 0.2; scene.fog.far = dist + 6.5;
  }

  function draw() {
    placeCamera(); renderer.render(scene, camera);
    camera.updateMatrixWorld();
    project('card', cardGroup.position); project('gate', gateAnchor); project('ledger', slots[3]);
    onFrame?.(anchors, {stage, dark: cur.dark, closed: cur.closed});
  }
  // Adaptive quality: if frames are slow, drop the transmission pass and pixel ratio so the page stays smooth.
  let ema = 0.016, quality = 'high', frames = 0;
  const lockHigh = new URLSearchParams(location.search).get('q') === 'high';
  function downgrade() {
    quality = 'lite';
    glass.transmission = 0; glass.dispersion = 0; glass.transparent = true; glass.opacity = 0.42; glass.needsUpdate = true;
    renderer.setPixelRatio(1); width = 0; resize();
  }
  function frame() {
    if (!running) return;
    const raw = clock.getDelta();
    ema = ema * 0.92 + raw * 0.08; frames++;
    if (quality === 'high' && !lockHigh && frames > 20 && ema > 0.045) downgrade();
    step(Math.min(raw, 0.05)); draw(); raf = requestAnimationFrame(frame);
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
      if (reduced) { for (const key of NUM) cur[key] = target[key]; cur.card = clone(target.card); step(0.016); draw(); }
    },
    /** Where on screen the subject is composed, as fractions of the viewport. */
    setZone(z) { zone = {...zone, ...z}; if (!running) draw(); },
    /** Debug/screenshot helper: advance the simulation n steps and draw. */
    settle(n = 60) { for (let i = 0; i < n; i++) step(0.05); draw(); },
    /** Let the visitor close or reopen the iris by hand; null returns control to scroll. */
    setIris(mode) { override = mode; },
    destroy() {
      stop(); ro.disconnect(); document.removeEventListener('visibilitychange', onVisibility); removeEventListener('pointermove', onPointer);
      scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { x.map?.dispose?.(); x.dispose(); }); });
      envTexture.dispose(); renderer.dispose();
    },
  };
}
