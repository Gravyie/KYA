import test from 'node:test';
import assert from 'node:assert/strict';
import {createChapterQueue} from '../../web/src/landing/chapter-queue.js';

function fixture(reduced=false){
  let y=0;const positions=[],activity=[];
  const queue=createChapterQueue({read:()=>y,write:value=>{y=value;positions.push(y);},reduced,
    onActivity:value=>activity.push(value),
    resolve:(request,from)=>({to:Math.max(0,from+request.dir*1000),kind:'chapter',duration:1350,route:{from:0,to:1}})});
  return {queue,positions,activity,get y(){return y;},set y(value){y=value;},advance(ms,dt=16){for(let t=0;t<ms;t+=dt)queue.tick(dt);}};
}
test('rapid gesture requests drain serially at the same maximum chapter rate',()=>{
  const f=fixture();for(let i=0;i<4;i++)f.queue.enqueue({dir:1,distance:100});
  f.advance(1300);assert(f.y<1000);f.advance(300);assert(f.y<1010);
  f.advance(6500);assert.equal(f.y,4000);assert.equal(f.queue.busy,false);
  assert(f.positions.every((y,i)=>i===0||y>=f.positions[i-1]));
});
test('delayed frames cannot fast-forward an animation or drain a queue',()=>{
  const f=fixture();f.queue.enqueue({dir:1});f.queue.enqueue({dir:1});f.advance(400);
  const before=f.y;f.queue.tick(5000);assert(f.y-before<50);assert(f.y<1000);
});
test('hold brakes continuously and discards pending intent until another request',()=>{
  const f=fixture();f.queue.enqueue({dir:1});f.queue.enqueue({dir:1});f.advance(600);
  const before=f.y;f.queue.hold();assert.equal(f.y,before);
  f.advance(240);const stopped=f.y;assert(stopped>before&&stopped<1000);
  f.advance(6000);assert.equal(f.y,stopped);assert.equal(f.queue.busy,false);
  f.queue.enqueue({dir:-1});f.advance(2000);assert.equal(f.y,0);
});
test('reversal brakes and replaces the forward backlog',()=>{
  const f=fixture();for(let i=0;i<5;i++)f.queue.enqueue({dir:1});f.advance(600);
  f.queue.enqueue({dir:-1});f.advance(2400);assert.equal(f.y,0);assert.equal(f.queue.busy,false);
});
test('external navigation cancels pending travel rather than pulling the page back',()=>{
  const f=fixture();f.queue.enqueue({dir:1});f.queue.enqueue({dir:1});f.advance(500);
  f.y=9000;f.advance(5000);assert.equal(f.y,9000);assert.equal(f.queue.busy,false);
});
test('reduced motion retains all queued destinations without animated travel',()=>{
  const f=fixture(true);for(let i=0;i<3;i++)f.queue.enqueue({dir:1});f.advance(64);
  assert.equal(f.y,3000);assert.equal(f.queue.busy,false);
});
