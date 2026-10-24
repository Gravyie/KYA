import * as THREE from 'three';
import {makeStage, rand, PI, NEON, sky} from './base.js';

/* 11 · OUTRUN CHECKPOINT. The synthwave version, reworked: a night highway running at a banded sun between
   wireframe mountains, the grid racing underneath. Every car (an agent) meets a neon toll gate; its light
   barrier flashes green and lifts, or flashes red and the car is waved off into the dark. */

export function create(canvas) {
  const st = makeStage(canvas, {fov: 52, bloom: [0.65, 0.5, 0.8]});
  const {scene, camera} = st;
  const s = sky(`vec3 shade(vec3 d){
    float e = d.y;
    vec3 col = mix(vec3(0.24, 0.02, 0.18), vec3(0.02, 0.006, 0.05), smoothstep(0.0, 0.3, e));
    col = mix(col, vec3(0.02, 0.0, 0.04), step(e, 0.0));
    // the sun: banded, gradient, sitting on the horizon
    vec2 sp = vec2(atan(d.x, -d.z), e) - vec2(0.0, 0.14);
    float r = length(sp * vec2(1.0, 1.0));
    float bands = step(0.0, sin((sp.y + uTime * 0.01) * 140.0) + smoothstep(-0.13, 0.08, sp.y) * 2.2 - 0.6);
    vec3 sunCol = mix(vec3(1.0, 0.1, 0.55), vec3(1.0, 0.85, 0.2), smoothstep(-0.12, 0.14, sp.y));
    col = mix(col, sunCol * 1.6, smoothstep(0.155, 0.15, r) * bands * step(0.0, e));
    col += vec3(1.0, 0.2, 0.5) * exp(-r * 8.0) * 0.18 * step(0.0, e);
    // stars
    vec2 st = floor(d.xz / max(e, 0.05) * 60.0); col += step(0.997, hash(st)) * smoothstep(0.1, 0.4, e);
    return col;
  }`);
  scene.add(s.mesh);

  // the grid floor, racing
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(400, 400, 1, 1), new THREE.ShaderMaterial({
    extensions: {derivatives: true}, uniforms: {uTime: {value: 0}, uDist: {value: 0}},
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec3 vW; uniform float uDist;
      float line(float v, float w){ float a = abs(fract(v - 0.5) - 0.5) / fwidth(v); return 1.0 - min(a / w, 1.0); }
      void main(){
        float g = max(line(vW.x / 4.0, 1.2), line((vW.z + uDist) / 4.0, 1.2));
        float road = step(abs(vW.x), 7.0);
        float lanes = line(vW.x / 3.5, 1.0) * road * step(0.5, fract((vW.z + uDist) / 6.0));
        float edges = (smoothstep(0.15, 0.0, abs(abs(vW.x) - 7.0)));
        vec3 col = vec3(1.0, 0.15, 0.7) * g * (1.0 - road * 0.7) * 0.9 + vec3(0.2, 0.9, 1.0) * (lanes * 0.8 + edges * 1.4) + vec3(0.01, 0.0, 0.02);
        float fade = exp(-abs(vW.z - cameraPosition.z) * 0.006);
        gl_FragColor = vec4(col * fade, 1.0);
      }`,
  }));
  grid.rotation.x = -PI / 2; grid.position.z = -150; scene.add(grid);

  // wireframe mountains either side
  const mGeo = new THREE.PlaneGeometry(260, 80, 64, 20); const p = mGeo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const ridge = Math.abs(x) > 26 ? (Math.abs(x) - 26) * 0.5 : 0; p.setZ(i, ridge * (0.6 + 0.4 * Math.sin(x * 0.2 + y * 0.3) * Math.cos(y * 0.13)) * (0.5 + Math.random() * 0.3)); }
  mGeo.computeVertexNormals();
  const mountains = new THREE.Mesh(mGeo, new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.mag).multiplyScalar(1.2), wireframe: true, transparent: true, opacity: 0.55}));
  mountains.rotation.x = -PI / 2; mountains.position.set(0, -0.2, -220); scene.add(mountains);
  const mFill = new THREE.Mesh(mGeo, new THREE.MeshBasicMaterial({color: 0x08020e, polygonOffset: true, polygonOffsetFactor: 1})); mFill.rotation.copy(mountains.rotation); mFill.position.copy(mountains.position); scene.add(mFill);

  // the toll gate: a chrome-and-neon arch with a light barrier per lane
  const gate = new THREE.Group(); gate.position.z = -60; scene.add(gate);
  const chrome = new THREE.MeshStandardMaterial({color: 0x9aa0b8, metalness: 1, roughness: 0.2, emissive: 0x200828});
  [-8.5, 8.5].forEach(x => { const pil = new THREE.Mesh(new THREE.BoxGeometry(1, 7, 1.4), chrome); pil.position.set(x, 3.5, 0); gate.add(pil); });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(18, 1.4, 1.6), chrome); beam.position.y = 7.4; gate.add(beam);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(14, 0.9, 0.1), new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.cyan).multiplyScalar(1.8), toneMapped: false})); sign.position.set(0, 7.4, 0.82); gate.add(sign);
  const barriers = [-5.25, -1.75, 1.75, 5.25].map(x => { const m = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.12), new THREE.MeshBasicMaterial({toneMapped: false})); m.position.set(x, 1.1, 0); gate.add(m); return {m, x, t: 0, k: 0}; });
  gate.add(new THREE.PointLight(0xff2fa6, 30, 30)).position.set(0, 6, 3);

  // cars: tail-light pairs, driving away from us toward the gate
  const C = 18, cars = [];
  const carGeo = new THREE.BoxGeometry(1.6, 0.7, 3.2), lightGeo = new THREE.BoxGeometry(0.4, 0.12, 0.05);
  for (let i = 0; i < C; i++) {
    const g = new THREE.Group(); g.add(new THREE.Mesh(carGeo, new THREE.MeshStandardMaterial({color: 0x0b0b14, metalness: 0.8, roughness: 0.3})));
    const lm = new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.red).multiplyScalar(3), toneMapped: false});
    [-0.55, 0.55].forEach(x => { const l = new THREE.Mesh(lightGeo, lm); l.position.set(x, 0.1, 1.62); g.add(l); });
    const trail = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 6), new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.red).multiplyScalar(1.2), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false}));
    trail.rotation.x = -PI / 2; trail.position.set(0, -0.3, 4.6); g.add(trail);
    g.userData = {lane: Math.floor(rand(0, 4)), z: rand(-58, 20), v: rand(10, 18), lm, state: 'drive', vx: 0};
    g.position.y = 0.4; scene.add(g); cars.push(g);
  }
  camera.position.set(0, 3.2, 14);
  let dist = 0;
  const G = new THREE.Color(NEON.jade).multiplyScalar(3), R = new THREE.Color(NEON.red).multiplyScalar(3.5), IDLE = new THREE.Color(NEON.amber).multiplyScalar(2);
  st.run((dt, t) => {
    dist += dt * 24; grid.material.uniforms.uDist.value = dist;
    camera.position.x = Math.sin(t * 0.3) * 1.2 + st.pointer.sx * 2;
    camera.lookAt(st.pointer.sx * 2, 6.5 - st.pointer.sy, -80);
    camera.updateMatrixWorld(); s.update(camera, t);
    mountains.position.z = mFill.position.z = -220 + ((dist * 0.02) % 4);
    barriers.forEach(b => { b.t = Math.max(0, b.t - dt); b.m.material.color.copy(b.t > 0 ? (b.k ? R : G) : IDLE); b.m.rotation.z = b.t > 0 && !b.k ? Math.min(1.3, (1.2 - b.t) * 3) * (b.x < 0 ? 1 : -1) : 0; });
    cars.forEach(g => {
      const u = g.userData, laneX = -5.25 + u.lane * 3.5;
      if (u.state === 'drive') {
        u.z -= u.v * dt * 0.6;
        if (u.z < -56) { u.state = Math.random() < 0.75 ? 'pass' : 'deny'; const b = barriers[u.lane]; b.t = 1.2; b.k = u.state === 'deny' ? 1 : 0; }
      } else if (u.state === 'pass') { u.z -= u.v * dt; if (u.z < -160) { u.z = rand(10, 20); u.state = 'drive'; } }
      else { u.vx += (u.lane < 2 ? -1 : 1) * dt * 8; g.position.x += u.vx * dt; u.z -= dt * 3; u.lm.color.copy(R).multiplyScalar(0.6 + 0.4 * Math.sin(t * 20)); if (Math.abs(g.position.x) > 40) { u.z = rand(10, 20); u.state = 'drive'; u.vx = 0; u.lm.color.copy(R); } }
      if (u.state !== 'deny') g.position.x += (laneX - g.position.x) * dt * 3;
      g.position.z = u.z;
    });
  });
  return st;
}
