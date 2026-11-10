"""The crawling creature (v9): a big, blind, hunched monster. Huge head with a wide-open mouth full of long fangs, clouded white
blind eyes in black sockets, big bat ears (it hunts by sound), spine spikes, ribs showing, thick limbs with long claws,
long black hair, torn clothes, moves on all fours.

Drawn procedurally (nothing is copied from any reference image): a tiny 3D skeleton (torso, neck, head, four
2-bone IK limbs, ~54 hair strands made of linked segments) is posed per animation frame and projected from 8 camera
angles into pixel art, so every direction is consistent and every loop is seamless.

Sprite sheet:  rows = (anim, direction) pairs, cols = frames.  Direction index d is the monster's travel direction
relative to the camera:  0 = away (back view), 1 = away-right, 2 = right, 3 = toward-right, 4 = toward camera (front view),
5 = toward-left, 6 = left, 7 = away-left.   (d * 45 degrees, clockwise seen from above, same convention as Ghost.js.)
"""
import math, random
import numpy as np
from PIL import Image, ImageDraw
from pixel import Px

FW, FH = 208, 160            # frame size (the player frame is 32x40: the creature is about three times as big)
S = 3                       # supersampling used while drawing, reduced with a hard threshold afterwards
PPU = 54                    # pixels per model unit (v9: the whole creature is 1.28x larger than v8)
GROUND_Y = 110              # screen row of the ground point under the creature
CX = FW / 2
TILT = math.radians(24)     # camera looks down a little
SIN_T, COS_T = math.sin(TILT), math.cos(TILT)
HS = 1.2                    # head scale: the face is the scariest thing about it, so it is BIG
XSHIFT = 0.16               # centre the model (head is further forward than the hips are back)

def H(h):
    h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)

BODY = [H(c) for c in ('#352f40', '#58506a', '#847c95', '#aaa3b8')]
LIMB = [H(c) for c in ('#2f2a3a', '#4f485f', '#766e87', '#9e97ad')]
HEAD = [H(c) for c in ('#3f3850', '#6f667f', '#a19ab0', '#cdc8d8')]
CLOTH = [H(c) for c in ('#0d0a13', '#1a1424', '#2b2237', '#3f344d')]
RAG = [H(c) for c in ('#47424f', '#6a6575', '#908a9b', '#b3adbd')]
HAIR = [H(c) for c in ('#05040a', '#0d0b13', '#17141f', '#26222f', '#3a3547')]
CLAW = [H(c) for c in ('#6b647a', '#a29bb0', '#c9c4d4', '#e6e2ee')]
EYE, EYE_HOT, EYE_GLOW = H('#ff2d2d'), H('#ffc2b0'), H('#7a1019')
MOUTH, TEETH = H('#2a0610'), H('#d9d1da')
BLIND = [H(c) for c in ('#8f8ba0', '#c3c0cf', '#e3e1ec', '#fbfaff')]          # clouded, pupil-less eyes
FANG = [H(c) for c in ('#8d8062', '#c2b693', '#e6dcbc', '#fbf6e4')]           # yellowed bone teeth
BLOOD = [H(c) for c in ('#26030a', '#560a14', '#8a1222', '#c01c30')]          # blood / raw mouth
BONE = [H(c) for c in ('#4a4258', '#8a8298', '#bfb8cb', '#ece8f2')]           # spikes, ribs
OUTLINE = H('#050409')
PALETTE = np.array(sorted({c[:3] for r in (BODY, LIMB, HEAD, CLOTH, RAG, HAIR, CLAW, BLIND, FANG, BLOOD, BONE) for c in r}
                          | {EYE[:3], EYE_HOT[:3], EYE_GLOW[:3], MOUTH[:3], TEETH[:3], OUTLINE[:3]}), dtype=np.int32)

DIRS = 8
ANIMS = {   # name: (frames, fps, loop)
    'idle': (4, 4, True),
    'crawl': (6, 9, True),
    'chase': (6, 16, True),
}

