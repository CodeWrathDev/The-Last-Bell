import { buildCampus } from './campus.js';
import { buildHall } from './hall.js';
import { buildClassroomA } from './classroom.js';
import { buildLibrary } from './library.js';
import { buildClassroomB, buildToilets, buildStairs, buildUpper, buildStorage, buildOffice, buildOldClassroom, buildService } from './rooms.js';
import { buildAuditorium, buildBasement, buildRooftop } from './extension.js';

// Add a new area: write a builder (see campus.js) and register it here.
export const MAP_BUILDERS = {
  campus: buildCampus,
  hall: buildHall,
  classroomA: buildClassroomA,
  library: buildLibrary,
  classroomB: buildClassroomB, toilets: buildToilets, stairs: buildStairs, upper: buildUpper,
  storage: buildStorage, office: buildOffice, oldroom: buildOldClassroom, service: buildService,
  auditorium: buildAuditorium, basement: buildBasement, rooftop: buildRooftop,
};

export function buildMap(id) {
  const b = MAP_BUILDERS[id];
  if (!b) throw new Error('Unknown map: ' + id);
  return b();
}
