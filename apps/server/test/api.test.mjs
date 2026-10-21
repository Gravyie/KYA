import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {createSigilant, SigilantDeniedError, verifyAssertion, verifyAuditExport} from '../../../packages/sdk/src/index.js';
import {decide} from '../src/policy.js';
import {createServer} from 'node:http';
import {encodeRegister, encodeSetAgentURI, decodeString, fromDataUri, parseRegisteredLog, REGISTERED_TOPIC, registrationFile} from '../../../packages/sdk/src/erc8004.js';

let dir, server, base, owner, rpc;
const registry = new Map(); // agentId -> {owner, uri}: a stand-in ERC-8004 Identity Registry
const port = 53000 + Math.floor(Math.random() * 2000);

async function api(path, {method = 'GET', key = '', body} = {}) {
  const r = await fetch(base + path, {
    method, headers: {...(key ? {authorization: 'Bearer ' + key} : {}), ...(body ? {'content-type': 'application/json'} : {})},
    body: body ? JSON.stringify(body) : undefined,
  });
  return {status: r.status, data: await r.json()};
}
const makeAgent = async (name, scopes, extra = {}) => (await api('/api/agents', {method: 'POST', key: owner, body: {name, scopes, ...extra}})).data;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'sigilant-'));
  base = 'http://127.0.0.1:' + port;
  const word = n => BigInt(n).toString(16).padStart(64, '0');
  rpc = createServer((req, res) => {
    let body = ''; req.on('data', c => { body += c; });
    req.on('end', () => {
      const {id, params} = JSON.parse(body); const data = params[0].data; const agentId = BigInt('0x' + data.slice(10, 74)).toString();
      const entry = registry.get(agentId); const reply = o => res.end(JSON.stringify({jsonrpc: '2.0', id, ...o}));
      if (!entry) return reply({error: {code: 3, message: 'execution reverted: ERC721NonexistentToken'}});
      if (data.startsWith('0x6352211e')) return reply({result: '0x' + '0'.repeat(24) + entry.owner.slice(2)});
      const b = Buffer.from(entry.uri); const padded = b.toString('hex').padEnd(Math.ceil(b.length / 32) * 64, '0');
      reply({result: '0x' + word(32) + word(b.length) + padded});
    });
  }).listen(0, '127.0.0.1');
  await new Promise(r => rpc.once('listening', r));
  server = spawn(process.execPath, [resolve('apps/server/src/index.js')], {env: {...process.env, SIGILANT_DATA_DIR: dir, PORT: String(port), SIGILANT_RPC_84532: `http://127.0.0.1:${rpc.address().port}`}, stdio: 'ignore'});
  for (let i = 0; i < 60; i++) { try { await api('/health'); break; } catch { await new Promise(r => setTimeout(r, 50)); } }
  owner = (await api('/api/setup', {method: 'POST', body: {name: 'Test owner'}})).data.key;
});
after(async () => { server.kill(); rpc.close(); await rm(dir, {recursive: true, force: true}); });

test('policy: deny beats allow, default deny, amount caps, wildcards', () => {
  const agent = {revokedAt: null, expiresAt: null, limits: {}, scopes: [
    {action: 'files.*', resources: ['workspace/*'], mode: 'allow', maxAmount: null},
    {action: 'files.read', resources: ['workspace/.env'], mode: 'deny', maxAmount: null},
    {action: 'pay', resources: ['*'], mode: 'allow', maxAmount: 50},
    {action: 'email.send', resources: ['*'], mode: 'ask', maxAmount: null},
  ]};
  assert.equal(decide(agent, {action: 'files.read', resource: 'workspace/a.md'}).outcome, 'allow');
  assert.equal(decide(agent, {action: 'files.read', resource: 'workspace/.env'}).outcome, 'deny');
  assert.equal(decide(agent, {action: 'shell.run', resource: 'ls'}).outcome, 'deny');
  assert.equal(decide(agent, {action: 'pay', resource: 'acme', amount: 50}).outcome, 'allow');
  assert.equal(decide(agent, {action: 'pay', resource: 'acme', amount: 51}).outcome, 'deny');
  assert.equal(decide(agent, {action: 'email.send', resource: 'x@y.z'}).outcome, 'ask');
  assert.equal(decide({...agent, expiresAt: new Date(Date.now() - 1000).toISOString()}, {action: 'files.read', resource: 'workspace/a.md'}).outcome, 'deny');
});

