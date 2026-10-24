import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {makeStage, rand, PI, TAU, NEON, fontsReady, signMesh, WORDS, towerMaterial, towers, rain, sky, flood, studioEnv} from './base.js';

/* 10 · 朱印 STAMP. Shuin, reworked as a monument. A giant lacquered vermilion seal hangs over a rainy neon
   street. Every few seconds it slams down: the street shakes, a shockwave runs out across the water, ink
   splashes, and the verdict burns into the asphalt (可決 · 保留 · 否決) before the seal lifts for the next call. */

function markTexture(word, glow) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  const red = glow ? '#ff5a3a' : '#c8261c';
  g.strokeStyle = red; g.lineWidth = 34; g.strokeRect(40, 40, 432, 432);
  g.fillStyle = red; g.font = '900 190px "Noto Sans JP Variable", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(word[0], 256, 166); g.fillText(word[1], 256, 362);
  // ink texture: worn patches where the seal did not touch
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 260; i++) { g.globalAlpha = Math.random() * 0.5; g.beginPath(); g.arc(Math.random() * 512, Math.random() * 512, Math.random() * 7, 0, TAU); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function create(canvas) {
  const st = makeStage(canvas, {fov: 38, bloom: [0.7, 0.5, 0.82], fog: new THREE.FogExp2(0x0c0510, 0.03)});
  const {scene, camera, renderer} = st;
  studioEnv(renderer, scene, 0.03);
  const s = sky(`vec3 shade(vec3 d){ float e = d.y; vec3 col = mix(vec3(0.32, 0.05, 0.12), vec3(0.015, 0.008, 0.03), smoothstep(-0.02, 0.3, abs(e)));
    if (e < 0.0) col *= 0.4 + 0.3 * fbm(d.xz / max(-e, 0.02) + vec2(0.0, uTime * 0.5)); return col; }`);
  scene.add(s.mesh, new THREE.HemisphereLight(0x8a5cff, 0x200410, 0.6));
  const f = flood(scene, {opacity: 0.5, z: -40});
  const tmat = towerMaterial({fogColor: 0x10061a, fogFar: 40});
  f.add(towers(90, tmat, i => { const a = rand(-PI * 0.95, -PI * 0.05), r = rand(16, 40); return {x: Math.cos(a) * r, z: Math.sin(a) * r - 4, w: rand(3, 6), d: rand(3, 6), h: rand(8, 30)}; }));
  fontsReady().then(() => { for (let i = 0; i < 12; i++) { const w = WORDS[i % WORDS.length], v = /[^A-Z0-9]/.test(w); const m = signMesh(w, ['#ff2fa6', '#19e6ff', '#ffb21f'][i % 3], v ? rand(2.5, 4) : 1.4, v); const a = rand(-PI * 0.9, -PI * 0.1); m.position.set(Math.cos(a) * 14, rand(3, 9), Math.sin(a) * 14 - 4); m.lookAt(0, m.position.y, 6); f.add(m); } });

  // the seal: a lacquered block with a carved handle
  const seal = new THREE.Group(); scene.add(seal);
  const lacquer = new THREE.MeshPhysicalMaterial({color: 0xb0180f, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08, emissive: 0x2a0402});
  const body = new THREE.Mesh(new RoundedBoxGeometry(3.6, 3.4, 3.6, 4, 0.25), lacquer); body.position.y = 1.7; seal.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 1.2, 32), lacquer); neck.position.y = 3.9; seal.add(neck);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(1.25, 32, 24), lacquer); knob.position.y = 5.1; knob.scale.y = 0.8; seal.add(knob);
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.06, 8, 4), new THREE.MeshPhysicalMaterial({color: 0xd4a640, metalness: 1, roughness: 0.25})); band.rotation.set(PI / 2, 0, PI / 4); band.scale.set(1.3, 1.3, 1); band.position.y = 3.1; seal.add(band);
  const sealLight = new THREE.PointLight(0xff5530, 0, 18, 1.6); scene.add(sealLight);

  // marks on the street: each stamp leaves one; the newest glows, older ones fade
  const VERDICTS = [['可', '決'], ['認', '証'], ['保', '留'], ['否', '決']];
  const marks = [], glowMarks = [];
  fontsReady().then(() => VERDICTS.forEach(w => { marks.push(markTexture(w, false)); glowMarks.push(markTexture(w, true)); }));
  const decals = Array.from({length: 6}, () => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 3.7), new THREE.MeshBasicMaterial({transparent: true, opacity: 0, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2}));
    m.rotation.x = -PI / 2; m.position.y = 0.01; scene.add(m); return {m, life: 0};
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 3.9), new THREE.MeshBasicMaterial({transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false}));
  glow.rotation.x = -PI / 2; glow.position.y = 0.02; scene.add(glow);
  // shockwave across the water, and ink splashing
  const wave = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 128), new THREE.MeshBasicMaterial({color: new THREE.Color(1, 0.35, 0.2).multiplyScalar(2.5), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false}));
  wave.rotation.x = -PI / 2; wave.position.y = 0.03; scene.add(wave);
  const P = 380, ink = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({color: new THREE.Color(0.9, 0.08, 0.05).multiplyScalar(2.2), toneMapped: false}), P);
  const drops = Array.from({length: P}, () => ({p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0}));
  scene.add(ink);
  const r = rain(st.small ? 500 : 1100, {size: [26, 14, 26]}); scene.add(r.mesh);

  const CYCLE = 4.2, dm = new THREE.Object3D();
  let last = -1, shake = 0, which = 0, spot = new THREE.Vector3(), di = 0;
  st.run((dt, t) => {
    const c = (t % CYCLE) / CYCLE, k = Math.floor(t / CYCLE);
    if (k !== last) { last = k; which = k % VERDICTS.length; spot.set(rand(-3, 3), 0, rand(-3, 2)); }
    // hover, wind up, slam, hold, lift
    let y;
    if (c < 0.45) y = 9 + Math.sin(t * 1.3) * 0.3 + c * 2;
    else if (c < 0.53) { const u = (c - 0.45) / 0.08; y = 9.9 - 9.9 * u * u * u; }
    else if (c < 0.7) y = 0;
    else y = 9.9 * (1 - Math.pow(1 - (c - 0.7) / 0.3, 3));
    const hit = c >= 0.53 && c - dt / CYCLE < 0.53;
    seal.position.set(spot.x, y, spot.z); seal.rotation.y = c < 0.45 ? t * 0.4 : seal.rotation.y;
    sealLight.position.set(spot.x, 1, spot.z);
    if (hit && marks.length) {
      shake = 1;
      const d = decals[di++ % decals.length]; d.m.material.map = marks[which]; d.m.material.needsUpdate = true; d.m.position.set(spot.x, 0.01, spot.z); d.m.rotation.z = seal.rotation.y; d.life = 1;
      glow.material.map = glowMarks[which]; glow.material.needsUpdate = true; glow.position.set(spot.x, 0.02, spot.z); glow.rotation.z = seal.rotation.y; glow.material.opacity = 1;
      wave.position.set(spot.x, 0.03, spot.z); wave.userData.t = 0;
      drops.forEach(p => { const a = rand(0, TAU), sp = rand(2, 9); p.p.set(spot.x + Math.cos(a) * 1.9, 0.1, spot.z + Math.sin(a) * 1.9); p.v.set(Math.cos(a) * sp, rand(2, 9), Math.sin(a) * sp); p.life = rand(0.6, 1.2); });
    }
    shake = Math.max(0, shake - dt * 3);
    decals.forEach(d => { d.life = Math.max(0, d.life - dt * 0.035); d.m.material.opacity = Math.min(0.9, d.life * 1.2); });
    glow.material.opacity = Math.max(0, glow.material.opacity - dt * 0.6);
    sealLight.intensity = glow.material.opacity * 60;
    if (wave.userData.t !== undefined) { wave.userData.t += dt; const u = wave.userData.t / 1.4; wave.scale.setScalar(2 + u * 26); wave.material.opacity = Math.max(0, 1 - u) * 0.9; }
    drops.forEach((p, i) => { if (p.life > 0) { p.life -= dt; p.v.y -= 22 * dt; p.p.addScaledVector(p.v, dt); if (p.p.y < 0.05) { p.p.y = 0.05; p.v.set(0, 0, 0); } } dm.position.copy(p.p); dm.scale.setScalar(Math.max(0.0001, Math.min(1, p.life * 2))); dm.updateMatrix(); ink.setMatrixAt(i, dm.matrix); });
    ink.instanceMatrix.needsUpdate = true;
    const ang = 0.35 + Math.sin(t * 0.1) * 0.15 + st.pointer.sx * 0.25;
    camera.position.set(Math.sin(ang) * 21 + Math.sin(t * 61) * shake * 0.15, 3.6 - st.pointer.sy * 1.2 + Math.cos(t * 47) * shake * 0.15, Math.cos(ang) * 21);
    camera.lookAt(-2.5, 4.6, 0);
    camera.updateMatrixWorld(); s.update(camera, t); r.update(t, new THREE.Vector3(0, 6, 0)); tmat.uniforms.uTime.value = t;
  });
  return st;
}
