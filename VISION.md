# Mihari 見張り — design vision (v16: "Into the Eye")

## One sentence
The page is one flight down a flooded neon canyon toward a colossal eye hanging in storm cloud at its end. The site opens on that eye in close-up, waking; the camera pulls back to show the city it watches; scrolling travels back toward it; the finale ends at its pupil.

## The eye (apps/web/src/landing/watcher.js)
Built like a real eye so it holds up from a hundred metres and in close-up:
- **Ball**: sclera with fibre-optic veins, an iris *disc* set inside the ball (true parallax), a clear cornea that only carries reflections (a window catchlight with mullions, the city's neon horizon), a retina lining the inside, seen through the pupil, which is a real hole.
- **Iris**: layered radial fibres, collarette, crypts, contraction furrows, a dark limbal ring; a faint implant layer (segmented ring, tick scale, data-glyph band, scan sweep). Pupil breathes, narrows on verdicts, becomes a cursor-like slit on lockdown.
- **Lids**: two hemispherical shells rotating about the eye's horizontal axis, so the opening is a true almond; lashes ride them. Lids and a backdrop share one planar storm-cloud shader, so no eyeball silhouette shows: only the opening, the wet margin and the lashes.
- **Behaviour**: saccades (snaps, not pans), blinks (sometimes double), looks at your cursor, reads the agent pass and the scan ring, turns red on revocation. Its reflection sits in the flood.

## The story as space
| Scroll | Where you are | What it means |
|---|---|---|
| Opening | Close on the eye, shut. It opens, looks left, right, at you; the camera pulls back down the canyon. Once per session; click, key or wheel hurries it. | You are seen. |
| Hero | Street level, the eye over the end of the canyon. "EVERY AGENT. EVERY ACTION. WATCHED." | Nothing gets through unseen. |
| 01 Identify | The eye's beam reads the agent's pass. | Identity first. |
| 02 Decide | Calls stream through the eye's scan ring and get verdicts. MAGI vote panel. | One verdict per call. |
| 03 Prove | The ledger runs toward the eye; its reflection in the flood. | Every verdict is a block. |
| 04 Contain | The city goes red; the eye narrows; the ring's aperture closes. | Revoke once, closed everywhere. |
| Lower sections | The approach: the eye grows behind every chapter. | The product, in detail. |
| Finale | At the pupil: the iris rings the screen, "KNOW YOUR AGENT." sits in the dark of the pupil. | Inside the watch. |

## The mark
An eye cut from the interface's own chamfered shape: heavy upper lid, detached lower lid, a hexagonal iris, and a pupil that is a terminal cursor (it blinks). The eye watches machines.

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
