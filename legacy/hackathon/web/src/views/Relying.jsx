import React, {useEffect, useMemo, useRef, useState} from 'react';
import {api, pct, nameOf, short, SPEND_SYMBOL} from '../lib/api.js';
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
import {Card, CardContent, CardHeader} from '../components/ui/card';
import {Button} from '../components/ui/button';
import {Input} from '../components/ui/input';
import {Badge} from '../components/ui/badge';

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
  const resultRef = useRef(null);

  const maxValue = useMemo(() => {
    const n = Number(budget);
    return Number.isFinite(n) && n >= 0 ? BigInt(Math.round(n * 1e18)).toString() : '0';
  }, [budget]);

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
      const run = await api.route({capability, candidates: candidates.filter(Boolean), input, policy: {}});
      setResult(run);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!result?.run) return;
    const t = setTimeout(() => resultRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'}), 60);
    return () => clearTimeout(t);
  }, [result]);


  const run = result?.run;
  const delta = run?.reputationDelta;

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="font-mono bg-white/5 border-white/10 uppercase tracking-widest text-[10px]">third-party app</Badge>
          <span className="text-[11px] text-muted-foreground font-mono tracking-widest">this screen is not KYA, it is a customer of KYA</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Buy the cheapest flight</h1>
        <p className="text-muted-foreground mt-2 text-sm max-w-[80ch]">
          A booking app with a budget and three agents offering to do the job. It has no relationship with any of them.
          Before spending a rupee it asks the passport registry which one is accountable, in-mandate and proven, then
          dispatches to exactly that one.
        </p>
      </div>

      <Card className="mb-6 border-white/10 bg-black/40 backdrop-blur-md overflow-visible">
        <CardHeader className="py-3 px-5 border-b border-white/5 flex flex-row items-center gap-2 bg-white/5">
          <IconRoute size={14} className="text-muted-foreground" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">The task this app wants done</span>
        </CardHeader>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[180px] max-w-[240px]">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Task type</label>
              <select 
                value={capability} 
                onChange={(e) => setCapability(e.target.value)} 
                className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none font-mono"
              >
                {(tasks?.length ? tasks : [{capability: 'flight.quote', label: 'Cheapest-flight lookup'}]).map((t) => (
                  <option key={t.capability} value={t.capability}>
                    {t.label || t.capability}
                  </option>
                ))}
              </select>
            </div>

            {capability === 'research' ? (
              <div className="flex flex-col gap-1.5 flex-[2] min-w-[280px]">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Question</label>
                <Input value={question} onChange={(e) => setQuestion(e.target.value)} className="bg-background/50" />
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1.5 w-[80px]">
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Origin</label>
                  <Input value={from} onChange={(e) => setFrom(e.target.value.toUpperCase())} className="font-mono uppercase bg-background/50" />
                </div>
                <div className="flex flex-col gap-1.5 w-[80px]">
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Dest</label>
                  <Input value={to} onChange={(e) => setTo(e.target.value.toUpperCase())} className="font-mono uppercase bg-background/50" />
                </div>
                <div className="flex flex-col gap-1.5 w-[140px]">
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Departure</label>
                  <Input value={date} onChange={(e) => setDate(e.target.value)} className="font-mono bg-background/50" />
                </div>
              </>
            )}

            <div className="flex flex-col gap-1.5 w-[110px]">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Ceiling ({SPEND_SYMBOL})</label>
              <Input value={budget} onChange={(e) => setBudget(e.target.value)} className="font-mono bg-background/50" />
            </div>

            <div className="flex items-center h-10 ml-auto md:ml-0">
              <Button onClick={dispatch} disabled={busy} className="font-mono uppercase tracking-wider text-xs">
                {busy ? <IconSpinner size={14} className="animate-spin mr-2" /> : <IconArrowRight size={14} className="mr-2" />}
                {busy ? 'Running' : 'Check passports & dispatch'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-md text-sm font-mono mb-6">{error}</div>}

      <Card className="mb-6 border-white/10 bg-black/40 backdrop-blur-md">
        <CardHeader className="py-3 px-5 border-b border-white/5 flex flex-row items-center gap-2 bg-white/5">
          <IconShield size={14} className="text-muted-foreground" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Candidates · verdict read from the registry before any work is commissioned</span>
        </CardHeader>
        <CardContent className="p-0 flex flex-col divide-y divide-white/5">
          {(result?.candidates || preview || []).map((c) => {
            const chosen = result?.routed === c.query;
            const v = c.decision?.verdict || 'decline';
            return (
              <div
                key={c.query}
                className={`flex items-center gap-4 px-5 py-3 transition-colors ${chosen ? 'bg-primary/5' : ''}`}
              >
                <div className="w-[100px]">
                  <VerdictBadge verdict={v}>{v}</VerdictBadge>
                </div>
                <button
                  onClick={() => c.passport && onPick(nameOf(c.passport))}
                  className={`w-[180px] font-mono text-left truncate ${c.passport ? 'text-primary hover:underline cursor-pointer' : 'text-foreground cursor-default'}`}
                >
                  {c.query}
                </button>
                <span className="flex-1 text-sm text-muted-foreground">{c.decision?.summary || 'no verdict'}</span>
                <div className="flex items-center gap-3">
                  {c.passport && <span className="font-mono text-xs text-muted-foreground">{pct(c.passport.reputation.score)}</span>}
                  {chosen && <VerdictBadge verdict="trust">Dispatched</VerdictBadge>}
                </div>
              </div>
            );
          })}
          {result && !result.routed && (
            <div className="flex items-start gap-4 p-5 bg-destructive/5">
              <IconX size={20} className="text-destructive shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-foreground mb-1">Nothing was dispatched</div>
                <div className="text-sm text-muted-foreground">{result.reason}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {run && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500" ref={resultRef} style={{scrollMarginTop: 60}}>
          <Card className="border-white/10 bg-black/40 backdrop-blur-md overflow-hidden flex flex-col">
            <CardHeader className="py-3 px-5 border-b border-white/5 flex flex-row items-center gap-2 bg-white/5">
              <IconLayers size={14} className="text-muted-foreground" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex-1">What actually happened</span>
              <span className="font-mono text-[10px] text-muted-foreground/60">{run.timeline[run.timeline.length - 1]?.atMs}ms total</span>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              <div className="relative p-6 ml-4">
                <div className="absolute left-7 top-6 bottom-6 w-[1px] bg-white/10" />
                <div className="flex flex-col gap-8 relative z-10">
                  {run.timeline.map((t, i) => {
                    const copy = STEP_COPY[t.step] || {label: t.step, icon: String(i + 1)};
                    const state = t.error ? 'error' : 'done';
                    return (
                      <div key={`${t.step}-${i}`} className="flex gap-5">
                        <div className={`w-[22px] h-[22px] shrink-0 rounded-full flex items-center justify-center font-mono text-[10px] -ml-[3px] border ${state === 'error' ? 'bg-destructive/20 text-destructive border-destructive/50' : 'bg-primary/20 text-primary border-primary/50'}`}>
                          {state === 'error' ? '!' : copy.icon}
                        </div>
                        <div className="flex flex-col gap-1 -mt-0.5">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-foreground">{copy.label}</span>
                            <span className="font-mono text-[10px] text-muted-foreground/60 border border-white/10 rounded-[3px] px-1 bg-white/5">{t.atMs}ms</span>
                          </div>
                          <div className="text-sm text-muted-foreground">{t.detail}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6">
            {delta && (
              <Card className="border-white/10 bg-black/40 backdrop-blur-md">
                <CardHeader className="py-3 px-5 border-b border-white/5 bg-white/5">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Reputation, re-read from the chain after settlement</span>
                </CardHeader>
                <CardContent className="p-6 flex items-center gap-6">
                  <Dial score={delta.after} verdict="trust" size={76} />
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-muted-foreground text-lg">{pct(delta.before, 2)}</span>
                      <span className="text-muted-foreground/40">→</span>
                      <span className="text-primary text-xl font-medium">{pct(delta.after, 2)}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {delta.totalBefore} → {delta.totalAfter} witnessed actions
                    </div>
                    {run.integrity && (
                      <div className={`flex items-center gap-2 mt-1 text-xs ${run.integrity.verified ? 'text-primary' : 'text-destructive'}`}>
                        {run.integrity.verified ? <IconCheck size={12} /> : <IconX size={12} />}
                        <span>hash chain verified over {run.integrity.receipts} receipts</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {run.execution && (
              <Card className="border-white/10 bg-black/40 backdrop-blur-md">
                <CardHeader className="py-3 px-5 border-b border-white/5 flex flex-row items-center gap-2 bg-white/5">
                  <IconChip size={14} className="text-muted-foreground" />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex-1">Result</span>
                  <Badge variant="secondary" className="font-mono text-[9px] uppercase tracking-widest bg-white/5 border-white/10">
                    {run.execution.engine}
                  </Badge>
                </CardHeader>
                <CardContent className="p-5 flex flex-col gap-5">
                  <pre className="font-mono text-[11px] leading-relaxed text-primary/80 bg-black/60 border border-white/10 rounded-lg p-4 overflow-x-auto">
                    {JSON.stringify(run.execution.result, null, 2)}
                  </pre>
                  
                  <dl className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-2.5 text-sm">
                    <dt className="text-muted-foreground">engine</dt>
                    <dd className="font-mono text-foreground">{run.execution.engine}</dd>
                    
                    <dt className="text-muted-foreground">model</dt>
                    <dd className="font-mono text-foreground">{run.execution.model}</dd>
                    
                    {run.execution.attestation && (
                      <>
                        <dt className="text-muted-foreground">tee</dt>
                        <dd className="font-mono text-foreground">
                          {run.execution.attestation.verified ? 'attested' : 'unverified'}
                          {run.execution.attestation.signingAddress ? ` · ${short(run.execution.attestation.signingAddress)}` : ''}
                        </dd>
                      </>
                    )}
                    
                    <dt className="text-muted-foreground">storage</dt>
                    <dd className="font-mono text-foreground">{run.storage?.backend}</dd>
                    
                    <dt className="text-muted-foreground">evidence</dt>
                    <dd className="font-mono text-foreground text-[10px] break-all">{run.storage?.digest}</dd>
                    
                    <dt className="text-muted-foreground">receipt</dt>
                    <dd className="font-mono text-foreground text-[10px] break-all">{run.settlement?.hash}</dd>
                  </dl>
                  
                  <div className="text-[11px] text-muted-foreground leading-relaxed pt-2 border-t border-white/5">
                    The evidence digest above is what the registry stored. The agent never touched it. Only the allowlisted executor can submit a receipt, which is what makes this history witnessed rather than self-reported.
                  </div>
                </CardContent>
              </Card>
            )}

            {run.rejection && (
              <Card className="bg-destructive/5 border-destructive/20">
                <CardHeader className="py-3 px-5 border-b border-destructive/10 flex flex-row items-center gap-2">
                  <IconX size={14} className="text-destructive" />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-destructive">Blocked attempt written on-chain</span>
                </CardHeader>
                <CardContent className="p-5 flex flex-col gap-4">
                  <div className="text-sm text-destructive/80 leading-relaxed">
                    The registry refused this action, and the refusal itself is now a permanent part of the agent's record. Enforcement that only blocks, without recording, would let an agent probe its limits invisibly.
                  </div>
                  <div className="font-mono text-[10px] text-destructive/60 break-all p-3 bg-destructive/10 rounded border border-destructive/20">
                    {run.rejection.hash}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
