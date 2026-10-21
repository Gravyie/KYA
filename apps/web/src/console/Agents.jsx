import {useState} from 'react';
import {Plus, X} from 'lucide-react';
import {api} from '../lib/api.js';
import {Link, navigate} from '../lib/router.jsx';
import {Badge} from '../components/ui.jsx';
import {ago} from '../lib/format.js';
import {useConsole} from './ctx.js';
import RuleEditor from './RuleEditor.jsx';
import KeyReveal from './KeyReveal.jsx';
import {TEMPLATES, toPayload, fromAgent} from './templates.js';

export const statusTone = s => (s === 'active' ? 'allow' : s === 'expired' ? 'ask' : 'deny');

function NewAgent({onClose}) {
  const {refresh, notify} = useConsole();
  const [tpl, setTpl] = useState(TEMPLATES[0]);
  const [draft, setDraft] = useState({scopes: structuredClone(TEMPLATES[0].scopes), limits: structuredClone(TEMPLATES[0].limits)});
  const [name, setName] = useState('');
  const [expires, setExpires] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [issued, setIssued] = useState(null);

  const pick = t => { setTpl(t); setDraft({scopes: structuredClone(t.scopes), limits: structuredClone(t.limits)}); };
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const body = {name: name.trim(), description: tpl.description, ...toPayload(draft)};
      if (expires) body.expiresInHours = Number(expires);
      setIssued(await api.createAgent(body)); refresh();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  if (issued) return <KeyReveal agent={issued.agent} secret={issued.key} onClose={() => { onClose(); navigate(`/app/agents/${issued.agent.id}`); }} />;
  return (
    <div className="modal-back" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <form className="modal wide" onSubmit={submit} role="dialog" aria-modal="true" aria-label="Register an agent">
        <div className="modal-head"><h2>Register an agent</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={17} /></button></div>
        <div className="tpls">
          {TEMPLATES.map(t => (
            <button type="button" key={t.id} className={`tpl ${t.id === tpl.id ? 'on' : ''}`} onClick={() => pick(t)}><b>{t.name}</b><span>{t.blurb}</span></button>
          ))}
        </div>
        <label className="field"><span>Agent name</span>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Claude Code — billing repo" required minLength={2} maxLength={80} autoFocus />
        </label>
        <RuleEditor value={draft} onChange={setDraft} expiry={
          <label className="field"><span>Credential expires</span>
            <div className="inline"><input className="input mono" placeholder="never" inputMode="numeric" value={expires} onChange={e => setExpires(e.target.value)} aria-label="Expiry in hours" /><span className="hint">hours from now</span></div>
          </label>} />
        {error && <p className="error" role="alert">{error}</p>}
        <div className="modal-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy || !name.trim()}>Register agent</button></div>
      </form>
    </div>
  );
}

export default function Agents() {
  const {data} = useConsole();
  const [open, setOpen] = useState(() => new URLSearchParams(location.search).get('new') === '1');
  const close = () => { setOpen(false); if (location.search) history.replaceState(null, '', '/app/agents'); };

  return (
    <>
      <header className="page-head">
        <div><p className="eyebrow">Agents</p><h1>Every agent, its limits, its record.</h1></div>
        <button className="btn" onClick={() => setOpen(true)}><Plus size={16} /> Register an agent</button>
      </header>
      {data.agents.length === 0 ? (
        <section className="empty"><h2>Nothing registered</h2><p>An agent is any program that calls tools: a coding assistant, a research bot, an MCP client. Register it to give it its own key and rules.</p><button className="btn" onClick={() => setOpen(true)}>Register an agent</button></section>
      ) : (
        <section className="panel flush">
          <table className="table">
            <thead><tr><th>Agent</th><th>Status</th><th>Rules</th><th>Allowed</th><th>Blocked</th><th>Last used</th></tr></thead>
            <tbody>
              {data.agents.map(a => (
                <tr key={a.id} className="click" onClick={() => navigate(`/app/agents/${a.id}`)}>
                  <td><Link to={`/app/agents/${a.id}`} className="strong">{a.name}</Link><div className="sub-line">…{a.keyHint}{a.description ? ` · ${a.description}` : ''}</div></td>
                  <td><Badge tone={statusTone(a.status)}>{a.status}</Badge></td>
                  <td>{a.scopes.length}</td><td>{a.stats.allowed}</td><td>{a.stats.denied}</td>
                  <td className="muted">{a.lastUsedAt ? ago(a.lastUsedAt) : 'never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {open && <NewAgent onClose={close} />}
    </>
  );
}
export {fromAgent};
