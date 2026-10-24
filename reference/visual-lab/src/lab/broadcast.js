import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {makeStage, rand, PI, glyphAtlas, fontsReady, flood, studioEnv} from './base.js';

/* 16 · BROADCAST. A pirate-TV takeover: a curved wall of CRTs in a dark room, each running its own feed
   (scrolling agent logs, test cards, an oscilloscope, a radar, kanji, a face being scanned, static,
   verdicts). Every few seconds the feeds glitch into sync and the whole wall becomes one screen. */

const COLS = 10, ROWS = 5;

function messageTexture() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1024; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 2048, 1024);
  g.fillStyle = '#ff2fa6'; g.font = '900 150px "Noto Sans JP Variable", serif'; g.textAlign = 'center'; g.fillText('見張り', 1024, 230);
  g.fillStyle = '#f2f6ff'; g.font = '400 300px "Anton", "Chakra Petch", sans-serif'; g.fillText('KNOW YOUR', 1024, 590);
  g.fillStyle = '#19e6ff'; g.fillText('AGENT.', 1024, 900);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function create(canvas) {
  const st = makeStage(canvas, {fov: 40, bloom: [0.7, 0.5, 0.75], fog: new THREE.FogExp2(0x030306, 0.035)});
  const {scene, camera, renderer} = st;
  studioEnv(renderer, scene, 0.02);
  scene.background = new THREE.Color(0x030306);
  const f = flood(scene, {opacity: 0.55, z: 0, size: [60, 60], color: 0x030306});

  const screenMat = new THREE.ShaderMaterial({
    uniforms: {uTime: {value: 0}, uSync: {value: 0}, tGlyph: {value: null}, uCount: {value: 1}, tMsg: {value: null}},
    vertexShader: 'attribute vec3 aInfo; varying vec2 vUv; varying vec3 vInfo; void main(){ vUv = uv; vInfo = aInfo; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; varying vec3 vInfo; uniform float uTime, uSync, uCount; uniform sampler2D tGlyph, tMsg;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      vec3 feed(float mode, vec2 p, float seed){
        float t = uTime + seed * 10.0;
        if (mode < 1.0) {   // agent log scrolling
          vec2 q = vec2(p.x * 22.0, p.y * 12.0 + t * 2.0); vec2 c = floor(q), fr = fract(q);
          float on = step(0.25, hash(vec2(c.y, 7.0))) * step(c.x, 6.0 + 15.0 * hash(vec2(c.y, 3.0)));
          float g = floor(hash(c + floor(t * 0.5)) * uCount);
          float ink = texture2D(tGlyph, vec2((g + fr.x) / uCount, fr.y)).r * on;
          vec3 col = hash(vec2(c.y, 9.0)) < 0.15 ? vec3(1.0, 0.25, 0.3) : hash(vec2(c.y, 9.0)) < 0.3 ? vec3(1.0, 0.7, 0.2) : vec3(0.3, 1.0, 0.6);
          return col * ink;
        } else if (mode < 2.0) {   // test card
          float bar = floor(p.x * 7.0); vec3 bars[7]; bars[0] = vec3(1); bars[1] = vec3(1,1,0); bars[2] = vec3(0,1,1); bars[3] = vec3(0,1,0); bars[4] = vec3(1,0,1); bars[5] = vec3(1,0,0); bars[6] = vec3(0,0,1);
          vec3 c = vec3(0.0); for (int i = 0; i < 7; i++) if (float(i) == bar) c = bars[i];
          return p.y > 0.3 ? c * 0.8 : vec3(step(0.5, fract(p.x * 20.0))) * 0.6;
        } else if (mode < 3.0) {   // oscilloscope
          float w = 0.5 + 0.3 * sin(p.x * 18.0 + t * 4.0) * sin(p.x * 3.0 - t);
          return vec3(0.3, 1.0, 0.5) * (smoothstep(0.03, 0.0, abs(p.y - w)) * 1.5 + step(0.97, fract(p.x * 10.0)) * 0.1 + step(0.97, fract(p.y * 6.0)) * 0.1);
        } else if (mode < 4.0) {   // radar
          vec2 q = p - 0.5; float r = length(q), a = atan(q.y, q.x);
          float sweep = pow(fract(a / 6.2831853 - t * 0.3), 8.0);
          float blip = step(0.985, hash(floor(q * 14.0))) * sweep;
          return vec3(0.2, 1.0, 0.6) * (sweep * 0.6 * step(r, 0.45) + smoothstep(0.01, 0.0, abs(fract(r * 5.0) - 0.5) - 0.48) * 0.3 + blip * 2.0);
        } else if (mode < 5.0) {   // kanji, flickering
          float g = floor(hash(vec2(floor(t * 1.5), seed)) * uCount);
          float ink = texture2D(tGlyph, vec2((g + clamp((p.x - 0.2) / 0.6, 0.0, 1.0)) / uCount, clamp((p.y - 0.1) / 0.8, 0.0, 1.0))).r * step(0.2, p.x) * step(p.x, 0.8);
          return vec3(1.0, 0.2, 0.6) * ink * 1.4;
        } else if (mode < 6.0) {   // a face being scanned
          vec2 q = (p - vec2(0.5, 0.45)) * vec2(1.3, 1.0);
          float head = smoothstep(0.31, 0.29, length(q)) * (0.4 + 0.6 * step(0.5, fract(p.y * 50.0)));
          float scan = smoothstep(0.02, 0.0, abs(p.y - fract(t * 0.4)));
          return vec3(0.3, 0.8, 1.0) * (head * 0.6 + scan) + vec3(1.0) * step(0.97, fract(p.x * 8.0 + p.y * 0.0)) * head * 0.2;
        } else if (mode < 7.0) {   // static
          return vec3(hash(p * 300.0 + t)) * 0.7;
        }
        // verdicts
        float v = hash(vec2(floor(t * 0.7), seed));
        vec3 c = v < 0.6 ? vec3(0.2, 1.0, 0.5) : v < 0.8 ? vec3(1.0, 0.7, 0.2) : vec3(1.0, 0.15, 0.2);
        return c * (0.15 + 0.85 * step(0.25, p.y) * step(p.y, 0.75) * step(0.15, p.x) * step(p.x, 0.85) * (0.6 + 0.4 * step(0.5, fract(t * 2.0))));
      }
      void main(){
        // CRT curvature
        vec2 c = vUv - 0.5; vec2 p = c * (1.0 + dot(c, c) * 0.18) + 0.5;
        if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
        float seed = vInfo.z;
        vec3 col = feed(vInfo.z * 8.0 - floor(vInfo.z * 8.0) < 1.0 ? floor(vInfo.z * 8.0) : 0.0, p, seed);
        // the sync: every screen shows its slice of one picture
        vec2 wall = (vec2(vInfo.x, vInfo.y) + p) / vec2(${COLS}.0, ${ROWS}.0);
        vec3 msg = texture2D(tMsg, wall).rgb * 1.6;
        float tear = step(0.5, hash(vec2(floor(p.y * 30.0), floor(uTime * 20.0)))) * (1.0 - abs(uSync * 2.0 - 1.0));
        col = mix(col, msg, smoothstep(0.2, 0.8, uSync + tear * 0.3));
        col *= 0.75 + 0.25 * sin(p.y * 900.0);                                   // scanlines
        col *= 1.0 - dot(c, c) * 1.6;                                              // tube vignette
        col += vec3(0.02, 0.03, 0.04);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  fontsReady().then(() => { const a = glyphAtlas('承認監査識別関門代理封鎖見張認証記録審判可決否通行ｱｲｳｴｵｶｷｸｹｺ0123456789'); screenMat.uniforms.tGlyph.value = a.tex; screenMat.uniforms.uCount.value = a.count; screenMat.uniforms.tMsg.value = messageTexture(); });

  // the wall: TV bodies on a gentle curve, a screen in each
  const n = COLS * ROWS, TW = 2.1, TH = 1.6;
  const bodies = new THREE.InstancedMesh(new RoundedBoxGeometry(TW, TH, 1.3, 3, 0.12), new THREE.MeshPhysicalMaterial({color: 0x15151b, roughness: 0.45, clearcoat: 0.4}), n);
  const sg = new THREE.PlaneGeometry(TW * 0.82, TH * 0.78);
  const info = new Float32Array(n * 3);
  const screens = new THREE.InstancedMesh(sg, screenMat, n);
  const dm = new THREE.Object3D();
  for (let r = 0, i = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++, i++) {
    const a = (c - (COLS - 1) / 2) * 0.085, rad = 22;
    const x = Math.sin(a) * rad, z = -Math.cos(a) * rad + rad - 6, y = 0.85 + r * (TH + 0.06);
    dm.position.set(x, y, z); dm.rotation.set(0, -a, 0); dm.scale.setScalar(1); dm.updateMatrix(); bodies.setMatrixAt(i, dm.matrix);
    dm.position.set(x - Math.sin(a) * 0.66, y, z + Math.cos(a) * 0.66); dm.updateMatrix(); screens.setMatrixAt(i, dm.matrix);
    info.set([c, r, (Math.floor(rand(0, 8)) + 0.5) / 8], i * 3);
  }
  sg.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 3));
  f.real.add(bodies, screens);
  const glow = new THREE.PointLight(0x7fb8ff, 30, 30); glow.position.set(0, 4, 2); scene.add(glow);

  st.run((dt, t) => {
    // sync for ~2.5s every 8s, with a glitchy transition in and out
    const c = t % 8; const sync = c < 5 ? 0 : c < 5.4 ? (c - 5) / 0.4 : c < 7.6 ? 1 : 1 - (c - 7.6) / 0.4;
    screenMat.uniforms.uSync.value = sync; screenMat.uniforms.uTime.value = t;
    glow.color.setHSL(sync > 0.5 ? 0.88 : 0.58, 0.8, 0.6); glow.intensity = 26 + Math.sin(t * 30) * 3;
    const ang = Math.sin(t * 0.15) * 0.25 + st.pointer.sx * 0.25;
    camera.position.set(Math.sin(ang) * 15, 3 - st.pointer.sy * 1.2, Math.cos(ang) * 15 + 2);
    camera.lookAt(0, 4.6, -6);
  });
  return st;
}
