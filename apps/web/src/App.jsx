/**
 * App shell.
 *
 * State lives here deliberately: view + query is the whole navigation model, and
 * keeping it in one place means every screen can hand off to another (a
 * comparison column opens the full passport; a routed run opens the agent that
 * won) without a router dependency. Hash routing keeps deep links working —
 * useful when rehearsing a specific screen — without any library.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {api, pct} from './lib/api.js';
import Lookup from './views/Lookup.jsx';
import Compare from './views/Compare.jsx';
import Relying from './views/Relying.jsx';
import Sponsors from './views/Sponsors.jsx';
import Issue from './views/Issue.jsx';
import {
  IconSearch,
  IconPassport,
  IconScales,
  IconRoute,
  IconLayers,
  IconPlus,
  IconSpinner,
} from './components/icons.jsx';

const VIEWS = [
  {id: 'compare', label: 'Compare', icon: IconScales, key: '1'},
  {id: 'lookup', label: 'Passport', icon: IconPassport, key: '2'},
  {id: 'relying', label: 'Relying app', icon: IconRoute, key: '3'},
  {id: 'issue', label: 'Issue', icon: IconPlus, key: '4'},
  {id: 'sponsors', label: 'Integrations', icon: IconLayers, key: '5'},
];

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [view, ...rest] = raw.split('/');
  return {
    view: VIEWS.some((v) => v.id === view) ? view : 'compare',
    query: rest.length ? decodeURIComponent(rest.join('/')) : '',
  };
}

export default function App() {
  const [{view, query}, setRoute] = useState(parseHash);
  const [input, setInput] = useState(query);
  const [roster, setRoster] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [integrations, setIntegrations] = useState(null);
  const [health, setHealth] = useState(null);
  const [offline, setOffline] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const searchRef = useRef(null);

  const go = useCallback((nextView, nextQuery = '') => {
    window.location.hash = `#/${nextView}${nextQuery ? `/${encodeURIComponent(nextQuery)}` : ''}`;
  }, []);

  useEffect(() => {
    const onHash = () => {
      const r = parseHash();
      setRoute(r);
      setInput(r.query);
    };
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash) window.location.hash = '#/compare';
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Roster + metadata. Polled slowly so the sidebar's action counts follow a
  // live dispatch without hammering the RPC. Sorted best-first (rejections sink
  // regardless of score) — an unordered list of agents implies no ranking exists,
  // and ranking is the product.
  const load = useCallback(() => {
    api
      .directory()
      .then((d) => {
        setRoster(
          [...d.agents].sort((a, b) => {
            if ((a.rejected > 0) !== (b.rejected > 0)) return a.rejected > 0 ? 1 : -1;
            return b.score - a.score;
          }),
        );
        setOffline(false);
      })
      .catch(() => setOffline(true));
  }, []);

  useEffect(() => {
    load();
    api.tasks().then((d) => setTasks(d.tasks)).catch(() => {});
    api.integrations().then(setIntegrations).catch(() => {});
    api.health().then(setHealth).catch(() => {});
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  // Keyboard: / focuses search, 1-5 switch views, Esc closes suggestions.
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === 'Escape') {
        setSuggestOpen(false);
        searchRef.current?.blur();
        return;
      }
      if (!typing && !e.metaKey && !e.ctrlKey) {
        const hit = VIEWS.find((v) => v.key === e.key);
        if (hit) go(hit.id, hit.id === 'lookup' ? query : '');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, query]);

  const submit = (e) => {
    e?.preventDefault();
    const q = input.trim();
    if (!q) return;
    setSuggestOpen(false);
    go('lookup', q);
  };

  const matches = input.trim()
    ? roster.filter((a) => a.domain.toLowerCase().includes(input.trim().toLowerCase())).slice(0, 6)
    : [];

  return (
    <div className="app">
      {/* ── rail ── */}
      <aside className="rail">
        <div className="brand">
          <div className="brand-mark">
            <strong>KYA</strong>
            <span className="label" style={{letterSpacing: 0.7}}>
              know your agent
            </span>
          </div>
          <div className="brand-sub">KYC verifies humans. KYA verifies agents.</div>
        </div>

        <nav className="nav">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className="nav-item"
              aria-current={view === v.id}
              onClick={() => go(v.id, v.id === 'lookup' ? query : '')}
            >
              <v.icon size={13} />
              {v.label}
              <span className="kbd">{v.key}</span>
            </button>
          ))}
        </nav>

        <div className="rail-section row-between">
          <span className="label">Registry · best first</span>
          <span className="label num">{roster.length}</span>
        </div>

        <div className="roster">
          {roster.length === 0 && <div className="empty" style={{padding: '18px 10px'}}>No passports yet.</div>}
          {roster.map((a) => (
            <button
              key={a.agentId}
              className="roster-row"
              aria-current={query === a.domain}
              onClick={() => go('lookup', a.domain)}
            >
              <span className="roster-name">{a.domain}</span>
              <span
                className="mono num"
                style={{
                  fontSize: 10,
                  color: a.rejected > 0 ? 'var(--decline)' : a.score >= 7500 ? 'var(--trust)' : 'var(--limit)',
                }}
              >
                {pct(a.score, 0)}
              </span>
              <span className="roster-meta">
                {/* id, not rank — the roster is sorted best-first, so a bare
                    "#2" in third place looks like a stale ranking. */}
                <span>id {a.agentId}</span>
                <span>{a.total} acts</span>
                {a.rejected > 0 && <span style={{color: 'var(--decline)'}}>{a.rejected} blocked</span>}
                {!a.active && <span style={{color: 'var(--decline)'}}>off</span>}
              </span>
            </button>
          ))}
        </div>

        <div className="rail-foot">
          {integrations ? (
            ['world', 'ens', 'og'].map((k) => (
              <div key={k} className="row-between">
                <span className="label">{integrations[k].surface}</span>
                <span className="mode" data-live={String(integrations[k].live)} style={{fontSize: 9}}>
                  {integrations[k].live ? 'live' : 'local'}
                </span>
              </div>
            ))
          ) : (
            <span className="label">connecting…</span>
          )}
          {health && (
            <div className="label" style={{marginTop: 4}}>
              chain {health.chainId}
            </div>
          )}
        </div>
      </aside>

      {/* ── main ── */}
      <main className="main">
        <div className="topbar">
          <form className="search" onSubmit={submit} autoComplete="off">
            <span className="search-icon">
              <IconSearch size={13} />
            </span>
            <input
              ref={searchRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setSuggestOpen(true);
              }}
              onFocus={() => setSuggestOpen(true)}
              onBlur={() => setTimeout(() => setSuggestOpen(false), 120)}
              placeholder="ENS name, agent id, or address    /"
              aria-label="Look up an agent passport"
            />
            {suggestOpen && matches.length > 0 && (
              <div className="suggest">
                {matches.map((m) => (
                  <button key={m.agentId} type="button" onMouseDown={() => go('lookup', m.domain)}>
                    <IconPassport size={12} />
                    <span>{m.domain}</span>
                    <span className="spacer" />
                    <span className="mono dimmer num">{pct(m.score, 0)}</span>
                  </button>
                ))}
              </div>
            )}
          </form>

          <div className="spacer" />

          {offline ? (
            <span className="mode" data-live="false">
              API unreachable
            </span>
          ) : (
            <span className="mode row" style={{gap: 6}}>
              <span className="dot" style={{background: 'var(--trust)'}} />
              registry live
            </span>
          )}
        </div>

        {offline && (
          <div className="view" style={{paddingBottom: 0}}>
            <div className="err">
              Cannot reach the KYA API on :5055. Start the stack with <span className="mono">pnpm up</span>, then this
              banner clears itself.
            </div>
          </div>
        )}

        {view === 'compare' && <Compare tasks={tasks} onPick={(q) => go('lookup', q)} />}
        {view === 'lookup' && <Lookup query={query} tasks={tasks} onPick={(q) => go('lookup', q)} />}
        {view === 'relying' && <Relying tasks={tasks} onPick={(q) => go('lookup', q)} />}
        {view === 'issue' && <Issue onPick={(q) => go('lookup', q)} integrations={integrations} />}
        {view === 'sponsors' && <Sponsors />}
      </main>
    </div>
  );
}
