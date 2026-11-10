"""Player sprite sheet: 32x40 frames, one row per (animation, direction)."""
import math
from pixel import Px, H, mix
from palette import *

FW, FH = 32, 40
SH = SKIN; SHIRT = UNI; LONG = GREEN_L
BAG = ['#10213f', '#1c3868', '#2c5596', '#4a7ac8']
SHOE = '#1a1220'

def shadow(t, w=9, y=37, cy=38):
    for dy, a in ((0, 90), (-1, 60)):
        for x in range(16 - w, 16 + w + 1):
            if abs(x - 16) < w - (1 if dy else 0): t.set(x, cy + dy, (0, 0, 0, a))

def head_front(t, x, y, face='normal', blink=False):
    # hair back mass then face
    t.rect(x, y + 1, 12, 5, HAIR[1]); t.rect(x + 1, y, 10, 2, HAIR[1])
    t.rect(x + 1, y + 4, 10, 8, SH[3]); t.rect(x + 2, y + 11, 8, 1, SH[2])      # face + chin shade
    t.rect(x, y + 5, 2, 5, HAIR[1]); t.rect(x + 10, y + 5, 2, 5, HAIR[1])        # side locks
    t.rect(x + 1, y + 2, 10, 3, HAIR[1]); t.rect(x + 1, y + 4, 4, 2, HAIR[0]); t.rect(x + 7, y + 4, 4, 1, HAIR[0])   # fringe w/ parting
    t.set(x + 3, y + 1, HAIR[3]); t.set(x + 4, y + 1, HAIR[3]); t.set(x + 8, y + 2, HAIR[3])      # sheen
    ey = y + 7
    if face == 'wide':
        for ex in (x + 3, x + 7): t.rect(ex, ey - 1, 2, 3, '#f4f6ff'); t.set(ex + 1, ey, '#07080f'); t.set(ex + 1, ey + 1, '#07080f')
        t.rect(x + 4, y + 10, 4, 2, '#3a0f14'); t.set(x + 5, y + 10, '#c04050')
        t.hline(x + 3, y + 5, 2, HAIR[0]); t.hline(x + 7, y + 5, 2, HAIR[0])
    elif face == 'closed':
        t.hline(x + 3, ey, 2, HAIR[0]); t.hline(x + 7, ey, 2, HAIR[0]); t.hline(x + 5, y + 10, 2, SH[1])
    else:
        t.rect(x + 3, ey, 2, 2, '#07080f'); t.rect(x + 7, ey, 2, 2, '#07080f'); t.set(x + 3, ey, '#2a3550'); t.set(x + 7, ey, '#2a3550')
        t.set(x + 3, ey + 2, SH[2]); t.set(x + 8, ey + 2, SH[2])   # lower lids/blush
        t.hline(x + 5, y + 10, 2, SH[1])
    t.set(x + 1, y + 8, SH[2]); t.set(x + 10, y + 8, SH[2])  # ears

def head_side(t, x, y, face='normal'):
    # facing right
    t.rect(x + 1, y + 1, 10, 11, HAIR[1]); t.rect(x + 2, y, 8, 2, HAIR[1])
    t.rect(x + 5, y + 4, 6, 8, SH[3]); t.rect(x + 11, y + 7, 1, 2, SH[3]); t.set(x + 11, y + 8, SH[4])     # face + nose
    t.rect(x + 5, y + 3, 6, 2, HAIR[1]); t.rect(x + 4, y + 2, 7, 2, HAIR[0]); t.set(x + 5, y + 1, HAIR[3]); t.set(x + 7, y + 1, HAIR[3])
    t.rect(x + 2, y + 5, 4, 6, HAIR[0]); t.set(x + 3, y + 6, HAIR[3])                                             # back of hair
    t.rect(x + 5, y + 8, 1, 2, SH[2])                                                                               # ear
    if face == 'wide': t.rect(x + 8, y + 6, 2, 3, '#f4f6ff'); t.set(x + 9, y + 7, '#07080f')
    else: t.rect(x + 8, y + 7, 2, 2, '#07080f'); t.set(x + 8, y + 7, '#2a3550')
    t.hline(x + 9, y + 10, 2, SH[1]); t.hline(x + 5, y + 11, 6, SH[2])

