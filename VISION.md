# Shuin — design vision (v10: "The Corridor")

## One sentence
The page is a single continuous flight down a neon canyon toward the sun. You stand at the checkpoint gate, pass through it, and every chapter is a stretch of the corridor beyond. Scroll is forward motion.

## Why this, and not the last two
- **v7 Neon Gatehouse** was the most immersive: the camera actually *went somewhere*. Rings receding into depth, runway lights chasing toward the vanishing point, towers sliding past. Scroll felt like travel.
- **v9 Neon Shuin** was the cleanest: a clear story in episodes (identify → decide → prove → contain), real interactive proof (the MAGI vote, the SHA-256 chain), an opening card and title cards, and readable panels.
- **v10** keeps v9's story, components and brand, and puts them on v7's spine. The camera never parks behind an opaque wall. The title cards are things you fly past, not curtains.

## The story as space
| Scroll | Where you are | What it means |
|---|---|---|
| Hero | At the mouth of the corridor, facing the torii checkpoint (関門). Sun at the vanishing point. | Every agent must pass a gate. |
| 01 Identify | Close to the gate; the agent's pass floats in front of it, scanned. | Identity first. |
| 02 Decide | Face-on with the gate's seal; calls stream in and get verdicts. MAGI vote panel. | One verdict per call. |
| 03 Prove | Through the gate. The ledger is laid as a glowing runway of blocks down the corridor floor; the camera flies over it. | Every verdict is a block. |
| 04 Contain | Deeper in; the corridor goes red and every ring ahead seals shut with an iris. | Revoke once, closed everywhere. |
| Lower sections | Continued flight, weaving gently left and right between towers, holo-signs and traffic. | The product, in detail. |
| Finale | Near the end of the canyon, the sun filling the gap. "KNOW YOUR AGENT." | Arrival. |

## References and what each contributes
- **Blade Runner / 2049**: rain, wet ground reflecting neon, smog-filtered light, the scale of towers.
- **Akira**: light trails (the bike tail-light smear) for agent calls and traffic, red as the alarm colour.
- **Ghost in the Shell (1995)**: holographic kanji signage, a city that is information.
- **Cyberpunk: Edgerunners / 2077**: cyan and hot-magenta palette, chamfered UI, HUD readouts, glitch as punctuation, not noise.
- **Evangelion**: condensed title cards (第一話), the MAGI three-way vote, hazard stripes on lockdown.
- **Tron / retrowave (Shopify Editions Summer '25 "Horizons")**: the grid floor and the banded sun at the vanishing point.
- **Lusion / Oryzo, Linear, Stripe**: restraint in the UI layer, one idea per screen, motion that explains cause and effect, legibility always wins.

## Rules
1. **Three tiers.** Copy and controls are always legible (panels have their own dark glass). The 3D subject owns its zone. Ambience (rain, grid, signs, traffic, grain, scanlines) may overlap anything because it is faint.
2. **Motion is meaning.** Calls travel and get verdicts; ledger blocks appear as verdicts happen; revocation turns the world red and closes gates.
3. **Scroll speed is felt.** Fast scrolling widens the field of view, stretches traffic and calls, and spins the rings.
4. **Palette.** Night `#05060d`; cyan `#19e6ff` (primary); magenta `#ff2fa6` (secondary); jade/amber/hot-red only for verdicts; red takes over the whole world only on lockdown.
5. **Type.** Chakra Petch (HUD, uppercase display); Noto Serif JP (kanji); Geist / Geist Mono (reading and data).
6. **Performance.** One WebGL canvas, instancing for everything repeated, procedural textures only (no downloads), capped DPR, half-rate or paused when hidden, automatic quality drop on slow frames, reduced-motion renders a still frame.
