import React, {useEffect, useRef, useState} from 'react';
import {pct, short, amount, ago, clock, nameOf, SPEND_SYMBOL} from '../lib/api.js';
import {IconCheck, IconX, IconWarn, IconShield, IconLock} from './icons.jsx';

/* ── score dial ─────────────────────────────────────────────────────────── */

export function Dial({score, size = 62, verdict = 'trust', label = 'rep'}) {
  const [shown, setShown] = useState(score);
  const [bump, setBump] = useState(false);
  const prev = useRef(score);

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
  const tone = {trust: '#22c55e', limit: '#eab308', decline: '#ef4444'}[verdict] || '#3b82f6';

  return (
    <div className={`relative flex items-center justify-center transition-transform duration-300 ${bump ? 'scale-110' : 'scale-100'}`} style={{width: size, height: size}}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - frac)}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono font-medium text-foreground" style={{fontSize: size * 0.28, lineHeight: 1}}>{Math.round(shown / 100)}%</span>
        <span className="font-mono uppercase tracking-widest text-muted-foreground/80 mt-0.5" style={{fontSize: size * 0.14, lineHeight: 1}}>{label}</span>
      </div>
    </div>
  );
}

/* ── holder mark ────────────────────────────────────────────────────────── */

function Holder({address, verdict}) {
  if (!address) {
    return (
      <div className="w-[60px] h-[60px] shrink-0 border border-destructive/20 bg-destructive/5 text-destructive flex items-center justify-center font-bold text-xl" title="No holder on record" aria-hidden="true">
        ✕
      </div>
    );
  }

  const hex = address.replace(/^0x/, '').toLowerCase().padEnd(40, '0');
  const tone = {trust: '#22c55e', limit: '#eab308', decline: '#ef4444'}[verdict] || '#3b82f6';

  const cells = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const src = col > 2 ? 4 - col : col;
      const nib = parseInt(hex[row * 3 + src], 16);
      const state = nib < 6 ? 0 : nib < 12 ? 1 : 2;
      cells.push(
        <i
          key={`${row}-${col}`}
          className="w-full h-full block"
          style={{
            background: state === 0 ? 'transparent' : state === 1 ? 'rgba(255,255,255,0.2)' : tone,
          }}
        />,
      );
    }
  }
  return (
    <div className="w-[60px] h-[60px] shrink-0 grid grid-cols-5 grid-rows-5 gap-0.5 border border-white/10 p-1 bg-black/40" title={address} aria-hidden="true">
      {cells}
    </div>
  );
}

function DataFields({passport}) {
  const auth = passport?.authority;
  const iso = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);
  const fields = [
    ['Passport', passport ? `#${passport.agentId}` : 'none', null],
    ['Operator', passport ? short(passport.operator) : 'none', passport?.operator],
    ['Accountable owner', passport ? short(passport.owner) : 'nobody', passport?.owner],
    ['Issued', passport ? iso(passport.registeredAt) : 'never', passport ? ago(passport.registeredAt) : null],
    ['Expires', !passport ? 'n/a' : auth.expiresAt === 0 ? 'no expiry' : iso(auth.expiresAt), null],
  ];
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-3 mt-3 text-xs">
      {fields.map(([k, v, hint]) => (
        <div key={k} className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{k}</span>
          <span className="font-mono text-foreground" title={hint || undefined}>
            {v}
          </span>
        </div>
      ))}
    </div>
  );
}

function Mrz({passport, auth, rep, rows = 4}) {
  const all = [
    ['AGT', `eip155:${passport.chainId}:${passport.registry}/${passport.agentId}`],
    ['NUL', passport.ownerNullifier],
    ['CAP', auth.capabilityRoot],
    ['LOG', rep.logHead],
  ];
  return (
    <div className="bg-black text-muted-foreground/70 p-4 font-mono text-[10px] md:text-xs leading-relaxed border-t border-white/10 uppercase tracking-widest">
      {all.slice(0, rows).map(([k, v]) => (
        <div className="flex gap-4 mb-1 last:mb-0 break-all" key={k}>
          <span className="font-bold text-muted-foreground w-8 shrink-0">{k}</span>
          <span>{v}</span>
        </div>
      ))}
    </div>
  );
}

/* ── verdict badge ──────────────────────────────────────────────────────── */

