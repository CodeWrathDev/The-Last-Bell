import { T } from '../assets/TextureFactory.js';
import { MapBuilder } from './MapBuilder.js';
import { TILE } from '../config.js';

const px = (t) => t * TILE;

// Shared room shell: top wall 2 tiles thick, 1 elsewhere. Doors are placed on wall cells (the player touches them to pass),
// exactly like the Library map. `doors` = [{x, side:'S'|'N', target, spawn, label, flags?, chapter?, locked?, hint?}]
function shell(id, W, H, { floor = T.FLOOR, name, ambient = 0.9, ghostPatrol, ghostDelay = 20 }) {
  const m = new MapBuilder(id, W, H, floor);
  m.meta = { name, outdoor: false, rain: false, ambient, bgm: 'hum', fluorescent: true, zoom: 2, ghostDelay, ...(ghostPatrol ? { ghostPatrol } : {}) };
  m.rect('ground', 0, 0, W, 2, T.WALLINT); m.rect('ground', 0, H - 1, W, 1, T.WALLINT);
  m.rect('ground', 0, 2, 1, H - 3, T.WALLINT); m.rect('ground', W - 1, 2, 1, H - 3, T.WALLINT);
  m.rect('ground', 0, 1, W, 1, T.WALLINTBASE);
  m.spawns = {};
  return m;
}

function addDoor(m, d) {
  const y = d.side === 'N' ? 1 : m.h - 1, w = d.w ?? 2;
  m.rect('deco', d.x, y, w, 1, d.locked ? T.DOORLOCK : T.DOOR);
  const base = { x: px(d.x), y: px(y), w: px(w), h: px(1), label: d.label, target: d.target, spawn: d.spawn };
  if (d.chapter) base.chapter = d.chapter;
  if (d.locked) m.addObject({ ...base, type: 'lockeddoor', id: d.id || 'door_' + d.x, tileX: d.x, tileY: y, needsFlags: d.flags || [], text: d.hint || 'It will not budge.' });
  else m.addObject({ ...base, type: 'door' });
}
// where the player appears when arriving next to a door
const arrive = (m, name, d) => { m.spawns[name] = { x: px(d.x) + 16 * (d.w ?? 2), y: d.side === 'N' ? px(2) + 20 : px(m.h - 2) + 6 }; };
const lights = (m, pts) => pts.forEach(([x, y, f]) => m.addObject({ type: 'light', x: px(x), y: px(y), light: 120, flicker: !!f, tube: [px(x), 4] }));
const note = (m, x, y, w, h, text, extra = {}) => m.addObject({ type: 'note', x: px(x), y: px(y), w: px(w), h: px(h), text, ...extra });
// puzzle object: needs/gives are story flags (see src/maps/schoolGraph.js ACTIONS)
const action = (m, id, x, y, w, h, o) => m.addObject({ type: 'action', id, x: px(x), y: px(y), w: px(w), h: px(h), ...o });


/**
 * Visual dressing shared by every room so they match the Library/Hallway quality: rainy windows with cold storm light and
 * curtains, ceiling fans, wall furniture, floor clutter, coloured accent lights (green exit, pulsing red emergency, warm lamps).
 * Everything here is non-blocking decoration except `solid` floor props placed in corners.
 *  cfg = { windows, broken, curtains, fans:[[x,y]], wall:[[sprite,tx,y,ox?]], floor:[[sprite,tx,ty,solid?,extra?]],
 *          exit:[[tx,side]], emergency:[[tx,ty]], warm:[[tx,ty,r,intensity,flicker?,sway?]], green:[[tx,ty]], leaks:[[tx,ty]] }
 */
