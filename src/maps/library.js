import { T } from '../assets/TextureFactory.js';
import { MapBuilder } from './MapBuilder.js';
import { TILE } from '../config.js';

const px = (t) => t * TILE;

/** Library: tall shelves, reading tables to hide under, lore notes, a spare battery and a patrolling ghost. */
export function buildLibrary() {
  const W = 20, H = 14;
  const m = new MapBuilder('library', W, H, T.LIBFLOOR);
  m.meta = { name: 'Library', outdoor: false, rain: false, ambient: 0.92, bgm: 'hum', fluorescent: true, zoom: 2, ghostDelay: 18, ghostPatrol: [[3, 3], [16, 3], [10, 7]] };

  m.rect('ground', 0, 0, W, 2, T.WALLINT); m.rect('ground', 0, 13, W, 1, T.WALLINT);
  m.rect('ground', 0, 2, 1, 11, T.WALLINT); m.rect('ground', W - 1, 2, 1, 11, T.WALLINT);
  m.rect('ground', 0, 1, W, 1, T.WALLINTBASE);
  for (const wx of [3, 6, 9, 10, 13, 16]) m.set('deco', wx, 1, T.WINDOWRAIN);
  m.rect('deco', 9, 13, 2, 1, T.DOOR);
  m.rect('ground', 9, 3, 2, 2, T.RUG);
  m.scatter('ground', 1, 2, 18, 11, [T.FLOORSTAIN], 31, 0.04);

  // Shelving: three rows per side with a wide centre aisle so there is room to run and hide.
  for (const y of [2, 5, 8, 11]) { m.rect('deco', 2, y, 5, 1, T.LIBSHELF); m.rect('deco', 13, y, 5, 1, T.LIBSHELF); }
  // Reading tables (you can crawl under them)
  for (const [x, y] of [[8, 5], [11, 5], [8, 9], [11, 9]]) m.rect('deco', x, y, 2, 1, T.READTABLE);

  m.addObject({ type: 'door', x: px(9), y: px(13), w: px(2), h: px(1), target: 'hall', spawn: 'fromLibrary', label: 'Out to hallway' });
  m.addObject({ type: 'note', tag: 'lib', x: px(8), y: px(5), w: px(2), h: px(1), text: 'A borrowed-books ledger. Every name is a student who never came back. The last line is blank, and a wet pen lies beside it.' });
  m.addObject({ type: 'note', tag: 'lib', x: px(11), y: px(9), w: px(2), h: px(1), text: 'A torn page from a school atlas. Someone circled the gate in red and wrote: "SHE WAITS WHERE THE LIGHT IS NOT."' });
  m.addObject({ type: 'note', tag: 'lib', x: px(17), y: px(6), w: 32, h: 32, text: 'Tucked behind the literature shelf, a diary page: "She is not angry. She is only lost. She follows the sound of footsteps."' });
  m.addObject({ type: 'pickup', id: 'battery', x: px(15), y: px(10) + 4, w: 28, h: 24, sprite: 'item_battery', text: 'A spare flashlight battery, wedged between two dictionaries.' });
  m.addObject({ type: 'action', id: 'open_cabinet', chapter: 'ch3', needs: ['knows_cabinet_code'], needHint: 'A locked steel cabinet with a four-digit dial. The notice in Classroom 10A mentioned a date.', x: px(9), y: px(3), w: px(2), h: px(1), text: 'The dial clicks: 0-3-1-7. Inside, a brass key tagged "OFFICE" and a ledger with a bookmark at the last page.', done: 'The cabinet is empty.', item: 'office_key' });
  m.rect('deco', 3, 13, 1, 1, T.DOOR);
  m.addObject({ type: 'door', x: px(3), y: px(13), w: px(1), h: px(1), target: 'office', spawn: 'fromLibrary', label: 'Records passage to the Office', chapter: 'ch4' });
  m.addObject({ type: 'prop', x: px(1), y: px(3), w: 32, h: 32, text: 'Rows of Burmese primers, swollen with damp. Some pages have been turned to face the wall.' });

  // Light: warm reading lamps, flickering tubes, cold storm light through the windows
  for (const [lx, ly] of [[9, 4], [12, 8]]) m.addObject({ type: 'light', x: px(lx) + 16, y: px(ly), light: 78, tint: 0xffc060, intensity: 0.8 });
  for (const lx of [5, 15]) m.addObject({ type: 'light', x: px(lx), y: px(7), light: 120, flicker: true, tube: [px(lx), 4] });
  for (const wx of [3, 6, 9, 13, 16]) m.addObject({ type: 'light', x: px(wx) + 16, y: px(2), light: 50, tint: 0x6a8ad8, intensity: 0.3 });

  // Dressing
  for (const wx of [9, 10]) m.addObject({ type: 'decor', sprite: 'curtain_0', anim: 'fx_curtain', x: px(wx) + 16, y: px(1) - 4, w: 0, h: 0, blocks: false, depth: 'wall', oy: 0 });
  for (const [fx, fy] of [[5, 7], [15, 7], [10, 11]]) m.addObject({ type: 'decor', sprite: 'fan_0', anim: 'fx_fan', x: px(fx), y: px(fy), w: 0, h: 0, blocks: false, depth: 'above', oy: 0.5, alpha: 0.9 });
  const wall = (sprite, x, y) => m.addObject({ type: 'decor', sprite, x, y, w: 0, h: 0, blocks: false, depth: 'wall', oy: 0.5 });
  wall('clock', px(8), px(1) + 6); wall('calendar', px(14) + 16, px(1) + 12); wall('poster', px(19) + 16, px(6)); wall('timetable', 16, px(8));
  const floor = (sprite, tx, ty, blocks = false, extra = {}) => m.addObject({ type: 'decor', sprite, x: px(tx), y: px(ty), w: 32, h: 32, blocks, ...extra });
  floor('papers', 7, 3); floor('papers', 14, 12); floor('papers', 4, 9); floor('books', 7, 7); floor('books', 12, 12); floor('bag', 16, 9, false, { rot: -0.3 });
  floor('pot_fern', 1, 12, true); floor('bin', 18, 12, true); floor('chalk', 8, 3);

  m.spawns = { fromHall: { x: px(10), y: px(12) + 6 }, fromOffice: { x: px(3) + 16, y: px(12) + 14 }, start: { x: px(10), y: px(12) + 6 } };
  return m;
}
