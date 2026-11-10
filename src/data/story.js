import { tr, stop, isMy } from '../systems/Lang.js';

// THE LAST BELL story data: chapter cards, objectives and the opening text. Chapter ids match ChapterState.ORDER.
// All text here is ENGLISH source text; tr() (src/systems/Lang.js) shows the Myanmar line when the player picks Myanmar.
export const DAWN_ENFORCED = false;
export const MINUTES_PER_SECOND = 0.5;

export const CHAPTERS = {
  prologue: { n: 'PROLOGUE', en: 'The First Friend', my: 'ပထမဆုံး သူငယ်ချင်း' },
  ch1: { n: 'CHAPTER 1', en: 'The Missing Girl', my: 'ပျောက်ဆုံးသွားသော မိန်းကလေး' },
  ch2: { n: 'CHAPTER 2', en: 'The Other Side', my: 'အခြားတစ်ဖက်' },
  ch3: { n: 'CHAPTER 3', en: "Don't Make a Sound", my: 'အသံမထွက်စေနဲ့' },
  ch4: { n: 'CHAPTER 4', en: 'The Forgotten', my: 'မေ့ပျောက်နေသော အမှန်တရား' },
  ch5: { n: 'CHAPTER 5', en: 'I Found You', my: 'မင်းကို တွေ့ပြီ' },
  final: { n: 'FINAL CHAPTER', en: 'The Last Bell', my: 'နောက်ဆုံး ခေါင်းလောင်းသံ' },
};

/** Chapter heading text in the current language: { tag: 'CHAPTER 1', title: 'The Missing Girl' }. */
export function chapterText(id) {
  const c = CHAPTERS[id]; if (!c) return { tag: '', title: '' };
  return { tag: tr(c.n), title: tr(c.en) };
}

// Objective text per chapter (and a refinement once part of the chapter is done).
export function objectiveFor(story) {
  const h = (f) => story.has(f);
  switch (story.chapter) {
    case 'ch1': return h('ground_clue')
      ? tr('The rain revealed her last route. Follow it into the main building and start in Classroom 10A.')
      : tr('She did not come to school. Search the grounds for a clue, then go into the main building.');
    case 'ch2':
      if (!h('has_key_10b')) return tr('The school has changed. Search Classroom 10A for a way forward.');
      if (!h('has_fuse')) return tr('Open Classroom 10B and look for a spare fuse.');
      return tr('Restore the power from the electrical panel in the toilets.');
    case 'ch3':
      if (!h('auditorium_seen')) return tr('The side door to the assembly hall is open. Follow the stage bell, then find the cabinet code in Classroom 10A.');
      if (!h('knows_cabinet_code')) return tr('Something is crawling through the school. Stay quiet. Find the cabinet code (Classroom 10A).');
      return tr('Open the Library cabinet and take the Office key. Do not run.');
    case 'ch4': {
      const need = [];
      if (!h('photo_seen')) need.push('the old photograph in the Office');
      if (!h('knows_storage_code')) need.push('the storage code in the Office register');
      if (!h('records_found') || !h('bullies_found')) need.push('what is hidden in the Storage Room upstairs');
      const required = need.map(tr).join(isMy() ? '၊ ' : ', ');
      const side = !h('bell_room_seen') ? tr('The bell ledger beneath the Assembly Hall may explain why the school keeps changing.') + ' ' : '';
      return tr('Learn the truth: ') + (required || side + tr('then find the hidden passage behind the Classroom 10A blackboard')) + stop();
    }
    case 'ch5':
      if (!h('reunion')) return tr('Find the hidden old classroom (through the blackboard wall in Classroom 10A).');
      return tr('Take her home. Leave through the service passage and walk to the main gate.');
    default: return tr('Reach the gate.');
  }
}

/** The opening lines (translated when read, so a language change before New Game applies). */
export const INTRO_EN = [
  'She has not come to school for days. Nobody will say why.',
  'Tonight you came back alone. The campus is empty and the gate stands open behind you.',
  'Go into the main building. Start in Classroom 10A.',
];
export const intro = () => INTRO_EN.map(tr);
