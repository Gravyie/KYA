# Mihari 見張り — design vision (v19: "Six worlds, one journey")

## One sentence
The page travels through six cyberpunk worlds, one per chapter, and warps between them: the frame streaks toward its centre, a ring of light opens, and the next world rushes out of it.

## The worlds (picked from the 17 in /lab)
| Chapter | World | What it shows |
|---|---|---|
| Hero | Spinner Flight 夜間飛行 | A slow flight over the megacity: holograms, searchlights, air checkpoints. "A million agents. One watch." |
| 01 Identify / 06 Passport | The Artifact 通行証 | The agent's passport as a physical object; it opens into its layers as you reach the chapter |
| 02 Decide / 07 Integrate | Senbon Torii 千本鳥居 | An endless neon torii path over a flooded street; every call is stamped at the gates |
| 03 Prove / 05 Console | Broadcast 電波ジャック | The audit log as a wall of live CRTs that glitch into sync as one screen |
| 04 Contain / 08 Use cases | Swarm 群れ | Tens of thousands of agents through one gate; Revoke turns the gate red and throws every one back |
| Finale | Wormhole 超空間 | Straight through the gate |

## How it is built
- apps/web/src/landing/director.js: one renderer hosts every world (lab/base.js HOST); worlds are built ahead of time when the browser is idle; only the world on screen is updated and drawn, both during a warp. Bloom and exposure follow the dominant world. The journey eases behind the scroll.
- Each world sits back behind its chapter's content by a per-chapter dim.
- The lab (/lab) keeps all 17 directions live for comparison.

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
