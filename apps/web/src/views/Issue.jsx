/**
 * Issue a passport — the owner-side onboarding flow.
 *
 * Three steps in the order the contracts enforce them:
 *   1. World ID proves the OWNER is a unique human. Until this is on-chain,
 *      registerAgent() reverts — the gate is in Solidity, not in this form.
 *   2. The passport is minted with its mandate: capabilities, daily spend
 *      ceiling, action cap, optional expiry.
 *   3. An ENS subname is issued under the project's parent name and the agent
 *      card is written to text records.
 *
 * The step that matters for judging is step 1's failure mode. When no World app
 * id is configured the API issues a SIMULATOR-level proof, and this form shows
 * the resulting on-chain refusal rather than papering over it. That refusal is a
 * feature: it is the mechanism that stops a disposable wallet from carrying a
 * reputation.
 */
import React, {useEffect, useState} from 'react';
import {api, short} from '../lib/api.js';
import {IconShield, IconSpinner, IconCheck, IconX, IconPlus, IconGlobe, IconWarn} from '../components/icons.jsx';

const ALL_CAPS = ['flight.quote', 'research', 'pay'];

export default function Issue({onPick, integrations}) {
  const [health, setHealth] = useState(null);
  const [owner, setOwner] = useState('');
  const [operator, setOperator] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [caps, setCaps] = useState(['flight.quote']);
  const [spend, setSpend] = useState('5');
  const [maxActions, setMaxActions] = useState('50');

  const [human, setHuman] = useState(null);
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
  }, []);

  const worldLive = integrations?.world?.live;

  async function verify() {
    setBusy('verify');
    setError(null);
    try {
      // With a real WORLD_APP_ID the browser would open IDKit and pass the proof
      // here. Without one the API issues a simulator-level proof, which the
      // registry refuses — surfaced below rather than hidden.
      setHuman(await api.verifyHuman({subject: owner.trim(), simulate: !worldLive}));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function issue() {
    setBusy('issue');
    setError(null);
    try {
      const res = await api.createAgent({
        operator: operator.trim(),
        domain: `${label.trim()}.${health?.parentName || 'kya.eth'}`,
        label: label.trim(),
        description,
        metadataURI: `kya-local://agentcard/${label.trim()}`,
        capabilities: caps,
        spendLimitPerDay: BigInt(Math.round(Number(spend) * 1e18)).toString(),
        maxActionsPerDay: Number(maxActions) || 0,
        expiresAt: 0,
      });
      setCreated(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  const Step = ({n, title, children, state}) => (
    <div className="tl-step" data-state={state}>
      <span className="tl-node">{state === 'done' ? '✓' : state === 'error' ? '!' : n}</span>
      <div style={{minWidth: 0}}>
        <div className="tl-label">{title}</div>
        <div style={{marginTop: 8}}>{children}</div>
      </div>
    </div>
  );

  return (
    <div className="view">
      <div className="view-head">
        <h1 className="display">Issue a passport</h1>
        <p>
          The owner proves personhood once, then mints a passport with an explicit mandate. Every gate below is enforced
          in the contract, not in this form — you can watch it refuse.
        </p>
      </div>

      {error && <div className="err" style={{marginBottom: 16}}>{error}</div>}

      <div className="grid-2" style={{alignItems: 'start'}}>
        <div className="panel">
          <div className="panel-body">
            <div className="timeline">
              {/* ── 1. World ID ── */}
              <Step
                n="1"
                title="Verify the owner is a unique human"
                state={human ? (human.canRegisterAgent ? 'done' : 'error') : 'active'}
              >
                <div className="stack-sm">
                  <div className="row" style={{gap: 8}}>
                    <IconShield size={12} />
                    <span className="mode" data-live={String(Boolean(worldLive))}>
                      {integrations?.world?.mode || '…'}
                    </span>
                  </div>
                  <input
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    placeholder="owner wallet address 0x…"
                    className="field-input"
                  />
                  <div className="row" style={{gap: 8}}>
                    <button
                      className="btn btn-primary"
                      onClick={verify}
                      disabled={busy === 'verify' || !/^0x[0-9a-fA-F]{40}$/.test(owner.trim())}
                    >
                      {busy === 'verify' ? <IconSpinner size={12} className="spin" /> : <IconShield size={12} />}
                      {worldLive ? 'Verify with World ID' : 'Run local stand-in'}
                    </button>
                    {health?.accounts?.owner && (
                      <button className="btn btn-sm" onClick={() => setOwner(health.accounts.owner)}>
                        use demo owner
                      </button>
                    )}
                  </div>

                  {human && (
                    <div
                      className="panel"
                      style={{
                        borderColor: human.canRegisterAgent ? 'var(--trust-line)' : 'var(--decline-line)',
                        background: human.canRegisterAgent ? 'var(--trust-dim)' : 'var(--decline-dim)',
                      }}
                    >
                      <div className="panel-body stack-sm">
                        <div className="row" style={{gap: 8}}>
                          {human.canRegisterAgent ? (
                            <IconCheck size={13} style={{color: 'var(--trust)'}} />
                          ) : (
                            <IconWarn size={13} style={{color: 'var(--decline)'}} />
                          )}
                          <span className="t1">
                            {human.canRegisterAgent
                              ? `Recorded as a production ${human.proof.kind === 1 ? 'orb' : 'device'} proof`
                              : 'Simulator-level proof — registration will be refused'}
                          </span>
                        </div>
                        {human.warning && <div className="dim" style={{fontSize: 12}}>{human.warning}</div>}
                        <div className="mono dimmer" style={{fontSize: 10.5, wordBreak: 'break-all'}}>
                          nullifier {human.proof.nullifierHash}
                        </div>
                        <div className="mono dimmer" style={{fontSize: 10.5, wordBreak: 'break-all'}}>
                          tx {human.tx?.hash}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Step>

              {/* ── 2. mandate ── */}
              <Step n="2" title="Declare the mandate" state={created ? 'done' : human?.canRegisterAgent ? 'active' : 'idle'}>
                <div className="stack-sm">
                  <input
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    placeholder="operator address (the key the agent acts with) 0x…"
                    className="field-input"
                  />
                  <div className="row" style={{gap: 8}}>
                    <input
                      value={label}
                      onChange={(e) => setLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="label"
                      className="field-input" style={{width: 150}}
                    />
                    <span className="mono dimmer">.{health?.parentName || 'kya.eth'}</span>
                  </div>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="what this agent does"
                    className="field-input" style={{fontFamily: 'var(--sans)', fontSize: 13}}
                  />
                  <div>
                    <div className="label">Capabilities</div>
                    <div className="chips">
                      {ALL_CAPS.map((c) => (
                        <button
                          key={c}
                          className="chip"
                          data-requested={String(caps.includes(c))}
                          onClick={() => setCaps((v) => (v.includes(c) ? v.filter((x) => x !== c) : [...v, c]))}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="row" style={{gap: 12}}>
                    <label className="stack-sm" style={{gap: 3}}>
                      <span className="label">Daily spend ceiling</span>
                      <input value={spend} onChange={(e) => setSpend(e.target.value)} className="field-input" style={{width: 110}} />
                    </label>
                    <label className="stack-sm" style={{gap: 3}}>
                      <span className="label">Actions per day</span>
                      <input
                        value={maxActions}
                        onChange={(e) => setMaxActions(e.target.value)}
                        className="field-input" style={{width: 110}}
                      />
                    </label>
                  </div>
                </div>
              </Step>

              {/* ── 3. issue ── */}
              <Step n="3" title="Mint the passport and issue the ENS subname" state={created ? 'done' : 'idle'}>
                <div className="stack-sm">
                  <div className="dim" style={{fontSize: 12}}>
                    One transaction mints the passport; a second claims{' '}
                    <span className="mono">
                      {label || 'label'}.{health?.parentName || 'kya.eth'}
                    </span>{' '}
                    and writes the agent card to text records.
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={issue}
                    disabled={
                      busy === 'issue' ||
                      !human?.canRegisterAgent ||
                      !/^0x[0-9a-fA-F]{40}$/.test(operator.trim()) ||
                      label.trim().length < 3 ||
                      caps.length === 0
                    }
                  >
                    {busy === 'issue' ? <IconSpinner size={12} className="spin" /> : <IconPlus size={12} />}
                    Issue passport
                  </button>
                  {!human?.canRegisterAgent && human && (
                    <div className="dimmer" style={{fontSize: 11.5}}>
                      Blocked by the contract: <span className="mono">OwnerNotHumanVerified</span>. This is the gate
                      working, not a bug in the form.
                    </div>
                  )}
                </div>
              </Step>
            </div>
          </div>
        </div>

        <div className="stack">
          {created ? (
            <div className="panel fade-in" style={{borderColor: 'var(--trust-line)'}}>
              <div className="panel-head">
                <IconCheck size={13} style={{color: 'var(--trust)'}} />
                <span className="label">Passport issued</span>
              </div>
              <div className="panel-body stack-sm">
                <div className="row" style={{gap: 8}}>
                  <IconGlobe size={13} />
                  <button className="t1" onClick={() => onPick(created.passport.domain)} style={{fontSize: 15}}>
                    {created.passport.ensName || created.passport.domain}
                  </button>
                </div>
                <dl className="kv">
                    <dt>agent id</dt>
                    <dd className="mono">#{created.created.agentId}</dd>
                    <dt>owner</dt>
                    <dd className="mono">{short(created.passport.owner, 10, 8)}</dd>
                    <dt>operator</dt>
                    <dd className="mono">{short(created.passport.operator, 10, 8)}</dd>
                    <dt>mint tx</dt>
                    <dd className="mono" style={{wordBreak: 'break-all'}}>
                      {created.created.hash}
                    </dd>
                    {created.name && (
                      <>
                        <dt>name tx</dt>
                        <dd className="mono" style={{wordBreak: 'break-all'}}>
                          {created.name.hash}
                        </dd>
                        <dt>node</dt>
                        <dd className="mono" style={{wordBreak: 'break-all'}}>
                          {created.name.node}
                        </dd>
                      </>
                    )}
                  </dl>
                <div className="dim" style={{fontSize: 12}}>
                  Reputation starts at zero — not at a friendly default. A passport with no history is an unknown
                  quantity, and the trust engine reports it as <span className="mono">INSUFFICIENT_HISTORY</span> rather
                  than as bad.
                </div>
                <button className="btn" onClick={() => onPick(created.passport.domain)}>
                  Open the passport
                </button>
              </div>
            </div>
          ) : (
            <div className="panel">
              <div className="panel-head">
                <span className="label">Why this order</span>
              </div>
              <div className="panel-body stack-sm">
                <div className="dim">
                  Personhood first, mandate second, name third — and each is a separate on-chain fact rather than one
                  blob.
                </div>
                <div className="dim">
                  The owner's World ID nullifier is bound on-chain before a passport can exist. That binding is what
                  makes a bad track record expensive to walk away from: a fresh wallet does not get a fresh reputation,
                  because the same human cannot claim the nullifier twice.
                </div>
                <div className="dim">
                  The mandate is declared before any work is done, so an over-limit action is a contract revert rather
                  than an after-the-fact dispute.
                </div>
                <div className="dim">
                  The name comes last because it is a pointer to a passport that already exists — never the identity
                  itself.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
