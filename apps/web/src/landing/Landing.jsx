import {useCallback, useEffect, useRef, useState, lazy, Suspense} from 'react';
import Lenis from 'lenis';
import {ArrowRight, ArrowDown, ShieldCheck} from 'lucide-react';
import {Link} from '../lib/router.jsx';
import {Logo, Code, CopyButton} from '../components/ui.jsx';
import {SNIPPETS, DECISIONS} from './snippets.js';
import {Words, useReveal, Counter} from './bits.jsx';
import ProductWindow from './ProductWindow.jsx';
import Cases from './Cases.jsx';
import '../styles/landing.css';

const Playground = lazy(() => import('./Playground.jsx'));

const LIGHT = [229, 236, 229], NIGHT = [6, 13, 10];
const webglOk = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };
const fade = (s, a, b, edge = 0.25) => Math.max(0, Math.min(1, Math.min((s - a) / edge, (b - s) / edge)));

const CALLOUTS = [
  {id: 'card', n: '01', title: 'Identity', text: 'Agent passport, signed with Ed25519', dx: 150, dy: 70, show: s => fade(s, -1, 0.7, 0.3), align: 'left'},
  {id: 'gate', n: '02', title: 'Gate', text: 'Every call gets one verdict', dx: 84, dy: -84, show: s => Math.max(fade(s, -1, 0.7, 0.3), fade(s, 2.6, 3.6)), align: 'left'},
  {id: 'ledger', n: '03', title: 'Ledger', text: 'Hash-linked. Verify it offline', dx: 40, dy: 96, show: s => Math.max(fade(s, -1, 0.7, 0.3), fade(s, 3.6, 4.6)), align: 'left'},
];

function Callouts({refs}) {
  return (
    <div className="callouts" aria-hidden="true">
      {CALLOUTS.map(c => {
        const len = Math.hypot(c.dx, c.dy), ang = Math.atan2(c.dy, c.dx) * 180 / Math.PI;
        return (
          <div key={c.id} className="callout" ref={el => { refs.current[c.id] = el; }} style={{'--len': `${len}px`, '--ang': `${ang}deg`, '--dx': `${c.dx}px`, '--dy': `${c.dy}px`}}>
            <i className="pin" /><i className="leader" />
            <div className={`label-box ${c.align}`}><b>{c.n}</b><strong>{c.title}</strong><span>{c.text}</span></div>
          </div>
        );
      })}
    </div>
  );
}

