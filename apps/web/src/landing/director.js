import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {Pass, FullScreenQuad} from 'three/examples/jsm/postprocessing/Pass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {HOST} from '../lab/base.js';

/*
 * 見張り · SIX WORLDS, ONE JOURNEY. The page travels through six worlds, one per chapter, and warps between
 * them: the frame streaks toward its centre, tears, and the next world rushes out of it.
 *
 *   spinner  — the megacity from the air: a million agents, one watch      (hero, your stack)
 *   artifact — the agent's passport, opening into its layers                (identify, passport)
 *   torii    — a gate for every call                                        (decide, integrate)
 *   broadcast— the audit log as a wall of live screens                      (prove, console)
 *   swarm    — every agent through one gate; revoke throws them all back    (contain, use cases)
 *   wormhole — straight through the gate                                   (finale)
 *
 * One renderer hosts them all (see HOST in lab/base.js). Only what is on screen is updated and drawn; during
 * a warp, both worlds are drawn into their own targets and mixed.
 */

const LOADERS = {
  spinner: () => import('../lab/spinner.js'), artifact: () => import('../lab/artifact.js'), torii: () => import('../lab/torii.js'),
  broadcast: () => import('../lab/broadcast.js'), swarm: () => import('../lab/swarm.js'), wormhole: () => import('../lab/wormhole.js'),
};
//                  hero       identify    decide   prove        contain  console      passport    integrate cases    stack      finale      hold
const ACTS = ['spinner', 'artifact', 'torii', 'broadcast', 'swarm', 'broadcast', 'artifact', 'torii', 'swarm', 'spinner', 'wormhole', 'wormhole'];
// how far each chapter's world sits back behind its content (0 = full strength)
const DIM = [0.05, 0.12, 0.3, 0.25, 0.15, 0.55, 0.45, 0.6, 0.6, 0.55, 0.15, 0.15];
const ORDER = ['spinner', 'artifact', 'torii', 'broadcast', 'swarm', 'wormhole'];

const WARP = `
uniform sampler2D tA, tB; uniform float uW, uTime, uDim, uFade; varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 streak(sampler2D t, vec2 uv, float amt){
  vec2 c = uv - 0.5; vec3 s = vec3(0.0);
  for (int i = 0; i < 8; i++) s += texture2D(t, 0.5 + c * (1.0 - amt * float(i) / 8.0)).rgb;
  return s / 8.0;
}
void main(){
  float w = uW;
  vec3 col;
  if (w <= 0.001) col = texture2D(tA, vUv).rgb;
  else {
    // tear: horizontal bands slip as the warp peaks
    float peak = 1.0 - abs(w * 2.0 - 1.0);
    float band = floor(vUv.y * 28.0 + floor(uTime * 24.0));
    vec2 uv = vUv + vec2((hash(vec2(band, 1.0)) - 0.5) * 0.06 * step(0.7, hash(vec2(band, floor(uTime * 24.0)))) * peak, 0.0);
    // the outgoing world rushes past toward the centre; the incoming one bursts out of it
    vec2 ca = (uv - 0.5) / (1.0 + w * w * 1.6) + 0.5;
    vec2 cb = (uv - 0.5) * (1.0 + (1.0 - w) * (1.0 - w) * 2.2) + 0.5;
    vec3 a = streak(tA, ca, w * 0.35), b = streak(tB, cb, (1.0 - w) * 0.35);
    float r = length(uv - 0.5);
    // the seam is a ring of light opening from the centre
    float edge = smoothstep(0.0, 0.08, abs(r - (w * 1.1 - 0.15)));
    float m = smoothstep(w * 1.1 - 0.2, w * 1.1 - 0.1, r);       // inside the ring: the new world
    col = mix(b, a, m) + vec3(0.6, 0.9, 1.0) * (1.0 - edge) * peak * 1.4;
    col += vec3(0.2, 0.5, 1.0) * peak * 0.15;
  }
  col *= (1.0 - uDim) * uFade;
  gl_FragColor = vec4(col, 1.0);
}`;

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

/** Draws the current world (and, mid-warp, the next) and mixes them with the warp. */
class ActsPass extends Pass {
  constructor(renderer) {
    super();
    const opts = {type: THREE.HalfFloatType, samples: innerWidth < 760 ? 0 : 4};
    this.rtA = new THREE.WebGLRenderTarget(4, 4, opts); this.rtB = new THREE.WebGLRenderTarget(4, 4, opts);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {tA: {value: this.rtA.texture}, tB: {value: this.rtB.texture}, uW: {value: 0}, uTime: {value: 0}, uDim: {value: 0}, uFade: {value: 1}},
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: WARP,
    });
    this.quad = new FullScreenQuad(this.mat);
    this.a = null; this.b = null;
  }
  setSize(w, h) { this.rtA.setSize(w, h); this.rtB.setSize(w, h); }
  render(renderer, writeBuffer) {
    if (this.a) { renderer.setRenderTarget(this.rtA); renderer.clear(); renderer.render(this.a.scene, this.a.camera); }
    if (this.b && this.mat.uniforms.uW.value > 0.001) { renderer.setRenderTarget(this.rtB); renderer.clear(); renderer.render(this.b.scene, this.b.camera); }
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
  dispose() { this.rtA.dispose(); this.rtB.dispose(); this.mat.dispose(); this.quad.dispose(); }
}

