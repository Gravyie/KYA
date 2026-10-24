# Wardrail

**The permission layer for AI agents.**

**Know your agent.** Wardrail is an open-source identity, permission and audit layer for AI agents. Every agent gets its own key and a signed identity card. Every tool call is checked against a policy (allow, ask a human, or deny). Spend and rate limits cap the damage when a rule is too generous. Every decision lands in a hash-linked log that anyone can verify offline.

Free, self-hosted, one Node process and one folder. No database, account, telemetry or paid service.

```bash
npm --prefix apps/web ci
npm run build
npm start                 # http://127.0.0.1:5055
```

Open the console, name your registry, register an agent from a template, and give it its key. Use Node 24 LTS. The SDK and environment variables retain their `mihari` names for compatibility.

## Put an agent behind it

**Any MCP server** (Claude Desktop, Cursor, anything that speaks MCP):

```json
"command": "node",
"args": ["/path/to/mihari/packages/mcp/bin/mihari-mcp.js", "--",
         "npx", "@modelcontextprotocol/server-filesystem", "/path/to/project"],
"env": {"MIHARI_AGENT_KEY": "mia_…"}
```

Blocked calls never reach the server. `tools/list` is trimmed to what the agent may use. Path arguments are made absolute and `..` escapes are blocked before policy is consulted.

**Your own agent code** (Node SDK, fail-closed):

```js
import {createMihari} from '@mihari/sdk';      // npm install ./packages/sdk
const guard = createMihari({agentKey: process.env.MIHARI_AGENT_KEY});
await guard.run({action: 'payments.send', resource: 'acme', amount: 240}, () => pay('acme', 240));
```

**Any language:** `POST /api/authorize`, poll if the answer is `ask`, then `POST /api/receipt`. See `/docs` in the running app or `apps/web/public/llms.txt`.

**Publish the agent’s identity on-chain (ERC-8004):** every agent has a passport, an ERC-8004 registration file at `/api/agents/:id/registration.json`. In the console, *Agents → Identity → Register with wallet* publishes it to the public Identity Registry on Base Sepolia (free testnet gas), Ethereum Sepolia or Base. The file rides inside the transaction as a `data:` URI, so nothing needs hosting. Wardrail verifies ownership on-chain before linking, and assertions then carry the `erc8004` claim.

**Prove identity to a partner:** an agent mints a short-lived signed assertion for one audience. The partner verifies it offline and checks live revocation (`examples/relying-party.mjs`, or paste a token at `/verify`).

## What is in the box

| Path | What |
| --- | --- |
| `apps/server` | Zero-dependency Node server: policy engine, approvals, limits, audit chain, signed cards and assertions |
| `apps/web` | React + Three.js site and console (landing, console, docs, public verifier) |
| `packages/sdk` | `@mihari/sdk`: guard, wrap, approvals, assertions, offline verifiers |
| `packages/mcp` | `@mihari/mcp`: the MCP policy firewall |
| `examples` | A scripted agent, a relying-party API, and a real demo MCP server |
| `reference/visual-lab` | Standalone archive of the seventeen interactive visual explorations |
| `legacy/` | The original ETHGlobal "KYA" prototype (contracts, browser agent), kept for reference |

## Policy in one screen

A rule is `{action, resources[], mode: allow | ask | deny, maxAmount?}`. A pattern is `*`, a prefix ending in `*`, or an exact string. Deny wins, otherwise the first matching allow/ask rule, otherwise deny. Per agent: a spend budget (`$500 per 24h`), a rate limit, and credential expiry.

## Verify it

```bash
npm test                  # policy, lifecycle, approvals, limits, assertions, audit tamper test, MCP proxy, recovery
```

The integration tests run the real server, the real SDK and the real MCP proxy against a real demo MCP server. The console workflow also has a repeatable browser check: `npm ci`, `npx playwright install chromium`, then `npm run test:web` after building. It uses an isolated temporary registry.

## Honest limits

- Wardrail decides and records. It **cannot stop a tool that bypasses the check.** Enforce at the tool or MCP layer.
- Outcome receipts are reported by the agent. They are claims, not proof.
- The audit log is tamper-evident against a known head, not a distributed ledger. Keep periodic exports elsewhere.
- Single owner per registry, JSON-file storage, one process per data directory. Fine for a team; not yet multi-tenant.
- ERC-8004 identity says an agent exists and who owns it, not that it is safe. The Reputation and Validation registries are not wired in yet.
- Packages are not published to npm yet; install from the folders.

Lost your owner key? On the host: `npm run owner:recover` (needs `.data/mihari/recovery.key`, loopback only, audited). Set `MIHARI_HOST` to expose the server and put TLS in front.

See [DEPLOYMENT.md](DEPLOYMENT.md) for hosting, persistent storage and recovery; [RELEASE-AUDIT.md](RELEASE-AUDIT.md) for the current acceptance review. Historical design and pitch notes are preserved in [reference/product-history](reference/product-history). The separate [visual Lab](reference/visual-lab) is excluded from the product build.
