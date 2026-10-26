# Wardrail release audit — 25 October 2026

This pass preserves the approved cyberpunk city → shrine → portal journey. It does not reintroduce the rejected Lab-style interior stream. The current product is a self-hosted, single-owner registry, not a managed multi-tenant service.

## Recent request reconciliation

Later corrections take precedence over earlier experiments.

| Request | Final implementation |
| --- | --- |
| Keep the cyberpunk theme and chapter-specific palettes | Preserved city cyan/magenta, sunset shrine, jade policy, violet audit and plum/cyan threshold palettes. |
| Keep buildings stable across refreshes | Seeded city blueprint, signature `a9d8c3`; no per-visit skyline generation. |
| Sunset through the city and a brighter evening sun at the gates | Shared sun direction and sky/water lighting preserved; city sun peeks around the skyline. |
| More practical park and boundaries | 48 desktop trees with branches and leaf geometry, nine connected paths, pond edges, viewing deck, pergola, benches, planting, walkers and 246 boundary posts. Mobile uses reduced detail. |
| Natural continuous approach, including during the opening zoom | One cubic approach joins the existing spiral with a matched tangent, originating behind the elevated opening camera. No detached starter streak or elbow. Left-edge glimpses belong to this same path; their visibility follows perspective and building occlusion, not a separate decorative stream. |
| Keep the original top-left incoming trail at the gates | Preserved. The incoming trail is not squeezed into the portal. |
| Inner coils should sit only slightly inside the rim | The two inner turns share a proportional inset (`.71` at the gate), preserving spacing and axial depth. |
| Scale the whole portal composition gradually | Shared camera framing changes through gate/policy/audit/portal stages. Hero coils use the larger proportional composition; final portal fits the viewport. |
| Soften solid cyan/pink rings and rigid external strokes | Organic luminous filaments, uneven rose accents and irregular tapered flares; zero solid torus rings in the landing portal. |
| Brighter golden outer boundary | Golden particle luminance and opacity increase retained. |
| Remove the isolated timber near the final portal | Quay piling run ends before the final camera position. |
| Step from the portal into its interior; then resume continuous scroll | Preserved; seventh sidebar stop is **Inside**, with an active-state marker. |
| Match the stream inside the portal to the Lab Swarm | **Superseded by the explicit revert request.** Previous interior stream restored and retained. Original Swarm preserved separately in the reference Lab. |
| Product-specific copy; general agent identity | Wardrail positioning, `workspace-agent`, per-call policy, approvals, assertions and hash-linked audit copy retained. No “one watch” headline. Simulations are distinguished from the real console. |
| Move Lab out and clean the deployable project | Standalone `reference/visual-lab`; no `/lab` product route or imports. Only production scene primitives live in `apps/web/src/scene`. Historical briefs and unused playground source are in `reference/product-history`. Private pitch files and screenshots are ignored, not deleted. |

## Product improvements in this pass

- Console: consistent cool-dark visual system, legible action contrast, shared logo, task-oriented overview and integration checklist, agent search/status filters, mobile layouts and meaningful empty states.
- Reliability: refresh failures show stale-data status and a retry action; initial connection errors are recoverable; background polling pauses while hidden and avoids overlapping fetches; API requests have a timeout.
- Audit integrity: network errors are reported as an unavailable check, never as proof of tampering. Audit event details are keyboard-accessible.
- Identity workflows: masked owner-key input, explicit confirmation before key rotation, deliberate acknowledgment of one-time agent keys, keyboard focus containment and restoration in dialogs, and arrow-key navigation for tabs.
- Policy safety: invalid numeric caps cannot become `null` (unlimited) through JSON serialization. Regression tests cover caps, windows and every template. A dedicated SDK-example template matches the runnable example's allow/deny/ask calls.
- Integration content: actual repository URL, matching setup instructions, unpublished package caveat and remote/container path guidance. Marketing copy distinguishes decisions from agent-reported outcomes.
- Loading: no forced 900 ms hold; routes load independently; Japanese display fonts stay with the landing experience. The optional light view and all its controls, preference handling and styling have been removed. Reduced motion retains a still scene and native reading.
- Rendering lifecycle: adaptive quality and hidden-tab pausing retained; environment targets and bloom resources disposed on exit; late font callbacks cannot append objects to disposed scenes; GPU context loss falls back to the automatic graphics-unavailable fallback.
- Delivery: build-time Brotli/gzip, streaming static files, correct content types/HEAD/caching, path-boundary checks, security headers and graceful shutdown.
- Release hygiene: tracked lockfiles, MIT license, CI for tests/build/browser checks/container build, a non-root multi-stage Docker recipe, persistent-volume Compose setup, and a deployment/recovery guide.

