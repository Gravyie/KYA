import * as THREE from 'three';
import {NEON} from './base.js';

/** The actual Swarm lab gateway, scaled in world units for either scene. */
export function buildSwarmGate(radius=7.6,{organic=false}={}){
 if(organic)return buildOrganicGate(radius);
 const scale=radius/7.6,group=new THREE.Group(),red=new THREE.Color(NEON.red),cyan=new THREE.Color(NEON.cyan);
 const coreMaterial=new THREE.MeshBasicMaterial({color:cyan.clone().multiplyScalar(2.2),toneMapped:false,transparent:true,opacity:1});
 group.add(new THREE.Mesh(new THREE.TorusGeometry(radius,.18*scale,12,200),coreMaterial));
 const outerMaterial=new THREE.MeshBasicMaterial({color:new THREE.Color(NEON.mag).multiplyScalar(2),toneMapped:false,transparent:true,opacity:1});
 group.add(new THREE.Mesh(new THREE.TorusGeometry(8.4*scale,.04*scale,6,200),outerMaterial));
 const tickMaterial=new THREE.MeshBasicMaterial({color:cyan.clone().multiplyScalar(1.6),toneMapped:false,transparent:true,opacity:1});
 const ticks=new THREE.InstancedMesh(new THREE.BoxGeometry(.06*scale,.6*scale,.06*scale),tickMaterial,120),marker=new THREE.Object3D();
 for(let i=0;i<120;i++){const a=i/120*Math.PI*2;marker.position.set(Math.cos(a)*9.2*scale,Math.sin(a)*9.2*scale,0);marker.rotation.z=a-Math.PI/2;marker.scale.set(1,i%10===0?2:1,1);marker.updateMatrix();ticks.setMatrixAt(i,marker.matrix);}group.add(ticks);
 const fieldMaterial=new THREE.MeshBasicMaterial({color:cyan.clone().multiplyScalar(.12),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
 group.add(new THREE.Mesh(new THREE.CircleGeometry(7.5*scale,96),fieldMaterial));
 group.traverse(o=>{if(o.isMesh)o.renderOrder=3;});
 return {group,outerRadius:9.8*scale,update(time,lock=0,visibility=1){coreMaterial.color.copy(cyan).lerp(red,lock).multiplyScalar(2.2+lock*Math.max(0,Math.sin(time*9))*1.5);ticks.rotation.z=time*.1;group.rotation.z=Math.sin(time*.3)*.05;for(const m of [coreMaterial,outerMaterial,tickMaterial,fieldMaterial])m.opacity=visibility;}};
}

/** Landing variant: the lab's light palette, carried by soft, turbulent filaments. */
function buildOrganicGate(radius){
 const group=new THREE.Group(),uniforms={uTime:{value:0},uLock:{value:0},uVisibility:{value:1}};
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms,
  vertexShader:'varying vec2 vP;void main(){vP=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:`varying vec2 vP;uniform float uTime,uLock,uVisibility;
   void main(){float r=length(vP),a=atan(vP.y,vP.x);
    float turbulence=sin(a*7.0+uTime*.35)*.004+sin(a*23.0-uTime*.6)*.0025+sin(a*53.0+uTime)*.0015;
    float filament=exp(-pow((r-1.0-turbulence)/.0075,2.0));
    float wisps=exp(-pow((r-1.0-turbulence)/.030,2.0));
    float pulse=.65+.35*sin(a*19.0+uTime*.7)*sin(a*11.0-uTime*.3);
    float rose=exp(-pow((r-1.09-turbulence*2.0)/.006,2.0));
    rose*=pow(.5+.5*sin(a*5.0-uTime*.25),2.0)*(.4+.6*pow(.5+.5*sin(a*31.0+uTime*.4),2.0));
    vec3 cyan=mix(vec3(.20,.80,1.0),vec3(.75,.92,1.0),filament)*2.8;
    vec3 col=cyan*(filament*.7+wisps*.48)*pulse+vec3(1.0,.25,.55)*rose*.65;
    col=mix(col,vec3(1.0,.10,.18)*(filament+wisps*.3),uLock);
    float alpha=max((filament*.8+wisps*.5)*pulse,rose*.45)*uVisibility;
    gl_FragColor=vec4(col,alpha);
   }`});
 const geometry=new THREE.RingGeometry(.90,1.14,512,6),filaments=new THREE.Mesh(geometry,material);filaments.scale.setScalar(radius);filaments.renderOrder=3;group.add(filaments);
 // Irregular, tapered flares replace the evenly spaced solid ruler marks.
 const vertices=[],strength=[];
 for(let i=0;i<176;i++){
  const a=i/176*Math.PI*2,jitter=Math.sin(i*13.7),start=1.135+jitter*.014,length=.014+(.5+.5*Math.sin(i*19.3))**4*.085,w=.0008;
  const pts=[[a-w,start],[a+w,start],[a,start+length]];
  for(const [angle,r]of pts){vertices.push(Math.cos(angle)*r*radius,Math.sin(angle)*r*radius,0);strength.push(r>start+.001?0:.3+.7*(.5+.5*Math.sin(i*7.3)));}
 }
 const sparks=new THREE.BufferGeometry();sparks.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));sparks.setAttribute('aStrength',new THREE.Float32BufferAttribute(strength,1));
 const sparkMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms,
  vertexShader:'attribute float aStrength;varying float vStrength;varying float vAngle;void main(){vStrength=aStrength;vAngle=atan(position.y,position.x);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'varying float vStrength,vAngle;uniform float uTime,uLock,uVisibility;void main(){float a=vStrength*(.4+.6*pow(.5+.5*sin(vAngle*13.0-uTime),2.0))*uVisibility;gl_FragColor=vec4(mix(vec3(.65,.86,1.0)*2.0,vec3(1.0,.15,.2),uLock),a);}'});
 const flares=new THREE.Mesh(sparks,sparkMat);flares.renderOrder=3;group.add(flares);
 return {group,outerRadius:radius*1.4,update(time,lock=0,visibility=1){uniforms.uTime.value=time;uniforms.uLock.value=lock;uniforms.uVisibility.value=visibility;}};
}
