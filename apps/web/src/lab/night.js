import * as THREE from 'three';
import {makeStage, rand, PI, NEON, fontsReady, signMesh, WORDS, towerMaterial, towers, sky} from './base.js';

/* 2 · NIGHT LINE. You ride an elevated maglev through the megacity at night, looking out of the window.
   The city slides past in layers; rain streaks the glass; every so often a station: a chapter. */

export function create(canvas) {
  const st = makeStage(canvas, {fov: 40, bloom: [0.7, 0.5, 0.82], fog: new THREE.FogExp2(0x0d0618, 0.012)});
  const {scene, camera} = st;
  const s = sky(`vec3 shade(vec3 d){
    float e = d.y;
    vec3 col = mix(vec3(0.42, 0.1, 0.3), vec3(0.02, 0.015, 0.06), smoothstep(-0.05, 0.4, e));
    col += vec3(0.4, 0.12, 0.3) * smoothstep(0.55, 0.9, fbm(vec2(d.x / (abs(e) + 0.25) + uTime * 0.02, e * 7.0))) * smoothstep(0.4, 0.0, e) * 0.5;
    return col;
  }`);
  scene.add(s.mesh, new THREE.HemisphereLight(0x7a6cff, 0x1a0420, 0.8));

  const world = new THREE.Group(); scene.add(world);      // everything outside scrolls; the car and camera stay put
  const L = 360;                                          // the layout repeats every L units
  const wrap = x0 => ((x0 % L) + L) % L - L / 2;

  // the city in three bands: near blocks, mid towers, far skyline; plus streets far below
  const tmat = towerMaterial({fogColor: 0x150828, fogFar: 140});
  const layout = [];
  for (let i = 0; i < 300; i++) {
    const band = i < 60 ? 0 : i < 170 ? 1 : 2;
    const z = band === 0 ? rand(-14, -9) : band === 1 ? rand(-40, -18) : rand(-150, -55);
    const h = band === 0 ? rand(4, 14) : band === 1 ? rand(14, 46) : rand(30, 95);
    layout.push({x0: rand(0, L), z, w: rand(3, band === 2 ? 12 : 7), d: rand(3, 8), h, y0: -18});
  }
  const city = towers(layout.length, tmat, i => ({...layout[i], x: 0}));
  world.add(city);
  // the elevated track's pillars and the guide rail glowing alongside
  const metal = new THREE.MeshStandardMaterial({color: 0x0d1018, metalness: 0.6, roughness: 0.5});
  const PIL = 30, pillars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 18, 0.8), metal, PIL);
  const railLight = new THREE.Mesh(new THREE.BoxGeometry(L * 2, 0.05, 0.05), new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.cyan).multiplyScalar(2), toneMapped: false}));
  railLight.position.set(0, -0.9, -3.2); scene.add(railLight);
  // street traffic far below
  const CARS = 90, cars = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.08, 0.08), new THREE.MeshBasicMaterial({toneMapped: false}), CARS);
  cars.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CARS * 3), 3);
  const carData = Array.from({length: CARS}, (_, i) => ({x0: rand(0, L), z: rand(-60, -10), v: rand(-14, 14), c: new THREE.Color([NEON.red, NEON.bone, NEON.amber][i % 3]).multiplyScalar(2.5)}));
  scene.add(pillars, cars);
  // signs on the near and mid blocks, and the station boards
  const signs = [];
  fontsReady().then(() => {
    for (let i = 0; i < 26; i++) {
      const word = WORDS[i % WORDS.length], vertical = /[^A-Z0-9]/.test(word) && i % 2 === 0;
      const m = signMesh(word, ['#ff2fa6', '#19e6ff', '#ffb21f', '#9a6bff'][i % 4], vertical ? rand(3, 6) : rand(1.6, 2.6), vertical);
      signs.push({m, x0: rand(0, L), y: rand(-4, 8), z: rand(-16, -8.5)}); scene.add(m);
    }
    ['第一駅 · 識別', '第二駅 · 審判', '第三駅 · 記録', '終点 · 中枢'].forEach((name, k) => {
      const m = signMesh(name, '#19e6ff', 1.3, false); signs.push({m, x0: (k + 0.5) * (L / 4), y: 1.1, z: -6}); scene.add(m);
    });
  });

  // the car: window frame, seat backs, a pole, the ceiling light; it rides with the camera
  const car = new THREE.Group(); scene.add(car);
  const shell = new THREE.MeshStandardMaterial({color: 0x1c2232, metalness: 0.35, roughness: 0.55});
  const WW = 3.4, WH = 1.7, WZ = -1.25, WY = 1.7;
  const part = (w, h, d, x, y, z, m = shell) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); car.add(b); return b; };
  part(12, 4, 0.1, 0, WY + WH / 2 + 2, WZ); part(12, 4, 0.1, 0, WY - WH / 2 - 2, WZ);
  part(4, WH, 0.1, -WW / 2 - 2, WY, WZ); part(4, WH, 0.1, WW / 2 + 2, WY, WZ);
  part(WW + 0.2, 0.08, 0.3, 0, WY - WH / 2, WZ + 0.12);                             // sill
  part(0.07, 6, 0.07, -2.3, 2, 0.1, new THREE.MeshStandardMaterial({color: 0x8a92a8, metalness: 1, roughness: 0.25}));   // pole
  const led = part(12, 0.03, 0.03, 0, WY + WH / 2 + 0.45, WZ + 0.2, new THREE.MeshBasicMaterial({color: new THREE.Color(0.6, 0.85, 1).multiplyScalar(1.6), toneMapped: false}));
  part(5, 0.8, 0.5, 0.5, 0.45, WZ + 0.55); // seat backs
  // the glass: rain beads and streaks dragged sideways by the speed, a faint reflection of the car's light
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(WW, WH), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {uTime: {value: 0}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uTime;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec2 p = vUv * vec2(${WW.toFixed(1)}, ${WH.toFixed(1)}) * 22.0;
        vec2 c = floor(p); vec2 f = fract(p) - 0.5;
        float bead = smoothstep(0.16, 0.08, length(f - (vec2(hash(c), hash(c + 3.0)) - 0.5) * 0.6)) * step(0.72, hash(c + 7.0));
        vec2 q = vec2(vUv.x * 8.0 + uTime * 1.8, vUv.y * 70.0); vec2 qc = floor(q);
        float streak = step(0.93, hash(vec2(qc.y, floor(q.x * 0.3)))) * smoothstep(0.5, 0.0, abs(fract(q.y) - 0.5)) * fract(q.x);
        float refl = smoothstep(0.05, 0.0, abs(vUv.y - 0.93)) * 0.25;
        float a = bead * 0.35 + streak * 0.25 + refl + 0.05;
        gl_FragColor = vec4(vec3(0.7, 0.85, 1.0) * (bead * 0.5 + streak * 0.4 + refl * 2.0) + vec3(0.02, 0.03, 0.05), a);
      }`,
  }));
  glass.position.set(0, WY, WZ + 0.02); car.add(glass);

  camera.position.set(0.3, 1.62, 3.6);
  const cabin = new THREE.PointLight(0x9fc4ff, 6, 8, 1.5); cabin.position.set(0, 2.6, 1.2); scene.add(cabin);
  let dist = 0;
  const dm = new THREE.Object3D();
  st.run((dt, t) => {
    const speed = 16 + Math.sin(t * 0.25) * 4;
    dist += speed * dt;
    car.position.y = Math.sin(t * 9) * 0.004;                      // the car hums on the rail
    camera.lookAt(0.3 + st.pointer.sx * 0.5, 1.62 - st.pointer.sy * 0.25 + car.position.y, -10);
    camera.updateMatrixWorld(); s.update(camera, t); tmat.uniforms.uTime.value = t;
    glass.material.uniforms.uTime.value = t;
    // parallax is real: everything is placed at its true depth and slides by
    for (let i = 0; i < layout.length; i++) {
      const o = layout[i]; dm.position.set(wrap(o.x0 - dist), o.y0 + o.h / 2, o.z); dm.scale.set(o.w, o.h, o.d); dm.updateMatrix(); city.setMatrixAt(i, dm.matrix);
    }
    city.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < PIL; i++) { dm.position.set(wrap(i * (L / PIL) - dist), -9.8, -4.2); dm.scale.setScalar(1); dm.updateMatrix(); pillars.setMatrixAt(i, dm.matrix); }
    pillars.instanceMatrix.needsUpdate = true;
    carData.forEach((c, i) => { c.x0 += c.v * dt; dm.position.set(wrap(c.x0 - dist), -17.8, c.z); dm.scale.setScalar(1); dm.updateMatrix(); cars.setMatrixAt(i, dm.matrix); cars.setColorAt(i, c.c); });
    cars.instanceMatrix.needsUpdate = true; cars.instanceColor.needsUpdate = true;
    signs.forEach(sg => { sg.m.position.set(wrap(sg.x0 - dist), sg.y, sg.z); });
    led.material.color.setRGB(0.6, 0.85, 1).multiplyScalar(1.5 + Math.sin(t * 60) * 0.03);
  });
  return st;
}
