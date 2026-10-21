import {createHash, verify} from 'node:crypto';

const [cardUrl, expectedFingerprint] = process.argv.slice(2);
if (!cardUrl || !/^[a-f0-9]{64}$/i.test(expectedFingerprint || '')) {
  throw new Error('Usage: node examples/verify-card.mjs <card-url> <pinned-public-key-fingerprint>');
}
const url = new URL(cardUrl);
const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
  throw new Error('Use HTTPS for remote registries');
}
if (!url.pathname.endsWith('/card')) throw new Error('Expected an agent card URL ending in /card');
async function get(location) {
  const response = await fetch(location, {signal:AbortSignal.timeout(5000)});
  if (!response.ok) throw new Error(`Registry returned HTTP ${response.status}`);
  return response.json();
}
const envelope = await get(url);
const fingerprint = createHash('sha256').update(envelope.publicKey).digest('hex');
if (fingerprint !== expectedFingerprint.toLowerCase()) throw new Error('Registry public key does not match the pinned fingerprint');
if (envelope.algorithm !== 'Ed25519' || !verify(null, Buffer.from(JSON.stringify(envelope.card)), envelope.publicKey, Buffer.from(envelope.signature, 'base64url'))) {
  throw new Error('Agent card signature is invalid');
}
const statusUrl = new URL(url);
statusUrl.pathname = statusUrl.pathname.slice(0, -'/card'.length) + '/status';
const status = await get(statusUrl);
if (status.id !== envelope.card.id) throw new Error('Card and status refer to different agents');
if (!status.active || envelope.card.revokedAt) throw new Error('Agent is revoked');
console.log(JSON.stringify({verified:true,id:envelope.card.id,name:envelope.card.name,scopes:envelope.card.scopes,fingerprint},null,2));
