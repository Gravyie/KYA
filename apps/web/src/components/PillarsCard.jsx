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
    <div className="rounded-md border border-white/10 bg-black/40 p-5 space-y-4 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center text-foreground">
            <IconSparkles size={16} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
              <span>KYA Four Pillars of Identity</span>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white/5 text-foreground border border-white/10">
                {domain}
              </span>
            </h4>
            <p className="text-[11px] text-muted-foreground font-mono">
              On-chain cryptographically enforced agent boundary · Passport #{passport?.agentId || '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary/10 border border-primary/20 text-primary font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
            LIVE VERIFIED
          </span>
          {latestSettlementHash && (
            <span className="px-2 py-1 rounded bg-white/5 border border-white/10 text-muted-foreground text-[10px]">
              Tx {short(latestSettlementHash, 6, 4)}
            </span>
          )}
        </div>
      </div>

      {/* 4 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Pillar 1: World ID */}
        <div className="flex flex-col justify-between rounded border border-white/10 bg-white/[0.02] p-3.5 space-y-2.5 hover:border-white/20 transition-colors">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <IconShield size={12} />
              Pillar 1: World ID
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground border border-white/10">
              {proofKind.toUpperCase()}
            </span>
          </div>

          <div>
            <p className="text-xs font-semibold text-foreground">Human Proof of Personhood</p>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              Irrevocably bounds human owner nullifier on-chain to prevent Sybil reputation wipe.
            </p>
          </div>

          <div className="pt-2 border-t border-white/5 space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Owner Nullifier:</span>
              <button
                onClick={() => copy('nullifier', nullifier)}
                className="text-foreground hover:text-primary transition-colors flex items-center gap-1"
                title="Click to copy full nullifier"
              >
                {short(nullifier, 6, 4)}
                {copiedKey === 'nullifier' && <IconCheck size={10} className="text-primary" />}
              </button>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Owner Wallet:</span>
              <span className="text-foreground">{short(owner, 6, 4)}</span>
            </div>
          </div>
        </div>

        {/* Pillar 2: ENS Identity */}
        <div className="flex flex-col justify-between rounded border border-white/10 bg-white/[0.02] p-3.5 space-y-2.5 hover:border-white/20 transition-colors">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <IconGlobe size={12} />
              Pillar 2: ENS Identity
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground border border-white/10">
              EIP-137 / 634
            </span>
          </div>

          <div>
            <p className="text-xs font-semibold text-foreground">{domain}</p>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              Canonical subname, reverse lookup, and runtime browser/DOM identity carrier.
            </p>
          </div>

          <div className="pt-2 border-t border-white/5 space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Operator Key:</span>
              <button
                onClick={() => copy('operator', operator)}
                className="text-foreground hover:text-primary transition-colors flex items-center gap-1"
                title="Click to copy operator address"
              >
                {short(operator, 6, 4)}
                {copiedKey === 'operator' && <IconCheck size={10} className="text-primary" />}
              </button>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Resolver Mode:</span>
              <span className="text-foreground">Live On-Chain</span>
            </div>
          </div>
        </div>

        {/* Pillar 3: Authority Mandate */}
        <div className="flex flex-col justify-between rounded border border-white/10 bg-white/[0.02] p-3.5 space-y-2.5 hover:border-white/20 transition-colors">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <IconLock size={12} />
              Pillar 3: Mandate
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground border border-white/10">
              ENFORCED
            </span>
          </div>

          <div>
            <p className="text-xs font-semibold text-foreground">Cryptographic Guardrails</p>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              Smart contract enforces permissions & ceilings; cannot execute outside bounds.
            </p>
          </div>

          <div className="pt-2 border-t border-white/5 space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Capabilities:</span>
              <span className="text-foreground truncate max-w-[120px]" title={capabilities.join(', ')}>
                {capabilities.join(', ') || 'none'}
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Spend Limit:</span>
              <span className="text-foreground">{spendLimit} OG / day</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Action Cap:</span>
              <span className="text-foreground">{maxActions} / day</span>
            </div>
          </div>
        </div>

        {/* Pillar 4: 0G Storage & Reputation */}
        <div className="flex flex-col justify-between rounded border border-white/10 bg-white/[0.02] p-3.5 space-y-2.5 hover:border-white/20 transition-colors">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <IconChip size={12} />
              Pillar 4: 0G & Reputation
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              0G STORAGE
            </span>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-semibold text-foreground">Reputation Score</p>
              <span className="font-mono text-sm font-semibold text-primary">
                {pct(repScore, 1)}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              Every action receipt persisted to 0G Storage and hashed into on-chain Merkle root.
            </p>
          </div>

          <div className="pt-2 border-t border-white/5 space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Witnessed Acts:</span>
              <span className="text-foreground">
                {repTotal} total {repRejected > 0 ? `(${repRejected} rejected)` : '(0 rejected)'}
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Storage Digest:</span>
              <button
                onClick={() => copy('digest', activeDigest)}
                className="text-foreground hover:text-primary transition-colors flex items-center gap-1"
                title="Click to copy 0G Storage digest"
              >
                {short(activeDigest, 6, 4)}
                {copiedKey === 'digest' && <IconCheck size={10} className="text-primary" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
