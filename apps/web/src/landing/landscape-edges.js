import * as THREE from 'three';

/** Rail paths stop explicitly at entrances, keeping gaps intentional instead of cutting rails through paths. */
export function buildRailings(paths,{height=1.2,spacing=2.8}={}){
 const group=new THREE.Group(),parts=[[],[],[]],vertical=new THREE.Vector3(0,0,1),o=new THREE.Object3D();let posts=0;
 const cube=(kind,p,s,q=new THREE.Quaternion())=>parts[kind].push({p,s,q});
 for(const path of paths)for(let i=1;i<path.length;i++){
  const a=new THREE.Vector3(...path[i-1]),b=new THREE.Vector3(...path[i]),direction=b.clone().sub(a),length=direction.length(),n=Math.max(1,Math.ceil(length/spacing));
  for(let j=0;j<=n;j++){
   const p=a.clone().lerp(b,j/n);posts++;cube(0,p.clone().add(new THREE.Vector3(0,height/2,0)),new THREE.Vector3(.10,height,.10));
   cube(1,p.clone().add(new THREE.Vector3(0,.05,0)),new THREE.Vector3(.24,.10,.24));
   if(j%4===0)cube(2,p.clone().add(new THREE.Vector3(0,height+.03,0)),new THREE.Vector3(.14,.06,.14));
  }
  const q=new THREE.Quaternion().setFromUnitVectors(vertical,direction.clone().normalize());
  for(const y of [height,height*.45])cube(0,a.clone().add(b).multiplyScalar(.5).add(new THREE.Vector3(0,y,0)),new THREE.Vector3(.075,.075,length),q);
  const pickets=Math.ceil(length/.75);for(let j=1;j<pickets;j++)cube(0,a.clone().lerp(b,j/pickets).add(new THREE.Vector3(0,height*.65,0)),new THREE.Vector3(.035,height*.62,.035));
 }
 const materials=[new THREE.MeshStandardMaterial({color:0x263941,metalness:.65,roughness:.5}),new THREE.MeshStandardMaterial({color:0x747a70,roughness:.85}),new THREE.MeshStandardMaterial({color:0xffd5a0,emissive:0xffb774,emissiveIntensity:.45})];
 parts.forEach((list,k)=>{const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),materials[k],list.length);list.forEach((p,i)=>{o.position.copy(p.p);o.scale.copy(p.s);o.quaternion.copy(p.q);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);});mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);});group.userData.posts=posts;return group;
}

/** The broad city promenade narrows onto the shrine causeway, supported by a real abutment. */
export function buildCityThreshold(){
 const group=new THREE.Group(),stone=new THREE.MeshStandardMaterial({color:0x59615d,roughness:.85});
 const top=[[-14,-.12,-216],[14,-.12,-216],[4.7,-.12,-258],[-4.7,-.12,-258]],vertices=[...top.flat(),...top.map(p=>[p[0],-2.5,p[2]]).flat()];
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex([0,3,2,0,2,1,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7]);geometry.computeVertexNormals();
 const apron=new THREE.Mesh(geometry,stone);apron.receiveShadow=true;group.add(apron);
 const rails=buildRailings([-1,1].map(side=>[[side*14,.05,-201],[side*14,.05,-216],[side*4.7,.05,-258],[side*4.7,.05,-280]]));group.add(rails);
 const metal=new THREE.MeshStandardMaterial({color:0x2a353d,metalness:.6,roughness:.5}),lamp=new THREE.MeshStandardMaterial({color:0xffdfac,emissive:0xffc481,emissiveIntensity:.45});
 for(const x of [-10,-7,7,10]){
  const bollard=new THREE.Mesh(new THREE.CylinderGeometry(.15,.19,.9,10),metal);bollard.position.set(x,.45,-215);group.add(bollard);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(.154,.154,.1,10),lamp);band.position.set(x,.73,-215);group.add(band);
 }
 // Three shallow treads meet the raised garden's north entrance without a floating slab or blocked gate.
 for(let i=0;i<3;i++){const top=(i+1)*.08,h=2.5+top;const tread=new THREE.Mesh(new THREE.BoxGeometry(1.5,h,6),stone);tread.position.set(14.5+i*1.5,(top-2.5)/2,-201.5);group.add(tread);}
 group.userData={railPosts:rails.userData.posts,apronWidth:28,causewayWidth:9.4};return group;
}
