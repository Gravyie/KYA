/**
 * Seed the demo cast.
 *
 * The PRD's demo script needs a specific contrast to land, so the seed builds a
 * cast rather than N identical rows:
 *
 *   optimizer.kya.eth   human-backed, named, long clean history  → TRUST
 *   scout.kya.eth       human-backed, named, thin history        → LIMIT
 *   drifter.kya.eth     human-backed, but tried to exceed its
 *                       mandate and got blocked                  → DECLINE
 *   ghost               no World ID at all — cannot even hold a
 *                       passport, which is the point             → DECLINE
 *
 * Every action written here goes through the real settlement path (executor key,
 * 0G evidence digest, on-chain receipt). Nothing is inserted directly into
 * storage, so the seeded history is indistinguishable from live history — and
 * the hash chain verifies over it.
 */
import {privateKeyToAccount} from 'viem/accounts';
import {keccak256, toHex, parseEther} from 'viem';
import {Outcome, ProofKind} from '@kya/sdk';
import {config} from './config.js';
import * as chain from './chain.js';
import {kyaClient} from './client.js';
import {persistRecord, TASKS} from './og.js';
import {localHumanhoodStub} from './world.js';

// Anvil accounts 4..9 — deterministic, funded, and distinct from the service keys.
const KEYS = {
  ownerA: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
  ownerB: '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
  ownerC: '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e',
  opOptimizer: '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356',
  opScout: '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97',
  opDrifter: '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6',
};

const addr = (k) => privateKeyToAccount(k).address;

/** Deterministic pseudo-random so seeded history is identical every run. */
function prng(seedString) {
  let h = BigInt(keccak256(toHex(seedString)));
  return () => {
    h = BigInt(keccak256(toHex(h.toString(16).padStart(64, '0'))));
    return Number(h % 10_000n) / 10_000;
  };
}

async function verifyHuman(subject, kind) {
  const stub = localHumanhoodStub(subject);
  const signed = await chain.signHumanhood({
    subject,
    kind, // seed forces production-grade kinds so registration is possible offline
    nullifierHash: stub.nullifierHash,
    verifiedAt: Math.floor(Date.now() / 1000),
    appId: config.world.appId || 'app_seed_local',
    action: config.world.action,
  });
  await chain.recordHumanhood(signed);
  const state = await chain.humanhoodOf(subject);
  console.log(`  world id      ${subject} kind=${state.kind} verified=${state.humanVerified}`);
  return state;
}

async function createAgent({ownerKey, operatorKey, label, description, capabilities, spendLimit, maxActions}) {
  const owner = addr(ownerKey);
  const operator = addr(operatorKey);
  const domain = `${label}.${config.parentName}`;

  const {agentId} = await chain.registerAgent(
    {
      operator,
      domain,
      metadataURI: `kya-local://agentcard/${label}`,
      capabilities,
      spendLimitPerDay: parseEther(String(spendLimit)),
      maxActionsPerDay: maxActions,
      expiresAt: 0,
    },
    ownerKey,
  );

  const name = await chain.registerSubname({label, agentId, target: operator}, ownerKey);
  await chain.setText({node: name.node, key: 'description', value: description}, ownerKey);
  await chain.setText({node: name.node, key: 'url', value: `https://kya.dev/a/${label}`}, ownerKey);

  console.log(`  agent #${agentId}     ${domain}  operator=${operator.slice(0, 10)}…`);
  return {agentId, operator, owner, domain, node: name.node};
}

/** Write history through the real settlement path, batched by nonce. */
async function writeHistory(agentId, capability, count, failureRate, seed) {
  const rand = prng(seed);
  const task = TASKS[capability];
  const items = [];
  let success = 0;
  let failure = 0;

  for (let i = 0; i < count; i++) {
    const failed = rand() < failureRate;
    const input =
      capability === 'flight.quote'
        ? {from: 'BOM', to: ['DEL', 'BLR', 'DXB', 'SIN', 'LHR'][i % 5], date: `2026-09-${String((i % 27) + 1).padStart(2, '0')}`}
        : {question: `seed question ${i}`};

    const result = task.local(input);
    const record = {
      kind: 'kya.action.v1',
      agentId: String(agentId),
      capability,
      input,
      result,
      engine: 'local:deterministic-executor',
      model: 'deterministic',
      outcome: failed ? 'failure' : 'success',
      seedIndex: i,
      at: new Date(Date.now() - (count - i) * 3_600_000).toISOString(),
    };
    const stored = await persistRecord(record);

    items.push({
      agentId,
      capability,
      value: failed ? 0n : task.value(result),
      outcome: failed ? Outcome.Failure : Outcome.Success,
      evidence: stored.digest,
    });
    failed ? failure++ : success++;
  }

  await chain.settleActionBatch(items, {
    onProgress: (n, total) => {
      if (n % 40 === 0 || n === total) console.log(`    …${n}/${total} receipts submitted`);
    },
  });
  console.log(`  history       ${success} success / ${failure} failure over ${count} receipts`);
}