function dress(m, cfg = {}) {
  for (const wx of cfg.windows || []) {
    m.set('deco', wx, 1, T.WINDOWRAIN);
    m.addObject({ type: 'light', x: px(wx) + 16, y: px(2), light: 56, tint: 0x6a8ad8, intensity: 0.34 });
  }
  for (const wx of cfg.curtains || []) m.addObject({ type: 'decor', sprite: 'curtain_0', anim: 'fx_curtain', x: px(wx) + 16, y: px(1) - 4, w: 0, h: 0, blocks: false, depth: 'wall', oy: 0 });
  for (const [fx, fy] of cfg.fans || []) m.addObject({ type: 'decor', sprite: 'fan_0', anim: 'fx_fan', x: px(fx), y: px(fy), w: 0, h: 0, blocks: false, depth: 'above', oy: 0.5, alpha: 0.9 });
  for (const [sprite, tx, y, ox = 16] of cfg.wall || []) m.addObject({ type: 'decor', sprite, x: px(tx) + ox, y, w: 0, h: 0, blocks: false, depth: 'wall', oy: sprite === 'exit_sign' || sprite === 'emergency_light' ? 0 : 0.5 });
  for (const [sprite, tx, ty, solid = false, extra = {}] of cfg.floor || []) m.addObject({ type: 'decor', sprite, x: px(tx), y: px(ty), w: 32, h: 32, blocks: solid, ...extra });
  for (const [tx, side] of cfg.exit || []) {
    m.addObject({ type: 'decor', sprite: 'exit_sign', x: px(tx) + 32, y: side === 'N' ? px(1) + 2 : px(m.h - 1) + 4, w: 0, h: 0, blocks: false, depth: 'wall', oy: 0 });
    m.addObject({ type: 'light', x: px(tx) + 32, y: side === 'N' ? px(2) + 4 : px(m.h - 1) + 8, light: 46, tint: 0x40ff90, intensity: 0.42 });
  }
  for (const [tx, ty] of cfg.emergency || []) {
    m.addObject({ type: 'decor', sprite: 'emergency_light', x: px(tx) + 16, y: px(ty) + 12, w: 0, h: 0, blocks: false, depth: 'wall', oy: 0 });
    m.addObject({ type: 'light', x: px(tx) + 16, y: px(ty) + 8, light: 70, tint: 0xff3030, intensity: 0.55, pulse: true });
  }
  for (const [tx, ty, r = 80, i = 0.8, flicker = false, sway = 0] of cfg.warm || []) m.addObject({ type: 'light', x: px(tx) + 16, y: px(ty), light: r, tint: 0xffc060, intensity: i, flicker, ...(sway ? { sway } : {}) });
  for (const [tx, ty] of cfg.green || []) m.addObject({ type: 'light', x: px(tx) + 16, y: px(ty), light: 46, tint: 0x40ff90, intensity: 0.4 });
  if (cfg.leaks) m.meta.leaks = cfg.leaks;
  return m;
}

