/**
 * The passport document.
 *
 * Structured like a real machine-readable travel document rather than a
 * dashboard card: a human-readable data page (identity, authority, reputation)
 * above a machine-readable zone carrying the actual on-chain primary keys. The
 * MRZ is not ornament — it is the agent id, the owner nullifier, the capability
 * root and the log-chain head, selectable so a judge can copy one and check it
 * against the chain.
 *
 * The verdict is rendered ABOVE the data, because the product's output is a
 * decision, not a data dump. Hard gates are visually separated from soft signals
 * so it is obvious that a good track record cannot outvote a missing identity.
 */
import React, {useEffect, useRef, useState} from 'react';
import {pct, short, amount, ago, clock, nameOf} from '../lib/api.js';
import {IconCheck, IconX, IconWarn, IconShield, IconLock} from './icons.jsx';

/* ── score dial ─────────────────────────────────────────────────────────── */

export function Dial({score, size = 62, verdict = 'trust', label = 'rep'}) {
  const [shown, setShown] = useState(score);
  const [bump, setBump] = useState(false);
  const prev = useRef(score);

  // Animate on change so a live reputation update is visible from the back of
  // the room, then get out of the way.
  useEffect(() => {
    if (prev.current === score) return;
    const rising = score > prev.current;
    prev.current = score;
    setShown(score);
    if (rising) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 600);
      return () => clearTimeout(t);
    }
  }, [score]);

  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, shown / 10_000));
  const tone = {trust: 'var(--trust)', limit: 'var(--limit)', decline: 'var(--decline)'}[verdict] || 'var(--accent)';

  return (
    <div className={`dial${bump ? ' bump' : ''}`} style={{width: size, height: size}}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
        <circle
          className="dial-arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - frac)}
        />
      </svg>
      {/* Value carries its unit. "90.6" next to a sidebar reading "91%" looks like
          two different numbers for the same thing. */}
      <div className="dial-center">
        <span className="dial-value">{(shown / 100).toFixed(1)}%</span>
        <span className="dial-unit">{label}</span>
      </div>
    </div>
  );
}

/* ── holder mark ────────────────────────────────────────────────────────── */

/**
 * A 5x5 symmetric identicon derived from the operator address. An identity
 * document without a holder mark reads as a dashboard widget, and a photo would
 * be a lie — an agent has no face. The address itself is the likeness, so it is
 * rendered directly: same address always produces the same mark, and two agents
 * are visually distinct at a glance in a side-by-side comparison.
 */
function Holder({address, verdict}) {
  const hex = (address || '0x0').replace(/^0x/, '').padEnd(40, '0');
  const tone = {trust: 'var(--trust)', limit: 'var(--limit)', decline: 'var(--decline)'}[verdict] || 'var(--accent)';

  const cells = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      // Mirror columns 3-4 onto 1-0 so the mark is symmetric like a real emblem.
      const src = col > 2 ? 4 - col : col;
      const nib = parseInt(hex[(row * 3 + src) % hex.length], 16);
      const on = nib % 10 > 3;
      const strong = nib > 11;
      cells.push(
        <i
          key={`${row}-${col}`}
          style={{
            background: on ? (strong ? tone : 'rgba(255,255,255,0.14)') : 'transparent',
            opacity: on ? (strong ? 0.85 : 1) : 1,
          }}
        />,
      );
    }
  }
  return (
    <div className="holder" title={address} aria-hidden="true">
      {cells}
    </div>
  );
}

/* ── verdict badge ──────────────────────────────────────────────────────── */

export function VerdictBadge({verdict, children}) {
  const Icon = verdict === 'trust' ? IconCheck : verdict === 'limit' ? IconWarn : IconX;
  return (
    <span className="verdict" data-v={verdict}>
      <Icon size={11} />
      {children || verdict}
    </span>
  );
}

/* ── humanhood badge ────────────────────────────────────────────────────── */

function HumanBadge({passport}) {
  if (passport.humanVerified) {
    return (
      <span className="verdict" data-v="trust" title={`World ID ${passport.proofKindName} proof, nullifier bound on-chain`}>
        <IconShield size={11} />
        Human-backed
      </span>
    );
  }
  const simulator = passport.proofKind === 3;
  return (
    <span
      className="verdict"
      data-v="decline"
      title={simulator ? 'World ID simulator proof — a staging credential, not proof of a unique human' : 'No World ID proof on record'}
    >
      <IconX size={11} />
      {simulator ? 'Simulator only' : 'Unverified'}
    </span>
  );
}

/* ── checks list ────────────────────────────────────────────────────────── */

