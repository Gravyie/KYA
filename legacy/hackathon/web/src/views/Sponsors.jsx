import React, {useEffect, useState} from 'react';
import {api, short} from '../lib/api.js';
import {IconShield, IconGlobe, IconChip, IconCheck, IconWarn} from '../components/icons.jsx';
import {Card, CardContent, CardHeader} from '../components/ui/card';
import {Badge} from '../components/ui/badge';

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

  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto w-full">
        <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-md text-sm font-mono">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-[400px] bg-white/5 rounded-xl animate-pulse" />
          <div className="h-[400px] bg-white/5 rounded-xl animate-pulse" />
          <div className="h-[400px] bg-white/5 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">What each sponsor is load-bearing for</h1>
        <p className="text-muted-foreground mt-2 text-sm max-w-[80ch] leading-relaxed">
          Three integrations, three jobs that cannot be swapped. Read live from the running configuration. If a surface
          is standing in locally, it says so here and everywhere else in the product.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {['world', 'ens', 'og'].map((key) => {
          const s = data[key];
          const Icon = ICON[key];
          const modeChips = String(s.mode)
            .split('/')
            .map((m) => m.trim())
            .filter(Boolean);
            
          return (
            <Card key={key} className="border-white/10 bg-black/40 backdrop-blur-md flex flex-col hover:bg-black/60 transition-colors">
              <CardHeader className="py-4 px-5 border-b border-white/5 flex flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Icon size={18} className="text-primary" />
                  <h3 className="font-semibold text-foreground text-lg">{s.surface}</h3>
                </div>
                <Badge variant={s.live ? 'default' : 'secondary'} className={`font-mono uppercase tracking-widest text-[9px] gap-1 ${!s.live ? 'bg-white/10' : ''}`}>
                  {s.live ? <IconCheck size={10} /> : <IconWarn size={10} />}
                  {s.live ? 'live' : 'local'}
                </Badge>
              </CardHeader>
              
              <CardContent className="p-5 flex flex-col gap-6 flex-1">
                {modeChips.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {modeChips.map((m) => (
                      <span key={m} className="font-mono text-[10px] bg-white/5 border border-white/10 rounded px-2 py-1 text-muted-foreground">
                        {m}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Feature used</div>
                    <div className="text-sm text-primary/90">{s.feature}</div>
                  </div>

                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Its job in KYA</div>
                    <div className="text-sm text-foreground/80 leading-relaxed">{s.role}</div>
                  </div>

                  <div className="p-4 bg-primary/5 border-l-2 border-primary/40 rounded-r-md">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Why it is not interchangeable</div>
                    <div className="text-[13px] text-muted-foreground leading-relaxed">{s.whyNecessary}</div>
                  </div>
                </div>

                <div className="mt-auto pt-5 border-t border-white/5">
                  <dl className="grid grid-cols-[60px_1fr] gap-x-4 gap-y-2.5 text-xs">
                    {s.contract && (
                      <>
                        <dt className="text-muted-foreground">contract</dt>
                        <dd className="font-mono text-foreground break-all">{short(s.contract, 10, 8)}</dd>
                      </>
                    )}
                    {s.appId && (
                      <>
                        <dt className="text-muted-foreground">app id</dt>
                        <dd className="font-mono text-foreground break-all">{s.appId}</dd>
                      </>
                    )}
                    {s.action && (
                      <>
                        <dt className="text-muted-foreground">action</dt>
                        <dd className="font-mono text-foreground break-all">{s.action}</dd>
                      </>
                    )}
                    {s.parentName && (
                      <>
                        <dt className="text-muted-foreground">parent</dt>
                        <dd className="font-mono text-foreground break-all">{s.parentName}</dd>
                      </>
                    )}
                    {s.model && (
                      <>
                        <dt className="text-muted-foreground">model</dt>
                        <dd className="font-mono text-foreground break-all">{s.model}</dd>
                      </>
                    )}
                    {s.attestorSigner && (
                      <>
                        <dt className="text-muted-foreground">signer</dt>
                        <dd className="font-mono text-foreground break-all">{short(s.attestorSigner, 10, 8)}</dd>
                      </>
                    )}
                  </dl>
                  
                  {s.note && (
                    <div className="text-[11px] text-muted-foreground mt-4 leading-relaxed italic">
                      {s.note}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mb-6 border-white/10 bg-black/40 backdrop-blur-md">
        <CardHeader className="py-3 px-5 border-b border-white/5 bg-white/5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Deployment · everything the UI reads comes from these addresses</span>
        </CardHeader>
        <CardContent className="p-5">
          <dl className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-x-4 gap-y-3 text-sm">
            <dt className="text-muted-foreground sm:py-1">chain</dt>
            <dd className="font-mono text-foreground sm:py-1 bg-white/5 rounded px-2">
              {health?.chainId} · {health?.rpcUrl}
            </dd>
            
            {Object.entries(health?.contracts || {}).map(([name, addr]) => (
              <React.Fragment key={name}>
                <dt className="text-muted-foreground sm:py-1">{name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()}</dt>
                <dd className="font-mono text-foreground sm:py-1 break-all bg-white/5 rounded px-2">
                  {addr}
                </dd>
              </React.Fragment>
            ))}
            
            <dt className="text-muted-foreground sm:py-1">attestor</dt>
            <dd className="font-mono text-foreground sm:py-1 break-all bg-white/5 rounded px-2">{health?.accounts?.attestor}</dd>
            
            <dt className="text-muted-foreground sm:py-1">executor</dt>
            <dd className="font-mono text-foreground sm:py-1 break-all bg-white/5 rounded px-2">{health?.accounts?.executor}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5 flex flex-col gap-2">
          <div className="font-mono text-[10px] uppercase tracking-widest text-primary/80">On simulated paths</div>
          <div className="text-sm text-foreground/70 max-w-[90ch] leading-relaxed">
            Where a credential is not configured, KYA runs a deterministic local stand-in and labels it{' '}
            <span className="font-mono bg-black/40 px-1 rounded text-primary">local:*</span> in the API, in this view, and on every result it produces. A World ID
            simulator proof is recorded on-chain as <span className="font-mono bg-black/40 px-1 rounded text-primary">ProofKind.WorldIdSimulator</span>, and{' '}
            <span className="font-mono bg-black/40 px-1 rounded text-primary">PassportRegistry.registerAgent</span> refuses it outright. A staging credential
            cannot become a verified human anywhere in this system. An unlabeled simulation would be a bug, not a fallback.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
