// Pure policy evaluation. No I/O, so the console playground, the server and
// the tests all share exactly one definition of "allowed".

export const MODES = ['allow', 'ask', 'deny'];
const ACTION_RE = /^[A-Za-z0-9*][A-Za-z0-9_.:*-]{0,79}$/;

export const fail = (status, message) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};

/** `*` matches anything, a trailing `*` matches a prefix, otherwise exact. */
export function matches(pattern, value) {
  if (pattern === '*') return true;
  if (pattern.endsWith('*')) return value.startsWith(pattern.slice(0, -1));
  return pattern === value;
}

export function cleanScopes(scopes) {
  if (!Array.isArray(scopes) || !scopes.length || scopes.length > 40) fail(400, 'Add 1 to 40 rules');
  return scopes.map(raw => {
    const action = String(raw.action ?? '').trim();
    if (!ACTION_RE.test(action)) fail(400, 'Rule action must be a tool name such as files.read, read_file or send_*');
    const resources = Array.isArray(raw.resources) ? raw.resources.map(v => String(v).trim()) : [];
    if (!resources.length || resources.length > 20 || resources.some(v => !v || v.length > 200)) {
      fail(400, 'Each rule needs 1 to 20 resource patterns');
    }
    const mode = raw.mode ?? 'allow';
    if (!MODES.includes(mode)) fail(400, 'Rule mode must be allow, ask or deny');
    const maxAmount = raw.maxAmount == null || raw.maxAmount === '' ? null : Number(raw.maxAmount);
    if (maxAmount !== null && (!Number.isFinite(maxAmount) || maxAmount < 0)) fail(400, 'Maximum amount must be zero or more');
    return {action, resources, mode, maxAmount};
  });
}

export function cleanLimits(raw = {}) {
  const limits = {budget: null, rate: null};
  if (raw.budget && raw.budget.amount !== '' && raw.budget.amount != null) {
    const amount = Number(raw.budget.amount);
    const windowHours = Number(raw.budget.windowHours || 24);
    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(windowHours) || windowHours <= 0 || windowHours > 24 * 90) {
      fail(400, 'Budget needs a nonnegative amount and a window of 1 hour to 90 days');
    }
    limits.budget = {amount, windowHours};
  }
  if (raw.rate && raw.rate.count !== '' && raw.rate.count != null) {
    const count = Math.floor(Number(raw.rate.count));
    const windowMinutes = Number(raw.rate.windowMinutes || 1);
    if (!Number.isFinite(count) || count < 1 || !Number.isFinite(windowMinutes) || windowMinutes <= 0 || windowMinutes > 24 * 60) {
      fail(400, 'Rate limit needs 1 or more calls and a window up to 24 hours');
    }
    limits.rate = {count, windowMinutes};
  }
  return limits;
}

export function parseRequest(request) {
  const action = String(request?.action ?? '');
  const resource = String(request?.resource ?? '');
  const amount = request?.amount == null || request.amount === '' ? 0 : Number(request.amount);
  if (!action || !resource || action.length > 80 || resource.length > 300 || !Number.isFinite(amount) || amount < 0) {
    fail(400, 'Provide action, resource and a nonnegative amount');
  }
  return {action, resource, amount};
}

const decision = (outcome, reason, rule = null) => ({outcome, allowed: outcome === 'allow', reason, rule});

/**
 * @param agent   {revokedAt, expiresAt, scopes, limits}
 * @param request {action, resource, amount}
 * @param usage   {spent, calls} counted by the caller over the agent's windows
 */
export function decide(agent, request, usage = {spent: 0, calls: 0}, at = Date.now()) {
  if (agent.revokedAt) return decision('deny', 'Agent is revoked');
  if (agent.expiresAt && Date.parse(agent.expiresAt) <= at) return decision('deny', 'Agent credential has expired');
  const {action, resource, amount} = parseRequest(request);
  const covers = rule => matches(rule.action, action) && rule.resources.some(r => matches(r, resource));
  const denied = agent.scopes.find(rule => rule.mode === 'deny' && covers(rule));
  if (denied) return decision('deny', `Blocked by a deny rule for ${denied.action} on ${denied.resources.join(', ')}`, denied);
  const hit = agent.scopes.find(rule => rule.mode !== 'deny' && covers(rule) && (rule.maxAmount === null || amount <= rule.maxAmount));
  if (!hit) {
    const near = agent.scopes.filter(rule => rule.mode !== 'deny' && covers(rule));
    return decision('deny', near.length
      ? `Amount ${amount} is over the ${Math.max(...near.map(rule => rule.maxAmount))} limit for this action`
      : 'No rule covers this action and resource (default deny)');
  }
  const {budget, rate} = agent.limits ?? {};
  if (rate && usage.calls >= rate.count) return decision('deny', `Rate limit reached: ${rate.count} calls per ${rate.windowMinutes} min`, hit);
  if (budget && usage.spent + amount > budget.amount) {
    return decision('deny', `Budget exceeded: ${usage.spent} spent of ${budget.amount} in the last ${budget.windowHours}h, this call needs ${amount}`, hit);
  }
  return hit.mode === 'ask'
    ? decision('ask', 'This rule requires owner approval', hit)
    : decision('allow', 'Within an active rule', hit);
}
