import {keccak256, toHex} from 'viem';
import {config, modes} from './config.js';
import {ProofKind} from '@kya/sdk';

/**
 * World ID integration.
 *
 * KYA's registry lives on 0G Galileo so that an agent's identity and its
 * execution receipts share one chain. The World ID Router
 * (`IWorldID.verifyProof`) is only deployed on World Chain, Optimism and
 * Ethereum — there is no canonical router on Galileo. So the zk proof is
 * verified against World's Developer Portal (`/api/v4/verify/{rp_id}`, with the
 * legacy `/api/v2/verify/{app_id}` path as a fallback for un-migrated apps), and
 * the *result* is carried on-chain by an EIP-712 attestation.
 *
 * The nullifier hash — the thing that actually makes World ID sybil-resistant —
 * is what gets stored and bound on-chain, so double-registration by one human is
 * prevented by the same mechanism World ID itself uses.
 *
 * Verification level is preserved end to end. A staging/simulator proof is
 * recorded as `WorldIdSimulator` and `isHumanVerified()` returns false for it.
 * There is no code path where a staging proof renders as a verified human.
 */

const V4_HOSTS = ['https://developer.world.org', 'https://developer.worldcoin.org'];

function identifierToProofKind(identifier, environment) {
  if (environment === 'staging') return ProofKind.WorldIdSimulator;
  switch (String(identifier || '').toLowerCase()) {
    case 'orb':
    case 'proof_of_human':
      return ProofKind.WorldIdOrb;
    case 'device':
    case 'selfie':
    case 'face':
      return ProofKind.WorldIdDevice;
    default:
      return ProofKind.WorldIdDevice;
  }
}

/**
 * Verify an IDKit result with World's cloud endpoint.
 * @param {object} idkitResult the complete, un-remapped IDKit response
 * @returns {Promise<{ok:boolean, kind:number, nullifierHash:string, environment:string, raw:object}>}
 */
export async function verifyWithWorld(idkitResult, {action} = {}) {
  const appId = config.world.appId;
  if (!appId) {
    throw Object.assign(new Error('WORLD_APP_ID is not configured'), {code: 'WORLD_NOT_CONFIGURED'});
  }

  const isRp = appId.startsWith('rp_');
  const body = {...idkitResult};
  if (!body.action && !body.session_id) body.action = action || config.world.action;

  let lastError = null;
  for (const host of V4_HOSTS) {
    const url = isRp
      ? `${host}/api/v4/verify/${appId}`
      : `${host}/api/v2/verify/${appId}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      const json = await res.json().catch(() => ({}));

      // An un-migrated app must fall back to the v2 shape rather than fail.
      if (json?.code === 'app_not_migrated') {
        const v2 = await fetch(`${host}/api/v2/verify/${appId}`, {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15_000),
        });
        const v2json = await v2.json().catch(() => ({}));
        if (v2.ok && v2json.success) return shapeSuccess(v2json, body);
        lastError = v2json;
        continue;
      }

      if (res.ok && json.success) return shapeSuccess(json, body);
      lastError = json;
    } catch (err) {
      lastError = {code: 'network_error', detail: String(err?.message || err)};
    }
  }

  throw Object.assign(new Error(lastError?.detail || 'World ID verification failed'), {
    code: lastError?.code || 'verification_failed',
    worldResponse: lastError,
  });
}

function shapeSuccess(json, request) {
  const result = (json.results || []).find((r) => r.success !== false) || {};
  const nullifier = json.nullifier || result.nullifier;
  if (!nullifier) {
    throw Object.assign(new Error('World ID response carried no nullifier'), {code: 'no_nullifier'});
  }
  const environment = json.environment || request.environment || 'production';
  return {
    ok: true,
    kind: identifierToProofKind(result.identifier || request?.responses?.[0]?.identifier, environment),
    nullifierHash: normalizeNullifier(nullifier),
    environment,
    identifier: result.identifier || request?.responses?.[0]?.identifier || 'unknown',
    action: json.action || request.action || config.world.action,
    raw: json,
  };
}

function normalizeNullifier(n) {
  const hex = String(n).startsWith('0x') ? String(n).slice(2) : String(n);
  return `0x${hex.padStart(64, '0').slice(-64)}`;
}

/**
 * Local stand-in used when no WORLD_APP_ID is configured (offline dev, judging
 * rehearsal without a phone). It derives a deterministic nullifier from a seed
 * and — critically — reports `ProofKind.WorldIdSimulator`, which the registry
 * refuses for agent registration. The API labels responses produced this way
 * with `mode: "local:attestor-signed"` and the UI renders that label, so a
 * simulated proof is never presented as a real one.
 */
export function localHumanhoodStub(seed) {
  return {
    ok: true,
    kind: ProofKind.WorldIdSimulator,
    nullifierHash: keccak256(toHex(`kya.local.nullifier:${seed}`)),
    environment: 'staging',
    identifier: 'local_stub',
    action: config.world.action,
    raw: {simulated: true, note: 'No WORLD_APP_ID configured — locally derived nullifier.'},
  };
}

export const worldMode = modes.worldId;
