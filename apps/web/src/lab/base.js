import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';

/* Shared plumbing for the lab's direction prototypes: renderer, post (bloom, then a film pass with grain,
   vignette, faint aberration and scanlines), resize, a pointer, the frame loop, and a few city parts. */

export const PI = Math.PI, TAU = PI * 2;
export const rand = (a, b) => a + Math.random() * (b - a);
export const smooth = t => t * t * (3 - 2 * t);
export const NEON = {cyan: 0x19e6ff, mag: 0xff2fa6, amber: 0xffb21f, red: 0xff3b4a, jade: 0x2dff9a, violet: 0x9a6bff, bone: 0xd8f6ff};

const FILM = {
  uniforms: {tDiffuse: {value: null}, uTime: {value: 0}, uAb: {value: 0.0006}, uGrain: {value: 0.04}, uVig: {value: 0.6}, uRes: {value: new THREE.Vector2(1, 1)}},
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uAb, uGrain, uVig; uniform vec2 uRes; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){ vec2 c = vUv - 0.5; float r = dot(c, c); vec2 ab = c * uAb * 10.0 * (0.4 + r * 3.0);
      vec3 col = vec3(texture2D(tDiffuse, vUv + ab).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - ab).b);
      col *= 0.97 + 0.03 * sin(vUv.y * uRes.y * 1.6);
      col *= 1.0 - uVig * smoothstep(0.1, 0.72, r * 1.9);
      col += (hash(vUv * uRes + fract(uTime) * 61.0) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0); }`,
};

export function makeStage(canvas, {fov = 40, bloom = [0.6, 0.45, 0.85], exposure = 1, fog = null, far = 800} = {}) {
  const small = innerWidth < 760;
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.25 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = exposure;
  const scene = new THREE.Scene(); if (fog) scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, far);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: small ? 0 : 4}));
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(4, 4), ...bloom);
  const bs = bloomPass.setSize.bind(bloomPass); bloomPass.setSize = (w, h) => bs(Math.ceil(w / 2), Math.ceil(h / 2));
  composer.addPass(bloomPass);
  const film = new ShaderPass(FILM); composer.addPass(film); composer.addPass(new OutputPass());

  const pointer = {x: 0, y: 0, sx: 0, sy: 0, down: false};
  const onMove = e => { pointer.x = (e.clientX / innerWidth - 0.5) * 2; pointer.y = (e.clientY / innerHeight - 0.5) * 2; };
  const onDown = () => { pointer.down = true; }, onUp = () => { pointer.down = false; };
  addEventListener('pointermove', onMove, {passive: true}); addEventListener('pointerdown', onDown); addEventListener('pointerup', onUp);
  let w = 0, h = 0;
  const resize = () => {
    const cw = canvas.clientWidth, ch = canvas.clientHeight; if (cw === w && ch === h) return; w = cw; h = ch;
    renderer.setSize(w, h, false); composer.setSize(w, h); composer.setPixelRatio(renderer.getPixelRatio());
    camera.aspect = w / h; camera.fov = w / h < 0.85 ? fov * 1.45 : fov; camera.updateProjectionMatrix();
    film.uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
  };
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  const clock = new THREE.Clock(); let raf = 0, t = 0, tick = () => {};
  const loop = () => {
    const dt = Math.min(clock.getDelta(), 0.05); t += dt;
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.pow(0.02, dt)); pointer.sy += (pointer.y - pointer.sy) * (1 - Math.pow(0.02, dt));
    tick(dt, t); film.uniforms.uTime.value = t; composer.render(); raf = requestAnimationFrame(loop);
  };
  const onVis = () => { if (document.hidden) cancelAnimationFrame(raf); else { clock.getDelta(); raf = requestAnimationFrame(loop); } };
  document.addEventListener('visibilitychange', onVis);
  return {
    renderer, scene, camera, composer, bloom: bloomPass, film, pointer, small,
    run(fn) { tick = fn; raf = requestAnimationFrame(loop); },
    /** Advance n frames off-screen-time (for screenshots). */
    settle(n = 60) { for (let i = 0; i < n; i++) { t += 0.033; tick(0.033, t); } composer.render(); },
    destroy() {
      cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('visibilitychange', onVis);
      removeEventListener('pointermove', onMove); removeEventListener('pointerdown', onDown); removeEventListener('pointerup', onUp);
      scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { x.map?.dispose?.(); x.dispose(); }); });
      composer.dispose(); renderer.dispose();
    },
  };
}

export const fontsReady = () => Promise.all([document.fonts?.load('900 100px "Noto Sans JP Variable"'), document.fonts?.load('700 100px "Chakra Petch"'), document.fonts?.load('500 40px "Geist Mono Variable"'), document.fonts?.ready]).catch(() => {});

/** A neon sign: kanji or Latin on dark glass with a glowing frame. */
export function signTexture(word, colr, vertical) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), n = [...word].length;
  if (vertical) { c.width = 128; c.height = 128 * n + 40; } else { c.width = 104 * n + 70; c.height = 160; }
  g.fillStyle = 'rgba(6, 6, 20, 0.6)'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = colr; g.lineWidth = 5; g.shadowColor = colr; g.shadowBlur = 18; g.strokeRect(8, 8, c.width - 16, c.height - 16);
  g.fillStyle = '#fff'; g.font = `900 ${/[A-Z0-9]/.test(word) ? 84 : 100}px "Noto Sans JP Variable", "Chakra Petch", serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowBlur = 26;
  if (vertical) [...word].forEach((ch, k) => g.fillText(ch, 64, 84 + k * 128)); else g.fillText(word, c.width / 2, 86);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return {tex, aspect: c.width / c.height};
}
export function signMesh(word, colr, height, vertical) {
  const {tex, aspect} = signTexture(word, colr, vertical);
  const mat = new THREE.MeshBasicMaterial({map: tex, transparent: true, toneMapped: false, color: new THREE.Color(colr).multiplyScalar(1.7), side: THREE.DoubleSide, depthWrite: false});
  return new THREE.Mesh(new THREE.PlaneGeometry(height * aspect, height), mat);
}
export const WORDS = ['承認', '監査', '識別', '関門', '代理人', '封鎖', '見張り', '認証', '記録', '審判', 'AGENT', '可決', '否決', '通行証', '24H', '警告'];