def head_back(t, x, y):
    t.rect(x, y + 1, 12, 11, HAIR[1]); t.rect(x + 1, y, 10, 2, HAIR[1]); t.rect(x + 2, y + 11, 8, 2, HAIR[0])
    t.rect(x + 3, y + 1, 3, 1, HAIR[3]); t.rect(x + 7, y + 2, 2, 1, HAIR[3]); t.vline(x + 6, y + 3, 7, HAIR[0]); t.rect(x + 3, y + 10, 6, 1, HAIR[2])
    t.rect(x + 4, y + 12, 4, 2, SH[2])  # neck

def legs(t, view, ph, lift, crouch=0):
    """ph in [-1,1]: which leg is forward. lift: how high the lifted foot goes."""
    base = 37
    if view == 'front' or view == 'back':
        for side, x in ((0, 11), (1, 17)):
            s = ph if side == 0 else -ph
            up = int(max(0, s) * lift); fy = int(s * 1.5 * (1 if view == 'front' else -1))
            top = 30 + crouch
            t.rect(x, top, 4, base - top - up + (fy if fy > 0 else 0) - 1, SH[2]); t.vline(x, top, base - top - up - 1, SH[3])
            t.rect(x - 1, base - 2 - up + (fy if fy > 0 else 0), 6, 3, SHOE); t.hline(x - 1, base - 2 - up + (fy if fy > 0 else 0), 6, '#3a2c44')
    else:
        for side in (0, 1):
            s = ph if side == 0 else -ph
            up = int(max(0, s) * lift); fx = int(s * 4)
            col = SH[2] if side == 0 else SH[1]
            x = 14 + fx
            t.rect(x, 30 + crouch, 4, base - 30 - crouch - up - 1, col)
            t.rect(x - 1 + (1 if fx >= 0 else 0), base - 2 - up, 6, 3, SHOE); t.hline(x - 1 + (1 if fx >= 0 else 0), base - 2 - up, 6, '#3a2c44')

