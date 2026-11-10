# ကျောင်းည — THE HAUNTED SCHOOL

A 2D pixel-art horror adventure set in a Myanmar high school at night. You are a student who comes back at 9 PM for a forgotten notebook. The gate locks behind you.

Built with **Phaser 3**, **Vite**, **Howler.js** and plain ES modules. All art and sound is generated at runtime, so there are no asset files to download.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (also reachable on your LAN, so you can test on a phone)
npm run build      # production build into dist/
npm run preview    # serve the production build
```

Checks that need no browser:

```bash
npm run check      # map verifier + ghost AI / collision tests
```

### Deploy to Vercel
Import the repo in Vercel. It detects Vite automatically (build `npm run build`, output `dist`). `base: './'` is already set in `vite.config.js`.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Walk forward / back | W / S (or Up / Down) | left-side stick up / down |
| Strafe left / right | A / D | left-side stick left / right |
| Look around (first person) | Mouse (click the game once to capture it, Esc to release), or Left / Right arrows | drag on the right half of the screen |
| Run (uses stamina) | Shift | Run button |
| Interact / read / pick up | E | E button |
| Flashlight | F | Light button |
| Hide under desks, come out | Space | Hide button |
| Inventory / use battery | I / Q | Bag button |
| Pause | Esc or P | II button |
| Mute | M | pause menu |

Touch controls appear automatically on touch devices (add `?touch=1` to the URL to force them).

## First-person view (v43)
The game is now **first person**: the camera sits at your eyes, you see your hand and flashlight, the beam starts at your head, you can look up and down, the view bobs with your steps, sinks when you sneak, shows the desk underside while you hide, and falls toward the creature when it catches you.
Switch it off with `RIG.FIRST_PERSON = false` in `src/render3d/Rig3D.js` (the old third-person follow camera is still there). Hand/flashlight drawing lives in `src/render3d/FpOverlay.js`.

## What is playable now

* **Courtyard** — rainy campus with the main building, banyan tree, flagpole, basketball court, guard house, locked gate, lamp posts, puddles, fog, thunder.
* **Main building hallway** — flickering fluorescent lights, six doors plus a powered side entrance into the assembly wing. Classroom A opens; the Library opens with a key; the rest are locked and hint at later chapters.
* **Classroom A** — desks (hiding places), chalkboard, your notebook, the teacher's desk with the library key. The hidden route now branches into an assembly hall, underground maintenance level and rain-slick rooftop.
* **Monster (v9)** — a blind crawler. It cannot see you or your flashlight; it only chases while it hears you (walking, running, doors, thrown chalk) and stops as soon as the sound stops. Stay still, crouch or hide to make it lose you. It can still bump into you.
* HUD with your ONE heart, battery, stamina, clock, minimap, objective tracker; dialogue; inventory with notes; pause; game over; autosave plus manual save (Continue on the main menu).
* Story chapters 1–3 start; the powered assembly door unlocks a longer optional story wing with two animated story sequences, then maintenance stairs and a rooftop bell route open as the evidence accumulates.
* The 06:00 dawn deadline is implemented but switched off (`DAWN_ENFORCED` in `src/data/story.js`) until the Escape chapter exists.

## Project layout

```
src/
  main.js, config.js
  assets/      TextureFactory.js (tiles, player, ghost, items), ExtraTextures.js (banyan, props, HUD)
  maps/        MapBuilder.js (layered grid -> Tiled JSON), campus.js, hall.js, classroom.js, library.js, rooms.js, extension.js, index.js
  scenes/      BootScene, MenuScene, GameScene (world), UIScene (lighting, rain, HUD, menus)
  entities/    Player.js, Ghost.js (sprite wrapper)
  systems/     Collision.js, GhostBrain.js (pure AI), Lighting.js, Weather.js, AudioSystem.js, Controls.js, SaveSystem.js
  data/        items.js, story.js
  ui/          widgets.js
tools/         verify-maps.mjs, test-logic.mjs
```

## Adding a new area (the library, lab, …)

1. Copy `src/maps/classroom.js` to a new file and export `buildLibrary()`. Lay out `ground`, `deco` and `above` with `MapBuilder`.
2. Add objects: `door` (with `target` and `spawn`), `lockeddoor` (`needs`), `pickup`, `container`, `note`, `prop`, `lamp`, `light`, `sign`.
3. Give it `spawns` (`start` plus one per door that leads in) and `meta` (`ambient`, `zoom`, optional `ghostPatrol`, `ghostDelay`).
4. Register it in `src/maps/index.js`.
5. Run `npm run verify:maps`. It checks spawns, door targets, reachability of every object and ghost patrol points.

`MapBuilder.toTiled()` exports any map as Tiled-compatible JSON, so a map can later be authored in the Tiled editor and loaded instead.

## Notes on how it works

* Collision is a tile grid (`SOLID` tiles plus objects marked `blocks`) with axis-separated box movement, so you slide along walls.
* The darkness is a half-resolution canvas in `UIScene`; each lamp, the ghost glow, the player halo and the flashlight cone punch soft holes in it.
* Save data (map, position, inventory, picked-up items, unlocked doors, notes, objective, clock) lives in `localStorage`.

## Pixel-art pipeline (visual overhaul)

All art is real PNG, generated by Pillow scripts in `tools/art/` and committed to `public/assets/`:

```
npm run art           # regenerate every sprite sheet, atlas and tileset (needs: pip install pillow)
npm run export:maps   # export the code-built maps as Tiled JSON into public/assets/maps
```

- `src/assets/tiles.js` (tile ids) and `src/assets/animData.js` (sprite-sheet layout + animation table) are generated: do not edit by hand.
- `src/assets/Loader.js` loads everything and builds the animations; `tex('name')` resolves a sprite name to `[atlas, frame]`.
- Player: 32x40 frames, 26 animation rows (idle/walk/run/flashlight x 4 directions, hide, search, open door, pick up, fear, death).
- Ghosts: Classroom Girl (chases), Crawling Student (fast; Classroom A), Shadow Teacher (hallway apparition, harmless but unsettling).
- Lighting uses dithered light masks rendered at half resolution with nearest filtering; fog, dust, leaves, roof drips, puddle ripples and grass sway live in `src/systems/Environment.js` (pooled).
- Maps: campus, hallway, Classroom A and the Library (unlock with the brass key from the teacher's desk). Set `OUTDOOR_ZOOM = 2` in `src/config.js` for the same pixel size outdoors as indoors (tighter view; ghosts can then see you from off-screen).
- A frame-rate watchdog lowers rain/fog/leaf/dust extras automatically when FPS stays under 48 (phones start one level lower). Gameplay is never affected.
- Debug/screenshot helper: `python3 tools/shot.py name` with `npm run dev` running (needs playwright + chromium).

## Third-person camera (Phase 1)

The game now renders from behind the player. `src/render3d/` is a self-contained perspective layer; the 2D map, collision, ghost AI, inventory and UI are unchanged and keep running underneath.

- `Renderer3D.js` floor/ceiling casting from the real tile art, a column raycaster for walls and low furniture (desk tops are visible from above), depth-tested billboards, a lightmap built from the game's lamps and a flashlight cone. Internal 480x270, drawn 2x nearest-neighbour.
- `Rig3D.js` follow camera: position/heading lag, boom pulled in by walls (pure logic, unit-testable).
- `View3D.js` Phaser adapter (canvas texture at depth 1000, feeds player/ghost/pickups/lamps). `mapView.js` has the spawn headings.
- Test without Phaser: `npm run test:view3d` (needs Python + Playwright) renders every map and walks the rig on the real hall map.
# The-Last-Bell
