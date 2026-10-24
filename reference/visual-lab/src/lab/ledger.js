import * as THREE from 'three';
import {makeStage, rand, PI, TAU, NEON, glyphAtlas, fontsReady, flood, softPoints} from './base.js';

/* 13 · LEDGER MONOLITH. The audit log as architecture: a spiral tower of glass blocks, each engraved with its
   hash and chained to the one before by a line of light. New blocks drop onto the top as verdicts happen.
   Every so often someone edits the past: one block goes red, and the red runs up the chain through every
   block after it, because each one carried the broken hash. Then the chain is restored. */

export function create(canvas) {
  const st = makeStage(canvas, {fov: 38, bloom: [0.75, 0.55, 0.78], fog: new THREE.FogExp2(0x04030a, 0.025)});
  const {scene, camera} = st;
  scene.background = new THREE.Color(0x04030a);
  const f = flood(scene, {opacity: 0.55, z: 0, size: [120, 120], color: 0x04030a});
  const N = 72, STEP = 0.46, TURN = 0.38, RAD = 3.4;
  const at = (i, out) => { const a = i * TURN; return out.set(Math.cos(a) * RAD, 0.4 + i * STEP, Math.sin(a) * RAD); };

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {tGlyph: {value: null}, uCount: {value: 1}, uTime: {value: 0}},
    vertexShader: `attribute float aIdx; attribute float aRed; varying vec3 vL; varying vec3 vN; varying vec3 vV; varying float vIdx; varying float vRed;
      void main(){ vL = position; vIdx = aIdx; vRed = aRed; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix * instanceMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vL; varying vec3 vN; varying vec3 vV; varying float vIdx; varying float vRed; uniform sampler2D tGlyph; uniform float uCount, uTime;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec3 e = (0.5 - abs(vL)) * vec3(1.7, 0.36, 0.9);              // distance to each face pair, in world units
        float mn = min(e.x, min(e.y, e.z)), mx = max(e.x, max(e.y, e.z)), mid = e.x + e.y + e.z - mn - mx;
        float edge = smoothstep(0.035, 0.0, mid);                        // an edge is where two faces meet
        float fres = pow(1.0 - abs(dot(vN, vV)), 2.5);
        // the hash, engraved along the long faces
        vec2 uv = abs(vN.z) > 0.5 ? vec2(vL.x + 0.5, vL.y + 0.5) : vec2(vL.z + 0.5, vL.y + 0.5);
        vec2 cell = vec2(floor(uv.x * 16.0), floor(uv.y * 2.0)), fr = vec2(fract(uv.x * 16.0), fract(uv.y * 2.0));
        float g = floor(hash(cell + vIdx * 13.0) * uCount);
        float ink = abs(vN.y) < 0.5 ? texture2D(tGlyph, vec2((g + clamp(fr.x, 0.08, 0.92)) / uCount, clamp(fr.y * 1.4 - 0.2, 0.0, 1.0))).r : 0.0;
        vec3 ok = mix(vec3(0.2, 0.85, 1.0), vec3(0.9, 0.95, 1.0), 0.3), bad = vec3(1.0, 0.12, 0.18);
        vec3 c = mix(ok, bad, vRed);
        vec3 col = c * (edge * 1.6 + fres * 0.35 + ink * 0.55 + 0.03);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  fontsReady().then(() => { const a = glyphAtlas('0123456789abcdef'); mat.uniforms.tGlyph.value = a.tex; mat.uniforms.uCount.value = a.count; });
  const geo = new THREE.BoxGeometry(1.7, 0.36, 0.9);
  const idx = new Float32Array(N), red = new Float32Array(N);
  for (let i = 0; i < N; i++) idx[i] = i;
  geo.setAttribute('aIdx', new THREE.InstancedBufferAttribute(idx, 1)); geo.setAttribute('aRed', new THREE.InstancedBufferAttribute(red, 1));
  const blocks = new THREE.InstancedMesh(geo, mat, N); blocks.frustumCulled = false; f.real.add(blocks);
  const blocksM = blocks.clone(); blocksM.instanceMatrix = blocks.instanceMatrix; f.mirror.add(blocksM);
  // the chain of light between centres, and the core column
  const linkPos = new Float32Array(N * 3), linkCol = new Float32Array(N * 3);
  const lgeo = new THREE.BufferGeometry(); lgeo.setAttribute('position', new THREE.BufferAttribute(linkPos, 3)); lgeo.setAttribute('color', new THREE.BufferAttribute(linkCol, 3));
  const chain = new THREE.Line(lgeo, new THREE.LineBasicMaterial({vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, toneMapped: false})); chain.frustumCulled = false; f.real.add(chain);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 60, 16, 1, true), new THREE.MeshBasicMaterial({color: new THREE.Color(NEON.cyan).multiplyScalar(0.8), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false})); core.position.y = 30; scene.add(core);
  const D = 900, dpos = new Float32Array(D * 3); for (let i = 0; i < D; i++) dpos.set([rand(-30, 30), rand(0, 40), rand(-30, 30)], i * 3);
  const dust = softPoints(dpos, {size: 1.4, color: 0x7f9cff, opacity: 0.5}); scene.add(dust);

  // time: the top grows by one block every so often; the whole tower slides down so the top stays in view
  const dm = new THREE.Object3D(), pv = new THREE.Vector3();
  let grown = 0, tamperAt = 4, tamperI = -1, tamperT = 0;
  st.run((dt, t) => {
    grown += dt / 1.3; const k = Math.floor(grown), frac = grown - k;
    tamperAt -= dt;
    if (tamperAt <= 0 && tamperI < 0) { tamperI = Math.floor(rand(N * 0.25, N * 0.55)); tamperT = 0; }
    if (tamperI >= 0) { tamperT += dt; if (tamperT > 4.5) { tamperI = -1; tamperAt = rand(4, 6); } }
    const slide = (k + Math.min(1, frac * 1.5)) * STEP;
    for (let i = 0; i < N; i++) {
      at(i, pv); const top = i === N - 1, drop = top ? Math.pow(1 - Math.min(1, frac * 1.5), 3) * 6 : 0;
      dm.position.set(pv.x, 0.4 + i * STEP - (slide % STEP) + drop, pv.z);
      dm.rotation.set(0, -i * TURN + PI / 2, 0); dm.scale.setScalar(1); dm.updateMatrix(); blocks.setMatrixAt(i, dm.matrix);
      // the tamper: the struck block goes red, then the red climbs the chain one block at a time
      const r = tamperI >= 0 && i >= tamperI ? Math.min(1, Math.max(0, tamperT * 9 - (i - tamperI))) * (1 - Math.max(0, (tamperT - 3.5) / 1)) : 0;
      red[i] = r;
      linkPos.set([dm.position.x, dm.position.y, dm.position.z], i * 3);
      const pulse = 0.3 + 0.7 * Math.pow(0.5 + 0.5 * Math.sin(i * 0.5 - t * 5), 6);
      (r > 0.5 ? new THREE.Color(NEON.red).multiplyScalar(2) : new THREE.Color(NEON.cyan).multiplyScalar(1.4 * pulse)).toArray(linkCol, i * 3);
    }
    blocks.instanceMatrix.needsUpdate = true; geo.attributes.aRed.needsUpdate = true;
    lgeo.attributes.position.needsUpdate = lgeo.attributes.color.needsUpdate = true;
    mat.uniforms.uTime.value = t;
    const ang = t * 0.12 + st.pointer.sx * 0.5;
    camera.position.set(Math.cos(ang) * 17, 6 - st.pointer.sy * 3, Math.sin(ang) * 17);
    camera.lookAt(0, 16, 0);
  });
  return st;
}