export function Checks({decision, collapsed = false}) {
  const [open, setOpen] = useState(!collapsed);
  if (!decision) return null;

  const hard = decision.checks.filter((c) => c.level === 'hard');
  const soft = decision.checks.filter((c) => c.level === 'soft');

  const Row = ({c}) => {
    const Icon = c.pass ? IconCheck : c.level === 'hard' ? IconX : IconWarn;
    return (
      <div className="check" data-pass={String(c.pass)} data-level={c.level}>
        <span className="tick">
          <Icon size={12} />
        </span>
        <span className="check-id">{c.id}</span>
        <span className="check-detail">{c.detail}</span>
      </div>
    );
  };

  return (
    <div>
      {collapsed && (
        <div className="gate-split row-between">
          <span className="label">
            {decision.checks.filter((c) => c.pass).length}/{decision.checks.length} checks passed
          </span>
          <button className="btn btn-sm" onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide evidence' : 'Show evidence'}
          </button>
        </div>
      )}
      {open && (
        <div className="fade-in">
          <div className="gate-split row">
            <IconLock size={11} />
            <span className="label">Hard gates — identity &amp; mandate. A failure here cannot be outvoted.</span>
          </div>
          <div className="checks">
            {hard.map((c) => (
              <Row key={c.id} c={c} />
            ))}
          </div>
          {soft.length > 0 && (
            <>
              <div className="gate-split">
                <span className="label">Soft signals — track record. Shapes the limit, not the identity.</span>
              </div>
              <div className="checks">
                {soft.map((c) => (
                  <Row key={c.id} c={c} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── the passport ───────────────────────────────────────────────────────── */

export function Passport({
  passport,
  decision,
  integrity,
  requestedCapability = null,
  freshActionIndex = null,
  showLog = true,
  showChecks = true,
  showHeadBadge = true,
  collapsedChecks = false,
  compact = false,
}) {
  const verdict = decision?.verdict || 'decline';

  if (!passport) {
    return (
      <div className="passport" data-verdict="decline">
        <div className="pp-head">
          <div className="holder" aria-hidden="true" style={{opacity: 0.3}} />
          <div className="pp-title">
            <div className="pp-name dim">No passport on record</div>
            <div className="pp-meta">
              <div>
                <span className="label">Holder</span>
                <span className="v">—</span>
              </div>
              <div>
                <span className="label">Issued</span>
                <span className="v">never</span>
              </div>
            </div>
          </div>
        </div>
        <div className="verdict-block">
          <IconX size={16} style={{color: 'var(--decline)', flexShrink: 0, marginTop: 2}} />
          <div className="verdict-copy">
            <div className="verdict-headline">Nothing to verify</div>
            <div className="verdict-summary">
              There is no registry entry, so there is no accountable owner, no declared mandate and no witnessed
              history. This is the default state of every agent on the internet today.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const rep = passport.reputation;
  const auth = passport.authority;
  const spendFrac =
    Number(auth.spendLimitPerDay) > 0
      ? Number(auth.spendRemainingToday) / Number(auth.spendLimitPerDay)
      : 1;

  return (
    <div className="passport" data-verdict={verdict}>
      {/* ── data page header ── */}
      <div className="pp-head">
        <Holder address={passport.operator} verdict={verdict} />
        <div className="pp-title">
          <div className="pp-name">
            {nameOf(passport)}
            {!passport.active && (
              <span className="verdict" data-v="decline">
                deactivated
              </span>
            )}
          </div>
          <div className="pp-meta">
            <div>
              <span className="label">Passport</span>
              <span className="v">#{passport.agentId}</span>
            </div>
            <div>
              <span className="label">Operator</span>
              <span className="v">{short(passport.operator)}</span>
            </div>
            <div>
              <span className="label">Accountable owner</span>
              <span className="v">{short(passport.owner)}</span>
            </div>
            <div>
              <span className="label">Issued</span>
              <span className="v">{ago(passport.registeredAt)}</span>
            </div>
            <div>
              <span className="label">Expires</span>
              <span className="v">
                {auth.expiresAt === 0 ? 'never' : new Date(auth.expiresAt * 1000).toISOString().slice(0, 10)}
              </span>
            </div>
          </div>
          <div className="row" style={{marginTop: 9, flexWrap: 'wrap', gap: 6}}>
            <HumanBadge passport={passport} />
            {/* The verdict lives in the block below. Repeating it here as a badge
                gives the same claim two voices with no stated authority. */}
            {showHeadBadge && decision && <VerdictBadge verdict={verdict}>{decision.headline}</VerdictBadge>}
          </div>
        </div>
      </div>

      {/* ── verdict, above the data: the output is a decision ── */}
      {decision && (
        <div className="verdict-block">
          {verdict === 'trust' ? (
            <IconCheck size={16} style={{color: 'var(--trust)', flexShrink: 0, marginTop: 2}} />
          ) : verdict === 'limit' ? (
            <IconWarn size={16} style={{color: 'var(--limit)', flexShrink: 0, marginTop: 2}} />
          ) : (
            <IconX size={16} style={{color: 'var(--decline)', flexShrink: 0, marginTop: 2}} />
          )}
          <div className="verdict-copy">
            <div className="verdict-headline">{decision.headline}</div>
            <div className="verdict-summary">{decision.summary}</div>
          </div>
          {/* The dial sits beside the verdict rather than above it. Reputation is a
              soft signal — it shapes the limit, it does not decide the gate — so it
              should not be the largest object on the document. */}
          <Dial score={rep.score} verdict={verdict} size={compact ? 52 : 58} />
        </div>
      )}

      {/* ── fields ── */}
      <div className="pp-grid">
        <div className="field">
          <div className="label">Reputation</div>
          <div className="field-value num">{pct(rep.score)}</div>
          <div className="field-note">
            {rep.success}/{rep.total} witnessed
            {rep.rejected > 0 && <span style={{color: 'var(--decline)'}}> · {rep.rejected} blocked</span>}
          </div>
        </div>

        <div className="field">
          <div className="label">Confidence</div>
          <div className="field-value num">{decision ? `${Math.round(decision.confidence * 100)}%` : '—'}</div>
          <div className="field-note">how much the record can be leaned on</div>
        </div>

        <div className="field">
          <div className="label">Spend today</div>
          <div className="field-value num">
            {amount(auth.spendRemainingTodayEth)} <span className="dimmer">/ {amount(auth.spendLimitPerDayEth)}</span>
          </div>
          <div className="meter" data-tone={spendFrac > 0.4 ? 'trust' : spendFrac > 0.1 ? 'limit' : 'decline'}>
            <span style={{width: `${Math.max(2, spendFrac * 100)}%`}} />
          </div>
        </div>

        <div className="field">
          <div className="label">Action cap</div>
          <div className="field-value num">{auth.maxActionsPerDay || '∞'}</div>
          <div className="field-note">per UTC day, enforced on settle</div>
        </div>

        <div className="field">
          <div className="label">Authority</div>
          <div className="field-value">
            {auth.expiresAt === 0 ? 'No expiry' : new Date(auth.expiresAt * 1000).toISOString().slice(0, 10)}
          </div>
          <div className="field-note">owner can revoke at any time</div>
        </div>

        <div className="field">
          <div className="label">Last action</div>
          <div className="field-value">{rep.total ? ago(rep.lastActionAt) : 'never'}</div>
          <div className="field-note">{rep.total ? `volume ${amount(rep.volumeHandledEth)}` : 'no history yet'}</div>
        </div>
      </div>

      {/* ── capabilities ── */}
      <div className="field" style={{borderRight: 'none'}}>
        <div className="label">Granted capabilities · from ENS text record agent.capabilities</div>
        <div className="chips">
          {passport.capabilities.length === 0 && <span className="dimmer">none granted</span>}
          {passport.capabilities.map((c) => (
            <span key={c} className="chip" data-requested={String(c === requestedCapability)}>
              {c}
            </span>
          ))}
          {requestedCapability && !passport.capabilities.includes(requestedCapability) && (
            <span className="chip" data-missing="true">
              {requestedCapability}
            </span>
          )}
        </div>
        {passport.textRecords?.description && (
          <div className="field-note" style={{marginTop: 8, whiteSpace: 'normal'}}>
            {passport.textRecords.description}
          </div>
        )}
      </div>

      {/* ── evidence ── */}
      {showChecks && decision && <Checks decision={decision} collapsed={collapsedChecks} />}

      {/* ── action log ── */}
      {showLog && (
        <>
          <div className="gate-split row-between">
            <span className="label">
              Witnessed action log · {passport.actionCount} receipts
              {integrity && (
                <span style={{color: integrity.verified ? 'var(--trust)' : 'var(--decline)', marginLeft: 8}}>
                  {integrity.verified ? 'hash chain verified' : 'CHAIN MISMATCH'}
                </span>
              )}
            </span>
            <span className="label">executor-witnessed, never self-reported</span>
          </div>
          <div className="log">
            {passport.actions.length === 0 && <div className="empty">No actions witnessed yet.</div>}
            {passport.actions.map((a) => (
              <div key={`${a.index}-${a.evidence}`} className={`log-row${a.index === freshActionIndex ? ' fresh' : ''}`}>
                <span className="dimmer num">#{a.index}</span>
                <span className="out" data-o={a.outcome}>
                  <span className="dot" />
                  {a.outcome}
                </span>
                <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                  {a.kind} <span className="dimmer">· {a.evidence.slice(0, 14)}…</span>
                </span>
                <span className="dimmer num">{a.valueEth === '0' ? '—' : amount(a.valueEth)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── machine-readable zone: the real on-chain primary keys ── */}
      <div className="mrz">
        <div className="mrz-row">
          <span className="mrz-key">AGT</span>
          <span>
            eip155:{passport.chainId}:{passport.registry}/{passport.agentId}
          </span>
        </div>
        <div className="mrz-row">
          <span className="mrz-key">NUL</span>
          <span>{passport.ownerNullifier}</span>
        </div>
        <div className="mrz-row">
          <span className="mrz-key">CAP</span>
          <span>{auth.capabilityRoot}</span>
        </div>
        <div className="mrz-row">
          <span className="mrz-key">LOG</span>
          <span>{rep.logHead}</span>
        </div>
      </div>
    </div>
  );
}
