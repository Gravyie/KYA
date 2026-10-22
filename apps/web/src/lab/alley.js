import * as THREE from 'three';
import {makeStage, rand, PI, NEON, fontsReady, signMesh, towerMaterial, towers, rain, sky, flood, softPoints} from './base.js';

/* 14 · BACK ALLEY. Street level in a Kowloon night market: a narrow lane walled in by shopfronts, signs jutting
   out at every height, cables strung overhead with lanterns, steam from vents, puddles holding all of it.
   Every shop is a service your agent might call; the walk goes on forever. */

const SHOP = ['薬', '酒', '電脳', '修理', '両替', '麺', '質', '鍵', '情報', '代行', '24H', 'API', '認証', '外部'];

export function create(canvas) {
  const st = makeStage(canvas, {fov: 50, bloom: [0.6, 0.45, 0.85], fog: new THREE.FogExp2(0x0a0410, 0.05)});
  const {scene, camera} = st;
  const s = sky(`vec3 shade(vec3 d){ float e = d.y; vec3 col = mix(vec3(0.3, 0.08, 0.2), vec3(0.02, 0.01, 0.04), smoothstep(0.0, 0.5, abs(e)));
    if (e < 0.0) col *= 0.35 + 0.35 * fbm(d.xz / max(-e, 0.02) * 1.5 + vec2(0.0, uTime * 0.3)); return col; }`);
  scene.add(s.mesh, new THREE.HemisphereLight(0x8a6cff, 0x2a0a10, 0.7));
  const f = flood(scene, {opacity: 0.4, size: [40, 200], z: -60});
  const LEN = 90, W = 2.4;
  const wrapZ = z => ((z % LEN) + LEN) % LEN - LEN + 8;

  // the walls: shopfront blocks, shoulder to shoulder
  const tmat = towerMaterial({fogColor: 0x120718, fogFar: 26, windowScale: [0.7, 0.9]});
  const lots = []; for (const side of [-1, 1]) for (let z = 0; z > -LEN; z -= rand(2.2, 3.6)) lots.push({x: side * (W + 1.6), z, w: 3.2, d: rand(2, 3.4), h: rand(8, 22), y0: 0});
  const walls = towers(lots.length, tmat, i => lots[i]);
  const wallsM = walls.clone(); wallsM.instanceMatrix = walls.instanceMatrix; f.real.add(walls); f.mirror.add(wallsM);
  // shop counters glowing at street level
  const counters = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 1.6, 2), new THREE.MeshBasicMaterial({toneMapped: false}), lots.length);
  counters.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(lots.length * 3), 3);
  lots.forEach((o, i) => counters.setColorAt(i, new THREE.Color([0xffb070, 0xffd8a0, 0x8af0ff, 0xff7ad0][i % 4]).multiplyScalar(i % 3 ? 0.7 : 0.15)));
  f.real.add(counters);
  // signs jutting into the lane (they face down the lane, like Hong Kong's), and lanterns on cables
  const signs = [];
  fontsReady().then(() => {
    for (let i = 0; i < 46; i++) {
      const word = SHOP[i % SHOP.length], vertical = /[^A-Z0-9]/.test(word) && i % 3 !== 0;
      const m = signMesh(word, ['#ff2fa6', '#19e6ff', '#ffb21f', '#ff3b4a', '#2dff9a'][i % 5], vertical ? rand(1.4, 2.6) : rand(0.55, 0.9), vertical);
      const side = i % 2 ? 1 : -1; m.position.set(side * rand(1.0, W + 0.4), rand(2.4, 9), 0);
      const mm = m.clone(); f.real.add(m); f.mirror.add(mm); signs.push({m, mm, z: rand(-LEN, 0)});
    }
  });
  const L = 70, lanterns = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({color: new THREE.Color(1, 0.25, 0.1).multiplyScalar(2.4), toneMapped: false}), L);
  const lanternZ = Array.from({length: L}, () => ({z: rand(-LEN, 0), x: rand(-W, W), y: rand(4.2, 6.5)}));
  f.real.add(lanterns);
  const cableMat = new THREE.LineBasicMaterial({color: 0x050308});
  const cables = [];
  for (let i = 0; i < 26; i++) { const z = rand(-LEN, 0), y = rand(4.5, 9); const pts = []; for (let k = 0; k <= 12; k++) { const u = k / 12; pts.push(new THREE.Vector3(-W - 1.5 + u * (2 * W + 3), y - Math.sin(u * PI) * 0.8, rand(-0.3, 0.3))); } const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cableMat); scene.add(line); cables.push({line, z}); }
  // steam rising from vents
  const S = 300, sp = new Float32Array(S * 3), steamSeed = Array.from({length: S}, () => ({x: rand(-W, W), z: rand(-LEN, 0), y: rand(0, 3), v: rand(0.4, 1)}));
  const steam = softPoints(sp, {size: 7, color: 0x6a5a8a, opacity: 0.08}); scene.add(steam);
  const r = rain(st.small ? 500 : 1200, {size: [7, 12, 20], opacity: 0.35}); scene.add(r.mesh);

  const dm = new THREE.Object3D();
  let dist = 0;
  camera.position.set(0.3, 1.65, 6);
  st.run((dt, t) => {
    dist += dt * 1.7;
    const bob = Math.sin(dist * 3.6) * 0.03;
    camera.position.y = 1.65 + bob;
    camera.lookAt(st.pointer.sx * 1.2, 2.6 - st.pointer.sy * 0.8 + bob, -10);
    camera.updateMatrixWorld(); s.update(camera, t); r.update(t, new THREE.Vector3(0, 6, -4)); tmat.uniforms.uTime.value = t;
    lots.forEach((o, i) => { const z = wrapZ(o.z + dist); dm.position.set(o.x, o.h / 2, z); dm.rotation.set(0, 0, 0); dm.scale.set(o.w, o.h, o.d); dm.updateMatrix(); walls.setMatrixAt(i, dm.matrix);
      dm.position.set(o.x - Math.sign(o.x) * 1.62, 0.9, z); dm.scale.set(1, 1, Math.min(1, o.d / 2.2)); dm.updateMatrix(); counters.setMatrixAt(i, dm.matrix); });
    walls.instanceMatrix.needsUpdate = counters.instanceMatrix.needsUpdate = counters.instanceColor.needsUpdate = true;
    signs.forEach(sg => { sg.m.position.z = sg.mm.position.z = wrapZ(sg.z + dist); });
    lanternZ.forEach((l, i) => { dm.position.set(l.x, l.y + Math.sin(t * 1.3 + i) * 0.05, wrapZ(l.z + dist)); dm.scale.setScalar(1); dm.updateMatrix(); lanterns.setMatrixAt(i, dm.matrix); });
    lanterns.instanceMatrix.needsUpdate = true;
    cables.forEach(c => { c.line.position.z = wrapZ(c.z + dist); });
    const pa = steam.geometry.attributes.position.array;
    steamSeed.forEach((p, i) => { p.y += p.v * dt; if (p.y > 4) p.y = 0; pa.set([p.x + Math.sin(t + i) * 0.2, p.y, wrapZ(p.z + dist)], i * 3); });
    steam.geometry.attributes.position.needsUpdate = true;
  });
  return st;
}
