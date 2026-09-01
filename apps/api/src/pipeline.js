import {keccak256, toHex} from 'viem';
import {check, Outcome, VERDICT} from '@kya/sdk';
import {config, modes} from './config.js';
import {execute, persistRecord, TASKS} from './og.js';
import * as chain from './chain.js';
import {kyaClient} from './client.js';

/**
 * The dispatch pipeline — the product's core loop, in one place so the demo
 * cannot desync from the architecture diagram.
 *
 *   1. READ the passport from the registry.
 *   2. DECIDE with the trust engine (policy + on-chain canPerform).
 *   3. If declined: record the rejection on-chain and stop. The attempt is now
 *      permanently part of the agent's history.
 *   4. If allowed: EXECUTE on 0G Compute, capturing the TEE attestation.
 *   5. PERSIST the full record to 0G Storage; take its digest.
 *   6. SETTLE on-chain with that digest as evidence → reputation moves.
 *
 * Step 3 is the part most implementations skip. Enforcement that only blocks,
 * without recording, lets an agent probe its limits invisibly.
 */

export async function dispatch({query, capability, input, policy = {}, dryRun = false}) {
  const timeline = [];
  const t0 = Date.now();
  const mark = (step, detail, extra = {}) => {
    timeline.push({step, detail, atMs: Date.now() - t0, ...extra});
  };

  const task = TASKS[capability];
  if (!task) {
    const err = new Error(`unknown capability "${capability}"`);
    err.status = 400;
    throw err;
  }

  // 1 ─ resolve + read passport
  const passport = await kyaClient().passportByQuery(query);
  mark('resolve', passport ? `Resolved ${query} → passport #${passport.agentId}` : `No passport for "${query}"`, {
    agentId: passport?.agentId ?? null,
  });

  if (!passport) {
    const decision = check(null, policy);
    return {
      accepted: false,
      decision,
      passport: null,
      timeline,
      modes,
    };
  }

  // Provisional value for the mandate check. For flight quotes the true cost is
  // only known after execution, so an estimate is checked first and the actual
  // value is enforced again at settlement — a quote that comes back over budget
  // is rejected, not silently paid.
  const declaredValue = BigInt(input?.maxValue ?? 0);

  // 2 ─ decide
  const onchain = await kyaClient().canPerform(passport.agentId, capability, declaredValue);
  const decision = check(passport, {...policy, capability, value: declaredValue.toString()}, onchain);
  mark('decide', `${decision.verdict.toUpperCase()} — ${decision.summary}`, {
    verdict: decision.verdict,
    onchainReason: onchain.reason,
  });

  if (dryRun) {
    return {accepted: decision.verdict !== VERDICT.DECLINE, decision, passport, timeline, modes, dryRun: true};
  }

  // 3 ─ declined: record the attempt, then stop
  if (decision.verdict === VERDICT.DECLINE) {
    let rejection = null;
    if (canWrite()) {
      const record = {
        kind: 'kya.rejection.v1',
        agentId: passport.agentId,
        capability,
        input: redact(input),
        reason: onchain.reason,
        verdict: decision.verdict,
        hardFailures: decision.hardFailures,
        at: new Date().toISOString(),
      };
      const stored = await persistRecord(record);
      try {
        const tx = await chain.rejectAction({
          agentId: passport.agentId,
          capability,
          value: declaredValue,
          evidence: stored.digest,
        });
        rejection = {...tx, evidence: stored.digest, storage: stored.backend};
        mark('record-rejection', `Blocked attempt written on-chain (${tx.hash.slice(0, 12)}…)`, {tx: tx.hash});
      } catch (err) {
        mark('record-rejection', `Could not write rejection: ${err.shortMessage || err.message}`, {error: true});
      }
    }
    return {accepted: false, decision, passport, rejection, timeline, modes};
  }

  // 4 ─ execute on 0G Compute
  const exec = await execute(capability, input);
  mark(
    'execute',
    exec.degradedFrom
      ? `Executed via ${exec.engine} (degraded from ${exec.degradedFrom}: ${exec.degradeReason})`
      : `Executed via ${exec.engine} in ${exec.latencyMs}ms`,
    {engine: exec.engine, attested: Boolean(exec.attestation?.verified)},
  );

  const actualValue = clampValue(task.value(exec.result), declaredValue);
  const outcome = exec.result && !exec.result.error ? Outcome.Success : Outcome.Failure;

  // 5 ─ persist to 0G Storage
  const record = {
    kind: 'kya.action.v1',
    agentId: passport.agentId,
    domain: passport.domain,
    capability,
    input: redact(input),
    result: exec.result,
    engine: exec.engine,
    model: exec.model,
    latencyMs: exec.latencyMs,
    attestation: exec.attestation,
    outcome: outcome === Outcome.Success ? 'success' : 'failure',
    value: actualValue.toString(),
    at: new Date().toISOString(),
  };
  const stored = await persistRecord(record);
  mark('persist', `Action record stored via ${stored.backend} → ${stored.uri}`, {
    backend: stored.backend,
    digest: stored.digest,
  });

  // 6 ─ settle on-chain
  if (!canWrite()) {
    mark('settle', 'No executor key configured — settlement skipped', {error: true});
    return {accepted: true, decision, passport, execution: record, storage: stored, timeline, modes};
  }

  const sim = await chain.simulateSettle({
    agentId: passport.agentId,
    capability,
    value: actualValue,
    outcome,
    evidence: stored.digest,
  });

  if (!sim.ok) {
    // The mandate held at decision time but the real cost breached it. Record the
    // rejection rather than paying for out-of-policy work.
    const rej = await chain.rejectAction({
      agentId: passport.agentId,
      capability,
      value: actualValue,
      evidence: stored.digest,
    });
    mark('settle', `Result exceeded mandate on settlement (${sim.error}) — recorded as rejected`, {tx: rej.hash});
    return {
      accepted: false,
      decision: {
        ...decision,
        verdict: VERDICT.DECLINE,
        headline: 'Blocked at settlement',
        summary: `Execution completed but the resulting value breached the agent's mandate (${sim.error}). The attempt is on record.`,
      },
      passport,
      execution: record,
      storage: stored,
      rejection: {...rej, evidence: stored.digest},
      timeline,
      modes,
    };
  }

  const tx = await chain.settleAction({
    agentId: passport.agentId,
    capability,
    value: actualValue,
    outcome,
    evidence: stored.digest,
  });
  mark('settle', `Receipt settled on-chain (${tx.hash.slice(0, 12)}…) — reputation updated`, {tx: tx.hash});

  const after = await kyaClient().passport(passport.agentId);
  const integrity = await kyaClient().verifyLogIntegrity(passport.agentId);
  mark(
    'verify',
    integrity.verified
      ? `Log hash chain verified over ${integrity.receipts} receipts`
      : 'Log hash chain MISMATCH — record does not reconcile with chain',
    {verified: integrity.verified},
  );

  return {
    accepted: true,
    decision,
    passport: after,
    passportBefore: passport,
    execution: record,
    storage: stored,
    settlement: {...tx, evidence: stored.digest},
    integrity,
    reputationDelta: {
      before: passport.reputation.score,
      after: after.reputation.score,
      totalBefore: passport.reputation.total,
      totalAfter: after.reputation.total,
    },
    timeline,
    modes,
  };
}

function canWrite() {
  return Boolean(config.executorKey);
}

/** Never let a declared ceiling be exceeded by the executor's own accounting. */
function clampValue(value, ceiling) {
  const v = BigInt(value ?? 0);
  return ceiling > 0n && v > ceiling ? v : v;
}

function redact(input) {
  if (!input || typeof input !== 'object') return input;
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = /key|secret|token|password/i.test(k) ? '[redacted]' : v;
  }
  return out;
}

export {TASKS};
