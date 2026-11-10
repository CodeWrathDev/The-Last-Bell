import { T } from '../assets/TextureFactory.js';
import { MapBuilder } from './MapBuilder.js';
import { TILE } from '../config.js';

const px = (t) => t * TILE;

/**
 * Main school junction. The old version was a straight hallway with every
 * room on one wall. This version is a 52x19 four-wing junction: a long
 * central route stays readable, while north/south arcades, a central atrium
 * and several loops let the player approach rooms from different directions.
 */
export function buildHall() {
  const W = 52, H = 19;
  const m = new MapBuilder('hall', W, H, T.WALLINT);
  m.meta = {
    name: 'Main Building – Four-Wing Junction', outdoor: false, rain: false,
    ambient: 0.86, bgm: 'hum', fluorescent: true, ghostDelay: 12,
    ghostPatrol: [[3, 5], [13, 5], [25, 5], [38, 5], [48, 5], [8, 3], [24, 3], [37, 9], [47, 11]],
    zoom: 2, apparition: { ends: [[3, 5], [48, 5]], delay: 34 },
  };

  // Outer shell.
  m.rect('ground', 0, 0, W, 1, T.WALLINT);
  m.rect('ground', 0, H - 1, W, 1, T.WALLINT);
  m.rect('ground', 0, 1, 1, H - 2, T.WALLINT);
  m.rect('ground', W - 1, 1, 1, H - 2, T.WALLINT);

  // Main route, four north branches, four south branches and a broad atrium.
  m.rect('ground', 2, 5, W - 4, 2, T.FLOOR);
  for (const [x, w] of [[5, 10], [18, 12], [32, 11], [44, 6]]) m.rect('ground', x, 2, w, 4, T.FLOOR);
  for (const x of [8, 24, 37, 46]) m.rect('ground', x, 3, 2, 5, T.FLOOR);
  for (const [x, w] of [[3, 11], [16, 14], [31, 10], [44, 6]]) m.rect('ground', x, 6, w, 11, T.FLOOR);
  for (const x of [8, 22, 28, 37, 46]) m.rect('ground', x, 6, 2, 6, T.FLOOR);
  m.rect('ground', 21, 4, 9, 10, T.FLOOR); // central atrium / cross-over
  // Each wing has a slightly different school-era floor finish instead of
  // repeating one texture across the whole hall.
  m.rect('ground', 5, 2, 10, 1, T.FLOORTILE);
  m.rect('ground', 18, 2, 12, 1, T.FLOORDARK);
  m.rect('ground', 32, 2, 11, 1, T.LIBFLOOR);
  m.rect('ground', 22, 7, 7, 6, T.RUG);
  m.rect('ground', 31, 9, 10, 1, T.FLOORTILE);
  // Keep the upper edge of the main route walkable: the player and crawler
  // bodies are centred on row 5 and need one tile of clearance above them.
  m.rect('ground', 2, 4, 48, 1, T.FLOOR);
  for (const [x, w] of [[5, 10], [18, 12], [32, 11], [44, 6]]) m.rect('ground', x, 4, w, 1, T.FLOOR);
  for (const [x, w] of [[3, 11], [16, 14], [31, 10], [44, 6]]) m.rect('ground', x, 7, w, 1, T.FLOOR);

  // Damp tiles and old school markings make each route readable in the dark.
  for (const [x, y] of [[4, 5], [15, 6], [19, 5], [30, 6], [35, 5], [42, 6], [10, 10], [27, 11], [38, 14], [47, 14]]) m.set('ground', x, y, T.FLOORCRACK);
  for (const [x, y] of [[6, 3], [13, 4], [20, 3], [29, 4], [34, 3], [41, 4], [4, 14], [14, 9], [33, 10], [48, 8]]) m.set('ground', x, y, T.FLOORSTAIN);

  // Pillars divide sight lines without blocking the routes. (v43: the wall lockers were removed.)
  for (const [x, y] of [[16, 4], [20, 8], [30, 8], [43, 8], [14, 12], [31, 12], [42, 12]]) m.set('deco', x, y, T.PILLAR);

  // Doors are distributed around the wings instead of lined up on one wall.
  const door = (d) => {
    const y = d.side === 'N' ? 1 : 17;
    const w = d.w ?? 2;
    m.rect('deco', d.x, y, w, 1, d.locked ? T.DOORLOCK : T.DOOR);
    const base = { x: px(d.x), y: px(y), w: px(w), h: px(1), label: d.label, ...(d.plate ? { plate: d.plate } : {}), target: d.target, spawn: d.spawn || 'fromHall', ...(d.chapter ? { chapter: d.chapter } : {}) };
    if (d.locked) m.addObject({ ...base, type: 'lockeddoor', id: d.id, tileX: d.x, tileY: y, needsFlags: d.flags || [], text: d.hint || 'It will not budge.' });
    else m.addObject({ ...base, type: 'door' });
  };

  door({ x: 7, side: 'N', target: 'classroomA', label: 'Classroom 10A' });
  door({ x: 19, side: 'N', target: 'classroomB', label: 'Classroom 10B', locked: true, id: 'door_9', flags: ['has_key_10b'], hint: 'Classroom 10B is locked. The key was left in 10A.' });
  door({ x: 33, side: 'N', target: 'library', label: 'Library', locked: true, id: 'door_20', flags: ['power_on'], hint: 'The Library lock has no power. Restore the electrical panel first.' });
  door({ x: 45, side: 'N', target: 'stairs', label: 'Stairwell', chapter: 'ch2' });

  door({ x: 4, side: 'S', target: 'toilets', label: 'Toilets', chapter: 'ch2' });
  door({ x: 21, side: 'S', target: 'auditorium', label: 'Assembly hall', chapter: 'ch3', locked: true, id: 'door_assembly', flags: ['power_on'], hint: 'A faded red sign says ASSEMBLY HALL. The electric lock is dead.' });
  door({ x: 31, side: 'S', target: 'office', label: 'School Office', locked: true, id: 'door_26', flags: ['has_office_key'], hint: 'A brass lock holds the School Office. The key is somewhere in the Library.' });
  door({ x: 46, side: 'S', target: 'campus', label: 'Back to courtyard' });

  // Existing spawn names stay compatible, but now place the player at different wings.
  m.spawns = {
    fromCampus: { x: px(25) + 16, y: px(4) + 24 },
    fromClassroomA: { x: px(8) + 16, y: px(4) + 24 },
    fromClassroomB: { x: px(20) + 16, y: px(4) + 24 },
    fromLibrary: { x: px(34) + 16, y: px(4) + 24 },
    fromOffice: { x: px(32), y: px(15) + 24 },
    fromToilets: { x: px(5) + 16, y: px(15) + 24 },
    fromStairs: { x: px(46) + 16, y: px(4) + 24 },
    fromAuditorium: { x: px(22) + 16, y: px(15) + 24 },
    start: { x: px(25) + 16, y: px(5) + 24 },
  };

  // Door plates already carry the room names. Do not add a second class/wing
  // sign layer here: it duplicated labels and the low signs were hidden by
  // the first-person camera. Use different wall props for visual variety.
  const wall = (sprite, x, y) => m.addObject({ type: 'decor', sprite, x: px(x) + 16, y: px(y) + 4, w: 0, h: 0, blocks: false, depth: 'wall', oy: 0 });
  wall('timetable', 3, 2);
  wall('poster', 15, 2);
  wall('calendar', 29, 2);
  wall('mirror', 41, 2);
  wall('emergency_light', 2, 7);
  wall('poster', 43, 7);
  m.addObject({ type: 'note', sprite: 'item_note', x: px(23), y: px(8), w: px(3), h: px(1), text: 'A hand-drawn evacuation map. The arrows do not agree with the walls. Someone has circled three routes in red.' });
  m.addObject({ type: 'note', sprite: 'item_note', x: px(39), y: px(10), w: px(2), h: px(1), text: 'A lost timetable: WEST WING, EAST WING, BASEMENT, ROOF. The last period has no room number.' });
  // This is a readable floor note, not an interactive clock prop. The old
  // clock sprite made the E prompt look like a clock instead of a document.
  m.addObject({ type: 'note', x: px(25), y: px(9), w: px(2), h: px(1), sprite: 'item_note', text: 'A maintenance note: "The atrium clock ticks backwards whenever the lights flicker."' });
  // (v43: the benches were removed; see the lived-in dressing below.)
  for (const [x, y] of [[6, 5], [12, 5], [24, 5], [35, 5], [46, 5], [8, 10], [24, 10], [37, 10], [47, 10]]) m.addObject({ type: 'light', x: px(x) + 16, y: px(y), light: 118, flicker: (x + y) % 3 === 0, tube: [px(x), y] });
  for (const [x, y] of [[2, 5], [49, 5], [21, 9], [30, 9]]) m.addObject({ type: 'light', x: px(x) + 16, y: px(y), light: 62, tint: 0xff3030, intensity: 0.52, pulse: true });

  // ---- v43: lived-in dressing (windows, plants, bins, clutter, wall art, fans, lamps, leaks). Nothing here blocks a doorway or a route.
  const win = (x, y, curtain) => {
    m.set('deco', x, y, T.WINDOWRAIN);
    m.addObject({ type: 'light', x: px(x) + 16, y: y === 1 ? px(2) : px(16) + 16, light: 56, tint: 0x6a8ad8, intensity: 0.34 });
    if (curtain) m.addObject({ type: 'decor', sprite: 'curtain_0', anim: 'fx_curtain', x: px(x) + 16, y: px(1) - 4, w: 0, h: 0, blocks: false, depth: 'wall', oy: 0 });
  };
  for (const x of [10, 12, 24, 26, 37, 39, 48]) win(x, 1, true);           // rainy windows on the north wall (with curtains)
  for (const x of [8, 10, 12, 18, 19, 25, 27, 35, 37, 39, 44, 48]) win(x, 17, false);   // and on the south wall
  // WALL ART (v43): lots of it. Wall decals snap to the nearest wall face, so these are placed on the wall line itself.
  const art = (sprite, x, y) => m.addObject({ type: 'decor', sprite, x, y, w: 0, h: 0, blocks: false, depth: 'wall', oy: 0 });
  const N = [['poster', 5], ['mirror', 9], ['timetable', 13], ['calendar', 18], ['poster', 21], ['clock', 22], ['poster', 27], ['timetable', 28],
    ['mirror', 32], ['calendar', 35], ['poster', 36], ['timetable', 40], ['clock', 42], ['poster', 44], ['timetable', 47], ['calendar', 49]];
  const S = [['poster', 6], ['timetable', 7], ['mirror', 9], ['clock', 11], ['poster', 13], ['poster', 16], ['timetable', 17], ['calendar', 20],
    ['poster', 23], ['mirror', 24], ['clock', 26], ['timetable', 28], ['poster', 29], ['poster', 33], ['calendar', 34], ['mirror', 36],
    ['timetable', 38], ['poster', 40], ['poster', 45], ['calendar', 49]];
  for (const [sp, x] of N) art(sp, px(x) + 16, px(2));
  for (const [sp, x] of S) art(sp, px(x) + 16, px(17));
  for (const [sp, y] of [['poster', 5.5], ['clock', 6.3], ['mirror', 12], ['poster', 14.5]]) art(sp, px(3), px(y));          // west wall (x = 2 is the first floor column)
  for (const [sp, y] of [['poster', 5.5], ['timetable', 6.3], ['calendar', 12], ['poster', 14.5]]) art(sp, px(50), px(y));    // east wall
  m.addObject({ type: 'decor', sprite: 'exit_sign', x: px(45) + 32, y: px(1) + 2, w: 0, h: 0, blocks: false, depth: 'wall', oy: 0 });
  m.addObject({ type: 'decor', sprite: 'exit_sign', x: px(46) + 32, y: px(17) + 4, w: 0, h: 0, blocks: false, depth: 'wall', oy: 0 });
  m.addObject({ type: 'light', x: px(46) + 32, y: px(16) + 8, light: 46, tint: 0x40ff90, intensity: 0.42 });
  m.addObject({ type: 'light', x: px(45) + 32, y: px(2) + 4, light: 46, tint: 0x40ff90, intensity: 0.42 });
  // The only things on the floor are readable papers.
  m.addObject({ type: 'note', sprite: 'item_note', x: px(12), y: px(6), w: 32, h: 32, text: 'A pinned notice, the ink smeared: \"After the last bell, never answer if someone calls your name from a classroom.\"' });
  m.addObject({ type: 'note', sprite: 'item_note', x: px(36), y: px(14), w: 32, h: 32, text: 'A torn attendance slip. Every name is crossed out in red except yours.' });
  m.addObject({ type: 'note', sprite: 'item_note', x: px(6), y: px(11), w: 32, h: 32, text: 'A hall-monitor memo: \"Do not run. Do not shout. It cannot see you. It only hears you.\"' });
  for (const [fx, fy] of [[25, 8], [10, 5], [40, 5], [25, 14]]) m.addObject({ type: 'decor', sprite: 'fan_0', anim: 'fx_fan', x: px(fx), y: px(fy), w: 0, h: 0, blocks: false, depth: 'above', oy: 0.5, alpha: 0.9 });
  for (const [x, y, fl] of [[11, 3, false], [27, 3, true], [38, 15, false], [8, 15, true]]) m.addObject({ type: 'light', x: px(x) + 16, y: px(y), light: 72, tint: 0xffc060, intensity: 0.6, flicker: fl });
  m.meta.leaks = [[10, 9], [26, 12], [38, 6], [6, 15], [24, 3]];

  return m;
}