## Verification

- Production build passes, including generation of precompressed assets. Three.js remains a separately loaded ~555 kB uncompressed chunk (~124 KiB Brotli on this build); the console does not request it.
- 15 Node tests pass: policy, lifecycle, approval, budgets/rates, signed assertions, audit tamper detection, MCP proxy, ERC-8004 encoding/linking, owner recovery, static delivery console policy validation and adaptive render budgets.
- `npm run test:web` passes against a temporary registry: owner setup, agent creation, saved-policy dry run, real authorization/approval, audit verification, keyboard-accessible audit details, mobile overflow, rotation confirmation, revocation, 404, 3D landing, continuous scroll in both directions, stack layout, quickstart and unavailable-server UI.
- Visual review covers desktop hero/intro, passport, gate, policy, audit and portal; mobile layouts; seven progress stops and the return to continuous scrolling. Reduced motion and GPU context-loss fallback pass. Particle buffers remain finite. Desktop and mobile portal bounds fit below the navigation and within the viewport. On the local Chrome desktop check at 1600×1000/DPR 1, the world became ready in 1,116 ms and the settled portal averaged 16.6 ms per frame. These are local measurements, not a cross-device performance guarantee.
- Runtime dependency audit: no known vulnerabilities reported by npm at the time of this pass. This is not a penetration test or security certification.
- Standalone visual Lab build passes. It is independent of the product build.
- `git diff --check` passes.

## Deployment status and limits

**Not pushed or deployed.** The Docker daemon is stopped on this machine, so the image has not been built locally; CI includes the build, but has not run remotely. Validate it on the deployment host. See [DEPLOYMENT.md](DEPLOYMENT.md) for exact commands, initial-owner setup, TLS, backups and restore checks.

Keep one process per data directory, persistent disk, and a single owner. Enforce every protected action at the tool boundary. Agent-reported receipts do not prove execution, and revocation cannot undo a call that already ran. On-chain registration remains optional; identity is not a safety endorsement.

## Repeat the checks

```sh
npm ci
npm ci --prefix apps/web
npm test
npm run build
npx playwright install chromium
npm run test:web
```

For an existing local Chrome install, set `CHROME_PATH` when running `npm run test:web`. Browser screenshots are written to ignored `output/smoke`. The one-off artistic review images are in ignored `output/product-final`.

## October 25 scroll and layout correction

Removed free-section proximity snapping and the finale snap target: passport, integrations and stack remain continuous in both directions after the portal entry. The gateway retains its deliberate step. Renamed the stack highlight class and scoped the MAGI core styles to prevent the Action row inheriting absolute positioning. Removed the optional light view throughout.

## Final rendering and responsive audit

- Device hints now include coarse-pointer tablets, exposed memory and CPU concurrency. These select conservative startup geometry/particle budgets; they are not treated as GPU benchmarks. Unknown hardware retains the desktop default. Runtime frame timing still adjusts resolution after sustained slowdown and restores it only after sustained recovery.
- Full-resolution color, depth and postprocessing targets are capped at 3.2 million pixels on desktop, 2 million on compact devices and 1.4 million on constrained devices. DPR is bounded by both this area budget and the existing per-device cap. Desktop MSAA uses two samples instead of four; compact devices use zero. Brightness and palette remain unchanged.
- Returning from a hidden tab resets timing warmup so the visibility gap cannot count as slow rendering. GPU draw statistics include the complete postprocessing frame. Static scenery shadows still update only when requested, particle physics sleeps when idle, and hidden tabs stop scene rendering.
- Verified all 12 landing stages and docs/verify/console entry at 320×568, 390×844, 844×390, 768×1024, 1024×768, 1366×768, 1920×1080 and 2560×1440. No horizontal document overflow. Mobile/touch contexts use compact budgets; high-DPR and large screens respect the pixel ceiling. This is Chrome emulation, not a physical-phone GPU benchmark or Safari certification.
- Reviewed both local UWI frontend snapshots (`UWI/frontend/src` and `Universal-Web3-Identity-UWI/frontend/src`). Neither contains device-tier/GPU-budget code; no unverified UWI implementation was copied.
- Reference: [MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices), particularly smaller back buffers, per-pixel VRAM budgets and avoiding blocking GPU reads. No GPU fingerprinting or synchronous per-frame GPU queries were added.
- Prior requested outcomes remain reconciled in the table above. Light view remains removed; the restored interior stream and portal proportions are unchanged. Docker daemon remains unavailable; image build and deployment-host smoke test are still required before a public release.

