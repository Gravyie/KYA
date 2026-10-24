import * as THREE from 'three';

// A reusable noise lookup avoids evaluating dozens of trigonometric hashes per sky pixel.
export function createSkyNoise(){
 const data=new Uint8Array(256*256);let seed=842159;
 for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed>>>24;}
 const texture=new THREE.DataTexture(data,256,256,THREE.RedFormat);
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}
// One fixed light direction for the atmosphere, architecture and water reflections.
export const SUN = [-0.26, 0.115, -1];
export const SUN_GLSL = `normalize(vec3(${SUN.map(v=>v.toFixed(3)).join(',')}))`;
export const SUNSET_SKY = `
varying vec2 vNdc;uniform mat4 uInvProj,uCamWorld;uniform sampler2D uSkyNoise;uniform float uTime,uAlert,uNight,uSolar;uniform vec3 uHorizon,uZenith,uCloud;
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return texture2D(uSkyNoise,(i+f+.5)/256.0).r;}
float fbm(vec2 p){float n=0.0,a=.5;for(int i=0;i<5;i++){n+=noise(p)*a;p=p*2.04+vec2(17.1,9.2);a*=.5;}return n;}
void main(){
 vec4 ray=uInvProj*vec4(vNdc,1.0,1.0);vec3 d=normalize((uCamWorld*vec4(normalize(ray.xyz/ray.w),0.0)).xyz);
 vec3 sunDir=${SUN_GLSL};float e=d.y,theta=acos(clamp(dot(d,sunDir),-1.0,1.0));
 vec3 horizon=uHorizon,rose=mix(uHorizon,uZenith,.55),zenith=uZenith;
 vec3 col=mix(horizon,rose,smoothstep(-.045,.23,e));col=mix(col,zenith,smoothstep(.12,.7,e));
 col+=vec3(1.0,.24,.055)*exp(-theta*theta/0.035)*.5*uSolar;
 // Several kilometres of stratified clouds. Their wisps also attenuate the solar disc.
 vec2 q=vec2(atan(d.x,-d.z)*4.0,e*12.0);q.x+=uTime*.0015;
 float weather=fbm(q*vec2(.6,1.3)+vec2(4.0,0.0));
 float cloud=fbm(q*vec2(1.1,3.0)+vec2(weather*1.2,weather*.3));
 float bank=smoothstep(.48,.69,cloud)*(1.0-smoothstep(.35,.65,e))*smoothstep(-.06,.04,e);
 float silver=pow(clamp(cloud*.9+.18,0.0,1.0),8.0)*exp(-theta*theta/.12);
 vec3 shade=mix(uCloud*.6,uCloud+vec3(.19,.06,.025),exp(-theta*3.0)*uSolar);
 col=mix(col,shade,bank*.75);col+=vec3(1.0,.36,.12)*silver*.7*uSolar;
 float wisps=fbm(q*vec2(.8,7.0)+vec2(weather*3.0,1.0));
 col+=vec3(.55,.28,.20)*smoothstep(.59,.75,wisps)*exp(-abs(e-.18)*5.0)*.3;
 // Radiant core, limb darkening, scattering and thin cloud filaments; no flat yellow billboard.
 float radius=.029,r=theta/radius;
 float disc=1.0-smoothstep(.97,1.04,r);
 float limb=.55+.45*sqrt(max(0.0,1.0-r*r));
 float veil=1.0-bank*.65-smoothstep(.60,.76,wisps)*.17;
 vec3 solar=mix(vec3(1.0,.34,.075),vec3(1.0,.82,.49),limb);
 col+=solar*disc*limb*veil*14.0*uSolar;
 col+=vec3(1.0,.32,.075)*exp(-theta*60.0)*2.0*uSolar;
 col+=vec3(1.0,.20,.045)*exp(-theta*13.0)*.16*uSolar;
 float haze=exp(-abs(e+.005)*22.0);col=mix(col,uHorizon,haze*.2);
 col=mix(uZenith*.7,col,smoothstep(-.32,-.035,e));
 col=mix(col,vec3(col.r*.9,.018,.035),uAlert*.4);
 gl_FragColor=vec4(col,1.0);
}`;
