import { T } from '../assets/TextureFactory.js';
import { MapBuilder } from './MapBuilder.js';
import { TILE } from '../config.js';

const px = (t) => t * TILE;

function shell(id, W, H, floor, meta) {
  const m = new MapBuilder(id, W, H, floor);
  m.meta = { name: id, outdoor: false, rain: false, ambient: 0.8, bgm: 'hum', fluorescent: true, zoom: 2, ...meta };
  m.rect('ground', 0, 0, W, 2, T.WALLINT);
  m.rect('ground', 0, H - 2, W, 2, T.WALLINT);
  m.rect('ground', 0, 2, 1, H - 4, T.WALLINT);
  m.rect('ground', W - 1, 2, 1, H - 4, T.WALLINT);
  m.rect('ground', 0, 1, W, 1, T.WALLINTBASE);
  return m;
}

function light(m, x, y, options = {}) {
  m.addObject({ type: 'light', x: px(x) + 16, y: px(y) + 8, light: 110, flicker: false, tint: 0xcfe0ff, intensity: 0.75, ...options });
}

function wallDecor(m, sprite, x, y, extra = {}) {
  m.addObject({ type: 'decor', sprite, x: px(x) + 16, y: px(y) + 8, w: 0, h: 0, blocks: false, depth: 'wall', oy: 0.5, ...extra });
}

function floorDecor(m, sprite, x, y, blocks = false, extra = {}) {
  m.addObject({ type: 'decor', sprite, x: px(x), y: px(y), w: 32, h: 32, blocks, ...extra });
}

/** A broad assembly hall with a stage, side aisles, backstage rooms and two exits. */
export function buildAuditorium() {
  const W = 28, H = 18;
  const m = shell('auditorium', W, H, T.FLOORTILE, {
    name: 'Assembly Hall', ambient: 0.68, horrorProfile: 'assembly', ghostPatrol: [[4, 6], [13, 6], [23, 6], [13, 14], [22, 14]], ghostDelay: 8,
    tint: [20, 8, 24], leaks: [[4, 4], [22, 5], [17, 13]],
  });
  m.rect('ground', 2, 3, 24, 13, T.FLOOR);
  m.rect('ground', 7, 3, 14, 3, T.RUG);
  m.rect('deco', 8, 2, 12, 1, T.BOARD);
  m.rect('deco', 7, 3, 1, 3, T.PILLAR); m.rect('deco', 20, 3, 1, 3, T.PILLAR);
  // Seats create three routes around the hall rather than one straight aisle.
  for (const y of [7, 10, 13]) for (const x of [4, 5, 8, 9, 12, 13, 16, 17, 20, 21, 24]) {
    if ((x === 12 || x === 13) && y === 10) continue;
    m.set('deco', x, y, (x + y) % 3 === 0 ? T.DESK2 : T.DESK);
  }
  // Backstage alcoves and a maintenance door.
  m.rect('deco', 2, 3, 2, 3, T.SHELF); m.rect('deco', 24, 3, 2, 3, T.SHELF);
  m.rect('deco', 2, 1, 2, 1, T.DOOR);
  m.addObject({ type: 'door', x: px(2), y: px(1), w: px(2), h: px(1), target: 'hall', spawn: 'fromAuditorium', label: 'Back to the main hall' });
  m.rect('deco', 24, 1, 2, 1, T.DOORLOCK);
  m.addObject({ type: 'lockeddoor', id: 'auditorium_roof', x: px(24), y: px(1), w: px(2), h: px(1), tileX: 24, tileY: 1, needsFlags: ['records_found'], chapter: 'ch4', target: 'rooftop', spawn: 'fromAuditorium', label: 'Roof access', text: 'A steel roof door. The evacuation plan says the bell is above the assembly hall.' });
  m.rect('deco', 2, H - 2, 2, 1, T.DOORLOCK);
  m.addObject({ type: 'lockeddoor', id: 'maintenance_door', x: px(2), y: px(H - 2), w: px(2), h: px(1), tileX: 2, tileY: H - 2, needsFlags: ['records_found'], chapter: 'ch4', target: 'basement', spawn: 'fromAuditorium', label: 'Maintenance stairs', text: 'The backstage door is swollen shut. A damp attendance page has been wedged under it.' });

  m.addObject({ type: 'action', id: 'stage_memory', chapter: 'ch3', x: px(12), y: px(5), w: px(4), h: px(1), text: 'The stage curtain is cold. Behind it, a child-sized footprint leads to a brick wall. The dust is disturbed from the inside.', done: 'The footprint ends at the wall.', cutscene: 'assembly_whisper', gives: ['auditorium_seen'] });
  m.addObject({ type: 'action', id: 'find_program', chapter: 'ch4', x: px(22), y: px(14), w: px(2), h: px(1), text: 'A damp assembly programme. Every name is crossed out except hers, printed under the heading: LAST BELL DUTY.', done: 'The programme is already in your notebook.', gives: ['programme_found'] });
  m.addObject({ type: 'prop', x: px(5), y: px(4), w: 32, h: 32, sprite: 'bell', blocks: false, text: 'A hand bell from the stage. Its clapper is missing, but something inside keeps tapping.' });
  m.addObject({ type: 'prop', x: px(22), y: px(4), w: 32, h: 32, sprite: 'mirror', blocks: false, text: 'A cracked backstage mirror. The reflection is seated in a chair that is not there.' });

  for (const [x, y] of [[5, 6], [12, 6], [19, 6], [5, 12], [12, 12], [19, 12], [24, 12]]) light(m, x, y, { flicker: (x + y) % 2 === 0, tube: [px(x), px(y)] });
  wallDecor(m, 'curtain_0', 6, 2, { anim: 'fx_curtain', depth: 'wall', oy: 0 });
  wallDecor(m, 'curtain_0', 21, 2, { anim: 'fx_curtain', depth: 'wall', oy: 0 });
  for (const [x, y] of [[7, 8], [18, 8], [7, 12], [18, 12]]) wallDecor(m, 'fan_0', x, y, { anim: 'fx_fan', depth: 'above', oy: 0.5, alpha: 0.82 });
  wallDecor(m, 'clock', 13, 1); wallDecor(m, 'poster', 3, 6); wallDecor(m, 'exit_sign', 13, 16, { oy: 0 });
  floorDecor(m, 'papers', 5, 14); floorDecor(m, 'books', 22, 8); floorDecor(m, 'bag', 14, 14, false, { rot: -0.25 }); floorDecor(m, 'bin', 25, 14, true);
  m.spawns = { fromHall: { x: px(14), y: px(3) + 10 }, fromBasement: { x: px(3) + 16, y: px(H - 3) }, start: { x: px(14), y: px(3) + 10 } };
  return m;
}

