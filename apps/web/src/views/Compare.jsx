import React, {useCallback, useEffect, useState} from 'react';
import {api, nameOf, SPEND_SYMBOL} from '../lib/api.js';
import {Passport, VerdictBadge} from '../components/Passport.jsx';
import {IconScales, IconSpinner, IconArrowRight, IconX} from '../components/icons.jsx';
import {Button} from '../components/ui/button';
import {Card, CardContent, CardHeader} from '../components/ui/card';
import {Input} from '../components/ui/input';
import {Badge} from '../components/ui/badge';
import {AnimatePresence, motion} from 'motion/react';

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
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Compare before you delegate</h1>
        <p className="text-muted-foreground mt-2 text-sm max-w-[74ch]">
          Two agents, one request. The same policy is applied to both, and every column states why it did or did not clear it. Identity and mandate are hard gates; track record only shapes the limit.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {PRESETS.map((p) => {
          const active = p.queries.join() === queries.join() && p.capability === capability;
          return (
            <Button
              key={p.label}
              variant={active ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyPreset(p)}
              className={active ? "bg-primary/20 text-primary hover:bg-primary/30 border-primary/50" : "border-white/10 hover:bg-white/5"}
            >
              <div className="flex items-center gap-2">
                <span>{p.label}</span>
                <span className={`text-[10px] ${active ? 'text-primary/70' : 'text-muted-foreground'}`}>
                  {p.hint}
                </span>
              </div>
            </Button>
          );
        })}
      </div>

      <Card className="mb-8 border-white/10 bg-black/40 backdrop-blur-md overflow-visible">
        <CardHeader className="py-3 px-5 border-b border-white/5 flex flex-row items-center gap-2 bg-white/5">
          <IconScales size={14} className="text-muted-foreground" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">The request both are judged against</span>
        </CardHeader>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Capability requested</label>
              <select 
                value={capability} 
                onChange={(e) => setCapability(e.target.value)} 
                className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none font-mono"
              >
                {(tasks?.length ? tasks.map((t) => t.capability) : ['flight.quote', 'research']).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="pay">pay</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 w-[120px]">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Value at risk ({SPEND_SYMBOL})</label>
              <Input value={value} onChange={(e) => setValue(e.target.value)} className="font-mono bg-background/50" />
            </div>

            {queries.map((q, i) => (
              <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]" key={i}>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-[15px] h-[15px] rounded-[3px] border border-white/20 text-[9px]">{i + 1}</span>
                  Column {i + 1}
                </label>
                <Input
                  value={q}
                  onChange={(e) => setQueries(queries.map((v, j) => (j === i ? e.target.value : v)))}
                  placeholder="ENS name or address"
                  className="font-mono bg-background/50"
                />
              </div>
            ))}

            <div className="flex items-center gap-2 h-10">
              {queries.length < 4 && (
                <Button variant="outline" size="sm" onClick={() => setQueries([...queries, ''])} title="Add a column" className="border-white/10 hover:bg-white/5">
                  + col
                </Button>
              )}
              {queries.length > 2 && (
                <Button variant="outline" size="icon" onClick={() => setQueries(queries.slice(0, -1))} title="Remove last column" className="border-white/10 hover:bg-white/5 w-10">
                  <IconX size={14} />
                </Button>
              )}
              <Button onClick={run} disabled={loading} className="font-mono uppercase tracking-wider text-xs">
                {loading ? <IconSpinner size={14} className="animate-spin mr-2" /> : <IconArrowRight size={14} className="mr-2" />}
                Evaluate
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-md text-sm font-mono mb-8">{error}</div>}

      <AnimatePresence mode="wait">
        {data && (
          <motion.div
            initial={{opacity: 0, y: -10}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: -10}}
          >
            <Card className={`mb-8 ${data.recommended ? 'bg-primary/10 border-primary/30' : 'bg-destructive/10 border-destructive/30'}`}>
              <CardContent className="p-5 flex items-center gap-4 flex-wrap">
                {data.recommended ? (
                  <>
                    <VerdictBadge verdict="trust">Route here</VerdictBadge>
                    <span className="text-foreground font-medium text-sm">
                      {data.recommended}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      is the only candidate that clears every hard gate for <span className="font-mono text-primary/80">{capability}</span> at {value} OG.
                    </span>
                  </>
                ) : (
                  <>
                    <VerdictBadge verdict="decline">Route nowhere</VerdictBadge>
                    <span className="text-muted-foreground text-sm">
                      No candidate cleared the policy. The correct action is to decline the task, not to pick the least-bad option.
                    </span>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div 
        className="grid gap-6 items-start"
        style={{
          gridTemplateColumns: `repeat(${Math.min(data?.results?.length || 2, 3)}, minmax(0, 1fr))`,
        }}
      >
        {loading && !data && (
          <>
            <div className="h-[500px] bg-white/5 rounded-xl animate-pulse" />
            <div className="h-[500px] bg-white/5 rounded-xl animate-pulse" />
          </>
        )}
        {data?.results.map((r, i) => (
          <div key={r.query} className="flex flex-col gap-4">
            <div className="flex items-center gap-3 h-[26px]">
              <span className="inline-flex items-center justify-center w-[15px] h-[15px] rounded-[3px] border border-white/20 text-[9px] font-mono text-muted-foreground shrink-0">{i + 1}</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                {r.query}
              </span>
              {data.recommended === r.query && (
                <VerdictBadge verdict="trust">Recommended</VerdictBadge>
              )}
            </div>
            <Passport
              passport={r.passport}
              decision={r.decision}
              requestedCapability={capability}
              recommended={data.recommended === r.query}
              showLog={false}
              showHeadBadge={false}
              collapsedChecks
              compact
              onOpen={r.passport ? () => onPick(nameOf(r.passport)) : undefined}
            />
          </div>
        ))}
      </div>

      {data && (
        <Card className="mt-8 border-white/10 bg-black/40 backdrop-blur-md">
          <CardHeader className="py-3 px-5 border-b border-white/5 bg-white/5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Policy applied to every column</span>
          </CardHeader>
          <CardContent className="p-5">
            <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 text-sm">
              <dt className="text-muted-foreground">human</dt>
              <dd className="text-foreground">{data.policy.requireHumanVerified ? 'World ID production proof required' : 'not required'}</dd>
              
              <dt className="text-muted-foreground">min score</dt>
              <dd className="text-foreground">{(data.policy.minScore / 100).toFixed(1)}%</dd>
              
              <dt className="text-muted-foreground">min actions</dt>
              <dd className="text-foreground">{data.policy.minActions} witnessed</dd>
              
              <dt className="text-muted-foreground">rejections</dt>
              <dd className="text-foreground">
                {data.policy.maxRejections === 0
                  ? 'any blocked over-mandate attempt is disqualifying'
                  : `up to ${data.policy.maxRejections}`}
              </dd>
              
              <dt className="text-muted-foreground">staleness</dt>
              <dd className="text-foreground">{data.policy.maxStalenessDays} days max since last witnessed action</dd>
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
