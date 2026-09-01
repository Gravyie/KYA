/**
 * Passport lookup — the single-agent view.
 *
 * Search resolves ENS name, bare label, agent id or raw address. The policy the
 * verdict is evaluated against is editable inline, because "trust" is not
 * absolute: the same agent is safe for a $5 research task and unsafe for a
 * $5,000 payment, and being able to change the ask and watch the verdict flip is
 * the fastest way to show that the decision is real rather than a static badge.
 */
import React, {useEffect, useState} from 'react';
import {api, nameOf} from '../lib/api.js';
import {Passport} from '../components/Passport.jsx';
import {IconSpinner, IconBolt} from '../components/icons.jsx';

const CAPS = ['flight.quote', 'research', 'pay'];

export default function Lookup({query, tasks, onPick}) {
  const [state, setState] = useState({loading: true, data: null, error: null});
  const [capability, setCapability] = useState('flight.quote');
  const [value, setValue] = useState('0.5');
  const [live, setLive] = useState(null);

  // Reload whenever the identifier changes.
  useEffect(() => {
    if (!query) return setState({loading: false, data: null, error: null});
    let cancelled = false;
    setState((s) => ({...s, loading: true, error: null}));
    api
      .agent(query)
      .then((d) => !cancelled && setState({loading: false, data: d, error: null}))
      .catch((e) => !cancelled && setState({loading: false, data: null, error: e.message}));
    return () => {
      cancelled = true;
    };
  }, [query]);

  // Re-evaluate the verdict against the editable policy, using the registry's
  // own canPerform() as the authoritative mandate check.
  useEffect(() => {
    if (!state.data) return setLive(null);
    let cancelled = false;
    const wei = (() => {
      try {
        const n = Number(value);
        return Number.isFinite(n) && n >= 0 ? BigInt(Math.round(n * 1e18)).toString() : '0';
      } catch {
        return '0';
      }
    })();
    api
      .check(query, capability, wei)
      .then((d) => !cancelled && setLive(d))
      .catch(() => !cancelled && setLive(null));
    return () => {
      cancelled = true;
    };
  }, [state.data, query, capability, value]);

  if (!query) {
    return (
      <div className="view">
        <div className="view-head">
          <h1 className="display">Look up an agent</h1>
          <p>
            Search by ENS name, agent id, or wallet address. The passport returns a decision — trust, limit or decline —
            with every check that produced it.
          </p>
        </div>
        <div className="panel">
          <div className="empty">Type an identifier above, or pick an agent from the roster.</div>
        </div>
      </div>
    );
  }

  if (state.loading) {
    return (
      <div className="view">
        <div className="stack">
          <div className="skeleton" style={{height: 30, width: 260}} />
          <div className="skeleton" style={{height: 420, borderRadius: 12}} />
        </div>
      </div>
    );
  }

  if (state.error) {
    const notFound = /no passport/i.test(state.error);
    return (
      <div className="view">
        <div className="view-head">
          <h1 className="display-sm">{query}</h1>
        </div>
        {notFound ? (
          <Passport passport={null} decision={{verdict: 'decline'}} />
        ) : (
          <div className="err">{state.error}</div>
        )}
      </div>
    );
  }

  const {passport, integrity} = state.data;
  const decision = live?.decision || state.data.decision;

  return (
    <div className="view">
      <div className="view-head row-between" style={{alignItems: 'flex-end'}}>
        <div>
          <h1 className="display-sm">{nameOf(passport)}</h1>
          <p style={{marginTop: 4}}>
            Passport #{passport.agentId} on chain {passport.chainId}. Everything below is read from the registry — nothing
            is cached or self-reported.
          </p>
        </div>
      </div>

      {/* the ask — changing it changes the verdict */}
      <div className="panel" style={{marginBottom: 16}}>
        <div className="panel-head">
          <IconBolt size={13} />
          <span className="label">The ask · the verdict is relative to this, not absolute</span>
        </div>
        <div className="ask">
          <div className="ask-field">
            <span className="label">Capability requested</span>
            <select value={capability} onChange={(e) => setCapability(e.target.value)} className="field-input">
              {(tasks?.length ? tasks.map((t) => t.capability) : CAPS).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="pay">pay</option>
            </select>
          </div>
          <div className="ask-field">
            <span className="label">Value at risk (OG)</span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="field-input"
              inputMode="decimal"
              style={{width: 100}}
            />
          </div>
          <div className="ask-actions">
            {live?.onchain ? (
              <span className="mode" data-live={String(live.onchain.ok)} title="PassportRegistry.canPerform()">
                registry says {live.onchain.ok ? 'OK' : live.onchain.reason}
              </span>
            ) : (
              <span className="dimmer row" style={{gap: 6}}>
                <IconSpinner size={12} className="spin" />
                evaluating
              </span>
            )}
          </div>
        </div>
      </div>

      <Passport passport={passport} decision={decision} integrity={integrity} requestedCapability={capability} />

      <div className="panel" style={{marginTop: 16}}>
        <div className="panel-head">
          <span className="label">ENS text records · read through the standard resolver profile</span>
        </div>
        <div className="panel-body">
          {Object.keys(passport.textRecords || {}).length === 0 ? (
            <div className="dimmer">No text records set.</div>
          ) : (
            <dl className="kv">
                {Object.entries(passport.textRecords).map(([k, v]) => (
                  <React.Fragment key={k}>
                    <dt>{k}</dt>
                    <dd className={k.startsWith('agent.') ? 'mono' : undefined}>{v}</dd>
                  </React.Fragment>
                ))}
              </dl>
          )}
        </div>
      </div>
    </div>
  );
}