# --------------------------------------------------------------------------- projection
def proj(p, a):
    """Model point (x forward, y right, z up) -> (screen x, screen y, depth) for a creature travelling at angle a
    (0 = away from the camera, 90 deg = to the right of the screen, 180 deg = toward the camera)."""
    x, y, z = p[0] - XSHIFT, p[1], p[2]
    sa, ca = math.sin(a), math.cos(a)
    cx = x * sa + y * ca              # camera-right component
    cy = x * ca - y * sa              # camera-forward (away) component
    return CX + cx * PPU, GROUND_Y - (z * COS_T + cy * SIN_T) * PPU, cy * COS_T - z * SIN_T

def facing_camera(n, a):
    """n = outward surface normal in model space. True when that surface can be seen."""
    sa, ca = math.sin(a), math.cos(a)
    cx = n[0] * sa + n[1] * ca; cy = n[0] * ca - n[1] * sa; z = n[2]
    return (cy * COS_T - z * SIN_T) < 0.12

# --------------------------------------------------------------------------- drawing primitives (all coordinates 1x)
class Canvas:
    def __init__(self):
        self.im = Image.new('RGBA', (FW * S, FH * S), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)
        self.prims = []

    def add(self, depth, fn): self.prims.append((depth, fn))

    def circle(self, x, y, r, col):
        r = max(r, 0.4)
        self.d.ellipse(((x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S), fill=col)

    def sphere(self, c, r, ramp, a, bias=0.0):
        sx, sy, dp = proj(c, a); R = r * PPU
        def fn():
            self.circle(sx, sy, R, ramp[0])
            for ox, oy, k, i in ((-.14, -.14, .84, 1), (-.30, -.32, .52, 2), (-.40, -.44, .20, 3)):
                self.circle(sx + ox * R, sy + oy * R, R * k, ramp[i])
        self.add(dp + bias, fn)

    def capsule(self, p0, p1, r0, r1, ramp, a, bias=0.0):
        s0, s1 = proj(p0, a), proj(p1, a)
        L = math.hypot(s1[0] - s0[0], s1[1] - s0[1]); n = max(2, int(L / 1.0))
        def fn():
            for ox, oy, k, i in ((0, 0, 1.0, 0), (-.16, -.2, .72, 1), (-.32, -.4, .36, 2)):
                for j in range(n + 1):
                    u = j / n; r = (r0 + (r1 - r0) * u) * PPU
                    self.circle(s0[0] + (s1[0] - s0[0]) * u + ox * r, s0[1] + (s1[1] - s0[1]) * u + oy * r, r * k, ramp[i])
        self.add((s0[2] + s1[2]) / 2 + bias, fn)

    def poly_line(self, pts, widths, col, depth, hi=None):
        """Hair strand segment chain element: one segment between two projected points with round ends."""
        (x0, y0), (x1, y1) = pts; w0, w1 = widths
        def fn():
            wd = max(1.6, (w0 + w1) * 0.5)
            self.d.line((x0 * S, y0 * S, x1 * S, y1 * S), fill=col, width=max(1, int(round(wd * S))))
            self.circle(x1, y1, wd * 0.5, col)
            if hi is not None:
                self.d.line(((x0 - .5) * S, (y0 - .6) * S, (x1 - .5) * S, (y1 - .6) * S), fill=hi, width=max(1, int(w0 * 0.32 * S)))
        self.add(depth, fn)

    def render(self):
        for _, fn in sorted(self.prims, key=lambda t: -t[0]):   # far to near
            fn()
        return self.im

# --------------------------------------------------------------------------- rig
def norm(v): v = np.asarray(v, dtype=float); return v / (np.linalg.norm(v) + 1e-9)

def ik(Sh, T, l1, l2, pole):
    Sh = np.array(Sh, float); T = np.array(T, float); v = T - Sh; d = np.linalg.norm(v)
    mx = (l1 + l2) * 0.985
    if d > mx: v = v / d * mx; T = Sh + v; d = mx
    u = v / d; a_ = (l1 * l1 - l2 * l2 + d * d) / (2 * d); h = math.sqrt(max(l1 * l1 - a_ * a_, 0))
    pole = np.array(pole, float); pp = pole - u * np.dot(pole, u); pp = pp / (np.linalg.norm(pp) + 1e-9)
    return Sh + u * a_ + pp * h, T

def ss(x): x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)

