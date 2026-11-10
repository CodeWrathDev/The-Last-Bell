import json, random, math, os
from pixel import Px, H, mix
from palette import *

TILE = 32
NAMES = ['GRASS','GRASS2','PATH','PATHWET','COURT','WALL','WINDOW','DOOR','ROOF','FENCE','GATE','FLOOR','PUDDLE','BED','TRUNK','BUSH',
 'WALLBASE','STAIRS','FLOORDARK','DESK','BOARD','SHELF','ROOFEDGE','PILLAR','CANOPY','WALLINT','DOORLOCK','RUG','COURTH','COURTV','WINDOWLIT',
 'PATHCRACK','PATHLEAF','DRAIN','FLOORCRACK','FLOORTILE','WALLSTAIN','WALLPEEL','WINDOWBROKEN','ROOFTIN','ROOFTINEDGE','LIBFLOOR','LIBSHELF',
 'READTABLE','WINDOWRAIN','WALLINTBASE','FLOORSTAIN','PATHMOSS','DESK2','DESK3']
ID = {n: i for i, n in enumerate(NAMES)}

def R(name):
    return random.Random(ID[name] * 977 + 13)

def fill_noise(t, rng, ramp, weights=(.18, .5, .22, .1), n=140, size=2):
    t.rect(0, 0, 32, 32, ramp[2])
    for _ in range(n):
        x, y = int(rng.random() * 32), int(rng.random() * 32)
        r = rng.random(); c = ramp[0] if r < .2 else ramp[1] if r < .5 else ramp[3] if r < .8 else ramp[4]
        t.rect(x, y, 1 + int(rng.random() * size), 1, c)

