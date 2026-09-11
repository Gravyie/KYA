import React, {useEffect, useState, useCallback} from 'react';
import {api, short} from '../lib/api.js';
import {
  IconShield,
  IconSpinner,
  IconCheck,
  IconX,
  IconPlus,
  IconGlobe,
  IconWarn,
  IconSparkles,
} from '../components/icons.jsx';
import {Card, CardContent, CardHeader} from '../components/ui/card';
import {Button} from '../components/ui/button';
import {Input} from '../components/ui/input';

const ALL_CAPS = ['flight.quote', 'research', 'pay', 'browser.action', 'social.post', 'scrape.web'];
const DEMO_OWNER = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const DEMO_OPERATOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

/* ── Stable module-level Step component (prevents focus loss and scroll jumps) ── */
function Step({n, title, children, state, description}) {
  return (
    <div className="flex gap-4 sm:gap-5 relative pb-8 last:pb-0 group min-w-0">
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
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className={`text-[15px] font-medium tracking-tight ${state === 'idle' ? 'text-muted-foreground/80' : 'text-foreground'}`}>{title}</h3>
          {state === 'done' && (
            <span className="text-[10px] font-mono uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded shrink-0">
              verified
            </span>
          )}
        </div>
        {description && <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{description}</p>}
        <div className="w-full min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}

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

  // Check on-chain humanhood status when owner changes
  useEffect(() => {
    const trimmed = owner.trim();
    if (!trimmed || !/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
      setHuman(null);
      return;
    }
    let cancelled = false;
    api
      .humanhood?.(trimmed)
      .then((state) => {
        if (cancelled) return;
        if (state?.humanVerified) {
          setHuman({
            subject: trimmed,
            canRegisterAgent: true,
            proof: {
              kind: state.kind,
              nullifierHash: state.nullifierHash,
            },
            onchain: state,
          });
        } else {
          setHuman(null);
        }
      })
      .catch(() => {
        if (!cancelled) setHuman(null);
      });
    return () => {
      cancelled = true;
    };
  }, [owner]);

  const verify = useCallback(async (asDemo = true) => {
    const targetOwner = owner.trim() || DEMO_OWNER;
    if (!owner.trim()) {
      setOwner(targetOwner);
    }
    setBusy('verify');
    setError(null);
    try {
      const res = await api.verifyHuman({
        subject: targetOwner,
        demoProof: asDemo || !worldLive,
        simulate: false,
      });
      setHuman(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }, [owner, worldLive]);

  const handleUseDemoOwner = useCallback(async () => {
    setOwner(DEMO_OWNER);
    setError(null);
    setBusy('verify');
    try {
      const state = await api.humanhood?.(DEMO_OWNER).catch(() => null);
      if (state?.humanVerified) {
        setHuman({
          subject: DEMO_OWNER,
          canRegisterAgent: true,
          proof: {
            kind: state.kind,
            nullifierHash: state.nullifierHash,
          },
          onchain: state,
        });
      } else {
        const res = await api.verifyHuman({
          subject: DEMO_OWNER,
          demoProof: true,
          simulate: false,
        });
        setHuman(res);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }, []);

  const handleFillDemoAgent = useCallback(async () => {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const demoLabel = `agent-${randomSuffix}`;
    setOwner(DEMO_OWNER);
    setOperator(DEMO_OPERATOR);
    setLabel(demoLabel);
    setDescription('Autonomous workflow agent powered by 0G Compute and verified KYA passport');
    setCaps(['flight.quote', 'research', 'pay', 'browser.action']);
    setSpend('5');
    setMaxActions('50');
    setError(null);
    setBusy('verify');

    try {
      const state = await api.humanhood?.(DEMO_OWNER).catch(() => null);
      if (state?.humanVerified) {
        setHuman({
          subject: DEMO_OWNER,
          canRegisterAgent: true,
          proof: {
            kind: state.kind,
            nullifierHash: state.nullifierHash,
          },
          onchain: state,
        });
      } else {
        const res = await api.verifyHuman({
          subject: DEMO_OWNER,
          demoProof: true,
          simulate: false,
        });
        setHuman(res);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }, []);

  async function issue() {
    if (!human?.canRegisterAgent) {
      setError('Owner must be human-verified with World ID before issuing a passport.');
      return;
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(operator.trim())) {
      setError('A valid 0x Ethereum operator address is required.');
      return;
    }
    if (label.trim().length < 3) {
      setError('Label must be at least 3 characters long.');
      return;
    }
    if (caps.length === 0) {
      setError('Select at least one capability for this agent mandate.');
      return;
    }

    setBusy('issue');
    setError(null);
    try {
      const res = await api.createAgent({
        owner: owner.trim(),
        operator: operator.trim(),
        domain: `${label.trim()}.${health?.parentName || 'kya.eth'}`,
        label: label.trim(),
        description,
        metadataURI: `kya-local://agentcard/${label.trim()}`,
        capabilities: caps,
        spendLimitPerDay: BigInt(Math.round(Number(spend || 0) * 1e18)).toString(),
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

  const isHumanVerified = human?.canRegisterAgent === true;
  const isOperatorValid = /^0x[0-9a-fA-F]{40}$/.test(operator.trim());
  const isLabelValid = label.trim().length >= 3;
  const isCapsValid = caps.length > 0;
  const canIssue = isHumanVerified && isOperatorValid && isLabelValid && isCapsValid;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full min-w-0 overflow-x-hidden">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">Issue a passport</h1>
        <p className="text-muted-foreground mt-2 text-sm max-w-[80ch] leading-relaxed">
          The owner proves personhood once, then mints a passport with an explicit mandate. Every gate below is enforced
          in the smart contract, not just in this UI form.
        </p>
      </div>

      {/* ── Demo Quick Bar ── */}
      <div className="mb-6 p-4 rounded-lg border border-primary/20 bg-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <IconSparkles size={16} className="text-primary shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">Quick Setup Presets</div>
            <div className="text-xs text-muted-foreground truncate">One-click test values to demonstrate on-chain World ID attestation & passport minting.</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleUseDemoOwner}
            disabled={busy !== null}
            className="font-mono text-xs border-primary/30 text-primary hover:bg-primary/20"
          >
            <IconShield size={12} className="mr-1.5" />
            Use Demo Owner
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleFillDemoAgent}
            disabled={busy !== null}
            className="font-mono text-xs bg-primary text-black hover:bg-primary/90"
          >
            <IconPlus size={12} className="mr-1.5" />
            Fill Full Demo Agent
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-md text-sm font-mono mb-6 break-words">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6 lg:gap-8 items-start min-w-0">
        <Card className="border-white/10 bg-black/40 backdrop-blur-md min-w-0">
          <CardContent className="p-4 sm:p-6 md:p-8 min-w-0">
            <div className="flex flex-col min-w-0">
              {/* ── 1. World ID ── */}
              <Step
                n="1"
                title="Verify the owner is a unique human"
                description="The contract requires the agent owner to prove unique humanhood via World ID before any agent can be registered."
                state={human ? (human.canRegisterAgent ? 'done' : 'error') : owner ? 'active' : 'idle'}
              >
                <div className="flex flex-col gap-4 min-w-0">
                  <div className="flex items-center gap-2">
                    <IconShield size={14} className="text-muted-foreground shrink-0" />
                    <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded ${worldLive ? 'bg-primary/20 text-primary' : 'bg-white/10 text-muted-foreground'}`}>
                      {integrations?.world?.mode || 'World ID Orb'}
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Owner Wallet Address</label>
                    <Input
                      value={owner}
                      onChange={(e) => setOwner(e.target.value)}
                      placeholder="owner wallet address 0x…"
                      className="font-mono bg-background/50 text-sm"
                    />
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant={isHumanVerified ? 'outline' : 'default'}
                      onClick={() => verify(true)}
                      disabled={busy === 'verify'}
                      className={!isHumanVerified ? 'bg-primary text-black hover:bg-primary/90' : 'font-mono uppercase tracking-wider text-xs border-white/20'}
                    >
                      {busy === 'verify' ? (
                        <>
                          <IconSpinner size={14} className="animate-spin mr-2 shrink-0" />
                          Verifying on-chain…
                        </>
                      ) : (
                        <>
                          <IconShield size={14} className="mr-2 shrink-0" />
                          {isHumanVerified ? 'Re-attest (Orb)' : 'Attest Human Proof (Orb)'}
                        </>
                      )}
                    </Button>
                    
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleUseDemoOwner}
                      disabled={busy !== null}
                      className="font-mono text-xs text-muted-foreground hover:text-foreground"
                    >
                      use verified demo owner
                    </Button>
                  </div>

                  {human && (
                    <div className={`p-4 rounded-md border mt-2 min-w-0 ${isHumanVerified ? 'bg-primary/5 border-primary/20' : 'bg-destructive/5 border-destructive/20'}`}>
                      <div className="flex flex-col gap-3 min-w-0">
                        <div className="flex items-start gap-2.5 min-w-0">
                          {isHumanVerified ? (
                            <IconCheck size={16} className="text-primary mt-0.5 shrink-0" />
                          ) : (
                            <IconWarn size={16} className="text-destructive mt-0.5 shrink-0" />
                          )}
                          <span className={`text-sm font-medium break-words min-w-0 ${isHumanVerified ? 'text-foreground' : 'text-destructive'}`}>
                            {isHumanVerified
                              ? `Recorded on-chain as a production ${human.proof?.kind === 1 ? 'orb' : 'device'} proof`
                              : 'Simulator-level proof. Registration will be refused.'}
                          </span>
                        </div>
                        
                        {!isHumanVerified && (
                          <div className="text-[13px] text-muted-foreground leading-relaxed pl-6">
                            Supply a production World ID proof to continue.
                          </div>
                        )}
                        
                        <dl className="grid grid-cols-1 sm:grid-cols-[100px_1fr] gap-x-4 gap-y-2 text-xs pl-6 mt-1 min-w-0">
                          <dt className="text-muted-foreground font-mono">nullifier</dt>
                          <dd className="font-mono text-foreground break-all min-w-0" title={human.proof?.nullifierHash}>
                            {human.proof?.nullifierHash ? short(human.proof.nullifierHash, 14, 10) : 'none'}
                          </dd>
                          
                          {human.tx?.hash && (
                            <>
                              <dt className="text-muted-foreground font-mono">attestation tx</dt>
                              <dd className="font-mono text-foreground break-all min-w-0" title={human.tx.hash}>
                                {short(human.tx.hash, 14, 10)}
                              </dd>
                            </>
                          )}
                        </dl>
                      </div>
                    </div>
                  )}
                </div>
              </Step>

              {/* ── 2. Mandate ── */}
              <Step
                n="2"
                title="Declare the mandate"
                description="Set the agent's operator key, ENS subname, daily spend ceiling, and approved action capabilities."
                state={created ? 'done' : (operator && label ? 'active' : 'idle')}
              >
                <div className="flex flex-col gap-5 min-w-0">
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Operator Address (Agent Key)</label>
                      <button
                        type="button"
                        onClick={() => setOperator(DEMO_OPERATOR)}
                        className="text-[11px] font-mono text-primary hover:underline"
                      >
                        Use Account #1 (0x7099…)
                      </button>
                    </div>
                    <Input
                      value={operator}
                      onChange={(e) => setOperator(e.target.value)}
                      placeholder="0x…"
                      className="font-mono bg-background/50 text-sm"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">ENS Subname</label>
                    <div className="flex items-center gap-2 min-w-0">
                      <Input
                        value={label}
                        onChange={(e) => setLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="agent-label"
                        className="font-mono bg-background/50 w-44 min-w-[120px]" 
                      />
                      <span className="font-mono text-muted-foreground text-sm truncate">.{health?.parentName || 'kya.eth'}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Agent Description</label>
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="what this agent does"
                      className="bg-background/50 text-sm"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-2 min-w-0">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Granted Capabilities</span>
                    <div className="flex flex-wrap gap-2 min-w-0">
                      {ALL_CAPS.map((c) => {
                        const active = caps.includes(c);
                        return (
                          <button
                            type="button"
                            key={c}
                            className={`px-3 py-1.5 rounded-full text-xs font-mono transition-colors border ${active ? 'bg-primary/20 text-primary border-primary/50 font-medium' : 'bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10 hover:text-foreground'}`}
                            onClick={() => setCaps((v) => (v.includes(c) ? v.filter((x) => x !== c) : [...v, c]))}
                          >
                            {active ? `✓ ${c}` : `+ ${c}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Daily Spend Ceiling (OG)</span>
                      <Input 
                        value={spend} 
                        onChange={(e) => setSpend(e.target.value)} 
                        inputMode="decimal"
                        className="font-mono bg-background/50" 
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Actions Per Day</span>
                      <Input 
                        value={maxActions} 
                        onChange={(e) => setMaxActions(e.target.value)} 
                        inputMode="numeric"
                        className="font-mono bg-background/50" 
                      />
                    </div>
                  </div>
                </div>
              </Step>

              {/* ── 3. Issue ── */}
              <Step 
                n="3" 
                title="Mint the passport and claim ENS subname" 
                description="One transaction mints the passport in AgentRegistry; a second claims the ENS subname and sets resolver text records."
                state={created ? 'done' : canIssue ? 'active' : 'idle'}
              >
                <div className="flex flex-col gap-4 min-w-0">
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    Will claim{' '}
                    <span className="font-mono text-foreground bg-black/40 px-1 py-0.5 rounded border border-white/10">
                      {label ? `${label}.${health?.parentName || 'kya.eth'}` : `label.${health?.parentName || 'kya.eth'}`}
                    </span>
                  </div>

                  {/* Checklist indicator */}
                  <div className="p-3 bg-white/[0.02] border border-white/10 rounded-md flex flex-col gap-1.5 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className={isHumanVerified ? 'text-primary' : 'text-amber-500'}>
                        {isHumanVerified ? '✓' : '○'}
                      </span>
                      <span className={isHumanVerified ? 'text-foreground' : 'text-muted-foreground'}>
                        Step 1: World ID Owner Proof {isHumanVerified ? '(verified)' : '(required)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={isOperatorValid ? 'text-primary' : 'text-amber-500'}>
                        {isOperatorValid ? '✓' : '○'}
                      </span>
                      <span className={isOperatorValid ? 'text-foreground' : 'text-muted-foreground'}>
                        Step 2: Valid Operator Key {isOperatorValid ? `(${short(operator, 6, 4)})` : '(required)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={isLabelValid ? 'text-primary' : 'text-amber-500'}>
                        {isLabelValid ? '✓' : '○'}
                      </span>
                      <span className={isLabelValid ? 'text-foreground' : 'text-muted-foreground'}>
                        Step 2: ENS Label {isLabelValid ? `(${label})` : '(min 3 chars)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={isCapsValid ? 'text-primary' : 'text-amber-500'}>
                        {isCapsValid ? '✓' : '○'}
                      </span>
                      <span className={isCapsValid ? 'text-foreground' : 'text-muted-foreground'}>
                        Step 2: Capabilities {isCapsValid ? `(${caps.length} selected)` : '(pick at least 1)'}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <Button
                      type="button"
                      onClick={issue}
                      disabled={busy === 'issue' || !canIssue}
                      className="font-mono uppercase tracking-wider text-xs bg-primary text-black hover:bg-primary/90 px-5 h-10"
                    >
                      {busy === 'issue' ? (
                        <>
                          <IconSpinner size={14} className="animate-spin mr-2 shrink-0" />
                          Minting passport & setting ENS…
                        </>
                      ) : (
                        <>
                          <IconPlus size={14} className="mr-2 shrink-0" />
                          Issue Passport
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {!isHumanVerified && owner && (
                    <div className="text-[11px] text-amber-400/90 mt-1 bg-amber-500/10 p-3 rounded border border-amber-500/20">
                      Step 1 human verification is required before on-chain minting can proceed.
                    </div>
                  )}
                </div>
              </Step>
            </div>
          </CardContent>
        </Card>

        {/* ── Sidebar: Result or Explainer ── */}
        <div className="flex flex-col gap-6 lg:sticky lg:top-24 min-w-0">
          {created ? (
            <Card className="border-primary/30 bg-primary/5 animate-in fade-in zoom-in-95 duration-500 min-w-0 overflow-hidden">
              <CardHeader className="py-3 px-5 border-b border-primary/10 flex flex-row items-center gap-2 min-w-0">
                <IconCheck size={14} className="text-primary shrink-0" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-primary truncate">Passport issued on-chain</span>
              </CardHeader>
              <CardContent className="p-5 flex flex-col gap-5 min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <IconGlobe size={18} className="text-primary/70 shrink-0" />
                  <button 
                    type="button"
                    className="text-lg font-mono text-foreground hover:text-primary transition-colors hover:underline truncate text-left" 
                    onClick={() => onPick(created.passport.domain)}
                  >
                    {created.passport.ensName || created.passport.domain}
                  </button>
                </div>
                
                <dl className="grid grid-cols-[80px_1fr] gap-x-4 gap-y-2.5 text-[11px] min-w-0">
                  <dt className="text-muted-foreground font-mono">agent id</dt>
                  <dd className="font-mono text-foreground font-semibold">#{created.created.agentId}</dd>
                  
                  <dt className="text-muted-foreground font-mono">owner</dt>
                  <dd className="font-mono text-foreground truncate" title={created.passport.owner}>{short(created.passport.owner, 10, 8)}</dd>
                  
                  <dt className="text-muted-foreground font-mono">operator</dt>
                  <dd className="font-mono text-foreground truncate" title={created.passport.operator}>{short(created.passport.operator, 10, 8)}</dd>
                  
                  <dt className="text-muted-foreground font-mono">mint tx</dt>
                  <dd className="font-mono text-foreground break-all min-w-0">{created.created.hash}</dd>
                  
                  {created.name && (
                    <>
                      <dt className="text-muted-foreground font-mono">name tx</dt>
                      <dd className="font-mono text-foreground break-all min-w-0">{created.name.hash}</dd>
                      
                      <dt className="text-muted-foreground font-mono">node</dt>
                      <dd className="font-mono text-foreground break-all min-w-0">{created.name.node}</dd>
                    </>
                  )}
                </dl>
                
                <div className="text-[11px] text-muted-foreground leading-relaxed pt-2 border-t border-primary/10">
                  Reputation starts at zero on-chain. The trust engine reports it as <span className="font-mono bg-black/40 px-1 py-0.5 rounded text-foreground">INSUFFICIENT_HISTORY</span> until receipts are settled.
                </div>
                
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => onPick(created.passport.domain)} 
                  className="w-full font-mono uppercase tracking-wider text-xs border-primary/30 hover:bg-primary/10 hover:text-primary"
                >
                  Open in Passport Explorer
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-white/5 bg-white/[0.02] min-w-0">
              <CardHeader className="py-3 px-5 border-b border-white/5 min-w-0">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">The 4 Pillars in Action</span>
              </CardHeader>
              <CardContent className="p-5 flex flex-col gap-4 text-xs sm:text-sm text-muted-foreground/80 leading-relaxed min-w-0">
                <div>
                  <strong className="text-foreground block font-medium mb-1">1. World ID Human Proof</strong>
                  The owner's World ID nullifier is bound on-chain before a passport can exist. A fresh wallet does not get a fresh reputation.
                </div>
                <div>
                  <strong className="text-foreground block font-medium mb-1">2. ENS Standard Identity</strong>
                  The agent receives a reverse-resolvable name like <span className="font-mono text-foreground">name.kya.eth</span> with capability text records.
                </div>
                <div>
                  <strong className="text-foreground block font-medium mb-1">3. Authority Mandate</strong>
                  The mandate is declared on-chain, so exceeding daily spend or unapproved actions revert at the smart contract level.
                </div>
                <div>
                  <strong className="text-foreground block font-medium mb-1">4. 0G Verifiable Execution</strong>
                  Actions are witnessed and receipts are permanently anchored to 0G storage.
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
