// Per-map view data for the third-person camera. Kept here (not in the map files) so the map definitions stay untouched.
// Headings are radians in map space: 0 = +x (east), PI/2 = +y (south), -PI/2 = north.

const N = -Math.PI / 2, S = Math.PI / 2, E = 0, W = Math.PI;

/** Which way the player faces when they appear at a given spawn. */
export const SPAWN_HEADING = {
  campus: { start: N, fromHall: S },
  hall: { start: W, fromCampus: W, fromClassroomA: E, fromLibrary: E },
  classroomA: { start: N, fromHall: N },
  library: { start: N, fromHall: N },
  auditorium: { start: S, fromHall: S, fromBasement: N },
  basement: { start: N, fromAuditorium: S },
  rooftop: { start: N, fromAuditorium: S, fromBasement: S },
};

export function spawnHeading(mapId, spawn) {
  return SPAWN_HEADING[mapId]?.[spawn] ?? N;
}
