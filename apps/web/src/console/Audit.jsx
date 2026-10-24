import {Fragment, useState} from 'react';
import {ShieldCheck, Download, ShieldAlert} from 'lucide-react';
import {api} from '../lib/api.js';
import {Badge} from '../components/ui.jsx';
import {describeEvent} from '../lib/events.js';
import {dateTime, download, short} from '../lib/format.js';
import {useConsole} from './ctx.js';

const KINDS = [['all', 'Everything'], ['decisions', 'Decisions'], ['denied', 'Blocked only'], ['admin', 'Admin changes']];
const pass = (e, kind) => kind === 'all' || (kind === 'decisions' && /^(action|approval)\./.test(e.kind))
  || (kind === 'denied' && (e.kind === 'action.denied' || e.kind === 'approval.denied'))
  || (kind === 'admin' && /^(agent|owner)\./.test(e.kind));

export default function Audit() {
  const {data, notify} = useConsole();
  const [agent, setAgent] = useState('all');
  const [kind, setKind] = useState('all');
  const [open, setOpen] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const rows = data.events.filter(e => pass(e, kind) && (agent === 'all' || e.agentId === agent));

  async function verify() {
    setBusy(true);
    try { setResult(await api.verifyChain()); } catch (e) { notify(e.message); } finally { setBusy(false); }
  }
  async function exportLog() {
    try {
      const file = await api.exportAudit();
      download(`mihari-audit-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(file, null, 2));
      notify('Exported. Verify it anywhere with verifyAuditExport().');
    } catch (e) { notify(e.message); }
  }

  return (
    <>
      <header className="page-head">
        <div><p className="eyebrow">Audit log</p><h1>{data.eventCount} events, hash-linked.</h1></div>
        <div className="actions">
          <button className="btn ghost" onClick={verify} disabled={busy}><ShieldCheck size={15} /> Verify chain</button>
          <button className="btn" onClick={exportLog}><Download size={15} /> Export JSON</button>
        </div>
      </header>
      {result && (
        <div className={`integrity ${result.valid ? '' : 'bad'}`} role="status">
          {result.valid ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
          <div><b>{result.valid ? 'Chain verified' : 'Chain broken'}</b><span>{result.valid ? `${result.count} events recomputed. Head ${short(result.head, 16)}…` : `Mismatch at event ${result.seq ?? result.at}.`}</span></div>
        </div>
      )}
      <div className="filters">
        <select className="input" aria-label="Agent" value={agent} onChange={e => setAgent(e.target.value)}>
          <option value="all">All agents</option>{data.agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <div className="seg">{KINDS.map(([k, l]) => <button key={k} aria-pressed={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>)}</div>
      </div>
      <section className="panel flush">
        <table className="table">
          <thead><tr><th>#</th><th>Time</th><th>Event</th><th>Agent</th><th>Detail</th></tr></thead>
          <tbody>
            {rows.map(e => {
              const d = describeEvent(e, data.agents);
              return (
                <Fragment key={e.id}>
                  <tr className="click" onClick={() => setOpen(open === e.id ? null : e.id)}>
                    <td className="mono muted"><button className="audit-expand" aria-label={`Inspect event ${e.seq}`} aria-expanded={open === e.id} onClick={ev => { ev.stopPropagation(); setOpen(open === e.id ? null : e.id); }}>{open === e.id ? '−' : '+'} {e.seq ?? ''}</button></td><td className="muted nowrap">{dateTime(e.at)}</td>
                    <td><Badge tone={d.tone}>{d.label}</Badge></td><td>{d.who}</td><td><code>{d.text}</code> <span className="muted">{d.note}</span></td>
                  </tr>
                  {open === e.id && (
                    <tr className="detail"><td colSpan={5}>
                      <dl className="facts-grid"><dt>Event ID</dt><dd className="mono">{e.id}</dd><dt>Hash</dt><dd className="mono wrap-all">{e.hash}</dd><dt>Previous hash</dt><dd className="mono wrap-all">{e.previousHash}</dd></dl>
                      <pre className="raw">{JSON.stringify(e.details, null, 2)}</pre>
                    </td></tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={5} className="muted pad">No events match.</td></tr>}
          </tbody>
        </table>
        {data.eventCount > data.events.length && <p className="hint pad">Showing the latest {data.events.length}. Export for the full log.</p>}
      </section>
    </>
  );
}
