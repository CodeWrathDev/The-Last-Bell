# THE LAST BELL — build status

Engine: Phaser 3 + Howler + Vite (kept from the original project) with the existing software-raycaster third-person view.
Run: `npm install` then `npm run dev`. Tests: `npm run check`.

## Verified in this build (`npm run check`, Node only, no GPU)
- imports (52 files), 12 maps (reachability, spawns, doors both ways), original logic tests (10), 38 new logic tests.
- `tools/smoke-game.mjs`: plays the ENTIRE story (Ch1 to the final sequence) through the real GameScene code with a stubbed Phaser:
  night arrival, locked doors, every puzzle, monster spawn and 60 s of hunting, Ch4 evidence, hidden passage, reunion,
  companion following, service passage, journey, gate trigger, final cutscene start, save round-trip.
- `tools/smoke-ui.mjs`: all 8 cutscene scripts run to completion; UI objective/chapter cards/bubbles/settings.
- All 39 synthesised sounds generate finite, non-silent audio.

## NOT verified (no browser/GPU/network in the build sandbox)
- Nothing has been SEEN or HEARD. Layout, art, readability, sound quality, FPS on Iris Xe are untested.
- `@fontsource/noto-sans-myanmar` is added to package.json and imported in main.js but was not installed here.

## What exists
| Area | Status |
|---|---|
| Story | Prologue, Ch1-5, Final, bad ending, Game Over, closing text, title, credits. Chapter flow driven by ChapterState |
| Map | ONE connected school: courtyard/gate, hallway, 10A, 10B, library, office, toilets, stairs, first-floor corridor, storage, hidden old classroom, service passage back to the courtyard |
| Map states | Day / empty night / nightmare / companion / final (lighting + ambience; applied by chapter) |
| Puzzles | Keys, fuse + electrical panel, cabinet combination from a notice, office records, storage code, hidden passage; all solver-verified |
| Monster | Single creature; BLIND (v9): hunts by sound only; follows through doors by sound; cannot be fought; chalk-throw (G) to distract; crouch (C) |
| Companion | Follows, stops, freezes at loud sounds, Burmese speech bubbles with cooldown; never hints at the reveal |
| Audio logic | Channels, surface footsteps, spatial pan, cooldowns, 7-state adaptive music, optional microphone (local analysis only) |
| UI | Menu, Settings (5 volumes, sensitivity, subtitles, mic, quality, fullscreen), pause, inventory, chapter cards, content note |

## NOT done / limits (be honest)
1. **Still not true 3D.** Same pixel sprites in a software raycaster. No skeletal animation, LOD, occlusion culling or Three.js.
2. **Placeholder art.** The girl now has her own normal-schoolgirl sprite (npcs/girl.png, `tools/art/gen_human_girl.py`); she only turns into the ghost/crawler at the final twist. Bullies are tinted copies of the player sprite; no daytime students, no real day-school map (the prologue is a staged cutscene using recoloured title art).
3. **Placeholder audio.** All sound and music is generated in code. No recorded Burmese voice; the girl's voice is a synthesised tone.
4. **Burmese text** marked `(NEW)` in src/data/cutscenes.js and the chapter-2/3 notes in src/maps were written for this build and need native-speaker review.
5. Resolution option is not offered (the game scales to fit the window); graphics quality is auto/low/high.
6. Performance on the target laptop is unmeasured.
7. Map-state fog and "corridors that get longer" are only lighting/colour changes; no geometry morphing.


## Fixed in v4
- Freeze at "The Missing Girl": CutsceneScene.init() did not reset `done`, so any cutscene after the first one (prologue -> disappearance, and every later overlay) could never finish. Regression test added to tools/smoke-ui.mjs.

## Changed in v5 - new crawling creature
- New sprite sheet `sprites/ghosts/crawler.png` (128x104 frames, 24 rows): idle / crawl / chase x 8 view directions, black hair that sways in every frame, pale skin, red eyes, clawed hands. Drawn procedurally in `tools/art/gen_crawler.py` (a small posed 3D skeleton projected from 8 camera angles, so every direction matches); no reference image is copied.
- It is ~2x the player's height on average (about 1.7x in low side views, up to 2.7x when rearing toward the camera) and much wider. One knob: `CRAWLER.SCALE` in `src/config.js` (the sprite itself is also bigger than the old 56x32 one).
- `Ghost.js` picks the view from its travel direction relative to the camera yaw (`src/systems/CrawlerDir.js`, unit-tested in `tools/test-crawler-dir.mjs`), with hysteresis, and keeps the gait/hair frame when only the direction changes. No more mirror-flipping.
- Cutscenes use `crawler_*_r` / `crawler_*_l` (side views). Old names `crawler_idle|crawl|chase` still exist and point at the right-facing view.
- Not seen in a running browser (no GPU/network here): check scale, brightness and the hitbox in play. Collision body is unchanged (16x16), so it fits doorways exactly as before; it looks bigger than it collides.

