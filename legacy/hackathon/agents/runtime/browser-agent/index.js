#!/usr/bin/env node

/**
 * CLI Entry Point for the Headless Browser Agent.
 * Usage:
 *   node agents/runtime/browser-agent/index.js "Post 'Hello from KYA' to X"
 */
import {createBrowserController} from './browser-controller.js';
import {runAgentLoop} from './agent-loop.js';
import {verifyOutcome} from './verify-outcome.js';
import {settleBrowserRun} from './settle.js';
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const storagePath = resolve(__dirname, '.storage', 'x-session.json');

import {readdirSync} from 'node:fs';

export async function runBrowserAgent({task, dryRun = false, targetHandle = null}) {
  if (!task) {
    throw new Error('Task description is required');
  }

  console.log('========================================================');
  console.log(`🤖 KYA Headless Browser Agent (0G Compute TEE Verified)${dryRun ? ' [DRY RUN]' : ''}`);
  console.log('========================================================');
  console.log(`Task: "${task}"`);
  if (dryRun) console.log(`Mode: DRY RUN (Composes post, skips clicking Post button)\n`);
  else console.log('');

  if (!existsSync(storagePath)) {
    console.warn(`⚠️ Warning: No authenticated session found at:`);
    console.warn(`   ${storagePath}`);
    console.warn(`   Run 'node auth-setup.js' once first if this task requires an active login.\n`);
  }

  const runId = `run-${Date.now()}`;
  const runsDir = resolve(__dirname, '.runs', runId);
  mkdirSync(runsDir, {recursive: true});

  console.log('Initializing headless browser controller...');
  const controller = await createBrowserController({
    storagePath,
    headless: true,
  });

  // Navigate to X home / timeline by default
  await controller.navigate('https://x.com/home');

  // Dynamically detect authenticated user from DOM
  let authenticatedUser = null;
  try {
    authenticatedUser = await controller.getAuthenticatedUser();
    if (authenticatedUser?.handle) {
      console.log(`👤 Active X Account: @${authenticatedUser.handle}${authenticatedUser.displayName ? ` (${authenticatedUser.displayName})` : ''}`);
    }
  } catch {}

  let loopResult;
  let verification;

  try {
    // 1. Run the perception-action decision loop
    loopResult = await runAgentLoop({
      controller,
      task,
      maxSteps: 15,
      runsDir,
      dryRun,
    });

    // 2. Perform independent outcome verification on user profile
    verification = await verifyOutcome({
      controller,
      task,
      runsDir,
      dryRun,
      targetHandle: targetHandle || authenticatedUser?.handle,
    });
  } finally {
    await controller.close();
  }

  // Find all screenshot files created in runsDir
  const screenshotFiles = existsSync(runsDir)
    ? readdirSync(runsDir).filter((f) => f.endsWith('.png')).sort()
    : [];

  const screenshots = screenshotFiles.map((filename) => ({
    filename,
    url: `/api/browser-agent/screenshot/${runId}/${filename}`,
    label: filename === 'final-verification.png'
      ? 'Outcome Verification'
      : filename.replace('.png', '').replace('-', ' ').toUpperCase(),
  }));

  // 3. Compile structured result
  const finalResult = {
    runId,
    task,
    dryRun,
    outcome: verification.outcome,
    stepsTaken: loopResult.stepsTaken,
    finalScreenshotPath: verification.finalScreenshotPath,
    judgment: verification.judgment,
    visualEvidence: verification.visualEvidence,
    attestation: verification.attestation,
    authenticatedUser: verification.authenticatedUser || authenticatedUser,
    actionsLog: loopResult.actionsLog,
    screenshots,
    timestamp: new Date().toISOString(),
  };

  // 4. Persist to 0G Storage & settle on-chain
  const settlement = await settleBrowserRun({
    summary: finalResult,
    task,
    runDir: runsDir,
  });

  finalResult.settlement = settlement;

  const summaryFile = resolve(runsDir, 'summary.json');
  writeFileSync(summaryFile, JSON.stringify(finalResult, null, 2), 'utf8');

  return finalResult;
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  let handle = null;
  const handleIdx = args.findIndex((a) => a === '--handle' || a === '-u');
  if (handleIdx !== -1 && args[handleIdx + 1]) {
    handle = args[handleIdx + 1];
  }

  const task = args
    .filter((a, idx) => a !== '--dry-run' && a !== '--handle' && a !== '-u' && (handleIdx === -1 || idx !== handleIdx + 1))
    .join(' ')
    .trim();

  if (!task) {
    console.log('Usage: node agents/runtime/browser-agent/index.js "<task description>" [--dry-run] [--handle <username>]');
    console.log('Example: node agents/runtime/browser-agent/index.js "Post \\"KYA agent test ping\\" on X" --dry-run\n');
    process.exit(1);
  }

  const finalResult = await runBrowserAgent({task, dryRun: isDryRun, targetHandle: handle});

  console.log('========================================================');
  console.log('📋 FINAL STRUCTURED RESULT');
  console.log('========================================================');
  console.log(JSON.stringify(finalResult, null, 2));
  console.log(`\nRun artifacts saved in: ${resolve(__dirname, '.runs', finalResult.runId)}\n`);

  process.exit(finalResult.outcome === 'success' ? 0 : 1);
}

// Only execute CLI runner if executed directly
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((err) => {
    console.error('Fatal Browser Agent Error:', err);
    process.exit(1);
  });
}
