import * as THREE from 'three';

/*
 * 見張り · THE EYE IN THE SKY. Not an eyeball: one vast eye opening in the cloud above the end of the
 * canyon, drawn like a manga panel (inked liner with a wing, fanned lashes, a huge iris) on a single
 * plane far away. It blinks, glances, reads what the scan ring is reading, and turns red on lockdown.
 *
 * Shader space: q, where the almond's half-width is 1 and +y is up.
 */

const PI = Math.PI;
export const EYE_W = 150, EYE_H = 90;   // plane size in world units
const A = 0.78;                          // almond half-width as a fraction of the plane's half-width

const FRAG = `
varying vec2 vUv; varying vec3 vWP;
uniform float uTime, uOpen, uPupil, uSlit, uAlert, uFlash, uScan;
uniform vec2 uLook; uniform vec3 uFlashCol;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
float ring(float u, float r, float k, float m){ return mix(noise(vec2(u * k, r * m)), noise(vec2((u - 1.0) * k, r * m)), u); }
float ringf(float u, float r, float k, float m){ return mix(fbm(vec2(u * k, r * m)), fbm(vec2((u - 1.0) * k, r * m)), u); }
float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }

// lid curves: open is an almond with a lifted outer corner (+x); closed is a gentle smile
float closedY(float x){ return -0.06 * (1.0 - x * x) + 0.03 * x; }
float upperY(float x){ float e = max(0.0, 1.0 - x * x); return mix(closedY(x), 0.5 * pow(e, 0.8) + 0.06 * x, uOpen); }
float lowerY(float x){ float e = max(0.0, 1.0 - x * x); return mix(closedY(x) - 0.004, -0.33 * pow(e, 1.2) + 0.05 * x, uOpen); }

void main(){
  vec2 q = (vUv - 0.5) * vec2(1.0, ${(EYE_H / EYE_W).toFixed(4)}) * 2.0 / ${A.toFixed(3)};
  float x = q.x, yu = upperY(x), yl = lowerY(x);
  float inside = step(abs(x), 1.0) * step(q.y, yu) * step(yl, q.y);
  vec3 col = vec3(0.0); float alpha = 0.0;

  // ── the cloud the eye opens in ──
  float rr = length(q * vec2(0.8, 1.6));
  float tw = atan(q.y, q.x) + 0.8 / (rr + 0.5) - uTime * 0.02;
  vec2 sw = vec2(cos(tw), sin(tw)) * (rr + 0.3);
  float cl = fbm(sw * 1.8 + 2.0), cl2 = fbm(q * vec2(2.0, 4.0) + cl * 2.0 + uTime * 0.01);
  vec3 warm = mix(vec3(0.9, 0.2, 0.75), vec3(1.0, 0.1, 0.16), uAlert);
  float lit = exp(-max(0.0, max(q.y - yu, yl - q.y)) * 3.0) * step(abs(x), 1.15);
  col = mix(vec3(0.004, 0.003, 0.012), vec3(0.06, 0.025, 0.1), smoothstep(0.45, 0.9, cl2)) + warm * lit * 0.16 * (0.3 + cl2) * (0.3 + 0.7 * uOpen);
  col += vec3(0.1, 0.45, 0.9) * smoothstep(0.7, 0.92, cl) * 0.08;
  alpha = smoothstep(1.75, 1.0, rr) * (0.55 + 0.45 * smoothstep(0.3, 0.7, cl2));

  if (inside > 0.5) {
    // ── sclera ──
    float dU = yu - q.y, dL = q.y - yl;
    vec3 scl = mix(vec3(0.14, 0.12, 0.28), vec3(0.42, 0.4, 0.58), smoothstep(0.0, 0.3, min(dU, dL * 1.4)));
    scl *= 1.0 - 0.5 * smoothstep(0.55, 1.0, abs(x));
    scl += vec3(0.6, 0.1, 0.4) * pow(1.0 - abs(2.0 * fbm(q * vec2(9.0, 4.0) + 3.0) - 1.0), 18.0) * smoothstep(0.5, 0.95, abs(x)) * 0.5;

    // ── iris ──
    vec2 ic = uLook * vec2(0.36, 0.1);
    vec2 ip = (q - ic) / 0.46; float r = length(ip);
    float a = atan(ip.y, ip.x), u = a / 6.2831853 + 0.5;
    vec2 pp = vec2(ip.x / mix(1.0, 0.24, uSlit), ip.y * mix(1.0, 0.94, uSlit)); float pr = length(pp);
    float rn = clamp((r - uPupil) / (1.0 - uPupil), 0.0, 1.0);
    float fib = ring(u, rn, 110.0, 2.2) * 0.4 + ring(u + 0.21, rn, 260.0, 5.0) * 0.22 + ring(u + 0.43, rn, 640.0, 11.0) * 0.18 + ringf(u + 0.5, rn, 36.0, 1.6) * 0.45;
    float wav = 0.34 + 0.035 * sin(a * 13.0 + 1.3) + 0.018 * sin(a * 29.0 + 0.4);
    float coll = smoothstep(0.045, 0.0, abs(rn - wav));
    float crypt = smoothstep(0.64, 0.8, ringf(u + 0.7, rn, 22.0, 3.4)) * smoothstep(0.38, 0.5, rn) * smoothstep(0.9, 0.7, rn);
    vec3 ir = mix(vec3(1.0, 0.16, 0.6), vec3(0.05, 0.65, 1.0), smoothstep(0.15, 0.55, rn));
    ir = mix(ir, vec3(0.08, 0.1, 0.6), smoothstep(0.6, 0.97, rn));
    ir *= 0.35 + 1.3 * fib;
    ir = mix(ir, vec3(1.0, 0.5, 0.55) * (0.5 + fib), coll * 0.4);
    ir *= 1.0 - crypt * 0.7;
    // implant layer: segmented ring, tick scale, a band of data glyphs, a scan sweep
    ir += vec3(0.25, 0.9, 1.0) * smoothstep(0.006, 0.0, abs(r - 0.6)) * step(0.35, fract(u * 24.0 + uTime * 0.03)) * 0.7;
    ir += vec3(0.25, 0.9, 1.0) * step(0.86, fract(u * 144.0)) * smoothstep(0.012, 0.0, abs(r - 0.69) - 0.012) * 0.5;
    vec2 gc = vec2(floor(u * 200.0), floor((r - 0.74) / 0.035));
    ir += vec3(1.0, 0.25, 0.75) * step(0.62, hash(gc + floor(uTime * 3.0 + hash(gc) * 9.0))) * step(0.74, r) * step(r, 0.845) * 0.4;
    ir += vec3(0.4, 1.0, 1.0) * pow(fract(u - uTime * 0.35), 18.0) * uScan * step(0.55, rn) * 0.9;
    ir = mix(ir, vec3(1.0, 0.08, 0.14) * (0.25 + fib * 1.1), uAlert * 0.85);
    float ruff = smoothstep(0.035, 0.0, pr - uPupil);
    ir += mix(vec3(1.0, 0.25, 0.65), vec3(1.0, 0.1, 0.15), uAlert) * ruff * 0.9;
    ir += uFlashCol * uFlash * (ruff + coll * 0.6 + 0.12);
    ir = mix(ir, vec3(0.012, 0.015, 0.05), smoothstep(0.86, 0.99, r));          // limbal ring
    float irisM = smoothstep(1.0, 0.985, r);
    vec3 eye = mix(scl, ir, irisM);
    eye = mix(eye, vec3(0.004, 0.003, 0.01), smoothstep(uPupil + 0.01, uPupil - 0.01, pr) * irisM);   // pupil
    // catchlights: a window with mullions, and a dot
    vec2 wq = q - ic - vec2(-0.15, 0.17);
    float win = step(abs(wq.x), 0.07) * step(abs(wq.y), 0.09) * step(0.008, abs(wq.x)) * step(0.008, abs(wq.y - 0.01));
    eye = mix(eye, vec3(1.6, 1.6, 1.7), win * 0.95);
    eye = mix(eye, vec3(1.3), smoothstep(0.03, 0.022, length(q - ic - vec2(0.17, -0.13))));
    // the upper lid casts a band of shadow; the lower lid is wet and catches light
    eye *= 1.0 - 0.75 * smoothstep(0.17, 0.0, dU);
    eye += warm * smoothstep(0.03, 0.0, dL) * 0.5;
    col = eye; alpha = 1.0;
  }

  // ── ink: a heavy liner along the upper lid ending in a wing, a fine line under the eye ──
  float dx = 0.004, slope = (upperY(x + dx) - upperY(x - dx)) / (2.0 * dx);
  float dUp = abs(q.y - yu) / sqrt(1.0 + slope * slope);
  // bold enough to survive the text-vision lens (a line thinner than a character cell falls between glyphs)
  float thick = mix(0.024, 0.055, smoothstep(-1.0, 0.7, x)) * step(abs(x), 1.0) * (0.6 + 0.4 * uOpen) + 0.008;
  float wingEnd = 0.0;
  vec2 c0 = vec2(1.0, upperY(1.0));
  float wing = seg(q, c0 - vec2(0.06, 0.0), c0 + vec2(0.2, 0.1 + 0.03 * uOpen));
  float liner = max(smoothstep(thick, thick * 0.6, dUp) * step(abs(x), 1.0), smoothstep(0.055, 0.03, wing) * step(0.94, x));
  float lowLine = smoothstep(0.02, 0.01, abs(q.y - yl)) * step(abs(x), 0.98) * uOpen;
  // lashes: fanned strokes along the upper lid, longer and curled at the outer corner
  float lash = 0.0;
  for (int i = 0; i < 16; i++) {
    float t = float(i) / 15.0;
    float x0 = mix(-0.9, 0.97, t);
    vec2 b = vec2(x0, upperY(x0));
    float sl = (upperY(x0 + 0.01) - upperY(x0 - 0.01)) / 0.02;
    vec2 n = normalize(vec2(-sl, 1.0));
    n.y *= mix(-0.8, 1.0, smoothstep(0.0, 0.6, uOpen));      // closed: the lashes hang down
    vec2 d = normalize(n + vec2(0.5 * x0 + 0.25, 0.0));
    float L = (0.12 + 0.2 * smoothstep(-0.3, 1.0, x0)) * (0.8 + 0.4 * hash(vec2(float(i), 2.0)));
    vec2 p1 = b + d * L * 0.55, p2 = b + (d + vec2(0.3 + 0.2 * x0, 0.12 * sign(d.y))) * L;
    float w = mix(0.022, 0.006, clamp(length(q - b) / L, 0.0, 1.0));
    lash = max(lash, smoothstep(w, w * 0.4, min(seg(q, b, p1), seg(q, p1, p2))));
  }
  for (int i = 0; i < 7; i++) {
    float x0 = mix(-0.55, 0.9, float(i) / 6.0);
    vec2 b = vec2(x0, lowerY(x0));
    vec2 d = normalize(vec2(0.35 * x0 + 0.15, -1.0));
    float L = (0.06 + 0.06 * smoothstep(-0.4, 1.0, x0)) * uOpen;
    lash = max(lash, smoothstep(0.018, 0.008, seg(q, b, b + d * L)));
  }
  // a crease above the lid, as manga inks it
  float crease = smoothstep(0.026, 0.012, abs(q.y - (yu + 0.13 * smoothstep(0.0, 1.0, uOpen) + 0.02))) * step(abs(x + 0.05), 0.75) * smoothstep(0.75, 0.4, abs(x + 0.05)) * uOpen;
  // drawn in light, not ink: in the watcher's own text-vision a black line would vanish into the night
  float margin = exp(-max(0.0, yu - q.y - thick) / 0.012) * inside;
  col += warm * margin * 0.6;
  vec3 lashCol = mix(vec3(0.15, 0.85, 1.0), vec3(1.0, 0.25, 0.75), smoothstep(-0.6, 0.9, x));
  col = mix(col, warm * 2.4, liner);
  col = mix(col, lashCol * 1.5, lash * (1.0 - liner));
  col = mix(col, warm * 1.2, max(lowLine, crease * 0.6) * (1.0 - liner));
  alpha = max(alpha, max(max(liner, lowLine), max(lash, crease * 0.6)));
  // the closed seam glows a little
  col += warm * (1.0 - uOpen) * smoothstep(0.03, 0.0, abs(q.y - closedY(x))) * step(abs(x), 1.0) * 0.8;
  col *= vWP.y < -2.2 ? 0.4 : 1.0;                               // its reflection in the flood is darker
  gl_FragColor = vec4(col, alpha);
}`;

