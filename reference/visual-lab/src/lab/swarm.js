import * as THREE from 'three';
import {makeStage, rand, PI, TAU, NEON, softPoints} from './base.js';
import {SWARM_LIGHT_GLSL} from './swarm-style.js';
import {buildSwarmGate} from './swarm-gate.js';

/* 9 · SWARM. Every agent at once: tens of thousands of points flowing like a murmuration, snaking toward
   one gate and squeezing through it. In the gate each is judged: the allowed fan out cyan and green, the held
   orbit the ring in amber, the denied rebound red and scatter into the dark. All of it on the GPU. */

export function create(canvas) {
  const st = makeStage(canvas, {fov: 40, bloom: [0.85, 0.6, 0.6]});
  const {scene, camera} = st;
  scene.background = new THREE.Color(0x020208);
  const N = st.small ? 22000 : 70000;
  const seeds = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) seeds.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {uTime: {value: 0}, uPx: {value: 1}, uLock: {value: 0}},
    vertexShader: `attribute vec4 aSeed; uniform float uTime, uPx, uLock; varying vec3 vCol; varying float vA; ${SWARM_LIGHT_GLSL}
      void main(){
        float s = fract(aSeed.x + uTime * (0.05 + 0.02 * aSeed.w));   // 0 far upstream → 1 far downstream
        float z = mix(90.0, -90.0, s);
        // the flock's body: a slow snaking ribbon that narrows to the gate's mouth at z = 0
        float pinch = mix(0.18, 1.0, smoothstep(0.0, 40.0, abs(z)));
        float a = aSeed.y * 6.2831853, r = pow(aSeed.z, 0.6) * 14.0 * pinch;
        vec3 p = vec3(cos(a) * r, sin(a) * r * 0.7, z);
        p.x += sin(z * 0.045 + uTime * 0.35) * 18.0 * smoothstep(5.0, 60.0, z) + sin(z * 0.11 + uTime * 0.6 + aSeed.y * 3.0) * 3.0;
        p.y += cos(z * 0.037 + uTime * 0.28) * 10.0 * smoothstep(5.0, 60.0, z) + cos(z * 0.13 + uTime * 0.5) * 2.0;
        vec3 col = swarmLight(aSeed.w);
        float verdict = aSeed.z * 7.0 - floor(aSeed.z * 7.0);
        if (z < 0.0) {
          float k = -z;
          if (verdict < 0.13 + uLock) {                       // denied: thrown back out of the gate, scattering red
            p.z = k * 0.6; p.xy += normalize(vec2(cos(a), sin(a))) * k * (0.6 + aSeed.w); p.y += k * k * 0.004;
            col = vec3(1.0, 0.12, 0.2) * 1.4;
          } else if (verdict < 0.25 + uLock) {                // held for a human: orbiting the ring in amber
            float o = a + uTime * (0.6 + aSeed.w) + k * 0.05;
            p = vec3(cos(o) * (8.5 + aSeed.w), sin(o) * (8.5 + aSeed.w), -mod(k, 6.0) * 0.4);
            col = vec3(1.0, 0.65, 0.15) * 1.2;
          } else {                                    // allowed: fanning out downstream
            p.xy *= 1.0 + k * 0.05; p.x += sin(k * 0.05 + aSeed.y * 6.0) * k * 0.15;
            col = mix(vec3(0.2, 1.0, 0.55), vec3(0.2, 0.85, 1.0), aSeed.w);
          }
        }
        vA = smoothstep(90.0, 60.0, abs(p.z)) * (0.5 + 0.5 * aSeed.w);
        vCol = col;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = max(1.0, (1.5 + 2.5 * aSeed.w) * uPx * 70.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'varying vec3 vCol; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(vCol * smoothstep(1.0, 0.0, r) * vA * 0.9, 1.0); }',
  });
  const swarm = new THREE.Points(geo, mat); swarm.frustumCulled = false; scene.add(swarm);

  const gateway=buildSwarmGate();scene.add(gateway.group);
  // dust in the void
  const D = 1500, dpos = new Float32Array(D * 3); for (let i = 0; i < D; i++) dpos.set([rand(-120, 120), rand(-60, 60), rand(-120, 120)], i * 3);
  scene.add(softPoints(dpos, {size: 1.2, color: 0x6a7cff, opacity: 0.4}));

  st.run((dt, t) => {
    const ang = -0.9 + Math.sin(t * 0.07) * 0.35 + st.pointer.sx * 0.35;
    camera.position.set(Math.sin(ang) * 58, 14 - st.pointer.sy * 10 + Math.sin(t * 0.1) * 4, Math.cos(ang) * 58);
    camera.lookAt(-8, 0, 10);
    mat.uniforms.uTime.value = t; mat.uniforms.uPx.value = st.renderer.getPixelRatio();
    const lock = st.ctx?.lock ?? 0; mat.uniforms.uLock.value = lock;
    gateway.update(t,lock);
  });
  return st;
}
