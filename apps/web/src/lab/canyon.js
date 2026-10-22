import * as THREE from 'three';
import {makeStage, rand, PI, TAU, NEON, fontsReady, signMesh, WORDS, towerMaterial, towers, rain, sky, flood} from './base.js';

/* 7 · CHECKPOINT CANYON. The early corridor, reworked: a fast low flight down a flooded neon canyon through an
   endless run of ring gates. Each ring is a checkpoint; its iris flashes the verdict of the call flying through. */

export function create(canvas) {
  const st = makeStage(canvas, {fov: 50, bloom: [0.85, 0.5, 0.78], fog: new THREE.FogExp2(0x0a0618, 0.02)});
  const {scene, camera} = st;
  const s = sky(`vec3 shade(vec3 d){
    float e = d.y;
    vec3 col = mix(vec3(0.5, 0.08, 0.32), vec3(0.015, 0.012, 0.045), smoothstep(-0.02, 0.32, abs(e)));
    col += vec3(0.1, 0.5, 0.8) * exp(-abs(e) * 30.0) * 0.25;
    if (e < 0.0) col *= 0.5 + 0.3 * fbm(d.xz / max(-e, 0.02) * 1.3 + vec2(0.0, uTime * 0.8));
    return col;
  }`);
  scene.add(s.mesh, new THREE.HemisphereLight(0x7a5cff, 0x22051a, 0.8));
  const f = flood(scene, {opacity: 0.5});

  const LEN = 240, GAP = 16;
  const tmat = towerMaterial({fogColor: 0x0d0720, fogFar: 60});
  // the camera holds still and the world streams past it, wrapping, so the flight never ends or jumps
  const wrapZ = z => ((z % LEN) + LEN) % LEN - LEN + 12;
  const lots = Array.from({length: 220}, (_, i) => { const side = i % 2 ? 1 : -1; return {x: side * (rand(7, 10) + (i % 5 === 0 ? rand(2, 9) : 0)), z: rand(-LEN, 0), w: rand(2, 4.5), d: rand(2, 4.5), h: rand(5, 26) * (Math.random() < 0.12 ? 1.8 : 1)}; });
  const city = towers(lots.length, tmat, i => lots[i]);
  const cityM = city.clone(); cityM.instanceMatrix = city.instanceMatrix; f.real.add(city); f.mirror.add(cityM);
  const signs = [];
  fontsReady().then(() => {
    for (let i = 0; i < 30; i++) {
      const word = WORDS[i % WORDS.length], v = /[^A-Z0-9]/.test(word) && i % 2 === 0;
      const m = signMesh(word, ['#ff2fa6', '#19e6ff', '#ffb21f', '#9a6bff'][i % 4], v ? rand(2, 3.6) : rand(0.9, 1.4), v);
      const side = i % 2 ? 1 : -1; m.position.set(side * rand(5.6, 6.6), rand(2.5, 9), 0); m.rotation.y = -side * PI / 2;
      const mm = m.clone(); f.real.add(m); f.mirror.add(mm); signs.push({m, mm, z: rand(-LEN, 0)});
    }
  });

  // ring gates: a glowing torus, a tick ring, and an iris disc that flashes
  const rings = [];
  const ringGeo = new THREE.TorusGeometry(4.6, 0.09, 8, 160), tickGeo = new THREE.TorusGeometry(5.0, 0.02, 4, 160), irisGeo = new THREE.CircleGeometry(4.5, 64);
  for (let i = 0; i < LEN / GAP; i++) {
    const g = new THREE.Group(); g.position.set(0, 4.4, -i * GAP);
    const col = new THREE.Color(i % 2 ? NEON.cyan : NEON.mag);
    const rm = new THREE.MeshBasicMaterial({color: col.clone().multiplyScalar(2), toneMapped: false});
    const im = new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false});
    g.add(new THREE.Mesh(ringGeo, rm), new THREE.Mesh(tickGeo, rm), new THREE.Mesh(irisGeo, im));
    g.userData = {col, rm, im, flash: 0};
    f.real.add(g); rings.push(g);
    const mg = g.clone(true); f.mirror.add(mg); g.userData.mirror = mg;
  }
  // runway lights in the flood, chasing toward the vanishing point
  const RUN = 120, run = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.04, 1), new THREE.MeshBasicMaterial({toneMapped: false}), RUN * 2);
  run.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(RUN * 2 * 3), 3);
  const dm = new THREE.Object3D();
  for (let i = 0; i < RUN * 2; i++) { dm.position.set(i % 2 ? 4 : -4, 0.03, -Math.floor(i / 2) * 2); dm.updateMatrix(); run.setMatrixAt(i, dm.matrix); }
  scene.add(run);
  // calls: streaks flying the canyon with the camera, judged at each ring
  const C = 40, calls = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.03, 1.2, 4, 8).rotateX(PI / 2), new THREE.MeshBasicMaterial({toneMapped: false}), C);
  calls.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(C * 3), 3);
  const KIND = [new THREE.Color(NEON.jade).multiplyScalar(3), new THREE.Color(NEON.amber).multiplyScalar(3), new THREE.Color(NEON.red).multiplyScalar(3.5)];
  const cs = Array.from({length: C}, () => ({x: rand(-3.5, 3.5), y: rand(1.5, 7.5), z: rand(-LEN, 0), v: rand(26, 40), k: Math.random() < 0.7 ? 0 : Math.random() < 0.5 ? 1 : 2}));
  scene.add(calls);
  // traffic overhead
  const T = 80, traffic = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.06, 1), new THREE.MeshBasicMaterial({toneMapped: false}), T);
  traffic.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(T * 3), 3);
  const tr = Array.from({length: T}, (_, i) => ({x: rand(-14, 14), y: rand(10, 18), z: rand(-LEN, 10), v: rand(10, 25) * (i % 2 ? 1 : -1), c: new THREE.Color([NEON.cyan, NEON.mag, NEON.amber][i % 3]).multiplyScalar(2)}));
  scene.add(traffic);
  const r = rain(st.small ? 600 : 1400, {size: [16, 12, 30], speed: [14, 20]}); scene.add(r.mesh);

  let camZ = 6, dist = 0, tc = new THREE.Color();
  rings.forEach((g, i) => { g.userData.z0 = -i * GAP; });
  st.run((dt, t) => {
    const speed = 20 + Math.sin(t * 0.3) * 4;
    dist += speed * dt;
    lots.forEach((o, i) => { dm.position.set(o.x, o.h / 2, wrapZ(o.z + dist)); dm.rotation.set(0, 0, 0); dm.scale.set(o.w, o.h, o.d); dm.updateMatrix(); city.setMatrixAt(i, dm.matrix); });
    city.instanceMatrix.needsUpdate = true;
    signs.forEach(sg => { sg.m.position.z = sg.mm.position.z = wrapZ(sg.z + dist); });
    rings.forEach(g => { g.position.z = g.userData.mirror.position.z = wrapZ(g.userData.z0 + dist); });
    const bank = Math.sin(t * 0.4) * 0.6 + st.pointer.sx * 0.8;
    camera.position.set(bank, 3.6 + Math.sin(t * 0.5) * 0.4 - st.pointer.sy * 0.6, camZ);
    camera.lookAt(bank * 0.5, 4.3, camZ - 30); camera.rotateZ(-Math.cos(t * 0.4) * 0.06 - st.pointer.sx * 0.05);
    camera.updateMatrixWorld(); s.update(camera, t); r.update(t, camera.position.clone().add(new THREE.Vector3(0, 0, -12))); tmat.uniforms.uTime.value = t;
    rings.forEach((g, i) => {
      const u = g.userData; u.flash = Math.max(0, u.flash - dt * 2.5);
      const near = Math.exp(-Math.pow((g.position.z - camZ + 8) / 10, 2));
      u.rm.color.copy(u.col).multiplyScalar(1.8 + near * 2.5 + u.flash * 2);
      u.im.opacity = u.flash * 0.35 * Math.min(1, Math.max(0, (camZ - g.position.z - 14) / 20)); g.rotation.z = t * (i % 2 ? 0.2 : -0.2);
      u.mirror.rotation.z = g.rotation.z; u.mirror.children[2].material.opacity = u.im.opacity;
    });
    cs.forEach((c, i) => {
      const prev = c.z; c.z -= (c.v - speed) * dt;
      rings.forEach((g, gi) => { const z = g.position.z; if (prev > z && c.z <= z && gi % 3 === 0) { g.userData.flash = 1; g.userData.im.color.copy(KIND[c.k]); } });
      if (c.z < camZ - 120 || c.z > camZ + 4) { c.z = camZ + rand(-4, 2); c.k = Math.random() < 0.7 ? 0 : Math.random() < 0.5 ? 1 : 2; }
      dm.position.set(c.x, c.y, c.z); dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1 + speed / 20); dm.updateMatrix(); calls.setMatrixAt(i, dm.matrix); calls.setColorAt(i, KIND[c.k]);
    });
    calls.instanceMatrix.needsUpdate = calls.instanceColor.needsUpdate = true;
    for (let i = 0; i < RUN * 2; i++) { const w = 0.2 + 0.8 * Math.pow(0.5 + 0.5 * Math.sin(Math.floor(i / 2) * 0.5 + t * 9 + dist * 0.25), 4); run.setColorAt(i, tc.set(i % 2 ? NEON.mag : NEON.cyan).multiplyScalar(0.4 + w * 2.2)); }
    for (let i = 0; i < RUN * 2; i++) { dm.position.set(i % 2 ? 4 : -4, 0.03, wrapZ(-Math.floor(i / 2) * 2 + dist)); dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1); dm.updateMatrix(); run.setMatrixAt(i, dm.matrix); }
    run.instanceColor.needsUpdate = run.instanceMatrix.needsUpdate = true;
    tr.forEach((o, i) => { o.z += (o.v + speed) * dt; if (o.z > camZ + 10) o.z = camZ - LEN + 60; if (o.z < camZ - LEN + 60) o.z = camZ + 10; dm.position.set(o.x, o.y, o.z); dm.scale.set(1, 1, 2 + Math.abs(o.v) / 8); dm.updateMatrix(); traffic.setMatrixAt(i, dm.matrix); traffic.setColorAt(i, o.c); });
    traffic.instanceMatrix.needsUpdate = traffic.instanceColor.needsUpdate = true;
  });
  return st;
}
