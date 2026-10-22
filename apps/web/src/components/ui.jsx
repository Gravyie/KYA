import {useState} from 'react';
import {Link} from '../lib/router.jsx';

/**
 * The Shuin mark: a neon torii (the checkpoint) inside a chamfered seal frame, with a single magenta dot in the
 * gateway: the verdict. Reads as a hanko stamp at small sizes and as a sign at large ones.
 */
export function Mark({size = 24, className = ''}) {
  return (
    <svg className={`mark ${className}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M14 4H50L60 14V50L50 60H14L4 50V14Z" fill="#0a0d1c" stroke="#19e6ff" strokeWidth="3" strokeLinejoin="round" />
      <path d="M11 19.5Q32 14 53 19.5L52 24.5Q32 20 12 24.5Z" fill="#ff2fa6" />
      <rect x="17" y="29" width="30" height="3.4" fill="#19e6ff" />
      <rect x="20" y="23" width="5" height="29" fill="#eaf7ff" />
      <rect x="39" y="23" width="5" height="29" fill="#eaf7ff" />
      <circle cx="32" cy="43" r="4.2" fill="#ff2fa6" />
    </svg>
  );
}

export function Logo({size = 24, withWord = true}) {
  return (
    <Link to="/" className="logo" aria-label="Shuin home">
      <Mark size={size} />
      {withWord && <span className="logo-word">SHUIN<small lang="ja">朱印</small></span>}
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
