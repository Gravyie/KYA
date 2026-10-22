import '@fontsource/monoton/400.css';
import '@fontsource/chakra-petch/latin-700.css';
import '@fontsource/anton/400.css';
import '@fontsource/dela-gothic-one/400.css';
import '@fontsource/shippori-mincho-b1/800.css';
import '@fontsource-variable/noto-sans-jp';
import '../styles/lab.css';

const Tag = ({n, title, refs}) => <div className="lab-tag"><b>{n}</b>{title}<span>{refs}</span></div>;
const Sub = () => <p className="lab-sub">The open-source permission layer for AI agents. A verifiable identity for every agent, a verdict on every tool call, a record nobody can quietly edit.</p>;

/* ═════════════ HEROES ═════════════ */

function Akira() {
  return (
    <div className="h h-akira">
      <div className="ak-lines" />
      <p className="ak-top">SHUIN 朱印 — OPEN-SOURCE PERMISSION LAYER FOR AI AGENTS</p>
      <div className="ak-slab"><span className="ak-jp" lang="ja">汝の代理人を知れ</span></div>
      <div className="ak-en">KNOW YOUR AGENT</div>
      <p className="ak-sub">Identity for every agent. A verdict on every tool call. A record nobody can edit.</p>
      <div className="ak-cta"><a>Open the console</a><a className="g">Quickstart</a></div>
    </div>
  );
}

function NeonWall() {
  return (
    <div className="h h-neon">
      <div className="nw-wall" />
      <div className="nw-sign">
        <i className="br l" /><i className="br r" />
        <span className="nw-a">know your</span>
        <span className="nw-b">AGEN<em>T</em></span>
      </div>
      <div className="nw-kanji" lang="ja"><span>朱</span><span>印</span></div>
      <div className="nw-reflect" aria-hidden="true"><span className="nw-a">know your</span><span className="nw-b">AGENT</span></div>
      <div className="nw-copy"><Sub /><div className="nw-cta"><a>Open the console</a><a className="g">Quickstart</a></div></div>
    </div>
  );
}

function Poster() {
  return (
    <div className="h h-poster">
      <div className="ps-yellow">
        <p className="ps-label">ID-8004 // CLASS: AGENT // CLEARANCE REQUIRED</p>
        <h3 className="ps-title">KNOW<br />YOUR<br />AGENT.</h3>
        <div className="ps-row"><span className="ps-bar" /><span>SHUIN 朱印<br />PERMISSION LAYER</span></div>
      </div>
      <div className="ps-dark">
        <svg className="ps-gate" viewBox="0 0 200 220" aria-hidden="true"><path d="M10 40 Q100 20 190 40" /><path d="M14 52 Q100 34 186 52" /><line x1="30" y1="80" x2="170" y2="80" /><line x1="50" y1="46" x2="50" y2="215" /><line x1="150" y1="46" x2="150" y2="215" /><circle cx="100" cy="150" r="22" /><circle cx="100" cy="150" r="5" className="dot" /></svg>
        <span className="ps-jp" lang="ja">汝の代理人を知れ</span>
        <Sub />
        <div className="ps-cta"><a>Open the console ▸</a><a className="g">Quickstart</a></div>
      </div>
    </div>
  );
}

function Eva() {
  return (
    <div className="h h-eva">
      <div className="ev-hex" />
      <p className="ev-ep">第壱話</p>
      <h3 className="ev-big" lang="ja">代理人、<br />来襲</h3>
      <div className="ev-rule" />
      <p className="ev-en">KNOW <span>YOUR</span> AGENT</p>
      <p className="ev-small">SHUIN / THE PERMISSION LAYER FOR AI AGENTS</p>
      <div className="ev-cta"><a>Open the console</a><a className="g">Quickstart</a></div>
    </div>
  );
}

function Outrun() {
  return (
    <div className="h h-outrun">
      <div className="or-sky" /><div className="or-sun" /><div className="or-grid" />
      <div className="or-lock">
        <span className="or-know">KNOW YOUR</span>
        <span className="or-word" data-t="AGENT">AGENT</span>
        <span className="or-tag">SHUIN · 朱印</span>
      </div>
      <div className="or-cta"><a>Open the console</a><a className="g">Quickstart</a></div>
    </div>
  );
}

