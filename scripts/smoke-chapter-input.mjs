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
 // Keep this timing-specific input test independent of a CI runner's software GPU.
 // The full mobile suite separately exercises this controller with the real 3D scene.
 await p.addInitScript(()=>{sessionStorage.setItem('mihari.boot','1');HTMLCanvasElement.prototype.getContext=()=>null;});
 await p.goto(`http://127.0.0.1:${server.address().port}`);await p.waitForSelector('.w-static');await p.evaluate(()=>document.fonts.ready);
 const c=await p.context().newCDPSession(p);
 async function swipe(distance=170,interval=20,steps=8){
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:12,y:650}]});
  for(let i=1;i<=steps;i++){await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:12,y:650-distance*i/steps}]});await p.waitForTimeout(interval);}
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
 // Distinct rapid swipes must be queued, then read the arriving chapter at a paced rate.
 await p.evaluate(()=>{const r=document.querySelector('#gate').getBoundingClientRect();window.__lenis.scrollTo(r.bottom+scrollY-innerHeight,{immediate:true,force:true});});await p.waitForTimeout(500);
 await swipe(60,8);await swipe(100,8);await swipe(100,8);
 await p.waitForTimeout(4500);
 const policy=await p.evaluate(()=>{const r=document.querySelector('#decide').getBoundingClientRect();return {top:r.top+scrollY,end:r.bottom+scrollY-innerHeight,y:scrollY};});console.log('Queued swipe landing:',policy);
 if(policy.y<policy.top+100||policy.y>policy.end+3)failures.push('Queued swipes must read the next chapter without skipping its contents');
 // Holding during a chapter transition brakes it and clears queued intent.
 await p.evaluate(()=>{const r=document.querySelector('#gate').getBoundingClientRect();window.__lenis.scrollTo(r.bottom+scrollY-innerHeight,{immediate:true,force:true});});await p.waitForTimeout(500);
 await swipe(60,8,2);await swipe(100,8,2);await p.waitForTimeout(100);
 await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:12,y:650}]});
 await p.waitForTimeout(700);const stopped=await p.evaluate(()=>scrollY);
 await p.waitForTimeout(400);const held=await p.evaluate(()=>scrollY);
 await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(500);
 console.log('Hold brake:',{stopped,held,afterRelease:await p.evaluate(()=>scrollY)});
 if(stopped>=policy.top-5||Math.abs(stopped-held)>2||Math.abs((await p.evaluate(()=>scrollY))-held)>2)failures.push('A hold must brake before arrival and clear the queued movement');
 await swipe(-100,8);await p.waitForTimeout(2200);
 if((await p.evaluate(()=>scrollY))>=held-20)failures.push('Reverse gesture must return from a held transition');
 const gate=await p.evaluate(()=>scrollY);
 await swipe(60,8,2);await swipe(100,8,2);await swipe(-100,8,2);await p.waitForTimeout(2400);
 if(Math.abs((await p.evaluate(()=>scrollY))-gate)>3)failures.push('Reversal during travel must replace the forward backlog');
 assert.deepEqual(failures,[]);console.log('CHAPTER INPUT CHECKS PASSED');
}finally{await browser.close();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
