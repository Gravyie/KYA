import {generateKeyPairSync} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, appendFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {createStoreCore, newToken, sha256} from './store-core.js';
export {GENESIS, sha256, newToken, now, safeEqual, eventHash, verify} from './store-core.js';

/**
 * File layout: state.json holds owner, agents, approvals and the signing key.
 * events.jsonl is the append-only, hash-linked audit log. Appending one line
 * per event keeps writes O(1) however long the log grows.
 */
export function createStore(dataDir) {
  mkdirSync(dataDir, {recursive: true});
  const stateFile = resolve(dataDir, 'state.json');
  const eventsFile = resolve(dataDir, 'events.jsonl');
  const recoveryFile = resolve(dataDir, 'recovery.key');
  if (!existsSync(recoveryFile)) writeFileSync(recoveryFile, newToken('mir') + '\n', {mode: 0o600, flag: 'wx'});

  let state;
  let events = [];
  if (existsSync(stateFile)) {
    state = JSON.parse(readFileSync(stateFile, 'utf8'));
    if (Array.isArray(state.events)) { // v1 stored events inside state.json
      events = state.events;
      writeFileSync(eventsFile, events.map(e => JSON.stringify(e)).join('\n') + (events.length ? '\n' : ''), {mode: 0o600});
      delete state.events;
    } else if (existsSync(eventsFile)) {
      events = readFileSync(eventsFile, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
    }
    state.version = 2;
    state.approvals ??= [];
    for (const agent of state.agents) {
      agent.limits ??= {budget: null, rate: null};
      agent.expiresAt ??= null;
      for (const scope of agent.scopes) scope.mode ??= 'allow';
    }
  } else {
    const {privateKey, publicKey} = generateKeyPairSync('ed25519');
    state = {
      version: 2, owner: null, agents: [], approvals: [],
      privateKey: privateKey.export({type: 'pkcs8', format: 'pem'}),
      publicKey: publicKey.export({type: 'spki', format: 'pem'}),
    };
  }

  function save() {
    const temp = `${stateFile}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify(state, null, 2), {mode: 0o600});
    renameSync(temp, stateFile);
  }
  if (!existsSync(stateFile)) save();
  if (!existsSync(eventsFile)) writeFileSync(eventsFile, '', {mode: 0o600});

  return createStoreCore(state, events, {
    save,
    writeEvent: entry => appendFileSync(eventsFile, JSON.stringify(entry) + '\n'),
    recoveryHash: () => sha256(readFileSync(recoveryFile, 'utf8').trim()),
  });
}
