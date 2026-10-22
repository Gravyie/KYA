import * as THREE from 'three';
import {Pass, FullScreenQuad} from 'three/examples/jsm/postprocessing/Pass.js';

/*
 * The city as the watcher sees it: text. The scene is rendered small, then every cell of the screen
 * becomes one glyph, chosen by brightness from a ramp measured off a real font (ASCII and half-width
 * katakana), or by edge direction where the image has an edge (| - / \), and tinted with the cell's
 * colour. A faint underlay of the image keeps the neon's atmosphere. uDecode reveals the field out of
 * scrambled glyphs, for the opening.
 */

const CANDIDATES = ".'`,:;-~_^\"!=+*<>ri?lt7vcxzjfIJ1LYTunoeaszkhdbpqwmXZOQ0#%&@$MWｦｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ";
const EDGES = ['|', '-', '/', '\\'];
const LEVELS = 15;
const GW = 32, GH = 56;   // atlas cell, px

/** Draws candidate glyphs, measures their ink, and keeps a ramp of LEVELS (plus a blank and four edge glyphs). */
function buildAtlas() {
  const font = `500 ${Math.round(GH * 0.72)}px "Geist Mono Variable", "Noto Sans JP Variable", ui-monospace, monospace`;
  const probe = document.createElement('canvas'); probe.width = GW; probe.height = GH;
  const p = probe.getContext('2d', {willReadFrequently: true});
  const ink = ch => {
    p.clearRect(0, 0, GW, GH); p.fillStyle = '#fff'; p.font = font; p.textAlign = 'center'; p.textBaseline = 'middle'; p.fillText(ch, GW / 2, GH * 0.54);
    const d = p.getImageData(0, 0, GW, GH).data; let s = 0; for (let i = 3; i < d.length; i += 4) s += d[i];
    return s / (GW * GH * 255);
  };
  const scored = [...CANDIDATES].map(ch => ({ch, v: ink(ch), kana: /[ｦ-ﾝ]/.test(ch)})).sort((a, b) => a.v - b.v);
  const max = scored.at(-1).v, min = scored[0].v;
  // pick a glyph for each target density, preferring katakana in the middle tones (it reads as signal, not noise)
  // two ramps of matched density, alternated per cell, so flat areas do not stripe into rows of one glyph
  const used = new Set(), ramps = [[], []];
  for (let i = 0; i < LEVELS; i++) {
    const target = min + (max - min) * Math.pow(i / (LEVELS - 1), 0.9);
    for (const ramp of ramps) {
      const near = scored.filter(s => !used.has(s.ch)).sort((a, b) => Math.abs(a.v - target) - Math.abs(b.v - target)).slice(0, 4);
      const pick = (i > 4 && i < LEVELS - 2 && near.find(s => s.kana && Math.abs(s.v - target) < (max - min) * 0.06)) || near[0];
      used.add(pick.ch); ramp.push(pick.ch);
    }
  }
  const glyphs = [' ', ...ramps[0], ...ramps[1], ...EDGES];
  const c = document.createElement('canvas'); c.width = GW * glyphs.length; c.height = GH;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff'; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  glyphs.forEach((ch, i) => {
    if (EDGES.includes(ch)) {   // edges are drawn as strokes so they join cell to cell
      g.save(); g.strokeStyle = '#fff'; g.lineWidth = 4.5; g.lineCap = 'round'; g.beginPath();
      const x = i * GW;
      if (ch === '|') { g.moveTo(x + GW / 2, 2); g.lineTo(x + GW / 2, GH - 2); }
      if (ch === '-') { g.moveTo(x + 2, GH / 2); g.lineTo(x + GW - 2, GH / 2); }
      if (ch === '/') { g.moveTo(x + 3, GH - 3); g.lineTo(x + GW - 3, 3); }
      if (ch === '\\') { g.moveTo(x + 3, 3); g.lineTo(x + GW - 3, GH - 3); }
      g.stroke(); g.restore();
    } else g.fillText(ch, i * GW + GW / 2, GH * 0.54);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  return {tex, count: glyphs.length, levels: LEVELS};
}

