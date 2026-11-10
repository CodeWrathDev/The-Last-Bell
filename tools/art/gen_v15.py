"""v15 art pass: Myanmar basic-education-school facade (cream walls, green dado + shutters, carved green/white fascia,
red tin roof), scarier window details, and new courtyard landmarks (stupa, nat spirit house).
Run:  python3 tools/art/gen_v15.py      (needs Pillow)
Only tiles + the `objects` atlas are rebuilt. The player / ghost / crawler sheets and src/assets/animData.js are NOT touched,
so the v14 crawler stays exactly as it is."""
import json, math, os, random, sys
sys.path.insert(0, os.path.dirname(__file__))
from pixel import Px, H, mix
import palette as PAL
from palette import *
import gen_tiles as GT
import gen_objects as GO
from gen_tiles import R, crack, tuft, TILE

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ASSET_DIR = os.path.join(ROOT, 'public', 'assets'); SRC = os.path.join(ROOT, 'src', 'assets')

# ---------------------------------------------------------------- palettes (lighter than v14 so the facade reads at night)
CREAM = ['#3d3a28', '#5a5539', '#7a7352', '#9a9168', '#b9ae80', '#d4c9a0']
GREEN = ['#0b2117', '#133524', '#1c4a33', '#276344', '#368059', '#4d9d72']
WHITE = ['#6c7466', '#8c9484', '#aab2a0', '#c8d0be', '#e4eada']
TILER = ['#3a1417', '#561f20', '#762f2b', '#964539', '#b45f4a']
TING  = ['#0e2924', '#164039', '#225a50', '#32786a', '#4b988a']
BLOOD = ['#2a0508', '#4a0a10', '#6e1018']
MOSS  = ['#0a1a12', '#12301e', '#1d4a2c']

def streaks(t, rng, n, x0=0, x1=32, y0=3, col=None, rust=False):
    for _ in range(n):
        x = x0 + int(rng.random() * (x1 - x0 - 1)); L = 8 + int(rng.random() * 20); w = 1 + int(rng.random() * 2)
        for y in range(y0, min(31, y0 + L)):
            for dx in range(w):
                if rng.random() < .85:
                    c = (BLOOD[1] if rust and y % 2 else BLOOD[0]) if rust else (col or '#1b2a20')
                    t.set(x + dx, y, c)

_wall_plaster_orig = GT.wall_plaster
INT = ['#2c3328', '#404a3a', '#586654', '#718170', '#8c9c88']
def interior_wall(name):
    rng = R(name); t = Px(32, 32); P = INT
    t.rect(0, 0, 32, 32, P[2])
    for _ in range(150): t.rect(int(rng.random() * 32), int(rng.random() * 32), 1 + int(rng.random() * 3), 1, rng.choice([P[1], P[3], P[2], P[2]]))
    t.rect(0, 0, 32, 2, P[0]); t.dither(0, 2, 32, 3, P[0], .5)
    t.hline(0, 31, 32, P[1])
    streaks(t, rng, 4, y0=3, col='#1f261e')
    if rng.random() < .45:                                   # a small dark handprint, low on the wall
        hx, hy = 6 + int(rng.random() * 18), 14 + int(rng.random() * 8)
        t.rect(hx, hy + 3, 5, 5, BLOOD[1]); t.rect(hx, hy, 1, 4, BLOOD[1]); t.rect(hx + 2, hy - 1, 1, 4, BLOOD[1]); t.rect(hx + 4, hy, 1, 4, BLOOD[1]); t.set(hx + 2, hy + 8, BLOOD[0]); t.set(hx + 2, hy + 9, BLOOD[0])
    crack(t, rng, 4 + int(rng.random() * 24), 3, 10, P[0])
    return t