def make_strands(seed=11):
    """Hair grows in locks (3-4 strands that move together) so it reads as heavy clumps, not wire."""
    rng = random.Random(seed); out = []
    def add(az, el, L, ph, tone, w, spread, fringe, shine):
        out.append(dict(az=az, el=el, L=L, ph=ph, tone=tone, w=w, spread=spread, fringe=fringe, shine=shine, floor=0.02 + rng.random() * 0.025))
    for lk in range(18):                                         # locks all round the skull (the face sector stays clear)
        side = 1 if lk % 2 else -1
        back_of_head = lk % 3 != 0
        az = side * (rng.uniform(1.9, 3.14) if back_of_head else rng.uniform(1.25, 1.85))
        el = math.radians(rng.choice([rng.uniform(0, 30), rng.uniform(30, 80)]))
        L = rng.uniform(0.95, 1.45) if back_of_head else rng.uniform(0.6, 0.95); ph = rng.uniform(0, 6.28); spread = rng.uniform(-1, 1)
        for j in range(rng.choice([3, 4, 4])):
            add(az + rng.uniform(-.16, .16), el + rng.uniform(-.12, .12), L * rng.uniform(.8, 1.08), ph + rng.uniform(-.3, .3),
                rng.choice([0, 1, 1, 2, 2]), rng.uniform(.06, .1), spread + rng.uniform(-.2, .2), False, rng.random() < 0.22)
    for j in range(16):                                          # thin flyaway wisps
        add(rng.choice([-1, 1]) * rng.uniform(1.3, 3.1), math.radians(rng.uniform(10, 80)), rng.uniform(0.9, 1.5), rng.uniform(0, 6.28),
            rng.choice([1, 2, 3]), rng.uniform(.018, .03), rng.uniform(-1.4, 1.4), False, rng.random() < 0.5)
    for sd in (-1, 1):                                           # face-framing curtains: short, hang beside the eyes
        for j in range(2):
            add(sd * rng.uniform(.5, 1.25), math.radians(rng.uniform(40, 78)), rng.uniform(.3, .5), rng.uniform(0, 6.28),
                rng.choice([0, 1, 2]), rng.uniform(.04, .06), sd * 1.2, True, False)
    return out
STRANDS = make_strands()

def pose(anim, t):
    """All joint positions for animation `anim` at loop time t in [0, 1). Model space: x forward, y right, z up."""
    ph = 2 * math.pi * t
    if anim == 'idle':      # rears up and LISTENS: head high, jaw hanging open, ears up
        stride, lift, low, flow, amp, freq, headdrop = 0.0, 0.0, -0.07, 0.0, 0.06, 1, -0.14
        gait = 0.0; bob = 0.025 * math.sin(ph); jaw = 0.32 + 0.09 * math.sin(ph)
    elif anim == 'crawl':   # creeping, jaw working
        stride, lift, low, flow, amp, freq, headdrop = 0.34, 0.20, 0.0, 0.45, 0.10, 1, 0.0
        gait = ph; bob = 0.03 * math.cos(2 * ph); jaw = 0.36 + 0.12 * math.sin(2 * ph)
    else:                   # chase: low, long reach, hair streaming, jaw gaping and snapping
        stride, lift, low, flow, amp, freq, headdrop = 0.50, 0.26, 0.13, 1.0, 0.15, 2, 0.08
        gait = ph; bob = 0.045 * math.cos(2 * ph); jaw = 0.74 + 0.14 * math.sin(4 * ph)
    z0 = 0.52 - low + bob
    hip = np.array([-0.50, 0, z0 - 0.02]); chest = np.array([0.34, 0, z0 + 0.16 + 0.02 * math.sin(gait)])
    head = chest + np.array([0.56 + 0.10 * (anim == 'chase'), 0.05 * math.sin(gait + 0.6), 0.06 - headdrop + 0.02 * math.sin(ph)])
    limbs = []
    for side in (1, -1):
        for front in (True, False):
            lph = gait + (0 if (side == 1) == front else math.pi)             # diagonal gait: FR+HL, FL+HR
            x0 = 0.95 if front else -0.88; y0 = 0.52 if front else 0.52
            L = stride * (1.0 if front else 0.85)
            tgt = np.array([x0 + L * math.cos(lph), side * (y0 + 0.07 * max(0, -math.sin(lph))), 0.04 + lift * max(0.0, -math.sin(lph))])
            sh = np.array([0.32, side * 0.30, chest[2] + 0.05]) if front else np.array([-0.50, side * 0.28, hip[2] + 0.03])
            l1, l2 = (0.64, 0.72) if front else (0.60, 0.66)
            pole = [-0.35, side * 1.0, 0.55] if front else [0.45, side * 0.9, 0.5]
            elbow, tip = ik(sh, tgt, l1, l2, pole)
            limbs.append(dict(side=side, front=front, sh=sh, el=elbow, tip=tip, lift=max(0.0, -math.sin(lph))))
    return dict(hip=hip, chest=chest, head=head, limbs=limbs, ph=ph, t=t, flow=flow, amp=amp, freq=freq, chase=(anim == 'chase'), anim=anim, jaw=jaw)

