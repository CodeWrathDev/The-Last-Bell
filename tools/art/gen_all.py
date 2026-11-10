"""Regenerates every pixel-art asset. Usage:  python3 tools/art/gen_all.py   (needs Pillow)"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from pixel import Px
import gen_tiles, gen_player, gen_ghosts, gen_human_girl, gen_objects, gen_ui

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'assets')
SRC = os.path.join(ROOT, 'src', 'assets')

DIRS = ['sprites/player', 'sprites/ghosts', 'sprites/npcs', 'sprites/objects', 'sprites/furniture',
        'tilesets', 'tilesets/outdoor', 'tilesets/classroom', 'tilesets/hallway', 'tilesets/library',
        'effects/rain', 'effects/fog', 'effects/lighting', 'effects/particles', 'ui', 'audio', 'maps']

def pack_atlas(sprites, name, path, max_w=1024, pad=2):
    items = sorted(sprites.items(), key=lambda kv: (-kv[1].h, kv[0]))
    x = y = pad; row_h = 0; place = {}
    for k, s in items:
        if x + s.w + pad > max_w: x = pad; y += row_h + pad; row_h = 0
        place[k] = (x, y); x += s.w + pad; row_h = max(row_h, s.h)
    H = y + row_h + pad; W = max_w if y > pad else x
    W = 1 << (W - 1).bit_length(); H = 1 << (H - 1).bit_length()
    img = Px(W, H); frames = {}
    for k, (px, py) in place.items():
        s = sprites[k]; img.im.alpha_composite(s.im, (px, py))
        frames[k] = {'frame': {'x': px, 'y': py, 'w': s.w, 'h': s.h}, 'rotated': False, 'trimmed': False,
                     'spriteSourceSize': {'x': 0, 'y': 0, 'w': s.w, 'h': s.h}, 'sourceSize': {'w': s.w, 'h': s.h}}
    img.im.save(path + '.png')
    json.dump({'frames': frames, 'meta': {'image': os.path.basename(path) + '.png', 'size': {'w': W, 'h': H}, 'scale': '1'}}, open(path + '.json', 'w'))
    print(f'  atlas {name}: {len(sprites)} sprites -> {W}x{H}')

def main():
    for d in DIRS: os.makedirs(os.path.join(OUT, d), exist_ok=True)
    os.makedirs(SRC, exist_ok=True)

    # tileset (+ generated T enum so JS and PNG can never disagree)
    sheet, cols = gen_tiles.build(); sheet.save(os.path.join(OUT, 'tilesets', 'tiles.png'))
    gen_tiles.write_ids_js(os.path.join(SRC, 'tiles.js'), cols)
    print(f'  tileset: {len(gen_tiles.NAMES)} tiles')

    themes = {
        'outdoor': ['GRASS','GRASS2','PATH','PATHWET','COURT','COURTH','COURTV','PUDDLE','PATHCRACK','PATHLEAF','PATHMOSS','DRAIN','FENCE','GATE','BED','TRUNK','BUSH','CANOPY','ROOF','ROOFEDGE','ROOFTIN','ROOFTINEDGE','WALL','WALLSTAIN','WALLPEEL','WALLBASE','WINDOW','WINDOWLIT','WINDOWBROKEN','DOOR','DOORLOCK','STAIRS','PILLAR'],
        'classroom': ['FLOOR','FLOORDARK','FLOORCRACK','FLOORSTAIN','WALLINT','WALLINTBASE','WINDOWRAIN','BOARD','DESK','DESK2','DESK3','RUG','DOOR'],
        'hallway': ['FLOORTILE','FLOORDARK','FLOOR','FLOORCRACK','FLOORSTAIN','WALLINT','WALLINTBASE','WINDOWRAIN','DOOR','DOORLOCK','SHELF','RUG'],
        'library': ['LIBFLOOR','LIBSHELF','READTABLE','WALLINT','WALLINTBASE','WINDOWRAIN','RUG','DOOR'],
    }
    for th, names in themes.items():
        strip = Px(len(names) * 32, 32)
        for i, n in enumerate(names):
            idx = gen_tiles.ID[n]; strip.im.alpha_composite(sheet.im.crop(((idx % cols) * 32, (idx // cols) * 32, (idx % cols) * 32 + 32, (idx // cols) * 32 + 32)), (i * 32, 0))
        strip.save(os.path.join(OUT, 'tilesets', th, th + '.png'))
        open(os.path.join(OUT, 'tilesets', th, th + '.txt'), 'w').write('\n'.join(f'{i}: {n} (master tile id {gen_tiles.ID[n]})' for i, n in enumerate(names)))
    anim = {}
    rows = gen_player.build(); ps, meta, pcols = gen_player.pack(rows)
    ps.save(os.path.join(OUT, 'sprites/player/player.png'))
    anim['player'] = {'frameWidth': gen_player.FW, 'frameHeight': gen_player.FH, 'cols': pcols, 'anims': meta}
    print(f'  player: {len(meta)} animation rows')

    anim['ghosts'] = {}
    for key, build in (('girl', gen_ghosts.build_girl), ('teacher', gen_ghosts.build_teacher), ('crawler', gen_ghosts.build_crawler)):
        rws, fw, fh = build(); s, m = gen_ghosts.pack(rws, fw, fh, 6)
        s.save(os.path.join(OUT, f'sprites/ghosts/{key}.png'))
        anim['ghosts'][key] = {'frameWidth': fw, 'frameHeight': fh, 'cols': 6, 'anims': m}
    print('  ghosts: girl, teacher, crawler')
    rws, fw, fh = gen_human_girl.build_human_girl(); s, m = gen_ghosts.pack(rws, fw, fh, 6)
    s.save(os.path.join(OUT, 'sprites/npcs/girl.png'))
    anim['npcs'] = {'girl': {'frameWidth': fw, 'frameHeight': fh, 'cols': 6, 'anims': m}}
    print('  npcs: human girl')

    objs = gen_objects.build_all()
    big = {k: objs.pop(k) for k in ('banyan_back', 'banyan_front', 'banyan_roots')}
    for k, s in big.items(): s.save(os.path.join(OUT, f'sprites/objects/{k}.png'))
    furniture_names = [k for k in objs if k.startswith(('fan_', 'curtain_')) or k in ('clock', 'calendar', 'poster', 'timetable', 'mirror', 'bag', 'books', 'papers', 'chalk', 'bench', 'pot_flower', 'pot_fern', 'bin', 'tube_on', 'tube_dim', 'exit_sign', 'emergency_light')]
    fx_rain = [k for k in objs if k.startswith(('rain_', 'splash_', 'ripple_', 'drip_'))]
    fx_part = [k for k in objs if k.startswith(('dust_', 'leaf_', 'sparkle_', 'tuft_'))]
    pack_atlas({k: objs[k] for k in furniture_names}, 'furniture', os.path.join(OUT, 'sprites/furniture/furniture'))
    pack_atlas({k: objs[k] for k in fx_rain}, 'rain', os.path.join(OUT, 'effects/rain/rain'))
    pack_atlas({k: objs[k] for k in fx_part}, 'particles', os.path.join(OUT, 'effects/particles/particles'))
    used = set(furniture_names + fx_rain + fx_part + ['fog'])
    pack_atlas({k: v for k, v in objs.items() if k not in used}, 'objects', os.path.join(OUT, 'sprites/objects/objects'))
    objs['fog'].save(os.path.join(OUT, 'effects/fog/fog.png'))
    for k, s in gen_objects.light_masks().items(): s.save(os.path.join(OUT, f'effects/lighting/{k}.png'))

    ui, menu = gen_ui.build()
    pack_atlas(ui, 'ui', os.path.join(OUT, 'ui/ui'))
    for k, s in menu.items(): s.save(os.path.join(OUT, f'ui/{k}.png'))

    open(os.path.join(SRC, 'animData.js'), 'w').write('// AUTO-GENERATED by tools/art/gen_all.py - sprite-sheet layout + animation table.\nexport const ANIM_DATA = ' + json.dumps(anim, indent=1) + ';\n')
    open(os.path.join(OUT, 'README.md'), 'w').write('# assets\n\nEvery PNG here is produced by `python3 tools/art/gen_all.py` (Pillow). Edit the generators, re-run, commit the output.\n\n```\nsprites/player      player.png      32x40 frames, one row per animation+direction (see src/assets/animData.js)\nsprites/ghosts      girl / teacher / crawler sheets\nsprites/objects     banyan layers, lamp, hoop, flagpole, flag frames, items\nsprites/furniture   fans, curtains, clocks, posters, bags, books, light fixtures\ntilesets            tiles.png (32x32, ids in src/assets/tiles.js); outdoor/classroom/hallway/library = notes per theme\neffects/rain        rain streaks, splashes, ripples, drips (atlas)\neffects/fog         tileable dithered fog\neffects/lighting    dithered light masks (radial + flashlight cone)\neffects/particles   dust, leaves, sparkles (atlas)\nui                  HUD atlas, portraits, title-screen layers\naudio               (sound is synthesised at runtime by src/systems/AudioSystem.js)\nmaps                Tiled JSON exported with `npm run export:maps`\n```\n')
    print('done ->', OUT)

if __name__ == '__main__':
    main()
