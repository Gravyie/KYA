import {useState} from 'react';
import {Code, CopyButton} from '../components/ui.jsx';
import {Link} from '../lib/router.jsx';
import {useConsole} from './ctx.js';
import {tabKeys} from '../lib/useDialog.js';

export default function Connect() {
  const {data} = useConsole();
  const [tab, setTab] = useState('mcp');
  const url = location.origin;
  const {mcp, sdk, examples} = data.paths;

  const tabs = {
    mcp: ['MCP firewall', `{
  "mcpServers": {
    "filesystem": {
      "command": "node",
      "args": ["${mcp}", "--",
               "npx", "@modelcontextprotocol/server-filesystem", "/path/to/project"],
      "env": { "MIHARI_AGENT_KEY": "mia_…", "MIHARI_URL": "${url}" }
    }
  }
}`, 'Paste into Claude Desktop, Cursor or any MCP client config. Tool names become rule actions (read_file, write_file…); the first path, url or query argument becomes the resource. Tools the agent has no rule for are hidden from it. If the agent runs on another machine, replace the wrapper path with its local checkout path.'],
    sdk: ['Node SDK', `# in your agent's project
npm install ${sdk}

import { createMihari } from '@mihari/sdk';
const guard = createMihari({ agentKey: process.env.MIHARI_AGENT_KEY, baseUrl: '${url}' });

await guard.run(
  { action: 'files.read', resource: 'workspace/report.md', note: 'why the agent wants it' },
  () => readFile('report.md', 'utf8'),
);`, 'Use the SDK example template for these action names. Fails closed if Wardrail is unreachable. “Ask me” rules block until you decide in Approvals.'],
    rest: ['REST', `curl -s ${url}/api/authorize \\
  -H "authorization: Bearer $MIHARI_AGENT_KEY" -H "content-type: application/json" \\
  -d '{"action":"payments.send","resource":"acme-corp","amount":240,"note":"March invoice"}'

# outcome is "allow", "ask" or "deny"
# if "ask": GET ${url}/api/authorize/<eventId> until status ≠ pending
# then:  POST ${url}/api/receipt  {"eventId":"…","outcome":"success"}`, 'Any language works. Every authorize call is one audit event.'],
    example: ['Try an example', `# 1. register an agent from the “SDK example” template, copy its key
# 2. run a scripted agent that tries allowed, denied and approval-gated calls:
MIHARI_AGENT_KEY=mia_… MIHARI_URL=${url} node ${examples}/research-agent.mjs

# For MCP instead, register a Coding agent and edit its resource paths.
# Then wrap the bundled demo server with that agent’s key:
MIHARI_AGENT_KEY=mia_… MIHARI_URL=${url} node ${mcp} -- node ${examples}/demo-mcp-server.mjs`, 'The research agent pauses on the write: approve it under Approvals and watch it continue.'],
    verify: ['Prove identity', `# the agent mints a short-lived assertion for one audience
import { createMihari } from '@mihari/sdk';
const guard = createMihari({ agentKey: process.env.MIHARI_AGENT_KEY, baseUrl: '${url}' });
const { token } = await guard.assertion('https://api.partner.com');

# the partner verifies it (offline) and checks revocation
node ${examples}/relying-party.mjs      # a runnable example of the receiving side

# or paste a token into ${url}/verify`, 'Assertions are Ed25519-signed, expire in minutes, and name the accountable operator.'],
  };
  const [, code, note] = tabs[tab];

  return (
    <>
      <header className="page-head"><div><p className="eyebrow">Connect</p><h1>Put an agent behind the gate.</h1></div></header>
      <section className="panel">
        <div className="steps-row">
          <div><b>1</b><span>Register an agent and set its policy</span><Link to="/app/agents?new=1" className="muted">Register →</Link></div>
          <div><b>2</b><span>Give it its key (shown once at registration)</span></div>
          <div><b>3</b><span>Wire it in with MCP, the SDK or REST</span></div>
        </div>
      </section>
      <section className="panel">
        <div className="tabs" role="tablist" aria-label="Integration method" onKeyDown={tabKeys}>
          {Object.entries(tabs).map(([k, [label]]) => <button key={k} id={`connect-tab-${k}`} role="tab" aria-controls="connect-panel" tabIndex={tab === k ? 0 : -1} aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>)}
        </div>
        <div id="connect-panel" role="tabpanel" aria-labelledby={`connect-tab-${tab}`}><p className="muted pad-b">{note}</p>
        <Code title={tabs[tab][0]} plain>{code}</Code></div>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Registry</h2></div>
        <dl className="facts-grid">
          <dt>URL</dt><dd className="mono">{url} <CopyButton text={url} /></dd>
          <dt>Issuer</dt><dd className="mono">{data.registry.issuer}</dd>
          <dt>Fingerprint</dt><dd className="mono wrap-all">{data.registry.fingerprint} <CopyButton text={data.registry.fingerprint} /></dd>
        </dl>
        <p className="hint">Partners should pin this fingerprint through a channel they trust, then verify agents against it.</p>
        {data.agents.length > 0 && <p className="hint">Registered agents: {data.agents.map(a => a.name).join(', ')}.</p>}
      </section>
    </>
  );
}