def hair_points(st, P, head_c):
    """Chain of 3D points for one strand: grows from the scalp, falls back and down, lies on the floor, sways with time."""
    cosel, sinel = math.cos(st['el']), math.sin(st['el'])
    n0 = np.array([math.cos(st['az']) * cosel, math.sin(st['az']) * cosel, sinel])
    pos = head_c + n0 * (0.30 * HS)
    M = 11; seg = st['L'] / M; pts = [pos.copy()]
    back = 0.22 + 0.55 * P['flow'] + (0.3 if abs(st['az']) < 2.0 else 0.0)
    grav = norm([-back, st['spread'] * 0.35 + math.sin(st['az']) * 0.3, -1.0])
    if st['fringe']: grav = norm([0.15, math.sin(st['az']) * 1.4, -1.0])
    d = n0.copy()
    for k in range(1, M + 1):
        u = k / M
        d = norm(n0 * (1 - ss(u * 2.8)) + grav * ss(u * 2.8))
        wph = 2 * math.pi * P['freq'] * P['t'] - k * 0.55 + st['ph']
        d = norm(d + np.array([0.55 * math.cos(wph + 1.3), 1.0 * math.sin(wph), 0.0]) * P['amp'] * (u ** 0.9) * 3.2)
        pos = pos + d * seg
        if pos[2] < st['floor']:
            pos[2] = st['floor']; d = norm([d[0], d[1], 0.0])
        pts.append(pos.copy())
    return pts

# --------------------------------------------------------------------------- one frame
class HeadCV:
    """Draws head parts scaled by k around the head centre, so the whole face can be enlarged in one place."""
    def __init__(self, cv, c, k): self.cv, self.c, self.k = cv, np.asarray(c, float), k
    def _p(self, p): return self.c + (np.asarray(p, float) - self.c) * self.k
    def sphere(self, c, r, ramp, a, bias=0.0): self.cv.sphere(self._p(c), r * self.k, ramp, a, bias)
    def capsule(self, p0, p1, r0, r1, ramp, a, bias=0.0): self.cv.capsule(self._p(p0), self._p(p1), r0 * self.k, r1 * self.k, ramp, a, bias)

def tooth(cv, base, tip, r, a, bias):
    cv.capsule(base, tip, r, max(0.006, r * 0.12), FANG, a, bias=bias)

