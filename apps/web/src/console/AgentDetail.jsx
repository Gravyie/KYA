import {useEffect, useMemo, useState} from 'react';
import {ArrowLeft, RotateCw, Ban, ShieldCheck} from 'lucide-react';
import {api} from '../lib/api.js';
import {Link} from '../lib/router.jsx';
import {Badge, outcomeTone, Code, CopyButton} from '../components/ui.jsx';
import {dateTime} from '../lib/format.js';
import {useConsole} from './ctx.js';
import RuleEditor from './RuleEditor.jsx';
import KeyReveal from './KeyReveal.jsx';
import {EventRow} from './Overview.jsx';
import {fromAgent, toPayload} from './templates.js';
import Onchain from './Onchain.jsx';

const statusTone = s => (s === 'active' ? 'allow' : s === 'expired' ? 'ask' : 'deny');

function Simulator({agent}) {
  const [req, setReq] = useState({action: agent.scopes[0]?.action ?? '', resource: '', amount: ''});
  const [out, setOut] = useState(null);
  const [error, setError] = useState('');
  async function run(e) {
    e.preventDefault(); setError('');
    try { setOut(await api.simulate(agent.id, {action: req.action.trim(), resource: req.resource.trim(), amount: req.amount || 0})); }
    catch (err) { setError(err.message); setOut(null); }
  }
  const d = out?.decision;
  return (
    <section className="panel">
      <div className="panel-head"><h2>Test a request</h2><span className="hint">Dry run against the saved policy. Nothing is logged.</span></div>
      <form className="sim" onSubmit={run}>
        <input className="input mono" placeholder="action" aria-label="Action" value={req.action} onChange={e => setReq({...req, action: e.target.value})} required />
        <input className="input mono" placeholder="resource" aria-label="Resource" value={req.resource} onChange={e => setReq({...req, resource: e.target.value})} required />
        <input className="input mono" placeholder="amount" aria-label="Amount" inputMode="decimal" value={req.amount} onChange={e => setReq({...req, amount: e.target.value})} />
        <button className="btn">Test</button>
      </form>
      {error && <p className="error">{error}</p>}
      {d && <div className={`verdict ${d.outcome}`}><span className="verdict-word">{d.outcome === 'allow' ? 'Allowed' : d.outcome === 'ask' ? 'Needs approval' : 'Blocked'}</span><p>{d.reason}</p></div>}
    </section>
  );
}

function Identity({agent}) {
  const {data} = useConsole();
  const [card, setCard] = useState(null);
  useEffect(() => { api.card(agent.id).then(setCard).catch(() => {}); }, [agent.id, agent.status, agent.scopes]);
  const url = `${location.origin}/api/agents/${agent.id}/card`;
  return (
    <section className="panel">
      <div className="panel-head"><h2>Identity</h2><Badge tone={statusTone(agent.status)}>{agent.status}</Badge></div>
      <dl className="facts-grid">
        <dt>Agent ID</dt><dd className="mono">{agent.id}</dd>
        <dt>Accountable operator</dt><dd>{data.owner}</dd>
        <dt>Registered</dt><dd>{dateTime(agent.createdAt)}</dd>
        <dt>Credential expires</dt><dd>{agent.expiresAt ? dateTime(agent.expiresAt) : 'never'}</dd>
        <dt>Key</dt><dd className="mono">sa_…{agent.keyHint}</dd>
        <dt>Registry fingerprint</dt><dd className="mono wrap-all">{data.registry.fingerprint}</dd>
        <dt>Signed card</dt><dd className="mono wrap-all"><a href={url} target="_blank" rel="noreferrer">{url}</a> <CopyButton text={url} /></dd>
      </dl>
      {card && <details><summary>View signed card</summary><Code title="Ed25519 signature included" plain>{JSON.stringify(card, null, 2)}</Code></details>}
    </section>
  );
}

