import * as THREE from 'three';
import {GPUComputationRenderer} from 'three/examples/jsm/misc/GPUComputationRenderer.js';

/** Persistent position offsets and velocity, integrated independently of the flowing rest positions. */
export function createParticlePhysics(renderer, {side, seeds, restShader, uniforms, pointer, interactive = true}) {
  // A touch-only or reduced-motion session never perturbs the shader's flowing
  // rest positions. Sample one zero texel instead of allocating simulation targets
  // and compiling compute shaders that cannot receive any interaction.
  if(!interactive){
    const zero=new THREE.DataTexture(new Uint8Array(4),1,1);zero.needsUpdate=true;
    const uv=new Float32Array(side*side*2);uv.fill(.5);
    return {texture:{value:zero},uv,enabled:false,update(){},measure(){return {enabled:false};},dispose(){zero.dispose();}};
  }
  const gpu = new GPUComputationRenderer(side, side, renderer);
  const initialOffset = gpu.createTexture(), initialVelocity = gpu.createTexture(), metadata = gpu.createTexture();
  metadata.image.data.set(seeds);
  const velocity = gpu.addVariable('textureVelocity', `
    uniform sampler2D uSeeds; uniform float uDelta, uActive, uPress;
    uniform vec3 uRayOrigin, uRayDirection, uPointerVelocity;
    ${restShader}
    void main(){
      vec2 uv = gl_FragCoord.xy / resolution.xy;
      vec3 offset = texture2D(textureOffset, uv).xyz;
      vec3 velocity = texture2D(textureVelocity, uv).xyz;
      vec3 rest = restPosition(texture2D(uSeeds, uv));
      vec3 p = rest + offset;
      float depth = max(1.0, dot(p - uRayOrigin, uRayDirection));
      vec3 radial = p - (uRayOrigin + uRayDirection * depth);
      float distanceToRay = length(radial), radius = clamp(depth * 0.075, 3.0, 38.0);
      float influence = exp(-distanceToRay * distanceToRay / (radius * radius)) * uActive;
      vec3 normal = radial / max(distanceToRay, 0.1);
      vec3 tangent = cross(uRayDirection, normal);
      vec3 force = (normal * mix(1.0, -0.75, uPress) + tangent * uPress * 1.3) * radius * 23.0;
      force += uPointerVelocity * radius * 0.8;
      vec3 acceleration = -offset * 13.0 - velocity * 6.5 + force * influence;
      velocity += acceleration * uDelta;
      float speed = length(velocity); velocity *= min(1.0, 90.0 / max(speed, 0.01));
      gl_FragColor = vec4(velocity, 1.0);
    }`, initialVelocity);
  const offset = gpu.addVariable('textureOffset', `uniform float uDelta;
    void main(){vec2 uv=gl_FragCoord.xy/resolution.xy;
      vec3 p=texture2D(textureOffset,uv).xyz+texture2D(textureVelocity,uv).xyz*uDelta;
      p*=min(1.0,45.0/max(length(p),0.01));gl_FragColor=vec4(p,1.0);}`, initialOffset);
  for (const variable of [velocity, offset]) gpu.setVariableDependencies(variable, [velocity, offset]);
  Object.assign(velocity.material.uniforms, uniforms, pointer, {uSeeds: {value: metadata}, uDelta: {value: 0}});
  offset.material.uniforms.uDelta = velocity.material.uniforms.uDelta;
  const error = gpu.init();
  const texture = {value: error ? initialOffset : gpu.getCurrentRenderTarget(offset).texture};
  const uv = new Float32Array(side * side * 2);
  for (let i = 0; i < side * side; i++) uv.set([(i % side + 0.5) / side, (Math.floor(i / side) + 0.5) / side], i * 2);
  let idle = 4;
  return {texture, uv, enabled: !error,
    update(dt) {
      if (error || dt <= 0) return;
      idle = pointer.uActive.value > 0 ? 0 : idle + dt;
      if (idle > 3) return;
      // Substeps keep the spring stable when a frame is delayed or the tab regains focus.
      const steps = Math.min(2, Math.ceil(Math.min(dt,0.05) / 0.025));
      velocity.material.uniforms.uDelta.value = Math.min(dt, 0.05) / steps;
      for (let i = 0; i < steps; i++) gpu.compute();
      texture.value = gpu.getCurrentRenderTarget(offset).texture;
    },
    measure() {
      if(error)return {enabled:false};
      const pixels=new Float32Array(side*side*4);renderer.readRenderTargetPixels(gpu.getCurrentRenderTarget(offset),0,0,side,side,pixels);
      let total=0,max=0,finite=true;
      for(let i=0;i<pixels.length;i+=4){const d=Math.hypot(pixels[i],pixels[i+1],pixels[i+2]);total+=d;max=Math.max(max,d);finite&&=Number.isFinite(d);}
      return {mean:total/(side*side),max,finite};
    },
    dispose() { metadata.dispose(); gpu.dispose(); },
  };
}

export const PARTICLE_OFFSET = 'attribute vec2 aPhysicsUv; uniform sampler2D uOffset;';
