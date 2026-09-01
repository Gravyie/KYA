/**
 * Side-by-side comparison — the demo's central screen.
 *
 * The PRD's scene is a trusted, reputable agent next to an anonymous one. The
 * layout is deliberately asymmetric in emphasis rather than a symmetric grid of
 * equal cards: the recommended agent is marked, and every other column is
 * explicitly explained away. A symmetric comparison implies the choice is close.
 * It isn't, and the screen should say so.
 *
 * Both columns are evaluated against the SAME ask, shown at the top, because a
 * comparison without a stated request is meaningless — the whole point is that
 * trust is relative to what you are about to delegate.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {api, nameOf} from '../lib/api.js';
import {Passport, VerdictBadge} from '../components/Passport.jsx';
import {IconScales, IconSpinner, IconArrowRight, IconX} from '../components/icons.jsx';

const PRESETS = [
  {
    label: 'The demo scene',
    hint: 'reputable vs anonymous',
    queries: ['optimizer.kya.eth', 'ghost.kya.eth'],
    capability: 'flight.quote',
    value: '0.5',
  },
  {
    label: 'Veteran vs rookie',
    hint: 'same identity, different history',
    queries: ['optimizer.kya.eth', 'scout.kya.eth'],
    capability: 'flight.quote',
    value: '0.5',
  },
  {
    label: 'The one that overreached',
    hint: 'a blocked attempt is permanent',
    queries: ['optimizer.kya.eth', 'drifter.kya.eth'],
    capability: 'flight.quote',
    value: '0.5',
  },
];

export default function Compare({tasks, onPick}) {
  const [queries, setQueries] = useState(PRESETS[0].queries);
  const [capability, setCapability] = useState(PRESETS[0].capability);
  const [value, setValue] = useState(PRESETS[0].value);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const wei = (() => {
        const n = Number(value);
        return Number.isFinite(n) && n >= 0 ? BigInt(Math.round(n * 1e18)).toString() : '0';
      })();
      setData(await api.compare(queries.filter(Boolean), {capability, value: wei}));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [queries, capability, value]);

  useEffect(() => {
    run();
  }, [run]);

  const applyPreset = (p) => {
    setQueries(p.queries);
    setCapability(p.capability);
    setValue(p.value);
  };


  return (
    <div className="view">
      <div className="view-head">
        <h1 className="display">Compare before you delegate</h1>
        <p>
          Two agents, one request. The same policy is applied to both, and every column states why it did or did not
          clear it. Identity and mandate are hard gates; track record only shapes the limit.
        </p>
      </div>

      {/* presets */}
      <div className="row" style={{gap: 8, marginBottom: 14, flexWrap: 'wrap'}}>
        {PRESETS.map((p) => {
          const active = p.queries.join() === queries.join() && p.capability === capability;
          return (
            <button
              key={p.label}
              className="btn btn-sm"
              onClick={() => applyPreset(p)}
              style={
                active
                  ? {borderColor: 'var(--accent-line)', color: 'var(--accent-bright)', background: 'var(--accent-dim)'}
                  : undefined
              }
            >
              {p.label}
              <span className="dimmer" style={{fontSize: 10.5}}>
                {p.hint}
              </span>
            </button>
          );
        })}
      </div>

      {/* the shared ask */}
      <div className="panel" style={{marginBottom: 16}}>
        <div className="panel-head">
          <IconScales size={13} />
          <span className="label">The request both are judged against</span>
        </div>
        <div className="ask">
          <div className="ask-field">
            <span className="label">Capability requested</span>
            <select value={capability} onChange={(e) => setCapability(e.target.value)} className="field-input">
              {(tasks?.length ? tasks.map((t) => t.capability) : ['flight.quote', 'research']).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="pay">pay</option>
            </select>
          </div>

          <div className="ask-field">
            <span className="label">Value at risk</span>
            <input value={value} onChange={(e) => setValue(e.target.value)} className="field-input" style={{width: 92}} />
          </div>

          {queries.map((q, i) => (
            <div className="ask-field" key={i}>
              <span className="label row" style={{gap: 5}}>
                <span className="col-tag">{i + 1}</span>
                Column {i + 1}
              </span>
              <input
                value={q}
                onChange={(e) => setQueries(queries.map((v, j) => (j === i ? e.target.value : v)))}
                placeholder="ENS name or address"
                className="field-input"
                style={{width: 176}}
              />
            </div>
          ))}

          <div className="ask-actions">
            {queries.length < 4 && (
              <button className="btn" onClick={() => setQueries([...queries, ''])} title="Add a column">
                + column
              </button>
            )}
            {queries.length > 2 && (
              <button className="btn" onClick={() => setQueries(queries.slice(0, -1))} title="Remove last column">
                <IconX size={11} />
              </button>
            )}
            <button className="btn btn-primary" onClick={run} disabled={loading}>
              {loading ? <IconSpinner size={12} className="spin" /> : <IconArrowRight size={12} />}
              Evaluate
            </button>
          </div>
        </div>
      </div>

      {error && <div className="err">{error}</div>}

      {/* the recommendation, stated before the evidence */}
      {data && (
        <div
          className="panel"
          style={{
            marginBottom: 16,
            borderColor: data.recommended ? 'var(--trust-line)' : 'var(--decline-line)',
            background: data.recommended ? 'var(--trust-dim)' : 'var(--decline-dim)',
          }}
        >
          <div className="panel-body row" style={{gap: 12}}>
            {data.recommended ? (
              <>
                <VerdictBadge verdict="trust">Route here</VerdictBadge>
                <span className="t1" style={{fontSize: 14}}>
                  {data.recommended}
                </span>
                <span className="dim">
                  is the only candidate that clears every hard gate at {value} for <span className="mono">{capability}</span>.
                </span>
              </>
            ) : (
              <>
                <VerdictBadge verdict="decline">Route nowhere</VerdictBadge>
                <span className="dim">
                  No candidate cleared the policy. The correct action is to decline the task, not to pick the least-bad
                  option.
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(data?.results?.length || 2, 3)}, minmax(0, 1fr))`,
          gap: 16,
          alignItems: 'start',
        }}
      >
        {loading && !data && (
          <>
            <div className="skeleton" style={{height: 500, borderRadius: 12}} />
            <div className="skeleton" style={{height: 500, borderRadius: 12}} />
          </>
        )}
        {data?.results.map((r, i) => (
          <div key={r.query} className="stack-sm">
            {/* fixed-height header keeps every card's top edge on one line */}
            <div className="col-head">
              <span className="col-tag">{i + 1}</span>
              <button
                className="label"
                onClick={() => r.passport && onPick(nameOf(r.passport))}
                style={{color: 'var(--t3)', cursor: r.passport ? 'pointer' : 'default'}}
                title={r.passport ? 'Open full passport' : undefined}
              >
                {r.query}
              </button>
              <span className="spacer" />
              {data.recommended === r.query && <VerdictBadge verdict="trust">Recommended</VerdictBadge>}
            </div>
            <Passport
              passport={r.passport}
              decision={r.decision}
              requestedCapability={capability}
              showLog={false}
              showHeadBadge={false}
              collapsedChecks
              compact
            />
          </div>
        ))}
      </div>

      {data && (
        <div className="panel" style={{marginTop: 16}}>
          <div className="panel-head">
            <span className="label">Policy applied to every column</span>
          </div>
          <div className="panel-body">
            <div className="sponsor" style={{border: 'none', padding: 0, background: 'none'}}>
              <dl>
                <dt>human</dt>
                <dd>{data.policy.requireHumanVerified ? 'World ID production proof required' : 'not required'}</dd>
                <dt>min score</dt>
                <dd>{(data.policy.minScore / 100).toFixed(1)}%</dd>
                <dt>min actions</dt>
                <dd>{data.policy.minActions} witnessed</dd>
                <dt>rejections</dt>
                <dd>
                  {data.policy.maxRejections === 0
                    ? 'any blocked over-mandate attempt is disqualifying'
                    : `up to ${data.policy.maxRejections}`}
                </dd>
                <dt>staleness</dt>
                <dd>{data.policy.maxStalenessDays} days max since last witnessed action</dd>
              </dl>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