/** Underground maintenance level: a damp T-junction with pipes, a generator and a bell ledger. */
export function buildBasement() {
  const W = 24, H = 14;
  const m = shell('basement', W, H, T.FLOORDARK, {
    name: 'Underground Maintenance', ambient: 0.52, horrorProfile: 'basement', ghostPatrol: [[4, 4], [11, 4], [19, 4], [11, 11]], ghostDelay: 6,
    tint: [8, 12, 26], leaks: [[5, 5], [16, 8], [19, 10]],
  });
  m.rect('ground', 2, 3, 20, 9, T.FLOOR);
  // Narrow side passages and a central junction.
  m.rect('deco', 5, 3, 1, 4, T.WALLINT); m.rect('deco', 18, 3, 1, 4, T.WALLINT);
  m.rect('deco', 5, 8, 1, 4, T.WALLINT); m.rect('deco', 18, 8, 1, 4, T.WALLINT);
  m.rect('deco', 8, 6, 8, 1, T.SHELF);
  for (const [x, y] of [[3, 4], [20, 4], [3, 10], [20, 10]]) m.set('deco', x, y, T.BED);
  m.rect('deco', 10, 3, 4, 1, T.DESK3);
  m.rect('deco', 10, 10, 4, 1, T.DESK2);

  m.rect('deco', 3, 1, 2, 1, T.DOOR);
  m.addObject({ type: 'door', x: px(3), y: px(1), w: px(2), h: px(1), target: 'auditorium', spawn: 'fromBasement', label: 'Back to the assembly hall' });
  m.rect('deco', 20, H - 2, 2, 1, T.DOORLOCK);
  m.addObject({ type: 'lockeddoor', id: 'basement_roof', x: px(20), y: px(H - 2), w: px(2), h: px(1), tileX: 20, tileY: H - 2, needsFlags: ['bell_room_seen'], chapter: 'ch5', target: 'rooftop', spawn: 'fromBasement', label: 'Service ladder', text: 'The ladder ends at a chained roof hatch. Something has scratched a circle around the bell symbol.' });
  m.addObject({ type: 'action', id: 'ring_bell', chapter: 'ch4', x: px(10), y: px(2) + 8, w: px(4), h: px(1), text: 'The maintenance ledger describes a bell wired beneath the stage. Beside the switch: "If it rings, do not answer."', done: 'The switch is down. The wire is warm.', cutscene: 'bell_chamber', gives: ['bell_room_seen'] });
  m.addObject({ type: 'action', id: 'search_generator', chapter: 'ch4', x: px(10), y: px(9), w: px(4), h: px(1), text: 'The generator has no fuel, yet the indicator is glowing. A list of names is taped beneath the gauge.', done: 'The names are copied into your notebook.', gives: ['generator_seen'] });
  m.addObject({ type: 'note', x: px(7), y: px(8), w: px(3), h: px(1), text: 'Pipe labels in Burmese and English: STAGE / ROOF / BELL. The last label has been scratched away.' });
  for (const [x, y] of [[5, 4], [11, 4], [18, 4], [11, 9], [18, 9]]) light(m, x, y, { flicker: true, tint: 0xff3048, intensity: 0.42, tube: [px(x), px(y)] });
  wallDecor(m, 'emergency_light', 3, 2, { oy: 0 }); wallDecor(m, 'emergency_light', 19, 2, { oy: 0 }); wallDecor(m, 'clock', 11, 1); wallDecor(m, 'poster', 20, 5);
  for (const [x, y] of [[6, 4], [16, 4], [7, 10], [16, 10]]) wallDecor(m, 'fan_0', x, y, { anim: 'fx_fan', depth: 'above', oy: 0.5, alpha: 0.55 });
  floorDecor(m, 'papers', 7, 5); floorDecor(m, 'books', 16, 8); floorDecor(m, 'bag', 4, 9, false, { rot: 0.35 }); floorDecor(m, 'bin', 21, 10, true);
  m.spawns = { fromAuditorium: { x: px(4), y: px(3) + 8 }, start: { x: px(4), y: px(3) + 8 } };
  return m;
}

