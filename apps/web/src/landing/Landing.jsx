import {useEffect, useRef, useState, lazy, Suspense} from 'react';
import {ArrowRight, Fingerprint, ScanLine, ScrollText, ShieldCheck, Wallet, GitBranch, Handshake} from 'lucide-react';
import {Link} from '../lib/router.jsx';
import {Logo, Code, CopyButton} from '../components/ui.jsx';
import {SNIPPETS, DECISIONS} from './snippets.js';
import '../styles/landing.css';

const Playground = lazy(() => import('./Playground.jsx'));

function webglOk() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

/** Mounts the 3D gate behind the page and drives it from scroll position. */
function useGate(canvasRef, onDecision) {
  const [mode, setMode] = useState('loading');
  const decisionRef = useRef(onDecision);
  decisionRef.current = onDecision;

  useEffect(() => {
    if (!webglOk()) { setMode('static'); return; }
    let scene, cancelled = false, raf = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    import('./scene.js').then(({createScene}) => {
      if (cancelled || !canvasRef.current) return;
      try {
        scene = createScene(canvasRef.current, {reduced, small: innerWidth < 760, onDecision: k => decisionRef.current?.(k)});
      } catch { setMode('static'); return; }
      setMode('ready');
      const update = () => {
        raf = 0;
        const stages = [...document.querySelectorAll('[data-stage]')];
        if (!stages.length) return;
        const mid = innerHeight * 0.5;
        const centers = stages.map(el => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; });
        let f = 0;
        if (mid <= centers[0]) f = 0;
        else if (mid >= centers.at(-1)) f = stages.length - 1;
        else for (let i = 0; i < centers.length - 1; i++) {
          if (mid >= centers[i] && mid < centers[i + 1]) { f = i + (mid - centers[i]) / (centers[i + 1] - centers[i]); break; }
        }
        scene.setStage(f);
      };
      const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
      addEventListener('scroll', queue, {passive: true}); addEventListener('resize', queue);
      update();
      scene.cleanup = () => { removeEventListener('scroll', queue); removeEventListener('resize', queue); };
    }).catch(() => setMode('static'));
    return () => { cancelled = true; cancelAnimationFrame(raf); scene?.cleanup?.(); scene?.destroy(); };
  }, [canvasRef]);
  return mode;
}

function Nav() {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(scrollY > 24);
    on(); addEventListener('scroll', on, {passive: true});
    return () => removeEventListener('scroll', on);
  }, []);
  return (
    <header className={`nav ${solid ? 'solid' : ''}`}>
      <div className="wrap nav-in">
        <Logo />
        <nav aria-label="Main">
          <a href="#how">How it works</a>
          <a href="#try">Try policy</a>
          <a href="#integrate">Integrate</a>
          <Link to="/docs">Docs</Link>
          <Link to="/verify">Verify</Link>
        </nav>
        <Link to="/app" className="btn sm">Open console <ArrowRight size={14} /></Link>
      </div>
    </header>
  );
}

function Ticker({items}) {
  return (
    <ol className="ticker" aria-label="Illustrative stream of agent decisions">
      {items.map(it => (
        <li key={it.id} className={it.kind}>
          <span className="tk-badge">{it.kind === 'allow' ? 'Allow' : it.kind === 'ask' ? 'Ask' : 'Deny'}</span>
          <span className="tk-text">{it.text}</span>
        </li>
      ))}
      <li className="tk-note">Illustrative stream</li>
    </ol>
  );
}

function Install() {
  const cmd = 'SIGILANT_AGENT_KEY=sga_… node packages/mcp/bin/sigilant-mcp.js -- <your mcp server>';
  return (
    <div className="install">
      <code>{cmd}</code>
      <CopyButton text={cmd} />
    </div>
  );
}

const STEPS = [
  {icon: Fingerprint, n: '01', title: 'Identify', body: 'Each agent gets its own key and a signed identity card naming the human accountable for it. No more ten agents behind one shared API key.'},
  {icon: ScanLine, n: '02', title: 'Decide', body: 'Every tool call asks first. Rules say allow, ask a human, or deny. Budgets and rate limits cap the blast radius when a rule is too generous.'},
  {icon: ScrollText, n: '03', title: 'Prove', body: 'Each decision joins a hash-linked log. Export it, and anyone can verify it offline against your registry key. Edits show.'},
];