function Monolith() {
  return (
    <div className="h h-mono">
      <div className="mn-left">
        <p className="mn-k">Shuin — 朱印</p>
        <h3 className="mn-title">Know your<br />agent.</h3>
        <p className="mn-p">A red seal on everything your AI agents do. Identity, a verdict on every tool call, and a ledger that tells you when it has been touched.</p>
        <div className="mn-cta"><a>Open the console</a><a className="g">Quickstart</a></div>
      </div>
      <div className="mn-kanji" lang="ja"><span>朱</span><span>印</span></div>
      <div className="mn-stamp" lang="ja">承認</div>
    </div>
  );
}

function Holo() {
  return (
    <div className="h h-holo">
      <div className="hl-copy">
        <p className="hl-k">SHUIN 朱印</p>
        <h3 className="hl-title">EVERY AGENT<br />GETS A <span>PASS.</span></h3>
        <Sub />
        <div className="hl-cta"><a>Open the console</a><a className="g">Quickstart</a></div>
      </div>
      <div className="hl-card">
        <div className="hl-foil" />
        <div className="hl-top"><span>AGENT PASS · 通行証</span><span>ERC-8004</span></div>
        <div className="hl-photo"><svg viewBox="0 0 64 64"><path d="M8 18 Q32 12 56 18" /><line x1="14" y1="27" x2="50" y2="27" /><line x1="20" y1="18" x2="20" y2="58" /><line x1="44" y1="18" x2="44" y2="58" /></svg></div>
        <dl><dt>NAME</dt><dd>research-bot</dd><dt>OPERATOR</dt><dd>Acme Inc.</dd><dt>SCOPES</dt><dd>read_file · web.search</dd><dt>STATUS</dt><dd className="ok">● ACTIVE</dd></dl>
        <div className="hl-mrz">P&lt;SHUIN&lt;&lt;RESEARCH&lt;BOT&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;8F3A91C2&lt;&lt;</div>
        <div className="hl-seal" lang="ja">朱印</div>
      </div>
    </div>
  );
}

function Mosh() {
  return (
    <div className="h h-mosh">
      <div className="ms-scan" />
      <p className="ms-rec"><i />REC 00:00:84 · CAM 04 · GATE</p>
      <p className="ms-know">KNOW YOUR</p>
      <h3 className="ms-agent" data-t="AGENT">AGENT<span className="ms-dot">.</span></h3>
      <p className="ms-v"><b className="a">ALLOW</b><b className="k">ASK</b><b className="d">DENY</b><span>every tool call, before it runs</span></p>
      <div className="ms-cta"><a>Open the console</a><a className="g">Quickstart</a></div>
    </div>
  );
}

/* ═════════════ LOGOS ═════════════ */