const FRAG = `
uniform sampler2D tScene, tGlyph; uniform vec2 uRes, uCell; uniform float uCount, uLevels, uTime, uDecode, uUnder, uExposure, uAlert;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float lum(vec3 c){ return dot(c, vec3(0.3, 0.59, 0.11)); }
vec3 sceneAt(vec2 uv){ return texture2D(tScene, uv).rgb; }
void main(){
  vec2 px = vUv * uRes;
  vec2 cell = floor(px / uCell);
  vec2 d = uCell / uRes;
  vec2 cuv = (cell + 0.5) * d;
  vec3 c = (sceneAt(cuv + d * vec2(-0.25, -0.25)) + sceneAt(cuv + d * vec2(0.25, -0.25)) + sceneAt(cuv + d * vec2(-0.25, 0.25)) + sceneAt(cuv + d * vec2(0.25, 0.25))) * 0.25;
  float L = lum(c);
  float t = 1.0 - exp(-L * uExposure);                 // tone-map the HDR scene into 0..1 density
  // edges between neighbouring cells
  float gx = lum(sceneAt(cuv + vec2(d.x, 0.0))) - lum(sceneAt(cuv - vec2(d.x, 0.0)));
  float gy = lum(sceneAt(cuv + vec2(0.0, d.y))) - lum(sceneAt(cuv - vec2(0.0, d.y)));
  float gm = length(vec2(gx, gy)) / (L + 0.08);
  float idx = t < 0.035 ? 0.0 : 1.0 + floor(clamp((t - 0.035) / 0.965, 0.0, 0.999) * uLevels) + step(0.5, hash(cell + 3.7)) * uLevels;
  if (gm > 1.4 && t > 0.06) {
    float ang = atan(gy, gx);                         // the edge runs perpendicular to the gradient
    float a = mod(ang + 3.14159265 / 8.0, 3.14159265) / (3.14159265 / 4.0);
    float e = floor(a);                                // 0: gradient horizontal -> '|', 1: '/', 2: '-', 3: '\\'
    idx = 2.0 * uLevels + 1.0 + (e < 0.5 ? 0.0 : e < 1.5 ? 3.0 : e < 2.5 ? 1.0 : 2.0);
  }
  // the opening: cells resolve out of scrambled glyphs, a wave sweeping down the screen
  float h = hash(cell);
  float gate = uDecode * 1.35 - (1.0 - vUv.y) * 0.35;
  float scrambled = step(gate, h);
  if (scrambled > 0.5) {
    idx = 1.0 + floor(hash(cell + floor(uTime * 24.0)) * uLevels);
    c = mix(vec3(0.1, 0.9, 1.0), vec3(1.0, 0.2, 0.7), hash(cell * 1.3)) * 0.5 * step(0.55, hash(cell + 9.0)) * smoothstep(0.0, 0.25, uDecode + 0.1);
    t = 0.5;
  }
  vec2 g = fract(px / uCell);
  float ink = texture2D(tGlyph, vec2((idx + g.x) / uCount, g.y)).r;
  // tint: keep the cell's hue, push its brightness so the glyph reads as neon
  float m = max(max(c.r, c.g), max(c.b, 1e-4));
  vec3 hue = c / m;
  vec3 glyphCol = hue * (0.22 + 1.35 * t * t + 0.15 * t);
  vec3 under = (1.0 - exp(-c * 1.5)) * uUnder * (1.0 - scrambled);
  vec3 col = glyphCol * ink + under;
  gl_FragColor = vec4(col, 1.0);
}`;

/** Renders the scene small, then draws it as glyphs into the composer's buffer. */
export class AsciiPass extends Pass {
  constructor(scene, camera, {cell = [8, 14]} = {}) {
    super();
    this.scene = scene; this.camera = camera; this.cell = cell;
    this.rt = new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter});
    this.atlas = null;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tScene: {value: this.rt.texture}, tGlyph: {value: null}, uRes: {value: new THREE.Vector2(1, 1)}, uCell: {value: new THREE.Vector2(...cell)},
        uCount: {value: 1}, uLevels: {value: LEVELS}, uTime: {value: 0}, uDecode: {value: 1}, uUnder: {value: 0.12}, uExposure: {value: 2.8}, uAlert: {value: 0},
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: FRAG, depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
    this.pixelRatio = 1;
    this.overlay = null;
  }
  /** Fonts must be loaded first, or the ramp is measured off the fallback font. */
  build() { this.atlas = buildAtlas(); this.material.uniforms.tGlyph.value = this.atlas.tex; this.material.uniforms.uCount.value = this.atlas.count; }
  setSize(w, h) {
    // w, h arrive in device pixels; the scene only needs ~2 samples per cell side
    this.material.uniforms.uRes.value.set(w, h);
    const cw = this.cell[0] * this.pixelRatio, ch = this.cell[1] * this.pixelRatio;
    this.material.uniforms.uCell.value.set(cw, ch);
    this.rt.setSize(Math.max(2, Math.ceil(w / cw) * 2), Math.max(2, Math.ceil(h / ch) * 2));
  }
  render(renderer, writeBuffer) {
    renderer.setRenderTarget(this.rt); renderer.clear(); renderer.render(this.scene, this.camera);
    if (!this.atlas) { this.material.uniforms.tGlyph.value = null; }
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
    // objects that must stay legible (the agent's pass) are drawn crisp, on top of the glyphs
    if (this.overlay) { const ac = renderer.autoClear; renderer.autoClear = false; renderer.render(this.overlay, this.camera); renderer.autoClear = ac; }
  }
  dispose() { this.rt.dispose(); this.material.dispose(); this.quad.dispose(); this.atlas?.tex.dispose(); }
}
