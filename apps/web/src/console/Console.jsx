import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {LayoutDashboard, Bot, Inbox, ScrollText, Plug, Lock} from 'lucide-react';
import {api, ownerKey} from '../lib/api.js';
import {Link, navigate} from '../lib/router.jsx';
import {Logo, Spinner} from '../components/ui.jsx';
import {ConsoleCtx} from './ctx.js';
import {Setup, Unlock} from './Auth.jsx';
import Overview from './Overview.jsx';
import Agents from './Agents.jsx';
import AgentDetail from './AgentDetail.jsx';
import Approvals from './Approvals.jsx';
import Audit from './Audit.jsx';
import Connect from './Connect.jsx';
import '../styles/console.css';

const NAV = [
  ['/app', 'Overview', LayoutDashboard], ['/app/agents', 'Agents', Bot], ['/app/approvals', 'Approvals', Inbox],
  ['/app/audit', 'Audit log', ScrollText], ['/app/connect', 'Connect', Plug],
];

export default function Console({path}) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [authed, setAuthed] = useState(!!ownerKey.get());
  const [data, setData] = useState(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef();

  useEffect(() => { document.title = 'Console — Mihari'; }, []);
  useEffect(() => { api.status().then(setStatus).catch(e => setError(e.message)); }, [authed]);

  const refresh = useCallback(async () => {
    try { setData(await api.dashboard()); }
    catch (e) { if (e.status === 401) { ownerKey.clear(); setAuthed(false); } }
  }, []);

  useEffect(() => {
    if (!authed || !status?.configured) return;
    refresh();
    const id = setInterval(() => { if (!document.hidden) refresh(); }, 2500);
    return () => clearInterval(id);
  }, [authed, status?.configured, refresh]);

  const notify = useCallback(msg => {
    setToast(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 3200);
  }, []);
  const ctx = useMemo(() => ({data, refresh, notify}), [data, refresh, notify]);

  if (error) return <main className="auth"><div className="auth-card"><h1>Can’t reach Mihari</h1><p className="muted">{error}</p><p className="hint">Start it with <code className="inline-code">npm start</code> (or <code className="inline-code">npm run dev</code>).</p></div></main>;
  if (!status) return <div className="boot"><Spinner /></div>;
  if (!status.configured) return <Setup onDone={() => { setAuthed(true); api.status().then(setStatus); }} />;
  if (!authed) return <Unlock status={status} onDone={() => setAuthed(true)} />;
  if (!data) return <div className="boot"><Spinner /></div>;

  const pending = data.approvals.filter(a => a.status === 'pending').length;
  const agentMatch = /^\/app\/agents\/([^/]+)/.exec(path);
  let page;
  if (agentMatch) page = <AgentDetail id={agentMatch[1]} />;
  else if (path.startsWith('/app/agents')) page = <Agents />;
  else if (path.startsWith('/app/approvals')) page = <Approvals />;
  else if (path.startsWith('/app/audit')) page = <Audit />;
  else if (path.startsWith('/app/connect')) page = <Connect />;
  else page = <Overview />;

  return (
    <ConsoleCtx.Provider value={ctx}>
      <div className="shell">
        <aside className="side">
          <Logo />
          <nav aria-label="Console">
            {NAV.map(([to, label, Icon]) => {
              const on = to === '/app' ? path === '/app' || path === '/app/' : path.startsWith(to);
              return (
                <Link key={to} to={to} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
                  <Icon size={17} strokeWidth={1.7} /> {label}
                  {label === 'Approvals' && pending > 0 && <b className="pill">{pending}</b>}
                </Link>
              );
            })}
          </nav>
          <div className="side-foot">
            <span className="muted">{data.owner}</span>
            <Link to="/docs" className="muted">Docs</Link>
            <button className="linklike" onClick={() => { ownerKey.clear(); setAuthed(false); setData(null); navigate('/app'); }}><Lock size={13} /> Lock</button>
          </div>
        </aside>
        <main className="main">{page}</main>
        <div className={`toast ${toast ? 'on' : ''}`} role="status">{toast}</div>
      </div>
    </ConsoleCtx.Provider>
  );
}
