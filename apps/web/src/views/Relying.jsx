/**
 * The relying app — "buy the cheapest flight".
 *
 * This view is staged as a THIRD-PARTY APP, not as part of KYA's own console,
 * because that framing is the entire point: a task-requesting application that
 * knows nothing about these agents asks the registry who to trust, then
 * dispatches. Judges understand the product at the moment they see a stranger
 * app make a safety decision it could not have made otherwise.
 *
 * Everything on screen after "Dispatch" is real: the candidate verdicts come from
 * canPerform(), the execution runs on 0G (or the labeled local executor), the
 * record is content-addressed and stored, the receipt is a real transaction, and
 * the reputation number that ticks up is re-read from the chain afterwards.
 */
import React, {useEffect, useMemo, useState} from 'react';
import {api, pct, nameOf, short} from '../lib/api.js';
import {Dial, VerdictBadge} from '../components/Passport.jsx';
import {
  IconRoute,
  IconSpinner,
  IconCheck,
  IconX,
  IconArrowRight,
  IconChip,
  IconLayers,
  IconShield,
} from '../components/icons.jsx';

const STEP_COPY = {
  resolve: {label: 'Resolve the passport', icon: '1'},
  decide: {label: 'Ask the registry', icon: '2'},
  'record-rejection': {label: 'Record the blocked attempt', icon: '!'},
  execute: {label: 'Execute on 0G Compute', icon: '3'},
  persist: {label: 'Persist to 0G Storage', icon: '4'},
  settle: {label: 'Settle the receipt on-chain', icon: '5'},
  verify: {label: 'Reconcile the hash chain', icon: '6'},
};

