# KYA — ETHGlobal Mumbai submission

**Onchain identity, authority and reputation for autonomous AI agents.**

> KYC verifies humans. KYA verifies agents.

---

## The problem

AI agents now browse, negotiate, trade, code and spend on behalf of people. The
internet has no primitive to answer three questions before you interact with one:

1. **Who is accountable for this agent?** Is there a real human behind it, or is
   it anonymous and disposable?
2. **What is it authorized to do?** Spending limits, allowed actions, expiry.
3. **What has it actually done?** Success rate, volume, failures — and whether
   it has ever tried to exceed its mandate.

Without those, every interaction with an agent is a leap of faith. That's a
tolerable gap while agents summarize documents. It is not tolerable once they
move money, which is where the ecosystem is heading in 2026.

## What we built

An onchain passport registry plus a trust decision engine. Any human, app or
agent can look up a passport and get back a **verdict** — trust, limit or
decline — with every check that produced it.

Three things make the passport meaningful rather than decorative:

**The owner is a verified unique human.** Passport creation is gated on a World
ID proof, and the nullifier is bound onchain. A bad operator cannot walk away
from a track record by spinning up a fresh wallet.

**The mandate is enforced by the contract, not described in a README.**
`settleAction` reverts on an over-limit request, and the blocked attempt is
written to the log. An agent can't quietly probe its limits.

**Reputation is a derivative of witnessed work.** Only an allowlisted executor
can submit a receipt, and every receipt carries the 0G evidence digest for the
compute job that produced it. The agent's own key has no settle privilege —
there's a test named `test_AgentCannotSelfReport` asserting it reverts.

## Demo

```bash
pnpm install && pnpm up
```

One command: chain, contracts, seed, API, web, then a 55-check end-to-end
verification. **It exits non-zero and refuses to declare itself ready if any
check fails.** Demo at `http://127.0.0.1:5173/#/compare`.

The four beats, following PRD §8:

1. **Compare** — `optimizer.kya.eth` (human-backed, 120 witnessed actions, 90.6%,
   registered 42 days ago) beside `ghost.kya.eth`, which has no passport at all.
   Both judged against the same stated request.
2. **The relying app** — a third-party booking app with a budget and three
   candidate agents. No relationship with any of them. It asks the registry who
   is accountable, in-mandate and proven, then dispatches to exactly one.
3. **The loop closes live** — execution on 0G, record persisted and
   content-addressed, receipt settled onchain, reputation moves on screen, hash
   chain recomputed client-side and matched against the onchain head.
4. *"We're not building another AI agent. We're building the layer that lets you
   trust one."*

## Sponsor features used, and why each is necessary

### World — World ID proof of unique human

**Used:** cloud verification via the Developer Portal
(`/api/v4/verify/{rp_id}`, with `/api/v2/verify/{app_id}` fallback), with the
result carried onchain by an EIP-712 attestation. Nullifier hash bound onchain in
`HumanhoodAttestor`. Verification level preserved as a `ProofKind` enum.

**Its job:** gates passport creation. `PassportRegistry.registerAgent` reverts
with `OwnerNotHumanVerified` if the caller has no production-level proof.

**Why not interchangeable:** without proof-of-personhood, reputation is
worthless — an operator with a bad record creates a new wallet and starts clean.
The nullifier is the only thing that makes a track record *costly to abandon*.

**Honest note on the integration.** The World ID Router (`IWorldID.verifyProof`)
is deployed on World Chain, Optimism and Ethereum. KYA's registry lives on 0G so
identity and execution receipts share one chain, and no canonical router exists
there — so the zk proof is verified against World's cloud endpoint and the result
is attested onchain by a verifier key. The nullifier binding and the sybil
resistance are real; the trust assumption is that key. A staging proof is recorded
as `ProofKind.WorldIdSimulator` and `isHumanVerified()` returns **false** for it —
there is no code path where a simulator proof renders as a verified human. When
no World app is configured at all, the passport UI says **"attested locally"** in
amber rather than claiming a World-verified owner.

### ENS — discovery, and the agent card itself

**Used:** EIP-137 namehash computed onchain (tested against the spec's own
vectors); the standard resolver profile — `addr(bytes32)`,
`addr(bytes32,uint256)` (ENSIP-9), `text(bytes32,string)` (EIP-634),
`name(bytes32)` for reverse resolution — gated by `supportsInterface`. Subnames
issued under a project-owned parent, per the PRD's cost mitigation.

