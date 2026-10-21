import {useCallback, useEffect, useRef, useState, lazy, Suspense} from 'react';
import Lenis from 'lenis';
import {ArrowRight, ShieldCheck} from 'lucide-react';
import {Link} from '../lib/router.jsx';
import {Logo, Code, CopyButton} from '../components/ui.jsx';
import {SNIPPETS} from './snippets.js';
import {Words, useReveal, Counter} from './bits.jsx';
import SectionHead from './SectionHead.jsx';
import Hud, {BEATS} from './Hud.jsx';
import ProductWindow from './ProductWindow.jsx';
import Cases from './Cases.jsx';
import Passport from './Passport.jsx';
import Stack from './Stack.jsx';
import HoloPassport from './HoloPassport.jsx';
import Terminal from './Terminal.jsx';
import Tape from './Tape.jsx';
import '../styles/landing.css';

const Playground = lazy(() => import('./Playground.jsx'));
const webglOk = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };

/** Mounts the 3D city and drives it from scroll. Stages come from [data-stage] elements in document order. */
function useCity(canvasRef, frameApi, handlers) {
  const [mode, setMode] = useState('loading');
  const cityRef = useRef(null);
  const cb = useRef(handlers); cb.current = handlers;

  useEffect(() => {
    if (!webglOk()) { setMode('static'); return undefined; }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let city, lenis, cancelled = false, raf = 0, rafLenis = 0;

    import('./city.js').then(({createCity}) => {
      if (cancelled || !canvasRef.current) return;
      try {
        city = createCity(canvasRef.current, {reduced, small: innerWidth < 760, onDecision: k => cb.current.onDecision?.(k), onFrame: (a, info) => { frameApi.current?.(a, info); cb.current.onFrame?.(info); }});
      } catch (e) { console.error(e); setMode('static'); return; }
      cityRef.current = city;
      if (location.search.includes('debug')) window.__city = city;
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
        city.setStage(f);
        cb.current.onStage?.(f);
      };
      const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
      if (!reduced) {
        lenis = new Lenis({lerp: 0.09, wheelMultiplier: 0.95});
        const loop = t => { lenis.raf(t); rafLenis = requestAnimationFrame(loop); };
        rafLenis = requestAnimationFrame(loop);
        lenis.on('scroll', e => { city.setVelocity(Math.abs(e.velocity) / 40); queue(); });
        window.__lenis = lenis;
      }
      addEventListener('scroll', queue, {passive: true}); addEventListener('resize', queue);
      update();
      city.cleanup = () => { removeEventListener('scroll', queue); removeEventListener('resize', queue); };
    }).catch(e => { console.error(e); setMode('static'); });

    return () => { cancelled = true; cancelAnimationFrame(raf); cancelAnimationFrame(rafLenis); lenis?.destroy(); window.__lenis = null; city?.cleanup?.(); city?.destroy(); };
  }, [canvasRef, frameApi]);
  return {mode, cityRef};
}

const BOOT = ['mounting gatehouse', 'loading policy engine', 'verifying registry key', 'opening corridor'];
function Preloader({ready, onDone}) {
  const [n, setN] = useState(0);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    let raf, v = 0, finished = false;
    const t0 = performance.now();
    const tick = now => {
      v += ((ready && now - t0 > 900 ? 100 : 90) - v) * 0.07;
      setN(Math.min(100, Math.round(v)));
      if (ready && v > 99.4 && !finished) { finished = true; setN(100); setTimeout(() => { setGone(true); setTimeout(onDone, 750); }, 220); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, onDone]);
  return (
    <div className={`pre ${gone ? 'gone' : ''}`} aria-hidden="true">
      <div className="pre-top"><svg width="22" height="22" viewBox="0 0 32 32"><circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="3.2" /><circle cx="16" cy="16" r="3.4" fill="var(--allow)" /></svg> SIGILANT // BOOT</div>
      <ul className="pre-log">{BOOT.map((l, i) => <li key={l} className={n > (i + 1) * 22 ? 'ok' : ''}><b>{n > (i + 1) * 22 ? 'OK' : '..'}</b>{l}</li>)}</ul>
      <b className="pre-n">{String(n).padStart(3, '0')}<small>%</small></b>
      <div className="pre-bar"><i style={{transform: `scaleX(${n / 100})`}} /></div>
    </div>
  );
}

