import {useEffect, useState} from 'react';
import {Check, X, Clock} from 'lucide-react';
import {api} from '../lib/api.js';
import {Badge} from '../components/ui.jsx';
import {ago} from '../lib/format.js';
import {useConsole} from './ctx.js';

function Countdown({until}) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.round((Date.parse(until) - Date.now()) / 1000));
  return <span className="count"><Clock size={13} /> {s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`} left</span>;
}

export default function Approvals() {
  const {data, refresh, notify} = useConsole();
  const [busy, setBusy] = useState('');
  const pending = data.approvals.filter(a => a.status === 'pending');
  const done = data.approvals.filter(a => a.status !== 'pending').slice(0, 12);

  async function decide(id, approve) {
    setBusy(id);
    try { await api.resolve(id, approve); await refresh(); notify(approve ? 'Approved. The agent can proceed.' : 'Declined.'); }
    catch (e) { notify(e.message); refresh(); } finally { setBusy(''); }
  }
  return (
    <>
      <header className="page-head"><div><p className="eyebrow">Approvals</p><h1>{pending.length ? `${pending.length} waiting on you` : 'Nothing waiting'}</h1></div></header>
      {pending.length === 0 && (
        <section className="empty"><h2>All clear</h2><p>When an agent hits a rule set to <b>Ask me</b>, its request waits here. The agent is blocked until you answer, and the request expires if you don’t.</p></section>
      )}
      <div className="cards">
        {pending.map(a => (
          <article className="ask-card" key={a.id}>
            <div className="ask-top"><Badge tone="ask">Needs approval</Badge><Countdown until={a.expiresAt} /></div>
            <h3>{a.agentName} wants to <code>{a.action}</code></h3>
            <dl>
              <dt>Resource</dt><dd className="mono">{a.resource}</dd>
              {a.amount > 0 && <><dt>Amount</dt><dd className="mono">{a.amount}</dd></>}
              {a.note && <><dt>Agent says</dt><dd>“{a.note}”</dd></>}
              <dt>Asked</dt><dd>{ago(a.createdAt)}</dd>
            </dl>
            <div className="ask-actions">
              <button className="btn good" disabled={busy === a.id} onClick={() => decide(a.id, true)}><Check size={15} /> Approve once</button>
              <button className="btn ghost" disabled={busy === a.id} onClick={() => decide(a.id, false)}><X size={15} /> Decline</button>
            </div>
          </article>
        ))}
      </div>
      {done.length > 0 && (
        <section className="panel flush">
          <div className="panel-head"><h2>Recently decided</h2></div>
          <table className="table"><tbody>
            {done.map(a => (
              <tr key={a.id}>
                <td>{a.agentName}</td><td className="mono">{a.action} {a.resource}</td>
                <td><Badge tone={a.status === 'approved' ? 'allow' : a.status === 'denied' ? 'deny' : ''}>{a.status}</Badge></td>
                <td className="muted">{ago(a.resolvedAt)}</td>
              </tr>
            ))}
          </tbody></table>
        </section>
      )}
    </>
  );
}
