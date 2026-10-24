import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TEMPLATES, toPayload} from '../../web/src/console/templates.js';
import {cleanLimits, cleanScopes, decide} from '../src/policy.js';

test('console policies reject invalid caps instead of serializing NaN to unlimited null', () => {
  const draft = structuredClone(TEMPLATES[0]);
  draft.scopes[0].maxAmount = 'not-a-number';
  assert.throws(() => toPayload(draft), /Rule 1 maximum amount/);
  draft.scopes[0].maxAmount = 0;
  assert.equal(toPayload(draft).scopes[0].maxAmount, 0);
  draft.limits.rate.count = '1.5';
  assert.throws(() => toPayload(draft), /Rate limit/);
  draft.limits.rate.count = '10'; draft.limits.rate.windowMinutes = 0;
  assert.throws(() => toPayload(draft), /Rate window/);
});

test('every console template validates and SDK walkthrough has allow, deny and approval paths', () => {
  for (const template of TEMPLATES) {
    const p = toPayload(template); cleanScopes(p.scopes); cleanLimits(p.limits);
  }
  const agent = {...toPayload(TEMPLATES.find(t => t.id === 'sdk')), revokedAt: null, expiresAt: null};
  assert.equal(decide(agent, {action: 'files.read', resource: 'workspace/README.md'}).outcome, 'allow');
  assert.equal(decide(agent, {action: 'files.read', resource: 'workspace/.env'}).outcome, 'deny');
  assert.equal(decide(agent, {action: 'files.write', resource: 'workspace/out/summary.md'}).outcome, 'ask');
});
