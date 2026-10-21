// A third-party API that only serves agents carrying a valid, unrevoked Sigilant
// assertion. This is the "Know Your Agent" check from the receiving side.
//   PINNED=<registry fingerprint> node examples/relying-party.mjs
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {verifyAssertion, checkStatus} from '../packages/sdk/src/index.js';

const registry = process.env.SIGILANT_URL || 'http://127.0.0.1:5055';
const port = Number(process.env.PORT || 5099);
const audience = `http://127.0.0.1:${port}`;
const reg = await (await fetch(new URL('/api/registry', registry))).json();
const pinned = process.env.PINNED;
if (!pinned) console.warn('PINNED fingerprint not set: trusting the registry key on first use (fine for a demo, not for production)');
if (pinned && createHash('sha256').update(reg.publicKey).digest('hex') !== pinned) throw new Error('Registry key does not match PINNED');

createServer(async (req, res) => {
  const send = (status, body) => { res.writeHead(status, {'content-type': 'application/json'}); res.end(JSON.stringify(body)); };
  const token = /^Bearer (.+)$/i.exec(req.headers.authorization || '')?.[1];
  if (!token) return send(401, {error: 'Agents must present a Sigilant assertion'});
  const result = verifyAssertion(token, {publicKey: reg.publicKey, audience});
  if (!result.valid) return send(403, {error: result.reason});
  const status = await checkStatus(registry, result.claims.sub);
  if (!status.active) return send(403, {error: 'Agent is no longer active'});
  send(200, {hello: result.claims.name, operatedBy: result.claims.operator, data: 'quarterly-report: 42'});
}).listen(port, '127.0.0.1', () => console.log(`Relying party on ${audience}`));
