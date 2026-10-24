/** The lab swarm's cold upstream light, shared with the landing's stream and gateway. */
export const SWARM_LIGHT_GLSL=`vec3 swarmLight(float seed){return mix(vec3(0.75,0.85,1.0),vec3(0.2,0.8,1.0),seed);}`;