## Hosted backend adaptation

- Vercel production failure traced to project Root Directory `apps/web`; changed it to the repository root. The existing deployment was rebuilt successfully and is Ready at `https://kyaa.vercel.app`.
- Shared the existing policy/API and storage-core semantics with a Cloudflare Worker. SQLite-backed Durable Object storage commits state and audit events atomically; a per-registry queue serializes asynchronous requests. Local runtime checks prove a simultaneous eight-request burst cannot bypass a one-call rate limit, and signing identity plus events survive a runtime restart.
- Hosted owner is provisioned before public traffic; public setup is disabled. A separate hashed recovery credential can rotate a lost owner key. Initial credentials are private local files under ignored `.data`, never committed or embedded in frontend assets.
- Worker checks cover allow/deny, pending approval/resolution, signatures, audit validation, durable restart, revocation, operator recovery, origin restrictions and 64 KiB body limits. The complete Node suite still passes. Deployment tooling dependencies are pinned; the patched HTTP dependency reports zero npm advisories after installation.
- Workers Free was confirmed from the account dashboard. The API is deployed at https://wardrail-api.garvaditya0-082.workers.dev with SQLite persistence. Direct live checks passed owner auth, allow/ask/deny, receipts, approvals, signed assertions, audit export/verification and revocation. Vercel proxy routing connects the same-origin frontend API. No paid plan or product has been enabled.

## Mobile passport and touch-story correction — 26 October

- Reproduced the physical-phone clipping at 360 px: the passport card and inspector extended to x=439 despite the page being clipped at x=360. Fixed intrinsic grid minimums and form tracks instead of hiding overflow. The card, instructions, all three inspector tabs, inputs and button now fit their container.
- On phones the passport has readable internal spacing and a narrower identity stripe; inspector tabs wrap within three equal columns, fields have touch-friendly sizing, and idle/error content no longer reserves desktop-sized empty space.
- Removed the automatic lookup of arbitrary agent #1: the initial state explains what to enter and makes no RPC request until submission.
- Touch gestures now follow the same chapter sequence through City, Passport, Gate, Policy, Record, Portal and Inside. Tall chapter content reads natively until its edge while the camera holds that chapter; only travel to the next chapter changes the camera. Horizontal gestures, forms, interactive controls and pinch zoom are preserved; portal-interior reading stays continuous. Added compact numbered mobile chapter controls.
- `npm run test:mobile` checks real component bounds at 320, 360, 390, 430, 768 and landscape 844 px (not only document scrollWidth), all inspector tabs and lookup error state. Real Chrome touch events verify all six forward steps, reverse portal entry and continuous interior reading. CI includes this check.
- Briefly inspected both available local UWI source copies; they do not contain the matching 3D/touch implementation, so no unverified optimization was copied.

## Mobile chapter containment follow-up

The prior boundary-only swipe tests missed the reported path: a flick starting inside a tall chapter continued natively across multiple chapters. The new regression reproduced a scroll to 2,389 px when the hero reading boundary was only 24.8 px.

