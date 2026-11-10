"""Three distinct Myanmar-school ghosts. Each returns rows of frames like gen_player."""
import math, random
from pixel import Px, H, mix
from palette import *

PALE = ['#3c4660', '#5d6a8a', '#8d9bbd', '#b8c4de', '#e2e8f6']
GLOW = '#7fe0ff'
GOUT = '#080a14'

# ------------------------------------------------------------------ Classroom Girl (32x48)
GW, GH = 32, 48
def girl(t, ph=0.0, lean=0, reach=0, hair=0, face=True, tilt=0, droop=0, flicker=False):
    cx = 16 + lean
    # faint ground glow
    for dx in range(-8, 9):
        if abs(dx) < 8: t.set(cx + dx, 46, (120, 170, 230, 40))
    # hair back mass (long, falls past waist, sways)
    for y in range(8, 38):
        k = (y - 8) / 30
        sway = int(math.sin(ph * 2 + k * 3) * (1 + k * 3) * (1 + hair * .5)) + int(-lean * k * 1.5)
        w = 14 + int(k * 3)
        t.hline(cx - w // 2 + sway, y, w, HAIR[0] if (y + int(ph * 3)) % 7 else HAIR[1])
        if y % 5 == 0: t.set(cx - w // 2 + sway + 2, y, HAIR[3])
    # torso (stained white blouse) with torn sleeves
    ty = 17 + droop
    t.rect(cx - 6, ty, 12, 14, PALE[3]); t.rect(cx - 6, ty, 12, 2, PALE[4]); t.vline(cx - 6, ty, 14, PALE[2]); t.vline(cx + 5, ty, 14, PALE[1])
    t.rect(cx - 2, ty, 4, 4, PALE[1]); t.hline(cx - 6, ty + 13, 12, PALE[1])
    for sx, sy in ((cx - 4, ty + 8), (cx + 2, ty + 5)): t.rect(sx, sy, 3, 2, '#5a4a52'); t.set(sx + 1, sy + 1, '#3a1a22')   # dark stains
    for i in range(0, 12, 3): t.vline(cx - 6 + i, ty + 14, 1 + (i % 2), PALE[2])  # ragged hem
    # arms
    for side in (-1, 1):
        ax = cx + side * 8; ang = reach if side == 1 else reach * .8
        for k in range(0, 14):
            px = ax + int(side * k * .25 * (1 + ang)); py = ty + 1 + k + int(-ang * k * .7)
            t.rect(px, py, 2, 2, PALE[3] if k < 11 else PALE[4])
        hx = ax + int(side * 3.5 * (1 + ang)); hy = ty + 14 - int(ang * 9)
        for f in (-1, 0, 1): t.vline(hx + f, hy, 4, PALE[4])
    # head
    hy0 = 4 + droop + int(math.sin(ph * 5) * 1)
    hx0 = cx - 6 + tilt
    t.rect(hx0, hy0 + 2, 12, 12, PALE[3]); t.rect(hx0 + 1, hy0 + 1, 10, 1, PALE[3]); t.rect(hx0 + 2, hy0 + 13, 8, 1, PALE[2]); t.vline(hx0 + 10, hy0 + 3, 10, PALE[2]); t.rect(hx0 + 1, hy0 + 3, 3, 2, PALE[4])
    # hair fringe covering forehead + face-hiding curtains
    t.rect(hx0 - 1, hy0, 14, 6, HAIR[0]); t.rect(hx0 - 2, hy0 + 3, 4, 14, HAIR[0]); t.rect(hx0 + 10, hy0 + 3, 4, 14, HAIR[0]); t.set(hx0 + 3, hy0, HAIR[3]); t.set(hx0 + 4, hy0 + 1, HAIR[3])
    t.rect(hx0 + 4, hy0 + 4, 2, 3, HAIR[0]); t.rect(hx0 + 7, hy0 + 4, 1, 4, HAIR[0])  # stray strands over face
    if face:
        for ex in (hx0 + 3, hx0 + 7):
            t.rect(ex, hy0 + 7, 3, 3, '#06070d'); t.set(ex + 1, hy0 + 8, GLOW); t.set(ex + 1, hy0 + 7, '#d8f6ff') if not flicker else None
        t.rect(hx0 + 4, hy0 + 11, 4, 1, '#3a1a22'); t.set(hx0 + 5, hy0 + 12, '#3a1a22')
    # waist -> longyi tatters fading into wisps
    ly = ty + 14
    for y in range(ly, 47):
        k = (y - ly) / (47 - ly); w = int(12 - k * 4)
        for x in range(cx - w // 2, cx + w // 2 + 1):
            wob = math.sin(ph * 3 + x * .9 + y * .35)
            if wob > -0.2 + k * 1.1:
                a = int(255 * (1 - k) ** 1.2)
                t.set(x + int(wob * (1 + k * 2)), y, (*H(GREEN_L[1] if (x + y) % 3 else GREEN_L[0])[:3], max(40, a)))

def girl_dissolve(src, k):
    out = Px(GW, GH); rng = random.Random(int(k * 100))
    for y in range(GH):
        for x in range(GW):
            c = src.get(x, y)
            if c[3] == 0: continue
            thr = (x * 7 + y * 13) % 29 / 29.0 + (y / GH) * .25
            if thr > k:
                ny = y - int(k * 8 * rng.random()) if rng.random() < k else y
                out.set(x + (int(rng.random() * 3) - 1 if k > .4 else 0), ny, (c[0], c[1], c[2], int(c[3] * (1 - k * .6))))
    return out

def build_girl():
    mk = lambda **k: (lambda t: (girl(t, **k), t.outline(GOUT))[1])
    def fr(**k): t = Px(GW, GH); girl(t, **k); t.outline(GOUT); return t
    idle = [fr(ph=i * 1.57, hair=0) for i in range(4)]
    float_ = [fr(ph=i * 1.57 + .4, hair=1, lean=0, reach=.2, tilt=(1 if i % 2 else -1)) for i in range(4)]
    chase = [fr(ph=i * 1.57, hair=2, lean=2, reach=1.0, droop=2, tilt=(2 if i % 2 else -2), flicker=bool(i % 2)) for i in range(4)]
    base = fr(ph=0, hair=1, reach=.3)
    vanish = [girl_dissolve(base, k) for k in (0.1, 0.3, 0.5, 0.7, 0.85, 0.97)]
    return [('girl_idle', idle, 4, True), ('girl_float', float_, 6, True), ('girl_chase', chase, 12, True), ('girl_vanish', vanish, 10, False)], GW, GH

# ------------------------------------------------------------------ Shadow Teacher (40x64)
TW, TH = 40, 64
def teacher(t, ph=0.0, lean=0, glitch=0, arm=0):
    cx = 20 + lean
    D = ['#04050a', '#0a0b14', '#12132a', '#1b1c3a']
    # long legs/longyi (tall, tapering), slight stagger
    for y in range(36, 62):
        k = (y - 36) / 26; w = int(12 - k * 3); off = int(math.sin(ph + y * .12) * 1.5)
        t.hline(cx - w // 2 + off, y, w, D[1] if y % 4 else D[2])
    t.hline(cx - 6, 61, 12, D[0]); t.rect(cx - 6, 62, 4, 2, D[0]); t.rect(cx + 2, 62, 4, 2, D[0])
    # torso: narrow, tall shirt with stiff collar, hint of buttons
    t.rect(cx - 6, 18, 12, 20, D[2]); t.vline(cx - 6, 18, 20, D[3]); t.vline(cx + 5, 18, 20, D[0]); t.vline(cx, 20, 16, D[0])
    for by in (23, 28, 33): t.set(cx - 1, by, '#5a6490')
    # long neck + small head (distorted)
    t.rect(cx - 2, 8, 4, 11, D[1])
    t.rect(cx - 5, 1, 10, 9, D[1]); t.rect(cx - 5, 1, 2, 9, D[3]); t.hline(cx - 4, 0, 8, D[2])
    # faceless: two thin pale eye-slits and nothing else
    ey = 5 + (1 if glitch else 0)
    t.rect(cx - 3, ey, 2, 1, '#e8eefc'); t.rect(cx + 1, ey, 2, 1, '#e8eefc'); t.set(cx - 3, ey - 1, '#7fe0ff'); t.set(cx + 2, ey - 1, '#7fe0ff')
    # arms: far too long, hanging past the knees; one clutches a cane
    for side in (-1, 1):
        sway = int(math.sin(ph * 1.3 + side) * 2) + (arm if side == 1 else 0)
        x = cx + side * 7
        for k in range(0, 34):
            t.rect(x + int(side * k * .12) + (sway * k // 34), 20 + k, 2, 1, D[2] if k % 6 else D[1])
        hx = x + int(side * 4) + sway
        t.rect(hx, 53, 3, 4, D[1]); [t.vline(hx + f, 56, 4, D[0]) for f in (0, 1, 2)]   # long fingers
    cx2 = cx + 11 + (arm)
    t.vline(cx2, 40, 23, '#3a2a1e'); t.vline(cx2 + 1, 40, 23, '#1d130f'); t.set(cx2, 40, '#8a5a1e')       # pointer cane
    # purple rim light on the left edge only (reads as silhouette against dark)
    for y in range(0, TH):
        for x in range(0, TW):
            c = t.get(x, y)
            if c[3] and t.get(x - 1, y)[3] == 0 and c[0] < 40: t.set(x, y, '#463670') if (x + y) % 2 else t.set(x, y, '#2e2250')

def glitch_frame(src, k):
    out = Px(TW, TH); rng = random.Random(int(k * 1000))
    for y in range(TH):
        off = int((rng.random() - .5) * 8 * (1 - k)) if rng.random() < (1 - k) * .6 else 0
        for x in range(TW):
            c = src.get(x, y)
            if c[3] and rng.random() < .3 + k * .75: out.set(x + off, y, (c[0], c[1], c[2], int(255 * min(1, k * 1.2))))
    return out

def build_teacher():
    def fr(**k): t = Px(TW, TH); teacher(t, **k); return t
    idle = [fr(ph=i * 1.57) for i in range(4)]
    walk = [fr(ph=i * 1.57, lean=(1 if i % 2 else -1), arm=(1 if i % 2 else 0)) for i in range(4)]
    base = fr(ph=0)
    appear = [glitch_frame(base, k) for k in (0.1, 0.25, 0.45, 0.65, 0.85, 1.0)]
    return [('teacher_idle', idle, 3, True), ('teacher_walk', walk, 4, True), ('teacher_appear', appear, 12, False)], TW, TH

# ------------------------------------------------------------------ Crawling creature (8 directions, see gen_crawler.py)
import gen_crawler
def build_crawler():
    return gen_crawler.build_crawler()

def pack(rows, fw, fh, cols):
    out = Px(cols * fw, len(rows) * fh); meta = {}
    for r, (key, frames, fps, loop) in enumerate(rows):
        for i, f in enumerate(frames): out.im.alpha_composite(f.im, (i * fw, r * fh))
        meta[key] = {'row': r, 'frames': len(frames), 'fps': fps, 'loop': loop}
    out.p = out.im.load(); return out, meta
