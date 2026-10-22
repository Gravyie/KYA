import * as THREE from 'three';
import {makeStage, rand, PI, NEON, towerMaterial, towers, sky} from './base.js';

/* 3 · BLACK ICE. Jacked in: the city's data twin, all wireframe and light. Agents are packets racing the
   data highways; policy is ICE, hexagonal firewalls across the streets that let a packet through or
   shatter it. The ledger is a chain of crystal blocks. */

export function create(canvas) {
  const st = makeStage(canvas, {fov: 48, bloom: [0.65, 0.45, 0.8], fog: new THREE.FogExp2(0x020308, 0.016)});
  const {scene, camera} = st;
  const s = sky(`vec3 shade(vec3 d){
    float e = d.y;
    vec3 col = vec3(0.004, 0.006, 0.016) + vec3(0.05, 0.25, 0.4) * exp(-abs(e) * 18.0) * 0.6;
    col += vec3(0.6, 0.1, 0.5) * exp(-abs(e - 0.02) * 60.0) * 0.15;
    return col;
  }`);
  scene.add(s.mesh);

  // the grid floor: fine lines, major lines, pulses running along the streets
  const BLOCK = 12;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.ShaderMaterial({
    extensions: {derivatives: true}, uniforms: {uTime: {value: 0}},
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec3 vW; uniform float uTime;
      float line(float v, float w){ float a = abs(fract(v - 0.5) - 0.5) / fwidth(v); return 1.0 - min(a / w, 1.0); }
      void main(){
        float minor = max(line(vW.x, 0.6), line(vW.z, 0.6)) * 0.1;
        float major = max(line(vW.x / ${BLOCK}.0, 1.0), line(vW.z / ${BLOCK}.0, 1.0)) * 0.6;
        float pulse = 0.5 + 0.5 * sin((vW.x + vW.z) * 0.15 - uTime * 3.0);
        vec3 c = mix(vec3(0.1, 0.9, 1.0), vec3(1.0, 0.2, 0.7), smoothstep(-60.0, 60.0, vW.x));
        float fade = exp(-length(vW.xz - cameraPosition.xz) * 0.012);
        gl_FragColor = vec4(c * (minor + major * (0.5 + pulse * 0.8)) * fade + vec3(0.0, 0.005, 0.012), 1.0);
      }`,
  }));
  floor.rotation.x = -PI / 2; scene.add(floor);

  // the city twin: wireframe towers on blocks between the highways
  const tmat = towerMaterial({fogColor: 0x020308, fogFar: 160}); tmat.uniforms.uWire.value = 1;
  const SPAN = 14;
  const lots = [];
  for (let bx = -SPAN; bx <= SPAN; bx++) for (let bz = -SPAN * 2; bz <= 2; bz++) {
    if (bx === 0) continue;                                 // the avenue the camera flies down stays open
    for (let k = 0; k < 2; k++) lots.push({x: bx * BLOCK + rand(-3, 3), z: bz * BLOCK + rand(-3, 3), w: rand(2.5, 5.5), d: rand(2.5, 5.5), h: rand(4, 40) * (Math.abs(bx) < 3 ? 1.3 : 1)});
  }
  scene.add(towers(lots.length, tmat, i => lots[i]));
  // a monolith at the end of the avenue: the registry
  const mono = new THREE.Mesh(new THREE.BoxGeometry(14, 120, 14), new THREE.MeshBasicMaterial({color: 0x000000}));
  const monoEdges = new THREE.LineSegments(new THREE.EdgesGeometry(mono.geometry), new THREE.LineBasicMaterial({color: new THREE.Color(NEON.cyan).multiplyScalar(2.5), toneMapped: false}));
  mono.position.set(0, 60, -SPAN * 2 * BLOCK - 20); monoEdges.position.copy(mono.position); scene.add(mono, monoEdges);

  // packets on the highways (x lanes and z lanes)
  const P = st.small ? 160 : 360;
  const packets = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 1.6), new THREE.MeshBasicMaterial({toneMapped: false}), P);
  packets.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(P * 3), 3);
  const lanes = Array.from({length: P}, () => {
    const alongZ = Math.random() < 0.6, lane = Math.round(rand(-SPAN, SPAN)) * BLOCK + rand(-0.8, 0.8);
    return {alongZ, lane, s: rand(-SPAN * 2 * BLOCK, 20), v: rand(14, 34) * (Math.random() < 0.5 ? 1 : -1), y: rand(0.3, 2.4), c: Math.random() < 0.5 ? NEON.cyan : NEON.mag, dead: 0};
  });
  scene.add(packets);

  // ICE: hexagonal firewalls across the avenue; packets reaching one are judged
  const ICE_Z = [-36, -96, -156, -216];
  const iceMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {uTime: {value: 0}, uFlash: {value: new THREE.Vector4()}},
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec2 vUv; varying vec3 vW; uniform float uTime; uniform vec4 uFlash;
      void main(){
        vec2 p = vUv * vec2(10.0, 5.0); vec2 q = vec2(p.x * 1.1547, p.y + p.x * 0.5774);
        vec2 f = fract(q) - 0.5; float hex = smoothstep(0.44, 0.5, max(abs(f.x), max(abs(f.y), abs(f.x + f.y))));
        float scan = smoothstep(0.03, 0.0, abs(fract(vUv.y - uTime * 0.3) - 0.5) - 0.45);
        float edge = max(smoothstep(0.03, 0.0, min(vUv.x, 1.0 - vUv.x)), smoothstep(0.04, 0.0, 1.0 - vUv.y));
        int idx = int(floor((-vW.z - 36.0) / 60.0 + 0.5));
        float fl = idx == 0 ? uFlash.x : idx == 1 ? uFlash.y : idx == 2 ? uFlash.z : uFlash.w;
        vec3 c = vec3(0.1, 0.9, 1.0) * (hex * 0.25 + scan * 0.2 + edge * 1.2) + vec3(1.0, 0.15, 0.3) * fl * (hex * 0.8 + 0.15);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  ICE_Z.forEach(z => { const w = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK - 1, 9), iceMat); w.position.set(0, 4.5, z); scene.add(w); });
  // the avenue's own packets, flying at the ICE
  const A = 30, avenue = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 2.4), new THREE.MeshBasicMaterial({toneMapped: false}), A);
  avenue.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(A * 3), 3);
  const flying = Array.from({length: A}, () => ({x: rand(-4, 4), y: rand(1, 7), z: rand(-230, 10), v: rand(18, 30), deny: Math.random() < 0.3}));
  scene.add(avenue);
  // shards from shattered packets
  const SH = 220, shards = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.14), new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.red).multiplyScalar(3), toneMapped: false}), SH);
  const shard = Array.from({length: SH}, () => ({life: 0, p: new THREE.Vector3(), v: new THREE.Vector3()})); let shardI = 0;
  scene.add(shards);
  const flash = new THREE.Vector4();

  const dm = new THREE.Object3D(), tc = new THREE.Color();
  let camZ = 30;
  st.run((dt, t) => {
    camZ -= dt * 9; if (camZ < -150) camZ = 30;
    camera.position.set(Math.sin(t * 0.2) * 1.5, 7 + Math.sin(t * 0.33) * 1.2, camZ);
    camera.lookAt(st.pointer.sx * 6, 5 - st.pointer.sy * 3, camZ - 40);
    camera.rotateZ(Math.sin(t * 0.2) * 0.04);
    camera.updateMatrixWorld(); s.update(camera, t);
    floor.material.uniforms.uTime.value = t; iceMat.uniforms.uTime.value = t; tmat.uniforms.uTime.value = t;
    lanes.forEach((l, i) => {
      l.s += l.v * dt; if (l.s > 30) l.s = -SPAN * 2 * BLOCK; if (l.s < -SPAN * 2 * BLOCK) l.s = 30;
      if (l.alongZ) dm.position.set(l.lane, l.y, l.s), dm.rotation.set(0, 0, 0); else dm.position.set(l.s, l.y, Math.round(l.lane / BLOCK) * BLOCK - 6), dm.rotation.set(0, PI / 2, 0);
      dm.scale.set(1, 1, 1 + Math.abs(l.v) / 20); dm.updateMatrix(); packets.setMatrixAt(i, dm.matrix); packets.setColorAt(i, tc.set(l.c).multiplyScalar(2.4));
    });
    packets.instanceMatrix.needsUpdate = true; packets.instanceColor.needsUpdate = true;
    flash.multiplyScalar(Math.pow(0.02, dt));
    flying.forEach((f, i) => {
      const prev = f.z; f.z -= f.v * dt;
      ICE_Z.forEach((z, k) => {
        if (prev > z && f.z <= z) {
          if (f.deny) {
            flash.setComponent(k, 1);
            for (let n = 0; n < 12; n++) { const s = shard[shardI++ % SH]; s.life = 1; s.p.set(f.x, f.y, z); s.v.set(rand(-6, 6), rand(-3, 6), rand(2, 9)); }
            f.z = camZ + rand(-6, 4); f.deny = Math.random() < 0.3;
          }
        }
      });
      if (f.z < camZ - 240 || f.z > camZ + 12) { f.z = camZ + rand(-10, 6); f.deny = Math.random() < 0.3; }
      dm.position.set(f.x, f.y, f.z); dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1); dm.updateMatrix(); avenue.setMatrixAt(i, dm.matrix);
      avenue.setColorAt(i, tc.set(f.deny ? NEON.amber : NEON.jade).multiplyScalar(1.8));
    });
    avenue.instanceMatrix.needsUpdate = true; avenue.instanceColor.needsUpdate = true;
    iceMat.uniforms.uFlash.value.copy(flash);
    shard.forEach((s, i) => {
      if (s.life > 0) { s.life -= dt * 1.2; s.v.y -= 9 * dt; s.p.addScaledVector(s.v, dt); }
      dm.position.copy(s.p); dm.rotation.set(t * 5 + i, t * 3, 0); dm.scale.setScalar(Math.max(0.0001, s.life)); dm.updateMatrix(); shards.setMatrixAt(i, dm.matrix);
    });
    shards.instanceMatrix.needsUpdate = true;
  });
  return st;
}
