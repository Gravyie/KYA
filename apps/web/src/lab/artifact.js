import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {makeStage, rand, PI, NEON, fontsReady, smooth} from './base.js';

/* 5 · THE ARTIFACT. No world: one exquisite object. The agent's passport as a physical thing: a metal
   shell, a circuit layer, a chip, holographic foil, the printed identity, a glass face. It breathes apart
   into its layers (identity, policy, ledger, kill switch) and back together; it turns toward your cursor. */

const W = 3.4, H = 2.14;
function rounded(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function flatGeo() { const g = new THREE.ShapeGeometry(rounded(W, H, 0.12), 16); const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / W + 0.5, p.getY(i) / H + 0.5); return g; }

function printTexture() {
  const c = document.createElement('canvas'); c.width = 1360; c.height = 856; const g = c.getContext('2d');
  const mono = (px, w = 500) => `${w} ${px}px "Geist Mono Variable", ui-monospace, monospace`;
  g.fillStyle = '#7fefff'; g.font = mono(28); g.fillText('MIHARI · AGENT PASSPORT · 通行証', 80, 110);
  g.fillStyle = '#ffffff'; g.font = '700 118px "Chakra Petch", sans-serif'; g.fillText('RESEARCH-BOT', 76, 290);
  g.fillStyle = '#b9cbe0'; g.font = mono(34);
  ['OPERATOR   ACME INC.', 'SCOPES     read_file · web.search', 'ERC-8004   eip155:84532 · #10353', 'KEY        ed25519 · 8f3a·91c2·77de'].forEach((l, i) => g.fillText(l, 82, 400 + i * 54));
  g.strokeStyle = '#2dff9a'; g.lineWidth = 3; g.strokeRect(82, 650, 230, 62); g.fillStyle = '#2dff9a'; g.font = mono(28, 600); g.fillText('● ACTIVE', 108, 692);
  g.fillStyle = 'rgba(255,255,255,0.9)'; for (let i = 0; i < 30; i++) g.fillRect(900 + i * 13, 640, 4 + (i * 7 % 3) * 3, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function labelTexture(n, title, sub, colr) {
  const c = document.createElement('canvas'); c.width = 900; c.height = 150; const g = c.getContext('2d');
  g.fillStyle = colr; g.font = '700 40px "Geist Mono Variable", monospace'; g.fillText(n, 0, 56);
  g.fillStyle = '#ffffff'; g.font = '700 64px "Chakra Petch", sans-serif'; g.fillText(title, 90, 60);
  g.fillStyle = '#9fb3c8'; g.font = '500 32px "Geist Mono Variable", monospace'; g.fillText(sub, 92, 116);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function create(canvas) {
  const st = makeStage(canvas, {fov: 32, bloom: [0.55, 0.6, 0.85], exposure: 1.05});
  const {scene, camera, renderer} = st;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.background = new THREE.Color(0x05050c);

  // bokeh: soft discs of neon at many depths behind the object
  const B = 70, bpos = new Float32Array(B * 3), bcol = new Float32Array(B * 3), bsize = new Float32Array(B);
  for (let i = 0; i < B; i++) { bpos.set([rand(-30, 30), rand(-16, 16), rand(-40, -8)], i * 3); new THREE.Color([NEON.cyan, NEON.mag, NEON.amber, NEON.violet][i % 4]).toArray(bcol, i * 3); bsize[i] = rand(90, 340); }
  const bgeo = new THREE.BufferGeometry(); bgeo.setAttribute('position', new THREE.BufferAttribute(bpos, 3)); bgeo.setAttribute('aCol', new THREE.BufferAttribute(bcol, 3)); bgeo.setAttribute('aSize', new THREE.BufferAttribute(bsize, 1));
  const bokeh = new THREE.Points(bgeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {uTime: {value: 0}},
    vertexShader: 'attribute vec3 aCol; attribute float aSize; varying vec3 vCol; uniform float uTime; void main(){ vCol = aCol; vec3 p = position; p.y += sin(uTime * 0.2 + position.x) * 0.4; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = aSize / -mv.z * 6.0; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vCol; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.3, r) * 0.07 + smoothstep(1.0, 0.92, r) * smoothstep(0.85, 0.95, r) * 0.05; gl_FragColor = vec4(vCol * a, 1.0); }',
  }));
  scene.add(bokeh);
  const key = new THREE.PointLight(NEON.cyan, 40, 20); key.position.set(-4, 3, 4);
  const rim = new THREE.PointLight(NEON.mag, 60, 20); rim.position.set(5, -2, -2);
  scene.add(key, rim, new THREE.AmbientLight(0x404060, 0.3));

  const card = new THREE.Group(); scene.add(card);
  const layers = [];
  const add = (obj, z, label) => { const g = new THREE.Group(); g.add(obj); g.userData = {z, label}; card.add(g); layers.push(g); return g; };
  // 0 · shell: brushed dark metal with a bevel
  const shellGeo = new THREE.ExtrudeGeometry(rounded(W, H, 0.12), {depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 16}); shellGeo.translate(0, 0, -0.07);
  add(new THREE.Mesh(shellGeo, new THREE.MeshPhysicalMaterial({color: 0x0b0d16, metalness: 0.9, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2})), 0, ['04', 'KILL SWITCH', 'revoke once · closed everywhere', '#ff3b4a']);
  // 1 · circuit: traces with pulses running along them
  const circuit = new THREE.Mesh(flatGeo(), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: {uTime: {value: 0}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uTime;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec2 p = vUv * vec2(34.0, 21.0); vec2 c = floor(p), f = fract(p);
        float h = hash(c), trace = 0.0;
        if (h < 0.45) trace = smoothstep(0.08, 0.0, abs(f.y - 0.5)); else if (h < 0.8) trace = smoothstep(0.08, 0.0, abs(f.x - 0.5));
        trace += smoothstep(0.16, 0.1, length(f - 0.5)) * step(0.9, hash(c + 3.0));
        float pulse = smoothstep(0.9, 1.0, fract(vUv.x * 2.0 - uTime * 0.4 + hash(vec2(c.y, 1.0))));
        vec3 col = vec3(0.1, 0.9, 1.0) * trace * (0.25 + pulse * 1.8);
        gl_FragColor = vec4(col, trace * 0.9);
      }`,
  }));
  add(circuit, 0.03, ['03', 'LEDGER', 'every verdict · sha-256 chained', '#ffb21f']);
  // 2 · chip
  const chip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.03), new THREE.MeshPhysicalMaterial({color: 0xc9b27a, metalness: 1, roughness: 0.25}));
  chip.position.set(W / 2 - 0.62, -0.1, 0);
  add(chip, 0.06, ['02', 'POLICY', 'allow · ask a human · deny', '#2dff9a']);
  // 3 · holographic foil: iridescent, shifting with the viewing angle
  const foil = new THREE.Mesh(flatGeo(), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {uTime: {value: 0}},
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; uniform float uTime;
      vec3 rainbow(float t){ return 0.5 + 0.5 * cos(6.2831853 * (t + vec3(0.0, 0.33, 0.67))); }
      void main(){
        float ang = dot(vN, vV);
        float bands = vUv.x * 2.0 + vUv.y * 1.2 + ang * 3.0 + uTime * 0.05;
        float seal = smoothstep(0.26, 0.24, length((vUv - vec2(0.82, 0.68)) * vec2(1.6, 1.0))) - smoothstep(0.2, 0.18, length((vUv - vec2(0.82, 0.68)) * vec2(1.6, 1.0)));
        float lines = smoothstep(0.3, 0.0, abs(fract(vUv.x * 60.0 + vUv.y * 20.0) - 0.5)) * 0.15;
        vec3 col = rainbow(bands) * (0.08 + lines + seal * 0.8) * (0.4 + 0.6 * pow(1.0 - ang, 2.0));
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  add(foil, 0.09, null);
  // 4 · print: the identity itself
  const printMat = new THREE.MeshBasicMaterial({transparent: true, toneMapped: false, depthWrite: false});
  add(new THREE.Mesh(flatGeo(), printMat), 0.11, ['01', 'IDENTITY', 'its own key · a signed card · an owner', '#19e6ff']);
  // 5 · glass face
  // (not a transmission material: three draws only opaque things through those, which would hide the print)
  add(new THREE.Mesh(flatGeo(), new THREE.MeshPhysicalMaterial({color: 0xbfd8ff, metalness: 0, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.1, envMapIntensity: 0.6, depthWrite: false})), 0.14, null);
  fontsReady().then(() => {
    printMat.map = printTexture(); printMat.needsUpdate = true;
    layers.forEach(l => {
      if (!l.userData.label) return;
      const [n, title, sub, colr] = l.userData.label;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.4), new THREE.MeshBasicMaterial({map: labelTexture(n, title, sub, colr), transparent: true, depthWrite: false, toneMapped: false, opacity: 0}));
      m.position.set(W / 2 + 1.55, H / 2 - 0.15, 0); l.add(m); l.userData.tag = m;
    });
  });

  camera.position.set(0, 0, 9.5);
  st.run((dt, t) => {
    // breathe apart every few seconds, or while the pointer is held
    const cycle = (t % 8) / 8;
    const auto = cycle < 0.35 ? 0 : cycle < 0.5 ? smooth((cycle - 0.35) / 0.15) : cycle < 0.85 ? 1 : 1 - smooth((cycle - 0.85) / 0.15);
    const open = st.pointer.down ? 1 : auto;
    card.userData.open = (card.userData.open ?? 0) + (open - (card.userData.open ?? 0)) * (1 - Math.pow(0.02, dt));
    const o = card.userData.open;
    layers.forEach((l, i) => {
      l.position.z = l.userData.z + o * (i - 2) * 0.62;
      l.position.x = o * (i - 2) * -0.12;
      if (l.userData.tag) l.userData.tag.material.opacity = smooth(Math.max(0, (o - 0.6) / 0.4));
    });
    card.rotation.y = -0.55 * o + st.pointer.sx * 0.35 + Math.sin(t * 0.4) * 0.08;
    card.rotation.x = 0.12 * o - st.pointer.sy * 0.25 + Math.sin(t * 0.3) * 0.05;
    card.position.x = -1.35 - 0.5 * o; card.position.y = Math.sin(t * 0.8) * 0.05;
    circuit.material.uniforms.uTime.value = t; foil.material.uniforms.uTime.value = t; bokeh.material.uniforms.uTime.value = t;
    key.position.x = -4 + Math.sin(t * 0.5) * 2;
  });
  return st;
}
