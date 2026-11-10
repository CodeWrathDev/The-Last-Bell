import { T } from '../assets/tiles.js';
import { Pix, rgba, mix, shade, hash2, cr, cg, cb } from './Pix.js';

// All 3D surfaces are built at 32 texels per world unit (the same density as the 32px tile art), so pixels stay square and
// consistent everywhere. Wall/door/window art reuses the palette sampled from the project's own tileset.

export const TEXEL = 32;
export const INDOOR_WALL_H = 2.25;            // world units (1 unit = one map tile)
export const DOOR_H = 1.65;                   // doors are taller than the 1.25-unit player so proportions read correctly

const P = {
  wood: rgba(0x5a, 0x37, 0x22), woodLt: rgba(0x7a, 0x4c, 0x2c), woodDk: rgba(0x40, 0x27, 0x1a), woodBlk: rgba(0x2b, 0x1b, 0x13),
  gold: rgba(0xe8, 0xb0, 0x30), goldDk: rgba(0x9a, 0x6c, 0x1c), steel: rgba(0x8a, 0x92, 0x9a), steelDk: rgba(0x4a, 0x50, 0x5a),
  glass: rgba(0x0a, 0x12, 0x24), glassLt: rgba(0x2a, 0x3a, 0x5c), glassHi: rgba(0x5a, 0x7a, 0xa8),
  board: rgba(0x16, 0x38, 0x2e), boardLt: rgba(0x2a, 0x5a, 0x4a), chalk: rgba(0xe6, 0xee, 0xe0),
  plate: rgba(0x14, 0x22, 0x1c), plateTx: rgba(0xf0, 0xe6, 0xc8), red: rgba(0xa0, 0x20, 0x28),
};

// ------------------------------------------------------------------ walls
/** Indoor plaster wall, `hpx` rows tall, from the real WALLINT / WALLINTBASE tile art (top to bottom, like the 2D map stacks them). */
export function plasterWall(tiles, hpx) {
  const out = new Pix(TEXEL, hpx), top = tiles.tile(T.WALLINT), base = tiles.tile(T.WALLINTBASE);
  for (let y = 0; y < hpx - 32; y++) for (let x = 0; x < 32; x++) out.d[y * 32 + x] = top.d[(y % 32) * 32 + x];
  out.blit(base, 0, hpx - 32);
  // faint damp streaks running down from the ceiling
  for (let x = 0; x < 32; x++) {
    if (hash2(x, 7, 3) > 0.14) continue;
    const len = 6 + (hash2(x, 9, 3) * 22 | 0);
    for (let y = 0; y < len; y++) { const i = y * 32 + x, c = out.d[i]; out.d[i] = shade(c, 0.78 - y * 0.004); }
  }
  return out;
}

/** Double-leaf school door group `cells` tiles wide on a transparent background. */
export function doorGroup(cells, { locked = false, label = null, text = null } = {}) {
  const w = cells * TEXEL, hpx = Math.round(INDOOR_WALL_H * TEXEL), dh = Math.round(DOOR_H * TEXEL);
  const out = new Pix(w, hpx), x0 = 3, x1 = w - 3, top = hpx - dh;
  out.rect(x0 - 2, top - 2, x1 - x0 + 4, dh + 2, rgba(0x12, 0x3a, 0x2a)); out.rect(x0 - 2, top - 2, x1 - x0 + 4, 1, rgba(0xc8, 0xd0, 0xbe));   // green frame, white lintel line
  out.rect(x0, top, x1 - x0, dh, P.woodDk);
  const mid = w >> 1, leafW = mid - x0 - 1;
  for (const lx of [x0 + 1, mid + 1]) {
    out.rect(lx, top + 1, leafW, dh - 1, P.wood);
    out.rect(lx + 2, top + 3, leafW - 4, 10, rgba(0x0d, 0x0f, 0x18));        // upper glass panel (dark, the corridor behind is black)
    out.rect(lx + 2, top + 3, leafW - 4, 1, P.glassLt);
    out.rect(lx + 3, top + 6, 2, 5, rgba(0x1a, 0x24, 0x3c));
    out.rect(lx + 2, top + 16, leafW - 4, dh - 20, P.woodLt);                // raised lower panel
    out.rect(lx + 3, top + 17, leafW - 6, dh - 22, P.wood);
    for (let y = top + 18; y < top + dh - 4; y += 3) for (let x = lx + 3; x < lx + leafW - 3; x++) if (hash2(x, y, 11) < 0.12) out.set(x, y, P.woodDk);
  }
  out.rect(mid - 1, top, 2, dh, P.woodBlk);                                  // meeting stile
  out.rect(x0, top + dh - 1, x1 - x0, 1, P.woodBlk);
  // brass handles, or a padlock + chain when locked
  const hy = top + (dh >> 1) + 2;
  out.rect(mid - 4, hy, 2, 6, P.gold); out.rect(mid + 2, hy, 2, 6, P.gold);
  out.rect(mid - 4, hy, 1, 6, P.goldDk);
  if (locked) {
    out.rect(mid - 4, hy + 1, 8, 2, P.steelDk); out.rect(mid - 3, hy + 3, 6, 5, P.gold); out.rect(mid - 3, hy + 3, 6, 1, P.goldDk);
    out.rect(mid - 1, hy + 5, 2, 2, P.woodBlk);
    for (let x = x0 + 2; x < x1 - 2; x += 2) out.set(x, hy + 1 + ((x >> 1) & 1), P.steel);
  }
  // sign plate above the door
  if (label) {
    const th = text ? text.h : 7, ph = th + 5, pw = Math.min(w - 2, Math.max(28, (text ? text.w : 0) + 8)), px = (w - pw) >> 1, py = Math.max(0, top - ph - 3);
    out.rect(px, py, pw, ph, P.woodBlk); out.rect(px + 1, py + 1, pw - 2, ph - 2, P.gold); out.rect(px + 2, py + 2, pw - 4, ph - 4, P.plate);   // brass-framed plate
    if (text) out.blit(text, px + ((pw - text.w) >> 1), py + 2 + ((ph - 4 - text.h) >> 1));
  }
  return out;
}

