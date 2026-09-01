/**
 * Sponsor accounting — FR/user-story 7.
 *
 * A judge should not have to take our word for which sponsor features were used.
 * This view reads /api/integrations, which is generated from the running config,
 * and states for each surface: what feature, what role in the product, why it is
 * NOT interchangeable with the others, and whether it is currently live or
 * standing in locally.
 *
 * The live/local badge is the important part. An unlabeled stand-in would be a
 * lie by omission, so the mode travels with the data from the server and is
 * rendered verbatim here.
 */
import React, {useEffect, useState} from 'react';
import {api, short} from '../lib/api.js';
import {IconShield, IconGlobe, IconChip, IconCheck, IconWarn} from '../components/icons.jsx';

const ICON = {world: IconShield, ens: IconGlobe, og: IconChip};

export default function Sponsors() {
  const [data, setData] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.integrations(), api.health()])
      .then(([i, h]) => {
        setData(i);
        setHealth(h);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="view"><div className="err">{error}</div></div>;
  if (!data) {
    return (
      <div className="view">
        <div className="grid-3">
          <div className="skeleton" style={{height: 300, borderRadius: 12}} />
          <div className="skeleton" style={{height: 300, borderRadius: 12}} />
          <div className="skeleton" style={{height: 300, borderRadius: 12}} />
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <div className="view-head">
        <h1 className="display">What each sponsor is load-bearing for</h1>
        <p>
          Three integrations, three jobs that cannot be swapped. Read live from the running configuration — if a surface
          is standing in locally, it says so here and everywhere else in the product.
        </p>
      </div>

      <div className="grid-3">
        {['world', 'ens', 'og'].map((key) => {
          const s = data[key];
          const Icon = ICON[key];
          return (
            <div key={key} className="sponsor">
              <div className="row-between">
                <div className="row" style={{gap: 8}}>
                  <Icon size={15} />
                  <h3>{s.surface}</h3>
                </div>
                <span className="mode" data-live={String(s.live)}>
                  {s.live ? <IconCheck size={10} /> : <IconWarn size={10} />}
                  {s.live ? 'live' : 'local'}
                </span>
              </div>

              <div className="mono dimmer" style={{fontSize: 10.5}}>
                {s.mode}
              </div>

              <div>
                <div className="label">Feature used</div>
                <div style={{marginTop: 3, color: 'var(--t2)'}}>{s.feature}</div>
              </div>

              <div>
                <div className="label">Its job in KYA</div>
                <div style={{marginTop: 3, color: 'var(--t2)'}}>{s.role}</div>
              </div>

              <div
                style={{
                  padding: '10px 12px',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.014)',
                }}
              >
                <div className="label">Why it is not interchangeable</div>
                <div style={{marginTop: 4, color: 'var(--t2)', fontSize: 12.5}}>{s.whyNecessary}</div>
              </div>

              <div className="sponsor" style={{border: 'none', padding: 0, background: 'none', gap: 0}}>
                <dl>
                  {s.contract && (
                    <>
                      <dt>contract</dt>
                      <dd className="mono">{short(s.contract, 10, 8)}</dd>
                    </>
                  )}
                  {s.appId && (
                    <>
                      <dt>app id</dt>
                      <dd className="mono">{s.appId}</dd>
                    </>
                  )}
                  {s.action && (
                    <>
                      <dt>action</dt>
                      <dd className="mono">{s.action}</dd>
                    </>
                  )}
                  {s.parentName && (
                    <>
                      <dt>parent</dt>
                      <dd className="mono">{s.parentName}</dd>
                    </>
                  )}
                  {s.model && (
                    <>
                      <dt>model</dt>
                      <dd className="mono">{s.model}</dd>
                    </>
                  )}
                  {s.attestorSigner && (
                    <>
                      <dt>signer</dt>
                      <dd className="mono">{short(s.attestorSigner, 10, 8)}</dd>
                    </>
                  )}
                </dl>
              </div>

              <div className="dimmer" style={{fontSize: 11.5, marginTop: 'auto'}}>
                {s.note}
              </div>
            </div>
          );
        })}
      </div>

      {/* deployment */}
      <div className="panel" style={{marginTop: 16}}>
        <div className="panel-head">
          <span className="label">Deployment · everything the UI reads comes from these addresses</span>
        </div>
        <div className="panel-body">
          <div className="sponsor" style={{border: 'none', padding: 0, background: 'none'}}>
            <dl>
              <dt>chain</dt>
              <dd className="mono">
                {health?.chainId} · {health?.rpcUrl}
              </dd>
              {Object.entries(health?.contracts || {}).map(([name, addr]) => (
                <React.Fragment key={name}>
                  <dt>{name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()}</dt>
                  <dd className="mono" style={{wordBreak: 'break-all'}}>
                    {addr}
                  </dd>
                </React.Fragment>
              ))}
              <dt>attestor</dt>
              <dd className="mono">{health?.accounts?.attestor}</dd>
              <dt>executor</dt>
              <dd className="mono">{health?.accounts?.executor}</dd>
            </dl>
          </div>
        </div>
      </div>

      {/* the honesty statement */}
      <div className="panel" style={{marginTop: 16, borderColor: 'var(--line-strong)'}}>
        <div className="panel-body stack-sm">
          <div className="label">On simulated paths</div>
          <div className="dim" style={{maxWidth: '82ch'}}>
            Where a credential is not configured, KYA runs a deterministic local stand-in and labels it{' '}
            <span className="mono">local:*</span> in the API, in this view, and on every result it produces. A World ID
            simulator proof is recorded on-chain as <span className="mono">ProofKind.WorldIdSimulator</span>, and{' '}
            <span className="mono">PassportRegistry.registerAgent</span> refuses it outright — a staging credential
            cannot become a verified human anywhere in this system. An unlabeled simulation would be a bug, not a
            fallback.
          </div>
        </div>
      </div>
    </div>
  );
}
