import {useEffect, useState} from 'react';
import {ArrowRight, CheckCircle2, AlertTriangle} from 'lucide-react';
import {Link} from '../lib/router.jsx';
import {Badge} from '../components/ui.jsx';
import {api} from '../lib/api.js';
import {describeEvent} from '../lib/events.js';
import {ago} from '../lib/format.js';
import {useConsole} from './ctx.js';

export function EventRow({e, agents}) {
  const d = describeEvent(e, agents);
  return (
    <li className="ev">
      <Badge tone={d.tone}>{d.label}</Badge>
      <div className="ev-main"><b>{d.who}</b> <code>{d.text}</code>{d.note && <span className="ev-note">{d.note}</span>}</div>
      <time dateTime={e.at} title={new Date(e.at).toLocaleString()}>{ago(e.at)}</time>
    </li>
  );
}

export default function Overview() {
  const {data} = useConsole();
  const [chain, setChain] = useState(null);
  useEffect(() => { api.verifyChain().then(setChain).catch(() => setChain({valid: false})); }, [data.eventCount]);

  const active = data.agents.filter(a => a.status === 'active').length;
  const totals = data.agents.reduce((t, a) => ({allowed: t.allowed + a.stats.allowed, denied: t.denied + a.stats.denied}), {allowed: 0, denied: 0});
  const pending = data.approvals.filter(a => a.status === 'pending');
  const feed = data.events.filter(e => e.kind.startsWith('action.') || e.kind.startsWith('approval.') || e.kind.startsWith('agent.')).slice(0, 14);

  return (
    <>
      <header className="page-head">
        <div><p className="eyebrow">Overview</p><h1>Good to see you, {data.owner}</h1></div>
        <Link to="/app/agents?new=1" className="btn">Register an agent</Link>
      </header>

      <div className="stats">
        <div className="stat"><span>Active agents</span><b>{active}</b><small>{data.agents.length - active} revoked or expired</small></div>
        <div className="stat"><span>Allowed calls</span><b>{totals.allowed}</b><small>all time</small></div>
        <div className="stat"><span>Blocked calls</span><b className={totals.denied ? 'deny' : ''}>{totals.denied}</b><small>all time</small></div>
        <Link to="/app/approvals" className={`stat link ${pending.length ? 'attn' : ''}`}><span>Waiting on you</span><b>{pending.length}</b><small>{pending.length ? 'approve or decline →' : 'nothing pending'}</small></Link>
      </div>

      {data.agents.length === 0 ? (
        <section className="empty">
          <h2>No agents yet</h2>
          <p>Register one, give it a policy, then put its key in your agent or MCP config. It takes about a minute.</p>
          <Link to="/app/agents?new=1" className="btn">Register your first agent <ArrowRight size={15} /></Link>
        </section>
      ) : (
        <section className="panel">
          <div className="panel-head"><h2>Recent activity</h2><Link to="/app/audit" className="muted">Full audit log →</Link></div>
          <ul className="events">{feed.map(e => <EventRow key={e.id} e={e} agents={data.agents} />)}</ul>
        </section>
      )}

      <section className={`integrity ${chain?.valid === false ? 'bad' : ''}`}>
        {chain?.valid === false ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
        <div>
          <b>{chain == null ? 'Checking audit chain…' : chain.valid ? 'Audit chain intact' : 'Audit chain is broken'}</b>
          <span>{chain?.valid ? `${chain.count} events, head ${chain.head.slice(0, 12)}…` : chain?.valid === false ? `The log was changed at event ${chain.seq ?? chain.at}.` : ''}</span>
        </div>
        <Link to="/app/audit" className="muted">Verify & export</Link>
      </section>
    </>
  );
}
