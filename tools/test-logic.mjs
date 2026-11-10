// Phaser-free logic tests: collision, pathfinding, ghost AI. Run: npm run test:logic
import assert from 'node:assert/strict';
import { buildMap } from '../src/maps/index.js';
import { TILE } from '../src/config.js';
import { moveBody, bfs, hasLOS } from '../src/systems/Collision.js';
import { GhostBrain, GS } from '../src/systems/GhostBrain.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const seeded = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const world = (o = {}) => ({ px: 0, py: 0, hidden: false, hideTile: null, hideSpots: [], flashOn: false, flashAngle: 0, flashRange: 250, ...o });

const campus = buildMap('campus'), cg = campus.collisionGrid();
const hall = buildMap('hall'), hg = hall.collisionGrid();

test('player cannot walk through the campus fence / gate', () => {
  const sp = campus.spawns.start, b = { x: sp.x, y: sp.y - 4, hw: 6, hh: 4 };
  for (let i = 0; i < 200; i++) moveBody(cg, b, 0, 4);
  assert.ok(b.y + 4 <= 23 * TILE + 0.01, 'stopped by fence, y=' + b.y);
});

test('a walkable route exists from the gate to the main-building door (straight up the entrance path since v15)', () => {
  const sp = campus.spawns.start;
  const path = bfs(cg, Math.floor(sp.x / TILE), Math.floor((sp.y - 4) / TILE), 19, 5);
  assert.ok(path && path.length >= 14, 'path length ' + path?.length);
  // follow it with the real collision code
  const b = { x: sp.x, y: sp.y - 4, hw: 6, hh: 4 };
  for (const t of path) {
    const tx = t.tx * TILE + 16, ty = t.ty * TILE + 16;
    for (let i = 0; i < 80 && Math.hypot(tx - b.x, ty - b.y) > 2; i++) {
      const d = Math.hypot(tx - b.x, ty - b.y), s = Math.min(3, d);
      moveBody(cg, b, ((tx - b.x) / d) * s, 0); moveBody(cg, b, 0, ((ty - b.y) / d) * s);
    }
  }
  assert.ok(b.y < 6 * TILE && Math.abs(b.x - (19 * TILE + 16)) < 40, `ended at ${b.x},${b.y}`);
});

test('banyan planter blocks movement', () => {
  const b = { x: 9 * TILE + 16, y: 11 * TILE, hw: 6, hh: 4 };
  for (let i = 0; i < 100; i++) moveBody(cg, b, 0, 4);
  assert.ok(b.y + 4 <= 13 * TILE + 0.01);
});

test('BFS finds a path across the campus and none into a wall', () => {
  const p = bfs(cg, 19, 21, 5, 15);
  assert.ok(p && p.length > 10);
  assert.equal(bfs(cg, 19, 21, 12, 2), null); // inside the building roof
});

test('line of sight is blocked by the building', () => {
  assert.equal(hasLOS(cg, 12 * TILE, 3 * TILE, 12 * TILE, 12 * TILE), false);
  assert.equal(hasLOS(cg, 3 * TILE, 12 * TILE, 15 * TILE, 12 * TILE), true);
});

test('ghost patrols, spots the player, chases and damages on contact', () => {
  const patrol = [{ x: 4 * TILE + 16, y: 5 * TILE }, { x: 32 * TILE + 16, y: 5 * TILE }];
  const g = new GhostBrain({ x: patrol[0].x, y: patrol[0].y, patrol, grid: hg, rng: seeded(7) });
  const player = { px: 12 * TILE, py: 5 * TILE };
  let contact = false, spotted = false;
  for (let i = 0; i < 60 * 20 && !contact; i++) {
    g.update(1 / 60, world(player));
    if (g.events.includes('spot')) spotted = true;
    contact = g.contact;
  }
  assert.ok(spotted, 'ghost spotted player in the corridor');
  assert.ok(contact, 'ghost reached the player');
});

