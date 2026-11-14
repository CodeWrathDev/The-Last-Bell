import { T } from '../assets/TextureFactory.js';
import { MapBuilder, mulberry } from './MapBuilder.js';
import { TILE, OUTDOOR_ZOOM } from '../config.js';

const px = (t) => t * TILE;

/** Outdoor campus: courtyard, banyan tree, main building, gate, side buildings. */
export function buildCampus() {
  const W = 88, H = 28;   // v15: 40 -> 88 wide; east grounds (x40-62) and the monastery compound (x64-86) are new
  const m = new MapBuilder('campus', W, H, T.GRASS);
  m.meta = { name: 'School Courtyard', outdoor: true, rain: true, ambient: 0.82, bgm: 'rain', zoom: OUTDOOR_ZOOM, ghostDelay: 30 };

  // Grass variation
  m.scatter('ground', 0, 0, W, H, [T.GRASS2], 11, 0.35);

  // Courtyard concrete + wet patches + puddles
  m.rect('ground', 2, 6, 36, 17, T.PATH);
  m.scatter('ground', 2, 6, 36, 17, [T.PATHCRACK, T.PATHMOSS], 17, 0.1);
  m.scatter('ground', 2, 6, 36, 17, [T.PATHLEAF], 19, 0.07);
  for (const [dx, dy] of [[9, 21], [30, 21], [14, 7], [26, 7]]) m.set('ground', dx, dy, T.DRAIN);
  m.scatter('ground', 2, 6, 36, 17, [T.PATHWET], 21, 0.28);
  m.scatter('ground', 2, 7, 36, 15, [T.PUDDLE], 31, 0.03);
  // Entrance path (gate -> stairs)
  m.rect('ground', 18, 6, 4, 17, T.PATH);
  m.scatter('ground', 18, 6, 4, 17, [T.PATHWET], 41, 0.2);
  // Road outside the gate
  m.rect('ground', 0, 24, W, 3, T.PATH);
  m.scatter('ground', 0, 24, W, 3, [T.PATHWET], 51, 0.35);

  // Back tree line (solid bushes on row 0, canopy above)
  for (let x = 0; x < W; x++) { m.set('deco', x, 0, T.BUSH); if (x % 3 !== 1) m.set('above', x, 0, T.CANOPY); }
  for (let y = 1; y < 6; y++) { m.set('deco', 0, y, T.BUSH); m.set('deco', W - 1, y, T.BUSH); }
  for (let y = 6; y < 24; y++) { m.set('deco', 0, y, T.BUSH); m.set('deco', W - 1, y, T.BUSH); }

  // Original courtyard east edge (x=39): bushes, except a 4-tile gap (y 13..16) that opens onto the east grounds
  for (let y = 1; y < 23; y++) if (y < 13 || y > 16) m.set('deco', 39, y, T.BUSH);

  // ---- Main building (x 8..31) ----
  const bx = 8, bw = 24;
  m.rect('deco', bx, 1, bw, 1, T.ROOF);
  m.rect('deco', bx, 2, bw, 1, T.ROOFEDGE);
  const lit = new Set([15, 27]), broken = new Set([9, 21]);
  for (let x = bx; x < bx + bw; x++) {
    m.set('deco', x, 3, T.WALL);
    m.set('deco', x, 4, (x - bx) % 3 === 1 ? (lit.has(x) ? T.WINDOWLIT : broken.has(x) ? T.WINDOWBROKEN : T.WINDOW) : T.WALL);
    m.set('deco', x, 5, T.WALLBASE);
  }
  for (let x = bx; x < bx + bw; x++) {   // weathering: peeling paint and rain stains on the plain wall
    if (m.tileAt('deco', x, 3) !== T.WALL) continue;
    if ((x * 5) % 7 === 0) m.set('deco', x, 3, T.WALLPEEL); else if ((x * 3) % 5 === 1) m.set('deco', x, 3, T.WALLSTAIN);
  }
  for (const wx of lit) m.addObject({ type: 'light', x: px(wx) + 16, y: px(4) + 18, light: 74, tint: 0xffc060, intensity: 0.7 });
  m.set('deco', 17, 4, T.PILLAR); m.set('deco', 22, 4, T.PILLAR);
  m.set('deco', 17, 5, T.PILLAR); m.set('deco', 22, 5, T.PILLAR);
  m.set('deco', 19, 5, T.DOOR); m.set('deco', 20, 5, T.DOOR);
  m.rect('ground', 18, 6, 4, 1, T.STAIRS);
  // Covered entrance veranda: a familiar Myanmar school frontage with a shallow
  // concrete apron, square posts, and rainwater channels under the eaves.
  m.rect('ground', 14, 6, 12, 2, T.COURT);
  m.scatter('ground', 14, 6, 12, 2, [T.PATHWET, T.PATHMOSS], 117, 0.22);
  m.rect('ground', 18, 6, 4, 1, T.STAIRS);
  for (const [cx, cy] of [[14, 6], [25, 6], [14, 7], [25, 7]]) m.set('deco', cx, cy, T.PILLAR);
  for (const x of [15, 16, 17, 22, 23, 24]) m.set('ground', x, 7, T.DRAIN);
  m.addObject({ type: 'door', x: px(19), y: px(5), w: px(2), h: px(1), target: 'hall', spawn: 'fromCampus', label: 'Enter school building' });
  m.addObject({ type: 'sign', x: px(4), y: px(11) + 16, text: 'WEST WING', board: true, bw: 60, bh: 16, size: 11, en: 'WEST WING', tx: 3, ty: 11.5, z: 0.28, sw: 72, sh: 24, enSize: 11 });
  m.addObject({ type: 'sign', x: px(36), y: px(11) + 16, text: 'EAST WING', board: true, bw: 60, bh: 16, size: 11, en: 'EAST WING', tx: 36, ty: 11.5, z: 0.28, sw: 72, sh: 24, enSize: 11 });
  m.addObject({ type: 'sign', x: px(5), y: px(20) + 16, text: 'GUARD HOUSE', board: true, bw: 80, bh: 16, size: 11, en: 'GUARD HOUSE', tx: 4.5, ty: 20.5, z: 0.28, sw: 88, sh: 24, enSize: 11 });
  m.addObject({ type: 'sign', x: px(2), y: px(22) + 10, text: 'ကျောင်းဝင်း', board: true, bw: 92, bh: 18, size: 12,
    en: 'SCHOOL COMPOUND', my: 'ကျောင်းဝင်း', tx: 4.1, ty: 22.35, z: 0.2, sw: 126, sh: 38, enSize: 10, mySize: 14 });
  // Porch lanterns (red) either side of the entrance, with a dim red glow
  for (const lx of [18.45, 21.55]) {
    m.addObject({ type: 'decor', sprite: 'lantern', x: px(lx) - 16, y: px(6) + 8, w: 32, h: 0, z: 0.72, glowSprite: true });
    m.addObject({ type: 'light', x: px(lx), y: px(6) + 4, light: 80, tint: 0xff3a22, intensity: 0.8, flicker: true });
  }
  // Moonlight wash on the facade so the building, its trim and its signboard read at night
  for (const wx of [10, 17, 24, 31]) m.addObject({ type: 'light', x: px(wx), y: px(6) + 10, light: 230, tint: 0xa6b8f0, intensity: 0.95 });

  // ---- West & east wings ----
  const wing = (x0, w, litX) => {
    m.rect('deco', x0, 8, w, 1, T.ROOFTIN); m.rect('deco', x0, 9, w, 1, T.ROOFTINEDGE);
    for (let x = x0; x < x0 + w; x++) { m.set('deco', x, 10, (x - x0) % 2 ? (x === litX ? T.WINDOWLIT : T.WINDOW) : T.WALL); m.set('deco', x, 11, T.WALLBASE); }
  };
  wing(1, 6, 4); wing(33, 6, 36);
  m.addObject({ type: 'note', x: px(3), y: px(12) + 10, w: 28, h: 20, text: 'Boarded-up wing. The paint is peeling off in long strips.' });

  // ---- Service passage door (west wing, opens in Chapter 5 once the girl is found) ----
  m.set('deco', 5, 11, T.DOORLOCK);
  m.addObject({ type: 'lockeddoor', id: 'service_door', x: px(5), y: px(11), w: px(1), h: px(1), tileX: 5, tileY: 11, needsFlags: ['reunion'], target: 'service', spawn: 'fromCampus', label: 'Service passage', chapter: 'ch5', text: 'A rusted service door at the foot of the west wing. It is sealed from the other side.' });

  // ---- Guard house (bottom-left) ----
  m.rect('deco', 3, 17, 4, 1, T.ROOF); m.rect('deco', 3, 18, 4, 1, T.ROOFEDGE);
  m.set('deco', 3, 19, T.WALL); m.set('deco', 4, 19, T.WINDOWLIT); m.set('deco', 5, 19, T.WALL); m.set('deco', 6, 19, T.WINDOW);
  m.rect('deco', 3, 20, 4, 1, T.WALLBASE);

  // ---- Banyan tree with planter ring ----
  // (moved to the west side in v15 so the school and its signboard are in view from the gate)
  m.rect('deco', 7, 13, 6, 4, T.BED);
  m.rect('deco', 9, 14, 2, 2, T.TRUNK);
  m.addObject({ type: 'canopy', x: px(9) + 16, y: px(15), sprite: 'banyan' });
  // Nat spirit house at the foot of the banyan (v16: the school-compound pagodas were removed)
  m.addObject({ type: 'prop', x: px(13), y: px(14), w: 32, h: 32, sprite: 'nat_shrine', blocks: true, light: 0, text: 'A spirit house at the foot of the banyan. The offerings are fresh. Inside the dark doorway, something is looking out.' });
  m.addObject({ type: 'light', x: px(13) + 16, y: px(14) + 8, light: 64, tint: 0xff4a28, intensity: 0.55, flicker: true });

  // ---- Basketball court (east) ----
  m.rect('ground', 27, 14, 9, 8, T.COURT);
  m.rect('ground', 27, 17, 9, 1, T.COURTH);
  m.rect('ground', 31, 14, 1, 8, T.COURTV);
  m.addObject({ type: 'prop', x: px(36), y: px(15), w: 32, h: 32, sprite: 'hoop', blocks: true, text: 'A rusted basketball hoop. The net sways though there is no wind.' });

  // ---- Fence + locked gate ----
  m.rect('deco', 1, 23, 62, 1, T.FENCE);
  m.rect('deco', 19, 23, 2, 1, T.GATE);
  m.addObject({ type: 'gate', x: px(19), y: px(23), w: px(2), h: px(1), blocks: true, label: 'Gate' });

  // ---- Flagpole & flag ----
  m.addObject({ type: 'prop', x: px(14), y: px(9), w: 32, h: 32, sprite: 'flagpole', ox: 0.25, blocks: true, text: 'The flagpole. The flag hangs limp and soaked.' });

  // ---- Lamps (lit) ----
  for (const [lx, ly] of [[16, 22], [23, 22], [3, 13], [36, 11], [16, 8], [23, 8]]) {
    m.addObject({ type: 'lamp', x: px(lx), y: px(ly), w: 32, h: 32, sprite: 'lamp', blocks: true, light: 150, flicker: (lx + ly) % 3 === 0, text: 'A streetlamp. It buzzes faintly.' });
  }

  // ---- Props: every corner gets something to look at ----
  const decor = (sprite, tx, ty, wTiles, hTiles, blocks = true, extra = {}) => m.addObject({ type: 'decor', sprite, x: px(tx), y: px(ty), w: px(wTiles), h: px(hTiles), blocks, ...extra });
  decor('bench', 14, 18, 2, 1); decor('bench', 23, 19, 2, 1);
  decor('pot_flower', 17, 6, 1, 1); decor('pot_flower', 22, 6, 1, 1);
  // Shoes and school bags left under the veranda make the entrance feel used,
  // even after the last bell. Existing atlas props keep this dressing cheap.
  decor('bench', 15, 8, 2, 1); decor('bag', 17, 7, 1, 1, false, { rot: -0.12 });
  decor('bag', 23, 7, 1, 1, false, { rot: 0.15 });
  decor('books', 20, 7, 1, 1, false); decor('bin', 24, 8, 1, 1);
  decor('pot_fern', 7, 11, 1, 1); decor('bin', 7, 20, 1, 1); decor('bin', 31, 12, 1, 1);
  decor('papers', 12, 10, 1, 1, false); decor('papers', 26, 20, 1, 1, false); decor('books', 30, 19, 1, 1, false);
  decor('bag', 8, 18, 1, 1, false, { rot: -0.2 });

  // ---- Pickups & story objects ----
  m.addObject({ type: 'pickup', id: 'battery', x: px(5), y: px(21), w: 32, h: 32, sprite: 'item_battery', text: 'A spare flashlight battery, left beside the guard house.' });
  m.addObject({ type: 'note', x: px(24), y: px(7), w: 32, h: 32, sprite: 'item_note', text: 'Notice board: "ညဘက် ကျောင်းအတွင်း မနေရ။ — School closed after 8 PM. By order of the Principal."' });
  m.addObject({ type: 'action', id: 'find_ground_clue', chapter: 'ch1', x: px(14), y: px(19), w: 32, h: 32, sprite: 'item_note', text: 'A soaked class photo under the bench. One face has been scratched out, and a wet footprint points toward the main building.', done: 'The footprint is already in your notebook.' });

  // Open drains and rain collection points are common around older school
  // compounds; they also break up the large flat courtyard silhouette.
  for (const [dx, dy] of [[3, 6], [12, 6], [27, 6], [34, 6], [3, 22], [27, 22], [35, 22]]) m.set('ground', dx, dy, T.DRAIN);
  for (const [lx, ly] of [[11, 6], [28, 6], [11, 22], [28, 22]]) {
    m.addObject({ type: 'light', x: px(lx), y: px(ly) + 10, light: 105, tint: 0x9bb7db, intensity: 0.34 });
  }


  // East edge of the school grounds (x=63): bushes with a gap, leading to the monastery compound
  for (let y = 1; y < 23; y++) if (y < 13 || y > 16) m.set('deco', 63, y, T.BUSH);
  // ================= EAST GROUNDS (x 40..62) =================
  m.rect('ground', 38, 13, 12, 4, T.PATH); m.scatter('ground', 38, 13, 12, 4, [T.PATHWET, T.PATHMOSS, T.PATHLEAF], 61, 0.3);
  // sports field: grass inside a worn running track
  m.rect('ground', 46, 8, 16, 13, T.PATH); m.rect('ground', 47, 9, 14, 11, T.GRASS); m.scatter('ground', 47, 9, 14, 11, [T.GRASS2], 71, 0.5);
  m.scatter('ground', 46, 8, 16, 13, [T.PATHWET, T.PATHCRACK, T.PUDDLE], 73, 0.12);
  m.rect('ground', 50, 21, 3, 2, T.PATH); m.rect('ground', 56, 6, 3, 2, T.PATH);
  const bld = (x0, y0, w, rows, litX, brokenX, kind) => {      // small tin-roofed block, `rows` tall (4 or 5)
    m.rect('deco', x0, y0, w, 1, T.ROOFTIN); m.rect('deco', x0, y0 + 1, w, 1, T.ROOFTINEDGE);
    for (let x = x0; x < x0 + w; x++) {
      if (rows === 5) m.set('deco', x, y0 + 2, T.WALL);
      m.set('deco', x, y0 + rows - 2, (x - x0) % 2 ? (x === litX ? T.WINDOWLIT : x === brokenX ? T.WINDOWBROKEN : T.WINDOW) : T.WALL);
      m.set('deco', x, y0 + rows - 1, T.WALLBASE);
    }
  };
  bld(46, 1, 15, 5, 53, 57);                                // hostel block (north)
  bld(41, 17, 6, 4, 44, 0);                                 // canteen (south-west of the field)
  m.addObject({ type: 'sign', x: px(53), y: px(5) + 16, text: 'HOSTEL BLOCK', board: true, bw: 100, bh: 16, size: 11, en: 'HOSTEL BLOCK', my: 'ကျောင်းသားအဆောင်', tx: 53.5, ty: 5.5, z: 0.12, sw: 128, sh: 36, enSize: 12, mySize: 13 });
  m.addObject({ type: 'sign', x: px(44), y: px(20) + 16, text: 'CANTEEN', board: true, bw: 70, bh: 16, size: 11, en: 'CANTEEN', tx: 44, ty: 20.5, z: 0.28, sw: 72, sh: 24, enSize: 11 });
  m.addObject({ type: 'sign', x: px(43), y: px(14), text: 'SPORTS GROUND', board: true, bw: 100, bh: 16, size: 11, en: 'SPORTS GROUND', my: 'အားကစားကွင်း', tx: 41.6, ty: 12.62, z: 0.1, sw: 110, sh: 36, enSize: 11, mySize: 13 });
  // a second banyan (trunk only) on the field edge
  m.rect('deco', 58, 13, 4, 3, T.BED); m.rect('deco', 59, 13, 2, 2, T.TRUNK);
  m.addObject({ type: 'prop', x: px(61), y: px(10), w: 32, h: 32, sprite: 'nat_shrine', blocks: true, text: 'Another spirit house. The offering bowl is full of rainwater and a single hair ribbon.' });
  for (const [lx, ly] of [[45, 8], [62, 8], [45, 20], [62, 20], [43, 12]]) m.addObject({ type: 'lamp', x: px(lx), y: px(ly), w: 32, h: 32, sprite: 'lamp', blocks: true, light: 150, flicker: (lx + ly) % 3 === 0, text: 'A floodlight. It buzzes faintly.' });
  m.addObject({ type: 'light', x: px(53), y: px(14), light: 200, tint: 0x8fa8e8, intensity: 0.5 });
  m.addObject({ type: 'light', x: px(52), y: px(6) + 10, light: 200, tint: 0xa6b8f0, intensity: 0.8 });
  decor('bench', 48, 6, 2, 1); decor('bench', 55, 21, 2, 1); decor('bin', 45, 15, 1, 1); decor('pot_fern', 41, 16, 1, 1); decor('bag', 52, 15, 1, 1, false, { rot: 0.3 }); decor('papers', 49, 14, 1, 1, false);
  m.addObject({ type: 'note', x: px(47), y: px(14), w: 32, h: 32, sprite: 'item_note', text: 'A faded Sports Day banner is nailed to the post: \"Last race: 9 PM. No one finished it.\"' });
  m.addObject({ type: 'note', x: px(56), y: px(7), w: 32, h: 32, sprite: 'item_note', text: 'Hostel notice: \"Lights out at 8. Do not answer if someone knocks from the field side.\"' });

  // ================= MONASTERY COMPOUND (x 64..86) : the old bell =================
  m.rect('ground', 63, 13, 8, 4, T.PATH); m.rect('ground', 68, 6, 16, 16, T.PATH); m.scatter('ground', 63, 6, 22, 16, [T.PATHWET, T.PATHMOSS, T.PATHLEAF, T.PATHCRACK], 83, 0.3);
  m.rect('ground', 72, 10, 8, 8, T.COURT);                   // paved terrace round the bell
  bld(68, 1, 15, 5, 74, 79);                                 // zayat (rest hall) behind the compound
  m.addObject({ type: 'sign', x: px(75), y: px(5) + 16, text: 'OLD MONASTERY HALL', board: true, bw: 120, bh: 16, size: 11, en: 'OLD MONASTERY HALL', my: 'ဘုန်းကြီးကျောင်းဟောင်း', tx: 75.5, ty: 5.5, z: 0.12, sw: 150, sh: 36, enSize: 12, mySize: 13 });
  m.addObject({ type: 'prop', x: px(75), y: px(13), w: 64, h: 32, ox: 0.25, sprite: 'bell', blocks: true, text: 'The old temple bell. The rope is still wet, and it is swinging. Nobody is touching it.' });
  m.addObject({ type: 'light', x: px(76), y: px(13), light: 150, tint: 0xffa050, intensity: 0.6, flicker: true });
  m.addObject({ type: 'prop', x: px(84), y: px(18), w: 32, h: 32, sprite: 'nat_shrine', blocks: true, text: 'A spirit house with a school uniform folded neatly on its steps.' });
  for (const [lx, ly] of [[69, 8], [83, 8], [69, 20], [83, 20]]) m.addObject({ type: 'lamp', x: px(lx), y: px(ly), w: 32, h: 32, sprite: 'lamp', blocks: true, light: 150, flicker: true, text: 'An old lamp, swinging.' });
  m.rect('deco', 66, 18, 3, 2, T.BED); m.rect('deco', 67, 18, 1, 1, T.TRUNK);
  m.addObject({ type: 'note', x: px(78), y: px(15), w: 32, h: 32, sprite: 'item_note', text: 'A monk\'s note: \"The bell must never ring after the last class. It does not ring for us. It rings for the one who stayed.\"' });
  m.addObject({ type: 'note', x: px(65), y: px(12), w: 32, h: 32, sprite: 'item_note', text: 'Scratched into the gatepost: \"She waited by the bell. She is still waiting.\"' });
  decor('bench', 72, 19, 2, 1); decor('pot_flower', 76, 19, 1, 1); decor('pot_fern', 80, 19, 1, 1);

  m.spawns = { start: { x: px(19) + 16, y: px(21) }, fromHall: { x: px(19) + 16, y: px(7) + 8 }, fromService: { x: px(5) + 16, y: px(12) + 16 }, atGate: { x: px(19) + 16, y: px(20) } };
  m.meta.ghostPatrol = [[6, 15], [33, 20], [20, 8], [52, 14], [57, 18], [75, 16], [82, 14]];
  return m;
}
