#!/usr/bin/env node
/**
 * Extract the authenticated X (Twitter) session from the user's REAL browser
 * profiles (Brave first, then Chrome) into a Playwright storageState file.
 *
 * Why this exists: the agent must act as YOU — the X account logged into the
 * browser you actually use — not a fresh headless profile that lands on the
 * X login wall. Cookies are read via the sqlite3 CLI in immutable mode, so
 * this works while the browser is running. No new dependencies: Node builtins
 * + the OS `security` (macOS Keychain) or existing Linux fallback script.
 *
 * Usage: node extract-browser-session.mjs [target_storage_path]
 * Prints one JSON result line to stdout; exit 0 on success, 1 otherwise.
 */
import {spawnSync} from 'node:child_process';
import {createDecipheriv, pbkdf2Sync} from 'node:crypto';
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {homedir, platform} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2] || resolve(here, '.storage', 'x-session.json');

const HOME = homedir();
const MAC_CANDIDATES = [
  {browser: 'brave', db: join(HOME, 'Library/Application Support/BraveSoftware/Brave-Browser/Default/Cookies'), keyService: 'Brave Safe Storage'},
  {browser: 'chrome', db: join(HOME, 'Library/Application Support/Google/Chrome/Default/Cookies'), keyService: 'Chrome Safe Storage'},
  {browser: 'brave', db: join(HOME, 'Library/Application Support/BraveSoftware/Brave-Browser/Profile 1/Cookies'), keyService: 'Brave Safe Storage'},
  {browser: 'chrome', db: join(HOME, 'Library/Application Support/Google/Chrome/Profile 1/Cookies'), keyService: 'Chrome Safe Storage'},
  {browser: 'chromium', db: join(HOME, 'Library/Application Support/Chromium/Default/Cookies'), keyService: 'Chromium Safe Storage'},
];
const LINUX_CANDIDATES = [
  {browser: 'chrome', db: join(HOME, '.config/google-chrome/Default/Cookies'), keyService: null},
  {browser: 'brave', db: join(HOME, '.config/BraveSoftware/Brave-Browser/Default/Cookies'), keyService: null},
  {browser: 'chromium', db: join(HOME, '.config/chromium/Default/Cookies'), keyService: null},
];

function keychainPassword(service) {
  const p = spawnSync('security', ['find-generic-password', '-ws', service], {encoding: 'utf8'});
  const pw = (p.stdout || '').trim();
  return pw || null;
}

const printable = (buf) => buf.length > 0 && [...buf].every((b) => b >= 32 && b <= 126);

/** macOS Chrome/Brave v10 cookie decryption. Returns utf8 string or null. */
function decryptMac(encHex, password) {
  let raw;
  try {
    raw = Buffer.from(encHex, 'hex');
  } catch {
    return null;
  }
  if (!raw.subarray(0, 3).toString().match(/^v1[01]/)) {
    // Plaintext cookie (rare) — accept as-is if printable.
    const s = raw.toString('utf8');
    return printable(raw) ? s : null;
  }
  const payload = raw.subarray(3);
  let key;
  try {
    key = pbkdf2Sync(Buffer.from(password, 'utf8'), Buffer.from('saltysalt'), 1003, 16, 'sha1');
  } catch {
    return null;
  }
  // Node's decipher already strips PKCS#7 (autoPadding). What remains is a
  // 32-byte integrity prefix followed by the plaintext cookie value.
  try {
    const dec = createDecipheriv('aes-128-cbc', key, Buffer.alloc(16, ' '));
    const out = Buffer.concat([dec.update(payload), dec.final()]);
    for (const body of [out.subarray(32), out]) {
      if (printable(body)) return body.toString('utf8');
    }
  } catch {
    // bad key / corrupt row
  }
  return null;
}

function readCookies(db) {
  const sql = `SELECT host_key, name, path, is_secure, is_httponly, expires_utc, hex(encrypted_value) FROM cookies WHERE host_key LIKE '%x.com%' OR host_key LIKE '%twitter.com%'`;
  // immutable=1 so a running browser's lock never blocks us.
  const p = spawnSync('sqlite3', [`file:${db}?immutable=1`, '-separator', '\t', sql], {encoding: 'utf8'});
  if (p.status !== 0) return null;
  return (p.stdout || '').split('\n').filter((l) => l.trim());
}

function extract() {
  if (platform() !== 'darwin') {
    return {success: false, error: 'not macOS — caller should use the Linux extractor'};
  }
  for (const cand of [...MAC_CANDIDATES, ...LINUX_CANDIDATES]) {
    if (!existsSync(cand.db)) continue;
    const password = cand.keyService ? keychainPassword(cand.keyService) : null;
    if (!password) continue;
    const rows = readCookies(cand.db);
    if (!rows) continue;
    const cookies = [];
    let hasAuthToken = false;
    for (const row of rows) {
      const [host, name, path, isSec, isHttp, expUtc, encHex] = row.split('\t');
      if (!host || !name || !encHex) continue;
      const value = decryptMac(encHex.trim(), password);
      if (value === null || value === '') continue;
      if (name === 'auth_token' && value) hasAuthToken = true;
      let expires = -1;
      const exp = Number(expUtc);
      if (exp > 0) expires = exp / 1000000 - 11644473600;
      cookies.push({
        name,
        value,
        domain: host,
        path: path || '/',
        expires,
        httpOnly: isHttp === '1',
        secure: isSec === '1',
        sameSite: 'None',
      });
    }
    if (cookies.length && hasAuthToken) {
      mkdirSync(dirname(resolve(target)), {recursive: true});
      writeFileSync(resolve(target), JSON.stringify({cookies, origins: []}, null, 2), 'utf8');
      return {
        success: true,
        browser: cand.browser,
        profile: cand.db,
        cookies_count: cookies.length,
        has_auth_token: true,
        target_path: resolve(target),
        cookie_names: cookies.map((c) => c.name),
      };
    }
  }
  return {success: false, error: 'No authenticated X session (auth_token) found in Brave/Chrome profiles'};
}

const res = extract();
console.log(JSON.stringify(res));
process.exit(res.success ? 0 : 1);