export function buildClassroomB() {
  const m = shell('classroomB', 16, 12, { name: 'Classroom 10B', ghostPatrol: [[3, 9], [13, 9], [8, 4]], ghostDelay: 14 });
  m.scatter('ground', 1, 2, 14, 9, [T.FLOORDARK, T.FLOORCRACK], 21, 0.1);
  m.rect('deco', 5, 1, 6, 1, T.BOARD);
  for (const y of [4, 6, 8]) for (const x of [2, 3, 6, 7, 10, 11]) m.set('deco', x, y, (x + y) % 3 === 0 ? T.DESK2 : T.DESK);
  m.rect('deco', 7, 2, 2, 1, T.DESK);
  const back = { x: 7, side: 'S', target: 'hall', spawn: 'fromClassroomB', label: 'Out to hallway' };
  const link = { x: 12, side: 'N', w: 2, target: 'classroomA', spawn: 'fromClassroomB', label: 'Connecting door to Classroom 10A' };
  // connecting door D8 sits on the west wall in 10A; here it is a plain door cell on the north wall right corner
  addDoor(m, back); addDoor(m, link); arrive(m, 'fromHall', back); arrive(m, 'fromClassroomA', link);
  m.spawns.start = m.spawns.fromHall;
  action(m, 'take_fuse', 7, 2, 2, 1, { chapter: 'ch2', text: 'In the teacher\'s drawer: a ceramic fuse wrapped in a page of an attendance list. A name on it has been scratched out.', done: 'The drawer is empty.', item: 'fuse', sprite: 'item_battery' });
  note(m, 5, 1, 6, 1, 'The blackboard is wiped clean, except one corner: "နောက်ဆုံးခုံ — မနေ့ကလည်း ဒီမှာ ထိုင်ခဲ့တယ်" (the last desk — she sat here yesterday, too).');
  lights(m, [[5, 5, true], [11, 7]]);
  m.meta.tint = [14, 8, 26];
  dress(m, {
    windows: [2, 3, 14], curtains: [2, 3], fans: [[4, 5], [11, 5]],
    wall: [['clock', 11, px(1) + 8], ['poster', 15, px(5)], ['timetable', 0, px(7)], ['calendar', 1, px(1) + 10]],
    floor: [['papers', 3, 10], ['papers', 9, 3], ['books', 13, 9], ['bag', 6, 9, false, { rot: -0.3 }], ['chalk', 8, 3], ['bin', 14, 10, true], ['pot_fern', 1, 10, true]],
    emergency: [[1, 2]], leaks: [[12, 6]],
  });
  return m;
}

export function buildToilets() {
  const m = shell('toilets', 14, 10, { floor: T.FLOORTILE, name: 'Toilets', ambient: 0.8, ghostPatrol: [[3, 6], [10, 6]], ghostDelay: 12 });
  for (const x of [2, 4, 6]) { m.rect('deco', x, 3, 1, 2, T.WALLINT); } // cubicle partitions
  m.rect('deco', 9, 2, 4, 1, T.BOARD);                             // mirror strip above the sinks
  m.scatter('ground', 1, 2, 12, 7, [T.FLOORSTAIN, T.FLOORCRACK], 33, 0.12);
  const back = { x: 6, side: 'S', target: 'hall', spawn: 'fromToilets', label: 'Out to hallway' };
  addDoor(m, back); arrive(m, 'fromHall', back); m.spawns.start = m.spawns.fromHall;
  action(m, 'restore_power', 11, 5, 2, 2, { chapter: 'ch2', needs: ['has_fuse'], needHint: 'A grey electrical panel. A fuse is missing. (Find one.)', text: 'You push the fuse in and throw the switch. Somewhere down the corridor, a lock clicks open and the tubes steady their light.', done: 'The panel hums quietly.' });
  note(m, 9, 2, 4, 1, 'In the mirror you see the cubicle door behind you swing slowly shut.');
  lights(m, [[5, 4, true], [10, 6, true]]);
  m.meta.tint = [6, 20, 18];   // sickly green tile light
  dress(m, {
    windows: [2, 11], fans: [[7, 5]],
    wall: [['clock', 8, px(1) + 8], ['poster', 13, px(6)]],
    floor: [['papers', 5, 8], ['bin', 12, 8, true], ['pot_flower', 1, 8, true], ['bag', 9, 8, false, { rot: 0.3 }]],
    green: [[9, 3]], leaks: [[8, 4], [3, 7]], exit: [[6, 'S']],
  });
  return m;
}

