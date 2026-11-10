import { T } from '../assets/tiles.js';
import { SOLID } from '../maps/MapBuilder.js';
import * as MAT from './Materials.js';
import { Pix, rgba, hash2 } from './Pix.js';
import { tr, isMy } from '../systems/Lang.js';

// Perspective renderer for the tile maps: a software "2.5D" pipeline (floor + ceiling casting, a column raycaster for walls
// and low furniture boxes, depth-tested pixel-art billboards). It reads the SAME map objects the 2D game uses
// (tile layers, objects, collision grid), so gameplay logic is untouched. No Phaser, no DOM: runs in Node and browsers.

const TEXEL = MAT.TEXEL;
export const SIDE = { N: 0, S: 1, W: 2, E: 3 };
const NX = [0, 0, -1, 1], NY = [-1, 1, 0, 0];               // outward face normals

const BLD = new Set([T.WALL, T.WINDOW, T.WINDOWLIT, T.WINDOWBROKEN, T.WALLBASE, T.WALLSTAIN, T.WALLPEEL, T.ROOF, T.ROOFEDGE, T.ROOFTIN, T.ROOFTINEDGE, T.PILLAR, T.DOORLOCK, T.DOOR]);
const INDOOR_WALL = new Set([T.WALLINT, T.WALLINTBASE, T.WINDOWRAIN, T.BOARD, T.DOORLOCK, ...BLD]);
const MISC_H = { [T.BUSH]: 1.15, [T.FENCE]: 1.0, [T.GATE]: 1.1, [T.TRUNK]: 3.6 };
const LOW_H = { [T.DESK]: 0.8, [T.DESK2]: 0.8, [T.DESK3]: 0.8, [T.READTABLE]: 0.8, [T.BED]: 0.4 };
const TALL_H = { [T.SHELF]: 2.0, [T.LIBSHELF]: 2.0 };
const FLAT_DECALS = new Set(['papers', 'chalk']);
const WALL_Z = { clock: 1.45, calendar: 1.0, poster: 0.95, timetable: 1.0, mirror: 0.85, exit_sign: 1.78, emergency_light: 1.9, curtain_0: 0.5 };
const OUTDOOR_OOB_H = 3.0;
const LMS = 4;   // light-map cells per tile (v43: was 2; in first person surfaces are right in front of you and the 0.5-tile steps showed)

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export class Renderer3D {
  constructor(W = 480, H = 270, { plane = 0.8, horizon = 0.455, camZ = 1.5 } = {}) {
    this.W = W; this.H = H; this.px = new Uint32Array(W * H); this.depth = new Float32Array(W * H);
    this.plane0 = plane; this.horizon0 = Math.round(H * horizon); this.camZ = camZ;
    this.segs = Array.from({ length: 96 }, () => ({})); this.nSeg = 0;
    this.zbuf = new Float32Array(W);
    this.cone = new Float32Array(W);
    this.rowD = new Float32Array(H); this.rowFog = new Float32Array(H); this.rowFl = new Float32Array(H);
    this.vig = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const nx = (x / W - 0.5) * 2, ny = (y / H - 0.5) * 2, r = Math.sqrt(nx * nx * 0.9 + ny * ny * 1.1);
      this.vig[y * W + x] = clamp(1.0 - 0.6 * r * r, 0.2, 1);   // v16: heavier vignette
    }
    this.sky = MAT.skyStrip();
    this.m = null; this.assets = null; this.faces = new Map(); this.tops = new Map();
    this.statics = []; this.decals = []; this.fans = []; this.fixtures = []; this.time = 0;
    this.light = { ar: 0.1, ag: 0.1, ab: 0.14 };
    this.tint = [12, 8, 24];
  }

  // ------------------------------------------------------------------ map setup
  /** (Re)builds everything derived from the map. Call again after a door unlocks. */
  setMap(m, assets) {
    this.m = m; this.assets = assets; this.mw = m.w; this.mh = m.h; this.indoor = !m.meta.outdoor;
    this.faces.clear(); this.tops.clear();
    this.cap = this.indoor ? MAT.INDOOR_WALL_H : 5;
    this.oobH = this.indoor ? MAT.INDOOR_WALL_H : OUTDOOR_OOB_H;
    const w = m.w, h = m.h;
    this.cellH = new Float32Array(w * h); this.cellTile = new Int16Array(w * h).fill(-1);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) this.classify(x, y);
    this.tint = m.meta.tint ?? (this.indoor ? [14, 8, 26] : [4, 8, 22]);
    this.buildFloor(); if (this.indoor) this.buildCeiling();
    this.buildObjects();
    this.lw = w * LMS; this.lh = h * LMS; this.lm = new Float32Array(this.lw * this.lh * 3);
  }

  deco(x, y) { return this.m.layers.deco[y]?.[x] ?? -1; }
  ground(x, y) { return this.m.layers.ground[y]?.[x] ?? -1; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.mw && y < this.mh; }
  openCell(x, y) { return this.inb(x, y) && this.cellH[y * this.mw + x] === 0; }
  hAt(x, y) { return this.inb(x, y) ? this.cellH[y * this.mw + x] : this.oobH; }

  solidTile(x, y) {
    const d = this.deco(x, y), g = this.ground(x, y);
    return SOLID.has(d) ? d : SOLID.has(g) ? g : -1;
  }
  bldAt(x, y) { const d = this.deco(x, y); return BLD.has(d) ? d : -1; }

  classify(x, y) {
    const i = y * this.mw + x, t = this.solidTile(x, y);
    if (t < 0) return;
    this.cellTile[i] = t;
    if (LOW_H[t]) this.cellH[i] = LOW_H[t];
    else if (TALL_H[t]) this.cellH[i] = TALL_H[t];
    else if (this.indoor) this.cellH[i] = MAT.INDOOR_WALL_H;
    else if (BLD.has(t)) this.cellH[i] = this.bldStack(x, y).length;
    else this.cellH[i] = MISC_H[t] ?? 1.1;
  }

  /** Outdoor building facade for a column: tile ids top-to-bottom, anchored at the lowest connected building row. */
  bldStack(x, y) {
    let a = y; while (this.bldAt(x, a + 1) >= 0) a++;
    const ids = [];
    for (let r = a; r > a - 5 && this.bldAt(x, r) >= 0; r--) ids.unshift(this.bldAt(x, r));
    return ids;
  }

  // ------------------------------------------------------------------ floor & ceiling bitmaps
  buildFloor() {
    const m = this.m, ts = this.assets.tiles, f = new Pix(this.mw * TEXEL, this.mh * TEXEL);
    for (let y = 0; y < this.mh; y++) for (let x = 0; x < this.mw; x++) {
      let g = m.layers.ground[y][x];
      const t = ts.tile(g < 0 ? 0 : g);
      for (let j = 0; j < 32; j++) f.d.set(t.d.subarray(j * 32, j * 32 + 32), (y * 32 + j) * f.w + x * 32);
    }
    this.floor = f;
  }
  buildCeiling() {
    this.ceilBase = MAT.ceilingBitmap(this.mw, this.mh); this.ceil = this.ceilBase.clone();
    this.tubeOn = MAT.tubeFixture(true); this.tubeOff = MAT.tubeFixture(false);
  }

  /** Fluorescent fixtures: [{ x, y (px), on }]. Repaints only when something changed. */
  setFixtures(list) {
    if (!this.indoor) return;
    let dirty = this.fixtures.length !== list.length;
    for (let i = 0; !dirty && i < list.length; i++) { const a = this.fixtures[i], b = list[i]; if (a.x !== b.x || a.y !== b.y || a.on !== b.on) dirty = true; }
    if (!dirty) return;
    this.fixtures = list.map((q) => ({ x: q.x, y: q.y, on: q.on }));
    this.repaintCeiling();
  }
  repaintCeiling() {
    this.ceil.d.set(this.ceilBase.d);
    for (const q of this.fixtures) this.ceil.blit(q.on ? this.tubeOn : this.tubeOff, Math.round(q.x - 19), Math.round(q.y - 6));
    this.paintFans(0);
  }
  paintFans(frame) {
    for (const f of this.fans) {
      const s = this.assets.sprite('fan_' + ((frame + f.phase) & 3)); if (!s) continue;
      const x0 = Math.round(f.x - s.w / 2), y0 = Math.round(f.y - s.h / 2);
      for (let j = 0; j < s.h; j++) { const yy = y0 + j; if (yy < 0 || yy >= this.ceil.h) continue; this.ceil.d.set(this.ceilBase.d.subarray(yy * this.ceil.w + Math.max(0, x0), yy * this.ceil.w + Math.min(this.ceil.w, x0 + s.w)), yy * this.ceil.w + Math.max(0, x0)); }
      this.ceil.blit(s, x0, y0);
    }
  }

  // ------------------------------------------------------------------ objects -> decals / billboards
  buildObjects() {
    const A = this.assets;
    this.statics = []; this.decals = []; this.fans = [];
    for (const o of this.m.objects) {
      if (o.type === 'decor' && o.sprite) {
        const cx = o.x + (o.w || 0) / 2, by = o.y + (o.h || 0);
        if (o.depth === 'wall') { const s = A.sprite(o.sprite); if (s) this.addWallDecal(cx, o.y + (o.oy === 0 ? 0 : 0), o.sprite, s); }
        else if (o.anim === 'fx_fan') this.fans.push({ x: o.x, y: o.y, phase: this.fans.length });
        else if (FLAT_DECALS.has(o.sprite)) { const s = A.sprite(o.sprite); if (s) this.floor.blit(s, Math.round(o.x + 16 - s.w / 2), Math.round(o.y + 16 - s.h / 2)); }
        else this.statics.push({ x: cx / 32, y: by / 32, z: o.z ?? 0, name: o.sprite, ox: o.ox ?? 0.5, oy: o.oy ?? 1, flip: (o.rot || 0) < 0, alpha: o.alpha ?? 1, bright: o.glowSprite ? 0.9 : 0.28, glow: !!o.glowSprite });
      } else if (o.type === 'sign' && o.en && this.assets.sign) {
        // v16: one language at a time. English mode paints the English line; Myanmar mode paints the Burmese line (or the catalogue translation).
        const pix = this.assets.sign(isMy()
          ? { my: o.my || tr(o.en), w: o.sw || 232, h: o.sh || 58, chains: !!o.hang, mySize: (o.mySize || 14) + (o.my ? 0 : 3) }
          : { en: o.en, w: o.sw || 232, h: o.sh || 58, chains: !!o.hang, enSize: o.enSize || 16 });
        if (!pix) continue;
        if (o.hang) this.statics.push({ x: o.tx, y: o.ty, z: o.z ?? 2.2, pix, ox: 0.5, oy: 0, bright: 0.55, glow: false });
        else this.addWallDecal(o.tx * 32, o.ty * 32, 'sign', pix, o.z ?? 1.5);
      } else if ((o.type === 'lamp' || o.type === 'prop') && o.sprite) {
        this.statics.push({ x: (o.x + 16) / 32, y: (o.y + 32) / 32, z: 0, name: o.sprite, ox: o.ox ?? 0.5, oy: 1, bright: o.type === 'lamp' ? 0.7 : 0.28 });
        if (o.sprite === 'flagpole') this.statics.push({ x: (o.x + 18) / 32, y: (o.y + 32) / 32, z: 3.62, names: ['flag_0', 'flag_1', 'flag_2', 'flag_3'], fps: 5, ox: 0, oy: 0, bright: 0.28 });
      }
    }
    if (this.indoor) this.repaintCeiling();
  }

  /** Attaches a sprite to the nearest wall face that borders open floor (wall posters, clocks, signs...). */
  addWallDecal(xpx, ypx, name, pix, z0) {
    const px = xpx / 32, py = ypx / 32, cx0 = Math.floor(px), cy0 = Math.floor(py);
    let best = null, bd = 1e9;
    for (let cy = cy0 - 2; cy <= cy0 + 2; cy++) for (let cx = cx0 - 2; cx <= cx0 + 2; cx++) {
      if (this.openCell(cx, cy)) continue;
      for (let s = 0; s < 4; s++) {
        const nx = cx + NX[s], ny = cy + NY[s]; if (!this.openCell(nx, ny)) continue;
        const fx = s === 2 ? cx : s === 3 ? cx + 1 : clamp(px, cx, cx + 1), fy = s === 0 ? cy : s === 1 ? cy + 1 : clamp(py, cy, cy + 1);
        const d = Math.hypot(px - fx, py - fy);
        if (d < bd) { bd = d; best = { cx, cy, s }; }
      }
    }
    if (!best) return;
    const lat = best.s < 2 ? px : py;
    this.decals.push({ ...best, lat, z0: z0 ?? WALL_Z[name] ?? 1.0, pix });
  }

  // ------------------------------------------------------------------ wall faces (built lazily, cached)
  deckind(cx, cy, s) {
    const d = this.deco(cx, cy);
    if (d === T.DOOR) return 'door'; if (d === T.DOORLOCK) return 'doorlock';
    if (this.indoor && d === T.WINDOWRAIN) return 'window'; if (this.indoor && d === T.BOARD) return 'board';
    const nx = cx + NX[s], ny = cy + NY[s];
    if (this.deco(nx, ny) === T.DOOR && this.openCell(nx, ny) && this.doorBack(nx, ny) === (s ^ 1)) return 'door';
    return null;
  }
  /** Side (0..3) of the wall directly behind a walkable doorway cell, or -1. */
  doorBack(x, y) {
    for (let s = 0; s < 4; s++) {
      const bx = x + NX[s], by = y + NY[s], ox = x - NX[s], oy = y - NY[s];
      const solidBack = !this.openCell(bx, by);
      const openFront = this.openCell(ox, oy) && this.deco(ox, oy) !== T.DOOR;
      if (solidBack && openFront) return s;
    }
    return -1;
  }

  face(mx, my, s) {
    const key = ((my + 8) * (this.mw + 16) + (mx + 8)) * 4 + s;
    let f = this.faces.get(key);
    if (!f) { f = this.buildFace(mx, my, s); this.faces.set(key, f); }
    return f;
  }

  buildFace(mx, my, s) {
    const ts = this.assets.tiles, inb = this.inb(mx, my), t = inb ? this.cellTile[my * this.mw + mx] : -1;
    let pix;
    if (!inb) pix = this.indoor ? MAT.plasterWall(ts, 72) : MAT.stackTiles(ts, [T.BUSH, T.BUSH, T.BUSH]);
    else if (LOW_H[t]) pix = t === T.BED ? MAT.cropTileBottom(ts, T.BED, Math.round(LOW_H[t] * 32)) : MAT.cropTileBottom(ts, t, Math.round(LOW_H[t] * 32));
    else if (TALL_H[t]) pix = MAT.stackTile(ts, t, 2);
    else if (!this.indoor && BLD.has(t)) pix = MAT.stackTiles(ts, this.bldStack(mx, my));
    else if (!this.indoor) pix = t === T.TRUNK ? MAT.stackTiles(ts, [T.TRUNK, T.TRUNK, T.TRUNK, T.TRUNK].slice(0, Math.round(MISC_H[T.TRUNK]))) : MAT.stackTiles(ts, Array(Math.max(1, Math.round(this.cellH[my * this.mw + mx]))).fill(t));
    else pix = MAT.plasterWall(ts, 72);

    if (this.indoor && (!inb || !LOW_H[t] && !TALL_H[t])) this.paintIndoorOverlay(pix, mx, my, s);
    else if (!this.indoor && this.deckind(mx, my, s) === 'door') this.paintIndoorOverlay(pix, mx, my, s, true);
    this.paintDecals(pix, mx, my, s);
    return { pix, d: pix.d, w: pix.w, hu: pix.h / TEXEL };
  }

  /** Doors, windows and chalkboards on a plaster face. Groups of adjacent cells share one wide texture. */
  paintIndoorOverlay(pix, mx, my, s, outdoor = false) {
    const kind = this.deckind(mx, my, s); if (!kind) return;
    const dx = s < 2 ? 1 : 0, dy = s < 2 ? 0 : 1;
    let start = 0, end = 0;
    while (this.deckind(mx - dx * (start + 1), my - dy * (start + 1), s) === kind) start++;
    while (this.deckind(mx + dx * (end + 1), my + dy * (end + 1), s) === kind) end++;
    const len = start + end + 1, along = (s === 1 || s === 2) ? start : end;   // u grows with +x on S faces, +y on W faces
    const idx = along;                                                          // cell index within the group along u
    const gx = mx - dx * start, gy = my - dy * start;
    let grp;
    if (kind === 'door' || kind === 'doorlock') {
      const info = this.doorInfo(gx, gy, outdoor ? s : s) || {};
      let text = null;
      if (info.label && this.assets.text) for (const sz of [10, 9, 8, 7]) { text = this.assets.text(tr(info.plate || info.label), sz, '#f6efcf', { bold: true, outline: '#02070a', outlineW: 1 }); if (!text || text.w <= len * TEXEL - 8) break; }
      grp = MAT.doorGroup(len, { locked: kind === 'doorlock', label: !!info.label, text });
    } else if (kind === 'window') grp = MAT.windowPane();
    else if (kind === 'board') {
      const lines = this.chalkLines(gx, gy); const fitLine = (l, i) => { if (!this.assets.text) return null; let t = null; for (const sz of (i ? [11, 10, 9, 8, 7] : [13, 12, 11, 10, 9, 8])) { t = this.assets.text(l, sz, i ? '#d8e4d8' : '#f2f8ec', { outline: '#0a1812', outlineW: 1 }); if (!t || t.w <= len * TEXEL - 18) break; } return t; };
      grp = MAT.boardGroup(len, lines.map(fitLine));
    }
    if (!grp) return;
    pix.blit(grp, -idx * TEXEL, pix.h - grp.h, 0, 0, grp.w, grp.h);
    if (kind === 'window') return;
  }
  doorInfo(gx, gy, s) {
    for (const o of this.m.objects) {
      if (o.type !== 'door' && o.type !== 'lockeddoor') continue;
      const tx = Math.floor(o.x / 32), ty = Math.floor(o.y / 32);
      if (Math.abs(tx - gx) <= 1 && ty === gy || (ty === gy && tx === gx) || (Math.abs(ty - gy) <= 1 && tx === gx)) return { label: o.label, plate: o.plate, locked: o.type === 'lockeddoor' };
    }
    return null;
  }
  chalkLines(gx, gy) {
    const o = this.m.objects.find((q) => q.type === 'chalk');
    return o ? o.lines.map(tr) : [];
  }

  paintDecals(pix, mx, my, s) {
    for (const d of this.decals) {
      if (d.s !== s) continue;
      if (s < 2 ? d.cy !== my : d.cx !== mx) continue;
      const cell = s < 2 ? mx : my, dcell = s < 2 ? d.cx : d.cy;
      if (Math.abs(dcell - cell) > 1 + Math.ceil(d.pix.w / 64)) continue;
      const cl = s === 0 || s === 3 ? cell + 1 - d.lat : d.lat - cell;           // face-local lateral position in units
      const x0 = Math.round(cl * TEXEL - d.pix.w / 2), y0 = Math.round(pix.h - (d.z0 * TEXEL + d.pix.h));
      pix.blit(d.pix, x0, y0);
    }
  }

  topTex(tile) {
    let t = this.tops.get(tile);
    if (!t) { t = MAT.topSurface(this.assets.tiles, tile); this.tops.set(tile, t); }
    return t;
  }

  // ------------------------------------------------------------------ lighting
  buildLightmap(lights, amb) {
    const lm = this.lm, n = this.lw * this.lh;
    for (let i = 0; i < n; i++) { lm[i * 3] = amb.r; lm[i * 3 + 1] = amb.g; lm[i * 3 + 2] = amb.b; }
    for (const L of lights) {
      if (L.i <= 0.001) continue;
      const r = L.r, x0 = Math.max(0, Math.floor((L.x - r) * LMS)), x1 = Math.min(this.lw - 1, Math.floor((L.x + r) * LMS));
      const y0 = Math.max(0, Math.floor((L.y - r) * LMS)), y1 = Math.min(this.lh - 1, Math.floor((L.y + r) * LMS));
      const tr = L.tint[0] * L.i, tg = L.tint[1] * L.i, tb = L.tint[2] * L.i;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const d = Math.hypot((x + 0.5) / LMS - L.x, (y + 0.5) / LMS - L.y);
        if (d >= r) continue;
        const a = 1 - d / r, k = a * a, i = (y * this.lw + x) * 3;
        lm[i] += tr * k; lm[i + 1] += tg * k; lm[i + 2] += tb * k;
      }
    }
  }
  lmAt(x, y) { // returns an offset into lm
    let ix = (x * LMS) | 0, iy = (y * LMS) | 0;
    if (ix < 0) ix = 0; else if (ix >= this.lw) ix = this.lw - 1;
    if (iy < 0) iy = 0; else if (iy >= this.lh) iy = this.lh - 1;
    return (iy * this.lw + ix) * 3;
  }
  fog(d) { return d < 2.2 ? 1 : clamp(1 - (d - 2.2) / 13, 0.02, 1) ** 1.4; }   // v16: the dark closes in sooner

  // ------------------------------------------------------------------ frame
  /**
   * cam: { x, y, yaw, zoom?, bob? }  (world units, radians)
   * f:   { lights:[{x,y,r,i,tint}], sprites:[{x,y,z,pix,ox,oy,scale,flip,alpha,bright,shadow}], flash:{on,dim,boom}, amb:{r,g,b}, time }
   */
  render(cam, f) {
    const { W, H } = this, px = this.px, dep = this.depth;
    this.time = f.time || 0;
    const plane = this.plane0 / (cam.zoom || 1), fl = (W / 2) / plane, camZ = cam.camZ ?? this.camZ;
    const horizon = this.horizon0 + Math.round(cam.bob || 0);
    this.f = fl; this.hz = horizon; this.pl = plane;
    const dirx = Math.cos(cam.yaw), diry = Math.sin(cam.yaw), plx = -diry * plane, ply = dirx * plane;
    this.cam = { x: cam.x, y: cam.y, dirx, diry, plx, ply, pl2: plane * plane };
    const tint = this.tint, flash = f.flash || { on: false };
    this.buildLightmap(f.lights || [], f.amb || { r: 0.1, g: 0.1, b: 0.14 });
    if (this.indoor) { if (this.fans.length) { this.paintFans(Math.floor(this.time * 12)); } }
    this.setFixtures(f.fixtures || this.fixtures);

    // flashlight cone, per screen column (angle from the view axis)
    const boom = flash.boom ?? 3.4, fp = flash.on ? 0.85 * (flash.dim ?? 1) : 0;   // v35: was 1.55 (far too strong)
    for (let x = 0; x < W; x++) {
      const a = Math.atan(((2 * (x + 0.5)) / W - 1) * plane);
      this.cone[x] = fp * smooth(0.46, 0.08, Math.abs(a));   // v35: narrower beam
    }
    const flFall = (d) => { const e = Math.max(0.3, d - boom + 0.6); return Math.max(0, 1 - e / 7) ** 1.3 * 1.0; };   // v35: shorter reach

    // ---------------- sky / ceiling / floor
    const tr = tint[0], tg = tint[1], tb = tint[2];
    const ceilBmp = this.indoor ? this.ceil : null, cw = ceilBmp ? ceilBmp.w : 0, ceilH = MAT.INDOOR_WALL_H;
    const fb = this.floor, fw = fb.w, fh = fb.h, fd = fb.d, lm = this.lm;
    for (let y = 0; y < H; y++) {
      const p = y + 0.5 - horizon;
      if (p === 0) continue;
      const above = p < 0;
      const rowDist = above ? (ceilH - camZ) * fl / -p : camZ * fl / p;
      if (above && !this.indoor) {                                            // sky
        const sv = clamp(((y / Math.max(1, horizon)) * 138) | 0, 0, 139), sk = this.sky;
        for (let x = 0; x < W; x++) {
          const a = cam.yaw + Math.atan(((2 * (x + 0.5)) / W - 1) * plane);
          const su = (((a / 6.2831853) * sk.w) | 0) & (sk.w - 1);
          let c = sk.d[sv * sk.w + su];
          const k = f.sky ?? 1; px[y * W + x] = k === 1 ? c : rgba((c & 255) * k, ((c >>> 8) & 255) * k, ((c >>> 16) & 255) * k);
          dep[y * W + x] = 1e9;
        }
        continue;
      }
      const fg = this.fog(rowDist), fl2 = flFall(rowDist);
      let wx = cam.x + (dirx - plx) * rowDist, wy = cam.y + (diry - ply) * rowDist;
      const sx = (2 * plx * rowDist) / W, sy = (2 * ply * rowDist) / W;
      wx += sx * 0.5; wy += sy * 0.5;
      const bmp = above ? ceilBmp.d : fd, bw = above ? cw : fw, bh = above ? ceilBmp.h : fh, boost = above ? 1.25 : 1;
      const o = y * W;
      for (let x = 0; x < W; x++, wx += sx, wy += sy) {
        let tx = (wx * 32) | 0, ty = (wy * 32) | 0;
        if (tx < 0) tx = 0; else if (tx >= bw) tx = bw - 1;
        if (ty < 0) ty = 0; else if (ty >= bh) ty = bh - 1;
        const c = bmp[ty * bw + tx], li = this.lmAt(wx, wy), cone = this.cone[x] * fl2;
        let lr = (lm[li] * boost + cone) * fg, lg = (lm[li + 1] * boost + cone * 0.97) * fg, lb = (lm[li + 2] * boost + cone * 0.85) * fg;
        let r = (c & 255) * lr, g = ((c >>> 8) & 255) * lg, b = ((c >>> 16) & 255) * lb;
        const ir = lr < 1 ? 1 - lr : 0, ig = lg < 1 ? 1 - lg : 0, ib = lb < 1 ? 1 - lb : 0;
        r += tr * ir; g += tg * ig; b += tb * ib;
        const v = this.vig[o + x];
        px[o + x] = (255 << 24) | ((b * v > 255 ? 255 : b * v) << 16) | ((g * v > 255 ? 255 : g * v) << 8) | (r * v > 255 ? 255 : r * v);
        dep[o + x] = rowDist;
      }
    }

    // ---------------- walls and low furniture
    for (let x = 0; x < W; x++) this.column(x, plane, fl, horizon, camZ, flash, flFall);

    // ---------------- dark mist around the creature: drawn into the world first, so the creature rises out of it
    this.mistPass(f.mists, 1);

    // ---------------- billboards
    const list = [];
    for (const s of this.statics) {
      const pix = s.pix || (s.names ? this.assets.sprite(s.names[Math.floor(this.time * (s.fps || 4)) % s.names.length]) : this.assets.sprite(s.name));
      if (pix) list.push({ ...s, pix });
    }
    for (const s of f.sprites || []) if (s.pix) list.push(s);
    const c = this.cam;
    for (const s of list) s._d = (s.x - c.x) * c.dirx + (s.y - c.y) * c.diry;
    list.sort((a, b) => b._d - a._d);
    for (const s of list) if (s._d > 0.2) this.billboard(s, plane, fl, horizon, camZ, flash, flFall);
    this.mistPass(f.mists, 0.42);   // wisps drifting in FRONT of it too: it is never quite clear

    // ---------------- vignette over sprites too would double-darken; floor/walls already carry it
  }

  /** Projects a world point (units) to the 480x270 buffer. Returns { sx, sy, d } (d <= 0: behind the camera). */
  project(x, y, z) {
    const c = this.cam, dx = x - c.x, dy = y - c.y, d = dx * c.dirx + dy * c.diry;
    if (d <= 0.01) return { sx: 0, sy: 0, d };
    return { sx: ((dx * c.plx + dy * c.ply) / (c.pl2 * d) + 1) * 0.5 * this.W, sy: this.hz + (this.camZ - z) * this.f / d, d };
  }

  // ------------------------------------------------------------------ wall column
  column(x, plane, fl, horizon, camZ, flash, flFall) {
    const { W, H } = this, c = this.cam, cx = (2 * (x + 0.5)) / W - 1;
    const rdx = c.dirx + c.plx * cx, rdy = c.diry + c.ply * cx;
    let mx = Math.floor(c.x), my = Math.floor(c.y);
    const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx), ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
    const sx = rdx < 0 ? -1 : 1, sy = rdy < 0 ? -1 : 1;
    let sdx = rdx < 0 ? (c.x - mx) * ddx : (mx + 1 - c.x) * ddx, sdy = rdy < 0 ? (c.y - my) * ddy : (my + 1 - c.y) * ddy;
    let prevH = this.hAt(mx, my), openTop = null, n = 0, outside = false;
    for (let step = 0; step < 120 && n < 94; step++) {
      let side, d;
      if (sdx < sdy) { d = sdx; sdx += ddx; mx += sx; side = 0; } else { d = sdy; sdy += ddy; my += sy; side = 1; }
      const oob = !this.inb(mx, my), h = this.hAt(mx, my);
      if (h !== prevH) {
        if (openTop) { openTop.dEnd = d; openTop = null; }
        const s = this.segs[n++]; s.d = d; s.side = side; s.mx = mx; s.my = my; s.sx = sx; s.sy = sy; s.dEnd = -1;
        if (h > prevH) { s.z0 = prevH; s.z1 = h; s.face = true; } else { s.z0 = h; s.z1 = h; s.face = false; }
        if (h > 0 && camZ > h) openTop = s;
        prevH = h;
        if (h >= this.cap) break;
      }
      if (oob) { if (!outside) { outside = true; } if (!this.indoor && h < this.cap) break; }
    }
    if (openTop && openTop.dEnd < 0) openTop.dEnd = openTop.d + 0.001;
    this.nSeg = n;
    const px = this.px, dep = this.depth, tint = this.tint, lm = this.lm;
    for (let i = n - 1; i >= 0; i--) {
      const s = this.segs[i], d = s.d;
      const hx = c.x + rdx * d, hy = c.y + rdy * d;
      // ---- top surface (low furniture seen from above)
      if (s.dEnd > 0 && s.z1 > 0 && camZ > s.z1) {
        const dz = camZ - s.z1, yN = horizon + dz * fl / d, yF = horizon + dz * fl / s.dEnd;
        let y0 = Math.max(0, Math.floor(yF)), y1 = Math.min(H - 1, Math.floor(yN) - 1);
        for (let y = y0; y <= y1; y++) {
          const dist = dz * fl / (y + 0.5 - horizon), wx = c.x + rdx * dist, wy = c.y + rdy * dist;
          const ti = this.inb(Math.floor(wx), Math.floor(wy)) ? this.cellTile[Math.floor(wy) * this.mw + Math.floor(wx)] : -1;
          const top = this.topTex(ti < 0 ? T.DESK : ti);
          const col = top.d[(((wy * 32) | 0) & 31) * 32 + (((wx * 32) | 0) & 31)];
          const li = this.lmAt(wx, wy), fg = this.fog(dist), fo = this.cone[x] * flFall(dist);
          const lr = (lm[li] + fo) * fg, lg = (lm[li + 1] + fo * 0.97) * fg, lb = (lm[li + 2] + fo * 0.85) * fg;
          const r = (col & 255) * lr + tint[0] * (lr < 1 ? 1 - lr : 0), g = ((col >>> 8) & 255) * lg + tint[1] * (lg < 1 ? 1 - lg : 0), b = ((col >>> 16) & 255) * lb + tint[2] * (lb < 1 ? 1 - lb : 0);
          const v = this.vig[y * W + x];
          px[y * W + x] = (255 << 24) | ((b * v > 255 ? 255 : b * v) << 16) | ((g * v > 255 ? 255 : g * v) << 8) | (r * v > 255 ? 255 : r * v);
          dep[y * W + x] = dist;
        }
      }
      if (!s.face) continue;
      // ---- vertical face
      const sideIdx = s.side === 0 ? (s.sx > 0 ? SIDE.W : SIDE.E) : (s.sy > 0 ? SIDE.N : SIDE.S);
      const face = this.face(s.mx, s.my, sideIdx);
      let u = s.side === 0 ? hy - Math.floor(hy) : hx - Math.floor(hx);
      if (sideIdx === SIDE.N || sideIdx === SIDE.E) u = 1 - u;
      const tx = clamp((u * TEXEL) | 0, 0, TEXEL - 1);
      const yTop = horizon + (camZ - s.z1) * fl / d, yBot = horizon + (camZ - s.z0) * fl / d;
      const y0 = Math.max(0, Math.floor(yTop)), y1 = Math.min(H - 1, Math.ceil(yBot) - 1);
      if (y1 < y0) continue;
      const li = this.lmAt(hx + NX[sideIdx] * 0.45, hy + NY[sideIdx] * 0.45), fg = this.fog(d), fo = this.cone[x] * flFall(d);
      // v16: the school's outside walls were far too bright against the night: dim them (the flashlight still lights them fully)
      const wk = this.indoor ? 1 : 0.58;
      let lr = (lm[li] * wk + fo) * fg, lg = (lm[li + 1] * wk + fo * 0.97) * fg, lb = (lm[li + 2] * wk + fo * 0.85) * fg;
      const dzr = d / fl;
      let z = camZ - (y0 + 0.5 - horizon) * dzr;
      const fd = face.d, fhu = face.hu, fpx = face.pix.h;
      for (let y = y0; y <= y1; y++, z -= dzr) {
        let ty = ((fhu - z) * TEXEL) | 0; if (ty < 0) ty = 0; else if (ty >= fpx) ty = fpx - 1;
        const col = fd[ty * TEXEL + tx];
        const vg = this.indoor ? 0.84 + 0.3 * clamp(z / fhu, 0, 1) : 1;      // ceiling lamps light the top of a wall more
        const ar = lr * vg, ag = lg * vg, ab = lb * vg;
        let r = (col & 255) * ar, g = ((col >>> 8) & 255) * ag, b = ((col >>> 16) & 255) * ab;
        r += tint[0] * (ar < 1 ? 1 - ar : 0); g += tint[1] * (ag < 1 ? 1 - ag : 0); b += tint[2] * (ab < 1 ? 1 - ab : 0);
        const v = this.vig[y * W + x];
        px[y * W + x] = (255 << 24) | ((b * v > 255 ? 255 : b * v) << 16) | ((g * v > 255 ? 255 : g * v) << 8) | (r * v > 255 ? 255 : r * v);
        dep[y * W + x] = d;
      }
    }
  }

  // ------------------------------------------------------------------ dark mist
  /** Drifting black mist around each {x,y,r,i}. Every pixel is turned back into a world position from its depth, so the mist
   *  hugs the floor and walls near the creature (and fades out smoothly with distance from it). k scales the strength. */
  mistPass(mists, k) {
    if (!mists || !mists.length) return;
    const { W, H } = this, c = this.cam, px = this.px, dep = this.depth, t = this.time;
    for (const m of mists) {
      const str = m.i * k; if (str <= 0.01) continue;
      const md = (m.x - c.x) * c.dirx + (m.y - c.y) * c.diry;          // its depth along the view axis
      if (md < -m.r) continue;
      const r2 = m.r * m.r, inv = 1 / m.r;
      for (let x = 0; x < W; x++) {
        const cx = (2 * (x + 0.5)) / W - 1, rdx = c.dirx + c.plx * cx, rdy = c.diry + c.ply * cx;
        for (let y = 0; y < H; y++) {
          const i = y * W + x, d = dep[i];
          if (d > 400 || d < md - m.r || d > md + m.r) continue;       // cheap reject: outside the mist's depth band
          const wx = c.x + rdx * d, wy = c.y + rdy * d, dx = wx - m.x, dy = wy - m.y, q = dx * dx + dy * dy;
          if (q >= r2) continue;
          let a = 1 - Math.sqrt(q) * inv; a = a * a * (3 - 2 * a);
          const n = 0.5 + 0.25 * Math.sin(wx * 2.3 + t * 0.9 + Math.sin(wy * 1.7 + t * 0.5) * 1.5) + 0.25 * Math.sin(wy * 2.9 - t * 0.7 + wx * 1.3);
          const al = Math.min(0.92, a * (0.45 + 0.75 * n) * str);
          if (al <= 0.01) continue;
          const p = px[i], pr = p & 255, pg = (p >>> 8) & 255, pb = (p >>> 16) & 255;
          px[i] = (255 << 24) | (((pb + (14 - pb) * al) | 0) << 16) | (((pg + (6 - pg) * al) | 0) << 8) | ((pr + (10 - pr) * al) | 0);
        }
      }
    }
  }

  // ------------------------------------------------------------------ billboards
  billboard(s, plane, fl, horizon, camZ, flash, flFall) {
    const { W, H } = this, c = this.cam, px = this.px, dep = this.depth, tint = this.tint, lm = this.lm;
    const dx = s.x - c.x, dy = s.y - c.y, d = s._d;
    const sxc = ((dx * c.plx + dy * c.ply) / (c.pl2 * d) + 1) * 0.5 * W;
    const ppu = fl / d, scale = (s.scale ?? 1) / 32, sw = s.pix.w * scale * ppu, sh = s.pix.h * scale * ppu;
    if (sxc + sw < 0 || sxc - sw > W) return;
    const ox = s.ox ?? 0.5, oy = s.oy ?? 1;
    const xL = sxc - sw * ox, yAnchor = horizon + (camZ - (s.z || 0)) * ppu, yT = yAnchor - sh * oy;

    // soft contact shadow on the floor
    if (s.shadow) {
      const rx = s.shadow * ppu, ry = Math.max(1.5, rx * camZ / d), cy = horizon + camZ * ppu;
      for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(H - 1, Math.ceil(cy + ry)); y++) for (let x = Math.max(0, Math.floor(sxc - rx)); x <= Math.min(W - 1, Math.ceil(sxc + rx)); x++) {
        const k = ((x - sxc) / rx) ** 2 + ((y - cy) / ry) ** 2; if (k >= 1) continue;
        const i = y * W + x; if (dep[i] < d - 0.35) continue;
        const dk = 1 - 0.55 * (1 - k), p = px[i];
        px[i] = (255 << 24) | ((((p >>> 16) & 255) * dk) << 16) | ((((p >>> 8) & 255) * dk) << 8) | ((p & 255) * dk);
      }
    }

    const li = this.lmAt(s.x, s.y), fg = this.fog(d), mb = s.bright ?? 0.3;
    const fo = flash.on ? 1 : 0, dk = s.dark ?? 1;
    const x0 = Math.max(0, Math.floor(xL)), x1 = Math.min(W - 1, Math.ceil(xL + sw) - 1), y0 = Math.max(0, Math.floor(yT)), y1 = Math.min(H - 1, Math.ceil(yT + sh) - 1);
    const pw = s.pix.w, ph = s.pix.h, pd = s.pix.d, alpha = s.alpha ?? 1;
    for (let x = x0; x <= x1; x++) {
      let u = (((x + 0.5 - xL) / sw) * pw) | 0; if (u < 0) u = 0; else if (u >= pw) u = pw - 1;
      if (s.flip) u = pw - 1 - u;
      const cone = this.cone[x] * (fo ? flFall(d) : 0);
      const lr = (Math.max(lm[li], mb * 0.55) + cone) * fg * (s.glow ? 1.4 : 1) + mb * 0.25 * fg, lg = (Math.max(lm[li + 1], mb * 0.55) + cone * 0.97) * fg + mb * 0.25 * fg, lb = (Math.max(lm[li + 2], mb * 0.6) + cone * 0.85) * fg + mb * 0.28 * fg;
      for (let y = y0; y <= y1; y++) {
        const i = y * W + x;
        if (dep[i] < d - 0.05) continue;
        let v = (((y + 0.5 - yT) / sh) * ph) | 0; if (v < 0) v = 0; else if (v >= ph) v = ph - 1;
        const col = pd[v * pw + u], a = col >>> 24; if (a < 24) continue;
        let r = (col & 255) * lr * dk, g = ((col >>> 8) & 255) * lg * dk, b = ((col >>> 16) & 255) * lb * dk;
        r += tint[0] * (lr < 1 ? 1 - lr : 0); g += tint[1] * (lg < 1 ? 1 - lg : 0); b += tint[2] * (lb < 1 ? 1 - lb : 0);
        const vv = this.vig[i], k = alpha * (a / 255);
        if (k < 0.99) { const p = px[i]; r = (p & 255) + (r * vv - (p & 255)) * k; g = ((p >>> 8) & 255) + (g * vv - ((p >>> 8) & 255)) * k; b = ((p >>> 16) & 255) + (b * vv - ((p >>> 16) & 255)) * k; px[i] = (255 << 24) | ((b > 255 ? 255 : b) << 16) | ((g > 255 ? 255 : g) << 8) | (r > 255 ? 255 : r); }
        else px[i] = (255 << 24) | ((b * vv > 255 ? 255 : b * vv) << 16) | ((g * vv > 255 ? 255 : g * vv) << 8) | (r * vv > 255 ? 255 : r * vv);
      }
    }
  }
}
