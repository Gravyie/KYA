import {createHash, verify as edVerify} from 'node:crypto';

const GENESIS = '0'.repeat(64);
const fromB64 = s => Buffer.from(s, 'base64url');

/**
 * Verify a Sigilant agent assertion offline against a pinned registry key.
 * Revocation is not knowable offline: also call `checkStatus` for anything
 * that matters, or use the registry's `/api/verify` endpoint.
 */
export function verifyAssertion(token, {publicKey, audience, now = Date.now()} = {}) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return {valid: false, reason: 'Not a Sigilant assertion'};
  try {
    const header = JSON.parse(fromB64(parts[0]));
    if (header.alg !== 'EdDSA' || header.typ !== 'sigilant+jwt') return {valid: false, reason: 'Unsupported token type'};
    if (!edVerify(null, Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, fromB64(parts[2]))) {
      return {valid: false, reason: 'Signature does not match the pinned registry key'};
    }
    const claims = JSON.parse(fromB64(parts[1]));
    if (claims.exp * 1000 <= now) return {valid: false, reason: 'Assertion has expired', claims};
    if (claims.iat * 1000 > now + 30e3) return {valid: false, reason: 'Assertion is issued in the future', claims};
    if (audience && claims.aud !== audience) return {valid: false, reason: `Assertion is for ${claims.aud}, not ${audience}`, claims};
    return {valid: true, claims};
  } catch {
    return {valid: false, reason: 'Malformed assertion'};
  }
}

/** Ask the registry whether an agent is still active. Fails closed. */
export async function checkStatus(baseUrl, agentId, {fetchImpl = globalThis.fetch, timeoutMs = 4000} = {}) {
  try {
    const r = await fetchImpl(new URL(`/api/agents/${encodeURIComponent(agentId)}/status`, baseUrl), {signal: AbortSignal.timeout(timeoutMs)});
    if (!r.ok) return {active: false, reason: `Registry answered HTTP ${r.status}`};
    return await r.json();
  } catch {
    return {active: false, reason: 'Registry unreachable'};
  }
}

/** Verify an exported audit log without trusting the server that produced it. */
export function verifyAuditExport(file, {pinnedFingerprint} = {}) {
  const fp = createHash('sha256').update(file.publicKey).digest('hex');
  if (pinnedFingerprint && fp !== pinnedFingerprint) return {valid: false, reason: 'Registry key does not match the pinned fingerprint'};
  let previous = GENESIS;
  for (const e of file.events) {
    const {hash, ...rest} = e;
    if (e.previousHash !== previous || createHash('sha256').update(JSON.stringify(rest)).digest('hex') !== hash) {
      return {valid: false, reason: `Chain breaks at event ${e.seq ?? e.id}`, at: e.id};
    }
    previous = hash;
  }
  if (previous !== file.head || file.events.length !== file.count) return {valid: false, reason: 'Head does not match the events'};
  const signed = file.headSignature
    && edVerify(null, Buffer.from(JSON.stringify({head: file.head, count: file.count})), file.publicKey, fromB64(file.headSignature));
  return {valid: true, count: file.count, head: file.head, headSigned: !!signed, fingerprint: fp};
}