## Changed in v6 - recorded monster sounds + noise-triggered chase
- 6 recorded sounds in `public/assets/audio/monster/` (mp3), registered in `FILES` in `src/systems/AudioSystem.js`:
  ghostly_grunts + growl_gulp (it is near, random 9-17 s), jaws_open (arrival / stops to listen), glass_knock (searching within 7 tiles),
  roar_long (it SEES you, once per chase; faded out when it loses you), roar_eye (it HEARS a noise and charges; repeats every ~8-12 s while chasing; on catch).
- `MonsterBrain.hear()` now sends it straight into CHASE toward the noise (not "investigate"). Noise during a chase refreshes the target; it does not give up until it reaches the spot. Quiet (crouch/hide) = it loses you. New events: `rush`; `spot` fires once per chase, also when a noise-charge turns into eye contact.
- Not heard in a browser here: check mix levels in play.

## Changed in v9 - BLIND monster + new scary design
**Behaviour (`src/systems/MonsterBrain.js`, rewritten, 4 states: patrol / chase / listen / return_to_patrol)**
- It is blind: no sight, no line of sight, flashlight does not matter. Hiding no longer needs to beat a search; silence is the defence.
- Crawling around (patrol) -> hears a noise -> CHASE toward where the noise came from. Noise keeps coming -> keeps chasing the newest noise.
- Noise stops -> after `SOUND_MEMORY` (0.7 s, a bit longer than one walking step gap) it STOPS dead (state `listen`, frozen `LISTEN_TIME` = 2.6 s), then crawls back to patrol. It never remembers where you are.
- It can still bump into you (touch = caught), but not if you are hidden.
- Its ears are better than yours: `HEARING` = 1.3x sound radius. Chase speed 112 (was 105), patrol 42. All knobs are exported constants at the top of the file.
- Events: `hear`, `rush` (roar + camera punch + one-time hint toast), `lost` (toast "It can no longer hear you"), `listen`, `catch`. Removed: `spot`, `found`, search/investigate/lose_target.
**Look (`tools/art/gen_crawler.py`, regenerate with `python3 tools/art/gen_ghosts.py`-style pack as in gen_all)**
- Frame 208x160 (was 128x104). Huge head (HS = 1.2), wide jaw with long fangs, clouded white blind eyes in black sockets, angry brows, big red-lined ears, spine spikes, ribs, spiked tail, thick limbs, long claws, blood on chin/chest. Idle = rears up and listens, chase = jaw gaping and snapping.
- Dread aura: wide pulsing blood-red light around it (`Ghost.aura`, drawn in `View3D.js`), stronger while hunting.
- `CRAWLER` in `src/config.js`: SCALE 1.25, ORIGIN_Y 110/160, SHADOW 1.5. Cutscene scales lowered to 1.6 / 1.8 for the bigger sheet.
- Tests rewritten for the blind rules (`tools/test-last-bell.mjs`); `npm run check` chain passes (all steps run in Node, nothing was seen or heard in a browser).

## Changed in v10 - the monster is now the GHOST GIRL
- New art (`tools/art/gen_crawler.py`; the previous spiky-beast version is kept as `gen_crawler_v9_beast.py`): long messy black hair hiding most of the face (a gap is left in the middle so the huge mouth shows), enormous dislocated jaw with sharp teeth, pale grey skin, big hunched body under a torn dirty white-grey dress (jagged cloth panels, trailing rags), four long spidery limbs with long fingers and claws.
- Frame 220x150, ground row 92, PPU 50. `CRAWLER` in `src/config.js`: ORIGIN_Y 92/150, SCALE 1.2. Sprite sheet + `animData.js` regenerated. Behaviour (blind, sound-only) and the red dread aura are unchanged.
- Standalone sheets for other engines/tools: `ghost_girl_crawl_8dir_6frames.png` (128x128 cells) and `..._hires.png` (220x150 cells); rows = Down, Up, Left, Right, Down-Left, Down-Right, Up-Left, Up-Right; columns = 6 crawl frames.

## Changed in v11 - legless, toothless
- The ghost girl has NO legs and NO teeth: only two long arms drag her body along the floor; the dress tapers into a trailing tail. Previous four-limbed version kept as `tools/art/gen_crawler_v10_fourlimbs.py`.
- Frame is now 236x148 (ground row 84); `CRAWLER` in `src/config.js` updated; sheet + animData regenerated.

## Changed in v12 - human face
- No big mouth. The face is now a pale, dead HUMAN face: sunken sockets, clouded white eyes, heavy brow, nose, small slack mouth, blood tears down the cheeks, blood dripping from the mouth and chin, blood soaked down the front of the dress. Hair only touches the temples so the face stays visible. Previous version kept as `tools/art/gen_crawler_v11_bigmouth.py`. Frame size unchanged (236x148).

