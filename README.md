# KYA — Know Your Agent

**Onchain identity, authority and reputation for autonomous AI agents.**

KYC verifies humans. KYA verifies agents. Every AI agent gets a passport — a
human-verified owner (World ID), a discoverable name (ENS), and a verifiable
action history (0G) — so anyone deciding whether to trust an agent with a task or
a payment can check its passport first instead of taking it on faith.

Built for ETHGlobal Mumbai. Targets **World**, **0G** and **ENS**.

---

## Run it

```bash
pnpm install
pnpm up
```

That's the whole thing. `up.sh` starts anvil, compiles and deploys the contracts,
syncs ABIs, seeds the demo cast, starts the API and the web app, then runs a
52-check end-to-end verification. **If verification fails it exits non-zero and
tells you not to demo the build** — the point is to find a broken link before a
judge does, not after.

```
demo   http://127.0.0.1:5173/#/compare
api    http://127.0.0.1:5055/health
stop   pnpm down
```

Other entry points:

| Command | What it does |
|---|---|
| `pnpm up` | Full reset: chain, deploy, seed, api, web, verify |
| `pnpm up --no-seed` | Same, but keeps existing chain state |
| `pnpm verify` | Run the 52-check gate against a running stack |
| `pnpm contracts:test` | 41 Foundry tests including fuzz |
| `pnpm seed` | Re-seed the demo cast (~1.3s) |

Requires: node 22+, pnpm 10, foundry (`anvil`, `forge`, `cast`).

---

## The demo, in four beats

Follows Section 8 of the PRD.

**1 — Compare.** `optimizer.kya.eth` (human-backed, 120 witnessed actions, 90.6%,
42 days old) next to `ghost.kya.eth`, which has no passport at all. Both are
judged against the *same* stated request. The screen names a winner before it
shows evidence, because the product's output is a decision, not a data dump.

**2 — The relying app.** A third-party booking app wants the cheapest flight and
has three agents offering to do it. It has no relationship with any of them. It
asks the registry who is accountable, in-mandate and proven — and dispatches to
exactly one.

**3 — The loop closes live.** The chosen agent executes on 0G Compute, the record
is persisted and content-addressed, the receipt is settled on-chain by the
allowlisted executor, and the reputation number moves in front of you. The hash
chain is then recomputed client-side and matched against the on-chain head.

**4 —** *"We're not building another AI agent. We're building the layer that lets
you trust one."*

There are two other screens worth 30 seconds each: **Issue**, which shows the
contract *refusing* a simulator-grade World ID proof, and **Integrations**, which
reads live config and states what each sponsor surface is load-bearing for.

---

## What each sponsor is actually doing

Not "we called three APIs." Three jobs that cannot be swapped.

### World — proof that someone is accountable

Agent creation is gated on the owner holding a World ID proof of unique
personhood. The **nullifier hash is bound on-chain**, so one human cannot claim
two owner identities.

Why it is not interchangeable: without proof-of-personhood, an operator with a bad
record spins up a fresh wallet and gets a fresh reputation. The nullifier is the
only thing that makes a track record *costly to abandon*.

Implementation note, stated plainly: the World ID Router (`IWorldID.verifyProof`)
is only deployed on World Chain, Optimism and Ethereum. KYA's registry lives on 0G
so identity and execution receipts share one chain, and there is no canonical
router there. So the zk proof is verified against World's Developer Portal
(`/api/v4/verify/{rp_id}`, falling back to `/api/v2/verify/{app_id}`) and the
*result* is carried on-chain by an EIP-712 attestation signed by a stateless
verifier key. The nullifier — the part that actually provides sybil resistance —
is what gets stored and bound.

Verification level survives end to end. A staging proof is recorded as
`ProofKind.WorldIdSimulator` and `isHumanVerified()` returns **false** for it.
`registerAgent` reverts with `OwnerNotHumanVerified`. There is no code path where
a simulator proof renders as a verified human.

### ENS — the agent card, not a string column

Each agent gets a subname under a project-owned parent (`optimizer.kya.eth`), per
the PRD's own cost/availability mitigation.

What makes it a real integration:

