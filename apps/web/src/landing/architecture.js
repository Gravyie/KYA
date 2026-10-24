import * as THREE from 'three';
import {fontsReady} from '../scene/base.js';
import {SUN_GLSL} from './sunset.js';

/** Concrete, recessed glazing and brass shop fixtures share the sunset's light direction. */
export function facadeMaterial(time,alert,paletteUniforms={}){return new THREE.ShaderMaterial({uniforms:{uTime:time,uAlert:alert,...paletteUniforms},
 vertexShader:`attribute vec3 aDim;attribute float aSeed;varying vec3 vP,vW,vN,vDim;varying float vSeed,vDepth;void main(){vP=position*aDim;vDim=aDim;vSeed=aSeed;vN=normal;vec4 w=modelMatrix*instanceMatrix*vec4(position,1.0);vW=w.xyz;vec4 mv=viewMatrix*w;vDepth=-mv.z;gl_Position=projectionMatrix*mv;}`,
 fragmentShader:`varying vec3 vP,vW,vN,vDim;varying float vSeed,vDepth;uniform float uTime,uAlert,uNight;uniform vec3 uAccent,uSecondary,uFog;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 void main(){bool side=abs(vN.x)>.5;float u=side?vP.z:vP.x;float v=vW.y;
 vec2 cell=floor(vec2(u/1.65,v/2.5)),f=fract(vec2(u/1.65,v/2.5));
 float pane=smoothstep(.15,.19,f.x)*(1.0-smoothstep(.79,.83,f.x))*smoothstep(.21,.25,f.y)*(1.0-smoothstep(.79,.83,f.y));pane*=1.0-step(.5,abs(vN.y));
 vec3 stone=mix(vec3(.095,.125,.15),vec3(.29,.245,.195),step(.5,vSeed));stone*=.9+.1*hash(floor(vW.xz*4.0)+floor(v*7.0));
 vec3 n=normalize(vN),sun=${SUN_GLSL};float lit=max(0.0,dot(n,sun));
 vec3 facade=stone*(vec3(.45,.53,.64)+vec3(1.1,.52,.20)*lit)*mix(1.0,.24,uNight);
 float sill=exp(-pow((f.y-.17)*45.0,2.0));facade*=1.0-sill*.45;
 float mullion=1.0-smoothstep(.012,.035,abs(f.x-.5));
 vec3 view=normalize(cameraPosition-vW),reflected=reflect(-view,n);
 float gold=pow(max(dot(reflected,sun),0.0),45.0);
 float sky=clamp(reflected.y*.5+.5,0.0,1.0);
 vec3 glass=mix(vec3(.055,.075,.095),vec3(.25,.17,.12),sky);
 glass+=vec3(1.0,.58,.26)*gold*1.1;
 float on=step(.76,hash(cell+vSeed*71.0));vec3 interior=mix(vec3(.73,.42,.17),mix(uAccent,uSecondary,step(.55,vSeed)),uNight*.75);
 glass=mix(glass*mix(1.0,.25,uNight),interior*(.35+.4*hash(cell.yx)),on*.85);
 glass*=1.0-mullion*.48;
 vec3 col=mix(facade,glass,pane);
 float bay=step(.91,fract((u+vSeed*12.0)/7.0));col*=1.0-bay*.2;
 float edge=step((side?vDim.z:vDim.x)*.5-.055,abs(u))*(1.0-step(.5,abs(vN.y)));
 float crown=step(vDim.y*.5-.12,vP.y);col+=mix(uAccent,uSecondary,step(.5,vSeed))*uNight*(edge*.65+crown*.4);
 float fog=1.0-exp(-max(vDepth,0.0)*.0017);col=mix(col,uFog,fog*.7);
 col=mix(col,vec3(.4,.03,.04),uAlert*.4);gl_FragColor=vec4(col,1.0);
 }`});}

export function shopSign(word,height=6,index=0){
 const canvas=document.createElement('canvas');canvas.width=192;canvas.height=640;const c=canvas.getContext('2d');
 const colors=['#24443f','#632f2a','#353c4a','#716049'];
 c.fillStyle=colors[index%4];c.fillRect(0,0,192,640);
 c.strokeStyle='#aa9574';c.lineWidth=5;c.strokeRect(10,10,172,620);
 c.fillStyle='#e4d5b5';c.textAlign='center';c.textBaseline='middle';c.font='500 100px "Noto Sans JP Variable"';
 [...word].forEach((ch,i)=>c.fillText(ch,96,140+i*130));
 c.font='22px "Geist Mono Variable"';c.fillText('EST. 1986',96,587);
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
 const group=new THREE.Group(),w=height*.3;
 const frame=new THREE.Mesh(new THREE.BoxGeometry(w+.12,height+.12,.26),new THREE.MeshStandardMaterial({color:0x403a30,metalness:.65,roughness:.4}));group.add(frame);
 const face=new THREE.Mesh(new THREE.PlaneGeometry(w,height),new THREE.MeshStandardMaterial({map:tex,emissive:0xffffff,emissiveMap:tex,emissiveIntensity:.15,roughness:.7}));face.position.z=.141;group.add(face);
 const metal=new THREE.MeshStandardMaterial({color:0x414244,metalness:.65,roughness:.55});
 for(const y of [-height*.33,height*.33]){const bracket=new THREE.Mesh(new THREE.BoxGeometry(.16,.13,.7),metal);bracket.position.set(-w*.38,y,-.25);group.add(bracket);}
 return group;
}

export function cityDetails(lots,small){
 const group=new THREE.Group(),parts=[];const add=(x,y,z,w,h,d)=>parts.push([x,y,z,w,h,d]);
 lots.forEach((l,i)=>{
  add(l.x,l.h+.6,l.z,l.w,.8,l.d);
  for(const sx of [-1,1])add(l.x+sx*(l.w/2-.25),l.h+1.3,l.z,.35,1.1,l.d);
  for(const sz of [-1,1])add(l.x,l.h+1.3,l.z+sz*(l.d/2-.25),l.w,1.1,.35);
  add(l.x+1,l.h+2,l.z-1,l.w*.3,2,l.d*.3);
  if(i%3===0)add(l.x-l.w*.25,l.h+3.3,l.z+2,.3,4.5,.3);
  // Recessed building entrances and a sheltered ground-floor arcade.
  add(l.x,3.4,l.z+l.d/2+1,l.w+1,.3,2.7);
  for(const sx of [-1,1])add(l.x+sx*l.w*.4,1.8,l.z+l.d/2+1,.3,3.6,.3);
 });
 const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0x555851,metalness:.25,roughness:.72}),parts.length),o=new THREE.Object3D();
 parts.forEach((p,i)=>{o.position.set(...p.slice(0,3));o.scale.set(...p.slice(3));o.updateMatrix();mesh.setMatrixAt(i,o.matrix);});group.add(mesh);
 let disposed=false;fontsReady().then(()=>{if(disposed)return;
 const selected=lots.filter(l=>Math.abs(l.x)<165).filter((_,i)=>i%2===0).slice(0,small?16:32);
 selected.forEach((l,i)=>{const sign=shopSign(['喫茶','書店','珈琲','食堂','花屋','旅館'][i%6],Math.min(8,l.h*.26),i);sign.position.set(l.x+l.w*.28,l.h*.42,l.z+l.d/2+.4);group.add(sign);});});
 return {group,dispose(){disposed=true;}};
}
