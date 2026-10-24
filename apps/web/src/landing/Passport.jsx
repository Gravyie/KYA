import {useEffect, useRef, useState} from 'react';
import {ExternalLink, Search} from 'lucide-react';
import {api} from '../lib/api.js';
import {Badge, Code} from '../components/ui.jsx';
import {CHAINS} from '../../../../packages/sdk/src/erc8004.js';

const FILE = `{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "workspace-agent",
  "description": "workspace-agent: an AI agent operated by Acme Inc. …",
  "services": [
    { "name": "mihari-card",   "endpoint": "https://reg.acme.co/api/agents/8f3a…/card" },
    { "name": "mihari-status", "endpoint": "https://reg.acme.co/api/agents/8f3a…/status" }
  ],
  "x402Support": false,
  "active": true,
  "registrations": [
    { "agentId": 10353, "agentRegistry": "eip155:84532:0x8004A818…BD9e" }
  ],
  "mihari": { "agentId": "8f3a…", "operator": "Acme Inc.", "actions": ["read_file", "web.search"] }
}`;

const ASSERTION = `// POST /api/assertion  { "audience": "https://api.partner.com" }
{
  "iss": "mihari:91c277de0b4e1a3c",
  "sub": "8f3a…",                       // the agent
  "name": "workspace-agent",
  "operator": "Acme Inc.",              // the accountable human
  "aud": "https://api.partner.com",
  "exp": 1792600560,                    // minutes, not days
  "scp": ["read_file", "web.search"],
  "erc8004": { "agentRegistry": "eip155:84532:0x8004A818…BD9e", "agentId": "10353" }
}
// signed EdDSA (Ed25519) · verified offline · revocation checked live`;

const TABS = [['lookup', 'Live lookup'], ['file', 'Registration file'], ['assertion', 'Assertion']];
const short = a => `${a.slice(0, 6)}…${a.slice(-4)}`;

function Lookup() {
  const [chainId, setChainId] = useState(84532);
  const [agentId, setAgentId] = useState('1');
  const [state, setState] = useState({status: 'idle'});
  const ran = useRef(false);
  const rootRef = useRef(null);

  async function run(e) {
    e?.preventDefault();
    setState({status: 'loading'});
    try { setState({status: 'ok', data: await api.lookup(chainId, agentId.trim())}); }
    catch (err) { setState({status: 'error', message: err.status === 404 ? `No agent #${agentId} on ${CHAINS[chainId].name}.` : err.message}); }
  }
  useEffect(() => {
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting && !ran.current) { ran.current = true; run(); } }, {threshold: 0.4});
    io.observe(rootRef.current);
    return () => io.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const d = state.data;
  return (
    <div className="lookup" ref={rootRef}>
      <form onSubmit={run} className="lookup-form">
        <select className="input" aria-label="Network" value={chainId} onChange={e => setChainId(Number(e.target.value))}>
          {Object.values(CHAINS).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className="input mono" aria-label="Agent ID" inputMode="numeric" value={agentId} onChange={e => setAgentId(e.target.value)} placeholder="agent id" />
        <button className="btn sm" disabled={!agentId.trim() || state.status === 'loading'}><Search size={14} /> {state.status === 'loading' ? 'Reading chain…' : 'Look up'}</button>
      </form>
      <div className="lookup-out" aria-live="polite">
        {state.status === 'error' && <p className="lookup-err">{state.message}</p>}
        {state.status === 'loading' && <p className="muted">Reading the registry over public RPC…</p>}
        {d && (
          <article className="id-card">
            <div className="id-top"><Badge tone="allow">Registered on-chain</Badge><span className="mono">{d.chain.name} · #{d.agentId}</span></div>
            <h4>{d.registration?.name || 'Unnamed agent'}</h4>
            {d.registration?.description && <p>{d.registration.description}</p>}
            <dl>
              <dt>Owner</dt><dd className="mono">{short(d.owner)}</dd>
              <dt>File</dt><dd>{d.uriKind === 'data' ? 'Embedded in the token (data: URI)' : `${d.uriKind.toUpperCase()} URI`}</dd>
              {d.registration?.services?.length > 0 && <><dt>Services</dt><dd>{d.registration.services.map(s => s.name).join(', ')}</dd></>}
              <dt>Wardrail</dt><dd>{d.registration?.mihari ? 'Issued by a Wardrail registry' : 'Not a Wardrail agent'}</dd>
            </dl>
            <a className="ext" href={`${d.chain.explorer}/token/${d.chain.registry}?a=${d.agentId}`} target="_blank" rel="noreferrer">Open on the explorer <ExternalLink size={13} /></a>
          </article>
        )}
      </div>
    </div>
  );
}

export default function Passport() {
  const [tab, setTab] = useState('lookup');
  return (
    <div className="inspector tilt">
      <div className="insp-tabs" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      <div className="insp-body">
        {tab === 'lookup' && <Lookup />}
        {tab === 'file' && <Code title="registration.json · ERC-8004 registration-v1">{FILE}</Code>}
        {tab === 'assertion' && <Code title="assertion claims (decoded)">{ASSERTION}</Code>}
      </div>
    </div>
  );
}
