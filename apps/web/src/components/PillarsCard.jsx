import React, { useState } from 'react';
import { short, pct } from '../lib/api.js';
import {
  IconShield,
  IconGlobe,
  IconLock,
  IconChip,
  IconCheck,
  IconSparkles,
} from './icons.jsx';

/**
 * The 4 Pillars of KYA Verifiable Agent Identity:
 * 1. World ID (Proof of Personhood & Anti-Sybil Root)
 * 2. ENS Identity (.kya.eth Canonical Subname & Identity Carrier)
 * 3. Authority Mandate (On-Chain Cryptographic Scopes & Spend Ceilings)
 * 4. 0G Storage & Reputation (Content-Addressed Audit Log & Merkle Hash-Chain Settlement)
 */
export default function PillarsCard({
  passport,
  latestStorageDigest = null,
  latestSettlementHash = null,
  compact = false,
}) {
  const [copiedKey, setCopiedKey] = useState(null);

  const copy = (key, text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const domain = passport?.ensName || passport?.domain || 'unknown.kya.eth';
  const owner = passport?.owner || '0x0000000000000000000000000000000000000000';
  const operator = passport?.operator || '0x0000000000000000000000000000000000000000';
  const nullifier = passport?.ownerNullifier || '0x0000000000000000000000000000000000000000';
  const proofKind = passport?.proofKindName || 'orb';
  const capabilities = passport?.capabilities || [];
  const spendLimit = passport?.authority?.spendLimitPerDayEth || '1';
  const spendRemaining = passport?.authority?.spendRemainingTodayEth || spendLimit;
  const maxActions = passport?.authority?.maxActionsPerDay || 50;
  const repScore = passport?.reputation?.score ?? 7000;
  const repTotal = passport?.reputation?.total ?? 0;
  const repRejected = passport?.reputation?.rejected ?? 0;
  const logHead = passport?.reputation?.logHead || '0x0';
  const activeDigest = latestStorageDigest || logHead;

  return (
    <div className="rounded-xl border border-white/10 bg-neutral-950/90 p-5 space-y-4 shadow-xl backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
            <IconSparkles size={16} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>KYA Four Pillars of Identity</span>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                {domain}
              </span>
            </h4>
            <p className="text-[11px] text-neutral-400 font-mono">
              On-chain cryptographically enforced agent boundary · Passport #{passport?.agentId || '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/60 border border-emerald-800/80 text-emerald-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE VERIFIED
          </span>
          {latestSettlementHash && (
            <span className="px-2 py-1 rounded bg-white/5 border border-white/10 text-neutral-300 text-[10px]">
              Tx {short(latestSettlementHash, 6, 4)}
            </span>
          )}
        </div>
      </div>

      {/* 4 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Pillar 1: World ID */}
        <div className="flex flex-col justify-between rounded-lg border border-purple-500/20 bg-gradient-to-b from-purple-950/20 to-black p-3.5 space-y-2.5 transition hover:border-purple-500/40">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider font-bold text-purple-400">
              <IconShield size={12} />
              Pillar 1: World ID
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {proofKind.toUpperCase()}
            </span>
          </div>

          <div>
            <p className="text-xs font-bold text-white">Human Proof of Personhood</p>
            <p className="text-[10.5px] text-neutral-400 leading-tight mt-0.5">
              Irrevocably bounds human owner nullifier on-chain to prevent Sybil reputation wipe.
            </p>
          </div>

          <div className="pt-2 border-t border-white/5 space-y-1.5 font-mono text-[10.5px]">
            <div className="flex justify-between items-center text-neutral-400">
              <span>Owner Nullifier:</span>
              <button
                onClick={() => copy('nullifier', nullifier)}
                className="text-purple-300 hover:text-white transition flex items-center gap-1"
                title="Click to copy full nullifier"
              >
                {short(nullifier, 6, 4)}
                {copiedKey === 'nullifier' && <IconCheck size={10} className="text-emerald-400" />}
              </button>
            </div>
            <div className="flex justify-between items-center text-neutral-400">
              <span>Owner Wallet:</span>
              <span className="text-neutral-300">{short(owner, 6, 4)}</span>
            </div>
          </div>
        </div>

        {/* Pillar 2: ENS Identity */}
        <div className="flex flex-col justify-between rounded-lg border border-cyan-500/20 bg-gradient-to-b from-cyan-950/20 to-black p-3.5 space-y-2.5 transition hover:border-cyan-500/40">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider font-bold text-cyan-400">
              <IconGlobe size={12} />
              Pillar 2: ENS Identity
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              EIP-137 / 634
            </span>
          </div>

          <div>
            <p className="text-xs font-bold text-white">{domain}</p>
            <p className="text-[10.5px] text-neutral-400 leading-tight mt-0.5">
              Canonical subname, reverse lookup, and runtime browser/DOM identity carrier.
            </p>
          </div>

          <div className="pt-2 border-t border-white/5 space-y-1.5 font-mono text-[10.5px]">
            <div className="flex justify-between items-center text-neutral-400">
              <span>Operator Key:</span>
              <button
                onClick={() => copy('operator', operator)}
                className="text-cyan-300 hover:text-white transition flex items-center gap-1"
                title="Click to copy operator address"
              >
                {short(operator, 6, 4)}
                {copiedKey === 'operator' && <IconCheck size={10} className="text-emerald-400" />}
              </button>
            </div>
            <div className="flex justify-between items-center text-neutral-400">
              <span>Resolver Mode:</span>
              <span className="text-neutral-300">Live On-Chain</span>
            </div>
          </div>
        </div>

        {/* Pillar 3: Authority Mandate */}
        <div className="flex flex-col justify-between rounded-lg border border-amber-500/20 bg-gradient-to-b from-amber-950/20 to-black p-3.5 space-y-2.5 transition hover:border-amber-500/40">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider font-bold text-amber-400">
              <IconLock size={12} />
              Pillar 3: Mandate
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              ENFORCED
            </span>
          </div>

          <div>
            <p className="text-xs font-bold text-white">Cryptographic Guardrails</p>
            <p className="text-[10.5px] text-neutral-400 leading-tight mt-0.5">
              Smart contract enforces permissions & ceilings; cannot execute outside bounds.
            </p>
          </div>

          <div className="pt-2 border-t border-white/5 space-y-1.5 font-mono text-[10.5px]">
            <div className="flex justify-between items-center text-neutral-400">
              <span>Capabilities:</span>
              <span className="text-amber-300 truncate max-w-[120px]" title={capabilities.join(', ')}>
                {capabilities.join(', ') || 'none'}
              </span>
            </div>
            <div className="flex justify-between items-center text-neutral-400">
              <span>Spend Limit:</span>
              <span className="text-neutral-300">{spendLimit} OG / day</span>
            </div>
            <div className="flex justify-between items-center text-neutral-400">
              <span>Action Cap:</span>
              <span className="text-neutral-300">{maxActions} / day</span>
            </div>
          </div>
        </div>

        {/* Pillar 4: 0G Storage & Reputation */}
        <div className="flex flex-col justify-between rounded-lg border border-emerald-500/20 bg-gradient-to-b from-emerald-950/20 to-black p-3.5 space-y-2.5 transition hover:border-emerald-500/40">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider font-bold text-emerald-400">
              <IconChip size={12} />
              Pillar 4: 0G & Reputation
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              0G STORAGE
            </span>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-bold text-white">Reputation Score</p>
              <span className="font-mono text-sm font-extrabold text-primary">
                {pct(repScore, 1)}
              </span>
            </div>
            <p className="text-[10.5px] text-neutral-400 leading-tight mt-0.5">
              Every action receipt persisted to 0G Storage and hashed into on-chain Merkle root.
            </p>
          </div>

          <div className="pt-2 border-t border-white/5 space-y-1.5 font-mono text-[10.5px]">
            <div className="flex justify-between items-center text-neutral-400">
              <span>Witnessed Acts:</span>
              <span className="text-emerald-300">
                {repTotal} total {repRejected > 0 ? `(${repRejected} rejected)` : '(0 rejected)'}
              </span>
            </div>
            <div className="flex justify-between items-center text-neutral-400">
              <span>Storage Digest:</span>
              <button
                onClick={() => copy('digest', activeDigest)}
                className="text-emerald-400 hover:text-white transition flex items-center gap-1"
                title="Click to copy 0G Storage digest"
              >
                {short(activeDigest, 6, 4)}
                {copiedKey === 'digest' && <IconCheck size={10} className="text-emerald-400" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
