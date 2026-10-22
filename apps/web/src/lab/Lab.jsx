import {useEffect, useRef, useState} from 'react';
import {Link} from '../lib/router.jsx';
import {Logo} from '../components/ui.jsx';
import './lab.css';

/** Seventeen directions for the site, each as a live hero prototype. One WebGL scene runs at a time. */
const D = (id, n, name, jp, load, line, refs, why, hero) => ({id, n, name, jp, load, line, refs, why, hero});
const DIRECTIONS = [
  D('torii', '01', 'Senbon Torii', '千本鳥居', () => import('./torii.js'),
    'An endless path of neon torii over a flooded street. Every gate is a checkpoint; calls are stamped as they pass.',
    'Fushimi Inari · Ghost in the Shell canals · Blade Runner 2049 · Shopify Editions “Horizons”',
    'Keeps what worked in Shuin (gates, portals, forward flow) and makes it iconic. “A gate for every call” is the product.',
    {pos: 'left', kicker: '見張り MIHARI — a gate for every call', lines: ['EVERY CALL', 'PASSES', 'THE GATE.'], hot: 2}),
  D('night', '02', 'Night Line', '夜行線', () => import('./night.js'),
    'You ride an elevated maglev through the megacity at night. Stations are chapters; turnstiles are policy; the departure board is the audit log.',
    'Akira’s elevated rail · Cyberpunk 2077 NCART · Innocence · train-window anime',
    'Cinematic and calm: sideways motion, no falling or zooming, and the window frames the copy naturally.',
    {pos: 'bottom', kicker: '見張り MIHARI — next station', lines: ['NEXT STOP:', 'KNOW YOUR AGENT.'], hot: 1, board: true}),
  D('ice', '03', 'Black ICE', '防壁', () => import('./ice.js'),
    'Jacked in: the city’s data twin. Agents are packets on data highways; policy is ICE, firewalls that pass a packet or shatter it.',
    'Neuromancer · Ghost in the Shell net dives · Tron: Legacy · Serial Experiments Lain',
    'The most graphic and legible; the metaphors map one-to-one onto identity, policy and audit.',
    {pos: 'left', kicker: '見張り MIHARI — intrusion countermeasures for agents', lines: ['YOUR AGENTS,', 'BEHIND', 'BLACK ICE.'], hot: 2, tone: 'cyan'}),
  D('spinner', '04', 'Spinner Flight', '夜間飛行', () => import('./spinner.js'),
    'A slow aerial run over the megacity: holograms on the towers, searchlights in the smog, air checkpoints, the one tower everything answers to.',
    'Blade Runner 2049 opening · Ghost in the Shell (1995) · Cyberpunk: Edgerunners skylines',
    'Maximum scale and awe. The most cinematic, the heaviest to keep premium.',
    {pos: 'center', kicker: '見張り MIHARI', lines: ['A MILLION AGENTS.', 'ONE WATCH.'], hot: 1}),
  D('artifact', '05', 'The Artifact', '通行証', () => import('./artifact.js'),
    'No world, one exquisite object: the agent’s passport, built in layers (identity, policy, ledger, kill switch) that breathe apart and back. Hold to open it.',
    'Apple product pages · Lusion · Cyberpunk 2077 item inspection · Linear / Stripe restraint',
    'The most product-led and launchable. Less of a world, more of a beautiful thing.',
    {pos: 'right', kicker: '見張り MIHARI — know your agent', lines: ['THE PASSPORT', 'FOR AI AGENTS.'], hot: 1}),
  D('nerv', '06', 'NERV Command', '作戦司令', () => import('./nerv.js'),
    'An Evangelion ops room: a tactical holo-map in amber, agents as markers tethered to the MAGI core. When one trips an alert, its link snaps and the map blooms red.',
    'Neon Genesis Evangelion (NERV, MAGI, title cards) · Ghost in the Shell HUDs · Cyberpunk 2077 UI',
    'Graphic, fast, unmistakable; the product reads as mission control, which is what a console for agents is.',
    {pos: 'left', kicker: '見張り MIHARI — 第壱話', lines: ['PATTERN RED.', 'KNOW YOUR', 'AGENT.'], hot: 0, tone: 'amber'}),
  D('canyon', '07', 'Checkpoint Canyon', '関門峡谷', () => import('./canyon.js'),
    'The early corridor, reworked: a fast low flight down a flooded neon canyon through endless ring gates, each iris flashing the verdict of the call flying through it.',
    'Blade Runner · Akira light trails · Shuin v7/v10 · Shopify Editions “Horizons”',
    'The immersion you liked in the tunnel versions, cleaner and faster, with the verdicts built into the rings.',
    {pos: 'left', kicker: '見張り MIHARI — every call, judged', lines: ['EVERY CALL', 'GETS A', 'VERDICT.'], hot: 2}),
  D('glyphs', '08', 'Glyph City', '文字都市', () => import('./glyphs.js'),
    'The city as the network sees it: every tower built of raining katakana, streams with bright heads and fading tails, reflected in a black flood.',
    'The Matrix code rain · Ghost in the Shell “city is information” · Lain · text-vision (v17)',
    'The text-vision idea grown into a whole world: agents are text, so is the city.',
    {pos: 'center', kicker: '見張り MIHARI', lines: ['THE NETWORK', 'IS WATCHING.'], hot: 1, tone: 'green'}),
  D('swarm', '09', 'Swarm', '群れ', () => import('./swarm.js'),
    'Every agent at once: tens of thousands of points flowing like a murmuration through one gate. Allowed fan out, held ones orbit amber, denied ones scatter red.',
    'Starling murmurations · Refik Anadol data sculptures · Arrival · GPU particle art',
    'Pure spectacle that is also the product in one image: scale, flow, judgement.',
    {pos: 'left', kicker: '見張り MIHARI — every agent, one gate', lines: ['A MILLION', 'AGENTS.', 'ONE GATE.'], hot: 2, tone: 'cyan'}),
  D('stamp', '10', '朱印 Stamp', '朱印', () => import('./stamp.js'),
    'Shuin as a monument: a giant lacquered vermilion seal slams onto a rainy neon street. Shockwave, ink, and the verdict burned into the asphalt.',
    'Japanese seal culture (朱印) · Shuin v8/v9 · Akira impact frames · Blade Runner street level',
    'Brings back the seal you liked as the single physical gesture of “a verdict was signed”.',
    {pos: 'left', kicker: '見張り MIHARI — signed, sealed, recorded', lines: ['EVERY ACTION,', 'SEALED.'], hot: 1, tone: 'red'}),
  D('outrun', '11', 'Outrun Checkpoint', '検問', () => import('./outrun.js'),
    'Synthwave, reworked: a highway into a banded sun between wireframe mountains, cars meeting a neon toll gate that lifts green or flashes red.',
    'Outrun · Kavinsky / Drive · Shopify Editions “Horizons” · v11 synthwave',
    'Joyful and instantly readable; the toll gate is the simplest possible picture of policy.',
    {pos: 'center', kicker: '見張り MIHARI', lines: ['NO AGENT', 'PASSES', 'UNCHECKED.'], hot: 2}),
  D('android', '12', 'Android Customs', '入国審査', () => import('./android.js'),
    'Agents as androids queuing through a scanner arch. The laser sheet strips the shell to an x-ray (circuitry, core, spine), then flags them PASS or DENY.',
    'Ghost in the Shell opening · Ex Machina · Detroit: Become Human · airport security',
    'The most human metaphor: you see what you are letting in, inside and out.',
    {pos: 'left', kicker: '見張り MIHARI — agent customs', lines: ['SEE WHAT', 'YOU’RE LETTING', 'THROUGH.'], hot: 2, tone: 'cyan'}),
  D('ledger', '13', 'Ledger Monolith', '台帳', () => import('./ledger.js'),
    'The audit log as architecture: a spiral tower of glass hash-blocks chained by light. Edit the past and the red runs up through every block after it.',
    '2001 monolith · Blame! megastructure · blockchain explorers · glass architecture',
    'Makes tamper-evidence visible and beautiful: the strongest single image for “nobody can quietly edit it”.',
    {pos: 'right', kicker: '見張り MIHARI — tamper-evident by design', lines: ['EVERY VERDICT,', 'CHAINED.'], hot: 1, tone: 'cyan'}),
  D('alley', '14', 'Back Alley', '裏路地', () => import('./alley.js'),
    'Street level in a Kowloon night market: signs jutting out at every height, lanterns on cables, steam, puddles. Every shop is a service your agent might call.',
    'Kowloon Walled City · Ghost in the Shell street scenes · Blade Runner 2049 · Shenmue',
    'Warm and human; the “services your agents call” idea becomes a place you walk through.',
    {pos: 'left', kicker: '見張り MIHARI — the city runs on agents', lines: ['THE CITY', 'RUNS ON AGENTS.', 'KNOW YOURS.'], hot: 2}),
  D('orbit', '15', 'Low Orbit', '低軌道', () => import('./orbit.js'),
    'The night side of the Earth: cities as grids of light, agent traffic arcing between them, and a ring of watch satellites sweeping the surface.',
    'Stripe / GitHub globes · Planetes · Interstellar · city-lights-at-night photography',
    'Scale and seriousness; reads as infrastructure, and as watching over everything.',
    {pos: 'left', kicker: '見張り MIHARI — every agent, everywhere', lines: ['EVERY AGENT', 'ON EARTH,', 'ACCOUNTED FOR.'], hot: 2, tone: 'cyan'}),
  D('broadcast', '16', 'Broadcast', '電波ジャック', () => import('./broadcast.js'),
    'A pirate-TV takeover: a curved wall of CRTs, each its own feed (logs, test cards, radar, a face being scanned), glitching into sync as one giant screen.',
    'Max Headroom · Akira TV walls · Paprika · Nam June Paik',
    'Loud and memorable; the console’s live activity becomes a wall of screens.',
    {pos: 'bottom', kicker: '見張り MIHARI — we interrupt this agent', lines: ['WE INTERRUPT', 'THIS AGENT.'], hot: 1}),
  D('wormhole', '17', 'Wormhole', '超空間', () => import('./wormhole.js'),
    'The portal tunnel, rebuilt: an endless curving tube of hex plating, data streaks racing past, iris gates opening ahead. The speed surges; the cursor steers.',
    'Shuin portals · 2001 stargate · Tron: Legacy · Interstellar wormhole',
    'Pure velocity; the most immersive way to say “straight through the gate, if you are allowed”.',
    {pos: 'center', kicker: '見張り MIHARI', lines: ['STRAIGHT', 'THROUGH', 'THE GATE.'], hot: 2, tone: 'cyan'}),
];

