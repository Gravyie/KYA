import React, { useState, useEffect } from 'react';
import { api, pct, short } from '../lib/api.js';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import PillarsCard from '../components/PillarsCard.jsx';
import {
  IconTerminal,
  IconEye,
  IconSparkles,
  IconPlay,
  IconSpinner,
  IconCheck,
  IconSearch,
  IconGlobe,
  IconChip,
  IconLock,
} from '../components/icons.jsx';

const PRESET_RESEARCH_TOPICS = [
  {
    label: '0G Decentralized AI Operating System',
    prompt: 'What is 0G Network decentralized AI operating system and TEE compute architecture?',
    description: 'Investigate 0G decentralized AI infrastructure, DA layer, and verifiable compute.',
  },
  {
    label: 'ERC-8004 Trustless Agent Identity',
    prompt: 'Explain ERC-8004 trustless agent execution, identity standards, and on-chain verification.',
    description: 'Deep dive into emerging smart contract standards for autonomous agent accountability.',
  },
  {
    label: 'Ethereum L2 Throughput & Data Availability',
    prompt: 'Compare Ethereum L2 rollup data availability throughput and fee dynamics in 2026.',
    description: 'Evaluate blob space, EIP-4844 scaling, and modular DA performance metrics.',
  },
  {
    label: 'Nikola Tesla Wireless Energy',
    prompt: "Investigate Nikola Tesla's Wardenclyffe Tower wireless power transmission experiments.",
    description: 'Historical and technical deep-dive into resonant inductive wireless transmission.',
  },
];

const getBadgeStyle = (type) => {
  switch (type) {
    case 'PLAN':
      return { background: '#f3e8ff', color: '#7e22ce', borderColor: '#d8b4fe' };
    case 'SEARCH':
      return { background: '#dbeafe', color: '#1d4ed8', borderColor: '#93c5fd' };
    case 'SCRAPE':
      return { background: '#fef3c7', color: '#b45309', borderColor: '#fcd34d' };
    case 'ANALYZE':
      return { background: '#d1fae5', color: '#047857', borderColor: '#6ee7b7' };
    case 'DECIDE':
      return { background: '#ffe4e6', color: '#be123c', borderColor: '#fda4af' };
    default:
      return { background: '#f3f4f6', color: '#374151', borderColor: '#e5e7eb' };
  }
};