## Changed in v13 - more pixels, 3D "advanced" shading
- `tools/art/gen_crawler.py` now paints a depth buffer next to the colour buffer: 8-tone smooth shading ramps, ambient occlusion (contact shadows in every fold and under the hair), a cool blue back rim light and hair sheen, then hard pixels snapped to a ~360 colour palette. `configure(k)` scales the whole sprite. Previous flat version: `gen_crawler_v12_flat.py`.
- Game sheet is now 354x222 frames (k = 1.5; sheet 2124x5328 px, 3.4 MB). `CRAWLER` in `src/config.js`: ORIGIN_Y 126/222, SCALE 0.8 (same on-screen size as before, 1.5x the pixels). Cutscene scales 1.07 / 1.2.
- WebGL note: the sheet is 5328 px tall. Fine on desktop (16384) and modern phones (8192+); a very old 4096-limit GPU would need the sheet split.
- Blood toned down to a dark wet red, skin and limbs less glossy.
- Rebuild: `cd game && python3 -c "import tools.art.gen_crawler"` is not enough; run the pack code used in `/tools/art/gen_ghosts.py` (build_crawler + pack) after calling `gen_crawler.configure(1.5)`, then update `src/assets/animData.js` (frameWidth/frameHeight).

## Changed in v14 - player-sized monster, hidden face, ONE heart, real-gameplay finale
- **Monster size**: sheet regenerated at `configure(0.34)` -> 80x50 frames (was 354x222). It is now about player-sized (player ~19x38 px; creature ~35x25 px head-on, ~60 px long from the side). `CRAWLER.SCALE` 0.85, shadow 0.5. Collision body is 12x12 (was 16x16), catch radius 14/17 px. Cutscene actors use `4 * CRAWLER.SCALE` so it matches the boy there too. Sheet is 480x1200 (was 3.4 MB, 5328 px tall).
- **Face hidden**: `tools/art/gen_crawler.py` no longer draws eyes, mouth, nose or blood tears. A solid veil of black hair covers face, jaw and chin, plus a dense curtain of front strands. Previous version kept as `tools/art/gen_crawler_v13_face.py`. Rebuild: `gen_crawler.configure(0.34)`, then `gen_ghosts.pack(*gen_crawler.build_crawler(), 6)`, then set frameWidth/Height in `src/assets/animData.js`.
- **One heart**: `Player.hearts = 1`, no regeneration, HUD shows a single (beating) heart, old saves are clamped to 1, Try Again restarts with 1.
- **Final chapter is gameplay, not a cutscene** (`GameScene.startFinal / runFinal / finalTransform / finalDeath`): at the gate the bell rings, she asks "Do you still remember me?", the lights stutter out, and when they return she is already the creature. It is NOT blind any more (`MonsterBrain.startHunt`, speed 128: faster than walking 95, slower than sprinting 165, but stamina runs out). One touch kills you and the game goes straight to the `final_end` cutscene (GAME OVER text, credits). The chase is never saved; continuing from a final-chapter save restarts the sequence at the gate. The old transformation cutscene was removed (`final` -> `final_end`, aftermath only).
- Tests updated: ONE heart, no cutscene for the twist, girl -> creature in-game, it closes in on a silent player, one catch -> `final_end`. `npm run check` passes (Node only; nothing was seen or heard in a browser).
- Not verified: how the chase FEELS (128 vs 95/165 and the 6.8 s intro beat are guesses), on-screen readability of the small sprite, and that the flicker beat looks right in the 3D view. Tune `SPEED.hunt` in `src/systems/MonsterBrain.js`.

## v14b - monster is now TWICE the player's size
Sheet regenerated at `configure(0.68)` (160x100 frames); `CRAWLER.SHADOW` 1.0; collision body 18x18, catch radius 20/24 px. Face stays hidden under hair.

## v15 - Myanmar school look, bigger world, readable text
- Art: `python3 tools/art/gen_v15.py` (tiles, objects atlas, player sheet only; crawler/ghosts untouched). Cream/green Myanmar school facade, carved fascia, lit-window figure, eyes in broken window, stupa, nat spirit house, lanterns, blood moon sky, thanaka player.
- Signs: English signboards painted in 3D (`signPix` in DomAssets, `sign` objects in campus.js). The Burmese lines (`my:`) are NEW and need native review: အခြေခံပညာ အထက်တန်းကျောင်း, ကျောင်းသားအဆောင်, အားကစားကွင်း.
- Text: `src/ui/textStyle.js` (2x resolution, outline, padding, Burmese min size 17). NOT run in a real browser (Phaser not installed in the build sandbox).
- Map: HUD minimap ~3.5x bigger, full-screen map on N / Map button / click minimap (Esc closes).
- World: campus 40x28 -> 64x28. New east grounds via a gap at x=39: sports field, hostel block, canteen, 2nd pagoda and spirit house, floodlights, 2 notes.
- Banyan moved to the west courtyard so the school is visible from the gate (tests updated).
- `npm run check` passes (Node only). Visual checks: tools/view3d/shots_v15.py.

## v15b - interiors, monastery
- Interior walls: cream-green plaster + green dado (hall, classrooms, library...), occasional dark handprints; green door frames; chalkboard text larger/outlined.
- Campus is now 88x28: new monastery compound (x64-86) with the old temple bell, 3 pagodas, zayat hall, spirit house, 2 notes. Patrol test time limit raised (map is bigger).
