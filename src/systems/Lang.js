import { Settings } from './Settings.js';
import { MY, EN } from '../data/i18n.js';

// Language switch (English / Myanmar). English source strings are the keys (see data/i18n.js).
//   tr(s)            translate one string (falls back to the string itself)
//   trf(s, ...args)  translate, then fill {0} {1} ...
//   pick(en, my)     for data that already carries both languages (cutscenes, signs)
//   bind(obj, fn)    a Phaser Text whose content is fn(); it refreshes itself when the language changes
//   digits(s)        Western digits -> Myanmar digits in Myanmar mode
let lang = Settings.get('lang') === 'my' ? 'my' : 'en';
const listeners = new Set();
const MYDIG = '၀၁၂၃၄၅၆၇၈၉';

export const LANGS = ['en', 'my'];
export const LANG_NAME = { en: 'English', my: 'မြန်မာ' };
export const getLang = () => lang;
export const isMy = () => lang === 'my';

export function setLang(l) {
  l = l === 'my' ? 'my' : 'en';
  if (l === lang) return;
  lang = l; Settings.set('lang', l);
  for (const fn of [...listeners]) { try { fn(l); } catch (e) { console.error(e); } }
}
export const onLang = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function tr(s) {
  if (s == null || s === '') return s ?? '';
  const k = String(s);
  return lang === 'my' ? (MY[k] ?? k) : (EN[k] ?? k);
}
export const trf = (s, ...args) => tr(s).replace(/\{(\d+)\}/g, (_, i) => (args[+i] ?? ''));
export const pick = (en, my) => (lang === 'my' ? (my || tr(en)) : (en || tr(my)));
export const digits = (s) => (lang === 'my' ? String(s).replace(/[0-9]/g, (d) => MYDIG[+d]) : String(s));
export const stop = () => (lang === 'my' ? '။' : '.');

/** Text object whose string comes from fn(); re-evaluated on every language change. Works with plain strings too. */
export function bind(obj, fn) {
  const get = typeof fn === 'function' ? fn : () => tr(fn);
  obj.__langOff?.();                                   // re-binding replaces the old binding (no listener build-up)
  const off = onLang(() => { if (obj.scene && obj.active !== false) obj.setText(get()); });
  obj.__langOff = off;
  if (!obj.__langDestroy) { obj.__langDestroy = true; obj.once?.('destroy', () => obj.__langOff?.()); }
  obj.setText(get());
  return obj;
}

// ---- grapheme-safe slicing for the typewriter (never cuts a Burmese syllable in half) ----
const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const cache = new Map();
export function graphemes(s) {
  s = String(s ?? '');
  let g = cache.get(s);
  if (!g) {
    g = seg ? Array.from(seg.segment(s), (x) => x.segment) : Array.from(s);
    if (cache.size > 300) cache.clear();
    cache.set(s, g);
  }
  return g;
}
