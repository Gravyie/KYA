import * as THREE from 'three';
import {makeStage, rand, PI, TAU, glyphAtlas, fontsReady, flood, sky, signMesh} from './base.js';

/* 8 · GLYPH CITY. The city as the network sees it: every tower is built of raining katakana. Each face is
   columns of glyph streams (a bright head, a fading tail, glyphs mutating as they fall), tinted per tower,
   reflected in a black flood. The text-vision idea, grown into a whole world. */

export function create(canvas) {
  const st = makeStage(canvas, {fov: 44, bloom: [0.55, 0.3, 0.78], fog: new THREE.FogExp2(0x010204, 0.012)});
  const {scene, camera} = st;
  const s = sky(`vec3 shade(vec3 d){ return vec3(0.0, 0.004, 0.008) + vec3(0.0, 0.08, 0.06) * exp(-abs(d.y) * 14.0) * 0.5; }`);
  scene.add(s.mesh);
  const f = flood(scene, {opacity: 0.6, color: 0x000302});
  const atlas = {tex: null, count: 1};
  const mat = new THREE.ShaderMaterial({
    uniforms: {uTime: {value: 0}, tGlyph: {value: null}, uCount: {value: 1}},
    vertexShader: `attribute vec3 aDim; attribute float aSeed; attribute vec3 aCol; varying vec3 vObj; varying vec3 vN; varying float vSeed; varying vec3 vDim; varying vec3 vCol; varying float vDepth;
      void main(){ vObj = position * aDim; vN = normal; vSeed = aSeed; vDim = aDim; vCol = aCol; vec4 mv = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vObj; varying vec3 vN; varying float vSeed; varying vec3 vDim; varying vec3 vCol; varying float vDepth;
      uniform float uTime, uCount; uniform sampler2D tGlyph;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        if (abs(vN.y) > 0.5) { gl_FragColor = vec4(vCol * 0.08, 1.0); return; }
        bool side = abs(vN.x) > 0.5; float u = (side ? vObj.z : vObj.x) + (side ? 31.0 : 0.0) * sign(side ? vN.x : vN.z);
        float v = vObj.y + vDim.y * 0.5;
        vec2 cs = vec2(0.42, 0.56);
        vec2 cell = vec2(floor(u / cs.x), floor(v / cs.y)), fr = vec2(fract(u / cs.x), fract(v / cs.y));
        float col = cell.x + vSeed * 97.0;
        float speed = 2.0 + 6.0 * hash(vec2(col, 1.0)), len = 6.0 + 18.0 * hash(vec2(col, 2.0));
        float head = mod(uTime * speed + hash(vec2(col, 3.0)) * 80.0, vDim.y / cs.y + len);
        float rowFromTop = vDim.y / cs.y - cell.y;
        float dist = head - rowFromTop;
        float trail = dist > 0.0 && dist < len ? pow(1.0 - dist / len, 1.6) : 0.0;
        float isHead = step(0.0, dist) * step(dist, 1.0);
        float g = floor(hash(cell + floor(uTime * (1.0 + 6.0 * hash(cell)))) * uCount);
        float ink = texture2D(tGlyph, vec2((g + clamp(fr.x, 0.06, 0.94)) / uCount, fr.y)).r;
        vec3 c = vCol * ink * (trail * 1.7 + 0.12) + vec3(0.85, 1.0, 0.95) * ink * isHead * 2.2;
        c += vCol * 0.015;
        float fog = 1.0 - exp(-vDepth * vDepth / 9000.0);
        gl_FragColor = vec4(mix(c, vec3(0.0, 0.004, 0.008), fog), 1.0);
      }`,
  });
  fontsReady().then(() => { const a = glyphAtlas(); mat.uniforms.tGlyph.value = a.tex; mat.uniforms.uCount.value = a.count; });
  // towers ring a plaza and recede in avenues
  const N = 150, geo = new THREE.BoxGeometry(1, 1, 1), dims = new Float32Array(N * 3), seeds = new Float32Array(N), cols = new Float32Array(N * 3);
  const towersMesh = new THREE.InstancedMesh(geo, mat, N), dm = new THREE.Object3D();
  const palette = [[0.15, 1.0, 0.55], [0.15, 0.9, 1.0], [1.0, 0.25, 0.75], [0.15, 1.0, 0.55], [1.0, 0.7, 0.2]];
  for (let i = 0; i < N; i++) {
    const a = rand(0, TAU), r = i < 24 ? rand(14, 20) : rand(22, 70);
    const w = rand(3, 6), d = rand(3, 6), h = i < 24 ? rand(18, 40) : rand(10, 55);
    dm.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r); dm.rotation.set(0, rand(0, PI), 0); dm.scale.set(w, h, d); dm.updateMatrix(); towersMesh.setMatrixAt(i, dm.matrix);
    dims.set([w, h, d], i * 3); seeds[i] = Math.random(); cols.set(palette[i % palette.length], i * 3);
  }
  geo.setAttribute('aDim', new THREE.InstancedBufferAttribute(dims, 3)); geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1)); geo.setAttribute('aCol', new THREE.InstancedBufferAttribute(cols, 3));
  f.add(towersMesh);
  // in the plaza, a slowly turning monolith of glyphs and a few huge kanji hanging in the air
  const mono = new THREE.InstancedMesh(geo, mat, 1); dm.position.set(0, 12, 0); dm.rotation.set(0, 0, 0); dm.scale.set(3, 24, 3); dm.updateMatrix(); mono.setMatrixAt(0, dm.matrix); f.add(mono);
  const kanji = [];
  fontsReady().then(() => ['見', '張', 'り'].forEach((k, i) => { const m = signMesh(k, '#2dff9a', 5, true); m.position.set(Math.cos(i * 2.1) * 9, 18 + i * 3, Math.sin(i * 2.1) * 9); scene.add(m); kanji.push(m); }));

  st.run((dt, t) => {
    const ang = t * 0.06 + st.pointer.sx * 0.4;
    camera.position.set(Math.cos(ang) * 30, 4 + Math.sin(t * 0.2) * 1.5 - st.pointer.sy * 2, Math.sin(ang) * 30);
    camera.lookAt(0, 14, 0);
    camera.updateMatrixWorld(); s.update(camera, t);
    mat.uniforms.uTime.value = t;
    f.real.children.forEach((o, i) => { if (o === mono) o.rotation.y = t * 0.1; });
    kanji.forEach((m, i) => { m.lookAt(camera.position); m.position.y = 18 + i * 3 + Math.sin(t + i) * 0.5; });
  });
  return st;
}
