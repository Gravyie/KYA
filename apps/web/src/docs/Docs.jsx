import {useEffect, useState} from 'react';
import {Logo, Code} from '../components/ui.jsx';
import {Link} from '../lib/router.jsx';
import '../styles/docs.css';

const API = [
  ['POST', '/api/setup', 'First run', 'Create the owner; returns the owner key once'],
  ['GET', '/api/dashboard', 'Owner', 'Agents, approvals and recent events'],
  ['POST', '/api/agents', 'Owner', 'Register an agent: {name, scopes, limits, expiresInHours}. Returns the agent key once'],
  ['PUT', '/api/agents/:id/policy', 'Owner', 'Replace rules, limits or expiry'],
  ['POST', '/api/agents/:id/simulate', 'Owner', 'Dry-run a request against the saved policy'],
  ['POST', '/api/agents/:id/rotate', 'Owner', 'Replace the agent key'],
  ['POST', '/api/agents/:id/revoke', 'Owner', 'Revoke now; cancels pending approvals'],
  ['POST', '/api/approvals/:id/resolve', 'Owner', '{approve: boolean, note?}'],
  ['GET', '/api/audit/verify', 'Owner', 'Recompute the whole hash chain'],
  ['GET', '/api/audit/export', 'Owner', 'Every event, head hash and a signed head'],
  ['POST', '/api/authorize', 'Agent', '{action, resource, amount?, note?} → {decision:{outcome,allowed,reason}, eventId}'],
  ['GET', '/api/authorize/:eventId', 'Agent', 'Poll an “ask” decision until status ≠ pending'],
  ['POST', '/api/receipt', 'Agent', '{eventId, outcome: success|failure, note?}; once per allowed decision'],
  ['GET', '/api/policy', 'Agent', 'The agent’s own rules, limits and current usage'],
  ['POST', '/api/assertion', 'Agent', '{audience, ttlSeconds?} → short-lived signed identity token'],
  ['GET', '/api/agents/:id/erc8004', 'Owner', 'Passport as an ERC-8004 registration file plus a self-contained agentURI'],
  ['POST', '/api/agents/:id/onchain', 'Owner', '{chainId, agentId, owner?}: verify the on-chain agent and link it'],
  ['GET', '/api/agents/:id/registration.json', 'Public', 'The ERC-8004 registration file'],
  ['GET', '/api/chain/lookup', 'Public', '?chainId=&agentId=: read an ERC-8004 agent from its registry'],
  ['GET', '/api/registry', 'Public', 'Registry public key (Ed25519) and fingerprint'],
  ['GET', '/api/agents/:id/card', 'Public', 'Signed identity card'],
  ['GET', '/api/agents/:id/status', 'Public', 'Active, revoked or expired'],
  ['POST', '/api/verify', 'Public', '{token, audience?}: verify an assertion and check revocation'],
  ['POST', '/api/preview', 'Public', 'Evaluate an inline policy; nothing persists'],
];

const SECTIONS = [
  ['quickstart', 'Quickstart'], ['concepts', 'Concepts'], ['policy', 'Policy reference'], ['mcp', 'MCP firewall'],
  ['sdk', 'Node SDK'], ['rest', 'REST API'], ['erc8004', 'On-chain identity'], ['assertions', 'Proving identity'], ['audit', 'Audit & verification'], ['security', 'Security model'],
];

