import { T, TILESET_COLS, TILESET_COUNT } from '../assets/TextureFactory.js';
import { TILE } from '../config.js';

// Tiles that block movement. DOOR is intentionally absent: doors are trigger zones.
export const SOLID = new Set([
  T.WALL, T.WINDOW, T.WINDOWLIT, T.ROOF, T.ROOFEDGE, T.FENCE, T.GATE, T.WALLBASE,
  T.TRUNK, T.BUSH, T.BED, T.PILLAR, T.WALLINT, T.DOORLOCK, T.SHELF, T.DESK, T.BOARD,
  T.WALLSTAIN, T.WALLPEEL, T.WINDOWBROKEN, T.ROOFTIN, T.ROOFTINEDGE, T.LIBSHELF, T.READTABLE, T.WINDOWRAIN,
  T.WALLINTBASE, T.DESK2, T.DESK3,
]);

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const grid = (w, h, v) => Array.from({ length: h }, () => Array(w).fill(v));

/** Builds a layered tile map and exports it as Tiled-compatible JSON. */
export class MapBuilder {
  constructor(id, w, h, fill = T.GRASS) {
    this.id = id; this.w = w; this.h = h;
    this.layers = { ground: grid(w, h, fill), deco: grid(w, h, -1), above: grid(w, h, -1) };
    this.objects = [];
    this.spawns = {};
    this.meta = {};
  }
  set(layer, x, y, id) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.layers[layer][y][x] = id;
    return this;
  }
  rect(layer, x, y, w, h, id) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(layer, x + i, y + j, id);
    return this;
  }
  scatter(layer, x, y, w, h, ids, seed, chance = 1) {
    const r = mulberry(seed);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (r() < chance) this.set(layer, x + i, y + j, ids[(r() * ids.length) | 0]);
    return this;
  }
  tileAt(layer, x, y) { return this.layers[layer][y]?.[x] ?? -1; }
  addObject(o) {
    // Door graphics live in the wall row, but the actual doorway must be a
    // walkable cell so the first-person renderer can cut the opening into the
    // wall and the player can reach the trigger. Older maps placed doors on a
    // solid border tile, which made the wall hide the door and trapped the
    // player outside it. Copy the nearest non-solid floor material underneath
    // every door cell; locked doors remain blocked by T.DOORLOCK in `deco`
    // until the story unlocks them.
    if (o.type === 'door' || o.type === 'lockeddoor') {
      const tx = Math.floor((o.x ?? 0) / TILE), ty = Math.floor((o.y ?? 0) / TILE);
      const tw = Math.max(1, Math.round((o.w ?? TILE) / TILE));
      const candidates = (x, y) => [[x, y + 1], [x, y - 1], [x + 1, y], [x - 1, y]];
      for (let i = 0; i < tw; i++) {
        const x = tx + i;
        if (!SOLID.has(this.layers.ground[ty]?.[x])) continue;
        let floor = T.FLOOR;
        for (const [cx, cy] of candidates(x, ty)) {
          const v = this.layers.ground[cy]?.[cx];
          if (v != null && v >= 0 && !SOLID.has(v)) { floor = v; break; }
        }
        this.layers.ground[ty][x] = floor;
      }
    }
    this.objects.push(o); return this;
  }

  /** true = blocked. Combines ground + deco layers with SOLID, plus `blocks` objects. */
  collisionGrid() {
    const c = grid(this.w, this.h, false);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (SOLID.has(this.layers.ground[y][x]) || SOLID.has(this.layers.deco[y][x])) c[y][x] = true;
    }
    for (const o of this.objects) if (o.blocks) {
      const tx = Math.floor(o.x / TILE), ty = Math.floor(o.y / TILE);
      const tw = Math.max(1, Math.round((o.w || TILE) / TILE)), th = Math.max(1, Math.round((o.h || TILE) / TILE));
      for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) if (c[ty + j]) c[ty + j][tx + i] = true;
    }
    return c;
  }

  toTiled() {
    const layer = (name, data) => ({
      name, type: 'tilelayer', width: this.w, height: this.h, x: 0, y: 0, opacity: 1, visible: true,
      data: data.flat().map((v) => (v < 0 ? 0 : v + 1)),
    });
    return {
      version: '1.10', type: 'map', orientation: 'orthogonal', renderorder: 'right-down', infinite: false,
      width: this.w, height: this.h, tilewidth: TILE, tileheight: TILE, nextlayerid: 4, nextobjectid: 1,
      layers: [layer('ground', this.layers.ground), layer('deco', this.layers.deco), layer('above', this.layers.above)],
      tilesets: [{
        name: 'tiles', firstgid: 1, tilewidth: TILE, tileheight: TILE, margin: 0, spacing: 0,
        image: 'tiles', imagewidth: TILESET_COLS * TILE, imageheight: Math.ceil(TILESET_COUNT / TILESET_COLS) * TILE,
        columns: TILESET_COLS, tilecount: TILESET_COUNT,
      }],
    };
  }
}