/** Rainy night window on a transparent background (one tile wide). */
export function windowPane(frame = 0) {
  const hpx = Math.round(INDOOR_WALL_H * TEXEL), out = new Pix(TEXEL, hpx), w = 24, h = 28, x0 = 4, y0 = hpx - 59;
  out.rect(x0 - 2, y0 - 2, w + 4, h + 4, P.woodBlk);
  out.rect(x0 - 1, y0 - 1, w + 2, h + 2, P.steelDk);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y / h, base = mix(rgba(0x14, 0x24, 0x44), rgba(0x08, 0x0e, 0x1c), k);
    out.set(x0 + x, y0 + y, hash2(x, y, 5) < 0.06 ? shade(base, 1.5) : base);
  }
  for (let i = 0; i < 9; i++) {                                              // rain streaks
    const sx = 1 + (hash2(i, 1, 9) * (w - 2) | 0), sy = (hash2(i, 2, 9) * (h - 8) | 0), L = 4 + (hash2(i, 3, 9) * 6 | 0);
    for (let j = 0; j < L; j++) out.set(x0 + sx, y0 + ((sy + j + frame * 3) % h), j === L - 1 ? P.glassHi : P.glassLt);
  }
  out.rect(x0 + (w >> 1) - 1, y0, 2, h, P.steelDk);                          // mullion + transom
  out.rect(x0, y0 + 11, w, 2, P.steelDk);
  out.rect(x0 - 3, y0 + h + 1, w + 6, 3, P.steel);                          // sill
  out.rect(x0 - 3, y0 + h + 3, w + 6, 1, P.steelDk);
  return out;
}

/** Chalkboard group `cells` tiles wide. */
export function boardGroup(cells, lines = []) {
  const w = cells * TEXEL, hpx = Math.round(INDOOR_WALL_H * TEXEL), out = new Pix(w, hpx);
  const bx = 5, bw = w - 10, by = hpx - 66, bh = 40;
  out.rect(bx - 2, by - 2, bw + 4, bh + 4, P.woodDk); out.rect(bx - 2, by - 2, bw + 4, 1, P.woodLt);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) out.set(bx + x, by + y, hash2(x, y, 4) < 0.1 ? P.boardLt : P.board);
  out.rect(bx - 2, by + bh + 2, bw + 4, 3, P.woodLt); out.rect(bx + 6, by + bh + 1, 10, 2, P.chalk); out.rect(bx + 20, by + bh + 1, 5, 2, rgba(0xc8, 0xb8, 0x90));
  for (let i = 0; i < 5; i++) for (let x = 0; x < 20; x++) if (hash2(x, i, 6) < 0.5) out.set(bx + 6 + x + i * 2, by + 6 + i * 3, rgba(0x9a, 0xb0, 0xa4));
  let ty = by + 14;
  for (const t of lines) { if (!t) continue; out.blit(t, bx + ((bw - t.w) >> 1), ty); ty += t.h + 3; }
  return out;
}

/** Tall bookcase face: the real shelf tile stacked twice (2 units tall). */
export function stackTile(tiles, id, rows) {
  const out = new Pix(TEXEL, rows * TEXEL), t = tiles.tile(id);
  for (let r = 0; r < rows; r++) out.blit(t, 0, r * TEXEL);
  return out;
}

/** Bottom `hpx` rows of a tile (low furniture such as desks and planters). */
export function cropTileBottom(tiles, id, hpx) {
  const out = new Pix(TEXEL, hpx), t = tiles.tile(id);
  out.blit(t, 0, 0, 0, 32 - hpx, 32, hpx);
  return out;
}

