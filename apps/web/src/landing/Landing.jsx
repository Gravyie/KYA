import {useCallback, useEffect, useRef, useState} from 'react';
import Lenis from 'lenis';
import {ArrowRight, ShieldCheck} from 'lucide-react';
import {Link} from '../lib/router.jsx';
import {Logo, Mark, Code, CopyButton} from '../components/ui.jsx';
import {SNIPPETS, DECISIONS} from './snippets.js';
import {Words, useReveal, Counter} from './bits.jsx';
import SectionHead from './SectionHead.jsx';
import Hud from './Hud.jsx';
import Magi from './Magi.jsx';
import Chain from './Chain.jsx';
import ProductWindow from './ProductWindow.jsx';
import Cases from './Cases.jsx';
import Passport from './Passport.jsx';
import Stack from './Stack.jsx';
import HoloPassport from './HoloPassport.jsx';
import Terminal from './Terminal.jsx';
import '../styles/landing.css';

const webglOk = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };

/** Mounts the 3D world and drives it from scroll. Stages come from [data-stage] elements. */
function useWorld(canvasRef, frameApi, handlers) {
  const [mode, setMode] = useState('loading');
  const worldRef = useRef(null);
  const cb = useRef(handlers); cb.current = handlers;

  useEffect(() => {
    if (!webglOk()) { setMode('static'); return undefined; }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let world, lenis, cancelled = false, raf = 0, rafLenis = 0;

    import('./world.js').then(({createWorld}) => {
      if (cancelled || !canvasRef.current) return;
      try {
        world = createWorld(canvasRef.current, {reduced, small: innerWidth < 760, onDecision: k => cb.current.onDecision?.(k), onFrame: (a, info) => { frameApi.current?.(a, info); cb.current.onFrame?.(info); }});
      } catch (e) { console.error(e); setMode('static'); return; }
      worldRef.current = world;
      if (location.search.includes('debug')) window.__world = world;
      setMode('ready');

      // Stage centres are measured once (and on resize), then mapped from scrollY: no layout reads while scrolling.
      let centers = [];
      const measure = () => {
        const beats = [...document.querySelectorAll('[data-stage]')].sort((a, b) => a.dataset.stage - b.dataset.stage);
        centers = beats.map(el => { const r = el.getBoundingClientRect(); return r.top + scrollY + r.height / 2; });
      };
      const update = () => {
        raf = 0;
        if (!centers.length) return;
        const mid = scrollY + innerHeight * 0.5;
        let f = 0;
        if (mid >= centers.at(-1)) f = centers.length - 1;
        else if (mid > centers[0]) for (let i = 0; i < centers.length - 1; i++) {
          if (mid >= centers[i] && mid < centers[i + 1]) { f = i + (mid - centers[i]) / (centers[i + 1] - centers[i]); break; }
        }
        world.setStage(f);
        cb.current.onStage?.(f);
      };
      const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
      if (!reduced) {
        lenis = new Lenis({lerp: 0.085, wheelMultiplier: 0.9});
        const loop = t => { lenis.raf(t); rafLenis = requestAnimationFrame(loop); };
        rafLenis = requestAnimationFrame(loop);
        lenis.on('scroll', e => { world.setVelocity(Math.abs(e.velocity) / 40); queue(); });
        window.__lenis = lenis;
      }
      const remeasure = () => { measure(); queue(); };
      const ro = new ResizeObserver(remeasure); ro.observe(document.body);
      addEventListener('scroll', queue, {passive: true});
      measure(); update();
      world.cleanup = () => { removeEventListener('scroll', queue); ro.disconnect(); };
    }).catch(e => { console.error(e); setMode('static'); });

    return () => { cancelled = true; cancelAnimationFrame(raf); cancelAnimationFrame(rafLenis); lenis?.destroy(); window.__lenis = null; world?.cleanup?.(); world?.destroy(); };
  }, [canvasRef, frameApi]);
  return {mode, worldRef};
}

const BOOT = [
  ['見張り MIHARI', 'watch kernel 0.2 · tty0'],
  ['ok', 'registry mounted'],
  ['ok', 'policy engine · default deny'],
  ['ok', 'audit chain verified · sha-256'],
  ['..', 'opening the eye'],
];

/** The opening, part one: a terminal boots while the world loads. Part two (the city decoding out of
 *  glyphs, the eye opening in the sky) is played by the world itself. */
