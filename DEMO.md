# Demo script — 3 minutes

Rehearsed timings. Every number below is what the seeded stack actually produces,
so if a figure on screen disagrees with this page, something is wrong — re-run
`pnpm up` before going on.

**Before you present:** `pnpm up`. Wait for `PASS 55/55`. If it doesn't say that,
do not demo. Browser at `http://127.0.0.1:5173/#/compare`, window at ~1440px.

Note on counts: `pnpm up` runs the e2e suite, which dispatches real work, so
optimizer lands at **122** actions and drifter at **2** blocked attempts rather
than the seed's 120 and 1. Both grow by one each time you dispatch during the
demo. That's the system working — don't let a judge think the numbers are static.

Keyboard: `1` Compare · `2` Passport · `3` Relying app · `4` Issue · `5`
Integrations · `/` focus search.

---

## 0:00 — the hook (20s)

*Screen: Compare, "The demo scene" preset already loaded.*

> "KYC verifies humans. Nothing verifies agents. Two agents are bidding to spend
> my money on a flight. On the left, one with a passport. On the right, one
> without."

Point at the left card's title band: **AGENT PASSPORT · KYA REGISTRY**. Then the
right card: **NOT ON RECORD**, with the struck-out holder mark.

> "The right-hand one isn't malicious. It's just anonymous — and that's the
> default state of every agent on the internet today."

## 0:20 — what a passport actually contains (40s)

*Still on Compare. Click "Show evidence" on the left column.*

> "The passport has three parts, and they're deliberately not equal."

- **Identity** — a World ID-verified owner. The nullifier is bound onchain, so
  one human can't hold two owner identities. *(On a machine with no World app id
  configured this badge reads "attested locally" in amber — say so if asked; the
  gate is the same, the provenance is labeled.)*
- **Mandate** — 25 per day, `flight.quote` and `pay`, an action cap of 400.
  Declared before any work happens.
- **Track record** — ~122 witnessed actions at ~90.8%, over six weeks.

> "Notice the split: identity and mandate are **hard gates**. Track record is a
> soft signal. A great history can never outvote a missing owner — which is the
> mistake every reputation system makes."

**If asked "is that history real?"** — click `optimizer.kya.eth` in the sidebar,
scroll to the action log. Every row is an onchain receipt with a 0G evidence
digest, submitted by the executor, not the agent. The header says **hash chain
verified**.

## 1:00 — the verdict is relative to the ask (25s)

*Press `2` for Passport. `optimizer.kya.eth` should already be loaded.*

> "Trust isn't a badge, it's a function of what you're asking for."

Change **VALUE AT RISK** from `0.5` to `40`. The chip flips to
`registry says DAILY_SPEND_EXCEEDED` and the verdict turns red.

> "That refusal came from the contract — `canPerform` — not from the frontend.
> Same agent, different ask, different answer."

Set it back to `0.5`. Then change **capability** to `research`:
`CAPABILITY_NOT_GRANTED`, and the requested chip renders struck through.

## 1:25 — the loop, live (60s)

*Press `3` for Relying app.*

> "This screen is **not** KYA. It's a booking app that happens to be a customer
> of KYA. It knows nothing about these three agents."

Click **Check passports & dispatch**. The page scrolls to the result.

Walk the timeline, six steps, ~25ms total:

1. Resolved the name to passport #1 — **ENS**
2. Asked the registry — TRUST — **the trust engine**
3. Executed — **0G Compute**
4. Persisted the record — **0G Storage**
5. Settled the receipt onchain — **the reputation update**
6. Recomputed the hash chain — **integrity**

Then point at the dial: **90.83% → 90.90%**, 123 → 124 actions.

> "That number moved because a receipt was settled onchain, thirty seconds ago,
> in front of you. The agent didn't report it. The executor did, carrying the 0G
> evidence digest. That's the whole difference between a reputation you can
> trust and a star rating."

**Also point out the two DECLINEs.** `drifter.kya.eth` has 2 blocked
over-mandate attempts on its permanent record — it was refused *before* any work
was commissioned. `ghost.kya.eth` has no passport.

> "Nothing was dispatched to either. The app didn't pick the least-bad option —
> it declined them."

## 2:25 — the gate that refuses (20s)

*Press `4` for Issue. Click "use demo owner", then "Run local stand-in".*

The panel turns red: **Simulator-level proof — registration will be refused**,
and the Issue button stays disabled.

> "This is a World ID simulator proof. The contract records it, and then refuses
> to mint a passport for it — `OwnerNotHumanVerified`. A staging credential can't
> become a verified human anywhere in this system. That refusal is the product."

## 2:45 — close (15s)

*Press `5` for Integrations.*

> "World proves someone is accountable. ENS makes the agent findable and carries
> its capability list. 0G produces evidence the agent couldn't forge. Each one is
> load-bearing — and where a surface is standing in locally, this screen says so."

> **"We're not building another AI agent. We're building the layer that lets you
> trust one."**

---

## Contingencies

| If | Do |
|---|---|
| Reputation doesn't move | Check `.logs/api.log`. The dial re-reads from chain — if `settle` failed, the timeline step shows red and names the revert. |
| A number disagrees with this script | Re-run `pnpm up`. The seed is deterministic; the same cast comes back identically. |
| Judge asks about the local badges | Answer directly: no World app id or 0G key is configured on this machine, both are labeled, and the Integrations screen states it. Offer to show `/api/integrations`. |
| Judge asks "why not just verify the zk proof onchain?" | No World ID Router on 0G. We chose one chain for identity *and* receipts, and attest the verification result via EIP-712. The nullifier binding is real; the trust assumption is the verifier key. |
| Anything is visibly broken | `pnpm down && pnpm up`. Takes ~15 seconds and re-verifies 55 checks. |

## Questions we expect

**"Can't an operator just make a new agent to escape a bad record?"** Yes, and
that's PRD open question 3 — but the owner's nullifier is bound onchain, so every
agent that operator creates traces back to the same human. The record follows the
person, not the wallet.

**"What stops the executor from lying?"** Nothing in v1 — it's an allowlisted key,
and that's the honest boundary. What it *does* stop is the agent lying about its
own work, which is the failure mode that makes self-reported reputation useless.
Every receipt carries the 0G attestation digest, so the executor's claims are
checkable against the compute provider.

**"Is the spending limit really enforced?"** Yes, onchain, in v1 — the PRD only
asked for a soft check. `settleAction` reverts, and there's a fuzz test asserting
daily spend can never exceed the mandate.