const smooth = t => t * t * (3 - 2 * t);
const clamp01 = x => Math.min(1, Math.max(0, x));

export function createWorld(canvas, {onDecision, onFrame, reduced = false, small = false} = {}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.25 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const pointer = {x: 0, y: 0, sx: 0, sy: 0, down: false};
  const ctx = {open: 0, x: 1.7, lock: 0, vel: 0};
  const host = {renderer, pointer, small, ctx};

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType}));
  const acts = new ActsPass(renderer); composer.addPass(acts);
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.6, 0.45, 0.85);
  const bs = bloom.setSize.bind(bloom); bloom.setSize = (w, h) => bs(Math.ceil(w / 2), Math.ceil(h / 2));
  composer.addPass(bloom);
  const film = new ShaderPass(FILM); composer.addPass(film); composer.addPass(new OutputPass());

  /* Worlds are built on demand (and the next ones ahead of time, when the browser is idle). */
  const worlds = {}, pending = {};
  function build(id) {
    if (worlds[id] || pending[id]) return pending[id];
    pending[id] = LOADERS[id]().then(m => {
      HOST.current = host;
      try { worlds[id] = m.create(null); } finally { HOST.current = null; }
      const w = worlds[id]; sizeCamera(w);
      w.settle?.(2);
      try { renderer.compile(w.scene, w.camera); } catch { /* compiled lazily on first draw instead */ }
      return w;
    });
    return pending[id];
  }
  const idle = cb => (window.requestIdleCallback ? requestIdleCallback(cb, {timeout: 1500}) : setTimeout(cb, 200));
  function prefetch(from) { const i = ORDER.indexOf(from); ORDER.slice(i + 1).concat(ORDER.slice(0, i)).forEach((id, k) => setTimeout(() => idle(() => build(id)), 600 + k * 700)); }

  let width = 0, height = 0, portrait = false;
  function sizeCamera(w) { const c = w.camera; c.aspect = width / Math.max(1, height); c.fov = (c.userData.fov || c.fov) * (portrait ? 1.45 : 1); c.updateProjectionMatrix(); }
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    if (w === width && h === height) return; width = w; height = h; portrait = w / h < 0.85;
    renderer.setSize(w, h, false); composer.setSize(w, h); composer.setPixelRatio(renderer.getPixelRatio());
    film.uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    Object.values(worlds).forEach(sizeCamera);
  }

  /* Scroll position → which worlds, how far through the warp, how dim */
  let f = 0, fs = 0, velocity = 0, velTarget = 0, override = null, lock = 0, fade = 0, intro = null;
  function frameState() {
    const i = Math.min(Math.max(Math.floor(fs), 0), ACTS.length - 2), u = fs - i;
    const A = ACTS[i], B = ACTS[i + 1];
    const w = A === B ? 0 : smooth(clamp01((u - 0.3) / 0.4));
    const dim = DIM[i] + (DIM[i + 1] - DIM[i]) * smooth(u);
    return w >= 0.999 ? {A: B, B, w: 0, dim} : {A, B, w, dim};   // past the warp: only the new world is drawn
  }

  // the live simulation behind the ticker and the counter
  let nextDecision = 0.6;
  const decide = () => { const r = Math.random(); return lock > 0.5 ? 'deny' : r < 0.68 ? 'allow' : r < 0.84 ? 'ask' : 'deny'; };

  const clock = new THREE.Clock();
  let raf = 0, running = false, t = 0;
  function step(dt) {
    t += dt;
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.pow(0.02, dt)); pointer.sy += (pointer.y - pointer.sy) * (1 - Math.pow(0.02, dt));
    fs += (f - fs) * (1 - Math.pow(0.0004, dt));                   // the journey eases behind the scroll
    velTarget *= Math.pow(0.04, dt); velocity += (velTarget - velocity) * (1 - Math.pow(0.02, dt));
    const s = frameState();
    // per-world direction from the page: the passport opens as you reach its chapter; revoke locks the swarm
    const local = fs < 3 ? fs - 1 : fs - 6;
    ctx.open = smooth(clamp01((local + 0.45) / 0.6));
    ctx.x = portrait ? 0 : 2.4;
    const wantLock = override === 'closed' ? 1 : 0;
    lock += (wantLock - lock) * (1 - Math.pow(0.02, dt)); ctx.lock = lock;
    ctx.vel = velocity;
    if (intro) { intro.t += dt * intro.speed; fade = smooth(clamp01(intro.t / 1.6)); if (intro.t >= 1.8) { const d = intro.done; intro = null; d?.(); } }
    else fade = Math.min(1, fade + dt * 2);
    // only the worlds on screen move; the rest wait where they were
    const wa = worlds[s.A], wb = worlds[s.B];
    wa?.step(dt); if (s.w > 0.001 && wb && wb !== wa) wb.step(dt);
    acts.a = wa || null; acts.b = wb || null;
    acts.mat.uniforms.uW.value = wb ? s.w : 0; acts.mat.uniforms.uTime.value = t;
    acts.mat.uniforms.uDim.value = s.dim; acts.mat.uniforms.uFade.value = wa ? fade : 0;
    // the look follows whichever world dominates the frame
    const lookA = wa?.look, lookB = wb?.look ?? lookA, k = s.w;
    if (lookA) {
      bloom.strength = lookA.bloom[0] + ((lookB?.bloom[0] ?? lookA.bloom[0]) - lookA.bloom[0]) * k + Math.sin(k * Math.PI) * 0.6;
      bloom.radius = lookA.bloom[1]; bloom.threshold = lookA.bloom[2];
      renderer.toneMappingExposure = lookA.exposure + ((lookB?.exposure ?? lookA.exposure) - lookA.exposure) * k;
    }
    film.uniforms.uTime.value = t; film.uniforms.uAb.value = 0.0006 + Math.sin(k * Math.PI) * 0.006 + velocity * 0.002;
    // decisions for the HUD
    nextDecision -= dt;
    if (nextDecision <= 0) { nextDecision = 0.35 + Math.random() * 0.9; onDecision?.(decide()); }
    if (!worlds[s.A]) build(s.A); if (s.w > 0 && !worlds[s.B]) build(s.B);
  }
  function draw() { composer.render(); onFrame?.({}, {stage: f, closed: lock, alert: lock, intro: !!intro}); }

  // adaptive quality: only ever lowers the pixel ratio, so the look never changes
  let ema = 0.016, quality = 2, frames = 0, settleUntil = 60;
  const lockHigh = new URLSearchParams(location.search).get('q') === 'high';
  function frame() {
    if (!running) return;
    const raw = clock.getDelta(); ema = ema * 0.94 + Math.min(raw, 0.2) * 0.06; frames++;
    if (quality > 0 && !lockHigh && frames > settleUntil && ema > 0.034) { quality--; settleUntil = frames + 90; renderer.setPixelRatio(quality === 1 ? 1 : 0.8); width = 0; resize(); }
    step(Math.min(raw, 0.05)); draw();
    raf = requestAnimationFrame(frame);
  }
  const start = () => { if (running) return; running = true; clock.getDelta(); raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  const onVisibility = () => (document.hidden ? stop() : start());
  const onMove = e => { pointer.x = (e.clientX / innerWidth - 0.5) * 2; pointer.y = (e.clientY / innerHeight - 0.5) * 2; };
  const onDown = e => { if (e.target === canvas || e.target.closest?.('.scene, .hero, .finale')) pointer.down = true; }, onUp = () => { pointer.down = false; };
  addEventListener('pointermove', onMove, {passive: true}); addEventListener('pointerdown', onDown, {passive: true}); addEventListener('pointerup', onUp);
  document.addEventListener('visibilitychange', onVisibility);
  const ro = new ResizeObserver(() => { resize(); if (!running) draw(); }); ro.observe(canvas);
  resize();
  build('spinner').then(() => { prefetch('spinner'); if (reduced) { fade = 1; step(0.016); draw(); } });
  if (!reduced) start();

  return {
    setStage(x) { f = x; if (reduced) { fs = x; step(0.016); draw(); } },
    setVelocity(v) { velTarget = Math.max(velTarget, Math.min(1, v)); },
    /** The opening: the first world fades up out of black once it is built. */
    intro(done) { if (reduced) { done?.(); return; } fade = 0; intro = {t: -0.2, speed: 1, done}; build('spinner').then(() => { if (intro) intro.t = Math.max(intro.t, 0); }); },
    skipIntro() { if (intro) intro.speed = 3; },
    setIris(mode) { override = mode; },
    /** Debug: where the journey is. */
    state() { return {f, fs, ...frameState(), built: Object.keys(worlds)}; },
    /** Debug / screenshots: jump to a scroll position and let the worlds settle. */
    async settle(n = 60) { const s = frameState(); await build(s.A); if (s.w > 0) await build(s.B); fs = f; if (intro) { const d = intro.done; intro = null; d?.(); } fade = 1; for (let i = 0; i < n; i++) step(0.033); draw(); },
    destroy() {
      stop(); ro.disconnect(); document.removeEventListener('visibilitychange', onVisibility);
      removeEventListener('pointermove', onMove); removeEventListener('pointerdown', onDown); removeEventListener('pointerup', onUp);
      Object.values(worlds).forEach(w => w.destroy()); acts.dispose(); composer.dispose(); renderer.dispose();
    },
  };
}
