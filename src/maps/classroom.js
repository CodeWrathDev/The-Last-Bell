import { T } from '../assets/TextureFactory.js';
import { MapBuilder } from './MapBuilder.js';
import { TILE } from '../config.js';

const px = (t) => t * TILE;

/** Classroom A: desks, chalkboard, your notebook, the teacher's desk (library key). */
export function buildClassroomA() {
  const W = 16, H = 12;
  const m = new MapBuilder('classroomA', W, H, T.FLOOR);
  m.meta = { name: 'Classroom A', outdoor: false, rain: false, ambient: 0.9, bgm: 'hum', fluorescent: true, zoom: 2, ghostPatrol: [[3, 9], [13, 9], [8, 3]], ghostDelay: 14 };

  m.rect('ground', 0, 0, W, 2, T.WALLINT);
  m.rect('ground', 0, 11, W, 1, T.WALLINT);
  m.rect('ground', 0, 2, 1, 9, T.WALLINT); m.rect('ground', W - 1, 2, 1, 9, T.WALLINT);
  m.rect('deco', 5, 1, 6, 1, T.BOARD);
  m.scatter('ground', 1, 2, 14, 9, [T.FLOORDARK], 5, 0.12);
  m.scatter('ground', 1, 2, 14, 9, [T.FLOORCRACK, T.FLOORSTAIN], 9, 0.07);
  m.rect('ground', 0, 1, W, 1, T.WALLINTBASE);
  for (const wx of [2, 3, 12, 13]) m.set('deco', wx, 1, T.WINDOWRAIN);
  m.rect('deco', 7, 11, 2, 1, T.DOOR);

  // Student desks (solid)
  for (const y of [4, 6, 8]) for (const x of [2, 3, 6, 7, 10, 11]) { const k = (x * 7 + y * 3) % 5; m.set('deco', x, y, k === 0 ? T.DESK2 : k === 2 ? T.DESK3 : T.DESK); }
  // Teacher's desk
  m.rect('deco', 7, 2, 2, 1, T.DESK);

  m.addObject({ type: 'door', x: px(7), y: px(11), w: px(2), h: px(1), target: 'hall', spawn: 'fromClassroomA', label: 'Out to hallway' });
  m.addObject({ type: 'note', x: px(5), y: px(1), w: px(6), h: px(1), text: 'The chalkboard reads: "ပညာရှိသူသည် ညမှာ မအိပ်" — and below it, in fresh chalk: "WHO ARE YOU LOOKING FOR?"' });
  m.addObject({ type: 'action', id: 'read_notice', chapter: 'ch2', x: px(1), y: px(3), w: 32, h: 32, text: 'A notice pinned to the wall: "Cabinet inspection — combination is the date of the last attendance: 0-3-1-7." Someone has underlined the date three times.', done: 'The date is burned into your memory: 0317.' });
  m.addObject({ type: 'action', id: 'take_key_10b', chapter: 'ch2', x: px(7), y: px(2) + 4, w: px(2), h: 24, text: "In the teacher's drawer: a small key with a paper tag, \"10B\".", done: 'The drawer is empty now.', item: 'key_10b' });
  m.addObject({ type: 'light', x: px(5), y: px(5), light: 120, flicker: true, tube: [px(5), 4] });
  m.addObject({ type: 'light', x: px(11), y: px(7), light: 120, flicker: false, tube: [px(11), 4] });
  m.addObject({ type: 'prop', x: px(1), y: px(3), w: 32, h: 32, text: 'A wall calendar stuck on a date years ago.' });
  m.addObject({ type: 'chalk', x: px(8), y: px(1) + 14, lines: ['ပညာရှိသူသည် ညမှာ မအိပ်', 'WHO ARE YOU LOOKING FOR?'] });
  for (const wx of [2, 13]) m.addObject({ type: 'decor', sprite: 'curtain_0', anim: 'fx_curtain', x: px(wx) + 16, y: px(1) - 4, w: 0, h: 0, blocks: false, depth: 'wall', oy: 0 });
  for (const [fx, fy] of [[5, 5], [11, 5], [8, 8]]) m.addObject({ type: 'decor', sprite: 'fan_0', anim: 'fx_fan', x: px(fx), y: px(fy), w: 0, h: 0, blocks: false, depth: 'above', oy: 0.5, alpha: 0.9 });
  const wall = (sprite, x, y) => m.addObject({ type: 'decor', sprite, x, y, w: 0, h: 0, blocks: false, depth: 'wall', oy: 0.5 });
  wall('clock', px(8), px(0) + 14); wall('calendar', 16, px(3) + 10); wall('poster', px(15) + 16, px(5) + 6);
  const floor = (sprite, tx, ty, blocks = false, extra = {}) => m.addObject({ type: 'decor', sprite, x: px(tx), y: px(ty), w: 32, h: 32, blocks, ...extra });
  floor('bag', 4, 9, false, { rot: 0.3 }); floor('books', 9, 9); floor('papers', 5, 3); floor('papers', 12, 9); floor('chalk', 10, 3); floor('bin', 14, 10, true);
  // Extra doors: connecting door to 10B (needs its key), west stair to the first floor, and the hidden passage to the old classroom.
  const d = (x, y, w, o, locked) => { m.rect('deco', x, y, w, 1, locked ? T.DOORLOCK : T.DOOR); m.addObject(locked ? { type: 'lockeddoor', tileX: x, tileY: y, ...o, x: px(x), y: px(y), w: px(w), h: px(1), needsFlags: o.flags } : { type: 'door', ...o, x: px(x), y: px(y), w: px(w), h: px(1) }); };
  d(12, 11, 2, { id: 'door_10b', target: 'classroomB', spawn: 'fromClassroomA', label: 'Connecting door to 10B', flags: ['has_key_10b'], text: 'The connecting door to 10B is locked.' }, true);
  d(1, 1, 1, { target: 'upper', spawn: 'fromClassroomA', label: 'West stair', chapter: 'ch3' });
  d(3, 1, 1, { id: 'hidden_passage', target: 'oldroom', spawn: 'fromClassroomA', label: 'The old classroom', flags: ['photo_seen', 'records_found'], text: 'Behind the blackboard wall, a seam in the plaster. The wall does not move yet.', chapter: 'ch4' }, true);
  m.spawns = { fromHall: { x: px(8), y: px(10) + 6 }, fromClassroomB: { x: px(13), y: px(10) + 6 }, fromUpper: { x: px(1) + 16, y: px(2) + 20 }, fromOld: { x: px(3) + 16, y: px(2) + 20 }, start: { x: px(8), y: px(10) } };
  return m;
}
