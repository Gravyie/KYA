import {randomBytes, randomUUID, createHash, generateKeyPairSync, sign, verify, timingSafeEqual} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, appendFileSync} from 'node:fs';
import {resolve} from 'node:path';

export const GENESIS = '0'.repeat(64);
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const newToken = prefix => `${prefix}_${randomBytes(32).toString('base64url')}`;
export const now = () => new Date().toISOString();
export function safeEqual(a, b) {
  if (!a || !b) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Hash of an event exactly as a third party would recompute it from an export. */
export const eventHash = ({hash: _ignored, ...rest}) => sha256(JSON.stringify(rest));

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
  if (!existsSync(recoveryFile)) writeFileSync(recoveryFile, newToken('sgr') + '\n', {mode: 0o600, flag: 'wx'});

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

  function append(agentId, kind, details = {}) {
    const entry = {
      seq: events.length + 1, id: randomUUID(), at: now(), agentId, kind, details,
      previousHash: events.at(-1)?.hash ?? GENESIS,
    };
    entry.hash = eventHash(entry);
    events.push(entry);
    appendFileSync(eventsFile, JSON.stringify(entry) + '\n');
    return entry;
  }

  /** Spend and call count inside the agent's own budget / rate windows. */
  function usage(agent, at = Date.now()) {
    const {budget, rate} = agent.limits ?? {};
    const spendSince = budget ? at - budget.windowHours * 3600e3 : Infinity;
    const callSince = rate ? at - rate.windowMinutes * 60e3 : Infinity;
    let spent = 0, calls = 0;
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      const t = Date.parse(e.at);
      if (t < Math.min(spendSince, callSince)) break;
      if (e.agentId !== agent.id || (e.kind !== 'action.allowed' && e.kind !== 'approval.granted')) continue;
      if (t >= spendSince) spent += Number(e.details.amount) || 0;
      if (t >= callSince) calls += 1;
    }
    return {spent, calls};
  }

  const publicKey = () => state.publicKey;
  const fingerprint = () => sha256(state.publicKey);
  const signBytes = data => sign(null, Buffer.from(data), state.privateKey);
  const signJson = payload => signBytes(JSON.stringify(payload)).toString('base64url');

  return {
    state, events, save, append, usage, publicKey, fingerprint, signBytes, signJson,
    recoveryHash: () => sha256(readFileSync(recoveryFile, 'utf8').trim()),
    verifyChain() {
      let previous = GENESIS;
      for (const e of events) {
        if (e.previousHash !== previous || eventHash(e) !== e.hash) return {valid: false, at: e.id, seq: e.seq};
        previous = e.hash;
      }
      return {valid: true, count: events.length, head: previous};
    },
  };
}

export {verify};
