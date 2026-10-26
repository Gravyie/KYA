import test from 'node:test';
import assert from 'node:assert/strict';
import {createParticlePhysics} from '../../web/src/landing/particle-physics.js';

test('touch-only particles render without allocating or calling a GPU simulation',()=>{
  // A missing renderer would fail immediately if compute targets were allocated.
  const physics=createParticlePhysics(null,{side:272,interactive:false});
  assert.equal(physics.enabled,false);
  assert.equal(physics.texture.value.image.width,1);
  assert.equal(physics.texture.value.image.height,1);
  assert.deepEqual([...physics.texture.value.image.data],[0,0,0,0]);
  assert.equal(physics.uv.length,272*272*2);
  physics.update(.016);physics.update(1);
  assert.deepEqual(physics.measure(),{enabled:false});
  physics.dispose();
});
