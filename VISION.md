# Mihari 見張り — design vision (v20: "The Watch Line")

## One sentence
One world and one unbroken flight: over the megacity at night, past a checkpoint where the passport is scanned, down onto a flooded torii path, through a portal made of the swarm, and into the wormhole beyond. No cuts; every change of place is somewhere you fly through.

## The line (apps/web/src/landing/journey.js)
| Chapter | Where you are | Picked from the lab |
|---|---|---|
| Hero | High over the megacity: holograms, searchlights, air lanes; the swarm portal glows on the horizon and agents stream to it across the sky | 04 Spinner Flight |
| 01 Identify | A checkpoint hovering over the avenue; the passport is scanned and opens into its labelled layers (its only appearance) | 05 The Artifact |
| 02 Decide · 03 Prove | Down on a flooded street: the Senbon Torii path. Agents walk the gates and are stamped; the towers beside it dissolve into wireframe as the portal nears | 01 Senbon Torii |
| 04 Contain | The swarm portal at the end of the path: tens of thousands of agents pour through it. Revoke turns it red and throws them all back | 09 Swarm |
| Lower sections | Inside: the wormhole, plating flowing past, the swarm streaming along it, iris gates opening ahead | 17 Wormhole |
| Finale | The last iris opens onto light. "Straight through the gate." | |

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
