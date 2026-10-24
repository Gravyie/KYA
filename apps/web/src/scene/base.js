import * as THREE from 'three';

/** Procedural primitives shared by the production city and passport. */
export const PI = Math.PI, TAU = PI * 2;
export const rand = (a, b) => a + Math.random() * (b - a);
export const smooth = t => t * t * (3 - 2 * t);
export const NEON = {cyan: 0x19e6ff, mag: 0xff2fa6, amber: 0xffb21f, red: 0xff3b4a, jade: 0x2dff9a, violet: 0x9a6bff, bone: 0xd8f6ff};

export const fontsReady = () => Promise.all([document.fonts?.load('900 100px "Noto Sans JP Variable"'), document.fonts?.load('700 100px "Chakra Petch"'), document.fonts?.load('500 40px "Geist Mono Variable"'), document.fonts?.ready]).catch(() => {});

/** Batch stable building lots into one instanced draw. */
export function towers(count, mat, place, {random = Math.random} = {}) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const dims = new Float32Array(count * 3), seeds = new Float32Array(count);
  const mesh = new THREE.InstancedMesh(geo, mat, count), dm = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const {x, z, w, d, h, y0 = 0} = place(i);
    dm.position.set(x, y0 + h / 2, z); dm.scale.set(w, h, d); dm.updateMatrix(); mesh.setMatrixAt(i, dm.matrix);
    dims[i * 3] = w; dims[i * 3 + 1] = h; dims[i * 3 + 2] = d; seeds[i] = random();
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
export function glyphAtlas(chars = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEF', {w = 48, h = 64} = {}) {
  const list = [...chars], c = document.createElement('canvas'); c.width = w * list.length; c.height = h;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, h);
  g.fillStyle = '#fff'; g.font = `700 ${Math.round(h * 0.7)}px "Noto Sans JP Variable", "Geist Mono Variable", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
  list.forEach((ch, i) => g.fillText(ch, i * w + w / 2, h * 0.54));
  const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  return {tex, count: list.length};
}

/** Studio reflections for shiny things. */
