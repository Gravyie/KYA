import * as THREE from 'three';
import {makeStage, rand, PI, TAU} from './base.js';

/* 6 · NERV COMMAND. An Evangelion ops room: a tactical holo-map of the city in amber on black, contour lines,
   a hex grid, a radar sweep. Agents are markers moving on the streets, each tethered to the MAGI core by a
   data link. Now and then one trips an alert: it turns red, rings pulse, its link snaps. */

const AMBER = new THREE.Color(1.0, 0.52, 0.08), RED = new THREE.Color(1.0, 0.1, 0.12), GREEN = new THREE.Color(0.2, 1.0, 0.45);

export function create(canvas) {
  const st = makeStage(canvas, {fov: 36, bloom: [0.55, 0.4, 0.82]});
  const {scene, camera} = st;
  scene.background = new THREE.Color(0x020102);
  const SIZE = 160;

  // the map: topography as contour lines, a hex grid, a radar sweep, coordinates at the rim
  const map = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE, 1, 1), new THREE.ShaderMaterial({
    extensions: {derivatives: true}, transparent: true, depthWrite: false,
    uniforms: {uTime: {value: 0}, uAlert: {value: new THREE.Vector3(0, 0, -1)}},
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vP; uniform float uTime; uniform vec3 uAlert;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
      float line(float v, float w){ float a = abs(fract(v - 0.5) - 0.5) / fwidth(v); return 1.0 - min(a / w, 1.0); }
      void main(){
        vec2 p = vP; float r = length(p);
        float hgt = fbm(p * 0.025 + 3.0);
        float contour = line(hgt * 22.0, 1.0) * 0.35 + line(hgt * 4.4, 1.4) * 0.5;
        vec2 hp = p * 0.18; vec2 hq = vec2(hp.x * 1.1547, hp.y + hp.x * 0.5774); vec2 hf = fract(hq) - 0.5;
        float hex = smoothstep(0.46, 0.5, max(abs(hf.x), max(abs(hf.y), abs(hf.x + hf.y)))) * 0.25;
        float grid = max(line(p.x / 10.0, 1.0), line(p.y / 10.0, 1.0)) * 0.18;
        float ang = atan(p.y, p.x); float sweep = pow(fract((ang / 6.2831853) - uTime * 0.12), 10.0) * smoothstep(80.0, 0.0, r);
        float rings = line(r / 20.0, 1.2) * 0.4 * smoothstep(80.0, 60.0, r);
        float ticks = step(0.9, fract(ang / 6.2831853 * 120.0)) * smoothstep(1.2, 0.0, abs(r - 74.0)) ;
        vec3 amber = vec3(1.0, 0.5, 0.08);
        vec3 col = amber * (contour * 0.35 + hex * 0.6 + grid * 0.7 + rings + ticks * 0.9) + amber * sweep * 0.35;
        // the alert: a red bloom where something tripped
        if (uAlert.z > 0.0) { float d = length(p - uAlert.xy); col += vec3(1.0, 0.08, 0.1) * (smoothstep(1.5, 0.0, abs(d - uAlert.z * 30.0)) * (1.0 - uAlert.z) * 2.0 + exp(-d * 0.15) * (1.0 - uAlert.z) * 0.5); }
        float a = smoothstep(80.0, 70.0, r);
        gl_FragColor = vec4(col * a, a);
      }`,
  }));
  map.rotation.x = -PI / 2; scene.add(map);

  // the city in wireframe blocks, amber edges
  const blockMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vL; varying vec3 vS; void main(){ vL = position; vS = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz)); gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vL; varying vec3 vS;
      void main(){ vec3 e = (0.5 - abs(vL)) * vS; float m = min(min(e.x, e.y), e.z), m2 = e.x + e.y + e.z - m - max(max(e.x, e.y), e.z);
        float edge = smoothstep(0.1, 0.0, m2); float fill = 0.012 + 0.012 * step(0.85, fract(vL.y * vS.y * 0.8));
        gl_FragColor = vec4(vec3(1.0, 0.5, 0.08) * (edge * 0.55 + fill), 1.0); }`,
  });
  const B = 260, blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), blockMat, B), dm = new THREE.Object3D();
  for (let i = 0; i < B; i++) {
    let x, z; do { x = Math.round(rand(-6, 6)) * 10 + rand(-2.5, 2.5); z = Math.round(rand(-6, 6)) * 10 + rand(-2.5, 2.5); } while (Math.hypot(x, z) < 12 || Math.hypot(x, z) > 68);
    const h = rand(1, 7) * (1 + Math.max(0, 1 - Math.hypot(x, z) / 60) * 2);
    dm.position.set(x, h / 2, z); dm.scale.set(rand(3, 6), h, rand(3, 6)); dm.updateMatrix(); blocks.setMatrixAt(i, dm.matrix);
  }
  scene.add(blocks);

  // MAGI: three hexagonal columns at the centre
  const magi = new THREE.Group(); scene.add(magi);
  const hexGeo = new THREE.CylinderGeometry(3, 3, 1, 6, 1, true);
  ['MELCHIOR', 'BALTHASAR', 'CASPER'].forEach((_, i) => {
    const a = (i / 3) * TAU + PI / 2, m = new THREE.Mesh(hexGeo, new THREE.MeshBasicMaterial({color: AMBER.clone().multiplyScalar(1.4), wireframe: true, transparent: true, opacity: 0.8}));
    m.position.set(Math.cos(a) * 4.2, 6, Math.sin(a) * 4.2); m.scale.y = 12; magi.add(m);
  });
  const coreBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 60, 12, 1, true), new THREE.MeshBasicMaterial({color: AMBER.clone().multiplyScalar(2), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false}));
  coreBeam.position.y = 30; magi.add(coreBeam);

  // agents: markers walking the street grid, each with a pin and a link arcing to MAGI
  const A = 34, pins = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.7), new THREE.MeshBasicMaterial({toneMapped: false}), A);
  pins.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(A * 3), 3);
  const stems = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 1, 0.05), new THREE.MeshBasicMaterial({toneMapped: false}), A);
  stems.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(A * 3), 3);
  scene.add(pins, stems);
  const SEG = 24, linkPos = new Float32Array(A * (SEG - 1) * 2 * 3), linkCol = new Float32Array(A * (SEG - 1) * 2 * 3);
  const linkGeo = new THREE.BufferGeometry(); linkGeo.setAttribute('position', new THREE.BufferAttribute(linkPos, 3)); linkGeo.setAttribute('color', new THREE.BufferAttribute(linkCol, 3));
  const links = new THREE.LineSegments(linkGeo, new THREE.LineBasicMaterial({vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false}));
  links.frustumCulled = false; scene.add(links);
  const agents = Array.from({length: A}, () => {
    const axis = Math.random() < 0.5, lane = Math.round(rand(-6, 6)) * 10 + 5;
    return {axis, lane, s: rand(-65, 65), v: rand(3, 8) * (Math.random() < 0.5 ? 1 : -1), alert: 0, h: rand(4, 9)};
  });
  // alert rings around a tripped agent
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({color: RED.clone().multiplyScalar(3), transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false}));
  ring.rotation.x = -PI / 2; scene.add(ring);
  let alertAt = 3, alertT = -1, alertI = 0;
  const tc = new THREE.Color(), p0 = new THREE.Vector3(), p1 = new THREE.Vector3(0, 12, 0), mid = new THREE.Vector3(), q = new THREE.Vector3();

  st.run((dt, t) => {
    const ang = t * 0.05 + st.pointer.sx * 0.3;
    camera.position.set(Math.cos(ang) * 95, 62 - st.pointer.sy * 10, Math.sin(ang) * 95);
    camera.lookAt(0, 0, 0);
    map.material.uniforms.uTime.value = t;
    magi.rotation.y = t * 0.1;
    // trip an alert every few seconds
    alertAt -= dt;
    if (alertAt <= 0) { alertAt = rand(3.5, 6); alertI = Math.floor(Math.random() * A); alertT = 0; agents[alertI].alert = 1; }
    if (alertT >= 0) { alertT += dt / 2.2; if (alertT > 1) { alertT = -1; agents[alertI].alert = 0; } }
    agents.forEach((a, i) => {
      a.s += a.v * dt * (a.alert ? 0 : 1); if (a.s > 66) a.s = -66; if (a.s < -66) a.s = 66;
      const x = a.axis ? a.s : a.lane, z = a.axis ? a.lane : a.s;
      const c = a.alert ? RED : (i % 5 === 0 ? GREEN : AMBER);
      tc.copy(c).multiplyScalar(a.alert ? 3.5 : 2.2);
      dm.position.set(x, a.h + Math.sin(t * 2 + i) * 0.3, z); dm.rotation.set(0, t * 2 + i, 0); dm.scale.setScalar(a.alert ? 1.6 : 1); dm.updateMatrix(); pins.setMatrixAt(i, dm.matrix); pins.setColorAt(i, tc);
      dm.position.set(x, a.h / 2, z); dm.rotation.set(0, 0, 0); dm.scale.set(1, a.h, 1); dm.updateMatrix(); stems.setMatrixAt(i, dm.matrix); stems.setColorAt(i, tc);
      // link: a bezier arc up to the core; a tripped agent's link flickers and breaks
      p0.set(x, a.h, z); mid.copy(p0).add(p1).multiplyScalar(0.5); mid.y += 14;
      const broken = a.alert && Math.sin(t * 40) > 0;
      for (let k = 0; k < SEG - 1; k++) {
        for (let e = 0; e < 2; e++) {
          const u = (k + e) / (SEG - 1); q.set(0, 0, 0).addScaledVector(p0, (1 - u) * (1 - u)).addScaledVector(mid, 2 * u * (1 - u)).addScaledVector(p1, u * u);
          const o = ((i * (SEG - 1) + k) * 2 + e) * 3; linkPos[o] = q.x; linkPos[o + 1] = q.y; linkPos[o + 2] = q.z;
          const pulse = 0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(u * 12 - t * 6 + i)), 6);
          const lc = broken && u > 0.4 ? 0 : (a.alert ? 2 : 0.6) * pulse; linkCol[o] = c.r * lc; linkCol[o + 1] = c.g * lc; linkCol[o + 2] = c.b * lc;
        }
      }
    });
    pins.instanceMatrix.needsUpdate = pins.instanceColor.needsUpdate = stems.instanceMatrix.needsUpdate = stems.instanceColor.needsUpdate = true;
    linkGeo.attributes.position.needsUpdate = linkGeo.attributes.color.needsUpdate = true;
    const al = agents[alertI], ax = al.axis ? al.s : al.lane, az = al.axis ? al.lane : al.s;
    ring.visible = alertT >= 0; ring.position.set(ax, 0.2, az); ring.scale.setScalar(1 + Math.max(0, alertT) * 30); ring.material.opacity = 1 - Math.max(0, alertT);
    map.material.uniforms.uAlert.value.set(ax, -az, alertT);
  });
  return st;
}