- **EIP-137 namehash computed on-chain**, so `namehash("optimizer.kya.eth")` here
  equals the node any ENS client computes. Tested against the spec's own vectors.
- **The standard resolver profile**: `addr(bytes32)`, `addr(bytes32,uint256)`
  (ENSIP-9), `text(bytes32,string)` (EIP-634), `name(bytes32)` for reverse
  resolution, gated by `supportsInterface`. Point `kya.eth`'s resolver at
  `AgentNameRegistrar` and every subname resolves through stock ENS tooling with
  zero KYA-specific client code.
- **Text records are computed from the registry, not stored.**
  `agent.capabilities`, `agent.reputation`, `agent.humanVerified` and
  `agent.passport` are derived live, so a name can never advertise stale authority
  or a stale score. Change an agent's mandate and the text record changes with no
  name write. There is a test for exactly that.

Why it is not interchangeable: a passport nobody can find is not an identity. ENS
also gives *other agents* a machine-readable capability list through a plain
`getText` call.

### 0G — evidence the agent could not have forged

Task execution runs on 0G Compute's Router with `verify_tee` requested. The TEE
attestation digest becomes `Action.evidence` on-chain. The full action record goes
to 0G Storage and its digest is chained into the registry's `logHead`.

Why it is not interchangeable: reputation is only meaningful if the *execution
path* reports the outcome, not the agent. 0G supplies both the attested execution
and the durable record; the chain supplies one word that proves the record is
complete and in order.

---

## Design decisions worth defending

**Reputation is a derivative, never self-reported.** Only an allowlisted executor
can call `settleAction`. The agent's own operator key has no settle privilege —
there's a test named `test_AgentCannotSelfReport` that asserts it reverts.

**Authority is enforced, not advisory.** `settleAction` reverts on an over-limit
request. And a blocked attempt is written to the log via `rejectAction`, so an
agent cannot quietly probe its limits — enforcement that only blocks, without
recording, is enforcement you can't audit.

**Rejections hurt more than failures.** A failure is the world being
uncooperative. A rejection is the agent trying to exceed its mandate, which is a
much stronger negative signal about the *operator*. One blocked attempt alone
drops an otherwise-clean agent to DECLINE.

**A perfect 1-for-1 agent does not outrank a 940-for-1000 agent.** The score
carries a Wilson-style +8 pseudo-count of neutral evidence that decays in
influence as real history accumulates. Absence of evidence is never treated as
evidence: a new passport is `INSUFFICIENT_HISTORY`, not "bad", and the caller
decides whether that's fatal.

**The log is a hash chain.** `head_n = H(head_{n-1} || receipt)`. An off-chain 0G
Storage mirror can be proven complete and in-order against a single on-chain word.
If one receipt were altered, reordered or dropped, the recomputed head diverges.
The UI recomputes it on every dispatch and shows the result.

**Hard gates are separated from soft signals.** Identity and mandate are hard; a
good track record can never outvote a missing owner. Every verdict cites the
specific checks that produced it — no opaque scores.

**Unlabeled simulation is a bug, not a fallback.** Every integration is either
`live:*` or `local:*`, the mode is computed once from config, exposed over the
API, and rendered in the UI. Nothing in this codebase presents a stand-in as a
live sponsor call.

---

## Architecture

```
   HUMAN (owner)
        │  World ID proof → verified off-chain, carried on-chain by EIP-712
        ▼
  HumanhoodAttestor ──── nullifier bound, ProofKind recorded
        │
        ▼
  PassportRegistry ───── identity + authority + reputation
        │                canPerform() · settleAction() · rejectAction()
        ├── AgentNameRegistrar ── ENS subnames, resolver profile, derived text
        │
        ├── 0G Compute ── executes the task, returns TEE attestation
        │        ▼
        │   0G Storage ── persists the action record
        │        │
        └────────┴──> settleAction(evidence) ──> reputation moves, logHead extends
        │
        ▼
  Relying party ── one call: check(passport, policy) → trust | limit | decline
```

### Layout