export function buildStairs() {
  const m = shell('stairs', 12, 12, { floor: T.FLOORDARK, name: 'Staircase', ambient: 0.78, ghostPatrol: [[3, 8], [8, 4]], ghostDelay: 10 });
  m.rect('deco', 1, 2, 3, 6, T.STAIRS);                             // stair flight to the upper floor (decor; the real exit is the door)
  const back = { x: 5, side: 'S', target: 'hall', spawn: 'fromStairs', label: 'Out to hallway' };
  const up = { x: 5, side: 'N', target: 'upper', spawn: 'fromStairs', label: 'Up to the first floor', chapter: 'ch2' };
  addDoor(m, back); addDoor(m, up); arrive(m, 'fromHall', back); arrive(m, 'fromUpper', up); m.spawns.start = m.spawns.fromHall;
  note(m, 8, 5, 2, 2, 'Scratched into the railing, over and over, in a small hand: "ခေါင်းလောင်းမထိုးခင် ပြန်လာမယ်" (I will come back before the bell).');
  lights(m, [[5, 6, true]]);
  dress(m, {
    windows: [8, 9], curtains: [8, 9],
    wall: [['clock', 6, px(1) + 6], ['poster', 11, px(6)], ['calendar', 0, px(9)]],
    floor: [['papers', 9, 9], ['bag', 7, 7, false, { rot: 0.3 }], ['books', 4, 10], ['bin', 10, 10, true]],
    emergency: [[2, 9]], leaks: [[9, 7]], exit: [[5, 'N']],
  });
  m.addObject({ type: 'light', x: px(2), y: px(8), light: 70, tint: 0xff3030, intensity: 0.5, pulse: true });
  return m;
}

export function buildUpper() {
  const m = shell('upper', 30, 8, { floor: T.FLOORTILE, name: 'First Floor Corridor', ambient: 0.8, ghostPatrol: [[4, 5], [14, 5], [26, 5]], ghostDelay: 10 });
  m.rect('ground', 2, 3, 26, 3, T.FLOOR);
  for (const wx of [6, 12, 18, 24]) m.set('deco', wx, 1, T.WINDOWRAIN);
  const down = { x: 2, side: 'S', target: 'stairs', spawn: 'fromUpper', label: 'Down to the ground floor' };
  const west = { x: 8, side: 'S', target: 'classroomA', spawn: 'fromUpper', label: 'West stair to Classroom 10A', chapter: 'ch3' };
  const store = { x: 26, side: 'N', target: 'storage', spawn: 'fromUpper', label: 'Storage room', locked: true, flags: ['knows_storage_code'], hint: 'A combination padlock. Four digits. The office register may hold the number.', chapter: 'ch4', id: 'storage_door' };
  addDoor(m, down); addDoor(m, west); addDoor(m, store);
  arrive(m, 'fromStairs', down); arrive(m, 'fromClassroomA', west); arrive(m, 'fromStorage', store); m.spawns.start = m.spawns.fromStairs;
  note(m, 14, 1, 2, 1, 'A notice board of faded flyers. One is a handwritten apology, never delivered.');
  lights(m, [[6, 4, true], [14, 4], [22, 4, true]]);
  dress(m, {
    curtains: [6, 12, 18, 24], fans: [[10, 4], [20, 4]],
    wall: [['clock', 9, px(1) + 8], ['calendar', 16, px(1) + 10], ['poster', 21, px(1) + 4], ['timetable', 0, px(5)], ['mirror', 29, px(1) - 2]],
    floor: [['papers', 8, 5], ['papers', 17, 4], ['bag', 12, 5, false, { rot: -0.3 }], ['books', 23, 4], ['chalk', 15, 5], ['bin', 1, 6, true], ['pot_fern', 28, 6, true]],
    emergency: [[1, 2], [28, 2]], green: [[14, 6]], leaks: [[7, 4], [15, 5], [22, 3]], exit: [[2, 'S']],
  });
  return m;
}