function Opening({phase}) {
  return (
    <div className={`opening op-${phase}`} aria-hidden="true">
      <div className="op-term">
        <Mark size={44} live />
        {BOOT.map(([k, v], i) => <p key={v} style={{'--d': `${0.15 + i * 0.26}s`}}><b className={k === 'ok' ? 'ok' : k === '..' ? 'wait' : ''}>{k === 'ok' || k === '..' ? `[ ${k} ]` : k}</b> {v}</p>)}
        <i className="op-cursor" />
      </div>
      <p className="op-cap"><span lang="ja">見張り</span> MIHARI<em>{phase === 'loading' ? 'booting' : 'click to skip'}</em></p>
    </div>
  );
}

function Nav({alert}) {
  const [solid, setSolid] = useState(false);
  useEffect(() => { const on = () => setSolid(scrollY > 24); on(); addEventListener('scroll', on, {passive: true}); return () => removeEventListener('scroll', on); }, []);
  const go = id => e => { const el = document.getElementById(id); if (!el) return; e.preventDefault(); window.__lenis ? window.__lenis.scrollTo(el, {offset: -80}) : el.scrollIntoView({behavior: 'smooth'}); };
  return (
    <header className={`nav ${solid ? 'solid' : ''}`}>
      <div className="wrap nav-in">
        <Logo />
        <nav aria-label="Main">
          <a href="#identify" onClick={go('identify')}>Story</a><a href="#decide" onClick={go('decide')}>Policy</a><a href="#passport" onClick={go('passport')}>Passport</a><a href="#integrate" onClick={go('integrate')}>Integrate</a>
          <Link to="/docs">Docs</Link><Link to="/verify">Verify</Link>
        </nav>
        <span className={`sys ${alert ? 'red' : ''}`} aria-hidden="true"><i />{alert ? '封鎖 LOCKDOWN' : '稼働 ONLINE'}</span>
        <Link to="/app" className="btn sm">Console <ArrowRight size={14} /></Link>
      </div>
    </header>
  );
}

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