```
contracts/          Solidity + Foundry (41 tests, incl. fuzz)
  src/PassportRegistry.sol     identity, authority, reputation, action log
  src/HumanhoodAttestor.sol    EIP-712 bridge for World ID proofs
  src/AgentNameRegistrar.sol   ENS namehash + resolver profile
  src/Multicall3Lite.sol       batched reads (neither anvil nor Galileo
                               guarantees canonical Multicall3)
packages/sdk/       read client + the trust decision engine
  src/decide.js     check(passport, policy) → a verdict with its evidence
apps/api/           dependency-free HTTP layer + the dispatch pipeline
  src/pipeline.js   read → decide → execute → persist → settle → verify
apps/web/           React console: compare, lookup, relying app, issue, sponsors
scripts/
  up.sh             one command to a demo-ready stack
  verify-e2e.mjs    52 checks over HTTP — the pre-demo gate
```

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/agents/:query` | Passport by ENS name, id, or address |
| `POST` | `/api/check` | Machine-readable trust check (agent-to-agent) |
| `POST` | `/api/compare` | Side-by-side against one policy |
| `POST` | `/api/route` | Rank candidates, dispatch to the winner |
| `POST` | `/api/dispatch` | The full loop for one agent |
| `GET` | `/api/integrations` | Which sponsor feature, live or local |
| `GET` | `/api/records/:digest` | Retrieve a stored action record |

---

## Configuration

Copy `.env.example` to `.env`. `pnpm up` writes one for you with local anvil
defaults, so the only things you ever add by hand are the sponsor credentials.

| Variable | Unset | Set |
|---|---|---|
| `WORLD_APP_ID` | `local:attestor-signed` — simulator proofs, registration **refused** | `live:world-cloud-verify` |
| `OG_COMPUTE_API_KEY` | `local:deterministic-executor`, labeled everywhere | `live:0g-compute-router` with `verify_tee` |
| `OG_STORAGE_PRIVATE_KEY` + `CHAIN_ID=16602` | `local:content-addressed` | `live:0g-storage` |

The local paths are deterministic — same input, same output — so a rehearsal and
the live demo produce identical numbers. Both storage paths derive the digest from
the same canonical bytes, so `logHead` verification is identical either way; the
demo can run offline without weakening the integrity claim.

---

## Verification

```
$ pnpm verify

0  Stack                      3 checks
1  World ID                   5 checks   incl. simulator cannot register
2  ENS                        6 checks   forward, reverse, derived text records
3  Trust engine               7 checks
4  Comparison                 3 checks
5  Authority                  6 checks   on-chain refusals, recorded rejections
6  0G loop                   11 checks   execute → store → settle → rep moves
7  Routing                    4 checks
8  Honesty                    4 checks   nothing simulated renders as live

PASS  52/52 checks. The PRD demo script works end to end.
```

Contracts: `pnpm contracts:test` → 41 passed, including fuzz tests that assert the
score stays within bounds and that daily spend can never exceed the mandate.

---

## Delivered vs. deferred

**Beyond the PRD.** Three things I built past the requirements because they make
the concept sharper:

- **Spending limits are enforced on-chain in v1**, not the "soft check" FR11
  allowed. Over-limit settlement reverts, and the blocked attempt is recorded.
- **`check(passport, policy)` — a trust engine, not just a registry.** The PRD
  stops at storing reputation, which leaves the hard part (turning fields into a
  yes/no) to every relying party. One call returns a verdict plus the evidence.
- **`verifyLogIntegrity`** recomputes the hash chain client-side and compares to
  the on-chain head, which is what makes the 0G mirror *verifiable* rather than
  merely present.

**Deferred to the 4-week polish**, as the PRD sequences it: Arkiv-backed full
historical log, cross-chain passport reads, task types beyond the two demo
capabilities, and Sybil resistance beyond the owner's World ID (open question 3 —
one bad owner spinning up fresh agents is still possible, though the nullifier
makes the owner traceable across all of them).

**Known limitation, stated rather than hidden.** Humanhood arrives via an EIP-712
attestation from a verifier key rather than an on-chain zk verification, because
no World ID Router exists on 0G. The trust assumption is the verifier key; the
nullifier binding and the sybil resistance are real. Deploying the registry to a
chain with a router would remove that assumption without changing the interface.
