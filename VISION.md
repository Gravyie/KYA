# Mihari 見張り — design vision (v15: "The Watch")

## One sentence
The city is watched. The site opens on a single inked eye that wakes, blinks, glances at you and lets you fall through its pupil into a neon city. The same eye hangs in the sky over the checkpoint gate for the rest of the page, blinking and following your cursor, reflected in the flooded street.

## Why the eye
- The name means "lookout". The product watches every agent call. The logo is that eye. Name, mark, opening and world are now one idea instead of four.
- The pupil-as-portal opening (manga ink lashes, a magenta data-glyph iris) gives the first five seconds an arc: closed, awake, aware of you, then you are inside.
- v10's corridor flight stays as the spine (scroll is forward motion through the checkpoint), and so does the story: identify, decide, prove, contain.

## The story as space
| Scroll | Where you are | What it means |
|---|---|---|
| Opening | A full-screen eye wakes and blinks, then you fall through the pupil. Once per session; any key or click skips. | You are now being watched over. |
| Hero | At the gate, with the eye over it. "EVERY AGENT. EVERY ACTION. WATCHED." | Nothing gets through unseen. |
| 01 Identify | The agent's pass is scanned at the gate. | Identity first. |
| 02 Decide | Calls stream in and get verdicts. MAGI vote panel. | One verdict per call. |
| 03 Prove | The ledger runway of blocks. | Every verdict is a block. |
| 04 Contain | The world goes red, the eye's iris turns red, every ring seals. | Revoke once, closed everywhere. |
| Finale | "KNOW YOUR AGENT." with the eye mark, then the footer on the same screen. | Arrival. |

## References and what each contributes
- **Blade Runner / 2049**: rain, wet ground reflecting neon, smog-filtered light, the scale of towers.
- **Akira**: light trails (the bike tail-light smear) for agent calls and traffic, red as the alarm colour.
- **Ghost in the Shell (1995)**: holographic kanji signage, a city that is information.
- **Cyberpunk: Edgerunners / 2077**: cyan and hot-magenta palette, chamfered UI, HUD readouts, glitch as punctuation, not noise.
- **Evangelion**: condensed title cards (第一話), the MAGI three-way vote, hazard stripes on lockdown.
- **The eye in the sky (Blade Runner opening, Evangelion, manga inking)**: one giant watching eye replaces the sun at the vanishing point; the opening eye is inked like a manga panel, with a pink data-glyph iris.
- **Lusion / Oryzo, Linear, Stripe**: restraint in the UI layer, one idea per screen, motion that explains cause and effect, legibility always wins.

## Rules
1. **Three tiers.** Copy and controls are always legible (panels have their own dark glass). The 3D subject owns its zone. Ambience (rain, grid, signs, traffic, grain, scanlines) may overlap anything because it is faint.
2. **Motion is meaning.** Calls travel and get verdicts; ledger blocks appear as verdicts happen; revocation turns the world red and closes gates.
3. **Scroll speed is felt, gently.** Velocity is eased; fast scrolling stretches traffic and spins the rings, but the field of view never pumps.
4. **Palette.** Night `#05060d`; cyan `#19e6ff` (primary); magenta `#ff2fa6` (secondary); jade/amber/hot-red only for verdicts; red takes over the whole world only on lockdown.
5. **Type.** Anton for display (one family, no scripts); Chakra Petch for HUD; Noto Sans JP for kanji; Geist / Geist Mono for reading and data.
6. **Performance.** One WebGL canvas, instancing for everything repeated, procedural textures only (no downloads), capped DPR, half-rate or paused when hidden, automatic quality drop on slow frames, reduced-motion renders a still frame.