def wall_plaster(name, interior=False, stain=False, peel=False):
    if interior: return interior_wall(name)
    rng = R(name); t = Px(32, 32); P = CREAM
    t.rect(0, 0, 32, 32, P[2])
    for _ in range(170): t.rect(int(rng.random() * 32), int(rng.random() * 32), 1 + int(rng.random() * 3), 1, rng.choice([P[1], P[3], P[2], P[2], P[4]]))
    t.rect(0, 0, 32, 2, P[0]); t.dither(0, 2, 32, 4, P[0], .6); t.dither(0, 6, 32, 3, P[1], .35)      # eave shadow
    # string course: pale line + green band along the bottom edge (matches the dado below)
    t.hline(0, 27, 32, WHITE[3]); t.hline(0, 28, 32, WHITE[2]); t.rect(0, 29, 32, 3, GREEN[2]); t.hline(0, 29, 32, GREEN[4]); t.hline(0, 31, 32, GREEN[0])
    streaks(t, rng, 4 + (4 if stain else 0), y0=4, col='#2a3326')
    if stain or name == 'WALLSTAIN':
        for _ in range(60): t.set(int(rng.random() * 32), 8 + int(rng.random() * 18), MOSS[1])
        # one dark-red drip that does not look like rust: something leaked down this wall
        x = 8 + int(rng.random() * 16)
        for y in range(5, 26): t.set(x, y, BLOOD[1] if y % 4 else BLOOD[2])
        t.set(x, 26, BLOOD[0]); t.set(x - 1, 25, BLOOD[0]); t.set(x + 1, 24, BLOOD[0])
    if peel or name == 'WALLPEEL':
        for _ in range(2):
            cx, cy = 6 + int(rng.random() * 20), 6 + int(rng.random() * 14)
            for y in range(-5, 6):
                for x in range(-6, 7):
                    d = (x / 6) ** 2 + (y / 5) ** 2 + (rng.random() - .5) * .35
                    if d < 1: t.set(cx + x, cy + y, CONC[3] if d > .55 else BRICK[2] if (x + y) % 5 else BRICK[1])
                    elif d < 1.25: t.set(cx + x, cy + y, P[5])
    # hairline cracks
    for _ in range(1 + int(rng.random() * 2)): crack(t, rng, 3 + int(rng.random() * 26), 2 + int(rng.random() * 6), 10 + int(rng.random() * 12), P[0])
    return t
GT.wall_plaster = wall_plaster

def wallbase(interior=False):
    if interior:
        rng = R('WALLINTBASE'); t = Px(32, 32)
        t.rect(0, 0, 32, 32, GREEN[2])
        for _ in range(130): t.rect(int(rng.random() * 32), int(rng.random() * 32), 1 + int(rng.random() * 3), 1, rng.choice([GREEN[1], GREEN[3], GREEN[2], GREEN[0]]))
        t.hline(0, 0, 32, WHITE[3]); t.hline(0, 1, 32, WHITE[1]); t.dither(0, 2, 32, 4, GREEN[0], .4)
        t.rect(0, 27, 32, 5, CONC[2]); t.hline(0, 27, 32, CONC[4])
        for _ in range(3):
            cx, cy = int(rng.random() * 28), 6 + int(rng.random() * 14)
            for _ in range(14): t.set(cx + int(rng.gauss(0, 2.5)), cy + int(rng.gauss(0, 2)), INT[1])
        return t
    rng = R('WALLBASE'); t = Px(32, 32)
    t.rect(0, 0, 32, 32, GREEN[2])
    for _ in range(150): t.rect(int(rng.random() * 32), int(rng.random() * 32), 1 + int(rng.random() * 3), 1, rng.choice([GREEN[1], GREEN[3], GREEN[2], GREEN[0]]))
    t.hline(0, 0, 32, WHITE[3]); t.hline(0, 1, 32, WHITE[1]); t.hline(0, 2, 32, GREEN[0]); t.dither(0, 3, 32, 4, GREEN[0], .45)   # white stripe under the string course
    t.rect(0, 24, 32, 8, CONC[2])                                                                                       # concrete plinth
    t.rect(0, 24, 32, 2, CONC[4]); t.hline(0, 26, 32, CONC[0])
    for x in range(0, 32, 11): t.vline(x + int(rng.random() * 4), 26, 6, CONC[0])
    for _ in range(4):                                                                                                  # chipped paint
        cx, cy = int(rng.random() * 28), 6 + int(rng.random() * 14)
        for _ in range(16): t.set(cx + int(rng.gauss(0, 2.5)), cy + int(rng.gauss(0, 2)), CREAM[1] if rng.random() < .5 else CONC[3])
    for _ in range(5): tuft(t, int(rng.random() * 28) + 2, 31, GRASS, rng, 3)
    for _ in range(40): t.set(int(rng.random() * 32), 24 + int(rng.random() * 8), MOSS[1])
    return t