test('lifecycle: registry, policy, receipts, rotation, revocation, audit integrity', async () => {
  assert.equal((await api('/api/dashboard')).status, 401);
  const {agent, key} = await makeAgent('Reader', [{action: 'files.read', resources: ['workspace/*']}]);
  const sdk = createSigilant({agentKey: key, baseUrl: base});
  let calls = 0;
  assert.equal(await sdk.run({action: 'files.read', resource: 'workspace/r.md'}, () => (calls++, 'ok')), 'ok');
  await assert.rejects(() => sdk.run({action: 'files.write', resource: 'workspace/r.md'}, () => calls++), SigilantDeniedError);
  const offline = createSigilant({agentKey: key, fetchImpl: async () => { throw Error('offline'); }});
  await assert.rejects(() => offline.run({action: 'files.read', resource: 'workspace/r.md'}, () => calls++), {code: 'UNREACHABLE'});
  assert.equal(calls, 1);

  const card = (await api(`/api/agents/${agent.id}/card`)).data;
  assert.equal(card.card.operator, 'Test owner');
  assert.equal((await api('/api/audit/verify', {key: owner})).data.valid, true);

  const rotated = (await api(`/api/agents/${agent.id}/rotate`, {method: 'POST', key: owner})).data;
  assert.equal((await api('/api/authorize', {method: 'POST', key, body: {action: 'files.read', resource: 'workspace/r.md'}})).status, 401);
  await api(`/api/agents/${agent.id}/revoke`, {method: 'POST', key: owner});
  const after = await api('/api/authorize', {method: 'POST', key: rotated.key, body: {action: 'files.read', resource: 'workspace/r.md'}});
  assert.equal(after.data.decision.allowed, false);
  assert.equal((await api(`/api/agents/${agent.id}/status`)).data.active, false);
});

test('human approval: pending until the owner decides', async () => {
  const {key} = await makeAgent('Mailer', [{action: 'email.send', resources: ['*'], mode: 'ask'}]);
  const sdk = createSigilant({agentKey: key, baseUrl: base, pollMs: 50});
  let ran = 0;
  const pending = sdk.run({action: 'email.send', resource: 'cfo@acme.com', note: 'Send Q3 numbers'}, () => (ran++, 'sent'));
  await new Promise(r => setTimeout(r, 200));
  const dash = (await api('/api/dashboard', {key: owner})).data;
  const ap = dash.approvals.find(a => a.status === 'pending' && a.resource === 'cfo@acme.com');
  assert.ok(ap); assert.equal(ran, 0); assert.equal(ap.note, 'Send Q3 numbers');
  await api(`/api/approvals/${ap.id}/resolve`, {method: 'POST', key: owner, body: {approve: true}});
  assert.equal(await pending, 'sent');
  assert.equal((await api(`/api/approvals/${ap.id}/resolve`, {method: 'POST', key: owner, body: {approve: false}})).status, 409);

  const denied = sdk.run({action: 'email.send', resource: 'press@news.com'}, () => ran++);
  await new Promise(r => setTimeout(r, 200));
  const ap2 = (await api('/api/dashboard', {key: owner})).data.approvals.find(a => a.status === 'pending');
  await api(`/api/approvals/${ap2.id}/resolve`, {method: 'POST', key: owner, body: {approve: false}});
  await assert.rejects(denied, SigilantDeniedError);
  assert.equal(ran, 1);
});

test('budget and rate limits are enforced from the audit trail', async () => {
  const {key} = await makeAgent('Spender', [{action: 'pay', resources: ['*']}], {limits: {budget: {amount: 100, windowHours: 24}, rate: {count: 3, windowMinutes: 1}}});
  const pay = amount => api('/api/authorize', {method: 'POST', key, body: {action: 'pay', resource: 'acme', amount}});
  assert.equal((await pay(60)).data.decision.allowed, true);
  const over = await pay(60);
  assert.equal(over.data.decision.allowed, false); assert.match(over.data.decision.reason, /Budget exceeded/);
  assert.equal((await pay(30)).data.decision.allowed, true);
  assert.equal((await pay(1)).data.decision.allowed, true);
  assert.match((await pay(1)).data.decision.reason, /Rate limit/);
});

