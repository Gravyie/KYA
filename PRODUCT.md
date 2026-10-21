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

## 6. Iteration log

**v4: the figure and the passport.** Two changes of substance.

*Design.* v3 let the 3D object roam behind the text, which produced overlaps and cropped objects. v4 removes the cause: the scene lives in a sticky **figure frame** (header bar, canvas, footer bar) in the right column, copy scrolls on the left, and callouts sit in fixed margin slots joined to 3D anchors by leader lines. Each scene stage frames a bounding radius around its subject, so nothing is cut by the frame, and distant objects fade into the plate with fog. Every other section uses one header pattern (`§0N — label`, headline, sentence), the same radii (12/20/28), one grid and one type scale, and has no 3D at all. The only dark surface is the figure during the revoke beat.

*Product.* ERC-8004 ("Trustless Agents") is now a real feature rather than a logo: each agent's passport is a spec-shaped registration file; the console can publish it to the public Identity Registry (verified live on Base Sepolia, Ethereum Sepolia and Base) with `register(agentURI)`; the file travels as a `data:` URI so nothing is hosted; linking reads `ownerOf`/`tokenURI` back from the chain and refuses mismatches; assertions carry the `erc8004` claim and the verifier re-reads the chain. Tested against a fork of the real Base Sepolia registry and with calldata checked against Foundry's `cast`.

**Positioning against adjacent products** (from their own descriptions; no affiliation implied). Auth0 for AI Agents, Okta, WorkOS and Composio answer *which apps may this agent sign in to* and broker credentials. ERC-8004 answers *who is this agent and who owns it*, publicly. World-style proof-of-human answers *is a person behind it*. None of them is positioned as the per-call policy gate with human approval and verifiable evidence, which is Sigilant's core. The landing page frames this as layers (identity, access, action, evidence, humanhood) that you use together, and the integration path is to put Sigilant in front of the tools those providers expose.

**Not done, deliberately:** ERC-8004 Reputation and Validation registries (the Reputation `getSummary` needs a client list, and writing feedback needs product decisions about who may rate), x402 payment support, and humanhood attestations.

**v5: full-bleed world, three-tier hierarchy.** v4's framed figure solved overlap by boxing the scene, which cost the page its immersion. v5 returns to a full-bleed canvas and solves overlap with an explicit hierarchy instead. *Tier 1* is the headline, copy and CTAs: always on top, always clean. *Tier 2* is the 3D subject: composed inside its own screen zone (camera distance is solved so a bounding radius fits the zone, and a view offset places it), so it is never cropped and never reaches the copy column; callouts hang off 3D anchors and are clamped into that zone. *Tier 3* is ambience: aurora light, outlined ghost type that fades out toward the copy, hairline blueprint circles, dust and a verdict marquee. These may sit under anything because they are faint by construction. Other changes: an Instrument Serif display face (editorial against Geist and Geist Mono), a scroll-driven night mode for the revoke beat with an outro spacer so the page relaxes back to light before the product section, the aurora persisting faintly behind the lower sections so cards read as glass, magnetic buttons, pointer-tilt cards, and on phones the copy sits on frosted sheets that slide over the scene instead of crossing it.

**v6: one world, post-processed.** The page is now a single WebGL world instead of DOM layers over a canvas. The background is a fragment-shader aurora (domain-warped fbm in mint, lavender and peach, with a night palette that crossfades for the revoke beat, a pool of light behind the subject and a soft light that follows the pointer). The instrument sits on a drafting-grid floor with a pool of gate-coloured light, and gains two thin gyroscopic rings carrying orbiting beads. The agents streaming through are unlit and emissive so bloom makes them glow. A post stack (4x MSAA half-float target, restrained bloom, a tilt-shift falloff that keeps the subject zone sharp and softens the edges, chromatic aberration that grows with scroll velocity, vignette, animated film grain, neutral tone mapping) ties it together. The ghost words are now 3D planes behind the subject, parallaxed with the pointer, and scroll velocity spins the instrument and stretches the calls. The gate assembles on entry once the preloader lifts, the story ends on the call to action as a final beat that reassembles the instrument, and 13 faint column guides plus a reading-progress hairline give the page a drafting-table structure. New surfaces: a CSS holographic passport (pointer-driven foil, guilloche, a seal), and a live firewall terminal beside the integration snippets. Quality is adaptive: a slow frame budget drops the post stack and the glass transmission pass, and `?q=high` pins full quality.

