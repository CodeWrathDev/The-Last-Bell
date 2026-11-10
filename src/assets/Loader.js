import { ANIM_DATA } from './animData.js';

// All art is real PNG: see public/assets/README.md. Rebuild with `npm run art`.
const A = 'assets/';
const ATLASES = {
  objects: 'sprites/objects/objects', furniture: 'sprites/furniture/furniture',
  rain: 'effects/rain/rain', particles: 'effects/particles/particles', ui: 'ui/ui',
};
const FRAME_ATLAS = new Map();

export function preloadAssets(scene) {
  const L = scene.load;
  L.spritesheet('tiles', A + 'tilesets/tiles.png', { frameWidth: 32, frameHeight: 32 });
  const P = ANIM_DATA.player;
  L.spritesheet('player', A + 'sprites/player/player.png', { frameWidth: P.frameWidth, frameHeight: P.frameHeight });
  for (const [k, g] of Object.entries(ANIM_DATA.ghosts)) {
    L.spritesheet('ghost_' + k, `${A}sprites/ghosts/${k}.png`, { frameWidth: g.frameWidth, frameHeight: g.frameHeight });
  }
  for (const [k, g] of Object.entries(ANIM_DATA.npcs || {})) {
    L.spritesheet('npc_' + k, `${A}sprites/npcs/${k}.png`, { frameWidth: g.frameWidth, frameHeight: g.frameHeight });
  }
  for (const [k, p] of Object.entries(ATLASES)) L.atlas(k, `${A}${p}.png`, `${A}${p}.json`);
  for (const k of ['banyan_back', 'banyan_front', 'banyan_roots']) L.image(k, `${A}sprites/objects/${k}.png`);
  L.image('fog', A + 'effects/fog/fog.png');
  L.image('light_radial', A + 'effects/lighting/light_radial.png');
  L.image('light_cone', A + 'effects/lighting/light_cone.png');
  for (const k of ['menu_sky', 'menu_trees', 'menu_school', 'menu_ground', 'vignette', 'vignette_dark']) L.image(k, `${A}ui/${k}.png`);
}

/** Resolves a sprite name to [textureKey, frame] so callers can write `add.image(x, y, ...tex('lamp'))`. */
export function tex(name) {
  const atlas = FRAME_ATLAS.get(name);
  return atlas ? [atlas, name] : [name];
}

export function buildAssets(scene) {
  for (const k of Object.keys(ATLASES)) {
    for (const n of scene.textures.get(k).getFrameNames()) FRAME_ATLAS.set(n, k);
  }
  const anims = scene.anims;
  const sheetAnims = (texKey, d) => {
    for (const [key, m] of Object.entries(d.anims)) {
      const start = m.row * d.cols;
      anims.create({
        key: (texKey === 'player' ? 'player_' : '') + key,
        frames: anims.generateFrameNumbers(texKey, { start, end: start + m.frames - 1 }),
        frameRate: m.fps, repeat: m.loop ? -1 : 0,
      });
    }
  };
  sheetAnims('player', ANIM_DATA.player);
  for (const [k, g] of Object.entries(ANIM_DATA.ghosts)) sheetAnims('ghost_' + k, g);
  for (const [k, g] of Object.entries(ANIM_DATA.npcs || {})) sheetAnims('npc_' + k, g);
  // Cutscenes address the creature as crawler_idle / crawler_crawl / crawler_chase (+ _r / _l for the side it faces).
  const CR = ANIM_DATA.ghosts.crawler;
  for (const name of ['idle', 'crawl', 'chase']) {
    for (const [suffix, dir] of [['', 2], ['_r', 2], ['_l', 6]]) {
      const m = CR.anims[`crawler_${name}_${dir}`], start = m.row * CR.cols;
      anims.create({ key: `crawler_${name}${suffix}`, frames: anims.generateFrameNumbers('ghost_crawler', { start, end: start + m.frames - 1 }), frameRate: m.fps, repeat: m.loop ? -1 : 0 });
    }
  }

  const seq = (key, atlas, prefix, n, fps, repeat = -1) => anims.create({
    key, frames: Array.from({ length: n }, (_, i) => ({ key: atlas, frame: `${prefix}_${i}` })), frameRate: fps, repeat,
  });
  seq('fx_flag', 'objects', 'flag', 4, 5);
  seq('fx_fan', 'furniture', 'fan', 4, 14);
  seq('fx_curtain', 'furniture', 'curtain', 4, 2);
  seq('fx_ripple', 'rain', 'ripple', 5, 5);
  seq('fx_splash', 'rain', 'splash', 4, 18, 0);
  seq('fx_sparkle', 'particles', 'sparkle', 4, 14, 0);
  seq('fx_tuft', 'particles', 'tuft', 3, 2);
}