const Ink = () => (
  <defs>
    <filter id="ink"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" /><feDisplacementMap in="SourceGraphic" scale="1.1" /><feComposite in2="SourceGraphic" operator="in" /></filter>
    <filter id="glow"><feGaussianBlur stdDeviation="1.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
  </defs>
);
const LOGOS = [
  ['Hanko', 'A real vermilion seal, hand-stamped edge', <svg viewBox="0 0 64 64"><Ink /><g filter="url(#ink)"><rect x="6" y="6" width="52" height="52" rx="5" fill="#d8262f" /><rect x="10" y="10" width="44" height="44" rx="2" fill="none" stroke="#f6eadb" strokeWidth="2.2" /><text x="32" y="30" textAnchor="middle" className="jp" fontSize="19" fill="#f6eadb">朱</text><text x="32" y="50" textAnchor="middle" className="jp" fontSize="19" fill="#f6eadb">印</text></g></svg>],
  ['Round seal', 'A circular hanko carrying 印', <svg viewBox="0 0 64 64"><Ink /><g filter="url(#ink)"><circle cx="32" cy="32" r="27" fill="none" stroke="#d8262f" strokeWidth="4.5" /><text x="32" y="43" textAnchor="middle" className="jp" fontSize="30" fill="#d8262f">印</text></g></svg>],
  ['Gate ring', 'Torii in a ring, verdict dot', <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" fill="none" stroke="#19e6ff" strokeWidth="2.6" /><path d="M13 20 Q32 14.5 51 20" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" /><line x1="18" y1="27" x2="46" y2="27" stroke="#fff" strokeWidth="2.6" /><line x1="22" y1="21" x2="22" y2="50" stroke="#fff" strokeWidth="4" /><line x1="42" y1="21" x2="42" y2="50" stroke="#fff" strokeWidth="4" /><circle cx="32" cy="40" r="3.5" fill="#ff2fa6" /></svg>],
  ['Neon 朱', 'The kanji as a bent glass tube', <svg viewBox="0 0 64 64"><Ink /><text x="32" y="47" textAnchor="middle" className="jp" fontSize="44" fill="none" stroke="#ff4fb8" strokeWidth="1.6" filter="url(#glow)">朱</text></svg>],
  ['門 grid', 'The gate kanji rebuilt as a cut-corner glyph', <svg viewBox="0 0 64 64"><path d="M10 8H28V30H16V56H10Z M36 8H54V56H48V30H36Z" fill="#19e6ff" /><rect x="16" y="15" width="6" height="3" fill="#05060d" /><rect x="16" y="22" width="6" height="3" fill="#05060d" /><rect x="42" y="15" width="6" height="3" fill="#05060d" /><rect x="42" y="22" width="6" height="3" fill="#05060d" /><rect x="27" y="40" width="10" height="10" fill="#ff2fa6" /></svg>],
  ['Iris', 'A six-blade aperture: the gate that closes', <svg viewBox="0 0 64 64">{[0, 1, 2, 3, 4, 5].map(i => <path key={i} d="M32 32 L58 32 L45 54.5 Z" fill={i % 2 ? '#0f8fa3' : '#19e6ff'} transform={`rotate(${i * 60} 32 32) translate(0 -6)`} />)}<circle cx="32" cy="32" r="6" fill="#05060d" /><circle cx="32" cy="32" r="2.6" fill="#ff2fa6" /></svg>],
  ['Glitch mark', 'Wordmark with a sliced RGB split', <svg viewBox="0 0 180 64"><text x="2" y="50" className="ant" fontSize="54" fill="#19e6ff" opacity=".9">SHUIN</text><text x="7" y="50" className="ant" fontSize="54" fill="#ff2a4d" opacity=".9">SHUIN</text><text x="4" y="50" className="ant" fontSize="54" fill="#fff">SHUIN</text><rect x="0" y="27" width="180" height="5" fill="#05060d" /><rect x="22" y="38" width="160" height="3" fill="#05060d" /></svg>],
  ['Signature', 'Mincho wordmark signed with a seal', <svg viewBox="0 0 200 64"><text x="0" y="46" className="min" fontSize="40" fill="#f3ece0" letterSpacing="4">SHUIN</text><Ink /><g filter="url(#ink)"><rect x="168" y="18" width="26" height="26" rx="2" fill="#d8262f" /><text x="181" y="38" textAnchor="middle" className="jp" fontSize="17" fill="#f6eadb">印</text></g></svg>],
  ['2077 S', 'A cut blocky S in warning yellow', <svg viewBox="0 0 64 64"><path d="M8 8H56V22L42 22V18H20V28H56V56H8V42H22V46H44V36H8Z" fill="#fcee0a" /><rect x="8" y="30" width="48" height="3" fill="#05060d" /></svg>],
  ['Diamond gate', 'Torii carved out of a red diamond', <svg viewBox="0 0 64 64"><path d="M32 3 L61 32 L32 61 L3 32 Z" fill="#ff2a4d" /><path d="M17 25 Q32 21 47 25" stroke="#05060d" strokeWidth="3.6" fill="none" /><line x1="21" y1="30" x2="43" y2="30" stroke="#05060d" strokeWidth="2.4" /><line x1="24" y1="26" x2="24" y2="47" stroke="#05060d" strokeWidth="3.4" /><line x1="40" y1="26" x2="40" y2="47" stroke="#05060d" strokeWidth="3.4" /></svg>],
  ['Barcode gate', 'A torii drawn in scan bars', <svg viewBox="0 0 64 64">{[6, 9, 11, 15, 18, 20, 23, 27, 30, 32, 35, 39, 41, 44, 47, 50, 53, 56].map((x, i) => <rect key={x} x={x} y={i % 5 === 0 ? 10 : 16} width={i % 3 ? 1.6 : 2.6} height={i % 5 === 0 ? 44 : 38} fill="#e6f3ff" />)}<path d="M4 14 Q32 6 60 14 L60 18 Q32 11 4 18Z" fill="#ff2fa6" /><rect x="14" y="44" width="36" height="12" fill="#05060d" /><rect x="18" y="20" width="4" height="36" fill="#19e6ff" /><rect x="42" y="20" width="4" height="36" fill="#19e6ff" /></svg>],
  ['Dial seal', 'Gate inside a calibrated dial, like an instrument', <svg viewBox="0 0 64 64">{Array.from({length: 48}, (_, i) => { const a = (i / 48) * Math.PI * 2, r1 = i % 4 ? 27 : 24; return <line key={i} x1={32 + Math.cos(a) * r1} y1={32 + Math.sin(a) * r1} x2={32 + Math.cos(a) * 30} y2={32 + Math.sin(a) * 30} stroke="#19e6ff" strokeWidth={i % 4 ? 1 : 2} />; })}<circle cx="32" cy="32" r="19" fill="#ff2a4d" /><path d="M20 26 Q32 22.5 44 26" stroke="#fff" strokeWidth="3" fill="none" /><line x1="23" y1="30" x2="41" y2="30" stroke="#fff" strokeWidth="2" /><line x1="26" y1="27" x2="26" y2="44" stroke="#fff" strokeWidth="3" /><line x1="38" y1="27" x2="38" y2="44" stroke="#fff" strokeWidth="3" /></svg>],
];

const HEROES = [
  ['01', 'Akira title slab', 'Akira manga covers · speed lines · red slab', <Akira />],
  ['02', 'Neon sign on a wet wall', 'Blade Runner · Ghost in the Shell street signage', <NeonWall />],
  ['03', 'Corpo poster', 'Cyberpunk 2077 · warning-yellow propaganda', <Poster />],
  ['04', 'Episode title card', 'Neon Genesis Evangelion · Mincho, NERV red', <Eva />],
  ['05', 'Outrun extrude', 'Kavinsky / Outrun · chrome over a gridded horizon', <Outrun />],
  ['06', 'Kanji monolith', 'Japanese street poster · Sekiro titling · paper + seal', <Monolith />],
  ['07', 'Holo passport', 'The product as the hero · iridescent ID card', <Holo />],
  ['08', 'Datamosh', 'VHS / surveillance feed · RGB slices', <Mosh />],
];

export default function Lab() {
  return (
    <div className="lab">
      <header className="lab-head">
        <h1>Shuin · design lab</h1>
        <p>Eight hero / closing directions and twelve logo concepts. Each hero would sit over the 3D corridor in the real page; the closing section mirrors whichever hero you pick. Tell me numbers, or mix (e.g. “03 layout with 02 lettering, logo 1”).</p>
      </header>
      {HEROES.map(([n, title, refs, el]) => (
        <section key={n} className="lab-opt"><Tag n={n} title={title} refs={refs} />{el}</section>
      ))}
      <section className="lab-opt logos">
        <Tag n="L" title="Logo concepts" refs="each shown large and at nav size" />
        <div className="lg-grid">
          {LOGOS.map(([name, desc, svg], i) => (
            <figure key={name}>
              <div className="lg-big">{svg}</div>
              <div className="lg-nav"><span className="lg-small">{svg}</span>{i === 6 || i === 7 ? null : <b>SHUIN</b>}</div>
              <figcaption><b>{i + 1} · {name}</b>{desc}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
