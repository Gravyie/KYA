import {createServer} from 'node:http';
import {check, rank, VERDICT, DEFAULT_POLICY} from '@kya/sdk';
import {config, modes, modeSummary} from './config.js';
import {kyaClient} from './client.js';
import {dispatch, TASKS} from './pipeline.js';
import * as chain from './chain.js';
import {verifyWithWorld, localHumanhoodStub} from './world.js';
import {readRecord} from './og.js';

/**
 * Dependency-free HTTP layer. No framework: fewer moving parts is fewer things
 * that can break in front of judges, and the routing surface here is small.
 */

const json = (res, status, body) => {
  const payload = JSON.stringify(body, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2);
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'cache-control': 'no-store',
  });
  res.end(payload);
};

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const err = new Error('invalid JSON body');
    err.status = 400;
    throw err;
  }
}

const routes = [];
const route = (method, pattern, handler) => routes.push({method, pattern, handler});

// ───────────────────────────────────────── meta

route('GET', /^\/health$/, async () => ({
  ok: true,
  chainId: config.chainId,
  rpcUrl: config.rpcUrl,
  contracts: config.contracts,
  parentName: config.parentName,
  accounts: chain.accounts(),
  modes: modeSummary(),
}));

/**
 * The judge-facing endpoint: which sponsor feature is doing what, and whether it
 * is currently live or standing in locally. Surfaced in the UI footer verbatim.
 */
route('GET', /^\/api\/integrations$/, async () => ({
  world: {
    surface: 'World ID',
    feature: 'Proof of unique human, cloud verify (/api/v4/verify → v2 fallback)',
    role: 'Gates passport creation. The nullifier is bound on-chain, so one human cannot double-register an owner wallet.',
    whyNecessary:
      'Without proof-of-personhood, an operator with a bad record spins up a fresh wallet and a fresh reputation. The nullifier is the only thing that makes a track record costly to abandon.',
    mode: modes.worldId,
    live: modes.worldId.startsWith('live:'),
    appId: config.world.appId,
    action: config.world.action,
    attestorSigner: chain.accounts().attestor,
    contract: config.contracts.HumanhoodAttestor,
    note: modes.worldId.startsWith('live:')
      ? 'Proofs verified against World Developer Portal, then carried on-chain via EIP-712.'
      : 'No WORLD_APP_ID configured. Local stand-in issues ProofKind.WorldIdSimulator, which the registry REFUSES for registration.',
  },
  ens: {
    surface: 'ENS',
    feature: 'EIP-137 namehash, EIP-634 text records, ENSIP-9 addr, reverse name()',
    role: 'Makes agents discoverable by name and turns the name into the agent card. Text records for capabilities/reputation are computed from the registry, so a name cannot advertise stale authority.',
    whyNecessary:
      'A passport nobody can find is not an identity. ENS also gives other agents a machine-readable capability list through stock resolver calls, with no KYA-specific client code.',
    mode: 'live:onchain-resolver',
    live: true,
    parentName: config.parentName,
    contract: config.contracts.AgentNameRegistrar,
    note: 'Subnames under a project-owned parent name. Point the parent name\'s resolver at this contract and every subname resolves through standard ENS tooling.',
  },
  og: {
    surface: '0G',
    feature: 'Compute Router chat/completions with verify_tee; Storage for the action log',
    role: 'Executes the agent task and produces evidence the agent could not forge. The TEE attestation digest becomes Action.evidence; the stored record digest is chained into logHead.',
    whyNecessary:
      'Reputation is only meaningful if the execution path, not the agent, reports the outcome. 0G supplies both the attested execution and the durable record; the chain supplies one word that proves the record is complete.',
    mode: `${modes.ogCompute} / ${modes.ogStorage}`,
    live: modes.ogCompute.startsWith('live:'),
    model: config.og.computeModel,
    verifyTee: config.og.verifyTee,
    note: modes.ogCompute.startsWith('live:')
      ? 'Live 0G Compute Router with TEE verification requested per call.'
      : 'No OG_COMPUTE_API_KEY configured. Deterministic local executor — same input always yields the same result, and every response is labeled local:deterministic-executor.',
  },
}));

