import { Pix, rgba, hash2 } from './Pix.js';

// Browser-only helpers that turn images and text into Pix buffers. Shared by the game (View3D) and the test harness.

let scratch = null;
const ctx2 = (w, h) => {
  if (!scratch) scratch = document.createElement('canvas');
  scratch.width = w; scratch.height = h;
  const c = scratch.getContext('2d', { willReadFrequently: true });
  c.imageSmoothingEnabled = false; c.clearRect(0, 0, w, h);
  return c;
};

export function pixFromImage(img, sx, sy, w, h) {
  const c = ctx2(w, h);
  c.drawImage(img, sx, sy, w, h, 0, 0, w, h);
  const data = c.getImageData(0, 0, w, h).data;
  return new Pix(w, h, new Uint32Array(data.buffer.slice(0)));
}

/**
 * Crisp pixel text: draws with the canvas font, then thresholds the alpha so no anti-aliased fringe survives.
 * opts.outline: colour of a 1-2 px outline (keeps small letters, and tall Burmese marks, readable on any wall)
 * opts.bold:    heavier strokes
 */
export function textPix(str, size, color = '#f0e6c8', family = '"Noto Sans Myanmar", system-ui, sans-serif', opts = {}) {
  if (!str) return null;
  const font = `${opts.bold ? 'bold ' : ''}${size}px ${family}`, ow = opts.outline ? (opts.outlineW ?? 2) : 0;
  const probe = ctx2(8, 8); probe.font = font;
  const w = Math.max(1, Math.ceil(probe.measureText(str).width) + 2 + ow * 2), h = Math.ceil(size * 1.6) + ow * 2;
  const c = ctx2(w, h);
  c.font = font; c.textBaseline = 'top'; c.lineJoin = 'round';
  if (ow) { c.strokeStyle = opts.outline; c.lineWidth = ow * 2; c.strokeText(str, 1 + ow, 1 + ow); }
  c.fillStyle = color; c.fillText(str, 1 + ow, 1 + ow);
  const data = c.getImageData(0, 0, w, h).data, d = new Uint32Array(w * h);
  let minY = h, maxY = 0;
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] >= 110) { d[i] = (255 << 24) | (data[i * 4 + 2] << 16) | (data[i * 4 + 1] << 8) | data[i * 4]; const y = (i / w) | 0; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (maxY < minY) return null;
  const out = new Pix(w, maxY - minY + 1);
  out.d.set(d.subarray(minY * w, (maxY + 1) * w));
  return out;
}

/**
 * Painted school signboard as a pixel buffer: dark green enamel, cream border, rivets, short chains on top, rain streaks and a few
 * dark drips. `en` is the big English line, `my` the Burmese line under it (both optional). Browser-only (uses canvas text).
 */
export function signPix({ en, my, w = 232, h = 58, family = '"Noto Sans Myanmar", system-ui, sans-serif', chains = true, enSize = 16, mySize = 14, bg = [0x10, 0x3a, 0x2c] } = {}) {
  const out = new Pix(w, h), top = chains ? 8 : 0, bh = h - top;
  const BG = rgba(bg[0], bg[1], bg[2]), BG2 = rgba(bg[0] + 8, bg[1] + 14, bg[2] + 10), DK = rgba(6, 16, 12), CREAM = rgba(0xe6, 0xdc, 0xb0), GOLD = rgba(0xd8, 0xa8, 0x38), IRON = rgba(0x58, 0x60, 0x70);
  if (chains) for (const cx of [14, w - 15]) for (let y = 0; y < top; y++) { out.set(cx, y, y % 2 ? IRON : rgba(0x88, 0x92, 0xa4)); out.set(cx + 1, y, rgba(0x28, 0x2c, 0x38)); }
  out.rect(0, top, w, bh, DK);
  out.rect(1, top + 1, w - 2, bh - 2, CREAM);
  out.rect(3, top + 3, w - 6, bh - 6, DK);
  out.rect(4, top + 4, w - 8, bh - 8, GOLD);
  out.rect(5, top + 5, w - 10, bh - 10, BG);
  for (let y = top + 5; y < h - 5; y++) for (let x = 5; x < w - 5; x++) if (hash2(x, y, 41) < 0.09) out.d[y * w + x] = BG2;
  for (const [x, y] of [[7, top + 7], [w - 9, top + 7], [7, h - 9], [w - 9, h - 9]]) { out.rect(x, y, 2, 2, GOLD); out.set(x, y, CREAM); }
  const lines = [], fit = (str, size, color, bold) => {        // shrink until the line fits inside the border (never clipped)
    for (let sz = size; sz >= 8; sz--) { const t = textPix(str, sz, color, family, { bold, outline: '#02070a', outlineW: 1 }); if (!t || t.w <= w - 16) return t; }
    return textPix(str, 8, color, family, { bold, outline: '#02070a', outlineW: 1 });
  };
  if (en) lines.push(fit(en, enSize, '#f4ecc4', true));
  if (my) lines.push(fit(my, mySize, '#f6d65a', false));          // Burmese: regular weight, bold fills in the small counters
  const gap = 3, total = lines.reduce((a, l) => a + (l ? l.h : 0), 0) + gap * Math.max(0, lines.length - 1);
  let y = top + Math.max(5, ((bh - total) >> 1));
  for (const l of lines) { if (!l) continue; out.blit(l, (w - l.w) >> 1, y); y += l.h + gap; }
  for (let i = 0; i < 4; i++) {                                    // rain streaks and a few dark drips running down from the border
    const x = 12 + ((hash2(i, 5, 77) * (w - 24)) | 0), len = 6 + ((hash2(i, 6, 77) * 12) | 0);
    for (let k = 0; k < len; k++) if (top + bh - 6 - k > top + 4) out.set(x, top + bh - 6 - k, (i & 1) ? rgba(0x4a, 0x0a, 0x10) : rgba(0x0c, 0x1c, 0x16));
  }
  return out;
}
