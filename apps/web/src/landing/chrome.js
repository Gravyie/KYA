import * as THREE from 'three';

/*
 * Liquid-chrome script wordmark, rendered as a tube. The text is drawn to a canvas, blurred into a height field,
 * turned into normals in the shader and reflected into a synthwave "studio": a white-hot horizon line, a lilac sky
 * above, hot pink and deep violet below, a cyan kicker from the side, and a highlight that follows the pointer.
 * It lives in camera space so the layout never drifts, and flies past the viewer as the story begins.
 */

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uMask, uH1, uH2;
uniform vec2 uTexel, uLight;
uniform float uTime, uOpacity, uAlert;
float h(vec2 uv){ return texture2D(uH1, uv).r * 0.62 + texture2D(uH2, uv).r * 0.38; }
vec3 env(vec3 r){
  float y = r.y;
  vec3 skyTop = vec3(0.55, 0.62, 1.0), skyLow = vec3(1.0, 0.97, 1.0);
  vec3 grdTop = vec3(1.0, 0.55, 0.92), grdLow = vec3(0.36, 0.22, 0.86);
  vec3 c = y > 0.0 ? mix(skyLow, skyTop, smoothstep(0.0, 0.75, y)) : mix(grdTop, grdLow, smoothstep(0.0, 0.55, -y));
  c += vec3(1.6) * exp(-pow(y * 26.0, 2.0));                     // horizon line
  c += vec3(0.1, 0.9, 1.0) * smoothstep(0.35, 1.0, r.x) * 0.9;    // cyan kicker
  c += vec3(1.0, 0.25, 0.75) * smoothstep(0.35, 1.0, -r.x) * 0.6; // magenta kicker
  return c;
}
void main(){
  float m = texture2D(uMask, vUv).r;
  if (m < 0.01) discard;
  vec2 e = uTexel * 2.5;
  float hx = h(vUv + vec2(e.x, 0.0)) - h(vUv - vec2(e.x, 0.0));
  float hy = h(vUv + vec2(0.0, e.y)) - h(vUv - vec2(0.0, e.y));
  float hc = h(vUv);
  vec3 n = normalize(vec3(-hx * 5.5, -hy * 5.5, 0.4));
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  vec3 c = env(r);
  vec3 L = normalize(vec3(uLight, 0.9));
  c += vec3(1.0) * pow(max(dot(r, L), 0.0), 70.0) * 2.4;
  float sweep = exp(-pow((vUv.x - fract(uTime * 0.12) * 1.6 + 0.3 - vUv.y * 0.35) * 14.0, 2.0));
  c += vec3(1.0, 0.95, 1.0) * sweep * 0.9 * smoothstep(0.2, 0.6, hc);
  float rim = smoothstep(0.45, 0.05, hc);                         // dark contour where the tube meets its edge
  c = mix(c, vec3(0.14, 0.2, 0.75), rim * 0.55);
  c = mix(c, vec3(1.4, 0.2, 0.3) * (0.4 + 0.6 * c), uAlert * 0.7);
  float a = smoothstep(0.15, 0.6, m) * uOpacity;
  gl_FragColor = vec4(min(c, vec3(1.0)), a);   // drawn straight to the screen after post, in display space
}`;
const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const GLOW_FRAG = `varying vec2 vUv; uniform sampler2D uH2; uniform float uOpacity; uniform vec3 uColor;
  void main(){ float g = texture2D(uH2, vUv).r; gl_FragColor = vec4(uColor * g * 1.6, g * 0.6 * uOpacity); }`;

function maps(text, font) {
  const W = 2048, H = 760, size = 470;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const mask = mk(), g = mask.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.font = `${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineWidth = 16; g.lineJoin = 'round';
  g.save(); g.translate(W / 2, H / 2 + 20); g.rotate(-0.07);
  g.strokeText(text, 0, 0); g.fillText(text, 0, 0); g.restore();
  const blur = px => { const c = mk(), x = c.getContext('2d'); x.filter = `blur(${px}px)`; x.drawImage(mask, 0, 0); return c; };
  const tex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; return t; };
  return {mask: tex(mask), h1: tex(blur(7)), h2: tex(blur(22)), aspect: W / H, texel: new THREE.Vector2(1 / W, 1 / H)};
}

export function createChrome(camera, {text = 'Shuin', font = '"Mr Dafoe", cursive'} = {}) {
  // Its own scene and camera: drawn after the post stack, so it is never tone-mapped, bloomed or blurred.
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(camera.fov, 1, 0.1, 50);
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  let mat, glowMat, mesh, glow, aspect = 2.7;
  const pointer = new THREE.Vector2(0.3, 0.5);

  const build = () => {
    const m = maps(text, font); aspect = m.aspect;
    mat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {uMask: {value: m.mask}, uH1: {value: m.h1}, uH2: {value: m.h2}, uTexel: {value: m.texel}, uLight: {value: pointer}, uTime: {value: 0}, uOpacity: {value: 0}, uAlert: {value: 0}},
    });
    glowMat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: VERT, fragmentShader: GLOW_FRAG,
      uniforms: {uH2: {value: m.h2}, uOpacity: {value: 0}, uColor: {value: new THREE.Color(0xff2fa6)}},
    });
    const geo = new THREE.PlaneGeometry(1, 1 / aspect);
    glow = new THREE.Mesh(geo, glowMat); glow.renderOrder = 998; glow.position.set(0.004, -0.012, -0.001); glow.scale.setScalar(1.04);
    mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 999;
    group.add(glow, mesh);
    group.visible = true;
  };
  Promise.all([document.fonts?.load(`400 100px ${font}`), document.fonts?.ready]).catch(() => {}).then(build);

  return {
    /** Lay the wordmark out in screen terms: `cy` from the top (0..1), `w` as a fraction of the view width. */
    update({time, stage, intro, alert, px, py, cy = 0.4, w = 0.74, maxH = 0.36, aspectView}) {
      if (!mat) return;
      cam.fov = camera.fov; cam.aspect = aspectView; cam.updateProjectionMatrix();
      const D = 6, vh = 2 * D * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), vw = vh * aspectView;
      const width = Math.min(vw * w, vh * maxH * aspect);
      const out = Math.min(1, Math.max(0, stage * 1.5));
      const fly = out * out;
      group.position.set(0, (0.5 - cy) * vh + fly * vh * 0.35, -D + fly * 3.5);
      group.scale.setScalar(width * (1 + (1 - intro) * 0.08));
      group.rotation.z = (1 - intro) * 0.05;
      const op = intro * (1 - Math.min(1, out * 1.25));
      group.visible = op > 0.005;
      mat.uniforms.uOpacity.value = op; glowMat.uniforms.uOpacity.value = op;
      mat.uniforms.uTime.value = time; mat.uniforms.uAlert.value = alert;
      pointer.set(px * 0.8 + 0.2, -py * 0.6 + 0.4);
    },
    render(renderer) {
      if (!group.visible) return;
      const tm = renderer.toneMapping, ac = renderer.autoClear;
      renderer.toneMapping = THREE.NoToneMapping; renderer.autoClear = false;
      renderer.setRenderTarget(null); renderer.render(scene, cam);
      renderer.toneMapping = tm; renderer.autoClear = ac;
    },
    dispose() { group.traverse(o => { o.geometry?.dispose?.(); }); [mat, glowMat].forEach(x => { if (!x) return; Object.values(x.uniforms).forEach(u => u.value?.dispose?.()); x.dispose(); }); },
  };
}
