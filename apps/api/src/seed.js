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
 * Two properties this seed insists on:
 *
 *  1. EVERY receipt goes through the real settlement path — executor key, 0G
 *     evidence digest, on-chain `settleAction`. Nothing is written directly to
 *     storage, so seeded history is indistinguishable from live history and the
 *     hash chain verifies over it.
 *
 *  2. HISTORY IS SPREAD OVER REAL CALENDAR TIME. Registrations land ~6 weeks
 *     back and receipts are distributed forward from there, interleaved across
 *     agents in chronological order. An agent showing "123 actions, registered
 *     28 minutes ago" tells a judge the history is fabricated before they ask a
 *     question; it also makes the staleness signal meaningless, because nothing
 *     can ever be dormant. The timestamps in the on-chain receipts are real.
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

const DAY = 86_400;
const HISTORY_DAYS = 42; // how far back the oldest passport was registered

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
    verifiedAt: await chain.chainNow(),
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

/**
 * Build (but do not submit) the receipts for one agent, each stamped with the
 * wall-clock second it should land at. Submission happens later, globally
 * ordered, so several agents' histories interleave the way real ones would.
 */
async function planHistory({agentId, capability, count, failureRate, seed, startAt, endAt}) {
  const rand = prng(seed);
  const task = TASKS[capability];
  const items = [];
  const span = Math.max(1, endAt - startAt);

  for (let i = 0; i < count; i++) {
    const failed = rand() < failureRate;
    const input =
      capability === 'flight.quote'
        ? {
            from: 'BOM',
            to: ['DEL', 'BLR', 'DXB', 'SIN', 'LHR'][i % 5],
            date: `2026-09-${String((i % 27) + 1).padStart(2, '0')}`,
          }
        : {question: `seed question ${i}`};

    // Spread across the window with deterministic jitter, so receipts don't land
    // on a suspiciously regular cadence.
    const at = Math.floor(startAt + (span * (i + 0.5 + (rand() - 0.5) * 0.7)) / count);
    const result = task.local(input);

    const stored = await persistRecord({
      kind: 'kya.action.v1',
      agentId: String(agentId),
      capability,
      input,
      result,
      engine: 'local:deterministic-executor',
      model: 'deterministic',
      outcome: failed ? 'failure' : 'success',
      seedIndex: i,
      at: new Date(at * 1000).toISOString(),
    });

    items.push({
      at,
      agentId,
      capability,
      value: failed ? 0n : task.value(result),
      outcome: failed ? Outcome.Failure : Outcome.Success,
      evidence: stored.digest,
    });
  }

  const success = items.filter((i) => i.outcome === Outcome.Success).length;
  console.log(
    `  planned       ${count} receipts (${success} success / ${count - success} failure) over ` +
      `${Math.round(span / DAY)} days`,
  );
  return items;
}

/**
 * Submit a globally-ordered timeline. The chain clock is advanced to each
 * receipt's intended second before it is settled, so `Action.timestamp` and the
 * daily spend windows are genuinely distributed rather than collapsed into one
 * block.
 */
