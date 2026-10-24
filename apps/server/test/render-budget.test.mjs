import test from 'node:test';
import assert from 'node:assert/strict';
import {renderBudget,renderRatio} from '../../web/src/landing/render-budget.js';
test('render budget covers touch tablets and constrained desktops without dimming the palette',()=>{
  assert.equal(renderBudget({width:1024,coarse:true}).compact,true);
  assert.equal(renderBudget({width:1920,memory:4}).compact,true);
  assert.equal(renderBudget({width:1920,cores:4}).maxDpr,1);
  assert.equal(renderBudget({width:1920}).compact,false);
});
test('render resolution stays within pixel budget, device resolution and quality caps',()=>{
  for(const width of [320,768,1440,3840,7680])for(const height of [480,900,2160]){
    const b=renderBudget({width});
    const ratios=[2,1,0].map(q=>renderRatio(b,width,height,3,q));
    assert(ratios[0]>=ratios[1]&&ratios[1]>=ratios[2]);
    for(const r of ratios)assert(width*height*r*r<=b.maxPixels+1);
    assert(renderRatio(b,width,height,1)<=1);
  }
});
