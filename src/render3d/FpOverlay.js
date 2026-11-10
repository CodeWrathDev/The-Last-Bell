// First-person overlays, drawn straight into the renderer's 480x270 pixel buffer (Phaser-free so the test harness can use them).
// `r` is a Renderer3D (r.W, r.H, r.px = Uint32Array of ABGR pixels).

// ------------------------------------------------------------------ first-person overlays (drawn straight into the 480x270 buffer)
/** Hiding under a desk: the underside of the desktop fills the top of the view and the edges close in. */
export function drawHide(r, hk) {
  if (hk < 0.02) return;
  const { W, H, px } = r, band = Math.round(H * (0.2 + 0.14 * hk));
  for (let y = 0; y < H; y++) {
    const top = y < band ? (1 - y / band) ** 1.4 : 0;
    for (let x = 0; x < W; x++) {
      const e = Math.abs(x / W - 0.5) * 2, edge = e > 0.62 ? ((e - 0.62) / 0.38) ** 1.5 : 0;
      const k = Math.min(0.97, (top * 0.97 + edge * 0.7) * hk); if (k < 0.01) continue;
      const i = y * W + x, c = px[i], m = 1 - k;
      px[i] = (255 << 24) | ((((c >>> 16) & 255) * m + 6 * k) << 16) | ((((c >>> 8) & 255) * m + 5 * k) << 8) | ((c & 255) * m + 7 * k);
    }
  }
}

/** A tiny dot so you can aim at things to interact with. */
export function drawCross(r, p, dead) {
  if (p.hidden || dead) return;
  const { W, H, px } = r, cx = W >> 1, cy = H >> 1;
  for (const [dx, dy] of [[0, 0], [-3, 0], [3, 0], [0, -3], [0, 3]]) {
    const i = (cy + dy) * W + cx + dx, c = px[i], a = dx || dy ? 0.28 : 0.55;
    px[i] = (255 << 24) | ((((c >>> 16) & 255) + (210 - ((c >>> 16) & 255)) * a) << 16) | ((((c >>> 8) & 255) + (215 - ((c >>> 8) & 255)) * a) << 8) | ((c & 255) + (220 - (c & 255)) * a);
  }
}

/** Your right hand and the flashlight, bottom-right. Sways with your steps, dips when you pick something up, dims with the world. */
export function drawHands(r, p, time, crouchK, deadK) {
  if (p.hidden || deadK > 0.5) return;
  const { W, H, px } = r, on = !!p.flashOn;
  const walk = p.moving ? 1 : 0, bobx = walk ? Math.sin(p.animT * 0.66) * (p.running ? 6 : 3) : Math.sin(time * 0.0016) * 0.9;
  const boby = walk ? Math.abs(Math.sin(p.animT * 1.32)) * (p.running ? 5 : 2.5) : Math.sin(time * 0.0021) * 0.7;
  const act = p.act && p.actT > 0 ? Math.min(1, p.actT * 4) : 0;
  const drop = 34 * act + 26 * crouchK + 70 * deadK + (p.running ? 8 : 0);
  const bx = W - 64 + bobx - (p.running ? 10 : 0), by = H + 10 + boby + drop;
  const dxn = -0.3, dyn = -0.954, nx = 0.954, ny = -0.3, LEN = 80;
  const lit = on ? 1 : 0.55;
  const x0 = Math.max(0, Math.floor(bx - 150)), x1 = Math.min(W - 1, Math.ceil(bx + 40)), y0 = Math.max(0, Math.floor(by - 110)), y1 = Math.min(H - 1, H - 1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const rx = x - bx, ry = y - by, a = rx * dxn + ry * dyn, b = rx * nx + ry * ny;
    let col = null;
    if (a >= 0 && a <= LEN) {                                                    // the flashlight
      const hw = a < 48 ? 6.2 : a < 60 ? 6.2 + (a - 48) * 0.28 : 9.5;
      if (Math.abs(b) <= hw) {
        const t = b / hw, sh = 0.35 + 0.65 * Math.max(0, 1 - Math.abs(t + 0.4)) ** 1.1;
        if (a >= 77) col = on ? [255, 246, 214] : [34, 40, 50];                  // lens
        else if (a >= 71) col = [118 * sh * (lit + 0.2), 122 * sh * (lit + 0.2), 130 * sh * (lit + 0.2)];   // head ring
        else if (a >= 60) col = [64 * sh * (lit + 0.2), 68 * sh * (lit + 0.2), 76 * sh * (lit + 0.2)];      // head
        else { const g = ((a | 0) % 7 < 2 ? 0.72 : 1) * sh * (lit + 0.2); col = [48 * g, 52 * g, 60 * g]; }  // grip
      }
    }
    if (a >= 5 && a <= 36 && Math.abs(b) <= 10) {                                 // fist around the handle (drawn over it)
      const sh = 0.55 + 0.45 * (1 - Math.abs(b + 3) / 13), f = ((a | 0) % 8 < 1) ? 0.68 : 1;   // dark seams between the fingers
      col = [188 * sh * f * lit, 146 * sh * f * lit, 120 * sh * f * lit];
    } else if (a < 5 && a > -90 && Math.abs(b) <= 11 + (5 - a) * 0.16) {          // sleeve / forearm (white school shirt)
      const sh = 0.5 + 0.5 * (1 - Math.abs(b + 3) / 20), fold = ((a * 0.35 + b * 0.2) | 0) % 5 === 0 ? 0.86 : 1;
      col = [206 * sh * fold * lit, 210 * sh * fold * lit, 218 * sh * fold * lit];
    }
    if (!col) continue;
    px[y * W + x] = (255 << 24) | ((Math.min(255, col[2]) | 0) << 16) | ((Math.min(255, col[1]) | 0) << 8) | (Math.min(255, col[0]) | 0);
  }
  if (on && act < 0.5) {                                                         // warm halo on the lens
    const lx = bx + dxn * LEN, ly = by + dyn * LEN, R = 15;
    for (let y = Math.max(0, Math.floor(ly - R)); y <= Math.min(H - 1, Math.ceil(ly + R)); y++) for (let x = Math.max(0, Math.floor(lx - R)); x <= Math.min(W - 1, Math.ceil(lx + R)); x++) {
      const d = Math.hypot(x - lx, y - ly); if (d >= R) continue;
      const k = (1 - d / R) ** 2 * 0.55, c = px[y * W + x];
      px[y * W + x] = (255 << 24) | (Math.min(255, ((c >>> 16) & 255) + 190 * k) << 16) | (Math.min(255, ((c >>> 8) & 255) + 215 * k) << 8) | Math.min(255, (c & 255) + 235 * k);
    }
  }
}
