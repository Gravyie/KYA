const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const ease=t=>t*t*t*(10+t*(-15+6*t));
const slope=t=>30*t*t*(1-t)*(1-t);

/** Serial gesture scheduler. resolve() maps intent to a chapter or reading destination.
 * Its clock advances only on rendered frames: a stalled frame cannot jump a chapter.
 * All positions/velocities are CSS pixels and milliseconds, independent of display Hz.
 */
export function createChapterQueue({read,write,resolve,onActivity=()=>{},reduced=false}) {
  let requests=[],active=null,brake=null,route=null,rest=0,engaged=false,written=read();
  const announce=()=>{const next=!!(active||brake||requests.length);if(next!==engaged){engaged=next;onActivity(next);}};
  const put=y=>{write(y);written=read();};
  const cancel=()=>{requests=[];active=brake=route=null;rest=0;announce();};
  const direction=()=>Math.sign(active?.delta||brake?.velocity||requests[0]?.dir||0);
  const slow=()=>{
    if(active&&!reduced){
      const velocity=active.delta*slope(active.elapsed/active.duration)/active.duration;
      brake={from:read(),velocity,elapsed:0,min:Math.min(active.from,active.to),max:Math.max(active.from,active.to)};
    }
    active=null;rest=0;
  };
  return {
    get busy(){return !!(active||brake||requests.length||rest>0);},
    get interrupted(){return route!==null&&!active;},
    get direction(){return direction();},
    enqueue(request){
      if(direction()&&request.dir!==direction()){requests=[];slow();}
      requests.push(request);written=read();announce();
    },
    hold(){requests=[];slow();announce();},
    cancel,
    tick(delta){
      if((active||brake||route||requests.length)&&Math.abs(read()-written)>3){cancel();return;} // links/history take precedence
      const dt=clamp(delta,0,32);
      if(brake){
        brake.elapsed=Math.min(160,brake.elapsed+dt);
        const t=brake.elapsed/160;
        put(clamp(brake.from+brake.velocity*160*(t-t*t+t*t*t/3),brake.min,brake.max));
        if(t===1){brake=null;announce();}
        return;
      }
      if(active){
        active.elapsed=Math.min(active.duration,active.elapsed+dt);
        const t=active.elapsed/active.duration;
        put(active.from+active.delta*ease(t));
        if(t===1){rest=active.kind==='chapter'&&!reduced?180:0;active=null;route=null;announce();}
        return;
      }
      rest=Math.max(0,rest-dt);
      if(rest||!requests.length)return;
      const request=requests.shift(),from=read();
      let plan=resolve(request,from,route);
      if(!plan){requests=[];route=null;announce();return;}
      if(Math.abs(plan.to-from)<.5){route=null;announce();return;}
      // Adjacent reading requests share one glide; chapter boundaries remain discrete stops.
      while(plan.kind==='read'&&requests[0]?.dir===request.dir){
        const next=resolve(requests[0],plan.to,null);
        if(!next||next.kind!=='read')break;
        requests.shift();plan={...plan,to:next.to,duration:plan.duration+next.duration};
      }
      route=plan.route||null;
      if(reduced){put(plan.to);route=null;announce();return;}
      active={...plan,from,delta:plan.to-from,elapsed:0};written=from;announce();
    },
  };
}
