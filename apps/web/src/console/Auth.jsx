import {useState} from 'react';
import {KeyRound, ShieldCheck} from 'lucide-react';
import {api, ownerKey} from '../lib/api.js';
import {Logo, CopyButton} from '../components/ui.jsx';
import {Link} from '../lib/router.jsx';

function Shell({children}) {
  return (
    <main className="auth">
      <div className="auth-top"><Logo /><Link to="/" className="muted">← Back to site</Link></div>
      <div className="auth-card">{children}</div>
    </main>
  );
}

export function Setup({onDone}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [issued, setIssued] = useState(null);
  const [saved, setSaved] = useState(false);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { setIssued(await api.setup(name.trim())); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  if (issued) {
    return (
      <Shell>
        <KeyRound size={22} strokeWidth={1.6} />
        <h1>Save your owner key</h1>
        <p className="muted">This key controls every agent in this registry. It is shown once. Wardrail stores only its hash.</p>
        <div className="secret"><code>{issued.key}</code><CopyButton text={issued.key} /></div>
        <label className="check"><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} /> I stored it in a password manager</label>
        <p className="hint">Lost it later? Run <code className="inline-code">npm run owner:recover</code> on the host machine.</p>
        <button className="btn" disabled={!saved} onClick={() => { ownerKey.set(issued.key); onDone(); }}>Open the console</button>
      </Shell>
    );
  }
  return (
    <Shell>
      <ShieldCheck size={22} strokeWidth={1.6} />
      <h1>Set up your registry</h1>
      <p className="muted">You are the accountable human. Your name appears on every agent identity card this registry signs.</p>
      <form onSubmit={submit} className="stack">
        <label className="field"><span>Your name or organisation</span>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Acme Inc." autoFocus minLength={2} maxLength={80} required />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={busy || name.trim().length < 2}>Create registry</button>
      </form>
    </Shell>
  );
}

export function Unlock({status, onDone, reason}) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(reason || '');

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { await api.dashboard(key.trim()); ownerKey.set(key.trim()); onDone(); }
    catch (err) { setError(err.status === 401 ? 'That is not the owner key for this registry.' : err.message); }
    finally { setBusy(false); }
  }
  return (
    <Shell>
      <KeyRound size={22} strokeWidth={1.6} />
      <h1>Unlock {status?.owner ? `${status.owner}’s` : 'the'} registry</h1>
      <p className="muted">{status?.agentCount ?? 0} agents · {status?.eventCount ?? 0} audit events</p>
      <form onSubmit={submit} className="stack">
        <label className="field"><span>Owner key</span>
          <input type="password" className="input mono" value={key} onChange={e => setKey(e.target.value)} placeholder="mio_…" autoFocus autoComplete="current-password" spellCheck="false" required />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={busy || !key.trim()}>Unlock</button>
      </form>
      <p className="hint">Lost it? On the machine running Wardrail, run <code className="inline-code">npm run owner:recover</code> to rotate to a new key. Agents and audit history are kept.</p>
    </Shell>
  );
}
