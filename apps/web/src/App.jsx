import React, {useCallback, useEffect, useRef, useState} from 'react';
import {api, pct} from './lib/api.js';
import Lenis from 'lenis';
import Landing from './views/Landing.jsx';
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
  IconArrowRight,
} from './components/icons.jsx';
import { AnimatePresence, motion } from "motion/react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";

const VIEWS = [
  {id: 'compare', label: 'Compare', icon: IconScales, key: '1'},
  {id: 'lookup', label: 'Passport', icon: IconPassport, key: '2'},
  {id: 'relying', label: 'Relying app', icon: IconRoute, key: '3'},
  {id: 'issue', label: 'Issue', icon: IconPlus, key: '4'},
  {id: 'sponsors', label: 'Integrations', icon: IconLayers, key: '5'},
];

const ALL = ['home', ...VIEWS.map((v) => v.id)];

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [view, ...rest] = raw.split('/');
  return {
    view: ALL.includes(view) ? view : 'home',
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
  const mainRef = useRef(null);

  const isHome = view === 'home';

  useEffect(() => {
    if (!isHome) return;
    
    // Give React a tick to mount the main element
    const timer = setTimeout(() => {
      if (!mainRef.current) return;
      
      const lenis = new Lenis({
        wrapper: mainRef.current,
        content: mainRef.current.firstElementChild,
        lerp: 0.08,
        smoothWheel: true,
      });
      
      let animationFrameId;
      function raf(time) {
        lenis.raf(time);
        animationFrameId = requestAnimationFrame(raf);
      }
      animationFrameId = requestAnimationFrame(raf);
      
      return () => {
        cancelAnimationFrame(animationFrameId);
        lenis.destroy();
      };
    }, 0);
    
    return () => clearTimeout(timer);
  }, [isHome]);

  const go = useCallback((nextView, nextQuery = '') => {
    window.location.hash = `#/${nextView}${nextQuery ? `/${encodeURIComponent(nextQuery)}` : ''}`;
  }, []);

  useEffect(() => {
    const onHash = () => {
      const r = parseHash();
      setRoute(r);
      setInput(r.query);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash) window.location.hash = '#/home';
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

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

  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        if (isHome) go('lookup');
        else searchRef.current?.focus();
        return;
      }
      if (e.key === 'Escape') {
        setSuggestOpen(false);
        searchRef.current?.blur();
        return;
      }
      if (!typing && !e.metaKey && !e.ctrlKey) {
        if (e.key === '0') return go('home');
        const hit = VIEWS.find((v) => v.key === e.key);
        if (hit) go(hit.id, hit.id === 'lookup' ? query : '');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, query, isHome]);

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

  if (isHome) {
    return (
      <div className="flex flex-col h-screen w-full bg-background">
        <header className="flex-none h-[60px] flex items-center px-8 border-b border-white/5 backdrop-blur-md bg-background/80 z-50 fixed top-0 w-full">
          <button className="flex items-center gap-3 group cursor-pointer" onClick={() => go('home')}>
            <strong className="text-lg font-bold tracking-tighter text-white font-sans bg-primary text-black px-2 py-0.5 border border-primary transition-colors group-hover:bg-black group-hover:text-primary">KYA</strong>
            <span className="text-[11px] font-mono tracking-widest text-muted-foreground uppercase flex items-center gap-2 group-hover:text-white transition-colors">
              <span className="text-primary/50">//</span> KNOW YOUR AGENT
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-6 ml-auto mr-6">
            <a href="#loop" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border-b border-transparent hover:border-white/20">How it works</a>
            <button onClick={() => go('sponsors')} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border-b border-transparent hover:border-white/20">Integrations</button>
            <button onClick={() => go('issue')} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border-b border-transparent hover:border-white/20">Issue a passport</button>
          </nav>

          <Button onClick={() => go('compare')} className="ml-auto md:ml-0 font-mono text-xs uppercase tracking-wider rounded-none relative overflow-hidden group border border-primary/50 bg-primary/10 hover:bg-primary/20 text-primary">
            <span className="relative z-10 flex items-center gap-2">Open the live console <IconArrowRight size={13} /></span>
            <div className="absolute inset-0 bg-primary/20 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out" />
          </Button>
        </header>

        <main ref={mainRef} className="flex-1 overflow-y-auto mt-[60px]">
          <div>
            <Landing onGo={go} integrations={integrations} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] h-screen w-full overflow-hidden bg-background">
      <aside className="hidden md:flex flex-col border-r-2 border-white/10 bg-black min-h-0">
        <div className="p-5 border-b-2 border-white/10 bg-black">
          <button className="flex flex-col gap-3 cursor-pointer group w-full" onClick={() => go('home')} title="Back to the overview">
            <div className="flex items-center gap-3">
              <strong className="text-lg font-bold tracking-tighter text-white font-sans bg-primary text-black px-2 py-0.5 border border-primary transition-colors group-hover:bg-black group-hover:text-primary">KYA</strong>
              <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase flex items-center gap-1 group-hover:text-white transition-colors">
                <span className="text-primary/50">//</span> KNOW YOUR AGENT
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono tracking-widest uppercase border-l-2 border-primary/30 pl-2 text-left">
              KYC verifies humans.<br/>KYA verifies agents.
            </div>
          </button>
        </div>

        <nav className="p-3 flex flex-col gap-[2px]">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-left w-full transition-all duration-200 ${view === v.id ? 'bg-white/10 text-white font-medium' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'}`}
              aria-current={view === v.id}
              onClick={() => go(v.id, v.id === 'lookup' ? query : '')}
            >
              <v.icon size={13} className={view === v.id ? 'text-primary' : ''} />
              {v.label}
              <span className="ml-auto font-mono text-[9.5px] text-muted-foreground/60 border border-white/10 rounded-[3px] px-1 bg-white/5">{v.key}</span>
            </button>
          ))}
        </nav>

        <div className="px-5 pt-3 pb-2 border-t border-white/5 mt-1 flex justify-between items-center">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.9px] text-muted-foreground font-medium">Registry · best first</span>
          <span className="font-mono text-[10px] text-muted-foreground">{roster.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 min-h-0 custom-scrollbar">
          {roster.length === 0 && <div className="p-3 text-[13px] text-muted-foreground">No passports yet.</div>}
          <AnimatePresence>
            {roster.map((a, i) => (
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                key={a.agentId}
                className={`w-full text-left p-2 rounded-md grid grid-cols-[1fr_auto] gap-x-2 gap-y-[2px] items-center transition-colors ${query === a.domain ? 'bg-white/10' : 'hover:bg-white/5'}`}
                aria-current={query === a.domain}
                onClick={() => go('lookup', a.domain)}
              >
                <span className={`text-[12.5px] overflow-hidden text-ellipsis whitespace-nowrap ${query === a.domain ? 'text-white' : 'text-muted-foreground'}`}>{a.domain}</span>
                <span
                  className="font-mono text-[10px]"
                  style={{ color: a.rejected > 0 ? 'var(--color-destructive)' : a.score >= 7500 ? 'var(--color-primary)' : 'var(--color-foreground)' }}
                >
                  {pct(a.score, 0)}
                </span>
                <span className="col-span-2 font-mono text-[10px] text-muted-foreground/60 flex gap-[7px]">
                  <span>id {a.agentId}</span>
                  <span>{a.total} acts</span>
                  {a.rejected > 0 && <span className="text-destructive">{a.rejected} blocked</span>}
                  {!a.active && <span className="text-destructive">off</span>}
                </span>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>

        <div className="border-t-2 border-white/10 p-4 flex flex-col gap-1.5 bg-black">
          {integrations ? (
            ['world', 'ens', 'og'].map((k) => (
              <div key={k} className="flex justify-between items-center">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.9px] text-muted-foreground font-medium">{integrations[k].surface}</span>
                <span className={`text-[9px] px-1 rounded-[2px] ${integrations[k].live ? 'bg-primary/20 text-primary' : 'bg-white/10 text-muted-foreground'}`}>
                  {integrations[k].live ? 'live' : 'local'}
                </span>
              </div>
            ))
          ) : (
            <span className="font-mono text-[9.5px] uppercase tracking-[0.9px] text-muted-foreground font-medium">connecting…</span>
          )}
          {health && (
            <div className="font-mono text-[9.5px] uppercase tracking-[0.9px] text-muted-foreground/50 mt-1">
              chain {health.chainId}
            </div>
          )}
        </div>
      </aside>

      <main className="flex flex-col min-w-0 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-white/5 px-6 py-3 flex items-center gap-4 shadow-sm">
          <form className="relative flex-1 max-w-[460px] group" onSubmit={submit} autoComplete="off">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
              <IconSearch size={14} />
            </span>
            <Input
              ref={searchRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setSuggestOpen(true);
              }}
              onFocus={() => setSuggestOpen(true)}
              onBlur={() => setTimeout(() => setSuggestOpen(false), 120)}
              placeholder="ENS name, agent id, or address"
              aria-label="Look up an agent passport"
              className="pl-9 bg-black border-2 border-white/20 focus-visible:ring-0 focus-visible:border-primary font-mono text-[13px] h-9 rounded-none text-white"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground border border-white/10 rounded px-1 hidden md:block">/</div>
            
            <AnimatePresence>
              {suggestOpen && matches.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute top-[calc(100%+5px)] left-0 right-0 bg-black border-2 border-white/20 rounded-none p-1 z-40 shadow-2xl"
                >
                  {matches.map((m) => (
                    <button key={m.agentId} type="button" className="flex w-full items-center gap-2 p-2 rounded hover:bg-white/10 text-left text-[12.5px] text-foreground transition-colors" onMouseDown={() => go('lookup', m.domain)}>
                      <IconPassport size={12} className="text-muted-foreground" />
                      <span>{m.domain}</span>
                      <span className="flex-1" />
                      <span className="font-mono text-muted-foreground text-[11px]">{pct(m.score, 0)}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          <div className="flex-1" />

          {offline ? (
            <span className="text-[11px] font-mono uppercase bg-destructive/20 text-destructive px-2 py-1 rounded-sm border border-destructive/30">API unreachable</span>
          ) : (
            <span className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground tracking-widest uppercase">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
              registry live
            </span>
          )}
        </div>

        {offline && (
          <div className="px-6 pt-5 pb-0 max-w-6xl w-full">
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-md font-mono">
              Cannot reach the KYA API on :5055. Start the stack with <span className="font-bold">pnpm up</span>, then this banner clears itself.
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 h-full"
          >
            {view === 'compare' && <Compare tasks={tasks} onPick={(q) => go('lookup', q)} />}
            {view === 'lookup' && <Lookup query={query} tasks={tasks} onPick={(q) => go('lookup', q)} />}
            {view === 'relying' && <Relying tasks={tasks} onPick={(q) => go('lookup', q)} />}
            {view === 'issue' && <Issue onPick={(q) => go('lookup', q)} integrations={integrations} />}
            {view === 'sponsors' && <Sponsors />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
