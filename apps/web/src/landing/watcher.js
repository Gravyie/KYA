import * as THREE from 'three';

/*
 * 見張り · THE WATCHER. A colossal eye hanging over the end of the canyon.
 *
 * Built like a real eye, so it reads at any distance and survives a close-up:
 *   ball   — sclera (a sphere), the iris (a disc set just inside it, so it has true parallax), a clear
 *            cornea bulging over the iris (only reflections: a window catchlight and the city's neon),
 *            and a retina lining the inside, seen through the pupil, which is a real hole.
 *   lids   — two hemispherical shells that rotate about the eye's horizontal axis. Their edges are great
 *            circles, so as they part the opening is an almond, exactly as on a face. Lashes ride the lids.
 * The ball turns to look (quick saccades, not a smooth pan); the lids stay put and blink.
 *
 * Local frame: the eye looks down +z. Everything is sized from ER, the eyeball radius.
 */

const PI = Math.PI;
const IRIS_ANGLE = 0.5;                  // angular radius of the iris on the ball
const NOISE = `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
// noise that wraps around the circle: u in [0,1) is the angle, so there is no seam where atan jumps
float ring(float u, float r, float k, float m){ return mix(noise(vec2(u * k, r * m)), noise(vec2((u - 1.0) * k, r * m)), u); }
float ringf(float u, float r, float k, float m){ return mix(fbm(vec2(u * k, r * m)), fbm(vec2((u - 1.0) * k, r * m)), u); }
`;

// far away the eye sits in the night air; its reflection in the flood is darker
const AIR = `
uniform float uHaze; uniform vec3 uHazeCol;
vec3 air(vec3 c, float wy){ c = mix(c, uHazeCol, uHaze); return wy < -2.2 ? c * 0.38 : c; }
`;

const WORLD_VERT = `
varying vec3 vL; varying vec3 vWN; varying vec3 vWP; varying vec2 vUv;
void main(){
  vL = position; vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz;
  vWN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const SCLERA_FRAG = `
