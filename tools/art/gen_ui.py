"""UI frames, HUD icons, portraits and the layered title-screen art."""
import math, random
from pixel import Px, H, mix
from palette import *

def panel(kind='panel'):
    t = Px(24, 24)
    edge = {'panel': '#56628a', 'dialog': '#c9a45a', 'button': '#56628a', 'active': '#e8c46a', 'slot': '#3a4468', 'slotsel': '#e8c46a'}[kind]
    fill = {'panel': '#0e1424', 'dialog': '#0b1020', 'button': '#141a2e', 'active': '#2b3a6a', 'slot': '#0b101e', 'slotsel': '#1b2646'}[kind]
    t.rect(0, 0, 24, 24, fill)
    t.dither(1, 1, 22, 22, mix(fill, '#000', .5), .12)
    t.rect(2, 2, 20, 20, fill)
    for (x, y, w, h) in ((2, 0, 20, 1), (2, 23, 20, 1), (0, 2, 1, 20), (23, 2, 1, 20)): t.rect(x, y, w, h, edge)
    for (x, y) in ((1, 1), (22, 1), (1, 22), (22, 22)): t.set(x, y, edge)
    inner = mix(edge, '#000', .55)
    for (x, y, w, h) in ((2, 1, 20, 1), (2, 22, 20, 1), (1, 2, 1, 20), (22, 2, 1, 20)): t.rect(x, y, w, h, inner)
    for (x, y) in ((2, 2), (21, 2), (2, 21), (21, 21)): t.set(x, y, mix(edge, '#fff', .3))
    return t

def heart(full=True, beat=0):
    t = Px(16, 16)
    rows = ['0011001100', '0111111110', '1111111111', '1111111111', '0111111110', '0011111100', '0001111000', '0000110000']
    big = ['0111001110', '1111111111', '1111111111', '1111111111', '0111111110', '0011111100', '0001111000', '0000110000']
    pat = big if beat else rows
    for y, r in enumerate(pat):
        for x, v in enumerate(r):
            if v == '1':
                px, py = 3 + x - (0), 3 + y
                c = '#d02a3a' if full else '#2c2030'
                if full:
                    c = '#ff6a78' if (x < 4 and y < 3) else '#8a1426' if (y > 4 or x > 7) else '#d02a3a'
                t.set(px, py, c)
    t.set(5, 5, '#ffd0d6') if full else None
    return t.outline('#0a0610')

def flash_icon():
    t = Px(24, 24); t.rect(2, 9, 12, 7, '#59607a'); t.rect(2, 9, 12, 2, '#9aa4c0'); t.rect(2, 15, 12, 1, '#2a3040'); t.rect(14, 7, 5, 11, '#8890ab'); t.rect(14, 7, 5, 2, '#cfd6e4'); t.rect(19, 8, 3, 9, '#ffe9a0'); t.set(20, 10, '#fff')
    t.rect(5, 11, 5, 2, '#2a3040'); return t.outline(OUT)

def bar_frame(w, h):
    t = Px(w, h); t.rect(0, 0, w, h, '#05070f'); t.rect(1, 1, w - 2, h - 2, '#262c44'); t.rect(2, 2, w - 4, h - 4, '#0a0e1a')
    t.hline(1, 1, w - 2, '#56628a'); return t

def bar_fill(c1, c2):
    t = Px(4, 8)
    for y in range(8): t.hline(0, y, 4, c1 if y < 3 else c2 if y < 6 else mix(c2, '#000', .35))
    t.hline(0, 0, 4, mix(c1, '#fff', .35)); return t

