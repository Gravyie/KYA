import {useCallback, useEffect, useRef, useState, lazy, Suspense} from 'react';
import Lenis from 'lenis';
import {ArrowRight, ShieldCheck} from 'lucide-react';
import {Link} from '../lib/router.jsx';
import {Logo, Code, CopyButton} from '../components/ui.jsx';
import {SNIPPETS, DECISIONS} from './snippets.js';
import {Words, useReveal, Counter} from './bits.jsx';
import SectionHead from './SectionHead.jsx';
import Figure, {BEATS} from './Figure.jsx';
import ProductWindow from './ProductWindow.jsx';
import Cases from './Cases.jsx';
import Passport from './Passport.jsx';
import Stack from './Stack.jsx';
import '../styles/landing.css';

const Playground = lazy(() => import('./Playground.jsx'));
const webglOk = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };

/** Mounts the 3D gate into the figure and drives it from the story's scroll position. */
function useGate(canvasRef, frameApi, onDecision, onBeat) {
  const [mode, setMode] = useState('loading');
  const gateRef = useRef(null);
  const cb = useRef({onDecision, onBeat}); cb.current = {onDecision, onBeat};

  useEffect(() => {
    if (!webglOk()) { setMode('static'); return undefined; }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let gate, lenis, cancelled = false, raf = 0, rafLenis = 0;

    import('./gate.js').then(({createGate}) => {
      if (cancelled || !canvasRef.current) return;
      try {
        gate = createGate(canvasRef.current, {reduced, small: innerWidth < 760, onDecision: k => cb.current.onDecision?.(k), onFrame: (a, info) => frameApi.current?.(a, info)});
      } catch { setMode('static'); return; }
      gateRef.current = gate;
      if (location.search.includes('debug')) window.__gate = gate;
      setMode('ready');

      const update = () => {
        raf = 0;
        const beats = [...document.querySelectorAll('[data-stage]')].sort((a, b) => a.dataset.stage - b.dataset.stage);
        if (!beats.length) return;
        const mid = innerHeight * 0.5;
        const centers = beats.map(el => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; });
        let f = 0;
        if (mid >= centers.at(-1)) f = beats.length - 1;
        else if (mid > centers[0]) for (let i = 0; i < centers.length - 1; i++) {
          if (mid >= centers[i] && mid < centers[i + 1]) { f = i + (mid - centers[i]) / (centers[i + 1] - centers[i]); break; }
        }
        gate.setStage(f);
        cb.current.onBeat?.(Math.round(f));
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

    return () => { cancelled = true; cancelAnimationFrame(raf); cancelAnimationFrame(rafLenis); lenis?.destroy(); window.__lenis = null; gate?.cleanup?.(); gate?.destroy(); };
  }, [canvasRef, frameApi]);
  return {mode, gateRef};
}

function Preloader({ready, onDone}) {
  const [n, setN] = useState(0);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    let raf, v = 0, finished = false;
    const t0 = performance.now();
    const tick = now => {
      v += ((ready && now - t0 > 700 ? 100 : 92) - v) * 0.08;
      setN(Math.min(100, Math.round(v)));
      if (ready && v > 99.4 && !finished) { finished = true; setN(100); setTimeout(() => { setGone(true); setTimeout(onDone, 700); }, 200); return; }
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
          <a href="#product" onClick={go('product')}>Product</a><a href="#passport" onClick={go('passport')}>Passport</a><a href="#policy" onClick={go('policy')}>Policy</a><a href="#integrate" onClick={go('integrate')}>Integrate</a>
          <Link to="/docs">Docs</Link><Link to="/verify">Verify</Link>
        </nav>
        <Link to="/app" className="btn sm pill-btn">Open console <ArrowRight size={14} /></Link>
      </div>
    </header>
  );
}

const BEAT_COPY = [
  null,
  {n: '01', title: 'Identify', lead: 'Every agent carries a passport.', body: 'Its own key, a signed identity card, and the name of the person accountable for it. Publish it to the ERC-8004 registry and any service can check it. No more ten agents behind one shared API key.'},
  {n: '02', title: 'Decide', lead: 'Every call meets the gate.', body: 'Rules say allow, ask a human, or deny. Budgets and rate limits cap the blast radius when a rule turns out too generous.'},
  {n: '03', title: 'Prove', lead: 'Every verdict joins the ledger.', body: 'A hash-linked log you can export and verify offline against your registry key. Edit the past and every later block stops matching.'},
  {n: '04', title: 'Contain', lead: 'Revoke once. Closed everywhere.', body: 'Pending approvals are cancelled, the next call is denied, and every service checking status stops trusting the agent. Rotate a leaked key without losing its history.'},
];

export default function Landing() {
  const canvasRef = useRef(null), frameApi = useRef(null), rootRef = useRef(null);
  const [tick, setTick] = useState(null);
  const [tab, setTab] = useState('mcp');
  const [beat, setBeat] = useState(0);
  const [revoked, setRevoked] = useState(false);
  const [booted, setBooted] = useState(() => { try { return sessionStorage.getItem('sg.boot') === '1'; } catch { return false; } });
  const last = useRef(0);

  const onDecision = useCallback(kind => {
    const now = performance.now();
    if (now - last.current < 1100) return;
    last.current = now;
    const pool = DECISIONS[kind];
    setTick({kind, text: pool[Math.floor(Math.random() * pool.length)]});
  }, []);
  const onBeat = useCallback(b => setBeat(prev => (prev === b ? prev : b)), []);
  const {mode, gateRef} = useGate(canvasRef, frameApi, onDecision, onBeat);
  useReveal(booted);
  useEffect(() => { document.title = 'Sigilant — Know your agent'; }, []);
  const done = useCallback(() => { setBooted(true); try { sessionStorage.setItem('sg.boot', '1'); } catch { /* private mode */ } }, []);
  useEffect(() => { if (beat !== 4) { setRevoked(false); gateRef.current?.setIris(null); } }, [beat, gateRef]);

  const jump = i => { const el = document.querySelector(`[data-stage="${i}"]`); if (el) window.__lenis ? window.__lenis.scrollTo(el, {offset: -(innerHeight - el.offsetHeight) / 2}) : el.scrollIntoView({behavior: 'smooth', block: 'center'}); };
  const toggleIris = () => { const next = !revoked; setRevoked(next); gateRef.current?.setIris(next ? 'closed' : 'open'); };
  const snip = SNIPPETS[tab];
  const installCmd = 'SIGILANT_AGENT_KEY=sga_… node packages/mcp/bin/sigilant-mcp.js -- <your mcp server>';

  return (
    <div className={`landing gate-${mode} ${booted ? 'booted' : ''}`} ref={rootRef}>
      {!booted && <Preloader ready={mode !== 'loading'} onDone={done} />}
      <div className="grain" aria-hidden="true" />
      <Nav />

      <section id="story" className="story">
        <div className="wrap story-grid">
          <div className="story-copy">
            <div className="beat hero-beat" data-stage="0">
              <p className="eyebrow rise"><span className="dot" /> Know your agent</p>
              <h1><Words>Every agent gets an identity.</Words><br /><span className="soft"><Words>Every action,</Words> <span className="nowrap"><Words>a</Words><em className="serif">verdict.</em></span></span></h1>
              <p className="lede rise">Sigilant is the open-source permission layer between AI agents and everything they can touch. A verifiable identity, scoped permissions, human approvals, and an audit trail anyone can check.</p>
              <div className="hero-cta rise">
                <Link to="/app" className="btn pill-btn">Open the console <ArrowRight size={16} /></Link>
                <Link to="/docs" className="btn ghost pill-btn">Read the quickstart</Link>
              </div>
              <ul className="standards rise" aria-label="Built on">
                <li>ERC-8004 identity</li><li>MCP firewall</li><li>Ed25519 assertions</li><li>Self-hosted</li>
              </ul>
            </div>
            {BEAT_COPY.slice(1).map((c, i) => (
              <div key={c.n} className="beat" data-stage={i + 1}>
                <p className="eyebrow rise"><b>{c.n}</b><i />{c.title}</p>
                <h2 className="big"><Words>{c.lead}</Words></h2>
                <p className="sub rise">{c.body}</p>
                {i === 3 && (
                  <div className="rise rv-actions">
                    <button className={`btn pill-btn ${revoked ? 'ghost' : 'danger'}`} onClick={toggleIris}>{revoked ? 'Re-issue research-bot' : 'Revoke research-bot'}</button>
                    <span className={`rv-state ${revoked ? 'off' : 'on'}`}><i />{revoked ? 'REVOKED · every call denied' : 'ACTIVE · calls allowed'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="story-fig">
            {mode === 'static' ? <div className="fig static-fig"><div className="stage-fallback"><i /></div></div> : <Figure canvasRef={canvasRef} beat={beat} tick={tick} frameApi={frameApi} onJump={jump} />}
          </div>
        </div>
      </section>

      <section id="product" className="sec">
        <div className="wrap">
          <SectionHead n="02" label="Product" title="See every call. Approve the risky ones." sub="Agents hold real keys now, usually one shared credential and a polite system prompt. Sigilant gives each its own identity and puts a human in the loop only where it matters." />
          <div className="trio">
            <p className="rise"><b>No identity</b>Ten agents, one key. When something is deleted nobody can say which agent did it.</p>
            <p className="rise"><b>No enforcement</b>“Never touch production” in a prompt is a suggestion. A policy engine is a wall.</p>
            <p className="rise"><b>No evidence</b>Logs the agent can reach are logs it can lose. You want a record nobody could quietly edit.</p>
          </div>
          <div className="rise pw-wrap"><ProductWindow /></div>
        </div>
      </section>

      <section id="passport" className="sec">
        <div className="wrap">
          <SectionHead n="03" label="Passport" title="An identity that travels." sub="Each agent’s passport is an ERC-8004 registration file, signed by your registry. Publish it to the public Identity Registry on Base, and any service can look the agent up without trusting your server." />
          <div className="passport-grid">
            <ol className="p-steps">
              <li className="rise"><b>01</b><div><h3>Register</h3><p>Name the agent, set its rules, get its key. The passport is generated for you.</p></div></li>
              <li className="rise"><b>02</b><div><h3>Publish</h3><p>One wallet signature registers it on Base. The file travels inside the transaction, so there is nothing to host and testnet gas is free.</p></div></li>
              <li className="rise"><b>03</b><div><h3>Verify</h3><p>A partner reads the registry, checks the signature, and asks your server whether the agent is still active. Revoke, and every check fails.</p></div></li>
            </ol>
            <div className="rise"><Passport /></div>
          </div>
        </div>
      </section>

      <section id="policy" className="sec">
        <div className="wrap">
          <SectionHead n="04" label="Policy" title="Write the rules. Then try to break them." sub="The same decision code the server runs, in your browser. Pick an agent and click what it tries to do." />
          <div className="rise play-wrap"><Suspense fallback={<div className="play skeleton" />}><Playground /></Suspense></div>
        </div>
      </section>

      <section id="integrate" className="sec">
        <div className="wrap">
          <SectionHead n="05" label="Integrate" title="Drop it in front of the tools you already use." sub="One config line for any MCP client. An SDK for your own code. Plain REST for everything else." />
          <div className="int-grid rise">
            <div className="int-tabs" role="tablist">
              {Object.entries(SNIPPETS).map(([k, s]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{s.label}</button>)}
              <p className="int-note">{snip.note}</p>
            </div>
            <Code title={snip.title}>{snip.code}</Code>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <SectionHead n="06" label="Use cases" title="Three jobs it does on day one." />
          <Cases />
        </div>
      </section>

      <section id="stack" className="sec">
        <div className="wrap">
          <SectionHead n="07" label="Your stack" title="It fits next to what you already run." sub="Identity providers answer who an agent is and which apps it may open. Sigilant answers whether it may do this particular thing right now, and proves what happened." />
          <Stack />
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <SectionHead n="08" label="Trust" title="Small, auditable, yours." />
          <dl className="numbers">
            <div className="rise"><dt><Counter to={0} /></dt><dd>runtime dependencies in the server</dd></div>
            <div className="rise"><dt><Counter to={256} suffix="-bit" /></dt><dd>keys, stored only as hashes</dd></div>
            <div className="rise"><dt><Counter to={15} prefix="≤ " suffix=" min" /></dt><dd>lifetime of an identity assertion</dd></div>
            <div className="rise"><dt><Counter to={3} /></dt><dd>verdicts: allow, ask, deny</dd></div>
          </dl>
          <div className="trust-in">
            <ul className="facts rise">
              <li><ShieldCheck size={16} /> Ed25519 signatures and a SHA-256 hash chain, nothing exotic.</li>
              <li><ShieldCheck size={16} /> Zero-dependency server. Your data is a folder on your machine.</li>
              <li><ShieldCheck size={16} /> MIT licensed. No telemetry, no account, no paid service.</li>
            </ul>
            <div className="limits rise"><p className="eyebrow">Honest limits</p><p>Sigilant decides and records. It cannot stop a tool that skips the check, so enforce at the tool or MCP layer. Receipts are agent-reported. The log is tamper-evident against a known head, not a distributed ledger.</p></div>
          </div>
        </div>
      </section>

      <section className="sec cta">
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