const DEBUG = typeof location !== 'undefined' && location.search.includes('debug');

export default function Lab() {
  const [idx, setIdx] = useState(() => { const d = new URLSearchParams(location.search).get('d'); const i = DIRECTIONS.findIndex(x => x.id === d || x.n === d); return i < 0 ? 0 : i; });
  const [notes, setNotes] = useState(() => innerWidth >= 760);
  const holder = useRef(null);
  const dir = DIRECTIONS[idx];
  useEffect(() => { document.title = `Lab · ${dir.name} — Mihari`; history.replaceState(null, '', `/lab?d=${dir.id}`); }, [dir]);
  useEffect(() => {
    const on = e => { const k = Number(e.key); if (k >= 1 && k <= 9) setIdx(k - 1); if (e.key === 'ArrowRight') setIdx(i => (i + 1) % DIRECTIONS.length); if (e.key === 'ArrowLeft') setIdx(i => (i + DIRECTIONS.length - 1) % DIRECTIONS.length); if (e.key === 'n') setNotes(v => !v); };
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
    <div className={`lab lab-${dir.id} tone-${h.tone || 'mag'}`}>
      <div className="lab-stage" ref={holder} />
      <header className="lab-top">
        <Logo />
        <p className="lab-title"><b>{dir.n}</b> {dir.name} <span lang="ja">{dir.jp}</span><em>{idx + 1} / {DIRECTIONS.length}</em></p>
        <Link to="/" className="lab-back">Site →</Link>
      </header>
      <section className={`lab-hero pos-${h.pos}`} key={dir.id}>
        <p className="lh-kicker">{h.kicker}</p>
        <h1>{h.lines.map((l, i) => <span key={l} className={i === h.hot ? 'hot' : ''}>{l}</span>)}</h1>
        {h.board && <div className="lh-board"><span>第一駅</span><b>識別 · IDENTIFY</b><em>02 min</em><span>第二駅</span><b>審判 · DECIDE</b><em>05 min</em><span>終点</span><b>中枢 · CORE</b><em>11 min</em></div>}
        <div className="lh-cta"><span className="lh-btn">Open the console →</span><span className="lh-btn ghost">Read the quickstart</span></div>
      </section>
      <nav className="lab-strip" aria-label="Directions">
        {DIRECTIONS.map((d, i) => <button key={d.id} className={i === idx ? 'on' : ''} onClick={() => setIdx(i)} title={d.name}><img src={`/lab/thumbs/${d.id}.jpg`} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} /><b>{d.n}</b><span>{d.name}</span></button>)}
      </nav>
      {notes && (
        <aside className="lab-notes" key={dir.id + 'n'}>
          <p className="ln-n"><b>{dir.n}</b> {dir.name} <span lang="ja">{dir.jp}</span></p>
          <p>{dir.line}</p>
          <p className="ln-refs">{dir.refs}</p>
          <p className="ln-why">{dir.why}</p>
          <p className="ln-keys">← → or the strip to switch · 1–9 jump · N hides notes</p>
        </aside>
      )}
    </div>
  );
}
