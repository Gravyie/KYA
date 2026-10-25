import {useEffect} from 'react';
import Lenis from 'lenis';
import {createChapterQueue} from './chapter-queue.js';

/** Chapter input and paced travel are independent of WebGL availability. */
export function useChapterScroll() {
  useEffect(()=>{
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lenis=reduced?null:new Lenis({lerp:.085,wheelMultiplier:.9});
    const abort=new AbortController(),events={signal:abort.signal};
    let raf=0,lastFrame=0,holdTimer=0,touch=null,returnBoundary=null,pendingY=null,coast=null;
    let wheelTime=0,wheelSum=0,wheelSent=0,lastKey=0,layoutWidth=innerWidth;
    const scroll={
      to(y,options={}){if(lenis)lenis.scrollTo(y,options);else window.scrollTo({top:Math.max(0,y),behavior:'instant'});},
      write(y){this.to(y,{immediate:true,force:true});},
    };
    const opening=()=>!!document.querySelector('.landing.is-opening');
    const snaps=()=>[...document.querySelectorAll('[data-snap]')].map(el=>{
      const r=el.getBoundingClientRect();return {top:r.top+scrollY,bottom:r.bottom+scrollY,h:r.height,entry:el.hasAttribute('data-entry')};
    });
    const place=(sec,dir)=>Math.max(0,sec.entry?sec.top:sec.h<=innerHeight+2?sec.top-(innerHeight-sec.h)/2:dir>0?sec.top:sec.bottom-innerHeight);
    const bounds=sec=>{const min=place(sec,1);return {min,max:sec.entry?min:Math.max(min,sec.bottom-innerHeight)};};
    const locate=(list,y)=>list.findIndex(sec=>y+innerHeight/2>=sec.top-1&&y+innerHeight/2<sec.bottom+1);
    const chapter=(list,from,to,dir,y)=>{
      if(!list[to])return null;
      const target=place(list[to],dir);
      return {to:target,kind:'chapter',route:{from,to},duration:Math.max(1350,1.875*Math.abs(target-y)/(innerHeight*1.6)*1000)};
    };
    const resolve=(request,y,route)=>{
      const list=snaps(),entry=list.find(sec=>sec.entry),{dir,distance}=request;
      if(!entry)return null;
      if(route){
        const destination=dir===Math.sign(route.to-route.from)?route.to:route.from;
        return chapter(list,destination===route.to?route.from:route.to,destination,dir,y);
      }
      if(y>entry.top+4||(y>=entry.top-3&&dir>0)){
        const to=Math.max(entry.top,Math.min(document.documentElement.scrollHeight-innerHeight,y+dir*distance));
        return Math.abs(to-y)<1?null:{to,kind:'read',duration:Math.max(280,1.875*Math.abs(to-y)/(innerHeight*.85)*1000)};
      }
      const index=locate(list,y);if(index<0)return null;
      const sec=list[index],range=bounds(sec),edge=dir>0?range.max:range.min;
      if(Math.abs(y-edge)>3&&(dir>0?y<edge:y>edge)){
        const to=Math.max(range.min,Math.min(range.max,y+dir*distance));
        return {to,kind:'read',duration:Math.max(280,1.875*Math.abs(to-y)/(innerHeight*.85)*1000)};
      }
      return chapter(list,index,index+dir,dir,y);
    };
    const queue=createChapterQueue({read:()=>scrollY,write:y=>scroll.write(y),resolve,reduced,
      onActivity:active=>{if(active)lenis?.stop();else lenis?.start();}});
    const loop=time=>{
      raf=0;
      const dt=lastFrame?time-lastFrame:16;lastFrame=time;
      lenis?.raf(time);queue.tick(dt);
      if(coast&&(lenis?.isScrolling==='smooth'||Math.abs(scrollY-coast.written)>3))coast=null;
      if(pendingY!==null){scroll.write(pendingY);if(coast)coast.written=scrollY;pendingY=null;}
      else if(coast){
        const decay=Math.exp(-Math.min(50,time-coast.time)/240);
        coast.y=Math.max(coast.min,Math.min(coast.max,coast.y+coast.v*240*(1-decay)));
        coast.v*=decay;coast.time=time;scroll.write(coast.y);coast.written=scrollY;
        if(Math.abs(coast.v)<.025||coast.y===coast.min||coast.y===coast.max)coast=null;
      }
      if(lenis||queue.busy||pendingY!==null||coast)raf=requestAnimationFrame(loop);
    };
    const wake=()=>{if(!raf){lastFrame=0;raf=requestAnimationFrame(loop);}};
    if(lenis){window.__lenis=lenis;wake();}
    const submit=(dir,distance)=>{
      returnBoundary=null;coast=null;pendingY=null;
      queue.enqueue({dir,distance:Math.max(48,Math.min(innerHeight*.85,distance))});wake();
    };
    const atStoryEdge=dir=>{
      const list=snaps(),y=scrollY,i=locate(list,y),sec=list[i];
      if(!sec||y>list.at(-1).top+4||(sec.entry&&dir>0))return false;
      const range=bounds(sec);return dir>0?y>=range.max-3:y<=range.min+3;
    };
    const onWheel=e=>{
      if(opening()||Math.abs(e.deltaY)<2||e.ctrlKey||e.target.closest?.('[data-lenis-prevent]'))return;
      returnBoundary=null;
      const dir=Math.sign(e.deltaY),now=performance.now(),gap=now-wheelTime;wheelTime=now;
      if(!queue.busy&&!queue.interrupted&&!atStoryEdge(dir))return;
      e.preventDefault();e.stopImmediatePropagation();
      if(gap>160||Math.sign(wheelSum)!==dir)wheelSum=0;
      wheelSum+=e.deltaY;
      const reverse=queue.direction&&dir!==queue.direction;
      if(reverse||gap>160||(Math.abs(wheelSum)>=100&&now-wheelSent>=220)){
        submit(dir,Math.max(Math.abs(wheelSum),innerHeight*.35));wheelSum=0;wheelSent=now;
      }
    };
    const onKey=e=>{
      if(opening()||e.target.closest?.('input,textarea,select,button,a,summary,[role="button"],[role="tab"],[contenteditable]'))return;
      if(e.key==='Escape'&&queue.busy){queue.hold();e.preventDefault();return;}
      const dir=['ArrowDown','PageDown',' '].includes(e.key)?e.shiftKey&&e.key===' '?-1:1:['ArrowUp','PageUp'].includes(e.key)?-1:0;
      if(!dir||(!queue.busy&&!queue.interrupted&&!atStoryEdge(dir)))return;
      e.preventDefault();const now=performance.now();
      if(!e.repeat||now-lastKey>250){submit(dir,innerHeight*.7);lastKey=now;}
    };
    const onTouchStart=e=>{
      clearTimeout(holdTimer);touch=null;returnBoundary=null;
      if(opening()||e.touches.length!==1||(window.visualViewport?.scale||1)>1.05)return;
      if(e.target.closest?.('.nav,input,textarea,select,[contenteditable],[data-lenis-prevent]'))return;
      const list=snaps(),entry=list.at(-1),y=scrollY;if(!entry)return;
      if(y>entry.top+4&&!queue.busy&&!queue.interrupted){returnBoundary=entry.top;return;}
      const index=locate(list,y),sec=list[index];
      const queued=queue.busy||queue.interrupted;
      if(!sec&&!queued)return;
      coast=null;pendingY=null;
      if(!queued)scroll.write(y);
      const range=sec?bounds(sec):{min:y,max:y};
      touch={x:e.touches[0].clientX,y:e.touches[0].clientY,start:y,last:y,lastTime:performance.now(),velocity:0,
        min:range.min,max:range.max,sec,mode:queued?'queued':null,sent:false,dy:0,passport:!!e.target.closest?.('.pass-stage')};
      if(queued)holdTimer=setTimeout(()=>{
        if(touch&&Math.abs(touch.dy)<8){queue.hold();touch.mode='held';touch.sent=true;wake();}
      },180);
    };
    const onTouchMove=e=>{
      if(!touch)return;
      if(e.touches.length!==1){clearTimeout(holdTimer);queue.hold();touch=null;return;}
      const dx=e.touches[0].clientX-touch.x,dy=touch.y-e.touches[0].clientY,now=performance.now();
      if(!touch.sent&&Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>8){clearTimeout(holdTimer);touch=null;return;}
      if(Math.abs(dy)<8&&!touch.mode)return;
      if(Math.abs(dy)>=8)clearTimeout(holdTimer);
      touch.velocity=.5*touch.velocity+.5*(dy-touch.dy)/Math.max(16,now-touch.lastTime);
      touch.dy=dy;touch.lastTime=now;
      if(touch.passport){window.dispatchEvent(new Event('wardrail:cancel-passport-drag'));touch.passport=false;}
      const dir=Math.sign(dy);
      if(!touch.mode&&touch.sec.entry&&dir>0){touch=null;return;}
      if(e.cancelable)e.preventDefault();
      if(touch.mode==='held'){if(Math.abs(dy)<24)return;touch.mode='queued';touch.sent=false;}
      if(touch.mode==='queued'){
        if(!touch.sent&&Math.abs(dy)>=24&&queue.direction&&dir!==queue.direction){submit(dir,Math.abs(dy)+Math.abs(touch.velocity)*180);touch.sent=true;}
        return;
      }
      if(!touch.mode)touch.mode=(dir>0?touch.start>=touch.max-3:touch.start<=touch.min+3)?'step':'read';
      if(touch.mode==='step'){
        if(Math.abs(dy)>=24){submit(dir,Math.abs(dy));touch.sent=true;touch.mode='queued';}return;
      }
      // Direct manipulation stays under the finger; its camera is held within this chapter.
      pendingY=touch.last=Math.max(touch.min,Math.min(touch.max,touch.start+dy));wake();
    };
    const onTouchEnd=()=>{
      clearTimeout(holdTimer);const t=touch;touch=null;if(!t)return;
      if(t.mode==='queued'&&!t.sent&&Math.abs(t.dy)>=24){submit(Math.sign(t.dy),Math.abs(t.dy)+Math.abs(t.velocity)*180);return;}
      if(t.mode!=='read'||reduced||performance.now()-t.lastTime>90)return;
      coast={y:t.last,written:scrollY,v:Math.max(-3,Math.min(3,t.velocity)),time:performance.now(),min:t.min,max:t.max};wake();
    };
    const cancel=()=>{clearTimeout(holdTimer);touch=null;coast=null;pendingY=null;queue.cancel();};
    const containReturn=()=>{if(returnBoundary!==null&&scrollY<returnBoundary)scroll.write(returnBoundary);};
    const viewport=window.visualViewport;
    const onZoom=()=>{const zoomed=(viewport?.scale||1)>1.05;document.documentElement.classList.toggle('chapter-zoomed',zoomed);if(zoomed)cancel();};
    document.documentElement.classList.add('chapter-touch');onZoom();viewport?.addEventListener('resize',onZoom,events);
    addEventListener('wheel',onWheel,{...events,passive:false,capture:true});addEventListener('keydown',onKey,events);
    addEventListener('touchstart',onTouchStart,{...events,passive:true,capture:true});
    addEventListener('touchmove',onTouchMove,{...events,passive:false,capture:true});
    // Pointer samples arrive before touch-panning crosses the browser's movement threshold.
    // A slowly beginning swipe must not be mistaken for a stationary hold.
    addEventListener('pointermove',e=>{if(touch&&e.pointerType==='touch'&&Math.hypot(e.clientX-touch.x,e.clientY-touch.y)>6)clearTimeout(holdTimer);},{...events,passive:true,capture:true});
    addEventListener('touchend',onTouchEnd,events);addEventListener('touchcancel',cancel,events);
    addEventListener('scroll',containReturn,{...events,passive:true});
    addEventListener('click',e=>{if(e.target.closest?.('a,button'))cancel();},{...events,capture:true});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancel();lastFrame=0;}},events);
    // Mobile browser bars resize the viewport during reading; only a width change
    // invalidates the current route enough to cancel it (rotation/window resize).
    addEventListener('resize',()=>{if(innerWidth!==layoutWidth){layoutWidth=innerWidth;cancel();}},events);
    return()=>{
      cancel();cancelAnimationFrame(raf);abort.abort();lenis?.destroy();if(window.__lenis===lenis)window.__lenis=null;
      document.documentElement.classList.remove('chapter-touch','chapter-zoomed');
    };
  },[]);
}