**v7: Neon Gatehouse (cyberpunk rebuild).** A full restyle on a new engine (`city.js`). The world is a night city canyon: a shader sky (violet to magenta haze, stars, clouds, a banded retrowave sun, a lit skyline), instanced towers with procedural windows, a neon grid floor with a mirrored reflection, runway lights chasing toward the gate, and echo rings receding into the corridor. The gate is a neon ring on a plinth with a mechanical iris; agent calls stream through it as emissive capsules, and every verdict adds a block to the ledger chain running away down the corridor. Scroll flies the camera down the corridor through ten stops, one per section; the revoke beat floods the city red (tower windows, floor, sky, runway) with a glitch on denials. Hero is composed like a title card: a chrome SIGILANT wordmark (height-mapped canvas text with a faux-environment reflection), the gate, then the headline. Type is Chakra Petch (HUD display, uppercase) with Geist and Geist Mono; chamfered buttons, corner-bracket panels, a status HUD (sector, simulated verdict counter, diamond rail), tags pinned to 3D anchors, a boot-log preloader, and a scanline/grain/bloom/aberration post stack. Lower sections sit on a frosted dark sheet so the city reads as atmosphere behind dense content. References: Shopify Editions Summer '25 (retrowave Horizons: chrome script type, neon dusk) and Spring '26 (particle/streak depth), plus the earlier Oryzo, Lusion and Linear studies. The console, docs and verifier still use the earlier light theme.

**v8: Shuin 朱印 (rename and art direction).** Renamed from Sigilant to **Shuin**: the *shuin* was the vermilion seal stamped on official permits (shuinjō) authorising the bearer to act. That is the product: a red seal on what an agent may do. The mark is a hanko seal carrying a gate (門) with an aperture. The art direction draws on Akira (the vermilion sun, red on black), Evangelion (condensed Mincho title cards, the MAGI three-vote, episode numbering 第一話, NERV-style hazard stripes on lockdown), Ghost in the Shell and Blade Runner (rain, wet reflections, a city at dusk), and Ergo Proxy (desaturated sumi blacks). Palette: sumi ink, bone paper, one vermilion, with jade and amber only for verdicts. Type: Noto Serif JP (titles, condensed), Geist, Geist Mono. The world is a monumental gate on a flooded plaza with a banded sun, skyline, rain, lanterns, light-trail agent calls, an iris that seals with 封鎖 on revocation, and a stamped ledger. The page runs as episodes with full-screen title cards; the Decide chapter is a MAGI-style vote running the real policy engine, and the Prove chapter is a live SHA-256 chain you can tamper with. Console, docs and verifier now share the dark theme. Data from earlier names migrates automatically.

**v9: Neon Shuin.** The v8 flow (opening card, episode title cards, MAGI vote, live hash chain, contain beat, finale) with the v7 neon theme: cyan and magenta on deep night, Chakra Petch HUD type with Noto Serif JP kanji, chamfered buttons, corner-bracket panels, scanlines and chromatic-split titles. The world keeps the torii checkpoint on a wet, reflective plaza in the rain, now in a neon city: a retrowave banded sun, a skyline with neon windows, instanced towers with edge-lit neon strips, holographic kanji signs that flicker (Ghost in the Shell, Blade Runner, Cyberpunk 2077's Japantown), air traffic streaking between towers, and a pulsing neon grid floor. Revocation floods everything red. Outlined neon kanji title cards glitch on entry.