export function buildStorage() {
  const m = shell('storage', 16, 12, { floor: T.FLOORDARK, name: 'Storage Room', ambient: 0.72, ghostPatrol: [[3, 9], [12, 9], [8, 4]], ghostDelay: 8 });
  for (const [x, y] of [[2, 3], [5, 3], [11, 3], [13, 3], [3, 7], [10, 7]]) { m.set('deco', x, y, T.DESK); m.set('deco', x + 1, y, T.DESK2); }
  m.rect('deco', 6, 6, 3, 1, T.SHELF);
  const back = { x: 7, side: 'S', target: 'upper', spawn: 'fromStorage', label: 'Back to the corridor' };
  addDoor(m, back); arrive(m, 'fromUpper', back); m.spawns.start = m.spawns.fromUpper;
  action(m, 'find_bullies', 2, 9, 3, 2, { chapter: 'ch4', cutscene: 'bullies_found', text: 'Three boys lie among stacked desks, bruised and barely conscious. They stir at the light and mumble the same name. Not one will look at you.', done: 'They are breathing. They are not waking up.' });
  action(m, 'find_torn_page', 12, 8, 2, 2, { chapter: 'ch4', text: 'Behind an old cabinet: the missing page of the attendance record, a dated line of absences, and a note: "She stopped coming. Nobody asked why."', done: 'You already took the page.', item: 'torn_page' });
  lights(m, [[4, 5, true], [11, 8, true]]);
  m.meta.tint = [10, 6, 20];
  dress(m, {
    windows: [3, 12], fans: [[8, 3]],
    wall: [['clock', 8, px(1) + 8], ['poster', 15, px(6)]],
    floor: [['papers', 6, 8], ['papers', 9, 4], ['books', 14, 10], ['books', 5, 5], ['bag', 11, 10, false, { rot: 0.3 }], ['bin', 14, 3, true], ['pot_fern', 1, 3, true]],
    warm: [[8, 5, 96, 0.8, false, 14]], leaks: [[5, 9], [13, 6]], exit: [[7, 'S']],
  });
  return m;
}

export function buildOffice() {
  const m = shell('office', 18, 12, { floor: T.FLOORTILE, name: 'School Office', ghostPatrol: [[3, 9], [14, 9], [9, 4]], ghostDelay: 10 });
  m.rect('deco', 8, 3, 3, 1, T.DESK); m.rect('deco', 2, 2, 1, 1, T.SHELF); m.rect('deco', 4, 2, 1, 1, T.SHELF); m.rect('deco', 15, 2, 2, 1, T.SHELF);
  m.rect('deco', 3, 7, 3, 1, T.DESK2); m.rect('deco', 12, 7, 3, 1, T.DESK2);
  const back = { x: 8, side: 'S', target: 'hall', spawn: 'fromOffice', label: 'Out to hallway' };
  const lib = { x: 15, side: 'S', w: 1, target: 'library', spawn: 'fromOffice', label: 'Records passage to Library', chapter: 'ch4' };
  addDoor(m, back); addDoor(m, lib); arrive(m, 'fromHall', back); arrive(m, 'fromLibrary', lib); m.spawns.start = m.spawns.fromHall;
  action(m, 'read_register', 15, 2, 2, 1, { chapter: 'ch4', text: 'The attendance register. Her name: present, present, present... then page after page of absences. A note in the margin gives a four-digit number: the storage lock.', done: 'You memorised the number.' });
  action(m, 'see_photo', 4, 2, 1, 1, { chapter: 'ch4', text: 'A framed class photograph. Behind the last row there is a classroom door that does not exist on the building plan. Someone circled it in pencil. Written below: "ဟောင်းတဲ့ စာသင်ခန်း".', done: 'The photograph shows a door behind the back row.' });
  note(m, 8, 3, 3, 1, 'The principal\'s desk. A complaint form is half-filled, the ink dry. Nobody ever finished it.');
  lights(m, [[5, 5, true], [13, 5]]);
  dress(m, {
    windows: [6, 7, 11, 12], curtains: [6, 7, 11, 12], fans: [[9, 6], [4, 9]],
    wall: [['clock', 13, px(1) + 8], ['calendar', 1, px(1) + 10, 16], ['poster', 17, px(7)], ['timetable', 0, px(6)]],
    floor: [['papers', 9, 4], ['papers', 6, 8], ['books', 14, 8], ['bag', 13, 10, false, { rot: 0.3 }], ['bin', 1, 10, true], ['pot_flower', 16, 3, true]],
    warm: [[9, 3, 84, 0.85]], emergency: [[1, 2]], leaks: [[10, 9]], exit: [[8, 'S']],
  });
  return m;
}

