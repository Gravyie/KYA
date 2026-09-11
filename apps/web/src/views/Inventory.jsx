import React, {useEffect, useState, useRef} from 'react';
import {api, pct, short} from '../lib/api.js';
import {Card, CardContent, CardHeader} from '../components/ui/card';
import {Button} from '../components/ui/button';
import {Input} from '../components/ui/input';
import {Badge} from '../components/ui/badge';
import {
  IconSparkles,
  IconPlay,
  IconSpinner,
  IconCheck,
  IconX,
  IconEye,
  IconArrowRight,
  IconShield,
  IconLayers,
  IconLock,
  IconGlobe,
  IconChip,
  IconTerminal,
} from '../components/icons.jsx';
import {motion, AnimatePresence} from 'motion/react';
import PillarsCard from '../components/PillarsCard.jsx';

const PRESET_PROMPTS = [
  {
    label: 'Post about KYA on X',
    prompt: 'Post about KYA on X',
    description: 'Autonomous post composed with 0G Compute TEE verification',
  },
  {
    label: 'Announce 0G + KYA integration',
    prompt: 'Post "Announcing KYA x 0G Network: Verifiable AI agents with TEE compute & decentralized storage" on X',
    description: 'Custom message published directly to X timeline',
  },
  {
    label: 'Inspect home feed & profile',
    prompt: 'Inspect authenticated home feed and verify timeline status on X',
    description: 'Read-only visual audit of session and feed state',
  },
];

const PRESET_AGENTS = [
  {
    domain: 'browser-agent.kya.eth',
    name: 'Autonomous Social & Browser Agent',
    agentId: 4,
    tag: 'ACTIVE RUNTIME',
    active: true,
    capabilities: ['browser.action', 'social.post'],
    score: 9800,
    acts: 12,
    description:
      'Headless browser execution engine powered by 0G Compute (qwen3.8-flash) with TEE cryptographic attestation, 0G Storage persistence, and on-chain passport accountability.',
  },
  {
    domain: 'optimizer.kya.eth',
    name: 'Autonomous Flight & Travel Optimizer',
    agentId: 1,
    tag: 'PRESET',
    active: true,
    capabilities: ['flight.quote', 'travel.book'],
    score: 9100,
    acts: 48,
    description:
      'Deterministic price discovery and multi-hop itinerary settlement agent. Cross-references real-time market rates under bounded budget caps.',
  },
  {
    domain: 'scout.kya.eth',
    name: 'Decentralized Research & Data Scout',
    agentId: 3,
    tag: 'PRESET',
    active: true,
    capabilities: ['research', 'scrape'],
    score: 8750,
    acts: 26,
    description:
      'Autonomous web crawler and consensus verifier. Synthesizes on-chain and off-chain data feeds with cryptographic source attribution.',
  },
];

