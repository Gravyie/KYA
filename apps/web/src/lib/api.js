/**
 * Thin API client. Every call goes through the Vite proxy so the browser makes
 * same-origin requests — no CORS to misconfigure on a conference network.
 *
 * Errors carry the server's own message. On stage a precise failure ("owner has
 * no World ID proof on record") beats a generic one, and the API already
 * produces good copy, so it is surfaced verbatim.
 */

async function call(path, body) {
  let res;
  try {
    res = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: body ? {'content-type': 'application/json'} : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the KYA API. Is it running on :5055?');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Prefer the contract's own error name. "The contract function reverted" is
    // useless on stage; "OwnerNotHumanVerified" is the demonstration.
    const message = json.revert ? `${json.revert}: the contract refused this` : json.error || `HTTP ${res.status}`;
    throw Object.assign(new Error(message), {status: res.status, revert: json.revert, payload: json});
  }
  return json;
}

export const api = {
  health: () => call('/health'),
  integrations: () => call('/api/integrations'),
  tasks: () => call('/api/tasks'),
  policy: () => call('/api/policy'),
  directory: () => call('/api/directory'),
  agent: (q) => call(`/api/agents/${encodeURIComponent(q)}`),
  compare: (queries, policy) => call('/api/compare', {queries, policy}),
  check: (query, capability, value, policy) => call('/api/check', {query, capability, value, policy}),
  dispatch: (payload) => call('/api/dispatch', payload),
  route: (payload) => call('/api/route', payload),
  record: (digest) => call(`/api/records/${digest}`),
  verifyHuman: (payload) => call('/api/verify-human', payload),
  createAgent: (payload) => call('/api/agents', payload),
};

// ── formatting ─────────────────────────────────────────────────────────────

export const pct = (bp, digits = 1) => `${(bp / 100).toFixed(digits)}%`;

export const short = (addr, head = 6, tail = 4) =>
  !addr ? 'none' : `${addr.slice(0, head)}…${addr.slice(-tail)}`;

/** Compact ETH-ish amount. The demo's spend unit is wei-denominated. */
export function amount(eth) {
  const n = Number(eth);
  if (!Number.isFinite(n)) return 'n/a';
  if (n === 0) return '0';
  if (n < 0.0001) return '<0.0001';
  if (n < 1) return n.toFixed(4).replace(/0+$/, '');
  if (n < 1000) return n.toFixed(n < 10 ? 3 : 2).replace(/\.?0+$/, '');
  return `${(n / 1000).toFixed(1)}k`;
}

export function ago(ts) {
  if (!ts) return 'never';
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
}

export function clock(ts) {
  if (!ts) return 'n/a';
  return new Date(ts * 1000).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
}

/**
 * The spend unit's ticker.
 *
 * Sourced as a named constant rather than typed inline in two components: the
 * chain is "0G" with a digit zero and the native currency is "OG" with a letter
 * O, and the two are visually identical in uppercase mono. Declaring it once
 * means the UI cannot drift from `chains.js` nativeCurrency.symbol.
 */
export const SPEND_SYMBOL = 'OG';

export const VERDICT_COPY = {
  trust: 'Trust',
  limit: 'Limit',
  decline: 'Decline',
};

/** Human name for a passport, falling back through the identifier ladder. */
export const nameOf = (p) => p?.ensName || p?.domain || (p ? `agent #${p.agentId}` : 'unknown');
