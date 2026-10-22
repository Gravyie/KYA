import {useState} from 'react';
import {Link} from '../lib/router.jsx';

/**
 * The Mihari mark: a watching eye. Almond lids in ink-cyan, three manga lash strokes, a magenta iris whose pupil
 * is a portal (the dark centre with a cyan catchlight). It reads at 16px and scales to a sign.
 */
export function Mark({size = 24, className = ''}) {
  return (
    <svg className={`mark ${className}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M4 34 Q32 6 60 34 Q32 56 4 34 Z" fill="#0b0b22" />
      <circle cx="32" cy="33" r="12.5" fill="#ff2fa6" />
      <circle cx="32" cy="33" r="12.5" fill="none" stroke="#ffd0f0" strokeWidth="1" opacity=".55" />
      <circle cx="32" cy="33" r="5.6" fill="#05050f" />
      <circle cx="28.4" cy="29.4" r="2" fill="#bff8ff" />
      <path d="M4 34 Q32 6 60 34" fill="none" stroke="#19e6ff" strokeWidth="3.6" strokeLinecap="round" />
      <path d="M8 35 Q32 54 56 35" fill="none" stroke="#19e6ff" strokeWidth="2" strokeLinecap="round" opacity=".7" />
      <path d="M16 21 L11 12 M25 15.5 L23 6 M36 15 L39 5.5" stroke="#19e6ff" strokeWidth="3" strokeLinecap="round" />
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