export function VerdictBadge({verdict, children}) {
  const Icon = verdict === 'trust' ? IconCheck : verdict === 'limit' ? IconWarn : IconX;
  const colors = {
    trust: 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30',
    limit: 'bg-[#eab308]/10 text-[#eab308] border-[#eab308]/30',
    decline: 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-mono tracking-wider uppercase ${colors[verdict]}`}>
      <Icon size={12} />
      {children || verdict}
    </span>
  );
}

/* ── humanhood badge ────────────────────────────────────────────────────── */

function HumanBadge({passport}) {
  if (passport.humanVerified) {
    const world = passport.proofIsWorldApp;
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-mono tracking-wider uppercase bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30"
        title={
          world
            ? `World ID ${passport.proofKindName} proof under ${passport.proofAppId}; nullifier bound on-chain`
            : `Attested locally under "${passport.proofAppId || 'local'}". No World ID app is configured, so the nullifier is bound on-chain but was never checked against World.`
        }
      >
        <IconShield size={12} />
        {world ? `Human-backed · World ${passport.proofKindName}` : 'Human-backed · attested locally'}
      </span>
    );
  }
  const simulator = passport.proofKind === 3;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-mono tracking-wider uppercase bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30"
      title={simulator ? 'World ID simulator proof. A staging credential, not proof of a unique human.' : 'No World ID proof on record'}
    >
      <IconX size={12} />
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
    const toneClass = c.pass ? 'text-primary' : c.level === 'hard' ? 'text-destructive' : 'text-amber-500';
    return (
      <div className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0 text-sm">
        <span className={`mt-0.5 shrink-0 ${toneClass}`}>
          <Icon size={14} />
        </span>
        <span className="font-mono text-xs w-[120px] shrink-0 text-foreground">{c.id}</span>
        <span className="text-muted-foreground leading-snug">{c.detail}</span>
      </div>
    );
  };

  return (
    <div className="border-t border-white/10 px-6 py-4 bg-white/[0.02]">
      {collapsed && (
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {decision.checks.filter((c) => c.pass).length}/{decision.checks.length} checks passed
          </span>
          <button className="text-xs font-mono uppercase text-muted-foreground hover:text-foreground transition-colors" onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide evidence' : 'Show evidence'}
          </button>
        </div>
      )}
      {open && (
        <div className="animate-in fade-in duration-300">
          <div className="flex items-center gap-2 mb-3 mt-2">
            <IconLock size={12} className="text-muted-foreground" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Hard gates: identity and mandate. A failure here cannot be outvoted.</span>
          </div>
          <div className="flex flex-col mb-4 bg-black/20 rounded-md border border-white/5 p-2">
            {hard.map((c) => (
              <Row key={c.id} c={c} />
            ))}
          </div>
          {soft.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Soft signals: track record. Shapes the limit, not the identity.</span>
              </div>
              <div className="flex flex-col bg-black/20 rounded-md border border-white/5 p-2">
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
  showCapabilities = true,
  showDial = true,
  mrzRows = 4,
  collapsedChecks = false,
  compact = false,
  onOpen = null,
  recommended = false,
  maxFields = null,
}) {
  const verdict = decision?.verdict || 'decline';
  const borderColors = {
    trust: 'border-primary',
    limit: 'border-amber-500/50',
    decline: 'border-destructive/50',
  };

  if (!passport) {
    return (
      <div className={`rounded-xl border ${borderColors['decline']} bg-black/60 backdrop-blur-xl overflow-hidden flex flex-col shadow-2xl`}>
        <div className="flex items-center justify-between px-5 py-2.5 bg-black/40 border-b border-white/10 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Agent passport</span>
          <span>not on record</span>
        </div>
        <div className="p-6 flex items-start gap-6">
          <Holder address={null} />
          <div className="flex flex-col flex-1">
            <div className="text-xl font-medium font-mono text-muted-foreground/60 mb-2">No passport on record</div>
            <DataFields passport={null} />
            <div className="mt-4 flex flex-wrap gap-2">
              <VerdictBadge verdict="decline">No accountable human</VerdictBadge>
            </div>
          </div>
        </div>
        <div className="flex items-start gap-4 p-6 bg-destructive/10 border-t border-destructive/20">
          <IconX size={20} className="text-destructive mt-1 shrink-0" />
          <div>
            <div className="text-lg font-medium text-destructive mb-1">Nothing to verify</div>
            <div className="text-sm text-destructive/80 leading-relaxed max-w-[60ch]">
              There is no registry entry, so there is no accountable owner, no declared mandate and no witnessed
              history. This is the default state of every AI agent on the internet today.
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

  const TrustIcon = verdict === 'trust' ? IconCheck : verdict === 'limit' ? IconWarn : IconX;
  const verdictColors = {
    trust: 'text-primary bg-primary/10 border-primary/20',
    limit: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    decline: 'text-destructive bg-destructive/10 border-destructive/20',
  };

  return (
    <div className={`rounded-xl border ${recommended ? 'border-primary shadow-[0_0_30px_rgba(34,197,94,0.15)]' : 'border-white/10'} bg-[#121314]/90 backdrop-blur-xl overflow-hidden flex flex-col shadow-xl transition-all`}>
      <div className="flex items-center justify-between px-5 py-2.5 bg-black/60 border-b border-white/10 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/80">
        <span>Agent passport</span>
        <span>KYA registry · eip155:{passport.chainId}</span>
      </div>

      <div className="p-5 md:p-6 flex flex-col md:flex-row items-start gap-5 md:gap-6 border-b border-white/5 relative">
        <Holder address={passport.operator} verdict={verdict} />
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-3">
            {onOpen ? (
              <button className="text-xl md:text-2xl font-mono text-foreground hover:text-primary transition-colors hover:underline truncate" onClick={onOpen} title="Open the full passport">
                {nameOf(passport)}
              </button>
            ) : (
              <span className="text-xl md:text-2xl font-mono text-foreground truncate">{nameOf(passport)}</span>
            )}
            {!passport.active && (
              <span className="inline-flex px-2 py-0.5 rounded bg-destructive/20 text-destructive text-[10px] font-mono uppercase tracking-widest border border-destructive/30">
                deactivated
              </span>
            )}
          </div>
          <DataFields passport={passport} />
          <div className="mt-4 flex flex-wrap gap-2">
            <HumanBadge passport={passport} />
            {showHeadBadge && decision && <VerdictBadge verdict={verdict}>{decision.headline}</VerdictBadge>}
          </div>
        </div>
      </div>

      {decision && (
        <div className={`flex items-center gap-4 p-5 md:p-6 border-b border-white/5 ${verdictColors[verdict].replace('text-', 'bg-').replace('/10', '/5')}`}>
          <TrustIcon size={24} className={`shrink-0 ${verdictColors[verdict].split(' ')[0]}`} />
          <div className="flex-1">
            <div className={`text-lg font-medium mb-1 ${verdictColors[verdict].split(' ')[0]}`}>{decision.headline}</div>
            <div className="text-sm text-foreground/80 leading-relaxed max-w-[70ch]">{decision.summary}</div>
          </div>
          {showDial && (
            <div className="shrink-0 hidden sm:block">
              <Dial score={rep.score} verdict={verdict} size={compact ? 52 : 64} />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-8 p-5 md:p-6 bg-white/[0.01]">
        {[
          <div className="flex flex-col gap-1" key="rep">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Reputation</div>
            <div className="text-2xl font-mono font-medium text-foreground">{pct(rep.score)}</div>
            <div className="text-xs text-muted-foreground mt-1 leading-snug">
              {rep.successRatePct.toFixed(1)}% raw ({rep.success}/{rep.total})
              {rep.rejected > 0 && (
                <span className="text-destructive"> and {rep.rejected} blocked</span>
              )}
            </div>
          </div>,
          <div className="flex flex-col gap-1" key="conf">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Confidence</div>
            <div className="text-2xl font-mono text-foreground">{decision ? `${Math.round(decision.confidence * 100)}%` : 'n/a'}</div>
            <div className="text-xs text-muted-foreground mt-1 leading-snug">how much the record can be leaned on</div>
          </div>,
          <div className="flex flex-col gap-1" key="spend">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Spend left today</div>
            <div className="text-2xl font-mono text-foreground">
              {amount(auth.spendRemainingTodayEth)} <span className="text-muted-foreground/60">{SPEND_SYMBOL}</span>{' '}
              <span className="text-muted-foreground text-sm">of {amount(auth.spendLimitPerDayEth)}</span>
            </div>
            <div className="w-full h-1 bg-white/10 rounded-full mt-1.5 overflow-hidden">
              <div 
                className={`h-full rounded-full ${spendFrac > 0.4 ? 'bg-primary' : spendFrac > 0.1 ? 'bg-amber-500' : 'bg-destructive'}`} 
                style={{width: `${Math.max(2, spendFrac * 100)}%`}} 
              />
            </div>
            <div className="text-xs text-muted-foreground mt-1 leading-snug">resets at 00:00 UTC</div>
          </div>,
          <div className="flex flex-col gap-1" key="cap">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Action cap</div>
            <div className="text-2xl font-mono text-foreground">{auth.maxActionsPerDay || '∞'}</div>
            <div className="text-xs text-muted-foreground mt-1 leading-snug">per UTC day, enforced on settle</div>
          </div>,
          <div className="flex flex-col gap-1" key="vol">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Volume handled</div>
            <div className="text-2xl font-mono text-foreground">
              {amount(rep.volumeHandledEth)} <span className="text-muted-foreground/60">{SPEND_SYMBOL}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1 leading-snug">across successful actions only</div>
          </div>,
          <div className="flex flex-col gap-1" key="last">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Last action</div>
            <div className="text-base md:text-lg font-mono text-foreground py-0.5">
              {rep.total ? ago(rep.lastActionAt) : 'never'}
            </div>
            <div className="text-xs text-muted-foreground mt-1 leading-snug">
              {rep.total ? `first ${new Date(rep.firstActionAt * 1000).toISOString().slice(0, 10)}` : 'no history yet'}
            </div>
          </div>,
        ].slice(0, maxFields || undefined)}
      </div>

      {showCapabilities && (
        <div className="px-5 md:px-6 py-4 border-t border-white/5 bg-white/[0.01]">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Granted capabilities · from ENS text record agent.capabilities</div>
          <div className="flex flex-wrap gap-2">
            {passport.capabilities.length === 0 && <span className="text-sm text-muted-foreground">none granted</span>}
            {passport.capabilities.map((c) => (
              <span key={c} className={`px-2.5 py-1 rounded text-xs font-mono border ${c === requestedCapability ? 'bg-primary/20 text-primary border-primary/50' : 'bg-white/5 text-foreground border-white/10'}`}>
                {c}
              </span>
            ))}
            {requestedCapability && !passport.capabilities.includes(requestedCapability) && (
              <span className="px-2.5 py-1 rounded text-xs font-mono bg-destructive/10 text-destructive border border-destructive/30 line-through decoration-destructive/50 decoration-2">
                {requestedCapability}
              </span>
            )}
          </div>
          {passport.textRecords?.description && (
            <div className="text-sm text-muted-foreground mt-4 leading-relaxed border-l-2 border-white/10 pl-3">
              {passport.textRecords.description}
            </div>
          )}
        </div>
      )}

      {showChecks && decision && <Checks decision={decision} collapsed={collapsedChecks} />}

      {showLog && (
        <div className="border-t border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 md:px-6 py-3 bg-white/5 gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Witnessed action log · {passport.actionCount} receipts
              {integrity && (
                <span className={`ml-3 ${integrity.verified ? 'text-primary' : 'text-destructive'}`}>
                  {integrity.verified ? 'hash chain verified' : 'CHAIN MISMATCH'}
                </span>
              )}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 hidden md:block">executor-witnessed, never self-reported</span>
          </div>
          <div className="bg-[#0a0a0a] max-h-[300px] overflow-y-auto custom-scrollbar p-2">
            {passport.actions.length === 0 && <div className="text-sm text-muted-foreground p-4 text-center">No actions witnessed yet.</div>}
            <div className="flex flex-col gap-1">
              {passport.actions.map((a) => (
                <div key={`${a.index}-${a.evidence}`} className={`grid grid-cols-[30px_100px_1fr_80px] gap-2 md:gap-4 items-center px-3 py-2 rounded text-xs font-mono ${a.index === freshActionIndex ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                  <span className="text-muted-foreground/50">#{a.index}</span>
                  <span className={`flex items-center gap-1.5 ${a.outcome === 'success' ? 'text-primary' : a.outcome === 'rejected' ? 'text-destructive' : 'text-amber-500'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {a.outcome}
                  </span>
                  <span className="text-foreground truncate" title={`${a.kind} · ${a.evidence}`}>
                    {a.kind} <span className="text-muted-foreground">· {a.evidence.slice(0, 14)}…</span>
                  </span>
                  <span className="text-muted-foreground text-right">{a.valueEth === '0' ? 'no value' : amount(a.valueEth)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Mrz passport={passport} auth={auth} rep={rep} rows={mrzRows} />
    </div>
  );
}
