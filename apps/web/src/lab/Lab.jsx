import {useEffect, useRef, useState} from 'react';
import {Link} from '../lib/router.jsx';
import {Logo} from '../components/ui.jsx';
import './lab.css';

/** Five directions for the site, each as a live hero prototype. One WebGL scene runs at a time. */
const DIRECTIONS = [
  {
    id: 'torii', n: '01', name: 'Senbon Torii', jp: '千本鳥居', load: () => import('./torii.js'),
    line: 'An endless path of neon torii over a flooded street. Every gate is a checkpoint; calls are stamped as they pass.',
    refs: 'Fushimi Inari · Ghost in the Shell canals · Blade Runner 2049 · Shopify Editions “Horizons”',
    why: 'Keeps what worked in Shuin (gates, portals, forward flow) and makes it iconic. “A gate for every call” is the product.',
    hero: {pos: 'left', kicker: '見張り MIHARI — a gate for every call', lines: ['EVERY CALL', 'PASSES', 'THE GATE.'], hot: 2},
  },
  {
    id: 'night', n: '02', name: 'Night Line', jp: '夜行線', load: () => import('./night.js'),
    line: 'You ride an elevated maglev through the megacity at night. Stations are chapters; turnstiles are policy; the departure board is the audit log.',
    refs: 'Akira’s elevated rail · Cyberpunk 2077 NCART · Innocence · train-window anime',
    why: 'Cinematic and calm: sideways motion, no falling or zooming, and the window frames the copy naturally.',
    hero: {pos: 'bottom', kicker: '見張り MIHARI — next station', lines: ['NEXT STOP:', 'KNOW YOUR AGENT.'], hot: 1, board: true},
  },
  {
    id: 'ice', n: '03', name: 'Black ICE', jp: '防壁', load: () => import('./ice.js'),
    line: 'Jacked in: the city’s data twin. Agents are packets on data highways; policy is ICE — firewalls that pass a packet or shatter it.',
    refs: 'Neuromancer · Ghost in the Shell net dives · Tron: Legacy · Serial Experiments Lain',
    why: 'The most graphic and legible; the metaphors map one-to-one onto identity, policy and audit.',
    hero: {pos: 'left', kicker: '見張り MIHARI — intrusion countermeasures for agents', lines: ['YOUR AGENTS,', 'BEHIND', 'BLACK ICE.'], hot: 2},
  },
  {
    id: 'spinner', n: '04', name: 'Spinner Flight', jp: '夜間飛行', load: () => import('./spinner.js'),
    line: 'A slow aerial run over the megacity: holograms on the towers, searchlights in the smog, air checkpoints, the one tower everything answers to.',
    refs: 'Blade Runner 2049 opening · Ghost in the Shell (1995) · Cyberpunk: Edgerunners skylines',
    why: 'Maximum scale and awe. The most cinematic, the heaviest to keep premium.',
    hero: {pos: 'center', kicker: '見張り MIHARI', lines: ['A MILLION AGENTS.', 'ONE WATCH.'], hot: 1},
  },
  {
    id: 'artifact', n: '05', name: 'The Artifact', jp: '通行証', load: () => import('./artifact.js'),
    line: 'No world, one exquisite object: the agent’s passport, built in layers (identity, policy, ledger, kill switch) that breathe apart and back. Hold to open it.',
    refs: 'Apple product pages · Lusion · Cyberpunk 2077 item inspection · Linear / Stripe restraint',
    why: 'The most product-led and launchable. Less of a world, more of a beautiful thing.',
    hero: {pos: 'right', kicker: '見張り MIHARI — know your agent', lines: ['THE PASSPORT', 'FOR AI AGENTS.'], hot: 1},
  },
];

const DEBUG = typeof location !== 'undefined' && location.search.includes('debug');

export default function Lab() {
  const [idx, setIdx] = useState(() => { const d = new URLSearchParams(location.search).get('d'); const i = DIRECTIONS.findIndex(x => x.id === d || x.n === d); return i < 0 ? 0 : i; });
  const [notes, setNotes] = useState(true);
  const holder = useRef(null);
  const dir = DIRECTIONS[idx];
  useEffect(() => { document.title = `Lab · ${dir.name} — Mihari`; history.replaceState(null, '', `/lab?d=${dir.id}`); }, [dir]);
  useEffect(() => {
    const on = e => { const k = Number(e.key); if (k >= 1 && k <= DIRECTIONS.length) setIdx(k - 1); if (e.key === 'ArrowRight') setIdx(i => (i + 1) % DIRECTIONS.length); if (e.key === 'ArrowLeft') setIdx(i => (i + DIRECTIONS.length - 1) % DIRECTIONS.length); if (e.key === 'n') setNotes(v => !v); };
    addEventListener('keydown', on); return () => removeEventListener('keydown', on);
  }, []);
  useEffect(() => {
    // a fresh canvas per direction: a WebGL context is never reused across scenes
    const canvas = document.createElement('canvas'); canvas.className = 'lab-canvas'; holder.current.appendChild(canvas);
    let stage = null, live = true;
    dir.load().then(m => { if (live) { stage = m.create(canvas); if (DEBUG) window.__lab = stage; } });
    return () => { live = false; stage?.destroy(); canvas.remove(); };
  }, [dir]);
  const h = dir.hero;
  return (
    <div className={`lab lab-${dir.id}`}>
      <div className="lab-stage" ref={holder} />
      <header className="lab-top">
        <Logo />
        <nav className="lab-tabs" aria-label="Directions">
          {DIRECTIONS.map((d, i) => <button key={d.id} className={i === idx ? 'on' : ''} onClick={() => setIdx(i)}><b>{d.n}</b>{d.name}<span lang="ja">{d.jp}</span></button>)}
        </nav>
        <Link to="/" className="lab-back">Site →</Link>
      </header>
      <section className={`lab-hero pos-${h.pos}`} key={dir.id}>
        <p className="lh-kicker">{h.kicker}</p>
        <h1>{h.lines.map((l, i) => <span key={l} className={i === h.hot ? 'hot' : ''}>{l}</span>)}</h1>
        {h.board && <div className="lh-board"><span>第一駅</span><b>識別 · IDENTIFY</b><em>02 min</em><span>第二駅</span><b>審判 · DECIDE</b><em>05 min</em><span>終点</span><b>中枢 · CORE</b><em>11 min</em></div>}
        <div className="lh-cta"><span className="lh-btn">Open the console →</span><span className="lh-btn ghost">Read the quickstart</span></div>
      </section>
      {notes && (
        <aside className="lab-notes" key={dir.id + 'n'}>
          <p className="ln-n"><b>{dir.n}</b> {dir.name} <span lang="ja">{dir.jp}</span></p>
          <p>{dir.line}</p>
          <p className="ln-refs">{dir.refs}</p>
          <p className="ln-why">{dir.why}</p>
          <p className="ln-keys">1–5 switch · ← → cycle · N hides notes</p>
        </aside>
      )}
    </div>
  );
}
