// Static map checks. Run with: npm run verify:maps
import { MAP_BUILDERS, buildMap } from '../src/maps/index.js';
import { TILE } from '../src/config.js';
import { reachable, boxBlocked } from '../src/systems/Collision.js';

const STUB_TARGETS = new Set(); // doors whose destination is not built yet
let errors = 0, warnings = 0;
const err = (m, s) => { errors++; console.error(`  ERROR [${m}] ${s}`); };
const warn = (m, s) => { warnings++; console.warn(`  warn  [${m}] ${s}`); };
const tileOf = (v) => Math.floor(v / TILE);

for (const id of Object.keys(MAP_BUILDERS)) {
  const m = buildMap(id), grid = m.collisionGrid();
  console.log(`map ${id}: ${m.w}x${m.h}`);

  if (!m.spawns.start) err(id, 'missing "start" spawn');
  for (const [name, sp] of Object.entries(m.spawns)) {
    // player body: 12x8 box whose bottom edge is the spawn y
    if (boxBlocked(grid, sp.x, sp.y - 4, 6, 4)) err(id, `spawn "${name}" is inside a wall (${sp.x},${sp.y})`);
  }
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.layers.ground[y][x] < 0) err(id, `empty ground tile at ${x},${y}`);

  const start = m.spawns.start;
  const reach = reachable(grid, tileOf(start.x), tileOf(start.y - 4));
  const can = (px, py) => reach.has(tileOf(py) * m.w + tileOf(px));
  const canNear = (r) => { // any reachable tile within 1 tile of the rect
    for (let ty = tileOf(r.y) - 1; ty <= tileOf(r.y + r.h - 1) + 1; ty++) for (let tx = tileOf(r.x) - 1; tx <= tileOf(r.x + r.w - 1) + 1; tx++) if (reach.has(ty * m.w + tx)) return true;
    return false;
  };

  for (const o of m.objects) {
    const w = o.w ?? TILE, h = o.h ?? TILE;
    if (o.x < 0 || o.y < 0 || o.x > m.w * TILE || o.y > m.h * TILE) err(id, `${o.type} out of bounds (${o.x},${o.y})`);
    if (['pickup', 'note', 'prop', 'container', 'action', 'door', 'lockeddoor', 'gate'].includes(o.type) && !canNear({ x: o.x, y: o.y, w, h })) {
      err(id, `${o.type}${o.id ? ' ' + o.id : ''} at tile ${tileOf(o.x)},${tileOf(o.y)} is unreachable from start`);
    }
    if (o.type === 'door') {
      if (!MAP_BUILDERS[o.target]) { if (!STUB_TARGETS.has(o.target)) err(id, `door -> unknown map "${o.target}"`); }
      else { const t = buildMap(o.target); if (!t.spawns[o.spawn]) err(id, `door -> ${o.target} has no spawn "${o.spawn}"`); }
    }
    if (o.type === 'lockeddoor' && o.target && !MAP_BUILDERS[o.target] && !STUB_TARGETS.has(o.target)) err(id, `locked door -> unknown map "${o.target}"`);
    if (o.type === 'lockeddoor' && o.target && MAP_BUILDERS[o.target] && !buildMap(o.target).spawns[o.spawn]) err(id, `locked door -> ${o.target} has no spawn "${o.spawn}"`);
    if (o.type === 'action' && !o.id) err(id, 'action without id');
    if (o.type === 'pickup' && !o.id) err(id, 'pickup without id');
  }

  for (const [tx, ty] of m.meta.ghostPatrol || []) {
    if (grid[ty]?.[tx] !== false) err(id, `ghost patrol point ${tx},${ty} is blocked`);
    else if (!reach.has(ty * m.w + tx)) err(id, `ghost patrol point ${tx},${ty} unreachable`);
  }
  if (!m.objects.some((o) => o.type === 'door') && id !== 'campus') warn(id, 'no exits');
}

// Cross-check that every door has a way back.
for (const id of Object.keys(MAP_BUILDERS)) {
  for (const o of buildMap(id).objects) {
    if (o.type !== 'door' || !MAP_BUILDERS[o.target]) continue;
    if (!buildMap(o.target).objects.some((d) => (d.type === 'door' || d.type === 'lockeddoor') && d.target === id)) warn(id, `door to ${o.target} has no door back`);
  }
}

console.log(errors ? `\n${errors} error(s), ${warnings} warning(s)` : `\nAll maps OK (${warnings} warning(s))`);
process.exit(errors ? 1 : 0);