route('GET', /^\/api\/tasks$/, async () => ({
  tasks: Object.entries(TASKS).map(([id, t]) => ({id, capability: t.capability, label: t.label})),
}));

route('GET', /^\/api\/policy$/, async () => ({policy: DEFAULT_POLICY}));

// ───────────────────────────────────────── passports

route('GET', /^\/api\/agents$/, async () => {
  const passports = await kyaClient().allPassports();
  return {
    count: passports.length,
    agents: passports.map((p) => ({...p, decision: check(p)})),
  };
});

/**
 * Compact roster for the rail. One batched call for every agent, so the sidebar
 * populates in a single round-trip instead of N passport reads.
 */
route('GET', /^\/api\/directory$/, async () => {
  const rows = await kyaClient().directory();
  return {count: rows.length, agents: rows, parentName: config.parentName};
});

route('GET', /^\/api\/agents\/([^/]+)$/, async (_req, _body, [query]) => {
  const passport = await kyaClient().passportByQuery(decodeURIComponent(query));
  if (!passport) {
    const err = new Error('no passport for that identifier');
    err.status = 404;
    throw err;
  }
  const integrity = await kyaClient().verifyLogIntegrity(passport.agentId);
  return {passport, decision: check(passport), integrity};
});

/** Side-by-side comparison — the demo's central screen. */
route('POST', /^\/api\/compare$/, async (_req, body) => {
  const queries = Array.isArray(body.queries) ? body.queries.slice(0, 4) : [];
  const policy = body.policy || {};
  const resolved = await Promise.all(
    queries.map(async (q) => {
      const passport = await kyaClient().passportByQuery(q);
      const onchain =
        passport && policy.capability
          ? await kyaClient().canPerform(passport.agentId, policy.capability, BigInt(policy.value || 0))
          : null;
      return {query: q, passport, decision: check(passport, policy, onchain)};
    }),
  );
  const trustworthy = resolved.filter((r) => r.decision.verdict === VERDICT.TRUST);
  return {
    results: resolved,
    recommended: trustworthy.length
      ? trustworthy.sort((a, b) => b.passport.reputation.score - a.passport.reputation.score)[0].query
      : null,
    policy: {...DEFAULT_POLICY, ...policy},
  };
});

/** Machine-readable trust check for another agent or app. */
route('POST', /^\/api\/check$/, async (_req, body) => {
  const passport = await kyaClient().passportByQuery(body.query);
  const onchain =
    passport && body.capability
      ? await kyaClient().canPerform(passport.agentId, body.capability, BigInt(body.value || 0))
      : null;
  const decision = check(
    passport,
    {...(body.policy || {}), capability: body.capability ?? null, value: String(body.value ?? '0')},
    onchain,
  );
  return {query: body.query, decision, passport, onchain};
});

route('POST', /^\/api\/rank$/, async (_req, body) => {
  const passports = (await Promise.all((body.queries || []).map((q) => kyaClient().passportByQuery(q)))).filter(Boolean);
  return {ranked: rank(passports, body.policy || {})};
});

route('GET', /^\/api\/records\/(0x[0-9a-fA-F]+)$/, async (_req, _b, [digest]) => {
  const record = readRecord(digest);
  if (!record) {
    const err = new Error('no stored record for that digest');
    err.status = 404;
    throw err;
  }
  return {digest, record};
});

// ───────────────────────────────────────── onboarding

/**
 * Verify a World ID proof and record humanhood on-chain.
 * Body: { subject, idkitResult } — or { subject, simulate: true } when no
 * WORLD_APP_ID is configured, which yields a simulator-level proof only.
 */
