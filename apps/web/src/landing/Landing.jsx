import {useCallback, useEffect, useRef, useState} from 'react';
import {useChapterScroll} from './useChapterScroll.js';
import {ArrowRight, ShieldCheck, Menu, X} from 'lucide-react';
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
  const [graphicsLost, setGraphicsLost] = useState(false);
  const cb = useRef(handlers); cb.current = handlers;

  useEffect(() => {
    if (graphicsLost || !webglOk()) { setMode('static'); return undefined; }
    setMode('loading');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let world, cancelled = false, raf = 0;
    const canvas = canvasRef.current;
    const contextLost = e => { e.preventDefault(); setGraphicsLost(true); };
    canvas?.addEventListener('webglcontextlost', contextLost);

    import('./journey.js').then(({createWorld}) => {
      if (cancelled || !canvasRef.current) return;
      try {
        world = createWorld(canvasRef.current, {reduced, small: innerWidth < 760, onDecision: k => cb.current.onDecision?.(k), onPassState: open => cb.current.onPassState?.(open), onFrame: (a, info) => { frameApi.current?.(a, info); cb.current.onFrame?.(info); }});
      } catch (e) { console.error(e); setMode('static'); return; }
      worldRef.current = world;
      if (import.meta.env.DEV && location.search.includes('debug')) window.__world = world;
      setMode('ready');

      // Stage centres are measured once (and on resize), then mapped from scrollY: no layout reads while scrolling.
      let centers = [], stops = [], mobileStory = false;
      const measure = () => {
        const beats = [...document.querySelectorAll('[data-stage]')].sort((a, b) => a.dataset.stage - b.dataset.stage);
        const bounds=beats.map(el=>{const r=el.getBoundingClientRect();return {top:r.top+scrollY,height:r.height,entry:el.hasAttribute('data-entry'),snap:el.hasAttribute('data-snap')};});
        centers=bounds.map(r=>r.top+(r.entry?Math.min(r.height,innerHeight):r.height)/2);
        mobileStory=innerWidth<=960&&matchMedia('(pointer: coarse)').matches;
        stops=bounds.map(r=>{
          const start=r.entry?r.top:r.snap?r.top-Math.max(0,(innerHeight-r.height)/2):r.top+r.height/2-innerHeight/2;
          return {start:Math.max(0,start),end:r.snap&&!r.entry?Math.max(start,r.top+r.height-innerHeight):start};
        });
      };
      const update = () => {
        raf = 0;
        if (!centers.length) return;
        const mid = scrollY + innerHeight * 0.5;
        let f = 0;
        if(mobileStory){
          // Hold the camera at its chapter while a phone reader scrolls tall content.
          // Only the travel between chapter edges changes the camera; interior reading stays continuous.
          const y=scrollY;f=stops.length-1;
          for(let i=0;i<stops.length;i++){
            if(y<=stops[i].end){f=i;break;}
            if(stops[i+1]&&y<stops[i+1].start){f=i+(y-stops[i].end)/(stops[i+1].start-stops[i].end);break;}
          }
        }else if (mid >= centers.at(-1)) f = centers.length - 1;
        else if (mid > centers[0]) for (let i = 0; i < centers.length - 1; i++) {
          if (mid >= centers[i] && mid < centers[i + 1]) { f = i + (mid - centers[i]) / (centers[i + 1] - centers[i]); break; }
        }
        world.setStage(f);
        cb.current.onStage?.(f);
      };
      const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
      const lenis=window.__lenis;
      const onVelocity=e=>{world.setVelocity(Math.abs(e.velocity)/40);queue();};
      lenis?.on('scroll',onVelocity);
      const cancelPassport=()=>world.passInput('cancel');
      addEventListener('wardrail:cancel-passport-drag',cancelPassport);
      const remeasure = () => { measure(); queue(); };
      addEventListener('resize',remeasure);
      const ro = new ResizeObserver(remeasure); ro.observe(document.body);
      addEventListener('scroll', queue, {passive: true});
      measure(); update();
      world.cleanup = () => { removeEventListener('resize',remeasure); removeEventListener('scroll', queue); ro.disconnect();lenis?.off('scroll',onVelocity);removeEventListener('wardrail:cancel-passport-drag',cancelPassport); };
    }).catch(e => { console.error(e); setMode('static'); });

    return () => { cancelled = true; canvas?.removeEventListener('webglcontextlost', contextLost); cancelAnimationFrame(raf); world?.cleanup?.(); world?.destroy(); worldRef.current = null; if (import.meta.env.DEV) delete window.__world; };
  }, [canvasRef, frameApi, graphicsLost]);
  return {mode, worldRef};
}

