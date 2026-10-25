import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {existsSync, createReadStream, statSync} from 'node:fs';
import {resolve, extname, sep} from 'node:path';
import {cleanScopes, cleanLimits, parseRequest, decide, fail} from './policy.js';
import {sha256, newToken, now, safeEqual, GENESIS} from './store-core.js';
import {verifyAssertion} from '../../../packages/sdk/src/verify.js';
import {registrationFile, toDataUri, agentRegistryId, encodeRegister} from '../../../packages/sdk/src/erc8004.js';
import {chainList, getChain, readIdentity} from './chain.js';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
};
const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "font-src 'self' data:",
  "img-src 'self' data: blob:", "connect-src 'self' https: http://127.0.0.1:* http://localhost:*",
  "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'",
].join('; ');

export function createHandler(store, {webDist, root = process.cwd(), publicUrl} = {}) {
  const {state, events} = store;
  const bearer = req => /^Bearer (.+)$/i.exec(req.headers.authorization || '')?.[1] || '';
  const issuer = () => `mihari:${store.fingerprint().slice(0, 16)}`;
  const origin = req => (publicUrl || process.env.MIHARI_PUBLIC_URL)?.replace(/\/$/, '') || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
  const lookups = new Map(); // tiny per-IP limiter for the public chain reader
  const allowLookup = req => {
    const ip = req.socket.remoteAddress, now = Date.now(), hits = (lookups.get(ip) ?? []).filter(t => now - t < 60e3);
    if (hits.length >= 30) return false;
    hits.push(now); lookups.set(ip, hits); return true;
  };

  function ownerAuth(req) {
    if (!state.owner) fail(403, 'Set up an owner first');
    if (!safeEqual(sha256(bearer(req)), state.owner.keyHash)) fail(401, 'Owner key required');
  }
  function agentAuth(req) {
    const supplied = sha256(bearer(req));
    const agent = state.agents.find(a => safeEqual(supplied, a.keyHash));
    if (!agent) fail(401, 'Valid agent key required');
    return agent;
  }
  const findAgent = id => state.agents.find(a => a.id === id) ?? fail(404, 'Agent not found');
  const expired = a => !!a.expiresAt && Date.parse(a.expiresAt) <= Date.now();

  const view = (a, stats) => ({
    id: a.id, name: a.name, description: a.description, createdAt: a.createdAt, revokedAt: a.revokedAt,
    expiresAt: a.expiresAt, scopes: a.scopes, limits: a.limits, lastUsedAt: a.lastUsedAt, keyHint: a.keyHint,
    status: a.revokedAt ? 'revoked' : expired(a) ? 'expired' : 'active', onchain: a.onchain ?? null,
    stats: stats ?? {allowed: 0, denied: 0, asked: 0, last24h: 0},
  });

  function statsByAgent() {
    const map = new Map();
    const dayAgo = Date.now() - 864e5;
    for (const e of events) {
      if (!e.agentId) continue;
      const s = map.get(e.agentId) ?? {allowed: 0, denied: 0, asked: 0, last24h: 0};
      if (e.kind === 'action.allowed' || e.kind === 'approval.granted') s.allowed++;
      else if (e.kind === 'action.denied' || e.kind === 'approval.denied') s.denied++;
      else if (e.kind === 'action.pending') s.asked++;
      if (e.kind.startsWith('action.') && Date.parse(e.at) > dayAgo) s.last24h++;
      map.set(e.agentId, s);
    }
    return map;
  }

  /** Pending approvals lapse to "expired" lazily, with an audit event. */
  function sweepApprovals() {
    let changed = false;
    for (const ap of state.approvals) {
      if (ap.status === 'pending' && Date.parse(ap.expiresAt) <= Date.now()) {
        ap.status = 'expired'; ap.resolvedAt = now(); changed = true;
        store.append(ap.agentId, 'approval.expired', {eventId: ap.id, action: ap.action, resource: ap.resource});
      }
    }
    if (changed) store.save();
  }

  const routes = [];
  const route = (method, pattern, fn, opts = {}) => routes.push({method, pattern, fn, public: !!opts.public});

  route('GET', /^\/health$/, () => ({ok: true, product: 'Wardrail', storage: store.storage || 'local', events: events.length}), {public: true});
  route('GET', /^\/api\/registry$/, () => ({
    product: 'Wardrail', issuer: issuer(), algorithm: 'Ed25519', publicKey: store.publicKey(), fingerprint: store.fingerprint(),
  }), {public: true});
  route('GET', /^\/api\/status$/, () => ({
    configured: !!state.owner, storage: store.storage || 'local', owner: state.owner?.name ?? null, agentCount: state.agents.length, eventCount: events.length,
  }), {public: true});

  route('POST', /^\/api\/preview$/, (_req, b) => {
    const agent = {revokedAt: null, expiresAt: null, scopes: cleanScopes(b.scopes), limits: cleanLimits(b.limits)};
    return {decision: decide(agent, b.request ?? {}), preview: true};
  });

  route('POST', /^\/api\/setup$/, (_req, b) => {
    if (state.owner) fail(409, 'Owner already configured');
    const name = String(b.name ?? '').trim();
    if (name.length < 2 || name.length > 80) fail(400, 'Owner name must be 2 to 80 characters');
    const key = newToken('mio');
    state.owner = {name, keyHash: sha256(key), createdAt: now()};
    store.append(null, 'owner.created', {name}); store.save();
    return {owner: {name}, key, notice: 'Save this key. It is shown once and cannot be recovered.'};
  });

  route('POST', /^\/api\/owner\/recover$/, req => {
    if (!state.owner) fail(409, 'Set up an owner first');
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) fail(403, 'Local recovery only');
    if (!safeEqual(sha256(bearer(req)), store.recoveryHash())) fail(401, 'Local recovery credential required');
    const key = newToken('mio');
    state.owner.keyHash = sha256(key);
    store.append(null, 'owner.key.recovered', {method: 'local-terminal'}); store.save();
    return {key, notice: 'The previous owner key is invalid. Save this new key now.'};
  });

  route('GET', /^\/api\/dashboard$/, req => {
    ownerAuth(req); sweepApprovals();
    const stats = statsByAgent();
    const pending = state.approvals.filter(a => a.status === 'pending');
    const recent = state.approvals.filter(a => a.status !== 'pending').slice(-30).reverse();
    return {
      owner: state.owner.name, registry: {fingerprint: store.fingerprint(), issuer: issuer()},
      paths: {mcp: resolve(root, 'packages/mcp/bin/mihari-mcp.js'), sdk: resolve(root, 'packages/sdk'), examples: resolve(root, 'examples')},
      agents: state.agents.map(a => view(a, stats.get(a.id))),
      approvals: [...pending, ...recent], eventCount: events.length, events: events.slice(-300).reverse(),
    };
  });

  function newAgentFields(b, existing) {
    const out = {};
    if (b.scopes !== undefined || !existing) out.scopes = cleanScopes(b.scopes);
    if (b.limits !== undefined || !existing) out.limits = cleanLimits(b.limits);
    if (b.description !== undefined || !existing) out.description = String(b.description ?? '').slice(0, 240);
    if (b.expiresInHours !== undefined) {
      if (b.expiresInHours === null || b.expiresInHours === '') out.expiresAt = null;
      else {
        const h = Number(b.expiresInHours);
        if (!Number.isFinite(h) || h <= 0 || h > 24 * 365) fail(400, 'Expiry must be between 1 hour and 1 year');
        out.expiresAt = new Date(Date.now() + h * 3600e3).toISOString();
      }
    }
    return out;
  }

  route('POST', /^\/api\/agents$/, (req, b) => {
    ownerAuth(req);
    const name = String(b.name ?? '').trim();
    if (name.length < 2 || name.length > 80) fail(400, 'Agent name must be 2 to 80 characters');
    const key = newToken('mia');
    const agent = {
      id: randomUUID(), name, createdAt: now(), revokedAt: null, expiresAt: null,
      keyHash: sha256(key), keyHint: key.slice(-6), lastUsedAt: null, ...newAgentFields(b, null),
    };
    state.agents.push(agent);
    store.append(agent.id, 'agent.created', {name, scopes: agent.scopes, limits: agent.limits, expiresAt: agent.expiresAt});
    store.save();
    return {agent: view(agent), key, notice: 'Save this key. It is shown once.'};
  });

  route('PUT', /^\/api\/agents\/([^/]+)\/policy$/, (req, b, [id]) => {
    ownerAuth(req);
    const a = findAgent(id);
    if (a.revokedAt) fail(409, 'Agent is revoked');
    Object.assign(a, newAgentFields(b, a));
    store.append(id, 'agent.policy.updated', {scopes: a.scopes, limits: a.limits, expiresAt: a.expiresAt});
    store.save();
    return {agent: view(a)};
  });

  route('POST', /^\/api\/agents\/([^/]+)\/simulate$/, (req, b, [id]) => {
    ownerAuth(req);
    const a = findAgent(id);
    return {agentId: id, decision: decide(a, b, store.usage(a)), preview: true};
  });

  route('POST', /^\/api\/agents\/([^/]+)\/rotate$/, (req, _b, [id]) => {
    ownerAuth(req);
    const a = findAgent(id);
    if (a.revokedAt) fail(409, 'Agent is revoked');
    const key = newToken('mia');
    a.keyHash = sha256(key); a.keyHint = key.slice(-6);
    store.append(id, 'agent.key.rotated', {}); store.save();
    return {agent: view(a), key};
  });

  route('POST', /^\/api\/agents\/([^/]+)\/revoke$/, (req, _b, [id]) => {
    ownerAuth(req);
    const a = findAgent(id);
    if (!a.revokedAt) {
      a.revokedAt = now();
      for (const ap of state.approvals) if (ap.agentId === id && ap.status === 'pending') {
        ap.status = 'denied'; ap.resolvedAt = now(); ap.note = 'Agent revoked';
        store.append(id, 'approval.denied', {eventId: ap.id, action: ap.action, resource: ap.resource, by: 'revocation'});
      }
      store.append(id, 'agent.revoked', {}); store.save();
    }
    return {agent: view(a)};
  });

  route('GET', /^\/api\/agents\/([^/]+)\/card$/, (_req, _b, [id]) => {
    const a = findAgent(id);
    const card = {
      issuer: issuer(), operator: state.owner?.name ?? null, id: a.id, name: a.name, description: a.description,
      createdAt: a.createdAt, revokedAt: a.revokedAt, expiresAt: a.expiresAt, scopes: a.scopes, limits: a.limits,
      erc8004: a.onchain ? {agentRegistry: agentRegistryId(a.onchain.chainId, a.onchain.registry), agentId: a.onchain.agentId} : null,
    };
    return {card, signature: store.signJson(card), algorithm: 'Ed25519', publicKey: store.publicKey()};
  }, {public: true});

  route('GET', /^\/api\/agents\/([^/]+)\/status$/, (_req, _b, [id]) => {
    const a = findAgent(id);
    return {id, name: a.name, active: !a.revokedAt && !expired(a), revokedAt: a.revokedAt, expiresAt: a.expiresAt};
  }, {public: true});

  // ── ERC-8004 (on-chain identity) ────────────────────────────────────────
  const registrationFor = (req, a) => registrationFile({
    agent: view(a), operator: state.owner?.name ?? 'unknown', origin: origin(req), issuer: issuer(), fingerprint: store.fingerprint(), onchain: a.onchain,
  });

  route('GET', /^\/api\/chains$/, () => ({chains: chainList()}), {public: true});

  route('GET', /^\/api\/agents\/([^/]+)\/registration\.json$/, (req, _b, [id]) => registrationFor(req, findAgent(id)), {public: true});

  route('GET', /^\/api\/agents\/([^/]+)\/erc8004$/, (req, _b, [id]) => {
    ownerAuth(req);
    const a = findAgent(id), file = registrationFor(req, a), agentURI = toDataUri(file);
    return {file, agentURI, chains: chainList(), onchain: a.onchain ?? null, publicUrl: origin(req)};
  });

  route('POST', /^\/api\/agents\/([^/]+)\/onchain$/, async (req, b, [id]) => {
    ownerAuth(req);
    const a = findAgent(id);
    if (a.revokedAt) fail(409, 'Agent is revoked');
    const chain = getChain(b.chainId) ?? fail(400, 'Unsupported chain');
    const identity = await readIdentity(chain.id, b.agentId);
    if (!identity) fail(404, `agentId ${b.agentId} is not registered on ${chain.name}`);
    if (identity.file && identity.file.mihari?.agentId && identity.file.mihari.agentId !== a.id) fail(409, 'That on-chain identity belongs to a different Mihari agent');
    if (b.owner && String(b.owner).toLowerCase() !== identity.owner.toLowerCase()) fail(409, 'The wallet does not own that on-chain agent');
    a.onchain = {
      chainId: chain.id, registry: chain.registry, agentId: identity.agentId, owner: identity.owner,
      txHash: /^0x[0-9a-fA-F]{64}$/.test(b.txHash ?? '') ? b.txHash : null, uriKind: identity.uriKind,
      uriBound: identity.file?.mihari?.agentId === a.id, linkedAt: now(),
    };
    store.append(a.id, 'agent.onchain.linked', {chain: chain.name, chainId: chain.id, agentId: identity.agentId, owner: identity.owner, txHash: a.onchain.txHash});
    store.save();
    return {agent: view(a)};
  });

  route('GET', /^\/api\/chain\/lookup$/, async req => {
    if (!allowLookup(req)) fail(429, 'Slow down: 30 lookups per minute');
    const q = new URL(req.url, 'http://x').searchParams;
    const identity = await readIdentity(q.get('chainId'), q.get('agentId'));
    if (!identity) fail(404, 'No agent with that id on this chain');
    const f = identity.file;
    return {
      chain: {id: identity.chain.id, name: identity.chain.name, registry: identity.chain.registry, explorer: identity.chain.explorer},
      agentId: identity.agentId, owner: identity.owner, uriKind: identity.uriKind, tokenURI: identity.uriKind === 'data' ? null : identity.tokenURI.slice(0, 300),
      registration: f ? {name: String(f.name ?? '').slice(0, 120), description: String(f.description ?? '').slice(0, 400), active: f.active ?? null, services: Array.isArray(f.services) ? f.services.slice(0, 8).map(s => ({name: String(s.name).slice(0, 40), endpoint: String(s.endpoint).slice(0, 200)})) : [], x402Support: f.x402Support ?? null, mihari: !!f.mihari} : null,
    };
  }, {public: true});

  // ── Agent-facing ────────────────────────────────────────────────────────
  route('GET', /^\/api\/policy$/, req => {
    const a = agentAuth(req);
    return {agent: view(a), usage: store.usage(a)};
  });

  route('POST', /^\/api\/authorize$/, (req, b) => {
    const a = agentAuth(req);
    const request = parseRequest(b);
    const note = String(b.note ?? '').slice(0, 300);
    const d = decide(a, request, store.usage(a));
    a.lastUsedAt = now();
    const details = {...request, reason: d.reason, note};
    const out = {outcome: d.outcome, allowed: d.allowed, reason: d.reason};
    if (d.outcome === 'ask') {
      const wait = Math.min(Math.max(Number(b.waitSeconds) || 600, 30), 3600);
      const entry = store.append(a.id, 'action.pending', details);
      state.approvals.push({
        id: entry.id, agentId: a.id, agentName: a.name, ...request, note, status: 'pending',
        createdAt: entry.at, expiresAt: new Date(Date.now() + wait * 1000).toISOString(), resolvedAt: null,
      });
      if (state.approvals.length > 500) state.approvals.splice(0, state.approvals.length - 500);
      store.save();
      return {agentId: a.id, decision: out, eventId: entry.id, approvalId: entry.id};
    }
    const entry = store.append(a.id, d.allowed ? 'action.allowed' : 'action.denied', details);
    store.save();
    return {agentId: a.id, decision: out, eventId: entry.id};
  });

  route('GET', /^\/api\/authorize\/([^/]+)$/, (req, _b, [id]) => {
    const a = agentAuth(req); sweepApprovals();
    const ap = state.approvals.find(x => x.id === id && x.agentId === a.id) ?? fail(404, 'No such approval request');
    return {
      eventId: id, status: ap.status, decision: {allowed: ap.status === 'approved', outcome: ap.status === 'approved' ? 'allow' : ap.status === 'pending' ? 'ask' : 'deny',
        reason: ap.status === 'approved' ? 'Approved by owner' : ap.status === 'pending' ? 'Waiting for owner approval' : ap.status === 'expired' ? 'Approval request expired' : 'Owner denied this request'},
    };
  });

  route('POST', /^\/api\/approvals\/([^/]+)\/resolve$/, (req, b, [id]) => {
    ownerAuth(req); sweepApprovals();
    const ap = state.approvals.find(x => x.id === id) ?? fail(404, 'Approval not found');
    if (ap.status !== 'pending') fail(409, `Request is already ${ap.status}`);
    const a = findAgent(ap.agentId);
    const approve = b.approve === true && !a.revokedAt;
    ap.status = approve ? 'approved' : 'denied'; ap.resolvedAt = now(); ap.note = String(b.note ?? '').slice(0, 300);
    store.append(a.id, approve ? 'approval.granted' : 'approval.denied', {
      eventId: id, action: ap.action, resource: ap.resource, amount: ap.amount, by: state.owner.name, note: ap.note,
    });
    store.save();
    return {approval: ap};
  });

  route('POST', /^\/api\/receipt$/, (req, b) => {
    const a = agentAuth(req);
    const granted = events.some(e => e.id === b.eventId && e.agentId === a.id && e.kind === 'action.allowed')
      || state.approvals.some(x => x.id === b.eventId && x.agentId === a.id && x.status === 'approved');
    if (!granted) fail(403, 'Receipt requires an allowed decision for this agent');
    if (events.some(e => e.kind === 'action.reported' && e.details.eventId === b.eventId)) fail(409, 'Receipt already submitted');
    const outcome = b.outcome === 'success' ? 'success' : b.outcome === 'failure' ? 'failure' : null;
    if (!outcome) fail(400, 'Outcome must be success or failure');
    const entry = store.append(a.id, 'action.reported', {
      eventId: b.eventId, outcome, note: String(b.note ?? '').slice(0, 500), source: 'agent-reported',
    });
    return {event: entry};
  });

  route('POST', /^\/api\/assertion$/, (req, b) => {
    const a = agentAuth(req);
    if (a.revokedAt || expired(a)) fail(403, 'Agent is not active');
    const audience = String(b.audience ?? '').trim();
    if (!audience || audience.length > 200) fail(400, 'audience is required: the service this assertion is for');
    const ttl = Math.min(Math.max(Number(b.ttlSeconds) || 120, 10), 900);
    const iat = Math.floor(Date.now() / 1000);
    const claims = {
      iss: issuer(), sub: a.id, name: a.name, operator: state.owner.name, aud: audience, iat, exp: iat + ttl,
      jti: randomUUID(), scp: [...new Set(a.scopes.filter(s => s.mode !== 'deny').map(s => s.action))],
      ...(a.onchain ? {erc8004: {agentRegistry: agentRegistryId(a.onchain.chainId, a.onchain.registry), agentId: a.onchain.agentId}} : {}),
    };
    const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
    const signingInput = `${b64({alg: 'EdDSA', typ: 'mihari+jwt', kid: store.fingerprint().slice(0, 16)})}.${b64(claims)}`;
    const token = `${signingInput}.${store.signBytes(signingInput).toString('base64url')}`;
    store.append(a.id, 'assertion.issued', {aud: audience, jti: claims.jti, exp: claims.exp});
    return {token, claims, expiresIn: ttl};
  });

  route('POST', /^\/api\/verify$/, async (_req, b) => {
    const result = verifyAssertion(String(b.token ?? ''), {publicKey: store.publicKey(), audience: b.audience || undefined});
    if (result.valid) {
      const a = state.agents.find(x => x.id === result.claims.sub);
      if (!a) return {valid: false, reason: 'Unknown agent'};
      if (a.revokedAt) return {valid: false, reason: 'Agent has been revoked', claims: result.claims};
      if (expired(a)) return {valid: false, reason: 'Agent credential has expired', claims: result.claims};
      if (a.onchain) {
        try {
          const id = await readIdentity(a.onchain.chainId, a.onchain.agentId);
          result.onchain = id
            ? {ok: id.owner.toLowerCase() === a.onchain.owner.toLowerCase(), chain: id.chain.name, agentId: id.agentId, owner: id.owner, bound: id.file?.mihari?.agentId === a.id}
            : {ok: false, reason: 'Not found on-chain any more'};
        } catch (e) { result.onchain = {ok: null, reason: e.message}; }
      }
    }
    return result;
  }, {public: true});

  // ── Audit ───────────────────────────────────────────────────────────────
  route('GET', /^\/api\/audit\/verify$/, req => { ownerAuth(req); return store.verifyChain(); });
  route('GET', /^\/api\/audit\/export$/, req => {
    ownerAuth(req);
    const head = events.at(-1)?.hash ?? GENESIS;
    const body = {format: 'mihari-audit-v2', exportedAt: now(), publicKey: store.publicKey(), count: events.length, head};
    return {...body, headSignature: store.signJson({head, count: events.length}), events};
  });

  // ── Static + HTTP plumbing ──────────────────────────────────────────────
  function serveStatic(path, req, res, head) {
    if (!webDist) return false;
    let file = resolve(webDist, '.' + decodeURIComponent(path));
    if (file !== resolve(webDist) && !file.startsWith(resolve(webDist) + sep)) return false;
    if (!existsSync(file) || statSync(file).isDirectory()) {
      if (extname(path)) return false;
      file = resolve(webDist, 'index.html'); // single-page app fallback
      if (!existsSync(file)) return false;
    }
    const immutable = file.includes('/assets/');
    const type = MIME[extname(file)] ?? 'application/octet-stream';
    const encodings = String(req.headers['accept-encoding'] || '').split(',').map(part => {
      const [name, ...params] = part.trim().split(';');
      const q = params.find(p => p.trim().startsWith('q='));
      return {name, quality: q ? Number(q.trim().slice(2)) : 1};
    }).filter(e => e.quality > 0).sort((a, b) => b.quality - a.quality);
    let encoding;
    for (const e of encodings) {
      const suffix = e.name === 'br' ? '.br' : e.name === 'gzip' ? '.gz' : null;
      if (suffix && existsSync(file + suffix)) { encoding = e.name; file += suffix; break; }
    }
    res.writeHead(200, {
      'content-type': type, 'content-length': statSync(file).size, 'x-content-type-options': 'nosniff',
      vary: 'Accept-Encoding', ...(encoding ? {'content-encoding': encoding} : {}),
      'content-security-policy': CSP, 'referrer-policy': 'strict-origin-when-cross-origin',
      'permissions-policy': 'camera=(), microphone=(), geolocation=()', 'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (head) res.end();
    else createReadStream(file).on('error', () => res.destroy()).pipe(res);
    return true;
  }

  const readBody = req => new Promise((ok, bad) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > 65536) { bad(Object.assign(new Error('Body too large'), {status: 413})); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { ok(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}); } catch { bad(Object.assign(new Error('Invalid JSON'), {status: 400})); } });
    req.on('error', bad);
  });

  return async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    const send = (status, obj, cors) => {
      res.writeHead(status, {
        'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
        ...(cors ? {'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type'} : {}),
      });
      res.end(JSON.stringify(obj));
    };
    try {
      const match = routes.find(r => r.method === req.method && r.pattern.test(path));
      if (!match && req.method === 'OPTIONS' && path.startsWith('/api/')) {
        res.writeHead(204, {'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST', 'access-control-allow-headers': 'content-type'});
        return res.end();
      }
      if (!match) {
        if (['GET', 'HEAD'].includes(req.method) && !path.startsWith('/api/') && serveStatic(path, req, res, req.method === 'HEAD')) return;
        return send(404, {error: 'Not found'});
      }
      const b = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};
      send(200, await match.fn(req, b, match.pattern.exec(path)?.slice(1) ?? []), match.public);
    } catch (e) {
      send(e.status || 500, {error: e.status ? e.message : 'Internal error'}, true);
      if (!e.status) console.error(e);
    }
  };
}

export function createApp(store, options) {
  return createServer(createHandler(store, options));
}
