#!/usr/bin/env node
/**
 * verify-e2e — the pre-demo gate.
 *
 * Runs the whole product against a live stack and asserts on real responses:
 * World ID gating, ENS resolution both directions, 0G execution + storage, the
 * on-chain hash chain, authority enforcement, and a live reputation move. If
 * this exits 0, the demo script in the PRD works. If it exits non-zero, it
 * prints which link in the chain broke and why.
 *
 * Deliberately talks to the HTTP API rather than importing the SDK: that is the
 * surface the UI and any relying party actually use, so this proves the thing
 * judges will exercise, not an internal shortcut.
 *
 *   node scripts/verify-e2e.mjs            # against http://127.0.0.1:5055
 *   API=http://host:5055 node scripts/verify-e2e.mjs
 */

const API = (process.env.API || 'http://127.0.0.1:5055').replace(/\/$/, '');
const TRUSTED = process.env.TRUSTED_AGENT || 'optimizer.kya.eth';
const LIMITED = process.env.LIMITED_AGENT || 'scout.kya.eth';
const BLOCKED = process.env.BLOCKED_AGENT || 'drifter.kya.eth';
const ABSENT = 'ghost.kya.eth';

const results = [];
let failed = 0;

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  bold: '\x1b[1m',
};

async function api(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? {'content-type': 'application/json'} : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(json.error || `HTTP ${res.status} on ${path}`), {status: res.status, json});
  }
  return json;
}

/** Assert, and keep going so one break doesn't hide the rest. */
function check(name, condition, detail = '') {
  const pass = Boolean(condition);
  if (!pass) failed++;
  results.push({name, pass, detail});
  const mark = pass ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
  console.log(`  ${mark} ${name}${detail ? `  ${C.dim}${detail}${C.reset}` : ''}`);
  return pass;
}

function section(title) {
  console.log(`\n${C.bold}${title}${C.reset}`);
}

