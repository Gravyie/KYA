import * as THREE from 'three';
import {seededRandom} from './world-layout.js';
import {buildRailings} from './landscape-edges.js';

/** A riverside promenade and garden loop. Branching trees use individual leaves, with no solid canopy primitives. */
export function buildRiverPark({small,time,waterMaterial}){
 const group=new THREE.Group(),random=seededRandom(6741),rnd=(a=0,b=1)=>a+(b-a)*random();
 // Three garden rooms: arrival court, open meadow, and a wetland pond.
 // Paths are real geometry with stone edging; furniture and trees follow their routes.
 const lawnMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1});
 lawnMat.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 vGarden;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvGarden=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader='varying vec3 vGarden;float gardenHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+`
   vec2 p=vGarden.xz;vec2 q=(p-vec2(69.0,-95.0))/vec2(12.0,27.0);float a=atan(q.y,q.x);
   if(length(q)<1.0+.11*sin(a*3.0)+.07*cos(a*5.0))discard;
   float grain=gardenHash(floor(p*22.0)),mow=smoothstep(.3,.7,fract((p.y+p.x*.3)*.17));
   vec3 grass=mix(vec3(.028,.082,.021),vec3(.080,.16,.035),.45+.12*sin(p.x*.17+p.y*.031)+mow*.13);
   grass*=.85+grain*.3;
   diffuseColor.rgb*=grass;
  `);
 };
 const lawn=new THREE.Mesh(new THREE.PlaneGeometry(79,310),lawnMat);lawn.rotation.x=-Math.PI/2;lawn.position.set(57.5,.25,-50);lawn.receiveShadow=true;group.add(lawn);
 const o=new THREE.Object3D(),parts=[],branches=[],leafData=[];
 const box=(x,y,z,w,h,d,k=0,ry=0)=>parts.push({x,y,z,w,h,d,k,ry});
 box(57.5,-.85,-50,79,2,310);box(18,.05,-50,1,1.2,310);box(96,.05,-50,1,1.2,310);
 const boundary=buildRailings([[[18,.3,105],[18,.3,-195]],[[28,.3,-203],[96,.3,-203]],[[96,.3,-203],[96,.3,105]]]);group.add(boundary);
 const paving=new THREE.MeshStandardMaterial({color:0xaca590,roughness:.93}),edging=new THREE.MeshStandardMaterial({color:0x696b5c,roughness:.95}),gravel=new THREE.MeshStandardMaterial({color:0x8a8675,roughness:1});
 paving.onBeforeCompile=shader=>{shader.vertexShader='varying vec2 vWalk;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWalk=uv;');shader.fragmentShader='varying vec2 vWalk;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat joint=step(.972,fract(vWalk.y*1.3));float fleck=fract(sin(dot(floor(vWalk*vec2(100.0,30.0)),vec2(18.3,71.7)))*417.2);diffuseColor.rgb*=(.88+fleck*.18)*(1.0-joint*.12);');};
 function route(points,width,{closed=false,material=paving,y=.29,edge=true}={}){
  const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,y,z)),closed,'catmullrom',.35),length=curve.getLength(),steps=Math.ceil(length*1.5),pos=[],uv=[],indices=[];
  for(let i=0;i<=steps;i++){const t=i/steps,p=curve.getPointAt(t),dir=curve.getTangentAt(t),nx=-dir.z,nz=dir.x;for(const side of [-1,1]){pos.push(p.x+nx*width*.5*side,y,p.z+nz*width*.5*side);uv.push((side+1)*.5,t*length);}if(i<steps){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,material);mesh.receiveShadow=true;group.add(mesh);
  if(edge)for(const side of [-1,1]){const line=[];for(let i=0;i<=steps;i++){const t=i/steps,p=curve.getPointAt(t),dir=curve.getTangentAt(t);line.push(new THREE.Vector3(p.x-dir.z*(width*.5+.10)*side,y+.04,p.z+dir.x*(width*.5+.10)*side));}const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(line,false,'centripetal'),steps,.09,4,false);group.add(new THREE.Mesh(g,edging));}
  return curve;
 }
 route([[22,103],[22,55],[22,0],[22,-65],[22,-130],[22,-200]],4.2);
 const main=route([[52,102],[48,78],[43,46],[47,16],[59,-12],[52,-41],[46,-71],[46,-108],[52,-143],[57,-172],[56,-201]],3.1);
 route([[47,-48],[64,-56],[85,-68],[88,-97],[82,-126],[62,-133],[46,-114],[42,-83]],2.4,{closed:true});
 for(const points of [[[22,77],[35,77],[48,78]],[[22,12],[36,12],[47,16]],[[22,-65],[34,-65],[46,-71]],[[22,-168],[39,-168],[57,-172]],[[59,-12],[76,-6],[94,-5]],[[82,-126],[89,-140],[94,-154]]])route(points,2.5);
 // Circular arrival terrace, with a pergola and generous seating facing the meadow.
 function disc(x,z,rx,rz,material,y=.3){const m=new THREE.Mesh(new THREE.CircleGeometry(1,80),material);m.rotation.x=-Math.PI/2;m.scale.set(rx,rz,1);m.position.set(x,y,z);m.receiveShadow=true;group.add(m);return m;}
 disc(48,77,11,12,edging);disc(48,77,10.4,11.4,paving,.32);
 disc(57,-171,10,12,edging);disc(57,-171,9.6,11.6,gravel,.32);
 // Raked gravel rings surround a sculptural boulder in the quiet south garden.
 for(let i=0;i<8;i++){const ring=new THREE.Mesh(new THREE.RingGeometry(2.5+i*.65,2.54+i*.65,80),edging);ring.rotation.x=-Math.PI/2;ring.position.set(58,.34,-171);group.add(ring);}
 for(const x of [39,49])for(const z of [73,82])box(x,2,z,.25,3.5,.25,2);
 for(const z of [73,82])box(44,3.9,z,11,.3,.3,2);
 for(let i=0;i<15;i++)box(38.6+i*.78,4.1,77.5,.16,.22,10.5,2);
 function bench(x,z,angle=0){
  const add=(w,h,d,px,py,pz,k)=>box(x+px*Math.cos(angle)+pz*Math.sin(angle),py+.27,z-px*Math.sin(angle)+pz*Math.cos(angle),w,h,d,k,angle);
  for(let j=0;j<5;j++)add(3.2,.11,.13,0,.76,-.36+j*.17,2);
  for(let j=0;j<3;j++)add(3.2,.14,.1,0,1.05+j*.2,.44,2);
  for(const side of [-1,1]){add(.12,.65,.7,side*1.2,.47,0,0);add(.12,.16,.8,side*1.45,1.06,0,0);}
 }
 for(const [x,z,a]of [[36,77,Math.PI/2],[49,86,0],[25.5,46,-Math.PI/2],[25.5,-25,-Math.PI/2],[48,-47,2.5],[87,-85,Math.PI/2],[79,-131,0],[45,-166,-Math.PI/2],[58,-185,0],[76,-7,0]])bench(x,z,a);
 // A kidney-shaped pond has stone banks, a timber viewing deck and wetland planting.
 const pondShape=new THREE.Shape(),pondEdge=[];
 for(let i=0;i<=100;i++){const a=i/100*Math.PI*2,r=1+.11*Math.sin(a*3)+.07*Math.cos(a*5),x=69+Math.cos(a)*12*r,z=-95+Math.sin(a)*27*r;pondEdge.push([x,z]);if(i===0)pondShape.moveTo(x,-z);else pondShape.lineTo(x,-z);}
 const pond=new THREE.Mesh(new THREE.ShapeGeometry(pondShape),waterMaterial.clone());pond.rotation.x=-Math.PI/2;pond.position.y=.24;pond.renderOrder=1;group.add(pond);
 const rockGeo=new THREE.DodecahedronGeometry(1,1),rockMat=new THREE.MeshStandardMaterial({color:0x73796b,roughness:1}),rocks=new THREE.InstancedMesh(rockGeo,rockMat,104);
 for(let i=0;i<104;i++){const a=i/100*Math.PI*2,r=1+.11*Math.sin(a*3)+.07*Math.cos(a*5);o.position.set(i<100?69+Math.cos(a)*12.5*r:58+rnd(-2,2),i<100?.4:1.1,i<100?-95+Math.sin(a)*27.5*r:-171+rnd(-2,2));o.scale.set(i<100?rnd(.35,.85):1.8,i<100?rnd(.3,.7):1.5,i<100?rnd(.5,1.1):1.4);o.rotation.set(rnd(0,3),rnd(0,6),rnd(0,2));o.updateMatrix();rocks.setMatrixAt(i,o.matrix);}rocks.castShadow=true;group.add(rocks);
 // Boardwalk slats and a low handrail make the water edge an actual destination.
 for(let i=0;i<32;i++)box(54.5,.55,-85-i*.31,7,.16,.27,2);
 for(const z of [-85,-94.6]){box(51.1,1.1,z,.13,1.4,.13,0);box(58,1.1,z,.13,1.4,.13,0);box(54.5,1.7,z,7,.1,.12,2);}
 route([[46,-89],[50,-89],[54,-89]],2.2,{material:gravel});
 // Lamps, litter bins and planted edges are placed at path junctions, not randomly on the lawn.
 for(let i=0;i<17;i++){const p=main.getPointAt(i/16);box(p.x+2.3,.9,p.z,.10,1.2,.10,0);box(p.x+2.3,1.55,p.z,.30,.16,.30,3);}
 for(const [x,z]of [[26,76],[26,12],[50,-46],[49,-164]]){box(x,.75,z,.7,1,.7,0);box(x,1.28,z,.76,.08,.76,2);}
 const beds=[{x:33,z:51,rx:4.5,rz:13},{x:83,z:40,rx:8,rz:24},{x:86,z:-43,rx:5,rz:11},{x:69,z:-148,rx:10,rz:4.5},{x:37,z:-136,rx:5,rz:16},{x:74,z:87,rx:13,rz:5}];
 const mulch=new THREE.MeshStandardMaterial({color:0x28291c,roughness:1});for(const bed of beds)disc(bed.x,bed.z,bed.rx,bed.rz,mulch,.28);
 const shrubs=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:0xffffff,roughness:1}),small?280:650),shrubColor=new THREE.Color();
 for(let i=0;i<shrubs.count;i++){const bed=beds[i%beds.length],a=rnd(0,Math.PI*2),r=Math.sqrt(random());o.position.set(bed.x+Math.cos(a)*bed.rx*r,rnd(.55,.9),bed.z+Math.sin(a)*bed.rz*r);o.scale.set(rnd(.35,.8),rnd(.3,.6),rnd(.35,.8));o.rotation.set(rnd(0,2),rnd(0,6),rnd(0,2));o.updateMatrix();shrubs.setMatrixAt(i,o.matrix);shrubColor.setHSL(i%5===0?.10:.24,rnd(.25,.5),rnd(.11,.21));shrubs.setColorAt(i,shrubColor);}group.add(shrubs);
 // Reeds, flowering perennials and meadow blades add a second scale of detail.
 const grassPos=[],grassColors=[];
 for(let i=0;i<(small?1700:4800);i++){
  const wet=i%3===0,bed=beds[i%beds.length],a=rnd(0,Math.PI*2),r=Math.sqrt(random()),edge=1+.11*Math.sin(a*3)+.07*Math.cos(a*5);
  const x=wet?69+Math.cos(a)*12.7*edge:bed.x+Math.cos(a)*bed.rx*r,z=wet?-95+Math.sin(a)*27.7*edge:bed.z+Math.sin(a)*bed.rz*r,h=wet?rnd(.5,1.4):rnd(.15,.65),w=.035;
  for(const sign of [-1,1]){grassPos.push(x-w,.3,z,x+w,.3,z,x+sign*.16,.3+h,z+.04);const c=wet?[.14,.24,.07]:[.21,.29,.09];for(let j=0;j<3;j++)grassColors.push(...c);}
 }
 const grassGeo=new THREE.BufferGeometry();grassGeo.setAttribute('position',new THREE.Float32BufferAttribute(grassPos,3));grassGeo.setAttribute('color',new THREE.Float32BufferAttribute(grassColors,3));grassGeo.computeVertexNormals();group.add(new THREE.Mesh(grassGeo,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1})));
 const positions=[[31,98],[33,86],[34,61],[31,38],[33,28],[35,0],[30,-18],[31,-40],[34,-53],[32,-92],[32,-116],[32,-151],[34,-188],[43,-193],[68,-188],[82,-181],[86,-164],[86,-143],[88,-119],[88,-104],[88,-75],[86,-55],[86,-26],[84,-15],[87,17],[87,33],[85,57],[82,72],[88,94],[62,94],[68,98],[75,96],[40,97],[63,55],[69,50],[73,59],[66,39],[74,33],[66,28],[79,24],[69,-35],[76,-33],[77,-48],[38,-177],[77,-171],[71,-181],[84,-193],[43,-155]];
 function branch(a,b,r0,r1){branches.push({a:a.clone(),b:b.clone(),r0,r1});}
 function foliage(center,spread,species){
  const count=small?44:90;
  for(let j=0;j<count;j++){
   // A triangular distribution produces irregular, open sprays around the actual twigs.
   const p=center.clone().add(new THREE.Vector3((random()+random()+random()-1.5)*spread,(random()+random()-1)*spread*.7,(random()+random()+random()-1.5)*spread));
   leafData.push({p,scale:rnd(.65,1.4),a:rnd(0,Math.PI*2),b:rnd(-1.1,1.1),c:rnd(0,1),species});
  }
 }
 positions.slice(0,small?32:positions.length).forEach(([x,z],i)=>{
  const base=new THREE.Vector3(x,.25,z),h=rnd(7.5,12.5),species=i%3;
  const fork=base.clone().add(new THREE.Vector3(rnd(-.5,.5),h*.52,rnd(-.5,.5)));
  branch(base,fork,.23+rnd(0,.08),.12);
  for(let arm=0;arm<5;arm++){
   const a=arm*2.399+i*.7,reach=rnd(3.0,4.6),middle=fork.clone().add(new THREE.Vector3(Math.cos(a)*reach*.6,h*.18,Math.sin(a)*reach*.6));
   const tip=middle.clone().add(new THREE.Vector3(Math.cos(a)*reach*.5,h*rnd(.12,.3),Math.sin(a)*reach*.5));
   branch(fork,middle,.11,.065);branch(middle,tip,.065,.025);
   for(let twig=0;twig<4;twig++){
    const ang=a+(twig-1.5)*.72,end=tip.clone().add(new THREE.Vector3(Math.cos(ang)*rnd(.6,1.5),rnd(.2,1.25),Math.sin(ang)*rnd(.6,1.5)));
    branch(tip,end,.026,.008);foliage(end,rnd(1.5,2.2),species);
   }
  }
 });
 const bark=new THREE.MeshStandardMaterial({color:0x51432e,roughness:1});
 const wood=new THREE.InstancedMesh(new THREE.CylinderGeometry(.55,1,1,6),bark,branches.length),up=new THREE.Vector3(0,1,0);
 branches.forEach((p,i)=>{const direction=p.b.clone().sub(p.a),length=direction.length();o.position.copy(p.a).add(p.b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(up,direction.normalize());o.scale.set(p.r0,length,p.r0);o.updateMatrix();wood.setMatrixAt(i,o.matrix);});wood.castShadow=true;group.add(wood);
 const canvas=document.createElement('canvas');canvas.width=64;canvas.height=32;const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.beginPath();ctx.moveTo(1,17);ctx.bezierCurveTo(22,-2,45,3,63,15);ctx.bezierCurveTo(41,31,21,32,1,17);ctx.fill();ctx.strokeStyle='#a7b79b';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(2,17);ctx.lineTo(62,15);ctx.stroke();
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
 const leafMaterial=new THREE.MeshStandardMaterial({map:tex,alphaTest:.45,side:THREE.DoubleSide,roughness:.95});
 leafMaterial.onBeforeCompile=shader=>{shader.uniforms.uGardenTime=time;shader.vertexShader='uniform float uGardenTime;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=sin(uGardenTime*.8+instanceMatrix[3].x*.21+instanceMatrix[3].z*.16)*.045;');};
 const leaves=new THREE.InstancedMesh(new THREE.PlaneGeometry(.85,.36),leafMaterial,leafData.length),color=new THREE.Color();
 leafData.forEach((p,i)=>{o.position.copy(p.p);o.rotation.set(p.b,p.a,p.a*.6);o.scale.setScalar(p.scale);o.updateMatrix();leaves.setMatrixAt(i,o.matrix);color.setHSL(.20+p.species*.025,.40+p.c*.12,.12+p.c*.13);leaves.setColorAt(i,color);});leaves.castShadow=true;group.add(leaves);
 const mats=[new THREE.MeshStandardMaterial({color:0x4f5b50,roughness:.95}),new THREE.MeshStandardMaterial({color:0x9b947d,roughness:.9}),new THREE.MeshStandardMaterial({color:0x57422d,roughness:.85}),new THREE.MeshStandardMaterial({color:0xffd297,emissive:0xffb668,emissiveIntensity:.65})];
 for(let k=0;k<mats.length;k++){const list=parts.filter(p=>p.k===k),mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mats[k],list.length);list.forEach((p,i)=>{o.position.set(p.x,p.y,p.z);o.rotation.set(0,p.ry||0,0);o.scale.set(p.w,p.h,p.d);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);});mesh.receiveShadow=true;group.add(mesh);}
 // Discreet human-scale figures on the paths make the garden read as a place to use.
 const visitorMats=[new THREE.MeshStandardMaterial({color:0x343e45}),new THREE.MeshStandardMaterial({color:0x9b7163}),new THREE.MeshStandardMaterial({color:0xc5b68e})],skin=new THREE.MeshStandardMaterial({color:0xa88770});
 for(let i=0;i<(small?4:9);i++){const p=main.getPointAt(.07+i*.105),person=new THREE.Group();const body=new THREE.Mesh(new THREE.CylinderGeometry(.18,.22,.65,6),visitorMats[i%3]);body.position.y=1.05;const head=new THREE.Mesh(new THREE.SphereGeometry(.14,8,6),skin);head.position.y=1.55;person.add(body,head);for(const side of [-1,1]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.065,.075,.70,5),visitorMats[0]);leg.position.set(side*.10,.43,side*.06);person.add(leg);}person.rotation.y=i*1.9;person.position.copy(p);person.position.x+=i%2?.55:-.55;group.add(person);}
 group.userData={treeCount:Math.min(positions.length,small?32:positions.length),branches:branches.length,leaves:leafData.length,boundaryPosts:boundary.userData.posts,paths:9,pond:true,pergola:true,benches:10};
 return group;
}