def portrait(scared=False):
    t = Px(48, 48); t.rect(0, 0, 48, 48, '#141c34'); t.dither(0, 0, 48, 48, '#0a0f20', .35)
    t.rect(0, 40, 48, 8, '#0a0f20')
    # shoulders / white shirt + collar
    t.rect(8, 38, 32, 10, UNI[2]); t.rect(8, 38, 32, 2, UNI[3]); t.vline(8, 38, 10, UNI[1]); t.vline(39, 38, 10, UNI[0]); t.rect(19, 38, 10, 4, SKIN[3]); t.rect(21, 41, 6, 1, SKIN[2])
    t.rect(21, 36, 6, 4, SKIN[2])
    # face
    t.rect(12, 12, 24, 26, SKIN[3]); t.rect(13, 11, 22, 1, SKIN[3]); t.rect(14, 38, 20, 1, SKIN[2]); t.vline(35, 14, 22, SKIN[2]); t.vline(12, 14, 20, SKIN[4])
    t.rect(10, 15, 3, 8, SKIN[2]); t.rect(35, 15, 3, 8, SKIN[2])   # ears
    # hair
    t.rect(10, 6, 28, 11, HAIR[1]); t.rect(12, 4, 24, 4, HAIR[1]); t.rect(9, 12, 5, 12, HAIR[1]); t.rect(34, 12, 5, 12, HAIR[1]); t.rect(14, 15, 9, 3, HAIR[0]); t.rect(26, 14, 8, 2, HAIR[0])
    for (x, y) in ((16, 6), (17, 5), (22, 7), (30, 6)): t.set(x, y, HAIR[3])
    t.hline(14, 8, 8, HAIR[3])
    if scared:
        for ex in (17, 28): t.rect(ex, 21, 6, 7, '#f4f6ff'); t.rect(ex + 2, 22, 3, 5, '#07080f'); t.set(ex + 3, 23, '#fff')
        t.hline(16, 18, 7, HAIR[0]); t.hline(27, 17, 7, HAIR[0]); t.rect(21, 32, 6, 4, '#3a0f14'); t.rect(22, 32, 4, 1, '#c8d0e0'); t.rect(15, 28, 2, 1, '#9fc4ea'); t.set(36, 18, '#9fc4ea'); t.set(36, 19, '#9fc4ea')
    else:
        for ex in (18, 28): t.rect(ex, 22, 4, 4, '#07080f'); t.set(ex, 22, '#4a5a80'); t.hline(ex - 1, 20, 6, HAIR[0])
        t.rect(21, 28, 5, 2, SKIN[2]); t.rect(20, 33, 8, 1, SKIN[1]); t.rect(14, 29, 3, 2, SKIN[4]); t.rect(31, 29, 3, 2, SKIN[4])
    return t.outline(OUT)