test('assertions verify offline, bind to an audience, and die on revocation', async () => {
  const {agent, key} = await makeAgent('Caller', [{action: 'api.call', resources: ['*']}]);
  const sdk = createSigilant({agentKey: key, baseUrl: base});
  const {token} = await sdk.assertion('https://partner.example');
  const reg = (await api('/api/registry')).data;
  assert.equal(verifyAssertion(token, {publicKey: reg.publicKey, audience: 'https://partner.example'}).valid, true);
  assert.equal(verifyAssertion(token, {publicKey: reg.publicKey, audience: 'https://evil.example'}).valid, false);
  assert.equal(verifyAssertion(token.slice(0, -4) + 'AAAA', {publicKey: reg.publicKey}).valid, false);
  assert.equal((await api('/api/verify', {method: 'POST', body: {token}})).data.valid, true);
  await api(`/api/agents/${agent.id}/revoke`, {method: 'POST', key: owner});
  const after = (await api('/api/verify', {method: 'POST', body: {token}})).data;
  assert.equal(after.valid, false); assert.match(after.reason, /revoked/);
  await assert.rejects(() => sdk.assertion('https://partner.example'));
});

test('exported audit log verifies offline and detects tampering', async () => {
  const file = (await api('/api/audit/export', {key: owner})).data;
  const reg = (await api('/api/registry')).data;
  const ok = verifyAuditExport(file, {pinnedFingerprint: reg.fingerprint});
  assert.equal(ok.valid, true); assert.equal(ok.headSigned, true);
  const forged = structuredClone(file);
  forged.events[3].details.reason = 'edited';
  assert.equal(verifyAuditExport(forged).valid, false);
  assert.equal(verifyAuditExport(file, {pinnedFingerprint: '0'.repeat(64)}).valid, false);
});

test('MCP guard: allows, blocks, filters tools, and logs receipts', async () => {
  const {key} = await makeAgent('Claude', [
    {action: 'read_file', resources: [resolve('.') + '/*']},
    {action: 'send_payment', resources: ['*'], maxAmount: 25},
  ]);
  const proxy = spawn(process.execPath, [resolve('packages/mcp/bin/sigilant-mcp.js'), '--', process.execPath, resolve('examples/demo-mcp-server.mjs')],
    {env: {...process.env, SIGILANT_AGENT_KEY: key, SIGILANT_URL: base}, stdio: ['pipe', 'pipe', 'ignore']});
  const pending = new Map();
  createInterface({input: proxy.stdout}).on('line', l => { const m = JSON.parse(l); pending.get(m.id)?.(m); });
  let id = 0;
  const rpc = (method, params) => new Promise(res => { const n = ++id; pending.set(n, res); proxy.stdin.write(JSON.stringify({jsonrpc: '2.0', id: n, method, params}) + '\n'); });
  try {
    await rpc('initialize', {});
    const list = await rpc('tools/list', {});
    assert.deepEqual(list.result.tools.map(t => t.name).sort(), ['read_file', 'send_payment']);
    const good = await rpc('tools/call', {name: 'read_file', arguments: {path: 'package.json'}});
    assert.ok(!good.result.isError); assert.match(good.result.content[0].text, /sigilant/);
    const esc = await rpc('tools/call', {name: 'read_file', arguments: {path: '/etc/hosts'}});
    assert.equal(esc.result.isError, true); assert.match(esc.result.content[0].text, /Blocked by Sigilant/);
    const hidden = await rpc('tools/call', {name: 'write_file', arguments: {path: 'x', content: 'y'}});
    assert.equal(hidden.result.isError, true);
    const big = await rpc('tools/call', {name: 'send_payment', arguments: {to: 'acme', amount: 500}});
    assert.equal(big.result.isError, true); assert.match(big.result.content[0].text, /over the 25 limit/);
    await new Promise(r => setTimeout(r, 300));
    const kinds = (await api('/api/dashboard', {key: owner})).data.events.map(e => e.kind);
    assert.ok(kinds.includes('action.reported'));
  } finally { proxy.kill(); }
});

