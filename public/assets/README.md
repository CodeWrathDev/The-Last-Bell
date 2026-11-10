# assets

Every PNG here is produced by `python3 tools/art/gen_all.py` (Pillow). Edit the generators, re-run, commit the output.

```
sprites/player      player.png      32x40 frames, one row per animation+direction (see src/assets/animData.js)
sprites/ghosts      girl / teacher / crawler sheets
sprites/objects     banyan layers, lamp, hoop, flagpole, flag frames, items
sprites/furniture   fans, curtains, clocks, posters, bags, books, light fixtures
tilesets            tiles.png (32x32, ids in src/assets/tiles.js); outdoor/classroom/hallway/library = notes per theme
effects/rain        rain streaks, splashes, ripples, drips (atlas)
effects/fog         tileable dithered fog
effects/lighting    dithered light masks (radial + flashlight cone)
effects/particles   dust, leaves, sparkles (atlas)
ui                  HUD atlas, portraits, title-screen layers
audio               (sound is synthesised at runtime by src/systems/AudioSystem.js)
maps                Tiled JSON exported with `npm run export:maps`
```
