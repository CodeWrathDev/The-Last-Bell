// Camera zoom outdoors. 1 shows the whole courtyard; 2 matches the indoor pixel size (480x270 view) for a tighter, scarier look.
export const OUTDOOR_ZOOM = 1;
export const TILE = 32;
export const VIEW_W = 960;
export const VIEW_H = 540;
export const SAVE_KEY = 'kyaungnya-haunted-school-save-v1';

// Render depth ordering
export const DEPTH = {
  GROUND: 0,
  DECOR: 1,
  SIGN: 3,
  PICKUP: 6,
  ENTITIES: 10,
  ABOVE: 20, // tree canopy etc. drawn over the player
  GLOW: 21,
  FOG: 90,
  DARK: 100,
  WEATHER: 110,
};

export const PLAYER = {
  WALK: 95,
  RUN: 165,
  RUN_DRAIN: 26, // stamina / second
  REGEN_IDLE: 22,
  REGEN_MOVE: 12,
};

export const REACH = 26; // px: how close the player must be to interact
export const FLASH_DRAIN = 0.5; // battery % / second

// The crawling creature = the legless ghost girl (tools/art/gen_crawler.py, configure(0.68)): 160x100 frames, 8 view directions, ground contact at row 57.
// v14: it is TWICE the player (the player sprite is ~19x38 px; the creature is ~70x50 px head-on and ~120 px long from the side), and its face is hidden by hair.
// CRAWLER.SCALE is the one size knob (sprite pixels -> world pixels).
export const CRAWLER = { ORIGIN_Y: 126 / 222, SCALE: 0.85, SHADOW: 1.0, DIRS: 8 };
