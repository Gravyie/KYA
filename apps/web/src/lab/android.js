import * as THREE from 'three';
import {makeStage, rand, PI, NEON, fontsReady, signMesh, flood, studioEnv} from './base.js';

/* 12 · ANDROID CUSTOMS. Agents as androids, queuing through a scanner arch in a glossy terminal hall. As each
   one crosses the laser sheet its shell falls away into an x-ray: glowing circuitry, a core, a spine. Then
   the verdict: a green pass, or a red flag and the android is turned aside. */

const XRAY_VERT = 'varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vL; void main(){ vL = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }';
const XRAY_FRAG = `varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vL; uniform vec3 uColor; uniform float uTime, uCut;
  void main(){
    if (vW.z > uCut) discard;
    float fres = pow(1.0 - abs(dot(normalize(vN), vV)), 2.0);
    float circuit = step(0.92, fract(vL.y * 9.0 + 0.5)) + step(0.94, fract(vL.x * 7.0 + vL.z * 5.0));
    float scan = smoothstep(0.3, 0.0, abs(vW.z - uCut + 0.15));
    vec3 c = uColor * (fres * 1.4 + circuit * 0.35 + 0.05) + vec3(1.0) * scan * 1.5;
    gl_FragColor = vec4(c, 1.0);
  }`;