varying vec3 vL; varying vec3 vWN; varying vec3 vWP;
uniform float uIrisCos, uTime, uAlert; uniform vec3 uLidU, uLidL;
${NOISE}${AIR}
void main(){
  vec3 n = normalize(vL);
  if (n.z > uIrisCos) discard;                         // the iris disc shows through here
  float lat = acos(clamp(n.z, -1.0, 1.0));
  float u = atan(n.y, n.x) / 6.2831853 + 0.5;
  vec3 col = mix(vec3(0.1, 0.08, 0.2), vec3(0.5, 0.47, 0.66), smoothstep(1.45, 0.4, lat));
  col *= 1.0 - 0.45 * smoothstep(0.35, 0.95, abs(n.x));                       // the corners sink into shadow
  col += vec3(0.05, 0.12, 0.25) * smoothstep(0.2, -0.6, n.y) * 0.5;           // cool bounce from the city below
  // fine veins creeping in from the corners, lit like fibre optics
  float v1 = pow(1.0 - abs(2.0 * ringf(u, lat, 24.0, 3.0) - 1.0), 16.0);
  float v2 = pow(1.0 - abs(2.0 * ringf(u + 0.37, lat, 52.0, 6.0) - 1.0), 22.0);
  float veinMask = smoothstep(0.75, 1.35, lat) * (0.4 + 0.6 * smoothstep(0.3, 0.9, abs(n.x)));
  col = mix(col, vec3(0.75, 0.12, 0.42), clamp(v1 * 0.8 + v2 * 0.5, 0.0, 1.0) * veinMask);
  col += vec3(1.0, 0.2, 0.7) * v2 * veinMask * 0.25 * (0.6 + 0.4 * sin(uTime * 1.3 + u * 40.0));
  // the limbus: a soft grey shadow ring where the sclera meets the iris
  float li = acos(uIrisCos);
  col *= mix(1.0, 0.45, smoothstep(li + 0.14, li, lat));
  // lids throw shadow onto the ball (ambient occlusion from the lid planes)
  float occ = max(dot(n, uLidU), dot(n, uLidL));
  col *= 1.0 - 0.92 * smoothstep(-0.32, 0.0, occ);
  col = mix(col, vec3(0.9, 0.3, 0.55) * dot(col, vec3(0.33)), smoothstep(-0.12, 0.0, occ) * 0.5);  // wet pink at the lid line
  // cold neon from the city on the rim
  vec3 V = normalize(cameraPosition - vWP);
  float fres = pow(1.0 - max(dot(normalize(vWN), V), 0.0), 3.0);
  col += vec3(0.1, 0.55, 1.0) * fres * 0.3;
  col = mix(col, col * vec3(1.25, 0.32, 0.4), uAlert * 0.7);
  gl_FragColor = vec4(air(col, vWP.y), 1.0);
}`;

const IRIS_VERT = `
varying vec2 vP; varying vec3 vEye; varying vec3 vWP;
uniform float uIR, uZ;
void main(){
  vP = position.xy / uIR; vEye = vec3(position.xy, uZ); vWP = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const IRIS_FRAG = `
varying vec2 vP; varying vec3 vEye; varying vec3 vWP;
uniform float uTime, uPupil, uSlit, uAlert, uFlash, uScan;
uniform vec3 uFlashCol, uLidU, uLidL;
${NOISE}${AIR}
void main(){
  vec2 p = vP; float r = length(p);
  if (r > 1.0) discard;
  float a = atan(p.y, p.x), u = a / 6.2831853 + 0.5;
  // pupil: round when calm, a vertical slit (a cursor) on alert
  vec2 pp = vec2(p.x / mix(1.0, 0.24, uSlit), p.y * mix(1.0, 0.92, uSlit));
  float pr = length(pp);
  if (pr < uPupil) discard;                            // a real hole: through it, the inside of the eye
  float rn = clamp((r - uPupil * mix(1.0, 0.5, uSlit)) / (1.0 - uPupil * mix(1.0, 0.5, uSlit)), 0.0, 1.0);

  // stroma: layered radial fibres that stretch as the pupil dilates
  float f1 = ring(u, rn, 110.0, 2.2), f2 = ring(u + 0.21, rn, 260.0, 5.0), f3 = ringf(u + 0.5, rn, 36.0, 1.6);
  float fib = f1 * 0.45 + f2 * 0.25 + f3 * 0.5;
  // collarette: the wavy ridge a third of the way out
  float wav = 0.34 + 0.035 * sin(a * 13.0 + 1.3) + 0.018 * sin(a * 29.0 + 0.4);
  float coll = smoothstep(0.045, 0.0, abs(rn - wav));
  // crypts: dark lacunae in the ciliary zone
  float crypt = smoothstep(0.64, 0.8, ringf(u + 0.7, rn, 22.0, 3.4)) * smoothstep(0.38, 0.5, rn) * smoothstep(0.9, 0.7, rn);
  // furrows: faint concentric contraction rings near the rim
  float furrow = smoothstep(0.3, 0.0, abs(fract(rn * 7.0 + ring(u, rn, 8.0, 1.0) * 0.6) - 0.5)) * smoothstep(0.62, 0.86, rn);

  vec3 inner = vec3(1.0, 0.16, 0.58), mid = vec3(0.04, 0.62, 1.0), outer = vec3(0.07, 0.1, 0.62);
  vec3 col = mix(inner, mid, smoothstep(0.18, 0.55, rn));
  col = mix(col, outer, smoothstep(0.6, 0.97, rn));
  col *= 0.2 + 1.0 * fib;
  col = mix(col, vec3(1.0, 0.45, 0.5) * (0.45 + fib * 0.8), coll * 0.38);
  col *= 1.0 - crypt * 0.75;
  col *= 1.0 - furrow * 0.25;
  // limbal ring: the dark border that makes eyes look alive
  col = mix(col, vec3(0.015, 0.02, 0.07), smoothstep(0.84, 0.99, r));
  // pupillary ruff: a glowing rim right at the hole
  float ruff = smoothstep(0.03, 0.0, pr - uPupil);
  col *= 1.0 - smoothstep(0.1, 0.0, pr - uPupil) * 0.5;                     // the iris darkens into the pupil
  col += mix(vec3(1.0, 0.25, 0.65), vec3(1.0, 0.1, 0.15), uAlert) * ruff * 0.75;

  // the machine layer: a segmented ring, a tick scale, and a band of data glyphs. Faint; it is an implant, not a logo.
  float seg = step(0.35, fract(u * 24.0 + uTime * 0.03));
  float ringA = smoothstep(0.005, 0.0, abs(r - 0.6)) * seg;
  float ticks = step(0.86, fract(u * 144.0)) * smoothstep(0.012, 0.0, abs(r - 0.69) - 0.012);
  vec2 gc = vec2(floor(u * 220.0), floor((r - 0.74) / 0.035));
  float band = step(0.74, r) * step(r, 0.845);
  float glyph = step(0.62, hash(gc + floor(uTime * 3.0 + hash(gc) * 9.0))) * step(0.18, fract(u * 220.0)) * step(0.2, fract((r - 0.74) / 0.035)) * band;
  col += vec3(0.25, 0.9, 1.0) * (ringA * 0.6 + ticks * 0.45);
  col += vec3(1.0, 0.25, 0.75) * glyph * 0.32;
  // a scan sweep around the iris when the eye is reading something
  float sweep = pow(fract(u - uTime * 0.35), 18.0) * uScan * step(0.55, rn);
  col += vec3(0.4, 1.0, 1.0) * sweep * 0.8;

  col = mix(col, vec3(1.0, 0.08, 0.14) * (0.25 + fib * 1.1) + vec3(1.0, 0.5, 0.4) * coll * 0.3, uAlert * 0.85);
  col += uFlashCol * uFlash * (ruff * 1.2 + coll * 0.6 + 0.12);
  // lid shadow across the top of the iris
  vec3 n = normalize(vEye);
  float occ = max(dot(n, uLidU), dot(n, uLidL));
  col *= 1.0 - 0.9 * smoothstep(-0.3, 0.0, occ);
  gl_FragColor = vec4(air(col * 1.1, vWP.y), 1.0);
}`;

const CORNEA_FRAG = `
varying vec3 vWN; varying vec3 vWP;
uniform float uTime, uAlert, uAmount;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec3 N = normalize(vWN), V = normalize(cameraPosition - vWP);
  vec3 R = reflect(-V, N);
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  // the catchlight: a window with mullions, high on the cornea (the anime highlight, physically placed)
  vec3 L = normalize(vec3(-0.42, 0.5, 0.76));
  vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), L)), B = cross(L, T);
  vec3 q = R - L * dot(R, L);
  float x = dot(q, T), y = dot(q, B);
  float win = smoothstep(0.075, 0.068, abs(x)) * smoothstep(0.1, 0.092, abs(y)) * step(0.0, dot(R, L));
  win *= step(0.006, abs(x)) * step(0.006, abs(y - 0.012));
  // a second, small round glint
  float glint = smoothstep(0.03, 0.02, length(R - normalize(vec3(0.38, -0.12, 0.92))));
  // the city reflected as a thin neon horizon across the lower cornea
  float az = atan(R.x, R.z), band = smoothstep(0.05, 0.0, abs(R.y + 0.16));
  float cell = floor(az * 60.0);
  float lights = step(0.55, hash(vec2(cell, 3.0))) * step(0.3, fract(az * 60.0));
  vec3 neon = mix(vec3(0.1, 0.9, 1.0), vec3(1.0, 0.2, 0.7), step(0.5, hash(vec2(cell, 9.0))));
  neon = mix(neon, vec3(1.0, 0.1, 0.15), uAlert);
  vec3 env = vec3(1.0, 0.98, 1.0) * win * 2.6 + vec3(0.8, 0.95, 1.0) * glint * 1.6 + neon * band * lights * 0.22;
  gl_FragColor = vec4((env * (0.45 + fres) + vec3(0.25, 0.35, 0.8) * fres * 0.18) * uAmount, 1.0);
}`;

const RETINA_FRAG = `
varying vec3 vL; varying vec3 vWP;
uniform float uTime, uAlert, uNear;
${NOISE}${AIR}
void main(){
  vec3 n = normalize(vL);
  vec2 s = n.xy / (1.2 + n.z);                         // stereographic map from the front pole
  float r = length(s);
  float web = pow(1.0 - abs(2.0 * fbm(s * 9.0 + 4.0) - 1.0), 10.0);
  float web2 = pow(1.0 - abs(2.0 * fbm(s * 22.0 + 9.0) - 1.0), 14.0);
  float pulse = 0.5 + 0.5 * sin(r * 30.0 - uTime * 2.2);
  vec3 c = mix(vec3(0.1, 0.8, 1.0), vec3(1.0, 0.2, 0.7), smoothstep(0.2, 0.9, fbm(s * 3.0)));
  c = mix(c, vec3(1.0, 0.1, 0.15), uAlert);
  vec3 col = vec3(0.004, 0.003, 0.012) + c * (web * 0.32 + web2 * 0.16) * (0.5 + pulse * 0.5);
  col += c * exp(-r * r * 14.0) * 0.14;                // the fovea, where it is looking
  gl_FragColor = vec4(air(col * uNear, vWP.y), 1.0);
}`;

// The skin the eye opens in: storm cloud, mapped flat across the eye's face so the lids and the backdrop
// are one continuous surface (no eyeball silhouette), lit from the opening.
const SKIN = `
uniform float uGlow;
vec3 skin(vec2 q){
  float r = length(q), a = atan(q.y, q.x);
  float tw = a + 0.9 / (r + 0.5) - uTime * 0.02;
  vec2 sw = vec2(cos(tw), sin(tw)) * (r + 0.3);
  float f = fbm(sw * 1.7 + 3.0);
  float g = fbm(q * vec2(2.2, 4.5) + f * 2.2 + vec2(0.0, uTime * 0.01));
  vec3 c = mix(vec3(0.003, 0.002, 0.009), vec3(0.045, 0.02, 0.075), smoothstep(0.38, 0.8, g));
  c *= 0.55 + 0.45 * smoothstep(0.2, 0.7, f);
  c += vec3(0.08, 0.32, 0.6) * smoothstep(0.62, 0.9, f) * exp(-r * 0.7) * 0.25;            // cold cloud edges
  vec3 warm = mix(vec3(0.75, 0.16, 0.6), vec3(1.0, 0.1, 0.16), uAlert);
  c += warm * exp(-pow(max(r - 0.85, 0.0) * 2.4, 2.0)) * (0.012 + 0.04 * uGlow) * (0.3 + g);  // faintly lit from the opening
  return c;
}`;

const LID_FRAG = `
varying vec3 vL; varying vec3 vWN; varying vec3 vWP;
uniform float uTime, uAlert, uSide, uR, uRot;
${NOISE}${AIR}${SKIN}
void main(){
  vec3 n = normalize(vL);
  float lat = asin(clamp(n.y * uSide, 0.0, 1.0));      // 0 at the lid margin, rising toward the brow
  float lon = atan(n.x, n.z);
  float front = smoothstep(-0.1, 0.45, n.z);
  // where this point sits on the eye's face (root space), to share the skin with the backdrop
  float c = cos(uRot), s = sin(uRot);
  vec3 rp = vec3(vL.x, vL.y * c - vL.z * s, vL.y * s + vL.z * c) / uR;
  vec3 col = skin(rp.xy);
  // the lid's own roundness, only near the opening: a soft rolled edge
  float roll = smoothstep(0.32, 0.0, lat) * front;
  col = mix(col, col * 1.3 + vec3(0.02, 0.01, 0.035), roll * 0.5);
  // the crease above the upper lid, an ink line as in manga
  float crease = smoothstep(0.02, 0.0, abs(lat - 0.34 - 0.05 * cos(lon * 1.6))) * front * step(0.0, uSide) * smoothstep(1.2, 0.35, abs(lon));
  col *= 1.0 - crease * 0.85;
  // the wet margin catches the iris light
  float margin = smoothstep(0.06, 0.0, lat) * front;
  col += mix(vec3(1.0, 0.22, 0.68), vec3(1.0, 0.08, 0.14), uAlert) * margin * 0.8;
  gl_FragColor = vec4(air(col, vWP.y), 1.0);
}`;

const BACK_FRAG = `
varying vec3 vL; varying vec3 vWP;
uniform float uTime, uAlert, uR;
${NOISE}${AIR}${SKIN}
void main(){
  vec2 q = vL.xy / uR; float r = length(q);
  vec3 col = skin(q);
  float a = smoothstep(3.0, 1.35, r) * smoothstep(-1.9, -1.05, q.y);   // clouds above and around; clear air below
  gl_FragColor = vec4(air(col, vWP.y), a);
}`;

/** A lash: a thin cone with its tip curled forward. Unit length; instances scale it. */
function lashGeometry() {
  const g = new THREE.ConeGeometry(0.06, 1, 6, 10, true);
  g.translate(0, 0.5, 0);
  g.rotateY(PI);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, p.getZ(i) + y * y * 0.42); }
  g.computeVertexNormals();
  return g;
}