function Nav({revoked}) {
  const [solid, setSolid] = useState(false);
  useEffect(() => { const on = () => setSolid(scrollY > 24); on(); addEventListener('scroll', on, {passive: true}); return () => removeEventListener('scroll', on); }, []);
  const go = id => e => { const el = document.getElementById(id); if (!el) return; e.preventDefault(); window.__lenis ? window.__lenis.scrollTo(el, {offset: -80}) : el.scrollIntoView({behavior: 'smooth'}); };
  return (
    <header className={`nav ${solid ? 'solid' : ''}`}>
      <div className="wrap nav-in">
        <Logo />
        <nav aria-label="Main">
          <a href="#product" onClick={go('product')}>Product</a><a href="#passport" onClick={go('passport')}>Passport</a><a href="#policy" onClick={go('policy')}>Policy</a><a href="#integrate" onClick={go('integrate')}>Integrate</a>
          <Link to="/docs">Docs</Link><Link to="/verify">Verify</Link>
        </nav>
        <span className={`sys ${revoked ? 'red' : ''}`} aria-hidden="true"><i />{revoked ? 'ALERT' : 'ONLINE'}</span>
        <Link to="/app" className="btn sm pill-btn">Open console <ArrowRight size={14} /></Link>
      </div>
    </header>
  );
}

/** Buttons lean toward the cursor. Small, springy, and off for reduced motion. */
function useMagnetic(rootRef) {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || matchMedia('(hover: none)').matches) return undefined;
    const root = rootRef.current;
    const move = e => { const el = e.target.closest?.('.magnetic'); if (!el) return; const r = el.getBoundingClientRect(); el.style.transform = `translate(${((e.clientX - r.left) / r.width - 0.5) * 10}px, ${((e.clientY - r.top) / r.height - 0.5) * 8}px)`; };
    const leave = e => { const el = e.target.closest?.('.magnetic'); if (el) el.style.transform = ''; };
    root.addEventListener('pointermove', move); root.addEventListener('pointerout', leave);
    return () => { root.removeEventListener('pointermove', move); root.removeEventListener('pointerout', leave); };
  }, [rootRef]);
}

/** Cards tilt a few degrees toward the cursor and catch a light. */
function useTilt(rootRef) {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || matchMedia('(hover: none)').matches) return undefined;
    const root = rootRef.current;
    const move = e => {
      const el = e.target.closest?.('.tilt'); if (!el) return;
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--rx', `${(-y * 5).toFixed(2)}deg`); el.style.setProperty('--ry', `${(x * 6).toFixed(2)}deg`);
      el.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(0)}%`); el.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(0)}%`);
    };
    const leave = e => { const el = e.target.closest?.('.tilt'); if (el) { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); } };
    root.addEventListener('pointermove', move); root.addEventListener('pointerout', leave);
    return () => { root.removeEventListener('pointermove', move); root.removeEventListener('pointerout', leave); };
  }, [rootRef]);
}

