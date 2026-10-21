export class AuctentError extends Error {
  constructor(message, {status, code, executed = false, cause} = {}) {
    super(message, {cause});
    this.name = 'AuctentError';
    this.status = status;
    this.code = code;
    this.executed = executed;
  }
}

export class AuctentDeniedError extends AuctentError {
  constructor(reason, decision) {
    super(`Auctent denied the tool call: ${reason}`, {code: 'DENIED'});
    this.name = 'AuctentDeniedError';
    this.decision = decision;
  }
}

export function createAuctent({agentKey, baseUrl = 'http://127.0.0.1:5055', fetchImpl = globalThis.fetch, timeoutMs = 5000} = {}) {
  if (!agentKey || typeof agentKey !== 'string') throw new TypeError('agentKey is required');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const url = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new TypeError('baseUrl must use HTTP or HTTPS');
  const request = async (path, body) => {
    let response;
    try {
      response = await fetchImpl(new URL(path, url), {
        method: 'POST',
        headers: {authorization: `Bearer ${agentKey}`, 'content-type': 'application/json'},
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      throw new AuctentError('Auctent is unreachable. The tool was not authorized.', {code: 'UNREACHABLE', cause});
    }
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      throw new AuctentError(data?.error || `Auctent returned HTTP ${response.status}`, {status: response.status, code: 'API_ERROR'});
    }
    return data;
  };
  const authorize = ({action, resource, amount = 0}) => request('/api/authorize', {action, resource, amount});
  const report = (eventId, outcome, note = '') => request('/api/receipt', {eventId, outcome, note});
  const run = async ({action, resource, amount = 0, note = ''}, tool) => {
    if (typeof tool !== 'function') throw new TypeError('tool must be a function');
    const authorization = await authorize({action, resource, amount});
    if (!authorization.decision?.allowed) {
      throw new AuctentDeniedError(authorization.decision?.reason || 'No active scope', authorization.decision);
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
      throw new AuctentError('The tool ran, but Auctent could not record its outcome. Do not retry the tool automatically.', {code: 'RECEIPT_FAILED', executed: true, cause});
    }
    return result;
  };
  return {authorize, report, run};
}
