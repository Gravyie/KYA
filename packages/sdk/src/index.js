export {verifyAssertion, verifyAuditExport, checkStatus} from './verify.js';
export * as erc8004 from './erc8004.js';

export class ShuinError extends Error {
  constructor(message, {status, code, executed = false, cause} = {}) {
    super(message, {cause});
    this.name = 'ShuinError';
    this.status = status;
    this.code = code;
    this.executed = executed;
  }
}

export class ShuinDeniedError extends ShuinError {
  constructor(reason, decision) {
    super(`Shuin blocked the tool call: ${reason}`, {code: 'DENIED'});
    this.name = 'ShuinDeniedError';
    this.decision = decision;
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Create a guard for one agent.
 *
 *   const guard = createShuin({agentKey: process.env.SHUIN_AGENT_KEY});
 *   await guard.run({action: 'files.read', resource: 'workspace/a.md'}, () => readFile(...));
 */
export function createShuin({
  agentKey, baseUrl = 'http://127.0.0.1:5055', fetchImpl = globalThis.fetch,
  timeoutMs = 5000, approvalTimeoutMs = 10 * 60e3, pollMs = 1500, onApprovalPending,
} = {}) {
  if (!agentKey || typeof agentKey !== 'string') throw new TypeError('agentKey is required');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const url = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new TypeError('baseUrl must use HTTP or HTTPS');

  const request = async (path, body) => {
    let response;
    try {
      response = await fetchImpl(new URL(path, url), {
        method: body === undefined ? 'GET' : 'POST',
        headers: {authorization: `Bearer ${agentKey}`, ...(body === undefined ? {} : {'content-type': 'application/json'})},
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      throw new ShuinError('Shuin is unreachable. The tool was not authorized.', {code: 'UNREACHABLE', cause});
    }
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw new ShuinError(data?.error || `Shuin returned HTTP ${response.status}`, {status: response.status, code: 'API_ERROR'});
    return data;
  };

  const authorize = ({action, resource, amount = 0, note = ''}) => request('/api/authorize', {action, resource, amount, note, waitSeconds: Math.ceil(approvalTimeoutMs / 1000)});
  const report = (eventId, outcome, note = '') => request('/api/receipt', {eventId, outcome, note});
  const policy = () => request('/api/policy');
  const assertion = (audience, ttlSeconds) => request('/api/assertion', {audience, ttlSeconds});

  /** Resolve an `ask` decision: block until the owner approves, denies, or time runs out. */
  async function awaitApproval(authorization) {
    onApprovalPending?.(authorization);
    const deadline = Date.now() + approvalTimeoutMs;
    while (Date.now() < deadline) {
      await sleep(pollMs);
      const status = await request(`/api/authorize/${authorization.eventId}`);
      if (status.status !== 'pending') return status;
    }
    return {status: 'expired', decision: {allowed: false, outcome: 'deny', reason: 'Approval request timed out'}};
  }

  /** Authorize, and if the rule needs a human, wait for the owner's answer. */
  async function check(req) {
    const authorization = await authorize(req);
    if (authorization.decision?.outcome !== 'ask') return authorization;
    const resolved = await awaitApproval(authorization);
    return {...authorization, decision: resolved.decision};
  }

  /** Decide, wait for approval if needed, run the tool, and record the outcome. */
  async function run({action, resource, amount = 0, note = ''}, tool) {
    if (typeof tool !== 'function') throw new TypeError('tool must be a function');
    const authorization = await check({action, resource, amount, note});
    if (!authorization.decision?.allowed) {
      throw new ShuinDeniedError(authorization.decision?.reason || 'No active rule', authorization.decision);
    }
    let result;
    try {
      result = await tool();
    } catch (cause) {
      try { await report(authorization.eventId, 'failure', String(cause?.message || cause).slice(0, 500)); }
      catch (reportError) { if (cause && typeof cause === 'object') cause.receiptError = reportError; }
      throw cause;
    }
    try {
      await report(authorization.eventId, 'success', note);
    } catch (cause) {
      throw new ShuinError('The tool ran, but Shuin could not record its outcome. Do not retry the tool automatically.', {code: 'RECEIPT_FAILED', executed: true, cause});
    }
    return result;
  }

  /** Wrap an existing function so every call is checked first. */
  const wrap = (action, fn, {resource = (...args) => String(args[0] ?? '*'), amount = () => 0} = {}) =>
    (...args) => run({action, resource: resource(...args), amount: amount(...args)}, () => fn(...args));

  return {authorize, check, report, run, wrap, policy, assertion};
}
