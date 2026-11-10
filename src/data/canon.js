// THE LAST BELL — canon text. Burmese lines below are copied from the design brief; any NEW Burmese line
// must be reviewed by a native speaker before shipping.
export const CHAPTERS = {
  prologue: { en: 'The First Friend', my: 'ပထမဆုံး သူငယ်ချင်း' },
  ch1: { en: 'The Missing Girl', my: 'ပျောက်ဆုံးသွားသော မိန်းကလေး' },
  ch2: { en: 'The Other Side', my: 'အခြားတစ်ဖက်' },
  ch3: { en: "Don't Make a Sound", my: 'အသံမထွက်စေနဲ့' },
  ch4: { en: 'The Forgotten', my: 'မေ့ပျောက်နေသော အမှန်တရား' },
  ch5: { en: 'I Found You', my: 'မင်းကို တွေ့ပြီ' },
  final: { en: 'The Last Bell', my: 'နောက်ဆုံး ခေါင်းလောင်းသံ' },
};

// Companion lines by trigger. Nothing here may hint that she is the monster (enforced by tests).
export const COMPANION_LINES = {
  reunion: ['ငါ့ကို လာရှာတာလား။'],
  bond: ['နင်နဲ့အတူဆို ငါမကြောက်တော့ဘူး။'],
  route: ['ဒီလမ်းကို ငါသိတယ်။'],
  sound: ['ခဏလေး... တစ်ခုခု ကြားလိုက်သလိုပဲ။'],
  silence: ['နင် ဘာလို့ စကားမပြောတာလဲ။'],
  exit: ['ငါတို့ အိမ်ပြန်ကြရအောင်။'],
};

export const FINAL_LINES = {
  question: 'နင် ငါ့ကို မှတ်မိသေးလား။',
  thanks: 'လာပေးလို့ ကျေးဇူးတင်ပါတယ်။',
  plea: 'ငါ့ကို တစ်ယောက်တည်း မထားခဲ့ပါနဲ့...',
};

export const ENDING = {
  gameOver: 'GAME OVER',
  text: 'ဒီကျောင်းမှာ ပျောက်ဆုံးသွားတဲ့ ကျောင်းသားတစ်ယောက် ထပ်ရှိလာပြန်ပြီ။',
  title: 'THE LAST BELL',
  subtitle: 'THE LAST FRIEND',
};