export function createWatcher({ER = 15, small = false} = {}) {
  const IR = ER * Math.sin(IRIS_ANGLE), IZ = ER * Math.cos(IRIS_ANGLE) - ER * 0.035;
  // cornea: a sphere cap passing through the iris rim, peaking a little in front of the ball
  const apex = ER * 1.075, rimZ = ER * Math.cos(IRIS_ANGLE);
  const cZ = (apex * apex - IR * IR - rimZ * rimZ) / (2 * (apex - rimZ)), cR = apex - cZ;

  const lidU = new THREE.Vector3(), lidL = new THREE.Vector3();
  const flashCol = new THREE.Color();
  const shared = {uTime: {value: 0}, uAlert: {value: 0}, uGlow: {value: 0}, uLidU: {value: lidU}, uLidL: {value: lidL}, uHaze: {value: 0}, uHazeCol: {value: new THREE.Color(0.05, 0.04, 0.12)}};
  const scleraMat = new THREE.ShaderMaterial({vertexShader: WORLD_VERT, fragmentShader: SCLERA_FRAG, uniforms: {...shared, uIrisCos: {value: Math.cos(IRIS_ANGLE)}}});
  const irisMat = new THREE.ShaderMaterial({
    vertexShader: IRIS_VERT, fragmentShader: IRIS_FRAG, side: THREE.DoubleSide,
    uniforms: {...shared, uIR: {value: IR}, uZ: {value: IZ}, uPupil: {value: 0.3}, uSlit: {value: 0}, uFlash: {value: 0}, uFlashCol: {value: flashCol}, uScan: {value: 0}},
  });
  const corneaMat = new THREE.ShaderMaterial({vertexShader: WORLD_VERT, fragmentShader: CORNEA_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {...shared, uAmount: {value: 1}}});
  const retinaMat = new THREE.ShaderMaterial({vertexShader: WORLD_VERT, fragmentShader: RETINA_FRAG, side: THREE.BackSide, uniforms: {...shared, uNear: {value: 1}}});
  const lidMat = side => new THREE.ShaderMaterial({vertexShader: WORLD_VERT, fragmentShader: LID_FRAG, side: THREE.DoubleSide, uniforms: {...shared, uSide: {value: side}, uR: {value: ER}, uRot: {value: 0}}});
  const backMat = new THREE.ShaderMaterial({vertexShader: WORLD_VERT, fragmentShader: BACK_FRAG, transparent: true, depthWrite: false, uniforms: {...shared, uR: {value: ER}}});
  const lidMats = [lidMat(1), lidMat(-1)];
  const marginMat = new THREE.MeshBasicMaterial({color: new THREE.Color(0x05030c)});
  const lashMat = new THREE.MeshBasicMaterial({color: new THREE.Color(0x020106)});
  const seg = small ? [72, 48] : [128, 96];
  const scleraGeo = new THREE.SphereGeometry(ER, seg[0], seg[1]); scleraGeo.rotateX(PI / 2);   // pole on +z
  const corneaGeo = new THREE.SphereGeometry(cR, 96, 24, 0, PI * 2, 0, Math.asin(IR / cR)); corneaGeo.rotateX(PI / 2); corneaGeo.translate(0, 0, cZ);
  const irisGeo = new THREE.CircleGeometry(IR * 1.01, small ? 96 : 160); irisGeo.translate(0, 0, IZ);
  const retinaGeo = new THREE.SphereGeometry(ER * 0.97, 64, 48);
  const lidGeo = (r, side) => new THREE.SphereGeometry(r, seg[0], seg[1] / 2, 0, PI * 2, side > 0 ? 0 : PI / 2, PI / 2);
  const marginGeo = new THREE.TorusGeometry(ER * 1.04, ER * 0.028, 10, 180); marginGeo.rotateX(PI / 2);
  const lashGeo = lashGeometry();
  const backGeo = new THREE.CircleGeometry(ER * 3.05, 96);

  /** One eye (the scene uses two: the real one and its reflection in the flood). Materials are shared. */
  function build() {
    const root = new THREE.Group();
    const back = new THREE.Mesh(backGeo, backMat); back.position.z = -ER * 1.06; back.renderOrder = -5; root.add(back);   // behind the retina, so the pupil stays a hole
    const ball = new THREE.Group(); root.add(ball);
    ball.add(new THREE.Mesh(scleraGeo, scleraMat), new THREE.Mesh(retinaGeo, retinaMat), new THREE.Mesh(irisGeo, irisMat));
    const cornea = new THREE.Mesh(corneaGeo, corneaMat); cornea.renderOrder = 10; ball.add(cornea);
    const lids = [1, -1].map((side, k) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(lidGeo(ER * (side > 0 ? 1.04 : 1.036), side), lidMats[k]));
      const margin = new THREE.Mesh(marginGeo, marginMat); margin.scale.y = 1; g.add(margin);
      // lashes along the front arc of the margin, longer and fanned at the outer corner (+x)
      const n = side > 0 ? (small ? 46 : 74) : (small ? 18 : 30);
      const lashes = new THREE.InstancedMesh(lashGeo, lashMat, n);
      const m = new THREE.Matrix4(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Zv = new THREE.Vector3(), up = new THREE.Vector3(0, side, 0);
      let seed = side > 0 ? 7 : 19; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < n; i++) {
        const t = (i + rnd() * 0.6) / n, phi = -1.18 + t * 2.36;
        const radial = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi));
        const tangent = new THREE.Vector3(Math.cos(phi), 0, -Math.sin(phi));
        const outer = Math.max(0, phi) / 1.18;
        Y.copy(radial).multiplyScalar(side > 0 ? 0.62 : 0.9).addScaledVector(up, side > 0 ? 0.74 : 0.42).addScaledVector(tangent, phi * (side > 0 ? 0.62 : 0.4) + (rnd() - 0.5) * 0.22).normalize();
        Zv.copy(up).addScaledVector(Y, -up.dot(Y)).normalize();
        X.crossVectors(Y, Zv);
        const clump = 0.75 + 0.5 * Math.pow(Math.abs(Math.sin(i * 1.7)), 3);
        const len = ER * (side > 0 ? (0.07 + rnd() * 0.05) * clump * (1 + outer * 1.1) * (1 - Math.pow(Math.abs(phi) / 1.18, 5) * 0.65) : (0.035 + rnd() * 0.03) * (1 + outer * 0.6));
        m.makeBasis(X, Y, Zv).scale(new THREE.Vector3(len, len, len)).setPosition(radial.multiplyScalar(ER * 1.05));
        lashes.setMatrixAt(i, m);
      }
      lashes.frustumCulled = false;
      g.add(lashes);
      root.add(g);
      return g;
    });
    return {root, ball, lids};
  }

  const eyes = [build()];
  const st = {open: 0, blink: 1, blinkIn: 3, blinkT: -1, yaw: 0, pitch: 0, sacIn: 0, jx: 0, jy: 0, pupil: 0.3, flash: 0};
  const inv = new THREE.Quaternion(), tmp = new THREE.Vector3();
  const ROT = {u: 0.56, l: 0.4};                       // fully open lid angles (radians from closed)

  return {
    root: eyes[0].root, ball: eyes[0].ball,
    /** A second copy for the mirrored world (shares materials, follows the same animation). */
    mirrorCopy() { const e = build(); eyes.push(e); return e.root; },
    IR, ER,
    flash(kind) {
      st.flash = 1;
      flashCol.set(kind === 'deny' ? 0xff2a3a : kind === 'ask' ? 0xffb21f : 0x2dff9a);
    },
    /**
     * open: 0..1 lid openness (before blinks). gaze: a point in the eye's parent space to look at.
     * pupil: 0..1 fraction of the iris. slit: 0..1. scan: 0..1 iris sweep. alert: 0..1.
     */
    update(dt, time, {dist = 100, open, gaze, pupil, slit, scan, alert, autoBlink = true, glance = 0}) {
      shared.uTime.value = time; shared.uAlert.value = alert;
      shared.uHaze.value = Math.min(0.4, Math.max(0, (dist - 50) / 260));
      retinaMat.uniforms.uNear.value = Math.min(1, Math.max(0.12, 1 - (dist - 25) / 40));
      // blinks: every few seconds, sometimes twice
      if (autoBlink) {
        st.blinkIn -= dt;
        if (st.blinkIn <= 0 && st.blinkT < 0) { st.blinkT = 0; st.blinkIn = 2.8 + Math.random() * 4.5; if (Math.random() < 0.2) st.double = true; }
      }
      let blink = 1;
      if (st.blinkT >= 0) {
        st.blinkT += dt / 0.2;
        blink = 1 - Math.sin(Math.min(st.blinkT, 1) * PI) * 0.97;
        if (st.blinkT >= 1) { st.blinkT = st.double ? -0.6 : -1; st.double = false; }
      } else if (st.blinkT < -0.01 && st.blinkT > -1) { st.blinkT += dt / 0.15; if (st.blinkT >= -0.02) st.blinkT = 0; }
      st.open += (open - st.open) * (1 - Math.pow(0.004, dt));
      const o = Math.max(0, st.open * blink);
      // saccades: the gaze snaps, holds, snaps again, with tiny drifts in between
      st.sacIn -= dt;
      if (st.sacIn <= 0) { st.sacIn = 0.5 + Math.random() * 1.8; st.jx = (Math.random() - 0.5) * (0.05 + glance * 0.5); st.jy = (Math.random() - 0.5) * (0.03 + glance * 0.25); }
      tmp.copy(gaze).sub(eyes[0].root.position).normalize();
      const yaw = Math.max(-0.42, Math.min(0.42, Math.atan2(tmp.x, tmp.z) + st.jx));
      const pitch = Math.max(-0.3, Math.min(0.3, -Math.asin(Math.max(-1, Math.min(1, tmp.y))) + st.jy));
      const k = 1 - Math.pow(1e-7, dt);
      st.yaw += (yaw - st.yaw) * k; st.pitch += (pitch - st.pitch) * k;
      // the pupil breathes (hippus), narrows when a verdict flashes, follows the stage
      st.flash = Math.max(0, st.flash - dt * 2.2);
      st.pupil += (pupil - st.flash * 0.05 - st.pupil) * (1 - Math.pow(0.05, dt));
      irisMat.uniforms.uPupil.value = st.pupil + Math.sin(time * 0.9) * 0.008 + Math.sin(time * 2.3) * 0.004;
      irisMat.uniforms.uSlit.value += (slit - irisMat.uniforms.uSlit.value) * (1 - Math.pow(0.02, dt));
      irisMat.uniforms.uFlash.value = st.flash; irisMat.uniforms.uScan.value = scan;
      shared.uGlow.value = o * (1 + st.flash * 0.3);
      for (const e of eyes) {
        e.ball.rotation.set(st.pitch, st.yaw, 0);
        // the upper lid follows the gaze a little, as real lids do
        e.lids[0].rotation.x = -ROT.u * o - st.pitch * 0.35 * o;
        e.lids[1].rotation.x = ROT.l * o - st.pitch * 0.2 * o;
        e.lids[0].rotation.y = e.lids[1].rotation.y = st.yaw * 0.12;
      }
      lidMats[0].uniforms.uRot.value = eyes[0].lids[0].rotation.x; lidMats[1].uniforms.uRot.value = eyes[0].lids[1].rotation.x;
      // lid planes, expressed in ball space, for shading the ball
      const ball = eyes[0].ball, [U, L] = eyes[0].lids;
      inv.copy(ball.quaternion).invert();
      lidU.set(0, 1, 0).applyQuaternion(U.quaternion).applyQuaternion(inv);
      lidL.set(0, -1, 0).applyQuaternion(L.quaternion).applyQuaternion(inv);
      return o;
    },
  };
}