function useTilt(rootRef) {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || matchMedia('(hover: none)').matches) return undefined;
    const root = rootRef.current;
    const move = e => {
      const el = e.target.closest?.('.tilt'); if (!el) return;
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`); el.style.setProperty('--ry', `${(x * 8).toFixed(2)}deg`);
      el.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(0)}%`); el.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(0)}%`);
    };
    const leave = e => { const el = e.target.closest?.('.tilt'); if (el) { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); } };
    root.addEventListener('pointermove', move); root.addEventListener('pointerout', leave);
    return () => { root.removeEventListener('pointermove', move); root.removeEventListener('pointerout', leave); };
  }, [rootRef]);
}

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

export default function Landing() {
  const canvasRef = useRef(null), frameApi = useRef(null), countApi = useRef(null), rootRef = useRef(null), tickRef = useRef(null);
  const [tab, setTab] = useState('mcp');
  const [beat, setBeat] = useState(0);
  const [revoked, setRevoked] = useState(false);
  const [alert, setAlert] = useState(false);
  const [booted, setBooted] = useState(() => { try { return sessionStorage.getItem('mihari.boot') === '1'; } catch { return false; } });
  const countRef = useRef(0), lastTick = useRef(0);

  const handlers = useRef({
    onStage: f => setBeat(prev => { const b = f >= 4.6 ? 5 : Math.round(f); return prev === b ? prev : b; }),
    onDecision: kind => {
      countRef.current += 1; countApi.current?.(countRef.current);
      const now = performance.now(); if (now - lastTick.current < 1200 || !tickRef.current) return; lastTick.current = now;
      const pool = DECISIONS[kind]; const el = tickRef.current;
      el.dataset.kind = kind; el.querySelector('b').textContent = kind === 'allow' ? '可決 ALLOW' : kind === 'ask' ? '保留 ASK' : '否決 DENY'; el.querySelector('code').textContent = pool[Math.floor(Math.random() * pool.length)];
      el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    },
    onFrame: info => { const a = info.alert > 0.5; setAlert(prev => (prev === a ? prev : a)); },
  }).current;
  const {mode, worldRef} = useWorld(canvasRef, frameApi, handlers);
  useReveal(booted);
  useEffect(() => { document.title = 'Mihari 見張り — Know your agent'; }, []);
  const done = useCallback(() => { setBooted(true); try { sessionStorage.setItem('mihari.boot', '1'); } catch { /* private mode */ } }, []);
  useEffect(() => { if (beat !== 4) { setRevoked(false); worldRef.current?.setIris(null); } }, [beat, worldRef]);
  // the opening plays once per session: a terminal boots, the city decodes out of glyphs, the eye in the sky opens
  const [opening, setOpening] = useState(() => (booted ? 'off' : 'loading'));
  const [bootRead, setBootRead] = useState(false);   // the boot lines get time to be read, however fast the world loads
  useEffect(() => { const t = setTimeout(() => setBootRead(true), 1700); return () => clearTimeout(t); }, []);
  useEffect(() => {
    if (opening !== 'loading') return;
    if (mode === 'static') { setOpening('off'); done(); return; }
    if (mode !== 'ready' || !bootRead) return;
    scrollTo(0, 0); window.__lenis?.stop();
    setOpening('playing');
    worldRef.current.intro(() => { window.__lenis?.start(); setOpening('off'); done(); });
  }, [mode, opening, worldRef, done, bootRead]);
  useEffect(() => {
    if (opening !== 'playing') return undefined;
    const skip = () => worldRef.current?.skipIntro();
    const evs = ['pointerdown', 'wheel', 'keydown', 'touchstart'];
    evs.forEach(e => addEventListener(e, skip, {passive: true}));
    return () => evs.forEach(e => removeEventListener(e, skip));
  }, [opening, worldRef]);
  useMagnetic(rootRef); useTilt(rootRef); useScrollBar(rootRef);

  const jump = i => { const el = document.querySelector(`[data-stage="${i}"]`); if (el) window.__lenis ? window.__lenis.scrollTo(el, {offset: -(innerHeight - el.offsetHeight) / 2}) : el.scrollIntoView({behavior: 'smooth', block: 'center'}); };
  const toggleIris = () => { const next = !revoked; setRevoked(next); worldRef.current?.setIris(next ? 'closed' : 'open'); };
  const snip = SNIPPETS[tab];

  return (
    <div className={`landing w-${mode} ${booted ? 'booted' : ''} ${alert ? 'is-alert' : ''} ${opening !== 'off' ? 'is-opening' : ''}`} ref={rootRef} data-end={beat >= 5 ? '1' : '0'}>
      {opening !== 'off' && <Opening phase={opening} />}
      <a className="skip" href="#console">Skip to content</a>
      <div className="scrollbar" aria-hidden="true"><i /></div>
      {mode === 'static' ? <div className="hud static" aria-hidden="true"><div className="static-sun" /></div> : <Hud canvasRef={canvasRef} beat={beat} countApi={countApi} frameApi={frameApi} onJump={jump} alert={alert} />}
      <Nav alert={alert} />

      {/* ── Scene 1: the watch ── */}
      <section className="hero mh" data-stage="0">
        <div className="wrap mh-in">
          <p className="mh-kicker rise"><span className="dot" /><span lang="ja">見張り</span> MIHARI — the open-source lookout for AI agents</p>
          <h1 className="mh-title" aria-label="Every agent. Every action. Watched.">
            <span className="mh-l"><Words>EVERY AGENT.</Words></span>
            <span className="mh-l"><Words>EVERY ACTION.</Words></span>
            <span className="mh-l mh-w" data-text="WATCHED."><Words>WATCHED.</Words></span>
          </h1>
          <p className="mh-sub rise">Mihari gives each AI agent a verifiable identity, checks every tool call before it runs — allow it, ask a human, or block it — and keeps a record nobody can quietly edit.</p>
          <div className="mh-cta rise">
            <Link to="/app" className="btn magnetic">Open the console <ArrowRight size={16} /></Link>
            <Link to="/docs" className="btn ghost magnetic">Read the quickstart</Link>
          </div>
        </div>
        <div className="mh-hud" aria-hidden="true">
          <span className="mh-live"><i />MONITORING · LIVE</span>
          <span className="mh-jp" lang="ja">汝の代理人を知れ</span>
        </div>
        <div className="ticker" ref={tickRef} data-kind="allow" aria-hidden="true"><b>可決 ALLOW</b><code>read_file workspace/q3-report.md</code><em>live sim</em></div>
      </section>

      <div className="tapes" aria-hidden="true">
        <div className="tape t1"><div>{'ROGUE TOOL CALL BLOCKED // 否決 // KNOW YOUR AGENT // 認証済み // EVERY ACTION GETS A VERDICT // '.repeat(4)}</div></div>
        <div className="tape t2"><div>{'CAUTION // AGENTS AT WORK // 注意 // SCOPED KEYS ONLY // HUMAN IN THE LOOP // '.repeat(4)}</div></div>
      </div>

      <section id="identify" className="scene" data-stage="1">
        <span className="scene-kanji" lang="ja" aria-hidden="true">識別</span>
        <div className="wrap"><div className="sheet rise">
          <p className="eyebrow"><b>01</b><i />第一話 · Identity</p>
          <h2 className="big"><Words>Every agent carries a pass.</Words></h2>
          <p className="sub">No more ten agents behind one shared API key. Each agent gets its own key, a signed identity card, and the name of the person who answers for it. Publish the pass to the ERC-8004 registry and any service can check it without trusting your server.</p>
          <ul className="specs"><li><b>Ed25519</b> signed card</li><li><b>256-bit</b> keys, stored as hashes</li><li><b>ERC-8004</b> on-chain identity</li></ul>
        </div></div>
      </section>

      <section id="decide" className="scene scene-wide" data-stage="2">
        <span className="scene-kanji" lang="ja" aria-hidden="true">審判</span>
        <div className="wrap">
          <div className="decide-head rise">
            <p className="eyebrow"><b>02</b><i />第二話 · Policy</p>
            <h2 className="big"><Words>Every call meets the eye.</Words></h2>
            <p className="sub">Three checks run before any tool does: is the agent still who it says, does a rule allow this action on this resource, and is it within budget and rate. The answer is allow, ask a human, or block. This panel runs the same decision code as the server.</p>
          </div>
          <div className="rise has-sticker"><span className="sticker s-a">Live engine · try me</span><Magi /></div>
        </div>
      </section>

      <section id="prove" className="scene" data-stage="3">
        <span className="scene-kanji" lang="ja" aria-hidden="true">記録</span>
        <div className="wrap"><div className="sheet sheet-wide rise">
          <p className="eyebrow"><b>03</b><i />第三話 · Audit</p>
          <h2 className="big"><Words>Every verdict joins the ledger.</Words></h2>
          <p className="sub">Each event carries the hash of the one before it, so editing the past breaks every link after it. Export the log and verify it offline against your registry key. Below is a real SHA-256 chain running in your browser.</p>
          <span className="sticker s-b">Tamper with it</span>
          <Chain />
        </div></div>
      </section>

      <section id="contain" className="scene" data-stage="4">
        <span className="scene-kanji red" lang="ja" aria-hidden="true">封鎖</span>
        <div className="wrap"><div className={`sheet sheet-alert rise ${revoked ? 'on' : ''}`}>
          <div className="hazard" aria-hidden="true" />
          <p className="eyebrow"><b>04</b><i />第四話 · Revoke</p>
          <h2 className="big"><Words>Revoke once. Closed everywhere.</Words></h2>
          <p className="sub">One switch: pending approvals are cancelled, the next call is refused, and every service that checks the agent's status stops trusting it. A leaked key can be rotated without losing the agent's history.</p>
          <div className="rv-actions"><span className="sticker s-c">Pull the plug</span>
            <button className={`btn magnetic ${revoked ? 'ghost' : 'danger'}`} onClick={toggleIris}>{revoked ? 'Re-issue research-bot' : 'Revoke research-bot'}</button>
            <span className={`rv-state ${revoked ? 'off' : 'on'}`}><i />{revoked ? 'REVOKED · 封鎖' : 'ACTIVE · 稼働'}</span>
          </div>
        </div></div>
      </section>

      <div className="lower">
        <section id="console" className="sec" data-stage="5">
          <div className="wrap">
            <SectionHead n="05" label="控室 · Console" title="See every call. Approve the risky ones." sub="The console is where a human stays in the loop: live activity, one-click approvals, the audit log, and the switch that revokes." />
            <div className="rise"><ProductWindow /></div>
          </div>
        </section>

        <section id="passport" className="sec" data-stage="6">
          <div className="wrap">
            <SectionHead n="06" label="通行証 · Passport" title="An identity that travels." sub="Each agent’s pass is an ERC-8004 registration file signed by your registry. One wallet signature publishes it to the public Identity Registry on Base, with nothing to host." />
            <div className="passport-grid">
              <div className="p-left">
                <HoloPassport />
                <ol className="p-steps">
                  <li className="rise"><b>01</b><div><h3>Register</h3><p>Name the agent, set its rules, get its key. The pass is generated for you.</p></div></li>
                  <li className="rise"><b>02</b><div><h3>Publish</h3><p>One wallet signature on Base. The file travels inside the transaction; testnet gas is free.</p></div></li>
                  <li className="rise"><b>03</b><div><h3>Verify</h3><p>A partner reads the registry, checks the signature, asks whether the agent is still active.</p></div></li>
                </ol>
              </div>
              <div className="rise"><Passport /></div>
            </div>
          </div>
        </section>

        <section id="integrate" className="sec" data-stage="7">
          <div className="wrap">
            <SectionHead n="07" label="接続 · Integrate" title="Drop it in front of the tools you already use." sub="One config line for any MCP client. An SDK for your own code. Plain REST for everything else." />
            <div className="int-grid rise">
              <div className="int-tabs" role="tablist">
                {Object.entries(SNIPPETS).map(([k, s]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{s.label}</button>)}
                <p className="int-note">{snip.note}</p>
              </div>
              <div className="int-right"><Code title={snip.title}>{snip.code}</Code><Terminal /></div>
            </div>
          </div>
        </section>

        <section className="sec" data-stage="8">
          <div className="wrap">
            <SectionHead n="08" label="用途 · Use cases" title="Three jobs it does on day one." />
            <Cases />
          </div>
        </section>

        <section id="stack" className="sec" data-stage="9">
          <div className="wrap">
            <SectionHead n="09" label="構成 · Your stack" title="It fits next to what you already run." sub="Identity providers answer who an agent is and which apps it may open. Mihari answers whether it may do this particular thing right now, and proves what happened." />
            <Stack />
            <dl className="numbers">
              <div className="rise"><dt><Counter to={0} /></dt><dd>runtime dependencies in the server</dd></div>
              <div className="rise"><dt><Counter to={256} suffix="-bit" /></dt><dd>keys, stored only as hashes</dd></div>
              <div className="rise"><dt><Counter to={15} prefix="≤" suffix="min" /></dt><dd>lifetime of an identity assertion</dd></div>
              <div className="rise"><dt><Counter to={3} /></dt><dd>verdicts: allow, ask, deny</dd></div>
            </dl>
            <div className="trust-in">
              <ul className="facts rise">
                <li><ShieldCheck size={16} /> Ed25519 signatures and a SHA-256 hash chain, nothing exotic.</li>
                <li><ShieldCheck size={16} /> Zero-dependency server. Your data is a folder on your machine.</li>
                <li><ShieldCheck size={16} /> MIT licensed. No telemetry, no account, no paid service.</li>
              </ul>
              <div className="limits rise"><p className="eyebrow">但し書き · Honest limits</p><p>Mihari decides and records. It cannot stop a tool that skips the check, so enforce at the tool or MCP layer. Receipts are agent-reported. The log is tamper-evident against a known head, not a distributed ledger.</p></div>
            </div>
          </div>
        </section>
      </div>

      <section className="finale mh-fin" data-stage="10">
        <div className="wrap fin-in">
          <p className="mh-kicker rise"><span lang="ja">見張り</span> You are inside the watch now</p>
          <h2 className="mh-title fin-t" aria-label="Know your agent."><span className="mh-l"><Words>KNOW YOUR</Words></span><span className="mh-l mh-w" data-text="AGENT."><Words>AGENT.</Words></span></h2>
          <p className="mh-sub rise">Self-hosted in a minute. One process, one folder, no account and no paid service.</p>
          <div className="mh-cta rise">
            <Link to="/app" className="btn magnetic">Open the console <ArrowRight size={16} /></Link>
            <Link to="/docs" className="btn ghost magnetic">Read the quickstart</Link>
          </div>
          <div className="install rise"><span>$</span><code>git clone https://github.com/mihari-dev/mihari && cd mihari && npm start</code><CopyButton text="git clone https://github.com/mihari-dev/mihari && cd mihari && npm --prefix apps/web install && npm run build && npm start" /></div>
        </div>
        <footer className="foot">
          <div className="wrap foot-in">
            <Logo />
            <span className="foot-tag">Know your agent · MIT licensed</span>
            <nav aria-label="Footer"><Link to="/docs">Docs</Link><Link to="/verify">Verify an agent</Link><Link to="/app">Console</Link><a href="/llms.txt">llms.txt</a></nav>
          </div>
        </footer>
      </section>
    </div>
  );
}