/** A face made from stacked tiles, listed top to bottom. */
export function stackTiles(tiles, ids) {
  const out = new Pix(TEXEL, ids.length * TEXEL);
  ids.forEach((id, i) => { if (id >= 0) out.blit(tiles.tile(id), 0, i * TEXEL); });
  return out;
}

/** Flat top for low furniture, picked from the tile's own wood colours. */
export function topSurface(tiles, id) {
  const t = tiles.tile(id), out = new Pix(32, 32);
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = 4; y < 14; y++) for (let x = 4; x < 28; x++) { const c = t.d[y * 32 + x]; if ((c >>> 24) > 200) { r += cr(c); g += cg(c); b += cb(c); n++; } }
  const base = n ? rgba(r / n, g / n, b / n) : P.woodLt;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) out.d[y * 32 + x] = (y % 6 === 0) ? shade(base, 0.8) : hash2(x, y, 2) < 0.08 ? shade(base, 0.88) : base;
  return out;
}

// ------------------------------------------------------------------ ceiling
/** Whole-map ceiling bitmap (32 texels per tile): dark acoustic panels with a grid of battens. */
export function ceilingBitmap(mw, mh) {
  const out = new Pix(mw * TEXEL, mh * TEXEL), base = rgba(0x30, 0x3a, 0x3e);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
    const lx = x & 15, ly = y & 15, edge = lx === 0 || ly === 0;
    let c = edge ? rgba(0x1c, 0x24, 0x28) : base;
    if (!edge && hash2(x, y, 8) < 0.07) c = shade(c, 0.86);
    if (!edge) { const stain = hash2(x >> 4, y >> 4, 21); if (stain < 0.13) c = shade(c, 0.7); }
    out.d[y * out.w + x] = c;
  }
  return out;
}

/** Fluorescent tube fixture sprite (on / off), drawn onto the ceiling bitmap. */
export function tubeFixture(on) {
  const out = new Pix(38, 12);
  out.rect(0, 0, 38, 12, rgba(0x1c, 0x22, 0x26)); out.rect(1, 1, 36, 10, rgba(0x3a, 0x44, 0x4a));
  out.rect(3, 3, 32, 2, on ? rgba(0xf4, 0xfa, 0xff) : rgba(0x4c, 0x56, 0x5e));
  out.rect(3, 7, 32, 2, on ? rgba(0xd8, 0xe8, 0xff) : rgba(0x40, 0x4a, 0x52));
  return out;
}

// ------------------------------------------------------------------ sky
/** Stormy night sky strip (wraps horizontally, one full turn = w px). Contains a low blood-red moon with a halo, seen facing north. */
export function skyStrip(w = 1024, h = 140) {
  const out = new Pix(w, h), MX = Math.round(w * 0.75), MY = 52, MR = 15;
  for (let y = 0; y < h; y++) {
    const k = y / h, top = rgba(0x07, 0x0a, 0x1a), mid = rgba(0x1c, 0x1a, 0x32), low = rgba(0x4a, 0x2a, 0x3c);
    for (let x = 0; x < w; x++) {
      let c = k < 0.6 ? mix(top, mid, k / 0.6) : mix(mid, low, (k - 0.6) / 0.4);
      const cloud = Math.sin(x * 0.045 + Math.sin(y * 0.11) * 2) * 0.5 + Math.sin(x * 0.013 + y * 0.07) * 0.5;
      if (cloud > 0.25 && hash2(x, y, 33) < (cloud - 0.15) * 0.9) c = shade(c, 1.35);
      if (k < 0.45 && hash2(x, y, 61) < 0.0016) c = rgba(0xc8, 0xd8, 0xf0);
      // moon halo (wide, dithered) and disc
      const dx = x - MX, dy = y - MY, d = Math.hypot(dx, dy * 1.1);
      if (d < 70) { const a = (1 - d / 70) ** 2.2 * 0.55; if (hash2(x, y, 5) < a * 1.6) c = mix(c, rgba(0xb0, 0x3a, 0x34), Math.min(0.7, a)); }
      if (d < MR) {
        const sh = 0.78 + 0.22 * ((dx + dy * 0.5) / MR), crater = hash2((x >> 1), (y >> 1), 88) < 0.16;
        c = mix(rgba(0xc8, 0x58, 0x46), rgba(0xe8, 0x86, 0x62), Math.max(0, Math.min(1, 0.5 - dx / (MR * 2) - dy / (MR * 3))));
        if (crater) c = shade(c, 0.72); c = shade(c, sh);
      } else if (d < MR + 1.5) c = mix(c, rgba(0xe8, 0x70, 0x58), 0.5);
      // a dark cloud band drifting across the moon
      if (Math.abs(dy - 3 - Math.sin(x * 0.2) * 2) < 2.2 && Math.abs(dx) < 34 && hash2(x, y, 9) < 0.8) c = shade(c, 0.42);
      out.d[y * w + x] = c;
    }
  }
  return out;
}
