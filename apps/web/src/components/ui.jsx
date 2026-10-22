import {useState} from 'react';
import {Link} from '../lib/router.jsx';

/**
 * The Mihari mark: a watching eye. Almond lids in ink-cyan, three manga lash strokes, a magenta iris whose pupil
 * is a portal (the dark centre with a cyan catchlight). It reads at 16px and scales to a sign.
 */
/** The mark: a security gate's iris seen from above, in the interface's chamfered frame; the pupil is a cursor. */
export function Mark({size = 24, className = '', live = false}) {
  return (
    <svg className={`mark ${live ? 'live' : ''} ${className}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M20 4 H44 L60 20 V44 L44 60 H20 L4 44 V20 Z" fill="#0d0a24" />
      <circle cx="32" cy="32" r="17.5" fill="#2a0b2e" />
      <g className="mk-iris"><path d="M32.0 25.8 L45.4 21.5 L37.4 28.9 Z" fill="#ff2fa6" /><path d="M37.4 28.9 L47.8 38.4 L37.4 35.1 Z" fill="#c41f86" /><path d="M37.4 35.1 L34.4 48.8 L32.0 38.2 Z" fill="#ff2fa6" /><path d="M32.0 38.2 L18.6 42.5 L26.6 35.1 Z" fill="#c41f86" /><path d="M26.6 35.1 L16.2 25.6 L26.6 28.9 Z" fill="#ff2fa6" /><path d="M26.6 28.9 L29.6 15.2 L32.0 25.8 Z" fill="#c41f86" /></g>
      <polygon points="32.0,25.8 37.4,28.9 37.4,35.1 32.0,38.2 26.6,35.1 26.6,28.9" fill="#05050f" /><rect className="mk-cur" x="30.4" y="29.4" width="3.2" height="5.2" fill="#19e6ff" />
      <path className="mk-up" d="M20 4 H44 L60 20 V44 L44 60 H20 L4 44 V20 Z" fill="none" stroke="#19e6ff" strokeWidth="2.6" strokeLinejoin="bevel" />
      <path className="mk-lo" d="M24 9.5 H40 M54.5 24 V40 M40 54.5 H24 M9.5 40 V24" stroke="#19e6ff" strokeWidth="1.2" opacity=".55" />
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