const CASES = [
  {icon: GitBranch, tag: 'Coding agents', title: 'Let it work in the repo, not in your secrets.', body: 'Put the MCP firewall in front of filesystem and shell servers. Reads in the repo are free, .env is denied, pushes wait for you.', rules: ['read_file · repo/*', 'deny · repo/.env*', 'ask · git.push']},
  {icon: Wallet, tag: 'Spending agents', title: 'Give an ops agent a card with a ceiling.', body: 'Small invoices go through. Anything over $100 pauses for approval. A daily budget stops the rest, even if a rule was too loose.', rules: ['allow · ≤ $100', 'ask · ≤ $500', 'budget · $500 / 24h']},
  {icon: Handshake, tag: 'Agents calling services', title: 'Prove who you are to the other side.', body: 'Agents mint short-lived signed assertions for a specific audience. Partners verify them in six lines and see who is accountable. Revoke, and every check fails.', rules: ['assertion · aud: partner.com', 'operator · Acme Inc.', 'status · live check']},
];

export default function Landing() {
  const canvasRef = useRef(null);
  const [feed, setFeed] = useState([]);
  const last = useRef(0);
  const [tab, setTab] = useState('mcp');
  const onDecision = kind => {
    const now = performance.now();
    if (now - last.current < 850) return;
    last.current = now;
    const pool = DECISIONS[kind];
    setFeed(f => [{id: now, kind, text: pool[Math.floor(Math.random() * pool.length)]}, ...f].slice(0, 4));
  };
  const mode = useGate(canvasRef, onDecision);
  const snip = SNIPPETS[tab];

  useEffect(() => {
    document.title = 'Sigilant — Know your agent';
    const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('in')), {threshold: 0.15});
    document.querySelectorAll('.rise').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className={`landing gate-${mode}`}>
      <canvas ref={canvasRef} className="stage" aria-hidden="true" />
      {mode === 'static' && <div className="stage-fallback" aria-hidden="true"><i /></div>}
      <Nav />

      <section className="hero" data-stage="0">
        <div className="wrap hero-in">
          <div className="hero-copy">
            <p className="eyebrow rise">Know your agent</p>
            <h1 className="rise">Every agent gets an identity. Every action gets a <span className="serif">verdict.</span></h1>
            <p className="lede rise">Sigilant is the open-source permission layer between your AI agents and everything they can touch. Scoped keys, human approvals, spend limits, and an audit trail anyone can verify.</p>
            <div className="hero-cta rise">
              <Link to="/app" className="btn">Open the console <ArrowRight size={16} /></Link>
              <Link to="/docs" className="btn ghost">Read the quickstart</Link>
            </div>
            <div className="rise"><Install /></div>
          </div>
        </div>
        <div className="wrap hero-foot"><Ticker items={feed} /><span className="scroll-cue">Scroll</span></div>
      </section>

      <section className="sec problem" data-stage="1">
        <div className="wrap">
          <p className="eyebrow rise">The gap</p>
          <h2 className="big rise">Agents hold real keys now. They read your files, spend your money and send your email on <span className="serif">one shared credential</span> and a polite system prompt.</h2>
          <div className="trio">
            <p className="rise"><b>No identity.</b> Ten agents, one API key. When something is deleted nobody can say which agent did it.</p>
            <p className="rise"><b>No enforcement.</b> “Never touch production” in a prompt is a suggestion. A policy engine is a wall.</p>
            <p className="rise"><b>No evidence.</b> Logs on the same box the agent can reach are logs it can lose. You want a record nobody could quietly edit.</p>
          </div>
        </div>
      </section>

      <section id="how" className="sec how" data-stage="2">
        <div className="wrap how-in">
          <div className="how-copy">
            <p className="eyebrow rise">How it works</p>
            <h2 className="big rise">One gate between the agent and the world.</h2>
            <ol className="steps">
              {STEPS.map(s => (
                <li key={s.n} className="rise">
                  <span className="step-n">{s.n}</span>
                  <div><h3><s.icon size={18} strokeWidth={1.8} /> {s.title}</h3><p>{s.body}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="try" className="sec try" data-stage="3">
        <div className="wrap">
          <p className="eyebrow rise">Live policy engine</p>
          <h2 className="big rise">Write the rules. <span className="serif">Break them.</span></h2>
          <p className="sub rise">This is the same decision code the server runs, in your browser. Pick an agent, then click what it tries to do.</p>
          <div className="rise"><Suspense fallback={<div className="play skeleton" />}><Playground /></Suspense></div>
        </div>
      </section>

      <section id="integrate" className="sec integrate" data-stage="4">
        <div className="wrap">
          <p className="eyebrow rise">Integrate in minutes</p>
          <h2 className="big rise">Drop it in front of the tools you already use.</h2>
          <div className="int-grid rise">
            <div className="int-tabs" role="tablist">
              {Object.entries(SNIPPETS).map(([k, s]) => (
                <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{s.label}</button>
              ))}
              <p className="int-note">{snip.note}</p>
            </div>
            <Code title={snip.title}>{snip.code}</Code>
          </div>
        </div>
      </section>

      <section className="sec cases">
        <div className="wrap">
          <p className="eyebrow rise">Built for</p>
          <h2 className="big rise">Three jobs it does on day one.</h2>
          <div className="case-grid">
            {CASES.map(c => (
              <article key={c.tag} className="case rise">
                <c.icon size={20} strokeWidth={1.7} />
                <p className="eyebrow">{c.tag}</p>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
                <ul>{c.rules.map(r => <li key={r}>{r}</li>)}</ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sec revoke" data-stage="5">
        <div className="wrap revoke-in">
          <div className="revoke-copy">
            <p className="eyebrow rise">Revocation</p>
            <h2 className="big rise">Revoke once. <span className="serif">Closed everywhere.</span></h2>
            <p className="sub rise">Kill an agent from the console. Pending approvals are cancelled, its next call is denied, and every service that checks its status stops accepting its assertions. Rotate a leaked key without losing the agent’s history.</p>
          </div>
        </div>
      </section>

      <section className="sec trust">
        <div className="wrap trust-in">
          <div>
            <p className="eyebrow rise">Boring where it matters</p>
            <h2 className="big rise">Small, auditable, yours.</h2>
          </div>
          <ul className="facts rise">
            <li><ShieldCheck size={16} /> Ed25519 signatures and a SHA-256 hash chain, nothing exotic.</li>
            <li><ShieldCheck size={16} /> Zero-dependency server. Your data is a folder on your machine.</li>
            <li><ShieldCheck size={16} /> MIT licensed. No telemetry, no account, no paid service.</li>
          </ul>
          <div className="limits rise">
            <p className="eyebrow">Honest limits</p>
            <p>Sigilant decides and records. It cannot stop a tool that skips the check, so enforce at the tool or MCP layer. Outcome receipts are agent-reported. The log is tamper-evident against a known head, not a distributed ledger.</p>
          </div>
        </div>
      </section>

      <section className="sec cta" data-stage="6">
        <div className="wrap cta-in">
          <h2 className="huge rise">Know your <span className="serif">agent.</span></h2>
          <p className="sub rise">One process, one folder, a minute to run.</p>
          <div className="cta-code rise">
            <Code title="terminal" plain>{`git clone https://github.com/sigilant/sigilant && cd sigilant
npm --prefix apps/web install && npm run build
npm start      # → http://127.0.0.1:5055`}</Code>
          </div>
          <div className="hero-cta rise center">
            <Link to="/app" className="btn">Open the console <ArrowRight size={16} /></Link>
            <Link to="/verify" className="btn ghost">Verify an agent</Link>
          </div>
        </div>
      </section>

      <footer className="foot">
        <div className="wrap foot-in">
          <Logo />
          <span>Know your agent.</span>
          <nav aria-label="Footer"><Link to="/docs">Docs</Link><Link to="/verify">Verify</Link><Link to="/app">Console</Link><a href="/llms.txt">llms.txt</a></nav>
        </div>
      </footer>
    </div>
  );
}
