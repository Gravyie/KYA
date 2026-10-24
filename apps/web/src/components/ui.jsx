import {useEffect, useRef, useState} from 'react';
import {Link} from '../lib/router.jsx';

/** Two boundaries and one authorised signal. The mark remains legible at favicon size. */
export function Mark({size = 28, className = ''}) {
  return (
    <svg className={`mark wardrail-mark ${className}`} width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M5 7H19L16 13H11V35H16L19 41H5V7Z" fill="currentColor" />
      <path d="M43 7H29L32 13H37V35H32L29 41H43V7Z" fill="currentColor" />
      <path d="M21 17H27V31H21V17Z" fill="#19e6ff" />
    </svg>
  );
}

export function Logo({size = 28, withWord = true}) {
  return (
    <Link to="/" className="logo wardrail-logo" aria-label="Wardrail home">
      <Mark size={size} />
      {withWord && <span className="logo-word">wardrail</span>}
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
  const [failed, setFailed] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button type="button" className="copy" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); setFailed(false); clearTimeout(timer.current); timer.current = setTimeout(() => setDone(false), 1400); } catch { setFailed(true); }
    }} aria-live="polite" title={failed ? 'Clipboard unavailable. Select the text and copy manually.' : undefined}>{failed ? 'Select & copy' : done ? 'Copied' : label}</button>
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