/** Towers with lit windows, neon edges and banding, fogged with distance. Instanced boxes; aDim carries size. */
export function towerMaterial({fogColor = 0x0b0820, fogFar = 90, windowScale = [0.55, 0.62]} = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {uTime: {value: 0}, uFog: {value: new THREE.Color(fogColor)}, uFogFar: {value: fogFar}, uAlert: {value: 0}, uWire: {value: 0}},
    vertexShader: `attribute vec3 aDim; attribute float aSeed; varying vec3 vObj; varying vec3 vN; varying float vSeed; varying float vDepth; varying vec3 vDim;
      void main(){ vObj = position * aDim; vN = normal; vSeed = aSeed; vDim = aDim; vec4 mv = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vObj; varying vec3 vN; varying float vSeed; varying float vDepth; varying vec3 vDim;
      uniform float uTime, uFogFar, uAlert, uWire; uniform vec3 uFog;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        bool side = abs(vN.x) > 0.5; float u = side ? vObj.z : vObj.x; float v = vObj.y + vDim.y * 0.5;
        vec2 cell = vec2(floor(u / ${windowScale[0]} + 100.0), floor(v / ${windowScale[1]})), f = vec2(fract(u / ${windowScale[0]}), fract(v / ${windowScale[1]}));
        float on = step(0.8, hash(cell + vSeed * 50.0 + (side ? 11.0 : 0.0))) * step(0.18, f.x) * step(f.x, 0.72) * step(0.22, f.y) * step(f.y, 0.68) * step(abs(vN.y), 0.5);
        float h = hash(cell.yx + vSeed * 9.0);
        vec3 wc = h < 0.4 ? vec3(0.1, 0.9, 1.0) : h < 0.7 ? vec3(1.0, 0.2, 0.75) : h < 0.9 ? vec3(1.0, 0.65, 0.25) : vec3(0.85, 0.95, 1.0);
        vec3 base = vec3(0.012, 0.015, 0.035) + vec3(0.02, 0.05, 0.09) * smoothstep(0.0, 1.0, v / vDim.y) * 0.4;
        float hw = (side ? vDim.z : vDim.x) * 0.5;
        float edge = smoothstep(hw - 0.06, hw, abs(u)) * step(abs(vN.y), 0.5) * step(0.5, fract(vSeed * 7.0));
        float topRim = step(vDim.y - 0.12, v);
        vec3 neon = mix(vec3(0.1, 0.85, 1.0), vec3(1.0, 0.18, 0.66), step(0.5, fract(vSeed * 13.0)));
        neon = mix(neon, vec3(1.0, 0.1, 0.2), uAlert);
        vec3 col = base + wc * on * 0.85 + neon * (edge * 1.3 + topRim * 0.6);
        // wireframe mode (for the cyberspace twin): only edges and floor lines
        float wireE = max(smoothstep(hw - 0.035, hw, abs(u)), max(smoothstep(0.04, 0.0, v), smoothstep(vDim.y - 0.04, vDim.y, v))) * step(abs(vN.y), 0.5);
        wireE = max(wireE, step(0.5, abs(vN.y)) * max(smoothstep(hw - 0.04, hw, abs(vObj.x)), smoothstep(vDim.z * 0.5 - 0.04, vDim.z * 0.5, abs(vObj.z))));
        float floors = smoothstep(0.012, 0.0, abs(fract(v / 1.2) - 0.5) - 0.488) * step(abs(vN.y), 0.5);
        col = mix(col, neon * (wireE * 1.4 + floors * 0.05) + vec3(0.0, 0.004, 0.01), uWire);
        float fog = 1.0 - exp(-vDepth * vDepth / (uFogFar * uFogFar));
        gl_FragColor = vec4(mix(col, uFog, clamp(fog, 0.0, 1.0)), 1.0);
      }`,
  });
}
/** Fill an InstancedMesh of unit boxes as towers. place(i) returns {x, z, w, d, h, y0}. */
export function towers(count, mat, place) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const dims = new Float32Array(count * 3), seeds = new Float32Array(count);
  const mesh = new THREE.InstancedMesh(geo, mat, count), dm = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const {x, z, w, d, h, y0 = 0} = place(i);
    dm.position.set(x, y0 + h / 2, z); dm.scale.set(w, h, d); dm.updateMatrix(); mesh.setMatrixAt(i, dm.matrix);
    dims[i * 3] = w; dims[i * 3 + 1] = h; dims[i * 3 + 2] = d; seeds[i] = Math.random();
  }
  geo.setAttribute('aDim', new THREE.InstancedBufferAttribute(dims, 3)); geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  return mesh;
}

