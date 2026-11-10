// THE LAST BELL cutscene scripts. Each cutscene is a list of steps run in order by CutsceneScene.
// Burmese lines marked (NEW) were written for this build and MUST be reviewed by a native speaker.
// Lines copied word-for-word from the design brief are marked (CANON).
const S = (who, my, en) => ({ say: { who, my, en } });
const A = (id, kind, x, y = 400, face = 'right', extra = {}) => ({ actor: { id, kind, x, y, face, ...extra } });

export const CUTSCENES = {
  // 1+2+prologue: bullying, rescue, friendship, the emotional close.
  prologue: {
    title: { my: 'ပထမဆုံး သူငယ်ချင်း', en: 'PROLOGUE — The First Friend' },
    steps: [
      { bg: 'day' }, { fade: 'in', ms: 900 },
      A('girl', 'girl', 520, 410, 'left'), A('b1', 'bully', 380, 400, 'right'), A('b2', 'bully', 420, 420, 'right'), A('b3', 'bully', 340, 420, 'right'),
      { sfx: 'bell', vol: 0.25 },
      S('b1', 'ဟေ့၊ ဒီမှာ ကြည့်စမ်း။ စကားတောင် မပြောတတ်ဘူး။', 'Hey, look at her. She cannot even speak.'),               // (NEW)
      S('b2', 'နင့်စာအုပ်တွေ ငါတို့ယူသွားမယ်။', 'We are taking your books.'),                                                                        // (NEW)
      { anim: { id: 'girl', key: 'hgirl_down' } }, { shake: 120 },
      S('narr', 'သူမက ဘာမှ မပြောဘဲ ခေါင်းငုံ့နေတယ်။', 'She says nothing and lowers her head.'),                                                       // (NEW)
      A('boy', 'boy', 40, 410, 'right'), { move: { id: 'boy', x: 280, ms: 2200 } },
      S('boy', 'ရပ်လိုက်တော့။ သူ့ကို ဘာလို့ ဒီလိုလုပ်တာလဲ။', 'Stop it. Why are you doing this to her?'),                                              // (NEW)
      S('b1', 'နင်နဲ့ ဘာဆိုင်လို့လဲ။', 'What is it to you?'),                                                                                          // (NEW)
      S('boy', 'သူ့စာအုပ်တွေ ပြန်ပေး။', 'Give her books back.'),                                                                                      // (NEW)
      { move: { id: 'b1', x: 120, ms: 1400 } }, { move: { id: 'b2', x: 60, ms: 1400 } }, { move: { id: 'b3', x: 10, ms: 1500 } },
      { wait: 1200 }, { remove: ['b1', 'b2', 'b3'] },
      { move: { id: 'boy', x: 440, ms: 1000 } },
      S('girl', 'ကျေးဇူးတင်ပါတယ်။', 'Thank you.'),                                                                                                    // (NEW)
      { fade: 'out', ms: 700 },
      // later: classroom, sitting together
      { bg: 'classroom' }, { remove: ['girl', 'boy'] }, { fade: 'in', ms: 700 },
      A('boy', 'boy', 380, 410, 'right', { sit: true }), A('girl', 'girl', 560, 410, 'left'),
      S('boy', 'ငါ့ဘေးမှာ ထိုင်လေ။', 'Sit next to me.'),                                                                                             // (NEW)
      S('girl', 'ရလား။', 'Is that okay?'),                                                                                                            // (NEW)
      S('boy', 'ရတာပေါ့။', 'Of course.'),                                                                                                            // (NEW)
      { move: { id: 'girl', x: 450, ms: 1400 } },
      S('narr', 'နောက်ရက်တွေမှာ သူတို့ စာအုပ်တွေ အတူမျှဝေ ဖတ်ကြတယ်။ ရင်ပြင်ထဲမှာ အတူလျှောက်ကြတယ်။', 'In the days that followed they shared books, and walked the corridors together.'), // (NEW)
      { fade: 'out', ms: 500 }, { bg: 'window_dusk' }, { remove: ['girl', 'boy'] }, { fade: 'in', ms: 800 },
      A('boy', 'boy', 400, 410, 'right', { sit: true }), A('girl', 'girl', 470, 410, 'left'),
      S('girl', 'နင်က ငါ့ရဲ့ ပထမဆုံး သူငယ်ချင်းပဲ။', 'You are my first friend.'),                                                                     // (NEW)
      { sfx: 'bell', vol: 0.3 }, { wait: 1800 },
      { fade: 'out', ms: 1200 },
    ],
    flag: 'prologue_done',
  },

  // 3: she is gone, and he decides to go back at night.
  disappearance: {
    title: { my: 'ပျောက်ဆုံးသွားသော မိန်းကလေး', en: 'CHAPTER 1 — The Missing Girl' },
    steps: [
      { bg: 'classroom' }, { fade: 'in', ms: 700 },
      A('boy', 'boy', 400, 410, 'right', { sit: true }),
      S('boy', 'ဒီနေ့လည်း မလာဘူး။', 'She did not come today either.'),                                                                                // (NEW)
      S('narr', 'သူ ကျောင်းတစ်ခုလုံး လိုက်ရှာတယ်။ စာသင်ခန်း၊ စာကြည့်တိုက်၊ စင်္ကြံ။ ဘယ်မှာမှ မရှိဘူး။', 'He searched the whole school: the classrooms, the library, the corridors. She was nowhere.'), // (NEW)
      { bg: 'day_dim' }, { wait: 600 },
      S('boy', 'ညကျမှ ပြန်သွားကြည့်မယ်။', 'I will go back tonight.'),                                                                                   // (NEW)
      { fade: 'out', ms: 900 },
    ],
  },

  // 4+5: night arrival and first transformation. Played the first time the player reaches the hallway in Chapter 1.
  night_arrival: {
    steps: [
      { bg: 'gate' }, { fade: 'in', ms: 600 },
      S('narr', 'ကျောင်းဝင်းထဲ တိတ်ဆိတ်နေတယ်။', 'The school compound is unnaturally quiet.'),                                                          // (NEW)
      { sfx: 'door', vol: 0.8 }, { shake: 300 },
      S('narr', 'နောက်ကွယ်မှာ ကျောင်းတံခါး ပိတ်သွားတယ်။', 'Behind him, the main gate swings shut.'),                                                  // (NEW)
      { flicker: 1500 }, { sfx: 'bell', vol: 0.6 },
      { tint: { color: 0x300010, a: 0.55, ms: 2500 } },
      S('boy', 'ဒါ ငါသိတဲ့ ကျောင်း မဟုတ်တော့ဘူး။', 'This is not the school I know.'),                                                                    // (NEW)
      { fade: 'out', ms: 900 },
    ],
    flag: 'transformed',
  },

  // 6: first glimpse of the creature (start of Chapter 3).
  monster_intro: {
    title: { my: 'အသံမထွက်စေနဲ့', en: "CHAPTER 3 — Don't Make a Sound" },
    steps: [
      { bg: 'night_dark' }, { fade: 'in', ms: 500 },
      A('boy', 'boy', 200, 410, 'right'), A('crawler', 'crawler', 760, 430, 'left', { alpha: 0 }),
      { sfx: 'whisper', vol: 0.6 }, { fadeActor: { id: 'crawler', a: 0.9, ms: 1500 } },
      { move: { id: 'crawler', x: 620, ms: 3000 } },
      { sfx: 'creak', vol: 0.5 }, { wait: 500 },
      S('narr', 'အသံမထွက်စေနဲ့။ သူ အသံကို နားထောင်နေတယ်။', "Don't make a sound. It is listening."),                                                       // (NEW)
      { fade: 'out', ms: 700 },
    ],
  },

  // 7: the bullies, injured, inside the storage room.
  bullies_found: {
    steps: [
      { bg: 'night_dark' }, { fade: 'in', ms: 500 },
      A('boy', 'boy', 220, 410, 'right'), A('b1', 'bully', 520, 440, 'left', { lie: true }), A('b2', 'bully', 600, 445, 'left', { lie: true }), A('b3', 'bully', 680, 440, 'left', { lie: true }),
      S('boy', 'ဒီကောင်တွေ... အသက်ရှူနေသေးတယ်။', 'These boys... they are still breathing.'),                                                           // (NEW)
      S('boy', 'ဘာတွေ ဖြစ်သွားတာလဲ။', 'What happened here?'),                                                                                          // (NEW)
      { fade: 'out', ms: 700 },
    ],
  },

  // 8: she is sitting alone in the old classroom, looking entirely human.
  reunion: {
    title: { my: 'မင်းကို တွေ့ပြီ', en: 'CHAPTER 5 — I Found You' },
    steps: [
      { bg: 'classroom_old' }, { fade: 'in', ms: 800 },
      A('girl', 'girl', 520, 410, 'left', { sit: true }), A('boy', 'boy', 120, 410, 'right'),
      { move: { id: 'boy', x: 330, ms: 2600 } },
      S('boy', 'နင် ဒီမှာ ရှိနေတာကိုး။', 'So you were here all along.'),                                                                                // (NEW)
      S('girl', 'ငါ့ကို လာရှာတာလား။', 'Did you come looking for me?'),                                                                                // (CANON)
      S('girl', 'နင်နဲ့အတူဆို ငါမကြောက်တော့ဘူး။', 'With you, I am not afraid any more.'),                                                                // (CANON)
      { fade: 'out', ms: 800 },
    ],
    flag: null, // the GameScene sets the story flag (reunion) via the puzzle action
  },

  // 9: the walk toward the exit (short interstitial when they reach the courtyard).
  journey: {
    steps: [
      { bg: 'night_calm' }, { fade: 'in', ms: 700 },
      A('boy', 'boy', 300, 410, 'right'), A('girl', 'girl', 230, 410, 'right'),
      { move: { id: 'boy', x: 700, ms: 4200 } }, { move: { id: 'girl', x: 630, ms: 4200 } },
      S('girl', 'ဒီလမ်းကို ငါသိတယ်။', 'I know this way.'),                                                                                              // (CANON)
      S('girl', 'ငါတို့ အိမ်ပြန်ကြရအောင်။', 'Let us go home.'),                                                                                         // (CANON)
      { fade: 'out', ms: 700 },
    ],
  },

  // Optional story wing: the assembly hall remembers the last student duty after the power comes back.
  assembly_whisper: {
    title: { my: 'အသံမရှိတဲ့ စင်မြင့်', en: 'THE EMPTY ASSEMBLY' },
    steps: [
      { bg: 'assembly' }, { fade: 'in', ms: 800 },
      A('boy', 'boy', 220, 420, 'right'), A('girl', 'girl', 760, 410, 'left', { alpha: 0 }),
      { sfx: 'door', vol: 0.45 }, { shake: 180 },
      S('narr', 'စင်မြင့်ပေါ်မှာ ဖုန်တွေ မတည်ငြိမ်ဘူး။', 'The dust on the stage has been disturbed from the inside.'),
      { fadeActor: { id: 'girl', a: 0.9, ms: 1200 } },
      { move: { id: 'girl', x: 560, ms: 2400 } }, { anim: { id: 'girl', key: 'hgirl_down' } },
      S('girl', 'နောက်ဆုံးခေါင်းလောင်း မထိုးခင် ငါ့နာမည်ကို မဖတ်ပါနဲ့။', 'Do not read my name before the last bell.'),
      { sfx: 'chair_move', vol: 0.55 }, { flicker: 1100 },
      { zoom: { focus: 'girl', to: 1.16, ms: 750 } },
      S('narr', 'စာရင်းစာရွက်ပေါ်က နာမည်တစ်ကြောင်းက သူ့အလိုလို စိုလာတယ်။', 'A single name on the assembly list becomes wet, as if freshly written.'),
      { tint: { color: 0x16000f, a: 0.62, ms: 900 } }, { sfx: 'whisper', vol: 0.7 },
      { face: { id: 'girl', dir: 'right' } }, { wait: 900 },
      S('boy', 'မင်း ဒီမှာ မရှိသင့်ဘူး။', 'You should not be here.'),
      { fade: 'out', ms: 1100 },
    ],
  },

  bell_chamber: {
    title: { my: 'မြေအောက် ခေါင်းလောင်း', en: 'THE BELL BELOW' },
    steps: [
      { bg: 'basement' }, { fade: 'in', ms: 700 },
      A('boy', 'boy', 200, 420, 'right'), A('crawler', 'crawler', 790, 430, 'left', { alpha: 0 }),
      { sfx: 'water', vol: 0.45 },
      S('narr', 'ပိုက်တွေထဲက ရေသံဟာ တစ်ယောက်ယောက် အသက်ရှူသံလို ဖြစ်နေတယ်။', 'Water moves through the pipes like someone breathing behind the walls.'),
      { move: { id: 'boy', x: 360, ms: 1800 } }, { sfx: 'switch', vol: 0.35 },
      { fadeActor: { id: 'crawler', a: 0.25, ms: 900 } },
      S('narr', 'ခေါင်းလောင်းကြိုးက အောက်ဘက်ကို ဆင်းသွားပြီး အမှောင်ထဲမှာ ပျောက်သွားတယ်။', 'The bell rope disappears downward into the dark.'),
      { move: { id: 'crawler', x: 650, ms: 1800 } }, { anim: { id: 'crawler', key: 'crawler_idle' } },
      S('narr', 'တစ်ခါတလေ အလင်းက အမှောင်ကို ဖယ်ရှားတာ မဟုတ်ဘူး။ အမှောင်ကို အမည်ပေးတာပဲ။', 'Sometimes a light does not remove the dark. It only gives the dark a name.'),
      { flicker: 1700 }, { shake: 320 }, { sfx: 'bell', vol: 0.8 },
      { zoom: { focus: 'crawler', to: 1.2, ms: 900 } },
      S('narr', 'အပေါ်ထပ်မှာ တံခါးတစ်ချပ် ပွင့်သွားတယ်။ ခေါင်းလောင်းက မတီးသေးဘူး။', 'A door opens upstairs. The bell has not rung yet.'),
      { tint: { color: 0x02030a, a: 0.75, ms: 700 } }, { wait: 700 }, { fade: 'out', ms: 950 },
    ],
  },

  // 11+12: the aftermath only. The twist itself (bell, "do you remember me?", the girl turning into the creature, the chase and the
  // kill) is REAL GAMEPLAY now (GameScene.runFinal / finalDeath), not a cutscene. This starts right after the player is caught.
  final_end: {
    noSkip: true,
    steps: [
      { death: true },
      { bg: 'black' }, { wait: 2500 }, { sfx: 'bell', vol: 0.4 }, { wait: 2800 },
      { bigtext: { text: 'GAME OVER', color: '#d03a48', size: 64, ms: 3500 } },

      { bigtext: { text: 'ဒီကျောင်းမှာ ပျောက်ဆုံးသွားတဲ့ ကျောင်းသားတစ်ယောက် ထပ်ရှိလာပြန်ပြီ။', color: '#dfe6ff', size: 26, ms: 6000 } }, // (CANON)
      { bigtext: { text: 'THE LAST BELL', color: '#f4f6ff', size: 72, sub: 'THE LAST FRIEND', ms: 4500 } },
      { credits: [
        'THE LAST BELL',
        '',
        'A psychological horror game set in a Myanmar high school',
        '',
        'Built with Phaser 3, Howler.js and Vite',
        'Art and sound are generated placeholders',
        '',
        'Some friendships never end.',
        'Some spirits never leave.',
        '',
        'Thank you for playing.',
      ] },
    ],
  },
};