# ---------------------------------------------------------------- title screen layers (480x270 native)
def menu_sky():
    t = Px(480, 270); rng = random.Random(7)
    top, bot = H('#05070f'), H('#1b2650')
    B = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
    steps = 9
    for y in range(270):
        k = y / 270; q = k * steps; lo = int(q)
        for x in range(480):
            lv = lo + (1 if (q - lo) * 16 > B[y % 4][x % 4] else 0)
            t.set(x, y, mix(top, bot, min(1, lv / steps)))
    for _ in range(90): t.set(rng.random() * 480, rng.random() * 150, rng.choice(['#6a78a8', '#9aa8d8', '#4a5688', '#dfe6ff']))
    # moon with craters + halo ring dither
    mx, my = 395, 48
    for y in range(-30, 31):
        for x in range(-30, 31):
            d = math.hypot(x, y)
            if 16 < d < 28 and B[(my + y) % 4][(mx + x) % 4] < (28 - d) / 12 * 16 * .5: t.set(mx + x, my + y, '#27346a')
    t.ell(mx, my, 16, 16, '#dfe6ff'); t.ell(mx - 2, my - 2, 14, 14, '#eef2ff'); 
    for (cx, cy, r) in ((mx - 5, my - 4, 3), (mx + 6, my + 5, 4), (mx + 2, my - 8, 2)): t.ell(cx, cy, r, r, '#b8c4e8')
    t.ell(mx + 4, my + 3, 13, 13, None)
    # drifting cloud bands (dithered)
    for (cy, a) in ((70, .5), (96, .35), (40, .3)):
        for x in range(480):
            h = int(math.sin(x * .03 + cy) * 4 + math.sin(x * .09) * 2)
            for y in range(cy + h - 6, cy + h + 6):
                dd = abs(y - cy - h) / 6.0
                if B[y % 4][x % 4] < (1 - dd) * 16 * a: t.set(x, y, '#0e1530' if (x // 7 + y // 3) % 2 else '#16204a')
    return t

def menu_trees():
    t = Px(480, 270); rng = random.Random(21)
    for x in range(0, 480, 2):
        h = 20 + math.sin(x * .05) * 8 + math.sin(x * .13) * 5
        for y in range(int(190 - h), 220): t.set(x, y, '#060a14'); t.set(x + 1, y, '#060a14')
    # banyan silhouette on the left with hanging roots
    for _ in range(46):
        cx, cy, r = 70 + rng.gauss(0, 30), 150 + rng.gauss(0, 18), 12 + rng.random() * 14
        t.ell(cx, cy, r, r * .8, '#071410'); t.ell(cx - 2, cy - 3, r * .6, r * .45, '#0b1e17')
    t.rect(64, 160, 12, 60, '#050b08')
    for _ in range(26):
        x = 30 + rng.random() * 90; t.vline(x, 170, 10 + rng.random() * 30, '#050b08')
    return t

def menu_school():
    t = Px(480, 270); rng = random.Random(3)
    BL, BM, BH = '#0a0f1f', '#10172e', '#18213f'
    # main two-storey block
    t.rect(190, 138, 220, 82, BM); t.rect(190, 138, 220, 2, BH); t.rect(190, 218, 220, 2, BL)
    for x in range(190, 410, 22): t.vline(x, 140, 78, BL)
    # tin roof (corrugated) with eave
    for y in range(112, 140):
        k = (y - 112) / 28; x0 = int(180 - k * 10) if False else 176; x1 = 424
        for x in range(x0, x1): t.set(x, y, '#1a1428' if x % 4 < 2 else '#120d1f')
    t.rect(176, 138, 248, 4, '#06070e'); t.rect(176, 112, 248, 1, '#2a2040')
    # centre clock tower / gable
    t.rect(286, 84, 48, 56, BM); t.rect(286, 84, 48, 2, BH)
    for y in range(66, 86):
        k = (86 - y) / 20; w = int(26 - k * 20)
        t.hline(310 - w, y, w * 2, '#150f22')
    t.ell(310, 104, 8, 8, '#cfd6e4'); t.ell(310, 104, 7, 7, '#9aa4c0'); t.line(310, 104, 310, 99, '#07080f'); t.line(310, 104, 314, 106, '#07080f')
    # flagpole
    t.vline(250, 70, 150, '#232c4a'); t.rect(251, 72, 14, 9, '#0f2a14')
    # windows (dark) – the lit ones are separate sprites so they can flicker
    for row, y in enumerate((150, 186)):
        for i in range(8):
            x = 200 + i * 25
            t.rect(x, y, 14, 20, '#02040a'); t.rect(x + 1, y + 1, 12, 18, '#0c1630'); t.vline(x + 7, y, 20, '#02040a'); t.hline(x, y + 9, 14, '#02040a'); t.hline(x - 1, y + 20, 16, BH)
    # door + steps
    t.rect(300, 196, 20, 24, '#03050c'); t.rect(298, 220, 24, 2, BH); t.rect(296, 222, 28, 2, BM)
    # side wings
    t.rect(70, 170, 100, 50, BM); t.rect(70, 170, 100, 2, BH)
    for y in range(158, 172):
        for x in range(64, 176): t.set(x, y, '#150f22' if x % 4 < 2 else '#100b1c')
    for i in range(4): t.rect(84 + i * 22, 184, 12, 16, '#0c1630'); t.rect(84 + i * 22, 184, 12, 1, BH)
    t.rect(430, 176, 50, 44, BM); t.rect(430, 176, 50, 2, BH)
    for y in range(166, 178):
        for x in range(426, 480): t.set(x, y, '#150f22' if x % 4 < 2 else '#100b1c')
    # fence + ground silhouette
    t.rect(0, 220, 480, 50, '#05070f')
    for x in range(0, 480, 7): t.rect(x, 208, 2, 14, '#0a0f1f'); t.set(x, 207, '#1c2440')
    t.hline(0, 212, 480, '#0a0f1f'); t.hline(0, 218, 480, '#0a0f1f')
    return t

def menu_window(lit):
    t = Px(12, 18)
    if lit: t.rect(0, 0, 12, 18, '#f0c05a'); t.rect(0, 0, 12, 6, '#ffe39a'); t.rect(5, 0, 2, 18, '#7a5a1e'); t.rect(0, 8, 12, 1, '#7a5a1e')
    return t

def menu_ground():
    t = Px(480, 60); rng = random.Random(5)
    for y in range(60):
        for x in range(480): t.set(x, y, mix('#0a1020', '#05070f', y / 60))
    for _ in range(14):    # puddle slivers reflecting the sky
        x, y, w = rng.random() * 460, 8 + rng.random() * 40, 12 + rng.random() * 30; t.hline(x, y, w, '#26356a'); t.hline(x + 2, y + 1, w - 5, '#1a2650')
    return t

def vignette():
    t = Px(480, 270); B = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
    for y in range(270):
        for x in range(480):
            d = math.hypot((x - 240) / 240, (y - 135) / 135)
            v = max(0, (d - .62) / .55); 
            if v > 0 and B[y % 4][x % 4] < min(1, v) * 16: t.set(x, y, (150, 10, 20, int(min(1, v) * 200)))
    return t

def build():
    d = {'ui_panel': panel('panel'), 'ui_dialog': panel('dialog'), 'ui_button': panel('button'), 'ui_button_active': panel('active'), 'ui_slot': panel('slot'), 'ui_slot_sel': panel('slotsel'),
         'ui_heart': heart(True), 'ui_heart_big': heart(True, 1), 'ui_heart_empty': heart(False), 'ui_flash': flash_icon(),
         'ui_bar_frame': bar_frame(104, 14), 'ui_bar_green': bar_fill('#3ad06a', '#22a04a'), 'ui_bar_amber': bar_fill('#f0c050', '#b88a28'), 'ui_bar_red': bar_fill('#e0505a', '#a02a34'), 'ui_bar_blue': bar_fill('#6aa0ff', '#3a6ad0'),
         'portrait': portrait(), 'portrait_scared': portrait(True), 'win_lit': menu_window(True)}
    return d, {'menu_sky': menu_sky(), 'menu_trees': menu_trees(), 'menu_school': menu_school(), 'menu_ground': menu_ground(), 'vignette': vignette()}
