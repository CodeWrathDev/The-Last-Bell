// Writes every map as Tiled JSON into public/assets/maps (open with Tiled using tilesets/tiles.png).
import { writeFileSync, mkdirSync } from 'node:fs';
import { MAP_BUILDERS, buildMap } from '../src/maps/index.js';
mkdirSync('public/assets/maps', { recursive: true });
for (const id of Object.keys(MAP_BUILDERS)) {
  const m = buildMap(id), j = m.toTiled();
  j.tilesets[0].image = '../tilesets/tiles.png';
  writeFileSync(`public/assets/maps/${id}.json`, JSON.stringify(j));
  console.log('wrote', id);
}