/** Covers the page while the world loads; then the stack powers up behind it, floor by floor. */
function Opening({phase}) {
  return (
    <div className={`opening op-${phase}`}>
      <div className="op-load">
        <Mark size={56} live />
        <p>WARDRAIL</p>
        <i className="op-bar" aria-hidden="true"><b /></i>
        <em role="status">{phase === 'loading' ? 'Preparing the city' : 'Entering Wardrail'}</em>
      </div>
    </div>
  );
}

/** The passport's stage: the left half of its chapter. Drag turns it, a click opens it, hovering scans it. */
function PassStage({worldRef, open}) {
  const last = useRef(null);
  const send = (kind, e) => {
    const w = worldRef.current; if (!w) return;
    if (kind === 'down') { last.current = {x: e.clientX, y: e.clientY}; e.currentTarget.setPointerCapture?.(e.pointerId); }
    let dx = 0, dy = 0;
    if (kind === 'drag') { if (!last.current) return; dx = e.clientX - last.current.x; dy = e.clientY - last.current.y; last.current = {x: e.clientX, y: e.clientY}; }
    if (kind === 'up' || kind === 'cancel') last.current = null;
    w.passInput?.(kind, dx, dy);
  };
  return (
    <div className="pass-stage" onPointerEnter={e => send('enter', e)} onPointerLeave={e => send('leave', e)} onPointerDown={e => send('down', e)} onPointerMove={e => send('drag', e)} onPointerUp={e => send('up', e)} onPointerCancel={e => send('cancel', e)}
      onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); worldRef.current?.passInput('down'); worldRef.current?.passInput('up'); } }} role="button" tabIndex={0} aria-label="The agent passport. Drag to turn it, click to open its layers." aria-pressed={open}>
      <span className="pass-hint"><i />{open ? 'Click to close · drag to turn' : 'Drag to turn · click to open'}</span>
    </div>
  );
}

