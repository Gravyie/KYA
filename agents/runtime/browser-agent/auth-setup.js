#!/usr/bin/env node

/**
 * Authentication Setup for KYA Browser Agent.
 * Automatically searches for already opened Google Chrome windows on your desktop:
 * 1. Checks for active Chrome DevTools Protocol (CDP) ports (9222, etc.).
 * 2. If CDP is not enabled, automatically extracts the authenticated X (Twitter)
 *    session from the local running Chrome profile via GNOME Keyring & SQLite.
 * 3. Falls back to launching an interactive browser if needed.
 */
import {chromium} from 'playwright';
import {mkdirSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execSync, spawnSync} from 'node:child_process';
import readline from 'node:readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const storageDir = resolve(__dirname, '.storage');
const storagePath = resolve(storageDir, 'x-session.json');
const extractorScript = resolve(__dirname, 'extract-chrome-session.py');

if (!existsSync(storageDir)) {
  mkdirSync(storageDir, {recursive: true});
}

function prompt(question) {
  const rl = readline.createInterface({input: process.stdin, output: process.stdout});
  return new Promise((res) => {
    rl.question(question, (answer) => {
      rl.close();
      res(answer.trim());
    });
  });
}

/**
 * Check if a specific port responds with Chrome DevTools Protocol /json/version
 */
async function checkCdpPort(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(1000),
    });
    if (res.ok) {
      const json = await res.json();
      return {port, endpoint: `http://127.0.0.1:${port}`, info: json};
    }
  } catch {}
  return null;
}

/**
 * Scan common Chrome remote debugging ports
 */
async function findRunningChromeCdp() {
  const candidatePorts = [9222, 9223, 9224, 9229, 9230];
  for (const port of candidatePorts) {
    const found = await checkCdpPort(port);
    if (found) return found;
  }
  return null;
}

/**
 * Check if Chrome processes exist on Linux
 */
function isChromeProcessRunning() {
  try {
    const stdout = execSync('ps aux | grep -i "[c]hrome"', {encoding: 'utf8'});
    return Boolean(stdout && stdout.trim().length > 0);
  } catch {
    return false;
  }
}

/**
 * Automatically extract cookies directly from local Google Chrome profile
 */
function tryDirectChromeProfileExtraction() {
  if (!existsSync(extractorScript)) return null;
  try {
    const proc = spawnSync('python3', [extractorScript, storagePath], {encoding: 'utf8'});
    if (proc.status === 0 && proc.stdout) {
      const result = JSON.parse(proc.stdout.trim());
      if (result && result.success && result.has_auth_token) {
        return result;
      }
    }
  } catch (err) {
    // ignore and fallback
  }
  return null;
}

async function attachAndExtractSession(cdpEndpoint) {
  console.log(`\n🔗 Connecting directly to your open Chrome at ${cdpEndpoint}...`);
  const browser = await chromium.connectOverCDP(cdpEndpoint);
  const contexts = browser.contexts();
  const context = contexts[0] || (await browser.newContext());

  const pages = context.pages();
  console.log(`Found ${pages.length} open tab(s) in your Chrome window.`);

  let targetPage = null;
  for (const page of pages) {
    const url = page.url();
    if (url.includes('x.com') || url.includes('twitter.com')) {
      targetPage = page;
      console.log(`🎯 Found existing X (Twitter) tab: ${url}`);
      break;
    }
  }

  if (!targetPage) {
    console.log('No tab currently on x.com. Opening a new tab in your running Chrome to inspect session...');
    targetPage = await context.newPage();
    await targetPage.goto('https://x.com/home', {waitUntil: 'domcontentloaded'});
    await targetPage.waitForTimeout(3000);
  }

  console.log('\nExtracting session cookies & storage state from your Chrome...');
  await context.storageState({path: storagePath});

  console.log(`✅ SUCCESS! Authenticated session saved to:`);
  console.log(`   ${storagePath}`);
  console.log('\nThe Browser Agent can now run in headless mode without any login screens!\n');
}

async function main() {
  console.log('========================================================');
  console.log('🔍 KYA Browser Agent: Searching for Open Chrome Windows');
  console.log('========================================================\n');

  // Step 1: Check if Chrome is running with DevTools Protocol
  console.log('1. Scanning local ports for active Chrome instances...');
  let cdp = await findRunningChromeCdp();

  if (cdp) {
    console.log(`✅ Found open Chrome with remote debugging on port ${cdp.port}!`);
    await attachAndExtractSession(cdp.endpoint);
    process.exit(0);
  }

  // Step 2: Check if Chrome is running and attempt direct profile session extraction
  const chromeRunning = isChromeProcessRunning();
  if (chromeRunning) {
    console.log('ℹ️ Detected Google Chrome currently running on your desktop.');
    console.log('2. Inspecting running Chrome session for authenticated X (Twitter) cookies...');

    const extracted = tryDirectChromeProfileExtraction();
    if (extracted) {
      console.log(`\n🎯 SUCCESS! Found active authenticated X session in your running Chrome:`);
      console.log(`   • Cookies found: ${extracted.cookies_count} (${extracted.cookie_names.slice(0, 5).join(', ')}...)`);
      console.log(`   • auth_token: verified present`);
      console.log(`   • Exported to: ${storagePath}\n`);
      console.log('========================================================');
      console.log('✨ Session is READY! No login or extra browser needed.');
      console.log('You can now run tasks headlessly using your desktop session:');
      console.log('   node agents/runtime/browser-agent/index.js "Check home feed on X"');
      console.log('========================================================\n');
      process.exit(0);
    }
  }

  // Step 3: Fallback options if neither CDP nor profile cookies had an active X session
  console.log('\n⚠️ No active X (Twitter) session was automatically detected in your open Chrome.\n');
  console.log('Options:');
  console.log('  [1] Start Chrome with remote debugging: `google-chrome --remote-debugging-port=9222 &`');
  console.log('  [2] Launch a visible browser window now to sign in manually');

  const choice = await prompt('\nEnter choice (1 or 2): ');
  if (choice === '2') {
    console.log('\nLaunching visible Chrome browser window...');
    const browser = await chromium.launch({
      headless: false,
      channel: 'chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const context = await browser.newContext({
      viewport: {width: 1280, height: 800},
    });
    const page = await context.newPage();
    await page.goto('https://x.com/login', {waitUntil: 'domcontentloaded'});
    await prompt('\nPress [ENTER] here once you have logged in in the browser window: ');
    await context.storageState({path: storagePath});
    console.log(`✅ Session saved to ${storagePath}`);
    await browser.close();
  } else {
    console.log('\nPlease run: google-chrome --remote-debugging-port=9222 &');
    console.log('Then re-run: node agents/runtime/browser-agent/auth-setup.js');
  }
}

main().catch((err) => {
  console.error('Error during auth setup:', err);
  process.exit(1);
});