def crack(t, rng, x, y, ln, c, branch=True):
    for i in range(ln):
        t.set(x, y, c)
        x += rng.choice([-1, 0, 1, 1]) ; y += 1 if rng.random() < .75 else 0
        if branch and rng.random() < .08:
            crack(t, rng, x, y, ln // 3, c, False)

def tuft(t, x, y, cols, rng, h=4):
    for dx in (-1, 0, 1):
        hh = h - abs(dx) - int(rng.random() * 2)
        for k in range(hh):
            t.set(x + dx + (k // 3) * (1 if dx > 0 else -1 if dx < 0 else 0), y - k, cols[min(len(cols) - 1, 2 + (k * 2) // max(hh, 1))])

# ---------------------------------------------------------------- ground
def concrete(name, wet=False, court=False):
    rng = R(name); t = Px(32, 32)
    ramp = CONCW if wet else CONC
    fill_noise(t, rng, ramp[0:5] if wet else ramp[0:5], n=170)
    # expansion joint lines (slab edges), worn
    t.hline(0, 0, 32, ramp[1]); t.vline(0, 0, 32, ramp[1])
    t.hline(0, 1, 32, ramp[3]); t.vline(1, 0, 32, ramp[3])
    for _ in range(3): crack(t, rng, 4 + int(rng.random() * 24), int(rng.random() * 12), 8 + int(rng.random() * 12), ramp[0])
    if wet:
        for _ in range(3):
            y = 5 + int(rng.random() * 22); x = int(rng.random() * 18); L = 6 + int(rng.random() * 9)
            t.hline(x, y, L, '#3c5683'); t.hline(x + 1, y + 1, max(1, L - 3), ramp[4])
    return t

def grass(name, alt=False):
    rng = R(name); t = Px(32, 32)
    t.rect(0, 0, 32, 32, GRASS[1])
    for _ in range(70): t.rect(int(rng.random() * 32), int(rng.random() * 32), 2 + int(rng.random() * 3), 1 + int(rng.random() * 2), GRASS[0] if rng.random() < .5 else GRASS[2])
    for _ in range(26 if not alt else 38):
        tuft(t, int(rng.random() * 30) + 1, int(rng.random() * 26) + 5, GRASS, rng, 3 + int(rng.random() * 3))
    if alt:
        for _ in range(3):  # tiny night flowers
            x, y = int(rng.random() * 30), int(rng.random() * 28) + 2
            t.set(x, y, '#7c6aa8' if rng.random() < .5 else '#b8a460')
    return t

def path_variant(name):
    t = concrete(name); rng = R(name)
    if name == 'PATHCRACK':
        crack(t, rng, 14, 0, 30, CONC[0]); crack(t, rng, 15, 0, 30, CONC[1], False)
        for y in (9, 19, 27): tuft(t, 14 + int(rng.random() * 4), y, GRASS, rng, 4)
    elif name == 'PATHLEAF':
        for _ in range(9):
            x, y = int(rng.random() * 28), int(rng.random() * 28); c = rng.choice(['#4a3a1e', '#5d4a22', '#3b4a22', '#6b4a1e'])
            t.rect(x, y, 3, 2, c); t.set(x + 1, y + 1, SOIL[1]); t.set(x + 3, y, c)
    elif name == 'PATHMOSS':
        for _ in range(60): t.set(int(rng.random() * 32), 22 + int(rng.random() * 10) - int(rng.random() * 8), rng.choice(GRASS[2:5]))
        crack(t, rng, 6, 4, 22, CONC[0])
    elif name == 'DRAIN':
        t.rect(5, 8, 22, 16, IRON[0]); t.rect(6, 9, 20, 14, IRON[1]); t.rect(5, 8, 22, 1, CONC[4]); t.rect(5, 8, 1, 16, CONC[4])
        for x in range(8, 25, 4): t.rect(x, 11, 2, 10, '#03040a'); t.set(x, 11, IRON[3])
        t.rect(5, 24, 22, 1, CONC[0]); t.rect(27, 8, 1, 17, CONC[0])
        t.rect(14, 21, 5, 1, '#3c5683')
    return t

def puddle():
    t = concrete('PUDDLE', wet=True); rng = R('PUDDLE')
    # irregular pixel puddle: deep edge -> mid -> reflective sheen
    cx, cy, rx, ry = 16, 17, 13.5, 8.5
    for y in range(32):
        for x in range(32):
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (rng.random() - .5) * .12
            if d < 1:
                t.set(x, y, '#0b1630' if d > .72 else '#12254a' if d > .35 else '#1a3566')
            elif d < 1.12:
                t.set(x, y, CONCW[0])
    for (x, y, L) in [(9, 14, 7), (17, 18, 8), (12, 21, 5), (20, 13, 4)]:
        t.hline(x, y, L, '#4f78b8'); t.hline(x + 1, y + 1, max(1, L - 4), '#2d4f88')
    t.set(21, 15, '#cfe2ff'); t.set(10, 19, '#cfe2ff')
    return t

def court():
    t = concrete('COURT'); rng = R('COURT')
    # sun-faded blue-green sports paint
    for y in range(32):
        for x in range(32):
            c = t.get(x, y); t.set(x, y, mix(c, '#22505a', .45))
    return t

def court_line(horiz):
    t = court()
    if horiz: t.hline(0, 14, 32, '#9aa6c2'); t.hline(0, 15, 32, '#c6d0e8'); t.hline(0, 16, 32, '#6f7c9e')
    else: t.vline(14, 0, 32, '#9aa6c2'); t.vline(15, 0, 32, '#c6d0e8'); t.vline(16, 0, 32, '#6f7c9e')
    rng = R('COURTH')
    for _ in range(26): t.set(int(rng.random() * 32), 12 + int(rng.random() * 8) if horiz else int(rng.random() * 32), CONC[2]) if horiz else None
    return t

# ---------------------------------------------------------------- vertical structures
def wall_plaster(name, interior=False, stain=False, peel=False):
    rng = R(name); t = Px(32, 32); P = PLASTI if interior else PLAST
    t.rect(0, 0, 32, 32, P[2])
    for _ in range(120): t.rect(int(rng.random() * 32), int(rng.random() * 32), 1 + int(rng.random() * 3), 1, rng.choice([P[1], P[3], P[2]]))
    # eave shadow gradient at top (roof overhang)
    t.rect(0, 0, 32, 2, P[0]); t.dither(0, 2, 32, 3, P[0], .55); t.dither(0, 5, 32, 3, P[1], .35)
    t.hline(0, 31, 32, P[1])
    # faint horizontal render seam
    t.hline(0, 16, 32, P[1])
    # water streaks
    for _ in range(3 + (3 if stain else 0)):
        x = int(rng.random() * 30); L = 10 + int(rng.random() * 18); w = 1 + int(rng.random() * 3)
        for y in range(4, 4 + L):
            for dx in range(w):
                if rng.random() < .8: t.set(x + dx, y, P[1] if y % 3 else P[0])
    if peel:
        for _ in range(2):
            cx, cy = 6 + int(rng.random() * 20), 8 + int(rng.random() * 14)
            for y in range(-5, 6):
                for x in range(-6, 7):
                    d = (x / 6) ** 2 + (y / 5) ** 2 + (rng.random() - .5) * .35
                    if d < 1:
                        t.set(cx + x, cy + y, CONC[3] if d > .55 else BRICK[2] if (x + y) % 5 else BRICK[1])
                    elif d < 1.25: t.set(cx + x, cy + y, P[4])  # curled paint lip
            for k in range(-4, 5, 3): t.hline(cx - 5, cy + k, 11, BRICK[0]) if rng.random() < .5 else None
    if stain:
        for _ in range(40): t.set(int(rng.random() * 32), 10 + int(rng.random() * 18), '#1d3029' if not interior else '#252a40')
    return t

def wallbase(interior=False):
    rng = R('WALLBASE' if not interior else 'WALLINTBASE'); t = Px(32, 32); P = PLASTI if interior else PLAST
    t.rect(0, 0, 32, 32, CONC[2] if not interior else PLASTI[1])
    for _ in range(110): t.rect(int(rng.random() * 32), int(rng.random() * 32), 1 + int(rng.random() * 3), 1, rng.choice([CONC[1], CONC[3], CONC[0]]))
    t.rect(0, 0, 32, 3, CONC[4]); t.hline(0, 3, 32, CONC[0])  # plinth lip catching light
    t.dither(0, 4, 32, 4, CONC[0], .4)
    for x in range(0, 32, 11): t.vline(x + int(rng.random() * 4), 4, 28, CONC[0])  # block joints
    for _ in range(3): tuft(t, int(rng.random() * 28) + 2, 31, GRASS, rng, 3)
    return t

def window(lit=False, broken=False, rain=False):
    name = 'WINDOWLIT' if lit else 'WINDOWBROKEN' if broken else 'WINDOWRAIN' if rain else 'WINDOW'
    t = wall_plaster('WALL' if not rain else 'WALLINT', interior=rain); rng = R(name)
    # recess
    t.rect(4, 3, 24, 24, IRON[0]); t.rect(5, 4, 22, 22, '#2a2f44')
    gl = ['#f3c968', '#e0a84a', '#b4792a'] if lit else GLASS
    if lit:
        for y in range(6, 24):
            t.hline(7, y, 18, gl[0] if y < 11 else gl[1] if y < 18 else gl[2])
        # curtain silhouettes + a figure-less warm glow
        t.rect(7, 6, 4, 18, '#8a5a1e'); t.rect(21, 6, 4, 18, '#8a5a1e'); t.vline(9, 6, 18, '#b9833a'); t.vline(23, 6, 18, '#b9833a')
    else:
        for y in range(6, 24):
            t.hline(7, y, 18, GLASS[1] if y < 12 else GLASS[0])
        # night sky reflection streak + rain on glass
        for k in range(8): t.set(10 + k, 8 + k, GLASS[4]); t.set(11 + k, 8 + k, GLASS[3])
        for _ in range(7): x = 8 + int(rng.random() * 16); y = 7 + int(rng.random() * 14); t.vline(x, y, 3 + int(rng.random() * 4), GLASS[3])
        if rain:
            t.rect(7, 6, 18, 18, GLASS[0]);
            for _ in range(26): x = 8 + int(rng.random() * 16); y = 7 + int(rng.random() * 14); t.vline(x, y, 2 + int(rng.random() * 5), '#4a6fa0')
    if broken:
        # missing shards revealing dark interior, jagged edges
        for (ax, ay, bx, by, cx, cy) in [(13, 6, 25, 6, 25, 15), (7, 17, 15, 24, 7, 24)]:
            for y in range(6, 25):
                for x in range(7, 25):
                    def sg(px, py, qx, qy, rx, ry): return (px - rx) * (qy - ry) - (qx - rx) * (py - ry)
                    d1, d2, d3 = sg(x, y, ax, ay, bx, by), sg(x, y, bx, by, cx, cy), sg(x, y, cx, cy, ax, ay)
                    if not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0)): t.set(x, y, '#03040a')
        for k in range(6): t.set(13 + k, 6 + k, '#cfe2ff')
        for k in range(5): t.set(7 + k, 17 + k, GLASS[4])
    # mullions: iron bars outside (typical for Myanmar schools)
    t.vline(15, 4, 22, IRON[1]); t.vline(16, 4, 22, IRON[2]); t.hline(5, 14, 22, IRON[1]); t.hline(5, 15, 22, IRON[2])
    for x in (9, 12, 19, 22): t.vline(x, 4, 22, IRON[3]) if not rain else None
    # sill + drip stain below
    t.rect(3, 27, 26, 2, PLAST[4] if not rain else PLASTI[4]); t.hline(3, 29, 26, IRON[0])
    for x in (8, 14, 21): t.vline(x, 29, 3, P_STAIN)
    # corner frame highlight
    t.hline(4, 3, 24, IRON[3]); t.vline(4, 3, 24, IRON[3])
    return t
P_STAIN = '#1d2d2a'

def door(locked=False):
    t = wall_plaster('WALL'); rng = R('DOORLOCK' if locked else 'DOOR')
    t.rect(3, 2, 26, 30, IRON[0]); t.rect(5, 3, 22, 29, WOOD[2])
    for x in (5, 16): t.vline(x + 10 if x == 5 else x, 3, 29, WOOD[0])
    t.vline(16, 3, 29, WOOD[0]); t.vline(15, 3, 29, WOOD[1])
    for (px, py) in [(7, 6), (18, 6), (7, 20), (18, 20)]:
        t.rect(px, py, 8, 11 if py == 6 else 9, WOOD[1]); t.rect(px + 1, py + 1, 6, 9 if py == 6 else 7, WOOD[3]); t.hline(px + 1, py + 1, 6, WOOD[4])
    for _ in range(60): t.set(5 + int(rng.random() * 22), 3 + int(rng.random() * 29), rng.choice([WOOD[1], WOOD[3]]))
    t.rect(13, 17, 2, 4, LAMP[2]); t.rect(17, 17, 2, 4, LAMP[2]); t.set(13, 17, LAMP[4]); t.set(17, 17, LAMP[4])
    t.hline(3, 2, 26, IRON[3])
    if locked:
        t.rect(8, 14, 16, 2, IRON[3]); t.rect(8, 14, 16, 1, IRON[4])  # chain bar
        t.rect(13, 16, 6, 6, '#6e5a22'); t.rect(14, 17, 4, 4, LAMP[1]); t.rect(14, 12, 4, 4, IRON[4]); t.rect(15, 13, 2, 2, IRON[1]); t.set(15, 19, '#07080f')
        t.hline(5, 28, 22, RED[1])  # faint red warning tape stain
    return t

def stairs():
    t = Px(32, 32); rng = R('STAIRS')
    for k in range(4):
        y = k * 8
        t.rect(0, y, 32, 2, CONC[5]); t.rect(0, y + 2, 32, 1, CONC[4]); t.rect(0, y + 3, 32, 5, CONC[2] if k % 2 else CONC[3]); t.rect(0, y + 7, 32, 1, CONC[0])
    for _ in range(100): t.set(int(rng.random() * 32), int(rng.random() * 32), rng.choice([CONC[1], CONC[4]]))
    # worn centre + wet sheen
    for k in range(4): t.hline(10, k * 8 + 4, 12, CONC[1])
    return t

def pillar():
    t = wall_plaster('WALL'); rng = R('PILLAR')
    t.rect(7, 0, 18, 32, CONC[3])
    t.rect(7, 0, 3, 32, CONC[5]); t.rect(22, 0, 3, 32, CONC[1]); t.vline(10, 0, 32, CONC[4])
    t.rect(5, 0, 22, 3, CONC[4]); t.rect(5, 3, 22, 1, CONC[0])   # capital
    t.rect(5, 28, 22, 4, CONC[4]); t.rect(5, 28, 22, 1, CONC[5])  # base
    # painted band peeling
    t.rect(7, 12, 18, 4, '#2c5a46'); t.rect(7, 12, 18, 1, '#3d7a5e')
    for _ in range(14): t.set(8 + int(rng.random() * 16), 12 + int(rng.random() * 4), CONC[3])
    crack(t, rng, 15, 5, 20, CONC[0])
    return t

def roof_tin(edge=False, red=True):
    name = 'ROOF' if red and not edge else 'ROOFEDGE' if red else 'ROOFTIN' if not edge else 'ROOFTINEDGE'
    rng = R(name); t = Px(32, 32)
    base = ROOFRED if red else TIN
    t.rect(0, 0, 32, 32, base[2])
    # corrugation: 4px wavelength ridges, light on left, dark on right
    for x in range(32):
        m = x % 4
        col = base[4] if m == 0 else base[3] if m == 1 else base[2] if m == 2 else base[0]
        t.vline(x, 0, 32, col)
    for _ in range(40): t.set(int(rng.random() * 32), int(rng.random() * 32), rng.choice(base[0:2] + base[3:4]))
    # sheet overlaps every 16 px
    for y in (15, 31): t.hline(0, y, 32, base[0]); t.dither(0, y - 1, 32, 1, base[1], .5)
    # rust blooms & water streaks
    for _ in range(5):
        cx, cy = int(rng.random() * 32), int(rng.random() * 30)
        for _ in range(26): t.set(cx + int(rng.gauss(0, 3)), cy + int(rng.gauss(0, 3)), RUST[int(rng.random() * 3)])
    if edge:
        t.rect(0, 0, 32, 32, base[1])
        for x in range(32): t.vline(x, 0, 10, [base[3], base[2], base[1], base[0]][x % 4])
        t.rect(0, 10, 32, 3, IRON[3]); t.rect(0, 10, 32, 1, IRON[4]); t.rect(0, 13, 32, 1, IRON[0])  # fascia / gutter lip
        t.rect(0, 14, 32, 18, PLAST[0])  # shadowed wall tucked under
        t.dither(0, 14, 32, 8, '#02030a', .6)
        for x in (4, 13, 22, 29): t.vline(x, 14, 4 + int(rng.random() * 8), '#314a7a')  # drip lines
    return t

def fence():
    t = grass('GRASS2'); rng = R('FENCE')
    # low brick plinth + iron spears
    t.rect(0, 20, 32, 8, BRICK[1]); t.rect(0, 20, 32, 1, BRICK[3]); t.rect(0, 27, 32, 1, BRICK[0])
    for x in range(0, 32, 8): t.vline(x + 7, 21, 6, BRICK[0])
    for x in range(2, 32, 6):
        t.rect(x, 2, 2, 20, IRON[2]); t.vline(x, 2, 20, IRON[4]); t.set(x, 0, IRON[4]); t.set(x + 1, 0, IRON[2]); t.rect(x - 1, 2, 4, 1, IRON[3]); t.set(x, 1, IRON[4])
    t.rect(0, 7, 32, 2, IRON[1]); t.rect(0, 7, 32, 1, IRON[3]); t.rect(0, 16, 32, 2, IRON[1]); t.rect(0, 16, 32, 1, IRON[3])
    for _ in range(16): t.set(int(rng.random() * 32), 2 + int(rng.random() * 20), RUST[int(rng.random() * 3)])
    return t

def gate():
    t = concrete('PATH'); rng = R('GATE')
    t.rect(0, 1, 32, 3, IRON[1]); t.rect(0, 1, 32, 1, IRON[4]); t.rect(0, 26, 32, 3, IRON[1]); t.rect(0, 26, 32, 1, IRON[4])
    for x in range(1, 32, 5):
        t.rect(x, 0, 2, 30, IRON[2]); t.vline(x, 0, 30, IRON[4]); t.rect(x - 1, 0, 4, 2, IRON[3])
    t.rect(0, 13, 32, 2, IRON[1]); t.rect(0, 13, 32, 1, IRON[3])
    # decorative arcs
    for x in range(4, 30, 10): t.ell(x + 3, 20, 4, 4, None) ; 
    for _ in range(40): t.set(int(rng.random() * 32), int(rng.random() * 30), RUST[int(rng.random() * 3)])
    # chain + padlock, centred on right tile edge
    t.rect(27, 12, 5, 4, IRON[4]); t.rect(28, 13, 3, 2, IRON[1]); t.rect(28, 15, 4, 5, '#7a5a1e'); t.rect(29, 16, 2, 3, LAMP[2])
    return t

def floor_wood(dark=False):
    name = 'FLOORDARK' if dark else 'FLOOR'; rng = R(name); t = Px(32, 32)
    W = [c for c in (WOOD[0:5] if not dark else WOOD[0:4])]
    plank = 8
    for k in range(4):
        y = k * plank; base = W[2 + (k % 2)] if not dark else W[1 + (k % 2)]
        t.rect(0, y, 32, plank, base)
        for _ in range(26): t.set(int(rng.random() * 32), y + 1 + int(rng.random() * 6), mix(base, W[0], .5) if rng.random() < .5 else mix(base, W[-1], .45))
        # grain lines
        for _ in range(3): gx = int(rng.random() * 20); t.hline(gx, y + 2 + int(rng.random() * 4), 6 + int(rng.random() * 10), mix(base, W[0], .35))
        t.hline(0, y, 32, W[0]); t.hline(0, y + 1, 32, mix(base, W[-1], .35))      # gap + bevel highlight
        jx = (k * 11 + 7) % 28 + 2; t.vline(jx, y, plank, W[0]); t.set(jx + 1, y + 2, mix(base, W[-1], .3))   # end joint
        t.set(jx - 3, y + 3, W[0]); t.set(jx + 4, y + 5, W[0])   # nails
    return t

def floor_variant(name):
    t = floor_wood(dark=name in ('FLOORCRACK', 'FLOORSTAIN')); rng = R(name)
    if name == 'FLOORCRACK':
        crack(t, rng, 12, 0, 32, '#05030a'); crack(t, rng, 20, 6, 20, WOOD[0], False)
    elif name == 'FLOORSTAIN':
        for _ in range(110): t.set(16 + int(rng.gauss(0, 5)), 16 + int(rng.gauss(0, 4)), rng.choice(['#2a0f14', '#3a1219', '#1c090d']))
    return t

def floor_tile():
    t = Px(32, 32); rng = R('FLOORTILE')   # ceramic hall tiles 16px, cream/green checker with grout
    for ty in range(2):
        for tx in range(2):
            base = '#4b5a54' if (tx + ty) % 2 == 0 else '#38453f'
            t.rect(tx * 16, ty * 16, 16, 16, base)
            for _ in range(22): t.set(tx * 16 + int(rng.random() * 15), ty * 16 + int(rng.random() * 15), mix(base, '#0a0f0c', .3) if rng.random() < .5 else mix(base, '#9fb0a6', .22))
            t.hline(tx * 16, ty * 16, 16, mix(base, '#9fb0a6', .4)); t.vline(tx * 16, ty * 16, 16, mix(base, '#9fb0a6', .3))
    t.hline(0, 15, 32, '#0d1412'); t.vline(15, 0, 32, '#0d1412'); t.hline(0, 31, 32, '#0d1412'); t.vline(31, 0, 32, '#0d1412')
    return t

def lib_floor():
    t = floor_wood(); rng = R('LIBFLOOR')
    for y in range(32):
        for x in range(32): t.set(x, y, mix(t.get(x, y), '#1d1630', .22))
    t.rect(0, 0, 32, 32, None)
    return t

def bush():
    t = grass('GRASS'); rng = R('BUSH')
    for (cx, cy, r, c) in [(16, 19, 13, LEAF[1]), (10, 17, 8, LEAF[2]), (22, 17, 8, LEAF[2]), (16, 13, 8, LEAF[3])]: t.ell(cx, cy, r, r * .8, c)
    for _ in range(90): t.set(5 + int(rng.random() * 22), 6 + int(rng.random() * 20), rng.choice([LEAF[4], LEAF[3], LEAF[1], LEAF[5]]) if rng.random() < .8 else None)
    for _ in range(4): t.set(8 + int(rng.random() * 16), 10 + int(rng.random() * 12), '#a05060')
    return t

def trunk():
    t = grass('GRASS'); rng = R('TRUNK')
    t.rect(4, 0, 24, 32, SOIL[2])
    for x in range(4, 28):
        c = [SOIL[1], SOIL[2], SOIL[3], '#6b4a30', SOIL[3], SOIL[2]][((x * 5) // 3) % 6]
        t.vline(x, 0, 32, c)
    for _ in range(80): t.set(5 + int(rng.random() * 22), int(rng.random() * 32), rng.choice([SOIL[0], '#6b4a30', GRASS[3]]))
    t.vline(4, 0, 32, SOIL[0]); t.vline(27, 0, 32, SOIL[0]); t.rect(4, 0, 3, 32, SOIL[1]); t.rect(25, 0, 3, 32, SOIL[0])
    for _ in range(14): t.set(9 + int(rng.random() * 14), int(rng.random() * 32), GRASS[4])  # moss
    return t

def bed():
    t = Px(32, 32); rng = R('BED')
    t.rect(0, 0, 32, 32, SOIL[1])
    for _ in range(80): t.set(int(rng.random() * 32), int(rng.random() * 32), rng.choice([SOIL[0], SOIL[2], SOIL[3]]))
    # brick curb on top edge
    t.rect(0, 0, 32, 5, BRICK[2]); t.hline(0, 0, 32, BRICK[3]); t.hline(0, 4, 32, BRICK[0])
    for x in range(0, 32, 8): t.vline(x + (3 if x % 16 else 7), 0, 5, BRICK[0])
    for x in (4, 12, 20, 28):
        t.vline(x, 12, 12, GRASS[3]); t.line(x, 18, x - 3, 13, GRASS[4]); t.line(x, 16, x + 3, 11, GRASS[4])
        c = rng.choice([RED[3], LAMP[2], '#c070a0', PURPLE[3]]); t.rect(x - 1, 8, 3, 3, c); t.set(x, 9, LAMP[4])
    return t

def desk(variant=0):
    t = floor_wood(dark=True); rng = R('DESK' if variant == 0 else 'DESK2' if variant == 1 else 'DESK3')
    # bench/chair seat in front (bottom), desktop above
    t.rect(4, 21, 24, 6, WOOD[2]); t.rect(4, 21, 24, 1, WOOD[4]); t.rect(4, 26, 24, 1, WOOD[0]); t.hline(5, 27, 22, '#02030a')   # bench seat + cast shadow
    t.rect(6, 27, 2, 4, WOOD[0]); t.rect(24, 27, 2, 4, WOOD[0])
    t.rect(2, 6, 28, 14, WOOD[4]); t.rect(2, 6, 28, 2, WOOD[5]); t.rect(2, 19, 28, 2, WOOD[1]); t.hline(2, 20, 28, WOOD[0])
    t.vline(2, 6, 14, WOOD[5]); t.vline(29, 6, 14, WOOD[1])
    for _ in range(40): t.set(3 + int(rng.random() * 26), 8 + int(rng.random() * 11), rng.choice([WOOD[3], WOOD[5], WOOD[2]]))
    for k in range(3): t.hline(3, 10 + k * 3, 26, WOOD[3])
    # ink stain / carved scratches
    for _ in range(18): t.set(8 + int(rng.gauss(0, 2)), 14 + int(rng.gauss(0, 1)), '#1a2040')
    t.line(20, 9, 26, 12, WOOD[1])
    if variant == 1:   # open textbook + pencil
        t.rect(9, 8, 14, 9, PAPER[3]); t.rect(9, 8, 14, 1, PAPER[4]); t.vline(16, 8, 9, PAPER[1]); t.rect(9, 17, 14, 1, PAPER[0])
        for y in range(10, 16, 2): t.hline(10, y, 5, PAPER[1]); t.hline(17, y, 5, PAPER[1])
        t.hline(24, 16, 5, LAMP[2]); t.set(29, 16, RED[2])
    elif variant == 2:  # school bag slumped on the chair + bottle
        t.rect(8, 20, 14, 9, '#1f3a63'); t.rect(8, 20, 14, 2, '#2f5a99'); t.rect(10, 24, 10, 3, '#16294a'); t.rect(14, 26, 2, 2, LAMP[2]); t.rect(8, 28, 14, 1, '#02030a')
        t.rect(24, 9, 3, 7, '#5a8a9a'); t.rect(24, 8, 3, 1, RED[2])
    return t

def board():
    t = wall_plaster('WALLINT', interior=True); rng = R('BOARD')
    t.rect(1, 3, 30, 23, WOOD[1]); t.rect(1, 3, 30, 1, WOOD[4]); t.rect(2, 4, 28, 21, '#16382e'); t.rect(2, 4, 28, 1, '#0c241d')
    for y in range(5, 24): 
        for x in range(3, 29):
            if rng.random() < .09: t.set(x, y, '#1f4a3c')
    for _ in range(26): t.hline(4 + int(rng.random() * 18), 6 + int(rng.random() * 16), 3 + int(rng.random() * 7), '#2a5a4a')   # old chalk smears
    t.rect(1, 26, 30, 2, WOOD[3]); t.hline(1, 26, 30, WOOD[5]); t.rect(6, 25, 5, 1, UNI[3]); t.rect(12, 25, 3, 1, LAMP[3]); t.hline(1, 28, 30, WOOD[0])
    return t

def shelf(lib=False):
    t = Px(32, 32); rng = R('LIBSHELF' if lib else 'SHELF')
    t.rect(0, 0, 32, 32, WOOD[0]); t.rect(1, 0, 30, 32, WOOD[1])
    cols = ['#6a2a30', '#2f4a7a', '#4a6a30', '#8a6a2a', '#4a3070', '#7a3a20', '#2a5a5a', '#8a8a70']
    for sy in range(0, 32, 10):
        t.rect(1, sy + 8, 30, 2, WOOD[4]); t.hline(1, sy + 8, 30, WOOD[5]); t.hline(1, sy + 10, 30, '#02030a') if sy + 10 < 32 else None
        x = 2
        while x < 29:
            w = 2 + int(rng.random() * 3); h = 5 + int(rng.random() * 4); c = rng.choice(cols)
            if lib and rng.random() < .1: x += w; continue  # gap in the books
            t.rect(x, sy + 8 - h, w, h, c); t.vline(x, sy + 8 - h, h, mix(c, '#ffffff', .25)); t.hline(x, sy + 8 - h, w, mix(c, '#ffffff', .35)); t.set(x + 1, sy + 8 - h + 2, LAMP[2]) if h > 6 and rng.random() < .6 else None
            if rng.random() < .1: x += 1  # leaning book
            x += w
    if not lib:  # cabinet doors with glass
        t.rect(0, 0, 32, 32, WOOD[1])
        for sy in range(0, 32, 16):
            t.rect(2, sy + 2, 13, 13, WOOD[3]); t.rect(17, sy + 2, 13, 13, WOOD[3]); t.rect(4, sy + 4, 9, 9, GLASS[1]); t.rect(19, sy + 4, 9, 9, GLASS[1])
            t.set(5, sy + 5, GLASS[4]); t.line(5, sy + 11, 11, sy + 5, GLASS[2]); t.rect(14, sy + 8, 1, 3, LAMP[2]); t.rect(17, sy + 8, 1, 3, LAMP[2])
    t.vline(0, 0, 32, WOOD[0]); t.vline(31, 0, 32, WOOD[0])
    return t

def read_table():
    t = lib_floor(); rng = R('READTABLE')
    t.rect(1, 6, 30, 18, WOOD[4]); t.rect(1, 6, 30, 2, WOOD[5]); t.rect(1, 22, 30, 2, WOOD[1]); t.hline(1, 24, 30, '#02030a'); t.rect(3, 24, 2, 6, WOOD[0]); t.rect(27, 24, 2, 6, WOOD[0])
    for k in range(4): t.hline(2, 10 + k * 3, 28, WOOD[3])
    for (x, y, c) in [(5, 9, PAPER[3]), (12, 12, '#2f4a7a'), (21, 9, PAPER[2])]:
        t.rect(x, y, 7, 6, c); t.hline(x, y, 7, mix(c, '#fff', .35)); t.hline(x, y + 5, 7, mix(c, '#000', .4))
    t.rect(21, 15, 5, 2, '#6a2a30')
    return t

def rug():
    t = floor_wood(); rng = R('RUG')
    t.rect(1, 1, 30, 30, '#3a1220'); t.rect(2, 2, 28, 28, '#74262f'); t.rect(4, 4, 24, 24, '#4a1620'); t.rect(6, 6, 20, 20, '#8a303a')
    t.rect(9, 9, 14, 14, '#4a1620'); t.rect(12, 12, 8, 8, '#b9833a'); t.rect(14, 14, 4, 4, '#4a1620')
    for _ in range(80): t.set(2 + int(rng.random() * 28), 2 + int(rng.random() * 28), rng.choice(['#3a1220', '#9a4048']))
    for x in range(1, 31, 3): t.set(x, 0, '#b8ac84'); t.set(x, 31, '#b8ac84')
    return t

def canopy():
    t = Px(32, 32); rng = R('CANOPY')
    t.rect(0, 0, 32, 32, LEAF[1])
    # clustered leaf blobs w/ highlights top-left of each, transparent gaps
    for _ in range(11):
        cx, cy, r = rng.random() * 32, rng.random() * 32, 4 + rng.random() * 5
        t.ell(cx, cy, r, r * .75, LEAF[2]); t.ell(cx - 1, cy - 1, r * .75, r * .55, LEAF[3]); t.ell(cx - 2, cy - 2, r * .4, r * .3, LEAF[4])
    for _ in range(80): t.set(int(rng.random() * 32), int(rng.random() * 32), rng.choice([LEAF[0], LEAF[5], LEAF[4]]))
    for _ in range(26): t.set(int(rng.random() * 32), int(rng.random() * 32), (0, 0, 0, 0))
    t.dither(0, 24, 32, 8, '#02050a', .35)
    return t

def build():
    fn = {
        'GRASS': lambda: grass('GRASS'), 'GRASS2': lambda: grass('GRASS2', True),
        'PATH': lambda: concrete('PATH'), 'PATHWET': lambda: concrete('PATHWET', True),
        'COURT': court, 'COURTH': lambda: court_line(True), 'COURTV': lambda: court_line(False),
        'WALL': lambda: wall_plaster('WALL'), 'WALLSTAIN': lambda: wall_plaster('WALLSTAIN', stain=True), 'WALLPEEL': lambda: wall_plaster('WALLPEEL', peel=True),
        'WINDOW': lambda: window(), 'WINDOWLIT': lambda: window(lit=True), 'WINDOWBROKEN': lambda: window(broken=True), 'WINDOWRAIN': lambda: window(rain=True),
        'DOOR': lambda: door(), 'DOORLOCK': lambda: door(True),
        'ROOF': lambda: roof_tin(False, True), 'ROOFEDGE': lambda: roof_tin(True, True), 'ROOFTIN': lambda: roof_tin(False, False), 'ROOFTINEDGE': lambda: roof_tin(True, False),
        'FENCE': fence, 'GATE': gate, 'FLOOR': lambda: floor_wood(), 'FLOORDARK': lambda: floor_wood(True),
        'FLOORCRACK': lambda: floor_variant('FLOORCRACK'), 'FLOORSTAIN': lambda: floor_variant('FLOORSTAIN'), 'FLOORTILE': floor_tile, 'LIBFLOOR': lib_floor,
        'PUDDLE': puddle, 'BED': bed, 'TRUNK': trunk, 'BUSH': bush, 'WALLBASE': lambda: wallbase(), 'WALLINTBASE': lambda: wallbase(True), 'STAIRS': stairs,
        'DESK': lambda: desk(0), 'DESK2': lambda: desk(1), 'DESK3': lambda: desk(2), 'BOARD': board, 'SHELF': lambda: shelf(False), 'LIBSHELF': lambda: shelf(True), 'READTABLE': read_table,
        'PILLAR': pillar, 'CANOPY': canopy, 'WALLINT': lambda: wall_plaster('WALLINT', interior=True), 'RUG': rug,
        'PATHCRACK': lambda: path_variant('PATHCRACK'), 'PATHLEAF': lambda: path_variant('PATHLEAF'), 'PATHMOSS': lambda: path_variant('PATHMOSS'), 'DRAIN': lambda: path_variant('DRAIN'),
    }
    cols = 10; rows = (len(NAMES) + cols - 1) // cols
    sheet = Px(cols * TILE, rows * TILE)
    for i, n in enumerate(NAMES):
        tile = fn[n]()
        sheet.im.alpha_composite(tile.im, ((i % cols) * TILE, (i // cols) * TILE))
    return sheet, cols

def write_ids_js(path, cols):
    lines = ['// AUTO-GENERATED by tools/art/gen_tiles.py - do not edit by hand.', '// Tile ids = frame index in assets/tilesets/tiles.png (Tiled gid = id + 1).', 'export const T = {']
    row = []
    for i, n in enumerate(NAMES):
        row.append(f'{n}: {i}')
        if len(row) == 8: lines.append('  ' + ', '.join(row) + ','); row = []
    if row: lines.append('  ' + ', '.join(row) + ',')
    lines += ['};', f'export const TILESET_COLS = {cols};', f'export const TILESET_COUNT = {len(NAMES)};', '']
    open(path, 'w').write('\n'.join(lines))
