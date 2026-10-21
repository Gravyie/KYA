const STORE = 'shuin.owner';
export const ownerKey = {
  get() { try { return localStorage.getItem(STORE) || ''; } catch { return ''; } },
  set(k) { try { localStorage.setItem(STORE, k); } catch { /* private mode */ } },
  clear() { try { localStorage.removeItem(STORE); } catch { /* private mode */ } },
};

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function call(path, {method = 'GET', key, body} = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: {...(key ? {authorization: `Bearer ${key}`} : {}), ...(body ? {'content-type': 'application/json'} : {})},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the Shuin server. Is it running?', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  return data;
}

const owned = (path, opts = {}) => call(path, {...opts, key: ownerKey.get()});

export const api = {
  status: () => call('/api/status'),
  registry: () => call('/api/registry'),
  preview: (scopes, request, limits) => call('/api/preview', {method: 'POST', body: {scopes, request, limits}}),
  setup: name => call('/api/setup', {method: 'POST', body: {name}}),
  dashboard: key => call('/api/dashboard', {key: key ?? ownerKey.get()}),
  createAgent: body => owned('/api/agents', {method: 'POST', body}),
  updatePolicy: (id, body) => owned(`/api/agents/${id}/policy`, {method: 'PUT', body}),
  simulate: (id, body) => owned(`/api/agents/${id}/simulate`, {method: 'POST', body}),
  rotate: id => owned(`/api/agents/${id}/rotate`, {method: 'POST'}),
  revoke: id => owned(`/api/agents/${id}/revoke`, {method: 'POST'}),
  resolve: (id, approve, note) => owned(`/api/approvals/${id}/resolve`, {method: 'POST', body: {approve, note}}),
  verifyChain: () => owned('/api/audit/verify'),
  exportAudit: () => owned('/api/audit/export'),
  card: id => call(`/api/agents/${id}/card`),
  erc8004: id => owned(`/api/agents/${id}/erc8004`),
  linkOnchain: (id, body) => owned(`/api/agents/${id}/onchain`, {method: 'POST', body}),
  chains: () => call('/api/chains'),
  lookup: (chainId, agentId) => call(`/api/chain/lookup?chainId=${chainId}&agentId=${encodeURIComponent(agentId)}`),
  verifyToken: (token, audience) => call('/api/verify', {method: 'POST', body: {token, audience}}),
};
