import React, {useEffect, useState} from 'react';
import {api, short} from '../lib/api.js';
import {IconShield, IconSpinner, IconCheck, IconX, IconPlus, IconGlobe, IconWarn} from '../components/icons.jsx';
import {Card, CardContent, CardHeader} from '../components/ui/card';
import {Button} from '../components/ui/button';
import {Input} from '../components/ui/input';

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
    <div className={`flex gap-5 relative pb-8 last:pb-0 group`}>
      <div className="absolute left-[13px] top-8 bottom-0 w-[1px] bg-white/10 group-last:hidden" />
      <div 
        className={`w-[26px] h-[26px] shrink-0 rounded-full flex items-center justify-center font-mono text-[11px] z-10 transition-colors
          ${state === 'done' ? 'bg-primary/20 text-primary border border-primary/50' 
          : state === 'error' ? 'bg-destructive/20 text-destructive border border-destructive/50'
          : state === 'active' ? 'bg-white/10 text-foreground border border-white/20'
          : 'bg-transparent text-muted-foreground border border-white/5'}`}
      >
        {state === 'done' ? <IconCheck size={12} /> : state === 'error' ? '!' : n}
      </div>
      <div className="flex flex-col min-w-0 flex-1 -mt-0.5">
        <h3 className={`text-[15px] font-medium tracking-tight mb-4 ${state === 'idle' ? 'text-muted-foreground' : 'text-foreground'}`}>{title}</h3>
        <div className={`transition-opacity duration-300 ${state === 'idle' ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          {children}
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Issue a passport</h1>
        <p className="text-muted-foreground mt-2 text-sm max-w-[80ch] leading-relaxed">
          The owner proves personhood once, then mints a passport with an explicit mandate. Every gate below is enforced
          in the contract, not in this form, so you can watch it refuse.
        </p>
      </div>

      {error && <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-md text-sm font-mono mb-8">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8 items-start">
        <Card className="border-white/10 bg-black/40 backdrop-blur-md">
          <CardContent className="p-8">
            <div className="flex flex-col">
              {/* ── 1. World ID ── */}
              <Step
                n="1"
                title="Verify the owner is a unique human"
                state={human ? (human.canRegisterAgent ? 'done' : 'error') : 'active'}
              >
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <IconShield size={14} className="text-muted-foreground" />
                    <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded ${worldLive ? 'bg-primary/20 text-primary' : 'bg-white/10 text-muted-foreground'}`}>
                      {integrations?.world?.mode || '…'}
                    </span>
                  </div>
                  
                  <Input
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    placeholder="owner wallet address 0x…"
                    className="font-mono bg-background/50"
                  />
                  
                  <div className="flex items-center gap-3">
                    <Button
                      variant={human ? 'outline' : 'default'}
                      onClick={verify}
                      disabled={busy === 'verify' || !/^0x[0-9a-fA-F]{40}$/.test(owner.trim())}
                      className={!human && !worldLive ? 'bg-white text-black hover:bg-white/90' : 'font-mono uppercase tracking-wider text-xs'}
                    >
                      {busy === 'verify' ? <IconSpinner size={14} className="animate-spin mr-2" /> : <IconShield size={14} className="mr-2" />}
                      {human ? 'Re-run' : worldLive ? 'Verify with World ID' : 'Run local stand-in'}
                    </Button>
                    
                    {health?.accounts?.owner && (
                      <Button variant="ghost" size="sm" onClick={() => setOwner(health.accounts.owner)} className="font-mono text-xs text-muted-foreground hover:text-foreground">
                        use demo owner
                      </Button>
                    )}
                  </div>

                  {human && (
                    <div className={`p-4 rounded-md border mt-2 ${human.canRegisterAgent ? 'bg-primary/5 border-primary/20' : 'bg-destructive/5 border-destructive/20'}`}>
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start gap-2.5">
                          {human.canRegisterAgent ? (
                            <IconCheck size={16} className="text-primary mt-0.5 shrink-0" />
                          ) : (
                            <IconWarn size={16} className="text-destructive mt-0.5 shrink-0" />
                          )}
                          <span className={`text-sm font-medium ${human.canRegisterAgent ? 'text-foreground' : 'text-destructive'}`}>
                            {human.canRegisterAgent
                              ? `Recorded as a production ${human.proof.kind === 1 ? 'orb' : 'device'} proof`
                              : 'Simulator-level proof. Registration will be refused.'}
                          </span>
                        </div>
                        
                        {!human.canRegisterAgent && (
                          <div className="text-[13px] text-muted-foreground leading-relaxed pl-6.5">
                            Supply a production World ID proof to continue. Configure{' '}
                            <span className="font-mono bg-black/40 px-1 rounded text-foreground">WORLD_APP_ID</span> and this step opens IDKit instead.
                          </div>
                        )}
                        
                        <dl className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-2 text-xs pl-6.5 mt-2">
                          <dt className="text-muted-foreground">nullifier</dt>
                          <dd className="font-mono text-foreground" title={human.proof.nullifierHash}>{short(human.proof.nullifierHash, 12, 8)}</dd>
                          
                          <dt className="text-muted-foreground">attestation tx</dt>
                          <dd className="font-mono text-foreground" title={human.tx?.hash}>{short(human.tx?.hash, 12, 8)}</dd>
                        </dl>
                        
                        {!worldLive && (
                          <div className="text-[11px] text-muted-foreground/60 italic pl-6.5 mt-2">
                            Signed by the local attestor key. No call was made to World.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Step>

              {/* ── 2. mandate ── */}
              <Step n="2" title="Declare the mandate" state={created ? 'done' : human?.canRegisterAgent ? 'active' : 'idle'}>
                <div className="flex flex-col gap-5">
                  <Input
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    placeholder="operator address (the key the agent acts with) 0x…"
                    className="font-mono bg-background/50"
                  />
                  
                  <div className="flex items-center gap-3">
                    <Input
                      value={label}
                      onChange={(e) => setLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="label"
                      className="font-mono bg-background/50 w-40" 
                    />
                    <span className="font-mono text-muted-foreground text-sm">.{health?.parentName || 'kya.eth'}</span>
                  </div>
                  
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="what this agent does"
                    className="bg-background/50"
                  />
                  
                  <div className="flex flex-col gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Capabilities</span>
                    <div className="flex flex-wrap gap-2">
                      {ALL_CAPS.map((c) => (
                        <button
                          key={c}
                          className={`px-3 py-1.5 rounded-full text-xs font-mono transition-colors border ${caps.includes(c) ? 'bg-primary/20 text-primary border-primary/50' : 'bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10 hover:text-foreground'}`}
                          onClick={() => setCaps((v) => (v.includes(c) ? v.filter((x) => x !== c) : [...v, c]))}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Daily spend ceiling</span>
                      <Input value={spend} onChange={(e) => setSpend(e.target.value)} className="font-mono bg-background/50" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Actions per day</span>
                      <Input value={maxActions} onChange={(e) => setMaxActions(e.target.value)} className="font-mono bg-background/50" />
                    </div>
                  </div>
                </div>
              </Step>

              {/* ── 3. issue ── */}
              <Step n="3" title="Mint the passport and issue the ENS subname" state={created ? 'done' : 'idle'}>
                <div className="flex flex-col gap-5">
                  <div className="text-[13px] text-muted-foreground leading-relaxed">
                    One transaction mints the passport; a second claims{' '}
                    <span className="font-mono text-foreground bg-black/40 px-1 rounded">
                      {label || 'label'}.{health?.parentName || 'kya.eth'}
                    </span>{' '}
                    and writes the agent card to text records.
                  </div>
                  
                  <div>
                    <Button
                      onClick={issue}
                      disabled={
                        busy === 'issue' ||
                        !human?.canRegisterAgent ||
                        !/^0x[0-9a-fA-F]{40}$/.test(operator.trim()) ||
                        label.trim().length < 3 ||
                        caps.length === 0
                      }
                      className="font-mono uppercase tracking-wider text-xs"
                    >
                      {busy === 'issue' ? <IconSpinner size={14} className="animate-spin mr-2" /> : <IconPlus size={14} className="mr-2" />}
                      Issue passport
                    </Button>
                  </div>
                  
                  {!human?.canRegisterAgent && human && (
                    <div className="text-[11px] text-destructive/80 mt-2 bg-destructive/5 p-3 rounded border border-destructive/10">
                      Blocked by the contract: <span className="font-mono font-bold">OwnerNotHumanVerified</span>. This is the gate
                      working, not a bug in the form.
                    </div>
                  )}
                </div>
              </Step>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 sticky top-24">
          {created ? (
            <Card className="border-primary/30 bg-primary/5 animate-in fade-in zoom-in-95 duration-500">
              <CardHeader className="py-3 px-5 border-b border-primary/10 flex flex-row items-center gap-2">
                <IconCheck size={14} className="text-primary" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-primary">Passport issued</span>
              </CardHeader>
              <CardContent className="p-5 flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <IconGlobe size={18} className="text-primary/70" />
                  <button className="text-lg font-mono text-foreground hover:text-primary transition-colors hover:underline" onClick={() => onPick(created.passport.domain)}>
                    {created.passport.ensName || created.passport.domain}
                  </button>
                </div>
                
                <dl className="grid grid-cols-[70px_1fr] gap-x-4 gap-y-2.5 text-[11px]">
                  <dt className="text-muted-foreground">agent id</dt>
                  <dd className="font-mono text-foreground">#{created.created.agentId}</dd>
                  
                  <dt className="text-muted-foreground">owner</dt>
                  <dd className="font-mono text-foreground">{short(created.passport.owner, 10, 8)}</dd>
                  
                  <dt className="text-muted-foreground">operator</dt>
                  <dd className="font-mono text-foreground">{short(created.passport.operator, 10, 8)}</dd>
                  
                  <dt className="text-muted-foreground">mint tx</dt>
                  <dd className="font-mono text-foreground break-all">{created.created.hash}</dd>
                  
                  {created.name && (
                    <>
                      <dt className="text-muted-foreground">name tx</dt>
                      <dd className="font-mono text-foreground break-all">{created.name.hash}</dd>
                      
                      <dt className="text-muted-foreground">node</dt>
                      <dd className="font-mono text-foreground break-all">{created.name.node}</dd>
                    </>
                  )}
                </dl>
                
                <div className="text-[11px] text-muted-foreground leading-relaxed pt-2 border-t border-primary/10">
                  Reputation starts at zero, not at a friendly default. A passport with no history is an unknown
                  quantity, and the trust engine reports it as <span className="font-mono bg-black/40 px-1 rounded">INSUFFICIENT_HISTORY</span> rather
                  than as bad.
                </div>
                
                <Button variant="outline" onClick={() => onPick(created.passport.domain)} className="w-full font-mono uppercase tracking-wider text-xs border-primary/20 hover:bg-primary/10 hover:text-primary mt-2">
                  Open the passport
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-white/5 bg-white/[0.02]">
              <CardHeader className="py-3 px-5 border-b border-white/5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Why this order</span>
              </CardHeader>
              <CardContent className="p-5 flex flex-col gap-4 text-sm text-muted-foreground/80 leading-relaxed">
                <div>
                  Personhood first, mandate second, name third. Each is a separate on-chain fact rather than one blob.
                </div>
                <div>
                  The owner's World ID nullifier is bound on-chain before a passport can exist. That binding is what
                  makes a bad track record expensive to walk away from: a fresh wallet does not get a fresh reputation,
                  because the same human cannot claim the nullifier twice.
                </div>
                <div>
                  The mandate is declared before any work is done, so an over-limit action is a contract revert rather
                  than an after-the-fact dispute.
                </div>
                <div>
                  The name comes last because it is a pointer to a passport that already exists, never the identity itself.
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
