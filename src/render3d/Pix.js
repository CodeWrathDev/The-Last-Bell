// Tiny RGBA pixel-buffer helpers (little-endian Uint32 = 0xAABBGGRR). No DOM, no Phaser: runs in Node and the browser.

export const rgba = (r, g, b, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
export const cr = (c) => c & 255;
export const cg = (c) => (c >>> 8) & 255;
export const cb = (c) => (c >>> 16) & 255;
export const ca = (c) => c >>> 24;
export const mix = (c, d, t) => rgba(
  cr(c) + (cr(d) - cr(c)) * t, cg(c) + (cg(d) - cg(c)) * t, cb(c) + (cb(d) - cb(c)) * t, 255);
export const shade = (c, k) => rgba(Math.min(255, cr(c) * k), Math.min(255, cg(c) * k), Math.min(255, cb(c) * k), ca(c));

export function hash2(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A w*h image. `d` is the Uint32Array of pixels (alpha 0 = transparent). */
export class Pix {
  constructor(w, h, d) { this.w = w; this.h = h; this.d = d || new Uint32Array(w * h); }
  get(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? 0 : this.d[y * this.w + x]; }
  set(x, y, c) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c; }
  fill(c) { this.d.fill(c); return this; }
  rect(x, y, w, h, c) {
    const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(this.w, x + w), y1 = Math.min(this.h, y + h);
    for (let j = y0; j < y1; j++) this.d.fill(c, j * this.w + x0, j * this.w + x1);
    return this;
  }
  /** Copies a region of `src` (sx, sy, sw, sh) here at (dx, dy). Pixels with alpha < 128 are skipped. */
  blit(src, dx, dy, sx = 0, sy = 0, sw = src.w, sh = src.h, flip = false) {
    for (let j = 0; j < sh; j++) {
      const y = dy + j; if (y < 0 || y >= this.h) continue;
      for (let i = 0; i < sw; i++) {
        const x = dx + i; if (x < 0 || x >= this.w) continue;
        const c = src.get(sx + (flip ? sw - 1 - i : i), sy + j);
        if ((c >>> 24) >= 128) this.d[y * this.w + x] = c;
      }
    }
    return this;
  }
  clone() { return new Pix(this.w, this.h, this.d.slice()); }
}

/** A tileset image cut into 32px tiles, addressed by tile id (see assets/tiles.js). */
export class Tileset {
  constructor(pix, cols = 10, size = 32) { this.pix = pix; this.cols = cols; this.size = size; this.cache = new Map(); }
  tile(id) {
    let t = this.cache.get(id);
    if (!t) {
      const s = this.size, out = new Pix(s, s), sx = (id % this.cols) * s, sy = Math.floor(id / this.cols) * s;
      out.blit(this.pix, 0, 0, sx, sy, s, s);
      t = out; this.cache.set(id, t);
    }
    return t;
  }
}