/** A hairline at the top that fills as you read. */
function useScrollBar(rootRef) {
  useEffect(() => {
    const bar = rootRef.current?.querySelector('.scrollbar i'); if (!bar) return undefined;
    let raf = 0;
    const on = () => { raf = 0; const max = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`; };
    const q = () => { if (!raf) raf = requestAnimationFrame(on); };
    addEventListener('scroll', q, {passive: true}); on();
    return () => removeEventListener('scroll', q);
  }, [rootRef]);
}

const BEAT_COPY = [
  null,
  {n: '01', title: 'IDENTIFY', lead: 'Every agent carries a passport.', body: 'Its own key, a signed identity card, and the name of the person accountable for it. Publish it to the ERC-8004 registry and any service can check it. No more ten agents behind one shared API key.'},
  {n: '02', title: 'DECIDE', lead: 'Every call meets the gate.', body: 'Rules say allow, ask a human, or deny. Budgets and rate limits cap the blast radius when a rule turns out too generous.'},
  {n: '03', title: 'PROVE', lead: 'Every verdict joins the ledger.', body: 'A hash-linked log you can export and verify offline against your registry key. Edit the past and every later block stops matching.'},
  {n: '04', title: 'CONTAIN', lead: 'Revoke once. Closed everywhere.', body: 'Pending approvals are cancelled, the next call is denied, and every service checking status stops trusting the agent. Rotate a leaked key without losing its history.'},
];

export default function Landing() {
  const canvasRef = useRef(null), frameApi = useRef(null), countApi = useRef(null), rootRef = useRef(null);
  const [tab, setTab] = useState('mcp');
  const [beat, setBeat] = useState(0);
  const [revoked, setRevoked] = useState(false);
  const [booted, setBooted] = useState(() => { try { return sessionStorage.getItem('sg.boot') === '1'; } catch { return false; } });
  const countRef = useRef(0);

  const handlers = useRef({
    onStage: f => setBeat(prev => { const b = f >= 5 ? 5 : Math.min(4, Math.round(f)); return prev === b ? prev : b; }),
    onDecision: () => { countRef.current += 1; countApi.current?.(countRef.current); },
    onFrame: info => { const root = rootRef.current; if (root) root.style.setProperty('--alert', info.alert.toFixed(3)); },
  }).current;
  const {mode, cityRef} = useCity(canvasRef, frameApi, handlers);
  useReveal(booted);
  useEffect(() => { document.title = 'Sigilant — Know your agent'; }, []);
  const done = useCallback(() => { setBooted(true); try { sessionStorage.setItem('sg.boot', '1'); } catch { /* private mode */ } }, []);
  useEffect(() => { if (beat !== 4) { setRevoked(false); cityRef.current?.setIris(null); } }, [beat, cityRef]);
  useEffect(() => { if (booted && mode === 'ready') { const t = setTimeout(() => cityRef.current?.intro(), 80); return () => clearTimeout(t); } return undefined; }, [booted, mode, cityRef]);
  useMagnetic(rootRef); useTilt(rootRef); useScrollBar(rootRef);

  const jump = i => { const el = document.querySelector(`[data-stage="${i}"]`); if (el) window.__lenis ? window.__lenis.scrollTo(el, {offset: -(innerHeight - el.offsetHeight) / 2}) : el.scrollIntoView({behavior: 'smooth', block: 'center'}); };
  const toggleIris = () => { const next = !revoked; setRevoked(next); cityRef.current?.setIris(next ? 'closed' : 'open'); };
  const snip = SNIPPETS[tab];

  return (
    <div className={`landing city-${mode} ${booted ? 'booted' : ''}`} ref={rootRef} data-beat={beat}>
      {!booted && <Preloader ready={mode !== 'loading'} onDone={done} />}
      <a className="skip" href="#product">Skip to content</a>
      <div className="scrollbar" aria-hidden="true"><i /></div>
      {mode === 'static' ? <div className="hud static" aria-hidden="true"><div className="static-sun" /></div> : <Hud canvasRef={canvasRef} beat={beat} countApi={countApi} frameApi={frameApi} onJump={jump} revoked={revoked} />}
      <Nav revoked={revoked && beat === 4} />

      <section id="story" className="story">
        <div className="wrap">
          <div className="beat hero-beat" data-stage="0">
            <p className="eyebrow rise"><span className="dot" /> Know your agent</p>
            <h1 className="hero-h1"><Words>Every agent gets an identity.</Words> <span className="alt"><Words>Every action, a verdict.</Words></span></h1>
            <p className="lede rise">Sigilant is the open-source permission layer between AI agents and everything they can touch. A verifiable identity, scoped permissions, human approvals, and an audit trail anyone can check.</p>
            <div className="hero-cta rise">
              <Link to="/app" className="btn pill-btn magnetic">Open the console <ArrowRight size={16} /></Link>
              <Link to="/docs" className="btn ghost pill-btn magnetic">Read the quickstart</Link>
            </div>
            <ul className="standards rise" aria-label="Built on"><li>ERC-8004 identity</li><li>MCP firewall</li><li>Ed25519 assertions</li><li>Self-hosted</li></ul>
          </div>
          <div className="story-copy">
            {BEAT_COPY.slice(1).map((c, i) => (
              <div key={c.n} className="beat" data-stage={i + 1}><div className="sheet panel">
                <p className="eyebrow rise"><b>{c.n}</b><i />{c.title}</p>
                <h2 className="big"><Words>{c.lead}</Words></h2>
                <p className="sub rise">{c.body}</p>
                {i === 3 && (
                  <div className="rise rv-actions">
                    <button className={`btn pill-btn magnetic ${revoked ? 'ghost' : 'danger'}`} onClick={toggleIris}>{revoked ? 'Re-issue research-bot' : 'Revoke research-bot'}</button>
                    <span className={`rv-state ${revoked ? 'off' : 'on'}`}><i />{revoked ? 'REVOKED · every call denied' : 'ACTIVE · calls allowed'}</span>
                  </div>
                )}
              </div></div>
            ))}
          </div>
        </div>
        <div className="handoff" data-stage="5" aria-hidden="true" />
        <Tape />
      </section>

      <section id="product" className="sec" data-stage="6">
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

      <section id="passport" className="sec" data-stage="7">
        <div className="wrap">
          <SectionHead n="03" label="Passport" title="An identity that travels." sub="Each agent’s passport is an ERC-8004 registration file, signed by your registry. Publish it to the public Identity Registry on Base, and any service can look the agent up without trusting your server." />
          <div className="passport-grid">
            <ol className="p-steps">
              <li className="rise"><b>01</b><div><h3>Register</h3><p>Name the agent, set its rules, get its key. The passport is generated for you.</p></div></li>
              <li className="rise"><b>02</b><div><h3>Publish</h3><p>One wallet signature registers it on Base. The file travels inside the transaction, so there is nothing to host and testnet gas is free.</p></div></li>
              <li className="rise"><b>03</b><div><h3>Verify</h3><p>A partner reads the registry, checks the signature, and asks your server whether the agent is still active. Revoke, and every check fails.</p></div></li>
            </ol>
            <div className="rise p-right"><HoloPassport /><Passport /></div>
          </div>
        </div>
      </section>

      <section id="policy" className="sec" data-stage="8">
        <div className="wrap">
          <SectionHead n="04" label="Policy" title="Write the rules. Then try to break them." sub="The same decision code the server runs, in your browser. Pick an agent and click what it tries to do." />
          <div className="rise play-wrap"><Suspense fallback={<div className="play skeleton" />}><Playground /></Suspense></div>
        </div>
      </section>

      <section id="integrate" className="sec" data-stage="9">
        <div className="wrap">
          <SectionHead n="05" label="Integrate" title="Drop it in front of the tools you already use." sub="One config line for any MCP client. An SDK for your own code. Plain REST for everything else." />
          <div className="int-grid rise">
            <div className="int-tabs" role="tablist">
              {Object.entries(SNIPPETS).map(([k, s]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{s.label}</button>)}
              <p className="int-note">{snip.note}</p>
            </div>
            <div className="int-right"><Code title={snip.title}>{snip.code}</Code><Terminal /></div>
          </div>
        </div>
      </section>

      <section className="sec" data-stage="10">
        <div className="wrap">
          <SectionHead n="06" label="Use cases" title="Three jobs it does on day one." />
          <Cases />
        </div>
      </section>

      <section id="stack" className="sec" data-stage="11">
        <div className="wrap">
          <SectionHead n="07" label="Your stack" title="It fits next to what you already run." sub="Identity providers answer who an agent is and which apps it may open. Sigilant answers whether it may do this particular thing right now, and proves what happened." />
          <Stack />
        </div>
      </section>

      <section className="sec" data-stage="12">
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

      <section className="cta" id="start" data-stage="13">
        <div className="wrap">
          <div className="cta-beat">
            <p className="eyebrow rise"><span className="dot" /> Get started</p>
            <h2 className="huge"><Words>Run it in a minute.</Words></h2>
            <p className="sub rise">One process, one folder. No account, no database, no paid service.</p>
            <div className="cta-code rise"><Code title="terminal" plain>{`git clone https://github.com/sigilant/sigilant && cd sigilant
npm --prefix apps/web install && npm run build
npm start      # → http://127.0.0.1:5055`}</Code></div>
            <div className="hero-cta rise"><Link to="/app" className="btn pill-btn magnetic">Open the console <ArrowRight size={16} /></Link><Link to="/verify" className="btn ghost pill-btn magnetic">Verify an agent</Link></div>
          </div>
        </div>
      </section>

      <footer className="foot">
        <div className="wrap foot-in"><Logo /><span>Know your agent.</span><nav aria-label="Footer"><Link to="/docs">Docs</Link><Link to="/verify">Verify</Link><Link to="/app">Console</Link><a href="/llms.txt">llms.txt</a></nav></div>
      </footer>
    </div>
  );
}
