"""Tiny pixel-art toolkit used by the asset generators (PIL only)."""
import random
from PIL import Image

def H(c, a=255):
    if isinstance(c, tuple):
        return c if len(c) == 4 else (*c, a)
    c = c.lstrip('#')
    if len(c) == 3: c = ''.join(ch * 2 for ch in c)
    return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), a)

def mix(c1, c2, t):
    a, b = H(c1), H(c2)
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(4))

class Px:
    def __init__(self, w, h, fill=None):
        self.w, self.h = w, h
        self.im = Image.new('RGBA', (w, h), H(fill) if fill else (0, 0, 0, 0))
        self.p = self.im.load()

    # --- basics ---------------------------------------------------------
    def set(self, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h and c is not None:
            self.p[x, y] = H(c)

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.p[x, y]
        return (0, 0, 0, 0)

    def rect(self, x, y, w, h, c):
        for j in range(int(h)):
            for i in range(int(w)):
                self.set(x + i, y + j, c)

    def hline(self, x, y, w, c):
        self.rect(x, y, w, 1, c)

    def vline(self, x, y, h, c):
        self.rect(x, y, 1, h, c)

    def line(self, x0, y0, x1, y1, c):
        x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.set(x0, y0, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy; x0 += sx
            if e2 <= dx:
                err += dx; y0 += sy

    def ell(self, cx, cy, rx, ry, c):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x - cx) / max(rx, .5)) ** 2 + ((y - cy) / max(ry, .5)) ** 2 <= 1.0:
                    self.set(x, y, c)

    def blit(self, o, x, y, flip=False):
        src = o.im.transpose(Image.FLIP_LEFT_RIGHT) if flip else o.im
        self.im.alpha_composite(src, (int(x), int(y))) if 0 <= x and 0 <= y and x + o.w <= self.w and y + o.h <= self.h else self._safe_blit(src, x, y)

    def _safe_blit(self, src, x, y):
        tmp = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        tmp.paste(src, (int(x), int(y)))
        self.im.alpha_composite(tmp)

    def copy(self):
        n = Px(self.w, self.h); n.im = self.im.copy(); n.p = n.im.load(); return n

    # --- texture helpers --------------------------------------------------
    def speckle(self, rng, n, cols, x=0, y=0, w=None, h=None, size=1, only_opaque=False):
        w = w or self.w; h = h or self.h
        for _ in range(n):
            px, py = x + int(rng.random() * w), y + int(rng.random() * h)
            if only_opaque and self.get(px, py)[3] == 0:
                continue
            c = cols[int(rng.random() * len(cols))]
            self.rect(px, py, size if size == 1 else 1 + int(rng.random() * size), 1, c)

    def dither(self, x, y, w, h, c, level=0.5):
        """Ordered (Bayer 4x4) dither of colour c over a rect; level 0..1 is coverage."""
        B = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
        for j in range(h):
            for i in range(w):
                if B[(y + j) % 4][(x + i) % 4] < level * 16:
                    self.set(x + i, y + j, c)

    def outline(self, c, diag=False):
        """Adds a 1px outline around opaque pixels (outside only)."""
        src = self.im.copy(); sp = src.load(); col = H(c)
        for y in range(self.h):
            for x in range(self.w):
                if sp[x, y][3] > 0:
                    continue
                n = [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
                if diag:
                    n += [(x + 1, y + 1), (x - 1, y - 1), (x + 1, y - 1), (x - 1, y + 1)]
                for nx, ny in n:
                    if 0 <= nx < self.w and 0 <= ny < self.h and sp[nx, ny][3] > 0:
                        self.p[x, y] = col; break
        return self

    def shade(self, hi, lo, hi_t=0.5, lo_t=0.5):
        """Cheap top-left light: lighten pixels whose upper/left neighbour is empty or darker, darken those whose lower/right is empty."""
        src = self.im.copy(); sp = src.load()
        for y in range(self.h):
            for x in range(self.w):
                c = sp[x, y]
                if c[3] == 0:
                    continue
                up = sp[x, y - 1] if y > 0 else (0, 0, 0, 0)
                lf = sp[x - 1, y] if x > 0 else (0, 0, 0, 0)
                dn = sp[x, y + 1] if y < self.h - 1 else (0, 0, 0, 0)
                rt = sp[x + 1, y] if x < self.w - 1 else (0, 0, 0, 0)
                if up[3] == 0 or lf[3] == 0:
                    self.p[x, y] = mix(c, hi, hi_t)
                elif dn[3] == 0 or rt[3] == 0:
                    self.p[x, y] = mix(c, lo, lo_t)
        return self

    def save(self, path):
        self.im.save(path)

def sheet(frames, cols=None, fw=None, fh=None):
    """Lays out equal-size Px frames in a grid; returns (Px, cols, rows)."""
    fw = fw or frames[0].w; fh = fh or frames[0].h
    cols = cols or len(frames)
    rows = (len(frames) + cols - 1) // cols
    out = Px(cols * fw, rows * fh)
    for i, f in enumerate(frames):
        out.im.alpha_composite(f.im, ((i % cols) * fw, (i // cols) * fh))
    out.p = out.im.load()
    return out, cols, rows

def rng_for(*a):
    return random.Random(hash(a) & 0xffffffff if False else sum((i + 1) * 7919 * (ord(str(x)[0]) + len(str(x))) for i, x in enumerate(a)) + 17)
