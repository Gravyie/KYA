import * as THREE from 'three';
import {fontsReady} from '../scene/base.js';
import {shopSign} from './architecture.js';
import {buildRiverPark} from './river-park.js';
import {SUN_GLSL} from './sunset.js';

/** A continuous waterfront: illuminated city quays give way to a low shrine village and an open bay. */
export function buildWaterfront({time, alert, small,paletteUniforms}) {
  const group = new THREE.Group(), props = new THREE.Group();group.add(props);
  const dusk = {value: 1};

  const waterMaterial = new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    uniforms:{uTime:time,uAlert:alert,uDusk:dusk,...paletteUniforms},
    vertexShader:`varying vec3 vW;void main(){vW=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.0);}`,
    fragmentShader:`varying vec3 vW;uniform float uTime,uAlert,uSolar,uNight;uniform vec3 uWater,uHorizon,uAccent,uSecondary;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){vec2 p=vW.xz;float t=uTime;
        float a=dot(p,vec2(.43,1.2))+t*.8,b=dot(p,vec2(-1.1,2.3))-t*.6,c=dot(p,vec2(2.4,1.7))+t*.5;
        float wave=sin(a)*.5+.5;
        float fine=(sin(b)*.5+.5)*(sin(c)*.5+.5);
        float ripple=pow(wave,8.0)*(.3+.7*fine);
        vec3 normal=normalize(vec3(-.035*(.43*cos(a)-.44*cos(b)+.72*cos(c)),1.0,-.035*(1.2*cos(a)+.92*cos(b)+.51*cos(c))));
        vec3 reflected=reflect(-normalize(cameraPosition-vW),normal);
        float fresnel=pow(1.0-max(0.0,dot(normal,normalize(cameraPosition-vW))),3.0);
        vec3 col=uWater*.65;
        col+=uHorizon*fresnel*.3;
        float horizon=exp(-abs(p.y+800.0)*.0025);
        col+=uHorizon*horizon*.12;
        // Broken, moving reflections from the signs on both riverbanks.
        float bank=mix(110.0,43.0,smoothstep(190.0,280.0,-p.y));
        float drift=sin(p.y*.8+t*.5)*1.4+sin(p.y*3.1-t*.3)*.35;
        float x=abs(p.x)+drift;
        float row=floor((-p.y+45.0)/24.0), hue=hash(vec2(row,sign(p.x)));
        vec3 neon=mix(vec3(.65,.32,.12),mix(uAccent,uSecondary,hue),uNight*.9);
        float reflection=exp(-pow((x-bank)*.045,2.0));
        col+=neon*reflection*(.025+ripple*.6)*(.3+.7*pow(sin(p.y*.13+row)*.5+.5,2.0));
        // Amber lantern reflections beside the torii and a long rose-gold sunset path.
        float lamps=exp(-pow((abs(p.x)-7.0)*.45,2.0))*smoothstep(210.0,280.0,-p.y)*(1.0-smoothstep(510.0,570.0,-p.y));
        col+=vec3(.9,.38,.09)*lamps*ripple*.55;
        float sun=exp(-pow((p.x+100.0)/38.0,2.0))*uSolar;
        col+=vec3(.8,.26,.12)*sun*ripple*.35;
        float glint=pow(max(0.0,dot(reflected,${SUN_GLSL})),180.0);
        col+=vec3(1.0,.58,.3)*glint*uSolar*.9;
        col+=vec3(.08,.2,.25)*pow(fine*wave,14.0)*.17;
        float rings=abs(length(p-vec2(0.0,-720.0))-100.0-sin(t*.4)*3.0);
        col+=vec3(.04,.5,.65)*exp(-rings*.5)*(.15+.4*ripple);
        float dist=length(vW-cameraPosition);col=mix(col,uWater+uHorizon*.08,1.0-exp(-dist*.0011));
        col=mix(col,vec3(col.r*1.9,.012,.025),uAlert*.6);
        float aperture=smoothstep(550.0,690.0,-p.y)*(1.0-smoothstep(85.0,155.0,abs(p.x)));
        gl_FragColor=vec4(col,.9*(1.0-aperture));
      }`});
  const park=buildRiverPark({small,time,waterMaterial});group.add(park);
  const water=new THREE.Mesh(new THREE.PlaneGeometry(1500,1600),waterMaterial);water.renderOrder=1;water.rotation.x=-Math.PI/2;water.position.set(0,-1.8,-480);group.add(water);

  // Geometry is batched by material; the village has actual depth, eaves, timber, glazing and quay walls.
  const mats={stone:new THREE.MeshStandardMaterial({color:0x70766e,roughness:.9}),wood:new THREE.MeshStandardMaterial({color:0x594632,roughness:.85}),roof:new THREE.MeshStandardMaterial({color:0x343c3b,metalness:.1,roughness:.8}),light:new THREE.MeshStandardMaterial({color:0xe8cb96,emissive:0xffbf70,emissiveIntensity:.35,roughness:.85}),cyan:new THREE.MeshStandardMaterial({color:0x676c55,metalness:.4,roughness:.7})};
  // Grain and mortar remain in world units, so a large wall does not become a stretched texture.
  for(const kind of ['stone','wood'])mats[kind].onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vSurface;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvec4 surface=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nsurface=instanceMatrix*surface;\n#endif\nvSurface=(modelMatrix*surface).xyz;');
    shader.fragmentShader='varying vec3 vSurface;\n'+shader.fragmentShader;
    const detail=kind==='wood'?`float grain=sin(vSurface.y*5.0+sin(vSurface.z*29.0+vSurface.x*23.0)*.9);float plank=step(.965,fract((vSurface.x+vSurface.z)*2.6));diffuseColor.rgb*=.85+.10*grain;diffuseColor.rgb*=1.0-plank*.45;`:`vec2 brick=vec2((vSurface.x+vSurface.z)/1.5,vSurface.y/.6);brick.x+=mod(floor(brick.y),2.0)*.5;vec2 f=fract(brick);float mortar=step(.96,f.x)+step(.91,f.y);float grit=fract(sin(dot(floor(vSurface.xz*30.0)+vSurface.y,vec2(31.7,78.3)))*437.2);diffuseColor.rgb*=(.82+grit*.18)*(1.0-mortar*.24);`;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+detail);
  };
  const batches=Object.fromEntries(Object.keys(mats).map(k=>[k,[]]));
  const box=(kind,x,y,z,w,h,d,rz=0)=>batches[kind].push({x,y,z,w,h,d,rz});
  const signs=[], roofPos=[], gablePos=[];
  for(const side of [-1,1]){
    // City canal embankments and narrow illuminated piers break up the hero's empty dark patch.
    box('stone',side*99,-3,-60,3,8,400);
    box('cyan',side*97.4,.5,-60,.14,.12,400);
    for(let i=0;i<15;i++){
      const z=100-i*24;
      box('stone',side*97.4,1.2,z,.25,2.4,.25);
      box('wood',side*97.4,1.9,z-12,.12,.12,24);
      if(i%3===0){box('stone',side*84,-.8,z,26,.8,5);box('light',side*72,.1,z,.55,1.1,.55);}
    }
    // A stepped village recedes along the banks, leaving the shrine and portal silhouette open.
    for(let i=0;i<13;i++){
      const z=-246-i*23, x=side*(42+Math.sin(i*1.7)*5),h=5.2+(i%3)*1.4;
      box('stone',x,-5,z,19,10,21);box('wood',x,h/2,z,15,h,15);
      for(const s of [-1,1]){
        const corners=[[x,h+2.4,z-9],[x+s*9,h-.2,z-9],[x+s*9,h-.2,z+9],[x,h+2.4,z+9]];
        for(const k of [0,1,2,0,2,3])roofPos.push(...corners[k]);
        gablePos.push(x-7.5,h-.2,z+s*7.5,x+7.5,h-.2,z+s*7.5,x,h+1.96,z+s*7.5);
      }
      // Canal-facing warm shoji windows separated by heavy timber mullions.
      box('light',x-side*7.54,h*.48,z,.12,h*.56,10.8);
      // Raised thresholds, a sliding door, carved transom and shaded eave brackets.
      box('wood',x-side*7.75,.8,z-4.8,.22,1.6,1.5);
      box('stone',x-side*8.5,.15,z-4.8,2.2,.3,2.5);
      for(let j=0;j<12;j++)box('wood',x-side*7.72,h*.84,z-6+j*1.1,.18,.55,.1);
      for(let j=0;j<8;j++)box('wood',x-side*7.64,h*.48,z-5.4+j*1.55,.18,h*.61,.12);
      box('wood',x-side*7.7,h*.48,z,.2,.12,11.4);
      box('wood',x-side*8.3,h*.83,z,2,.22,15.5);
      for(const dz of [-6.5,6.5])box('wood',x-side*8.7,1.5,z+dz,.22,3,.22);
      box('stone',side*29,-.5,z,7,.55,21);
      box('wood',side*25.5,.7,z,.18,1.8,.18);
      box('light',side*25.5,1.9,z,.7,.95,.7);
      signs.push({x:x-side*8.8,y:h*.72,z:z+5.8,side,i});
    }
    // Quay lanterns and low pilings give the water scale without enclosing the view in towers.
    for(let i=0;i<18;i++){
      const z=-238-i*17;box('wood',side*19,-.6,z,.35,3,.35);
      if(i%2===0)box('light',side*19,1.15,z,.52,.65,.52);
    }
  }
  const roofGeo=new THREE.BufferGeometry();roofGeo.setAttribute('position',new THREE.Float32BufferAttribute(roofPos,3));roofGeo.computeVertexNormals();
  const gableGeo=new THREE.BufferGeometry();gableGeo.setAttribute('position',new THREE.Float32BufferAttribute(gablePos,3));gableGeo.computeVertexNormals();const gableMat=mats.wood.clone();gableMat.side=THREE.DoubleSide;props.add(new THREE.Mesh(gableGeo,gableMat));
  const roofMat=new THREE.ShaderMaterial({side:THREE.DoubleSide,vertexShader:'varying vec3 vW;void main(){vW=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`varying vec3 vW;void main(){float seam=pow(.5+.5*cos(vW.z*7.0),18.0);float tile=step(.9,fract(vW.x*1.4));vec3 col=mix(vec3(.025,.055,.065),vec3(.075,.12,.14),seam);col*=1.0-tile*.35;gl_FragColor=vec4(col,1.0);}`});props.add(new THREE.Mesh(roofGeo,roofMat));
  for(const [kind,list]of Object.entries(batches)){
    const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mats[kind],list.length),o=new THREE.Object3D();
    list.forEach((p,i)=>{o.position.set(p.x,p.y,p.z);o.scale.set(p.w,p.h,p.d);o.rotation.set(0,0,p.rz);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);});props.add(mesh);
  }
  // Small timber boats, each with a warm cabin and low hull, sit alongside the city piers.
  for(const side of [-1,1])for(let i=0;i<(small?2:3);i++){
    const boat=new THREE.Group(),hull=new THREE.Mesh(new THREE.BoxGeometry(3,.7,12),mats.wood),cabin=new THREE.Mesh(new THREE.BoxGeometry(2.3,1.3,7),mats.light),roof=new THREE.Mesh(new THREE.BoxGeometry(3,.3,8),mats.roof);
    cabin.position.y=.85;roof.position.y=1.65;boat.add(hull,cabin,roof);boat.position.set(side*(72+i*3),-1.1,70-i*87);props.add(boat);
  }
  let disposed=false;
  fontsReady().then(()=>{if(disposed)return;for(const s of signs){const m=shopSign(['川辺','茶屋','旅館','珈琲','水門'][s.i%5],2.2,s.i);m.position.set(s.x,s.y,s.z);m.rotation.y=-s.side*Math.PI*.5;props.add(m);}});
  // Distant volcanic silhouette, intentionally off-axis so the portal remains the destination.
  const mountains=new THREE.Group();group.add(mountains);
  const terrain=new THREE.PlaneGeometry(1850,680,160,64);terrain.rotateX(-Math.PI/2);const p=terrain.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),dx=(x+240)/255,dz=z/230;
    const radial=Math.hypot(dx,dz),az=Math.atan2(dz,dx);
    const ridge=(Math.sin(az*13+radial*5)*.5+.5)*7*Math.min(1,radial*3);
    const y=-4+165*Math.exp(-Math.pow(radial,1.35))-ridge+Math.sin(x*.047+z*.021)*1.3;
    p.setXYZ(i,x,y,z-1450);
  }
  terrain.computeVertexNormals();
  const terrainMat=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,uniforms:{uReveal:dusk,...paletteUniforms},
    vertexShader:'varying vec3 vW,vN;void main(){vW=position;vN=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`varying vec3 vW,vN;uniform float uReveal,uNight;uniform vec3 uFog;void main(){
      float grain=sin(vW.x*.11+sin(vW.z*.09)*2.0)*sin(vW.z*.17)*.5+.5;
      float snow=smoothstep(107.0,115.0,vW.y+grain*12.0+sin(vW.x*.08)*4.0);
      float light=.4+.6*max(0.0,dot(normalize(vN),normalize(vec3(-1.0,.6,.4))));
      vec3 rock=mix(vec3(.095,.105,.16),vec3(.23,.17,.22),light);
      vec3 col=mix(rock,vec3(.61,.52,.57)*(.65+light*.35),snow);
      col=mix(col,vec3(.33,.21,.25),.25+(1.0-smoothstep(-5.0,40.0,vW.y))*.35);
      col=mix(col,col*.3+uFog*.2,uNight*.9);
      gl_FragColor=vec4(col,smoothstep(.02,.45,uReveal));
    }`});mountains.add(new THREE.Mesh(terrain,terrainMat));
  return {group,park:park.userData,update(cameraZ,inTube){group.visible=!inTube&&cameraZ>-745;},dispose(){disposed=true;}};
}
