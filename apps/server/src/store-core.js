import {randomBytes, randomUUID, createHash, sign, verify, timingSafeEqual} from 'node:crypto';

export const GENESIS = '0'.repeat(64);
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const newToken = prefix => `${prefix}_${randomBytes(32).toString('base64url')}`;
export const now = () => new Date().toISOString();
export function safeEqual(a, b) {
  if (!a || !b) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export const eventHash = ({hash: _ignored, ...rest}) => sha256(JSON.stringify(rest));

/** The same policy/audit semantics with either local files or transactional SQLite. */
export function createStoreCore(state, events, {save, writeEvent, recoveryHash, storage = 'local'}) {
  function append(agentId, kind, details = {}) {
    const entry = {seq: events.length + 1, id: randomUUID(), at: now(), agentId, kind, details,
      previousHash: events.at(-1)?.hash ?? GENESIS};
    entry.hash = eventHash(entry);
    writeEvent(entry);
    events.push(entry);
    return entry;
  }
  function usage(agent, at = Date.now()) {
    const {budget, rate} = agent.limits ?? {};
    const spendSince = budget ? at - budget.windowHours * 3600e3 : Infinity;
    const callSince = rate ? at - rate.windowMinutes * 60e3 : Infinity;
    let spent = 0, calls = 0;
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i], t = Date.parse(e.at);
      if (t < Math.min(spendSince, callSince)) break;
      if (e.agentId !== agent.id || !['action.allowed', 'approval.granted'].includes(e.kind)) continue;
      if (t >= spendSince) spent += Number(e.details.amount) || 0;
      if (t >= callSince) calls++;
    }
    return {spent, calls};
  }
  const signBytes = data => sign(null, Buffer.from(data), state.privateKey);
  return {state, events, save, append, usage, storage, recoveryHash,
    publicKey: () => state.publicKey, fingerprint: () => sha256(state.publicKey), signBytes,
    signJson: payload => signBytes(JSON.stringify(payload)).toString('base64url'),
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
