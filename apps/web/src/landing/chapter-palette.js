import * as THREE from 'three';
// The objects stay in one world; their illumination changes continuously with the camera's chapter.
const CHAPTERS=[
 {name:'Neon city',horizon:'#9d315b',zenith:'#14102e',cloud:'#452b59',water:'#111d32',accent:'#26d9f0',secondary:'#fa298f',fog:'#342540',night:.91,sun:.7,light:.5},
 {name:'Identity',horizon:'#25536d',zenith:'#080f25',cloud:'#274762',water:'#0c2938',accent:'#64edff',secondary:'#537dff',fog:'#20364d',night:.96,sun:.2,light:.35},
 {name:'The shrine',horizon:'#ed5727',zenith:'#332039',cloud:'#8a4551',water:'#3c233b',accent:'#ff703c',secondary:'#ffc580',fog:'#9b5a50',night:.16,sun:1.4,light:1.6},
 {name:'Policy',horizon:'#1d6b62',zenith:'#071d27',cloud:'#315c61',water:'#102d32',accent:'#37ffb6',secondary:'#48cdeb',fog:'#23484b',night:.86,sun:.32,light:.4},
 {name:'The ledger',horizon:'#653565',zenith:'#130f2b',cloud:'#493957',water:'#201c3d',accent:'#c69aff',secondary:'#fa4fa5',fog:'#392e50',night:.92,sun:.25,light:.35},
 {name:'The threshold',horizon:'#983c68',zenith:'#100d28',cloud:'#59345b',water:'#201b3b',accent:'#79f7ff',secondary:'#e344ad',fog:'#452b4c',night:.85,sun:.65,light:.55},
 {name:'Console',horizon:'#173550',zenith:'#060c1c',cloud:'#17334c',water:'#091a2c',accent:'#2be3ff',secondary:'#7058ff',fog:'#172b42',night:1,sun:0,light:.25},
 {name:'Passport',horizon:'#285269',zenith:'#071223',cloud:'#304d68',water:'#102b3c',accent:'#77e6ff',secondary:'#4980ee',fog:'#20354d',night:1,sun:0,light:.25},
 {name:'Integrate',horizon:'#343371',zenith:'#100b29',cloud:'#40375c',water:'#211b42',accent:'#b0a1ff',secondary:'#52baff',fog:'#302a50',night:1,sun:0,light:.25},
 {name:'Use cases',horizon:'#236b61',zenith:'#071c23',cloud:'#345756',water:'#102e30',accent:'#51e9b3',secondary:'#78d8ff',fog:'#20453f',night:1,sun:0,light:.25},
 {name:'Stack',horizon:'#694331',zenith:'#20121e',cloud:'#60403d',water:'#30202e',accent:'#ffba70',secondary:'#e05ca7',fog:'#4c333e',night:1,sun:0,light:.25},
 {name:'Finale',horizon:'#752c69',zenith:'#0c1028',cloud:'#4a3457',water:'#201a34',accent:'#6bf0ff',secondary:'#fc4fbc',fog:'#362746',night:1,sun:0,light:.25},
];
const colors=['horizon','zenith','cloud','water','accent','secondary','fog'];
const frames=CHAPTERS.map(p=>({...p,...Object.fromEntries(colors.map(k=>[k,new THREE.Color(p[k])]))}));
export function createChapterPalette(){
 const current={...frames[0],...Object.fromEntries(colors.map(k=>[k,frames[0][k].clone()]))};
 return {current,sample(stage){const index=Math.max(0,Math.min(frames.length-1,stage)),a=frames[Math.floor(index)],b=frames[Math.min(frames.length-1,Math.floor(index)+1)];let t=index-Math.floor(index);t=t*t*(3-2*t);
 for(const k of colors)current[k].copy(a[k]).lerp(b[k],t);
 for(const k of ['night','sun','light'])current[k]=THREE.MathUtils.lerp(a[k],b[k],t);
 current.name=t<.5?a.name:b.name;return current;}};
}