def draw_frame(anim, t, a):
    P = pose(anim, t); cv = Canvas()
    hip, chest, head = P['hip'], P['chest'], P['head']
    sway = lambda k, amp=0.05: amp * math.sin(P['ph'] * (1 if P['anim'] != 'chase' else 2) + k)

    # --- TAIL: a bony spiked whip behind the hips
    tail1 = hip + [-0.45, sway(0.4, 0.09), 0.02]; tail2 = tail1 + [-0.42, sway(1.3, 0.16), 0.10 + 0.06 * P['flow']]
    cv.capsule(hip + [-0.1, 0, 0.0], tail1, 0.14, 0.085, LIMB, a, bias=0.05); cv.capsule(tail1, tail2, 0.085, 0.02, LIMB, a, bias=0.05)
    for p0, up in ((tail1, 0.17), (tail1 + (tail2 - tail1) * 0.55, 0.13)):
        cv.capsule(p0 + [0, 0, 0.05], p0 + [-0.05, 0, up + 0.05], 0.035, 0.005, BONE, a, bias=0.04)

    # --- TORSO: thick barrel chest, hunched shoulder hump, ribs showing, torn cloth, hanging rags
    cv.capsule(hip + [-0.05, 0, 0.0], chest, 0.27, 0.31, BODY, a)
    cv.sphere(chest + [-0.04, 0, 0.02], 0.34, BODY, a, bias=0.02)                                            # chest
    cv.sphere(chest + [-0.20, 0, 0.20], 0.25, BODY, a, bias=-0.01)                                           # shoulder hump
    cv.capsule(hip + [-0.12, 0, -0.01], hip + [0.24, 0, 0.02], 0.29, 0.28, CLOTH, a, bias=-0.04)              # hip wrap
    cv.capsule(hip + [0.05, 0.18, 0.15], chest + [-0.1, -0.15, 0.22], 0.085, 0.07, CLOTH, a, bias=-0.05)      # torn sash across the back
    cv.capsule(hip + [0.1, -0.19, 0.12], chest + [-0.18, 0.17, 0.2], 0.07, 0.06, RAG, a, bias=-0.055)
    for side in (1, -1):                                                                                    # ribs on both flanks
        for u in (0.30, 0.46, 0.62, 0.78, 0.92):
            c0 = hip + (chest - hip) * u
            cv.capsule(c0 + [0, side * 0.285, 0.15], c0 + [0.05, side * 0.30, -0.08], 0.026, 0.02, BONE, a, bias=-0.08)
    for u in (0.05, 0.28, 0.5, 0.72, 0.95):                                                                 # spine spikes
        b0 = hip + (chest - hip) * u + [-0.02, 0, 0.30]; up = 0.13 + 0.14 * math.sin(math.pi * (0.15 + 0.7 * u))
        cv.capsule(b0, b0 + [-0.07, 0, up], 0.058, 0.006, BONE, a, bias=-0.06)
    for i, (u, sd) in enumerate(((0.02, 1), (0.16, -1), (0.32, 1), (0.08, -1), (0.45, -1))):                # hanging rag strips
        top = hip + (chest - hip) * u + [0, sd * 0.26, 0.06]
        cv.capsule(top, top + [-0.14 - 0.08 * P['flow'], sd * 0.09 + sway(i * 1.7), -0.24], 0.06, 0.018, RAG if i % 2 == 0 else CLOTH, a, bias=-0.03)
    cv.capsule(chest + [0.08, 0.26, 0.08], chest + [0.22, 0.2, -0.17], 0.05, 0.02, BLOOD, a, bias=-0.07)    # wounds / blood on the chest
    cv.capsule(chest + [0.04, -0.26, 0.1], chest + [0.18, -0.22, -0.14], 0.04, 0.015, BLOOD, a, bias=-0.07)

    # --- NECK + HEAD. The head is BIG: cranium, long muzzle, dropped lower jaw, ears, brow, blind eyes, many fangs.
    cv.capsule(chest + [0.12, 0, 0.0], head + [-0.10, 0, -0.04], 0.21, 0.18, BODY, a)
    hc = HeadCV(cv, head, HS)
    hc.sphere(head + [-0.10, 0, 0.11], 0.31, [HAIR[0], HAIR[1], HAIR[2], HAIR[3]], a, bias=0.05)             # scalp / hair mass behind the head
    hc.sphere(head, 0.31, HEAD, a)                                                                            # cranium
    jaw = P['jaw']; cj, sj = math.cos(jaw), math.sin(jaw)
    mu_a, mu_b = head + [0.12, 0, -0.01], head + [0.46, 0, -0.07]
    hc.capsule(mu_a, mu_b, 0.20, 0.155, HEAD, a, bias=-0.05)                                                  # upper jaw / muzzle
    piv = head + [0.00, 0, -0.14]; jdir = np.array([cj, 0, -sj]); jup = np.array([sj, 0, cj])
    jend = piv + jdir * 0.56
    hc.capsule(piv, jend, 0.14, 0.12, LIMB, a, bias=-0.05)                                                    # lower jaw
    hc.capsule(piv + jdir * 0.30 + jup * -0.05, jend + jup * -0.06, 0.09, 0.07, BLOOD, a, bias=-0.07)         # blood-soaked chin
    # mouth interior: dark raw red between the jaws (drawn behind jaws and teeth)
    mid = (mu_b + piv + jdir * 0.42) / 2 + [-0.12, 0, 0.0]
    hc.sphere(mid, 0.17 + 0.10 * jaw, BLOOD, a, bias=0.10)
    hc.capsule(piv + jdir * 0.12, piv + jdir * 0.52 + jup * 0.07, 0.07, 0.06, BLOOD, a, bias=-0.04)           # tongue
    # teeth: U-shaped rows, FEW but BIG so each fang reads on its own. Long canines up top, tusks on the lower jaw.
    for sv, Lu, ru in ((-0.92, 0.17, 0.05), (-0.46, 0.34, 0.07), (0.0, 0.2, 0.055), (0.46, 0.34, 0.07), (0.92, 0.17, 0.05)):
        rim_x = 0.47 - 0.30 * abs(sv) ** 1.5; rim_y = 0.215 * sv
        b0 = head + [rim_x, rim_y, -0.115]
        tooth(hc, b0 + [0, 0, 0.03], b0 + [0.03, 0, -Lu], ru, a, -0.09)
    for sv, Ll, rr in ((-0.86, 0.30, 0.065), (-0.3, 0.15, 0.05), (0.3, 0.15, 0.05), (0.86, 0.30, 0.065)):
        rim_x = 0.47 - 0.30 * abs(sv) ** 1.5; rim_y = 0.215 * sv
        rl = piv + jdir * (rim_x - 0.10) + jup * 0.045 + np.array([0, rim_y * 0.9, 0])
        tooth(hc, rl - jup * 0.02, rl + jup * Ll + jdir * 0.03, rr, a, -0.085)
    for sd in (-1, 1):
        # ears: big bat-like horns of cartilage, pricked up and out
        base = head + [-0.06, sd * 0.25, 0.13]; tipE = head + [-0.22, sd * 0.66, 0.46 + (0.06 if anim_idle(P) else 0.0)]
        hc.capsule(base, tipE, 0.12, 0.012, HEAD, a, bias=0.03)
        hc.capsule(base + [0.03, sd * 0.03, 0.0], tipE + [0.04, -sd * 0.04, -0.07], 0.07, 0.008, BLOOD, a, bias=0.02)
        # sunken eye sockets + clouded blind eyes
        eo = np.array([0.255, sd * 0.150, 0.085])
        hc.sphere(head + eo + [0.0, 0, 0.0], 0.12, CLOTH, a, bias=-0.07)
        eye_r = 0.078 if sd > 0 else 0.062
        hc.sphere(head + eo + [0.045, sd * 0.005, 0.0], eye_r, BLIND, a, bias=-0.1)
        hc.capsule(head + eo + [0.07, 0, 0.03], head + eo + [0.10, sd * 0.02, -0.02], 0.012, 0.01, BLOOD, a, bias=-0.11)   # cracked, bloodshot
        # angry brow ridge slanting down toward the nose
        hc.capsule(head + [0.215, sd * 0.285, 0.21], head + [0.325, sd * 0.045, 0.145], 0.06, 0.05, HEAD, a, bias=-0.095)
        # nostril slit
        hc.sphere(head + [0.50, sd * 0.045, 0.045], 0.032, CLOTH, a, bias=-0.1)
    # --- limbs: heavy arms and legs, elbow spurs, huge claws
    for L in P['limbs']:
        for p0, p1, r0, r1 in ((L['sh'], L['el'], 0.17, 0.115), (L['el'], L['tip'], 0.115, 0.075)):
            cv.capsule(p0, p1, r0, r1, LIMB, a, bias=0.01)
        cv.sphere(L['el'], 0.12, LIMB, a, bias=0.02)                           # knobbly joint
        cv.capsule(L['el'], L['el'] + [-0.06, L['side'] * 0.14, 0.2], 0.05, 0.005, BONE, a, bias=0.0)   # elbow spur
        cv.sphere(L['tip'], 0.125, HEAD, a, bias=0.03)
        for k in (-1.5, -0.5, 0.5, 1.5):                                        # splayed claws
            ang = k * 0.34 * L['side'] + (0.0 if L['front'] else 0.3 * L['side'])
            f0 = L['tip']; f1 = f0 + [0.26 * math.cos(ang), 0.26 * math.sin(ang) + 0.012 * k, -0.01 + 0.04 * L['lift']]
            f1[2] = max(0.02, f1[2]); f2 = f1 + [0.2 * math.cos(ang), 0.2 * math.sin(ang), -0.04]; f2[2] = max(0.012, f2[2])
            cv.capsule(f0, f1, 0.04, 0.026, BONE, a, bias=0.04)
            cv.capsule(f1, f2, 0.028, 0.006, CLAW, a, bias=0.045)

    # --- hair (every segment is depth-sorted with the body, so it falls both in front of and behind the head)
    for st in STRANDS:
        pts = hair_points(st, P, head)
        col = HAIR[min(4, st['tone'] + (1 if st['shine'] else 0))]
        hi = HAIR[4] if st['shine'] else None
        for k in range(len(pts) - 1):
            p0, p1 = proj(pts[k], a), proj(pts[k + 1], a)
            u = k / (len(pts) - 1)
            w0 = st['w'] * PPU * (1 - 0.7 * u); w1 = st['w'] * PPU * (1 - 0.7 * (u + 1 / (len(pts) - 1)))
            shade = HAIR[max(0, min(4, st['tone'] + (1 if (p0[1] < GROUND_Y - 48) else 0)))] if not st['shine'] else col
            cv.poly_line([(p0[0], p0[1]), (p1[0], p1[1])], (w0, w1), shade, (p0[2] + p1[2]) / 2 - 0.015 - (0.04 if st['fringe'] else 0.0), hi)
    return cv.render()

