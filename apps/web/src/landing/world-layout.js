/** Stable blueprints; no storage, network request, or new skyline on each visit. */
export function seededRandom(seed=73129){let state=seed>>>0;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
const random=seededRandom(621041),range=(a,b)=>a+(b-a)*random();
export const CITY_LOTS=Object.freeze([-263,-227,-191,-155,-119,-83,-47,-23,113,149,185,221,257,293].flatMap(x=>Array.from({length:10},(_,row)=>{
 const z=95-row*35,w=Math.abs(x)===23?15:range(21,27),d=range(22,28);
 if(Math.abs(z+125)<27&&Math.abs(x)<30)return null;
 if(Math.abs(x-112)<16&&Math.abs(z-30)<23)return null;
 if(Math.abs(x+42)<17&&Math.abs(z+10)<23)return null;
 if(Math.abs(x-113)<16&&Math.abs(z+70)<23)return null;
 const h=Math.abs(x)<30?range(14,25):range(30,88)*(random()<.12?1.35:1);
 return Object.freeze({x,z,w,d,h,y0:0});
}).filter(Boolean)));
export const CITY_SIGNATURE=CITY_LOTS.reduce((sum,l)=>sum+Math.round(l.h*1000)+Math.round(l.w*1000),0).toString(16);