async function settleTimeline(timeline) {
  timeline.sort((a, b) => a.at - b.at);
  let last = 0;
  let n = 0;

  for (const item of timeline) {
    // Anvil rejects a non-increasing next-block timestamp; keep it monotonic.
    const target = Math.max(item.at, last + 1);
    await chain.timeTravel(target);
    last = target;

    if (item.outcome === Outcome.Rejected) {
      await chain.rejectAction(item);
    } else {
      await chain.settleAction(item);
    }
    if (++n % 40 === 0 || n === timeline.length) {
      console.log(`  settled       ${n}/${timeline.length} receipts`);
    }
  }
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

  const realNow = Math.floor(Date.now() / 1000);
  const genesis = realNow - HISTORY_DAYS * DAY;

  // Rewind the chain so registrations are genuinely weeks old.
  const travelled = await chain.timeTravel(genesis);
  console.log(
    travelled
      ? `  clock         rewound ${HISTORY_DAYS}d to ${new Date(genesis * 1000).toISOString().slice(0, 10)}`
      : '  clock         live chain — history will be dated from now',
  );
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
  const timeline = await planHistory({
    agentId: optimizer.agentId,
    capability: 'flight.quote',
    count: 120,
    failureRate: 0.03,
    seed: 'optimizer',
    startAt: genesis + DAY,
    endAt: realNow - 3600, // active as of an hour ago
  });
  console.log('');

  // ── the one that overreached ────────────────────────────
  // Registered later than the veteran, so the roster shows a real cohort spread.
  await chain.timeTravel(genesis + 12 * DAY);
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
  timeline.push(
    ...(await planHistory({
      agentId: drifter.agentId,
      capability: 'flight.quote',
      count: 22,
      failureRate: 0.09,
      seed: 'drifter',
      startAt: genesis + 13 * DAY,
      endAt: realNow - 5 * DAY,
    })),
  );

  // A real blocked attempt: capability not granted. Recorded, not hidden.
  const overreach = await persistRecord({
    kind: 'kya.rejection.v1',
    agentId: String(drifter.agentId),
    capability: 'pay',
    reason: 'CAPABILITY_NOT_GRANTED',
    note: 'Agent attempted a transfer outside its granted capability set.',
    at: new Date((realNow - 4 * DAY) * 1000).toISOString(),
  });
  timeline.push({
    at: realNow - 4 * DAY,
    agentId: drifter.agentId,
    capability: 'pay',
    value: parseEther('9'),
    outcome: Outcome.Rejected,
    evidence: overreach.digest,
  });
  console.log('  rejection     1 blocked over-mandate attempt queued');
  console.log('');

  // ── the rookie ──────────────────────────────────────────
  // Genuinely new: registered days ago, four actions, nothing to lean on.
  await chain.timeTravel(realNow - 4 * DAY);
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
  timeline.push(
    ...(await planHistory({
      agentId: scout.agentId,
      capability: 'research',
      count: 4,
      failureRate: 0,
      seed: 'scout',
      startAt: realNow - 3 * DAY,
      endAt: realNow - 2 * 3600,
    })),
  );
  console.log('');

  // ── the anonymous one ───────────────────────────────────
  // Deliberately NOT created. An unverified owner cannot hold a passport at all,
  // and demonstrating that refusal live is stronger than showing an empty row.
  console.log('ghost — intentionally has no passport (no World ID owner)');
  console.log('');

  // ── lay down the interleaved history ────────────────────
  console.log(`Settling ${timeline.length} witnessed receipts in chronological order`);
  await settleTimeline(timeline);

  // Land the chain clock at real wall time so the API and UI agree with it.
  await chain.timeTravel(Math.floor(Date.now() / 1000));
  console.log('');

  // ── verify what we just built ───────────────────────────
  const client = kyaClient();
  const all = await client.allPassports();
  console.log('Seeded passports');
  for (const p of all.sort((a, b) => Number(a.agentId) - Number(b.agentId))) {
    const integrity = await client.verifyLogIntegrity(p.agentId);
    const ageDays = Math.floor((Date.now() / 1000 - p.registeredAt) / DAY);
    const lastDays = p.reputation.total ? Math.floor((Date.now() / 1000 - p.reputation.lastActionAt) / DAY) : null;
    console.log(
      `  #${p.agentId} ${(p.ensName || p.domain).padEnd(22)} score=${(p.reputation.scorePct.toFixed(1) + '%').padEnd(7)} ` +
        `actions=${String(p.reputation.total).padEnd(4)} rejected=${p.reputation.rejected} ` +
        `human=${p.humanVerified ? 'yes' : 'no '} age=${String(ageDays + 'd').padEnd(5)} ` +
        `last=${lastDays === null ? 'never' : lastDays === 0 ? 'today' : lastDays + 'd ago'} ` +
        `chain=${integrity.verified ? 'verified' : 'MISMATCH'}`,
    );
  }
}

main().catch((err) => {
  console.error('seed failed:', err);
  process.exit(1);
});
