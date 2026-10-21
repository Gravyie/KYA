# Auctent — Know Your Agent

Auctent is a local-first identity and permission layer for AI agents, built from the original Know Your Agent prototype. Its visual language keeps the prototype's black canvas, signal green, and halftone texture.

Auctent gives an agent a named identity, a secret credential, and narrowly scoped permission to call tools. The agent asks Auctent before a tool call. Auctent records its allow or deny decision in a hash-linked audit trail. The owner can change scopes, rotate the key, or revoke the agent immediately.

## Start locally

Requires Node 22.12+ and npm. No account, blockchain node, database service, model API, or paid infrastructure is needed.

```bash
cd apps/web && npm install && cd ../..
npm run up
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The API listens on `127.0.0.1:5055`. Press Ctrl+C to stop. State and signing keys persist under `.data/auctent/`, which Git ignores. A previous local `.data/veyscope/` directory is moved there automatically on first launch. Keep a backup of this directory and your owner key. The owner key is shown only once. The UI keeps the owner key in this browser's local storage for convenience; **Lock** clears that copy. Anyone with access to the browser profile can use a stored key.

If you lose the owner key and the browser copy is gone, use **Recover owner key** on the Unlock screen and select `.data/auctent/recovery.key` from the computer hosting this registry. Browsers require this file selection before they can read a private local file. The same recovery is available from a terminal with `npm run owner:recover` while the API is running. Both paths rotate the owner key, show the new key once, and invalidate the old one immediately. Agent identities, agent keys, signing identity, and audit events stay intact; the recovery is added to the audit trail. Save the new key in a password manager. Back up `recovery.key` with the rest of the data directory. If both your owner key and that directory are lost, the registry cannot be recovered. For a custom data directory or API address, set `AUCTENT_DATA_DIR` and `AUCTENT_URL` for the terminal command.

To run the built site from one Node process, use `npm run build --prefix apps/web` and then `npm start`. The app and API are both served on port 5055.

The existing ETHGlobal demo is preserved in [LEGACY.md](LEGACY.md). Its old Anvil launcher is `npm run legacy:up`; it is not part of the current product path.

## Product decision

**Target user:** a developer or small team running agents that can access files, call internal APIs, or take limited business actions.

**Lead use case:** a research or coding agent asks to read or write a resource. The owner registers it, gives it only named tool and resource scopes, and the agent's tool wrapper calls `POST /api/authorize` before execution. Unauthorized actions are denied and recorded.

Two adjacent use cases work with the same flow: rotate a leaked agent key without recreating the identity, and revoke an agent whose behavior or purpose changes. A relying application can fetch a signed public identity card and current revocation status before accepting an agent.

For the relying-party flow, copy the registry fingerprint from the Integration page through a trusted channel, then run `node examples/verify-card.mjs <card-url> <pinned-fingerprint>`. The verifier checks the pinned key, Ed25519 signature, matching agent ID, and live revocation status. Remote registries require HTTPS.

The product enforces **named action + resource pattern + optional maximum amount**. Resource patterns are `*`, an exact resource, or a prefix ending in `/*`. Rules are allow only; all unmatched requests are denied. A caller must actually place this check before its tool. Auctent cannot stop a bypassed tool by itself. The public landing page has a live policy preview, and owners can preview decisions for each registered agent without adding audit events.

### Working agent example

1. Create an owner in the UI, then register an agent with action `files.read` and resource `workspace/*`.
2. Copy the one-time agent key.
3. Run:

```bash
AUCTENT_AGENT_KEY='aua_…' node examples/guarded-agent.mjs README.md
```

The example authorizes a real local file read, performs it, then submits a clearly labeled **agent-reported** outcome. It resolves symlinks and rejects paths outside the current workspace before turning a file path into a policy resource. The API itself records the policy decision. Receipts are not independent proof that a tool actually ran.

### Node SDK

`packages/agent-sdk/src/index.js` exports `createAuctent`. Wrap a real tool with `guard.run({action, resource, amount, note}, tool)`. The SDK checks policy before calling `tool`, fails closed if the registry cannot be reached, and reports a success or failure outcome. A denied call throws `AuctentDeniedError`. If the tool ran but the receipt could not be recorded, it throws `AuctentError` with `executed: true` so a caller does not blindly retry a non-idempotent action. This package is included in the repository; it has not been published to npm.

### API

| Route | Authentication | Purpose |
| --- | --- | --- |
| `POST /api/setup` | First-run only | Create owner and receive its key once |
| `POST /api/owner/recover` | Local recovery credential | Rotate a lost owner key from the host terminal |
| `GET /api/dashboard` | Owner | Agents and audit events |
| `POST /api/agents` | Owner | Register identity, scopes and agent key |
| `PUT /api/agents/:id/scopes` | Owner | Change scopes |
| `POST /api/agents/:id/rotate` | Owner | Replace key |
| `POST /api/agents/:id/revoke` | Owner | Revoke access |
| `POST /api/agents/:id/simulate` | Owner | Preview an action against an agent's current scopes |
| `GET /api/agents/:id/card` | Public | Ed25519 signed identity card |
| `GET /api/agents/:id/status` | Public | Current revocation status |
| `POST /api/authorize` | Agent | Allow or deny one requested tool call |
| `POST /api/receipt` | Agent | Submit outcome for an allowed decision |
| `GET /api/audit/verify` | Owner | Recompute local audit hash chain |
| `GET /api/audit/export` | Owner | Download every audit event and chain head as JSON |
| `POST /api/preview` | Public | Run a supplied example policy without persisting an event |
| `GET /api/registry` | Public | Registry Ed25519 public key and SHA-256 fingerprint |

The owner and agent keys are random 256-bit values. Only their SHA-256 hashes are stored. The recovery credential is a separate 256-bit secret in a host-local file with owner-only permissions; the recovery endpoint also requires a loopback connection. Anyone who can read this file can rotate the owner key, so protect and back it up like the registry signing key. The API binds to loopback by default; set `AUCTENT_HOST` to expose it, and put TLS plus access controls in front of any remote deployment. Run one API process per data directory. Public cards are signed by the local registry; clients must pin its public key through a trusted channel to avoid trusting an arbitrary server's self-assertion. The audit chain detects accidental or selective event editing relative to a known head; an attacker with full host write access could rewrite both the log and its head. It is not a distributed ledger.

Run `node --test apps/api/test/guard.test.mjs` for the lifecycle test. Run `npm run build --prefix apps/web` for the frontend build.

## What the original KYA did

The ETHGlobal prototype implemented Solidity passports, mandates, a decision SDK, ENS-style subname resolution, and a hash-chain action log. It shipped seeded agents and a four-beat dispatch demo. The contracts and decision rules are real code. Its default local experience uses Anvil, seeded reputation history, a deterministic executor and local stand-ins unless sponsor credentials are configured. The legacy API's `demoProof` path could label a locally constructed human proof as production Orb verification. That makes the old flow unsuitable as a public identity claim. Auctent removes humanhood claims and sponsor dependencies from its active path while retaining the useful identity → authority → evidence principle.

## Name and design

Five names were considered: **Auctent** (authority + agent; selected), **Cautent** (caution + agent, but awkward to say), **Mandent** (mandate + agent, with a registered `.com`), **Pactent** (policy pact + agent, with a registered `.com`), and **Sentrace** (sentinel + trace, already used by an AI company). On 21 October 2026, direct checks returned HTTP 404 for the unscoped npm package `auctent`, `github.com/auctent`, and the `.com` registration in Verisign RDAP. This is a preliminary availability check, **not** a domain, trademark, or handle reservation. Availability can change.

Design direction: a cyberpunk control room with the prototype's halftone portrait, acid-green signal color, oversized Space Grotesk, mono control labels, hard grid lines, scan beams, and an animated command strip. Pale mineral-green sections break the dark sequence, including a clearly labeled example action receipt and a reversed integration composition with the code and portrait on the left. The console navigation stays in place while its content scrolls; the documentation rail has its own simple cards. Red is reserved for denied or revoked states. The interface retains legible product controls and respects reduced-motion preferences. The image is served as a 220 KB WebP; fonts ship locally and there is no runtime design CDN. The composition takes cues from the user's bookmarked [Awwwards grid and type examples](https://www.awwwards.com/inspiration/font-sized-grid-inspired-by-the-first-computers-with-primitive-software), [Httpster's dark typographic work](https://httpster.net/website/spaces-loversmagazine/), [Godly](https://godly.design/), [Refactoring UI](https://refactoringui.com/), [Mobbin](https://mobbin.com/), and [Practical Typography](https://practicaltypography.com/), without copying any site.
