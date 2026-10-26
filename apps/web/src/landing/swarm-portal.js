import * as THREE from 'three';
import {createParticlePhysics, PARTICLE_OFFSET} from './particle-physics.js';
import {SWARM_LIGHT_GLSL} from '../scene/swarm-style.js';
import {buildSwarmGate} from '../scene/swarm-gate.js';

/** The lab's three populations: a cyan murmuration, amber agents held at the rim, and rejected red sparks. */
export function buildSwarmPortal({renderer, radius, small, time, alert, pointer, interactive = true, random = Math.random}) {
  const group = new THREE.Group();
  const gateway=buildSwarmGate(radius,{organic:true});group.add(gateway.group);
  const side = small ? 128 : 256, count = side * side;
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = random();
  const uniforms = {uTime: time, uAlert: alert, uRadius: {value: radius}, uPx: {value: 1}, uCenter: {value: new THREE.Vector3()}, uScale: {value: 1}, uVisibility: {value: 1}};
  const path = `uniform float uTime,uAlert,uRadius,uScale;uniform vec3 uCenter;${SWARM_LIGHT_GLSL}
    vec3 portalAt(vec4 seed,out vec3 color,out float alpha){
      float phase=fract(seed.x+uTime*(0.045+seed.w*0.018));
      float angle=seed.y*6.2831853+uTime*(0.24+seed.w*0.18);
      vec3 p;
      color=swarmLight(seed.w);
      alpha=0.55+seed.w*0.4;
      if(seed.z<0.3){
        // Filled, snaking flow through the aperture. No hollow central ring.
        float z=mix(0.7,-1.15,phase);
        float pinch=mix(0.025,0.7,smoothstep(0.0,0.9,abs(z)));
        float r=pow(seed.z/0.3,0.6)*pinch;
        angle+=z*4.0;
        p=vec3(cos(angle)*r,sin(angle)*r*0.8,z);
        p.x+=sin(z*3.0+uTime*0.3)*0.17*smoothstep(0.0,0.5,abs(z));
        p.y+=cos(z*2.0+uTime*0.25)*0.08*smoothstep(0.0,0.5,abs(z));
        if(z<0.0)color=mix(vec3(0.15,1.0,0.6),vec3(0.2,0.85,1.0),seed.w);
        alpha*=0.48*smoothstep(0.0,0.1,phase)*(1.0-smoothstep(0.85,1.0,phase));
      }else{
        // A thick, volumetric swarm carries the entire boundary, rather than fixed torus meshes.
        float q=(seed.z-0.3)/0.7;
        float band=(q-0.5)*0.14;
        float flare=pow(0.5+0.5*sin(angle*17.0-uTime*0.85),7.0);
        float r=1.16+band+sin(angle*5.0-uTime*0.4)*0.018;
        r+=sin(angle*11.0+seed.w*6.28+uTime*0.6)*0.008+flare*0.045;
        color=mix(vec3(1.0,.65,.15)*1.2,vec3(1.0,.94,.64),seed.w)*1.55;
        if(seed.z>0.82){float spark=fract(seed.x+uTime*0.13);r+=spark*(0.035+flare*0.06);alpha*=1.0-spark;}
        p=vec3(cos(angle)*r,sin(angle)*r,(seed.w-0.5)*0.16+sin(angle*3.0+uTime*0.2)*0.035);
        alpha*=0.55+0.55*exp(-band*band*180.0);
        alpha*=1.0+flare*0.65;
        if(seed.z>0.985){
          float burst=fract(seed.x+uTime*0.18);
          p.xy*=1.0+burst*0.07;p.z+=burst*0.15;
          color=vec3(1.0,0.18,0.25);alpha*=1.0-burst;
        }
      }
      float reject=uAlert*step(0.32,seed.w);
      p.xy*=1.0+reject*phase*0.9;
      p.z=mix(p.z,abs(p.z)+phase*1.8,reject);
      color=mix(color,vec3(1.0,0.1,0.18)*1.5,uAlert);
      return p*uRadius;
    }
    vec3 restPosition(vec4 seed){vec3 col;float alpha;return portalAt(seed,col,alpha)*uScale+uCenter;}`;
  const physics=createParticlePhysics(renderer,{side,seeds,restShader:path,uniforms,pointer,interactive});
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3));
  geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,4));
  geometry.setAttribute('aPhysicsUv',new THREE.BufferAttribute(physics.uv,2));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{...uniforms,uOffset:physics.texture},
    vertexShader:`attribute vec4 aSeed;uniform float uPx,uVisibility;varying vec3 vColor;varying float vAlpha;${PARTICLE_OFFSET}${path}
      void main(){vec3 p=portalAt(aSeed,vColor,vAlpha);vAlpha*=uVisibility;
        p+=texture2D(uOffset,aPhysicsUv).xyz/uScale;vec4 mv=modelViewMatrix*vec4(p,1.0);
        gl_PointSize=clamp((1.3+aSeed.w*2.2)*mix(1.0,1.45,step(.3,aSeed.z))*uPx*110.0/max(1.0,-mv.z),1.0,7.0*uPx);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`varying vec3 vColor;varying float vAlpha;void main(){float r=length(gl_PointCoord-0.5)*2.0;if(r>1.0)discard;
      float core=exp(-r*r*4.0);gl_FragColor=vec4(vColor*1.65,core*vAlpha);}`});
  const points=new THREE.Points(geometry,material);points.renderOrder=3;points.frustumCulled=false;group.add(points);
  // The shutter exists only during revocation; the open portal is made entirely of particles.
  const shutterMaterial=new THREE.MeshStandardMaterial({color:0x192b34,metalness:0.7,roughness:0.3});
  const shape=new THREE.Shape();shape.moveTo(-radius*0.28,0);shape.lineTo(radius*0.28,0);shape.lineTo(radius*0.1,-radius*1.05);shape.closePath();
  const blades=Array.from({length:12},(_,i)=>{const angle=i/12*Math.PI*2,pivot=new THREE.Group();
    pivot.position.set(Math.cos(angle)*radius*0.94,Math.sin(angle)*radius*0.94,radius*0.02+i*0.001);pivot.rotation.z=angle-Math.PI/2;
    pivot.add(new THREE.Mesh(new THREE.ShapeGeometry(shape),shutterMaterial));group.add(pivot);return pivot;});
  return {group,physics,boundary:gateway.group,outerRadius:radius*1.4,
    update(t,pixelRatio,lock,dt,visibility=1){
      uniforms.uVisibility.value=visibility;uniforms.uPx.value=pixelRatio;uniforms.uScale.value=group.scale.x;uniforms.uCenter.value.copy(group.position);
      gateway.update(t,lock,visibility);
      blades.forEach(blade=>{blade.visible=lock>0.01;blade.children[0].scale.y=Math.max(0.0001,lock);});
      physics.update(dt);
    },
    dispose(){physics.dispose();},
  };
}
