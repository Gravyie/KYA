# Mihari 見張り — design vision (v18: "Text-vision lens")

## One sentence
A detailed neon canyon with one vast eye filling the sky above its far end; point anywhere and you see it as the watcher does, in text. The site boots like a terminal, the city decodes out of noise, the eye opens and finds you; scrolling travels toward it, and the finale ends at its pupil.

## Text-vision (apps/web/src/landing/ascii.js)
The city renders in full detail. Wherever you point, a lens (a thin HUD ring with a tick scale and a sweep) shows it as the watcher sees it: every character cell becomes one glyph tinted with the cell's colour, chosen from two density ramps measured off the real font (ASCII mixed with half-width katakana, alternated per cell), or a stroke (| - / \) where the image has an edge. The lens edge dissolves cell by cell; outside it only a whisper of glyph texture remains. On touch the lens follows the finger and fades after. The opening is all text: the frame decodes out of scrambled glyphs, the eye opens in glyphs, then the text dissolves cell by cell into the picture. The agent's pass is drawn crisp over everything.

## The eye (apps/web/src/landing/skyeye.js)
Not an eyeball: one plane far beyond the canyon, drawn like a manga panel, but in light rather than ink (black lines vanish in text-vision): a heavy glowing liner ending in a wing, fanned lashes longer at the outer corner, a crease, a big iris with fibres, collarette, crypts, a dark limbal ring and an implant layer (segmented ring, tick scale, data-glyph band), a window catchlight. All linework is drawn at the scale of a character cell. It blinks (sometimes twice), snaps its gaze, reads the pass and the scan ring, narrows to a slit and goes red on revocation; its reflection lies in the flood.

## The story as space
| Scroll | Where you are | What it means |
|---|---|---|
| Opening | A terminal boots ("[ ok ] audit chain verified … opening the eye"); the city decodes out of scrambled glyphs; the eye opens, blinks, looks left, right, at you. Once per session; input hurries it. | You are seen. |
| Hero | Street level, the eye filling the sky over the canyon. "EVERY AGENT. EVERY ACTION. WATCHED." | Nothing gets through unseen. |
| 01 Identify | The eye reads the agent's pass, which hangs crisp in the glyph city. | Identity first. |
| 02 Decide | Calls stream through the scan ring and get verdicts. MAGI vote panel. | One verdict per call. |
| 03 Prove | The ledger runs toward the eye. | Every verdict is a block. |
| 04 Contain | The city goes red; the eye narrows; the ring's aperture closes. | Revoke once, closed everywhere. |
| Lower sections | The approach, the eye looming over every chapter. | The product, in detail. |
| Finale | Risen to the eye: the iris rings the screen, "KNOW YOUR AGENT." sits in the dark of the pupil. | Inside the watch. |

## Motion
The cursor turns the head a touch (under a degree); it never swings the camera around the subject. Scroll velocity is eased. Phones get a wider lens rather than a camera pushed behind the city.

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
