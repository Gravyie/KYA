# Sigilant: product, name and design brief

## 1. Understanding what existed

**The hackathon prototype (KYA)** was a Solidity "passport" registry with World ID humanhood attestation, ENS-style agent names, 0G storage/compute and a seeded four-step demo. The contracts and decision SDK were real code; the demo experience leaned on local stand-ins, seeded history and a `demoProof` path that could label a locally built proof as production verification. That is unfit for a public identity claim.

**The previous revamp ("Auctent")** replaced that with a local-first policy gateway: owner/agent keys, allow-only scopes, `POST /api/authorize`, a hash-chained audit trail, signed identity cards and a Node SDK. Real and tested, but narrow: one decision type (allow/deny), no human in the loop, no spend control, no way to plug it into the tools people actually run agents with (MCP), and a cyberpunk skin.

**What was mocked or unfit and is gone from the active path:** World ID claims, 0G/ENS dependencies, seeded reputation, the executor stand-in. They live in `legacy/`.

## 2. The problem, the user, the wedge

Agents now hold real capability: they read repos, query databases, send email and spend money, usually behind one shared API key and a system prompt. Three failures follow: **no identity** (which agent did that?), **no enforcement** (a prompt is a suggestion), **no evidence** (logs the agent can reach are logs it can lose).

**Target user:** a developer or small team running coding, research, ops or support agents that touch files, internal APIs, email or money, and who wants a hard stop between "the model decided" and "the tool ran".

**Use cases, strongest first**

1. **Guard the tools an agent already uses (lead).** Wrap an MCP server or a function. Reads in the repo are free, `.env` is denied, pushing waits for you. Lowest friction: one config line, no code change.
2. **Spending agents with a ceiling.** Small invoices pass, anything over a threshold pauses for approval, a daily budget stops the rest even if a rule was loose.
3. **Prove who is calling.** An agent mints a short-lived signed assertion naming the accountable operator; a partner verifies it offline and checks live revocation. This is the literal "Know Your Agent" check, from the receiving side.

**Why use case 1 leads:** every agent builder already has tools; the MCP boundary is the one place enforcement is cheap, universal and honest. Identity (use case 3) becomes valuable once many agents call many services, and the registry built for use case 1 is exactly what issues it.

## 3. Product decisions

- **Integration surface:** MCP firewall (primary), Node SDK, REST, plus `llms.txt` so agents can read the docs.
- **Decision model:** allow / ask / deny, deny wins, default deny. Pure function shared by server, SDK-adjacent playground and tests.
- **Controls:** human approvals (agent blocks until the owner answers), spend budget and rate limit computed from the audit trail itself, credential expiry, instant revocation that cancels pending approvals.
- **Evidence:** append-only JSONL, SHA-256 chain, signed head on export, offline verifier. Receipts are labeled agent-reported.
- **Dropped:** World ID, 0G, ENS, Arkiv and all chain dependencies. None was needed to deliver identity → authority → evidence, and each added paid or fragile infrastructure. Ed25519 signatures give portable identity without a chain. A chain anchor for the log head remains a reasonable later option.
- **Free-only stack:** Node built-ins on the server (no dependencies), React/Vite/Three.js on the client, fonts bundled locally.

## 4. The name

| Name | Reasoning | npm / @scope / GitHub |
| --- | --- | --- |
| **Sigilant** (chosen) | *sigil* (a seal that authorises) + *vigilant*. Says "signed identity" and "watching" in one word; easy to say. | free / free / free |
| Wardkit | A ward guards; a kit is what developers install. Plain, a little generic. | free / free / free |
| Leashd | Short and memorable, but reads as punitive. | free / free / free |
| Sealgate | Seal + gate; literal to the product, clunky aloud. | free / free / free |
| Warrantly | A warrant is authority to act, but the GitHub name is taken. | free / n/a / taken |

Checked 22 Oct 2026 against the npm registry and github.com. Every `.com` in the shortlist is already registered, so a `.dev`/`.io` or a variant like `getsigilant` is the likely home; I did not confirm availability of those. This is not a trademark search. "Know your agent" stays as the tagline.

## 5. Design direction

**Idea:** one object tells the whole story. A black-chrome **gate** that agent calls stream toward; each call gets a verdict, and every verdict lands as a block on a ledger behind it. Scroll moves the camera through the story and the last stage closes the gate red: revocation.

- **Palette:** warm paper `#f2f0e9`, ink `#0e0f0c`, nothing else decorative. Colour is semantic only: verdigris green = allowed, amber = asks a human, vermilion = denied/revoked. Night panels (`#0e0f0c`) hold code.
- **Type:** Geist (UI and display, tight tracking), Geist Mono (data, rules, labels), Instrument Serif italic for a single emphasised word per headline. Editorial contrast against a technical sans. Fonts are bundled; there is no runtime CDN.
- **3D:** Three.js, procedural geometry and a procedural environment map, no downloaded assets. The Three chunk loads after first paint, DPR is capped, the loop pauses when the tab is hidden, `prefers-reduced-motion` renders one still frame, and a CSS ring replaces it when WebGL is unavailable.
- **Motion principles:** motion explains cause and effect (call → verdict → ledger), eases out (no bounce), 400–900 ms, and never blocks reading. Content sits on solid surfaces above the canvas; the canvas dims behind dense sections.
- **Console:** same paper/ink system, dense but calm. Everything that matters is a verdict badge, a rule row or a hash. Destructive actions confirm; secrets are shown once.

### References used (from the bookmarks and the research notes)

- **Awwwards, Godly, Land-book, Httpster:** hierarchy and type-led, restrained hero composition.
- **Lusion / Oryzo** (one object, real weight, camera through depth): the single-gate hero; **Hubtown:** a 3D centrepiece lifting a serious B2B product.
- **Linear / Stripe / Vercel:** restraint, tight display type, trustworthy technical product tone; **Resend / Clerk / Base docs:** quickstart structure and copy-paste snippets.
- **Tailscale / 1Password:** making security approachable instead of scary (paper palette, no lock-and-shield clichés).
- **Refactoring UI, Laws of UX, Practical Typography, Typewolf, Utopia:** spacing, contrast, line length, fluid `clamp()` type.
- **Radix / shadcn conventions:** accessible primitives behaviour (roles, labelled controls, focus rings), implemented by hand rather than imported.
- Not used: Aceternity / Magic UI-style animated component kits. They would have made it look like every other AI landing page.
