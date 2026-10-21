# Sigilant

**Know your agent.** Sigilant is an open-source identity, permission and audit layer for AI agents. Every agent gets its own key and a signed identity card. Every tool call is checked against a policy (allow, ask a human, or deny). Spend and rate limits cap the damage when a rule is too generous. Every decision lands in a hash-linked log that anyone can verify offline.

Free, self-hosted, one Node process and one folder. No database, account, telemetry or paid service.

```bash
npm --prefix apps/web install
npm run build
npm start                 # http://127.0.0.1:5055
```

Open the console, name your registry, register an agent from a template, and give it its key. Requires Node 20.12+.

## Put an agent behind it

**Any MCP server** (Claude Desktop, Cursor, anything that speaks MCP):

```json
"command": "node",
"args": ["/path/to/sigilant/packages/mcp/bin/sigilant-mcp.js", "--",
         "npx", "@modelcontextprotocol/server-filesystem", "/path/to/project"],
"env": {"SIGILANT_AGENT_KEY": "sga_…"}
```

Blocked calls never reach the server. `tools/list` is trimmed to what the agent may use. Path arguments are made absolute and `..` escapes are blocked before policy is consulted.

**Your own agent code** (Node SDK, fail-closed):

```js
import {createSigilant} from '@sigilant/sdk';      // npm install ./packages/sdk
const guard = createSigilant({agentKey: process.env.SIGILANT_AGENT_KEY});
await guard.run({action: 'payments.send', resource: 'acme', amount: 240}, () => pay('acme', 240));
```

**Any language:** `POST /api/authorize`, poll if the answer is `ask`, then `POST /api/receipt`. See `/docs` in the running app or `apps/web/public/llms.txt`.

**Prove identity to a partner:** an agent mints a short-lived signed assertion for one audience. The partner verifies it offline and checks live revocation (`examples/relying-party.mjs`, or paste a token at `/verify`).

## What is in the box

| Path | What |
| --- | --- |
| `apps/server` | Zero-dependency Node server: policy engine, approvals, limits, audit chain, signed cards and assertions |
| `apps/web` | React + Three.js site and console (landing, console, docs, public verifier) |
| `packages/sdk` | `@sigilant/sdk`: guard, wrap, approvals, assertions, offline verifiers |
| `packages/mcp` | `@sigilant/mcp`: the MCP policy firewall |
| `examples` | A scripted agent, a relying-party API, and a real demo MCP server |
| `legacy/` | The original ETHGlobal "KYA" prototype (contracts, browser agent), kept for reference |

## Policy in one screen

A rule is `{action, resources[], mode: allow | ask | deny, maxAmount?}`. A pattern is `*`, a prefix ending in `*`, or an exact string. Deny wins, otherwise the first matching allow/ask rule, otherwise deny. Per agent: a spend budget (`$500 per 24h`), a rate limit, and credential expiry.

## Verify it

```bash
npm test                  # policy, lifecycle, approvals, limits, assertions, audit tamper test, MCP proxy, recovery
```

Eight tests run the real server, the real SDK and the real MCP proxy against a real demo MCP server. The same flows were also driven through the console in a browser.

## Honest limits

- Sigilant decides and records. It **cannot stop a tool that bypasses the check.** Enforce at the tool or MCP layer.
- Outcome receipts are reported by the agent. They are claims, not proof.
- The audit log is tamper-evident against a known head, not a distributed ledger. Keep periodic exports elsewhere.
- Single owner per registry, JSON-file storage, one process per data directory. Fine for a team; not yet multi-tenant.
- Packages are not published to npm yet; install from the folders.

Lost your owner key? On the host: `npm run owner:recover` (needs `.data/sigilant/recovery.key`, loopback only, audited). Set `SIGILANT_HOST` to expose the server and put TLS in front.

See [PRODUCT.md](PRODUCT.md) for the thinking behind the product, the name and the design, and [PITCH.md](PITCH.md) for the investor framing.