export function buildOldClassroom() {
  const m = shell('oldroom', 14, 11, { name: 'The Old Classroom', ambient: 0.7 });
  m.scatter('ground', 1, 2, 12, 8, [T.FLOORDARK, T.FLOORCRACK, T.FLOORSTAIN], 41, 0.2);
  for (const [x, y] of [[2, 4], [4, 4], [8, 4], [10, 4], [2, 7], [4, 7], [10, 7]]) m.set('deco', x, y, T.DESK3);
  const back = { x: 6, side: 'S', target: 'classroomA', spawn: 'fromOld', label: 'Back to Classroom 10A' };
  const out = { x: 12, side: 'N', w: 1, target: 'service', spawn: 'fromOld', label: 'Service passage', chapter: 'ch5' };
  addDoor(m, back); addDoor(m, out); arrive(m, 'fromClassroomA', back); arrive(m, 'fromService', out); m.spawns.start = m.spawns.fromClassroomA;
  m.addObject({ type: 'light', x: px(6), y: px(5), light: 90, flicker: false, tint: 0xffe6b0, intensity: 0.7, tube: [px(6), 4] });
  action(m, 'reunion', 6, 5, 2, 2, { chapter: 'ch5', text: 'Someone is sitting at the back desk with her bag on her lap. Her uniform is neat. She looks up, and she is exactly the way you remember her.', done: '', cutscene: 'reunion' });
  note(m, 2, 3, 1, 1, 'Her school bag. Inside: a notebook with your handwriting in the margins.', {});
  m.meta.tint = [18, 10, 20];
  dress(m, {
    windows: [3, 4, 9, 10], curtains: [3, 4, 9, 10], fans: [[7, 6]],
    wall: [['clock', 6, px(1) + 8], ['calendar', 12, px(1) + 10], ['poster', 13, px(5)], ['timetable', 0, px(6)]],
    floor: [['papers', 3, 8], ['papers', 9, 6], ['papers', 11, 9], ['books', 1, 9], ['bag', 8, 7, false, { rot: -0.3 }], ['chalk', 5, 3], ['pot_fern', 1, 3, true]],
    warm: [[6, 5, 100, 0.95, true]], leaks: [[3, 6], [10, 8]], exit: [[6, 'S']],
  });
  return m;
}

export function buildService() {
  const m = shell('service', 20, 8, { floor: T.PATH, name: 'Service Passage', ambient: 0.8 });
  m.rect('ground', 2, 3, 16, 3, T.PATH);
  const a = { x: 2, side: 'S', w: 1, target: 'oldroom', spawn: 'fromService', label: 'Back to the old classroom' };
  const b = { x: 17, side: 'N', w: 2, target: 'campus', spawn: 'fromService', label: 'To the courtyard', locked: true, flags: ['reunion'], hint: 'The exit door is jammed. It will open when you are not alone.', id: 'service_exit' };
  addDoor(m, a); addDoor(m, b); arrive(m, 'fromOld', a); arrive(m, 'fromCampus', b); m.spawns.start = m.spawns.fromOld;
  m.addObject({ type: 'light', x: px(10), y: px(4), light: 110, flicker: false, tint: 0xffe6b0, intensity: 0.8, tube: [px(10), 4] });
  m.meta.tint = [16, 6, 10];
  dress(m, {
    windows: [5, 9, 13], fans: [[6, 4], [14, 4]],
    wall: [['clock', 3, px(1) + 8], ['poster', 19, px(4)]],
    floor: [['papers', 8, 5], ['bin', 1, 6, true], ['bag', 12, 4, false, { rot: 0.3 }], ['books', 15, 5]],
    emergency: [[3, 2], [15, 2]], leaks: [[7, 4], [12, 5], [16, 3]], exit: [[17, 'N']],
  });
  return m;
}
