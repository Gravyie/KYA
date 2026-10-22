import {useState} from 'react';
import {ShieldCheck, ShieldAlert, ShieldQuestion} from 'lucide-react';
import {Logo} from '../components/ui.jsx';
import {Link} from '../lib/router.jsx';
import '../styles/docs.css';

const b64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), c => c.charCodeAt(0));
const hex = buf => [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');

async function checkSignature(token, pem) {
  const [h, p, s] = token.split('.');
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('spki', der, {name: 'Ed25519'}, false, ['verify']);
  return crypto.subtle.verify({name: 'Ed25519'}, key, b64(s), new TextEncoder().encode(`${h}.${p}`));
}

export default function Verify() {
  const [token, setToken] = useState('');
  const [registry, setRegistry] = useState(location.origin);
  const [pinned, setPinned] = useState('');
  const [audience, setAudience] = useState('');
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  document.title = 'Verify an agent — Mihari';

  async function run(e) {
    e.preventDefault(); setBusy(true); setOut(null);
    const result = {checks: []};
    const add = (label, state, detail) => result.checks.push({label, state, detail});
    try {
      const base = registry.replace(/\/$/, '');
      const reg = await (await fetch(`${base}/api/registry`)).json();
      const fp = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(reg.publicKey)));
      if (pinned.trim()) add('Registry key matches your pinned fingerprint', fp === pinned.trim().toLowerCase() ? 'ok' : 'fail', fp);
      else add('Registry fingerprint', 'warn', `${fp} — not pinned, so you are trusting the server to name its own key`);

      let claims;
      try { claims = JSON.parse(new TextDecoder().decode(b64(token.trim().split('.')[1]))); } catch { claims = null; }
      if (!claims) { add('Token is a Mihari assertion', 'fail', 'Could not parse it'); setOut({...result, verdict: 'fail'}); return; }

      try {
        const ok = await checkSignature(token.trim(), reg.publicKey);
        add('Ed25519 signature (verified in this browser)', ok ? 'ok' : 'fail', ok ? 'Signed by the registry key above' : 'Does not match the registry key');
      } catch { add('Ed25519 signature', 'warn', 'This browser lacks Ed25519 support; relying on the registry’s own check below'); }

      const expired = claims.exp * 1000 <= Date.now();
      add('Not expired', expired ? 'fail' : 'ok', `expires ${new Date(claims.exp * 1000).toLocaleString()}`);
      if (audience.trim()) add('Audience matches', claims.aud === audience.trim() ? 'ok' : 'fail', `token is for ${claims.aud}`);

      const live = await (await fetch(`${base}/api/verify`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({token: token.trim(), audience: audience.trim() || undefined})})).json();
      add('Agent still active (registry)', live.valid ? 'ok' : 'fail', live.valid ? 'Not revoked or expired' : live.reason);

      if (live.onchain) {
        const o = live.onchain;
        add('On-chain identity (ERC-8004)', o.ok ? 'ok' : o.ok === false ? 'fail' : 'warn',
          o.ok ? `${o.chain} agent #${o.agentId}, owner ${o.owner.slice(0, 6)}…${o.owner.slice(-4)}${o.bound ? ', and the on-chain file names this agent' : ', but the on-chain file does not name this agent'}` : (o.reason || 'Ownership on-chain no longer matches'));
      } else if (claims.erc8004) add('On-chain identity (ERC-8004)', 'warn', 'The assertion carries an ERC-8004 claim but the registry did not confirm it');
      const verdict = result.checks.some(c => c.state === 'fail') ? 'fail' : result.checks.some(c => c.state === 'warn') ? 'warn' : 'ok';
      setOut({...result, claims, verdict});
    } catch (err) {
      add('Reach the registry', 'fail', err.message);
      setOut({...result, verdict: 'fail'});
    } finally { setBusy(false); }
  }

  const Icon = out?.verdict === 'ok' ? ShieldCheck : out?.verdict === 'fail' ? ShieldAlert : ShieldQuestion;
  return (
    <div className="docs">
      <header className="docs-top"><div className="wrap docs-top-in"><Logo /><nav><Link to="/">Home</Link><Link to="/docs">Docs</Link><Link to="/app" className="btn sm">Console</Link></nav></div></header>
      <main className="wrap verify">
        <p className="eyebrow">For services receiving agent traffic</p>
        <h1>Know who is calling.</h1>
        <p className="lede-d">Paste an assertion an agent presented to you. We check the signature against the registry’s key, the expiry and audience, and ask the registry whether the agent is still active.</p>
        <form onSubmit={run} className="v-form">
          <label className="field"><span>Assertion token</span><textarea className="input mono" rows={4} value={token} onChange={e => setToken(e.target.value)} placeholder="eyJhbGciOiJFZERTQSIs…" required spellCheck="false" /></label>
          <div className="v-row">
            <label className="field"><span>Registry URL</span><input className="input mono" value={registry} onChange={e => setRegistry(e.target.value)} /></label>
            <label className="field"><span>Pinned fingerprint (recommended)</span><input className="input mono" value={pinned} onChange={e => setPinned(e.target.value)} placeholder="64 hex characters" /></label>
            <label className="field"><span>Expected audience</span><input className="input mono" value={audience} onChange={e => setAudience(e.target.value)} placeholder="https://api.you.com" /></label>
          </div>
          <button className="btn" disabled={busy || !token.trim()}>{busy ? 'Verifying…' : 'Verify agent'}</button>
        </form>
        {out && (
          <section className={`v-out ${out.verdict}`} aria-live="polite">
            <div className="v-head"><Icon size={26} /><div><h2>{out.verdict === 'ok' ? 'Verified agent' : out.verdict === 'warn' ? 'Valid, with caveats' : 'Do not trust this agent'}</h2>{out.claims && <p>{out.claims.name} · operated by <b>{out.claims.operator}</b></p>}</div></div>
            <ul className="v-checks">{out.checks.map(c => <li key={c.label} className={c.state}><b>{c.state === 'ok' ? '✓' : c.state === 'fail' ? '✕' : '!'}</b><div><span>{c.label}</span><small>{c.detail}</small></div></li>)}</ul>
            {out.claims && <pre className="raw">{JSON.stringify(out.claims, null, 2)}</pre>}
          </section>
        )}
      </main>
    </div>
  );
}