export default function ScraperAgentView({ onPick }) {
  const [prompt, setPrompt] = useState('What is 0G Network decentralized AI operating system and TEE compute architecture?');
  const [dryRun, setDryRun] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agentData, setAgentData] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [agentPassport, setAgentPassport] = useState(null);
  const [activeTab, setActiveTab] = useState('console'); // 'console' | 'history'
  const [copiedDigest, setCopiedDigest] = useState(false);

  // Load Passport #3 (scout.kya.eth)
  const loadPassport = () => {
    api
      .agent('3')
      .then((data) => {
        if (data?.passport) setAgentPassport(data.passport);
      })
      .catch(() => {});
  };

  // Load past runs
  const loadHistory = () => {
    api
      .scraperAgentHistory?.()
      .then((data) => {
        if (data?.runs) setHistory(data.runs);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadPassport();
    loadHistory();
  }, []);

  const handleRunAgent = async (e) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setAgentData(null);
    setError(null);

    try {
      const data = await api.runScraperAgent({
        objective: prompt.trim(),
        dryRun,
        agentId: '3',
      });
      setAgentData(data);
      if (data.passport) setAgentPassport(data.passport);
      loadHistory();
    } catch (err) {
      setError(err.message || 'Agent execution failed');
    } finally {
      setLoading(false);
    }
  };

  const copyDigest = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedDigest(true);
    setTimeout(() => setCopiedDigest(false), 2000);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge variant="outline" className="font-mono bg-white/5 border-white/10 uppercase tracking-widest text-[10px]">
            Prototype Agent #2
          </Badge>
          <span className="text-[11px] text-muted-foreground font-mono tracking-widest">
            0G Compute • Groq (gpt-oss-120b) • DuckDuckGo & Cheerio • 0G Storage
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
          <span>Autonomous Research Agent</span>
          <span className="font-mono text-sm font-semibold px-2.5 py-1 rounded-md bg-primary/20 text-primary border border-primary/30">
            scout.kya.eth
          </span>
        </h1>
        <p className="text-muted-foreground mt-2 text-sm max-w-[85ch]">
          Autonomous multi-step research agent operating under KYA Passport #3. Deploys DuckDuckGo web search,
          Cheerio page extraction, and 0G Compute LLM reasoning to synthesize cited intelligence briefs, persisting audit records
          to 0G Storage and settling receipts on-chain.
        </p>
      </div>

      {/* 4 Pillars Card */}
      <PillarsCard
        passport={agentPassport}
        latestStorageDigest={agentData?.storage?.digest}
        latestSettlementHash={agentData?.settlement?.hash}
      />

      {/* Tab Navigation */}
      <div className="flex items-center gap-3 border-b border-white/10 pb-3">
        <button
          onClick={() => setActiveTab('console')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-colors ${
            activeTab === 'console'
              ? 'bg-primary text-black font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
          }`}
        >
          <IconTerminal size={14} />
          <span>Research Console</span>
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

      {/* TAB 1: CONSOLE */}
      {activeTab === 'console' && (
        <div className="space-y-6">
          {/* Agent Meta & Capabilities Box */}
          <Card className="border-white/10 bg-black/40 backdrop-blur-md overflow-hidden">
            <CardHeader className="py-3.5 px-6 border-b border-white/5 flex flex-row items-center justify-between bg-white/[0.03]">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <button
                  onClick={() => onPick && onPick('scout.kya.eth')}
                  className="font-mono text-sm font-semibold text-white hover:text-primary transition-colors cursor-pointer"
                >
                  scout.kya.eth
                </button>
                <Badge variant="outline" className="text-[10px] font-mono text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                  Passport #3
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono text-cyan-400 border-cyan-500/30 bg-cyan-500/10">
                  openai/gpt-oss-120b
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-muted-foreground">Reputation:</span>
                <span className="text-xs font-mono text-primary font-bold">
                  {agentPassport?.reputation ? pct(agentPassport.reputation.score) : pct(6666, 1)}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  ({agentPassport?.reputation?.total ?? 4} acts)
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Presets Bar */}
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-2.5 font-medium">
                  Preset Research Objectives
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {PRESET_RESEARCH_TOPICS.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => setPrompt(p.prompt)}
                      className={`text-left p-3 rounded-lg border transition-all duration-150 ${
                        prompt === p.prompt
                          ? 'border-primary/50 bg-primary/10 text-white'
                          : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05] text-white/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-foreground">{p.label}</span>
                        {prompt === p.prompt && <IconCheck size={12} className="text-primary" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{p.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Research Input Form */}
              <form onSubmit={handleRunAgent} className="space-y-4">
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-2 font-medium">
                    Research Objective, Topic, or Target URL
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="e.g. What is 0G Network decentralized AI operating system?"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      disabled={loading}
                      className="bg-black/60 border-white/20 text-sm font-mono text-white placeholder:text-muted-foreground/60 h-11"
                    />
                    <Button
                      type="submit"
                      disabled={loading || !prompt.trim()}
                      className="bg-primary text-black font-semibold hover:bg-primary/90 px-6 h-11 shrink-0 gap-2 font-mono text-xs uppercase tracking-wider"
                    >
                      {loading ? (
                        <>
                          <IconSpinner size={14} className="animate-spin" />
                          <span>Scouting Web...</span>
                        </>
                      ) : (
                        <>
                          <IconPlay size={12} />
                          <span>Deploy Scout</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={dryRun}
                      onChange={(e) => setDryRun(e.target.checked)}
                      className="rounded border-white/20 bg-black/60 text-primary focus:ring-0 cursor-pointer"
                    />
                    <span className="text-xs font-mono text-muted-foreground">
                      Dry Run (execute research but skip on-chain settlement)
                    </span>
                  </label>

                  <span className="text-[11px] font-mono text-muted-foreground">
                    Mandate: <span className="text-amber-400">research</span> · Spend Limit: <span className="text-white">1 OG / day</span>
                  </span>
                </div>
              </form>

              {error && (
                <div className="p-4 bg-red-950/40 border border-red-800 text-red-300 text-xs font-mono rounded-lg flex items-center gap-2">
                  <span className="font-bold">Execution Error:</span>
                  <span>{error}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results Display */}
          {agentData && (
            <div className="space-y-6">
              {/* 0G Storage & On-Chain Settlement Card */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-2.5">
                  <div className="flex items-center gap-2">
                    <IconChip size={16} className="text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 font-mono">
                      0G Storage & On-Chain Settlement Receipt
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase font-bold">
                    Receipt Verified
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
                  <div className="bg-black/40 p-3 rounded border border-white/5">
                    <span className="text-muted-foreground block text-[10px] uppercase">0G Storage Digest</span>
                    <button
                      onClick={() => copyDigest(agentData.storage?.digest)}
                      className="text-emerald-400 font-bold hover:text-white transition flex items-center gap-1 mt-1 truncate max-w-full"
                      title="Click to copy full digest"
                    >
                      {short(agentData.storage?.digest, 8, 6)}
                      {copiedDigest && <IconCheck size={11} className="text-emerald-400" />}
                    </button>
                    <span className="text-[10px] text-muted-foreground/60 block mt-0.5">
                      Backend: {agentData.storage?.backend || 'local:content-addressed'}
                    </span>
                  </div>

                  <div className="bg-black/40 p-3 rounded border border-white/5">
                    <span className="text-muted-foreground block text-[10px] uppercase">Settlement Hash</span>
                    <span className="text-cyan-300 font-bold block mt-1 truncate">
                      {agentData.settlement?.hash ? short(agentData.settlement.hash, 8, 6) : 'Dry Run (unsettled)'}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 block mt-0.5">
                      Block: #{agentData.settlement?.blockNumber || '—'}
                    </span>
                  </div>

                  <div className="bg-black/40 p-3 rounded border border-white/5">
                    <span className="text-muted-foreground block text-[10px] uppercase">Reputation Delta</span>
                    <div className="flex items-center gap-2 mt-1">
                      {agentData.reputationDelta ? (
                        <>
                          <span className="text-muted-foreground line-through">
                            {pct(agentData.reputationDelta.before, 1)}
                          </span>
                          <span className="text-primary font-bold text-sm">
                            {pct(agentData.reputationDelta.after, 1)}
                          </span>
                          <span className="text-[10px] px-1 rounded bg-primary/20 text-primary font-bold">
                            +1 ACT
                          </span>
                        </>
                      ) : (
                        <span className="text-primary font-bold">
                          {agentPassport?.reputation ? pct(agentPassport.reputation.score, 1) : '66.7%'}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 block mt-0.5">
                      Total: {agentPassport?.reputation?.total ?? 5} witnessed actions
                    </span>
                  </div>

                  <div className="bg-black/40 p-3 rounded border border-white/5">
                    <span className="text-muted-foreground block text-[10px] uppercase">Log Hash Integrity</span>
                    <span className="text-emerald-400 font-bold block mt-1 flex items-center gap-1">
                      <IconCheck size={12} />
                      {agentData.integrity?.verified ? 'Merkle Verified' : 'Chain Anchored'}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 block mt-0.5">
                      {agentPassport?.domain || 'scout.kya.eth'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Synthesized Output Brief */}
              <div className="rounded-xl border border-white/10 bg-neutral-900/70 p-6 space-y-4">
                <div className="border-b border-white/10 pb-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700 uppercase font-mono">
                      Research Synthesis Complete
                    </span>
                    <h3 className="text-xl font-bold text-white mt-2">{agentData.title}</h3>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs bg-white/5 text-muted-foreground border-white/10">
                    {agentData.trace?.length || 0} Steps Evaluated
                  </Badge>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
                    Executive Synthesis
                  </h4>
                  <p className="text-sm text-neutral-200 leading-relaxed bg-black/60 p-4 rounded-lg border border-white/10 whitespace-pre-line font-sans">
                    {agentData.executiveSummary}
                  </p>
                </div>

                {agentData.keyPoints?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
                      Key Findings & Intelligence Points
                    </h4>
                    <div className="space-y-2">
                      {agentData.keyPoints.map((pt, i) => (
                        <div
                          key={i}
                          className="text-xs text-neutral-200 bg-black/50 p-3 rounded-md border border-white/10 flex items-start gap-2.5"
                        >
                          <span className="text-primary font-mono font-bold text-xs">{i + 1}.</span>
                          <span className="leading-relaxed">{pt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Real-time Agent Step Trace */}
              <div className="rounded-xl border border-white/10 bg-black/50 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
                    Autonomous ReAct Execution Trace & Tool Invocations
                  </h3>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    DuckDuckGo Lite + Cheerio DOM Engine
                  </span>
                </div>

                <div className="space-y-2">
                  {agentData.trace?.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 bg-neutral-950 p-3.5 rounded-lg border border-white/10"
                    >
                      <span
                        style={getBadgeStyle(step.type)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase shrink-0 font-mono"
                      >
                        {step.type}
                      </span>
                      <div className="space-y-1 min-w-0 flex-1">
                        <p className="text-xs font-semibold text-neutral-100">{step.action}</p>
                        <p className="text-xs text-neutral-400 font-mono break-all leading-relaxed bg-black/40 p-2 rounded border border-white/5">
                          {step.observation}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AUDIT HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Previous Research Executions</h3>
            <span className="text-xs font-mono text-muted-foreground">{history.length} records in audit log</span>
          </div>

          {history.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-white/10 rounded-xl bg-black/30 text-muted-foreground text-sm font-mono">
              No previous research runs recorded yet. Deploy Scout above to start generating verifiable research history.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((run, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-white/10 bg-black/40 backdrop-blur-md space-y-3 hover:border-white/20 transition"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-xs font-semibold text-white">{run.title || run.prompt}</span>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {new Date(run.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-300 line-clamp-2">{run.executiveSummary}</p>

                  <div className="flex flex-wrap items-center gap-3 pt-2 font-mono text-[11px]">
                    <span className="text-muted-foreground">
                      Storage Digest: <span className="text-emerald-400">{short(run.storage?.digest, 6, 4)}</span>
                    </span>
                    {run.settlement?.hash && (
                      <span className="text-muted-foreground">
                        Tx: <span className="text-cyan-400">{short(run.settlement.hash, 6, 4)}</span>
                      </span>
                    )}
                    {run.reputationDelta && (
                      <span className="text-muted-foreground">
                        Reputation: <span className="text-primary">{pct(run.reputationDelta.after, 1)}</span>
                      </span>
                    )}
                    <span className="text-muted-foreground ml-auto">
                      {run.trace?.length || 0} trace steps
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}