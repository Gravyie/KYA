# Shuin: pitch notes

**One line:** the permission layer between AI agents and everything they can touch. Identity, approvals, limits and evidence for every agent action.

## The problem
Agents are being given real access (code, data, email, money) behind one shared key and a prompt. Security teams can't answer "which agent did this, was it allowed, and who approved it?" Existing identity products (Auth0, Okta, WorkOS, Composio) solve *connecting* agents to accounts. Few sit on the **action boundary** and hand the owner a veto, a budget and a verifiable record.

## The product
- **MCP firewall:** one config line puts policy in front of any MCP server. Blocked calls never run.
- **Policy with a human in it:** allow / ask / deny, spend budgets, rate limits, expiry, instant revoke.
- **Verifiable identity:** signed agent cards and short-lived assertions a partner can check offline and against live revocation.
- **Tamper-evident audit:** hash-linked, exportable, verifiable without trusting our server.

## Standards-aligned
Identity is built on ERC-8004 (the emerging Ethereum standard for agent identity registries) and MCP (the default tool protocol), not a proprietary format. Agents get a public, checkable passport; the control plane stays self-hosted. Complements Auth0/Okta/WorkOS/Composio (access) rather than replacing them.

## Why now
MCP became the default way models call tools, which creates a single, honest interception point for the first time. Agent incidents (deleted databases, leaked keys, runaway spend) are becoming common enough that "who allowed that?" is a procurement question.

## Wedge → expansion
Wedge: individual developers and small teams wrapping the MCP servers they already run (free, self-hosted, minutes to value). Expansion: teams (multiple owners, SSO, shared approvals, Slack/email approvals), then cross-company identity, where the registry's signed assertions become how services decide to trust an agent. Registries that issue and verify agent identity have network effects.

## Business model
Open-source core (MIT). Paid: hosted registry, team features (roles, SSO, approval routing, retention, alerting), compliance exports, and a managed public-verification directory.

## Where it honestly is today
Working end to end locally: registry, policy, approvals, limits, MCP proxy, SDK, signed identity, audit verification, console, and an 8-test integration suite. **No users, no traction, single-owner JSON storage.** Next: publish packages, Postgres/SQLite option, multi-owner, approval notifications, Python SDK, more framework adapters.

## Risks worth naming
- Enforcement is only as strong as where it is wired in; a bypassed tool is not stopped. Mitigation: make the MCP/gateway path the default and detect unguarded agents.
- Platforms (Okta, Auth0, cloud vendors) will add agent controls. Differentiation: open source, local-first, action-level approvals and evidence rather than login.