test('ghost cannot see a hidden player and gives up searching', () => {
  const patrol = [{ x: 4 * TILE + 16, y: 5 * TILE }, { x: 32 * TILE + 16, y: 5 * TILE }];
  const g = new GhostBrain({ x: 10 * TILE, y: 5 * TILE, patrol, grid: hg, rng: () => 0.99 }); // rng 0.99: never "finds" a hider
  g.setHideSpots([{ tx: 5, ty: 7, x: 5 * TILE + 16, y: 7 * TILE + 16 }]);
  const w = world({ px: 5 * TILE + 16, py: 7 * TILE + 16, hidden: true, hideTile: { tx: 5, ty: 7 } });
  g.last = { x: w.px, y: w.py }; g.enter(GS.CHASE); g.loseT = 1.3;
  let found = false, gaveUp = false, contact = false;
  for (let i = 0; i < 60 * 30; i++) {
    g.update(1 / 60, w);
    found ||= g.events.includes('found'); gaveUp ||= g.events.includes('gave_up'); contact ||= g.contact;
  }
  assert.ok(!found && !contact, 'unlucky roll: player stays hidden');
  assert.ok(gaveUp, 'ghost gave up and returned to patrol');
});

test('ghost finds a hider when the roll succeeds', () => {
  const patrol = [{ x: 4 * TILE + 16, y: 5 * TILE }];
  const g = new GhostBrain({ x: 8 * TILE, y: 5 * TILE, patrol, grid: hg, rng: () => 0.1 });
  g.setHideSpots([{ tx: 5, ty: 7, x: 5 * TILE + 16, y: 7 * TILE + 16 }]);
  const w = world({ px: 5 * TILE + 16, py: 7 * TILE + 16, hidden: true, hideTile: { tx: 5, ty: 7 } });
  g.last = { x: w.px, y: w.py }; g.enter(GS.CHASE); g.loseT = 1.3;
  let found = false;
  for (let i = 0; i < 60 * 20 && !found; i++) { g.update(1 / 60, w); found = g.events.includes('found'); }
  assert.ok(found);
});

test('a sustained flashlight beam repels the ghost', () => {
  const g = new GhostBrain({ x: 20 * TILE, y: 5 * TILE, patrol: [{ x: 4 * TILE + 16, y: 5 * TILE }, { x: 32 * TILE + 16, y: 5 * TILE }], grid: hg, rng: seeded(3) });
  const w = world({ px: 14 * TILE, py: 5 * TILE, flashOn: true, flashAngle: 0 }); // beam points +x at the ghost
  let repelled = false;
  for (let i = 0; i < 60 * 8 && !repelled; i++) {
    const before = g.state; g.update(1 / 60, w);
    if (g.events.includes('repel')) repelled = true;
    if (g.state === GS.CHASE && before !== GS.CHASE) g.body.x = Math.max(g.body.x, 20 * TILE); // keep range for the test
    w.px = 14 * TILE; // player holds still
  }
  assert.ok(repelled && g.state === GS.REPEL);
});

test('ghost investigates a noise then returns to patrol', () => {
  const patrol = [{ x: 4 * TILE + 16, y: 5 * TILE }, { x: 32 * TILE + 16, y: 5 * TILE }];
  const g = new GhostBrain({ x: 30 * TILE, y: 5 * TILE, patrol, grid: hg, rng: seeded(5) });
  g.enter(GS.PATROL, 0);
  assert.ok(g.hear(24 * TILE, 5 * TILE, 220));
  assert.equal(g.state, GS.INVESTIGATE);
  const far = world({ px: 2 * TILE + 16, py: 3 * TILE }); // player out of sight behind everything
  const seen = new Set();
  for (let i = 0; i < 60 * 40; i++) { g.update(1 / 60, far); seen.add(g.state); }
  assert.ok(seen.has(GS.SEARCH) || seen.has(GS.RETURN));
  assert.ok(seen.has(GS.PATROL));
});

console.log(`\n${n} tests passed`);