**Its job:** makes agents findable by name, and turns the name into the agent
card. Point `kya.eth`'s resolver at `AgentNameRegistrar` and every subname
resolves through stock ENS tooling with zero KYA-specific client code.

**Why not interchangeable:** a passport nobody can find is not an identity. ENS
also gives *other agents* a machine-readable capability list through a plain
`getText` call — no SDK required.

**The part we're proudest of:** passport-derived text records are **computed, not
stored**. `agent.capabilities`, `agent.reputation`, `agent.humanVerified` and
`agent.passport` read straight from the registry, so a name can never advertise
stale authority or a stale score. Change an agent's mandate and the text record
changes with no name write. `test_TextRecords_DerivedFieldsTrackRegistryLive`
asserts exactly that.

### 0G — execution and the durable record

**Used:** Compute Router chat/completions with `verify_tee` requested per call;
the TEE attestation digest becomes `Action.evidence` onchain. 0G Storage persists
the full action record; its digest is chained into the registry's `logHead`.

**Its job:** produces evidence the agent could not have forged, and the durable
record of what happened.

**Why not interchangeable:** reputation is only meaningful if the *execution
path* reports the outcome, not the agent. 0G supplies both the attested execution
and the durable record; the chain supplies one word that proves the record is
complete and in order.

## Beyond the PRD

Three things we built past the requirements because they sharpen the concept:

**Spending limits are enforced onchain in v1**, not the "soft check in v1" FR11
permitted. Over-limit settlement reverts and the blocked attempt is recorded.
Fuzz-tested: `testFuzz_SpendLimitNeverExceededInADay`.

**A trust engine, not just a registry.** The PRD stops at storing reputation,
which leaves every relying party to reimplement "is this a yes or a no." One
`check(passport, policy)` call returns a verdict plus its evidence. Hard gates
(identity, mandate) are structurally separated from soft signals (track record),
so a good history can never outvote a missing owner.

**`verifyLogIntegrity`** independently recomputes the hash chain from the onchain
log and compares to the onchain head. This is what makes the 0G mirror
*verifiable* rather than merely present — alter, reorder or drop one receipt and
the head diverges.

Two scoring decisions worth calling out. **Rejections are penalised harder than
failures** — a failure is the world being uncooperative, a rejection is the agent
trying to exceed its mandate, which is a much stronger negative signal about the
operator. And a **Wilson-style prior** means a 1-for-1 agent does not outrank a
940-for-1000 agent; absence of evidence is reported as `INSUFFICIENT_HISTORY`,
never as "bad."

## On simulated paths

Every integration is either `live:*` or `local:*`. The mode is computed once from
config, exposed at `/api/integrations`, and rendered in the UI. Nothing in this
codebase presents a local stand-in as a live sponsor call — the Integrations
screen states, per surface, what's live and what isn't, and the seed's own
attestations are labeled `local:kya-seed` so they can't be mistaken for World
proofs. `verify-e2e` has a dedicated section asserting this, including a check
that a locally-attested proof is never described as World-verified.

The local paths are deterministic, so a rehearsal and the live demo produce
identical numbers. Both storage paths derive the digest from the same canonical
bytes, so `logHead` verification is identical either way — the demo can run
offline without weakening the integrity claim.

## Verification

```
pnpm contracts:test   41 Foundry tests pass, including fuzz
pnpm verify           55 end-to-end checks pass over HTTP
```

The e2e suite talks to the HTTP API rather than importing the SDK, because that's
the surface the UI and any relying party actually use.

## Deferred to the 4-week polish

Arkiv-backed full historical log; cross-chain passport reads; task types beyond
the two demo capabilities; and Sybil resistance beyond the owner's World ID
(PRD open question 3 — one bad owner can still spin up fresh agents, though the
nullifier keeps the owner traceable across all of them).

## Stack

Solidity 0.8.24 + Foundry · viem · Node (dependency-free HTTP layer) · React +
Vite. No webfont or icon-library request anywhere in the frontend — a blocked CDN
on a conference network is a visible layout shift on stage.

Contracts follow **ERC-8004** ("Trustless Agents") in shape: monotonic `agentId`,
a resolvable `domain`, a `metadataURI` agent card. Authority and reputation are
added on top, because ERC-8004 deliberately leaves both to implementers.
