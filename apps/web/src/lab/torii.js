import * as THREE from 'three';
import {makeStage, rand, PI, NEON, fontsReady, signMesh, WORDS, towerMaterial, towers, rain, sky} from './base.js';

/* 1 · SENBON TORII. An endless path of neon torii over a flooded street at night, the city glowing beyond.
   Agent calls travel the path; every gate stamps them: green passes, amber waits, red is thrown back. */

export function create(canvas) {
  const st = makeStage(canvas, {fov: 42, bloom: [0.75, 0.5, 0.82], fog: new THREE.FogExp2(0x0c0614, 0.028)});
  const {scene, camera} = st;
  const N = 46, GAP = 2.4, FLOOR = 0;
  const real = new THREE.Group(), mirror = new THREE.Group(); mirror.scale.y = -1; scene.add(real, mirror);

  const s = sky(`vec3 shade(vec3 d){
    float e = d.y;
    vec3 col = mix(vec3(0.35, 0.06, 0.18), vec3(0.02, 0.01, 0.05), smoothstep(-0.02, 0.35, abs(e)));
    float cl = fbm(vec2(d.x / (abs(e) + 0.2) * 1.5 + uTime * 0.01, abs(e) * 8.0));
    col += vec3(0.5, 0.1, 0.3) * smoothstep(0.5, 0.9, cl) * smoothstep(0.35, 0.0, abs(e)) * 0.4;
    float dist = 1.0 / max(-e, 0.02);
    if (e < 0.0) { float rip = fbm(d.xz * dist * 1.2 + vec2(0.0, uTime * 0.4)); col *= 0.35 + 0.3 * rip; }
    return col;
  }`);
  scene.add(s.mesh);
  scene.add(new THREE.HemisphereLight(0x8a5cff, 0x200410, 0.9));

  // flood: a dark glossy veil over the reflected world
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(200, 300), new THREE.MeshBasicMaterial({color: 0x05030a, transparent: true, opacity: 0.55, depthWrite: false}));
  veil.rotation.x = -PI / 2; veil.position.set(0, FLOOR + 0.001, -100); veil.renderOrder = -10; scene.add(veil);

  // the gates
  const lacquer = new THREE.MeshStandardMaterial({color: 0x3a0806, metalness: 0.3, roughness: 0.35, emissive: 0x6a0c06, emissiveIntensity: 0.9});
  const neonMat = new THREE.MeshBasicMaterial({toneMapped: false});
  const pillarGeo = new THREE.CylinderGeometry(0.16, 0.2, 4.2, 12); pillarGeo.translate(0, 2.1, 0);
  const kasaShape = new THREE.Shape(); const KW = 4.9;
  kasaShape.moveTo(-KW / 2, 0.36); kasaShape.quadraticCurveTo(0, 0.08, KW / 2, 0.36); kasaShape.lineTo(KW / 2 - 0.12, 0); kasaShape.quadraticCurveTo(0, -0.22, -KW / 2 + 0.12, 0); kasaShape.closePath();
  const kasaGeo = new THREE.ExtrudeGeometry(kasaShape, {depth: 0.4, bevelEnabled: false, curveSegments: 24}); kasaGeo.translate(0, 4.25, -0.2);
  const nukiGeo = new THREE.BoxGeometry(3.9, 0.2, 0.22); nukiGeo.translate(0, 3.55, 0);
  const pillars = new THREE.InstancedMesh(pillarGeo, lacquer, N * 2), kasa = new THREE.InstancedMesh(kasaGeo, lacquer, N), nuki = new THREE.InstancedMesh(nukiGeo, lacquer, N);
  // neon: a tube down each pillar's face and one under each beam
  const tubeV = new THREE.BoxGeometry(0.045, 3.9, 0.045); tubeV.translate(0, 2.05, 0.2);
  const tubeH = new THREE.BoxGeometry(3.7, 0.035, 0.035); tubeH.translate(0, 3.42, 0.14);
  // and the signature: the kasagi's upturned underside, traced in light
  const kasaCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-KW / 2 + 0.12, 4.25, 0.22), new THREE.Vector3(0, 4.03, 0.22), new THREE.Vector3(KW / 2 - 0.12, 4.25, 0.22));
  const tubeK = new THREE.TubeGeometry(kasaCurve, 40, 0.028, 5, false);
  const tubesK = new THREE.InstancedMesh(tubeK, neonMat, N);
  tubesK.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  const tubesV = new THREE.InstancedMesh(tubeV, neonMat, N * 2), tubesH = new THREE.InstancedMesh(tubeH, neonMat, N);
  tubesV.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 2 * 3), 3); tubesH.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  const dm = new THREE.Object3D(), gateZ = [], gateCol = [], gateFlash = new Float32Array(N), flashCol = [];
  const palette = [NEON.red, NEON.red, NEON.mag, NEON.red, NEON.amber, NEON.red, NEON.mag];
  for (let i = 0; i < N; i++) {
    const z = -i * GAP; gateZ.push(z); gateCol.push(new THREE.Color(palette[Math.floor(i / 3) % palette.length])); flashCol.push(new THREE.Color());
    dm.rotation.set(0, 0, 0); dm.scale.setScalar(1);
    for (const sx of [-1, 1]) { dm.position.set(sx * 1.65, FLOOR, z); dm.updateMatrix(); pillars.setMatrixAt(i * 2 + (sx > 0 ? 1 : 0), dm.matrix); tubesV.setMatrixAt(i * 2 + (sx > 0 ? 1 : 0), dm.matrix); }
    dm.position.set(0, FLOOR, z); dm.updateMatrix(); kasa.setMatrixAt(i, dm.matrix); nuki.setMatrixAt(i, dm.matrix); tubesH.setMatrixAt(i, dm.matrix); tubesK.setMatrixAt(i, dm.matrix);
  }
  const gateParts = [pillars, kasa, nuki, tubesV, tubesH, tubesK];
  real.add(...gateParts); mirror.add(...gateParts.map(m => m.clone()));

  // stone lanterns with warm light along the path, and paper lanterns hanging in some gates
  const lampMat = new THREE.MeshBasicMaterial({color: new THREE.Color(1, 0.55, 0.22).multiplyScalar(2.2), toneMapped: false});
  const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.26, 0.18), lampMat, N);
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.9, 0.26), lacquer, N);
  for (let i = 0; i < N; i++) { const sx = i % 2 ? 2.5 : -2.5; dm.position.set(sx, 0.45, -i * GAP - GAP / 2); dm.updateMatrix(); posts.setMatrixAt(i, dm.matrix); dm.position.y = 1.03; dm.updateMatrix(); lamps.setMatrixAt(i, dm.matrix); }
  real.add(lamps, posts); mirror.add(lamps.clone(), posts.clone());

  // the city beyond: towers stepping back on both sides, signs
  const tmat = towerMaterial({fogColor: 0x10071c, fogFar: 46});
  const city = towers(170, tmat, i => { const side = i % 2 ? 1 : -1; return {x: side * rand(6, 22), z: rand(-110, 6), w: rand(2, 5), d: rand(2, 5), h: rand(6, 30) * (Math.random() < 0.15 ? 1.8 : 1)}; });
  real.add(city); mirror.add(city.clone());
  fontsReady().then(() => {
    for (let i = 0; i < 20; i++) {
      const word = WORDS[i % WORDS.length], vertical = /[^A-Z0-9]/.test(word) && i % 2 === 0;
      const m = signMesh(word, ['#ff2fa6', '#19e6ff', '#ffb21f', '#ff3b4a'][i % 4], vertical ? rand(2, 3.5) : rand(0.9, 1.5), vertical);
      const side = i % 2 ? 1 : -1; m.position.set(side * rand(5.2, 7), rand(3, 9), rand(-80, -4)); m.rotation.y = -side * PI / 2 * 0.8;
      real.add(m); mirror.add(m.clone());
    }
    // plaques on every sixth gate
    for (let i = 0; i < N; i += 6) { const m = signMesh(['関門', '識別', '審判', '記録', '封鎖', '見張り', '認証', '中枢'][(i / 6) % 8], '#ffb21f', 0.62, true); m.position.set(0, 3.15, gateZ[i] + 0.15); real.add(m); }
  });

  // calls: little comets travelling the path; each gate stamps them as they pass
  const C = 26;
  const comets = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.03, 0.7, 4, 8).rotateX(PI / 2), new THREE.MeshBasicMaterial({toneMapped: false}), C);
  comets.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(C * 3), 3);
  const calls = Array.from({length: C}, () => ({}));
  const KIND = {allow: new THREE.Color(NEON.jade).multiplyScalar(3), ask: new THREE.Color(NEON.amber).multiplyScalar(3), deny: new THREE.Color(NEON.red).multiplyScalar(3.5), neutral: new THREE.Color(NEON.bone).multiplyScalar(2.2)};
  const spawn = c => { c.x = rand(-1.1, 1.1); c.y = rand(0.6, 3.2); c.z = rand(-4, 8); c.v = rand(5, 9); c.kind = 'neutral'; c.fate = Math.random(); c.gate = -1; c.back = 0; c.hold = 0; };
  calls.forEach(spawn); calls.forEach(c => { c.z -= rand(0, 60); });
  real.add(comets);

  const r = rain(st.small ? 600 : 1400, {size: [14, 10, 26]}); scene.add(r.mesh);
  const cam = {z: 6};
  st.run((dt, t) => {
    // the camera walks the path forever: when it has crossed one gate, it steps back by one
    cam.z -= dt * 1.3; if (cam.z < 6 - GAP) cam.z += GAP;
    camera.position.set(0.55 + Math.sin(t * 0.3) * 0.1 + st.pointer.sx * 0.2, 1.3 + Math.sin(t * 0.7) * 0.03, cam.z);
    camera.lookAt(-0.2 + st.pointer.sx * 0.6, 2.5 - st.pointer.sy * 0.3, cam.z - 20);
    camera.updateMatrixWorld(); s.update(camera, t); r.update(t, camera.position.clone().add(new THREE.Vector3(0, 0, -8)));
    tmat.uniforms.uTime.value = t;
    // gate colour + flash
    for (let i = 0; i < N; i++) {
      gateFlash[i] = Math.max(0, gateFlash[i] - dt * 2.4);
      const c = gateCol[i].clone().multiplyScalar(2.2).lerp(flashCol[i], gateFlash[i]);
      tubesV.setColorAt(i * 2, c); tubesV.setColorAt(i * 2 + 1, c); tubesH.setColorAt(i, c); tubesK.setColorAt(i, c);
    }
    calls.forEach((c, i) => {
      if (c.hold > 0) { c.hold -= dt; if (c.hold <= 0) c.kind = Math.random() < 0.7 ? 'allow' : 'deny', c.back = c.kind === 'deny' ? 1 : 0; }
      else c.z += (c.back ? 6 : -c.v) * dt;
      const gi = Math.floor(-c.z / GAP);
      if (gi !== c.gate && gi >= 0 && gi < N && !c.back) {
        c.gate = gi;
        if (gi % 6 === 0 && gi > 0) {           // checkpoint gates give the verdict
          c.kind = c.fate < 0.62 ? 'allow' : c.fate < 0.8 ? 'ask' : 'deny';
          if (c.kind === 'ask') c.hold = 1.4; if (c.kind === 'deny') c.back = 1;
          gateFlash[gi] = 1; flashCol[gi].copy(KIND[c.kind]).multiplyScalar(1.3);
        }
      }
      if (c.z < cam.z - 100 || c.z > cam.z + 6 || (c.back && c.z > c.gate * -GAP + 6)) { spawn(c); c.z = cam.z + rand(-2, 4); }
      dm.position.set(c.x, c.y, c.z); dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, c.hold > 0 ? 0.3 : 1); dm.updateMatrix(); comets.setMatrixAt(i, dm.matrix); comets.setColorAt(i, KIND[c.kind]);
    });
    comets.instanceMatrix.needsUpdate = true; comets.instanceColor.needsUpdate = true;
    tubesV.instanceColor.needsUpdate = true; tubesH.instanceColor.needsUpdate = true; tubesK.instanceColor.needsUpdate = true;
    mirror.children.forEach(m => { if (m.isInstancedMesh && m.instanceColor && m.geometry === tubesV.geometry) m.instanceColor = tubesV.instanceColor; if (m.isInstancedMesh && m.instanceColor && m.geometry === tubesH.geometry) m.instanceColor = tubesH.instanceColor; if (m.isInstancedMesh && m.instanceColor && m.geometry === tubesK.geometry) m.instanceColor = tubesK.instanceColor; });
  });
  return st;
}
