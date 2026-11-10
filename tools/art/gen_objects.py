"""Objects, furniture, items, effects and UI sprites. Everything is returned as {name: Px}."""
import math, random
from pixel import Px, H, mix
from palette import *

def clump(t, rng, cx, cy, r, ramp, hi=True):
    t.ell(cx, cy, r, r * .78, ramp[0]); t.ell(cx - 1, cy - 1, r * .88, r * .66, ramp[1]); t.ell(cx - 2, cy - 2, r * .6, r * .42, ramp[2])
    if hi:
        for _ in range(int(r)): t.set(cx - r * .6 + rng.random() * r, cy - r * .55 + rng.random() * r * .45, ramp[3])
    # ragged leaf tips on the rim
    for _ in range(int(r * 1.4)):
        a = rng.random() * 6.283; x = cx + math.cos(a) * r; y = cy + math.sin(a) * r * .78
        t.rect(x, y, 2, 2, ramp[0]); t.set(x, y, ramp[1])

def banyan():
    rng = random.Random(4242); back = Px(448, 300); front = Px(448, 300)
    def pt(spread): a = rng.random() * 6.283; r = math.sqrt(rng.random()) * spread; return 224 + math.cos(a) * r * 190, 140 + math.sin(a) * r * 105
    for _ in range(95): x, y = pt(1.0); clump(back, rng, x, y, 18 + rng.random() * 22, [LEAF[0], LEAF[1], LEAF[2], LEAF[3]], hi=False)
    for _ in range(120): x, y = pt(.95); clump(front, rng, x, y - 6, 9 + rng.random() * 16, [LEAF[1], LEAF[2], LEAF[3], LEAF[4]])
    for _ in range(70): x, y = pt(.78); clump(front, rng, x - 18, y - 24, 5 + rng.random() * 9, [LEAF[3], LEAF[4], LEAF[5], '#5aa066'])
    # warm stray light speckle (window glow filtering through leaves)
    for _ in range(36): x, y = pt(.7); front.set(x, y, '#b8ac5a')
    # aerial roots dangling from the lower edge (separate so they can sway)
    roots = Px(448, 300)
    for _ in range(34):
        x = 50 + rng.random() * 350; edge = 140 + math.sqrt(max(0, 1 - ((x - 224) / 190) ** 2)) * 105
        ln = 14 + rng.random() * 40; sw = (rng.random() - .5) * 8
        for k in range(int(ln)):
            xx = x + sw * k / ln; yy = edge - 4 + k
            if yy < 298: roots.set(xx, yy, SOIL[3] if k % 5 else SOIL[2]); roots.set(xx + 1, yy, SOIL[1])
    back.outline('#02050a'); front.outline('#02050a') if False else None
    return {'banyan_back': back, 'banyan_front': front, 'banyan_roots': roots}

def pole_lamp():
    t = Px(32, 64)
    for y in range(12, 63): t.set(14, y, IRON[3]); t.set(15, y, IRON[2]); t.set(16, y, IRON[1]); t.set(17, y, IRON[0])
    t.rect(11, 56, 10, 6, IRON[1]); t.rect(11, 56, 10, 1, IRON[3]); t.rect(9, 61, 14, 3, IRON[0]); t.hline(9, 61, 14, IRON[2])
    t.rect(5, 1, 22, 4, IRON[2]); t.hline(5, 1, 22, IRON[4]); t.rect(8, 5, 16, 2, IRON[1]); t.rect(13, 6, 6, 3, IRON[2])    # hood
    t.rect(10, 7, 12, 8, LAMP[1]); t.rect(11, 8, 10, 6, LAMP[3]); t.rect(13, 9, 6, 3, LAMP[4]); t.hline(10, 7, 12, IRON[3]); t.vline(10, 7, 8, IRON[2]); t.vline(21, 7, 8, IRON[0])
    t.rect(7, 13, 18, 2, IRON[1]); t.hline(7, 13, 18, IRON[3])
    for k in range(3): t.set(12 + k * 3, 16, (255, 220, 140, 120))
    return t.outline(OUT)

