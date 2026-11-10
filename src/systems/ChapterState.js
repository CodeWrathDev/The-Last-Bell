import { CHAPTERS } from '../data/canon.js';

export const ORDER = ['prologue', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'final', 'ending'];
export const chapterIndex = (c) => ORDER.indexOf(c);

// Flag that completes each chapter (ch4 needs all three evidence flags).
const DONE = {
  prologue: ['prologue_done'], ch1: ['transformed'], ch2: ['power_on'], ch3: ['has_office_key'],
  ch4: ['photo_seen', 'records_found', 'bullies_found'], ch5: ['gate_approach'],
};
export const FINAL_STEPS = ['approach', 'bell', 'turn', 'transform', 'attack', 'death', 'gameover', 'text', 'title', 'credits'];

export class ChapterState {
  constructor() { this.chapter = 'prologue'; this.flags = new Set(); this.girlForm = 'human'; this.finalStep = null; this.log = []; }
  get index() { return chapterIndex(this.chapter); }
  atLeast(c) { return this.index >= chapterIndex(c); }
  has(f) { return this.flags.has(f); }
  hasAll(list) { return list.every((f) => this.flags.has(f)); }
  title() { return CHAPTERS[this.chapter === 'ending' ? 'final' : this.chapter]; }

  /** Environmental state 1..5 from the design doc. */
  get mapState() {
    switch (this.chapter) {
      case 'prologue': return 1;
      case 'ch1': return 2;
      case 'ch2': case 'ch3': case 'ch4': return 3;
      case 'ch5': return 4;
      default: return 5;
    }
  }
  /** Only the creature hunts, and only in Chapters 3-4, and again after the reveal. */
  get monsterActive() { return this.chapter === 'ch3' || this.chapter === 'ch4' || this.girlForm === 'crawler'; }
  get companionActive() { return (this.chapter === 'ch5' || this.chapter === 'final') && this.girlForm === 'human'; }
  get identityRevealed() { return this.girlForm === 'crawler'; }
  get canEscape() { return false; }        // canon: the player never escapes
  get canPlayerAttack() { return false; }  // canon: the player cannot fight

  /** Set a flag; advances the chapter if its completion flags are now all present. Returns the new chapter or null. */
  setFlag(f) {
    this.flags.add(f);
    const need = DONE[this.chapter];
    if (need && this.hasAll(need)) {
      const next = ORDER[this.index + 1];
      this.chapter = next; this.log.push(next);
      if (next === 'final') this.finalStep = 'approach';
      return next;
    }
    return null;
  }

  /** The ending sequence only moves forward, one step at a time, and only inside the final chapter. */
  advanceFinal(step) {
    if (this.chapter !== 'final' && this.chapter !== 'ending') throw new Error('Final sequence outside final chapter');
    const cur = FINAL_STEPS.indexOf(this.finalStep), nxt = FINAL_STEPS.indexOf(step);
    if (nxt !== cur + 1) throw new Error(`Final step out of order: ${this.finalStep} -> ${step}`);
    this.finalStep = step;
    if (step === 'transform') this.girlForm = 'crawler';
    if (step === 'death') this.chapter = 'ending';
    return step;
  }

  toJSON() { return { chapter: this.chapter, flags: [...this.flags], girlForm: this.girlForm, finalStep: this.finalStep }; }
  static from(o) { const s = new ChapterState(); s.chapter = o.chapter; s.flags = new Set(o.flags); s.girlForm = o.girlForm; s.finalStep = o.finalStep; return s; }
}
