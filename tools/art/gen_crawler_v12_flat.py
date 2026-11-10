"""The crawling ghost girl (v12: NO legs, NO teeth, NO big mouth: a pale dead human face with blood tears; only two arms drag her body along): long messy black hair hiding most of her face, an enormous unhinged mouth full of sharp teeth,
pale grey skin, a big distorted hunched body under a long torn dirty white-grey dress, four elongated limbs with long
fingers and claws. Moves on all fours.

Drawn procedurally (nothing is copied from any reference image): a small posed 3D skeleton projected from 8 camera angles into
hard-edged, palette-limited pixel art, so every direction is consistent and every loop is seamless.

Sprite sheet:  rows = (anim, direction) pairs, cols = frames.  Direction index d = travel direction relative to the camera:
0 = away (back view), 1 = away-right, 2 = right, 3 = toward-right, 4 = toward camera (front view), 5 = toward-left, 6 = left, 7 = away-left.
"""
import math, random
import numpy as np
from PIL import Image, ImageDraw
from pixel import Px

FW, FH = 236, 148            # frame size (the player frame is 32x40: the creature is about three times as big)
S = 3                       # supersampling used while drawing, reduced with a hard threshold afterwards
PPU = 50                    # pixels per model unit
GROUND_Y = 84              # screen row of the ground point under the creature
CX = FW / 2
TILT = math.radians(24)     # camera looks down a little
SIN_T, COS_T = math.sin(TILT), math.cos(TILT)
HS = 1.2                    # head scale: the face is the scariest thing about it, so it is BIG
XSHIFT = 0.16               # centre the model (head is further forward than the hips are back)

def H(h):
    h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)