def hoop():
    t = Px(32, 64)
    for y in range(16, 62): t.set(14, y, IRON[4]); t.set(15, y, IRON[3]); t.set(16, y, IRON[2]); t.set(17, y, IRON[0])
    t.rect(11, 58, 10, 4, IRON[1]); t.hline(11, 58, 10, IRON[3])
    t.rect(3, 1, 26, 17, '#aeb8d0'); t.rect(3, 1, 26, 1, '#e0e8f8'); t.rect(3, 17, 26, 1, '#6a7490'); t.vline(3, 1, 17, '#6a7490'); t.vline(28, 1, 17, '#8a94b0')
    t.rect(11, 8, 10, 7, '#aeb8d0'); t.rect(11, 8, 10, 1, RED[2]); t.rect(11, 14, 10, 1, RED[2]); t.vline(11, 8, 7, RED[2]); t.vline(20, 8, 7, RED[2])
    for _ in range(14): t.set(4 + int(random.random() * 24), 2 + int(random.random() * 15), RUST[int(random.random() * 3)])
    t.ell(16, 20, 7, 2, '#c8552a'); t.ell(16, 20, 5, 1, None)
    for i in range(6): t.line(10 + i * 2, 21, 12 + i * 1.6, 29, '#8890ab')   # net strands
    t.hline(12, 25, 8, '#8890ab')
    return t.outline(OUT)

def flagpole():
    t = Px(32, 128)
    for y in range(8, 122): t.set(7, y, '#dde4f4'); t.set(8, y, '#9aa4c0'); t.set(9, y, '#566080')
    t.ell(8, 5, 3, 3, LAMP[2]); t.set(7, 4, LAMP[4])
    t.rect(2, 120, 14, 6, CONC[4]); t.rect(2, 120, 14, 1, CONC[5]); t.rect(4, 126, 10, 2, CONC[0])
    t.rect(8, 40, 2, 2, IRON[1]); t.rect(8, 80, 2, 2, IRON[1])   # rope cleats
    return t.outline(OUT)

