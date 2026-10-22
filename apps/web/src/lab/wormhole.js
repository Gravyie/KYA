import * as THREE from 'three';
import {makeStage, rand, PI, TAU, NEON} from './base.js';

/* 17 · WORMHOLE. The portal tunnel, rebuilt: an endless curving tube of hex plating with live seams, data
   streaks racing along it, and ring gates that open ahead of you like irises. The speed surges and eases; the
   cursor steers. */

const BEND = `
vec2 B(float z){ return vec2(sin(z * 0.021) * 9.0 + sin(z * 0.007) * 6.0, sin(z * 0.013) * 5.0); }
vec2 bend(float zw, float s){ return (B(zw - s) - B(-s)) * smoothstep(0.0, -80.0, zw); }
`;
const bendJS = (zw, s) => {
  const B = z => [Math.sin(z * 0.021) * 9 + Math.sin(z * 0.007) * 6, Math.sin(z * 0.013) * 5];
  const a = B(zw - s), b = B(-s), k = Math.min(1, Math.max(0, -zw / 80)); const sm = k * k * (3 - 2 * k);
  return [(a[0] - b[0]) * sm, (a[1] - b[1]) * sm];
};

export function create(canvas) {
  const st = makeStage(canvas, {fov: 70, bloom: [0.7, 0.45, 0.8]});
  const {scene, camera} = st;
  scene.background = new THREE.Color(0x010103);
  const LEN = 420, R = 6;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(R, R, LEN, 96, 220, true).rotateX(PI / 2).translate(0, 0, -LEN / 2 + 10), new THREE.ShaderMaterial({
    side: THREE.BackSide, uniforms: {uScroll: {value: 0}, uTime: {value: 0}},
    vertexShader: `varying vec3 vP; varying float vDepth; uniform float uScroll; ${BEND}
      void main(){ vP = position; vec3 p = position; p.xy += bend(p.z, uScroll); vec4 mv = modelViewMatrix * vec4(p, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vP; varying float vDepth; uniform float uScroll, uTime;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        float a = atan(vP.y, vP.x) / 6.2831853 + 0.5;
        float z = vP.z - uScroll;
        // hex plating in (around, along)
        // staggered hull panels (around × along), seams between them
        vec2 p = vec2(a * 40.0, z * 0.32); p.x += step(0.5, fract(floor(p.y) * 0.5)) * 0.5;
        vec2 cell = floor(p), f = fract(p);
        float seam = max(smoothstep(0.93, 0.98, f.x), smoothstep(0.9, 0.97, f.y));
        float lit = step(0.93, hash(cell + floor(uTime * 0.5 + hash(cell) * 4.0)));
        // streaks racing along
        float lane = floor(a * 48.0); float streak = step(0.8, hash(vec2(lane, 1.0))) * smoothstep(0.3, 0.0, abs(fract(a * 48.0) - 0.5)) * pow(fract(z * 0.02 + hash(vec2(lane, 2.0))), 14.0);
        // ring bands
        float ring = smoothstep(0.485, 0.5, abs(fract(z / 40.0) - 0.5));
        vec3 c1 = vec3(0.1, 0.85, 1.0), c2 = vec3(1.0, 0.2, 0.7);
        vec3 tint = mix(c1, c2, 0.5 + 0.5 * sin(z * 0.012));
        float panel = 0.5 + 0.5 * hash(cell);
        vec3 col = vec3(0.012, 0.014, 0.03) * panel + tint * (seam * 0.14 + lit * 0.2 * (1.0 - seam) + streak * 2.5 + ring * 1.4);
        col *= exp(-vDepth * 0.008);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  scene.add(tube);

  // irises ahead: rings of blades that open as you approach
  const BL = 12, gates = [];
  const blade = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-1.7, 0), new THREE.Vector2(1.7, 0), new THREE.Vector2(0, -5.6)]));
  const bladeMat = new THREE.MeshBasicMaterial({color: 0x07070d, side: THREE.DoubleSide});
  const edgeMat = new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.cyan).multiplyScalar(2.2), toneMapped: false});
  for (let k = 0; k < 4; k++) {
    const g = new THREE.Group(); scene.add(g);
    g.add(new THREE.Mesh(new THREE.TorusGeometry(R - 0.15, 0.08, 6, 120), edgeMat));
    const bl = []; for (let i = 0; i < BL; i++) { const b = new THREE.Group(); const a = (i / BL) * TAU; b.position.set(Math.cos(a) * (R - 0.2), Math.sin(a) * (R - 0.2), 0); b.rotation.z = a + PI / 2; b.add(new THREE.Mesh(blade, bladeMat)); g.add(b); bl.push(b); }
    g.userData = {z0: -100 - k * 100, bl};
    gates.push(g);
  }
  // packets flying past
  const P = 500, packets = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.05, 1.6), new THREE.MeshBasicMaterial({toneMapped: false}), P);
  packets.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(P * 3), 3);
  const pk = Array.from({length: P}, (_, i) => ({a: rand(0, TAU), r: rand(1.5, R - 0.8), z: rand(-LEN, 10), c: new THREE.Color([NEON.cyan, NEON.mag, NEON.bone, NEON.amber][i % 4]).multiplyScalar(2.2)}));
  scene.add(packets);

  const dm = new THREE.Object3D();
  let scroll = 0;
  st.run((dt, t) => {
    const speed = 45 + Math.pow(Math.max(0, Math.sin(t * 0.35)), 4) * 120;
    scroll += speed * dt;
    tube.material.uniforms.uScroll.value = scroll; tube.material.uniforms.uTime.value = t;
    const ahead = bendJS(-30, scroll);
    camera.position.set(st.pointer.sx * 2.2, -st.pointer.sy * 1.6, 0);
    camera.lookAt(ahead[0] * 0.8 + st.pointer.sx * 2, ahead[1] * 0.8 - st.pointer.sy * 1.2, -30);
    camera.rotateZ(Math.sin(t * 0.3) * 0.25 + ahead[0] * 0.01);
    camera.fov = 70 + (speed - 45) * 0.06; camera.updateProjectionMatrix();
    gates.forEach(g => {
      const z = -(((-g.userData.z0 - scroll) % 400) + 400) % 400;
      const b = bendJS(z, scroll); g.position.set(b[0], b[1], z);
      const open = Math.min(1, Math.max(0, (z + 60) / 45));
      g.userData.bl.forEach(bl => { bl.children[0].scale.y = Math.max(0.0001, 1 - open); });
      g.rotation.z = t * 0.2 + open * 1.2;
    });
    pk.forEach((p, i) => {
      p.z += speed * dt * 1.4; if (p.z > 8) { p.z = -LEN + 20; p.a = rand(0, TAU); }
      const b = bendJS(p.z, scroll);
      dm.position.set(Math.cos(p.a) * p.r + b[0], Math.sin(p.a) * p.r + b[1], p.z); dm.scale.set(1, 1, 1 + speed / 30); dm.updateMatrix(); packets.setMatrixAt(i, dm.matrix); packets.setColorAt(i, p.c);
    });
    packets.instanceMatrix.needsUpdate = packets.instanceColor.needsUpdate = true;
  });
  return st;
}
