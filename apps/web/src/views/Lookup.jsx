import React, {useEffect, useState} from 'react';
import {api, nameOf, SPEND_SYMBOL} from '../lib/api.js';
import {Passport} from '../components/Passport.jsx';
import {IconSpinner, IconBolt} from '../components/icons.jsx';
import {Card, CardContent, CardHeader} from '../components/ui/card';
import {Input} from '../components/ui/input';
import {Badge} from '../components/ui/badge';

const CAPS = ['flight.quote', 'research', 'pay'];

export default function Lookup({query, tasks, onPick}) {
  const [state, setState] = useState({loading: true, data: null, error: null});
  const [capability, setCapability] = useState('flight.quote');
  const [value, setValue] = useState('0.5');
  const [live, setLive] = useState(null);

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
      <div className="p-8 max-w-7xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Look up an agent</h1>
          <p className="text-muted-foreground mt-2 text-sm max-w-[74ch]">
            Search by ENS name, agent id, or wallet address. The passport returns a decision (trust, limit or decline)
            with every check that produced it.
          </p>
        </div>
        <Card className="bg-card">
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            Type an identifier above, or pick an agent from the roster.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto w-full flex flex-col gap-6">
        <div className="h-8 w-64 bg-white/5 rounded-md animate-pulse" />
        <div className="h-[420px] w-full bg-white/5 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (state.error) {
    const notFound = /no passport/i.test(state.error);
    return (
      <div className="p-8 max-w-7xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{query}</h1>
        </div>
        {notFound ? (
          <Passport passport={null} decision={{verdict: 'decline'}} />
        ) : (
          <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-md text-sm font-mono">
            {state.error}
          </div>
        )}
      </div>
    );
  }

  const {passport, integrity} = state.data;
  const decision = live?.decision || state.data.decision;

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-3">
            {nameOf(passport)}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Passport #{passport.agentId} on chain {passport.chainId}. Everything below is read from the registry. Nothing is cached or self-reported.
          </p>
        </div>
      </div>

      <Card className="mb-8 overflow-visible border-white/10 bg-black/40 backdrop-blur-md">
        <CardHeader className="py-3 px-5 border-b border-white/5 flex flex-row items-center gap-2 bg-white/5">
          <IconBolt size={14} className="text-muted-foreground" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">The ask · the verdict is relative to this, not absolute</span>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[auto_120px_1fr] gap-4 items-end">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Capability requested</label>
              <select 
                value={capability} 
                onChange={(e) => setCapability(e.target.value)} 
                className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none font-mono"
              >
                {(tasks?.length ? tasks.map((t) => t.capability) : CAPS).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="pay">pay</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Value at risk ({SPEND_SYMBOL})</label>
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                inputMode="decimal"
                className="font-mono bg-background/50"
              />
            </div>
            <div className="flex items-center h-10 md:justify-end">
              {live?.onchain ? (
                <Badge variant={live.onchain.ok ? 'default' : 'destructive'} className="font-mono rounded-sm">
                  registry says {live.onchain.ok ? 'OK' : live.onchain.reason}
                </Badge>
              ) : (
                <span className="flex items-center gap-2 text-muted-foreground text-xs font-mono">
                  <IconSpinner size={12} className="animate-spin" />
                  evaluating
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Passport passport={passport} decision={decision} integrity={integrity} requestedCapability={capability} />

      <Card className="mt-8 border-white/10 bg-black/40 backdrop-blur-md">
        <CardHeader className="py-3 px-5 border-b border-white/5 bg-white/5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">ENS text records · read through the standard resolver profile</span>
        </CardHeader>
        <CardContent className="p-5">
          {Object.keys(passport.textRecords || {}).length === 0 ? (
            <div className="text-muted-foreground text-sm">No text records set.</div>
          ) : (
            <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 text-sm">
                {Object.entries(passport.textRecords).map(([k, v]) => (
                  <React.Fragment key={k}>
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className={k.startsWith('agent.') ? 'font-mono text-foreground' : 'text-foreground'}>{v}</dd>
                  </React.Fragment>
                ))}
              </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
