"""The girl as a normal, living schoolgirl (32x48 frames, same size/feet line as the ghost girl so she can swap in anywhere).
White blouse, green longyi, black ponytail, thanaka on the cheeks, warm skin, soft smile. No glow, no transparency, no horror."""
import math
from pixel import Px, H, mix
from palette import *

GW, GH = 32, 48
SHOE = '#1a1220'
BLOUSE = ['#aeb6cc', '#d2d8ea', '#eef1fa', '#ffffff']
THANAKA = '#e9d9a0'

def girl_human(t, ph=0.0, step=0, head_down=0, smile=True, blink=False, sway=0):
    cx = 16
    bob = 1 if (step % 2 == 1) else 0
    # ground shadow
    for x in range(8, 25):
        t.set(x, 46, (0, 0, 0, 70)); 
        if 10 < x < 22: t.set(x, 45, (0, 0, 0, 40))
    # ---- ponytail (behind head/shoulders), swings with motion
    sw = int(math.sin(ph * 2) * 2) + sway
    for k in range(0, 17):
        x = cx + 5 + int(k * .18) + int(sw * k / 16); y = 12 + k + bob + head_down
        t.rect(x, y, 3 if k < 11 else 2, 1, HAIR[1] if k % 4 else HAIR[0])
        if k % 5 == 1: t.set(x + 1, y, HAIR[3])
    t.rect(cx + 4, 11 + bob + head_down, 3, 2, '#b8434a')   # hair tie
    # ---- legs + shoes (longyi hides most of them)
    swing = int(math.sin(ph) * 2) if step else 0
    for side, x in ((0, cx - 5 + swing), (1, cx + 1 - swing)):
        t.rect(x, 41, 4, 4, SKIN[3] if side == 0 else SKIN[2])
        t.rect(x - 1, 44, 6, 3, SHOE); t.hline(x - 1, 44, 6, '#3a2c44')
    # ---- longyi (green, with fold line + hem band)
    top, bot = 31 + bob, 44
    for y in range(top, bot):
        k = (y - top) / (bot - top - 1)
        w = 12 + int(k * 3) + (1 if (step and y > 38) else 0)
        c = GREEN_L[3] if k < .3 else GREEN_L[2] if k < .7 else GREEN_L[1]
        t.hline(cx - w // 2, y, w, c)
    t.vline(cx - 6, top, bot - top, GREEN_L[3]); t.vline(cx + 6, top, bot - top, GREEN_L[0]); t.vline(cx, top + 2, bot - top - 3, GREEN_L[1])
    t.hline(cx - 7, bot - 1, 14, GREEN_L[0]); t.hline(cx - 6, top, 12, '#c8b070')
    # ---- arms (skin) swinging a little, with short blouse sleeves
    for side in (-1, 1):
        ax = cx + side * 7; a = (int(math.sin(ph) * 2) if step else 0) * -side
        t.rect(ax - 1, 22 + bob, 3, 4, BLOUSE[2])                                 # sleeve
        t.rect(ax - (1 if side < 0 else 0), 26 + bob, 2, 6 + (1 if a > 0 else 0), SKIN[3]); t.set(ax, 32 + bob + (1 if a > 0 else 0), SKIN[4])
    # ---- blouse
    t.rect(cx - 6, 21 + bob, 12, 11, BLOUSE[2]); t.rect(cx - 6, 21 + bob, 12, 2, BLOUSE[3])
    t.vline(cx - 6, 21 + bob, 11, BLOUSE[1]); t.vline(cx + 5, 21 + bob, 11, BLOUSE[0]); t.hline(cx - 6, 31 + bob, 12, BLOUSE[1])
    t.rect(cx - 2, 21 + bob, 4, 3, BLOUSE[1]); t.set(cx, 24 + bob, '#7a8298'); t.set(cx, 27 + bob, '#7a8298'); t.set(cx, 30 + bob, '#7a8298')   # collar + buttons
    # ---- neck + head
    hy = 6 + bob + head_down
    t.rect(cx - 2, hy + 12, 4, 4, SKIN[2])
    t.rect(cx - 6, hy + 1, 12, 5, HAIR[1]); t.rect(cx - 5, hy, 10, 2, HAIR[1])                       # hair top
    t.rect(cx - 5, hy + 4, 10, 10, SKIN[3]); t.rect(cx - 4, hy + 13, 8, 1, SKIN[2])               # face + chin
    t.rect(cx - 6, hy + 3, 2, 8, HAIR[1]); t.rect(cx + 4, hy + 3, 2, 8, HAIR[1])                    # side hair
    t.rect(cx - 5, hy + 3, 10, 3, HAIR[1]); t.rect(cx - 5, hy + 5, 3, 1, HAIR[0]); t.rect(cx + 1, hy + 5, 4, 1, HAIR[0])   # fringe
    t.set(cx - 3, hy + 1, HAIR[3]); t.set(cx - 2, hy + 1, HAIR[3]); t.set(cx + 2, hy + 2, HAIR[3])
    ey = hy + 8
    if blink:
        t.hline(cx - 4, ey + 1, 2, HAIR[0]); t.hline(cx + 2, ey + 1, 2, HAIR[0])
    else:
        for ex in (cx - 4, cx + 2):
            t.rect(ex, ey, 2, 3, '#07080f'); t.set(ex, ey, '#3a2c44'); t.set(ex + 1, ey + 1, '#ffffff')   # eyes with a catchlight
    t.set(cx - 5, ey + 3, THANAKA); t.set(cx - 4, ey + 3, THANAKA); t.set(cx + 3, ey + 3, THANAKA); t.set(cx + 4, ey + 3, THANAKA)   # thanaka
    t.set(cx - 5, ey + 2, SKIN[4]); t.set(cx + 4, ey + 2, SKIN[4])
    t.set(cx, ey + 3, SKIN[2])                                                                       # nose
    if smile: t.hline(cx - 1, hy + 12, 3, '#a8505a'); t.set(cx - 2, hy + 11, '#a8505a'); t.set(cx + 2, hy + 11, '#a8505a')
    else: t.hline(cx - 1, hy + 12, 2, '#a8505a')
    # book held against the chest in the idle poses is handled by the arms; keep silhouette clean

def build_human_girl():
    def fr(**k): t = Px(GW, GH); girl_human(t, **k); t.outline('#07080f'); return t
    idle = [fr(ph=i * 1.57, blink=(i == 3)) for i in range(4)]
    walk = [fr(ph=i * math.pi / 3, step=1 + (i % 2), sway=(1 if i % 2 else -1)) for i in range(6)]
    down = [fr(ph=i * 1.57, head_down=2, smile=False) for i in range(4)]
    return [('hgirl_idle', idle, 4, True), ('hgirl_walk', walk, 9, True), ('hgirl_down', down, 3, True)], GW, GH

if __name__ == '__main__':
    import os, sys, json
    sys.path.insert(0, os.path.dirname(__file__))
    from gen_ghosts import pack
    rows, fw, fh = build_human_girl(); s, m = pack(rows, fw, fh, 6)
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    os.makedirs(os.path.join(root, 'public/assets/sprites/npcs'), exist_ok=True)
    s.save(os.path.join(root, 'public/assets/sprites/npcs/girl.png'))
    print(json.dumps({'frameWidth': fw, 'frameHeight': fh, 'cols': 6, 'anims': m}))
