import { DOORS, ACTIONS, ROOMS } from '../maps/schoolGraph.js';

// Applies locks and puzzle actions against a ChapterState. Every action returns a feedback key the UI can show.
export class PuzzleSystem {
  constructor(state) { this.state = state; this.done = new Set(); }

  doorState(id) {
    const d = DOORS.find((x) => x.id === id);
    if (!d) throw new Error('Unknown door ' + id);
    if (!this.state.atLeast(d.chapter)) return { open: false, why: 'not_yet' };
    const miss = d.needs.filter((f) => !this.state.has(f));
    return miss.length ? { open: false, why: 'locked', missing: miss } : { open: true };
  }

  roomsReachable(from = 'gate') {
    const seen = new Set([from]), q = [from];
    while (q.length) {
      const r = q.pop();
      for (const d of DOORS) {
        const other = d.a === r ? d.b : d.b === r ? d.a : null;
        if (other && !seen.has(other) && this.doorState(d.id).open) { seen.add(other); q.push(other); }
      }
    }
    return seen;
  }

  canDo(id, room) {
    const a = ACTIONS.find((x) => x.id === id);
    if (!a || this.done.has(id) || a.room !== room) return false;
    return this.state.atLeast(a.chapter) && a.needs.every((f) => this.state.has(f));
  }

  /** Perform an action in a room. Returns {ok, chapter} where chapter is set if the story advanced. */
  perform(id, room) {
    if (!this.canDo(id, room)) return { ok: false };
    const a = ACTIONS.find((x) => x.id === id);
    this.done.add(id);
    let chapter = null;
    for (const f of a.gives) chapter = this.state.setFlag(f) || chapter;
    return { ok: true, chapter };
  }
}
export { ROOMS };