def longyi(t, top, bot, flare=0, view='front'):
    w = 13 + flare
    x = 16 - w // 2
    for y in range(top, bot):
        k = (y - top) / max(1, bot - top - 1)
        c = LONG[2] if k < .35 else LONG[1] if k < .75 else LONG[0]
        wy = w + int(k * 2)
        t.hline(16 - wy // 2, y, wy, c)
    t.vline(16 - w // 2, top, bot - top, LONG[3]); t.vline(16 + w // 2 - 1, top, bot - top, LONG[0])
    t.hline(x, top, w, '#c8b070')    # waist fold / belt line
    t.hline(x + 1, bot - 1, w - 1, '#0a1c14')
    for fx in (-2, 2): t.vline(16 + fx, top + 2, bot - top - 3, LONG[1])  # pleat shadow

def torso_front(t, y, arm_l, arm_r, flash=False, hands_up=False, sq=0):
    x = 10
    t.rect(x, y, 12, 11 - sq, SHIRT[2]); t.rect(x, y, 12, 2, SHIRT[3]); t.hline(x, y + 10 - sq, 12, SHIRT[0]); t.vline(x, y, 11 - sq, SHIRT[1]); t.vline(x + 11, y, 11 - sq, SHIRT[1])
    t.rect(14, y, 4, 3, SH[3]); t.set(15, y + 2, SH[2]); t.set(16, y + 2, SH[2])    # collar opening
    # Small school crest and red thread bracelet: readable at native pixel scale without changing the silhouette.
    t.rect(12, y + 4, 2, 2, '#d04650'); t.set(12, y + 4, '#f2d58a'); t.set(13, y + 5, '#2c7a55')
    t.vline(16, y + 3, 7 - sq, SHIRT[1]); t.rect(18, y + 4, 2, 2, SHIRT[1]); t.set(18, y + 4, SHIRT[3])   # placket + pocket
    # shirt sleeves + arms
    for side, (ax, ay) in ((0, arm_l), (1, arm_r)):
        sx = 8 if side == 0 else 22
        t.rect(sx, y + 1, 3, 5, SHIRT[2]); t.vline(sx if side == 0 else sx + 2, y + 1, 5, SHIRT[1])
        ex, ey = sx + 1 + ax, y + 6 + ay
        for k in range(0, 5): t.rect(sx + 1 + int(ax * k / 4), y + 6 + int(ay * k / 4), 2, 1, SH[2])
        t.rect(ex, ey + (0 if hands_up else 1), 3, 3, SH[3])
        if side == 1 and flash: t.rect(ex - 1, ey, 5, 3, '#59607a'); t.rect(ex - 1, ey + 3, 5, 1, '#2a3040'); t.rect(ex, ey + 3, 3, 3, '#ffe9a0'); t.set(ex + 1, ey + 5, '#fff8d8')

def backpack(t, view, y, bob=0):
    if view == 'back':
        t.rect(9, y, 14, 14, BAG[1]); t.rect(9, y, 14, 2, BAG[3]); t.rect(9, y + 13, 14, 1, BAG[0]); t.vline(9, y, 14, BAG[2]); t.vline(22, y, 14, BAG[0])
        t.rect(12, y + 6, 8, 6, BAG[2]); t.hline(12, y + 6, 8, BAG[3]); t.hline(12, y + 11, 8, BAG[0]); t.rect(15, y + 8, 2, 2, LAMP[2])   # pocket + zip pull
        t.vline(11, y + 1, 12, BAG[0]); t.vline(20, y + 1, 12, BAG[0])
    elif view == 'side':
        t.rect(6, y + 1, 7, 13, BAG[1]); t.rect(6, y + 1, 7, 2, BAG[3]); t.vline(6, y + 1, 13, BAG[2]); t.vline(12, y + 1, 13, BAG[0]); t.rect(7, y + 8, 4, 4, BAG[2]); t.hline(7, y + 13, 6, BAG[0])

def front_figure(t, ph=0, arm=0, bob=0, crouch=0, face='normal', flash=False, hands_up=False, squash=0, lift=2, head_dx=0, head_dy=0, arm_l=None, arm_r=None):
    shadow(t)
    legs(t, 'front', ph, lift, crouch)
    longyi(t, 24 + bob + crouch, 33 + crouch + (0 if crouch == 0 else 0), flare=1, view='front')
    al = arm_l if arm_l is not None else (0, int(-arm * 2)); ar = arm_r if arm_r is not None else (0, int(arm * 2))
    if hands_up: al, ar = (3, -4), (-3, -4)
    torso_front(t, 14 + bob + crouch, al, ar, flash and not hands_up, hands_up, squash)
    head_front(t, 10 + head_dx, 2 + bob + crouch + head_dy, face)

def back_figure(t, ph=0, arm=0, bob=0, crouch=0, reach=False, flash=False, lift=2):
    shadow(t)
    legs(t, 'back', ph, lift, crouch)
    longyi(t, 24 + bob + crouch, 33 + crouch, flare=1, view='back')
    y = 14 + bob + crouch
    t.rect(10, y, 12, 11, SHIRT[1]); t.rect(10, y, 12, 2, SHIRT[2]); t.vline(10, y, 11, SHIRT[0]); t.set(12, y + 4, '#d04650'); t.set(13, y + 4, '#2c7a55')
    for side, sx in ((0, 8), (1, 22)):
        a = int((-arm if side == 0 else arm) * 2)
        t.rect(sx, y + 1, 3, 5, SHIRT[1]); t.rect(sx + 1, y + 6 + a, 2, 4, SH[2]); t.rect(sx + 1, y + 9 + a, 3, 2, SH[3])
    if reach: t.rect(21, y - 3, 3, 8, SH[2]); t.rect(21, y - 6, 4, 4, SH[3])
    if flash: t.rect(21, y - 2, 4, 6, '#59607a'); t.rect(21, y - 5, 4, 3, '#ffe9a0')
    backpack(t, 'back', y - 1, bob)
    head_back(t, 10, 2 + bob + crouch)

def side_figure(t, ph=0, arm=0, bob=0, crouch=0, flash=False, face='normal', lean=0, lift=2):
    """Faces right."""
    shadow(t)
    legs(t, 'side', ph, lift, crouch)
    longyi(t, 24 + bob + crouch, 33 + crouch, flare=-2, view='side')
    y = 14 + bob + crouch
    backpack(t, 'side', y - 1, bob)
    t.rect(11 + lean, y, 10, 11, SHIRT[2]); t.rect(11 + lean, y, 10, 2, SHIRT[3]); t.vline(11 + lean, y, 11, SHIRT[1]); t.hline(11 + lean, y + 10, 10, SHIRT[0]); t.vline(20 + lean, y, 11, SHIRT[1])
    t.rect(17 + lean, y + 4, 2, 2, SHIRT[1]); t.set(17 + lean, y + 4, '#d04650')
    # near arm swings, far arm hidden behind torso slightly
    a = int(arm * 4)
    ax = 14 + lean + a
    t.rect(ax, y + 1, 4, 4, SHIRT[2]); t.vline(ax, y + 1, 4, SHIRT[1])
    t.rect(ax + (1 if a >= 0 else 0), y + 5, 3, 4, SH[2]); t.rect(ax + 1 + (1 if a >= 0 else 0), y + 8, 3, 3, SH[3])
    if flash:
        t.rect(ax + 2, y + 2, 4, 3, SH[2]); t.rect(ax + 4, y + 3, 6, 3, '#59607a'); t.rect(ax + 4, y + 3, 6, 1, '#8890ab'); t.rect(ax + 10, y + 2, 2, 5, '#ffe9a0'); t.set(ax + 11, y + 4, '#ffffff')
    head_side(t, 10 + lean, 2 + bob + crouch, face)

def kneel_front(t, face='normal', arm_phase=0, bend=0):
    shadow(t, 10)
    t.rect(9, 34, 14, 3, LONG[1]); t.rect(8, 36, 16, 2, SHOE)
    longyi(t, 28, 35, flare=3)
    y = 20 + bend
    t.rect(9, y, 14, 9, SHIRT[2]); t.rect(9, y, 14, 2, SHIRT[3]); t.hline(9, y + 8, 14, SHIRT[0])
    ax = int(math.sin(arm_phase) * 3)
    t.rect(6 + ax, y + 4, 3, 8, SH[2]); t.rect(5 + ax, y + 11, 4, 3, SH[3]); t.rect(23 - ax, y + 4, 3, 8, SH[2]); t.rect(23 - ax, y + 11, 4, 3, SH[3])
    head_front(t, 10, 8 + bend, face)

def fallen(t, stage):
    """Death frames: 0 stagger, 1 tipping, 2 hitting floor, 3-5 lying."""
    if stage == 0: front_figure(t, bob=1, face='wide', hands_up=True, head_dy=0); return
    if stage == 1:
        s = Px(FW, FH); front_figure(s, face='wide', hands_up=True)
        r = s.im.rotate(-28, resample=0, center=(16, 37)); t.im.alpha_composite(r); t.p = t.im.load(); return
    if stage == 2:
        s = Px(FW, FH); front_figure(s, face='closed', hands_up=False)
        r = s.im.rotate(-62, resample=0, center=(16, 37)); t.im.alpha_composite(r); t.p = t.im.load(); return
    # lying on the floor, horizontal
    shadow(t, 13, 36, 37)
    x0, y0 = 3, 24
    t.rect(x0 + 17, y0 + 1, 11, 8, LONG[1]); t.rect(x0 + 17, y0 + 1, 11, 2, LONG[2]); t.rect(x0 + 27, y0 + 5, 3, 3, SH[2]); t.rect(x0 + 28, y0 + 4, 4, 2, SHOE)
    t.rect(x0 + 6, y0, 12, 10, SHIRT[1]); t.rect(x0 + 6, y0, 12, 2, SHIRT[2]); t.rect(x0 + 6, y0 + 9, 12, 1, SHIRT[0])
    t.rect(x0 + 3, y0 + 3, 4, 3, BAG[1]); t.rect(x0 + 8, y0 + 9, 6, 3, SH[2]) if stage != 5 else t.rect(x0 + 9, y0 - 3, 6, 3, SH[2])
    t.rect(x0 - 2, y0 - 1, 9, 10, HAIR[1]); t.rect(x0 - 2, y0 + 2, 6, 6, SH[3]); t.hline(x0 - 1, y0 + 4, 2, HAIR[0]); t.set(x0 + 2, y0 + 4, HAIR[0])
    if stage >= 4: t.rect(x0 - 1, y0 + 7, 8, 2, (90, 14, 20, 200 if stage == 5 else 120))   # faint dark stain
    t.set(x0, y0, HAIR[3]); t.set(x0 + 1, y0, HAIR[3])

def mk(fn, *a, **k):
    t = Px(FW, FH); fn(t, *a, **k); t.outline(OUT); return t

WALK = [(-1, 0, 1), (0, 0, 0), (1, 1, 0), (0, 1, 0)]   # (phase, bob, ...) pattern: contact, pass, contact, pass

def build():
    rows = []   # list of (key, frames[list Px], fps, loop)
    dirs = ['down', 'up', 'left', 'right']

    def figure(d, ph=0, arm=0, bob=0, flash=False, face='normal', lift=2, lean=0, crouch=0):
        if d == 'down': return mk(front_figure, ph=ph, arm=arm, bob=bob, flash=flash, face=face, lift=lift, crouch=crouch)
        if d == 'up': return mk(back_figure, ph=ph, arm=arm, bob=bob, flash=flash, lift=lift, crouch=crouch)
        t = mk(side_figure, ph=ph, arm=arm, bob=bob, flash=flash, face=face, lean=lean, lift=lift, crouch=crouch)
        if d == 'left': t = flip(t)
        return t
    def flip(t):
        n = Px(FW, FH); n.im = t.im.transpose(0); n.p = n.im.load(); return n

    for d in dirs:
        rows.append((f'idle_{d}', [figure(d, bob=0), figure(d, bob=0, arm=.15), figure(d, bob=1), figure(d, bob=1, arm=.15)][:4], 3, True))
    for d in dirs:
        frames = [figure(d, ph=ph, arm=-ph * .9, bob=b) for ph, b in ((-1, 0), (0, 1), (1, 0), (0, 1))]
        rows.append((f'walk_{d}', frames, 8, True))
    for d in dirs:
        frames = [figure(d, ph=ph * 1.0, arm=-ph * 1.6, bob=b, lift=4, lean=1 if d in ('left', 'right') else 0) for ph, b in ((-1, 0), (0, 1), (1, 0), (0, 1))]
        rows.append((f'run_{d}', frames, 12, True))
    for d in dirs:
        rows.append((f'fidle_{d}', [figure(d, bob=0, flash=True), figure(d, bob=1, flash=True), figure(d, bob=0, flash=True), figure(d, bob=1, flash=True)], 3, True))
    for d in dirs:
        frames = [figure(d, ph=ph, arm=0, bob=b, flash=True) for ph, b in ((-1, 0), (0, 1), (1, 0), (0, 1))]
        rows.append((f'fwalk_{d}', frames, 8, True))
    for d in dirs:
        frames = [figure(d, ph=ph, arm=-ph * .55, bob=b, crouch=5, lift=1) for ph, b in ((-1, 0), (0, 1), (1, 0), (0, 1))]
        rows.append((f'sneak_{d}', frames, 7, True))
    for d in dirs:
        frames = [figure(d, ph=ph, arm=-ph * .35, bob=b, flash=True, crouch=5, lift=1) for ph, b in ((-1, 0), (0, 1), (1, 0), (0, 1))]
        rows.append((f'fsneak_{d}', frames, 7, True))

    rows.append(('hide', [mk(front_figure, crouch=5, squash=3, face='wide'), mk(front_figure, crouch=8, squash=4, face='closed', arm_l=(2, 3), arm_r=(-2, 3)), mk(front_figure, crouch=8, squash=4, face='wide', arm_l=(2, 3), arm_r=(-2, 3)), mk(front_figure, crouch=8, squash=4, face='closed', arm_l=(2, 3), arm_r=(-2, 3))], 3, True))
    rows.append(('search', [mk(kneel_front, 'normal', i * 1.6, i % 2) for i in range(4)], 6, True))
    rows.append(('opendoor', [mk(back_figure, reach=False), mk(back_figure, reach=True, bob=0), mk(back_figure, reach=True, bob=1), mk(back_figure, reach=True, bob=0, lift=0)], 7, False))
    rows.append(('pickup', [mk(front_figure, crouch=2, arm_l=(0, 2), arm_r=(0, 2)), mk(front_figure, crouch=5, arm_l=(1, 5), arm_r=(-1, 5), face='normal'), mk(front_figure, crouch=6, arm_l=(1, 6), arm_r=(-1, 6)), mk(front_figure, crouch=2, arm_l=(0, 1), arm_r=(0, 1))], 8, False))
    rows.append(('fear', [mk(front_figure, face='wide', hands_up=True, bob=0, head_dx=0), mk(front_figure, face='wide', hands_up=True, bob=1, head_dx=1), mk(front_figure, face='wide', hands_up=True, bob=0, head_dx=-1), mk(front_figure, face='wide', hands_up=True, bob=1, head_dx=1)], 12, True))
    rows.append(('death', [mk(fallen, i) for i in range(6)], 6, False))
    return rows

def pack(rows, cols=6):
    W = cols * FW; Hh = len(rows) * FH
    out = Px(W, Hh)
    meta = {}
    for r, (key, frames, fps, loop) in enumerate(rows):
        for i, f in enumerate(frames): out.im.alpha_composite(f.im, (i * FW, r * FH))
        meta[key] = {'row': r, 'frames': len(frames), 'fps': fps, 'loop': loop}
    out.p = out.im.load()
    return out, meta, cols