SKIN = [H(c) for c in ('#34333b', '#625f6b', '#9a97a4', '#cbc8d3')]            # pale grey ghost skin
LIMB = [H(c) for c in ('#2b2a32', '#4d4b57', '#7d7a89', '#a9a6b4')]
BODY, HEAD = SKIN, SKIN
DRESS = [H(c) for c in ('#46434f', '#7a7685', '#adaab9', '#dfdce8')]            # dirty white-grey dress
GRIME = [H(c) for c in ('#26222a', '#433c42', '#675d63', '#8a7e83')]            # dirt / old stains
CLOTH, RAG = GRIME, DRESS
HAIR = [H(c) for c in ('#05040a', '#0d0b13', '#17141f', '#26222f', '#3a3547')]
CLAW = [H(c) for c in ('#6b647a', '#a29bb0', '#c9c4d4', '#e6e2ee')]
EYE, EYE_HOT, EYE_GLOW = H('#ff2d2d'), H('#ffc2b0'), H('#7a1019')
BLIND = [H(c) for c in ('#8f8ba0', '#c3c0cf', '#e3e1ec', '#fbfaff')]
FANG = [H(c) for c in ('#8d8062', '#c2b693', '#e6dcbc', '#fbf6e4')]
BLOOD = [H(c) for c in ('#26030a', '#560a14', '#8a1222', '#c01c30')]
BONE = CLAW
THROAT = [H(c) for c in ('#14020a', '#26040c', '#3c0710', '#560a16')]
MOUTH, TEETH = H('#2a0610'), H('#d9d1da')
OUTLINE = H('#050409')
PALETTE = np.array(sorted({c[:3] for r in (SKIN, LIMB, DRESS, GRIME, HAIR, CLAW, BLIND, FANG, BLOOD, THROAT) for c in r}
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

    def panel(self, p0, p1, w0, w1, ramp, tone, a, bias=0.0, seed=0):
        """A torn strip of cloth: tapers from w0 to w1 (model units), jagged hem, light edge + a dark fold line. Flat colours."""
        s0, s1 = proj(p0, a), proj(p1, a)
        dx, dy = s1[0] - s0[0], s1[1] - s0[1]; Ln = math.hypot(dx, dy) or 1.0; nx, ny = -dy / Ln, dx / Ln
        rnd = random.Random(seed); W0, W1 = w0 * PPU, w1 * PPU
        j1, j2, j3 = rnd.uniform(0.04, 0.16), rnd.uniform(0.0, 0.1), rnd.uniform(0.04, 0.16); fold = rnd.uniform(-0.25, 0.25)
        def at(u, off):       # point along the strip at fraction u, offset off (+-0.5 = edges) in units of the local width
            w = W0 + (W1 - W0) * u
            return (s0[0] + dx * u + nx * w * off, s0[1] + dy * u + ny * w * off)
        def fn():
            poly = [at(0, -.5), at(0.8, -.55), at(1 + j1, -.4), at(0.93 - j2, -.1), at(1 + j3, .1), at(0.85, .5), at(0, .5)]
            self.d.polygon([(x * S, y * S) for x, y in poly], fill=ramp[tone])
            hl = [at(0, -.5), at(0.8, -.55), at(0.8, -.3), at(0, -.2)]
            self.d.polygon([(x * S, y * S) for x, y in hl], fill=ramp[min(3, tone + 1)])
            fa, fb = at(0.05, fold), at(0.9, fold + 0.05)
            self.d.line((fa[0] * S, fa[1] * S, fb[0] * S, fb[1] * S), fill=ramp[max(0, tone - 1)], width=max(1, int(S * 0.9)))
        self.add((s0[2] + s1[2]) / 2 + bias, fn)

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
    def add(az, el, L, ph, tone, w, spread, front, shine):
        out.append(dict(az=az, el=el, L=L, ph=ph, tone=tone, w=w, spread=spread, fringe=front, shine=shine, floor=0.02 + rng.random() * 0.025))
    for lk in range(30):                                         # long locks flowing back over the shoulders and onto the floor
        side = 1 if lk % 2 else -1
        az = side * rng.uniform(1.0, 3.14)
        el = math.radians(rng.choice([rng.uniform(0, 30), rng.uniform(30, 80)]))
        L = rng.uniform(1.3, 1.9); ph = rng.uniform(0, 6.28); spread = rng.uniform(-1, 1)
        for j in range(rng.choice([3, 4, 4])):
            add(az + rng.uniform(-.16, .16), el + rng.uniform(-.12, .12), L * rng.uniform(.8, 1.08), ph + rng.uniform(-.3, .3),
                rng.choice([0, 1, 1, 2, 2]), rng.uniform(.09, .13), spread + rng.uniform(-.2, .2), False, rng.random() < 0.22)
    for sd in (-1, 1):
        for lk in range(2):                                      # a few short locks at the temples; the face stays visible
            az = sd * rng.uniform(0.95, 1.2); el = math.radians(rng.uniform(45, 70)); L = rng.uniform(0.35, 0.5); ph = rng.uniform(0, 6.28)
            for j in range(3):
                add(az + rng.uniform(-.06, .06), el + rng.uniform(-.08, .08), L * rng.uniform(.85, 1.1), ph + rng.uniform(-.25, .25),
                    rng.choice([0, 0, 1]), rng.uniform(.07, .1), sd * 0.3, True, False)
        for lk in range(6):                                      # long curtains down both sides of the face, centre left clear for the mouth
            az = sd * rng.uniform(0.9, 1.45); el = math.radians(rng.uniform(10, 50)); L = rng.uniform(0.9, 1.4); ph = rng.uniform(0, 6.28)
            for j in range(3):
                add(az + rng.uniform(-.07, .07), el + rng.uniform(-.1, .1), L * rng.uniform(.85, 1.1), ph + rng.uniform(-.25, .25),
                    rng.choice([0, 0, 1, 2]), rng.uniform(.07, .11), sd * 0.5, True, rng.random() < 0.15)
    for j in range(16):                                          # thin flyaway wisps
        add(rng.choice([-1, 1]) * rng.uniform(1.3, 3.1), math.radians(rng.uniform(10, 80)), rng.uniform(0.9, 1.6), rng.uniform(0, 6.28),
            rng.choice([1, 2, 3]), rng.uniform(.02, .035), rng.uniform(-1.4, 1.4), False, rng.random() < 0.5)
    return out
STRANDS = make_strands()

def pose(anim, t):
    """All joint positions for animation `anim` at loop time t in [0, 1). Model space: x forward, y right, z up."""
    ph = 2 * math.pi * t
    if anim == 'idle':      # rears up and LISTENS: head raised, jaw hanging open
        stride, lift, low, flow, amp, freq, headdrop = 0.0, 0.0, -0.06, 0.0, 0.06, 1, -0.16
        gait = 0.0; bob = 0.025 * math.sin(ph); jaw = 0.78 + 0.08 * math.sin(ph)
    elif anim == 'crawl':   # creeping: alternating diagonal limbs, head swinging low, jaw wide open
        stride, lift, low, flow, amp, freq, headdrop = 0.36, 0.22, 0.0, 0.45, 0.10, 1, 0.0
        gait = ph; bob = 0.03 * math.cos(2 * ph); jaw = 0.92 + 0.10 * math.sin(2 * ph)
    else:                   # chase: low and fast, hair streaming, mouth stretched to the limit
        stride, lift, low, flow, amp, freq, headdrop = 0.52, 0.28, 0.14, 1.0, 0.15, 2, 0.08
        gait = ph; bob = 0.045 * math.cos(2 * ph); jaw = 1.16 + 0.10 * math.sin(4 * ph)
    z0 = 0.30 - low + bob                                                    # no legs: the body drags low on the floor
    hip = np.array([-0.55, 0, z0 - 0.12]); chest = np.array([0.30, 0, z0 + 0.24 + 0.02 * math.sin(gait)])
    head = chest + np.array([0.50 + 0.10 * (anim == 'chase'), 0.06 * math.sin(gait + 0.6), -0.04 - headdrop + 0.02 * math.sin(ph)])
    limbs = []
    for side in (1, -1):                                                     # ONLY two arms: they reach, plant and haul the body forward
        lph = gait + (0 if side == 1 else math.pi)
        x0, y0 = 0.95, 0.55; L = stride * 1.25
        tgt = np.array([x0 + L * math.cos(lph), side * (y0 + 0.08 * max(0, -math.sin(lph))), 0.04 + lift * 1.2 * max(0.0, -math.sin(lph))])
        sh = np.array([0.28, side * 0.30, chest[2] + 0.02])
        elbow, tip = ik(sh, tgt, 0.80, 0.92, [-0.2, side * 1.0, 1.0])
        limbs.append(dict(side=side, front=True, sh=sh, el=elbow, tip=tip, lift=max(0.0, -math.sin(lph))))
    return dict(hip=hip, chest=chest, head=head, limbs=limbs, ph=ph, t=t, flow=flow, amp=amp, freq=freq, chase=(anim == 'chase'), anim=anim, jaw=jaw)

def hair_points(st, P, head_c):
    """Chain of 3D points for one strand: grows from the scalp, falls back and down, lies on the floor, sways with time."""
    cosel, sinel = math.cos(st['el']), math.sin(st['el'])
    n0 = np.array([math.cos(st['az']) * cosel, math.sin(st['az']) * cosel, sinel])
    pos = head_c + n0 * (0.30 * HS)
    M = 11; seg = st['L'] / M; pts = [pos.copy()]
    back = 0.22 + 0.55 * P['flow'] + (0.3 if abs(st['az']) < 2.0 else 0.0)
    grav = norm([-back, st['spread'] * 0.35 + math.sin(st['az']) * 0.3, -1.0])
    if st['fringe']: grav = norm([0.34 if abs(st['az']) < 0.95 else 0.02, math.sin(st['az']) * 0.45, -1.0])
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
    ph = P['ph']; fr = 1 if anim != 'chase' else 2
    sway = lambda k, amp=0.05: amp * math.sin(ph * fr + k)

    # --- DRESS: a tent of torn cloth draped over the hunched back, hanging to the floor on both flanks, jagged hem, trailing rags behind
    cv.capsule(hip, chest, 0.2, 0.2, SKIN, a, bias=0.0)                                                    # (body under the cloth)
    cv.capsule(chest + [0.12, 0, 0.04], head + [-0.08, 0, -0.04], 0.15, 0.12, SKIN, a)                      # long thin neck
    rng = random.Random(5); n = 0
    for xi in range(11):
        x = 0.34 - 0.18 * xi
        t_ = 1.0 if x > -0.5 else max(0.45, 1.0 + (x + 0.5) * 0.55)                                          # cloth tapers into a dragged tail
        axz = hip[2] + (chest[2] - hip[2]) * max(0.0, min(1.0, (x + 0.55) / 0.85)) if x > -0.55 else max(0.10, hip[2] + (x + 0.55) * 0.12)
        hump = 0.10 * math.exp(-((x - 0.0) / 0.4) ** 2)                                                     # shoulder hump
        for fi in range(11):
            phi = math.radians(-100 + 20 * fi); n += 1
            top = np.array([x, 0.30 * t_ * math.sin(phi), axz + 0.26 * t_ * math.cos(phi) + hump * max(0.0, math.cos(phi))])
            ln = rng.uniform(0.0, 0.14) if abs(phi) > 1.0 else rng.uniform(0.0, 0.06)
            flare = 1.22 if abs(phi) > 0.9 else 1.0
            bot = np.array([x - 0.06 + sway(n * 0.9, 0.035), top[1] * flare + math.copysign(0.05, phi) * (abs(phi) > 1.0) + sway(n * 0.5, 0.025), 0.03 + ln])
            tone = rng.choice([1, 2, 2, 2, 3, 3]) if rng.random() > 0.14 else rng.choice([0, 1])
            cv.panel(top, bot, 0.20, 0.09, DRESS if tone > 0 or rng.random() < 0.6 else GRIME, tone, a, bias=0.0, seed=n)
    for i in range(9):                                                                                      # rags trailing behind on the floor
        yy = -0.20 + 0.05 * i; xx = -1.55 - 0.05 * (i % 2)
        cv.panel(np.array([xx, yy, 0.16]), np.array([xx - 0.34 + sway(i, 0.06), yy * 1.5, 0.03]), 0.14, 0.04,
                 DRESS if i % 3 else GRIME, rng.choice([1, 2, 2, 3]), a, bias=0.01, seed=100 + i)

    # --- HEAD: a pale, dead HUMAN face: sunken sockets with clouded white eyes, blood tears, small slack mouth, blood down the chin and chest
    hc = HeadCV(cv, head, HS)
    hc.sphere(head + [-0.08, 0, 0.10], 0.28, [HAIR[0], HAIR[1], HAIR[2], HAIR[3]], a, bias=0.05)           # scalp / hair mass behind the head
    hc.sphere(head, 0.28, SKIN, a)                                                                          # skull
    hc.capsule(head + [0.10, 0, -0.04], head + [0.19, 0, -0.20], 0.17, 0.10, SKIN, a, bias=-0.04)          # cheeks and narrow chin
    hc.sphere(head + [0.20, 0, -0.26], 0.075, SKIN, a, bias=-0.05)                                          # chin point
    for sd in (-1, 1):
        hc.sphere(head + [0.20, sd * 0.15, -0.03], 0.075, SKIN, a, bias=-0.06)                              # cheekbones
        eo = np.array([0.215, sd * 0.125, 0.085])
        hc.sphere(head + eo, 0.105, GRIME, a, bias=-0.07)                                                   # sunken, dark sockets
        hc.sphere(head + eo + [0.04, sd * 0.004, 0.0], 0.062, BLIND, a, bias=-0.1)                          # dead clouded eyes
        hc.capsule(head + eo + [0.07, 0, 0.0], head + eo + [0.085, 0, 0.0], 0.016, 0.012, GRIME, a, bias=-0.11)   # tiny shrunken pupil
        hc.capsule(head + [0.205, sd * 0.30, 0.20], head + [0.27, sd * 0.07, 0.15], 0.04, 0.035, SKIN, a, bias=-0.095)  # heavy brow
        # blood tears running down the cheeks
        hc.capsule(head + [0.245, sd * 0.13, 0.03], head + [0.265, sd * 0.16, -0.20 - 0.03 * sd], 0.032, 0.012, BLOOD, a, bias=-0.115)
        hc.capsule(head + [0.24, sd * 0.10, 0.04], head + [0.25, sd * 0.10, -0.06], 0.02, 0.012, BLOOD, a, bias=-0.115)
    hc.sphere(head + [0.305, 0, -0.03], 0.05, SKIN, a, bias=-0.1)                                            # nose
    hc.capsule(head + [0.26, -0.07, -0.13], head + [0.26, 0.07, -0.13], 0.03, 0.03, THROAT, a, bias=-0.1)   # small slack mouth, slightly open
    hc.capsule(head + [0.27, -0.05, -0.145], head + [0.27, 0.05, -0.145], 0.02, 0.02, BLOOD, a, bias=-0.11)  # blood on the lips
    hc.capsule(head + [0.265, -0.04, -0.14], head + [0.255, -0.03, -0.30], 0.026, 0.012, BLOOD, a, bias=-0.115)   # blood dripping from the mouth
    hc.capsule(head + [0.265, 0.05, -0.14], head + [0.25, 0.06, -0.26], 0.02, 0.01, BLOOD, a, bias=-0.115)
    hc.capsule(head + [0.20, 0.0, -0.30], head + [0.12, 0.0, -0.40], 0.03, 0.012, BLOOD, a, bias=-0.115)    # drips off the chin
    hc.capsule(head + [0.22, 0.17, 0.20], head + [0.26, 0.12, 0.05], 0.02, 0.012, BLOOD, a, bias=-0.115)    # a streak from the forehead
    cv.panel(chest + [0.30, 0.0, -0.02], chest + [0.34, 0.03, -0.30], 0.13, 0.04, BLOOD, 1, a, bias=-0.12, seed=77)   # blood soaked down the front of the dress
    cv.panel(chest + [0.2, 0.12, -0.04], chest + [0.24, 0.14, -0.22], 0.08, 0.03, BLOOD, 0, a, bias=-0.12, seed=78)

    # --- limbs: long, thin, spidery; knobbly joints; long fingers with claws
    for L in P['limbs']:
        for p0, p1, r0, r1 in ((L['sh'], L['el'], 0.10, 0.06), (L['el'], L['tip'], 0.06, 0.042)):
            cv.capsule(p0, p1, r0, r1, SKIN, a, bias=-0.1)
        cv.sphere(L['el'], 0.058, SKIN, a, bias=-0.1)
        cv.sphere(L['tip'], 0.07, SKIN, a, bias=-0.1)
        for k in (-2, -1, 0, 1, 2):                                                                         # five long fingers
            ang = k * 0.30 * L['side'] + (0.0 if L['front'] else 0.25 * L['side'])
            f0 = L['tip'].copy(); lf = 1.0 - 0.12 * abs(k)
            f1 = f0 + [0.30 * lf * math.cos(ang), 0.30 * lf * math.sin(ang), -0.01 + 0.05 * L['lift']]; f1[2] = max(0.02, f1[2])
            f2 = f1 + [0.24 * lf * math.cos(ang), 0.24 * lf * math.sin(ang), -0.03]; f2[2] = max(0.014, f2[2])
            f3 = f2 + [0.17 * lf * math.cos(ang + 0.12 * L['side']), 0.17 * lf * math.sin(ang + 0.12 * L['side']), -0.02]; f3[2] = max(0.01, f3[2])
            cv.capsule(f0, f1, 0.03, 0.022, SKIN, a, bias=-0.09)
            cv.capsule(f1, f2, 0.022, 0.016, SKIN, a, bias=-0.09)
            cv.capsule(f2, f3, 0.016, 0.004, CLAW, a, bias=-0.09)

    # --- hair (every segment is depth-sorted with the body; the front curtains are drawn over the face)
    for st in STRANDS:
        pts = hair_points(st, P, head)
        col = HAIR[min(4, st['tone'] + (1 if st['shine'] else 0))]
        hi = HAIR[4] if st['shine'] else None
        for k in range(len(pts) - 1):
            p0, p1 = proj(pts[k], a), proj(pts[k + 1], a)
            u = k / (len(pts) - 1)
            w0 = st['w'] * PPU * (1 - 0.7 * u); w1 = st['w'] * PPU * (1 - 0.7 * (u + 1 / (len(pts) - 1)))
            shade = HAIR[max(0, min(4, st['tone'] + (1 if (p0[1] < GROUND_Y - 0.9 * PPU) else 0)))] if not st['shine'] else col
            cv.poly_line([(p0[0], p0[1]), (p1[0], p1[1])], (w0, w1), shade, (p0[2] + p1[2]) / 2 - 0.015 - (0.5 if st['fringe'] else (0.3 if abs(st['az']) > 1.9 else 0.05)), hi)
    return cv.render()

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
