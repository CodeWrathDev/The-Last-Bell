// Every English key in the maps must have a Myanmar entry; English mode must show no Burmese.
import { buildMap, MAP_BUILDERS } from '../src/maps/index.js';
import { MY, EN } from '../src/data/i18n.js';
const BUR = /[က-႟]/;
const seen = new Map();
const add = (k, v) => { if (typeof v === 'string' && v && !seen.has(v)) seen.set(v, k); };
for (const id of Object.keys(MAP_BUILDERS)) {
  const m = buildMap(id);
  add(id + ':name', m.meta.name);
  for (const o of m.objects) {
    for (const k of ['text', 'label', 'plate', 'hint', 'needHint', 'done', 'empty', 'en', 'my']) add(id + ':' + o.type + ':' + k, o[k]);
    if (o.lines) o.lines.forEach((l, i) => add(id + ':chalk' + i, l));
  }
}
let bad = 0;
for (const [s, where] of seen) {
  if (BUR.test(s)) { if (!(s in EN)) { console.log('no EN for', where, JSON.stringify(s)); bad++; } }
  else if (/[A-Za-z]{3}/.test(s) && !(s in MY)) { console.log('no MY for', where, JSON.stringify(s)); bad++; }
}
console.log(`${seen.size} strings checked, ${bad} missing`);
process.exit(bad ? 1 : 0);
