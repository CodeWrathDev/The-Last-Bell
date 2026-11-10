import { TILE } from '../config.js';

// Pure grid helpers (no Phaser) so they can be unit-tested in Node.
// A body is { x, y, hw, hh } where (x, y) is the CENTRE of an axis-aligned box.

export const inBounds = (g, tx, ty) => ty >= 0 && tx >= 0 && ty < g.length && tx < g[0].length;
export const solidAt = (g, tx, ty) => !inBounds(g, tx, ty) || g[ty][tx] === true;

export function boxBlocked(g, cx, cy, hw, hh) {
  const x0 = Math.floor((cx - hw) / TILE), x1 = Math.floor((cx + hw - 0.01) / TILE);
  const y0 = Math.floor((cy - hh) / TILE), y1 = Math.floor((cy + hh - 0.01) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solidAt(g, tx, ty)) return true;
  return false;
}

function stepAxis(g, b, axis, d) {
  const n = Math.ceil(Math.abs(d));
  if (!n) return false;
  const s = d / n;
  for (let i = 0; i < n; i++) {
    b[axis] += s;
    if (boxBlocked(g, b.x, b.y, b.hw, b.hh)) { b[axis] -= s; return true; }
  }
  return false;
}

/** Moves a body one axis at a time so it slides along walls. Returns which axes were blocked. */
export function moveBody(g, b, dx, dy) {
  const hitX = stepAxis(g, b, 'x', dx);
  const hitY = stepAxis(g, b, 'y', dy);
  return { hitX, hitY };
}

/** Tile-resolution line of sight. Start and end tiles are ignored. */
export function hasLOS(g, x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / 8));
  const sx = Math.floor(x0 / TILE), sy = Math.floor(y0 / TILE), ex = Math.floor(x1 / TILE), ey = Math.floor(y1 / TILE);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const tx = Math.floor((x0 + (x1 - x0) * t) / TILE), ty = Math.floor((y0 + (y1 - y0) * t) / TILE);
    if ((tx === sx && ty === sy) || (tx === ex && ty === ey)) continue;
    if (solidAt(g, tx, ty)) return false;
  }
  return true;
}

/** Closest walkable tile to (tx, ty) within maxR (spiral search). */
export function nearestFree(g, tx, ty, maxR = 6) {
  if (!solidAt(g, tx, ty)) return { tx, ty };
  for (let r = 1; r <= maxR; r++) {
    let best = null, bd = 1e9;
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
      if (solidAt(g, tx + i, ty + j)) continue;
      const d = i * i + j * j;
      if (d < bd) { bd = d; best = { tx: tx + i, ty: ty + j }; }
    }
    if (best) return best;
  }
  return null;
}

/** 4-neighbour BFS. Returns tiles after the start tile up to and including the goal, or null. */
export function bfs(g, sx, sy, gx, gy, maxNodes = 2500) {
  if (solidAt(g, gx, gy)) return null;
  if (sx === gx && sy === gy) return [];
  const W = g[0].length, key = (x, y) => y * W + x;
  const prev = new Map([[key(sx, sy), -1]]);
  const q = [[sx, sy]];
  let head = 0;
  while (head < q.length && head < maxNodes) {
    const [x, y] = q[head++];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (solidAt(g, nx, ny) || prev.has(k)) continue;
      prev.set(k, key(x, y));
      if (nx === gx && ny === gy) {
        const path = [];
        let c = k;
        while (c !== -1 && c !== key(sx, sy)) { path.push({ tx: c % W, ty: Math.floor(c / W) }); c = prev.get(c); }
        return path.reverse();
      }
      q.push([nx, ny]);
    }
  }
  return null;
}

/** Flood fill from a tile; returns a Set of keys (y*W+x) reachable on foot. */
export function reachable(g, sx, sy) {
  const W = g[0].length, seen = new Set(), q = [[sx, sy]];
  if (solidAt(g, sx, sy)) return seen;
  seen.add(sy * W + sx);
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (solidAt(g, nx, ny) || seen.has(ny * W + nx)) continue;
      seen.add(ny * W + nx); q.push([nx, ny]);
    }
  }
  return seen;
}

export const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