GT.__dict__['_wallbase_orig'] = GT.wallbase
GT.wallbase = wallbase

def window(lit=False, broken=False, rain=False):
    if rain: return GT.__dict__['_window_orig'](lit, broken, rain)
    name = 'WINDOWLIT' if lit else 'WINDOWBROKEN' if broken else 'WINDOW'
    t = wall_plaster('WALL'); rng = R(name)
    # white frame with a shallow arch
    t.rect(4, 4, 24, 23, WHITE[2]); t.rect(5, 3, 22, 1, WHITE[2]); t.rect(8, 2, 16, 1, WHITE[2])
    t.hline(8, 2, 16, WHITE[4]); t.vline(4, 5, 22, WHITE[3]); t.vline(27, 5, 22, WHITE[0])
    # green louvred shutters (swung open, one each side)
    for sx in (0, 27):
        t.rect(sx, 5, 5, 22, GREEN[3]); t.vline(sx if sx == 0 else sx + 4, 5, 22, GREEN[0]); t.vline(sx + (4 if sx == 0 else 0), 5, 22, GREEN[4])
        for y in range(6, 26, 2): t.hline(sx + 1, y, 3, GREEN[1]); t.hline(sx + 1, y + 1, 3, GREEN[4])
    # opening
    t.rect(7, 6, 18, 20, IRON[0])
    if lit:
        for y in range(7, 25):
            c = ['#ffe08a', '#f2c25a', '#d99a3a', '#a86a22'][min(3, (y - 7) // 5)]
            t.hline(8, y, 16, c)
        # a figure standing very still in the left pane
        t.ell(11, 14, 2, 2, '#1a0c08'); t.rect(9, 16, 5, 9, '#1a0c08'); t.rect(8, 17, 1, 5, '#1a0c08'); t.rect(14, 17, 1, 5, '#1a0c08')
    else:
        for y in range(7, 25):
            k = (y - 7) / 18; c = mix(GLASS[3], GLASS[0], k)
            t.hline(8, y, 16, c)
        for _ in range(8): t.set(9 + int(rng.random() * 14), 8 + int(rng.random() * 8), GLASS[4])
    t.vline(15, 6, 20, WHITE[1]); t.vline(16, 6, 20, WHITE[3]); t.hline(7, 14, 18, WHITE[1])
    if broken:
        for (x0, y0, x1, y1) in [(8, 7, 14, 13), (16, 7, 24, 13), (8, 15, 15, 24)]:
            t.rect(x0, y0, x1 - x0, y1 - y0, '#020306')
        for (x0, y0, x1, y1) in [(8, 7, 13, 11), (17, 7, 23, 10), (9, 16, 14, 21), (17, 16, 23, 22)]:   # shards left in the frame
            t.line(x0, y0, x1, y1, GLASS[4]); t.line(x1, y0, x0 + 1, y1, GLASS[3])
        t.set(11, 18, '#ff2a2a'); t.set(14, 18, '#ff2a2a'); t.set(10, 18, '#7a1010'); t.set(15, 18, '#7a1010')   # eyes in the dark
        t.line(1, 7, 5, 22, GREEN[2]); t.vline(5, 22, 4, GREEN[0])                                              # shutter hanging off one hinge
    t.rect(2, 27, 28, 2, WHITE[3]); t.hline(2, 27, 28, WHITE[4]); t.hline(2, 29, 28, WHITE[0])                 # sill
    if not lit:
        for x in (3, 12, 24): t.vline(x, 29, 3 + int(rng.random() * 2), '#1b2a20')
    return t
GT.__dict__['_window_orig'] = GT.window
GT.window = window

def pillar():
    t = wall_plaster('WALL'); rng = R('PILLAR')
    t.rect(6, 0, 20, 32, WHITE[2]); t.rect(6, 0, 3, 32, WHITE[4]); t.rect(23, 0, 3, 32, WHITE[0]); t.vline(9, 0, 32, WHITE[3])
    t.rect(4, 0, 24, 4, WHITE[3]); t.hline(4, 0, 24, WHITE[4]); t.hline(4, 4, 24, WHITE[0])                      # capital
    t.rect(4, 26, 24, 6, WHITE[3]); t.hline(4, 26, 24, WHITE[4]); t.hline(4, 31, 24, WHITE[0])                   # base
    t.rect(6, 6, 20, 3, GREEN[3]); t.hline(6, 6, 20, GREEN[5]); t.hline(6, 8, 20, GREEN[0])                       # green bands
    t.rect(6, 20, 20, 3, GREEN[3]); t.hline(6, 20, 20, GREEN[5]); t.hline(6, 22, 20, GREEN[0])
    for _ in range(26): t.set(7 + int(rng.random() * 18), 6 + int(rng.random() * 17), WHITE[1] if rng.random() < .5 else WHITE[2])
    crack(t, rng, 14, 9, 14, WHITE[0])
    for y in range(10, 19): t.set(21 + (y // 5) % 2, y, BLOOD[1])                                                  # one long dark smear
    return t
GT.pillar = pillar

def roof(edge=False, kind='red'):
    name = {('red', False): 'ROOF', ('red', True): 'ROOFEDGE', ('tin', False): 'ROOFTIN', ('tin', True): 'ROOFTINEDGE'}[(kind, edge)]
    rng = R(name); t = Px(32, 32); base = TILER if kind == 'red' else TING
    t.rect(0, 0, 32, 32, base[2])
    for x in range(32):
        m = x % 4; t.vline(x, 0, 32, base[4] if m == 0 else base[3] if m == 1 else base[2] if m == 2 else base[0])
    for _ in range(50): t.set(int(rng.random() * 32), int(rng.random() * 32), rng.choice([base[0], base[1], base[3]]))
    for y in (15, 31): t.hline(0, y, 32, base[0]); t.dither(0, y - 1, 32, 1, base[1], .5)
    for _ in range(3):                                                                                       # rust blooms
        cx, cy = int(rng.random() * 32), int(rng.random() * 30)
        for _ in range(22): t.set(cx + int(rng.gauss(0, 3)), cy + int(rng.gauss(0, 3)), RUST[int(rng.random() * 3)])
    for _ in range(2):                                                                                       # moss pooling in the valleys
        cx, cy = int(rng.random() * 32), int(rng.random() * 30)
        for _ in range(26): t.set(cx + int(rng.gauss(0, 3.5)), cy + int(rng.gauss(0, 2.5)), MOSS[1 + int(rng.random() * 2)])
    if edge:
        t.rect(0, 0, 32, 32, base[1])
        for x in range(32): t.vline(x, 0, 9, [base[3], base[2], base[1], base[0]][x % 4])
        # carved fascia board (Burmese fretwork): white band with green scallops hanging below
        t.rect(0, 9, 32, 3, WHITE[3]); t.hline(0, 9, 32, WHITE[4]); t.hline(0, 11, 32, WHITE[1])
        for x in range(0, 32, 8):
            t.ell(x + 4, 13, 4, 3.2, GREEN[3]); t.ell(x + 4, 13, 2.2, 1.8, CREAM[2]); t.hline(x, 12, 8, GREEN[3])
            t.set(x + 4, 17, GREEN[4]); t.set(x + 4, 16, GREEN[3])
        t.rect(0, 17, 32, 15, CREAM[0]); t.dither(0, 17, 32, 9, '#02030a', .55)
        for x in (3, 12, 21, 28): t.vline(x, 17, 4 + int(rng.random() * 8), '#314a7a')
        for x in range(0, 32, 8): t.set(x + 4, 17, GREEN[3]); t.set(x + 3, 16, GREEN[3]); t.set(x + 5, 16, GREEN[3])
    return t
GT.roof_tin = lambda edge=False, red=True: roof(edge, 'red' if red else 'tin')

def door(locked=False):
    t = wall_plaster('WALL'); rng = R('DOORLOCK' if locked else 'DOOR')
    t.rect(2, 2, 28, 30, WHITE[2]); t.rect(2, 2, 28, 1, WHITE[4]); t.rect(3, 4, 26, 28, GREEN[0])
    t.rect(4, 5, 24, 27, WOOD[2])
    t.vline(15, 5, 27, WOOD[0]); t.vline(16, 5, 27, WOOD[1])
    for (px, py) in [(6, 8), (18, 8), (6, 21), (18, 21)]:
        t.rect(px, py, 8, 11 if py == 8 else 9, WOOD[1]); t.rect(px + 1, py + 1, 6, 9 if py == 8 else 7, WOOD[3]); t.hline(px + 1, py + 1, 6, WOOD[4])
    t.rect(13, 17, 2, 4, LAMP[2]); t.rect(17, 17, 2, 4, LAMP[2]); t.set(13, 17, LAMP[4]); t.set(17, 17, LAMP[4])
    if locked:
        t.rect(8, 14, 16, 2, IRON[3]); t.rect(13, 16, 6, 6, '#6e5a22'); t.rect(14, 17, 4, 4, LAMP[1]); t.rect(14, 12, 4, 4, IRON[4]); t.rect(15, 13, 2, 2, IRON[1])
    return t
GT.door = door

# ---------------------------------------------------------------- landmark sprites
def stupa():
    """Small whitewashed-and-gilded pagoda (zedi) of the kind every Myanmar school compound has, cracked, with a dim offering lamp."""
    t = Px(64, 112)
    def band(y, w, h, c1, c2, c3):
        x = 32 - w // 2; t.rect(x, y, w, h, c1); t.rect(x, y, w, 1, c3); t.rect(x + w - 2, y, 2, h, c2)
    band(100, 52, 12, '#9a9a88', '#5c5c52', '#cfcfbc'); band(92, 44, 9, '#b2b2a0', '#6c6c60', '#dedecb'); band(85, 36, 8, '#c4c4b0', '#7a7a6c', '#ecece0')
    # bell-shaped body
    for y in range(40, 86):
        k = (y - 40) / 45; w = int(7 + 17 * (k ** 1.3)); x = 32 - w
        t.hline(x, y, w * 2, '#d8cf9a'); t.hline(x, y, 3, '#fff0b8') if True else None; t.hline(32 + w - 4, y, 4, '#9a8a50')
    for y in range(40, 86, 6): t.hline(20, y, 24, '#b8a868') if 22 < 0 else None
    for (y, w) in [(36, 9), (32, 7), (28, 6)]: t.rect(32 - w, y, w * 2, 3, '#e8c040'); t.hline(32 - w, y, w * 2, '#fff0a0'); t.hline(32 - w, y + 2, w * 2, '#9a7418')
    t.rect(30, 8, 4, 20, '#e8c040'); t.vline(30, 8, 20, '#fff0a0'); t.vline(33, 8, 20, '#9a7418')
    t.ell(32, 6, 4, 4, '#e8c040'); t.set(31, 4, '#fff8c0'); t.rect(31, 0, 2, 4, '#e8c040'); t.set(31, 0, '#fff8c0')    # hti umbrella finial
    rng = random.Random(77)
    for _ in range(90): t.set(14 + int(rng.random() * 36), 44 + int(rng.random() * 54), rng.choice(['#2a3326', '#3a4a30', '#5a4a30']))   # moss and soot
    for y in range(60, 84): t.set(40 + (y // 6) % 2, y, '#6e1018')                                                    # dark streak down the side
    crack(t, rng, 27, 50, 30, '#4a4430')
    t.rect(28, 106, 8, 4, '#d89a3a'); t.rect(30, 103, 4, 3, '#ffcf70'); t.set(31, 101, '#ffd890')                         # dying offering lamp
    return t.outline(OUT)

def nat_shrine():
    """Nat / spirit house on a post (very Myanmar, very eerie): tiny gilded house, faded offerings, a dark doorway."""
    t = Px(40, 80)
    t.rect(18, 36, 4, 42, WOOD[2]); t.vline(18, 36, 42, WOOD[4]); t.vline(21, 36, 42, WOOD[0]); t.rect(12, 74, 16, 5, CONC[3]); t.hline(12, 74, 16, CONC[5])
    t.rect(6, 30, 28, 6, WOOD[3]); t.hline(6, 30, 28, WOOD[5]); t.hline(6, 35, 28, WOOD[0])                                   # platform
    t.rect(9, 16, 22, 15, '#8a5a2a'); t.rect(9, 16, 22, 1, '#c8903a'); t.vline(30, 16, 15, '#5a3416')
    t.rect(15, 19, 10, 12, '#05060a'); t.rect(14, 18, 12, 1, '#e8b030'); t.vline(14, 18, 13, '#e8b030'); t.vline(25, 18, 13, '#e8b030')   # doorway
    t.set(19, 26, '#ff3030'); t.set(21, 26, '#ff3030')                                                                         # something inside is looking out
    for i in range(3):                                                                                                         # tiered roof
        w = 28 - i * 8; y = 14 - i * 5; x = 20 - w // 2
        t.rect(x, y, w, 4, '#b02828' if i != 1 else '#8a1c20'); t.hline(x, y, w, '#e05a4a'); t.hline(x, y + 3, w, '#4a0c10')
        t.set(x - 1, y + 3, '#e8b030'); t.set(x + w, y + 3, '#e8b030')
    t.rect(19, 0, 2, 6, '#e8b030'); t.set(19, 0, '#fff0a0')
    for (x, y) in [(8, 31), (32, 31)]:                                                                                          # faded marigold garlands
        for k in range(5): t.set(x + (k % 2), y + k, '#d89020' if k % 2 else '#6a4a18')
    t.rect(6, 36, 3, 3, '#7a1a1a'); t.rect(30, 36, 3, 3, '#7a1a1a')
    return t.outline(OUT)

def hanging_lantern():
    t = Px(16, 40)
    t.vline(8, 0, 12, IRON[3]); t.rect(4, 12, 8, 3, '#7a1a1a'); t.rect(3, 15, 10, 14, '#b02828'); t.rect(4, 16, 8, 12, '#e05a3a'); t.rect(6, 19, 4, 6, '#ffd070')
    t.vline(3, 15, 14, '#6a1010'); t.vline(12, 15, 14, '#6a1010'); t.rect(4, 29, 8, 2, '#7a1a1a'); t.vline(8, 31, 8, '#e8b030'); t.set(7, 38, '#e8b030'); t.set(9, 38, '#e8b030')
    return t.outline(OUT)


# ---------------------------------------------------------------- player: brighter school-green longyi + white shirt, thanaka on the cheeks,
# reflective strip + red charm on the bag, cool rim light so the character separates from the dark courtyard. Same 32x40 frames / row layout.
def build_player():
    import gen_player as GP
    GP.LONG = ['#17402e', '#225e44', '#2f8660', '#43a67a']
    GP.SHIRT = ['#9aa4bc', '#c4ccdf', '#e6ebf8', '#ffffff']
    _hf, _hs, _bp = GP.head_front, GP.head_side, GP.backpack
    def head_front(t, x, y, face='normal', blink=False):
        _hf(t, x, y, face, blink)
        if face != 'closed' or True:
            for cx in (x + 2, x + 8): t.rect(cx, y + 9, 2, 2, '#d9c47c'); t.set(cx, y + 9, '#efe0a0')       # thanaka
    def head_side(t, x, y, face='normal'):
        _hs(t, x, y, face); t.rect(x + 8, y + 9, 2, 2, '#d9c47c'); t.set(x + 8, y + 9, '#efe0a0')
    def backpack(t, view, y, bob=0):
        _bp(t, view, y, bob)
        if view == 'back': t.hline(10, y + 4, 12, '#cfd6ea'); t.hline(10, y + 5, 12, '#7a86a8'); t.rect(21, y + 10, 2, 4, '#c03038'); t.set(21, y + 14, '#ff6a60')
        elif view == 'side': t.hline(6, y + 4, 7, '#cfd6ea'); t.hline(6, y + 5, 7, '#7a86a8')
    GP.head_front, GP.head_side, GP.backpack = head_front, head_side, backpack
    rows = GP.build(); sheet, meta, cols = GP.pack(rows)
    px = sheet.im.load(); W, Hh = sheet.im.size; src = sheet.im.copy().load(); OUTC = (7, 8, 15)
    for yy in range(1, Hh):
        for xx in range(1, W):
            c = src[xx, yy]
            if c[3] < 200 or c[:3] == OUTC: continue
            up, lf = src[xx, yy - 1], src[xx - 1, yy]
            if (up[3] > 200 and up[:3] == OUTC) or (lf[3] > 200 and lf[:3] == OUTC):
                px[xx, yy] = tuple(int(c[i] + (rc - c[i]) * .30) for i, rc in enumerate((150, 176, 255))) + (c[3],)
    return sheet, meta, cols

def check_player_meta(meta):
    txt = open(os.path.join(SRC, 'animData.js')).read(); data = json.loads(txt[txt.index('=') + 1:].strip().rstrip(';'))
    assert data['player']['anims'] == meta, 'player animation layout changed - animData.js would need regenerating'

def temple_bell():
    """Big bronze temple bell on a wooden frame: the school's 'last bell'. Dull, green with age, and swaying a little too much."""
    t = Px(64, 80)
    t.rect(2, 4, 6, 76, WOOD[3]); t.rect(56, 4, 6, 76, WOOD[3]); t.vline(2, 4, 76, WOOD[5]); t.vline(61, 4, 76, WOOD[0])
    t.rect(0, 0, 64, 7, WOOD[4]); t.hline(0, 0, 64, WOOD[5]); t.hline(0, 6, 64, WOOD[0]); t.rect(0, 74, 12, 6, CONC[3]); t.rect(52, 74, 12, 6, CONC[3])
    t.rect(31, 7, 2, 8, IRON[3])
    for y in range(15, 64):
        k = (y - 15) / 48; w = int(8 + 14 * (k ** .8)); t.hline(32 - w, y, w * 2, '#8a6a2a'); t.hline(32 - w, y, 3, '#d8b050'); t.hline(32 + w - 4, y, 4, '#4a3412')
    t.rect(8, 62, 48, 4, '#6a4e1c'); t.hline(8, 62, 48, '#d8b050'); t.hline(8, 65, 48, '#2a1c08')
    for y in (28, 40, 52): t.hline(14, y, 36, '#4a3412')
    rng = random.Random(5)
    for _ in range(40): t.set(14 + int(rng.random() * 36), 18 + int(rng.random() * 44), rng.choice(['#2a5a44', '#3a7a5a']))
    t.rect(30, 66, 4, 8, '#3a2a10'); t.ell(32, 75, 3, 3, '#6a4e1c')
    return t.outline(OUT)

def build_objects():
    d = GO.build_all()
    d['bell'] = temple_bell(); d['stupa'] = stupa(); d['nat_shrine'] = nat_shrine(); d['lantern'] = hanging_lantern()
    return d

def pack_atlas(sprites, path, max_w=1024, pad=2):
    items = sorted(sprites.items(), key=lambda kv: (-kv[1].h, kv[0]))
    x = y = pad; row_h = 0; place = {}
    for k, s in items:
        if x + s.w + pad > max_w: x = pad; y += row_h + pad; row_h = 0
        place[k] = (x, y); x += s.w + pad; row_h = max(row_h, s.h)
    Hh = y + row_h + pad; W = max_w if y > pad else x
    W = 1 << (W - 1).bit_length(); Hh = 1 << (Hh - 1).bit_length()
    img = Px(W, Hh); frames = {}
    for k, (px, py) in place.items():
        s = sprites[k]; img.im.alpha_composite(s.im, (px, py))
        frames[k] = {'frame': {'x': px, 'y': py, 'w': s.w, 'h': s.h}, 'rotated': False, 'trimmed': False, 'spriteSourceSize': {'x': 0, 'y': 0, 'w': s.w, 'h': s.h}, 'sourceSize': {'w': s.w, 'h': s.h}}
    img.im.save(path + '.png')
    json.dump({'frames': frames, 'meta': {'image': os.path.basename(path) + '.png', 'size': {'w': W, 'h': Hh}, 'scale': '1'}}, open(path + '.json', 'w'))

def main():
    random.seed(15)
    sheet, cols = GT.build(); sheet.save(os.path.join(ASSET_DIR, 'tilesets', 'tiles.png'))
    themes = {
        'outdoor': ['GRASS','GRASS2','PATH','PATHWET','COURT','COURTH','COURTV','PUDDLE','PATHCRACK','PATHLEAF','PATHMOSS','DRAIN','FENCE','GATE','BED','TRUNK','BUSH','CANOPY','ROOF','ROOFEDGE','ROOFTIN','ROOFTINEDGE','WALL','WALLSTAIN','WALLPEEL','WALLBASE','WINDOW','WINDOWLIT','WINDOWBROKEN','DOOR','DOORLOCK','STAIRS','PILLAR'],
    }
    for th, names in themes.items():
        strip = Px(len(names) * 32, 32)
        for i, n in enumerate(names):
            idx = GT.ID[n]; strip.im.alpha_composite(sheet.im.crop(((idx % cols) * 32, (idx // cols) * 32, (idx % cols) * 32 + 32, (idx // cols) * 32 + 32)), (i * 32, 0))
        strip.save(os.path.join(ASSET_DIR, 'tilesets', th, th + '.png'))
    objs = build_objects()
    for k in ('banyan_back', 'banyan_front', 'banyan_roots'): objs.pop(k)
    keep = lambda k: not (k.startswith(('fan_', 'curtain_', 'rain_', 'splash_', 'ripple_', 'drip_', 'dust_', 'leaf_', 'sparkle_', 'tuft_')) or k in ('clock', 'calendar', 'poster', 'timetable', 'mirror', 'bag', 'books', 'papers', 'chalk', 'bench', 'pot_flower', 'pot_fern', 'bin', 'tube_on', 'tube_dim', 'exit_sign', 'emergency_light', 'fog'))
    pack_atlas({k: v for k, v in objs.items() if keep(k)}, os.path.join(ASSET_DIR, 'sprites/objects/objects'))
    ps, pmeta, _ = build_player(); check_player_meta(pmeta); ps.save(os.path.join(ASSET_DIR, 'sprites/player/player.png'))
    print('v15 art done')

if __name__ == '__main__':
    main()