def anim_idle(P): return P['anim'] == 'idle'

# --------------------------------------------------------------------------- post-processing -> clean pixel art
def to_pixels(big):
    a = np.asarray(big, dtype=np.float32)                                    # (FH*S, FW*S, 4)
    al = a[..., 3:4] / 255.0
    blk = lambda x: x.reshape(FH, S, FW, S, -1).sum(axis=(1, 3))
    cnt = blk(al); col = blk(a[..., :3] * al) / np.maximum(cnt, 1e-6)
    alpha = cnt[..., 0] / (S * S)
    solid = alpha >= 0.5
    rgb = col.reshape(-1, 3)[:, None, :] - PALETTE[None, :, :]
    idx = np.argmin((rgb ** 2).sum(-1), axis=1)
    out = np.zeros((FH, FW, 4), np.uint8)
    q = PALETTE[idx].reshape(FH, FW, 3)
    out[solid, :3] = q[solid]; out[solid, 3] = 255
    # 1px dark outline around the silhouette
    pad = np.pad(solid, 1); nb = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
    ring = nb & ~solid
    out[ring, :3] = OUTLINE[:3]; out[ring, 3] = 255
    return Image.fromarray(out, 'RGBA')

def frame(anim, i, n, d):
    return to_pixels(draw_frame(anim, i / n, math.radians(45 * d)))

def build_crawler():
    rows = []
    for anim, (n, fps, loop) in ANIMS.items():
        for d in range(DIRS):
            frames = []
            for i in range(n):
                px = Px(FW, FH); px.im = frame(anim, i, n, d); px.p = px.im.load(); frames.append(px)
            rows.append((f'crawler_{anim}_{d}', frames, fps, loop))
    return rows, FW, FH

if __name__ == '__main__':
    import sys
    # quick contact sheet for eyeballing:  python3 gen_crawler.py out.png
    rows, fw, fh = build_crawler()
    sheet = Image.new('RGBA', (6 * fw, len(rows) * fh), (24, 22, 30, 255))
    for r, (k, frs, fps, loop) in enumerate(rows):
        for i, f in enumerate(frs): sheet.alpha_composite(f.im, (i * fw, r * fh))
    sheet.save(sys.argv[1] if len(sys.argv) > 1 else 'crawler_preview.png')