function useGate(rootRef, canvasRef, calloutRefs, onDecision) {
  const [mode, setMode] = useState('loading');
  const gateRef = useRef(null);
  const cbRef = useRef(onDecision); cbRef.current = onDecision;

  useEffect(() => {
    if (!webglOk()) { setMode('static'); return; }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let gate, lenis, cancelled = false, raf = 0, rafLenis = 0, dark = false;

    import('./gate.js').then(({createGate}) => {
      if (cancelled || !canvasRef.current) return;
      const root = rootRef.current;
      try {
        gate = createGate(canvasRef.current, {
          reduced, small: innerWidth < 760, onDecision: k => cbRef.current?.(k),
          onFrame: (anchors, info) => {
            const bg = LIGHT.map((v, i) => Math.round(v + (NIGHT[i] - v) * Math.min(1, info.dark)));
            root.style.setProperty('--stage-bg', `rgb(${bg})`);
            const isDark = info.dark > 0.5;
            if (isDark !== dark) { dark = isDark; root.dataset.dark = isDark ? '1' : '0'; }
            for (const c of CALLOUTS) {
              const el = calloutRefs.current[c.id], a = anchors[c.id];
              if (!el || !a) continue;
              const o = a.on ? c.show(info.stage) : 0;
              el.style.opacity = o.toFixed(3);
              el.style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0)`;
              el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
            }
          },
        });
      } catch { setMode('static'); return; }
      gateRef.current = gate;
      if (location.search.includes('debug')) window.__gate = gate;
      setMode('ready');

      const update = () => {
        raf = 0;
        const stages = [...document.querySelectorAll('[data-stage]')].sort((a, b) => a.dataset.stage - b.dataset.stage);
        if (!stages.length) return;
        const mid = innerHeight * 0.5;
        const centers = stages.map(el => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; });
        let f = 0;
        if (mid >= centers.at(-1)) f = stages.length - 1;
        else if (mid > centers[0]) for (let i = 0; i < centers.length - 1; i++) {
          if (mid >= centers[i] && mid < centers[i + 1]) { f = i + (mid - centers[i]) / (centers[i + 1] - centers[i]); break; }
        }
        gate.setStage(f);
        if (f < 7.3 || f > 9.2) gate.setIris(null);
      };
      const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
      if (!reduced) {
        lenis = new Lenis({lerp: 0.1, wheelMultiplier: 0.95});
        const loop = t => { lenis.raf(t); rafLenis = requestAnimationFrame(loop); };
        rafLenis = requestAnimationFrame(loop);
        lenis.on('scroll', queue);
        window.__lenis = lenis;
      }
      addEventListener('scroll', queue, {passive: true}); addEventListener('resize', queue);
      update();
      gate.cleanup = () => { removeEventListener('scroll', queue); removeEventListener('resize', queue); };
    }).catch(() => setMode('static'));

    return () => {
      cancelled = true; cancelAnimationFrame(raf); cancelAnimationFrame(rafLenis);
      lenis?.destroy(); window.__lenis = null; gate?.cleanup?.(); gate?.destroy();
    };
  }, [rootRef, canvasRef, calloutRefs]);
  return {mode, gateRef};
}

function Preloader({ready, onDone}) {
  const [n, setN] = useState(0);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    let raf, v = 0, finished = false;
    const t0 = performance.now();
    const tick = now => {
      const target = ready && now - t0 > 900 ? 100 : 92;
      v += (target - v) * 0.07;
      setN(Math.min(100, Math.round(v)));
      if (ready && v > 99.4 && !finished) { finished = true; setN(100); setTimeout(() => { setGone(true); setTimeout(onDone, 700); }, 250); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, onDone]);
  return (
    <div className={`pre ${gone ? 'gone' : ''}`} aria-hidden="true">
      <span className="pre-mark"><svg width="26" height="26" viewBox="0 0 32 32"><circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="3.2" /><circle cx="16" cy="16" r="3.4" fill="var(--allow-glow)" /></svg> Sigilant</span>
      <b className="pre-n">{String(n).padStart(3, '0')}</b>
    </div>
  );
}

function Nav() {
  const [solid, setSolid] = useState(false);
  useEffect(() => { const on = () => setSolid(scrollY > 24); on(); addEventListener('scroll', on, {passive: true}); return () => removeEventListener('scroll', on); }, []);
  const go = id => e => { const el = document.getElementById(id); if (!el) return; e.preventDefault(); window.__lenis ? window.__lenis.scrollTo(el, {offset: -40}) : el.scrollIntoView({behavior: 'smooth'}); };
  return (
    <header className={`nav ${solid ? 'solid' : ''}`}>
      <div className="wrap nav-in">
        <Logo />
        <nav aria-label="Main">
          <a href="#how" onClick={go('how')}>How it works</a><a href="#try" onClick={go('try')}>Try policy</a><a href="#integrate" onClick={go('integrate')}>Integrate</a>
          <Link to="/docs">Docs</Link><Link to="/verify">Verify</Link>
        </nav>
        <Link to="/app" className="btn sm pill-btn">Open console <ArrowRight size={14} /></Link>
      </div>
    </header>
  );
}

const STEPS = [
  {stage: 2, n: '01', title: 'Identify', lead: 'Every agent carries a passport.', body: 'Its own key, a signed identity card, and the name of the human accountable for it. No more ten agents behind one shared API key.'},
  {stage: 3, n: '02', title: 'Decide', lead: 'Every call meets the gate.', body: 'Rules say allow, ask a human, or deny. Budgets and rate limits cap the blast radius when a rule turns out too generous.'},
  {stage: 4, n: '03', title: 'Prove', lead: 'Every verdict joins the ledger.', body: 'A hash-linked log you can export and verify offline against your registry key. Edit the past and every later block stops matching.'},
];

export default function Landing() {
  const rootRef = useRef(null), canvasRef = useRef(null), calloutRefs = useRef({});
  const [feed, setFeed] = useState([]);
  const [tab, setTab] = useState('mcp');
  const [revoked, setRevoked] = useState(false);
  const [booted, setBooted] = useState(() => { try { return sessionStorage.getItem('sg.boot') === '1'; } catch { return false; } });
  const last = useRef(0);

  const onDecision = useCallback(kind => {
    const now = performance.now();
    if (now - last.current < 900) return;
    last.current = now;
    const pool = DECISIONS[kind];
    setFeed(f => [{id: now, kind, text: pool[Math.floor(Math.random() * pool.length)]}, ...f].slice(0, 3));
  }, []);
  const {mode, gateRef} = useGate(rootRef, canvasRef, calloutRefs, onDecision);
  useReveal(booted);
  useEffect(() => { document.title = 'Sigilant — Know your agent'; }, []);
  const ready = mode !== 'loading';
  const done = useCallback(() => { setBooted(true); try { sessionStorage.setItem('sg.boot', '1'); } catch { /* private */ } }, []);

  const toggleIris = () => { const next = !revoked; setRevoked(next); gateRef.current?.setIris(next ? 'closed' : 'open'); };
  const snip = SNIPPETS[tab];
  const installCmd = 'SIGILANT_AGENT_KEY=sga_… node packages/mcp/bin/sigilant-mcp.js -- <your mcp server>';

  return (
    <div className={`landing gate-${mode} ${booted ? 'booted' : ''}`} ref={rootRef} data-dark="0">
      {!booted && <Preloader ready={ready} onDone={done} />}
      <canvas ref={canvasRef} className="stage" aria-hidden="true" />
      {mode === 'static' && <div className="stage-fallback" aria-hidden="true"><i /></div>}
      <div className="grain" aria-hidden="true" />
      <Callouts refs={calloutRefs} />
      <Nav />

      <section className="hero" data-stage="0">
        <div className="wrap hero-in">
          <p className="eyebrow rise"><span className="dot" /> Know your agent</p>
          <h1><Words>Every agent gets an identity.</Words><br /><span className="soft"><Words>Every action,</Words> <span className="nowrap"><Words>a</Words><em className="serif w-serif">verdict.</em></span></span></h1>
          <p className="lede rise">Sigilant is the open-source permission layer between your AI agents and everything they can touch. Scoped keys, human approvals, spend limits and an audit trail anyone can verify.</p>
          <div className="hero-cta rise">
            <Link to="/app" className="btn pill-btn">Open the console <ArrowRight size={16} /></Link>
            <Link to="/docs" className="btn ghost pill-btn">Read the quickstart</Link>
          </div>
          <div className="install rise"><code>{installCmd}</code><CopyButton text={installCmd} /></div>
        </div>
        <div className="wrap hero-foot">
          <ol className="ticker" aria-label="Illustrative stream of agent decisions">
            {feed.map(it => <li key={it.id} className={it.kind}><span className="tk-badge">{it.kind}</span><span className="tk-text">{it.text}</span></li>)}
            <li className="tk-note">Illustrative stream</li>
          </ol>
          <span className="cue"><ArrowDown size={14} /> Scroll</span>
        </div>
      </section>

      <section className="sec window" data-stage="1">
        <div className="wrap">
          <p className="eyebrow rise">The gap</p>
          <h2 className="statement"><Words>Agents hold real keys now. They read your files, spend your money and send your email on one shared credential and a polite system prompt.</Words></h2>
          <div className="trio">
            <p className="rise"><b>No identity</b>Ten agents, one key. When something is deleted nobody can say which agent did it.</p>
            <p className="rise"><b>No enforcement</b>“Never touch production” in a prompt is a suggestion. A policy engine is a wall.</p>
            <p className="rise"><b>No evidence</b>Logs the agent can reach are logs it can lose. You want a record nobody could quietly edit.</p>
          </div>
          <div className="rise pw-wrap"><ProductWindow /></div>
        </div>
      </section>

      <div id="how">
        {STEPS.map(s => (
          <section key={s.n} className="sec step" data-stage={s.stage}>
            <div className={`wrap step-in ${s.stage === 3 ? '' : 'right'}`}>
              <div className="step-copy">
                <p className="eyebrow rise"><b>{s.n}</b> {s.title}</p>
                <h2 className="big"><Words>{s.lead}</Words></h2>
                <p className="sub rise">{s.body}</p>
              </div>
            </div>
          </section>
        ))}
      </div>

      <section id="try" className="sec try" data-stage="5">
        <div className="wrap">
          <p className="eyebrow rise">Live policy engine</p>
          <h2 className="big"><Words>Write the rules. Then try to break them.</Words></h2>
          <p className="sub rise">The same decision code the server runs, in your browser. Pick an agent and click what it tries to do.</p>
          <div className="rise play-wrap"><Suspense fallback={<div className="play skeleton" />}><Playground /></Suspense></div>
        </div>
      </section>

      <section id="integrate" className="sec integrate" data-stage="6">
        <div className="wrap">
          <p className="eyebrow rise">Integrate in minutes</p>
          <h2 className="big"><Words>Drop it in front of the tools you already use.</Words></h2>
          <div className="int-grid rise">
            <div className="int-tabs" role="tablist">
              {Object.entries(SNIPPETS).map(([k, s]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{s.label}</button>)}
              <p className="int-note">{snip.note}</p>
            </div>
            <Code title={snip.title}>{snip.code}</Code>
          </div>
        </div>
      </section>

      <section className="sec cases" data-stage="7">
        <div className="wrap">
          <p className="eyebrow rise">Built for</p>
          <h2 className="big"><Words>Three jobs it does on day one.</Words></h2>
          <Cases />
          <dl className="numbers">
            <div className="rise"><dt><Counter to={0} /></dt><dd>runtime dependencies in the server</dd></div>
            <div className="rise"><dt><Counter to={256} suffix="-bit" /></dt><dd>keys, stored only as hashes</dd></div>
            <div className="rise"><dt><Counter to={15} prefix="≤ " suffix=" min" /></dt><dd>lifetime of an identity assertion</dd></div>
            <div className="rise"><dt><Counter to={3} /></dt><dd>verdicts: allow, ask, deny</dd></div>
          </dl>
        </div>
      </section>

      <section className="sec revoke" data-stage="8">
        <div className="wrap revoke-in">
          <div className="revoke-copy">
            <p className="eyebrow rise">Revocation</p>
            <h2 className="big"><Words>Revoke once. Closed everywhere.</Words></h2>
            <p className="sub rise">Pending approvals are cancelled, the next call is denied, and every service that checks status stops trusting the agent. Rotate a leaked key without losing its history.</p>
            <div className="rise rv-actions">
              <button className={`btn pill-btn ${revoked ? 'light' : 'danger'}`} onClick={toggleIris}>{revoked ? 'Re-issue research-bot' : 'Revoke research-bot'}</button>
              <span className={`rv-state ${revoked ? 'off' : 'on'}`}><i />{revoked ? 'REVOKED · every call denied' : 'ACTIVE · 1,284 calls today'}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="sec trust">
        <div className="wrap trust-in">
          <div><p className="eyebrow rise">Boring where it matters</p><h2 className="big"><Words>Small, auditable, yours.</Words></h2></div>
          <ul className="facts rise">
            <li><ShieldCheck size={16} /> Ed25519 signatures and a SHA-256 hash chain, nothing exotic.</li>
            <li><ShieldCheck size={16} /> Zero-dependency server. Your data is a folder on your machine.</li>
            <li><ShieldCheck size={16} /> MIT licensed. No telemetry, no account, no paid service.</li>
          </ul>
          <div className="limits rise"><p className="eyebrow">Honest limits</p><p>Sigilant decides and records. It cannot stop a tool that skips the check, so enforce at the tool or MCP layer. Receipts are agent-reported. The log is tamper-evident against a known head, not a distributed ledger.</p></div>
        </div>
      </section>

      <section className="sec cta" data-stage="9">
        <div className="wrap cta-in">
          <h2 className="huge"><Words>Know your agent.</Words></h2>
          <p className="sub rise">One process, one folder, a minute to run.</p>
          <div className="cta-code rise"><Code title="terminal" plain>{`git clone https://github.com/sigilant/sigilant && cd sigilant
npm --prefix apps/web install && npm run build
npm start      # → http://127.0.0.1:5055`}</Code></div>
          <div className="hero-cta rise center"><Link to="/app" className="btn pill-btn">Open the console <ArrowRight size={16} /></Link><Link to="/verify" className="btn ghost pill-btn">Verify an agent</Link></div>
        </div>
      </section>

      <footer className="foot">
        <div className="wrap foot-in"><Logo /><span>Know your agent.</span><nav aria-label="Footer"><Link to="/docs">Docs</Link><Link to="/verify">Verify</Link><Link to="/app">Console</Link><a href="/llms.txt">llms.txt</a></nav></div>
        <div className="wordmark" aria-hidden="true">Sigilant</div>
      </footer>
    </div>
  );
}