function Nav({alert}) {
  const [solid, setSolid] = useState(false);
  const [active,setActive]=useState(null),[menuOpen,setMenuOpen]=useState(false);
  const menuButton=useRef(null);
  useEffect(()=>{
    const sections=[['.hero',null],['#identify','story'],['#gate','story'],['#decide','policy'],['#prove','story'],['#contain','story'],['#console',null],['#passport','passport'],['#integrate','integrate'],['#stack',null],['.finale',null]];
    const names=new Map();const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)setActive(names.get(entry.target));},{rootMargin:'-30% 0px -50% 0px'});
    sections.forEach(([selector,name])=>{const el=document.querySelector(selector);if(el){names.set(el,name);observer.observe(el);}});
    return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(!menuOpen)return;
    const close=e=>{if(e.key==='Escape'){setMenuOpen(false);menuButton.current?.focus();}else if(e.type==='pointerdown'&&!e.target.closest('.nav'))setMenuOpen(false);};
    document.addEventListener('keydown',close);document.addEventListener('pointerdown',close);
    return()=>{document.removeEventListener('keydown',close);document.removeEventListener('pointerdown',close);};
  },[menuOpen]);
  useEffect(() => { const on = () => setSolid(scrollY > 24); on(); addEventListener('scroll', on, {passive: true}); return () => removeEventListener('scroll', on); }, []);
  const go = id => e => { setMenuOpen(false); const el = document.getElementById(id); if (!el) return; e.preventDefault(); window.__lenis ? window.__lenis.scrollTo(el, {offset: el.hasAttribute('data-snap') ? 0 : -80}) : el.scrollIntoView({behavior: 'smooth'}); };
  return (
    <header className={`nav ${solid ? 'solid' : ''}`}>
      <div className="wrap nav-in">
        <Logo />
        <nav aria-label="Main">
          <a href="#identify" aria-current={active==='story'?'location':undefined} onClick={go('identify')}>Story</a><a href="#decide" aria-current={active==='policy'?'location':undefined} onClick={go('decide')}>Policy</a><a href="#passport" aria-current={active==='passport'?'location':undefined} onClick={go('passport')}>Passport</a><a href="#integrate" aria-current={active==='integrate'?'location':undefined} onClick={go('integrate')}>Integrate</a>
          <Link to="/docs">Docs</Link><Link to="/verify">Verify</Link>
        </nav>
        <span className={`sys ${alert ? 'red' : ''}`} aria-hidden="true"><i />{alert ? '封鎖 LOCKDOWN' : 'DEMO ACTIVE'}</span>
        <Link to="/app" className="btn sm">Console <ArrowRight size={14} /></Link>
        <button className="mobile-menu-toggle" ref={menuButton} type="button" aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen?'Close navigation':'Open navigation'} onClick={()=>setMenuOpen(v=>!v)}>{menuOpen?<X size={20}/>:<Menu size={20}/>}</button>
        <nav id="mobile-navigation" className={`mobile-links ${menuOpen?'open':''}`} data-lenis-prevent aria-label="Mobile navigation" hidden={!menuOpen}>
          <a href="#identify" onClick={go('identify')}>Story</a><a href="#decide" onClick={go('decide')}>Policy</a><a href="#passport" onClick={go('passport')}>Passport</a><a href="#integrate" onClick={go('integrate')}>Integrate</a>
          <Link to="/docs" onClick={()=>setMenuOpen(false)}>Docs</Link><Link to="/verify" onClick={()=>setMenuOpen(false)}>Verify an agent</Link>
        </nav>
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
  useChapterScroll();
  const canvasRef = useRef(null), frameApi = useRef(null), countApi = useRef(null), rootRef = useRef(null), tickRef = useRef(null);
  const [tab, setTab] = useState('mcp');
  const [beat, setBeat] = useState(0);
  const [revoked, setRevoked] = useState(false);
  const [alert, setAlert] = useState(false);
  const [passportOpen, setPassportOpen] = useState(false);
  const [booted, setBooted] = useState(() => { try { return sessionStorage.getItem('mihari.boot') === '1'; } catch { return false; } });
  const countRef = useRef(0), lastTick = useRef(0);

  const handlers = useRef({
    onPassState: setPassportOpen,
    onStage: f => setBeat(prev => { const b = Math.round(f); return prev === b ? prev : b; }),
    onDecision: kind => {
      countRef.current += 1; countApi.current?.(countRef.current);
      const now = performance.now(); if (now - lastTick.current < 2200 || !tickRef.current) return; lastTick.current = now;
      const pool = DECISIONS[kind]; const el = tickRef.current;
      el.dataset.kind = kind; el.querySelector('b').textContent = kind === 'allow' ? '可決 ALLOW' : kind === 'ask' ? '保留 ASK' : '否決 DENY'; el.querySelector('code').textContent = pool[Math.floor(Math.random() * pool.length)];
      el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    },
    onFrame: info => { if(info.accent&&rootRef.current&&rootRef.current.dataset.chapterAccent!==info.accent){rootRef.current.dataset.chapterAccent=info.accent;rootRef.current.style.setProperty('--chapter-accent','#'+info.accent);} const a = info.alert > 0.5; setAlert(prev => (prev === a ? prev : a)); },
  }).current;
  const {mode, worldRef} = useWorld(canvasRef, frameApi, handlers);
  useReveal(booted);
  useEffect(() => { document.title = 'Wardrail | Identity and permissions for AI agents'; }, []);
  const done = useCallback(() => { setBooted(true); try { sessionStorage.setItem('mihari.boot', '1'); } catch { /* private mode */ } }, []);
  useEffect(() => { if (beat !== 5) { setRevoked(false); worldRef.current?.setIris(null); } }, [beat, worldRef]);
  // the opening plays once per session: the city fades up out of the dark
  const [opening, setOpening] = useState(() => (booted ? 'off' : 'loading'));
  useEffect(() => {
    if (mode === 'static') { setOpening('off'); done(); return; }
    if (opening !== 'loading') return;
    if (mode !== 'ready') return;
    scrollTo(0, 0); window.__lenis?.stop();
    setOpening('playing');
    worldRef.current.intro(() => { window.__lenis?.start(); setOpening('off'); done(); });
  }, [mode, opening, worldRef, done]);
  useEffect(() => {
    if (opening !== 'playing') return undefined;
    const skip = () => worldRef.current?.skipIntro();
    const evs = ['pointerdown', 'wheel', 'keydown', 'touchstart'];
    evs.forEach(e => addEventListener(e, skip, {passive: true}));
    return () => evs.forEach(e => removeEventListener(e, skip));
  }, [opening, worldRef]);
  useMagnetic(rootRef); useTilt(rootRef); useScrollBar(rootRef);

  const jump = i => { const el = document.querySelector(`[data-stage="${i}"]`); if (el) window.__lenis ? window.__lenis.scrollTo(el, {offset: el.hasAttribute('data-entry') ? 0 : -(innerHeight - el.offsetHeight) / 2}) : el.scrollIntoView({behavior: 'smooth', block: el.hasAttribute('data-entry') ? 'start' : 'center'}); };
  const toggleIris = () => { const next = !revoked; setRevoked(next); worldRef.current?.setIris(next ? 'closed' : 'open'); };
  const snip = SNIPPETS[tab];

  return (
    <div className={`landing w-${mode} ${booted ? 'booted' : ''} ${alert ? 'is-alert' : ''} ${opening !== 'off' ? 'is-opening' : ''}`} ref={rootRef} data-end={beat >= 6 ? '1' : '0'} data-beat={beat}>
      {opening !== 'off' && <Opening phase={opening} />}
      <a className="skip" href="#console">Skip to content</a>
      <div className="scrollbar" aria-hidden="true"><i /></div>
      {mode === 'static' && <div className="hud static" aria-hidden="true"><div className="static-sun" /></div>}
      <Hud canvasRef={canvasRef} beat={beat} countApi={countApi} frameApi={frameApi} onJump={jump} alert={alert} />
      <Nav alert={alert} />

      {/* ── Scene 1: the city from the air ── */}
      <section className="hero mh" data-snap data-stage="0">
        <div className="wrap mh-in">
          <p className="mh-kicker rise"><span className="dot" /><span>WARDRAIL</span> / the permission layer for AI agents</p>
          <h1 className="mh-title" aria-label="AI agents. Your rules.">
            <span className="mh-l"><Words>AI AGENTS.</Words></span>
            <span className="mh-l mh-w" data-text="YOUR RULES."><Words>YOUR RULES.</Words></span>
          </h1>
          <p className="mh-sub rise">Connect Wardrail between your agents and their tools. Give each agent its own identity, limit what it can do, and require human approval for sensitive actions. Every decision leaves a verifiable record.</p>
          <div className="mh-cta rise">
            <Link to="/app" className="btn magnetic">Open the console <ArrowRight size={16} /></Link>
            <Link to="/docs" className="btn ghost magnetic">Read the quickstart</Link>
          </div>
        </div>
        <div className="mh-hud" aria-hidden="true">
          <span className="mh-live"><i />MONITORING · LIVE</span>
          <span className="particle-hint">Move to disturb<br />Hold to attract</span>
        </div>
        <div className="ticker" ref={tickRef} data-kind="allow" aria-hidden="true"><b>可決 ALLOW</b><code>read_file workspace/q3-report.md</code><em>live sim</em></div>
      </section>

      <div className="tapes" aria-hidden="true">
        <div className="tape t1"><div>{'ROGUE TOOL CALL BLOCKED // 否決 // KNOW YOUR AGENT // 認証済み // EVERY ACTION GETS A VERDICT // '.repeat(4)}</div></div>
        <div className="tape t2"><div>{'CAUTION // AGENTS AT WORK // 注意 // SCOPED KEYS ONLY // HUMAN IN THE LOOP // '.repeat(4)}</div></div>
      </div>

      <section id="identify" className="scene scene-right" data-snap data-stage="1">
        <span className="scene-kanji" lang="ja" aria-hidden="true">識別</span>
        <PassStage worldRef={worldRef} open={passportOpen} />
        <div className="wrap"><div className="sheet rise">
          <p className="eyebrow"><b>01</b><i />第一話 · Identity</p>
          <h2 className="big"><Words>Know which agent is acting.</Words></h2>
          <p className="sub">Shared API keys hide who did what. Wardrail gives every agent a separate key and a signed passport naming its operator. Rotate or revoke one agent without disrupting the others. Publish its identity on-chain when partners need a public record.</p>
          <ul className="specs"><li><b>Ed25519</b> signed card</li><li><b>256-bit</b> keys, stored as hashes</li><li><b>ERC-8004</b> on-chain identity</li></ul>
        </div></div>
      </section>

      {/* ── the great gate: no panels, nothing in the way ── */}
      <section id="gate" className="scene scene-gate" data-snap data-stage="2">
        <div className="wrap gate-card rise">
          <p className="eyebrow"><b>02</b><i />大鳥居 · The gate</p>
          <p className="gate-line"><span lang="ja">関門</span> A request is not permission. Check the agent, the action, and its limits before a connected tool runs.</p>
        </div>
      </section>

      <section id="decide" className="scene scene-wide" data-snap data-stage="3">
        <span className="scene-kanji" lang="ja" aria-hidden="true">審判</span>
        <div className="wrap">
          <div className="decide-head rise">
            <p className="eyebrow"><b>02</b><i />第二話 · Policy</p>
            <h2 className="big"><Words>Decide before the tool runs.</Words></h2>
            <p className="sub">Allow routine work. Pause sensitive actions for a human. Deny the rest. Try the policy engine with the requests below.</p>
          </div>
          <div className="rise has-sticker"><span className="sticker s-a">Interactive policy demo</span><Magi /></div>
        </div>
      </section>

      <section id="prove" className="scene" data-snap data-stage="4">
        <span className="scene-kanji" lang="ja" aria-hidden="true">記録</span>
        <div className="wrap"><div className="sheet sheet-wide rise">
          <p className="eyebrow"><b>03</b><i />第三話 · Audit</p>
          <h2 className="big"><Words>An audit trail you can verify.</Words></h2>
          <p className="sub">Investigate a decision without piecing together chat logs. Wardrail records policy decisions and reported outcomes in a hash-linked ledger. Export it and verify its integrity offline against a trusted chain head. Change an event below to see how tampering is detected.</p>
          <span className="sticker s-b">Test the audit chain</span>
          <Chain />
        </div></div>
      </section>

      <section id="contain" className="scene" data-snap data-stage="5">
        <span className="scene-kanji red" lang="ja" aria-hidden="true">封鎖</span>
        <div className="wrap"><div className="sheet sheet-alert rise" data-revoked={revoked ? 'true' : 'false'}>
          <div className="hazard" aria-hidden="true" />
          <p className="eyebrow"><b>04</b><i />第四話 · Revoke</p>
          <h2 className="big"><Words>Stop an agent. Keep its history.</Words></h2>
          <p className="sub">Revoke a compromised agent to cancel pending approvals and refuse its next authorization request. Connected services can check its live status. Rotate a leaked key while keeping the same agent identity and audit history.</p>
          <div className="rv-actions"><span className="sticker s-c">Try revocation</span>
            <button className={`btn magnetic ${revoked ? 'ghost' : 'danger'}`} onClick={toggleIris}>{revoked ? 'Reset demo agent' : 'Revoke workspace-agent'}</button>
            <span className={`rv-state ${revoked ? 'off' : 'on'}`}><i />{revoked ? 'REVOKED · 封鎖' : 'ACTIVE · 稼働'}</span>
          </div>
        </div></div>
      </section>

      <div className="lower">
        <section id="console" className="sec" data-snap data-entry data-stage="6">
          <div className="wrap">
            <SectionHead n="05" label="控室 · Console" title="One place to oversee your agents." sub="Review authorization requests, approve sensitive actions, inspect the audit trail, and revoke credentials. This interactive preview shows the operator workflow." />
            <div className="rise"><ProductWindow /></div>
          </div>
        </section>

        <section id="passport" className="sec" data-stage="7">
          <div className="wrap">
            <SectionHead n="06" label="通行証 · Passport" title="Give partners a verifiable identity." sub="Signed passports identify the agent and its operator. Short-lived, audience-bound assertions let a partner verify the signature and check live revocation. ERC-8004 publication is optional; tool permissions work without a wallet." />
            <div className="passport-grid">
              <div className="p-left">
                <HoloPassport />
                <ol className="p-steps">
                  <li className="rise"><b>01</b><div><h3>Register</h3><p>Name the agent, set its rules, get its key. The pass is generated for you.</p></div></li>
                  <li className="rise"><b>02</b><div><h3>Publish, optionally</h3><p>Register on Base when you need a public identity. Try Base Sepolia with test ETH. Your tool permissions work without publishing.</p></div></li>
                  <li className="rise"><b>03</b><div><h3>Verify</h3><p>A partner reads the registry, checks the signature, asks whether the agent is still active.</p></div></li>
                </ol>
              </div>
              <div className="rise"><Passport /></div>
            </div>
          </div>
        </section>

        <section id="integrate" className="sec" data-stage="8">
          <div className="wrap">
            <SectionHead n="07" label="接続 · Integrate" title="Enforce permissions where tools run." sub="Wrap an MCP server to block denied calls before forwarding them. Use the Node SDK to guard your own functions, or call the REST API from another language. Keep your current models and tools." />
            <div className="int-grid rise">
              <div className="int-tabs" role="tablist">
                {Object.entries(SNIPPETS).map(([k, s]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{s.label}</button>)}
                <p className="int-note">{snip.note}</p>
              </div>
              <div className="int-right"><Code title={snip.title}>{snip.code}</Code><Terminal /></div>
            </div>
          </div>
        </section>

        <section className="sec" data-stage="9">
          <div className="wrap">
            <SectionHead n="08" label="用途 · Use cases" title="Let agents work. Set the boundaries." sub="Protect source code, cap spending, and verify service-to-service identity with explicit policies and a human approval path." />
            <Cases />
          </div>
        </section>

        <section id="stack" className="sec" data-stage="10">
          <div className="wrap">
            <SectionHead n="09" label="構成 · Your stack" title="It fits next to what you already run." sub="Identity providers answer who an agent is and which apps it may open. Wardrail answers whether it may do this particular thing right now, and records the decision." />
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
              <div className="limits rise"><p className="eyebrow">但し書き · Honest limits</p><p>Wardrail decides and records. It cannot stop a tool that skips the check, so enforce at the tool or MCP layer. Receipts are agent-reported. The log is tamper-evident against a known head, not a distributed ledger.</p></div>
            </div>
          </div>
        </section>
      </div>

      <section className="finale mh-fin" data-stage="11">
        <div className="wrap fin-in">
          <p className="mh-kicker rise"><span>WARDRAIL</span> Know your agent</p>
          <h2 className="mh-title fin-t" aria-label="Put your agents behind a policy."><span className="mh-l"><Words>AGENTS WORK.</Words></span><span className="mh-l mh-w" data-text="YOU DECIDE."><Words>YOU DECIDE.</Words></span></h2>
          <p className="mh-sub rise">Start with one agent and one policy. Run Wardrail on your own infrastructure: an open-source Node server, local file storage, and no vendor account or paid service required.</p>
          <div className="mh-cta rise">
            <Link to="/app" className="btn magnetic">Open the console <ArrowRight size={16} /></Link>
            <Link to="/docs" className="btn ghost magnetic">Read the quickstart</Link>
          </div>
          <div className="install rise"><span>$</span><code>git clone https://github.com/Gravyie/KYA.git && cd KYA && npm --prefix apps/web ci && npm run build && npm start</code><CopyButton text="git clone https://github.com/Gravyie/KYA.git && cd KYA && npm --prefix apps/web install && npm run build && npm start" /></div>
        </div>
        <footer className="foot">
          <div className="wrap foot-in">
            <Logo />
            <span className="foot-tag">Agent identity, permissions & audit · MIT licensed</span>
            <nav aria-label="Footer"><Link to="/docs">Docs</Link><Link to="/verify">Verify an agent</Link><Link to="/app">Console</Link><a href="/llms.txt">llms.txt</a></nav>
          </div>
        </footer>
      </section>
    </div>
  );
}
