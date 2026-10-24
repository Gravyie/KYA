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
  const [syncError, setSyncError] = useState('');
  const [lastSync, setLastSync] = useState(null);
  const pendingFetch = useRef(null);
  const authGeneration = useRef(0);
  const toastTimer = useRef();

  useEffect(() => { document.title = 'Console — Wardrail'; }, []);
  const loadStatus = useCallback(() => { setError(''); api.status().then(setStatus).catch(e => setError(e.message)); }, []);
  useEffect(loadStatus, [authed, loadStatus]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const refresh = useCallback(() => {
    if (pendingFetch.current) return pendingFetch.current;
    const generation = authGeneration.current;
    const task = api.dashboard().then(next => {
      if (generation !== authGeneration.current) return;
      setData(next); setSyncError(''); setLastSync(new Date());
    }).catch(e => {
      if (generation !== authGeneration.current) return;
      if (e.status === 401) { ownerKey.clear(); setAuthed(false); setData(null); }
      else setSyncError(e.message);
    }).finally(() => { if (pendingFetch.current === task) pendingFetch.current = null; });
    pendingFetch.current = task;
    return task;
  }, []);

  useEffect(() => {
    if (!authed || !status?.configured) return;
    refresh();
    const id = setInterval(() => { if (!document.hidden) refresh(); }, 2500);
    const visible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', visible); authGeneration.current++; pendingFetch.current = null; };
  }, [authed, status?.configured, refresh]);

  const notify = useCallback(msg => {
    setToast(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 3200);
  }, []);
  const ctx = useMemo(() => ({data, refresh, notify}), [data, refresh, notify]);

  if (error) return <main className="auth"><div className="auth-card"><Logo /><h1>Can’t reach Wardrail</h1><p className="muted" role="alert">{error}</p><p className="hint">Start it with <code className="inline-code">npm start</code> (or <code className="inline-code">npm run dev</code>).</p><button className="btn" onClick={loadStatus}>Retry connection</button><Link to="/docs">Read the setup guide →</Link></div></main>;
  if (!status) return <div className="boot"><Spinner /></div>;
  if (!status.configured) return <Setup onDone={() => { setAuthed(true); api.status().then(setStatus); }} />;
  if (!authed) return <Unlock status={status} onDone={() => setAuthed(true)} />;
  if (!data) return <div className="route-message" role="status">{syncError ? <><h1>Couldn’t load the registry</h1><p>{syncError}</p><button className="btn" onClick={refresh}>Try again</button></> : <><Spinner /><p>Loading your registry…</p></>}</div>;

  const pending = data.approvals.filter(a => a.status === 'pending').length;
  const agentMatch = /^\/app\/agents\/([^/]+)/.exec(path);
  let page;
  if (agentMatch) page = <AgentDetail key={agentMatch[1]} id={agentMatch[1]} />;
  else if (path.startsWith('/app/agents')) page = <Agents />;
  else if (path.startsWith('/app/approvals')) page = <Approvals />;
  else if (path.startsWith('/app/audit')) page = <Audit />;
  else if (path.startsWith('/app/connect')) page = <Connect />;
  else page = <Overview />;

  return (
    <ConsoleCtx.Provider value={ctx}>
      <div className="shell">
        <a className="skip" href="#console-content">Skip to console content</a>
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
        <main className="main" id="console-content" tabIndex={-1}>
          <div className={`console-status ${syncError ? 'offline' : ''}`} role="status"><span><i />{syncError ? 'Connection interrupted · showing last received data' : 'Registry connected'}</span><span>{lastSync && `Updated ${lastSync.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`}</span></div>
          {syncError && <div className="error" role="alert">{syncError} <button className="linklike" onClick={refresh}>Retry now</button></div>}
          {page}
        </main>
        <div className={`toast ${toast ? 'on' : ''}`} role="status">{toast}</div>
      </div>
    </ConsoleCtx.Provider>
  );
}
