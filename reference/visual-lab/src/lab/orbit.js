import * as THREE from 'three';
import {makeStage, rand, PI, TAU, NEON, softPoints} from './base.js';

/* 15 · LOW ORBIT. The whole planet's agents at once: the night side of the Earth, cities as grids of light,
   agent traffic arcing between them with packets riding the arcs, and a ring of watch satellites standing
   guard in orbit, each sweeping the surface below. */

const NOISE3 = `
float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float f3(vec3 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * n3(p); p = p * 2.02 + 7.3; a *= 0.5; } return v; }
`;

export function create(canvas) {
  const st = makeStage(canvas, {fov: 34, bloom: [0.8, 0.55, 0.72]});
  const {scene, camera} = st;
  scene.background = new THREE.Color(0x010104);
  const R = 10;
  const sun = new THREE.Vector3(-1, 0.3, -0.6).normalize();
  const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 120), new THREE.ShaderMaterial({
    uniforms: {uTime: {value: 0}, uSun: {value: sun}},
    vertexShader: 'varying vec3 vP; varying vec3 vN; varying vec3 vW; void main(){ vP = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec3 vP; varying vec3 vN; varying vec3 vW; uniform float uTime; uniform vec3 uSun;
      ${NOISE3}
      void main(){
        vec3 n = normalize(vP);
        float land = smoothstep(0.5, 0.53, f3(n * 2.2 + 1.7));
        float coast = smoothstep(0.012, 0.0, abs(f3(n * 2.2 + 1.7) - 0.515));
        // cities: dense where 'population' is high, as a fine grid of lights
        float pop = smoothstep(0.55, 0.8, f3(n * 6.0 + 9.0)) * land;
        float lat = asin(n.y), lon = atan(n.z, n.x);
        vec2 g = vec2(lon * 140.0, lat * 140.0); vec2 gi = floor(g), gf = fract(g);
        float spot = step(0.62, h3(vec3(gi, 1.0))) * smoothstep(0.35, 0.0, length(gf - 0.5));
        float roads = (smoothstep(0.06, 0.0, abs(gf.x - 0.5)) + smoothstep(0.06, 0.0, abs(gf.y - 0.5))) * step(0.5, h3(vec3(floor(g / 6.0), 3.0)));
        vec3 sodium = vec3(1.0, 0.62, 0.25), neon = vec3(0.3, 0.85, 1.0);
        vec3 lights = mix(sodium, neon, step(0.7, h3(vec3(floor(g / 9.0), 5.0)))) * (spot * 1.6 + roads * 0.25) * pop * 1.4;
        float day = dot(normalize(vN), uSun);
        vec3 ocean = vec3(0.004, 0.01, 0.03), ground = vec3(0.012, 0.014, 0.022);
        vec3 col = mix(ocean, ground, land) + vec3(0.1, 0.4, 0.7) * coast * 0.08;
        col += lights * smoothstep(0.15, -0.15, day);
        col += vec3(0.2, 0.35, 0.6) * smoothstep(-0.05, 0.6, day) * 0.25 * (0.4 + land);   // a thin dawn on the edge
        vec3 V = normalize(cameraPosition - vW);
        col += vec3(0.25, 0.5, 1.0) * pow(1.0 - max(dot(normalize(vN), V), 0.0), 4.0) * 0.6;
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  scene.add(globe);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 96, 64), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vW; void main(){ vec3 V = normalize(cameraPosition - vW); float r = pow(max(0.0, 1.0 - abs(dot(normalize(vN), V))) , 3.0); gl_FragColor = vec4(mix(vec3(0.2, 0.55, 1.0), vec3(0.9, 0.3, 0.9), 0.3) * r * 1.3, 1.0); }',
  }));
  scene.add(atmo);

  // agent arcs between cities, with packets riding them
  const cities = Array.from({length: 26}, () => new THREE.Vector3().setFromSphericalCoords(R, rand(0.5, 2.6), rand(0, TAU)));
  const arcs = [], A = 40;
  for (let i = 0; i < A; i++) {
    const a = cities[Math.floor(rand(0, cities.length))], b = cities[Math.floor(rand(0, cities.length))]; if (a === b) continue;
    const mid = a.clone().add(b).multiplyScalar(0.5); mid.setLength(R + a.distanceTo(b) * 0.35);
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const col = new THREE.Color([NEON.cyan, NEON.mag, NEON.amber, NEON.jade][i % 4]);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)), new THREE.LineBasicMaterial({color: col.clone().multiplyScalar(0.9), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false}));
    globe.add(line); arcs.push({curve, col, off: Math.random(), speed: rand(0.15, 0.35)});
  }
  const pk = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({toneMapped: false}), arcs.length * 3);
  pk.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(arcs.length * 3 * 3), 3); globe.add(pk);
  const hubs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({color: new THREE.Color(1, 0.9, 0.7).multiplyScalar(3), toneMapped: false}), cities.length);
  const dm = new THREE.Object3D(); cities.forEach((c, i) => { dm.position.copy(c); dm.updateMatrix(); hubs.setMatrixAt(i, dm.matrix); }); globe.add(hubs);

  // the watch: a ring of satellites with scan cones toward the surface
  const ring = new THREE.Group(); ring.rotation.set(0.5, 0, 0.3); scene.add(ring);
  ring.add(new THREE.Mesh(new THREE.TorusGeometry(R * 1.45, 0.012, 4, 256), new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.cyan).multiplyScalar(1.4), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending})));
  const sats = [];
  const coneMat = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; void main(){ gl_FragColor = vec4(vec3(0.3, 0.9, 1.0) * (1.0 - vUv.y) * 0.18, 1.0); }'});
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group(), a = (i / 12) * TAU;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.bone).multiplyScalar(2), toneMapped: false}));
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.25), new THREE.MeshBasicMaterial({color: new THREE.Color(0.2, 0.3, 0.9).multiplyScalar(1.5), toneMapped: false}));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, R * 0.45, 24, 1, true), coneMat); cone.position.x = -R * 0.225; cone.rotation.z = -PI / 2;
    g.add(body, panel, cone); g.userData.a = a; ring.add(g); sats.push(g);
  }
  const S = 2500, sp = new Float32Array(S * 3); for (let i = 0; i < S; i++) sp.set(new THREE.Vector3().randomDirection().multiplyScalar(rand(160, 300)).toArray(), i * 3);
  scene.add(softPoints(sp, {size: 1.6, color: 0xc0d0ff, opacity: 0.9}));

  st.run((dt, t) => {
    globe.rotation.y = t * 0.03; atmo.rotation.y = globe.rotation.y;
    const ang = 0.4 + st.pointer.sx * 0.3;
    camera.position.set(Math.sin(ang) * 32, 7 - st.pointer.sy * 6, Math.cos(ang) * 32);
    camera.lookAt(0, 0, 0);
    globe.material.uniforms.uTime.value = t;
    let k = 0;
    arcs.forEach(a => { for (let j = 0; j < 3; j++) { const u = (t * a.speed + a.off + j / 3) % 1; dm.position.copy(a.curve.getPoint(u)); dm.scale.setScalar(1); dm.updateMatrix(); pk.setMatrixAt(k, dm.matrix); pk.setColorAt(k++, a.col.clone().multiplyScalar(3)); } });
    pk.instanceMatrix.needsUpdate = pk.instanceColor.needsUpdate = true;
    sats.forEach(g => { const a = g.userData.a + t * 0.08; g.position.set(Math.cos(a) * R * 1.45, Math.sin(a) * R * 1.45, 0); g.rotation.z = a; });
  });
  return st;
}
