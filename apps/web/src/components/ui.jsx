import {useState} from 'react';
import {Link} from '../lib/router.jsx';

/** The Shuin mark: a vermilion seal (hanko) carrying a gate, 門, with an aperture where a visitor is seen. */
export function Mark({size = 24, className = ''}) {
  return (
    <svg className={`mark ${className}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="3" y="3" width="58" height="58" rx="9" fill="var(--shu, #e8321e)" />
      <rect x="8.5" y="8.5" width="47" height="47" rx="5" fill="none" stroke="var(--seal-ink, #f4ece0)" strokeWidth="1.6" />
      <path d="M13 18.5 Q32 14.6 51 18.5 L51 23 Q32 19.6 13 23 Z" fill="var(--seal-ink, #f4ece0)" />
      <rect x="18" y="27" width="28" height="3" fill="var(--seal-ink, #f4ece0)" />
      <rect x="20.2" y="21" width="4.6" height="30" fill="var(--seal-ink, #f4ece0)" />
      <rect x="39.2" y="21" width="4.6" height="30" fill="var(--seal-ink, #f4ece0)" />
      <circle cx="32" cy="40.5" r="5.2" fill="none" stroke="var(--seal-ink, #f4ece0)" strokeWidth="2.4" />
      <circle cx="32" cy="40.5" r="1.7" fill="var(--seal-ink, #f4ece0)" />
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
