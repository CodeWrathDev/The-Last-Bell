// Room graph, locks and puzzle actions for the single connected school. Engine-neutral data;
// tests/solver in tools/test-last-bell.mjs prove the school is fully reachable and the story is solvable.
export const ROOMS = ['gate', 'courtyard', 'corridor', 'c10A', 'c10B', 'library', 'office', 'toilets', 'stairs', 'upper', 'storage', 'oldroom', 'service'];

// chapter = first chapter in which the door may open; needs = flags required.
export const DOORS = [
  { id: 'A',  a: 'gate',     b: 'courtyard', chapter: 'prologue', needs: [] },
  { id: 'B',  a: 'courtyard',b: 'corridor',  chapter: 'prologue', needs: [] },
  { id: 'D1', a: 'corridor', b: 'c10A',      chapter: 'prologue', needs: [] },
  { id: 'D4', a: 'corridor', b: 'c10B',      chapter: 'ch2', needs: ['has_key_10b'] },
  { id: 'D2', a: 'corridor', b: 'library',   chapter: 'ch2', needs: ['power_on'] },
  { id: 'D3', a: 'corridor', b: 'office',    chapter: 'ch4', needs: ['has_office_key'] },
  { id: 'D5', a: 'corridor', b: 'toilets',   chapter: 'ch2', needs: [] },
  { id: 'D6', a: 'corridor', b: 'stairs',    chapter: 'ch2', needs: [] },
  { id: 'U1', a: 'stairs',   b: 'upper',     chapter: 'ch2', needs: [] },
  { id: 'J',  a: 'upper',    b: 'storage',   chapter: 'ch4', needs: ['knows_storage_code'] },
  { id: 'W',  a: 'upper',    b: 'c10A',      chapter: 'ch3', needs: [] },                       // west-stair shortcut
  { id: 'D7', a: 'c10A',     b: 'oldroom',   chapter: 'ch4', needs: ['photo_seen', 'records_found'] }, // hidden passage
  { id: 'D8', a: 'c10A',     b: 'c10B',      chapter: 'ch2', needs: ['has_key_10b'] },     // connecting classroom door (loop A)
  { id: 'L1', a: 'library',  b: 'office',    chapter: 'ch4', needs: [] },  // records passage (loop B)
  { id: 'K1', a: 'oldroom',  b: 'service',   chapter: 'ch5', needs: [] },
  { id: 'K2', a: 'service',  b: 'courtyard', chapter: 'ch5', needs: ['reunion'] },             // final exit route
];

// Things the player does in a room. `gives` are flags set on completion; each action is done once.
export const ACTIONS = [
  { id: 'prologue_end',       room: 'c10A',     chapter: 'prologue', needs: [], gives: ['prologue_done'] },
  { id: 'enter_night_school', room: 'corridor', chapter: 'ch1', needs: [], gives: ['transformed'] },
  { id: 'find_ground_clue', room: 'courtyard', chapter: 'ch1', needs: [], gives: ['ground_clue'] },
  { id: 'read_notice',        room: 'c10A',     chapter: 'ch2', needs: [], gives: ['knows_cabinet_code'] },
  { id: 'take_key_10b',       room: 'c10A',     chapter: 'ch2', needs: [], gives: ['has_key_10b'] },
  { id: 'take_fuse',          room: 'c10B',     chapter: 'ch2', needs: [], gives: ['has_fuse'] },
  { id: 'restore_power',      room: 'toilets',  chapter: 'ch2', needs: ['has_fuse'], gives: ['power_on'] },
  { id: 'open_cabinet',       room: 'library',  chapter: 'ch3', needs: ['knows_cabinet_code'], gives: ['has_office_key'] },
  { id: 'read_register',      room: 'office',   chapter: 'ch4', needs: [], gives: ['knows_storage_code'] },
  { id: 'see_photo',          room: 'office',   chapter: 'ch4', needs: [], gives: ['photo_seen'] },
  { id: 'find_torn_page',     room: 'storage',  chapter: 'ch4', needs: [], gives: ['records_found'] },
  { id: 'find_bullies',       room: 'storage',  chapter: 'ch4', needs: [], gives: ['bullies_found'] },
  { id: 'reunion',            room: 'oldroom',  chapter: 'ch5', needs: [], gives: ['reunion'] },
  { id: 'gate_approach',      room: 'courtyard',chapter: 'ch5', needs: ['reunion'], gives: ['gate_approach'] },
];

// Monster patrol loops (room sequences). Validated against the graph by the tests.
export const MONSTER_ROUTES = {
  A: ['corridor', 'c10A', 'corridor', 'c10B'],
  B: ['corridor', 'library', 'corridor', 'office'],
  C: ['stairs', 'upper', 'storage', 'upper'],
};