/** GPU rain in a box around a moving centre. */
export function rain(count, {size = [24, 14, 24], speed = [10, 15], color = 0x7fdcff, opacity = 0.4, length = 0.45} = {}) {
  const geo = new THREE.InstancedBufferGeometry().copy(new THREE.BoxGeometry(0.006, length, 0.006)); geo.instanceCount = count;
  const s = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { s[i * 4] = rand(-0.5, 0.5) * size[0]; s[i * 4 + 1] = rand(-0.5, 0.5) * size[2]; s[i * 4 + 2] = Math.random(); s[i * 4 + 3] = rand(...speed); }
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(s, 4));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {uTime: {value: 0}, uCenter: {value: new THREE.Vector3()}, uH: {value: size[1]}, uColor: {value: new THREE.Color(color)}, uOpacity: {value: opacity}, uSlant: {value: 0.06}},
    vertexShader: `attribute vec4 aSeed; uniform float uTime, uH, uSlant; uniform vec3 uCenter;
      void main(){ float y = uCenter.y + uH * 0.5 - mod(aSeed.z * uH + uTime * aSeed.w, uH); vec3 p = position; p.x += p.y * uSlant;
        gl_Position = projectionMatrix * viewMatrix * vec4(vec3(uCenter.x + aSeed.x, y, uCenter.z + aSeed.y) + p, 1.0); }`,
    fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; void main(){ gl_FragColor = vec4(uColor, uOpacity); }',
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
  return {mesh, update(t, center) { mat.uniforms.uTime.value = t; mat.uniforms.uCenter.value.copy(center); }};
}

/** A full-screen sky behind everything; frag gets the view direction d. */
export function sky(frag) {
  const mat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: {uInvProj: {value: new THREE.Matrix4()}, uCamWorld: {value: new THREE.Matrix4()}, uTime: {value: 0}},
    vertexShader: 'varying vec2 vNdc; void main(){ vNdc = position.xy; gl_Position = vec4(position.xy, 1.0, 1.0); }',
    fragmentShader: `varying vec2 vNdc; uniform mat4 uInvProj, uCamWorld; uniform float uTime;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
      vec3 shade(vec3 d);
      void main(){ vec4 v = uInvProj * vec4(vNdc, 1.0, 1.0); vec3 d = normalize((uCamWorld * vec4(normalize(v.xyz / v.w), 0.0)).xyz); gl_FragColor = vec4(shade(d), 1.0); }
      ${frag}`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); mesh.frustumCulled = false; mesh.renderOrder = -1000;
  return {mesh, mat, update(camera, t) { mat.uniforms.uInvProj.value.copy(camera.projectionMatrixInverse); mat.uniforms.uCamWorld.value.copy(camera.matrixWorld); mat.uniforms.uTime.value = t; }};
}