def flag_frames():
    out = {}
    for f in range(4):
        t = Px(24, 16)
        for x in range(22):
            wv = int(math.sin(f * 1.57 + x * .45) * (1 + x * .07)); 
            for y in range(14):
                c = '#f4c820' if y < 5 else '#2fa63a' if y < 10 else '#d83040'
                shade = 0.18 if (x // 3 + f) % 2 else 0
                col = mix(c, '#000000', shade)
                t.set(x + 1, y + 1 + wv, col)
        # star
        sx, sy = 10, 8 + int(math.sin(f * 1.57 + 10 * .45) * 1.7)
        for dx, dy in ((0, -2), (0, 2), (-2, 0), (2, 0), (0, 0), (1, 1), (-1, 1), (1, -1), (-1, -1)): t.set(sx + dx, sy + dy, '#ffffff')
        out[f'flag_{f}'] = t
    return out

def bench():
    t = Px(52, 28)
    t.ell(26, 25, 24, 2.5, (0, 0, 0, 80))
    t.rect(4, 14, 4, 12, IRON[1]); t.rect(44, 14, 4, 12, IRON[1]); t.vline(4, 14, 12, IRON[3]); t.vline(44, 14, 12, IRON[3])
    t.rect(2, 4, 48, 5, WOOD[3]); t.rect(2, 4, 48, 1, WOOD[5]); t.rect(2, 8, 48, 1, WOOD[0])   # backrest slats
    t.rect(2, 12, 48, 6, WOOD[2]); t.rect(2, 12, 48, 1, WOOD[4]); t.rect(2, 17, 48, 1, WOOD[0]); t.hline(2, 18, 48, '#02030a')
    for x in range(5, 48, 11): t.vline(x, 4, 14, WOOD[0])
    for _ in range(26): t.set(3 + int(random.random() * 46), 5 + int(random.random() * 12), WOOD[1])
    return t.outline(OUT)

def pot(kind):
    t = Px(18, 24)
    t.ell(9, 22, 8, 2, (0, 0, 0, 80))
    t.rect(3, 12, 12, 10, ['#8a4a2a', '#4a6a80'][kind]); t.rect(3, 12, 12, 2, ['#b0663a', '#6a8aa0'][kind]); t.vline(3, 12, 10, ['#b0663a', '#6a8aa0'][kind]); t.vline(14, 12, 10, ['#5a2e1a', '#2e4a60'][kind]); t.hline(3, 21, 12, ['#3a1c10', '#1e3040'][kind])
    t.rect(2, 10, 14, 3, ['#9a5a34', '#5a7a90'][kind]); t.hline(2, 10, 14, ['#c07a46', '#8aaac0'][kind])
    rng = random.Random(kind + 3)
    if kind == 0:
        for (x, y, c) in [(5, 4, '#c85a78'), (9, 2, '#e8b030'), (12, 5, '#c85a78')]:
            t.vline(x, y + 2, 8, GRASS[4]); t.rect(x - 1, y, 3, 3, c); t.set(x, y + 1, LAMP[4])
        for _ in range(10): t.set(4 + int(rng.random() * 10), 6 + int(rng.random() * 5), GRASS[3])
    else:
        for k in range(7): t.line(9, 10, 3 + k * 2, 1 + abs(k - 3), GRASS[4] if k % 2 else GRASS[3]); t.line(10, 10, 4 + k * 2, 2 + abs(k - 3), GRASS[2])
    return t.outline(OUT)

def bin_():
    t = Px(18, 24); t.ell(9, 22, 8, 2, (0, 0, 0, 80))
    t.rect(3, 6, 12, 16, '#2c4a44'); t.rect(3, 6, 12, 2, '#4a7a70'); t.vline(3, 6, 16, '#3c6a60'); t.vline(14, 6, 16, '#1a2e2a'); t.rect(2, 4, 14, 3, '#3a5a54'); t.hline(2, 4, 14, '#6a9a90')
    for x in (6, 9, 12): t.vline(x, 9, 11, '#1a2e2a')
    t.rect(7, 2, 4, 2, IRON[3]); t.set(12, 2, '#cfd6e4'); t.set(4, 3, '#cfd6e4')   # crumpled litter at the rim
    return t.outline(OUT)

def fan_frames():
    out = {}
    for f in range(4):
        t = Px(48, 48); a0 = f * 30 * math.pi / 180
        for b in range(3):
            a = a0 + b * 2 * math.pi / 3
            for k in range(6, 22):
                for w in range(-5, 6):
                    x = 24 + math.cos(a) * k + math.cos(a + 1.57) * w * (1 + k * .06); y = 24 + math.sin(a) * k * .8 + math.sin(a + 1.57) * w * .8 * (1 + k * .06)
                    t.set(x, y, '#3a3a50' if w >= 0 else '#56566e')
            t.line(24 + math.cos(a) * 8, 24 + math.sin(a) * 6.4, 24 + math.cos(a) * 21, 24 + math.sin(a) * 16.8, '#8a8aa8')
        t.ell(24, 24, 5, 4, '#1a1a24'); t.ell(24, 24, 3, 2.5, '#3c3c50'); t.set(23, 23, '#8a8aa8')
        t.rect(23, 20, 2, 1, '#8890ab')
        # motion shimmer
        for _ in range(30): t.set(24 + random.Random(f * 31 + _).gauss(0, 9), 24 + random.Random(f * 17 + _).gauss(0, 7), (80, 80, 110, 90))
        out[f'fan_{f}'] = t
    return out

def curtain_frames():
    out = {}
    for f in range(4):
        t = Px(30, 44)
        t.rect(0, 0, 30, 3, IRON[3]); t.hline(0, 0, 30, IRON[4])        # rail
        for side in (0, 1):
            for y in range(3, 42):
                k = (y - 3) / 38; sway = int(math.sin(f * 1.57 + y * .18) * (1 + k * 3)) * (1 if side == 0 else -1)
                w = 8 + int(k * 2)
                x0 = (0 if side == 0 else 30 - w) + sway * (0 if (side == 0 and sway < 0) or (side == 1 and sway > 0) else 1)
                for x in range(w):
                    c = '#5a2a3a' if (x + y // 6) % 4 < 2 else '#7a3a4a'
                    if x == 0 or x == w - 1: c = '#3a1824'
                    t.set(x0 + x, y, c)
        out[f'curtain_{f}'] = t.outline(OUT)
    return out

def small_props():
    d = {}
    # wall clock
    t = Px(18, 18); t.ell(9, 9, 8, 8, IRON[0]); t.ell(9, 9, 7, 7, '#d8deee'); t.ell(9, 9, 6, 6, '#b8c0d6')
    for a in range(12): t.set(9 + math.cos(a * .5236) * 5.5, 9 + math.sin(a * .5236) * 5.5, '#2a2f44')
    t.line(9, 9, 9, 4, '#07080f'); t.line(9, 9, 12, 11, '#07080f'); t.set(9, 9, RED[2]); t.hline(4, 2, 10, IRON[3]); d['clock'] = t
    # calendar with a date circled in red
    t = Px(16, 20); t.rect(0, 0, 16, 20, '#c8c0a0'); t.rect(0, 0, 16, 5, RED[2]); t.hline(0, 0, 16, RED[3]); t.rect(7, 0, 2, 2, IRON[1])
    for yy in range(7, 18, 3):
        for xx in range(2, 14, 3): t.set(xx, yy, '#4a4438')
    t.ell(8, 13, 2.2, 2, None); t.hline(6, 12, 5, RED[2]); t.hline(6, 15, 5, RED[2]); t.vline(5, 12, 4, RED[2]); t.vline(11, 12, 4, RED[2]); d['calendar'] = t.outline(OUT)
    # torn poster
    t = Px(22, 28); t.rect(0, 0, 22, 28, '#a09478'); t.rect(2, 2, 18, 12, '#2f4a7a'); t.rect(4, 4, 14, 8, '#4a6aa8'); t.ell(11, 8, 3, 3, '#d8c070')
    for y in range(17, 25, 3): t.hline(3, y, 16 - (y % 5), '#4a4438')
    for (x, y) in [(15, 20), (17, 22), (18, 24), (13, 24), (19, 26)]: t.rect(x, y, 5, 5, None)
    for k in range(6): t.set(19 - k, 27 - k, None); t.set(20 - k, 27 - k, None)
    t.rect(10, 0, 2, 2, RED[2]); d['poster'] = t.outline(OUT)
    # pinned timetable
    t = Px(20, 26); t.rect(0, 0, 20, 26, PAPER[3]); t.rect(0, 0, 20, 2, PAPER[1])
    for y in range(5, 24, 3): t.hline(2, y, 16, '#4a4438')
    for x in (7, 13): t.vline(x, 4, 20, '#6a5a44')
    t.rect(2, 20, 5, 2, RED[2]); t.rect(9, 8, 4, 2, RED[2]); t.rect(9, 0, 2, 2, RED[2]); d['timetable'] = t.outline(OUT)
    # cracked mirror
    t = Px(18, 28); t.rect(0, 0, 18, 28, IRON[1]); t.rect(2, 2, 14, 24, '#3c5280'); t.rect(3, 3, 5, 10, '#5f7cb0')
    for pts in [((9, 2), (7, 12), (11, 20), (6, 26)), ((7, 12), (2, 15)), ((11, 20), (16, 17))]:
        for (a, b) in zip(pts, pts[1:]): t.line(*a, *b, '#cfe2ff')
    d['mirror'] = t.outline(OUT)
    # school bag, books, papers, chalk pieces
    t = Px(20, 16); t.ell(10, 14, 8, 2, (0, 0, 0, 80)); t.rect(3, 3, 14, 11, BAG_[1]); t.rect(3, 3, 14, 2, BAG_[3]); t.rect(6, 8, 8, 5, BAG_[2]); t.rect(9, 9, 2, 2, LAMP[2]); t.rect(6, 1, 8, 3, BAG_[0]); d['bag'] = t.outline(OUT)
    t = Px(20, 14); t.ell(10, 12, 9, 2, (0, 0, 0, 80))
    for i, (c, w) in enumerate([('#6a2a30', 16), ('#2f4a7a', 15), ('#4a6a30', 17)]): t.rect(2, 8 - i * 3, w, 3, c); t.hline(2, 8 - i * 3, w, mix(c, '#fff', .3)); t.hline(3, 9 - i * 3, w - 3, PAPER[3])
    d['books'] = t.outline(OUT)
    t = Px(26, 18); rng = random.Random(8)
    for i in range(5): 
        x, y = 2 + i * 4, 3 + (i * 5) % 9; a = rng.random(); t.rect(x, y, 9, 6, PAPER[3 - (i % 2)]); t.hline(x, y, 9, PAPER[4]); t.hline(x + 1, y + 2, 6, '#6a5a44'); t.hline(x + 1, y + 4, 4, '#6a5a44')
    d['papers'] = t.outline(OUT, False)
    t = Px(14, 8); t.rect(1, 3, 5, 3, UNI[3]); t.rect(8, 4, 4, 3, LAMP[3]); t.rect(2, 1, 3, 2, UNI[2]); d['chalk'] = t.outline(OUT)
    # exit/emergency lights
    t = Px(26, 12); t.rect(0, 0, 26, 12, '#0e3a24'); t.rect(1, 1, 24, 10, '#1d8a4a'); t.rect(2, 2, 22, 8, '#2dd070')
    t.rect(4, 4, 3, 5, '#07351c'); t.rect(8, 4, 3, 1, '#07351c'); t.rect(8, 6, 2, 1, '#07351c'); t.rect(8, 8, 3, 1, '#07351c'); t.rect(13, 4, 2, 5, '#07351c'); t.rect(17, 4, 4, 1, '#07351c'); t.rect(18, 5, 2, 4, '#07351c'); d['exit_sign'] = t
    t = Px(14, 10); t.rect(0, 3, 14, 7, IRON[1]); t.rect(2, 0, 10, 5, RED[2]); t.rect(3, 1, 8, 3, RED[3]); t.set(4, 1, '#ffd0d0'); t.hline(0, 3, 14, IRON[3]); d['emergency_light'] = t.outline(OUT)
    # fluorescent fixtures (on + dim)
    for name, a, b in (('tube_on', '#eaf4ff', '#9ac0e8'), ('tube_dim', '#5a6a80', '#2a3448')):
        t = Px(36, 10); t.rect(0, 3, 36, 7, IRON[2]); t.hline(0, 3, 36, IRON[4]); t.rect(2, 4, 32, 4, b); t.rect(3, 5, 30, 2, a); t.rect(0, 0, 2, 4, IRON[1]); t.rect(34, 0, 2, 4, IRON[1]); d[name] = t.outline(OUT)
    # sign board 9-slice-ish
    return d
BAG_ = ['#10213f', '#1c3868', '#2c5596', '#4a7ac8']

def items():
    d = {}
    t = Px(32, 32); t.ell(16, 27, 11, 2.5, (0, 0, 0, 90))
    t.ell(10, 14, 7, 7, LAMP[2]); t.ell(10, 14, 5.5, 5.5, LAMP[1]); t.ell(10, 14, 4, 4, '#02030a'); t.ell(10, 14, 6.5, 6.5, None)
    for y in range(8, 21):
        for x in range(3, 18):
            if 4.4 < math.hypot(x - 10, y - 14) < 7.2: t.set(x, y, LAMP[3] if x + y < 24 else LAMP[1])
    t.rect(16, 12, 14, 4, LAMP[2]); t.hline(16, 12, 14, LAMP[4]); t.hline(16, 15, 14, LAMP[0]); t.rect(22, 16, 3, 5, LAMP[2]); t.rect(27, 16, 3, 4, LAMP[2]); t.vline(22, 16, 5, LAMP[1])
    t.set(7, 10, LAMP[4]); t.set(8, 9, '#ffffff'); d['item_key'] = t.outline(OUT)
    t = Px(32, 32); t.ell(16, 27, 11, 2.5, (0, 0, 0, 90)); t.rect(7, 5, 18, 22, '#16294a'); t.rect(7, 5, 18, 22, '#1f3a6a'); t.rect(7, 5, 2, 22, '#101e38'); t.rect(9, 6, 15, 20, PAPER[4]); t.rect(9, 6, 15, 1, '#fff'); t.rect(9, 25, 15, 1, PAPER[1])
    t.rect(11, 9, 11, 5, '#2f4a7a'); t.hline(12, 10, 8, '#8aaad8')
    for y in range(16, 24, 2): t.hline(11, y, 11 - (y % 3), '#9a8f70')
    t.rect(15, 3, 3, 3, RED[2]); d['item_notebook'] = t.outline(OUT)
    t = Px(32, 32); t.ell(16, 27, 11, 2.5, (0, 0, 0, 90)); t.rect(6, 9, 20, 14, '#1a1d2a'); t.rect(6, 9, 20, 2, '#3a3f55'); t.rect(8, 11, 12, 10, '#2fb858'); t.rect(8, 11, 12, 2, '#6ae890'); t.rect(26, 13, 3, 6, '#b8c0d6'); t.rect(26, 13, 3, 1, '#fff')
    t.rect(10, 14, 2, 4, '#07351c'); t.set(11, 14, '#fff'); d['item_battery'] = t.outline(OUT)
    t = Px(32, 32); t.ell(16, 27, 11, 2.5, (0, 0, 0, 90)); t.rect(7, 5, 18, 22, PAPER[3]); t.rect(7, 5, 18, 2, PAPER[4]); t.rect(7, 25, 18, 2, PAPER[1]); t.vline(7, 5, 22, PAPER[2]); t.vline(24, 5, 22, PAPER[1])
    for y in range(10, 24, 3): t.hline(10, y, 12 - (y % 5), '#6a5a44')
    for k in range(5): t.set(22 - k, 26 - k, None); t.set(23 - k, 26 - k, None)
    t.rect(10, 8, 3, 2, RED[2]); d['item_note'] = t.outline(OUT)
    t = Px(32, 32); t.ell(16, 27, 11, 2.5, (0, 0, 0, 90)); t.rect(5, 8, 22, 17, '#4a1a30'); t.rect(5, 8, 22, 2, '#7a2a50'); t.rect(7, 10, 18, 14, PAPER[3]); t.vline(16, 10, 14, PAPER[1])
    for y in range(12, 22, 3): t.hline(8, y, 7, '#6a5a44'); t.hline(18, y, 6, '#6a5a44')
    t.rect(21, 7, 2, 6, RED[2]); d['item_book'] = t.outline(OUT)
    return d

def effects():
    d = {}
    for i, (w, h) in enumerate(((1, 4), (1, 6), (2, 8))):
        t = Px(w + 2, h + 1); [t.set(1 + x, y, (190 + y * 4, 215 + y * 3, 255, 70 + y * 20)) for x in range(w) for y in range(h)]; d[f'rain_{i}'] = t
    for f in range(4):    # splash: little crown of droplets
        t = Px(12, 8); r = 1 + f * 1.4; a = 220 - f * 45
        for k in range(5):
            ang = 3.14 * (k + .5) / 5; x = 6 + math.cos(ang) * r * 1.6; y = 6 - math.sin(ang) * r * (1.3 - f * .12)
            t.set(x, y, (200, 224, 255, a))
        if f < 2: t.hline(5, 6, 3, (160, 190, 235, 200))
        d[f'splash_{f}'] = t
    for f in range(5):    # ripple rings
        t = Px(30, 14); rx = 3 + f * 2.6; ry = 1.5 + f * 1.1; a = 210 - f * 40
        for k in range(48):
            ang = k * 6.283 / 48; t.set(15 + math.cos(ang) * rx, 7 + math.sin(ang) * ry, (150, 190, 240, a))
        d[f'ripple_{f}'] = t
    for f in range(3):
        t = Px(4, 8); y = 1 + f * 2; t.set(1, y, (170, 205, 255, 230)); t.set(1, y + 1, (130, 170, 230, 200)); d[f'drip_{f}'] = t
    t = Px(3, 3); t.rect(0, 0, 2, 2, (220, 230, 255, 150)); d['dust_0'] = t
    t = Px(3, 3); t.set(1, 1, (255, 240, 200, 220)); t.set(0, 1, (255, 240, 200, 90)); t.set(2, 1, (255, 240, 200, 90)); t.set(1, 0, (255, 240, 200, 90)); t.set(1, 2, (255, 240, 200, 90)); d['dust_1'] = t
    for k, c in enumerate(('#4a3a1e', '#5d4a22', '#3b4a22')):
        t = Px(7, 5); t.rect(1, 1, 5, 3, c); t.set(0, 2, c); t.set(6, 2, mix(c, '#000', .3)); t.hline(1, 2, 5, mix(c, '#fff', .2)); d[f'leaf_{k}'] = t
    for f in range(4):
        t = Px(9, 9); s = [1, 3, 4, 2][f]; t.set(4, 4, '#fff8d8')
        for k in range(1, s + 1): [t.set(4 + dx * k, 4 + dy * k, (255, 240, 180, 255 - k * 50)) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
        d[f'sparkle_{f}'] = t

    # grass tufts leaning left / upright / right, for swaying grass
    for f, lean in enumerate((-2, 0, 2)):
        t = Px(14, 10); rng = random.Random(11)
        for b in range(6):
            bx = 3 + b * 1.6; h = 5 + (b * 3) % 4
            for k in range(h):
                x = bx + lean * (k / h) ** 1.5 * (1 if b % 2 else .7); y = 9 - k
                t.set(x, y, GRASS[5] if k > h - 3 else GRASS[4] if k > 1 else GRASS[3])
        d[f'tuft_{f}'] = t
    # soft pixel fog: dithered cloud blobs, tileable horizontally
    t = Px(256, 128); rng = random.Random(77)
    for _ in range(18):
        cx, cy, rx, ry = rng.random() * 256, 30 + rng.random() * 70, 24 + rng.random() * 40, 8 + rng.random() * 16
        for dxo in (-256, 0, 256):
            for y in range(int(cy - ry), int(cy + ry) + 1):
                for x in range(int(cx + dxo - rx), int(cx + dxo + rx) + 1):
                    k = ((x - cx - dxo) / rx) ** 2 + ((y - cy) / ry) ** 2
                    if k < 1 and 0 <= x < 256 and 0 <= y < 128:
                        B = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]][y % 4][x % 4]
                        if B < (1 - k) * 16 * .9: t.set(x, y, (150, 172, 214, 80))
    d['fog'] = t
    return d

def light_masks():
    """Dithered, banded radial + cone masks (white, alpha = light strength). Pixel-crisp when scaled with nearest."""
    B = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
    rad = Px(128, 128)
    for y in range(128):
        for x in range(128):
            r = math.hypot(x - 63.5, y - 63.5) / 64
            if r >= 1: continue
            v = (1 - r) ** 1.35; steps = 6; q = v * steps; lo = int(q); frac = q - lo
            lvl = lo + (1 if frac * 16 > B[y % 4][x % 4] else 0); a = min(1, lvl / steps)
            if a > 0: rad.set(x, y, (255, 255, 255, int(a * 255)))
    cone = Px(160, 160)
    for y in range(160):
        for x in range(160):
            dx, dy = x, y - 80; r = math.hypot(dx, dy) / 160
            if r >= 1 or dx <= 0: continue
            ang = abs(math.atan2(dy, dx)); half = math.radians(30)
            if ang >= half: continue
            edge = 1 - ang / half; v = min(1, edge * 2.2) * (1 - r) ** .8; steps = 7; q = v * steps; lo = int(q); frac = q - lo
            lvl = lo + (1 if frac * 16 > B[y % 4][x % 4] else 0); a = min(1, lvl / steps)
            if a > 0: cone.set(x, y, (255, 255, 255, int(a * 255)))
    return {'light_radial': rad, 'light_cone': cone}

def build_all():
    d = {}
    d.update(banyan())
    d.update({'lamp': pole_lamp(), 'hoop': hoop(), 'flagpole': flagpole(), 'bench': bench(), 'pot_flower': pot(0), 'pot_fern': pot(1), 'bin': bin_()})
    d.update(flag_frames()); d.update(fan_frames()); d.update(curtain_frames()); d.update(small_props()); d.update(items()); d.update(effects())
    return d