test('ERC-8004: calldata matches the real registry ABI, registration file is spec-shaped', () => {
  // Produced by `cast calldata "register(string)" "data:application/json;base64,eyJ0eXBlIjoidGVzdCJ9"`
  const expected = '0xf2c298be00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000031646174613a6170706c69636174696f6e2f6a736f6e3b6261736536342c65794a306558426c496a6f696447567a64434a39000000000000000000000000000000';
  assert.equal(encodeRegister('data:application/json;base64,eyJ0eXBlIjoidGVzdCJ9'), expected);
  assert.match(encodeSetAgentURI(7, 'ipfs://x'), /^0x0af28bd3/);
  assert.equal(decodeString('0x' + '20'.padStart(64, '0') + '3'.padStart(64, '0') + Buffer.from('abc').toString('hex').padEnd(64, '0')), 'abc');
  const receipt = {logs: [{address: '0x8004A818BFB912233c491871b3d84c89A494BD9e', topics: [REGISTERED_TOPIC, '0x' + (10353).toString(16).padStart(64, '0')]}]};
  assert.equal(parseRegisteredLog(receipt, '0x8004a818bfb912233c491871b3d84c89a494bd9e'), '10353');
  const file = registrationFile({agent: {id: 'a-1', name: 'Bot', description: '', status: 'active', scopes: [{action: 'read_file', mode: 'allow'}, {action: 'rm', mode: 'deny'}]}, operator: 'Acme', origin: 'https://reg.example', issuer: 'sigilant:abc', fingerprint: 'ff', onchain: null});
  assert.equal(file.type, 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1');
  assert.deepEqual(file.sigilant.actions, ['read_file']);
  assert.equal(file.services[0].endpoint, 'https://reg.example/api/agents/a-1/card');
});

test('ERC-8004: link a registered agent on-chain; assertions and verification carry it', async () => {
  const {agent, key} = await makeAgent('Onchain bot', [{action: 'api.call', resources: ['*']}]);
  const info = (await api(`/api/agents/${agent.id}/erc8004`, {key: owner})).data;
  assert.equal(info.file.sigilant.agentId, agent.id);
  assert.ok(info.agentURI.startsWith('data:application/json;base64,'));
  assert.equal((await api(`/api/agents/${agent.id}/registration.json`)).data.name, 'Onchain bot');

  // not registered yet -> refuse
  assert.equal((await api(`/api/agents/${agent.id}/onchain`, {method: 'POST', key: owner, body: {chainId: 84532, agentId: 7}})).status, 404);
  const wallet = '0x21fdEd74C901129977B8e28C2588595163E1e235';
  registry.set('7', {owner: wallet, uri: info.agentURI});
  // a different wallet claim is refused
  assert.equal((await api(`/api/agents/${agent.id}/onchain`, {method: 'POST', key: owner, body: {chainId: 84532, agentId: 7, owner: '0x' + '1'.repeat(40)}})).status, 409);
  const linked = await api(`/api/agents/${agent.id}/onchain`, {method: 'POST', key: owner, body: {chainId: 84532, agentId: 7, owner: wallet}});
  assert.equal(linked.status, 200); assert.equal(linked.data.agent.onchain.uriBound, true);
  assert.equal(fromDataUri(info.agentURI).sigilant.agentId, agent.id);

  const card = (await api(`/api/agents/${agent.id}/card`)).data.card;
  assert.equal(card.erc8004.agentId, '7');
  assert.equal(card.erc8004.agentRegistry, 'eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e');
  assert.equal((await api(`/api/agents/${agent.id}/registration.json`)).data.registrations[0].agentId, 7);

  const sdk = createSigilant({agentKey: key, baseUrl: base});
  const {token, claims} = await sdk.assertion('https://partner.example');
  assert.equal(claims.erc8004.agentId, '7');
  const verified = (await api('/api/verify', {method: 'POST', body: {token}})).data;
  assert.equal(verified.valid, true); assert.equal(verified.onchain.ok, true); assert.equal(verified.onchain.bound, true);

  // ownership moves on-chain -> verification flags it
  registry.set('7', {owner: '0x' + '2'.repeat(40), uri: info.agentURI});
  assert.equal((await api('/api/verify', {method: 'POST', body: {token}})).data.onchain.ok, false);

  const lookup = (await api('/api/chain/lookup?chainId=84532&agentId=7')).data;
  assert.equal(lookup.registration.name, 'Onchain bot'); assert.equal(lookup.chain.name, 'Base Sepolia');
  assert.equal((await api('/api/chain/lookup?chainId=84532&agentId=999')).status, 404);
  assert.equal((await api('/api/chain/lookup?chainId=1&agentId=1')).status, 400);
});

test('owner key recovery from the host terminal', async () => {
  const r = spawnSync(process.execPath, [resolve('scripts/recover-owner.mjs')], {env: {...process.env, SIGILANT_DATA_DIR: dir, SIGILANT_URL: base}, encoding: 'utf8'});
  assert.equal(r.status, 0, r.stderr);
  const fresh = r.stdout.match(/sgo_[A-Za-z0-9_-]+/)[0];
  assert.equal((await api('/api/dashboard', {key: owner})).status, 401);
  assert.equal((await api('/api/dashboard', {key: fresh})).status, 200);
  assert.equal((await api('/api/audit/verify', {key: fresh})).data.valid, true);
});