export default function AgentDetail({id}) {
  const {data, refresh, notify} = useConsole();
  const agent = data.agents.find(a => a.id === id);
  const [tab, setTab] = useState('policy');
  const [draft, setDraft] = useState(() => (agent ? fromAgent(agent) : null));
  const [extend, setExtend] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [secret, setSecret] = useState(null);
  const [confirm, setConfirm] = useState(false);

  const saved = useMemo(() => (agent ? JSON.stringify(fromAgent(agent)) : ''), [agent]);
  useEffect(() => { if (agent) setDraft(fromAgent(agent)); }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!agent) return <section className="empty"><h2>Agent not found</h2><Link to="/app/agents" className="btn">Back to agents</Link></section>;
  const dirty = JSON.stringify(draft) !== saved || extend !== '';
  const mine = data.events.filter(e => e.agentId === id).slice(0, 40);
  const revoked = agent.status === 'revoked';

  async function save() {
    setBusy(true); setError('');
    try {
      const body = toPayload(draft);
      if (extend !== '') body.expiresInHours = Number(extend);
      await api.updatePolicy(id, body); setExtend(''); await refresh(); notify('Policy saved');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function rotate() { try { const r = await api.rotate(id); setSecret(r.key); refresh(); } catch (e) { notify(e.message); } }
  async function revoke() { try { await api.revoke(id); setConfirm(false); await refresh(); notify(`${agent.name} revoked`); } catch (e) { notify(e.message); } }

  return (
    <>
      <Link to="/app/agents" className="back"><ArrowLeft size={14} /> Agents</Link>
      <header className="page-head">
        <div><p className="eyebrow">Agent</p><h1>{agent.name}</h1>{agent.description && <p className="muted">{agent.description}</p>}</div>
        {!revoked && (
          <div className="actions">
            <button className="btn ghost" onClick={rotate}><RotateCw size={15} /> Rotate key</button>
            <button className="btn danger" onClick={() => setConfirm(true)}><Ban size={15} /> Revoke</button>
          </div>
        )}
      </header>

      <div className="tabs" role="tablist">
        {[['policy', 'Policy'], ['activity', `Activity (${mine.length})`], ['identity', 'Identity']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'policy' && (
        <>
          <section className="panel">
            {revoked && <p className="error">This agent is revoked. Its policy is read-only and every call is denied.</p>}
            <fieldset disabled={revoked} className="bare">
              <RuleEditor value={draft} onChange={setDraft} expiry={
                <label className="field"><span>Extend credential</span>
                  <div className="inline"><input className="input mono" placeholder={agent.expiresAt ? 'keep as is' : 'never'} inputMode="numeric" value={extend} onChange={e => setExtend(e.target.value)} aria-label="Expiry in hours from now" /><span className="hint">hours from now</span></div>
                </label>} />
            </fieldset>
            {error && <p className="error" role="alert">{error}</p>}
            {!revoked && <div className="savebar"><span className="hint">{dirty ? 'Unsaved changes' : 'Saved. Enforced immediately.'}</span><button className="btn" disabled={!dirty || busy} onClick={save}>Save policy</button></div>}
          </section>
          {!revoked && <Simulator agent={agent} key={saved} />}
        </>
      )}

      {tab === 'activity' && (
        <section className="panel">
          {mine.length ? <ul className="events">{mine.map(e => <EventRow key={e.id} e={e} agents={data.agents} />)}</ul> : <p className="muted pad">No activity yet. Calls appear here the moment the agent asks.</p>}
        </section>
      )}

      {tab === 'identity' && <><Identity agent={agent} /><Onchain agent={agent} /></>}

      {secret && <KeyReveal agent={agent} secret={secret} rotated onClose={() => setSecret(null)} />}
      {confirm && (
        <div className="modal-back" onMouseDown={e => e.target === e.currentTarget && setConfirm(false)}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-label="Revoke agent">
            <h2>Revoke {agent.name}?</h2>
            <p className="muted">Its next call is denied, pending approvals are cancelled, and every service checking its status stops trusting it. This can’t be undone. Register a new agent to restore access.</p>
            <div className="modal-foot"><button className="btn ghost" onClick={() => setConfirm(false)}>Cancel</button><button className="btn danger" onClick={revoke}>Revoke now</button></div>
          </div>
        </div>
      )}
    </>
  );
}
export {ShieldCheck, outcomeTone};