route('POST', /^\/api\/verify-human$/, async (_req, body) => {
  if (!body.subject) {
    const err = new Error('subject address required');
    err.status = 400;
    throw err;
  }

  let proof;
  if (body.idkitResult && config.world.appId) {
    proof = await verifyWithWorld(body.idkitResult, {action: body.action});
  } else if (config.world.appId && !body.simulate) {
    const err = new Error('idkitResult required — WORLD_APP_ID is configured, so real proofs are expected');
    err.status = 400;
    throw err;
  } else {
    proof = localHumanhoodStub(body.subject);
  }

  const signed = await chain.signHumanhood({
    subject: body.subject,
    kind: proof.kind,
    nullifierHash: proof.nullifierHash,
    verifiedAt: Math.floor(Date.now() / 1000),
    appId: config.world.appId || 'local',
    action: proof.action,
  });
  const tx = await chain.recordHumanhood(signed);
  const state = await chain.humanhoodOf(body.subject);

  return {
    subject: body.subject,
    proof: {
      kind: proof.kind,
      environment: proof.environment,
      identifier: proof.identifier,
      nullifierHash: proof.nullifierHash,
    },
    mode: modes.worldId,
    // Explicit: a simulator proof cannot register an agent.
    canRegisterAgent: state.humanVerified,
    warning: state.humanVerified
      ? null
      : 'Simulator-level proof recorded. The registry will refuse agent registration until a production World ID proof is supplied.',
    onchain: state,
    tx,
  };
});

route('POST', /^\/api\/agents$/, async (_req, body) => {
  const created = await chain.registerAgent(body, body.ownerKey || undefined);
  let name = null;
  if (body.label) {
    name = await chain.registerSubname(
      {label: body.label, agentId: created.agentId, target: body.operator},
      body.ownerKey || undefined,
    );
    if (body.description) {
      await chain.setText({node: name.node, key: 'description', value: body.description}, body.ownerKey || undefined);
    }
  }
  const passport = await kyaClient().passport(created.agentId);
  return {created, name, passport};
});

// ───────────────────────────────────────── the loop

/**
 * A task-requesting app asks KYA who to trust, then dispatches. This single call
 * is the moment the product makes sense: read passport → decide → execute on 0G →
 * settle receipt → reputation moves.
 */
route('POST', /^\/api\/dispatch$/, async (_req, body) => dispatch(body));

/** Route one task across candidates: rank, then dispatch to the winner. */
route('POST', /^\/api\/route$/, async (_req, body) => {
  const capability = body.capability;
  const policy = {...(body.policy || {}), capability};
  const candidates = await Promise.all(
    (body.candidates || []).map(async (q) => {
      const passport = await kyaClient().passportByQuery(q);
      const onchain = passport ? await kyaClient().canPerform(passport.agentId, capability, BigInt(body.input?.maxValue || 0)) : null;
      return {query: q, passport, decision: check(passport, policy, onchain)};
    }),
  );

  const winner = candidates
    .filter((c) => c.decision.verdict === VERDICT.TRUST)
    .sort((a, b) => b.passport.reputation.score - a.passport.reputation.score)[0];

  if (!winner) {
    return {
      routed: null,
      candidates,
      reason: 'No candidate cleared the policy. Nothing was dispatched and no work was paid for.',
    };
  }

  const run = await dispatch({query: winner.query, capability, input: body.input, policy: body.policy});
  return {routed: winner.query, candidates, run};
});

// ───────────────────────────────────────── server

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const match = routes
    .map((r) => ({r, m: r.method === req.method ? url.pathname.match(r.pattern) : null}))
    .find(({m}) => m);

  if (!match) return json(res, 404, {error: 'not found', path: url.pathname});

  try {
    const body = req.method === 'POST' ? await readBody(req) : {};
    const result = await match.r.handler(req, body, match.m.slice(1), url);
    return json(res, 200, result);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(`[${req.method} ${url.pathname}]`, err);
    return json(res, status, {
      error: err.shortMessage || err.message || 'internal error',
      code: err.code,
      ...(err.worldResponse ? {worldResponse: err.worldResponse} : {}),
    });
  }
});

server.listen(config.port, () => {
  console.log(`KYA api        http://127.0.0.1:${config.port}`);
  console.log(`chain          ${config.chainId} via ${config.rpcUrl}`);
  console.log(`registry       ${config.contracts.PassportRegistry}`);
  for (const {surface, mode} of modeSummary()) console.log(`${surface.padEnd(15)}${mode}`);
});
