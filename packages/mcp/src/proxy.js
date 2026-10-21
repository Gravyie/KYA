import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {posix, resolve as resolvePath} from 'node:path';
import {createSigilant} from '../../sdk/src/index.js';

const RESOURCE_ARGS = ['path', 'file', 'filepath', 'file_path', 'filename', 'directory', 'dir', 'source', 'destination', 'uri', 'url', 'resource', 'repo', 'repository', 'to', 'recipient', 'table', 'query', 'command', 'name'];
const PATH_ARGS = new Set(['path', 'file', 'filepath', 'file_path', 'filename', 'directory', 'dir', 'source', 'destination']);
const AMOUNT_ARGS = ['amount', 'value', 'total', 'price', 'cost'];

const rpcError = (id, text) => ({jsonrpc: '2.0', id, result: {isError: true, content: [{type: 'text', text}]}});

/** Turn tool arguments into the resource string a policy rule can match. */
export function deriveResource(args = {}, {resourceArg, cwd = process.cwd()} = {}) {
  const keys = resourceArg ? [resourceArg] : RESOURCE_ARGS;
  for (const key of keys) {
    const v = args?.[key];
    if (typeof v !== 'string' || !v) continue;
    if (PATH_ARGS.has(key) && !/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) {
      const resolved = resolvePath(cwd, v);
      return posix.normalize(resolved.split('\\').join('/'));
    }
    return v.length > 280 ? v.slice(0, 280) : v;
  }
  return '*';
}

export function deriveAmount(args = {}) {
  for (const key of AMOUNT_ARGS) {
    const n = Number(args?.[key]);
    if (args?.[key] != null && Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

/**
 * Wrap an MCP server (stdio). Every `tools/call` is authorized first; blocked
 * calls never reach the server. `tools/list` is trimmed to what the agent may
 * use, so a model is not tempted by tools it cannot run.
 */
export function createMcpGuard({command, args = [], agentKey, baseUrl, resourceArg, filterTools = true, approvalTimeoutMs, log = () => {}, input = process.stdin, output = process.stdout, env}) {
  const guard = createSigilant({agentKey, baseUrl, approvalTimeoutMs, onApprovalPending: a => log(`waiting for owner approval (${a.eventId})`)});
  const child = spawn(command, args, {stdio: ['pipe', 'pipe', 'inherit'], env: {...process.env, ...env}});
  const calls = new Map();      // id → {eventId}
  const listIds = new Set();    // ids of in-flight tools/list requests
  const toClient = msg => output.write(JSON.stringify(msg) + '\n');
  const toServer = msg => child.stdin.write(JSON.stringify(msg) + '\n');
  const key = id => JSON.stringify(id);

  async function handleToolCall(msg) {
    const {name, arguments: toolArgs = {}} = msg.params ?? {};
    const resource = deriveResource(toolArgs, {resourceArg});
    if (resource.split('/').includes('..')) return toClient(rpcError(msg.id, 'Blocked by Sigilant: path escapes its directory'));
    try {
      const auth = await guard.check({action: name, resource, amount: deriveAmount(toolArgs), note: `MCP tools/call ${name}`});
      if (!auth.decision.allowed) {
        log(`BLOCK ${name} ${resource}: ${auth.decision.reason}`);
        return toClient(rpcError(msg.id, `Blocked by Sigilant: ${auth.decision.reason}. Do not retry this action; ask the user to change this agent's policy.`));
      }
      log(`ALLOW ${name} ${resource}`);
      calls.set(key(msg.id), {eventId: auth.eventId});
      toServer(msg);
    } catch (error) {
      log(`FAIL-CLOSED ${name}: ${error.message}`);
      toClient(rpcError(msg.id, `Blocked by Sigilant: ${error.message}`));
    }
  }

  async function allowedTools(tools) {
    const {agent} = await guard.policy();
    const rules = agent.scopes.filter(s => s.mode !== 'deny');
    const covers = (pattern, v) => pattern === '*' || (pattern.endsWith('*') ? v.startsWith(pattern.slice(0, -1)) : pattern === v);
    const denyAll = agent.scopes.filter(s => s.mode === 'deny' && s.resources.includes('*'));
    return tools.filter(t => rules.some(r => covers(r.action, t.name)) && !denyAll.some(r => covers(r.action, t.name)));
  }

  createInterface({input}).on('line', line => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { return child.stdin.write(line + '\n'); }
    if (msg.method === 'tools/call' && msg.id !== undefined) handleToolCall(msg);
    else {
      if (msg.method === 'tools/list' && msg.id !== undefined) listIds.add(key(msg.id));
      toServer(msg);
    }
  }).on('close', () => child.stdin.end());

  createInterface({input: child.stdout}).on('line', async line => {
    let msg;
    try { msg = JSON.parse(line); } catch { return output.write(line + '\n'); }
    const k = msg.id !== undefined && msg.method === undefined ? key(msg.id) : null;
    if (k && calls.has(k)) {
      const {eventId} = calls.get(k); calls.delete(k);
      const ok = !msg.error && !msg.result?.isError;
      guard.report(eventId, ok ? 'success' : 'failure', ok ? 'MCP tool completed' : (msg.error?.message ?? 'Tool reported an error')).catch(e => log(`receipt not recorded: ${e.message}`));
    } else if (k && listIds.has(k)) {
      listIds.delete(k);
      if (filterTools && Array.isArray(msg.result?.tools)) {
        try { msg.result.tools = await allowedTools(msg.result.tools); }
        catch (e) { msg.result.tools = []; log(`tools hidden (fail-closed): ${e.message}`); }
      }
    }
    toClient(msg);
  });

  child.on('exit', code => { log(`upstream exited (${code})`); process.exit(code ?? 0); });
  const stop = () => { child.kill(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  return {child, stop};
}
