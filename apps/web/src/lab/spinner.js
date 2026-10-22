import * as THREE from 'three';
import {makeStage, rand, PI, NEON, fontsReady, signMesh, WORDS, towerMaterial, towers, rain, sky} from './base.js';

/* 4 · SPINNER FLIGHT. A slow aerial run over the megacity at night, between towers wearing giant holograms,
   searchlights sweeping the smog, toward the one tower everything answers to. Drones are agents; air
   checkpoints are rings of light the traffic must pass. */

export function create(canvas) {
  const st = makeStage(canvas, {fov: 46, bloom: [0.8, 0.6, 0.8], fog: new THREE.FogExp2(0x160a22, 0.0085), far: 1200});
  const {scene, camera} = st;
  const s = sky(`vec3 shade(vec3 d){
    float e = d.y;
    vec3 col = mix(vec3(0.5, 0.16, 0.3), vec3(0.02, 0.015, 0.05), smoothstep(-0.05, 0.45, e));
    float cl = fbm(vec2(d.x / (abs(e) + 0.15) * 0.9 + uTime * 0.01, e * 6.0));
    col = mix(col, vec3(0.6, 0.22, 0.4), smoothstep(0.55, 0.9, cl) * smoothstep(0.3, 0.02, e) * 0.5);
    return col;
  }`);
  scene.add(s.mesh, new THREE.HemisphereLight(0x8a6cff, 0x2a0a20, 0.8));

  // the city: a dense grid of towers, taller toward the centre where the authority stands
  const tmat = towerMaterial({fogColor: 0x1a0b28, fogFar: 260, windowScale: [1.1, 1.3]});
  const N = st.small ? 700 : 1500, CENTER = new THREE.Vector3(0, 0, -520);
  scene.add(towers(N, tmat, i => {
    const x = rand(-260, 260), z = rand(-640, 60);
    const near = Math.abs(x) < 26 && z > -470;                 // keep a canyon open for the flight path
    const d = Math.hypot(x - CENTER.x, z - CENTER.z);
    const h = near ? rand(5, 18) : rand(18, 70) * (1 + Math.max(0, 1 - d / 400) * 2.2) * (Math.random() < 0.08 ? 1.8 : 1);
    return {x, z, w: rand(8, 18), d: rand(8, 18), h, y0: -20};
  }));
  // the authority: a stepped spire with a halo ring and a beacon
  const spireMat = new THREE.MeshStandardMaterial({color: 0x0b0c14, metalness: 0.8, roughness: 0.3});
  for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(70 - k * 12, 120 - k * 6, 70 - k * 12), spireMat); b.position.set(CENTER.x, -20 + 60 + k * 70, CENTER.z); scene.add(b); }
  const halo = new THREE.Mesh(new THREE.TorusGeometry(60, 0.8, 8, 160), new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.cyan).multiplyScalar(2.4), toneMapped: false}));
  halo.rotation.x = PI / 2; halo.position.set(CENTER.x, 330, CENTER.z); scene.add(halo);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 12), new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.red).multiplyScalar(4), toneMapped: false}));
  beacon.position.set(CENTER.x, 400, CENTER.z); scene.add(beacon);

  // holograms: tall animated billboards on tower faces (a face of light, a turning kanji, scrolling bars)
  const holoMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {uTime: {value: 0}},
    vertexShader: 'attribute float aKind; attribute vec3 aCol; varying vec2 vUv; varying float vKind; varying vec3 vCol; void main(){ vUv = uv; vKind = aKind; vCol = aCol; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; varying float vKind; varying vec3 vCol; uniform float uTime;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec2 p = vUv; float a = 0.0;
        if (vKind < 0.5) {           // a face in profile, drawn in scanlines
          vec2 q = (p - vec2(0.5, 0.45)) * vec2(1.0, 1.4);
          float head = smoothstep(0.32, 0.3, length(q * vec2(1.2, 1.0))) - smoothstep(0.31, 0.29, length((q - vec2(0.12, 0.02)) * vec2(1.6, 1.0))) * 0.6;
          a = clamp(head, 0.0, 1.0) * (0.6 + 0.4 * step(0.5, fract(p.y * 90.0)));
        } else if (vKind < 1.5) {    // vertical bars of data
          a = step(0.55, hash(vec2(floor(p.x * 18.0), floor(p.y * 30.0 - uTime * 4.0 * hash(vec2(floor(p.x * 18.0), 1.0)))))) * 0.8;
        } else {                     // a ring that breathes
          float r = length(p - 0.5); a = smoothstep(0.02, 0.0, abs(r - 0.3 - 0.04 * sin(uTime * 2.0))) + smoothstep(0.015, 0.0, abs(r - 0.2)) * 0.6;
        }
        float edge = max(smoothstep(0.02, 0.0, min(p.x, 1.0 - p.x)), smoothstep(0.015, 0.0, min(p.y, 1.0 - p.y))) * 0.5;
        float flick = 0.85 + 0.15 * step(0.97, hash(vec2(floor(uTime * 12.0), vKind)));
        gl_FragColor = vec4(vCol * (a + edge) * flick * 0.9, 1.0);
      }`,
  });
  const H = 26, holos = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), holoMat, H);
  const kinds = new Float32Array(H), cols = new Float32Array(H * 3), dm = new THREE.Object3D();
  for (let i = 0; i < H; i++) {
    const side = i % 2 ? 1 : -1, z = -40 - i * 17, x = side * rand(32, 46);
    dm.position.set(x, rand(30, 60), z); dm.rotation.set(0, side * -0.7, 0); dm.scale.set(rand(14, 22), rand(26, 44), 1); dm.updateMatrix(); holos.setMatrixAt(i, dm.matrix);
    kinds[i] = i % 3; new THREE.Color([NEON.cyan, NEON.mag, NEON.violet, NEON.amber][i % 4]).multiplyScalar(1.6).toArray(cols, i * 3);
  }
  holos.geometry.setAttribute('aKind', new THREE.InstancedBufferAttribute(kinds, 1)); holos.geometry.setAttribute('aCol', new THREE.InstancedBufferAttribute(cols, 3));
  scene.add(holos);
  fontsReady().then(() => {
    for (let i = 0; i < 22; i++) {
      const word = WORDS[i % WORDS.length], vertical = /[^A-Z0-9]/.test(word);
      const m = signMesh(word, ['#ff2fa6', '#19e6ff', '#ffb21f', '#9a6bff'][i % 4], vertical ? rand(10, 18) : rand(5, 8), vertical);
      const side = i % 2 ? 1 : -1; m.position.set(side * rand(22, 30), rand(14, 40), -30 - i * 19); m.rotation.y = -side * PI / 2 * 0.75; scene.add(m);
    }
  });

  // searchlights: soft cones sweeping from rooftops
  const coneMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; varying float vFace; void main(){ vUv = uv; vec3 n = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vFace = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec2 vUv; varying float vFace; void main(){ float a = pow(vFace, 3.0) * vUv.y * 0.12; gl_FragColor = vec4(vec3(0.6, 0.8, 1.0) * a, 1.0); }',
  });
  const cones = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group(); g.position.set(rand(-120, 120), 40, rand(-420, -60));
    const c = new THREE.Mesh(new THREE.ConeGeometry(18, 320, 32, 1, true), coneMat); c.position.y = 160; c.rotation.x = PI; g.add(c);
    g.userData = {p: rand(0, 6), s: rand(0.2, 0.45)}; scene.add(g); cones.push(g);
  }

  // traffic: spinners in lanes at altitude, and checkpoint rings across the main lane
  const T = st.small ? 120 : 260, traffic = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.25, 3.5), new THREE.MeshBasicMaterial({toneMapped: false}), T);
  traffic.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(T * 3), 3);
  const flights = Array.from({length: T}, (_, i) => ({x: rand(-120, 120), y: [18, 28, 40, 55][i % 4] + rand(-1, 1), z: rand(-600, 40), v: rand(20, 50) * (i % 2 ? 1 : -1), c: new THREE.Color([NEON.amber, NEON.bone, NEON.red, NEON.cyan][i % 4]).multiplyScalar(2.6)}));
  scene.add(traffic);
  const ringMat = new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.mag).multiplyScalar(2.2), toneMapped: false});
  for (let k = 0; k < 6; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(10, 0.18, 6, 96), ringMat); r.position.set(0, 30, -60 - k * 70); scene.add(r); }

  const rn = rain(st.small ? 600 : 1300, {size: [40, 30, 50], speed: [20, 30], length: 0.9, opacity: 0.3}); scene.add(rn.mesh);
  let camZ = 40;
  st.run((dt, t) => {
    camZ -= dt * 16; if (camZ < -380) camZ = 40;
    camera.position.set(Math.sin(t * 0.15) * 6, 30 + Math.sin(t * 0.25) * 2, camZ);
    camera.lookAt(st.pointer.sx * 20 + Math.sin(t * 0.15) * 4, 34 - st.pointer.sy * 12, camZ - 120);
    camera.rotateZ(-Math.cos(t * 0.15) * 0.05);
    camera.updateMatrixWorld(); s.update(camera, t); rn.update(t, camera.position.clone().add(new THREE.Vector3(0, 0, -16)));
    tmat.uniforms.uTime.value = t; holoMat.uniforms.uTime.value = t;
    cones.forEach(g => { g.rotation.z = Math.sin(t * g.userData.s + g.userData.p) * 0.5; g.rotation.x = Math.cos(t * g.userData.s * 0.8 + g.userData.p) * 0.35; });
    flights.forEach((f, i) => { f.z += f.v * dt; if (f.z > 60) f.z = -600; if (f.z < -600) f.z = 60; dm.position.set(f.x, f.y, f.z); dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1 + Math.abs(f.v) / 30); dm.updateMatrix(); traffic.setMatrixAt(i, dm.matrix); traffic.setColorAt(i, f.c); });
    traffic.instanceMatrix.needsUpdate = true; traffic.instanceColor.needsUpdate = true;
    beacon.material.color.setRGB(1, 0.1, 0.2).multiplyScalar(step(t) ? 5 : 0.6);
    halo.rotation.z = t * 0.05;
  });
  function step(t) { return (t % 1.4) < 0.15; }
  return st;
}
