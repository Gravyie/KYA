import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createApp} from '../apps/server/src/app.js';
import {createStore} from '../apps/server/src/store.js';
const root=resolve(import.meta.dirname,'..'),dir=await mkdtemp(resolve(tmpdir(),'wardrail-input-'));
const server=createApp(createStore(dir),{webDist:root+'/apps/web/dist',root});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),headless:true});
const failures=[];await mkdir(root+'/output/mobile',{recursive:true});
try{
 const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await p.addInitScript(()=>sessionStorage.setItem('mihari.boot','1'));
 await p.goto(`http://127.0.0.1:${server.address().port}`);await p.waitForSelector('.w-ready');await p.evaluate(()=>document.fonts.ready);
 const c=await p.context().newCDPSession(p);
 async function swipe(distance=170,interval=20){
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:12,y:650}]});
  for(let i=1;i<=8;i++){await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:12,y:650-distance*i/8}]});await p.waitForTimeout(interval);}
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }
 const railHidden=await p.locator('.rail').evaluate(e=>getComputedStyle(e).display==='none');
 if(!railHidden)failures.push('Mobile chapter box is still visible');
 // A long policy chapter should coast immediately after release, then decelerate.
 await p.evaluate(()=>{const r=document.querySelector('#decide').getBoundingClientRect();window.__lenis.scrollTo(r.top+scrollY+50,{immediate:true,force:true});});
 await p.waitForTimeout(500);await swipe();
 const coast=await p.evaluate(()=>new Promise(resolve=>{const start=performance.now(),y=scrollY,s=[];function tick(t){s.push({t:t-start,y:scrollY-y});if(t-start<230)requestAnimationFrame(tick);else resolve(s);}requestAnimationFrame(tick);}));
 const at=ms=>coast.find(s=>s.t>=ms)?.y??coast.at(-1).y;
 console.log('Release movement (px):',JSON.stringify({first:at(70),second:at(140)-at(70),total:coast.at(-1).y}));
 if(at(70)<(at(140)-at(70))*.8)failures.push('Reading inertia accelerates from a pause after finger release');
 // Arriving at the gate must include its complete caption without another reading gesture.
 await p.evaluate(()=>{const r=document.querySelector('#identify').getBoundingClientRect();window.__lenis.scrollTo(r.bottom+scrollY-innerHeight,{immediate:true,force:true});});await p.waitForTimeout(500);
 await swipe();await p.waitForTimeout(1900);
 const caption=await p.locator('.gate-card').evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,h:innerHeight};});console.log('Gate arrival:',caption);await p.screenshot({path:root+'/output/mobile/gate-arrival.png'});
 if(caption.bottom>caption.h-16||caption.top<80)failures.push('Gate arrival hides the caption');
 // A rapid burst spanning the end of the animation must never queue another chapter.
 await p.evaluate(()=>{const r=document.querySelector('#gate').getBoundingClientRect();window.__lenis.scrollTo(r.bottom+scrollY-innerHeight,{immediate:true,force:true});});await p.waitForTimeout(500);
 await swipe(60,8);
 for(let i=0;i<9;i++){await p.waitForTimeout(100);await swipe(300,8);}
 await p.waitForTimeout(1900);
 const policy=await p.evaluate(()=>{const r=document.querySelector('#decide').getBoundingClientRect();return {top:r.top+scrollY,y:scrollY};});console.log('Rapid swipe landing:',policy);
 if(policy.y>policy.top+3)failures.push('Rapid swipe burst continues scrolling after a chapter transition');
 await swipe();await p.waitForTimeout(350);
 if((await p.evaluate(()=>scrollY))<=policy.top+30)failures.push('Reading must resume after the rapid-swipe burst ends');
 assert.deepEqual(failures,[]);console.log('CHAPTER INPUT CHECKS PASSED');
}finally{await browser.close();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