- A separate navigation hook now owns scrolling independently of WebGL. Reduced motion uses the same chapter sequence with instant travel; graphics-unavailable fallback retains the controller.
- Touch intent is declared before the browser starts panning. Reading gestures and their release inertia are bounded to their starting chapter; a new gesture at the edge advances exactly one chapter. The portal interior retains continuous native scrolling, with a return boundary at its entrance.
- The original failing flick now stops at 25 px. Tests also traverse the entire opening story from the initial page using ordinary repeated swipes with no manual repositioning, plus reduced-motion steps, unavailable WebGL and zoomed native panning.
- Desktop chapter controls and console workflows pass their existing browser regression suite.

## Mobile reading smoothness and gate framing follow-up

- Added `scripts/smoke-chapter-input.mjs` to the mobile CI command. The original behavior failed all four focused checks: the chapter box was visible; release travel accelerated from 3 px in the first interval to 15 px in the second; the gate caption ended at y=969 in an 844 px viewport; rapid swipes advanced to y=5023 instead of holding the policy arrival at y=3013.
- Replaced the release ease-in with bounded exponential deceleration that continues the finger velocity. Touch updates now coalesce to one scroll write per animation frame. Inertia yields to a new gesture or an external navigation command rather than fighting it.
- Chapter travel absorbs rapid swipe bursts until the animation settles and input has been quiet for 360 ms. Gestures are discarded rather than queued. Ordinary reading within a chapter has no cooldown; fresh reading resumes after the burst. The continuous portal interior, zoom, reduced-motion sequence and WebGL fallback remain covered.
- Removed the mobile chapter box and its numbered styling; desktop progress navigation remains. The mobile gate is one viewport tall, with its entire caption visible upon arrival, also checked across the phone/tablet/landscape matrix.
- Avoided repeated camera aim calculations and React stage dispatches while a long mobile chapter holds the same camera stop. Alert state dispatches now happen only when the alert changes; scroll-bar animation frames are cancelled on unmount. Existing device/frame-based rendering budgets, code splitting and deferred 3D loading remain in place.
- Verified the focused release/burst regression, complete touch journey, six layout sizes, desktop/console browser checks and 15 server tests. Headless touch tests validate input behavior and layout; they do not establish a physical phone GPU frame-rate guarantee.

## Paced scroll queue and interruption — supersedes burst suppression

- Rapid gestures are now retained in a serial queue. A chapter transition takes at least 1.35 seconds, with a 180 ms settling interval. Queued reading is combined into one glide within a chapter; remaining gestures can advance after its reading edge. Finger-driven reading remains responsive and bounded to its chapter.
- Animation progress is measured in rendered frames, with at most 32 ms of progress per frame. Removed the 1.8-second fallback that jumped to the destination when rendering was delayed. Normal 60/120 Hz displays use elapsed time consistently; slower rendering extends travel rather than skipping the scene.
- A stationary touch brakes over 160 ms and clears queued intent; release does not restart it. Reverse gestures replace the forward backlog, braking before returning. Pointer movement distinguishes a slowly starting swipe from a hold. Navigation, tab hiding, zoom and orientation changes cancel obsolete travel. Mobile address-bar height changes do not cancel normal reading.
- Touch gestures no longer leave the particle hover/attraction simulation active. Touch-only and reduced-motion sessions sample a single zero-offset texel instead of allocating the two unused GPU interaction simulations; the visible flow continues in the existing shaders. Hidden portal physics is skipped. Existing compact particle budgets, adaptive resolution, deferred WebGL imports, paused hidden-tab rendering and compressed assets remain enabled.
- Added scheduler tests for serial execution, frame stalls, holds, reversal, external navigation and reduced motion. Browser checks cover queued reading, hold/release, reversal both during travel and after a hold, the gate caption, all six mobile layout sizes and the real 3D chapter journey. The focused timing test uses the supported WebGL-unavailable mode to isolate input behavior from CI software-rendering delays; the full journey separately runs with WebGL. All 22 Node tests and both browser suites pass locally.
- References: [Lenis scrolling and interruption APIs](https://github.com/darkroomengineering/lenis), [MDN animation-frame timestamps](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame), [MDN completed scrolling and completed gestures](https://developer.mozilla.org/en-US/docs/Web/API/Document/scrollend_event), [MDN touch intent and native gestures](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action). Chapter pacing is a product-specific policy; physical-device GPU frame rate is not inferred from browser emulation.