async function main() {
  if (config.chainId !== 31337) {
    console.log(`WARNING: seeding chain ${config.chainId}, not local anvil. Continuing in 3s…`);
    await new Promise((r) => setTimeout(r, 3000));
  }

  console.log('KYA seed');
  console.log(`  chain         ${config.chainId} @ ${config.rpcUrl}`);
  console.log(`  registry      ${config.contracts.PassportRegistry}`);
  console.log('');

  // ── owners ──────────────────────────────────────────────
  console.log('World ID verification of owners');
  await verifyHuman(addr(KEYS.ownerA), ProofKind.WorldIdOrb);
  await verifyHuman(addr(KEYS.ownerB), ProofKind.WorldIdOrb);
  await verifyHuman(addr(KEYS.ownerC), ProofKind.WorldIdDevice);
  console.log('');

  // ── the veteran ─────────────────────────────────────────
  console.log('optimizer.kya.eth — the trusted agent');
  const optimizer = await createAgent({
    ownerKey: KEYS.ownerA,
    operatorKey: KEYS.opOptimizer,
    label: 'optimizer',
    description: 'Flight-cost optimizer. Finds the cheapest viable itinerary and books inside a daily budget.',
    capabilities: ['flight.quote', 'pay'],
    spendLimit: 25,
    maxActions: 400,
  });
  await writeHistory(optimizer.agentId, 'flight.quote', 120, 0.03, 'optimizer');
  console.log('');

  // ── the rookie ──────────────────────────────────────────
  console.log('scout.kya.eth — clean but unproven');
  const scout = await createAgent({
    ownerKey: KEYS.ownerB,
    operatorKey: KEYS.opScout,
    label: 'scout',
    description: 'Research agent. Answers factual questions with cited sources.',
    capabilities: ['research'],
    spendLimit: 1,
    maxActions: 50,
  });
  await writeHistory(scout.agentId, 'research', 4, 0, 'scout');
  console.log('');

  // ── the one that overreached ────────────────────────────
  console.log('drifter.kya.eth — tried to exceed its mandate');
  const drifter = await createAgent({
    ownerKey: KEYS.ownerC,
    operatorKey: KEYS.opDrifter,
    label: 'drifter',
    description: 'Trading agent. Quotes and executes swaps within a daily notional cap.',
    capabilities: ['flight.quote'],
    spendLimit: 2,
    maxActions: 100,
  });
  await writeHistory(drifter.agentId, 'flight.quote', 22, 0.09, 'drifter');

  // A real blocked attempt: capability not granted. Recorded, not hidden.
  const overreach = await persistRecord({
    kind: 'kya.rejection.v1',
    agentId: String(drifter.agentId),
    capability: 'pay',
    reason: 'CAPABILITY_NOT_GRANTED',
    note: 'Agent attempted a transfer outside its granted capability set.',
    at: new Date().toISOString(),
  });
  await chain.rejectAction({
    agentId: drifter.agentId,
    capability: 'pay',
    value: parseEther('9'),
    evidence: overreach.digest,
  });
  console.log('  rejection     1 blocked over-mandate attempt written on-chain');
  console.log('');

  // ── the anonymous one ───────────────────────────────────
  // Deliberately NOT created. An unverified owner cannot hold a passport at all,
  // and demonstrating that refusal live is stronger than showing an empty row.
  console.log('ghost — intentionally has no passport (no World ID owner)');
  console.log('');

  // ── verify what we just built ───────────────────────────
  const client = kyaClient();
  const all = await client.allPassports();
  console.log('Seeded passports');
  for (const p of all.sort((a, b) => Number(a.agentId) - Number(b.agentId))) {
    const integrity = await client.verifyLogIntegrity(p.agentId);
    console.log(
      `  #${p.agentId} ${(p.ensName || p.domain).padEnd(22)} score=${(p.reputation.scorePct.toFixed(1) + '%').padEnd(7)} ` +
        `actions=${String(p.reputation.total).padEnd(4)} rejected=${p.reputation.rejected} ` +
        `human=${p.humanVerified ? 'yes' : 'no '} chain=${integrity.verified ? 'verified' : 'MISMATCH'}`,
    );
  }
}

main().catch((err) => {
  console.error('seed failed:', err);
  process.exit(1);
});
