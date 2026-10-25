import {useEffect} from 'react';
import Lenis from 'lenis';

/** Chapter navigation owns scroll input independently of the WebGL renderer. */
export function useChapterScroll() {
  useEffect(()=>{
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lenis=reduced?null:new Lenis({lerp:.085,wheelMultiplier:.9});
    const abort=new AbortController();
    let raf=0,timer=0,busyUntil=0,lastWheel=0,settledAt=0,touch=null,returnBoundary=null;
    let pendingY=null,coast=null,quietUntil=0;
    // One write per display frame, independent of touch-event frequency. A release
    // continues at the finger's velocity and loses speed exponentially (never eases in).
    const loop=t=>{
      raf=0;lenis?.raf(t);
      if(coast&&(lenis?.isScrolling==='smooth'||Math.abs(scrollY-coast.written)>3))coast=null;
      if(pendingY!==null){scroll.to(pendingY,{immediate:true,force:true});if(coast)coast.written=scrollY;pendingY=null;}
      else if(coast){
        const dt=Math.min(50,t-coast.time),decay=Math.exp(-dt/240);
        coast.y=Math.max(coast.min,Math.min(coast.max,coast.y+coast.v*240*(1-decay)));
        coast.v*=decay;coast.time=t;scroll.to(coast.y,{immediate:true,force:true});coast.written=scrollY;
        if(Math.abs(coast.v)<.025||coast.y===coast.min||coast.y===coast.max)coast=null;
      }
      if(lenis||pendingY!==null||coast)raf=requestAnimationFrame(loop);
    };
    const wake=()=>{if(!raf)raf=requestAnimationFrame(loop);};
    if(lenis){window.__lenis=lenis;wake();}
    const scroll={
      get target(){return lenis?.targetScroll??scrollY;},
      to(y,options={}){if(lenis)lenis.scrollTo(y,options);else{window.scrollTo({top:Math.max(0,y),behavior:'instant'});options.onComplete?.();}},
      stop(){lenis?.stop();},start(){lenis?.start();},
    };
    const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
    const busy=()=>performance.now()<busyUntil;
    const opening=()=>!!document.querySelector('.landing.is-opening');
    const snaps=()=>[...document.querySelectorAll('[data-snap]')].map(el=>{
      const r=el.getBoundingClientRect();return {top:r.top+scrollY,bottom:r.bottom+scrollY,h:r.height,entry:el.hasAttribute('data-entry')};
    });
    const place=(sec,dir)=>sec.entry?sec.top:sec.h<=innerHeight+2?sec.top-(innerHeight-sec.h)/2:dir>0?sec.top:sec.bottom-innerHeight;
    const bounds=sec=>{const min=place(sec,1);return {min,max:sec.entry?min:Math.max(min,sec.bottom-innerHeight)};};
    const go=y=>{
      const target=Math.max(0,y);returnBoundary=null;coast=null;pendingY=null;clearTimeout(timer);
      const finish=()=>{clearTimeout(timer);scroll.start();settledAt=performance.now();quietUntil=Math.max(quietUntil,settledAt+360);busyUntil=0;};
      busyUntil=performance.now()+1800;scroll.stop();
      if(!reduced)timer=setTimeout(()=>{scroll.to(target,{immediate:true,force:true});finish();},1800);
      scroll.to(target,{duration:reduced?0:1.35,easing:ease,force:true,onComplete:finish});
    };
    const stepTarget=dir=>{
      const list=snaps(),y=Math.round(scroll.target),mid=y+innerHeight/2;
      const entry=list.find(sec=>sec.entry),i=list.findIndex(sec=>mid>=sec.top-1&&mid<sec.bottom+1);
      if((entry&&y>entry.top+4)||i<0)return null;
      const sec=list[i];
      if(sec.entry&&(dir>0||y>sec.top+4))return null;
      if(sec.h>innerHeight+2&&(dir>0?y+innerHeight<sec.bottom-4:y>sec.top+4))return null;
      const next=list[i+dir];
      if(!next||(dir>0?next.top-sec.bottom:sec.top-next.bottom)>240)return null;
      return next;
    };
    const step=dir=>{const next=stepTarget(dir);if(!next)return false;go(place(next,dir));return true;};
    const onWheel=e=>{
      if(opening()||Math.abs(e.deltaY)<2||e.ctrlKey||e.target.closest?.('[data-lenis-prevent]'))return;
      returnBoundary=null;
      const now=performance.now(),gap=now-lastWheel;lastWheel=now;
      if(busy()||(now-settledAt<450&&gap<120)){e.preventDefault();e.stopImmediatePropagation();return;}
      if(step(Math.sign(e.deltaY))){e.preventDefault();e.stopImmediatePropagation();}
    };
    const onKey=e=>{
      if(opening()||e.target.closest?.('input,textarea,select,button,a,summary,[role="button"],[role="tab"],[contenteditable]'))return;
      returnBoundary=null;
      const dir=['ArrowDown','PageDown',' '].includes(e.key)?e.shiftKey&&e.key===' '?-1:1:['ArrowUp','PageUp'].includes(e.key)?-1:0;
      if(!dir)return;if(busy()||step(dir))e.preventDefault();
    };
    const onTouchStart=e=>{
      touch=null;returnBoundary=null;
      if(opening()||e.touches.length!==1||(window.visualViewport?.scale||1)>1.05)return;
      if(e.target.closest?.('.nav,input,textarea,select,[contenteditable],[data-lenis-prevent]'))return;
      const list=snaps(),entry=list.find(sec=>sec.entry),y=scrollY;
      if(!entry)return;
      if(y>entry.top+4){returnBoundary=entry.top;return;}
      const mid=y+innerHeight/2,i=list.findIndex(sec=>mid>=sec.top-1&&mid<sec.bottom+1);
      if(i<0)return;
      const guarded=busy()||performance.now()<quietUntil;
      if(guarded)quietUntil=performance.now()+360;
      coast=null;pendingY=null;
      if(!guarded)scroll.to(y,{immediate:true,force:true});
      const sec=list[i],range=bounds(sec);
      touch={x:e.touches[0].clientX,y:e.touches[0].clientY,start:y,last:y,lastTime:performance.now(),velocity:0,
        min:range.min,max:range.max,list,index:i,sec,captured:guarded,mode:null,passport:!!e.target.closest?.('.pass-stage')};
    };
    const onTouchMove=e=>{
      if(!touch)return;
      if(e.touches.length!==1){touch=null;return;}
      if(touch.captured){quietUntil=performance.now()+360;if(e.cancelable)e.preventDefault();return;}
      const dx=e.touches[0].clientX-touch.x,dy=touch.y-e.touches[0].clientY;
      if(!touch.mode&&Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>8){touch=null;return;}
      if(!touch.mode&&Math.abs(dy)<8)return;
      if(touch.passport)worldCancelPassport();
      const dir=Math.sign(dy);
      if(touch.sec.entry&&dir>0){touch=null;return;}
      if(e.cancelable)e.preventDefault();
      if(!touch.mode){
        const atEdge=dir>0?touch.start>=touch.max-3:touch.start<=touch.min+3;
        touch.mode=atEdge?'step':'read';
      }
      if(touch.mode==='step'){
        if(Math.abs(dy)<24)return;
        const next=touch.list[touch.index+dir];
        touch.captured=true;if(next)go(place(next,dir));return;
      }
      // A reading gesture can reach its chapter edge, but never advance past it.
      const target=Math.max(touch.min,Math.min(touch.max,touch.start+dy)),now=performance.now();
      touch.velocity=.5*touch.velocity+.5*(target-touch.last)/Math.max(16,now-touch.lastTime);
      touch.last=target;touch.lastTime=now;pendingY=target;wake();
    };
    const worldCancelPassport=()=>window.dispatchEvent(new Event('wardrail:cancel-passport-drag'));
    const onTouchEnd=()=>{
      const t=touch;touch=null;
      if(t?.captured){quietUntil=performance.now()+360;return;}
      if(!t||t.mode!=='read'||reduced)return;
      if(performance.now()-t.lastTime>90)return;
      coast={y:t.last,written:scrollY,v:Math.max(-3,Math.min(3,t.velocity)),time:performance.now(),min:t.min,max:t.max};wake();
    };
    const containReturn=()=>{if(returnBoundary!==null&&scrollY<returnBoundary)scroll.to(returnBoundary,{immediate:true,force:true});};
    const viewport=window.visualViewport;
    const onZoom=()=>document.documentElement.classList.toggle('chapter-zoomed',(viewport?.scale||1)>1.05);
    document.documentElement.classList.add('chapter-touch');onZoom();viewport?.addEventListener('resize',onZoom);
    addEventListener('wheel',onWheel,{passive:false,capture:true});addEventListener('keydown',onKey);
    addEventListener('touchstart',onTouchStart,{passive:true,capture:true});
    addEventListener('touchmove',onTouchMove,{passive:false,capture:true});
    addEventListener('touchend',onTouchEnd);addEventListener('touchcancel',()=>{touch=null;coast=null;pendingY=null;},{signal:abort.signal});
    addEventListener('scroll',containReturn,{passive:true});
    return()=>{
      clearTimeout(timer);cancelAnimationFrame(raf);abort.abort();lenis?.destroy();if(window.__lenis===lenis)window.__lenis=null;
      viewport?.removeEventListener('resize',onZoom);document.documentElement.classList.remove('chapter-touch','chapter-zoomed');
      removeEventListener('wheel',onWheel,{capture:true});removeEventListener('keydown',onKey);
      removeEventListener('touchstart',onTouchStart,{capture:true});removeEventListener('touchmove',onTouchMove,{capture:true});
      removeEventListener('touchend',onTouchEnd);removeEventListener('scroll',containReturn);
    };
  },[]);
}