export default function Docs() {
  const [active, setActive] = useState('quickstart');
  useEffect(() => {
    document.title = 'Docs — Mihari';
    const els = SECTIONS.map(([id]) => document.getElementById(id));
    const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && setActive(e.target.id)), {rootMargin: '-20% 0px -70% 0px'});
    els.forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="docs">
      <header className="docs-top"><div className="wrap docs-top-in"><Logo /><nav><Link to="/">Home</Link><Link to="/verify">Verify</Link><Link to="/app" className="btn sm">Console</Link></nav></div></header>
      <div className="wrap docs-body">
        <aside className="toc"><p className="eyebrow">Documentation</p>{SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} className={active === id ? 'on' : ''}>{label}</a>)}<a href="/llms.txt">llms.txt ↗</a></aside>
        <article className="prose">
          <section id="quickstart">
            <h1>Quickstart</h1>
            <p>Mihari is one Node process and one folder. No database, account or API key from anyone else. You need Node 20.12 or newer.</p>
            <h3>1. Run it</h3>
            <Code title="terminal" plain>{`git clone https://github.com/mihari-dev/mihari && cd mihari
npm --prefix apps/web install
npm run build
npm start          # http://127.0.0.1:5055`}</Code>
            <p>For development with hot reload use <code>npm run dev</code> (console on :5173, API on :5055). Data lives in <code>.data/mihari/</code>.</p>
            <h3>2. Create your registry</h3>
            <p>Open the console and enter your name or organisation. You get an <b>owner key</b> once. This is the only key that can change policy, so store it in a password manager.</p>
            <h3>3. Register an agent</h3>
            <p>Pick a template (coding, spending, support or blank) and adjust the rules. You get an <b>agent key</b> once. Each agent has its own key, so every audit line says exactly who acted.</p>
            <h3>4. Put it in front of your tools</h3>
            <Code title="any MCP client config" plain>{`"command": "node",
"args": ["/path/to/mihari/packages/mcp/bin/mihari-mcp.js", "--",
         "npx", "@modelcontextprotocol/server-filesystem", "/path/to/project"],
"env": {"MIHARI_AGENT_KEY": "sga_…"}`}</Code>
            <p>Or use the <a href="#sdk">SDK</a> or <a href="#rest">REST</a> from your own agent code. Try the bundled <code>examples/research-agent.mjs</code> to watch an allowed call, a blocked call and an approval-gated call.</p>
            <p className="note">Packages are not on npm yet. Install the SDK from the folder: <code>npm install /path/to/mihari/packages/sdk</code>.</p>
          </section>

          <section id="concepts">
            <h2>Concepts</h2>
            <dl className="defs">
              <dt>Registry</dt><dd>The Mihari server. It holds agents, rules and the audit log, and signs identity cards with its own Ed25519 key.</dd>
              <dt>Owner</dt><dd>The accountable human or organisation. Named on every identity card and assertion.</dd>
              <dt>Agent</dt><dd>Anything that calls tools. Has an ID, a key, rules, optional limits and an optional expiry.</dd>
              <dt>Rule</dt><dd>An <b>action</b> (a tool name), <b>resource</b> patterns (what it touches), a <b>mode</b> (allow, ask or deny) and an optional <b>max amount</b>.</dd>
              <dt>Decision</dt><dd>For each tool call: <code>allow</code>, <code>ask</code> (wait for the owner) or <code>deny</code>.</dd>
              <dt>Receipt</dt><dd>The agent’s report of what happened after an allowed call. Agent-reported, so treat it as a claim, not proof.</dd>
              <dt>Assertion</dt><dd>A short-lived signed token an agent shows a third party to prove who it is and who answers for it.</dd>
            </dl>
          </section>

          <section id="policy">
            <h2>Policy reference</h2>
            <p>Matching is deliberately small. A pattern is <code>*</code> (anything), a string ending in <code>*</code> (prefix), or an exact string. It applies to both actions (<code>files.*</code>) and resources (<code>repo/src/*</code>).</p>
            <ol>
              <li>If the agent is revoked or expired: deny.</li>
              <li>If a <b>deny</b> rule matches action and resource: deny. Deny always wins.</li>
              <li>The first <b>allow</b> or <b>ask</b> rule that matches and whose max amount covers the request applies.</li>
              <li>Nothing matched: deny (default deny).</li>
              <li>Then limits: a <b>rate limit</b> (calls per window) and a <b>budget</b> (sum of amounts per window, counted from allowed and approved calls). Either one turns an allow or ask into a deny.</li>
            </ol>
            <Code title="example rules" plain>{`allow  read_file     /work/repo/*
deny   read_file     /work/repo/.env*
allow  payments.send *            max 100
ask    payments.send *            max 500
budget 500 per 24h · rate 30 calls per 1 min`}</Code>
          </section>

          <section id="mcp">
            <h2>MCP firewall</h2>
            <p><code>mihari-mcp</code> wraps any stdio MCP server. The client talks to Mihari; Mihari talks to the real server.</p>
            <Code title="usage" plain>{`mihari-mcp [--url http://127.0.0.1:5055] [--key sga_…] [--resource-arg path] [--no-filter] -- <server command…>`}</Code>
            <ul>
              <li><b>Action</b> is the MCP tool name.</li>
              <li><b>Resource</b> is the first string argument among <code>path, file, filepath, url, uri, resource, repo, to, recipient, table, query, command, name</code>, or the argument you name with <code>--resource-arg</code>. Path-like arguments are resolved to absolute paths and a <code>..</code> escape is blocked before any policy is consulted.</li>
              <li><b>Amount</b> is the first numeric argument among <code>amount, value, total, price, cost</code>.</li>
              <li><code>tools/list</code> is trimmed to tools the agent has an allow or ask rule for.</li>
              <li>A blocked call returns a normal MCP tool result with <code>isError: true</code> and a plain explanation, so the model can tell the user instead of crashing.</li>
              <li>If Mihari is unreachable the call is blocked. After an allowed call the proxy records success or failure as the receipt.</li>
            </ul>
          </section>

          <section id="sdk">
            <h2>Node SDK</h2>
            <Code title="agent.mjs">{`import { createMihari, MihariDeniedError } from '@mihari/sdk';

const guard = createMihari({
  agentKey: process.env.MIHARI_AGENT_KEY,
  baseUrl: 'http://127.0.0.1:5055',
  approvalTimeoutMs: 10 * 60_000,       // how long an "ask" may wait
  onApprovalPending: (a) => console.log('waiting for a human', a.eventId),
});

try {
  const text = await guard.run(
    { action: 'files.read', resource: 'workspace/report.md', note: 'weekly summary' },
    () => readFile('report.md', 'utf8'),
  );
} catch (e) {
  if (e instanceof MihariDeniedError) console.log(e.decision.reason);
  else throw e;
}`}</Code>
            <dl className="defs">
              <dt>run(spec, tool)</dt><dd>Authorize, wait for approval if needed, run <code>tool</code>, record the outcome. Throws <code>MihariDeniedError</code> on deny. If the tool ran but the receipt failed it throws with <code>executed: true</code> so you don’t blindly retry.</dd>
              <dt>check(spec)</dt><dd>Authorize (and wait on “ask”) without running anything.</dd>
              <dt>wrap(action, fn, {'{resource, amount}'})</dt><dd>Return a guarded version of an existing function.</dd>
              <dt>assertion(audience)</dt><dd>Mint an identity assertion for a third party.</dd>
              <dt>policy()</dt><dd>The agent’s own rules and how much budget it has used.</dd>
            </dl>
          </section>

          <section id="rest">
            <h2>REST API</h2>
            <p>JSON over HTTP. Owner and agent endpoints take <code>Authorization: Bearer &lt;key&gt;</code>. Public endpoints allow cross-origin reads so partners can verify from a browser.</p>
            <div className="api-table">
              {API.map(([m, p, who, d]) => <div key={m + p} className="api-row"><span className={`m ${m}`}>{m}</span><code>{p}</code><span className="who">{who}</span><span className="d">{d}</span></div>)}
            </div>
          </section>

          <section id="erc8004">
            <h2>On-chain identity (ERC-8004)</h2>
            <p><a href="https://eips.ethereum.org/EIPS/eip-8004" target="_blank" rel="noreferrer">ERC-8004</a> defines a public Identity Registry (an ERC-721) where each agent is a token whose <code>agentURI</code> points at a registration file. Mihari generates that file for every agent and can publish it for you.</p>
            <ul>
              <li><b>The passport.</b> <code>GET /api/agents/:id/registration.json</code> returns an ERC-8004 <code>registration-v1</code> file: name, description, service endpoints (the signed card and status), <code>registrations</code> once published, and a <code>mihari</code> block binding it to your registry.</li>
              <li><b>Nothing to host.</b> The console builds the file into a <code>data:application/json;base64,…</code> URI and calls <code>register(agentURI)</code> on the registry. The file lives in the token itself.</li>
              <li><b>One click with a wallet.</b> Agents &rarr; Identity &rarr; <i>Register with wallet</i> switches your wallet to the chosen network, sends the transaction, reads the minted <code>agentId</code> from the <code>Registered</code> event, and links it. Without a wallet, use the <code>cast</code> command shown there, then link by ID.</li>
              <li><b>Linking verifies.</b> Mihari reads <code>ownerOf</code> and <code>tokenURI</code> from the chain and refuses unless the agent exists, the wallet owns it, and the on-chain file does not name a different Mihari agent.</li>
              <li><b>Assertions carry it.</b> Linked agents add an <code>erc8004: {'{agentRegistry, agentId}'}</code> claim. <code>/api/verify</code> and <Link to="/verify">/verify</Link> re-read the chain and flag it if ownership moved.</li>
            </ul>
            <Code title="registries (Identity Registry)" plain>{`Base Sepolia      eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e   free testnet gas
Ethereum Sepolia  eip155:11155111:0x8004A818BFB912233c491871b3d84c89A494BD9e free testnet gas
Base              eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432     real funds`}</Code>
            <p>Reads use public RPCs, and you can point any chain at your own with <code>MIHARI_RPC_&lt;chainId&gt;</code>. Set <code>MIHARI_PUBLIC_URL</code> when you expose your registry so the service endpoints in the file are reachable.</p>
            <p className="note">What this is not: ERC-8004 identity says an agent exists and who owns it; it does not prove the agent is safe. Mihari’s policy and audit log are what govern its actions. The Reputation and Validation registries are not wired in yet.</p>
          </section>

          <section id="assertions">
            <h2>Proving identity to a third party</h2>
            <p>An agent asks Mihari for an assertion naming the service it is about to call. The result is an Ed25519-signed token (a compact JWT, <code>alg: EdDSA</code>) containing the agent ID and name, the accountable operator, the audience, granted actions, and an expiry of at most 15 minutes.</p>
            <Code title="receiving side">{`import { verifyAssertion, checkStatus } from '@mihari/sdk';

const check = verifyAssertion(token, { publicKey: PINNED_KEY, audience: 'https://api.you.com' });
if (!check.valid) return reject(check.reason);
const { active } = await checkStatus(REGISTRY_URL, check.claims.sub);   // revocation
if (!active) return reject('revoked');`}</Code>
            <p><b>Pin the registry’s fingerprint</b> through a channel you trust (shown in the console under Connect). Without pinning you only know the token matches whatever key the server claims. A runnable example is <code>examples/relying-party.mjs</code>, and <Link to="/verify">/verify</Link> checks a token in your browser.</p>
          </section>

          <section id="audit">
            <h2>Audit &amp; verification</h2>
            <p>Each event records its sequence number, time, agent, kind, details and the previous event’s hash; its own hash is SHA-256 of that JSON. Change any past event and every later hash stops matching. Exports also carry an Ed25519 signature over the head.</p>
            <Code title="verify an export anywhere">{`import { verifyAuditExport } from '@mihari/sdk/verify';

const file = JSON.parse(await readFile('mihari-audit.json', 'utf8'));
const result = verifyAuditExport(file, { pinnedFingerprint: PINNED });
// → { valid: true, count: 1284, head: '…', headSigned: true }`}</Code>
            <p className="note">This detects edits relative to a head you have seen. Someone with full write access to the host could rewrite the log and its head together, so keep periodic exports somewhere else.</p>
          </section>

          <section id="security">
            <h2>Security model</h2>
            <ul>
              <li><b>Mihari decides and records. It cannot stop a tool that bypasses it.</b> Enforce at the tool boundary: the MCP wrapper or an SDK guard in front of every dangerous function.</li>
              <li>Owner and agent keys are random 256-bit values. Only SHA-256 hashes are stored. Keys are shown once.</li>
              <li>The server listens on <code>127.0.0.1</code> by default. To expose it, set <code>MIHARI_HOST</code> and put TLS and access control in front.</li>
              <li>Lost owner key: run <code>npm run owner:recover</code> on the host. It needs the local <code>recovery.key</code> file and a loopback connection, rotates the owner key, and is itself audited.</li>
              <li>Back up <code>.data/mihari/</code> (state, events, recovery key). Run one process per data directory.</li>
              <li>Receipts are reported by the agent. They show what it says it did, not independent proof.</li>
            </ul>
          </section>
        </article>
      </div>
    </div>
  );
}
