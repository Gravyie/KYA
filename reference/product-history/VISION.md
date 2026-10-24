# Mihari 見張り — design vision (v21: "The Watch Line", reworked)

## One sentence
One world and one unbroken flight: over the megacity at night, past a checkpoint where the passport is scanned, down onto a flooded torii path, through a portal made of the swarm, and into the wormhole beyond. No cuts; every change of place is somewhere you fly through.

## The line (apps/web/src/landing/journey.js)
The swarm is the thread: one stream of agents (GPU streaks with glowing heads) pours across the sky over the city, sweeps down to the horizon, forms the portal's ring, and through it becomes the wormhole's walls.
| Chapter | Where you are |
|---|---|
| Hero | High over the megacity; the river of agents pours from the top of the frame to the portal's light on the horizon |
| 01 Identify | A checkpoint over the avenue: the passport on its own stage, left of the copy. Drag to turn it, click to open its layers, hover to scan |
| 02 The gate | No panels: the great entrance torii (大鳥居), lit and named, with the path beyond |
| 03 Decide · 04 Prove | Inside the Senbon Torii path; the view's centre is lifted so the path's vanishing point sits above the policy panel |
| 05 Contain | Out through the great exit gate onto the plaza; the swarm portal stands on the water: ring, accretion disc of agents, light rays, rim lightning, spiral vortex, reflection. Revoke throws every agent back |
| 06–10 | The wormhole of agents: a ring of live log screens (console), passports streaming past, a helix of code (integrate), labelled layer rings (your stack), irises between chapters |
| Finale | The last iris opens onto light. "Straight through the gate." |

## Flow (kept from v10, The Corridor)
Scroll is travel along one axis. Each chapter is a camera pose; between poses the camera flies on eased paths, and the subject is framed beside the copy (the view's centre is offset, never the subject hidden behind a panel). The cursor only turns the head a touch. Things keep moving when you stop: traffic, agents, the tunnel's flow.

## References and what each contributes
- **Blade Runner / 2049**: rain, wet ground reflecting neon, smog-filtered light, the scale of towers.
- **Akira**: light trails (the bike tail-light smear) for agent calls and traffic, red as the alarm colour.
- **Ghost in the Shell (1995)**: holographic kanji signage, a city that is information.
- **Cyberpunk: Edgerunners / 2077**: cyan and hot-magenta palette, chamfered UI, HUD readouts, glitch as punctuation, not noise.
- **Evangelion**: condensed title cards (第一話), the MAGI three-way vote, hazard stripes on lockdown.
- **The eye in the sky (Blade Runner opening, Evangelion, Ergo Proxy, manga inking)**: one colossal watching eye at the vanishing point, opening in storm cloud over a rainy neon street; inked lashes and a hard lid crease from manga; a cornea catchlight shaped like a window.
- **Lusion / Oryzo, Linear, Stripe**: restraint in the UI layer, one idea per screen, motion that explains cause and effect, legibility always wins.

## Rules
1. **Three tiers.** Copy and controls are always legible (panels have their own dark glass). The 3D subject owns its zone. Ambience (rain, grid, signs, traffic, grain, scanlines) may overlap anything because it is faint.
2. **Motion is meaning.** Calls travel and get verdicts; ledger blocks appear as verdicts happen; revocation turns the world red and closes gates.
3. **Scroll speed is felt, gently.** Velocity is eased; fast scrolling stretches traffic and spins the rings, but the field of view never pumps.
4. **Palette.** Night `#05060d`; cyan `#19e6ff` (primary); magenta `#ff2fa6` (secondary); jade/amber/hot-red only for verdicts; red takes over the whole world only on lockdown.
5. **Type.** Anton for display (one family, no scripts); Chakra Petch for HUD; Noto Sans JP for kanji; Geist / Geist Mono for reading and data.
6. **Performance.** One WebGL canvas, instancing for everything repeated, procedural textures only (no downloads), capped DPR, half-rate or paused when hidden, automatic quality drop on slow frames, reduced-motion renders a still frame.