export default function Inventory({onPick}) {
  const [taskPrompt, setTaskPrompt] = useState('Post about KYA on X');
  const [dryRun, setDryRun] = useState(true);
  const [running, setRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [agentPassport, setAgentPassport] = useState(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);
  const [activeTab, setActiveTab] = useState('console'); // 'console' | 'history' | 'catalog'
  const [sessionUser, setSessionUser] = useState(null);
  const [targetHandle, setTargetHandle] = useState('');
  const [agentIdentity, setAgentIdentity] = useState(null);
  const [copiedVerify, setCopiedVerify] = useState(false);
  const resultRef = useRef(null);

  // Load execution history
  const loadHistory = () => {
    api
      .browserAgentHistory()
      .then((data) => {
        if (data?.runs) setHistory(data.runs);
      })
      .catch(() => {});
  };

  // Load live on-chain passport for Agent #4
  const loadPassport = () => {
    api
      .agent('4')
      .then((data) => {
        if (data?.passport) setAgentPassport(data.passport);
      })
      .catch(() => {});
  };

  // Load detected active session user
  const loadSession = () => {
    api
      .browserAgentSession?.()
      .then((data) => {
        if (data?.user) setSessionUser(data.user);
        else if (data?.envHandle) setSessionUser({handle: data.envHandle});
      })
      .catch(() => {});
  };

  // Load agent identity attestation
  const loadIdentity = () => {
    api
      .browserAgentIdentity?.()
      .then((data) => {
        if (data?.ok) setAgentIdentity(data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadHistory();
    loadPassport();
    loadSession();
    loadIdentity();
  }, []);

  // Handle agent execution
  async function handleExecute() {
    if (!taskPrompt.trim()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setStatusMessage('Launching headless browser & navigating to X...');

    try {
      // Progression timers for user feedback
      const timer1 = setTimeout(() => {
        setStatusMessage('Perceiving page via 0G Compute TEE model (qwen3.8-flash)...');
      }, 3500);

      const timer2 = setTimeout(() => {
        setStatusMessage(
          dryRun
            ? 'Drafting post text & capturing visual evidence (dry-run mode)...'
            : 'Submitting post & verifying outcome on profile...',
        );
      }, 7000);

      const timer3 = setTimeout(() => {
        setStatusMessage('Persisting action record to 0G Storage & settling receipt on-chain...');
      }, 10500);

      const res = await api.runBrowserAgent({
        task: taskPrompt.trim(),
        dryRun,
        targetHandle: targetHandle.trim() || undefined,
      });

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      if (res?.authenticatedUser) {
        setSessionUser(res.authenticatedUser);
      }

      setResult(res);
      loadHistory();
      loadPassport();
      setTimeout(() => {
        resultRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'});
      }, 100);
    } catch (err) {
      setError(err.message || 'Execution failed');
    } finally {
      setRunning(false);
      setStatusMessage('');
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="font-mono bg-white/5 border-white/10 uppercase tracking-widest text-[10px]">
            Agent Inventory & Presets
          </Badge>
          <span className="text-[11px] text-muted-foreground font-mono tracking-widest">
            0G Compute TEE • 0G Storage • KYA Passports
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Autonomous Agent Inventory
        </h1>
        <p className="text-muted-foreground mt-2 text-sm max-w-[85ch]">
          Curated autonomous agents operating under 0G Compute TEE attestation, 0G Storage provenance, and KYA on-chain
          passports. Prompt preset agents to perform verifiable real-world browser tasks with complete cryptographic auditability.
        </p>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-3">
        <button
          onClick={() => setActiveTab('console')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-colors ${
            activeTab === 'console'
              ? 'bg-primary text-black font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
          }`}
        >
          <IconTerminal size={14} />
          <span>Execution Console</span>
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-colors ${
            activeTab === 'catalog'
              ? 'bg-primary text-black font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
          }`}
        >
          <IconLayers size={14} />
          <span>Agent Roster ({PRESET_AGENTS.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('history');
            loadHistory();
          }}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-colors ${
            activeTab === 'history'
              ? 'bg-primary text-black font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
          }`}
        >
          <IconEye size={14} />
          <span>Audit History {history.length ? `(${history.length})` : ''}</span>
        </button>
      </div>

      {/* TAB 1: EXECUTION CONSOLE */}
      {activeTab === 'console' && (
        <div className="space-y-6">
          <PillarsCard
            passport={agentPassport}
            latestStorageDigest={result?.storage?.digest || result?.settlement?.evidence}
            latestSettlementHash={result?.onChain?.txHash || result?.settlement?.hash || result?.settlement?.receipt?.txHash}
          />

          {/* Active Preset Agent Hero Card */}
          <Card className="border-white/10 bg-black/40 backdrop-blur-md overflow-hidden">
            <CardHeader className="py-3.5 px-6 border-b border-white/5 flex flex-row items-center justify-between bg-white/[0.03]">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <button
                  onClick={() => onPick && onPick('browser-agent.kya.eth')}
                  className="font-mono text-sm font-semibold text-white hover:text-primary transition-colors cursor-pointer"
                >
                  browser-agent.kya.eth
                </button>
                <Badge variant="outline" className="text-[10px] font-mono text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                  Passport #4
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono text-cyan-400 border-cyan-500/30 bg-cyan-500/10">
                  0G Vision TEE
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-muted-foreground">Reputation:</span>
                <span className="text-xs font-mono text-primary font-bold">
                  {agentPassport?.reputation ? pct(agentPassport.reputation.score) : pct(2352, 1)}
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Agent Overview */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-md bg-white/[0.02] border border-white/5">
                <div>
                  <h3 className="text-sm font-medium text-foreground">Autonomous Social & Headless Browser Agent</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                    Controls an authenticated headless browser session. Analyzes DOM accessibility tree and high-resolution
                    screenshots via 0G Compute TEE inference, executes multi-step web interactions, captures cryptographic
                    visual evidence, persists logs to 0G Storage, and settles on-chain.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-white/70 border border-white/10">
                    browser.action
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-white/70 border border-white/10">
                    social.post
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-white/70 border border-white/10">
                    qwen3.8-flash
                  </span>
                </div>
              </div>

              {/* Connected Account & Target Handle Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-white/[0.02] border border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className={`h-2.5 w-2.5 rounded-full ${sessionUser?.authenticated ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-medium text-white">
                        Connected X Account:
                      </span>
                      {sessionUser?.handle ? (
                        <span className="text-xs font-mono font-semibold text-primary">
                          @{sessionUser.handle}
                          {sessionUser.displayName && (
                            <span className="text-muted-foreground font-normal ml-1">
                              ({sessionUser.displayName})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-muted-foreground">
                          Auto-detected from active browser session
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Universal execution — posts to whoever is currently signed in on this machine.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-mono text-muted-foreground">Override @handle:</span>
                  <Input
                    type="text"
                    value={targetHandle}
                    onChange={(e) => setTargetHandle(e.target.value)}
                    disabled={running}
                    placeholder={sessionUser?.handle ? `@${sessionUser.handle}` : "Auto-detect"}
                    className="h-7 w-36 font-mono text-xs bg-black/50 border-white/15 px-2 py-0 text-white focus-visible:border-primary"
                  />
                </div>
              </div>

              {/* Verifiable Agent Identity Carrier Panel */}
              <div className="p-3.5 rounded-lg bg-emerald-500/[0.03] border border-emerald-500/20 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="font-mono text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      On-Chain Identity Carrier Injected
                    </span>
                    <Badge variant="outline" className="text-[9px] font-mono text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                      Passport #4
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground">Operator:</span>
                    <span className="text-[10px] font-mono text-white/90 bg-black/40 px-1.5 py-0.5 rounded border border-white/10 font-medium" title={agentIdentity?.operator}>
                      {agentIdentity?.operator ? short(agentIdentity.operator, 10, 8) : '0xef045a...63e1'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono">
                  <div className="p-2 rounded bg-black/40 border border-white/5 flex flex-col gap-0.5">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground">DOM / DevTools Object</span>
                    <span className="text-emerald-400 font-medium">window.__KYA_AGENT__</span>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-white/5 flex flex-col gap-0.5">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Outbound HTTP Headers</span>
                    <span className="text-cyan-400 font-medium truncate" title="X-KYA-Passport: eip155:31337:0xe7f1.../4">
                      X-KYA-Passport (eip155:31337:…/4)
                    </span>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-white/5 flex flex-col gap-0.5">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Cryptographic Attestation</span>
                    <span className="text-white/80 font-medium truncate" title={agentIdentity?.signature}>
                      {agentIdentity?.signature ? `${agentIdentity.signature.slice(0, 14)}...` : 'EIP-191 Signed'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-emerald-500/10 text-[11px] font-mono">
                  <span className="text-muted-foreground">
                    💡 Open DevTools Console in Chrome to inspect the live KYA identity badge.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText('await window.__KYA_AGENT__.verify()');
                      setCopiedVerify(true);
                      setTimeout(() => setCopiedVerify(false), 2000);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-primary border border-primary/30 transition-colors text-[10px]"
                  >
                    {copiedVerify ? (
                      <>
                        <IconCheck size={12} className="text-emerald-400" /> Copied Command!
                      </>
                    ) : (
                      <>
                        <span>Copy Console Verify Snippet</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Prompt Input Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <IconSparkles size={13} className="text-primary" />
                    Agent Instruction / Task Prompt
                  </label>
                  <span className="text-[11px] font-mono text-muted-foreground">Natural language browser directive</span>
                </div>

                <div className="relative">
                  <Input
                    value={taskPrompt}
                    onChange={(e) => setTaskPrompt(e.target.value)}
                    disabled={running}
                    placeholder="Enter what the agent should do in the browser (e.g. Post about KYA on X)..."
                    className="font-mono text-sm h-12 bg-black/60 border-2 border-white/20 focus-visible:border-primary text-white pl-4 pr-24 rounded-md"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {taskPrompt && !running && (
                      <button
                        onClick={() => setTaskPrompt('')}
                        className="text-muted-foreground hover:text-white text-xs px-2 py-1 rounded font-mono"
                      >
                        clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick Chips */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-mono text-muted-foreground mr-1">Presets:</span>
                  {PRESET_PROMPTS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      disabled={running}
                      onClick={() => setTaskPrompt(preset.prompt)}
                      className={`text-[11px] font-mono px-2.5 py-1 rounded border transition-all ${
                        taskPrompt === preset.prompt
                          ? 'border-primary/60 bg-primary/10 text-primary'
                          : 'border-white/10 bg-white/5 text-muted-foreground hover:text-foreground hover:border-white/20'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Execution Controls: Dry-Run Toggle & Action Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-black/60 border border-white/10">
                {/* Dry Run Toggle */}
                <div className="flex items-start sm:items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={dryRun}
                    disabled={running}
                    onClick={() => setDryRun(!dryRun)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      dryRun ? 'bg-primary' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                        dryRun ? 'translate-x-5 bg-black' : 'translate-x-0 bg-white'
                      }`}
                    />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-medium text-white">Dry-Run Simulation Mode</span>
                      {dryRun && (
                        <Badge variant="outline" className="text-[9px] font-mono text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                          Recommended for demo
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {dryRun
                        ? 'Navigates, composes draft text, captures screenshot, audits via 0G Compute, and skips final Post click.'
                        : `Live execution: Publishes real tweet to @${targetHandle?.replace(/^@/, '') || sessionUser?.handle || 'active X account'} on X, audits profile, and settles on-chain.`}
                    </p>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex items-center gap-3 shrink-0">
                  <Button
                    onClick={handleExecute}
                    disabled={running || !taskPrompt.trim()}
                    className="font-mono text-xs uppercase tracking-wider px-5 h-10 bg-primary text-black hover:bg-primary/90 font-semibold"
                  >
                    {running ? (
                      <>
                        <IconSpinner size={14} className="animate-spin mr-2" />
                        Executing…
                      </>
                    ) : (
                      <>
                        <IconPlay size={12} className="mr-2" />
                        Execute & Settle on 0G
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Progress Indicator when running */}
              <AnimatePresence>
                {running && (
                  <motion.div
                    initial={{opacity: 0, height: 0}}
                    animate={{opacity: 1, height: 'auto'}}
                    exit={{opacity: 0, height: 0}}
                    className="p-4 rounded-md border border-primary/30 bg-primary/5 space-y-2 font-mono text-xs"
                  >
                    <div className="flex items-center justify-between text-primary font-medium">
                      <span className="flex items-center gap-2">
                        <IconSpinner size={14} className="animate-spin" />
                        Autonomous Execution in Progress
                      </span>
                      <span className="text-[10px] text-primary/70 uppercase tracking-widest">TEE Attested</span>
                    </div>
                    <div className="text-white/80 pl-5">{statusMessage}</div>
                    <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden mt-2">
                      <div className="bg-primary h-full rounded-full animate-pulse w-3/4" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error Banner */}
              {error && (
                <div className="p-4 rounded-md border border-destructive/30 bg-destructive/10 text-destructive font-mono text-xs">
                  <strong>Execution Error:</strong> {error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Execution Result & Proofs Panel */}
          {result && (
            <div ref={resultRef} className="space-y-6">
              <Card className="border-white/10 bg-black/40 backdrop-blur-md overflow-hidden">
                <CardHeader className="py-3.5 px-6 border-b border-white/5 flex flex-row items-center justify-between bg-white/[0.03]">
                  <div className="flex items-center gap-2.5">
                    {result.outcome === 'success' ? (
                      <span className="font-mono text-xs uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 font-bold">
                        <IconCheck size={14} /> {result.dryRun ? 'Draft Verified (Dry Run)' : 'Task Verified & Published on X'}
                      </span>
                    ) : (
                      <span className="font-mono text-xs uppercase tracking-widest text-rose-400 flex items-center gap-1.5 font-bold">
                        <IconX size={14} /> Task Failed: Action Unverified
                      </span>
                    )}
                    <Badge variant="outline" className="font-mono text-[10px] bg-white/5 border-white/10">
                      Run ID: {result.runId}
                    </Badge>
                    {result.dryRun && (
                      <Badge variant="outline" className="font-mono text-[10px] text-amber-400 border-amber-500/30 bg-amber-500/10">
                        Dry Run
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    {new Date(result.timestamp || Date.now()).toLocaleTimeString()}
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                  {/* High-visibility Verification Verdict Alert */}
                  {result.outcome === 'failure' && (
                    <div className="p-4 rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-200 font-mono text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                          <IconX size={18} />
                          TASK FAILED — GROUND TRUTH AUDITOR REJECTED SUBMISSION
                        </span>
                        <Badge variant="outline" className="text-rose-400 border-rose-500/30 bg-rose-500/20 text-[10px]">
                          On-Chain Penalty Applied
                        </Badge>
                      </div>
                      <p className="text-sm font-sans text-white/90 font-medium">
                        {result.judgment}
                      </p>
                      {result.visualEvidence && (
                        <p className="text-[11px] text-rose-300/80">
                          Auditor Evidence: <span className="text-white/80">{result.visualEvidence}</span>
                        </p>
                      )}
                      {result.settlement?.onChain?.scoreDelta !== undefined && (
                        <div className="pt-1 text-[11px] text-rose-400 border-t border-rose-500/20 flex items-center gap-2">
                          <span>Blockchain Penalty:</span>
                          <span className="font-bold">
                            Score {result.settlement.onChain.scoreBefore} → {result.settlement.onChain.scoreAfter} ({(result.settlement.onChain.scoreDelta / 100).toFixed(1)}% drop on Passport #4)
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {result.outcome === 'success' && !result.dryRun && (
                    <div className="p-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 font-mono text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                          <IconCheck size={18} />
                          TASK SUCCEEDED — POST PUBLISHED & VERIFIED ON X
                        </span>
                        <a
                          href={result.authenticatedUser?.handle ? `https://x.com/${result.authenticatedUser.handle}` : targetHandle ? `https://x.com/${targetHandle.replace(/^@/, '')}` : (sessionUser?.handle ? `https://x.com/${sessionUser.handle}` : "https://x.com")}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 underline text-xs font-bold inline-flex items-center gap-1"
                        >
                          View Live on Profile @{result.authenticatedUser?.handle || targetHandle?.replace(/^@/, '') || sessionUser?.handle || 'User'} ↗
                        </a>
                      </div>
                      <p className="text-sm font-sans text-white/90 font-medium">
                        {result.judgment}
                      </p>
                      {result.visualEvidence && (
                        <p className="text-[11px] text-emerald-300/80">
                          Auditor Evidence: <span className="text-white/80">{result.visualEvidence}</span>
                        </p>
                      )}
                      {result.settlement?.onChain?.scoreDelta !== undefined && (
                        <div className="pt-1 text-[11px] text-emerald-400 border-t border-emerald-500/20 flex items-center gap-2">
                          <span>Blockchain Reward:</span>
                          <span className="font-bold">
                            Score {result.settlement.onChain.scoreBefore} → {result.settlement.onChain.scoreAfter} (+{(result.settlement.onChain.scoreDelta / 100).toFixed(1)}% boost on Passport #4)
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {/* High-level status bar */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-md bg-white/[0.02] border border-white/5">
                    <div>
                      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block">Outcome</span>
                      <span
                        className={`text-sm font-mono font-semibold uppercase flex items-center gap-1 mt-1 ${
                          result.outcome === 'success' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {result.outcome === 'success' ? <IconCheck size={14} /> : <IconX size={14} />} {result.outcome}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block">0G Compute Model</span>
                      <span className="text-xs font-mono text-white mt-1 block">
                        {result.attestation?.provider || '0g-compute-verified'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block">TEE Attestation</span>
                      <span className="text-xs font-mono text-cyan-400 mt-1 flex items-center gap-1">
                        <IconShield size={12} /> {result.attestation?.verified ? 'Verified & Valid' : 'Unverified'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block">Reputation Delta</span>
                      {(() => {
                        const onChain = result.settlement?.onChain;
                        if (!onChain?.settled) {
                          return <span className="text-xs font-mono text-muted-foreground mt-1 block">Pending</span>;
                        }
                        const delta = onChain.scoreDelta ?? 0;
                        if (delta > 0) {
                          return (
                            <span className="text-xs font-mono text-emerald-400 mt-1 block font-bold">
                              +{(delta / 100).toFixed(1)}% (Boost)
                            </span>
                          );
                        } else if (delta < 0) {
                          return (
                            <span className="text-xs font-mono text-rose-400 mt-1 block font-bold">
                              {(delta / 100).toFixed(1)}% (Penalty)
                            </span>
                          );
                        } else {
                          return (
                            <span className="text-xs font-mono text-white/70 mt-1 block font-bold">
                              0.0% (Unchanged)
                            </span>
                          );
                        }
                      })()}
                    </div>
                  </div>

                  {/* Independent Verification Judgment */}
                  <div className="p-4 rounded-md bg-black/60 border border-white/10 space-y-2">
                    <div className="flex items-center gap-2">
                      <IconEye size={14} className="text-primary" />
                      <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                        Independent 0G Vision Auditor Judgment
                      </span>
                    </div>
                    <p className="text-sm text-white font-medium">{result.judgment}</p>
                    {result.visualEvidence && (
                      <p className="text-xs text-muted-foreground font-mono">
                        Visual Evidence: <span className="text-white/80">{result.visualEvidence}</span>
                      </p>
                    )}
                  </div>

                  {/* Perception-Action Stepper */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <IconLayers size={13} className="text-primary" />
                      Perception-Action Sequence ({result.actionsLog?.length || 0} Steps)
                    </h4>

                    <div className="space-y-2.5">
                      {(result.actionsLog || []).map((step, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-md bg-white/[0.02] border border-white/5 font-mono text-xs"
                        >
                          <div className="flex items-start md:items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-[11px] shrink-0">
                              {step.step || idx + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-white uppercase text-[11px] px-2 py-0.5 rounded bg-white/10">
                                  {step.action}
                                </span>
                                {step.target && (
                                  <span className="text-muted-foreground text-[11px] truncate max-w-[200px]">
                                    target: <code className="text-white/80">{step.target}</code>
                                  </span>
                                )}
                                {step.value && (
                                  <span className="text-muted-foreground text-[11px] truncate max-w-[280px]">
                                    value: <span className="text-emerald-400">"{step.value}"</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-[11.5px] text-muted-foreground/90 font-sans mt-1">
                                {step.reasoning}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                            <span className="text-[10px] text-muted-foreground">
                              {step.latencyMs ? `${step.latencyMs}ms` : ''}
                            </span>
                            <Badge variant="outline" className="text-[9px] text-cyan-400 border-cyan-500/20 bg-cyan-500/5">
                              TEE Attested
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Visual Evidence / Screenshots Gallery */}
                  {result.screenshots && result.screenshots.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                          <IconEye size={13} className="text-primary" />
                          Cryptographic Visual Evidence ({result.screenshots.length} Screenshots)
                        </h4>
                        <span className="text-[11px] font-mono text-muted-foreground">Click image to inspect full-res</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {result.screenshots.map((s, idx) => (
                          <div
                            key={idx}
                            onClick={() => setSelectedScreenshot(s)}
                            className="group relative rounded-lg border border-white/10 bg-black/60 overflow-hidden cursor-pointer hover:border-primary/50 transition-all shadow-md"
                          >
                            <div className="aspect-video w-full bg-black/80 flex items-center justify-center overflow-hidden">
                              <img
                                src={s.url}
                                alt={s.label}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                              />
                            </div>
                            <div className="p-2.5 flex items-center justify-between bg-white/[0.02] border-t border-white/5">
                              <span className="font-mono text-[11px] text-white/90 truncate">{s.label}</span>
                              <span className="font-mono text-[9.5px] text-primary group-hover:underline flex items-center gap-1">
                                View <IconArrowRight size={10} />
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 0G Storage & On-Chain Settlement Proof Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {/* 0G Storage Card */}
                    <div className="p-4 rounded-lg bg-black/60 border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <IconLayers size={13} className="text-primary" />
                          0G Storage Persistence
                        </span>
                        <Badge variant="outline" className="text-[9px] font-mono text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                          Persisted
                        </Badge>
                      </div>
                      <div className="font-mono text-xs space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Backend:</span>
                          <span className="text-white/80">{result.settlement?.storage?.backend || '0g-storage-indexer'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Digest:</span>
                          <a
                            href={`#/api/records/${result.settlement?.storage?.digest}`}
                            onClick={(e) => {
                              e.preventDefault();
                              window.open(`/api/records/${result.settlement?.storage?.digest}`, '_blank');
                            }}
                            className="text-primary hover:underline truncate max-w-[200px]"
                          >
                            {short(result.settlement?.storage?.digest, 10, 6)}
                          </a>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Storage URI:</span>
                          <span className="text-white/60 truncate max-w-[200px]">
                            {result.settlement?.storage?.uri || '0g://...'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* On-Chain Settlement Card */}
                    <div className="p-4 rounded-lg bg-black/60 border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <IconLock size={13} className="text-primary" />
                          On-Chain Settlement
                        </span>
                        <Badge variant="outline" className="text-[9px] font-mono text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                          PassportRegistry.sol
                        </Badge>
                      </div>
                      <div className="font-mono text-xs space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Contract:</span>
                          <span className="text-white/80">settleAction()</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Tx Hash:</span>
                          <span className="text-primary truncate max-w-[200px]">
                            {short(result.settlement?.txHash, 10, 6) || 'Confirmed'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Passport Record:</span>
                          <button
                            onClick={() => onPick && onPick('browser-agent.kya.eth')}
                            className="text-primary hover:underline"
                          >
                            Inspect Passport #4 →
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AGENT ROSTER */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PRESET_AGENTS.map((agent) => (
              <Card key={agent.domain} className="border-white/10 bg-black/40 backdrop-blur-md flex flex-col justify-between">
                <div>
                  <CardHeader className="py-4 px-5 border-b border-white/5 flex flex-row items-center justify-between bg-white/[0.02]">
                    <div>
                      <span className="font-mono text-xs font-semibold text-white block">{agent.domain}</span>
                      <span className="text-[11px] text-muted-foreground">{agent.name}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[9.5px] font-mono ${
                        agent.tag === 'ACTIVE RUNTIME'
                          ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                          : 'text-muted-foreground border-white/10 bg-white/5'
                      }`}
                    >
                      {agent.tag}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <p className="text-xs text-muted-foreground leading-relaxed">{agent.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {agent.capabilities.map((c) => (
                        <span key={c} className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-white/70 border border-white/10">
                          {c}
                        </span>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                      <span className="text-muted-foreground">Reputation:</span>
                      <span className="text-primary font-bold">{pct(agent.score, 0)}</span>
                    </div>
                  </CardContent>
                </div>

                <div className="p-4 border-t border-white/5 bg-white/[0.01]">
                  {agent.domain === 'browser-agent.kya.eth' ? (
                    <Button
                      onClick={() => setActiveTab('console')}
                      className="w-full font-mono text-xs uppercase tracking-wider bg-primary text-black hover:bg-primary/90"
                    >
                      Launch in Console
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => onPick && onPick(agent.domain)}
                      className="w-full font-mono text-xs uppercase tracking-wider border-white/10 hover:bg-white/5"
                    >
                      View Passport
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT HISTORY */}
      {activeTab === 'history' && (
        <Card className="border-white/10 bg-black/40 backdrop-blur-md overflow-hidden">
          <CardHeader className="py-3 px-5 border-b border-white/5 flex flex-row items-center justify-between bg-white/[0.02]">
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Autonomous Execution Log ({history.length} runs recorded)
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={loadHistory}
              className="font-mono text-[11px] h-7 border-white/10 hover:bg-white/5"
            >
              Refresh Logs
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {history.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground font-mono text-xs">
                No past runs recorded yet. Execute an instruction in the console to generate audit logs.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {history.map((run, i) => (
                  <div key={run.runId || i} className="p-4 hover:bg-white/[0.02] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-white font-medium">"{run.task}"</span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-mono uppercase ${
                            run.outcome === 'success'
                              ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                              : 'text-destructive border-destructive/30 bg-destructive/10'
                          }`}
                        >
                          {run.outcome || 'executed'}
                        </Badge>
                        {run.dryRun && (
                          <Badge variant="outline" className="text-[9px] font-mono text-amber-400 border-amber-500/30 bg-amber-500/10">
                            Dry Run
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{run.judgment}</p>
                      <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground/60">
                        <span>{new Date(run.timestamp || Date.now()).toLocaleString()}</span>
                        <span>•</span>
                        <span>{run.stepsTaken || 1} steps</span>
                        <span>•</span>
                        <span>{run.attestation?.provider || '0g-compute-verified'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      {run.settlement?.storage?.digest && (
                        <button
                          onClick={() => window.open(`/api/records/${run.settlement.storage.digest}`, '_blank')}
                          className="font-mono text-[11px] text-primary hover:underline px-2 py-1 rounded bg-white/5 border border-white/10"
                        >
                          0G Record
                        </button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setResult(run);
                          setActiveTab('console');
                          setTimeout(() => {
                            resultRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'});
                          }, 100);
                        }}
                        className="font-mono text-xs h-8 border-white/10 hover:bg-white/5"
                      >
                        Inspect Proof
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Screenshot Lightbox Modal */}
      <AnimatePresence>
        {selectedScreenshot && (
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            onClick={() => setSelectedScreenshot(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          >
            <motion.div
              initial={{scale: 0.95, opacity: 0}}
              animate={{scale: 1, opacity: 1}}
              exit={{scale: 0.95, opacity: 0}}
              onClick={(e) => e.stopPropagation()}
              className="max-w-5xl w-full bg-black border border-white/20 rounded-lg overflow-hidden shadow-2xl space-y-3 p-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <IconEye size={16} className="text-primary" />
                  <span className="font-mono text-sm font-medium text-white">{selectedScreenshot.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">({selectedScreenshot.filename})</span>
                </div>
                <button
                  onClick={() => setSelectedScreenshot(null)}
                  className="text-muted-foreground hover:text-white p-1 rounded hover:bg-white/10"
                >
                  <IconX size={18} />
                </button>
              </div>

              <div className="relative aspect-video w-full bg-black/90 rounded border border-white/10 overflow-hidden flex items-center justify-center">
                <img
                  src={selectedScreenshot.url}
                  alt={selectedScreenshot.label}
                  className="max-w-full max-h-full object-contain"
                />
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-muted-foreground pt-1">
                <span>Cryptographic proof captured during headless execution</span>
                <a
                  href={selectedScreenshot.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  Open full-resolution image <IconArrowRight size={12} />
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
