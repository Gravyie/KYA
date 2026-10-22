import {useState} from 'react';
import {Link} from '../lib/router.jsx';

/**
 * The Mihari mark: a watching eye. Almond lids in ink-cyan, three manga lash strokes, a magenta iris whose pupil
 * is a portal (the dark centre with a cyan catchlight). It reads at 16px and scales to a sign.
 */
/** The mark: an eye cut from the interface's own chamfered shape. The iris is a hexagon; the pupil is a cursor. */
export function Mark({size = 24, className = '', live = false}) {
  return (
    <svg className={`mark ${live ? 'live' : ''} ${className}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M1 32 L19 17 H45 L63 32 L45 47 H19 Z" fill="#0d0a24" />
      <g className="mk-iris"><path d="M22 32 L27 21 H37 L42 32 L37 43 H27 Z" fill="#ff2fa6" /><rect x="29" y="24" width="6" height="16" fill="#05050f" /><rect className="mk-cur" x="29" y="24" width="6" height="2.4" fill="#19e6ff" /></g>
      <path className="mk-up" d="M1 32 L19 17 H45 L63 32" fill="none" stroke="#19e6ff" strokeWidth="3" strokeLinejoin="bevel" />
      <path className="mk-lo" d="M5 34.5 L19 46.5 H45 L59 34.5" fill="none" stroke="#19e6ff" strokeWidth="1.6" strokeLinejoin="bevel" />
    </svg>
  );
}

export function Logo({size = 24, withWord = true}) {
  return (
    <Link to="/" className="logo" aria-label="Mihari home">
      <Mark size={size} />
      {withWord && <span className="logo-word">MIHARI<small lang="ja">見張り</small></span>}
    </Link>
  );
}

export function Badge({tone = '', children, plain}) {
  return <span className={`badge ${tone} ${plain ? 'plain' : ''}`}>{children}</span>;
}

export const outcomeTone = o => (o === 'allow' || o === 'approved' || o === 'success' ? 'allow' : o === 'ask' || o === 'pending' ? 'ask' : 'deny');

/* Minimal tokenizer: enough colour to scan code at a glance, no dependency. */
const RULES = [
  [/^(\/\/[^\n]*|#[^\n]*)/, 'c'],
  [/^("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)/, 's'],
  [/^\b(import|from|const|let|await|async|return|new|export|function|if|throw|try|catch|curl|npx|node|POST|GET|PUT|true|false|null)\b/, 'k'],
  [/^\b([A-Za-z_$][\w$]*)(?=\()/, 'f'],
  [/^[\s\S]/, 'n'],
];
function highlight(src) {
  const out = []; let rest = src; let buf = '', bufType = null;
  const flush = () => { if (buf) out.push(<span key={out.length} className={`tok-${bufType}`}>{buf}</span>); buf = ''; };
  while (rest) {
    for (const [re, type] of RULES) {
      const m = re.exec(rest);
      if (m) {
        if (type !== bufType) { flush(); bufType = type; }
        buf += m[0]; rest = rest.slice(m[0].length); break;
      }
    }
  }
  flush();
  return out;
}

export function CopyButton({text, label = 'Copy'}) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="copy" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); } catch { /* clipboard blocked */ }
    }}>{done ? 'Copied' : label}</button>
  );
}

export function Code({children, title, plain}) {
  const text = String(children).replace(/^\n|\n$/g, '');
  return (
    <div className="code">
      <div className="code-head"><span>{title ?? ''}</span><CopyButton text={text} /></div>
      <pre><code>{plain ? text : highlight(text)}</code></pre>
    </div>
  );
}

export function Spinner() { return <span className="spinner" role="status" aria-label="Loading" />; }