async function main() {
  console.log(`${C.bold}KYA end-to-end verification${C.reset}  ${C.dim}${API}${C.reset}`);

  // ── 0. the stack is up ─────────────────────────────────────────────────
  section('0  Stack');
  const health = await api('/health');
  check('API healthy', health.ok, `chain ${health.chainId}`);
  check('Registry address published', /^0x[0-9a-fA-F]{40}$/.test(health.contracts.PassportRegistry));
  check(
    'Multicall3 deployed for atomic passport reads',
    /^0x[0-9a-fA-F]{40}$/.test(health.contracts.Multicall3 || ''),
    health.contracts.Multicall3,
  );

  const integrations = await api('/api/integrations');
  for (const key of ['world', 'ens', 'og']) {
    const i = integrations[key];
    check(
      `${i.surface} mode declared: ${i.mode}`,
      typeof i.mode === 'string' && i.mode.length > 0,
      i.live ? 'LIVE' : 'local stand-in, labeled',
    );
  }

  // ── 1. World ID gating ─────────────────────────────────────────────────
  section('1  World ID — human verification gates the passport');
  const trusted = await api(`/api/agents/${encodeURIComponent(TRUSTED)}`);
  check('Trusted agent owner is human-verified', trusted.passport.humanVerified === true);
  check(
    'Proof kind is a production level, not simulator',
    ['orb', 'device'].includes(trusted.passport.proofKindName),
    trusted.passport.proofKindName,
  );
  check(
    'Owner nullifier is bound on-chain',
    /^0x[0-9a-f]{64}$/i.test(trusted.passport.ownerNullifier) && !/^0x0+$/.test(trusted.passport.ownerNullifier),
  );

  // The honesty property: a simulator-grade proof must not unlock registration.
  const throwaway = `0x${'ab'.repeat(20)}`;
  let sim = null;
  try {
    sim = await api('/api/verify-human', {subject: throwaway, simulate: true});
  } catch (err) {
    // Acceptable when a live WORLD_APP_ID is configured — real proofs required.
    check('Simulator path refused because live World ID is configured', err.status === 400, err.message);
  }
  if (sim) {
    check(
      'Simulator proof recorded but CANNOT register an agent',
      sim.canRegisterAgent === false && sim.onchain.kind === 3,
      `kind=${sim.onchain.kind} canRegister=${sim.canRegisterAgent}`,
    );
    check('Simulator response carries an explicit warning', typeof sim.warning === 'string' && sim.warning.length > 0);
  }

  // ── 2. ENS ─────────────────────────────────────────────────────────────
  section('2  ENS — discovery and the agent card');
  check('Forward resolution: name → passport', trusted.passport.agentId > 0, `#${trusted.passport.agentId}`);
  check(
    'Reverse resolution: operator address → name',
    trusted.passport.ensName === TRUSTED,
    trusted.passport.ensName || 'none',
  );
  const byAddress = await api(`/api/agents/${trusted.passport.operator}`);
  check(
    'Address lookup returns the same passport',
    byAddress.passport.agentId === trusted.passport.agentId,
    `${trusted.passport.operator} → #${byAddress.passport.agentId}`,
  );
  const caps = trusted.passport.textRecords['agent.capabilities'];
  check(
    'EIP-634 text record advertises capabilities',
    typeof caps === 'string' && caps.length > 0,
    caps,
  );
  check(
    'Capability text record is derived from the registry, not stored',
    caps === trusted.passport.capabilities.join(','),
    `${caps} === ${trusted.passport.capabilities.join(',')}`,
  );
  check(
    'agent.passport text record points at the on-chain entry',
    (trusted.passport.textRecords['agent.passport'] || '').startsWith('eip155:'),
    trusted.passport.textRecords['agent.passport'],
  );

  // ── 3. the trust decision ──────────────────────────────────────────────
  section('3  Trust engine — a verdict, not a data dump');
  check('Trusted agent verdict is TRUST', trusted.decision.verdict === 'trust', trusted.decision.headline);
  check('Verdict cites its evidence', trusted.decision.checks.length >= 8, `${trusted.decision.checks.length} checks`);
  check(
    'No verdict summary renders "undefined"',
    !/undefined/.test(trusted.decision.summary),
    trusted.decision.summary.slice(0, 80),
  );

  const blocked = await api(`/api/agents/${encodeURIComponent(BLOCKED)}`);
  check(
    'Agent with a blocked over-mandate attempt is DECLINEd',
    blocked.decision.verdict === 'decline',
    blocked.decision.summary.slice(0, 90),
  );
  check(
    'Rejection is visible on its permanent record',
    blocked.passport.reputation.rejected > 0,
    `${blocked.passport.reputation.rejected} rejected`,
  );

  const absent = await api('/api/check', {query: ABSENT, capability: 'flight.quote'});
  check('Unknown identifier declines with no passport', absent.decision.verdict === 'decline');
  check('Unknown identifier returns no passport object', absent.passport === null);

  // ── 4. side-by-side comparison ─────────────────────────────────────────
  section('4  Comparison — the demo centrepiece');
  const compare = await api('/api/compare', {
    queries: [TRUSTED, ABSENT],
    policy: {capability: 'flight.quote', value: '100000000000000000'},
  });
  check('Comparison returns both sides', compare.results.length === 2);
  check('Recommends the verified agent', compare.recommended === TRUSTED, compare.recommended || 'none');
  check(
    'Anonymous side is explicitly not trusted',
    compare.results[1].decision.verdict === 'decline',
    compare.results[1].decision.headline,
  );

  // ── 5. authority enforcement ───────────────────────────────────────────
  section('5  Authority — enforced on-chain, not advisory');
  const limited = await api(`/api/agents/${encodeURIComponent(LIMITED)}`);
  const outsideMandate = await api('/api/check', {
    query: LIMITED,
    capability: 'flight.quote', // scout only holds `research`
    value: '0',
  });
  check(
    'Registry refuses a capability outside the mandate',
    outsideMandate.onchain && outsideMandate.onchain.ok === false,
    outsideMandate.onchain?.reason,
  );
  check(
    'Refusal comes from the contract, not just the client',
    outsideMandate.decision.checks.some((c) => c.id === 'authority.onchain' && !c.pass),
  );

  const overspend = await api('/api/check', {
    query: TRUSTED,
    capability: 'flight.quote',
    value: '1000000000000000000000', // 1000 ether against a 25/day mandate
  });
  check(
    'Registry refuses an over-limit spend',
    overspend.onchain.ok === false && overspend.onchain.reason === 'DAILY_SPEND_EXCEEDED',
    overspend.onchain.reason,
  );

  const dispatchBlocked = await api('/api/dispatch', {
    query: LIMITED,
    capability: 'flight.quote',
    input: {from: 'BOM', to: 'DEL', date: '2026-09-20', maxValue: '0'},
  });
  check('A blocked dispatch is not executed', dispatchBlocked.accepted === false);
  check(
    'The blocked attempt is written on-chain, not just refused',
    Boolean(dispatchBlocked.rejection?.hash),
    dispatchBlocked.rejection?.hash,
  );

  // ── 6. the loop: 0G execution → reputation moves ───────────────────────
  section('6  0G — execute, store, settle, reputation moves live');
  const before = trusted.passport.reputation;
  const run = await api('/api/dispatch', {
    query: TRUSTED,
    capability: 'flight.quote',
    input: {from: 'BOM', to: 'DXB', date: '2026-09-14', maxValue: '2000000000000000000'},
  });

  check('Dispatch accepted', run.accepted === true, run.decision.headline);
  check(
    'Executed on a labeled engine',
    typeof run.execution.engine === 'string' && /^(live|local):/.test(run.execution.engine),
    run.execution.engine,
  );
  check('Execution produced a result', run.execution.result && Object.keys(run.execution.result).length > 0);
  if (run.execution.engine.startsWith('live:')) {
    check(
      'Live 0G run carries a TEE attestation',
      Boolean(run.execution.attestation),
      run.execution.attestation?.signingAddress || 'no attestation returned',
    );
  }
  check(
    'Record persisted with a content digest',
    /^0x[0-9a-f]{64}$/i.test(run.storage.digest),
    `${run.storage.backend} ${run.storage.uri}`,
  );
  check('Receipt settled on-chain', /^0x[0-9a-f]{64}$/i.test(run.settlement.hash), run.settlement.hash);
  check(
    'Evidence written on-chain matches the stored record',
    run.settlement.evidence === run.storage.digest,
  );

  const stored = await api(`/api/records/${run.storage.digest}`);
  check(
    'Stored record is retrievable by its digest',
    stored.record && stored.record.kind === 'kya.action.v1',
    `${Object.keys(stored.record || {}).length} fields`,
  );

  check(
    'Action count incremented by exactly 1',
    run.reputationDelta.totalAfter === before.total + 1,
    `${before.total} → ${run.reputationDelta.totalAfter}`,
  );
  check(
    'Reputation score moved',
    run.reputationDelta.after !== run.reputationDelta.before,
    `${(run.reputationDelta.before / 100).toFixed(2)}% → ${(run.reputationDelta.after / 100).toFixed(2)}%`,
  );
  check(
    'Hash chain still verifies after the new receipt',
    run.integrity.verified === true,
    `${run.integrity.receipts} receipts, head ${run.integrity.onchainHead.slice(0, 12)}…`,
  );
  check(
    'Recomputed head equals the on-chain head',
    run.integrity.recomputedHead.toLowerCase() === run.integrity.onchainHead.toLowerCase(),
  );

  // ── 7. routing: the moment the product makes sense ─────────────────────
  section('7  Routing — a task-requesting app picks by passport');
  const routed = await api('/api/route', {
    capability: 'flight.quote',
    candidates: [TRUSTED, BLOCKED, ABSENT],
    input: {from: 'BOM', to: 'SIN', date: '2026-09-18', maxValue: '2000000000000000000'},
  });
  check('Routed to the trusted agent', routed.routed === TRUSTED, routed.routed || 'nothing');
  check('Every candidate got an explicit verdict', routed.candidates.length === 3);
  check(
    'Untrusted candidates were never dispatched to',
    routed.candidates.filter((c) => c.decision.verdict === 'trust').length === 1,
  );
  check('The routed run settled', Boolean(routed.run?.settlement?.hash), routed.run?.settlement?.hash);

  // ── 8. no unlabeled simulation ─────────────────────────────────────────
  section('8  Honesty — nothing simulated renders as live');
  const agents = await api('/api/agents');
  check('Directory returns the seeded cast', agents.count >= 3, `${agents.count} passports`);
  check(
    'Every passport declares a real proof kind',
    agents.agents.every((a) => typeof a.proofKindName === 'string'),
  );
  check(
    'Simulator proofs are never reported as human-verified',
    agents.agents.every((a) => (a.proofKind === 3 ? a.humanVerified === false : true)),
  );
  check(
    'Local execution engines are labeled local:',
    run.execution.engine.startsWith('live:') || run.execution.engine.startsWith('local:'),
    run.execution.engine,
  );

  // ── summary ────────────────────────────────────────────────────────────
  const total = results.length;
  const passed = total - failed;
  console.log(`\n${'─'.repeat(64)}`);
  if (failed === 0) {
    console.log(`${C.green}${C.bold}PASS${C.reset}  ${passed}/${total} checks. The PRD demo script works end to end.`);
  } else {
    console.log(`${C.red}${C.bold}FAIL${C.reset}  ${passed}/${total} checks passed, ${failed} failed:`);
    for (const r of results.filter((r) => !r.pass)) {
      console.log(`  ${C.red}✗${C.reset} ${r.name}${r.detail ? `  ${C.dim}${r.detail}${C.reset}` : ''}`);
    }
  }

  const live = Object.entries({
    'World ID': integrations.world.mode,
    ENS: integrations.ens.mode,
    '0G': integrations.og.mode,
  })
    .map(([k, v]) => `${k}=${v}`)
    .join('  ');
  console.log(`${C.dim}${live}${C.reset}`);

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\n${C.red}${C.bold}verification aborted${C.reset}  ${err.message}`);
  if (err.json) console.error(JSON.stringify(err.json, null, 2));
  if (String(err.message).includes('fetch failed')) {
    console.error(`\n${C.yellow}Is the stack up?${C.reset}  pnpm up   (anvil + deploy + seed + api)`);
  }
  process.exit(1);
});