export function createSkyEye() {
  const flashCol = new THREE.Color();
  const uniforms = {
    uTime: {value: 0}, uOpen: {value: 0}, uPupil: {value: 0.32}, uSlit: {value: 0}, uAlert: {value: 0},
    uFlash: {value: 0}, uFlashCol: {value: flashCol}, uScan: {value: 0}, uLook: {value: new THREE.Vector2()},
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; varying vec3 vWP; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: FRAG,
  });
  const geo = new THREE.PlaneGeometry(EYE_W, EYE_H);
  const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = -10; mesh.frustumCulled = false;
  const mirror = new THREE.Mesh(geo, mat); mirror.renderOrder = -10; mirror.frustumCulled = false;
  const st = {open: 0, blinkIn: 3, blinkT: -1, double: false, sacIn: 0, jx: 0, jy: 0, lx: 0, ly: 0, flash: 0, pupil: 0.32};
  const unit = (EYE_W / 2) * A;            // world units per shader unit

  return {
    mesh, mirror, unit,
    flash(kind) { st.flash = 1; flashCol.set(kind === 'deny' ? 0xff2a3a : kind === 'ask' ? 0xffb21f : 0x2dff9a); },
    /** The pupil's centre in the plane's local space (for the scan beam). */
    pupilLocal(out) { return out.set(uniforms.uLook.value.x * 0.36 * unit, uniforms.uLook.value.y * 0.1 * unit, 0); },
    /** open 0..1, look: vec2 in -1..1 (where it gazes), pupil, slit, scan, alert, autoBlink. */
    update(dt, time, {open, look, pupil, slit, scan, alert, autoBlink = true, glance = 0}) {
      uniforms.uTime.value = time; uniforms.uAlert.value = alert; uniforms.uScan.value = scan;
      if (autoBlink) {
        st.blinkIn -= dt;
        if (st.blinkIn <= 0 && st.blinkT < 0) { st.blinkT = 0; st.blinkIn = 3 + Math.random() * 4.5; st.double = Math.random() < 0.2; }
      }
      let blink = 1;
      if (st.blinkT >= 0) {
        st.blinkT += dt / 0.22;
        blink = 1 - Math.sin(Math.min(st.blinkT, 1) * PI);
        if (st.blinkT >= 1) { st.blinkT = st.double ? -0.5 : -1; st.double = false; }
      } else if (st.blinkT > -0.99) { st.blinkT += dt / 0.12; if (st.blinkT >= -0.02) st.blinkT = 0; }
      st.open += (open - st.open) * (1 - Math.pow(0.01, dt));
      const o = Math.max(0, st.open * blink);
      uniforms.uOpen.value = o;
      // saccades: snap, hold, snap
      st.sacIn -= dt;
      if (st.sacIn <= 0) { st.sacIn = 0.5 + Math.random() * 1.8; st.jx = (Math.random() - 0.5) * (0.08 + glance); st.jy = (Math.random() - 0.5) * (0.06 + glance * 0.4); }
      const k = 1 - Math.pow(1e-6, dt);
      st.lx += (Math.max(-1, Math.min(1, look.x + st.jx)) - st.lx) * k;
      st.ly += (Math.max(-1, Math.min(1, look.y + st.jy)) - st.ly) * k;
      uniforms.uLook.value.set(st.lx, st.ly);
      st.flash = Math.max(0, st.flash - dt * 2.2); uniforms.uFlash.value = st.flash;
      st.pupil += (pupil - st.flash * 0.05 - st.pupil) * (1 - Math.pow(0.05, dt));
      uniforms.uPupil.value = st.pupil + Math.sin(time * 0.9) * 0.008;
      uniforms.uSlit.value += (slit - uniforms.uSlit.value) * (1 - Math.pow(0.02, dt));
      return o;
    },
  };
}
