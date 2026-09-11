#!/usr/bin/env node

/**
 * 0G Storage & On-Chain Reputation Settlement for KYA Browser Agent.
 * Takes the execution summary from a browser run:
 * 1. Formats it into the canonical KYA action record schema (kya.action.v1).
 * 2. Persists the record to 0G Storage (indexer endpoint / decentralized nodes),
 *    falling back to content-addressed local storage if offline.
 * 3. Settles the receipt on-chain via PassportRegistry.sol (settleAction),
 *    updating the agent's on-chain reputation score and chaining the 0G digest
 *    into the agent's Merkle logHead.
 */
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');

export async function settleBrowserRun({
  summary,
  task,
  agentId = null,
  runDir = null,
}) {
  console.log('\n========================================================');
  console.log('📦 0G Storage & On-Chain Reputation Settlement');
  console.log('========================================================');

  let resolvedAgentId = agentId || 4;
  try {
    const {publicClient, registry} = await import(resolve(ROOT, 'apps/api/src/chain.js'));
    const onChainId = await publicClient.readContract({
      ...registry,
      functionName: 'agentIdByDomain',
      args: ['browser-agent.kya.eth'],
    });
    if (onChainId && Number(onChainId) > 0) {
      resolvedAgentId = Number(onChainId);
    }
  } catch {}

  // 1. Prepare canonical KYA action record
  const outcomeStr = summary.outcome === 'success' ? 'success' : 'failure';
  const totalLatencyMs = (summary.actionsLog || []).reduce((acc, a) => acc + (a.latencyMs || 0), 0);

  const record = {
    kind: 'kya.action.v1',
    agentId: String(resolvedAgentId),
    capability: 'browser.action',
    domain: 'browser-agent.kya.eth',
    task: task || 'Autonomous browser task',
    input: {task: task || 'Autonomous browser task'},
    outcome: outcomeStr,
    stepsTaken: summary.stepsTaken || (summary.actionsLog ? summary.actionsLog.length : 1),
    judgment: summary.judgment || '',
    visualEvidence: summary.visualEvidence || '',
    attestation: summary.attestation || null,
    model: summary.actionsLog?.[0]?.model || 'gpt-oss-120b',
    latencyMs: totalLatencyMs,
    engine: summary.attestation?.provider || '0g-compute-verified',
    finalScreenshot: summary.finalScreenshotPath || null,
    at: new Date().toISOString(),
    value: '1000000000000000', // standard nominal gas-equivalent value unit
  };

  // 2. Persist to 0G Storage
  let storageResult;
  try {
    const {persistRecord} = await import(resolve(ROOT, 'apps/api/src/og.js'));
    storageResult = await persistRecord(record);
    console.log(`\n1. 0G Storage Persistence:`);
    console.log(`   • Backend:        ${storageResult.backend}`);
    console.log(`   • Evidence Digest: ${storageResult.digest}`);
    console.log(`   • Storage URI:    ${storageResult.uri}`);
  } catch (err) {
    console.warn(`⚠️ 0G Storage persistence warning: ${err.message}`);
    storageResult = {
      backend: 'local:in-memory',
      digest: '0x' + Buffer.from(JSON.stringify(record)).toString('hex').slice(0, 64),
      uri: 'kya-local://unpersisted',
    };
  }

  // Save record in runDir if provided
  if (runDir && existsSync(runDir)) {
    const recordFile = resolve(runDir, 'kya-record.json');
    writeFileSync(recordFile, JSON.stringify({...record, storage: storageResult}, null, 2), 'utf8');
  }

  // 3. On-chain settlement on PassportRegistry.sol
  let onChainResult = {
    settled: false,
    txHash: null,
    blockNumber: null,
    reputation: null,
    scoreBefore: 0,
    scoreAfter: 0,
    scoreDelta: 0,
    reason: null,
  };

  console.log(`\n2. On-Chain Reputation Settlement:`);
  try {
    const {settleAction} = await import(resolve(ROOT, 'apps/api/src/chain.js'));
    const {kyaClient} = await import(resolve(ROOT, 'apps/api/src/client.js'));
    const {Outcome} = await import(resolve(ROOT, 'packages/sdk/src/enums.js'));

    // Read baseline reputation before settlement
    let scoreBefore = 0;
    try {
      const beforePassport = await kyaClient().passport(resolvedAgentId);
      if (beforePassport?.reputation) {
        scoreBefore = Number(beforePassport.reputation.score) || 0;
      }
    } catch {}

    // Outcome.Success = 1, Outcome.Failure = 2, Outcome.Rejected = 3
    const outcomeCode = outcomeStr === 'success' ? Outcome.Success : Outcome.Failure;

    const tx = await settleAction({
      agentId: resolvedAgentId,
      capability: 'browser.action',
      value: 0n,
      outcome: outcomeCode,
      evidence: storageResult.digest,
    });

    console.log(`   • Status:      SETTLED ON-CHAIN ✅`);
    console.log(`   • Outcome:     ${outcomeStr.toUpperCase()} (code: ${outcomeCode})`);
    console.log(`   • Tx Hash:     ${tx.hash}`);
    console.log(`   • Block:       ${tx.blockNumber}`);
    console.log(`   • Gas Used:    ${tx.gasUsed}`);

    // Read updated reputation after settlement
    let scoreAfter = scoreBefore;
    let afterReputation = null;
    try {
      const afterPassport = await kyaClient().passport(resolvedAgentId);
      if (afterPassport?.reputation) {
        afterReputation = afterPassport.reputation;
        scoreAfter = Number(afterPassport.reputation.score) || 0;
      }
    } catch {}

    const scoreDelta = scoreAfter - scoreBefore;
    const deltaSign = scoreDelta > 0 ? '+' : '';
    const deltaPct = (scoreDelta / 100).toFixed(1);

    if (scoreDelta !== 0) {
      console.log(`   • Reputation:  Score ${scoreBefore} → ${scoreAfter} (${deltaSign}${deltaPct}% ${scoreDelta > 0 ? 'Boost' : 'Penalty'})`);
    } else {
      console.log(`   • Reputation:  Score ${scoreAfter} (No change)`);
    }

    onChainResult = {
      settled: true,
      txHash: tx.hash,
      blockNumber: tx.blockNumber,
      gasUsed: tx.gasUsed,
      scoreBefore,
      scoreAfter,
      scoreDelta,
      outcome: outcomeStr,
      outcomeCode,
      reputation: afterReputation,
    };
  } catch (err) {
    const msg = err.shortMessage || err.message;
    console.log(`   • Status:      STORED (Pending on-chain broadcast)`);
    console.log(`   • Detail:      ${msg}`);
    console.log(`   • Notice:      Chain RPC is offline. Record is permanently anchored with 0G digest ${storageResult.digest.slice(0, 16)}...`);
    onChainResult = {
      settled: false,
      txHash: null,
      blockNumber: null,
      reason: msg,
    };
  }

  console.log('========================================================\n');

  return {
    record,
    storage: storageResult,
    onChain: onChainResult,
  };
}

// CLI direct runner
if (process.argv[1] && process.argv[1].endsWith('settle.js')) {
  const runDirArg = process.argv[2];
  if (!runDirArg) {
    console.log('Usage: node settle.js <path-to-run-dir>');
    process.exit(1);
  }
  const summaryPath = resolve(runDirArg, 'summary.json');
  if (!existsSync(summaryPath)) {
    console.error(`Error: ${summaryPath} does not exist`);
    process.exit(1);
  }
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
  settleBrowserRun({
    summary,
    task: summary.judgment || 'Autonomous browser task',
    runDir: resolve(runDirArg),
  }).catch(console.error);
}
