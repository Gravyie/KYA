// One fixed stream, shared by rendering, physical interaction and camera diagnostics.
export const PORTAL=Object.freeze({x:0,y:2.6,z:-720,r:128});
export const FLOW=Object.freeze({split:.88,densityPower:1.8,inlet:.12,startTurn:.10,startDepth:38,endDepth:840,turns:9.3,endCoils:2,angle:-2.2,radius:.62,nearWidth:20,farWidth:1.6});
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function spiral(u,coilScale=1){
 if(u===1)return [PORTAL.x,PORTAL.y,PORTAL.z];
 const theta=u*FLOW.turns,angle=FLOW.angle+theta+FLOW.endCoils*Math.PI*2*smooth(.55,1,u);
 const rawDepth=FLOW.startDepth+(FLOW.endDepth-FLOW.startDepth)*u**1.1;
 const depth=rawDepth;
 // Both inner turns share one scale, preserving their logarithmic spacing.
 const inset=1+(coilScale-1)*smooth(.58,.64,u);
 const r=FLOW.radius*rawDepth*Math.exp(-.30634896*theta)*(1-smooth(.82,1,u))*inset;
 const y=PORTAL.y+(64+(PORTAL.y-64)*depth/FLOW.endDepth-PORTAL.y)*inset;
 return [Math.cos(angle)*r,y+Math.sin(angle)*r,120-depth-Math.sin(angle)*r*(64-PORTAL.y)/FLOW.endDepth];
}
// A continuous foreground arc grazes the left corners, travels below the frame,
// then meets the existing right-hand spiral with the same position and tangent.
const join=spiral(FLOW.startTurn),next=spiral(FLOW.startTurn+.0001);
const n=1;
const control=join.map((v,k)=>v-(next[k]-v)/.0001*(1-FLOW.startTurn)/(1-FLOW.inlet)*FLOW.inlet/3);
// A single C1 approach, born far behind even the elevated loading camera.
// No intermediate waypoints: the flow cannot fold into a corner or a zigzag.
export const INLET=Object.freeze([[[-220,280,750],[-160,165,370],control,join]]);
export function sampleFlow(u,coilScale=1){
 if(u>=FLOW.inlet)return spiral(FLOW.startTurn+(1-FLOW.startTurn)*(u-FLOW.inlet)/(1-FLOW.inlet),coilScale);
 const q=u/FLOW.inlet*n,i=Math.min(n-1,Math.floor(q)),t=q-i,v=1-t,c=INLET[i];
 return [0,1,2].map(k=>c[0][k]*v**3+3*c[1][k]*v*v*t+3*c[2][k]*v*t*t+c[3][k]*t**3);
}
const vec=p=>`vec3(${p.map(n=>n.toFixed(8)).join(',')})`;
export const FLOW_PATH_GLSL=`
vec3 spiralFrame(float u,out vec3 tangent){
 float theta=u*${FLOW.turns.toFixed(1)};
 float spin=clamp((u-.55)/.45,0.0,1.0),fadePhase=clamp((u-.82)/.18,0.0,1.0);
 float angle=${FLOW.angle.toFixed(1)}+theta+${(FLOW.endCoils*Math.PI*2).toFixed(8)}*spin*spin*(3.0-2.0*spin);
 float angleRate=${FLOW.turns.toFixed(1)}+${(FLOW.endCoils*Math.PI*2).toFixed(8)}*6.0*spin*(1.0-spin)/.45;
 float rawDepth=${FLOW.startDepth.toFixed(1)}+${(FLOW.endDepth-FLOW.startDepth).toFixed(1)}*pow(u,1.1);
 float rawRate=${((FLOW.endDepth-FLOW.startDepth)*1.1).toFixed(3)}*pow(max(u,.0001),.1);
 float depth=rawDepth,depthRate=rawRate;
 float enter=clamp((u-.58)/.06,0.0,1.0);
 float inset=1.0+(uCoilScale-1.0)*enter*enter*(3.0-2.0*enter);
 float insetRate=(uCoilScale-1.0)*6.0*enter*(1.0-enter)/.06;
 float decay=exp(-.30634896*theta),fade=1.0-fadePhase*fadePhase*(3.0-2.0*fadePhase);
 float r=${FLOW.radius.toFixed(2)}*rawDepth*decay*fade;
 float radialRate=${FLOW.radius.toFixed(2)}*decay*((rawRate-rawDepth*.30634896*${FLOW.turns.toFixed(1)})*fade-rawDepth*6.0*fadePhase*(1.0-fadePhase)/.18);
 radialRate=radialRate*inset+r*insetRate;r*=inset;
 float sine=sin(angle),cosine=cos(angle),lift=sine*r;
 float liftRate=cosine*angleRate*r+sine*radialRate;
 float tilt=${((64-PORTAL.y)/FLOW.endDepth).toFixed(8)};
 float baseY=64.0-tilt*depth;
 float y=${PORTAL.y.toFixed(1)}+(baseY-${PORTAL.y.toFixed(1)})*inset;
 float yRate=-tilt*depthRate*inset+(baseY-${PORTAL.y.toFixed(1)})*insetRate;
 tangent=vec3(-sine*angleRate*r+cosine*radialRate,yRate+liftRate,-depthRate-liftRate*tilt);
 return vec3(cosine*r,y+lift,120.0-depth-lift*tilt);
}
vec3 riverFrame(float u,out vec3 tangent){
 if(u>=${FLOW.inlet.toFixed(2)})return spiralFrame(${FLOW.startTurn.toFixed(2)}+${(1-FLOW.startTurn).toFixed(2)}*(u-${FLOW.inlet.toFixed(2)})/${(1-FLOW.inlet).toFixed(2)},tangent);
 ${INLET.map((c,i)=>`if(u<${((i+1)*FLOW.inlet/n).toFixed(8)}){
 float t=(u-${(i*FLOW.inlet/n).toFixed(8)})/${(FLOW.inlet/n).toFixed(8)},v=1.0-t;
 tangent=3.0*(${vec(c[1])}-${vec(c[0])})*v*v+6.0*(${vec(c[2])}-${vec(c[1])})*v*t+3.0*(${vec(c[3])}-${vec(c[2])})*t*t;
 return ${vec(c[0])}*v*v*v+3.0*${vec(c[1])}*v*v*t+3.0*${vec(c[2])}*v*t*t+${vec(c[3])}*t*t*t;
 }`).join('\n')}
 return spiralFrame(${FLOW.startTurn.toFixed(2)},tangent);
}
vec3 river(float u){vec3 tangent;return riverFrame(u,tangent);}
`;