export function create(canvas) {
  const st = makeStage(canvas, {fov: 36, bloom: [0.7, 0.5, 0.8], fog: new THREE.FogExp2(0x05060c, 0.03)});
  const {scene, camera, renderer} = st;
  renderer.localClippingEnabled = true;
  studioEnv(renderer, scene, 0.012);
  scene.background = new THREE.Color(0x04050a);
  scene.add(new THREE.HemisphereLight(0x8090ff, 0x100818, 0.5));
  const f = flood(scene, {opacity: 0.45, z: 0, size: [80, 120], color: 0x04050a});

  // the hall: light strips on the walls, light bars overhead, a sign
  const stripMat = new THREE.MeshBasicMaterial({color: new THREE.Color(0.55, 0.75, 1).multiplyScalar(0.9), toneMapped: false});
  for (let i = 0; i < 14; i++) { for (const x of [-9, 9]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.08, 6, 0.08), stripMat); s.position.set(x, 3, 20 - i * 5); f.add(s); } const b = new THREE.Mesh(new THREE.BoxGeometry(14, 0.08, 0.4), stripMat); b.position.set(0, 7.5, 20 - i * 5); scene.add(b); }
  fontsReady().then(() => { const m = signMesh('入国審査 · AGENT CUSTOMS', '#19e6ff', 1, false); m.position.set(0, 6.4, 0.6); f.add(m); });

  // the arch and its laser sheet at z = 0
  const archMat = new THREE.MeshPhysicalMaterial({color: 0x1a1e2a, metalness: 0.9, roughness: 0.25, clearcoat: 0.6});
  [-2.6, 2.6].forEach(x => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.4, 0.9), archMat); p.position.set(x, 2.7, 0); f.add(p); });
  const top = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.6, 0.9), archMat); top.position.set(0, 5.4, 0); f.add(top);
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 5.1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: {uTime: {value: 0}, uColor: {value: new THREE.Color(NEON.cyan)}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform float uTime; uniform vec3 uColor; void main(){ float lines = step(0.5, fract(vUv.y * 60.0 - uTime * 2.0)) * 0.12; float sweep = smoothstep(0.04, 0.0, abs(vUv.y - fract(uTime * 0.6))) * 0.8; float edge = smoothstep(0.03, 0.0, min(vUv.x, 1.0 - vUv.x)) * 0.6; gl_FragColor = vec4(uColor * (lines + sweep + edge + 0.04), 1.0); }',
  }));
  sheet.position.set(0, 2.55, 0); scene.add(sheet);
  const archLight = new THREE.PointLight(NEON.cyan, 8, 10); archLight.position.set(0, 3, 0.5); scene.add(archLight);

  // androids: a shell that only exists before the sheet, an x-ray that only exists after it
  const keep = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const shellMat = new THREE.MeshPhysicalMaterial({color: 0x9aa2b4, metalness: 0.2, roughness: 0.3, clearcoat: 1, clippingPlanes: [keep]});
  const jointMat = new THREE.MeshPhysicalMaterial({color: 0x15171f, metalness: 0.6, roughness: 0.35, clippingPlanes: [keep]});
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 16);
  function android(i) {
    const xray = new THREE.ShaderMaterial({vertexShader: XRAY_VERT, fragmentShader: XRAY_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {uColor: {value: new THREE.Color(NEON.cyan)}, uTime: {value: 0}, uCut: {value: 0}}});
    const root = new THREE.Group(), parts = {};
    const add = (name, geo, mat, x, y, z, parent = root) => { const g = new THREE.Group(); g.position.set(x, y, z); const m = new THREE.Mesh(geo, mat); const xm = new THREE.Mesh(geo, xray); g.add(m, xm); parent.add(g); parts[name] = g; return g; };
    add('torso', cap(0.36, 0.7), shellMat, 0, 1.55, 0);
    add('pelvis', cap(0.28, 0.12), jointMat, 0, 0.98, 0);
    add('head', new THREE.SphereGeometry(0.24, 24, 16), shellMat, 0, 2.38, 0).children.forEach(m => m.scale.set(0.9, 1.15, 1));
    for (const s of [-1, 1]) {
      const sh = add(`arm${s}`, cap(0.08, 0.5), shellMat, s * 0.46, 1.86, 0); sh.children.forEach(m => { m.position.y = -0.3; });
      const fo = add(`fore${s}`, cap(0.07, 0.45), jointMat, 0, -0.62, 0, sh); fo.children.forEach(m => { m.position.y = -0.28; });
      const th = add(`leg${s}`, cap(0.12, 0.5), shellMat, s * 0.17, 0.92, 0); th.children.forEach(m => { m.position.y = -0.3; });
      const sk = add(`shin${s}`, cap(0.1, 0.5), jointMat, 0, -0.62, 0, th); sk.children.forEach(m => { m.position.y = -0.3; });
    }
    // what only the scanner sees: a core and a spine
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), xray); core.position.set(0, 1.7, 0.1); root.add(core);
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 8), xray); spine.position.set(0, 1.55, -0.12); root.add(spine);
    root.userData = {parts, xray, z: 7 + i * 3.2, deny: false, judged: false, phase: rand(0, 6), side: 0};
    return root;
  }
  const A = 6, crowd = Array.from({length: A}, (_, i) => { const a = android(i); scene.add(a); return a; });
  // verdict tags floating over the judged
  const tags = {pass: null, deny: null};
  fontsReady().then(() => { tags.pass = signMesh('可決 PASS', '#2dff9a', 0.4, false); tags.deny = signMesh('否決 DENY', '#ff3b4a', 0.4, false); });
  const tagFor = new Map();

  st.run((dt, t) => {
    const ang = 0.42 + Math.sin(t * 0.12) * 0.06 + st.pointer.sx * 0.15;
    camera.position.set(Math.sin(ang) * 14, 2.6 - st.pointer.sy * 1, Math.cos(ang) * 14);
    camera.lookAt(-4.2, 2.3, 0);
    sheet.material.uniforms.uTime.value = t;
    crowd.forEach(a => {
      const u = a.userData, P = u.parts;
      u.z -= dt * 1.1;
      if (!u.judged && u.z < -0.6) { u.judged = true; u.deny = Math.random() < 0.3; u.xray.uniforms.uColor.value.set(u.deny ? NEON.red : NEON.jade); if (tags.pass) { const tg = (u.deny ? tags.deny : tags.pass).clone(); scene.add(tg); tagFor.set(a, tg); } }
      if (u.deny && u.z < -2) u.side += dt * 1.4;
      if (u.z < -9) { u.z = 9 + rand(0, 2); u.judged = false; u.deny = false; u.side = 0; u.xray.uniforms.uColor.value.set(NEON.cyan); const tg = tagFor.get(a); if (tg) { scene.remove(tg); tagFor.delete(a); } }
      a.position.set(-u.side * 2.5, 0, u.z); a.rotation.y = PI + (u.deny && u.z < -2 ? 0.9 : 0);
      const w = t * 4.2 + u.phase, sw = Math.sin(w) * 0.5;
      P['leg-1'].rotation.x = sw; P['leg1'].rotation.x = -sw; P['shin-1'].rotation.x = Math.max(0, -Math.sin(w)) * 0.7; P['shin1'].rotation.x = Math.max(0, Math.sin(w)) * 0.7;
      P['arm-1'].rotation.x = -sw * 0.7; P['arm1'].rotation.x = sw * 0.7; P['fore-1'].rotation.x = -0.3; P['fore1'].rotation.x = -0.3;
      P.torso.position.y = 1.55 + Math.abs(Math.cos(w)) * 0.04; P.head.rotation.y = Math.sin(t * 0.7 + u.phase) * 0.3;
      u.xray.uniforms.uTime.value = t; u.xray.uniforms.uCut.value = 0;
      const tg = tagFor.get(a); if (tg) { tg.position.set(a.position.x, 3.0, a.position.z); tg.lookAt(camera.position); }
    });
  });
  return st;
}