export default function Relying({tasks, onPick}) {
  const [candidates, setCandidates] = useState(['optimizer.kya.eth', 'drifter.kya.eth', 'ghost.kya.eth']);
  const [capability, setCapability] = useState('flight.quote');
  const [from, setFrom] = useState('BOM');
  const [to, setTo] = useState('DXB');
  const [date, setDate] = useState('2026-09-14');
  const [budget, setBudget] = useState('2');
  const [question, setQuestion] = useState('Which airline has the best on-time record on BOM-DXB?');

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  const maxValue = useMemo(() => {
    const n = Number(budget);
    return Number.isFinite(n) && n >= 0 ? BigInt(Math.round(n * 1e18)).toString() : '0';
  }, [budget]);

  // Pre-flight: show the verdicts BEFORE anything is dispatched, so the audience
  // sees the decision being made rather than being told about it afterwards.
  useEffect(() => {
    let cancelled = false;
    const list = candidates.filter(Boolean);
    if (!list.length) return setPreview(null);
    Promise.all(
      list.map((q) =>
        api
          .check(q, capability, maxValue)
          .then((d) => ({query: q, decision: d.decision, passport: d.passport, onchain: d.onchain}))
          .catch(() => ({query: q, decision: null, passport: null, onchain: null})),
      ),
    ).then((rows) => !cancelled && setPreview(rows));
    return () => {
      cancelled = true;
    };
  }, [candidates, capability, maxValue, result]);

  async function dispatch() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const input =
        capability === 'research' ? {question, maxValue} : {from, to, date, maxValue};
      setResult(await api.route({capability, candidates: candidates.filter(Boolean), input, policy: {}}));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }


  const run = result?.run;
  const delta = run?.reputationDelta;

  return (
    <div className="view">
      <div className="view-head">
        <div className="row" style={{gap: 8, marginBottom: 8}}>
          <span className="mode">third-party app</span>
          <span className="dimmer">this screen is not KYA — it is a customer of KYA</span>
        </div>
        <h1 className="display">Buy the cheapest flight</h1>
        <p>
          A booking app with a budget and three agents offering to do the job. It has no relationship with any of them.
          Before spending a rupee it asks the passport registry which one is accountable, in-mandate and proven — then
          dispatches to exactly that one.
        </p>
      </div>

      {/* the task */}
      <div className="panel" style={{marginBottom: 16}}>
        <div className="panel-head">
          <IconRoute size={13} />
          <span className="label">The task this app wants done</span>
        </div>
        <div className="ask">
          <div className="ask-field">
            <span className="label">Task type</span>
            <select value={capability} onChange={(e) => setCapability(e.target.value)} className="field-input">
              {(tasks?.length ? tasks : [{capability: 'flight.quote', label: 'Cheapest-flight lookup'}]).map((t) => (
                <option key={t.capability} value={t.capability}>
                  {t.label || t.capability}
                </option>
              ))}
            </select>
          </div>

          {capability === 'research' ? (
            <div className="ask-field" style={{flex: 1, minWidth: 280}}>
              <span className="label">Question</span>
              <input value={question} onChange={(e) => setQuestion(e.target.value)} className="field-input" />
            </div>
          ) : (
            <>
              <div className="ask-field">
                <span className="label">Origin</span>
                <input
                  value={from}
                  onChange={(e) => setFrom(e.target.value.toUpperCase())}
                  className="field-input"
                  style={{width: 72}}
                />
              </div>
              <div className="ask-field">
                <span className="label">Destination</span>
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value.toUpperCase())}
                  className="field-input"
                  style={{width: 72}}
                />
              </div>
              <div className="ask-field">
                <span className="label">Departure date</span>
                <input value={date} onChange={(e) => setDate(e.target.value)} className="field-input" style={{width: 118}} />
              </div>
            </>
          )}

          <div className="ask-field">
            <span className="label">Budget ceiling</span>
            <input value={budget} onChange={(e) => setBudget(e.target.value)} className="field-input" style={{width: 90}} />
          </div>

          <div className="ask-actions">
            <button className="btn btn-primary" onClick={dispatch} disabled={busy}>
              {busy ? <IconSpinner size={12} className="spin" /> : <IconArrowRight size={12} />}
              {busy ? 'Running' : 'Check passports & dispatch'}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="err" style={{marginBottom: 16}}>{error}</div>}

      {/* candidate verdicts — visible before dispatch */}
      <div className="panel" style={{marginBottom: 16}}>
        <div className="panel-head">
          <IconShield size={13} />
          <span className="label">Candidates · verdict read from the registry before any work is commissioned</span>
        </div>
        {(result?.candidates || preview || []).map((c) => {
          const chosen = result?.routed === c.query;
          const v = c.decision?.verdict || 'decline';
          return (
            <div
              key={c.query}
              className="check"
              style={{
                gridTemplateColumns: '104px 168px minmax(0, 1fr) auto',
                padding: '10px 16px',
                background: chosen ? 'var(--trust-dim)' : undefined,
              }}
            >
              <VerdictBadge verdict={v}>{v}</VerdictBadge>
              <button
                onClick={() => c.passport && onPick(nameOf(c.passport))}
                className="mono"
                style={{color: 'var(--t1)', textAlign: 'left', cursor: c.passport ? 'pointer' : 'default'}}
              >
                {c.query}
              </button>
              <span className="check-detail">{c.decision?.summary || 'no verdict'}</span>
              <span className="row" style={{gap: 10}}>
                {c.passport && <span className="mono dim num">{pct(c.passport.reputation.score)}</span>}
                {chosen && <VerdictBadge verdict="trust">Dispatched</VerdictBadge>}
              </span>
            </div>
          );
        })}
        {result && !result.routed && (
          <div className="verdict-block">
            <IconX size={16} style={{color: 'var(--decline)', flexShrink: 0, marginTop: 2}} />
            <div className="verdict-copy">
              <div className="verdict-headline">Nothing was dispatched</div>
              <div className="verdict-summary">{result.reason}</div>
            </div>
          </div>
        )}
      </div>

      {/* the run */}
      {run && (
        <div className="grid-2 fade-in">
          <div className="panel">
            <div className="panel-head">
              <IconLayers size={13} />
              <span className="label">What actually happened</span>
              <div className="spacer" />
              <span className="mono dimmer">{run.timeline[run.timeline.length - 1]?.atMs}ms total</span>
            </div>
            <div className="panel-body">
              <div className="timeline">
                {run.timeline.map((t, i) => {
                  const copy = STEP_COPY[t.step] || {label: t.step, icon: String(i + 1)};
                  const state = t.error ? 'error' : 'done';
                  return (
                    <div key={`${t.step}-${i}`} className="tl-step" data-state={state}>
                      <span className="tl-node">{state === 'error' ? '!' : copy.icon}</span>
                      <div>
                        <div className="tl-label">
                          {copy.label}
                          <span className="tl-time">{t.atMs}ms</span>
                        </div>
                        <div className="tl-detail">{t.detail}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="stack">
            {/* the reputation move */}
            {delta && (
              <div className="panel">
                <div className="panel-head">
                  <span className="label">Reputation, re-read from the chain after settlement</span>
                </div>
                <div className="panel-body row" style={{gap: 18}}>
                  <Dial score={delta.after} verdict="trust" size={76} />
                  <div className="stack-sm" style={{gap: 4}}>
                    <div className="row" style={{gap: 8}}>
                      <span className="mono dim num">{pct(delta.before, 2)}</span>
                      <span className="delta-arrow">→</span>
                      <span className="mono t1 num" style={{fontSize: 15}}>
                        {pct(delta.after, 2)}
                      </span>
                    </div>
                    <div className="dim">
                      {delta.totalBefore} → {delta.totalAfter} witnessed actions
                    </div>
                    {run.integrity && (
                      <div className="row" style={{gap: 6, color: run.integrity.verified ? 'var(--trust)' : 'var(--decline)'}}>
                        {run.integrity.verified ? <IconCheck size={11} /> : <IconX size={11} />}
                        <span style={{fontSize: 11.5}}>
                          hash chain verified over {run.integrity.receipts} receipts
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* the work product */}
            {run.execution && (
              <div className="panel">
                <div className="panel-head">
                  <IconChip size={13} />
                  <span className="label">Result</span>
                  <div className="spacer" />
                  <span className="mode" data-live={String(run.execution.engine.startsWith('live:'))}>
                    {run.execution.engine}
                  </span>
                </div>
                <div className="panel-body stack-sm">
                  <pre
                    className="mono"
                    style={{
                      margin: 0,
                      padding: 12,
                      background: 'rgba(0,0,0,0.34)',
                      border: '1px solid var(--line)',
                      borderRadius: 6,
                      color: 'var(--t2)',
                      overflowX: 'auto',
                      fontSize: 11,
                      lineHeight: 1.7,
                    }}
                  >
                    {JSON.stringify(run.execution.result, null, 2)}
                  </pre>
                  <div className="sponsor" style={{border: 'none', padding: 0, background: 'none'}}>
                    <dl>
                      <dt>engine</dt>
                      <dd className="mono">{run.execution.engine}</dd>
                      <dt>model</dt>
                      <dd className="mono">{run.execution.model}</dd>
                      {run.execution.attestation && (
                        <>
                          <dt>tee</dt>
                          <dd className="mono">
                            {run.execution.attestation.verified ? 'attested' : 'unverified'}
                            {run.execution.attestation.signingAddress
                              ? ` · ${short(run.execution.attestation.signingAddress)}`
                              : ''}
                          </dd>
                        </>
                      )}
                      <dt>storage</dt>
                      <dd className="mono">{run.storage?.backend}</dd>
                      <dt>evidence</dt>
                      <dd className="mono" style={{wordBreak: 'break-all'}}>
                        {run.storage?.digest}
                      </dd>
                      <dt>receipt</dt>
                      <dd className="mono" style={{wordBreak: 'break-all'}}>
                        {run.settlement?.hash}
                      </dd>
                    </dl>
                  </div>
                  <div className="dimmer" style={{fontSize: 11.5}}>
                    The evidence digest above is what the registry stored. The agent never touched it — only the
                    allowlisted executor can submit a receipt, which is what makes this history witnessed rather than
                    self-reported.
                  </div>
                </div>
              </div>
            )}

            {/* a blocked run still produces a record */}
            {run.rejection && (
              <div className="panel" style={{borderColor: 'var(--decline-line)'}}>
                <div className="panel-head">
                  <IconX size={13} style={{color: 'var(--decline)'}} />
                  <span className="label">Blocked attempt written on-chain</span>
                </div>
                <div className="panel-body stack-sm">
                  <div className="dim">
                    The registry refused this action, and the refusal itself is now a permanent part of the agent's
                    record. Enforcement that only blocks — without recording — would let an agent probe its limits
                    invisibly.
                  </div>
                  <div className="mono dimmer" style={{wordBreak: 'break-all'}}>
                    {run.rejection.hash}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