/** Rain-slick rooftop: a final optional route around a water tank and the old school bell. */
export function buildRooftop() {
  const W = 24, H = 12;
  const m = new MapBuilder('rooftop', W, H, T.PATH);
  m.meta = { name: 'Rooftop', outdoor: true, rain: true, horrorProfile: 'rooftop', ambient: 0.58, bgm: 'rain', zoom: 2, ghostPatrol: [[3, 5], [9, 4], [19, 5], [11, 9]], ghostDelay: 9, leaks: [] };
  m.rect('ground', 1, 1, 22, 1, T.ROOF);
  m.rect('ground', 1, H - 2, 22, 1, T.ROOFEDGE);
  m.rect('ground', 0, 0, W, 1, T.WALL);
  m.rect('ground', 0, H - 1, W, 1, T.WALL);
  m.rect('ground', 0, 1, 1, H - 2, T.WALL);
  m.rect('ground', W - 1, 1, 1, H - 2, T.WALL);
  m.rect('ground', 3, 3, 18, 6, T.COURT);
  m.rect('deco', 5, 3, 3, 2, T.BED); m.rect('deco', 16, 6, 3, 2, T.BED);
  m.rect('deco', 10, 4, 4, 2, T.TRUNK);
  m.addObject({ type: 'prop', x: px(10), y: px(3), w: px(4), h: px(2), sprite: 'nat_shrine', blocks: true, text: 'A water tank has been painted with the school crest. Water drips upward into the storm.' });
  m.addObject({ type: 'prop', x: px(17), y: px(3), w: 32, h: 32, sprite: 'bell', blocks: true, text: 'The old bell is bolted to the roof frame. Its rope hangs over the edge into the dark courtyard.' });
  m.addObject({ type: 'action', id: 'listen_rooftop', chapter: 'ch5', x: px(10), y: px(7), w: px(4), h: px(1), text: 'The rain stops for one breath. From below, a classroom answers with a single desk scraping across the floor.', done: 'Only rain answers now.', gives: ['rooftop_seen'] });
  m.addObject({ type: 'note', x: px(4), y: px(7), w: px(3), h: px(1), text: 'Evacuation plan: assembly hall -> roof -> main gate. Someone has circled the roof in red ink.' });
  for (const [x, y] of [[4, 2], [9, 2], [15, 2], [20, 2], [4, 9], [20, 9]]) m.addObject({ type: 'lamp', x: px(x), y: px(y), w: 32, h: 32, sprite: 'lamp', blocks: true, light: 100, flicker: true, text: 'A roof lamp shivering in the rain.' });
  for (const [x, y] of [[6, 6], [14, 6], [18, 8]]) m.addObject({ type: 'decor', sprite: 'flag_0', x: px(x), y: px(y), w: 0, h: 0, blocks: false, depth: 'above', oy: 0.5, anim: 'fx_flag' });
  m.rect('deco', 2, H - 2, 2, 1, T.DOOR);
  m.addObject({ type: 'door', x: px(2), y: px(H - 2), w: px(2), h: px(1), target: 'auditorium', spawn: 'fromBasement', label: 'Down to the assembly hall' });
  m.rect('deco', 20, H - 2, 2, 1, T.DOOR);
  m.addObject({ type: 'door', x: px(20), y: px(H - 2), w: px(2), h: px(1), target: 'basement', spawn: 'fromAuditorium', label: 'Down to maintenance' });
  m.spawns = { fromAuditorium: { x: px(25 - 5), y: px(3) + 10 }, fromBasement: { x: px(21), y: px(9) }, start: { x: px(21), y: px(9) } };
  return m;
}
