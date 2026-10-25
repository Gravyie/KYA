import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createApp} from '../apps/server/src/app.js';
import {createStore} from '../apps/server/src/store.js';
const root=resolve(import.meta.dirname,'..'),out=root+'/output/mobile';await mkdir(out,{recursive:true});
const dir=await mkdtemp(resolve(tmpdir(),'wardrail-mobile-'));
const server=createApp(createStore(dir),{webDist:root+'/apps/web/dist',root});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),headless:true});
const issues=[];
async function open(width,height,reduced=true){
 const p=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:reduced?'reduce':'no-preference'});
 p.on('pageerror',e=>issues.push(e.message));await p.addInitScript(()=>sessionStorage.setItem('mihari.boot','1'));
 let lookups=0;await p.route('**/api/chain/lookup*',async r=>{lookups++;await r.fulfill({status:404,contentType:'application/json',body:'{"error":"Not found"}'});});
 await p.goto(url);await p.waitForSelector('.w-ready');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(200);
 assert.equal(lookups,0,'passport must not fetch an arbitrary agent automatically');return p;
}
async function fit(p,selectors){
 const bad=await p.evaluate(selectors=>selectors.flatMap(selector=>[...document.querySelectorAll(selector)].filter(el=>el.getClientRects().length).flatMap(el=>{const r=el.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1 ? [{selector,left:r.left,right:r.right,viewport:innerWidth}]:[]})),selectors);
 assert.deepEqual(bad,[],'visible components must fit, even when page overflow is clipped');
}
async function swipe(p,dir=1){
 const client=await p.context().newCDPSession(p),x=10,y=dir>0?500:250;
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(const distance of [8,16,32,64,120]){await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-distance*dir}]});await p.waitForTimeout(35);}
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await client.detach();
}
try{
 for(const [w,h] of (process.env.MOBILE_GESTURE_ONLY?[]:[[320,568],[360,740],[390,844],[430,932],[768,1024],[844,390]])){
  const p=await open(w,h);
  const selectors=['.passport-grid','.p-left','.holo','.holo-face','.p-steps','.p-steps p','.inspector','.insp-tabs','.insp-tabs button','.lookup-form','.lookup-form .input','.lookup-form .btn'];
  await fit(p,selectors);
  await p.evaluate(()=>scrollTo(0,document.querySelector('.holo').getBoundingClientRect().top+scrollY-90));await p.waitForTimeout(250);
  if(w===360)await p.screenshot({path:out+'/passport.png'});
  await p.getByRole('tab',{name:'Registration file',exact:true}).click();await fit(p,['.inspector','.insp-body','.inspector .code']);
  await p.getByRole('tab',{name:'Assertion',exact:true}).click();await fit(p,['.inspector','.insp-body','.inspector .code']);
  await p.getByRole('tab',{name:'Live lookup',exact:true}).click();await p.getByLabel('Agent ID',{exact:true}).fill('999');await p.getByRole('button',{name:'Look up',exact:true}).click();await p.getByText('No agent #999',{exact:false}).waitFor();
  await fit(p,selectors);assert(await p.locator('.insp-body').evaluate(el=>el.getBoundingClientRect().height<300),'empty/error lookup should not reserve a desktop-sized blank panel');
  if(w===360)await p.screenshot({path:out+'/lookup.png'});
  await p.evaluate(()=>{const r=document.querySelector('#gate').getBoundingClientRect();scrollTo(0,r.top+scrollY);});await p.waitForTimeout(200);
  assert(await p.locator('.gate-card').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=70&&r.bottom<=innerHeight-16;}),'gate caption must fit at the arrival stop');
  await p.close();console.log('Passport bounds/tabs/lookup and gate caption fit',w,h);
 }
 const p=await open(390,844,false);
 // Reproduce a normal phone flick that starts within tall content, not exactly at an edge.
 const heroEnd=await p.evaluate(()=>{const r=document.querySelector('[data-stage="0"]').getBoundingClientRect();return r.bottom+scrollY-innerHeight;});
 await p.evaluate(y=>window.__lenis.scrollTo(Math.max(0,y-30),{immediate:true,force:true}),heroEnd);await p.waitForTimeout(100);
 const fling=await p.context().newCDPSession(p);
 await fling.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:10,y:650}]});
 for(const y of [648,644,610,450,150]){await fling.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:10,y}]});await p.waitForTimeout(8);}
 await fling.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await fling.detach();await p.waitForTimeout(800);
 const afterFling=await p.evaluate(()=>scrollY);console.log('Within-chapter flick boundary:',{heroEnd,afterFling});
 assert(afterFling<=heroEnd+3,'a gesture begun inside a chapter must stop at its bottom, not continuously cross into the next');

 assert(await p.locator('.rail').evaluate(el=>getComputedStyle(el).display==='none'),'mobile story rail must be removed from view and tab order');
 for(let i=0;i<=5;i++){
  await p.evaluate(i=>{const e=document.querySelector(`[data-stage="${i}"]`),r=e.getBoundingClientRect(),top=r.top+scrollY;window.__lenis.scrollTo(r.height>innerHeight+2?top+r.height-innerHeight:top-(innerHeight-r.height)/2,{immediate:true,force:true});},i);
  await p.waitForTimeout(450);
  const expected=await p.evaluate(i=>{const e=document.querySelector(`[data-stage="${i+1}"]`),r=e.getBoundingClientRect(),top=r.top+scrollY;return e.hasAttribute('data-entry')||r.height>innerHeight+2?top:top-(innerHeight-r.height)/2;},i);
  await swipe(p);await p.waitForFunction(y=>Math.abs(scrollY-y)<3&&!window.__lenis.isStopped,expected,{timeout:30000});
  if(i===4)await p.screenshot({path:out+'/portal-step.png'});
  console.log('Touch chapter step',i,'→',i+1);
 }
 // Reading tall policy content holds its camera stop rather than drifting to the next scene.
 await p.evaluate(()=>{const e=document.querySelector('[data-stage="3"]'),r=e.getBoundingClientRect();window.__lenis.scrollTo(r.bottom+scrollY-innerHeight-40,{immediate:true,force:true});});await p.waitForTimeout(200);
 assert.equal(await p.locator('.landing').getAttribute('data-beat'),'3');
 // Once inside, native reading never starts a story glide.
 await p.evaluate(()=>window.__lenis.scrollTo(document.querySelector('#passport'),{immediate:true,offset:100}));await p.waitForTimeout(200);const before=await p.evaluate(()=>scrollY);
 await swipe(p);assert.equal(await p.evaluate(()=>window.__lenis.isStopped),false);await p.waitForTimeout(350);assert((await p.evaluate(()=>scrollY))>before,'inside portal must retain native touch scrolling');
 // Return through the entry step in the opposite direction.
 await p.evaluate(()=>window.__lenis.scrollTo(document.querySelector('[data-entry]'),{immediate:true}));await p.waitForTimeout(200);
 const portal=await p.evaluate(()=>{const r=document.querySelector('[data-stage="5"]').getBoundingClientRect();return r.bottom+scrollY-innerHeight;});
 await swipe(p,-1);await p.waitForFunction(y=>Math.abs(scrollY-y)<3&&!window.__lenis.isStopped,portal,{timeout:30000});
 const zoom=await p.context().newCDPSession(p);await zoom.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});
 await p.waitForFunction(()=>document.documentElement.classList.contains('chapter-zoomed'));
 assert.equal(await p.locator('.hero').evaluate(el=>getComputedStyle(el).touchAction),'auto','zoomed reading must retain native panning');
 await zoom.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});await zoom.detach();
 await p.close();
 // Traverse from the initial page using ordinary repeated gestures, with no test positioning.
 const natural=await open(390,844,false);
 for(let chapter=0;chapter<6;chapter++){
   let arrived=false;
   for(let gesture=0;gesture<35;gesture++){
     const info=await natural.evaluate(i=>{
       const r=document.querySelector(`[data-stage="${i}"]`).getBoundingClientRect(),n=document.querySelector(`[data-stage="${i+1}"]`),nr=n.getBoundingClientRect();
       return {y:scrollY,end:r.bottom+scrollY-innerHeight,next:n.hasAttribute('data-entry')||nr.height>innerHeight+2?nr.top+scrollY:nr.top+scrollY-(innerHeight-nr.height)/2};
     },chapter);
     await swipe(natural);
     if(info.y>=info.end-3){
       await natural.waitForFunction(y=>Math.abs(scrollY-y)<3&&!window.__lenis.isStopped,info.next,{timeout:30000});arrived=true;await natural.waitForTimeout(400);break;
     }
     await natural.waitForTimeout(400);
     assert((await natural.evaluate(()=>scrollY))<=info.end+3,`reading gesture skipped chapter ${chapter}`);
   }
   assert(arrived,`could not leave chapter ${chapter} with ordinary touch gestures`);
   console.log('Natural touch journey reached chapter',chapter+1);
 }
 await natural.close();
 // Reduced motion preserves the chapter sequence with instant transitions.
 const still=await open(390,844,true);
 const stillGoal=await still.evaluate(()=>{const first=document.querySelector('[data-stage="0"]').getBoundingClientRect();scrollTo(0,first.bottom+scrollY-innerHeight);const next=document.querySelector('[data-stage="1"]').getBoundingClientRect();return next.top+scrollY;});
 await swipe(still);await still.waitForFunction(y=>Math.abs(scrollY-y)<3,stillGoal,{timeout:3000});await still.close();
 // The scroll controller also exists when WebGL cannot initialize.
 const fallback=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await fallback.addInitScript(()=>{sessionStorage.setItem('mihari.boot','1');HTMLCanvasElement.prototype.getContext=()=>null;});
 await fallback.goto(url);await fallback.waitForSelector('.w-static');
 const fallbackGoal=await fallback.evaluate(()=>{const first=document.querySelector('[data-stage="0"]').getBoundingClientRect();window.__lenis.scrollTo(first.bottom+scrollY-innerHeight,{immediate:true,force:true});const next=document.querySelector('[data-stage="1"]').getBoundingClientRect();return next.top+scrollY;});
 await swipe(fallback);await fallback.waitForFunction(y=>Math.abs(scrollY-y)<3&&!window.__lenis.isStopped,fallbackGoal,{timeout:30000});await fallback.close();
 assert.deepEqual(issues,[]);console.log('MOBILE CHECKS PASSED: component bounds, all passport tabs, no automatic lookup, touch chapters in/out, continuous portal interior.');
}finally{await browser.close();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
