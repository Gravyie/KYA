import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';

/*
 * The Gate. One object tells the whole product: agent calls stream toward a
 * black-chrome ring, each gets a verdict (allow / ask / deny), and every verdict
 * lands as a block on the hash-linked ledger behind it. Scroll moves the camera
 * through keyframes; the last stage closes the gate (revocation).
 */

const COLORS = {
  neutral: new THREE.Color(0x44453e),
  allow: new THREE.Color(0x1fbf80),
  ask: new THREE.Color(0xe3a21c),
  deny: new THREE.Color(0xe2452d),
};

// az/el/dist orbit the gate; sx/sy shift it across the screen (fraction of the viewport).
const PI = Math.PI;
const STAGES = [
  {az: PI + 0.95, el: 0.16, dist: 8.2, sx: 0.2, sy: 0.02, closed: 0, opacity: 1, mix: [0.6, 0.2, 0.2]},     // hero
  {az: PI + 0.8, el: 0.2, dist: 15, sx: 0.28, sy: 0.1, closed: 0, opacity: 0.16, mix: [0.6, 0.2, 0.2]},     // the gap (recedes behind text)
  {az: PI - 0.75, el: 0.1, dist: 6.8, sx: -0.2, sy: 0, closed: 0, opacity: 1, mix: [0.5, 0.25, 0.25]},        // how it works
  {az: PI + 0.5, el: 0.35, dist: 13, sx: 0.3, sy: 0.18, closed: 0, opacity: 0.5, mix: [0.6, 0.2, 0.2]},      // playground
  {az: PI + 0.9, el: 0.25, dist: 14, sx: -0.4, sy: 0.2, closed: 0, opacity: 0.2, mix: [0.7, 0.15, 0.15]}, // integrations
  {az: PI + 0.35, el: 0.06, dist: 6.4, sx: 0.2, sy: 0, closed: 1, opacity: 1, mix: [0, 0, 1]},               // revoke
  {az: PI + 0.55, el: 0.14, dist: 12, sx: 0, sy: -0.3, closed: 0, opacity: 0.55, mix: [0.9, 0.05, 0.05]},     // call to action
];

const LEDGER = {neutral: new THREE.Color(0x3a3b35), allow: new THREE.Color(0x35b985), deny: new THREE.Color(0xd9503a)};
const smooth = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

function ringGlowMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {uColor: {value: new THREE.Color(COLORS.allow)}, uAmount: {value: 0.2}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform vec3 uColor; uniform float uAmount;
      void main(){
        float r = length(vUv - 0.5) * 2.0;
        float band = exp(-pow((r - 0.5) * 7.0, 2.0));
        float inner = smoothstep(0.5, 0.0, r) * 0.1;
        float a = (band * 0.6 + inner) * uAmount;
        gl_FragColor = vec4(uColor, a);
      }`,
  });
}

export function createScene(canvas, {onDecision, reduced = false, small = false} = {}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
  scene.environment = envTexture;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
  const world = new THREE.Group();
  scene.add(world);

  // Ring
  const chrome = new THREE.MeshPhysicalMaterial({
    color: 0x14150f, metalness: 1, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.35,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.12, 72, 200), chrome);
  world.add(ring);

  const edgeMat = new THREE.MeshBasicMaterial({color: COLORS.allow});
  const edge = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.022, 16, 200), edgeMat);
  world.add(edge);

  const glowMat = ringGlowMaterial();
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6), glowMat);
  glow.position.z = -0.02;
  world.add(glow);

  // Closed-gate membrane, visible when the agent is revoked.
  const membraneMat = new THREE.MeshPhysicalMaterial({color: COLORS.deny, transparent: true, opacity: 0, roughness: 0.2, metalness: 0, transmission: 0, side: THREE.DoubleSide, depthWrite: false});
  const membrane = new THREE.Mesh(new THREE.CircleGeometry(1.4, 96), membraneMat);
  world.add(membrane);

  // Dial of ticks around the ring
  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.012, 0.09), new THREE.MeshStandardMaterial({color: 0x15160f, roughness: 0.5, metalness: 0.6}), 96);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const long = i % 8 === 0;
    dummy.position.set(Math.cos(a) * 2.05, Math.sin(a) * 2.05, 0);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(long ? 1.8 : 1, long ? 1.8 : 1, long ? 1.8 : 0.9);
    dummy.updateMatrix();
    ticks.setMatrixAt(i, dummy.matrix);
  }
  world.add(ticks);

  // Agent calls
  const COUNT = small ? 40 : 64;
  const capsuleGeo = new THREE.CapsuleGeometry(0.034, 0.16, 4, 10);
  capsuleGeo.rotateX(Math.PI / 2);
  const calls = new THREE.InstancedMesh(capsuleGeo, new THREE.MeshStandardMaterial({roughness: 0.35, metalness: 0.15}), COUNT);
  calls.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 3), 3);
  world.add(calls);

  const state = {mix: [...STAGES[0].mix], closed: 0};
  const parts = Array.from({length: COUNT}, () => ({}));

  function spawn(p, startFar = true) {
    const r = Math.sqrt(Math.random()) * 1.12, a = Math.random() * Math.PI * 2;
    p.x = Math.cos(a) * r; p.y = Math.sin(a) * r;
    p.z = startFar ? rand(-3.6, -0.5) : rand(-3.8, -3);
    p.vx = 0; p.vy = 0; p.vz = rand(1.2, 2.0);
    p.phase = 'in'; p.t = 0; p.scale = 1;
    p.fate = pick();
    p.color = COLORS.neutral;
  }
  function pick() {
    const [a, k, d] = state.mix;
    const roll = Math.random() * (a + k + d || 1);
    return roll < a ? 'allow' : roll < a + k ? 'ask' : 'deny';
  }
  parts.forEach(p => spawn(p));

  // Ledger: a conveyor of blocks behind the gate, newest nearest.
  const CHAIN = 15;
  const blockGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  const blocks = new THREE.InstancedMesh(blockGeo, new THREE.MeshPhysicalMaterial({color: 0xffffff, roughness: 0.22, metalness: 0.35, clearcoat: 0.8}), CHAIN);
  blocks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CHAIN * 3), 3);
  const chainSlots = [];
  const chainPoints = [];
  for (let i = 0; i < CHAIN; i++) {
    const z = 2.35 + i * 0.62;
    chainSlots.push(new THREE.Vector3(Math.sin(i * 0.5) * 0.12, -0.04 * i, z));
    chainPoints.push(chainSlots[i].clone());
  }
  const chainLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(chainPoints), new THREE.LineBasicMaterial({color: 0x0e0f0c, transparent: true, opacity: 0.35}));
  world.add(chainLine, blocks);
  const ledger = Array.from({length: CHAIN}, () => 'neutral');
  let pulse = 0, ringFlash = 0;

  function pushLedger(kind) {
    ledger.unshift(kind); ledger.pop();
    pulse = 1;
  }

  function resolveCall(p, kind) {
    p.color = COLORS[kind];
    ringFlash = 1;
    onDecision?.(kind);
  }

  // Camera rig
  const target = {...STAGES[0], mix: [...STAGES[0].mix]};
  const cur = {...STAGES[0]};
  const pointer = {x: 0, y: 0, sx: 0, sy: 0};
  let stage = 0;

  function aimFor(fractional) {
    const i = Math.min(Math.floor(fractional), STAGES.length - 2);
    const t = smooth(Math.min(Math.max(fractional - i, 0), 1));
    const a = STAGES[Math.max(i, 0)], b = STAGES[i + 1];
    for (const k of ['az', 'el', 'dist', 'sx', 'sy', 'closed', 'opacity']) target[k] = lerp(a[k], b[k], t);
    target.mix = a.mix.map((v, j) => lerp(v, b.mix[j], t));
  }
  aimFor(0);

  let width = 1, height = 1;
  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    if (w === width && h === height && renderer.domElement.width) return;
    width = w; height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const spherical = new THREE.Spherical();
  const pos = new THREE.Vector3();
  function placeCamera() {
    const portrait = width / height < 0.85;
    const dist = cur.dist * (portrait ? 1.9 : 1);
    spherical.set(dist, Math.PI / 2 - cur.el - pointer.sy * 0.05, cur.az + pointer.sx * 0.1);
    pos.setFromSpherical(spherical);
    camera.position.copy(pos);
    camera.lookAt(0, 0, 0);
    const sx = portrait ? 0 : cur.sx;
    const sy = portrait ? cur.sy - 0.3 : cur.sy;
    camera.setViewOffset(width, height, -sx * width, sy * height, width, height);
  }

  const clock = new THREE.Clock();
  let raf = 0, running = false, time = 0;

  function step(dt) {
    time += dt;
    // ease the rig toward its target
    const k = 1 - Math.pow(0.0009, dt);
    for (const key of ['az', 'el', 'dist', 'sx', 'sy', 'closed', 'opacity']) cur[key] += (target[key] - cur[key]) * k;
    state.mix = target.mix; state.closed = cur.closed;
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.pow(0.004, dt));
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.pow(0.004, dt));

    const closed = cur.closed;
    ring.rotation.z = time * 0.05;
    ticks.rotation.z = -time * 0.035;
    pulse = Math.max(0, pulse - dt * 2.4);
    ringFlash = Math.max(0, ringFlash - dt * 3);

    // Tone of the gate follows its state.
    const tone = COLORS.allow.clone().lerp(COLORS.deny, smooth(Math.min(closed * 1.2, 1)));
    edgeMat.color.copy(tone);
    glowMat.uniforms.uColor.value.copy(tone);
    glowMat.uniforms.uAmount.value = 0.13 + ringFlash * 0.22 + closed * 0.2;
    membraneMat.opacity = smooth(Math.max(0, (closed - 0.25) / 0.75)) * 0.26;
    edge.scale.setScalar(1 - closed * 0.04);

    for (let i = 0; i < COUNT; i++) {
      const p = parts[i];
      if (p.phase === 'in') {
        p.z += p.vz * dt;
        if (p.z >= -0.12) {
          const fate = closed > 0.6 ? 'deny' : p.fate;
          if (fate === 'allow') { p.phase = 'pass'; resolveCall(p, 'allow'); p.vz = rand(2.4, 3.2); }
          else if (fate === 'deny') {
            p.phase = 'bounce'; p.t = 0; resolveCall(p, 'deny'); pushLedger('deny');
            const a = Math.random() * Math.PI * 2;
            p.vx = Math.cos(a) * rand(0.7, 1.7); p.vy = Math.sin(a) * rand(0.7, 1.7); p.vz = -rand(1.4, 2.4);
          } else { p.phase = 'hold'; p.t = 0; p.z = -0.3; p.color = COLORS.ask; ringFlash = 0.6; }
        }
      } else if (p.phase === 'hold') {
        p.t += dt;
        p.z = -0.3 + Math.sin(p.t * 5) * 0.015;
        if (p.t > 1.5) {
          if (Math.random() < 0.72) { p.phase = 'pass'; resolveCall(p, 'allow'); p.vz = 2.6; }
          else { p.phase = 'bounce'; p.t = 0; resolveCall(p, 'deny'); pushLedger('deny'); p.vx = rand(-1.2, 1.2); p.vy = rand(-1.2, 1.2); p.vz = -1.8; }
        }
      } else if (p.phase === 'pass') {
        p.z += p.vz * dt;
        p.x *= 1 - dt * 0.35; p.y *= 1 - dt * 0.35;
        if (p.z > 2.0) { p.phase = 'log'; p.t = 0; }
      } else if (p.phase === 'log') {
        p.t += dt * 2.2;
        const slot = chainSlots[0];
        p.x += (slot.x - p.x) * Math.min(1, dt * 6); p.y += (slot.y - p.y) * Math.min(1, dt * 6);
        p.z += (slot.z - p.z) * Math.min(1, dt * 5);
        p.scale = Math.max(0, 1 - p.t);
        if (p.t >= 1) { pushLedger('allow'); spawn(p, false); }
      } else if (p.phase === 'bounce') {
        p.t += dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.scale = Math.max(0, 1 - p.t * 1.1);
        if (p.t > 0.95) spawn(p, false);
      }
      const fadeIn = p.phase === 'in' ? smooth(Math.min(Math.max((p.z + 2.8) / 1.2, 0), 1)) : 1;
      const s = p.scale * fadeIn;
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(Math.max(s, 0.0001) * (p.phase === 'hold' ? 1.25 : 1));
      dummy.updateMatrix();
      calls.setMatrixAt(i, dummy.matrix);
      calls.setColorAt(i, p.color);
    }
    calls.instanceMatrix.needsUpdate = true;
    calls.instanceColor.needsUpdate = true;

    for (let i = 0; i < CHAIN; i++) {
      const fade = 1 - i / CHAIN;
      const lit = ledger[i];
      const base = lit === 'neutral' ? LEDGER.neutral : lit === 'allow' ? LEDGER.allow : LEDGER.deny;
      blocks.setColorAt(i, base);
      dummy.position.copy(chainSlots[i]);
      dummy.rotation.set(0, time * 0.15 + i * 0.4, 0);
      dummy.scale.setScalar((0.55 + fade * 0.45) * (i === 0 ? 1 + pulse * 0.35 : 1));
      dummy.updateMatrix();
      blocks.setMatrixAt(i, dummy.matrix);
    }
    blocks.instanceMatrix.needsUpdate = true;
    blocks.instanceColor.needsUpdate = true;
    chainLine.material.opacity = 0.35 * (cur.opacity > 0.9 ? 1 : 0.6);

    canvas.style.opacity = String(Math.min(1, Math.max(0.12, cur.opacity)));
  }

  function draw() {
    placeCamera();
    renderer.render(scene, camera);
  }

  function frame() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    step(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (reduced || running) return;
    running = true; clock.getDelta(); raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  const onVisibility = () => (document.hidden ? stop() : start());
  const onPointer = e => {
    pointer.x = (e.clientX / window.innerWidth - 0.5) * 2;
    pointer.y = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  const ro = new ResizeObserver(() => { resize(); if (!running) draw(); });
  ro.observe(canvas);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pointermove', onPointer, {passive: true});

  resize();
  if (reduced) {
    // A still frame: simulate a few seconds so the stream and ledger are populated.
    for (let i = 0; i < 260; i++) step(0.03);
    cur.az = target.az; draw();
  } else start();

  return {
    setStage(fractional) {
      stage = fractional;
      aimFor(fractional);
      if (reduced) { for (const k of ['az', 'el', 'dist', 'sx', 'sy', 'closed', 'opacity']) cur[k] = target[k]; step(0.016); draw(); }
    },
    get stage() { return stage; },
    destroy() {
      stop(); ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
      scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => x.dispose()); });
      envTexture.dispose(); pmrem.dispose(); renderer.dispose();
    },
  };
}
